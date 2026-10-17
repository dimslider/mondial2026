# אזימוט ב-Google Play: כל השלבים

כל מה שצריך להעלאה נמצא בתיקייה `veterans-hub/store/`:

| מה | איפה |
|---|---|
| שם, תיאור קצר ותיאור מלא | `listing-he.txt`, `listing-en.txt` |
| אייקון 512×512 | `graphics/icon-512.png` |
| תמונה ראשית 1024×500 | `graphics/feature-he.png`, `graphics/feature-en.png` |
| צילומי מסך לטלפון 1080×1920 | `graphics/he/`, `graphics/en/` |
| מדיניות פרטיות | https://azimut.idomayraz.workers.dev/privacy.html |
| קובץ האפליקציה (AAB) | GitHub Actions ← "Android AAB לחנות" (שלב 2) |

---

## שלב 1: חשבון מפתח (פעם אחת)
1. נכנסים ל-https://play.google.com/console ונרשמים. העלות היא 25$ חד-פעמי, ויש אימות זהות.
2. **סוג החשבון:**
   - **אישי (Personal):** הכי מהיר. אבל לפני פרסום לכולם חובה **בדיקה סגורה: לפחות 12 בודקים, 14 ימים רצופים**. קבוצת המטפלים מתאימה לזה בדיוק.
   - **ארגון (Organization):** אם יש עמותה או עסק רשום. צריך מספר D-U-N-S (חינם, לוקח כמה ימים). אין דרישה ל-12 בודקים, ושם הארגון מופיע בחנות.
3. **שם המפתח שמופיע בחנות:** מציע "אזימוט" או "Azimut Project".

## שלב 2: מפתח העלאה וקובץ AAB (פעם אחת, 5 דקות)
צירפתי לך שלושה קבצים: `azimut-upload.jks`, `UPLOAD_KEYSTORE_B64.txt` ו-`secrets.txt`.
1. שומרים את `azimut-upload.jks` ואת `secrets.txt` במקום בטוח (Drive פרטי). אסור להעלות אותם למאגר.
2. ב-GitHub: github.com/dimslider/mondial2026 ← Settings ← Secrets and variables ← Actions ← New repository secret. מוסיפים את ארבעת הסודות שכתובים ב-`secrets.txt`.
3. Actions ← "Android AAB לחנות" ← Run workflow. אחרי בערך 4 דקות הקובץ נמצא כאן:
   https://github.com/dimslider/mondial2026/releases/tag/play-latest

> **מזהה החבילה:** `il.azimut.app`. אחרי ההעלאה הראשונה אי אפשר לשנות אותו. גרסת הבדיקה (APK) עברה ל-`il.azimut.app.beta`, ולכן מי שהתקין את גרסת הבדיקה הקודמת צריך להתקין אותה מחדש פעם אחת.

## שלב 3: יוצרים את האפליקציה בקונסולה
**Create app**:
- שם: `אזימוט: מענים ללוחמים ולמשפחות`
- שפת ברירת מחדל: עברית (he-IL)
- App (לא Game), Free

> **חשוב:** אפליקציה שסומנה Free לא יכולה להפוך ל-Paid. זה לא מפריע לתשלום בתוך האפליקציה בעתיד (ראו `MONETIZATION.md`).

## שלב 4: "Set up your app" (הקונסולה מובילה סעיף אחרי סעיף)
| סעיף | מה עונים |
|---|---|
| **Privacy policy** | `https://azimut.idomayraz.workers.dev/privacy.html` |
| **App access** | All functionality is available without special access (אין התחברות) |
| **Ads** | No, my app does not contain ads |
| **Content rating** | שאלון IARC. קטגוריה: Reference, News, or Educational. לכל השאלות על אלימות, מין, שפה, הימורים וסמים: No. "Does the app allow users to interact or exchange content?": No (המשוב לא מתפרסם). הדירוג הצפוי: 3+ או Everyone. |
| **Target audience** | 18 and over בלבד |
| **News app** | No |
| **Health apps** | מסמנים: Mental and behavioral health. ומאשרים שזה לא מכשיר רפואי. |
| **Government apps** | No. ההצהרה "לא קשור לצה״ל, למשרד הביטחון או למשטרה" כבר כתובה בתיאור. |
| **Financial features** | My app doesn't provide any financial features |
| **Data safety** | ראו הטבלה למטה |
| **Category** | Health & Fitness. תגיות: Mental health, Self-care. |
| **Contact details** | idomayraz@gmail.com, אתר: https://azimut.idomayraz.workers.dev |

