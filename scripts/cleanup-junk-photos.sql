-- photo_urls / media_items 에서 fmkorea .thumb.webp (빨간 플레이 버튼 박힌 비디오 썸네일) + 투명 GIF 제거
-- 클라이언트 getMediaItems() 에서도 동일 필터 적용됨, DB도 정리해서 일관성 확보.

begin;

-- 1) photo_urls 에서 junk URL 제거
update posts
set photo_urls = (
  select jsonb_agg(p)
  from jsonb_array_elements_text(photo_urls) as p
  where p !~ '\.thumb\.webp'
    and p !~ 'classes/lazy/img/transparent'
)
where photo_urls is not null
  and exists (
    select 1 from jsonb_array_elements_text(photo_urls) as p
    where p ~ '\.thumb\.webp' or p ~ 'classes/lazy/img/transparent'
  );

-- 비어있는 photo_urls 는 null 로 정리
update posts set photo_urls = null where photo_urls = '[]'::jsonb;

-- 2) media_items 에서도 junk URL 제거
update posts
set media_items = (
  select jsonb_agg(it)
  from jsonb_array_elements(media_items) as it
  where (it->>'url') !~ '\.thumb\.webp'
    and (it->>'url') !~ 'classes/lazy/img/transparent'
)
where media_items is not null
  and exists (
    select 1 from jsonb_array_elements(media_items) as it
    where (it->>'url') ~ '\.thumb\.webp'
       or (it->>'url') ~ 'classes/lazy/img/transparent'
  );

-- 비어있는 media_items 는 null 로 정리
update posts set media_items = null where media_items = '[]'::jsonb;

commit;

-- 확인:
-- select id, jsonb_array_length(media_items) from posts where media_items is not null;
