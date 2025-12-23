import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* Xmas Hunt 2025
   - Name locks after first save
   - Shared leaderboard & progress via Supabase (anonymous auth)
   - Realtime updates via Postgres Changes subscription
   - Local fallback still works if Supabase keys are left blank
*/

(() => {
  const STORAGE_KEY = "xmasHunt2025_state_v3";

  // =========================
  // SUPABASE CONFIG (EDIT THIS)
  // =========================
  const SUPABASE_URL = "https://vgbqlreurvigkxfyibol.supabase.co";      // <-- paste your project URL
  const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY_HERE";                  // <-- paste your anon key

  // Optional: allow turning backend on/off without removing keys
  const REMOTE_ENABLED = (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("PASTE_"));

  // =========================
  // HINT TIMERS (EDIT THIS)
  // =========================
  const HINT_UNLOCK_MINUTES = [60, 120, 180]; // Hint 1/2/3 unlock times after clue unlock

  // =========================
  // PATH UNLOCK CODES (EDIT THIS)
  // =========================
  const PATH_UNLOCK_CODES = {
    main: "CHRISTMAS2025",
    blue: "BLUE2025",
    purple: "PURPLE2025",
    orange: "ORANGE2025",
    white: "WHITE2025"
  };

  // =========================
  // PASSCODES PER CLUE (EDIT THIS)
  // =========================
  // IMPORTANT: each clue ID below must match the clue IDs in ALL_CLUES.
  const PASSCODES = {
    // MAIN (20)
    "main_01": "PASS1",
    "main_02": "PASS2",
    "main_03": "PASS3",
    "main_04": "PASS4",
    "main_05": "PASS5",
    "main_06": "PASS6",
    "main_07": "PASS7",
    "main_08": "PASS8",
    "main_09": "PASS9",
    "main_10": "PASS10",
    "main_11": "PASS11",
    "main_12": "PASS12",
    "main_13": "PASS13",
    "main_14": "PASS14",
    "main_15": "PASS15",
    "main_16": "PASS16",
    "main_17": "PASS17",
    "main_18": "PASS18",
    "main_19": "PASS19",
    "main_20": "PASS20",

    // BLUE (6)
    "blue_01": "BLUE1",
    "blue_02": "BLUE2",
    "blue_03": "BLUE3",
    "blue_04": "BLUE4",
    "blue_05": "BLUE5",
    "blue_06": "BLUE6",

    // PURPLE (5)
    "purple_01": "PURPLE1",
    "purple_02": "PURPLE2",
    "purple_03": "PURPLE3",
    "purple_04": "PURPLE4",
    "purple_05": "PURPLE5",

    // ORANGE (4)
    "orange_01": "ORANGE1",
    "orange_02": "ORANGE2",
    "orange_03": "ORANGE3",
    "orange_04": "ORANGE4",

    // WHITE (3)
    "white_01": "WHITE1",
    "white_02": "WHITE2",
    "white_03": "WHITE3",

    // GOLD FINAL (1)
    "gold_final": "GOLD2025"
  };

  // =========================
  // CLUES DATA (EDIT THIS)
  // =========================
  // Each clue has: id, path, label, clueText, hints[3], colorDotClass
  const ALL_CLUES = [
    // ===== MAIN (20) =====
    { id:"main_01", path:"main", label:"Clue 1", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_02", path:"main", label:"Clue 2", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_03", path:"main", label:"Clue 3", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_04", path:"main", label:"Clue 4", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_05", path:"main", label:"Clue 5", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_06", path:"main", label:"Clue 6", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_07", path:"main", label:"Clue 7", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_08", path:"main", label:"Clue 8", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_09", path:"main", label:"Clue 9", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_10", path:"main", label:"Clue 10", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_11", path:"main", label:"Clue 11", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_12", path:"main", label:"Clue 12", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_13", path:"main", label:"Clue 13", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_14", path:"main", label:"Clue 14", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_15", path:"main", label:"Clue 15", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_16", path:"main", label:"Clue 16", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_17", path:"main", label:"Clue 17", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_18", path:"main", label:"Clue 18", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_19", path:"main", label:"Clue 19", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },
    { id:"main_20", path:"main", label:"Clue 20", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"redGreen" },

    // ===== BLUE (6) =====
    { id:"blue_01", path:"blue", label:"Clue 1", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"blue" },
    { id:"blue_02", path:"blue", label:"Clue 2", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"blue" },
    { id:"blue_03", path:"blue", label:"Clue 3", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"blue" },
    { id:"blue_04", path:"blue", label:"Clue 4", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"blue" },
    { id:"blue_05", path:"blue", label:"Clue 5", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"blue" },
    { id:"blue_06", path:"blue", label:"Clue 6", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"blue" },

    // ===== PURPLE (5) =====
    { id:"purple_01", path:"purple", label:"Clue 1", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"purple" },
    { id:"purple_02", path:"purple", label:"Clue 2", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"purple" },
    { id:"purple_03", path:"purple", label:"Clue 3", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"purple" },
    { id:"purple_04", path:"purple", label:"Clue 4", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"purple" },
    { id:"purple_05", path:"purple", label:"Clue 5", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"purple" },

    // ===== ORANGE (4) =====
    { id:"orange_01", path:"orange", label:"Clue 1", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"orange" },
    { id:"orange_02", path:"orange", label:"Clue 2", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"orange" },
    { id:"orange_03", path:"orange", label:"Clue 3", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"orange" },
    { id:"orange_04", path:"orange", label:"Clue 4", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"orange" },

    // ===== WHITE (3) =====
    { id:"white_01", path:"white", label:"Clue 1", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"white" },
    { id:"white_02", path:"white", label:"Clue 2", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"white" },
    { id:"white_03", path:"white", label:"Clue 3", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"white" },

    // ===== GOLD FINAL (1) =====
    { id:"gold_final", path:"gold", label:"Gold Clue (Grand Prize)", clueText:"(edit)", hints:["(edit)","(edit)","(edit)"], colorDotClass:"gold" }
  ];

  // =========================
  // MUSIC PLAYLIST (EDIT THIS)
  // =========================
  const MUSIC_PLAYLIST = [
    { title: "All I Want For Christmas Is You by Mariah Carey", file: "./assets/All I Want For Christmas Is You.mp3" },
    { title: "Christmas Track 2", file: "./assets/music2.mp3" },
    { title: "Christmas Track 3", file: "./assets/music3.mp3" }
  ];

  // ===== Utilities =====
  const now = () => Date.now();
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const randChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const escapeHtml = (s) => (s ?? "").toString().replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));

  function defaultState(){
    const clues = {};
    for (const c of ALL_CLUES){
      clues[c.id] = { unlocked:false, solved:false, unlockedAt:null };
    }
    return {
      playerName: "",
      nameLocked: false,
      pathUnlockUsed: { main:false, blue:false, purple:false, orange:false, white:false },
      clues,
      music: { enabled:true, currentIndex:0, playing:true, shuffleSeed: now() }
    };
  }

  function loadState(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      // merge with defaults (in case new fields were added)
      const d = defaultState();
      return {
        ...d,
        ...parsed,
        pathUnlockUsed: { ...d.pathUnlockUsed, ...(parsed.pathUnlockUsed||{}) },
        clues: { ...d.clues, ...(parsed.clues||{}) },
        music: { ...d.music, ...(parsed.music||{}) }
      };
    }catch{
      return defaultState();
    }
  }

  function saveState(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (REMOTE_ENABLED) queueRemoteUpsert();
  }

  // ===== Remote (Supabase) =====
  const supabase = REMOTE_ENABLED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  let remoteReady = false;
  let remoteTimer = null;
  let remoteSub = null;

  async function ensureSignedIn(){
    if (!supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (session) return;
    await supabase.auth.signInAnonymously();
  }

  async function initRemoteIfEnabled(){
    if (!supabase) return;
    await ensureSignedIn();
    remoteReady = true;

    // Realtime subscription on players table
    try{
      remoteSub = supabase
        .channel("players-changes")
        .on("postgres_changes", { event:"*", schema:"public", table:"players" }, () => {
          fetchLeaderboard();
        })
        .subscribe();
    }catch{}

    fetchLeaderboard();
  }

  // ===== DOM Refs =====
  const playerNameInput = document.getElementById("playerNameInput");
  const saveNameBtn = document.getElementById("saveNameBtn");

  const unlockMainInput = document.getElementById("unlockMainInput");
  const unlockMainBtn = document.getElementById("unlockMainBtn");
  const unlockBlueInput = document.getElementById("unlockBlueInput");
  const unlockBlueBtn = document.getElementById("unlockBlueBtn");
  const unlockPurpleInput = document.getElementById("unlockPurpleInput");
  const unlockPurpleBtn = document.getElementById("unlockPurpleBtn");
  const unlockOrangeInput = document.getElementById("unlockOrangeInput");
  const unlockOrangeBtn = document.getElementById("unlockOrangeBtn");
  const unlockWhiteInput = document.getElementById("unlockWhiteInput");
  const unlockWhiteBtn = document.getElementById("unlockWhiteBtn");

  const lbTabs = document.getElementById("lbTabs");
  const leaderboardEl = document.getElementById("leaderboard");
  const refreshLeaderboardBtn = document.getElementById("refreshLeaderboardBtn");

  const quickLinksEl = document.getElementById("quickLinks");
  const cluesRoot = document.getElementById("cluesRoot");

  const musicDrawer = document.getElementById("musicDrawer");
  const musicOpenBtn = document.getElementById("musicOpenBtn");
  const musicCloseBtn = document.getElementById("musicCloseBtn");
  const musicEnabled = document.getElementById("musicEnabled");
  const musicPrevBtn = document.getElementById("musicPrevBtn");
  const musicPlayPauseBtn = document.getElementById("musicPlayPauseBtn");
  const musicNextBtn = document.getElementById("musicNextBtn");
  const musicList = document.getElementById("musicList");

  const rulesModal = document.getElementById("rulesModal");
  const rulesOpenBtn = document.getElementById("rulesOpenBtn");
  const rulesCloseBtn = document.getElementById("rulesCloseBtn");

  const bgm = document.getElementById("bgm");
  const sfxUnlock = document.getElementById("sfxUnlock");
  const sfxWinner = document.getElementById("sfxWinner");

  // Notify / Winner popup modal
  const notifyModal = document.getElementById("notifyModal");
  const notifyTitle = document.getElementById("notifyTitle");
  const notifyBody = document.getElementById("notifyBody");
  const notifyOkBtn = document.getElementById("notifyOkBtn");
  const notifyCloseBtn = document.getElementById("notifyCloseBtn");
  const notifyConfetti = document.getElementById("notifyConfetti");

  function openNotifyModal() {
    notifyModal.classList.add("modal--open");
    notifyModal.setAttribute("aria-hidden", "false");
  }

  function closeNotifyModal() {
    notifyModal.classList.remove("modal--open");
    notifyModal.setAttribute("aria-hidden", "true");
    // stop/clear confetti
    notifyConfetti.innerHTML = "";
    notifyConfetti.classList.remove("confetti--on");
    notifyModal.classList.remove("notifyWinner");
  }

  notifyOkBtn.addEventListener("click", closeNotifyModal);
  notifyCloseBtn.addEventListener("click", closeNotifyModal);
  notifyModal.addEventListener("click", (e) => {
    if (e.target === notifyModal) closeNotifyModal();
  });

  function clueLabelById(clueId) {
    const c = ALL_CLUES.find(x => x.id === clueId);
    return c?.label || clueId;
  }

  function showUnlockedPopup(unlockedId) {
    notifyTitle.textContent = "Unlocked!";
    notifyBody.textContent = `You unlocked ${clueLabelById(unlockedId)}.`;
    notifyOkBtn.textContent = "Back to Interface";
    openNotifyModal();
  }

  function buildConfetti(count = 44) {
    notifyConfetti.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "confettiPiece";
      p.style.setProperty("--x", `${Math.random() * 100}%`);
      p.style.setProperty("--delay", `${Math.random() * 1.6}s`);
      p.style.setProperty("--dur", `${2.2 + Math.random() * 1.8}s`);
      p.style.setProperty("--rot", `${Math.floor(Math.random() * 360)}deg`);
      p.style.setProperty("--hue", `${Math.floor(Math.random() * 360)}`);
      notifyConfetti.appendChild(p);
    }
    notifyConfetti.classList.add("confetti--on");
  }

  function showWinnerPopup(which) {
    const map = {
      blue: "Blue Winner!!",
      purple: "Purple Winner!!",
      orange: "Orange Winner!!",
      white: "White Winner!!",
      gold: "Grand Prize Winner!!"
    };
    notifyTitle.textContent = "Congratulations!!!";
    notifyBody.textContent = `You're the ${map[which] || "Winner!!"}`;
    notifyOkBtn.textContent = "Acknowledge";
    notifyModal.classList.add("notifyWinner");
    buildConfetti();
    openNotifyModal();
  }

  // ===== State =====
  let state = loadState();

  // ===== Leaderboard UI =====
  const TAB_ORDER = ["Main","Blue","Purple","Orange","White","Gold"];
  let activeTab = "Main";
  let leaderboardData = [];

  // ===== Render Helpers =====
  function clueIdsByPath(path){
    return ALL_CLUES.filter(c => c.path === path).map(c => c.id);
  }
  function solvedCount(path){
    return clueIdsByPath(path).filter(id => state.clues[id]?.solved).length;
  }
  function unlockedCount(path){
    return clueIdsByPath(path).filter(id => state.clues[id]?.unlocked).length;
  }

  function lastClueId(path){
    const ids = clueIdsByPath(path);
    return ids[ids.length - 1] || null;
  }

  function eligibleRandomClueIds(path){
    const ids = clueIdsByPath(path);
    const last = lastClueId(path);
    // Random unlocks should never pick the last clue unless allowed by rules
    return ids.filter(id => {
      if (id === last) return false;
      const cs = state.clues[id];
      return !cs.unlocked;
    });
  }

  function canUnlockLastClue(path){
    const last = lastClueId(path);
    if (!last) return false;
    // Rule: last clue unlocks only after all prior in that path are solved
    const ids = clueIdsByPath(path);
    const prior = ids.slice(0, -1);
    return prior.every(id => state.clues[id].solved);
  }

  function isGoldUnlockedByRules(){
    // Gold unlocks after all 20 main clues are solved
    const mainIds = clueIdsByPath("main");
    return mainIds.length > 0 && mainIds.every(id => state.clues[id].solved);
  }

  function unlockClue(id) {
    const cs = state.clues[id];
    if (!cs || cs.unlocked) return;

    cs.unlocked = true;
    cs.unlockedAt = now();
    saveState();

    try {
      sfxUnlock.currentTime = 0;
      sfxUnlock.play().catch(() => {});
    } catch {}

    renderAll();
  }

  function unlockRandomInPath(path) {
    const eligible = eligibleRandomClueIds(path);
    if (eligible.length > 0) {
      const picked = randChoice(eligible);
      unlockClue(picked);
      return picked;
    }
    if (canUnlockLastClue(path)) {
      const lastId = lastClueId(path);
      if (lastId && !state.clues[lastId].unlocked) {
        unlockClue(lastId);
        return lastId;
      }
    }
    return null;
  }

  function solveClue(id, enteredPass) {
    const cs = state.clues[id];
    if (!cs?.unlocked || cs.solved) return { ok:false, msg:"Clue not unlocked (or already solved)." };

    const expected = PASSCODES[id] ?? "";
    if ((enteredPass || "").trim() !== expected.trim()) {
      return { ok:false, msg:"Incorrect passcode." };
    }

    // determine if this is a "final" win clue (side paths final clue or gold final)
    const meta = ALL_CLUES.find(c => c.id === id);
    const path = meta?.path ?? "";
    const isSideFinal = ["blue","purple","orange","white"].includes(path) && id === lastClueId(path);
    const isGoldFinal = id === "gold_final";

    cs.solved = true;

    // Track whether gold just became unlocked (so we can announce it)
    const goldWasUnlocked = !!state.clues["gold_final"]?.unlocked;

    saveState();

    if (isGoldFinal || isSideFinal) {
      // Winner flow (no "unlocked next clue" popup)
      renderAll();
      try {
        sfxWinner.currentTime = 0;
        sfxWinner.play().catch(() => {});
      } catch {}
      showWinnerPopup(isGoldFinal ? "gold" : path);
      return { ok:true, msg:"Solved!" };
    }

    // Normal flow: solve -> unlock next clue (random or final-in-path as rules allow)
    let unlockedId = null;

    if (path === "main") {
      unlockedId = unlockRandomInPath("main");
      if (!goldWasUnlocked && isGoldUnlockedByRules()) {
        unlockClue("gold_final");
      }
    } else if (["blue","purple","orange","white"].includes(path)) {
      unlockedId = unlockRandomInPath(path);
    }

    // If gold unlocked because the main path completed, announce it.
    const goldNowUnlocked = !!state.clues["gold_final"]?.unlocked;
    if (!goldWasUnlocked && goldNowUnlocked) {
      unlockedId = "gold_final";
    }

    renderAll();

    if (unlockedId) {
      showUnlockedPopup(unlockedId);
    }

    return { ok:true, msg:"Solved!" };
  }

  function msToClock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  function hintCountdownInfo(clueId, hintIndex) {
    const cs = state.clues[clueId];
    if (!cs?.unlockedAt) return { unlocked:false, remainingText:"--:--" };
    const unlockAt = cs.unlockedAt + (HINT_UNLOCK_MINUTES[hintIndex] * 60 * 1000);
    const remaining = unlockAt - now();
    return remaining <= 0
      ? { unlocked:true, remainingText:"00:00" }
      : { unlocked:false, remainingText: msToClock(remaining) };
  }

  // ===== Music =====
  function openMusicDrawer(){
    musicDrawer.classList.add("drawer--open");
    musicDrawer.setAttribute("aria-hidden","false");
  }
  function closeMusicDrawer(){
    musicDrawer.classList.remove("drawer--open");
    musicDrawer.setAttribute("aria-hidden","true");
  }

  function syncMusicUI(){
    musicEnabled.checked = !!state.music.enabled;
    musicPlayPauseBtn.textContent = state.music.playing ? "⏸" : "▶";
    renderMusicList();
  }

  function setMusicIndex(i){
    state.music.currentIndex = clamp(i, 0, MUSIC_PLAYLIST.length - 1);
    saveState();
    playCurrentTrack();
    syncMusicUI();
  }

  function playCurrentTrack(){
    if (!state.music.enabled) return;

    const track = MUSIC_PLAYLIST[state.music.currentIndex];
    if (!track) return;

    if (bgm.src !== new URL(track.file, location.href).href) {
      bgm.src = track.file;
    }
    bgm.loop = false;

    if (state.music.playing){
      bgm.play().catch(() => {});
    } else {
      bgm.pause();
    }
  }

  function shuffleNext(){
    if (MUSIC_PLAYLIST.length <= 1){
      setMusicIndex(0);
      return;
    }
    let next = state.music.currentIndex;
    while (next === state.music.currentIndex){
      next = Math.floor(Math.random() * MUSIC_PLAYLIST.length);
    }
    setMusicIndex(next);
  }

  function renderMusicList(){
    musicList.innerHTML = "";
    MUSIC_PLAYLIST.forEach((t, idx) => {
      const item = document.createElement("div");
      item.className = "musicItem" + (idx === state.music.currentIndex ? " musicItem--active" : "");
      item.innerHTML = `
        <div>
          <div class="musicItemTitle">${escapeHtml(t.title)}</div>
          <div class="musicItemSub">${idx === state.music.currentIndex ? (state.music.playing ? "Playing" : "Paused") : "Tap to select"}</div>
        </div>
        <button class="btn btn--ghost musicItemBtn" type="button">${idx === state.music.currentIndex ? "✓" : "▶"}</button>
      `;
      item.addEventListener("click", () => {
        state.music.playing = true;
        setMusicIndex(idx);
      });
      musicList.appendChild(item);
    });
  }

  bgm.addEventListener("ended", () => {
    if (!state.music.enabled) return;
    shuffleNext();
  });

  // ===== Rules Modal =====
  function openRules(){
    rulesModal.classList.add("modal--open");
    rulesModal.setAttribute("aria-hidden","false");
  }
  function closeRules(){
    rulesModal.classList.remove("modal--open");
    rulesModal.setAttribute("aria-hidden","true");
  }

  // ===== Path Titles =====
  const PATH_META = {
    main: { title:"Main Path (Red/Green Ornaments)", sub:"Solve 20 clues to unlock the Gold ornament." },
    blue: { title:"Blue Path", sub:"Optional path with extra prizes." },
    purple: { title:"Purple Path", sub:"Optional path with extra prizes." },
    orange: { title:"Orange Path", sub:"Optional path with extra prizes." },
    white: { title:"White Path", sub:"Optional path with extra prizes." },
    gold: { title:"Gold (Grand Prize)", sub:"Unlocked after Main Path is complete." }
  };

  // ===== Render Clues =====
  function renderPathSection(path){
    const meta = PATH_META[path];
    const section = document.createElement("div");
    section.className = "pathHeader";
    section.id = `section-${path}`;

    const total = clueIdsByPath(path).length;
    const solved = solvedCount(path);

    section.innerHTML = `
      <div class="pathTitleRow">
        <div>
          <h2 class="pathTitle">${escapeHtml(meta.title)}</h2>
          <div class="pathSub">${escapeHtml(meta.sub)}</div>
        </div>
        <div class="pathSolvedPill">${solved}/${total}<br/>solved</div>
      </div>
    `;

    const ids = clueIdsByPath(path);
    ids.forEach(id => {
      const c = ALL_CLUES.find(x => x.id === id);
      section.appendChild(renderClueCard(c));
    });

    return section;
  }

  function renderClueCard(c) {
    const cs = state.clues[c.id];
    const unlocked = !!cs?.unlocked;
    const solved = !!cs?.solved;

    const card = document.createElement("div");
    card.className = "ornament";

    const statusBadge = solved
      ? `<span class="badge badge--solved">Solved</span>`
      : unlocked
        ? `<span class="badge badge--unlocked">Unlocked</span>`
        : `<span class="badge badge--locked">Locked</span>`;

    card.innerHTML = `
      <div class="ornamentTop">
        <div class="ornamentTitle">
          <span class="tagDot ${c.colorDotClass}"></span>${escapeHtml(c.label)}
        </div>
        ${statusBadge}
      </div>

      <div class="ornamentBody">
        <div class="clueText ${unlocked ? "" : "lockedText"}">
          ${unlocked ? escapeHtml(c.clueText) : "Locked — unlock this ornament to view the clue."}
        </div>

        <div class="hints">
          ${[0,1,2].map(i => {
            if (!unlocked) {
              return `
                <div class="hint">
                  <div class="hintTitle">Hint ${i+1}</div>
                  <div class="hintBody">Locked — unlock this clue first.</div>
                </div>
              `;
            }

            const info = hintCountdownInfo(c.id, i);
            if (info.unlocked) {
              return `
                <div class="hint">
                  <div class="hintTitle">Hint ${i+1}</div>
                  <div class="hintBody">${escapeHtml(c.hints[i])}</div>
                </div>
              `;
            }

            return `
              <div class="hint">
                <div class="hintTitle">Hint ${i+1}</div>
                <div class="hintBody">
                  <div class="hintLockedLine">
                    <span>Unlocks in:</span>
                    <span class="countdown"
                          data-countdown="1"
                          data-clue="${escapeHtml(c.id)}"
                          data-hint-index="${i}">
                      ${info.remainingText}
                    </span>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>

        <div class="ornamentControls">
          ${renderPasscodeControls(c, unlocked, solved)}
        </div>

        <div class="smallNote">
          ${unlocked && cs?.unlockedAt ? `Unlocked at: ${new Date(cs.unlockedAt).toLocaleTimeString()}` : ""}
        </div>
      </div>
    `;

    const solveBtn = card.querySelector(`[data-solve="${c.id}"]`);
    const passInput = card.querySelector(`[data-pass="${c.id}"]`);
    const msgEl = card.querySelector(`[data-msg="${c.id}"]`);

    if (solveBtn && passInput && msgEl) {
      solveBtn.addEventListener("click", () => {
        const res = solveClue(c.id, passInput.value);
        msgEl.textContent = res.msg;
        msgEl.style.color = res.ok ? "rgba(80,255,160,.9)" : "rgba(255,140,140,.9)";
      });
    }

    return card;
  }

  function renderPasscodeControls(c, unlocked, solved) {
    if (c.id === "gold_final") {
      if (!unlocked) return `<div class="labelSub">Gold clue unlocks after all 20 Main Path clues are solved.</div>`;
      if (solved) return `<div class="labelStrong">Solved.</div>`;
      return `
        <input class="input" data-pass="${c.id}" type="text" placeholder="Enter passcode to solve" />
        <button class="btn btn--primary" data-solve="${c.id}" type="button">Submit</button>
        <span class="labelSub" data-msg="${c.id}"></span>
      `;
    }

    if (!unlocked) return `<div class="labelSub">Passcode box appears after this clue is unlocked.</div>`;
    if (solved) return `<div class="labelStrong">Solved.</div>`;

    return `
      <input class="input" data-pass="${c.id}" type="text" placeholder="Enter passcode to solve" />
      <button class="btn btn--primary" data-solve="${c.id}" type="button">Submit</button>
      <span class="labelSub" data-msg="${c.id}"></span>
    `;
  }

  function renderAll() {
    unlockMainBtn.disabled = state.pathUnlockUsed.main;
    unlockBlueBtn.disabled = state.pathUnlockUsed.blue;
    unlockPurpleBtn.disabled = state.pathUnlockUsed.purple;
    unlockOrangeBtn.disabled = state.pathUnlockUsed.orange;
    unlockWhiteBtn.disabled = state.pathUnlockUsed.white;

    playerNameInput.value = state.playerName || "";
    if (state.nameLocked) {
      playerNameInput.disabled = true;
      saveNameBtn.disabled = true;
    } else {
      playerNameInput.disabled = false;
      saveNameBtn.disabled = false;
    }

    renderTabs();
    renderLeaderboard();
    renderQuickLinks();
    renderClues();

    syncMusicUI();
  }

  function renderTabs(){
    lbTabs.innerHTML = "";
    TAB_ORDER.forEach(name => {
      const t = document.createElement("div");
      t.className = "tab" + (name === activeTab ? " tab--active" : "");
      t.textContent = name;
      t.addEventListener("click", () => {
        activeTab = name;
        renderTabs();
        renderLeaderboard();
      });
      lbTabs.appendChild(t);
    });
  }

  function renderLeaderboard(){
    leaderboardEl.innerHTML = "";

    const rows = leaderboardData.length ? leaderboardData : [{
      name: state.playerName || "You",
      main_solved: solvedCount("main"),
      blue_solved: solvedCount("blue"),
      purple_solved: solvedCount("purple"),
      orange_solved: solvedCount("orange"),
      white_solved: solvedCount("white"),
      gold_unlocked: state.clues["gold_final"]?.unlocked ? true : false
    }];

    // Sort by Main progress first
    rows.sort((a,b) => (b.main_solved||0) - (a.main_solved||0));

    rows.forEach(p => {
      const row = document.createElement("div");
      row.className = "lbRow";

      row.innerHTML = `
        <div class="lbTop">
          <div class="lbName">${escapeHtml(p.name)}</div>
          <div class="lbScore">${p.main_solved || 0}/20</div>
        </div>

        <div class="lbBars">
          ${renderBarLine("Main", "red", p.main_solved||0, 20)}
          ${renderBarLine("Blue", "blue", p.blue_solved||0, 6)}
          ${renderBarLine("Purple", "purple", p.purple_solved||0, 5)}
          ${renderBarLine("Orange", "orange", p.orange_solved||0, 4)}
          ${renderBarLine("White", "white", p.white_solved||0, 3)}
          <div class="barLine">
            <span class="dot gold"></span>
            <div class="barLabel">Gold:</div>
            <div class="barLabel">${p.gold_unlocked ? "Unlocked" : "Locked"} &nbsp;&nbsp; ${REMOTE_ENABLED ? "Shared" : ""}</div>
            <div class="barLabel"></div>
          </div>
        </div>
      `;

      leaderboardEl.appendChild(row);
    });
  }

  function renderBarLine(label, dotClass, n, total){
    const pct = total ? (n/total)*100 : 0;
    return `
      <div class="barLine">
        <span class="dot ${dotClass}"></span>
        <div class="barLabel">${label}</div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div class="barLabel">${n}/${total}</div>
      </div>
    `;
  }

  function renderQuickLinks(){
    quickLinksEl.innerHTML = "";
    ["main","blue","purple","orange","white","gold"].forEach(p => {
      const b = document.createElement("button");
      b.className = "chip";
      b.type = "button";
      b.textContent = p[0].toUpperCase() + p.slice(1);
      b.addEventListener("click", () => {
        document.getElementById(`section-${p}`)?.scrollIntoView({ behavior:"smooth", block:"start" });
      });
      quickLinksEl.appendChild(b);
    });
  }

  function renderClues(){
    cluesRoot.innerHTML = "";
    ["main","blue","purple","orange","white","gold"].forEach(p => {
      cluesRoot.appendChild(renderPathSection(p));
    });
  }

  // ===== Countdown Ticker =====
  setInterval(() => {
    const els = document.querySelectorAll("[data-countdown='1']");
    els.forEach(el => {
      const clueId = el.getAttribute("data-clue");
      const hintIndex = Number(el.getAttribute("data-hint-index")||0);
      const info = hintCountdownInfo(clueId, hintIndex);
      el.textContent = info.remainingText;
      if (info.unlocked) renderAll();
    });
  }, 1000);

  // ===== Player Name =====
  saveNameBtn.addEventListener("click", () => {
    const name = (playerNameInput.value||"").trim();
    if (!name) return;

    state.playerName = name;
    state.nameLocked = true;
    saveState();
    if (REMOTE_ENABLED) queueRemoteUpsert(true);
    renderAll();
  });

  // ===== Unlock Buttons =====
  function handlePathUnlock(path, inputEl){
    const code = (inputEl.value||"").trim();
    if (code !== PATH_UNLOCK_CODES[path]) {
      inputEl.value = "";
      inputEl.placeholder = "Wrong code";
      return;
    }

    state.pathUnlockUsed[path] = true;
    saveState();

    unlockRandomInPath(path);
    inputEl.value = "";
    renderAll();
  }

  unlockMainBtn.addEventListener("click", () => handlePathUnlock("main", unlockMainInput));
  unlockBlueBtn.addEventListener("click", () => handlePathUnlock("blue", unlockBlueInput));
  unlockPurpleBtn.addEventListener("click", () => handlePathUnlock("purple", unlockPurpleInput));
  unlockOrangeBtn.addEventListener("click", () => handlePathUnlock("orange", unlockOrangeInput));
  unlockWhiteBtn.addEventListener("click", () => handlePathUnlock("white", unlockWhiteInput));

  // ===== Music Drawer Events =====
  musicOpenBtn.addEventListener("click", openMusicDrawer);
  musicCloseBtn.addEventListener("click", closeMusicDrawer);

  musicEnabled.addEventListener("change", () => {
    state.music.enabled = !!musicEnabled.checked;
    state.music.playing = state.music.enabled ? true : false;
    saveState();
    if (state.music.enabled) playCurrentTrack(); else bgm.pause();
    syncMusicUI();
  });

  musicPlayPauseBtn.addEventListener("click", () => {
    state.music.playing = !state.music.playing;
    saveState();
    playCurrentTrack();
    syncMusicUI();
  });

  musicPrevBtn.addEventListener("click", () => {
    const i = state.music.currentIndex - 1;
    state.music.playing = true;
    setMusicIndex(i < 0 ? MUSIC_PLAYLIST.length - 1 : i);
  });

  musicNextBtn.addEventListener("click", () => {
    state.music.playing = true;
    shuffleNext();
  });

  // ===== Rules Modal Events =====
  rulesOpenBtn.addEventListener("click", openRules);
  rulesCloseBtn.addEventListener("click", closeRules);
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) closeRules();
  });

  // ===== Manual Leaderboard Refresh Button =====
  refreshLeaderboardBtn.addEventListener("click", () => {
    fetchLeaderboard();
  });

  // ===== Remote Upsert / Fetch =====
  function buildRemotePayload(){
    return {
      name: state.playerName || "Unknown",
      main_solved: solvedCount("main"),
      blue_solved: solvedCount("blue"),
      purple_solved: solvedCount("purple"),
      orange_solved: solvedCount("orange"),
      white_solved: solvedCount("white"),
      gold_unlocked: !!state.clues["gold_final"]?.unlocked
    };
  }

  function queueRemoteUpsert(force = false){
    if (!supabase || !remoteReady) return;
    if (!force && !state.nameLocked) return;

    if (remoteTimer) clearTimeout(remoteTimer);
    remoteTimer = setTimeout(async () => {
      try{
        await ensureSignedIn();
        const payload = buildRemotePayload();
        await supabase.from("players").upsert(payload, { onConflict:"name" });
        fetchLeaderboard();
      }catch{}
    }, 350);
  }

  async function fetchLeaderboard(){
    if (!supabase || !remoteReady) {
      leaderboardData = [];
      renderLeaderboard();
      return;
    }
    try{
      const { data, error } = await supabase
        .from("players")
        .select("*")
        .order("main_solved", { ascending:false });

      if (error) return;
      leaderboardData = data || [];
      renderLeaderboard();
    }catch{}
  }

  // ===== Init =====
  renderAll();

  // Start music after user gesture: the first click/tap on page
  let started = false;
  const startOnGesture = () => {
    if (started) return;
    started = true;
    if (state.music.enabled) {
      state.music.playing = true;
      playCurrentTrack();
      syncMusicUI();
    }
    window.removeEventListener("pointerdown", startOnGesture);
  };
  window.addEventListener("pointerdown", startOnGesture);

  initRemoteIfEnabled();

})();
