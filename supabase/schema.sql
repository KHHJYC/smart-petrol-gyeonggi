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
  moderation_status text not null default 'pending' check (moderation_status in ('pending','approved','rejected')),
  created timestamptz not null default now(), updated timestamptz not null default now()
);
create table if not exists public.patrols (
  id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
  city text not null, memo text not null, checks jsonb not null default '[]', started timestamptz not null,
  ended timestamptz not null, seconds integer not null check (seconds between 0 and 86400)
);
create index if not exists reports_public_map_idx on public.reports (moderation_status, created desc);
create index if not exists patrols_owner_idx on public.patrols (owner, ended desc);

alter table public.reports enable row level security;
alter table public.patrols enable row level security;
create policy "approved reports or own reports" on public.reports for select to authenticated
  using (moderation_status = 'approved' or owner = auth.uid());
create policy "create own pending report" on public.reports for insert to authenticated
  with check (owner = auth.uid() and moderation_status = 'pending' and status = '접수' and evidence = '');
create policy "update own report" on public.reports for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
create policy "read own patrols" on public.patrols for select to authenticated using (owner = auth.uid());
create policy "create own patrols" on public.patrols for insert to authenticated with check (owner = auth.uid());

revoke update on public.reports from authenticated;
grant update (status, evidence, updated) on public.reports to authenticated;
grant select, insert on public.reports to authenticated;
grant select, insert on public.patrols to authenticated;

comment on column public.reports.moderation_status is 'pending: 작성자만 확인, approved: 모든 사용자 지도 공개, rejected: 작성자만 확인';
