// ===== INTRO VIDEO =====
(function initIntro() {
  const video  = document.getElementById('intro-video');
  const screen = document.getElementById('intro-screen');
  const prog   = document.getElementById('intro-progress');
  if (!video || !screen) return;

  function goToLogin() {
    screen.classList.add('hidden');
    document.getElementById('login-screen').classList.add('active');
  }

  // Progress bar
  video.addEventListener('timeupdate', () => {
    const pct = video.duration ? (video.currentTime / video.duration * 100) : 0;
    if (prog) prog.style.width = pct + '%';
  });

  video.addEventListener('ended', goToLogin);
  video.addEventListener('error', goToLogin);
  // If video stalls or won't load — skip after 4s
  setTimeout(() => { if (!video.ended) goToLogin(); }, 8000);

  window.skipIntro = goToLogin;
})();

// ===== STATE =====
let currentUser = null;
let db = null;
let allPredictions = {};
let allUsers = {};
let triviaAnswered = {};
let activePredMatchId = null;
let countdownInterval = null;
let adminUnlocked = false;

const LETTERS = ['א','ב','ג','ד'];
const AVATARS = ['🦁','🐯','🦊','🐺','🦅','🐬','🦋','🦄','🐉','🌟','⚡','🔥','🏹','💎','🚀','🌊'];

const BADGE_DEFS = [
  { id:'first_pred',   icon:'🎯', name:'ניחוש ראשון',      desc:'ניחשת את המשחק הראשון שלך',       filter:'all'  },
  { id:'first_correct',icon:'✅', name:'ניצחון ראשון',     desc:'ניחוש ראשון שהצליח — מזל טוב!',   filter:'all'  },
  { id:'perfect_score',icon:'💫', name:'ניחוש מדויק',      desc:'ניחשת תוצאה מדויקת (+2 בונוס)',    filter:'all'  },
  { id:'trivia_start', icon:'🧠', name:'מוח של כדורגל',    desc:'ענית נכון על חידה ראשונה',         filter:'daily'},
  { id:'streak3',      icon:'🔥', name:'רצף של 3',          desc:'ענית נכון 3 ימים ברצף',            filter:'daily'},
  { id:'underdog',     icon:'🏹', name:'ציד ההפתעות',      desc:'ניחשת ניצחון של הקבוצה החלשה',     filter:'all'  },
  { id:'all_matches',  icon:'⭐', name:'ניחשת הכל',        desc:'ניחשת את כל המשחקים בשבוע',        filter:'all'  },
  { id:'top3',         icon:'🥇', name:'עילית הכיתה',       desc:'הגעת לטופ 3 בטבלה',                filter:'all'  },
];

// ===== BOOT =====
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('name-input').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => switchPage(b.dataset.page)));

function doLogin() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) { document.getElementById('name-input').focus(); return; }
  const avatarIdx = Math.abs(hashStr(name)) % AVATARS.length;
  // Use hash-based id so Hebrew names get a stable unique id
  const userId = 'u' + Math.abs(hashStr(name)).toString(36);
  currentUser = { name, id: userId, avatar: AVATARS[avatarIdx] };
  document.getElementById('top-avatar').textContent = currentUser.avatar;
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app').classList.add('active');
  initFirebase();
  switchPage('home');
}

function slugify(s) { return s.toLowerCase().replace(/\s+/g,'_').replace(/[^\w]/g,''); }
function hashStr(s) { return s.split('').reduce((a,c) => ((a<<5)-a)+c.charCodeAt(0)|0, 0); }

// ===== FIREBASE =====
function initFirebase() {
  if (!window.firebaseConfig) { bootDemo(); return; }
  try {
    const fbApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.firebaseConfig);
    db = firebase.database(fbApp);

  db.ref('users/'+currentUser.id).transaction(u =>
    u ? { ...u, name:currentUser.name, avatar:currentUser.avatar }
      : { name:currentUser.name, avatar:currentUser.avatar, score:0, correct:0, trivia:0, badges:[] }
  );

  db.ref('predictions').on('value', snap => {
    allPredictions = snap.val() || {};
    if (activePage === 'home')    renderHome();
    if (activePage === 'matches') renderMatches();
  });

  db.ref('users').on('value', snap => {
    allUsers = snap.val() || {};
    updateTopBar();
    if (activePage === 'leaderboard') renderLeaderboard();
    if (activePage === 'badges')      renderBadges();
  });

  db.ref('triviaAnswered/'+currentUser.id).once('value', snap => {
    triviaAnswered = snap.val() || {};
    if (activePage === 'badges') renderBadges();
  });

  // Live lineups stored by admin in Firebase
  db.ref('lineups').on('value', snap => {
    window.firebaseLineups = snap.val() || {};
  });

  // Start football-data.org live polling (only if API key set)
  if (typeof startLivePolling === 'function') startLivePolling();
  } catch(e) {
    console.error('Firebase init error:', e);
    bootDemo();
  }
}

function bootDemo() {
  allUsers = {
    [currentUser.id]: { name:currentUser.name, avatar:currentUser.avatar, score:0, correct:0, trivia:0, badges:[] },
    demo_leo: { name:'ליאו', avatar:'🦁', score:12, correct:3, trivia:2, badges:['first_pred','first_correct'] },
    demo_sara: { name:'שרה', avatar:'🌟', score:9, correct:2, trivia:1, badges:['first_pred'] },
  };
  renderHome(); renderMatches(); renderLeaderboard(); renderBadges();
}

function updateTopBar() {
  const sorted = Object.entries(allUsers).sort((a,b)=>(b[1].score||0)-(a[1].score||0));
  const myRank = sorted.findIndex(([id])=>id===currentUser.id)+1;
  document.getElementById('top-rank').textContent = myRank ? `#${myRank}` : '#–';
  const me = allUsers[currentUser.id];
  if (me) {
    document.getElementById('top-avatar').textContent = me.avatar || currentUser.avatar;
  }
}

// ===== PAGE ROUTING =====
let activePage = 'home';
function switchPage(page) {
  activePage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page===page));
  const el = document.getElementById('page-'+page);
  if (el) { el.classList.add('active'); }
  if (page==='home')        renderHome();
  else if (page==='matches')    renderMatches();
  else if (page==='leaderboard') renderLeaderboard();
  else if (page==='badges')     renderBadges();
}

