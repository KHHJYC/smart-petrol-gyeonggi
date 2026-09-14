"""Run a full validated refresh, using a process secret or ignored local .dev.vars."""
import os, pathlib, runpy, sys
root=pathlib.Path(__file__).resolve().parents[1]
os.chdir(root)
if not os.environ.get('GG_API_KEY'):
    local=root/'.dev.vars'
    if local.exists():
        for line in local.read_text(encoding='utf-8').splitlines():
            if '=' in line and line.split('=',1)[0] in ('GG_API_KEY','MAFRA_API_KEY'):
                name,value=line.split('=',1)
                os.environ[name]=value.strip().strip('"').strip("'")
if not os.environ.get('GG_API_KEY'): sys.exit('GG_API_KEY is required in the process environment or ignored .dev.vars')
runpy.run_path(str(root/'collect_gg.py'),run_name='__main__')
runpy.run_path(str(root/'collect_pet_cumulative.py'),run_name='__main__')
runpy.run_path(str(root/'scripts/check_data_quality.py'),run_name='__main__')
runpy.run_path(str(root/'build_site.py'),run_name='__main__')
runpy.run_path(str(root/'scripts/lighting_summary.py'),run_name='__main__')
runpy.run_path(str(root/'scripts/inspection_grid.py'),run_name='__main__')
