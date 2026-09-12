import test from 'node:test';
import assert from 'node:assert/strict';
import { installSharedRecords } from '../pages/shared-records.ts';

test('shared records use anonymous ownership and keep new reports pending', async () => {
  const stored = new Map(), calls = [];
  const user = '11111111-1111-4111-8111-111111111111';
  const remote = async (input, init = {}) => {
    const url = String(input), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method || 'GET', body });
    if (url.endsWith('/auth/v1/signup')) return new Response(JSON.stringify({
      access_token: 'access', refresh_token: 'refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: user },
    }));
    if (url.includes('/rest/v1/reports?')) return new Response(JSON.stringify([
      { id: 'mine', owner: user, title: '내 글', moderation_status: 'pending' },
      { id: 'public', owner: '22222222-2222-4222-8222-222222222222', title: '공개 글', moderation_status: 'approved' },
    ]));
    if (url.includes('/rest/v1/patrols?')) return new Response('[]');
    return new Response('', { status: 201 });
  };
  const previousFetch = globalThis.fetch;
  globalThis.fetch = remote;
  globalThis.localStorage = { getItem: (k) => stored.get(k) || null, setItem: (k, v) => stored.set(k, v) };
  globalThis.window = { fetch: remote, location: { href: 'https://example.github.io/smart-petrol-gyeonggi/', origin: 'https://example.github.io' } };
  installSharedRecords({ url: 'https://project.supabase.co', key: 'publishable' });
  const loaded = await (await window.fetch('/api/records')).json();
  assert.equal(loaded.shared, true);
  assert.equal(loaded.reports[0].is_own, true);
  assert.equal(loaded.reports[1].is_own, false);
  assert.equal('owner' in loaded.reports[0], false);
  const saved = await window.fetch('/api/records', { method: 'POST', body: JSON.stringify({
    kind: 'report', title: '보안등 확인', description: '점등되지 않음', city: '성남시', category: '보안등 꺼짐·깜빡임',
    observedAt: new Date().toISOString(), lat: 37.42, lng: 127.12, radius: 100,
  }) });
  assert.equal(saved.status, 201);
  const insert = calls.find((c) => c.method === 'POST' && c.url.endsWith('/rest/v1/reports'));
  assert.equal(insert.body.owner, user);
  assert.equal(insert.body.moderation_status, 'pending');
  assert.equal(insert.body.status, '접수');
  globalThis.fetch = previousFetch;
});
