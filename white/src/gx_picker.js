// Fortune Bull 1000 - effect plugin: picker (see src/gx.js)
// 1. throwCharge: a multiplier coin is conjured in the bull's raised hand and works as a mini reel (faces cycle ~15/s
//    with a vertical roll, slow down, three tinted pulses, light streak + burst as it lands on the real value).
// 2. throwRelease: the coin vanishes at once (the game's comet takes over), leaving a small ring at the hand.
// 3. multiplier hit accent: when the plaque takes the hit (multHit impact) a gold-white starburst + crisp ring
//    reach 15% of the screen width (RECREATION_SPEC "Multiplier hit").
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, FX, layers, Engine, W, MOBILE, GPASS } = ctx;
  const fxTop = layers.fxTop;
  const ADD = PIXI.BLEND_MODES.ADD;
  const POOL = Engine.MULT_VALUES.filter((v) => v > 1);
  const live = (o) => o && !o.destroyed;
  const KNOWN = new Set([...Engine.MULT_VALUES, ...(Engine.NUDGE_CHIPS || [])]);
  // a value with no painted coin (a summed multiplier): the nearest coin below it
  const coinOf = (v) => (v < 0 || KNOWN.has(v) ? v : Engine.MULT_VALUES.filter((m) => m <= v).pop() || 1);

  // ---------- textures ----------
  const faceTex = (v) => {
    try {
      v = coinOf(v);
      if (v < 0) return ctx.T("UI/charge_badge");          // 2026-11-18: a Fortune Choice CHARGE coin (as on the wheel, gx_halo chargeCoin)
      if (GPASS) { const t = PIXI.Assets.get(`assets/Multipliers/coin_${v}.webp`); if (t) return t; }
      return ctx.T(`Multipliers/chip_bg_${v}`);
    } catch (e) { return PIXI.Texture.EMPTY; }
  };
  const labelTex = (v) => {
    if (v < 0) return PIXI.Texture.EMPTY;                   // the CHARGE badge carries its own art (its count shows in the column)
    try { return ctx.T(`Multipliers/label_${v}x`); } catch (e) { return PIXI.Texture.EMPTY; }
  };
  const sp = (tex, parent) => { const s = new PIXI.Sprite(tex || PIXI.Texture.EMPTY); s.anchor.set(0.5); if (parent) parent.addChild(s); return s; };

  // hand position in fxTop space: the game's flame point, else the clip-px hand mapped through the idle clip placement
  function handPos() {
    const f = ctx.flame;
    if (f && f.gx != null) return { x: f.gx, y: f.gy - 70, on: f.on == null ? 1 : f.on };
    try {
      const h = ctx.handNow(), clips = (window.G && window.G.clips) || {};
      const cfg = (clips.bull_idle || clips.bull_big || { cfg: { x: 162, y: -116.9, w: 725 } }).cfg, sc = cfg.w / 720, b = ctx.bull;
      const gx = cfg.x + h.x * sc, gy = cfg.y + h.y * sc;
      const q = ctx.bullToL(b.x + (gx - b.x) * b.scale.x, b.y + (gy - b.y) * b.scale.y);
      return { x: q[0], y: q[1] - 70, on: 1 };
    } catch (e) { return null; }
  }

  // balls (user 2026-11-19 b): the bull's hand orb in fxTop space (centre, sphere radius rs) for a wheel ball merging into it
  function orbGeo() {
    try {
      const o = ctx.flame && ctx.flame.c && ctx.flame.c.orb; if (!o) return null;
      const P = PIXI.Point, a = fxTop.toLocal(o.orbM.toGlobal(new P(0, 0))), b = fxTop.toLocal(o.orbM.toGlobal(new P(o.R, 0)));
      return { x: a.x, y: a.y, rs: Math.hypot(b.x - a.x, b.y - a.y) };
    } catch (e) { return null; }
  }

  // ---------- 1. the picker ----------
  let cur = null;
  function kill(ringFrom) {
    const k = cur; cur = null;
    if (!k) return;
    try { k.tw && k.tw.kill(); } catch (e) {}
    try { k.extra.forEach((t) => t.kill()); } catch (e) {}
    try { gsap.ticker.remove(k.follow); } catch (e) {}
    if (ringFrom && live(k.c) && !k.txt) {                         // b20: a wheel's value leaves the hand ball quietly (no ring / flash)
      const p = ringFrom.x != null ? ringFrom : { x: k.c.x, y: k.c.y };
      ctx.ringAt(p.x, p.y, k.tint, 0.9, 0.25);
      ctx.flashAt(p.x, p.y, 0xfff4dc, 0.5, 0.12);
    }
    try { gsap.killTweensOf([k.c, k.c.scale, k.coin, k.coin.scale, k.glow, k.glow.scale, k.face, k.face.scale, k.label, k.label.scale]); } catch (e) {}
    if (live(k.c)) { k.c.visible = false; k.c.destroy({ children: true }); }
  }

  // debug probe for qa/gx_picker.mjs
  window.GX_PICKER = () => (cur && live(cur.c) ? { phase: cur.phase, v: cur.v, x: cur.c.x, y: cur.c.y, s: cur.c.scale.x, vis: cur.c.visible, on: ctx.flame.on, t: cur.T0 ? cur.T0.t : 0, cd: cur.cd } : null);
  GX.on("throwCharge", (d) => {
    kill(null);
    const cd = Math.max(0.3, +d.cd || 0.8), tint = d.tint || 0xffb040, short = cd < 0.6;
    const L = (window.G && window.G.last) || {};
    // the throw that starts a NUDGE-chip feature lands on that chip; otherwise the round's multiplier
    const real = d.label ? d.label : L.startMult < 0 ? L.startMult : L.mult > 1 ? L.mult : null;
    if (real == null) return;
    const SC = MOBILE ? 0.85 : 0.8;
    const c = new PIXI.Container(); c.scale.set(0);
    const glow = sp(FX.tex.glow, c); glow.tint = tint; glow.blendMode = ADD; glow.alpha = 0.45; glow.scale.set(0.9);
    // b18b (QA: no aura on a picked CHARGE coin, ring / hand / coin): a wheel's CHARGE coin rides the hand without its glow,
    // light streak or flash
    const calmC = !!d.picked && real < 0; if (calmC) glow.visible = false;
    const coin = new PIXI.Container(); c.addChild(coin);
    const face = sp(faceTex(POOL[0]), coin);
    // the thin gold rim of the stone-pass coins rides on the face (hidden on the square NUDGE plate)
    const rimT = GPASS && PIXI.Assets.get("assets/Multipliers/coin_rim.webp");
    face.rim = rimT ? sp(rimT, face) : null;
    const setRim = (v) => { if (face.rim) face.rim.visible = coinOf(v) > 0; face.scale.set(v < 0 ? 0.52 : 1); };   // (the CHARGE badge art is drawn at 0.52, as on the wheel)
    const label = sp(labelTex(POOL[0]), coin); if (GPASS) label.scale.set(0.85);
    const sheen = sp(FX.tex.glow, coin); sheen.tint = 0xffffff; sheen.blendMode = ADD; sheen.alpha = 0; sheen.scale.set(1.1, 0.75);
    const k = { c, coin, glow, face, label, tint, extra: [], follow: null, tw: null, phase: "pop", v: POOL[0] };
    cur = k;
    const p0 = handPos();
    if (p0) c.position.set(p0.x, p0.y);
    // hand-off from the halo wheel (gx_halo): adopt its winning coin in the same frame, same place and size, and carry it into the hand
    const H = d.picked ? window.GX_HALO_HANDOFF : null; window.GX_HALO_HANDOFF = null;
    let blend = null;
    if (H && live(H.c) && H.txt) {
      // b20 WHEEL (user 2026-11-19: "choosing should happen always in the hand ball, and the hand ball should be thrown"): the
      // value rolled ON the hand ball (gx_halo handRoller) - adopt its numerals, keep them centred on the orb and fitted to it
      // (k.follow) until the release; no chip face, glow, sheen or second ball over the hand ball
      try { if (H.stop) H.stop(); } catch (e) {}
      gsap.killTweensOf(H.c); gsap.killTweensOf(H.c.scale);
      coin.addChild(H.c); H.c.position.set(0, 0); H.c.scale.set(1); H.c.alpha = 1; H.c.visible = true;
      face.visible = label.visible = false; glow.visible = false; sheen.visible = false;
      k.txt = H.c; k.rs0 = H.rs || 42; k.handoff = true;
      const o = orbGeo(); if (o) c.position.set(o.x, o.y); c.scale.set(o ? o.rs / k.rs0 : 1);
    } else if (H && live(H.c)) {
      blend = { t: 0, x: H.c.x, y: H.c.y }; k.handoff = true;
      c.position.set(H.c.x, H.c.y); c.scale.set(H.c.scale.x);
      if (KNOWN.has(real) || real < 0) { face.texture = faceTex(real); label.texture = labelTex(real); setRim(real); }
      if (H.c.isBall) {                                              // balls (user 2026-11-19): adopt the wheel's fire ball itself (no chip swap)
        gsap.killTweensOf(H.c); gsap.killTweensOf(H.c.scale);
        coin.addChildAt(H.c, coin.getChildIndex(sheen)); H.c.position.set(0, 0); H.c.scale.set(1); H.c.alpha = 1; H.c.glow.alpha = 0;
        face.visible = label.visible = false; k.ball = H.c;
        glow.visible = false; k.s0 = H.c.scale.x;                    // balls (user 2026-11-19 b): it merges into the hand ball (its own glow)
      } else try { H.c.destroy({ children: true }); } catch (e) {}
      k.extra.push(gsap.to(blend, { t: 1, duration: Math.min(0.4, cd * 0.45), ease: "power2.inOut" }));
    }
    // above the game's own charge glow (added right after this event)
    Promise.resolve().then(() => { if (cur === k && live(c)) fxTop.addChild(c); });
    fxTop.addChild(c);
    k.follow = () => {
      if (!live(c)) return;
      const p = handPos(); if (!p) return;
      if (k.txt) {                                                   // b20 WHEEL: the numerals ride the hand ball's centre at its size
        const o = orbGeo(), q = o || p; c.position.set(q.x, q.y); c.scale.set(o ? o.rs / k.rs0 : 1);
        c.visible = p.on > 0.05; return;
      }
      if (k.ball) {                                                  // balls (user 2026-11-19 b): centred on the hand ball, its size x 0.95
        const o = orbGeo(), kk = o ? (2 * o.rs * 0.95) / (k.ball.ballD || 168) : SC, q = o || p;
        const e = blend && blend.t < 1 ? blend.t : 1;
        c.position.set(blend.x + (q.x - blend.x) * e, blend.y + (q.y - blend.y) * e); c.scale.set(k.s0 + (kk - k.s0) * e);
        c.visible = e < 1 || p.on > 0.05; return;
      }
      if (blend && blend.t < 1) { const e = blend.t; c.position.set(blend.x + (p.x - blend.x) * e, blend.y + (p.y - blend.y) * e); c.visible = true; return; }
      c.position.set(p.x, p.y); c.visible = p.on > 0.05;
    };
    gsap.ticker.add(k.follow);

    // timeline in game time (respects ?ts= and turbo time scale)
    const popD = Math.min(0.25, cd * 0.3);
    // land while the hand is still held high (the throw clip swings it away in the last third of cd)
    const tLand = d.picked ? 0.01 : cd * (short ? 0.6 : 0.62);      // picked by the halo wheel: it arrives already landed
    const tSlow = tLand * 0.6;
    const pulses = d.picked ? [cd * 0.3] : short ? [cd * 0.3] : [cd * 0.14, cd * 0.3, cd * 0.46];
    if (k.txt || (blend && k.ball)) { /* balls (user 2026-11-19 b) / b20: k.follow sizes it to the hand ball */ }
    else if (blend) k.extra.push(gsap.to(c.scale, { x: SC * 1.08, y: SC * 1.08, duration: Math.min(0.4, cd * 0.45), ease: "power2.inOut" }));
    else k.extra.push(gsap.to(c.scale, { x: SC, y: SC, duration: popD, ease: "back.out(2.6)" }));
    if (!calmC && !k.txt) ctx.flashAt(p0 ? p0.x : 0, p0 ? p0.y : 0, tint, 0.6, 0.18);   // b20: no flash on the hand ball when a wheel's value arrives

    let last = POOL[0], nextAt = 0, step = 1 / 15, landed = false, pi = 0;
    const setFace = (v) => {
      face.texture = faceTex(v); label.texture = labelTex(v); setRim(v);
      // vertical roll: the new face drops in from above, squashed
      gsap.killTweensOf([coin, coin.scale]);
      coin.y = -16; coin.scale.y = 0.72; coin.alpha = 0.85;
      gsap.to(coin, { y: 0, alpha: 1, duration: Math.min(0.06, step * 0.8), ease: "power2.out" });
      gsap.to(coin.scale, { y: 1, duration: Math.min(0.06, step * 0.8), ease: "power2.out" });
    };
    const pulse = () => {
      const big = 1 + 0.08 * ++pi;
      gsap.killTweensOf(glow); gsap.killTweensOf(glow.scale);
      gsap.fromTo(glow, { alpha: 1 }, { alpha: 0.45, duration: Math.min(0.3, cd * 0.15), ease: "power2.out" });
      gsap.fromTo(glow.scale, { x: 1.35 * big, y: 1.35 * big }, { x: 0.9, y: 0.9, duration: Math.min(0.3, cd * 0.15), ease: "power2.out" });
      if (!k.ball && !k.txt) gsap.fromTo(c.scale, { x: SC * 1.2 * big, y: SC * 1.2 * big }, { x: SC, y: SC, duration: Math.min(0.22, cd * 0.12), ease: "power2.out" });   // balls (b) / b20: sized by k.follow
      if (!k.handoff) ctx.ringAt(c.x, c.y, tint, 0.8 + 0.2 * pi, 0.28);   // white 2026-11-17: a wheel coin arrives without rings
    };
    const land = () => {
      landed = true; k.phase = "landed"; k.v = real;
      face.texture = faceTex(real); setRim(real);
      if (KNOWN.has(real) || real < 0) label.texture = labelTex(real);
      else if (!k.ball && !k.txt) {                                      // balls (user 2026-11-19) / b20: the adopted ball / numerals carry the value
        label.texture = PIXI.Texture.EMPTY;
        try { const tx = new PIXI.Text(real + "x", FX.gold(64)); tx.anchor.set(0.5); coin.addChild(tx); } catch (e) {}
      }
      gsap.killTweensOf([coin, coin.scale]); coin.y = 0; coin.alpha = 1; coin.scale.set(1);
      if (!k.handoff) gsap.fromTo(c.scale, { x: SC * 1.45, y: SC * 1.45 }, { x: SC * 1.08, y: SC * 1.08, duration: 0.3, ease: "back.out(2.4)" });
      if (!calmC && !k.ball && !k.txt) gsap.fromTo(sheen, { alpha: 0.55 }, { alpha: 0, duration: 0.3, ease: "power2.in" });   // b18b: no white sheen over a picked CHARGE coin
      gsap.fromTo(glow, { alpha: 1 }, { alpha: 0.65, duration: 0.35 });
      gsap.fromTo(glow.scale, { x: 2.0, y: 2.0 }, { x: 1.15, y: 1.15, duration: 0.35, ease: "power2.out" });
      // light streak: a hot diagonal blade across the coin, sweeping through
      if (!calmC && !k.ball && !k.txt) {                                // balls (user 2026-11-19 b) / b20: no white sheen / streak / flash over the hand ball
      const st = sp(FX.tex.shine || FX.tex.glow); st.blendMode = ADD; st.tint = 0xfff4dc; st.rotation = -0.42;
      st.position.set(c.x, c.y); st.scale.set(0.1, 0.5); st.alpha = 1; fxTop.addChild(st);
      gsap.to(st.scale, { x: 2.4, y: 0.18, duration: 0.26, ease: "power3.out" });
      gsap.to(st, { alpha: 0, duration: 0.3, ease: "power2.in", onComplete: () => live(st) && st.destroy() });
      ctx.flashAt(c.x, c.y, 0xffe6a0, 0.8, 0.16); }
      if (!k.handoff) { ctx.starFlash(c.x, c.y, 1.1, 0xfff2c0); ctx.ringAt(c.x, c.y, tint, 1.7, 0.32); ctx.burstAt(c.x, c.y, 0xffd060, MOBILE ? 7 : 14); }
      // the coin stays readable on top of its own burst
      fxTop.addChild(c);
    };
    const T0 = { t: 0 }; k.T0 = T0; k.cd = cd;
    k.tw = gsap.to(T0, { t: cd + 1.5, duration: cd + 1.5, ease: "none", onUpdate: () => {
      const t = T0.t;
      while (pi < pulses.length && t >= pulses[pi]) pulse();
      if (!landed) {
        if (t >= tLand) land();
        else if (t >= nextAt && t > popD * 0.4) {
          let v; do { v = POOL[Math.floor(Math.random() * POOL.length)]; } while (v === last && POOL.length > 1);
          last = v; setFace(v); k.v = v; if (t > popD) k.phase = "cycle";
          // decelerate after tSlow: each step a bit longer, like a reel coming to rest
          if (t > tSlow) step = Math.min(0.2, step * 1.35);
          nextAt = t + step;
        }
      }
    }, onComplete: () => { if (cur === k) kill(null); } });
  });

  // ---------- 2. release: the coin is gone, the comet takes over ----------
  GX.on("throwRelease", (d) => { kill(d && d.from ? d.from : {}); });

  // ---------- 3. multiplier hit accent at the plaque ----------
  // multHit has no event: its impact is the only thing that throws the plaque scale above 1.12 x PLAQUE_S (0.62)
  const HIT_S = 0.62 * 1.12;
  let plaque = null, prevS = 0;
  const findPlaque = () => {
    const pl = layers.plaqueL; if (!pl) return null;
    return pl.children.find((o) => o instanceof PIXI.Container && Math.abs(o.x - 540) < 1 && Math.abs(o.y - 1370) < 6) || null;
  };
  // starburst rays as one canvas texture (gold-white tapered blades)
  const burstTex = (() => {
    try {
      const S = 256, cv = document.createElement("canvas"); cv.width = cv.height = S; const g = cv.getContext("2d");
      g.translate(S / 2, S / 2); g.globalCompositeOperation = "lighter";
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2, len = i % 2 ? S * 0.33 : S * 0.5, wd = i % 2 ? 0.05 : 0.08;
        const gr = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        gr.addColorStop(0, "rgba(255,255,240,1)"); gr.addColorStop(0.45, "rgba(255,226,140,0.8)"); gr.addColorStop(1, "rgba(255,190,60,0)");
        g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0);
        g.lineTo(Math.cos(a - wd) * len * 0.35, Math.sin(a - wd) * len * 0.35); g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        g.lineTo(Math.cos(a + wd) * len * 0.35, Math.sin(a + wd) * len * 0.35); g.closePath(); g.fill();
      }
      return PIXI.Texture.from(cv);
    } catch (e) { return FX.tex.star8; }
  })();
  function hitAccent() {
    return;   // white 2026-11-16 (calm look): no starburst / ring / sparks at the plaque; the win board hit (game.js winBarHit) is the accent
    if (!live(plaque)) return;
    const gp = plaque.getGlobalPosition(), p = fxTop.toLocal(gp);
    const R = 0.15 * W;
    const L = (window.G && window.G.last) || {}, v = L.mult || 2;
    const hitK = Math.min(1, Math.log10(Math.max(2, v)) / 2);
    const tint = ctx.multTint ? ctx.multTint(v) : 0xffd060;
    // starburst out to 15% of the screen width (texture rays reach 0.5 x 256 px)
    const b = sp(burstTex); b.blendMode = ADD; b.position.set(p.x, p.y); b.rotation = Math.random() * 0.4; b.scale.set(0.2);
    fxTop.addChild(b);
    const bs = (R / 128) * (0.9 + 0.25 * hitK);
    gsap.to(b.scale, { x: bs, y: bs, duration: 0.18, ease: "power3.out" });
    gsap.to(b, { rotation: b.rotation + 0.25, duration: 0.42 });
    gsap.to(b, { alpha: 0, duration: 0.3, delay: 0.12, ease: "power1.in", onComplete: () => live(b) && b.destroy() });
    // crisp thin ring that reaches the same radius
    const rg = new PIXI.Graphics(); rg.blendMode = ADD; rg.position.set(p.x, p.y); fxTop.addChild(rg);
    const st = { r: R * 0.25, w: 10, a: 1 };
    gsap.to(st, { r: R * (1 + 0.2 * hitK), w: 1, a: 0, duration: 0.3, ease: "power2.out",
      onUpdate: () => { if (!live(rg)) return; rg.clear().lineStyle(st.w, 0xfff6d8, st.a).drawCircle(0, 0, st.r).lineStyle(st.w * 2.2, tint, st.a * 0.35).drawCircle(0, 0, st.r * 0.97); },
      onComplete: () => live(rg) && rg.destroy() });
    // a few extra tinted sparks along the rays (impactAt already throws 12 gold ones)
    const n = (MOBILE ? 4 : 8) + Math.round(6 * hitK) * (MOBILE ? 0.5 : 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, sp0 = 500 + Math.random() * 300;
      ctx.topP.emit({ tex: FX.tex.spark, x: p.x, y: p.y, vx: Math.cos(a) * sp0, vy: Math.sin(a) * sp0, drag: 4, s0: 0.45, s1: 0, life: 0.35, tint: i % 2 ? 0xfff2c0 : tint, rot: a });
    }
  }
  gsap.ticker.add(() => {
    try {
      if (!live(plaque)) { plaque = findPlaque(); prevS = plaque ? plaque.scale.x : 0; return; }
      const s = plaque.scale.x;
      if (s > HIT_S && prevS <= HIT_S && plaque.visible && plaque.worldAlpha > 0.05) hitAccent();
      prevS = s;
    } catch (e) {}
  });
});