// ===== HOME =====
function renderHome() {
  const container = document.getElementById('page-home');
  if (!container) return;
  const me = allUsers[currentUser.id] || { score:0, correct:0 };
  const sorted = Object.entries(allUsers).sort((a,b)=>(b[1].score||0)-(a[1].score||0));
  const myRank = sorted.findIndex(([id])=>id===currentUser.id)+1;
  const nextMatch = WORLD_CUP_DATA.matches.find(m => m.homeScore === null);
  const earnedBadges = (me.badges||[]).length;

  container.innerHTML = `
    <div class="profile-strip" style="animation-delay:0ms">
      <div class="ps-avatar">${currentUser.avatar}</div>
      <div class="ps-info">
        <div class="ps-name">${currentUser.name}</div>
        <div class="ps-rank">#${myRank||'–'} בכיתה · ${me.correct||0} ניחושים נכונים · ${earnedBadges} עיטורים</div>
      </div>
      <div class="ps-score">
        <div class="ps-pts">${me.score||0}</div>
        <div class="ps-pts-lbl">נקודות</div>
      </div>
    </div>

    ${nextMatch ? buildNextMatchCard(nextMatch) : '<div class="card"><p style="text-align:center;color:var(--muted)">כל המשחקים הסתיימו!</p></div>'}

    <div class="sec-head"><span class="sec-title">📊 ניתוח המשחק</span></div>
    ${nextMatch ? buildProbCard(nextMatch) : ''}

    <div class="sec-head" style="margin-top:14px"><span class="sec-title">⚡ עובדות מהירות</span></div>
    ${buildFastFacts(nextMatch)}
  `;

  if (nextMatch) startCountdown(nextMatch);
}

function buildNextMatchCard(m) {
  const hd = WORLD_CUP_DATA.teams[m.home] || { flag:'🏳', color:'#444' };
  const ad = WORLD_CUP_DATA.teams[m.away] || { flag:'🏳', color:'#444' };
  const mp = allPredictions[m.id] || {};
  const myPred = mp[currentUser.id];
  const total = Object.keys(mp).length;

  const predSelected = myPred?.result;
  return `
    <div class="next-match-card">
      <div class="nm-soon-badge"><span>🔴</span> LIVE SOON</div>
      <div class="nm-teams-row">
        <div class="nm-team">
          ${buildFlagBadge(m.home,'lg')}
          <div class="nm-teamname">${m.home}</div>
        </div>
        <div class="nm-center">
          <div class="nm-starts">מתחיל בעוד</div>
          <div class="nm-countdown" id="home-countdown">--:--:--</div>
          <div class="nm-venue-lbl">${m.venue}</div>
        </div>
        <div class="nm-team">
          ${buildFlagBadge(m.away,'lg')}
          <div class="nm-teamname">${m.away}</div>
        </div>
      </div>
      <div class="nm-pred-label">${predSelected ? '✅ ניחשת — לחץ לשנות' : '🎯 מי ינצח? לחץ לניחוש'}</div>
      <div class="nm-odds-row">
        <div class="nm-odd ${predSelected==='home'?'sel':''}" onclick="quickPred('${m.id}','home')">
          <span class="nm-odd-flag">${hd.flag}</span>
          <span class="nm-odd-label">${m.home}</span>
          <span class="nm-odd-val">${getPct(mp,'home')}%</span>
        </div>
        <div class="nm-odd ${predSelected==='draw'?'sel':''}" onclick="quickPred('${m.id}','draw')">
          <span class="nm-odd-flag">🤝</span>
          <span class="nm-odd-label">תיקו</span>
          <span class="nm-odd-val">${getPct(mp,'draw')}%</span>
        </div>
        <div class="nm-odd ${predSelected==='away'?'sel':''}" onclick="quickPred('${m.id}','away')">
          <span class="nm-odd-flag">${ad.flag}</span>
          <span class="nm-odd-label">${m.away}</span>
          <span class="nm-odd-val">${getPct(mp,'away')}%</span>
        </div>
      </div>
      ${total>0?`<div class="nm-votes-count">👥 ${total} ניחושים מהכיתה</div>`:''}
    </div>`;
}

function buildProbCard(m) {
  const hd = WORLD_CUP_DATA.teams[m.home] || { strength:50 };
  const ad = WORLD_CUP_DATA.teams[m.away] || { strength:50 };
  const mp = allPredictions[m.id] || {};
  const total = Object.keys(mp).length;

  let homeP, drawP, awayP;
  if (total > 0) {
    homeP = getPct(mp,'home'); drawP = getPct(mp,'draw'); awayP = getPct(mp,'away');
  } else {
    const tot = hd.strength + ad.strength + 20;
    homeP = Math.round((hd.strength/tot)*100);
    awayP = Math.round((ad.strength/tot)*100);
    drawP = 100-homeP-awayP;
  }

  // Form mock
  const form = { [m.home]:['W','W','D','W','L'], [m.away]:['W','W','W','W','D'] };
  const formHtml = (name) => (form[name]||['?','?','?','?','?']).map(r=>`<div class="form-result form-${r.toLowerCase()}">${r}</div>`).join('');

  return `
    <div class="prob-card" style="animation-delay:80ms">
      <div class="prob-title">📊 הסתברות ניצחון — לפי ניחושי הכיתה</div>
      <div class="prob-bar-wrap">
        <div class="prob-home" style="width:${homeP}%"></div>
        <div class="prob-draw" style="width:${drawP}%"></div>
        <div class="prob-away" style="width:${awayP}%"></div>
      </div>
      <div class="prob-labels">
        <span style="color:var(--blue)">${m.home} ${homeP}%</span>
        <span style="color:var(--muted)">${drawP}% תיקו</span>
        <span style="color:var(--purple)">${awayP}% ${m.away}</span>
      </div>
    </div>
    <div class="card" style="animation-delay:120ms">
      <div class="sec-title" style="font-size:.82rem;margin-bottom:12px">📈 פורמה אחרונה</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:.78rem;font-weight:700">${m.home}</span>
          <div class="form-row">${formHtml(m.home)}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:.78rem;font-weight:700">${m.away}</span>
          <div class="form-row">${formHtml(m.away)}</div>
        </div>
      </div>
    </div>`;
}

function buildFastFacts(nextMatch) {
  const facts = [
    { icon:'🏆', title:'48 קבוצות!', text:'מונדיאל 2026 הוא הגדול בהיסטוריה — פי 1.5 מהמונדיאלים הקודמים.' },
    { icon:'🌎', title:'3 מארחות', text:'לראשונה בהיסטוריה — ארה"ב, קנדה ומקסיקו מארחות יחד.' },
    { icon:'⚽', title:'104 משחקים', text:'64 משחקים יותר מהמונדיאל הרגיל — מהשלב הקבוצתי ועד הגמר!' },
  ];
  const t = nextMatch && WORLD_CUP_DATA.teams[nextMatch.home];
  if (t) facts.unshift({ icon:t.flag, title:t.titles>0?`🏆 ${t.titles}× אלופות`:'עוד לא זכו!', text:t.funFact });

  return facts.slice(0,3).map((f,i) => `
    <div class="fact-card" style="animation-delay:${140+i*40}ms">
      <div class="fact-icon">${f.icon}</div>
      <div><div class="fact-title">${f.title}</div><div class="fact-text">${f.text}</div></div>
    </div>`).join('');
}

