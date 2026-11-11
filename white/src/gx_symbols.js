// Fortune Bull 1000 - effect plugin: symbols (see src/gx.js)
// SYMBOL WIN ANIMATIONS (cellWin): every symbol gets its own 0.6-0.9 s move, then a calm loop while the win shows.
//   A K Q J     springy jump + squash/stretch, gem glint at a corner, ring of sparks in the letter's colour
//   hourglass   rocked like it is being turned (+-8 deg, elastic), gold sand pours under it, violet shimmer
//   sun         rotating fan of gold rays behind it, swells with a warm flash, small flares orbit
//   chest       hop with squash, fountain of coins + gems from the lid, gold glow from inside
//   wild/super  roar pulse with two shock rings, flame licks rising behind, horn glints (super = stronger, red-gold)
// WILD LANDING (wildLand): ground-slam dust ring on the cell's bottom edge, light cracks across the cell (0.3 s),
//   embers; super_wild also a 0.4 s rising fire column.
// Cleanup: a marker pushed into winObjs (clearWin destroys it) + a watchdog (view reused / round spinning) kill every
// tween and restore view.b / view.inner exactly.
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, FX, layers, MOBILE, S, CELL_H } = ctx;
  const ADD = PIXI.BLEND_MODES.ADD, NORMAL = PIXI.BLEND_MODES.NORMAL;
  const N = (n) => Math.max(1, Math.round(MOBILE ? n / 2 : n));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const LOW_COL = { A: 0xff3a3a, K: 0xb45cff, Q: 0x3f8eff, J: 0x2fe07a };
  const LOW_HI = { A: 0xffc0b0, K: 0xeac8ff, Q: 0xbfe0ff, J: 0xc0ffd8 };

  // our own particle layers (front = over the reels, updated on the gsap ticker in game time so ?ts slow-mo applies)
  const front = new FX.Particles(layers.boardFx);
  const systems = [front];
  const tick = () => {
    const dt = Math.min(0.05, gsap.ticker.deltaRatio(60) / 60) * gsap.globalTimeline.timeScale();
    for (const p of systems) { try { p.update(dt); } catch (e) { /* a destroyed system */ } }
    for (let i = anims.length - 1; i >= 0; i--) { const a = anims[i]; try { a.step(dt); } catch (e) { a.stop(); } }
  };
  const anims = [];
  gsap.ticker.add(tick);

  const spr = (tex, parent, o = {}) => {
    const s = new PIXI.Sprite(tex); s.anchor.set(o.ax === undefined ? 0.5 : o.ax, o.ay === undefined ? 0.5 : o.ay);
    s.blendMode = o.blend === undefined ? ADD : o.blend; if (o.tint !== undefined) s.tint = o.tint;
    s.alpha = o.alpha === undefined ? 1 : o.alpha; s.position.set(o.x || 0, o.y || 0);
    if (o.s !== undefined) s.scale.set(o.s, o.sy === undefined ? o.s : o.sy);
    if (o.rot) s.rotation = o.rot;
    if (parent) parent.addChild(s);
    return s;
  };

  // ---------- one running symbol animation ----------
  function Anim(d) {
    const v = d.view, id = d.id;
    const hero = v.hero;
    const self = { v, id, tws: [], objs: [], steps: [], dead: false };
    // the game's 6% pulse is replaced by ours on the same sprite
    gsap.killTweensOf(hero.scale); gsap.killTweensOf(v.inner.scale);
    const base = {
      b: { x: v.b.x, y: v.b.y, r: v.b.rotation }, i: { x: v.inner.x, y: v.inner.y, r: v.inner.rotation },
    };
    hero.scale.set(1);
    self.hero = hero;
    self.tw = (t) => { self.tws.push(t); return t; };
    self.own = (o) => { self.objs.push(o); return o; };
    self.later = (sec, fn) => self.tw(gsap.delayedCall(sec, () => { if (!self.dead) { try { fn(); } catch (e) { console.warn("gx", e); } } }));
    self.every = (first, period, fn) => {
      const go = () => { if (self.dead) return; try { fn(); } catch (e) { console.warn("gx", e); } self.tw(gsap.delayedCall(period * rnd(0.85, 1.15), go)); };
      self.tw(gsap.delayedCall(first, go));
    };
    self.onStep = (fn) => self.steps.push(fn);
    // a child of the view's inner container behind the subject (b) or behind everything (index 0)
    self.behind = (atBack) => {
      const c = new PIXI.Container();
      const idx = atBack ? 0 : Math.max(0, v.inner.getChildIndex(v.b.visible ? v.b : v.a));
      v.inner.addChildAt(c, idx);
      return self.own(c);
    };
    self.fx = () => { const c = new PIXI.Container(); c.position.set(d.cx, d.cy); layers.boardFx.addChild(c); return self.own(c); };
    self.parts = (parent) => {
      const p = new FX.Particles(parent); systems.push(p);
      self.own({ destroy: () => { const k = systems.indexOf(p); if (k >= 0) systems.splice(k, 1);
        try { p.clear(); } catch (e) { /* parent gone */ } try { if (!p.c.destroyed) p.c.destroy({ children: true }); } catch (e) { /* gone */ } } });
      return p;
    };
    self.step = (dt) => {
      if (self.dead) return;
      if (v.id !== id || S.state === "spinning" || v.inner.destroyed) { self.stop(); return; }
      self.steps.forEach((fn) => fn(dt));
    };
    self.stop = () => {
      if (self.dead) return; self.dead = true;
      const k = anims.indexOf(self); if (k >= 0) anims.splice(k, 1);
      self.tws.forEach((t) => { try { t.kill(); } catch (e) { /* gone */ } });
      self.objs.slice().reverse().forEach((o) => { try { gsap.killTweensOf(o); if (o.scale) gsap.killTweensOf(o.scale); if (!o.destroyed) o.destroy({ children: true }); } catch (e) { /* gone */ } });
      if (v._gxSym === self) v._gxSym = null;
      try {
        if (!v.b.destroyed) { gsap.killTweensOf(v.b); gsap.killTweensOf(v.b.scale); v.b.position.set(base.b.x, base.b.y); v.b.rotation = base.b.r; v.b.scale.set(1); }
        if (!v.inner.destroyed) { gsap.killTweensOf(v.inner); gsap.killTweensOf(v.inner.scale); v.inner.position.set(base.i.x, base.i.y); v.inner.rotation = base.i.r; v.inner.scale.set(1); }
      } catch (e) { /* view gone */ }
    };
    // clearWin destroys everything in winObjs: our marker stops the animation there
    d.winObjs.push({ destroy: () => self.stop() });
    if (v._gxSym) v._gxSym.stop();
    v._gxSym = self;
    anims.push(self);
    return self;
  }


  // ---------- A K Q J ----------
  function low(d, A) {
    const col = LOW_COL[d.id], hi = LOW_HI[d.id], h = A.hero;
    const st = { lift: 0 };
    const y0 = h.y, hh = 72;
    const upd = () => { h.y = y0 + (1 - h.scale.y) * hh - st.lift; };
    const tl = A.tw(gsap.timeline({ onUpdate: upd }));
    tl.to(h.scale, { x: 1.14, y: 0.84, duration: 0.11, ease: "power2.in" })
      .to(h.scale, { x: 0.9, y: 1.14, duration: 0.14, ease: "power2.out" })
      .to(st, { lift: 34, duration: 0.2, ease: "power2.out" }, "<")
      .to(st, { lift: 0, duration: 0.15, ease: "power2.in" })
      .to(h.scale, { x: 0.96, y: 1.05, duration: 0.15, ease: "sine.inOut" }, "<")
      .to(h.scale, { x: 1.16, y: 0.84, duration: 0.06, ease: "power2.out" })
      .to(h.scale, { x: 1, y: 1, duration: 0.5, ease: "elastic.out(1,0.35)" });
    const fx = A.fx();
    const P = A.parts(fx);
    // landing (t ~0.46): ring of sparks + coloured ring + a soft flash
    A.later(0.46, () => {
      const n = N(14);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + rnd(-0.12, 0.12), sp = rnd(260, 380);
        P.emit({ tex: FX.tex.spark, x: Math.cos(a) * 34, y: Math.sin(a) * 26 + 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.75, drag: 3.2,
          s0: 0.42, s1: 0.06, life: rnd(0.45, 0.6), a0: 1, a1: 0, tint: i % 3 ? col : hi, stretch: 260 });
      }
      const ring = spr(FX.tex.ring, fx, { tint: col, s: 0.25, y: 20, alpha: 0.95 });
      A.tw(gsap.to(ring.scale, { x: 1.25, y: 1.0, duration: 0.45, ease: "power2.out" }));
      A.tw(gsap.to(ring, { alpha: 0, duration: 0.45, ease: "power1.in" }));
      const fl = spr(FX.tex.glow, fx, { tint: col, s: 0.6, alpha: 0.85 });
      A.tw(gsap.to(fl.scale, { x: 1.1, y: 1.0, duration: 0.35, ease: "power2.out" }));
      A.tw(gsap.to(fl, { alpha: 0, duration: 0.4 }));
    });
    // gem glint at a corner of the letter (first top-right, then wandering corners in the loop)
    const corners = [[58, -58], [-56, -56], [56, 52], [-52, 54]];
    const glint = (k, big) => {
      const [x, y] = corners[k % corners.length];
      const halo = spr(FX.tex.glow, fx, { tint: col, x, y, s: 0.05, alpha: 0.9 });
      const s1 = spr(FX.tex.star8, fx, { tint: col, x, y, s: 0.02, rot: rnd(0, 0.6) });
      const s2 = spr(FX.tex.star8, fx, { tint: 0xffffff, x, y, s: 0.02, rot: s1.rotation + 0.39 });
      const m = big ? 1 : 0.7;
      A.tw(gsap.timeline()
        .to(s1.scale, { x: 0.42 * m, y: 0.42 * m, duration: 0.16, ease: "back.out(2)" })
        .to(s2.scale, { x: 0.24 * m, y: 0.24 * m, duration: 0.16, ease: "back.out(2)" }, "<")
        .to(halo.scale, { x: 0.45 * m, y: 0.45 * m, duration: 0.16 }, "<")
        .to([s1, s2], { rotation: "+=0.9", duration: 0.5, ease: "power1.out" }, "<")
        .to([s1.scale, s2.scale, halo.scale], { x: 0.01, y: 0.01, duration: 0.3, ease: "power2.in" }, "-=0.3")
        .call(() => { [halo, s1, s2].forEach((s) => s.destroy()); }));
    };
    A.later(0.62, () => glint(0, true));
    let gk = 1;
    A.every(1.5, 1.6, () => glint(gk++, false));
    // calm loop: a slow breath and a stray spark now and then
    A.later(1.0, () => {
      A.tw(gsap.to(h.scale, { x: 1.035, y: 1.035, duration: 0.85, ease: "sine.inOut", yoyo: true, repeat: -1, onUpdate: upd }));
    });
    A.every(1.2, 0.5, () => P.emit({ tex: FX.tex.spark, x: rnd(-70, 70), y: rnd(-60, 60), vy: -20, s0: 0.05, s1: 0.3, life: 0.5, a0: 1, a1: 0, vr: 3, tint: Math.random() < 0.5 ? col : hi }));
  }

  // ---------- hourglass ----------
  function hourglass(d, A) {
    const h = A.hero, P = A.parts(A.fx());
    const back = A.behind();
    const sh = spr(FX.tex.glow, back, { tint: 0x9a5cff, s: 0.9, sy: 1.05, alpha: 0 });
    const sh2 = spr(FX.tex.glow, back, { tint: 0xd8b0ff, s: 0.5, sy: 0.7, alpha: 0 });
    A.tw(gsap.to(sh, { alpha: 0.95, duration: 0.2 }));
    A.tw(gsap.to(sh2, { alpha: 0.7, duration: 0.2 }));
    A.tw(gsap.to(sh, { alpha: 0.45, duration: 0.6, delay: 0.5 })); A.tw(gsap.to(sh2, { alpha: 0.3, duration: 0.6, delay: 0.5 }));
    // violet shimmer band sweeping over the subject (masked by its own art)
    const fx = A.fx();
    const m = spr(h.texture, fx, { blend: NORMAL });
    const band = spr(FX.tex.shine, fx, { tint: 0xd8a8ff, s: 1.3, sy: 14, rot: 0.5, x: -200, alpha: 1 });
    band.mask = m;
    const sweep = () => { band.x = -200; A.tw(gsap.to(band, { x: 200, duration: 0.7, ease: "power1.inOut" })); };
    A.later(0.15, sweep);
    A.every(2.2, 2.6, sweep);
    const syncMask = () => { m.rotation = h.rotation; m.scale.copyFrom(h.scale); m.position.set(h.x, h.y); };
    A.onStep(syncMask);
    // turned like an hourglass: tip back, swing over, settle elastic
    A.tw(gsap.timeline()
      .to(h, { rotation: -8 * DEG, duration: 0.13, ease: "power2.out" })
      .to(h.scale, { x: 1.07, y: 1.07, duration: 0.13, ease: "power2.out" }, "<")
      .to(h, { rotation: 8 * DEG, duration: 0.22, ease: "power2.inOut" })
      .to(h, { rotation: 0, duration: 0.55, ease: "elastic.out(1.1,0.3)" })
      .to(h.scale, { x: 1, y: 1, duration: 0.4, ease: "power2.out" }, "<")
      .to(h, { rotation: 2 * DEG, duration: 0.55, ease: "sine.out" })
      .to(h, { rotation: -2 * DEG, duration: 1.1, ease: "sine.inOut", yoyo: true, repeat: -1 }));
    // sand: a stream through the neck, a spill pouring under the glass
    const grain = (spill) => {
      if (spill) P.emit({ tex: FX.tex.spark, x: rnd(-22, 22), y: 84, vx: rnd(-70, 70), vy: rnd(40, 110), ay: 650, s0: rnd(0.2, 0.3), s1: 0.08,
        life: rnd(0.45, 0.7), a0: 1, a1: 0.1, tint: Math.random() < 0.3 ? 0xfff2c0 : 0xffc24a, stretch: 200 });
      else P.emit({ tex: FX.tex.spark, x: rnd(-3, 3), y: -4, vy: rnd(110, 160), s0: 0.16, s1: 0.1, life: 0.32, a0: 1, a1: 0.3, tint: 0xffe08a, stretch: 120 });
      if (Math.random() < 0.25) P.emit({ tex: FX.tex.star8, x: rnd(-80, 80), y: rnd(-90, 90), vy: -15, s0: 0.02, s1: 0.1, life: 0.5, a0: 1, a1: 0, vr: 3, tint: 0xd8a8ff });
    };
    // a soft gold pool where the sand lands, a violet glaze over the glass
    const pool = spr(FX.tex.glow, P.c.parent, { tint: 0xffb030, y: 96, s: 0.7, sy: 0.18, alpha: 0 });
    A.tw(gsap.to(pool, { alpha: 0.8, duration: 0.3, delay: 0.2 }));
    const glaze = spr(h.texture, fx, { tint: 0xa060ff, alpha: 0 });
    A.onStep(() => { glaze.rotation = h.rotation; glaze.scale.copyFrom(h.scale); glaze.position.set(h.x, h.y); });
    A.tw(gsap.timeline().to(glaze, { alpha: 0.55, duration: 0.15 }).to(glaze, { alpha: 0, duration: 0.6, ease: "power1.in" })
      .to(glaze, { alpha: 0.18, duration: 1.0, ease: "sine.inOut", yoyo: true, repeat: -1 }));
    let acc = 0, t = 0;
    A.onStep((dt) => {
      t += dt;
      const rate = t < 0.9 ? (MOBILE ? 35 : 70) : (MOBILE ? 7 : 14);
      acc += dt * rate;
      while (acc >= 1) { acc -= 1; grain(true); if (Math.random() < 0.6) grain(false); }
    });
  }

  // ---------- sun ----------
  function sun(d, A) {
    const h = A.hero, back = A.behind();
    const r1 = spr(FX.tex.burst, back, { tint: 0xffc23a, s: 0.05, alpha: 0.95 });
    const r2 = spr(FX.tex.burst, back, { tint: 0xff8a1a, s: 0.05, alpha: 0.7, rot: 0.13 });
    const core = spr(FX.tex.glow, back, { tint: 0xffd070, s: 0.6, alpha: 0 });
    A.tw(gsap.to(r1.scale, { x: 0.3, y: 0.3, duration: 0.35, ease: "back.out(1.6)" }));
    A.tw(gsap.to(r2.scale, { x: 0.36, y: 0.36, duration: 0.45, ease: "back.out(1.4)" }));
    A.tw(gsap.to(core, { alpha: 0.9, duration: 0.2 }));
    A.tw(gsap.to(r1, { alpha: 0.75, duration: 0.6, delay: 0.7 })); A.tw(gsap.to(r2, { alpha: 0.5, duration: 0.6, delay: 0.7 }));
    A.onStep((dt) => { r1.rotation += dt * 0.55; r2.rotation -= dt * 0.35; });
    // swell with a warm flash
    A.tw(gsap.timeline()
      .to(h.scale, { x: 0.94, y: 0.94, duration: 0.1, ease: "power2.in" })
      .to(h.scale, { x: 1.2, y: 1.2, duration: 0.18, ease: "back.out(2)" })
      .to(h.scale, { x: 1, y: 1, duration: 0.5, ease: "elastic.out(1,0.4)" }, "+=0.08")
      .to(h.scale, { x: 1.04, y: 1.04, duration: 0.9, ease: "sine.inOut", yoyo: true, repeat: -1 }));
    const fx = A.fx(), P = A.parts(fx);
    A.later(0.1, () => {
      const f = spr(FX.tex.glow, fx, { tint: 0xffe6a8, s: 0.5, alpha: 1 });
      A.tw(gsap.to(f.scale, { x: 1.7, y: 1.5, duration: 0.45, ease: "power2.out" }));
      A.tw(gsap.to(f, { alpha: 0, duration: 0.45, ease: "power1.in" }));
      const st = spr(FX.tex.star8, fx, { tint: 0xfff4d0, s: 0.1, alpha: 1 });
      A.tw(gsap.to(st.scale, { x: 0.9, y: 0.9, duration: 0.3, ease: "power2.out" }));
      A.tw(gsap.to(st, { alpha: 0, rotation: 0.6, duration: 0.4 }));
      for (let i = 0; i < N(12); i++) {
        const a = rnd(0, TAU), sp = rnd(200, 360);
        P.emit({ tex: FX.tex.spark, x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, s0: 0.35, s1: 0.05, life: 0.55, tint: 0xffc860, stretch: 300 });
      }
    });
    // small flares orbiting the disc
    const fl = [];
    const nf = MOBILE ? 2 : 3;
    for (let i = 0; i < nf; i++) {
      const s = spr(FX.tex.star8, fx, { tint: i % 2 ? 0xffe9a0 : 0xffb030, s: 0.0 });
      const g = spr(FX.tex.glow, s, { tint: 0xffa020, s: 0.6, alpha: 0.8 });
      fl.push({ s, g, a: (i / nf) * TAU, k: 0 });
      A.tw(gsap.to(fl[i], { k: 1, duration: 0.4, delay: 0.25 + i * 0.07, ease: "back.out(2)" }));
    }
    let t = 0;
    A.onStep((dt) => {
      t += dt;
      fl.forEach((f, i) => {
        f.a += dt * (1.5 + i * 0.25);
        const r = 78 + 8 * Math.sin(t * 2 + i);
        f.s.position.set(Math.cos(f.a) * r, Math.sin(f.a) * r * 0.85);
        const tw = 0.75 + 0.25 * Math.sin(t * 9 + i * 2);
        f.s.scale.set(0.16 * f.k * tw); f.s.rotation = t * 2;
      });
    });
  }

  // ---------- chest ----------
  function chest(d, A) {
    const h = A.hero, y0 = h.y, st = { lift: 0 };
    const upd = () => { h.y = y0 + (1 - h.scale.y) * 90 - st.lift; };
    A.tw(gsap.timeline({ onUpdate: upd })
      .to(h.scale, { x: 1.1, y: 0.87, duration: 0.11, ease: "power2.in" })
      .to(h.scale, { x: 0.94, y: 1.09, duration: 0.13, ease: "power2.out" })
      .to(st, { lift: 22, duration: 0.17, ease: "power2.out" }, "<")
      .to(st, { lift: 0, duration: 0.13, ease: "power2.in" })
      .to(h.scale, { x: 1.12, y: 0.88, duration: 0.06, ease: "power2.out" })
      .to(h.scale, { x: 1, y: 1, duration: 0.5, ease: "elastic.out(1,0.35)" }));
    const back = A.behind();
    const fx = A.fx(), P = A.parts(fx);
    // gold glow pouring out of the lid
    const lidY = -34;
    const gl = spr(FX.tex.glow, fx, { tint: 0xffb52a, x: 0, y: lidY, s: 0.3, sy: 0.2, alpha: 0 });
    const gl2 = spr(FX.tex.glow, fx, { tint: 0xfff0b0, x: 0, y: lidY, s: 0.18, sy: 0.1, alpha: 0 });
    const shafts = [];
    for (let i = 0; i < (MOBILE ? 3 : 5); i++) {
      const s = spr(FX.tex.ray, fx, { tint: 0xffd060, x: (i - 2) * 22, y: lidY + 10, ax: 0.5, ay: 1, s: 0.32, sy: 0, rot: (i - 2) * 0.22, alpha: 0.55 });
      shafts.push(s);
    }
    const bk = spr(FX.tex.glow, back, { tint: 0xffa020, s: 1.0, sy: 0.9, alpha: 0 });
    A.tw(gsap.timeline({ delay: 0.22 })
      .to([gl, gl2], { alpha: 1, duration: 0.12 })
      .to(gl.scale, { x: 0.95, y: 0.5, duration: 0.25, ease: "power2.out" }, "<")
      .to(gl2.scale, { x: 0.55, y: 0.28, duration: 0.25, ease: "power2.out" }, "<")
      .to(bk, { alpha: 0.75, duration: 0.2 }, "<")
      .to(shafts.map((s) => s.scale), { y: 0.2, duration: 0.3, ease: "power2.out", stagger: 0.03 }, "<")
      .to([gl, gl2, bk], { alpha: 0.45, duration: 0.6 })
      .to(shafts, { alpha: 0.2, duration: 0.6 }, "<"));
    A.later(1.3, () => A.tw(gsap.to([gl, gl2], { alpha: 0.75, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut" })));
    // fountain of coins and gems
    const coin = (big) => P.emit({ frames: FX.tex.coinFrames, fps: 26, tex: FX.tex.coin, blend: NORMAL, x: rnd(-30, 30), y: lidY,
      vx: rnd(-230, 230), vy: rnd(-720, -480) * (big ? 1 : 0.7), ay: 1500, s0: big ? 0.36 : 0.28, s1: 0.3, life: rnd(0.75, 0.95), a0: 1, a1: 0.6 });
    const gem = () => P.emit({ tex: FX.tex.gems ? FX.tex.gems[Math.floor(Math.random() * FX.tex.gems.length)] : FX.tex.star8,
      blend: NORMAL, x: rnd(-25, 25), y: lidY, vx: rnd(-200, 200), vy: rnd(-650, -420), ay: 1500, s0: 0.32, s1: 0.26, life: rnd(0.7, 0.9), a0: 1, a1: 0.5, vr: rnd(-6, 6) });
    A.later(0.24, () => {
      for (let i = 0; i < N(12); i++) coin(true);
      for (let i = 0; i < N(5); i++) gem();
      for (let i = 0; i < N(10); i++) P.emit({ tex: FX.tex.spark, x: rnd(-40, 40), y: lidY, vx: rnd(-150, 150), vy: rnd(-420, -200), drag: 2, s0: 0.3, s1: 0.04, life: 0.5, tint: 0xffe08a, stretch: 300 });
    });
    A.every(1.4, 1.1, () => { coin(false); if (Math.random() < 0.4) gem(); });
  }

  // ---------- wild / super_wild ----------
  function wild(d, A) {
    const sup = d.id === "super_wild";
    const h = d.view.inner;
    const c1 = sup ? 0xff4a14 : 0xb45cff, c2 = sup ? 0xffc040 : 0xf0c8ff;
    const peak = sup ? 1.2 : 1.14;
    A.tw(gsap.timeline()
      .to(h.scale, { x: 0.93, y: 0.93, duration: 0.12, ease: "power2.in" })
      .to(h.scale, { x: peak, y: peak, duration: 0.12, ease: "back.out(2.5)" })
      .to(h.scale, { x: 1, y: 1, duration: 0.55, ease: "elastic.out(1,0.38)" }));
    if (sup) A.tw(gsap.timeline({ delay: 0.12 })
      .to(h, { rotation: 3 * DEG, duration: 0.04 }).to(h, { rotation: -3 * DEG, duration: 0.06 })
      .to(h, { rotation: 2 * DEG, duration: 0.06 }).to(h, { rotation: 0, duration: 0.2, ease: "power2.out" }));
    const fx = A.fx(), P = A.parts(fx);
    // flame licks rising behind the seal (inside the cell's container, behind the art and the win clip)
    const back = A.behind(true);
    const BF = A.parts(back);
    const bg = spr(FX.tex.glow, back, { tint: c1, s: 1.1, sy: 1.0, alpha: 0 });
    A.tw(gsap.to(bg, { alpha: sup ? 0.85 : 0.7, duration: 0.25, delay: 0.1 }));
    // the seal fills the cell, so the licks start on its rim (sides + top arc) and rise past it, behind the cell above
    const RIM = sup ? 112 : 106;
    const lick = (burst) => {
      const a = Math.PI + rnd(-0.35, Math.PI + 0.35), r = RIM + rnd(-8, 6);
      const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.95 + 10;
      const fl = Math.random() < 0.5 ? BF : P;
      fl.emit({ frames: FX.tex.fireFrames, fps: 30, tex: FX.tex.flame, x, y, vx: Math.cos(a) * 30, vy: rnd(-230, -150) * (burst ? 1.35 : 1),
        s0: rnd(1.0, 1.45) * (sup ? 1.25 : 1), s1: 0.3, life: rnd(0.5, 0.75), a0: fl === P ? 0.75 : 0.95, a1: 0, fadeIn: 0.08,
        tint: sup ? (Math.random() < 0.5 ? 0xff7a1a : 0xffb030) : (Math.random() < 0.5 ? 0xb060ff : 0xff8ad8), blend: ADD });
    };
    let acc = 0, t = 0;
    A.onStep((dt) => {
      t += dt;
      const rate = (t < 0.8 ? 40 : 14) * (sup ? 1.5 : 1) * (MOBILE ? 0.5 : 1);
      acc += dt * rate;
      while (acc >= 1) { acc -= 1; lick(t < 0.8); }
    });
    // two (super: three) shock rings from the roar
    const ring = (delay, s1, tint, life) => A.later(delay, () => {
      const r = spr(FX.tex.ring, fx, { tint, s: 0.35, alpha: 1 });
      A.tw(gsap.to(r.scale, { x: s1, y: s1 * 0.92, duration: life, ease: "power2.out" }));
      A.tw(gsap.to(r, { alpha: 0, duration: life, ease: "power1.in" }));
    });
    ring(0.22, sup ? 2.0 : 1.6, c1, 0.5);
    ring(0.34, sup ? 2.5 : 2.0, c2, 0.55);
    if (sup) ring(0.46, 2.9, 0xff7a20, 0.6);
    A.later(0.22, () => {
      const f = spr(FX.tex.glow, fx, { tint: sup ? 0xffb060 : 0xe0b8ff, s: 0.6, alpha: 0.9 });
      A.tw(gsap.to(f.scale, { x: 1.5, y: 1.4, duration: 0.35, ease: "power2.out" }));
      A.tw(gsap.to(f, { alpha: 0, duration: 0.35 }));
      for (let i = 0; i < N(sup ? 20 : 12); i++) {
        const a = rnd(0, TAU), sp = rnd(260, 460);
        P.emit({ tex: FX.tex.spark, x: Math.cos(a) * 40, y: Math.sin(a) * 40, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, s0: 0.38, s1: 0.05, life: 0.55, tint: i % 2 ? c1 : c2, stretch: 300 });
      }
    });
    // horn glints (horn tips of the seal art, 1:1 board px)
    const horns = sup ? [[-56, -143], [62, -143]] : [[-92, -100], [92, -100]];
    const glint = (k, m) => {
      const [x, y] = horns[k % 2];
      const s1 = spr(FX.tex.star8, fx, { tint: c2, x, y, s: 0.02, rot: rnd(0, 0.5) });
      const s2 = spr(FX.tex.star8, fx, { tint: 0xffffff, x, y, s: 0.02, rot: s1.rotation + 0.39 });
      const hl = spr(FX.tex.glow, fx, { tint: c1, x, y, s: 0.05, alpha: 0.9 });
      A.tw(gsap.timeline()
        .to(s1.scale, { x: 0.45 * m, y: 0.45 * m, duration: 0.15, ease: "back.out(2)" })
        .to(s2.scale, { x: 0.25 * m, y: 0.25 * m, duration: 0.15, ease: "back.out(2)" }, "<")
        .to(hl.scale, { x: 0.5 * m, y: 0.5 * m, duration: 0.15 }, "<")
        .to([s1, s2], { rotation: "+=1", duration: 0.5 }, "<")
        .to([s1.scale, s2.scale, hl.scale], { x: 0.01, y: 0.01, duration: 0.3, ease: "power2.in" }, "-=0.3")
        .call(() => [s1, s2, hl].forEach((s) => s.destroy())));
    };
    A.later(0.5, () => glint(0, sup ? 1.2 : 1));
    A.later(0.62, () => glint(1, sup ? 1.2 : 1));
    let gk = 0;
    A.every(1.6, 1.3, () => glint(gk++, 0.8));
    A.later(1.0, () => A.tw(gsap.to(h.scale, { x: 1.03, y: 1.03, duration: 0.8, ease: "sine.inOut", yoyo: true, repeat: -1 })));
  }

  const MOVES = { A: low, K: low, Q: low, J: low, hourglass, sun, chest, wild, super_wild: wild };
  GX.on("cellWin", (d) => {
    const fn = MOVES[d.id];
    if (!fn || !d.view) return;
    const A = Anim(d);
    try { fn(d, A); } catch (e) { A.stop(); throw e; }
  });

  // ---------- wild landing ----------
  GX.on("wildLand", (d) => {
    const sup = d.id === "super_wild";
    const objs = [], tws = [];
    const done = () => { tws.forEach((t) => t.kill()); objs.forEach((o) => { if (!o.destroyed) o.destroy({ children: true }); }); };
    const c = new PIXI.Container(); c.position.set(d.x, d.y); layers.boardFx.addChild(c);
    const P = new FX.Particles(c); systems.push(P);
    objs.push({ destroy: () => { const k = systems.indexOf(P); if (k >= 0) systems.splice(k, 1); try { P.clear(); } catch (e) { /* gone */ } } }, c);
    const by = CELL_H / 2 - 12;
    // ground-slam dust ring (flat ellipse on the bottom edge) + dust puffs rolling sideways
    const dr = spr(FX.tex.ring, c, { tint: 0xf0dcb8, blend: NORMAL, y: by, s: 0.25, sy: 0.06, alpha: 0.9 });
    const dr2 = spr(FX.tex.ring, c, { tint: sup ? 0xffa040 : 0xe8c8ff, y: by, s: 0.2, sy: 0.05, alpha: 0.9 });
    tws.push(gsap.to(dr.scale, { x: 1.35, y: 0.3, duration: 0.5, ease: "power2.out" }), gsap.to(dr, { alpha: 0, duration: 0.5, ease: "power1.in" }));
    tws.push(gsap.to(dr2.scale, { x: 1.1, y: 0.22, duration: 0.35, ease: "power2.out" }), gsap.to(dr2, { alpha: 0, duration: 0.35 }));
    for (let i = 0; i < N(10); i++) {
      const s = i % 2 ? 1 : -1;
      P.emit({ tex: FX.tex.smoke, blend: NORMAL, x: s * rnd(10, 60), y: by + rnd(-8, 4), vx: s * rnd(160, 300), vy: rnd(-40, -10), drag: 3.5,
        s0: rnd(0.18, 0.26), s1: rnd(0.4, 0.55), life: rnd(0.5, 0.7), a0: 0.55, a1: 0, tint: 0xd9c4a0, vr: s * 0.8 });
    }
    // light cracks radiating across the cell (0.3 s)
    const cr = new PIXI.Graphics(); cr.blendMode = ADD; c.addChild(cr);
    const hw = 118, hh = CELL_H / 2 - 6;
    const cracks = [];
    const nc = 9;
    for (let i = 0; i < nc; i++) {
      const a = (i / nc) * TAU + rnd(-0.2, 0.2);
      const pts = [[Math.cos(a) * 18, Math.sin(a) * 18]];
      let x = pts[0][0], y = pts[0][1], ang = a;
      for (let k = 0; k < 6; k++) {
        ang += rnd(-0.45, 0.45); const L = rnd(16, 26);
        const nx = x + Math.cos(ang) * L, ny = y + Math.sin(ang) * L;
        if (Math.abs(nx) > hw || Math.abs(ny) > hh) break;
        x = nx; y = ny; pts.push([x, y]);
      }
      const branch = pts.length > 3 ? (() => { const [bx, by2] = pts[2], ba = a + (Math.random() < 0.5 ? 0.7 : -0.7);
        return [[bx, by2], [bx + Math.cos(ba) * 22, by2 + Math.sin(ba) * 22], [bx + Math.cos(ba + 0.3) * 38, by2 + Math.sin(ba + 0.3) * 38]]; })() : null;
      cracks.push(pts); if (branch) cracks.push(branch);
    }
    const cs = { k: 0, a: 1 };
    const tint = sup ? [0xff7a1a, 0xffd27a] : [0xb070ff, 0xf0d8ff];
    const draw = () => {
      cr.clear();
      for (const [w, col, al] of [[16, tint[0], 0.4], [7, tint[1], 0.9], [2.6, 0xffffff, 1]]) {
        cr.lineStyle({ width: w, color: col, alpha: al * cs.a, cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
        for (const pts of cracks) {
          const n = Math.max(1, Math.floor(cs.k * (pts.length - 1) + 1e-6));
          cr.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i <= n && i < pts.length; i++) cr.lineTo(pts[i][0], pts[i][1]);
        }
      }
    };
    tws.push(gsap.timeline({ onUpdate: draw }).to(cs, { k: 1, duration: 0.07, ease: "power2.out" }).to(cs, { a: 0, duration: 0.16, ease: "power1.in" }, "+=0.07"));
    // embers
    for (let i = 0; i < N(sup ? 16 : 10); i++) P.emit({ tex: FX.tex.dot, x: rnd(-100, 100), y: rnd(20, by), vx: rnd(-60, 60), vy: rnd(-320, -140), ay: 120, drag: 0.6,
      s0: rnd(0.12, 0.2), s1: 0.03, life: rnd(0.7, 1.1), a0: 1, a1: 0, twinkle: 18, tint: Math.random() < 0.5 ? 0xffa040 : 0xffe08a });
    // super_wild: a rising fire column (0.4 s)
    if (sup) {
      const col = new PIXI.Container(); col.y = by + 6; c.addChild(col);
      const gl = spr(FX.tex.glow, col, { tint: 0xff6a10, ay: 0.85, s: 0.9, sy: 0.1, alpha: 0.9 });
      const core = spr(FX.tex.ray, col, { tint: 0xffa030, ay: 1, s: 1.1, sy: 0.05, alpha: 1 });
      const hot = spr(FX.tex.ray, col, { tint: 0xfff0c0, ay: 1, s: 0.45, sy: 0.05, alpha: 1 });
      const strip = [];
      const nfl = MOBILE ? 3 : 5;
      for (let i = 0; i < nfl; i++) strip.push(spr(FX.tex.fireFrames ? FX.tex.fireFrames[(i * 3) % 16] : FX.tex.flame, col,
        { tint: i % 2 ? 0xff8a20 : 0xffc040, ay: 1, x: (i - (nfl - 1) / 2) * 30, s: 1.6, sy: 0.1, alpha: 0.95 }));
      const tl = gsap.timeline({ onComplete: () => col.destroy({ children: true }) });
      tl.to(gl.scale, { y: 2.6, duration: 0.12, ease: "power3.out" })
        .to([core.scale], { y: 0.48, duration: 0.12, ease: "power3.out" }, "<")
        .to([hot.scale], { y: 0.4, duration: 0.12, ease: "power3.out" }, "<")
        .to(strip.map((s) => s.scale), { y: 3.4, duration: 0.14, ease: "power3.out", stagger: 0.015 }, "<")
        .to(col.scale, { x: 0.55, duration: 0.28, ease: "power2.in" }, 0.12)
        .to([gl, core, hot, ...strip], { alpha: 0, duration: 0.22, ease: "power1.in" }, 0.18);
      tws.push(tl);
      let ff = 0;
      const ft = () => { ff++; strip.forEach((s, i) => { if (!s.destroyed && FX.tex.fireFrames) s.texture = FX.tex.fireFrames[(ff + i * 3) % 16]; }); };
      tws.push(gsap.to({}, { duration: 0.4, onUpdate: ft }));
      for (let i = 0; i < N(14); i++) P.emit({ frames: FX.tex.fireFrames, fps: 30, tex: FX.tex.flame, x: rnd(-40, 40), y: by, vx: rnd(-30, 30), vy: rnd(-900, -600), drag: 1.5,
        s0: rnd(1.0, 1.5), s1: 0.3, life: rnd(0.35, 0.5), a0: 0.9, a1: 0, tint: Math.random() < 0.5 ? 0xff7a1a : 0xffb030 });
    }
    tws.push(gsap.delayedCall(1.3, done));
  });
});
