"""Create a portable source ZIP without credentials, local records or caches."""
import pathlib,sys,zipfile,hashlib,json
root=pathlib.Path(__file__).resolve().parents[1]
out=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'outputs'
out.mkdir(parents=True,exist_ok=True)
directories={'app','components','db','drizzle','hooks','lib','public','scripts','tests','html-preview','.github','.openai'}
files={'package.json','package-lock.json','tsconfig.json','next.config.ts','vite.config.ts','drizzle.config.ts','wrangler.local.jsonc','components.json','.gitignore','.oxlintrc.json','.oxfmtrc.json','.dev.vars.example','README.md','VALIDATION.md','GITHUB_이전전_안내.md','조명자료_사실검증.md','collect_gg.py','build_site.py','로컬실행.cmd'}
obsolete={'components/atlas-map.tsx','lib/cctv.ts','lib/cctv.test.mjs','public/data/cctv.json','public/data/summary.json'}
secret_file=root/'.dev.vars'
secrets=[]
if secret_file.exists():
 secrets=[line.split('=',1)[1].strip().strip('"').strip("'").encode() for line in secret_file.read_text(encoding='utf8').splitlines() if line.startswith('GG_API_KEY=') and line.split('=',1)[1].strip()]
selected=[]
for p in root.rglob('*'):
 if not p.is_file():continue
 rel=p.relative_to(root);parts=rel.parts
 if not (parts[0] in directories or rel.as_posix() in files):continue
 if any(part in {'node_modules','.git','.wrangler','__pycache__','dist','.next','.vinext','outputs'} for part in parts):continue
 if rel.as_posix() in obsolete or p.suffix in {'.pyc','.sqlite','.db'}:continue
 if p.name.startswith('.env') or (p.name.startswith('.dev.vars') and p.name!='.dev.vars.example'):continue
 payload=p.read_bytes()
 if any(s and s in payload for s in secrets):raise RuntimeError('Credential found in release candidate; packaging aborted')
 selected.append((p,rel.as_posix()))
archive=out/'smart-petrol-final.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p,rel in selected:z.write(p,'smart-petrol/'+rel)
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 assert 'smart-petrol/package.json' in z.namelist()
 assert 'smart-petrol/public/data/lighting-summary.json' in z.namelist()
 assert not any('/.git/' in n or '/.wrangler/' in n or n.endswith('/.dev.vars') for n in z.namelist())
checksum=hashlib.sha256(archive.read_bytes()).hexdigest()
(out/'SHA256.txt').write_text(checksum+'  '+archive.name+'\n',encoding='utf8')
print(json.dumps({'archive':str(archive),'files':len(selected),'bytes':archive.stat().st_size,'sha256':checksum,'credentialScan':'passed'},ensure_ascii=False))
