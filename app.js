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
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYnFscmV1cnZpZ2t4ZnlpYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNjA0MDEsImV4cCI6MjA4MTkzNjQwMX0.7KhWzoreujQWGtZ3CF43Bgz9hBI5FU0S6CWTiMpY0Ek"; // <-- paste your anon key
  const BACKEND_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

  const supabase = BACKEND_ENABLED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  // =========================
  // CONFIG YOU EDIT LATER
  // =========================
  const PATH_UNLOCK_CODES = {
    main: "CHRISTMAS2025",
    blue: "BLUECODEPLACEHOLDER",
    purple: "PURPLECODEPLACEHOLDER",
    orange: "ORANGECODEPLACEHOLDER",
    white: "WHITECODEPLACEHOLDER"
  };

  const RESET_CODE = "MikeChristmas1998";

  // IMPORTANT:
  // Use relative paths that match your repo.
  // Your HTML is served from /xmas/, so "./assets/..." is correct.
  const PLAYLIST = [
    { title: "All I Want For Christmas Is You by Mariah Carey", file: "./assets/All I Want For Christmas Is You.mp3" },
    { title: "Christmas Track 2", file: "./assets/music2.mp3" },
    { title: "Christmas Track 3", file: "./assets/music3.mp3" }
  ];

  const HINT_DELAY_MS = [10, 30, 60].map(m => m * 60 * 1000);

  // =========================
  // DOM
  // =========================
  const startScreen = document.getElementById("startScreen");
  const appScreen = document.getElementById("appScreen");
  const playBtn = document.getElementById("playBtn");

  const clueContainer = document.getElementById("clueContainer");
  const leaderboardEl = document.getElementById("leaderboard");

  const playerNameInput = document.getElementById("playerName");
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

  const musicToggleBtn = document.getElementById("musicToggleBtn");
  const musicDrawer = document.getElementById("musicDrawer");
  const musicCloseBtn = document.getElementById("musicCloseBtn");
  const musicEnabled = document.getElementById("musicEnabled");
  const playlistEl = document.getElementById("playlist");
  const musicPrev = document.getElementById("musicPrev");
  const musicPlayPause = document.getElementById("musicPlayPause");
  const musicNext = document.getElementById("musicNext");

  const howBtn = document.getElementById("howBtn");
  const rulesModal = document.getElementById("rulesModal");
  const rulesCloseBtn = document.getElementById("rulesCloseBtn");
  const resetInput = document.getElementById("resetInput");
  const resetBtn = document.getElementById("resetBtn");

  const bgm = document.getElementById("bgm");
  const sfxUnlock = document.getElementById("sfxUnlock");

  // =========================
  // DATA MODEL
  // =========================
  function now() { return Date.now(); }

  const PASSCODES = {};

  function makeClue({
    id, path, label, colorDotClass,
    isLastInPath = false,
    clueText = "PLACEHOLDER CLUE TEXT — replace later.",
    hints = [
      "PLACEHOLDER HINT 1 — replace later.",
      "PLACEHOLDER HINT 2 — replace later.",
      "PLACEHOLDER HINT 3 — replace later."
    ],
    passcode = "PASSCODEPLACEHOLDER"
  }) {
    PASSCODES[id] = passcode;
    return { id, path, label, colorDotClass, isLastInPath, clueText, hints };
  }

  function buildClues() {
    const clues = [];

    // =========================
    // CLUE DATA MAP (EDIT HERE)
    // =========================
    const CLUE_DATA = {
      "main_13": {
        clueText: "REPLACE ME: Clue text for main_13",
        hints: ["REPLACE ME: Hint 1", "REPLACE ME: Hint 2", "REPLACE ME: Hint 3"],
        passcode: "REPLACE13"
      },
      "blue_1": {
        clueText: "REPLACE ME: Clue text for blue_1",
        hints: ["REPLACE ME: Hint 1", "REPLACE ME: Hint 2", "REPLACE ME: Hint 3"],
        passcode: "REPLACE2"
      },
      "gold_final": {
        clueText: "REPLACE ME: Final gold clue text",
        hints: ["REPLACE ME: Gold hint 1", "REPLACE ME: Gold hint 2", "REPLACE ME: Gold hint 3"]
      }
    };

    // Main path: 20 clues
    for (let i = 1; i <= 20; i++) {
      const id = `main_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "main",
        label: `Clue ${i}`,
        colorDotClass: "dot-rg",
        clueText: d.clueText || "PLACEHOLDER CLUE TEXT — replace later.",
        hints: d.hints || [
          "PLACEHOLDER HINT 1 — replace later.",
          "PLACEHOLDER HINT 2 — replace later.",
          "PLACEHOLDER HINT 3 — replace later."
        ],
        passcode: d.passcode || `MAIN${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Gold final clue
    clues.push(makeClue({
      id: `gold_final`,
      path: "gold",
      label: `Gold Clue (Grand Prize)`,
      colorDotClass: "dot-gold",
      isLastInPath: true,
      clueText: (CLUE_DATA["gold_final"]?.clueText) || "FINAL GOLD CLUE TEXT — replace later.",
      hints: (CLUE_DATA["gold_final"]?.hints) || [
        "GOLD HINT 1 — replace later.",
        "GOLD HINT 2 — replace later.",
        "GOLD HINT 3 — replace later."
      ],
      passcode: `GOLD_PASSCODE_UNUSED`
    }));

    // Blue: 6 (last is #6)
    for (let i = 1; i <= 6; i++) {
      const id = `blue_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "blue",
        label: `Blue Clue ${i}`,
        colorDotClass: "dot-blue",
        isLastInPath: i === 6,
        clueText: d.clueText || "PLACEHOLDER CLUE TEXT — replace later.",
        hints: d.hints || [
          "PLACEHOLDER HINT 1 — replace later.",
          "PLACEHOLDER HINT 2 — replace later.",
          "PLACEHOLDER HINT 3 — replace later."
        ],
        passcode: d.passcode || `BLUE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Purple: 5
    for (let i = 1; i <= 5; i++) {
      const id = `purple_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "purple",
        label: `Purple Clue ${i}`,
        colorDotClass: "dot-purple",
        isLastInPath: i === 5,
        clueText: d.clueText || "PLACEHOLDER CLUE TEXT — replace later.",
        hints: d.hints || [
          "PLACEHOLDER HINT 1 — replace later.",
          "PLACEHOLDER HINT 2 — replace later.",
          "PLACEHOLDER HINT 3 — replace later."
        ],
        passcode: d.passcode || `PURPLE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Orange: 4
    for (let i = 1; i <= 4; i++) {
      const id = `orange_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "orange",
        label: `Orange Clue ${i}`,
        colorDotClass: "dot-orange",
        isLastInPath: i === 4,
        clueText: d.clueText || "PLACEHOLDER CLUE TEXT — replace later.",
        hints: d.hints || [
          "PLACEHOLDER HINT 1 — replace later.",
          "PLACEHOLDER HINT 2 — replace later.",
          "PLACEHOLDER HINT 3 — replace later."
        ],
        passcode: d.passcode || `ORANGE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // White: 3
    for (let i = 1; i <= 3; i++) {
      const id = `white_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "white",
        label: `White Clue ${i}`,
        colorDotClass: "dot-white",
        isLastInPath: i === 3,
        clueText: d.clueText || "PLACEHOLDER CLUE TEXT — replace later.",
        hints: d.hints || [
          "PLACEHOLDER HINT 1 — replace later.",
          "PLACEHOLDER HINT 2 — replace later.",
          "PLACEHOLDER HINT 3 — replace later."
        ],
        passcode: d.passcode || `WHITE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    return clues;
  }

  const ALL_CLUES = buildClues();

  // =========================
  // STATE
  // =========================
  const defaultState = () => ({
    hasEnteredApp: false,
    playerName: "",
    nameLocked: false,

    localPlayers: {},
    remotePlayers: null,  // populated from Supabase when enabled

    clues: Object.fromEntries(ALL_CLUES.map(c => [
      c.id,
      { unlocked: false, solved: false, unlockedAt: null }
    ])),

    pathUnlockUsed: { main:false, blue:false, purple:false, orange:false, white:false },

    music: { enabled:true, trackIndex:0, playing:false }
  });

  let state = loadState();

  function loadState() {
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const fresh = defaultState();
      return {
        ...fresh,
        ...parsed,
        pathUnlockUsed: { ...fresh.pathUnlockUsed, ...(parsed.pathUnlockUsed || {}) },
        music: { ...fresh.music, ...(parsed.music || {}) },
        clues: { ...fresh.clues, ...(parsed.clues || {}) },
        localPlayers: { ...(parsed.localPlayers || {}) },
        remotePlayers: null
      };
    } catch {
      return defaultState();
    }
  }

  // ===== Remote sync throttle =====
  let remoteSyncTimer = null;
  function queueRemoteSync() {
    if (!BACKEND_ENABLED) return;
    if (!state.nameLocked || !state.playerName) return;

    if (remoteSyncTimer) return;
    remoteSyncTimer = setTimeout(async () => {
      remoteSyncTimer = null;
      try {
        await saveRemotePlayer();
      } catch {}
    }, 350);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncLocalLeaderboard();
    queueRemoteSync();
  }

  function resetState() {
    state = defaultState();
    saveState();
    renderAll();
  }

  // =========================
  // SUPABASE (REMOTE)
  // =========================
  async function ensureSignedIn() {
    if (!BACKEND_ENABLED) return null;

    const { data: s1 } = await supabase.auth.getSession();
    if (s1?.session?.user) return s1.session.user;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  }

  function computeProgressSnapshot() {
    return {
      mainSolved: countSolved("main"),
      blueSolved: countSolved("blue"),
      purpleSolved: countSolved("purple"),
      orangeSolved: countSolved("orange"),
      whiteSolved: countSolved("white"),
      goldUnlocked: !!state.clues["gold_final"]?.unlocked,
      goldSolved: !!state.clues["gold_final"]?.solved
    };
  }

  async function saveRemotePlayer() {
    if (!BACKEND_ENABLED) return;
    const user = await ensureSignedIn();
    if (!user) return;

    const pr = computeProgressSnapshot();

    const payload = {
      id: user.id,
      name: state.playerName,
      main_solved: pr.mainSolved,
      blue_solved: pr.blueSolved,
      purple_solved: pr.purpleSolved,
      orange_solved: pr.orangeSolved,
      white_solved: pr.whiteSolved,
      gold_unlocked: pr.goldUnlocked,
      gold_solved: pr.goldSolved,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("players")
      .upsert(payload, { onConflict: "id" });

    if (error) console.log("saveRemotePlayer error", error);
  }

  async function fetchRemoteLeaderboard() {
    if (!BACKEND_ENABLED) return;

    const { data, error } = await supabase
      .from("players")
      .select("*");

    if (error) {
      console.log("fetchRemoteLeaderboard error", error);
      return;
    }

    state.remotePlayers = Object.fromEntries((data || []).map(r => [
      r.id,
      {
        name: r.name,
        updatedAt: new Date(r.updated_at).getTime(),
        progress: {
          mainSolved: r.main_solved,
          blueSolved: r.blue_solved,
          purpleSolved: r.purple_solved,
          orangeSolved: r.orange_solved,
          whiteSolved: r.white_solved,
          goldUnlocked: r.gold_unlocked,
          goldSolved: r.gold_solved
        }
      }
    ]));
  }

  function subscribeLeaderboardRealtime() {
    if (!BACKEND_ENABLED) return;

    supabase
      .channel("players-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, async () => {
        await fetchRemoteLeaderboard();
        renderLeaderboard();
      })
      .subscribe();
  }

  async function initRemoteIfEnabled() {
    if (!BACKEND_ENABLED) return;

    try {
      await ensureSignedIn();
      await fetchRemoteLeaderboard();
      subscribeLeaderboardRealtime();

      // If already locked name (returning player), ensure remote row exists/updates
      if (state.nameLocked && state.playerName) {
        await saveRemotePlayer();
        await fetchRemoteLeaderboard();
      }

      renderLeaderboard();
    } catch (e) {
      console.log("Remote init error", e);
    }
  }

  // =========================
  // HELPERS
  // =========================
  function randChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function getPathClues(path) { return ALL_CLUES.filter(c => c.path === path); }

  function countSolved(path) {
    const ids = getPathClues(path).map(c => c.id);
    return ids.filter(id => state.clues[id]?.solved).length;
  }
  function totalInPath(path) { return getPathClues(path).length; }

  function isGoldUnlockedByRules() { return countSolved("main") >= 20; }

  function eligibleRandomClueIds(path) {
    const clues = getPathClues(path);
    if (path === "main") {
      return clues.filter(c => !state.clues[c.id].unlocked && !state.clues[c.id].solved).map(c => c.id);
    }
    const nonLast = clues.filter(c => !c.isLastInPath);
    return nonLast.filter(c => !state.clues[c.id].unlocked && !state.clues[c.id].solved).map(c => c.id);
  }

  function lastClueId(path) {
    const clues = getPathClues(path);
    const last = clues.find(c => c.isLastInPath);
    return last ? last.id : null;
  }

  function canUnlockLastClue(path) {
    const clues = getPathClues(path);
    const last = clues.find(c => c.isLastInPath);
    if (!last) return false;
    const others = clues.filter(c => !c.isLastInPath);
    return others.every(c => state.clues[c.id].solved);
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
      unlockClue(randChoice(eligible));
      return true;
    }
    if (canUnlockLastClue(path)) {
      const lastId = lastClueId(path);
      if (lastId && !state.clues[lastId].unlocked) {
        unlockClue(lastId);
        return true;
      }
    }
    return false;
  }

  function solveClue(id, enteredPass) {
    const cs = state.clues[id];
    if (!cs?.unlocked || cs.solved) return { ok:false, msg:"Clue not unlocked (or already solved)." };

    if (id === "gold_final") {
      cs.solved = true;
      saveState();
      renderAll();
      return { ok:true, msg:"Gold clue marked solved." };
    }

    const expected = PASSCODES[id] ?? "";
    if ((enteredPass || "").trim() !== expected.trim()) {
      return { ok:false, msg:"Incorrect passcode." };
    }

    cs.solved = true;
    saveState();

    const clueMeta = ALL_CLUES.find(c => c.id === id);
    if (clueMeta?.path === "main") {
      unlockRandomInPath("main");
      if (isGoldUnlockedByRules()) unlockClue("gold_final");
    } else if (["blue","purple","orange","white"].includes(clueMeta?.path)) {
      unlockRandomInPath(clueMeta.path);
    }

    renderAll();
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
    if (!cs?.unlocked || !cs.unlockedAt) return { unlocked:false, remainingText:"" };

    const elapsed = now() - cs.unlockedAt;
    const delay = HINT_DELAY_MS[hintIndex];
    const remaining = delay - elapsed;

    if (remaining <= 0) return { unlocked:true, remainingText:"00:00" };
    return { unlocked:false, remainingText: msToClock(remaining) };
  }

  // =========================
  // MUSIC (Continuous + Shuffle)
  // =========================
  const shuffleHistory = [];
  const maxHistory = 50;

  function pushHistory(i) {
    shuffleHistory.push(i);
    if (shuffleHistory.length > maxHistory) shuffleHistory.shift();
  }

  function pickRandomNextIndex() {
    if (PLAYLIST.length <= 1) return 0;
    let next = state.music.trackIndex;
    while (next === state.music.trackIndex) {
      next = Math.floor(Math.random() * PLAYLIST.length);
    }
    return next;
  }

  function loadTrack(index) {
    if (!PLAYLIST.length) return;
    const safeIndex = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    state.music.trackIndex = safeIndex;
    bgm.src = PLAYLIST[safeIndex].file;

    // IMPORTANT: don't loop one track; we shuffle on "ended"
    bgm.loop = false;

    saveState();
    renderPlaylist();
  }

  function playMusic() {
    if (!state.music.enabled || !PLAYLIST.length) return;
    state.music.playing = true;
    saveState();
    bgm.play().catch(() => {});
    renderPlaylist();
  }

  function pauseMusic() {
    state.music.playing = false;
    saveState();
    bgm.pause();
    renderPlaylist();
  }

  function toggleMusic() {
    if (state.music.playing) pauseMusic();
    else playMusic();
  }

  function playRandomNextTrack() {
    const next = pickRandomNextIndex();
    pushHistory(state.music.trackIndex);
    loadTrack(next);
    if (state.music.enabled) playMusic();
  }

  function playPreviousFromHistory() {
    if (!shuffleHistory.length) return;
    const prev = shuffleHistory.pop();
    loadTrack(prev);
    if (state.music.enabled) playMusic();
  }

  // Auto-advance on shuffle when a song ends
  bgm.addEventListener("ended", () => {
    if (!state.music.enabled) return;
    if (!state.music.playing) return;
    playRandomNextTrack();
  });

  // =========================
  // LOCAL LEADERBOARD (FALLBACK)
  // =========================
  function syncLocalLeaderboard() {
    const name = (state.playerName || "").trim();
    if (!name) return;

    state.localPlayers[name] = {
      name,
      updatedAt: now(),
      progress: computeProgressSnapshot()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // =========================
  // RENDER
  // =========================
  function setScreen(isApp) {
    if (isApp) {
      startScreen.classList.remove("screen--active");
      appScreen.classList.add("screen--active");
      appScreen.style.opacity = "0";
      appScreen.style.transform = "translateY(8px)";
      requestAnimationFrame(() => {
        appScreen.style.transition = "opacity .65s ease, transform .65s ease";
        appScreen.style.opacity = "1";
        appScreen.style.transform = "translateY(0)";
      });
    } else {
      appScreen.classList.remove("screen--active");
      startScreen.classList.add("screen--active");
    }
  }

  function renderPlaylist() {
    playlistEl.innerHTML = "";
    if (!PLAYLIST.length) {
      playlistEl.innerHTML = `<div class="labelSub">No tracks configured.</div>`;
      return;
    }

    PLAYLIST.forEach((t, idx) => {
      const div = document.createElement("div");
      div.className = "track" + (idx === state.music.trackIndex ? " trackActive" : "");
      div.innerHTML = `
        <div>
          <div class="trackTitle">${escapeHtml(t.title)}</div>
          <div class="trackMeta">${idx === state.music.trackIndex ? (state.music.playing ? "Playing" : "Paused") : "Tap to select"}</div>
        </div>
        <button class="btn btn--small" type="button">${idx === state.music.trackIndex ? "✓" : "▶"}</button>
      `;
      div.addEventListener("click", () => {
        pushHistory(state.music.trackIndex);
        loadTrack(idx);
        if (state.music.enabled) playMusic();
      });
      playlistEl.appendChild(div);
    });

    musicEnabled.checked = !!state.music.enabled;
    musicPlayPause.textContent = state.music.playing ? "⏸" : "▶️";
  }

  function renderLeaderboard() {
    const source = state.remotePlayers
      ? Object.values(state.remotePlayers)
      : Object.values(state.localPlayers || {});

    const players = source.sort((a, b) => {
      const ap = a.progress || {};
      const bp = b.progress || {};
      if ((bp.mainSolved ?? 0) !== (ap.mainSolved ?? 0)) return (bp.mainSolved ?? 0) - (ap.mainSolved ?? 0);
      if (!!bp.goldSolved !== !!ap.goldSolved) return (bp.goldSolved ? 1 : 0) - (ap.goldSolved ? 1 : 0);
      if (!!bp.goldUnlocked !== !!ap.goldUnlocked) return (bp.goldUnlocked ? 1 : 0) - (ap.goldUnlocked ? 1 : 0);
      return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
    });

    if (players.length === 0) {
      leaderboardEl.innerHTML = `<div class="labelSub">No players yet. Save your name to appear here.</div>`;
      return;
    }

    function pct(n, d) {
      if (!d) return 0;
      return Math.max(0, Math.min(100, (n / d) * 100));
    }

    leaderboardEl.innerHTML = "";
    for (const p of players) {
      const pr = p.progress || {};
      const main = pr.mainSolved ?? 0;
      const blue = pr.blueSolved ?? 0;
      const purple = pr.purpleSolved ?? 0;
      const orange = pr.orangeSolved ?? 0;
      const white = pr.whiteSolved ?? 0;

      const row = document.createElement("div");
      row.className = "lbRow";
      row.innerHTML = `
        <div class="lbTop">
          <div class="lbName">${escapeHtml(p.name)}</div>
          <div class="lbName">${main}/20</div>
        </div>

        <div class="barRow">
          <div class="barLabel"><span class="tagDot dot-rg"></span>Main</div>
          <div class="bar"><div class="barFill" style="width:${pct(main,20)}%"></div></div>
          <div class="barValue">${main}/20</div>
        </div>

        <div class="barRow">
          <div class="barLabel"><span class="tagDot dot-blue"></span>Blue</div>
          <div class="bar"><div class="barFill" style="width:${pct(blue,6)}%"></div></div>
          <div class="barValue">${blue}/6</div>
        </div>

        <div class="barRow">
          <div class="barLabel"><span class="tagDot dot-purple"></span>Purple</div>
          <div class="bar"><div class="barFill" style="width:${pct(purple,5)}%"></div></div>
          <div class="barValue">${purple}/5</div>
        </div>

        <div class="barRow">
          <div class="barLabel"><span class="tagDot dot-orange"></span>Orange</div>
          <div class="bar"><div class="barFill" style="width:${pct(orange,4)}%"></div></div>
          <div class="barValue">${orange}/4</div>
        </div>

        <div class="barRow">
          <div class="barLabel"><span class="tagDot dot-white"></span>White</div>
          <div class="bar"><div class="barFill" style="width:${pct(white,3)}%"></div></div>
          <div class="barValue">${white}/3</div>
        </div>

        <div class="lbSub" style="margin-top:10px;">
          <span><span class="tagDot dot-gold"></span>Gold: ${pr.goldSolved ? "Solved" : (pr.goldUnlocked ? "Unlocked" : "Locked")}</span>
          <span>${BACKEND_ENABLED ? "Shared" : "Local"}</span>
        </div>
      `;
      leaderboardEl.appendChild(row);
    }
  }

  function renderPathHeader(path, title, desc, anchorId) {
    const wrap = document.createElement("div");
    wrap.id = anchorId;

    const header = document.createElement("div");
    header.className = "pathHeader";
    header.innerHTML = `
      <div>
        <div class="pathTitle">${escapeHtml(title)}</div>
        <div class="pathDesc">${escapeHtml(desc)}</div>
      </div>
      <div class="badge">${countSolved(path)}/${totalInPath(path)} solved</div>
    `;
    wrap.appendChild(header);
    return wrap;
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
      return `<div class="labelStrong">Gold clue unlocked — follow it to the Grand Prize.</div>`;
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

    if (isGoldUnlockedByRules() && !state.clues["gold_final"].unlocked) unlockClue("gold_final");

    playerNameInput.value = state.playerName || "";
    playerNameInput.disabled = !!state.nameLocked;
    saveNameBtn.disabled = !!state.nameLocked;

    renderLeaderboard();
    renderPlaylist();

    clueContainer.innerHTML = "";

    clueContainer.appendChild(renderPathHeader("main", "Main Path (Red/Green Ornaments)", "Solve 20 clues to unlock the Gold ornament.", "mainPath"));
    for (const c of getPathClues("main")) clueContainer.appendChild(renderClueCard(c));

    clueContainer.appendChild(renderPathHeader("blue", "Blue Path", "Leads to the 2nd biggest prize.", "bluePath"));
    for (const c of getPathClues("blue")) clueContainer.appendChild(renderClueCard(c));

    clueContainer.appendChild(renderPathHeader("purple", "Purple Path", "Leads to the 3rd biggest prize.", "purplePath"));
    for (const c of getPathClues("purple")) clueContainer.appendChild(renderClueCard(c));

    clueContainer.appendChild(renderPathHeader("orange", "Orange Path", "Leads to the 4th biggest prize.", "orangePath"));
    for (const c of getPathClues("orange")) clueContainer.appendChild(renderClueCard(c));

    clueContainer.appendChild(renderPathHeader("white", "White Path", "Leads to the 5th biggest prize.", "whitePath"));
    for (const c of getPathClues("white")) clueContainer.appendChild(renderClueCard(c));

    const goldHeader = document.createElement("div");
    goldHeader.id = "goldPath";
    goldHeader.className = "pathHeader";
    goldHeader.innerHTML = `
      <div>
        <div class="pathTitle">Gold Ornament (Grand Prize)</div>
        <div class="pathDesc">Unlocks only after the Main Path is fully solved.</div>
      </div>
      <div class="badge">${state.clues["gold_final"].unlocked ? "Unlocked" : "Locked"}</div>
    `;
    clueContainer.appendChild(goldHeader);
    clueContainer.appendChild(renderClueCard(ALL_CLUES.find(c => c.id === "gold_final")));
  }

  function updateHintCountdowns() {
    const nodes = document.querySelectorAll("[data-countdown='1']");
    for (const node of nodes) {
      const clueId = node.getAttribute("data-clue");
      const hintIndex = Number(node.getAttribute("data-hint-index"));
      const info = hintCountdownInfo(clueId, hintIndex);

      if (!info.unlocked) {
        node.textContent = info.remainingText;
      } else {
        renderAll();
        return;
      }
    }
  }

  // =========================
  // EVENTS
  // =========================
  playBtn.addEventListener("click", async () => {
    state.hasEnteredApp = true;
    saveState();
    setScreen(true);

    initMusic();
    if (state.music.enabled) playMusic(); // <-- this click is what allows iPhone autoplay

    registerSW();
    await initRemoteIfEnabled();
  });

  saveNameBtn.addEventListener("click", async () => {
    if (state.nameLocked) return;

    const name = (playerNameInput.value || "").trim();
    if (!name) return;

    state.playerName = name;
    state.nameLocked = true;
    saveState();

    // push name + progress to remote immediately (if enabled)
    if (BACKEND_ENABLED) {
      try {
        await saveRemotePlayer();
        await fetchRemoteLeaderboard();
      } catch {}
    }

    renderAll();
  });

  unlockMainBtn.addEventListener("click", () => {
    const code = (unlockMainInput.value || "").trim();
    if (state.pathUnlockUsed.main) return;

    if (code !== PATH_UNLOCK_CODES.main) {
      unlockMainInput.value = "";
      unlockMainInput.placeholder = "Wrong code";
      return;
    }

    state.pathUnlockUsed.main = true;
    saveState();

    unlockRandomInPath("main");
    unlockMainBtn.disabled = true;
    unlockMainInput.value = "";
  });

  function handlePathUnlock(path, inputEl) {
    const code = (inputEl.value || "").trim();
    if (state.pathUnlockUsed[path]) return;

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

  unlockBlueBtn.addEventListener("click", () => handlePathUnlock("blue", unlockBlueInput));
  unlockPurpleBtn.addEventListener("click", () => handlePathUnlock("purple", unlockPurpleInput));
  unlockOrangeBtn.addEventListener("click", () => handlePathUnlock("orange", unlockOrangeInput));
  unlockWhiteBtn.addEventListener("click", () => handlePathUnlock("white", unlockWhiteInput));

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-scroll]");
    if (!btn) return;
    const id = btn.getAttribute("data-scroll");
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  musicToggleBtn.addEventListener("click", () => setMusicDrawer(!musicDrawer.classList.contains("drawer--open")));
  musicCloseBtn.addEventListener("click", () => setMusicDrawer(false));

  function setMusicDrawer(open) {
    musicDrawer.classList.toggle("drawer--open", open);
    musicToggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
    musicDrawer.setAttribute("aria-hidden", open ? "false" : "true");
  }

  musicEnabled.addEventListener("change", () => {
    state.music.enabled = musicEnabled.checked;
    saveState();
    if (!state.music.enabled) pauseMusic();
    else playMusic();
  });

  // Shuffle controls:
  musicPrev.addEventListener("click", () => { playPreviousFromHistory(); });
  musicNext.addEventListener("click", () => { playRandomNextTrack(); });
  musicPlayPause.addEventListener("click", toggleMusic);

  howBtn.addEventListener("click", () => setRulesModal(true));
  rulesCloseBtn.addEventListener("click", () => setRulesModal(false));
  rulesModal.addEventListener("click", (e) => { if (e.target === rulesModal) setRulesModal(false); });

  function setRulesModal(open) {
    rulesModal.classList.toggle("modal--open", open);
    rulesModal.setAttribute("aria-hidden", open ? "false" : "true");
  }

  resetBtn.addEventListener("click", () => {
    const code = (resetInput.value || "").trim();
    if (code !== RESET_CODE) {
      resetInput.value = "";
      resetInput.placeholder = "Wrong reset code";
      return;
    }
    resetInput.value = "";
    resetState();
    setRulesModal(false);
    setScreen(false);
  });

  window.addEventListener("focus", async () => {
    syncLocalLeaderboard();
    if (BACKEND_ENABLED) {
      await fetchRemoteLeaderboard();
    }
    renderLeaderboard();
  });

  // =========================
  // INIT
  // =========================
  function initMusic() {
    if (!PLAYLIST.length) return;
    loadTrack(Math.min(state.music.trackIndex, PLAYLIST.length - 1));
    bgm.volume = 0.55;
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function boot() {
    if (state.hasEnteredApp) {
      setScreen(true);
      initMusic();
      if (state.music.enabled && state.music.playing) playMusic();
      else if (PLAYLIST.length) loadTrack(state.music.trackIndex);
      registerSW();
      initRemoteIfEnabled();
    } else {
      setScreen(false);
    }

    renderAll();

    setInterval(() => {
      if (!state.hasEnteredApp) return;
      updateHintCountdowns();
    }, 1000);
  }

  boot();
})();