### Data safety: התשובות
- **Does your app collect or share any of the required user data types?** Yes
- **Is all of the user data collected by your app encrypted in transit?** Yes
- **Do you provide a way for users to request that their data is deleted?** Yes (מייל וטופס בעמוד הפרטיות)

| סוג מידע | נאסף? | משותף? | חובה או רשות | למה |
|---|---|---|---|---|
| Personal info → Name | כן | לא\* | רשות | App functionality ("שיחזרו אליי") |
| Personal info → Email address | כן | לא\* | רשות | App functionality, Developer communications |
| Personal info → Phone number | כן | לא\* | רשות | App functionality |
| App activity → Other user-generated content | כן | לא | רשות | App functionality, Analytics (משוב, דירוג, דיווח המתנה, הוספת מקום) |
| Device or other IDs | כן | לא | רשות | Fraud prevention (קוד אקראי ל"ממליץ/ה") |

\* העברה לגוף שהמשתמש בחר בעצמו, ביוזמתו, לא נחשבת "שיתוף" לפי ההגדרות של Google.

**לא נאסף:** מיקום (העיר נבחרת ידנית ונשארת בטלפון), מידע בריאותי (התשובות לשאלון נשארות בטלפון), אנשי קשר, תמונות, מזהה פרסום.

## שלב 5: דף החנות (Main store listing)
1. מעתיקים מ-`listing-he.txt`: שם, תיאור קצר, תיאור מלא.
2. מעלים: `icon-512.png`, `feature-he.png`, ואת כל הצילומים מ-`graphics/he/` (Phone screenshots).
3. **מוסיפים תרגום:** Translations ← Add ← English (United States) – en-US. מעתיקים מ-`listing-en.txt`, ומעלים `feature-en.png` ואת הצילומים מ-`graphics/en/`.

## שלב 6: בדיקה סגורה (בחשבון אישי: חובה)
1. Testing ← Closed testing ← Create track. מעלים את קובץ ה-AAB.
2. Testers: יוצרים רשימת מיילים (Gmail) של לפחות 12 אנשים. מטפלים מהקבוצה מתאימים.
3. שולחים להם את קישור ההצטרפות. כל אחד לוחץ "Become a tester" ומתקין מהחנות.
4. אחרי 14 ימים עם 12 בודקים לפחות: Production ← Apply for production. עונים על כמה שאלות על הבדיקה (מה למדנו, מה תוקן). את התשובות מהמשוב בעמוד הניהול אני אנסח איתך.

> **טקסט לבודקים:** "אזימוט נכנס לחנות של גוגל. כדי שגוגל יאשרו, צריך 12 אנשים שיתקינו את גרסת הבדיקה ויחזיקו אותה 14 יום. זה לוקח דקה: [קישור]. ואם יש לכם הערות, יש משוב בתוך האפליקציה."

## שלב 7: פרסום
Production ← Create new release ← מעלים AAB ← Review ← Start rollout. הבדיקה של Google לוקחת בדרך כלל 1–7 ימים.

## עדכונים בהמשך
- **מאגר, טקסטים ועיצוב:** לא צריך גרסה חדשה בחנות. האפליקציה טוענת את האתר החי, וכל דחיפה לענף מתעדכנת מיד. בלי רשת היא נפתחת עם העותק השמור.
- **שינוי בקוד האנדרואיד:** מריצים שוב את "Android AAB לחנות" ומעלים את הקובץ כ-release חדש. מספר הגרסה עולה לבד.

## מה בדקתי ומה לא
- **נבדק:** הטקסטים בגבולות האורך (30/80/4000), הגרפיקה בגדלים שנדרשים, עמוד הפרטיות עובד בלי JavaScript, שתי השפות באפליקציה.
- **לא נבדק:** בניית ה-AAB עצמה. בסביבה שלי אין Android SDK, ולכן הבדיקה הראשונה תהיה בהרצה ב-GitHub Actions. הבנייה הרגילה של ה-APK רצה שם אוטומטית עם כל דחיפה, ותראה אם משהו נשבר.
- **גרסת אנדרואיד:** האפליקציה מכוונת ל-Android 16 (API 36), כפי ש-Google Play דורש מאפליקציות חדשות. כדי שהתוכן לא יוסתר מתחת לשורת המצב, הוספתי מרווחים בקצוות המסך. תמכתי גם במחוות "חזרה" החדשה.
