import { env } from 'cloudflare:workers';
type Upstream = {
  CCTV?: {
    head?: { RESULT?: { CODE: string }; list_total_count?: number }[];
    row?: Record<string, unknown>[];
  }[];
  RESULT?: { CODE: string };
};
export async function GET(request: Request) {
  const page = Number(new URL(request.url).searchParams.get('page') || '1');
  if (!Number.isInteger(page) || page < 1 || page > 1000)
    return Response.json(
      { error: '올바른 페이지를 선택해 주세요.' },
      { status: 400 },
    );
  const key = (env as unknown as Record<string, string>).GG_API_KEY;
  if (!key)
    return Response.json(
      {
        error:
          '현재 서버에서 API 연결을 사용할 수 없습니다. 저장된 자료는 계속 이용할 수 있습니다.',
      },
      { status: 503 },
    );
  const url = new URL('https://openapi.gg.go.kr/CCTV');
  url.search = new URLSearchParams({
    KEY: key,
    Type: 'json',
    pIndex: String(page),
    pSize: '1000',
  }).toString();
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(25000),
      headers: { Accept: '*/*' },
      cf: { cacheTtl: 300, cacheEverything: true },
    } as RequestInit);
    if (!response.ok) throw Error('upstream_status_' + response.status);
    const data = (await response.json()) as Upstream;
    const head = data.CCTV?.find((x) => x.head)?.head;
    const result = head?.find((x) => x.RESULT)?.RESULT || data.RESULT;
    const rows = data.CCTV?.find((x) => x.row)?.row;
    const total = head?.find(
      (x) => typeof x.list_total_count === 'number',
    )?.list_total_count;
    if (
      result?.CODE !== 'INFO-000' ||
      !Array.isArray(rows) ||
      !Number.isFinite(total)
    )
      throw Error('upstream_result_' + String(result?.CODE || 'unknown'));
    return Response.json(
      { total, rows, page, checkedAt: new Date().toISOString() },
      {
        headers: {
          'Cache-Control': 'public, max-age=300',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  } catch (e) {
    const err = e as Error & { cause?: { code?: string } };
    console.error(
      'CCTV upstream',
      err.message.startsWith('upstream_') ? err.message : err.name,
      err.cause?.code || '',
    );
    return Response.json(
      {
        error:
          '경기데이터드림 연결이 지연되거나 응답이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.',
      },
      { status: 502 },
    );
  }
}
