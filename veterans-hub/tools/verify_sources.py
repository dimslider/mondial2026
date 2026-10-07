#!/usr/bin/env python3
"""
מאמת את המאגר מול האתרים עצמם (לא מול תקצירי חיפוש).

  python3 tools/verify_sources.py              # כל השירותים
  python3 tools/verify_sources.py --only-unverified

לכל שירות: נכנס ל-source_url ול-website, שומר את טקסט העמוד ב-research/pages/<id>.txt,
בודק שהעמוד חי, ששם הגוף מופיע בו, ושמספר הטלפון שבמאגר מופיע בעמוד. מוציא:
  research/verification.csv   — טבלה לבדיקה: מה עבר, מה נכשל ולמה
  research/verification.json  — אותו דבר למכונה; build_data.py קורא אותו ומסמן verified_at
השלב הבא (ידני או ע"י Claude בסשן עם גישת רשת): לעבור על השורות שנכשלו ועל טקסט העמודים,
ולתקן את קבצי research/*.json.

דורש גישת אינטרנט רגילה. אין תלויות חיצוניות.
"""
import concurrent.futures as cf
import csv
import gzip
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PAGES = ROOT / "research" / "pages"
UA = "Mozilla/5.0 (veterans-hub source verifier)"


def load_services():
    txt = (ROOT / "data" / "services.js").read_text(encoding="utf-8")
    return json.loads(re.search(r"window\.SERVICES\s*=\s*(\[.*\]);", txt, re.S).group(1))


def _get(url):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "he,en"})
        with urllib.request.urlopen(req, timeout=25) as r:
            raw = r.read(3_000_000)
            if raw[:2] == b"\x1f\x8b":  # יש שרתים ששולחים gzip גם בלי שביקשנו
                raw = gzip.decompress(raw)
            charset = r.headers.get_content_charset() or "utf-8"
            body = raw.decode(charset, errors="replace")
            return r.status, r.geturl(), body
    except urllib.error.HTTPError as e:
        return e.code, url, ""
    except Exception as e:  # DNS, TLS, timeout
        return None, url, f"ERROR: {e.__class__.__name__}: {e}"


def fetch(url):
    if not url:
        return None, "", ""
    if not re.match(r"https?://", url):
        url = "https://" + url
    url = urllib.parse.quote(url, safe=":/?&=%#+@,;~!$'()*[]")
    status, final, body = _get(url)
    # אתר אגף השיקום מרנדר את הטקסט ב-JavaScript; התוכן עצמו זמין ב-API של האתר לפי pageId
    m = re.search(r'"pageId":(\d+)', body)
    if m and "shikum" in (final or url):
        base = re.match(r"https?://[^/]+", final or url).group(0)
        _, _, api = _get(f"{base}/api/Umbraco/getDynamicPage/?pageId={m.group(1)}")
        try:
            vals = []
            def walk(o):
                if isinstance(o, dict):
                    for v in o.values():
                        walk(v)
                elif isinstance(o, list):
                    for v in o:
                        walk(v)
                elif isinstance(o, str):
                    vals.append(o)
            walk(json.loads(api))
            body += "\n" + " ".join(vals)
        except ValueError:
            pass
    return status, final, body


def to_text(body):
    body = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", body)
    body = re.sub(r"(?s)<[^>]+>", " ", body)
    return re.sub(r"\s+", " ", html.unescape(body)).strip()


def digits(s):
    return re.sub(r"[^\d*]", "", s or "")


def name_tokens(name):
    name = re.sub(r"\(.*?\)", "", name)
    return [w for w in re.split(r"[\s\-–—\"״'׳:,.]+", name) if len(w) >= 3][:4]


def check(s):
    res = {"id": s["id"], "name": s["name"], "checked_at": date.today().isoformat(), "issues": []}
    texts = []
    for field in ("source_url", "website"):
        url = s.get(field, "")
        if not url or (field == "website" and url == s.get("source_url")):
            continue
        status, final, body = fetch(url)
        res[field + "_status"] = status or body[:80]
        if status and 200 <= status < 400 and body:
            texts.append(to_text(body))
            if final and final.rstrip("/") != url.rstrip("/"):
                res[field + "_redirect"] = final
        else:
            res["issues"].append(f"{field} לא נגיש ({res[field + '_status']})")
    page = "\n\n".join(texts)
    if page:
        PAGES.mkdir(parents=True, exist_ok=True)
        (PAGES / f"{s['id']}.txt").write_text(page[:200_000], encoding="utf-8")
        toks = name_tokens(s["name"])
        hits = sum(1 for t in toks if t in page)
        if toks and hits == 0:
            res["issues"].append("שם הגוף לא מופיע בעמוד")
        if s.get("phone"):
            first = digits(re.split(r"\||או|,", s["phone"])[0])
            if first and first not in digits(page):
                res["issues"].append("הטלפון במאגר לא מופיע בעמוד")
        found = sorted(set(re.findall(r"(?<!\d)(?:\*\d{4}|1-?[78]00-?\d{2,3}-?\d{3,4}|0\d{1,2}-?\d{7}|0\d{1,2}-\d{3}-\d{4})(?!\d)", page)))
        res["phones_on_page"] = found[:8]
    else:
        res["issues"].append("אין אף עמוד נגיש לאימות")
    res["ok"] = not res["issues"]
    return res


def main():
    services = load_services()
    out_json = ROOT / "research" / "verification.json"
    prev = {}
    if out_json.exists():
        prev = {r["id"]: r for r in json.loads(out_json.read_text(encoding="utf-8"))}
    if "--only-unverified" in sys.argv:
        services = [s for s in services if not prev.get(s["id"], {}).get("ok")]
    with cf.ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(check, services))
    merged = dict(prev)
    merged.update({r["id"]: r for r in results})
    out_json.write_text(json.dumps(list(merged.values()), ensure_ascii=False, indent=1), encoding="utf-8")
    with open(ROOT / "research" / "verification.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["id", "name", "ok", "issues", "phones_on_page", "source_status", "website_status"])
        for r in merged.values():
            w.writerow([r["id"], r["name"], r["ok"], " ; ".join(r["issues"]), " ".join(r.get("phones_on_page", [])),
                        r.get("source_url_status", ""), r.get("website_status", "")])
    ok = sum(1 for r in results if r["ok"])
    print(f"נבדקו {len(results)}: {ok} עברו, {len(results) - ok} דורשים תיקון → research/verification.csv")


if __name__ == "__main__":
    main()
