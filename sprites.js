// Procedural pixel-art renderer. Everything is drawn as blocky rects/pixel-circles
// at a small native resolution, then scaled with imageSmoothingEnabled=false for a
// crisp pixel-art look — no emoji, no external art assets.

var Sprites = (function () {
  "use strict";

  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  function pixelCircle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (var dy = -r; dy <= r; dy++) {
      var dx = Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy)) + 0.5);
      ctx.fillRect(Math.round(cx - dx), Math.round(cy + dy), dx * 2, 1);
    }
  }

  function noSmooth(ctx) { ctx.imageSmoothingEnabled = false; }

  // ---------- Cats ----------
  var CAT_PALETTES = {
    orange: { fur: "#e8934a", shade: "#b56b2e", belly: "#fbdcb0" },
    black:  { fur: "#3a3742", shade: "#232028", belly: "#6b6672" },
    white:  { fur: "#f3efe4", shade: "#cfc7b4", belly: "#ffffff" },
    grey:   { fur: "#9098a3", shade: "#69707c", belly: "#e2e7ec" },
    calico: { fur: "#e8934a", shade: "#232028", belly: "#fbdcb0" },
    cream:  { fur: "#f0d9a8", shade: "#cdad76", belly: "#fff6e0" },
    golden: { fur: "#f4c542", shade: "#c99a2e", belly: "#fff3c4" }
  };

  function drawCat(ctx, opts) {
    // opts: { color, dir, walkFrame }
    var pal = CAT_PALETTES[opts.color] || CAT_PALETTES.orange;
    var dir = opts.dir || "down";
    var flip = dir === "left";
    var back = dir === "up";
    var bob = opts.walkFrame ? 1 : 0;

    ctx.save();
    if (flip) { ctx.translate(16, 0); ctx.scale(-1, 1); }

    // tail
    px(ctx, 1, 6 - bob, 2, 2, pal.shade);
    px(ctx, 0, 8 - bob, 2, 3, pal.shade);

    // back feet
    px(ctx, 5, 14, 2, 2, pal.shade);
    px(ctx, 9, 14, 2, 2, pal.shade);
    if (bob) { px(ctx, 5, 14, 2, 2, pal.fur); px(ctx, 9, 13, 2, 2, pal.shade); }

    // body
    px(ctx, 4, 9, 8, 5, pal.fur);
    px(ctx, 5, 13, 6, 2, pal.belly);

    // head
    pixelCircle(ctx, 8, 6, 5, pal.fur);
    px(ctx, 5, 8, 6, 2, pal.belly);

    // ears
    px(ctx, 3, 1, 3, 3, pal.fur);
    px(ctx, 10, 1, 3, 3, pal.fur);
    px(ctx, 4, 2, 1, 2, pal.shade);
    px(ctx, 11, 2, 1, 2, pal.shade);

    if (opts.color === "calico") {
      px(ctx, 3, 3, 3, 4, pal.shade);
      px(ctx, 9, 10, 3, 3, "#e8934a");
    }

    if (!back) {
      px(ctx, 5, 6, 2, 2, "#231a12");
      px(ctx, 9, 6, 2, 2, "#231a12");
      px(ctx, 7, 8, 2, 1, "#cf7089");
    } else {
      px(ctx, 6, 3, 4, 5, pal.shade);
    }

    ctx.restore();
  }

  // ---------- Tiles (16x16 native) ----------
  function drawTile(ctx, type, variant) {
    if (type === "grass") {
      px(ctx, 0, 0, 16, 16, variant ? "#4c8a3f" : "#57974a");
      px(ctx, 3, 4, 2, 2, "#3f7a34");
      px(ctx, 10, 9, 2, 2, "#3f7a34");
      px(ctx, 7, 12, 2, 2, "#3f7a34");
    } else if (type === "flower") {
      drawTile(ctx, "grass", variant);
      px(ctx, 7, 6, 2, 2, "#fff3a0");
      px(ctx, 6, 5, 1, 1, "#e0455c");
      px(ctx, 9, 5, 1, 1, "#e0455c");
      px(ctx, 6, 8, 1, 1, "#e0455c");
      px(ctx, 9, 8, 1, 1, "#e0455c");
    } else if (type === "tree") {
      px(ctx, 0, 0, 16, 16, "#57974a");
      px(ctx, 6, 9, 4, 6, "#6b4c30");
      pixelCircle(ctx, 8, 6, 6, "#2e6b34");
      pixelCircle(ctx, 8, 5, 4, "#3c8442");
    } else if (type === "water") {
      px(ctx, 0, 0, 16, 16, "#2f6fae");
      px(ctx, 2, 4, 5, 1, "#5b96d1");
      px(ctx, 9, 9, 5, 1, "#5b96d1");
      px(ctx, 4, 12, 4, 1, "#5b96d1");
    } else if (type === "rock") {
      px(ctx, 0, 0, 16, 16, "#57974a");
      pixelCircle(ctx, 8, 9, 6, "#8a8a8a");
      pixelCircle(ctx, 6, 7, 2, "#a5a5a5");
      px(ctx, 4, 12, 8, 2, "#6f6f6f");
    } else if (type === "path") {
      px(ctx, 0, 0, 16, 16, "#c9a86b");
      px(ctx, 2, 2, 2, 2, "#b6924f");
      px(ctx, 11, 6, 2, 2, "#b6924f");
      px(ctx, 5, 11, 2, 2, "#b6924f");
    } else if (type === "camp") {
      drawTile(ctx, "path", 0);
      px(ctx, 3, 5, 10, 8, "#c22f45");
      px(ctx, 3, 5, 10, 2, "#e0455c");
      px(ctx, 7, 8, 2, 5, "#241a12");
      px(ctx, 2, 12, 12, 2, "#6b4c30");
    } else if (type === "goal-locked") {
      px(ctx, 0, 0, 16, 16, "#57974a");
      pixelCircle(ctx, 8, 8, 6, "#4a4458");
      pixelCircle(ctx, 8, 8, 3, "#2c2833");
    } else if (type === "goal-open") {
      px(ctx, 0, 0, 16, 16, "#57974a");
      pixelCircle(ctx, 8, 8, 7, "#b06fe0");
      pixelCircle(ctx, 8, 8, 5, "#8a4fd1");
      pixelCircle(ctx, 8, 8, 2, "#f3e8ff");
    } else if (type === "cleared") {
      drawTile(ctx, "path", 0);
      px(ctx, 7, 4, 2, 2, "#f4c542");
      px(ctx, 5, 7, 2, 2, "#f4c542");
      px(ctx, 9, 7, 2, 2, "#f4c542");
      px(ctx, 7, 10, 2, 2, "#f4c542");
    }
  }

  // ---------- Monsters (native size scales with 'size') ----------
  function drawMonster(ctx, type, size, t) {
    var s = size / 16;
    var bob = Math.sin(t * 3) * 1.2 * s;
    ctx.save();
    ctx.translate(0, bob);

    if (type === "slime") {
      pixelCircle(ctx, size * 0.5, size * 0.6, size * 0.42, "#7ac74f");
      px(ctx, size * 0.1, size * 0.6, size * 0.8, size * 0.35, "#7ac74f");
      pixelCircle(ctx, size * 0.35, size * 0.55, size * 0.06, "#1f3d16");
      pixelCircle(ctx, size * 0.65, size * 0.55, size * 0.06, "#1f3d16");
      px(ctx, size * 0.2, size * 0.4, size * 0.15, size * 0.1, "#a3e07a");
    } else if (type === "bat") {
      px(ctx, size * 0.5 - size * 0.18, size * 0.3, size * 0.36, size * 0.36, "#4a4458");
      px(ctx, 0, size * 0.2, size * 0.32, size * 0.28, "#332e40");
      px(ctx, size * 0.68, size * 0.2, size * 0.32, size * 0.28, "#332e40");
      pixelCircle(ctx, size * 0.42, size * 0.44, size * 0.05, "#e0455c");
      pixelCircle(ctx, size * 0.58, size * 0.44, size * 0.05, "#e0455c");
      px(ctx, size * 0.3, size * 0.1, size * 0.08, size * 0.14, "#4a4458");
      px(ctx, size * 0.62, size * 0.1, size * 0.08, size * 0.14, "#4a4458");
    } else if (type === "crab") {
      px(ctx, size * 0.02, size * 0.42, size * 0.18, size * 0.14, "#d9603b");
      px(ctx, size * 0.8, size * 0.42, size * 0.18, size * 0.14, "#d9603b");
      pixelCircle(ctx, size * 0.5, size * 0.6, size * 0.36, "#e8703f");
      pixelCircle(ctx, size * 0.36, size * 0.5, size * 0.06, "#1f1512");
      pixelCircle(ctx, size * 0.64, size * 0.5, size * 0.06, "#1f1512");
      px(ctx, size * 0.28, size * 0.9, size * 0.1, size * 0.1, "#b5462a");
      px(ctx, size * 0.62, size * 0.9, size * 0.1, size * 0.1, "#b5462a");
    } else if (type === "golem") {
      px(ctx, size * 0.2, size * 0.15, size * 0.6, size * 0.5, "#8d8d8d");
      px(ctx, size * 0.1, size * 0.65, size * 0.8, size * 0.3, "#7a7a7a");
      px(ctx, size * 0.02, size * 0.4, size * 0.16, size * 0.3, "#7a7a7a");
      px(ctx, size * 0.82, size * 0.4, size * 0.16, size * 0.3, "#7a7a7a");
      px(ctx, size * 0.32, size * 0.3, size * 0.1, size * 0.1, "#f4c542");
      px(ctx, size * 0.58, size * 0.3, size * 0.1, size * 0.1, "#f4c542");
    } else if (type === "ghost") {
      pixelCircle(ctx, size * 0.5, size * 0.42, size * 0.34, "#eef1f5");
      px(ctx, size * 0.16, size * 0.42, size * 0.68, size * 0.4, "#eef1f5");
      for (var i = 0; i < 4; i++) {
        px(ctx, size * 0.16 + i * size * 0.17, size * 0.82, size * 0.1, size * 0.1, i % 2 ? "#eef1f5" : "transparent");
      }
      pixelCircle(ctx, size * 0.38, size * 0.42, size * 0.05, "#2c2833");
      pixelCircle(ctx, size * 0.62, size * 0.42, size * 0.05, "#2c2833");
    } else if (type === "dragon") {
      px(ctx, size * 0.05, size * 0.35, size * 0.22, size * 0.3, "#2e6b45");
      px(ctx, size * 0.73, size * 0.35, size * 0.22, size * 0.3, "#2e6b45");
      pixelCircle(ctx, size * 0.5, size * 0.55, size * 0.38, "#3f8f5f");
      pixelCircle(ctx, size * 0.5, size * 0.32, size * 0.22, "#3f8f5f");
      px(ctx, size * 0.36, size * 0.12, size * 0.06, size * 0.12, "#e8934a");
      px(ctx, size * 0.58, size * 0.12, size * 0.06, size * 0.12, "#e8934a");
      pixelCircle(ctx, size * 0.42, size * 0.3, size * 0.05, "#f4c542");
      pixelCircle(ctx, size * 0.58, size * 0.3, size * 0.05, "#f4c542");
      px(ctx, size * 0.44, size * 0.42, size * 0.12, size * 0.05, "#1f1512");
    }
    ctx.restore();
  }

  // ---------- Small icons (16x16 native) used in puzzles ----------
  function drawIcon(ctx, key) {
    if (key === "fish") {
      px(ctx, 3, 6, 8, 4, "#5b96d1");
      px(ctx, 10, 5, 3, 6, "#3f7fd1");
      px(ctx, 4, 7, 2, 2, "#eef1f5");
      px(ctx, 2, 5, 2, 2, "#3f7fd1");
    } else if (key === "yarn") {
      pixelCircle(ctx, 8, 8, 6, "#e0455c");
      pixelCircle(ctx, 8, 8, 3, "#c22f45");
      px(ctx, 3, 8, 3, 1, "#7a1e2e");
      px(ctx, 10, 5, 3, 1, "#7a1e2e");
    } else if (key === "bone") {
      px(ctx, 4, 7, 8, 2, "#f3efe4");
      px(ctx, 2, 5, 3, 3, "#f3efe4");
      px(ctx, 2, 9, 3, 3, "#f3efe4");
      px(ctx, 11, 5, 3, 3, "#f3efe4");
      px(ctx, 11, 9, 3, 3, "#f3efe4");
    } else if (key === "star") {
      px(ctx, 7, 2, 2, 5, "#f4c542");
      px(ctx, 2, 7, 12, 2, "#f4c542");
      px(ctx, 4, 10, 8, 2, "#f4c542");
      px(ctx, 3, 4, 2, 2, "#f4c542");
      px(ctx, 11, 4, 2, 2, "#f4c542");
      px(ctx, 5, 12, 2, 2, "#f4c542");
      px(ctx, 9, 12, 2, 2, "#f4c542");
    } else if (key === "moon") {
      pixelCircle(ctx, 8, 8, 6, "#f3efe4");
      pixelCircle(ctx, 10, 6, 5, "#241a12");
    } else if (key === "paw") {
      pixelCircle(ctx, 8, 10, 4, "#e8934a");
      pixelCircle(ctx, 4, 5, 2, "#e8934a");
      pixelCircle(ctx, 8, 3, 2, "#e8934a");
      pixelCircle(ctx, 12, 5, 2, "#e8934a");
    } else if (key === "heart") {
      px(ctx, 3, 4, 4, 4, "#e0455c");
      px(ctx, 9, 4, 4, 4, "#e0455c");
      px(ctx, 2, 7, 12, 3, "#e0455c");
      px(ctx, 4, 10, 8, 2, "#e0455c");
      px(ctx, 6, 12, 4, 2, "#e0455c");
    } else if (key === "fire") {
      px(ctx, 6, 2, 4, 4, "#e8934a");
      px(ctx, 4, 6, 8, 4, "#e0455c");
      px(ctx, 5, 10, 6, 3, "#c22f45");
      px(ctx, 6, 13, 4, 1, "#7a1e2e");
      px(ctx, 7, 8, 2, 3, "#f4c542");
    } else if (key === "mouse") {
      pixelCircle(ctx, 9, 9, 5, "#9098a3");
      px(ctx, 3, 5, 2, 2, "#9098a3");
      px(ctx, 5, 4, 2, 2, "#9098a3");
      px(ctx, 8, 7, 1, 1, "#1f1512");
      px(ctx, 1, 10, 3, 1, "#69707c");
    }
  }

  function makeIconCanvas(key, size, bg) {
    var c = document.createElement("canvas");
    c.width = size; c.height = size;
    var ctx = c.getContext("2d");
    noSmooth(ctx);
    if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, size, size); }
    ctx.save();
    ctx.scale(size / 16, size / 16);
    drawIcon(ctx, key);
    ctx.restore();
    return c;
  }

  // ---------- Fuel-catching minigame (16x16 native icons) ----------
  function drawFruit(ctx) {
    pixelCircle(ctx, 8, 10, 5, "#d1435c");
    pixelCircle(ctx, 7, 9, 3, "#e0455c");
    px(ctx, 8, 2, 1, 3, "#6b4c30");
    px(ctx, 9, 2, 3, 2, "#3f8f5f");
  }

  function drawBug(ctx) {
    pixelCircle(ctx, 8, 9, 5, "#4a3a56");
    pixelCircle(ctx, 8, 7, 3, "#3a2c44");
    px(ctx, 2, 8, 2, 1, "#2a1f36");
    px(ctx, 12, 8, 2, 1, "#2a1f36");
    px(ctx, 2, 11, 2, 1, "#2a1f36");
    px(ctx, 12, 11, 2, 1, "#2a1f36");
    px(ctx, 6, 3, 1, 3, "#2a1f36");
    px(ctx, 9, 3, 1, 3, "#2a1f36");
    px(ctx, 6, 7, 1, 1, "#e0455c");
    px(ctx, 9, 7, 1, 1, "#e0455c");
  }

  function drawBowl(ctx, w, h) {
    var rimH = Math.round(h * 0.4);
    px(ctx, 0, 0, w, rimH, "#e0c98a");
    px(ctx, 0, rimH, w, h - rimH, "#a3824f");
    px(ctx, w * 0.08, h * 0.5, w * 0.84, h * 0.4, "#6b4c30");
    px(ctx, w * 0.1, rimH * 0.2, w * 0.18, rimH * 0.5, "#f3e4bb");
  }

  return {
    px: px,
    pixelCircle: pixelCircle,
    noSmooth: noSmooth,
    drawCat: drawCat,
    drawTile: drawTile,
    drawMonster: drawMonster,
    drawIcon: drawIcon,
    makeIconCanvas: makeIconCanvas,
    drawFruit: drawFruit,
    drawBug: drawBug,
    drawBowl: drawBowl,
    ICONS: ["fish", "yarn", "bone", "star", "moon", "paw", "heart", "fire"],
    CAT_PALETTES: CAT_PALETTES
  };
})();
