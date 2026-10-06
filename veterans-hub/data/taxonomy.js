// מילון הקטגוריות והתגיות — משותף לאתר ולכלי הייבוא.
// כל שירות במאגר משתמש רק במפתחות שמוגדרים כאן.
window.TAXONOMY = {
  categories: {
    "hotlines":            { label: "קווי סיוע ומצוקה",          icon: "☎️" },
    "mental-health":       { label: "טיפול נפשי",                icon: "🧠" },
    "peer-support":        { label: "תמיכת עמיתים וקבוצות",      icon: "🤝" },
    "rehab-farm":          { label: "חוות שיקומיות וחקלאות טיפולית", icon: "🌾" },
    "animal-therapy":      { label: "טיפול בעזרת בעלי חיים",     icon: "🐴" },
    "water-sports":        { label: "ים: גלישה, צלילה ושיט",      icon: "🌊" },
    "sports":              { label: "ספורט ופעילות גופנית",       icon: "🏃" },
    "yoga-mind-body":      { label: "יוגה, מיינדפולנס וגוף-נפש",  icon: "🧘" },
    "nature-retreats":     { label: "טבע, מסעות וריטריטים",       icon: "🏕️" },
    "art-music":           { label: "אמנות, מוזיקה ויצירה",       icon: "🎨" },
    "employment-education":{ label: "תעסוקה, לימודים ויזמות",     icon: "💼" },
    "rights-legal":        { label: "מיצוי זכויות וסיוע משפטי",   icon: "⚖️" },
    "financial-grants":    { label: "מענקים וסיוע כלכלי",         icon: "💰" },
    "family-support":      { label: "תמיכה במשפחה ובני זוג",      icon: "👨‍👩‍👧" },
    "medical-rehab":       { label: "שיקום רפואי ופיזי",          icon: "🏥" },
    "housing-daily":       { label: "דיור ועזרה ביומיום",         icon: "🏠" },
    "community-volunteer": { label: "קהילה והתנדבות",             icon: "🌱" }
  },
  eligibility: {
    "mod-recognized":  "מוכר/ת באגף השיקום (משרד הביטחון)",
    "mod-in-process":  "בתהליך הכרה במשרד הביטחון",
    "not-recognized":  "לא מוכר/ת / עוד לא הגשתי",
    "reservists":      "משרת/ת מילואים",
    "combat-soldiers": "לוחם/ת בסדיר או משוחרר/ת",
    "police":          "שוטר/ת או גמלאי/ת משטרה",
    "security-forces": "כוחות ביטחון והצלה אחרים (שב\"ס, שב\"כ, כבאות, מד\"א, זק\"א, כיתות כוננות)",
    "families":        "בן/בת משפחה או בן/בת זוג",
    "bereaved":        "משפחה שכולה",
    "terror-victims":  "נפגע/ת פעולות איבה",
    "civilians":       "אזרח/ית שחווה טראומה"
  },
  difficulties: {
    "ptsd": "פוסט-טראומה", "anxiety": "חרדה", "depression": "דיכאון / חוסר אנרגיה",
    "sleep": "שינה וסיוטים", "anger": "כעס ועצבנות", "moral-injury": "פגיעה מוסרית / אשמה",
    "loneliness": "בדידות וניתוק", "addiction": "התמכרות (אלכוהול, סמים, הימורים, מסכים)",
    "physical-disability": "פציעה או נכות פיזית", "amputation": "קטיעה",
    "tbi": "פגיעת ראש / פגיעה מוחית", "chronic-pain": "כאב כרוני",
    "family-relations": "קשיים בזוגיות ובמשפחה", "employment": "תעסוקה וחזרה לעבודה",
    "bureaucracy": "בירוקרטיה והכרה בזכויות", "financial": "קושי כלכלי", "grief": "אובדן ושכול"
  },
  interests: {
    "sea": "ים ומים", "nature": "טבע וטיולים", "animals": "בעלי חיים", "sport": "ספורט",
    "fitness": "כושר", "mind-body": "יוגה ומדיטציה", "art": "אמנות", "music": "מוזיקה",
    "writing": "כתיבה", "tech": "טכנולוגיה", "volunteering": "התנדבות", "travel": "טיולים ונסיעות",
    "learning": "לימודים", "spiritual": "רוחניות ואמונה", "cooking": "בישול",
    "crafts": "עבודת כפיים ונגרות", "extreme": "אקסטרים ואדרנלין"
  },
  regions: {
    "north": "צפון", "haifa": "חיפה והקריות", "sharon": "שרון", "center": "מרכז",
    "jerusalem": "ירושלים והסביבה", "south": "דרום", "judea-samaria": "יהודה ושומרון",
    "nationwide": "בכל הארץ", "online": "אונליין / טלפוני"
  },
  cost: {
    "free":       { label: "ללא עלות",           rank: 0 },
    "mod-funded": { label: "במימון משרד הביטחון", rank: 1 },
    "subsidized": { label: "מסובסד",              rank: 2 },
    "partial":    { label: "השתתפות עצמית חלקית", rank: 3 },
    "paid":       { label: "בתשלום",              rank: 4 }
  },
  providerTypes: {
    "government": "גוף ממשלתי", "ngo": "עמותה", "hmo": "קופת חולים", "private": "פרטי",
    "academic": "אקדמי", "municipal": "רשות מקומית"
  }
};
