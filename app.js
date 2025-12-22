/* =========================
   Xmas Hunt 2025 - app.js
   - Shared leaderboard (Supabase)
   - Realtime auto-refresh
   - One long clue list + hint countdowns
   ========================= */

/* ============
   CONFIG
   ============ */
const SUPABASE_URL = "https://vgbqlreurvigkxfyibol.supabase.co";       // <-- paste your Supabase Project URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZnYnFscmV1cnZpZ2t4ZnlpYm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzNjA0MDEsImV4cCI6MjA4MTkzNjQwMX0.7KhWzoreujQWGtZ3CF43Bgz9hBI5FU0S6CWTiMpY0Ek";  // <-- paste your Supabase anon public key
const BACKEND_ENABLED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

// Hint unlock delays (minutes) -> countdowns shown on each clue card
const HINT_DELAY_MS = [10, 30, 60].map(m => m * 60 * 1000);

// Path totals (used for progress bars + ranking)
const PATHS = {
  main:   { label: "Main",   total: 20, color: "#C94C4C" }, // red-ish
  blue:   { label: "Blue",   total: 6,  color: "#3B82F6" },
  purple: { label: "Purple", total: 5,  color: "#A855F7" },
  orange: { label: "Orange", total: 4,  color: "#F59E0B" },
  white:  { label: "White",  total: 3,  color: "#E5E7EB" },
  gold:   { label: "Gold",   total: 1,  color: "#D4AF37" }
};

// Path unlock codes (edit these)
const PATH_UNLOCK_CODES = {
  main:   "CHRISTMAS2025",
  blue:   "BLUE2025",
  purple: "PURPLE2025",
  orange: "ORANGE2025",
  white:  "WHITE2025"
};

// Gold unlock rule (edit if you want different requirement)
function computeGoldUnlocked(progress) {
  // Example: unlock gold when main path complete
  return (progress.main_solved || 0) >= PATHS.main.total;
}

// Case-insensitive passcodes
const PASSCODES_CASE_INSENSITIVE = true;

/* =========================
   CLUE DATA (EDIT HERE)
   Each clue ID: "main_1"..."main_20", "blue_1"..."blue_6", etc.
   If a clue is missing here, placeholders will be used.
   ========================= */
const CLUE_DATA = {
  // Example:
  // "main_1": {
  //   clueText: "Where warmth meets a mug...",
  //   hints: ["Think kitchen", "Coffee station", "Check near mugs"],
  //   passcode: "MUGWARM25"
  // }
};

/* ============
   STATE
   ============ */
const STORAGE_KEY = "xmas_hunt_state_v1";

const state = {
  // identity
  playerName: "",
  nameLocked: false,
  // unlock flags
  unlockedPaths: { main: false, blue: false, purple: false, orange: false, white: false },
  // per-clue timing: { clueId: { startedAt:number } }
  clueTimers: {},
  // per-clue solved: { clueId:true }
  solved: {},
  // computed progress totals
  progress: {
    main_solved: 0,
    blue_solved: 0,
    purple_solved: 0,
    orange_solved: 0,
    white_solved: 0,
    gold_unlocked: false,
    gold_solved: false
  },
  // leaderboard
  remotePlayers: {}, // map by id
  localPlayers: {},  // fallback map by name
  // realtime channel
  playersChannel: null,
  // supabase auth uid
  uid: null
};

/* ============
   SUPABASE
   ============ */
let supabase = null;

/* ============
   DOM HELPERS
   ============ */
function $(sel) { return document.querySelector(sel); }
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}

function ensureSection({ title, id }) {
  let section = document.getElementById(id);
  if (section) return section;

  // Try a common container
  let root = $("#app") || $("main") || document.body;
  section = el("section", { id, class: "card" }, [
    el("h2", { class: "h2" }, [title])
  ]);
  root.appendChild(section);
  return section;
}

