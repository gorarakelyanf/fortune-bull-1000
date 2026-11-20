// Fortune Bull 1000 - effect plugin: HALO WHEEL (see src/gx.js). On throws of 100x and up (HALO_MIN in game.js) the game
// awaits GX.run("halo", {mult, tint}) before the bull's throw:
//   0.00 a gold sun-halo (a circle round his head through the hand ball) opens behind the bull, rays turning behind it
//   0.10 seven multiplier balls fly out of the column into equal slots on the circle (the hand ball is the 8th slot)
//   0.85 a fire beam rises from a super wild on the board (else from the column) into the halo
//   1.00 b20 WHEEL: values roll ON the hand ball (the ring stands still), slow down and land on the round's multiplier
//   ~2.75 the ring ball with that value glides into the hand ball; the halo closes
//   ~3.3 the rolled value rides the hand ball into the throw (gx_picker adopts it) until the release
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
  // b18b (QA, calm look): SW_SHAFT - the tall light shaft over the multiplier column while the SUPER WILD ring fills (it
  // washed out the chip labels and the counter boards for 3-4 s), off; ?swshaft brings it back. SW_HIT_FLASH - the haze
  // flare / centre flash / coin glow pulse when a SUPER WILD's flames hit the ring, off; ?swflash brings it back.
  const QS = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(""); } })();
  const SW_SHAFT = QS.has("swshaft"), SW_HIT_FLASH = QS.has("swflash");
  // b20 lead (calm look, the 100x halo): no flash + ring as it opens, no ring per seated ball, no flash / dot burst / shake /
  // dot spray with the beam from the board (the beam itself stays); ?halofx brings them back
  const HALO_FX = QS.has("halofx");

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
  // balls (user 2026-11-19): the wheel's multiplier coins are fire balls like the hand orb; ?oldcoins = the painted chips.
  // (b) "animated like the hand ball", "no ball should cover the hand ball" (see handGeo / clearHand / swLayout);
  // (d) each ball in its multiplier chip's colour (VFX BALL_PAL).
  // balls (user 2026-11-19 c): "the halo spheres exactly the same as we have in the hand now, that quality" - each ball is
  // VFX.ballOrb: the hand orb's own parts and animation (ORB_FRAG live incl. specular / corona / rings, its own seed, bloom,
  // embers); added here only: the numerals with a soft dark bed, and the dim state (VFX ballsTick tints it via c.dimL.alpha).
  // BALL_D = sphere diameter in coin space: at the SUPER WILD wheel's 0.6 it is the hand orb's size (84 px)
  const BALLS = !QS.has("oldcoins") && !!(window.VFX && window.VFX.ballOrb), BALL_D = 140;   // px (coin space)
  const VIS = { 1: 113, 2: 113, 3: 110, 5: 111, 10: 151, 15: 142, 20: 163, 25: 161, 50: 161, 100: 198, 200: 169, 500: 191, 1000: 198 };   // visible label widths (px)
  let BT = null;
  const ballTex = () => {
    if (BT) return BT;
    const cv = (w, h, f) => { const c = document.createElement("canvas"); c.width = w; c.height = h; f(c.getContext("2d"), w, h); return PIXI.Texture.from(c); };
    const rad = (g, w, h, stops) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); stops.forEach(([k, s]) => gr.addColorStop(k, s));
      g.setTransform(1, 0, 0, h / w, 0, 0); g.fillStyle = gr; g.fillRect(0, 0, w, w); };
    BT = {
      shade: cv(200, 110, (g, w, h) => rad(g, w, h, [[0, "rgba(48,8,2,0.55)"], [0.55, "rgba(48,8,2,0.4)"], [1, "rgba(48,8,2,0)"]])),
    };
    return BT;
  };
  function makeCoin(v, parent) {
    if (BALLS) {
      const B = ballTex(), c = new PIXI.Container(); parent.addChild(c);
      const pv = KNOWN.has(v) ? v : nearest(v), pc = window.VFX.ballPal(pv)[5];   // balls (d): the multiplier chip's colour
      const glow = sp(FX.tex.glow, c); glow.blendMode = ADD; glow.alpha = 0; glow.scale.set(1.25);
      glow.tint = (Math.round(pc[0] * 255) << 16) | (Math.round(pc[1] * 255) << 8) | Math.round(pc[2] * 255);
      const body = window.VFX.ballOrb(BALL_D / 2, pv); c.addChild(body);   // balls (c): the hand orb itself, own seed
      const shade = sp(B.shade, c); shade.y = 3; shade.scale.set(BALL_D / 168);
      let l;
      if (KNOWN.has(v)) { l = sp(labelTex(v), c); l.scale.set(Math.min(1, (0.95 * BALL_D) / (VIS[v] || 200))); }
      else { l = new PIXI.Text(v + "x", FX.gold(48)); l.anchor.set(0.5); c.addChild(l); }
      const dim = new PIXI.Container(); dim.renderable = false; dim.alpha = 0; c.addChild(dim);   // its alpha (0..0.55) = how dim (VFX tints the orb)
      body.dimRef = dim; body.dimLabel = l;
      c.glow = glow; c.face = body; c.body = body; c.dimL = dim; c.v = v; c.isBall = true; c.ballD = BALL_D;
      return c;
    }
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

  // balls (user 2026-11-19 b): "no ball should cover the hand ball, it should be properly placed". handGeo = the bull's hand
  // orb in fxTop space (r = its visible radius: sphere x 1.45 for the rim fire); clearHand pushes a wheel coin's point straight
  // away from it until the coin's live radius + HAND_GAP clears it (every tick, so lit / winner growth is covered too);
  // (b20: swLayout is gone - wheelGeo puts both wheels on an even circle with the hand ball as one slot; clearHand stays as
  // the safety net for when the hand moves).
  // HAND_REST = the bull's pose while a wheel is up (measured: desktop and ?mobile alike).
  // b20 WHEEL (user 2026-11-19): HAND_GAP 26 -> 12: on the even circle the hand slot's neighbours sit one equal step
  // (138 px) from the hand orb; 61 (orb rim) + 61 (ball rim) + 12 fits, so the safety net does not bend the circle at rest
  const HAND_GAP = 12, HAND_REST = { x: 273.4, y: 343.2, r: 42 * 1.45 };
  function handGeo() {
    try {
      const o = ctx.flame && ctx.flame.c && ctx.flame.c.orb; if (!o || !o.orbM.worldVisible) return null;
      const P = PIXI.Point, f = layers.fxTop, a = f.toLocal(o.orbM.toGlobal(new P(0, 0))), b = f.toLocal(o.orbM.toGlobal(new P(o.R, 0)));
      return { x: a.x, y: a.y, r: Math.hypot(b.x - a.x, b.y - a.y) * 1.45, rs: Math.hypot(b.x - a.x, b.y - a.y) };
    } catch (e) { return null; }
  }
  const coinR = (c) => (c.isBall ? (BALL_D / 2) * 1.45 : 87) * Math.abs(c.scale.x);   // a ball: its sphere x 1.45 (rim fire), like the hand's
  function clearHand(p, rb, hg) {
    if (!BALLS || !hg) return p;
    const dx = p.x - hg.x, dy = p.y - hg.y, d = Math.hypot(dx, dy), need = hg.r + rb + HAND_GAP;
    if (d >= need) return p;
    const ux = d > 1e-3 ? dx / d : 1, uy = d > 1e-3 ? dy / d : 0;
    return { x: hg.x + ux * need, y: hg.y + uy * need };
  }
  // b20 WHEEL (user 2026-11-19: "for the wheel, the halo spheres should be equally circular and choosing should happen always
  // in the hand ball, and the hand ball should be thrown", "the balls of halo should not dim"). Both wheels (100x halo and the
  // SUPER WILD / Fortune Choice wheel) put their balls on a TRUE circle through the hand orb's rest point: the hand ball is
  // the selector slot, N balls + the hand = N + 1 equal angle steps, clockwise from the hand (index 0 just above it, index
  // N-1 just below it). WC_R / WC_CY (fxTop px, measured on desktop + &mobile): the top ball stays on the desktop screen
  // (fxTop y 50), the bottom ball above the board frame, the right-most ball (x ~770) left of the counter boards (x ~840);
  // the centre (~496, 326) sits under the head (548, 234). One equal step = 138 px (9 balls) / 171 px (7 balls).
  // The wheel stands still: no turning, no whip, no pointer, no running light; every ball rests at WHEEL_CS (= the hand
  // orb's size), full brightness, never dimmed.
  const WC_R = 224, WC_CY = 326, WHEEL_CS = 0.6;
  function wheelGeo(N) {
    const h = HAND_REST, dy = h.y - WC_CY, CX = h.x + Math.sqrt(Math.max(0, WC_R * WC_R - dy * dy)), CY = WC_CY;
    const a0 = Math.atan2(h.y - CY, h.x - CX), step = (Math.PI * 2) / (N + 1);
    return { CX, CY, R: WC_R, a0, ang: Array.from({ length: N }, (_, k) => a0 + (k + 1) * step) };
  }
  // the hand orb's centre + sphere radius (fxTop)
  const orbC = () => { const hg = handGeo(); return hg ? { x: hg.x, y: hg.y, rs: hg.rs } : { x: HAND_REST.x, y: HAND_REST.y, rs: 42 }; };
  const orbOld = () => { try { const o = ctx.handOrb(); return { x: o.x, y: o.y - 8 }; } catch (e) { return { x: HAND_REST.x, y: HAND_REST.y }; } };
  // a value written ON the hand ball: numerals only (or the CHARGE badge / "+2"), fitted to the orb, centred
  function orbText(v, parent) {
    const c = new PIXI.Container(); parent.addChild(c);
    let o;
    if (v === "c2") { o = new PIXI.Text("+2", FX.gold(70, { fill: ["#F4FFE6", "#C8F58A", "#4E9A18"], strokeThickness: 7 })); o.anchor.set(0.5); c.addChild(o); }
    else if (v < 0) o = sp(ctx.T("UI/charge_badge"), c);
    else if (KNOWN.has(v)) o = sp(labelTex(v), c);
    else { o = new PIXI.Text(v + "x", FX.gold(48)); o.anchor.set(0.5); c.addChild(o); }
    const rs = orbC().rs, w = (typeof v === "number" && VIS[v]) || o.width, h = o.height;
    o.scale.set(Math.min(1.9 * rs / Math.max(1, w), 1.25 * rs / Math.max(1, h)));
    return c;
  }
  // b20 WHEEL: the choice is a roll of values ON the hand ball (the slowGather roller, shared): faces drop in from above,
  // 1/14 s steps through pool() (the values still on the ring), slowing, landing on the engine's value. ok() = the wheel is
  // still up. handoff(): the rolled numerals stay glued to the orb and go to gx_picker throwCharge (window.GX_HALO_HANDOFF,
  // txt) - the value stays readable on the hand ball until the release; flyTo(): a short calm flight off the ball (+2).
  function handRoller(front, pool, ok) {
    const R = { c: null, face: null, last: null, v: null };
    R.live = () => live(R.c);
    R.make = (v) => (BALLS ? orbText(v, R.c) : coinOf(v, R.c));
    R.next = () => { const P = pool() || []; if (!P.length) return R.last; let v, n = 0; do { v = P[Math.floor(Math.random() * P.length)]; } while (v === R.last && P.length > 1 && ++n < 20); return v; };
    R.set = (v, dur) => {
      if (!R.live()) return;
      kill(R.face); R.v = R.last = v; R.face = R.make(v);
      R.face.y = -16; R.face.scale.y = 0.72;
      gsap.to(R.face, { y: 0, duration: dur, ease: "power2.out" }); gsap.to(R.face.scale, { y: 1, duration: dur, ease: "power2.out" });
    };
    R.start = () => {
      if (!ok()) return;
      R.drop(); R.c = new PIXI.Container(); front.addChild(R.c);
      const p = BALLS ? orbC() : orbOld(); R.c.position.set(p.x, p.y); R.c.scale.set(0);
      if (!BALLS) { const g = sp(FX.tex.glow, R.c); g.blendMode = ADD; g.tint = 0xffd070; g.alpha = 0.45; g.scale.set(1.3); }   // ?oldcoins: a chip in the hand
      R.set(R.next(), 0.05);
      gsap.to(R.c.scale, { x: BALLS ? 1 : 0.8, y: BALLS ? 1 : 0.8, duration: 0.2, ease: "back.out(2.6)" });
    };
    R.land = (v) => {
      if (!ok() || !R.live()) return;
      kill(R.face); R.v = R.last = v; R.face = R.make(v);
      gsap.fromTo(R.face.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.4)" });
    };
    R.follow = () => { if (!R.live()) return; const p = BALLS ? orbC() : orbOld(); R.c.position.set(p.x, p.y); };
    R.drop = () => { kill(R.face); kill(R.c); R.face = R.c = null; };
    R.handoff = (life) => {
      if (!R.live()) return null;
      const c = R.c; R.c = R.face = null;
      gsap.killTweensOf(c.scale); c.scale.set(BALLS ? 1 : 0.8);
      const g = layers.fxTop.toLocal(c.getGlobalPosition()); layers.fxTop.addChild(c); c.position.set(g.x, g.y);
      const fol = () => { if (!live(c)) { gsap.ticker.remove(fol); return; } const q = BALLS ? orbC() : orbOld(); c.position.set(q.x, q.y); };
      gsap.ticker.add(fol);
      const H = { c, x: g.x, y: g.y, s: c.scale.x, txt: BALLS, rs: orbC().rs, v: R.v, stop: () => gsap.ticker.remove(fol) };
      window.GX_HALO_HANDOFF = H;
      gsap.delayedCall(life, () => { gsap.ticker.remove(fol); if (window.GX_HALO_HANDOFF === H) window.GX_HALO_HANDOFF = null; if (live(c) && c.parent === layers.fxTop) kill(c); });
      return H;
    };
    R.flyTo = (to, dur) => {
      if (!R.live()) return;
      const c = R.c; R.c = R.face = null;
      const p0 = { x: c.x, y: c.y }, mid = { x: (p0.x + to.x) / 2, y: Math.min(p0.y, to.y) - 90 }, pr = { t: 0 }, s0 = c.scale.x;
      gsap.to(pr, { t: 1, duration: dur, ease: "power2.in", onUpdate: () => {
        if (!live(c)) return;
        const q = FX.bezier(p0, mid, to, pr.t); c.position.set(q.x, q.y); c.scale.set(s0 * (1 - 0.35 * pr.t)); c.alpha = pr.t > 0.7 ? 1 - (pr.t - 0.7) / 0.3 : 1;
      }, onComplete: () => kill(c) });
    };
    return R;
  }
  // the roll on a timeline (turbo / ?ts scale it): starts at t0, rolls `dur` s (1/14 s steps, each 1.35x longer after
  // `fast` s), lands on v; returns the landing time
  function rollOn(tl, R, t0, dur, fast, v, onLand) {
    tl.call(() => R.start(), null, t0);
    const rs = { t: 0 }; let nextAt = 0, step = 1 / 14, n = 0;
    tl.to(rs, { t: dur, duration: dur, ease: "none", onUpdate: () => {
      if (!R.live() || rs.t < nextAt) return;
      R.set(R.next(), Math.min(0.05, step * 0.8)); if (++n % 2 === 0) sfx("tick");
      if (rs.t > fast) step *= 1.35;
      nextAt = rs.t + step;
    } }, t0 + 0.2);
    tl.call(() => { R.land(v); if (onLand) onLand(); }, null, t0 + 0.2 + dur);
    return t0 + 0.2 + dur;
  }
  // b20 WHEEL: the landed ball leaves its slot and merges into the hand ball (glides onto the orb, shrinking; it fades only in
  // the last third, as it goes into the orb) - it is never dimmed on the ring. Its slot stays empty (c.used).
  function mergeIn(c, dur) {
    if (!live(c)) return;
    c.used = true; c.seated = false; gsap.killTweensOf(c); gsap.killTweensOf(c.scale); if (c.glow) { gsap.killTweensOf(c.glow); c.glow.alpha = 0; }
    const p0 = { x: c.x, y: c.y }, s0 = c.scale.x, pr = { t: 0 };
    gsap.to(pr, { t: 1, duration: dur, ease: "power2.in", onUpdate: () => {
      if (!live(c)) return;
      const q = orbC(); c.position.set(p0.x + (q.x - p0.x) * pr.t, p0.y + (q.y - p0.y) * pr.t);
      c.scale.set(s0 * (1 - 0.6 * pr.t)); c.alpha = pr.t > 0.66 ? 1 - (pr.t - 0.66) / 0.34 : 1;
    }, onComplete: () => { if (live(c)) { c.visible = false; c.alpha = 0; } } });
  }

  // debug probe for QA
  let probe = null; window.GX_HALO = () => probe;
  window.GX_HALO_WHEEL = () => SH;   // b20 QA: the open SUPER WILD wheel (coins, CX, CY, RX) or null

  GX.on("halo", (d) => new Promise((resolve) => {
    const objs = [], tws = [];
    let done = false, RL = null;
    const finish = () => { if (done) return; done = true; probe = null; tws.forEach((t) => { try { t.kill(); } catch (e) {} }); objs.forEach(kill); if (RL) RL.drop(); resolve(); };   // b20: never a roller left on the hand
    try {
      const win = +d.mult || 100, tint = d.tint || 0xffd070, turbo = !!ctx.S.turbo;
      const vals = slotValues(win), winIdx = vals.indexOf(win), N = vals.length;
      // b20 WHEEL: a true circle through the hand slot (was an oval RX 232 / RY 188 round the head, turning under a top pointer)
      const WG = wheelGeo(N), RX = WG.R, RY = WG.R, CX = WG.CX, CY = WG.CY, CS = WHEEL_CS;
      probe = { phase: "open", lit: -1, win, vals, roll: null, R: WG.R, CX, CY };   // b20: phase open / roll / landed / handoff; roll = the value on the hand ball

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
      const coins = vals.map((v, i) => { const c = makeCoin(v, front); c.ang = WG.ang[i]; c.scale.set(0); c.position.set(ctx.COL_CX, ctx.COL_CY); return c; });
      // b20 WHEEL: the wheel stands still (no turn, no whip, no top pointer, no running light: a turning ring would pass
      // balls through the hand slot)
      const slot = (c) => ({ x: CX + Math.cos(c.ang) * RX, y: CY + Math.sin(c.ang) * RY });
      RL = handRoller(front, () => vals, () => !done); Object.defineProperty(probe, "coins", { value: coins, enumerable: false });   // QA: the balls (JSON-safe probe)
      const P = new FX.Particles(front);
      const tick = () => {
        rays.rotation += 0.004 * gsap.ticker.deltaRatio();
        const hg = handGeo();                              // balls (user 2026-11-19 b): the coins pass round the hand ball, never over it
        coins.forEach((c) => { if (c.seated) { const p = clearHand(slot(c), coinR(c), hg); c.position.set(p.x, p.y); } });
        if (RL) { RL.follow(); if (probe) probe.roll = RL.v; }   // b20: the roller rides the hand ball
        P.update(Math.min(0.05, gsap.ticker.deltaRatio() / 60));
      };
      gsap.ticker.add(tick); tws.push({ kill: () => gsap.ticker.remove(tick) });

      const tl = gsap.timeline({ onComplete: finish }); tws.push(tl);
      tl.timeScale(turbo ? 2.2 : 1);
      // open the halo
      tl.to(back, { alpha: 1, duration: 0.2 }, 0).to(back.scale, { x: 1, y: 1, duration: 0.45, ease: "back.out(1.5)" }, 0)
        .call(() => { sfx("rise", 0.6); if (HALO_FX) { ctx.flashAt(CX, CY, 0xffd27a, 1.2, 0.25); ctx.ringAt(CX, CY, 0xffe08a, 3.2, 0.45); } }, null, 0.05);   // b20 lead (calm look): no flash / ring as it opens
      // coins fly out of the column to their slots
      coins.forEach((c, i) => {
        const t0 = 0.1 + i * 0.07;
        tl.call(() => {
          const from = { x: ctx.COL_CX, y: ctx.COL_CY }, to = slot(c), mid = { x: (from.x + to.x) / 2 + rnd(-80, 80), y: Math.min(from.y, to.y) - 160 };
          const pr = { t: 0 };
          gsap.to(c.scale, { x: CS, y: CS, duration: 0.3, ease: "back.out(2)" });   // b20: the hand ball's size (was 0.72)
          tws.push(gsap.to(pr, { t: 1, duration: 0.45, ease: "power2.inOut", onUpdate: () => {
            const hg = handGeo(), q = clearHand(FX.bezier(from, mid, clearHand(slot(c), coinR(c), hg), pr.t), coinR(c), hg); c.position.set(q.x, q.y);   // balls (user 2026-11-19 b)
            if (Math.random() < 0.6 * M + 0.2) P.emit({ tex: FX.tex.dot, x: q.x, y: q.y, s0: 0.35, s1: 0, life: 0.3, tint: 0xffd060, blend: ADD });
          }, onComplete: () => { c.seated = true; if (HALO_FX) ctx.ringAt(c.x, c.y, 0xffe08a, 0.7, 0.2); sfx("tick"); } }));   // b20 lead: no ring as a ball seats
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
        sfx("impact", false);
        if (HALO_FX) {                                    // b20 lead (calm look): the beam alone - no flash / dot burst / shake / spray
        if (!s.wild) { ctx.flashAt(s.x, s.y, 0xffd060, 1.8, 0.3); ctx.burstAt(s.x, s.y, 0xffa040, Math.round(18 * M)); }   // white 2026-11-16: no flash on a SUPER WILD
        ctx.flashAt(CX, CY, 0xfff0c0, 1.1, 0.2); ctx.shake(7, 0.2); }
        if (HALO_FX) for (let i = 0; i < 26 * M; i++) {
          const f = rnd(0, 1); P.emit({ tex: FX.tex.dot, x: s.x + dx * f + rnd(-20, 20), y: s.y + dy * f, vx: rnd(-80, 80), vy: rnd(-300, -60), s0: rnd(0.25, 0.45), s1: 0, life: rnd(0.3, 0.6), tint: Math.random() < 0.5 ? 0xffd27a : 0xff7a20, blend: ADD });
        }
      }, null, 0.85);
      // b20 WHEEL: the choice rolls ON the hand ball through the ring's values, slows and lands on the round's multiplier
      // (was: a 2.5-turn whip under a top pointer, the passing coin lit, the rest dimmed, the winner popping with rays /
      // star flash / rings / burst / shake). Calm landing: the sound and the hand's flame kick only.
      const winC = coins[winIdx];
      tl.call(() => { if (probe) probe.phase = "roll"; }, null, 1.0);
      const t = rollOn(tl, RL, 1.0, 1.5, 0.9, win, () => { if (probe) probe.phase = "landed"; sfx("impact", true); if (ctx.flameKick) ctx.flameKick(1.3); });
      // the ring ball with that value leaves its slot and merges into the hand ball (no dimming of the others)
      tl.call(() => mergeIn(winC, turbo ? 0.2 : 0.45), null, t + 0.05);
      // the halo closes (the rest fade out with it) and the rolled value goes to the throw: gx_picker adopts the numerals on
      // the hand ball and keeps them there until the release (no second ball or chip over the hand ball)
      tl.to(back, { alpha: 0, duration: 0.3 }, t + 0.3).to(back.scale, { x: 1.15, y: 1.15, duration: 0.3 }, t + 0.3)
        .call(() => { coins.forEach((c, i) => { if (i !== winIdx && live(c)) { gsap.to(c, { alpha: 0, duration: 0.3 }); gsap.to(c.scale, { x: CS * 0.5, y: CS * 0.5, duration: 0.3, ease: "power2.in" }); } }); }, null, t + 0.3)
        .call(() => { if (probe) probe.phase = "handoff"; RL.handoff(4); }, null, t + 0.6)
        .to({}, { duration: 0.01 }, t + 0.6 + 0.01);
    } catch (e) { console.warn("gx halo", e); finish(); }
  }));

  // ---------- WHITE VERSION: the SUPER WILD halo (Garuda logic; user 2026-11-11: "the ring rotating above the head should
  // always be available when super wild is active, check the logic with garuda") ----------
  // In Fortune Garuda a super wild's charges are halo picks: the wheel opens round the character's head with coins from the
  // multiplier reel, each charge (2/2 -> 1/2 -> 0/2) fires a beam into it, the wheel whips round and lands on a value that
  // goes into the total. Here: superHaloOpen {vals} opens the ring and keeps it turning; superHaloPick {v, from, to} beams
  // from the super wild, lands the wheel on a coin of value v (the engine's own value for that charge) and flies it to
  // `to` (the total badge); superHaloClose closes it. Spliced into gx_halo.js by tools/port_from_stone.py.
  let SH = null;
  const TAU2 = Math.PI * 2;
  function chargeCoin(v, parent) {
    const c = new PIXI.Container(); parent.addChild(c);
    const glow = sp(FX.tex.glow, c); glow.blendMode = ADD; glow.tint = 0xc070ff; glow.alpha = 0; glow.scale.set(1.25);
    const face = sp(ctx.T("UI/charge_badge"), c); face.scale.set(0.52);
    const dim = sp(ctx.T("UI/charge_badge"), c); dim.scale.set(0.52); dim.tint = 0x000000; dim.alpha = 0;
    c.glow = glow; c.face = face; c.dimL = dim; c.v = v;
    return c;
  }
  // spec Fortune Choice: a Choice +2 position = a green chip with "+2 CHOICES"
  function choiceCoin(parent) {
    const c = new PIXI.Container(); parent.addChild(c);
    const glow = sp(FX.tex.glow, c); glow.blendMode = ADD; glow.tint = 0x9be060; glow.alpha = 0; glow.scale.set(1.25);
    const face = sp(ctx.T("Multipliers/chip_bg_3"), c); sp(ctx.T("Multipliers/chip_rim"), c);
    const t = new PIXI.Text("+2", FX.gold(70, { fill: ["#F4FFE6", "#C8F58A", "#4E9A18"], strokeThickness: 7 })); t.anchor.set(0.5); t.y = -12; c.addChild(t);
    const l = new PIXI.Text("CHOICES", FX.gold(24, { strokeThickness: 4 })); l.anchor.set(0.5); l.y = 36; c.addChild(l);
    const dim = sp(ctx.T("Multipliers/chip_bg_3"), c); dim.tint = 0x000000; dim.alpha = 0;
    c.glow = glow; c.face = face; c.dimL = dim; c.v = "c2";
    return c;
  }
  const coinOf = (v, parent) => (v === "c2" ? choiceCoin(parent) : v < 0 ? chargeCoin(v, parent) : makeCoin(v, parent));
  // b20 WHEEL ("the balls of halo should not dim"): a picked position has merged into the hand ball (mergeIn) and its slot
  // stays empty (spec: positions never refill) - was: it stayed on the wheel dark and small (alpha 0.42, dimL 0.55, x0.78).
  // shRest: every ball still on the ring at rest = the same size, full brightness, no glow; spent slots stay empty.
  function shRest() {
    if (!SH) return;
    const cs = SH.cs || WHEEL_CS;
    SH.coins.forEach((c) => {
      if (!live(c)) return;
      if (c.used) { c.visible = false; c.alpha = 0; return; }
      if (c.dimL) { gsap.killTweensOf(c.dimL); c.dimL.alpha = 0; }
      gsap.to(c.glow, { alpha: 0, duration: 0.06 });
      gsap.to(c.scale, { x: cs, y: cs, duration: 0.08, ease: "power2.out" });
    });
  }
  // white 2026-11-16 SUPER WILD sequence, step 4 (user: "it slowly gather multipliers on the halo wheel, 7 chosen and one
  // randomly generated"; Fortune Garuda: one coin out of the multiplier reel at a time, the last slot rolled in the raised
  // hand). superHaloOpen {slow}: the chosen positions fly out of the column one by one, each from a different chip (0.45 s
  // apart, 0.7 s flights); the last position is rolled in the bull's hand orb like a mini reel, lands on its value with one
  // light streak and takes its slot. Calm: no dot trail, no rings - each coin carries its own soft glow. All on the open
  // timeline (turbo 2.2x, tap speed, ?ts=). The engine's 9 positions stay (8 gathered + 1 generated). Returns the end time.
  function slowGather(me, tl) {
    const { coins, front, pointer, slot } = me, N = coins.length, CS = me.cs, NG = N - 1, GAP = 0.45, FLY = 0.7;
    const backOut = gsap.parseEase("back.out(2)"), on = () => SH === me;
    const orb = () => { try { const o = ctx.handOrb(); return { x: o.x, y: o.y - 8 }; } catch (e) { return { x: me.CX - me.RX, y: me.CY }; } };
    let seated = 0;
    const seat = (c) => {
      if (!on() || !live(c)) return;
      c.seated = true; c.follow = false;
      gsap.fromTo(c.glow, { alpha: 0.9 }, { alpha: 0, duration: 0.35 });
      gsap.fromTo(c.scale, { x: CS * 1.15, y: CS * 1.15 }, { x: CS, y: CS, duration: 0.2, ease: "power2.out" });
      sfx("tick");
      if (++seated === 1) gsap.to(pointer, { alpha: 1, duration: 0.25 });
    };
    // one flight on the timeline: a bezier from from() (read at launch) to the coin's live slot (the wheel keeps turning)
    const flight = (c, t0, dur, from, s, free) => {                    // balls (user 2026-11-19 b): free = it leaves the hand ball itself
      const pr = { t: 0 }; let p0 = null, jx = 0;
      tl.to(pr, { t: 1, duration: dur, ease: "power2.inOut",
        onStart: () => { if (!on() || !live(c)) return; p0 = from(); jx = rnd(-80, 80); c.follow = false; c.glow.alpha = 0.5; },
        onUpdate: () => {
          if (!p0 || !on() || !live(c)) return;
          const hg = handGeo(); c.scale.set(s(pr.t));
          const to = clearHand(slot(c), coinR(c), hg), q0 = FX.bezier(p0, { x: (p0.x * 2 + to.x) / 3 + jx * 0.4, y: Math.min(p0.y, to.y) - 200 }, to, pr.t);
          const q = free ? q0 : clearHand(q0, coinR(c), hg);
          c.position.set(q.x, q.y);
        },
        onComplete: () => seat(c) }, t0);
    };
    // white 2026-11-17 (user: "look at the video 04:10 to 05:05", Fortune Garuda): the column turns into a shaft of light and
    // the coins rise out of its top one by one, each arcing up to its slot (was: from scattered chips of the column)
    // b22 (user 2026-11-20: "during the super wild now the multiplier comes out of the charge screen, but we need another way:
    // the multiplier frame burns with particles, the reel rotates, and during the rotation spherical chips go out from the
    // middle frame"; 8 + 1, the last one rolled on the hand ball as before): the balls leave the CENTRE FRAME (was the column's
    // top, right under the counter boards) while the column rolls hot with its gold-dust frame (game.js colRollShow).
    // ?swtop = the b21 start point
    const OUT_CF = !QS.has("swtop");
    const TR = ctx.TRAY, top = OUT_CF ? { x: ctx.COL_CX, y: ctx.COL_CY } : { x: ctx.COL_CX, y: TR[1] + 46 }, tEnd = 0.6 + (NG - 1) * GAP + FLY;
    if (OUT_CF) tl.call(() => { if (!on()) return; const f = ctx.colRollShow || (GX.ctx && GX.ctx.colRollShow);
      if (f) f(Math.max(0.5, (tEnd - 0.45) / Math.max(0.2, tl.timeScale()))); }, null, 0.2);
    const shaft = new PIXI.Container(); shaft.position.set(ctx.COL_CX, (TR[1] + TR[3]) / 2); shaft.alpha = 0; layers.boardFx.addChild(shaft); me.shaft = shaft;
    shaft.visible = SW_SHAFT;                                          // b18b: off by default (?swshaft); its timeline still runs, unseen
    const sh1 = sp(FX.tex.glow, shaft); sh1.blendMode = ADD; sh1.tint = 0xffc860; sh1.scale.set(1.15, (TR[3] - TR[1]) / 150);
    const sh2 = sp(FX.tex.glow, shaft); sh2.blendMode = ADD; sh2.tint = 0xfff2c8; sh2.scale.set(0.45, (TR[3] - TR[1]) / 170); sh2.alpha = 0.8;
    const sweep = sp(FX.tex.shine || FX.tex.glow, shaft); sweep.blendMode = ADD; sweep.tint = 0xfff4dc; sweep.rotation = Math.PI / 2; sweep.scale.set(1.4, 5); sweep.alpha = 0.5;
    tl.to(shaft, { alpha: 0.85, duration: 0.35 }, 0.25)
      .fromTo(sweep, { y: (TR[3] - TR[1]) / 2 }, { y: -(TR[3] - TR[1]) / 2, duration: 0.5, ease: "none", repeat: Math.max(0, Math.floor((tEnd - 0.25) / 0.5) - 1), immediateRender: false }, 0.25)
      .to(shaft, { alpha: 0, duration: 0.4, onComplete: () => { gsap.killTweensOf(sweep); kill(shaft); } }, tEnd);
    me.shaftKill = () => { gsap.killTweensOf(sweep); gsap.killTweensOf(sh2); kill(shaft); };
    for (let i = 0; i < NG; i++) {
      const c = coins[i], t0 = 0.6 + i * GAP;
      tl.call(() => {
        if (!on()) return;
        try { const v = ctx.colReel.views[1 + (i % 2)]; gsap.fromTo(v.flash, { alpha: 1 }, { alpha: 0, duration: 0.4 }); } catch (e) { /* no chip */ }
        try { gsap.fromTo(sh2, { alpha: 1 }, { alpha: 0.8, duration: 0.3 }); } catch (e) {}
        sfx("tick");
      }, null, t0);
      flight(c, t0, FLY, () => ({ x: top.x, y: top.y }), (t) => (t < 0.4 ? 0.35 + 0.75 * backOut(t / 0.4) : 1.1 + (CS - 1.1) * (t - 0.4) / 0.6));
    }
    // the generated position: a coin rolls through values in the bull's hand orb, stops on the real one, then takes its slot
    const cG = coins[NG], tG = 0.6 + (NG - 1) * GAP + FLY + 0.3, ROLL = 1.8, tL = tG + 0.2 + ROLL;
    const POOL = ctx.Engine.MULT_VALUES.slice();
    let roller = null, face = null, last = null, nextAt = 0, step = 1 / 14, nStep = 0;
    const pick = () => { let v; do { v = Math.random() < 1 / 6 ? (Math.random() < 0.5 ? -3 : "c2") : POOL[Math.floor(Math.random() * POOL.length)]; } while (v === last); return (last = v); };
    const dropRoller = () => { kill(face); kill(roller); face = roller = null; };
    // balls (user 2026-11-19 b): the rolling value is written ON the hand ball (numerals only, fitted to the orb, centred),
    // never a second ball over it; at the landing the real value stays on the orb, then its ball grows out of the orb's centre
    // (orb-sized) and flies to its slot
    // (b20: orbC / orbText are shared with the pick roller, see handRoller)
    let k0 = 0.5;
    const setFace = (dur) => {                                         // gx_picker setFace: the new face drops in from above
      if (!live(roller)) return;
      kill(face); face = BALLS ? orbText(pick(), roller) : coinOf(pick(), roller);
      face.y = -16; face.scale.y = 0.72;
      gsap.to(face, { y: 0, duration: dur, ease: "power2.out" }); gsap.to(face.scale, { y: 1, duration: dur, ease: "power2.out" });
    };
    me.dropRoller = dropRoller;
    me.follow = () => {
      const rl = live(roller), cf = cG.follow && live(cG);
      if (!rl && !cf) return;
      const p = BALLS ? orbC() : orb();                                  // balls: the orb's centre
      if (rl) roller.position.set(p.x, p.y);
      if (cf) cG.position.set(p.x, p.y);
    };
    tl.call(() => {
      if (!on()) return;
      roller = new PIXI.Container(); front.addChild(roller);
      const p = BALLS ? orbC() : orb(); roller.position.set(p.x, p.y); roller.scale.set(0);
      if (!BALLS) { const g = sp(FX.tex.glow, roller); g.blendMode = ADD; g.tint = 0xffd070; g.alpha = 0.45; g.scale.set(1.3); }   // balls: the orb is the glow
      setFace(0.05);
      gsap.to(roller.scale, { x: BALLS ? 1 : 0.8, y: BALLS ? 1 : 0.8, duration: 0.2, ease: "back.out(2.6)" });
    }, null, tG);
    const rs = { t: 0 };
    tl.to(rs, { t: ROLL, duration: ROLL, ease: "none", onUpdate: () => {   // 1/14 s steps for 1.2 s, then each 1.35x longer
      if (!on() || !live(roller) || rs.t < nextAt) return;
      setFace(Math.min(0.05, step * 0.8)); if (++nStep % 2 === 0) sfx("tick");
      if (rs.t > 1.2) step *= 1.35;
      nextAt = rs.t + step;
    } }, tG + 0.2);
    tl.call(() => {                                                    // it lands on the real value (gx_picker land)
      if (!on()) return;
      if (BALLS && live(roller) && live(cG)) {                         // balls (user 2026-11-19 b): the real value stays on the orb
        kill(face); face = orbText(cG.v, roller);
        gsap.fromTo(face.scale, { x: 1.3, y: 1.3 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.4)" });
        const q = orbC(); cG.position.set(q.x, q.y); cG.follow = true; cG.visible = false;
        k0 = (2 * q.rs * 0.95) / (cG.isBall ? BALL_D : 174);
        sfx("impact", false); if (ctx.flameKick) ctx.flameKick(1.0);
        return;
      }
      const p = orb(); dropRoller();
      if (!live(cG)) return;
      cG.position.set(p.x, p.y); cG.follow = true;
      gsap.fromTo(cG.scale, { x: 1.4, y: 1.4 }, { x: 1.05, y: 1.05, duration: 0.3, ease: "back.out(2.4)" });
      gsap.fromTo(cG.glow, { alpha: 0.95 }, { alpha: 0.45, duration: 0.35 });
      const sh = sp(FX.tex.shine || FX.tex.glow, front); sh.blendMode = ADD; sh.tint = 0xfff4dc; sh.rotation = -0.42; sh.position.set(p.x, p.y); sh.scale.set(0.1, 0.5);
      gsap.to(sh.scale, { x: 2.4, y: 0.18, duration: 0.26, ease: "power3.out" });
      gsap.to(sh, { alpha: 0, duration: 0.3, ease: "power2.in", onComplete: () => kill(sh) });
      sfx("impact", false); if (ctx.flameKick) ctx.flameKick(1.0);
    }, null, tL);
    if (BALLS) flight(cG, tL + 0.65, 0.6, () => { dropRoller(); cG.visible = true; return { x: cG.x, y: cG.y }; }, (t) => k0 + (CS - k0) * t, true);   // balls: out of the orb's centre, orb-sized
    else flight(cG, tL + 0.65, 0.6, () => ({ x: cG.x, y: cG.y }), (t) => 1.05 + (CS - 1.05) * t);   // holds 0.35 s in the hand, then flies
    return tL + 0.65 + 0.6 + 0.2;                                      // resolve 0.2 s after the last seat
  }
  GX.on("superHaloOpen", (d) => new Promise((resolve) => {
    if (SH) { resolve(); return; }
    try {
      const turbo = !!ctx.S.turbo, vals = (d.vals || [1]).slice(0, 9), N = vals.length, CS = WHEEL_CS;   // spec: 9 positions
      // b20 WHEEL: a true circle through the hand slot, N + 1 equal steps (was an oval RX 232 / RY 188 with an arc-length
      // spread and a gap by the hand, swLayout); every ball at the hand ball's size (was 0.72 for 7 or fewer)
      const WG = wheelGeo(N), RX = WG.R, RY = WG.R, CX = WG.CX, CY = WG.CY;
      const back = new PIXI.Container(); back.position.set(CX, CY); back.scale.set(0.2); back.alpha = 0;
      layers.bullL.addChildAt(back, 0);
      const rays = sp(FX.tex.burst, back); rays.blendMode = ADD; rays.tint = 0xffb040; rays.alpha = 0.3; rays.scale.set(2.2);
      let rel = null; if (window.GXRays) { rays.visible = false; rel = window.GXRays.hold(0.85); }
      const haze = sp(FX.tex.glow, back); haze.blendMode = ADD; haze.tint = 0xff9a30; haze.alpha = 0.18; haze.scale.set(3.6);
      const ring = sp(ringTex, back); ring.scale.set(RX / 262, RY / 262);
      const front = new PIXI.Container(); layers.fxTop.addChild(front);
      const coins = vals.map((v, i) => { const c = coinOf(v, front); c.ang = WG.ang[i]; c.scale.set(0); c.position.set(ctx.COL_CX, ctx.COL_CY); return c; });   // b20: index N-1 (the generated value) = the slot just below the hand
      const pointer = new PIXI.Graphics().beginFill(0x2a0e02).drawPolygon([-20, -6, 20, -6, 0, 26]).endFill()
        .beginFill(0xffd36b).lineStyle(2, 0x7a4a10).drawPolygon([-14, -2, 14, -2, 0, 19]).endFill();
      pointer.position.set(CX, CY - RY - 58); pointer.alpha = 0; front.addChild(pointer);
      const P = new FX.Particles(front);
      const st = { rot: 0 };                                          // the wheel stands still (Garuda); the pointer is not drawn:
      pointer.renderable = false;                                     // (b20: the choice rolls on the hand ball)
      let me = null;                                                    // this wheel (SH goes null when it closes)
      const slot = (c) => ({ x: CX + Math.cos(c.ang + st.rot) * RX, y: CY + Math.sin(c.ang + st.rot) * RY });
      const tick = () => {
        const dr = gsap.ticker.deltaRatio();
        rays.rotation += 0.004 * dr;
        if (!me) return;
        if (me.follow) me.follow();                                      // slow fill: the hand coin rides the bull's orb
        if (me.pickR) { me.pickR.follow(); if (probe && probe.wheel === "B") probe.roll = me.pickR.v; }   // b20: a pick's roller rides the hand ball
        const hg = handGeo();                                            // balls (user 2026-11-19 b): never over the hand ball
        me.coins.forEach((c) => { if (c.seated && !c.destroyed) { const p = clearHand(slot(c), coinR(c), hg); c.position.set(p.x, p.y); } });
        P.update(Math.min(0.05, dr / 60));
      };
      me = SH = { back, front, coins, P, st, slot, CX, CY, RX, RY, pointer, tick, rel, N, cs: CS, haze, follow: null, tl: null, done: resolve, pickR: null };
      gsap.ticker.add(tick);
      const tl = gsap.timeline({ onComplete: resolve }); tl.timeScale(turbo ? 2.2 : 1); me.tl = tl;
      tl.to(back, { alpha: 1, duration: 0.2 }, 0).to(back.scale, { x: 1, y: 1, duration: 0.45, ease: "back.out(1.5)" }, 0)
        .call(() => sfx("rise", 0.6), null, 0.05);                  // no flash on the bull's face, no ring
      tl.to({}, { duration: 0.01 }, slowGather(me, tl));       // white 2026-11-16: the SUPER WILD sequence (the only fill since 2026-11-17)
    } catch (e) { console.warn("gx superHaloOpen", e); SH = null; resolve(); }
  }));
  // white 2026-11-17 (user: "look at the video 04:10 to 05:05 to fix the animation", Fortune Garuda): one Choice on the
  // SUPER WILD wheel. 1. the SUPER WILD that owns it pops and turns into a fireball, three flame streaks fan up into the ring,
  // the ring flares and every coin pops (d.sw; else the old beam from d.from); 2. b20 WHEEL: the values still on the ring roll
  // ON the hand ball, slow down and land on the engine's value (d.v at d.pos) - no running light, no winner growth, nothing
  // dimmed; 3. the ring ball at d.pos glides into the hand ball (its slot stays empty: positions never refill); 4. d.throw (a
  // multiplier / CHARGE): the ring fades, the rolled value stays on the hand ball (window.GX_HALO_HANDOFF txt) for the bull
  // to throw (game.js bullOrb picked; superHaloShow re-opens the ring); else (+2) the "+2" leaves the hand ball in a short
  // calm flight to d.to (the counter) and the ring stays.
  function swShot(S2, from, tl, t0) {
    const cs = S2.cs || 0.72, on = () => SH === S2;
    tl.call(() => {
      if (!on()) return;
      try { for (let reel = 0; reel < ctx.reels.length; reel++) for (let row = 0; row < 3; row++) {
        const sv = ctx.reels[reel].view(row);
        if (sv && sv.id === "super_wild" && sv.c && Math.hypot(ctx.REEL_CX[reel] - from.x, ctx.rowY(row) - from.y) < 6) {
          const b = sv.c.scale.x; gsap.fromTo(sv.c.scale, { x: b * 1.2, y: b * 1.2 }, { x: b, y: b, duration: 0.5, ease: "power2.out" }); } } } catch (e) { /* no view */ }
      const fb = new PIXI.Container(); fb.position.set(from.x, from.y); S2.front.addChildAt(fb, 0);
      const g = sp(FX.tex.glow, fb); g.blendMode = ADD; g.tint = 0xff7a1a; g.scale.set(0.1);
      const core = sp(FX.tex.glow, fb); core.blendMode = ADD; core.tint = 0xfff0b0; core.scale.set(0.05);
      gsap.to(g.scale, { x: 1.35, y: 1.35, duration: 0.3, ease: "power2.out" }); gsap.to(core.scale, { x: 0.6, y: 0.6, duration: 0.3, ease: "power2.out" });
      gsap.to(fb, { alpha: 0, duration: 0.25, delay: 0.42, onComplete: () => kill(fb) });
      for (let k = 0; k < Math.round(10 * M); k++) S2.P.emit({ tex: FX.tex.flame || FX.tex.dot, x: from.x + rnd(-30, 30), y: from.y + rnd(-20, 20), vx: rnd(-60, 60), vy: rnd(-260, -120),
        s0: rnd(0.4, 0.7), s1: 0.1, life: rnd(0.35, 0.6), a0: 0.9, a1: 0, tint: Math.random() < 0.5 ? 0xff9a3a : 0xffd070, blend: ADD });
      sfx("rise", 0.5);
    }, null, t0);
    [-1, 0, 1].forEach((k, i) => {
      const to = { x: S2.CX + k * S2.RX * 0.5, y: S2.CY + S2.RY * 0.42 - Math.abs(k) * 12 }, pr = { t: 0 }, at = t0 + 0.32 + i * 0.045;
      const ctrl = { x: (from.x + to.x) / 2 + k * 150, y: to.y + (from.y - to.y) * 0.3 };
      let head = null, tail = null, px = from.x, py = from.y;
      tl.call(() => {
        if (!on()) return;
        head = sp(FX.tex.glow, S2.front); head.blendMode = ADD; head.tint = 0xffb040; head.scale.set(0.55); head.position.set(from.x, from.y);
        tail = sp(FX.tex.shine || FX.tex.glow, S2.front); tail.anchor.set(1, 0.5); tail.blendMode = ADD; tail.tint = 0xff8a2a; tail.scale.set(0.6, 1.5); tail.position.set(from.x, from.y);
      }, null, at)
        .to(pr, { t: 1, duration: 0.34, ease: "power2.in", onUpdate: () => {
          if (!live(head) || !live(tail)) return;
          const q = FX.bezier(from, ctrl, to, pr.t), vx = q.x - px, vy = q.y - py; px = q.x; py = q.y;
          head.position.set(q.x, q.y); tail.position.set(q.x, q.y); if (vx * vx + vy * vy > 0.25) tail.rotation = Math.atan2(vy, vx);
          tail.scale.x = 0.6 + 1.7 * pr.t;
          if (Math.random() < 0.7 * M + 0.2) S2.P.emit({ tex: FX.tex.flame || FX.tex.dot, x: q.x, y: q.y, vx: rnd(-40, 40), vy: rnd(-40, 40), s0: 0.45, s1: 0, life: 0.3, a0: 0.8, a1: 0, tint: 0xffa040, blend: ADD });
        }, onComplete: () => { kill(head); kill(tail); } }, at);
    });
    const tHit = t0 + 0.32 + 0.09 + 0.34;
    tl.call(() => {
      if (!on()) return;
      // b18b (QA: a white-out over the bull's head and the whole ring each time the ring opens for a pick): no haze flare,
      // no flash at the ring centre, no coin glow pulse (SW_HIT_FLASH restores them); the ring breathes, the coins pop
      if (SW_HIT_FLASH && S2.haze) gsap.fromTo(S2.haze, { alpha: 0.85 }, { alpha: 0.18, duration: 0.6, ease: "power2.out" });
      gsap.fromTo(S2.back.scale, { x: 1.08, y: 1.08 }, { x: 1, y: 1, duration: 0.45, ease: "power2.out" });
      S2.coins.forEach((o) => { if (o.used || !live(o)) return;
        gsap.fromTo(o.scale, { x: cs * 1.12, y: cs * 1.12 }, { x: cs, y: cs, duration: 0.4, ease: "power2.out" }); if (SW_HIT_FLASH) gsap.fromTo(o.glow, { alpha: 0.9 }, { alpha: 0, duration: 0.45 }); });   // b20: x1.12 (was 1.3): the hand slot's neighbours keep their equal step
      if (SW_HIT_FLASH) ctx.flashAt(S2.CX, S2.CY, 0xfff0c0, 1.6, 0.25);
      sfx("impact", true); if (ctx.shake) ctx.shake(5, 0.15);
    }, null, tHit);
    return tHit + 0.45;
  }
  function garudaPick(S2, c, idx, v, d, turbo, resolve) {
    const st = S2.st, cs = S2.cs || 0.72, on = () => SH === S2;
    const tl = gsap.timeline({ onComplete: resolve }); tl.timeScale(turbo ? 2.2 : 1);
    let t = 0;
    if (d.sw && d.from) t = swShot(S2, d.from, tl, 0);
    else {                                                            // no SUPER WILD (Buy Bonus): the old beam from d.from
      tl.call(() => {
        if (!on()) return;
        const s = d.from || { x: ctx.COL_CX, y: ctx.COL_CY }, dx = S2.CX - s.x, dy = S2.CY - s.y, L = Math.hypot(dx, dy);
        const beam = new PIXI.Container(); beam.position.set(s.x, s.y); beam.rotation = Math.atan2(dy, dx) - Math.PI / 2; S2.front.addChildAt(beam, 0);
        const outer = sp(FX.tex.glow, beam); outer.anchor.set(0.5, 0); outer.blendMode = ADD; outer.tint = 0xff7a20; outer.scale.set(0.9, L / 256); outer.alpha = 0;
        const core = sp(FX.tex.glow, beam); core.anchor.set(0.5, 0); core.blendMode = ADD; core.tint = 0xfff2c0; core.scale.set(0.32, L / 256); core.alpha = 0;
        gsap.timeline({ onComplete: () => kill(beam) }).to([outer, core], { alpha: 1, duration: 0.08 }).to([outer, core], { alpha: 0, duration: 0.4, delay: 0.12, ease: "power2.in" });
        ctx.flashAt(S2.CX, S2.CY, 0xfff0c0, 1.0, 0.18); sfx("impact", false);
      }, null, 0);
      t = 0.5;
    }
    // b20 WHEEL: the choice rolls ON the hand ball through the values still on the ring, slows and lands on the engine's value
    // (was: a light running round the coins, the rest dimmed, the winner growing x1.75 with a flash). The ring stays as it is.
    if (S2.pickR) S2.pickR.drop();
    const RL = handRoller(S2.front, () => S2.coins.filter((o) => live(o) && !o.used).map((o) => o.v), on);
    S2.pickR = RL; probe = { wheel: "B", phase: "roll", v, pos: idx, roll: null };
    t = rollOn(tl, RL, t, 1.3, 0.75, v, () => { if (probe && probe.wheel === "B") probe.phase = "landed"; sfx("impact", true); if (ctx.flameKick) ctx.flameKick(1.0); });
    // the ring ball at d.pos leaves its slot and merges into the hand ball; its slot stays empty
    tl.call(() => { if (on()) mergeIn(c, turbo ? 0.2 : 0.45); }, null, t + 0.05);
    t += 0.05 + 0.45;
    if (d.throw) {
      tl.call(() => {
        if (!on()) return;
        gsap.to(S2.back, { alpha: 0, duration: 0.3 });
        S2.coins.forEach((o) => { if (o !== c && live(o)) gsap.to(o, { alpha: 0, duration: 0.25 }); });
        S2.hidden = true;
        // the rolled value stays on the hand ball and goes to the throw (gx_picker throwCharge adopts it; b18b: a CHARGE
        // value carries no glow either way)
        S2.pickR = null; RL.handoff(8);
        if (probe && probe.wheel === "B") probe = null;
      }, null, t);
      tl.to({}, { duration: 0.01 }, t + 0.3);
    } else {
      // "+2 CHOICES": the "+2" leaves the hand ball in a short calm flight to the counter (no flash at the landing)
      tl.call(() => { if (!on()) return; S2.pickR = null; RL.flyTo(d.to || { x: ctx.COL_CX, y: ctx.COL_CY }, turbo ? 0.25 : 0.45); if (probe && probe.wheel === "B") probe = null; }, null, t)
        .call(() => { if (on()) shRest(); }, null, t + 0.45)
        .to({}, { duration: 0.01 }, t + 0.47);
    }
  }
  GX.on("superHaloShow", () => new Promise((resolve) => {     // white 2026-11-17: the ring comes back after a throw
    if (!SH || !SH.hidden) { resolve(); return; }
    const S2 = SH; S2.hidden = false;
    gsap.to(S2.back, { alpha: 1, duration: 0.35 }); gsap.fromTo(S2.back.scale, { x: 0.9, y: 0.9 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(1.6)" });
    S2.coins.forEach((o) => { if (!live(o)) return; gsap.killTweensOf(o); if (o.used) { o.visible = false; o.alpha = 0; } else gsap.to(o, { alpha: 1, duration: 0.35 }); });   // b20: spent slots stay empty (was alpha 0.42)
    shRest(); sfx("rise", 0.4);
    gsap.delayedCall(ctx.S.turbo ? 0.2 : 0.42, resolve);
  }));
  GX.on("superHaloPick", (d) => new Promise((resolve) => {
    if (!SH) { resolve(); return; }
    try {
      const S2 = SH, turbo = !!ctx.S.turbo, v = d.v, st = S2.st;
      // spec Fortune Choice: the engine names the position (d.pos). Else a coin of this value; none -> the coin
      // furthest from the pointer quietly becomes one
      let idx = d.pos !== undefined && S2.coins[d.pos] ? d.pos : S2.coins.findIndex((c) => c.v === v && !c.used);
      if (idx < 0) {
        let far = 0, fd = -1;
        S2.coins.forEach((c, i) => { const a = Math.abs(Math.atan2(Math.sin(c.ang + st.rot + Math.PI / 2), Math.cos(c.ang + st.rot + Math.PI / 2))); if (a > fd) { fd = a; far = i; } });
        const old = S2.coins[far], nc = coinOf(v, S2.front); nc.ang = old.ang; nc.seated = true; nc.scale.set(S2.cs || 0.72); nc.position.copyFrom(old.position);
        S2.coins[far] = nc; kill(old); idx = far;
      }
      const c = S2.coins[idx];
      garudaPick(S2, c, idx, v, d, turbo, resolve);           // white 2026-11-17: the SUPER WILD wheel (Fortune Garuda 04:38-04:58)
    } catch (e) { console.warn("gx superHaloPick", e); resolve(); }
  }));
  GX.on("superHaloClose", () => new Promise((resolve) => {
    if (!SH) { resolve(); return; }
    const S2 = SH; SH = null;
    try {
      // white 2026-11-16: closed while the slow fill still runs (round cap): stop it, drop the hand coin, release its promise
      try { if (S2.tl) S2.tl.kill(); if (S2.dropRoller) S2.dropRoller(); S2.follow = null; if (S2.done) S2.done(); } catch (e) {}
      try { if (S2.pickR) S2.pickR.drop(); S2.pickR = null; if (probe && probe.wheel === "B") probe = null; } catch (e) {}   // b20: closed mid-roll -> no roller left on the hand ball
      try { if (S2.shaft && !S2.shaft.destroyed) gsap.to(S2.shaft, { alpha: 0, duration: 0.2, onComplete: () => S2.shaftKill && S2.shaftKill() }); } catch (e) {}
      gsap.to(S2.back, { alpha: 0, duration: 0.3 }); gsap.to(S2.back.scale, { x: 1.15, y: 1.15, duration: 0.3 });
      S2.coins.forEach((c) => { gsap.to(c, { alpha: 0, duration: 0.25 }); gsap.to(c.scale, { x: 0.3, y: 0.3, duration: 0.25 }); });
      gsap.to(S2.pointer, { alpha: 0, duration: 0.2 });
    } catch (e) {}
    gsap.delayedCall(0.35, () => { gsap.ticker.remove(S2.tick); try { if (S2.rel) S2.rel(); } catch (e) {} kill(S2.back); kill(S2.front); resolve(); });
  }));
});
