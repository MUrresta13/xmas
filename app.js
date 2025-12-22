/* Xmas Hunt 2025
   - Saves progress to localStorage
   - Random unlock per pathway with “last clue locked until all others solved”
   - Timed hint unlocks: 10/30/60 minutes after clue unlock time (visible countdown)
   - Unlock SFX plays without interrupting background music
*/

(() => {
  const STORAGE_KEY = "xmasHunt2025_state_v2";

  // =========================
  // CONFIG YOU EDIT LATER
  // =========================

  // Path unlock passcodes (placeholders)
  const PATH_UNLOCK_CODES = {
    main: "CHRISTMAS2025",
    blue: "BLUECODEPLACEHOLDER",
    purple: "PURPLECODEPLACEHOLDER",
    orange: "ORANGECODEPLACEHOLDER",
    white: "WHITECODEPLACEHOLDER"
  };

  // Host reset passcode
  const RESET_CODE = "MikeChristmas1998";

  // Playlist (add more tracks, rename files, etc.)
  const PLAYLIST = [
    { title: "Christmas Track 1", file: "./assets/music1.mp3" },
    { title: "Christmas Track 2", file: "./assets/music2.mp3" },
    { title: "Christmas Track 3", file: "./assets/music3.mp3" }
  ];

  // Hint unlock delays in ms (10, 30, 60 minutes)
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

  // per-clue passcode mapping
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

    // Main path: 20 clues
    for (let i = 1; i <= 20; i++) {
      clues.push(makeClue({
        id: `main_${i}`,
        path: "main",
        label: `Clue ${i}`,
        colorDotClass: "dot-rg",
        passcode: `MAIN${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Gold final clue (unlocks ONLY when all 20 main are solved)
    clues.push(makeClue({
      id: `gold_final`,
      path: "gold",
      label: `Gold Clue (Grand Prize)`,
      colorDotClass: "dot-gold",
      isLastInPath: true,
      clueText: "FINAL GOLD CLUE TEXT — replace later.",
      hints: [
        "GOLD HINT 1 — replace later.",
        "GOLD HINT 2 — replace later.",
        "GOLD HINT 3 — replace later."
      ],
      passcode: `GOLD_PASSCODE_UNUSED`
    }));

    // Blue: 6 (last is #6)
    for (let i = 1; i <= 6; i++) {
      clues.push(makeClue({
        id: `blue_${i}`,
        path: "blue",
        label: `Blue Clue ${i}`,
        colorDotClass: "dot-blue",
        isLastInPath: i === 6,
        passcode: `BLUE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Purple: 5 (last is #5)
    for (let i = 1; i <= 5; i++) {
      clues.push(makeClue({
        id: `purple_${i}`,
        path: "purple",
        label: `Purple Clue ${i}`,
        colorDotClass: "dot-purple",
        isLastInPath: i === 5,
        passcode: `PURPLE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // Orange: 4 (last is #4)
    for (let i = 1; i <= 4; i++) {
      clues.push(makeClue({
        id: `orange_${i}`,
        path: "orange",
        label: `Orange Clue ${i}`,
        colorDotClass: "dot-orange",
        isLastInPath: i === 4,
        passcode: `ORANGE${i}_PASSCODE_PLACEHOLDER`
      }));
    }

    // White: 3 (last is #3)
    for (let i = 1; i <= 3; i++) {
      clues.push(makeClue({
        id: `white_${i}`,
        path: "white",
        label: `White Clue ${i}`,
        colorDotClass: "dot-white",
        isLastInPath: i === 3,
        passcode: `WHITE${i}_PASSCODE_PLACEHOLDER`
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
    localPlayers: {},

    clues: Object.fromEntries(ALL_CLUES.map(c => [
      c.id,
      {
        unlocked: false,
        solved: false,
        unlockedAt: null
      }
    ])),

    pathUnlockUsed: {
      main: false,
      blue: false,
      purple: false,
      orange: false,
      white: false
    },

    music: {
      enabled: true,
      trackIndex: 0,
      playing: false
    }
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
        localPlayers: { ...(parsed.localPlayers || {}) }
      };
    } catch {
      return defaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    syncLocalLeaderboard();
  }

  function resetState() {
    state = defaultState();
    saveState();
    renderAll();
  }

  // =========================
  // HELPERS
  // =========================

  function randChoice(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function getPathClues(path) {
    return ALL_CLUES.filter(c => c.path === path);
  }

  function countSolved(path) {
    const ids = getPathClues(path).map(c => c.id);
    return ids.filter(id => state.clues[id]?.solved).length;
  }

  function totalInPath(path) {
    return getPathClues(path).length;
  }

  function isGoldUnlockedByRules() {
    return countSolved("main") >= 20;
  }

  function eligibleRandomClueIds(path) {
    // main: any unsolved/unlocked remain among 1..20
    // side paths: random among non-last clues; last unlocks only when others solved
    const clues = getPathClues(path);

    if (path === "main") {
      return clues
        .filter(c => !state.clues[c.id].unlocked && !state.clues[c.id].solved)
        .map(c => c.id);
    }

    const nonLast = clues.filter(c => !c.isLastInPath);
    return nonLast
      .filter(c => !state.clues[c.id].unlocked && !state.clues[c.id].solved)
      .map(c => c.id);
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

    // SFX
    try{
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

    // Gold "solve" can be used, but doesn't require passcode logic
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
    if (!cs?.unlocked || !cs.unlockedAt) {
      return { unlocked: false, remainingMs: null, remainingText: "" };
    }

    const elapsed = now() - cs.unlockedAt;
    const delay = HINT_DELAY_MS[hintIndex];
    const remaining = delay - elapsed;

    if (remaining <= 0) {
      return { unlocked: true, remainingMs: 0, remainingText: "00:00" };
    }
    return { unlocked: false, remainingMs: remaining, remainingText: msToClock(remaining) };
  }

  // =========================
  // MUSIC
  // =========================

  function loadTrack(index) {
    if (!PLAYLIST.length) return;
    const safeIndex = ((index % PLAYLIST.length) + PLAYLIST.length) % PLAYLIST.length;
    state.music.trackIndex = safeIndex;
    bgm.src = PLAYLIST[safeIndex].file;
    bgm.loop = true;
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

  // =========================
  // LEADERBOARD (LOCAL)
  // =========================

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
        loadTrack(idx);
        if (state.music.enabled) playMusic();
      });
      playlistEl.appendChild(div);
    });

    musicEnabled.checked = !!state.music.enabled;
    musicPlayPause.textContent = state.music.playing ? "⏸" : "▶️";
  }

  function renderLeaderboard() {
    const players = Object.values(state.localPlayers || {})
      .sort((a, b) => {
        const ap = a.progress || {};
        const bp = b.progress || {};

        // Main path progress first
        if ((bp.mainSolved ?? 0) !== (ap.mainSolved ?? 0)) return (bp.mainSolved ?? 0) - (ap.mainSolved ?? 0);

        // Tie-breakers
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
      if (!unlocked) {
        return `<div class="labelSub">Gold clue unlocks after all 20 Main Path clues are solved.</div>`;
      }
      return `<div class="labelStrong">Gold clue unlocked — follow it to the Grand Prize.</div>`;
    }

    if (!unlocked) {
      return `<div class="labelSub">Passcode box appears after this clue is unlocked.</div>`;
    }
    if (solved) {
      return `<div class="labelStrong">Solved.</div>`;
    }

    return `
      <input class="input" data-pass="${c.id}" type="text" placeholder="Enter passcode to solve" />
      <button class="btn btn--primary" data-solve="${c.id}" type="button">Submit</button>
      <span class="labelSub" data-msg="${c.id}"></span>
    `;
  }

  function renderAll() {
    // Disable unlock buttons after used once
    unlockMainBtn.disabled = state.pathUnlockUsed.main;
    unlockBlueBtn.disabled = state.pathUnlockUsed.blue;
    unlockPurpleBtn.disabled = state.pathUnlockUsed.purple;
    unlockOrangeBtn.disabled = state.pathUnlockUsed.orange;
    unlockWhiteBtn.disabled = state.pathUnlockUsed.white;

    // Gold unlock rule check
    if (isGoldUnlockedByRules() && !state.clues["gold_final"].unlocked) {
      unlockClue("gold_final");
    }

    // keep name input in sync
    playerNameInput.value = state.playerName || "";

    // render leaderboard + playlist
    renderLeaderboard();
    renderPlaylist();

    // ONE LONG LIST:
    clueContainer.innerHTML = "";

    // Main header + all main clues
    clueContainer.appendChild(renderPathHeader("main", "Main Path (Red/Green Ornaments)", "Solve 20 clues to unlock the Gold ornament.", "mainPath"));
    for (const c of getPathClues("main")) clueContainer.appendChild(renderClueCard(c));

    // Blue
    clueContainer.appendChild(renderPathHeader("blue", "Blue Path", "Leads to the 2nd biggest prize.", "bluePath"));
    for (const c of getPathClues("blue")) clueContainer.appendChild(renderClueCard(c));

    // Purple
    clueContainer.appendChild(renderPathHeader("purple", "Purple Path", "Leads to the 3rd biggest prize.", "purplePath"));
    for (const c of getPathClues("purple")) clueContainer.appendChild(renderClueCard(c));

    // Orange
    clueContainer.appendChild(renderPathHeader("orange", "Orange Path", "Leads to the 4th biggest prize.", "orangePath"));
    for (const c of getPathClues("orange")) clueContainer.appendChild(renderClueCard(c));

    // White
    clueContainer.appendChild(renderPathHeader("white", "White Path", "Leads to the 5th biggest prize.", "whitePath"));
    for (const c of getPathClues("white")) clueContainer.appendChild(renderClueCard(c));

    // Gold
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
        // Flip to hint content immediately by re-rendering once
        renderAll();
        return;
      }
    }
  }

  // =========================
  // EVENTS
  // =========================

  playBtn.addEventListener("click", () => {
    state.hasEnteredApp = true;
    saveState();
    setScreen(true);

    initMusic();
    if (state.music.enabled) playMusic();

    registerSW();
  });

  saveNameBtn.addEventListener("click", () => {
    const name = (playerNameInput.value || "").trim();
    if (!name) return;
    state.playerName = name;
    saveState();
    renderLeaderboard();
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

  // Scroll buttons
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-scroll]");
    if (!btn) return;
    const id = btn.getAttribute("data-scroll");
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // Music drawer
  musicToggleBtn.addEventListener("click", () => {
    const open = !musicDrawer.classList.contains("drawer--open");
    setMusicDrawer(open);
  });
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

  musicPrev.addEventListener("click", () => {
    loadTrack(state.music.trackIndex - 1);
    if (state.music.enabled) playMusic();
  });
  musicNext.addEventListener("click", () => {
    loadTrack(state.music.trackIndex + 1);
    if (state.music.enabled) playMusic();
  });
  musicPlayPause.addEventListener("click", toggleMusic);

  // Rules modal
  howBtn.addEventListener("click", () => setRulesModal(true));
  rulesCloseBtn.addEventListener("click", () => setRulesModal(false));
  rulesModal.addEventListener("click", (e) => {
    if (e.target === rulesModal) setRulesModal(false);
  });

  function setRulesModal(open) {
    rulesModal.classList.toggle("modal--open", open);
    rulesModal.setAttribute("aria-hidden", open ? "false" : "true");
  }

  // Reset
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

  // Keep leaderboard progress updated when focus returns
  window.addEventListener("focus", () => {
    syncLocalLeaderboard();
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
      if (state.music.enabled && state.music.playing) {
        playMusic();
      } else if (PLAYLIST.length) {
        loadTrack(state.music.trackIndex);
      }
      registerSW();
    } else {
      setScreen(false);
    }

    renderAll();

    // Live countdown update (only when app has started)
    setInterval(() => {
      if (!state.hasEnteredApp) return;
      updateHintCountdowns();
    }, 1000);
  }

  boot();
})();
