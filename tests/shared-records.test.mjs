import test from 'node:test';
import assert from 'node:assert/strict';
import { installSharedRecords } from '../pages/shared-records.ts';

test('shared records publish reports and patrols immediately without exposing the author', async () => {
  const stored = new Map(), calls = [];
  const user = '11111111-1111-4111-8111-111111111111';
  const remote = async (input, init = {}) => {
    const url = String(input), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method || 'GET', body });
    if (url.endsWith('/auth/v1/signup')) return new Response(JSON.stringify({
      access_token: 'access', refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: user },
    }));
    // reports_feed 는 작성자 번호 없이 is_own 만 돌려준다
    if (url.includes('/rest/v1/reports_feed?')) return new Response(JSON.stringify([
      { id: 'mine', title: '내 글', moderation_status: 'approved', is_own: true },
      { id: 'other', title: '다른 사람 글', moderation_status: 'approved', is_own: false },
    ]));
    // patrols_feed 도 작성자 번호 없이 is_own 만 돌려준다. 남의 순찰은 날짜만 온다.
    if (url.includes('/rest/v1/patrols_feed?')) return new Response(JSON.stringify([
      { id: 'my-walk', city: '양주시', memo: '내 순찰', seconds: 3000,
        started: '2026-10-18T10:00:00+00:00', ended: '2026-10-18T10:50:00+00:00', is_own: true },
      { id: 'other-walk', city: '양주시', memo: '이웃 순찰', seconds: 2400,
        started: '2026-10-17T15:00:00+00:00', ended: '2026-10-17T15:00:00+00:00', is_own: false },
    ]));
    return new Response('', { status: 201 });
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = remote;
  globalThis.localStorage = { getItem: (k) => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) };
  globalThis.window = { fetch: remote, location: { href: 'https://example.github.io/smart-petrol-gyeonggi/', origin: 'https://example.github.io' } };
  installSharedRecords({ url: 'https://project.supabase.co', key: 'publishable' });

  const loaded = await (await window.fetch('/api/records')).json();
  assert.equal(loaded.shared, true);
  assert.ok(calls.some((c) => c.url.includes('/rest/v1/reports_feed?')), '공개 목록은 reports_feed 에서 읽는다');
  assert.ok(!calls.some((c) => /\/rest\/v1\/reports\?/.test(c.url)), '원본 표를 직접 읽지 않는다');
  assert.equal(loaded.reports[0].is_own, true);
  assert.equal(loaded.reports[1].is_own, false);
  assert.equal('owner' in loaded.reports[0], false);
  assert.equal('owner' in loaded.reports[1], false);

  // 순찰일지도 모두에게 공개하되 작성자 번호는 내보내지 않는다
  assert.ok(calls.some((c) => c.url.includes('/rest/v1/patrols_feed?')), '순찰일지는 patrols_feed 에서 읽는다');
  assert.ok(!calls.some((c) => /\/rest\/v1\/patrols\?/.test(c.url)), '순찰 원본 표를 직접 읽지 않는다');
  assert.equal(loaded.patrols.length, 2);
  assert.equal(loaded.patrols[0].is_own, true);
  assert.equal(loaded.patrols[1].is_own, false);
  assert.equal('owner' in loaded.patrols[1], false);

  const saved = await window.fetch('/api/records', { method: 'POST', body: JSON.stringify({
    kind: 'report', title: '보안등 확인', description: '점등되지 않음', city: '성남시', category: '보안등 꺼짐·깜빡임',
    observedAt: new Date().toISOString(), lat: 37.42, lng: 127.12, radius: 100,
  }) });
  assert.equal(saved.status, 201);
  assert.equal((await saved.json()).moderation, 'approved');
  const insert = calls.find((c) => c.method === 'POST' && c.url.endsWith('/rest/v1/reports'));
  assert.equal(insert.body.owner, user);
  assert.equal(insert.body.moderation_status, 'approved');
  assert.equal(insert.body.status, '접수');
  globalThis.fetch = previousFetch;
});
