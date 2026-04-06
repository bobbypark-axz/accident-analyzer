"""교통사고 영상 분석기 - API 서버
기능: 차량감지, 충돌감지, 신호등 색상 판별, 차선 인식, 차량 추적/속도, 전복 감지
React 프론트엔드에서 호출하는 REST API 전용
"""

import base64
import io
import json
import os
import re
import uuid
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np
from dotenv import load_dotenv
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image
from ultralytics import YOLO
from werkzeug.utils import secure_filename

load_dotenv()

try:
    import anthropic
    ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY")
    HAS_CLAUDE = bool(ANTHROPIC_KEY)
except ImportError:
    HAS_CLAUDE = False
    ANTHROPIC_KEY = None

app = Flask(__name__)
CORS(app)  # React 프론트엔드에서 접근 허용

app.config["UPLOAD_FOLDER"] = Path("/tmp/uploads")
app.config["MAX_CONTENT_LENGTH"] = 200 * 1024 * 1024  # 200MB
app.config["UPLOAD_FOLDER"].mkdir(exist_ok=True)

model = None

VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
PERSON_CLASS = {0: "person"}
TRAFFIC_LIGHT_CLASS = {9: "traffic light"}
ALL_CLASSES = {**VEHICLE_CLASSES, **PERSON_CLASS, **TRAFFIC_LIGHT_CLASS}

COLORS = {
    "car": (0, 255, 0),
    "motorcycle": (0, 200, 100),
    "bus": (255, 165, 0),
    "truck": (255, 100, 0),
    "person": (0, 0, 255),
    "traffic light": (0, 255, 255),
    "lane": (255, 200, 0),
}

# ── 차량 추적용 전역 상태 ──
vehicle_tracker = defaultdict(list)  # id -> [(frame_idx, cx, cy), ...]
next_track_id = 0


def get_model():
    global model
    if model is None:
        print("YOLOv8n 모델 로딩 중...")
        local_model = Path(__file__).parent / "yolov8n.pt"
        if local_model.exists():
            model = YOLO(str(local_model))
        else:
            model = YOLO("yolov8n.pt")
    return model


# ═══════════════════════════════════════
# 1. 신호등 색상 판별
# ═══════════════════════════════════════
def detect_traffic_light_color(frame, box):
    """신호등 바운딩 박스 내부의 색상을 HSV로 분석"""
    x1, y1, x2, y2 = [int(v) for v in box]
    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return "unknown"

    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    # 빨강 (HSV에서 빨강은 0~10, 170~180 두 구간)
    red_mask1 = cv2.inRange(hsv, (0, 100, 100), (10, 255, 255))
    red_mask2 = cv2.inRange(hsv, (170, 100, 100), (180, 255, 255))
    red_count = cv2.countNonZero(red_mask1) + cv2.countNonZero(red_mask2)

    # 노랑
    yellow_mask = cv2.inRange(hsv, (15, 100, 100), (35, 255, 255))
    yellow_count = cv2.countNonZero(yellow_mask)

    # 초록
    green_mask = cv2.inRange(hsv, (40, 80, 80), (90, 255, 255))
    green_count = cv2.countNonZero(green_mask)

    total = roi.shape[0] * roi.shape[1]
    threshold = total * 0.03  # 전체의 3% 이상이면 해당 색상으로 판단

    counts = {"red": red_count, "yellow": yellow_count, "green": green_count}
    max_color = max(counts, key=counts.get)

    if counts[max_color] > threshold:
        return max_color
    return "unknown"


# ═══════════════════════════════════════
# 2. 차선 인식
# ═══════════════════════════════════════
def detect_lanes(frame):
    """Canny + HoughLinesP 기반 차선 감지"""
    h, w = frame.shape[:2]
    # 하단 40%만 관심 영역
    roi_y = int(h * 0.6)
    roi = frame[roi_y:h, :]

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blur, 50, 150)

    lines = cv2.HoughLinesP(edges, 1, np.pi / 180, threshold=50,
                            minLineLength=50, maxLineGap=150)

    lane_lines = []
    if lines is not None:
        for line in lines:
            x1, y1, x2, y2 = line[0]
            # 기울기 필터링 (수평에 가까운 선 제거)
            if x2 - x1 == 0:
                continue
            slope = abs((y2 - y1) / (x2 - x1))
            if 0.3 < slope < 5.0:
                # roi 좌표 -> 원본 좌표로 변환
                lane_lines.append((x1, y1 + roi_y, x2, y2 + roi_y))

    return lane_lines


def check_lane_departure(vehicle_box, lane_lines, frame_width):
    """차량이 차선을 벗어났는지 확인"""
    if len(lane_lines) < 2:
        return False

    vx = (vehicle_box[0] + vehicle_box[2]) / 2
    vy = vehicle_box[3]  # 차량 하단

    # 차량 좌우의 가장 가까운 차선 찾기
    left_lanes = [l for l in lane_lines if (l[0] + l[2]) / 2 < vx]
    right_lanes = [l for l in lane_lines if (l[0] + l[2]) / 2 > vx]

    if left_lanes and right_lanes:
        left_x = max((l[0] + l[2]) / 2 for l in left_lanes)
        right_x = min((l[0] + l[2]) / 2 for l in right_lanes)
        lane_width = right_x - left_x

        # 차량이 차선 폭의 90% 이상 차지하면 이탈 의심
        vehicle_width = vehicle_box[2] - vehicle_box[0]
        if vehicle_width > lane_width * 0.9:
            return True

    return False


