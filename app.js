// ===== STATE =====
let currentUser = null;
let db = null;
let predictionsRef = null;
let usersRef = null;
let triviaAnsweredRef = null;
let currentTriviaIndex = 0;
let activePredictionMatchId = null;

// ===== INIT =====
document.getElementById('login-btn').addEventListener('click', handleLogin);
document.getElementById('name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

function handleLogin() {
  const name = document.getElementById('name-input').value.trim();
  if (!name) return;
  currentUser = { name, id: name.toLowerCase().replace(/\s+/g, '_') };
  document.getElementById('header-username').textContent = name;
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app').classList.add('active');

  initFirebase();
  renderMatches();
  renderTeams();
  renderTrivia();
}

// ===== FIREBASE =====
function initFirebase() {
  if (!window.firebaseConfig) {
    console.warn('Firebase not configured — running in demo mode');
    renderLeaderboardDemo();
    return;
  }
  const app = firebase.initializeApp(window.firebaseConfig);
  db = firebase.database(app);

  // Register/update this user
  usersRef = db.ref('users/' + currentUser.id);
  usersRef.transaction(existing => {
    if (!existing) return { name: currentUser.name, score: 0, correctPredictions: 0, triviaCorrect: 0 };
    return { ...existing, name: currentUser.name };
  });

  predictionsRef = db.ref('predictions');
  triviaAnsweredRef = db.ref('triviaAnswered/' + currentUser.id);

  // Live leaderboard
  db.ref('users').on('value', snap => {
    const users = snap.val() || {};
    renderLeaderboard(users);
    const me = users[currentUser.id];
    if (me) {
      document.getElementById('header-score').textContent = (me.score || 0) + ' נק\'';
    }
  });

  // Live predictions for matches
  predictionsRef.on('value', snap => {
    renderMatches(snap.val() || {});
  });

  // Check today's trivia status
  triviaAnsweredRef.once('value', snap => {
    const data = snap.val() || {};
    currentTriviaIndex = data.lastIndex !== undefined ? data.lastIndex : pickTriviaForToday();
    renderTrivia(data);
  });
}

function pickTriviaForToday() {
  const day = new Date().getDate();
  return day % WORLD_CUP_DATA.trivia.length;
}

// ===== TABS =====
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tabId));
}

