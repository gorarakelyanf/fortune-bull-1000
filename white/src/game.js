// Fortune Bull 1000 - runtime (PixiJS 7 + GSAP). Board space is 1080x1920 (prod/Cut manifest, 1x).
(async function () {
  "use strict";
  const W = 1080, H = 1920;
  const REEL_X = [[39, 296.7], [303.7, 561.3], [568.3, 826]];
  const REEL_CX = REEL_X.map(([a, b]) => (a + b) / 2);
  let CELL_Y0 = 613, CELL_H = 215, WIN_Y1 = CELL_Y0 + 3 * CELL_H;     // the stone pass re-spaces these (GRID_STONE below)
  const rowY = (r) => CELL_Y0 + (r + 0.5) * CELL_H;
  // 7 visible 16:9 chips, 92 px apart (user 2026-11-10, white version), filling the tray; the centre one is the paying slot
  const COL_CX = 944, COL_Y0 = 659.5, COL_P = 92, TRAY = [849, 614, 1039, 1257];
  const COL_CY = COL_Y0 + 3 * COL_P;
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
  // Garuda-standard pass (2026-11-10, research/ref_client_fg1000/DESIGN_ANALYSIS.md): dark recessed reel bed and a
  // stone tile under the low pays. ?nog = the board without this pass (comparison); the V3 art set keeps its own board.
  const GPASS = false;   // FROZEN white-board copy (bull_god_garuda/game_white): the Garuda stone pass is off here;       // also: losing cells dim to 80% (Garuda ~85%), was 65%
  const LOW_T = new Set(["A", "K", "Q", "J"]);
  // stone pass grid (user 2026-11-11: every gap equal): the frame's inner box is x 42..825, y 612..1254; tiles 245 x 198
  // with exactly 12 px between tiles and between the tiles and the frame. Symbol art (made for 252 x 202 plates) is drawn
  // at SYM_SX x SYM_SY by each view's outer container.
  // user 2026-11-11 (later): gaps far smaller, 12 -> 4 px; the tiles grow to fill the same inner box
  const GRID_G = 4, TILE_W = (783 - 4 * GRID_G) / 3, TILE_H = (642 - 4 * GRID_G) / 3, SYM_SX = TILE_W / 252, SYM_SY = TILE_H / 202;
  if (GPASS) {
    const w = TILE_W, px = w + GRID_G, x0 = 42 + GRID_G + w / 2;
    [0, 1, 2].forEach((i) => { const cx = x0 + i * px; REEL_X[i] = [cx - px / 2, cx + px / 2]; REEL_CX[i] = cx; });
    CELL_H = TILE_H + GRID_G; CELL_Y0 = 612 + GRID_G / 2; WIN_Y1 = CELL_Y0 + 3 * CELL_H;
  }
  const LABEL_K = 0.85;                                 // multiplier numerals on the coins, a bit smaller (user 2026-11-11)
  const NUDGE_K = 0.66;                                 // the square NUDGE plate shrinks to sit inside the coin-sized centre frame
  const COINS = GPASS;
  const HALO_MIN = +(params.get("halomin") || 100);       // halo wheel on throws of this multiplier and up (?halomin=5 to see it often)                                 // round multiplier coins (gap #2); NUDGE keeps its square plate
  // ?mobile = the phone build: one shared bull video + one shared wild video (src/segvideo.js), a still bull whenever the
  // video is not really playing, taps unlock video, steady video speed, no edge smoothing, lighter effects
  const MOBILE = params.has("mobile");
  const BASE_TS = +(params.get("ts") || 1);          // ?ts=0.1 = slow motion (QA video capture)
  gsap.globalTimeline.timeScale(BASE_TS);

  // ---------- app ----------
  const app = new PIXI.Application({ backgroundColor: 0x000000, antialias: !MOBILE, autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2), resizeTo: window });
  document.getElementById("wrap").appendChild(app.view);
  PIXI.Filter.defaultResolution = app.renderer.resolution;   // filters (keyed clips, chips) as sharp as the screen
  // ?fps: a small frame-rate readout (average and slowest frame over the last half second), to check a phone
  if (params.has("fps")) {
    const el = document.createElement("div");
    el.style.cssText = "position:fixed;right:6px;top:6px;z-index:20;font:600 12px/1.3 system-ui,sans-serif;color:#9f9;background:rgba(0,0,0,.6);padding:3px 6px;border-radius:6px;pointer-events:none";
    document.body.appendChild(el);
    let n = 0, worst = 0, t0 = performance.now(), last = t0;
    const loop = (t) => { n++; worst = Math.max(worst, t - last); last = t;
      if (t - t0 > 500) { el.textContent = `${Math.round((n * 1000) / (t - t0))} fps  slowest ${Math.round(worst)} ms  x${app.renderer.resolution}`; n = 0; worst = 0; t0 = t; }
      requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
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
  for (const n of Object.keys(clipList)) if (n.startsWith("super_wild_")) delete clipList[n];   // white: the new SUPER WILD art has no video
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
      for (const id of ["wild"]) {                                  // white: no video for the new SUPER WILD
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
  ["title_big", "title_mega", "title_super", "title_epic", "title_max", "wp_medallion_gold", "wp_medallion_tint", "wp_banner_gold", "wp_banner_tint", "wp_tablet_gold", "wp_tablet_tint"].forEach((n) => files.push(`assets/Popup/${n}.webp`));
  ["chip_coat", "chip_glints", "chip_rim", "chip_shadow"].forEach((n) => add("Multipliers/" + n));
  ["Multipliers/centre_frame", "UI/nudge_box", "UI/total_box", "UI/counter_screen", "UI/total_plate", "UI/cf_arrow", "vfx/winline", "vfx/winline_rest", "UI/exp_panel", "UI/exp_card_red", "UI/exp_card_amber", "UI/exp_card_purple", "UI/exp_confirm", "UI/buy_label", "UI/ex_plate", "UI/charge_badge", "UI/charge_window", "UI/charge_chev", "UI/charge_digit_0", "UI/charge_digit_1", "UI/charge_digit_2", "UI/charge_digit_3", "UI/charge_digit_4", "UI/charge_digit_5", "UI/charge_digit_6", "UI/charge_digit_7", "UI/charge_digit_8", "UI/charge_digit_9", "UI/ex_switch_off", "UI/ex_switch_on"].forEach((p) => files.push(`assets/${p}.webp`));   // every art set uses these
  if (GPASS) ["Board/panel_dark", "Board/tile_low", "Board/tile_low_blur", "Board/tray_dark", "Board/plinth_slim", "Board/plinth_fade", "Board/frame_stone"].forEach((p) => files.push(`assets/${p}.webp`));
  if (COINS) { Engine.MULT_VALUES.forEach((v) => files.push(`assets/Multipliers/coin_${v}.webp`)); ["coin_shadow", "coin_rim", "centre_frame_thin"].forEach((n) => files.push(`assets/Multipliers/${n}.webp`)); }
  ["autoplay", "autoplay_shadow", "balance_bar_border", "balance_bar_fill", "bet_window_border", "bet_window_fill",
    "ex_button", "ex_shadow", "icon_menu", "icon_sound", "minus", "minus_shadow", "plus", "plus_shadow", "spin_arrows",
    "spin_base", "spin_glow", "spin_shadow", "turbo", "turbo_shadow", "win_bar"].forEach((n) => add("UI/" + n));
  const NO_ART = params.has("codefx");                 // ?codefx = the old code-drawn effects, for comparison
  if (!NO_ART) FX.ART.filter((n) => n !== "magic_sheet" && n !== "fire_strip").forEach((n) => files.push(`assets/vfx/${n}.webp`));   // white: the hand is the orb shader, no fire strip
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
  // white: the bull's key also trims the 1 px rim of green-stained pixels (a dark olive outline round the fingers,
  // plain to see over the bright orb): a pixel only stays as solid as its least solid neighbour one pixel away
  const KEY_EDGE_FRAG = `
    varying vec2 vTextureCoord; uniform sampler2D uSampler; uniform vec4 inputPixel;
    float keyA(vec2 uv){ vec4 c = texture2D(uSampler, uv); vec3 rgb = c.a > 0.001 ? c.rgb / c.a : vec3(0.0);
      return (1.0 - clamp((rgb.g - max(rgb.r, rgb.b) - 0.06) / 0.22, 0.0, 1.0)) * c.a; }
    void main(){ vec4 c = texture2D(uSampler, vTextureCoord);
      vec3 rgb = c.a > 0.001 ? c.rgb / c.a : vec3(0.0);
      float g = rgb.g - max(rgb.r, rgb.b);
      float a = (1.0 - clamp((g - 0.06) / 0.22, 0.0, 1.0)) * c.a;
      vec2 px = inputPixel.zw * 1.25;
      float n = min(min(keyA(vTextureCoord + vec2(px.x, 0.0)), keyA(vTextureCoord - vec2(px.x, 0.0))),
                    min(keyA(vTextureCoord + vec2(0.0, px.y)), keyA(vTextureCoord - vec2(0.0, px.y))));
      a *= n;
      rgb.g = min(rgb.g, max(rgb.r * 0.92, rgb.b));
      gl_FragColor = vec4(rgb * a, a); }`;
  const keyFilterEdge = MOBILE ? keyFilter : new PIXI.Filter(undefined, KEY_EDGE_FRAG);
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
    if (c.key === "green") sp.filters = [/^bull/.test(name) ? keyFilterEdge : keyFilter];
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
  if (GPASS) {
    // value grade (Garuda: the darkest values at the screen edges, the hero the brightest thing in his zone):
    // the hall darkens toward the top and the sides, an open ellipse stays round the bull's head and chest
    const c = document.createElement("canvas"); c.width = 270; c.height = 480; const g = c.getContext("2d");
    const rg = g.createRadialGradient(135, 96, 16, 135, 96, 160);
    rg.addColorStop(0, "rgba(14,6,10,0)"); rg.addColorStop(0.42, "rgba(14,6,10,0.12)"); rg.addColorStop(1, "rgba(14,6,10,0.74)");
    g.fillStyle = rg; g.fillRect(0, 0, 270, 160);
    const lg = g.createLinearGradient(0, 0, 0, 160);
    lg.addColorStop(0, "rgba(10,4,12,0.35)"); lg.addColorStop(0.35, "rgba(10,4,12,0)");
    g.fillStyle = lg; g.fillRect(0, 0, 270, 160);
    const bot = g.createLinearGradient(0, 300, 0, 480);
    bot.addColorStop(0, "rgba(12,6,6,0)"); bot.addColorStop(1, "rgba(12,6,6,0.30)");
    g.fillStyle = bot; g.fillRect(0, 300, 270, 180);
    const grade = new PIXI.Sprite(PIXI.Texture.from(c)); grade.scale.set(W / 270, H / 480);
    bgL.addChild(grade);
  }
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
  // vbet keeps its own top bar on screen: the bull is drawn a bit smaller, scaled about the board top, so the horns
  // get headroom. A wrapper keeps bull.scale free for the breathing/lunge tweens. ?bullk=1 = the old size.
  const BULL_K = +(params.get("bullk") || 0.86), BULL_P = { x: bl.x + bl.w / 2, y: 595 };
  const bullFit = new PIXI.Container(); bullFit.pivot.set(BULL_P.x, BULL_P.y); bullFit.position.set(BULL_P.x, BULL_P.y);
  bullFit.scale.set(BULL_K); bullFit.addChild(bull); bullL.addChild(bullFit);
  const bullToL = (x, y) => [BULL_P.x + (x - BULL_P.x) * BULL_K, BULL_P.y + (y - BULL_P.y) * BULL_K];   // bull coords -> layer
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
    ambBack.addChild(c); c.visible = false;   // white: no vase fires (painted ones removed from the BG too)
    return { c, glow, tongues, x: f.x, y: f.y };
  });
  const ambP = new FX.Particles(ambBack);
  const dust = new FX.Particles(ambFront);

  // board
  const winBar = new PIXI.Sprite(T("UI/win_bar")); winBar.position.set(L("win_bar").x, L("win_bar").y);
  if (GPASS) { winBar.texture = T("Board/plinth_fade"); winBar.position.set((W - winBar.texture.width) / 2, 1295); }   // slim win ledge whose ends fade into the stairs     // bronze win ledge under the board (gap #6)
  const panel = new PIXI.Sprite(T(GPASS ? "Board/panel_dark" : "Board/panel_reels")); panel.position.set(L("panel_reels").x, L("panel_reels").y);
  const tray = new PIXI.Sprite(T(COINS ? "Board/tray_dark" : "Board/mult_tray")); tray.position.set(L("mult_tray").x, L("mult_tray").y);
  const colBack = new PIXI.Container(), cellFxBack = new PIXI.Container(), frameL = new PIXI.Container(),
    reelsL = new PIXI.Container(), colFront = new PIXI.Container(), boardFx = new PIXI.Container(), plaqueL = new PIXI.Container();
  const board = new PIXI.Container();
  board.addChild(winBar, panel, tray, colBack, cellFxBack, frameL, reelsL, colFront, boardFx, plaqueL);
  boardL.addChild(board);
  const frame = new PIXI.Sprite(T(GPASS ? "Board/frame_stone" : "Board/frame")); frame.position.set(0, 585);   // stone: no rails between the reels
  frameL.addChild(frame);
  const frameTop = new PIXI.Sprite(new PIXI.Texture(frame.texture.baseTexture, new PIXI.Rectangle(frame.texture.frame.x, frame.texture.frame.y, frame.texture.frame.width, 28)));
  frameTop.position.set(0, 585); board.addChildAt(frameTop, board.getChildIndex(reelsL) + 1);   // white: the top edge stays over the symbols
  // (the FORTUNE BULL 1000 title lintel over the reels was removed on 2026-11-11 at the user's request; ctx.TITLE = false)
  // soft gold rim around the centre (paying) multiplier slot: over the chip backs, under the chip labels
  let centreFrame = new PIXI.Sprite(T("Multipliers/centre_frame")); centreFrame.anchor.set(0.5); centreFrame.position.set(COL_CX, COL_CY);
  // stone pass: the white version's thin gold frame (user 2026-11-11), later taller and narrower so the whole coin sits
  // inside it: a nine-slice plane, so the rim keeps one thickness. Visible box CF_W x CF_H; the texture has 10 px padding.
  if (COINS) {
    const CF_W = 194, CF_H = 148, CF_S = 0.85, lw = CF_W / CF_S + 20, lh = CF_H / CF_S + 20;
    centreFrame = new PIXI.NineSlicePlane(T("Multipliers/centre_frame_thin"), 30, 30, 30, 30);
    centreFrame.width = lw; centreFrame.height = lh; centreFrame.pivot.set(lw / 2, lh / 2);
    centreFrame.scale.set(CF_S); centreFrame.position.set(COL_CX, COL_CY);
  }
  frameL.addChild(centreFrame);
  function cfArrowTex() {                                 // white: gold arrowhead, straight back, lit top / shaded bottom (2x)
    if (cfArrowTex.t) return cfArrowTex.t;
    const c = document.createElement("canvas"); c.width = 68; c.height = 48; const g = c.getContext("2d");
    const top = g.createLinearGradient(0, 0, 0, 24); top.addColorStop(0, "#fff6c8"); top.addColorStop(1, "#f6c64c");
    const bot = g.createLinearGradient(0, 24, 0, 48); bot.addColorStop(0, "#d8901e"); bot.addColorStop(1, "#8c4c0a");
    g.beginPath(); g.moveTo(0, 2); g.lineTo(66, 24); g.lineTo(0, 24); g.closePath(); g.fillStyle = top; g.fill();
    g.beginPath(); g.moveTo(0, 24); g.lineTo(66, 24); g.lineTo(0, 46); g.closePath(); g.fillStyle = bot; g.fill();
    g.lineWidth = 2; g.lineJoin = "round"; g.strokeStyle = "rgba(92,40,4,0.9)"; g.beginPath(); g.moveTo(0, 2); g.lineTo(66, 24); g.lineTo(0, 46); g.stroke();
    return (cfArrowTex.t = PIXI.Texture.from(c));
  }
  const cfArrows = [-1, 1].map((side) => {
    const a = new PIXI.Sprite(cfArrowTex()); a.anchor.set(0, 0.5); a.scale.set(-side * 0.5, 0.5);   // the left one points right; base = x 0
    a.position.set(COL_CX + side * 92, COL_CY); a.x0 = a.x; a.dir = -side; return a;
  });
  function cfKnock(px) { cfArrows.forEach((g) => gsap.fromTo(g, { x: g.x0 }, { x: g.x0 + g.dir * (px || 7), duration: 0.07, yoyo: true, repeat: 1, ease: "power1.out" })); }
  // molten frame (user 2026-11-11: "design this frame as well"): drawn by a shader (vfx.js VFX.moltenFrame) in the
  // gold frame art's exact shape: lit gold rims, flowing molten channel, two running sparks, heat halo, small flames
  centreFrame.visible = false;
  const cfFx = VFX.moltenFrame(frameL, { x: COL_CX, y: COL_CY, w: 195, h: 117, r: 15, band: 13, ri: 7 });
  cfArrows.forEach((a) => frameL.addChildAt(a, frameL.getChildIndex(cfFx.mesh)));   // white: under the frame, only the point shows
  app.ticker.add(() => {                                  // hotter while the column teases; flashes when the arrows knock
    cfFx.power = 1 + (colTease.visible ? 1.2 * colTease.heat : 0);
    if (Math.abs(cfArrows[0].x - cfArrows[0].x0) > 2) cfFx.flash = Math.max(cfFx.flash, 0.8); });
  // frame light sweep, masked by the frame's own alpha
  const frameMask = new PIXI.Sprite(frame.texture); frameMask.position.set(0, 585);
  const frameShine = new PIXI.Sprite(FX.tex.shine);
  frameShine.anchor.set(0.5); frameShine.scale.set(1.4, 40); frameShine.rotation = 0.5;
  frameShine.blendMode = PIXI.BLEND_MODES.ADD; frameShine.alpha = 0.7; frameShine.x = -400; frameShine.y = 940;
  frameL.addChild(frameMask, frameShine); frameShine.mask = frameMask; frameShine.visible = false;   // shown only while it sweeps
  const frameGlow = new PIXI.Graphics();
  frameL.addChild(frameGlow);
  const boardP = new FX.Particles(boardFx);
  const topP = new FX.Particles(fxTop);

  // ---------- symbol + chip views ----------
  const swPick = () => { const w = Engine.SW_CHARGES || { 2: 1 }; let t = 0; for (const k in w) t += w[k]; let x = Math.random() * t;
    for (const k in w) { x -= w[k]; if (x < 0) return +k; } return 2; };   // white: display-only count for a SUPER WILD that passes by
  const SW_PLATE = { x: 0, y: 72 }, SW_LIVE_COUNT = true;    // the real count (Engine.NUDGES) on the plate; user 2026-11-11: "numbers according to logic";          // white: centre of the SUPER WILD's count plate, px from the symbol centre
  class SymView {
    constructor(parent, cx) {
      this.c = new PIXI.Container(); this.c.x = cx; if (GPASS) this.c.scale.set(SYM_SX, SYM_SY);
      this.inner = new PIXI.Container();
      this.a = new PIXI.Sprite(); this.b = new PIXI.Sprite();
      this.a.anchor.set(0.5); this.b.anchor.set(0.5);
      this.fire = new PIXI.Sprite(FX.tex.glow); this.fire.anchor.set(0.5); this.fire.scale.set(1.6, 1.4);
      this.fire.tint = 0xff6a10; this.fire.blendMode = PIXI.BLEND_MODES.ADD; this.fire.visible = false;
      this.inner.addChild(this.fire, this.a, this.b); this.c.addChild(this.inner);
      this.cnt = new PIXI.Text(`${Engine.NUDGES}/${Engine.NUDGES}`, FX.gold(40, { stroke: "#4a0505", strokeThickness: 5, dropShadowDistance: 1.5, dropShadowBlur: 2, padding: 6 }));
      this.cnt.anchor.set(0.5); this.cnt.position.set(SW_PLATE.x, SW_PLATE.y); this.cnt.visible = false; this.inner.addChild(this.cnt);
      // white: the CHARGE symbol's window shows its landed count (the badge x0.9 on the symbol; window centre 0.5, -31.4)
      this.chg = new PIXI.Container(); this.chg.position.set(0.5, -31.4); this.chg.visible = false; this.inner.addChild(this.chg);
      this.chgWin = new PIXI.Sprite(T("UI/charge_window")); this.chgWin.anchor.set(0.5); this.chgWin.scale.set(0.9);
      this.chgNum = new PIXI.Container(); this.chg.addChild(this.chgWin, this.chgNum);   // white: live count on the plate
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
      } else if (GPASS && LOW_T.has(id)) {           // low pay: letter on its own stone tile (tile = a, letter = b)
        this.a.texture = T(blur ? "Board/tile_low_blur" : "Board/tile_low");
        this.b.texture = T(`Symbols/${id}${blur ? "_blur" : ""}`); this.b.visible = true; this.b.scale.set(1);
      } else { this.a.texture = T(`Symbols/${id}${blur ? "_blur" : ""}`); this.b.visible = false; }
      if (this.lab) {
        const w = Engine.WILDS.has(id);
        this.lab.visible = w && !blur;
        if (w) { const sup = id === "super_wild"; this.lab.text = sup ? "SUPER\nWILD" : "WILD";
          this.lab.style.fontSize = sup ? 30 : 40; this.lab.y = sup ? V2_LAB.super : V2_LAB.wild; }
      }
      this.cnt.visible = SW_LIVE_COUNT && id === "super_wild" && !blur; this.chg.visible = false; this.chg.scale.set(1);
      if (this.cnt.visible) { this.cnt.text = String(swPick()); this.cnt.scale.set(1); }   // white: a passing SUPER WILD shows a random count
      this.dim(0);
    }
    showCharge(n) {                                     // white: the landed CHARGE symbol's count in its window
      this.chgNum.removeChildren().forEach((c) => c.destroy());
      const sps = String(n).split("").map((d) => { const sp = new PIXI.Sprite(T("UI/charge_digit_" + d)); sp.anchor.set(0.5); sp.scale.set(0.38); return sp; });
      const step = (sp) => sp.width * 0.84; let x = -sps.reduce((acc, sp) => acc + step(sp), 0) / 2;
      sps.forEach((sp) => { sp.x = x + step(sp) / 2; x += step(sp); this.chgNum.addChild(sp); });
      this.chg.visible = true;
    }
    dim(k) { const g = Math.round(255 * (1 - (GPASS ? 0.8 : 0.65) * k)); const t = (g << 16) | (g << 8) | g; this.a.tint = t; this.b.tint = t; if (this.lab) this.lab.tint = t; if (this.cnt) this.cnt.tint = t; if (this.chg) { this.chgWin.tint = t; this.chgNum.children.forEach((sp) => (sp.tint = t)); } }
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
  // white: the CHARGE badge in the chip box (badge art 262 x 256 px; its window centre and size in badge px)
  const CB = { k: 0.57, wx: 0.6, wy: -34.9, ww: 137.6, wh: 82.8, dk: 0.42 };
  // WHITE VERSION (user 2026-11-11: "multiplier chips equal or upper 25 should have a glowing or burning frame so they will
  // be visible during the scroll"): a soft fire glow behind the chip and a hot rim line over it, tinted per value
  const HOT_COL = { 25: 0xff7a14, 50: 0xff5a10, 100: 0xff3a10, 200: 0xff4a0c, 500: 0xff6a08, 1000: 0xffa020 };
  const hotChips = [];
  const hotTex = (() => { let tx = null; return () => {
    if (tx) return tx;
    const mk = (fn) => { const cv = document.createElement("canvas"); cv.width = 300; cv.height = 240; fn(cv.getContext("2d")); return PIXI.Texture.from(cv); };
    const rr = (g, w, h, r) => { const x = 150 - w / 2, y = 120 - h / 2; g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const glow = mk((g) => { g.shadowColor = "#ffffff";
      for (const [b, lw, a] of [[40, 14, 1], [40, 14, 1], [24, 10, 1], [24, 10, 1], [10, 6, 1]]) { g.shadowBlur = b; g.lineWidth = lw; g.strokeStyle = `rgba(255,255,255,${a})`; rr(g, 184, 127, 22); g.stroke(); } });
    const rim = mk((g) => { g.shadowColor = "#ffffff"; g.shadowBlur = 8; g.lineWidth = 5; g.strokeStyle = "rgba(255,255,255,1)"; rr(g, 178, 121, 19); g.stroke(); g.stroke(); });
    tx = { glow, rim }; return tx; }; })();
  app.ticker.add(() => {
    const t = performance.now() / 1000;
    hotChips.forEach((c, i) => {
      if (!c.hot.visible) return;
      const big = c.v >= 100 ? 1 : c.v >= 50 ? 0.95 : 0.9, k = c.hotK === undefined ? 1 : Math.max(0.55, c.hotK);
      const f = 0.84 + 0.1 * Math.sin(t * 7.3 + i * 1.7) + 0.06 * Math.sin(t * 19.7 + i * 0.9);
      c.hot.alpha = big * f * k; c.hot.scale.set(1 + 0.025 * Math.sin(t * 3.1 + i));
      c.hotRim.alpha = (0.75 + 0.25 * Math.sin(t * 4.7 + i * 2.1)) * k;
    });
  });
  class ChipView {
    constructor() {
      this.b = new PIXI.Container(); this.f = new PIXI.Container();
      this.b.x = this.f.x = COL_CX;
      const sp = (t) => { const s = new PIXI.Sprite(t); s.anchor.set(0.5); return s; };
      this.shadow = sp(T("Multipliers/chip_shadow")); this.bg = sp(T("Multipliers/chip_bg_1"));
      this.rim = sp(T("Multipliers/chip_rim")); this.gl = sp(T("Multipliers/chip_glints"));
      this.flash = sp(T("Multipliers/chip_glints")); this.flash.blendMode = PIXI.BLEND_MODES.ADD; this.flash.alpha = 0;
      this.b.addChild(this.shadow, this.bg, this.rim, this.gl, this.flash);
      this.hot = new PIXI.Sprite(hotTex().glow); this.hotRim = new PIXI.Sprite(hotTex().rim);
      [this.hot, this.hotRim].forEach((s) => { s.anchor.set(0.5); s.blendMode = PIXI.BLEND_MODES.ADD; s.visible = false; });
      this.b.addChildAt(this.hot, 1); this.b.addChild(this.hotRim); hotChips.push(this);
      this.magic = new PIXI.Filter(undefined, MAGIC_FRAG, { uTime: 0, uSeed: Math.random() * 10, uAmp: 1 });
      this.bg.filters = [this.magic]; magicFilters.push(this.magic);
      this.inner = new PIXI.Container();
      this.label = sp(T("Multipliers/label_1x")); this.coat = sp(T("Multipliers/chip_coat"));
      this.inner.addChild(this.label); this.f.addChild(this.inner, this.coat);
      this.gl.visible = false; this.coat.visible = false;      // 2026-11-10: no white gloss/glints on the chips (flash on hits stays)
      colBack.addChild(this.b); colFront.addChild(this.f);
      this.chargeBuild();
    }
    set(idx) { this.idx = idx; this.v = Engine.STRIP[idx]; this.bg.texture = chipBgTex(this.v);
      this.label.texture = chipLabelTex(this.v); this.inner.scale.set(1); this.dim(0); this.chargeSet(); this.hotSet();
      if (COINS) { const coin = this.v > 0;                  // round coin (white version's chip art + a thin gold rim) or the square NUDGE plate
        this.rim.texture = T(coin ? "Multipliers/coin_rim" : "Multipliers/chip_rim"); this.rim.visible = true;
        this.shadow.texture = T(coin ? "Multipliers/coin_shadow" : "Multipliers/chip_shadow");
        const k = coin ? 1 : NUDGE_K; [this.bg, this.rim, this.shadow, this.gl, this.flash].forEach((sp) => sp.scale.set(k));
        this.label.scale.set(coin ? LABEL_K : k); this.bg.filters = [this.magic]; } }
    hotSet() { const on = this.v >= 25; this.hot.visible = this.hotRim.visible = on;
      if (on) { this.hot.tint = HOT_COL[this.v] || 0xff8a20; this.hotRim.tint = this.v >= 500 ? 0xfff0b0 : 0xffd27a; } }
    // WHITE VERSION: a CHARGE chip is the user's CHARGE badge (user 2026-11-11: "this is the charge symbol we have, when
    // it gets a win we should have a number animation"; tools/charge_badge.py). At rest its window shows chevrons; when
    // it fires (nudgeChipFire: in the centre on a win, or reached by a nudge) the chevrons fly up out of the window and
    // the charge count rolls in, counting up to its number. Spliced into ChipView by tools/port_from_stone.py.
    chargeBuild() {
      const cs = (t) => { const s = new PIXI.Sprite(T(t)); s.anchor.set(0.5); return s; };
      this.cb = new PIXI.Container(); this.cb.visible = false; this.cb.scale.set(CB.k); this.inner.addChild(this.cb);
      this.cbBadge = cs("UI/charge_badge");
      this.cbWin = new PIXI.Container(); this.cbWin.position.set(CB.wx, CB.wy); this.cbWin.visible = false;
      this.cbChev = cs("UI/charge_chev"); this.cbNum = new PIXI.Container();
      const m = new PIXI.Graphics().beginFill(0xffffff).drawRect(-CB.ww / 2, -CB.wh / 2, CB.ww, CB.wh).endFill();
      this.cbWin.addChild(cs("UI/charge_window"), this.cbChev, this.cbNum, m); this.cbWin.mask = m;
      this.cbGlow = cs("UI/charge_window"); this.cbGlow.position.set(CB.wx, CB.wy); this.cbGlow.blendMode = PIXI.BLEND_MODES.ADD; this.cbGlow.alpha = 0;
      this.cbHalo = new PIXI.Sprite(FX.tex.glow); this.cbHalo.anchor.set(0.5); this.cbHalo.tint = 0xb050ff; this.cbHalo.blendMode = PIXI.BLEND_MODES.ADD;
      this.cbHalo.scale.set(300 / this.cbHalo.texture.width); this.cbHalo.alpha = 0.55;                            // a soft purple glow: it pops on the dark tray
      this.cb.addChild(this.cbHalo, this.cbBadge, this.cbWin, this.cbGlow);
    }
    chargeSet() {
      const ch = this.v < 0;
      this.cb.visible = ch; this.cbWin.visible = false; this.cbGlow.alpha = 0;
      gsap.killTweensOf(this.cbChev); gsap.killTweensOf(this.cbNum); gsap.killTweensOf(this.cbNum.scale);
      [this.bg, this.rim, this.shadow].forEach((s) => (s.renderable = !ch)); this.label.visible = !ch;
    }
    chargeDigits(n) {
      this.cbNum.removeChildren().forEach((c) => c.destroy());
      const sps = String(n).split("").map((d) => { const s = new PIXI.Sprite(T("UI/charge_digit_" + d)); s.anchor.set(0.5); s.scale.set(CB.dk); return s; });
      const step = (s) => s.width * 0.84;
      let x = -sps.reduce((a, s) => a + step(s), 0) / 2;
      sps.forEach((s) => { s.x = x + step(s) / 2; x += step(s); this.cbNum.addChild(s); });
    }
    reveal(n) {
      if (!this.cb.visible) return Promise.resolve();
      this.cbWin.visible = true; this.cbChev.y = 0; this.cbChev.alpha = 1;
      this.chargeDigits(1); this.cbNum.y = CB.wh; this.cbNum.scale.set(1);
      const cnt = { v: 1 }; let shown = 1;
      return new Promise((res) => {
        gsap.timeline({ onComplete: res })
          .to(this.cbChev, { y: -CB.wh, alpha: 0.6, duration: 0.26, ease: "power2.in" })                   // chevrons fly up
          .fromTo(this.cbGlow, { alpha: 0.9 }, { alpha: 0, duration: 0.5 }, 0)
          .to(this.cbNum, { y: 0, duration: 0.34, ease: "back.out(2)" }, 0.12)                              // the count rolls in
          .to(cnt, { v: n, duration: Math.min(1.4, 0.12 * Math.max(0, n - 1)), ease: "none", onUpdate: () => {
            const k = Math.round(cnt.v); if (k !== shown) { shown = k; this.chargeDigits(k); gsap.fromTo(this.cbNum.scale, { x: 1.25, y: 1.25 }, { x: 1, y: 1, duration: 0.11 }); }
          } }, 0.4)
          .fromTo(this.cbNum.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.32, ease: "back.out(3)" })
          .fromTo(this.cbGlow, { alpha: 0.75 }, { alpha: 0, duration: 0.45 }, "<");
      });
    }
    setY(y) { this.b.y = this.f.y = y;
      const s = chipFit(Math.abs(y - COL_CY) / COL_P); this.b.scale.set(s.bx, s.by); this.f.scale.set(s.l); }
    dim(k) { const g = Math.round(255 * (1 - 0.55 * k)); const t = (g << 16) | (g << 8) | g;
      [this.bg, this.rim, this.label, this.gl].forEach((s) => (s.tint = t)); if (this.cbBadge) this.cbBadge.tint = t; this.hotK = 1 - 0.75 * k; }
    set visible(v) { this.b.visible = this.f.visible = v; }
  }

  // white version: off-centre chips are small 16:9, a chip grows into the centre frame (d = distance in pitches)
  const CHIP_BIG = { bx: 1, by: 0.823, l: 0.9 }, CHIP_SMALL = { bx: 0.833, by: 0.686, l: 0.74 };
  function chipFit(d) {
    const t = Math.min(1, Math.max(0, d)), k = 1 - t * t * (3 - 2 * t);
    const m = (a, b) => a + (b - a) * k;
    return { bx: m(CHIP_SMALL.bx, CHIP_BIG.bx), by: m(CHIP_SMALL.by, CHIP_BIG.by), l: m(CHIP_SMALL.l, CHIP_BIG.l) };
  }
  function chipBgTex(v) { return COINS && v > 0 ? T(`Multipliers/coin_${v}`) : T(`Multipliers/chip_bg_${v < 0 ? (V2ART && v === -5 ? "nudge5" : "nudge") : v}`); }
  function chipLabelTex(v) { return T(`Multipliers/label_${v < 0 ? "nudge" + (v === -3 ? 3 : 5) : v + "x"}`); }

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
    if (o.ring) {
      // the whole frame burns (user 2026-11-10): a wall of upward flames up both sides, leaning out a little, and low
      // flames licking up along the bottom bar. Fewer sprites on the phone build.
      const st = MOBILE ? 66 : 46;
      run(y0 + 40, y1 - 4, st, (y) => {
        for (const [x, d] of [[x0 + 10, -1], [x1 - 10, 1]]) {
          flame(x, y, pad * (1.1 + Math.random() * 0.8), d * (0.16 + Math.random() * 0.14));
          if (Math.random() < 0.5) flame(x + d * 12, y + 16, pad * 0.65, d * 0.32, true);
        }
      });
      run(x0 + 40, x1 - 40, MOBILE ? 84 : 56, (x) => flame(x, y1 - 2, pad * (0.55 + Math.random() * 0.35), (Math.random() - 0.5) * 0.2));
    } else if (big) run(y0 + 60, y1 - 40, 120, (y) => { flame(x0 + 6, y, pad * (0.6 + Math.random() * 0.4), -1.2); flame(x1 - 6, y, pad * (0.6 + Math.random() * 0.4), 1.2); });
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
      const go = () => { if (this.state === "lift") { this.state = "spin"; this.speed = this.vmax; } };   // white (Garuda): no lift, full speed at once
      if (this.spinDim) this.views.forEach((v) => v.dim(this.spinDim));
      if (delay) gsap.delayedCall(delay, go); else go();
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
      if (this.spinDim) v.dim(this.spinDim);                // white (Garuda): a spinning reel is darker
      if (this.queue && this.queue.length === 0) this.queue = null;
    }
    // decelerating stop: the final symbols are queued and scroll in over exactly queue.length - offset cells
    stop(final, fast) {
      return new Promise((res) => {
        this._res = res;
        if (this.state === "lift") { gsap.killTweensOf(this); if (this.offset < 0) this.offset = 0; }
        this.queue = final.slice().reverse().concat([this.above ? this.above(final[0]) : this.rand()]);
        this.state = "decel"; this._dropped = false;
        const dur = fast ? this.stopFast : this.stopDur, D = this.queue.length - this.offset;
        const base = this.offset, tr = { p: 0 };
        let shifts = 0, landed = false, lastP = 0, lastT = gsap.globalTimeline.time();
        // white (Garuda): at full speed onto the target, on 1/8 cell (0.086 s), back (0.19 s); turbo a little tighter
        const v0 = Math.max(6, this.speed || this.vmax), OV = fast ? 0.09 : 0.125, TL = D / v0, T1 = fast ? 0.06 : 0.086, T2 = fast ? 0.13 : 0.19, TT = TL + T1 + T2;
        const gEase = (x) => { const t = x * TT; return (t < TL ? v0 * t : t < TL + T1 ? D + OV * (t - TL) / T1 : D + OV * Math.max(0, 1 - (t - TL - T1) / T2)) / D; };
        gsap.to(tr, { p: D, duration: TT, ease: gEase, onUpdate: () => {
          const pos = base + tr.p;
          while (pos - shifts >= 1 && this.queue && this.queue.length) { this.offset -= 1; this.shift(); shifts++; }
          this.offset = Math.max(-0.5, Math.min(0.999, pos - shifts));
          this.layout();
          const now = gsap.globalTimeline.time(), dtt = Math.max(1e-3, now - lastT);
          if (this.onSpeed) this.onSpeed(Math.abs(tr.p - lastP) / dtt);
          lastP = tr.p; lastT = now;
          if (!landed && !this.queue && tr.p >= D * 0.97) { landed = true; if (this.spinDim) this.views.forEach((v) => v.dim(0)); this.views.forEach((v, i) => { if (v.blur) v.set(this.syms[i], false); }); if (this.onLand) this.onLand(); }
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
    return new Reel({ rows: 3, pitch: CELL_H, y0: rowY(0), vmax: 28, vNormal: 28, vTurbo: 40, accel: 400, stopDur: 0.6, spinDim: 0.55, stopFast: 0.2,
      container: c, masks: [[c, m]], onExit: () => fireCurtain(r),
      make: () => new SymView(c, REEL_CX[r]),
      rand: () => { const s = Engine.SYMBOLS; const w = Engine.WEIGHTS; let t = 0; const fw = (k) => w[k] + (k === "charge" || k === "super_wild" ? 0 : 2); for (const k of s) t += fw(k); let x = Math.random() * t; for (const k of s) { x -= fw(k); if (x < 0) return k; } return "J"; } });
  });
  const colQ = [];                                   // white (spec): chips queued to slide in next (colPlan)
  const colBlur = new PIXI.BlurFilter(0, MOBILE ? 2 : 4); colBlur.blurX = 0; colBlur.blurY = 0;
  const colReel = new Reel({ rows: 7, pitch: COL_P, y0: COL_Y0, vmax: 40, vNormal: 40, vTurbo: 52, accel: 400, stopDur: 0.62, stopFast: 0.22,
    masks: [[colBack, maskRect(TRAY[0], TRAY[1], TRAY[2], TRAY[3])], [colFront, maskRect(TRAY[0] - 30, TRAY[1], TRAY[2] + 30, TRAY[3])]],
    make: () => new ChipView(), rand: () => Math.floor(Math.random() * Engine.STRIP.length),
    above: (i) => (colQ.length ? colQ.shift() : (i + 1) % Engine.STRIP.length),
    onSpeed: (s) => { const b = Math.max(0, (s - 6) * 0.6); colBlur.blurY = b; colBack.filters = colFront.filters = b > 0.5 ? [colBlur] : null; } });
  const stripAt = (c, k) => (c + k + Engine.STRIP.length * 4) % Engine.STRIP.length;
  const colIds = (c) => [4, 3, 2, 1, 0, -1, -2, -3, -4].map((k) => stripAt(c, k));

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

  const S = { balance: 10000000, betIdx: 2, ex: false, exMode: 1, turbo: false, auto: 0, state: "boot", lastWin: 0 };
  const stake = () => BETS[S.betIdx] * (S.ex ? Engine.MODES[S.exMode || 1].cost : 1);   // white (spec): the mode's debit
  const exArg = () => (S.ex ? S.exMode || 1 : 0);

  ui.autoplay = button("autoplay", ...centre("autoplay"), () => toggleAuto(), "autoplay_shadow");
  ui.turbo = button("turbo", ...centre("turbo"), () => toggleTurbo(), "turbo_shadow");
  ui.ex = button("ex_button", ...centre("ex_button"), () => exPress(), "ex_shadow");
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
  const UI_WHITE = { fill: ["#FFFFFF", "#FFFFFF", "#EDE2D2"] };   // core values white; only the "Balance:" label stays gold
  const betTxt = new PIXI.Text("", FX.gold(40, UI_WHITE)); betTxt.anchor.set(0.5); betTxt.position.set(540, 1760); uiL.addChild(betTxt);
  const exBetTag = new PIXI.Text("EX", FX.gold(20, { fill: FX.TIER_FILL.mega })); exBetTag.anchor.set(0.5); exBetTag.position.set(650, 1760);
  exBetTag.visible = false; uiL.addChild(exBetTag);
  const clockTxt = new PIXI.Text("", FX.gold(26, { ...UI_WHITE, fontFamily: "PoppinsM", fontWeight: "500" })); clockTxt.anchor.set(0, 0.5); clockTxt.position.set(48, 1864);
  const balLab = new PIXI.Text("Balance:", FX.gold(32, { fontFamily: "PoppinsM", fontWeight: "500" })); balLab.anchor.set(0, 0.5);
  const balVal = new PIXI.Text("", FX.gold(40, UI_WHITE)); balVal.anchor.set(0, 0.5);
  const balUnit = new PIXI.Text("AMD", FX.gold(24, UI_WHITE)); balUnit.anchor.set(0, 0.5);
  const demoTxt = new PIXI.Text("DEMO MODE", FX.gold(20)); demoTxt.anchor.set(0, 0.5); demoTxt.position.set(18, 1815);
  uiL.addChild(clockTxt, balLab, balVal, balUnit, demoTxt);
  // WHITE VERSION (user 2026-11-11: "we have a drop issue after reels stop, make it smoother"; qa/stop_profile.mjs: on a
  // phone-speed CPU the 0.7 s after a win spent ~110 ms re-uploading text textures - the plaque, TOTAL and balance numbers
  // redrew their gradient text every frame while rolling). A rolling number redraws at most every TXT_DT ms; the last
  // call always lands (trailing), and every draw reads the current value, so the final number is exact.
  const TXT_DT = MOBILE ? 66 : 33;
  function throttled(fn, ms) {
    let last = 0, pend = null;
    return () => {
      const n = performance.now();
      if (n - last >= ms) { last = n; if (pend) { pend.kill(); pend = null; } fn(); }
      else if (!pend) pend = gsap.delayedCall((ms - (n - last)) / 1000, () => { pend = null; last = performance.now(); fn(); });
    };
  }
  const balShown = { v: S.balance };
  function drawBalance() {
    balVal.text = FX.money(balShown.v, 0);
    const wl = balLab.width, wv = balVal.width, wu = balUnit.width;
    const x = 540 - (wl + 12 + wv + 8 + wu) / 2;
    balLab.position.set(x, 1864); balVal.position.set(x + wl + 12, 1864); balUnit.position.set(x + wl + 12 + wv + 8, 1867);
  }
  const drawBalanceT = throttled(() => drawBalance(), TXT_DT);
  function setBalance(v, animate) {
    S.balance = v;
    gsap.killTweensOf(balShown);
    if (animate) gsap.to(balShown, { v, duration: 0.8, ease: "power2.out", onUpdate: drawBalanceT });
    else { balShown.v = v; drawBalance(); }
  }
  function drawBet() {
    betTxt.text = FX.money(stake(), 0);
    exBetTag.visible = S.ex; exBetTag.text = "EX" + (S.exMode || 1); exBetTag.x = 540 + betTxt.width / 2 + 18;
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
  if (GPASS) { wb.y = 10; sep.alpha = 0; }              // text sits in the plinth's face, clear of its meander border; the plinth replaces the rules
  const totShown = { v: 0 };
  const WB_FIT = 470;                                   // widest text row on the slim win ledge (520 wide)
  function drawTotal() {
    totVal.text = FX.money(totShown.v);
    const w = totLab.width + 14 + totVal.width;
    totLab.position.set(540 - w / 2, 1374); totVal.position.set(540 - w / 2 + totLab.width + 14, 1374);
    // stone pass: the row (total + its "xN" tag) shrinks to fit the narrow win ledge
    const tagW = multTag && !multTag.destroyed && wbTotal.visible ? multTag.width / (multTag.scale.x || 1) + 22 : 0;
    const k = GPASS ? Math.min(1, WB_FIT / (w + tagW)) : 1;
    const shift = GPASS ? -(tagW * k) / 2 : 0;             // total + tag are centred as one group on the ledge
    wbTotal.pivot.set(540, 1374); wbTotal.position.set(540 + shift, 1374); wbTotal.scale.set(k);
    // the round's "xN" tag sits right after the total, whatever its length
    if (tagW) { multTag.scale.set(k); multTag.position.set(540 + shift + (w / 2) * k + 22 * k + multTag.width / 2, 1374 + (GPASS ? wb.y : 0)); }
  }
  let multTag = null;
  // stone pass: the "xN" tag never hangs off the slim win ledge (x 280..800), whichever code path placed it
  if (GPASS) app.ticker.add(() => {
    if (!multTag || multTag.destroyed || !multTag.visible || multTag.y < 1290) return;
    const half = multTag.width / 2, xMax = 800 - 10 - half;
    if (multTag.x > xMax) multTag.x = xMax;
  });
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
    const k = GPASS ? Math.min(1, WB_FIT / w) : 1; wbLine.pivot.set(540, 1318); wbLine.position.set(540, 1318); wbLine.scale.set(k);
  }
  const drawTotalT = throttled(() => drawTotal(), TXT_DT);
  function showTotal(v, dur) {
    msgTxt.visible = false; wbTotal.visible = !plaque.visible; sep.visible = true;
    gsap.killTweensOf(totShown);
    if (dur && Math.abs(totShown.v - v) < 1e-6) { drawTotal(); return Promise.resolve(); }   // already there (the plaque drove it)
    if (dur) return FX.tween(totShown, { v, duration: dur, ease: "power1.out", onUpdate: () => { drawTotalT(); if (Math.random() < 0.4) SFX.tick(); } });
    totShown.v = v; drawTotal();
  }
  showMsg("SPIN TO WIN");

  // ---------- state + controls ----------
  let curGrid = START.map((c) => c.slice());
  function setUiLocked(locked) {
    [ui.minus, ui.plus, ui.ex].forEach((b) => { b.alpha = locked ? 0.55 : 1; b.body.eventMode = locked ? "none" : "static"; });
    exDim(locked);
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
    S.ex = !S.ex; drawBet(); exSwitchDraw(); exModeSync();
    gsap.to(ui.ex.aura, { alpha: S.ex ? 0.55 : 0, duration: 0.3 });
    gsap.to(exRing, { alpha: S.ex ? 0.5 : 0, duration: 0.3 });
    gsap.to(exTag, { alpha: S.ex ? 1 : 0, duration: 0.3 });
    if (S.ex) { burstAt(ui.ex.x, ui.ex.y, 0xffd060, 16); SFX.wildLand(); }
    GX.emit("ex", { on: S.ex, x: ui.ex.x, y: ui.ex.y });
  }
  // WHITE VERSION: EX is an ON/OFF SWITCH and pressing it (while OFF) opens the EXTRA BET popup (user 2026-11-11: two
  // reference popups, "generate our version ... ex is a switcher that will show on or off"; then: "remove the flags,
  // make the columns narrow, remove the leafs, add the symbols in the text parts", "ex text but in a frame that is
  // connected to the switcher"). Art = Codex parts with no text (art_src/ex_popup_jobs.py -> tools/ex_popup_assets.py
  // -> assets/UI/exp_*, ex_switch_*); every word and number here is live text. Spliced in by tools/port_from_stone.py.
  // The three modes are the product spec "Fortune Guardian 1000 - Buy Bonus and Extra Bet" v1.0, all live since the
  // white engine follows it (tools/white_engine.js; user 2026-11-11: "make the popup Soon feature in EX active again",
  // "adapt the game to it"): debit 1.5x / 8x / 15x Base Bet, each mode restricts the column's multipliers and CHARGE
  // counts; wins are paid on the base bet. A rule row = [icon, text]; icons: "super", "wild", "charge", a multiplier
  // value (its chip) or null (a gold bullet).
  const MC = (m) => Engine.MODES[m].cost;
  const EX_MODES = [
    { cost: MC(1), art: "red", live: true, rows: [[3, "Multipliers are 3x or higher"], ["charge", "CHARGE counts are 2 or higher"], [null, "Wins are paid on the base bet"]] },
    { cost: MC(2), art: "amber", live: true, rows: [[15, "Multipliers are 15x or higher"], ["charge", "CHARGE counts are 5 or higher"], [null, "Wins are paid on the base bet"]] },
    { cost: MC(3), art: "purple", live: true, rows: [[50, "Multipliers are 50x or higher"], ["charge", "CHARGE counts are 10 or higher"], [null, "Wins are paid on the base bet"]] },
  ];
  // ---- the switch (replaces the round EX button's art): a pill with a name plate fused on top, "EX" written in the plate ----
  const EX_SW = 196 / 176;                                             // art is 176 x 95: plate centre y 15, pill centre y 59
  ui.ex.spr.texture = T("UI/ex_switch_off"); ui.ex.spr.scale.set(EX_SW); ui.ex.spr.y = (47.5 - 59) * EX_SW;   // the pill stays on the button's centre
  ui.ex.children[0].visible = false;                                   // the round button's shadow
  ui.ex.body.hitArea = new PIXI.RoundedRectangle(-104, -80, 208, 126, 40);
  // user 2026-11-11: "the ex should be bigger": the name plate cut out of the switch art (assets/UI/ex_plate.webp, 2x)
  // drawn 1.45x over the small one, its neck on the pill's top rim; "EX" bigger in it
  const EX_PK = 1.45, exPlate = new PIXI.Sprite(T("UI/ex_plate")); exPlate.anchor.set(0.5, 1);
  exPlate.scale.set(0.5 * EX_SW * EX_PK); exPlate.position.set(0, -40); ui.ex.body.addChild(exPlate);
  const exLabel = new PIXI.Text("EX", FX.gold(30, { strokeThickness: 5, dropShadowDistance: 1, dropShadowBlur: 1 })); exLabel.anchor.set(0.5);
  exLabel.position.set(0, -40 - exPlate.height * 0.56); ui.ex.body.addChild(exLabel);
  exTag.y = -40 - exPlate.height - 16;                              // the x1.5 BET tag sits above the bigger plate
  const exState = new PIXI.Text("OFF", FX.plain(22, "#ffe9c0", { stroke: "#2a0606", strokeThickness: 4, dropShadowDistance: 1 })); exState.anchor.set(0.5); ui.ex.body.addChild(exState);
  function exSwitchDraw() {
    ui.ex.spr.texture = T(S.ex ? "UI/ex_switch_on" : "UI/ex_switch_off");
    exTag.text = "x" + MC(S.exMode || 1) + " BET";                  // the chosen mode's debit
    exState.text = S.ex ? "ON" : "OFF"; exState.position.set(S.ex ? -34 : 36, 1); exState.style.fill = S.ex ? "#ffffff" : "#ffe9c0";
    gsap.fromTo(ui.ex.spr.scale, { x: EX_SW * 1.1, y: EX_SW * 0.92 }, { x: EX_SW, y: EX_SW, duration: 0.3, ease: "back.out(3)" });
  }
  exSwitchDraw();
  function exPress() {                                                 // ON -> switch off at once; OFF -> choose a mode first
    if (S.state !== "idle") return;
    if (S.ex) toggleEx(); else exBet.open();
  }
  // while a round runs the switch is darkened (every sprite / text tinted), never see-through
  function exDim(locked) {
    ui.ex.alpha = 1;
    const mul = (c, k) => ((Math.round(((c >> 16) & 255) * k) << 16) | (Math.round(((c >> 8) & 255) * k) << 8) | Math.round((c & 255) * k));
    const walk = (o) => { if (typeof o.tint === "number") { if (o._t0 === undefined) o._t0 = o.tint; o.tint = locked ? mul(o._t0, 0.62) : o._t0; } (o.children || []).forEach(walk); };
    walk(ui.ex);
  }
  // the engine's mode (and the column's chips) follow the switch: 0 off, else the chosen Extra Bet mode
  function exModeSync(flash) {
    const m = S.ex ? (S.exMode || 1) : 0;
    if (Engine.mode() === m && !flash) return;
    Engine.setMode(m);
    colC = Math.floor(Math.random() * Engine.STRIP.length); colReel.setSyms(colIds(colC));
    colReel.views.forEach((v) => { if (v.flash) gsap.fromTo(v.flash, { alpha: 0.8 }, { alpha: 0, duration: 0.45 }); });
    ringAt(COL_CX, COL_CY, 0xffd060, 1.6, 0.35);
  }
  // ---- the popup ----
  const exBet = (() => {
    const PW = 1010, PH = 1031, CS = 0.92, CW = 300 * CS, GAP = 16;    // panel art 1010 x 1031 (marble inside x 55..950, y 165..950)
    let root = null, sel = 0, tws = [];
    const A = (t) => { tws.push(t); return t; };
    const spr = (name, ax, ay) => { const s = new PIXI.Sprite(T(name.includes("/") ? name : "UI/" + name)); s.anchor.set(ax === undefined ? 0.5 : ax, ay === undefined ? 0.5 : ay); return s; };
    const press = (o, fn) => {
      o.eventMode = "static"; o.cursor = "pointer";
      o.on("pointerdown", () => gsap.to(o.scale, { x: o.s0 * 0.94, y: o.s0 * 0.94, duration: 0.07 }));
      const up = () => gsap.to(o.scale, { x: o.s0, y: o.s0, duration: 0.25, ease: "back.out(3)" });
      o.on("pointerup", up); o.on("pointerupoutside", up);
      o.on("pointertap", () => { SFX.click(); fn(); });
    };
    const fit = (t, w) => { if (t.width > w) t.scale.set(t.scale.x * w / t.width); return t; };
    const body = (size, color, extra) => FX.plain(size, color, Object.assign({ fontFamily: "PoppinsM", fontWeight: "500", dropShadowAlpha: 0.45 }, extra || {}));
    // the small picture in front of a rule: the real symbol / chip art, scaled down
    function icon(kind) {
      const c = new PIXI.Container();
      if (kind === "super" || kind === "wild") { const s = spr("Symbols/" + (kind === "super" ? "super_wild" : "wild")); s.scale.set(70 / s.texture.height); c.addChild(s); }
      else if (kind === null) c.addChild(new PIXI.Graphics().beginFill(0xffd36b).lineStyle(2, 0x7a3c06).drawPolygon([0, -9, 9, 0, 0, 9, -9, 0]).endFill());
      else {                                                           // a multiplier chip (16:9, like the column) or the CHARGE chip
        const ch = kind === "charge";
        const chip = new PIXI.Container();
        chip.addChild(spr("Multipliers/chip_bg_" + (ch ? "nudge" : kind)), spr("Multipliers/chip_rim"));
        const lab = spr("Multipliers/" + (ch ? "label_nudge5" : "label_" + kind + "x")); lab.scale.set(ch ? 0.8 : 0.86); chip.addChild(lab);
        chip.scale.set(0.4, 0.4 * 0.823); c.addChild(chip);
      }
      return c;
    }
    function refresh() {
      const bet = BETS[S.betIdx];
      root.betTxt.text = FX.money(bet, 0);
      root.cards.forEach((c, i) => {
        c.price.text = FX.money(bet * EX_MODES[i].cost, 0); c.price.scale.set(1); fit(c.price, 150);
        const on = i === sel && EX_MODES[i].live;
        c.ring.visible = on; c.btnTxt.text = !EX_MODES[i].live ? "Soon" : on ? "Selected" : "Select"; c.btnTxt.scale.set(1); fit(c.btnTxt, 200);
        gsap.to(c.scale, { x: on ? 1.03 : 1, y: on ? 1.03 : 1, duration: 0.2 });
      });
    }
    function card(i) {
      const m = EX_MODES[i], c = new PIXI.Container();
      const inner = new PIXI.Container(); inner.scale.set(CS); inner.position.set(-150 * CS, 0); c.addChild(inner);   // card art coords: 300 x 562
      const art = spr("exp_card_" + m.art, 0, 0); inner.addChild(art);
      const head = new PIXI.Text(`Bet ${m.cost}x`, FX.gold(38, { fontStyle: "italic", strokeThickness: 6 })); head.anchor.set(0.5); head.position.set(150, 36); fit(head, 190);
      const rules = new PIXI.Container(); let y = 96;
      m.rows.forEach(([k, txt]) => {
        const t = new PIXI.Text(txt, body(21, "#fff1dc", { wordWrap: true, wordWrapWidth: 166, lineHeight: 26 })); t.anchor.set(0, 0.5);
        const h = Math.max(62, t.height + 8), ic = icon(k);
        ic.position.set(64, y + h / 2); t.position.set(110, y + h / 2); rules.addChild(ic, t); y += h + 6;
      });
      const price = new PIXI.Text("0", FX.gold(40, { strokeThickness: 5 })); price.anchor.set(0.5); price.position.set(150, 423);
      const btn = new PIXI.Container(); btn.position.set(150, 499); btn.s0 = 1; btn.hitArea = new PIXI.Rectangle(-128, -32, 256, 64);
      const btnTxt = new PIXI.Text("Select", FX.plain(32, "#fff6e0", { stroke: "#3a0808", strokeThickness: 5, dropShadowDistance: 1 })); btnTxt.anchor.set(0.5); btn.addChild(btnTxt);
      const ring = new PIXI.Graphics().lineStyle(7, 0xfff2a8, 1).drawRoundedRect(-4, -4, 308, 570, 38).lineStyle(16, 0xffc93c, 0.3).drawRoundedRect(-9, -9, 318, 580, 42);
      inner.addChild(ring, head, rules, price, btn);
      Object.assign(c, { price, btnTxt, ring });
      if (m.live) { press(btn, () => { sel = i; refresh(); }); c.eventMode = "static"; c.on("pointertap", () => { if (sel !== i) { sel = i; refresh(); } }); }
      else {                                                           // not in the engine yet: dimmed, a lock and a SOON ribbon
        art.tint = 0x8f8f8f; head.alpha = 0.8; rules.alpha = 0.6; price.alpha = 0.6; btnTxt.alpha = 0.7;
        const lock = new PIXI.Graphics().lineStyle(9, 0xf2d48a).arc(0, -12, 20, Math.PI, 0).lineStyle(0)
          .beginFill(0xf2d48a).drawRoundedRect(-30, -12, 60, 46, 9).endFill().beginFill(0x4a1206).drawCircle(0, 8, 7).endFill();
        lock.position.set(150, 292);
        const rib = new PIXI.Graphics().beginFill(0x1c0606, 0.82).drawRoundedRect(-88, -19, 176, 38, 19).endFill().lineStyle(2, 0xf2d48a, 0.9).drawRoundedRect(-88, -19, 176, 38, 19);
        rib.position.set(150, 350);
        const soon = new PIXI.Text("COMING SOON", FX.plain(20, "#ffe2a0", { letterSpacing: 2, dropShadow: false })); soon.anchor.set(0.5); soon.position.set(150, 350);
        inner.addChild(lock, rib, soon);
      }
      return c;
    }
    function open() {
      if (root || S.state !== "idle") return;
      sel = Math.max(0, (S.exMode || 1) - 1); tws = [];
      root = new PIXI.Container(); menuL.addChild(root);
      const dim = new PIXI.Graphics().beginFill(0x000000, 0.78).drawRect(-W, -H, W * 3, H * 3).endFill(); dim.eventMode = "static";
      const pnl = new PIXI.Container(); pnl.position.set(W / 2, 915); pnl.pivot.set(PW / 2, PH / 2);
      const bg = spr("exp_panel", 0, 0); bg.eventMode = "static";
      const title = new PIXI.Text("EXTRA BET", FX.gold(66, { strokeThickness: 8 })); title.anchor.set(0.5); title.position.set(505, 106); fit(title, 620);
      const sub = new PIXI.Text("Choose a mode, then confirm", body(24, "#7a4a22", { dropShadow: false })); sub.anchor.set(0.5); sub.position.set(505, 186);
      pnl.addChild(bg, title, sub);
      root.cards = EX_MODES.map((m, i) => { const c = card(i); c.position.set(505 + (i - 1) * (CW + GAP), 208); pnl.addChild(c); return c; });
      // bet row
      const betLab = new PIXI.Text("BET", FX.plain(30, "#6a3410", { dropShadow: false, letterSpacing: 3 })); betLab.anchor.set(0.5); betLab.position.set(505, 752);
      const win = new PIXI.Graphics().beginFill(0x5a0a12).lineStyle(4, 0xf2c14e).drawRoundedRect(-112, -34, 224, 68, 18).endFill(); win.position.set(505, 808);
      root.betTxt = new PIXI.Text("", FX.gold(40, { strokeThickness: 5 })); root.betTxt.anchor.set(0.5); root.betTxt.position.set(505, 808);
      const step = (name, x, d) => { const b = spr(name); b.position.set(x, 808); b.scale.set(0.8); b.s0 = 0.8; press(b, () => { changeBet(d); refresh(); }); return b; };
      const ok = new PIXI.Container(); ok.position.set(505, 894); ok.s0 = 1;
      const okArt = spr("exp_confirm"); okArt.scale.set(0.9);
      const okTxt = new PIXI.Text("Confirm", FX.gold(46, { strokeThickness: 6 })); okTxt.anchor.set(0.5); okTxt.y = -2;
      ok.addChild(okArt, okTxt); press(ok, () => confirm());
      const x = new PIXI.Container(); x.position.set(965, 48); x.s0 = 1; x.hitArea = new PIXI.Circle(0, 0, 52); press(x, () => close());
      pnl.addChild(betLab, win, root.betTxt, step("minus", 505 - 172, -1), step("plus", 505 + 172, 1), ok, x);
      root.addChild(dim, pnl); root.pnl = pnl; root.dim = dim;
      refresh();
      dim.alpha = 0; A(gsap.to(dim, { alpha: 1, duration: 0.25 }));
      pnl.alpha = 0; pnl.scale.set(0.86);
      A(gsap.to(pnl, { alpha: 1, duration: 0.2 })); A(gsap.to(pnl.scale, { x: 1, y: 1, duration: 0.45, ease: "back.out(1.6)" }));
      root.cards.forEach((c, i) => { const y = c.y; c.y += 40; c.alpha = 0; A(gsap.to(c, { y, alpha: 1, duration: 0.35, delay: 0.1 + 0.07 * i, ease: "power2.out" })); });
    }
    function close() {
      if (!root) return;
      const r = root; root = null;
      tws.forEach((t) => t.kill()); tws = [];
      r.cards.forEach((c) => gsap.killTweensOf(c.scale));
      r.pnl.interactiveChildren = false;
      gsap.to(r, { alpha: 0, duration: 0.18, onComplete: () => r.destroy({ children: true }) });
    }
    function confirm() {
      if (!root || !EX_MODES[sel].live) return;
      close();
      S.exMode = sel + 1;                                              // the mode holds for every paid round until changed
      if (!S.ex) toggleEx(); else { drawBet(); exSwitchDraw(); exModeSync(); }
    }
    return { open, close, confirm, isOpen: () => !!root, modes: EX_MODES, select: (i) => { sel = i; if (root) refresh(); } };   // select: QA
  })();
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
    lineGfx.length = 0; for (const k of Object.keys(winCells)) delete winCells[k];
    feature(false);
    winEmitters.length = 0;
  }
  const winEmitters = [], lineGfx = [];
  // WHITE VERSION win line (user 2026-11-11: "remove this white spot, change it with a linear beautiful design during
  // the win, get the win line from Golden Tree"; then: "the win line should start to end and disappear, also if we
  // have multiple lines of wins, they need to highlight separately"). Golden Tree's gold fire bolt (its Spine line art
  // lines_animation -> assets/vfx/winline, tools/winline_asset.py) shoots along the payline, then its tail catches up
  // with the head (the two phases of its Spine path animation) and it is gone: nothing stays on the line.
  // One winning line: the bolt runs again every couple of seconds. Several: they take turns (lineFocus + linePlay), each
  // lighting only its own cells. Drawn in NORMAL blend so it stays gold on the pale reels (ADD burns out to white).
  // This file is spliced into game.js by tools/port_from_stone.py (it replaces the stone version's payline()).
  const winCells = {};                                    // cell index -> { fr } of the current win (filled by the win start)
  function lineFocus(r, i) {                              // i < 0: every winning cell lit; else only line i's three cells
    for (const key of Object.keys(winCells)) {
      const c = +key, reel = Math.floor(c / 3), row = c % 3, on = i < 0 || r.lines[i].rows[reel] === row, w = winCells[key];
      if (w && w.fr && !w.fr.destroyed) gsap.to(w.fr, { alpha: on ? 1 : 0.16, duration: 0.14, overwrite: true });
      if (w && !w.veil) {                                  // the cells of the other lines step back like the losing cells do, only lighter
        w.veil = new PIXI.Graphics().beginFill(0x000000).drawRoundedRect(...winHole(reel, row)).endFill();
        w.veil.alpha = 0; cellFxBack.addChild(w.veil); winObjs.push(w.veil);
      }
      if (w && w.veil && !w.veil.destroyed) gsap.to(w.veil, { alpha: on ? 0 : 0.42, duration: 0.14, overwrite: true });
      const v = reels[reel].view(row); if (v && v.dim) v.dim(on ? 0 : 0.5);
    }
  }
  function linePlay(r, i) { lineFocus(r, i); lineGfx.forEach((g, j) => { if (j === i) g.play(); else g.stop(); }); }
  function lineIntro(r) {                                 // right after the win lands: one line -> it repeats; several -> one pass each, in turn
    if (r.lines.length === 1) {                         // white: a lone line loops: bolt + its symbols every 2.4 s
      lineGfx[0].play(); if (lineCycle) lineCycle.kill();
      lineCycle = gsap.timeline({ repeat: -1, delay: 2.4 });
      lineCycle.call(() => { lineGfx[0].play(); r.lines[0].rows.forEach((row, reel) => cellReplay(reel * 3 + row)); }).to({}, { duration: 2.4 });
      return;
    }
    if (lineCycle) lineCycle.kill();
    lineCycle = gsap.timeline();
    r.lines.forEach((l, i) => lineCycle.call(() => linePlay(r, i), null, i * 1.05));
    lineCycle.call(() => lineFocus(r, -1), null, r.lines.length * 1.05);
  }
  function payline(rows, alpha) {
    const raw = [[REEL_X[0][0] + 2, rowY(rows[0]) + (rows[0] === rows[2] ? 0 : (rows[0] - rows[1]) * 60)]];
    rows.forEach((r, reel) => raw.push([REEL_CX[reel], rowY(r)]));
    raw.push([REEL_X[2][1] - 2, rowY(rows[2]) + (rows[0] === rows[2] ? 0 : (rows[2] - rows[1]) * 60)]);
    // the path with rounded corners, sampled finely, and its running length
    const path = [], RAD = 52;
    for (let i = 0; i < raw.length; i++) {
      const p = raw[i];
      if (i === 0 || i === raw.length - 1) { path.push(p); continue; }
      const a = raw[i - 1], b = raw[i + 1];
      const la = Math.hypot(p[0] - a[0], p[1] - a[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
      const ra = Math.min(RAD, la / 2), rb = Math.min(RAD, lb / 2);
      const p0 = [p[0] + (a[0] - p[0]) / la * ra, p[1] + (a[1] - p[1]) / la * ra], p2 = [p[0] + (b[0] - p[0]) / lb * rb, p[1] + (b[1] - p[1]) / lb * rb];
      for (let k = 0; k <= 8; k++) { const t = k / 8, u = 1 - t; path.push([u * u * p0[0] + 2 * u * t * p[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p[1] + t * t * p2[1]]); }
    }
    const cum = [0];
    for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
    const LEN = cum[cum.length - 1];
    const at = (s) => {                                   // point and unit tangent at running length s
      s = Math.max(0, Math.min(LEN, s)); let i = 1; while (i < cum.length - 1 && cum[i] < s) i++;
      const a = path[i - 1], b = path[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, f = (s - cum[i - 1]) / d;
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, (b[0] - a[0]) / d, (b[1] - a[1]) / d];
    };
    const g = new PIXI.Container(); if (alpha) g.alpha = alpha;
    // the bolt: the Golden Tree art stretched along a moving stretch of the path (thin tail behind, fire head in front)
    const N = 44, HALF = 70, st = { p: 1 };
    const verts = new Float32Array((N + 1) * 4), uvs = new Float32Array((N + 1) * 4), idx = new Uint16Array(N * 6);
    for (let i = 0; i <= N; i++) { uvs[i * 4] = uvs[i * 4 + 2] = i / N; uvs[i * 4 + 1] = 0; uvs[i * 4 + 3] = 1; }
    for (let i = 0; i < N; i++) { const o = i * 2; idx.set([o, o + 1, o + 2, o + 1, o + 3, o + 2], i * 6); }
    const geo = new PIXI.MeshGeometry(verts, uvs, idx);
    const bolt = new PIXI.Mesh(geo, new PIXI.MeshMaterial(T("vfx/winline")));
    const boltGlow = new PIXI.Mesh(geo, new PIXI.MeshMaterial(T("vfx/winline"))); boltGlow.blendMode = PIXI.BLEND_MODES.ADD;
    const upd = () => {
      const b = st.p < 0.5 ? 1 - Math.pow(1 - st.p * 2, 2) : 1, a = st.p > 0.5 ? Math.pow(st.p * 2 - 1, 2) : 0;   // head runs out, tail catches up
      const s0 = a * LEN, span = (b - a) * LEN, vis = Math.min(1, span / 90), half = HALF * (0.45 + 0.55 * Math.min(1, span / 420));
      bolt.alpha = vis; boltGlow.alpha = 0.28 * vis; bolt.visible = boltGlow.visible = vis > 0.004;
      if (!bolt.visible) return;
      for (let i = 0; i <= N; i++) {
        const q = at(s0 + span * i / N), nx = -q[3] * half, ny = q[2] * half;
        verts[i * 4] = q[0] + nx; verts[i * 4 + 1] = q[1] + ny; verts[i * 4 + 2] = q[0] - nx; verts[i * 4 + 3] = q[1] - ny;
      }
      geo.getBuffer("aVertexPosition").update();
    };
    upd();
    g._tw = [];
    g.stop = () => { g._tw.forEach((t) => t.kill()); g._tw = []; st.p = 1; upd(); };
    g.play = (again) => {                                 // one pass, start to end; again = repeat it after a pause (a lone winning line)
      g.stop();
      g._tw = [gsap.fromTo(st, { p: 0 }, { p: 1, duration: 0.9, ease: "none", repeat: again ? -1 : 0, repeatDelay: 1.5, onUpdate: upd })];
    };
    g.addChild(bolt, boltGlow);
    boardFx.addChild(g); winObjs.push(g);
    return g;
  }
  // white: the light part of a winning cell = a rounded box inset in the cell (x, y, w, h, radius)
  const WIN_IN = 0, WIN_R = 12;                        // user 2026-11-12: "remove the corner fillet a lot"
  function winHole(reel, row) { const x0 = REEL_X[reel][0], x1 = REEL_X[reel][1];
    return [x0 + WIN_IN, rowY(row) - CELL_H / 2 + WIN_IN, x1 - x0 - 2 * WIN_IN, CELL_H - 2 * WIN_IN, WIN_R]; }
  // white (user 2026-11-11: "during the win animation, the animation should loop"): a cell's symbol win move again
  function cellReplay(c) {
    const reel = Math.floor(c / 3), row = c % 3, v = reels[reel].view(row);
    if (!v || S.state === "spinning") return;
    GX.emit("cellWin", { reel, row, cx: REEL_CX[reel], cy: rowY(row), w: REEL_X[reel][1] - REEL_X[reel][0] - 10, h: CELL_H - 10, view: v, id: v.id, winObjs });
  }
  function cellHighlight(reel, row) {
    const cx = REEL_CX[reel], cy = rowY(row);
    const glow = new PIXI.Sprite(FX.tex.glow); glow.anchor.set(0.5); glow.position.set(cx, cy); glow.scale.set(1.25, 1.05);
    glow.tint = 0xffb43a; glow.blendMode = PIXI.BLEND_MODES.ADD; glow.alpha = 0.0;
    glow.visible = false;                              // white: no glow blob behind the winner
    gsap.fromTo(glow.scale, { x: 1.4, y: 1.18 }, { x: 1.25, y: 1.05, duration: 0.5, ease: "power2.out" });
    cellFxBack.addChild(glow); winObjs.push(glow);
    // glowing cell frame with a light running round it
    const fr = new PIXI.Container(); fr.position.set(cx, cy);
    const w = REEL_X[reel][1] - REEL_X[reel][0] - 10, h = CELL_H - 10;
    // white: no gold frame and no running lights; a soft warm light fills the cell's rounded hole and breathes
    const hb = winHole(reel, row), light = new PIXI.Graphics().beginFill(0xfff4dc).drawRoundedRect(hb[0] - cx, hb[1] - cy, hb[2], hb[3], hb[4]).endFill();
    light.alpha = 0.1; fr.addChild(light);
    fr._tw = [gsap.to(light, { alpha: 0.22, duration: 1.2, ease: "sine.inOut", yoyo: true, repeat: -1 })];
    fr.alpha = 0; gsap.to(fr, { alpha: 1, duration: 0.2 });
    cellFxBack.addChild(fr); winObjs.push(fr);      // white: the light sits under the symbol
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
    gsap.to(band, { x: 260, duration: 0.7, ease: "power1.inOut", onComplete: () => { sh.visible = false; } });
    boardFx.addChild(sh); winObjs.push(sh);
    winEmitters.push({ x: cx, y: cy, w, h, t: 0, n: 3 });     // three sparkles per winner, not a fountain
    GX.emit("cellWin", { reel, row, cx, cy, w, h, view: v, id: v.id, winObjs });
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
  const syncTotal = () => { totShown.v = plaqueShown.v; drawTotalT(); };   // every copy shows one value (white: throttled redraw)
  const drawPlaqueTxt = () => { plaqueTxt.text = FX.money(plaqueShown.v); const k = Math.min(1, 300 / plaqueTxt.width); plaqueTxt.scale.set(k); };
  const drawPlaqueTxtT = throttled(drawPlaqueTxt, TXT_DT);
  const drawPlaque = () => { drawPlaqueTxt(); syncTotal(); };
  const drawPlaqueRoll = () => { if (!MOBILE) drawPlaqueTxtT(); syncTotal(); };   // white: while it rolls (phones: no roll, see below)
  const drawBig = () => {
    plaqueBig.text = FX.money(plaqueShown.v); plaqueBig.scale.set(Math.min(0.62, 700 / Math.max(1, plaqueBig.textWidth))); syncTotal();
    if (multTag && !multTag.destroyed && plaqueBig.visible) multTag.position.set(plaque.x + (plaqueBig.width * plaque.scale.x) / 2 + multTag.width / 2 + 18, plaque.y + 8);
  };

  // nudge counter box (00/05) above the column, pink running-total badge under it
  // feature counter plates: parchment (white board) or, with the stone pass, dark bronze / crimson lacquer with a gold rim
  const darkPlate = (w, h, crimson) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    const rr = (i, r) => { g.beginPath(); g.roundRect(i, i, w - 2 * i, h - 2 * i, r); };
    const rim = g.createLinearGradient(0, 0, 0, h); rim.addColorStop(0, "#fff0b8"); rim.addColorStop(0.35, "#f2b440"); rim.addColorStop(0.7, "#b0640e"); rim.addColorStop(1, "#ffd27a");
    rr(1, 18); g.fillStyle = "#1a0602"; g.fill();
    rr(3, 16); g.fillStyle = rim; g.fill();
    const face = g.createLinearGradient(0, 8, 0, h - 8);
    if (crimson) { face.addColorStop(0, "#8a1424"); face.addColorStop(0.5, "#5a0812"); face.addColorStop(1, "#300406"); }
    else { face.addColorStop(0, "#4a2614"); face.addColorStop(0.5, "#2a1208"); face.addColorStop(1, "#160802"); }
    rr(9, 11); g.fillStyle = face; g.fill();
    g.save(); rr(9, 11); g.clip();
    const gl = g.createLinearGradient(0, 9, 0, h * 0.45); gl.addColorStop(0, "rgba(255,240,200,0.28)"); gl.addColorStop(1, "rgba(255,240,200,0)");
    g.fillStyle = gl; g.fillRect(0, 9, w, h * 0.4);
    const sh = g.createLinearGradient(0, h - 30, 0, h - 9); sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,0.45)");
    g.fillStyle = sh; g.fillRect(0, h - 30, w, 21); g.restore();
    g.lineWidth = 1.5; g.strokeStyle = "rgba(255,226,150,0.55)"; rr(10.5, 10); g.stroke();
    return PIXI.Texture.from(c);
  };
  const cntBox = new PIXI.Container(); cntBox.position.set(COL_CX, 488); cntBox.visible = false; plaqueL.addChild(cntBox);
  const cntBg = new PIXI.Sprite(T("UI/nudge_box")); cntBg.anchor.set(0.5); cntBox.addChild(cntBg);   // parchment plate, gold rim
  const PLATE_NUM = { fill: ["#F2B24A", "#B8650F", "#7A3606"], stroke: "#3A1604", dropShadowAlpha: 0.35 };   // deep gold: reads on parchment
  const cntLab = new PIXI.Text("CHARGES LEFT", FX.plain(16, "#7a3c0c", { dropShadow: false })); cntLab.anchor.set(0.5); cntLab.y = -21; cntBox.addChild(cntLab);
  const cntTxt = new PIXI.Text("5", FX.gold(36, PLATE_NUM)); cntTxt.anchor.set(0.5); cntTxt.y = 11; cntBox.addChild(cntTxt);
  // permanent brackets on the centre chip while the feature runs: only this chip is collected
  const centreMark = new PIXI.Container(); centreMark.visible = false; plaqueL.addChild(centreMark);
  centreMark.renderable = false;      // white version: the centre frame has its own arrows painted in
  for (const [x, dir] of [[838, 1], [1050, -1]]) {
    const g = new PIXI.Graphics().beginFill(0x000000, 0.45).drawPolygon([x - dir * 4, COL_CY - 30, x + dir * 26, COL_CY, x - dir * 4, COL_CY + 30]).endFill()
      .beginFill(0xffd36b).lineStyle(2, 0x7a4a10).drawPolygon([x - dir * 2, COL_CY - 24, x + dir * 20, COL_CY, x - dir * 2, COL_CY + 24]).endFill();
    centreMark.addChild(g);
  }
  const accum = new PIXI.Container(); accum.position.set(COL_CX, 556); accum.visible = false; plaqueL.addChild(accum);
  const accBg = new PIXI.Sprite(T("UI/total_box")); accBg.anchor.set(0.5);   // parchment plate, gold rim (was magenta)
  const accGlow = new PIXI.Sprite(FX.tex.glow); accGlow.anchor.set(0.5); accGlow.scale.set(1.9, 1.0); accGlow.tint = 0xffc860;
  accGlow.blendMode = PIXI.BLEND_MODES.ADD; accGlow.alpha = 0.45;
  const accTxt = new PIXI.Text("x1", FX.gold(46, PLATE_NUM)); accTxt.anchor.set(0.5); accTxt.y = 10;
  const accLab = new PIXI.Text("TOTAL", FX.plain(15, "#7a3c0c", { dropShadow: false })); accLab.anchor.set(0.5); accLab.y = -23;
  accum.addChild(accGlow, accBg, accTxt, accLab);
  if (GPASS) {
    cntBg.texture = darkPlate(190, 78, false); accBg.texture = darkPlate(206, 86, true);   // stacked, touching, above the coin column
    cntBox.y = 466; accum.y = 552; cntLab.y = -18; cntTxt.y = 12; accLab.y = -22; accTxt.y = 11;
    cntLab.style = FX.plain(15, "#f3c66a", { dropShadow: false, letterSpacing: 1 }); accLab.style = FX.plain(14, "#ffd9a0", { dropShadow: false, letterSpacing: 1 });
    cntTxt.style = FX.gold(38); accTxt.style = FX.gold(48); accGlow.tint = 0xff6a3c;
  }
  // white version: NUDGES LEFT + TOTAL in one gold-framed screen that rises out of the board frame's top edge
  const CS_X = 944, CS_HIDE = 200;
  const cscreen = new PIXI.Container(); cscreen.visible = false; plaqueL.addChild(cscreen);
  const cscreenBg = new PIXI.Sprite(T("UI/counter_screen")); cscreenBg.anchor.set(0.5, 0); cscreenBg.position.set(CS_X, 420);
  const cscreenMask = new PIXI.Graphics().beginFill(0xffffff).drawRect(760, 280, 380, 312).endFill(); plaqueL.addChild(cscreenMask); cscreen.mask = cscreenMask;
  cscreen.addChild(cscreenBg); [cntBox, accum].forEach((b) => { plaqueL.removeChild(b); cscreen.addChild(b); });
  cntBg.visible = false; accBg.visible = false; accGlow.visible = false;
  cntBox.position.set(CS_X, 478); cntLab.y = -18; cntTxt.y = 8; accum.position.set(CS_X, 548); accLab.y = -20; accTxt.y = 10;
  cntLab.visible = false; accLab.visible = false; cntBox.position.set(CS_X, 481); cntTxt.y = 0; accum.position.set(CS_X, 556); accTxt.y = 0;
  cntTxt.style = FX.gold(44, PLATE_NUM);
  accTxt.style = new PIXI.TextStyle({ fontFamily: "Georgia, serif", fontWeight: "900", fontStyle: "italic", fontSize: 50, fill: ["#FFF3B8", "#F5C24A", "#C47A16"], fillGradientStops: [0, 0.55, 1], stroke: "#4a2206", strokeThickness: 6, dropShadow: true, dropShadowColor: "#1a0800", dropShadowAlpha: 0.6, dropShadowBlur: 2, dropShadowDistance: 2, dropShadowAngle: Math.PI / 2, padding: 10 });   // = the chip labels
  const accPlate = new PIXI.Sprite(T("UI/total_plate")); accPlate.anchor.set(0.5); accPlate.position.set(CS_X, 556); cscreen.addChildAt(accPlate, 1);   // fixed: only the number pops
  accPlate.visible = false; accTxt.style = FX.gold(50, PLATE_NUM);   // white: parchment, like the count above it
  function screenUp(on) {
    gsap.killTweensOf(cscreen);
    if (on) { cscreen.visible = true; cscreen.y = CS_HIDE; accum.visible = true; accum.alpha = 1; accum.scale.set(1); accTxt.text = "x0";
      gsap.to(cscreen, { y: 0, duration: 0.5, ease: "back.out(1.2)" }); }
    else gsap.to(cscreen, { y: CS_HIDE, duration: 0.35, delay: 0.15, ease: "power2.in", onComplete: () => (cscreen.visible = false) });
  }

  // feature state: fire around the whole board, rays behind the bull, darker sky
  const fireFrame = new PIXI.Container(); fireFrame.visible = false; boardFx.addChild(fireFrame);
  {
    const x0 = 10, y0 = 594, x1 = 1070, y1 = 1288;
    const glowLine = new PIXI.Graphics().lineStyle(16, 0xff7a1a, 0.5).drawRoundedRect(x0, y0, x1 - x0, y1 - y0, 24);
    glowLine.filters = [new PIXI.BlurFilter(10)]; glowLine.blendMode = PIXI.BLEND_MODES.ADD;
    fireFrame.addChild(glowLine);
    FireRect(fireFrame, x0, y0, x1, y1, { pad: 60, top: 110, height: 70, ring: true });
    fireFrame.box = [x0, y0, x1, y1];
  }
  const featRays = new PIXI.Sprite(FX.tex.burst); featRays.anchor.set(0.5); featRays.position.set(...bullToL(bull.x, bl.y + bl.h * 0.38));
  featRays.scale.set(1.35); featRays.tint = 0xffaa00; featRays.blendMode = PIXI.BLEND_MODES.ADD; featRays.alpha = 0;
  bullL.addChildAt(featRays, 0);
  if (GPASS) {
    // stone pass (2026-11-11, user: the feature rays looked smeared): a crisp fan of thin tapered gold rays with a clear
    // core round the head, instead of the soft blurred burst
    const S = 1024, C = S / 2, cv = document.createElement("canvas"); cv.width = cv.height = S; const g = cv.getContext("2d");
    g.globalCompositeOperation = "lighter";
    const N = 30;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + (i % 3) * 0.02, wide = i % 3 === 0, half = (wide ? 0.034 : 0.016) * Math.PI;
      const rIn = 150, rOut = wide ? 500 : 420 + (i % 5) * 16;
      const gr = g.createRadialGradient(C, C, rIn, C, C, rOut);
      gr.addColorStop(0, "rgba(255,230,160,0)"); gr.addColorStop(0.12, wide ? "rgba(255,212,110,0.75)" : "rgba(255,226,150,0.55)");
      gr.addColorStop(0.5, wide ? "rgba(255,160,40,0.36)" : "rgba(255,186,80,0.24)"); gr.addColorStop(1, "rgba(255,130,20,0)");
      g.fillStyle = gr; g.beginPath(); g.moveTo(C + Math.cos(a) * rIn * 0.6, C + Math.sin(a) * rIn * 0.6);
      g.lineTo(C + Math.cos(a - half) * rOut, C + Math.sin(a - half) * rOut);
      g.lineTo(C + Math.cos(a + half) * rOut, C + Math.sin(a + half) * rOut); g.closePath(); g.fill();
    }
    featRays.texture = PIXI.Texture.from(cv); featRays.scale.set(1.25); featRays.tint = 0xffffff;
  }
  const sky = { k: 0 };
  const drawSky = () => { const g = Math.round(255 * (1 - 0.38 * sky.k)); const r = Math.round(g * (1 - 0.05 * sky.k)); bg.tint = (r << 16) | (Math.round(g * 0.93) << 8) | Math.round(g * 0.9); };
  let featureOn = false;
  function feature(on) {
    if (on === featureOn) return;
    featureOn = on;
    GX.emit("feature", { on });
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
  // heavy-impact kit (2026-11-11, user: "more aggressive hits and throws"): hit-stop, hard shake, screen flash, radial speed
  // lines, flying stone/gold debris and a board recoil away from the hit. k = 0..1 strength.
  const chunkTex = (() => {
    const c = document.createElement("canvas"); c.width = 28; c.height = 24; const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 0, 28, 24); gr.addColorStop(0, "#fff0c0"); gr.addColorStop(0.4, "#e0a040"); gr.addColorStop(1, "#6a3410");
    g.fillStyle = gr; g.beginPath(); g.moveTo(3, 6); g.lineTo(14, 1); g.lineTo(26, 7); g.lineTo(23, 20); g.lineTo(9, 23); g.lineTo(1, 15); g.closePath(); g.fill();
    g.strokeStyle = "rgba(40,14,2,0.8)"; g.lineWidth = 2; g.stroke();
    return PIXI.Texture.from(c);
  })();
  function heavyHit(P, k, tint) {
    k = Math.max(0, Math.min(1, k)); tint = tint || 0xffc860;
    hitStop(50 + 70 * k); buzz(25 + 35 * k);
    shake(12 + 16 * k, 0.3 + 0.15 * k);
    flashScreen(0xfff0d0, 0.07 + 0.1 * k, 0.12);
    const lines = new PIXI.Container(); lines.position.set(P.x, P.y); fxTop.addChild(lines);
    const nL = MOBILE ? 10 : 16;
    for (let i = 0; i < nL; i++) {
      const r = new PIXI.Sprite(FX.tex.ray); r.anchor.set(0.5, 1); r.blendMode = PIXI.BLEND_MODES.ADD; r.tint = i % 2 ? 0xffffff : tint;
      r.rotation = (i / nL) * Math.PI * 2 + (Math.random() - 0.5) * 0.25; r.scale.set(0.16 + Math.random() * 0.12, 0.03); r.alpha = 0.75; r.y = 0; lines.addChild(r);
      gsap.to(r.scale, { y: 0.16 + 0.16 * k + Math.random() * 0.08, duration: 0.12, ease: "power3.out" });
    }
    gsap.to(lines.scale, { x: 1.35, y: 1.35, duration: 0.26, ease: "power2.out" });
    gsap.to(lines, { alpha: 0, duration: 0.2, delay: 0.06, ease: "power2.in", onComplete: () => lines.destroy({ children: true }) });
    const nD = Math.round((MOBILE ? 8 : 16) * (0.5 + k));
    for (let i = 0; i < nD; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, sp = 500 + Math.random() * 900 * (0.6 + k);
      topP.emit({ tex: chunkTex, x: P.x + (Math.random() - 0.5) * 40, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 2400, drag: 0.4,
        s0: 0.6 + Math.random() * 0.9, s1: 0.4, life: 0.7 + Math.random() * 0.4, a0: 1, a1: 0.6, vr: (Math.random() - 0.5) * 18, blend: PIXI.BLEND_MODES.NORMAL });
    }
    for (let i = 0; i < nD; i++) {
      const a = Math.random() * Math.PI * 2, sp = 700 + Math.random() * 900;
      topP.emit({ tex: FX.tex.dot, x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3.2, s0: 0.3, s1: 0, life: 0.35, stretch: 500, tint: Math.random() < 0.5 ? 0xffffff : tint });
    }
    ringAt(P.x, P.y, 0xffffff, 1.6 + 1.6 * k, 0.22); ringAt(P.x, P.y, tint, 2.6 + 2.4 * k, 0.4);
    const dx = P.x < 540 ? -1 : 1, kick = 8 + 14 * k;               // the board recoils away from the blow, then springs back
    gsap.killTweensOf(boardL, "x,y"); boardL.position.set(0, 0);
    if (dropWorthy()) gsap.timeline().to(boardL, { x: dx * kick * 0.4, y: kick, duration: 0.035, ease: "power2.in" })
      .to(boardL, { x: -dx * kick * 0.15, y: -kick * 0.3, duration: 0.09, ease: "power2.out" })
      .to(boardL, { x: 0, y: 0, duration: 0.28, ease: "elastic.out(1, 0.4)" });
  }
  // white (user 2026-11-12: "during the letters don't drop the board, but during the charge, wild and super wild, do a
  // strong drop of the board"): does this round have a WILD / SUPER WILD in a win, or a CHARGE that fires?
  function dropWorthy() {
    const r = window.G && G.last; if (!r || !r.grid) return true;
    return r.lines.some((l) => l.rows.some((row, reel) => Engine.WILDS.has(r.grid[reel][row]))) || !!(r.boardRuns && r.boardRuns.length) || r.chipSteps > 0 || !!r.fc;
  }
  function boardDrop(k) {             // white: the whole board drops and springs back (smooth: no snap when drops overlap)
    gsap.killTweensOf(boardL, "y");
    const d = Math.max(boardL.y, 10 + 14 * k);                    // strong (user 2026-11-12)
    gsap.timeline().to(boardL, { y: d, duration: 0.08, ease: "power2.in" }).to(boardL, { y: 0, duration: 0.55, ease: "back.out(1.7)" });
  }
  function flashScreen(tint, a, dur) {
    gsap.killTweensOf(screenFlash); screenFlash.tint = tint; screenFlash.visible = true;
    gsap.fromTo(screenFlash, { alpha: a }, { alpha: 0, duration: dur, ease: "power2.out", onComplete: () => (screenFlash.visible = false) });
  }
  function impactAt(p, v) {
    VFX.shockwave(p.x, p.y, { amp: v >= 10 ? 30 : 18, radius: v >= 10 ? 900 : 600 });
    starFlash(p.x, p.y, v >= 10 ? 1.2 : 0.8, 0xfff0c0);
    ringAt(p.x, p.y, 0xffee88, 2.0, 0.25); flashAt(p.x, p.y, 0xfff0c0, 1.1, 0.08);
    burstAt(p.x, p.y, 0xffd060, 12);
    SFX.impact(v >= 10); heavyHit(p, v >= 100 ? 0.9 : v >= 10 ? 0.65 : 0.4, multTint(v));
  }
  function pulseChip(big) {
    const v = colReel.views[4];
    gsap.fromTo(v.inner.scale, { x: big ? 1.45 : 1.3, y: big ? 1.45 : 1.3 }, { x: 1, y: 1, duration: 0.5, ease: "back.out(2)" });
    gsap.fromTo(v.flash, { alpha: 1 }, { alpha: 0, duration: 0.6 });
    ringAt(COL_CX, COL_CY, 0xffd060, 1.3, 0.45);
  }
  // Garuda multiplier hit: 0.5 s charge in place (1.6x, hot glow), 0.3 s flight, 0.2 s impact, 0.2 s absorb
  async function multHit(v, struck) {
    const chip = colReel.views[4], from = { x: COL_CX, y: COL_CY }, to = { x: plaque.x, y: plaque.y };
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
    await FX.tween(p, { t: 1, duration: 0.2, ease: "power3.in", onUpdate: () => {
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
    gsap.to(cntBox, { alpha: 0, duration: 0.2, onComplete: () => { cntBox.visible = false; cntBox.alpha = 1; } }); screenUp(false);
    gsap.to(lab.scale, { x: 0.8, y: 0.8, duration: 0.2, ease: "back.in(2)" });
    await FX.tween(lab, { x: to.x, y: to.y, duration: 0.2, ease: "power2.in" });
    gsap.to(g, { alpha: 0, duration: 0.25, onComplete: () => g.destroy({ children: true }) });
    boom(to.x, to.y, 1.0, 0xffe0b0);
    impactAt(to, acc);
    gsap.to(lab, { alpha: 0, duration: 0.15, onComplete: () => lab.destroy() });
  }
  // WHITE VERSION: the SUPER WILD's count lives on the symbol's own ruby plate (SymView.cnt). Garuda logic (user
  // 2026-11-11: "the number can go up to 8" -> "read the garuda logic docs"): each SUPER WILD lands with its own charge
  // count (Engine.SW_CHARGES, 2..8) shown as a plain number; when it fires it shows N/N and counts down one per charge
  // (N/N -> ... -> 0/N). Spliced in by tools/port_from_stone.py.
  function superCounter(c, n) {
    const reel = Math.floor(c / 3), row = c % 3, x = REEL_CX[reel], y = rowY(row);
    const t = reels[reel].view(row).cnt;
    n = n || Engine.NUDGES;
    let left = n;
    if (t) { t.text = `${left}/${n}`; gsap.fromTo(t.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.32, ease: "back.out(2.5)" }); }
    return { x, y, n, dec() {
      left = Math.max(0, left - 1);
      if (t && !t.destroyed) { t.text = `${left}/${n}`; gsap.fromTo(t.scale, { x: 1.45, y: 1.45 }, { x: 1, y: 1, duration: 0.22, ease: "back.out(2)" }); }
      flashAt(x, y, 0xff8800, 1.4, 0.25);
    } };
  }
  // WHITE VERSION (Garuda logic): the coins of the super wild halo - every value its charges will pick, then decoys from the
  // top of the strip, shuffled (gx_halo.js superHaloOpen / superHaloPick). Spliced in by tools/port_from_stone.py.
  function haloVals(r) {
    const picks = [...new Set(r.nudges.slice(0, r.superSteps))].slice(0, 7);
    const decoys = [1000, 500, 100, 50, 25, 20, 15, 10].filter((v) => !picks.includes(v));
    const vals = picks.concat(decoys).slice(0, 7);
    for (let i = vals.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [vals[i], vals[j]] = [vals[j], vals[i]]; }
    return vals;
  }
  // the column jumps to where the engine's strip walk stands (the super wild charges were picked in the halo, not nudged)
  function colJump(c) {
    colReel.setSyms(colIds(c));
    colReel.views.forEach((v) => { if (v.flash) gsap.fromTo(v.flash, { alpha: 0.7 }, { alpha: 0, duration: 0.4 }); });
    ringAt(COL_CX, COL_CY, 0xffd060, 1.6, 0.35); flashAt(COL_CX, COL_CY, 0xfff0c0, 1.0, 0.2);
  }
  // "+N CHARGES" from the total badge to the counter (a CHARGE coin picked in the halo)
  function chargeFly(n) {
    const t = new PIXI.Text(`+${n} CHARGES`, FX.gold(40, { fill: ["#F8E8FF", "#D9A0FF", "#7A2FB0"] }));
    t.anchor.set(0.5); const at = fxTop.toLocal(accum.getGlobalPosition()); t.position.set(at.x - 60, at.y + 40); fxTop.addChild(t);
    const to = fxTop.toLocal(cntBox.getGlobalPosition());
    gsap.timeline({ onComplete: () => t.destroy() }).fromTo(t.scale, { x: 0.4, y: 0.4 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" })
      .to(t, { x: to.x, y: to.y, alpha: 0.2, duration: 0.45, ease: "power2.in", delay: 0.3 });
    SFX.nudgeActivate();
  }
  // Garuda nudge step: counter flip -> 0.12 s -> nudge (0.18 s) -> streak up -> badge pop; steps ~1.75 s apart
  // ===== WHITE VERSION: CHARGE runs and FORTUNE CHOICE (product spec "Fortune Guardian 1000 - Buy Bonus and Extra Bet"
  // v1.0; engine tools/white_engine.js). Spliced over nudgePhase() by tools/white_spec_game.py.
  //  - main CHARGE: a CHARGE chip in the centre of a win runs N actions on the column; each action nudges one chip in
  //    (a multiplier adds to the total, a nested CHARGE fires and adds its actions);
  //  - natural Fortune Choice: a SUPER WILD in the win opens the halo wheel over the bull's head with 9 positions (the
  //    engine's board); every Choice picks one position (never again): a multiplier flies into the total, a CHARGE
  //    runs its actions on the column into the total, a Choice +2 adds two picks;
  //  - Buy Bonus (buyShow): the same wheel at once, after the column lands on the starting multiplier; pays bet x total.
  // The column's own strip is decor: the chips that will slide into the centre are set to the engine's draws first.
  let accCap = Infinity;                                 // at the max-win cap the shown total stops at the paid one
  const capAdd = (acc, v) => Math.min(accCap, acc + v);
  const colIdxOf = (v) => { const i = Engine.STRIP.indexOf(v); return i < 0 ? 0 : i; };
  function colPlan(vals, flash) {                       // next values into views[3], [2], [1], [0]; the rest queue up
    for (let j = 0; j < 4 && j < vals.length; j++) {
      const vi = 3 - j, id = colIdxOf(vals[j]);
      if (colReel.syms[vi] === id) continue;
      colReel.syms[vi] = id; colReel.views[vi].set(id, false);
      const v = colReel.views[vi];
      if (flash && vi > 0 && v.flash) gsap.fromTo(v.flash, { alpha: 0.9 }, { alpha: 0, duration: 0.45 });
    }
    colQ.length = 0; vals.slice(4).forEach((v) => colQ.push(colIdxOf(v)));
  }
  const cntShow = (o, pop) => {                         // the counter screen: done / total
    cntTxt.text = Math.min(o.done, o.tot) + "/" + o.tot;
    if (pop) gsap.fromTo(cntBox.scale, { x: 1.2, y: 1.2 }, { x: 1, y: 1, duration: 0.1 });
  };
  const counter = (tot) => { const o = { done: 0, tot }; o.draw = (pop) => cntShow(o, pop); return o; };
  function badgeIn() {
    if (accum.visible) return;
    accum.visible = true; accum.scale.set(0);
    gsap.to(accum.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(2)" }); ringAt(accum.x, accum.y, 0xffd060, 2.2, 0.3);
  }
  const accDraw = throttled(() => { accTxt.text = "x" + Math.round(accShown.v); }, TXT_DT), accShown = { v: 0 };
  function accSet(v, pk, esc) {
    accShown.v = v; accTxt.text = "x" + v;
    gsap.fromTo(accum.scale, { x: pk || 1.4, y: pk || 1.4 }, { x: 1, y: 1, duration: 0.2 + 0.15 * (esc || 0), ease: "back.out(2)" });
  }
  // "+2 CHOICES" from the wheel to the counter screen
  function choiceFly(n) {
    const t = new PIXI.Text(`+${n} CHOICES`, FX.gold(40, { fill: ["#F0FFE0", "#B8F070", "#3E8A12"] }));
    t.anchor.set(0.5); t.position.set(540, 330); fxTop.addChild(t);
    const to = fxTop.toLocal(cntBox.getGlobalPosition());
    gsap.timeline({ onComplete: () => t.destroy() }).fromTo(t.scale, { x: 0.4, y: 0.4 }, { x: 1.1, y: 1.1, duration: 0.3, ease: "back.out(3)" })
      .to(t, { x: to.x, y: to.y, alpha: 0.2, duration: 0.45, ease: "power2.in", delay: 0.35 })
      .to(t.scale, { x: 0.5, y: 0.5, duration: 0.45 }, "<");
    ringAt(to.x, to.y, 0x9be060, 1.6, 0.4); SFX.nudgeActivate();
  }
  // "CHARGE n" over the column as a Fortune Choice CHARGE starts its run
  function chargeTag(n) {
    const p = fxTop.toLocal(frameL.toGlobal(new PIXI.Point(COL_CX, COL_CY)));
    const t = new PIXI.Text(`CHARGE ${n}`, FX.gold(44, { fill: ["#F8E8FF", "#D9A0FF", "#7A2FB0"] })); t.anchor.set(0.5); t.position.set(p.x - 150, p.y); fxTop.addChild(t);
    gsap.timeline({ onComplete: () => t.destroy() }).fromTo(t.scale, { x: 0.3, y: 0.3 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" })
      .to(t, { alpha: 0, y: p.y - 60, duration: 0.4, delay: 0.5 });
    flashAt(p.x, p.y, 0xd9a0ff, 1.4, 0.3); ringAt(p.x, p.y, 0xc070ff, 2.0, 0.4); SFX.nudgeActivate(); boardDrop(1.2);   // strong drop
  }
  // one CHARGE run: every action nudges the column one chip in. Runs speed up after 6 actions; past 24 the rest rolls
  // in at once (the column jumps to its last chips, the total counts up).
  async function runActions(vals, acc, ctr) {
    const n = vals.length, FAST = 24;
    for (let k = 0; k < n; k++) {
      if (k === FAST && n - k > 6) {
        const rest = vals.slice(k), add = rest.reduce((a, v) => a + (v > 0 ? v : 0), 0), more = rest.reduce((a, v) => a + (v < 0 ? -v : 0), 0);
        const last = colIdxOf(rest[rest.length - 1]), ids = [];
        for (let i = 0; i < 9; i++) { const b = i - 4; ids.push(b >= 0 && b < rest.length ? colIdxOf(rest[rest.length - 1 - b]) : stripAt(last, -b)); }
        colReel.setSyms(ids); colReel.views.forEach((v) => { if (v.flash) gsap.fromTo(v.flash, { alpha: 0.8 }, { alpha: 0, duration: 0.5 }); });
        SFX.tease(0.6); shake(8, 0.5); flashAt(COL_CX, COL_CY, 0xfff0c0, 1.6, 0.3);
        ctr.tot += more; ctr.done = ctr.tot; ctr.draw(true);
        accShown.v = acc;
        await FX.tween(accShown, { v: acc + add, duration: S.turbo ? 0.6 : 1.4, ease: "power1.in", onUpdate: () => { accDraw(); if (Math.random() < 0.3) SFX.tick(); } });
        acc = capAdd(acc, add); accSet(acc, 1.6, 1); SFX.impact(true); flashScreen(multTint(Math.min(1000, add)), 0.16, 0.35);
        return acc;
      }
      const v = vals[k], f = k < 6 ? 1 : Math.max(0.32, Math.pow(0.86, k - 5));
      const STEP = ((S.turbo ? 0.5 : k === 0 ? 1.0 : 0.68) + (v < 0 ? 0.35 : 0)) * f;
      const t0 = gsap.globalTimeline.time();
      await FX.wait(0.06 * f);
      const esc = n > 1 ? k / (n - 1) : 1, lastN = k === n - 1 && n > 1 && !S.turbo && n <= FAST;
      if (lastN) { SFX.tease(0.5); gsap.to(vignette, { alpha: 0.5, duration: 0.25, onStart: () => (vignette.visible = true) }); await FX.wait(0.3); }
      SFX.nudge(esc); shake(4 + 6 * esc, 0.12 + 0.08 * esc); boardDrop(0.4 + 0.6 * esc); cfKnock(10);
      if (fireFrame.visible) gsap.to(fireFrame, { alpha: 0.62 + 0.38 * esc, duration: 0.2 });
      await colReel.nudge(lastN ? 0.42 : 0.18 * Math.max(0.6, f));
      if (lastN) gsap.to(vignette, { alpha: 0, duration: 0.3, onComplete: () => (vignette.visible = false) });
      ctr.done++; ctr.draw(true);
      if (v < 0) { ctr.tot += -v; ctr.draw(false); await nudgeChipFire(-v); }
      else {
        pulseChip(v >= 50);
        await FX.wait(0.08 * f);
        if (f > 0.55) await streakToBadge(v);
        badgeIn(); acc = capAdd(acc, v); accSet(acc, 1.25 + 0.5 * esc, esc);
        ringAt(accum.x, accum.y, 0xffd060, 1.4 + esc, 0.3); SFX.impact(lastN || v >= 50); SFX.rise(esc);
        if (lastN || v >= 50) flashScreen(multTint(v), 0.14, 0.3);
      }
      const el = gsap.globalTimeline.time() - t0;
      if (el < STEP) await FX.wait(STEP - el);
    }
    return acc;
  }
  // Fortune Choice on the halo wheel. ctr = the counter (picks done / Choices); sw = the SUPER WILDs' counters (natural)
  async function fortuneChoiceShow(r, acc, ctr, sw, from) {
    const fc = r.fc, vals = fc.board.map((b) => (b.t === "mult" ? b.v : b.t === "charge" ? -b.n : "c2"));
    const owner = []; (sw || []).forEach((s) => { for (let i = 0; i < s.n; i++) owner.push(s); });
    ctr.done = 0; ctr.tot = fc.choices0; ctr.draw(true);
    bullReact("tease");
    await GX.run("superHaloOpen", { vals }, 5000);
    const accAt = () => fxTop.toLocal(accum.getGlobalPosition());
    const colAt = () => fxTop.toLocal(frameL.toGlobal(new PIXI.Point(COL_CX, COL_CY)));
    const cntAt = () => fxTop.toLocal(cntBox.getGlobalPosition());
    for (let j = 0; j < fc.picks.length; j++) {
      const p = fc.picks[j], s = owner[j];
      if (s) { s.dec(); ringAt(s.x, s.y, 0xff7a3a, 1.2, 0.4); }
      badgeIn();
      const to = p.t === "mult" ? accAt() : p.t === "charge" ? colAt() : cntAt();
      await GX.run("superHaloPick", { pos: p.pos, v: vals[p.pos], from: s ? { x: s.x, y: s.y } : from, to }, 6000);
      ctr.done++; ctr.draw(true);
      if (p.t === "mult") {
        acc = capAdd(acc, p.v); accSet(acc, 1.4, 0.5); SFX.impact(p.v >= 50); SFX.rise(j / Math.max(1, fc.picks.length - 1));
        if (p.v >= 50) flashScreen(multTint(p.v), 0.14, 0.3);
      } else if (p.t === "choice2") {
        ctr.tot += 2; choiceFly(2); await FX.wait(0.5); ctr.draw(true);
      } else {                                          // the column runs this CHARGE's actions into the total
        chargeTag(p.n); colPlan(p.vals, true); await FX.wait(0.45);
        const run = counter(p.n); run.draw(true);
        acc = await runActions(p.vals, acc, run);
        ctr.draw(true);
      }
    }
    owner.slice(fc.picks.length).forEach((s) => s.dec());   // Choices capped at 9: the rest of the counts are spent too
    await GX.run("superHaloClose", {}, 2000);
    return acc;
  }
  async function nudgePhase(r) {
    accCap = r.capped ? r.mult : Infinity;
    const chipStart = r.startMult < 0;
    if (featureOn) feature(true); else if (!chipStart) await bullCharge();
    let acc = chipStart ? 0 : r.startMult;
    const bruns = r.boardRuns || [];
    const ctr = counter(r.chipSteps || (bruns.length ? bruns[0].n : 0) || (r.fc ? r.fc.choices0 : 0));
    screenUp(true); cntBox.visible = true; cntBox.scale.set(0); ctr.draw(false); centreMark.visible = true; centreMark.alpha = 0;
    gsap.to(centreMark, { alpha: 1, duration: 0.25 });
    lineGfx.forEach((g) => gsap.to(g, { alpha: 0.12, duration: 0.2 }));      // paylines step back while the column works
    r.bullActed = true;
    await FX.tween(cntBox.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(1.7)" });
    const sw = r.superCells.map((c) => superCounter(c, r.superCharges && r.superCharges[c]));
    if (chipStart) { await bullOrb({ x: COL_CX, y: COL_CY }, 0x5ff0ff, r.startMult, 1.25); feature(true); await nudgeChipFire(r.chipSteps); }
    else { pulseChip(false); await streakToBadge(r.startMult); badgeIn(); accSet(acc, 1, 0); SFX.impact(false); }
    if (r.nudges.length) { colPlan(r.nudges, false); acc = await runActions(r.nudges, acc, ctr); }
    for (const b of bruns) {                            // every CHARGE symbol on the board fires its count on the column
      const reel = Math.floor(b.cell / 3), row = b.cell % 3, from = { x: REEL_CX[reel], y: rowY(row) }, v = reels[reel].view(row);
      if (v && v.chg) gsap.fromTo(v.chg.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" });
      ringAt(from.x, from.y, 0xc070ff, 1.6, 0.4); SFX.nudgeActivate();
      await beam(from, { x: COL_CX, y: COL_CY }, 0xc070ff); boardDrop(1.2);
      chargeTag(b.n); colPlan(b.vals, true); await FX.wait(0.3);
      const run = counter(b.n); run.draw(true);
      acc = await runActions(b.vals, acc, run);
    }
    if (r.fc) acc = await fortuneChoiceShow(r, acc, ctr, sw, { x: COL_CX, y: COL_CY });
    lineGfx.forEach((g) => gsap.to(g, { alpha: 1, duration: 0.2 }));
    return acc;
  }
  // the Buy Bonus round: no spin; the reels step back, the column lands on the starting multiplier, Fortune Choice plays
  async function buyShow(r) {                          // whatever happens, the player's own mode comes back
    try { await buyShowRun(r); } finally { if (Engine.mode() === "buy") exModeSync(true); }
  }
  async function buyShowRun(r) {
    accCap = r.capped ? r.totalX : Infinity;
    S.state = "present"; presentAt = performance.now(); S.canSkip = false; S.respin = false;
    const bet = BETS[S.betIdx];
    Engine.setMode("buy");
    feature(true); bullReact("tease");
    const veil = new PIXI.Graphics().beginFill(0x000000).drawRect(REEL_X[0][0], rowY(0) - CELL_H / 2, REEL_X[2][1] - REEL_X[0][0], CELL_H * 3).endFill();
    veil.alpha = 0; cellFxBack.addChild(veil); winObjs.push(veil); gsap.to(veil, { alpha: 0.6, duration: 0.3 });
    reels.forEach((rl) => [0, 1, 2].forEach((row) => rl.view(row).dim(0.6)));
    msgTxt.visible = false;                                                  // the plaque takes the footer
    plaqueBg.alpha = 1; plaqueGlow.alpha = 0.5; plaqueTxt.visible = true; plaqueBig.visible = false; plaque.visible = true; wbTotal.visible = false;
    plaqueShown.v = bet; drawPlaque(); plaque.alpha = 0; plaque.scale.set(0.6 * PLAQUE_S);
    gsap.to(plaque, { alpha: 1, duration: 0.1 }); gsap.to(plaque.scale, { x: PLAQUE_S, y: PLAQUE_S, duration: 0.25, ease: "back.out(2)" });
    const ctr = counter(r.fc.choices0);                                     // the counter screen first (it resets its total)
    screenUp(true); cntBox.visible = true; cntBox.scale.set(0); ctr.draw(false);
    await FX.tween(cntBox.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(1.7)" });
    colJump(r.multIndex); await FX.wait(0.4);                               // the column lands on the starting multiplier
    pulseChip(r.startMult >= 50); await streakToBadge(r.startMult); badgeIn();
    let acc = r.startMult; accSet(acc, 1.4, 0); SFX.impact(r.startMult >= 50);
    r.bullActed = true;
    acc = await fortuneChoiceShow(r, acc, ctr, [], { x: 540, y: 470 });
    await laserApply(Math.max(1, acc));
    const tier = Engine.tier(r.totalX), popWin = TIER_ORDER.includes(tier);
    gsap.to(plaqueBg, { alpha: 0, duration: 0.15 }); gsap.to(plaqueGlow, { alpha: 0.95, duration: 0.15 });
    plaqueTxt.visible = false; plaqueBig.visible = true; plaqueShown.v = bet; drawBig();
    await FX.tween(plaqueShown, { v: r.win, duration: S.turbo ? 0.4 : 0.9, ease: "power1.in", onUpdate: () => drawBig() });
    if (popWin) {
      gsap.to(plaque, { alpha: 0, duration: 0.15 });
      await bigWin(r.win, r.totalX);
      plaque.visible = false; plaque.alpha = 1; plaqueBig.visible = false; totShown.v = r.win; showTotal(r.win);
    } else {
      await FX.wait(0.6);
      gsap.to(plaque, { alpha: 0, duration: 0.2, onComplete: () => { plaque.visible = false; plaque.alpha = 1; plaqueBig.visible = false; totShown.v = r.win; showTotal(r.win); } });
    }
    balanceStreak();
    setBalance(S.balance + r.win, true);
    S.lastWin = r.win;
    exModeSync(true);                                    // back to the player's own column
  }
  // Garuda "power-up clash": the bull's lightning pulls the next-higher medallion out; it swaps with the real one, then loses
  function clashWanted(r) {
    const up = Engine.STRIP[stripAt(r.multIndex, 1)];
    return r.startMult >= 5 && up > r.startMult && (S.forceKind === "clash" || (S.forceKind !== "halo" && r.totalX >= 5 && Math.random() < 0.3));
  }
  async function clash(r) {
    feature(true);
    const upV = Engine.STRIP[stripAt(r.multIndex, 1)], cur = r.startMult;
    const chest = CHEST;
    GX.emit("clashStart", { chest, up: upV, cur });
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
    const mk = (v, d) => {
      const c = new PIXI.Container();
      const parts = [chipBgTex(v), T(COINS && v > 0 ? "Multipliers/coin_rim" : "Multipliers/chip_rim"), chipLabelTex(v)];
      parts.forEach((t, n) => { const s = new PIXI.Sprite(t); s.anchor.set(0.5); if (COINS) s.scale.set(v < 0 ? NUDGE_K : n === 2 ? LABEL_K : 1); c.addChild(s); });
      const f = chipFit(d); c.children.forEach((ch, n) => (n === c.children.length - 1 ? ch.scale.set(f.l) : ch.scale.set(f.bx, f.by)));
      fxTop.addChild(c); return c;
    };
    const vA = colReel.views[3], vB = colReel.views[4];
    const A = mk(upV, 1), B = mk(cur, 0);
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
    GX.emit("clashBurst", { chest, x: COL_CX, y: COL_CY });
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
    SFX.slam(); SFX.impact(true); heavyHit({ x: P.x, y: y0 }, 1, 0xffaa32);
    VFX.shockwave(P.x, y0, { amp: 30, radius: 900, dur: 0.25 }); VFX.zoomPunch(P.x, y0 + 300, 0.16, 0.12);
    flashAt(P.x, y0, 0xfff2cd, 1.4, 0.06); flashAt(P.x, y0 - 20, 0xffaa32, 2.6, 0.22);
    ringAt(P.x, y0, 0xffaa32, 2.6, 0.3);
    boom(P.x, y0, 2.2); smokeAt(P.x, y0 - 6, 5, 0.8);
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
    hopCells({ x: P.x, y: y0 }, 22, 700);
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
    if (dropWorthy()) { boardDrop(1.1); hopCells(P); }               // white: a letters-only win keeps the board still
    gsap.to(bull, { y: by, duration: 0.5, ease: "power2.out", delay: 0.1 });
    gsap.to(bull.scale, { x: 1, y: 1, duration: 0.5, delay: 0.1 });
    await FX.wait(0.35);
  }
  // the bull charges the fire in his hand (it takes the orb's colour), winds up and hurls it as a comet (Kling throw clip)
  const RIM_VIOLET = [0.6, 0.28, 1.0];
  const rgbOf = (t) => [((t >> 16) & 255) / 255, ((t >> 8) & 255) / 255, (t & 255) / 255];
  async function bullOrb(to, tint, label, k, picked) {
    const mv = bullLive() ? bullPlay("bull_throw", k) : null;
    if (!mv) return bullOrbCode(to, tint, label);
    await mv.startedP;
    const tRel = (mv.c.cfg.events || {}).release || 1.94;
    const cd = Math.max(0.3, bullSpan("bull_throw", Math.min(mv.t, tRel), tRel) / (mv.k || 1));
    if (flame.c) flame.c.setRim(rgbOf(tint));
    SFX.orbCharge(cd); gsap.to(flame, { boost: 0.3, duration: cd });
    GX.emit("throwCharge", { cd, tint, label, to, picked: !!picked });
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
    // launch from where the coin in the hand is right now (the picker coin rides flame.gx/gy - 70), so coin and throw stay in sync
    const c = mv.c, from = flame.gx != null && flame.on > 0.05 ? { x: flame.gx, y: flame.gy - 70 } : bullPt(c, c.cfg.release || [560, 230]);
    const d = c.cfg.dir || [90, 60], dl = Math.hypot(d[0], d[1]);
    const ctrl = { x: Math.min(W - 40, from.x + d[0] / dl * 420), y: from.y + d[1] / dl * 420 };
    flashAt(from.x, from.y, 0xffffff, 1.8, 0.2); starFlash(from.x, from.y, 1.3, tint);
    GX.emit("throwRelease", { from, to, tint, label });
    await comet(from, ctrl, to, tint, label, S.turbo ? 0.22 : 0.3);
    orbImpact(to, tint);
  }
  // a fireball with a trailing magic flame, flown along a curve
  function comet(from, ctrl, to, tint, label, dur) {
    const o = new PIXI.Container(); o.position.set(from.x, from.y); fxTop.addChild(o);
    const tail = VFX.magicFlame(o, 150, 300, rgbOf(tint)); tail.power = 1.5;
    const g = new PIXI.Sprite(FX.tex.glow); g.anchor.set(0.5); g.tint = tint; g.blendMode = PIXI.BLEND_MODES.ADD; g.scale.set(2.1);
    const core = new PIXI.Sprite(FX.tex.glow); core.anchor.set(0.5); core.tint = 0xffffff; core.blendMode = PIXI.BLEND_MODES.ADD; core.scale.set(0.45);
    const ring = new PIXI.Sprite(FX.tex.ring); ring.anchor.set(0.5); ring.tint = tint; ring.blendMode = PIXI.BLEND_MODES.ADD; ring.scale.set(0.6);
    o.addChild(g, ring, core);
    if (label) {                                             // the same coin the bull held (face + numerals, picker size), so the hand-off reads as one object
      const k = COINS ? 0.86 : 0.6;
      if (COINS) {
        const f = new PIXI.Sprite(chipBgTex(label)); f.anchor.set(0.5); f.scale.set(label < 0 ? k * NUDGE_K : k); o.addChild(f);
        const rm = new PIXI.Sprite(T(label < 0 ? "Multipliers/chip_rim" : "Multipliers/coin_rim")); rm.anchor.set(0.5); rm.scale.copyFrom(f.scale); o.addChild(rm);
      }
      const l = new PIXI.Sprite(chipLabelTex(label)); l.anchor.set(0.5); l.scale.set(COINS ? (label < 0 ? k * NUDGE_K : k * LABEL_K) : k); o.addChild(l);
    }
    const p = { t: 0 }; let px = from.x, py = from.y;
    return FX.tween(p, { t: 1, duration: dur, ease: "power2.in", onUpdate: () => {
      const q = FX.bezier(from, ctrl, to, p.t), vx = q.x - px, vy = q.y - py; px = q.x; py = q.y;
      o.position.set(q.x, q.y); ring.rotation += 0.3;
      if (vx || vy) tail.rotation = Math.atan2(-vx, vy);           // the flame streams behind the ball
      const n = nEmit(70);
      for (let k = 0; k < n; k++) topP.emit({ tex: k ? FX.tex.dot : FX.tex.spark, x: q.x + (Math.random() - 0.5) * 30, y: q.y + (Math.random() - 0.5) * 30, s0: 0.5, s1: 0, life: 0.4, tint });
      if (vx || vy) { const sp = Math.hypot(vx, vy); g.scale.set(2.1 + sp / 40, 2.1); g.rotation = Math.atan2(vy, vx); topP.emit({ tex: FX.tex.dot, x: q.x, y: q.y, vx: -vx * 8, vy: -vy * 8, s0: 0.9, s1: 0, life: 0.18, stretch: 300, tint: 0xffffff }); }
    } }).then(() => o.destroy({ children: true }));
  }
  function orbImpact(to, tint) {
    boom(to.x, to.y, 1.9, tint);
    VFX.shockwave(to.x, to.y, { amp: 26, radius: 800 });
    flashAt(to.x, to.y, 0xfff4dc, 1.8, 0.1); burstAt(to.x, to.y, tint, 22); starFlash(to.x, to.y, 1.6, tint);
    SFX.impact(true); heavyHit(to, 0.8, tint);
    hopCells(to, 18, 640);
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
  const HAND_MASK = { dx: 0, dy: 15, rx: 95, ry: 115 };   // white: up over the fingertips (the orb sits behind them)                // clip px, relative to the flame base point
  const handTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
    const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.72, "rgba(255,255,255,1)");
    r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return PIXI.Texture.from(c); })();
  const handFront = new PIXI.Sprite(PIXI.Texture.EMPTY), handMask = new PIXI.Sprite(handTex);
  handMask.anchor.set(0.5); handFront.mask = handMask; handFront.visible = false;
  bull.addChild(handFront, handMask);
  const handSpill = new PIXI.Sprite(FX.tex.glow); handSpill.anchor.set(0.5); handSpill.blendMode = PIXI.BLEND_MODES.ADD;
  handSpill.tint = 0xff8a28; handSpill.visible = false; bull.addChild(handSpill); const handArea = new PIXI.Rectangle(), popHandArea = new PIXI.Rectangle();     // white: the orb's light on the fingertips
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
      if (popHandFront) {
        if (popHandFront.texture !== hero.texture) popHandFront.texture = hero.texture;
        popHandFront.position.copyFrom(hero.position); popHandFront.scale.copyFrom(hero.scale);
        const kx = hero.width / 720, ky = hero.height / 1280;
        popHandMask.position.set(gx + HAND_MASK.dx * kx, gy + HAND_MASK.dy * ky);
        popHandMask.scale.set((HAND_MASK.rx * 2 * kx) / 128 / 0.86, (HAND_MASK.ry * 2 * ky) / 128 / 0.86);
        popHandArea.copyFrom(popHandMask.getBounds()).pad(10); popHandFront.filterArea = popHandArea;
      }
    } else {
      const cfg = (clips.bull_idle || clips.bull_big || { cfg: { x: 162, y: -116.9, w: 725 } }).cfg, sc = cfg.w / 720;
      gx = cfg.x + cx * sc; gy = cfg.y + cy * sc;
      const on = Math.min(1, Math.max(0, h.p));
      fc.position.set(gx - (bl.x + bl.w / 2), gy - (bl.y + bl.h));
      fc.visible = on > 0.02;
      fc.scale.set((0.95 + 0.3 * k) * (0.5 + 0.5 * on));
      fc.power = on * Math.max(0.15, (1.1 + 0.35 * k) * (1 + flame.boost));
      [gx, gy] = bullToL(bull.x + fc.x * bull.scale.x, bull.y + fc.y * bull.scale.y);
      if (fc.visible && flame.gx != null) {                // a fast fire hand leaves a trail
        const dx = gx - flame.gx, dy = gy - flame.gy, d = Math.hypot(dx, dy);
        for (let s2 = 0; s2 < Math.min(8, d / 9); s2++) {
          const u = Math.random();
          dust.emit({ tex: Math.random() < 0.3 ? FX.tex.spark : FX.tex.dot, x: flame.gx + dx * u + (Math.random() - 0.5) * 30,
            y: flame.gy + dy * u - 50 * fc.scale.y + (Math.random() - 0.5) * 30, vx: -dx * 2, vy: -dy * 2 - 60,
            s0: 0.3 + Math.random() * 0.25, s1: 0, life: 0.3 + Math.random() * 0.2, tint: Math.random() < 0.35 ? 0xff5a20 : 0xffc040,
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
      if (handFront.visible) { handArea.copyFrom(handMask.getBounds()).pad(10); handFront.filterArea = handArea; }   // key only the hand patch
      handSpill.visible = handFront.visible && !!fc.orb;
      if (handSpill.visible) {
        handSpill.position.set(fc.x + fc.orb.orbM.x * fc.scale.x, fc.y + (fc.orb.oy + fc.orb.R * 0.95) * fc.scale.y);
        handSpill.scale.set(fc.orb.R * 2.4 * fc.scale.x / 256); handSpill.alpha = 0.34 * Math.min(1.3, fc.power);
      }
      if (!fc.visible) return;
    }
    // embers and magic sparks rising from the flame
    const fdt = Math.min(0.05, app.ticker.deltaMS / 1000);
    if (Math.random() < 8 * fdt) dust.emit({ tex: FX.tex.dot, x: gx + (Math.random() - 0.5) * 50, y: gy - 40 - Math.random() * 60, vx: (Math.random() - 0.5) * 50,
      vy: -90 - Math.random() * 120, ax: (Math.random() - 0.5) * 120, s0: 0.14 + Math.random() * 0.12, s1: 0, life: 0.7 + Math.random() * 0.6,
      tint: Math.random() < 0.35 ? 0xff5a20 : 0xffe070, a0: 1, a1: 0, blend: PIXI.BLEND_MODES.ADD });
    if (Math.random() < 1.5 * fdt) dust.emit({ tex: FX.tex.star8, x: gx + (Math.random() - 0.5) * 80, y: gy - 30 - Math.random() * 120, s0: 0.03, s1: 0.16,
      life: 0.45, a0: 1, a1: 0, tint: 0xffffff, vr: 3, blend: PIXI.BLEND_MODES.ADD });
  }

  async function present(r) {
    S.state = "present"; presentAt = performance.now();
    S.canSkip = !r.nudges.length && !r.fc && !(r.boardRuns && r.boardRuns.length) && !TIER_ORDER.includes(Engine.tier(r.totalX)); S.respin = false;
    const cells = new Set();
    r.lines.forEach((l) => l.rows.forEach((row, reel) => cells.add(reel * 3 + row))); (r.boardRuns || []).forEach((b) => cells.add(b.cell));
    // dim the losing cells. White (user 2026-11-11: "during the win, remove the frames of symbols, simply make the lighter
    // parts with bigger radius"): one dark veil per reel with a rounded hole for every winning cell
    reels.forEach((rl, reel) => {
      const x0 = REEL_X[reel][0], x1 = REEL_X[reel][1];
      const g = new PIXI.Graphics().beginFill(0x000000).drawRect(x0, rowY(0) - CELL_H / 2, x1 - x0, CELL_H * 3);
      const holes = [0, 1, 2].filter((row) => cells.has(reel * 3 + row));
      if (holes.length) {                                // consecutive winning rows make ONE light area (user 2026-11-12:
        g.beginHole();                                   // "the highlighted white parts during the win to be connected")
        for (let i = 0; i < holes.length;) {
          let j = i; while (j + 1 < holes.length && holes[j + 1] === holes[j] + 1) j++;
          const a = winHole(reel, holes[i]), b = winHole(reel, holes[j]);
          g.drawRoundedRect(a[0], a[1], a[2], b[1] + b[3] - a[1], WIN_R); i = j + 1;
        }
        g.endHole();
      }
      g.endFill(); g.alpha = 0; gsap.to(g, { alpha: 0.65, duration: 0.1 }); cellFxBack.addChild(g); winObjs.push(g);
    });
    const d = { k: 0 };
    gsap.to(d, { k: 1, duration: 0.1, onUpdate: () => {
      reels.forEach((rl, reel) => [0, 1, 2].forEach((row) => { if (!cells.has(reel * 3 + row)) rl.view(row).dim(d.k); }));
      colReel.views.forEach((v, i) => { if (i !== 4) v.dim(d.k * 0.8); });
    } });
    r.lines.forEach((l) => lineGfx.push(payline(l.rows)));
    cells.forEach((c) => { winCells[c] = cellHighlight(Math.floor(c / 3), c % 3); });
    lineIntro(r);                                     // white: the bolts run now, one line after the other
    for (const c of cells) {
      const reel = Math.floor(c / 3), row = c % 3, id = curGrid[reel][row];
      if (id === "wild" || id === "super_wild") {
        if (clips[id + "_win"]) playCellClip(id, reel, row);
        else if (id !== "super_wild") {
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
    const quiet = rung === 0 && !r.nudges.length && !r.fc && !(r.boardRuns && r.boardRuns.length), firstCount = quiet ? r.win : r.baseWin;
    plaqueShown.v = MOBILE ? firstCount : firstCount * 0.15; drawPlaque();   // white: phones show the final number at once (each redraw of this big text costs 10-30 ms there)
    plaque.alpha = 0; plaque.scale.set(0.6 * PLAQUE_S);
    gsap.to(plaque, { alpha: 1, duration: 0.1 });
    gsap.timeline().to(plaque.scale, { x: 1.05 * PLAQUE_S, y: 1.05 * PLAQUE_S, duration: 0.1, ease: "back.out(2)" })
      .to(plaque.scale, { x: PLAQUE_S, y: PLAQUE_S, duration: 0.1 });
    await FX.tween(plaqueShown, { v: firstCount, duration: S.turbo ? 0.2 : quiet ? 0.28 : 0.35, ease: "power1.out", onUpdate: () => { drawPlaqueRoll(); SFX.tick(); } });
    SFX.line();
    await FX.wait(rung === 0 ? 0.08 : S.turbo ? 0.1 : 0.25);
    // multiplier phase
    if (r.nudges.length || r.fc || (r.boardRuns && r.boardRuns.length)) {
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
      else if (r.mult >= 5 && rung > 0) {
        // 100x and up: the halo wheel above the bull's head picks the value first (src/gx_halo.js), then he throws it
        const halo = r.mult >= HALO_MIN && !params.has("nohalo");
        if (halo) await GX.run("halo", { mult: r.mult, tint: multTint(r.mult) }, 7000);
        await bullOrb({ x: COL_CX, y: COL_CY }, multTint(r.mult) === 0xffd070 ? 0xffb040 : multTint(r.mult), r.mult, r.totalX >= 10 ? 1.15 : 1.7, halo); r.bullActed = true; }
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
      linePlay(r, i);                                 // white: this line's bolt runs once and only its cells are lit
      l.rows.forEach((row, reel) => cellReplay(reel * 3 + row));   // and its symbols play their win move again
      k++;
    };
    if (lineCycle) lineCycle.kill();
    lineCycle = gsap.timeline({ repeat: -1, delay: 0.3 });
    lineCycle.call(step).to({}, { duration: 1.6 });
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
  const wildUploads = (on) => { const b = mobWild && mobWild.base_; if (b && b.resource) b.resource.autoUpdate = on; };
  function playCellClip(id, reel, row) {
    const w = clips[id + "_win"]; if (!w) return;
    wildUploads(true);
    const v = reels[reel].view(row);
    const sp = new PIXI.Sprite(w.sprite.texture); sp.anchor.set(0.5); sp.width = w.cfg.w; sp.height = w.cfg.h;
    sp.filters = w.sprite.filters; sp.clipId = id;
    v.inner.addChild(sp); v.a.visible = false;
    cellClipSprites.push(sp);
    cellClipKick(id);
    winObjs.push({ destroy: () => {
      const k = cellClipSprites.indexOf(sp); if (k >= 0) cellClipSprites.splice(k, 1);
      sp.destroy(); v.a.visible = true; if (!cellClipSprites.length) wildUploads(false);
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
  let popHandFront = null, popHandMask = null;      // white: the popup bull's fingers in front of the orb, as in the game
  if (popHero) {
    popHandFront = new PIXI.Sprite(popHero.texture); popHandFront.filters = popHero.filters; popHandFront.anchor.set(0.5, 0.5);
    popHandMask = new PIXI.Sprite(handTex); popHandMask.anchor.set(0.5); popHandFront.mask = popHandMask;
    popBody.addChild(popHandFront, popHandMask);
  }
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
  // white (redesign 2026-11-12): the amount sits on the Greek-key gold TABLET; its lacquer layer takes the tier colour
  const plateLac = new PIXI.NineSlicePlane(T("Popup/wp_tablet_tint"), 150, 0, 150, 0), plateRim = new PIXI.NineSlicePlane(T("Popup/wp_tablet_gold"), 150, 0, 150, 0);
  popPlate.addChild(plateLac, plateRim);
  const setPlate = () => { [plateLac, plateRim].forEach((n) => { n.width = 940; n.height = 238; n.position.set(-470, -119); }); };   // white: fixed tablet
  setPlate(700);
  const PLATE_TINT = { big: 0x17643a, mega: 0x1d3c9e, super: 0x8e1622, epic: 0x5c1e96, max: 0x2c2216 };   // white: deep lacquer, gold digits read
  const popTitleArt = new PIXI.Sprite(PIXI.Texture.EMPTY); popTitleArt.anchor.set(0.5, 0.5); popTitleArt.position.set(540, 724);
  const popArtMask = new PIXI.Sprite(PIXI.Texture.EMPTY); popArtMask.anchor.copyFrom(popTitleArt.anchor); popArtMask.position.copyFrom(popTitleArt.position);
  let titleBase = 1, artBase = 1;
  popBody.addChild(popCoins.c, popFlare, popAmtGlow, popPlate, popTitle, popTitleMask, popTitleArt, popArtMask, popShine, popAmt, popHint);
  // white (redesign 2026-11-12): the triumph emblem - a gold laurel MEDALLION behind the bull, the title on a RIBBON
  const wpSpr = (n) => { const sp = new PIXI.Sprite(T("Popup/" + n)); sp.anchor.set(0.5); return sp; };
  const popMed = new PIXI.Container(); popMed.position.set(540, 410); const medTint = wpSpr("wp_medallion_tint"); popMed.addChild(medTint, wpSpr("wp_medallion_gold"));
  popBody.addChildAt(popMed, popHero ? popBody.getChildIndex(popHero) : popBody.getChildIndex(popBurst2) + 1);
  const popBan = new PIXI.Container(); popBan.position.set(540, 728); const banTint = wpSpr("wp_banner_tint"); popBan.addChild(banTint, wpSpr("wp_banner_gold"));
  popBody.addChildAt(popBan, popBody.getChildIndex(popTitle));
  const WP_COL = { big: 0x2fbf5f, mega: 0x3a6cff, super: 0xe0303a, epic: 0xa050ff, max: 0xfff1d6 };
  const popFaders = [popMed, popBan, popDark, popGlow, popBurst, popBurst2, popCoins.c, popFlare, popTitle, popHint, popAmtGlow, popShine, popPlate, popTitleArt].concat(popHero ? [popHero] : [], popRays ? [popRays] : [], popFlame ? [popFlame] : [], popHandFront ? [popHandFront] : []);
  pop.eventMode = "static"; pop.hitArea = new PIXI.Rectangle(0, 0, W, H);
  let popTap = null, titlePulse = null;
  pop.on("pointertap", () => popTap && popTap());
  function setTierTitle(t, first) {
    GX.emit("popupTier", { tier: t, first });
    const look = TIER_LOOK[t];
    popTitle.text = TIER_NAME[t]; popTitle.style.fill = look.fill; popTitle.style.stroke = look.stroke;
    const base = Math.min(1, 980 / (popTitle.width / popTitle.scale.x));
    titleBase = base;
    const art = POP_ART("title_" + t);                 // custom title lettering + crest per tier; text only as fallback
    popTitleArt.visible = !!art;
    if (art) {
      popTitleArt.texture = popArtMask.texture = art; artBase = Math.min(0.5, 740 / art.width);   // white: 2x art, fits the ribbon
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

    plateLac.tint = PLATE_TINT[t] || 0x5a0d1c; medTint.tint = banTint.tint = WP_COL[t] || 0xe0303a;
    gsap.fromTo(popBan.scale, { x: first ? 0.6 : 1.14, y: first ? 0.6 : 1.14 }, { x: 1, y: 1, duration: first ? 0.32 : 0.3, ease: "back.out(2.2)" });
    gsap.fromTo(popMed.scale, { x: first ? 0.7 : 1.07, y: first ? 0.7 : 1.07 }, { x: 1, y: 1, duration: first ? 0.45 : 0.35, ease: "back.out(1.8)" });
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
    GX.emit("popupOpen", { amount, x });
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
      const close = async () => {
        popTap = null;
        await GX.run("popupClose", { tier: steps[cur], amount });
        app.ticker.remove(coinTick); shineTw.kill(); VFX.bloom(false); SFX.musicBack();
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
    colTease.addChild(fill, band, rim);                 // white: no big pointers, the small frame arrows knock instead
    Object.assign(colTease, { box: [x0, y0, x1, y1], band, rim, ptr: cfArrows, heat: 0 });
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
    const v = colReel.views[4];
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
      // white: with the 50,000x cap a real max win needs Fortune Choice: a board of SUPER WILDs, the 1000x chip in the
      // centre, the first seed whose round hits the cap (found in under a few thousand seeds in every mode)
      const sg = [0, 1, 2].map(() => ["super_wild", "super_wild", "super_wild"]), ci = Engine.STRIP.indexOf(1000);
      for (let sd = 1; sd < 300000 && !r; sd++) { const t = Engine.settle(sg, ci, bet, stake(), Engine.mulberry32(sd)); if (t.capped) r = t; }
      if (!r) r = Engine.settle([["wild", "wild", "K"], ["wild", "wild", "J"], ["wild", "wild", "A"]], Engine.STRIP.indexOf(1000), bet, stake());
    }
    else if (force) { const f = Engine.findRound(force, bet, exArg(), 1 + Math.floor(Math.random() * 1e6)); r = f ? f.round : Engine.spin(bet, exArg()); }
    else r = Engine.spin(bet, exArg());
    window.G.last = r;
    setBalance(S.balance - r.stake, false);
    if (buyKind) { showMsg(Engine.BUY[buyKind].name + "!"); await bullCharge(); }
    if (r.bought === "bonus") {                       // white (spec): the Buy enters Fortune Choice at once, no spin
      await buyShow(r);
      gsap.globalTimeline.timeScale(BASE_TS);
      S.state = "idle"; setUiLocked(false); S.canSkip = false;
      return;
    }
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
    reels.forEach((rl) => rl.start(0, tb)); colReel.start(0, tb);   // Garuda: every reel starts at once, no lift
    // Porco: each reel may start its stop when the previous one has; stops come one loop apart (~0.4 s)
    const tStop = tb ? [0.1, 0.15, 0.2, 0.25] : [0.58, 0.76, 0.94, 1.06], LEAD = 0;   // Garuda (measured): hard stops 0.72 / 0.90 / 1.08 / 1.25 s     // timing pass 2026-11-10 (was 0.6/1.0/1.4/1.7)
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
          GX.emit("tease", { reel: 2 });
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
    const colFinal = [3, 2, 1, 0, -1, -2, -3].map((k) => (k > 0 && k <= r.nudges.length ? colIdxOf(r.nudges[k - 1]) : stripAt(colC, k)));   // white (spec)
    if (r.win > 0 && !tb && !quick) {                // a win to multiply: the column rolls on, ticking chip by chip
      colTeaseOn();
      const small = r.win < r.stake && !r.nudges.length && !r.fc && !(r.boardRuns && r.boardRuns.length);            // a short roll for a win below the stake
      landed.push(colReel.teaseStop(colFinal, { vSlow: small ? 5.5 : 4.2, tau: 0.2, t1: small ? 0.42 : 0.85, t2: small ? 0.45 : 0.75, over: 0.09,
        extra: (n) => Array.from({ length: n }, (_, k) => stripAt(colC, k - n - 2)),
        onTick: (left, v) => {
          if (v < 11) colTeaseTick(left);
          // a 500x / 1000x chip passing the centre: the roll hangs on it for a moment and the bull leans in
          const val = Engine.STRIP[colReel.syms[4]];
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
    // white: no board bump on a plain reel stop (letters); WILD / SUPER WILD / CHARGE landings drop it hard
    for (let row = 0; row < 3; row++) {
      const id = r.grid[i][row];
      if (id === "charge" && r.boardCharges && r.boardCharges[i * 3 + row]) {   // white: a CHARGE symbol lands with its count
        const cv = reels[i].view(row), cx = REEL_CX[i], cy = rowY(row);
        cv.showCharge(r.boardCharges[i * 3 + row]); gsap.fromTo(cv.chg.scale, { x: 1.6, y: 1.6 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" });
        ringAt(cx, cy, 0xc070ff, 1.5, 0.4); flashAt(cx, cy, 0xe0b0ff, 1.0, 0.25); SFX.nudgeActivate(); buzz(15); boardDrop(1);
      }
      if (Engine.WILDS.has(id)) {
        const x = REEL_CX[i], y = rowY(row);
        const v = reels[i].view(row);
        gsap.killTweensOf(v.inner.scale); gsap.fromTo(v.inner.scale, { x: 1.08, y: 1.08 }, { x: 1, y: 1, duration: 0.16, ease: "power2.out" });
        ringAt(x, y, id === "wild" ? 0xd9a0ff : 0xff8a3a, 1.8, 0.5); flashAt(x, y, 0xffe0a0, 1.3, 0.3);
        burstAt(x, y, id === "wild" ? 0xe0b0ff : 0xffa050, 16, boardP); boom(x, y, 1.0, id === "wild" ? 0xe8c8ff : null, boardFx);
        VFX.shockwave(x, y, { amp: 12, radius: 300, wave: 90, dur: 0.45 }); starFlash(x, y, 1.6, id === "wild" ? 0xe0b0ff : 0xffc080);
        if (id === "super_wild") { SFX.superLand(); hitStop(50); buzz(30); } else { SFX.wildLand(); buzz(15); }
        if (id === "super_wild" && v.cnt && r.superCharges) { v.cnt.text = String(r.superCharges[i * 3 + row] || Engine.NUDGES); gsap.fromTo(v.cnt.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.5)" }); }
        GX.emit("wildLand", { reel: i, row, id, x, y, view: v }); boardDrop(id === "super_wild" ? 1.4 : 1);
      }
    }
  }
  // a NUDGE chip in the centre fires: cyan shock, lightning, "+N NUDGES" flies to the counter
  async function nudgeChipFire(n) {
    boardDrop(1.2);                                      // white: a CHARGE fires: strong drop
    const v = colReel.views[4];
    if (v.reveal) await v.reveal(n);                    // white: the badge's chevrons fly up and its count rolls in
    gsap.fromTo(v.inner.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.6, ease: "elastic.out(1,0.45)" });
    gsap.fromTo(v.flash, { alpha: 1 }, { alpha: 0, duration: 0.7 });
    gsap.fromTo(v.magic.uniforms, { uAmp: 5 }, { uAmp: 1, duration: 1.2 });
    ringAt(COL_CX, COL_CY, 0x5ff0ff, 2.0, 0.5); flashAt(COL_CX, COL_CY, 0xbaffff, 1.1, 0.1);
    burstAt(COL_CX, COL_CY, 0x7ff4ff, 12); boom(COL_CX, COL_CY, 1.1, 0xa8f6ff); lightning(COL_CX, COL_CY, 0xbaffff);
    SFX.nudgeActivate(); shake(8, 0.25);
    const t = new PIXI.Text(`+${n} CHARGES`, FX.gold(44, { fill: ["#F0FFFF", "#7FF4FF", "#1A9FB0"] }));
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
      "The centre multiplier of the column multiplies the line win.",
      "A CHARGE chip in the centre, or a CHARGE symbol on the reels, of a win",
      "runs its actions on the column: each adds a multiplier.",
      "A SUPER WILD in a win opens FORTUNE CHOICE: its number = Choices,",
      "9 positions: multipliers, CHARGE and +2 Choices; line win x Bonus Total.",
      `EXTRA BET ${Engine.MODES[1].cost}x / ${Engine.MODES[2].cost}x / ${Engine.MODES[3].cost}x: multipliers 3x / 15x / 50x and up.`,
      `BUY ${Engine.BUYM.cost}x: Fortune Choice at once. Max win ${FX.money(Engine.MAX_WIN, 0)}x bet. RTP 97.01% (demo maths).`,
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
      if (mobWild && mobWild.base_ && !mobWild.upInit_) { mobWild.upInit_ = true; if (!cellClipSprites.length) wildUploads(false); }
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
      emberT = 1e9;   // white: no vase fires, so no embers from them
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
    if (frameSweepT < 0) { frameSweepT = 6.5; frameShine.x = -300; frameShine.visible = true; gsap.to(frameShine, { x: 1400, duration: 1.6, ease: "power1.inOut", onComplete: () => { frameShine.visible = false; } }); }
    sparkT -= dt;
    if (sparkT < 0) {
      sparkT = 0.35 + Math.random() * 0.4;
      const [x, y] = fxPts.frame_sparkles[Math.floor(Math.random() * fxPts.frame_sparkles.length)];
      boardP.emit({ tex: FX.tex.spark, x, y, s0: 0.05, s1: 0.45, life: 0.6, a0: 1, a1: 0, vr: 2, tint: 0xfff0c8 });
    }
    chipGlintT -= dt;
    if (chipGlintT < 0 && colReel.state === "idle") {
      chipGlintT = 1.2 + Math.random() * 1.5;
      const v = colReel.views[1 + Math.floor(Math.random() * 7)];
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
        e.t = 0.18; e.n = 0; return;   // white: no sparkles on the winners (user: "remove the white blotches")
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
    GX.emit("introBegin", {});
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
    GX.emit("introDone", {});
    S.state = "idle";
  };
  loadC.eventMode = "static"; loadC.hitArea = new PIXI.Rectangle(0, 0, W, H); loadC.cursor = "pointer";
  loadC.once("pointertap", begin);

  // keyboard + demo hooks
  const KEYS = { "1": "win", "2": "wild", "3": "superwild", "4": "big", "5": "mega", "6": "super", "7": "epic", "8": "tease", "9": "m1000", "0": "nowin", n: "nudge4", m: "max", g: "nudgechip", h: "nudgechain", c: "clash", w: "halo" };
  window.addEventListener("keydown", (e) => {
    if (exBet.isOpen()) { if (e.code === "Escape") exBet.close(); return; }      // white: no spin behind the EXTRA BET popup
    if (e.code === "Space") { e.preventDefault(); onSpinPress(); return; }
    if (e.key === "b" && buyUI && S.state === "idle") { buyUI.open(); return; }
    if (KEYS[e.key] && S.state === "idle") spin(KEYS[e.key]);
  });
  // taps unlock the phone's videos (iOS Low Power Mode / data saver refuse play() outside a gesture)
  if (MOBILE) ["pointerdown", "touchend", "click", "keydown"].forEach((ev) => window.addEventListener(ev, () => {
    if (mobBull) mobBull.unlock(); if (mobWild) mobWild.unlock();
  }, { capture: true, passive: true }));
  // effect plugins (src/gx_*.js): the game's internals in one object, then every registered plugin starts
  GX.start({ PIXI, gsap, app, W, H, MOBILE, GPASS, params, S, Engine, FX, VFX, SFX, T, reels, colReel,
    REEL_X, REEL_CX, CELL_Y0, CELL_H, WIN_Y1, rowY, COL_CX, COL_CY, COL_P, TRAY, HIGH,
    layers: { bgL, ambBack, bullL, ambFront, boardL, uiL, fxTop, popL, board, boardFx, cellFxBack, frameL, reelsL, plaqueL },
    pop: { pop, popBody, popDark, popGlow, popBurst, popTitle, popTitleArt, popAmt, popPlate, popHero, popRays, popFlame, popCoins, popFaders, POP_DY },
    bull, bullFit, bullToL, bullDir, bullReact, handNow, flame, featRays, vignette, topP, boardP, winObjs,
    burstAt, ringAt, boom, flashAt, starFlash, lightBeam, lightning, shake, hitStop, flameKick, multTint, nEmit,
    fireFrame, tease, colTease, FireRect, embers, TITLE: !GPASS,
    isFeature: () => featureOn });
  window.G = { mobBull: () => mobBull, mobWild: () => mobWild, bullView: () => ({ still: bullSpr.visible, clip: !!(bullClipC ? bullClipC.visible : clips.bull_idle), alpha: bull.worldAlpha }), spin, S, reels, colReel, Engine, clips, feature, bullSlam, bullCharge, bullOrb, bullPlay, bullDir, bullReact, buy: (k) => spin(null, k), buyUI: () => buyUI, state: () => S.state, last: null, popOpen: () => pop.visible && !!popTap, tapPop: () => popTap && popTap() };
  window.G.toggleEx = toggleEx; window.G.exBet = exBet; window.G.exPress = exPress;
  if (params.has("autostart")) begin();
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
