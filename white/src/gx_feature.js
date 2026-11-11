// Fortune Bull 1000 - effect plugin: feature (see src/gx.js)
//   feature {on:true}  -> intro cutscene (dark beat, gold light cones behind the bull, laurel + flame column, beats at
//                          0.8 s and 1.4 s, clear by 2.5 s; turbo about 0.7 s) and the feature mood (storm sky, rising
//                          embers, ember glow on the bull, gold glints on the frame) until feature {on:false}
//   clashStart / clashBurst -> code crouch of the bull, then a chest burst with an upward aura and lightning to the column
//   tease {reel}        -> one lightning strike down the reel with a flash on its cells
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, FX, layers, W, H, MOBILE, S } = ctx;
  const ADD = PIXI.BLEND_MODES.ADD, NORMAL = PIXI.BLEND_MODES.NORMAL;
  const M = MOBILE ? 0.5 : 1;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const safe = (fn) => { try { fn(); } catch (e) { console.warn("gx feature", e); } };
  const sfx = (n, a) => safe(() => { if (ctx.SFX && ctx.SFX[n]) ctx.SFX[n](a); });
  const BOARD = [10, 594, 1070, 1288];
  const kill = (o) => { if (!o || o.destroyed) return; gsap.killTweensOf(o); if (o.scale) gsap.killTweensOf(o.scale); o.destroy({ children: true }); };

  // ---------- code-drawn textures ----------
  const canvasTex = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); return PIXI.Texture.from(c); };
  // a laurel leaf: pointed blade, gold gradient across, dark midrib and a bright edge
  const leafTex = canvasTex(48, 104, (g, w, h) => {
    g.beginPath(); g.moveTo(24, 3); g.quadraticCurveTo(47, 44, 24, 96); g.quadraticCurveTo(1, 44, 24, 3); g.closePath();
    const lg = g.createLinearGradient(4, 0, 44, 0);
    lg.addColorStop(0, "#fff6c8"); lg.addColorStop(0.42, "#f6c548"); lg.addColorStop(0.75, "#c9821c"); lg.addColorStop(1, "#7a420a");
    g.fillStyle = lg; g.fill();
    g.lineWidth = 2; g.strokeStyle = "rgba(255,244,190,0.9)"; g.stroke();
    g.beginPath(); g.moveTo(24, 10); g.quadraticCurveTo(26, 52, 24, 92); g.lineWidth = 2.2; g.strokeStyle = "rgba(110,52,6,0.85)"; g.stroke();
    for (let k = 0; k < 5; k++) {
      const y = 24 + k * 13;
      g.beginPath(); g.moveTo(25, y); g.lineTo(36 - k, y - 8); g.moveTo(24, y + 3); g.lineTo(13 + k, y - 5);
      g.lineWidth = 1; g.strokeStyle = "rgba(120,60,8,0.45)"; g.stroke();
    }
    g.fillRect(23, 94, 2, 9);
  });
  // a light cone: apex at the bottom centre, soft sides, fading out along its length
  const coneTex = canvasTex(128, 512, (g, w, h) => {
    g.beginPath(); g.moveTo(w / 2 - 2, h); g.lineTo(2, 0); g.lineTo(w - 2, 0); g.lineTo(w / 2 + 2, h); g.closePath();
    const hg = g.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, "rgba(255,255,255,0)"); hg.addColorStop(0.5, "rgba(255,255,255,1)"); hg.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = hg; g.fill();
    g.globalCompositeOperation = "destination-in";
    const vg = g.createLinearGradient(0, h, 0, 0);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(0.08, "rgba(0,0,0,1)"); vg.addColorStop(0.55, "rgba(0,0,0,0.55)"); vg.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  });
  // stormy sky: deep crimson-violet at the top of the hall, fading to clear by the board
  const skyTex = canvasTex(64, 512, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, "rgba(16,4,18,0.92)"); lg.addColorStop(0.35, "rgba(40,6,16,0.6)"); lg.addColorStop(0.7, "rgba(60,10,8,0.22)"); lg.addColorStop(1, "rgba(60,10,8,0)");
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
  });

  // ---------- particle systems (own, ticked on the game clock) ----------
  const leafP = new FX.Particles(layers.fxTop, NORMAL);
  const hotP = new FX.Particles(layers.fxTop, ADD);
  const moodP = new FX.Particles(layers.ambFront, ADD);
  const skyFx = new PIXI.Container(); layers.bgL.addChild(skyFx); skyFx.visible = false; skyFx.alpha = 0;
  const skyBand = new PIXI.Sprite(skyTex); skyBand.width = W; skyBand.height = 980; skyFx.addChild(skyBand);
  const clouds = [];
  for (let k = 0; k < 6; k++) {
    const c = new PIXI.Sprite(FX.tex.glow); c.anchor.set(0.5); c.tint = k % 2 ? 0x1a0612 : 0x2a0a10; c.alpha = 0.55;
    c.scale.set(rnd(5, 7.5), rnd(1.6, 2.4)); c.position.set(rnd(0, W), rnd(40, 340)); c.vx = rnd(6, 16) * (k % 2 ? 1 : -1);
    skyFx.addChild(c); clouds.push(c);
  }
  const skyFlash = new PIXI.Sprite(FX.tex.glow); skyFlash.anchor.set(0.5); skyFlash.blendMode = ADD; skyFlash.tint = 0xffc890; skyFlash.alpha = 0; skyFx.addChild(skyFlash);
  // ember glow on the bull: a broad heat behind him and a soft chest glow in front (inside bullFit so it rides the crouch)
  const [chX, chY] = ctx.bullToL(474, 326);
  const backGlow = new PIXI.Sprite(FX.tex.glow); backGlow.anchor.set(0.5); backGlow.blendMode = ADD; backGlow.tint = 0xd8400c; backGlow.alpha = 0;
  backGlow.position.copyFrom(ctx.featRays.position); backGlow.scale.set(3.4, 2.8); backGlow.visible = false;
  layers.bullL.addChildAt(backGlow, Math.min(1, layers.bullL.children.length));
  const chestGlow = new PIXI.Sprite(FX.tex.glow); chestGlow.anchor.set(0.5); chestGlow.blendMode = ADD; chestGlow.tint = 0xff8a30; chestGlow.alpha = 0;
  chestGlow.position.set(474, 326); chestGlow.scale.set(2.6, 2.2); chestGlow.visible = false; ctx.bullFit.addChild(chestGlow);

  const mood = { k: 0 };
  let glintT = 1, flashT = 3, clock = 0, featureOn = false;
  ctx.app.ticker.add(() => safe(() => {
    const dt = Math.min(0.05, ctx.app.ticker.deltaMS / 1000) * gsap.globalTimeline.timeScale();
    clock += dt;
    leafP.update(dt); hotP.update(dt); moodP.update(dt);
    const k = mood.k;
    skyFx.visible = k > 0.001; backGlow.visible = chestGlow.visible = k > 0.001;
    if (k <= 0.001) return;
    skyFx.alpha = k;
    clouds.forEach((c) => { c.x += c.vx * dt; if (c.x > W + 400) c.x = -400; if (c.x < -400) c.x = W + 400; });
    const pulse = 0.5 + 0.5 * Math.sin(clock * 2.6) * Math.sin(clock * 1.1 + 1);
    backGlow.alpha = k * (0.12 + 0.08 * pulse);
    chestGlow.alpha = k * (0.12 + 0.12 * pulse);
    // embers rising over the whole screen (behind the board, in front of the bull), a few sparks over everything
    for (let n = ctx.nEmit(26 * k * (MOBILE ? 0.8 : 1)); n > 0; n--) {
      moodP.emit({ tex: FX.tex.dot, x: rnd(-20, W + 20), y: rnd(H * 0.35, H + 20), vx: rnd(-30, 30), vy: rnd(-120, -260), ax: rnd(-40, 40),
        s0: rnd(0.08, 0.2), s1: 0, life: rnd(1.8, 3.6), a0: 0.95, a1: 0, fadeIn: 0.3, twinkle: rnd(4, 9), tint: Math.random() < 0.6 ? 0xffa040 : 0xffd27a });
    }
    if (!MOBILE) for (let n = ctx.nEmit(3 * k); n > 0; n--) {
      hotP.emit({ tex: FX.tex.dot, x: rnd(0, W), y: rnd(H * 0.7, H), vx: rnd(-20, 20), vy: rnd(-90, -180), s0: rnd(0.06, 0.12), s1: 0, life: rnd(2, 3.5), a0: 0.8, a1: 0, fadeIn: 0.4, twinkle: 6, tint: 0xffc060 });
    }
    // gold glints running on the frame
    glintT -= dt;
    if (glintT < 0 && k > 0.5) {
      glintT = rnd(0.5, 1.3);
      const [x0, y0, x1, y1] = BOARD, per = 2 * (x1 - x0) + 2 * (y1 - y0);
      let d = Math.random() * per, x, y;
      if (d < x1 - x0) { x = x0 + d; y = y0; } else if ((d -= x1 - x0) < y1 - y0) { x = x1; y = y0 + d; }
      else if ((d -= y1 - y0) < x1 - x0) { x = x1 - d; y = y1; } else { x = x0; y = y1 - (d - (x1 - x0)); }
      safe(() => ctx.starFlash(x, y, rnd(0.6, 1.0), 0xfff0c0));
      hotP.emit({ tex: FX.tex.glow, x, y, s0: 0.5, s1: 0.2, life: 0.4, a0: 0.6, a1: 0, tint: 0xffc860 });
    }
    // distant sheet lightning in the storm
    flashT -= dt;
    if (flashT < 0) {
      flashT = rnd(2.5, 5.5);
      skyFlash.position.set(rnd(120, W - 120), rnd(60, 260)); skyFlash.scale.set(rnd(4, 7), rnd(2, 3));
      gsap.killTweensOf(skyFlash);
      gsap.timeline().to(skyFlash, { alpha: 0.32, duration: 0.05 }).to(skyFlash, { alpha: 0.08, duration: 0.08 })
        .to(skyFlash, { alpha: 0.26, duration: 0.04 }).to(skyFlash, { alpha: 0, duration: 0.4, ease: "power2.out" });
    }
  }));

  // ---------- lightning drawing ----------
  function boltPts(x0, y0, x1, y1, n, jag) {
    const pts = [[x0, y0]], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let s = 1; s < n; s++) {
      const f = s / n, off = (Math.random() - 0.5) * 2 * jag * Math.sin(Math.PI * f);
      pts.push([x0 + dx * f + nx * off, y0 + dy * f + ny * off]);
    }
    pts.push([x1, y1]); return pts;
  }
  function strokeBolt(g, pts, wGlow, wCore, col) {
    const path = (w, c, a) => { g.lineStyle(w, c, a); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); };
    path(wGlow * 2.2, col, 0.18); path(wGlow, col, 0.5); path(wCore, 0xffffff, 1);
  }
  function drawBolt(g, x0, y0, x1, y1, o) {
    const pts = boltPts(x0, y0, x1, y1, o.n || 12, o.jag || 50);
    strokeBolt(g, pts, o.w || 14, o.core || 4, o.col || 0xffd27a);
    const br = o.branches || 0;
    for (let b = 0; b < br; b++) {
      const i = 2 + Math.floor(Math.random() * (pts.length - 4)), [bx, by] = pts[i];
      const a = Math.atan2(y1 - y0, x1 - x0) + (Math.random() < 0.5 ? -1 : 1) * rnd(0.4, 0.9), len = rnd(60, 160);
      strokeBolt(g, boltPts(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len, 5, 22), (o.w || 14) * 0.5, (o.core || 4) * 0.55, o.col || 0xffd27a);
    }
  }
  // a flickering bolt for `dur` seconds (redrawn a few times), then gone
  function strike(x0, y0, x1, y1, dur, o) {
    const g = new PIXI.Graphics(); g.blendMode = ADD; layers.fxTop.addChild(g);
    const st = { t: 0 }; let last = -1;
    gsap.to(st, { t: 1, duration: dur, ease: "none", onUpdate: () => {
      const f = Math.floor(st.t * (o.redraws || 5));
      if (f !== last) { last = f; g.clear(); drawBolt(g, x0, y0, x1, y1, o); }
      g.alpha = st.t < 0.6 ? (Math.random() < 0.2 ? 0.55 : 1) : 1 - (st.t - 0.6) / 0.4;
    }, onComplete: () => g.destroy() });
    return g;
  }

  // ---------- 1. feature intro cutscene ----------
  let intro = null;
  function playIntro() {
    if (intro) { intro.progress(1); intro = null; }
    const turbo = !!S.turbo, objs = [];
    const fx = layers.fxTop, [rx, ry] = [ctx.featRays.x, ctx.featRays.y];
    // dark beat over the board
    // feathered top and bottom edges: a hard rectangle edge drew a line across the title bar during ignition
    const DH = BOARD[3] - BOARD[1] + 200, dc = document.createElement("canvas"); dc.width = 4; dc.height = 256; const dg = dc.getContext("2d");
    const dgr = dg.createLinearGradient(0, 0, 0, 256); dgr.addColorStop(0, "rgba(8,2,10,0)"); dgr.addColorStop(0.18, "rgba(8,2,10,1)");
    dgr.addColorStop(0.88, "rgba(8,2,10,1)"); dgr.addColorStop(1, "rgba(8,2,10,0)"); dg.fillStyle = dgr; dg.fillRect(0, 0, 4, 256);
    const dark = new PIXI.Sprite(PIXI.Texture.from(dc)); dark.position.set(-100, BOARD[1] - 140); dark.width = W + 200; dark.height = DH;
    dark.alpha = 0; fx.addChildAt(dark, 0); objs.push(dark);
    // gold light cones from behind the bull, turning slowly
    const cones = new PIXI.Container(); cones.position.set(rx, ry); cones.scale.set(0.1); cones.alpha = 0;
    layers.bullL.addChildAt(cones, 0); objs.push(cones);
    // the volumetric backlight (gx_rays) plays the intro swell and beats instead of the cone fan
    if (window.GXRays) { cones.visible = false; safe(() => window.GXRays.intro(turbo ? 1.7 / 0.7 : 1)); }
    const N = MOBILE ? 16 : 20;
    for (let i = 0; i < N; i++) {
      const c = new PIXI.Sprite(coneTex); c.anchor.set(0.5, 1); c.blendMode = ADD;
      c.rotation = (i / N) * Math.PI * 2 + rnd(-0.08, 0.08); c.scale.set(rnd(0.7, 1.5), rnd(1.5, 2.3));
      c.tint = i % 3 === 0 ? 0xffe0a0 : i % 3 === 1 ? 0xffa030 : 0xff7a20; c.alpha = rnd(0.22, 0.45); cones.addChild(c);
    }
    // the hot core of the column: a tall flame light that rides up with the head
    const core = new PIXI.Container(); core.position.set(540, BOARD[3] + 120); core.alpha = 0; fx.addChild(core); objs.push(core);
    const coreGlow = new PIXI.Sprite(FX.tex.glow); coreGlow.anchor.set(0.5); coreGlow.blendMode = ADD; coreGlow.tint = 0xff8a20; coreGlow.scale.set(3.0, 1.2); coreGlow.alpha = 0.45;
    const coreHot = new PIXI.Sprite(FX.tex.glow); coreHot.anchor.set(0.5); coreHot.blendMode = ADD; coreHot.tint = 0xfff2c0; coreHot.scale.set(1.2, 0.45); coreHot.alpha = 0.5;
    const trail = new PIXI.Sprite(FX.tex.ray); trail.anchor.set(0.5, 0); trail.blendMode = ADD; trail.tint = 0xffa030; trail.scale.set(2.6, 0.8); trail.alpha = 0.3;
    core.addChild(trail, coreGlow, coreHot);
    const head = { y: BOARD[3] + 120, w: 360 };

    const emitColumn = (n) => {
      for (let i = 0; i < n; i++) {
        const x = 540 + rnd(-0.5, 0.5) * head.w, y = head.y + rnd(-40, 60);
        leafP.emit({ tex: leafTex, x, y, vx: rnd(-160, 160) + (x - 540) * 0.6, vy: rnd(-1100, -650), ay: 380, drag: 1.6,
          s0: rnd(0.55, 0.9), s1: rnd(0.3, 0.5), life: rnd(0.55, 0.85), a0: 0.7, a1: 0, rot: rnd(0, 6.28), vr: rnd(-7, 7), flip: rnd(5, 11),
          tint: Math.random() < 0.4 ? 0xffc850 : 0xffe090 });
      }
      for (let i = 0; i < n * 0.8; i++) {
        const x = 540 + rnd(-0.45, 0.45) * head.w;
        if (FX.tex.fireFrames && Math.random() < 0.45) hotP.emit({ frames: FX.tex.fireFrames, fps: 30, x, y: head.y + rnd(0, 80), vx: rnd(-60, 60), vy: rnd(-700, -420), drag: 1.5,
          s0: rnd(1.2, 2), s1: 0.4, life: rnd(0.4, 0.6), a0: 0.75, a1: 0, tint: 0xffb050 });
        else hotP.emit({ tex: FX.tex.dot, x, y: head.y + rnd(-20, 60), vx: rnd(-140, 140), vy: rnd(-1200, -600), drag: 1.8, s0: rnd(0.2, 0.42), s1: 0, life: rnd(0.5, 0.9),
          a0: 1, a1: 0, stretch: 700, tint: Math.random() < 0.5 ? 0xffd27a : 0xff7a20 });
      }
    };
    const leafBurst = (x, y, n, sp) => {
      for (let i = 0; i < n; i++) {
        const a = rnd(0, Math.PI * 2), v = rnd(0.4, 1) * sp;
        leafP.emit({ tex: leafTex, x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, ay: 420, drag: 2.2,
          s0: rnd(0.5, 0.85), s1: rnd(0.25, 0.45), life: rnd(0.7, 1.1), a0: 0.85, a1: 0, rot: a + Math.PI / 2, vr: rnd(-9, 9), flip: rnd(6, 12), tint: i % 2 ? 0xffc850 : 0xffe090 });
        hotP.emit({ tex: FX.tex.dot, x, y, vx: Math.cos(a) * v * 1.3, vy: Math.sin(a) * v * 1.3, drag: 2.6, s0: rnd(0.2, 0.36), s1: 0, life: rnd(0.4, 0.8), a0: 1, a1: 0, stretch: 600,
          tint: i % 2 ? 0xffd27a : 0xff8a30 });
      }
    };
    const beat = (big) => safe(() => {
      ctx.shake(big ? 12 : 8, big ? 0.35 : 0.25);
      sfx("impact", big);
      ctx.flashAt(rx, ry + 80, 0xff8a20, big ? 1.6 : 1.2, 0.25);
      ctx.ringAt(rx, ry, 0xffd060, big ? 4.2 : 3.2, 0.5);
      if (ctx.VFX && ctx.VFX.shockwave && !MOBILE) ctx.VFX.shockwave(540, big ? ry : 940, { amp: big ? 18 : 12, radius: 1200, dur: 0.6 });
    });

    const tl = gsap.timeline({ onComplete: () => { objs.forEach(kill); if (intro === tl) intro = null; } });
    tl.timeScale(turbo ? 1.7 / 0.7 : 1);
    tl.to(dark, { alpha: 0.5, duration: 0.14, ease: "power2.out" }, 0)
      .to(dark, { alpha: 0.28, duration: 0.5, ease: "sine.inOut" }, 0.2)
      .to(dark, { alpha: 0, duration: 0.4, ease: "power1.in" }, 1.45)
      .to(cones, { alpha: 0.8, duration: 0.25 }, 0.05)
      .to(cones.scale, { x: 1, y: 1, duration: 0.6, ease: "back.out(1.4)" }, 0.05)
      .to(cones, { rotation: 0.55, duration: 2.4, ease: "none" }, 0)
      .to(cones, { alpha: 0.55, duration: 0.4 }, 0.95)
      .to(cones.scale, { x: 1.25, y: 1.25, duration: 0.15, ease: "power3.out" }, 1.4)
      .to(cones, { alpha: 0.8, duration: 0.08 }, 1.4)
      .to(cones, { alpha: 0, duration: 0.85, ease: "power2.in" }, 1.5)
      // the column rises from under the board up past the bull (0.3 -> 0.85 s), widening as it goes
      .to(core, { alpha: 1, duration: 0.12 }, 0.3)
      .to(head, { y: -160, w: 900, duration: 0.5, ease: "power2.in", onUpdate: () => {
        core.y = head.y; core.scale.x = 0.5 + 0.7 * head.w / 900;
        emitColumn(ctx.nEmit(MOBILE ? 70 : 100));
      } }, 0.3)
      .to(core, { alpha: 0, duration: 0.25 }, 0.8)
      .call(() => beat(false), null, 0.8)
      .call(() => leafBurst(rx, ry + 60, Math.round(16 * M), 1100), null, 1.4)
      .call(() => beat(true), null, 1.4)
      .to({}, { duration: 0.01 }, 2.5);
    sfx("rumble", 0.9);
    intro = tl;
  }

  // ---------- 2. feature mood ----------
  function setMood(on) {
    gsap.killTweensOf(mood);
    gsap.to(mood, { k: on ? 1 : 0, duration: on ? 1.2 : 0.45, ease: on ? "power1.in" : "power2.out", delay: on ? 0.3 : 0 });
  }

  GX.on("feature", (d) => {
    const on = !!(d && d.on);
    if (on === featureOn) return;
    featureOn = on;
    setMood(on);
    if (on) playIntro();
  });

  // ---------- 3. clash pose ----------
  const bf = ctx.bullFit;
  let base = null, clashTl = null, charge = null, darkened = null;
  const restScale = () => { if (!base) base = { x: bf.scale.x, y: bf.scale.y }; return base; };
  function darken(k) {
    // tint the bull's own (non-additive) sprites; remember what they were
    if (!darkened) {
      darkened = [];
      const walk = (o) => { (o.children || []).forEach((c) => { if (c === chestGlow) return; if (c instanceof PIXI.Sprite && c.blendMode === NORMAL) darkened.push({ s: c, t: c.tint }); walk(c); }); };
      walk(ctx.bull);
    }
    const v = Math.round(255 * (1 - k)), r = Math.min(255, v + Math.round(40 * k)), tint = (r << 16) | (Math.round(v * 0.9) << 8) | Math.round(v * 0.85);
    darkened.forEach((e) => { if (!e.s.destroyed) e.s.tint = k <= 0 ? e.t : tint; });
    if (k <= 0) darkened = null;
  }
  function endClash() {
    if (clashTl) { clashTl.kill(); clashTl = null; }
    if (charge) { charge.kill(); charge = null; }
    gsap.killTweensOf(bf.scale);
    if (base) bf.scale.set(base.x, base.y);
    if (darkened) darken(0);
  }
  GX.on("clashStart", () => {
    endClash();
    const b = restScale(), turbo = !!S.turbo, dk = { k: 0 };
    const D = turbo ? 0.3 : 0.45;
    sfx("rumble", 0.6);
    clashTl = gsap.timeline({ onComplete: () => { clashTl = null; } })
      .to(bf.scale, { x: b.x * 1.035, y: b.y * 0.962, duration: D, ease: "power2.in" }, 0)
      .to(dk, { k: 0.38, duration: D, ease: "power1.in", onUpdate: () => darken(dk.k) }, 0)
      .call(() => safe(() => { ctx.flashAt(chX, chY, 0xffc060, 2.2, 0.3); ctx.ringAt(chX, chY, 0xffb040, 2.2, 0.35); }), null, D)
      .to(bf.scale, { x: b.x, y: b.y, duration: 0.4, ease: "back.out(3)" }, D)
      .to(dk, { k: 0.12, duration: 0.25, onUpdate: () => darken(dk.k) }, D);
    // while the medallions clash, the chest keeps charging: pulsing glow, sparks sucked into it
    const cg = new PIXI.Sprite(FX.tex.glow); cg.anchor.set(0.5); cg.blendMode = ADD; cg.tint = 0xffb040; cg.position.set(chX, chY); cg.alpha = 0; cg.scale.set(1.2);
    layers.fxTop.addChild(cg);
    const ph = { t: 0 };
    charge = gsap.to(ph, { t: 1, duration: 4, ease: "none", delay: D, onStart: () => gsap.to(cg, { alpha: 0.7, duration: 0.3 }), onUpdate: () => {
      cg.scale.set(1.1 + 0.25 * Math.sin(ph.t * 60) + ph.t * 0.8);
      if (Math.random() < 0.5 * M + 0.1) {
        const a = rnd(0, 6.28), r = rnd(120, 220);
        hotP.emit({ tex: FX.tex.dot, x: chX + Math.cos(a) * r, y: chY + Math.sin(a) * r, vx: -Math.cos(a) * r * 3, vy: -Math.sin(a) * r * 3, s0: 0.25, s1: 0.05, life: 0.3, a0: 0, a1: 1, stretch: 500, tint: 0xffd27a });
      }
    }, onComplete: () => { kill(cg); } });
    charge.cg = cg;
  });
  GX.on("clashBurst", (d) => {
    const cg = charge && charge.cg;
    if (charge) { charge.kill(); charge = null; }
    if (clashTl) { clashTl.kill(); clashTl = null; }
    const b = restScale(), dk = { k: darkened ? 0.12 : 0 };
    const tx = (d && d.x) || ctx.COL_CX, ty = (d && d.y) || ctx.COL_CY;
    gsap.killTweensOf(bf.scale);
    gsap.timeline({ onComplete: () => bf.scale.set(b.x, b.y) })
      .to(bf.scale, { x: b.x * 1.025, y: b.y * 0.97, duration: 0.07, ease: "power2.in" })
      .to(bf.scale, { x: b.x * 0.975, y: b.y * 1.05, duration: 0.1, ease: "power3.out" })
      .to(bf.scale, { x: b.x, y: b.y, duration: 0.65, ease: "elastic.out(1.1, 0.35)" });
    gsap.to(dk, { k: 0, duration: 0.2, onUpdate: () => darken(dk.k), onComplete: () => darken(0) });
    gsap.delayedCall(0.07, () => safe(() => {
      if (cg && !cg.destroyed) gsap.to(cg, { alpha: 0, duration: 0.2, onComplete: () => kill(cg) });
      // explosive glow ring from the chest
      ctx.flashAt(chX, chY, 0xffc860, 1.5, 0.25);
      ctx.ringAt(chX, chY, 0xfff0b0, 3.2, 0.4); ctx.ringAt(chX, chY, 0xffa030, 5, 0.6);
      ctx.boom(chX, chY, 1.0);
      ctx.burstAt(chX, chY, 0xffd060, Math.round(26 * M));
      // the upward aura: a fan of rays rising off the chest
      for (let i = 0; i < 7; i++) {
        const r = new PIXI.Sprite(FX.tex.ray); r.anchor.set(0.5, 0); r.position.set(chX, chY + 40); r.blendMode = ADD;
        r.rotation = Math.PI + (i - 3) * 0.16; r.tint = i % 2 ? 0xffd27a : 0xff9a30; r.alpha = 0; r.scale.set(rnd(0.9, 1.5), 0.2);
        layers.fxTop.addChild(r);
        gsap.timeline({ onComplete: () => kill(r) }).to(r, { alpha: 0.5, duration: 0.06 }).to(r, { alpha: 0, duration: 0.5, ease: "power2.in" });
        gsap.to(r.scale, { y: rnd(0.8, 1.1), duration: 0.45, ease: "power3.out" });
      }
      for (let i = 0; i < 18 * M; i++) hotP.emit({ tex: FX.tex.dot, x: chX + rnd(-90, 90), y: chY + rnd(-20, 40), vx: rnd(-60, 60), vy: rnd(-900, -500), drag: 1.6,
        s0: rnd(0.2, 0.4), s1: 0, life: rnd(0.5, 0.8), a0: 1, a1: 0, stretch: 600, tint: 0xffd27a });
      // lightning to the multiplier column, and the hit there
      strike(chX, chY, tx, ty, 0.38, { n: 14, jag: 70, w: 16, core: 5, branches: 3, redraws: 6, col: 0xffd27a });
      strike(chX, chY, tx, ty - ctx.COL_P * 0.5, 0.3, { n: 12, jag: 90, w: 9, core: 3, branches: 1, redraws: 5, col: 0xffb040 });
      gsap.delayedCall(0.05, () => safe(() => { ctx.flashAt(tx, ty, 0xfff0c0, 2.4, 0.3); ctx.burstAt(tx, ty, 0xffd060, Math.round(14 * M)); }));
      ctx.shake(10, 0.25); sfx("lightning"); sfx("impact", true);
    }));
  });

  // ---------- 4. near-win strike on the teased reel ----------
  GX.on("tease", (d) => {
    const reel = d && d.reel !== undefined ? d.reel : 2;
    const [x0, x1] = ctx.REEL_X[reel], cx = (x0 + x1) / 2, y0 = ctx.CELL_Y0, y1 = ctx.WIN_Y1;
    gsap.delayedCall(0.12, () => safe(() => {
      // pre-flash: the sky above the reel lights up a beat before the strike
      ctx.flashAt(cx, y0 - 120, 0xfff0c0, 2.5, 0.2);
      const g = strike(cx + rnd(-30, 30), y0 - 330, cx + rnd(-20, 20), y1 - 30, 0.5, { n: 16, jag: 55, w: 18, core: 5, branches: 4, redraws: 5, col: 0xffe2a0 });
      void g;
      const beam = new PIXI.Sprite(FX.tex.ray); beam.anchor.set(0.5, 0); beam.position.set(cx, y1); beam.blendMode = ADD; beam.tint = 0xffd890;
      beam.scale.set((x1 - x0) / 128 * 1.1, -(y1 - y0 + 200) / 1024); beam.alpha = 0; layers.fxTop.addChild(beam);
      gsap.timeline({ onComplete: () => kill(beam) }).to(beam, { alpha: 0.4, duration: 0.05 }).to(beam, { alpha: 0, duration: 0.45, ease: "power2.in" });
      for (let row = 0; row < 3; row++) {
        const cy0 = y0 + row * ctx.CELL_H;
        const f = new PIXI.Graphics().beginFill(0xfff2c8).drawRoundedRect(x0 + 6, cy0 + 6, x1 - x0 - 12, ctx.CELL_H - 12, 18).endFill()
          .lineStyle(6, 0xffd060, 1).drawRoundedRect(x0 + 6, cy0 + 6, x1 - x0 - 12, ctx.CELL_H - 12, 18);
        f.blendMode = ADD; f.alpha = 0; layers.fxTop.addChild(f);
        gsap.timeline({ delay: row * 0.045, onComplete: () => kill(f) }).to(f, { alpha: 0.26, duration: 0.04 }).to(f, { alpha: 0, duration: 0.3, ease: "power2.out" });
      }
      gsap.delayedCall(0.08, () => safe(() => {
        ctx.flashAt(cx, y1 - 30, 0xffe8b0, 2.2, 0.3); ctx.burstAt(cx, y1 - 30, 0xffd060, Math.round(16 * M)); ctx.ringAt(cx, y1 - 30, 0xffd060, 1.8, 0.35);
      }));
      ctx.shake(6, 0.18); sfx("lightning");
    }));
  });
});