# ═══════════════════════════════════════
# 3. 차량 추적 / 속도 추정
# ═══════════════════════════════════════
def track_vehicles(detections, frame_idx, fps, prev_positions):
    """간단한 거리 기반 차량 추적 + 속도 추정"""
    global next_track_id

    vehicles = [d for d in detections if d["class"] in VEHICLE_CLASSES.values()]
    current_positions = {}
    tracked = []

    for v in vehicles:
        cx = (v["box"][0] + v["box"][2]) / 2
        cy = (v["box"][1] + v["box"][3]) / 2

        # 이전 프레임에서 가장 가까운 차량 매칭
        best_id = None
        best_dist = 100  # 최대 매칭 거리 (픽셀)

        for tid, (px, py) in prev_positions.items():
            dist = np.sqrt((cx - px) ** 2 + (cy - py) ** 2)
            if dist < best_dist:
                best_dist = dist
                best_id = tid

        if best_id is not None:
            track_id = best_id
            # 속도 = 픽셀 이동 / 프레임 * fps (px/s)
            px, py = prev_positions[track_id]
            pixel_speed = np.sqrt((cx - px) ** 2 + (cy - py) ** 2) * fps
        else:
            track_id = next_track_id
            next_track_id += 1
            pixel_speed = 0

        current_positions[track_id] = (cx, cy)
        tracked.append({
            **v,
            "track_id": track_id,
            "speed_px": round(pixel_speed, 1),
            "center": (cx, cy),
        })

    return tracked, current_positions


# ═══════════════════════════════════════
# 4. 전복 감지
# ═══════════════════════════════════════
def detect_rollover(detections):
    """바운딩 박스의 가로/세로 비율로 전복 추정"""
    rollovers = []
    for d in detections:
        if d["class"] not in VEHICLE_CLASSES.values():
            continue
        x1, y1, x2, y2 = d["box"]
        w = x2 - x1
        h = y2 - y1
        if h == 0:
            continue
        aspect_ratio = w / h

        # 일반 차량: 가로 > 세로 (비율 1.2~3.0)
        # 전복 차량: 세로 > 가로 (비율 < 0.7) 또는 비정상적으로 높음
        if aspect_ratio < 0.7:
            rollovers.append({
                "vehicle": d,
                "aspect_ratio": round(aspect_ratio, 2),
                "type": "possible_rollover",
            })
    return rollovers


# ═══════════════════════════════════════
# 기존 유틸리티
# ═══════════════════════════════════════
def calculate_iou(box1, box2):
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])
    intersection = max(0, x2 - x1) * max(0, y2 - y1)
    area1 = (box1[2] - box1[0]) * (box1[3] - box1[1])
    area2 = (box2[2] - box2[0]) * (box2[3] - box2[1])
    union = area1 + area2 - intersection
    return intersection / union if union > 0 else 0


def detect_collisions(detections, tracked_vehicles=None):
    """충돌 감지: IoU 겹침 + 속도 급변 조합"""
    vehicles = [d for d in detections if d["class"] in VEHICLE_CLASSES.values()]
    collisions = []

    # 속도 정보 매핑 (tracked_vehicles에서)
    speed_map = {}
    if tracked_vehicles:
        for tv in tracked_vehicles:
            tid = tv.get("track_id", -1)
            speed_map[tid] = tv.get("speed_px", 0)

    for i in range(len(vehicles)):
        for j in range(i + 1, len(vehicles)):
            iou = calculate_iou(vehicles[i]["box"], vehicles[j]["box"])
            cx1 = (vehicles[i]["box"][0] + vehicles[i]["box"][2]) / 2
            cy1 = (vehicles[i]["box"][1] + vehicles[i]["box"][3]) / 2
            cx2 = (vehicles[j]["box"][0] + vehicles[j]["box"][2]) / 2
            cy2 = (vehicles[j]["box"][1] + vehicles[j]["box"][3]) / 2
            dist = np.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2)

            # 강한 겹침 = 확실한 충돌
            if iou > 0.2:
                collisions.append({
                    "vehicle1": vehicles[i], "vehicle2": vehicles[j],
                    "iou": round(iou, 3), "distance": round(dist, 1),
                })
            # 약한 겹침 + 급감속 = 충돌
            elif iou > 0.05 and dist < 60:
                tid1 = vehicles[i].get("track_id", -1)
                tid2 = vehicles[j].get("track_id", -1)
                s1 = speed_map.get(tid1, 0)
                s2 = speed_map.get(tid2, 0)
                # 둘 중 하나라도 급감속 (이전 속도 대비 낮아졌거나 거의 정지)
                if s1 < 5 or s2 < 5:
                    collisions.append({
                        "vehicle1": vehicles[i], "vehicle2": vehicles[j],
                        "iou": round(iou, 3), "distance": round(dist, 1),
                    })
    return collisions


def frame_to_base64_jpg(frame):
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


# ═══════════════════════════════════════
# 시각화 (모든 기능 통합)
# ═══════════════════════════════════════
LIGHT_COLORS = {
    "red": (0, 0, 255),
    "yellow": (0, 255, 255),
    "green": (0, 255, 0),
    "unknown": (128, 128, 128),
}


