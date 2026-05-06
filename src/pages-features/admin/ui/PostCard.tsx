import { useState } from 'react';
import { ChevronDown, ChevronUp, MessageSquare, Trash2 } from 'lucide-react';
import type { CommunityComment, CommunityPost } from '../model/types';
import {
  extractMedia,
  getAuthor,
  getContent,
  getCreatedAt,
  getTitle,
} from '../model/post-fields';

interface Props {
  post: CommunityPost;
  comments: CommunityComment[];
  onDeletePost: (id: string | number) => void;
  onDeleteComment: (id: string | number) => void;
}

export function PostCard({
  post,
  comments,
  onDeletePost,
  onDeleteComment,
}: Props) {
  const [showRaw, setShowRaw] = useState(false);
  const [showComments, setShowComments] = useState(true);

  const title = getTitle(post);
  const author = getAuthor(post);
  const createdAt = getCreatedAt(post);
  const content = getContent(post);
  const media = extractMedia(post);

  return (
    <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-4">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">
            {title}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            <span className="font-medium">{author}</span>
            {createdAt && <span className="ml-2">· {createdAt}</span>}
            <span className="ml-2 text-gray-400">· id: {String(post.id)}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDeletePost(post.id)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
          게시글 삭제
        </button>
      </header>

      {content && (
        <div className="text-sm text-gray-700 whitespace-pre-wrap mb-3">
          {content}
        </div>
      )}

      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {media.map((m, idx) => (
            <div
              key={`${m.url}-${idx}`}
              className="relative aspect-square overflow-hidden rounded-md bg-gray-100"
            >
              {m.type === 'video' ? (
                <>
                  <video
                    src={m.url}
                    poster={m.thumbnail}
                    controls
                    preload="metadata"
                    playsInline
                    className="w-full h-full object-cover bg-black"
                  />
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[10px] font-semibold bg-black/70 text-white rounded">
                    VIDEO
                  </span>
                </>
              ) : (
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full h-full"
                >
                  <img
                    src={m.url}
                    alt={`첨부 이미지 ${idx + 1}`}
                    loading="lazy"
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 pt-3 mt-3">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          <MessageSquare className="h-4 w-4" />
          댓글 {comments.length}개
          {showComments ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        {showComments && comments.length > 0 && (
          <ul className="mt-3 space-y-2">
            {comments.map((comment) => (
              <li
                key={String(comment.id)}
                className="flex items-start justify-between gap-2 bg-gray-50 rounded-md p-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-gray-700">
                    {getAuthor(comment)}
                    {getCreatedAt(comment) && (
                      <span className="ml-2 text-xs text-gray-400 font-normal">
                        {getCreatedAt(comment)}
                      </span>
                    )}
                  </p>
                  <p className="text-gray-700 whitespace-pre-wrap mt-1">
                    {getContent(comment)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onDeleteComment(comment.id)}
                  className="text-red-500 hover:bg-red-50 p-1.5 rounded shrink-0"
                  aria-label="댓글 삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {showRaw ? 'raw 데이터 숨기기' : 'raw 데이터 보기'}
        </button>
        {showRaw && (
          <pre className="mt-2 text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto">
            {JSON.stringify(post, null, 2)}
          </pre>
        )}
      </div>
    </article>
  );
}
