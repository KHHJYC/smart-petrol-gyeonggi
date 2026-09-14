'use client';
/* oxlint-disable react/react-compiler -- This app uses explicit effects for browser-only map mounting, snapshot loading and timers; the React compiler is not enabled. */
/* oxlint-disable next/no-img-element -- The supplied proposal image has fixed dimensions and is served as a local static asset. */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useDeferredValue,
  lazy,
  Suspense,
} from 'react';
import { usePublicMapTool } from '@/hooks/use-public-map-tool';
import {
  PawPrint,
  Map,
  Camera,
  Lightbulb,
  ArrowUpRight,
  ArrowRight,
  Search,
  MapPin,
  ChevronRight,
  Footprints,
  FileText,
  Database,
  RefreshCw,
  Download,
  Info,
  X,
  Plus,
  ClipboardCheck,
  TriangleAlert,
  Heart,
  CheckCircle2,
  Navigation,
  BookOpen,
  SlidersHorizontal,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Facility,
  Point,
  Manifest,
  RegionData,
  FieldReport,
  Inspection,
  Candidate,
  gapColor,
  number,
  date,
  asset,
  valid,
  nearby,
  intersects,
  petSummary,
  csvCell,
  download,
} from '@/lib/patrol';
import LightingContext, {
  LightingEvidence,
} from '@/components/lighting-context';
const LIGHT_TEMPLATE =
  '[조명 현장 확인]\n점등·깜빡임: 미확인\n밝기 차이·어두운 구간: 미확인\n눈부심·수목 가림: 미확인\n빛의 색(관찰값): 미확인\n조도(lx)·측정 위치·시각·기기: 미측정\n교체 이력(관리기관 확인): 미확인\n';