/* ============
   LOAD/SAVE
   ============ */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    playerName: state.playerName,
    nameLocked: state.nameLocked,
    unlockedPaths: state.unlockedPaths,
    clueTimers: state.clueTimers,
    solved: state.solved
  }));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.playerName = data.playerName || "";
    state.nameLocked = !!data.nameLocked;
    state.unlockedPaths = data.unlockedPaths || state.unlockedPaths;
    state.clueTimers = data.clueTimers || {};
    state.solved = data.solved || {};
  } catch (_) {}
}

/* ============
   CLUE MODEL
   ============ */
function pathClueIds(pathKey) {
  const total = PATHS[pathKey].total;
  const ids = [];
  for (let i = 1; i <= total; i++) ids.push(`${pathKey}_${i}`);
  return ids;
}

function allClueIdsInOrder() {
  // One long list: Main then Blue, Purple, Orange, White, then Gold (final)
  return [
    ...pathClueIds("main"),
    ...pathClueIds("blue"),
    ...pathClueIds("purple"),
    ...pathClueIds("orange"),
    ...pathClueIds("white"),
    "gold_final"
  ];
}

function getClueDefinition(clueId) {
  const def = CLUE_DATA[clueId] || {};
  const [pathKey, nStr] = clueId.split("_");

  // Placeholders
  const nicePath = PATHS[pathKey]?.label || "Gold";
  const num = Number(nStr) || "";
  const defaultText =
    clueId === "gold_final"
      ? "Gold Final: Follow the final instructions to claim the grand prize."
      : `${nicePath} Clue ${num}: (Edit this clue text in app.js → CLUE_DATA)`;

  const clueText = def.clueText || defaultText;
  const hints = Array.isArray(def.hints) ? def.hints : [
    "(Hint 1 not set)",
    "(Hint 2 not set)",
    "(Hint 3 not set)"
  ];

  const passcode = def.passcode || (clueId === "gold_final" ? "" : `PASS_${clueId.toUpperCase()}`);
  return { clueText, hints, passcode };
}

function normalizePasscode(s) {
  const t = (s || "").trim();
  return PASSCODES_CASE_INSENSITIVE ? t.toUpperCase() : t;
}

function startClueTimerIfMissing(clueId) {
  if (state.clueTimers[clueId]?.startedAt) return;
  state.clueTimers[clueId] = { startedAt: Date.now() };
  saveState();
}

function getHintUnlockInfo(clueId) {
  const startedAt = state.clueTimers[clueId]?.startedAt || null;
  if (!startedAt) {
    return HINT_DELAY_MS.map(ms => ({ unlocked: false, msRemaining: ms }));
  }
  const now = Date.now();
  return HINT_DELAY_MS.map(ms => {
    const unlockAt = startedAt + ms;
    const msRemaining = Math.max(0, unlockAt - now);
    return { unlocked: msRemaining === 0, msRemaining };
  });
}