def draw_all(frame, detections, collisions, traffic_lights, lane_lines,
             tracked_vehicles, rollovers, lane_departures):
    """모든 감지 결과를 프레임에 시각화"""

    # 1) 차선 그리기
    for lx1, ly1, lx2, ly2 in lane_lines:
        cv2.line(frame, (lx1, ly1), (lx2, ly2), COLORS["lane"], 2)

    # 2) 일반 감지 박스
    for det in detections:
        x1, y1, x2, y2 = [int(v) for v in det["box"]]
        cls = det["class"]
        conf = det["confidence"]
        color = COLORS.get(cls, (255, 255, 255))

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        label = f"{cls} {conf:.0%}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)

    # 3) 신호등 색상 표시
    for tl in traffic_lights:
        x1, y1, x2, y2 = [int(v) for v in tl["box"]]
        color_name = tl["light_color"]
        color = LIGHT_COLORS.get(color_name, (128, 128, 128))
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 3)

        label_map = {"red": "RED", "yellow": "YELLOW", "green": "GREEN", "unknown": "?"}
        label = label_map.get(color_name, "?")
        cv2.putText(frame, label, (x1, y2 + 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)

    # 4) 추적 ID + 속도 표시
    for tv in tracked_vehicles:
        cx, cy = int(tv["center"][0]), int(tv["center"][1])
        speed = tv["speed_px"]
        label = f"ID:{tv['track_id']}"
        if speed > 0:
            label += f" {speed:.0f}px/s"
        cv2.putText(frame, label, (cx - 30, cy - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 0), 2)

    # 5) 전복 경고
    for ro in rollovers:
        v = ro["vehicle"]
        x1, y1, x2, y2 = [int(val) for val in v["box"]]
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
        cv2.putText(frame, "ROLLOVER!", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3)

    # 6) 차선 이탈 경고
    for ld in lane_departures:
        x1, y1, x2, y2 = [int(val) for val in ld["box"]]
        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 165, 255), 3)
        cv2.putText(frame, "LANE DEPARTURE!", (x1, y1 - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 165, 255), 2)

    # 7) 충돌 경고
    for col in collisions:
        v1, v2 = col["vehicle1"], col["vehicle2"]
        cx1 = int((v1["box"][0] + v1["box"][2]) / 2)
        cy1 = int((v1["box"][1] + v1["box"][3]) / 2)
        cx2 = int((v2["box"][0] + v2["box"][2]) / 2)
        cy2 = int((v2["box"][1] + v2["box"][3]) / 2)
        cv2.line(frame, (cx1, cy1), (cx2, cy2), (0, 0, 255), 3)
        mx, my = (cx1 + cx2) // 2, (cy1 + cy2) // 2
        cv2.putText(frame, "COLLISION!", (mx - 50, my - 10),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

    # 상단 정보 바
    v_count = sum(1 for d in detections if d["class"] in VEHICLE_CLASSES.values())
    p_count = sum(1 for d in detections if d["class"] == "person")
    info = (f"Vehicles: {v_count} | Persons: {p_count} | "
            f"Collisions: {len(collisions)} | Lanes: {len(lane_lines)} | "
            f"Rollovers: {len(rollovers)}")
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 35), (0, 0, 0), -1)
    cv2.putText(frame, info, (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    return frame


# ═══════════════════════════════════════
# 통합 분석 함수
# ═══════════════════════════════════════
def analyze_frame(frame, confidence=0.4, frame_idx=0, fps=30, prev_positions=None):
    if prev_positions is None:
        prev_positions = {}

    m = get_model()
    # ByteTrack 추적: 차량 ID 자동 부여, 가림 후 재등장 시에도 ID 유지
    results = m.track(frame, conf=confidence, persist=True,
                      tracker="bytetrack.yaml", verbose=False)

    detections = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            if cls_id in ALL_CLASSES:
                det = {
                    "class": ALL_CLASSES[cls_id],
                    "confidence": round(float(box.conf[0]), 3),
                    "box": box.xyxy[0].cpu().numpy().tolist(),
                }
                # ByteTrack 추적 ID
                if box.id is not None:
                    det["track_id"] = int(box.id[0])
                detections.append(det)

    # 신호등 색상 판별
    traffic_lights = []
    for d in detections:
        if d["class"] == "traffic light":
            color = detect_traffic_light_color(frame, d["box"])
            traffic_lights.append({**d, "light_color": color})

    # 차선 인식
    lane_lines = detect_lanes(frame)

    # 차량 추적 + 속도 (ByteTrack ID 활용) — 충돌 감지보다 먼저 실행
    tracked_vehicles = []
    new_positions = {}
    for d in detections:
        if d["class"] not in VEHICLE_CLASSES.values():
            continue
        tid = d.get("track_id", -1)
        cx = (d["box"][0] + d["box"][2]) / 2
        cy = (d["box"][1] + d["box"][3]) / 2
        speed = 0
        if tid in prev_positions:
            px, py = prev_positions[tid]
            speed = np.sqrt((cx - px) ** 2 + (cy - py) ** 2) * fps
        new_positions[tid] = (cx, cy)
        tracked_vehicles.append({
            **d, "track_id": tid, "speed_px": round(speed, 1), "center": (cx, cy),
        })

    # 충돌 감지 (속도 급변 포함)
    collisions = detect_collisions(detections, tracked_vehicles)

    # 전복 감지
    rollovers = detect_rollover(detections)

    # 차선 이탈 감지
    lane_departures = []
    for d in detections:
        if d["class"] in VEHICLE_CLASSES.values():
            if check_lane_departure(d["box"], lane_lines, frame.shape[1]):
                lane_departures.append(d)

    # 시각화
    annotated = draw_all(frame.copy(), detections, collisions, traffic_lights,
                         lane_lines, tracked_vehicles, rollovers, lane_departures)
    result_b64 = frame_to_base64_jpg(annotated)

    return {
        "detections": detections,
        "collisions": collisions,
        "traffic_lights": [{"color": tl["light_color"], "confidence": tl["confidence"]}
                           for tl in traffic_lights],
        "lane_count": len(lane_lines),
        "tracked_vehicles": [{"id": tv["track_id"], "class": tv["class"],
                              "speed_px": tv["speed_px"]} for tv in tracked_vehicles],
        "rollovers": [{"class": ro["vehicle"]["class"],
                       "aspect_ratio": ro["aspect_ratio"]} for ro in rollovers],
        "lane_departures": len(lane_departures),
        "result_image": result_b64,
        "vehicle_count": sum(1 for d in detections if d["class"] in VEHICLE_CLASSES.values()),
        "person_count": sum(1 for d in detections if d["class"] == "person"),
        "collision_count": len(collisions),
        "rollover_count": len(rollovers),
        "new_positions": new_positions,
    }


# ═══════════════════════════════════════
# 2D 재현도 데이터 생성
# ═══════════════════════════════════════
VEHICLE_COLORS = {
    "car": "#3182F6", "truck": "#F97316", "bus": "#8B5CF6",
    "motorcycle": "#F04452", "person": "#10B981",
}


def build_scene_data(frame, detections, collisions):
    """YOLO 감지 결과를 2D 재현도용 JSON으로 변환"""
    h, w = frame.shape[:2]
    scale_x = 400 / w
    scale_y = 400 / h

    vehicles = []
    labels = iter("ABCDEFGHIJKLMNOP")
    for d in detections:
        if d["class"] not in {**VEHICLE_CLASSES, **PERSON_CLASS}.values():
            continue
        x1, y1, x2, y2 = d["box"]
        cx = (x1 + x2) / 2 * scale_x
        cy = (y1 + y2) / 2 * scale_y
        bw = (x2 - x1) * scale_x
        bh = (y2 - y1) * scale_y
        # 차량 방향 추정 (바운딩 박스 비율)
        angle = 0 if bw > bh else 90
        vehicles.append({
            "type": d["class"],
            "label": next(labels, ""),
            "x": round(cx),
            "y": round(cy),
            "angle": angle,
            "color": VEHICLE_COLORS.get(d["class"], "#3182F6"),
        })

    collision_point = None
    if collisions:
        c = collisions[0]
        v1, v2 = c["vehicle1"], c["vehicle2"]
        cx = ((v1["box"][0] + v1["box"][2]) / 2 + (v2["box"][0] + v2["box"][2]) / 2) / 2
        cy = ((v1["box"][1] + v1["box"][3]) / 2 + (v2["box"][1] + v2["box"][3]) / 2) / 2
        collision_point = {"x": round(cx * scale_x), "y": round(cy * scale_y)}

    return {
        "road": {"type": "straight", "lanes": 2},
        "vehicles": vehicles,
        "collision": collision_point,
        "arrows": [],
    }


# ═══════════════════════════════════════
# AI 통합 분석
# ═══════════════════════════════════════
SYSTEM_PROMPT = """당신은 교통사고 분석 전문가이자 법률 해설가입니다.
사용자의 사고 상황을 분석하여 아래 JSON 형식으로만 응답하세요. JSON 외 텍스트는 절대 포함하지 마세요.

{
  "summary": "사고 개요를 2~4문장으로 명료하게 정리.",
  "chartCode": "가장 유사한 손보협 도표번호 (아래 목록에서 선택)",
  "chartName": "해당 도표의 사고 유형명",
  "ratio": {
    "a": { "label": "A의 정의", "percent": 70 },
    "b": { "label": "B의 정의", "percent": 30 },
    "reason": "이 비율의 핵심 근거 2~3문장"
  },
  "laws": [
    { "name": "도로교통법 제XX조(조항명)", "content": "조문 요약", "relevance": "관련성", "effect": "법적 효과" }
  ],
  "cases": [
    { "title": "사례 제목", "facts": "사실관계", "ruling": "과실비율", "reason": "판단 근거" }
  ],
  "notes": ["참고사항"],
  "needed": ["필요한 정보"]
}

## 손보협 도표번호 목록 (chartCode에 사용)
- 차1-1: 신호 교차로 직진 vs 직진 (쌍방 신호)
- 차1-2: 신호 교차로 직진 vs 직진 (일방 신호위반)
- 차2-1: 신호 교차로 직진 vs 우회전
- 차2-2: 신호 교차로 우회전 vs 직진
- 차3-1: 신호 교차로 직진 vs 좌회전 (좌회전 신호)
- 차3-2: 신호 교차로 직진 vs 좌회전 (비보호)
- 차4-1: 신호 교차로 좌회전 vs 좌회전
- 차4-2: 신호 교차로 좌회전 vs 유턴
- 차5-1: 교차로 우회전 vs 직진 (보행자 포함)
- 차10-1: 비신호 교차로 직진 vs 직진
- 차11-1: 비신호 교차로 직진 vs 우회전
- 차11-2: 비신호 교차로 우회전 vs 직진
- 차12-1: 비신호 교차로 직진 vs 좌회전 (A좌회전)
- 차13-1: 비신호 교차로 직진 vs 좌회전 (B좌회전)
- 차14-1: 비신호 교차로 우회전 vs 직진
- 차15-1: T자 교차로 직진 vs 진입
- 차16-1: 교차로 직진 vs 좌회전 (비보호)
- 차16-2: 교차로 직진 vs 좌회전 (좌회전 신호)
- 차17-1: 교차로 유턴 vs 직진
- 차20-1: 대향 직진 vs 중앙선 침범
- 차21-1: 동일 방향 차선변경 (동일 차선 내)
- 차31-1: 교행 중 충돌
- 차31-2: 교행 중 충돌 (좁은 도로)
- 차41-1: 직선도로 추돌 (후방 추돌)
- 차42-1: 주정차 차량 추돌
- 차42-2: 갓길 주정차 추돌
- 차42-3: 주정차 후 문 열기
- 차43-1: 동일 방향 진행 중 차선변경 충돌
- 차43-2: 후행 직진 vs 선행 진로변경
- 차43-3: 동시 차선변경
- 차43-4: 끼어들기
- 차44-1: 고속도로 추돌
- 차51-1: 주차장 통로 vs 출차
- 차51-2: 주차장 내 후진 충돌

규칙:
- chartCode는 반드시 위 목록에서 가장 유사한 것을 선택. 정확히 일치하지 않아도 가장 가까운 것 선택.
- 모든 답변은 실제 도로교통법과 판례 기반. 허위 조항 금지.
- laws는 2~5개, cases는 1~3개.
- 정보가 부족해도 가능한 범위에서 분석 먼저 시도.
- ratio.a.percent + ratio.b.percent = 100.
- 이미지가 주어진 경우 이미지에서 관찰한 내용도 분석에 포함.
- 한국어. 정중하고 논리적인 전문가 어투."""


def run_unified_analysis(frame, yolo_result, user_description=""):
    """이미지 + YOLO 결과 + 사용자 설명 → 한번에 종합 분석"""
    if not HAS_CLAUDE:
        return "Anthropic API 키가 설정되지 않아 AI 분석을 수행할 수 없습니다."

    # 이미지 준비
    h, w = frame.shape[:2]
    scale = min(800 / w, 800 / h, 1.0)
    resized = frame if scale >= 1.0 else cv2.resize(frame, (int(w * scale), int(h * scale)))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    image_b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")

    # YOLO 결과 요약
    det_lines = []
    for i, d in enumerate(yolo_result["detections"]):
        det_lines.append(f"  {i+1}. {d['class']} (신뢰도 {d['confidence']:.0%})")

    yolo_summary = f"""YOLO 객체감지 결과:
{chr(10).join(det_lines) if det_lines else '  감지된 객체 없음'}

추가 분석:
- 충돌 감지: {yolo_result['collision_count']}건
- 차선 감지: {yolo_result['lane_count']}개
- 전복 의심: {yolo_result['rollover_count']}건
- 차선 이탈: {yolo_result['lane_departures']}건"""

    if yolo_result["traffic_lights"]:
        colors = [tl["color"] for tl in yolo_result["traffic_lights"]]
        yolo_summary += f"\n- 신호등: {', '.join(colors)}"

    user_part = ""
    if user_description.strip():
        user_part = f"\n\n사용자의 사고 상황 설명:\n{user_description.strip()}"

    prompt = f"""{yolo_summary}{user_part}

위 정보와 이미지를 종합하여 사고를 분석해주세요."""

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return response.content[0].text
    except Exception as e:
        return f"AI 분석 중 오류: {str(e)}"


def _read_frame_from_file(file_bytes, filename):
    """파일 바이트에서 프레임 읽기 (이미지 또는 영상 첫 프레임)"""
    nparr = np.frombuffer(file_bytes, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if frame is not None:
        return frame, "image"
    # 영상 시도
    filepath = app.config["UPLOAD_FOLDER"] / f"{uuid.uuid4().hex}_{secure_filename(filename)}"
    filepath.write_bytes(file_bytes)
    cap = cv2.VideoCapture(str(filepath))
    ret, frame = cap.read()
    cap.release()
    filepath.unlink(missing_ok=True)
    if ret and frame is not None:
        return frame, "video"
    return None, None


def build_ai_correction_prompt(yolo_result):
    """YOLO 결과를 기반으로 AI 검증 프롬프트 생성"""
    indexed = []
    for i, d in enumerate(yolo_result["detections"]):
        indexed.append({
            "index": i,
            "class": d["class"],
            "confidence": d["confidence"],
            "box": [round(v) for v in d["box"]],
        })

    tl_info = ""
    if yolo_result["traffic_lights"]:
        tl_info = f"\n신호등 감지: {json.dumps(yolo_result['traffic_lights'], ensure_ascii=False)}"

    return f"""당신은 교통사고 분석 전문 AI입니다. 블랙박스/CCTV 이미지와 함께 YOLO 객체감지 결과가 주어집니다.
YOLO는 틀릴 수 있습니다. 이미지를 직접 보고 YOLO 결과를 검증하고 수정해주세요.

## YOLO 감지 결과 (index로 참조)
{json.dumps(indexed, indent=2, ensure_ascii=False)}

## YOLO 추가 분석
- 충돌 감지: {yolo_result['collision_count']}건
- 차선 감지: {yolo_result['lane_count']}개
- 전복 의심: {yolo_result['rollover_count']}건
- 차선 이탈: {yolo_result['lane_departures']}건{tl_info}

## 요청사항
아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 포함하지 마세요.

{{
  "corrections": [
    {{
      "action": "reclassify | remove | add",
      "yolo_index": 0,
      "original_class": "car",
      "corrected_class": "truck",
      "reason": "수정 이유"
    }}
  ],
  "scene_analysis": {{
    "road_type": "도로 유형",
    "weather": "날씨/시간대",
    "accident_type": "사고 유형 (없으면 null)",
    "fault_analysis": "과실 분석 (사고가 있는 경우)",
    "fault_ratio": "과실 비율 (예: A 70% / B 30%)",
    "severity": "경미 | 보통 | 심각 | 사고없음"
  }},
  "narrative": "한국어로 상세하게 작성한 종합 분석 (현재 상황, 사고 여부, 과실, 심각도, 추가 관찰)"
}}

주의사항:
- corrections가 없으면 빈 배열 []로 두세요
- action이 "add"일 때 yolo_index는 null, original_class도 null
- action이 "remove"일 때 corrected_class는 null
- YOLO가 맞으면 굳이 수정하지 마세요. 확신이 있을 때만 수정하세요
- narrative는 반드시 한국어로 작성하세요"""


def parse_ai_response(text):
    """Claude 응답에서 JSON 파싱"""
    # 직접 JSON 파싱 시도
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # ```json ... ``` 블록 추출
    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # { ... } 블록 추출
    match = re.search(r'\{.*\}', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass

    # 파싱 실패 → fallback
    return {
        "corrections": [],
        "scene_analysis": {
            "road_type": "분석 불가",
            "weather": "분석 불가",
            "accident_type": None,
            "fault_analysis": "",
            "fault_ratio": "",
            "severity": "분석 불가",
        },
        "narrative": text,
    }


def apply_corrections(yolo_result, ai_response):
    """AI 수정 사항을 YOLO 결과에 적용하여 보정된 detection 리스트 생성"""
    original = yolo_result["detections"]
    corrections = ai_response.get("corrections", [])

    # 인덱스별 수정 맵
    remove_indices = set()
    reclassify_map = {}
    additions = []

    for c in corrections:
        action = c.get("action")
        idx = c.get("yolo_index")
        if action == "remove" and idx is not None:
            remove_indices.add(idx)
        elif action == "reclassify" and idx is not None:
            reclassify_map[idx] = c
        elif action == "add":
            additions.append(c)

    corrected = []
    for i, det in enumerate(original):
        if i in remove_indices:
            continue
        entry = {**det, "source": "yolo"}
        if i in reclassify_map:
            entry["original_class"] = det["class"]
            entry["class"] = reclassify_map[i].get("corrected_class", det["class"])
            entry["source"] = "ai_corrected"
            entry["reason"] = reclassify_map[i].get("reason", "")
        corrected.append(entry)

    for a in additions:
        corrected.append({
            "class": a.get("corrected_class", "unknown"),
            "confidence": 0,
            "box": a.get("box", [0, 0, 0, 0]),
            "source": "ai_added",
            "reason": a.get("reason", ""),
        })

    return corrected


def draw_corrected(frame, corrected_detections):
    """AI 보정된 detection을 프레임에 시각화"""
    SOURCE_COLORS = {
        "yolo": (0, 255, 0),
        "ai_corrected": (0, 165, 255),  # 주황
        "ai_added": (255, 200, 0),       # 청록
    }

    for det in corrected_detections:
        x1, y1, x2, y2 = [int(v) for v in det["box"]]
        source = det.get("source", "yolo")
        color = SOURCE_COLORS.get(source, (255, 255, 255))

        thickness = 3 if source != "yolo" else 2
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        label = f"{det['class']}"
        if det["confidence"] > 0:
            label += f" {det['confidence']:.0%}"
        if source == "ai_corrected":
            label = f"[AI] {label}"
        elif source == "ai_added":
            label = f"[AI+] {label}"

        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 1)
        cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), color, -1)
        cv2.putText(frame, label, (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 1)

    # 상단 정보
    v_count = sum(1 for d in corrected_detections
                  if d["class"] in VEHICLE_CLASSES.values())
    ai_count = sum(1 for d in corrected_detections if d.get("source") != "yolo")
    info = f"Vehicles: {v_count} | AI Corrections: {ai_count}"
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 35), (0, 0, 0), -1)
    cv2.putText(frame, info, (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

    return frame


def run_ai_verification(frame, yolo_result):
    """YOLO 결과를 Claude AI로 검증하고 수정"""
    if not HAS_CLAUDE:
        return {
            "corrections": [],
            "scene_analysis": {
                "road_type": "", "weather": "", "accident_type": None,
                "fault_analysis": "", "fault_ratio": "", "severity": "",
            },
            "narrative": "Anthropic API 키가 설정되지 않아 AI 분석을 수행할 수 없습니다.",
        }

    # 이미지 준비
    h, w = frame.shape[:2]
    scale = min(800 / w, 800 / h, 1.0)
    resized = frame
    if scale < 1.0:
        resized = cv2.resize(frame, (int(w * scale), int(h * scale)))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(rgb)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    image_b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")

    prompt = build_ai_correction_prompt(yolo_result)

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/jpeg",
                            "data": image_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }],
        )
        return parse_ai_response(response.content[0].text)
    except Exception as e:
        return {
            "corrections": [],
            "scene_analysis": {
                "road_type": "", "weather": "", "accident_type": None,
                "fault_analysis": "", "fault_ratio": "", "severity": "",
            },
            "narrative": f"AI 분석 중 오류: {str(e)}",
        }


