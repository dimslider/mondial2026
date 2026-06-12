// =====================================================
//  football-data.org — free tier
//  הרשם בחינם: https://www.football-data.org/client/register
// =====================================================

const FD_API_KEY = window.FD_API_KEY || '';
const FD_BASE    = 'https://api.football-data.org/v4';
window.TEAM_CRESTS  = window.TEAM_CRESTS  || {};  // דגלים רשמיים מה-API לכל קבוצה
window.TEAM_API_IDS = window.TEAM_API_IDS || {};  // מזהי קבוצות ב-API לשליפת סגלים

// ===== ENGLISH → HEBREW TEAM NAME MAP =====
const ENG_TO_HEB = {
  'Argentina':'ארגנטינה','Brazil':'ברזיל','Spain':'ספרד','France':'צרפת',
  'Germany':'גרמניה','England':'אנגליה','Portugal':'פורטוגל','Netherlands':'הולנד',
  'Mexico':'מקסיקו','United States':'ארה"ב','USA':'ארה"ב','Japan':'יפן',
  'Croatia':'קרואטיה','Morocco':'מרוקו','Belgium':'בלגיה','Australia':'אוסטרליה',
  'Turkey':'טורקיה','Türkiye':'טורקיה','Colombia':'קולומביה','Canada':'קנדה',
  'Ecuador':'אקוודור','Uruguay':'אורוגוואי','Chile':"צ'ילה",'Peru':'פרו',
  'Paraguay':'פרגוואי','Venezuela':'ונצואלה','Bolivia':'בוליביה',
  'South Africa':'דרום אפריקה','Nigeria':'ניגריה','Senegal':'סנגל',
  'Cameroon':'קמרון','Ghana':'גאנה','Tunisia':'תוניסיה','Mali':'מאלי',
  'Ivory Coast':"חוף השנהב",'DR Congo':'קונגו','Egypt':'מצרים',
  'Saudi Arabia':'ערב הסעודית','Iran':'איראן','South Korea':'דרום קוריאה',
  'Australia':'אוסטרליה','New Zealand':'ניו זילנד','Qatar':'קטאר',
  'Serbia':'סרביה','Switzerland':'שוויץ','Denmark':'דנמרק','Poland':'פולין',
  'Ukraine':'אוקראינה','Austria':'אוסטריה','Scotland':'סקוטלנד',
  'Albania':'אלבניה','Slovenia':'סלובניה','Hungary':'הונגריה',
  'Romania':'רומניה','Slovakia':'סלובקיה','Czech Republic':'צ\'כיה',
  'Panama':'פנמה','Costa Rica':'קוסטה ריקה','Honduras':'הונדורס',
  'El Salvador':'אל סלבדור','Jamaica':'ג\'מייקה','Haiti':'האיטי',
  'Czechia':'צ\'כיה','Korea Republic':'דרום קוריאה',
  'Bosnia-Herzegovina':'בוסניה','Bosnia and Herzegovina':'בוסניה',
  'Norway':'נורבגיה','Sweden':'שוודיה','Italy':'איטליה','Greece':'יוון',
  'Wales':'ויילס','Northern Ireland':'צפון אירלנד','Ireland':'אירלנד',
  'Uzbekistan':'אוזבקיסטן','Jordan':'ירדן','Iraq':'עיראק',
  'United Arab Emirates':'איחוד האמירויות','China':'סין','India':'הודו',
  'Cabo Verde':'כף ורדה','Cape Verde':'כף ורדה','Cape Verde Islands':'כף ורדה',
  'Curacao':'קוראסאו','Curaçao':'קוראסאו','Congo DR':'קונגו',
  'Algeria':'אלג\'יריה','Benin':'בנין','Burkina Faso':'בורקינה פאסו',
  'Gabon':'גבון','Guinea':'גינאה','Libya':'לוב','Madagascar':'מדגסקר',
  'Mozambique':'מוזמביק','Namibia':'נמיביה','Niger':'ניז\'ר',
  'Rwanda':'רואנדה','Sudan':'סודן','Tanzania':'טנזניה','Togo':'טוגו',
  'Uganda':'אוגנדה','Zambia':'זמביה','Zimbabwe':'זימבבואה','Kenya':'קניה',
  'Angola':'אנגולה','Botswana':'בוטסואנה','Gambia':'גמביה',
  'Guatemala':'גואטמלה','Trinidad and Tobago':'טרינידד וטובגו','Suriname':'סורינאם',
  'Cuba':'קובה','Nicaragua':'ניקרגואה','Bermuda':'ברמודה',
  'New Caledonia':'קלדוניה החדשה','Fiji':'פיג\'י','Tahiti':'טהיטי',
  'Bahrain':'בחריין','Kuwait':'כווית','Oman':'עומאן','Lebanon':'לבנון',
  'Syria':'סוריה','Palestine':'פלסטין','Thailand':'תאילנד','Vietnam':'וייטנאם',
  'Indonesia':'אינדונזיה','Malaysia':'מלזיה','North Korea':'צפון קוריאה',
  'Finland':'פינלנד','Iceland':'איסלנד','North Macedonia':'מקדוניה',
  'Montenegro':'מונטנגרו','Moldova':'מולדובה','Belarus':'בלארוס',
  'Bulgaria':'בולגריה','Cyprus':'קפריסין','Israel':'ישראל',
  'Estonia':'אסטוניה','Latvia':'לטביה','Lithuania':'ליטא',
  'Luxembourg':'לוקסמבורג','Kosovo':'קוסובו','Georgia':'גיאורגיה',
  'Armenia':'ארמניה','Azerbaijan':'אזרבייג\'ן','Kazakhstan':'קזחסטן',
};