function formatMs(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function computeProgressFromSolved() {
  const counts = { main:0, blue:0, purple:0, orange:0, white:0 };
  for (const clueId of Object.keys(state.solved)) {
    if (!state.solved[clueId]) continue;
    const [pathKey] = clueId.split("_");
    if (counts[pathKey] !== undefined) counts[pathKey]++;
  }

  state.progress.main_solved = counts.main;
  state.progress.blue_solved = counts.blue;
  state.progress.purple_solved = counts.purple;
  state.progress.orange_solved = counts.orange;
  state.progress.white_solved = counts.white;

  state.progress.gold_unlocked = computeGoldUnlocked(state.progress);
  // gold_solved is stored as solved["gold_final"] for consistency
  state.progress.gold_solved = !!state.solved["gold_final"];
}

/* ============
   UI BUILD (robust)
   ============ */
function ensureUI() {
  // Player section
  const playerSection = ensureSection({ title: "Player", id: "playerSection" });
  if (!$("#playerNameInput")) {
    playerSection.appendChild(el("div", { class: "field" }, [
      el("div", { class: "label" }, ["Your Name"]),
      el("div", { class: "row" }, [
        el("input", { id: "playerNameInput", type: "text", placeholder: "Enter name" }),
        el("button", { id: "saveNameBtn", type: "button" }, ["Save"])
      ]),
      el("div", { id: "playerNote", class: "labelSub" }, ["Name locks after saving."])
    ]));
  }

  // Leaderboard section
  const lbSection = ensureSection({ title: "Leaderboard", id: "leaderboardSection" });
  if (!$("#leaderboardWrap")) {
    lbSection.appendChild(el("div", { id: "leaderboardWrap" }, [
      el("div", { id: "leaderboardList" })
    ]));
  }

  // Unlock section
  const unlockSection = ensureSection({ title: "Unlock Boxes", id: "unlockSection" });
  if (!$("#unlockWrap")) {
    unlockSection.appendChild(el("div", { id: "unlockWrap" }));
  }

  // Clues section
  const cluesSection = ensureSection({ title: "Clues (One Long List)", id: "cluesSection" });
  if (!$("#cluesList")) {
    cluesSection.appendChild(el("div", { id: "cluesList" }));
  }
}

/* ============
   RENDER: PLAYER
   ============ */
function renderPlayer() {
  const input = $("#playerNameInput");
  const btn = $("#saveNameBtn");
  if (!input || !btn) return;

  input.value = state.playerName || "";
  input.disabled = state.nameLocked;
  btn.disabled = state.nameLocked;

  btn.onclick = async () => {
    const name = (input.value || "").trim();
    if (!name) return;

    state.playerName = name;
    state.nameLocked = true;
    saveState();

    // write to backend (if enabled)
    await saveRemotePlayerRow();
    renderAll();
  };
}

/* ============
   RENDER: UNLOCK BOXES
   ============ */
function renderUnlockBoxes() {
  const wrap = $("#unlockWrap");
  if (!wrap) return;
  wrap.innerHTML = "";

  const order = ["main","blue","purple","orange","white"];

  for (const pathKey of order) {
    const title = (pathKey === "main")
      ? "Main Path (Red/Green → Gold)"
      : `${PATHS[pathKey].label} Path Unlock`;

    const help = (pathKey === "main")
      ? `Type ${PATH_UNLOCK_CODES.main} to unlock your first clue (only once).`
      : "Enter path code to unlock.";

    const row = el("div", { class: "card mini" }, [
      el("div", { class: "h3" }, [title]),
      el("div", { class: "labelSub" }, [help]),
      el("div", { class: "row" }, [
        el("input", { id: `unlock_${pathKey}`, type: "text", placeholder: "Enter code" }),
        el("button", {
          type: "button",
          onclick: () => {
            const val = normalizePasscode($(`#unlock_${pathKey}`)?.value || "");
            const expected = normalizePasscode(PATH_UNLOCK_CODES[pathKey] || "");
            if (!expected) return;

            if (val === expected) {
              state.unlockedPaths[pathKey] = true;
              saveState();
              renderAll();
            } else {
              // gentle feedback
              $(`#unlock_${pathKey}`).value = "";
              $(`#unlock_${pathKey}`).placeholder = "Incorrect — try again";
            }
          }
        }, ["Unlock"])
      ]),
      el("div", { class: "labelSub" }, [
        state.unlockedPaths[pathKey] ? "Status: Unlocked" : "Status: Locked"
      ])
    ]);

    wrap.appendChild(row);
  }
}

/* ============
   RENDER: CLUES (ONE LONG LIST)
   ============ */
function renderClues() {
  const list = $("#cluesList");
  if (!list) return;
  list.innerHTML = "";

  const ids = allClueIdsInOrder();

  // Group headers like your UI (optional): insert a header before each path
  const headerFor = (pathKey) => {
    if (pathKey === "main") return "Main Path (Red/Green Ornaments)";
    if (pathKey === "blue") return "Blue Path";
    if (pathKey === "purple") return "Purple Path";
    if (pathKey === "orange") return "Orange Path";
    if (pathKey === "white") return "White Path";
    if (pathKey === "gold") return "Gold (Final)";
    return pathKey;
  };

  let lastPath = null;

  for (const clueId of ids) {
    const [pathKey] = clueId.split("_");
    const realPath = (clueId === "gold_final") ? "gold" : pathKey;

    if (realPath !== lastPath) {
      list.appendChild(el("div", { class: "pathHeader" }, [headerFor(realPath)]));
      lastPath = realPath;
    }

    const unlocked =
      (clueId === "gold_final")
        ? state.progress.gold_unlocked
        : !!state.unlockedPaths[pathKey];

    const def = getClueDefinition(clueId);
    const solved = !!state.solved[clueId];

    const card = el("div", { class: `clueCard ${solved ? "solved" : ""}` });

    // Title line
    const titleText = (clueId === "gold_final")
      ? "Gold Final"
      : `${PATHS[pathKey].label} Clue ${clueId.split("_")[1]}`;

    card.appendChild(el("div", { class: "clueTop" }, [
      el("div", { class: "clueTitle" }, [titleText]),
      el("div", { class: "clueStatus" }, [solved ? "Solved" : (unlocked ? "Unlocked" : "Locked")])
    ]));

    // Body
    if (!unlocked) {
      card.appendChild(el("div", { class: "labelSub" }, [
        clueId === "gold_final"
          ? "Gold is locked until the required progress is met."
          : "Unlock this path above to access this clue."
      ]));
      list.appendChild(card);
      continue;
    }

    // Start timer when first viewed
    startClueTimerIfMissing(clueId);

    card.appendChild(el("div", { class: "clueText" }, [def.clueText]));

    // Hints with countdowns
    const hintInfo = getHintUnlockInfo(clueId);

    const hintsWrap = el("div", { class: "hintsWrap" });
    for (let i = 0; i < 3; i++) {
      const info = hintInfo[i];
      const hintRow = el("div", { class: "hintRow" }, [
        el("div", { class: "hintLabel" }, [`Hint ${i+1}`]),
        el("div", { class: "hintContent", id: `hint_${clueId}_${i}` }, [
          info.unlocked ? def.hints[i] : `Unlocks in ${formatMs(info.msRemaining)}`
        ])
      ]);
      hintsWrap.appendChild(hintRow);
    }
    card.appendChild(hintsWrap);

    // Passcode input (except if you want gold to be non-passcode; keep it as is)
    const showPass = clueId !== "gold_final";
    if (showPass && !solved) {
      const passRow = el("div", { class: "row" }, [
        el("input", { id: `pass_${clueId}`, type: "text", placeholder: "Enter passcode" }),
        el("button", {
          type: "button",
          onclick: async () => {
            const typed = normalizePasscode($(`#pass_${clueId}`)?.value || "");
            const expected = normalizePasscode(def.passcode || "");

            if (typed && expected && typed === expected) {
              state.solved[clueId] = true;
              computeProgressFromSolved();
              saveState();

              await saveRemotePlayerRow();
              await loadRemotePlayers();
              renderAll();
            } else {
              const inp = $(`#pass_${clueId}`);
              if (inp) {
                inp.value = "";
                inp.placeholder = "Incorrect — try again";
              }
            }
          }
        }, ["Submit"])
      ]);
      card.appendChild(passRow);
      card.appendChild(el("div", { class: "labelSub" }, [
        "Tip: passcodes are not case sensitive."
      ]));
    }

    // If gold final and unlocked: allow a “claim” button if you want
    if (clueId === "gold_final") {
      if (!solved) {
        card.appendChild(el("button", {
          type: "button",
          onclick: async () => {
            state.solved["gold_final"] = true;
            computeProgressFromSolved();
            saveState();
            await saveRemotePlayerRow();
            await loadRemotePlayers();
            renderAll();
          }
        }, ["Mark Gold Complete"]));
      } else {
        card.appendChild(el("div", { class: "labelSub" }, ["Gold complete."]));
      }
    }

    list.appendChild(card);
  }
}

/* ============
   LIVE HINT COUNTDOWN TICK
   ============ */
function tickHintCountdowns() {
  // Update any visible hint countdown text without re-rendering the entire list
  const ids = allClueIdsInOrder();
  for (const clueId of ids) {
    const cardExists = $(`#hint_${clueId}_0`);
    if (!cardExists) continue;

    const def = getClueDefinition(clueId);
    const info = getHintUnlockInfo(clueId);
    for (let i = 0; i < 3; i++) {
      const target = $(`#hint_${clueId}_${i}`);
      if (!target) continue;

      if (info[i].unlocked) target.textContent = def.hints[i] || "";
      else target.textContent = `Unlocks in ${formatMs(info[i].msRemaining)}`;
    }
  }
}

/* ============
   LEADERBOARD
   - Rank by main progress first
   - Show progress bars for other paths
   ============ */
function renderLeaderboard() {
  const list = $("#leaderboardList");
  if (!list) return;

  // Choose source
  const playersArr = BACKEND_ENABLED
    ? Object.values(state.remotePlayers || {})
    : Object.values(state.localPlayers || {});

  // Sort: main desc, then total side paths desc, then updated_at desc/name
  playersArr.sort((a,b) => {
    const am = a.main_solved || 0;
    const bm = b.main_solved || 0;
    if (bm !== am) return bm - am;

    const aSide = (a.blue_solved||0)+(a.purple_solved||0)+(a.orange_solved||0)+(a.white_solved||0);
    const bSide = (b.blue_solved||0)+(b.purple_solved||0)+(b.orange_solved||0)+(b.white_solved||0);
    if (bSide !== aSide) return bSide - aSide;

    const at = new Date(a.updated_at || 0).getTime();
    const bt = new Date(b.updated_at || 0).getTime();
    if (bt !== at) return bt - at;

    return String(a.name||"").localeCompare(String(b.name||""));
  });

  list.innerHTML = "";

  if (BACKEND_ENABLED && (!state.remotePlayers || Object.keys(state.remotePlayers).length === 0)) {
    list.appendChild(el("div", { class: "labelSub" }, [
      "Backend enabled, but no remote players loaded yet."
    ]));
    return;
  }

  for (const p of playersArr) {
    const card = el("div", { class: "lbCard" });
    const header = el("div", { class: "lbTop" }, [
      el("div", { class: "lbName" }, [p.name || "Player"]),
      el("div", { class: "lbMainScore" }, [
        `${p.main_solved || 0}/${PATHS.main.total}`
      ])
    ]);

    card.appendChild(header);

    // Progress rows
    card.appendChild(progressRow("Main",   p.main_solved||0,   PATHS.main.total,   PATHS.main.color));
    card.appendChild(progressRow("Blue",   p.blue_solved||0,   PATHS.blue.total,   PATHS.blue.color));
    card.appendChild(progressRow("Purple", p.purple_solved||0, PATHS.purple.total, PATHS.purple.color));
    card.appendChild(progressRow("Orange", p.orange_solved||0, PATHS.orange.total, PATHS.orange.color));
    card.appendChild(progressRow("White",  p.white_solved||0,  PATHS.white.total,  PATHS.white.color));

    const goldText = (p.gold_unlocked ? (p.gold_solved ? "Gold: Complete" : "Gold: Unlocked") : "Gold: Locked");
    card.appendChild(el("div", { class: "labelSub" }, [goldText]));

    list.appendChild(card);
  }
}

function progressRow(label, val, total, color) {
  const pct = total ? Math.min(100, Math.round((val/total)*100)) : 0;
  const wrap = el("div", { class: "progRow" });
  wrap.appendChild(el("div", { class: "progLabel" }, [label]));
  const barOuter = el("div", { class: "progOuter" });
  const barInner = el("div", { class: "progInner" });
  barInner.style.width = `${pct}%`;
  barInner.style.background = color;
  barOuter.appendChild(barInner);
  wrap.appendChild(barOuter);
  wrap.appendChild(el("div", { class: "progNum" }, [`${val}/${total}`]));
  return wrap;
}

/* ============
   REMOTE: INIT / SAVE / LOAD
   ============ */
async function initRemoteIfEnabled() {
  if (!BACKEND_ENABLED) return;

  // Expect supabase client already loaded via CDN in index.html
  if (!window.supabase || !window.supabase.createClient) {
    console.error("Supabase client not found. Make sure supabase-js is included in index.html.");
    return;
  }
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Ensure signed in anonymously
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error("Remote init error:", error);
    return;
  }

  state.uid = data?.user?.id || null;
}

