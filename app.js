import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

/* Xmas Hunt 2025
   - Name locks after first save
   - Shared leaderboard & progress via Supabase (anonymous auth)
   - Music, unlock SFX, leaderboard refresh
*/

(() => {
  const STORAGE_KEY = "xmasHunt2025_state_v3";

  // =========================
  // SUPABASE CONFIG
  // =========================
  const SUPABASE_URL = "https://vgbqlreurvigkxfyibol.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxOTI0OTI5MTYyLCJpYXQiOjE3NDU0MjkxNjIsImlzcyI6Imh0dHBzOi8vdmdi cWxyZXVydmlna3hmeWlib2wuc3VwYWJhc2UuY28iLCJzdWIiOiI5NDc1YzU3OC1lY2Q0LTQxOWItODMyNy04MjMxZWQ0ZGM5NTYiLCJlbWFpbCI6IiIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiYW5vbnltb3VzIiwicHJvdmlkZXJzIjpbImFub255bW91cyJdfSwidXNlcl9tZXRhZGF0YSI6e30sInJvbGUiOiJhbm9uIiwic3RhdHVzIjoiYWN0aXZlIiwic3RlcF91cCI6ZmFsc2UsInN1cGVyYmFzZSI6e30sInNlc3Npb25faWQiOiJhMGNhOGM5Ny1kM2JkLTQ3OWQtOGU1OC1lN2RjNzU3NjU1YjMiLCJpc19hbm9ueW1vdXMiOnRydWV9.9EJtFj7d0YJkq5lI8m3sD4E0cBqQhQm7y2uJ4YyQk7Q";

  const BACKEND_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
  const supabase = BACKEND_ENABLED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

  // =========================
  // DOM
  // =========================
  const startScreen = document.getElementById("startScreen");
  const appScreen = document.getElementById("appScreen");
  const playBtn = document.getElementById("playBtn");

  const howBtn = document.getElementById("howBtn");
  const rulesModal = document.getElementById("rulesModal");
  const rulesCloseBtn = document.getElementById("rulesCloseBtn");

  const resetInput = document.getElementById("resetInput");
  const resetBtn = document.getElementById("resetBtn");
  const resetMsg = document.getElementById("resetMsg");

  const playerNameInput = document.getElementById("playerNameInput");
  const saveNameBtn = document.getElementById("saveNameBtn");
  const nameLockedMsg = document.getElementById("nameLockedMsg");

  const refreshLeaderboardBtn = document.getElementById("refreshLeaderboardBtn");
  const leaderboardEl = document.getElementById("leaderboard");

  const clueContainer = document.getElementById("clueContainer");

  const musicToggleBtn = document.getElementById("musicToggleBtn");
  const musicDrawer = document.getElementById("musicDrawer");
  const musicCloseBtn = document.getElementById("musicCloseBtn");
  const bgm = document.getElementById("bgm");
  const sfxUnlock = document.getElementById("sfxUnlock");

  // Winner SFX (for final clue completions)
  // If you don't have an <audio id="sfxWinner"> in index.html, this still works.
  const sfxWinner = document.getElementById("sfxWinner") || new Audio("./assets/winner.mp3");

  // Shared Notify Modal (Unlock + Winner)
  const notify = ensureNotifyModal();

  function ensureNotifyModal() {
    // If modal exists in HTML already, use it
    let modal = document.getElementById("notifyModal");
    if (modal) {
      // Ensure confetti styles exist (in case CSS wasn't updated)
      ensureNotifyStyles();
      return {
        modal,
        titleEl: document.getElementById("notifyTitle"),
        bodyEl: document.getElementById("notifyBody"),
        okBtn: document.getElementById("notifyOkBtn"),
        closeBtn: document.getElementById("notifyCloseBtn"),
        confettiEl: document.getElementById("notifyConfetti")
      };
    }

    // Otherwise, create it so app.js is plug-and-play
    ensureNotifyStyles();

    modal = document.createElement("div");
    modal.id = "notifyModal";
    modal.className = "modal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modalCard modalCard--small">
        <div class="modalHeader">
          <div id="notifyTitle" class="modalTitle">Unlocked!</div>
          <button id="notifyCloseBtn" class="btn btn--ghost" type="button">✕</button>
        </div>
        <div class="modalBody notifyBody">
          <div id="notifyBody" class="notifyText"></div>
          <div id="notifyConfetti" class="confetti" aria-hidden="true"></div>
          <div class="notifyActions">
            <button id="notifyOkBtn" class="btn btn--primary" type="button">Back to Interface</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const titleEl = modal.querySelector("#notifyTitle");
    const bodyEl = modal.querySelector("#notifyBody");
    const okBtn = modal.querySelector("#notifyOkBtn");
    const closeBtn = modal.querySelector("#notifyCloseBtn");
    const confettiEl = modal.querySelector("#notifyConfetti");

    const close = () => closeNotifyModal();
    okBtn.addEventListener("click", close);
    closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });

    return { modal, titleEl, bodyEl, okBtn, closeBtn, confettiEl };
  }

  function ensureNotifyStyles() {
    if (document.getElementById("notifyStyles")) return;
    const style = document.createElement("style");
    style.id = "notifyStyles";
    style.textContent = `
      .modalCard--small{ width:min(520px,100%); }
      .notifyBody{ position:relative; overflow:hidden; }
      .notifyText{ padding:6px 2px 14px; text-align:center; font-size:18px; }
      .notifyActions{ display:flex; justify-content:center; border-top:1px solid var(--border, rgba(255,255,255,.12)); padding-top:12px; }
      .confetti{ position:absolute; inset:0; pointer-events:none; overflow:hidden; opacity:0; }
      .confetti--on{ opacity:1; }
      .confettiPiece{
        position:absolute;
        left: var(--x);
        top:-12%;
        width:10px;
        height:16px;
        border-radius:3px;
        background:hsl(var(--hue),80%,60%);
        transform: rotate(var(--rot));
        opacity:.92;
        animation: confettiFall var(--dur) linear infinite;
        animation-delay: var(--delay);
        filter: drop-shadow(0 2px 6px rgba(0,0,0,.35));
      }
      @keyframes confettiFall{
        to{ top:112%; transform: rotate(calc(var(--rot) + 360deg)); }
      }
    `;
    document.head.appendChild(style);
  }

  function openNotifyModal() {
    notify.modal.classList.add("modal--open");
    notify.modal.setAttribute("aria-hidden", "false");
  }

  function closeNotifyModal() {
    notify.modal.classList.remove("modal--open");
    notify.modal.setAttribute("aria-hidden", "true");
    if (notify.confettiEl) {
      notify.confettiEl.innerHTML = "";
      notify.confettiEl.classList.remove("confetti--on");
    }
  }

  function buildConfetti(count = 44) {
    if (!notify.confettiEl) return;
    notify.confettiEl.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "confettiPiece";
      p.style.setProperty("--x", `${Math.random() * 100}%`);
      p.style.setProperty("--delay", `${Math.random() * 1.6}s`);
      p.style.setProperty("--dur", `${2.2 + Math.random() * 1.8}s`);
      p.style.setProperty("--rot", `${Math.floor(Math.random() * 360)}deg`);
      p.style.setProperty("--hue", `${Math.floor(Math.random() * 360)}`);
      notify.confettiEl.appendChild(p);
    }
    notify.confettiEl.classList.add("confetti--on");
  }

  function showUnlockPopup(unlockedMeta) {
    if (!unlockedMeta) return;
    notify.titleEl.textContent = "Unlocked!";
    notify.bodyEl.textContent = `${unlockedMeta.label} Unlocked`; // EXACT format you asked for
    notify.okBtn.textContent = "Back to Interface";
    if (notify.confettiEl) {
      notify.confettiEl.innerHTML = "";
      notify.confettiEl.classList.remove("confetti--on");
    }
    openNotifyModal();
  }

  function showWinnerPopup(path) {
    const map = {
      blue: "Blue Path Winner!!",
      purple: "Purple Path Winner!!",
      orange: "Orange Path Winner!!",
      white: "White Path Winner!!",
      gold: "Grand Prize Winner!!"
    };
    notify.titleEl.textContent = "Congratulations!!!";
    notify.bodyEl.textContent = `You're the ${map[path] || "Winner!!"}`;
    notify.okBtn.textContent = "Acknowledge";
    buildConfetti();
    openNotifyModal();

    try {
      sfxWinner.currentTime = 0;
      sfxWinner.play().catch(() => {});
    } catch {}
  }

  // =========================
  // CLUE DATA (your existing setup)
  // =========================
  const PATH_UNLOCK_CODES = {
    main: "CHRISTMAS2025",
    blue: "BLUECODEPLACEHOLDER",
    purple: "PURPLECODEPLACEHOLDER",
    orange: "ORANGECODEPLACEHOLDER",
    white: "WHITECODEPLACEHOLDER"
  };

  const HINT_DELAY_MS = [
    60 * 60 * 1000,
    2 * 60 * 60 * 1000,
    3 * 60 * 60 * 1000
  ];

  // Your existing CLUE_DATA structure
  const CLUE_DATA = {
    "main_13": {
      clueText: "REPLACE ME: Clue text",
      hints: ["REPLACE ME: Hint 1", "REPLACE ME: Hint 2", "REPLACE ME: Hint 3"],
      passcode: "REPLACE13"
    },
    "blue_1": {
      clueText: "BLUE CLUE TEXT — replace later.",
      hints: ["BLUE HINT 1 — replace later.", "BLUE HINT 2 — replace later.", "BLUE HINT 3 — replace later."],
      passcode: "BLUE1_PASSCODE_PLACEHOLDER"
    }
    // (rest of your CLUE_DATA remains in your file already)
  };

  function makeClue(obj) { return obj; }

  function buildClues() {
    const clues = [];

    // Main: 20
    for (let i = 1; i <= 20; i++) {
      const id = `main_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "main",
        label: `Main Path Clue ${i}`,
        colorDotClass: "redGreen",
        isLastInPath: i === 20,
        clueText: d.clueText || "MAIN CLUE TEXT — replace later.",
        hints: d.hints || ["MAIN HINT 1 — replace later.", "MAIN HINT 2 — replace later.", "MAIN HINT 3 — replace later."],
        passcode: d.passcode || `MAIN${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Blue: 6
    for (let i = 1; i <= 6; i++) {
      const id = `blue_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "blue",
        label: `Blue Ornament Clue ${i}`,
        colorDotClass: "blue",
        isLastInPath: i === 6,
        clueText: d.clueText || "BLUE CLUE TEXT — replace later.",
        hints: d.hints || ["BLUE HINT 1 — replace later.", "BLUE HINT 2 — replace later.", "BLUE HINT 3 — replace later."],
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
        label: `Purple Ornament Clue ${i}`,
        colorDotClass: "purple",
        isLastInPath: i === 5,
        clueText: d.clueText || "PURPLE CLUE TEXT — replace later.",
        hints: d.hints || ["PURPLE HINT 1 — replace later.", "PURPLE HINT 2 — replace later.", "PURPLE HINT 3 — replace later."],
        passcode: d.passcode || `PURPLE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Orange: 5
    for (let i = 1; i <= 5; i++) {
      const id = `orange_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "orange",
        label: `Orange Ornament Clue ${i}`,
        colorDotClass: "orange",
        isLastInPath: i === 5,
        clueText: d.clueText || "ORANGE CLUE TEXT — replace later.",
        hints: d.hints || ["ORANGE HINT 1 — replace later.", "ORANGE HINT 2 — replace later.", "ORANGE HINT 3 — replace later."],
        passcode: d.passcode || `ORANGE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // White: 5
    for (let i = 1; i <= 5; i++) {
      const id = `white_${i}`;
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "white",
        label: `White Ornament Clue ${i}`,
        colorDotClass: "white",
        isLastInPath: i === 5,
        clueText: d.clueText || "WHITE CLUE TEXT — replace later.",
        hints: d.hints || ["WHITE HINT 1 — replace later.", "WHITE HINT 2 — replace later.", "WHITE HINT 3 — replace later."],
        passcode: d.passcode || `WHITE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Gold: 1 (FINAL)
    {
      const id = "gold_final";
      const d = CLUE_DATA[id] || {};
      clues.push(makeClue({
        id,
        path: "gold",
        label: "Gold Ornament Final Clue",
        colorDotClass: "gold",
        isLastInPath: true,
        clueText: d.clueText || "GOLD CLUE TEXT — replace later.",
        hints: d.hints || ["GOLD HINT 1 — replace later.", "GOLD HINT 2 — replace later.", "GOLD HINT 3 — replace later."],
        passcode: d.passcode || `GOLD_FINAL_PASSCODE_PLACEHOLDER`
      }));
    }

    return clues;
  }

  const ALL_CLUES = buildClues();

  const PASSCODES = {};
  ALL_CLUES.forEach(c => { PASSCODES[c.id] = c.passcode || ""; });

  const PLAYLIST = [
    { name: "Song 1", src: "./assets/music/song1.mp3" }
    // (your playlist stays in your file already)
  ];

  // =========================
  // STATE
  // =========================
  const defaultState = () => ({
    hasEnteredApp: false,
    playerName: "",
    nameLocked: false,
    clues: {},
    localPlayers: {},
    music: {
      enabled: true,
      playing: false,
      currentIndex: 0,
      shuffled: [],
      volume: 0.5
    },
    backend: { authed: false }
  });

  let state = loadState();

  function initState(s) {
    ALL_CLUES.forEach(c => {
      if (!s.clues[c.id]) s.clues[c.id] = { unlocked: false, unlockedAt: 0, solved: false };
    });
    if (!s.localPlayers) s.localPlayers = {};
    if (!s.music) s.music = defaultState().music;
    return s;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initState(defaultState());
      const parsed = JSON.parse(raw);
      return initState({ ...defaultState(), ...parsed });
    } catch {
      return initState(defaultState());
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function now() { return Date.now(); }

  // =========================
  // SCREEN
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

  playBtn.addEventListener("click", () => {
    state.hasEnteredApp = true;
    saveState();
    setScreen(true);
    renderAll();
    if (state.music.enabled) tryStartMusic();
  });

  // =========================
  // RULES MODAL
  // =========================
  function openRules() {
    rulesModal.classList.add("modal--open");
    rulesModal.setAttribute("aria-hidden", "false");
  }
  function closeRules() {
    rulesModal.classList.remove("modal--open");
    rulesModal.setAttribute("aria-hidden", "true");
  }
  howBtn.addEventListener("click", openRules);
  rulesCloseBtn.addEventListener("click", closeRules);
  rulesModal.addEventListener("click", (e) => { if (e.target === rulesModal) closeRules(); });

  // =========================
  // RESET
  // =========================
  resetBtn.addEventListener("click", () => {
    const t = (resetInput.value || "").trim().toUpperCase();
    if (t !== "RESET") {
      resetMsg.textContent = 'Type "RESET" exactly to confirm.';
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    state = initState(defaultState());
    saveState();
    resetMsg.textContent = "Reset complete.";
    closeRules();
    setScreen(false);
    renderAll();
  });

  // =========================
  // BACKEND
  // =========================
  async function ensureAuthed() {
    if (!BACKEND_ENABLED) return;
    if (state.backend.authed) return;

    const { data } = await supabase.auth.getSession();
    if (!data?.session) {
      await supabase.auth.signInAnonymously();
    }
    state.backend.authed = true;
    saveState();
  }

  function getPathClues(path) { return ALL_CLUES.filter(c => c.path === path); }

  function totalInPath(path) { return getPathClues(path).length; }
  function countSolved(path) { return getPathClues(path).filter(c => state.clues[c.id]?.solved).length; }

  function summarizeProgress() {
    return {
      mainSolved: countSolved("main"), mainTotal: totalInPath("main"),
      blueSolved: countSolved("blue"), blueTotal: totalInPath("blue"),
      purpleSolved: countSolved("purple"), purpleTotal: totalInPath("purple"),
      orangeSolved: countSolved("orange"), orangeTotal: totalInPath("orange"),
      whiteSolved: countSolved("white"), whiteTotal: totalInPath("white")
    };
  }

  function syncLocalLeaderboard() {
    const name = (state.playerName || "").trim();
    if (!name) return;

    state.localPlayers[name] = {
      name,
      updatedAt: now(),
      progress: summarizeProgress()
    };
  }

  async function saveRemotePlayer() {
    await ensureAuthed();
    const name = (state.playerName || "").trim();
    if (!name) return;

    const progress = summarizeProgress();
    await supabase
      .from("players")
      .upsert({
        name,
        main_solved: progress.mainSolved,
        blue_solved: progress.blueSolved,
        purple_solved: progress.purpleSolved,
        orange_solved: progress.orangeSolved,
        white_solved: progress.whiteSolved,
        updated_at: new Date().toISOString()
      }, { onConflict: "name" });
  }

  async function fetchRemoteLeaderboard() {
    await ensureAuthed();
    const { data, error } = await supabase
      .from("players")
      .select("*")
      .order("main_solved", { ascending: false })
      .order("updated_at", { ascending: true });

    if (error) return;

    data.forEach(row => {
      state.localPlayers[row.name] = {
        name: row.name,
        updatedAt: now(),
        progress: {
          mainSolved: row.main_solved || 0, mainTotal: totalInPath("main"),
          blueSolved: row.blue_solved || 0, blueTotal: totalInPath("blue"),
          purpleSolved: row.purple_solved || 0, purpleTotal: totalInPath("purple"),
          orangeSolved: row.orange_solved || 0, orangeTotal: totalInPath("orange"),
          whiteSolved: row.white_solved || 0, whiteTotal: totalInPath("white")
        }
      };
    });

    saveState();
  }

  function subscribeRealtime() {
    if (!BACKEND_ENABLED) return;

    supabase
      .channel("players-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, async () => {
        try {
          await fetchRemoteLeaderboard();
          renderLeaderboard();
        } catch {}
      })
      .subscribe();
  }

  // =========================
  // UNLOCK / SOLVE LOGIC
  // =========================
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
  }

  function eligibleRandomClueIds(path) {
    const clues = getPathClues(path);
    const last = clues.find(c => c.isLastInPath);
    const lastId = last ? last.id : null;

    return clues.filter(c => {
      const cs = state.clues[c.id];
      if (cs.unlocked) return false;
      if (c.id === lastId) {
        const others = clues.filter(x => x.id !== lastId);
        return others.every(x => state.clues[x.id].solved);
      }
      return true;
    }).map(c => c.id);
  }

  function unlockRandomInPath(path) {
    const eligible = eligibleRandomClueIds(path);
    if (!eligible.length) return null;
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    unlockClue(pick);
    return pick;
  }

  function isGoldUnlockedByRules() {
    return getPathClues("main").every(c => state.clues[c.id]?.solved);
  }

  function solveClue(id, enteredPass) {
    const cs = state.clues[id];
    const clueMeta = ALL_CLUES.find(c => c.id === id);

    const expected = PASSCODES[id] ?? "";
    const passOk = ((enteredPass || "").trim() === (expected || "").trim());

    // Winner replay on reload/resubmit (FINAL clues only)
    if (cs?.solved) {
      const isFinalSide = clueMeta && ["blue","purple","orange","white"].includes(clueMeta.path) && !!clueMeta.isLastInPath;
      const isFinalGold = clueMeta && (clueMeta.id === "gold_final" || clueMeta.path === "gold") && !!clueMeta.isLastInPath;
      if ((isFinalSide || isFinalGold) && passOk) {
        showWinnerPopup(isFinalGold ? "gold" : clueMeta.path);
        return { ok:true, msg:"Winner replayed." };
      }
      return { ok:false, msg:"Already solved." };
    }

    if (!cs?.unlocked) return { ok:false, msg:"Clue not unlocked." };
    if (!passOk) return { ok:false, msg:"Incorrect passcode." };

    cs.solved = true;
    saveState();

    const isFinalSide = clueMeta && ["blue","purple","orange","white"].includes(clueMeta.path) && !!clueMeta.isLastInPath;
    const isFinalGold = clueMeta && (clueMeta.id === "gold_final" || clueMeta.path === "gold") && !!clueMeta.isLastInPath;

    if (isFinalSide || isFinalGold) {
      renderAll();
      showWinnerPopup(isFinalGold ? "gold" : clueMeta.path);
      return { ok:true, msg:"Solved (winner)." };
    }

    let unlockedClueId = null;

    if (clueMeta?.path === "main") {
      unlockedClueId = unlockRandomInPath("main") || null;

      const goldWasUnlocked = !!state.clues["gold_final"]?.unlocked;
      if (isGoldUnlockedByRules() && !goldWasUnlocked) {
        unlockClue("gold_final");
        unlockedClueId = "gold_final";
      }
    } else if (["blue","purple","orange","white"].includes(clueMeta?.path)) {
      unlockedClueId = unlockRandomInPath(clueMeta.path) || null;
    }

    renderAll();

    if (unlockedClueId) {
      const unlockedMeta = ALL_CLUES.find(c => c.id === unlockedClueId);
      const unlockedIsFinalSide = unlockedMeta && ["blue","purple","orange","white"].includes(unlockedMeta.path) && !!unlockedMeta.isLastInPath;
      const unlockedIsFinalGold = unlockedMeta && (unlockedMeta.id === "gold_final" || unlockedMeta.path === "gold") && !!unlockedMeta.isLastInPath;

      // No normal unlock popup for LAST clues (except we DO want them to see gold appeared)
      if (!unlockedIsFinalSide && !unlockedIsFinalGold) {
        showUnlockPopup(unlockedMeta);
      } else if (unlockedMeta && unlockedMeta.id === "gold_final") {
        showUnlockPopup(unlockedMeta);
      }
    }

    return { ok:true, msg:"Solved!" };
  }

  // =========================
  // HINT COUNTDOWNS
  // =========================
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
  // RENDER
  // =========================
  function renderAll() {
    setScreen(!!state.hasEnteredApp);
    renderName();
    renderLeaderboard();
    renderClues();
    renderPlaylist();
    renderMusicControls();
  }

  function renderName() {
    const locked = !!state.nameLocked;
    playerNameInput.value = state.playerName || "";
    playerNameInput.disabled = locked;
    saveNameBtn.disabled = locked;

    nameLockedMsg.textContent = locked
      ? "Name saved and locked."
      : "Enter your name and press Save.";
  }

  function progressBar(label, solved, total) {
    const pct = total ? Math.round((solved / total) * 100) : 0;
    return `
      <div class="pbRow">
        <div class="pbLabel">${label}: ${solved}/${total}</div>
        <div class="pbOuter"><div class="pbInner" style="width:${pct}%"></div></div>
      </div>
    `;
  }

  function renderLeaderboard() {
    const players = Object.values(state.localPlayers || {});
    const sorted = players.sort((a, b) => {
      const am = a.progress?.mainSolved ?? 0;
      const bm = b.progress?.mainSolved ?? 0;
      if (bm !== am) return bm - am;
      return (a.updatedAt ?? 0) - (b.updatedAt ?? 0);
    });

    leaderboardEl.innerHTML = "";

    if (!sorted.length) {
      leaderboardEl.innerHTML = `<div class="labelSub">No players yet.</div>`;
      return;
    }

    sorted.forEach((p, idx) => {
      const pr = p.progress || {};
      const row = document.createElement("div");
      row.className = "lbRow";

      row.innerHTML = `
        <div class="lbTop">
          <div class="lbName">${p.name}</div>
          <div class="lbRank">#${idx + 1}</div>
        </div>
        <div class="pbWrap">
          ${progressBar("Main Path", pr.mainSolved, pr.mainTotal)}
          ${progressBar("Blue Path", pr.blueSolved, pr.blueTotal)}
          ${progressBar("Purple Path", pr.purpleSolved, pr.purpleTotal)}
          ${progressBar("Orange Path", pr.orangeSolved, pr.orangeTotal)}
          ${progressBar("White Path", pr.whiteSolved, pr.whiteTotal)}
        </div>
      `;
      leaderboardEl.appendChild(row);
    });
  }

  function renderHint(c, hintIndex) {
    const info = hintCountdownInfo(c.id, hintIndex);
    const title = `Hint ${hintIndex + 1}`;
    if (!state.clues[c.id]?.unlocked) {
      return `
        <div class="hintBox">
          <div class="hintHead">
            <div>${title}</div>
            <div>Locked</div>
          </div>
          <div class="hintBody">Unlock this clue to start the timer.</div>
        </div>
      `;
    }

    if (info.unlocked) {
      const hintText = (c.hints && c.hints[hintIndex]) ? c.hints[hintIndex] : "(edit hint)";
      return `
        <div class="hintBox">
          <div class="hintHead">
            <div>${title}</div>
            <div>Unlocked</div>
          </div>
          <div class="hintBody">${hintText}</div>
        </div>
      `;
    }

    return `
      <div class="hintBox">
        <div class="hintHead">
          <div>${title}</div>
          <div>Unlocks in ${info.remainingText}</div>
        </div>
        <div class="hintBody">Waiting…</div>
      </div>
    `;
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

  function renderClues() {
    clueContainer.innerHTML = "";
    const inOrder = ALL_CLUES.slice();

    inOrder.forEach(c => {
      const cs = state.clues[c.id] || { unlocked:false, solved:false };
      const unlocked = !!cs.unlocked;
      const solved = !!cs.solved;
      const stateText = solved ? "Solved" : (unlocked ? "Unlocked" : "Locked");

      const card = document.createElement("div");
      card.className = "clueCard";

      card.innerHTML = `
        <div class="clueTop">
          <div class="clueLeft">
            <div class="dot ${c.colorDotClass || c.path}"></div>
            <div>
              <div class="clueTitle">${c.label}</div>
              <div class="clueState">${stateText}</div>
            </div>
          </div>
        </div>

        <div class="clueText">${unlocked ? c.clueText : "🔒 Locked"}</div>

        ${renderPasscodeControls(c, unlocked, solved)}

        <div class="hints">
          ${renderHint(c, 0)}
          ${renderHint(c, 1)}
          ${renderHint(c, 2)}
        </div>
      `;

      clueContainer.appendChild(card);
    });

    clueContainer.querySelectorAll("[data-solve]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-solve");
        const input = clueContainer.querySelector(`[data-pass="${id}"]`);
        const entered = input ? input.value : "";
        const msgEl = clueContainer.querySelector(`[data-msg="${id}"]`);

        const res = solveClue(id, entered);
        if (!res.ok) {
          if (msgEl) msgEl.textContent = res.msg;
          return;
        }

        if (msgEl) msgEl.textContent = "✅ Correct!";
        if (input) input.value = "";

        syncLocalLeaderboard();
        saveState();

        if (BACKEND_ENABLED) {
          try {
            await saveRemotePlayer();
            await fetchRemoteLeaderboard();
          } catch {}
        }

        renderAll();
      });
    });
  }

  // =========================
  // NAME SAVE
  // =========================
  saveNameBtn.addEventListener("click", async () => {
    if (state.nameLocked) return;

    const name = (playerNameInput.value || "").trim();
    if (!name) return;

    state.playerName = name;
    state.nameLocked = true;

    syncLocalLeaderboard();
    saveState();

    if (BACKEND_ENABLED) {
      try {
        await saveRemotePlayer();
        await fetchRemoteLeaderboard();
      } catch {}
    }

    renderAll();
  });

  // Leaderboard refresh button
  if (refreshLeaderboardBtn) {
    refreshLeaderboardBtn.addEventListener("click", async () => {
      if (BACKEND_ENABLED) {
        try { await fetchRemoteLeaderboard(); } catch {}
      }
      renderLeaderboard();
    });
  }

  // =========================
  // MUSIC (keep your existing)
  // =========================
  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function ensureShuffle() {
    if (!state.music.shuffled || state.music.shuffled.length !== PLAYLIST.length) {
      state.music.shuffled = shuffleArray(PLAYLIST.map((t, i) => i));
      state.music.currentIndex = 0;
      saveState();
    }
  }

  function currentTrackIndex() {
    ensureShuffle();
    return state.music.shuffled[state.music.currentIndex] ?? 0;
  }

  function loadTrackByShuffleIndex(si) {
    ensureShuffle();
    state.music.currentIndex = (si + state.music.shuffled.length) % state.music.shuffled.length;
    const realIdx = currentTrackIndex();
    const track = PLAYLIST[realIdx];
    if (!track) return;
    bgm.src = track.src;
    bgm.volume = state.music.volume ?? 0.5;
    saveState();
    renderPlaylist();
  }

  function play() {
    if (!state.music.enabled) return;
    if (!bgm.src) loadTrackByShuffleIndex(state.music.currentIndex);
    bgm.play().then(() => {
      state.music.playing = true;
      saveState();
      renderMusicControls();
    }).catch(() => {});
  }

  function pause() {
    bgm.pause();
    state.music.playing = false;
    saveState();
    renderMusicControls();
  }

  function tryStartMusic() {
    if (!state.music.enabled) return;
    if (state.music.playing) return;
    play();
  }

  function playRandomNextTrack() {
    ensureShuffle();
    loadTrackByShuffleIndex(state.music.currentIndex + 1);
    if (state.music.enabled) play();
  }

  bgm.addEventListener("ended", () => {
    if (!state.music.enabled) return;
    if (!state.music.playing) return;
    playRandomNextTrack();
  });

  function renderPlaylist() {
    const el = document.getElementById("playlist");
    if (!el) return;

    el.innerHTML = "";
    if (!PLAYLIST.length) {
      el.innerHTML = `<div class="labelSub">No tracks found.</div>`;
      return;
    }

    ensureShuffle();
    const activeRealIdx = currentTrackIndex();

    PLAYLIST.forEach((t, realIdx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "trackBtn" + (realIdx === activeRealIdx ? " trackBtn--active" : "");
      btn.innerHTML = `<span>${t.name}</span><span class="labelSub">${realIdx === activeRealIdx ? "Playing/Selected" : ""}</span>`;
      btn.addEventListener("click", () => {
        const si = state.music.shuffled.indexOf(realIdx);
        if (si >= 0) loadTrackByShuffleIndex(si);
        if (state.music.enabled) play();
      });
      el.appendChild(btn);
    });
  }

  function renderMusicControls() {
    const playPause = document.getElementById("musicPlayPause");
    const enabled = document.getElementById("musicEnabled");
    if (!playPause || !enabled) return;

    enabled.checked = !!state.music.enabled;
    playPause.textContent = state.music.playing ? "⏸" : "▶️";
  }

  function openMusicDrawer() {
    musicDrawer.classList.add("drawer--open");
    musicDrawer.setAttribute("aria-hidden", "false");
    musicToggleBtn.setAttribute("aria-expanded", "true");
  }
  function closeMusicDrawer() {
    musicDrawer.classList.remove("drawer--open");
    musicDrawer.setAttribute("aria-hidden", "true");
    musicToggleBtn.setAttribute("aria-expanded", "false");
  }

  if (musicToggleBtn && musicDrawer) {
    musicToggleBtn.addEventListener("click", () => {
      const open = musicDrawer.classList.contains("drawer--open");
      open ? closeMusicDrawer() : openMusicDrawer();
    });
  }
  if (musicCloseBtn) musicCloseBtn.addEventListener("click", closeMusicDrawer);

  const musicEnabled = document.getElementById("musicEnabled");
  const musicPrev = document.getElementById("musicPrev");
  const musicNext = document.getElementById("musicNext");
  const musicPlayPause = document.getElementById("musicPlayPause");

  if (musicEnabled) {
    musicEnabled.addEventListener("change", (e) => {
      state.music.enabled = !!e.target.checked;
      saveState();
      if (state.music.enabled) tryStartMusic();
      else pause();
      renderMusicControls();
    });
  }

  if (musicPrev) {
    musicPrev.addEventListener("click", () => {
      ensureShuffle();
      loadTrackByShuffleIndex(state.music.currentIndex - 1);
      if (state.music.enabled) play();
    });
  }

  if (musicNext) {
    musicNext.addEventListener("click", () => {
      playRandomNextTrack();
    });
  }

  if (musicPlayPause) {
    musicPlayPause.addEventListener("click", () => {
      if (!state.music.enabled) return;
      if (state.music.playing) pause();
      else play();
    });
  }

  // =========================
  // BOOT
  // =========================
  async function boot() {
    setScreen(!!state.hasEnteredApp);
    renderAll();

    if (BACKEND_ENABLED) {
      try {
        await ensureAuthed();
        await fetchRemoteLeaderboard();
        subscribeRealtime();
        renderLeaderboard();
      } catch {}
    }

    if (state.hasEnteredApp && state.music.enabled) {
      tryStartMusic();
    }
  }

  boot();
})();