FAULT_SYSTEM_PROMPT = """당신은 **교통사고 분석 전문가이자 법률 해설가**입니다.
AI 영상 분석 결과가 주어집니다. 이 결과를 바탕으로 도로교통법 조항과 유사 판례를 참고하여 과실비율을 분석하세요.

## 답변 형식
1. **📝 사고 요약** - AI 분석 결과를 바탕으로 사고 개요 정리
2. **⚖️ 예상 과실 판단 요약** - A와 B 정의, 과실비율 (예: A:B = 30:70)
3. **📚 적용된 법규** (2~5개) - 조항 제목, 조문 요약, 관련성, 위반 시 효과
4. **🔍 참고된 유사 판례** - 판례 요약, 유사점/차이점
5. **📌 참고 및 주의사항**
6. **⚠️ 추가 분석을 위해 필요한 정보**

## 원칙
- 실제 도로교통법과 판례 기반. 허구의 조문 금지.
- 정보가 불완전해도 가능한 범위에서 분석 먼저 시도.
- "일반적으로는", "대법원 판례에 따르면" 등 표현 사용.
- 한국어로 상세하게 작성."""


def run_fault_analysis(ai_response):
    """AI 장면 분석 결과를 바탕으로 과실비율 분석"""
    if not HAS_CLAUDE:
        return "Anthropic API 키가 설정되지 않아 과실비율 분석을 수행할 수 없습니다."

    scene = ai_response.get("scene_analysis", {})
    narrative = ai_response.get("narrative", "")
    corrections = ai_response.get("corrections", [])

    # 장면 분석 정보를 텍스트로 조합
    context_parts = []
    if narrative:
        context_parts.append(f"AI 영상 종합 분석:\n{narrative}")
    if scene:
        context_parts.append(f"\n장면 정보:")
        if scene.get("road_type"):
            context_parts.append(f"- 도로: {scene['road_type']}")
        if scene.get("weather"):
            context_parts.append(f"- 날씨/시간: {scene['weather']}")
        if scene.get("accident_type"):
            context_parts.append(f"- 사고 유형: {scene['accident_type']}")
        if scene.get("severity"):
            context_parts.append(f"- 심각도: {scene['severity']}")
        if scene.get("fault_analysis"):
            context_parts.append(f"- 초기 과실 판단: {scene['fault_analysis']}")
        if scene.get("fault_ratio"):
            context_parts.append(f"- 초기 과실 비율: {scene['fault_ratio']}")
    if corrections:
        context_parts.append(f"\nAI가 수정한 감지 사항: {len(corrections)}건")
        for c in corrections:
            context_parts.append(f"- {c.get('action')}: {c.get('reason', '')}")

    context = "\n".join(context_parts)
    if not context.strip():
        return "분석 데이터가 부족하여 과실비율을 산출할 수 없습니다."

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=FAULT_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"다음 AI 영상 분석 결과를 바탕으로 과실비율을 분석해주세요:\n\n{context}",
            }],
        )
        return response.content[0].text
    except Exception as e:
        return f"과실비율 분석 중 오류: {str(e)}"


