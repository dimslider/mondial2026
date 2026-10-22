# סרטון שיווקי קצר – תסריט והוראות הפקה

שתי גרסאות מאותם צילומים:
- **גרסה A – לגוגל פליי:** 30 שניות, לרוחב (16:9, 1920×1080), טקסט באנגלית.
- **גרסה B – לרשתות (Reels / TikTok / Shorts):** 15 שניות, לגובה (9:16, 1080×1920). אפשר גם בעברית, ראו בסוף.

---

## 1. הכלל החשוב לריאליזם: מסך הטלפון תמיד אמיתי

כלי וידאו של AI (Higgsfield, Kling, Runway, Veo) לא יודעים לשמור ממשק משתמש. כפתורים נמרחים, טקסט הופך לג'יבריש, ואייקונים זזים. לכן העבודה מתחלקת כך:

| מה | מי מייצר |
|---|---|
| סלון, אנשים, טלוויזיה, אווירה, תנועת מצלמה | AI (Higgsfield או כל כלי אחר) |
| כל מה שרואים **על מסך הטלפון** | הקלטת מסך אמיתית של האפליקציה, או צילומי המסך מהתיקייה `store/screenshots/` |
| אייקון השתקה על מסך הטלוויזיה, טקסטים, תג PRO | שכבה בעורך (CapCut / DaVinci / Canva) |

שלוש דרכים להכניס את האפליקציה לתמונה, מהקלה לריאליסטית ביותר:
1. **מסך מטושטש:** ב-AI הטלפון נראה מהצד או מטושטש, ומיד אחריו חותכים לקלוז-אפ של הקלטת המסך האמיתית בתוך מסגרת טלפון. זה הכי בטוח.
2. **תמונת פתיחה מורכבת:** לוקחים תמונה של יד מחזיקה טלפון (AI או סטוק), מדביקים עליה את צילום המסך (למשל `en-1.png`) בקנבה, ומעלים ל-Higgsfield כתמונת פתיחה (Image-to-Video) עם **תנועה מינימלית**. הממשק נשאר יציב יותר, אבל צריך לבדוק כל פריים.
3. **מעקב מסך בעורך:** מצלמים או מייצרים טלפון עם מסך ירוק או ריק, ובעורך מצמידים אליו את הקלטת המסך. זה הכי מקצועי, וגם הכי הרבה עבודה.

**מה להקליט בטלפון שלך** (מקליט המסך המובנה באנדרואיד, מחובר לסמסונג):
- **R1:** פתיחת האפליקציה ← המסך הראשי ← כמה לחיצות על ווליום וחצים.
- **R2:** מסך הנעילה עם השלט בהתראה ← לחיצה על Pause.
- **R3:** טיימר שינה ← בחירת זמן ← הספירה לאחור.
- **R4:** מסך ההגדרות עם השתקה בשיחה פעילה.

לפני ההקלטה: לשנות את שם הטלוויזיה ל-"Living room", להשתיק התראות אחרות, סוללה מלאה ושעה ניטרלית.

---

## 2. גרסה A – 30 שניות לגוגל פליי (16:9)

מוזיקה: קצבית ושקטה (YouTube Audio Library, ללא זכויות). אפשר בלי קריינות, הטקסט על המסך נושא את המסר.

| זמן | מה רואים | טקסט על המסך | תמונות לצרף |
|---|---|---|---|
| 0:00–0:03 | **פתיחה.** סלון בערב, זוג על הספה, טלוויזיה דולקת. יד מחפשת את השלט בין הכריות ולא מוצאת. | **Lost the remote again?** | – |
| 0:03–0:07 | יד מרימה טלפון מהשולחן. חיתוך לקלוז-אפ: האפליקציה נפתחת (R1). | **Your TV, right on your phone** | `icon-512.png`, `screenshots/en-1.png` |
| 0:07–0:11 | אגודל לוחץ על ווליום וחצים (R1). חיתוך לטלוויזיה שמגיבה, התפריט זז. | **Over Wi-Fi. No account.** | `screenshots/en-1.png` |
| 0:11–0:18 | **השיא.** טלפון על השולחן מתחיל לצלצל. הטלוויזיה **מושתקת מיד** (אייקון השתקה בעורך). האישה עונה בחיוך, והקול חוזר כשהיא מנתקת. | **Phone rings? The TV hushes.** ‏`PRO` | `screenshots/en-2.png` |
| 0:18–0:22 | טלפון נעול, השלט על מסך הנעילה, לחיצה על Pause (R2). | **Remote on your lock screen** ‏`PRO` | `screenshots/en-3.png` |
| 0:22–0:26 | לילה. מישהו נרדם על הספה. בטלפון ספירה לאחור של טיימר השינה (R3). הטלוויזיה כבה והחדר מחשיך. | **Fall asleep? The TV turns off.** ‏`PRO` | `screenshots/en-7.png` |
| 0:26–0:30 | **מסך סיום:** האייקון, שם האפליקציה וצילום המסך הראשי על רקע כהה. | **Universal Smart TV Remote**<br>Basic remote included · Pro extras: pay once | `icon-512.png`, `feature-graphic.png` |

**תג PRO** (חובה, בהתאם להחלטה שלנו לא להציג Pro כחינם): תג קטן "PRO" ליד כל טקסט של תכונת Pro. בדיוק כמו בצילומי המסך.

### פרומפטים ל-Higgsfield (באנגלית, להעתקה)

