#!/usr/bin/env python3
"""
סורק ייצוא של קבוצת טלגרם ומחלץ ממנו המלצות על שירותים, עמותות, טיפולים וזכויות.

איך מייצאים את הקבוצה (Telegram Desktop, במחשב):
  1. פותחים את הקבוצה ← שלוש נקודות למעלה ← Export chat history
  2. מבטלים סימון של תמונות/וידאו (לא צריך), בפורמט בוחרים "Machine-readable JSON"
  3. מקבלים תיקייה עם קובץ result.json

הרצה:
  python3 tools/telegram_import.py path/to/result.json

פלט (בתיקייה tools/telegram_out/):
  candidates.csv   — רשימת מועמדים לבדיקה ידנית (אחד לשורה): שם משוער, קישורים, טלפונים,
                     כמה פעמים הוזכר, קטגוריה משוערת, ציטוטים מההודעות
  candidates.json  — אותו דבר בפורמט של המאגר (data/services.js), עם confidence="low"
                     אחרי שעוברים על הרשימה ומוחקים את מה שלא רלוונטי:
  python3 tools/build_data.py --extra tools/telegram_out/candidates.json

פרטיות: הכלי לא שומר שמות של חברי הקבוצה ולא את תוכן ההודעות במלואו — רק קטעים קצרים
שמזכירים את השירות. מספרי טלפון ניידים נשמרים רק אם הם מופיעים ליד שם של ארגון.
"""
import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

URL_RE = re.compile(r"https?://[^\s)\]}>\"']+|(?:www\.)[^\s)\]}>\"']+", re.I)
PHONE_RE = re.compile(r"(?<!\d)(?:\*\d{3,5}|1-?[78]00-?\d{2,3}-?\d{3,4}|0\d{1,2}-?\d{3}-?\d{4}|\d{4}(?=\D|$))")
ORG_HINT_RE = re.compile(r"(עמותת|עמותה|ארגון|חוות|מרכז|תוכנית|פרויקט|קרן|מועדון|סטודיו|בית)\s+[\"״']?([א-תA-Za-z0-9\"״' \-]{2,40})")

# מילות מפתח לכל קטגוריה — לניחוש ראשוני בלבד
CATEGORY_KEYWORDS = {
    "water-sports": ["גלישה", "גולשים", "צלילה", "שיט", "קיאק", "סאפ", "ים "],
    "rehab-farm": ["חווה", "חוות", "חקלאות", "גינון", "משק"],
    "animal-therapy": ["סוסים", "רכיבה טיפולית", "כלב", "כלבי שירות", "בעלי חיים", "אלפקה"],
    "yoga-mind-body": ["יוגה", "מדיטציה", "מיינדפולנס", "נשימות", "רייקי", "דיקור", "TRE", "סומטי"],
    "sports": ["ספורט", "ריצה", "אופניים", "טיפוס", "כושר", "קרוספיט", "אגרוף", "קרב מגע"],
    "nature-retreats": ["ריטריט", "מסע", "טיול", "נופש", "סדנה בטבע", "מדבר"],
    "art-music": ["אמנות", "ציור", "מוזיקה", "תיאטרון", "צילום", "קרמיקה", "נגרות", "כתיבה"],
    "employment-education": ["תעסוקה", "עבודה", "הייטק", "מלגה", "לימודים", "קורס", "יזמות", "הכשרה"],
    "rights-legal": ["עו\"ד", "עורך דין", "זכויות", "ועדה רפואית", "הכרה", "ערעור", "תביעה", "אחוזי נכות"],
    "financial-grants": ["מענק", "קרן", "סיוע כספי", "החזר", "תגמול", "הטבה", "הנחה"],
    "family-support": ["בנות זוג", "בני זוג", "משפחה", "ילדים", "הורים", "זוגיות"],
    "medical-rehab": ["פיזיותרפיה", "שיקום", "תותבת", "קטיעה", "חמצן", "היפרברי", "קנאביס", "כאב"],
    "peer-support": ["קבוצת תמיכה", "עמיתים", "מעגל", "קבוצה ללוחמים"],
    "mental-health": ["פסיכולוג", "טיפול", "EMDR", "CPT", "PE ", "פסיכיאטר", "קטמין", "MDMA", "פסילוסיבין"],
    "hotlines": ["קו חם", "מוקד", "24/7", "חירום"],
}
RELEVANCE = ["ממליץ", "מומלץ", "חינם", "ללא עלות", "ללא תשלום", "מסובסד", "מימון", "זכאים", "פתוח ל",
             "נרשמים", "הרשמה", "עמותה", "משרד הביטחון", "אגף השיקום", "מילואים", "נכי", "פוסט"]


