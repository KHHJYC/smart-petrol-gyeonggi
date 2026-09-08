"""Small read-only connectivity checks; never print keys or request URLs."""
import argparse, concurrent.futures, json, os, socket, time, urllib.error, urllib.parse, urllib.request

def probe(service, size=1, authenticated=True):
    phase='connect';start=time.monotonic()
    query={'Type':'json','pIndex':1,'pSize':size}
    if authenticated: query['KEY']=os.environ['GG_API_KEY']
    try:
        req=urllib.request.Request('https://openapi.gg.go.kr/'+service+'?'+urllib.parse.urlencode(query),headers={'Accept':'*/*','User-Agent':'SmartPetrolData/2.0'})
        with urllib.request.urlopen(req,timeout=15) as r:
            phase='read';body=json.load(r)
        head=next((b['head'] for b in body.get(service,[]) if 'head' in b),[])
        result=next((h['RESULT'] for h in head if 'RESULT' in h),body.get('RESULT',{}))
        code=str(result.get('CODE','unknown'))
        safe_code=code if len(code)<30 and all(c.isalnum() or c in '-_' for c in code) else 'unknown'
        outcome={'service':service,'size':size,'authenticated':authenticated,'code':safe_code,'seconds':round(time.monotonic()-start,1)}
    except Exception as error:
        outcome={'service':service,'size':size,'authenticated':authenticated,'phase':phase,'error':type(error).__name__,'seconds':round(time.monotonic()-start,1)}
        if isinstance(error,urllib.error.HTTPError): outcome['httpStatus']=error.code
    print(json.dumps(outcome),flush=True)
    return outcome

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--sizes',type=int,nargs='+',default=[1000])
    args=parser.parse_args()
    print(json.dumps({'addressFamilies':list(sorted({str(r[0]) for r in socket.getaddrinfo('openapi.gg.go.kr',443)}))}),flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(probe,['CCTV','SECRTLGT','AnimalRegistStus','Secrtlgt']))
    probe('CCTV',1,False)
    if any(r.get('code')!='INFO-000' for r in results): raise SystemExit('Official API connectivity failed in this runner.')
    sizes=[probe('CCTV',size) for size in args.sizes]
    if not any(r.get('code')=='INFO-000' for r in sizes): raise SystemExit('No tested page size completed.')
