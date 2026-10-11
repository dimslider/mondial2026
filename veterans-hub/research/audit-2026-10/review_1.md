# Review 1: sample1.json (36 records)

Reviewer role: external reviewer for services for wounded fighters and people with PTSD, and for plain writing for people in distress.
Method: I read all 36 records field by field and ran 8 web spot checks (results below). No repo files were changed.

**Average score: 3.2 / 5.** The cards from official sources (MoD Rehabilitation Division, National Insurance, the veterans' division, Kol Zchut) are generally good. The weak points are the Shikum.Me supplier cards (8 out of 36) and records from secondary sources that have no contact channel.

## Web spot checks

| Claim | Result |
|---|---|
| 6,600 ₪ a year for complementary treatments (Shikum.Me suppliers) | Partly confirmed. National Insurance shows a cap of 6,600 ₪ from January 2026 in "Nefesh Achat" for victims of hostile acts with 20% or more. I did not find an MoD Rehabilitation Division source for the same figure. Every supplier card repeats it, so one source needs to be anchored |
| *5266 for the Discharged Soldiers and Reserves Division (hachvana-mod-gov-il-543dde) | Confirmed (Kol Zchut). The hours and WhatsApp were not checked |
| *3362 for NATAL (natal-org-il-4f510a) | Confirmed, but this is NATAL's support line, not WeRise sign-up |
| "בידיים טובות" (Bidayim Tovot) *3757 (shikum-mod-gov-il-22016b) | Confirmed as a free MoD service for the recognition process |
| Free legal representation from the Jerusalem Institute of Justice (s-3b7077) | Confirmed, as a volunteer joint project with other organizations. Separately there is a government pilot of funded representation with a 500 ₪ co-payment. The two must not be confused |
| Easier reserve duty for single parents (s-12749c) | Confirmed (Kol Zchut: service that allows going home every day) |
| Memadim scholarship, deadline 31.10.26 (hachvana-mod-gov-il-0463e0) | Not confirmed in search. Suspected mismatch between the school year (תשפ"ו) and the date. Needs a manual check |
| WeRise, NATAL | Not found in search. The record relies on NATAL's website only |

## Score for each record

| id | Name (short) | Score | Note (only if there is a problem) |
|---|---|---|---|
| s-01be6a | סטודיו NAFAS – כפר יאסיף | 2 | See the "Shikum.Me suppliers" pattern: no phone, address or website. A one-line description. Nothing to act on except "go into the app" |
| s-3b7077 | ייצוג משפטי – המכון הירושלמי לצדק | 4 | "בהתנדבות מלאה" (on a fully volunteer basis) does not say clearly that it costs nothing to the person. how_to_apply has no hours and no email. Say that this is a joint project and that the MoD pilot (500 ₪ co-payment) is a different track |
| izunefesh-com-891c88 | איזונפש – בתים מאזנים | 3 | Contradiction: eligibility includes `civilians` but cost=`mod-funded`. For people outside MoD it is not stated who pays. The terms "בית מאזן" (balancing house) and "התחייבות" (referral commitment) are not explained. No phone |
| tzavcosher-com-5e89b4 | צו כושר | 4 | cost=`free` relies on a note that admits "it is not stated explicitly on the site". recognition=`unknown` should be `not_required`, since only proof of reserve duty is needed. Mobile phone |
| shany-co-il-116a6d | בית מעגן – חופית | 4 | "משבר פסיכו סוציאלי" (psychosocial crisis) is jargon. "20 דקות הליכה מהים" (20 minutes' walk from the sea) is superfluous. No phone. It is not stated that this is not an emergency service |
| s-efa6f3 | תשלומים והחזרי הוצאות מילואים | 2 | No contact channel at all. how_to_apply ("through the IDF reserves website") has no link. A generic card with no clear action. recognition should be `not_required` |
| achimlachaim-org-37cae0 | בית האחים – אחים לחיים | 3 | "חברי העמותה" (members of the association): it is not clear who can join. cost=`free` with an empty cost_notes. No address or opening hours |
| shikum-mod-gov-il-a17284 | בית מאזן רגעים – מגדל העמק | 4 | eligibility includes `mod-in-process` but recognition=`required`, a contradiction. "שמונע אשפוז" (which prevents hospitalization) sounds like a promise; better "חלופה לאשפוז" (an alternative to hospitalization) |
| shikum-mod-gov-il-5af3f4 | נכי משטרה – זכויות | 4 | "ונספים" (and those who died) in the name is unexplained and painful for someone in distress, and the card does not deal with the bereaved. The useful phones sit in how_to_apply while the phone field is empty |
| levechad-org-fe21c5 | שיעורי עזר – לב אחד | 2 | The only source is an English university page. Not verified, and probably a wartime project that has ended. "ההרשמה למתנדבים דרך אפליקציה" (volunteers register through an app) is not relevant to a parent. how_to_apply ("through the Lev Echad website") is not actionable. category `community-volunteer` is wrong for a service for children |
| shikum-mod-gov-il-1b5856 | קבוצת כאב כרוני – רחובות | 5 | |
| zaka-org-il-aaf3bf | זק"א – אגף החוסן | 2 | Only for ZAKA volunteers, but tagged `civilians` and `security-forces`, so it will show up for the general public. No contact channel or form |
| hachvana-mod-gov-il-0463e0 | מלגת ממדים ללימודים | 3 | Name and description say "100%", while the body says "85% and then topped up". The eligibility condition (gold honorable discharge, up to 5 years) is hidden in how_to_apply. The registration date will expire within weeks, and the school-year/date match is in doubt |
| btl-gov-il-090b89 | שיקום מקצועי לנפגעי איבה | 4 | how_to_apply ("contact the rehabilitation worker at the branch") does not say how. Add *6050. eligibility `civilians` is too broad (the condition is 20% or more as a victim of hostile acts) |
| shikum-mod-gov-il-9a6f3c | המכון הרפואי לבטיחות בדרכים | 3 | kind=`housing` is wrong (should be `rights` or a service). The abbreviation "מרב"ד" (the institute's acronym) is unexplained. No phone for the institute. Hardly relevant to PTSD |
| s-8153e2 | לונה סרף – עכו | 2 | Shikum.Me pattern. In addition, "השכרת גלשן וסאפ" (surfboard and SUP rental) is not a funded activity, and it is unclear what is covered |
| natal-org-il-4f510a | WeRise – נט"ל | 4 | The phone *3362 is NATAL's support line, not sign-up; this should be stated. "שורדי המסיבות" (survivors of the parties) is a vague term; better "ששרדו את המסיבות ב-7 באוקטובר (נובה ועוד)" (who survived the parties on October 7: Nova and others) |
| s-3970c8 | Big Gym – אום אל-פחם | 2 | Shikum.Me pattern. Separate activity for women and men, but there is no gender field |
| shikum-mod-gov-il-ca1087 | מענים טיפוליים של אגף השיקום | 3 | An umbrella card with no phone (*8150). intensity=`unknown`. eligibility `mod-in-process` against recognition=`required`. Jargon: "Deep TMS", "נוירופידבק" (neurofeedback). "the district rehabilitation worker": how do you reach them? |
| helemkrav-org-il-0ecceb | עמותת הלם קרב | 4 | A slogan in the name ("לא מפקירים פצועים בשטח", "we don't abandon the wounded in the field"). "לפי כתבה עליהם" (according to an article about them) is weak sourcing written into the card itself |
| invisiblealbum-com-d049ec | מרכז טללים – נתניה | 3 | The website is a product page on a third-party site (Invisible Album), not the municipality's. No phone. The claim about 12 sessions through "עמית" (Amit) is not anchored in an official source. Not verified |
| s-fe45df | Bepilates – זרזיר | 2 | Shikum.Me pattern. Women only: no gender field |
| hachvana-mod-gov-il-543dde | היחידה להכוונת חיילים משוחררים | 4 | The description is a long list of everything the division does. Keep 2–3 key items. The hours and WhatsApp were not verified |
| s-12749c | הקלות להורים יחידים במילואים | 4 | The number 1111 has no explanation of what it is. eligibility `families` is wrong (the right belongs to the reservist). "זכות בחוק/פקודה" (a right under law/order) is jargon |
| s-d3e2c4 | Gmynasem – ירכא | 2 | Shikum.Me pattern. Women only |
| israelparasport-org-298d3c | שס"ק – ספיבק רמת גן | 4 | The acronym in the name. cost=`free` with an empty cost_notes. intensity=`unknown` |
| lohamim-org-il-1df527 | גלים של אהבה – לוחמים לחיים | 2 | The source is from 2023 and the project may no longer be active. No region, cost or phone. "Contact through the website" is vague |
| atalef-com-61908c | חבל זוג – העטלף | 3 | No regions, even though the activity is at sea in fixed locations. cost is empty while cost_notes speaks of donations. No phone or email |
| soultalkfarm-org-il-885fa7 | שיח נפש – חווה בצור משה | 4 | No phone. The name "שיח נפש" (Soultalk) does not say it is a farm until the subtitle |
| 669-org-il-a11cf6 | מחלצים את המחלצים – 669 | 3 | Meant for alumni of Unit 669, but tagged `combat-soldiers`/`reservists` in general, so it will show up for anyone. cost=`subsidized` without an explanation |
| shikum-app-ca9a4f | שיקום אפ (אתר פרטי) | 3 | cost is empty. A private site with a lawyers directory may be a commercial lead source. The warning in the description is good; also state whether there is a fee. interests=`tech` is irrelevant |
| s-de5d79 | G-fit – כפר קרע | 2 | Shikum.Me pattern. Women only |
| s-5a21e9 | Harmony Pilates – ירושלים | 2 | Shikum.Me pattern. cost_notes is not uniform with the others (6,600 is missing). intensity=`weekly` while the other suppliers are `light` |
| shikum-mod-gov-il-4a064a | שייט טיפולי – אגף השיקום | 4 | The website points to the general groups page and not to /groups/6152. No email or phone for the group |
| ladiesinshape-co-il-498ef8 | ליידיס אין שייפ – חיפה | 3 | "בשיטת Curves" (using the Curves method) is an unverified claim and a foreign brand. Women only, not marked in a field. Has a phone (good) |
| shikum-mod-gov-il-22016b | הגשת בקשה להכרה בנכות | 4 | An English parenthesis in the name adds clutter. A very full card. A short first sentence ("זה הצעד הראשון" / "this is the first step") would help |

## The 10 most serious problems (ready to paste)

**1. zaka-org-il-aaf3bf: wrong audience. The card shows up for people who are not eligible.**
- eligibility: `["zaka-volunteers"]` (or hide it from the public catalogue)
- description: `אגף החוסן של זק"א מקיים סדנאות ופעילויות לחיזוק נפשי, רק למתנדבי ומתנדבות זק"א: רכיבה טיפולית, סדנאות נשימה, בישול טיפולי, מעגלי חוסן וסדנאות בטבע לעיבוד חוויות מהשטח.`
- how_to_apply: `מתנדבי זק"א פונים לרכז/ת הסניף או לאגף החוסן דרך אתר זק"א.`

**2. s-efa6f3: no action and no contact channel.**
- website: `https://www.kolzchut.org.il/he/תשלומים_והחזרי_הוצאות_בגין_שירות_מילואים`
- how_to_apply: `תגמולי מילואים משולמים דרך ביטוח לאומי (*6050). להחזרי הוצאות (טיפול בילדים, בעלי חיים, טיפול רגשי לבני משפחה ועוד) מגישים בקשה באתר המילואים של צה"ל, עם קבלות. הרשימה המלאה והתנאים: במדריך של כל זכות.`
- recognition: `not_required`

**3. Shikum.Me suppliers (8 records: s-01be6a, s-8153e2, s-3970c8, s-fe45df, s-d3e2c4, s-de5d79, s-5a21e9, ladiesinshape-co-il-498ef8): no contact channel and no explanation for someone who is not eligible.**
- description (template): `<סוג הפעילות> ב<יישוב>. <לנשים בלבד / לגברים ולנשים>. ממומן מסל הטיפולים המשלימים של אגף השיקום, רק למי שמוכר/ת עם 20% נכות ומעלה בגלל פוסט טראומה, פגיעה נפשית או פגיעת ראש (או 100% ומעלה).`
- how_to_apply (template): `פותחים את אפליקציית Shikum.Me, נכנסים לארנק הדיגיטלי ובוחרים את הספק. לא בטוח/ה שאת/ה זכאי/ת? מוקד אגף השיקום *8150.`
- phone: the business's phone (from the source list or Google Business). If it cannot be found, use `*8150` as a fallback.

**4. levechad-org-fe21c5: unverified and probably no longer active.**
- Hide until verified (confidence=`low`). If it is active:
- description: `מתנדבי לב אחד נותנים שיעורי עזר מקוונים לילדים של משרתי מילואים ושל יישובי קו העימות.`
- how_to_apply: `נרשמים לשיעורי עזר דרך טופס הבקשה לעזרה באתר לב אחד.`
- category: `family-support` (or the equivalent category in the database)

**5. lohamim-org-il-1df527: a 2023 source with no region, cost or phone.**
- Hide until verified that the project is still running (confidence=`low`).
- cost_notes: `לא ידוע. כדאי לשאול את העמותה לפני ההרשמה.`
- regions: fill in according to the beach where they meet.

**6. izunefesh-com-891c88: cost and eligibility contradict each other.**
- cost_notes: `למי שבתהליך הכרה באגף השיקום: ללא עלות, בהפניה מהמרפאה המחוזית. לשאר הפונים: לפי זכאות במשרד הבריאות או בתשלום, לבדוק מול איזונפש.`
- description, opening sentence: `בית מאזן הוא מקום מגורים טיפולי לתקופה קצרה, חלופה לאשפוז פסיכיאטרי.`

**7. 669-org-il-a11cf6: tagging too broad.**
- eligibility: `["unit-669-alumni"]` (or a "unit_restriction" field). Add to the description: `מיועד לבוגרי ובוגרות יחידה 669 בלבד.`

**8. hachvana-mod-gov-il-0463e0: a misleading "100%" claim and a date that will expire.**
- description: `מלגה של משרד הביטחון לתואר ראשון, שני או לימודי תעודה. בכל שנה מקבלים החזר של עד 85% משכר הלימוד, ובשנה האחרונה משלימים ל-100%. מיועדת למי שקיבל/ה תעודת "שחרור בכבוד-זהב" (לוחמים) ולאוכלוסיות ייחודיות, עד 5 שנים מהשחרור.`
- Move the deadline into a dedicated date field (deadline) and check which school year it applies to.

**9. shikum-mod-gov-il-5af3f4: a distressing word in the name, and the phones are in the wrong field.**
- name: `שוטרים ושוטרות שנפגעו בשירות – הכרה וזכויות דרך אגף השיקום`
- phone: `02-5428584`
- how_to_apply: `מגישים בקשה להכרה בטופס הדיגיטלי של אגף השיקום. לעזרה באיסוף מסמכים: מדור נפגעים במשטרה, 02-5428584 או 02-5428764.`

**10. Contradiction between `mod-in-process` and recognition=`required` (shikum-mod-gov-il-a17284, shikum-mod-gov-il-ca1087).**
- recognition: `partial` (a new value), or `not_required`, plus in cost_notes: `גם למי שבתהליך הכרה, אחרי אישור טיפול מאגף השיקום.`
- a17284 description: replace "שמונע אשפוז פסיכיאטרי" (which prevents psychiatric hospitalization) with `שמשמש חלופה לאשפוז פסיכיאטרי` (which serves as an alternative to psychiatric hospitalization).

## Recurring patterns and rules for the whole database

1. **No contact channel (24 out of 36 have no phone).** Rule: every record without a phone gets the umbrella body's phone (*8150 for MoD Rehabilitation Division suppliers, *6050 for National Insurance, *5266 for the Discharged Soldiers Division), together with the text "למידע וזכאות" (for information and eligibility). A record with no phone, no website and no form is not shown.
2. **Vague how_to_apply** ("דרך האתר" / through the website, "פונים לעמותה" / contact the association, "פנייה לעובד השיקום" / contact the rehabilitation worker). Rule: how_to_apply must contain a verb plus a specific channel (number, link to a form, or app with the path inside it). Validation: reject how_to_apply under 40 characters, or one that has no digit, URL or app name.
3. **cost=`free`/`subsidized` with an empty or self-contradicting cost_notes** (achimlachaim, israelparasport, 669, tzavcosher). Rule: free/subsidized requires a cost_notes that cites the source. Otherwise cost=`unknown` and the text `כדאי לברר עלות לפני` (check the cost before going).
4. **Contradiction between eligibility and recognition** (mod-in-process alongside required). Rule: an automatic check. If `mod-in-process` ∈ eligibility, then recognition ≠ `required`.
5. **Eligibility too broad for organisations of one unit or one group of volunteers** (ZAKA, 669) and for women-only places. Rule: a mandatory field for a narrow audience (restricted_to), and a gender field.
6. **Empty regions/cost** (lohamim, atalef, shikum.app). Rule: an empty value is not allowed. Use `unknown` and the text "לברר" (to be checked).
7. **Unverified records (verified_at empty, 12 out of 36), including all the suppliers.** Rule: show a "לא אומת" (not verified) badge, and do not show a record whose source is older than 18 months without verification.
8. **Jargon and abbreviations** (מרב"ד, שס"ק, התחייבות, פסיכו סוציאלי, Deep TMS, "זכות בחוק/פקודה"). Rule: an abbreviation in the name requires the full form in the first sentence of the description. A list of banned words, with plain replacements.
9. **Slogans and English in the name** (helemkrav, 22016b). Rule: name = "what it is – who runs it". No slogans, and no translation into English.
10. **kind tagging** (9a6f3c=`housing`). Rule: an automatic check that kind matches category (medical-rehab cannot be housing unless the name includes "דיור" / housing).

## What is missing on the card itself

- **Gender / audience restriction** (restricted_to): women only, alumni of a unit, volunteers of an organisation.
- **Deadline / registration period** (deadline), with automatic hiding after the date.
- **Opening hours / availability** of the contact channel (when they answer), and whether it is an emergency service. Every non-emergency card in mental health should show a fixed line: "במצוקה עכשיו? *8944 / ער"ן 1201" (In distress now? *8944 / ERAN 1201).
- **Full address**, for places with a physical location (suppliers, farms, balancing houses).
- **Response time / waiting list** ("חוזרים אליך תוך…" / they will get back to you within…).
- **Accessibility** (wheelchair access, accessible parking). Important for a physical-disability audience.
- **Language of service** (Arabic, Russian, English): relevant to suppliers in Arab towns.
- **A visible "last verified" badge** (verified_at exists in the data but not on the card).
- **What happens after you apply** (one line: assessment, screening call, waiting).
- **WhatsApp** as a separate channel (it appears inside the text of several records).
