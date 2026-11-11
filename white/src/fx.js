// Fortune Bull 1000 - code effects: generated textures, particles, text styles, helpers.
(function () {
  const FX = { tex: {} };

  function canvasTex(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    return PIXI.Texture.from(c);
  }

  FX.init = function () {
    const T = FX.tex;
    T.glow = canvasTex(256, 256, (g, w) => {
      const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.25, "rgba(255,255,255,0.55)");
      r.addColorStop(0.6, "rgba(255,255,255,0.12)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    });
    T.dot = canvasTex(64, 64, (g, w) => {
      const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.35, "rgba(255,255,255,0.7)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    });
    T.spark = canvasTex(128, 128, (g, w) => {
      const c = w / 2;
      const r = g.createRadialGradient(c, c, 0, c, c, c * 0.5);
      r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, w);
      g.fillStyle = "white";
      for (const [lx, ly] of [[c, 3], [3, c]]) {
        g.beginPath();
        if (lx === c) { g.moveTo(c, 0); g.lineTo(c + 4, c); g.lineTo(c, w); g.lineTo(c - 4, c); }
        else { g.moveTo(0, c); g.lineTo(c, c - 4); g.lineTo(w, c); g.lineTo(c, c + 4); }
        g.closePath(); g.fill();
      }
    });
    T.ray = canvasTex(128, 1024, (g, w, h) => {
      const lg = g.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.5, "rgba(255,255,255,1)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = "destination-in";
      const vg = g.createLinearGradient(0, 0, 0, h);
      vg.addColorStop(0, "rgba(0,0,0,1)"); vg.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = vg; g.fillRect(0, 0, w, h);
    });
    T.shine = canvasTex(256, 32, (g, w, h) => {
      const lg = g.createLinearGradient(0, 0, w, 0);
      lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.45, "rgba(255,255,255,0.85)");
      lg.addColorStop(0.5, "rgba(255,255,255,1)"); lg.addColorStop(0.55, "rgba(255,255,255,0.85)"); lg.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
    });
    T.ring = canvasTex(256, 256, (g, w) => {
      const c = w / 2;
      const r = g.createRadialGradient(c, c, c * 0.55, c, c, c);
      r.addColorStop(0, "rgba(255,255,255,0)"); r.addColorStop(0.7, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, w);
    });
    T.flame = canvasTex(64, 128, (g, w, h) => {
      const r = g.createRadialGradient(32, 92, 2, 32, 80, 60);
      r.addColorStop(0, "rgba(255,250,210,1)"); r.addColorStop(0.3, "rgba(255,190,60,0.9)");
      r.addColorStop(0.65, "rgba(255,90,10,0.45)"); r.addColorStop(1, "rgba(255,40,0,0)");
      g.fillStyle = r;
      g.beginPath(); g.moveTo(32, 0); g.quadraticCurveTo(64, 80, 32, 128); g.quadraticCurveTo(0, 80, 32, 0); g.fill();
    });
    T.coin = canvasTex(160, 160, (g, w) => {
      const c = w / 2;
      const body = g.createLinearGradient(0, 0, w, w);
      body.addColorStop(0, "#fff5c8"); body.addColorStop(0.35, "#ffc94a"); body.addColorStop(0.7, "#d68512"); body.addColorStop(1, "#8a4a06");
      g.fillStyle = "#6b3504"; g.beginPath(); g.arc(c, c, c - 2, 0, Math.PI * 2); g.fill();
      g.fillStyle = body; g.beginPath(); g.arc(c, c, c - 8, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(120,60,5,0.9)"; g.lineWidth = 5; g.beginPath(); g.arc(c, c, c - 22, 0, Math.PI * 2); g.stroke();
      const star = (r0, r1, fill) => { g.fillStyle = fill; g.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? r1 : r0; g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r); }
        g.closePath(); g.fill(); };
      star(40, 17, "rgba(120,60,5,0.85)"); star(35, 14, "rgba(255,240,190,0.95)");
      g.fillStyle = "rgba(255,255,255,0.5)"; g.beginPath(); g.ellipse(c - 25, c - 30, 28, 14, -0.6, 0, Math.PI * 2); g.fill();
    });
    T.burst = canvasTex(1024, 1024, (g, w) => {
      const c = w / 2, n = 24;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2 / n) * 0.5;
        const gr = g.createRadialGradient(c, c, 0, c, c, c);
        gr.addColorStop(0, "rgba(255,240,190,0.9)"); gr.addColorStop(0.5, "rgba(255,200,90,0.35)"); gr.addColorStop(1, "rgba(255,170,40,0)");
        g.fillStyle = gr;
        g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a0, a1); g.closePath(); g.fill();
      }
    });
    T.white = PIXI.Texture.WHITE;
    // 3D coin turning on its vertical axis: 16 frames (edge thickness, embossed star front, ringed back, moving specular)
    T.coinFrames = [];
    for (let i = 0; i < 16; i++) {
      const th = (i / 16) * Math.PI * 2, cw = Math.cos(th), sw = Math.sin(th);
      T.coinFrames.push(canvasTex(128, 128, (g, w) => {
        const c = w / 2, R = 56, rx = Math.max(3, Math.abs(cw) * R), edge = 9 * Math.abs(sw);
        // edge band (thickness)
        const eg = g.createLinearGradient(c - R, 0, c + R, 0);
        eg.addColorStop(0, "#6b3a05"); eg.addColorStop(0.5, "#c8860f"); eg.addColorStop(1, "#5a2e03");
        g.fillStyle = eg;
        g.beginPath(); g.ellipse(c + edge * Math.sign(sw || 1) * 0.5, c, rx, R, 0, 0, Math.PI * 2); g.fill();
        g.fillRect(c - edge * 0.5 + (sw > 0 ? 0 : -edge * 0), c - R, edge, R * 2);
        // face
        const fg = g.createLinearGradient(c - rx, c - R, c + rx, c + R);
        const front = cw >= 0;
        fg.addColorStop(0, front ? "#fff6cc" : "#ffe9a0"); fg.addColorStop(0.35, front ? "#ffcf4a" : "#f2b437");
        fg.addColorStop(0.75, front ? "#d98a10" : "#c07a0d"); fg.addColorStop(1, "#8a4a06");
        g.fillStyle = fg;
        g.beginPath(); g.ellipse(c - edge * Math.sign(sw || 1) * 0.5, c, rx, R, 0, 0, Math.PI * 2); g.fill();
        g.save(); g.translate(c - edge * Math.sign(sw || 1) * 0.5, c); g.scale(Math.max(0.05, Math.abs(cw)), 1);
        g.strokeStyle = "rgba(110,55,4,0.85)"; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, R - 12, 0, Math.PI * 2); g.stroke();
        if (front) {
          const star = (r0, r1, fill) => { g.fillStyle = fill; g.beginPath();
            for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? r1 : r0; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
            g.closePath(); g.fill(); };
          star(30, 13, "rgba(120,60,5,0.85)"); star(26, 11, "rgba(255,240,190,0.95)");
        } else {
          g.strokeStyle = "rgba(255,236,170,0.8)"; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, R - 26, 0, Math.PI * 2); g.stroke();
        }
        g.restore();
        // specular sweep follows the turn
        const hx = c - rx * 0.4 * cw - 6;
        const sg = g.createRadialGradient(hx, c - R * 0.45, 2, hx, c - R * 0.45, R * 0.6);
        sg.addColorStop(0, "rgba(255,255,255,0.85)"); sg.addColorStop(1, "rgba(255,255,255,0)");
        g.globalCompositeOperation = "source-atop"; g.fillStyle = sg; g.fillRect(0, 0, w, w); g.globalCompositeOperation = "source-over";
      }));
    }
    // faceted gems: ruby, sapphire, emerald, amethyst
    const gem = (dark, mid, light) => canvasTex(96, 96, (g, w) => {
      const c = w / 2, R = 40, pts = [];
      for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 4; pts.push([c + Math.cos(a) * R * (k % 2 ? 0.92 : 1), c + Math.sin(a) * R * (k % 2 ? 0.92 : 1)]); }
      const gr = g.createLinearGradient(c - R, c - R, c + R, c + R); gr.addColorStop(0, light); gr.addColorStop(0.45, mid); gr.addColorStop(1, dark);
      g.fillStyle = gr; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
      // table + facets
      g.strokeStyle = "rgba(255,255,255,0.45)"; g.lineWidth = 2;
      const r2 = R * 0.48;
      g.beginPath(); for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 4; const x = c + Math.cos(a) * r2, y = c + Math.sin(a) * r2; k ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke();
      for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + k * Math.PI / 4; g.beginPath(); g.moveTo(c + Math.cos(a) * r2, c + Math.sin(a) * r2); g.lineTo(pts[k][0], pts[k][1]); g.stroke(); }
      g.fillStyle = "rgba(255,255,255,0.7)"; g.beginPath(); g.ellipse(c - 12, c - 15, 11, 6, -0.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.95)"; g.beginPath(); g.arc(c + 14, c - 20, 3, 0, Math.PI * 2); g.fill();
      g.strokeStyle = "rgba(255,230,160,0.9)"; g.lineWidth = 3; g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.stroke();
    });
    T.gems = [gem("#5a0010", "#d4122f", "#ff8a9a"), gem("#061a5a", "#1e5ae0", "#9ac2ff"), gem("#04401c", "#11a650", "#8cf0b4"), gem("#2c0a50", "#8a2ee0", "#d6a6ff")];
    // gold leaf flake
    T.flake = canvasTex(48, 48, (g) => {
      const gr = g.createLinearGradient(8, 8, 40, 40); gr.addColorStop(0, "#fff3c0"); gr.addColorStop(0.5, "#f5c040"); gr.addColorStop(1, "#b0700a");
      g.fillStyle = gr; g.beginPath(); g.moveTo(10, 14); g.lineTo(30, 6); g.lineTo(42, 22); g.lineTo(34, 40); g.lineTo(14, 38); g.lineTo(6, 26); g.closePath(); g.fill();
    });
    // 8-point light star
    T.star8 = canvasTex(256, 256, (g, w) => {
      const c = w / 2;
      const r = g.createRadialGradient(c, c, 0, c, c, c * 0.35); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = r; g.fillRect(0, 0, w, w);
      for (let k = 0; k < 8; k++) {
        const a = k * Math.PI / 4, L = k % 2 ? c * 0.55 : c * 0.98, wd = k % 2 ? 5 : 8;
        g.save(); g.translate(c, c); g.rotate(a);
        const lg = g.createLinearGradient(0, 0, L, 0); lg.addColorStop(0, "rgba(255,255,255,1)"); lg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = lg; g.beginPath(); g.moveTo(0, -wd); g.lineTo(L, 0); g.lineTo(0, wd); g.closePath(); g.fill(); g.restore();
      }
    });
    // screen vignette (transparent centre -> black edges)
    T.vignette = canvasTex(512, 910, (g, w, h) => {
      const r = g.createRadialGradient(w / 2, h * 0.45, h * 0.18, w / 2, h * 0.45, h * 0.62);
      r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(1, "rgba(0,0,0,1)");
      g.fillStyle = r; g.fillRect(0, 0, w, h);
    });
  };

  // ---------- hand-painted VFX kit (assets/vfx, made by vfx_src/cut.py) replaces the code textures ----------
  FX.ART = ["glow", "dot", "spark", "star8", "ring", "shine", "ray", "burst", "smoke", "fire_sheet", "magic_sheet",
    "impact_sheet", "fire_strip", "lightning", "coin_sheet", "gems"];
  FX.useArt = function (get) {
    const T = FX.tex;
    const cells = (tex, cols, rows, crop) => {
      const out = [], w = tex.width / cols, h = tex.height / rows;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const f = crop ? crop(c * w, r * h, w, h) : new PIXI.Rectangle(c * w, r * h, w, h);
        out.push(new PIXI.Texture(tex.baseTexture, f));
      }
      return out;
    };
    for (const n of ["glow", "dot", "spark", "star8", "ring", "shine", "ray", "burst", "smoke"]) { const t = get(n); if (t) T[n] = t; }
    const fire = get("fire_sheet");
    if (fire) {        // 128 cells; the flame sits in the middle 64x128, the size of the old code flame
      T.fireFrames = cells(fire, 4, 4, (x, y, w, h) => new PIXI.Rectangle(x + w / 4, y, w / 2, h));
      T.flame = T.fireFrames[5];
    }
    const magic = get("magic_sheet"); if (magic) T.magicFrames = cells(magic, 4, 4);
    const imp = get("impact_sheet"); if (imp) T.impactFrames = cells(imp, 4, 4);
    const coin = get("coin_sheet"); if (coin) T.coinFrames = cells(coin, 4, 4);
    const gems = get("gems"); if (gems) T.gems = cells(gems, 4, 1);
    const bolt = get("lightning"); if (bolt) T.bolts = cells(bolt, 3, 1);
    const strip = get("fire_strip"); if (strip) T.fireStrip = strip;
    FX.painted = !!fire;
  };

  // ---------- particles ----------
  class Particles {
    constructor(parent, blend) {
      this.c = new PIXI.Container();
      parent.addChild(this.c);
      this.blend = blend === undefined ? PIXI.BLEND_MODES.ADD : blend;
      this.list = [];
      this.pool = [];
    }
    emit(o) {
      const s = this.pool.pop() || new PIXI.Sprite();
      s.texture = o.tex || FX.tex.dot;
      s.anchor.set(0.5);
      s.blendMode = o.blend !== undefined ? o.blend : this.blend;
      s.tint = o.tint === undefined ? 0xffffff : o.tint;
      s.x = o.x; s.y = o.y; s.rotation = o.rot || 0;
      s.visible = true;
      this.c.addChild(s);
      this.list.push({ s, vx: o.vx || 0, vy: o.vy || 0, ax: o.ax || 0, ay: o.ay || 0, drag: o.drag || 0,
        life: 0, max: o.life || 1, s0: o.s0 === undefined ? 1 : o.s0, s1: o.s1 === undefined ? 0 : o.s1,
        a0: o.a0 === undefined ? 1 : o.a0, a1: o.a1 === undefined ? 0 : o.a1, vr: o.vr || 0, coin: !!o.coin,
        phase: Math.random() * 6.28, fade: o.fadeIn || 0, ground: o.ground,
        frames: o.frames || null, fps: o.fps || 24, f0: Math.floor(Math.random() * 64), ft: 0,
        stretch: o.stretch || 0, twinkle: o.twinkle || 0, flip: o.flip || 0 });
      if (o.frames) s.texture = o.frames[0];
      return s;
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.life += dt;
        const t = p.life / p.max;
        if (t >= 1) { p.s.visible = false; this.c.removeChild(p.s); this.pool.push(p.s); this.list.splice(i, 1); continue; }
        p.vx += p.ax * dt; p.vy += p.ay * dt;
        if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
        p.s.x += p.vx * dt; p.s.y += p.vy * dt;
        p.s.rotation += p.vr * dt;
        const sc = p.s0 + (p.s1 - p.s0) * t;
        p.phase += dt;
        if (p.frames) { p.ft += dt * p.fps; p.s.texture = p.frames[(p.f0 + Math.floor(p.ft)) % p.frames.length]; }
        if (p.stretch) {
          const sp = Math.hypot(p.vx, p.vy);
          p.s.rotation = Math.atan2(p.vy, p.vx);
          p.s.scale.set(sc * (1 + sp / p.stretch), sc * 0.55);
        } else if (p.coin) p.s.scale.set(sc * Math.cos(p.phase * 9), sc);
        else if (p.flip) p.s.scale.set(sc, sc * Math.cos(p.phase * p.flip));
        else p.s.scale.set(sc);
        let a = p.a0 + (p.a1 - p.a0) * t;
        if (p.twinkle) a *= 0.5 + 0.5 * Math.sin(p.phase * p.twinkle);
        if (p.fade && p.life < p.fade) a *= p.life / p.fade;
        p.s.alpha = a;
      }
    }
    clear() { this.list.forEach((p) => { p.s.visible = false; this.c.removeChild(p.s); this.pool.push(p.s); }); this.list = []; }
  }
  FX.Particles = Particles;

  // ---------- text ----------
  FX.GOLD = ["#FFF2C4", "#FBC460", "#CE7422"];
  FX.gold = function (size, extra) {
    return new PIXI.TextStyle(Object.assign({
      fontFamily: "PoppinsB", fontSize: size, fontWeight: "700",
      fill: FX.GOLD, fillGradientStops: [0, 0.5, 1],
      stroke: "#4A200A", strokeThickness: Math.max(2, Math.round(size / 16)) * 2,
      dropShadow: true, dropShadowColor: "#1e080a", dropShadowAlpha: 0.6, dropShadowBlur: 3,
      dropShadowAngle: Math.PI / 2, dropShadowDistance: 2, lineJoin: "round", padding: 8,
    }, extra || {}));
  };
  FX.plain = function (size, color, extra) {
    return new PIXI.TextStyle(Object.assign({ fontFamily: "PoppinsB", fontSize: size, fontWeight: "700", fill: color || "#ffffff",
      dropShadow: true, dropShadowColor: "#000", dropShadowAlpha: 0.55, dropShadowBlur: 3, dropShadowDistance: 2,
      dropShadowAngle: Math.PI / 2, padding: 6 }, extra || {}));
  };
  FX.TIER_FILL = {
    big: ["#FFF6D0", "#FFC94A", "#D07A10"],
    mega: ["#FFE9E0", "#FF7A5C", "#B0102A"],
    super: ["#F6E8FF", "#C68BFF", "#6A1FC0"],
    epic: ["#E8FFF1", "#5DEB9C", "#0F7A48"],
    max: ["#FFFFFF", "#FFE070", "#FF8A00"],
  };

  // ---------- helpers ----------
  FX.tween = (target, vars) => new Promise((res) => gsap.to(target, Object.assign({}, vars, { onComplete: res })));
  FX.wait = (s) => new Promise((res) => gsap.delayedCall(s, res));
  FX.money = (v, dec) => {
    const d = dec === undefined ? 2 : dec;
    return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: 2 });
  };
  FX.bezier = (p0, p1, p2, t) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
  });

  window.FX = FX;
})();
