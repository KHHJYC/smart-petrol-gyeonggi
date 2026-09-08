"""Reject secrets, local records, runtime bindings and source files in a web artifact."""
import gzip, os, pathlib, sys
root=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else 'site-static')
keys=[os.environ.get('GG_API_KEY','').strip()]
if len(sys.argv)>2:
    for line in pathlib.Path(sys.argv[2]).read_text(encoding='utf8').splitlines():
        if line.startswith('GG_API_KEY='): keys.append(line.split('=',1)[1].strip().strip('\"\''))
keys=[k.encode() for k in keys if k]
count=0
for p in root.rglob('*'):
    if not p.is_file(): continue
    if p.suffix in {'.sqlite','.db','.ts','.tsx','.map','.py'} or p.name.startswith(('.env','.dev.vars')):
        raise SystemExit('Nonpublic file in website artifact')
    content=p.read_bytes()
    if p.suffix=='.gz': content=gzip.decompress(content)
    if any(k in content for k in keys): raise SystemExit('Credential detected; publication blocked')
    if b'oai-authenticated-user-id' in content: raise SystemExit('Server authentication source in public artifact')
    count+=1
assert (root/'index.html').is_file()
print(f'Public artifact checked: {count} files; credentials and server source excluded.')
