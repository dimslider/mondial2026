#!/usr/bin/env python3
"""מזריק את state/FLEET.json לתוך dashboard.html בין סמני FLEET-DATA.

הדשבורד קורא את FLEET.json כפי שהוא — אין שכפול נתונים ואין שדה שנכתב ביד ב-HTML.
מחזור שבועי: עדכן FLEET.json → הרץ את הסקריפט → פרסם עם אותו file_path.

    python3 conductor/build_dashboard.py
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).parent
fleet_path, dash_path = root / "state" / "FLEET.json", root / "dashboard.html"

data = json.loads(fleet_path.read_text(encoding="utf-8"))          # נכשל רועש על JSON שבור
for field in ("cycle", "decision_budget", "agents", "alerts", "ladder",
              "dispatch", "recruits", "waitlist", "coaching_html", "history"):
    if field not in data:
        sys.exit(f"FLEET.json חסר את השדה '{field}' — הדשבורד ייבנה שבור.")

block = "/* FLEET-DATA-START — generated from state/FLEET.json by build_dashboard.py. Do not hand-edit. */\n" \
        f"const FLEET = {json.dumps(data, ensure_ascii=False, indent=2)};\n" \
        "/* FLEET-DATA-END */"

html = dash_path.read_text(encoding="utf-8")
html, n = re.subn(r"/\* FLEET-DATA-START.*?/\* FLEET-DATA-END \*/", lambda _: block, html, flags=re.S)
if n != 1:
    sys.exit(f"נמצאו {n} בלוקי נתונים ב-dashboard.html במקום אחד בדיוק.")

dash_path.write_text(html, encoding="utf-8")
print(f"נבנה: {len(data['agents'])} סוכנים · {len(data['alerts'])} התראות · "
      f"{len(data['recruits'])} גיוסים · מחזור {data['cycle']['id']} {data['cycle']['date']}")
