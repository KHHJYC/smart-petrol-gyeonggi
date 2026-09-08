"""Relative facility-count screening. This is NOT a crime-risk or lighting model."""
import collections, datetime, json, math, pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1]
STEP=250
X=111320*math.cos(math.radians(37.5)); Y=111320
SAFETY=('생활방범','어린이보호','다목적','차량방범')

def main():
    path=ROOT/'public/data'; m=json.loads((path/'manifest.json').read_text(encoding='utf-8'))
    cells={}; quality={}
    for region in m['cities']:
        city=region['name']
        reasons=[]
        if region['cctv']<50: reasons.append('CCTV 수록 자료가 50행 미만')
        if not region['lights']: reasons.append('보안등 자료 미수록')
        if region['cctv'] and region['cctvMapped']/region['cctv']<.95: reasons.append('CCTV 좌표 제공률 95% 미만')
        if region['lights'] and region['lightsMapped']/region['lights']<.95: reasons.append('보안등 좌표 제공률 95% 미만')
        quality[city]={'eligible':not reasons,'reasons':reasons}
        data=json.loads((path/'regions'/region['file']).read_text(encoding='utf-8'))
        for kind in ('cctv','lights'):
            for r in data[kind]:
                if r['lat'] is None: continue
                if kind=='cctv' and not any(s in r['purpose'] for s in SAFETY): continue
                key=(math.floor(r['lng']*X/STEP),math.floor(r['lat']*Y/STEP))
                if key not in cells: cells[key]={'cctv':set(),'lights':set(),'cities':collections.Counter(),'sample':r}
                c=cells[key];c[kind].add((r['lat'],r['lng']));c['cities'][city]+=1
    candidates=set(cells)
    for x,y in list(cells):
        candidates.update((x+dx,y+dy) for dx in (-1,0,1) for dy in (-1,0,1))
    result=[]
    for x,y in candidates:
        neighbors=[cells.get((x+dx,y+dy)) for dx in (-1,0,1) for dy in (-1,0,1) if (dx,dy)!=(0,0)]
        active=[n for n in neighbors if n]
        if len(active)<4: continue
        own=cells.get((x,y)); votes=collections.Counter()
        if own: votes.update(own['cities'])
        else:
            for c in active: votes.update(c['cities'])
        city=votes.most_common(1)[0][0]
        if not quality[city]['eligible']: continue
        ref={k:sum(len(n[k]) for n in active)/8 for k in ('cctv','lights')}
        if min(ref.values())<=0: continue
        counts={k:len(own[k]) if own else 0 for k in ref}
        score=round(50*sum(max(0,1-counts[k]/ref[k]) for k in ref))
        if score<25: continue
        lng=(x+.5)*STEP/X;lat=(y+.5)*STEP/Y
        samples=[n['sample'] for n in ([own] if own else [])+active]
        sample=min(samples,key=lambda r:(r['lng']-lng)**2*X*X+(r['lat']-lat)**2*Y*Y)
        result.append({'id':f'{x}:{y}','city':city,'lat':round(lat,7),'lng':round(lng,7),'bounds':[x*STEP/X,y*STEP/Y,(x+1)*STEP/X,(y+1)*STEP/Y],
                       'score':score,'cctv':counts['cctv'],'lights':counts['lights'],'referenceCctv':round(ref['cctv'],1),'referenceLights':round(ref['lights'],1),'activeNeighbors':len(active),'nearAddress':sample['address']})
    result.sort(key=lambda r:(-r['score'],r['city'],r['id']))
    output={'checkedAt':m['checkedAt'],'cellMetersApprox':250,'quality':quality,'candidates':result,
      'method':'약 250m 구획의 CCTV·보안등 좌표 수를 주변 8구획 평균과 비교. 각 상대 부족률에 50% 가중치. 주변 4구획 이상 자료 존재 및 두 시설 평균 > 0인 곳만 계산. 25점 이상 표시. 경기도 37.5도 기준 근사 격자로 실제 폭에는 소폭 차이가 있음.',
      'limits':'검증된 위험도가 아닌 현장 점검 참고지표. 구획 중심은 실제 시설·보행로가 아닐 수 있음. 시군은 인근 시설 주소로 추정. 최신성·누락·건물·산지·보행 수요·실제 밝기는 현장 확인 필요. 최소 행수·좌표 제공률은 이 시제품의 품질 필터이며 공인 기준이 아님.'}
    (path/'inspection.json').write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'candidateCells':len(result),'qualityExclusions':{k:v['reasons'] for k,v in quality.items() if not v['eligible']}},ensure_ascii=False))

if __name__=='__main__': main()
