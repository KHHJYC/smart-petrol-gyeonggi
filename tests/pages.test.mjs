import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {gzipSync,gunzipSync} from 'node:zlib';
import fs from 'node:fs';
import vm from 'node:vm';

async function environment(plain=false) {
  const storage=new Map();const requests=[];
  const original=async(input)=>{const u=String(input);requests.push(u);return new Response(plain?'{"ok":true}':gzipSync('{"ok":true}'))};
  const context=vm.createContext({window:{location:{href:'https://example.github.io/smart-petrol-gyeonggi/',origin:'https://example.github.io'},fetch:original,DecompressionStream},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},Response,Request,URL,Blob,DecompressionStream,atob,crypto});
  for(const [file,name] of [['html-preview/runtime.ts','Records'],['pages/runtime.ts','Data']]) {
    const code=await build({entryPoints:[file],bundle:true,write:false,format:'iife',globalName:name,platform:'browser'});
    vm.runInContext(code.outputFiles[0].text,context);
  }
  context.Records.installHtmlPreview({storageKey:'test-records'});
  context.Data.installCompressedData();
  return {context,storage,requests,request:context.window.fetch};
}
test('mobile data transport uses repository path and handles raw or decoded gzip',async()=>{
  for(const plain of [false,true]) {
    const e=await environment(plain);
    assert.deepEqual(await (await e.request('/smart-petrol-gyeonggi/data/manifest.json')).json(),{ok:true});
    assert.ok(e.requests[0].endsWith('/smart-petrol-gyeonggi/data/manifest.json.gz'));
  }
});
test('records stay on device and require evidence for a status change',async()=>{
  const e=await environment();
  const saved=await e.request('/api/records',{method:'POST',body:JSON.stringify({kind:'report',title:'조명 확인',description:'점등 상태 관찰',lat:37.42,lng:127.12})});
  assert.equal(saved.status,201);const {id}=await saved.json();
  assert.equal((await(await e.request('/api/records')).json()).reports[0].id,id);
  assert.equal((await e.request('/api/records',{method:'PATCH',body:JSON.stringify({id,status:'조치 확인',evidence:''})})).status,400);
  assert.equal((await e.request('/api/records',{method:'PATCH',body:JSON.stringify({id,status:'현장 확인',evidence:'현장에서 점등 확인'})})).status,200);
  assert.equal(e.requests.length,0);assert.ok(e.storage.has('test-records'));
});
test('deployed public data matches the validated source without losing any regions',()=>{
  const names=['manifest.json','inspection.json','briefing.json','lighting-summary.json',...fs.readdirSync('public/data/regions').filter(n=>n.endsWith('.json')).map(n=>'regions/'+n)];
  for(const name of names)assert.deepEqual(gunzipSync(fs.readFileSync('site-static/data/'+name+'.gz')),fs.readFileSync('public/data/'+name));
  const html=fs.readFileSync('site-static/index.html','utf8');
  assert.ok(html.includes('/smart-petrol-gyeonggi/assets/'));
  assert.ok(html.includes('이 브라우저에 저장'));
  assert.ok(fs.existsSync('site-static/images/proposal-art.jpg'));
});
