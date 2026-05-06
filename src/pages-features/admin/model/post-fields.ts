// 스키마가 미리 확정되지 않아서, 흔한 컬럼명 후보로 값을 뽑는다.
// 새 필드명이 등장하면 후보에 추가만 하면 된다.

const TITLE_KEYS = ['title', 'subject', 'name'];
const CONTENT_KEYS = ['content', 'body', 'text', 'description'];
const AUTHOR_KEYS = [
  'author',
  'author_name',
  'nickname',
  'username',
  'user_name',
  'user_id',
];
const CREATED_KEYS = ['created_at', 'createdAt', 'inserted_at'];
export type MediaItem = {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
};

const SINGLE_IMAGE_KEYS = [
  'image_url',
  'image',
  'thumbnail_url',
  'photo_url',
  'cover_image',
];
const ARRAY_IMAGE_KEYS = [
  'images',
  'image_urls',
  'photos',
  'photo_urls',
  'attachments',
];

const VIDEO_EXT_RE = /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i;

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = record[key];
    if (typeof v === 'string' && v.trim().length > 0) return v;
    if (typeof v === 'number') return String(v);
  }
  return '';
}

export function getTitle(post: Record<string, unknown>): string {
  return pickString(post, TITLE_KEYS) || `게시글 #${String(post.id)}`;
}

export function getContent(post: Record<string, unknown>): string {
  return pickString(post, CONTENT_KEYS);
}

export function getAuthor(record: Record<string, unknown>): string {
  return pickString(record, AUTHOR_KEYS) || '익명';
}

export function getCreatedAt(record: Record<string, unknown>): string | null {
  const raw = pickString(record, CREATED_KEYS);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString('ko-KR');
}

export function extractMedia(post: Record<string, unknown>): MediaItem[] {
  const out: MediaItem[] = [];
  const seen = new Set<string>();
  const push = (m: MediaItem) => {
    if (!m.url || seen.has(m.url)) return;
    seen.add(m.url);
    out.push(m);
  };

  // 1) 가장 정보가 풍부한 표준 컬럼: media_items: [{url, type, thumbnail}]
  if (Array.isArray(post.media_items)) {
    for (const item of post.media_items) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const url =
        (typeof obj.url === 'string' && obj.url) ||
        (typeof obj.image_url === 'string' && obj.image_url) ||
        (typeof obj.src === 'string' && obj.src);
      if (!url) continue;
      const type =
        obj.type === 'video' || (typeof url === 'string' && VIDEO_EXT_RE.test(url))
          ? 'video'
          : 'image';
      const thumbnail =
        typeof obj.thumbnail === 'string' ? obj.thumbnail : undefined;
      push({ type, url, thumbnail });
    }
    if (out.length > 0) return out;
  }

  // 2) media_url + media_type + thumbnail_url 조합
  if (typeof post.media_url === 'string' && post.media_url.trim().length > 0) {
    const url = post.media_url;
    const type =
      post.media_type === 'video' || VIDEO_EXT_RE.test(url) ? 'video' : 'image';
    const thumbnail =
      typeof post.thumbnail_url === 'string' ? post.thumbnail_url : undefined;
    push({ type, url, thumbnail });
  }

  // 3) 단일 이미지 컬럼 후보들
  for (const key of SINGLE_IMAGE_KEYS) {
    const v = post[key];
    if (typeof v === 'string' && v.trim().length > 0) {
      push({ type: VIDEO_EXT_RE.test(v) ? 'video' : 'image', url: v });
    }
  }

  // 4) 배열 이미지 컬럼 후보들
  for (const key of ARRAY_IMAGE_KEYS) {
    const v = post[key];
    if (!Array.isArray(v)) continue;
    for (const item of v) {
      if (typeof item === 'string' && item.trim().length > 0) {
        push({ type: VIDEO_EXT_RE.test(item) ? 'video' : 'image', url: item });
        continue;
      }
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        const url =
          (typeof obj.url === 'string' && obj.url) ||
          (typeof obj.image_url === 'string' && obj.image_url) ||
          (typeof obj.src === 'string' && obj.src);
        if (!url) continue;
        const type =
          obj.type === 'video' || VIDEO_EXT_RE.test(url) ? 'video' : 'image';
        const thumbnail =
          typeof obj.thumbnail === 'string' ? obj.thumbnail : undefined;
        push({ type, url, thumbnail });
      }
    }
  }

  return out;
}
