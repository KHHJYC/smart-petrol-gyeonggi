import { env } from 'cloudflare:workers';
export function db() {
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) throw Error('Database is unavailable');
  return binding;
}
export function owner(request: Request) {
  const id = request.headers.get('oai-authenticated-user-id');
  if (id) return id;
  const host = new URL(request.url).hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'local-preview';
  return null;
}
export function textValue(v: unknown, max: number) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
export function failure(error: unknown) {
  console.error(
    'Record operation failed',
    error instanceof Error ? error.name : 'unknown',
  );
  return Response.json(
    {
      error:
        '기록을 저장하거나 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
    },
    { status: 503 },
  );
}
