// Fortune Bull 1000 - effect plugin: popup (see src/gx.js)
// Win popup polish, layered on top of game.js bigWin():
//   popupTier  -> title SLAM accent: converging speed lines, impact flash + shock rings, radial lines, tier sparks + coins
//   mood       -> per tier, each a step up: breathing lens streak behind the amount, sweeping soft light + searchlights (all),
//                 twin rotating ray fans (MEGA+), bokeh + embers (SUPER+), falling laurel leaves (EPIC+), gold flake storm
//                 and halo pulses (MAX); coin rain from the top of the screen, rate by tier
//   popupClose -> OUTRO (awaited, 0.8 s / 0.4 s turbo): tier burst, everything squashes into a light line, the line snaps shut
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, FX, app, MOBILE, S } = ctx;
  const P = ctx.pop;
  if (!P || !P.pop || !P.popBody) return;
  const { pop, popBody, popDark, popPlate, popCoins, popAmt, popFaders, POP_DY } = P;
  const W = ctx.W || 1080, H = ctx.H || 1920;
  const ADD = PIXI.BLEND_MODES.ADD, NORMAL = PIXI.BLEND_MODES.NORMAL;
  const ORDER = ["big", "mega", "super", "epic", "max"];
  const MK = MOBILE ? 0.5 : 1;
  // tier palette: hi = bright tint, deep = saturated base, acc = accent sparks
  const COL = {
    big: { hi: 0xb4ff8a, deep: 0x1fae4a, acc: 0xffe08a },
    mega: { hi: 0x9cc4ff, deep: 0x2a5ae0, acc: 0xffe08a },
    super: { hi: 0xffa060, deep: 0xd8361a, acc: 0xffd060 },
    epic: { hi: 0xe8b0ff, deep: 0x8a3ad8, acc: 0xffe08a },
    max: { hi: 0xfff0a0, deep: 0xffa418, acc: 0xffffff },
  };
  const TITLE_Y = 748 + POP_DY, AMT_Y = 938 + POP_DY, CX = 540;

  // ---------- code-drawn textures ----------
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return PIXI.Texture.from(c); };
  // soft horizontal streak: tapered both ends, gaussian-ish vertical falloff
  const streakTex = canvasTex(512, 64, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.3, "rgba(255,255,255,0.35)"); lg.addColorStop(0.5, "rgba(255,255,255,1)");
    lg.addColorStop(0.7, "rgba(255,255,255,0.35)"); lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "destination-in";
    const vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(0.38, "rgba(0,0,0,0.5)"); vg.addColorStop(0.5, "rgba(0,0,0,1)");
    vg.addColorStop(0.62, "rgba(0,0,0,0.5)"); vg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  });
  // speed line: bright head on the right, long fading tail
  const lineTex = canvasTex(256, 16, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, w, 0);
    lg.addColorStop(0, "rgba(255,255,255,0)"); lg.addColorStop(0.8, "rgba(255,255,255,0.9)"); lg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = lg; g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w * 0.85, 1); g.lineTo(w, h / 2); g.lineTo(w * 0.85, h - 1); g.closePath(); g.fill();
  });
  // ray fan: 14 soft wedges, faded at the centre and the rim
  const fanTex = canvasTex(512, 512, (g, w) => {
    const c = w / 2, n = 14;
    g.fillStyle = "#fff";
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, d = (Math.PI / n) * 0.42;
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, a - d, a + d); g.closePath(); g.fill();
    }
    g.globalCompositeOperation = "destination-in";
    const r = g.createRadialGradient(c, c, 0, c, c, c);
    r.addColorStop(0, "rgba(0,0,0,0)"); r.addColorStop(0.12, "rgba(0,0,0,0.6)"); r.addColorStop(0.35, "rgba(0,0,0,1)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  // laurel leaf in our gold, with a darker mid vein
  const leafTex = canvasTex(96, 40, (g, w, h) => {
    const leaf = () => { g.beginPath(); g.moveTo(4, h / 2); g.bezierCurveTo(26, 2, 62, 0, w - 4, h / 2); g.bezierCurveTo(62, h, 26, h - 2, 4, h / 2); g.closePath(); };
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, "#fff2c4"); lg.addColorStop(0.45, "#fbc460"); lg.addColorStop(1, "#a85a16");
    leaf(); g.fillStyle = lg; g.fill();
    g.lineWidth = 2; g.strokeStyle = "rgba(90,34,6,0.9)"; leaf(); g.stroke();
    g.strokeStyle = "rgba(120,52,10,0.85)"; g.lineWidth = 2; g.beginPath(); g.moveTo(8, h / 2); g.quadraticCurveTo(w / 2, h / 2 - 3, w - 8, h / 2); g.stroke();
    g.strokeStyle = "rgba(255,250,220,0.7)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(14, h / 2 - 5); g.quadraticCurveTo(w / 2, 6, w - 18, h / 2 - 4); g.stroke();
  });

  // ---------- layers ----------
  const mk = () => { const c = new PIXI.Container(); c.eventMode = "none"; return c; };
  const back = mk();                                   // behind the hero: sweeping light, fans, bokeh
  pop.addChildAt(back, pop.getChildIndex(popBody));
  const streak = mk(); streak.position.set(CX, 938);   // in the body, just behind the amount plate
  popBody.addChildAt(streak, popBody.getChildIndex(popPlate));
  const fallC = mk();                                  // coin rain + leaves: in front of the hero, behind title and plate
  popBody.addChildAt(fallC, popBody.getChildIndex(popCoins.c) + 1);
  const front = mk(); pop.addChild(front);             // slam + outro accents, over everything

  // far coins fall behind the hero, so his face stays clear
  const fallFar = mk();
  popBody.addChildAt(fallFar, P.popHero && P.popHero.parent === popBody ? popBody.getChildIndex(P.popHero) : popBody.getChildIndex(popCoins.c));
  const backP = new FX.Particles(back, ADD);
  const fallP = new FX.Particles(fallC, NORMAL), farP = new FX.Particles(fallFar, NORMAL);
  const frontP = new FX.Particles(front, ADD);
  const parts = [backP, farP, fallP, frontP];

  const spr = (tex, parent, o) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.blendMode = ADD; Object.assign(s, o || {}); parent.addChild(s); return s; };
  // sweeping soft light: two big blobs + two searchlight beams from the top
  const blobA = spr(FX.tex.glow, back), blobB = spr(FX.tex.glow, back);
  const beams = [spr(FX.tex.ray, back), spr(FX.tex.ray, back)];
  beams.forEach((b) => { b.anchor.set(0.5, 0); b.scale.set(2.6, 2.2); });
  const fans = [spr(fanTex, back), spr(fanTex, back)];
  fans.forEach((f) => f.position.set(CX, 870));
  const halo = spr(FX.tex.ring, back); halo.position.set(CX, TITLE_Y); halo.alpha = 0;
  // lens streak behind the amount
  const stGlow = spr(FX.tex.glow, streak, { tint: 0xffffff }); stGlow.scale.set(9, 0.75);
  const stWide = spr(streakTex, streak); stWide.scale.set(3.6, 1.4);
  const stCore = spr(streakTex, streak, { tint: 0xffffff }); stCore.scale.set(3.0, 0.32);
  const stStars = [spr(FX.tex.star8 || FX.tex.spark, streak), spr(FX.tex.star8 || FX.tex.spark, streak)];

  // ---------- state ----------
  const m = { sweep: 0, fan: 0, streak: 0, rain: 0, bokeh: 0, ember: 0, leaf: 0, flake: 0, halo: 0 };
  let ti = -1, tier = "big", col = COL.big, live = false, closing = false, t = 0;
  const acc = {};
  const tweens = new Set();
  const track = (tw) => { tweens.add(tw); return tw; };
  const killAll = () => { tweens.forEach((tw) => tw.kill()); tweens.clear(); };
  const temps = new Set();
  const temp = (s) => { temps.add(s); return s; };
  const dropTemp = (s) => { temps.delete(s); if (!s.destroyed) s.destroy(); };
  const dropTemps = () => { temps.forEach((s) => { if (!s.destroyed) s.destroy(); }); temps.clear(); };
  const emitN = (key, rate, dt) => { acc[key] = (acc[key] || 0) + rate * MK * dt; const n = Math.floor(acc[key]); acc[key] -= n; return n; };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function applyTint() {
    blobA.tint = col.deep; blobB.tint = col.hi; beams.forEach((b) => (b.tint = col.hi));
    fans[0].tint = col.hi; fans[1].tint = tier === "max" ? 0xffffff : col.deep;
    halo.tint = col.hi; stWide.tint = col.hi; stGlow.tint = col.deep; stStars.forEach((s) => (s.tint = col.hi));
  }
  // what each tier switches on: every tier is a step up from the one before
  function moodFor(i) {
    return {
      sweep: 0.2 + 0.05 * i, streak: 0.8 + 0.05 * i, rain: [5, 9, 13, 18, 26][i],
      fan: i >= 1 ? 0.12 + 0.035 * i : 0, bokeh: i >= 2 ? 5 + 3 * (i - 2) : 0, ember: i >= 2 ? 10 + 6 * (i - 2) : 0,
      leaf: i >= 3 ? (i === 3 ? 2.5 : 4) : 0, flake: i >= 3 ? (i === 3 ? 4 : 14) : 0, halo: i >= 4 ? 1 : 0,
    };
  }

  function reset() {
    killAll(); dropTemps(); parts.forEach((p) => p.clear());
    Object.keys(m).forEach((k) => (m[k] = 0)); Object.keys(acc).forEach((k) => (acc[k] = 0));
    back.alpha = streak.alpha = fallC.alpha = fallFar.alpha = front.alpha = 1;
    back.scale.set(1); back.pivot.set(0, 0); back.position.set(0, 0);
    popBody.scale.set(1); popBody.pivot.set(0, 0); popBody.position.set(0, POP_DY);
    ti = -1; closing = false; t = 0;
  }

  // ---------- per-frame ----------
  function tick() {
    if (!live) return;
    if (!pop.visible) { stop(); return; }
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000) * gsap.globalTimeline.timeScale();
    t += dt;
    const br = 0.5 + 0.5 * Math.sin(t * 2.6);
    // sweeping light
    blobA.position.set(CX + 430 * Math.sin(t * 0.55), 640 + 120 * Math.sin(t * 0.31)); blobA.scale.set(7.5); blobA.alpha = m.sweep * 1.2;
    blobB.position.set(CX - 400 * Math.sin(t * 0.42 + 1.3), 1380 + 140 * Math.cos(t * 0.37)); blobB.scale.set(6.2); blobB.alpha = m.sweep * 0.8;
    beams[0].position.set(160, -140); beams[0].rotation = -0.55 + 0.3 * Math.sin(t * 0.7);
    beams[1].position.set(920, -140); beams[1].rotation = 0.55 - 0.3 * Math.sin(t * 0.7 + 0.9);
    beams.forEach((b) => (b.alpha = m.sweep * 0.55));
    // twin ray fans, counter-rotating
    fans[0].rotation = t * 0.16; fans[1].rotation = -t * 0.1 + 0.2;
    fans[0].scale.set(4.6 + 0.15 * br); fans[1].scale.set(3.6);
    fans[0].alpha = m.fan; fans[1].alpha = m.fan * 0.75;
    // breathing lens streak
    stGlow.alpha = 0.32 * m.streak * (0.7 + 0.3 * br);
    stWide.alpha = 0.55 * m.streak * (0.75 + 0.25 * br); stWide.scale.set(3.4 + 0.35 * br, 1.2 + 0.35 * br);
    stCore.alpha = 0.9 * m.streak * (0.8 + 0.2 * br); stCore.scale.set(2.8 + 0.3 * br, 0.28 + 0.06 * br);
    const sx = Math.max(300, (popPlate.width || 700) / 2 + 30);
    stStars.forEach((s, k) => { s.position.set(k ? sx : -sx, 0); s.rotation = t * (k ? 1.2 : -1.2); s.scale.set(0.42 + 0.18 * br); s.alpha = m.streak * 0.9; });
    // MAX: halo ring breathing behind the title
    halo.alpha = m.halo * (0.25 + 0.2 * br); halo.scale.set(5.2 + 0.5 * br);
    if (!closing) emitMood(dt);
    parts.forEach((p) => p.update(dt));
  }

  function emitMood(dt) {
    // coin rain from the top of the screen (body coords: the body sits POP_DY lower)
    let n = emitN("rain", m.rain, dt);
    for (let i = 0; i < n; i++) {
      const d = Math.random(), sc = 0.32 + 0.38 * d;     // depth: far coins are smaller, slower, dimmer
      (d < 0.65 ? farP : fallP).emit({ frames: FX.tex.coinFrames, fps: 14 + Math.random() * 16, x: rnd(30, W - 30), y: -POP_DY - 80, vx: rnd(-60, 60), vy: 380 + 520 * d, ay: 700 + 500 * d,
        s0: sc, s1: sc, a0: 0.75 + 0.25 * d, a1: 0.75 + 0.25 * d, life: 2.6, vr: rnd(-1.5, 1.5), blend: NORMAL });
    }
    n = emitN("leaf", m.leaf, dt);
    for (let i = 0; i < n; i++) {
      fallP.emit({ tex: leafTex, x: rnd(20, W - 20), y: -POP_DY - 40, vx: rnd(-90, 90), vy: rnd(120, 220), ay: 40, drag: 0.2, s0: rnd(0.6, 0.95), s1: 0.7,
        a0: 1, a1: 0.85, life: 5, rot: rnd(0, 6.28), vr: rnd(-2.2, 2.2), flip: rnd(3, 6), blend: NORMAL });
    }
    n = emitN("flake", m.flake, dt);
    for (let i = 0; i < n; i++) {
      fallP.emit({ tex: FX.tex.flake, x: rnd(0, W), y: -POP_DY - 30, vx: rnd(-50, 50), vy: rnd(160, 340), ay: 60, s0: rnd(0.45, 0.85), s1: 0.5,
        a0: 1, a1: 0.7, life: 4.5, vr: rnd(-5, 5), flip: rnd(6, 12), tint: Math.random() < 0.3 ? 0xffffff : 0xffe7a0, blend: NORMAL });
    }
    n = emitN("bokeh", m.bokeh, dt);
    for (let i = 0; i < n; i++) {
      const tc = Math.random() < 0.6 ? col.hi : col.acc;
      backP.emit({ tex: FX.tex.glow, x: rnd(0, W), y: rnd(900, 1900), vx: rnd(-25, 25), vy: rnd(-90, -35), s0: rnd(0.25, 0.6), s1: rnd(0.3, 0.7),
        a0: 0.55, a1: 0, fadeIn: 0.8, life: rnd(3.5, 5.5), twinkle: rnd(1, 2.5), tint: tc });
    }
    n = emitN("ember", m.ember, dt);
    for (let i = 0; i < n; i++) {
      backP.emit({ tex: FX.tex.dot, x: rnd(40, W - 40), y: rnd(1500, 2000), vx: rnd(-60, 60), vy: rnd(-420, -220), ax: rnd(-60, 60), s0: rnd(0.14, 0.3), s1: 0,
        a0: 1, a1: 0.2, life: rnd(1.6, 2.6), stretch: 900, tint: Math.random() < 0.5 ? col.acc : col.hi });
    }
    // MAX: halo pulses leave the title
    if (m.halo > 0.5 && emitN("halo", 1.4, dt)) frontP.emit({ tex: FX.tex.ring, x: CX, y: TITLE_Y, s0: 1.5, s1: 8, life: 1.1, a0: 0.45, a1: 0, tint: col.hi });
  }

  // ---------- title slam ----------
  function slam(tName, first) {
    const i = Math.max(0, ORDER.indexOf(tName)), c = COL[tName] || COL.big, k = 1 + 0.3 * i;
    // the game's title tween lands after 0.16 s (first) or 0.26 s (tier-up): hit on the landing
    const land = first ? 0.14 : 0.23;
    // anticipation: speed lines rush in from the screen edges towards the title
    const nIn = Math.round((22 + 8 * i) * MK);
    for (let j = 0; j < nIn; j++) {
      const a = rnd(0, 6.28), R = rnd(760, 1000), r = 170, v = (R - r) / land;
      frontP.emit({ tex: lineTex, x: CX + Math.cos(a) * R, y: TITLE_Y + Math.sin(a) * R * 0.9, vx: -Math.cos(a) * v, vy: -Math.sin(a) * v * 0.9,
        s0: rnd(0.5, 0.9), s1: 0.4, a0: 0.1, a1: 0.9, life: land, stretch: 2600, tint: Math.random() < 0.5 ? 0xffffff : c.hi });
    }
    track(gsap.delayedCall(land, () => impact(tName, i, c, k)));
  }

  function impact(tName, i, c, k) {
    col = c; tier = tName; applyTint();
    // screen flash in the tier colour + white core
    const fl = temp(new PIXI.Graphics().beginFill(0xffffff).drawRect(-200, -200, W + 400, H + 400).endFill());
    fl.blendMode = ADD; fl.tint = c.hi; fl.alpha = Math.min(0.4, 0.18 + 0.05 * i); front.addChildAt(fl, 0);
    track(gsap.to(fl, { alpha: 0, duration: 0.28, ease: "power2.out", onComplete: () => dropTemp(fl) }));
    const core = temp(spr(FX.tex.glow, front, { tint: 0xffffff })); core.position.set(CX, TITLE_Y);
    track(gsap.fromTo(core.scale, { x: 1.5, y: 0.8 }, { x: 5.5 * k, y: 1.8 * k, duration: 0.26, ease: "power3.out" }));
    track(gsap.fromTo(core, { alpha: 0.75 }, { alpha: 0, duration: 0.26, ease: "power2.out", onComplete: () => dropTemp(core) }));
    // shock rings: tier colour, then a thinner white one; higher tiers get a third
    const rings = i >= 3 ? 3 : 2;
    for (let r = 0; r < rings; r++) {
      const g = temp(spr(FX.tex.ring, front, { tint: r === 1 ? 0xffffff : c.hi })); g.position.set(CX, TITLE_Y); g.alpha = 0;
      const s1 = (6 + 2 * i) * (1 - 0.18 * r);
      track(gsap.fromTo(g.scale, { x: 0.6, y: 0.5 }, { x: s1, y: s1 * 0.8, duration: 0.55 + 0.1 * r, delay: 0.05 * r, ease: "expo.out" }));
      track(gsap.fromTo(g, { alpha: 0.95 }, { alpha: 0, duration: 0.55 + 0.1 * r, delay: 0.05 * r, ease: "power1.in", onComplete: () => dropTemp(g) }));
    }
    // radial speed lines out of the impact
    const nOut = Math.round((28 + 10 * i) * MK);
    for (let j = 0; j < nOut; j++) {
      const a = (j / nOut) * 6.28 + rnd(-0.08, 0.08), v = rnd(1800, 3000) * (0.9 + 0.1 * k);
      frontP.emit({ tex: lineTex, x: CX + Math.cos(a) * 160, y: TITLE_Y + Math.sin(a) * 110, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.85, drag: 4.5,
        s0: rnd(0.6, 1.1), s1: 0.2, a0: 1, a1: 0, life: rnd(0.3, 0.45), stretch: 1500, tint: Math.random() < 0.4 ? 0xffffff : c.hi });
    }
    // sparks + a coin burst in the tier colour
    const nSp = Math.round((26 + 12 * i) * MK);
    for (let j = 0; j < nSp; j++) {
      const a = rnd(0, 6.28), v = rnd(500, 1300);
      frontP.emit({ tex: Math.random() < 0.5 ? FX.tex.spark : FX.tex.dot, x: CX, y: TITLE_Y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3, ay: 500,
        s0: rnd(0.3, 0.6), s1: 0, life: rnd(0.6, 1.0), vr: 4, tint: Math.random() < 0.35 ? c.acc : c.hi });
    }
    const nCoin = Math.round((8 + 5 * i) * MK);
    for (let j = 0; j < nCoin; j++) {
      const a = rnd(-Math.PI, 0), v = rnd(700, 1400);
      fallP.emit({ frames: FX.tex.coinFrames, fps: rnd(18, 32), x: CX + rnd(-80, 80), y: 748 + rnd(-30, 30), vx: Math.cos(a) * v, vy: Math.sin(a) * v - 300, ay: 2400,
        s0: rnd(0.45, 0.75), s1: 0.55, a0: 1, a1: 1, life: 1.6, vr: rnd(-3, 3), blend: NORMAL });
    }
    if (ctx.shake) ctx.shake(4 + 3 * i, 0.22);
    // the mood steps up to this tier
    track(gsap.to(m, Object.assign({ duration: 0.5, ease: "power2.out" }, moodFor(i))));
  }

  // ---------- outro: burst, collapse into a light line, snap shut ----------
  function outro(d) {
    if (!live) return Promise.resolve();
    closing = true; killAll();
    const tName = (d && d.tier) || tier, i = Math.max(0, ORDER.indexOf(tName)), c = COL[tName] || col, k = 1 + 0.25 * i;
    const D = S && S.turbo ? 0.4 : 0.8, q = D / 0.8;
    const LY = 1040;                                   // the line, in screen (pop) coords: between title and amount
    const amtS = popAmt.scale.x;
    return new Promise((res) => {
      const tl = track(gsap.timeline({ onComplete: () => { end(amtS); res(); } }));
      // 1) burst in the tier colour
      tl.call(() => {
        const fl = temp(new PIXI.Graphics().beginFill(0xffffff).drawRect(-200, -200, W + 400, H + 400).endFill());
        fl.blendMode = ADD; fl.tint = c.hi; fl.alpha = 0.22 + 0.03 * i; front.addChildAt(fl, 0);
        gsap.to(fl, { alpha: 0, duration: 0.3 * q, ease: "power2.out", onComplete: () => dropTemp(fl) });
        const g = temp(spr(FX.tex.glow, front, { tint: c.hi })); g.position.set(CX, LY); g.alpha = 0.7;
        gsap.fromTo(g.scale, { x: 2, y: 1.5 }, { x: 9 * k, y: 4 * k, duration: 0.3 * q, ease: "power3.out" });
        gsap.to(g, { alpha: 0, duration: 0.3 * q, ease: "power1.in", onComplete: () => dropTemp(g) });
        const r = temp(spr(FX.tex.ring, front, { tint: 0xffffff })); r.position.set(CX, LY);
        gsap.fromTo(r.scale, { x: 1, y: 1 }, { x: 9 * k, y: 7 * k, duration: 0.35 * q, ease: "expo.out" });
        gsap.to(r, { alpha: 0, duration: 0.35 * q, onComplete: () => dropTemp(r) });
        const n = Math.round((40 + 14 * i) * MK);
        for (let j = 0; j < n; j++) {
          const a = rnd(0, 6.28), v = rnd(700, 1800);
          frontP.emit({ tex: Math.random() < 0.5 ? FX.tex.spark : lineTex, x: CX, y: LY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3.5,
            s0: rnd(0.35, 0.7), s1: 0, life: rnd(0.4, 0.7), stretch: 1600, tint: Math.random() < 0.4 ? 0xffffff : c.hi });
        }
        if (ctx.shake) ctx.shake(6 + 2 * i, 0.2 * q);
      });
      tl.to(popBody.scale, { x: 1.05, y: 1.05, duration: 0.14 * q, ease: "back.out(3)" }, 0);
      // 2) everything squashes into a line (popup body and our background layer, pivoting on the line)
      tl.call(() => {
        popBody.pivot.set(CX, LY - POP_DY); popBody.position.set(CX, LY);
        back.pivot.set(CX, LY); back.position.set(CX, LY);
      }, null, 0.16 * q);
      const sq = { duration: 0.44 * q, ease: "power2.in" };
      tl.to(popBody.scale, Object.assign({ x: 1.18, y: 0.012 }, sq), 0.16 * q);
      tl.to(back.scale, Object.assign({ x: 1.25, y: 0.012 }, sq), 0.16 * q);
      tl.to([popDark], { alpha: 0.3, duration: 0.5 * q, ease: "power1.in" }, 0.18 * q);
      if (P.popRays) tl.to(P.popRays, { alpha: 0, duration: 0.3 * q }, 0.18 * q);
      // the light line grows as the popup flattens into it
      const line = temp(new PIXI.Container()); line.position.set(CX, LY); front.addChild(line);
      const lGlow = spr(FX.tex.glow, line, { tint: c.hi }), lCol = spr(streakTex, line, { tint: c.hi }), lCore = spr(streakTex, line, { tint: 0xffffff });
      lGlow.scale.set(10, 0.9); lCol.scale.set(3.4, 1.6); lCore.scale.set(3.0, 0.4);
      line.alpha = 0; line.scale.set(0.4, 1);
      tl.to(line, { alpha: 1, duration: 0.3 * q, ease: "power2.in" }, 0.3 * q);
      tl.to(line.scale, { x: 1.25, duration: 0.32 * q, ease: "power2.out" }, 0.28 * q);
      // 3) snap shut: the line pinches to a point that flashes out
      tl.to(line.scale, { x: 0, y: 0.5, duration: 0.17 * q, ease: "power4.in" }, 0.6 * q);
      const star = temp(spr(FX.tex.star8 || FX.tex.spark, front, { tint: 0xffffff })); star.position.set(CX, LY); star.scale.set(0);
      tl.to(star.scale, { x: 1.3, y: 1.3, duration: 0.1 * q, ease: "power2.out" }, 0.66 * q);
      tl.to(star, { rotation: 1.2, duration: 0.14 * q }, 0.66 * q);
      tl.to(star, { alpha: 0, duration: 0.08 * q }, 0.72 * q);
      tl.to([fallC, fallFar], { alpha: 0, duration: 0.2 * q }, 0.45 * q);
    });
  }

  // after the snap: our layers off, the body restored, the game's faders already at 0 for its own fade
  function end(amtS) {
    killAll(); dropTemps(); parts.forEach((p) => p.clear());
    Object.keys(m).forEach((k) => (m[k] = 0));
    back.alpha = streak.alpha = fallC.alpha = fallFar.alpha = 0;
    popBody.scale.set(1); popBody.pivot.set(0, 0); popBody.position.set(0, POP_DY);
    back.scale.set(1); back.pivot.set(0, 0); back.position.set(0, 0);
    popFaders.forEach((o) => { if (o) o.alpha = 0; });
    // the amount reappears out of the pinch point, smaller, and the game flies it to the win bar
    if (popAmt && amtS) popAmt.scale.set(amtS * 0.6);
  }

  function stop() {
    live = false; app.ticker.remove(tick);
    killAll(); dropTemps(); parts.forEach((p) => p.clear());
  }

  GX.on("popupOpen", () => {
    if (live) app.ticker.remove(tick);
    reset(); live = true; app.ticker.add(tick);
  });
  GX.on("popupTier", (d) => {
    if (!live || closing || !d) return;
    const i = ORDER.indexOf(d.tier);
    if (i < 0) return;
    ti = i;
    slam(d.tier, !!d.first);
  });
  GX.on("popupClose", (d) => outro(d));
});
