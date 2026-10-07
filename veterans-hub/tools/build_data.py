#!/usr/bin/env python3
"""
מאחד קבצי מחקר (JSON) לקובץ המאגר data/services.js שהאתר טוען.

  python3 tools/build_data.py research/*.json
  python3 tools/build_data.py --extra tools/telegram_out/candidates.json   # הוספה למאגר הקיים

- מנרמל ערכים לפי data/taxonomy.js (ערך לא מוכר נזרק עם אזהרה)
- מאחד כפילויות לפי שם מנורמל / אותו עמוד מקור
- נותן לכל שירות מזהה יציב (slug)
"""
import difflib
import hashlib
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "services.js"
TAX = (ROOT / "data" / "taxonomy.js").read_text(encoding="utf-8")


def keys_of(block):
    m = re.search(block + r":\s*\{(.*?)\n  \}", TAX, re.S)
    return set(re.findall(r'^\s*"([a-z\-]+)"\s*:', m.group(1), re.M)) | set(re.findall(r'"([a-z\-]+)":\s*"', m.group(1)))


VALID = {k: keys_of(k) for k in ["categories", "eligibility", "difficulties", "interests", "regions", "cost", "providerTypes"]}
LIST_FIELDS = {"eligibility": "eligibility", "difficulties": "difficulties", "interests": "interests", "regions": "regions"}
FIELDS = ["id", "name", "category", "description", "provider_type", "eligibility", "difficulties", "interests",
          "cost", "cost_notes", "regions", "location", "phone", "email", "website", "how_to_apply",
          "source_url", "confidence", "reviewed_at"]


def norm_name(n):
    n = re.sub(r"\(.*?\)", "", n or "")
    n = re.sub(r"[\"״'׳\-–—.,:]", " ", n)
    n = re.sub(r"^(עמותת|עמותה|ארגון|תוכנית|פרויקט)\s+", "", n.strip())
    return re.sub(r"\s+", " ", n).strip().lower()


def host(u):
    u = re.sub(r"^https?://", "", (u or "").lower()).removeprefix("www.")
    h = u.split("/")[0]
    # רשתות חברתיות ואתרי ממשלה משותפים לגופים רבים — לא מפתח לזיהוי כפילות
    if h in ("", "facebook.com", "instagram.com", "gov.il", "kolzchut.org.il", "linktr.ee", "t.me", "wa.me"):
        return ""
    return h


def page_key(u):
    """מפתח לעמוד מקור ספציפי; דף בית (בלי נתיב) לא נחשב."""
    u = re.sub(r"^https?://(www\.)?", "", (u or "").strip().lower()).split("#")[0].rstrip("/")
    return u if "/" in u else ""


def slug(s):
    base = re.sub(r"[^a-z0-9]+", "-", host(s.get("website")) or "").strip("-")
    h = hashlib.sha1(norm_name(s["name"]).encode()).hexdigest()[:6]
    return (base[:24] + "-" if base else "s-") + h


def clean(s, warn):
    out = {f: s.get(f, "") for f in FIELDS}
    out["name"] = (out["name"] or "").strip()
    if out["category"] not in VALID["categories"]:
        warn(f"{out['name']}: קטגוריה לא מוכרת {out['category']!r}")
        out["category"] = "peer-support"
    if out["cost"] and out["cost"] not in VALID["cost"]:
        warn(f"{out['name']}: עלות לא מוכרת {out['cost']!r}")
        out["cost"] = ""  # ריק = "לא ידוע" באתר; לא מנחשים עלות שלא כתובה במקור
    if out["provider_type"] not in VALID["providerTypes"]:
        out["provider_type"] = "ngo"
    for f, tax in LIST_FIELDS.items():
        vals = s.get(f) or []
        if isinstance(vals, str):
            vals = [vals]
        bad = [v for v in vals if v not in VALID[tax]]
        if bad:
            warn(f"{out['name']}: ערכים לא מוכרים ב-{f}: {bad}")
        out[f] = sorted(set(v for v in vals if v in VALID[tax]))
    for f in ("phone", "email", "website", "source_url", "location", "cost_notes", "how_to_apply", "description", "reviewed_at"):
        out[f] = (out[f] or "").strip()
    if out["confidence"] not in ("high", "medium", "low"):
        out["confidence"] = "medium"
    return out


