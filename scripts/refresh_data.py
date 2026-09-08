"""Run a full validated refresh, using a process secret or ignored local .dev.vars."""
import os, pathlib, runpy, sys
root=pathlib.Path(__file__).resolve().parents[1]
os.chdir(root)
if not os.environ.get('GG_API_KEY'):
    local=root/'.dev.vars'
    if local.exists():
        for line in local.read_text(encoding='utf-8').splitlines():
            if line.startswith('GG_API_KEY='):
                os.environ['GG_API_KEY']=line.split('=',1)[1].strip().strip('"').strip("'")
if not os.environ.get('GG_API_KEY'): sys.exit('GG_API_KEY is required in the process environment or ignored .dev.vars')
runpy.run_path(str(root/'collect_gg.py'),run_name='__main__')
runpy.run_path(str(root/'build_site.py'),run_name='__main__')
runpy.run_path(str(root/'scripts/lighting_summary.py'),run_name='__main__')
runpy.run_path(str(root/'scripts/inspection_grid.py'),run_name='__main__')
