-- posts 테이블에 media_items jsonb 컬럼 추가 + 기존 데이터 백필
-- 기존 media_url, media_type, thumbnail_url, photo_urls 는 그대로 유지 (듀얼 라이트 기간)
-- 롤백: alter table posts drop column media_items;

alter table posts add column if not exists media_items jsonb;

-- photo_urls 는 jsonb 타입 → jsonb 전용 함수 사용
-- 구조: media_items = [{ url, type: 'video'|'image', thumbnail?: string|null }]
update posts
set media_items = coalesce(
  (
    case
      when media_url is not null then
        jsonb_build_array(
          jsonb_build_object(
            'url', media_url,
            'type', coalesce(media_type, 'image'),
            'thumbnail', thumbnail_url
          )
        )
      else '[]'::jsonb
    end
  ) || coalesce(
    (
      select jsonb_agg(
        jsonb_build_object('url', p, 'type', 'image', 'thumbnail', null)
      )
      from jsonb_array_elements_text(photo_urls) as p
    ),
    '[]'::jsonb
  ),
  '[]'::jsonb
)
where media_items is null
  and (media_url is not null or (photo_urls is not null and jsonb_array_length(photo_urls) > 0));

-- JSONB GIN 인덱스 (후속 쿼리에서 type 필터 등 활용 가능)
create index if not exists posts_media_items_idx on posts using gin (media_items);

-- 확인용 쿼리:
-- select id, jsonb_array_length(media_items) as n_items, media_items from posts where media_items is not null limit 5;
