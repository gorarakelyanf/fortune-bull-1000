// Fortune Bull 1000 - effect plugin: HALO WHEEL (see src/gx.js). On throws of 100x and up (HALO_MIN in game.js) the game
// awaits GX.run("halo", {mult, tint}) before the bull's throw:
//   0.00 a gold sun-halo (an oval round his head) opens behind the bull, rays turning behind it
//   0.10 seven multiplier coins fly out of the column into slots round the halo
//   0.85 a fire beam rises from a super wild on the board (else from the column) into the halo
//   1.00 the wheel whips round (~2.5 turns) and slows over 2.3 s; the coin under the top pointer is lit, the rest dim
//   ~3.2 it stops on the round's multiplier: the coin pops out with rays, the rest fade, the halo closes
//   ~3.7 the coin flies into the bull's raised hand; the throw then plays with that value already landed (gx_picker)
// Presentation only: it always lands on the multiplier the engine already picked. Turbo runs it ~2.2x faster.
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, FX, layers, MOBILE } = ctx;
  const ADD = PIXI.BLEND_MODES.ADD, M = MOBILE ? 0.5 : 1;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const live = (o) => o && !o.destroyed;
  const kill = (o) => { try { if (live(o)) { gsap.killTweensOf(o); if (o.scale) gsap.killTweensOf(o.scale); o.destroy({ children: true }); } } catch (e) {} };
  const sfx = (n, a) => { try { if (ctx.SFX && ctx.SFX[n]) ctx.SFX[n](a); } catch (e) {} };
  const sp = (tex, parent) => { const s = new PIXI.Sprite(tex || PIXI.Texture.EMPTY); s.anchor.set(0.5); if (parent) parent.addChild(s); return s; };
  const KNOWN = new Set(ctx.Engine.MULT_VALUES);
  const faceTex = (v) => (ctx.GPASS && PIXI.Assets.get(`assets/Multipliers/coin_${v}.webp`)) || ctx.T(`Multipliers/chip_bg_${v}`);
  const labelTex = (v) => ctx.T(`Multipliers/label_${v}x`);
  const nearest = (v) => ctx.Engine.MULT_VALUES.filter((x) => x <= v).pop() || 1;

  // the halo ring: a thick polished-gold band with beads, a hot inner edge and a soft prismatic outer rim (canvas, once)
  const ringTex = (() => {
    const S = 640, c = document.createElement("canvas"); c.width = c.height = S; const g = c.getContext("2d"), C = S / 2;
    const rim = g.createRadialGradient(C, C, 230, C, C, 318);
    [[0, "rgba(255,90,160,0)"], [0.45, "rgba(255,120,190,0.35)"], [0.6, "rgba(120,255,200,0.30)"], [0.75, "rgba(255,240,120,0.32)"], [1, "rgba(255,200,80,0)"]]
      .forEach(([k, col]) => rim.addColorStop(k, col));
    g.fillStyle = rim; g.beginPath(); g.arc(C, C, 318, 0, Math.PI * 2); g.fill();
    const band = g.createLinearGradient(0, C - 280, 0, C + 280);
    band.addColorStop(0, "#fff3c0"); band.addColorStop(0.3, "#f4b440"); band.addColorStop(0.55, "#a85e10"); band.addColorStop(0.8, "#f8c860"); band.addColorStop(1, "#fff0b0");
    g.lineWidth = 36; g.strokeStyle = "#2a0e02"; g.beginPath(); g.arc(C, C, 262, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 30; g.strokeStyle = band; g.beginPath(); g.arc(C, C, 262, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 2; g.strokeStyle = "rgba(255,250,220,0.9)"; g.beginPath(); g.arc(C, C, 255, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 48; i++) {                            // beads round the band
      const a = (i / 48) * Math.PI * 2, x = C + Math.cos(a) * 262, y = C + Math.sin(a) * 262;
      const bg = g.createRadialGradient(x - 1.5, y - 1.5, 0, x, y, 5); bg.addColorStop(0, "#fffbe0"); bg.addColorStop(1, "#b06a10");
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, 4.2, 0, Math.PI * 2); g.fill();
    }
    const inner = g.createRadialGradient(C, C, 150, C, C, 252);
    inner.addColorStop(0, "rgba(255,200,90,0)"); inner.addColorStop(0.8, "rgba(255,190,80,0.10)"); inner.addColorStop(1, "rgba(255,230,150,0.45)");
    g.fillStyle = inner; g.beginPath(); g.arc(C, C, 252, 0, Math.PI * 2); g.fill();
    return PIXI.Texture.from(c);
  })();

  // the bull's head and raised hand, in layer (design) space
  const headPos = () => { const q = ctx.bullToL(552, 175); return { x: q[0], y: q[1] }; };
  function handPos() {
    const f = ctx.flame;
    if (f && f.gx != null) return { x: f.gx, y: f.gy - 70 };
    try {
      const h = ctx.handNow(), clips = (window.G && window.G.clips) || {};
      const cfg = (clips.bull_idle || clips.bull_big || { cfg: { x: 162, y: -116.9, w: 725 } }).cfg, sc = cfg.w / 720, b = ctx.bull;
      const gx = cfg.x + h.x * sc, gy = cfg.y + h.y * sc;
      const q = ctx.bullToL(b.x + (gx - b.x) * b.scale.x, b.y + (gy - b.y) * b.scale.y);
      return { x: q[0], y: q[1] - 70 };
    } catch (e) { return { x: 300, y: 330 }; }
  }
  // the beam's source: a super wild on the board, else the centre of the multiplier column
  function beamSource() {
    try {
      for (let reel = 0; reel < ctx.reels.length; reel++) for (let row = 0; row < 3; row++) {
        const v = ctx.reels[reel].view(row);
        if (v && v.id === "super_wild") return { x: ctx.REEL_CX[reel], y: ctx.rowY(row), wild: true };
      }
    } catch (e) {}
    return { x: ctx.COL_CX, y: ctx.COL_CY, wild: false };
  }
  // seven slot values: the winner once, the rest from the top of the strip (shuffled)
  function slotValues(win) {
    const pool = [1000, 500, 100, 100, 50, 25, 20].filter((v) => KNOWN.has(v));
    const vals = pool.slice(0, 6); vals.push(win);
    for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
    return vals;
  }
  function makeCoin(v, parent) {
    const c = new PIXI.Container(); parent.addChild(c);
    const glow = sp(FX.tex.glow, c); glow.blendMode = ADD; glow.tint = 0xffd070; glow.alpha = 0; glow.scale.set(1.25);
    const face = sp(faceTex(KNOWN.has(v) ? v : nearest(v)), c);
    const rimT = ctx.GPASS && PIXI.Assets.get("assets/Multipliers/coin_rim.webp"); if (rimT) sp(rimT, face);   // thin gold rim, like the column
    if (KNOWN.has(v)) { const l = sp(labelTex(v), c); if (ctx.GPASS) l.scale.set(0.85); }
    else { const t = new PIXI.Text(v + "x", FX.gold(60)); t.anchor.set(0.5); c.addChild(t); }
    const dim = sp(faceTex(KNOWN.has(v) ? v : nearest(v)), c); dim.tint = 0x000000; dim.alpha = 0;   // darkening layer when unlit
    c.glow = glow; c.face = face; c.dimL = dim; c.v = v;
    return c;
  }

  // debug probe for QA
  let probe = null; window.GX_HALO = () => probe;

  GX.on("halo", (d) => new Promise((resolve) => {
    const objs = [], tws = [];
    let done = false;
    const finish = () => { if (done) return; done = true; probe = null; tws.forEach((t) => { try { t.kill(); } catch (e) {} }); objs.forEach(kill); resolve(); };
    try {
      const win = +d.mult || 100, tint = d.tint || 0xffd070, turbo = !!ctx.S.turbo;
      const H = headPos(), RX = 232, RY = 188, CX = H.x, CY = Math.max(H.y + 62, 46 + RY);   // an oval round the head, inside the screen top
      const vals = slotValues(win), winIdx = vals.indexOf(win), N = vals.length;
      probe = { phase: "open", lit: -1, win, vals };

      // behind the bull: rays + halo ring
      const back = new PIXI.Container(); back.position.set(CX, CY); back.scale.set(0.2); back.alpha = 0;
      layers.bullL.addChildAt(back, 0); objs.push(back);
      const rays = sp(FX.tex.burst, back); rays.blendMode = ADD; rays.tint = 0xffb040; rays.alpha = 0.3; rays.scale.set(2.2);
      // the volumetric backlight (gx_rays) lights the halo instead of the spoke burst; released when the halo closes
      if (window.GXRays) { rays.visible = false; const rel = window.GXRays.hold(0.85); tws.push({ kill: rel }); }
      const haze = sp(FX.tex.glow, back); haze.blendMode = ADD; haze.tint = 0xff9a30; haze.alpha = 0.18; haze.scale.set(3.6);
      const ring = sp(ringTex, back); ring.scale.set(RX / 262, RY / 262);
      // in front: the coins, the selector glow, the beam
      const front = new PIXI.Container(); layers.fxTop.addChild(front); objs.push(front);
      const coins = vals.map((v, i) => { const c = makeCoin(v, front); c.ang = -Math.PI / 2 + (i / N) * Math.PI * 2; c.scale.set(0); c.position.set(ctx.COL_CX, ctx.COL_CY); return c; });
      // the wheel turns: steadily while it fills, then a fast whip that slows to rest with the winner at the top pointer
      const rot = { v: 0 };
      const slot = (c) => ({ x: CX + Math.cos(c.ang + rot.v) * RX, y: CY + Math.sin(c.ang + rot.v) * RY });
      const pointer = new PIXI.Graphics().beginFill(0x2a0e02).drawPolygon([-20, -6, 20, -6, 0, 26]).endFill()
        .beginFill(0xffd36b).lineStyle(2, 0x7a4a10).drawPolygon([-14, -2, 14, -2, 0, 19]).endFill();
      pointer.position.set(CX, CY - RY - 58); pointer.alpha = 0; front.addChild(pointer);
      let litIdx = -1, selecting = false;
      const P = new FX.Particles(front);
      const tick = () => {
        rays.rotation += 0.004 * gsap.ticker.deltaRatio();
        coins.forEach((c) => { if (c.seated) { const p = slot(c); c.position.set(p.x, p.y); } });
        if (selecting) {                                   // the coin passing under the pointer is lit
          let best = -1, bd = 9;
          coins.forEach((c, i) => { const a = Math.atan2(Math.sin(c.ang + rot.v + Math.PI / 2), Math.cos(c.ang + rot.v + Math.PI / 2)); if (Math.abs(a) < bd) { bd = Math.abs(a); best = i; } });
          if (best !== litIdx) { litIdx = best; light(best); }
        }
        P.update(Math.min(0.05, gsap.ticker.deltaRatio() / 60));
      };
      gsap.ticker.add(tick); tws.push({ kill: () => gsap.ticker.remove(tick) });

      const tl = gsap.timeline({ onComplete: finish }); tws.push(tl);
      tl.timeScale(turbo ? 2.2 : 1);
      // open the halo
      tl.to(back, { alpha: 1, duration: 0.2 }, 0).to(back.scale, { x: 1, y: 1, duration: 0.45, ease: "back.out(1.5)" }, 0)
        .call(() => { sfx("rise", 0.6); ctx.flashAt(CX, CY, 0xffd27a, 1.2, 0.25); ctx.ringAt(CX, CY, 0xffe08a, 3.2, 0.45); }, null, 0.05);
      // coins fly out of the column to their slots
      coins.forEach((c, i) => {
        const t0 = 0.1 + i * 0.07;
        tl.call(() => {
          const from = { x: ctx.COL_CX, y: ctx.COL_CY }, to = slot(c), mid = { x: (from.x + to.x) / 2 + rnd(-80, 80), y: Math.min(from.y, to.y) - 160 };
          const pr = { t: 0 };
          gsap.to(c.scale, { x: 0.72, y: 0.72, duration: 0.3, ease: "back.out(2)" });
          tws.push(gsap.to(pr, { t: 1, duration: 0.45, ease: "power2.inOut", onUpdate: () => {
            const q = FX.bezier(from, mid, slot(c), pr.t); c.position.set(q.x, q.y);
            if (Math.random() < 0.6 * M + 0.2) P.emit({ tex: FX.tex.dot, x: q.x, y: q.y, s0: 0.35, s1: 0, life: 0.3, tint: 0xffd060, blend: ADD });
          }, onComplete: () => { c.seated = true; ctx.ringAt(c.x, c.y, 0xffe08a, 0.7, 0.2); sfx("tick"); } }));
        }, null, t0);
      });
      // the beam from the board up into the halo
      tl.call(() => {
        const s = beamSource(), dx = CX - s.x, dy = CY - s.y, L = Math.hypot(dx, dy);
        const beam = new PIXI.Container(); beam.position.set(s.x, s.y); beam.rotation = Math.atan2(dy, dx) - Math.PI / 2; front.addChildAt(beam, 0);
        const outer = sp(FX.tex.glow, beam); outer.anchor.set(0.5, 0); outer.blendMode = ADD; outer.tint = 0xff7a20; outer.scale.set(0.9, L / 256); outer.alpha = 0;
        const core = sp(FX.tex.glow, beam); core.anchor.set(0.5, 0); core.blendMode = ADD; core.tint = 0xfff2c0; core.scale.set(0.32, L / 256); core.alpha = 0;
        gsap.timeline().to([outer, core], { alpha: 1, duration: 0.08 }).to([outer, core], { alpha: 0, duration: 0.45, delay: 0.15, ease: "power2.in" });
        gsap.fromTo(beam.scale, { x: 0.3 }, { x: 1.2, duration: 0.12, ease: "power3.out" });
        ctx.flashAt(s.x, s.y, s.wild ? 0xff8a30 : 0xffd060, 1.8, 0.3); ctx.burstAt(s.x, s.y, 0xffa040, Math.round(18 * M));
        ctx.flashAt(CX, CY, 0xfff0c0, 1.1, 0.2); ctx.shake(7, 0.2); sfx("impact", false);
        for (let i = 0; i < 26 * M; i++) {
          const f = rnd(0, 1); P.emit({ tex: FX.tex.dot, x: s.x + dx * f + rnd(-20, 20), y: s.y + dy * f, vx: rnd(-80, 80), vy: rnd(-300, -60), s0: rnd(0.25, 0.45), s1: 0, life: rnd(0.3, 0.6), tint: Math.random() < 0.5 ? 0xffd27a : 0xff7a20, blend: ADD });
        }
      }, null, 0.85);
      const light = (idx) => {
        coins.forEach((c, i) => {
          const on = i === idx;
          gsap.to(c.dimL, { alpha: on ? 0 : 0.42, duration: 0.06 });
          gsap.to(c.glow, { alpha: on ? 0.95 : 0, duration: 0.06 });
          gsap.to(c.scale, { x: on ? 0.9 : 0.68, y: on ? 0.9 : 0.68, duration: 0.08, ease: "power2.out" });
        });
        if (probe) probe.lit = idx;
        sfx("tick");
      };
      // rotation: 1.5 rad/s while the coins arrive, then a whip of ~2.5 turns slowing over 2.3 s onto the winner at the top
      const TAU = Math.PI * 2, s0 = 1.5, want = -(winIdx / N) * TAU;       // winner at the top when rot = -i/N turns
      let sEnd = want; while (sEnd < s0 + 2.5 * TAU) sEnd += TAU;
      const t = 1.0 + 2.3;
      tl.to(rot, { v: s0, duration: 1.0, ease: "none" }, 0)
        .call(() => { selecting = true; if (probe) probe.phase = "select"; gsap.to(pointer, { alpha: 1, duration: 0.15 }); }, null, 1.0)
        .to(rot, { v: sEnd, duration: 2.3, ease: "power3.out" }, 1.0)
        .call(() => { selecting = false; if (litIdx !== winIdx) { litIdx = winIdx; light(winIdx); } }, null, t)
        .to(pointer, { alpha: 0, duration: 0.3 }, t + 0.45);
      // land on the winner
      const winC = coins[winIdx];
      tl.call(() => {
        if (probe) probe.phase = "landed";
        front.addChild(winC);
        const wr = sp(FX.tex.burst); wr.blendMode = ADD; wr.tint = tint; wr.alpha = 0.55; wr.scale.set(0.2); front.addChildAt(wr, front.getChildIndex(winC));
        wr.position.copyFrom(winC.position); objs.push(wr);
        gsap.to(wr.scale, { x: 1.1, y: 1.1, duration: 0.35, ease: "back.out(1.6)" });
        tws.push(gsap.to(wr, { rotation: 1.2, duration: 1.4, ease: "none", onUpdate: () => wr.position.copyFrom(winC.position) }));
        gsap.fromTo(winC.scale, { x: 1.6, y: 1.6 }, { x: 1.2, y: 1.2, duration: 0.35, ease: "back.out(2.4)" });
        ctx.starFlash(winC.x, winC.y, 1.6, 0xfff2c0); ctx.ringAt(winC.x, winC.y, tint, 2.4, 0.4); ctx.ringAt(winC.x, winC.y, 0xffffff, 1.4, 0.25);
        ctx.burstAt(winC.x, winC.y, 0xffd060, Math.round(22 * M)); ctx.flashAt(winC.x, winC.y, 0xfff0c0, 0.9, 0.18);
        ctx.shake(9, 0.25); ctx.hitStop && ctx.hitStop(60); ctx.flameKick && ctx.flameKick(1.3);
        sfx("impact", true);
        coins.forEach((c, i) => { if (i !== winIdx) { gsap.to(c, { alpha: 0, duration: 0.3 }); gsap.to(c.scale, { x: 0.3, y: 0.3, duration: 0.3, ease: "power2.in" }); } });
      }, null, t + 0.05);
      // the halo closes and hands the winning coin over to the throw: gx_picker adopts it (same frame, same size) and carries
      // it into the bull's hand, so coin and throw stay one continuous object
      tl.to(back, { alpha: 0, duration: 0.3 }, t + 0.2).to(back.scale, { x: 1.15, y: 1.15, duration: 0.3 }, t + 0.2)
        .call(() => {
          winC.seated = false; tws.forEach((tw) => { if (tw !== tl) { try { tw.kill(); } catch (e) {} } });
          const g = layers.fxTop.toLocal(winC.getGlobalPosition()); layers.fxTop.addChild(winC); winC.position.set(g.x, g.y);
          const H = { c: winC, x: g.x, y: g.y, s: winC.scale.x }; window.GX_HALO_HANDOFF = H;
          setTimeout(() => { if (window.GX_HALO_HANDOFF === H) window.GX_HALO_HANDOFF = null; if (live(winC)) kill(winC); }, 4000);
          const i = objs.indexOf(winC); if (i >= 0) objs.splice(i, 1);
        }, null, t + 0.5)
        .to({}, { duration: 0.01 }, t + 0.51);
    } catch (e) { console.warn("gx halo", e); finish(); }
  }));
});