def merge(a, b):
    """משלים שדות ריקים ב-a מתוך b, ומאחד רשימות."""
    for f in FIELDS:
        if f in LIST_FIELDS:
            a[f] = sorted(set(a[f]) | set(b[f]))
        elif not a.get(f) and b.get(f):
            a[f] = b[f]
    if len(b.get("description", "")) > len(a.get("description", "")) * 1.5:
        a["description"] = b["description"]
    rank = {"high": 2, "medium": 1, "low": 0}
    if rank[b["confidence"]] > rank[a["confidence"]]:
        a["confidence"] = b["confidence"]
    return a


def load_existing():
    if not OUT.exists():
        return []
    txt = OUT.read_text(encoding="utf-8")
    m = re.search(r"window\.SERVICES\s*=\s*(\[.*\]);", txt, re.S)
    return json.loads(m.group(1)) if m else []


def main():
    args = sys.argv[1:]
    extra = "--extra" in args
    # verification.json הוא דוח של verify_sources.py, לא קובץ מחקר — מדלגים עליו גם כשהוא נכנס ב-research/*.json
    files = [a for a in args if a != "--extra" and Path(a).name != "verification.json"]
    warnings = []
    items = load_existing() if extra else []
    for f in files:
        data = json.loads(Path(f).read_text(encoding="utf-8"))
        items.extend(clean(s, warnings.append) for s in data if s.get("name"))

    # כפילות = אותו שם מנורמל, או אותו עמוד מקור (לא דף בית) עם שם דומה. לא לפי דומיין או טלפון:
    # באתר אגף השיקום / ביטוח לאומי, ובקווים משותפים כמו *5486, יש הרבה שירותים שונים.
    merged, by_name, by_src = [], {}, {}
    for s in items:
        if not s.get("id"):
            s["id"] = ""
        n, src = norm_name(s["name"]), page_key(s["source_url"])
        idx = by_name.get(n)
        if idx is None and src and src in by_src:
            cand = by_src[src]
            # עמוד אחד מפרט לפעמים כמה שירותים (רשימת חוות, מרכזי חוסן) — מאחדים רק אם גם השם דומה
            if difflib.SequenceMatcher(None, n, norm_name(merged[cand]["name"])).ratio() >= 0.6:
                idx = cand
        if idx is not None:
            merge(merged[idx], s)
            continue
        by_name[n] = len(merged)
        if src:
            by_src[src] = len(merged)
        merged.append(s)

    seen = set()
    for s in merged:
        if not s["id"]:
            s["id"] = slug(s)
        while s["id"] in seen:
            s["id"] += "x"
        seen.add(s["id"])

    # סימון אימות מול אתר הגוף עצמו (tools/verify_sources.py)
    ver_path = ROOT / "research" / "verification.json"
    ver = {r["id"]: r for r in json.loads(ver_path.read_text(encoding="utf-8"))} if ver_path.exists() else {}
    for s in merged:
        r = ver.get(s["id"])
        # "מאומת" = התוכן נקרא ותוקן ידנית מול העמוד הרשמי (reviewed_at בקובץ המחקר).
        # הבדיקה האוטומטית לבדה (עמוד חי, שם וטלפון מופיעים) לא מספיקה לרשומה ברמת ביטחון בינונית/נמוכה.
        auto = r["checked_at"] if r and r.get("ok") and s["confidence"] == "high" else ""
        s["verified_at"] = s.get("reviewed_at", "") or auto

    order = list(sorted(VALID["categories"]))
    merged.sort(key=lambda s: (s["category"] != "hotlines", order.index(s["category"]), s["name"]))
    OUT.write_text(
        "// נוצר אוטומטית ע\"י tools/build_data.py — לא לערוך ידנית; לעדכן את קבצי המחקר ולהריץ מחדש.\n"
        f"window.SERVICES_UPDATED = \"{date.today().isoformat()}\";\n"
        "window.SERVICES = " + json.dumps(merged, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8")
    for w in warnings:
        print("⚠", w)
    print(f"{len(items)} רשומות → {len(merged)} שירותים ייחודיים → {OUT}")


if __name__ == "__main__":
    main()