// FIFA 3-letter codes → ISO 2-letter codes (for flagcdn.com)
const TLA_TO_ISO = {
  ARG:'ar',BRA:'br',ESP:'es',FRA:'fr',GER:'de',ENG:'gb-eng',POR:'pt',NED:'nl',
  MEX:'mx',USA:'us',CAN:'ca',JPN:'jp',CRO:'hr',MAR:'ma',BEL:'be',AUS:'au',
  TUR:'tr',COL:'co',ECU:'ec',URU:'uy',CHI:'cl',PER:'pe',PAR:'py',VEN:'ve',
  BOL:'bo',RSA:'za',NGA:'ng',SEN:'sn',CMR:'cm',GHA:'gh',TUN:'tn',MLI:'ml',
  CIV:'ci',COD:'cd',EGY:'eg',ALG:'dz',KSA:'sa',IRN:'ir',KOR:'kr',PRK:'kp',
  NZL:'nz',QAT:'qa',SRB:'rs',SUI:'ch',DEN:'dk',POL:'pl',UKR:'ua',AUT:'at',
  SCO:'gb-sct',WAL:'gb-wls',NIR:'gb-nir',IRL:'ie',ALB:'al',SVN:'si',HUN:'hu',
  ROU:'ro',SVK:'sk',CZE:'cz',PAN:'pa',CRC:'cr',HON:'hn',SLV:'sv',JAM:'jm',
  HAI:'ht',BIH:'ba',BOS:'ba',NOR:'no',SWE:'se',ITA:'it',GRE:'gr',FIN:'fi',
  ISL:'is',MKD:'mk',MNE:'me',MDA:'md',BLR:'by',BUL:'bg',CYP:'cy',ISR:'il',
  EST:'ee',LVA:'lv',LTU:'lt',LUX:'lu',KOS:'xk',GEO:'ge',ARM:'am',AZE:'az',
  KAZ:'kz',UZB:'uz',JOR:'jo',IRQ:'iq',UAE:'ae',CHN:'cn',IND:'in',CPV:'cv',
  CUW:'cw',BEN:'bj',BFA:'bf',GAB:'ga',GUI:'gn',LBY:'ly',MAD:'mg',MOZ:'mz',
  NAM:'na',NIG:'ne',RWA:'rw',SDN:'sd',TAN:'tz',TOG:'tg',UGA:'ug',ZAM:'zm',
  ZIM:'zw',KEN:'ke',ANG:'ao',BOT:'bw',GAM:'gm',GUA:'gt',TRI:'tt',SUR:'sr',
  CUB:'cu',NCA:'ni',BER:'bm',NCL:'nc',FIJ:'fj',TAH:'pf',BHR:'bh',KUW:'kw',
  OMA:'om',LBN:'lb',SYR:'sy',PLE:'ps',THA:'th',VIE:'vn',IDN:'id',MAS:'my',
};

// Extra FLAG_CODES additions for new teams
const EXTRA_FLAG_CODES = {
  'דרום אפריקה':'za','ניגריה':'ng','חוף השנהב':'ci','קונגו':'cd',
  'מצרים':'eg','ערב הסעודית':'sa','איראן':'ir','דרום קוריאה':'kr',
  'קטאר':'qa','סרביה':'rs','שוויץ':'ch','דנמרק':'dk','פולין':'pl',
  'אוקראינה':'ua','אוסטריה':'at','סקוטלנד':'gb-sct','פנמה':'pa',
  'קוסטה ריקה':'cr','הונדורס':'hn','ג\'מייקה':'jm','אקוודור':'ec',
  'אורוגוואי':'uy','פרגוואי':'py','פרו':'pe','ונצואלה':'ve','בוליביה':'bo',
};