def select_key_frames(frames_analysis, max_frames=3):
    """AI 검증할 핵심 프레임 선택 (충돌 프레임 우선)"""
    if not frames_analysis:
        return []

    scored = []
    for i, f in enumerate(frames_analysis):
        score = 0
        score += f["collision_count"] * 10
        score += f["rollover_count"] * 8
        score += f["vehicle_count"]
        if i == 0:
            score += 3  # 첫 프레임
        if i == len(frames_analysis) - 1:
            score += 2  # 마지막 프레임
        scored.append((score, i))

    scored.sort(reverse=True)
    selected = sorted([idx for _, idx in scored[:max_frames]])
    return selected


# ═══════════════════════════════════════
# 라우트
# ═══════════════════════════════════════
@app.route("/api/analyze", methods=["POST"])
def analyze():
    """통합 분석: 상세모드(파일+YOLO+AI) 또는 기본모드(텍스트만+AI)"""
    user_description = request.form.get("description", "")
    detailed = request.form.get("detailed", "false") == "true"

    # ── 상세 분석 모드: 파일 + YOLO + AI ──
    if detailed:
        if "file" not in request.files or request.files["file"].filename == "":
            return jsonify({"error": "상세 분석 모드에서는 영상/이미지가 필요합니다"}), 400

        file = request.files["file"]
        confidence = float(request.form.get("confidence", 0.4))
        file_bytes = file.read()

        # 이미지인지 영상인지 판별
        nparr = np.frombuffer(file_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is not None:
            # ── 이미지: 단일 프레임 분석 ──
            yolo_result = analyze_frame(frame, confidence)
            yolo_result.pop("new_positions", None)
            ai_scenario = run_unified_analysis(frame, yolo_result, user_description)

            thumbnail_b64 = frame_to_base64_jpg(frame)
            scene = build_scene_data(frame, yolo_result["detections"], yolo_result["collisions"])
            single_frame = {
                "result_image": yolo_result["result_image"],
                "time": 0,
                "vehicle_count": yolo_result.get("vehicle_count", 0),
                "person_count": yolo_result.get("person_count", 0),
                "collision_count": yolo_result.get("collision_count", 0),
                "lane_count": yolo_result.get("lane_count", 0),
                "rollover_count": 0,
            }
            return jsonify({
                "mode": "detailed",
                "result_image": yolo_result["result_image"],
                "thumbnail": thumbnail_b64,
                "scene": scene,
                "vehicle_count": yolo_result.get("vehicle_count", 0),
                "person_count": yolo_result.get("person_count", 0),
                "collision_count": yolo_result.get("collision_count", 0),
                "lane_count": yolo_result.get("lane_count", 0),
                "scenario": ai_scenario,
                "frames": [single_frame],
                "key_frame_index": 0,
            })

        # ── 영상: 1초 간격 샘플링 → 핵심 프레임 AI 분석 ──
        filename = f"{uuid.uuid4().hex}_{secure_filename(file.filename)}"
        filepath = app.config["UPLOAD_FOLDER"] / filename
        filepath.write_bytes(file_bytes)

        cap = cv2.VideoCapture(str(filepath))
        if not cap.isOpened():
            filepath.unlink(missing_ok=True)
            return jsonify({"error": "영상을 열 수 없습니다"}), 400

        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        sample_interval = max(1, fps * 2)  # 2초 간격

        # 1) 전체 샘플 프레임 YOLO 분석
        frames_data = []
        raw_frames = {}
        frame_idx = 0
        prev_positions = {}

        while True:
            ret, vframe = cap.read()
            if not ret:
                break
            if frame_idx % sample_interval == 0:
                result = analyze_frame(vframe, confidence, frame_idx, fps, prev_positions)
                prev_positions = result.pop("new_positions", {})
                result["frame"] = frame_idx
                result["time"] = round(frame_idx / fps, 1)
                frames_data.append(result)
                raw_frames[len(frames_data) - 1] = vframe.copy()
            frame_idx += 1

        cap.release()
        filepath.unlink(missing_ok=True)

        if not frames_data:
            return jsonify({"error": "영상에서 프레임을 추출할 수 없습니다"}), 400

        # 2) 핵심 프레임 선택: 충돌 시작 + 시간적 일관성
        # 연속 2프레임 이상 충돌이 감지된 구간의 시작점 = 진짜 사고 순간
        collision_run_start = None
        key_idx = 0

        for i, f in enumerate(frames_data):
            if f["collision_count"] > 0:
                if collision_run_start is None:
                    collision_run_start = i
                # 연속 2프레임 이상 충돌 → 확정
                if i - collision_run_start >= 1:
                    key_idx = collision_run_start
                    break
            else:
                collision_run_start = None

        # 연속 충돌 없으면 점수 기반 fallback
        if collision_run_start is None or key_idx == 0:
            best_score = -1
            for i, f in enumerate(frames_data):
                score = 0
                prev = frames_data[i - 1] if i > 0 else None
                if f["collision_count"] > 0:
                    score += 50 if (prev is None or prev["collision_count"] == 0) else f["collision_count"] * 5
                if f["rollover_count"] > 0:
                    score += 30
                if prev:
                    score += abs(f["vehicle_count"] - prev["vehicle_count"]) * 8
                score += f["vehicle_count"]
                if score > best_score:
                    best_score = score
                    key_idx = i

        best_frame = raw_frames[key_idx]
        best_result = frames_data[key_idx]

        # 원본 프레임 (어노테이션 없는 깔끔한 썸네일)
        thumbnail_b64 = frame_to_base64_jpg(best_frame)
        scene = build_scene_data(best_frame, best_result["detections"], best_result["collisions"])

        # 3) 핵심 프레임으로 AI 종합 분석
        ai_scenario = run_unified_analysis(best_frame, best_result, user_description)

        # 4) 모든 프레임 데이터 구성 (슬라이드쇼용, 최대 20프레임)
        all_frames = []
        for i, f in enumerate(frames_data[:20]):
            all_frames.append({
                "result_image": f["result_image"],
                "time": f["time"],
                "vehicle_count": f.get("vehicle_count", 0),
                "person_count": f.get("person_count", 0),
                "collision_count": f.get("collision_count", 0),
                "lane_count": f.get("lane_count", 0),
                "rollover_count": f.get("rollover_count", 0),
            })

        return jsonify({
            "mode": "detailed",
            "result_image": best_result["result_image"],
            "thumbnail": thumbnail_b64,
            "scene": scene,
            "vehicle_count": best_result.get("vehicle_count", 0),
            "person_count": best_result.get("person_count", 0),
            "collision_count": best_result.get("collision_count", 0),
            "lane_count": best_result.get("lane_count", 0),
            "duration": round(total_frames / fps, 1),
            "analyzed_frames": len(frames_data),
            "key_frame_time": best_result["time"],
            "key_frame_index": min(key_idx, 19),
            "scenario": ai_scenario,
            "frames": all_frames,
        })

    # ── 기본 모드: 텍스트만 + AI ──
    if not user_description.strip():
        return jsonify({"error": "사고 상황을 입력해주세요"}), 400

    if not HAS_CLAUDE:
        return jsonify({"error": "AI 서비스를 사용할 수 없습니다"}), 400

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"다음 교통사고 상황을 분석하여 과실비율을 예측해주세요:\n\n{user_description}",
            }],
        )
        return jsonify({
            "mode": "basic",
            "scenario": response.content[0].text,
        })
    except Exception as e:
        return jsonify({"error": f"분석 중 오류: {str(e)}"}), 500


@app.route("/api/health")
def health():
    return jsonify({"status": "ok", "has_claude": HAS_CLAUDE})


if __name__ == "__main__":
    get_model()
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
