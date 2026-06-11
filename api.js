// =====================================================
//  football-data.org — free tier
//  הרשם בחינם: https://www.football-data.org/client/register
// =====================================================

const FD_API_KEY = window.FD_API_KEY || '';
const FD_BASE    = 'https://api.football-data.org/v4';
let WC_ID        = null;  // נמצא דינמית ע"י findWC2026()

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
async function fdFetch(path) {
  if (!FD_API_KEY) return null;
  try {
    const res = await fetch(`${FD_BASE}${path}`, {
      headers: { 'X-Auth-Token': FD_API_KEY }
    });
    if (!res.ok) { console.warn('FD API error:', res.status, path); return null; }
    return res.json();
  } catch(e) { console.warn('FD fetch failed:', e.message); return null; }
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

  const newMatches = data.matches.map((m, i) => {
    const homeEng = m.homeTeam?.name || '';
    const awayEng = m.awayTeam?.name || '';
    const homeHeb = ENG_TO_HEB[homeEng] || homeEng;
    const awayHeb = ENG_TO_HEB[awayEng] || awayEng;

    // Add unknown teams to FLAG_CODES if needed
    if (homeHeb && !FLAG_CODES[homeHeb] && !EXTRA_FLAG_CODES[homeHeb]) {
      const code = m.homeTeam?.tla?.toLowerCase();
      if (code) EXTRA_FLAG_CODES[homeHeb] = code;
    }
    if (awayHeb && !FLAG_CODES[awayHeb] && !EXTRA_FLAG_CODES[awayHeb]) {
      const code = m.awayTeam?.tla?.toLowerCase();
      if (code) EXTRA_FLAG_CODES[awayHeb] = code;
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

// ===== SYNC LIVE RESULTS =====
async function syncLiveResults() {
  const data = await fdFetch(`/competitions/${WC_ID}/matches?status=FINISHED`);
  if (!data?.matches) return;

  data.matches.forEach(apiMatch => {
    const homeEng = apiMatch.homeTeam?.name || '';
    const awayEng = apiMatch.awayTeam?.name || '';
    const homeHeb = ENG_TO_HEB[homeEng] || homeEng;
    const awayHeb = ENG_TO_HEB[awayEng] || awayEng;

    const localMatch = WORLD_CUP_DATA.matches.find(m =>
      m.home === homeHeb && m.away === awayHeb
    );
    if (!localMatch) return;

    const hs = apiMatch.score?.fullTime?.home;
    const as = apiMatch.score?.fullTime?.away;
    if (hs === null || hs === undefined) return;
    if (localMatch.homeScore === hs && localMatch.awayScore === as) return;

    localMatch.homeScore = hs;
    localMatch.awayScore = as;

    // Award points
    if (window.db && window.allPredictions) {
      const mp = window.allPredictions[localMatch.id] || {};
      Object.entries(mp).forEach(([uid, pred]) => {
        const pts = calcPoints(localMatch, pred);
        if (pts > 0) {
          window.db.ref('users/' + uid).transaction(u =>
            u ? { ...u, score:(u.score||0)+pts, correct:(u.correct||0)+1 } : u
          );
        }
      });
    }
    console.log(`✅ Score updated: ${homeHeb} ${hs}–${as} ${awayHeb}`);
  });

  if (activePage === 'matches') renderMatches();
  if (activePage === 'home')    renderHome();
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
  // Then: keep syncing results every 3 minutes
  syncLiveResults();
  pollingInterval = setInterval(syncLiveResults, 3 * 60 * 1000);
  console.log('🔴 Live polling started');
}
function stopLivePolling() {
  if (pollingInterval) clearInterval(pollingInterval);
}