// ===== FETCH HELPER =====
// football-data.org free tier only allows localhost — route through CORS proxy
const CORS_PROXY = 'https://corsproxy.io/?';

async function fdFetch(path) {
  if (!FD_API_KEY) return null;
  // שובר-מטמון: בלעדיו ה-proxy מחזיר תשובות ישנות והתוצאה החיה מפגרת
  const cb = (path.includes('?') ? '&' : '?') + '_cb=' + Date.now();
  const target = `${FD_BASE}${path}${cb}`;
  const isLocal = ['localhost','127.0.0.1'].includes(location.hostname);
  // localhost: direct works. GitHub Pages: only the proxy works — skip direct to avoid CORS errors
  const urls = isLocal ? [target, CORS_PROXY + encodeURIComponent(target)]
                       : [CORS_PROXY + encodeURIComponent(target)];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'X-Auth-Token': FD_API_KEY } });
      if (res.ok) return res.json();
      if (res.status === 429) { console.warn('Rate limit hit'); return null; }
    } catch(e) {
      if (url === target) continue; // CORS blocked — try proxy
      console.warn('FD fetch failed:', e.message);
    }
  }
  return null;
}

// ===== SYNC FULL MATCH SCHEDULE FROM API =====
async function syncMatchSchedule() {
  // football-data.org supports competition by code 'WC', season param optional
  let data = await fdFetch('/competitions/WC/matches?season=2026');
  if (!data?.matches?.length) data = await fdFetch('/competitions/WC/matches');
  if (!data?.matches?.length) data = await fdFetch('/competitions/2000/matches');
  if (!data?.matches?.length) {
    console.warn('⚠️ Could not load WC2026 schedule from API — keeping fallback data');
    return false;
  }

  const VENUE_MAP = {
    'SoFi Stadium':"לוס אנג'לס", 'Hard Rock Stadium':'מיאמי',
    'AT&T Stadium':'דאלאס','Lumen Field':'סיאטל',
    'MetLife Stadium':'ניו יורק','Soldier Field':'שיקגו',
    'Gillette Stadium':'בוסטון','Lincoln Financial Field':'פילדלפיה',
    'NRG Stadium':'הוסטון','Arrowhead Stadium':"קנזס סיטי",
    "Levi's Stadium":"סן פרנסיסקו",'BMO Field':'טורונטו',
    'BC Place':'ונקובר','Estadio Azteca':'מקסיקו סיטי',
    'Estadio Akron':'גוודלחרה','Estadio BBVA':'מונטריי',
  };

  // רק משחקים ששתי הקבוצות בהם ידועות (מדלג על נוקאאוט שטרם נקבע)
  const known = data.matches.filter(m => m.homeTeam?.name && m.awayTeam?.name);
  const newMatches = known.map((m, i) => {
    const homeEng = (m.homeTeam?.name || '').trim();
    const awayEng = (m.awayTeam?.name || '').trim();
    const homeHeb = ENG_TO_HEB[homeEng] || homeEng;
    const awayHeb = ENG_TO_HEB[awayEng] || awayEng;

    // Save official crest image from API — fallback flag for any team
    if (m.homeTeam?.crest) window.TEAM_CRESTS[homeHeb] = m.homeTeam.crest;
    if (m.awayTeam?.crest) window.TEAM_CRESTS[awayHeb] = m.awayTeam.crest;
    // Save API team IDs — used to fetch real squads on demand
    if (m.homeTeam?.id) window.TEAM_API_IDS[homeHeb] = m.homeTeam.id;
    if (m.awayTeam?.id) window.TEAM_API_IDS[awayHeb] = m.awayTeam.id;

    // Add unknown teams to FLAG_CODES — convert FIFA 3-letter code to ISO
    if (homeHeb && !FLAG_CODES[homeHeb] && !EXTRA_FLAG_CODES[homeHeb]) {
      const iso = TLA_TO_ISO[m.homeTeam?.tla];
      if (iso) EXTRA_FLAG_CODES[homeHeb] = iso;
    }
    if (awayHeb && !FLAG_CODES[awayHeb] && !EXTRA_FLAG_CODES[awayHeb]) {
      const iso = TLA_TO_ISO[m.awayTeam?.tla];
      if (iso) EXTRA_FLAG_CODES[awayHeb] = iso;
    }

    const dateStr  = m.utcDate ? m.utcDate.slice(0,10) : '';
    const timeStr  = m.utcDate ? toLocalTime(m.utcDate) : '';
    const venue    = VENUE_MAP[m.venue] || m.venue || '';
    const group    = m.group ? m.group.replace('GROUP_','') : '';
    const finished = m.status === 'FINISHED';

    return {
      id:        'm' + (i+1),
      apiId:     m.id,
      date:      dateStr,
      time:      timeStr,
      home:      homeHeb,
      away:      awayHeb,
      group:     group,
      venue:     venue,
      homeScore: finished ? (m.score?.fullTime?.home ?? null) : null,
      awayScore: finished ? (m.score?.fullTime?.away ?? null) : null,
    };
  });

  // Merge with FLAG_CODES
  Object.assign(FLAG_CODES, EXTRA_FLAG_CODES);

  WORLD_CUP_DATA.matches = newMatches;
  console.log(`✅ Loaded ${newMatches.length} real matches from API`);

  // החלת תוצאות סופיות שכבר שמורות ב-Firebase (הלוח החדש דרס אותן)
  if (typeof applyFbResults === 'function') applyFbResults();

  // Re-render if app is active
  if (typeof renderMatches === 'function' && activePage === 'matches') renderMatches();
  if (typeof renderHome    === 'function' && activePage === 'home')    renderHome();
  return true;
}

