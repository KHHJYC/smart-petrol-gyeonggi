export type Point = { lat: number; lng: number; label?: string };
export type Facility = {
  id: string;
  kind: 'cctv' | 'lights';
  city: string;
  lat: number | null;
  lng: number | null;
  address: string;
  name: string;
  purpose: string;
  count: number | null;
  date: string;
  agency: string;
  installed: string;
  direction: string;
};
export type Pet = {
  id: string;
  city: string;
  cityCode: string;
  year: string;
  town: string;
  animals: number | null;
  owners: number | null;
  date: string;
  ambiguous: boolean;
  subtotal: boolean;
};
export type Region = {
  name: string;
  file: string;
  center: [number, number];
  bounds: [number, number, number, number] | null;
  cctv: number;
  cctvMapped: number;
  lights: number;
  lightsMapped: number;
  petRows: number;
  petYears: string[];
  latestPetYear: string | null;
};
export type Manifest = {
  checkedAt: string;
  schemaVersion: number;
  mode: string;
  sources: Record<
    'cctv' | 'lights' | 'pets',
    {
      rows: number;
      mapped: number;
      dateMin: string;
      dateMax: string;
      endpoint: string;
    }
  >;
  cities: Region[];
  files: Record<string, { sha256: string; bytes: number }>;
};
export type RegionData = { cctv: Facility[]; lights: Facility[]; pets: Pet[] };
export type Candidate = {
  id: string;
  city: string;
  lat: number;
  lng: number;
  bounds: [number, number, number, number];
  score: number;
  cctv: number;
  lights: number;
  referenceCctv: number;
  referenceLights: number;
  activeNeighbors: number;
  nearAddress: string;
};
export type Inspection = {
  checkedAt: string;
  cellMetersApprox: number;
  quality: Record<string, { eligible: boolean; reasons: string[] }>;
  candidates: Candidate[];
  method: string;
  limits: string;
};
export function gapColor(score: number) {
  return score >= 75 ? '#d96a32' : score >= 50 ? '#e69e48' : '#ecd078';
}
export type FieldReport = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  city: string;
  category: string;
  description: string;
  status: '접수' | '현장 확인' | '조치 확인' | '종료';
  created: string;
  updated: string;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  is_own?: boolean;
};
export const number = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('ko-KR');
export const date = (s: string) =>
  s?.length === 8
    ? `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`
    : s
      ? new Date(s).toLocaleDateString('ko-KR')
      : '미제공';
export function asset(path: string) {
  const base =
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('.github.io')
      ? '/smart-petrol-gyeonggi/'
      : '/';
  return base + path.replace(/^\//, '');
}
export function valid(r: {
  lat: number | null;
  lng: number | null;
}): r is { lat: number; lng: number } {
  return (
    typeof r.lat === 'number' &&
    typeof r.lng === 'number' &&
    Number.isFinite(r.lat) &&
    Number.isFinite(r.lng) &&
    r.lat > 33 &&
    r.lat < 39 &&
    r.lng > 124 &&
    r.lng < 132
  );
}
export function meters(a: Point, b: Point) {
  const rad = Math.PI / 180,
    h =
      Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
      Math.cos(a.lat * rad) *
        Math.cos(b.lat * rad) *
        Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return (
    12742017.6 *
    Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)))
  );
}
export function intersects(region: Region, p: Point, radius = 3000) {
  if (!region.bounds) return false;
  const [w, s, e, n] = region.bounds,
    dy = radius / 110000,
    dx = radius / (110000 * Math.cos((p.lat * Math.PI) / 180));
  return !(
    e < p.lng - dx ||
    w > p.lng + dx ||
    n < p.lat - dy ||
    s > p.lat + dy
  );
}
export function nearby(
  rows: Facility[],
  p: Point,
  radius: number,
  kind: Facility['kind'],
) {
  const found = rows
    .filter(
      (r) =>
        r.kind === kind &&
        valid(r) &&
        (kind === 'lights' ||
          ['생활방범', '어린이보호', '다목적', '차량방범'].some((x) =>
            r.purpose.includes(x),
          )),
    )
    .map((row) => ({ row, d: meters(p, row as Facility & Point) }))
    .filter((x) => x.d <= 3000)
    .sort((a, b) => a.d - b.d);
  const within = found.filter((x) => x.d <= radius);
  return {
    nearest: found.slice(0, 3),
    within: within.length,
    unique: new Set(within.map((x) => `${x.row.lat},${x.row.lng}`)).size,
  };
}
export function petSummary(rows: Pet[], year: string) {
  const filtered = rows.filter((r) => r.year === year);
  const validRows = filtered.filter(
    (r) => !r.ambiguous && !r.subtotal && r.animals !== null,
  );
  return {
    rows: filtered,
    known: validRows.reduce((sum, r) => sum + (r.animals || 0), 0),
    ambiguous: filtered.filter((r) => r.ambiguous).length,
    subtotals: filtered.filter((r) => r.subtotal).length,
    complete:
      filtered.length > 0 &&
      !filtered.some((r) => r.ambiguous || r.animals === null),
  };
}
export function csvCell(v: unknown) {
  let s =
    v === null || v === undefined
      ? ''
      : typeof v === 'string'
        ? v
        : typeof v === 'number' ||
            typeof v === 'boolean' ||
            typeof v === 'bigint'
          ? v.toString()
          : (JSON.stringify(v) ?? '');
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export function download(
  name: string,
  body: string,
  type = 'text/plain;charset=utf-8',
) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
