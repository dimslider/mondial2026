#!/usr/bin/env python3
"""מזריק את state/BOARD.json לתוך board.html.

⚠️ הלוח שומר את עצמו. עידו עורך בדף, הדף מפרסם גרסה חדשה — ולכן
BOARD.json בריפו מתיישן. לפני כל בנייה מחדש: קרא את הארטיפקט החי,
חלץ את בלוק ה-state שלו אל BOARD.json, ורק אז הרץ את הסקריפט.
בנייה בלי לקרוא קודם דורסת את מה שהוא שינה.

    python3 conductor/build_board.py
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).parent
state_path, page_path = root / "state" / "BOARD.json", root / "board.html"

data = json.loads(state_path.read_text(encoding="utf-8"))
for field in ("updated", "alerts", "pipeline", "agents", "ideas", "note"):
    if field not in data:
        sys.exit(f"BOARD.json חסר את השדה '{field}'.")

blob = json.dumps(data, ensure_ascii=False, indent=1).replace("<", "\\u003c")
html = page_path.read_text(encoding="utf-8")
html, n = re.subn(
    r'(<script id="state" type="application/json">)(.*?)(</script>)',
    lambda m: m.group(1) + blob + m.group(3), html, count=1, flags=re.S)
if n != 1:
    sys.exit("לא נמצא בלוק state יחיד ב-board.html.")

page_path.write_text(html, encoding="utf-8")
print(f"נבנה: {len(data['pipeline'])} פניות · {len(data['agents'])} סוכנים · "
      f"{len(data['ideas'])} רעיונות · פתק: {'יש' if data['note'].strip() else 'ריק'}")
