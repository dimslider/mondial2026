# מפתח ההעלאה לגוגל פליי – הגדרה חד-פעמית

גוגל פליי מקבלת רק קובץ אפליקציה (AAB) חתום ב"מפתח העלאה" פרטי. המפתח **לא** נשמר בקוד (המאגר ציבורי) – הוא נשמר כ"סוד" ב-GitHub, והבנייה האוטומטית משתמשת בו כדי לחתום את `TV-Remote-play.aab`.

## מה קיבלת
- `upload.jks` – קובץ המפתח עצמו. **שמור עותק במקום בטוח** (דרייב פרטי / מנהל סיסמאות). אם הוא אובד – אפשר לבקש מגוגל איפוס מפתח העלאה, אבל זה לוקח כמה ימים.
- `upload.jks.base64` – אותו מפתח כטקסט, להדבקה ב-GitHub.
- `password.txt` – הסיסמה של המפתח.

## הוספה ל-GitHub (פעם אחת, כ-3 דקות)
1. פתח את המאגר ב-GitHub ← **Settings** ← **Secrets and variables** ← **Actions** ← **New repository secret**.
2. צור 4 סודות (השם בדיוק כך):
   | Name | Value |
   |---|---|
   | `UPLOAD_KEYSTORE_BASE64` | כל התוכן של `upload.jks.base64` (שורה אחת ארוכה) |
   | `UPLOAD_KEYSTORE_PASSWORD` | התוכן של `password.txt` |
   | `UPLOAD_KEY_PASSWORD` | אותה סיסמה בדיוק |
   | `UPLOAD_KEY_ALIAS` | `upload` |
3. זהו. מהבנייה הבאה, הקובץ `TV-Remote-play.aab` (ב-GitHub ← **Actions** ← הריצה האחרונה ← **Artifacts** ← `TV-Remote-play-bundle`) יהיה חתום ומוכן להעלאה.

## בהעלאה הראשונה ל-Play Console
בהעלאה הראשונה גוגל תציע **Play App Signing** – אשר (ברירת המחדל). גוגל שומרת את מפתח החתימה הסופי, ואנחנו משתמשים רק במפתח ההעלאה.
