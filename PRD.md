# PRD: WhoseFault AI — 교통사고 과실비율 분석 서비스

> 최종 업데이트: 2026-04-07
> 배포 URL: https://whosefault-ai.vercel.app

---

## 1. 제품 개요

| 항목 | 내용 |
|------|------|
| 제품명 | WhoseFault AI |
| 한 줄 요약 | 사고 상황 입력 또는 블랙박스 영상 업로드로 AI가 즉시 과실비율을 분석하는 무료 웹 서비스 |
| 타겟 사용자 | 교통사고 당사자, 보험 합의 전 참고용, 운전 학습자 |
| 핵심 가치 | 무료, 회원가입 없음, 즉시 분석, 법규/판례 기반 |

## 2. 문제 정의

- 교통사고 발생 시 과실비율을 즉시 파악하기 어려움
- 보험사 산정까지 자신의 과실 정도를 알 수 없음
- 전문 법률 상담은 비용과 시간이 소요됨
- 손해보험협회 과실비율 인정기준은 일반인이 해석하기 어려움

## 3. 핵심 기능

### 3.1 텍스트 기반 사고 분석

**입력 방식**
- 7단계 마법사: 도로유형 → 신호 → 차량종류 → 진행방향 → 상대차량 → 상대 진행 → 충돌부위 → 추가정보
- 자유 텍스트 입력
- 사고 유형 템플릿 선택

**분석 파이프라인**
```
사용자 입력 → OpenAI 임베딩 생성 → Supabase 벡터 검색 (유사 판례 3건)
→ Claude Haiku 4.5에 사고 설명 + 판례 전달 → JSON 분석 결과 반환
→ 과실비율 카드 + 캐러셀 (요약/법규/판례/참고사항) 시각화
```

**출력 항목**
- 예상 과실비율 (A:B)
- 손보협 도표번호 매칭
- 사고 요약
- 적용 법규 (도로교통법)
- 유사 판례
- 참고사항

### 3.2 영상 기반 정밀 분석

**입력**: 블랙박스 영상 (MP4/AVI/MOV, 최대 200MB, 40초 이하)

**분석 파이프라인**
```
영상 업로드 → Flask API
→ 1초 간격 프레임 샘플링
→ YOLOv8 객체 감지 (차량, 보행자, 신호등)
→ ByteTrack 차량 추적
→ 충돌 감지 (IoU + 속도 급변)
→ 신호등 색상 판별 (HSV)
→ 차선 감지 (Canny + HoughLines)
→ 전복/차선이탈 감지
→ 핵심 프레임 자동 선택
→ Claude Vision 종합 분석
→ 결과 반환 (프레임 + 감지 통계 + 과실비율)
```

### 3.3 커뮤니티

- 분석 결과 익명 공유
- AI 사고 썸네일 자동 생성 (DALL-E 3)
- 댓글 기능 (카드형 디자인)
- 영상 게시물 배지 표시
- 페이지네이션 피드

### 3.4 공유 & SNS

- URL 기반 결과 공유 (base64 인코딩)
- 결과 카드 이미지 저장 (html2canvas)
- OG 메타태그 (카카오톡, 트위터 미리보기)

## 4. 기술 아키텍처

### 4.1 시스템 구성도

```
[사용자 브라우저]
       │
┌──────┴──────────────────────┐
│  Vercel (프론트 + Serverless) │
│  ├─ React SPA               │
│  ├─ /api/chat → Claude API  │
│  ├─ /api/embedding → OpenAI │
│  └─ /api/generate-image     │
│         → DALL-E 3           │
└──────┬──────────────────────┘
       │
┌──────┴──────────────────────┐
│  Railway (Flask 백엔드)       │
│  ├─ /api/analyze            │
│  ├─ YOLOv8 + ByteTrack     │
│  └─ Claude Vision API      │
└──────┬──────────────────────┘
       │
┌──────┴──────────────────────┐
│  Supabase                    │
│  ├─ posts (커뮤니티)          │
│  ├─ comments (댓글)          │
│  ├─ documents (판례 임베딩)    │
│  │   └─ 1,205건 벡터 데이터   │
│  ├─ match_documents RPC     │
│  ├─ match_laws RPC          │
│  └─ community-media 버킷    │
└─────────────────────────────┘
```

### 4.2 기술 스택

| 계층 | 기술 |
|------|------|
| 프론트엔드 | React 18, TypeScript, Vite 5, Tailwind CSS 3 |
| 서버리스 API | Vercel Functions (Node.js) |
| 백엔드 | Flask, OpenCV, Ultralytics |
| AI 분석 | Claude Haiku 4.5 (텍스트), Claude Sonnet (Vision) |
| 객체 감지 | YOLOv8 + ByteTrack |
| 이미지 생성 | DALL-E 3 |
| 임베딩 | OpenAI text-embedding-3-small |
| 벡터 DB | Supabase (PostgreSQL + pgvector) |
| 스토리지 | Supabase Storage |
| 모니터링 | Langfuse (LLM 트레이싱), GA4 + GTM |
| 배포 | Vercel (프론트), Railway (Flask) |

### 4.3 데이터베이스 스키마

**posts**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 게시물 ID |
| nickname | text | 익명 닉네임 |
| title | text | 자동 생성 제목 |
| analysis | jsonb | AI 분석 결과 |
| summary | text | 사고 요약 |
| fault_ratio_a/b | integer | 과실비율 |
| chart_code | text | 도표번호 |
| media_url | text | 미디어 URL |
| media_type | text | image/video |
| thumbnail_url | text | 썸네일 URL |
| session_token | text | 소유자 식별 |
| created_at | timestamptz | 생성일 |