const LazyMap = lazy(() => import('@/components/patrol-map'));
function Atlas(props: React.ComponentProps<typeof LazyMap>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const pending = (
    <div className="map-pending">
      <span className="loader" />
      <strong>우리 동네 지도를 준비하고 있어요</strong>
      <span>CCTV와 보안등 위치를 불러옵니다.</span>
    </div>
  );
  return mounted ? (
    <Suspense fallback={pending}>
      <LazyMap {...props} />
    </Suspense>
  ) : (
    pending
  );
}
type Report = FieldReport & {
  id: string;
  observed_at: string;
  evidence: string;
  radius: number;
  cctv: number | null;
  lights: number | null;
  source_at: string;
};
type Patrol = {
  id: string;
  city: string;
  memo: string;
  checks: string;
  started: string;
  ended: string;
  seconds: number;
};
const EMPTY: RegionData = { cctv: [], lights: [], pets: [] };
const CHECKS = [
  '목줄·배변봉투 준비',
  '반려견 컨디션 확인',
  '보행자·다른 동물 배려',
];
const TYPES = [
  '보안등 꺼짐·깜빡임',
  '어두운 보행 구간',
  '보도·시설 파손',
  '시야 가림·장애물',
  '기타 생활안전',
];
const STATUSES = ['전체', '접수', '현장 확인', '조치 확인', '종료'];
function Pick({
  value,
  options,
  onChange,
  label,
  id,
}: {
  id?: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger id={id} className="pick" aria-label={label}>
        <SelectValue>{value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((v) => (
          <SelectItem key={v} value={v}>
            {v}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
function PlaceLinks({ p }: { p: Point }) {
  return (
    <div className="place-links">
      <a
        href={`https://map.kakao.com/link/map/${encodeURIComponent(p.label || '점검 지점')},${p.lat},${p.lng}`}
        target="_blank"
        rel="noreferrer"
      >
        <b className="kakao">K</b>카카오
        <ArrowUpRight size={13} />
      </a>
      <a
        href={`https://map.naver.com/v5/search/${encodeURIComponent(p.label && !p.label.includes('지점') && !p.label.includes('위치') ? p.label : `${p.lat},${p.lng}`)}`}
        target="_blank"
        rel="noreferrer"
      >
        <b className="naver">N</b>네이버
        <ArrowUpRight size={13} />
      </a>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
        target="_blank"
        rel="noreferrer"
      >
        <b className="google">G</b>구글
        <ArrowUpRight size={13} />
      </a>
    </div>
  );
}

export default function PetrolApp() {
  const [view, setView] = useState('map'),
    [manifest, setManifest] = useState<Manifest | null>(null),
    [data, setData] = useState<RegionData>(EMPTY),
    [city, setCity] = useState('성남시');
  const [loading, setLoading] = useState(true),
    [fatal, setFatal] = useState(''),
    [query, setQuery] = useState(''),
    [purpose, setPurpose] = useState('모든 목적'),
    [limit, setLimit] = useState(30);
  const search = useDeferredValue(query.trim());
  const [showCctv, setShowCctv] = useState(true),
    [showLights, setShowLights] = useState(true),
    [showReports, setShowReports] = useState(true),
    [filters, setFilters] = useState(false);
  const [point, setPoint] = useState<Point | null>(null),
    [radius, setRadius] = useState(100),
    [selected, setSelected] = useState<Facility | null>(null),
    [focus, setFocus] = useState<Point & { zoom: number; stamp: number }>({
      lat: 37.42,
      lng: 127.1267,
      zoom: 13,
      stamp: 0,
    });
  usePublicMapTool(data, city);
  const [timerRestored, setTimerRestored] = useState(false);
  const [nearRows, setNearRows] = useState<Facility[]>([]),
    [nearLoading, setNearLoading] = useState(false),
    [nearError, setNearError] = useState('');
  const [reports, setReports] = useState<Report[]>([]),
    [patrols, setPatrols] = useState<Patrol[]>([]),
    [recordsError, setRecordsError] = useState(''),
    [status, setStatus] = useState('전체');
  const [dialog, setDialog] = useState<
      'data' | 'report' | 'patrol' | 'review' | 'candidates' | null
    >(null),
    [toast, setToast] = useState(''),
    [saving, setSaving] = useState(false),
    [saveError, setSaveError] = useState('');
  const [petCity, setPetCity] = useState('성남시'),
    [petYear, setPetYear] = useState(''),
    [pets, setPets] = useState<RegionData>(EMPTY),
    [petLoading, setPetLoading] = useState(false);
  const [recordCity, setRecordCity] = useState('성남시'),
    [patrolCity, setPatrolCity] = useState('성남시');
  const [title, setTitle] = useState(''),
    [category, setCategory] = useState(TYPES[0]),
    [description, setDescription] = useState(''),
    [observedAt, setObservedAt] = useState('');
  const [checks, setChecks] = useState<string[]>([]),
    [started, setStarted] = useState<number | null>(null),
    [now, setNow] = useState(0),
    [patrolMemo, setPatrolMemo] = useState(''),
    [legacy, setLegacy] = useState<{ title: string; point: Point }[]>([]);
  const [review, setReview] = useState<Report | null>(null),
    [reviewStatus, setReviewStatus] = useState('접수'),
    [evidence, setEvidence] = useState('');
  const [inspection, setInspection] = useState<Inspection | null>(null),
    [inspectionError, setInspectionError] = useState(''),
    [showGaps, setShowGaps] = useState(true),
    [selectedGap, setSelectedGap] = useState<Candidate | null>(null);
  const [briefing, setBriefing] = useState<{
    writtenAt: string;
    sourceCheckedAt: string;
    author: string;
    items: {
      title: string;
      fact: string;
      interpretation: string;
      action: string;
    }[];
  } | null>(null);
  const cache = useRef<Record<string, Promise<RegionData>>>({}),
    seq = useRef(0);
  async function region(file: string) {
    if (!cache.current[file])
      cache.current[file] = fetch(asset('data/regions/' + file))
        .then(async (r) => {
          if (!r.ok) throw Error();
          const b = (await r.json()) as RegionData;
          if (
            !Array.isArray(b.cctv) ||
            !Array.isArray(b.lights) ||
            !Array.isArray(b.pets)
          )
            throw Error();
          return b;
        })
        .catch((e) => {
          delete cache.current[file];
          throw e;
        });
    return cache.current[file];
  }
  async function loadManifest() {
    setFatal('');
    setLoading(true);
    try {
      const r = await fetch(asset('data/manifest.json'), { cache: 'no-cache' });
      if (!r.ok) throw Error();
      const m: Manifest = await r.json();
      if (m.schemaVersion !== 2 || !Array.isArray(m.cities)) throw Error();
      cache.current = {};
      setManifest(m);
    } catch {
      setFatal(
        '공공데이터를 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.',
      );
      setLoading(false);
    }
  }
  async function loadRecords() {
    setRecordsError('');
    try {
      const r = await fetch('/api/records', { cache: 'no-store' });
      const b = (await r.json()) as {
        reports: Report[];
        patrols: Patrol[];
        error?: string;
      };
      if (!r.ok) throw Error(b.error);
      setReports(b.reports);
      setPatrols(b.patrols);
    } catch (e) {
      setRecordsError(
        e instanceof Error ? e.message : '현장 기록을 불러오지 못했습니다.',
      );
    }
  }
  useEffect(() => {
    void loadManifest();
    void loadRecords();
    try {
      const old = JSON.parse(
        localStorage.getItem('gg-safety-proposals-v1') || '[]',
      );
      if (Array.isArray(old))
        setLegacy(old.filter((x) => x?.title && x?.point));
      const draft = JSON.parse(
        sessionStorage.getItem('smart-petrol-draft') || 'null',
      );
      if (draft) {
        setTitle(String(draft.title || '').slice(0, 70));
        setDescription(String(draft.description || '').slice(0, 1600));
      }
      const timer = JSON.parse(
        sessionStorage.getItem('smart-petrol-timer') || 'null',
      );
      if (
        timer &&
        typeof timer.started === 'number' &&
        timer.started <= Date.now() &&
        Date.now() - timer.started < 86400000
      ) {
        setStarted(timer.started);
        setNow(Date.now());
        setPatrolMemo(String(timer.memo || '').slice(0, 1600));
        setPatrolCity(String(timer.city || '성남시'));
        setChecks(
          Array.isArray(timer.checks)
            ? timer.checks.filter((c: string) => CHECKS.includes(c))
            : [],
        );
      }
    } catch {}
    setTimerRestored(true);
  }, []);
  useEffect(() => {
    if (!manifest) return;
    setInspectionError('');
    setInspection(null);
    setBriefing(null);
    fetch(asset('data/briefing.json'))
      .then((r) => r.json())
      .then((b) => setBriefing(b as NonNullable<typeof briefing>))
      .catch(() => {});
    fetch(asset('data/inspection.json'))
      .then(async (r) => {
        if (!r.ok) throw Error();
        return (await r.json()) as Inspection;
      })
      .then(setInspection)
      .catch(() => setInspectionError('점검 후보 자료를 불러오지 못했습니다.'));
  }, [manifest]);
  useEffect(() => {
    if (!manifest) return;
    let current = true;
    setLoading(true);
    setData(EMPTY);
    setLimit(30);
    setPoint(null);
    setSelected(null);
    seq.current++;
    const r = manifest.cities.find((r) => r.name === city);
    if (!r) {
      setLoading(false);
      return;
    }
    region(r.file)
      .then((d) => {
        if (current) setData(d);
      })
      .catch(() => {
        if (current)
          setFatal(
            '지역 자료를 불러오지 못했어요. 다시 불러오기를 눌러 주세요.',
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [city, manifest]);
  useEffect(() => {
    if (!manifest) return;
    let current = true;
    setPetLoading(true);
    setPets(EMPTY);
    const r = manifest.cities.find((r) => r.name === petCity);
    if (!r) {
      setPetLoading(false);
      return;
    }
    setPetYear(r.latestPetYear || '');
    region(r.file)
      .then((d) => {
        if (current) setPets(d);
      })
      .catch(() => {
        if (current) setToast('반려동물 자료를 불러오지 못했어요.');
      })
      .finally(() => {
        if (current) setPetLoading(false);
      });
    return () => {
      current = false;
    };
  }, [petCity, manifest]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    setLimit(30);
  }, [search, purpose, showCctv, showLights]);
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [started]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        'smart-petrol-draft',
        JSON.stringify({ title, description }),
      );
    } catch {}
  }, [title, description]);
  useEffect(() => {
    if (!timerRestored) return;
    try {
      if (started)
        sessionStorage.setItem(
          'smart-petrol-timer',
          JSON.stringify({
            started,
            memo: patrolMemo,
            city: patrolCity,
            checks,
          }),
        );
      else sessionStorage.removeItem('smart-petrol-timer');
    } catch {}
  }, [timerRestored, started, patrolMemo, patrolCity, checks]);
  function chooseCity(name: string) {
    setCity(name);
    setQuery('');
    setFatal('');
    const r = manifest?.cities.find((r) => r.name === name);
    setFocus({
      lat: r?.center[0] ?? 37.53,
      lng: r?.center[1] ?? 127.12,
      zoom: name === '경기도 전체' ? 9 : 13,
      stamp: Date.now(),
    });
  }
  async function choosePoint(p: Point) {
    if (!manifest) return;
    setPoint(p);
    setSelectedGap(null);
    setSelected(null);
    setNearLoading(true);
    setNearError('');
    setNearRows([]);
    const id = ++seq.current;
    try {
      const blocks = await Promise.all(
        manifest.cities
          .filter((r) => intersects(r, p))
          .map((r) => region(r.file)),
      );
      if (id === seq.current)
        setNearRows(blocks.flatMap((r) => [...r.cctv, ...r.lights]));
    } catch {
      if (id === seq.current)
        setNearError(
          '일부 주변 자료를 불러오지 못해 분석을 표시하지 않습니다. 다시 지점을 선택해 주세요.',
        );
    } finally {
      if (id === seq.current) setNearLoading(false);
    }
  }
  function chooseFacility(r: Facility) {
    setSelected(r);
    if (valid(r))
      setFocus({ lat: r.lat, lng: r.lng, zoom: 17, stamp: Date.now() });
  }
  const filtered = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    return [
      ...(showCctv ? data.cctv : []),
      ...(showLights ? data.lights : []),
    ].filter(
      (r) =>
        (r.kind === 'lights' ||
          purpose === '모든 목적' ||
          r.purpose.includes(purpose)) &&
        words.every((w) =>
          (r.address + ' ' + r.name + ' ' + r.agency).toLowerCase().includes(w),
        ),
    );
  }, [data, showCctv, showLights, purpose, search]);
  const mapRows = useMemo(() => filtered.filter(valid), [filtered]);
  const analysis = useMemo(
    () =>
      point
        ? {
            cctv: nearby(nearRows, point, radius, 'cctv'),
            lights: nearby(nearRows, point, radius, 'lights'),
          }
        : null,
    [nearRows, point, radius],
  );
  const petRegion = manifest?.cities.find((r) => r.name === petCity),
    petStats = useMemo(() => petSummary(pets.pets, petYear), [pets, petYear]);
  const visibleReports = useMemo(
    () =>
      reports.filter(
        (r) =>
          (city === '경기도 전체' || r.city === city) &&
          (status === '전체' || r.status === status),
      ),
    [reports, city, status],
  );
  const mapReports = useMemo(
    () =>
      showReports
        ? reports.filter((r) => city === '경기도 전체' || r.city === city)
        : [],
    [reports, city, showReports],
  );
  const cities = manifest?.cities
    .filter((c) => c.name !== '지역 미확인')
    .map((c) => c.name) || ['성남시'];
  const gapCandidates = useMemo(
    () =>
      inspection?.checkedAt === manifest?.checkedAt
        ? inspection?.candidates.filter(
            (c) => city === '경기도 전체' || c.city === city,
          ) || []
        : [],
    [inspection, city, manifest],
  );
  const mapCandidates = useMemo(
    () => (showGaps ? gapCandidates : []),
    [showGaps, gapCandidates],
  );
  function chooseCandidate(c: Candidate) {
    void choosePoint({
      lat: c.lat,
      lng: c.lng,
      label: c.city + ' 시설 점검 후보 구획',
    });
    setSelectedGap(c);
    setFocus({ lat: c.lat, lng: c.lng, zoom: 16, stamp: Date.now() });
    setDialog(null);
  }
  const elapsed = started ? Math.max(0, Math.floor((now - started) / 1000)) : 0;
  function openReport() {
    if (!point) {
      setToast('지도에서 기록할 지점을 선택해 주세요.');
      setView('map');
      return;
    }
    const choices = [
      ...(analysis?.cctv.nearest || []),
      ...(analysis?.lights.nearest || []),
    ].sort((a, b) => a.d - b.d);
    setRecordCity(
      choices[0]?.row.city || (city === '경기도 전체' ? '성남시' : city),
    );
    const d = new Date();
    setObservedAt(
      new Date(d.getTime() - d.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16),
    );
    setSaveError('');
    setDialog('report');
  }
  async function save(body: unknown, method: 'POST' | 'PATCH' = 'POST') {
    setSaving(true);
    setSaveError('');
    try {
      const r = await fetch('/api/records', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const b = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(b.error || '저장하지 못했습니다.');
      await loadRecords();
      return true;
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '저장하지 못했습니다.');
      return false;
    } finally {
      setSaving(false);
    }
  }
  function reportText(r?: Report) {
    return r
      ? `${r.title}\n${r.city} / ${r.lat}, ${r.lng}\n${r.category} / 관찰 ${r.observed_at}\n\n${r.description}\n\n확인 상태: ${r.status}\n확인 근거: ${r.evidence || '미작성'}\n반경 ${r.radius}m / CCTV ${r.cctv ?? '미확인'}개 좌표 / 보안등 ${r.lights ?? '미확인'}개 좌표\n자료 확인: ${r.source_at}\n설치 자료는 실제 촬영범위·조도·범죄위험을 뜻하지 않습니다.`
      : `${title}\n${point?.lat}, ${point?.lng}\n${category} / 관찰 ${observedAt}\n\n${description}`;
  }
  function exportFacilities() {
    const rows = [
      [
        '유형',
        '시군',
        '주소',
        '위도',
        '경도',
        '설치수(원본)',
        '기준일',
        '관리기관',
      ],
      ...filtered.map((r) => [
        r.kind === 'cctv' ? 'CCTV' : '보안등',
        r.city,
        r.address,
        r.lat,
        r.lng,
        r.count,
        r.date,
        r.agency,
      ]),
    ];
    download(
      `스마트펫트롤_${city}_시설.csv`,
      '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'),
      'text/csv;charset=utf-8',
    );
  }
  return (
    <>
      <a className="skip-link" href="#main-content">
        본문 바로가기
      </a>
      <div className="app-shell">
        <header className="masthead">
          <a className="brand" href={asset('')}>
            <span className="brand-symbol">
              <PawPrint size={25} />
            </span>
            <span>
              <strong>
                스마트펫트롤<span className="brand-period">.</span>
              </strong>
              <small>우리동네 안전지킴이</small>
            </span>
          </a>
          <div className="header-note">
            <span className="live-dot" />
            산책이 만드는 작은 변화
          </div>
          <div className="header-actions">
            <button
              className="round-icon"
              aria-label="데이터 연결 현황"
              onClick={() => setDialog('data')}
            >
              <Database size={20} />
            </button>
            <button
              className="btn primary small"
              onClick={() => {
                setSaveError('');
                setDialog('patrol');
              }}
            >
              <Footprints size={17} />
              순찰 시작
            </button>
          </div>
        </header>
        <Tabs
          value={view}
          onValueChange={(v) => setView(String(v))}
          className="app-tabs"
        >
          <div className="navigation-bar">
            <TabsList className="main-navigation">
              <TabsTrigger value="map">
                <Map size={17} />
                안심지도
              </TabsTrigger>
              <TabsTrigger value="patrol">
                <Footprints size={17} />
                순찰 · 기록
              </TabsTrigger>
              <TabsTrigger value="region">
                <PawPrint size={17} />
                지역 현황
              </TabsTrigger>
              <TabsTrigger value="guide">
                <BookOpen size={17} />
                활동 안내
              </TabsTrigger>
            </TabsList>
            <span className="province-label">
              <MapPin size={14} />
              GYEONGGI · 31개 시군
            </span>
          </div>
          <main id="main-content">
            <TabsContent value="map">
              <section className="workspace-heading">
                <div>
                  <p className="eyebrow">EVERYDAY WALK, SAFER NEIGHBORHOOD</p>
                  <h1>
                    산책하는 길, <span>함께 살펴볼까요?</span>
                  </h1>
                  <p className="muted">
                    CCTV와 보안등을 확인하고, 우리 동네에 필요한 변화를
                    기록하세요.
                  </p>
                </div>
                <div className="quick-summary">
                  <div>
                    <span className="stat-icon blue">
                      <Camera size={19} />
                    </span>
                    <span>
                      <strong>{number(manifest?.sources.cctv.rows)}</strong>
                      <small>CCTV 등록자료</small>
                    </span>
                  </div>
                  <div>
                    <span className="stat-icon amber">
                      <Lightbulb size={19} />
                    </span>
                    <span>
                      <strong>{number(manifest?.sources.lights.rows)}</strong>
                      <small>보안등 등록자료</small>
                    </span>
                  </div>
                </div>
              </section>
              <div className="map-workspace">
                <aside className="search-panel">
                  <div className="panel-title">
                    <h2>어느 동네를 살펴볼까요?</h2>
                    <button
                      className="round-icon"
                      aria-label="필터 펼치기"
                      aria-expanded={filters}
                      onClick={() => setFilters(!filters)}
                    >
                      <SlidersHorizontal size={17} />
                    </button>
                  </div>
                  <Pick
                    label="지도 시군 선택"
                    value={city}
                    options={['경기도 전체', ...cities]}
                    onChange={chooseCity}
                  />
                  <form
                    className="search-field"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const found = cities.find((c) => search.includes(c));
                      if (found && found !== city) {
                        chooseCity(found);
                        return;
                      }
                      const first = mapRows[0];
                      if (first)
                        setFocus({
                          lat: first.lat!,
                          lng: first.lng!,
                          zoom: 16,
                          stamp: Date.now(),
                        });
                      else setToast('다른 동네 이름이나 주소로 검색해 주세요.');
                    }}
                  >
                    <Search size={17} />
                    <input
                      aria-label="시군·동네·주소 검색"
                      placeholder={
                        city === '경기도 전체'
                          ? '시군 이름 검색'
                          : '동네 · 도로명 · 시설 검색'
                      }
                      maxLength={100}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    <button type="submit" aria-label="검색 위치로 이동">
                      <ArrowRight size={15} />
                    </button>
                    {query && (
                      <button
                        type="button"
                        aria-label="검색어 지우기"
                        onClick={() => setQuery('')}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </form>
                  <div className="layer-options">
                    <label htmlFor="layer-cctv">
                      <span className="legend-dot cctv" />
                      <Camera size={16} />
                      <span>CCTV</span>
                      <Switch
                        id="layer-cctv"
                        checked={showCctv}
                        onCheckedChange={setShowCctv}
                        aria-label="CCTV 표시"
                      />
                    </label>
                    <label htmlFor="layer-lights">
                      <span className="legend-dot lights" />
                      <Lightbulb size={16} />
                      <span>보안등</span>
                      <Switch
                        id="layer-lights"
                        checked={showLights}
                        onCheckedChange={setShowLights}
                        aria-label="보안등 표시"
                      />
                    </label>
                    <label htmlFor="layer-report">
                      <span className="legend-dot report" />
                      <MapPin size={16} />
                      <span>현장 기록</span>
                      <Switch
                        id="layer-report"
                        checked={showReports}
                        onCheckedChange={setShowReports}
                        aria-label="현장 기록 표시"
                      />
                    </label>
                  </div>
                  <div className="gap-layer">
                    <label htmlFor="layer-gap">
                      <span className="gap-swatch" />
                      <span>시설 점검 후보</span>
                      <Switch
                        id="layer-gap"
                        checked={showGaps}
                        onCheckedChange={setShowGaps}
                        aria-label="시설 점검 후보 그라데이션"
                      />
                    </label>
                    <button
                      className="text-button"
                      onClick={() => setDialog('candidates')}
                    >
                      위치 목록 {number(gapCandidates.length)}개
                      <ChevronRight size={14} />
                    </button>
                    {inspection?.quality[city] &&
                      !inspection.quality[city].eligible && (
                        <p>자료 부족으로 이 지역의 후보 산출을 보류했어요.</p>
                      )}
                    {inspectionError && <p>{inspectionError}</p>}
                  </div>
                  {filters && (
                    <div className="extra-filter">
                      <p className="field-label">CCTV 설치 목적</p>
                      <Pick
                        label="CCTV 설치 목적"
                        value={purpose}
                        options={[
                          '모든 목적',
                          '생활방범',
                          '어린이보호',
                          '다목적',
                          '차량방범',
                        ]}
                        onChange={setPurpose}
                      />
                      <p>주변 분석은 생활안전 관련 CCTV를 사용합니다.</p>
                    </div>
                  )}
                  {city === '수원시' && (
                    <div className="callout warning">
                      <Info size={17} />
                      <p>
                        CCTV 수록 자료가 매우 적고 관리기관도 상충합니다. 시설
                        공백 판단에 사용할 수 없습니다.
                      </p>
                    </div>
                  )}
                  {fatal ? (
                    <div className="empty-state" role="alert">
                      <TriangleAlert />
                      <p>{fatal}</p>
                      <button className="btn secondary" onClick={loadManifest}>
                        다시 불러오기
                      </button>
                    </div>
                  ) : loading ? (
                    <div className="empty-state">
                      <span className="loader" />
                      <p>지역 시설을 불러오는 중이에요.</p>
                    </div>
                  ) : city === '경기도 전체' ? (
                    <>
                      <div className="section-heading">
                        <h3>31개 시군</h3>
                        <span>지역을 선택하세요</span>
                      </div>
                      <div className="region-grid">
                        {cities.map((c) => (
                          <button key={c} onClick={() => chooseCity(c)}>
                            {c}
                            <ChevronRight size={13} />
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="section-heading">
                        <h3>
                          시설 목록 <b>{number(filtered.length)}</b>
                        </h3>
                        <button
                          className="round-icon"
                          aria-label="시설 목록 CSV 내려받기"
                          onClick={exportFacilities}
                        >
                          <Download size={16} />
                        </button>
                      </div>
                      <p className="result-caption">
                        지도 표시 {number(mapRows.length)}건 · 선택 시군 주소
                        검색
                      </p>
                      <div className="facility-list">
                        {filtered.slice(0, limit).map((r) => (
                          <button
                            key={r.id}
                            className="facility-row"
                            onClick={() => chooseFacility(r)}
                          >
                            <span className={'facility-icon ' + r.kind}>
                              {r.kind === 'cctv' ? (
                                <Camera size={17} />
                              ) : (
                                <Lightbulb size={17} />
                              )}
                            </span>
                            <span>
                              <strong>{r.name || r.purpose || '보안등'}</strong>
                              <span>{r.address || '주소 미제공'}</span>
                              <small>
                                {date(r.date)}
                                {!valid(r) ? ' · 좌표 미제공' : ''}
                              </small>
                            </span>
                            <ChevronRight size={14} />
                          </button>
                        ))}
                      </div>
                      {!filtered.length && (
                        <div className="empty-state">
                          <Search />
                          <p>일치하는 시설이 없어요.</p>
                          <button
                            className="text-button"
                            onClick={() => {
                              setQuery('');
                              setPurpose('모든 목적');
                              setShowCctv(true);
                              setShowLights(true);
                            }}
                          >
                            검색 조건 초기화
                          </button>
                        </div>
                      )}
                      {filtered.length > limit && (
                        <button
                          className="btn more"
                          onClick={() => setLimit(limit + 30)}
                        >
                          30건 더 보기
                          <Plus size={16} />
                        </button>
                      )}
                    </>
                  )}
                  <button
                    className="data-stamp"
                    onClick={() => setDialog('data')}
                  >
                    <span className="live-dot" />
                    <span>
                      경기데이터드림 API
                      <br />
                      <small>
                        {manifest
                          ? '확인 ' + date(manifest.checkedAt)
                          : '연결 중'}
                      </small>
                    </span>
                    <Info size={15} />
                  </button>
                </aside>
                <section className="map-panel" aria-label="안심지도">
                  <Atlas
                    candidates={mapCandidates}
                    onCandidate={chooseCandidate}
                    rows={mapRows}
                    reports={mapReports}
                    overview={
                      city === '경기도 전체' ? manifest?.cities || [] : null
                    }
                    onCity={chooseCity}
                    onSelect={chooseFacility}
                    onPoint={choosePoint}
                    focus={focus}
                    point={point}
                    radius={radius}
                    onError={setToast}
                  />
                  <div className="map-location">
                    <span className="live-dot" />
                    <strong>{city}</strong>
                    <span>시설 위치 지도</span>
                  </div>
                  <div className="map-help">
                    <MapPin size={16} />
                    {point
                      ? '선택 지점 주변을 확인하고 기록해 보세요.'
                      : '지도를 누르면 주변 CCTV와 보안등을 확인할 수 있어요.'}
                  </div>
                  {showGaps && (
                    <div className="gap-legend">
                      <strong>시설 점검 참고</strong>
                      <span />
                      <div>
                        <small>상대 부족 낮음</small>
                        <small>높음</small>
                      </div>
                      <p>
                        약 250m 구획 · 확대 시 표시
                        <br />
                        범죄위험도가 아닙니다.
                      </p>
                    </div>
                  )}
                </section>
                <aside className="insight-panel">
                  <div className="panel-title">
                    <h2>
                      <Navigation size={17} />
                      주변 살펴보기
                    </h2>
                    <span className="pill teal">현장 점검</span>
                  </div>
                  {!point ? (
                    <div className="point-intro">
                      <div className="orbit">
                        <MapPin size={33} />
                        <span />
                        <i />
                      </div>
                      <h3>평소 걷던 그 길부터.</h3>
                      <p>
                        궁금한 지점을 선택하면
                        <br />
                        주변 안전시설을 함께 보여드려요.
                      </p>
                      <button
                        className="btn secondary"
                        onClick={() =>
                          choosePoint({ ...focus, label: city + ' 지도 중심' })
                        }
                      >
                        지도 중심 확인
                        <ArrowRight size={16} />
                      </button>
                      <div className="mini-steps">
                        <span>
                          <b>1</b>위치 선택
                        </span>
                        <span>
                          <b>2</b>현장 확인
                        </span>
                        <span>
                          <b>3</b>기록
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="point-address">
                        <MapPin size={17} />
                        <div>
                          <strong>{point.label}</strong>
                          <small>
                            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                          </small>
                        </div>
                        <button
                          className="round-icon"
                          aria-label="선택 지점 닫기"
                          onClick={() => {
                            seq.current++;
                            setPoint(null);
                          }}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      {selectedGap && (
                        <div className="selected-gap">
                          <span className="pill amber">
                            구획 비교 · 참고 지표
                          </span>
                          <h3>
                            {selectedGap.score}
                            <small>점 / 100</small>
                          </h3>
                          <p>
                            구획 내 CCTV {selectedGap.cctv} · 보안등{' '}
                            {selectedGap.lights}개 좌표
                            <br />
                            주변 8구획 평균 {selectedGap.referenceCctv} ·{' '}
                            {selectedGap.referenceLights}개
                          </p>
                          <small>
                            인근 기준 주소:{' '}
                            {selectedGap.nearAddress || '미제공'}
                            <br />
                            구획 중심 위치입니다. 보행로와 실제 시설을
                            확인하세요.
                          </small>
                        </div>
                      )}
                      <div className="radius-control">
                        <div className="radius-label">
                          주변 확인 반경<strong>{radius} m</strong>
                        </div>
                        <Slider
                          value={[radius]}
                          min={50}
                          max={500}
                          step={50}
                          aria-label="주변 확인 반경"
                          onValueChange={(v) =>
                            setRadius(Array.isArray(v) ? v[0] : v)
                          }
                        />
                        <div>
                          <span>50 m</span>
                          <span>500 m</span>
                        </div>
                      </div>
                      {nearLoading ? (
                        <div className="empty-state">
                          <span className="loader" />
                          <p>인접 시군까지 함께 확인하고 있어요.</p>
                        </div>
                      ) : nearError ? (
                        <div className="callout warning">{nearError}</div>
                      ) : (
                        analysis && (
                          <>
                            <div className="nearby-stats">
                              {(['cctv', 'lights'] as const).map((k) => (
                                <div key={k}>
                                  <span
                                    className={
                                      'stat-icon ' +
                                      (k === 'cctv' ? 'blue' : 'amber')
                                    }
                                  >
                                    {k === 'cctv' ? (
                                      <Camera size={18} />
                                    ) : (
                                      <Lightbulb size={18} />
                                    )}
                                  </span>
                                  <span>
                                    {k === 'cctv' ? '생활안전 CCTV' : '보안등'}
                                  </span>
                                  <strong>
                                    {number(analysis[k].unique)}
                                    <small>개 좌표</small>
                                  </strong>
                                  <p>등록자료 {number(analysis[k].within)}건</p>
                                </div>
                              ))}
                            </div>
                            {(['cctv', 'lights'] as const).map((k) => (
                              <div className="closest" key={k}>
                                <span>
                                  가까운 {k === 'cctv' ? 'CCTV' : '보안등'}
                                </span>
                                <strong>
                                  {analysis[k].nearest[0]
                                    ? number(
                                        Math.round(analysis[k].nearest[0].d),
                                      ) + ' m'
                                    : '3km 내 자료 없음'}
                                </strong>
                              </div>
                            ))}
                            <div className="callout">
                              <Info size={16} />
                              <p>
                                직선거리로 확인한 설치 자료입니다. 실제
                                밝기·촬영범위와 자료 누락 여부는 현장에서
                                확인하세요.
                              </p>
                            </div>
                            <button
                              className="btn primary full"
                              onClick={openReport}
                            >
                              <Plus size={17} />
                              이곳 현장 기록하기
                            </button>
                            <PlaceLinks p={point} />
                          </>
                        )
                      )}
                    </>
                  )}
                  <div className="patrol-reminder">
                    <PawPrint size={23} />
                    <div>
                      <strong>오늘의 펫티켓</strong>
                      <p>목줄과 배변봉투, 서로를 배려하는 산책.</p>
                    </div>
                    <Heart size={16} />
                  </div>
                </aside>
              </div>
              <div className="map-footnote">
                <span>
                  시설 부족이나 빈 지도만으로 범죄위험을 판단하지 않습니다.
                </span>
                <button
                  className="text-button"
                  onClick={() => setDialog('data')}
                >
                  자료와 분석 기준
                  <ArrowUpRight size={14} />
                </button>
              </div>
            </TabsContent>

            <TabsContent value="patrol">
              <div className="content-page">
                <section className="page-heading">
                  <div>
                    <p className="eyebrow">WALK · NOTICE · CHANGE</p>
                    <h1>
                      일상의 산책이 <span>동네의 변화로.</span>
                    </h1>
                    <p className="muted">
                      발견한 시설 문제를 기록하고, 확인과 조치 과정을 남겨
                      주세요.
                    </p>
                  </div>
                  <button
                    className="btn primary"
                    onClick={() => {
                      setSaveError('');
                      setDialog('patrol');
                    }}
                  >
                    <Footprints size={18} />
                    {started ? '진행 중인 순찰' : '오늘 순찰 시작'}
                  </button>
                </section>
                <div className="patrol-top">
                  <div className="journey-card">
                    <span className="pill pale">
                      <PawPrint size={14} />
                      SMART PET-TROL
                    </span>
                    <h2>
                      매일 걷는 길이니까,
                      <br />
                      작은 변화도 알아챌 수 있어요.
                    </h2>
                    <p>목줄을 챙기고, 길을 살피고, 필요한 곳을 기록해요.</p>
                    <div className="journey-steps">
                      <span>
                        <b>01</b>펫티켓 준비
                      </span>
                      <ArrowRight size={16} />
                      <span>
                        <b>02</b>산책 · 관찰
                      </span>
                      <ArrowRight size={16} />
                      <span>
                        <b>03</b>기록 · 확인
                      </span>
                    </div>
                    <div className="gradient-orb" />
                  </div>
                  <div className="impact-card">
                    <h3>함께 쌓아가는 현장 기록</h3>
                    <div className="impact-numbers">
                      <div>
                        <strong>{number(reports.length)}</strong>
                        <span>현장 기록</span>
                      </div>
                      <div>
                        <strong>
                          {number(
                            reports.filter((r) => r.status === '조치 확인')
                              .length,
                          )}
                        </strong>
                        <span>조치 확인</span>
                      </div>
                      <div>
                        <strong>{number(patrols.length)}</strong>
                        <span>순찰일지</span>
                      </div>
                    </div>
                    <p>현재 계정에 저장한 실제 기록을 집계합니다.</p>
                  </div>
                </div>
                <section className="reports-card">
                  <div className="section-heading large">
                    <div>
                      <h2>우리 동네 현장 기록</h2>
                      <p>접수 → 현장 확인 → 조치 확인</p>
                    </div>
                    <div className="inline-controls">
                      <Pick
                        label="기록 시군"
                        value={city}
                        options={['경기도 전체', ...cities]}
                        onChange={chooseCity}
                      />
                      <button
                        className="round-icon"
                        aria-label="기록 새로고침"
                        onClick={loadRecords}
                      >
                        <RefreshCw size={18} />
                      </button>
                    </div>
                  </div>
                  <div className="status-filters">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        className={status === s ? 'active' : ''}
                        onClick={() => setStatus(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  {recordsError ? (
                    <div className="callout warning">{recordsError}</div>
                  ) : !visibleReports.length ? (
                    <div className="empty-state large">
                      <span className="empty-symbol">
                        <ClipboardCheck size={33} />
                      </span>
                      <h3>첫 현장 기록을 기다리고 있어요.</h3>
                      <p>
                        꺼진 보안등이나 파손된 시설을 발견했다면
                        <br />
                        지도에서 위치를 선택해 기록해 주세요.
                      </p>
                      <button
                        className="btn secondary"
                        onClick={() => setView('map')}
                      >
                        지도에서 지점 찾기
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="report-grid">
                      {visibleReports.map((r) => (
                        <article className="report-card" key={r.id}>
                          <div>
                            <span
                              className={
                                'pill ' +
                                (r.status === '조치 확인'
                                  ? 'teal'
                                  : r.status === '현장 확인'
                                    ? 'amber'
                                    : 'rose')
                              }
                            >
                              {r.status}
                            </span>
                            <small>{date(r.created)}</small>
                          </div>
                          <h3>{r.title}</h3>
                          {r.moderation_status === 'pending' && (
                            <p className="evidence-text">공개 승인 대기 · 작성자에게만 보입니다.</p>
                          )}
                          {r.moderation_status === 'rejected' && (
                            <p className="evidence-text">비공개 처리 · 내용을 확인해 주세요.</p>
                          )}
                          <p>{r.description}</p>
                          {r.evidence && (
                            <p className="evidence-text">
                              확인 근거 · {r.evidence}
                            </p>
                          )}
                          <div className="report-meta">
                            <span>
                              <MapPin size={13} />
                              {r.city}
                            </span>
                            <span>{r.category}</span>
                          </div>
                          <div className="report-card-actions">
                            <button
                              className="text-button"
                              onClick={() => {
                                setView('map');
                                setFocus({
                                  lat: r.lat,
                                  lng: r.lng,
                                  zoom: 17,
                                  stamp: Date.now(),
                                });
                                void choosePoint({
                                  lat: r.lat,
                                  lng: r.lng,
                                  label: r.title,
                                });
                              }}
                            >
                              지도 보기
                              <ArrowRight size={14} />
                            </button>
                            {r.is_own !== false && (
                              <button
                                className="text-button"
                                onClick={() => {
                                  setReview(r);
                                  setReviewStatus(r.status);
                                  setEvidence(r.evidence);
                                  setSaveError('');
                                  setDialog('review');
                                }}
                              >
                                기록 · 확인 상태
                                <ChevronRight size={14} />
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
                <div className="two-columns">
                  <section className="white-card">
                    <div className="section-heading">
                      <h2>순찰일지</h2>
                      <Footprints size={20} />
                    </div>
                    {!patrols.length ? (
                      <p className="muted padded">
                        아직 저장한 순찰일지가 없어요. 순찰을 마치고 오늘의
                        관찰을 남겨 보세요.
                      </p>
                    ) : (
                      patrols.map((p) => (
                        <article className="log-row" key={p.id}>
                          <Footprints size={18} />
                          <div>
                            <strong>
                              {p.city} · {Math.floor(p.seconds / 60)}분 순찰
                            </strong>
                            <small>{date(p.ended)}</small>
                            <p>{p.memo}</p>
                          </div>
                          <button
                            aria-label="순찰일지 내려받기"
                            className="round-icon"
                            onClick={() =>
                              download(
                                '순찰일지.txt',
                                `${p.city}\n${p.started} ~ ${p.ended}\n${p.memo}`,
                              )
                            }
                          >
                            <Download size={17} />
                          </button>
                        </article>
                      ))
                    )}
                  </section>
                  <section className="white-card report-download">
                    <FileText size={25} />
                    <h2>활동을 보고자료로 정리하세요.</h2>
                    <p>
                      현장 기록과 확인 근거, 데이터 기준을 함께 담아 인쇄하거나
                      PDF로 보관할 수 있어요.
                    </p>
                    <div>
                      <button
                        className="btn secondary"
                        onClick={() => window.print()}
                      >
                        <FileText size={16} />
                        인쇄 · PDF
                      </button>
                      <button
                        className="btn secondary"
                        onClick={() =>
                          download(
                            '스마트펫트롤_활동기록.json',
                            JSON.stringify({ reports, patrols }, null, 2),
                            'application/json',
                          )
                        }
                      >
                        <Download size={16} />
                        기록 내려받기
                      </button>
                    </div>
                    {legacy.length > 0 && (
                      <button
                        className="text-button"
                        onClick={() =>
                          download(
                            '이전_검토메모.json',
                            JSON.stringify(legacy, null, 2),
                            'application/json',
                          )
                        }
                      >
                        이전 브라우저 메모 {legacy.length}건 내려받기
                      </button>
                    )}
                  </section>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="region">
              <div className="content-page">
                <section className="page-heading">
                  <div>
                    <p className="eyebrow">LOCAL DATA, LOCAL PARTICIPATION</p>
                    <h1>
                      우리 동네의 <span>참여 가능성을 살펴봐요.</span>
                    </h1>
                    <p className="muted">
                      기준연도별 반려동물 등록 실적을 순찰대 모집과 지역 이해의
                      참고자료로 활용합니다.
                    </p>
                  </div>
                  <span className="pill teal">
                    <Database size={15} />
                    경기도 연도별 등록 실적
                  </span>
                </section>
                <div className="region-layout">
                  <aside className="white-card region-pickers">
                    <h2>지역 · 기준연도 선택</h2>
                    <p className="field-label">시군</p>
                    <Pick
                      label="반려동물 시군"
                      value={petCity}
                      options={cities}
                      onChange={setPetCity}
                    />
                    <p className="field-label">기준연도</p>
                    {petYear ? (
                      <Pick
                        label="반려동물 기준연도"
                        value={petYear}
                        options={[...(petRegion?.petYears || [])].reverse()}
                        onChange={setPetYear}
                      />
                    ) : (
                      <div className="callout">수록된 연도가 없습니다.</div>
                    )}
                    <div className="callout">
                      <Info size={16} />
                      <p>
                        지역마다 수록 연도가 달라요. 같은 연도를 선택해서 비교해
                        주세요.
                      </p>
                    </div>
                    <div className="region-note">
                      <PawPrint size={26} />
                      <h3>모집의 가능성을 살피는 자료</h3>
                      <p>
                        이 자료는 선택한 연도의 등록 실적입니다. 누적 등록 총수나
                        현재 사육 중인 동물 수가 아니며, 개·고양이도 구분하지
                        않습니다.
                      </p>
                    </div>
                    <button
                      className="btn secondary full"
                      onClick={() => {
                        chooseCity(petCity);
                        setView('map');
                      }}
                    >
                      이 지역 지도 보기
                      <ArrowRight size={16} />
                    </button>
                  </aside>
                  <section className="white-card pet-statistics">
                    <div className="section-heading large">
                      <div>
                        <h2>{petCity} 반려동물 연도별 등록 실적</h2>
                        <p>{petYear ? petYear + '년 자료' : '자료 미수록'}</p>
                      </div>
                      <span className="stat-icon teal">
                        <PawPrint size={23} />
                      </span>
                    </div>
                    {petLoading ? (
                      <div className="empty-state">
                        <span className="loader" />
                        지역 통계 불러오는 중
                      </div>
                    ) : !petStats.rows.length ? (
                      <div className="empty-state large">
                        <Database size={33} />
                        <h3>해당 지역의 수록 자료가 없어요.</h3>
                        <p>미수록은 등록동물이 없다는 뜻이 아닙니다.</p>
                      </div>
                    ) : (
                      <>
                        <div className="pet-headline">
                          <div>
                            <span>
                              {petStats.ambiguous
                                ? '중복 의심·합계 행을 제외한 선택 연도 참고 합계'
                                : '선택 연도 수록 읍면동 등록 실적 합계'}
                            </span>
                            <strong>
                              {number(petStats.known)}
                              <small>마리</small>
                            </strong>
                          </div>
                          <div>
                            <strong>{number(petStats.rows.length)}</strong>
                            <span>수록 행</span>
                          </div>
                        </div>
                        <div className="callout">
                          <Info size={18} />
                          <p>
                            경기데이터드림은 기준연도별 등록 실적을 제공합니다.
                            다른 자료의 누적 등록 수치와는 집계 범위가 달라 직접
                            비교할 수 없습니다.
                          </p>
                        </div>
                        {petStats.ambiguous > 0 && (
                          <div className="callout warning">
                            <TriangleAlert size={18} />
                            <p>
                              중복 의심 {petStats.ambiguous}행은 합계에서
                              제외했습니다. 지역 전체 총수로 사용하기 전 누락
                              여부를 확인하세요.
                            </p>
                          </div>
                        )}
                        <div className="pet-chart">
                          {petStats.rows
                            .filter(
                              (r) =>
                                !r.ambiguous &&
                                !r.subtotal &&
                                r.animals !== null,
                            )
                            .sort((a, b) => (b.animals || 0) - (a.animals || 0))
                            .slice(0, 8)
                            .map((r) => (
                              <div key={r.id}>
                                <label>{r.town}</label>
                                <span>
                                  <i
                                    style={{
                                      width:
                                        Math.max(
                                          2,
                                          ((r.animals || 0) /
                                            Math.max(
                                              1,
                                              ...petStats.rows
                                                .filter(
                                                  (x) =>
                                                    !x.ambiguous && !x.subtotal,
                                                )
                                                .map((x) => x.animals || 0),
                                            )) *
                                            100,
                                        ) + '%',
                                    }}
                                  />
                                </span>
                                <b>{number(r.animals)}</b>
                              </div>
                            ))}
                        </div>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>읍면동</th>
                                <th>해당 연도 등록동물</th>
                                <th>소유자</th>
                                <th>자료 기준일</th>
                                <th>확인 상태</th>
                              </tr>
                            </thead>
                            <tbody>
                              {petStats.rows.map((r) => (
                                <tr key={r.id}>
                                  <td>{r.town}</td>
                                  <td>{number(r.animals)}</td>
                                  <td>{number(r.owners)}</td>
                                  <td>{date(r.date)}</td>
                                  <td>
                                    <span
                                      className={
                                        'pill ' +
                                        (r.ambiguous
                                          ? 'amber'
                                          : r.subtotal
                                            ? 'gray'
                                            : 'teal')
                                      }
                                    >
                                      {r.ambiguous
                                        ? '중복 의심'
                                        : r.subtotal
                                          ? '합계 제외'
                                          : '수록 자료'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </section>
                </div>
                <LightingContext key={manifest?.checkedAt} city={petCity} />
                <LightingEvidence />
              </div>
            </TabsContent>

            <TabsContent value="guide">
              <div className="content-page">
                <section className="guide-hero">
                  <div>
                    <span className="pill pale">
                      <PawPrint size={15} />
                      스마트펫트롤 · 우리동네 안전지킴이
                    </span>
                    <h1>
                      산책은 매일.
                      <br />
                      <span>안전은 함께.</span>
                    </h1>
                    <p>
                      반려견과 걷는 일상에 작은 관찰을 더합니다.
                      <br />
                      공공데이터와 현장 기록으로 필요한 변화를 찾습니다.
                    </p>
                    <button
                      className="btn light"
                      onClick={() => setView('map')}
                    >
                      우리 동네 살펴보기
                      <ArrowRight size={18} />
                    </button>
                  </div>
                  <figure>
                    <img
                      src={asset('images/proposal-art.jpg')}
                      alt="반려견과 함께 동네 안전을 살피는 스마트펫트롤 활동 제안 그림"
                      width={1080}
                      height={583}
                    />
                    <figcaption>
                      제공된 스마트펫트롤 제안서의 활동 이미지
                    </figcaption>
                  </figure>
                </section>
                <section className="guide-section">
                  <p className="eyebrow">
                    FROM THE PROPOSAL TO EVERYDAY ACTION
                  </p>
                  <h2>제안서의 아이디어를, 실제 활동으로.</h2>
                  <div className="guide-grid">
                    {[
                      {
                        n: '01',
                        Icon: Map,
                        title: '공공데이터로 둘러보기',
                        text: 'CCTV와 보안등의 위치·기준일을 확인합니다. 시설 자료가 적은 곳은 현장 확인 대상으로 살펴봅니다.',
                      },
                      {
                        n: '02',
                        Icon: Footprints,
                        title: '산책하며 관찰하기',
                        text: '어두운 길과 파손 시설을 살펴봅니다. 반려견 컨디션과 서로를 배려하는 펫티켓을 먼저 챙깁니다.',
                      },
                      {
                        n: '03',
                        Icon: ClipboardCheck,
                        title: '기록하고 재확인하기',
                        text: '시설 위치와 관찰 시각, 상태를 남깁니다. 근거를 확인한 뒤 현장 확인·조치 확인 상태로 구분합니다.',
                      },
                      {
                        n: '04',
                        Icon: Activity,
                        title: '변화를 확인하기',
                        text: '확인된 문제와 조치 기록, 순찰일지를 보고자료로 정리합니다. 다음 점검과 개선 제안으로 이어갑니다.',
                      },
                    ].map(({ n, Icon, title, text }) => (
                      <article key={n}>
                        <span>{n}</span>
                        <Icon size={28} />
                        <h3>{title}</h3>
                        <p>{text}</p>
                      </article>
                    ))}
                  </div>
                </section>
                <div className="two-columns">
                  <section className="white-card guide-copy">
                    <Heart size={26} />
                    <h2>함께 지키는 펫티켓</h2>
                    <ul>
                      <li>목줄과 배변봉투를 챙기고 반려견 상태를 확인해요.</li>
                      <li>보행자와 다른 동물에게 충분한 공간을 주세요.</li>
                      <li>
                        위험한 상황에는 직접 개입하지 말고 안전한 곳에서
                        신고해요.
                      </li>
                      <li>
                        다른 사람의 얼굴·차량번호 등 식별정보는 기록에서
                        제외해요.
                      </li>
                    </ul>
                  </section>
                  <section className="white-card guide-copy">
                    <ShieldCheck size={26} />
                    <h2>시설 개선은 공식 신고로 연결</h2>
                    <p>
                      이 웹의 기록은 공모전 활동 자료입니다. 시설 보수 등을
                      요청하려면 안전신문고에 별도로 제출해 주세요.
                    </p>
                    <a
                      className="btn secondary"
                      href="https://www.safetyreport.go.kr/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      안전신문고 열기
                      <ArrowUpRight size={17} />
                    </a>
                    <p className="small-note">
                      긴급한 위험은 112 또는 119에 연락하세요.
                    </p>
                  </section>
                </div>
                <section className="ai-briefing">
                  <div className="section-heading large">
                    <div>
                      <p className="eyebrow">AI DATA REVIEW</p>
                      <h2>AI가 정리한 자료 점검 메모</h2>
                    </div>
                    <span className="pill teal">검토 초안</span>
                  </div>
                  {briefing &&
                  briefing.sourceCheckedAt === manifest?.checkedAt ? (
                    <>
                      <p className="small-note">
                        {date(briefing.writtenAt)} 작성 · 공개자료를 검토한
                        메모입니다. 현장 확인을 대신하지 않습니다.
                      </p>
                      <div className="briefing-grid">
                        {briefing.items.map((item) => (
                          <article key={item.title}>
                            <h3>{item.title}</h3>
                            <p>
                              <b>확인한 사실</b>
                              {item.fact}
                            </p>
                            <p>
                              <b>검토 의견</b>
                              {item.interpretation}
                            </p>
                            <div>
                              <ClipboardCheck size={17} />
                              <p>{item.action}</p>
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="small-note">
                      현재 게시된 자료를 기준으로 검토 메모를 준비하고 있습니다.
                    </p>
                  )}
                </section>
                <section className="method-card">
                  <Database size={26} />
                  <div>
                    <h2>자료의 한계도 함께 보여드립니다.</h2>
                    <p>
                      위치만으로 범죄위험·실제 조도·안전 경로를 확정하지
                      않습니다. 반려동물 통계는 지역별로 확인합니다. 자동 수집이
                      실패하면 마지막으로 검증한 자료를 유지합니다.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setDialog('data')}
                    >
                      데이터 연결과 기준 보기
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </section>
              </div>
            </TabsContent>
          </main>
        </Tabs>
        <footer className="site-footer">
          <span>
            <PawPrint size={16} />
            스마트펫트롤 · 우리동네 안전지킴이
          </span>
          <span>경기데이터드림 · OpenStreetMap</span>
          <button className="text-button" onClick={() => setDialog('data')}>
            자료 기준
            <ArrowUpRight size={14} />
          </button>
        </footer>
      </div>

      <Sheet
        open={!!selected}
        onOpenChange={(v) => {
          if (!v) setSelected(null);
        }}
      >
        <SheetContent className="detail-sheet">
          <SheetHeader>
            <SheetTitle>
              {selected?.kind === 'cctv'
                ? 'CCTV 시설 정보'
                : '보안등 시설 정보'}
            </SheetTitle>
            <SheetDescription>
              공개된 설치 자료와 기준일을 확인하세요.
            </SheetDescription>
          </SheetHeader>
          {selected && (
            <div className="sheet-body">
              <span
                className={
                  'pill ' + (selected.kind === 'cctv' ? 'blue' : 'amber')
                }
              >
                {selected.kind === 'cctv' ? selected.purpose : '보안등'}
              </span>
              <h3>{selected.name}</h3>
              <p>{selected.address || '주소 미제공'}</p>
              <dl className="detail-data">
                <div>
                  <dt>설치수 · 원본</dt>
                  <dd>{number(selected.count)}</dd>
                </div>
                <div>
                  <dt>관리기관</dt>
                  <dd>{selected.agency || '미제공'}</dd>
                </div>
                <div>
                  <dt>자료 기준일</dt>
                  <dd>{date(selected.date)}</dd>
                </div>
                <div>
                  <dt>설치 시기</dt>
                  <dd>{selected.installed || '미제공'}</dd>
                </div>
                {selected.kind === 'cctv' && (
                  <div>
                    <dt>촬영방향</dt>
                    <dd>{selected.direction || '미제공'}</dd>
                  </div>
                )}
                <div>
                  <dt>위경도</dt>
                  <dd>
                    {valid(selected)
                      ? `${selected.lat}, ${selected.lng}`
                      : '미제공 또는 범위 확인 필요'}
                  </dd>
                </div>
              </dl>
              {valid(selected) && (
                <>
                  <button
                    className="btn primary full"
                    onClick={() =>
                      void choosePoint({
                        lat: selected.lat!,
                        lng: selected.lng!,
                        label: selected.address,
                      })
                    }
                  >
                    이 시설 주변 확인
                    <ArrowRight size={16} />
                  </button>
                  <PlaceLinks
                    p={{
                      lat: selected.lat!,
                      lng: selected.lng!,
                      label: selected.address,
                    }}
                  />
                  <a
                    className="text-button"
                    href={`https://map.kakao.com/link/roadview/${selected.lat},${selected.lng}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    로드뷰로 주변 살펴보기
                    <ArrowUpRight size={15} />
                  </a>
                </>
              )}
              <div className="callout">
                <Info size={16} />
                <p>설치 자료이며 현재 작동 상태나 영상은 제공하지 않습니다.</p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Dialog
        open={dialog === 'candidates'}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
      >
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{city} 시설 점검 후보</DialogTitle>
            <DialogDescription>
              주변 구획보다 시설 등록 좌표가 상대적으로 적은 곳입니다. 실제
              위험이나 어두움이 확인된 곳은 아닙니다.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-body">
            <div className="callout">
              <Info size={17} />
              <p>
                약 250m 구획의 CCTV·보안등 좌표 수를 주변 8구획 평균과
                비교합니다. 자료가 있는 주변 구획이 4개 이상인 곳만 검토합니다.
              </p>
            </div>
            {inspection?.quality[city] && !inspection.quality[city].eligible ? (
              <div className="callout warning">
                {inspection.quality[city].reasons.join(' · ')}. 자료 부족을 시설
                부재로 표시하지 않습니다.
              </div>
            ) : (
              <>
                <div className="section-heading">
                  <h3>참고 지표 순 {number(gapCandidates.length)}개</h3>
                  <button
                    className="text-button"
                    onClick={() =>
                      download(
                        '스마트펫트롤_점검후보.csv',
                        '\uFEFF' +
                          [
                            [
                              '시군(인근주소추정)',
                              '위도(구획중심)',
                              '경도(구획중심)',
                              '참고지표',
                              'CCTV좌표수',
                              '보안등좌표수',
                              '인근기준주소',
                            ],
                            ...gapCandidates.map((c) => [
                              c.city,
                              c.lat,
                              c.lng,
                              c.score,
                              c.cctv,
                              c.lights,
                              c.nearAddress,
                            ]),
                          ]
                            .map((r) => r.map(csvCell).join(','))
                            .join('\r\n'),
                        'text/csv;charset=utf-8',
                      )
                    }
                  >
                    <Download size={14} />
                    CSV
                  </button>
                </div>
                <div className="candidate-list">
                  {gapCandidates.slice(0, 100).map((c) => (
                    <button key={c.id} onClick={() => chooseCandidate(c)}>
                      <span style={{ background: gapColor(c.score) }}>
                        {c.score}
                      </span>
                      <div>
                        <strong>
                          {c.city} · {c.lat.toFixed(5)}, {c.lng.toFixed(5)}
                        </strong>
                        <p>
                          구획 CCTV {c.cctv} · 보안등 {c.lights}개 좌표
                        </p>
                        <small>
                          인근 기준: {c.nearAddress || '주소 미제공'}
                        </small>
                      </div>
                      <ChevronRight size={17} />
                    </button>
                  ))}
                </div>
                {gapCandidates.length > 100 && (
                  <p className="small-note">
                    화면에는 앞의 100개를 표시합니다. 전체 위치는 지도 또는
                    CSV에서 확인하세요.
                  </p>
                )}
              </>
            )}
            <details className="grid-method">
              <summary>산출 방법과 해석</summary>
              <p>{inspection?.method}</p>
              <p>{inspection?.limits}</p>
            </details>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === 'data'}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
      >
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>데이터 연결 · 분석 기준</DialogTitle>
            <DialogDescription>
              경기데이터드림 공식 API에서 전체 페이지를 수집합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-body">
            <div className="sync-banner">
              <span className="stat-icon teal">
                <RefreshCw size={22} />
              </span>
              <div>
                <strong>네 가지 공공데이터로 동네 살펴보기</strong>
                <p>
                  마지막 전체 수집:{' '}
                  {manifest
                    ? new Date(manifest.checkedAt).toLocaleString('ko-KR')
                    : '연결 중'}
                </p>
                <small>
                  일부 페이지가 누락되면 새 자료로 교체하지 않습니다.
                </small>
              </div>
            </div>
            <div className="source-cards">
              {manifest &&
                (['cctv', 'lights', 'pets'] as const).map((k) => (
                  <article key={k}>
                    <div>
                      <h3>
                        {k === 'cctv'
                          ? 'CCTV 현황'
                          : k === 'lights'
                            ? '보안등 정보'
                            : '반려동물 등록'}
                      </h3>
                      <span className="pill teal">API</span>
                    </div>
                    <strong>
                      {number(manifest.sources[k].rows)}
                      <small>건</small>
                    </strong>
                    <p>
                      {k === 'pets'
                        ? '시군·읍면동 집계 자료'
                        : `좌표 표시 가능 ${number(manifest.sources[k].mapped)}건`}
                    </p>
                    <small>
                      {date(manifest.sources[k].dateMin)} ~{' '}
                      {date(manifest.sources[k].dateMax)}
                    </small>
                  </article>
                ))}
            </div>
            <ul className="method-list">
              <li>
                <b>주변 분석</b> 선택 지점 인근 3km와 겹치는 시군 자료를 함께
                확인합니다. 반경 안의 서로 다른 좌표 수를 표시합니다.
              </li>
              <li>
                <b>CCTV 목적</b> 생활방범·어린이보호·다목적·차량방범을
                사용합니다. 직선거리는 실제 촬영범위가 아닙니다.
              </li>
              <li>
                <b>보안등</b> 밝기·고장 상태는 포함되지 않습니다. 좌표 누락과
                기준일 차이를 고려하세요.
              </li>
              <li>
                <b>보안등 집계</b> 조명 종류·전력 구간별 개소 수입니다. 지역
                현황에서 기준일과 빈 항목을 확인하세요.
                위치·나이·색온도·범죄확률을 나타내지 않습니다.
              </li>
              <li>
                <b>반려동물</b> 연도를 구분하고 중복 의심·합계 행은 합산에서
                제외합니다. 반려견 수나 참여 인원이 아닙니다.
              </li>
              <li>
                <b>현장 기록</b> 현재 계정의 기록입니다. 확인 근거를 적어 상태를
                변경하며, 종료를 자동으로 조치 완료로 보지 않습니다.
              </li>
              <li>
                <b>보고자료</b> 실제 활동·확인 기록을 사용합니다. 자동 정리는
                입력 내용을 요약하며 범죄 예측이나 AI 판정이 아닙니다.
              </li>
            </ul>
            <button
              className="btn secondary"
              onClick={() => {
                void loadManifest();
                void loadRecords();
                setToast('게시된 최신 자료를 다시 불러옵니다.');
              }}
            >
              <RefreshCw size={16} />
              최신 게시자료 불러오기
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === 'report'}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
      >
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>이곳에서 발견한 내용을 남겨 주세요.</DialogTitle>
            <DialogDescription>
              저장하면 현재 계정의 활동 기록으로 보관됩니다. 공식 신고는
              별도입니다.
            </DialogDescription>
          </DialogHeader>
          <form
            className="dialog-body report-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!point) return;
              const ok = await save({
                kind: 'report',
                title,
                description,
                category,
                city: recordCity,
                lat: point.lat,
                lng: point.lng,
                observedAt,
                radius,
                cctv: analysis?.cctv.unique,
                lights: analysis?.lights.unique,
                sourceAt: manifest?.checkedAt,
              });
              if (ok) {
                setDialog(null);
                setTitle('');
                setDescription('');
                setToast(
                  '현장 기록을 저장했습니다. 순찰 · 기록에서 다시 확인할 수 있어요.',
                );
              }
            }}
          >
            <div className="form-location">
              <MapPin size={18} />
              {point?.label}
              <small>
                {point?.lat.toFixed(5)}, {point?.lng.toFixed(5)}
              </small>
            </div>
            <label htmlFor="report-city">
              기록 시군 · 위치를 직접 확인해 주세요
              <Pick
                id="report-city"
                label="기록 시군"
                value={recordCity}
                options={cities}
                onChange={setRecordCity}
              />
            </label>
            <label>
              제목
              <input
                required
                value={title}
                maxLength={70}
                placeholder="예: 공원 입구 보안등이 꺼져 있어요"
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="form-columns">
              <label htmlFor="report-kind">
                문제 유형
                <Pick
                  id="report-kind"
                  label="문제 유형"
                  value={category}
                  options={TYPES}
                  onChange={setCategory}
                />
              </label>
              <label>
                관찰 시각
                <input
                  required
                  type="datetime-local"
                  value={observedAt}
                  onChange={(e) => setObservedAt(e.target.value)}
                />
              </label>
            </div>
            <div className="lighting-template">
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  setDescription((d) =>
                    (d + (d ? '\n\n' : '') + LIGHT_TEMPLATE).slice(0, 1600),
                  )
                }
              >
                <Lightbulb size={16} />
                조명 점검 양식 넣기
              </button>
              <p>
                직접 확인한 항목만 수정해 주세요. 미확인은 그대로 남기고, 빛의
                색과 노후 여부를 구분합니다.
              </p>
            </div>
            <label>
              현장에서 확인한 내용
              <textarea
                required
                value={description}
                maxLength={1600}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="어디에서 어떤 상태를 보았는지 적어 주세요. 실제 관찰과 추측을 구분해 주세요."
              />
              <small>{description.length}/1,600</small>
            </label>
            <div className="callout">
              <Info size={17} />
              <p>
                주민 이름·연락처 등 개인 식별정보를 제외하고 시설 상태를
                중심으로 작성해 주세요.
              </p>
            </div>
            {saveError && (
              <p role="alert" className="form-error">
                {saveError}
              </p>
            )}
            <div className="form-actions">
              <button
                type="button"
                className="btn secondary"
                onClick={() => download('현장기록_초안.txt', reportText())}
              >
                <Download size={16} />
                초안 내려받기
              </button>
              <button type="submit" disabled={saving} className="btn primary">
                <ClipboardCheck size={17} />
                {saving ? '저장 중…' : '현장 기록 저장'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === 'review'}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
      >
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>{review?.title}</DialogTitle>
            <DialogDescription>
              현장 확인과 조치 결과는 직접 확인한 근거와 함께 남겨 주세요.
            </DialogDescription>
          </DialogHeader>
          {review && (
            <form
              className="dialog-body report-form"
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await save(
                    { id: review.id, status: reviewStatus, evidence },
                    'PATCH',
                  )
                ) {
                  setDialog(null);
                  setToast('확인 상태와 근거를 저장했습니다.');
                }
              }}
            >
              <p className="preserve-text">{review.description}</p>
              <PlaceLinks
                p={{ lat: review.lat, lng: review.lng, label: review.title }}
              />
              <label htmlFor="review-status">
                확인 상태
                <Pick
                  id="review-status"
                  label="확인 상태"
                  value={reviewStatus}
                  options={STATUSES.slice(1)}
                  onChange={setReviewStatus}
                />
              </label>
              <label>
                확인 근거
                <textarea
                  required={reviewStatus !== '접수'}
                  value={evidence}
                  maxLength={1200}
                  onChange={(e) => setEvidence(e.target.value)}
                  rows={4}
                  placeholder="재방문 날짜, 확인한 시설 상태, 보수 여부 등 근거를 적어 주세요."
                />
              </label>
              {saveError && (
                <p role="alert" className="form-error">
                  {saveError}
                </p>
              )}
              <div className="form-actions">
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() =>
                    download('스마트펫트롤_신고초안.txt', reportText(review))
                  }
                >
                  <Download size={16} />
                  신고 초안
                </button>
                <a
                  className="btn secondary"
                  href="https://www.safetyreport.go.kr/"
                  target="_blank"
                  rel="noreferrer"
                >
                  안전신문고
                  <ArrowUpRight size={15} />
                </a>
                <button className="btn primary" type="submit" disabled={saving}>
                  {saving ? '저장 중…' : '상태 저장'}
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={dialog === 'patrol'}
        onOpenChange={(v) => {
          if (!v) setDialog(null);
        }}
      >
        <DialogContent className="wide-dialog">
          <DialogHeader>
            <DialogTitle>
              {started ? '오늘의 순찰' : '가볍게 준비하고, 함께 걸어요.'}
            </DialogTitle>
            <DialogDescription>
              안전한 산책과 시설 관찰을 중심으로 진행해 주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-body">
            <div className="walk-timer">
              <Footprints size={30} />
              <strong>
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}
                <span>:</span>
                {String(elapsed % 60).padStart(2, '0')}
              </strong>
              <p>
                {started
                  ? '산책 중 · 이 창을 닫아도 측정은 계속돼요.'
                  : '준비를 마친 뒤 순찰을 시작하세요.'}
              </p>
            </div>
            <Pick
              label="순찰 지역"
              value={patrolCity}
              options={cities}
              onChange={setPatrolCity}
            />
            <div className="patrol-checks">
              {CHECKS.map((c) => (
                <label className="check-row" key={c}>
                  <Checkbox
                    checked={checks.includes(c)}
                    onCheckedChange={(v) =>
                      setChecks(
                        v ? [...checks, c] : checks.filter((x) => x !== c),
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
            {!started ? (
              <button
                className="btn primary full"
                disabled={checks.length < 3}
                onClick={() => {
                  setStarted(Date.now());
                  setNow(Date.now());
                  setDialog(null);
                  setView('map');
                  setToast(
                    '순찰을 시작했어요. 안전한 곳에서 지도를 확인해 주세요.',
                  );
                }}
              >
                <Footprints size={18} />
                순찰 시작하기
              </button>
            ) : (
              <>
                <label className="field-label">
                  오늘의 관찰
                  <textarea
                    rows={4}
                    maxLength={1600}
                    placeholder="걸었던 지역과 관찰한 시설, 펫티켓 실천 내용을 기록해 주세요."
                    value={patrolMemo}
                    onChange={(e) => setPatrolMemo(e.target.value)}
                  />
                </label>
                {saveError && (
                  <p role="alert" className="form-error">
                    {saveError}
                  </p>
                )}
                <button
                  className="btn primary full"
                  disabled={saving || !patrolMemo.trim()}
                  onClick={async () => {
                    if (
                      await save({
                        kind: 'patrol',
                        city: patrolCity,
                        memo: patrolMemo,
                        checks,
                        started: new Date(started).toISOString(),
                        ended: new Date().toISOString(),
                      })
                    ) {
                      setStarted(null);
                      setPatrolMemo('');
                      setChecks([]);
                      setDialog(null);
                      setToast('순찰을 마치고 일지를 저장했습니다.');
                    }
                  }}
                >
                  <CheckCircle2 size={17} />
                  {saving ? '저장 중…' : '순찰 마치고 일지 저장'}
                </button>
                <p className="small-note">
                  같은 탭에서 새로고침해도 진행 상태가 유지됩니다. 탭을 닫기 전에
                  일지를 저장하세요. 저장한 일지는 계정에 보관됩니다.
                </p>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {started && dialog !== 'patrol' && (
        <button
          className="floating-patrol"
          onClick={() => {
            setSaveError('');
            setDialog('patrol');
          }}
        >
          <span className="live-dot" />
          <Footprints size={19} />
          순찰 중 <strong>{Math.floor(elapsed / 60)}분</strong>
          <ChevronRight size={16} />
        </button>
      )}
      {toast && (
        <output className="toast">
          <CheckCircle2 size={19} />
          {toast}
        </output>
      )}
      <section className="print-report">
        <header>
          <PawPrint size={28} />
          <h1>스마트펫트롤 · 우리동네 안전지킴이</h1>
          <p>
            공공데이터와 현장 기록에 기반한 활동 보고자료 ·{' '}
            {new Date().toLocaleDateString('ko-KR')}
          </p>
        </header>
        <h2>활동 현황</h2>
        <p>
          현장 기록 {reports.length}건 · 현장 확인{' '}
          {reports.filter((r) => r.status === '현장 확인').length}건 · 조치 확인{' '}
          {reports.filter((r) => r.status === '조치 확인').length}건 · 순찰일지{' '}
          {patrols.length}건
        </p>
        <p>공공데이터 확인: {manifest?.checkedAt}</p>
        <p>
          설치 자료는 실제 촬영범위·밝기·범죄위험을 나타내지 않습니다. 확인
          상태는 기록 작성자가 남긴 근거에 기반합니다.
        </p>
        {!reports.length && (
          <p>아직 현장 기록이 없습니다. 활동 후 확인한 근거를 보완하세요.</p>
        )}
        {reports.map((r) => (
          <article key={r.id}>
            <h2>{r.title}</h2>
            <p>
              {r.status} · {r.city} · {r.category} · {r.lat}, {r.lng}
            </p>
            <p>{r.description}</p>
            <p>
              관찰 {r.observed_at} · 확인 근거: {r.evidence || '미작성'}
            </p>
            <p>
              반경 {r.radius}m / CCTV {r.cctv ?? '미확인'}개 좌표 / 보안등{' '}
              {r.lights ?? '미확인'}개 좌표
            </p>
          </article>
        ))}
        {patrols.map((p) => (
          <article key={p.id}>
            <h2>
              {p.city} 순찰일지 · {Math.floor(p.seconds / 60)}분
            </h2>
            <p>
              {p.started} ~ {p.ended}
            </p>
            <p>{p.memo}</p>
          </article>
        ))}
        <h2>출처와 방법</h2>
        <p>
          경기데이터드림 CCTV 현황(제공표준), 보안등 정보 현황(제공표준),
          반려동물 등록 현황, 경기도 보안등 집계 현황. 조명 종류·색깔만으로
          범죄위험을 판단하지 않습니다. 제안 기반: 제공된 「스마트 펫트롤
          우리동네 안전 지킴이」. 공식 신고기관이 아닌 공모전 활동
          프로젝트입니다.
        </p>
      </section>
    </>
  );
}
