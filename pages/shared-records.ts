type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string };
};

type SharedConfig = { url: string; key: string };
const SESSION_KEY = 'smart-petrol-shared-session-v1';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function readSession(): Session | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    return value?.access_token && value?.user?.id ? value : null;
  } catch {
    return null;
  }
}

function saveSession(value: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(value));
  return value;
}

async function auth(config: SharedConfig) {
  const saved = readSession();
  if (saved && saved.expires_at * 1000 > Date.now() + 60_000) return saved;
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    'Content-Type': 'application/json',
  };
  if (saved?.refresh_token) {
    const refreshed = await fetch(
      `${config.url}/auth/v1/token?grant_type=refresh_token`,
      { method: 'POST', headers, body: JSON.stringify({ refresh_token: saved.refresh_token }) },
    );
    if (refreshed.ok) return saveSession((await refreshed.json()) as Session);
  }
  const created = await fetch(`${config.url}/auth/v1/signup`, {
    method: 'POST',
    headers,
    body: '{}',
  });
  if (!created.ok)
    throw Error('공용 기록 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  return saveSession((await created.json()) as Session);
}

async function request(config: SharedConfig, path: string, init: RequestInit = {}) {
  const session = await auth(config);
  const headers = new Headers(init.headers);
  headers.set('apikey', config.key);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  headers.set('Content-Type', 'application/json');
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers,
  });
  if (!response.ok) throw Error('공용 기록을 불러오거나 저장하지 못했습니다.');
  return response;
}

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function records(config: SharedConfig, input: RequestInfo | URL, init?: RequestInit) {
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const session = await auth(config);
  if (method === 'GET') {
    const [reports, patrols] = await Promise.all([
      request(config, 'reports?select=*&order=created.desc&limit=500'),
      request(config, 'patrols?select=*&order=ended.desc&limit=500'),
    ]);
    const reportRows = (await reports.json()) as Array<Record<string, unknown>>;
    return json({
      reports: reportRows.map(({ owner, ...row }) => ({
        ...row,
        is_own: owner === session.user.id,
      })),
      patrols: await patrols.json(),
      checkedAt: new Date().toISOString(),
      shared: true,
    });
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(typeof init?.body === 'string' ? init.body : '{}') as Record<string, unknown>;
  } catch {
    return json({ error: '입력 내용을 확인해 주세요.' }, 400);
  }
  const now = new Date().toISOString();
  if (method === 'POST' && body.kind === 'report') {
    const title = text(body.title, 70), description = text(body.description, 1600);
    const observed = text(body.observedAt, 35), city = text(body.city, 30), category = text(body.category, 40);
    if (!title || !description || !city || !category || !Number.isFinite(Date.parse(observed)) ||
      typeof body.lat !== 'number' || typeof body.lng !== 'number' || body.lat <= 33 || body.lat >= 39 ||
      body.lng <= 124 || body.lng >= 132 || !Number.isInteger(body.radius) || Number(body.radius) < 50 || Number(body.radius) > 500)
      return json({ error: '제목·위치·관찰 내용과 시각을 확인해 주세요.' }, 400);
    const id = crypto.randomUUID();
    await request(config, 'reports', {
      method: 'POST', headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ id, owner: session.user.id, title, description, city, category,
        lat: body.lat, lng: body.lng, observed_at: observed, status: '접수', evidence: '',
        radius: body.radius, cctv: Number.isInteger(body.cctv) ? body.cctv : null,
        lights: Number.isInteger(body.lights) ? body.lights : null, source_at: text(body.sourceAt, 50),
        moderation_status: 'pending', created: now, updated: now }),
    });
    return json({ id, moderation: 'pending' }, 201);
  }
  if (method === 'POST' && body.kind === 'patrol') {
    const started = text(body.started, 35), ended = text(body.ended, 35), memo = text(body.memo, 1600);
    const seconds = Math.floor((Date.parse(ended) - Date.parse(started)) / 1000);
    if (!memo || !text(body.city, 30) || !Number.isFinite(seconds) || seconds < 0 || seconds > 86400 || !Array.isArray(body.checks))
      return json({ error: '순찰 시간과 관찰 내용을 확인해 주세요.' }, 400);
    const id = crypto.randomUUID();
    await request(config, 'patrols', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
      id, owner: session.user.id, city: text(body.city, 30), memo,
      checks: JSON.stringify(body.checks.filter((x) => typeof x === 'string').slice(0, 5)),
      started, ended, seconds,
    }) });
    return json({ id }, 201);
  }
  if (method === 'PATCH') {
    const status = text(body.status, 20), evidence = text(body.evidence, 1200), id = text(body.id, 80);
    if (!id || !['접수', '현장 확인', '조치 확인', '종료'].includes(status) || (status !== '접수' && !evidence))
      return json({ error: '상태를 바꾸려면 확인 근거를 적어 주세요.' }, 400);
    await request(config, `reports?id=eq.${encodeURIComponent(id)}&owner=eq.${session.user.id}`, {
      method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status, evidence, updated: now }),
    });
    return json({ ok: true });
  }
  return json({ error: '지원하지 않는 요청입니다.' }, 405);
}

export function installSharedRecords(config: SharedConfig) {
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.origin === window.location.origin && url.pathname === '/api/records') {
      try { return await records(config, input, init); }
      catch (error) { return json({ error: error instanceof Error ? error.message : '공용 기록 연결에 실패했습니다.' }, 503); }
    }
    return original(input, init);
  };
}
