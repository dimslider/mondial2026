# מגיע לך: מפת השירותים ללוחמים, נכים ומילואימניקים

פלטפורמה שעוזרת לנכי צה״ל, למילואימניקים, ללוחמים, לשוטרים ולמי שעוד לא הוכר במשרד הביטחון למצוא את כל השירותים שזמינים להם: טיפולים, עמותות, חוות שיקומיות, גלישה, יוגה, מענקים וזכויות. ההתאמה נעשית לפי קשיים, תחומי עניין, אזור ועלות.

## מה יש באתר

| עמוד | מה עושה |
|---|---|
| `#/match` | שאלון של 4 שלבים: סטטוס (קובע זכאות), קשיים, תחומי עניין, אזור ועלות |
| `#/results` | תוצאות מדורגות לפי תחום, עם הסבר למה כל שירות מתאים |
| `#/browse` | כל המאגר, עם חיפוש וסינון לפי תחום, סטטוס, אזור ועלות |
| `#/rights` | "מה מגיע לי": סיכום זכויות לפי סטטוס |
| `#/provider` | טופס לגופים (חוות, עמותות, מטפלים, מועדונים) שרוצים להציע את עצמם בלוח |
| `#/admin` | ניהול: אישור הצעות של גופים, וצפייה בפניות של מטופלים וייצוא שלהן ל-CSV |

בכל כרטיס שירות יש כפתורי חיוג, וואטסאפ, מייל ואתר, וגם טופס "להשאיר פנייה" שנשמר במערכת ומגיע לניהול.

## הרצה מקומית

```bash
cd veterans-hub
python3 -m http.server 8000
# לפתוח http://localhost:8000
```

בלי שרת האתר רץ במצב הדגמה: הצעות, תיקונים ופניות נשמרים רק במכשיר.
בדיקה מקומית עם השרת: `npx wrangler pages dev dist --d1 DB=test` (אחרי `sh tools/build_site.sh`).

## אירוח ושרת (Cloudflare Workers + D1, חינמי)

האתר רץ כ-Worker עם קבצים סטטיים (`worker.js`, `wrangler.jsonc`). ב-Workers & Pages ← Create application ← GitHub:
שם `magia-lecha`, Root directory `veterans-hub`, Deploy `npx wrangler deploy`, Branch control: `ccr-d452e790-ntiise`. אפשר גם כ-Pages (התיקייה `functions/` עובדת שם כמו שהיא):

1. **Pages:** Workers & Pages ← Create ← Pages ← Connect to Git ← המאגר.
   Root directory: `veterans-hub` · Build command: `sh tools/build_site.sh` · Build output: `dist`.
2. **D1:** ליצור מסד `magia-lecha`, ובפרויקט Pages ← Settings ← Bindings ← D1 בשם `DB`. הטבלאות נוצרות לבד.
3. **Turnstile (ספאם):** Site key ב-`config.js` (ציבורי). Secret key כמשתנה מוצפן `TURNSTILE_SECRET` ב-Pages.
4. **ניהול:** הכי פשוט: סוד `ADMIN_PASSWORD` ב-Worker (Settings ← Variables and Secrets), ונכנסים ב-`/admin/` עם הסיסמה.
   חלופה: Zero Trust ← Access ← Self-hosted app על `admin*` ו-`api/admin*`, מדיניות לפי מייל.
   משתנים ב-Pages: `ADMIN_EMAILS` (מיילים מורשים), `ACCESS_TEAM` (למשל `myteam.cloudflareaccess.com`),
   `ACCESS_AUD` (ה-Application Audience Tag של האפליקציה ב-Access). השרת מאמת את החתימה של Access.
5. **אפליקציה:** לשים את כתובת האתר ב-`android/app/src/main/res/values/strings.xml` (`site_url`).
   האפליקציה תטען את האתר החי, ובלי רשת את העותק שבתוכה.

מה משתמשים יכולים לשלוח: מקום חדש, תיקון לשירות, המלצה ("ממליץ/ה"), ובקשה שגוף יחזור אליהם.
הכול נכנס לתור ב-`/admin/`. הצעות כפולות מתאחדות. מה שמאושר מופיע מיד אצל כולם.
פניות "שיחזרו אליי" כוללות פרטי קשר ומידע רגיש: נראות רק בעמוד הניהול.


## עדכון המאגר

המאגר נמצא ב-`data/services.js` ונוצר אוטומטית מקבצי המחקר שב-`research/`:

```bash
python3 tools/build_data.py research/*.json
```

הסקריפט מנרמל תגיות לפי `data/taxonomy.js`, מאחד כפילויות ונותן לכל שירות מזהה קבוע. לכל רשומה יש `source_url` ו-`confidence`. רשומות עם `low` מוצגות עם הערה שכדאי לבדוק מול הגוף.

### ייבוא מקבוצת טלגרם

1. ב-**Telegram Desktop** פותחים את הקבוצה, לוחצים ⋮ ← **Export chat history** ומבטלים מדיה. הפורמט יכול להיות JSON או HTML (ברירת המחדל).
2. מריצים:
   ```bash
   python3 tools/telegram_import.py path/to/ChatExport_folder   # תיקיית הייצוא, או result.json
   ```
3. מתקבל `tools/telegram_out/candidates.csv`: רשימת ארגונים, קישורים וטלפונים שהוזכרו בקבוצה, ממוינת לפי מספר האזכורים. עוברים עליה, מוחקים את מה שלא רלוונטי, ואז:
   ```bash
   python3 tools/build_data.py --extra tools/telegram_out/candidates.json
   ```

הכלי לא שומר שמות של חברי הקבוצה, ושומר רק קטעים קצרים מההודעות. **לא להעלות את `result.json` לריפו.** הוא כבר מוחרג ב-`.gitignore`.

## מבנה

```
index.html, app.js, styles.css   ← האתר (HTML/JS נקי, בלי שלב build)
store.js, config.js              ← חיבור לשרת, ובלעדיו מצב הדגמה
functions/                       ← השרת: /api/live, /api/submit, /api/admin/* (Pages Functions + D1)
admin/                           ← עמוד הניהול: תור ההצעות, תיקונים, פניות
data/taxonomy.js                 ← קטגוריות, סטטוסים, קשיים, תחומי עניין, אזורים
data/services.js                 ← המאגר (נוצר אוטומטית)
data/guides.js                   ← "מה מגיע לי" לפי סטטוס
research/*.json                  ← תוצרי המחקר הגולמיים
tools/build_data.py              ← מיזוג ונרמול
tools/telegram_import.py         ← חילוץ מייצוא טלגרם
tools/build_site.sh              ← מכין את dist לפרסום
```
