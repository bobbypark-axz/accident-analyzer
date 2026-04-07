"""과실비율 인정기준 PDF → 청크 분할 → OpenAI 임베딩 → Supabase 저장"""
import json
import os
import re
import time
from pypdf import PdfReader
from supabase import create_client
import requests

# 환경 설정
SUPABASE_URL = "https://ejfpxcxzyalnnmoypznm.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqZnB4Y3h6eWFsbm5tb3lwem5tIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ5NzQyNCwiZXhwIjoyMDkxMDczNDI0fQ.5lRkjHtSoo6gWs_hVfkTkJnKIVc-6nSGcfxhOYC5gk0"
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# .env에서 OpenAI 키 로드
if not OPENAI_API_KEY:
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("OPENAI_API_KEY="):
                    OPENAI_API_KEY = line.strip().split("=", 1)[1]

PDF_PATH = "/Users/bobby.axz-pc/Downloads/230630_자동차사고 과실비율 인정기준_최종.pdf"


def extract_text_from_pdf(path):
    """PDF에서 전체 텍스트 추출"""
    reader = PdfReader(path)
    pages = []
    for i, page in enumerate(reader.pages):
        text = page.extract_text()
        if text and len(text.strip()) > 20:
            pages.append({"page": i + 1, "text": text.strip()})
    return pages


def chunk_pages(pages, chunk_size=1500, overlap=200):
    """페이지 텍스트를 의미 단위 청크로 분할"""
    chunks = []
    for page_data in pages:
        text = page_data["text"]
        page_num = page_data["page"]

        # 사고유형 패턴으로 분할 시도 (예: "1) 직진 대 직진 사고", "[거1]", "도표번호")
        sections = re.split(r'(?=\d+\)\s|(?=\[\S+\])|(?=도표\s*\d+))', text)

        current = ""
        for section in sections:
            if len(current) + len(section) > chunk_size and current:
                chunks.append({
                    "title": extract_title(current),
                    "content": current.strip(),
                    "metadata": {"page": page_num, "source": "과실비율 인정기준 2023"}
                })
                # 오버랩
                current = current[-overlap:] + section
            else:
                current += section

        if current.strip() and len(current.strip()) > 50:
            chunks.append({
                "title": extract_title(current),
                "content": current.strip(),
                "metadata": {"page": page_num, "source": "과실비율 인정기준 2023"}
            })

    return chunks


def extract_title(text):
    """청크에서 제목 추출"""
    lines = text.strip().split("\n")
    for line in lines[:3]:
        line = line.strip()
        if len(line) > 5 and len(line) < 100:
            return line
    return lines[0][:80] if lines else "과실비율 기준"


def get_embedding(text):
    """OpenAI text-embedding-3-small로 임베딩 생성"""
    resp = requests.post(
        "https://api.openai.com/v1/embeddings",
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "Content-Type": "application/json"},
        json={"model": "text-embedding-3-small", "input": text[:8000]},
    )
    if resp.status_code != 200:
        raise Exception(f"OpenAI 에러: {resp.status_code} {resp.text[:200]}")
    return resp.json()["data"][0]["embedding"]


def main():
    if not OPENAI_API_KEY:
        print("OPENAI_API_KEY가 필요합니다. .env에 설정해주세요.")
        return

    print("1. PDF 텍스트 추출 중...")
    pages = extract_text_from_pdf(PDF_PATH)
    print(f"   {len(pages)}개 페이지 추출 완료")

    print("2. 청크 분할 중...")
    chunks = chunk_pages(pages)
    print(f"   {len(chunks)}개 청크 생성")

    print("3. Supabase 연결...")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    print(f"4. 임베딩 생성 + Supabase 저장 중... ({len(chunks)}건)")
    success = 0
    errors = 0
    batch = []

    for i, chunk in enumerate(chunks):
        try:
            embedding = get_embedding(chunk["content"])
            batch.append({
                "title": chunk["title"],
                "content": chunk["content"],
                "embedding": embedding,
                "metadata": chunk["metadata"],
            })

            # 10개씩 배치 삽입
            if len(batch) >= 10:
                supabase.table("documents").insert(batch).execute()
                success += len(batch)
                batch = []
                print(f"   [{success}/{len(chunks)}] 저장 완료")

            # Rate limit 대응 (OpenAI: 3000 RPM)
            if (i + 1) % 50 == 0:
                time.sleep(1)

        except Exception as e:
            errors += 1
            print(f"   [{i+1}] 에러: {e}")
            time.sleep(2)

    # 남은 배치 저장
    if batch:
        try:
            supabase.table("documents").insert(batch).execute()
            success += len(batch)
        except Exception as e:
            errors += len(batch)
            print(f"   마지막 배치 에러: {e}")

    print(f"\n=== 완료 ===")
    print(f"성공: {success}건 / 실패: {errors}건 / 총: {len(chunks)}건")


if __name__ == "__main__":
    main()
