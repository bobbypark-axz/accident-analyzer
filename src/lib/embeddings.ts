export async function generateEmbedding(text: string): Promise<number[]> {
  const apiBase = import.meta.env.DEV ? 'http://localhost:5173' : '';
  const response = await fetch(`${apiBase}/api/embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text }),
  });

  if (!response.ok) {
    throw new Error('임베딩 생성에 실패했습니다.');
  }

  const data = await response.json();
  return data.embedding;
}