def text_of(msg):
    t = msg.get("text", "")
    if isinstance(t, list):
        parts = []
        for p in t:
            if isinstance(p, str):
                parts.append(p)
            elif isinstance(p, dict):
                parts.append(p.get("text", ""))
                if p.get("href"):
                    parts.append(" " + p["href"] + " ")
        t = "".join(parts)
    return t or ""


def domain_key(url):
    u = re.sub(r"^https?://", "", url.lower()).removeprefix("www.")
    host = u.split("/")[0]
    # קישורי רשתות חברתיות — המפתח כולל את שם העמוד
    if host in ("facebook.com", "m.facebook.com", "instagram.com", "t.me", "chat.whatsapp.com", "linktr.ee"):
        parts = u.split("/")
        return "/".join(parts[:2])
    return host


SKIP_HOSTS = {"youtube.com", "youtu.be", "google.com", "goo.gl", "bit.ly", "ynet.co.il", "mako.co.il",
              "n12.co.il", "walla.co.il", "haaretz.co.il", "maariv.co.il", "kan.org.il", "tiktok.com",
              "x.com", "twitter.com", "docs.google.com", "forms.gle", "drive.google.com", "wa.me"}


def guess_category(text):
    scores = {}
    for cat, kws in CATEGORY_KEYWORDS.items():
        n = sum(text.count(k) for k in kws)
        if n:
            scores[cat] = n
    return max(scores, key=scores.get) if scores else ""


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    data = json.loads(src.read_text(encoding="utf-8"))
    messages = data.get("messages", data if isinstance(data, list) else [])
    out_dir = Path(__file__).parent / "telegram_out"
    out_dir.mkdir(exist_ok=True)

    cands = defaultdict(lambda: {"urls": set(), "phones": set(), "names": defaultdict(int), "snippets": [],
                                 "mentions": 0, "text": "", "dates": []})
    relevant = 0
    for m in messages:
        if m.get("type") != "message":
            continue
        t = text_of(m)
        if len(t) < 15:
            continue
        rel = sum(1 for k in RELEVANCE if k in t)
        urls = [u for u in URL_RE.findall(t)]
        orgs = ORG_HINT_RE.findall(t)
        if not urls and not orgs:
            continue
        if rel == 0 and not urls:
            continue
        relevant += 1
        keys = []
        for u in urls:
            k = domain_key(u)
            if k.split("/")[0] in SKIP_HOSTS:
                continue
            keys.append(k)
            cands[k]["urls"].add(u.rstrip(".,"))
        if not keys:
            for kind, name in orgs:
                keys.append(("name:" + kind + " " + name.strip()).strip())
        phones = [p for p in PHONE_RE.findall(t) if len(re.sub(r"\D", "", p)) >= 4]
        for k in keys:
            c = cands[k]
            c["mentions"] += 1
            c["phones"].update(phones[:3])
            for kind, name in orgs:
                c["names"][(kind + " " + name.strip())[:50]] += 1
            if len(c["snippets"]) < 4:
                c["snippets"].append(re.sub(r"\s+", " ", t)[:280])
            c["text"] += " " + t[:1000]
            if m.get("date"):
                c["dates"].append(m["date"][:10])

    rows = []
    for k, c in cands.items():
        name = max(c["names"], key=c["names"].get) if c["names"] else k.removeprefix("name:")
        rows.append({
            "key": k,
            "name_guess": name,
            "mentions": c["mentions"],
            "category_guess": guess_category(c["text"]),
            "urls": " | ".join(sorted(c["urls"]))[:500],
            "phones": " | ".join(sorted(c["phones"])),
            "last_mentioned": max(c["dates"]) if c["dates"] else "",
            "snippets": " ⟂ ".join(c["snippets"]),
        })
    rows.sort(key=lambda r: -r["mentions"])

    with open(out_dir / "candidates.csv", "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else ["key"])
        w.writeheader()
        w.writerows(rows)

    services = []
    for r in rows:
        url = r["urls"].split(" | ")[0] if r["urls"] else ""
        services.append({
            "name": r["name_guess"],
            "category": r["category_guess"] or "peer-support",
            # לא מעתיקים טקסט מהודעות של חברי הקבוצה לתוך המאגר, כי הוא עלול לכלול סיפור אישי או מידע רפואי.
            # את התיאור כותבים מחדש מתוך האתר הרשמי של הגוף, בשלב האימות.
            "description": "",
            "provider_type": "ngo",
            "eligibility": [], "difficulties": [], "interests": [],
            "cost": "partial", "cost_notes": "לא אומת — מקור: קבוצת טלגרם",
            "regions": [], "location": "", "phone": "", "email": "",
            "website": url, "how_to_apply": "",
            "source_url": url, "confidence": "low",
            "telegram_mentions": r["mentions"],
        })
    (out_dir / "candidates.json").write_text(json.dumps(services, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(messages)} הודעות, {relevant} רלוונטיות, {len(rows)} מועמדים → {out_dir}")


if __name__ == "__main__":
    main()