async function saveRemotePlayerRow() {
  if (!BACKEND_ENABLED || !supabase) return;
  if (!state.uid) return;
  if (!state.nameLocked || !state.playerName) return;

  computeProgressFromSolved();

  const row = {
    id: state.uid,
    name: state.playerName,
    main_solved: state.progress.main_solved,
    blue_solved: state.progress.blue_solved,
    purple_solved: state.progress.purple_solved,
    orange_solved: state.progress.orange_solved,
    white_solved: state.progress.white_solved,
    gold_unlocked: !!state.progress.gold_unlocked,
    gold_solved: !!state.progress.gold_solved,
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
}

/* ============
   REALTIME: Option A
   ============ */
function startRealtimeLeaderboard() {
  if (!BACKEND_ENABLED || !supabase) return;
  if (state.playersChannel) return; // avoid double subscribe

  state.playersChannel = supabase
    .channel("players-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "players" }, async () => {
      await loadRemotePlayers();
      renderLeaderboard();
    })
    .subscribe((status) => {
      console.log("Realtime status:", status);
    });
}

/* ============
   FALLBACK LOCAL LEADERBOARD
   ============ */
function updateLocalLeaderboardMirror() {
  // Keep a local mirror so the UI works even without backend
  if (!state.playerName) return;
  computeProgressFromSolved();

  state.localPlayers[state.playerName] = {
    name: state.playerName,
    main_solved: state.progress.main_solved,
    blue_solved: state.progress.blue_solved,
    purple_solved: state.progress.purple_solved,
    orange_solved: state.progress.orange_solved,
    white_solved: state.progress.white_solved,
    gold_unlocked: !!state.progress.gold_unlocked,
    gold_solved: !!state.progress.gold_solved,
    updated_at: new Date().toISOString()
  };
}

