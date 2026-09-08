"""Collect all four Gyeonggi APIs. Secrets are read only from the environment."""
import concurrent.futures, gzip, json, os, pathlib, threading, urllib.error, urllib.parse, urllib.request

SERVICES = {'cctv': 'CCTV', 'lights': 'SECRTLGT', 'pets': 'AnimalRegistStus', 'lightingSummary': 'Secrtlgt'}

def fetch_page(service, page, key, cancel=None):
    cancel = cancel or threading.Event()
    query = urllib.parse.urlencode({'KEY': key, 'Type': 'json', 'pIndex': page, 'pSize': 1000})
    for attempt in range(3):
        if cancel.is_set(): raise RuntimeError('Collection cancelled')
        try:
            req = urllib.request.Request('https://openapi.gg.go.kr/' + service + '?' + query, headers={'Accept': '*/*', 'Accept-Encoding': 'gzip', 'User-Agent': 'SmartPetrolData/2.0'})
            with urllib.request.urlopen(req, timeout=30) as response:
                payload = response.read()
            body = json.loads(gzip.decompress(payload) if payload[:2] == b'\x1f\x8b' else payload)
            blocks = body.get(service, [])
            head = next((b['head'] for b in blocks if 'head' in b), [])
            result = next((h['RESULT'] for h in head if 'RESULT' in h), body.get('RESULT', {}))
            total = next((h['list_total_count'] for h in head if 'list_total_count' in h), None)
            rows = next((b['row'] for b in blocks if 'row' in b), None)
            if result.get('CODE') != 'INFO-000' or not isinstance(total, int) or not isinstance(rows, list):
                raise ValueError('Invalid API response')
            if not 0 < total <= 1500000: raise ValueError('Invalid total count')
            return total, rows
        except Exception as error:
            # Error classes and HTTP status are enough for diagnostics. Never log
            # request URLs, headers, response bodies, or key-bearing exceptions.
            reason = f'HTTP {error.code}' if isinstance(error, urllib.error.HTTPError) else type(error).__name__
            print(f'{service}: page {page}, attempt {attempt + 1}: {reason}', flush=True)
            if attempt == 2 or cancel.is_set():
                raise RuntimeError(f'{service} page {page}: collection failed ({reason}); previous publication retained') from None
            if cancel.wait(2 ** attempt): raise RuntimeError('Collection cancelled') from None

def collect(service, key):
    print(f'{service}: requesting first page', flush=True)
    total, first = fetch_page(service, 1, key)
    batches = {1: first}
    pages = (total + 999) // 1000
    print(f'{service}: first page received; {total} rows, {pages} pages', flush=True)
    cancel = threading.Event()
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)
    try:
        jobs = {pool.submit(fetch_page, service, p, key, cancel): p for p in range(2, pages + 1)}
        for job in concurrent.futures.as_completed(jobs):
            p = jobs[job]
            n, rows = job.result()
            if n != total: raise RuntimeError(f'{service}: source changed during collection; previous publication retained')
            batches[p] = rows
            if len(batches) % 10 == 0: print(f'{service}: {len(batches)}/{pages} pages', flush=True)
    except BaseException:
        cancel.set()
        pool.shutdown(wait=True, cancel_futures=True)
        raise
    else:
        pool.shutdown(wait=True)
    rows = [r for p in sorted(batches) for r in batches[p]]
    if len(rows) != total: raise RuntimeError(f'{service}: missing rows; previous publication retained')
    print(f'{service}: verified {total} rows', flush=True)
    return rows

def main():
    key = os.environ.get('GG_API_KEY', '').strip()
    if not key: raise SystemExit('GG_API_KEY secret is required')
    target = pathlib.Path('data/raw')
    target.mkdir(parents=True, exist_ok=True)
    # Only replace the raw snapshot after ALL services succeed.
    snapshots = {kind: collect(service, key) for kind, service in SERVICES.items()}
    for kind, rows in snapshots.items():
        (target / (kind + '.json')).write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    from datetime import datetime, timezone
    (target / 'collected.json').write_text(json.dumps({'checkedAt': datetime.now(timezone.utc).isoformat(), 'mode': 'api'}), encoding='utf-8')

if __name__ == '__main__': main()
