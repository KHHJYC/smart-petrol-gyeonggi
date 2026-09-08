"""Technology / wattage-band COUNTS; never infer lamp age, colour or point risk."""
import collections,json,pathlib,sys,math
root=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
from build_site import CITIES
BANDS=[('NTRM_ELECPWR_AMNT1','나트륨','100~200W'),('NTRM_ELECPWR_AMNT2','나트륨','201~300W'),('NTRM_ELECPWR_AMNT3','나트륨','301~400W'),('MTAL_ELECPWR_AMNT4','메탈','0~99W'),('MTAL_ELECPWR_AMNT1','메탈','100~150W'),('MTAL_ELECPWR_AMNT2','메탈','151~300W'),('MTAL_ELECPWR_AMNT3','메탈','301~400W'),('LED_ELECPWR_AMNT4','LED','0~49W'),('LED_ELECPWR_AMNT1','LED','50~100W'),('LED_ELECPWR_AMNT2','LED','101~120W'),('LED_ELECPWR_AMNT3','LED','121~150W')]
def count(value):
 if value is None or value=='':return None
 n=float(value)
 if not math.isfinite(n) or n<0 or n!=int(n):raise ValueError('Invalid lighting site count')
 return int(n)
def normalize(raw):
 keys=collections.Counter((r.get('SIGUN_NM'),r.get('DIV_NM'),r.get('DATA_STD_DE')) for r in raw)
 rows=[]
 for i,r in enumerate(raw):
  bins=[count(r.get(k)) for k,_,_ in BANDS]
  groups=[{'name':g,'known':sum(v for v,(_,t,_) in zip(bins,BANDS) if t==g and v is not None),'missing':sum(v is None for v,(_,t,_) in zip(bins,BANDS) if t==g)} for g in ('나트륨','메탈','LED')]
  rows.append({'id':i,'city':r.get('SIGUN_NM') or '지역 미확인','cityCode':r.get('SIGUN_CD'),'division':r.get('DIV_NM'),'date':r.get('DATA_STD_DE'),'bins':bins,'groups':groups,'knownTotal':sum(v for v in bins if v is not None),'missing':sum(v is None for v in bins),'ambiguous':keys[(r.get('SIGUN_NM'),r.get('DIV_NM'),r.get('DATA_STD_DE'))]>1})
 return sorted(rows,key=lambda r:(r['city'],r['date'] or '',r['id']))
def main():
 raw=json.loads((root/'data/raw/lightingSummary.json').read_text(encoding='utf-8'))
 meta=root/'data/raw/collected.json'
 extra=root/'data/raw/lighting-collected.json'
 # A one-off fourth-source fetch can be newer than the last three-source snapshot.
 stamps=[json.loads(p.read_text(encoding='utf-8'))['checkedAt'] for p in [meta,extra] if p.exists()]
 rows=normalize(raw)
 payload={'endpoint':'Secrtlgt','unit':'개소','checkedAt':max(stamps),'sourceRows':len(raw),'bands':[{'field':k,'technology':t,'wattage':w} for k,t,w in BANDS],'missingCities':[c for c in CITIES if not any(r['city']==c for r in rows)],'rows':rows}
 (root/'public/data/lighting-summary.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps({'lightingRows':len(rows),'missingCities':payload['missingCities'],'missingDates':sum(not r['date'] for r in rows),'incompleteRows':sum(r['missing']>0 for r in rows)},ensure_ascii=False))
if __name__=='__main__':main()
