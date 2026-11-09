// Fortune Bull 1000 - feature buy UI: the BUY button and the BUY FEATURE panel (Pixi 7, all code-drawn; GSAP tweens).
// Needs PIXI, gsap, FX (fx.js) and Engine.BUY (engine.js). Textures: Multipliers/chip_bg_nudge, chip_rim, label_nudge3/5, Symbols/super_wild.
//   const ui = BuyUI.create({ layer, W, H, getBet, money, onBuy, sfx: { click, confirm }, canAfford });
//   uiLayer.addChild(ui.button);   // not parented by create(); sits at (232, 1540) by default
//   ui.open() / ui.close() -> Promise / ui.isOpen() / ui.setEnabled(bool)
// While the panel is open it swallows keyboard input (Escape closes it), so Space cannot start a spin behind it.
(function () {
  "use strict";
  const RES = 2;                                        // canvas art is drawn at 2x the 1080x1920 design size
  const PW = 900, PH = 1120, CW = 820, CH = 380;        // panel and card size
  const TX = 160, TW = 440;                             // card text column: centre x and max width
  const ART = window.ART || "assets";
  const SRC = window.ART_SRC || ((p) => `${ART}/${p}.webp`);     // game.js: per-version source (V1 symbols)
  const T = (p) => PIXI.Assets.get(SRC(p)) || PIXI.Assets.get(`assets/${p}.webp`) || PIXI.Texture.from(SRC(p));
  const cache = {};

  // ---------- code-drawn textures (cached, so open/close never leaks canvases) ----------
  function canvasTex(key, w, h, draw) {
    if (cache[key]) return cache[key];
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * RES); c.height = Math.ceil(h * RES);
    const g = c.getContext("2d"); g.scale(RES, RES); draw(g);
    return (cache[key] = PIXI.Texture.from(c, { resolution: RES }));
  }
  function grad(g, y0, y1, stops) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    stops.forEach((s, i) => gr.addColorStop(i / (stops.length - 1), s));
    return gr;
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  // ruby gem disc: dark edge, bright gold rim, groove, inner bevel ring lit from below, faceted ruby with gloss
  function discTex(d) {
    return canvasTex("disc" + d, d + 4, d + 4, (g) => {
      const c = d / 2 + 2, R = d / 2, k = d / 128;
      const disc = (r, fill) => { g.fillStyle = fill; g.beginPath(); g.arc(c, c, r, 0, Math.PI * 2); g.fill(); };
      disc(R + 1, "#2a0c04");
      disc(R - 1, grad(g, c - R, c + R, ["#fff7d6", "#f8c860", "#d48a26", "#8a4a10"]));
      disc(R - 10 * k, grad(g, c - R, c + R, ["#5a2006", "#2e0e04"]));
      disc(R - 12.5 * k, grad(g, c - R, c + R, ["#8e5014", "#ffe8a6"]));
      const gem = R - 16 * k, rg = g.createRadialGradient(c - 0.2 * gem, c - 0.45 * gem, 2, c, c, gem);
      ["#f2506a", "#c8142e", "#8a0a1e", "#4a0410"].forEach((s, i) => rg.addColorStop(i / 3, s));
      disc(gem, rg);
      g.save(); g.beginPath(); g.arc(c, c, gem, 0, Math.PI * 2); g.clip();
      const box = (fill) => { g.fillStyle = fill; g.fillRect(c - gem, c - gem, gem * 2, gem * 2); };
      const sh = g.createRadialGradient(c, c + gem * 0.15, gem * 0.6, c, c + gem * 0.15, gem * 1.15);   // inner shadow under the rim
      sh.addColorStop(0, "rgba(40,0,8,0)"); sh.addColorStop(1, "rgba(40,0,8,0.55)"); box(sh);
      const bl = g.createRadialGradient(c, c + gem * 0.95, 2, c, c + gem * 0.95, gem * 0.75);             // light pooling at the bottom
      bl.addColorStop(0, "rgba(255,90,110,0.4)"); bl.addColorStop(1, "rgba(255,90,110,0)"); box(bl);
      const hl = g.createLinearGradient(0, c - gem, 0, c);
      hl.addColorStop(0, "rgba(255,255,255,0.4)"); hl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = hl; g.beginPath(); g.ellipse(c, c - gem * 0.45, gem * 0.78, gem * 0.45, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      g.strokeStyle = "rgba(255,255,235,0.75)"; g.lineWidth = 1.6 * k;
      g.beginPath(); g.arc(c, c, R - 3 * k, Math.PI * 1.08, Math.PI * 1.62); g.stroke();
    });
  }
  // pill: [edge gradient, fill gradient, edge width]
  const PILL = {
    ruby: [["#fff4c8", "#f0b44c", "#9a5a14"], ["#f04a5c", "#b8142a", "#640814"], 4],
    gold: [["#a05a14", "#4a200a"], ["#fff6d0", "#fbc460", "#c86e1c"], 3],
    dark: [["#f6d07a", "#b8781e"], ["#3a0f18", "#1c0609"], 3],
    off: [["#a09088", "#5a4e48"], ["#5a5054", "#2e282a"], 3],
  };
  function pillTex(w, h, kind) {
    const [edge, fill, lw] = PILL[kind];
    return canvasTex(`pill_${kind}_${w}x${h}`, w + 4, h + 4, (g) => {
      const x = 2, y = 2, r = h / 2;
      rr(g, x, y, w, h, r); g.fillStyle = grad(g, y, y + h, edge); g.fill();
      rr(g, x + lw, y + lw, w - 2 * lw, h - 2 * lw, r - lw); g.fillStyle = grad(g, y + lw, y + h - lw, fill); g.fill();
      g.save(); g.clip();
      const gl = g.createLinearGradient(0, y, 0, y + h * 0.55);
      gl.addColorStop(0, "rgba(255,255,255,0.34)"); gl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gl; g.fillRect(x, y, w, h * 0.55); g.restore();
    });
  }
  function cardTex() {
    return canvasTex("card", CW + 4, CH + 4, (g) => {
      const x = 2, y = 2, r = 28;
      rr(g, x, y, CW, CH, r); g.fillStyle = grad(g, y, y + CH, ["#f6cc74", "#b8782a", "#6e3a0e"]); g.fill();
      rr(g, x + 3, y + 3, CW - 6, CH - 6, r - 3); g.fillStyle = grad(g, y, y + CH, ["#561828", "#3a0c18", "#1c0509"]); g.fill();
      g.save(); g.clip();
      const cx = x + 168, cy = y + CH / 2, rg = g.createRadialGradient(cx, cy, 8, cx, cy, 230);
      rg.addColorStop(0, "rgba(255,180,90,0.22)"); rg.addColorStop(1, "rgba(255,180,90,0)");
      g.fillStyle = rg; g.fillRect(x, y, CW, CH); g.restore();
      g.strokeStyle = "rgba(255,225,160,0.2)"; g.lineWidth = 2; rr(g, x + 10, y + 10, CW - 20, CH - 20, r - 8); g.stroke();
    });
  }

  // ---------- small helpers ----------
  function fit(o, maxW, maxH) {             // scale text / containers down (never up) to fit a box
    o.scale.set(1);
    o.scale.set(Math.min(1, maxW / Math.max(1, o.width), maxH ? maxH / Math.max(1, o.height) : 1));
    return o;
  }
  // one line if it fits, else two balanced lines (break at the word gap that minimises the longer line)
  function balance(text, style, maxW) {
    const wOf = (s) => PIXI.TextMetrics.measureText(s, style).width;
    if (wOf(text) <= maxW) return text;
    const w = text.split(" ");
    let best = text, bw = Infinity;
    for (let i = 1; i < w.length; i++) {
      const a = w.slice(0, i).join(" "), b = w.slice(i).join(" "), m = Math.max(wOf(a), wOf(b));
      if (m < bw) { bw = m; best = a + "\n" + b; }
    }
    return best;
  }
  function sprite(tex, s) { const sp = new PIXI.Sprite(tex); sp.anchor.set(0.5); if (s) sp.scale.set(s); return sp; }
  function chip(label) {                    // the column's NUDGE chip: magic background + gold rim + label
    const c = new PIXI.Container();
    ["Multipliers/chip_bg_nudge", "Multipliers/chip_rim", label].forEach((p) => c.addChild(sprite(T(p))));
    c.label = c.children[2];
    return c;
  }
  // press squash 0.9 (like the game's buttons) + a small hover lift; `A` registers tweens for cleanup
  function pressable(o, onTap, A, unlock) {
    o.eventMode = "static"; o.cursor = "pointer";
    let over = false;
    const to = (s, d, e) => A(gsap.to(o.scale, { x: s, y: s, duration: d, ease: e || "power2.out" }));
    o.on("pointerdown", () => { unlock(); to(0.9, 0.07); });
    o.on("pointerup", () => to(over ? 1.04 : 1, 0.25, "back.out(3)"));
    o.on("pointerupoutside", () => to(1, 0.25, "back.out(3)"));
    o.on("pointerenter", () => { over = true; to(1.04, 0.15); });
    o.on("pointerleave", () => { over = false; to(1, 0.15); });
    o.on("pointertap", onTap);
  }
  function pill(w, h, kind, label, size, onTap, A, unlock) {
    const c = new PIXI.Container();
    const style = kind === "gold" ? FX.plain(size, "#4a1c08", { dropShadow: false }) : kind === "off" ? FX.plain(size, "#d2c6bc") : FX.gold(size);
    const t = new PIXI.Text(label, style); t.anchor.set(0.5); fit(t, w - 40, h - 14);
    c.addChild(sprite(pillTex(w, h, kind)), t);
    if (onTap) pressable(c, onTap, A, unlock);
    return c;
  }

  function create(o) {
    const layer = o.layer, W = o.W || 1080, H = o.H || 1920, sfx = o.sfx || {};
    const money = o.money || ((v) => v.toLocaleString("en-US"));
    const click = () => sfx.click && sfx.click(), unlock = () => sfx.unlock && sfx.unlock();
    const afford = (v) => !o.canAfford || o.canAfford(v);
    const ADD = PIXI.BLEND_MODES.ADD;
    let root = null, closing = null, anims = [], enabled = true;
    const A = (t) => { anims.push(t); return t; };

    // ---------- BUY button (lives for the whole session) ----------
    const button = new PIXI.Container(); button.position.set(232, 1540);
    const shadow = sprite(FX.tex.glow, 0.66); shadow.tint = 0x000000; shadow.alpha = 0.55; shadow.y = 10;
    const glow = sprite(FX.tex.glow, 1.05); glow.tint = 0xff9a30; glow.blendMode = ADD; glow.alpha = 0.35;
    const body = new PIXI.Container();
    const gemMask = new PIXI.Graphics().beginFill(0xffffff).drawCircle(0, 0, 46).endFill();
    const glint = sprite(FX.tex.shine); glint.rotation = -0.9; glint.scale.set(0.45, 4); glint.blendMode = ADD; glint.alpha = 0.5;
    glint.mask = gemMask; glint.x = -120;
    const label = new PIXI.Text("BUY", FX.gold(40)); label.anchor.set(0.5); label.y = 1; fit(label, 84);
    const disc = ART === "assets_v2" && PIXI.Assets.get(`${ART}/UI/buy_button.webp`) ? sprite(T("UI/buy_button")) : sprite(discTex(128));
    if (disc.texture.width > 140) disc.scale.set(132 / disc.texture.width);
    body.addChild(disc, gemMask, glint, label);
    body.hitArea = new PIXI.Circle(0, 0, 66);
    button.addChild(shadow, glow, body);
    gsap.to(glow, { alpha: 0.75, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.to(glow.scale, { x: 1.2, y: 1.2, duration: 1.4, ease: "sine.inOut", yoyo: true, repeat: -1 });
    gsap.timeline({ repeat: -1, repeatDelay: 3.4, delay: 1.2 }).fromTo(glint, { x: -90 }, { x: 90, duration: 0.7, ease: "power1.inOut" });
    pressable(body, () => { if (!enabled || root) return; click(); open(); }, (t) => t, unlock);
    const grey = new PIXI.ColorMatrixFilter(); grey.desaturate(); grey.resolution = Math.min(window.devicePixelRatio || 1, 2);
    function setEnabled(on) {
      enabled = !!on;
      body.eventMode = enabled ? "static" : "none";
      button.alpha = enabled ? 1 : 0.75;
      body.filters = enabled ? null : [grey];
      glow.visible = glint.visible = enabled;
      if (!enabled) gsap.to(body.scale, { x: 1, y: 1, duration: 0.15 });
    }

    // ---------- one option card ----------
    function makeCard(kind, bet, idx) {
      const cfg = Engine.BUY[kind], cost = cfg.cost * bet;
      const card = new PIXI.Container();
      const mask = new PIXI.Graphics().beginFill(0xffffff).drawRoundedRect(-CW / 2 + 3, -CH / 2 + 3, CW - 6, CH - 6, 25).endFill();
      const shine = sprite(FX.tex.shine); shine.rotation = 0.38; shine.scale.set(0.9, 15); shine.alpha = 0.13;
      shine.blendMode = ADD; shine.mask = mask; shine.x = -CW;
      const edge = new PIXI.Graphics().lineStyle(4, 0xffe7a0, 1).drawRoundedRect(-CW / 2 + 1, -CH / 2 + 1, CW - 2, CH - 2, 27); edge.alpha = 0;
      card.addChild(sprite(cardTex()), mask, shine);
      // mini art: NUDGE chip (flipping NUDGE 5 / NUDGE 3) or SUPER WILD + a small NUDGE 5 chip
      const art = new PIXI.Container(); art.position.set(-CW / 2 + 168, 0); card.addChild(art);
      const halo = sprite(FX.tex.glow, 1.35); halo.blendMode = ADD; halo.alpha = 0.4; halo.tint = kind === "super" ? 0xffa030 : 0x3ad8ff;
      art.addChild(halo);
      A(gsap.to(halo, { alpha: 0.7, duration: 1.3, yoyo: true, repeat: -1, ease: "sine.inOut", delay: idx * 0.4 }));
      if (kind === "super") {
        const mini = chip("Multipliers/label_nudge5"); mini.scale.set(0.56); mini.position.set(84, 100);
        art.addChild(sprite(T("Symbols/super_wild"), 0.8), mini);
        art.children[1].y = -16;
        A(gsap.to(mini.scale, { x: 0.61, y: 0.61, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut" }));
      } else {
        const ch = chip("Multipliers/label_nudge5"); ch.scale.set(1.18); art.addChild(ch);
        let five = true;
        A(gsap.timeline({ repeat: -1, repeatDelay: 1.5, delay: 1 })
          .to(ch.scale, { x: 0, duration: 0.13, ease: "power2.in",
            onComplete: () => { five = !five; ch.label.texture = T(`Multipliers/label_nudge${five ? 5 : 3}`); } })
          .to(ch.scale, { x: 1.18, duration: 0.22, ease: "back.out(2)" }));
      }
      for (let k = 0; k < 3; k++) {          // twinkles around the art
        const s = sprite(FX.tex.spark, 0.001); s.blendMode = ADD; s.tint = kind === "super" ? 0xffe0a0 : 0xbff4ff;
        s.position.set(-120 + k * 110 + Math.random() * 30, -120 + Math.random() * 230); art.addChild(s);
        A(gsap.timeline({ repeat: -1, repeatDelay: 0.8 + Math.random() * 1.6, delay: Math.random() * 2 })
          .to(s.scale, { x: 0.5, y: 0.5, duration: 0.25, ease: "power2.out" }).to(s.scale, { x: 0, y: 0, duration: 0.45, ease: "power2.in" }));
      }
      // text column
      const name = new PIXI.Text(cfg.name, FX.gold(50)); name.anchor.set(0.5); name.position.set(TX, -CH / 2 + 62); fit(name, TW);
      const dStyle = FX.plain(27, "#f4dcc0", { fontFamily: "PoppinsM", fontWeight: "500", align: "center", lineHeight: 34 });
      const desc = new PIXI.Text(balance(cfg.desc, dStyle, TW), dStyle);
      desc.anchor.set(0.5, 0); desc.position.set(TX, -CH / 2 + 98); fit(desc, TW, 74);
      const buyRow = new PIXI.Container(), conf = new PIXI.Container();
      for (const r of [buyRow, conf]) { r.pivot.set(TX, 60); r.position.set(TX, 60); }
      const price = new PIXI.Container();
      const lab = new PIXI.Text("COST", FX.plain(28, "#ffc438")); lab.anchor.set(0, 0.5); lab.y = 2;
      const val = new PIXI.Text(money(cost), FX.gold(46)); val.anchor.set(0, 0.5); val.x = lab.width + 14;
      price.addChild(lab, val); fit(price, TW); price.position.set(TX - price.width / 2, 22);
      const ok = afford(cost);
      const buyPill = ok ? pill(300, 84, "ruby", "BUY", 44, () => ask(), A, unlock) : pill(340, 84, "off", "NOT ENOUGH BALANCE", 25, null, A, unlock);
      buyPill.position.set(TX, CH / 2 - 70);
      buyRow.addChild(price, buyPill);
      const q = new PIXI.Text(`Buy for ${money(cost)}?`, FX.plain(34, "#ffffff")); q.anchor.set(0.5); q.position.set(TX, 22); fit(q, TW);
      const yes = pill(212, 80, "gold", "CONFIRM", 32, () => confirm(), A, unlock); yes.position.set(TX - 116, CH / 2 - 70);
      const no = pill(212, 80, "dark", "CANCEL", 32, () => { click(); reset(true); }, A, unlock); no.position.set(TX + 116, CH / 2 - 70);
      conf.addChild(q, yes, no); conf.visible = false;
      card.addChild(name, desc, buyRow, conf, edge);

      function reset(fade) {
        conf.visible = false; buyRow.visible = true;
        if (fade) A(gsap.fromTo(buyRow, { alpha: 0 }, { alpha: 1, duration: 0.18 }));
      }
      function ask() {
        click();
        root.cards.forEach((c) => c !== card && c.reset());
        if (!afford(cost)) return;
        buyRow.visible = false; conf.visible = true;
        A(gsap.fromTo(conf, { alpha: 0 }, { alpha: 1, duration: 0.18 }));
        A(gsap.fromTo(conf.scale, { x: 0.9, y: 0.9 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.5)" }));
      }
      function confirm() {
        if (closing) return;
        if (!afford(cost)) { reset(true); return; }           // the balance changed while the panel was open
        if (sfx.confirm) sfx.confirm();
        close().then(() => o.onBuy && o.onBuy(kind));
      }
      card.reset = () => reset(false);
      card.ask = ask;                                          // QA hook: show the confirm row
      // hover / press feedback on the whole card + a shine sweep
      card.eventMode = "static"; card.hitArea = new PIXI.RoundedRectangle(-CW / 2, -CH / 2, CW, CH, 28);
      let hov = false;
      const cs = (s, d, e) => A(gsap.to(card.scale, { x: s, y: s, duration: d, ease: e || "power2.out" }));
      card.on("pointerenter", () => { hov = true; cs(1.015, 0.18); A(gsap.to(edge, { alpha: 0.85, duration: 0.18 })); });
      card.on("pointerleave", () => { hov = false; cs(1, 0.2); A(gsap.to(edge, { alpha: 0, duration: 0.25 })); });
      card.on("pointerdown", () => cs(0.99, 0.08));
      card.on("pointerup", () => cs(hov ? 1.015 : 1, 0.25, "back.out(3)"));
      card.on("pointerupoutside", () => cs(1, 0.25));
      A(gsap.timeline({ repeat: -1, repeatDelay: 2.8, delay: 0.7 + idx * 0.45 })
        .fromTo(shine, { x: -CW / 2 - 220 }, { x: CW / 2 + 220, duration: 1.2, ease: "sine.inOut" }));
      return card;
    }

    // ---------- panel ----------
    function open() {
      if (root) return;
      const bet = o.getBet ? o.getBet() : 1;
      anims = [];
      root = new PIXI.Container(); layer.addChild(root);
      const dim = new PIXI.Graphics().beginFill(0x000000, 0.8).drawRect(-W, -H, W * 3, H * 3).endFill();
      dim.eventMode = "static";                                // blocks every tap behind the panel
      const pnl = new PIXI.Container(); pnl.position.set(W / 2, H / 2);
      root.addChild(dim, pnl);
      const bg = new PIXI.Graphics().beginFill(0x2a0a10, 0.97).lineStyle(5, 0xe8a640).drawRoundedRect(-PW / 2, -PH / 2, PW, PH, 40).endFill()
        .lineStyle(2, 0xe8a640, 0.3).drawRoundedRect(-PW / 2 + 16, -PH / 2 + 16, PW - 32, PH - 32, 28);
      bg.eventMode = "static";
      const pMask = new PIXI.Graphics().beginFill(0xffffff).drawRoundedRect(-PW / 2, -PH / 2, PW, PH, 40).endFill();
      const topGlow = sprite(FX.tex.glow); topGlow.position.set(0, -PH / 2 + 70); topGlow.scale.set(3.4, 1.1);
      topGlow.tint = 0xff9a40; topGlow.blendMode = ADD; topGlow.alpha = 0.22; topGlow.mask = pMask;
      const title = new PIXI.Text("BUY FEATURE", FX.gold(68)); title.anchor.set(0.5); title.position.set(0, -PH / 2 + 92); fit(title, PW - 220);
      const div = new PIXI.Graphics();
      for (let k = 0; k < 20; k++) {
        const t0 = k / 20, t1 = (k + 1) / 20, a = 0.5 * (1 - t0 * t0), y = -PH / 2 + 150;
        div.beginFill(0xffdc96, a).drawRect(t0 * 330, y, 16.5, 2).drawRect(-t1 * 330, y, 16.5, 2).endFill();
      }
      pnl.addChild(bg, pMask, topGlow, title, div);
      root.dim = dim; root.pnl = pnl;
      root.cards = Object.keys(Engine.BUY).map((kind, i) => {
        const c = makeCard(kind, bet, i); c.position.set(0, -PH / 2 + 200 + CH / 2 + i * (CH + 34)); pnl.addChild(c); return c;
      });
      const foot = new PIXI.Text(`Current bet ${money(bet)}`, FX.plain(28, "#f4dcc0", { fontFamily: "PoppinsM", fontWeight: "500" }));
      foot.anchor.set(0.5); foot.position.set(0, PH / 2 - 56); foot.alpha = 0.85; fit(foot, PW - 120);
      const x = new PIXI.Container(); x.position.set(PW / 2 - 58, -PH / 2 + 58);
      x.addChild(sprite(discTex(72)), new PIXI.Graphics().lineStyle(7, 0xffe08a).moveTo(-11, -11).lineTo(11, 11).moveTo(11, -11).lineTo(-11, 11));
      x.hitArea = new PIXI.Circle(0, 0, 46);
      pressable(x, () => { click(); close(); }, A, unlock);
      pnl.addChild(foot, x);
      // entrance: dim fades in, panel scales 0.85 -> 1 (back.out), cards rise in
      dim.alpha = 0; A(gsap.to(dim, { alpha: 1, duration: 0.25 }));
      pnl.alpha = 0; pnl.scale.set(0.85);
      A(gsap.to(pnl, { alpha: 1, duration: 0.2 }));
      A(gsap.to(pnl.scale, { x: 1, y: 1, duration: 0.5, ease: "back.out(1.7)" }));
      root.cards.forEach((c, i) => {
        const y = c.y; c.y += 50; c.alpha = 0;
        A(gsap.to(c, { y, alpha: 1, duration: 0.4, delay: 0.12 + 0.08 * i, ease: "power2.out" }));
      });
    }
    function close() {
      if (!root) return Promise.resolve();
      if (closing) return closing;
      const r = root;
      anims.forEach((t) => t.kill()); anims = [];
      r.pnl.interactiveChildren = false;
      closing = new Promise((res) => {
        gsap.to(r.dim, { alpha: 0, duration: 0.22 });
        gsap.to(r.pnl.scale, { x: 0.9, y: 0.9, duration: 0.22, ease: "power2.in" });
        gsap.to(r.pnl, { alpha: 0, duration: 0.22, onComplete: () => {
          gsap.killTweensOf([r.dim, r.pnl, r.pnl.scale]);
          r.destroy({ children: true });
          root = null; closing = null; res();
        } });
      });
      return closing;
    }
    // modal keyboard: Escape closes; nothing else reaches the game while the panel is up
    window.addEventListener("keydown", (e) => {
      if (!root || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "Escape" && !closing) { click(); close(); }
      if (e.code === "Space" || e.code === "Enter") e.preventDefault();
      e.stopImmediatePropagation();
    }, true);

    return { open, close, isOpen: () => !!root, button, setEnabled, _cards: () => (root ? root.cards : []) };
  }

  window.BuyUI = { create };
})();
