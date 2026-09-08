import { db, owner, textValue, sameOrigin, failure } from '@/lib/server-db';
const statuses = ['접수', '현장 확인', '조치 확인', '종료'];
export async function GET(request: Request) {
  const user = owner(request);
  if (!user)
    return Response.json(
      { error: '기록을 보려면 로그인해 주세요.' },
      { status: 401 },
    );
  try {
    const [reports, patrols] = await db().batch([
      db()
        .prepare(
          'SELECT * FROM reports WHERE owner = ? ORDER BY created DESC LIMIT 500',
        )
        .bind(user),
      db()
        .prepare(
          'SELECT * FROM patrols WHERE owner = ? ORDER BY ended DESC LIMIT 500',
        )
        .bind(user),
    ]);
    return Response.json(
      {
        reports: reports.results,
        patrols: patrols.results,
        checkedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  const user = owner(request);
  if (!user)
    return Response.json(
      { error: '저장하려면 로그인해 주세요.' },
      { status: 401 },
    );
  try {
    const raw = await request.text();
    if (raw.length > 15000)
      return Response.json({ error: '내용이 너무 깁니다.' }, { status: 413 });
    if (!sameOrigin(request))
      return Response.json(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 },
      );
    const b = JSON.parse(raw);
    const now = new Date().toISOString();
    if (b.kind === 'report') {
      const title = textValue(b.title, 70),
        description = textValue(b.description, 1600),
        city = textValue(b.city, 30),
        category = textValue(b.category, 40),
        observedAt = textValue(b.observedAt, 35);
      if (
        !title ||
        !description ||
        !city ||
        !category ||
        !Number.isFinite(Date.parse(observedAt)) ||
        typeof b.lat !== 'number' ||
        typeof b.lng !== 'number' ||
        b.lat <= 33 ||
        b.lat >= 39 ||
        b.lng <= 124 ||
        b.lng >= 132 ||
        !Number.isInteger(b.radius) ||
        b.radius < 50 ||
        b.radius > 500
      )
        return Response.json(
          { error: '제목·위치·관찰 내용과 시각을 확인해 주세요.' },
          { status: 400 },
        );
      const count = (n: unknown) =>
        Number.isInteger(n) && Number(n) >= 0 ? Number(n) : null;
      const id = crypto.randomUUID();
      await db()
        .prepare(
          'INSERT INTO reports (id,owner,title,lat,lng,city,category,description,observed_at,status,evidence,radius,cctv,lights,source_at,created,updated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          user,
          title,
          b.lat,
          b.lng,
          city,
          category,
          description,
          observedAt,
          '접수',
          '',
          b.radius,
          count(b.cctv),
          count(b.lights),
          textValue(b.sourceAt, 50),
          now,
          now,
        )
        .run();
      return Response.json({ id }, { status: 201 });
    }
    if (b.kind === 'patrol') {
      const memo = textValue(b.memo, 1600),
        city = textValue(b.city, 30),
        started = textValue(b.started, 35),
        ended = textValue(b.ended, 35);
      const seconds = Math.floor(
        (Date.parse(ended) - Date.parse(started)) / 1000,
      );
      if (
        !memo ||
        !city ||
        !Number.isFinite(seconds) ||
        seconds < 0 ||
        seconds > 86400 ||
        !Array.isArray(b.checks)
      )
        return Response.json(
          { error: '순찰 시간과 관찰 내용을 확인해 주세요.' },
          { status: 400 },
        );
      const id = crypto.randomUUID();
      await db()
        .prepare(
          'INSERT INTO patrols (id,owner,city,memo,checks,started,ended,seconds) VALUES (?,?,?,?,?,?,?,?)',
        )
        .bind(
          id,
          user,
          city,
          memo,
          JSON.stringify(
            b.checks.filter((x: unknown) => typeof x === 'string').slice(0, 5),
          ),
          started,
          ended,
          seconds,
        )
        .run();
      return Response.json({ id }, { status: 201 });
    }
    return Response.json(
      { error: '올바른 기록 유형을 선택해 주세요.' },
      { status: 400 },
    );
  } catch (e) {
    if (e instanceof SyntaxError)
      return Response.json(
        { error: '요청 내용을 확인해 주세요.' },
        { status: 400 },
      );
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  const user = owner(request);
  if (!user)
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  try {
    const raw = await request.text();
    if (raw.length > 8000)
      return Response.json({ error: '내용이 너무 깁니다.' }, { status: 413 });
    if (!sameOrigin(request))
      return Response.json(
        { error: '허용되지 않은 요청입니다.' },
        { status: 403 },
      );
    const b = JSON.parse(raw),
      id = textValue(b.id, 80),
      status = textValue(b.status, 20),
      evidence = textValue(b.evidence, 1200);
    if (!id || !statuses.includes(status) || (status !== '접수' && !evidence))
      return Response.json(
        { error: '상태를 바꾸려면 확인 근거를 적어 주세요.' },
        { status: 400 },
      );
    const result = await db()
      .prepare(
        'UPDATE reports SET status = ?, evidence = ?, updated = ? WHERE id = ? AND owner = ?',
      )
      .bind(status, evidence, new Date().toISOString(), id, user)
      .run();
    if (!result.meta.changes)
      return Response.json({ error: '해당 기록이 없습니다.' }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof SyntaxError)
      return Response.json(
        { error: '요청 내용을 확인해 주세요.' },
        { status: 400 },
      );
    return failure(e);
  }
}
