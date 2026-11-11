// Fortune Bull 1000 - effect plugin: intro (see src/gx.js)
// GAME INTRO (introBegin/introDone), EXTRA-BET activation (ex) and IDLE LIFE (small ambient glints while idle).
// Everything is a non-interactive overlay that cleans up after itself; times are gsap (game) seconds.
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, FX, layers, app, S, MOBILE } = ctx;
  const ADD = PIXI.BLEND_MODES.ADD;
  const M = MOBILE ? 0.5 : 1;
  const n = (k) => Math.max(1, Math.round(k * M));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const GOLD = 0xffd060, WARM = 0xffa63a, PALE = 0xfff2c8, FIRE = 0xff7a20;
  const warn = (e) => console.warn("gx intro", e);
  const safe = (fn) => function () { try { return fn.apply(this, arguments); } catch (e) { warn(e); } };

  // geometry (board space): frame bar centre lines, lintel, multiplier coins
  const FR = { x0: 22, x1: 1058, y0: 594, y1: 1273 };
  const LIN = { cx: ctx.REEL_CX[1], by: 612, w: 716, h: 96 };
  const COL_X = ctx.COL_CX, coinY = (k) => ctx.COL_CY + (k - 3) * ctx.COL_P;   // white: 7 chips
  const BULL_K = 0.86, BULL_PY = 595;

  // layers: front overlay over everything (not inside the post-FX world), a back layer behind the bull, a board layer
  const top = new PIXI.Container(); top.eventMode = "none"; layers.fxTop.addChild(top);
  const back = new PIXI.Container(); back.eventMode = "none"; layers.bullL.addChildAt(back, 0);
  const boardTop = new PIXI.Container(); boardTop.eventMode = "none"; boardTop.name = "gxIntroBoard"; layers.board.addChild(boardTop);
  const P = new FX.Particles(top);
  const dustP = new FX.Particles(boardTop);
  const ticks = new Set();
  app.ticker.add(safe(() => {
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000) * gsap.globalTimeline.timeScale();
    P.update(dt); dustP.update(dt);
    ticks.forEach((f) => { try { f(dt); } catch (e) { ticks.delete(f); warn(e); } });
    idleWatch();
  }));

  // board / ui point -> overlay point (the board is scaled during the intro)
  const map = (from, x, y) => top.toLocal(from.toGlobal(new PIXI.Point(x, y)));
  const bp = (x, y) => map(layers.board, x, y);
  function spr(parent, tex, x, y, tint, sx, sy, a) {
    const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.position.set(x, y); s.tint = tint === undefined ? 0xffffff : tint;
    s.blendMode = ADD; s.scale.set(sx, sy === undefined ? sx : sy); s.alpha = a === undefined ? 1 : a; parent.addChild(s); return s;
  }
  function kill(o) {
    if (!o || o.destroyed) return;
    gsap.killTweensOf(o); if (o.scale) gsap.killTweensOf(o.scale);
    if (o.parent) o.parent.removeChild(o);
    o.destroy({ children: true });
  }
  // one-shot flash: grows and fades, then destroys itself
  function pulse(parent, tex, x, y, tint, s0, s1, a0, dur, ease) {
    const s = spr(parent, tex, x, y, tint, s0, s0, a0);
    gsap.to(s.scale, { x: s1, y: s1, duration: dur, ease: ease || "power2.out" });
    gsap.to(s, { alpha: 0, duration: dur, ease: "power1.in", onComplete: () => kill(s) });
    return s;
  }
  function star(parent, x, y, sc, tint, dur) {
    const st = spr(parent, FX.tex.star8, x, y, tint || 0xffffff, 0.05, 0.05, 1); st.rotation = Math.random() * 0.8;
    gsap.to(st.scale, { x: sc, y: sc, duration: dur * 0.4, ease: "back.out(2)", yoyo: true, repeat: 1 });
    gsap.to(st, { rotation: st.rotation + 0.9, duration: dur, ease: "none", onComplete: () => kill(st) });
    return st;
  }
  function sparks(x, y, k, tint, speed, grav, life) {
    for (let i = 0; i < k; i++) {
      const a = Math.random() * Math.PI * 2, v = (speed || 380) * rnd(0.45, 1);
      P.emit({ tex: Math.random() < 0.6 ? FX.tex.spark : FX.tex.dot, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: grav || 0, drag: 2.5,
        life: (life || 0.6) * rnd(0.6, 1.1), s0: rnd(0.18, 0.4), s1: 0, a0: 1, a1: 0, vr: 4, tint: Math.random() < 0.35 ? FIRE : tint });
    }
  }
  const lerp = (a, b, t) => a + (b - a) * t;
  const T = (p) => { try { return ctx.T(p); } catch (e) { return null; } };

  // ---------- debug / QA handle ----------
  const GXI = window.GXI = { t0: null, tex: null, tidle: null, app, log: [],
    exBtn: () => layers.uiL.children.find((c) => c.aura && c.body && Math.abs(c.x - 848) < 40 && c.y > 1400) };

  // =============================================================== INTRO
  let introRan = false;
  function restBullY() {
    const tw = gsap.getTweensOf(ctx.bull).find((t) => t.vars && typeof t.vars.y === "number");
    return tw ? tw.vars.y : ctx.bull.y;
  }
  // orbit ring of light round the bull as he rises: comet with a tapering tail, hidden behind him on the far side
  function orbit(restY) {
    const CX = 524.5, CY = 420, RX = MOBILE ? 330 : 360, RY = 74, TILT = -0.07;
    const gB = new PIXI.Graphics(), gF = new PIXI.Graphics(); gB.blendMode = gF.blendMode = ADD;
    back.addChild(gB); top.addChild(gF);
    const hB = spr(back, FX.tex.glow, 0, 0, GOLD, 0.5), hF = spr(top, FX.tex.glow, 0, 0, GOLD, 0.5);
    const cF = spr(top, FX.tex.star8, 0, 0, 0xffffff, 0.35);
    const st = { th: Math.PI * 0.62, tail: 0.15, a: 1, ring: 0 };
    const pt = (th, dy, grow) => {
      const ex = Math.cos(th) * RX * (1 + grow), ey = Math.sin(th) * RY * (1 + grow);
      return [CX + ex * Math.cos(TILT) - ey * Math.sin(TILT), CY + dy + ex * Math.sin(TILT) + ey * Math.cos(TILT)];
    };
    const f = (dt) => {
      const dy = (ctx.bull.y - restY) * BULL_K;
      gB.clear(); gF.clear();
      const N = 28;
      for (let i = 0; i < N; i++) {
        const u0 = i / N, u1 = (i + 1) / N, t0 = st.th - st.tail * (1 - u0), t1 = st.th - st.tail * (1 - u1);
        const g = Math.sin((t0 + t1) / 2) > 0 ? gF : gB, [x0, y0] = pt(t0, dy, 0), [x1, y1] = pt(t1, dy, 0);
        const k = u1 * u1 * st.a;
        g.lineStyle(36 * u1 + 6, WARM, 0.2 * k).moveTo(x0, y0).lineTo(x1, y1);
        g.lineStyle(13 * u1 + 3, GOLD, 0.6 * k).moveTo(x0, y0).lineTo(x1, y1);
        g.lineStyle(4.5 * u1 + 1.5, PALE, 1 * k).moveTo(x0, y0).lineTo(x1, y1);
      }
      if (st.ring > 0) {
        for (let i = 0; i < 64; i++) {
          const t0 = (i / 64) * Math.PI * 2, t1 = ((i + 1) / 64) * Math.PI * 2, g = Math.sin((t0 + t1) / 2) > 0 ? gF : gB;
          const [x0, y0] = pt(t0, dy, 0.12 * (1 - st.ring)), [x1, y1] = pt(t1, dy, 0.12 * (1 - st.ring));
          g.lineStyle(18, WARM, 0.18 * st.ring).moveTo(x0, y0).lineTo(x1, y1);
          g.lineStyle(4, PALE, 0.7 * st.ring).moveTo(x0, y0).lineTo(x1, y1);
        }
      }
      const [hx, hy] = pt(st.th, dy, 0), front = Math.sin(st.th) > 0;
      hF.position.set(hx, hy); hB.position.set(hx, hy); cF.position.set(hx, hy);
      hF.visible = cF.visible = front; hB.visible = !front;
      hF.alpha = hB.alpha = st.a; cF.alpha = st.a; cF.rotation += dt * 6;
      if (front && st.a > 0.3 && Math.random() < 0.7) P.emit({ tex: FX.tex.spark, x: hx, y: hy, vx: rnd(-60, 60), vy: rnd(-40, 80), ay: 260,
        life: rnd(0.3, 0.55), s0: rnd(0.2, 0.35), s1: 0, a0: 1, a1: 0, tint: Math.random() < 0.4 ? FIRE : GOLD });
    };
    ticks.add(f);
    const tl = gsap.timeline({ onComplete: () => { ticks.delete(f); [gB, gF, hB, hF, cF].forEach(kill); } });
    tl.to(st, { tail: 2.2, duration: 0.35, ease: "power2.out" }, 0);
    tl.to(st, { th: Math.PI * 0.62 + Math.PI * 2.15, duration: 0.85, ease: "power2.inOut" }, 0);
    tl.to(st, { tail: 0.05, duration: 0.3, ease: "power2.in" }, 0.6);
    tl.to(st, { ring: 1, duration: 0.08 }, 0.78);
    tl.to(st, { ring: 0, duration: 0.45, ease: "power2.out" }, 0.86);
    tl.to(st, { a: 0, duration: 0.25 }, 0.85);
    return tl;
  }

  // light strips race from the middle of each frame side to the corners; sparks burst where they meet
  function strips(dur) {
    const mx = (FR.x0 + FR.x1) / 2, my = (FR.y0 + FR.y1) / 2;
    const segs = [[mx, FR.y0, FR.x0, FR.y0], [mx, FR.y0, FR.x1, FR.y0], [mx, FR.y1, FR.x0, FR.y1], [mx, FR.y1, FR.x1, FR.y1],
      [FR.x0, my, FR.x0, FR.y0], [FR.x0, my, FR.x0, FR.y1], [FR.x1, my, FR.x1, FR.y0], [FR.x1, my, FR.x1, FR.y1]];
    const g = new PIXI.Graphics(); g.blendMode = ADD; top.addChild(g);
    const heads = segs.map(() => spr(top, FX.tex.glow, 0, 0, GOLD, 0.42));
    const st = { t: 0, a: 1 };
    const f = () => {
      g.clear();
      segs.forEach((s, i) => {
        const e = st.t, tail = Math.max(0, e - 0.55);
        const [ax, ay] = [lerp(s[0], s[2], tail), lerp(s[1], s[3], tail)], [hx, hy] = [lerp(s[0], s[2], e), lerp(s[1], s[3], e)];
        const A = bp(ax, ay), H = bp(hx, hy);
        g.lineStyle(20, WARM, 0.2 * st.a).moveTo(A.x, A.y).lineTo(H.x, H.y);
        g.lineStyle(7, GOLD, 0.6 * st.a).moveTo(A.x, A.y).lineTo(H.x, H.y);
        g.lineStyle(2.5, PALE, st.a).moveTo(A.x, A.y).lineTo(H.x, H.y);
        heads[i].position.set(H.x, H.y); heads[i].alpha = st.a * (st.t < 1 ? 1 : 0);
        if (st.t < 1 && Math.random() < 0.35 * M) P.emit({ tex: FX.tex.spark, x: H.x, y: H.y, vx: rnd(-40, 40), vy: rnd(-40, 40), life: 0.3, s0: 0.25, s1: 0, a0: 1, a1: 0, tint: GOLD });
      });
    };
    ticks.add(f);
    const tl = gsap.timeline({ onComplete: () => { ticks.delete(f); kill(g); heads.forEach(kill); } });
    tl.to(st, { t: 1, duration: dur, ease: "power2.in" });
    tl.add(() => corners(), dur);
    tl.to(st, { a: 0, duration: 0.4, ease: "power1.in" }, dur + 0.05);
    return tl;
  }
  function corners() {
    [[FR.x0, FR.y0], [FR.x1, FR.y0], [FR.x0, FR.y1], [FR.x1, FR.y1]].forEach(([x, y]) => {
      const q = bp(x, y);
      pulse(top, FX.tex.glow, q.x, q.y, WARM, 0.4, 1.3, 0.9, 0.45);
      star(top, q.x, q.y, 0.75, PALE, 0.5);
      sparks(q.x, q.y, n(16), GOLD, 520, 700, 0.75);
    });
  }

  // shine across the title lintel, masked by its own art
  let lintelTex = null;
  function lintelShine(dur, alpha, glowA) {
    if (!ctx.GPASS) return null;
    if (ctx.TITLE === false) return null;                 // the title lintel was removed from the stone pass (2026-11-11)
    lintelTex = lintelTex || T("Board/title_bar");
    if (!lintelTex) return null;
    // ADD copies of the lintel art seen through moving slanted bands (stencil masks): the gold flares along its own relief
    // lives in the overlay (stencil masks fail inside the post-FX world), following the board's transform
    const c = new PIXI.Container(); top.addChild(c);
    const follow = () => { if (!c.destroyed) c.transform.setFromMatrix(top.worldTransform.clone().invert().append(layers.board.worldTransform)); };
    follow(); ticks.add(follow);
    // slanted light band clipped to the lintel plaque (a near-rectangular plate: scissor clip)
    const x0 = LIN.cx - LIN.w / 2 - 140;
    const clip = new PIXI.Graphics().beginFill(0xffffff).drawRect(LIN.cx - LIN.w / 2 + 6, LIN.by - LIN.h + 8, LIN.w - 12, LIN.h - 12).endFill();
    const sh = new PIXI.Container(); sh.position.set(x0, LIN.by - LIN.h / 2 + 2); sh.rotation = 0.38; sh.mask = clip;
    c.addChild(sh, clip);
    const lift = spr(sh, FX.tex.shine, 0, 0, 0xfff6e0, 0.7, 6, alpha * 0.45); lift.blendMode = PIXI.BLEND_MODES.NORMAL;
    spr(sh, FX.tex.shine, 0, 0, WARM, 1.4, 6, alpha * 0.6);
    spr(sh, FX.tex.shine, 0, 0, 0xffffff, 0.6, 6, alpha);
    spr(sh, FX.tex.shine, 0, 0, 0xffffff, 0.25, 6, alpha);
    spr(sh, FX.tex.shine, 56, 0, PALE, 0.2, 6, alpha * 0.8);
    const move = () => {};
    let gl = null;
    if (glowA) {
      gl = new PIXI.Sprite(lintelTex); gl.anchor.set(0.5, 1); gl.position.set(LIN.cx, LIN.by); gl.blendMode = ADD; gl.tint = WARM; gl.alpha = 0;
      c.addChildAt(gl, 0);
      gsap.to(gl, { alpha: glowA, duration: dur * 0.3, yoyo: true, repeat: 1, ease: "sine.inOut" });
    }
    const tl = gsap.timeline({ onComplete: () => { ticks.delete(follow); kill(c); } });
    tl.to(sh, { x: LIN.cx + LIN.w / 2 + 140, duration: dur, ease: "power1.inOut", onUpdate: move });
    c.stopFx = () => { tl.kill(); gsap.to(c, { alpha: 0, duration: 0.15, onComplete: () => { ticks.delete(follow); kill(c); } }); };
    return c;
  }

  // one multiplier coin lights up: glow, ring, glint
  function coinLight(k, tint, big) {
    const q = bp(COL_X, coinY(k));
    pulse(top, FX.tex.glow, q.x, q.y, tint || GOLD, 0.35, big ? 0.95 : 0.7, 0.85, 0.45);
    pulse(top, FX.tex.ring, q.x, q.y, tint || GOLD, 0.28, big ? 0.85 : 0.62, 0.9, 0.4);
    if (big || !MOBILE) star(top, q.x - 20, q.y - 22, big ? 0.6 : 0.38, PALE, 0.4);
  }

  function intro() {
    if (introRan) return; introRan = true;
    GXI.t0 = gsap.globalTimeline.time();
    const restY = restBullY();
    const tl = gsap.timeline();
    tl.add(() => orbit(restY), 0.2);
    tl.add(() => strips(0.42), 0.52);
    for (let k = 0; k < 7; k++) tl.add(() => coinLight(k), 0.62 + k * 0.1);
  }
  function introDone() {
    if (GXI.t0 === null) return;
    const q = bp(COL_X, ctx.COL_CY);
    pulse(top, FX.tex.glow, q.x, q.y, WARM, 0.6, 1.9, 0.95, 0.6);
    pulse(top, FX.tex.ring, q.x, q.y, GOLD, 0.35, 1.5, 1, 0.55);
    star(top, q.x, q.y, 1.1, PALE, 0.55);
    sparks(q.x, q.y, n(14), GOLD, 420, 300, 0.6);
    gsap.delayedCall(0.08, safe(() => lintelShine(0.65, 0.95, 0.4)));
  }
  GX.on("introBegin", intro);
  GX.on("introDone", introDone);
  // ?autostart runs the intro before the plugins start: catch up if it is already under way
  if (S.state === "boot" && gsap.getTweensOf(layers.bgL).length) intro();

  // =============================================================== EXTRA BET
  let exGroup = null;
  function exClear() { if (exGroup) { exGroup.tl.kill(); exGroup.objs.forEach(kill); ticks.delete(exGroup.tick); exGroup = null; } }
  function exOn(d) {
    exClear();
    GXI.tex = gsap.globalTimeline.time();
    const objs = [], btn = map(layers.uiL, d.x, d.y), tl = gsap.timeline({ onComplete: () => exClear() });
    const comets = [];
    const own = (o) => { objs.push(o); return o; };
    // charge: sparks pulled into the button, then the burst
    for (let i = 0; i < n(14); i++) {
      const a = Math.random() * Math.PI * 2, r = rnd(90, 150);
      P.emit({ tex: FX.tex.spark, x: btn.x + Math.cos(a) * r, y: btn.y + Math.sin(a) * r, vx: -Math.cos(a) * r * 7, vy: -Math.sin(a) * r * 7,
        life: 0.13, s0: 0.15, s1: 0.4, a0: 0.3, a1: 1, tint: GOLD });
    }
    const charge = own(spr(top, FX.tex.glow, btn.x, btn.y, GOLD, 0.3, 0.3, 0.5));
    tl.to(charge.scale, { x: 0.75, y: 0.75, duration: 0.12, ease: "power2.in" }, 0);
    tl.to(charge, { alpha: 1, duration: 0.12 }, 0);
    tl.add(() => {
      pulse(top, FX.tex.ring, btn.x, btn.y, GOLD, 0.3, 1.25, 1, 0.4);
      pulse(top, FX.tex.glow, btn.x, btn.y, PALE, 0.6, 1.4, 0.9, 0.35);
      star(top, btn.x, btn.y, 0.9, PALE, 0.4);
      sparks(btn.x, btn.y, n(18), GOLD, 520, 400, 0.55);
    }, 0.12);
    tl.to(charge, { alpha: 0, duration: 0.25 }, 0.12);
    // comets in arcs from the button up to the multiplier coins
    const ks = MOBILE ? [0, 3, 6] : [0, 1, 2, 3, 4, 5, 6];
    ks.forEach((k, i) => {
      const to = bp(COL_X, coinY(k)), side = i % 2 ? -1 : 1;
      const c1 = { x: btn.x + side * rnd(170, 250) + 60, y: (btn.y + to.y) / 2 + rnd(40, 120) };
      const cm = { p: 0, x: btn.x, y: btn.y, head: own(spr(top, FX.tex.glow, btn.x, btn.y, GOLD, 0.45)), core: own(spr(top, FX.tex.star8, btn.x, btn.y, 0xffffff, 0.22)), hist: [] };
      cm.head.alpha = cm.core.alpha = 0;
      comets.push(cm);
      const t0 = 0.14 + i * 0.05, dur = 0.34 + i * 0.03;
      tl.set([cm.head, cm.core], { alpha: 1 }, t0);
      tl.to(cm, { p: 1, duration: dur, ease: "power2.in", onUpdate: () => {
        const q = FX.bezier(btn, c1, to, cm.p); cm.x = q.x; cm.y = q.y;
      } }, t0);
      tl.add(() => { cm.head.alpha = cm.core.alpha = 0; cm.done = true; coinLight(k, GOLD, k === 3); }, t0 + dur);
    });
    const g = own(new PIXI.Graphics()); g.blendMode = ADD; top.addChild(g);
    const tick = (dt) => {
      g.clear();
      comets.forEach((cm) => {
        if (cm.p > 0 && !cm.done) { cm.hist.push([cm.x, cm.y]); if (cm.hist.length > 12) cm.hist.shift(); }
        else if (cm.done && cm.hist.length) cm.hist.shift();
        cm.head.position.set(cm.x, cm.y); cm.core.position.set(cm.x, cm.y); cm.core.rotation += dt * 8;
        const h = cm.hist;
        for (let j = 1; j < h.length; j++) {
          const u = j / h.length;
          g.lineStyle(24 * u, WARM, 0.25 * u).moveTo(h[j - 1][0], h[j - 1][1]).lineTo(h[j][0], h[j][1]);
          g.lineStyle(7 * u, PALE, 0.95 * u).moveTo(h[j - 1][0], h[j - 1][1]).lineTo(h[j][0], h[j][1]);
        }
        if (cm.p > 0 && !cm.done && Math.random() < 0.6 * M + 0.2) P.emit({ tex: FX.tex.spark, x: cm.x, y: cm.y, vx: rnd(-50, 50), vy: rnd(-50, 50),
          life: 0.3, s0: 0.25, s1: 0, a0: 1, a1: 0, tint: Math.random() < 0.3 ? FIRE : GOLD });
      });
    };
    ticks.add(tick);
    // column flash, centre ring, double frame flash, EXTRA BET pop
    const tray = ctx.TRAY, colT = 0.55;
    tl.add(() => {
      const q = bp(COL_X, ctx.COL_CY);
      const band = spr(boardTop, FX.tex.glow, COL_X, (tray[1] + tray[3]) / 2, GOLD, 1.25, 3.6, 0);
      own(band);
      gsap.to(band, { alpha: 0.85, duration: 0.07, yoyo: true, repeat: 1, repeatDelay: 0.05, ease: "power1.out" });
      pulse(top, FX.tex.ring, q.x, q.y, PALE, 0.4, 1.7, 1, 0.5);
      pulse(top, FX.tex.glow, q.x, q.y, WARM, 0.7, 1.6, 0.9, 0.45);
    }, colT);
    const frameTex = T(ctx.GPASS ? "Board/frame_stone" : "Board/frame");
    if (frameTex) {
      const fl = own(new PIXI.Sprite(frameTex)); fl.position.set(0, 585); fl.blendMode = ADD; fl.tint = 0xffc860; fl.alpha = 0; boardTop.addChild(fl);
      [colT, colT + 0.25].forEach((t, i) => {
        tl.to(fl, { alpha: i ? 0.55 : 0.8, duration: 0.05, ease: "power1.out" }, t);
        tl.to(fl, { alpha: 0, duration: 0.18, ease: "power1.in" }, t + 0.05);
      });
    }
    const txt = own(new PIXI.Text("EXTRA BET", FX.gold(54)));
    const tx = Math.min(COL_X - 4, 1066 - txt.width / 2); txt.anchor.set(0.5); txt.position.set(tx, 566); txt.scale.set(0.3); txt.alpha = 0; boardTop.addChild(txt);
    const tg = own(spr(boardTop, FX.tex.glow, tx, 566, WARM, 1.4, 0.5, 0));
    tl.to(txt, { alpha: 1, duration: 0.08 }, colT - 0.05);
    tl.to(txt.scale, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.6)" }, colT - 0.05);
    tl.to(tg, { alpha: 0.7, duration: 0.1, yoyo: true, repeat: 1, repeatDelay: 0.1 }, colT - 0.05);
    tl.to(txt, { alpha: 0, y: 546, duration: 0.25, ease: "power1.in" }, 0.95);
    exGroup = { tl, objs, tick };
  }
  function exOff(d) {
    exClear();
    GXI.tex = gsap.globalTimeline.time();
    const btn = map(layers.uiL, d.x, d.y), objs = [];
    const r = spr(top, FX.tex.ring, btn.x, btn.y, GOLD, 1.0, 1.0, 0.55); objs.push(r);
    const tray = ctx.TRAY;
    const dim = new PIXI.Graphics().beginFill(0x12040a, 1).drawRoundedRect(tray[0], tray[1], tray[2] - tray[0], tray[3] - tray[1], 30).endFill();
    dim.alpha = 0; boardTop.addChild(dim); objs.push(dim);
    const tl = gsap.timeline({ onComplete: () => exClear() });
    tl.to(r.scale, { x: 0.2, y: 0.2, duration: 0.3, ease: "power2.in" }, 0);
    tl.to(r, { alpha: 0, duration: 0.3, ease: "power2.in" }, 0);
    tl.to(dim, { alpha: 0.3, duration: 0.1 }, 0.05);
    tl.to(dim, { alpha: 0, duration: 0.3, ease: "power1.out" }, 0.17);
    exGroup = { tl, objs, tick: null };
  }
  GX.on("ex", (d) => { if (d && d.on) exOn(d); else exOff(d || { x: 848, y: 1540 }); });

  // =============================================================== IDLE LIFE
  let idleCur = null, idleCall = null, idleOn = true;
  const HIGH = ctx.HIGH || new Set(["hourglass", "sun", "chest"]);
  function idleDone() { idleCur = null; }
  function idleWatch() {
    if (idleCur && S.state !== "idle") { const c = idleCur; idleCur = null; c.stop(); }
  }
  const IDLE = {
    lintel() {
      const c = lintelShine(1.1, 0.7, 0.18);
      if (!c) return null;
      const d = gsap.delayedCall(1.15, idleDone);
      return { stop: () => { d.kill(); c.stopFx(); } };
    },
    coin() {
      const k = Math.floor(Math.random() * 7), x = COL_X - 22 + rnd(-6, 6), y = coinY(k) - 24;
      const gl = spr(boardTop, FX.tex.glow, COL_X, coinY(k), GOLD, 0.45, 0.45, 0);
      const st = star(boardTop, x, y, MOBILE ? 0.62 : 0.78, PALE, 0.75);
      gsap.to(gl, { alpha: 0.6, duration: 0.3, yoyo: true, repeat: 1, ease: "sine.inOut", onComplete: () => { kill(gl); idleDone(); } });
      return { stop: () => { kill(gl); kill(st); } };
    },
    symbol() {
      const c = [];
      (ctx.reels || []).forEach((rl) => (rl.views || []).forEach((v) => {
        if (!v || !v.c || !v.c.visible || !v.id) return;
        if (v.c.y < ctx.CELL_Y0 || v.c.y > ctx.WIN_Y1) return;
        if (HIGH.has(v.id) || /wild/.test(v.id)) c.push(v);
      }));
      if (!c.length) return null;
      const v = c[Math.floor(Math.random() * c.length)];
      const p = layers.board.toLocal(v.c.getGlobalPosition());
      const gl = spr(boardTop, FX.tex.glow, p.x, p.y, GOLD, 1.0, 1.0, 0);
      const st = star(boardTop, p.x + rnd(-70, -40), p.y + rnd(-75, -45), 0.55, PALE, 0.75);
      const st2 = gsap.delayedCall(0.22, safe(() => { if (idleCur) star(boardTop, p.x + rnd(40, 70), p.y + rnd(30, 60), 0.3, PALE, 0.5); }));
      gsap.to(gl, { alpha: 0.28, duration: 0.35, yoyo: true, repeat: 1, ease: "sine.inOut", onComplete: () => { kill(gl); idleDone(); } });
      return { stop: () => { st2.kill(); kill(gl); kill(st); } };
    },
    dust() {
      let on = true;
      const f = () => {
        if (!on) return;
        if (Math.random() < 0.55) dustP.emit({ tex: Math.random() < 0.5 ? FX.tex.flake : FX.tex.spark, x: rnd(40, 1040), y: rnd(530, 690),
          vx: rnd(14, 40), vy: rnd(-22, 6), ay: 4, life: rnd(1.8, 2.8), s0: rnd(0.35, 0.7), s1: 0.1, a0: 1, a1: 0, fadeIn: 0.5,
          twinkle: 7, vr: rnd(-1, 1), blend: Math.random() < 0.5 ? ADD : PIXI.BLEND_MODES.NORMAL, tint: Math.random() < 0.5 ? 0xffffff : GOLD });
      };
      ticks.add(f);
      const d = gsap.delayedCall(2.4, () => { on = false; ticks.delete(f); });
      const e = gsap.delayedCall(4.6, idleDone);
      return { stop: () => { on = false; ticks.delete(f); d.kill(); e.kill(); gsap.to(dustP.c, { alpha: 0, duration: 0.2, onComplete: () => { dustP.clear(); dustP.c.alpha = 1; } }); } };
    },
  };
  function runIdle(kind) {
    if (idleCur) { const c = idleCur; idleCur = null; c.stop(); }
    GXI.tidle = gsap.globalTimeline.time(); GXI.log.push(kind);
    const r = IDLE[kind] ? IDLE[kind]() : null;
    idleCur = r; return !!r;
  }
  function idleTick() {
    idleCall = gsap.delayedCall(MOBILE ? rnd(12, 18) : rnd(5, 8), safe(idleTick));
    if (!idleOn || idleCur || S.state !== "idle" || layers.boardL.alpha < 0.99 || document.hidden) return;
    const kinds = (MOBILE ? ["lintel", "coin", "symbol"] : ["lintel", "coin", "symbol", "dust"]).filter((k) => k !== "lintel" || ctx.TITLE !== false);
    const order = kinds.sort(() => Math.random() - 0.5);
    for (const k of order) if (runIdle(k)) return;
  }
  idleCall = gsap.delayedCall(MOBILE ? 10 : 6, safe(idleTick));
  GXI.idle = (k) => runIdle(k);
  GXI.busy = () => !!idleCur;
  GXI.stopIdle = () => { idleOn = false; if (idleCur) { const c = idleCur; idleCur = null; c.stop(); } };
  GXI.startIdle = () => { idleOn = true; if (idleCall) idleCall.kill(); idleCall = gsap.delayedCall(1, safe(idleTick)); };
});