// Convert UTC time string to local Israel time (UTC+3)
function toLocalTime(utcStr) {
  try {
    const d = new Date(utcStr);
    return d.toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jerusalem' });
  } catch(e) { return ''; }
}

// ===== SYNC LIVE RESULTS (כולל משחקים חיים + דקה) =====
// חישוב דקת משחק משוערת משעת הפתיחה הרשומה.
// לא מדויק — פתיחה עשויה להתעכב ותוספות זמן משתנות, לכן מוצג עם ~
function computeMinute(utcDate, status) {
  if (status === 'PAUSED') return 'מחצית';
  const elapsed = Math.floor((Date.now() - new Date(utcDate).getTime()) / 60000);
  if (elapsed <= 0)  return "1'";
  if (elapsed <= 45) return '~' + elapsed + "'";
  if (elapsed <= 50) return "45'+";
  if (elapsed <= 66) return 'מחצית';           // הפסקה + תוספת מחצית א'
  const m2 = Math.min(90, 45 + (elapsed - 66)); // מחצית ב' (~דקה 66 של שעון = 45')
  return m2 >= 90 ? "90'+" : '~' + m2 + "'";
}

// הפרוקסי מחזיר לפעמים תשובות ישנות מהמטמון — מנסה עד 3 פעמים ובוחר את הטרייה ביותר
async function fetchFreshMatches() {
  // מקסימום 2 ניסיונות — יותר מזה שורף את מכסת ה-API (10 בקשות/דקה)
  let best = null, bestScore = -1;
  for (let i = 0; i < 2; i++) {
    const d = await fdFetch(`/competitions/WC/matches`);
    if (!d?.matches) continue;
    const score = d.matches.filter(m => m.score?.fullTime?.home != null).length;
    if (score > bestScore) { best = d; bestScore = score; }
    // תשובה "תקועה": משחק שהתחיל מזמן ועדיין עתידי, או הסתיים בלי תוצאה
    const stale = d.matches.some(m =>
      (m.status === 'TIMED' && Date.now() - new Date(m.utcDate).getTime() > 2.5 * 3600 * 1000) ||
      (m.status === 'FINISHED' && m.score?.fullTime?.home == null));
    if (!stale) break;
  }
  return best;
}

