// Fortune Bull 1000 - effect plugin: GOLD DUST multiplier column (DEMO for later integration; see src/gx.js)
// User 2026-11-18: "in the demo we need a separate animation for later integration. we need the multiplier vertical reel to
// have golden dust on the frame, and reel rotate very fast" (reference: another game's scatter-anticipation reel: a thick
// border of glittering gold dust hugging the inside of the reel window, while that reel spins very fast for ~2 s).
//   COLDUST.frame(on)  only the gold-dust frame on the column window (fade in 0.2 s / out 0.35 s)
//   COLDUST.play({ dur = 2.2, to = null, speed = 32 }) -> Promise(reason): frame on, the column rolls at `speed` chips/s
//                      (light blur only) for `dur` s, then the game's own glide stop onto `to` (a multiplier value; null =
//                      a random valid chip), the frame fades after the settle. Resolves "end" (or the stop reason).
//   COLDUST.stop(reason)  synchronous, idempotent: frame destroyed, the column back at rest on its target, hooks restored
// Never touches balance, bet, the 3x3 board, G.last or S.state (the game stays "idle"; game.js's exShowCancel -> spin(),
// toggleEx, the EX mode change calls COLDUST.stop in the same frame). Seam: GX.ctx.cds (game.js, next to GX.ctx.exs).
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, app, FX, SFX, S, Engine, MOBILE, layers, TRAY } = ctx;
  const TM = {
    DUR: 2.2, SPEED: 32,                   // roll time (s) and speed (chips / s; the game rolls 9, turbo 26)
    BLUR_PX: 1.5,                          // max vertical blur while rolling (the game's own curve would give ~13 px at 32/s)
    TD: 0.55, OVER: 0.12, TD_T: 0.25, OVER_T: 0.08,   // the glide stop (normal / turbo), as in spin()
    HOLD: 0.3,                             // the frame stays this long after the column is at rest, then fades
    FADE_IN: 0.2, FADE_OUT: 0.35,
    BAND: 30, OUT: 5,                      // band thickness inside the window, its thin outer glow (design px)   // b21: 18 / 3 -> 30 / 5 (user: "more broad")
    GLOW_BAND: 22,                         // b21: the solid glow layer stays a little narrower than the dust (chip edges stay readable)
    GLOW_A: 0.72, PULSE: 0.09, PULSE_HZ: 1.4,
    LAYERS: MOBILE ? 2 : 3, SPECKS: MOBILE ? 950 : 1400,   // b21: 650 / 900 -> more specks for the wider band   // baked glitter layers (each re-weighted every few frames)
    PARTS: MOBILE ? 130 : 260, GLINTS: MOBILE ? 7 : 12, DRIFT: MOBILE ? 16 : 30,   // b21 (user: "more active"): was 80/160, 4/7, 7/14
    FLOW: MOBILE ? 90 : 170,               // b20: gold-dust specks streaming along the band (0 = the b19 frame: twinkles only)   // b21: was 40 / 80
    // b21 (user 2026-11-20: "the sparkles and particles, add more, to go outside of the reel borders", sketch: specks flying out on
    // every side, over the gold frame, out to the right and over the reels on the left): SPILL specks leave the band outward
    // (all four sides) and fly 40-150 px past the window; a share of the glints pop just outside the window, on the frame
    SPILL: MOBILE ? 110 : 220, SPILL_EVERY: MOBILE ? [0.008, 0.02] : [0.004, 0.01], GLINT_OUT: 0.4,
    SPILL_STAR: 0.3,                       // share of spill specks drawn as 4-point sparkles (the rest round twinkles); full alpha (own layer)
    DIM: false,                            // COLDUST_DIM (later: dim the board while the column runs) - not used yet
  };
  const R = 2;                                                     // textures baked at 2x
  const X0 = TRAY[0], Y0 = TRAY[1], W = TRAY[2] - TRAY[0], H = TRAY[3] - TRAY[1], M = 10, PER = 2 * (W + H);
  const warn = (e) => console.warn("gx coldust", e);
  const now = () => performance.now() / 1000;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TINTS = [0xffffff, 0xfff6d8, 0xffe9a8, 0xffd27a];
  let F = null, P = null, tickOn = false, playN = 0, tex = null;
  // b19 (user 2026-11-19 items 7-8, the frame now runs in every real spin, game.js colHotOn/colHotOff): frame(on, a) takes the
  // frame's peak alpha (default 1 = the demo); playing() = the demo play owns the column (a round's late frame-off leaves it alone)
  const api = window.COLDUST = { play, frame, stop, active: () => !!(P || F), playing: () => !!P, T: TM, last: null,
    _count: () => (F && !F.c.destroyed ? F.c.children.length + F.pc.children.length + (F.so ? F.so.children.length : 0) : 0), _tick: () => tickOn };

  // ---------- textures (baked once, cached) ----------
  function canvas(w, h) { const c = document.createElement("canvas"); c.width = Math.ceil(w * R); c.height = Math.ceil(h * R); return c; }
  // perimeter position s (0..PER, clockwise from the top-left corner) at depth d inside the window -> window-local x, y
  function edgePt(s, d) {
    s = ((s % PER) + PER) % PER;
    if (s < W) return { x: s, y: d, nx: 0, ny: 1 };
    if (s < W + H) return { x: W - d, y: s - W, nx: -1, ny: 0 };
    if (s < 2 * W + H) return { x: W - (s - W - H), y: H - d, nx: 0, ny: -1 };
    return { x: d, y: H - (s - 2 * W - H), nx: 1, ny: 0 };
  }
  function bake() {
    if (tex) return tex;
    const B = TM.GLOW_BAND;                                          // b21: the glow layer's own width (the dust uses TM.BAND)
    // 1) the glow band: brightest just inside the edge, soft inner falloff, a thin outer rim; mottled so it is never flat
    const cg = canvas(W + 2 * M, H + 2 * M), g = cg.getContext("2d"), id = g.createImageData(cg.width, cg.height), px = id.data;
    const nz = []; for (let i = 0; i < 64; i++) nz.push(Math.random());
    const noise = (x, y) => { const a = nz[(Math.floor(x / 7) * 7 + Math.floor(y / 9) * 13) & 63], b = nz[(Math.floor(x / 3) * 5 + Math.floor(y / 4) * 11) & 63]; return 0.72 + 0.28 * a + 0.22 * b; };
    for (let j = 0; j < cg.height; j++) for (let i = 0; i < cg.width; i++) {
      const x = i / R - M, y = j / R - M;
      const dx = Math.min(x, W - x), dy = Math.min(y, H - y);
      let d;
      if (dx >= 0 && dy >= 0) d = Math.min(dx, dy);
      else d = -Math.hypot(Math.min(0, dx), Math.min(0, dy));
      let a;
      if (d < 0) a = 0.75 * Math.exp(d / TM.OUT);
      else if (d < 0.4 * B) a = 0.75 + 0.25 * (1 - d / (0.4 * B));
      else { const u = Math.min(1, (d - 0.4 * B) / (0.6 * B + 8)); a = 0.75 * (1 - u * u * (3 - 2 * u)); }
      if (a <= 0.003) continue;
      a = Math.min(1, a * noise(x, y));
      const k = Math.max(0, Math.min(1, d / B));                     // edge pale gold -> inner deeper gold
      const o = (j * cg.width + i) * 4;
      px[o] = 255; px[o + 1] = Math.round(222 - 38 * k); px[o + 2] = Math.round(110 - 70 * k); px[o + 3] = Math.round(255 * a);
    }
    g.putImageData(id, 0, 0);
    // 2) glitter layers: thousands of tiny specks (near-white cores, gold halos), densest at the edge
    const layers = [];
    for (let L = 0; L < TM.LAYERS; L++) {
      const c = canvas(W + 2 * M, H + 2 * M), q = c.getContext("2d");
      for (let n = 0; n < TM.SPECKS; n++) {
        const d = TM.BAND * 1.3 * Math.pow(Math.random(), 1.6) - 1.5, p = edgePt(Math.random() * PER, d);
        const big = Math.random() < 0.1, r = (big ? rnd(1.6, 2.6) : rnd(0.5, 1.3)) * R, x = (p.x + M) * R, y = (p.y + M) * R;
        const gr = q.createRadialGradient(x, y, 0, x, y, r * 2.2), a = rnd(0.55, 1);
        gr.addColorStop(0, `rgba(255,255,${Math.round(rnd(215, 255))},${a})`);
        gr.addColorStop(0.35, `rgba(255,${Math.round(rnd(205, 235))},${Math.round(rnd(90, 140))},${a * 0.75})`);
        gr.addColorStop(1, "rgba(255,200,90,0)");
        q.fillStyle = gr; q.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      }
      layers.push(PIXI.Texture.from(c));
    }
    // 3) a small twinkle: hot core, soft gold halo, two thin rays
    const ct = canvas(24, 24), t = ct.getContext("2d"), c0 = 12 * R;
    let gr = t.createRadialGradient(c0, c0, 0, c0, c0, c0);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.18, "rgba(255,250,225,0.95)"); gr.addColorStop(0.45, "rgba(255,215,120,0.35)"); gr.addColorStop(1, "rgba(255,200,90,0)");
    t.fillStyle = gr; t.fillRect(0, 0, ct.width, ct.height);
    t.fillStyle = "rgba(255,248,220,0.9)";
    t.beginPath(); t.moveTo(c0, 0); t.lineTo(c0 + 1.2 * R, c0); t.lineTo(c0, 2 * c0); t.lineTo(c0 - 1.2 * R, c0); t.closePath(); t.fill();
    t.beginPath(); t.moveTo(0, c0); t.lineTo(c0, c0 - 1.2 * R); t.lineTo(2 * c0, c0); t.lineTo(c0, c0 + 1.2 * R); t.closePath(); t.fill();
    tex = { glow: PIXI.Texture.from(cg), layers, tw: PIXI.Texture.from(ct), twW: 24 };
    return tex;
  }

  // ---------- the frame ----------
  function frame(on, a) {
    if (on) {
      if (F && !F.dying) return;
      if (F && F.c) {                                                  // b19 (lead): a re-spin inside the fade-out revives the frame, no flicker
        F.dying = false; gsap.killTweensOf(F.c);
        F.fade = gsap.to(F.c, { alpha: a != null ? +a : 1, duration: TM.FADE_IN, ease: "power1.out" });
        return;
      }
      if (F) killFrame();
      try { buildFrame(a != null ? +a : 1); } catch (e) { warn(e); killFrame(); }
    } else if (F && !F.dying) {
      F.dying = true; gsap.killTweensOf(F.c);
      F.fade = gsap.to(F.c, { alpha: 0, duration: TM.FADE_OUT, ease: "power1.in", onComplete: () => killFrame() });
    }
  }
  function buildFrame(peak) {
    const tx = bake(), board = layers.board;
    const c = new PIXI.Container(); c.name = "colDust"; c.eventMode = "none"; c.position.set(X0, Y0); c.alpha = 0;
    board.addChildAt(c, board.getChildIndex(layers.boardFx));       // over the chips (colFront / colFrontCB) and the centre frame, under the board fx
    const sp = (t, x, y) => { const s = new PIXI.Sprite(t); s.blendMode = PIXI.BLEND_MODES.ADD; s.position.set(x, y); s.scale.set(1 / R); return s; };
    const glow = sp(tx.glow, -M, -M); c.addChild(glow);
    const lay = tx.layers.map((t) => { const s = sp(t, -M, -M); c.addChild(s); return { s, w: rnd(5, 9), ph: rnd(0, 6), j: 1, n: 0 }; });
    const pc = new PIXI.Container(); c.addChild(pc);
    const mk = (t) => { const s = new PIXI.Sprite(t); s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; s.visible = false; pc.addChild(s); return s; };
    const parts = []; for (let i = 0; i < TM.PARTS; i++) { const p = { s: mk(tx.tw), age: 0, life: 0, f: 1, n: 0 }; spawnPart(p, true); parts.push(p); }
    const glints = []; for (let i = 0; i < TM.GLINTS; i++) glints.push({ s: mk(FX.tex.spark), age: 1, life: 0 });
    const drift = []; for (let i = 0; i < TM.DRIFT; i++) drift.push({ s: mk(tx.tw), age: 1, life: 0 });
    const flow = []; for (let i = 0; i < TM.FLOW; i++) { const p = { s: mk(tx.tw) }; spawnFlow(p, true); flow.push(p); }
    // b21: the spill specks get their own layer next to the frame at full strength (the frame itself runs at the round's 0.65)
    const so = new PIXI.Container(); so.name = "colDustSpill"; so.eventMode = "none"; so.position.set(X0, Y0); so.alpha = 0;
    board.addChildAt(so, board.getChildIndex(c) + 1);
    const mkS = (t) => { const s = new PIXI.Sprite(t); s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; s.visible = false; so.addChild(s); return s; };
    const spill = []; for (let i = 0; i < TM.SPILL; i++) { const star = Math.random() < TM.SPILL_STAR; spill.push({ s: mkS(star ? FX.tex.spark : tx.tw), star, age: 1, life: 0 }); }
    F = { c, so, peak, glow, lay, pc, parts, glints, drift, flow, spill, t: 0, glintT: 0, driftT: 0, spillT: 0, dying: false, fade: null };
    F.fade = gsap.to(c, { alpha: peak, duration: TM.FADE_IN, ease: "power1.out" });
    tickSync();
  }
  function spawnPart(p, pre) {
    const B = TM.BAND, d = B * 1.05 * Math.pow(Math.random(), 1.4) - 1, e = edgePt(Math.random() * PER, d);
    p.s.position.set(e.x, e.y); p.life = rnd(0.22, 0.65); p.age = pre ? Math.random() * p.life : 0;
    p.size = Math.random() < 0.2 ? rnd(9, 14) : rnd(4, 8); p.s.tint = TINTS[Math.floor(Math.random() * TINTS.length)];
    p.s.rotation = Math.random() < 0.5 ? 0 : Math.PI / 4; p.s.visible = true;
  }
  // b20 (user 2026-11-19: "the side frame glowing effect we added should have moving particles as well"): FLOW specks stream
  // UP the band on both sides of the window (70-170 px/s, a slight sway, 0.7-1.5 s each, fading in and out) and, along the top
  // and bottom bands, run out to the nearer corner. Small soft twinkles only (calm look: no bursts, streaks or rings); they
  // stay inside the window (never over the reels on its left)
  function spawnFlow(p, pre) {
    const d = TM.BAND * 0.9 * Math.pow(Math.random(), 1.2);
    // b21 (user 2026-11-20: "make the particles more active, more broad"): faster (130-290 px/s up the sides, was 70-170;
    // 70-150 along top / bottom, was 40-90), a wider sway, shorter lives so the band keeps renewing
    if (Math.random() < 0.8) { const left = Math.random() < 0.5; p.x = left ? Math.max(1.5, d) : W - d; p.y = rnd(0, H); p.vx = 0; p.vy = -rnd(130, 290); }
    else { const top = Math.random() < 0.5; p.x = rnd(0, W); p.y = top ? d : H - d; p.vx = (p.x < W / 2 ? -1 : 1) * rnd(70, 150); p.vy = 0; }
    p.ph = rnd(0, 6); p.sw = rnd(2.5, 6); p.life = rnd(0.55, 1.15); p.age = pre ? Math.random() * p.life : 0;
    if (pre) { p.x += p.vx * p.age; p.y += p.vy * p.age; }
    p.size = Math.random() < 0.15 ? rnd(6, 9) : rnd(3, 5.5); p.s.tint = TINTS[Math.floor(Math.random() * TINTS.length)]; p.s.visible = true;
  }
  function flowTick(f, dt) {
    const tw = tex.twW;
    f.flow.forEach((p) => {
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.age >= p.life || p.y < -4 || p.y > H + 4 || p.x < 1 || p.x > W + 2) spawnFlow(p, false);
      const u = p.age / p.life, env = Math.min(1, u * 5) * (1 - u);
      const sway = p.vx === 0 ? Math.sin(f.t * p.sw + p.ph) * 4.5 : 0;   // b21: 2.5 -> 4.5
      p.s.position.set(Math.max(1, p.x + sway), p.y);
      p.s.alpha = Math.min(1, env * 1.5) * (Math.random() < 0.1 ? 0.5 : 1);
      p.s.scale.set((p.size / tw) * (0.75 + 0.25 * env));
    });
  }
  function frameTick(dt) {
    const f = F; f.t += dt;
    f.glow.alpha = TM.GLOW_A * (1 + TM.PULSE * Math.sin(f.t * Math.PI * 2 * TM.PULSE_HZ) + 0.03 * (Math.random() - 0.5));
    // glitter layers: a slow sine each, re-weighted at random every 2-4 frames -> the baked specks shimmer
    f.lay.forEach((L) => { if (--L.n <= 0) { L.n = 2 + Math.floor(Math.random() * 3); L.j = rnd(0.55, 1.15); }
      L.s.alpha = Math.min(1, (0.3 + 0.7 * Math.abs(Math.sin(f.t * L.w + L.ph))) * L.j); });
    const tw = tex.twW;
    f.parts.forEach((p) => {
      p.age += dt; if (p.age >= p.life) spawnPart(p, false);
      if (--p.n <= 0) { p.n = 2 + Math.floor(Math.random() * 3); p.f = Math.random() < 0.2 ? rnd(0.15, 0.4) : rnd(0.7, 1.25); }
      const u = p.age / p.life, env = Math.sin(Math.PI * u);
      p.s.alpha = Math.min(1, env * p.f); p.s.scale.set((p.size / tw) * (0.6 + 0.5 * env) * (0.85 + 0.3 * p.f));
    });
    if (f.flow) flowTick(f, dt);                                      // b20: the moving gold dust
    // 4-point glints popping at random spots along the band
    f.glintT -= dt;
    // b21: glints every 0.03-0.09 s (was 0.05-0.16), drift specks every 0.025-0.07 s (was 0.06-0.15)
    if (f.glintT <= 0) { f.glintT = rnd(0.03, 0.09); const gl = f.glints.find((g) => g.age >= g.life);
      if (gl) { const e = edgePt(Math.random() * PER, Math.random() < TM.GLINT_OUT ? -rnd(4, 34) : rnd(1, TM.BAND * 0.7));   // b21: some just outside gl.s.position.set(e.x, e.y); gl.age = 0; gl.life = rnd(0.26, 0.42);
        gl.size = rnd(16, 28); gl.rot = rnd(-0.4, 0.4); gl.s.tint = Math.random() < 0.5 ? 0xffffff : 0xfff0c0; gl.s.visible = true; } }
    f.glints.forEach((g) => { if (g.age >= g.life) { g.s.visible = false; return; } g.age += dt;
      const u = Math.min(1, g.age / g.life), env = Math.sin(Math.PI * u);
      g.s.alpha = env; g.s.scale.set((g.size / 128) * env * 1.6); g.s.rotation = g.rot + u * 0.6; });
    // a few specks drift 10-30 px off the band and fade (outward; on the left side inward, never over the reels)
    f.driftT -= dt;
    if (f.driftT <= 0) { f.driftT = rnd(0.025, 0.07); const p = f.drift.find((q) => q.age >= q.life);
      if (p) { const e = edgePt(Math.random() * PER, rnd(0, TM.BAND)), sp = rnd(24, 60);   // b21: was 14-34 (drift 10-30 px -> 20-55 px); outward on every side (was inward on the left)
        p.s.position.set(e.x, e.y); p.vx = -e.nx * sp + rnd(-6, 6); p.vy = -e.ny * sp - rnd(4, 14);
        p.age = 0; p.life = rnd(0.6, 1.0); p.size = rnd(2.5, 4.5); p.s.tint = TINTS[1 + Math.floor(Math.random() * 3)]; p.s.visible = true; } }
    f.drift.forEach((p) => { if (p.age >= p.life) { p.s.visible = false; return; } p.age += dt;
      p.s.x += p.vx * dt; p.s.y += p.vy * dt;
      const u = p.age / p.life; p.s.alpha = Math.min(1, u * 6) * (1 - u) * (Math.random() < 0.15 ? 0.4 : 1);
      p.s.scale.set((p.size / tex.twW) * (1 - 0.4 * u)); });
    // b21: SPILL - specks leaving the band outward, past the frame: 70-210 px/s, a little drag and float, 0.6-1.4 s
    f.spillT -= dt;
    while (f.spillT <= 0) { f.spillT += rnd(TM.SPILL_EVERY[0], TM.SPILL_EVERY[1]); const p = f.spill.find((q) => q.age >= q.life);
      if (!p) break;
      const e = edgePt(Math.random() * PER, rnd(0, TM.BAND * 0.6)), sp = rnd(70, 210), tx_ = e.nx === 0 ? 1 : 0, ty_ = e.ny === 0 ? 1 : 0, tan = rnd(-40, 40);
      p.s.position.set(e.x, e.y); p.vx = -e.nx * sp + tx_ * tan; p.vy = -e.ny * sp + ty_ * tan - rnd(10, 30);
      p.age = 0; p.life = rnd(0.6, 1.4); p.tw = rnd(9, 16); p.ph = rnd(0, 6); p.rot = rnd(-0.5, 0.5);
      p.size = p.star ? rnd(14, 26) : Math.random() < 0.25 ? rnd(8, 12) : rnd(4.5, 8);
      p.s.tint = TINTS[Math.floor(Math.random() * TINTS.length)]; p.s.visible = true; }
    f.spill.forEach((p) => { if (p.age >= p.life) { p.s.visible = false; return; } p.age += dt;
      const k = Math.exp(-1.6 * dt); p.vx *= k; p.vy = p.vy * k - 12 * dt;           // drag, a slow float upward
      p.s.x += p.vx * dt; p.s.y += p.vy * dt;
      const u = p.age / p.life, tw = 0.7 + 0.3 * Math.sin(f.t * p.tw + p.ph);
      p.s.alpha = Math.min(1, u * 8) * (1 - u) * tw;
      p.s.scale.set((p.size / (p.star ? 128 : tex.twW)) * (1 - 0.35 * u)); if (p.star) p.s.rotation = p.rot + u * 0.8; });
    f.so.alpha = f.peak > 0 ? Math.min(1, f.c.alpha / f.peak) : f.c.alpha;   // fades with the frame, at full strength
  }
  function killFrame() {
    const f = F; if (!f) return; F = null;
    try { gsap.killTweensOf(f.c); if (!f.c.destroyed) f.c.destroy({ children: true }); if (f.so && !f.so.destroyed) f.so.destroy({ children: true }); } catch (e) { warn(e); }   // (the baked textures stay cached)
    tickSync();
  }

  // ---------- one ticker callback for the frame and the play ----------
  function tick() {
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000);
    try {
      if (F) frameTick(dt);
      if (P) playTick();
    } catch (e) { warn(e); stop("error"); }
  }
  function tickSync() {
    const want = !!(F || P);
    if (want && !tickOn) { app.ticker.add(tick); tickOn = true; }
    else if (!want && tickOn) { app.ticker.remove(tick); tickOn = false; }
  }

  // ---------- play: frame + very fast column + the game's glide stop ----------
  function pickIdx(to) {
    const St = Engine.STRIP;
    if (to == null) return Math.floor(Math.random() * St.length);
    let i = St.indexOf(to); if (i >= 0) return i;
    let best = -1;                                                    // not on this mode's strip: the nearest chip of the same kind
    St.forEach((v, k) => { if (Math.sign(v) === Math.sign(to) && (best < 0 || Math.abs(v - to) < Math.abs(St[best] - to))) best = k; });
    return best >= 0 ? best : Math.floor(Math.random() * St.length);
  }
  function play(o) {
    o = o || {};
    stop("restart");
    const cds = ctx.cds || GX.ctx.cds, rl = ctx.colReel;
    if (!cds || !cds.idle()) { api.last = { reason: cds ? "busy" : "off", dur: 0 }; return Promise.resolve(api.last.reason); }
    cds.exCancel("coldust");                                         // an EX show / column grow ends first (COLDUST is not active yet)
    let resolve; const done = new Promise((r) => (resolve = r));
    const id = ++playN, dur = o.dur != null ? +o.dur : TM.DUR, speed = o.speed != null ? +o.speed : TM.SPEED, turbo = !!S.turbo;
    const idx = pickIdx(o.to);
    P = { id, resolve, t0: now(), idx, to: Engine.STRIP[idx], mode: Engine.mode(), phase: "spin", timer: null, holdT: 0,
      onSpeed: rl.onSpeed, onLand: rl.onLand, colDone: false, turbo };
    try {
      frame(true);
      const blurS = 10 + TM.BLUR_PX / 0.6, orig = P.onSpeed;           // the game's blur curve, capped: chips stay sharp
      rl.onSpeed = (s) => { if (orig) orig(Math.min(s, blurS)); };
      rl.onLand = () => { cds.colGrowTo(1, 0.25); SFX.columnStop(); };
      rl.start(0, false); rl.vmax = speed; rl.speed = speed;
      cds.colGrowTo(0, 0.18);
      SFX.spin();
      P.timer = gsap.delayedCall(dur, () => { if (P && P.id === id) stopPhase(); });
      tickSync();
    } catch (e) { warn(e); stop("error"); }
    return done;
  }
  function stopPhase() {
    const s = P, cds = ctx.cds, rl = ctx.colReel, idx = s.idx;
    s.phase = "stop";
    const final = cds.colWindow({ 0: idx });
    rl.glideStop(final, { T: 0, td: s.turbo ? TM.TD_T : TM.TD, over: s.turbo ? TM.OVER_T : TM.OVER,
      extra: (n) => Array.from({ length: n }, (_, k) => cds.stripAt(idx, k - n - 2)) })
      .then(() => { if (P === s) s.phase = "settle"; });
  }
  function playTick() {
    const s = P, rl = ctx.colReel, cds = ctx.cds;
    if (now() - s.t0 > 0.3 && cds.overlayOpen && cds.overlayOpen()) { stop("overlay"); return; }
    if (s.phase === "settle" && rl.state === "idle") { restoreHooks(s); cds.setColC(s.idx); s.colDone = true; s.phase = "hold"; s.holdT = now(); }
    if (s.phase === "hold" && now() - s.holdT >= TM.HOLD) { s.phase = "out"; frame(false); }
    if (s.phase === "out" && !F) finish("end");
  }
  function restoreHooks(s) { const rl = ctx.colReel; rl.onSpeed = s.onSpeed; rl.onLand = s.onLand; }
  function finish(reason) {
    const s = P; if (!s) return; P = null;
    api.last = { reason, dur: +(now() - s.t0).toFixed(3), to: s.to, landed: ctx.colReel.views[4] ? ctx.colReel.views[4].v : null };
    tickSync();
    try { s.resolve(reason); } catch (e) { warn(e); }
  }

  // synchronous, idempotent: the frame is gone and the column is a valid idle column on its target in this frame
  function stop(reason) {
    reason = reason || "stop";
    const s = P;
    if (s) {
      const step = (fn) => { try { fn(); } catch (e) { warn(e); } };
      step(() => { if (s.timer) s.timer.kill(); });
      if (!s.colDone) {
        const rl = ctx.colReel, cds = ctx.cds;
        step(() => { if (rl.tween) rl.tween.kill(); rl.tween = null; rl.gen = (rl.gen || 0) + 1; rl.queue = null; rl.state = "idle"; rl.speed = 0; rl.offset = 0; });
        step(() => restoreHooks(s));
        step(() => { if (rl.onSpeed) rl.onSpeed(0); });                // the game's blur filter off
        step(() => { gsap.killTweensOf(cds.colGrow); cds.colGrow.k = 1; });
        step(() => { const i = Engine.mode() === s.mode ? s.idx : Math.floor(Math.random() * Engine.STRIP.length); rl.setSyms(cds.colIds(i)); cds.setColC(i); });
        step(() => SFX.spinEnd());
        s.colDone = true;
      }
    }
    killFrame();
    if (s) finish(reason);
    tickSync();
  }
});
