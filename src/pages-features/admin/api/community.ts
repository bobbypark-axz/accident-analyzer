import type { AdminListResponse } from '../model/types';

const PASSWORD_KEY = 'adminPassword';

function getStoredPassword(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(PASSWORD_KEY);
}

async function call<T>(
  action: 'list' | 'delete_post' | 'delete_comment',
  password: string,
  payload?: { id?: string | number },
): Promise<T> {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, password, payload }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `요청 실패 (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function loginAdmin(password: string): Promise<void> {
  // list를 호출해서 비밀번호 검증을 겸한다.
  await call<AdminListResponse>('list', password);
  sessionStorage.setItem(PASSWORD_KEY, password);
}

export function logoutAdmin(): void {
  sessionStorage.removeItem(PASSWORD_KEY);
}

export function isAdminLoggedIn(): boolean {
  return !!getStoredPassword();
}

export async function fetchCommunity(): Promise<AdminListResponse> {
  const password = getStoredPassword();
  if (!password) throw new Error('관리자 인증이 필요합니다.');
  return call<AdminListResponse>('list', password);
}

export async function deletePost(id: string | number): Promise<void> {
  const password = getStoredPassword();
  if (!password) throw new Error('관리자 인증이 필요합니다.');
  await call<{ ok: true }>('delete_post', password, { id });
}

export async function deleteComment(id: string | number): Promise<void> {
  const password = getStoredPassword();
  if (!password) throw new Error('관리자 인증이 필요합니다.');
  await call<{ ok: true }>('delete_comment', password, { id });
}