async function syncLiveResults() {
  const data = await fetchFreshMatches();
  if (!data?.matches) return;
  let changed = false;

  data.matches.forEach(apiMatch => {
    const homeHeb = ENG_TO_HEB[(apiMatch.homeTeam?.name||'').trim()] || apiMatch.homeTeam?.name;
    const awayHeb = ENG_TO_HEB[(apiMatch.awayTeam?.name||'').trim()] || apiMatch.awayTeam?.name;
    const localMatch = WORLD_CUP_DATA.matches.find(m =>
      m.home === homeHeb && m.away === awayHeb);
    if (!localMatch) return;

    const hs = apiMatch.score?.fullTime?.home;
    const as = apiMatch.score?.fullTime?.away;
    const isLive = apiMatch.status === 'IN_PLAY' || apiMatch.status === 'PAUSED';

    if (isLive) {
      // משחק חי — תוצאה שוטפת + דקה, בלי חלוקת נקודות
      const minute = apiMatch.minute ? apiMatch.minute + "'" : computeMinute(apiMatch.utcDate, apiMatch.status);
      if (localMatch.homeScore !== (hs??0) || localMatch.awayScore !== (as??0) || localMatch.minute !== minute) changed = true;
      localMatch.live      = true;
      localMatch.minute    = minute;
      localMatch.homeScore = hs ?? 0;
      localMatch.awayScore = as ?? 0;
      return;
    }

    if (apiMatch.status !== 'FINISHED' || localMatch.finished) {
      if (localMatch.live && apiMatch.status !== 'IN_PLAY' && apiMatch.status !== 'PAUSED') {
        localMatch.live = false; localMatch.minute = null; changed = true;
      }
      return;
    }
    if (hs === null || hs === undefined) return;

    // משחק שהסתיים — תוצאה סופית + חלוקת נקודות (פעם אחת בלבד)
    localMatch.finished  = true;
    localMatch.live      = false;
    localMatch.minute    = null;
    localMatch.homeScore = hs;
    localMatch.awayScore = as;
    changed = true;

    // חלוקת נקודות — פעם אחת בלבד לכל משחק, גם כשהרבה מכשירים מחוברים:
    // נעילה משותפת ב-Firebase מבטיחה שרק המכשיר הראשון מחלק
    // db ו-allPredictions מוגדרים ב-app.js כ-let גלובלי (לא על window!)
    if (typeof db !== 'undefined' && db && typeof allPredictions !== 'undefined') {
      // שמירת התוצאה הסופית ב-Firebase — כל המכשירים יקבלו אותה
      // גם אם ה-proxy שלהם מחזיר נתונים ישנים
      db.ref('results/' + localMatch.id).set({ hs, as, home: homeHeb, away: awayHeb });
      db.ref('awarded/' + localMatch.id).transaction(cur => {
        if (cur) return;            // כבר חולק — בטל
        return { ts: Date.now(), score: `${hs}-${as}` };
      }, (err, committed) => {
        if (err || !committed) return;
        const mp = allPredictions[localMatch.id] || {};
        Object.entries(mp).forEach(([uid, pred]) => {
          const pts = calcPoints(localMatch, pred);
          if (pts > 0) {
            db.ref('users/' + uid).transaction(u =>
              u ? { ...u, score:(u.score||0)+pts, correct:(u.correct||0)+1 } : u
            );
          }
        });
        console.log(`🏅 Points awarded: ${homeHeb} ${hs}–${as} ${awayHeb}`);
      });
    }
  });

  if (changed) {
    if (activePage === 'matches') renderMatches();
    if (activePage === 'home')    renderHome();
  }
}

// ===== LIVE SQUAD FROM API =====
async function fetchSquadFromAPI(teamApiId) {
  const data = await fdFetch(`/teams/${teamApiId}`);
  if (!data?.squad) return null;
  return data.squad.map(p => ({
    name:  p.name,
    pos:   translatePosition(p.position),
    age:   p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : '?',
    club:  p.currentTeam?.name || '?',
    goals: 0,
    emoji: posEmoji(p.position),
  }));
}

function translatePosition(pos) {
  const map = { Goalkeeper:'שוער',Defence:'הגנה',Midfield:'קישור',
                Offence:'קדימה',Defender:'הגנה',Midfielder:'קישור',
                Forward:'קדימה',Attacker:'קדימה' };
  return map[pos] || pos || '?';
}
function posEmoji(pos) {
  if (!pos) return '⚽';
  if (pos.includes('Goal')) return '🧤';
  if (pos.includes('Def'))  return '🛡️';
  if (pos.includes('Mid'))  return '⚙️';
  return '⚡';
}

// ===== START LIVE POLLING =====
let pollingInterval = null;
async function startLivePolling() {
  if (!FD_API_KEY) return;
  // First: load the real schedule
  await syncMatchSchedule();
  // Then: keep syncing results every 60s (2 ניסיונות לסבב = עד 4 בקשות/דקה, בטוח במכסה)
  syncLiveResults();
  pollingInterval = setInterval(syncLiveResults, 60 * 1000);
  console.log('🔴 Live polling started');
}
function stopLivePolling() {
  if (pollingInterval) clearInterval(pollingInterval);
}
