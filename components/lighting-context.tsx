'use client';
import { useEffect, useState } from 'react';
import {
  Lightbulb,
  Info,
  ArrowUpRight,
  Download,
  ClipboardCheck,
} from 'lucide-react';
import { asset, number, date, csvCell, download } from '@/lib/patrol';
type Row = {
  id: number;
  city: string;
  date: string | null;
  division: string | null;
  bins: (number | null)[];
  groups: { name: string; known: number; missing: number }[];
  knownTotal: number;
  missing: number;
  ambiguous: boolean;
};
type Lighting = {
  checkedAt: string;
  sourceRows: number;
  missingCities: string[];
  bands: { field: string; technology: string; wattage: string }[];
  rows: Row[];
};
export function LightingEvidence() {
  return (
    <section className="lighting-evidence white-card">
      <div className="section-heading large">
        <div>
          <p className="eyebrow">EVIDENCE BEFORE ASSUMPTIONS</p>
          <h2>빛의 색보다, 실제 보행 환경을 확인해요.</h2>
        </div>
        <Lightbulb size={25} />
      </div>
      <div className="evidence-columns">
        <article>
          <span className="pill teal">확인한 연구</span>
          <h3>조명 개선은 검토할 가치가 있어요.</h3>
          <p>
            뉴욕 공공주택의 무작위 실험은 추가 조명 설치 후 야간 옥외 주요 범죄
            감소를 보고했습니다. 특정 환경의 조명 추가 실험이므로 경기도 모든
            골목에 같은 효과를 적용할 수는 없습니다.
          </p>
          <a
            href="https://link.springer.com/article/10.1007/s10940-020-09490-6"
            target="_blank"
            rel="noreferrer"
          >
            Chalfin 외 · 2022 논문
            <ArrowUpRight size={14} />
          </a>
        </article>
        <article>
          <span className="pill amber">단정할 수 없는 내용</span>
          <h3>노란빛 = 노후 = 높은 범죄확률?</h3>
          <p>
            따뜻한 색의 LED도 있습니다. 색만으로 설치 연도나 고장을 알 수 없고,
            영국 관찰연구에서도 백색등 전환의 범죄 감소 근거는 약했습니다.
            색깔만으로 위험점수를 높이지 않습니다.
          </p>
          <a
            href="https://www.energy.gov/sites/prod/files/2016/06/f32/postings_06-21-16.pdf"
            target="_blank"
            rel="noreferrer"
          >
            미국 에너지부 · LED 색온도
            <ArrowUpRight size={14} />
          </a>
          <a
            href="https://pubmed.ncbi.nlm.nih.gov/26219885/"
            target="_blank"
            rel="noreferrer"
          >
            Steinbach 외 · 2015 논문
            <ArrowUpRight size={14} />
          </a>
        </article>
        <article>
          <span className="pill teal">우리의 점검 방법</span>
          <h3>관찰하고, 근거를 남기세요.</h3>
          <p>
            점등·깜빡임, 밝고 어두운 구간의 차이, 눈부심, 수목 가림을
            기록하세요. 조도는 측정 시각·위치·기기와 함께 남기고 교체 이력은
            관리기관에 확인합니다.
          </p>
          <div className="inspection-note">
            <ClipboardCheck size={18} />
            시설 개선을 위한 현장 확인 자료로 활용
          </div>
        </article>
      </div>
    </section>
  );
}
export default function LightingContext({ city }: { city: string }) {
  const [data, setData] = useState<Lighting | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(asset('data/lighting-summary.json'))
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json() as Promise<Lighting>;
      })
      .then((d) => {
        if (active) setData(d);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const rows = data?.rows.filter((r) => r.city === city) || [];
  return (
    <section className="lighting-context white-card">
      <div className="section-heading large">
        <div>
          <p className="eyebrow">LIGHTING · REGIONAL CONTEXT</p>
          <h2>{city} 보안등 종류와 전력 구간</h2>
          <p>위에서 선택한 시군의 집계 자료 · 단위: 개소</p>
        </div>
        <span className="stat-icon amber">
          <Lightbulb size={24} />
        </span>
      </div>
      <div className="callout">
        <Info size={18} />
        <p>
          숫자는 소비전력량이나 밝기가 아닌 <b>전력 구간별 설치 개소 수</b>
          입니다. 시군 집계에는 개별 위치·색온도·교체 연도·작동 상태가 없습니다.
        </p>
      </div>
      {error ? (
        <p role="alert">
          보안등 집계를 불러오지 못했어요. 페이지를 다시 열어 주세요.
        </p>
      ) : !data ? (
        <div className="empty-state">보안등 집계 불러오는 중…</div>
      ) : !rows.length ? (
        <div className="empty-state">
          <Lightbulb />
          <h3>이 시군은 집계에 수록되어 있지 않아요.</h3>
          <p>보안등이 없다는 뜻이 아닙니다. 위치 지도는 별도 자료입니다.</p>
        </div>
      ) : (
        rows.map((r) => (
          <div className="lighting-row" key={r.id}>
            <div className="lighting-date">
              <span className="pill">기준일 {date(r.date || '')}</span>
              <span>구분: {r.division || '미제공'}</span>
              <span>빈 항목 {r.missing}/11개</span>
            </div>
            {(!r.date || r.date.slice(0, 4) < '2025') && (
              <p className="lighting-caution">
                {r.date
                  ? '오래된 기준일의 집계입니다. 현재 설치 현황은 재확인이 필요합니다.'
                  : '기준일이 없어 현재 현황과의 비교를 보류합니다.'}{' '}
                자료가 오래됐다는 사실은 조명 자체의 나이를 뜻하지 않습니다.
              </p>
            )}
            {r.ambiguous && (
              <p className="lighting-caution">
                같은 시군·구분·기준일의 행이 겹쳐 합산을 보류합니다.
              </p>
            )}
            <div className="lighting-totals">
              {r.groups.map((g, i) => (
                <div key={g.name}>
                  <span className={'technology-dot technology-' + i} />
                  <span>{g.name}</span>
                  <strong>
                    {number(g.known)}
                    <small>개소</small>
                  </strong>
                  <p>
                    {g.missing
                      ? `수록값 합계 · ${g.missing}개 구간 미제공`
                      : '수록 전력 구간 합계'}
                  </p>
                </div>
              ))}
            </div>
            {r.knownTotal > 0 && !r.ambiguous && (
              <>
                <div
                  className="technology-bar"
                  aria-label="수록된 숫자의 조명 종류별 구성"
                >
                  {r.groups.map((g, i) => (
                    <span
                      key={g.name}
                      className={'technology-' + i}
                      style={{ width: (g.known / r.knownTotal) * 100 + '%' }}
                      title={`${g.name}: 수록 숫자 합계의 ${((g.known / r.knownTotal) * 100).toFixed(1)}%`}
                    />
                  ))}
                </div>
                <p className="small-note">
                  {r.missing
                    ? '빈칸을 제외한 수록 숫자의 구성입니다. 전체 LED 전환율로 해석하지 않습니다.'
                    : '수록된 11개 전력 구간의 구성입니다. 실제 현황과 자료 범위를 재확인하세요.'}
                </p>
              </>
            )}
            <div className="table-scroll">
              <table>
                <caption>
                  전력 구간별 원자료 · 빈칸은 0으로 바꾸지 않습니다.
                </caption>
                <thead>
                  <tr>
                    <th>조명 종류</th>
                    <th>전력 구간</th>
                    <th>설치 개소</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bands.map((b, i) => (
                    <tr key={b.field}>
                      <td>{b.technology}</td>
                      <td>{b.wattage}</td>
                      <td>
                        {r.bins[i] === null ? '미제공' : number(r.bins[i])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      {data && (
        <div className="lighting-source">
          <p>
            API 확인 {date(data.checkedAt)} · {data.sourceRows}행 · 미수록 시군:{' '}
            {data.missingCities.join(', ')}
            <br />
            지도 색상에는 이 시군 집계나 조명의 추정 색상을 반영하지 않습니다.
          </p>
          <button
            className="btn secondary small"
            onClick={() =>
              download(
                '보안등_집계_검토.csv',
                '\uFEFF' +
                  [
                    [
                      '시군',
                      '구분',
                      '데이터기준일',
                      ...data.bands.map(
                        (b) => b.technology + ' ' + b.wattage + '(개소)',
                      ),
                    ],
                    ...data.rows.map((r) => [
                      r.city,
                      r.division,
                      r.date,
                      ...r.bins,
                    ]),
                  ]
                    .map((r) => r.map(csvCell).join(','))
                    .join('\r\n'),
                'text/csv;charset=utf-8',
              )
            }
          >
            <Download size={15} />
            집계 CSV
          </button>
        </div>
      )}
    </section>
  );
}
