const WORLD_CUP_DATA = {

  // football-data.org team IDs (for API integration)
  apiTeamIds: {
    'ארגנטינה': 762, 'ברזיל': 764, 'ספרד': 760, 'צרפת': 773,
    'גרמניה': 759, 'אנגליה': 770, 'פורטוגל': 765, 'הולנד': 779,
    'מקסיקו': 788, 'ארה"ב': 768, 'יפן': 784, 'קרואטיה': 799,
  },

  venues: {
    'לוס אנג\'לס': { stadium:'SoFi Stadium', city:'לוס אנג\'לס, קליפורניה', capacity:70240, flag:'🇺🇸' },
    'מיאמי':       { stadium:'Hard Rock Stadium', city:'מיאמי, פלורידה', capacity:65326, flag:'🇺🇸' },
    'דאלאס':       { stadium:'AT&T Stadium', city:'ארלינגטון, טקסס', capacity:80000, flag:'🇺🇸' },
    'סיאטל':       { stadium:'Lumen Field', city:'סיאטל, וושינגטון', capacity:68740, flag:'🇺🇸' },
    'ניו יורק':    { stadium:'MetLife Stadium', city:'ניו יורק / ניו ג\'רזי', capacity:82500, flag:'🇺🇸' },
    'שיקגו':       { stadium:'Soldier Field', city:'שיקגו, אילינוי', capacity:61500, flag:'🇺🇸' },
    'בוסטון':      { stadium:'Gillette Stadium', city:'פוקסבורו, מסצ\'וסטס', capacity:65878, flag:'🇺🇸' },
    'פילדלפיה':    { stadium:'Lincoln Financial Field', city:'פילדלפיה, פנסילבניה', capacity:69328, flag:'🇺🇸' },
    'הוסטון':      { stadium:'NRG Stadium', city:'הוסטון, טקסס', capacity:72220, flag:'🇺🇸' },
    'קנזס סיטי':   { stadium:'Arrowhead Stadium', city:'קנזס סיטי, מיזורי', capacity:76416, flag:'🇺🇸' },
    'סן פרנסיסקו': { stadium:'Levi\'s Stadium', city:'סנטה קלרה, קליפורניה', capacity:68500, flag:'🇺🇸' },
    'סיאטל':       { stadium:'Lumen Field', city:'סיאטל, וושינגטון', capacity:68740, flag:'🇺🇸' },
    'טורונטו':     { stadium:'BMO Field', city:'טורונטו, קנדה', capacity:30000, flag:'🇨🇦' },
    'ונקובר':      { stadium:'BC Place', city:'ונקובר, קנדה', capacity:54500, flag:'🇨🇦' },
    'מקסיקו סיטי': { stadium:'Estadio Azteca', city:'מקסיקו סיטי', capacity:87523, flag:'🇲🇽' },
    'גוודלחרה':    { stadium:'Estadio Akron', city:'גוודלחרה, מקסיקו', capacity:46232, flag:'🇲🇽' },
    'מונטריי':     { stadium:'Estadio BBVA', city:'מונטריי, מקסיקו', capacity:51348, flag:'🇲🇽' },
  },

  teams: {
    // ─────────────── ארגנטינה ───────────────
    'ארגנטינה': {
      flag:'🇦🇷', color:'#74ACDF', secondColor:'#FFFFFF',
      titles:3, group:'A', strength:95,
      starPlayer:'ליאונל מסי', coach:'ליאונל סקאלוני',
      formation:'4-3-3',
      funFact:'אלופי עולם 2022! מסי זכה בגביע החלומות שלו בקטאר לאחר 4 ניסיונות.',
      squad: [
        { name:'אמילאנו מארטינז',   pos:'שוער',  age:32, club:'אסטון וילה',          emoji:'🧤', caps:40,  goals:0,  star:false },
        { name:'פרנקו ארמאני',       pos:'שוער',  age:38, club:'ריבר פלייט',           emoji:'🧤', caps:22,  goals:0,  star:false },
        { name:'נאואל מולינה',       pos:'הגנה',  age:26, club:'אטלטיקו מדריד',        emoji:'🛡️', caps:35,  goals:5,  star:false },
        { name:'נסיארה גונזלס',      pos:'הגנה',  age:27, club:'אנטרקטיקו',            emoji:'🛡️', caps:12,  goals:0,  star:false },
        { name:'קריסטיאן רומרו',     pos:'הגנה',  age:26, club:'טוטנהאם',              emoji:'🛡️', caps:45,  goals:2,  star:true  },
        { name:'ליסנדרו מארטינז',    pos:'הגנה',  age:26, club:'מאנצ\'סטר יונייטד',    emoji:'🛡️', caps:40,  goals:3,  star:true  },
        { name:'נסיארס',             pos:'הגנה',  age:31, club:'אינטר מיאמי',           emoji:'🛡️', caps:70,  goals:2,  star:false },
        { name:'ניקולס אוטמנדי',     pos:'הגנה',  age:36, club:'בנפיקה',               emoji:'🛡️', caps:130, goals:18, star:false },
        { name:'מרקוס אקונייה',      pos:'הגנה',  age:32, club:'סביליה',               emoji:'🛡️', caps:50,  goals:4,  star:false },
        { name:'אנחואן זובי',        pos:'קישור', age:29, club:'אינטר',                emoji:'⚙️', caps:18,  goals:2,  star:false },
        { name:'רודריגו דה פאול',    pos:'קישור', age:30, club:'אטלטיקו מדריד',        emoji:'⚙️', caps:75,  goals:14, star:true  },
        { name:'אנזו פרננדס',        pos:'קישור', age:24, club:'צ\'לסי',               emoji:'⚙️', caps:45,  goals:6,  star:true  },
        { name:'אקסקוויאל פאלציוס', pos:'קישור', age:26, club:'בייר לברקוזן',         emoji:'⚙️', caps:38,  goals:4,  star:false },
        { name:'לאנדרו פארדס',       pos:'קישור', age:30, club:'רומא',                 emoji:'⚙️', caps:75,  goals:7,  star:false },
        { name:'אלסיס מק אליסטר',   pos:'קישור', age:25, club:'ליברפול',              emoji:'⚙️', caps:42,  goals:8,  star:true  },
        { name:'גיובאני לו צ\'לסו',  pos:'קישור', age:28, club:'טוטנהאם',              emoji:'⚙️', caps:48,  goals:8,  star:false },
        { name:'ניקולס גונזלס',      pos:'קדימה', age:26, club:'יובנטוס',              emoji:'⚡', caps:38,  goals:10, star:false },
        { name:'ליאונל מסי',         pos:'קדימה', age:38, club:'אינטר מיאמי',          emoji:'⭐', caps:191, goals:109,star:true  },
        { name:'לאוטארו מארטינז',    pos:'קדימה', age:27, club:'אינטר',               emoji:'⚡', caps:70,  goals:35, star:true  },
        { name:'חוליאן אלוארז',      pos:'קדימה', age:24, club:'אטלטיקו מדריד',        emoji:'🔥', caps:48,  goals:24, star:true  },
        { name:'פאולו דיבלה',        pos:'קדימה', age:31, club:'רומא',                 emoji:'🎭', caps:42,  goals:9,  star:false },
        { name:'אנחל די מריה',       pos:'קדימה', age:36, club:'בנפיקה',               emoji:'🪄', caps:145, goals:31, star:false },
        { name:'אלחנדרו גרנאצ\'ו',   pos:'קדימה', age:20, club:'מאנצ\'סטר יונייטד',    emoji:'⚡', caps:25,  goals:8,  star:false },
      ]
    },

    // ─────────────── ברזיל ───────────────
    'ברזיל': {
      flag:'🇧🇷', color:'#009C3B', secondColor:'#FFDF00',
      titles:5, group:'G', strength:92,
      starPlayer:'ויניסיוס ג\'וניור', coach:'דורידו',
      formation:'4-2-3-1',
      funFact:'5 תארים — יותר מכל קבוצה! הברזילאים טרם זכו מחוץ לאמריקה הלטינית.',
      squad: [
        { name:'אלישון בקר',          pos:'שוער',  age:32, club:'ליברפול',              emoji:'🧤', caps:80,  goals:0,  star:true  },
        { name:'אדרסון',              pos:'שוער',  age:30, club:'מאנצ\'סטר סיטי',       emoji:'🧤', caps:40,  goals:0,  star:false },
        { name:'בנטו',                pos:'שוער',  age:28, club:'אל קדסייה',            emoji:'🧤', caps:12,  goals:0,  star:false },
        { name:'דנילו',               pos:'הגנה',  age:33, club:'יובנטוס',              emoji:'🛡️', caps:90,  goals:8,  star:false },
        { name:'אדר מיליטאו',         pos:'הגנה',  age:26, club:'ריאל מדריד',           emoji:'🛡️', caps:42,  goals:2,  star:true  },
        { name:'מרקינהוס',            pos:'הגנה',  age:30, club:'פריז סן-ז\'רמן',       emoji:'🛡️', caps:90,  goals:8,  star:true  },
        { name:'גבריאל מגלהאיס',      pos:'הגנה',  age:26, club:'ארסנל',               emoji:'🛡️', caps:30,  goals:2,  star:false },
        { name:'ונדל',                pos:'הגנה',  age:26, club:'פורטו',               emoji:'🛡️', caps:28,  goals:2,  star:false },
        { name:'גיייארמה ארנה',       pos:'הגנה',  age:27, club:'אטלטיקו מינירו',       emoji:'🛡️', caps:30,  goals:2,  star:false },
        { name:'קסמירו',              pos:'קישור', age:32, club:'מאנצ\'סטר יונייטד',    emoji:'💪', caps:80,  goals:8,  star:false },
        { name:'ברונו גימאראיש',      pos:'קישור', age:26, club:'ניוקאסל',              emoji:'⚙️', caps:42,  goals:4,  star:true  },
        { name:'לוקס פאקטה',          pos:'קישור', age:26, club:'וסטהאם',              emoji:'⚙️', caps:55,  goals:10, star:true  },
        { name:'גרסון',               pos:'קישור', age:26, club:'מרסיי',               emoji:'⚙️', caps:30,  goals:2,  star:false },
        { name:'דוגלס לואיז',         pos:'קישור', age:26, club:'יובנטוס',              emoji:'⚙️', caps:30,  goals:4,  star:false },
        { name:'ויניסיוס ג\'וניור',   pos:'קדימה', age:24, club:'ריאל מדריד',           emoji:'⚡', caps:70,  goals:28, star:true  },
        { name:'רודריגו',             pos:'קדימה', age:23, club:'ריאל מדריד',           emoji:'🔥', caps:38,  goals:12, star:true  },
        { name:'ראפינה',              pos:'קדימה', age:28, club:'ברצלונה',              emoji:'💨', caps:60,  goals:20, star:true  },
        { name:'גבריאל מרטינלי',      pos:'קדימה', age:23, club:'ארסנל',               emoji:'⚡', caps:35,  goals:10, star:false },
        { name:'אנדריק',              pos:'קדימה', age:18, club:'ריאל מדריד',           emoji:'🌟', caps:18,  goals:5,  star:false },
        { name:'גבריאל בראגנטינו',    pos:'קדימה', age:27, club:'פלמיראס',              emoji:'⚡', caps:22,  goals:8,  star:false },
        { name:'סביניו',              pos:'קדימה', age:20, club:'מאנצ\'סטר סיטי',       emoji:'⚡', caps:10,  goals:2,  star:false },
      ]
    },

    // ─────────────── ספרד ───────────────
    'ספרד': {
      flag:'🇪🇸', color:'#AA151B', secondColor:'#F1BF00',
      titles:1, group:'C', strength:90,
      starPlayer:'לאמין יאמל', coach:'לואיס דה לה פואנטה',
      formation:'4-3-3',
      funFact:'אלופי אירופה 2024! יאמל (17) הוא הכוכב הצעיר ביותר בהיסטוריה של טורניר גדול.',
      squad: [
        { name:'אונאי סימון',         pos:'שוער',  age:27, club:'אתלטיק בילבאו',        emoji:'🧤', caps:40,  goals:0,  star:false },
        { name:'דוד ראיה',            pos:'שוער',  age:29, club:'ארסנל',               emoji:'🧤', caps:8,   goals:0,  star:false },
        { name:'רובן לה נורמנד',      pos:'הגנה',  age:28, club:'אטלטיקו מדריד',        emoji:'🛡️', caps:15,  goals:0,  star:false },
        { name:'רובן נבש',            pos:'הגנה',  age:28, club:'ברצלונה',              emoji:'🛡️', caps:35,  goals:2,  star:false },
        { name:'אלק גרסיה',           pos:'הגנה',  age:24, club:'ריאל מדריד',           emoji:'🛡️', caps:20,  goals:1,  star:false },
        { name:'מרק קוקוראייה',       pos:'הגנה',  age:26, club:'צ\'לסי',               emoji:'🛡️', caps:25,  goals:1,  star:false },
        { name:'דני קארבחאל',         pos:'הגנה',  age:32, club:'ריאל מדריד',           emoji:'🛡️', caps:100, goals:4,  star:false },
        { name:'פדרי',                pos:'קישור', age:22, club:'ברצלונה',              emoji:'🎭', caps:40,  goals:9,  star:true  },
        { name:'פאביאן רואיז',        pos:'קישור', age:28, club:'פריז סן-ז\'רמן',       emoji:'⚙️', caps:42,  goals:8,  star:false },
        { name:'מרטין זובימנדי',      pos:'קישור', age:25, club:'ריאל סוסיאד',          emoji:'⚙️', caps:22,  goals:0,  star:false },
        { name:'רודרי',               pos:'קישור', age:28, club:'מאנצ\'סטר סיטי',       emoji:'⚙️', caps:45,  goals:4,  star:true  },
        { name:'לאמין יאמל',          pos:'קדימה', age:17, club:'ברצלונה',              emoji:'🌟', caps:24,  goals:7,  star:true  },
        { name:'ניקו וויליאמס',       pos:'קדימה', age:22, club:'אתלטיק בילבאו',        emoji:'🏃', caps:28,  goals:8,  star:true  },
        { name:'אלואיז מורטה',        pos:'קדימה', age:32, club:'מילאן',               emoji:'🎯', caps:78,  goals:38, star:false },
        { name:'פראן טורס',           pos:'קדימה', age:24, club:'ברצלונה',              emoji:'⚡', caps:20,  goals:8,  star:false },
        { name:'מיקל אויארזבל',       pos:'קדימה', age:27, club:'ריאל סוסיאד',          emoji:'🎯', caps:40,  goals:20, star:false },
        { name:'פרן לופז',            pos:'קדימה', age:22, club:'ברצלונה',              emoji:'⚡', caps:10,  goals:4,  star:false },
      ]
    },

    // ─────────────── צרפת ───────────────
    'צרפת': {
      flag:'🇫🇷', color:'#002395', secondColor:'#ED2939',
      titles:2, group:'D', strength:91,
      starPlayer:'קיליאן מבאפה', coach:'דידייה דשאן',
      formation:'4-2-3-1',
      funFact:'בצוות הצרפתי יש שחקנים ממוצא 15 מדינות שונות — הכי מגוון בעולם!',
      squad: [
        { name:'מייק מניאן',          pos:'שוער',  age:26, club:'פריז סן-ז\'רמן',       emoji:'🧤', caps:14,  goals:0,  star:false },
        { name:'אלפונס אראאולה',      pos:'שוער',  age:32, club:'ברצלונה',              emoji:'🧤', caps:35,  goals:0,  star:false },
        { name:'ג\'ובה קונדוגביה',    pos:'הגנה',  age:22, club:'אינטר',               emoji:'🛡️', caps:20,  goals:0,  star:false },
        { name:'ויליאן סאליבה',       pos:'הגנה',  age:23, club:'ארסנל',               emoji:'🛡️', caps:22,  goals:1,  star:true  },
        { name:'דיאיות אופאמקאנו',    pos:'הגנה',  age:27, club:'ריאל מדריד',           emoji:'🛡️', caps:38,  goals:3,  star:false },
        { name:'לוקס ורנה',           pos:'הגנה',  age:27, club:'צ\'לסי',               emoji:'🛡️', caps:38,  goals:5,  star:false },
        { name:'תיאו הרנדנז',         pos:'הגנה',  age:27, club:'מילאן',               emoji:'🛡️', caps:42,  goals:4,  star:true  },
        { name:'ורן טצ\'אנה',          pos:'קישור', age:24, club:'ריאל מדריד',           emoji:'⚙️', caps:30,  goals:2,  star:false },
        { name:'אדרין ראביו',         pos:'קישור', age:29, club:'יובנטוס',              emoji:'⚙️', caps:50,  goals:11, star:false },
        { name:'מנואל לוקטה',         pos:'קישור', age:27, club:'ביתר ירושלים',         emoji:'⚙️', caps:35,  goals:4,  star:false },
        { name:'אנטואן גריזמן',       pos:'קישור', age:34, club:'אטלטיקו מדריד',        emoji:'🎯', caps:140, goals:44, star:true  },
        { name:'קיליאן מבאפה',        pos:'קדימה', age:27, club:'ריאל מדריד',           emoji:'⚡', caps:90,  goals:47, star:true  },
        { name:'אוסמן דמבלה',        pos:'קדימה', age:27, club:'פריז סן-ז\'רמן',       emoji:'💨', caps:55,  goals:12, star:true  },
        { name:'מרכוס ת\'ורם',        pos:'קדימה', age:27, club:'אינטר',               emoji:'🎯', caps:40,  goals:14, star:false },
        { name:'קינגסלי קומן',        pos:'קדימה', age:28, club:'בייארן מינכן',         emoji:'⚡', caps:58,  goals:13, star:false },
        { name:'ברדיל אנדי',          pos:'קדימה', age:22, club:'מרסיי',               emoji:'⚡', caps:10,  goals:3,  star:false },
      ]
    },

    // ─────────────── גרמניה ───────────────
    'גרמניה': {
      flag:'🇩🇪', color:'#000000', secondColor:'#DD0000',
      titles:4, group:'E', strength:87,
      starPlayer:'פלוריאן וירץ', coach:'יוליאן נגלסמן',
      formation:'4-2-3-1',
      funFact:'4 תארים ו-8 גמרות — המכונה הגרמנית. הדור של וירץ ומוסיאלה הוא המבטיח ביותר מזה עשרות שנים.',
      squad: [
        { name:'מנואל נויר',          pos:'שוער',  age:39, club:'בייארן מינכן',         emoji:'🧤', caps:124, goals:0,  star:false },
        { name:'מרק-אנדרה טר שטגן',  pos:'שוער',  age:32, club:'ברצלונה',              emoji:'🧤', caps:40,  goals:0,  star:false },
        { name:'אנטוניו רודיגר',      pos:'הגנה',  age:31, club:'ריאל מדריד',           emoji:'🛡️', caps:80,  goals:5,  star:true  },
        { name:'ניקלס זולה',          pos:'הגנה',  age:28, club:'בייארן מינכן',         emoji:'🛡️', caps:35,  goals:2,  star:false },
        { name:'דוד ראום',            pos:'הגנה',  age:26, club:'ריאל מדריד',           emoji:'🛡️', caps:28,  goals:4,  star:false },
        { name:'ג\'ושואה קימיך',      pos:'הגנה',  age:29, club:'בייארן מינכן',         emoji:'⚙️', caps:90,  goals:8,  star:true  },
        { name:'רוברט אנדריך',        pos:'קישור', age:30, club:'בייר לברקוזן',         emoji:'⚙️', caps:28,  goals:2,  star:false },
        { name:'טוניאס גויסלה',       pos:'קישור', age:28, club:'בייר לברקוזן',         emoji:'⚙️', caps:25,  goals:2,  star:false },
        { name:'ג\'מאל מוסיאלה',      pos:'קישור', age:22, club:'בייארן מינכן',         emoji:'✨', caps:35,  goals:12, star:true  },
        { name:'פלוריאן וירץ',        pos:'קישור', age:22, club:'בייר לברקוזן',         emoji:'🌟', caps:35,  goals:18, star:true  },
        { name:'אילקאי גונדואן',      pos:'קישור', age:33, club:'מאנצ\'סטר סיטי',       emoji:'⚙️', caps:82,  goals:19, star:false },
        { name:'קאי האוורץ',          pos:'קדימה', age:26, club:'ארסנל',               emoji:'🎯', caps:50,  goals:24, star:true  },
        { name:'ניקלס פולקרוג',       pos:'קדימה', age:31, club:'ארסנל',               emoji:'💪', caps:20,  goals:10, star:false },
        { name:'לרוי סאנה',           pos:'קדימה', age:28, club:'בייארן מינכן',         emoji:'⚡', caps:65,  goals:18, star:false },
        { name:'ג\'פרי גנאבו',        pos:'קדימה', age:19, club:'VfB שטוטגרט',         emoji:'⚡', caps:6,   goals:2,  star:false },
        { name:'טימו ורנר',           pos:'קדימה', age:28, club:'טוטנהאם',              emoji:'🏃', caps:60,  goals:24, star:false },
      ]
    },

    // ─────────────── אנגליה ───────────────
    'אנגליה': {
      flag:'🏴󠁧󠁢󠁥󠁮󠁧󠁿', color:'#003090', secondColor:'#FFFFFF',
      titles:1, group:'H', strength:88,
      starPlayer:'ג\'ודה בלינגהם', coach:'גארת\' סאות\'גייט',
      formation:'4-3-3',
      funFact:'זכו ב-1966 — 60 שנה של ציפייה! 2026 על אדמת אמריקה, האם זה הפעם?',
      squad: [
        { name:'ג\'ורדן פיקפורד',     pos:'שוער',  age:32, club:'אברטון',               emoji:'🧤', caps:60,  goals:0,  star:false },
        { name:'דיין הנדרסון',        pos:'שוער',  age:27, club:'נוטינגהאם פורסט',      emoji:'🧤', caps:5,   goals:0,  star:false },
        { name:'קייל ווקר',           pos:'הגנה',  age:34, club:'בייארן מינכן',         emoji:'🛡️', caps:80,  goals:1,  star:false },
        { name:'ג\'ון סטונס',         pos:'הגנה',  age:31, club:'מאנצ\'סטר סיטי',       emoji:'🛡️', caps:70,  goals:5,  star:false },
        { name:'הארי מגוויר',         pos:'הגנה',  age:31, club:'מאנצ\'סטר יונייטד',    emoji:'🛡️', caps:65,  goals:8,  star:false },
        { name:'לוק שו',              pos:'הגנה',  age:28, club:'מאנצ\'סטר יונייטד',    emoji:'🛡️', caps:30,  goals:1,  star:false },
        { name:'טרנט אלכסנדר-ארנולד', pos:'הגנה',  age:27, club:'ריאל מדריד',           emoji:'🛡️', caps:35,  goals:4,  star:true  },
        { name:'ג\'ודה בלינגהם',       pos:'קישור', age:22, club:'ריאל מדריד',           emoji:'⭐', caps:38,  goals:15, star:true  },
        { name:'דקלן רייס',           pos:'קישור', age:26, club:'ארסנל',               emoji:'💪', caps:50,  goals:4,  star:true  },
        { name:'קוביי מיינו',         pos:'קישור', age:19, club:'צ\'לסי',               emoji:'✨', caps:12,  goals:2,  star:false },
        { name:'פיל פודן',            pos:'קישור', age:26, club:'מאנצ\'סטר סיטי',       emoji:'🎭', caps:42,  goals:9,  star:true  },
        { name:'הארי קיין',           pos:'קדימה', age:32, club:'בייארן מינכן',         emoji:'🎯', caps:100, goals:68, star:true  },
        { name:'בוקאיו סאקה',         pos:'קדימה', age:23, club:'ארסנל',               emoji:'⚡', caps:42,  goals:24, star:true  },
        { name:'מרקוס ראשפורד',       pos:'קדימה', age:28, club:'מאנצ\'סטר יונייטד',    emoji:'⚡', caps:60,  goals:18, star:false },
        { name:'ג\'ארד בוון',          pos:'קדימה', age:28, club:'ווסטהאם',              emoji:'⚡', caps:15,  goals:4,  star:false },
        { name:'קולה פאלמר',          pos:'קדימה', age:22, club:'צ\'לסי',               emoji:'🌟', caps:18,  goals:8,  star:false },
        { name:'אנתוני גורדון',       pos:'קדימה', age:23, club:'ניוקאסל',              emoji:'⚡', caps:12,  goals:3,  star:false },
      ]
    },

    // ─────────────── פורטוגל ───────────────
    'פורטוגל': {
      flag:'🇵🇹', color:'#006600', secondColor:'#FF0000',
      titles:0, group:'F', strength:85,
      starPlayer:'ברונו פרננדש', coach:'רוברטו מרטינז',
      formation:'4-3-3',
      funFact:'אחרי עידן רונאלדו — דור חדש עם פדרו נטו, ויטינייה ורפאל לאו מוביל קדימה.',
      squad: [
        { name:'דיאוגו קוסטה',        pos:'שוער',  age:25, club:'פורטו',               emoji:'🧤', caps:22,  goals:0,  star:false },
        { name:'רואי פטריסיו',        pos:'שוער',  age:36, club:'רומא',                emoji:'🧤', caps:100, goals:0,  star:false },
        { name:'רובן נבש',            pos:'הגנה',  age:28, club:'ברצלונה',              emoji:'🛡️', caps:30,  goals:2,  star:false },
        { name:'נוניס מנדש',          pos:'הגנה',  age:22, club:'פריז סן-ז\'רמן',       emoji:'🛡️', caps:30,  goals:3,  star:true  },
        { name:'פדרו פיקינהה',        pos:'הגנה',  age:24, club:'ספורטינג',             emoji:'🛡️', caps:22,  goals:1,  star:false },
        { name:'גונסאלו אינאסיו',     pos:'הגנה',  age:23, club:'ספורטינג',             emoji:'🛡️', caps:20,  goals:1,  star:false },
        { name:'ברונו פרננדש',        pos:'קישור', age:30, club:'מאנצ\'סטר יונייטד',    emoji:'⭐', caps:72,  goals:35, star:true  },
        { name:'ויטינייה',            pos:'קישור', age:24, club:'מאנצ\'סטר סיטי',       emoji:'⚙️', caps:22,  goals:4,  star:true  },
        { name:'ג\'ואאו פאליניה',      pos:'קישור', age:25, club:'ברצלונה',              emoji:'💪', caps:38,  goals:2,  star:false },
        { name:'ג\'ואאו נבש',          pos:'קישור', age:21, club:'ספורטינג',             emoji:'⚙️', caps:14,  goals:2,  star:false },
        { name:'רפאל לאו',            pos:'קדימה', age:25, club:'מילאן',               emoji:'⚡', caps:38,  goals:22, star:true  },
        { name:'ברנארדו סילוה',       pos:'קדימה', age:30, club:'מאנצ\'סטר סיטי',       emoji:'🎭', caps:90,  goals:20, star:true  },
        { name:'גונסאלו ראמוס',       pos:'קדימה', age:23, club:'פריז סן-ז\'רמן',       emoji:'🎯', caps:22,  goals:12, star:false },
        { name:'פדרו נטו',            pos:'קדימה', age:24, club:'צ\'לסי',               emoji:'⚡', caps:28,  goals:8,  star:false },
        { name:'ג\'ואאו פליקס',        pos:'קדימה', age:24, club:'צ\'לסי',               emoji:'🎨', caps:45,  goals:12, star:false },
      ]
    },

    // ─────────────── הולנד ───────────────
    'הולנד': {
      flag:'🇳🇱', color:'#FF6600', secondColor:'#FFFFFF',
      titles:0, group:'H', strength:86,
      starPlayer:'ויד גקפו', coach:'רונלד קומן',
      formation:'4-3-3',
      funFact:'הולנד — 3 גמרות ו-0 תארים. הנבחרת המצליחה ביותר בלי כוס!',
      squad: [
        { name:'ברט פרברוגן',         pos:'שוער',  age:26, club:'מאנצ\'סטר סיטי',       emoji:'🧤', caps:30,  goals:0,  star:true  },
        { name:'מארק פלקנבורג',       pos:'שוער',  age:31, club:'PSV',                 emoji:'🧤', caps:12,  goals:0,  star:false },
        { name:'ויד גקפו',            pos:'קדימה', age:25, club:'ליברפול',              emoji:'⭐', caps:40,  goals:22, star:true  },
        { name:'וירג\'יל ואן דייק',   pos:'הגנה',  age:33, club:'ליברפול',              emoji:'🛡️', caps:72,  goals:15, star:true  },
        { name:'דנזל דומפריס',        pos:'הגנה',  age:28, club:'אינטר',               emoji:'🛡️', caps:50,  goals:5,  star:false },
        { name:'נ\'אן דה לייגט',      pos:'הגנה',  age:28, club:'מאנצ\'סטר יונייטד',    emoji:'🛡️', caps:40,  goals:3,  star:false },
        { name:'מתייס דה לייגט',      pos:'הגנה',  age:25, club:'מאנצ\'סטר יונייטד',    emoji:'🛡️', caps:50,  goals:5,  star:false },
        { name:'ג\'אנרי אנגד',         pos:'הגנה',  age:22, club:'ברצלונה',              emoji:'🛡️', caps:10,  goals:0,  star:false },
        { name:'ח\'אווי סימונס',       pos:'קישור', age:22, club:'ריאל מדריד',           emoji:'✨', caps:28,  goals:10, star:true  },
        { name:'טיג\'אני ריינדרס',     pos:'קישור', age:26, club:'בייארן מינכן',         emoji:'⚙️', caps:30,  goals:6,  star:false },
        { name:'ריאן גרוונברג',       pos:'קישור', age:26, club:'אייאקס',               emoji:'⚙️', caps:20,  goals:3,  star:false },
        { name:'סטיבן ברגוויין',      pos:'קדימה', age:26, club:'PSV',                 emoji:'⚡', caps:30,  goals:8,  star:false },
        { name:'בריאן ברובביי',       pos:'קדימה', age:22, club:'אינטר',               emoji:'⚡', caps:18,  goals:6,  star:false },
        { name:'דוניאל מאלן',         pos:'קדימה', age:26, club:'בורוסיה דורטמונד',     emoji:'⚡', caps:28,  goals:8,  star:false },
        { name:'מאון קופמינרס',       pos:'קישור', age:22, club:'PSV',                 emoji:'⚙️', caps:12,  goals:2,  star:false },
      ]
    },

    // ─────────────── מקסיקו ───────────────
    'מקסיקו': {
      flag:'🇲🇽', color:'#006847', secondColor:'#FFFFFF',
      titles:0, group:'B', strength:78,
      starPlayer:'הירווינג לוזאנו', coach:'חאבייר אגיירה',
      formation:'4-3-3',
      funFact:'מארחת 2026! האצטקה — הקהל הלוהט בעולם. "El Tri" מנסה לעבור לראשונה את שמינית הגמר.',
      squad: [
        { name:'גיוטרמו אוצ\'ואה',    pos:'שוער',  age:39, club:'אמריקה',              emoji:'🧤', caps:140, goals:0,  star:false },
        { name:'לואיס מאלהייגן',      pos:'שוער',  age:26, club:'אמריקה',              emoji:'🧤', caps:8,   goals:0,  star:false },
        { name:'הקטור מורנו',         pos:'הגנה',  age:36, club:'מונטריי',             emoji:'🛡️', caps:110, goals:4,  star:false },
        { name:'חורחה סנצ\'ז',        pos:'הגנה',  age:29, club:'ברצלונה',              emoji:'🛡️', caps:40,  goals:1,  star:false },
        { name:'קסאר מונטס',          pos:'הגנה',  age:27, club:'גנק',                 emoji:'🛡️', caps:38,  goals:2,  star:false },
        { name:'חוסה חואן מקיאס',     pos:'הגנה',  age:23, club:'גטאפה',               emoji:'🛡️', caps:18,  goals:1,  star:false },
        { name:'אדסון אלוארז',        pos:'קישור', age:26, club:'ווסטהאם',             emoji:'💪', caps:50,  goals:4,  star:true  },
        { name:'אנדרס גוארדאדו',      pos:'קישור', age:38, club:'בטיס',               emoji:'⚙️', caps:180, goals:28, star:false },
        { name:'אורבלין פינאדה',      pos:'קישור', age:25, club:'קרוז אזול',           emoji:'⚙️', caps:35,  goals:6,  star:false },
        { name:'חוסה לוזאנו',         pos:'קדימה', age:23, club:'PSV',                 emoji:'⚡', caps:12,  goals:3,  star:false },
        { name:'הירווינג לוזאנו',     pos:'קדימה', age:29, club:'PSV',                 emoji:'⚡', caps:75,  goals:29, star:true  },
        { name:'אנטוניו מרטין',       pos:'קדימה', age:23, club:'אטלנטה',              emoji:'🎯', caps:22,  goals:8,  star:false },
        { name:'הנרי מרטין',          pos:'קדימה', age:31, club:'קלאב אמריקה',         emoji:'🎯', caps:32,  goals:16, star:false },
        { name:'גיוליאן אראאוחו',     pos:'קדימה', age:22, club:'גירונה',              emoji:'⚡', caps:15,  goals:4,  star:false },
      ]
    },

    // ─────────────── ארה"ב ───────────────
    'ארה"ב': {
      flag:'🇺🇸', color:'#002868', secondColor:'#BF0A30',
      titles:0, group:'B', strength:76,
      starPlayer:'כריסטיאן פוליסיץ\'', coach:'גרג ברהאלטר',
      formation:'4-3-3',
      funFact:'מארחת ראשית 2026 עם 11 מגרשים! MLS צומחת — כדורגל אמריקאי בדרך לעולם.',
      squad: [
        { name:'מאט טרנר',            pos:'שוער',  age:30, club:'נוטינגהאם פורסט',      emoji:'🧤', caps:38,  goals:0,  star:false },
        { name:'איטן נוסוורת\'ן',      pos:'שוער',  age:24, club:'בורוסיה דורטמונד',    emoji:'🧤', caps:8,   goals:0,  star:false },
        { name:'סרגיינו דסט',         pos:'הגנה',  age:24, club:'PSV',                 emoji:'🛡️', caps:38,  goals:2,  star:false },
        { name:'מייל בראונינג',        pos:'הגנה',  age:25, club:'מיישטה',              emoji:'🛡️', caps:12,  goals:0,  star:false },
        { name:'ווקר זימרמן',         pos:'הגנה',  age:31, club:'נאשוויל',             emoji:'🛡️', caps:35,  goals:2,  star:false },
        { name:'טים ריי',             pos:'הגנה',  age:26, club:'TSG הופנהיים',        emoji:'🛡️', caps:24,  goals:0,  star:false },
        { name:'אנטוניו קרלוס',       pos:'הגנה',  age:27, club:'אורלנדו',             emoji:'🛡️', caps:12,  goals:1,  star:false },
        { name:'ווסטון מקקני',        pos:'קישור', age:26, club:'יובנטוס',              emoji:'💪', caps:55,  goals:12, star:true  },
        { name:'יואנס מוסאח',         pos:'קישור', age:22, club:'ברצלונה',              emoji:'⚙️', caps:28,  goals:4,  star:true  },
        { name:'אילה מיקסה',          pos:'קישור', age:20, club:'צ\'לסי',               emoji:'✨', caps:14,  goals:2,  star:false },
        { name:'לנין',                pos:'קישור', age:22, club:'בורוסיה דורטמונד',     emoji:'⚙️', caps:10,  goals:1,  star:false },
        { name:'כריסטיאן פוליסיץ\'',   pos:'קדימה', age:27, club:'מילאן',               emoji:'⭐', caps:72,  goals:34, star:true  },
        { name:'טיממי וויא',          pos:'קדימה', age:25, club:'LA Galaxy',            emoji:'🎯', caps:28,  goals:8,  star:false },
        { name:'ג\'ושוע ספאלינג',      pos:'קדימה', age:22, club:'New York Red Bulls',  emoji:'⚡', caps:10,  goals:3,  star:false },
        { name:'ב\'ראנדון ווסבורן',    pos:'קדימה', age:23, club:'עדיין לא ידוע',        emoji:'⚡', caps:8,   goals:2,  star:false },
      ]
    },

    // ─── קבוצות נוספות ───
    'קנדה': {
    flag:'🇨🇦', color:'#FF0000', secondColor:'#FFFFFF', titles:0, group:'A', strength:72,
    starPlayer:'אלפונסו דיוויס', coach:'ג\'סי מארש', formation:'4-3-3',
    funFact:'קנדה התאפשרה לראשונה ל-WC 2022 אחרי 36 שנה. דיוויס — הכוכב הגדול.',
    squad:[
      {name:'מקסים קרפו',      pos:'שוער',  age:29, club:'Nottm Forest',   emoji:'🧤', caps:22, goals:0,  star:false},
      {name:'אלפונסו דיוויס',  pos:'הגנה',  age:24, club:'בייארן מינכן',   emoji:'⭐', caps:55, goals:12, star:true },
      {name:'מייל ג\'ונסטון',  pos:'הגנה',  age:22, club:'בורוסיה דורטמונד',emoji:'🛡️',caps:28, goals:2,  star:false},
      {name:'ארון בוקלי',      pos:'הגנה',  age:29, club:'ריאל בטיס',       emoji:'🛡️',caps:35, goals:3,  star:false},
      {name:'איסמאל קונה',     pos:'קישור', age:27, club:'פולהאם',          emoji:'⚙️', caps:40, goals:6,  star:false},
      {name:'אטיבה האצ\'ינסון',pos:'קישור', age:30, club:'קווינס פארק',     emoji:'💪', caps:50, goals:8,  star:false},
      {name:'ג\'ונתן דיוויד',  pos:'קדימה', age:24, club:'ליל',             emoji:'🔥', caps:42, goals:22, star:true },
      {name:'צ\'יני אגארד',    pos:'קדימה', age:22, club:'אינטר מיאמי',     emoji:'⚡', caps:25, goals:8,  star:false},
    ]
  },
  'קרואטיה': {
    flag:'🇭🇷', color:'#FF0000', secondColor:'#FFFFFF', titles:0, group:'C', strength:82,
    starPlayer:'לוקה מודריץ\'', coach:'זלטקו דאליץ\'', formation:'4-3-3',
    funFact:'קרואטיה — גמר 2018 ו-3 2022! מודריץ\' הוא הקפטן המנוסה ביותר בהיסטוריה.',
    squad:[
      {name:'דומיניק ליבקוביץ\'', pos:'שוער', age:29, club:'ריאל מדריד',    emoji:'🧤', caps:30, goals:0,  star:false},
      {name:'לוקה מודריץ\'',      pos:'קישור',age:41, club:'ריאל מדריד',    emoji:'⭐', caps:180,goals:24, star:true },
      {name:'מארסלו ברוזוביץ\'',  pos:'קישור',age:32, club:'אל קאדסייה',    emoji:'💪', caps:90, goals:8,  star:false},
      {name:'מאטאו קובאצ\'יץ\'',  pos:'קישור',age:30, club:'מאנצ\'סטר סיטי',emoji:'⚙️', caps:90, goals:10, star:true },
      {name:'איוון פריסיץ\'',     pos:'קדימה',age:36, club:'האיידוק ספליט', emoji:'⚡', caps:110,goals:34, star:false},
      {name:'ברונו פטקוביץ\'',    pos:'קדימה',age:26, club:'ג\'ירונה',       emoji:'🎯', caps:38, goals:14, star:false},
      {name:'אנדיי קרמאריץ\'',    pos:'קדימה',age:33, club:'TSG הופנהיים',  emoji:'🎯', caps:80, goals:32, star:false},
    ]
  },
  'קולומביה': {
    flag:'🇨🇴', color:'#FCD116', secondColor:'#003087', titles:0, group:'G', strength:78,
    starPlayer:'לואיס דיאז', coach:'נסטור לורנסו', formation:'4-2-3-1',
    funFact:'קולומביה — הפתעת קופה אמריקה 2024! דיאז ופלקאו — הגרסה החדשה.',
    squad:[
      {name:'קמילו וארגס',     pos:'שוער',  age:36, club:'אטלנטה',          emoji:'🧤', caps:80, goals:0,  star:false},
      {name:'דניאל מוניוס',    pos:'הגנה',  age:27, club:'בנפיקה',          emoji:'🛡️', caps:28, goals:2,  star:false},
      {name:'ירי מינה',        pos:'הגנה',  age:30, club:'פיורנטינה',       emoji:'🛡️', caps:60, goals:10, star:false},
      {name:'ריצ\'ארד ריוס',   pos:'קישור', age:33, club:'בוקה חוניורס',   emoji:'⚙️', caps:75, goals:14, star:false},
      {name:'לואיס דיאז',      pos:'קדימה', age:27, club:'ליברפול',         emoji:'⭐', caps:55, goals:22, star:true },
      {name:'רדריגו בצנה',     pos:'קדימה', age:25, club:'ברצלונה',         emoji:'⚡', caps:35, goals:12, star:false},
      {name:'פלקאו',            pos:'קדימה', age:39, club:'ראי ויאריאל',    emoji:'🏆', caps:109,goals:36, star:false},
    ]
  },
  'בלגיה': {
    flag:'🇧🇪', color:'#000000', secondColor:'#FF0000', titles:0, group:'D', strength:80,
    starPlayer:'קווין דה ברוינה', coach:'רוי מקאי', formation:'4-3-3',
    funFact:'דור הזהב של בלגיה — דה ברוינה, לוקאקו. גמר 2018 ו-3 2022 מעודד.',
    squad:[
      {name:'קווין דה ברוינה',  pos:'קישור',age:33, club:'מאנצ\'סטר סיטי',emoji:'⭐', caps:110,goals:28, star:true },
      {name:'רומלו לוקאקו',     pos:'קדימה',age:31, club:'ניאפולי',         emoji:'💪', caps:110,goals:78, star:true },
      {name:'יאניק קארסקו',     pos:'קדימה',age:31, club:'ג\'ינגצ\'אן',     emoji:'⚡', caps:70, goals:17, star:false},
      {name:'אקסל וויסל',       pos:'קישור',age:32, club:'מרסיי',           emoji:'⚙️', caps:95, goals:12, star:false},
      {name:'ג\'אסון דנסו',     pos:'הגנה', age:27, club:'ניוקאסל',         emoji:'🛡️', caps:35, goals:1,  star:false},
      {name:'ויוט ינגס',        pos:'שוער', age:32, club:'PSG',             emoji:'🧤', caps:35, goals:0,  star:false},
    ]
  },
  'יפן': {
    flag:'🇯🇵', color:'#BC002D', secondColor:'#FFFFFF', titles:0, group:'E', strength:76,
    starPlayer:'טקפוסה קובאיאשי', coach:'הג\'ימה מוריאסו', formation:'4-3-3',
    funFact:'יפן — הפתעת מונדיאל 2022! ניצחו ספרד וגרמניה ועלו לנוקאאוט.',
    squad:[
      {name:'שוייצ\'י גונדה',    pos:'שוער',  age:31, club:'PSV',            emoji:'🧤', caps:50, goals:0,  star:false},
      {name:'ווטארו אנדו',       pos:'קישור', age:31, club:'ליברפול',        emoji:'💪', caps:65, goals:5,  star:true },
      {name:'פוסה מורי',         pos:'קישור', age:24, club:'דורטמונד',       emoji:'⚙️', caps:28, goals:3,  star:false},
      {name:'טקפוסה קובאיאשי',   pos:'קדימה', age:26, club:'שטוטגרט',        emoji:'⭐', caps:40, goals:18, star:true },
      {name:'קאורו מיטומה',      pos:'קדימה', age:27, club:'ברייטון',        emoji:'⚡', caps:38, goals:12, star:false},
      {name:'אאו טאנאקה',        pos:'קישור', age:26, club:'דורטמונד',       emoji:'⚙️', caps:35, goals:6,  star:false},
    ]
  },
  'טורקיה': {
    flag:'🇹🇷', color:'#E30A17', secondColor:'#FFFFFF', titles:0, group:'F', strength:74,
    starPlayer:'הקאן צ\'אלחאנוגלו', coach:'וינצ\'נצו מונטלה', formation:'4-1-4-1',
    funFact:'טורקיה סיימה 3 ב-2002 — ימי זהב. צ\'אלחאנוגלו מוביל דור חדש מבטיח.',
    squad:[
      {name:'אלטאי ביאינדיר',       pos:'שוער',  age:25, club:'מאנצ\'סטר יונייטד',emoji:'🧤',caps:20,goals:0, star:false},
      {name:'הקאן צ\'אלחאנוגלו',    pos:'קישור', age:30, club:'אינטר',            emoji:'⭐',caps:75,goals:18,star:true },
      {name:'ארדה גולר',            pos:'קישור', age:20, club:'ריאל מדריד',        emoji:'🌟',caps:20,goals:6, star:true },
      {name:'קנאן יילדיז',          pos:'קדימה', age:19, club:'יובנטוס',           emoji:'✨',caps:12,goals:3, star:false},
      {name:'בוראק יילמאז',         pos:'קדימה', age:39, club:'אדנה ספור',         emoji:'🎯',caps:90,goals:31,star:false},
      {name:'מרט מולדור',           pos:'הגנה',  age:26, club:'לאציו',             emoji:'🛡️',caps:28,goals:2, star:false},
    ]
  },
  "צ'ילה": {
    flag:'🇨🇱', color:'#D52B1E', secondColor:'#FFFFFF', titles:0, group:'A', strength:70,
    starPlayer:'אלכסיס סאנצ\'ז', coach:'ריקארדו גארציה', formation:'4-3-3',
    funFact:'צ\'ילה — אלופת קופה אמריקה 2015 ו-2016! הדור של ויידאל וסאנצ\'ז.',
    squad:[
      {name:'קלאודיו בראבו',    pos:'שוער',  age:41, club:'פרטיר', emoji:'🧤', caps:150,goals:0,  star:false},
      {name:'אלכסיס סאנצ\'ז',  pos:'קדימה', age:36, club:'אונ\' דה צ\'ילה',emoji:'⭐',caps:160,goals:50,star:true },
      {name:'ארטורו ויידאל',    pos:'קישור', age:37, club:'קולו קולו',emoji:'💪',caps:150,goals:25,star:false},
      {name:'צ\'ארלס אראנגיז',  pos:'קישור', age:35, club:'אינטר מיאמי',emoji:'⚙️',caps:90,goals:8,  star:false},
      {name:'בן בררה',           pos:'קדימה', age:25, club:'בטיס',   emoji:'⚡', caps:25, goals:8,  star:false},
    ]
  },

  'דרום אפריקה': {
    flag:'🇿🇦', color:'#007A4D', secondColor:'#FFB81C', titles:0, group:'B', strength:62,
    starPlayer:'פרסי טאו', coach:'הוגו ברוס', formation:'4-4-2',
    funFact:'דרום אפריקה הייתה המדינה הראשונה באפריקה לארח את המונדיאל — ב-2010!',
    squad:[
      {name:'רונווין וויליאמס', pos:'שוער',  age:30, club:'מדסאן סיטי',     emoji:'🧤', caps:45,goals:0,  star:false},
      {name:'פרסי טאו',         pos:'קדימה', age:30, club:'אל-אהלי',        emoji:'⭐', caps:65,goals:18, star:true },
      {name:'תבו קישן',         pos:'קדימה', age:28, club:'שחפורד',         emoji:'⚡', caps:40,goals:12, star:false},
      {name:'מוטהאלה מוסיאלגנג', pos:'קישור', age:26, club:'מיילנדרס',     emoji:'⚙️', caps:30,goals:3,  star:false},
      {name:'גרנט קקאנה',       pos:'הגנה',  age:32, club:'נורת\' קסאונטי', emoji:'🛡️', caps:55,goals:2,  star:false},
    ]
  },
  'מרוקו': {
    flag:'🇲🇦', color:'#C1272D', secondColor:'#006233', titles:0, group:'D', strength:78,
    starPlayer:'אשרף חכימי', coach:'ואליד רגרגי', formation:'4-3-3',
    funFact:'מרוקו הגיעה לחצי גמר מונדיאל 2022 — הישג היסטורי לאפריקה!',
    squad:[
      {name:'יאסין בונו',       pos:'שוער',  age:33, club:'אל-הילאל',   emoji:'🧤', caps:60,goals:0,  star:false},
      {name:'אשרף חכימי',       pos:'הגנה',  age:26, club:'פריז סן-ז\'רמן',emoji:'⭐',caps:75,goals:15, star:true },
      {name:'הכים זיאש',        pos:'קישור', age:32, club:'גלאטסריי',    emoji:'🎨', caps:70,goals:20, star:false},
      {name:'סופיאן אמרבאט',    pos:'קישור', age:28, club:'מנצ\'סטר יונייטד',emoji:'💪',caps:45,goals:1,star:false},
      {name:'יוסף אן-נסירי',    pos:'קדימה', age:27, club:'ריאל בטיס',   emoji:'⚡', caps:55,goals:24, star:false},
    ]
  },
  'סרביה': {
    flag:'🇷🇸', color:'#C6363C', secondColor:'#0C4076', titles:0, group:'H', strength:72,
    starPlayer:'דושאן ולאהוביץ', coach:'דרגאן סטויקוביץ', formation:'3-4-3',
    funFact:'סרביה הכניסה את הכי הרבה שחקנים מליגת הפרמייר ליג לקבוצה אחת!',
    squad:[
      {name:'ורדן מילינקוביץ-סביץ', pos:'שוער', age:27, club:'ריאל ולדוליד',emoji:'🧤',caps:40,goals:0,star:false},
      {name:'דושאן ולאהוביץ',       pos:'קדימה',age:24, club:'יובנטוס',    emoji:'⭐', caps:45,goals:30, star:true },
      {name:'סרגיי מילינקוביץ-סביץ',pos:'קישור',age:29, club:'אל-הילאל',   emoji:'💪', caps:65,goals:12, star:false},
      {name:'פיליפ קוסטיץ',         pos:'קישור',age:31, club:'יובנטוס',    emoji:'⚙️', caps:60,goals:8,  star:false},
      {name:'ניקולה מילנקוביץ',     pos:'הגנה', age:27, club:'פיורנטינה',  emoji:'🛡️', caps:45,goals:3,  star:false},
    ]
  },

  }, // סגירת teams

  // ⚠️ אלה נתוני גיבוי בלבד — האפליקציה מושכת את הלוח המלא מה-API באופן אוטומטי
  matches: [
    { id:'m1',  date:'2026-06-11', time:'22:00', home:'מקסיקו',      away:'דרום אפריקה', group:'B', venue:'מקסיקו סיטי',  homeScore:null, awayScore:null },
    { id:'m2',  date:'2026-06-12', time:'21:00', home:'ארה"ב',        away:'קנדה',        group:'A', venue:'לוס אנג\'לס',  homeScore:null, awayScore:null },
    { id:'m3',  date:'2026-06-12', time:'18:00', home:'ארגנטינה',    away:'קנדה',        group:'C', venue:'מיאמי',        homeScore:null, awayScore:null },
    { id:'m4',  date:'2026-06-13', time:'21:00', home:'ספרד',        away:'מרוקו',       group:'D', venue:'ניו יורק',     homeScore:null, awayScore:null },
    { id:'m5',  date:'2026-06-13', time:'18:00', home:'צרפת',        away:'קנדה',        group:'E', venue:'טורונטו',      homeScore:null, awayScore:null },
    { id:'m6',  date:'2026-06-14', time:'21:00', home:'גרמניה',      away:'יפן',         group:'F', venue:'שיקגו',        homeScore:null, awayScore:null },
    { id:'m7',  date:'2026-06-14', time:'18:00', home:'ברזיל',       away:'קנדה',        group:'G', venue:'ונקובר',       homeScore:null, awayScore:null },
    { id:'m8',  date:'2026-06-15', time:'21:00', home:'אנגליה',      away:'סרביה',       group:'H', venue:'בוסטון',       homeScore:null, awayScore:null },
    { id:'m9',  date:'2026-06-15', time:'18:00', home:'פורטוגל',     away:'קרואטיה',    group:'I', venue:'פילדלפיה',     homeScore:null, awayScore:null },
    { id:'m10', date:'2026-06-16', time:'21:00', home:'הולנד',       away:'קנדה',        group:'J', venue:'הוסטון',       homeScore:null, awayScore:null },
  ],

  trivia: [
    { q:'כמה פעמים ברזיל זכתה במונדיאל?',                                     options:['3','4','5','6'],                                           answer:2 },
    { q:'מי הכדורגלן עם הכי הרבה גולים בהיסטוריית המונדיאל?',                 options:['מסי','רונאלדו','מירוסלב קלוזה','פלה'],                     answer:2 },
    { q:'כמה קבוצות משתתפות במונדיאל 2026?',                                  options:['32','36','48','64'],                                        answer:2 },
    { q:'איזו מדינה מארחת את המונדיאל 2026?',                                 options:['ברזיל','ארה"ב בלבד','ארה"ב, קנדה ומקסיקו','ספרד ופורטוגל'], answer:2 },
    { q:'מי זכה במונדיאל האחרון (2022)?',                                     options:['צרפת','ברזיל','ארגנטינה','גרמניה'],                         answer:2 },
    { q:'מה שם הגביע שמוענק לזוכה המונדיאל?',                                 options:['גביע ריול','גביע פיפ"א','גביע אלדורדו','גביע יולס רימה'],   answer:1 },
    { q:'לאמין יאמל מספרד — מאיזו מדינה הוא במוצאו?',                        options:['מרוקו','גיניאה המשוונית','קמרון','סנגל'],                    answer:1 },
    { q:'כמה קבוצות עולות מכל בית לנוקאאוט במונדיאל 2026?',                  options:['1','2','3','4'],                                            answer:1 },
    { q:'הנבחרת של איזו מדינה כונתה "הסמבה" בגלל סגנון המשחק?',               options:['ארגנטינה','ספרד','ברזיל','קולומביה'],                        answer:2 },
    { q:'מי המאמן של ספרד ב-2026?',                                           options:['לואיס אנריקה','לואיס דה לה פואנטה','אנסלוטי','פגיולי'],     answer:1 },
    { q:'כמה גולים קיליאן מבאפה כבר עשה לנבחרת צרפת?',                       options:['30','38','47','55'],                                         answer:2 },
    { q:'באיזה מגרש יתקיים גמר מונדיאל 2026?',                                options:['לוס אנג\'לס','מיאמי','ניו יורק/ניו ג\'רזי','דאלאס'],         answer:2 },
  ]
};
