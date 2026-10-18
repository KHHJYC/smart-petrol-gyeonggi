-- 스마트펫트롤 공용 기록 스키마
--
-- 현장 기록은 저장하는 즉시 모든 이용자의 지도에 공개된다.
-- 작성자는 Supabase 익명 로그인으로만 구분하며 이름·연락처를 받지 않는다.
--
-- 익명성: 공개 목록(reports_feed)에는 작성자 번호(owner)를 내보내지 않는다.
-- 작성자 번호가 공개되면 같은 사람이 남긴 기록끼리 묶을 수 있고,
-- 한 사람의 산책 경로가 모이면 사는 곳을 짐작할 수 있기 때문이다.
-- 대신 각 기록에 '내가 쓴 글인지(is_own)'만 붙여 준다.
--
-- 운영: 문제가 있는 기록은 표 편집기에서 moderation_status 를 'rejected' 로 바꾸면
-- 작성자 본인 외에는 보이지 않는다.
--
-- 이 파일은 여러 번 실행해도 된다.

create extension if not exists pgcrypto;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 70),
  lat double precision not null check (lat > 33 and lat < 39),
  lng double precision not null check (lng > 124 and lng < 132),
  city text not null check (char_length(city) between 1 and 30),
  category text not null check (char_length(category) between 1 and 40),
  description text not null check (char_length(description) between 1 and 1600), observed_at timestamptz not null,
  status text not null default '접수' check (status in ('접수','현장 확인','조치 확인','종료')),
  evidence text not null default '', radius integer not null check (radius between 50 and 500),
  cctv integer, lights integer, source_at text not null default '',
  moderation_status text not null default 'approved' check (moderation_status in ('pending','approved','rejected')),
  created timestamptz not null default now(), updated timestamptz not null default now()
);
-- 예전 스키마(승인제)로 이미 만든 표라면 기본값만 바꾼다
alter table public.reports alter column moderation_status set default 'approved';

create table if not exists public.patrols (
  id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
  city text not null, memo text not null, checks jsonb not null default '[]', started timestamptz not null,
  ended timestamptz not null, seconds integer not null check (seconds between 0 and 86400)
);
create index if not exists reports_public_map_idx on public.reports (moderation_status, created desc);
create index if not exists patrols_owner_idx on public.patrols (owner, ended desc);

alter table public.reports enable row level security;
alter table public.patrols enable row level security;

-- 원본 표는 본인 기록만 읽을 수 있다. 다른 사람 기록은 아래 reports_feed 로만 본다.
drop policy if exists "approved reports or own reports" on public.reports;
drop policy if exists "read own reports" on public.reports;
create policy "read own reports" on public.reports for select to authenticated
  using (owner = auth.uid());

drop policy if exists "create own pending report" on public.reports;
drop policy if exists "create own public report" on public.reports;
create policy "create own public report" on public.reports for insert to authenticated
  with check (owner = auth.uid() and moderation_status = 'approved' and status = '접수' and evidence = '');

drop policy if exists "update own report" on public.reports;
create policy "update own report" on public.reports for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "read own patrols" on public.patrols;
create policy "read own patrols" on public.patrols for select to authenticated using (owner = auth.uid());
drop policy if exists "create own patrols" on public.patrols;
create policy "create own patrols" on public.patrols for insert to authenticated with check (owner = auth.uid());

revoke all on public.reports from anon, authenticated;
grant select, insert on public.reports to authenticated;
grant update (status, evidence, updated) on public.reports to authenticated;
revoke all on public.patrols from anon, authenticated;
grant select, insert on public.patrols to authenticated;

-- 공개 목록. 작성자 번호(owner)는 빼고, 보는 사람 기준으로 내 글인지만 계산한다.
-- 원본 표의 행 보안을 우회해 모든 공개 기록을 보여 주므로 열을 직접 고른다.
create or replace view public.reports_feed as
  select id, title, lat, lng, city, category, description, observed_at, status, evidence,
         radius, cctv, lights, source_at, moderation_status, created, updated,
         (owner = auth.uid()) as is_own
    from public.reports
   where moderation_status = 'approved' or owner = auth.uid();

revoke all on public.reports_feed from anon, authenticated;
grant select on public.reports_feed to authenticated;

comment on view public.reports_feed is '모든 이용자에게 보이는 현장 기록. 작성자 번호는 공개하지 않는다.';
comment on column public.reports.moderation_status is 'approved: 저장 즉시 모두에게 공개(기본값), rejected: 운영자가 내린 기록(작성자만 확인)';
