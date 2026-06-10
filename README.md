# 🏆 מונדיאל 2026 — אפליקציית כיתה

## הפעלה מהירה (5 דקות)

### שלב 1 — צור פרויקט Firebase חינמי

1. כנס ל-[console.firebase.google.com](https://console.firebase.google.com)
2. לחץ **"Add project"** → תן שם → המשך
3. לא צריך Google Analytics → **"Create project"**
4. בתפריט השמאלי: **Build → Realtime Database**
5. לחץ **"Create Database"** → בחר אזור → **"Start in test mode"** → Enable
6. בתפריט השמאלי: **Project settings** (גלגל השיניים)
7. תחת **"Your apps"** לחץ `</>` (Web)
8. תן שם לאפליקציה → **Register app**
9. תראה קוד עם `firebaseConfig` — העתק את הערכים

### שלב 2 — הגדר את הקובץ

פתח את `firebase-config.js` והדבק את הערכים מ-Firebase:
```js
window.firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  databaseURL: "https://...-default-rtdb.firebaseio.com",
  projectId: "...",
  ...
};
```

### שלב 3 — שתף עם הכיתה

**אפשרות א' — GitHub Pages (מומלץ, חינמי):**
1. צור חשבון GitHub אם אין לך
2. New repository → העלה את כל הקבצים
3. Settings → Pages → Source: main → Save
4. תקבל קישור כמו `https://yourname.github.io/mondial2026`
5. שלח לקבוצת הורים / כיתה!

**אפשרות ב' — מחשב מקומי:**
פתח את `index.html` בדפדפן. עובד אבל רק על המחשב הזה.

---

## פיצ'רים

- ⚽ **משחקים** — כל משחקי המונדיאל עם ניחושים
- 🏅 **טבלה** — לוח הישגים כיתתי בזמן אמת
- 🌍 **קבוצות** — מידע על כל קבוצה, שחקן כוכב, עובדה מהנה
- 🎯 **חידות** — שאלת יום אחת ביום, 1 נקודה לנכון

## מערכת ניקוד

| פעולה | נקודות |
|-------|--------|
| ניחוש נכון (מנצח / תיקו) | 3 נק' |
| תוצאה מדויקת (בונוס) | +2 נק' |
| חידת יום נכון | 1 נק' |