כדי שהדמויות והסלון יישארו עקביים: לייצר קודם **תמונת פתיחה אחת** של הסלון והזוג, ולהשתמש בה כרפרנס בכל הקליפים. כל קליפ באורך 5 שניות.

סגנון קבוע להוסיף בסוף כל פרומפט:
```text
cinematic, photorealistic, warm evening living room, soft lamp light, shallow depth of field, 35mm lens, natural skin tones, no text, no logos, no brand names
```

1. **Hook:**
```text
A couple relaxing on a modern sofa in the evening, a large wall-mounted TV glowing with a calm nature scene. The man searches between the sofa cushions for the TV remote, frustrated, lifts a cushion – nothing. Slow push-in.
```
2. **Picking up the phone:**
```text
Close-up of a hand picking up a smartphone from a wooden coffee table, the phone screen facing the camera slightly out of focus, TV glowing in the blurred background. Gentle handheld camera.
```
3. **TV responds:**
```text
Over-the-shoulder shot from the sofa toward a large TV, the on-screen menu tiles move smoothly from left to right as if navigated with a remote. The TV frame is plain black with no logo. Static camera.
```
4. **Call (the hero shot):**
```text
A smartphone lying on a coffee table lights up and vibrates with an incoming call. In the background the couple on the sofa watching TV looks toward the phone; the woman smiles and reaches for the phone. Slow rack focus from the phone to the couple.
```
   אחר כך, בעורך: אייקון השתקה (רמקול עם קו) בפינת מסך הטלוויזיה בדיוק ברגע הצלצול.
5. **Lock screen:**
```text
Close-up of a hand holding a smartphone with a dark lock screen, the thumb taps a button on a notification. Soft background bokeh of a living room TV. Minimal motion.
```
   את מסך הטלפון מחליפים ב-R2 או ב-`en-3.png`.
6. **Falling asleep:**
```text
Late night, a man dozing off on the sofa under a blanket, a phone resting on his chest, the TV in front of him slowly fades to black and the room becomes dark and quiet. Slow static shot.
```

**לפני שמשתמשים בקליפ, לבדוק:**
- שאין לוגו על מסגרת הטלוויזיה. אם יש, לטשטש או לייצר מחדש.
- שאין טקסט מעוות ושאין ידיים עם שש אצבעות.
- שעל מסך הטלוויזיה לא מופיעה תוכנית או סרט אמיתי.

---

## 3. גרסה B – 15 שניות לרשתות (9:16)

| זמן | מה רואים | טקסט |
|---|---|---|
| 0:00–0:02 | הטלפון מצלצל, ובאותו רגע הטלוויזיה מושתקת | **My TV mutes itself when my phone rings 🤯** |
| 0:02–0:06 | קלוז-אפ על הגדרת השתקה בשיחה (R4) | **Calls & WhatsApp – auto-mute** ‏`PRO` |
| 0:06–0:09 | השלט על מסך הנעילה (R2) | **Remote on the lock screen** ‏`PRO` |
| 0:09–0:12 | המסך הראשי, לחיצות מהירות (R1) | **Samsung · LG · Android TV – one app** |
| 0:12–0:15 | מסך סיום עם האייקון | **Free basic remote · Pro: pay once, no subscription**<br>Universal Smart TV Remote – on Google Play |

ברשתות מותר לכתוב "Free" ושמות מותגים. המגבלה הזו חלה רק על הנכסים בחנות עצמה.

**טקסטים בעברית לגרסה ישראלית:**
- "הטלוויזיה משתתקת לבד כשמתקשרים אליי 🤯"
- "שיחות רגילות וגם וואטסאפ" ‏`PRO`
- "שלט על מסך הנעילה" ‏`PRO`
- "סמסונג · LG · אנדרואיד TV – אפליקציה אחת"
- "שלט בסיסי חינם · Pro בתשלום חד-פעמי, בלי מנוי"

---

## 4. כללים לגרסת גוגל פליי

- הסרטון עולה ל-**YouTube** (ציבורי או לא-רשום), ומדביקים את הקישור ב-Play Console ← Main store listing ← Video.
- **בלי פרסומות על הסרטון** (מונטיזציה כבויה), ולא "made for kids". צריך לאפשר הטמעה (embedding).
- בגרסת החנות: **בלי** המילים Free / Best / #1, בלי מחירים, בלי "Download now" ובלי שמות או לוגואים של מותגים. אלה אותם כללים שקבענו לצילומי המסך.
- רק תכונות שקיימות באמת, ו-PRO מסומן. **לא להראות הקלדה ביוטיוב**, כי היא לא עובדת בסמסונג וב-LG.
- המסך הראשון מוצג כתמונת התצוגה של הסרטון בחנות, אז ההתחלה צריכה להיות חזקה.
- **YouTube:** כשמעלים סרטון עם אנשים ריאליסטיים שנוצרו ב-AI, מסמנים "Altered or synthetic content" בזמן ההעלאה.

## 5. סדר עבודה מומלץ

1. להקליט את R1–R4 בטלפון (10 דקות).
2. לייצר ב-Higgsfield תמונת פתיחה של הסלון והזוג, ואז את ששת הקליפים (2–3 ניסיונות לכל אחד).
3. ב-CapCut: פרויקט 1920×1080, לשים את הקליפים לפי הטבלה, להכניס את הקלטות המסך במסגרת טלפון, ולהוסיף טקסטים, תגי PRO, אייקון השתקה ומוזיקה.
4. לייצא, ומאותו פרויקט לחתוך גם את גרסת ה-9:16 של 15 שניות.
5. להעלות ליוטיוב ולהדביק את הקישור ב-Play Console.
