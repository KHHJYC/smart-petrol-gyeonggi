type Snapshot={reports:Record<string,unknown>[];patrols:Record<string,unknown>[]};
declare global {interface Window {__SMART_HTML_DATA__:Record<string,string>;__SMART_HTML_IMAGE__:string;}}
const STORAGE='smart-petrol-html-preview-v1';
function load(storageKey:string):Snapshot{try{const data=JSON.parse(localStorage.getItem(storageKey)||'null');if(Array.isArray(data?.reports)&&Array.isArray(data?.patrols))return data}catch{}return {reports:[],patrols:[]}}
function persist(data:Snapshot,storageKey:string){localStorage.setItem(storageKey,JSON.stringify(data))}
function response(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json;charset=utf-8'}})}
export function installHtmlPreview(options:{storageKey?:string;apiError?:string}={}){
 const storageKey=options.storageKey||STORAGE;
 const originalFetch=window.fetch.bind(window);
 window.fetch=async(input:RequestInfo|URL,init?:RequestInit)=>{
  const raw=input instanceof Request?input.url:String(input);
  const path=new URL(raw,window.location.href).pathname;
  const key=Object.keys(window.__SMART_HTML_DATA__||{}).find(k=>path.endsWith('/'+k));
  if(key){if(!('DecompressionStream' in window))return response({error:'최신 Chrome 또는 Edge에서 열어 주세요.'},503);const binary=atob(window.__SMART_HTML_DATA__[key]);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),{headers:{'Content-Type':'application/json'}})}
  if(path.endsWith('/api/records')){
   const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
   const state=load(storageKey);
   if(method==='GET')return response({...state,checkedAt:new Date().toISOString()});
   try{
    const data=JSON.parse(String(init?.body||'{}'));const now=new Date().toISOString();
    if(method==='POST'){
     const id=crypto.randomUUID();
     if(data.kind==='report'){
      if(!data.title?.trim()||!data.description?.trim()||!Number.isFinite(data.lat)||!Number.isFinite(data.lng))return response({error:'제목·위치·내용을 확인해 주세요.'},400);
      state.reports.unshift({id,title:data.title,description:data.description,city:data.city,category:data.category,lat:data.lat,lng:data.lng,observed_at:data.observedAt,status:'접수',evidence:'',radius:data.radius,cctv:data.cctv??null,lights:data.lights??null,source_at:data.sourceAt,created:now,updated:now});
     }else if(data.kind==='patrol'){
      const seconds=Math.floor((Date.parse(data.ended)-Date.parse(data.started))/1000);
      if(!data.memo?.trim()||!Number.isFinite(seconds)||seconds<0||seconds>86400)return response({error:'시간과 내용을 확인해 주세요.'},400);
      state.patrols.unshift({id,city:data.city,memo:data.memo,checks:JSON.stringify(data.checks||[]),started:data.started,ended:data.ended,seconds});
     }else return response({error:'기록 유형을 확인해 주세요.'},400);
     persist(state,storageKey);return response({id},201);
    }
    if(method==='PATCH'){
     const row=state.reports.find(r=>r.id===data.id);if(!row)return response({error:'해당 기록이 없습니다.'},404);
     if(!['접수','현장 확인','조치 확인','종료'].includes(data.status)||(data.status!=='접수'&&!data.evidence?.trim()))return response({error:'확인 근거를 적어 주세요.'},400);
     Object.assign(row,{status:data.status,evidence:String(data.evidence||''),updated:now});persist(state,storageKey);return response({ok:true});
    }
    return response({error:'지원하지 않는 요청입니다.'},405);
   }catch{return response({error:'브라우저 임시 저장을 사용할 수 없습니다. 초안 내려받기를 이용해 주세요.'},503)}
  }
  if(path.includes('/api/'))return response({error:options.apiError||'HTML 미리보기에는 API 자동 갱신이 연결되어 있지 않습니다.'},503);
  return originalFetch(input,init);
 };
}
