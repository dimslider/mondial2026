// שכבת אחסון: Firebase אם הוגדר, אחרת localStorage (מצב הדגמה).
// leads       — פניות של מטופלים לגופים ("אני מתעניין/ת")
// submissions — גופים שמציעים את עצמם, ממתינים לאישור
// approved    — הצעות שאושרו ומוצגות בלוח לצד המאגר המחקרי
(function () {
  const LS_KEY = "vh-store-v1";
  let db = null, auth = null;

  if (window.firebaseConfig && window.firebase) {
    try {
      firebase.initializeApp(window.firebaseConfig);
      db = firebase.database();
      auth = firebase.auth ? firebase.auth() : null;
    } catch (e) {
      console.warn("Firebase init failed, falling back to local mode", e);
      db = null;
    }
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
  }
  function writeLocal(state) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
  }
  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function push(path, obj) {
    const rec = Object.assign({}, obj, { createdAt: Date.now() });
    if (db) {
      const ref = db.ref(path).push();
      await ref.set(rec);
      return ref.key;
    }
    const s = readLocal();
    s[path] = s[path] || {};
    const id = newId();
    s[path][id] = rec;
    writeLocal(s);
    return id;
  }

  async function list(path) {
    if (db) {
      const snap = await db.ref(path).once("value");
      const v = snap.val() || {};
      return Object.keys(v).map(k => Object.assign({ _id: k }, v[k]));
    }
    const v = readLocal()[path] || {};
    return Object.keys(v).map(k => Object.assign({ _id: k }, v[k]));
  }

  async function set(path, id, obj) {
    if (db) return db.ref(path + "/" + id).set(obj);
    const s = readLocal();
    s[path] = s[path] || {};
    s[path][id] = obj;
    writeLocal(s);
  }

  async function remove(path, id) {
    if (db) return db.ref(path + "/" + id).remove();
    const s = readLocal();
    if (s[path]) delete s[path][id];
    writeLocal(s);
  }

  async function update(path, id, patch) {
    if (db) return db.ref(path + "/" + id).update(patch);
    const s = readLocal();
    if (s[path] && s[path][id]) Object.assign(s[path][id], patch);
    writeLocal(s);
  }

  async function signIn(email, password) {
    if (!auth) return { local: true };
    return auth.signInWithEmailAndPassword(email, password);
  }

  function isAdminReady() {
    if (!db) return true;                 // במצב מקומי אין הרשאות — רק הדפדפן הזה רואה את הנתונים
    return !!(auth && auth.currentUser);
  }

  window.Store = {
    mode: db ? "cloud" : "local",
    addLead: obj => push("leads", obj),
    addSubmission: obj => push("submissions", obj),
    listLeads: () => list("leads"),
    listSubmissions: () => list("submissions"),
    listApproved: () => list("approved").catch(() => []),
    approve: async (sub) => {
      const clean = Object.assign({}, sub);
      delete clean._id;
      clean.source = "provider";
      clean.approvedAt = Date.now();
      await set("approved", sub._id, clean);
      await update("submissions", sub._id, { status: "approved" });
    },
    reject: id => update("submissions", id, { status: "rejected" }),
    unpublish: id => remove("approved", id),
    markLead: (id, status) => update("leads", id, { status }),
    signIn,
    isAdminReady,
    onAuth: cb => { if (auth) auth.onAuthStateChanged(cb); else cb(null); }
  };
})();