**comments**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid PK | 댓글 ID |
| post_id | uuid FK | 게시물 ID |
| nickname | text | 닉네임 |
| content | text | 내용 |
| session_token | text | 소유자 식별 |
| created_at | timestamptz | 생성일 |

**documents** (벡터 임베딩 — 1,205건)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | serial PK | 문서 ID |
| title | text | 청크 제목 |
| content | text | 내용 |
| embedding | vector(1536) | 임베딩 |
| metadata | jsonb | 페이지/출처 |

## 5. AI 정확도

### 5.1 테스트 결과 (10개 실제 사례 기준)

| 지표 | 결과 |
|------|------|
| 평균 오차율 | **7%p** |
| 정확 일치 | 4/10 (40%) |
| 10%p 이내 | 9/10 (90%) |
| 최대 오차 | 20%p (1건) |

### 5.2 강점
- 명확한 과실 사례 (신호위반, 추돌) 정확도 높음
- 손보협 도표번호 자동 매칭
- RAG로 실제 판례 기준 참조 (1,205건)

### 5.3 개선 영역
- 주요 과실자에게 기준 대비 ~10%p 더 가혹한 경향
- 같은 방향 우회전 vs 직진 등 특수 사례에서 오차 큼

## 6. UI/UX

### 6.1 화면 구성
- **분석 탭**: 헤더 → 영상 모드 토글 → 파일 업로드 → 사고 입력 (마법사/텍스트) → 결과 (히어로 카드 + 캐러셀) → FAQ
- **커뮤니티 탭**: 피드 → 상세보기 → 댓글
- **하단 탭바**: 플로팅 캡슐 (분석/커뮤니티)

### 6.2 디자인 시스템
- 컬러: 토스 스타일 (#3182F6 파란, #F04452 빨간, #191F28 다크)
- 카드: 흰 배경, rounded-2xl
- 히어로: 그라데이션 (#1E3A5F → #2563EB)
- 아이콘: Material Symbols Rounded
- 반응형: 모바일 퍼스트 (max-w-2xl)

## 7. 이벤트 추적 (GTM + GA4)

| 이벤트 | 트리거 |
|--------|--------|
| analyze_start | 분석 시작 |
| analyze_complete | 분석 완료 |
| analyze_error | 분석 실패 |
| toggle_analysis_mode | 영상/텍스트 전환 |
| select_template | 템플릿 선택 |
| share_link | 링크 복사 |
| save_image | 이미지 저장 |
| open_share_modal | 공유 모달 열기 |
| community_share_complete | 커뮤니티 공유 완료 |
| tab_switch | 탭 전환 |
| community_post_click | 포스트 클릭 |
| comment_submit | 댓글 작성 |
| faq_open | FAQ 열기 |

## 8. SEO

- Title/Description 최적화 (50자+/120자+)
- OG/Twitter Card 메타태그
- JSON-LD 구조화 데이터 (WebApplication, FAQPage)
- Canonical URL
- robots.txt + sitemap.xml
- 크롤러용 noscript 정적 콘텐츠 (H1-H3 구조)
- Google Fonts preload (렌더 블로킹 제거)
- 보안/캐시 헤더 (vercel.json)

## 9. 비기능 요구사항

| 항목 | 기준 |
|------|------|
| 텍스트 분석 속도 | < 15초 |
| 영상 분석 속도 | < 60초 (30초 영상) |
| 파일 제한 | 200MB, 40초 |
| 지원 형식 | MP4, AVI, MOV / JPG, PNG |
| 브라우저 | Chrome, Safari, Edge 최신 |
| 반응형 | 모바일 우선 |

## 10. 제약사항

- AI 분석 결과는 참고용이며 법적 구속력 없음
- 영상 분석은 화질/각도에 따라 정확도 차이 발생
- 복잡한 사고(다중 차량, 특수 상황)는 정확도가 낮을 수 있음

## 11. 마일스톤

### Phase 1 — MVP (완료)
- [x] 텍스트 기반 사고 분석 (Claude API)
- [x] 7단계 마법사 + 사고 템플릿
- [x] 영상 분석 (YOLOv8 + ByteTrack + Claude Vision)
- [x] 과실비율 시각화 (히어로 카드 + 캐러셀)
- [x] RAG 연동 (Supabase 벡터 검색, 1,205건 판례)
- [x] 2D 사고 재현 애니메이션 (SVG)

### Phase 1.5 — 커뮤니티 & 분석 (완료)
- [x] 커뮤니티 게시판 + 댓글
- [x] AI 사고 썸네일 생성 (DALL-E 3)
- [x] OG 메타태그 + SNS 공유
- [x] GTM + GA4 이벤트 추적 (13개 이벤트)
- [x] SEO 최적화 (JSON-LD, 구조화 데이터)
- [x] Langfuse LLM 모니터링
- [x] 정확도 테스트 (평균 오차 7%p)

### Phase 2 — 고도화 (예정)
- [ ] 정확도 개선 (프롬프트 튜닝, 판례 DB 확장)
- [ ] 사용자 피드백 수집 (실제 과실비율 대비)
- [ ] Optical Flow 기반 사고 감지 보강
- [ ] 도로 유형 확대 (T자, 로터리)

### Phase 3 — 확장 (예정)
- [ ] 다국어 지원
- [ ] 모바일 앱 (PWA)
- [ ] 보험사/법률사무소 B2B API
