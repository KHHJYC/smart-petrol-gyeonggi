"""Protect the last good map before replacing any normalized public files."""
import json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from build_site import facility

def check_counts(kind, mapped, previous):
    # This is a release review guard, not an official public-data standard.
    if previous >= 100 and mapped < previous * .9:
        raise RuntimeError(f'{kind}: coordinate records dropped from {previous} to {mapped}; current API coordinates are insufficient. Previous public map retained. Review the official source before publishing.')

def main():
    baseline=json.loads((ROOT/'public/data/manifest.json').read_text(encoding='utf8'))
    for kind in ('cctv','lights'):
        raw=json.loads((ROOT/'data/raw'/f'{kind}.json').read_text(encoding='utf8'))
        mapped=sum(facility(row,kind,index)['lat'] is not None for index,row in enumerate(raw))
        previous=baseline['sources'][kind]['mapped']
        print(f'{kind}: {mapped}/{len(raw)} coordinates; previous map {previous}',flush=True)
        check_counts(kind,mapped,previous)

if __name__=='__main__': main()