/* ============
   MAIN RENDER
   ============ */
function renderAll() {
  computeProgressFromSolved();
  updateLocalLeaderboardMirror();
  renderPlayer();
  renderUnlockBoxes();
  renderClues();
  renderLeaderboard();
}

/* ============
   VISIBILITY REFRESH (nice QoL)
   ============ */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") return;
  if (!BACKEND_ENABLED || !supabase) return;
  await loadRemotePlayers();
  renderLeaderboard();
});

/* ============
   BOOT
   ============ */
(async function boot() {
  loadState();
  ensureUI();
  computeProgressFromSolved();
  renderAll();

  // Hint countdown tick (every 1s)
  setInterval(() => {
    tickHintCountdowns();
  }, 1000);

  // Remote init
  if (BACKEND_ENABLED) {
    await initRemoteIfEnabled();
    await saveRemotePlayerRow();
    await loadRemotePlayers();
    renderLeaderboard();
    startRealtimeLeaderboard();
  }
})();

/* ============
   OPTIONAL DEBUG (you can delete later)
   ============ */
window.__xmasDebug = () => ({
  BACKEND_ENABLED,
  uid: state.uid,
  nameLocked: state.nameLocked,
  playerName: state.playerName,
  unlockedPaths: state.unlockedPaths,
  progress: state.progress,
  remoteCount: Object.keys(state.remotePlayers || {}).length
});
