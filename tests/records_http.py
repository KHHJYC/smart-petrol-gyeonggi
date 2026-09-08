"""Exercise only isolated local-preview test accounts; never create production records."""
import json, urllib.request, urllib.error, os, time
BASE=os.environ.get('TEST_BASE','http://localhost:8787')+'/api/records'
USER='smart-petrol-validation'
def call(method='GET', body=None, user=USER, origin='http://localhost:8787'):
    time.sleep(0.3)
    req=urllib.request.Request(BASE,method=method,headers={'Content-Type':'application/json','oai-authenticated-user-id':user,'Origin':origin},data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req,timeout=30) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:
        raw=e.read().decode('utf-8',errors='replace')
        try:return e.code,json.loads(raw)
        except ValueError:return e.code,raw[:1200]
valid={'kind':'report','title':'검증 전용 시설 기록','description':'테스트 계정 전용 기록입니다.','city':'성남시','category':'보안등 꺼짐·깜빡임','observedAt':'2026-09-08T18:00','lat':37.42,'lng':127.1267,'radius':100,'cctv':2,'lights':4,'sourceAt':'2026-09-08'}
status,record=call('POST',valid);assert status==201,(status,record)
rid=record['id'];assert any(r['id']==rid for r in call()[1]['reports'])
assert all(r['id']!=rid for r in call(user='another-validation-account')[1]['reports'])
assert call('PATCH',{'id':rid,'status':'조치 확인','evidence':''})[0]==400
assert call('PATCH',{'id':rid,'status':'조치 확인','evidence':'테스트 근거'},user='another-validation-account')[0]==404
assert call('PATCH',{'id':rid,'status':'조치 확인','evidence':'재방문하여 점등 확인. 검증 전용.'})[0]==200
assert next(r for r in call()[1]['reports'] if r['id']==rid)['status']=='조치 확인'
assert call('POST',dict(valid,lat=0))[0]==400
assert call('POST',valid,origin='https://unrelated.example')[0]==403
out=call('POST',{'kind':'patrol','city':'성남시','memo':'검증 계정 전용 순찰일지','checks':['목줄·배변봉투 준비'],'started':'2026-09-08T08:00:00Z','ended':'2026-09-08T08:15:00Z'})
assert out[0]==201,out
assert call()[1]['patrols'][0]['seconds']==900
print('Passed: create/read persistence, account isolation, evidence requirement, update, coordinate validation, cross-origin rejection, patrol duration')
