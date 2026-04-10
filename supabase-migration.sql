-- 1. posts 테이블에 description, view_count 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS view_count integer DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS photo_urls jsonb;

-- 2. likes 테이블 생성
CREATE TABLE IF NOT EXISTS likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  session_token text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, session_token)
);

-- 3. likes 인덱스
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_session_token ON likes(session_token);

-- 4. 조회수 증가 RPC 함수
CREATE OR REPLACE FUNCTION increment_view_count(p_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE posts SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- 5. 좋아요 토글 RPC 함수 (있으면 삭제, 없으면 추가 → 현재 상태 반환)
CREATE OR REPLACE FUNCTION toggle_like(p_id uuid, s_token text)
RETURNS json AS $$
DECLARE
  existing_id uuid;
  like_count integer;
  is_liked boolean;
BEGIN
  SELECT id INTO existing_id FROM likes WHERE post_id = p_id AND session_token = s_token;

  IF existing_id IS NOT NULL THEN
    DELETE FROM likes WHERE id = existing_id;
    is_liked := false;
  ELSE
    INSERT INTO likes (post_id, session_token) VALUES (p_id, s_token);
    is_liked := true;
  END IF;

  SELECT COUNT(*) INTO like_count FROM likes WHERE post_id = p_id;

  RETURN json_build_object('liked', is_liked, 'count', like_count);
END;
$$ LANGUAGE plpgsql;

-- 6. 게시물별 좋아요 수 조회 RPC
CREATE OR REPLACE FUNCTION get_like_count(p_id uuid)
RETURNS integer AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM likes WHERE post_id = p_id);
END;
$$ LANGUAGE plpgsql;