// ===== MATCHES =====
function renderMatches(allPredictions = {}) {
  const container = document.getElementById('matches-list');
  if (!container) return;

  container.innerHTML = WORLD_CUP_DATA.matches.map(match => {
    const matchPreds = allPredictions[match.id] || {};
    const myPred = matchPreds[currentUser.id];
    const predCount = Object.keys(matchPreds).length;

    const teamData = (name) => WORLD_CUP_DATA.teams[name] || { flag: '🏳', color: '#666' };
    const homeData = teamData(match.home);
    const awayData = teamData(match.away);

    const isFinished = match.homeScore !== null && match.awayScore !== null;
    const scoreDisplay = isFinished
      ? `<span class="match-score">${match.homeScore} - ${match.awayScore}</span>`
      : `<span class="match-vs">VS</span>`;

    let myPredHtml = '';
    if (myPred) {
      const predText = myPred.result === 'home' ? `ניחוש: ${match.home}` :
                       myPred.result === 'away' ? `ניחוש: ${match.away}` : 'ניחוש: תיקו';
      let bonus = '';
      if (myPred.homeScore !== undefined) bonus = ` (${myPred.homeScore}-${myPred.awayScore})`;
      myPredHtml = `<div class="my-prediction ${isFinished && isCorrectPrediction(match, myPred) ? 'correct' : ''}">
        🎯 ${predText}${bonus} ${isFinished && isCorrectPrediction(match, myPred) ? '✅' : ''}
      </div>`;
    }

    const predCountHtml = predCount > 0
      ? `<div class="prediction-count">👥 ${predCount} ניחושים</div>` : '';

    return `
      <div class="match-card">
        <div class="match-header">
          <div class="match-meta">📅 ${formatDate(match.date)} · ${match.time} · ${match.venue}</div>
          <span class="match-group">בית ${match.group}</span>
        </div>
        <div class="match-teams">
          <div class="team-name">
            <span class="team-flag">${homeData.flag}</span>
            ${match.home}
          </div>
          ${scoreDisplay}
          <div class="team-name">
            <span class="team-flag">${awayData.flag}</span>
            ${match.away}
          </div>
        </div>
        <div class="prediction-bar">
          ${!isFinished && !myPred
            ? `<button class="btn-primary" style="padding:10px 20px;font-size:0.9rem" onclick="openPrediction('${match.id}')">🎯 נחש!</button>`
            : myPred
              ? `<button class="btn-secondary" onclick="openPrediction('${match.id}')">✏️ שנה ניחוש</button>`
              : ''
          }
        </div>
        ${myPredHtml}
        ${predCountHtml}
      </div>`;
  }).join('');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isCorrectPrediction(match, pred) {
  if (match.homeScore === null) return false;
  const actualResult = match.homeScore > match.awayScore ? 'home' :
                       match.homeScore < match.awayScore ? 'away' : 'draw';
  return pred.result === actualResult;
}

// ===== PREDICTION MODAL =====
function openPrediction(matchId) {
  const match = WORLD_CUP_DATA.matches.find(m => m.id === matchId);
  if (!match) return;
  activePredictionMatchId = matchId;

  const homeData = WORLD_CUP_DATA.teams[match.home] || { flag: '🏳' };
  const awayData = WORLD_CUP_DATA.teams[match.away] || { flag: '🏳' };

  document.getElementById('prediction-content').innerHTML = `
    <h3 style="text-align:center;margin-bottom:4px;">🎯 מי ינצח?</h3>
    <div class="prediction-teams">
      <div class="pred-team">
        <span class="flag">${homeData.flag}</span>
        <div class="name">${match.home}</div>
      </div>
      <div class="pred-vs">VS</div>
      <div class="pred-team">
        <span class="flag">${awayData.flag}</span>
        <div class="name">${match.away}</div>
      </div>
    </div>
    <div class="pred-options">
      <div class="pred-option" onclick="selectPred(this,'home')">${homeData.flag} ניצחון ${match.home}</div>
      <div class="pred-option" onclick="selectPred(this,'draw')">🤝 תיקו</div>
      <div class="pred-option" onclick="selectPred(this,'away')">${awayData.flag} ניצחון ${match.away}</div>
    </div>
    <p style="text-align:center;font-size:0.85rem;color:var(--text-muted);margin-bottom:8px;">בונוס: נחש את התוצאה המדויקת (+2 נק')</p>
    <div class="score-inputs">
      <span style="font-size:0.9rem">${match.home}</span>
      <input class="score-input" id="pred-home-score" type="number" min="0" max="20" placeholder="0" />
      <span class="score-dash">—</span>
      <input class="score-input" id="pred-away-score" type="number" min="0" max="20" placeholder="0" />
      <span style="font-size:0.9rem">${match.away}</span>
    </div>
    <button class="btn-primary pred-submit" onclick="submitPrediction()">שמור ניחוש ✓</button>
  `;

  document.getElementById('prediction-modal').classList.remove('hidden');
}

function selectPred(el, value) {
  document.querySelectorAll('.pred-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  el.dataset.value = value;
}

function submitPrediction() {
  const selected = document.querySelector('.pred-option.selected');
  if (!selected) { alert('בחר מי ינצח!'); return; }
  const result = selected.dataset.value;
  const homeScore = document.getElementById('pred-home-score').value;
  const awayScore = document.getElementById('pred-away-score').value;

  const predData = {
    result,
    name: currentUser.name,
    timestamp: Date.now(),
    ...(homeScore !== '' && awayScore !== '' ? { homeScore: +homeScore, awayScore: +awayScore } : {})
  };

  if (db) {
    db.ref(`predictions/${activePredictionMatchId}/${currentUser.id}`).set(predData);
  }
  closePredictionModal();
}

function closePredictionModal() {
  document.getElementById('prediction-modal').classList.add('hidden');
}

// ===== LEADERBOARD =====
function renderLeaderboard(users) {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  const sorted = Object.entries(users)
    .map(([id, u]) => ({ id, ...u }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="emoji">🏅</div><p>אין משתתפים עדיין — שתף עם הכיתה!</p></div>`;
    return;
  }

  const rankIcon = (i) => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
  const rankClass = (i) => i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';

  container.innerHTML = sorted.map((u, i) => `
    <div class="leaderboard-entry ${u.id === currentUser.id ? 'me' : ''}">
      <div class="rank ${rankClass(i)}">${rankIcon(i)}</div>
      <div class="player-info">
        <div class="player-name">${u.name} ${u.id === currentUser.id ? '← אני' : ''}</div>
        <div class="player-stats">✅ ${u.correctPredictions || 0} ניחושים נכונים · 🎯 ${u.triviaCorrect || 0} חידות</div>
      </div>
      <div class="player-score">${u.score || 0}<span style="font-size:0.7rem;font-weight:400"> נק'</span></div>
    </div>
  `).join('');
}

function renderLeaderboardDemo() {
  renderLeaderboard({
    demo1: { name: 'מצב הדגמה', score: 7, correctPredictions: 2, triviaCorrect: 1 },
    [currentUser.id]: { name: currentUser.name, score: 0, correctPredictions: 0, triviaCorrect: 0 },
  });
}

// ===== TEAMS =====
function renderTeams() {
  const container = document.getElementById('teams-grid');
  if (!container) return;

  const html = Object.entries(WORLD_CUP_DATA.teams).map(([name, team]) => `
    <div class="team-card" onclick="openTeamModal('${name}')">
      <span class="flag">${team.flag}</span>
      <div class="name">${name}</div>
      <div class="strength-bar-wrap">
        <div class="strength-bar" style="width:${team.strength}%"></div>
      </div>
    </div>
  `).join('');

  container.innerHTML = `<div class="teams-grid">${html}</div>`;
}

function openTeamModal(name) {
  const team = WORLD_CUP_DATA.teams[name];
  if (!team) return;
  document.getElementById('modal-content').innerHTML = `
    <div class="modal-flag">${team.flag}</div>
    <div class="modal-team-name">${name}</div>
    <div class="modal-stat"><span class="modal-stat-label">⭐ כוכב</span><span class="modal-stat-value">${team.starPlayer}</span></div>
    <div class="modal-stat"><span class="modal-stat-label">👨‍💼 מאמן</span><span class="modal-stat-value">${team.coach}</span></div>
    <div class="modal-stat"><span class="modal-stat-label">🏆 תארים</span><span class="modal-stat-value">${team.titles}</span></div>
    <div class="modal-stat"><span class="modal-stat-label">💪 עוצמה</span><span class="modal-stat-value">${team.strength}/100</span></div>
    <div class="modal-fact">💡 ${team.funFact}</div>
  `;
  document.getElementById('team-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('team-modal').classList.add('hidden');
}

// ===== TRIVIA =====
function renderTrivia(answeredData = {}) {
  const container = document.getElementById('trivia-container');
  if (!container) return;

  const todayKey = new Date().toISOString().slice(0, 10);

  if (answeredData[todayKey] !== undefined) {
    const wasCorrect = answeredData[todayKey];
    container.innerHTML = `
      <div class="trivia-already">
        <div style="font-size:3rem">${wasCorrect ? '🎉' : '😅'}</div>
        <p>${wasCorrect ? 'ענית נכון על חידת היום! +1 נקודה' : 'לא הצלחת היום — בוא מחר!'}</p>
        <p style="margin-top:12px;font-size:0.85rem;color:var(--text-muted)">חידה חדשה מחר 🌟</p>
      </div>
    `;
    return;
  }

  const q = WORLD_CUP_DATA.trivia[currentTriviaIndex];
  container.innerHTML = `
    <div class="trivia-card">
      <div class="trivia-progress">שאלה ${currentTriviaIndex + 1} מתוך ${WORLD_CUP_DATA.trivia.length}</div>
      <div class="trivia-question">❓ ${q.q}</div>
      <div class="trivia-options">
        ${q.options.map((opt, i) => `
          <button class="trivia-option" onclick="answerTrivia(${i}, ${q.answer})">${opt}</button>
        `).join('')}
      </div>
      <div id="trivia-result" class="trivia-result"></div>
    </div>
  `;
}

function answerTrivia(chosen, correct) {
  const options = document.querySelectorAll('.trivia-option');
  const isCorrect = chosen === correct;
  const todayKey = new Date().toISOString().slice(0, 10);

  options.forEach((opt, i) => {
    opt.classList.add('disabled');
    opt.onclick = null;
    if (i === correct) opt.classList.add('correct');
    else if (i === chosen && !isCorrect) opt.classList.add('wrong');
  });

  document.getElementById('trivia-result').textContent = isCorrect ? '🎉 נכון! +1 נקודה' : '❌ לא נכון';
  document.getElementById('trivia-result').className = 'trivia-result ' + (isCorrect ? 'win' : 'lose');

  if (db) {
    triviaAnsweredRef.update({ [todayKey]: isCorrect, lastIndex: currentTriviaIndex });
    if (isCorrect) {
      usersRef.transaction(u => {
        if (!u) return u;
        return { ...u, score: (u.score || 0) + 1, triviaCorrect: (u.triviaCorrect || 0) + 1 };
      });
    }
  }
}
