#!/usr/bin/env python3
"""
סורק ייצוא של קבוצת טלגרם ומחלץ ממנו המלצות על שירותים, עמותות, טיפולים וזכויות.

איך מייצאים את הקבוצה (Telegram Desktop, במחשב):
  1. פותחים את הקבוצה ← שלוש נקודות למעלה ← Export chat history
  2. מבטלים סימון של תמונות/וידאו (לא צריך), בפורמט בוחרים "Machine-readable JSON"
  3. מקבלים תיקייה עם קובץ result.json

הרצה:
  python3 tools/telegram_import.py path/to/result.json
  python3 tools/telegram_import.py path/to/ChatExport_2026-10-07     # תיקיית ייצוא HTML או JSON

פלט (בתיקייה tools/telegram_out/, או --out <תיקייה>), אגרגטיבי בלבד — בלי טקסט מהודעות:
  known.csv        — שירותים שכבר במאגר, וכמה הודעות שונות הזכירו כל אחד (אות לפופולריות)
  new_domains.csv  — אתרים שהוזכרו ועוד לא במאגר, לפי מספר הודעות
  new_names.csv    — שמות גופים חדשים (1–3 מילים) שהוזכרו ב-3 הודעות שונות לפחות
  shared_domains.csv — אתרים כלליים שכבר במאגר (כמו אתר אגף השיקום) וכמה פעמים קושרו
  service_lines.csv — מספרי מוקד ציבוריים (*NNNN, 1-800, 1-700) שהוזכרו לפחות פעמיים
  candidates.json  — הדומיינים והשמות החדשים בפורמט המאגר, confidence="low", לאימות לפני מיזוג:
  python3 tools/build_data.py --extra tools/telegram_out/candidates.json

פרטיות: לא נשמרים שמות של חברי הקבוצה, ציטוטים, מספרי טלפון ניידים או פרטיים, קישורים
לפרופילים אישיים, או כל טקסט חופשי מההודעות. רק ספירות של גופים, אתרים ומוקדים ציבוריים.
"""
import csv
import json
import re
import sys
from html.parser import HTMLParser
from collections import defaultdict
from pathlib import Path

URL_RE = re.compile(r"https?://[^\s)\]}>\"']+|(?:www\.)[^\s)\]}>\"']+", re.I)
PHONE_RE = re.compile(r"(?<!\d)(?:\*\d{3,5}|1-?[78]00-?\d{2,3}-?\d{3,4}|0\d{1,2}-?\d{3}-?\d{4}|\d{4}(?=\D|$))")
ORG_HINT_RE = re.compile(r"(עמותת|עמותה|ארגון|חוות|מרכז|תוכנית|פרויקט|קרן|מועדון|סטודיו|בית)\s+[\"״']?([א-תA-Za-z0-9\"״' \-]{2,40})")

