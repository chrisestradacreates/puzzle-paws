(function () {
  "use strict";

  var TILE = 32;
  var MAP_W = 15, MAP_H = 11;
  var SAVE_KEY = "puzzle-paws-v2";

  var MONSTER_DEFS = {
    slime:  { label: "Slime",  puzzle: "memory",   size: 30, intro: "A wild Slime blocks the path! It challenges you to a Memory Trial." },
    bat:    { label: "Bat",    puzzle: "reaction", size: 26, intro: "A screeching Bat swoops down! Show your reflexes to drive it off." },
    crab:   { label: "Crab",   puzzle: "simon",    size: 30, intro: "A snapping Crab guards the path! Repeat its Rhythm to defeat it." },
    golem:  { label: "Golem",  puzzle: "reaction", size: 34, intro: "A stone Golem awakens! Show your reflexes to break it down." },
    ghost:  { label: "Ghost",  puzzle: "memory",   size: 30, intro: "A restless Ghost drifts closer! Its Memory Trial is harder now." },
    dragon: { label: "Dragon", puzzle: "simon",  size: 46, intro: "The Whisker Dragon rises! Match its Ancient Rhythm to win the day." }
  };

  // Monsters sit directly on the single-width corridor carved below, in this
  // exact order, so the path physically cannot be bypassed — each one must be
  // beaten before the next becomes reachable. This is the "level gate".
  var MONSTERS = [
    { id: 1, type: "slime",  x: 1,  y: 4 },
    { id: 2, type: "bat",    x: 3,  y: 8 },
    { id: 3, type: "crab",   x: 5,  y: 5 },
    { id: 4, type: "golem",  x: 7,  y: 2 },
    { id: 5, type: "ghost",  x: 9,  y: 5 },
    { id: 6, type: "dragon", x: 11, y: 8 }
  ];

  var PUZZLE_PARAMS = {
    1: { pairs: 3 },
    2: { target: 5, time: 20 },
    3: { target: 4 },
    4: { target: 8, time: 28 },
    5: { pairs: 6 },
    6: { target: 6 }
  };

  // Each defeat unlocks one new cat you can play as (via Camp) — not a color
  // swap, a distinct named character. Defeating the final boss unlocks the
  // Legendary Cat promised in the intro story.
  var CHARACTERS = [
    { key: "orange", name: "Tabby" },
    { key: "black", name: "Shadow" },
    { key: "white", name: "Snowball" },
    { key: "grey", name: "Ash" },
    { key: "calico", name: "Patch" },
    { key: "cream", name: "Biscuit" },
    { key: "golden", name: "Legend" }
  ];
  var REWARD_SCHEDULE = ["black", "white", "grey", "calico", "cream", "golden"];

  function characterName(key) {
    for (var i = 0; i < CHARACTERS.length; i++) if (CHARACTERS[i].key === key) return CHARACTERS[i].name;
    return "Tabby";
  }

  var CAMP_POS = { x: 2, y: 1 };
  var GOAL_POS = { x: 13, y: 10 };
  var START_PX = { x: 1 * TILE + TILE / 2, y: 1 * TILE + TILE / 2 };

  // ---------------- World 2: fuel-catching minigame ----------------
  var CATCH_LEVELS = [
    { target: 10, fallSpeed: 90, spawnInterval: 700, bugChance: 0.25 },
    { target: 14, fallSpeed: 115, spawnInterval: 600, bugChance: 0.30 },
    { target: 18, fallSpeed: 140, spawnInterval: 520, bugChance: 0.35 }
  ];
  var CATCH_TIME_LIMIT = 60;
  var CATCH_MAX_BUGS = 3;
  var CATCH_PLATE_W = 70, CATCH_PLATE_H = 16;
  var CATCH_ITEM_SIZE = 20;
  var CATCH_PLATE_SPEED = 260;
  var CATCH_SPAWN_Y = 36;
  var CATCH_GROUND_H = 40;

  function buildMap() {
    var grid = [];
    for (var y = 0; y < MAP_H; y++) grid.push(new Array(MAP_W).fill("#"));
    function carve(x, y) { grid[y][x] = "."; }
    function carveRect(x1, y1, x2, y2) {
      var xa = Math.min(x1, x2), xb = Math.max(x1, x2);
      var ya = Math.min(y1, y2), yb = Math.max(y1, y2);
      for (var y = ya; y <= yb; y++) for (var x = xa; x <= xb; x++) carve(x, y);
    }
    // One single-width corridor, winding start -> goal. No detours, no shortcuts.
    carveRect(1, 1, 1, 8);
    carveRect(1, 8, 5, 8);
    carveRect(5, 2, 5, 8);
    carveRect(5, 2, 9, 2);
    carveRect(9, 2, 9, 8);
    carveRect(9, 8, 13, 8);
    carveRect(13, 8, 13, 10);
    grid[CAMP_POS.y][CAMP_POS.x] = "C"; // sits right beside the start tile (1,1)
    grid[GOAL_POS.y][GOAL_POS.x] = "G";
    return grid;
  }

  var mapGrid = buildMap();

  function tileAt(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return "#";
    return mapGrid[y][x];
  }

  function monsterAtTile(x, y) {
    for (var i = 0; i < MONSTERS.length; i++) {
      var m = MONSTERS[i];
      if (m.x === x && m.y === y) return m;
    }
    return null;
  }

  function currentLevelIndex() {
    for (var i = 0; i < MONSTERS.length; i++) if (!MONSTERS[i].defeated) return i;
    return MONSTERS.length;
  }

  // ---------------- Save / state ----------------
  function defaultState() {
    return {
      catName: "Tabby",
      character: "orange",
      unlockedCharacters: ["orange"],
      defeatedIds: [],
      totalDefeats: 0,
      playerX: START_PX.x,
      playerY: START_PX.y,
      fuelLevel: 0
    };
  }

  var S = null;

  function saveGame() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
  }

  function loadGame() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var d = defaultState();
      for (var k in d) if (!(k in parsed)) parsed[k] = d[k];
      return parsed;
    } catch (e) { return null; }
  }

  function applyDefeatedFlags() {
    MONSTERS.forEach(function (m) { m.defeated = S.defeatedIds.indexOf(m.id) !== -1; });
  }

  function stageFromDefeats(n) { return Math.min(3, Math.floor(n / 2)); }
  var STAGE_LABELS = ["Kitten", "Young Cat", "Adult Cat", "Majestic Cat"];

  // ---------------- Audio ----------------
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
    }
  }
  document.addEventListener("keydown", ensureAudio, { once: true });
  document.addEventListener("click", ensureAudio, { once: true });

  function beep(freq, dur, type) {
    if (!audioCtx) return;
    var osc = audioCtx.createOscillator();
    var gain = audioCtx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    var now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(now); osc.stop(now + dur);
  }
  function beepSeq(freqs, dur) { freqs.forEach(function (f, i) { setTimeout(function () { beep(f, dur, "square"); }, i * dur * 900); }); }

  function playSound(name) {
    var map = {
      click: [440, 0.05, "square"], flip: [520, 0.05, "square"], match: [880, 0.08, "triangle"],
      buzz: [130, 0.22, "sawtooth"], hit: [720, 0.05, "square"],
      alert: [200, 0.16, "sawtooth"], tap: [300, 0.04, "square"]
    };
    if (name === "win") return beepSeq([523, 659, 784], 0.09);
    if (name === "levelup") return beepSeq([392, 523, 659, 784], 0.1);
    if (name === "victory") return beepSeq([523, 659, 784, 1046, 784, 1046], 0.12);
    var cfg = map[name];
    if (cfg) beep(cfg[0], cfg[1], cfg[2]);
  }

  // ---------------- DOM refs ----------------
  var canvas = document.getElementById("game-canvas");
  var ctx = canvas.getContext("2d");
  Sprites.noSmooth(ctx);

  var el = {
    hudIcon: document.getElementById("hud-cat-icon"),
    hudName: document.getElementById("hud-name"),
    hudStage: document.getElementById("hud-stage"),
    hudDefeats: document.getElementById("hud-defeats"),
    pauseBtn: document.getElementById("pause-btn"),
    prompt: document.getElementById("tile-prompt"),
    loading: document.getElementById("screen-loading"),
    loadingBar: document.getElementById("loading-bar"),
    title: document.getElementById("screen-title"),
    btnContinue: document.getElementById("btn-continue"),
    btnNewGame: document.getElementById("btn-newgame"),
    btnCustomizeTitle: document.getElementById("btn-customize-title"),
    btnHowTo: document.getElementById("btn-howtoplay"),
    howto: document.getElementById("screen-howto"),
    btnHowToClose: document.getElementById("btn-howto-close"),
    intro: document.getElementById("screen-intro"),
    btnIntroBegin: document.getElementById("btn-intro-begin"),
    pause: document.getElementById("screen-pause"),
    btnResume: document.getElementById("btn-resume"),
    btnCustomizePause: document.getElementById("btn-customize-pause"),
    btnExitTitle: document.getElementById("btn-exit-title"),
    customize: document.getElementById("screen-customize"),
    customizeTitle: document.getElementById("customize-title"),
    customizePreview: document.getElementById("customize-preview"),
    customizeCharacterName: document.getElementById("customize-character-name"),
    colorOptions: document.getElementById("color-options"),
    btnCustomizeDone: document.getElementById("btn-customize-done"),
    encounter: document.getElementById("screen-encounter"),
    encounterHeader: document.getElementById("encounter-header"),
    encounterDialogue: document.getElementById("encounter-dialogue"),
    puzzleArea: document.getElementById("puzzle-area"),
    btnFlee: document.getElementById("btn-flee"),
    victory: document.getElementById("screen-victory"),
    victoryStats: document.getElementById("victory-stats"),
    btnVictoryContinue: document.getElementById("btn-victory-continue"),
    btnVictoryTitle: document.getElementById("btn-victory-title"),
    toast: document.getElementById("toast"),
    confirm: document.getElementById("screen-confirm"),
    confirmMessage: document.getElementById("confirm-message"),
    btnConfirmYes: document.getElementById("btn-confirm-yes"),
    btnConfirmNo: document.getElementById("btn-confirm-no"),
    fuelIntro: document.getElementById("screen-fuel-intro"),
    btnFuelBegin: document.getElementById("btn-fuel-begin"),
    catchHud: document.getElementById("catch-hud"),
    catchLevelLabel: document.getElementById("catch-level-label"),
    catchFruitLabel: document.getElementById("catch-fruit-label"),
    catchBugsLabel: document.getElementById("catch-bugs-label"),
    catchTimeLabel: document.getElementById("catch-time-label"),
    btnCatchLeave: document.getElementById("btn-catch-leave"),
    catchResult: document.getElementById("screen-catch-result"),
    catchResultTitle: document.getElementById("catch-result-title"),
    catchResultMessage: document.getElementById("catch-result-message"),
    btnCatchContinue: document.getElementById("btn-catch-continue"),
    btnCatchRetry: document.getElementById("btn-catch-retry")
  };

  var ALL_SCREENS = ["title", "howto", "intro", "pause", "customize", "encounter", "victory", "loading", "confirm", "fuelIntro", "catchResult"];
  function showScreen(name) {
    ALL_SCREENS.forEach(function (s) {
      el[s].classList.toggle("hidden", s !== name);
    });
  }
  function hideAllScreens() {
    ALL_SCREENS.forEach(function (s) { el[s].classList.add("hidden"); });
  }

  var toastTimer = null;
  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    requestAnimationFrame(function () { el.toast.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.classList.remove("show");
      setTimeout(function () { el.toast.classList.add("hidden"); }, 300);
    }, 2600);
  }

  // ---------------- Game state machine ----------------
  var STATE = { LOADING: "LOADING", TITLE: "TITLE", OVERWORLD: "OVERWORLD", ENCOUNTER: "ENCOUNTER", CATCH: "CATCH", VICTORY_SCREEN: "VICTORY_SCREEN" };
  var mode = STATE.LOADING;
  var customizeReturnMode = STATE.TITLE;

  var player = { x: START_PX.x, y: START_PX.y, hw: 9, hh: 9, dir: "down", walkFrame: 0, animTimer: 0, moving: false };
  var currentMonster = null;
  var activeCleanup = null;
  var particles = [];
  var loadingTimer = 0;
  var LOAD_DURATION = 2.6;
  var interactPressed = false;
  var keys = {};

  // ---------------- Input ----------------
  window.addEventListener("keydown", function (e) {
    keys[e.key] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].indexOf(e.key) !== -1) e.preventDefault();
    if (e.key === "Enter" || e.key === " ") interactPressed = true;
    if (e.key === "Escape") {
      if (mode === STATE.OVERWORLD) openPause();
      else if (mode === STATE.ENCOUNTER) { /* keep in encounter, use Retreat */ }
      else if (!el.pause.classList.contains("hidden")) closePause();
    }
  });
  window.addEventListener("keyup", function (e) { keys[e.key] = false; });

  // ---------------- Rendering helpers ----------------
  function fillerSprite(x, y) {
    var h = (x * 31 + y * 17) % 5;
    if (h === 0) return "water";
    if (h === 1) return "rock";
    return "tree";
  }

  function tileSpriteFor(ch, x, y) {
    if (ch === "#") return fillerSprite(x, y);
    if (ch === "C") return "camp";
    if (ch === "G") return (S && S.totalDefeats >= 6) ? "goal-open" : "goal-locked";
    var m = monsterAtTile(x, y);
    if (m && m.defeated) return "cleared";
    return "path";
  }

  function drawMap() {
    for (var y = 0; y < MAP_H; y++) {
      for (var x = 0; x < MAP_W; x++) {
        var sprite = tileSpriteFor(mapGrid[y][x], x, y);
        ctx.save();
        ctx.translate(x * TILE, y * TILE);
        ctx.scale(TILE / 16, TILE / 16);
        Sprites.drawTile(ctx, sprite, 0);
        ctx.restore();
      }
    }
  }

  function catPreviewOpts() {
    return { color: S ? S.character : "orange", dir: player.dir, walkFrame: player.walkFrame };
  }

  function drawEntities(t) {
    var drawables = [];
    var currentIdx = currentLevelIndex();
    MONSTERS.forEach(function (m, i) {
      if (!m.defeated) {
        drawables.push({ y: m.y * TILE, draw: function () {
          var def = MONSTER_DEFS[m.type];
          var size = def.size * 0.65;
          ctx.save();
          ctx.globalAlpha = i === currentIdx ? 1 : 0.35;
          ctx.translate(m.x * TILE + TILE / 2 - size / 2, m.y * TILE + TILE / 2 - size / 2);
          Sprites.drawMonster(ctx, m.type, size, t);
          ctx.restore();
        } });
      }
    });
    drawables.push({ y: player.y, draw: function () {
      ctx.save();
      ctx.translate(player.x - 16, player.y - 24);
      ctx.scale(2, 2);
      Sprites.drawCat(ctx, catPreviewOpts());
      ctx.restore();
    } });
    drawables.sort(function (a, b) { return a.y - b.y; });
    drawables.forEach(function (d) { d.draw(); });
  }

  function drawOverworld(t) {
    drawMap();
    drawEntities(t);
    drawParticles();
  }

  function drawEncounterBackdrop(t) {
    var grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#3a3050");
    grad.addColorStop(1, "#1c1830");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#241a2c";
    ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
    if (currentMonster) {
      var def = MONSTER_DEFS[currentMonster.type];
      var size = def.size * 3.2;
      ctx.save();
      ctx.translate(canvas.width / 2 - size / 2, canvas.height * 0.32 - size / 2);
      Sprites.drawMonster(ctx, currentMonster.type, size, t);
      ctx.restore();
    }
    drawParticles();
  }

  function drawLoading(t) {
    ctx.fillStyle = "#7fb3d5";
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.72);
    ctx.fillStyle = "#57974a";
    ctx.fillRect(0, canvas.height * 0.72, canvas.width, canvas.height * 0.28);
    Sprites.pixelCircle(ctx, 60, 50, 26, "#fff3a0");
    for (var i = 0; i < 5; i++) {
      var cx = 90 + i * 95 + Math.sin(t * 0.2 + i) * 10;
      var cy = 60 + (i % 2) * 20;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(cx, cy, 40, 12);
      ctx.fillRect(cx + 10, cy - 8, 30, 12);
    }
    var progress = Math.min(1, loadingTimer / LOAD_DURATION);
    var cx2 = -20 + progress * (canvas.width + 40);
    var groundY = canvas.height * 0.72;
    ctx.save();
    ctx.translate(cx2 - 16, groundY - 30);
    ctx.scale(2, 2);
    Sprites.drawCat(ctx, { color: "orange", dir: "right", walkFrame: Math.floor(t * 6) % 2 });
    ctx.restore();
    el.loadingBar.style.width = (progress * 100) + "%";
  }

  function spawnParticles(x, y, color, count) {
    for (var i = 0; i < count; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 140,
        vy: -Math.random() * 160 - 40,
        life: 0.9 + Math.random() * 0.4,
        age: 0,
        color: color,
        size: 3 + Math.random() * 3
      });
    }
  }
  function updateParticles(dt) {
    particles.forEach(function (p) {
      p.age += dt;
      p.vy += 260 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    particles = particles.filter(function (p) { return p.age < p.life; });
  }
  function drawParticles() {
    particles.forEach(function (p) {
      var alpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1;
    });
  }

  // ---------------- Movement / collision ----------------
  var PLAYER_SPEED = 130;

  function checkCollisionAt(x, y) {
    var tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    var ch = tileAt(tx, ty);
    var m = monsterAtTile(tx, ty);
    if (m && !m.defeated) return { blocked: true, monster: m };
    if (ch === "#") return { blocked: true, monster: null };
    return { blocked: false, monster: null };
  }

  function tryMoveAxis(axis, delta) {
    if (delta === 0) return;
    var newX = player.x, newY = player.y;
    if (axis === "x") newX += delta; else newY += delta;
    var points;
    if (axis === "x") {
      var leadX = delta > 0 ? newX + player.hw : newX - player.hw;
      points = [{ x: leadX, y: player.y - player.hh + 1 }, { x: leadX, y: player.y + player.hh - 1 }];
    } else {
      var leadY = delta > 0 ? newY + player.hh : newY - player.hh;
      points = [{ x: player.x - player.hw + 1, y: leadY }, { x: player.x + player.hw - 1, y: leadY }];
    }
    for (var i = 0; i < points.length; i++) {
      var res = checkCollisionAt(points[i].x, points[i].y);
      if (res.blocked) {
        if (res.monster) triggerEncounter(res.monster);
        return;
      }
    }
    if (axis === "x") player.x = newX; else player.y = newY;
  }

  function updateOverworld(dt) {
    var dx = 0, dy = 0;
    if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) dx += 1;
    if (keys.ArrowUp || keys.w || keys.W) dy -= 1;
    if (keys.ArrowDown || keys.s || keys.S) dy += 1;
    var moving = dx !== 0 || dy !== 0;
    if (moving) {
      var len = Math.hypot(dx, dy);
      dx /= len; dy /= len;
      if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? "right" : "left";
      else if (dy !== 0) player.dir = dy > 0 ? "down" : "up";
      tryMoveAxis("x", dx * PLAYER_SPEED * dt);
      if (mode !== STATE.OVERWORLD) return; // an axis move may have triggered an encounter
      tryMoveAxis("y", dy * PLAYER_SPEED * dt);
      if (mode !== STATE.OVERWORLD) return;
      player.animTimer += dt;
      if (player.animTimer > 0.16) { player.walkFrame = 1 - player.walkFrame; player.animTimer = 0; }
    } else {
      player.walkFrame = 0;
    }
    player.moving = moving;
    checkStandingSpecial();
  }

  function checkStandingSpecial() {
    var tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
    var ch = tileAt(tx, ty);
    if (ch === "C") {
      showPrompt("Press ENTER to open Camp");
      if (interactPressed) openCustomize(STATE.OVERWORLD);
    } else if (ch === "G") {
      if (S.totalDefeats >= 6) {
        if (S.fuelLevel >= CATCH_LEVELS.length) {
          showPrompt("Press ENTER to enter the Portal");
          if (interactPressed) triggerFinalVictory();
        } else {
          showPrompt("Press ENTER — looks like you need more fuel");
          if (interactPressed) triggerFuelIntro();
        }
      } else {
        showPrompt("Defeat all creatures first (" + S.totalDefeats + "/6)");
      }
    } else {
      hidePrompt();
    }
  }

  function showPrompt(msg) { el.prompt.textContent = msg; el.prompt.classList.remove("hidden"); }
  function hidePrompt() { el.prompt.classList.add("hidden"); }

  // ---------------- Encounters ----------------
  function triggerEncounter(monster) {
    mode = STATE.ENCOUNTER;
    currentMonster = monster;
    hidePrompt();
    playSound("alert");
    showScreen("encounter");
    el.btnFlee.classList.remove("hidden");
    var def = MONSTER_DEFS[monster.type];
    el.encounterHeader.textContent = "Level " + monster.id + " of 6";
    el.encounterDialogue.textContent = def.intro;
    renderPuzzleFor(monster);
  }

  function cleanupActivePuzzle() {
    if (activeCleanup) { activeCleanup(); activeCleanup = null; }
  }

  function retreat() {
    cleanupActivePuzzle();
    mode = STATE.OVERWORLD;
    currentMonster = null;
    hideAllScreens();
  }
  el.btnFlee.addEventListener("click", retreat);

  function renderPuzzleFor(monster) {
    cleanupActivePuzzle();
    var def = MONSTER_DEFS[monster.type];
    var params = PUZZLE_PARAMS[monster.id] || {};
    el.puzzleArea.innerHTML = "";
    var onWin = function () { handlePuzzleWin(monster); };
    if (def.puzzle === "memory") buildMemoryPuzzle(el.puzzleArea, params, onWin);
    else if (def.puzzle === "simon") buildSimonPuzzle(el.puzzleArea, params, onWin);
    else if (def.puzzle === "reaction") buildReactionPuzzle(el.puzzleArea, params, onWin);
  }

  function handlePuzzleWin(monster) {
    cleanupActivePuzzle();
    el.btnFlee.classList.add("hidden");
    playSound("win");
    monster.defeated = true;
    if (S.defeatedIds.indexOf(monster.id) === -1) S.defeatedIds.push(monster.id);
    S.totalDefeats++;
    var prevStage = stageFromDefeats(S.totalDefeats - 1);
    var newStage = stageFromDefeats(S.totalDefeats);
    grantReward(S.totalDefeats);
    saveGame();
    spawnParticles(canvas.width / 2, canvas.height * 0.35, "#f4c542", 26);

    el.encounterDialogue.textContent = "You defeated the " + MONSTER_DEFS[monster.type].label + "! " + S.catName + " feels stronger.";
    el.puzzleArea.innerHTML = "";
    if (newStage > prevStage) {
      playSound("levelup");
      var growMsg = document.createElement("p");
      growMsg.textContent = S.catName + " grew into a " + STAGE_LABELS[newStage] + "!";
      growMsg.style.color = "#f4c542";
      growMsg.style.fontWeight = "700";
      el.puzzleArea.appendChild(growMsg);
    }
    var cont = document.createElement("button");
    cont.textContent = "Continue";
    cont.addEventListener("click", function () {
      mode = STATE.OVERWORLD;
      currentMonster = null;
      hideAllScreens();
      updateHud();
    });
    el.puzzleArea.appendChild(cont);
    updateHud();
  }

  function grantReward(defeatNumber) {
    var key = REWARD_SCHEDULE[defeatNumber - 1];
    if (!key || S.unlockedCharacters.indexOf(key) !== -1) return;
    S.unlockedCharacters.push(key);
    showToast("New cat unlocked: " + characterName(key) + "! Visit Camp to play as them.");
  }

  function triggerFinalVictory() {
    mode = STATE.VICTORY_SCREEN;
    el.catchHud.classList.add("hidden");
    playSound("victory");
    showScreen("victory");
    el.victoryStats.textContent = S.catName + " gathered enough fuel to power the Portal and reached the next world!";
    spawnParticles(canvas.width / 2, canvas.height / 2, "#e8934a", 40);
  }
  el.btnVictoryContinue.addEventListener("click", function () { mode = STATE.OVERWORLD; hideAllScreens(); });
  el.btnVictoryTitle.addEventListener("click", function () { mode = STATE.TITLE; showScreen("title"); refreshTitleButtons(); });

  // ---------------- World 2: fuel-catching minigame ----------------
  var catchState = null;

  function triggerFuelIntro() {
    mode = STATE.CATCH;
    hidePrompt();
    hideAllScreens();
    showScreen("fuelIntro");
  }
  el.btnFuelBegin.addEventListener("click", function () { startCatchLevel(S.fuelLevel || 0); });

  function startCatchLevel(idx) {
    var cfg = CATCH_LEVELS[idx];
    catchState = {
      levelIndex: idx,
      target: cfg.target,
      fallSpeed: cfg.fallSpeed,
      spawnInterval: cfg.spawnInterval,
      bugChance: cfg.bugChance,
      fruitCount: 0,
      bugsCount: 0,
      timeLeft: CATCH_TIME_LIMIT,
      items: [],
      spawnTimer: 300,
      plateX: canvas.width / 2 - CATCH_PLATE_W / 2,
      running: true
    };
    mode = STATE.CATCH;
    hideAllScreens();
    el.catchHud.classList.remove("hidden");
    updateCatchHud();
  }

  function updateCatchHud() {
    el.catchLevelLabel.textContent = "World 2 — Level " + (catchState.levelIndex + 1) + " of " + CATCH_LEVELS.length;
    el.catchFruitLabel.textContent = "Fruit: " + catchState.fruitCount + "/" + catchState.target;
    el.catchBugsLabel.textContent = "Bugs: " + catchState.bugsCount + "/" + CATCH_MAX_BUGS;
    el.catchTimeLabel.textContent = "Time: " + Math.max(0, Math.ceil(catchState.timeLeft)) + "s";
  }

  function spawnCatchItem() {
    var isBug = Math.random() < catchState.bugChance;
    catchState.items.push({
      x: 10 + Math.random() * (canvas.width - 20 - CATCH_ITEM_SIZE),
      y: CATCH_SPAWN_Y,
      type: isBug ? "bug" : "fruit"
    });
  }

  function handleCatchHit(type) {
    if (type === "fruit") {
      catchState.fruitCount++;
      playSound("match");
    } else {
      catchState.bugsCount++;
      playSound("buzz");
      if (catchState.fruitCount > 0) catchState.fruitCount--;
    }
  }

  function updateCatch(dt) {
    if (!catchState || !catchState.running) return;
    var dx = 0;
    if (keys.ArrowLeft || keys.a || keys.A) dx -= 1;
    if (keys.ArrowRight || keys.d || keys.D) dx += 1;
    catchState.plateX = Math.max(0, Math.min(canvas.width - CATCH_PLATE_W, catchState.plateX + dx * CATCH_PLATE_SPEED * dt));
    catchState.facing = dx < 0 ? "left" : (dx > 0 ? "right" : (catchState.facing || "right"));
    if (dx !== 0) {
      catchState.walkTimer = (catchState.walkTimer || 0) + dt;
      if (catchState.walkTimer > 0.14) { catchState.walkFrame = 1 - (catchState.walkFrame || 0); catchState.walkTimer = 0; }
    } else {
      catchState.walkFrame = 0;
    }

    catchState.spawnTimer -= dt * 1000;
    if (catchState.spawnTimer <= 0) {
      spawnCatchItem();
      catchState.spawnTimer = catchState.spawnInterval;
    }

    var plateY = canvas.height - CATCH_GROUND_H;
    catchState.items = catchState.items.filter(function (it) {
      it.y += catchState.fallSpeed * dt;
      if (it.y + CATCH_ITEM_SIZE >= plateY && it.y < plateY + CATCH_PLATE_H &&
          it.x + CATCH_ITEM_SIZE > catchState.plateX && it.x < catchState.plateX + CATCH_PLATE_W) {
        handleCatchHit(it.type);
        return false;
      }
      return it.y < canvas.height + 20;
    });

    catchState.timeLeft -= dt;
    updateCatchHud();

    if (catchState.fruitCount >= catchState.target) endCatchLevel(true);
    else if (catchState.bugsCount >= CATCH_MAX_BUGS) endCatchLevel(false, "bugs");
    else if (catchState.timeLeft <= 0) endCatchLevel(false, "time");
  }

  function drawSceneryTree(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#6b4c30";
    ctx.fillRect(6, 9, 4, 7);
    Sprites.pixelCircle(ctx, 8, 6, 6, "#2e6b34");
    Sprites.pixelCircle(ctx, 8, 5, 4, "#3c8442");
    ctx.restore();
  }

  function drawCatchBackground(t) {
    var groundY = canvas.height - CATCH_GROUND_H;
    ctx.fillStyle = "#7fb3d5";
    ctx.fillRect(0, 0, canvas.width, groundY);

    // sun
    Sprites.pixelCircle(ctx, canvas.width - 60, 50, 26, "#fff3a0");

    // drifting clouds
    for (var i = 0; i < 4; i++) {
      var cx = ((i * 150 + t * 12) % (canvas.width + 120)) - 60;
      var cy = 26 + (i % 2) * 42;
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(cx, cy, 40, 12);
      ctx.fillRect(cx + 10, cy - 8, 30, 12);
    }

    // trees framing the scene
    [8, 44, canvas.width - 52, canvas.width - 96].forEach(function (tx) {
      drawSceneryTree(tx, groundY - 46, 2.6);
    });

    // ground strip
    ctx.fillStyle = "#3f7a34";
    ctx.fillRect(0, groundY, canvas.width, CATCH_GROUND_H);
    ctx.fillStyle = "#356b2c";
    for (var gx = 0; gx < canvas.width; gx += 20) {
      ctx.fillRect(gx, groundY + 4, 10, 4);
    }
  }

  function drawCatchGame(t) {
    if (!catchState) return;
    drawCatchBackground(t || 0);

    catchState.items.forEach(function (it) {
      ctx.save();
      ctx.translate(it.x, it.y);
      ctx.scale(CATCH_ITEM_SIZE / 16, CATCH_ITEM_SIZE / 16);
      if (it.type === "fruit") Sprites.drawFruit(ctx); else Sprites.drawBug(ctx);
      ctx.restore();
    });

    var groundY = canvas.height - CATCH_GROUND_H;
    var catScale = 3;
    var catCx = catchState.plateX + CATCH_PLATE_W / 2;
    var catTop = groundY - 16 * catScale + 24;
    ctx.save();
    ctx.translate(catCx - 8 * catScale, catTop);
    ctx.scale(catScale, catScale);
    Sprites.drawCat(ctx, {
      color: S ? S.character : "orange",
      dir: catchState.facing || "right",
      walkFrame: catchState.walkFrame || 0
    });
    ctx.restore();

    ctx.save();
    ctx.translate(catchState.plateX, canvas.height - CATCH_GROUND_H);
    Sprites.drawBowl(ctx, CATCH_PLATE_W, CATCH_PLATE_H);
    ctx.restore();
  }

  function endCatchLevel(won, reason) {
    catchState.running = false;
    if (won) {
      S.fuelLevel = Math.max(S.fuelLevel || 0, catchState.levelIndex + 1);
      saveGame();
      if (catchState.levelIndex >= CATCH_LEVELS.length - 1) {
        triggerFinalVictory();
      } else {
        showCatchResult(true);
      }
    } else {
      showCatchResult(false, reason);
    }
  }

  function showCatchResult(won, reason) {
    if (won) {
      el.catchResultTitle.textContent = "Level " + (catchState.levelIndex + 1) + " Complete!";
      el.catchResultMessage.textContent = "Great catching! Ready for the next level?";
      el.btnCatchRetry.classList.add("hidden");
      el.btnCatchContinue.textContent = "Next Level";
      el.btnCatchContinue.classList.remove("hidden");
    } else {
      var why = reason === "bugs" ? "Too many bugs got through!" : "Time's up!";
      el.catchResultTitle.textContent = "Try Again";
      el.catchResultMessage.textContent = why + " You need " + catchState.target + " fruit to fuel this level.";
      el.btnCatchContinue.classList.add("hidden");
      el.btnCatchRetry.classList.remove("hidden");
    }
    showScreen("catchResult");
  }
  el.btnCatchContinue.addEventListener("click", function () {
    hideAllScreens();
    startCatchLevel(catchState.levelIndex + 1);
  });
  el.btnCatchRetry.addEventListener("click", function () {
    hideAllScreens();
    startCatchLevel(catchState.levelIndex);
  });
  el.btnCatchLeave.addEventListener("click", function () {
    catchState = null;
    mode = STATE.OVERWORLD;
    el.catchHud.classList.add("hidden");
    hideAllScreens();
  });

  // ---------------- Puzzle: Memory Match ----------------
  function buildMemoryPuzzle(container, opts, onWin) {
    var pairCount = opts.pairs || 3;
    var icons = Sprites.ICONS.slice(0, pairCount);
    var deck = icons.concat(icons).map(function (k) { return { key: k, matched: false }; });
    shuffleArray(deck);
    var flipped = [], locked = false, matched = 0;

    var info = document.createElement("div");
    info.className = "puzzle-info";
    info.textContent = "Find all " + pairCount + " matching pairs";
    container.appendChild(info);

    var grid = document.createElement("div");
    grid.className = "memory-grid";
    grid.style.gridTemplateColumns = "repeat(" + (pairCount <= 3 ? 3 : 4) + ", 1fr)";
    container.appendChild(grid);

    var cardEls = deck.map(function (card, idx) {
      var cv = document.createElement("canvas");
      cv.width = 60; cv.height = 60;
      cv.className = "memory-card-canvas";
      drawCardBack(cv.getContext("2d"));
      cv.addEventListener("click", function () { flip(idx); });
      grid.appendChild(cv);
      return cv;
    });

    function drawCardBack(cctx) {
      cctx.clearRect(0, 0, 60, 60);
      cctx.fillStyle = "#e8934a";
      cctx.fillRect(0, 0, 60, 60);
      cctx.fillStyle = "#c9702c";
      cctx.fillRect(4, 4, 52, 52);
      cctx.save();
      cctx.translate(15, 15);
      cctx.scale(1.9, 1.9);
      Sprites.drawIcon(cctx, "paw");
      cctx.restore();
    }
    function drawCardFace(cctx, key) {
      cctx.clearRect(0, 0, 60, 60);
      cctx.fillStyle = "#f2ead8";
      cctx.fillRect(0, 0, 60, 60);
      cctx.save();
      cctx.translate(14, 14);
      cctx.scale(2, 2);
      Sprites.drawIcon(cctx, key);
      cctx.restore();
    }
    function redraw(idx) {
      var cctx = cardEls[idx].getContext("2d");
      var card = deck[idx];
      if (card.matched || flipped.indexOf(idx) !== -1) drawCardFace(cctx, card.key);
      else drawCardBack(cctx);
    }

    function flip(idx) {
      if (locked || deck[idx].matched || flipped.indexOf(idx) !== -1 || flipped.length >= 2) return;
      flipped.push(idx);
      redraw(idx);
      playSound("flip");
      if (flipped.length === 2) {
        var a = flipped[0], b = flipped[1];
        if (deck[a].key === deck[b].key) {
          deck[a].matched = true; deck[b].matched = true;
          matched++;
          flipped = [];
          playSound("match");
          if (matched === pairCount) { locked = true; setTimeout(onWin, 400); }
        } else {
          locked = true;
          setTimeout(function () {
            flipped = [];
            redraw(a); redraw(b);
            locked = false;
          }, 700);
        }
      }
    }
  }

  // ---------------- Puzzle: Simon pattern ----------------
  function buildSimonPuzzle(container, opts, onWin) {
    var targetLen = opts.target || 4;
    var pads = ["fish", "paw", "star", "moon"];
    var keyMap = { fish: "ArrowUp", paw: "ArrowRight", star: "ArrowDown", moon: "ArrowLeft" };
    var padColors = { fish: "#3f7fd1", paw: "#e8934a", star: "#f4c542", moon: "#9098a3" };
    var sequence = [], playerIdx = 0, showing = false;

    var keySymbol = { ArrowUp: "↑", ArrowRight: "→", ArrowDown: "↓", ArrowLeft: "←" };

    var info = document.createElement("div");
    info.className = "puzzle-info";
    container.appendChild(info);
    function setInfo(msg) { info.textContent = msg; }
    setInfo("Watch the pattern, then repeat it. Target length: " + targetLen);

    var grid = document.createElement("div");
    grid.className = "simon-grid";
    container.appendChild(grid);

    var padEls = {};
    pads.forEach(function (key) {
      var wrap = document.createElement("div");
      wrap.className = "simon-pad-wrap";
      var cv = document.createElement("canvas");
      cv.width = 70; cv.height = 70;
      cv.className = "simon-pad";
      drawPad(cv.getContext("2d"), key, false);
      cv.addEventListener("click", function () { handleInput(key); });
      wrap.appendChild(cv);
      var label = document.createElement("div");
      label.className = "simon-pad-key";
      label.textContent = keySymbol[keyMap[key]];
      wrap.appendChild(label);
      grid.appendChild(wrap);
      padEls[key] = cv;
    });

    function drawPad(cctx, key, lit) {
      cctx.clearRect(0, 0, 70, 70);
      cctx.fillStyle = lit ? "#ffffff" : padColors[key];
      cctx.fillRect(0, 0, 70, 70);
      cctx.save();
      cctx.translate(19, 19);
      cctx.scale(2, 2);
      Sprites.drawIcon(cctx, key);
      cctx.restore();
    }
    function flashPad(key, on) { drawPad(padEls[key].getContext("2d"), key, on); }

    function nextRound() {
      sequence.push(pads[Math.floor(Math.random() * pads.length)]);
      playerIdx = 0;
      setInfo("Watch closely... (" + sequence.length + "/" + targetLen + ")");
      playSequence();
    }

    var seqTimeout = null;
    function playSequence() {
      showing = true;
      var i = 0;
      function step() {
        if (i > 0) flashPad(sequence[i - 1], false);
        if (i >= sequence.length) { showing = false; setInfo("Your turn! Repeat the pattern."); return; }
        flashPad(sequence[i], true);
        beep(300 + i * 40, 0.15, "sine");
        i++;
        seqTimeout = setTimeout(step, 550);
      }
      seqTimeout = setTimeout(step, 500);
    }

    function handleInput(key) {
      if (showing) return;
      flashPad(key, true);
      setTimeout(function () { flashPad(key, false); }, 180);
      if (key === sequence[playerIdx]) {
        playerIdx++;
        if (playerIdx === sequence.length) {
          if (sequence.length >= targetLen) {
            setInfo("Pattern mastered!");
            cleanupActivePuzzle();
            setTimeout(onWin, 400);
          } else {
            setTimeout(nextRound, 700);
          }
        }
      } else {
        playSound("buzz");
        setInfo("Not quite — watch again...");
        sequence = [];
        setTimeout(nextRound, 900);
      }
    }

    function keyHandler(e) {
      for (var k in keyMap) if (keyMap[k] === e.key) handleInput(k);
    }
    document.addEventListener("keydown", keyHandler);
    activeCleanup = function () { document.removeEventListener("keydown", keyHandler); clearTimeout(seqTimeout); };

    nextRound();
  }

  // ---------------- Puzzle: Reaction game ----------------
  function buildReactionPuzzle(container, opts, onWin) {
    var targetScore = opts.target || 8;
    var timeLimit = opts.time || 18;
    var score = 0, timeLeft = timeLimit, activeHole = -1, running = true;

    var info = document.createElement("div");
    info.className = "puzzle-info";
    container.appendChild(info);
    function updateInfo() { info.textContent = "Whack the pests! Score " + score + "/" + targetScore + " — Time " + Math.ceil(timeLeft) + "s"; }
    updateInfo();

    var grid = document.createElement("div");
    grid.className = "reaction-grid";
    grid.style.gridTemplateColumns = "repeat(3, 60px)";
    container.appendChild(grid);

    // Pests start slow and speed up as your score climbs, with a floor so it
    // never becomes unfair — reaction time never drops below POP_DURATION_FLOOR.
    var POP_DURATION_START = 1100;
    var POP_DURATION_FLOOR = 600;
    var POP_DURATION_STEP = 60; // ms faster per point scored
    function currentPopDuration() {
      return Math.max(POP_DURATION_FLOOR, POP_DURATION_START - score * POP_DURATION_STEP);
    }
    var HIT_FLASH_DURATION = 260; // how long the blue "hit!" flash holds before the next pest pops

    var holes = [];
    function drawHole(cctx, state) {
      // state: false = empty, true = pest is up, "hit" = just whacked (blue flash)
      cctx.clearRect(0, 0, 60, 60);
      cctx.fillStyle = "#3a2a1c";
      cctx.beginPath();
      cctx.ellipse(30, 44, 24, 10, 0, 0, Math.PI * 2);
      cctx.fill();
      if (state === true) {
        cctx.save();
        cctx.translate(14, 12);
        cctx.scale(2, 2);
        Sprites.drawIcon(cctx, "mouse");
        cctx.restore();
      } else if (state === "hit") {
        Sprites.pixelCircle(cctx, 30, 26, 18, "#3f7fd1");
        Sprites.pixelCircle(cctx, 30, 26, 10, "#7fb3e0");
      }
    }
    for (var i = 0; i < 9; i++) {
      var cv = document.createElement("canvas");
      cv.width = 60; cv.height = 60;
      cv.className = "reaction-hole";
      drawHole(cv.getContext("2d"), false);
      (function (idx) { cv.addEventListener("click", function () { whack(idx); }); })(i);
      grid.appendChild(cv);
      holes.push(cv);
    }

    var popTimeout = null;
    function scheduleNextPop(delay) {
      clearTimeout(popTimeout);
      popTimeout = setTimeout(popRandom, delay);
    }

    function whack(i) {
      if (!running || i !== activeHole) return;
      score++;
      playSound("hit");
      var myHole = i;
      drawHole(holes[myHole].getContext("2d"), "hit");
      activeHole = -1;
      updateInfo();
      if (score >= targetScore) {
        running = false;
        clearTimeout(popTimeout);
        cleanupActivePuzzle();
        setTimeout(onWin, 400);
        return;
      }
      scheduleNextPop(HIT_FLASH_DURATION);
      setTimeout(function () {
        // guard: skip if popRandom already reused this exact hole for the next pest
        if (holes[myHole] && activeHole !== myHole) drawHole(holes[myHole].getContext("2d"), false);
      }, HIT_FLASH_DURATION - 20);
    }

    function popRandom() {
      if (!running) return;
      if (activeHole >= 0) drawHole(holes[activeHole].getContext("2d"), false);
      activeHole = Math.floor(Math.random() * holes.length);
      drawHole(holes[activeHole].getContext("2d"), true);
      scheduleNextPop(currentPopDuration());
    }

    var timerInt = null;
    function startTimer() {
      timerInt = setInterval(function () {
        if (!running) { clearInterval(timerInt); return; }
        timeLeft -= 0.1;
        updateInfo();
        if (timeLeft <= 0) {
          running = false;
          clearInterval(timerInt);
          clearTimeout(popTimeout);
          info.textContent = "Out of time!";
          var retryBtn = document.createElement("button");
          retryBtn.textContent = "Try Again";
          retryBtn.className = "btn-secondary";
          retryBtn.addEventListener("click", function () {
            container.innerHTML = "";
            buildReactionPuzzle(container, opts, onWin);
          });
          container.appendChild(retryBtn);
        }
      }, 100);
    }

    running = false;
    var countdownSteps = ["Get Ready...", "3", "2", "1", "Go!"];
    var countdownTimeout = null;
    var ci = 0;
    function countdown() {
      info.textContent = countdownSteps[ci];
      ci++;
      if (ci < countdownSteps.length) {
        countdownTimeout = setTimeout(countdown, 500);
      } else {
        running = true;
        updateInfo();
        startTimer();
        popRandom();
      }
    }
    countdown();
    activeCleanup = function () { running = false; clearInterval(timerInt); clearTimeout(popTimeout); clearTimeout(countdownTimeout); };
  }

  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
  }

  // ---------------- Customize ----------------
  var previewCharacter;

  function openCustomize(returnMode) {
    customizeReturnMode = returnMode;
    previewCharacter = S.character;
    el.customizeTitle.textContent = "Customize Your Cat";
    hideAllScreens();
    showScreen("customize");
    buildCustomizeOptions();
    renderCustomizePreview();
  }

  function buildCustomizeOptions() {
    el.colorOptions.innerHTML = "";
    CHARACTERS.forEach(function (character) {
      var unlocked = S.unlockedCharacters.indexOf(character.key) !== -1;
      var sw = document.createElement("div");
      sw.className = "option-swatch" + (character.key === previewCharacter ? " selected" : "") + (unlocked ? "" : " locked");
      var cv = document.createElement("canvas");
      cv.width = 32; cv.height = 32;
      var cctx = cv.getContext("2d");
      Sprites.noSmooth(cctx);
      cctx.save(); cctx.scale(2, 2);
      Sprites.drawCat(cctx, { color: character.key, dir: "down", walkFrame: 0 });
      cctx.restore();
      sw.appendChild(cv);
      sw.title = unlocked ? character.name : character.name + " (locked)";
      sw.addEventListener("click", function () {
        if (!unlocked) return;
        previewCharacter = character.key;
        buildCustomizeOptions();
        renderCustomizePreview();
      });
      el.colorOptions.appendChild(sw);
    });
  }

  function renderCustomizePreview() {
    var cctx = el.customizePreview.getContext("2d");
    Sprites.noSmooth(cctx);
    cctx.clearRect(0, 0, 128, 128);
    cctx.fillStyle = "#1a2b1a";
    cctx.fillRect(0, 0, 128, 128);
    cctx.save();
    cctx.translate(16, 24);
    cctx.scale(6, 6);
    Sprites.drawCat(cctx, { color: previewCharacter, dir: "down", walkFrame: 0 });
    cctx.restore();
    el.customizeCharacterName.textContent = characterName(previewCharacter);
  }

  el.btnCustomizeDone.addEventListener("click", function () {
    S.character = previewCharacter;
    S.catName = characterName(previewCharacter);
    saveGame();
    hideAllScreens();
    updateHud();
    if (customizeReturnMode === STATE.OVERWORLD) { mode = STATE.OVERWORLD; }
    else { mode = STATE.TITLE; showScreen("title"); refreshTitleButtons(); }
  });

  // ---------------- HUD ----------------
  function updateHud() {
    el.hudName.textContent = S.catName;
    el.hudStage.textContent = STAGE_LABELS[stageFromDefeats(S.totalDefeats)];
    el.hudDefeats.textContent = "Level " + (Math.min(6, S.totalDefeats + 1)) + " of 6";
    var cctx = el.hudIcon.getContext("2d");
    Sprites.noSmooth(cctx);
    cctx.clearRect(0, 0, 32, 32);
    cctx.save(); cctx.scale(2, 2);
    Sprites.drawCat(cctx, { color: S.character, dir: "down", walkFrame: 0 });
    cctx.restore();
  }

  // ---------------- Pause ----------------
  function openPause() {
    hideAllScreens();
    showScreen("pause");
  }
  function closePause() { hideAllScreens(); }
  el.pauseBtn.addEventListener("click", function () { if (mode === STATE.OVERWORLD) openPause(); });
  el.btnResume.addEventListener("click", closePause);
  el.btnCustomizePause.addEventListener("click", function () { openCustomize(STATE.OVERWORLD); });
  el.btnExitTitle.addEventListener("click", function () {
    mode = STATE.TITLE;
    showScreen("title");
    refreshTitleButtons();
  });

  // ---------------- Title / How to play ----------------
  function refreshTitleButtons() {
    el.btnContinue.classList.toggle("hidden", !loadGame());
  }
  el.btnHowTo.addEventListener("click", function () { hideAllScreens(); showScreen("howto"); });
  el.btnHowToClose.addEventListener("click", function () { hideAllScreens(); showScreen("title"); });
  el.btnCustomizeTitle.addEventListener("click", function () {
    if (!S) { S = loadGame() || defaultState(); applyDefeatedFlags(); }
    openCustomize(STATE.TITLE);
  });

  var confirmOnYes = null;
  function showConfirm(message, onYes) {
    confirmOnYes = onYes;
    el.confirmMessage.textContent = message;
    hideAllScreens();
    showScreen("confirm");
  }
  el.btnConfirmYes.addEventListener("click", function () {
    var cb = confirmOnYes; confirmOnYes = null;
    hideAllScreens();
    if (cb) cb();
  });
  el.btnConfirmNo.addEventListener("click", function () {
    confirmOnYes = null;
    hideAllScreens();
    showScreen("title");
  });

  function beginNewGame() {
    S = defaultState();
    applyDefeatedFlags();
    player.x = START_PX.x; player.y = START_PX.y; player.dir = "down";
    saveGame();
    hideAllScreens();
    showScreen("intro");
  }

  el.btnIntroBegin.addEventListener("click", startOverworld);

  el.btnNewGame.addEventListener("click", function () {
    if (loadGame()) {
      showConfirm("Start a new game? Your current progress will be overwritten.", beginNewGame);
    } else {
      beginNewGame();
    }
  });

  el.btnContinue.addEventListener("click", function () {
    S = loadGame() || defaultState();
    applyDefeatedFlags();
    player.x = S.playerX; player.y = S.playerY;
    startOverworld();
  });

  function startOverworld() {
    mode = STATE.OVERWORLD;
    hideAllScreens();
    updateHud();
  }

  // ---------------- Main loop ----------------
  // Uses requestAnimationFrame as the primary driver, with a setInterval watchdog
  // that keeps ticking if rAF stalls (e.g. a backgrounded/embedded webview tab)
  // so the game never just freezes.
  var lastTs = 0;
  var lastFrameWallClock = performance.now();

  function frame(ts) {
    var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
    lastTs = ts;
    var t = ts / 1000;

    if (mode === STATE.LOADING) {
      loadingTimer += dt;
      if (loadingTimer >= LOAD_DURATION + 0.3) {
        mode = STATE.TITLE;
        refreshTitleButtons();
        showScreen("title");
      }
    } else if (mode === STATE.OVERWORLD) {
      updateOverworld(dt);
      S.playerX = player.x; S.playerY = player.y;
    } else if (mode === STATE.CATCH) {
      updateCatch(dt);
    }
    updateParticles(dt);
    interactPressed = false;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (mode === STATE.LOADING) drawLoading(t);
    else if (mode === STATE.ENCOUNTER) drawEncounterBackdrop(t);
    else if (mode === STATE.CATCH) drawCatchGame(t);
    else drawOverworld(t);
  }

  function loop(ts) {
    lastFrameWallClock = performance.now();
    frame(ts);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  el.loading.addEventListener("click", function () {
    if (mode === STATE.LOADING) { loadingTimer = LOAD_DURATION + 0.3; }
  });

  setInterval(function () {
    var now = performance.now();
    if (now - lastFrameWallClock > 150) {
      lastFrameWallClock = now;
      frame(now);
    }
  }, 100);
})();
