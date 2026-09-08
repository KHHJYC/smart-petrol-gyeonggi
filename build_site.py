"""Build regional map files without inventing crime-risk scores or pet locations."""
import collections, hashlib, json, math, pathlib, re

CITIES = '가평군 고양시 과천시 광명시 광주시 구리시 군포시 김포시 남양주시 동두천시 부천시 성남시 수원시 시흥시 안산시 안성시 안양시 양주시 양평군 여주시 연천군 오산시 용인시 의왕시 의정부시 이천시 파주시 평택시 포천시 하남시 화성시'.split()
CENTERS = [(37.8315,127.5095),(37.6584,126.832),(37.4292,126.9876),(37.4785,126.8646),(37.4294,127.2551),(37.5943,127.1296),(37.3617,126.9352),(37.6153,126.7155),(37.636,127.2165),(37.9036,127.0607),(37.5034,126.766),(37.420,127.1267),(37.2636,127.0286),(37.380,126.803),(37.3219,126.8309),(37.008,127.2797),(37.3943,126.9568),(37.7853,127.0458),(37.4918,127.4876),(37.298,127.637),(38.0964,127.074),(37.1498,127.077),(37.2411,127.1776),(37.3447,126.9683),(37.738,127.0337),(37.272,127.435),(37.760,126.780),(36.9921,127.1129),(37.895,127.200),(37.5393,127.2146),(37.1995,126.8312)]

def text(v): return '' if v is None else str(v).strip()
def number(v):
    try:
        n = float(v)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError): return None
def city_from(address, agency=''):
    for t in re.split(r'[\s(),]+', address):
        if t in CITIES: return t
    return next((c for c in CITIES if c in agency), '지역 미확인')
def coordinates(lat, lng):
    lat, lng = number(lat), number(lng)
    return (round(lat, 7), round(lng, 7)) if lat is not None and lng is not None and 33 < lat < 39 and 124 < lng < 132 else (None, None)

def facility(row, kind, i):
    address = text(row.get('REFINE_ROADNM_ADDR') or row.get('REFINE_LOTNO_ADDR'))
    agency = text(row.get('MANAGE_INST_NM'))
    lat, lng = coordinates(row.get('REFINE_WGS84_LAT'), row.get('REFINE_WGS84_LOGT'))
    if lat is None and kind == 'lights': lat, lng = coordinates(row.get('LAT'), row.get('LOGT'))
    return {'id': f'{kind}-{i}', 'kind': kind, 'city': city_from(address, agency), 'lat':lat, 'lng':lng, 'address':address,
            'name': text(row.get('SECRTLGT_LOC_NM_INFO')) if kind == 'lights' else text(row.get('INSTL_PUPRS_DIV_NM')),
            'purpose':text(row.get('INSTL_PUPRS_DIV_NM')) if kind == 'cctv' else text(row.get('INSTL_DIV_NM')),
            'count':number(row.get('CAMERA_CNT' if kind == 'cctv' else 'INSTL_CNT')),
            'date':re.sub(r'[^0-9]', '', text(row.get('DATA_STD_DE'))), 'agency':agency,
            'installed':text(row.get('INSTL_YM' if kind == 'cctv' else 'INSTL_YY')),
            'direction':text(row.get('POTOGRF_DIRECTN_INFO')) if kind == 'cctv' else ''}

def pet(row, i):
    return {'id':f'pets-{i}', 'city':text(row.get('SIGUN_NM')), 'cityCode':text(row.get('SIGUN_CD')), 'year':text(row.get('STD_YY')), 'town':text(row.get('EMD_NM')), 'animals':number(row.get('REGIST_ANIMAL_CNT')), 'owners':number(row.get('ANIMAL_OWNER_CNT')), 'date':re.sub(r'[^0-9]','',text(row.get('DATA_STD_DE')))}

def main():
    raw = pathlib.Path('data/raw')
    out = pathlib.Path('public/data/regions'); out.mkdir(parents=True, exist_ok=True)
    source = {k:json.loads((raw / f'{k}.json').read_text(encoding='utf-8')) for k in ('cctv','lights','pets')}
    normalized = {k:[facility(r,k,i) for i,r in enumerate(source[k])] for k in ('cctv','lights')}
    normalized['pets'] = [pet(r,i) for i,r in enumerate(source['pets'])]
    keys = collections.Counter((r['city'],r['year'],r['town']) for r in normalized['pets'])
    for row in normalized['pets']:
        row['ambiguous'] = keys[(row['city'],row['year'],row['town'])] > 1
        row['subtotal'] = row['town'] in (row['city'], '합계', '총계', '계', '')
    manifest = json.loads((raw / 'collected.json').read_text(encoding='utf-8'))
    manifest.update({'schemaVersion':2,'sources':{},'cities':[],'files':{}})
    for kind, rows in normalized.items():
        dates = sorted(r['date'] for r in rows if len(r['date']) == 8)
        manifest['sources'][kind] = {'rows':len(rows),'mapped':sum(r.get('lat') is not None for r in rows) if kind != 'pets' else 0,'dateMin':dates[0] if dates else '', 'dateMax':dates[-1] if dates else '', 'endpoint':{'cctv':'CCTV','lights':'SECRTLGT','pets':'AnimalRegistStus'}[kind]}
    grouped = {city:{k:[] for k in normalized} for city in CITIES + ['지역 미확인']}
    for kind,rows in normalized.items():
        for row in rows: grouped.get(row['city'],grouped['지역 미확인'])[kind].append(row)
    for index, city in enumerate(CITIES + ['지역 미확인']):
        block = grouped[city]
        coords = [r for k in ('cctv','lights') for r in block[k] if r['lat'] is not None]
        bounds = [min(r['lng'] for r in coords),min(r['lat'] for r in coords),max(r['lng'] for r in coords),max(r['lat'] for r in coords)] if coords else None
        payload = json.dumps(block,ensure_ascii=False,separators=(',',':')).encode('utf-8')
        filename = f'{index}.json'
        (out / filename).write_bytes(payload)
        manifest['files'][filename] = {'sha256':hashlib.sha256(payload).hexdigest(),'bytes':len(payload)}
        years = sorted({r['year'] for r in block['pets']})
        manifest['cities'].append({'name':city,'file':filename,'center':CENTERS[index] if index<31 else [37.53,127.12], 'bounds':bounds,
              'cctv':len(block['cctv']),'cctvMapped':sum(r['lat'] is not None for r in block['cctv']),
              'lights':len(block['lights']),'lightsMapped':sum(r['lat'] is not None for r in block['lights']),
              'petRows':len(block['pets']),'petYears':years,'latestPetYear':years[-1] if years else None})
    pathlib.Path('public/data/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'sources':manifest['sources'],'regions':len(grouped)},ensure_ascii=False))

if __name__ == '__main__': main()