# מילות מפתח לכל קטגוריה — לניחוש ראשוני בלבד
CATEGORY_KEYWORDS = {
    "water-sports": ["גלישה", "גולשים", "צלילה", "שיט", "קיאק", "סאפ", " ים ", "בים"],
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


class _TgHtml(HTMLParser):
    """קורא את messages*.html של ייצוא טלגרם בפורמט HTML (ברירת המחדל של Telegram Desktop)."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.messages, self._depth, self._date, self._buf = [], 0, "", None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if self._buf is not None:
            if tag == "div":
                self._depth += 1
            if tag == "a" and a.get("href"):
                self._buf.append(" " + a["href"] + " ")
            if tag == "br":
                self._buf.append("\n")
            return
        if tag == "div" and "date" in cls and a.get("title"):
            d = re.match(r"(\d\d)\.(\d\d)\.(\d{4})", a["title"])
            self._date = f"{d.group(3)}-{d.group(2)}-{d.group(1)}" if d else ""
        if tag == "div" and cls == ["text"]:
            self._buf, self._depth = [], 1

    def handle_endtag(self, tag):
        if self._buf is not None and tag == "div":
            self._depth -= 1
            if self._depth == 0:
                self.messages.append({"type": "message", "date": self._date, "text": "".join(self._buf)})
                self._buf = None

    def handle_data(self, data):
        if self._buf is not None:
            self._buf.append(data)


def load_messages(src):
    """מקבל result.json, קובץ messages.html, או תיקיית ייצוא שלמה (JSON או HTML)."""
    if src.is_dir():
        if (src / "result.json").exists():
            src = src / "result.json"
        else:
            files = sorted(src.glob("messages*.html"), key=lambda f: int(re.sub(r"\D", "", f.stem) or 1))
            if not files:
                sys.exit(f"לא נמצא result.json או messages*.html בתיקייה {src}")
            parser = _TgHtml()
            for f in files:
                parser.feed(f.read_text(encoding="utf-8"))
            return parser.messages
    if src.suffix.lower() in (".html", ".htm"):
        parser = _TgHtml()
        parser.feed(src.read_text(encoding="utf-8"))
        return parser.messages
    data = json.loads(src.read_text(encoding="utf-8"))
    return data.get("messages", data if isinstance(data, list) else [])


NAME_RE = re.compile(r"(?:עמותת|עמותה בשם|ארגון|חוות|פרויקט|תוכנית|תכנית|מיזם|קרן|מרכז)\s+[\"״'׳]?([א-תA-Za-z][א-תA-Za-z\-\"״׳']+(?:\s+[א-תA-Za-z][א-תA-Za-z\-\"״׳']+){0,2})")
NAME_STOP = {"של", "שלי", "שלו", "שלה", "שלנו", "שלהם", "זה", "זו", "הזה", "הזאת", "הזו", "אחת", "אחד", "אחר", "אחרת",
             "כזה", "כזאת", "גדול", "גדולה", "טוב", "טובה", "יש", "אין", "לא", "כן", "גם", "רק", "עם", "על", "את",
             "הוא", "היא", "הם", "הן", "אני", "אתה", "את", "אנחנו", "ש", "כי", "אבל", "או", "אז", "מה", "מי", "איך",
             "היחידה", "ממש", "דעת", "הדעת", "הפנסיה", "פנסיה", "פרישה", "השתלמות", "טיפול", "שיקום", "הנכים", "הארץ", "מאוד", "שם", "פה", "כאן", "כל", "בלי", "אצל", "לי", "לו", "לה", "לנו", "להם"}
GENERIC_ALIASES = {"משרד הביטחון", "אגף השיקום", "ביטוח לאומי", "חרבות ברזל", "פוסט טראומה", "מלחמת התקומה",
                   "משרד הבריאות", "כללית", "מכבי", "לאומית", "מאוחדת", "צה\"ל", "מילואים", "נכי צה\"ל", "קופות החולים", "MoD", "IDF"}
PUBLIC_LINE_RE = re.compile(r"(?<![\d*])(\*\d{4}|1-?[78]00-?\d{2,3}-?\d{3,4})(?!\d)")
PERSONAL_HOSTS = {"facebook.com", "m.facebook.com", "instagram.com", "t.me", "tiktok.com", "linkedin.com"}


def load_known():
    """שמות וכתובות של השירותים שכבר במאגר, לזיהוי אזכורים."""
    txt = (Path(__file__).resolve().parent.parent / "data" / "services.js").read_text(encoding="utf-8")
    services = json.loads(re.search(r"window\.SERVICES\s*=\s*(\[.*\]);", txt, re.S).group(1))
    aliases, hosts, alias_count, host_count = {}, {}, defaultdict(int), defaultdict(int)
    for s in services:
        name = s["name"]
        variants = {re.split(r"\s+[–—-]\s+|\(", name)[0].strip()}
        # בסוגריים לוקחים רק שם לועזי (למשל "(Brothers for Life)"); עברית שם היא לרוב תיאור כללי
        variants |= {v for v in re.findall(r"\(([^)]+)\)", name) if re.search(r"[A-Za-z]{3}", v)}
        for v in variants:
            v = re.sub(r"^(עמותת|עמותה|ארגון|תוכנית|תכנית|פרויקט)\s+", "", v.strip(" \"״'"))
            if len(v) >= 4 and v not in GENERIC_ALIASES:
                alias_count[v.lower()] += 1
                aliases.setdefault(v.lower(), s["id"])
        for u in (s.get("website"), s.get("source_url")):
            h = domain_key(u) if u else ""
            if h and h.split("/")[0] not in PERSONAL_HOSTS:
                host_count[h] += 1
                hosts.setdefault(h, s["id"])
    # כינוי שמתאים לכמה שירותים שונים לא מזהה אף אחד מהם
    aliases = {a: sid for a, sid in aliases.items() if alias_count[a] == 1}
    # אתר שמשמש כמה שירותים (למשל shikum.mod.gov.il) לא מזהה שירות מסוים — נספר כדומיין כללי
    shared = {h for h, n in host_count.items() if n > 1}
    hosts = {h: sid for h, sid in hosts.items() if h not in shared}
    hosts.update({h: None for h in shared})
    return services, aliases, hosts


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    src = Path(sys.argv[1])
    messages = load_messages(src)
    out_dir = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else Path(__file__).parent / "telegram_out"
    out_dir.mkdir(parents=True, exist_ok=True)
    services, aliases, known_hosts = load_known()
    by_id = {s["id"]: s for s in services}

    known = defaultdict(int)
    domains = defaultdict(lambda: {"n": 0, "cat": defaultdict(int), "last": ""})
    names = defaultdict(lambda: {"n": 0, "cat": defaultdict(int), "last": ""})
    lines = defaultdict(int)
    shared_hits = defaultdict(int)
    n_msgs = 0
    for m in messages:
        if m.get("type") != "message":
            continue
        t = text_of(m)
        if len(t) < 6:
            continue
        n_msgs += 1
        low = t.lower()
        date = (m.get("date") or "")[:10]
        cat = guess_category(t)
        hit_ids = {sid for a, sid in aliases.items() if a in low}
        for u in URL_RE.findall(t):
            k = domain_key(u)
            h = k.split("/")[0]
            if h in SKIP_HOSTS or h in PERSONAL_HOSTS or "whatsapp" in h:
                continue
            if known_hosts.get(k) or known_hosts.get(h):
                hit_ids.add(known_hosts.get(k) or known_hosts.get(h))
            elif k in known_hosts or h in known_hosts:
                shared_hits[h] += 1
            else:
                d = domains[h]
                d["n"] += 1
                d["last"] = max(d["last"], date)
                if cat:
                    d["cat"][cat] += 1
        for sid in hit_ids:
            known[sid] += 1
        for nm in set(NAME_RE.findall(t)):
            words = nm.split()
            while words and words[-1] in NAME_STOP:
                words.pop()
            if not words or words[0] in NAME_STOP or words[0].startswith("שמטר") or words[0].startswith(("ש", "ו")) and len(words[0]) <= 3:
                continue
            key = " ".join(words)
            if key.lower() in aliases or key in GENERIC_ALIASES:
                continue
            e = names[key]
            e["n"] += 1
            e["last"] = max(e["last"], date)
            if cat:
                e["cat"][cat] += 1
        for ln in set(PUBLIC_LINE_RE.findall(t)):
            lines[ln.replace("-", "")] += 1

    top = lambda c: max(c, key=c.get) if c else ""
    def write(fn, header, rows):
        with open(out_dir / fn, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.writer(f)
            w.writerow(header)
            w.writerows(rows)

    write("known.csv", ["id", "name", "category", "messages"],
          sorted(([sid, by_id[sid]["name"], by_id[sid]["category"], n] for sid, n in known.items()), key=lambda r: -r[3]))
    new_domains = sorted(((h, d["n"], top(d["cat"]), d["last"]) for h, d in domains.items() if d["n"] >= 2), key=lambda r: -r[1])
    write("new_domains.csv", ["domain", "messages", "category_guess", "last_mentioned"], new_domains)
    new_names = sorted(((k, e["n"], top(e["cat"]), e["last"]) for k, e in names.items() if e["n"] >= 3), key=lambda r: -r[1])
    write("new_names.csv", ["name", "messages", "category_guess", "last_mentioned"], new_names)
    write("shared_domains.csv", ["domain", "messages"], sorted(([h, n] for h, n in shared_hits.items()), key=lambda r: -r[1]))
    write("service_lines.csv", ["number", "messages"], sorted(([k, v] for k, v in lines.items() if v >= 2), key=lambda r: -r[1]))

    cands = [{"name": h, "category": c or "peer-support", "website": "https://" + h, "source_url": "https://" + h,
              "telegram_mentions": n} for h, n, c, _ in new_domains]
    cands += [{"name": k, "category": c or "peer-support", "website": "", "source_url": "", "telegram_mentions": n}
              for k, n, c, _ in new_names]
    for c in cands:
        c.update({"description": "", "provider_type": "ngo", "eligibility": [], "difficulties": [], "interests": [],
                  "cost": "partial", "cost_notes": "לא אומת — הוזכר בקבוצת טלגרם", "regions": [], "location": "",
                  "phone": "", "email": "", "how_to_apply": "", "confidence": "low"})
    (out_dir / "candidates.json").write_text(json.dumps(cands, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{n_msgs} הודעות · {len(known)} שירותים מהמאגר הוזכרו · {len(new_domains)} אתרים חדשים · "
          f"{len(new_names)} שמות חדשים → {out_dir}")


if __name__ == "__main__":
    main()
