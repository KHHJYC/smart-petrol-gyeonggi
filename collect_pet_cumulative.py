"""Collect cumulative animal registrations from the official MAFRA Open API."""
import concurrent.futures, json, os, pathlib, urllib.parse, urllib.request
from datetime import datetime, timezone

SERVICE = "Grid_20210806000000000612_1"
BASE = "http://211.237.50.150:7080/openapi"
PAGE_SIZE = 1000


def fetch_page(key, start, end):
    query = urllib.parse.urlencode({"CTPV": "경기도"})
    url = f"{BASE}/{urllib.parse.quote(key, safe='')}/json/{SERVICE}/{start}/{end}?{query}"
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "SmartPetrolData/2.0"})
        with urllib.request.urlopen(request, timeout=40) as response:
            body = json.loads(response.read())
        block = body.get(SERVICE, {})
        result = block.get("result", {})
        rows = block.get("row", [])
        total = block.get("totalCnt")
        if result.get("code") != "INFO-000" or not isinstance(total, int) or not isinstance(rows, list):
            raise ValueError("invalid response")
        return total, rows
    except Exception as error:
        raise RuntimeError(f"MAFRA animal registration page {start}-{end} failed ({type(error).__name__})") from None


def collect(key):
    total, first = fetch_page(key, 1, PAGE_SIZE)
    pages = [(start, min(total, start + PAGE_SIZE - 1)) for start in range(PAGE_SIZE + 1, total + 1, PAGE_SIZE)]
    rows = list(first)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs = {pool.submit(fetch_page, key, start, end): (start, end) for start, end in pages}
        batches = {}
        for job in concurrent.futures.as_completed(jobs):
            start, _ = jobs[job]
            seen_total, page = job.result()
            if seen_total != total:
                raise RuntimeError("MAFRA animal registration source changed during collection")
            batches[start] = page
    for start, _ in pages:
        rows.extend(batches[start])
    if len(rows) != total:
        raise RuntimeError(f"MAFRA animal registration rows incomplete: {len(rows)}/{total}")
    totals = {}
    for row in rows:
        city = str(row.get("SGG") or "").strip()
        species = str(row.get("LVSTCK_KND") or "").strip()
        try:
            count = int(row.get("CNT") or 0)
        except (TypeError, ValueError):
            continue
        if city:
            item = totals.setdefault(city, {"dogs": 0, "cats": 0, "other": 0, "total": 0})
            item["dogs" if species == "개" else "cats" if species == "고양이" else "other"] += count
            item["total"] += count
    return {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "source": "농림축산식품부 농림축산검역본부 동물등록 현황",
        "endpoint": SERVICE,
        "scope": "경기도 누적 등록 운영자료",
        "includesDeceased": True,
        "sourceRows": total,
        "cities": totals,
    }


def main():
    key = os.environ.get("MAFRA_API_KEY", "").strip()
    if not key:
        print("MAFRA_API_KEY is not set; keeping the previous cumulative snapshot", flush=True)
        return
    payload = collect(key)
    target = pathlib.Path("data/raw/petCumulative.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"MAFRA animal registration: verified {payload['sourceRows']} Gyeonggi rows", flush=True)


if __name__ == "__main__":
    main()
