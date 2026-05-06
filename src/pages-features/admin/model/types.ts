export type CommunityPost = Record<string, unknown> & {
  id: string | number;
};

export type CommunityComment = Record<string, unknown> & {
  id: string | number;
  post_id?: string | number;
};

export interface AdminListResponse {
  posts: CommunityPost[];
  comments: CommunityComment[];
}
