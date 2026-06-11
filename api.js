// =====================================================
//  football-data.org — free tier
//  הרשם בחינם: https://www.football-data.org/client/register
//  הדבק את ה-API key שתקבל בהגדרות למטה
// =====================================================

const FD_API_KEY = window.FD_API_KEY || '';   // set in firebase-config.js
const FD_BASE    = 'https://api.football-data.org/v4';
const WC_ID      = 2000;  // FIFA World Cup 2026 competition ID

// ===== FETCH HELPERS =====
async function fdFetch(path) {
  if (!FD_API_KEY) return null;
  try {
    const res = await fetch(`${FD_BASE}${path}`, {
      headers: { 'X-Auth-Token': FD_API_KEY }
    });
    if (!res.ok) { console.warn('FD API error:', res.status); return null; }
    return res.json();
  } catch(e) { console.warn('FD fetch failed:', e.message); return null; }
}

// ===== LIVE MATCH RESULTS =====
// כל X דקות — מושך תוצאות ומעדכן Firebase אוטומטית
async function syncLiveResults() {
  const data = await fdFetch(`/competitions/${WC_ID}/matches?status=FINISHED`);
  if (!data?.matches) return;
  data.matches.forEach(apiMatch => {
    const localMatch = findLocalMatch(apiMatch);
    if (!localMatch) return;
    const hs = apiMatch.score?.fullTime?.home;
    const as = apiMatch.score?.fullTime?.away;
    if (hs === null || hs === undefined) return;
    if (localMatch.homeScore === hs && localMatch.awayScore === as) return; // no change
    // Update local data
    localMatch.homeScore = hs;
    localMatch.awayScore = as;
    // Award points to all predictors
    if (window.db && window.allPredictions) {
      const mp = window.allPredictions[localMatch.id] || {};
      Object.entries(mp).forEach(([uid, pred]) => {
        const pts = calcPoints(localMatch, pred);
        if (pts > 0) {
          window.db.ref('users/' + uid).transaction(u =>
            u ? { ...u, score: (u.score||0)+pts, correct: (u.correct||0)+1 } : u
          );
        }
      });
    }
    console.log(`✅ Auto-updated: ${localMatch.home} ${hs}-${as} ${localMatch.away}`);
  });
  // Re-render active page
  if (window.activePage === 'matches') renderMatches();
  if (window.activePage === 'home')    renderHome();
}

function findLocalMatch(apiMatch) {
  if (!WORLD_CUP_DATA?.matches) return null;
  const h = apiMatch.homeTeam?.name || '';
  const a = apiMatch.awayTeam?.name || '';
  return WORLD_CUP_DATA.matches.find(m =>
    nameMatch(m.home, h) && nameMatch(m.away, a)
  );
}

function nameMatch(hebrewName, apiName) {
  const map = {
    'ארגנטינה':'Argentina','ברזיל':'Brazil','ספרד':'Spain',
    'צרפת':'France','גרמניה':'Germany','אנגליה':'England',
    'פורטוגל':'Portugal','הולנד':'Netherlands','מקסיקו':'Mexico',
    'ארה"ב':'USA','ארה"ב':'United States','יפן':'Japan',
    'קרואטיה':'Croatia','מרוקו':'Morocco','בלגיה':'Belgium',
    'אוסטרליה':'Australia','טורקיה':'Turkey','קולומביה':'Colombia'
  };
  const eng = map[hebrewName] || hebrewName;
  return apiName.toLowerCase().includes(eng.toLowerCase()) ||
         eng.toLowerCase().includes(apiName.toLowerCase());
}

// ===== LIVE SQUAD FROM API (if key available) =====
async function fetchSquadFromAPI(teamApiId) {
  const data = await fdFetch(`/teams/${teamApiId}`);
  if (!data?.squad) return null;
  return data.squad.map(p => ({
    name: p.name,
    pos:  translatePosition(p.position),
    age:  p.dateOfBirth ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear() : '?',
    club: p.currentTeam?.name || '?',
    goals: 0,
    emoji: posEmoji(p.position),
    nationality: p.nationality
  }));
}

function translatePosition(pos) {
  const map = { Goalkeeper:'שוער', Defence:'הגנה', Midfield:'קישור',
                Offence:'קדימה', Defender:'הגנה', Midfielder:'קישור',
                Forward:'קדימה', Attacker:'קדימה' };
  return map[pos] || pos || '?';
}
function posEmoji(pos) {
  if (!pos) return '⚽';
  if (pos.includes('Goal')) return '🧤';
  if (pos.includes('Def'))  return '🛡️';
  if (pos.includes('Mid'))  return '⚙️';
  return '⚡';
}

// ===== START POLLING =====
// בדיקה כל 3 דקות בזמן משחקים
let pollingInterval = null;
function startLivePolling() {
  if (!FD_API_KEY) return;
  syncLiveResults(); // immediate check
  pollingInterval = setInterval(syncLiveResults, 3 * 60 * 1000);
  console.log('🔴 Live polling started');
}
function stopLivePolling() {
  if (pollingInterval) clearInterval(pollingInterval);
}
