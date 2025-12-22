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
  const SUPABASE_ANON_KEY = "YOUR_ANON_KEY_HERE";                       // <-- paste your anon public key
  const BACKEND_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== "YOUR_ANON_KEY_HERE");

  // Hint unlock schedule (minutes)
  const HINT_DELAY_MS = [10, 30, 60].map(m => m * 60 * 1000);

  // =========================
  // PATH TOTALS (for progress bars)
  // =========================
  const TOTALS = {
    main: 20,
    blue: 6,
    purple: 5,
    orange: 4,
    white: 3
  };

  // =========================
  // PATH UNLOCK CODES
  // =========================
  const PATH_CODES = {
    main: "CHRISTMAS2025",
    blue: "BLUE2025",
    purple: "PURPLE2025",
    orange: "ORANGE2025",
    white: "WHITE2025"
  };

  // =========================
  // PLAYLIST (edit file names/titles)
  // =========================
  const PLAYLIST = [
    { title: "Music 1", file: "assets/music1.mp3" },
    { title: "Music 2", file: "assets/music2.mp3" },
    { title: "Music 3", file: "assets/music3.mp3" }
  ];

  // =========================
  // CLUE DATA MAP (EDIT HERE)
  // =========================
  const CLUE_DATA = {
    // Example:
    // "main_1": { clueText:"...", hints:["...","...","..."], passcode:"TREE123" },
  };

  // =========================
  // DEFAULT CLUE LIST STRUCTURE
  // =========================
  const PATHS_IN_ORDER = ["main", "blue", "purple", "orange", "white"];

  function buildAllClueIds() {
    const ids = [];
    for (const p of PATHS_IN_ORDER) {
      for (let i = 1; i <= TOTALS[p]; i++) ids.push(`${p}_${i}`);
    }
    ids.push("gold_final");
    return ids;
  }

  const ALL_CLUE_IDS = buildAllClueIds();

  // =========================
  // STATE
  // =========================
  const defaultState = {
    playerName: "",
    nameLocked: false,

    unlockedPaths: {
      main: false,
      blue: false,
      purple: false,
      orange: false,
      white: false
    },

    // clueTimers[clueId] = { startedAt: timestamp }
    clueTimers: {},

    // solved[clueId] = true
    solved: {},

    // local leaderboard fallback
    localPlayers: {},

    // remote leaderboard
    remotePlayers: {},

    // music state
    music: {
      enabled: true,
      playing: false,
      trackIndex: 0
    }
  };

  let state = loadState() || structuredClone(defaultState);

  // =========================
  // DOM
  // =========================
  const startScreen = document.getElementById("startScreen");
  const appScreen = document.getElementById("appScreen");
  const playBtn = document.getElementById("playBtn");

  const nameInput = document.getElementById("nameInput");
  const saveNameBtn = document.getElementById("saveNameBtn");
  const nameLockedTag = document.getElementById("nameLockedTag");

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

  const clueListEl = document.getElementById("clueList");
  const leaderboardEl = document.getElementById("leaderboard");

  // Tabs
  const tabBtns = document.querySelectorAll("[data-tab]");
  const tabPanels = document.querySelectorAll(".tabPanel");

  // Music
  const musicEnabled = document.getElementById("musicEnabled");
  const musicPlayPause = document.getElementById("musicPlayPause");
  const musicPrev = document.getElementById("musicPrev");
  const musicNext = document.getElementById("musicNext");
  const playlistEl = document.getElementById("playlist");

  const bgm = new Audio();
  bgm.preload = "auto";

  let supabase = null;
  let userId = null;

  // =========================
  // UTIL
  // =========================
  function now() { return Date.now(); }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeCode(s) {
    return String(s ?? "").trim().toUpperCase();
  }

  function getClueDef(clueId) {
    const d = CLUE_DATA[clueId] || {};
    const [path, n] = clueId.split("_");
    const prettyPath = path === "main" ? "Main" : path?.charAt(0).toUpperCase() + path?.slice(1);
    const defaultText = clueId === "gold_final"
      ? "Gold Final: Follow the final instructions to claim the grand prize."
      : `${prettyPath} Clue ${n}: (Edit this clue in CLUE_DATA)`;

    return {
      clueText: d.clueText || defaultText,
      hints: Array.isArray(d.hints) ? d.hints : ["(Hint 1 not set)", "(Hint 2 not set)", "(Hint 3 not set)"],
      passcode: d.passcode || (clueId === "gold_final" ? "" : `PASS_${clueId.toUpperCase()}`)
    };
  }

  function startClueTimer(clueId) {
    if (state.clueTimers[clueId]?.startedAt) return;
    state.clueTimers[clueId] = { startedAt: now() };
    saveState();
  }

  function getHintStatus(clueId, hintIndex) {
    const startedAt = state.clueTimers[clueId]?.startedAt;
    if (!startedAt) return { unlocked: false, remainingText: "00:00" };
    const delay = HINT_DELAY_MS[hintIndex];
    const remaining = Math.max(0, (startedAt + delay) - now());
    const totalSec = Math.ceil(remaining / 1000);
    const mm = String(Math.floor(totalSec / 60));
    const ss = String(totalSec % 60).padStart(2, "0");
    const remainingText = `${mm}:${ss}`;
    return { unlocked: remaining === 0, remainingText };
  }

  function computeProgressSnapshot() {
    const snapshot = {
      mainSolved: 0,
      blueSolved: 0,
      purpleSolved: 0,
      orangeSolved: 0,
      whiteSolved: 0,
      goldUnlocked: false,
      goldSolved: !!state.solved["gold_final"]
    };

    for (const id of Object.keys(state.solved)) {
      if (!state.solved[id]) continue;
      const [path] = id.split("_");
      if (path === "main") snapshot.mainSolved++;
      if (path === "blue") snapshot.blueSolved++;
      if (path === "purple") snapshot.purpleSolved++;
      if (path === "orange") snapshot.orangeSolved++;
      if (path === "white") snapshot.whiteSolved++;
    }

    // gold unlock rule: main completion
    snapshot.goldUnlocked = snapshot.mainSolved >= TOTALS.main;
    return snapshot;
  }

  // =========================
  // SUPABASE
  // =========================
  async function initSupabaseIfEnabled() {
    if (!BACKEND_ENABLED) return;

    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      console.error("Remote init error:", error);
      return;
    }

    userId = data?.user?.id || null;

    // Realtime updates (leaderboard)
    supabase
      .channel("players-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, async () => {
        await loadRemotePlayers();
        renderLeaderboard();
      })
      .subscribe();
  }

  async function saveRemotePlayerRow() {
    if (!BACKEND_ENABLED || !supabase || !userId) return;
    if (!state.nameLocked || !state.playerName) return;

    const p = computeProgressSnapshot();

    const row = {
      id: userId,
      name: state.playerName,
      main_solved: p.mainSolved,
      blue_solved: p.blueSolved,
      purple_solved: p.purpleSolved,
      orange_solved: p.orangeSolved,
      white_solved: p.whiteSolved,
      gold_unlocked: !!p.goldUnlocked,
      gold_solved: !!p.goldSolved,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from("players").upsert(row, { onConflict: "id" });
    if (error) console.error("saveRemotePlayerRow error:", error);
  }

  async function loadRemotePlayers() {
    if (!BACKEND_ENABLED || !supabase) return;

    const { data, error } = await supabase
      .from("players")
      .select("id,name,main_solved,blue_solved,purple_solved,orange_solved,white_solved,gold_unlocked,gold_solved,updated_at");

    if (error) {
      console.error("loadRemotePlayers error:", error);
      return;
    }

    state.remotePlayers = {};
    for (const row of (data || [])) state.remotePlayers[row.id] = row;
    saveState();
  }

  // =========================
  // MUSIC
  // =========================
  // Shuffle history so "Prev" makes sense in shuffle mode
  const shuffleHistory = [];
  const maxHistory = 50;

  function pushHistory(trackIndex) {
    shuffleHistory.push(trackIndex);
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

  function loadTrack(index) {
    if (!PLAYLIST.length) return;
    const safeIndex = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    state.music.trackIndex = safeIndex;
    bgm.src = PLAYLIST[safeIndex].file;

    // IMPORTANT: don't loop a single track; we'll shuffle on "ended"
    bgm.loop = false;

    saveState();
    renderPlaylist();
  }

  function playMusic() {
    if (!state.music.enabled || !PLAYLIST.length) return;
    state.music.playing = true;
    saveState();

    bgm.volume = 0.6;
    bgm.play().catch(() => { /* autoplay restrictions handled by click start */ });
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

  // When a track ends, automatically shuffle to a different track
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
  // UI: Tabs
  // =========================
  function setActiveTab(tabId) {
    tabBtns.forEach(btn => {
      btn.classList.toggle("tabBtn--active", btn.dataset.tab === tabId);
    });
    tabPanels.forEach(panel => {
      panel.classList.toggle("tabPanel--active", panel.id === tabId);
    });
  }

  // =========================
  // RENDER
  // =========================
  function renderStartOrApp() {
    const inApp = !!state.nameLocked;
    if (inApp) {
      startScreen.classList.remove("screen--active");
      appScreen.classList.add("screen--active");
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
          <div class="trackMeta">${idx === state.music.trackIndex ? (state.music.enabled ? (state.music.playing ? "Playing" : "Paused") : "Disabled") : (state.music.enabled ? "Tap to select" : "Disabled")}</div>
        </div>
        <button class="btn btn--small" type="button">${idx === state.music.trackIndex ? "✓" : "▶"}</button>
      `;
      div.addEventListener("click", () => {
        // Track manual jumps too so Prev can go back
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
    const useRemote = BACKEND_ENABLED && state.remotePlayers && Object.keys(state.remotePlayers).length;
    const players = useRemote
      ? Object.values(state.remotePlayers).map(p => ({
          name: p.name,
          updatedAt: new Date(p.updated_at || 0).getTime(),
          progress: {
            mainSolved: p.main_solved || 0,
            blueSolved: p.blue_solved || 0,
            purpleSolved: p.purple_solved || 0,
            orangeSolved: p.orange_solved || 0,
            whiteSolved: p.white_solved || 0,
            goldUnlocked: !!p.gold_unlocked,
            goldSolved: !!p.gold_solved
          }
        }))
      : Object.values(state.localPlayers);

    players.sort((a, b) => {
      const ap = a.progress, bp = b.progress;
      if (bp.mainSolved !== ap.mainSolved) return bp.mainSolved - ap.mainSolved;

      const aSide = ap.blueSolved + ap.purpleSolved + ap.orangeSolved + ap.whiteSolved;
      const bSide = bp.blueSolved + bp.purpleSolved + bp.orangeSolved + bp.whiteSolved;
      if (bSide !== aSide) return bSide - aSide;

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

    players.forEach((p, i) => {
      const pr = p.progress;
      const card = document.createElement("div");
      card.className = "lbCard";
      card.innerHTML = `
        <div class="lbTop">
          <div class="lbRank">#${i + 1}</div>
          <div class="lbName">${escapeHtml(p.name)}</div>
          <div class="lbMainScore">${pr.mainSolved}/${TOTALS.main}</div>
        </div>

        <div class="lbRow">
          <div class="lbLabel">Main</div>
          <div class="lbBar"><div class="lbFill" style="width:${pct(pr.mainSolved, TOTALS.main)}%"></div></div>
          <div class="lbNum">${pr.mainSolved}/${TOTALS.main}</div>
        </div>

        <div class="lbRow">
          <div class="lbLabel">Blue</div>
          <div class="lbBar"><div class="lbFill" style="width:${pct(pr.blueSolved, TOTALS.blue)}%"></div></div>
          <div class="lbNum">${pr.blueSolved}/${TOTALS.blue}</div>
        </div>

        <div class="lbRow">
          <div class="lbLabel">Purple</div>
          <div class="lbBar"><div class="lbFill" style="width:${pct(pr.purpleSolved, TOTALS.purple)}%"></div></div>
          <div class="lbNum">${pr.purpleSolved}/${TOTALS.purple}</div>
        </div>

        <div class="lbRow">
          <div class="lbLabel">Orange</div>
          <div class="lbBar"><div class="lbFill" style="width:${pct(pr.orangeSolved, TOTALS.orange)}%"></div></div>
          <div class="lbNum">${pr.orangeSolved}/${TOTALS.orange}</div>
        </div>

        <div class="lbRow">
          <div class="lbLabel">White</div>
          <div class="lbBar"><div class="lbFill" style="width:${pct(pr.whiteSolved, TOTALS.white)}%"></div></div>
          <div class="lbNum">${pr.whiteSolved}/${TOTALS.white}</div>
        </div>

        <div class="lbGold">${pr.goldUnlocked ? (pr.goldSolved ? "Gold: Complete" : "Gold: Unlocked") : "Gold: Locked"}</div>
      `;
      leaderboardEl.appendChild(card);
    });
  }

  function renderNameUI() {
    nameInput.value = state.playerName || "";
    nameInput.disabled = !!state.nameLocked;
    saveNameBtn.disabled = !!state.nameLocked;
    nameLockedTag.style.display = state.nameLocked ? "inline-flex" : "none";
  }

  function renderClues() {
    clueListEl.innerHTML = "";

    for (const clueId of ALL_CLUE_IDS) {
      const def = getClueDef(clueId);
      const solved = !!state.solved[clueId];
      const [path] = clueId.split("_");

      const unlocked = clueId === "gold_final"
        ? computeProgressSnapshot().goldUnlocked
        : !!state.unlockedPaths[path];

      const card = document.createElement("div");
      card.className = "clueCard" + (solved ? " clueSolved" : "");
      card.innerHTML = `
        <div class="clueTop">
          <div class="clueTitle">${escapeHtml(clueId === "gold_final" ? "Gold Final" : `${path.toUpperCase()} ${clueId.split("_")[1]}`)}</div>
          <div class="clueStatus">${solved ? "Solved" : unlocked ? "Unlocked" : "Locked"}</div>
        </div>
        <div class="clueBody">
          ${unlocked ? `<div class="clueText">${escapeHtml(def.clueText)}</div>` : `<div class="labelSub">Unlock this path to view.</div>`}
          ${unlocked ? `
            <div class="hints">
              ${[0,1,2].map(i => {
                const hs = getHintStatus(clueId, i);
                return `
                  <div class="hint">
                    <div class="hintLabel">Hint ${i+1}</div>
                    <div class="hintText" id="hint_${clueId}_${i}">${hs.unlocked ? escapeHtml(def.hints[i]) : `Unlocks in ${hs.remainingText}`}</div>
                  </div>
                `;
              }).join("")}
            </div>
          ` : ""}
          ${unlocked && !solved && clueId !== "gold_final" ? `
            <div class="passRow">
              <input class="input" id="pass_${clueId}" placeholder="Enter passcode" />
              <button class="btn" data-submit="${clueId}">Submit</button>
            </div>
          ` : ""}
          ${unlocked && clueId === "gold_final" && !solved ? `<button class="btn" data-gold="1">Mark Gold Complete</button>` : ""}
        </div>
      `;
      clueListEl.appendChild(card);

      if (unlocked) startClueTimer(clueId);
    }
  }

  function tickHintCountdowns() {
    for (const clueId of ALL_CLUE_IDS) {
      for (let i = 0; i < 3; i++) {
        const el = document.getElementById(`hint_${clueId}_${i}`);
        if (!el) continue;
        const def = getClueDef(clueId);
        const hs = getHintStatus(clueId, i);
        el.textContent = hs.unlocked ? def.hints[i] : `Unlocks in ${hs.remainingText}`;
      }
    }
  }

  function renderAll() {
    renderStartOrApp();
    renderNameUI();
    renderPlaylist();
    renderClues();
    renderLeaderboard();
  }

  // =========================
  // EVENTS
  // =========================
  function wireTabs() {
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        setActiveTab(btn.dataset.tab);
      });
    });
  }

  function wireUnlocks() {
    unlockMainBtn.addEventListener("click", () => {
      if (normalizeCode(unlockMainInput.value) === normalizeCode(PATH_CODES.main)) {
        state.unlockedPaths.main = true;
        saveState();
        renderClues();
      }
      unlockMainInput.value = "";
    });

    unlockBlueBtn.addEventListener("click", () => {
      if (normalizeCode(unlockBlueInput.value) === normalizeCode(PATH_CODES.blue)) {
        state.unlockedPaths.blue = true;
        saveState();
        renderClues();
      }
      unlockBlueInput.value = "";
    });

    unlockPurpleBtn.addEventListener("click", () => {
      if (normalizeCode(unlockPurpleInput.value) === normalizeCode(PATH_CODES.purple)) {
        state.unlockedPaths.purple = true;
        saveState();
        renderClues();
      }
      unlockPurpleInput.value = "";
    });

    unlockOrangeBtn.addEventListener("click", () => {
      if (normalizeCode(unlockOrangeInput.value) === normalizeCode(PATH_CODES.orange)) {
        state.unlockedPaths.orange = true;
        saveState();
        renderClues();
      }
      unlockOrangeInput.value = "";
    });

    unlockWhiteBtn.addEventListener("click", () => {
      if (normalizeCode(unlockWhiteInput.value) === normalizeCode(PATH_CODES.white)) {
        state.unlockedPaths.white = true;
        saveState();
        renderClues();
      }
      unlockWhiteInput.value = "";
    });
  }

  function wireNameSave() {
    saveNameBtn.addEventListener("click", async () => {
      const name = (nameInput.value || "").trim();
      if (!name) return;

      state.playerName = name;
      state.nameLocked = true;
      saveState();
      syncLocalLeaderboard();
      renderAll();

      await saveRemotePlayerRow();
      await loadRemotePlayers();
      renderLeaderboard();
    });
  }

  function wirePlayButton() {
    playBtn.addEventListener("click", async () => {
      // start app screen
      state.nameLocked = false;
      saveState();
      renderStartOrApp();

      // Music auto-start on first user interaction (works best on mobile)
      if (state.music.enabled) {
        if (!PLAYLIST.length) return;
        loadTrack(state.music.trackIndex || 0);
        playMusic();
      }
    });
  }

  function wireClueSubmissions() {
    clueListEl.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      if (btn.dataset.submit) {
        const clueId = btn.dataset.submit;
        const def = getClueDef(clueId);
        const input = document.getElementById(`pass_${clueId}`);
        const typed = normalizeCode(input?.value || "");
        const expected = normalizeCode(def.passcode || "");
        if (!typed || typed !== expected) {
          if (input) {
            input.value = "";
            input.placeholder = "Incorrect — try again";
          }
          return;
        }

        state.solved[clueId] = true;
        saveState();
        syncLocalLeaderboard();
        renderClues();
        renderLeaderboard();

        await saveRemotePlayerRow();
        await loadRemotePlayers();
        renderLeaderboard();
      }

      if (btn.dataset.gold) {
        state.solved["gold_final"] = true;
        saveState();
        syncLocalLeaderboard();
        renderClues();
        renderLeaderboard();

        await saveRemotePlayerRow();
        await loadRemotePlayers();
        renderLeaderboard();
      }
    });
  }

  function wireMusicControls() {
    musicEnabled.addEventListener("change", () => {
      state.music.enabled = !!musicEnabled.checked;
      saveState();
      if (!state.music.enabled) pauseMusic();
      else if (!state.music.playing) playMusic();
      renderPlaylist();
    });

    musicPlayPause.addEventListener("click", () => toggleMusic());

    musicPrev.addEventListener("click", () => {
      playPreviousFromHistory();
    });
    musicNext.addEventListener("click", () => {
      playRandomNextTrack();
    });
  }

  // =========================
  // BOOT
  // =========================
  async function boot() {
    wireTabs();
    wireUnlocks();
    wireNameSave();
    wirePlayButton();
    wireClueSubmissions();
    wireMusicControls();

    // initial track
    if (PLAYLIST.length) loadTrack(state.music.trackIndex || 0);

    renderAll();

    // tick hint countdowns every second
    setInterval(() => tickHintCountdowns(), 1000);

    // init backend
    await initSupabaseIfEnabled();
    if (BACKEND_ENABLED) {
      await loadRemotePlayers();
      renderLeaderboard();
    }
  }

  boot();
})();