function startCountdown(match) {
  if (countdownInterval) clearInterval(countdownInterval);
  const target = new Date(match.date + 'T' + match.time + ':00');
  function tick() {
    const el = document.getElementById('home-countdown');
    if (!el) { clearInterval(countdownInterval); return; }
    const diff = target - Date.now();
    if (diff <= 0) { el.textContent = '🔴 LIVE'; clearInterval(countdownInterval); return; }
    const h = String(Math.floor(diff/3600000)).padStart(2,'0');
    const m = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
    const s = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    el.textContent = `${h}:${m}:${s}`;
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function quickPred(matchId, result) {
  const pred = { result, name:currentUser.name, ts:Date.now() };
  if (db) db.ref(`predictions/${matchId}/${currentUser.id}`).set(pred);
  else allPredictions[matchId] = { ...(allPredictions[matchId]||{}), [currentUser.id]:pred };
  renderHome();
  grantBadge('first_pred');
}

// ===== FLAG BADGE =====
const FLAG_CODES = {
  'ארגנטינה':'ar','ברזיל':'br','ספרד':'es','צרפת':'fr','גרמניה':'de',
  'אנגליה':'gb-eng','פורטוגל':'pt','הולנד':'nl','מקסיקו':'mx','ארה"ב':'us',
  'קנדה':'ca','קרואטיה':'hr','קולומביה':'co','בלגיה':'be','יפן':'jp',
  'טורקיה':'tr',"צ'ילה":'cl','מרוקו':'ma','אוסטרליה':'au','יפן':'jp',
  'סנגל':'sn','קמרון':'cm','גאנה':'gh','תוניסיה':'tn','מאלי':'ml',
  'אקוודור':'ec','אורוגוואי':'uy','פרגוואי':'py','פרו':'pe','צ\'ילה':'cl',
  'דנמרק':'dk','שוויץ':'ch','אוסטריה':'at','סקוטלנד':'gb-sct',
  'אירלנד':'ie','פולין':'pl','צ\'כיה':'cz','סלובקיה':'sk',
  'רומניה':'ro','הונגריה':'hu','סרביה':'rs','סלובניה':'si',
  'אלבניה':'al','קוסובו':'xk','אוקראינה':'ua','גיאורגיה':'ge',
  'דרום אפריקה':'za','ניגריה':'ng','חוף השנהב':'ci','קונגו':'cd',
  'מצרים':'eg','ערב הסעודית':'sa','איראן':'ir','דרום קוריאה':'kr',
  'קטאר':'qa','ניו זילנד':'nz','פנמה':'pa','קוסטה ריקה':'cr',
  'הונדורס':'hn','ג\'מייקה':'jm','אל סלבדור':'sv','האיטי':'ht',
  'ונצואלה':'ve','בוליביה':'bo',
};

function buildFlagBadge(teamKey, size='md') {
  const t    = WORLD_CUP_DATA.teams[teamKey] || { color:'#444', secondColor:'#888' };
  const code = FLAG_CODES[teamKey];
  const sz   = size==='lg' ? 'flag-badge-lg' : size==='sm' ? 'flag-badge-sm' : 'flag-badge-md';
  const short = abbrev(teamKey);
  if (!code) {
    return `<div class="flag-badge ${sz}" style="--fc1:${t.color};--fc2:${t.secondColor}"><span class="flag-badge-text">${short}</span></div>`;
  }
  return `
    <div class="flag-badge ${sz}" style="--fc1:${t.color};--fc2:${t.secondColor}">
      <img class="flag-badge-img" src="https://flagcdn.com/w80/${code}.png"
           alt="${short}" loading="eager"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
      <span class="flag-badge-text" style="display:none">${short}</span>
    </div>`;
}

// ===== MATCHES =====
function renderMatches() {
  const container = document.getElementById('page-matches');
  if (!container) return;
  container.innerHTML = `
    <div class="sec-head"><span class="sec-title">⚽ כל המשחקים</span></div>
    ${WORLD_CUP_DATA.matches.map((m,i) => buildMatchRow(m,i*50)).join('')}`;
}

function buildMatchRow(m, delay) {
  const hd = WORLD_CUP_DATA.teams[m.home] || { flag:'🏳', color:'#444' };
  const ad = WORLD_CUP_DATA.teams[m.away] || { flag:'🏳', color:'#444' };
  const fin = m.homeScore !== null;
  const mp  = allPredictions[m.id] || {};
  const myPred = mp[currentUser.id];
  const total  = Object.keys(mp).length;
  const hVotes = total>0 ? Math.round(Object.values(mp).filter(p=>p.result==='home').length/total*100) : 0;
  const dVotes = total>0 ? Math.round(Object.values(mp).filter(p=>p.result==='draw').length/total*100) : 0;
  const aVotes = total>0 ? Math.round(Object.values(mp).filter(p=>p.result==='away').length/total*100) : 0;

  // Bottom section: if finished show result badge; if predicted show chip + edit; else show 3 predict buttons
  let bottomHtml;
  if (fin) {
    const won = m.homeScore > m.awayScore ? 'home' : m.homeScore < m.awayScore ? 'away' : 'draw';
    const predOk = myPred && isCorrect(m, myPred);
    bottomHtml = `
      <div class="mc-pred-result">
        ${myPred
          ? `<span class="my-pred-chip ${predOk?'correct':'wrong'}">
               🎯 ${myPred.result==='home'?m.home:myPred.result==='away'?m.away:'תיקו'} ${predOk?'✅':'❌'}
             </span>`
          : `<span class="no-pred-chip">לא ניחשת</span>`}
        <button class="mc-details-link" onclick="event.stopPropagation();openMatchCenter('${m.id}')">פרטים →</button>
      </div>`;
  } else if (myPred) {
    bottomHtml = `
      <div class="mc-pred-result">
        <span class="my-pred-chip">🎯 ${myPred.result==='home'?m.home:myPred.result==='away'?m.away:'תיקו'}</span>
        <button class="mc-edit-pred" onclick="event.stopPropagation();quickPredSheet('${m.id}')">✏️ שנה</button>
        <button class="mc-details-link" onclick="event.stopPropagation();openMatchCenter('${m.id}')">פרטים →</button>
      </div>`;
  } else {
    bottomHtml = `
      <div class="pred-inline-row">
        <button class="pib pib-home" onclick="event.stopPropagation();inlinePred('${m.id}','home',this)">
          ${hd.flag} ${m.home}
        </button>
        <button class="pib pib-draw" onclick="event.stopPropagation();inlinePred('${m.id}','draw',this)">
          🤝 תיקו
        </button>
        <button class="pib pib-away" onclick="event.stopPropagation();inlinePred('${m.id}','away',this)">
          ${ad.flag} ${m.away}
        </button>
      </div>`;
  }

  return `
    <div class="match-card" style="animation-delay:${delay}ms">
      <div class="match-top">
        <span>📅 ${fmtDate(m.date)} · ${m.venue}</span>
        <span class="match-group-pill">בית ${m.group}</span>
      </div>
      <div class="match-teams-row">
        <div class="match-team-block" onclick="openMatchCenter('${m.id}')">
          ${buildFlagBadge(m.home,'lg')}
          <div class="match-team-name">${m.home}</div>
        </div>
        <div class="match-center-block" onclick="openMatchCenter('${m.id}')">
          ${fin
            ? `<div class="mscore-big">${m.homeScore} <span class="mscore-dash">—</span> ${m.awayScore}</div>`
            : `<div class="mvs-block"><div class="mvs">VS</div><div class="mtime">${m.time}</div></div>`}
          ${total>0 ? `<div class="vote-mini" style="margin-top:6px">
            <div class="vm-h" style="width:${hVotes}%"></div>
            <div class="vm-d" style="width:${dVotes}%"></div>
            <div class="vm-a" style="width:${aVotes}%"></div>
          </div>` : ''}
        </div>
        <div class="match-team-block" onclick="openMatchCenter('${m.id}')">
          ${buildFlagBadge(m.away,'lg')}
          <div class="match-team-name">${m.away}</div>
        </div>
      </div>
      ${bottomHtml}
    </div>`;
}

function inlinePred(matchId, result, btn) {
  // Animate the button then save
  btn.classList.add('pib-chosen');
  setTimeout(() => {
    const pred = { result, name:currentUser.name, ts:Date.now() };
    if (db) db.ref(`predictions/${matchId}/${currentUser.id}`).set(pred);
    else { allPredictions[matchId] = { ...(allPredictions[matchId]||{}), [currentUser.id]:pred }; renderMatches(); }
    grantBadge('first_pred');
  }, 180);
}

function quickPredSheet(matchId) {
  openPredModal(matchId);
}

// ===== MATCH CENTER =====
function openMatchCenter(matchId) {
  const m = WORLD_CUP_DATA.matches.find(x=>x.id===matchId);
  if (!m) return;
  const hd = WORLD_CUP_DATA.teams[m.home] || { flag:'🏳', players:[] };
  const ad = WORLD_CUP_DATA.teams[m.away] || { flag:'🏳', players:[] };
  const mp = allPredictions[m.id] || {};
  const total = Object.keys(mp).length;
  const fin = m.homeScore !== null;

  // Donut data
  const homeV = total ? Object.values(mp).filter(p=>p.result==='home').length : 0;
  const drawV = total ? Object.values(mp).filter(p=>p.result==='draw').length : 0;
  const awayV = total ? Object.values(mp).filter(p=>p.result==='away').length : 0;
  const donut = total>0
    ? buildDonut(homeV/total*100, drawV/total*100, awayV/total*100, m)
    : `<div class="empty"><div class="ico">🎯</div><p>היה הראשון לנחש!</p></div>`;

  // Lineups — prefer Firebase admin-entered lineup, fall back to squad stars
  const fbLineup = (window.firebaseLineups || {})[m.id] || {};
  const getLineupPlayers = (teamKey) => {
    const saved = fbLineup[teamKey === m.home ? 'home' : 'away'];
    if (saved && saved.length) return saved; // admin-entered names
    const squad = WORLD_CUP_DATA.teams[teamKey]?.squad || [];
    // Pick starters: 1 GK + top 4 DEF + top 4 MID + top 3 FWD sorted by star/caps
    const byPos = (pos) => squad.filter(p=>p.pos===pos).sort((a,b)=>(b.star?1:0)-(a.star?1:0)||(b.caps||0)-(a.caps||0));
    const xi = [...byPos('שוער').slice(0,1), ...byPos('הגנה').slice(0,4),
                ...byPos('קישור').slice(0,4), ...byPos('קדימה').slice(0,3)];
    return xi.map(p => ({ name:p.name, pos:p.pos, emoji:p.emoji, star:p.star, club:p.club }));
  };
  const lineup = (teamKey, formation) => {
    const players = getLineupPlayers(teamKey);
    const teamData = WORLD_CUP_DATA.teams[teamKey] || {};
    const isAdminLineup = !!(fbLineup[teamKey === m.home ? 'home' : 'away']);
    return `
    <div class="lineup-side">
      <div class="lineup-formation">${teamData.formation || formation}</div>
      ${players.map(p => {
        // Find full squad data if available (for click popup)
        const fullP = (WORLD_CUP_DATA.teams[teamKey]?.squad||[]).find(s=>s.name===p.name) || p;
        const safeId = (p.name||'').replace(/[^a-zA-Zא-ת0-9]/g,'_');
        return `
        <div class="lineup-player" onclick="openPlayerPopup('${teamKey}','${safeId}')">
          <span class="lineup-pos-badge lp-${(p.pos||'').replace(/[^א-ת]/g,'')}">${posShort(p.pos)}</span>
          <span class="lineup-emoji">${p.emoji||'⚽'}</span>
          <span class="lineup-pname">${p.name}${p.star?'<span class="lp-star">★</span>':''}</span>
          <span class="lineup-club-mini">${(fullP.club||'').split(' ').slice(0,2).join(' ')}</span>
        </div>`;
      }).join('')}
      <div class="lineup-source">${isAdminLineup ? '✏️ עודכן ע"י מנהל' : '📋 הרכב צפוי'}</div>
    </div>`
  };

  // H2H mock
  const h2h = { home:2, draw:1, away:2 };

  document.getElementById('match-modal-body').innerHTML = `
    <div class="mc-header">
      <div class="mc-teams">
        <div class="mc-team">
          ${buildFlagBadge(m.home,'lg')}
          <div class="mc-name">${m.home}</div>
        </div>
        <div class="mc-center-col">
          ${fin
            ? `<div class="mc-score-final">${m.homeScore} <span>—</span> ${m.awayScore}</div><div class="mc-status">⚽ סיום</div>`
            : `<div class="mc-timer" id="mc-countdown">--:--:--</div><div class="mc-status">⏱ ${m.time} · ${fmtDate(m.date)}</div>`}
        </div>
        <div class="mc-team">
          ${buildFlagBadge(m.away,'lg')}
          <div class="mc-name">${m.away}</div>
        </div>
      </div>
      <div class="mc-venue">📍 ${m.venue} · בית ${m.group}</div>
    </div>

    <div class="card">
      <div class="sec-head"><span class="sec-title">🗳️ ניחושי הכיתה</span></div>
      ${donut}
    </div>

    <div class="card">
      <div class="sec-title" style="font-size:.85rem;margin-bottom:10px">📈 פורמה אחרונה</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${buildFormRow(m.home)}
        ${buildFormRow(m.away)}
      </div>
      <div class="divider"></div>
      <div class="sec-title" style="font-size:.82rem;margin-bottom:8px">⚔️ עימותים קודמים (5 אחרונים)</div>
      <div class="h2h-row">
        <div class="h2h-box"><div class="h2h-num" style="color:var(--blue)">${h2h.home}</div><div class="h2h-lbl">${abbrev(m.home)} נצחונות</div></div>
        <div class="h2h-box"><div class="h2h-num" style="color:var(--muted)">${h2h.draw}</div><div class="h2h-lbl">תיקו</div></div>
        <div class="h2h-box"><div class="h2h-num" style="color:var(--purple)">${h2h.away}</div><div class="h2h-lbl">${abbrev(m.away)} נצחונות</div></div>
      </div>
    </div>

    <div class="card">
      <div class="sec-title" style="font-size:.82rem;margin-bottom:10px">👥 הרכב צפוי</div>
      <div class="lineup-row">
        ${lineup(m.home,'4-3-3')} ${lineup(m.away,'4-2-3-1')}
      </div>
    </div>

    ${!fin ? `<button class="pred-big-btn" onclick="openPredModal('${m.id}')">🎯 בצע ניחוש</button>` : ''}
  `;

  document.getElementById('match-modal').classList.remove('hidden');
  if (!fin) {
    const target = new Date(m.date + 'T' + m.time + ':00');
    const mcInt = setInterval(() => {
      const el = document.getElementById('mc-countdown');
      if (!el) { clearInterval(mcInt); return; }
      const diff = target - Date.now();
      if (diff <= 0) { el.textContent = '🔴 LIVE'; clearInterval(mcInt); return; }
      const h = String(Math.floor(diff/3600000)).padStart(2,'0');
      const min = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
      const s = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
      el.textContent = `${h}:${min}:${s}`;
    }, 1000);
  }
}

function buildDonut(homeP, drawP, awayP, m) {
  const r = 52, cx = 70, cy = 70, stroke = 16;
  const circ = 2*Math.PI*r;
  const homeD = circ*(homeP/100), drawD = circ*(drawP/100), awayD = circ*(awayP/100);
  const gap = 2;
  const topTeam = homeP>=awayP ? m.home : m.away;
  const topPct = Math.max(homeP,awayP);

  return `
    <div class="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${stroke}"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--blue)" stroke-width="${stroke}"
          stroke-dasharray="${homeD-gap} ${circ-(homeD-gap)}" stroke-dashoffset="${circ/4}" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--muted)" stroke-width="${stroke}"
          stroke-dasharray="${drawD-gap} ${circ-(drawD-gap)}" stroke-dashoffset="${circ/4-homeD}" stroke-linecap="round"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--purple)" stroke-width="${stroke}"
          stroke-dasharray="${awayD-gap} ${circ-(awayD-gap)}" stroke-dashoffset="${circ/4-homeD-drawD}" stroke-linecap="round"/>
        <text x="${cx}" y="${cy-6}" text-anchor="middle" class="donut-center-text">${Math.round(topPct)}%</text>
        <text x="${cx}" y="${cy+12}" text-anchor="middle" class="donut-center-sub">${topTeam.split(' ')[0]} מוביל</text>
      </svg>
      <div class="donut-legend">
        <div class="dl-item"><div class="dl-dot" style="background:var(--blue)"></div>${m.home} ${Math.round(homeP)}%</div>
        <div class="dl-item"><div class="dl-dot" style="background:var(--muted)"></div>תיקו ${Math.round(drawP)}%</div>
        <div class="dl-item"><div class="dl-dot" style="background:var(--purple)"></div>${m.away} ${Math.round(awayP)}%</div>
      </div>
    </div>`;
}

function buildFormRow(teamName) {
  const forms = { 'ארגנטינה':['W','W','D','W','W'], 'ברזיל':['W','W','W','D','W'], 'ספרד':['W','W','W','W','L'],
    'צרפת':['W','W','D','W','W'], 'גרמניה':['W','D','W','W','W'], 'אנגליה':['W','W','D','L','W'] };
  const f = forms[teamName] || ['W','D','W','W','D'];
  return `<div style="display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:.75rem;font-weight:800">${teamName}</span>
    <div class="form-row">${f.map(r=>`<div class="form-result form-${r.toLowerCase()}">${r}</div>`).join('')}</div>
  </div>`;
}

function closeMatchModal() { document.getElementById('match-modal').classList.add('hidden'); }

// ===== PREDICTION MODAL =====
function openPredModal(matchId) {
  activePredMatchId = matchId;
  const m = WORLD_CUP_DATA.matches.find(x=>x.id===matchId);
  if (!m) return;
  const hd = WORLD_CUP_DATA.teams[m.home] || { flag:'🏳' };
  const ad = WORLD_CUP_DATA.teams[m.away] || { flag:'🏳' };
  const existing = (allPredictions[m.id]||{})[currentUser.id];

  document.getElementById('pred-modal-body').innerHTML = `
    <div class="pred-body">
      <div class="pred-match-head">🎯 מי ינצח?</div>
      <div class="pred-teams-row">
        <div class="pred-team-side"><span class="flag">${hd.flag}</span><div class="name">${m.home}</div></div>
        <div class="pred-vs">VS</div>
        <div class="pred-team-side"><span class="flag">${ad.flag}</span><div class="name">${m.away}</div></div>
      </div>
      <div class="winner-opts">
        <button class="w-opt ${existing?.result==='home'?'sel':''}" onclick="selW(this,'home')">${hd.flag} ניצחון ${m.home}</button>
        <button class="w-opt ${existing?.result==='draw'?'sel':''}" onclick="selW(this,'draw')">🤝 תיקו</button>
        <button class="w-opt ${existing?.result==='away'?'sel':''}" onclick="selW(this,'away')">${ad.flag} ניצחון ${m.away}</button>
      </div>
      <div class="score-bonus-lbl">בונוס: נחש תוצאה מדויקת <span>(+2 נק')</span></div>
      <div class="score-inp-row">
        <div class="s-team-lbl">${m.home}</div>
        <input class="s-inp" id="si-h" type="number" min="0" max="20" value="${existing?.homeScore??''}" placeholder="0"/>
        <span class="s-dash">—</span>
        <input class="s-inp" id="si-a" type="number" min="0" max="20" value="${existing?.awayScore??''}" placeholder="0"/>
        <div class="s-team-lbl">${m.away}</div>
      </div>
      <button class="save-pred-btn" onclick="submitPred()">שמור ניחוש ✓</button>
    </div>`;

  document.getElementById('pred-modal').classList.remove('hidden');
}

function selW(el, v) {
  document.querySelectorAll('.w-opt').forEach(b=>b.classList.remove('sel'));
  el.classList.add('sel'); el._v=v;
}

function submitPred() {
  const sel = document.querySelector('.w-opt.sel');
  if (!sel) { alert('בחר מי ינצח!'); return; }
  const hs = document.getElementById('si-h').value;
  const as = document.getElementById('si-a').value;
  const pred = { result:sel._v, name:currentUser.name, ts:Date.now(),
    ...(hs!==''&&as!==''?{homeScore:+hs,awayScore:+as}:{}) };
  if (db) db.ref(`predictions/${activePredMatchId}/${currentUser.id}`).set(pred);
  else allPredictions[activePredMatchId] = { ...(allPredictions[activePredMatchId]||{}), [currentUser.id]:pred };
  grantBadge('first_pred');
  closePredModal();
}

function closePredModal() { document.getElementById('pred-modal').classList.add('hidden'); }

// ===== LEADERBOARD =====
function renderLeaderboard() {
  const container = document.getElementById('page-leaderboard');
  if (!container) return;
  const sorted = Object.entries(allUsers)
    .map(([id,u])=>({id,...u}))
    .sort((a,b)=>(b.score||0)-(a.score||0));

  container.innerHTML = `
    <div class="sec-head"><span class="sec-title">🏅 טבלת הכיתה</span></div>
    ${buildPodium(sorted)}
    <div class="sec-head" style="margin-top:4px"><span class="sec-title">📋 דירוג מלא</span></div>
    ${sorted.map((u,i) => buildLbRow(u,i)).join('')}
    <div class="points-guide">
      <h3>📋 מערכת הניקוד</h3>
      <div class="pg-row"><span class="pg-lbl">✅ ניחוש מנצח / תיקו</span><span class="pg-val">3 נק'</span></div>
      <div class="pg-row"><span class="pg-lbl">🎯 תוצאה מדויקת (בונוס)</span><span class="pg-val">+2 נק'</span></div>
      <div class="pg-row"><span class="pg-lbl">🧠 חידת יום נכון</span><span class="pg-val">1 נק'</span></div>
    </div>`;
}

function buildPodium(sorted) {
  if (sorted.length < 2) return '';
  const order = [sorted[1], sorted[0], sorted[2]].filter(Boolean);
  const classes = ['p2','p1','p3'], heights = ['p2','p1','p3'];
  return `<div class="podium-section">
    ${order.map((u,i) => `
      <div class="pod-item">
        <div class="pod-avatar ${classes[i]}">${u.avatar||'⚽'}
          ${i===1?'<div class="pod-winner-badge">מוביל</div>':''}
        </div>
        <div class="pod-name">${u.name}</div>
        <div class="pod-pts">${u.score||0} נק'</div>
        <div class="pod-block ${heights[i]}"></div>
      </div>`).join('')}
  </div>`;
}

function buildLbRow(u, i) {
  const medals = ['🥇','🥈','🥉'];
  const isMe = u.id === currentUser.id;
  const earnedBadges = (u.badges||[]);
  const chips = [
    earnedBadges.includes('top3') ? '<span class="lb-badge-chip chip-gold">🥇 עילית</span>' : '',
    earnedBadges.includes('first_correct') ? '<span class="lb-badge-chip chip-blue">✅ מנצח</span>' : '',
    isMe ? '<span class="lb-badge-chip chip-you">אני</span>' : '',
  ].filter(Boolean).join('');

  return `
    <div class="lb-row ${isMe?'me':''}" style="animation-delay:${i*40}ms">
      <div class="lb-pos">${medals[i]||(i+1)}</div>
      <div class="lb-avatar">${u.avatar||'⚽'}</div>
      <div class="lb-info">
        <div class="lb-name">${u.name}</div>
        <div class="lb-badges-row">${chips||'<span style="font-size:.7rem;color:var(--muted)">✅ ${u.correct||0} נכונים</span>'}</div>
      </div>
      <div class="lb-score-col">
        <div class="lb-pts">${u.score||0}</div>
        <div class="lb-pts-lbl">נק'</div>
      </div>
    </div>`;
}

// ===== BADGES =====
function renderBadges() {
  const container = document.getElementById('page-badges');
  if (!container) return;
  const me = allUsers[currentUser.id] || {};
  const myBadges = me.badges || [];
  const earned = myBadges.length;
  const total = BADGE_DEFS.length;

  container.innerHTML = `
    <div class="badge-header">
      <div class="bh-title">🏆 חדר הגביעים</div>
      <div class="bh-sub">אסוף עיטורים על הישגים מיוחדים</div>
      <div class="bh-progress-track"><div class="bh-progress-fill" style="width:${(earned/total)*100}%"></div></div>
      <div class="bh-count">${earned}/${total} עיטורים נאספו</div>
    </div>

    <div class="badge-filter-row">
      <button class="bf-btn active" onclick="filterBadges('all',this)">הכל</button>
      <button class="bf-btn" onclick="filterBadges('daily',this)">יומי</button>
    </div>

    <div class="badges-grid" id="badges-grid">
      ${BADGE_DEFS.map(b => `
        <div class="badge-tile ${myBadges.includes(b.id)?'earned':'locked'}">
          ${myBadges.includes(b.id)?'<div class="badge-earned-mark">✓ נצבר</div>':''}
          <span class="badge-ico">${b.icon}</span>
          <div class="badge-name">${b.name}</div>
          <div class="badge-desc">${b.desc}</div>
        </div>`).join('')}
    </div>

    <div class="limited-drop">
      <div class="ld-icon">🎁</div>
      <div>
        <div class="ld-title">מהדורה מוגבלת!</div>
        <div class="ld-text">הגע לדרגה #1 בכיתה כדי לפתוח את עיטור "אלוף המונדיאל". רק אחד יכול לזכות בו!</div>
      </div>
    </div>

    <div style="margin-top:16px">
      <div class="sec-head"><span class="sec-title">🎯 חידת היום</span></div>
      <div id="trivia-inner">${buildTriviaCard()}</div>
    </div>`;
}

function filterBadges(filter, btn) {
  document.querySelectorAll('.bf-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  const me = allUsers[currentUser.id] || {};
  const myBadges = me.badges || [];
  const grid = document.getElementById('badges-grid');
  if (!grid) return;
  const filtered = filter==='all' ? BADGE_DEFS : BADGE_DEFS.filter(b=>b.filter===filter);
  grid.innerHTML = filtered.map(b => `
    <div class="badge-tile ${myBadges.includes(b.id)?'earned':'locked'}">
      ${myBadges.includes(b.id)?'<div class="badge-earned-mark">✓ נצבר</div>':''}
      <span class="badge-ico">${b.icon}</span>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
    </div>`).join('');
}

function buildTriviaCard() {
  const todayKey = new Date().toISOString().slice(0,10);
  if (triviaAnswered[todayKey] !== undefined) {
    const won = triviaAnswered[todayKey];
    return `<div class="trivia-done-msg"><span class="ico">${won?'🎉':'😅'}</span>
      <strong>${won?'ענית נכון! +1 נקודה':'לא הצלחת היום'}</strong>
      <p>חידה חדשה מחר 🌟</p></div>`;
  }
  const idx = (new Date().getDate()+new Date().getMonth()*31) % WORLD_CUP_DATA.trivia.length;
  const q = WORLD_CUP_DATA.trivia[idx];
  return `
    <div class="trivia-card-inner">
      <div class="trivia-q">❓ ${q.q}</div>
      <div class="trivia-opts">
        ${q.options.map((opt,i) => `
          <button class="trivia-opt" onclick="answerTrivia(${i},${q.answer})">
            <span class="t-letter">${LETTERS[i]}</span>${opt}
          </button>`).join('')}
      </div>
      <div class="trivia-fb" id="trivia-fb"></div>
    </div>`;
}

function answerTrivia(chosen, correct) {
  const win = chosen===correct;
  const todayKey = new Date().toISOString().slice(0,10);
  document.querySelectorAll('.trivia-opt').forEach((o,i) => {
    o.classList.add('locked'); o.onclick=null;
    if (i===correct) o.classList.add('correct');
    else if (i===chosen&&!win) o.classList.add('wrong');
  });
  document.getElementById('trivia-fb').textContent = win?'🎉 נכון! קיבלת נקודה':'❌ לא נכון';
  document.getElementById('trivia-fb').className = 'trivia-fb '+(win?'win':'lose');
  triviaAnswered[todayKey]=win;
  if (db) {
    db.ref('triviaAnswered/'+currentUser.id).update({[todayKey]:win});
    if (win) {
      db.ref('users/'+currentUser.id).transaction(u=>u?{...u,score:(u.score||0)+1,trivia:(u.trivia||0)+1}:u);
      grantBadge('trivia_start');
    }
  }
}

// ===== BADGES ENGINE =====
function grantBadge(badgeId) {
  const me = allUsers[currentUser.id];
  if (!me) return;
  const current = me.badges || [];
  if (current.includes(badgeId)) return;
  const updated = [...current, badgeId];
  if (db) db.ref('users/'+currentUser.id+'/badges').set(updated);
  else { allUsers[currentUser.id] = { ...me, badges:updated }; }
}

// ===== TEAM MODAL =====
let teamSquadFilter = 'all';
function openTeamModal(name) {
  const t = WORLD_CUP_DATA.teams[name];
  if (!t) return;
  teamSquadFilter = 'all';
  document.getElementById('team-modal-body').innerHTML = buildTeamModalHTML(name, t);
  document.getElementById('team-modal').classList.remove('hidden');
  setTimeout(()=>{
    const el = document.getElementById('tsf-'+slugify(name));
    if(el) el.style.width=t.strength+'%';
  },80);
}

function buildTeamModalHTML(name, t) {
  const squad = t.squad || [];
  const stars = squad.filter(p=>p.star);
  const posOrder = ['שוער','הגנה','קישור','קדימה'];
  const filtered = teamSquadFilter==='all' ? squad : squad.filter(p=>p.pos===teamSquadFilter);
  const sorted = [...filtered].sort((a,b)=>
    posOrder.indexOf(a.pos)-posOrder.indexOf(b.pos) || (b.star?1:0)-(a.star?1:0) || (b.caps||0)-(a.caps||0)
  );

  const filterBtns = [['all','הכל'],['שוער','שוערים'],['הגנה','הגנה'],['קישור','קישור'],['קדימה','התקפה']]
    .map(([v,l])=>`<button class="sq-filter-btn${teamSquadFilter===v?' active':''}" onclick="filterSquad('${name}','${v}')">${l}</button>`).join('');

  return `
    <div class="tm-head" style="background:linear-gradient(135deg,${t.color}33,transparent)">
      <span class="tm-flag" style="font-size:3rem">${t.flag}</span>
      <div class="tm-name">${name}</div>
      <div class="tm-sub">בית ${t.group} · מאמן: ${t.coach}</div>
      <div class="tm-formation-badge">${t.formation}</div>
    </div>
    <div class="tm-body">
      <div class="tm-stats">
        <div class="tm-stat"><div class="tm-stat-num">🏆 ${t.titles}</div><div class="tm-stat-lbl">תארים</div></div>
        <div class="tm-stat"><div class="tm-stat-num">${t.strength}</div><div class="tm-stat-lbl">עוצמה</div></div>
        <div class="tm-stat"><div class="tm-stat-num">${squad.length}</div><div class="tm-stat-lbl">שחקנים</div></div>
      </div>
      <div class="tm-str-wrap">
        <div class="tm-str-lbl"><span>עוצמת הקבוצה</span><span>${t.strength}/100</span></div>
        <div class="tm-str-track"><div class="tm-str-fill" id="tsf-${slugify(name)}" style="width:0%"></div></div>
      </div>

      ${stars.length ? `
        <div class="pl-head" style="margin-top:12px">⭐ כוכבי הנבחרת</div>
        <div class="stars-row">
          ${stars.map(p=>`
            <div class="star-card">
              <div class="star-emoji">${p.emoji}</div>
              <div class="star-name">${p.name.split(' ').slice(-1)[0]}</div>
              <div class="star-stat">${p.goals} ⚽ · ${p.caps} משחקים</div>
              <div class="star-club">${p.club}</div>
            </div>`).join('')}
        </div>` : ''}

      <div class="sq-filter-row">${filterBtns}</div>
      <div class="player-list" id="squad-list-${slugify(name)}">
        ${sorted.map(p=>`
          <div class="pl-row ${p.star?'pl-star':''}">
            <div class="pl-ico">${p.emoji}</div>
            <div class="pl-info">
              <div class="pl-name">${p.name}${p.star?' ⭐':''}</div>
              <div class="pl-meta">${p.pos} · ${p.club} · גיל ${p.age}</div>
            </div>
            <div class="pl-right">
              ${p.goals>0?`<div class="pl-goals">⚽ ${p.goals}</div>`:''}
              <div class="pl-caps">${p.caps} משחקים</div>
            </div>
          </div>`).join('')}
      </div>
      <div class="tm-fact">💡 ${t.funFact}</div>
    </div>`;
}

function filterSquad(teamName, pos) {
  teamSquadFilter = pos;
  const t = WORLD_CUP_DATA.teams[teamName];
  if (!t) return;
  document.getElementById('team-modal-body').innerHTML = buildTeamModalHTML(teamName, t);
  setTimeout(()=>{
    const el = document.getElementById('tsf-'+slugify(teamName));
    if(el) el.style.width=t.strength+'%';
  },50);
}
function closeTeamModal(){ document.getElementById('team-modal').classList.add('hidden'); }

// ===== ADMIN =====
function toggleAdmin(){
  if(!adminUnlocked){
    const pw = prompt('סיסמת מנהל:');
    if(pw!=='מונדיאל2026') return;
    adminUnlocked=true;
  }
  renderAdminPanel();
  document.getElementById('admin-modal').classList.remove('hidden');
}
function closeAdminModal(){
  document.getElementById('admin-modal').classList.add('hidden');
}

let adminTab = 'results';
function renderAdminPanel(){
  const p = document.getElementById('admin-panel');
  p.innerHTML = `
    <h3>⚙️ פאנל מנהל</h3>
    <div class="admin-tabs">
      <button class="adm-tab${adminTab==='results'?' active':''}" onclick="setAdminTab('results')">תוצאות</button>
      <button class="adm-tab${adminTab==='lineups'?' active':''}" onclick="setAdminTab('lineups')">הרכבים</button>
    </div>
    <div id="admin-tab-content">${adminTab==='results' ? renderAdminResults() : renderAdminLineups()}</div>`;
}

function setAdminTab(tab) {
  adminTab = tab;
  renderAdminPanel();
}

function renderAdminResults() {
  return WORLD_CUP_DATA.matches.map(m=>`
    <div class="am-row">
      <span class="am-name">${abbrev(m.home)} vs ${abbrev(m.away)}</span>
      <input class="am-inp" id="ah-${m.id}" type="number" min="0" max="20" placeholder="?" value="${m.homeScore??''}">
      <span>—</span>
      <input class="am-inp" id="aa-${m.id}" type="number" min="0" max="20" placeholder="?" value="${m.awayScore??''}">
      <button class="am-save" onclick="saveResult('${m.id}')">✓</button>
    </div>`).join('');
}

function renderAdminLineups() {
  return WORLD_CUP_DATA.matches.map(m => {
    const saved = (window.firebaseLineups || {})[m.id] || {};
    const homeLU = (saved.home || []).join('\n');
    const awayLU = (saved.away || []).join('\n');
    return `
      <div class="am-lineup-block">
        <div class="am-lineup-title">${m.home} vs ${m.away} <span style="color:var(--muted);font-size:.7rem">${fmtDate(m.date)}</span></div>
        <div class="am-lineup-row">
          <div class="am-lineup-col">
            <div class="am-lineup-lbl">${m.home}</div>
            <textarea class="am-lineup-ta" id="lu-h-${m.id}" placeholder="שם שחקן בכל שורה\n(11 שחקנים)">${homeLU}</textarea>
          </div>
          <div class="am-lineup-col">
            <div class="am-lineup-lbl">${m.away}</div>
            <textarea class="am-lineup-ta" id="lu-a-${m.id}" placeholder="שם שחקן בכל שורה\n(11 שחקנים)">${awayLU}</textarea>
          </div>
        </div>
        <button class="am-save" style="width:100%;margin-top:6px" onclick="saveLineup('${m.id}','${m.home}','${m.away}')">💾 שמור הרכב</button>
      </div>`;
  }).join('');
}

function saveLineup(matchId, homeName, awayName) {
  const homeLines = document.getElementById('lu-h-'+matchId).value.split('\n').map(s=>s.trim()).filter(Boolean);
  const awayLines = document.getElementById('lu-a-'+matchId).value.split('\n').map(s=>s.trim()).filter(Boolean);
  const lineup = {
    home: homeLines.map(name => ({ name })),
    away: awayLines.map(name => ({ name })),
    updatedAt: Date.now()
  };
  if (db) {
    db.ref('lineups/'+matchId).set(lineup);
    alert(`✅ הרכב נשמר ל-${homeName} vs ${awayName}`);
  }
}

function saveResult(matchId){
  const hs=+document.getElementById('ah-'+matchId).value;
  const as_=+document.getElementById('aa-'+matchId).value;
  if(isNaN(hs)||isNaN(as_)) return;
  const match = WORLD_CUP_DATA.matches.find(m=>m.id===matchId);
  match.homeScore=hs; match.awayScore=as_;
  const mp = allPredictions[matchId]||{};
  Object.entries(mp).forEach(([uid,pred])=>{
    const pts = calcPoints(match,pred);
    if(pts>0&&db) db.ref('users/'+uid).transaction(u=>u?{...u,score:(u.score||0)+pts,correct:(u.correct||0)+1}:u);
  });
  if(activePage==='matches') renderMatches();
  if(activePage==='home') renderHome();
}

// ===== PLAYER POPUP =====
function posShort(pos) {
  const m = { 'שוער':'GK', 'הגנה':'DEF', 'קישור':'MID', 'קדימה':'FWD' };
  return m[pos] || (pos||'?').slice(0,3);
}

function openPlayerPopup(teamKey, safeId) {
  const squad = WORLD_CUP_DATA.teams[teamKey]?.squad || [];
  // Match by replacing special chars
  const p = squad.find(s => s.name.replace(/[^a-zA-Zא-ת0-9]/g,'_') === safeId) || squad[0];
  if (!p) return;

  const posLabel = { 'שוער':'שוער', 'הגנה':'מגן', 'קישור':'קשר', 'קדימה':'חלוץ' }[p.pos] || p.pos;
  const strengthTags = buildStrengthTags(p);

  const popup = document.createElement('div');
  popup.id = 'player-popup';
  popup.className = 'player-popup-overlay';
  popup.innerHTML = `
    <div class="player-popup-card">
      <button class="player-popup-close" onclick="document.getElementById('player-popup').remove()">✕</button>
      <div class="pp-header">
        <div class="pp-emoji">${p.emoji||'⚽'}</div>
        <div class="pp-info">
          <div class="pp-name">${p.name}${p.star?' ⭐':''}</div>
          <div class="pp-pos">${posLabel} · ${WORLD_CUP_DATA.teams[teamKey]?.flag||''} ${teamKey}</div>
        </div>
      </div>
      <div class="pp-stats-row">
        <div class="pp-stat"><div class="pp-stat-n">${p.age}</div><div class="pp-stat-l">גיל</div></div>
        <div class="pp-stat"><div class="pp-stat-n">${p.caps||0}</div><div class="pp-stat-l">משחקים</div></div>
        <div class="pp-stat"><div class="pp-stat-n">${p.goals||0}</div><div class="pp-stat-l">⚽ גולים</div></div>
      </div>
      <div class="pp-section-title">🏟️ מועדון נוכחי</div>
      <div class="pp-club-box">${p.club||'לא ידוע'}</div>
      <div class="pp-section-title">💪 חוזקות</div>
      <div class="pp-tags">${strengthTags}</div>
      ${p.star ? '<div class="pp-star-banner">⭐ כוכב נבחרת — שחקן מפתח</div>' : ''}
    </div>`;
  // Close on backdrop tap
  popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });
  document.body.appendChild(popup);
}

function buildStrengthTags(p) {
  const tags = [];
  if (p.pos === 'שוער')  tags.push('עצירות מצוינות','חלוקה','שליטה באזור');
  if (p.pos === 'הגנה')  { tags.push('הגנה איתנה','סימון'); if ((p.goals||0)>5) tags.push('מסוכן בסטנדרטים'); }
  if (p.pos === 'קישור') { tags.push('שליטה בכדור','חלוקה'); if ((p.goals||0)>10) tags.push('גולים ממרחק'); }
  if (p.pos === 'קדימה') { tags.push('גמר'); if ((p.goals||0)>20) tags.push('ציד שערים'); if ((p.caps||0)>60) tags.push('ניסיון רב'); }
  if ((p.caps||0) > 80)  tags.push('קפטן מנוסה');
  if ((p.age||30) < 23)  tags.push('כישרון צעיר');
  if (p.star)            tags.push('שחקן עולמי');
  return tags.slice(0,5).map(t=>`<span class="pp-tag">${t}</span>`).join('');
}

// ===== HELPERS =====
function isCorrect(m,pred){
  if(m.homeScore===null) return false;
  const res=m.homeScore>m.awayScore?'home':m.homeScore<m.awayScore?'away':'draw';
  return pred.result===res;
}
function calcPoints(m,pred){
  if(!pred||m.homeScore===null) return 0;
  let pts=0;
  if(isCorrect(m,pred)){
    pts+=3;
    if(pred.homeScore!==undefined&&pred.awayScore!==undefined&&pred.homeScore===m.homeScore&&pred.awayScore===m.awayScore) pts+=2;
  }
  return pts;
}
function getPct(mp,result){
  const total=Object.keys(mp).length;
  if(!total) return 0;
  return Math.round(Object.values(mp).filter(p=>p.result===result).length/total*100);
}
function abbrev(name){ const m={'ארגנטינה':'ARG','ברזיל':'BRA','ספרד':'ESP','צרפת':'FRA','גרמניה':'GER','אנגליה':'ENG','פורטוגל':'POR','הולנד':'NED','מקסיקו':'MEX','ארה"ב':'USA','יפן':'JPN','אוסטרליה':'AUS','קרואטיה':'CRO','מרוקו':'MAR'}; return m[name]||name.slice(0,3).toUpperCase(); }
function fmtDate(d){ return new Date(d+'T12:00:00').toLocaleDateString('he-IL',{weekday:'short',day:'numeric',month:'short'}); }
function slugify(s){ return s.toLowerCase().replace(/\s+/g,'_').replace(/[^\w]/g,''); }
