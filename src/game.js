// Fortune Bull 1000 - runtime (PixiJS 7 + GSAP). Board space is 1080x1920 (prod/Cut manifest, 1x).
(async function () {
  "use strict";
  const W = 1080, H = 1920;
  const REEL_X = [[39, 296.7], [303.7, 561.3], [568.3, 826]];
  const REEL_CX = REEL_X.map(([a, b]) => (a + b) / 2);
  const CELL_Y0 = 613, CELL_H = 215, WIN_Y1 = CELL_Y0 + 3 * CELL_H;
  const rowY = (r) => CELL_Y0 + (r + 0.5) * CELL_H;
  const COL_CX = 944, COL_Y0 = 679.5, COL_P = 128, TRAY = [849, 614, 1039, 1257];
  const COL_CY = COL_Y0 + 2 * COL_P;
  const HIGH = new Set(["hourglass", "sun", "chest"]);
  const BETS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const TIER_ORDER = ["big", "mega", "super", "epic", "max"];
  const TIER_X = { big: 10, mega: 25, super: 50, epic: 100, max: Engine.MAX_WIN };
  const TIER_NAME = { big: "BIG WIN", mega: "MEGA WIN", super: "SUPER WIN", epic: "EPIC WIN", max: "MAX WIN" };
  const params = new URLSearchParams(location.search);
  // default = V1: the game with the original symbols (assets_v1/Symbols) and original wild clips (clips/_v1)
  // ?v2 = same game with the simplified symbols, new wild seals and their clips (assets/Symbols, clips/)
  // ?v3 = the Sapphire Treasury art set (assets_v2/, same file names); a part missing there falls back to assets/
  // ?v4 = V1 with the V4 bull (red sash on the other shoulder, living-gold arm with an armband): assets_v4 + clips/v4
  // PRODUCTION DEFAULT (2026-11-10) = V4: the gold-arm bull with the original symbols. ?v1 = the armoured bull.
  const VER = params.has("v1") ? 1 : params.has("v3") ? 3 : params.has("v2") ? 2 : 4;
  const ART = VER === 3 ? "assets_v2" : "assets";
  const OLD_SYM = VER === 1 || VER === 4 ? /^Symbols\/(chest|hourglass|sun|wild|super_wild)(_|$)/ : null;
  const artSrc = (p) => `${VER === 4 && p === "Character/bull" ? "assets_v4" : OLD_SYM && OLD_SYM.test(p) ? "assets_v1" : ART}/${p}.webp`;
  window.ART = ART; window.ART_SRC = artSrc;
  const V2ART = ART === "assets_v2", V2_LAB = { wild: 66, super: 62 };     // label centre below the symbol centre
  // ?mobile = the phone build: one shared bull video + one shared wild video (src/segvideo.js), a still bull whenever the
  // video is not really playing, taps unlock video, steady video speed, no edge smoothing, lighter effects
  const MOBILE = params.has("mobile");
  const BASE_TS = +(params.get("ts") || 1);          // ?ts=0.1 = slow motion (QA video capture)
  gsap.globalTimeline.timeScale(BASE_TS);

  // ---------- app ----------
  const app = new PIXI.Application({ backgroundColor: 0x000000, antialias: !MOBILE, autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2), resizeTo: window });
  document.getElementById("wrap").appendChild(app.view);
  const root = new PIXI.Container();
  const backdrop = new PIXI.Sprite();
  app.stage.addChild(backdrop, root);
  function fit() {
    const w = app.screen.width, h = app.screen.height;
    const s = Math.min(w / W, h / H);
    root.scale.set(s);
    root.x = (w - W * s) / 2; root.y = (h - H * s) / 2;
    if (backdrop.texture && backdrop.texture.width > 1) {
      const k = Math.max(w / backdrop.texture.width, h / backdrop.texture.height);
      backdrop.scale.set(k); backdrop.x = (w - backdrop.texture.width * k) / 2; backdrop.y = (h - backdrop.texture.height * k) / 2;
    }
  }
  window.addEventListener("resize", () => setTimeout(fit, 30));
  fit();

  // ---------- fonts + loader ----------
  for (const [fam, file, wt] of [["PoppinsB", "poppinsBold.ttf", "700"], ["PoppinsM", "poppinsMedium.ttf", "500"]]) {
    // a page may embed the fonts (window.FONT_URLS, data: URIs) so it ships only media files (shared Artifact build)
    const f = new FontFace(fam, `url(${(window.FONT_URLS || {})[fam] || "assets/fonts/" + file})`, { weight: wt });
    document.fonts.add(await f.load());
  }
  FX.init();
  if (window.CustomEase) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create("fbStop", "M0,0 C0.126,0.382 0.24,0.77 0.375,0.924 0.441,1 0.5,1.022 0.647,1.021 0.726,1.02 0.853,1.013 1,1");
    CustomEase.create("fbStopTurbo", "M0,0 C0,0 0.383,0.757 0.639,1.013 0.703,1.077 1,1 1,1");
  }
  VFX.init({ app, root, lite: params.has("lite") || MOBILE });
  const loadC = new PIXI.Container();
  root.addChild(loadC);
  const loadTitle = new PIXI.Text("FORTUNE BULL", FX.gold(110));
  loadTitle.anchor.set(0.5); loadTitle.position.set(540, 820);
  const load1000 = new PIXI.Text("1000", FX.gold(170, { fill: FX.TIER_FILL.mega }));
  load1000.anchor.set(0.5); load1000.position.set(540, 960);
  const barBg = new PIXI.Graphics().beginFill(0x2a0c10).drawRoundedRect(240, 1120, 600, 26, 13).endFill()
    .lineStyle(3, 0xe8a640).drawRoundedRect(240, 1120, 600, 26, 13);
  const bar = new PIXI.Graphics();
  const loadTxt = new PIXI.Text("LOADING", FX.gold(36));
  loadTxt.anchor.set(0.5); loadTxt.position.set(540, 1200);
  loadC.addChild(loadTitle, load1000, barBg, bar, loadTxt);

  const layout = await (await fetch("assets/layout.json")).json();
  const fxPts = await (await fetch("assets/fx_points.json")).json();
  let clipList = {};
  try { clipList = await (await fetch("assets/clips/clips.json")).json(); } catch (e) { clipList = {}; }
  if (VER === 4) {                                   // V4 bull clips replace the bull_* entries (same placement, own tracks)
    try { const v4 = await (await fetch("assets/clips/v4/clips.json")).json();
      for (const [k, c] of Object.entries(v4)) clipList[k] = Object.assign({}, c, { sub: "v4/" }); /* "sub" = clip folder; "dir" is the throw's direction */ } catch (e) { console.warn("v4 clips", e); }
  }
  // ---------- clip downloads (Kling) ----------
  // Mobile load order: the art and the two clips the intro and popup need (idle, roar) download together and hold the
  // TAP TO PLAY screen; sounds and the other clips (moves, wilds) follow after it and switch on when ready (until then
  // the code-drawn fallbacks play). Sprites are made later in activateClip().
  const clips = {}, clipReady = [], clipPend = {}, lateClips = [];
  const BOOT_CLIPS = new Set(["bull_idle", "bull_big"]);
  let clipSink = null;                                              // set once the scene can take a late clip
  if (V2ART) for (const n of Object.keys(clipList)) if (n.startsWith("wild_") || n.startsWith("super_wild_")) delete clipList[n];
  let mobBull = null, mobWild = null;
  if (MOBILE && window.SegVideo) {
    try {
      const mc = await (await fetch("assets/clips/m/clips.json")).json();
      mobBull = new SegVideo.SegPlayer("assets/clips/m/" + mc.bull.file, mc.bull.segments, { fps: mc.fps, minRate: 0.5, maxRate: 2.5 });
      mobWild = new SegVideo.SegPlayer("assets/clips/m/" + mc.wilds.file, mc.wilds.segments, { fps: mc.fps, minRate: 1, maxRate: 1 });
      const metaOf = (pl) => new Promise((res) => { if (pl.v.readyState >= 1) res(); pl.v.addEventListener("loadedmetadata", res, { once: true }); pl.v.addEventListener("error", res, { once: true }); });
      const bm = metaOf(mobBull), wm = metaOf(mobWild);
      const entry = (video, cfg, pl, meta, frame) => ({ video, sprite: null, cfg, meta, ready: Promise.resolve(), start: () => {}, shared: pl, frame });
      for (const [name, sg] of Object.entries(mc.bull.segments))
        clipPend[name] = entry(mobBull.clips[name], Object.assign({ key: "green", loop: !!sg.loop }, sg.cfg), mobBull, bm, null);
      for (const id of ["wild", "super_wild"]) {
        const fr = mc.wilds.symbols[id], cw = mc.wilds.cell.w, ch = mc.wilds.cell.h;
        clipPend[id + "_win"] = entry(mobWild.alias(id + "_win", "win"), { w: cw, h: ch, key: "green", loop: false, then: id + "_idle" }, mobWild, wm, fr);
        clipPend[id + "_idle"] = entry(mobWild.alias(id + "_idle", "idle"), { w: cw, h: ch, key: "green", loop: true }, mobWild, wm, fr);
      }
      // the TAP TO PLAY screen waits for the bull video's first picture (8 s at most: the still bull covers a slow one)
      clipReady.push(Promise.race([new Promise((res) => { mobBull.v.addEventListener("loadeddata", res, { once: true }); mobBull.v.addEventListener("error", res, { once: true }); }),
        new Promise((res) => setTimeout(res, 8000))]));
      clipList = {};
    } catch (e) { console.warn("mobile clips", e); }
  }
  for (const [name, c] of Object.entries(clipList)) {
    try {
      const v = document.createElement("video");
      const dir = c.sub || ((VER === 1 || VER === 4) && /^(super_)?wild_/.test(name) ? "_v1/" : "");    // V1/V4 = original wild clips
      v.muted = true; v.playsInline = true; v.loop = !!c.loop; v.preload = "auto";
      v.crossOrigin = "anonymous";
      v.defaultPlaybackRate = v.playbackRate = BASE_TS;          // clips follow ?ts= slow motion too
      const meta = new Promise((res) => { v.addEventListener("loadedmetadata", res, { once: true }); v.addEventListener("error", res, { once: true }); });
      const ready = new Promise((res) => { v.addEventListener("canplaythrough", res, { once: true }); v.addEventListener("error", res, { once: true }); });
      const start = () => { if (!v.src) { v.src = `assets/clips/${dir}${c.file}`; v.load(); } };
      clipPend[name] = { video: v, sprite: null, cfg: c, meta, ready, start };
      if (BOOT_CLIPS.has(name)) { start(); clipReady.push(Promise.race([ready, new Promise((res) => setTimeout(res, 15000))])); }
    } catch (e) { console.warn("clip", name, e); }
  }
  const files = [];
  const add = (p) => files.push(artSrc(p));
  add("BG/bg_main"); add("Character/bull");
  ["frame", "mult_tray", "panel_reels"].forEach((n) => add("Board/" + n));
  for (const s of Engine.SYMBOLS) {
    add(`Symbols/${s}`); add(`Symbols/${s}_blur`); add(`Symbols/${s}_off`);
    if (HIGH.has(s)) ["_tile", "_tile_blur", "_tilebg"].forEach((k) => add(`Symbols/${s}${k}`));
  }
  for (const v of Engine.MULT_VALUES) { add(`Multipliers/chip_bg_${v}`); add(`Multipliers/label_${v}x`); }
  add("Multipliers/chip_bg_nudge"); Engine.NUDGE_CHIPS.forEach((v) => add(`Multipliers/label_nudge${-v}`));
  if (V2ART) { add("Multipliers/chip_bg_nudge5"); add("UI/buy_button"); }
  ["title_big", "title_mega", "title_super", "title_epic", "title_max"].forEach((n) => files.push(`assets/Popup/${n}.webp`));
  ["chip_coat", "chip_glints", "chip_rim", "chip_shadow"].forEach((n) => add("Multipliers/" + n));
  ["autoplay", "autoplay_shadow", "balance_bar_border", "balance_bar_fill", "bet_window_border", "bet_window_fill",
    "ex_button", "ex_shadow", "icon_menu", "icon_sound", "minus", "minus_shadow", "plus", "plus_shadow", "spin_arrows",
    "spin_base", "spin_glow", "spin_shadow", "turbo", "turbo_shadow", "win_bar"].forEach((n) => add("UI/" + n));
  const NO_ART = params.has("codefx");                 // ?codefx = the old code-drawn effects, for comparison
  if (!NO_ART) FX.ART.forEach((n) => files.push(`assets/vfx/${n}.webp`));
  const loadBar = (p) => bar.clear().beginFill(0xffc24a).drawRoundedRect(243, 1123, 594 * p, 20, 10).endFill();
  for (let tries = 0; ; tries++) {                 // one failed fetch must not kill the boot: retry the missing files
    try { await PIXI.Assets.load(files, loadBar); break; }
    catch (e) { if (tries >= 3) throw e; console.warn("assets: retry", tries + 1); await new Promise((r) => setTimeout(r, 400)); }
  }
  if (!NO_ART) FX.useArt((n) => PIXI.Assets.get(`assets/vfx/${n}.webp`));
  if (window.GOLD_FNT) PIXI.BitmapFont.install(window.GOLD_FNT, await PIXI.Assets.load("assets/fonts/gold_digits.png"));   // embedded .fnt
  else await PIXI.Assets.load("assets/fonts/gold_digits.fnt");
  const T = (p) => PIXI.Assets.get(artSrc(p)) || PIXI.Assets.get(`assets/${p}.webp`) || PIXI.Texture.from(artSrc(p));

  // ---------- clips (Kling) ----------
  // assets/clips/clips.json: { name: { file, x, y, w, h, loop, key } }; key = "green" keys a green screen.
  const KEY_FRAG = `
    varying vec2 vTextureCoord; uniform sampler2D uSampler;
    void main(){ vec4 c = texture2D(uSampler, vTextureCoord);
      vec3 rgb = c.a > 0.001 ? c.rgb / c.a : vec3(0.0);            // un-premultiply: keys cleanly while the sprite fades
      float g = rgb.g - max(rgb.r, rgb.b);
      float a = (1.0 - clamp((g - 0.06) / 0.22, 0.0, 1.0)) * c.a;
      rgb.g = min(rgb.g, max(rgb.r * 0.92, rgb.b));
      gl_FragColor = vec4(rgb * a, a); }`;
  const keyFilter = new PIXI.Filter(undefined, KEY_FRAG);          // one shared instance: every keyed clip uses it
  await Promise.all(clipReady);
  // then sounds (SFX first, music after: audio.js) and the remaining clips, one at a time so each finishes quickly
  if (window.AUDIO) { if (BASE_TS !== 1 && AUDIO.timeScale) AUDIO.timeScale(BASE_TS); AUDIO.load("assets/audio/", "assets/audio/audio.json").catch((e) => console.warn("audio", e)); }
  (async () => {
    for (const n of Object.keys(clipPend).filter((k) => !BOOT_CLIPS.has(k))) {
      const o = clipPend[n]; o.start();
      await Promise.race([o.ready, new Promise((res) => setTimeout(res, 15000))]);
    }
  })();
  // textures only once a clip knows its size: a PIXI VideoResource made before that can recurse forever
  // (_onPlayStart <-> _onCanPlay while width is still 0) on a slow connection. A clip that never loads stays off.
  function activateClip(name) {
    const o = clipPend[name]; if (!o || clips[name]) return;
    const v = o.video, c = o.cfg;
    if (!v.videoWidth || v.error) { console.warn("clip not loaded", name, v.error ? v.error.code + " " + v.error.message : "no size", "ready", v.readyState, "net", v.networkState); return; }
    let tex;
    if (o.shared) {                                   // phone build: one texture per shared video, wilds as halves of it
      const pl = o.shared;
      if (!pl.base_) pl.base_ = PIXI.BaseTexture.from(pl.v, { resourceOptions: { autoPlay: false, updateFPS: pl.fps } });
      tex = o.frame ? new PIXI.Texture(pl.base_, new PIXI.Rectangle(o.frame[0], o.frame[1], o.frame[2], o.frame[3])) : new PIXI.Texture(pl.base_);
    } else tex = PIXI.Texture.from(v, { resourceOptions: { autoPlay: false, updateFPS: 30 } });
    const sp = new PIXI.Sprite(tex);
    sp.position.set(c.x || 0, c.y || 0); sp.width = c.w; sp.height = c.h; sp.visible = false;
    if (c.key === "green") sp.filters = [keyFilter];
    o.sprite = sp; clips[name] = o;
    if (clipSink) clipSink(name); else lateClips.push(name);
  }
  for (const name of Object.keys(clipPend)) {
    if (BOOT_CLIPS.has(name) && clipPend[name].video.videoWidth) activateClip(name);
    else clipPend[name].meta.then(() => activateClip(name));
  }
  const hasClip = (n) => !!clips[n];

  // ---------- scene ----------
  const L = (n) => layout[n];
  const layer = () => root.addChild(new PIXI.Container());
  const bgL = layer(), ambBack = layer(), bullL = layer(), ambFront = layer(), boardL = layer(), uiL = layer(),
    fxTop = layer(), popL = layer(), menuL = layer();
  root.removeChild(loadC); root.addChild(loadC);
  // stage post-FX act on the world (scene + board) only: the UI, effect overlay and popups stay crisp
  const world = new PIXI.Container(); root.addChildAt(world, root.getChildIndex(bgL));
  [bgL, ambBack, bullL, ambFront, boardL].forEach((l) => world.addChild(l));
  VFX.setWorld(world);
  // emission per second, independent of the frame rate
  const nEmit = (rate) => { const x = rate * (MOBILE ? 0.6 : 1) * Math.min(0.05, app.ticker.deltaMS / 1000) * gsap.globalTimeline.timeScale(); return Math.floor(x) + (Math.random() < x % 1 ? 1 : 0); };

  const bg = new PIXI.Sprite(T("BG/bg_main"));
  bgL.addChild(bg);
  backdrop.texture = T("BG/bg_main");
  backdrop.tint = 0x3a3030;
  if (MOBILE) {
    // phone build: blurred once (drawn tiny, then stretched smooth) instead of a full-screen blur pass every frame
    try {
      const src = backdrop.texture.baseTexture.resource.source, c = document.createElement("canvas");
      c.width = 36; c.height = 64; c.getContext("2d").drawImage(src, 0, 0, 36, 64);
      backdrop.texture = PIXI.Texture.from(c, { scaleMode: PIXI.SCALE_MODES.LINEAR });
    } catch (e) { backdrop.filters = [new PIXI.BlurFilter(18)]; }
  } else backdrop.filters = [new PIXI.BlurFilter(18)];
  fit();

  // bull: container pivoted at the bottom centre so breathing grows from the board
  const bl = L("bull");
  const bull = new PIXI.Container();
  bull.position.set(bl.x + bl.w / 2, bl.y + bl.h);
  const bullSpr = new PIXI.Sprite(T("Character/bull"));
  bullSpr.position.set(-bl.w / 2, -bl.h);
  const bullAura = new PIXI.Sprite(FX.tex.glow);
  bullAura.anchor.set(0.5); bullAura.position.set(0, -bl.h * 0.62); bullAura.scale.set(5.5, 5);
  bullAura.tint = 0xffb040; bullAura.blendMode = PIXI.BLEND_MODES.ADD; bullAura.alpha = 0;
  bull.addChild(bullAura, bullSpr);
  const EYES = [[497, 168], [602, 168]];
  const eyes = EYES.map(([x, y]) => {
    const e = new PIXI.Sprite(FX.tex.glow);
    e.anchor.set(0.5); e.position.set(x - bull.x, y - bull.y); e.scale.set(0.32, 0.2);
    e.tint = 0xff9a1a; e.blendMode = PIXI.BLEND_MODES.ADD; e.alpha = 0.45;
    bull.addChild(e);
    return e;
  });
  bullL.addChild(bull);
  // Kling bull: idle loop replaces the still, eyes come from the clip. Clips that arrive after boot slot in above the
  // idle (moves fade in over it) and below the hand flame / finger mask, which are added to the bull later.
  const bullClipAt = bull.children.length;
  const bullClipC = MOBILE ? new PIXI.Container() : null;
  if (bullClipC) { bull.addChildAt(bullClipC, bullClipAt); bullClipC.visible = false; }
  const bullLive = () => !mobBull || mobBull.live;
  function attachBullClip(n) {
    const o = clips[n], sp = o.sprite;
    // relative to the bull's REST point: a clip that arrives during the intro (the bull slides up from +120 px) or a
    // shake must not bake that offset in
    sp.position.set(o.cfg.x - (bl.x + bl.w / 2), o.cfg.y - (bl.y + bl.h));
    const idle = clips.bull_idle && clips.bull_idle.sprite;
    if (bullClipC) bullClipC.addChild(sp);              // the phone build: one layer, shown only while the video is live
    else {
      const at = n === "bull_idle" ? bullClipAt : idle && idle.parent === bull ? bull.getChildIndex(idle) + 1 : bullClipAt;
      bull.addChildAt(sp, Math.min(at, bull.children.length));
    }
    if (n === "bull_idle") {
      if (!bullClipC) { bullSpr.visible = false; eyes.forEach((e) => (e.visible = false)); }
      sp.visible = true; const p = o.video.play(); if (p && p.catch) p.catch(() => {});
    }
  }
  ["bull_idle", ...Object.keys(clips).filter((k) => k.startsWith("bull_") && k !== "bull_idle")].forEach((n) => { if (clips[n]) attachBullClip(n); });
  clipSink = (n) => { if (n.startsWith("bull_")) attachBullClip(n); };     // wild clips are looked up per win
  lateClips.splice(0).forEach(clipSink);
  const bullState = { breath: 1 };

  // ambient: god rays, dust, brazier fire, sun medallion
  const rays = [0, 1, 2].map((k) => {
    const r = new PIXI.Sprite(FX.tex.ray);
    r.anchor.set(0.5, 0); r.position.set(930 + k * 70, -60); r.rotation = 0.5 + k * 0.06;
    r.scale.set(1.6 + k * 0.6, 1.5); r.tint = 0xffe3a8; r.blendMode = PIXI.BLEND_MODES.ADD; r.alpha = 0.1;
    ambBack.addChild(r);
    return r;
  });
  const sunGlow = new PIXI.Sprite(FX.tex.burst);
  sunGlow.anchor.set(0.5); sunGlow.position.set(540, 266); sunGlow.scale.set(0.2);
  sunGlow.blendMode = PIXI.BLEND_MODES.ADD; sunGlow.alpha = 0.35;
  ambBack.addChild(sunGlow);
  const flames = fxPts.flames.map((f) => {
    const c = new PIXI.Container(); c.position.set(f.x, f.y);
    const glow = new PIXI.Sprite(FX.tex.glow); glow.anchor.set(0.5); glow.scale.set(1.6, 1.8);
    glow.tint = 0xff8a20; glow.blendMode = PIXI.BLEND_MODES.ADD; glow.alpha = 0.3;
    const tongues = [0, 1, 2].map((k) => {
      const t = FX.tex.fireFrames ? new PIXI.AnimatedSprite(FX.tex.fireFrames) : new PIXI.Sprite(FX.tex.flame);
      if (t.play) { t.animationSpeed = 0.38 + Math.random() * 0.12; t.gotoAndPlay(Math.floor(Math.random() * 16)); }
      t.anchor.set(0.5, 0.85); t.position.set((k - 1) * 16, 40);
      t.blendMode = PIXI.BLEND_MODES.ADD; t.alpha = 0.55; t.scale.set(0.9 - Math.abs(k - 1) * 0.25);
      c.addChild(t); return t;
    });
    c.addChildAt(glow, 0);
    ambBack.addChild(c);
    return { c, glow, tongues, x: f.x, y: f.y };
  });
  const ambP = new FX.Particles(ambBack);
  const dust = new FX.Particles(ambFront);

  // board
  const winBar = new PIXI.Sprite(T("UI/win_bar")); winBar.position.set(L("win_bar").x, L("win_bar").y);
  const panel = new PIXI.Sprite(T("Board/panel_reels")); panel.position.set(L("panel_reels").x, L("panel_reels").y);
  const tray = new PIXI.Sprite(T("Board/mult_tray")); tray.position.set(L("mult_tray").x, L("mult_tray").y);
  const colBack = new PIXI.Container(), cellFxBack = new PIXI.Container(), frameL = new PIXI.Container(),
    reelsL = new PIXI.Container(), colFront = new PIXI.Container(), boardFx = new PIXI.Container(), plaqueL = new PIXI.Container();
  const board = new PIXI.Container();
  board.addChild(winBar, panel, tray, colBack, cellFxBack, frameL, reelsL, colFront, boardFx, plaqueL);
  boardL.addChild(board);
  const frame = new PIXI.Sprite(T("Board/frame")); frame.position.set(0, 585);
  frameL.addChild(frame);
  // frame light sweep, masked by the frame's own alpha
  const frameMask = new PIXI.Sprite(T("Board/frame")); frameMask.position.set(0, 585);
  const frameShine = new PIXI.Sprite(FX.tex.shine);
  frameShine.anchor.set(0.5); frameShine.scale.set(1.4, 40); frameShine.rotation = 0.5;
  frameShine.blendMode = PIXI.BLEND_MODES.ADD; frameShine.alpha = 0.7; frameShine.x = -400; frameShine.y = 940;
  frameL.addChild(frameMask, frameShine); frameShine.mask = frameMask;
  const frameGlow = new PIXI.Graphics();
  frameL.addChild(frameGlow);
  const boardP = new FX.Particles(boardFx);
  const topP = new FX.Particles(fxTop);

  // ---------- symbol + chip views ----------
  class SymView {
    constructor(parent, cx) {
      this.c = new PIXI.Container(); this.c.x = cx;
      this.inner = new PIXI.Container();
      this.a = new PIXI.Sprite(); this.b = new PIXI.Sprite();
      this.a.anchor.set(0.5); this.b.anchor.set(0.5);
      this.fire = new PIXI.Sprite(FX.tex.glow); this.fire.anchor.set(0.5); this.fire.scale.set(1.6, 1.4);
      this.fire.tint = 0xff6a10; this.fire.blendMode = PIXI.BLEND_MODES.ADD; this.fire.visible = false;
      this.inner.addChild(this.fire, this.a, this.b); this.c.addChild(this.inner);
      if (V2ART) {                                       // V2 wild seals carry live text on their lower band
        this.lab = new PIXI.Text("WILD", FX.gold(40, { strokeThickness: 7, lineHeight: 34, align: "center" }));
        this.lab.anchor.set(0.5); this.lab.visible = false; this.inner.addChild(this.lab);
      }
      parent.addChild(this.c);
    }
    set(id, blur) {
      this.id = id; this.blur = blur; this.fire.visible = id === "super_wild" && blur;
      this.inner.scale.set(1); this.inner.rotation = 0;
      if (HIGH.has(id)) {
        if (blur) { this.a.texture = T(`Symbols/${id}_tile_blur`); this.b.visible = false; }
        else { this.a.texture = T(`Symbols/${id}_tilebg`); this.b.texture = T(`Symbols/${id}`); this.b.visible = true; this.b.scale.set(1); }
      } else { this.a.texture = T(`Symbols/${id}${blur ? "_blur" : ""}`); this.b.visible = false; }
      if (this.lab) {
        const w = Engine.WILDS.has(id);
        this.lab.visible = w && !blur;
        if (w) { const sup = id === "super_wild"; this.lab.text = sup ? "SUPER\nWILD" : "WILD";
          this.lab.style.fontSize = sup ? 30 : 40; this.lab.y = sup ? V2_LAB.super : V2_LAB.wild; }
      }
      this.dim(0);
    }
    dim(k) { const g = Math.round(255 * (1 - 0.65 * k)); const t = (g << 16) | (g << 8) | g; this.a.tint = t; this.b.tint = t; if (this.lab) this.lab.tint = t; }
    setY(y) { this.c.y = y; }
    set visible(v) { this.c.visible = v; }
    get hero() { return this.b.visible ? this.b : this.inner; }
  }
  // magic background flow: the painted energy drifts and swirls, wisps of light run through it, the core breathes.
  // Alpha comes from the undistorted texture, so the chip's rounded edge never moves.
  const MAGIC_FRAG = `
    varying vec2 vTextureCoord; uniform sampler2D uSampler; uniform float uTime; uniform float uSeed; uniform float uAmp;
    void main(){
      vec2 uv = vTextureCoord; float t = uTime + uSeed * 7.3;
      vec2 off = vec2(sin(uv.y * 23.0 + t * 1.6) + 0.6 * sin(uv.x * 37.0 - t * 2.1 + uSeed),
                      cos(uv.x * 19.0 - t * 1.3) + 0.6 * cos(uv.y * 31.0 + t * 1.9 - uSeed)) * 0.0075 * uAmp;
      off += vec2(sin(t * 0.7 + uv.y * 9.0), cos(t * 0.5 + uv.x * 7.0)) * 0.004 * uAmp;
      vec4 o = texture2D(uSampler, uv);
      vec4 d = texture2D(uSampler, uv + off);
      vec3 rgb = d.a > 0.02 ? d.rgb / d.a : o.rgb / max(o.a, 0.0001);
      float wisp = pow(0.5 + 0.5 * sin(uv.x * 11.0 + uv.y * 7.0 - t * 1.4), 8.0) * 0.22
                 + pow(0.5 + 0.5 * sin(uv.x * -8.0 + uv.y * 13.0 - t * 1.1 + 2.0), 10.0) * 0.16;
      float core = 1.0 + 0.10 * sin(t * 1.8);
      rgb = rgb * core + rgb * wisp * 1.6 + vec3(wisp * 0.08);
      gl_FragColor = vec4(rgb * o.a, o.a);
    }`;
  const magicFilters = [];
  class ChipView {
    constructor() {
      this.b = new PIXI.Container(); this.f = new PIXI.Container();
      this.b.x = this.f.x = COL_CX;
      const sp = (t) => { const s = new PIXI.Sprite(t); s.anchor.set(0.5); return s; };
      this.shadow = sp(T("Multipliers/chip_shadow")); this.bg = sp(T("Multipliers/chip_bg_1"));
      this.rim = sp(T("Multipliers/chip_rim")); this.gl = sp(T("Multipliers/chip_glints"));
      this.flash = sp(T("Multipliers/chip_glints")); this.flash.blendMode = PIXI.BLEND_MODES.ADD; this.flash.alpha = 0;
      this.b.addChild(this.shadow, this.bg, this.rim, this.gl, this.flash);
      this.magic = new PIXI.Filter(undefined, MAGIC_FRAG, { uTime: 0, uSeed: Math.random() * 10, uAmp: 1 });
      this.bg.filters = [this.magic]; magicFilters.push(this.magic);
      this.inner = new PIXI.Container();
      this.label = sp(T("Multipliers/label_1x")); this.coat = sp(T("Multipliers/chip_coat"));
      this.inner.addChild(this.label); this.f.addChild(this.inner, this.coat);
      colBack.addChild(this.b); colFront.addChild(this.f);
    }
    set(idx) { this.idx = idx; this.v = Engine.STRIP[idx]; this.bg.texture = chipBgTex(this.v);
      this.label.texture = chipLabelTex(this.v); this.inner.scale.set(1); this.dim(0); }
    setY(y) { this.b.y = this.f.y = y; }
    dim(k) { const g = Math.round(255 * (1 - 0.55 * k)); const t = (g << 16) | (g << 8) | g;
      [this.bg, this.rim, this.label, this.gl].forEach((s) => (s.tint = t)); }
    set visible(v) { this.b.visible = this.f.visible = v; }
  }

  function chipBgTex(v) { return T(`Multipliers/chip_bg_${v < 0 ? (V2ART && v === -5 ? "nudge5" : "nudge") : v}`); }
  function chipLabelTex(v) { return T(`Multipliers/label_${v < 0 ? "nudge" + -v : v + "x"}`); }

  // ---------- procedural fire (GPU): flames licking up around a rounded rect ----------
  const FIRE_VERT = `
    attribute vec2 aVertexPosition; attribute vec2 aUvs;
    uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
    varying vec2 vUv;
    void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
  const FIRE_FRAG = `
    precision mediump float;
    varying vec2 vUv;
    uniform float uTime; uniform vec2 uSize; uniform vec4 uRect; uniform float uAlpha; uniform float uHeight; uniform float uSeed;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.07 + 1.7; a *= 0.5; } return v; }
    float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    void main(){
      vec2 px = vUv * uSize;
      vec2 c = (uRect.xy + uRect.zw) * 0.5, hb = (uRect.zw - uRect.xy) * 0.5;
      float d = sdBox(px - c, hb, 22.0);                     // < 0 inside, > 0 outside
      float t = uTime + uSeed;
      // flame field rising upward (y down in screen space, so +t scrolls the pattern up)
      vec2 q = vec2(px.x / 46.0, px.y / 95.0);
      float n = fbm(q + vec2(0.0, t * 1.9));
      float n2 = fbm(q * 2.3 + vec2(5.2, t * 3.4));
      // outside the frame the tongues are long, above the top edge longest; inside they stay short
      float k = d > 0.0 ? 1.0 : 2.6;
      if (px.y < uRect.y) k *= 0.6;
      float dist = abs(d) * k;
      float h = uHeight * (0.35 + 0.9 * n);
      float f = clamp(1.0 - dist / h, 0.0, 1.0);
      f *= 0.55 + 0.8 * n2;
      f = clamp(f, 0.0, 1.0);
      f = f * f * (3.0 - 2.0 * f);
      vec3 col = vec3(1.7 * f, 1.25 * f * f, 0.55 * f * f * f * f);
      col += vec3(0.25, 0.06, 0.0) * smoothstep(0.0, 1.0, f) * 0.6;       // ember red base
      col = min(col, vec3(1.0)) * uAlpha;
      gl_FragColor = vec4(col, 0.0);
    }`;
  const fireMeshes = [];
  // a fire ring around the rect (x0,y0,x1,y1) in the parent's space; pad = how far flames may reach
  function FireRect(parent, x0, y0, x1, y1, o) {
    o = o || {};
    if (FX.tex.fireFrames) return FireSprites(parent, x0, y0, x1, y1, o);
    const pad = o.pad || 70, top = o.top || pad * 1.6;
    const X0 = x0 - pad, Y0 = y0 - top, X1 = x1 + pad, Y1 = y1 + pad;
    const geo = new PIXI.Geometry()
      .addAttribute("aVertexPosition", [X0, Y0, X1, Y0, X1, Y1, X0, Y1], 2)
      .addAttribute("aUvs", [0, 0, 1, 0, 1, 1, 0, 1], 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
    const sh = PIXI.Shader.from(FIRE_VERT, FIRE_FRAG, {
      uTime: 0, uSize: [X1 - X0, Y1 - Y0], uRect: [x0 - X0, y0 - Y0, x1 - X0, y1 - Y0],
      uAlpha: 1, uHeight: o.height || 60, uSeed: Math.random() * 50 });
    const m = new PIXI.Mesh(geo, sh);
    m.blendMode = PIXI.BLEND_MODES.ADD;
    parent.addChild(m); fireMeshes.push(m);
    m.box = [x0, y0, x1, y1];
    return m;
  }
  // painted flipbook flames standing along the rect: tall on the top edge, shorter on the sides and the bottom
  function FireSprites(parent, x0, y0, x1, y1, o) {
    const c = new PIXI.Container(); parent.addChild(c);
    const pad = o.pad || 70, top = o.top || pad * 1.6, FH = 112;      // visible flame height in a frame
    const flame = (x, y, h, rot, back) => {
      const f = new PIXI.AnimatedSprite(FX.tex.fireFrames);
      f.anchor.set(0.5, 0.9); f.position.set(x, y); f.rotation = rot || 0;
      const s = h / FH; f.scale.set(s * (0.85 + Math.random() * 0.3), s * (0.85 + Math.random() * 0.35));
      if (Math.random() < 0.5) f.scale.x *= -1;
      f.blendMode = PIXI.BLEND_MODES.ADD; f.animationSpeed = 0.35 + Math.random() * 0.2; f.gotoAndPlay(Math.floor(Math.random() * 16));
      f.alpha = back ? 0.55 : 1; c.addChild(f);
    };
    const run = (a, b, step, fn) => { const n = Math.max(1, Math.round((b - a) / step)); for (let i = 0; i <= n; i++) fn(a + (b - a) * (i / n) + (Math.random() - 0.5) * step * 0.4); };
    const big = y1 - y0 > 60;
    // irregular clusters, not a fence: a big flame and a smaller partner every ~60 px on top, a few side licks
    run(x0 + 20, x1 - 20, 62, (x) => { flame(x, y0 + 8, top * (0.55 + Math.random() * 0.5)); if (Math.random() < 0.6) flame(x + 18, y0 + 6, top * 0.4, 0, true); });
    if (big) run(y0 + 60, y1 - 40, 120, (y) => { flame(x0 + 6, y, pad * (0.6 + Math.random() * 0.4), -1.2); flame(x1 - 6, y, pad * (0.6 + Math.random() * 0.4), 1.2); });
    c.box = [x0, y0, x1, y1];
    return c;
  }
  function updateFire(time) {
    for (let i = fireMeshes.length - 1; i >= 0; i--) {
      const m = fireMeshes[i];
      if (m.destroyed) { fireMeshes.splice(i, 1); continue; }
      m.shader.uniforms.uTime = time;
      m.shader.uniforms.uAlpha = m.worldVisible ? m.worldAlpha : 0;
    }
  }
  function embers(box, n, tint) {
    const [x0, y0, x1, y1] = box;
    for (let k = 0; k < n; k++) {
      const per = 2 * (x1 - x0) + 2 * (y1 - y0);
      let dd = Math.random() * per, x, y;
      if (dd < x1 - x0) { x = x0 + dd; y = y1; } else if ((dd -= x1 - x0) < y1 - y0) { x = x1; y = y1 - dd; }
      else if ((dd -= y1 - y0) < x1 - x0) { x = x1 - dd; y = y0; } else { x = x0; y = y0 + (dd - (x1 - x0)); }
      boardP.emit({ tex: FX.tex.dot, x, y: y - 10, vx: (Math.random() - 0.5) * 60, vy: -160 - Math.random() * 260, ax: (Math.random() - 0.5) * 80,
        s0: 0.12 + Math.random() * 0.12, s1: 0, life: 0.8 + Math.random() * 0.8, tint: tint || (Math.random() < 0.5 ? 0xffd27a : 0xff8a30), a0: 1, a1: 0 });
    }
  }

  // ---------- reels ----------
  function maskRect(x0, y0, x1, y1) { const g = new PIXI.Graphics().beginFill(0xffffff).drawRect(x0, y0, x1 - x0, y1 - y0).endFill(); g.renderable = false; board.addChild(g); return g; }
  class Reel {
    constructor(o) {
      Object.assign(this, o);
      this.n = this.rows + 2; this.offset = 0; this.speed = 0; this.state = "idle"; this.queue = null;
      this.views = []; this.syms = [];
      for (let i = 0; i < this.n; i++) this.views.push(this.make());
    }
    setSyms(ids) { this.syms = ids.slice(); this.views.forEach((v, i) => v.set(ids[i], false)); this.layout(); this.rest(); }
    layout() { this.views.forEach((v, i) => v.setY(this.y0 + (i - 1 + this.offset) * this.pitch)); }
    rest() { this.views.forEach((v, i) => (v.visible = i > 0 && i < this.n - 1)); this.unmask(); }
    showAll() { this.views.forEach((v) => (v.visible = true)); this.domask(); }
    domask() { this.masks.forEach(([c, m]) => (c.mask = m)); }
    unmask() { this.masks.forEach(([c, m]) => { c.mask = null; m.renderable = false; }); }
    // Fortune-games reel (Pascal Porco reelAnimationCacheBuilder): intro lifts the strip a quarter cell (linear, 0.2 s;
    // turbo 0.42 cell in 0.05 s), then a linear loop at full speed, then a decelerating stop on Porco's customStopNormal
    // curve (small overshoot, settle). The stop starts at loop speed, so there is no jolt.
    start(delay, turbo) {
      this.showAll();
      this.queue = null; this.state = "lift"; this.turbo = !!turbo;
      this.vmax = turbo ? this.vTurbo : this.vNormal;
      gsap.to(this, { offset: turbo ? -0.42 : -0.25, duration: turbo ? 0.05 : 0.2, delay: delay || 0, ease: "none", onUpdate: () => this.layout(),
        onComplete: () => { if (this.state === "lift") { this.state = "spin"; this.speed = this.vmax; } } });
    }
    update(dt) {
      if (this.state !== "spin" && this.state !== "stopping") return;
      this.speed = Math.min(this.vmax, this.speed + this.accel * dt);
      this.offset += this.speed * dt;
      while (this.offset >= 1 && (this.state === "spin" || this.state === "stopping")) this.shift();
      this.layout();
      if (this.onSpeed) this.onSpeed(this.speed);
    }
    shift() {
      if (this.state !== "decel") this.offset -= 1;
      const gone = this.syms.pop(); const v = this.views.pop();
      if (gone === "super_wild" && this.onExit && this.speed > 8) this.onExit();
      let id, blur;
      if (this.queue && this.queue.length) { id = this.queue.shift(); blur = false; } else { id = this.rand(); blur = this.speed > 8; }
      this.syms.unshift(id); this.views.unshift(v); v.set(id, blur);
      if (this.queue && this.queue.length === 0) this.queue = null;
    }
    // decelerating stop: the final symbols are queued and scroll in over exactly queue.length - offset cells
    stop(final, fast) {
      return new Promise((res) => {
        this._res = res;
        if (this.state === "lift") { gsap.killTweensOf(this); if (this.offset < 0) this.offset = 0; }
        this.queue = final.slice().reverse().concat([this.above ? this.above(final[0]) : this.rand()]);
        this.state = "decel";
        const dur = fast ? this.stopFast : this.stopDur, D = this.queue.length - this.offset;
        const base = this.offset, tr = { p: 0 };
        let shifts = 0, landed = false, lastP = 0, lastT = gsap.globalTimeline.time();
        gsap.to(tr, { p: D, duration: dur, ease: fast ? "fbStopTurbo" : "fbStop", onUpdate: () => {
          const pos = base + tr.p;
          while (pos - shifts >= 1 && this.queue && this.queue.length) { this.offset -= 1; this.shift(); shifts++; }
          this.offset = Math.max(-0.5, Math.min(0.999, pos - shifts));
          this.layout();
          const now = gsap.globalTimeline.time(), dtt = Math.max(1e-3, now - lastT);
          if (this.onSpeed) this.onSpeed(Math.abs(tr.p - lastP) / dtt);
          lastP = tr.p; lastT = now;
          if (!landed && !this.queue && tr.p >= D * 0.97) { landed = true; this.views.forEach((v, i) => { if (v.blur) v.set(this.syms[i], false); }); if (this.onLand) this.onLand(); }
        }, onComplete: () => {
          this.offset = 0; this.layout(); this.state = "idle"; this.speed = 0;
          if (this.onSpeed) this.onSpeed(0);
          if (!landed && this.onLand) this.onLand();
          this.rest(); const r = this._res; this._res = null; r && r();
        } });
      });
    }
    // long tease stop (multiplier column): the fast roll eases down to a slow tick past the centre, holds there, then
    // the target creeps in with a small overshoot. Velocity profile in cells/s, integrated into an ease; the number of
    // extra (in-order) cells is picked so the roll covers its natural distance. o: { vSlow, tau, t1, t2, over, extra(n), onTick }
    teaseStop(final, o) {
      return new Promise((res) => {
        this._res = res;
        if (this.state === "lift") { gsap.killTweensOf(this); if (this.offset < 0) this.offset = 0; }
        const v0 = Math.max(this.speed, this.vmax * 0.8), vS = o.vSlow, T = o.t1 + o.t2, N = 400;
        const vEnd1 = vS + (v0 - vS) * Math.exp(-o.t1 / o.tau);
        const vel = (t) => t < o.t1 ? vS + (v0 - vS) * Math.exp(-t / o.tau) : vEnd1 * Math.pow(1 - (t - o.t1) / o.t2, 2);
        const cum = [0]; for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + vel((i - 0.5) * T / N) * T / N);
        const dist = cum[N];
        const nExtra = Math.max(0, Math.round(dist + this.offset - final.length - 1));
        this.queue = o.extra(nExtra).concat(final.slice().reverse(), [this.above ? this.above(final[0]) : this.rand()]);
        this.state = "decel";
        const D = this.queue.length - this.offset, over = o.over || 0, base = this.offset, tr = { p: 0 };
        const ease = (x) => { const f = x * N, i = Math.min(N - 1, Math.floor(f)); return (cum[i] + (cum[i + 1] - cum[i]) * (f - i)) / dist; };
        let shifts = 0, landed = false, lastP = 0, lastT = gsap.globalTimeline.time();
        const step = () => {
          const pos = base + tr.p;
          while (pos - shifts >= 1 && this.queue && this.queue.length) {
            this.offset -= 1; this.shift(); shifts++;
            if (o.onTick) o.onTick(this.queue ? this.queue.length : 0, Math.abs(tr.p - lastP) / Math.max(1e-3, gsap.globalTimeline.time() - lastT));
          }
          this.offset = Math.max(-0.5, Math.min(0.999, pos - shifts));
          this.layout();
          const now = gsap.globalTimeline.time(), dtt = Math.max(1e-3, now - lastT);
          if (this.onSpeed) this.onSpeed(Math.abs(tr.p - lastP) / dtt);
          lastP = tr.p; lastT = now;
          if (!landed && !this.queue && tr.p >= D - 0.02) {
            landed = true; this.views.forEach((v, i) => { if (v.blur) v.set(this.syms[i], false); }); if (this.onLand) this.onLand();
            const r = this._res; this._res = null; r && r();        // the round goes on from the landing
          }
        };
        const done = () => {
          this.offset = 0; this.layout(); this.state = "idle"; this.speed = 0; this.tween = null;
          if (this.onSpeed) this.onSpeed(0);
          if (!landed && this.onLand) this.onLand();
          this.rest(); const r = this._res; this._res = null; r && r();
        };
        this.tween = gsap.timeline({ onComplete: done })
          .to(tr, { p: D + over, duration: T, ease, onUpdate: step })
          .to(tr, { p: D, duration: 0.14, ease: "power2.inOut", onUpdate: step });
      });
    }
    // Porco's per-symbol "drop": a small landing squash on the visible symbols
    dropSquash() {
      for (let i = 1; i < this.n - 1; i++) {
        const v = this.views[i];
        if (v.inner) gsap.fromTo(v.inner.scale, { y: 0.93 }, { y: 1, duration: 0.28, ease: "back.out(3)" });
      }
    }
    nudge(dur) {
      this.showAll();
      const id = this.above(this.syms[0]);
      this.syms.pop(); const v = this.views.pop();
      this.syms.unshift(id); this.views.unshift(v); v.set(id, false);
      this.offset = -1; this.layout();
      return FX.tween(this, { offset: 0, duration: dur || 0.46, ease: dur ? "back.out(1.5)" : "back.out(1.9)", onUpdate: () => this.layout() })
        .then(() => this.rest());
    }
    view(row) { return this.views[row + 1]; }
  }

  const reels = [0, 1, 2].map((r) => {
    const c = new PIXI.Container(); reelsL.addChild(c);
    const m = maskRect(REEL_X[r][0] - 2, CELL_Y0, REEL_X[r][1] + 2, WIN_Y1);
    return new Reel({ rows: 3, pitch: CELL_H, y0: rowY(0), vmax: 19, vNormal: 19, vTurbo: 36, accel: 400, stopDur: 0.56, stopFast: 0.2,
      container: c, masks: [[c, m]], onExit: () => fireCurtain(r),
      make: () => new SymView(c, REEL_CX[r]),
      rand: () => { const s = Engine.SYMBOLS; const w = Engine.WEIGHTS; let t = 0; for (const k of s) t += w[k] + 2; let x = Math.random() * t; for (const k of s) { x -= w[k] + 2; if (x < 0) return k; } return "J"; } });
  });
  const colBlur = new PIXI.BlurFilter(0, 4); colBlur.blurX = 0; colBlur.blurY = 0;
  const colReel = new Reel({ rows: 5, pitch: COL_P, y0: COL_Y0, vmax: 26, vNormal: 26, vTurbo: 44, accel: 400, stopDur: 0.62, stopFast: 0.22,
    masks: [[colBack, maskRect(TRAY[0], TRAY[1], TRAY[2], TRAY[3])], [colFront, maskRect(TRAY[0] - 30, TRAY[1], TRAY[2] + 30, TRAY[3])]],
    make: () => new ChipView(), rand: () => Math.floor(Math.random() * Engine.STRIP.length),
    above: (i) => (i + 1) % Engine.STRIP.length,
    onSpeed: (s) => { const b = Math.max(0, (s - 6) * 0.6); colBlur.blurY = b; colBack.filters = colFront.filters = b > 0.5 ? [colBlur] : null; } });
  const stripAt = (c, k) => (c + k + Engine.STRIP.length * 4) % Engine.STRIP.length;
  const colIds = (c) => [3, 2, 1, 0, -1, -2, -3].map((k) => stripAt(c, k));

  // start position: the approved board's grid and a 1000x in the middle of the column
  const START = [["hourglass", "J", "wild"], ["super_wild", "sun", "Q"], ["K", "chest", "A"]];
  reels.forEach((rl, r) => rl.setSyms([rl.rand(), ...START[r], rl.rand()]));
  let colC = Engine.STRIP.indexOf(1000);
  colReel.setSyms(colIds(colC));

  // ---------- UI ----------
  const ui = {};
  function button(name, cx, cy, onTap, shadow) {
    const c = new PIXI.Container(); c.position.set(cx, cy);
    if (shadow) { const l = L(shadow); const s = new PIXI.Sprite(T("UI/" + shadow)); s.position.set(l.x - cx, l.y - cy); c.addChild(s); }
    const body = new PIXI.Container(); c.addChild(body);
    const s = new PIXI.Sprite(T("UI/" + name)); s.anchor.set(0.5); body.addChild(s);
    c.body = body; c.spr = s;
    body.eventMode = "static"; body.cursor = "pointer";
    body.on("pointerdown", () => { SFX.unlock(); gsap.to(body.scale, { x: 0.9, y: 0.9, duration: 0.07 }); });
    const up = () => gsap.to(body.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(3)" });
    body.on("pointerup", up); body.on("pointerupoutside", up);
    body.on("pointertap", () => { SFX.click(); onTap(); });
    uiL.addChild(c);
    return c;
  }
  const centre = (n) => { const l = L(n); return [l.x + l.w / 2, l.y + l.h / 2]; };
  // bars
  for (const n of ["bet_window", "balance_bar"]) {
    const l = L(n + "_fill");
    const f = new PIXI.Sprite(T(`UI/${n}_fill`)); f.position.set(l.x, l.y);
    const b = new PIXI.Sprite(T(`UI/${n}_border`)); b.position.set(l.x, l.y);
    uiL.addChild(f, b); ui[n] = f;
  }
  // SPIN
  const [scx, scy] = centre("spin_base");
  const spinC = new PIXI.Container(); spinC.position.set(scx, scy); uiL.addChild(spinC);
  const spinSh = new PIXI.Sprite(T("UI/spin_shadow")); spinSh.position.set(L("spin_shadow").x - scx, L("spin_shadow").y - scy);
  const spinGlow = new PIXI.Sprite(T("UI/spin_glow")); spinGlow.anchor.set(0.5); spinGlow.blendMode = PIXI.BLEND_MODES.ADD;
  const spinBody = new PIXI.Container();
  const spinBase = new PIXI.Sprite(T("UI/spin_base")); spinBase.anchor.set(0.5);
  const [acx, acy] = centre("spin_arrows");
  const spinArrows = new PIXI.Sprite(T("UI/spin_arrows")); spinArrows.anchor.set(0.5); spinArrows.position.set(acx - scx, acy - scy);
  const spinFlash = new PIXI.Sprite(FX.tex.glow); spinFlash.anchor.set(0.5); spinFlash.scale.set(1.1);
  spinFlash.blendMode = PIXI.BLEND_MODES.ADD; spinFlash.alpha = 0; spinFlash.tint = 0xffc860;
  spinBody.addChild(spinBase, spinArrows, spinFlash);
  spinC.addChild(spinSh, spinGlow, spinBody);
  spinBody.eventMode = "static"; spinBody.cursor = "pointer";
  spinBody.hitArea = new PIXI.Circle(0, 0, 120);
  spinBody.on("pointerdown", () => { SFX.unlock(); gsap.to(spinBody.scale, { x: 0.92, y: 0.92, duration: 0.07 }); });
  spinBody.on("pointerup", () => gsap.to(spinBody.scale, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" }));
  spinBody.on("pointerupoutside", () => gsap.to(spinBody.scale, { x: 1, y: 1, duration: 0.3 }));
  spinBody.on("pointertap", () => onSpinPress());
  let arrowSpeed = 0.35;

  const S = { balance: 10000000, betIdx: 2, ex: false, turbo: false, auto: 0, state: "boot", lastWin: 0 };
  const stake = () => BETS[S.betIdx] * (S.ex ? Engine.EX_COST : 1);

  ui.autoplay = button("autoplay", ...centre("autoplay"), () => toggleAuto(), "autoplay_shadow");
  ui.turbo = button("turbo", ...centre("turbo"), () => toggleTurbo(), "turbo_shadow");
  ui.ex = button("ex_button", ...centre("ex_button"), () => toggleEx(), "ex_shadow");
  if (V2ART) { const t = new PIXI.Text("EX", FX.gold(46, { strokeThickness: 6 })); t.anchor.set(0.5); t.y = 2; ui.ex.body.addChild(t); }   // V2 art is blank
  ui.minus = button("minus", ...centre("minus"), () => changeBet(-1), "minus_shadow");
  ui.plus = button("plus", ...centre("plus"), () => changeBet(1), "plus_shadow");
  ui.sound = button("icon_sound", ...centre("icon_sound"), () => toggleSound());
  ui.menu = button("icon_menu", ...centre("icon_menu"), () => openMenu());
  // active-state glows
  function addAura(btn, tint, scale) {
    const a = new PIXI.Sprite(FX.tex.glow); a.anchor.set(0.5); a.scale.set(scale); a.tint = tint;
    a.blendMode = PIXI.BLEND_MODES.ADD; a.alpha = 0; btn.addChildAt(a, 1); btn.aura = a; return a;
  }
  addAura(ui.turbo, 0x7fd0ff, 1.0); addAura(ui.ex, 0xffd060, 1.05); addAura(ui.autoplay, 0xffd060, 1.0);
  const exRing = new PIXI.Sprite(FX.tex.burst); exRing.anchor.set(0.5); exRing.scale.set(0.2); exRing.alpha = 0;
  exRing.blendMode = PIXI.BLEND_MODES.ADD; ui.ex.addChildAt(exRing, 1);
  const exTag = new PIXI.Text("x1.5 BET", FX.gold(22)); exTag.anchor.set(0.5); exTag.position.set(0, -86); exTag.alpha = 0; ui.ex.addChild(exTag);
  const autoBadge = new PIXI.Container(); autoBadge.position.set(48, -48); autoBadge.visible = false;
  autoBadge.addChild(new PIXI.Graphics().lineStyle(3, 0xffd36b).beginFill(0x8a0e1e).drawCircle(0, 0, 26).endFill());
  const autoTxt = new PIXI.Text("50", FX.plain(24, "#ffffff")); autoTxt.anchor.set(0.5); autoBadge.addChild(autoTxt);
  ui.autoplay.addChild(autoBadge);
  const muteSlash = new PIXI.Graphics().lineStyle(6, 0xff3040).moveTo(-26, -24).lineTo(26, 24); muteSlash.visible = false;
  ui.sound.addChild(muteSlash);

  // texts
  const betTxt = new PIXI.Text("", FX.gold(40)); betTxt.anchor.set(0.5); betTxt.position.set(540, 1760); uiL.addChild(betTxt);
  const exBetTag = new PIXI.Text("EX", FX.gold(20, { fill: FX.TIER_FILL.mega })); exBetTag.anchor.set(0.5); exBetTag.position.set(650, 1760);
  exBetTag.visible = false; uiL.addChild(exBetTag);
  const clockTxt = new PIXI.Text("", FX.gold(26, { fontFamily: "PoppinsM", fontWeight: "500" })); clockTxt.anchor.set(0, 0.5); clockTxt.position.set(48, 1864);
  const balLab = new PIXI.Text("Balance:", FX.gold(32, { fontFamily: "PoppinsM", fontWeight: "500" })); balLab.anchor.set(0, 0.5);
  const balVal = new PIXI.Text("", FX.gold(40)); balVal.anchor.set(0, 0.5);
  const balUnit = new PIXI.Text("AMD", FX.gold(24)); balUnit.anchor.set(0, 0.5);
  const demoTxt = new PIXI.Text("DEMO MODE", FX.gold(20)); demoTxt.anchor.set(0, 0.5); demoTxt.position.set(18, 1815);
  uiL.addChild(clockTxt, balLab, balVal, balUnit, demoTxt);
  const balShown = { v: S.balance };
  function drawBalance() {
    balVal.text = FX.money(balShown.v, 0);
    const wl = balLab.width, wv = balVal.width, wu = balUnit.width;
    const x = 540 - (wl + 12 + wv + 8 + wu) / 2;
    balLab.position.set(x, 1864); balVal.position.set(x + wl + 12, 1864); balUnit.position.set(x + wl + 12 + wv + 8, 1867);
  }
  function setBalance(v, animate) {
    S.balance = v;
    gsap.killTweensOf(balShown);
    if (animate) gsap.to(balShown, { v, duration: 0.8, ease: "power2.out", onUpdate: drawBalance });
    else { balShown.v = v; drawBalance(); }
  }
  function drawBet() {
    betTxt.text = FX.money(stake(), 0);
    exBetTag.visible = S.ex; exBetTag.x = 540 + betTxt.width / 2 + 18;
  }
  function tickClock() { const d = new Date(); clockTxt.text = d.toTimeString().slice(0, 8); }
  setInterval(tickClock, 1000); tickClock(); drawBalance(); drawBet();

  // win bar text: LINE n: icons amount / TOTAL WIN: amount
  const wb = new PIXI.Container(); board.addChild(wb);
  const wbLine = new PIXI.Container(); wb.addChild(wbLine);
  board.setChildIndex(plaqueL, board.children.length - 1);   // win digits draw above the win-bar text
  const wbTotal = new PIXI.Container(); wb.addChild(wbTotal);
  const sep = new PIXI.Graphics(); wb.addChild(sep);
  for (const [y, half] of [[1344, 250], [1402, 300]]) {
    for (let k = 0; k < 20; k++) {
      const t0 = k / 20, t1 = (k + 1) / 20;
      const a = 0.43 * (1 - t0 * t0);
      sep.beginFill(0xffdc96, a).drawRect(540 + t0 * half, y, (t1 - t0) * half, 2).drawRect(540 - t1 * half, y, (t1 - t0) * half, 2).endFill();
    }
  }
  const lineLab = new PIXI.Text("", FX.plain(25, "#FFC438")); lineLab.anchor.set(0, 0.5);
  const lineVal = new PIXI.Text("", FX.plain(27, "#ffffff")); lineVal.anchor.set(0, 0.5);
  const lineIcons = new PIXI.Container();
  wbLine.addChild(lineLab, lineIcons, lineVal);
  const totLab = new PIXI.Text("TOTAL WIN:", FX.plain(33, "#FFC438")); totLab.anchor.set(0, 0.5);
  const totVal = new PIXI.Text("", FX.plain(42, "#ffffff")); totVal.anchor.set(0, 0.5);
  const msgTxt = new PIXI.Text("", FX.gold(38)); msgTxt.anchor.set(0.5); msgTxt.position.set(540, 1346);
  wbTotal.addChild(totLab, totVal); wb.addChild(msgTxt);
  const totShown = { v: 0 };
  function drawTotal() {
    totVal.text = FX.money(totShown.v);
    const w = totLab.width + 14 + totVal.width;
    totLab.position.set(540 - w / 2, 1374); totVal.position.set(540 - w / 2 + totLab.width + 14, 1374);
    // the round's "xN" tag sits right after the total, whatever its length
    if (multTag && !multTag.destroyed && wbTotal.visible) multTag.position.set(540 + w / 2 + multTag.width / 2 + 22, 1374);
  }
  let multTag = null;
  function showMsg(t) { msgTxt.text = t; msgTxt.visible = true; wbTotal.visible = false; wbLine.visible = false; sep.visible = false; }
  function showLine(line, amount) {
    msgTxt.visible = false; wbLine.visible = true; sep.visible = true; wbTotal.visible = true;
    if (!(plaque.visible && plaqueBig.visible)) { gsap.killTweensOf(wbLine); wbLine.alpha = 1; }
    lineLab.text = `LINE ${line.line}:`; lineVal.text = FX.money(amount);
    lineIcons.removeChildren();
    let x = 0;
    line.rows.forEach((row, reel) => {
      const id = curGrid[reel][row];
      const s = new PIXI.Sprite(T(`Symbols/${HIGH.has(id) ? id + "_tile" : id}`)); s.anchor.set(0, 0.5);
      s.scale.set(0.17); s.x = x - 6; x += 47; lineIcons.addChild(s);
    });
    const w = lineLab.width + 16 + x + 10 + lineVal.width;
    const x0 = 540 - w / 2;
    lineLab.position.set(x0, 1318); lineIcons.position.set(x0 + lineLab.width + 16, 1318); lineVal.position.set(x0 + lineLab.width + 16 + x + 10, 1318);
  }
  function showTotal(v, dur) {
    msgTxt.visible = false; wbTotal.visible = !plaque.visible; sep.visible = true;
    gsap.killTweensOf(totShown);
    if (dur && Math.abs(totShown.v - v) < 1e-6) { drawTotal(); return Promise.resolve(); }   // already there (the plaque drove it)
    if (dur) return FX.tween(totShown, { v, duration: dur, ease: "power1.out", onUpdate: () => { drawTotal(); if (Math.random() < 0.4) SFX.tick(); } });
    totShown.v = v; drawTotal();
  }
  showMsg("SPIN TO WIN");

  // ---------- state + controls ----------
  let curGrid = START.map((c) => c.slice());
  function setUiLocked(locked) {
    [ui.minus, ui.plus, ui.ex].forEach((b) => { b.alpha = locked ? 0.55 : 1; b.body.eventMode = locked ? "none" : "static"; });
    if (buyUI) buyUI.setEnabled(!locked && !(S.auto > 0));
  }
  function changeBet(d) {
    if (S.state !== "idle") return;
    S.betIdx = Math.max(0, Math.min(BETS.length - 1, S.betIdx + d));
    drawBet();
    gsap.fromTo(betTxt.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.35, ease: "back.out(3)" });
  }
  function toggleEx() {
    if (S.state !== "idle") return;
    S.ex = !S.ex; drawBet();
    gsap.to(ui.ex.aura, { alpha: S.ex ? 0.55 : 0, duration: 0.3 });
    gsap.to(exRing, { alpha: S.ex ? 0.5 : 0, duration: 0.3 });
    gsap.to(exTag, { alpha: S.ex ? 1 : 0, duration: 0.3 });
    if (S.ex) { burstAt(ui.ex.x, ui.ex.y, 0xffd060, 16); SFX.wildLand(); }
  }
  function toggleTurbo() {
    S.turbo = !S.turbo;
    gsap.to(ui.turbo.aura, { alpha: S.turbo ? 0.6 : 0, duration: 0.25 });
    if (S.turbo) { burstAt(ui.turbo.x, ui.turbo.y, 0x9fe0ff, 14); }
  }
  function stopAuto() {
    S.auto = 0; autoBadge.visible = false; gsap.to(ui.autoplay.aura, { alpha: 0, duration: 0.2 });
    if (buyUI) buyUI.setEnabled(S.state === "idle");                    // BUY is closed while autoplay runs
  }
  function toggleAuto() {
    if (S.auto > 0) { stopAuto(); return; }
    if (S.balance < stake()) { showMsg("NOT ENOUGH BALANCE"); gsap.fromTo(ui.balance_bar, { alpha: 0.4 }, { alpha: 1, duration: 0.15, repeat: 5, yoyo: true }); return; }
    if (buyUI && buyUI.isOpen && buyUI.isOpen()) return;                // not behind an open BUY panel
    S.auto = 50; autoTxt.text = "50"; autoBadge.visible = true;
    gsap.to(ui.autoplay.aura, { alpha: 0.5, duration: 0.2 });
    if (buyUI) buyUI.setEnabled(false);
    if (S.state === "idle") onSpinPress();
  }
  function toggleSound() { SFX.setMuted(!SFX.muted()); muteSlash.visible = SFX.muted(); }
  // ---------- buy feature (src/buy.js panel + Engine.buySpin) ----------
  let buyUI = null;
  if (window.BuyUI && Engine.buySpin && Engine.BUY) {
    buyUI = BuyUI.create({ layer: menuL, W, H, getBet: () => BETS[S.betIdx], money: (v) => FX.money(v, 0),
      onBuy: (kind) => { if (S.state === "idle") spin(null, kind); },
      sfx: { click: () => SFX.click(), confirm: () => SFX.buy() },
      canAfford: (c) => S.balance >= c });
    buyUI.button.position.set(232, 1540);
    uiL.addChild(buyUI.button);
  }

  // ---------- effects helpers ----------
  function burstAt(x, y, tint, n, parent) {
    const P = parent || topP;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 200 + Math.random() * 420;
      P.emit({ tex: Math.random() < 0.5 ? FX.tex.spark : FX.tex.dot, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3,
        life: 0.5 + Math.random() * 0.5, s0: 0.25 + Math.random() * 0.3, s1: 0, tint, vr: 3 });
    }
  }
  function ringAt(x, y, tint, s1, life, parent) {
    const r = (parent || topP).emit({ tex: FX.tex.ring, x, y, s0: 0.2, s1: s1 || 1.6, life: life || 0.5, tint, a0: 1, a1: 0 });
    return r;
  }
  // painted impact flipbook (white flash -> gold star burst -> fire ring -> embers), played once
  function boom(x, y, sc, tint, parent) {
    if (!FX.tex.impactFrames) return;
    const b = new PIXI.AnimatedSprite(FX.tex.impactFrames); b.anchor.set(0.5); b.position.set(x, y);
    b.scale.set(sc || 1); b.rotation = Math.random() * Math.PI * 2; b.blendMode = PIXI.BLEND_MODES.ADD;
    if (tint) b.tint = tint;
    b.loop = false; b.animationSpeed = 0.55 * gsap.globalTimeline.timeScale(); b.onComplete = () => { booms.delete(b); b.destroy(); };
    booms.add(b); (parent || fxTop).addChild(b); b.play();
  }
  const booms = new Set();                        // live explosions: their speed follows the game clock (main ticker)
  // painted dust puffs (normal blend) rolling out from a point
  function smokeAt(x, y, n, sc) {
    for (let k = 0; k < n; k++) {
      const a = -Math.PI * (0.1 + 0.8 * Math.random());
      topP.emit({ tex: FX.tex.smoke, x: x + (Math.random() - 0.5) * 60, y, vx: Math.cos(a) * (120 + Math.random() * 220), vy: Math.sin(a) * (40 + Math.random() * 120),
        drag: 2.2, s0: (sc || 0.5) * (0.6 + Math.random() * 0.5), s1: (sc || 0.5) * 1.5, life: 0.7 + Math.random() * 0.4, a0: 0.75, a1: 0,
        tint: 0xf2dcc0, vr: (Math.random() - 0.5) * 1.5, blend: PIXI.BLEND_MODES.NORMAL });
    }
  }
  function flashAt(x, y, tint, s, life) { topP.emit({ tex: FX.tex.glow, x, y, s0: s, s1: s * 1.3, life: life || 0.35, tint, a0: 0.9, a1: 0 }); }
  let shakeT = 0, shakeA = 0;
  // hit-stop: the whole game holds for a few frames on a heavy impact (real time), then carries on; and a phone buzz
  let hitStopOn = false;
  function hitStop(ms) {
    if (hitStopOn || S.turbo || S.respin) return;
    const ts = gsap.globalTimeline.timeScale(), low = ts * 0.05; hitStopOn = true;
    gsap.globalTimeline.timeScale(low);
    setTimeout(() => { hitStopOn = false; if (Math.abs(gsap.globalTimeline.timeScale() - low) < 1e-6) gsap.globalTimeline.timeScale(ts); }, ms);
  }
  // only once the player has really touched the page (browsers block and log it otherwise)
  const buzz = (ms) => { try { if (navigator.vibrate && !SFX.muted() && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) navigator.vibrate(ms); } catch (e) { /* not supported */ } };
  function shake(a, t) { shakeA = Math.max(shakeA, a); shakeT = Math.max(shakeT, t); }

  // ---------- bull reactions (code until the Kling clips exist) ----------
  function bullReact(kind) {
    if (kind === "spin") { flameKick(0.35); return; }      // no dip: the bull must not move with the falling symbols
    if (kind === "tease" || kind === "win" || kind === "big") {
      const peak = kind === "win" ? 1 : 1;
      eyes.forEach((e) => gsap.fromTo(e, { alpha: peak }, { alpha: 0.45, duration: kind === "big" ? 1.6 : 0.8, ease: "power2.in" }));
      eyes.forEach((e) => gsap.fromTo(e.scale, { x: 0.55, y: 0.34 }, { x: 0.32, y: 0.2, duration: 0.8 }));
    }
    if (kind === "big" || kind === "tease") {
      gsap.fromTo(bullAura, { alpha: 0.55 }, { alpha: 0, duration: kind === "big" ? 2.2 : 1.4, ease: "power2.in" });
      gsap.fromTo(bull.scale, { x: 1.025, y: 1.025 }, { x: 1, y: 1, duration: 0.9, ease: "elastic.out(1,0.5)" });
    }
    if (kind === "big") {
      // the roar sound lands on the open mouth: it fires on the clip's own clock at events.roar (the sound needs
      // ~0.45 s to reach full voice, so the event sits that much before the mouth opens wide)
      const mv = bullLive() ? bullPlay("bull_big") : null;
      const at = mv && mv.c.cfg.events && mv.c.cfg.events.roar;
      if (!mv) SFX.roar();
      else if (mv.fresh) { if (at == null) SFX.roar(); else mv.at("roar").then(() => { if (!mv.ended || mv.why === "end") SFX.roar(); }); }
    }
  }
  const clipBusy = {};
  // ---------- bull moves: Kling one-shots over the idle loop (each starts and ends on the idle's first frame) ----------
  // One move at a time. A request while a move plays fast-forwards that move to its end pose, then the new one starts.
  // clips.json per move: rates [[clip t, playbackRate]], events {name: clip t}, track [[t, x, y, flame power]] (clip px).
  const bullDir = { cur: null, queue: [], chain: Promise.resolve() };
  const BULL_TURBO = 1.35, BULL_HURRY = 2.6;
  function bullPlay(name, k) {
    const c = clips[name], idle = clips.bull_idle;
    if (!c || !idle) return null;
    const same = [bullDir.cur].concat(bullDir.queue).find((m) => m && m.name === name && !m.ended);
    if (same) { same.fresh = false; return same; }
    const mv = { name, c, fresh: true, hurry: false, started: false, ended: false, waits: [], t: 0, k: k || 1 };
    let startRes, doneRes;
    mv.startedP = new Promise((r) => (startRes = r)); mv.done = new Promise((r) => (doneRes = r));
    mv.at = (ev) => {
      const t = typeof ev === "number" ? ev : (c.cfg.events || {})[ev];
      if (t == null || mv.ended || (mv.started && mv.t >= t)) return Promise.resolve();
      return new Promise((res) => mv.waits.push({ t, res }));
    };
    if (bullDir.cur && !bullDir.cur.ended) bullDir.cur.hurry = true;
    bullDir.queue.forEach((m) => (m.hurry = true));
    bullDir.queue.push(mv);
    bullDir.chain = bullDir.chain.then(() => new Promise((res) => {
      bullDir.queue.splice(bullDir.queue.indexOf(mv), 1);
      bullDir.cur = mv;
      let swapped = false, seen = performance.now(), lastT = -1;
      mv.finish = (why) => {
        if (mv.ended) return;
        mv.ended = true; mv.why = why || "end"; mv.waits.forEach((w) => w.res()); mv.waits = [];
        const swap = () => {
          if (swapped) return; swapped = true;
          idle.sprite.visible = true; c.sprite.visible = false; c.video.pause();
          if (bullDir.cur === mv) bullDir.cur = null;
          bullDir.last = mv.name + ":" + mv.why + "@" + mv.t.toFixed(2);
          doneRes(); res();
        };
        idle.video.addEventListener("seeked", () => setTimeout(swap, 45), { once: true });
        idle.video.currentTime = 0;                       // the idle restarts on the shared start pose
        setTimeout(swap, 300);
      };
      mv.watch = () => {                                   // a stalled video must not hold the game
        if (mv.t !== lastT || document.hidden) { lastT = mv.t; seen = performance.now(); } else if (performance.now() - seen > (MOBILE ? 2500 : 1500)) mv.finish("stall");   // a hidden tab is not a stall
      };
      c.video.onended = () => mv.finish();
      c.video.currentTime = 0; c.video.playbackRate = BASE_TS * bullRate(mv, 0);
      c.sprite.alpha = 0; c.sprite.visible = true;
      // play() can be interrupted once (the previous move's clean-up pause, a tab switch): try again before giving up
      const pr = c.video.play(); if (pr && pr.catch) pr.catch((e) => {
        if (mv.ended) return;
        const p2 = c.video.play();
        if (p2 && p2.catch) p2.catch((e2) => { console.warn("bull move", name, String(e2)); mv.finish("play"); });
      });
      gsap.to(c.sprite, { alpha: 1, duration: 0.1, ease: "none", onComplete: () => { if (!mv.ended) idle.sprite.visible = false; } });
      mv.started = true; startRes();
    }));
    return mv;
  }
  function bullRate(mv, t) {
    let r = 1;
    for (const [t0, k] of (mv.c.cfg.rates || [])) if (t >= t0) r = k;
    return r * (mv.k || 1) * (S.turbo ? BULL_TURBO : 1) * (mv.hurry ? BULL_HURRY : 1);
  }
  // game seconds a move takes from clip time t0 to t1 (not hurried)
  function bullSpan(name, t0, t1) {
    const c = clips[name]; if (!c) return 0;
    const rs = (c.cfg.rates || [[0, 1]]).concat([[1e9, 1]]);
    let d = 0;
    for (let i = 0; i < rs.length - 1; i++) {
      const a = Math.max(t0, rs[i][0]), b = Math.min(t1, rs[i + 1][0]);
      if (b > a) d += (b - a) / rs[i][1];
    }
    return d / (S.turbo ? BULL_TURBO : 1);
  }
  function bullTick() {
    const mv = bullDir.cur;
    if (!mv || !mv.started || mv.ended) return;
    const v = mv.c.video;
    mv.t = v.currentTime;
    const r = Math.min(8, Math.max(0.07, gsap.globalTimeline.timeScale() * bullRate(mv, mv.t)));   // browsers refuse rates under 1/16
    if (Math.abs(v.playbackRate - r) > 0.01) v.playbackRate = r;
    for (let i = mv.waits.length - 1; i >= 0; i--) if (mv.t >= mv.waits[i].t) { mv.waits[i].res(); mv.waits.splice(i, 1); }
    // back from a hidden tab the browser may have left the move's video paused: resume it rather than cut the move
    if (v.paused && !v.ended && !document.hidden) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
    if (v.ended) mv.finish("end"); else mv.watch();
  }
  // clip px of a bull move -> game px
  function bullPt(c, p) { return fxTop.toLocal(c.sprite.toGlobal(new PIXI.Point(p[0], p[1]))); }

  // ---------- win presentation ----------
  const winObjs = [];
  let lineCycle = null;
  function clearWin() {
    if (lineCycle) { lineCycle.kill(); lineCycle = null; }
    const killDeep = (o) => { gsap.killTweensOf(o); if (o.scale) gsap.killTweensOf(o.scale); if (o._tw) o._tw.forEach((t) => t.kill()); (o.children || []).forEach(killDeep); };
    winObjs.forEach((o) => { killDeep(o); o.destroy({ children: true }); });
    winObjs.length = 0;
    reels.forEach((rl) => rl.views.forEach((v) => { gsap.killTweensOf(v.inner.scale); gsap.killTweensOf(v.b.scale); v.inner.scale.set(1); v.b.scale.set(1); v.dim(0); }));
    colReel.views.forEach((v) => { gsap.killTweensOf(v.inner.scale); v.inner.scale.set(1); v.dim(0); });
    plaque.visible = false; accum.visible = false; cntBox.visible = false; plaqueBig.visible = false; centreMark.visible = false;
    lineGfx.length = 0;
    feature(false);
    winEmitters.length = 0;
  }
  const winEmitters = [], lineGfx = [];
  function payline(rows, alpha) {
    const pts = [[REEL_X[0][0] + 2, rowY(rows[0]) + (rows[0] === rows[2] ? 0 : (rows[0] - rows[1]) * 60)]];
    rows.forEach((r, reel) => pts.push([REEL_CX[reel], rowY(r)]));
    pts.push([REEL_X[2][1] - 2, rowY(rows[2]) + (rows[0] === rows[2] ? 0 : (rows[2] - rows[1]) * 60)]);
    const g = new PIXI.Graphics(); g.blendMode = PIXI.BLEND_MODES.ADD;
    const prog = { t: 0 };
    const draw = () => {
      g.clear();
      const total = pts.length - 1, upto = prog.t * total;
      for (const [w, c, a] of [[22, 0xff9a1a, 0.28], [10, 0xffd36b, 0.85], [3.5, 0xffffff, 1]]) {
        g.lineStyle({ width: w, color: c, alpha: a * (alpha || 1), cap: PIXI.LINE_CAP.ROUND, join: PIXI.LINE_JOIN.ROUND });
        g.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i <= total; i++) {
          if (i <= upto) g.lineTo(pts[i][0], pts[i][1]);
          else { const f = upto - (i - 1); if (f > 0) g.lineTo(pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f); break; }
        }
      }
    };
    draw();
    g._tw = [gsap.to(prog, { t: 1, duration: 0.38, ease: "power1.inOut", onUpdate: draw })];
    boardFx.addChild(g); winObjs.push(g);
    return g;
  }
  function cellHighlight(reel, row) {
    const cx = REEL_CX[reel], cy = rowY(row);
    const glow = new PIXI.Sprite(FX.tex.glow); glow.anchor.set(0.5); glow.position.set(cx, cy); glow.scale.set(1.25, 1.05);
    glow.tint = 0xffb43a; glow.blendMode = PIXI.BLEND_MODES.ADD; glow.alpha = 0.0;
    gsap.to(glow, { alpha: 0.75, duration: 0.25 });
    gsap.fromTo(glow.scale, { x: 1.4, y: 1.18 }, { x: 1.25, y: 1.05, duration: 0.5, ease: "power2.out" });
    cellFxBack.addChild(glow); winObjs.push(glow);
    // glowing cell frame with a light running round it
    const fr = new PIXI.Container(); fr.position.set(cx, cy);
    const w = REEL_X[reel][1] - REEL_X[reel][0] - 10, h = CELL_H - 10;
    const outer = new PIXI.Graphics().lineStyle(12, 0xff9a1a, 0.35).drawRoundedRect(-w / 2, -h / 2, w, h, 18);
    outer.filters = [new PIXI.BlurFilter(6)];
    const inner = new PIXI.Graphics().lineStyle(4, 0xffe08a, 1).drawRoundedRect(-w / 2, -h / 2, w, h, 18);
    outer.blendMode = inner.blendMode = PIXI.BLEND_MODES.ADD;
    const runner = new PIXI.Sprite(FX.tex.spark); runner.anchor.set(0.5); runner.scale.set(0.5); runner.blendMode = PIXI.BLEND_MODES.ADD;
    const runner2 = new PIXI.Sprite(FX.tex.spark); runner2.anchor.set(0.5); runner2.scale.set(0.5); runner2.blendMode = PIXI.BLEND_MODES.ADD;
    fr.addChild(outer, inner, runner, runner2);
    const per = 2 * (w + h), path = { t: 0 };
    const at = (t) => { let d = ((t % 1) + 1) % 1 * per; if (d < w) return [-w / 2 + d, -h / 2]; d -= w; if (d < h) return [w / 2, -h / 2 + d]; d -= h; if (d < w) return [w / 2 - d, h / 2]; d -= w; return [-w / 2, h / 2 - d]; };
    fr._tw = [gsap.to(path, { t: 0.5, duration: 0.35, ease: "power1.inOut", onUpdate: () => { const [x, y] = at(path.t); runner.position.set(x, y); const [x2, y2] = at(path.t + 0.5); runner2.position.set(x2, y2); },
      onComplete: () => gsap.to([runner, runner2], { alpha: 0, duration: 0.2 }) })];
    fr.alpha = 0; gsap.to(fr, { alpha: 1, duration: 0.2 });
    boardFx.addChild(fr); winObjs.push(fr);
    // symbol: pulse + light sweep masked by the symbol itself
    const v = reels[reel].view(row);
    const hero = v.hero;
    gsap.timeline().fromTo(hero.scale, { x: 1, y: 1 }, { x: 1.06, y: 1.06, duration: 0.1, ease: "power2.out" })
      .to(hero.scale, { x: 1, y: 1, duration: 0.16, ease: "power2.out" });
    const sh = new PIXI.Container(); sh.position.set(cx, cy);
    const m = new PIXI.Sprite(v.a.texture); m.anchor.set(0.5);
    const band = new PIXI.Sprite(FX.tex.shine); band.anchor.set(0.5); band.scale.set(0.9, 14); band.rotation = 0.45;
    band.blendMode = PIXI.BLEND_MODES.ADD; band.alpha = 0.55; band.x = -260;
    sh.addChild(m, band); band.mask = m;
    gsap.to(band, { x: 260, duration: 0.7, ease: "power1.inOut" });
    boardFx.addChild(sh); winObjs.push(sh);
    winEmitters.push({ x: cx, y: cy, w, h, t: 0, n: 3 });     // three sparkles per winner, not a fountain
    return { glow, fr, sh };
  }
  // ---------- base-win plaque (board centre, as Garuda); becomes big gold digits after the multiplier ----------
  const PLAQUE_S = 0.62;     // the result rail: BASE WIN -> xMULT -> WIN on the win bar, below the grid (no cell is covered)
  const plaque = new PIXI.Container(); plaque.position.set(540, 1372); plaque.visible = false; plaqueL.addChild(plaque);
  const plaqueBg = new PIXI.Graphics();
  plaqueBg.beginFill(0x2a0508, 0.65).drawRoundedRect(-176, -58, 352, 124, 30).endFill();
  plaqueBg.beginFill(0x5a0000).lineStyle(5, 0xffd36b).drawRoundedRect(-170, -54, 340, 108, 26).endFill();
  plaqueBg.beginFill(0xa01a28, 0.55).lineStyle(0).drawRoundedRect(-160, -46, 320, 44, 20).endFill();
  const plaqueGlow = new PIXI.Sprite(FX.tex.glow); plaqueGlow.anchor.set(0.5); plaqueGlow.scale.set(2.6, 1.3);
  plaqueGlow.tint = 0xffaa00; plaqueGlow.blendMode = PIXI.BLEND_MODES.ADD; plaqueGlow.alpha = 0.6;
  const plaqueTxt = new PIXI.Text("", FX.gold(64, { fill: ["#FFF6A9", "#F7C640", "#E69C00"] })); plaqueTxt.anchor.set(0.5);
  const plaqueBig = new PIXI.BitmapText("0", { fontName: "gold_digits", fontSize: 193 }); plaqueBig.anchor.set(0.5); plaqueBig.visible = false;
  plaque.addChild(plaqueGlow, plaqueBg, plaqueTxt, plaqueBig);
  const plaqueShown = { v: 0 };
  const syncTotal = () => { totShown.v = plaqueShown.v; drawTotal(); };   // every copy shows one value
  const drawPlaque = () => { plaqueTxt.text = FX.money(plaqueShown.v); const k = Math.min(1, 300 / plaqueTxt.width); plaqueTxt.scale.set(k); syncTotal(); };
  const drawBig = () => {
    plaqueBig.text = FX.money(plaqueShown.v); plaqueBig.scale.set(Math.min(0.62, 700 / Math.max(1, plaqueBig.textWidth))); syncTotal();
    if (multTag && !multTag.destroyed && plaqueBig.visible) multTag.position.set(plaque.x + (plaqueBig.width * plaque.scale.x) / 2 + multTag.width / 2 + 18, plaque.y + 8);
  };

  // nudge counter box (00/05) above the column, pink running-total badge under it
  const cntBox = new PIXI.Container(); cntBox.position.set(COL_CX, 488); cntBox.visible = false; plaqueL.addChild(cntBox);
  cntBox.addChild(new PIXI.Graphics().beginFill(0x000000, 0.55).drawRoundedRect(-100, -40, 200, 80, 14).endFill()
    .beginFill(0x1a0a0e).lineStyle(4, 0xffd36b).drawRoundedRect(-94, -34, 188, 68, 12).endFill());
  const cntLab = new PIXI.Text("NUDGES LEFT", FX.plain(19, "#ffd36b")); cntLab.anchor.set(0.5); cntLab.y = -20; cntBox.addChild(cntLab);
  const cntTxt = new PIXI.Text("5", FX.plain(44, "#ffffff")); cntTxt.anchor.set(0.5); cntTxt.y = 9; cntBox.addChild(cntTxt);
  // permanent brackets on the centre chip while the feature runs: only this chip is collected
  const centreMark = new PIXI.Container(); centreMark.visible = false; plaqueL.addChild(centreMark);
  for (const [x, dir] of [[838, 1], [1050, -1]]) {
    const g = new PIXI.Graphics().beginFill(0x000000, 0.45).drawPolygon([x - dir * 4, COL_CY - 30, x + dir * 26, COL_CY, x - dir * 4, COL_CY + 30]).endFill()
      .beginFill(0xffd36b).lineStyle(2, 0x7a4a10).drawPolygon([x - dir * 2, COL_CY - 24, x + dir * 20, COL_CY, x - dir * 2, COL_CY + 24]).endFill();
    centreMark.addChild(g);
  }
  const accum = new PIXI.Container(); accum.position.set(COL_CX, 556); accum.visible = false; plaqueL.addChild(accum);
  const accBg = new PIXI.Graphics().beginFill(0x2a0508, 0.7).drawRoundedRect(-106, -40, 212, 80, 24).endFill()
    .beginFill(0x9a1474).lineStyle(4, 0xffd36b).drawRoundedRect(-100, -34, 200, 68, 20).endFill()
    .beginFill(0xff6ad0, 0.4).lineStyle(0).drawRoundedRect(-92, -28, 184, 26, 14).endFill();
  const accGlow = new PIXI.Sprite(FX.tex.glow); accGlow.anchor.set(0.5); accGlow.scale.set(1.9, 1.0); accGlow.tint = 0xff55ff;
  accGlow.blendMode = PIXI.BLEND_MODES.ADD; accGlow.alpha = 0.7;
  const accTxt = new PIXI.Text("x1", FX.gold(58)); accTxt.anchor.set(0.5); accTxt.y = 8;
  const accLab = new PIXI.Text("TOTAL", FX.plain(17, "#ffe6f4")); accLab.anchor.set(0.5); accLab.y = -24;
  accum.addChild(accGlow, accBg, accTxt, accLab);

  // feature state: fire around the whole board, rays behind the bull, darker sky
  const fireFrame = new PIXI.Container(); fireFrame.visible = false; boardFx.addChild(fireFrame);
  {
    const x0 = 10, y0 = 594, x1 = 1070, y1 = 1288;
    const glowLine = new PIXI.Graphics().lineStyle(16, 0xff7a1a, 0.5).drawRoundedRect(x0, y0, x1 - x0, y1 - y0, 24);
    glowLine.filters = [new PIXI.BlurFilter(10)]; glowLine.blendMode = PIXI.BLEND_MODES.ADD;
    fireFrame.addChild(glowLine);
    FireRect(fireFrame, x0, y0, x1, y1, { pad: 60, top: 110, height: 70 });
    fireFrame.box = [x0, y0, x1, y1];
  }
  const featRays = new PIXI.Sprite(FX.tex.burst); featRays.anchor.set(0.5); featRays.position.set(bull.x, bl.y + bl.h * 0.38);
  featRays.scale.set(1.35); featRays.tint = 0xffaa00; featRays.blendMode = PIXI.BLEND_MODES.ADD; featRays.alpha = 0;
  bullL.addChildAt(featRays, 0);
  const sky = { k: 0 };
  const drawSky = () => { const g = Math.round(255 * (1 - 0.38 * sky.k)); const r = Math.round(g * (1 - 0.05 * sky.k)); bg.tint = (r << 16) | (Math.round(g * 0.93) << 8) | Math.round(g * 0.9); };
  let featureOn = false;
  function feature(on) {
    if (on === featureOn) return;
    featureOn = on;
    gsap.killTweensOf(fireFrame); gsap.killTweensOf(featRays); gsap.killTweensOf(sky);
    if (on) {
      fireFrame.visible = true; fireFrame.alpha = 0;           // ignite bright, then settle to a sustained heat
      gsap.timeline().to(fireFrame, { alpha: 1, duration: 0.3, ease: "power2.out" }).to(fireFrame, { alpha: 0.62, duration: 0.45, ease: "power1.inOut" });
      gsap.to(featRays, { alpha: 0.55, duration: 0.5 });
      gsap.to(sky, { k: 1, duration: 0.6, onUpdate: drawSky });
      SFX.rumble(0.8); shake(8, 0.3); VFX.bloom(true, 0.25); SFX.music("feature"); SFX.fire(true);
      VFX.shockwave(540, 940, { amp: 22, radius: 1300, dur: 0.8 });
    } else {
      gsap.to(fireFrame, { alpha: 0, duration: 0.3, onComplete: () => (fireFrame.visible = false) });
      gsap.to(featRays, { alpha: 0, duration: 0.3 });
      gsap.to(sky, { k: 0, duration: 0.3, onUpdate: drawSky });
      VFX.bloom(false); SFX.music("base"); SFX.fire(false);
    }
  }

  // the colour a multiplier value reads as (its chip), for the hit flash
  const multTint = (v) => v >= 500 ? 0xff5a3c : v >= 100 ? 0xffe8a0 : v >= 25 ? 0xff60d0 : v >= 10 ? 0x5a9cff : v >= 5 ? 0x50c8ff : v >= 3 ? 0x60ff90 : 0xffd070;
  const screenFlash = new PIXI.Graphics().beginFill(0xffffff).drawRect(-200, -200, W + 400, H + 400).endFill();
  screenFlash.blendMode = PIXI.BLEND_MODES.ADD; screenFlash.alpha = 0; screenFlash.visible = false; fxTop.addChild(screenFlash);
  function flashScreen(tint, a, dur) {
    gsap.killTweensOf(screenFlash); screenFlash.tint = tint; screenFlash.visible = true;
    gsap.fromTo(screenFlash, { alpha: a }, { alpha: 0, duration: dur, ease: "power2.out", onComplete: () => (screenFlash.visible = false) });
  }
  function impactAt(p, v) {
    VFX.shockwave(p.x, p.y, { amp: v >= 10 ? 30 : 18, radius: v >= 10 ? 900 : 600 });
    starFlash(p.x, p.y, v >= 10 ? 1.2 : 0.8, 0xfff0c0);
    ringAt(p.x, p.y, 0xffee88, 2.0, 0.25); flashAt(p.x, p.y, 0xfff0c0, 1.1, 0.08);
    burstAt(p.x, p.y, 0xffd060, 12);
    shake(v >= 10 ? 8 : 5, 0.15); SFX.impact(v >= 10); if (v >= 10) hitStop(60); buzz(v >= 10 ? 30 : 15);
  }
  function pulseChip(big) {
    const v = colReel.views[3];
    gsap.fromTo(v.inner.scale, { x: big ? 1.45 : 1.3, y: big ? 1.45 : 1.3 }, { x: 1, y: 1, duration: 0.5, ease: "back.out(2)" });
    gsap.fromTo(v.flash, { alpha: 1 }, { alpha: 0, duration: 0.6 });
    ringAt(COL_CX, COL_CY, 0xffd060, 1.3, 0.45);
  }
  // Garuda multiplier hit: 0.5 s charge in place (1.6x, hot glow), 0.3 s flight, 0.2 s impact, 0.2 s absorb
  async function multHit(v, struck) {
    const chip = colReel.views[3], from = { x: COL_CX, y: COL_CY }, to = { x: plaque.x, y: plaque.y };
    const glow = new PIXI.Sprite(FX.tex.glow); glow.anchor.set(0.5); glow.position.set(from.x, from.y);
    glow.tint = 0xfff275; glow.blendMode = PIXI.BLEND_MODES.ADD; glow.alpha = 0; glow.scale.set(0.6); fxTop.addChild(glow);
    const cd = struck ? 0.16 : S.turbo ? 0.25 : 0.5;    // already struck by the bull's fireball: no second wind-up
    if (!struck) SFX.tease(cd);
    gsap.to(glow, { alpha: 0.5, duration: cd }); gsap.to(glow.scale, { x: 1.5, y: 1.15, duration: cd, ease: "power2.out" });
    await FX.tween(chip.inner.scale, { x: 1.6, y: 1.6, duration: cd, ease: "power2.out" });
    const c = new PIXI.Container(); c.position.set(from.x, from.y); c.scale.set(1.6);
    const g2 = new PIXI.Sprite(FX.tex.glow); g2.anchor.set(0.5); g2.scale.set(1.2, 0.8); g2.tint = 0xffc84a; g2.blendMode = PIXI.BLEND_MODES.ADD; g2.alpha = 0.55;
    const s = new PIXI.Sprite(chipLabelTex(v)); s.anchor.set(0.5);
    c.addChild(g2, s); fxTop.addChild(c);
    chip.inner.scale.set(1);
    gsap.to(glow, { alpha: 0, duration: 0.2, onComplete: () => glow.destroy() });
    SFX.fly();
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 }, p = { t: 0 };
    await FX.tween(p, { t: 1, duration: 0.3, ease: "power2.in", onUpdate: () => {
      const q = FX.bezier(from, mid, to, p.t); c.position.set(q.x, q.y);
      if (nEmit(40)) topP.emit({ tex: FX.tex.spark, x: q.x, y: q.y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, s0: 0.35, s1: 0, life: 0.2, tint: 0xffd700 });
    } });
    impactAt(to, v);
    const hitK = Math.min(1, Math.log10(Math.max(2, v)) / 2);          // 2x = 0.15 ... 100x+ = 1
    flashScreen(multTint(v), 0.1 + 0.14 * hitK, 0.3);
    gsap.killTweensOf(plaque.scale);
    gsap.fromTo(plaque.scale, { x: PLAQUE_S * (1.18 + 0.22 * hitK), y: PLAQUE_S * (1.18 + 0.22 * hitK) }, { x: PLAQUE_S, y: PLAQUE_S, duration: 0.35, ease: "back.out(2.2)" });
    if (v >= 10) { flameKick(1.3); bullReact("tease"); } else if (v >= 5) { flameKick(0.8); bullReact("win"); } else flameKick(0.4);
    await FX.tween(c.scale, { x: 1.8, y: 1.8, duration: 0.07 });
    await FX.tween(c.scale, { x: 1.4, y: 1.4, duration: 0.13 });
    gsap.to(c, { alpha: 0, duration: 0.2, ease: "power2.in" });
    await FX.tween(c.scale, { x: 0, y: 0, duration: 0.2, ease: "power2.in" });
    c.destroy({ children: true });
  }
  // a value streaks straight up from the column centre into the pink badge (0.12 s)
  async function streakToBadge(v) {
    const c = new PIXI.Container(); c.position.set(COL_CX, COL_CY);
    const g = new PIXI.Sprite(FX.tex.glow); g.anchor.set(0.5); g.scale.set(0.9, 1.4); g.tint = 0xff8adf; g.blendMode = PIXI.BLEND_MODES.ADD;
    const s = new PIXI.Sprite(chipLabelTex(v)); s.anchor.set(0.5); s.scale.set(0.7);
    c.addChild(g, s); fxTop.addChild(c);
    SFX.fly();
    await FX.tween(c, { y: accum.y, duration: 0.12, ease: "none", onUpdate: () => {
      for (let k = 0, n = nEmit(80); k < n; k++) topP.emit({ tex: FX.tex.dot, x: c.x + (Math.random() - 0.5) * 30, y: c.y + 20, vy: 60, s0: 0.5, s1: 0, life: 0.3, tint: k % 2 ? 0xffd060 : 0xff6ad0 });
    } });
    c.destroy({ children: true });
  }
  // fire beam from a SUPER WILD into the column centre
  async function beam(from, to, tint) {
    const p = { t: 0 }, mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 160 };
    const head = new PIXI.Sprite(FX.tex.glow); head.anchor.set(0.5); head.scale.set(0.6); head.tint = tint; head.blendMode = PIXI.BLEND_MODES.ADD;
    fxTop.addChild(head);
    await FX.tween(p, { t: 1, duration: 0.42, ease: "power1.in", onUpdate: () => {
      const q = FX.bezier(from, mid, to, p.t); head.position.set(q.x, q.y);
      for (let k = 0, n = nEmit(60); k < n; k++) topP.emit({ tex: k ? FX.tex.dot : FX.tex.flame, x: q.x + (Math.random() - 0.5) * 22, y: q.y + (Math.random() - 0.5) * 22,
        vy: -60, s0: k ? 0.6 : 0.5, s1: 0, life: 0.5, tint, rot: Math.random() * 6 });
    } });
    head.destroy();
  }
  // the running total fires a cyan-white laser into the plaque, then slams in (Garuda 01:01.7)
  async function laserApply(acc) {
    const from = { x: accum.x, y: accum.y }, to = { x: plaque.x, y: plaque.y };
    const g = new PIXI.Container(); fxTop.addChild(g);
    const L = Math.hypot(to.x - from.x, to.y - from.y), ang = Math.atan2(to.y - from.y, to.x - from.x);
    g.position.set(from.x, from.y); g.rotation = ang;
    const beam = (tex, sy, tint, a) => { const b = new PIXI.Sprite(tex); b.anchor.set(0, 0.5); b.blendMode = PIXI.BLEND_MODES.ADD;
      b.tint = tint; b.alpha = a; b.scale.y = sy; g.addChild(b); return b; };
    const outer = beam(FX.tex.shine, 2.6, 0xff6a1a, 0.45), mid = beam(FX.tex.shine, 1.3, 0xffc860, 0.9), core = beam(FX.tex.shine, 0.5, 0xfff4dc, 1);
    const bolt = FX.tex.bolts ? new PIXI.Sprite(FX.tex.bolts[0]) : null;
    if (bolt) { bolt.anchor.set(0.5, 0); bolt.rotation = -Math.PI / 2; bolt.blendMode = PIXI.BLEND_MODES.ADD; bolt.tint = 0xffd890; bolt.alpha = 0.7; g.addChild(bolt); }
    const head = new PIXI.Sprite(FX.tex.star8); head.anchor.set(0.5); head.blendMode = PIXI.BLEND_MODES.ADD; head.tint = 0xffe8b0; head.scale.set(0.55); g.addChild(head);
    const p = { t: 0 };
    let flick = 0;
    const draw = () => {
      const len = Math.max(1, L * p.t);
      [outer, mid, core].forEach((b) => (b.scale.x = len / 256));
      if (bolt) { if (++flick % 3 === 0) bolt.texture = FX.tex.bolts[flick % 9 / 3 | 0]; bolt.scale.set(0.45, len / 512); }
      head.x = len; head.rotation += 0.3;
    };
    const live = () => { draw(); outer.alpha = 0.38 + 0.12 * Math.random(); };
    gsap.ticker.add(live); g.on("destroyed", () => gsap.ticker.remove(live));
    SFX.laser();
    await FX.tween(p, { t: 1, duration: 0.15, ease: "none", onUpdate: draw });
    const lab = new PIXI.Text("x" + acc, FX.gold(64)); lab.anchor.set(0.5); lab.position.set(from.x, from.y); lab.scale.set(1.5); fxTop.addChild(lab);
    gsap.to(accum, { alpha: 0, duration: 0.2, onComplete: () => { accum.visible = false; accum.alpha = 1; } });
    gsap.to(cntBox, { alpha: 0, duration: 0.2, onComplete: () => { cntBox.visible = false; cntBox.alpha = 1; } });
    gsap.to(lab.scale, { x: 0.8, y: 0.8, duration: 0.2, ease: "back.in(2)" });
    await FX.tween(lab, { x: to.x, y: to.y, duration: 0.2, ease: "power2.in" });
    gsap.to(g, { alpha: 0, duration: 0.25, onComplete: () => g.destroy({ children: true }) });
    boom(to.x, to.y, 1.0, 0xffe0b0);
    impactAt(to, acc);
    gsap.to(lab, { alpha: 0, duration: 0.15, onComplete: () => lab.destroy() });
  }
  // SUPER WILD counter badge (2/2 -> 1/2 -> 0/2), shown while its nudges play
  function superCounter(c) {
    const reel = Math.floor(c / 3), row = c % 3, x = REEL_CX[reel], y = rowY(row);
    const b = new PIXI.Container(); b.position.set(x + 92, y + 64);
    b.addChild(new PIXI.Graphics().beginFill(0x000000, 0.4).drawCircle(0, 3, 35).endFill()
      .beginFill(0x8a0e1e).lineStyle(4, 0xffd36b).drawCircle(0, 0, 31).endFill());
    const t = new PIXI.Text(`${Engine.NUDGES}/${Engine.NUDGES}`, FX.plain(22, "#ffffff")); t.anchor.set(0.5); b.addChild(t);
    plaqueL.addChild(b); winObjs.push(b);
    b.scale.set(0); gsap.to(b.scale, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.5)" });
    let left = Engine.NUDGES;
    return { x, y, dec() {
      left = Math.max(0, left - 1); t.text = `${left}/${Engine.NUDGES}`;
      gsap.fromTo(b.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.2 }); flashAt(x, y, 0xff8800, 1.4, 0.25);
    } };
  }
  // Garuda nudge step: counter flip -> 0.12 s -> nudge (0.18 s) -> streak up -> badge pop; steps ~1.75 s apart
  async function nudgePhase(r) {
    const chipPos = { x: COL_CX, y: COL_CY };
    const chipStart = r.startMult < 0;
    if (featureOn) feature(true); else if (!chipStart) await bullCharge();
    let acc = chipStart ? 0 : r.startMult, maxSteps = r.superSteps + r.chipSteps;
    const pad = (n) => String(n).padStart(2, "0");
    const cnt = (k, popIt) => {
      cntTxt.text = String(Math.max(0, Math.min(maxSteps, r.nudges.length) - k));      // nudges LEFT
      if (popIt) gsap.fromTo(cntBox.scale, { x: 1.2, y: 1.2 }, { x: 1, y: 1, duration: 0.1 });
    };
    const badgeIn = () => {
      if (accum.visible) return;
      accum.visible = true; accum.scale.set(0);
      gsap.to(accum.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(2)" }); ringAt(accum.x, accum.y, 0xff55ff, 2.2, 0.3);
    };
    cntBox.visible = true; cntBox.scale.set(0); cnt(0); centreMark.visible = true; centreMark.alpha = 0;
    gsap.to(centreMark, { alpha: 1, duration: 0.25 });
    lineGfx.forEach((g) => gsap.to(g, { alpha: 0.12, duration: 0.2 }));      // paylines step back while the column works
    r.bullActed = true;                                                       // the feature start (roar or throw) is his action
    await FX.tween(cntBox.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(1.7)" });
    const sw = r.superCells.map((c) => superCounter(c));
    if (chipStart) { await bullOrb({ x: COL_CX, y: COL_CY }, 0x5ff0ff, null, 1.25); feature(true); await nudgeChipFire(r.chipSteps); }
    else {
      pulseChip(false);
      await streakToBadge(r.startMult);
      badgeIn(); accTxt.text = "x" + acc; SFX.impact(false);
    }
    for (let k = 0; k < r.nudges.length; k++) {
      const STEP = (S.turbo ? 0.5 : k === 0 ? 1.0 : 0.68) + (r.nudges[k] < 0 ? 0.35 : 0);
      const t0 = gsap.globalTimeline.time();
      if (k < r.superSteps && sw.length) {
        const s = sw[Math.floor(k / Engine.NUDGES) % sw.length];
        s.dec(); ringAt(s.x, s.y, 0xff7a3a, 1.2, 0.4);
        beam(s, chipPos, 0xff8a3a); await FX.wait(S.turbo ? 0.1 : 0.18);      // the nudge starts while the beam flies
      }
      await FX.wait(0.06);
      // escalation: every nudge hits harder and higher than the one before; the last one lands in slow motion
      const esc = r.nudges.length > 1 ? k / (r.nudges.length - 1) : 1, lastN = k === r.nudges.length - 1 && r.nudges.length > 1 && !S.turbo;
      if (lastN) { SFX.tease(0.5); gsap.to(vignette, { alpha: 0.5, duration: 0.25, onStart: () => (vignette.visible = true) }); await FX.wait(0.3); }
      SFX.nudge(esc); shake(4 + 6 * esc, 0.12 + 0.08 * esc);
      if (fireFrame.visible) gsap.to(fireFrame, { alpha: 0.62 + 0.38 * esc, duration: 0.2 });
      await colReel.nudge(lastN ? 0.42 : 0.18);
      if (lastN) gsap.to(vignette, { alpha: 0, duration: 0.3, onComplete: () => (vignette.visible = false) });
      cnt(k + 1, true);                                                       // the count changes when the nudge lands
      const v = r.nudges[k];
      if (v < 0) {
        maxSteps += -v; cnt(k + 1, false);
        await nudgeChipFire(-v);
      } else {
        pulseChip(v >= 50);
        await FX.wait(0.08);
        await streakToBadge(v);
        badgeIn(); acc += v; accTxt.text = "x" + acc;
        const pk = 1.25 + 0.5 * esc;
        gsap.fromTo(accum.scale, { x: pk, y: pk }, { x: 1, y: 1, duration: 0.2 + 0.15 * esc, ease: "back.out(2)" });
        ringAt(accum.x, accum.y, 0xff55ff, 1.4 + esc, 0.3); SFX.impact(lastN || v >= 50); SFX.rise(esc);
        if (lastN || v >= 50) flashScreen(multTint(v), 0.14, 0.3);
      }
      const el = gsap.globalTimeline.time() - t0;
      if (el < STEP) await FX.wait(STEP - el);
    }
    lineGfx.forEach((g) => gsap.to(g, { alpha: 1, duration: 0.2 }));
    return acc;
  }
  // Garuda "power-up clash": the bull's lightning pulls the next-higher medallion out; it swaps with the real one, then loses
  function clashWanted(r) {
    const up = Engine.STRIP[stripAt(r.multIndex, 1)];
    return r.startMult >= 5 && up > r.startMult && (S.forceKind === "clash" || (r.totalX >= 5 && Math.random() < 0.3));
  }
  async function clash(r) {
    feature(true);
    const upV = Engine.STRIP[stripAt(r.multIndex, 1)], cur = r.startMult;
    const chest = CHEST;
    bullReact("big");
    gsap.fromTo(featRays, { alpha: 1 }, { alpha: 0.55, duration: 0.8 });
    flashAt(chest.x, chest.y, 0xfff0c0, 3, 0.4); SFX.rumble(1.2);
    await FX.wait(S.turbo ? 0.25 : 0.4);
    const zap = new PIXI.Graphics(); zap.blendMode = PIXI.BLEND_MODES.ADD; fxTop.addChild(zap);
    const zt = gsap.to({}, { duration: 0.6, onUpdate: () => {
      zap.clear();
      for (let b = 0; b < 2; b++) {
        const tgt = b ? { x: COL_CX, y: COL_CY } : { x: COL_CX, y: COL_CY - COL_P };
        zap.lineStyle(4 + Math.random() * 4, 0xfff2c0, 0.9).moveTo(chest.x, chest.y);
        for (let s = 1; s <= 8; s++) {
          const f = s / 8, wob = (1 - Math.abs(f - 0.5) * 2) * 60;
          zap.lineTo(chest.x + (tgt.x - chest.x) * f + (Math.random() - 0.5) * wob, chest.y + (tgt.y - chest.y) * f + (Math.random() - 0.5) * wob);
        }
      }
      if (Math.random() < 0.4) burstAt(COL_CX, COL_CY - (Math.random() < 0.5 ? COL_P : 0), 0xffd060, 8);
    } });
    SFX.impact(false);
    await FX.wait(0.6); zt.kill(); zap.destroy();
    const mk = (v) => {
      const c = new PIXI.Container();
      for (const t of [chipBgTex(v), T("Multipliers/chip_rim"), chipLabelTex(v)]) { const s = new PIXI.Sprite(t); s.anchor.set(0.5); c.addChild(s); }
      fxTop.addChild(c); return c;
    };
    const vA = colReel.views[2], vB = colReel.views[3];
    const A = mk(upV), B = mk(cur);
    A.position.set(COL_CX, COL_CY - COL_P); B.position.set(COL_CX, COL_CY);
    vA.visible = false; vB.visible = false;
    const cx = COL_CX - 40, cy = COL_CY - COL_P / 2;
    await Promise.all([FX.tween(A, { x: cx, y: cy, duration: 0.2 }), FX.tween(B, { x: cx, y: cy, duration: 0.2 })]);
    const t = { v: 0 }, D = S.turbo ? 1.0 : 1.5;
    await FX.tween(t, { v: 1, duration: D, ease: "none", onUpdate: () => {
      const ph = t.v * D * 25;
      A.x = cx + Math.sin(ph) * 70; B.x = cx - Math.sin(ph) * 70;
      const sa = 1.25 + Math.cos(ph) * 0.1, sb = 1.25 - Math.cos(ph) * 0.1;
      A.scale.set(sa); B.scale.set(sb);
      fxTop.setChildIndex(sa > sb ? A : B, fxTop.children.length - 1);
      if (Math.random() < 0.6) topP.emit({ tex: FX.tex.spark, x: cx, y: cy, vx: (Math.random() - 0.5) * 500, vy: (Math.random() - 0.5) * 500, drag: 3, s0: 0.4, s1: 0, life: 0.4, tint: Math.random() < 0.5 ? 0xffd060 : 0x9fc8ff });
      if (Math.random() < 0.1) SFX.tick();
    } });
    await Promise.all([
      FX.tween(A, { x: COL_CX, y: COL_CY - COL_P, duration: 0.25, ease: "power2.out" }), FX.tween(A.scale, { x: 1, y: 1, duration: 0.25 }),
      FX.tween(B, { x: COL_CX, y: COL_CY, duration: 0.25, ease: "power2.out" }), FX.tween(B.scale, { x: 1, y: 1, duration: 0.25 })]);
    vA.visible = true; vB.visible = true; A.destroy({ children: true }); B.destroy({ children: true });
    ringAt(COL_CX, COL_CY, 0xfff0b0, 2, 0.25); SFX.impact(false); shake(5, 0.15);
    await FX.wait(0.2);
  }

  // ---------- the bull acts on the board (Garuda-style), timed to the bull_big clip (fist up 0.8-3.5 s) ----------
  const FIST = { x: 283, y: 175 }, MOUTH = { x: 535, y: 225 }, CHEST = { x: 474, y: 326 };
  function hopCells(P, amt, radius) {
    const A = amt || 10, Rr = radius || 520;
    reels.forEach((rl, reel) => [0, 1, 2].forEach((row) => {
      const v = rl.view(row), dd = Math.hypot(REEL_CX[reel] - P.x, rowY(row) - P.y);
      if (dd > Rr) return;
      gsap.fromTo(v.c.pivot, { y: A * (1 - dd / Rr) }, { y: 0, duration: 0.25, ease: "power2.out", delay: dd / 2600 });
    }));
    colReel.views.forEach((v, i) => {
      if (Math.hypot(COL_CX - P.x, COL_Y0 + i * COL_P - P.y) > Rr) return;
      [v.b.pivot, v.f.pivot].forEach((pv) => gsap.fromTo(pv, { y: A * 0.5 }, { y: 0, duration: 0.22, ease: "power2.out", delay: 0.04 + i * 0.02 }));
    });
  }
  // a golden energy shard from the bull into a board cell
  async function bolt(from, to, tint) {
    const c = new PIXI.Container(); c.position.set(from.x, from.y); fxTop.addChild(c);
    const tail = new PIXI.Sprite(FX.tex.shine); tail.anchor.set(1, 0.5); tail.scale.set(0.9, 0.9); tail.tint = tint || 0xffd060; tail.blendMode = PIXI.BLEND_MODES.ADD;
    const head = new PIXI.Sprite(FX.tex.glow); head.anchor.set(0.5); head.scale.set(0.45); head.tint = 0xfff0c0; head.blendMode = PIXI.BLEND_MODES.ADD;
    c.addChild(tail, head);
    c.rotation = Math.atan2(to.y - from.y, to.x - from.x);
    await FX.tween(c, { x: to.x, y: to.y, duration: 0.24, ease: "power2.in" });
    c.destroy({ children: true });
    flashAt(to.x, to.y, 0xffe08a, 1.3, 0.25); burstAt(to.x, to.y, tint || 0xffd060, 10, boardP); boom(to.x, to.y, 0.7);
    ringAt(to.x, to.y, 0xffd060, 1.0, 0.3, boardP);
  }
  // feature start: the bull roars and blasts energy into the reels, then the board catches fire
  async function bullCharge() {
    if (clips.bull_punch) {                              // production: the punch starts the feature
      await bullSlam(true);
      gsap.fromTo(featRays, { alpha: 1 }, { alpha: 0.55, duration: 1.4 });
      VFX.rgbFlash(6, 0.3); flameKick(1.2);
      feature(true);
      await FX.wait(0.15);
      return;
    }
    bullReact("big");
    await FX.wait(S.turbo ? 0.3 : 0.7);
    gsap.fromTo(featRays, { alpha: 1 }, { alpha: 0.55, duration: 1.4 });
    flashAt(MOUTH.x, MOUTH.y, 0xfff0c0, 1.5, 0.16); ringAt(MOUTH.x, MOUTH.y, 0xffd060, 2.8, 0.45);
    VFX.shockwave(MOUTH.x, MOUTH.y, { amp: 24, radius: 1500, dur: 0.95 }); VFX.rgbFlash(6, 0.3); flameKick(1.2);
    SFX.rumble(1.4); shake(9, 1.1);
    const N = S.turbo ? 6 : 12, gap = S.turbo ? 0.05 : 0.09;
    const shots = [];
    for (let k = 0; k < N; k++) {
      const reel = k % 3, row = Math.floor(Math.random() * 3);
      const to = { x: REEL_CX[reel] + (Math.random() - 0.5) * 120, y: rowY(row) + (Math.random() - 0.5) * 100 };
      const from = k % 2 ? MOUTH : FIST;
      shots.push(FX.wait(k * gap).then(() => bolt(from, to)).then(() => { if (k % 3 === 0) SFX.impact(false); }));
    }
    await Promise.all(shots);
    hopCells({ x: 432, y: 935 }, 16);
    feature(true);
  }
  // the bull smashes his flaming fist onto the frame (Kling punch clip). On contact the board jolts, the symbols hop
  // outward from the hit, sparks and fire fly off the top bar.
  async function bullSlam(short) {
    const mv = bullLive() ? bullPlay("bull_punch") : null;
    if (!mv) return bullSlamCode();
    if (mv.fresh) {
      gsap.fromTo(bullAura, { alpha: 0.35 }, { alpha: 0, duration: 1.2, ease: "power2.in" });
      mv.at("swing").then(() => { if (!mv.hurry) SFX.fly(); gsap.to(flame, { boost: 0.5, duration: 0.15 }); });
      mv.at("hit").then(() => { gsap.to(flame, { boost: 0, duration: 0.4 }); if (!mv.ended) slamFx(bullPt(mv.c, mv.c.cfg.hit || [145, 708])); });
    }
    await mv.at("hit");
    await FX.wait(short ? 0.08 : S.turbo ? 0.2 : 0.35);
  }
  function slamFx(P) {
    const y0 = 596;                                           // the frame's top bar
    shake(10, 0.25); SFX.slam(); SFX.impact(true); hitStop(70); buzz(40);
    VFX.shockwave(P.x, y0, { amp: 30, radius: 900, dur: 0.25 }); VFX.zoomPunch(P.x, y0 + 300, 0.16, 0.12);
    flashAt(P.x, y0, 0xfff2cd, 1.4, 0.06); flashAt(P.x, y0 - 20, 0xffaa32, 2.6, 0.22);
    ringAt(P.x, y0, 0xffaa32, 2.6, 0.3);
    boom(P.x, y0, 1.6); smokeAt(P.x, y0 - 6, 3, 0.6);
    for (let k = 0; k < 28; k++) {                           // a shallow, directional fan along the bar
      const side = Math.random() < 0.5 ? -1 : 1, a = Math.PI / 2 + side * (Math.PI * (0.32 + 0.16 * Math.random())) - Math.PI, sp = 380 + Math.random() * 700;
      topP.emit({ tex: Math.random() < 0.5 ? FX.tex.spark : FX.tex.dot, x: P.x + (Math.random() - 0.5) * 70, y: y0,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 1600, s0: 0.25 + Math.random() * 0.3, s1: 0, life: 0.6 + Math.random() * 0.4,
        tint: Math.random() < 0.7 ? 0xffd060 : 0xffffff });
    }
    for (let k = 0; k < 6; k++) {                            // six embers from the flaming fist
      topP.emit({ tex: FX.tex.flame, x: P.x + (Math.random() - 0.5) * 120, y: y0 - 10, vx: (Math.random() - 0.5) * 520, vy: -120 - Math.random() * 380,
        ay: -60, s0: 0.5 + Math.random() * 0.5, s1: 0.1, life: 0.45 + Math.random() * 0.3, tint: Math.random() < 0.3 ? 0xd9a0ff : 0xff9a3a,
        a0: 0.9, a1: 0, blend: PIXI.BLEND_MODES.ADD });
    }
    const crack = new PIXI.Graphics(); crack.blendMode = PIXI.BLEND_MODES.ADD; fxTop.addChild(crack);
    for (const dir of [-1, 1]) {
      let x = P.x, y = y0 + 2;
      crack.lineStyle(4, 0xfff2c0, 1).moveTo(x, y);
      for (let s2 = 0; s2 < 10; s2++) { x += dir * (30 + Math.random() * 30); y = y0 - 4 + Math.random() * 16; crack.lineTo(x, y); }
    }
    gsap.to(crack, { alpha: 0, duration: 0.3, onComplete: () => crack.destroy() });
    boardL.y = 0;                                             // rigid frame: down 7 px, rebound 2 px, settle
    gsap.timeline().to(boardL, { y: 7, duration: 0.04, ease: "power2.in" }).to(boardL, { y: -2, duration: 0.08, ease: "power2.out" })
      .to(boardL, { y: 0, duration: 0.16, ease: "power2.out" });
    hopCells({ x: P.x, y: y0 }, 8, 380);
  }
  // no punch clip: the code lunge
  async function bullSlamCode() {
    bullReact("big");
    const by = bl.y + bl.h;
    gsap.killTweensOf(bull); gsap.killTweensOf(bull.scale);
    gsap.to(bull.scale, { x: 0.98, y: 0.98, duration: S.turbo ? 0.1 : 0.2, ease: "power2.out" });
    await FX.tween(bull, { y: by - 10, duration: S.turbo ? 0.1 : 0.2, ease: "power2.out" });
    gsap.to(bull.scale, { x: 1.07, y: 1.07, duration: 0.1, ease: "power3.in" });          // lunge toward the screen
    await FX.tween(bull, { y: by + 8, duration: 0.1, ease: "power3.in" });
    const P = { x: 470, y: 600 };
    shake(16, 0.45); SFX.slam();
    VFX.shockwave(P.x, P.y, { amp: 36, radius: 1500, dur: 0.9 }); VFX.zoomPunch(P.x, P.y + 300, 0.16, 0.35); VFX.rgbFlash(10, 0.3);
    ringAt(P.x, P.y, 0xfff0c0, 4, 0.5); flashAt(P.x, P.y, 0xffffff, 3, 0.3);
    for (let k = 0; k < 44; k++) topP.emit({ tex: Math.random() < 0.5 ? FX.tex.spark : FX.tex.dot, x: P.x + (Math.random() - 0.5) * 760, y: 596,
      vx: (Math.random() - 0.5) * 700, vy: -200 - Math.random() * 760, ay: 1500, s0: 0.25 + Math.random() * 0.3, s1: 0, life: 0.8, tint: 0xffd060 });
    const crack = new PIXI.Graphics(); crack.blendMode = PIXI.BLEND_MODES.ADD; fxTop.addChild(crack);
    for (const dir of [-1, 1]) {
      let x = P.x, y = 598;
      crack.lineStyle(4, 0xfff2c0, 1).moveTo(x, y);
      for (let s2 = 0; s2 < 10; s2++) { x += dir * (30 + Math.random() * 30); y = 592 + Math.random() * 16; crack.lineTo(x, y); }
    }
    gsap.to(crack, { alpha: 0, duration: 0.4, onComplete: () => crack.destroy() });
    boardL.y = 0;
    gsap.timeline().to(boardL, { y: 18, duration: 0.05 }).to(boardL, { y: 0, duration: 0.6, ease: "elastic.out(1,0.35)" });
    hopCells(P);
    gsap.to(bull, { y: by, duration: 0.5, ease: "power2.out", delay: 0.1 });
    gsap.to(bull.scale, { x: 1, y: 1, duration: 0.5, delay: 0.1 });
    await FX.wait(0.35);
  }
  // the bull charges the fire in his hand (it takes the orb's colour), winds up and hurls it as a comet (Kling throw clip)
  const RIM_VIOLET = [0.6, 0.28, 1.0];
  const rgbOf = (t) => [((t >> 16) & 255) / 255, ((t >> 8) & 255) / 255, (t & 255) / 255];
  async function bullOrb(to, tint, label, k) {
    const mv = bullLive() ? bullPlay("bull_throw", k) : null;
    if (!mv) return bullOrbCode(to, tint, label);
    await mv.startedP;
    const tRel = (mv.c.cfg.events || {}).release || 1.94;
    const cd = Math.max(0.3, bullSpan("bull_throw", Math.min(mv.t, tRel), tRel) / (mv.k || 1));
    if (flame.c) flame.c.setRim(rgbOf(tint));
    SFX.orbCharge(cd); gsap.to(flame, { boost: 0.3, duration: cd });
    // a charge glow rides the hand, sparks are pulled into it
    const cg = new PIXI.Container(); fxTop.addChild(cg);
    const g = new PIXI.Sprite(FX.tex.glow); g.anchor.set(0.5); g.tint = tint; g.blendMode = PIXI.BLEND_MODES.ADD; g.scale.set(0.1);
    const ring = new PIXI.Sprite(FX.tex.ring); ring.anchor.set(0.5); ring.tint = tint; ring.blendMode = PIXI.BLEND_MODES.ADD; ring.scale.set(0.1);
    cg.addChild(g, ring);
    gsap.to(g.scale, { x: 1.0, y: 1.0, duration: cd, ease: "power1.in" });
    gsap.to(ring.scale, { x: 0.6, y: 0.6, duration: cd });
    const follow = () => {
      if (flame.gx == null) return;
      cg.position.set(flame.gx, flame.gy - 70); ring.rotation += 0.18; cg.visible = flame.on > 0.05;
      for (let e = nEmit(25); e > 0; e--) {
        const a = Math.random() * Math.PI * 2, r0 = 120;
        topP.emit({ tex: FX.tex.dot, x: cg.x + Math.cos(a) * r0, y: cg.y + Math.sin(a) * r0, vx: -Math.cos(a) * r0 * 3.2, vy: -Math.sin(a) * r0 * 3.2, s0: 0.3, s1: 0, life: 0.3, tint });
      }
    };
    gsap.ticker.add(follow);
    mv.at("windup").then(() => { if (!mv.hurry) SFX.fly(); });
    await mv.at("release");
    gsap.ticker.remove(follow); cg.destroy({ children: true });
    gsap.killTweensOf(flame); flame.boost = 0;
    if (flame.c) flame.c.setRim(RIM_VIOLET);
    SFX.orbThrow();
    const c = mv.c, from = bullPt(c, c.cfg.release || [560, 230]), d = c.cfg.dir || [90, 60], dl = Math.hypot(d[0], d[1]);
    const ctrl = { x: Math.min(W - 40, from.x + d[0] / dl * 420), y: from.y + d[1] / dl * 420 };
    flashAt(from.x, from.y, 0xffffff, 1.8, 0.2); starFlash(from.x, from.y, 1.3, tint);
    await comet(from, ctrl, to, tint, label, S.turbo ? 0.3 : 0.42);
    orbImpact(to, tint);
  }
  // a fireball with a trailing magic flame, flown along a curve
  function comet(from, ctrl, to, tint, label, dur) {
    const o = new PIXI.Container(); o.position.set(from.x, from.y); fxTop.addChild(o);
    const tail = VFX.magicFlame(o, 150, 300, rgbOf(tint)); tail.power = 1.5;
    const g = new PIXI.Sprite(FX.tex.glow); g.anchor.set(0.5); g.tint = tint; g.blendMode = PIXI.BLEND_MODES.ADD; g.scale.set(1.5);
    const core = new PIXI.Sprite(FX.tex.glow); core.anchor.set(0.5); core.tint = 0xffffff; core.blendMode = PIXI.BLEND_MODES.ADD; core.scale.set(0.45);
    const ring = new PIXI.Sprite(FX.tex.ring); ring.anchor.set(0.5); ring.tint = tint; ring.blendMode = PIXI.BLEND_MODES.ADD; ring.scale.set(0.6);
    o.addChild(g, ring, core);
    if (label) { const l = new PIXI.Sprite(chipLabelTex(label)); l.anchor.set(0.5); l.scale.set(0.6); o.addChild(l); }
    const p = { t: 0 }; let px = from.x, py = from.y;
    return FX.tween(p, { t: 1, duration: dur, ease: "power1.in", onUpdate: () => {
      const q = FX.bezier(from, ctrl, to, p.t), vx = q.x - px, vy = q.y - py; px = q.x; py = q.y;
      o.position.set(q.x, q.y); ring.rotation += 0.3;
      if (vx || vy) tail.rotation = Math.atan2(-vx, vy);           // the flame streams behind the ball
      const n = nEmit(70);
      for (let k = 0; k < n; k++) topP.emit({ tex: k ? FX.tex.dot : FX.tex.spark, x: q.x + (Math.random() - 0.5) * 30, y: q.y + (Math.random() - 0.5) * 30, s0: 0.5, s1: 0, life: 0.4, tint });
    } }).then(() => o.destroy({ children: true }));
  }
  function orbImpact(to, tint) {
    boom(to.x, to.y, 1.3, tint);
    VFX.shockwave(to.x, to.y, { amp: 26, radius: 800 });
    ringAt(to.x, to.y, tint, 2.0, 0.35); flashAt(to.x, to.y, 0xfff4dc, 1.1, 0.08); burstAt(to.x, to.y, tint, 12);
    shake(7, 0.2); SFX.impact(true);
    hopCells(to, 8);
  }
  // no throw clip: an orb in the roar clip's raised fist
  async function bullOrbCode(to, tint, label) {
    if (!bullDir.cur) { bullReact("big"); await FX.wait(S.turbo ? 0.35 : 0.8); }
    const o = new PIXI.Container(); o.position.set(FIST.x, FIST.y - 34); fxTop.addChild(o);
    const g = new PIXI.Sprite(FX.tex.glow); g.anchor.set(0.5); g.tint = tint; g.blendMode = PIXI.BLEND_MODES.ADD; g.scale.set(0);
    const core = new PIXI.Sprite(FX.tex.glow); core.anchor.set(0.5); core.tint = 0xffffff; core.blendMode = PIXI.BLEND_MODES.ADD; core.scale.set(0);
    const ring = new PIXI.Sprite(FX.tex.ring); ring.anchor.set(0.5); ring.tint = tint; ring.blendMode = PIXI.BLEND_MODES.ADD; ring.scale.set(0);
    o.addChild(g, ring, core);
    if (label) { const l = new PIXI.Sprite(chipLabelTex(label)); l.anchor.set(0.5); l.scale.set(0.45); o.addChild(l); }
    const cd = S.turbo ? 0.35 : 0.75;
    SFX.orbCharge(cd); gsap.to(flame, { boost: 1.1, duration: cd });
    gsap.to(g.scale, { x: 1.3, y: 1.3, duration: cd, ease: "back.out(2)" });
    gsap.to(core.scale, { x: 0.5, y: 0.5, duration: cd });
    gsap.to(ring.scale, { x: 0.75, y: 0.75, duration: cd });
    const swirl = gsap.to(ring, { rotation: Math.PI * 4, duration: cd + 0.4, ease: "none" });
    const pull = gsap.to({}, { duration: cd, onUpdate: () => {
      const a = Math.random() * Math.PI * 2, r0 = 110;
      topP.emit({ tex: FX.tex.dot, x: o.x + Math.cos(a) * r0, y: o.y + Math.sin(a) * r0, vx: -Math.cos(a) * r0 * 3, vy: -Math.sin(a) * r0 * 3, s0: 0.3, s1: 0, life: 0.33, tint });
    } });
    await FX.wait(cd);
    pull.kill();
    SFX.orbThrow();
    const from = { x: o.x, y: o.y }, mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 120 }, p = { t: 0 };
    await FX.tween(p, { t: 1, duration: 0.35, ease: "power2.in", onUpdate: () => {
      const q = FX.bezier(from, mid, to, p.t); o.position.set(q.x, q.y);
      for (let k = 0; k < 3; k++) topP.emit({ tex: k ? FX.tex.dot : FX.tex.spark, x: q.x + (Math.random() - 0.5) * 30, y: q.y + (Math.random() - 0.5) * 30, s0: 0.5, s1: 0, life: 0.4, tint });
    } });
    swirl.kill(); o.destroy({ children: true });
    gsap.fromTo(flame, { boost: -0.7 }, { boost: 0, duration: 0.9, ease: "power2.out" });
    VFX.shockwave(to.x, to.y, { amp: 26, radius: 800 }); VFX.rgbFlash(6, 0.25); starFlash(to.x, to.y, 2.2, tint);
    ringAt(to.x, to.y, tint, 2.4, 0.4); flashAt(to.x, to.y, 0xffffff, 2.2, 0.3); burstAt(to.x, to.y, tint, 24);
    shake(9, 0.25); SFX.impact(true);
    hopCells(to, 10);
  }

  // ---------- juice helpers ----------
  function starFlash(x, y, sc, tint, parent) {
    const st = new PIXI.Sprite(FX.tex.star8); st.anchor.set(0.5); st.position.set(x, y); st.rotation = Math.random() * 0.8;
    st.tint = tint || 0xffffff; st.blendMode = PIXI.BLEND_MODES.ADD; st.scale.set(0.15);
    (parent || fxTop).addChild(st);
    gsap.to(st.scale, { x: sc, y: sc, duration: 0.42, ease: "power2.out" });
    gsap.to(st, { alpha: 0, rotation: st.rotation + 0.6, duration: 0.42, ease: "power1.in", onComplete: () => st.destroy() });
  }
  function lightBeam(x, y, tint) {
    const b = new PIXI.Sprite(FX.tex.ray); b.anchor.set(0.5, 0); b.position.set(x, y); b.scale.set(1.3, -0.95);
    b.tint = tint; b.blendMode = PIXI.BLEND_MODES.ADD; b.alpha = 0; fxTop.addChild(b);
    gsap.timeline({ onComplete: () => b.destroy() }).to(b, { alpha: 0.95, duration: 0.07 }).to(b, { alpha: 0, duration: 0.75, ease: "power2.in" });
    gsap.to(b.scale, { x: 0.35, duration: 0.82, ease: "power2.in" });
  }
  // a spinning 3D coin that arcs from a winning cell to a counter
  function coinTrail(from, to, delay, onArrive) {
    const c = new PIXI.AnimatedSprite(FX.tex.coinFrames); c.anchor.set(0.5); c.animationSpeed = 0.35 + Math.random() * 0.3;
    c.gotoAndPlay(Math.floor(Math.random() * 16)); c.scale.set(0.44); c.position.set(from.x, from.y); c.visible = false; fxTop.addChild(c);
    const mid = { x: (from.x + to.x) / 2 + (Math.random() - 0.5) * 300, y: Math.min(from.y, to.y) - 90 - Math.random() * 170 };
    const pr = { t: 0 };
    gsap.to(pr, { t: 1, duration: 0.55 + Math.random() * 0.2, delay, ease: "power1.in", onStart: () => (c.visible = true), onUpdate: () => {
      const q = FX.bezier(from, mid, to, pr.t); c.position.set(q.x, q.y); c.scale.set(0.44 - 0.2 * pr.t);
      if (Math.random() < 0.6) topP.emit({ tex: FX.tex.dot, x: q.x, y: q.y, s0: 0.32, s1: 0, life: 0.3, tint: 0xffd060 });
    }, onComplete: () => { c.destroy(); if (onArrive) onArrive(to); } });
  }
  let lastPlink = 0;
  function winBarPop(at) {
    gsap.fromTo(totVal.scale, { x: 1.16, y: 1.16 }, { x: 1, y: 1, duration: 0.18, ease: "power2.out" });
    starFlash(at.x + (Math.random() - 0.5) * 120, at.y, 0.7, 0xffe08a);
    const now = performance.now(); if (now - lastPlink > 70) { lastPlink = now; SFX.plink(); }
  }
  function balanceStreak() {
    const from = { x: 540, y: 1374 }, to = { x: balVal.x + balVal.width / 2, y: 1864 };
    for (let k = 0; k < 6; k++) coinTrail(from, to, 0.05 + k * 0.06, k === 5 ? (pt) => { flashAt(pt.x, pt.y, 0xffd060, 2.2, 0.3); burstAt(pt.x, pt.y, 0xffd060, 14); starFlash(pt.x, pt.y, 1.4, 0xffe08a); } : (pt) => winBarPop(pt));
  }
  // vignette for the tease heartbeat
  const vignette = new PIXI.Sprite(FX.tex.vignette); vignette.width = W; vignette.height = H; vignette.alpha = 0; vignette.visible = false;
  fxTop.addChildAt(vignette, 0);
  // magic flame in the bull's open hand (idle clip) that rides up into his raised fist (roar clip)
  const HAND_CLIP = { x: 78, y: 492 }, FIST_CLIP = { x: 120, y: 292 };
  { const h = clips.bull_idle && clips.bull_idle.cfg.hand; if (h) { HAND_CLIP.x = h[0]; HAND_CLIP.y = h[1]; } }   // V4: its own hand
  // a roar clip with its own hand track (V4) drives the flame from that; otherwise the open hand -> raised fist blend
  const bigTrack = () => { const b = clips.bull_big; return b && b.sprite.visible && b.cfg.track ? trackAt(b.cfg.track, b.video.currentTime) : null; };
  const flame = { c: null, boost: 0 };
  flame.c = VFX.magicFlame(bull, 200, 330);
  // the fingers sit IN FRONT of the fire: the same clip frame, masked to a soft ellipse over the hand, on top of the flame
  const HAND_MASK = { dx: -5, dy: 41, rx: 80, ry: 76 };                // clip px, relative to the flame base point
  const handTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.72, "rgba(255,255,255,1)");
    r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return PIXI.Texture.from(c); })();
  const handFront = new PIXI.Sprite(PIXI.Texture.EMPTY), handMask = new PIXI.Sprite(handTex);
  handMask.anchor.set(0.5); handFront.mask = handMask; handFront.visible = false;
  bull.addChild(handFront, handMask);
  let flameKickTw = null;
  function flameKick(k) { if (flameKickTw) flameKickTw.kill(); flameKickTw = gsap.fromTo(flame, { boost: k }, { boost: 0, duration: 0.9, ease: "power2.out" }); }
  function roarK() {                                       // 0 = open hand, 1 = fist up (from the bull_big clip time)
    const big = clips.bull_big;
    if (!big || !big.sprite.visible) return 0;
    const t = big.video.currentTime;
    let k = t < 0.15 ? 0 : t < 0.8 ? (t - 0.15) / 0.65 : t < 3.4 ? 1 : t < 4.6 ? 1 - (t - 3.4) / 1.2 : 0;
    return k * k * (3 - 2 * k);
  }
  // hand track: Catmull-Rom through the keys for x/y (curved, no corners at each key), linear for the fire power
  function trackAt(tr, t) {
    if (t <= tr[0][0]) return tr[0];
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      if (t <= b[0]) {
        const u = (t - a[0]) / Math.max(1e-6, b[0] - a[0]), p0 = tr[Math.max(0, i - 2)], p3 = tr[Math.min(tr.length - 1, i + 1)];
        const cr = (j) => 0.5 * ((2 * a[j]) + (-p0[j] + b[j]) * u + (2 * p0[j] - 5 * a[j] + 4 * b[j] - p3[j]) * u * u + (-p0[j] + 3 * a[j] - 3 * b[j] + p3[j]) * u * u * u);
        return [t, cr(1), cr(2), a[3] + (b[3] - a[3]) * u];
      }
    }
    return tr[tr.length - 1];
  }
  // the flame hand in clip px and its fire (p: 0 = out, 1 = normal, 2 = charged): from the playing move's track,
  // else the roar clip's open hand -> raised fist
  function handNow() {
    const mv = bullDir.cur;
    if (mv && mv.started && !mv.ended && mv.c.cfg.track) { const q = trackAt(mv.c.cfg.track, mv.c.video.currentTime); return { x: q[1], y: q[2], p: q[3], k: 0 }; }
    const bq = bigTrack();
    if (bq) return { x: bq[1], y: bq[2], p: bq[3], k: 0 };
    const k = roarK();
    return { x: HAND_CLIP.x + (FIST_CLIP.x - HAND_CLIP.x) * k, y: HAND_CLIP.y + (FIST_CLIP.y - HAND_CLIP.y) * k, p: 1, k };
  }
  function placeFlame(fc, hero, inPopup) {
    const h = hero ? null : handNow();
    const hq = hero && clips.bull_big && clips.bull_big.cfg.track ? trackAt(clips.bull_big.cfg.track, clips.bull_big.video.currentTime) : null;
    const k = hq ? Math.min(1, Math.max(0, hq[3] - 1)) : hero ? roarK() : Math.max(h.k, Math.min(1, Math.max(0, h.p - 1)));
    const cx = hq ? hq[1] : hero ? HAND_CLIP.x + (FIST_CLIP.x - HAND_CLIP.x) * k : h.x, cy = hq ? hq[2] : hero ? HAND_CLIP.y + (FIST_CLIP.y - HAND_CLIP.y) * k : h.y;
    let gx, gy;
    if (hero) {
      gx = hero.x - hero.width / 2 + cx * hero.width / 720; gy = hero.y - hero.height / 2 + cy * hero.height / 1280;
      fc.position.set(gx, gy); fc.scale.set((hero.scale.x / (hero.baseS || 1)) * 1.1);
      fc.power = 1.35;
    } else {
      const cfg = (clips.bull_idle || clips.bull_big || { cfg: { x: 162, y: -116.9, w: 725 } }).cfg, sc = cfg.w / 720;
      gx = cfg.x + cx * sc; gy = cfg.y + cy * sc;
      const on = Math.min(1, Math.max(0, h.p));
      fc.position.set(gx - (bl.x + bl.w / 2), gy - (bl.y + bl.h));
      fc.visible = on > 0.02;
      fc.scale.set((0.95 + 0.3 * k) * (0.5 + 0.5 * on));
      fc.power = on * Math.max(0.15, (1.1 + 0.35 * k) * (1 + flame.boost));
      gx = bull.x + fc.x * bull.scale.x; gy = bull.y + fc.y * bull.scale.y;
      if (fc.visible && flame.gx != null) {                // a fast fire hand leaves a trail
        const dx = gx - flame.gx, dy = gy - flame.gy, d = Math.hypot(dx, dy);
        for (let s2 = 0; s2 < Math.min(8, d / 9); s2++) {
          const u = Math.random();
          dust.emit({ tex: Math.random() < 0.3 ? FX.tex.spark : FX.tex.dot, x: flame.gx + dx * u + (Math.random() - 0.5) * 30,
            y: flame.gy + dy * u - 50 * fc.scale.y + (Math.random() - 0.5) * 30, vx: -dx * 2, vy: -dy * 2 - 60,
            s0: 0.3 + Math.random() * 0.25, s1: 0, life: 0.3 + Math.random() * 0.2, tint: Math.random() < 0.35 ? 0xd9a0ff : 0xffa040,
            a0: 1, a1: 0, blend: PIXI.BLEND_MODES.ADD });
        }
      }
      flame.gx = gx; flame.gy = gy; flame.on = on;
      // fingers over the flame: copy the visible bull clip sprite, mask it around the hand
      const src = bullDir.cur && bullDir.cur.started && !bullDir.cur.ended ? bullDir.cur.c.sprite
        : (clips.bull_big && clips.bull_big.sprite.visible ? clips.bull_big.sprite : clips.bull_idle && clips.bull_idle.sprite);
      handFront.visible = !!src && fc.visible && (!bullClipC || bullClipC.visible);   // not over the still bull
      if (handFront.visible) {
        if (handFront.texture !== src.texture) handFront.texture = src.texture;
        handFront.filters = src.filters; handFront.position.copyFrom(src.position); handFront.scale.copyFrom(src.scale);
        const sc = src.scale.x;
        handMask.position.set(src.x + (cx + HAND_MASK.dx) * sc, src.y + (cy + HAND_MASK.dy) * src.scale.y);
        handMask.scale.set((HAND_MASK.rx * 2 * sc) / 128 / 0.86, (HAND_MASK.ry * 2 * src.scale.y) / 128 / 0.86);
      }
      if (!fc.visible) return;
    }
    // embers and magic sparks rising from the flame
    const fdt = Math.min(0.05, app.ticker.deltaMS / 1000);
    if (Math.random() < 8 * fdt) dust.emit({ tex: FX.tex.dot, x: gx + (Math.random() - 0.5) * 50, y: gy - 40 - Math.random() * 60, vx: (Math.random() - 0.5) * 50,
      vy: -90 - Math.random() * 120, ax: (Math.random() - 0.5) * 120, s0: 0.14 + Math.random() * 0.12, s1: 0, life: 0.7 + Math.random() * 0.6,
      tint: Math.random() < 0.35 ? 0xd9a0ff : 0xffc060, a0: 1, a1: 0, blend: PIXI.BLEND_MODES.ADD });
    if (Math.random() < 1.5 * fdt) dust.emit({ tex: FX.tex.star8, x: gx + (Math.random() - 0.5) * 80, y: gy - 30 - Math.random() * 120, s0: 0.03, s1: 0.16,
      life: 0.45, a0: 1, a1: 0, tint: 0xffffff, vr: 3, blend: PIXI.BLEND_MODES.ADD });
  }

  async function present(r) {
    S.state = "present"; presentAt = performance.now();
    S.canSkip = !r.nudges.length && !TIER_ORDER.includes(Engine.tier(r.totalX)); S.respin = false;
    const cells = new Set();
    r.lines.forEach((l) => l.rows.forEach((row, reel) => cells.add(reel * 3 + row)));
    // dim the losing cells: black over their parchment (Garuda 0.65) + darker symbols
    reels.forEach((rl, reel) => [0, 1, 2].forEach((row) => {
      if (cells.has(reel * 3 + row)) return;
      const g = new PIXI.Graphics().beginFill(0x000000).drawRect(REEL_X[reel][0], rowY(row) - CELL_H / 2, REEL_X[reel][1] - REEL_X[reel][0], CELL_H).endFill();
      g.alpha = 0; gsap.to(g, { alpha: 0.65, duration: 0.1 }); cellFxBack.addChild(g); winObjs.push(g);
    }));
    const d = { k: 0 };
    gsap.to(d, { k: 1, duration: 0.1, onUpdate: () => {
      reels.forEach((rl, reel) => [0, 1, 2].forEach((row) => { if (!cells.has(reel * 3 + row)) rl.view(row).dim(d.k); }));
      colReel.views.forEach((v, i) => { if (i !== 3) v.dim(d.k * 0.8); });
    } });
    r.lines.forEach((l) => lineGfx.push(payline(l.rows)));
    cells.forEach((c) => cellHighlight(Math.floor(c / 3), c % 3));
    for (const c of cells) {
      const reel = Math.floor(c / 3), row = c % 3, id = curGrid[reel][row];
      if (id === "wild" || id === "super_wild") {
        if (clips[id + "_win"]) playCellClip(id, reel, row);
        else {
          const rb = new PIXI.Sprite(FX.tex.burst); rb.anchor.set(0.5); rb.position.set(REEL_CX[reel], rowY(row)); rb.scale.set(0.3);
          rb.blendMode = PIXI.BLEND_MODES.ADD; rb.alpha = 0.7; rb.tint = id === "wild" ? 0xd9a0ff : 0xff8a5a;
          gsap.to(rb, { rotation: Math.PI * 2, duration: 6, repeat: -1, ease: "none" });
          cellFxBack.addChild(rb); winObjs.push(rb);
        }
      }
    }
    // win ladder: the celebration follows the size. 0 = less than the stake (a net loss: quiet, no coins, no bull),
    // 1 = up to 5x, 2 = 5x and more (bigger wins go on to the popup)
    const rung = r.win < r.stake ? 0 : r.totalX >= 5 ? 2 : 1;
    SFX.win(r.lines.length, rung);
    if (rung) bullReact(rung === 2 ? "tease" : "win");
    if (rung === 2) { flameKick(1.0); flashScreen(0xffd070, 0.1, 0.35); }
    showLine(r.lines[0], r.lines[0].pay * BETS[S.betIdx]);
    if (rung) [...cells].forEach((c, ci) => {
      const from = { x: REEL_CX[Math.floor(c / 3)], y: rowY(c % 3) };
      for (let k = 0; k < (rung === 2 ? 6 : 3); k++) coinTrail(from, { x: 540, y: 1374 }, 0.12 + ci * 0.05 + k * 0.08, winBarPop);
      const v = reels[Math.floor(c / 3)].view(c % 3);               // winners beat together, in time
      gsap.fromTo(v.inner.scale, { x: 1, y: 1 }, { x: 1.07, y: 1.07, duration: 0.16, delay: 0.3, yoyo: true, repeat: rung === 2 ? 5 : 3, ease: "sine.inOut" });
    });
    // rail plaque pops 0.6 -> 1.05 -> 1 and counts the base win (it replaces the footer total while it shows)
    plaqueBg.alpha = 1; plaqueGlow.alpha = 0.5; plaqueTxt.visible = true; plaqueBig.visible = false;
    plaque.visible = true; wbTotal.visible = false;
    // a win below the stake (no feature) is a net loss: it goes straight to its total, with no multiplier flight
    const quiet = rung === 0 && !r.nudges.length, firstCount = quiet ? r.win : r.baseWin;
    plaqueShown.v = firstCount * 0.15; drawPlaque();
    plaque.alpha = 0; plaque.scale.set(0.6 * PLAQUE_S);
    gsap.to(plaque, { alpha: 1, duration: 0.1 });
    gsap.timeline().to(plaque.scale, { x: 1.05 * PLAQUE_S, y: 1.05 * PLAQUE_S, duration: 0.1, ease: "back.out(2)" })
      .to(plaque.scale, { x: PLAQUE_S, y: PLAQUE_S, duration: 0.1 });
    await FX.tween(plaqueShown, { v: firstCount, duration: S.turbo ? 0.2 : quiet ? 0.28 : 0.35, ease: "power1.out", onUpdate: () => { drawPlaque(); SFX.tick(); } });
    SFX.line();
    await FX.wait(rung === 0 ? 0.08 : S.turbo ? 0.1 : 0.25);
    // multiplier phase
    if (r.nudges.length) {
      const acc = await nudgePhase(r);
      await laserApply(Math.max(1, acc));
    } else if (r.mult > 1 && quiet) {
      pulseChip(false);
      const mt = new PIXI.Text("x" + r.mult, FX.gold(40, { fill: FX.TIER_FILL.mega })); mt.anchor.set(0.5); mt.position.set(plaque.x + 230, plaque.y);
      plaqueL.addChild(mt); winObjs.push(mt); multTag = mt;
      gsap.fromTo(mt.scale, { x: 1.4, y: 1.4 }, { x: 1, y: 1, duration: 0.2, ease: "back.out(1.6)" });
    } else if (r.mult > 1) {
      if (clashWanted(r)) await clash(r);
      // the bull throws fire at the column for every multiplier of 5x and more, except on a win below the stake
      // (a net loss stays quiet). Small totals get a quick throw, popup wins the full one.
      else if (r.mult >= 5 && rung > 0) { await bullOrb({ x: COL_CX, y: COL_CY }, multTint(r.mult) === 0xffd070 ? 0xffb040 : multTint(r.mult), r.mult >= 25 ? r.mult : null, r.totalX >= 10 ? 1.15 : 1.7); r.bullActed = true; }
      await multHit(r.mult, r.bullActed || rung === 0);
    } else {
      pulseChip(false);
    }
    // the plaque turns into big gold digits counting to the total (popup wins count once, in the popup)
    let bigTw = null;
    const tier = Engine.tier(r.totalX), popWin = TIER_ORDER.includes(tier);
    let slamP = null;
    if (r.totalX >= 5 && !r.bullActed) { slamP = bullSlam(); r.bullActed = true; }
    if (r.mult > 1 && popWin) {
      const mt = new PIXI.Text("x" + r.mult, FX.gold(46, { fill: FX.TIER_FILL.mega })); mt.anchor.set(0.5); mt.position.set(plaque.x + 250, plaque.y);
      plaqueL.addChild(mt); winObjs.push(mt); multTag = mt;
      gsap.fromTo(mt.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(1.6)" });
      await FX.wait(S.turbo ? 0.15 : 0.25);
    } else if (r.mult > 1 && !quiet) {
      gsap.to(plaqueBg, { alpha: 0, duration: 0.15 }); gsap.to(plaqueGlow, { alpha: 0.95, duration: 0.15 });
      plaqueTxt.visible = false; plaqueBig.visible = true; plaqueShown.v = r.baseWin; drawBig();
      gsap.to(wbLine, { alpha: 0, duration: 0.12 });                   // the line row steps aside for the big digits
      gsap.fromTo(plaqueBig, { alpha: 0 }, { alpha: 1, duration: 0.1 });
      const cuDur = S.turbo ? 0.3 : 0.5 + 0.35 * Math.min(1, Math.log10(Math.max(2, r.mult)) / 2); let cuT = -1;
      bigTw = FX.tween(plaqueShown, { v: r.win, duration: cuDur, ease: "power1.in", onUpdate: function () {
        drawBig(); const pr = this.progress(), now = gsap.globalTimeline.time();
        if (now - cuT > 0.07) { cuT = now; SFX.rise(pr); }
      } }).then(() => { SFX.line(); gsap.fromTo(plaqueBig.scale, { x: 1.12, y: 1.12 }, { x: 1, y: 1, duration: 0.25, ease: "back.out(2)" }); });
      const mt = new PIXI.Text("x" + r.mult, FX.gold(40, { fill: FX.TIER_FILL.mega })); mt.anchor.set(0.5); mt.position.set(plaque.x + 300, plaque.y);
      plaqueL.addChild(mt); winObjs.push(mt); multTag = mt;
      gsap.fromTo(mt.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(1.6)" });
    }
    if (bigTw) await bigTw;
    if (slamP) await slamP;
    if (popWin) {
      gsap.to(plaque, { alpha: 0, duration: 0.15 });                  // the board copy leaves; the popup owns the count
      await bigWin(r.win, r.totalX);
      plaque.visible = false; plaque.alpha = 1; plaqueBig.visible = false; wbLine.alpha = 1; totShown.v = r.win; showTotal(r.win);
    } else {
      await FX.wait(rung === 0 ? 0.3 : S.turbo ? 0.25 : 0.5);          // read the result, then the rail settles to TOTAL WIN
      gsap.to(plaque, { alpha: 0, duration: 0.2, onComplete: () => { plaque.visible = false; plaque.alpha = 1; plaqueBig.visible = false; totShown.v = r.win; showTotal(r.win); gsap.to(wbLine, { alpha: 1, duration: 0.15 }); } });
    }
    balanceStreak();
    setBalance(S.balance + r.win, true);
    S.lastWin = r.win;
    if (r.lines.length > 1) startLineCycle(r);
  }
  function startLineCycle(r) {
    let k = 0;
    // all lines for 0.3 s, then each line alone (its payline lit, the others dimmed) with the matching footer
    const step = () => {
      const i = k % r.lines.length, l = r.lines[i];
      showLine(l, l.pay * BETS[S.betIdx]);
      lineGfx.forEach((g, j) => gsap.to(g, { alpha: j === i ? 1 : 0.1, duration: 0.12 }));
      k++;
    };
    lineCycle = gsap.timeline({ repeat: -1, delay: 0.3 });
    lineCycle.call(step).to({}, { duration: 0.75 });
  }
  // Kling symbol clips: every winning wild shares ONE video texture (all play in sync, one decode);
  // the win one-shot runs once, then every cell switches to the idle loop.
  const cellClipSprites = [];
  function cellClipKick(id) {
    const w = clips[id + "_win"], i = clips[id + "_idle"];
    if (!w || clipBusy[id + "_win"]) return;
    clipBusy[id + "_win"] = true;
    w.video.currentTime = 0; { const p = w.video.play(); if (p && p.catch) p.catch(() => {}); }
    w.video.onended = () => {
      clipBusy[id + "_win"] = false;
      if (!i) return;
      cellClipSprites.forEach((sp) => { if (sp.clipId === id) sp.texture = i.sprite.texture; });
      i.video.currentTime = 0; { const p = i.video.play(); if (p && p.catch) p.catch(() => {}); }
    };
  }
  function playCellClip(id, reel, row) {
    const w = clips[id + "_win"]; if (!w) return;
    const v = reels[reel].view(row);
    const sp = new PIXI.Sprite(w.sprite.texture); sp.anchor.set(0.5); sp.width = w.cfg.w; sp.height = w.cfg.h;
    sp.filters = w.sprite.filters; sp.clipId = id;
    v.inner.addChild(sp); v.a.visible = false;
    cellClipSprites.push(sp);
    cellClipKick(id);
    winObjs.push({ destroy: () => {
      const k = cellClipSprites.indexOf(sp); if (k >= 0) cellClipSprites.splice(k, 1);
      sp.destroy(); v.a.visible = true;
      if (!cellClipSprites.some((o) => o.clipId === id || mobWild) && clips[id + "_idle"]) clips[id + "_idle"].video.pause();
    } });
  }

  // ---------- big win popup (Garuda: tier colours, bull inside, coins from behind the title, lens flare) ----------
  const TIER_LOOK = {
    big: { fill: ["#F4FFD0", "#AAFF00", "#00AA44"], stroke: "#0f3a14", glow: 0x168a3c, burst: 0x9dff7a, flare: 0xffd060 },
    mega: { fill: ["#FFFBE0", "#FFF59D", "#D48800"], stroke: "#1A237E", glow: 0x1c48b8, burst: 0x7aa8ff, flare: 0xff6d00 },
    super: { fill: ["#FFFFE0", "#FFFF00", "#FF2200"], stroke: "#5a0a00", glow: 0xb02a12, burst: 0xff8a5a, flare: 0xff6d00 },
    epic: { fill: ["#FCEBFF", "#E28CFF", "#7A1FD0"], stroke: "#2a0a4a", glow: 0x7a34c0, burst: 0xd8a0ff, flare: 0xff6dff },
    max: { fill: ["#FFFFFF", "#FFE070", "#FF8A00"], stroke: "#5a2a00", glow: 0xb88a2a, burst: 0xfff0a0, flare: 0xffffff },
  };
  const pop = new PIXI.Container(); pop.visible = false; popL.addChild(pop);
  const popDark = new PIXI.Graphics().beginFill(0x07020a, 0.75).drawRect(-200, -200, W + 400, H + 400).endFill();
  const popBurst = new PIXI.Sprite(FX.tex.burst); popBurst.anchor.set(0.5); popBurst.position.set(540, 820); popBurst.blendMode = PIXI.BLEND_MODES.ADD;
  const popBurst2 = new PIXI.Sprite(FX.tex.burst); popBurst2.anchor.set(0.5); popBurst2.position.set(540, 820); popBurst2.blendMode = PIXI.BLEND_MODES.ADD;
  const popGlow = new PIXI.Sprite(FX.tex.glow); popGlow.anchor.set(0.5); popGlow.position.set(540, 760); popGlow.scale.set(5); popGlow.blendMode = PIXI.BLEND_MODES.ADD;
  let popHero = null;
  if (clips.bull_big) {
    popHero = new PIXI.Sprite(clips.bull_big.sprite.texture);
    popHero.filters = clips.bull_big.sprite.filters; popHero.anchor.set(0.5, 0.5);
    popHero.width = clips.bull_big.cfg.w * 1.05; popHero.height = clips.bull_big.cfg.h * 1.05; popHero.position.set(540, 600);
    popHero.baseS = popHero.scale.x;
    // the bull art ends at the knees: fade the hero out below the amount (y 960 -> 1080)
    const top = popHero.y - popHero.height / 2, hh = popHero.height;
    const grad = document.createElement("canvas"); grad.width = 4; grad.height = 256;
    const gc = grad.getContext("2d"), lg = gc.createLinearGradient(0, 0, 0, 256);
    lg.addColorStop(0, "rgba(255,255,255,1)"); lg.addColorStop(Math.max(0, (960 - top) / hh), "rgba(255,255,255,1)");
    lg.addColorStop(Math.min(1, (1080 - top) / hh), "rgba(255,255,255,0)"); lg.addColorStop(1, "rgba(255,255,255,0)");
    gc.fillStyle = lg; gc.fillRect(0, 0, 4, 256);
    const heroMask = new PIXI.Sprite(PIXI.Texture.from(grad));
    heroMask.position.set(popHero.x - popHero.width / 2 - 40, top); heroMask.width = popHero.width + 80; heroMask.height = hh;
    popHero.heroMask = heroMask; popHero.mask = heroMask;
  }
  const popCoins = new FX.Particles(pop, PIXI.BLEND_MODES.NORMAL);
  const popFlare = new PIXI.Container(); popFlare.position.set(540, 822);
  const flare1 = new PIXI.Sprite(FX.tex.shine); flare1.anchor.set(0.5); flare1.scale.set(4.4, 2.0); flare1.blendMode = PIXI.BLEND_MODES.ADD;
  const flare2 = new PIXI.Sprite(FX.tex.glow); flare2.anchor.set(0.5); flare2.scale.set(0.8, 0.32); flare2.blendMode = PIXI.BLEND_MODES.ADD;
  popFlare.addChild(flare1, flare2);
  const popTitle = new PIXI.Text("BIG WIN", FX.gold(150, { strokeThickness: 18, dropShadowDistance: 8, dropShadowBlur: 8 }));
  popTitle.anchor.set(0.5); popTitle.position.set(540, 720);
  const popAmt = new PIXI.BitmapText("0", { fontName: "gold_digits", fontSize: 193 }); popAmt.anchor.set(0.5); popAmt.position.set(540, 930);
  const popHint = new PIXI.Text("TAP TO CONTINUE", FX.plain(44, "#ffe6b0")); popHint.anchor.set(0.5); popHint.position.set(540, 1300); popHint.alpha = 0;
  pop.addChild(popDark);
  const popRays = VFX.godrays(pop, { gain: 0.42, tint: 0xffc860 });
  // everything of the celebration sits in one body, set lower so the bull, title and amount centre on the screen
  const POP_DY = 215;
  const popBody = new PIXI.Container(); popBody.y = POP_DY; pop.addChild(popBody);
  popBody.addChild(popGlow, popBurst, popBurst2);
  if (popHero) popBody.addChild(popHero, popHero.heroMask);
  const popFlame = popHero ? VFX.magicFlame(popBody, 230, 380) : null;
  const popAmtGlow = new PIXI.Sprite(FX.tex.glow); popAmtGlow.anchor.set(0.5); popAmtGlow.position.set(540, 930); popAmtGlow.scale.set(5.2, 1.5);
  popAmtGlow.blendMode = PIXI.BLEND_MODES.ADD; popAmtGlow.alpha = 0.6;
  const popTitleMask = new PIXI.Text("BIG WIN", popTitle.style); popTitleMask.anchor.set(0.5); popTitleMask.position.copyFrom(popTitle.position);
  const popShine = new PIXI.Sprite(FX.tex.shine); popShine.anchor.set(0.5); popShine.scale.set(1.3, 12); popShine.rotation = 0.35;
  popShine.blendMode = PIXI.BLEND_MODES.ADD; popShine.alpha = 0.8; popShine.position.set(-300, 720); popShine.mask = popTitleMask;
  const POP_ART = (n) => PIXI.Assets.get(`assets/Popup/${n}.webp`);
  // amount plate, drawn in code: a gold-rimmed lacquer pill that stretches to the amount (9-slice); the lacquer takes
  // the tier's colour. No generated art: the same gold as the UI text, clean at every width.
  const plateTex = (lacquer) => {
    const c = document.createElement("canvas"); c.width = 420; c.height = 210; const g = c.getContext("2d");
    const pill = (i) => { const r = (210 - 2 * i) / 2; g.beginPath(); g.moveTo(i + r, i); g.lineTo(420 - i - r, i); g.arc(420 - i - r, 105, r, -Math.PI / 2, Math.PI / 2);
      g.lineTo(i + r, 210 - i); g.arc(i + r, 105, r, Math.PI / 2, Math.PI * 1.5); g.closePath(); };
    if (lacquer) {
      const lg = g.createLinearGradient(0, 18, 0, 192); lg.addColorStop(0, "#ffffff"); lg.addColorStop(0.45, "#8c8c8c"); lg.addColorStop(1, "#4a4a4a");
      pill(17); g.fillStyle = lg; g.fill();
      g.save(); pill(17); g.clip();                     // gloss on the upper half, inner shadow at the top edge
      const gl = g.createLinearGradient(0, 24, 0, 100); gl.addColorStop(0, "rgba(255,255,255,0.42)"); gl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = gl; g.beginPath(); g.ellipse(210, 30, 260, 62, 0, 0, Math.PI * 2); g.fill();
      const sh = g.createLinearGradient(0, 17, 0, 44); sh.addColorStop(0, "rgba(0,0,0,0.5)"); sh.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = sh; g.fillRect(0, 17, 420, 30); g.restore();
    } else {
      pill(0); g.fillStyle = "#2a0c04"; g.fill();
      const gg = g.createLinearGradient(0, 4, 0, 206); gg.addColorStop(0, "#fff2c4"); gg.addColorStop(0.42, "#fbc460"); gg.addColorStop(0.6, "#e59a34"); gg.addColorStop(1, "#b9661c");
      pill(5); g.fillStyle = gg; g.fill();
      pill(14); g.fillStyle = "#5a2206"; g.fill();
      g.globalCompositeOperation = "destination-out"; pill(17); g.fillStyle = "#000"; g.fill(); g.globalCompositeOperation = "source-over";
      g.lineWidth = 2; g.strokeStyle = "rgba(255,250,225,0.85)"; pill(7); g.stroke();   // thin light line on the rim
    }
    return PIXI.Texture.from(c);
  };
  const popPlate = new PIXI.Container(); popPlate.position.set(540, 938);
  const plateLac = new PIXI.NineSlicePlane(plateTex(true), 110, 100, 110, 100), plateRim = new PIXI.NineSlicePlane(plateTex(false), 110, 100, 110, 100);
  popPlate.addChild(plateLac, plateRim);
  const setPlate = (w) => { [plateLac, plateRim].forEach((n) => { n.width = w; n.height = 210; n.position.set(-w / 2, -105); }); };
  setPlate(700);
  const PLATE_TINT = { big: 0x1c7a3e, mega: 0x2046b4, super: 0xa41824, epic: 0x7024ac, max: 0x3a2a14 };
  const popTitleArt = new PIXI.Sprite(PIXI.Texture.EMPTY); popTitleArt.anchor.set(0.5, 0.5); popTitleArt.position.set(540, 748);
  const popArtMask = new PIXI.Sprite(PIXI.Texture.EMPTY); popArtMask.anchor.copyFrom(popTitleArt.anchor); popArtMask.position.copyFrom(popTitleArt.position);
  let titleBase = 1, artBase = 1;
  popBody.addChild(popCoins.c, popFlare, popAmtGlow, popPlate, popTitle, popTitleMask, popTitleArt, popArtMask, popShine, popAmt, popHint);
  const popFaders = [popDark, popGlow, popBurst, popBurst2, popCoins.c, popFlare, popTitle, popHint, popAmtGlow, popShine, popPlate, popTitleArt].concat(popHero ? [popHero] : [], popRays ? [popRays] : [], popFlame ? [popFlame] : []);
  pop.eventMode = "static"; pop.hitArea = new PIXI.Rectangle(0, 0, W, H);
  let popTap = null, titlePulse = null;
  pop.on("pointertap", () => popTap && popTap());
  function setTierTitle(t, first) {
    const look = TIER_LOOK[t];
    popTitle.text = TIER_NAME[t]; popTitle.style.fill = look.fill; popTitle.style.stroke = look.stroke;
    const base = Math.min(1, 980 / (popTitle.width / popTitle.scale.x));
    titleBase = base;
    const art = POP_ART("title_" + t);                 // custom title lettering + crest per tier; text only as fallback
    popTitleArt.visible = !!art;
    if (art) {
      popTitleArt.texture = popArtMask.texture = art; artBase = Math.min(1, 980 / art.width);
      popShine.mask = popArtMask;
    } else popShine.mask = popTitleMask;
    popTitle.renderable = popTitleMask.renderable = !art;   // after the mask swap: un-masking makes the old mask renderable again
    if (titlePulse) titlePulse.kill();
    gsap.killTweensOf(popTitle.scale);
    const again = performance.now() - (setTierTitle.at || 0) < 350; setTierTitle.at = performance.now();   // a tap jumped tiers
    const up = first ? 1.12 : 1.38;                    // a tier-up slams in; the first title just arrives
    gsap.fromTo(popTitle.scale, { x: base * up, y: base * up }, { x: base, y: base, duration: first ? 0.16 : 0.26, ease: first ? "back.out(1.2)" : "back.out(2.6)" });
    if (!first) {
      popCoins.emit({ tex: FX.tex.glow, x: 540, y: 760, s0: 7, s1: 11, life: 0.32, tint: look.glow, a0: 0.85, a1: 0, blend: PIXI.BLEND_MODES.ADD });
      if (!again) { hitStop(70); buzz(50); }
    }
    titlePulse = gsap.to(popTitle.scale, { x: base * 1.03, y: base * 1.03, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.26 });
    ringAt(540, 760, look.burst, 6, 0.6, popCoins);

    plateLac.tint = PLATE_TINT[t] || 0x5a0d1c;
    popGlow.tint = look.glow; popBurst.tint = popBurst2.tint = look.burst; flare1.tint = look.flare; flare2.tint = 0xffffff;
    popTitleMask.text = popTitle.text; popAmtGlow.tint = look.glow;
    if (popRays) popRays.setTint(look.burst);
    if (!first) VFX.shockwave(540, 740 + POP_DY, { amp: 30, radius: 1200, dur: 0.3 });
    for (let k = 0; k < 18 + 12 * Math.max(0, TIER_ORDER.indexOf(t)); k++) {
      const a = Math.random() * Math.PI * 2, v = 600 + Math.random() * 900;
      popCoins.emit({ tex: FX.tex.dot, x: 540, y: 790, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.6, s0: 0.35 + Math.random() * 0.3, s1: 0,
        life: 0.7 + Math.random() * 0.3, tint: Math.random() < 0.4 ? 0xffffff : look.burst, stretch: 380, blend: PIXI.BLEND_MODES.ADD });
    }
    SFX.fanfare(TIER_ORDER.indexOf(t)); shake(first ? 12 : 8, 0.3); if (!again) { bullReact(first ? "big" : "tease"); if (!first) flameKick(1.2); }
  }
  async function bigWin(amount, x) {
    popFaders.forEach((o) => (o.alpha = 1));
    popDark.alpha = 0; popHint.alpha = 0; popAmt.alpha = 1; popAmt.position.set(540, 930); popCoins.clear();
    pop.visible = true; pop.alpha = 1;
    gsap.to(popDark, { alpha: 1, duration: 0.3 });
    VFX.bloom(true, 0.3); SFX.music("bigwin");
    const shineTw = gsap.fromTo(popShine, { x: -260 }, { x: 1340, duration: 0.9, repeat: -1, repeatDelay: 0.7, ease: "power1.inOut" });
    if (popHero) gsap.fromTo(popHero.scale, { x: popHero.baseS * 0.96, y: popHero.baseS * 0.96 }, { x: popHero.baseS, y: popHero.baseS, duration: 0.28, ease: "power2.out" });
    const final = Engine.tier(x);
    const steps = TIER_ORDER.slice(0, TIER_ORDER.indexOf(final) + 1);
    // explicit tier segments: every tier gets a readable dwell; linear count, the last segment eases out (critique #9)
    const ENV = { big: 2.6, mega: 4.0, super: 5.4, epic: 7.0, max: 9.0 }, tk = S.turbo ? 0.6 : 1;   // timing pass: studio curve, tiers >= 1.4 s
    const bet = BETS[S.betIdx], marks = steps.map((t, i) => (i === 0 ? 0 : TIER_X[t] * bet)).concat([amount]);
    // intermediate tiers: a fixed readable dwell (>= 0.55 s even in turbo); the final tier gets the rest and decelerates
    const midDur = Math.max(0.7, 1.4 * tk), lastDur = Math.max(1.0, ENV[final] * tk - midDur * (steps.length - 1));
    let cur = -1, done = false;
    const shown = { v: 0 };
    popAmt.text = FX.money(amount);                    // the digits are sized once, for the final amount
    const amtK = Math.min(0.75, 800 / Math.max(1, popAmt.textWidth));
    setPlate(Math.min(1000, Math.max(520, popAmt.textWidth * amtK + 180)));     // the plate always contains the amount
    const draw = () => { popAmt.text = FX.money(shown.v); popAmt.scale.set(amtK); };
    let coinRate = 12, coinAcc = 0;                    // coins per second, set by the tier on show: BIG 12 .. EPIC 21
    const coinTick = () => {
      coinAcc += coinRate * Math.min(0.05, app.ticker.deltaMS / 1000) * gsap.globalTimeline.timeScale();
      const n = Math.floor(coinAcc); coinAcc -= n;
      for (let i = 0; i < n; i++) {
        const base = { x: 540 + (Math.random() - 0.5) * 120, y: 840, vx: (Math.random() - 0.5) * 1400, vy: -1300 - Math.random() * 900, ay: 2600, life: 1.7,
          a0: 1, a1: 1, blend: PIXI.BLEND_MODES.NORMAL };
        const r0 = Math.random();
        if (r0 < 0.7) popCoins.emit(Object.assign(base, { frames: FX.tex.coinFrames, fps: 16 + Math.random() * 18, s0: 0.5 + Math.random() * 0.35, s1: 0.55, vr: (Math.random() - 0.5) * 1.5 }));
        else if (r0 < 0.86) popCoins.emit(Object.assign(base, { tex: FX.tex.gems[Math.floor(Math.random() * FX.tex.gems.length)], s0: 0.5 + Math.random() * 0.3, s1: 0.5, vr: (Math.random() - 0.5) * 7 }));
        else popCoins.emit(Object.assign(base, { tex: FX.tex.flake, s0: 0.7, s1: 0.6, flip: 7 + Math.random() * 6, vr: (Math.random() - 0.5) * 5, ay: 1400, drag: 0.6 }));
      }
      if (Math.random() < 3 * app.ticker.deltaMS / 1000) popCoins.emit({ tex: FX.tex.star8, x: 540 + (Math.random() - 0.5) * 900, y: 640 + Math.random() * 420, s0: 0.05, s1: 0.32, life: 0.5,
        a0: 1, a1: 0, tint: Math.random() < 0.5 ? 0xffffff : 0xffe08a, vr: 2, blend: PIXI.BLEND_MODES.ADD });
      {
        popTitleMask.scale.copyFrom(popTitle.scale);
        const ts = (popTitle.scale.x / titleBase) * artBase; popTitleArt.scale.set(ts); popArtMask.scale.set(ts);
        popAmtGlow.alpha = 0.45 + 0.25 * Math.sin(performance.now() / 160);
        if (popRays) popRays.update(performance.now() / 1000, 540, 380 + POP_DY);
        if (popFlame && popHero) placeFlame(popFlame, popHero, true);
      }
      popFlare.alpha = 0.75 + 0.25 * Math.sin(performance.now() / 110);
      flare1.scale.x = 4.4 + 0.4 * Math.sin(performance.now() / 170);
      if (Math.random() < 0.5) SFX.coin();
    };
    app.ticker.add(coinTick);
    const countTw = gsap.timeline();
    const tickDraw = () => { draw(); if (Math.random() < 0.35) SFX.tick(); };
    steps.forEach((t, i) => {
      countTw.call(() => { if (i > cur) { cur = i; coinRate = 12 + 3 * i; setTierTitle(t, i === 0); } });
      if (i < steps.length - 1) countTw.to(shown, { v: marks[i + 1], duration: midDur, ease: "none", onUpdate: tickDraw });
      else {                                            // final tier: steady count, then a separate 0.35 s deceleration
        const near = marks[i] + (marks[i + 1] - marks[i]) * 0.9;
        countTw.to(shown, { v: near, duration: lastDur - 0.35, ease: "none", onUpdate: tickDraw })
          .to(shown, { v: marks[i + 1], duration: 0.35, ease: "power2.out", onUpdate: tickDraw });
      }
    });
    draw();
    await new Promise((res) => {
      const finish = () => {
        if (done) return; done = true;
        countTw.kill(); shown.v = amount; draw();
        if (cur < steps.length - 1) { cur = steps.length - 1; setTierTitle(steps[cur], cur === 0); }   // tap: straight to the final tier
        gsap.fromTo(popAmt.scale, { x: amtK * 1.08, y: amtK * 1.08 }, { x: amtK, y: amtK, duration: 0.18, ease: "back.out(1.2)" });
        ringAt(540, 930 + POP_DY, 0xffd060, 4, 0.5); SFX.impact(true); coinRate = 8;
        gsap.to(popHint, { alpha: 1, duration: 0.4 });
        const auto = gsap.delayedCall(S.auto ? 0.6 : 1.1, close);
        popTap = () => { auto.kill(); close(); };
      };
      const close = () => {
        popTap = null; app.ticker.remove(coinTick); shineTw.kill(); VFX.bloom(false); SFX.musicBack();
        if (titlePulse) { titlePulse.kill(); titlePulse = null; }
        gsap.to(popFaders, { alpha: 0, duration: 0.3 });
        // the amount shrinks and flies down to the win bar
        gsap.to(popAmt.scale, { x: popAmt.scale.x * 0.3, y: popAmt.scale.y * 0.3, duration: 0.4, ease: "power2.in" });
        gsap.to(popAmt, { y: 1374 - POP_DY, alpha: 0.3, duration: 0.4, ease: "power2.in", onComplete: () => {
          ringAt(540, 1374, 0xffd060, 2, 0.3); SFX.line();
          pop.visible = false; popCoins.clear(); popAmt.position.set(540, 930); res();
        } });
      };
      countTw.eventCallback("onComplete", () => gsap.delayedCall(0.05, finish));
      popTap = () => finish();
    });
  }

  // ---------- anticipation on reel 3 ----------
  const tease = new PIXI.Container(); tease.visible = false; boardFx.addChild(tease);
  {
    const x0 = REEL_X[2][0], x1 = REEL_X[2][1], w = x1 - x0, h = WIN_Y1 - CELL_Y0;
    const fill = new PIXI.Graphics().beginFill(0xff8a20, 0.12).drawRoundedRect(x0 + 4, CELL_Y0 + 4, w - 8, h - 8, 20).endFill();
    const i = new PIXI.Graphics().lineStyle(5, 0xffe08a, 0.9).drawRoundedRect(x0 + 4, CELL_Y0 + 4, w - 8, h - 8, 20);
    [fill, i].forEach((g) => (g.blendMode = PIXI.BLEND_MODES.ADD));
    tease.addChild(fill, i);
    FireRect(tease, x0 + 6, CELL_Y0 + 6, x1 - 6, WIN_Y1 - 6, { pad: 50, top: 80, height: 62 });
    tease.box = [x0, CELL_Y0, x1, WIN_Y1];
  }
  // multiplier tease: warm glow over the tray, a bright centre band and two pointers that knock on every chip
  const colTease = new PIXI.Container(); colTease.visible = false; boardFx.addChild(colTease);
  {
    const [x0, y0, x1, y1] = TRAY, w = x1 - x0, h = y1 - y0;
    const fill = new PIXI.Graphics().beginFill(0xffb040, 0.08).drawRoundedRect(x0 + 4, y0 + 4, w - 8, h - 8, 18).endFill();
    const rim = new PIXI.Graphics().lineStyle(4, 0xffe08a, 0.85).drawRoundedRect(x0 + 4, y0 + 4, w - 8, h - 8, 18);
    const band = new PIXI.Sprite(FX.tex.glow); band.anchor.set(0.5); band.position.set(COL_CX, COL_CY);
    band.scale.set(w / 110, COL_P / 150); band.tint = 0xffd070;
    [fill, rim, band].forEach((g) => (g.blendMode = PIXI.BLEND_MODES.ADD));
    const ptr = [[x0 - 12, 1], [x1 + 12, -1]].map(([x, dir]) => {
      const g = new PIXI.Graphics().beginFill(0x000000, 0.45).drawPolygon([-dir * 6, -32, dir * 26, 0, -dir * 6, 32]).endFill()
        .beginFill(0xffd36b).lineStyle(2, 0x7a4a10).drawPolygon([-dir * 4, -26, dir * 20, 0, -dir * 4, 26]).endFill();
      g.position.set(x, COL_CY); g.dir = dir; return g;
    });
    colTease.addChild(fill, band, rim, ...ptr);
    Object.assign(colTease, { box: [x0, y0, x1, y1], band, rim, ptr, heat: 0 });
  }
  function colTeaseOn() {
    gsap.killTweensOf(colTease); colTease.visible = true; colTease.alpha = 0; colTease.heat = 0;
    gsap.to(colTease, { alpha: 1, duration: 0.3 }); gsap.to(colTease, { heat: 1, duration: 1.6, ease: "power1.in" });
    SFX.colTease();
  }
  function colTeaseTick(left) {                     // a chip arrives in the centre slot
    const k = colTease.heat;
    SFX.colTick(k);
    gsap.fromTo(colTease.band, { alpha: 0.7 }, { alpha: 0.25 + 0.3 * k, duration: 0.22 });
    colTease.ptr.forEach((g) => gsap.fromTo(g, { x: g.x0 ?? (g.x0 = g.x) }, { x: g.x0 + g.dir * 7, duration: 0.07, yoyo: true, repeat: 1, ease: "power1.out" }));
    const v = colReel.views[3];
    if (v && v.inner) gsap.fromTo(v.inner.scale, { x: 1.07 + 0.05 * k, y: 1.07 + 0.05 * k }, { x: 1, y: 1, duration: 0.24, ease: "power2.out" });
    if (left <= 6) boardP.emit({ tex: FX.tex.spark, x: COL_CX + (Math.random() - 0.5) * 120, y: COL_CY, s0: 0.1, s1: 0.5, life: 0.35, a0: 1, a1: 0, vr: 3, tint: 0xfff0c8 });
  }
  function colTeaseOff() {
    gsap.killTweensOf(colTease);
    gsap.to(colTease, { alpha: 0, duration: 0.35, onComplete: () => (colTease.visible = false) });
  }

  // ---------- round ----------
  let skipWait = null;
  const waitSkippable = (s) => new Promise((res) => { const d = gsap.delayedCall(s, done); function done() { skipWait = null; res(); } skipWait = () => { d.kill(); done(); }; });
  let quick = false, spinAt = 0, presentAt = 0;
  // A tap while the reels turn slam-stops them, a tap during the win speeds it up 2x. Taps within 0.45 s of the spin
  // start (a double-click) and within 0.5 s of the win starting are ignored, so a double-click is just one spin.
  function onSpinPress() {
    SFX.unlock();
    const now = performance.now();
    if (S.state === "idle") { spinAt = now; return spin(); }
    if (S.state === "spinning") { if (now - spinAt < 450) return; quick = true; if (skipWait) skipWait(); if (colReel.tween) colReel.tween.timeScale(4); return; }
    if (S.state === "present") {
      if (now - Math.max(spinAt, presentAt) < 500) return;
      // an ordinary win (no feature, no popup): the tap skips the rest of the show and the next spin starts at once.
      // A feature or a popup win only speeds up: the player should not lose those by a stray tap.
      if (S.canSkip) { S.respin = true; gsap.globalTimeline.timeScale(8 * BASE_TS); }
      else gsap.globalTimeline.timeScale(2 * BASE_TS);
    }
  }
  async function spin(force, buyKind) {
    if (S.state !== "idle") return;
    const buyCost = buyKind ? Engine.BUY[buyKind].cost * BETS[S.betIdx] : 0;
    if (S.balance < (buyKind ? buyCost : stake())) {
      showMsg("NOT ENOUGH BALANCE"); gsap.fromTo(ui.balance_bar, { alpha: 0.4 }, { alpha: 1, duration: 0.15, repeat: 5, yoyo: true });
      if (S.auto > 0) stopAuto();                          // autoplay ends when the money does
      return;
    }
    clearWin();
    S.state = "spinning"; quick = false; setUiLocked(true); S.forceKind = force || null;
    const bet = BETS[S.betIdx];
    let r;
    if (buyKind) r = Engine.buySpin(buyKind, bet, false);
    else if (force === "max") {
      // DEMO only: a max win is too rare to find by seed search (none in tens of millions), so the demo sets up a
      // real, possible outcome: two full lines of WILDs with the 1000x chip (capped at the max win), settled by the engine as usual
      r = Engine.settle([["wild", "wild", "K"], ["wild", "wild", "J"], ["wild", "wild", "A"]], Engine.STRIP.indexOf(1000), bet, stake());
    }
    else if (force) { const f = Engine.findRound(force, bet, S.ex, 1 + Math.floor(Math.random() * 1e6)); r = f ? f.round : Engine.spin(bet, S.ex); }
    else r = Engine.spin(bet, S.ex);
    window.G.last = r;
    setBalance(S.balance - r.stake, false);
    if (buyKind) { showMsg(Engine.BUY[buyKind].name + "!"); await bullCharge(); }
    if (S.auto > 0) { S.auto--; autoTxt.text = String(S.auto); if (!S.auto) stopAuto(); }
    showMsg("GOOD LUCK!");
    SFX.spin(); bullReact("spin");
    arrowSpeed = 6.3;                                   // ~360 deg/s while the reels run (Garuda)
    gsap.fromTo(spinFlash, { alpha: 0.9 }, { alpha: 0, duration: 0.5 });
    ringAt(scx, scy, 0xffd060, 1.6, 0.4);
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2;
      topP.emit({ tex: FX.tex.dot, x: scx + Math.cos(a) * 118, y: scy + Math.sin(a) * 118, vx: -Math.sin(a) * 460 + Math.cos(a) * 140, vy: Math.cos(a) * 460 + Math.sin(a) * 140,
        drag: 3.2, s0: 0.32, s1: 0, life: 0.45, tint: k % 3 ? 0xffd060 : 0xffffff, stretch: 420 });
    }
    const tb = S.turbo;
    // Garuda timing: no lift; stops at 0.50 / 0.70 / 0.90 s, the column at 1.10 s (turbo 0.15 / 0.20 / 0.25 / 0.30 s).
    // A stop request lands ~0.15 s later (the final symbols scroll in), so requests go out that much earlier.
    reels.forEach((rl) => rl.start(0, tb)); colReel.start(0, tb);
    // Porco: each reel may start its stop when the previous one has; stops come one loop apart (~0.4 s)
    const tStop = tb ? [0.2, 0.3, 0.4, 0.5] : [0.32, 0.55, 0.78, 1.0], LEAD = 0;     // timing pass 2026-11-10 (was 0.6/1.0/1.4/1.7)
    const wildsEarly = [0, 1].reduce((a, reel) => a + r.grid[reel].filter((s) => Engine.WILDS.has(s)).length, 0);
    const doTease = wildsEarly >= 2 && !tb;
    await waitSkippable(Math.max(0.02, tStop[0] - LEAD));
    const landed = [];
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        if (i === 2 && doTease && !quick) {
          tease.visible = true; tease.alpha = 0; gsap.to(tease, { alpha: 1, duration: 0.25 });
          vignette.visible = true; gsap.to(vignette, { alpha: 0.55, duration: 0.3 });
          SFX.tease(1.5); bullReact("tease");
          reels[2].vmax = 30;
          await waitSkippable(1.1);
          reels[2].vmax = reels[2].vNormal;
        } else await waitSkippable(quick ? 0.03 : tStop[i] - tStop[i - 1]);
      }
      const rl = reels[i];
      rl.onLand = () => onReelLand(i, r);
      landed.push(rl.stop(r.grid[i], tb || quick));
    }
    await waitSkippable(quick ? 0.03 : tStop[3] - tStop[2]);
    colC = r.multIndex;
    colReel.onLand = () => onColumnLand(r);
    const colFinal = [2, 1, 0, -1, -2].map((k) => stripAt(colC, k));
    if (r.win > 0 && !tb && !quick) {                // a win to multiply: the column rolls on, ticking chip by chip
      colTeaseOn();
      const small = r.win < r.stake && !r.nudges.length;            // a short roll for a win below the stake
      landed.push(colReel.teaseStop(colFinal, { vSlow: small ? 5.5 : 4.2, tau: 0.2, t1: small ? 0.42 : 0.85, t2: small ? 0.45 : 0.75, over: 0.09,
        extra: (n) => Array.from({ length: n }, (_, k) => stripAt(colC, k - n - 2)),
        onTick: (left, v) => {
          if (v < 11) colTeaseTick(left);
          // a 500x / 1000x chip passing the centre: the roll hangs on it for a moment and the bull leans in
          const val = Engine.STRIP[colReel.syms[3]];
          if (left > 0 && val >= 500 && v < 14 && colReel.tween && !quick) {
            const tw = colReel.tween; tw.timeScale(0.4); gsap.delayedCall(0.3, () => { if (colReel.tween === tw && !quick) tw.timeScale(1); });
            SFX.tease(0.4); flameKick(1.2); bullReact("tease");
            flashAt(COL_CX, COL_CY, 0xfff0b0, 1.6, 0.3); ringAt(COL_CX, COL_CY, 0xffe08a, 1.6, 0.35);
          }
        } }).then(colTeaseOff));
    } else landed.push(colReel.stop(colFinal, tb || quick));
    await Promise.all(landed);
    gsap.to(tease, { alpha: 0, duration: 0.25, onComplete: () => (tease.visible = false) });
    if (vignette.visible) gsap.to(vignette, { alpha: 0, duration: 0.3, onComplete: () => (vignette.visible = false) });
    colC = (r.multIndex + r.nudges.length) % Engine.STRIP.length;
    curGrid = r.grid.map((c) => c.slice());
    arrowSpeed = 0.35;
    if (r.win > 0) await present(r);
    else { showMsg("SPIN TO WIN"); }
    gsap.globalTimeline.timeScale(BASE_TS);
    S.state = "idle"; setUiLocked(false); S.canSkip = false;
    if (S.respin) { S.respin = false; if (!S.auto) { spinAt = performance.now(); return spin(); } }
    if (S.auto > 0) gsap.delayedCall(r.win > 0 ? 1.0 : 0.3, () => { if (S.state === "idle" && S.auto > 0 && !(buyUI && buyUI.isOpen && buyUI.isOpen())) spin(); });
  }
  function onReelLand(i, r) {
    SFX.reelStop(i);
    for (let k = 0; k < 8; k++) boardP.emit({ tex: FX.tex.dot, x: REEL_X[i][0] + Math.random() * (REEL_X[i][1] - REEL_X[i][0]), y: WIN_Y1 - 8,
      vx: (Math.random() - 0.5) * 90, vy: -25 - Math.random() * 45, drag: 2, s0: 0.35, s1: 0.8, life: 0.55, a0: 0.3, a1: 0, tint: 0xe6caa0, blend: PIXI.BLEND_MODES.NORMAL });
    gsap.fromTo(boardL, { y: 3 }, { y: 0, duration: 0.14, ease: "power2.out" });
    for (let row = 0; row < 3; row++) {
      const id = r.grid[i][row];
      if (Engine.WILDS.has(id)) {
        const x = REEL_CX[i], y = rowY(row);
        const v = reels[i].view(row);
        gsap.killTweensOf(v.inner.scale); gsap.fromTo(v.inner.scale, { x: 1.08, y: 1.08 }, { x: 1, y: 1, duration: 0.16, ease: "power2.out" });
        ringAt(x, y, id === "wild" ? 0xd9a0ff : 0xff8a3a, 1.8, 0.5); flashAt(x, y, 0xffe0a0, 1.3, 0.3);
        burstAt(x, y, id === "wild" ? 0xe0b0ff : 0xffa050, 16, boardP); boom(x, y, 1.0, id === "wild" ? 0xe8c8ff : null, boardFx);
        VFX.shockwave(x, y, { amp: 12, radius: 300, wave: 90, dur: 0.45 }); starFlash(x, y, 1.6, id === "wild" ? 0xe0b0ff : 0xffc080);
        if (id === "super_wild") { SFX.superLand(); hitStop(50); buzz(30); } else { SFX.wildLand(); buzz(15); }
      }
    }
  }
  // a NUDGE chip in the centre fires: cyan shock, lightning, "+N NUDGES" flies to the counter
  async function nudgeChipFire(n) {
    const v = colReel.views[3];
    gsap.fromTo(v.inner.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.6, ease: "elastic.out(1,0.45)" });
    gsap.fromTo(v.flash, { alpha: 1 }, { alpha: 0, duration: 0.7 });
    gsap.fromTo(v.magic.uniforms, { uAmp: 5 }, { uAmp: 1, duration: 1.2 });
    ringAt(COL_CX, COL_CY, 0x5ff0ff, 2.0, 0.5); flashAt(COL_CX, COL_CY, 0xbaffff, 1.1, 0.1);
    burstAt(COL_CX, COL_CY, 0x7ff4ff, 12); boom(COL_CX, COL_CY, 1.1, 0xa8f6ff); lightning(COL_CX, COL_CY, 0xbaffff);
    SFX.nudgeActivate(); shake(8, 0.25);
    const t = new PIXI.Text(`+${n} NUDGES`, FX.gold(44, { fill: ["#F0FFFF", "#7FF4FF", "#1A9FB0"] }));
    t.anchor.set(0.5); t.position.set(COL_CX - 40, COL_CY); fxTop.addChild(t);
    gsap.fromTo(t.scale, { x: 0.4, y: 0.4 }, { x: 1, y: 1, duration: 0.35, ease: "back.out(3)" });
    await FX.wait(0.45);
    await FX.tween(t, { x: cntBox.x, y: cntBox.y, alpha: 0.2, duration: 0.45, ease: "power2.in" });
    t.destroy();
    gsap.fromTo(cntBox.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(3)" });
    ringAt(cntBox.x, cntBox.y, 0x5ff0ff, 0.9, 0.35);
  }
  function onColumnLand(r) {
    SFX.columnStop();
    const v = r.startMult;
    ringAt(COL_CX, COL_CY, 0xffd060, 1.1, 0.35);
    if (v < 0) { ringAt(COL_CX, COL_CY, 0x5ff0ff, 2, 0.5); burstAt(COL_CX, COL_CY, 0x7ff4ff, 14); SFX.wildLand(); lightBeam(COL_CX, COL_CY, 0x7ff4ff); }
    if (v >= 10) lightBeam(COL_CX, COL_CY, v >= 100 ? 0xffe8a0 : 0xffc860);
    if (v >= 50) {
      shake(v >= 500 ? 16 : 8, 0.35); hitStop(v >= 500 ? 110 : 70); buzz(v >= 500 ? 80 : 40); flashAt(COL_CX, COL_CY, 0xffffff, 2.4, 0.45); burstAt(COL_CX, COL_CY, 0xffe08a, 28);
      ringAt(COL_CX, COL_CY, 0xfff0b0, 3, 0.6); SFX.impact(v >= 500);
      lightning(COL_CX, COL_CY);
    }
  }
  // a SUPER WILD leaving the bottom of a spinning reel leaves a 0.25 s fire curtain (Garuda)
  function fireCurtain(reel) {
    const x0 = REEL_X[reel][0], x1 = REEL_X[reel][1];
    embers([x0, WIN_Y1 - 10, x1, WIN_Y1], 2, 0xff9a40);
  }
  function lightning(x, y, col) {
    if (FX.tex.bolts) return lightningArt(x, y, col);
    SFX.lightning();
    const g = new PIXI.Graphics(); g.blendMode = PIXI.BLEND_MODES.ADD; fxTop.addChild(g);
    let n = 0;
    const zap = () => {
      g.clear();
      for (let b = 0; b < 4; b++) {
        let px = x, py = y; const a = Math.random() * Math.PI * 2;
        g.lineStyle(3 + Math.random() * 3, col || 0xfff2c0, 0.9).moveTo(px, py);
        for (let s = 0; s < 7; s++) { px += Math.cos(a) * 28 + (Math.random() - 0.5) * 40; py += Math.sin(a) * 28 + (Math.random() - 0.5) * 40; g.lineTo(px, py); }
      }
      if (++n < 8) gsap.delayedCall(0.05, zap); else g.destroy();
    };
    zap();
  }

  function lightningArt(x, y, col) {
    SFX.lightning();
    const g = new PIXI.Container(); fxTop.addChild(g);
    const bolts = [0, 1, 2, 3].map(() => {
      const b = new PIXI.Sprite(FX.tex.bolts[0]); b.anchor.set(0.5, 0); b.position.set(x, y); b.blendMode = PIXI.BLEND_MODES.ADD;
      if (col) b.tint = col; g.addChild(b); return b;
    });
    let n = 0;
    const zap = () => {
      bolts.forEach((b) => {
        b.texture = FX.tex.bolts[Math.floor(Math.random() * 3)]; b.rotation = Math.random() * Math.PI * 2;
        b.scale.set((Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.3), 0.35 + Math.random() * 0.25); b.alpha = 0.7 + Math.random() * 0.3;
      });
      if (++n < 8) gsap.delayedCall(0.05, zap); else g.destroy({ children: true });
    };
    zap();
  }

  // ---------- menu / paytable ----------
  function openMenu() {
    if (menuL.children.length) return;
    const m = new PIXI.Container(); menuL.addChild(m);
    const dark = new PIXI.Graphics().beginFill(0x050106, 0.86).drawRect(-200, -200, W + 400, H + 400).endFill();
    dark.eventMode = "static";
    const pnl = new PIXI.Graphics().beginFill(0x2a0a10, 0.96).lineStyle(5, 0xe8a640).drawRoundedRect(50, 150, 980, 1620, 40).endFill();
    m.addChild(dark, pnl);
    const title = new PIXI.Text("PAYTABLE", FX.gold(72)); title.anchor.set(0.5); title.position.set(540, 240); m.addChild(title);
    const bet = BETS[S.betIdx];
    const rows = [["wild", "super_wild"], ["chest", "sun", "hourglass"], ["A", "K", "Q", "J"]];
    let y = 400;
    rows.forEach((row) => {
      const n = row.length, step = 980 / n;
      row.forEach((s, k) => {
        const x = 50 + step * (k + 0.5);
        const sp = new PIXI.Sprite(T(`Symbols/${HIGH.has(s) ? s + "_tile" : s}`)); sp.anchor.set(0.5); sp.scale.set(n > 3 ? 0.62 : 0.72); sp.position.set(x, y);
        const t = new PIXI.Text(`3x  ${FX.money(Engine.payOf(s) * bet)}`, FX.plain(30, "#ffe6b0")); t.anchor.set(0.5); t.position.set(x, y + 112);
        m.addChild(sp, t);
      });
      y += 290;
    });
    const rules = [
      "5 fixed lines. WILD and SUPER WILD replace every symbol.",
      "The centre multiplier of the column multiplies the total win.",
      `Each SUPER WILD in a win nudges the column ${Engine.NUDGES} times;`,
      "every nudge adds the new centre multiplier.",
      "A NUDGE 3 / NUDGE 5 chip in the centre of a win nudges 3 / 5 times.",
      `EX: ${Engine.EX_COST}x bet; SUPER WILD ${Engine.EX_BOOST}x and NUDGE ${Engine.NUDGE_EX}x as often.`,
      `Max win ${FX.money(Engine.MAX_WIN, 0)}x bet. Demo maths, RTP about 96%.`,
    ];
    const rt = new PIXI.Text(rules.join("\n"), FX.plain(30, "#f4dcc0", { align: "center", lineHeight: 46 })); rt.anchor.set(0.5, 0); rt.position.set(540, 1290);
    m.addChild(rt);
    // line diagrams
    Engine.LINES.forEach((rowsL, k) => {
      const g = new PIXI.Graphics(); const ox = 125 + k * 175, oy = 1180, s = 30;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) g.beginFill(rowsL[a] === b ? 0xffc24a : 0x5a2a30).drawRoundedRect(ox + a * (s + 4), oy + b * (s + 4) - 60, s, s, 6).endFill();
      const lt = new PIXI.Text(String(k + 1), FX.plain(24, "#ffe6b0")); lt.anchor.set(0.5); lt.position.set(ox + 49, oy + 70);
      m.addChild(g, lt);
    });
    const close = new PIXI.Text("CLOSE", FX.gold(48)); close.anchor.set(0.5); close.position.set(540, 1690);
    close.eventMode = "static"; close.cursor = "pointer";
    close.on("pointertap", () => { SFX.click(); gsap.to(m, { alpha: 0, duration: 0.2, onComplete: () => m.destroy({ children: true }) }); });
    m.addChild(close);
    m.alpha = 0; gsap.to(m, { alpha: 1, duration: 0.25 });
  }

  // ---------- ticker: ambient life ----------
  let idleWatchT = 0;
  document.addEventListener("visibilitychange", () => { idleWatchT = 0; });
  let idleLifeT = 0;
  let time = 0, sparkT = 0, frameSweepT = 2, chipGlintT = 1.5, dustT = 0, emberT = 0;
  app.ticker.add(() => {
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000) * gsap.globalTimeline.timeScale();
    time += dt;
    reels.forEach((rl) => rl.update(dt));
    colReel.update(dt);
    if (mobBull) {
      mobBull.tick(); if (mobWild) mobWild.tick();
      const live = mobBull.live && !!clips.bull_idle;
      if (bullClipC.visible !== live) { bullClipC.visible = live; bullSpr.visible = !live; eyes.forEach((e) => (e.visible = !live)); }
    }
    if (multTag && !multTag.destroyed && plaque.visible && plaqueBig.visible)   // the xN tag rides just after the counting digits
      multTag.position.set(plaque.x + (plaqueBig.textWidth * plaqueBig.scale.x * plaque.scale.x) / 2 + (multTag.width * multTag.scale.x) / 2 + 22, plaque.y + 8);
    if (booms.size) { const k = 0.55 * gsap.globalTimeline.timeScale(); booms.forEach((b) => { if (b.destroyed) booms.delete(b); else b.animationSpeed = k; }); }
    // idle life: after 5 s without a spin a shimmer runs across the symbols, the spin button calls, the flame flares
    if (S.state === "idle" && !S.auto && !pop.visible) {
      idleLifeT += dt;
      if (idleLifeT > 5) {
        idleLifeT = -2;                                  // then every 7 s
        reels.forEach((rl, reel) => [0, 1, 2].forEach((row) => {
          const v = rl.view(row), d = (reel + row) * 0.09;
          gsap.fromTo(v.inner.scale, { x: 1, y: 1 }, { x: 1.05, y: 1.05, duration: 0.16, delay: d, yoyo: true, repeat: 1, ease: "sine.inOut" });
          gsap.delayedCall(d, () => { if (S.state === "idle") boardP.emit({ tex: FX.tex.spark, x: REEL_CX[reel] + 60, y: rowY(row) - 50, s0: 0.1, s1: 0.5, life: 0.4, a0: 1, a1: 0, vr: 3, tint: 0xfff0c8 }); });
        }));
        gsap.fromTo(spinC.scale, { x: 1, y: 1 }, { x: 1.06, y: 1.06, duration: 0.22, delay: 0.5, yoyo: true, repeat: 3, ease: "sine.inOut" });
        gsap.delayedCall(0.5, () => { if (S.state === "idle") ringAt(scx, scy, 0xffd060, 1.6, 0.5); });
        flameKick(0.7);
      }
    } else idleLifeT = 0;
    ambP.update(dt); dust.update(dt); boardP.update(dt); topP.update(dt); popCoins.update(dt);
    // bull breathing + eye flicker
    const br = Math.sin(time * Math.PI * 2 / 3.4);
    bullSpr.scale.set(1 + 0.0025 * br, 1 + 0.006 * br);
    bullSpr.y = -bl.h * (1 + 0.006 * br); bullSpr.x = -bl.w / 2 * (1 + 0.0025 * br);
    eyes.forEach((e, k) => { if (!gsap.isTweening(e)) e.alpha = 0.4 + 0.12 * Math.sin(time * 7 + k) + 0.05 * Math.random(); });
    // rays + sun
    rays.forEach((r, k) => { r.alpha = 0.07 + 0.05 * Math.sin(time * 0.6 + k * 1.7); r.rotation = 0.5 + k * 0.06 + 0.015 * Math.sin(time * 0.3 + k); });
    sunGlow.rotation += dt * 0.15; sunGlow.alpha = 0.28 + 0.08 * Math.sin(time * 1.3);
    // fire
    flames.forEach((f, k) => {
      f.glow.alpha = 0.24 + 0.08 * Math.sin(time * 11 + k) + 0.06 * Math.random();
      f.tongues.forEach((t, j) => { t.scale.y = (0.9 - Math.abs(j - 1) * 0.25) * (1 + 0.18 * Math.sin(time * (9 + j * 2.3) + k)); t.rotation = 0.08 * Math.sin(time * 5 + j); });
    });
    emberT -= dt;
    if (emberT < 0) {
      emberT = 0.06;
      const f = flames[Math.floor(Math.random() * flames.length)];
      ambP.emit({ tex: FX.tex.dot, x: f.x + (Math.random() - 0.5) * 50, y: f.y - 10, vx: (Math.random() - 0.5) * 40, vy: -80 - Math.random() * 90,
        ax: (Math.random() - 0.5) * 30, life: 1.4 + Math.random(), s0: 0.22, s1: 0.02, tint: 0xffa040, a0: 1, a1: 0 });
    }
    dustT -= dt;
    if (dustT < 0) {
      dustT = 0.25;
      dust.emit({ tex: FX.tex.dot, x: Math.random() * W, y: 80 + Math.random() * 500, vx: 6 + Math.random() * 10, vy: -4 - Math.random() * 8,
        life: 5 + Math.random() * 4, s0: 0.05 + Math.random() * 0.08, s1: 0.05, a0: 0.55, a1: 0, fadeIn: 1.2, tint: 0xffe8c0 });
    }
    // frame: sweep + gem sparkles
    frameSweepT -= dt;
    if (frameSweepT < 0) { frameSweepT = 6.5; frameShine.x = -300; gsap.to(frameShine, { x: 1400, duration: 1.6, ease: "power1.inOut" }); }
    sparkT -= dt;
    if (sparkT < 0) {
      sparkT = 0.35 + Math.random() * 0.4;
      const [x, y] = fxPts.frame_sparkles[Math.floor(Math.random() * fxPts.frame_sparkles.length)];
      boardP.emit({ tex: FX.tex.spark, x, y, s0: 0.05, s1: 0.45, life: 0.6, a0: 1, a1: 0, vr: 2, tint: 0xfff0c8 });
    }
    chipGlintT -= dt;
    if (chipGlintT < 0 && colReel.state === "idle") {
      chipGlintT = 1.2 + Math.random() * 1.5;
      const v = colReel.views[1 + Math.floor(Math.random() * 5)];
      gsap.fromTo(v.flash, { alpha: 0 }, { alpha: 0.8, duration: 0.25, yoyo: true, repeat: 1 });
    }
    // SPIN button
    spinArrows.rotation += dt * arrowSpeed * (arrowSpeed > 1 ? 1 : 1);
    spinGlow.alpha = 0.6 + 0.35 * Math.sin(time * 2.6);
    spinGlow.scale.set(1 + 0.03 * Math.sin(time * 2.6));
    exRing.rotation += dt * 0.6;
    magicFilters.forEach((f) => (f.uniforms.uTime = time));
    if (S.turbo) ui.turbo.aura.alpha = 0.45 + 0.2 * Math.sin(time * 6);
    // winning cell sparkles
    winEmitters.forEach((e) => {
      e.t -= dt;
      if (e.t < 0 && e.n > 0) {
        e.t = 0.18; e.n--;
        boardP.emit({ tex: FX.tex.spark, x: e.x + (Math.random() - 0.5) * e.w, y: e.y + (Math.random() - 0.5) * e.h, vy: -40, s0: 0.05, s1: 0.4, life: 0.5, a0: 1, a1: 0, tint: 0xffe2a0, vr: 3 });
      }
    });
    featRays.rotation += dt * 0.12;
    updateFire(time);
    VFX.update(time);
    bullTick();
    // the browser may pause a muted background video (hidden tab, power saving) and never resume it: keep the idle alive
    idleWatchT -= dt;
    if (idleWatchT < 0) {
      idleWatchT = 0.4;
      const iv = clips.bull_idle;
      if (iv && iv.sprite.visible && iv.video.paused && !document.hidden) { const p = iv.video.play(); if (p && p.catch) p.catch(() => {}); }
    }
    if (flame.c) placeFlame(flame.c, null, false);
    if (vignette.visible && tease.visible) vignette.alpha = 0.42 + 0.2 * Math.pow(Math.max(0, Math.sin(time * 7.2)), 6);
    if (fireFrame.visible) {
      embers(fireFrame.box, nEmit(14));
    }
    if (S.state === "spinning") reels.forEach((rl) => rl.views.forEach((v) => {
      if (!v.fire.visible || !v.c.visible || v.c.y < CELL_Y0 || v.c.y > WIN_Y1) return;
      if (nEmit(30)) boardP.emit({ tex: FX.tex.dot, x: v.c.x + (Math.random() - 0.5) * 220, y: v.c.y + (Math.random() - 0.2) * 160,
        vy: -320, s0: 0.2, s1: 0, life: 0.35, tint: Math.random() < 0.5 ? 0xffd27a : 0xff7a20, a0: 1, a1: 0 });
    }));
    if (tease.visible) {
      embers(tease.box, nEmit(50));
    }
    if (colTease.visible) {                          // the tray warms up as the roll slows
      const k = colTease.heat;
      colTease.rim.alpha = 0.45 + 0.4 * k + 0.15 * Math.sin(time * (6 + 8 * k));
      embers(colTease.box, nEmit(4 + 22 * k));
    }
    // shake
    // shake around the board's rest point (= its pivot: the intro scales the board about (540, 940))
    if (shakeT > 0) { shakeT -= dt; const a = shakeA * Math.max(0, shakeT) / 0.4, dx = (Math.random() - 0.5) * a;
      board.x = board.pivot.x + dx; board.y = board.pivot.y + (Math.random() - 0.5) * a; bullL.x = dx * 0.5; }
    else if (board.x !== board.pivot.x || board.y !== board.pivot.y) { board.position.copyFrom(board.pivot); bullL.x = 0; shakeA = 0; }
  });

  // ---------- intro ----------
  const tap = new PIXI.Text("TAP TO PLAY", FX.gold(54));
  tap.anchor.set(0.5); tap.position.set(540, 1200); loadC.addChild(tap);
  loadTxt.visible = false; bar.visible = false; barBg.visible = false;
  gsap.to(tap, { alpha: 0.35, duration: 0.7, yoyo: true, repeat: -1 });
  [bgL, ambBack, bullL, ambFront, boardL, uiL].forEach((l) => (l.alpha = 0));
  const begin = async () => {
    SFX.unlock(); SFX.music("base");
    loadC.eventMode = "none";
    gsap.to(loadC, { alpha: 0, duration: 0.4, onComplete: () => loadC.destroy({ children: true }) });
    gsap.to(bgL, { alpha: 1, duration: 0.8 }); gsap.to(ambBack, { alpha: 1, duration: 1.2 }); gsap.to(ambFront, { alpha: 1, duration: 1.2 });
    gsap.fromTo(bull, { y: bl.y + bl.h + 120 }, { y: bl.y + bl.h, duration: 1.1, ease: "power3.out", delay: 0.2 });
    gsap.to(bullL, { alpha: 1, duration: 0.6, delay: 0.2 });
    gsap.fromTo(board.scale, { x: 0.92, y: 0.92 }, { x: 1, y: 1, duration: 0.8, ease: "back.out(1.6)", delay: 0.45 });
    board.pivot.set(540, 940); board.position.set(540, 940);
    gsap.to(boardL, { alpha: 1, duration: 0.5, delay: 0.45 });
    gsap.fromTo(uiL, { y: 120 }, { y: 0, duration: 0.7, ease: "power3.out", delay: 0.7 });
    gsap.to(uiL, { alpha: 1, duration: 0.5, delay: 0.7 });
    await FX.wait(1.1);
    SFX.impact(true); bullReact("big"); shake(8, 0.3);
    board.pivot.set(0, 0); board.position.set(0, 0);
    S.state = "idle";
  };
  loadC.eventMode = "static"; loadC.hitArea = new PIXI.Rectangle(0, 0, W, H); loadC.cursor = "pointer";
  loadC.once("pointertap", begin);
  if (params.has("autostart")) begin();

  // keyboard + demo hooks
  const KEYS = { "1": "win", "2": "wild", "3": "superwild", "4": "big", "5": "mega", "6": "super", "7": "epic", "8": "tease", "9": "m1000", "0": "nowin", n: "nudge4", m: "max", g: "nudgechip", h: "nudgechain", c: "clash" };
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); onSpinPress(); return; }
    if (e.key === "b" && buyUI && S.state === "idle") { buyUI.open(); return; }
    if (KEYS[e.key] && S.state === "idle") spin(KEYS[e.key]);
  });
  // taps unlock the phone's videos (iOS Low Power Mode / data saver refuse play() outside a gesture)
  if (MOBILE) ["pointerdown", "touchend", "click", "keydown"].forEach((ev) => window.addEventListener(ev, () => {
    if (mobBull) mobBull.unlock(); if (mobWild) mobWild.unlock();
  }, { capture: true, passive: true }));
  window.G = { mobBull: () => mobBull, mobWild: () => mobWild, bullView: () => ({ still: bullSpr.visible, clip: !!(bullClipC ? bullClipC.visible : clips.bull_idle), alpha: bull.worldAlpha }), spin, S, reels, colReel, Engine, clips, feature, bullSlam, bullCharge, bullOrb, bullPlay, bullDir, bullReact, buy: (k) => spin(null, k), buyUI: () => buyUI, state: () => S.state, last: null, popOpen: () => pop.visible && !!popTap, tapPop: () => popTap && popTap() };
  document.querySelectorAll("[data-force]").forEach((b) => b.addEventListener("click", () => { SFX.unlock(); if (S.state === "idle") spin(b.dataset.force); }));
  document.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => { SFX.unlock(); if (S.state === "idle") spin(null, b.dataset.buy); }));
})().catch((e) => {
  console.error(e);
  if (window.G && window.G.state && window.G.state() !== "boot") return;        // a late error must not cover a running game
  const d = document.createElement("div");
  d.style.cssText = "position:fixed;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;background:#12060a;color:#ffe6b0;font:600 20px/1.4 system-ui,sans-serif;text-align:center;padding:24px";
  d.innerHTML = '<div>The game could not load.<br>Please check your connection and try again.</div>';
  const b = document.createElement("button"); b.textContent = "RELOAD";
  b.style.cssText = "font:700 20px system-ui,sans-serif;color:#2a0c04;background:linear-gradient(#fff2c4,#fbc460 45%,#ce7422);border:0;border-radius:28px;padding:14px 44px;cursor:pointer";
  b.onclick = () => location.reload();
  d.appendChild(b); document.body.appendChild(d);
});
