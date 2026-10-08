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
          "source_url", "confidence", "reviewed_at", "community_recs", "community_note", "unit_only",
          "kind", "intensity", "recognition", "police", "format", "town", "lat", "lng", "war_only"]


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
        if f == "interests":   # "טיולים ונסיעות" אוחד עם "טבע, טיולים ומסעות"
            vals = ["nature" if v == "travel" else v for v in vals]
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
    # המלצות מהקהילה: מספר ממליצים שונים. לוקחים את הגבוה.
    if (b.get("community_recs") or 0) > (a.get("community_recs") or 0):
        a["community_recs"], a["community_note"] = b["community_recs"], b.get("community_note", "")
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

    # המלצות מהקהילה (research/community/recs.json): מספר הודעות המלצה ותקציר כללי, לפי שם מדויק או tg_key
    rec_path = ROOT / "research" / "community" / "recs.json"
    if rec_path.exists():
        by = {norm_name(s["name"]): s for s in merged}
        for r in json.loads(rec_path.read_text(encoding="utf-8")):
            t = by.get(norm_name(r["name"]))
            if not t:
                warnings.append(f"המלצת קהילה בלי שירות תואם: {r['name']}")
                continue
            t["community_recs"], t["community_note"] = r["recs"], r.get("note", "")
    for s in merged:
        s.pop("tg_key", None)

    # תיקוני הגהה (research/community/corrections.json): לפי מזהה. _remove = להוריד, _hide = להסתיר עד בדיקה ידנית
    cor_path = ROOT / "research" / "community" / "corrections.json"
    if cor_path.exists():
        cor = json.loads(cor_path.read_text(encoding="utf-8"))
        ids = {s["id"] for s in merged}
        for k in cor:
            if k not in ids:
                warnings.append(f"תיקון למזהה שלא קיים: {k}")
        kept = []
        for s in merged:
            c = cor.get(s["id"], {})
            if c.get("_remove") or c.get("_hide"):
                continue
            s.update({k: v for k, v in c.items() if not k.startswith("_")})
            # קו מפריד ארוך באמצע משפט קשה לקריאה בעברית: מחליפים בפסיק
            for f in ("description", "how_to_apply", "cost_notes"):
                s[f] = re.sub(r"\s+[–—]\s+", ", ", s.get(f) or "")
            kept.append(s)
        merged = kept

    # תקופה וגיל, נגזרים מהטקסט: תוכנית שמיועדת רק ללוחמי המלחמה הנוכחית, או ללוחמי מלחמות קודמות; וטווח גילאים כשכתוב
    IRON = re.compile(r"חרבות ברזל|מלחמת התקומה|7 באוקטובר|השבעה באוקטובר")
    IRON_FOR = re.compile(r"(?:ל|של |עבור )(?:פצועי|לוחמי|משתתפי|משרתי המילואים ב|משרתי מילואים ב|נפגעי|מילואימניקים ב)(?:\s*מלחמת)?\s*(?:חרבות ברזל|התקומה)")
    OLDER = re.compile(r"קו לבנון|לבנון הראשונה|רצועת הביטחון|יום כיפור|מלחמות קודמות|ותיקי מלחמות")
    AGE = re.compile(r"(?:בגילאי|גילאי|לגילאי|בני|בנות|מגיל)\s*(\d{2})(?:\s*(?:[-–]|עד)\s*(\d{2}))?")
    for s in merged:
        text = s["name"] + " " + s.get("description", "")
        # "iron-swords": בשם התוכנית (כנראה רק ללוחמי המלחמה הנוכחית). "iron-swords-desc": מוזכר בתיאור כקהל (חלש יותר).
        s["era"] = ("older" if OLDER.search(s["name"]) else "iron-swords" if IRON.search(s["name"])
                    else "iron-swords-desc" if IRON_FOR.search(s.get("description", "")) else "")
        m = AGE.search(s.get("description", ""))
        lo, hi = (int(m.group(1)), int(m.group(2) or 120)) if m else (0, 0)
        s["age"] = [lo, hi] if m and 18 <= lo < hi else []

    # תיוג מובנה (research/community/tags.json, לפי research/RUBRIC.md): מה השירות, עוצמה, הכרה, שוטרים, מיקום מדויק
    tag_path = ROOT / "research" / "community" / "tags.json"
    if tag_path.exists():
        tags = json.loads(tag_path.read_text(encoding="utf-8"))
        for s in merged:
            t = tags.get(s["id"])
            if not t:
                continue
            for f in ("kind", "intensity", "recognition", "police", "format", "town"):
                if t.get(f):
                    s[f] = t[f]
            s["unit_only"] = bool(t.get("unit_only")) or bool(s.get("unit_only"))
            if t.get("war_only") == "iron-swords":
                s["era"] = "iron-swords"
            if isinstance(t.get("lat"), (int, float)) and isinstance(t.get("lng"), (int, float)):
                s["geo"] = [round(t["lat"], 3), round(t["lng"], 3)]
            fix = t.get("elig_fix")
            if isinstance(fix, list) and fix and all(x in VALID["eligibility"] for x in fix):
                s["eligibility"] = sorted(set(fix))

    # שירות חדש שעוד לא תויג: סוג לפי הקטגוריה, עד שיתויג לפי research/RUBRIC.md
    CAT_KIND = {"hotlines": "hotline", "mental-health": "treatment", "medical-rehab": "treatment", "peer-support": "peer",
                "rights-legal": "rights", "financial-grants": "money", "employment-education": "work", "family-support": "family",
                "housing-daily": "housing"}
    for s in merged:
        if not s.get("kind"):
            s["kind"] = CAT_KIND.get(s["category"], "activity")
        # תיוג שהגיע ישירות מקובץ המחקר (שדות RUBRIC)
        if isinstance(s.get("lat"), (int, float)) and isinstance(s.get("lng"), (int, float)) and not s.get("geo"):
            s["geo"] = [round(s["lat"], 3), round(s["lng"], 3)]
        if s.get("war_only") == "iron-swords":
            s["era"] = "iron-swords"
        for f in ("lat", "lng", "war_only"):
            s.pop(f, None)
        s["unit_only"] = bool(s.get("unit_only"))

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
