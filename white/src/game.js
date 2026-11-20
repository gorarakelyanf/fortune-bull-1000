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
  const TIER_X = { big: 10, mega: 20, super: 50, epic: 100, max: Engine.MAX_WIN };   // b24: MEGA from 20x (= Engine.tier)
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
  // b22: the V4 build's still bull (shown while the videos load) = the first frame of the new idle (tools/bull_moves_b22.py notes; assets_v4/Character/bull_v5.webp, 964 px = the clip frame on the board)
  const artSrc = (p) => VER === 4 && p === "Character/bull" ? "assets_v4/Character/bull_v5.webp" : `${VER === 4 && p === "Character/bull" ? "assets_v4" : OLD_SYM && OLD_SYM.test(p) ? "assets_v1" : ART}/${p}.webp`;
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
  // white (video audit 2026-11-12): phones and tablets get the phone build by themselves (touch is their main pointer);
  // ?desktop forces the desktop build. A plain link on a phone used to load six separate videos.
  const MOBILE = params.has("mobile") || (!params.has("desktop") && ((window.matchMedia && matchMedia("(pointer: coarse)").matches) ||
    (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))));
  const CLIPV = window.CLIPV ? "?v=" + window.CLIPV : "";    // white: the clips' content hash (build_deploy.py)
  const BASE_TS = +(params.get("ts") || 1);          // ?ts=0.1 = slow motion (QA video capture)
  gsap.globalTimeline.timeScale(BASE_TS);

  // ---------- app ----------
  const app = new PIXI.Application({ backgroundColor: 0x000000, antialias: !MOBILE, autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2), resizeTo: window });
  // b23 (user 2026-11-20: "put the background of the game during the loading"): the canvas stays hidden until the loading
  // screen's background is drawn in it; until then index.html's #bootbg shows the same background (no black screen)
  app.view.style.visibility = "hidden";
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
  // b23 (user 2026-11-20: "check what can we optimize for fast loading and mobile"): every boot download starts here at
  // once (it used to be a chain: font, font, logo, five JSON files, then the art, each waiting for the one before)
  const getJSON = (u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + " " + r.status); return r.json(); });
  const layoutP = getJSON("assets/layout.json"), fxPtsP = getJSON("assets/fx_points.json");
  const clipListP = getJSON("assets/clips/clips.json" + CLIPV).catch(() => ({}));
  const v4ClipsP = VER === 4 ? getJSON("assets/clips/v4/clips.json" + CLIPV).catch((e) => { console.warn("v4 clips", e); return null; }) : Promise.resolve(null);
  const mobClipsP = MOBILE && window.SegVideo ? getJSON("assets/clips/m/clips.json" + CLIPV).catch((e) => { console.warn("mobile clips", e); return null; }) : Promise.resolve(null);
  [layoutP, fxPtsP].forEach((p) => p.catch(() => {}));   // awaited (and thrown) below; no "unhandled" noise meanwhile
  // a page may embed the fonts (window.FONT_URLS, data: URIs) so it ships only media files (shared Artifact build)
  // b23: WOFF2 (~half the TTF), the TTF stays as the fallback
  const fontsP = Promise.all([["PoppinsB", "poppinsBold", "700"], ["PoppinsM", "poppinsMedium", "500"]].map(async ([fam, file, wt]) => {
    const u = (window.FONT_URLS || {})[fam];
    const f = new FontFace(fam, u ? `url(${u})` : `url(assets/fonts/${file}.woff2) format("woff2"), url(assets/fonts/${file}.ttf) format("truetype")`, { weight: wt });
    document.fonts.add(await f.load());
  }));
  const logoP = PIXI.Assets.load("assets/UI/logo.webp").catch((e) => { console.warn("logo", e); return null; });
  const goldP = window.GOLD_FNT ? PIXI.Assets.load("assets/fonts/gold_digits.png").then((t) => PIXI.BitmapFont.install(window.GOLD_FNT, t))   // embedded .fnt
    : PIXI.Assets.load("assets/fonts/gold_digits.fnt");   // b23: its page is gold_digits.webp (450 KB PNG -> ~100 KB)
  goldP.catch(() => {});
  // b23: the background first. Same URL as index.html's #bootbg, through an <img> so the browser reuses that download
  const BG_URL = artSrc("BG/bg_main");
  const bgTex = await new Promise((res) => {
    const im = new Image();
    try { if (new URL(BG_URL, document.baseURI).origin !== location.origin) im.crossOrigin = "anonymous"; } catch (e) { /* relative */ }
    im.onload = () => { try { const t = PIXI.Texture.from(im); PIXI.Assets.cache.set(BG_URL, t); res(t); } catch (e) { res(null); } };
    im.onerror = () => res(null);
    im.src = BG_URL;
  });
  let backdropSet = false;
  function setBackdrop(tex) {
    backdropSet = true;
    backdrop.texture = tex;
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
  }
  const loadC = new PIXI.Container();
  root.addChild(loadC);
  // b24 (user 2026-11-20: "make the background bit darker"): a black veil over the loading background (index.html's
  // #bootbg uses the same 0.35 so the hand-over matches); it fades out with the loading screen as the game begins
  const LOAD_DIM = 0.35;
  if (bgTex) { loadC.addChild(new PIXI.Sprite(bgTex), new PIXI.Graphics().beginFill(0x000000, LOAD_DIM).drawRect(0, 0, W, H).endFill()); setBackdrop(bgTex); }
  const barBg = new PIXI.Graphics().beginFill(0x2a0c10).drawRoundedRect(240, 1120, 600, 26, 13).endFill()
    .lineStyle(3, 0xe8a640).drawRoundedRect(240, 1120, 600, 26, 13);
  const bar = new PIXI.Graphics();
  loadC.addChild(barBg, bar);
  try { app.render(); } catch (e) { /* drawn by the ticker */ }
  app.view.style.visibility = "";
  { const b = document.getElementById("bootbg"); if (b) b.remove(); }

  // the art (the background is already here)
  const files = [];
  const add = (p) => files.push(artSrc(p));
  if (!bgTex) add("BG/bg_main");
  add("Character/bull");
  const VFRAME = params.has("vframe");   // white trial: the vector-drawn gold frame
  [VFRAME ? "frame_vec" : "frame", "mult_tray", "panel_reels"].forEach((n) => add("Board/" + n));
  for (const s of Engine.SYMBOLS) {
    add(`Symbols/${s}`); add(`Symbols/${s}_blur`); add(`Symbols/${s}_off`);
    if (HIGH.has(s)) ["_tile", "_tile_blur", "_tilebg"].forEach((k) => add(`Symbols/${s}${k}`));
  }
  for (const v of Engine.MULT_VALUES) { add(`Multipliers/chip_bg_${v}`); add(`Multipliers/label_${v}x`); }
  add("Multipliers/chip_bg_nudge"); Engine.NUDGE_CHIPS.forEach((v) => add(`Multipliers/label_nudge${-v}`));
  if (V2ART) { add("Multipliers/chip_bg_nudge5"); add("UI/buy_button"); }
  ["title_big", "title_mega", "title_super", "title_epic", "title_max", "wp_medallion_gold", "wp_medallion_tint", "wp_banner_gold", "wp_banner_tint", "wp_tablet_gold", "wp_tablet_tint"].forEach((n) => files.push(`assets/Popup/${n}.webp`));
  ["chip_coat", "chip_glints", "chip_rim", "chip_shadow"].forEach((n) => add("Multipliers/" + n));
  ["Multipliers/centre_frame", "UI/nudge_box", "UI/total_box", "UI/counter_screen", "UI/counter_board", "UI/counter_board_red", "UI/counter_board_open", "UI/buy_bg", "UI/total_plate", "UI/cf_arrow", "vfx/winline", "vfx/winline_rest", "UI/exp_panel", "UI/exp_card_red", "UI/exp_card_amber", "UI/exp_card_purple", "UI/exp_confirm", "UI/buy_label", "UI/ex_plate", "UI/charge_badge", "UI/charge_window", "UI/charge_chev", "UI/charge_digit_0", "UI/charge_digit_1", "UI/charge_digit_2", "UI/charge_digit_3", "UI/charge_digit_4", "UI/charge_digit_5", "UI/charge_digit_6", "UI/charge_digit_7", "UI/charge_digit_8", "UI/charge_digit_9", "UI/charge_digit_slash", "UI/total_x", "UI/charge_rect", "UI/charge_rect_window", "UI/ex_switch_off", "UI/ex_switch_on", "UI/ex2_off", "UI/ex2_on", "UI/buy2", "UI/counter_board_red_thin"].forEach((p) => files.push(`assets/${p}.webp`));   // every art set uses these   // b21: ex2_* / buy2 = the user's new buttons
  if (GPASS) ["Board/panel_dark", "Board/tile_low", "Board/tile_low_blur", "Board/tray_dark", "Board/plinth_slim", "Board/plinth_fade", "Board/frame_stone"].forEach((p) => files.push(`assets/${p}.webp`));
  if (COINS) { Engine.MULT_VALUES.forEach((v) => files.push(`assets/Multipliers/coin_${v}.webp`)); ["coin_shadow", "coin_rim", "centre_frame_thin"].forEach((n) => files.push(`assets/Multipliers/${n}.webp`)); }
  ["autoplay", "autoplay_shadow", "balance_bar_border", "balance_bar_fill", "bet_window_border", "bet_window_fill",
    "ex_button", "ex_shadow", "icon_menu", "icon_sound", "minus", "minus_shadow", "plus", "plus_shadow", "spin_arrows",
    "spin_base", "spin_glow", "spin_shadow", "turbo", "turbo_shadow", "win_bar"].forEach((n) => add("UI/" + n));
  const NO_ART = params.has("codefx");                 // ?codefx = the old code-drawn effects, for comparison
  if (!NO_ART) FX.ART.filter((n) => n !== "magic_sheet" && n !== "fire_strip").forEach((n) => files.push(`assets/vfx/${n}.webp`));   // white: the hand is the orb shader, no fire strip
  const loadBar = (p) => bar.clear().beginFill(0xffc24a).drawRoundedRect(243, 1123, 594 * p, 20, 10).endFill();
  const artP = (async () => {
    for (let tries = 0; ; tries++) {                 // one failed fetch must not kill the boot: retry the missing files
      try { await PIXI.Assets.load(files, loadBar); break; }
      catch (e) { if (tries >= 3) throw e; console.warn("assets: retry", tries + 1); await new Promise((r) => setTimeout(r, 400)); }
    }
  })();
  artP.catch(() => {});

  await fontsP;
  FX.init();
  if (window.CustomEase) {
    gsap.registerPlugin(CustomEase);
    CustomEase.create("fbStop", "M0,0 C0.126,0.382 0.24,0.77 0.375,0.924 0.441,1 0.5,1.022 0.647,1.021 0.726,1.02 0.853,1.013 1,1");
    CustomEase.create("fbStopTurbo", "M0,0 C0,0 0.383,0.757 0.639,1.013 0.703,1.077 1,1 1,1");
  }
  VFX.init({ app, root, lite: params.has("lite") || MOBILE });
  const loadTxt = new PIXI.Text("LOADING", FX.gold(36));
  loadTxt.anchor.set(0.5); loadTxt.position.set(540, 1200);
  loadC.addChild(loadTxt);
  // white 2026-11-17 (user: "put this as a loading screen"): the user's FORTUNE BULL 1000 logo (tools/batch17_art.py ->
  // assets/UI/logo.webp, its black keyed out). b24 (user 2026-11-20: "remove fortune bull old text from loading"): the
  // old gold text lines are gone (they showed until the logo arrived); no logo = no title, never the old text
  const lt = await logoP;
  if (lt) {
    const logo = new PIXI.Sprite(lt); logo.anchor.set(0.5); logo.position.set(540, 860); logo.scale.set(980 / lt.width);
    loadC.addChildAt(logo, bgTex ? 2 : 0);   // above the background and its veil
  }

  const layout = await layoutP;
  const fxPts = await fxPtsP;
  let clipList = await clipListP;
  if (VER === 4) {                                   // V4 bull clips replace the bull_* entries (same placement, own tracks)
    try { const v4 = await v4ClipsP; if (!v4) throw new Error("no v4 clips.json");
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
      const mc = await mobClipsP; if (!mc) throw new Error("no mobile clips.json");
      mobBull = new SegVideo.SegPlayer("assets/clips/m/" + mc.bull.file + CLIPV, mc.bull.segments, { fps: mc.fps, minRate: 0.5, maxRate: 2.5 });
      mobWild = new SegVideo.SegPlayer("assets/clips/m/" + mc.wilds.file + CLIPV, mc.wilds.segments, { fps: mc.fps, minRate: 1, maxRate: 1, lazy: true });
      // white (video audit): the bull video downloads alone first; the wild video starts once it is all here (10 s at most)
      { const w0 = performance.now(), go = () => { if (mobBull.full() || performance.now() - w0 > 10000) mobWild.start(); else setTimeout(go, 250); }; go(); }
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
      // white (video audit): in the page, invisible (some browsers throttle a video that is not in the document)
      v.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1"; document.body.appendChild(v);
      v.defaultPlaybackRate = v.playbackRate = BASE_TS;          // clips follow ?ts= slow motion too
      const meta = new Promise((res) => { v.addEventListener("loadedmetadata", res, { once: true }); v.addEventListener("error", res, { once: true }); });
      const ready = new Promise((res) => { v.addEventListener("canplaythrough", res, { once: true }); v.addEventListener("error", res, { once: true }); });
      const start = () => { if (!v.src) { v.src = `assets/clips/${dir}${c.file}${CLIPV}`; v.load(); } };
      clipPend[name] = { video: v, sprite: null, cfg: c, meta, ready, start };
      // white (video audit): the boot waits for the first frame (iOS never fires canplaythrough for a paused video)
      const first = new Promise((res) => { v.addEventListener("loadeddata", res, { once: true }); v.addEventListener("error", res, { once: true }); });
      if (BOOT_CLIPS.has(name)) { start(); clipReady.push(Promise.race([first, new Promise((res) => setTimeout(res, 15000))])); }
    } catch (e) { console.warn("clip", name, e); }
  }
  await artP;
  if (!NO_ART) FX.useArt((n) => PIXI.Assets.get(`assets/vfx/${n}.webp`));
  await goldP;
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
  // white (video audit 2026-11-12): one GPU upload per NEW video frame (requestVideoFrameCallback = updateFPS 0) instead
  // of a fixed 24-30 fps timer that skipped frames and re-sent unchanged ones. A browser that never calls back for a
  // playing video gets the timer back.
  const vidFPS = (v) => (v.requestVideoFrameCallback ? 0 : 30);
  function vidProbe(bt, v, fps) {
    if (!v.requestVideoFrameCallback || !bt || !bt.resource) return;
    let ok = false; v.requestVideoFrameCallback(() => { ok = true; });
    const chk = () => { if (!ok && !v.paused && bt.resource) { bt.resource.updateFPS = fps; console.warn("video: no frame callbacks, timer uploads"); } };
    if (!v.paused) setTimeout(chk, 1500); else v.addEventListener("playing", () => setTimeout(chk, 1500), { once: true });
  }
  // white (video audit): a clip plays only once it is downloaded (a phone segment: its time range; a file: all of it)
  function clipBuffered(v) {
    if (v.ready) return v.ready();
    const b = v.buffered, d = v.duration;
    if (!d || !b) return false;
    for (let i = 0; i < b.length; i++) if (b.start(i) <= 0.05 && b.end(i) >= d - 0.1) return true;
    return false;
  }
  function activateClip(name) {
    const o = clipPend[name]; if (!o || clips[name]) return;
    const v = o.video, c = o.cfg;
    if (!v.videoWidth || v.error) { console.warn("clip not loaded", name, v.error ? v.error.code + " " + v.error.message : "no size", "ready", v.readyState, "net", v.networkState); return; }
    let tex;
    if (o.shared) {                                   // phone build: one texture per shared video, wilds as halves of it
      const pl = o.shared;
      if (!pl.base_) { pl.base_ = PIXI.BaseTexture.from(pl.v, { resourceOptions: { autoPlay: false, updateFPS: pl.v.requestVideoFrameCallback ? 0 : pl.fps } }); vidProbe(pl.base_, pl.v, pl.fps); }
      tex = o.frame ? new PIXI.Texture(pl.base_, new PIXI.Rectangle(o.frame[0], o.frame[1], o.frame[2], o.frame[3])) : new PIXI.Texture(pl.base_);
    } else { tex = PIXI.Texture.from(v, { resourceOptions: { autoPlay: false, updateFPS: vidFPS(v) } }); vidProbe(tex.baseTexture, v, 30); }
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
  // white 2026-11-17 (user: "move the board, character and spin to win bit upper, we have some space"): the bull, the board
  // (with its SPIN TO WIN bar) and the effect overlay sit LIFT higher; the background and the buttons stay. Wrappers, so
  // the board's own drop / recoil tweens (boardL.y back to 0) and the bull's intro keep working; post-FX follow (VFX.liftY)
  const LIFT = -50;
  const liftL = new PIXI.Container(); liftL.y = LIFT; world.addChildAt(liftL, world.getChildIndex(bullL));
  [bullL, ambFront, boardL].forEach((l) => liftL.addChild(l));
  const liftTop = new PIXI.Container(); liftTop.y = LIFT; root.addChildAt(liftTop, root.getChildIndex(fxTop)); liftTop.addChild(fxTop);
  VFX.liftY = LIFT;
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
  if (!backdropSet) setBackdrop(T("BG/bg_main"));     // b23: normally done at boot, with the loading background

  // bull: container pivoted at the bottom centre so breathing grows from the board
  const bl = L("bull");
  const bull = new PIXI.Container();
  bull.position.set(bl.x + bl.w / 2, bl.y + bl.h);
  const bullSpr = new PIXI.Sprite(T("Character/bull"));
  // b22: the new still is the whole square clip frame (964 px at 25.16, -52.58 on the board), not the layout box
  const STILL_D = bullSpr.texture.width > 900 ? { x: 25.16 - bl.x, y: -52.58 - bl.y } : { x: 0, y: 0 };
  bullSpr.position.set(-bl.w / 2 + STILL_D.x, -bl.h + STILL_D.y);
  const bullAura = new PIXI.Sprite(FX.tex.glow);
  bullAura.anchor.set(0.5); bullAura.position.set(0, -bl.h * 0.62); bullAura.scale.set(5.5, 5);
  bullAura.tint = 0xffb040; bullAura.blendMode = PIXI.BLEND_MODES.ADD; bullAura.alpha = 0;
  bull.addChild(bullAura, bullSpr);
  const EYES = bullSpr.texture.width > 900 ? [[474, 169], [554, 169]] : [[497, 168], [602, 168]];   // b22: the new bull's eyes
  const eyes = EYES.map(([x, y]) => {
    const e = new PIXI.Sprite(FX.tex.glow);
    e.anchor.set(0.5); e.position.set(x - bull.x, y - bull.y); e.scale.set(0.32, 0.2);
    e.tint = 0xff9a1a; e.blendMode = PIXI.BLEND_MODES.ADD; e.alpha = 0.45;
    if (bullSpr.texture.width > 900) e.renderable = false;   // b22: the new still has its own glowing eyes (the overlay read as bright glasses)
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
  // b22 (user 2026-11-20: "can we fix the hand cutout issue without regenerating the video?"): a move whose hand leaves
  // the generated frame (the FLUX throw: fingertips cut by the frame's left edge in the wind-up, grazing the right after the
  // release) gets a soft fade over its left / right edges (cfg.fade = the fraction of the frame width), so the fingers fade
  // out instead of ending on a straight line. The missing finger pixels were never generated; this only hides the cut.
  const fadeTexs = {};
  function edgeFadeTex(fr) {
    const k = fr.toFixed(3); if (fadeTexs[k]) return fadeTexs[k];
    const c = document.createElement("canvas"); c.width = 512; c.height = 4; const g = c.getContext("2d"), im = g.createImageData(512, 4);
    const ss = (e, x) => { const t = Math.min(1, Math.max(0, x / e)); return t * t * (3 - 2 * t); };
    for (let x = 0; x < 512; x++) { const u = (x + 0.5) / 512, a = Math.round(255 * ss(fr, u) * ss(fr, 1 - u));
      for (let y = 0; y < 4; y++) { const i = (y * 512 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = a; } }
    g.putImageData(im, 0, 0); return (fadeTexs[k] = PIXI.Texture.from(c));
  }
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
    if (o.cfg.fade && !o.fadeMask && sp.parent) {             // b22: the soft edge fade (see edgeFadeTex)
      const m = new PIXI.Sprite(edgeFadeTex(o.cfg.fade)); m.position.copyFrom(sp.position); m.width = o.cfg.w; m.height = o.cfg.h;
      sp.parent.addChildAt(m, sp.parent.getChildIndex(sp) + 1); sp.mask = m; o.fadeMask = m;
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
  if (!params.has("bgfx")) { rays.forEach((r) => (r.renderable = false)); sunGlow.renderable = false; }   // white 2026-11-16: background effects off
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
  // b19 (user 2026-11-19: "distance between spin to win board and main board needs to be 2x less"): the whole win bar
  // (panel, divider, both rows, message, plaque, everything keyed to WB_Y1 / WB_Y2) sits WB_DY higher; gap 17 -> 9 px (0 = old)
  const WB_DY = -8;
  const winBar = new PIXI.Sprite(T("UI/win_bar")); winBar.position.set(L("win_bar").x, L("win_bar").y + WB_DY);
  if (GPASS) { winBar.texture = T("Board/plinth_fade"); winBar.position.set((W - winBar.texture.width) / 2, 1295); }   // slim win ledge whose ends fade into the stairs     // bronze win ledge under the board (gap #6)
  const panel = new PIXI.Sprite(T(GPASS ? "Board/panel_dark" : "Board/panel_reels")); panel.position.set(L("panel_reels").x, L("panel_reels").y);
  const tray = new PIXI.Sprite(T(COINS ? "Board/tray_dark" : "Board/mult_tray")); tray.position.set(L("mult_tray").x, L("mult_tray").y);
  const colBack = new PIXI.Container(), cellFxBack = new PIXI.Container(), frameL = new PIXI.Container(),
    reelsL = new PIXI.Container(), colFront = new PIXI.Container(), boardFx = new PIXI.Container(), plaqueL = new PIXI.Container();
  const colFrontCB = new PIXI.Container();             // white 2026-11-17: the centre CHARGE badges (ChipView.fc), over the chip numbers
  const board = new PIXI.Container();
  board.addChild(winBar, panel, tray, colBack, cellFxBack, frameL, reelsL, colFront, colFrontCB, boardFx, plaqueL);
  boardL.addChild(board);
  const frame = new PIXI.Sprite(T(GPASS ? "Board/frame_stone" : VFRAME ? "Board/frame_vec" : "Board/frame")); frame.position.set(0, 585);   // stone: no rails between the reels
  frameL.addChild(frame);
  const frameTop = new PIXI.Sprite(new PIXI.Texture(frame.texture.baseTexture, new PIXI.Rectangle(frame.texture.frame.x, frame.texture.frame.y, frame.texture.frame.width, 28)));
  frameTop.position.set(0, 585); board.addChildAt(frameTop, board.getChildIndex(reelsL) + 1);   // white: the top edge stays over the symbols
  { const m = new PIXI.Graphics().beginFill(0xffffff).drawRect(-400, 597, 1880, 2000).endFill(); board.addChild(m); reelsL.mask = m; }   // white: no symbol pokes above the frame
  const swTopL = new PIXI.Container(); board.addChildAt(swTopL, board.getChildIndex(frameTop) + 1);   // white: a stopped top-row SUPER WILD, over the frame
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
  // b21 (user 2026-11-20: "make the multiplier middle frame simply white glow"): the molten gold frame and its two arrowheads
  // are replaced by one soft white glow line round the centre slot (a baked canvas: wide faint halo, brighter inner halo,
  // a thin white core; ADD; still - no pulse, sparks or flames). The chip numbers no longer pass under bars (colFront
  // gets the plain tray mask). ?cfgold = the b20 molten frame + arrows
  const CF_GLOW = !params.has("cfgold");
  if (CF_GLOW) {
    cfFx.mesh.visible = false;                                          // b22 (user: "bring back the arrows as well"): arrows stay
    // b21 later the same day (user: "make this frame thicker and yellow glowing", screenshot of the white line round a CHARGE
    // chip): warm yellow instead of white, every pass about twice as thick (core 2 -> 4.5 px), a wider halo; a touch bigger
    // so the extra thickness grows outward, off the chip
    // b22 (user 2026-11-20: "put the glowing frame on top of the chip frame so no gaps will be visible", 20x screenshot): the
    // line now runs ON the centre chip's gold rim (rim art 186 x 129 visible at x1 / y0.823 = 186 x 106 on the board; its
    // middle line 182 x 102, corner 12) instead of 2-4 px outside it
    const GW = 182, GH = 102, GR = 12, GP = 40, K2 = 2;                 // the glow line's box (= the rim's middle), halo room, 2x
    const c = document.createElement("canvas"); c.width = (GW + 2 * GP) * K2; c.height = (GH + 2 * GP) * K2;
    const g = c.getContext("2d"); g.scale(K2, K2);
    const rr = () => { g.beginPath(); g.roundRect ? g.roundRect(GP, GP, GW, GH, GR) : g.rect(GP, GP, GW, GH); };
    [[18, "255,190,30", 0.26, 30], [9, "255,214,70", 0.62, 14], [4.5, "255,240,150", 0.98, 4]].forEach(([lw, rgb, a, blur]) => {
      g.lineWidth = lw; g.strokeStyle = `rgba(${rgb},${a})`; g.shadowColor = `rgba(${rgb},1)`; g.shadowBlur = blur * K2; rr(); g.stroke(); });
    const glowSp = new PIXI.Sprite(PIXI.Texture.from(c)); glowSp.anchor.set(0.5); glowSp.scale.set(1 / K2);
    glowSp.position.set(COL_CX, COL_CY); glowSp.blendMode = PIXI.BLEND_MODES.ADD; glowSp.eventMode = "none";
    frameL.addChildAt(glowSp, frameL.getChildIndex(cfFx.mesh) + 1);
  }
  app.ticker.add(() => {                                  // hotter while the column teases; flashes when the arrows knock
    cfFx.power = 1;
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
  // white: a row of gold digit sprites with a PIXI.Text-like .text / .tint (SUPER WILD count, user 2026-11-13)
  function swDigits(init) {
    const c = new PIXI.Container(), K = 0.3, MAX_W = 150; let txt = null, tint = 0xffffff;
    const draw = () => {
      c.removeChildren().forEach((o) => o.destroy());
      const sps = txt.split("").map((ch) => { const sl = ch === "/", sp = new PIXI.Sprite(T("UI/charge_digit_" + (sl ? "slash" : ch)));
        sp.anchor.set(0.5); sp.scale.set(K * (sl ? 0.82 : 1)); sp.tint = tint; return sp; });
      const step = (sp) => sp.width * (sp.texture === T("UI/charge_digit_slash") ? 0.62 : 0.84);
      const tot = sps.reduce((a, sp) => a + step(sp), 0), f = Math.min(1, MAX_W / Math.max(1, tot));
      let x = -tot / 2; sps.forEach((sp) => { sp.x = (x + step(sp) / 2) * f; sp.scale.x *= f; sp.scale.y *= f; x += step(sp); c.addChild(sp); });
    };
    Object.defineProperty(c, "text", { get: () => txt, set: (v) => { v = String(v); if (v !== txt) { txt = v; draw(); } } });
    Object.defineProperty(c, "tint", { get: () => tint, set: (v) => { tint = v; c.children.forEach((sp) => (sp.tint = v)); } });
    c.text = init; return c;
  }
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
      // white: the symbol-lettering gold digits (a centred row, no anchor)
      this.cnt = swDigits(`${Engine.NUDGES}/${Engine.NUDGES}`);
      this.cnt.position.set(SW_PLATE.x, SW_PLATE.y); this.cnt.visible = false; this.inner.addChild(this.cnt);
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
      this.id = id; this.blur = blur; this.fire.visible = false;   // white 2026-11-16: no orange fire glow / embers on a spinning SUPER WILD
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
  let colDimK = 0;                                     // white: win spotlight on the column (0 = off)
  const CB = { k: 0.44, wx: 0.9, wy: -39.6, ww: 258.9, wh: 80.9, dk: 0.5 };   // white 2026-11-13: the rectangular CHARGE chip
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
      this.hot.renderable = false;   // white 2026-11-16 ("keep the board color consistent"): the soft fire glow burnt the tray round 25x+ chips; the hot rim on the chip stays
      this.magic = new PIXI.Filter(undefined, MAGIC_FRAG, { uTime: 0, uSeed: Math.random() * 10, uAmp: 1 });
      this.bg.filters = [this.magic]; magicFilters.push(this.magic);
      this.inner = new PIXI.Container();
      this.label = sp(T("Multipliers/label_1x")); this.coat = sp(T("Multipliers/chip_coat"));
      this.inner.addChild(this.label); this.f.addChild(this.inner, this.coat);
      this.gl.visible = false; this.coat.visible = false;      // 2026-11-10: no white gloss/glints on the chips (flash on hits stays)
      this.fb = new PIXI.Container(); this.fb.x = COL_CX;    // white: off-centre CHARGE badge holder, under the centre frame
      // white 2026-11-17: the centre CHARGE badge's holder, over the frame in its own layer (colFrontCB, never cut by the
      // frame-bar mask the numbers get while the column moves); fcIn copies inner's transform every frame (pulses)
      this.fc = new PIXI.Container(); this.fc.x = COL_CX; this.fcIn = new PIXI.Container(); this.fc.addChild(this.fcIn);
      colBack.addChild(this.b, this.fb); colFront.addChild(this.f); colFrontCB.addChild(this.fc);
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
      this.cbBadge = cs("UI/charge_rect");
      this.cbWin = new PIXI.Container(); this.cbWin.position.set(CB.wx, CB.wy); this.cbWin.visible = false;
      this.cbChev = cs("UI/charge_chev"); this.cbNum = new PIXI.Container();
      const m = new PIXI.Graphics().beginFill(0xffffff).drawRect(-CB.ww / 2, -CB.wh / 2, CB.ww, CB.wh).endFill();
      this.cbWin.addChild(cs("UI/charge_rect_window"), this.cbChev, this.cbNum, m); this.cbWin.mask = m;
      this.cbGlow = cs("UI/charge_rect_window"); this.cbGlow.position.set(CB.wx, CB.wy); this.cbGlow.blendMode = PIXI.BLEND_MODES.ADD; this.cbGlow.alpha = 0;
      this.cbHalo = new PIXI.Sprite(FX.tex.glow); this.cbHalo.anchor.set(0.5); this.cbHalo.tint = 0xb050ff; this.cbHalo.blendMode = PIXI.BLEND_MODES.ADD;
      this.cbHalo.scale.set(300 / this.cbHalo.texture.width); this.cbHalo.alpha = 0.3;                            // a soft purple glow: it pops on the dark tray
      this.cb.addChild(this.cbHalo, this.cbBadge, this.cbWin, this.cbGlow);
    }
    chargeSet() {
      const ch = this.v < 0;
      this.cb.visible = ch; this.cbWin.visible = ch; this.cbGlow.alpha = 0;   // white: chevrons in the window at rest
      this.cbChev.y = 0; this.cbChev.alpha = 1; this.cbNum.removeChildren().forEach((c) => c.destroy());
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
    // white (user 2026-11-13): the count spins like a reel and stops on n
    reveal(n) {
      if (!this.cb.visible) return Promise.resolve();
      this.cbWin.visible = true; this.cbChev.y = 0; this.cbChev.alpha = 1;
      this.cbNum.removeChildren().forEach((c) => c.destroy()); this.cbNum.scale.set(1);
      const P = CB.wh * 0.9, vals = [];
      for (let i = 0; i < 18; i++) { let v; do { v = 2 + Math.floor(Math.random() * 19); } while (v === n || v === vals[vals.length - 1]); vals.push(v); }
      vals.push(n);
      const grp = (k) => { const g = new PIXI.Container();
        const sps = String(k).split("").map((d) => { const s = new PIXI.Sprite(T("UI/charge_digit_" + d)); s.anchor.set(0.5); s.scale.set(CB.dk); return s; });
        const step = (s) => s.width * 0.84; let x = -sps.reduce((a, s) => a + step(s), 0) / 2;
        sps.forEach((s) => { s.x = x + step(s) / 2; x += step(s); g.addChild(s); }); return g; };
      vals.forEach((k, i) => { const g = grp(k); g.y = -i * P; this.cbNum.addChild(g); });     // the strip: n on top, it scrolls down
      const L = (vals.length - 1) * P; this.cbNum.y = -P; let last = -2;
      return new Promise((res) => {
        gsap.timeline({ onComplete: () => { this.chargeDigits(n); this.cbNum.y = 0; res(); } })
          .to(this.cbChev, { y: CB.wh, alpha: 0.4, duration: 0.22, ease: "power2.in" })                    // chevrons drop away
          .fromTo(this.cbGlow, { alpha: 0.9 }, { alpha: 0, duration: 0.5 }, 0)
          .to(this.cbNum, { y: L + P * 0.14, duration: 1.6, ease: "power2.out", onUpdate: () => {         // the reel of numbers
            const k = Math.round(this.cbNum.y / P); if (k !== last) { last = k; if (k >= 0 && k < vals.length) SFX.colTick(Math.min(1, k / vals.length)); }
          } }, 0.08)
          .to(this.cbNum, { y: L, duration: 0.2, ease: "power2.inOut" })                                     // a small overshoot, back
          .add(() => { const g = this.cbNum.children[this.cbNum.children.length - 1]; if (g) gsap.fromTo(g.scale, { x: 1.45, y: 1.45 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" }); })
          .fromTo(this.cbGlow, { alpha: 0.75 }, { alpha: 0, duration: 0.45 }, "<")
          .to({}, { duration: 0.3 });
      });
    }
    setY(y) { this.b.y = this.f.y = this.fb.y = this.fc.y = y;
      // white 2026-11-17 (user: "smooth reel rotation"): while the column rolls (colGrow.k 0) every chip has the same small
      // size, a plain strip; the centre chip grows into the frame as it lands (colGrow.k -> 1). Nudges keep the grow.
      const d = Math.min(1, Math.abs(y - COL_CY) / COL_P), s = chipFit(1 - (1 - d) * colGrow.k);
      this.b.scale.set(s.bx, s.by); this.f.scale.set(s.l); this.fb.scale.set(s.l); this.fc.scale.set(s.l);
      const want = Math.abs(y - COL_CY) < COL_P / 2 ? this.fcIn : this.fb;   // white: centre = over the frame, else under it
      if (this.cb && this.cb.parent !== want) want.addChild(this.cb);
      if (colDimK > 0) this.dim(Math.abs(y - COL_CY) < COL_P / 2 ? 0 : colDimK); }   // white: the spotlight follows the centre
    dim(k) { const g = Math.round(255 * (1 - 0.55 * k)); const t = (g << 16) | (g << 8) | g;
      [this.bg, this.rim, this.label, this.gl].forEach((s) => (s.tint = t)); if (this.cbBadge) this.cbBadge.tint = t; this.hotK = 1 - 0.75 * k; }
    set visible(v) { this.b.visible = this.f.visible = this.fb.visible = this.fc.visible = v; }
  }
  const colGrow = { k: 1 };                             // white 2026-11-17: 0 = a rolling strip (one chip size), 1 = the centre chip grown

  // white version: off-centre chips are small 16:9, a chip grows into the centre frame (d = distance in pitches)
  const CHIP_BIG = { bx: 1, by: 0.823, l: 0.9 }, CHIP_SMALL = { bx: 0.833, by: 0.686, l: 0.74 };
  function chipFit(d) {
    const t = Math.min(1, Math.max(0, d)), k = 1 - t * t * (3 - 2 * t);
    const m = (a, b) => a + (b - a) * k;
    return { bx: m(CHIP_SMALL.bx, CHIP_BIG.bx), by: m(CHIP_SMALL.by, CHIP_BIG.by), l: m(CHIP_SMALL.l, CHIP_BIG.l) };
  }
  function chipBgTex(v) { return COINS && v > 0 ? T(`Multipliers/coin_${v}`) : T(`Multipliers/chip_bg_${v < 0 ? (V2ART && v === -5 ? "nudge5" : "nudge") : v}`); }
  function chipLabelTex(v) { return T(`Multipliers/label_${v < 0 ? "nudge" + (v === -3 ? 3 : 5) : v + "x"}`); }
  // white 2026-11-17 (right-side debug): a label for any value; one with no label art (a capped max-win value) is drawn as
  // text instead of a blank sprite
  function labelSprite(v) {
    if (v < 0 || Engine.MULT_VALUES.includes(v)) return new PIXI.Sprite(chipLabelTex(v));
    const t = new PIXI.Text(Math.round(v) + "x", FX.gold(64)); return t;
  }

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
    rest() { this.views.forEach((v, i) => (v.visible = i > 0 && i < this.n - 1)); this.unmask(); if (this.topLift) this.topLift(true); }
    showAll() { if (this.topLift) this.topLift(false); this.views.forEach((v) => (v.visible = true)); this.domask(); }
    domask() { this.masks.forEach(([c, m]) => (c.mask = m)); }
    unmask() { this.masks.forEach(([c, m]) => { c.mask = null; m.renderable = false; }); }
    // Fortune-games reel (Pascal Porco reelAnimationCacheBuilder): intro lifts the strip a quarter cell (linear, 0.2 s;
    // turbo 0.42 cell in 0.05 s), then a linear loop at full speed, then a decelerating stop on Porco's customStopNormal
    // curve (small overshoot, settle). The stop starts at loop speed, so there is no jolt.
    start(delay, turbo) {
      // white 2026-11-17 (right-side debug): a new spin owns the strip. A stop still settling from the last spin is dropped
      // here; it used to finish ON TOP of the new spin (state idle, speed 0, rest(): the column froze, then rolled with two
      // empty slots, outside its tray and over the frame bars) when the next spin came within ~0.3 s (autoplay, a quick tap)
      this.gen = (this.gen || 0) + 1;
      if (this.tween) { this.tween.kill(); this.tween = null; }
      this.queue = null; this.state = "lift"; this.turbo = !!turbo;
      this.showAll();                                      // white 2026-11-17: after the state is set (the column picks its mask by it)
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
    // white 2026-11-17 (right-side debug): the frame-by-frame part shared by every stop. Calls step(p) with the distance
    // rolled (cells); lands (onLand, blur off) at D (early: resolve there too) and finishes in done(). Both do nothing once
    // a newer spin owns the strip (this.gen).
    _stepper(D, res, early) {
      const me = this, gen = this.gen, base = this.offset;
      let shifts = 0, landed = false, lastP = 0, lastT = gsap.globalTimeline.time();
      const mine = () => me.gen === gen;
      const land = () => {
        landed = true; if (me.spinDim) me.views.forEach((v) => v.dim(0));
        me.views.forEach((v, i) => { if (v.blur) v.set(me.syms[i], false); }); if (me.onLand) me.onLand();
        if (early) res();
      };
      return {
        step(p) {
          if (!mine()) return;
          const pos = base + p;
          while (pos - shifts >= 1 && me.queue && me.queue.length) { me.offset -= 1; me.shift(); shifts++; }
          me.offset = Math.max(-0.5, Math.min(0.999, pos - shifts));
          me.layout();
          const now = gsap.globalTimeline.time(), dtt = Math.max(1e-3, now - lastT);
          if (me.onSpeed) me.onSpeed(Math.abs(p - lastP) / dtt);
          lastP = p; lastT = now;
          if (!landed && !me.queue && p >= (early ? D - 0.02 : D * 0.97)) land();
        },
        done() {
          if (!mine()) return;
          me.offset = 0; me.layout(); me.state = "idle"; me.speed = 0; me.tween = null;
          if (me.onSpeed) me.onSpeed(0);
          if (!landed) land();
          me.rest(); res();
        } };
    }
    // decelerating stop: the final symbols are queued and scroll in over exactly queue.length - offset cells
    stop(final, fast) {
      return new Promise((res) => {
        if (this.state === "lift") { gsap.killTweensOf(this); if (this.offset < 0) this.offset = 0; }
        this.queue = final.slice().reverse().concat([this.above ? this.above(final[0]) : this.rand()]);
        this.state = "decel";
        const D = this.queue.length - this.offset, tr = { p: 0 }, sp = this._stepper(D, res, false);
        // white (Garuda): at full speed onto the target, on 1/8 cell (0.086 s), back (0.19 s); turbo a little tighter
        const v0 = Math.max(6, this.speed || this.vmax), OV = fast ? 0.09 : 0.125, TL = D / v0, T1 = fast ? 0.06 : 0.086, T2 = fast ? 0.13 : 0.19, TT = TL + T1 + T2;
        const gEase = (x) => { const t = x * TT; return (t < TL ? v0 * t : t < TL + T1 ? D + OV * (t - TL) / T1 : D + OV * Math.max(0, 1 - (t - TL - T1) / T2)) / D; };
        this.tween = gsap.to(tr, { p: D, duration: TT, ease: gEase, onUpdate: () => sp.step(tr.p), onComplete: () => sp.done() });
      });
    }
    // white 2026-11-17 (user: "the multiplier part should stop after the 3rd reel equally timing", "it should be smooth reel
    // rotation and stop"): the column's one stop for every round. The roll keeps its speed, then eases out over o.td s to
    // o.over cells past the target and settles back (0.2 s); it reaches the target o.T s after the call (the caller times
    // it to land one reel-gap after the third reel). The cells it rolls are the final window plus o.extra(n) in-order chips,
    // n picked so the speed stays the roll's own (no jolt, no hang). Resolves on the landing (the settle runs on).
    glideStop(final, o) {
      return new Promise((res) => {
        if (this.state === "lift") { gsap.killTweensOf(this); if (this.offset < 0) this.offset = 0; }
        const v0 = Math.max(2, this.speed || this.vmax), over = o.over || 0, td = o.td;
        const need = final.length + 1 - this.offset;                         // the final window + the chip above must scroll in
        const T = Math.max(o.T, (need + over) / v0 + td / 2);                   // never faster than the roll itself
        const nExtra = Math.max(0, Math.round(v0 * (T - td / 2) - over - need));
        this.queue = o.extra(nExtra).concat(final.slice().reverse(), [this.above ? this.above(final[0]) : this.rand()]);
        this.state = "decel";
        const D = this.queue.length - this.offset, P = D + over, v = P / (T - td / 2), tc = T - td, tr = { p: 0 }, sp = this._stepper(D, res, true);
        // constant v, then the speed falls linearly to 0 over td (reaches P at T)
        const ease = (x) => { const t = x * T; return (t <= tc ? v * t : v * tc + v * (t - tc) - (v * (t - tc) * (t - tc)) / (2 * td)) / P; };
        this.tween = gsap.timeline({ onComplete: () => sp.done() })
          .to(tr, { p: P, duration: T, ease, onUpdate: () => sp.step(tr.p) })
          .to(tr, { p: D, duration: over ? 0.2 : 0.001, ease: "power2.inOut", onUpdate: () => sp.step(tr.p) });
      });
    }
    nudge(dur, up) {
      this.showAll();
      if (up) {     // white 2026-11-16 (user: a CHARGE takes the multipliers top to bottom): the strip steps UP, the chip below the centre slides in
        const id = this.below ? this.below(this.syms[this.n - 1]) : this.rand();
        this.syms.shift(); const v = this.views.shift();
        this.syms.push(id); this.views.push(v); v.set(id, false);
        this.offset = 1; this.layout();
      } else {
      const id = this.above(this.syms[0]);
      this.syms.pop(); const v = this.views.pop();
      this.syms.unshift(id); this.views.unshift(v); v.set(id, false);
      this.offset = -1; this.layout();
      }
      return FX.tween(this, { offset: 0, duration: dur || 0.46, ease: dur ? "back.out(1.5)" : "back.out(1.9)", onUpdate: () => this.layout() })
        .then(() => this.rest());
    }
    view(row) { return this.views[row + 1]; }
  }

  const reels = [0, 1, 2].map((r) => {
    const c = new PIXI.Container(); reelsL.addChild(c);
    const m = maskRect(REEL_X[r][0] - 2, CELL_Y0, REEL_X[r][1] + 2, WIN_Y1);
    return new Reel({ rows: 3, pitch: CELL_H, y0: rowY(0), vmax: 20, vNormal: 20, vTurbo: 40, accel: 400, stopDur: 0.6, spinDim: 0.55, stopFast: 0.2,
      container: c, masks: [[c, m]], onExit: () => fireCurtain(r),
      make: () => new SymView(c, REEL_CX[r]),
      // white (user 2026-11-13): a stopped SUPER WILD in the top row is lifted over the frame (whole horns); back on the next spin
      // (user 2026-11-13 "bull should be in front"): any stopped SUPER WILD is raised over its neighbours in the reel
      // white 2026-11-17 (user: "layering issue"): EVERY stopped SUPER WILD goes into swTopL, top row first, so a lower one draws in
      // front of the one above it (its horns over the upper plate), the same order as everywhere else; was: only the top row
      // there, so a top-row SUPER WILD's plate covered the horns of a SUPER WILD under it
      topLift: function (on) { this.views.forEach((v) => { const sw = on && v.id === "super_wild", p = sw ? swTopL : c; if (v.c.parent !== p || sw) p.addChild(v.c); }); },
      rand: () => { const s = Engine.SYMBOLS; const w = Engine.WEIGHTS; let t = 0; const fw = (k) => w[k] + (k === "charge" || k === "super_wild" ? 0 : 2); for (const k of s) t += fw(k); let x = Math.random() * t; for (const k of s) { x -= fw(k); if (x < 0) return k; } return "J"; } });
  });
  const colQ = [];                                   // white (spec): chips queued to slide in next (colPlan)
  const colBlur = new PIXI.BlurFilter(0, MOBILE ? 2 : 4); colBlur.blurX = 0; colBlur.blurY = 0;
  // white 2026-11-16 (user: "slow the multiplier reel, so it will be somehow visible what numbers are rolling"): 9 chips/s (was 30, turbo 52)
  // white 2026-11-17 (user: "position problem on the board vs numbers"): while the column moves (spin, stop, nudge) a chip's
  // number passes UNDER the centre frame's top and bottom bars (cfFx: box 195 x 117, band 13) instead of being drawn over
  // them (colReel's colFront mask); the chip backs were under the frame already. At rest the numbers are unmasked (the 1000x label spans the frame).
  // Five rects, no overlaps: above the top bar, the bar's rows beside the frame, the opening, the same below.
  const colBarsMask = (() => {
    const x0 = TRAY[0] - 30, x1 = TRAY[2] + 30, y0 = TRAY[1], y1 = TRAY[3], hb = 117 / 2, ib = hb - 13, fl = COL_CX - 195 / 2, fr = COL_CX + 195 / 2;
    const g = new PIXI.Graphics().beginFill(0xffffff);
    g.drawRect(x0, y0, x1 - x0, COL_CY - hb - y0);
    for (const yb of [COL_CY - hb, COL_CY + ib]) { g.drawRect(x0, yb, fl - x0, hb - ib); g.drawRect(fr, yb, x1 - fr, hb - ib); }
    g.drawRect(x0, COL_CY - ib, x1 - x0, 2 * ib);
    g.drawRect(x0, COL_CY + hb, x1 - x0, y1 - COL_CY - hb);
    g.endFill(); g.renderable = false; board.addChild(g); return g;
  })();
  // b19 (user 2026-11-19, items 7-8: "we need an animation in the multiplier frame", "check if the multiplier fast rotation is
  // present, if not, make sure we will have it"): yesterday's gold-dust demo (src/gx_coldust.js) runs in every real spin: the
  // column rolls at 32 chips/s (normal and turbo; was 9 / 26) with the demo's light blur cap, and the gold-dust frame glitters
  // on the window while it rolls (colHotOn / colHotOff below). ?nocolhot = the old 9 chips/s column without the frame.
  const COL_HOT = !params.has("nocolhot"), COL_HOT_V = 32, COL_HOT_BLUR = 10 + 1.5 / 0.6;
  const colReel = new Reel({ rows: 7, pitch: COL_P, y0: COL_Y0, vmax: 9, vNormal: 9, vTurbo: 26, accel: 400, stopDur: 0.62, stopFast: 0.22,
    masks: [[colBack, maskRect(TRAY[0], TRAY[1], TRAY[2], TRAY[3])], [colFront, CF_GLOW ? maskRect(TRAY[0] - 30, TRAY[1], TRAY[2] + 30, TRAY[3]) : colBarsMask], [colFrontCB, maskRect(TRAY[0] - 30, TRAY[1], TRAY[2] + 30, TRAY[3])]],
    make: () => new ChipView(), rand: () => colShowPick(),          // white: Garuda's show strip while spinning
    above: (i) => (colQ.length ? colQ.shift() : (i + 1) % Engine.STRIP.length),
    onSpeed: (s) => { const b = Math.max(0, ((COL_HOT ? Math.min(s, COL_HOT_BLUR) : s) - 10) * 0.6); colBlur.blurY = b; colBack.filters = colFront.filters = colFrontCB.filters = b > 0.5 ? [colBlur] : null; } });   // b19: blur capped at 1.5 px (COL_HOT)
  const stripAt = (c, k) => (c + k + Engine.STRIP.length * 4) % Engine.STRIP.length;
  const colIds = (c) => [4, 3, 2, 1, 0, -1, -2, -3, -4].map((k) => stripAt(c, k));
  colReel.below = (i) => (colQ.length ? colQ.shift() : (i - 1 + Engine.STRIP.length) % Engine.STRIP.length);   // white 2026-11-16: a CHARGE run steps the strip up (Reel.nudge(dur, true))
  // the centre CHARGE badge's holder follows its chip's inner transform (reveal pops, hit pulses)
  app.ticker.add(() => colReel.views.forEach((v) => { v.fcIn.position.copyFrom(v.inner.position); v.fcIn.scale.copyFrom(v.inner.scale); v.fcIn.rotation = v.inner.rotation; }));
  function colGrowTo(k, dur) { gsap.killTweensOf(colGrow); gsap.to(colGrow, { k, duration: dur, ease: "power2.out", onUpdate: () => colReel.layout() }); }
  // b19: the round's gold-dust frame (look only: never touches the strip, result, balance or state). On with the column's
  // start in spin(); off COL_HOT_HOLD s after its landing, or (a plain win with a multiplier > 1) right before the number
  // leaves the column for the win board (present()). Idle = frame off, always: a watchdog drops a frame left on after
  // 0.8 s of idle (errors, a slam stop, EX toggle, Buy Bonus overlay). The demo's own play (key "d") is never touched.
  const COL_HOT_A = 0.65, COL_HOT_HOLD = 0.45;   // in-round peak alpha (the demo's 1.0 read too heavy on every spin: a finer glitter)
  let colHot = null;
  function colHotOn() {
    if (!COL_HOT || !window.COLDUST) return;
    colHotOff(0); colHot = { timer: null, idleT: 0 };
    try { COLDUST.frame(true, COL_HOT_A); } catch (e) { console.warn("colHot", e); }
  }
  function colHotOff(delay) {
    const h = colHot; if (!h) return;
    if (h.timer) { h.timer.kill(); h.timer = null; }
    if (delay) { h.timer = gsap.delayedCall(delay, () => { if (colHot === h) colHotOff(0); }); return; }
    colHot = null;
    try { if (window.COLDUST && !COLDUST.playing()) COLDUST.frame(false); } catch (e) { console.warn("colHot", e); }
  }
  // b22 (user 2026-11-20: SUPER WILD - "the multiplier frame burns with particles, the reel rotates and during the rotation
  // spherical chips go out from the middle frame"): the column rolls hot (32 chips/s, gold-dust frame) for dur s and glides
  // back onto the very chips it showed (look only: strip, result and colC unchanged); its own onLand is parked meanwhile.
  // gx_halo slowGather calls it while the wheel's balls leave the centre frame. ?nocolroll = the column stays still
  function colRollShow(dur) {
    if (!COL_HOT || params.has("nocolroll") || colReel.state !== "idle" || !colReel.syms) return Promise.resolve(false);
    const ids = colReel.syms.slice(), final = ids.slice(1, 8), c0 = ids[4], keepLand = colReel.onLand, tb = !!S.turbo;
    colReel.onLand = null;
    try { if (window.COLDUST) COLDUST.frame(true, COL_HOT_A); } catch (e) { console.warn("colRoll", e); }
    colReel.start(0, tb); colReel.vmax = colReel.speed = COL_HOT_V; colGrowTo(0, 0.18);
    return new Promise((res) => gsap.delayedCall(Math.max(0.3, dur), () => {
      colReel.glideStop(final, { T: 0, td: tb ? 0.25 : 0.55, over: tb ? 0.08 : 0.12, extra: (n) => Array.from({ length: n }, (_, k) => stripAt(c0, k - n - 2)) })
        .then(() => { colReel.onLand = keepLand; colGrowTo(1, 0.25); SFX.columnStop && SFX.columnStop();
          gsap.delayedCall(0.3, () => { try { if (window.COLDUST && !COLDUST.playing() && !colHot) COLDUST.frame(false); } catch (e) {} });
          res(true); });
    }));
  }
  app.ticker.add(() => { if (!colHot) return; if (S.state !== "idle") { colHot.idleT = 0; return; }
    if ((colHot.idleT += app.ticker.deltaMS / 1000) > 0.8) colHotOff(0); });

  // start position: the approved board's grid and a 1000x in the middle of the column
  const START = [["hourglass", "J", "wild"], ["super_wild", "sun", "Q"], ["K", "chest", "A"]];
  reels.forEach((rl, r) => rl.setSyms([rl.rand(), ...START[r], rl.rand()]));
  let colC = Engine.STRIP.indexOf(1000);
  colReel.setSyms(colIds(colC));
  // white 2026-11-16 (user: "when we have the 1000x on the multiplier tab, we need the arrow to be hidden"): the wide labels
  // fill the centre frame, the arrow tips poked out beside the digits
  const CF_ARROW_HIDE = new Set([1000, 500]);
  app.ticker.add(() => {
    const cv = colReel.views[4], rest = colReel.state === "idle";
    const want = rest && cv && CF_ARROW_HIDE.has(cv.v) ? 0 : 1;   // b22: the arrows are back with the glow frame (b21 hid them)
    cfArrows.forEach((a) => { a.alpha += (want - a.alpha) * 0.25; a.renderable = a.alpha > 0.02; });
  });

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
  const SPIN_BURST = false;                             // white 2026-11-16: no ring / dot swirl from the SPIN button (press + idle call)
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
  ui.ex.aura.renderable = false; exRing.renderable = false;   // white 2026-11-16 (user): no glow / ray burst behind the EX switch when ON
  const exTag = new PIXI.Text("x1.5 BET", FX.gold(22)); exTag.anchor.set(0.5); exTag.position.set(0, -86); exTag.alpha = 0; ui.ex.addChild(exTag); exTag.renderable = false;   // white: no x8 BET tag
  const autoBadge = new PIXI.Container(); autoBadge.position.set(48, -48); autoBadge.visible = false;
  autoBadge.addChild(new PIXI.Graphics().lineStyle(3, 0xffd36b).beginFill(0x8a0e1e).drawCircle(0, 0, 26).endFill());
  const autoTxt = new PIXI.Text("50", FX.plain(24, "#ffffff")); autoTxt.anchor.set(0.5); autoBadge.addChild(autoTxt);
  ui.autoplay.addChild(autoBadge);
  const muteSlash = new PIXI.Graphics().lineStyle(6, 0xff3040).moveTo(-26, -24).lineTo(26, 24); muteSlash.visible = false;
  ui.sound.addChild(muteSlash);

  // texts
  const UI_WHITE = { fill: ["#FFFFFF", "#FFFFFF", "#EDE2D2"] };   // core values white; only the "Balance:" label stays gold
  // white: Pascal's betting-part type (flat Poppins, a faint drop shadow only)
  const PF = (size, wt, fill, extra) => new PIXI.TextStyle(Object.assign({ fontFamily: wt >= 700 ? "PoppinsB" : "PoppinsM", fontSize: size,
    fontWeight: String(wt), fill, dropShadow: true, dropShadowColor: "#000000", dropShadowAlpha: 0.3, dropShadowBlur: 2, dropShadowDistance: 1,
    dropShadowAngle: Math.PI / 2, padding: 6 }, extra || {}));
  const betTxt = new PIXI.Text("", PF(40, 500, "#FFFFFF")); betTxt.anchor.set(0.5); betTxt.position.set(540, 1760); uiL.addChild(betTxt);
  const exBetTag = new PIXI.Text("EX", FX.gold(20, { fill: FX.TIER_FILL.mega })); exBetTag.anchor.set(0.5); exBetTag.position.set(650, 1760);
  exBetTag.visible = false; uiL.addChild(exBetTag); exBetTag.renderable = false;   // white: no EX2 tag after the bet
  const clockTxt = new PIXI.Text("", PF(26, 500, "#FFFFFF")); clockTxt.anchor.set(0, 0.5); clockTxt.position.set(48, 1864);
  const balLab = new PIXI.Text("Balance:", PF(32, 500, "#FFC33E")); balLab.anchor.set(0, 0.5);
  const balVal = new PIXI.Text("", PF(40, 700, "#FFFFFF")); balVal.anchor.set(0, 0.5);
  const balUnit = new PIXI.Text("AMD", PF(24, 700, "#FFFFFF")); balUnit.anchor.set(0, 0.5);
  const demoTxt = new PIXI.Text("DEMO MODE", PF(24, 700, "#FFFFFF", { stroke: "#2a0a04", strokeThickness: 4 })); demoTxt.anchor.set(0, 0.5); demoTxt.position.set(18, 1815);
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
  // white 2026-11-16 (user): the bar is the red/gold panel (assets/UI/win_bar.webp, tools/win_panel.py); one divider across
  // its middle (drawn only while the two rows show); every text on it in one simple flat gold, the amounts gold too
  // white 2026-11-16 (user: the panel shorter, ~0.7 of its height): its two text rows sit closer together, inside the
  // shorter face (panel 1298-1395): line row WB_Y1, total row WB_Y2 (were 1318 / 1374), the divider between them
  const WB_Y1 = 1326 + WB_DY, WB_Y2 = 1368 + WB_DY;   // b19: + WB_DY (the whole bar moved up)
  const WB_SEP_UP = 6;   // b19 (user 2026-11-19: "move the total win divider bit higher"): divider 6 px above the rows' middle (0 = old)
  for (const [y, half] of [[(WB_Y1 + WB_Y2) / 2 - WB_SEP_UP, 330]]) {
    for (let k = 0; k < 20; k++) {
      const t0 = k / 20, t1 = (k + 1) / 20;
      const a = 0.6 * (1 - t0 * t0);
      sep.beginFill(0xffd27a, a).drawRect(540 + t0 * half, y, (t1 - t0) * half, 2).drawRect(540 - t1 * half, y, (t1 - t0) * half, 2).endFill();
    }
  }
  function wbGold(size) {
    return FX.plain(size, ["#FFF1B2", "#FFCF4A", "#E7A11E"], { fillGradientStops: [0, 0.55, 1], stroke: "#3a0c04",
      strokeThickness: Math.max(2, Math.round(size / 11)), lineJoin: "round", dropShadowAlpha: 0.4, dropShadowBlur: 2 });
  }
  const lineLab = new PIXI.Text("", wbGold(25)); lineLab.anchor.set(0, 0.5);
  const lineVal = new PIXI.Text("", wbGold(27)); lineVal.anchor.set(0, 0.5);
  const lineIcons = new PIXI.Container();
  wbLine.addChild(lineLab, lineIcons, lineVal);
  const totLab = new PIXI.Text("TOTAL WIN:", wbGold(33)); totLab.anchor.set(0, 0.5);
  const totVal = new PIXI.Text("", wbGold(44)); totVal.anchor.set(0, 0.5);
  const msgTxt = new PIXI.Text("", wbGold(36)); msgTxt.anchor.set(0.5); msgTxt.position.set(540, 1346 + WB_DY);   // b19: + WB_DY
  wbTotal.addChild(totLab, totVal); wb.addChild(msgTxt);
  if (GPASS) { wb.y = 10; sep.alpha = 0; }              // text sits in the plinth's face, clear of its meander border; the plinth replaces the rules
  const totShown = { v: 0 };
  const WB_FIT = 470;                                   // widest text row on the slim win ledge (520 wide)
  function drawTotal() {
    totVal.text = FX.money(totShown.v);
    const w = totLab.width + 14 + totVal.width;
    totLab.position.set(540 - w / 2, WB_Y2); totVal.position.set(540 - w / 2 + totLab.width + 14, WB_Y2);
    // stone pass: the row (total + its "xN" tag) shrinks to fit the narrow win ledge
    const tagW = multTag && !multTag.destroyed && multTag.renderable && wbTotal.visible ? multTag.width / (multTag.scale.x || 1) + 22 : 0;
    const k = GPASS ? Math.min(1, WB_FIT / (w + tagW)) : 1;
    const shift = GPASS ? -(tagW * k) / 2 : 0;             // total + tag are centred as one group on the ledge
    wbTotal.pivot.set(540, WB_Y2); wbTotal.position.set(540 + shift, WB_Y2); wbTotal.scale.set(k);
    // the round's "xN" tag sits right after the total, whatever its length
    if (tagW) { multTag.scale.set(k); multTag.position.set(540 + shift + (w / 2) * k + 22 * k + multTag.width / 2, WB_Y2 + (GPASS ? wb.y : 0)); }
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
    // white 2026-11-16 (user: "remove this 12.66"): the line row shows LINE n: + its symbols only, no amount
    lineVal.visible = false;
    const w = lineLab.width + 16 + x;   // the last icon ends about at x
    const x0 = 540 - w / 2;
    lineLab.position.set(x0, WB_Y1); lineIcons.position.set(x0 + lineLab.width + 16, WB_Y1); lineVal.position.set(x0 + lineLab.width + 16 + x + 10, WB_Y1);
    const k = GPASS ? Math.min(1, WB_FIT / w) : 1; wbLine.pivot.set(540, WB_Y1); wbLine.position.set(540, WB_Y1); wbLine.scale.set(k);
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
  // white 2026-11-18 EX switch-on show (plan fortune_bull_ex_show_plan_2026-11-18): OFF -> ON plays window.EXSHOW
  // (src/gx_exshow.js: SUPER WILDs fly in, the column's multipliers count up to the mode's pool); without it, with
  // ?noexshow, autoplay or a hidden tab the column swaps calmly. Any spin / toggle cancels the show in the same frame.
  const EX_SHOW = !params.has("noexshow");
  const EX_SHOW_REPEAT = "short";                       // first show in a session full, later ones at turbo speed
  const EX_CF_KNOCK = true;                             // the Fortune Choice arrows knock when the centre chip settles
  let exShownOnce = false, exPlan = null, exColTl = null, exColRes = null;
  const exShowCancel = (why) => { if (window.COLDUST && (COLDUST.playing ? COLDUST.playing() : COLDUST.active())) COLDUST.stop(why);   // b19 (lead): only the demo play; the round's own frame (colHotOn) is not cut (it flickered on quick re-spins)   // white 2026-11-18: the gold-dust column demo (src/gx_coldust.js) ends in the same frame (spin / EX toggle / mode change)
    if (window.EXSHOW && EXSHOW.active()) EXSHOW.cancel(why); if (exColTl || exPlan) exColFinish(); };
  function toggleEx() {
    if (S.state !== "idle") return;
    exShowCancel("toggle");
    S.ex = !S.ex; drawBet(); exSwitchDraw();
    const show = S.ex && EX_SHOW && !(S.auto > 0) && !document.hidden && !!window.EXSHOW;
    if (show) {
      exModePrep();
      EXSHOW.play({ mode: S.exMode || 1, turbo: !!S.turbo || (EX_SHOW_REPEAT === "short" && exShownOnce) });
      exShownOnce = true;
    } else {
      exModeSync();
      if (S.ex) { if (EX_SHOW) SFX.click(); else SFX.wildLand(); }
    }
    GX.emit("ex", { on: S.ex, x: ui.ex.x, y: ui.ex.y, calm: EX_SHOW });
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
  // white 2026-11-16 (user): the user's pill without its glow (tools/ex_switch_user.py; 2x art 394 x 151 = just the pill,
  // knob left red / right green) and "EX" in a CIRCLE plate (assets/UI/ex_plate.webp, round) sitting on the pill's top rim
  const EX_SW = 0.5;
  ui.ex.spr.texture = T("UI/ex_switch_off"); ui.ex.spr.scale.set(EX_SW); ui.ex.spr.y = 0;   // the pill on the button's centre
  ui.ex.children[0].visible = false;                                   // the round button's shadow
  ui.ex.body.hitArea = new PIXI.RoundedRectangle(-100, -126, 200, 166, 36);   // white 2026-11-16: taller for the bigger EX circle
  const EX_PY = -32, exPlate = new PIXI.Sprite(T("UI/ex_plate")); exPlate.anchor.set(0.5, 1);
  exPlate.scale.set(0.57 * 1.25); exPlate.position.set(0, EX_PY); ui.ex.body.addChild(exPlate);   // ~90 px circle (user 2026-11-16: 25% bigger), its foot on the top meander
  const exLabel = new PIXI.Text("EX", FX.gold(32, { strokeThickness: 5, dropShadowDistance: 1, dropShadowBlur: 1 })); exLabel.anchor.set(0.5);
  exLabel.position.set(0, EX_PY - exPlate.height / 2 + 1); ui.ex.body.addChild(exLabel);
  exTag.y = EX_PY - exPlate.height - 16;                            // the x1.5 BET tag sits above the plate
  const exState = new PIXI.Text("OFF", FX.plain(24, "#ffe9c0", { stroke: "#2a0606", strokeThickness: 4, dropShadowDistance: 1 })); exState.anchor.set(0.5); ui.ex.body.addChild(exState);
  // white 2026-11-17 (user: "the ex button should be equal to buy bonus size"): the whole switch scaled so the pill is the
  // BUY BONUS chip's width (234 px; pill 197 -> 234), its bottom level with the chip's (on the container: the body's
  // press tween owns body.scale)
  const EX_K = 234 / 197; ui.ex.scale.set(EX_K); ui.ex.y += 20;
  // b21 (user 2026-11-20: "we have new buttons"): the user's new EX switch art, the round EX plate fused on the pill, ON/OFF
  // and the knob baked in (tools/ex_switch_v2.py: ex2_off = the art as drawn; ex2_on = knob right, green face, "ON" left).
  // One sprite in place of pill + plate + EX + OFF texts; pill 234 px wide on screen as before, its centre where the old
  // pill's was. ?oldbtn = the b20 switch.
  const EX2 = !params.has("oldbtn") && !!PIXI.Assets.get("assets/UI/ex2_off.webp");
  let exSw = EX_SW;
  if (EX2) {
    exSw = 0.5 / EX_K;                                                  // 2x art; the container's EX_K is undone here
    ui.ex.spr.texture = T("UI/ex2_off"); ui.ex.spr.scale.set(exSw);
    ui.ex.spr.y = -35.1 / EX_K;                                         // texture centre -> pill centre at (0, 0) (tool prints 35.1)
    exPlate.visible = exLabel.visible = exState.visible = false;
    exTag.y = -106.3 / EX_K - 16;                                       // above the art's plate (top 106.3 px over the pill centre)
    ui.ex.body.hitArea = new PIXI.RoundedRectangle(-102, -94, 204, 130, 30);
    ui.ex.y += 14;                                                      // level with the new BUY BONUS art (both 143 px tall)
  }
  function exSwitchDraw() {
    ui.ex.spr.texture = T(EX2 ? (S.ex ? "UI/ex2_on" : "UI/ex2_off") : (S.ex ? "UI/ex_switch_on" : "UI/ex_switch_off"));
    exTag.text = "x" + MC(S.exMode || 1) + " BET";                  // the chosen mode's debit
    exState.text = S.ex ? "ON" : "OFF"; exState.position.set(S.ex ? -42 : 44, 1); exState.style.fill = S.ex ? "#ffffff" : "#ffe9c0";
    gsap.fromTo(ui.ex.spr.scale, { x: exSw * 1.1, y: exSw * 0.92 }, { x: exSw, y: exSw, duration: 0.3, ease: "back.out(3)" });
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
    exShowCancel("toggle");                              // white 2026-11-18: a running EX show / column grow ends first (its plan is for its own mode)
    if (Engine.mode() === m && !flash) return;
    Engine.setMode(m);
    colC = Math.floor(Math.random() * Engine.STRIP.length); colReel.setSyms(colIds(colC));
    if (EX_SHOW) {                                       // white 2026-11-18: a calm swap, the column fades in place (no ring, no flashes)
      gsap.fromTo([colBack, colFront, colFrontCB], { alpha: 0.35 }, { alpha: 1, duration: 0.15, overwrite: true });
      return;
    }
    colReel.views.forEach((v) => { if (v.flash) gsap.fromTo(v.flash, { alpha: 0.8 }, { alpha: 0, duration: 0.45 }); });
    ringAt(COL_CX, COL_CY, 0xffd060, 1.6, 0.35);
  }
  // ---- EX show, the column part: "multipliers grow" (plan 2.6). exModePrep switches the engine's mode and decides each
  // chip's target at once (colReel.syms valid for the new strip at every moment); the faces keep the old values until
  // exColGrow counts them up the real ladder, bottom to top, the centre last; exColFinish snaps to the plan (idempotent).
  function exModePrep() {
    exColFinish();
    const m = S.ex ? (S.exMode || 1) : 0, cmin = [0, 2, 5, 10][m];
    const old = colReel.views.map((v) => v.v);
    Engine.setMode(m);
    const strip = Engine.STRIP, md = Engine.MODES[m];
    const draw = () => md.mt.draw(Math.random);
    const vals = old.map((v) => {
      if (v < 0) { const t = -Math.max(-v, cmin); return strip.includes(t) ? t : strip.includes(-cmin) ? -cmin : draw(); }
      const t = Math.max(v || 1, draw()); return strip.includes(t) ? t : draw();
    });
    const ids = vals.map((t) => { const i = strip.indexOf(t); return i < 0 ? 0 : i; });
    colReel.syms = ids.slice(); colC = ids[4];
    [0, 8].forEach((i) => colReel.views[i].set(ids[i]));          // the hidden ends at once
    exPlan = { m, old, ids, vals };
    return exPlan;
  }
  // the column is at rest: idle, or its last ~0.2 s position settle after a round (landed, nothing queued; game already idle)
  const colLanded = () => colReel.state === "idle" || (colReel.state === "decel" && !colReel.queue);
  // dur: a chip's count, longer for a longer ladder (dur + durStep per step, capped) so every step stays readable
  const EXG = { gap: 0.11, centreAt: 0.70, dur: 0.45, durStep: 0.045, durMax: 0.62, durC: 0.55, setK: 1.12, setD: 0.22, setKC: 1.2, setDC: 0.3, tickMs: 50 };
  function exColGrow(o) {
    const p = exPlan; if (!p || !colLanded()) return Promise.resolve("none");
    if (exColTl) { exColTl.kill(); exColTl = null; }
    const speed = (o && o.speed) || 1, turbo = speed > 1.01;
    let lastTick = 0;
    return new Promise((res) => {
      exColRes = res;
      const tl = gsap.timeline({ paused: true, onComplete: () => { if (exColTl === tl) exColTl = null; const r = exColRes; exColRes = null; if (r) r("done"); } });
      [7, 6, 5, 3, 2, 1, 4].forEach((i, k) => {
        const v = colReel.views[i], centre = i === 4, at = centre ? EXG.centreAt : EXG.gap * k;
        const from = p.old[i], to = p.vals[i];
        if (to < 0 || !(from > 0)) { tl.add(() => v.set(p.ids[i]), at); return; }          // CHARGE: looks the same
        const path = Engine.MULT_VALUES.filter((x) => x > from && x <= to);
        const dur = centre ? EXG.durC : Math.min(EXG.durMax, Math.max(EXG.dur, 0.36 + EXG.durStep * path.length));
        if (!path.length && !centre) {                                                       // already there: a small confirm
          tl.add(() => v.set(p.ids[i]), at);
          tl.fromTo(v.inner.scale, { x: 1, y: 1 }, { x: 1.05, y: 1.05, duration: 0.1, yoyo: true, repeat: 1, ease: "sine.inOut", immediateRender: false }, at);
          return;
        }
        const st = { p: 0 }; let shown = 0;
        if (path.length) tl.to(st, { p: 1, duration: dur, ease: "power2.inOut", onUpdate: () => {
          const n = Math.min(path.length, Math.ceil(st.p * path.length)); if (n === shown || n < 1) return;
          shown = n; const x = path[n - 1];
          v.bg.texture = chipBgTex(x); v.label.texture = chipLabelTex(x); v.v = x; v.hotSet();
          gsap.fromTo(v.label, { y: 9, alpha: 0.55 }, { y: 0, alpha: 1, duration: 0.07, overwrite: true });
          const now = performance.now(); if (!turbo && now - lastTick >= EXG.tickMs) { lastTick = now; SFX.colTick(n / path.length); }
        } }, at);
        tl.add(() => {
          gsap.killTweensOf(v.label); v.set(p.ids[i]); v.label.y = 0; v.label.alpha = 1;
          if (!turbo || centre) SFX.rise(0.5 + k / 12);
          if (centre && EX_CF_KNOCK) cfKnock(5);
        }, at + dur);
        // the settle never pushes the label past the chip's face (wide 500x / 1000x labels already fill it)
        const want = centre ? EXG.setKC : EXG.setK, lw = chipLabelTex(to).width * v.label.scale.x * v.f.scale.x;
        const room = chipBgTex(to).width * v.bg.scale.x * v.b.scale.x * 0.9, sk = Math.max(1.03, Math.min(want, room / Math.max(1, lw)));
        tl.fromTo(v.inner.scale, { x: sk, y: sk },
          { x: 1, y: 1, duration: centre ? EXG.setDC : EXG.setD, ease: centre ? "back.out(2)" : "power2.out", immediateRender: false }, at + dur);
      });
      exColTl = tl; tl.timeScale(speed).play(0);
    });
  }
  function exColFinish() {
    const tl = exColTl; exColTl = null;
    if (tl) tl.kill();
    colReel.views.forEach((v) => { gsap.killTweensOf(v.label); gsap.killTweensOf(v.inner.scale); v.label.y = 0; v.label.alpha = 1; v.inner.scale.set(1); });
    const p = exPlan; exPlan = null;
    if (p && colLanded() && Engine.mode() === p.m) colReel.setSyms(p.ids);
    const r = exColRes; exColRes = null; if (r) r("cancel");
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
  // white 2026-11-16 (user: "keep the board color consistent, no need to burn it"): no additive glow puff on or right at the
  // board (frame box 10,594 - 1070,1288, widened by half the puff's radius): it burnt the parchment, the tray and the frame
  // white / orange for a moment. Rings, sparks, star glints and impact flipbooks at the same points stay.
  // ?boardflash brings the puffs (and flashScreen) back.
  const BOARD_FLASH = params.has("boardflash"), onBoard = (x, y, s) => { const r = 64 * (s || 1); return x > 10 - r && x < 1070 + r && y > 594 - r && y < 1288 + r; };
  function flashAt(x, y, tint, s, life) { if (!BOARD_FLASH && onBoard(x, y, s)) return; topP.emit({ tex: FX.tex.glow, x, y, s0: s, s1: s * 1.3, life: life || 0.35, tint, a0: 0.9, a1: 0 }); }
  let shakeT = 0, shakeA = 0;
  // hit-stop: the whole game holds for a few frames on a heavy impact (real time), then carries on; and a phone buzz
  // b22 (user 2026-11-20: "the impact hits and the board kind of freezes for a second, we need these effects to be smooth"):
  // the hit-stop (the whole game at 1/20 speed for 50-120 ms on the throw's landing, the board hit, SUPER WILD landings and
  // big multipliers) read as the board seizing up. Off; ?hitstop brings it back.
  const HIT_STOP = params.has("hitstop");
  let hitStopOn = false, hitStopTs = 1;
  function hitStop(ms) {
    if (!HIT_STOP || hitStopOn || S.turbo || S.respin) return;
    const ts = gsap.globalTimeline.timeScale(), low = ts * 0.05; hitStopOn = true; hitStopTs = ts;   // b22: the bull's video keeps its speed (hitStopTs, bullTick)
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
      // b22 (user 2026-11-20: "remove all the scale and stupid animation from the character"): no scale pop on the bull; his own video carries the moves
    }
    if (kind === "big") {
      // the roar sound lands on the open mouth: it fires on the clip's own clock at events.roar (the sound needs
      // ~0.45 s to reach full voice, so the event sits that much before the mouth opens wide)
      const mv = bullLive() ? bullPlay("bull_big") : null;
      const at = mv && mv.c.cfg.events && mv.c.cfg.events.roar;
      if (!mv) SFX.roar();
      else if (mv.fresh) { if (at == null) SFX.roar(); else mv.at("roar").then(() => SFX.roar()); }
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
    if (!c || !idle || !clipBuffered(c.video)) return null;   // white: not downloaded yet = the code move (no frozen bull)
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
    // b22: a hit-stop freezes the game for a few frames but not the bull's video: dropping its rate to 1/20 and back made the
    // decoder stall for longer than the stop itself (a visible hitch in the hit)
    const r = Math.min(8, Math.max(0.07, (hitStopOn ? hitStopTs : gsap.globalTimeline.timeScale()) * bullRate(mv, mv.t)));   // browsers refuse rates under 1/16
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
    colDimK = 0; colReel.views.forEach((v) => { gsap.killTweensOf(v.inner.scale); v.inner.scale.set(1); v.dim(0); });
    plaque.visible = false; accum.visible = false; cntBox.visible = false; plaqueBig.visible = false; centreMark.visible = false;
    gsap.killTweensOf(cscreen); cscreen.visible = false; cscreen.y = CS_HIDE; cscreen.one = false; accum.y = ACC_Y;   // white 2026-11-16: a new spin never inherits the screen
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
      if (w && w.veil && !w.veil.destroyed) gsap.to(w.veil, { alpha: on ? 0 : 0.42 * WIN_VEIL / 0.65, duration: 0.14, overwrite: true });
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
  // white 2026-11-16 (user: "keep the board color consistent, no need to burn it"): the parchment is never darkened or
  // lit during a win, only the losing SYMBOLS dim (SymView.dim). Was: a black veil 0.65 over the losing cells (0.42 over
  // the other lines' cells, 0.6 over the reels in the Buy round) and a breathing warm light in the winning cells.
  // 2026-11-16 (user: "need to darken the background of the letters as well"): the losing cells darken again, as much as
  // their symbols (SymView.dim: 0.35 brightness = a 0.65 black veil); the winning cells keep no light (WIN_LIGHT)
  const WIN_VEIL = 0.65, WIN_LIGHT = false;
  function winHole(reel, row) { const x0 = REEL_X[reel][0], x1 = REEL_X[reel][1];
    return [x0 + WIN_IN, rowY(row) - CELL_H / 2 + WIN_IN, x1 - x0 - 2 * WIN_IN, CELL_H - 2 * WIN_IN, WIN_R]; }
  // white (user 2026-11-11: "during the win animation, the animation should loop"): a cell's symbol win move again
  function cellReplay(c) {
    const reel = Math.floor(c / 3), row = c % 3, v = reels[reel].view(row);
    if (!v || S.state === "spinning") return;
    if (cellClipSprites.some((sp) => sp.clipId === v.id)) cellClipKick(v.id);   // white: the wild burn loops with the win
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
    light.alpha = 0.1; light.visible = WIN_LIGHT; fr.addChild(light);
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
  const plaque = new PIXI.Container(); plaque.position.set(540, WB_Y2); plaque.visible = false; plaqueL.addChild(plaque);
  const plaqueBg = new PIXI.Graphics();
  plaqueBg.beginFill(0x2a0508, 0.65).drawRoundedRect(-176, -58, 352, 124, 30).endFill();
  plaqueBg.beginFill(0x5a0000).lineStyle(5, 0xffd36b).drawRoundedRect(-170, -54, 340, 108, 26).endFill();
  plaqueBg.beginFill(0xa01a28, 0.55).lineStyle(0).drawRoundedRect(-160, -46, 320, 44, 20).endFill();
  const plaqueGlow = new PIXI.Sprite(FX.tex.glow); plaqueGlow.anchor.set(0.5); plaqueGlow.scale.set(2.6, 1.3);
  plaqueGlow.tint = 0xffaa00; plaqueGlow.blendMode = PIXI.BLEND_MODES.ADD; plaqueGlow.alpha = 0.6;
  // white 2026-11-16 (user): the counts sit straight on the red panel (no red box / glow of their own) in the bar's simple
  // flat gold; the "big" count after the multiplier is the same text (was the 3D gold_digits bitmap font)
  plaqueBg.renderable = false; plaqueGlow.renderable = false;
  const plaqueTxt = new PIXI.Text("", wbGold(70)); plaqueTxt.anchor.set(0.5);
  const plaqueBig = new PIXI.Text("0", wbGold(70)); plaqueBig.anchor.set(0.5); plaqueBig.visible = false;
  plaque.addChild(plaqueGlow, plaqueBg, plaqueTxt, plaqueBig);
  const plaqueShown = { v: 0 };
  const syncTotal = () => { totShown.v = plaqueShown.v; drawTotalT(); };   // every copy shows one value (white: throttled redraw)
  const drawPlaqueTxt = () => { plaqueTxt.text = FX.money(plaqueShown.v); const k = Math.min(1, 300 / plaqueTxt.width); plaqueTxt.scale.set(k); };
  const drawPlaqueTxtT = throttled(drawPlaqueTxt, TXT_DT);
  const drawPlaque = () => { drawPlaqueTxt(); syncTotal(); };
  const drawPlaqueRoll = () => { if (!MOBILE) drawPlaqueTxtT(); syncTotal(); };   // white: while it rolls (phones: no roll, see below)
  // the big count's fit: at most 300 px wide on the panel (its unscaled width = the text's own width)
  const bigFit = () => Math.min(1, 300 / Math.max(1, plaqueBig.width / (plaqueBig.scale.x || 1)));
  const drawBig = () => {
    plaqueBig.text = FX.money(plaqueShown.v); plaqueBig.scale.set(bigFit()); syncTotal();
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
  // white 2026-11-17 (user: "instead of one board with 2 lines, create 2 boards one on top of each other"): two closed
  // one-row boards (assets/UI/counter_board.webp, tools/batch17_art.py), CHARGES (A) stacked on TOTAL (B); B sits on the
  // board frame's top edge, A 6 px above it. Both rise from behind the frame together; a plain multiplier shows B alone.
  // white 2026-11-18 b18 (user: "the multiplier top frame should be its bottom frame, and same way the second level popup, the
  // top of the level one should be the base of the second one"): one tower of OPEN boards (no bottom band, tools/
  // counter_board_b18.py): level 1 = TOTAL (UI/counter_board_red, the 100x chip's red face) stands on the column frame's top
  // bar (y 590) and rises out of it; level 2 = CHARGES (UI/counter_board_open, parchment) stands on level 1's top band and
  // rises out of it (cscreenA, hidden behind level 1 at CS_A_HIDE). Art bottoms (anchor 0.5, 1): level 1 at the bar's top
  // edge, level 2 in the middle of level 1's top band (505.5..526).
  // b20 (user 2026-11-19: "first box bigger than the second", screenshot of the red x3 TOTAL board under the 0/2 CHARGES board):
  // level 1's red face is LV1_EXTRA px taller (66 -> 92 px; a NineSlicePlane, so its gold top band stays as drawn), level 2
  // stands that much higher, and the TOTAL number is drawn at LV1_NUM (was 56). LV1_EXTRA 0 + LV1_NUM 56 = the b18 tower
  const LV1_EXTRA = 26, LV1_NUM = 64;
  // b21 (user 2026-11-20: "make this frame of the popup thinner and more beautiful", arrow on the band between the two
  // boards): level 1's 20.5 px top band + corner caps -> a 9 px polished gold bar with collars on the pillars and a small blue
  // gem in the middle (tools/counter_divider_b21.py -> UI/counter_board_red_thin, 2x). Level 1's face keeps its size, so the
  // bar sits 11.5 px lower and level 2 stands that much lower on it (CB_THIN_DY). ?oldcb = the b20 band
  const CB_THIN = !params.has("oldcb") && !!PIXI.Assets.get("assets/UI/counter_board_red_thin.webp"), CB_THIN_DY = CB_THIN ? 11.5 : 0;
  const CS_X = 944, CS_HIDE = 100 + LV1_EXTRA, CS_A_HIDE = 86 + LV1_EXTRA, CB_BAR = 591, CB_A = 516 - LV1_EXTRA + CB_THIN_DY;
  const CNT_Y = 473 - LV1_EXTRA + CB_THIN_DY, ACC_Y = 558 - LV1_EXTRA / 2;   // row centres: level 2 face 440..505, level 1 face 526..591 (both - LV1_EXTRA at the top)
  const cscreen = new PIXI.Container(); cscreen.visible = false; plaqueL.addChild(cscreen);
  const cscreenA = new PIXI.Container(); cscreenA.y = CS_A_HIDE;   // level 2 (board + count), moves with level 1
  const cscreenBg = CB_THIN ? new PIXI.NineSlicePlane(T("UI/counter_board_red_thin"), 0, 46, 0, 0)   // b21: rows 0-45 (2x) = pad + bar + its shadow
    : new PIXI.NineSlicePlane(T("UI/counter_board_red"), 0, 30, 0, 0);   // b20: rows 0-29 = the top band (kept), the face stretches
  const CB_K = CB_THIN ? 0.5 : 1;                                       // b21 art is 2x
  cscreenBg.width = cscreenBg.texture.width; cscreenBg.height = cscreenBg.texture.height + LV1_EXTRA / CB_K; cscreenBg.scale.set(CB_K);
  cscreenBg.position.set(CS_X - cscreenBg.width * CB_K / 2, CB_BAR - cscreenBg.height * CB_K);   // (was a Sprite, anchor 0.5, 1 at CS_X, CB_BAR)
  const cscreenBgA = new PIXI.Sprite(T("UI/counter_board_open")); cscreenBgA.anchor.set(0.5, 1); cscreenBgA.position.set(CS_X, CB_A);
  const cscreenMask = new PIXI.Graphics().beginFill(0xffffff).drawRect(760, 280, 380, CB_BAR - 280).endFill(); plaqueL.addChild(cscreenMask); cscreen.mask = cscreenMask;
  cscreen.addChild(cscreenA, cscreenBg); cscreenA.addChild(cscreenBgA);
  [cntBox, accum].forEach((b) => { plaqueL.removeChild(b); (b === cntBox ? cscreenA : cscreen).addChild(b); });
  cntBg.visible = false; accBg.visible = false; accGlow.visible = false;
  cntBox.position.set(CS_X, 478); cntLab.y = -18; cntTxt.y = 8; accum.position.set(CS_X, 548); accLab.y = -20; accTxt.y = 10;
  cntLab.visible = false; accLab.visible = false; cntBox.position.set(CS_X, CNT_Y); cntTxt.y = 0; accum.position.set(CS_X, ACC_Y); accTxt.y = 0;
  cntTxt.style = FX.gold(44, Object.assign({}, PLATE_NUM, { letterSpacing: 7 }));   // white: spaced (user 2026-11-13)
  accTxt.style = new PIXI.TextStyle({ fontFamily: "Georgia, serif", fontWeight: "900", fontStyle: "italic", fontSize: 50, fill: ["#FFF3B8", "#F5C24A", "#C47A16"], fillGradientStops: [0, 0.55, 1], stroke: "#4a2206", strokeThickness: 6, dropShadow: true, dropShadowColor: "#1a0800", dropShadowAlpha: 0.6, dropShadowBlur: 2, dropShadowDistance: 2, dropShadowAngle: Math.PI / 2, padding: 10 });   // = the chip labels
  const accPlate = new PIXI.Sprite(T("UI/total_plate")); accPlate.anchor.set(0.5); accPlate.position.set(CS_X, ACC_Y); cscreen.addChildAt(accPlate, 1);   // fixed: only the number pops
  accPlate.visible = false; accTxt.style = FX.gold(50, PLATE_NUM);   // white: parchment, like the count above it
  // white (user 2026-11-13: "use the lower x font for the upper one"): the TOTAL's "x" is the chip labels' own x
  // (assets/UI/total_x.webp, cut from label_1x by tools/total_x.py); the number stays bold gold.
  // accTxt.text = "x12" -> the x goes to accX, the number to accTxt, centred as a pair.
  const accX = new PIXI.Sprite(T("UI/total_x")); accX.scale.set(0.78);
  accX.anchor.set(1, 0.5); accTxt.parent.addChild(accX);
  { const pd = Object.getOwnPropertyDescriptor(PIXI.Text.prototype, "text");
    Object.defineProperty(accTxt, "text", { configurable: true, get() { return pd.get.call(this); }, set(v) {
      v = String(v); const hx = v.charAt(0) === "x"; pd.set.call(this, hx ? v.slice(1) : v); accX.visible = hx;
      const dw = this.width / (this.scale.x || 1), xw = hx ? accX.width : 0, gap = hx ? -2 : 0, x0 = -(xw + gap + dw) / 2;
      accX.position.set(x0 + xw, this.y - 2); this.x = x0 + xw + gap + dw / 2;
      if (accNum) accNum.set(v);                         // white 2026-11-18 b18: the outlined gold number (goldNum)
      if (accBT) { accBT.text = v; accBT.position.set(0, this.y + 2); accBT.scale.set(Math.min(1, 176 / Math.max(1, accBT.textWidth))); } } }); }   // white 2026-11-17: "x1000" fits its board
  // white (user 2026-11-13: "make the 9 bigger and same font as X"): the TOTAL in the chips' own lettering
  const accBT = new PIXI.BitmapText("x0", { fontName: "gold_digits", fontSize: 62 }); accBT.anchor.set(0.5); accTxt.parent.addChild(accBT);
  accTxt.renderable = false; accX.renderable = false;   // white: parchment, like the count above it
  // white 2026-11-18 b18 (user: "make the charge counter more beautiful, better letters and fonts"): BOTH board numbers in the
  // chips' own 3D gold lettering (gold_digits; its missing "/" is drawn here in the same gold), each with a dark outline and a
  // soft drop shadow (tinted copies, no filters) so they read on the red face and on the parchment. n.set("3/5") / n.set("x48")
  const NUM_SLASH = (() => { const c = document.createElement("canvas"); c.width = 92; c.height = 224; const g = c.getContext("2d");
    const gr = g.createLinearGradient(0, 12, 0, 212); gr.addColorStop(0, "#FFF4C2"); gr.addColorStop(0.3, "#FFD24E"); gr.addColorStop(0.72, "#F2A222"); gr.addColorStop(1, "#C2620C");
    g.beginPath(); g.moveTo(62, 12); g.lineTo(86, 12); g.lineTo(30, 212); g.lineTo(6, 212); g.closePath();
    g.lineJoin = "round"; g.lineWidth = 9; g.strokeStyle = "#9A4206"; g.stroke(); g.fillStyle = gr; g.fill();
    return PIXI.Texture.from(c); })();
  function goldNum(size, fit) {
    const c = new PIXI.Container(), L = [[0, 5, 0.55], [-2.5, 0, 0.95], [2.5, 0, 0.95], [0, -2.5, 0.95], [0, 2.5, 0.95], [0, 0, 1]];   // shadow, outline x4, face
    const rows = L.map(([x, y, a], i) => {
      const r = new PIXI.Container(); r.position.set(x, y); r.alpha = a;
      r.a = new PIXI.BitmapText("", { fontName: "gold_digits", fontSize: size }); r.b = new PIXI.BitmapText("", { fontName: "gold_digits", fontSize: size });
      r.s = new PIXI.Sprite(NUM_SLASH); r.s.scale.set((size / 224) * 0.92);
      [r.a, r.s, r.b].forEach((o) => { o.anchor.set(0.5); if (i < L.length - 1) o.tint = 0x1c0500; r.addChild(o); });
      c.addChild(r); return r; });
    c.set = (v) => {
      v = String(v); const k = v.indexOf("/"), A = k < 0 ? v : v.slice(0, k), B = k < 0 ? "" : v.slice(k + 1), gap = -size * 0.02;
      let tw = 0;
      rows.forEach((r) => { r.a.text = A; r.b.text = B; r.s.visible = r.b.visible = k >= 0;
        const wa = A ? r.a.width : 0, ws = r.s.width, wb = B ? r.b.width : 0;
        tw = k < 0 ? wa : wa + ws + wb + 2 * gap; const x0 = -tw / 2;
        r.a.position.set(x0 + wa / 2, size * 0.04); r.s.position.set(x0 + wa + gap + ws / 2, size * 0.02); r.b.position.set(x0 + wa + ws + 2 * gap + wb / 2, size * 0.04); });
      c.scale.set(Math.min(1, fit / Math.max(1, tw)));
    };
    return c;
  }
  const accNum = goldNum(LV1_NUM, 176); accTxt.parent.addChild(accNum); accBT.renderable = false; accNum.set("");
  // b19 (user 2026-11-19: "change the second popup text size according to the blue box"): the CHARGES count ("2/8") drawn
  // CNT_K of its old size (same lettering + outline, in a scaled holder), widest CNT_FIT px (the blue box, ~61% of the face).
  // cbPk(cntNum) still measures the unscaled number, so a pop peaks at most CNT_K x the old clamp (never back to the old size).
  // CNT_K = 1, CNT_FIT = 176 = old.
  const CNT_K = 0.65, CNT_FIT = 116;
  const cntNumW = new PIXI.Container(); cntNumW.scale.set(CNT_K); cntBox.addChild(cntNumW);
  const cntNum = goldNum(56, CNT_FIT / CNT_K); cntNumW.addChild(cntNum); cntTxt.renderable = false;
  // one (white 2026-11-16, user: "a one line popup above the multiplier"): only the TOTAL board (B), no CHARGES board
  function screenUp(on, one) {
    gsap.killTweensOf(cscreen); gsap.killTweensOf(cscreenA); if (on) cscreen.alpha = 1;
    if (on && one) { cscreen.visible = true; cscreen.y = CS_HIDE; cntBox.visible = false; cscreenA.visible = false; cscreenA.y = CS_A_HIDE; accum.visible = true; accum.alpha = 1; accum.scale.set(1);
      accum.y = ACC_Y; accTxt.text = ""; gsap.to(cscreen, { y: 0, duration: 0.35, ease: "back.out(1.2)" }); cscreen.one = true; }
    else if (on) { cscreen.visible = true; cscreen.y = CS_HIDE; cscreenA.visible = true; cscreenA.y = CS_A_HIDE; accum.visible = true; accum.alpha = 1; accum.scale.set(1); accum.y = ACC_Y; cscreen.one = false; accTxt.text = "x0";
      // b18: level 1 rises out of the column's top bar, then level 2 rises out of level 1's top band
      gsap.to(cscreen, { y: 0, duration: 0.4, ease: "back.out(1.2)" }); gsap.to(cscreenA, { y: 0, duration: 0.36, ease: "back.out(1.2)", delay: 0.26 }); }
    // white 2026-11-17 (right-side debug: the boards slid down EMPTY for ~0.35 s after their numbers had gone): they now fade
    // out as they sink, starting at once, in step with the numbers. b18: level 2 sinks into level 1, level 1 into the bar
    else { gsap.to(cscreenA, { y: CS_A_HIDE, duration: 0.16, ease: "power2.in" });
      gsap.to(cscreen, { y: CS_HIDE * 0.6, alpha: 0, duration: 0.26, delay: 0.08, ease: "power2.in", onComplete: () => { cscreen.visible = false; cscreen.alpha = 1; cscreen.y = CS_HIDE; cscreenA.y = CS_A_HIDE; accum.y = ACC_Y; cscreen.one = false; } }); }
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
  const drawSky = () => { bg.tint = 0xffffff; };   // white 2026-11-16 (user: "don't darken it"): the hall keeps its colour in the feature (was 38% darker)
  let featureOn = false;
  // calm (white 2026-11-18 b18, user: "we have 4 shakes of the board at the beginning of the G nudge chip demo, they should
  // not be there"): a CHARGE round's feature starts without the board shake / shockwave here and in gx_feature's intro beats
  function feature(on, calm) {
    if (on === featureOn) return;
    featureOn = on;
    GX.emit("feature", { on, calm: !!calm });
    gsap.killTweensOf(fireFrame); gsap.killTweensOf(featRays); gsap.killTweensOf(sky);
    if (on) {
      fireFrame.visible = true; fireFrame.alpha = 0;           // ignite bright, then settle to a sustained heat
      gsap.timeline().to(fireFrame, { alpha: 1, duration: 0.3, ease: "power2.out" }).to(fireFrame, { alpha: 0.62, duration: 0.45, ease: "power1.inOut" });
      gsap.to(featRays, { alpha: 0.55, duration: 0.5 });
      gsap.to(sky, { k: 1, duration: 0.6, onUpdate: drawSky });
      SFX.rumble(0.8); if (!calm) shake(8, 0.3); VFX.bloom(true, 0.25); SFX.music("feature"); SFX.fire(true);
      if (!calm) VFX.shockwave(540, 940, { amp: 22, radius: 1300, dur: 0.8 });
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
  function heavyHit(P, k, tint, noShapes) {        // noShapes (white 2026-11-16, the fist slam): no streak star, streaking dots, rings or hexagon chunks
    k = Math.max(0, Math.min(1, k)); tint = tint || 0xffc860;
    hitStop(50 + 70 * k); buzz(25 + 35 * k);
    shake(12 + 16 * k, 0.3 + 0.15 * k);
    flashScreen(0xfff0d0, 0.07 + 0.1 * k, 0.12);
    const lines = new PIXI.Container(); lines.position.set(P.x, P.y); fxTop.addChild(lines); lines.renderable = !noShapes;
    const nL = MOBILE ? 10 : 16;
    for (let i = 0; i < nL; i++) {
      const r = new PIXI.Sprite(FX.tex.ray); r.anchor.set(0.5, 1); r.blendMode = PIXI.BLEND_MODES.ADD; r.tint = i % 2 ? 0xffffff : tint;
      r.rotation = (i / nL) * Math.PI * 2 + (Math.random() - 0.5) * 0.25; r.scale.set(0.16 + Math.random() * 0.12, 0.03); r.alpha = 0.75; r.y = 0; lines.addChild(r);
      gsap.to(r.scale, { y: 0.16 + 0.16 * k + Math.random() * 0.08, duration: 0.12, ease: "power3.out" });
    }
    gsap.to(lines.scale, { x: 1.35, y: 1.35, duration: 0.26, ease: "power2.out" });
    gsap.to(lines, { alpha: 0, duration: 0.2, delay: 0.06, ease: "power2.in", onComplete: () => lines.destroy({ children: true }) });
    const nD = Math.round((MOBILE ? 8 : 16) * (0.5 + k));
    for (let i = 0; i < (noShapes ? 0 : nD); i++) {             // flat gold hexagon chunks (none with noShapes)
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5, sp = 500 + Math.random() * 900 * (0.6 + k);
      topP.emit({ tex: chunkTex, x: P.x + (Math.random() - 0.5) * 40, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 2400, drag: 0.4,
        s0: 0.6 + Math.random() * 0.9, s1: 0.4, life: 0.7 + Math.random() * 0.4, a0: 1, a1: 0.6, vr: (Math.random() - 0.5) * 18, blend: PIXI.BLEND_MODES.NORMAL });
    }
    if (!noShapes) {
      for (let i = 0; i < nD; i++) {
        const a = Math.random() * Math.PI * 2, sp = 700 + Math.random() * 900;
        topP.emit({ tex: FX.tex.dot, x: P.x, y: P.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3.2, s0: 0.3, s1: 0, life: 0.35, stretch: 500, tint: Math.random() < 0.5 ? 0xffffff : tint });
      }
      ringAt(P.x, P.y, 0xffffff, 1.6 + 1.6 * k, 0.22); ringAt(P.x, P.y, tint, 2.6 + 2.4 * k, 0.4);
    }
    const dx = P.x < 540 ? -1 : 1, kick = 8 + 14 * k;               // the board recoils away from the blow, then springs back
    const yNow = boardL.y;                                           // b19 (lead): a b19 hit-drop may still be springing back: no snap to 0
    gsap.killTweensOf(boardL, "x,y"); boardL.x = 0;
    if (!dropWorthy()) { if (yNow) gsap.to(boardL, { y: 0, duration: 0.25, ease: "power2.out" }); }
    else gsap.timeline().to(boardL, { x: dx * kick * 0.4, y: Math.max(kick, yNow), duration: 0.035, ease: "power2.in" })
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
  // b19 (user 2026-11-19: "a strong drop of the board, if we have a simple win with a multiplier bigger than 1x, and charge"):
  // the hit of a multiplier into a total board (win bar / TOTAL) drops the board ~2x the strongest old drop (WILD 1.4 = 30 px):
  // 2x = 48 px ... 100x+ = 60 px, a slightly longer fall and a softer spring back; overlapping hits never jump (max of the current y)
  const DROP_HIT = true;                                           // false = the old per-step / no hit drop
  function boardDropHit(v) {
    const k = Math.min(1, Math.log10(Math.max(2, Math.abs(v) || 2)) / 2);   // 2x = 0.15 ... 100x+ = 1
    gsap.killTweensOf(boardL, "y");
    const d = Math.max(boardL.y, 46 + 14 * k);
    gsap.timeline().to(boardL, { y: d, duration: 0.09, ease: "power2.in" }).to(boardL, { y: 0, duration: 0.65, ease: "back.out(1.5)" });
  }
  function flashScreen(tint, a, dur) {
    if (!BOARD_FLASH) return;                         // white 2026-11-16: no full-screen additive flash (it washed the whole board)
    gsap.killTweensOf(screenFlash); screenFlash.tint = tint; screenFlash.visible = true;
    gsap.fromTo(screenFlash, { alpha: a }, { alpha: 0, duration: dur, ease: "power2.out", onComplete: () => (screenFlash.visible = false) });
  }
  function impactAt(p, v) {
    VFX.shockwave(p.x, p.y, { amp: v >= 10 ? 30 : 18, radius: v >= 10 ? 900 : 600 });
    // white 2026-11-16 (calm look, review of the 13-change batch): no star flash, ring, spark burst or ray/chunk shapes;
    // the weight stays (shockwave, hit-stop, shake, board recoil, sound)
    flashAt(p.x, p.y, 0xfff0c0, 1.1, 0.08);
    SFX.impact(v >= 10); heavyHit(p, v >= 100 ? 0.9 : v >= 10 ? 0.65 : 0.4, multTint(v), true);
  }
  function pulseChip(big) {
    const v = colReel.views[4];
    gsap.fromTo(v.inner.scale, { x: big ? 1.45 : 1.3, y: big ? 1.45 : 1.3 }, { x: 1, y: 1, duration: 0.5, ease: "back.out(2)" });
    gsap.fromTo(v.flash, { alpha: 1 }, { alpha: 0, duration: 0.6 });   // white 2026-11-16: no ring (calm look)
  }
  // white 2026-11-16 (user: "a one line popup above the multiplier ... in a case we don't have a charge we show only one number")
  async function multShow(v, quick) {
    screenUp(true, true);
    await FX.wait(quick || S.turbo ? 0.1 : 0.15);       // white 2026-11-17: the number streaks in while the board still rises (it sat empty ~0.4 s)
    pulseChip(false);
    if (!quick) await streakToBadge(v);
    accSet(v, 1.4, 0.5); SFX.impact(false);
    await FX.wait(quick || S.turbo ? 0.12 : 0.3);
  }
  // white 2026-11-16 (user: "during the multiplier bigger than 1, we need to hit the total win board"): the bar, its text
  // and the count drop and spring back + one light sweep across the panel; no rings, dots or stars
  const WBH_REST = [[winBar, winBar.y], [wb, wb.y], [plaque, WB_Y2]];   // rest y, captured once (hits can overlap)
  function winBarHit(v) {
    const k = Math.min(1, Math.log10(Math.max(2, v)) / 2);          // 2x = 0.15 ... 100x+ = 1
    for (const [o, y0] of WBH_REST) {
      gsap.killTweensOf(o, "y");
      gsap.timeline().to(o, { y: y0 + 6 + 8 * k, duration: 0.07, ease: "power2.in" }).to(o, { y: y0, duration: 0.45, ease: "back.out(2.2)" });
    }
    // b19: the sweep's panel rect follows the bar (WB_Y1 - 26 = the old 1300, + 20 = the old 1346) since the bar moved up
    const m = new PIXI.Graphics().beginFill(0xffffff).drawRect(170, WB_Y1 - 26, 740, 93).endFill();
    const sw = new PIXI.Sprite(FX.tex.shine); sw.anchor.set(0.5); sw.blendMode = PIXI.BLEND_MODES.ADD; sw.alpha = 0.35 + 0.25 * k;
    sw.rotation = 0.35; sw.scale.set(1.2, 6); sw.position.set(200, WB_Y1 + 20); sw.mask = m; plaqueL.addChild(m, sw);
    gsap.to(sw, { x: 880, duration: 0.35, ease: "power1.inOut", onComplete: () => { sw.destroy(); m.destroy(); } });
    shake(3 + 5 * k, 0.15); buzz(15);
  }
  // Garuda multiplier hit: 0.5 s charge in place (1.6x, hot glow), 0.3 s flight, 0.2 s impact, 0.2 s absorb
  // fromScreen (white 2026-11-16): the number leaves the one-row screen (multShow) instead of the chip
  // b19 (user 2026-11-19: "the multiplier hits directly to the total win board, without coming forward and scaling"; "coins at
  // that second, not after"; "a strong drop of the board"): MH_WINDUP false = no chip scale-up / glow / wait, the number leaves
  // at its size in the chip and keeps it, a nearly straight accelerating line onto the bar, no pop on landing; the landing frame
  // also fires the board's strong drop (boardDropHit) and, with coinK > 0, the win-board coin burst (winBoardCoins)
  const MH_WINDUP = false;                                         // true = the b18 wind-up / 1.6 scale / arc / landing pop
  async function multHit(v, struck, fromScreen, coinK) {
    const chip = colReel.views[4], to = { x: plaque.x, y: plaque.y };
    let from = { x: COL_CX, y: COL_CY }, glow = null, k0 = 1;
    if (fromScreen) {                                  // a quick pop of the screen number, no wind-up on the chip
      gsap.killTweensOf(accum.scale);
      if (MH_WINDUP) { const k = cbPk(accNum, 1.3); await FX.tween(accum.scale, { startAt: { x: k, y: k }, x: 1, y: 1, duration: 0.15 }); }   // b18b: clamped to the board
      else { accum.scale.set(1); k0 = Math.abs(accNum.worldTransform.a / fxTop.worldTransform.a) || 1; }   // b19: no pre-pop, its own size
      from = fxTop.toLocal(accum.getGlobalPosition());
    } else if (!MH_WINDUP) {                           // b19: straight off the chip, the size its number has there
      gsap.killTweensOf(chip.inner.scale); chip.inner.scale.set(1);
      k0 = (chip.label && Math.abs(chip.label.worldTransform.a / fxTop.worldTransform.a)) || 1;
    } else {
      glow = new PIXI.Sprite(FX.tex.glow); glow.anchor.set(0.5); glow.position.set(from.x, from.y);
      glow.tint = 0xfff275; glow.blendMode = PIXI.BLEND_MODES.ADD; glow.alpha = 0; glow.scale.set(0.6); fxTop.addChild(glow);
      const cd = struck ? 0.16 : S.turbo ? 0.25 : 0.5;    // already struck by the bull's fireball: no second wind-up
      if (!struck) SFX.tease(cd);
      gsap.to(glow, { alpha: 0.5, duration: cd }); gsap.to(glow.scale, { x: 1.5, y: 1.15, duration: cd, ease: "power2.out" });
      await FX.tween(chip.inner.scale, { x: 1.6, y: 1.6, duration: cd, ease: "power2.out" });
    }
    const c = new PIXI.Container(); c.position.set(from.x, from.y); c.scale.set(MH_WINDUP ? (fromScreen ? 1.2 : 1.6) : k0);
    const g2 = new PIXI.Sprite(FX.tex.glow); g2.anchor.set(0.5); g2.scale.set(1.2, 0.8); g2.tint = 0xffc84a; g2.blendMode = PIXI.BLEND_MODES.ADD; g2.alpha = 0.55;
    const s = labelSprite(v); s.anchor.set(0.5);
    c.addChild(g2, s); fxTop.addChild(c);
    if (glow) { chip.inner.scale.set(1); gsap.to(glow, { alpha: 0, duration: 0.2, onComplete: () => glow.destroy() }); }
    if (fromScreen) { screenUp(false); gsap.to(accum, { alpha: 0, duration: 0.15, onComplete: () => { accum.visible = false; accum.alpha = 1; } }); }
    SFX.fly();
    // b19: a nearly straight line (the midpoint 10 px above the straight one; was 70 px above the higher end)
    const mid = MH_WINDUP ? { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 70 } : { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 10 }, p = { t: 0 };
    await FX.tween(p, { t: 1, duration: S.turbo ? 0.2 : 0.3, ease: fromScreen && MH_WINDUP ? "power2.in" : "power3.in", onUpdate: () => {   // b18: the direct chip hit flies 0.3 s too
      const q = FX.bezier(from, mid, to, p.t); c.position.set(q.x, q.y);
      if (nEmit(40)) topP.emit({ tex: FX.tex.spark, x: q.x, y: q.y, vx: (Math.random() - 0.5) * 90, vy: (Math.random() - 0.5) * 90, s0: 0.35, s1: 0, life: 0.2, tint: 0xffd700 });
    } });
    SFX.impact(v >= 10);   // white: no light on the counter board (user 2026-11-13)
    const hitK = Math.min(1, Math.log10(Math.max(2, v)) / 2);          // 2x = 0.15 ... 100x+ = 1
    flashScreen(multTint(v), 0.1 + 0.14 * hitK, 0.3);
    gsap.killTweensOf(plaque.scale);
    gsap.fromTo(plaque.scale, { x: PLAQUE_S * (1.18 + 0.22 * hitK), y: PLAQUE_S * (1.18 + 0.22 * hitK) }, { x: PLAQUE_S, y: PLAQUE_S, duration: 0.35, ease: "back.out(2.2)" });
    if (v >= 10) { flameKick(1.3); bullReact("tease"); } else if (v >= 5) { flameKick(0.8); bullReact("win"); } else flameKick(0.4);
    winBarHit(v);                                      // white 2026-11-16: the total-win board takes the hit
    winBoardImpact(v);                                 // white 2026-11-17: with an impact (user)
    if (DROP_HIT) boardDropHit(v);                     // b19: the strong board drop, in the landing frame
    if (coinK > 0) winBoardCoins(coinK, true);         // b19: the coins burst out of the bar in the landing frame (was before + after)
    if (!MH_WINDUP) {                                  // b19: no landing pop: the number melts into the bar at its size
      gsap.to(c, { alpha: 0, duration: 0.12, ease: "power1.in", onComplete: () => c.destroy({ children: true }) });
      await FX.wait(S.turbo ? 0.15 : 0.25);            // the hit reads before the count goes on (was the 0.4 s pop)
      return;
    }
    await FX.tween(c.scale, { x: 1.8, y: 1.8, duration: 0.07 });
    await FX.tween(c.scale, { x: 1.4, y: 1.4, duration: 0.13 });
    gsap.to(c, { alpha: 0, duration: 0.2, ease: "power2.in" });
    await FX.tween(c.scale, { x: 0, y: 0, duration: 0.2, ease: "power2.in" });
    c.destroy({ children: true });
  }
  // a value streaks straight up from the column centre into the screen's TOTAL (0.12 s; dur: optional, white 2026-11-16)
  // white 2026-11-18 b18 (user: "the animation of multipliers hitting the top multiplier box is too fast"): every flight into
  // the TOTAL board 1.5x longer (default 0.18 s; callers' durations x1.5) with a gentle acceleration; the hit's pop on the
  // board (accSet) settles 1.5x slower too
  async function streakToBadge(v, dur) {
    const c = new PIXI.Container(); c.position.set(COL_CX, COL_CY);
    const g = new PIXI.Sprite(FX.tex.glow); g.anchor.set(0.5); g.scale.set(0.9, 1.4); g.tint = 0xff8adf; g.blendMode = PIXI.BLEND_MODES.ADD;
    const s = labelSprite(v); s.anchor.set(0.5); s.scale.set(0.7);
    c.addChild(g, s); fxTop.addChild(c);
    SFX.fly();
    // white 2026-11-16: to the badge's real place (the screen may still be rising, or sit one row high); was accum.y
    const y0 = c.y, p = { t: 0 };
    await FX.tween(p, { t: 1, duration: dur || 0.18, ease: "sine.in", onUpdate: () => {
      c.y = y0 + (fxTop.toLocal(accum.getGlobalPosition()).y - y0) * p.t;
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
  const MH_COIN_K = 1.4;                                            // b19: a hit's coin spread is this much richer than a plain win's
  async function laserApply(acc, coinK) {                           // b20: coinK > 0 = the coin spread in the hit frame (coin rule)
    const from = fxTop.toLocal(accum.getGlobalPosition()), to = { x: plaque.x, y: plaque.y };   // white 2026-11-16: the badge's real place
    const g = new PIXI.Container(); fxTop.addChild(g);
    const L = Math.hypot(to.x - from.x, to.y - from.y), ang = Math.atan2(to.y - from.y, to.x - from.x);
    g.position.set(from.x, from.y); g.rotation = ang;
    const beam = (tex, sy, tint, a) => { const b = new PIXI.Sprite(tex); b.anchor.set(0, 0.5); b.blendMode = PIXI.BLEND_MODES.ADD;
      b.tint = tint; b.alpha = a; b.scale.y = sy; g.addChild(b); return b; };
    const outer = beam(FX.tex.shine, 2.6, 0xff6a1a, 0.45), mid = beam(FX.tex.shine, 1.3, 0xffc860, 0.9), core = beam(FX.tex.shine, 0.5, 0xfff4dc, 1);
    const bolt = null;   // white (lightning fix): the painted bolt (128x512 cell) was squashed to 0.45 wide, stretched to the laser's length, swapped every 3 ticks and covered only its middle 60% -> a blurry detached squiggle; the beam alone
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
    // b19 (lead, user item 9 "the multiplier to hit directly to total win board, without coming forward and scaling"): the
    // CHARGE / Fortune Choice total flies at one size, no 1.5 -> 0.8 scale, no boom flipbook at the bar (MH_WINDUP = old)
    const lab = new PIXI.Text("x" + fmtX(acc), FX.gold(64)); lab.anchor.set(0.5); lab.position.set(from.x, from.y); lab.scale.set(MH_WINDUP ? 1.5 : 1); fxTop.addChild(lab);
    gsap.to(accum, { alpha: 0, duration: 0.2, onComplete: () => { accum.visible = false; accum.alpha = 1; } });
    gsap.to(cntBox, { alpha: 0, duration: 0.2, onComplete: () => { cntBox.visible = false; cntBox.alpha = 1; } }); screenUp(false);
    if (MH_WINDUP) gsap.to(lab.scale, { x: 0.8, y: 0.8, duration: 0.2, ease: "back.in(2)" });
    await FX.tween(lab, { x: to.x, y: to.y, duration: 0.2, ease: "power2.in" });
    gsap.to(g, { alpha: 0, duration: 0.25, onComplete: () => g.destroy({ children: true }) });
    if (MH_WINDUP) boom(to.x, to.y, 1.0, 0xffe0b0);
    impactAt(to, acc); winBarHit(acc);
    if (DROP_HIT) boardDropHit(acc);                   // b19 (lead, user item 6 "and charge"): the CHARGE total's hit drops the board too                 // white 2026-11-16: the total-win board takes the hit
    if (coinK > 0) winBoardCoins(coinK, true);         // b20 (coin rule 2): CHARGE / SUPER WILD / Buy Bonus totals spread their coins at the hit
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
    // white 2026-11-16 (SUPER WILD sequence): plate() = the count plate's live centre in fxTop px (the number shoots from it)
    const plate = () => { try { if (t && !t.destroyed) return fxTop.toLocal(t.getGlobalPosition()); } catch (e) { /* view gone */ } return { x: x + SW_PLATE.x, y: y + SW_PLATE.y }; };
    return { x, y, n, plate, dec() {
      left = Math.max(0, left - 1);
      if (t && !t.destroyed) { t.text = `${left}/${n}`; gsap.fromTo(t.scale, { x: 1.45, y: 1.45 }, { x: 1, y: 1, duration: 0.22, ease: "back.out(2)" }); }
      // white 2026-11-16: no orange flash on the SUPER WILD (user: no colour animation on it apart from the eyes glow)
    } };
  }
  // WHITE VERSION (Garuda logic): the coins of the super wild halo - every value its charges will pick, then decoys from the
  // top of the strip, shuffled (gx_halo.js superHaloOpen / superHaloPick). Spliced in by tools/port_from_stone.py.

  // the column jumps to where the engine's strip walk stands (the super wild charges were picked in the halo, not nudged)
  function colJump(c) {
    colReel.setSyms(colIds(c));
    colReel.views.forEach((v) => { if (v.flash) gsap.fromTo(v.flash, { alpha: 0.7 }, { alpha: 0, duration: 0.4 }); });
    ringAt(COL_CX, COL_CY, 0xffd060, 1.6, 0.35); flashAt(COL_CX, COL_CY, 0xfff0c0, 1.0, 0.2);
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
  // white (Garuda column logic, 2026-11-13): a spinning column shows big chips; a landed window is drawn fresh
  function colShowPick() {
    const S_ = Engine.STRIP;
    if (Math.random() < 0.55) { const hot = []; for (let i = 0; i < S_.length; i++) if (S_[i] >= 50) hot.push(i); if (hot.length) return hot[Math.floor(Math.random() * hot.length)]; }
    return Math.floor(Math.random() * S_.length);
  }
  // slots k = 3..-3 (k > 0 above the centre); fixed = { k: strip index } for the slots the engine owns (centre, nudges)
  function colWindow(fixed) {
    const S_ = Engine.STRIP, L = S_.length, cv = S_[fixed[0]];
    const pick = (ok) => { for (let t = 0; t < 40; t++) { const i = Math.floor(Math.random() * L); if (ok(S_[i])) return i; } return Math.floor(Math.random() * L); };
    const out = {};
    for (const k of [3, 2, 1, -1, -2, -3]) {
      if (fixed[k] !== undefined) { out[k] = fixed[k]; continue; }
      const outer = Math.abs(k) >= 2;
      out[k] = pick((v) => (v < 0 ? outer || Math.random() < 0.25 : true));            // NUDGE chips mostly on the outer slots
    }
    if (cv > 0 && Math.random() < 0.7) {                                                // near miss: a bigger chip beside the centre
      const free = [1, -1].filter((k) => fixed[k] === undefined);
      if (free.length) { const k = free[Math.floor(Math.random() * free.length)], up = pick((v) => v > cv);
        if (S_[up] > cv) out[k] = up; }
    }
    return [3, 2, 1, 0, -1, -2, -3].map((k) => (k === 0 ? fixed[0] : out[k]));
  }
  const colIdxOf = (v) => { const i = Engine.STRIP.indexOf(v); return i < 0 ? 0 : i; };
  // fade (b18b, QA "the column contents swap in one frame" on a Fortune Choice CHARGE landing): a changed chip dips out
  // (0.05 s) and back in (0.08 s) with its new face instead of switching in one frame
  function colPlan(vals, flash, fade) {                 // white 2026-11-16: next values into views[5], [6], [7], [8] (below the centre: a run walks DOWN); the rest queue up
    for (let j = 0; j < 4 && j < vals.length; j++) {
      const vi = 5 + j, id = colIdxOf(vals[j]);
      if (colReel.syms[vi] === id) continue;
      colReel.syms[vi] = id;
      const v = colReel.views[vi];
      if (fade) { const parts = [v.b, v.f, v.fb, v.fc].filter(Boolean);
        gsap.to(parts, { alpha: 0, duration: 0.05, overwrite: true, onComplete: () => {
          if (colReel.views[vi] === v && colReel.syms[vi] === id) v.set(id, false);
          gsap.to(parts, { alpha: 1, duration: 0.08 }); } });
        continue; }
      v.set(id, false);
      if (flash && vi < 8 && v.flash) gsap.fromTo(v.flash, { alpha: 0.9 }, { alpha: 0, duration: 0.45 });
    }
    colQ.length = 0; vals.slice(4).forEach((v) => colQ.push(colIdxOf(v)));
  }
  const CB_FIT = 176;                                   // white 2026-11-17: widest number on a counter board (its face is ~190 px)
  // b18b (QA: "when the total bumps, the number scales beyond the board and covers the frame/posts"): a board number's pop
  // is clamped so the popped number stays inside its board (face ~190 x 65 px; the number itself is ~66 px tall with its
  // outline): width <= CB_POP_W, height <= CB_POP_H. cbPk(num, pk) = the allowed peak scale (>= 1)
  const CB_POP_W = 184, CB_POP_H = 74;
  const cbPk = (num, pk) => Math.max(1, Math.min(pk, CB_POP_W / Math.max(1, num.width), (CB_POP_H + (num === accNum ? LV1_EXTRA : 0)) / Math.max(1, num.height)));   // b20: the TOTAL board is LV1_EXTRA taller
  const cntShow = (o, pop) => {                         // the counter screen: done / total
    cntTxt.text = Math.min(o.done, o.tot) + "/" + o.tot;
    cntTxt.scale.set(Math.min(1, CB_FIT / Math.max(1, cntTxt.width / (cntTxt.scale.x || 1))));
    cntNum.set(cntTxt.text);                            // white 2026-11-18 b18: the outlined gold count (goldNum)
    if (pop) { const k = cbPk(cntNum, 1.2); gsap.fromTo(cntBox.scale, { x: k, y: k }, { x: 1, y: 1, duration: 0.1 }); }
  };
  const counter = (tot) => { const o = { done: 0, tot }; o.draw = (pop) => cntShow(o, pop); return o; };
  function badgeIn() {
    if (accum.visible) return;
    accum.visible = true; accum.scale.set(0);
    gsap.to(accum.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(2)" });   // white: no ring on the board
  }
  const accDraw = throttled(() => { accTxt.text = "x" + Math.round(accShown.v); }, TXT_DT), accShown = { v: 0 };
  const fmtX = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v)));   // white 2026-11-17: a capped total is fractional
  function accSet(v, pk, esc) {
    accShown.v = v; accTxt.text = "x" + fmtX(v);
    pk = cbPk(accNum, pk || 1.4);                       // b18b: the pop stays inside the TOTAL board
    gsap.fromTo(accum.scale, { x: pk, y: pk }, { x: 1, y: 1, duration: (0.3 + 0.22 * (esc || 0)) * (S.turbo ? 0.67 : 1), ease: "back.out(2)" });   // b18: x1.5 (was 0.2 + 0.15 esc)
  }
  // "+2 CHOICES" from the wheel to the counter screen
  function choiceFly(n) {
    const t = new PIXI.Text(`+${n} CHOICES`, FX.gold(40, { fill: ["#F0FFE0", "#B8F070", "#3E8A12"] }));
    t.anchor.set(0.5); t.position.set(540, 330); fxTop.addChild(t);
    const to = fxTop.toLocal(cntBox.getGlobalPosition());
    gsap.timeline({ onComplete: () => t.destroy() }).fromTo(t.scale, { x: 0.4, y: 0.4 }, { x: 1.1, y: 1.1, duration: 0.3, ease: "back.out(3)" })
      .to(t, { x: to.x, y: to.y, alpha: 0.2, duration: 0.45, ease: "power2.in", delay: 0.35 })
      .to(t.scale, { x: 0.5, y: 0.5, duration: 0.45 }, "<");
    SFX.nudgeActivate();   // white: no ring on the board
  }
  // "CHARGE n" over the column as a Fortune Choice CHARGE starts its run
  function chargeTag(n) {
    const p = fxTop.toLocal(frameL.toGlobal(new PIXI.Point(COL_CX, COL_CY)));
    const t = new PIXI.Text(`CHARGE ${n}`, FX.gold(44, { fill: ["#F8E8FF", "#D9A0FF", "#7A2FB0"] })); t.anchor.set(0.5); t.position.set(p.x - 150, p.y); fxTop.addChild(t);
    gsap.timeline({ onComplete: () => t.destroy() }).fromTo(t.scale, { x: 0.3, y: 0.3 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(3)" })
      .to(t, { alpha: 0, y: p.y - 60, duration: 0.4, delay: 0.5 });
    SFX.nudgeActivate(); if (!DROP_HIT) boardDrop(1.2);   // b19 (lead): with DROP_HIT only the hits into TOTAL drop the board. Old: strong drop; white 2026-11-16: no flash / ring, the yellow bolt from the orb lights the CHARGE
    chargeStrike({ x: COL_CX, y: COL_CY });
  }
  // one CHARGE run: every action nudges the column one chip in. Runs speed up after 8 actions; past 24 the rest rolls
  // in at once (the column jumps to its last chips, the total counts up).
  async function runActions(vals, acc, ctr) {
    const n = vals.length, FAST = 24;
    for (let k = 0; k < n; k++) {
      if (k === FAST && n - k > 6) {
        const rest = vals.slice(k), add = rest.reduce((a, v) => a + (v > 0 ? v : 0), 0), more = rest.reduce((a, v) => a + (v < 0 ? -v : 0), 0);
        const last = colIdxOf(rest[rest.length - 1]), ids = [];
        for (let i = 0; i < 9; i++) { const b = 4 - i; ids.push(b >= 0 && b < rest.length ? colIdxOf(rest[rest.length - 1 - b]) : stripAt(last, b)); }   // white 2026-11-16: collected chips above the centre, strip below
        colQ.length = 0; colReel.setSyms(ids); colReel.views.forEach((v) => { if (v.flash) gsap.fromTo(v.flash, { alpha: 0.8 }, { alpha: 0, duration: 0.5 }); });
        SFX.tease(0.6); shake(8, 0.5); flashAt(COL_CX, COL_CY, 0xfff0c0, 1.6, 0.3);
        ctr.tot += more; ctr.done = ctr.tot; ctr.draw(true);
        accShown.v = acc;
        await FX.tween(accShown, { v: acc + add, duration: S.turbo ? 0.8 : 1.8, ease: "power1.in", onUpdate: () => { accDraw(); if (Math.random() < 0.3) SFX.tick(); } });
        acc = capAdd(acc, add); accSet(acc, 1.6, 1); SFX.impact(true); flashScreen(multTint(Math.min(1000, add)), 0.16, 0.35);
        if (DROP_HIT) boardDropHit(add);                 // b19: the rolled-in rest hits TOTAL: the same strong drop
        return acc;
      }
      // white 2026-11-16 (user: "charge collect should be slower"): 1.5 / 1.25 s steps (were 1.0 / 0.68), gentler speed-up from the 9th
      const v = vals[k], f = k < 8 ? 1 : Math.max(0.45, Math.pow(0.9, k - 7));
      const STEP = ((S.turbo ? 0.6 : k === 0 ? 1.5 : 1.25) + (v < 0 ? 0.35 : 0)) * f;
      const t0 = gsap.globalTimeline.time();
      await FX.wait(0.06 * f);
      const esc = n > 1 ? k / (n - 1) : 1, lastN = k === n - 1 && n > 1 && !S.turbo && n <= FAST;
      if (lastN) { SFX.tease(0.5); gsap.to(vignette, { alpha: 0.5, duration: 0.25, onStart: () => (vignette.visible = true) }); await FX.wait(0.3); }
      // b19 (user 2026-11-19: "a strong drop of the board ... and charge"): the drop + its shake moved from the column's step
      // to the moment the collected value hits TOTAL (below); the step itself is calm (DROP_HIT false = the old step drop)
      SFX.nudge(esc); if (!DROP_HIT) { shake(4 + 6 * esc, 0.12 + 0.08 * esc); boardDrop(0.4 + 0.6 * esc); } cfKnock(10);
      if (fireFrame.visible) gsap.to(fireFrame, { alpha: 0.62 + 0.38 * esc, duration: 0.2 });
      await colReel.nudge(lastN ? 0.55 : (S.turbo ? 0.22 : 0.32) * Math.max(0.7, f), true);     // white 2026-11-16: the strip steps up (the chip below comes in)
      if (lastN) gsap.to(vignette, { alpha: 0, duration: 0.3, onComplete: () => (vignette.visible = false) });
      ctr.done++; ctr.draw(true);
      if (v < 0) { ctr.tot += -v; ctr.draw(false); await nudgeChipFire(-v); }
      else {
        pulseChip(v >= 50);
        await FX.wait((S.turbo ? 0.08 : 0.25) * f);          // white 2026-11-16: the chip can be read before it is taken
        if (f > 0.55) await streakToBadge(v, (S.turbo ? 0.22 : 0.33) * Math.max(0.7, f));   // b18: x1.5 (was 0.22)
        badgeIn(); acc = capAdd(acc, v); accSet(acc, 1.25 + 0.5 * esc, esc);
        if (DROP_HIT) { boardDropHit(v); shake(4 + 6 * esc, 0.12 + 0.08 * esc); }   // b19: the strong drop as the value hits TOTAL (shake as before)
        SFX.impact(lastN || v >= 50); SFX.rise(esc);   // white: no ring on the board
        if (lastN || v >= 50) flashScreen(multTint(v), 0.14, 0.3);
      }
      const el = gsap.globalTimeline.time() - t0;
      if (el < STEP) await FX.wait(STEP - el);
    }
    return acc;
  }
  // white 2026-11-16 SUPER WILD sequence (user, after Fortune Garuda: "when we have a superwild, we need an character activation
  // animation, then it drops the super wild, then again animation and then it slowly gather multipliers on the halo wheel, 7
  // chosen and one randomly generated, then the number from superwild shoots to the halo ring"). Steps 1-2 here (nudgePhase
  // calls it): the bull's punch = the activation; every winning SUPER WILD lifts off its cell during the wind-up and drops back
  // with the fist, its plate switching N -> N/N; the fire frame comes on. Steps 3-5 (roar, slow gathering, the count into the
  // ring) are in fortuneChoiceShow. Returns the SUPER WILD counters. Only v.c.pivot / v.c.scale move (gx_symbols owns
  // v.inner), always restored to the cell's base scale.
  async function swActivate(r) {
    r.bullActed = true;
    const cells = r.superCells.map((c) => { const reel = Math.floor(c / 3), row = c % 3; return { c, reel, row, v: reels[reel].view(row) }; }).filter((o) => o.v && o.v.c);
    const T = S.turbo ? 0.22 : 0.42, BX = GPASS ? SYM_SX : 1, BY = GPASS ? SYM_SY : 1;
    cells.forEach((o) => {
      gsap.to(o.v.c.pivot, { y: 30, duration: T, ease: "power2.out", overwrite: true });
      gsap.to(o.v.c.scale, { x: BX * 1.12, y: BY * 1.12, duration: T, ease: "power2.out", overwrite: true }); });
    let down = false;
    const drop = (d) => { if (down) return; down = true;
      cells.forEach((o) => { gsap.to(o.v.c.pivot, { y: 0, duration: d, ease: "power3.in", overwrite: true });
        gsap.to(o.v.c.scale, { x: BX, y: BY, duration: d, ease: "power3.in", overwrite: true }); }); };
    try {
      if (!featureOn) {
        const slam = bullSlam(true);                       // the punch: its wind-up = the activation
        const mv = [bullDir.cur].concat(bullDir.queue).find((m) => m && m.name === "bull_punch" && !m.ended);
        // the SUPER WILDs fall on the swing and land with the fist (the hit's own cell hop then bounces them); the code
        // lunge (no clip) hits ~0.3 s in
        await (mv ? Promise.race([mv.at("swing"), FX.wait(1.6)]) : FX.wait(S.turbo ? 0.1 : 0.2));
        drop(0.11);
        await slam;
      } else { await FX.wait(T + 0.12); drop(0.1); await FX.wait(0.1); }
    } finally { drop(0.1); }
    boardDrop(1.4); SFX.superLand(); buzz(30); hitStop(50);
    const sw = cells.map((o) => { GX.emit("wildLand", { reel: o.reel, row: o.row, id: "super_wild", x: REEL_CX[o.reel], y: rowY(o.row), view: o.v });
      return superCounter(o.c, r.superCharges && r.superCharges[o.c]); });          // plate: N -> N/N with its pop
    if (!featureOn) { gsap.fromTo(featRays, { alpha: 1 }, { alpha: 0.55, duration: 1.4 }); flameKick(1.2); feature(true); }
    await FX.wait(S.turbo ? 0.12 : 0.3);
    return sw;
  }
  // Fortune Choice on the halo wheel. ctr = the counter (picks done / Choices); sw = the SUPER WILDs' counters (natural)
  // white 2026-11-17 (Fortune Garuda 04:44-04:47): the picked multiplier coin goes into the bull's hand and he throws it into
  // the column (bullOrb with the wheel's hand-off coin; no clip: the coin flies itself); the centre chip shows the value
  async function pickThrow(v, j) {
    const to = { x: COL_CX, y: COL_CY }, tint = multTint(v) === 0xffd070 ? 0xffb040 : multTint(v);
    await bullOrb(to, tint, v, S.turbo ? 2 : 1, true, true);   /* b22: one uniform throw speed (was 1.3, 1.6 from the third pick) */    // (no clip: the coin flies itself, coinFlies)
    const id = colIdxOf(v);
    if (Engine.STRIP[id] === v) { colReel.syms[4] = id; const cv = colReel.views[4]; cv.set(id); cv.setY(COL_CY); }
    // b18b (QA: calm landing): a small scale-settle under the fading coin (was pulseChip: 1.3-1.45 pop + white glint flash)
    gsap.fromTo(colReel.views[4].inner.scale, { x: 1.18, y: 1.18 }, { x: 1, y: 1, duration: 0.35, ease: "back.out(1.6)" });
  }
  // 2026-11-18 (user: "when the character chooses the charge, it should hit with the charge, and in the box we got to see the
  // charge chip, charge counter working and choosing the number and hitting the second level of the popup box, basically the
  // nudge chip state"; "in the max win case, the pink charge number effect after the character chooses charge should be
  // removed"): a Fortune Choice CHARGE pick plays the nudgechip state. The wheel's CHARGE coin is handed to the bull and he
  // throws it into the column (the same hand-off as a multiplier pick, bullOrb picked + calm); the centre slot becomes the
  // CHARGE chip (chevrons in its window); the yellow bolt from the orb (chargeStrike); nudgeChipFire: the count rolls in and
  // "+N CHARGES" rises into the CHARGES board, which then counts the run 0/N, 1/N ...; the run walks DOWN the column
  // (colPlan + runActions, every chip into the TOTAL); then the board shows the Choices again. No pink "CHARGE N" tag.
  const FC_CHARGE_THROW = true, CHARGE_TAG = false, FC_CHARGE_BOLT = false;   // b18b: no bolt after a thrown CHARGE coin
  async function pickCharge(p, j, acc, ctr) {
    const to = { x: COL_CX, y: COL_CY }, id = colIdxOf(-p.n), onStrip = Engine.STRIP[id] === -p.n;
    await bullOrb(to, 0xffe14a, -p.n, S.turbo ? 2 : 1, true, true);   /* b22: one uniform throw speed (was 1.3, 1.6 from the third pick) */    // (no clip: the coin flies itself, coinFlies)
    // b18b (QA): calm landing - the swap happens under the coin as it fades (comet calm, 0.12 s), a small scale-settle, the
    // chips below dip-fade to the run's values; no bolt: the thrown coin IS the hit (FC_CHARGE_BOLT restores chargeStrike)
    if (onStrip) { colReel.syms[4] = id; const cv = colReel.views[4]; cv.set(id); cv.setY(COL_CY);
      gsap.fromTo(cv.inner.scale, { x: 1.18, y: 1.18 }, { x: 1, y: 1, duration: 0.35, ease: "back.out(1.6)" }); }
    colPlan(p.vals, false, true);                       // the run's chips below the centre
    await FX.wait(S.turbo ? 0.1 : 0.3);
    if (FC_CHARGE_BOLT) await chargeStrike(to);
    await nudgeChipFire(p.n, true, !onStrip);
    const run = counter(p.n); run.draw(false);          // the CHARGES board: the run's own count (nudgeChipFire popped it)
    await FX.wait(S.turbo ? 0.1 : 0.3);
    acc = await runActions(p.vals, acc, run);
    await FX.wait(S.turbo ? 0.1 : 0.35);
    ctr.draw(true);                                     // back to the Choices
    return acc;
  }
  async function fortuneChoiceShow(r, acc, ctr, sw, from) {
    const fc = r.fc, vals = fc.board.map((b) => (b.t === "mult" ? b.v : b.t === "charge" ? -b.n : "c2"));
    const natural = r.superCells.length > 0;
    if (natural && (!sw || !sw.length)) sw = r.superCells.map((c) => superCounter(c, r.superCharges && r.superCharges[c]));   // no swActivate seam
    const owner = []; (sw || []).forEach((s) => { for (let i = 0; i < s.n; i++) owner.push(s); });
    ctr.done = 0; ctr.tot = fc.choices0; ctr.draw(true);
    // white 2026-11-16 SUPER WILD sequence, step 3 ("then again animation"): the roar with the orb raised; the ring opens on it
    bullReact("big"); flameKick(1.0);
    const mv = bullLive() ? bullPlay("bull_big") : null;                            // the same running move bullReact started
    await (mv ? Promise.race([mv.at("roar"), FX.wait(1.2)]) : FX.wait(S.turbo ? 0.25 : 0.5));
    // step 4 ("slowly gather multipliers on the halo wheel, 7 chosen and one randomly generated"): gx_halo superHaloOpen slow -
    // the positions fly out of different column chips one by one, the last one is rolled in the bull's hand orb. The wheel keeps
    // the engine's 9 positions (8 gathered + 1 generated)
    await GX.run("superHaloOpen", { vals, slow: true }, 20000);
    // step 5 ("then the number from superwild shoots to the halo ring"): white 2026-11-17 (user: "look at the video 04:10 to
    // 05:05", Fortune Garuda): no separate count flight; every Choice is fired by its SUPER WILD (fireball + three flame
    // streaks into the ring, gx_halo superHaloPick d.sw), its plate counting down N/N -> N-1/N. The counter takes all the
    // Choices at once here (the 2026-11-16 count flight is gone; gx_halo superHaloCharge with it).
    ctr.tot = fc.choices0; ctr.draw(true);
    const accAt = () => fxTop.toLocal(accum.getGlobalPosition());
    const colAt = () => fxTop.toLocal(frameL.toGlobal(new PIXI.Point(COL_CX, COL_CY)));
    const cntAt = () => fxTop.toLocal(cntBox.getGlobalPosition());
    for (let j = 0; j < fc.picks.length; j++) {
      const p = fc.picks[j], s = owner[j];
      if (s) s.dec();                                 // white 2026-11-16: no orange ring on the SUPER WILD
      badgeIn();
      const to = p.t === "mult" ? accAt() : p.t === "charge" ? colAt() : cntAt(), thr = p.t === "mult" || (p.t === "charge" && FC_CHARGE_THROW);
      await GX.run("superHaloPick", { pos: p.pos, v: vals[p.pos], from: s ? { x: s.x, y: s.y } : from, to, sw: !!s, throw: thr }, 12000);
      ctr.done++; ctr.draw(true);
      if (thr && p.t === "charge") {                    // 2026-11-18: the nudgechip state (pickCharge), then the ring comes back
        acc = await pickCharge(p, j, acc, ctr);
        if (j < fc.picks.length - 1) { await FX.wait(S.turbo ? 0.1 : 0.25); await GX.run("superHaloShow", {}, 1500); }
      } else if (thr) {                                 // white 2026-11-17: he throws it into the column, it streaks up into the TOTAL
        await pickThrow(p.v, j);
        await streakToBadge(p.v, S.turbo ? 0.18 : 0.3);   // b18: x1.5 (was 0.12 / 0.2)
        acc = capAdd(acc, p.v); accSet(acc, 1.4, 0.5); SFX.impact(p.v >= 50); SFX.rise(j / Math.max(1, fc.picks.length - 1));
        if (p.v >= 50) flashScreen(multTint(p.v), 0.14, 0.3);
        if (j < fc.picks.length - 1) { await FX.wait(S.turbo ? 0.1 : 0.25); await GX.run("superHaloShow", {}, 1500); }
      } else if (p.t === "choice2") {
        ctr.tot += 2; choiceFly(2); await FX.wait(0.5); ctr.draw(true);
      } else {                                          // (FC_CHARGE_THROW off) the column runs this CHARGE's actions into the total
        if (CHARGE_TAG) chargeTag(p.n); else chargeStrike({ x: COL_CX, y: COL_CY });
        colPlan(p.vals, true); await FX.wait(0.45);
        const run = counter(p.n); run.draw(true);
        acc = await runActions(p.vals, acc, run);
        ctr.draw(true);
      }
    }
    owner.slice(fc.picks.length).forEach((s) => s.dec());   // Choices capped at 9: the rest of the counts are spent too
    await GX.run("superHaloClose", {}, 2000);
    return acc;
  }
  // white 2026-11-16 (user: "the character should not throw during a charge, it should only do lighting strike from the
  // ball, in yellow color"): a CHARGE is lit by ONE yellow bolt from the orb in the bull's hand - no throw, no punch
  async function chargeStrike(to) {
    const o = handOrb(); flameKick(1.0); bullReact("tease");          // eyes + aura only: no clip
    SFX.lightning(); handStrike({ x0: o.x, y0: o.y, x: to.x, y: to.y, col: 0xffe14a, dur: 0.5, w: 15, branches: 2 });
    if (BOLT_BALL) { await boltBall(o, to, 0xffc030, S.turbo ? 0.2 : 0.4); return; }   // b22: a burning ball rides the bolt in
    await FX.wait(S.turbo ? 0.18 : 0.38);
  }
  // b22 (user 2026-11-20: "during the lightning strike to the multiplier, we need the burning ball to come and hit the multiplier
  // as well, like an electrical charge; on the charge case and the clash case"): a calm fire ball (comet, no chip face) leaves
  // the hand orb with the bolt, runs straight along it and hits the chip; at the hit a few short electric arcs crackle
  // round the chip and its face flashes. ?noboltball = the bolt alone
  const BOLT_BALL = !params.has("noboltball");
  async function boltBall(from, to, tint, dur) {
    const f = { x: from.x, y: from.y }, ctrl = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    await comet(f, ctrl, to, tint, null, dur, true);
    const ix = Math.abs(to.y - COL_CY) < 4 ? 4 : Math.abs(to.y - (COL_CY - COL_P)) < 4 ? 3 : -1, v = ix >= 0 ? colReel.views[ix] : null;
    if (v && v.flash) gsap.fromTo(v.flash, { alpha: 0.9 }, { alpha: 0, duration: 0.4, ease: "power2.out" });
    for (let k = 0; k < 3; k++) {                                 // short arcs out of the chip's rim
      const a = Math.random() * Math.PI * 2, r0 = 50, r1 = 95 + Math.random() * 30;
      gsap.delayedCall(k * 0.05, () => handStrike({ x0: to.x + Math.cos(a) * r0, y0: to.y + Math.sin(a) * r0 * 0.6, x: to.x + Math.cos(a) * r1, y: to.y + Math.sin(a) * r1 * 0.6,
        col: 0xfff2c0, dur: 0.22, w: 4, branches: 0 }));
    }
    SFX.tick();
  }
  // white 2026-11-16 (user: "when we get a charge in the main board it should go to the multiplier panel, then start to
  // collect"): the CHARGE symbol with its count flies from its cell into the centre slot and becomes the CHARGE chip
  // showing that count; then the bolt and "+N CHARGES". The symbol stays in its cell as a ghost (nudgePhase restores it).
  async function chargeToColumn(b, ghosts) {            // b = { cell, n, vals }
    const reel = Math.floor(b.cell / 3), row = b.cell % 3, v = reels[reel].view(row);
    const from = { x: REEL_CX[reel], y: rowY(row) }, to = { x: COL_CX, y: COL_CY };
    const fly = new PIXI.Container(); fly.position.set(from.x, from.y); fxTop.addChild(fly);
    const glow = new PIXI.Sprite(FX.tex.glow); glow.anchor.set(0.5); glow.tint = 0xc070ff; glow.alpha = 0.35; glow.scale.set(1.2); glow.blendMode = PIXI.BLEND_MODES.ADD;
    const sym = new PIXI.Sprite(v.a.texture); sym.anchor.set(0.5);
    const win = new PIXI.Container(); win.position.set(0.5, -31.4);                       // the same window + digits as SymView.showCharge
    const ww = new PIXI.Sprite(T("UI/charge_window")); ww.anchor.set(0.5); ww.scale.set(0.9); win.addChild(ww);
    const sps = String(b.n).split("").map((d) => { const sp = new PIXI.Sprite(T("UI/charge_digit_" + d)); sp.anchor.set(0.5); sp.scale.set(0.38); return sp; });
    const step = (sp) => sp.width * 0.84; let x = -sps.reduce((a, sp) => a + step(sp), 0) / 2;
    sps.forEach((sp) => { sp.x = x + step(sp) / 2; x += step(sp); win.addChild(sp); });
    fly.addChild(glow, sym, win);
    ghosts.push(v); gsap.to(v.c, { alpha: 0.3, duration: 0.2 });
    SFX.nudgeActivate();
    await FX.tween(fly.scale, { x: 1.15, y: 1.15, duration: 0.2, ease: "back.out(2)" });
    const D = S.turbo ? 0.3 : 0.55, ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 140 }, p = { t: 0 };
    gsap.to(fly.scale, { x: 0.5, y: 0.5, duration: D, ease: "power2.inOut" });
    await FX.tween(p, { t: 1, duration: D, ease: "power2.inOut", onUpdate: () => { const q = FX.bezier(from, ctrl, to, p.t); fly.position.set(q.x, q.y); } });
    const id = colIdxOf(-b.n), landed = Engine.STRIP[id] === -b.n;
    if (landed) {                                       // the centre chip becomes the CHARGE chip, its count already shown
      colReel.syms[4] = id; const cv = colReel.views[4]; cv.set(id, false); cv.setY(COL_CY); cv.chargeDigits(b.n); cv.cbChev.alpha = 0;
      gsap.killTweensOf(fly.scale); fly.destroy({ children: true });
      gsap.fromTo(cv.inner.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.5, ease: "elastic.out(1,0.45)" });
      if (!DROP_HIT) boardDrop(1.2);                   // b19: in a CHARGE round only the hits into TOTAL drop the board
    }
    await chargeStrike(to);
    await nudgeChipFire(b.n, true, true);
    if (!landed) gsap.to(fly, { alpha: 0, duration: 0.25, onComplete: () => fly.destroy({ children: true }) });   // (no such chip on the strip: the copy stood in)
  }
  async function nudgePhase(r) {
    accCap = r.capped ? r.mult : Infinity;
    const chipStart = r.startMult < 0, bruns = r.boardRuns || [], hasCharge = chipStart || bruns.length > 0;
    let sw = null;
    // white 2026-11-16 (user: "the character should not throw during a charge"): no punch / throw clip in a CHARGE round
    if (r.fc && typeof swActivate === "function") sw = await swActivate(r);   // package B: bull activation + SUPER WILD drop (returns the counters)
    else if (!featureOn && !hasCharge) await bullCharge();                      // (Fortune Choice only, before package B lands)
    if (!featureOn) feature(true, !r.fc);              // b18: a CHARGE round starts calm (no shake / shockwave / intro beats)
    let acc = chipStart ? 0 : r.startMult;
    const ghosts = []; let ok = false;                  // board CHARGE symbols left as ghosts in their cells (chargeToColumn)
    try {
      const ctr = counter(r.chipSteps || (bruns.length ? bruns[0].n : 0) || (r.fc ? r.fc.choices0 : 0));   // no 0/N flicker before the SUPER WILD shoot
      screenUp(true); cntBox.visible = true; cntBox.scale.set(0); ctr.draw(false); centreMark.visible = true; centreMark.alpha = 0;
      gsap.to(centreMark, { alpha: 1, duration: 0.25 });
      lineGfx.forEach((g) => gsap.to(g, { alpha: 0.12, duration: 0.2 }));      // paylines step back while the column works
      r.bullActed = true;
      await FX.tween(cntBox.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(1.7)" });
      if (!sw) sw = r.superCells.map((c) => superCounter(c, r.superCharges && r.superCharges[c]));
      if (chipStart) { await chargeStrike({ x: COL_CX, y: COL_CY }); await nudgeChipFire(r.chipSteps, true); }   // (was: the throw clip + comet)
      else { pulseChip(false); await streakToBadge(r.startMult, S.turbo ? 0.2 : 0.32); badgeIn(); accSet(acc, 1, 0); SFX.impact(false); }   // b18b: 0.32 / 0.2 s like the charge chips (was the 0.18 s default)
      if (r.nudges.length) { colPlan(r.nudges, false); acc = await runActions(r.nudges, acc, ctr); }
      for (const b of bruns) {                          // every CHARGE symbol on the board flies into the column, then fires its count there
        await chargeToColumn(b, ghosts);
        colPlan(b.vals, true); await FX.wait(0.3);
        const run = counter(b.n); run.draw(true);
        acc = await runActions(b.vals, acc, run);
      }
      if (r.fc) acc = await fortuneChoiceShow(r, acc, ctr, sw, { x: COL_CX, y: COL_CY });
      lineGfx.forEach((g) => gsap.to(g, { alpha: 1, duration: 0.2 }));
      ok = true; window.G.lastAcc = acc;               // QA: the shown total (multiplier units) vs the engine's r.mult
      return acc;
    } finally {                                         // the ghosted CHARGE symbols come back (at once if something threw)
      if (!ok) GX.run("superHaloClose", {}, 1000);      // white 2026-11-17: and an open SUPER WILD wheel closes
      ghosts.forEach((v) => { if (ok) gsap.to(v.c, { alpha: 1, duration: 0.25, overwrite: "auto" }); else { gsap.killTweensOf(v.c, "alpha"); v.c.alpha = 1; } });
    }
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
    veil.alpha = 0; cellFxBack.addChild(veil); winObjs.push(veil); gsap.to(veil, { alpha: 0.6 * WIN_VEIL / 0.65, duration: 0.3 });   // white: WIN_VEIL 0 = parchment stays
    reels.forEach((rl) => [0, 1, 2].forEach((row) => rl.view(row).dim(0.6)));
    msgTxt.visible = false;                                                  // the plaque takes the footer
    plaqueBg.alpha = 1; plaqueGlow.alpha = 0.5; plaqueTxt.visible = true; plaqueBig.visible = false; plaque.visible = true; wbTotal.visible = false;
    plaqueShown.v = bet; drawPlaque(); plaque.alpha = 0; plaque.scale.set(0.6 * PLAQUE_S);
    gsap.to(plaque, { alpha: 1, duration: 0.1 }); gsap.to(plaque.scale, { x: PLAQUE_S, y: PLAQUE_S, duration: 0.25, ease: "back.out(2)" });
    const ctr = counter(r.fc.choices0);                                     // the counter screen first (it resets its total)
    screenUp(true); cntBox.visible = true; cntBox.scale.set(0); ctr.draw(false);
    await FX.tween(cntBox.scale, { x: 1, y: 1, duration: 0.25, ease: "back.out(1.7)" });
    colJump(r.multIndex); await FX.wait(0.4);                               // the column lands on the starting multiplier
    pulseChip(r.startMult >= 50); await streakToBadge(r.startMult, S.turbo ? 0.2 : 0.32); badgeIn();   // b18b: 0.32 / 0.2 s (was 0.18)
    let acc = r.startMult; accSet(acc, 1.4, 0); SFX.impact(r.startMult >= 50);
    r.bullActed = true;
    acc = await fortuneChoiceShow(r, acc, ctr, [], { x: 540, y: 470 });
    window.G.lastAcc = acc;                              // QA: the shown total vs the engine's r.totalX
    await laserApply(Math.max(1, acc), r.win > 0 ? (r.win < r.stake ? 0.5 : r.totalX >= 5 ? 1.3 : 1) * MH_COIN_K : 0);   // b20 (coin rule): the spread at the hit
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
  const chipAbove = () => { const v = colReel.views[3]; return v ? v.v : 0; };   // white 2026-11-17: the chip the player sees above the centre
  function clashWanted(r) {
    const up = chipAbove();
    return r.startMult >= 5 && up > r.startMult && (S.forceKind === "clash" || (S.forceKind !== "halo" && r.totalX >= 5 && Math.random() < 0.3));
  }
  async function clash(r) {
    feature(true);
    const upV = chipAbove(), cur = r.startMult;
    const chest = CHEST;
    GX.emit("clashStart", { chest, up: upV, cur });
    bullReact("big");
    gsap.fromTo(featRays, { alpha: 1 }, { alpha: 0.55, duration: 0.8 });
    { const o = handOrb(); flashAt(o.x, o.y, 0xfff0c0, 1.0, 0.3); } SFX.rumble(1.2);   // white (lightning fix): the orb charges (was a 3x white flash on the chest)
    await FX.wait(S.turbo ? 0.25 : 0.4);
    // white (lightning fix): the clash bolts leave the orb in the hand like every strike (they were bare 4-8 px lines
    // from the chest, re-scribbled every frame): one held bolt per medallion (gx_feature handStrike), the second a beat later
    { const o = handOrb(); handStrike({ x0: o.x, y0: o.y, x: COL_CX, y: COL_CY - COL_P, dur: 0.62, col: 0xfff2c0 });
      if (BOLT_BALL) boltBall(o, { x: COL_CX, y: COL_CY - COL_P }, 0xffc030, S.turbo ? 0.22 : 0.42); }   // b22: burning balls ride the clash bolts
    gsap.delayedCall(0.08, () => { const o = handOrb(); handStrike({ x0: o.x, y0: o.y, x: COL_CX, y: COL_CY, dur: 0.54, col: 0xfff2c0, w: 11, branches: 1 });
      if (BOLT_BALL) boltBall(o, { x: COL_CX, y: COL_CY }, 0xffc030, S.turbo ? 0.22 : 0.4); });
    const zt = gsap.to({}, { duration: 0.6, onUpdate: () => {
      if (Math.random() < 0.2) burstAt(COL_CX, COL_CY - (Math.random() < 0.5 ? COL_P : 0), 0xffd060, 6);
    } });
    SFX.impact(false);
    await FX.wait(0.6); zt.kill();
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
    if (!dropWorthy()) return;                           // white: symbols hop only for WILD / SUPER WILD / CHARGE
    const A = amt || 10, Rr = radius || 520;
    reels.forEach((rl, reel) => [0, 1, 2].forEach((row) => {
      const v = rl.view(row), dd = Math.hypot(REEL_CX[reel] - P.x, rowY(row) - P.y);
      if (dd > Rr) return;
      gsap.fromTo(v.c.pivot, { y: A * (1 - dd / Rr) }, { y: 0, duration: 0.25, ease: "power2.out", delay: dd / 2600 });
    }));
    colReel.views.forEach((v, i) => {
      if (Math.hypot(COL_CX - P.x, COL_Y0 + (i - 1) * COL_P - P.y) > Rr) return;
      [v.b.pivot, v.f.pivot, v.fb.pivot, v.fc.pivot].forEach((pv) => gsap.fromTo(pv, { y: A * 0.5 }, { y: 0, duration: 0.22, ease: "power2.out", delay: 0.04 + i * 0.02 }));
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
      const from = handOrb();                       // white: every bolt from the hand's fireball
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
  // b22: the smile (bull_win): an arrogant, self-satisfied grin on wins of 5x the base bet and more. Returns the move, or
  // null when the clip is not there yet (then nothing plays: no code fallback for a smile).
  function bullWin() {
    const mv = bullLive() ? bullPlay("bull_win") : null;
    if (mv && mv.fresh) gsap.fromTo(bullAura, { alpha: 0.3 }, { alpha: 0, duration: 1.6, ease: "power2.in" });
    return mv;
  }
  // b22: the fake hit (bull_fake; user 2026-11-20: "it moves the hand up, ball gets bigger but goes back to normal, so it
  // is faking"; "we get a random number from 1 to 20, and if we get one particular number, we play the fake"). One roll per
  // spin at the spin's start: n = 1..FAKE_RANGE, n === FAKE_PICK plays it (1 in 20). Purely visual: it never holds the
  // round and has no effect on the result. Skipped in turbo and in a round where the bull has a real move (SUPER WILD,
  // Fortune Choice, a bought round, a win of 5x and more). The hand ball swells with the clip's hand track (fire power 2).
  // ?nofake = off, ?fake = every spin (QA), G.fake() = on demand.
  const FAKE_RANGE = 20, FAKE_PICK = 10;
  function bullFake() {
    const mv = bullLive() ? bullPlay("bull_fake") : null;
    if (mv && mv.fresh) {
      mv.at("up").then(() => { if (!mv.ended && !mv.hurry) SFX.orbCharge(Math.max(0.3, bullSpan("bull_fake", (mv.c.cfg.events || {}).up || 0, (mv.c.cfg.events || {}).hold || 0.75))); });
    }
    return mv;
  }
  function fakeRoll(r, buyKind) {
    if (params.has("nofake") || !clips.bull_fake) return false;
    if (S.turbo || buyKind || featureOn || bullDir.cur || bullDir.queue.length) return false;
    if (r && (r.bought || r.fc || r.totalX >= 5 || (r.superCells && r.superCells.length))) return false;
    if (params.has("fake")) return true;
    return 1 + Math.floor(Math.random() * FAKE_RANGE) === FAKE_PICK;
  }
  // b22 (user 2026-11-20: "after the ball hits the board: an impact wave of light going everywhere"): from the hit point a
  // soft light ring opens over the whole board and a thin bright band runs down through the cells; calm colours, no dot
  // bursts, short enough not to burn the board. ?nowave = off.
  const SLAM_WAVE = !params.has("nowave");
  function slamWave(P, y0) {
    if (!SLAM_WAVE) return;
    topP.emit({ tex: FX.tex.ring, x: P.x, y: y0, s0: 0.3, s1: 9, life: 0.7, tint: 0xffe6a8, a0: 0.8, a1: 0 });
    topP.emit({ tex: FX.tex.ring, x: P.x, y: y0, s0: 0.2, s1: 6, life: 0.95, tint: 0xfff6dc, a0: 0.45, a1: 0 });
    const band = new PIXI.Sprite(FX.tex.glow); band.anchor.set(0.5); band.blendMode = PIXI.BLEND_MODES.ADD; band.tint = 0xfff0c8;
    band.width = 1180; band.height = 90; band.position.set(540, y0); band.alpha = 0.5; fxTop.addChild(band);
    gsap.to(band, { y: 1290, duration: 0.5, ease: "power1.out" });
    gsap.to(band, { alpha: 0, duration: 0.5, ease: "power2.in", onComplete: () => band.destroy() });
  }
  const SLAM_FAN = false;
  // b19 (user 2026-11-19: "During super win, we have 2 explosion that should not be there after he hits the board"): the
  // painted impact flipbook (boom: white star flash -> orange fireball / fire ring) and the glow puffs on the bar are off;
  // the hit keeps its weight (sound, hit-stop, shake, board recoil / drop, zoom punch, cell hop, a little smoke, embers).
  // ?slamboom (or SLAM_BOOM = true) brings them back.
  const SLAM_BOOM = params.has("slamboom");
  function slamFx(P) {
    const y0 = 596;                                           // the frame's top bar
    // white 2026-11-16 (user: remove the "simple shapes firework" after the fist hits the board): no streak star /
    // streaking dots / rings (heavyHit noShapes), no orange ring and no spark fan along the bar; the weight stays
    // (hit-stop, shake, shockwave, zoom punch, impact flipbook, smoke, embers, cracks, cell hop, sound)
    SFX.slam(); SFX.impact(true); heavyHit({ x: P.x, y: y0 }, 1, 0xffaa32, true);
    VFX.shockwave(P.x, y0, { amp: 30, radius: 900, dur: 0.25 }); VFX.zoomPunch(P.x, y0 + 300, 0.16, 0.12);
    slamWave(P, y0);                                          // b22: the light wave over the board
    if (SLAM_BOOM) { flashAt(P.x, y0, 0xfff2cd, 1.4, 0.06); flashAt(P.x, y0 - 20, 0xffaa32, 2.6, 0.22); boom(P.x, y0, 2.2); }   // b19: the two "explosions"
    smokeAt(P.x, y0 - 6, SLAM_BOOM ? 5 : 3, SLAM_BOOM ? 0.8 : 0.65);   // b19: a smaller dust puff (it read as part of the blast)
    if (SLAM_FAN) for (let k = 0; k < 28; k++) {             // a shallow, directional fan along the bar (off: SLAM_FAN)
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
    await FX.wait(S.turbo ? 0.2 : 0.3);                // b22 (user 2026-11-20: "remove all the scale and stupid animation from the character"): no code lunge (scale / dip) of the bull
    const P = { x: 470, y: 600 };
    shake(16, 0.45); SFX.slam();
    VFX.shockwave(P.x, P.y, { amp: 36, radius: 1500, dur: 0.9 }); VFX.zoomPunch(P.x, P.y + 300, 0.16, 0.35);
    if (SLAM_BOOM) { VFX.rgbFlash(10, 0.3); flashAt(P.x, P.y, 0xffffff, 3, 0.3); }   // b19: no flash on the hit (no-clip lunge too); white 2026-11-16: no ring / spark shower (see slamFx)
    if (SLAM_FAN) for (let k = 0; k < 44; k++) topP.emit({ tex: Math.random() < 0.5 ? FX.tex.spark : FX.tex.dot, x: P.x + (Math.random() - 0.5) * 760, y: 596,
      vx: (Math.random() - 0.5) * 700, vy: -200 - Math.random() * 760, ay: 1500, s0: 0.25 + Math.random() * 0.3, s1: 0, life: 0.8, tint: 0xffd060 });
    const crack = new PIXI.Graphics(); crack.blendMode = PIXI.BLEND_MODES.ADD; fxTop.addChild(crack);
    for (const dir of [-1, 1]) {
      let x = P.x, y = 598;
      crack.lineStyle(4, 0xfff2c0, 1).moveTo(x, y);
      for (let s2 = 0; s2 < 10; s2++) { x += dir * (30 + Math.random() * 30); y = 592 + Math.random() * 16; crack.lineTo(x, y); }
    }
    gsap.to(crack, { alpha: 0, duration: 0.4, onComplete: () => crack.destroy() });
    if (dropWorthy()) { boardDrop(1.1); hopCells(P); }               // white: a letters-only win keeps the board still
    void by;
    await FX.wait(0.35);
  }
  // the bull charges the fire in his hand (it takes the orb's colour), winds up and hurls it as a comet (Kling throw clip)
  const RIM_VIOLET = [0.6, 0.28, 1.0];
  const rgbOf = (t) => [((t >> 16) & 255) / 255, ((t >> 8) & 255) / 255, (t & 255) / 255];
  async function bullOrb(to, tint, label, k, picked, calm) {
    const mv = bullLive() ? bullPlay("bull_throw", k) : null;
    if (!mv && picked && window.GX_HALO_HANDOFF) return coinFlies(to, tint, label, calm);   // white 2026-11-17: never leave the wheel's coin behind
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
    // b20 WHEEL (user 2026-11-19: "the hand ball should be thrown"): a wheel's throw (picked; the 100x halo too) charges the
    // hand ball quietly like a calm throw - no ring, no pulled sparks, a soft glow - so the rolled value stays readable on it
    const quiet = calm || picked;
    if (quiet) { ring.visible = false; g.alpha = 0.45; g.visible = !(label < 0); }   // b18b: a calm (Fortune Choice) throw: no ring, no pulled sparks, a soft glow (none on a CHARGE coin)
    gsap.to(g.scale, { x: quiet ? 0.6 : 1.0, y: quiet ? 0.6 : 1.0, duration: cd, ease: "power1.in" });
    gsap.to(ring.scale, { x: 0.6, y: 0.6, duration: cd });
    const follow = () => {
      if (flame.gx == null) return;
      cg.position.set(flame.gx, flame.gy - 70); ring.rotation += 0.18; cg.visible = flame.on > 0.05;
      for (let e = quiet ? 0 : nEmit(25); e > 0; e--) {
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
    if (!quiet) { flashAt(from.x, from.y, 0xffffff, 1.8, 0.2); starFlash(from.x, from.y, 1.3, tint); }   // b18b: a calm throw leaves the hand quietly (b20: a wheel's throw too - the hand ball is seen leaving)
    GX.emit("throwRelease", { from, to, tint, label });
    await comet(from, ctrl, to, tint, label, S.turbo ? 0.2 : 0.3, calm, picked && BALL_THROW, true);   // b22: a quicker flight (was 0.3 / 0.22), the ball shatters on landing
    orbImpact(to, tint, calm);
    throwImpact(to, tint);                             // b22: the landing's wave + board drop, on the comet's last frame
  }
  // b22 (user 2026-11-20: "speed up the throwing animation and add a huge impact effect wave and board drop at the right
  // moment"): where the thrown ball lands in the column - two big light rings and a white core ring open from the chip, a
  // tall band of light sweeps left across the whole board, a screen ripple, the cells hop away from the column, the board
  // drops hard and springs back, a short hit-stop, shake and the heavy impact sound. Turbo: lighter. ?nothrowwave = off.
  const THROW_WAVE = !params.has("nothrowwave");
  function throwImpact(to, tint) {
    if (!THROW_WAVE) return;
    const q = S.turbo ? 0.6 : 1, tn = tint || 0xffd060;
    shatterBall(to, tn, q);
    // four rings, a beat apart, the first two the full board wide (white core, tier colour, gold, soft white)
    [[0, 0xffffff, 16, 0.7, 1], [0.05, tn, 14, 0.85, 1], [0.12, 0xffd870, 11, 0.95, 0.9], [0.2, 0xfff3d0, 8, 1.0, 0.7]].forEach(([dl, c, s1, life, a0]) =>
      gsap.delayedCall(dl, () => topP.emit({ tex: FX.tex.ring, x: to.x, y: to.y, s0: 0.3, s1: s1 * q, life, tint: c, a0, a1: 0 })));   // b22 smooth: one ring each (was two stacked)
    topP.emit({ tex: FX.tex.glow, x: to.x, y: to.y, s0: 1.2, s1: 2.6, life: 0.3, tint: 0xfff2c0, a0: 0.9, a1: 0 });   // the hit's own flash, on the chip
    // the light band sweeping left over the whole board (two layers: a bright core and a wide soft glow)
    [[180, 1, 0xfff6dc], [420, 0.55, tn]].forEach(([w0, a, c]) => {
      const band = new PIXI.Sprite(FX.tex.glow); band.anchor.set(0.5); band.blendMode = PIXI.BLEND_MODES.ADD; band.tint = c;
      band.width = w0; band.height = 820; band.position.set(to.x, 940); band.alpha = a; fxTop.addChild(band);
      gsap.to(band, { x: -80, width: w0 * 1.6, duration: 0.6 * q, ease: "power1.out" });
      gsap.to(band, { alpha: 0, duration: 0.6 * q, ease: "power2.in", onComplete: () => band.destroy() });
    });
    // b22 smooth: no screen ripple / zoom blur here - both re-render the whole screen through a filter every frame of the
    // wave (the costliest part of it on a phone); the rings, band and shards carry the wave
    hopCells(to, 26 * q, 760);
    boardDropHit(1000);                                // the strongest drop (60 px) and the long spring back
    SFX.impact(true); SFX.slam(); shake(12 * q, 0.35); buzz(40); hitStop(70);   // (hitStop is off unless ?hitstop)
  }
  // b22 (user 2026-11-20: "shatter the ball at this moment into an impact wave"): the fire ball bursts where it lands - a
  // quick fireball pop, fire shards streaking out in every direction and molten drops that fall away with gravity; the
  // impact rings and the light band (throwImpact) open from the same point
  function shatterBall(to, tn, q) {
    topP.emit({ tex: FX.tex.glow, x: to.x, y: to.y, s0: 1.0, s1: 3.4 * q, life: 0.24, tint: 0xffc060, a0: 1, a1: 0 });
    topP.emit({ tex: FX.tex.glow, x: to.x, y: to.y, s0: 0.6, s1: 1.8, life: 0.16, tint: 0xffffff, a0: 1, a1: 0 });
    const nS = Math.round((MOBILE ? 18 : 30) * q), nD = Math.round((MOBILE ? 8 : 14) * q);
    for (let k = 0; k < nS; k++) {                     // fire shards
      const a = (k / nS) * Math.PI * 2 + Math.random() * 0.4, v = 700 + Math.random() * 1000, r0 = Math.random();
      topP.emit({ tex: FX.tex.flame, x: to.x + Math.cos(a) * 12, y: to.y + Math.sin(a) * 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 3.2,
        s0: 0.5 + Math.random() * 0.45, s1: 0, life: 0.45 + Math.random() * 0.35, stretch: 900, a0: 1, a1: 0.2,
        tint: r0 < 0.45 ? tn : r0 < 0.8 ? 0xffd070 : 0xffffff, blend: PIXI.BLEND_MODES.ADD });
    }
    for (let k = 0; k < nD; k++) {                     // molten drops
      const a = -Math.PI * (0.1 + 0.8 * Math.random()), v = 300 + Math.random() * 600;
      topP.emit({ tex: FX.tex.dot, x: to.x, y: to.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, ay: 1700, s0: 0.35 + Math.random() * 0.3, s1: 0.1,
        life: 0.7 + Math.random() * 0.3, a0: 1, a1: 0.6, tint: Math.random() < 0.5 ? 0xffa030 : 0xffe080, blend: PIXI.BLEND_MODES.ADD });
    }
  }
  // b20 lead (user 2026-11-19: "the hand ball should be thrown"): a wheel's fire ball flies as the hand ball itself - the
  // comet's fire + glow with the value's numerals, no painted chip face / rim (?oldcoins = the chip wheels keep their faces)
  const BALL_THROW = !params.has("oldcoins");
  // white 2026-11-17: the coin a wheel handed over (window.GX_HALO_HANDOFF) flies to `to` itself (no throw clip)
  async function coinFlies(to, tint, label, calm) {
    const H = window.GX_HALO_HANDOFF; window.GX_HALO_HANDOFF = null;
    const from = H && H.c && !H.c.destroyed ? { x: H.c.x, y: H.c.y } : handOrb();
    if (H && H.c && !H.c.destroyed) H.c.destroy({ children: true });
    await comet(from, { x: from.x + 160, y: (from.y + to.y) / 2 }, to, tint, label, S.turbo ? 0.2 : 0.3, calm, BALL_THROW, true);   // b20: the hand ball, no chip face (b22: quicker, shatters)
    orbImpact(to, tint, calm);
    throwImpact(to, tint);                             // b22: the same landing as a clip throw
  }
  // a fireball with a trailing magic flame, flown along a curve
  // calm (b18b, the Fortune Choice coins: QA "a big glow ball around the coin covers the counter boards"): a modest glow
  // behind the coin (0.75, half alpha), no white core / ring / white speed streak, a thin trail; the coin fades out over
  // 0.12 s at the landing so the chip swap under it cross-fades (pickThrow / pickCharge swap on the landing frame)
  function comet(from, ctrl, to, tint, label, dur, calm, bare, pop) {   // b20: bare = a wheel's fire ball (numerals only, no chip face / rim); b22: pop = gone at once on landing (it shatters)
    const o = new PIXI.Container(); o.position.set(from.x, from.y); fxTop.addChild(o);
    const tail = VFX.magicFlame(o, 150, 300, rgbOf(tint)); tail.power = calm ? 0.7 : 1.5;
    const G0 = calm ? 0.75 : 2.1;
    const g = new PIXI.Sprite(FX.tex.glow); g.anchor.set(0.5); g.tint = tint; g.blendMode = PIXI.BLEND_MODES.ADD; g.scale.set(G0); if (calm) g.alpha = 0.5;
    const core = new PIXI.Sprite(FX.tex.glow); core.anchor.set(0.5); core.tint = 0xffffff; core.blendMode = PIXI.BLEND_MODES.ADD; core.scale.set(0.45);
    const ring = new PIXI.Sprite(FX.tex.ring); ring.anchor.set(0.5); ring.tint = tint; ring.blendMode = PIXI.BLEND_MODES.ADD; ring.scale.set(0.6);
    o.addChild(g, ring, core); if (calm) { ring.visible = false; core.visible = false; }
    if (label < 0) {                                         // 2026-11-18: a Fortune Choice CHARGE = the wheel's CHARGE coin (gx_halo chargeCoin / gx_picker), not the old NUDGE plate
      const f = new PIXI.Sprite(T("UI/charge_badge")); f.anchor.set(0.5); f.scale.set(0.86 * 0.52); o.addChild(f);
    } else if (label) {                                      // the same coin the bull held (face + numerals, picker size), so the hand-off reads as one object
      const k = COINS ? 0.86 : 0.6;
      if (COINS && !bare) {
        const f = new PIXI.Sprite(chipBgTex(label)); f.anchor.set(0.5); f.scale.set(label < 0 ? k * NUDGE_K : k); o.addChild(f);
        const rm = new PIXI.Sprite(T(label < 0 ? "Multipliers/chip_rim" : "Multipliers/coin_rim")); rm.anchor.set(0.5); rm.scale.copyFrom(f.scale); o.addChild(rm);
      }
      const l = labelSprite(label); l.anchor.set(0.5); l.scale.set(COINS ? (label < 0 ? k * NUDGE_K : k * LABEL_K) : k); o.addChild(l);
    }
    const p = { t: 0 }; let px = from.x, py = from.y;
    // b22 (user 2026-11-20: "at the final stage the ball should accelerate, go faster"): a thrown ball (pop) eases in hard -
    // it leaves the hand slowly and rockets into the column over the last third of the flight (power4.in; was power2.in)
    return FX.tween(p, { t: 1, duration: dur, ease: pop ? "power4.in" : "power2.in", onUpdate: () => {
      const q = FX.bezier(from, ctrl, to, p.t), vx = q.x - px, vy = q.y - py; px = q.x; py = q.y;
      o.position.set(q.x, q.y); ring.rotation += 0.3;
      if (vx || vy) tail.rotation = Math.atan2(-vx, vy);           // the flame streams behind the ball
      const n = nEmit(calm ? 20 : 70);
      for (let k = 0; k < n; k++) topP.emit({ tex: k ? FX.tex.dot : FX.tex.spark, x: q.x + (Math.random() - 0.5) * 30, y: q.y + (Math.random() - 0.5) * 30, s0: calm ? 0.3 : 0.5, s1: 0, life: calm ? 0.25 : 0.4, tint });
      if (vx || vy) { const sp = Math.hypot(vx, vy); g.scale.set(G0 + sp / (calm ? 160 : 40), G0); g.rotation = Math.atan2(vy, vx); if (!calm) topP.emit({ tex: FX.tex.dot, x: q.x, y: q.y, vx: -vx * 8, vy: -vy * 8, s0: 0.9, s1: 0, life: 0.18, stretch: 300, tint: 0xffffff }); }
    } }).then(() => {
      if (!calm || pop) { o.destroy({ children: true }); return; }
      tail.power = 0; g.visible = false;
      gsap.to(o, { alpha: 0, duration: 0.12, ease: "power1.in", onComplete: () => o.destroy({ children: true }) });
    });
  }
  function orbImpact(to, tint, calm) {         // calm (white 2026-11-17, the Fortune Choice throws): no burst / star / ring shapes
    // b18b (QA: white flash + fire ring round the centre box on a Fortune Choice landing): calm = the sound only; the caller
    // settles the chip (pickThrow pulseChip / pickCharge scale-settle). No flipbook, shockwave, flash, shake or recoil
    if (calm) { SFX.impact(false); return; }
    boom(to.x, to.y, 1.9, tint);
    VFX.shockwave(to.x, to.y, { amp: 26, radius: 800 });
    flashAt(to.x, to.y, 0xfff4dc, 1.8, 0.1); if (!calm) { burstAt(to.x, to.y, tint, 22); starFlash(to.x, to.y, 1.6, tint); }
    SFX.impact(true); heavyHit(to, 0.8, tint, !!calm);
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
    if (label) { const l = labelSprite(label); l.anchor.set(0.5); l.scale.set(0.45); o.addChild(l); }
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
  // white 2026-11-17 (user: "during a simple win (without super wild or nudge) do a nice coin animation on the total win
  // board, then hit the multiplier (bigger than 1) with an impact animation on the same board and show coin animation
  // again"): spinning gold coins burst up out of the win board in a fan and fall back past it (k = size of the burst)
  function winBoardCoins(k, noPop) {               // b19: noPop = multHit's own (stronger) plaque pop owns the scale
    k = k || 1;
    const n = Math.round((MOBILE ? 11 : 20) * k);
    for (let i = 0; i < n; i++) {
      const x = 540 + (Math.random() - 0.5) * 380, a = -Math.PI / 2 + (x - 540) / 380 * 0.9 + (Math.random() - 0.5) * 0.35;
      const sp = (620 + Math.random() * 520) * (0.85 + 0.15 * k);
      topP.emit({ frames: FX.tex.coinFrames, fps: 14 + Math.random() * 20, x, y: WB_Y2 + 6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ay: 2500, drag: 0.25,
        s0: 0.4 + Math.random() * 0.16, s1: 0.36, life: 0.9 + Math.random() * 0.35, a0: 1, a1: 0, vr: (Math.random() - 0.5) * 5, blend: PIXI.BLEND_MODES.NORMAL });
    }
    for (let i = 0; i < Math.round(8 * k); i++) topP.emit({ tex: FX.tex.spark, x: 540 + (Math.random() - 0.5) * 300, y: WB_Y2 + (Math.random() - 0.5) * 30,
      s0: 0.15, s1: 0.5, life: 0.35, a0: 1, a1: 0, vr: 3, tint: 0xfff0c8 });
    if (!noPop) gsap.fromTo(plaque.scale, { x: PLAQUE_S * 1.1, y: PLAQUE_S * 1.1 }, { x: PLAQUE_S, y: PLAQUE_S, duration: 0.3, ease: "back.out(2.5)" });
    SFX.coin();
  }
  // the multiplier lands on the win board: a heavy hit there (shockwave through the scene, hit-stop, a gold flare on the
  // panel behind the count); winBarHit adds the drop and the light sweep
  function winBoardImpact(v) {
    const k = Math.min(1, Math.log10(Math.max(2, v)) / 2);
    VFX.shockwave(540, WB_Y2, { amp: 18 + 14 * k, radius: 700 + 300 * k, dur: 0.5 });
    hitStop(50 + 40 * k); buzz(25);
    const g = new PIXI.Sprite(FX.tex.glow); g.anchor.set(0.5); g.position.set(540, WB_Y2); g.tint = 0xffc850; g.blendMode = PIXI.BLEND_MODES.ADD;
    plaqueL.addChildAt(g, plaqueL.getChildIndex(plaque));
    gsap.fromTo(g.scale, { x: 2.2, y: 0.55 }, { x: 4.2 + k, y: 0.9, duration: 0.45, ease: "power2.out" });
    gsap.fromTo(g, { alpha: 0.95 }, { alpha: 0, duration: 0.5, ease: "power2.in", onComplete: () => g.destroy() });
  }
  const BAL_COINS = false;   // white 2026-11-16 (user): no coin flight from TOTAL WIN to the balance
  function balanceStreak() {
    if (!BAL_COINS) return;
    const from = { x: 540, y: WB_Y2 }, to = { x: balVal.x + balVal.width / 2, y: 1864 };
    for (let k = 0; k < 6; k++) coinTrail(from, to, 0.05 + k * 0.06, k === 5 ? (pt) => { flashAt(pt.x, pt.y, 0xffd060, 2.2, 0.3); burstAt(pt.x, pt.y, 0xffd060, 14); starFlash(pt.x, pt.y, 1.4, 0xffe08a); } : (pt) => winBarPop(pt));
  }
  // vignette for the tease heartbeat
  const vignette = new PIXI.Sprite(FX.tex.vignette); vignette.width = W; vignette.height = H; vignette.alpha = 0; vignette.visible = false;
  ambFront.addChild(vignette);   // white 2026-11-16 ("keep the board color consistent"): under the board (was over it in fxTop: it darkened the board's edges and corners)
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
      // b22: the roar clip's own frame size (the square 960 clip on desktop, the phone's shared 720 x 1280 frame)
      const htw = hero.texture && hero.texture.width > 2 ? hero.texture.width : 720, hth = hero.texture && hero.texture.height > 2 ? hero.texture.height : 1280;
      gx = hero.x - hero.width / 2 + cx * hero.width / htw; gy = hero.y - hero.height / 2 + cy * hero.height / hth;
      fc.position.set(gx, gy); fc.scale.set((hero.scale.x / (hero.baseS || 1)) * 1.1);
      fc.power = 1.35;
      if (popHandFront) {
        if (popHandFront.texture !== hero.texture) popHandFront.texture = hero.texture;
        popHandFront.position.copyFrom(hero.position); popHandFront.scale.copyFrom(hero.scale);
        const kx = hero.width / htw, ky = hero.height / hth;
        popHandMask.position.set(gx + HAND_MASK.dx * kx, gy + HAND_MASK.dy * ky);
        popHandMask.scale.set((HAND_MASK.rx * 2 * kx) / 128 / 0.86, (HAND_MASK.ry * 2 * ky) / 128 / 0.86);
        popHandArea.copyFrom(popHandMask.getBounds()).pad(10); popHandFront.filterArea = popHandArea;
      }
    } else {
      // b22 (new square idle, 960 px, its own placement): the hand point is mapped with the frame of the clip it came
      // from (the playing move's track, the roar's track, else the idle) and that clip's own width (was: the idle's
      // placement and 720 for every clip)
      const mvS = bullDir.cur && bullDir.cur.started && !bullDir.cur.ended && bullDir.cur.c.cfg.track ? bullDir.cur.c : null;
      const srcC = mvS || (bigTrack() ? clips.bull_big : (clips.bull_idle || clips.bull_big));
      const cfg = srcC ? srcC.cfg : { x: 162, y: -116.9, w: 725 };
      const vw = srcC && srcC.sprite && srcC.sprite.texture && srcC.sprite.texture.width > 2 ? srcC.sprite.texture.width : 720, sc = cfg.w / vw;
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
      const fadeF = mvS && mvS.cfg.fade, atEdge = fadeF && (cx < vw * (fadeF + 0.08) || cx > vw * (0.92 - fadeF));   // b22: hand in a faded edge
      handFront.visible = !!src && fc.visible && (!bullClipC || bullClipC.visible) && !atEdge;   // not over the still bull
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
      g.endFill(); g.alpha = 0; gsap.to(g, { alpha: WIN_VEIL, duration: 0.1 }); cellFxBack.addChild(g); winObjs.push(g);   // white: WIN_VEIL 0 = parchment stays
    });
    const d = { k: 0 };
    gsap.to(d, { k: 1, duration: 0.1, onUpdate: () => {
      reels.forEach((rl, reel) => [0, 1, 2].forEach((row) => { if (!cells.has(reel * 3 + row)) rl.view(row).dim(d.k); }));
      colDimK = Math.max(0.001, d.k * 0.8); colReel.views.forEach((v) => v.dim(Math.abs(v.b.y - COL_CY) < COL_P / 2 ? 0 : colDimK));
    } });
    r.lines.forEach((l) => lineGfx.push(payline(l.rows)));
    cells.forEach((c) => { winCells[c] = cellHighlight(Math.floor(c / 3), c % 3); });
    lineIntro(r);                                     // white: the bolts run now, one line after the other
    for (const c of cells) {
      const reel = Math.floor(c / 3), row = c % 3, id = curGrid[reel][row];
      if (id === "wild" || id === "super_wild") {
        // white 2026-11-16 (user: "remove all the color animation in super wild and wild apart from the eyes glow"): the
        // WILD's Kling win clip has the burn baked in (the face turns orange-red, a gold flare behind) -> no clip and no ray
        // burst: the still art with gx_symbols' punch + weak eye glow. ?wildclip brings the clip back.
        if (!params.has("wildclip")) continue;
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
    // white 2026-11-18 b18 (user: "during the SUPER WILD win we don't need to throw coins into the total win tab, same for
    // the WILD and CHARGE"): no coin streams into the win bar and no win-board coin bursts in a round with a SUPER WILD /
    // Fortune Choice, a WILD in a win line, or any CHARGE (column CHARGE chip, board CHARGE run); plain line wins keep them
    const coinsOK = !r.fc && !r.nudges.length && !(r.boardRuns && r.boardRuns.length) && !(r.startMult < 0) && !r.chipSteps
      && !r.lines.some((l) => l.rows.some((row, reel) => Engine.WILDS.has(r.grid[reel][row])));
    // b20 (user 2026-11-19, the coin rule: "1. if we have a 1x multiplier and a win, play the coin spread; 2. if we have a win
    // and a multiplier bigger than 1x, play the coin spread at the end, during the hit of the total win board"): the spread
    // (winBoardCoins) follows the multiplier alone, in every round type - a 1x win spreads as its win shows, a >1x win spreads
    // once, in the frame its multiplier hits the total win board (multHit / laserApply). The coin flights into the bar
    // (coinTrail) keep b18's rule (none with WILD / SUPER WILD / CHARGE) and fly on 1x wins only (a >1x win waits for the hit).
    // SPREAD_RULE false = b19 (spreads only on plain wins without WILD / CHARGE, flights on every plain win)
    const SPREAD_RULE = true, featRound = !!(r.nudges.length || r.fc || (r.boardRuns && r.boardRuns.length));
    if (rung && coinsOK && !(SPREAD_RULE && r.mult > 1)) [...cells].forEach((c, ci) => {
      const from = { x: REEL_CX[Math.floor(c / 3)], y: rowY(c % 3) };
      for (let k = 0; k < (rung === 2 ? 6 : 3); k++) coinTrail(from, { x: 540, y: WB_Y2 }, 0.12 + ci * 0.05 + k * 0.08, winBarPop);
      // white 2026-11-16 (user: "the animations are too many on the symbols"): no extra beat on top of each symbol's own move
    });
    // rail plaque pops 0.6 -> 1.05 -> 1 and counts the base win (it replaces the footer total while it shows)
    plaqueBg.alpha = 1; plaqueGlow.alpha = 0.5; plaqueTxt.visible = true; plaqueBig.visible = false;
    plaque.visible = true; wbTotal.visible = false;
    // a win below the stake (no feature) is a net loss: it goes straight to its total, with no multiplier flight
    // white 2026-11-16: a quiet win WITH a multiplier first shows its base win (the multiplier then hits the board)
    const quiet = rung === 0 && !r.nudges.length && !r.fc && !(r.boardRuns && r.boardRuns.length), firstCount = quiet && !(r.mult > 1) ? r.win : r.baseWin;
    plaqueShown.v = MOBILE ? firstCount : firstCount * 0.15; drawPlaque();   // white: phones show the final number at once (each redraw of this big text costs 10-30 ms there)
    plaque.alpha = 0; plaque.scale.set(0.6 * PLAQUE_S);
    gsap.to(plaque, { alpha: 1, duration: 0.1 });
    gsap.timeline().to(plaque.scale, { x: 1.05 * PLAQUE_S, y: 1.05 * PLAQUE_S, duration: 0.1, ease: "back.out(2)" })
      .to(plaque.scale, { x: PLAQUE_S, y: PLAQUE_S, duration: 0.1 });
    await FX.tween(plaqueShown, { v: firstCount, duration: S.turbo ? 0.2 : quiet ? 0.28 : 0.35, ease: "power1.out", onUpdate: () => { drawPlaqueRoll(); SFX.tick(); } });
    SFX.line();
    const simpleWin = !r.nudges.length && !r.fc && !(r.boardRuns && r.boardRuns.length), coinK = rung === 0 ? 0.5 : rung === 1 ? 1 : 1.3;
    // b19 (user 2026-11-19: "when you hit the total win board, we need coins at that second, not after"): with a multiplier > 1
    // the one burst fires in multHit's landing frame (MH_COIN_K x richer, it replaces the before + after bursts); 1x keeps this one
    const hitCoins = (SPREAD_RULE ? !featRound : simpleWin && coinsOK) && r.mult > 1 ? coinK * MH_COIN_K : 0;
    if (SPREAD_RULE ? !featRound && !(r.mult > 1) : simpleWin && coinsOK && !(r.mult > 1)) winBoardCoins(coinK);    // white 2026-11-17: coins on the win board; b20: every 1x win (rule 1)
    await FX.wait(rung === 0 ? 0.08 : S.turbo ? 0.1 : simpleWin ? 0.45 : 0.25);
    // multiplier phase
    if (r.nudges.length || r.fc || (r.boardRuns && r.boardRuns.length)) {
      const acc = await nudgePhase(r);
      await laserApply(Math.max(1, acc), SPREAD_RULE ? coinK * MH_COIN_K : 0);   // b20 (coin rule): the spread at the final hit into the win board
    } else if (r.mult > 1 && quiet) {
      // white 2026-11-16 (user: "during the multiplier bigger than 1, we need to hit the total win board"): small wins too:
      // the one-row screen shows xN, the number hits the board, the plaque counts on to the total
      // white 2026-11-18 b18 (user: "it should simply do a direct hit from the multiplier box, not the popup box"): no board
      // rises; the number flies straight from the centre chip to the win bar (was multShow + multHit fromScreen)
      colHotOff(0);                                      // b19 (C): the gold-dust frame fades as the number leaves the column
      await multHit(r.mult, true, false, hitCoins);     // b19: the coins in the landing frame
      await FX.tween(plaqueShown, { v: r.win, duration: S.turbo ? 0.15 : 0.3, ease: "power1.out", onUpdate: () => { drawPlaqueRoll(); SFX.tick(); } }); plaqueShown.v = r.win; drawPlaque();
      // b19: no second burst after the count (was: if (coinsOK) winBoardCoins(coinK))
    } else if (r.mult > 1) {
      if (clashWanted(r)) await clash(r);
      // the bull throws fire at the column for every multiplier of 5x and more, except on a win below the stake
      // (a net loss stays quiet). Small totals get a quick throw, popup wins the full one.
      else if (r.mult >= 5 && rung > 0) {
        // 100x and up: the halo wheel above the bull's head picks the value first (src/gx_halo.js), then he throws it
        // b22 (user 2026-11-20: "a win of 5x or more -> the bull simply smiles, no throw"): the throw is only for a wheel's
        // pick (this 100x halo wheel, the SUPER WILD wheel); a plain 5x+ multiplier goes straight from the column to the
        // win board (multHit below) and the bull smiles (bullWin). ?oldthrow = the throw on every 5x+ multiplier.
        const halo = r.mult >= HALO_MIN && !params.has("nohalo");
        if (halo) await GX.run("halo", { mult: r.mult, tint: multTint(r.mult) }, 7000);
        if (halo || params.has("oldthrow")) { await bullOrb({ x: COL_CX, y: COL_CY }, multTint(r.mult) === 0xffd070 ? 0xffb040 : multTint(r.mult), r.mult, 1, halo);   /* b22: uniform throw speed (was 1.15 / 1.7 by win size) */  r.bullActed = true; } }
      colHotOff(0);                                      // b19 (C): the gold-dust frame fades as the number leaves the column
      await multHit(r.mult, true, false, hitCoins);    // white 2026-11-18 b18: a direct hit from the centre chip (no one-row screen); b19: coins at landing
    } else {
      pulseChip(false);
    }
    // the plaque turns into big gold digits counting to the total (popup wins count once, in the popup)
    let bigTw = null;
    const tier = Engine.tier(r.totalX), popWin = TIER_ORDER.includes(tier);
    let slamP = null;
    // b22: wins of 5x the base bet and more = the arrogant smile (was the board punch; the punch now belongs to the SUPER
    // WILD activation and the Buy Bonus start only). The smile never holds the round. ?oldslam = the punch as before.
    // A popup win waits for the grin to be on his face (as it waited for the punch's hit): the popup's roar takes over after.
    if (r.totalX >= 5 && !r.bullActed) {
      if (params.has("oldslam")) slamP = bullSlam();
      else { const sm = bullWin(); if (sm && popWin && !S.turbo) slamP = Promise.race([sm.at("smile"), FX.wait(1.5)]); }
      r.bullActed = true;
    }
    if (r.mult > 1 && popWin) {
      const mt = new PIXI.Text("x" + r.mult, FX.gold(46, { fill: FX.TIER_FILL.mega })); mt.anchor.set(0.5); mt.position.set(plaque.x + 250, plaque.y);
      plaqueL.addChild(mt); winObjs.push(mt); multTag = mt; mt.renderable = false;   // white 2026-11-16: no "xN" tag (user)
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
      } }).then(() => { SFX.line(); const k = bigFit();   // the pop settles on the fitted size (was 1: big amounts overflowed the panel)
        gsap.fromTo(plaqueBig.scale, { x: k * 1.12, y: k * 1.12 }, { x: k, y: k, duration: 0.25, ease: "back.out(2)" });
        /* b19: no coins after the count (they fire at the hit, multHit) */ });
      const mt = new PIXI.Text("x" + r.mult, FX.gold(40, { fill: FX.TIER_FILL.mega })); mt.anchor.set(0.5); mt.position.set(plaque.x + 300, plaque.y);
      plaqueL.addChild(mt); winObjs.push(mt); multTag = mt; mt.renderable = false;   // white 2026-11-16: no "xN" tag (user)
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
    cellClipSprites.forEach((sp) => { if (sp.clipId === id) sp.texture = w.sprite.texture; });   // white: back from the idle loop
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
    // white (video audit): the clip replaces the wild art only when it can really show (a decoded frame, not refused by
    // Low Power Mode, its part downloaded); otherwise the static wild with its code effects stays
    if ((w.shared && w.shared.blocked) || w.video.readyState < 2 || !clipBuffered(w.video)) return;
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
  // b22 (user 2026-11-20: "make the background a bit transparent so the game will be visible"): 0.45 (was 0.75)
  const popDark = new PIXI.Graphics().beginFill(0x07020a, 0.45).drawRect(-200, -200, W + 400, H + 400).endFill();
  const popBurst = new PIXI.Sprite(FX.tex.burst); popBurst.anchor.set(0.5); popBurst.position.set(540, 820); popBurst.blendMode = PIXI.BLEND_MODES.ADD;
  const popBurst2 = new PIXI.Sprite(FX.tex.burst); popBurst2.anchor.set(0.5); popBurst2.position.set(540, 820); popBurst2.blendMode = PIXI.BLEND_MODES.ADD;
  const popGlow = new PIXI.Sprite(FX.tex.glow); popGlow.anchor.set(0.5); popGlow.position.set(540, 760); popGlow.scale.set(5); popGlow.blendMode = PIXI.BLEND_MODES.ADD;
  let popHero = null;
  if (clips.bull_big) {
    popHero = new PIXI.Sprite(clips.bull_big.sprite.texture);
    popHero.filters = clips.bull_big.sprite.filters; popHero.anchor.set(0.5, 0.5);
    popHero.width = clips.bull_big.cfg.w * 1.05; popHero.height = clips.bull_big.cfg.h * 1.05;
    // b22: the bull stands where the V4 hero stood (frame 162, -116.9, 725 x 1288.9 centred on 540, 600) whatever the
    // roar clip's own frame is (the square clip: 25.16, -52.58, 963.6)
    { const bc = clips.bull_big.cfg; popHero.position.set(540 + ((bc.x + bc.w / 2) - 524.5) * 1.05, 600 + ((bc.y + bc.h / 2) - 527.55) * 1.05); }
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

  // ---------- b24 layered win popup ----------
  // user 2026-11-20 ("divide each popup into separate layers so we can animate them with code, remove the coins" ->
  // "build it in"): the approved popup art (art_src/win_popup_final) split into RING, BULL, BANNER (empty) and TITLE per
  // tier (art_src/win_popup_layers, tools/popup_layers.py) -> assets/Popup/layers/<tier>.webp atlases + layers.json
  // {size, tiers: {tier: {part: [ax, ay, w, h, x, y]}}} (atlas rect, place in the 941x1672 art). The tier glow / rays, the
  // amount and TAP TO CONTINUE stay code. No coins. Loaded in the background after the game starts (not on the boot
  // path); until they are here, and with ?oldpop, the previous popup plays. Each tier's group is shifted so every banner
  // sits at MAX's banner height (the chest pushed MAX's down): the banner, amount and hint never jump on a tier-up.
  const OLD_POP = params.has("oldpop");
  const PL = { ready: false, tier: null, k: W / 941, bannerY: 1042.5, parts: {} };   // k: art px -> world px
  const popLay = new PIXI.Container(); popLay.eventMode = "none"; popLay.visible = false;
  popLay.scale.set(PL.k); popLay.y = -POP_DY;                     // art space (0..941 x 0..1672) = the whole screen
  const layG = new PIXI.Container(); popLay.addChild(layG);       // per-tier shift (art px)
  const LAY = {};
  ["ring", "bull", "banner", "title"].forEach((p) => { const s = new PIXI.Sprite(PIXI.Texture.EMPTY); s.anchor.set(0.5, p === "bull" ? 1 : 0.5); LAY[p] = s; layG.addChild(s); });
  const layTitleMask = new PIXI.Sprite(PIXI.Texture.EMPTY); layTitleMask.anchor.set(0.5); layG.addChild(layTitleMask);   // the title sweep's mask
  popBody.addChildAt(popLay, popBody.getChildIndex(popCoins.c));
  popFaders.push(popLay);
  const layOn = () => PL.ready && !OLD_POP;
  const LAY_AMT = 205, LAY_HINT = 318;                            // art px below the banner centre: amount, hint
  async function loadPopLayers() {
    try {
      const meta = await (await fetch("assets/Popup/layers/layers.json")).json();
      const bases = await PIXI.Assets.load(TIER_ORDER.map((t) => `assets/Popup/layers/${t}.webp`));
      for (const t of TIER_ORDER) {
        const base = bases[`assets/Popup/layers/${t}.webp`].baseTexture, fr = meta.tiers[t]; PL.parts[t] = {};
        for (const [p, [ax, ay, w, h, x, y]] of Object.entries(fr))
          PL.parts[t][p] = { tex: new PIXI.Texture(base, new PIXI.Rectangle(ax, ay, w, h)), x, y, w, h };
      }
      const mb = PL.parts.max && PL.parts.max.banner; if (mb) PL.bannerY = mb.y + mb.h / 2;
      PL.ready = true;
    } catch (e) { console.warn("popup layers (the previous popup plays)", e); }
  }
  // place the 4 layers of tier t (textures, positions, the group shift that puts its banner at PL.bannerY)
  function laySet(t) {
    const P = PL.parts[t]; if (!P) return;
    PL.tier = t;
    const b = P.banner; layG.y = b ? PL.bannerY - (b.y + b.h / 2) : 0;
    for (const p of ["ring", "bull", "banner", "title"]) {
      const s = LAY[p], f = P[p]; if (!f) { s.visible = false; continue; }
      s.visible = true; s.texture = f.tex; s.position.set(f.x + f.w / 2, p === "bull" ? f.y + f.h : f.y + f.h / 2);
      s.home = { x: s.x, y: s.y };
    }
    layTitleMask.texture = LAY.title.texture; layTitleMask.position.copyFrom(LAY.title.position);
    if (P.ring) {                                                  // the code glow / rays follow this tier's ring centre
      const cy = (P.ring.y + P.ring.h / 2 + layG.y) * PL.k - POP_DY, cx = (P.ring.x + P.ring.w / 2) * PL.k;
      [popGlow, popBurst, popBurst2].forEach((o) => o.position.set(cx, cy));
      PL.ringCX = cx; PL.ringCY = cy + POP_DY;
    }
  }
  // layered mode on: hide the previous popup's art, put the code parts (glow, rays, flare, amount, hint) on this tier
  function layOpen() {
    const on = layOn();
    popLay.visible = on;
    [popMed, popBan, popPlate, popTitle, popTitleArt, popTitleMask, popArtMask].forEach((o) => (o.visible = !on));
    if (popHero) [popHero, popHero.heroMask, popHandFront, popFlame].forEach((o) => { if (o) o.visible = !on; });
    popShine.mask = on ? layTitleMask : popTitleMask;
    if (popRays) popRays.alpha = on ? 0.2 : 1;                // quieter god rays: the bull stays the brightest thing (b22: 0.2, was 0.45 - the game shows through)
    if (!on) return 930;
    // a soft tier glow behind the ring, quieter than the old popup (the approved art: a dim glow, the bull the brightest)
    popGlow.scale.set(4.6); popBurst.scale.set(1.9); popBurst2.scale.set(1.5); popBurst.alpha = 0.28; popBurst2.alpha = 0.2;   // placed by laySet
    const by = PL.bannerY * PL.k - POP_DY;
    popShine.y = by; popFlare.y = by + LAY_AMT * PL.k; popAmtGlow.y = by + LAY_AMT * PL.k;
    popHint.y = by + LAY_HINT * PL.k;
    return by + LAY_AMT * PL.k;                                    // the amount's y in the body
  }
  // a tier arrives: first = the popup opens (everything builds in), else a tier-up (punch, swap, slam)
  let layIdle = [];
  function layTier(t, first) {
    if (!layOn()) return;
    layIdle.forEach((tw) => tw.kill()); layIdle = [];
    const R = LAY.ring, B = LAY.bull, N = LAY.banner, T = LAY.title;
    [R, B, N, T].forEach((s) => { gsap.killTweensOf(s); gsap.killTweensOf(s.scale); });
    laySet(t);
    if (first) {
      gsap.fromTo(R.scale, { x: 0.55, y: 0.55 }, { x: 1, y: 1, duration: 0.5, ease: "back.out(1.7)" });
      gsap.fromTo(R, { alpha: 0, rotation: -0.5 }, { alpha: 1, rotation: 0, duration: 0.5, ease: "power3.out" });
      gsap.fromTo(B, { y: B.home.y + 140, alpha: 0 }, { y: B.home.y, alpha: 1, duration: 0.55, ease: "power3.out", delay: 0.08 });
      gsap.fromTo(B.scale, { x: 0.9, y: 0.9 }, { x: 1, y: 1, duration: 0.6, ease: "back.out(1.6)", delay: 0.08 });
      gsap.fromTo(N.scale, { x: 0.15, y: 0.7 }, { x: 1, y: 1, duration: 0.42, ease: "back.out(1.8)", delay: 0.12 });
      gsap.fromTo(N, { alpha: 0 }, { alpha: 1, duration: 0.15, delay: 0.12 });
      gsap.fromTo(T.scale, { x: 1.35, y: 1.35 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.4)", delay: 0.3 });
      gsap.fromTo(T, { alpha: 0 }, { alpha: 1, duration: 0.12, delay: 0.3 });
    } else {
      R.alpha = B.alpha = N.alpha = T.alpha = 1;
      gsap.fromTo(R.scale, { x: 1.12, y: 1.12 }, { x: 1, y: 1, duration: 0.4, ease: "back.out(2)" });
      gsap.fromTo(B.scale, { x: 1.08, y: 1.08 }, { x: 1, y: 1, duration: 0.35, ease: "back.out(2.2)" });
      gsap.fromTo(B, { y: B.home.y + 40 }, { y: B.home.y, duration: 0.3, ease: "power3.out" });
      // the banner is nearly screen-wide: it punches mostly in height, the title a little (no overflow off the screen)
      gsap.fromTo(N.scale, { x: 1.03, y: 1.22 }, { x: 1, y: 1, duration: 0.32, ease: "back.out(2.4)" });
      gsap.fromTo(T.scale, { x: 1.18, y: 1.18 }, { x: 1, y: 1, duration: 0.28, ease: "back.out(2.8)" });
    }
    // idle life: the bull breathes (from his feet), the ring and title pulse softly
    const d0 = first ? 0.7 : 0.4;
    layIdle.push(gsap.to(B.scale, { y: 1.014, x: 1.006, duration: 1.4, yoyo: true, repeat: -1, ease: "sine.inOut", delay: d0 }));
    layIdle.push(gsap.to(R.scale, { x: 1.02, y: 1.02, duration: 1.8, yoyo: true, repeat: -1, ease: "sine.inOut", delay: d0 }));
    layIdle.push(gsap.to(T.scale, { x: 1.025, y: 1.025, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut", delay: d0 }));
  }
  function layTick() {                                            // per frame while the popup is up
    if (!popLay.visible) return;
    layTitleMask.scale.copyFrom(LAY.title.scale); layTitleMask.alpha = LAY.title.alpha;
    const t = performance.now() / 1000;
    popBurst.rotation = t * 0.12; popBurst2.rotation = -t * 0.08;
    popGlow.alpha = 0.55 + 0.12 * Math.sin(t * 2.2);
    if (popRays) popRays.update(t, PL.ringCX || 540, PL.ringCY || 600);
  }
  function layClose() { layIdle.forEach((tw) => tw.kill()); layIdle = []; }
  // b19 (user 2026-11-19: "During super win, we have 2 explosion that should not be there"): the BIG -> MEGA -> SUPER
  // tier-ups each fired a glow puff, ring, shockwave and dot burst here (+ gx_popup impact flash / rings / lines). Off;
  // ?popburst brings them back. The title still slams in, the fanfare, coins and shake stay.
  const POP_BURST = params.has("popburst");
  function setTierTitle(t, first) {
    GX.emit("popupTier", { tier: t, first });
    layTier(t, first);                                 // b24: the layered popup (no-op until its art is loaded)
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
    if (popLay.visible) { popTitleArt.visible = popArtMask.visible = false; popShine.mask = layTitleMask; }   // b24: the layered title only (an old title used as a mask draws once it is not one)
    if (titlePulse) titlePulse.kill();
    gsap.killTweensOf(popTitle.scale);
    const again = performance.now() - (setTierTitle.at || 0) < 350; setTierTitle.at = performance.now();   // a tap jumped tiers
    const up = first ? 1.12 : 1.38;                    // a tier-up slams in; the first title just arrives
    gsap.fromTo(popTitle.scale, { x: base * up, y: base * up }, { x: base, y: base, duration: first ? 0.16 : 0.26, ease: first ? "back.out(1.2)" : "back.out(2.6)" });
    if (!first) {
      if (POP_BURST) popCoins.emit({ tex: FX.tex.glow, x: 540, y: 760, s0: 7, s1: 11, life: 0.32, tint: look.glow, a0: 0.85, a1: 0, blend: PIXI.BLEND_MODES.ADD });
      if (!again) { hitStop(70); buzz(50); }
    }
    titlePulse = gsap.to(popTitle.scale, { x: base * 1.03, y: base * 1.03, duration: 0.7, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.26 });
    if (POP_BURST) ringAt(540, 760, look.burst, 6, 0.6, popCoins);   // b19: off

    plateLac.tint = PLATE_TINT[t] || 0x5a0d1c; medTint.tint = banTint.tint = WP_COL[t] || 0xe0303a;
    gsap.fromTo(popBan.scale, { x: first ? 0.6 : 1.14, y: first ? 0.6 : 1.14 }, { x: 1, y: 1, duration: first ? 0.32 : 0.3, ease: "back.out(2.2)" });
    gsap.fromTo(popMed.scale, { x: first ? 0.7 : 1.07, y: first ? 0.7 : 1.07 }, { x: 1, y: 1, duration: first ? 0.45 : 0.35, ease: "back.out(1.8)" });
    popGlow.tint = look.glow; popBurst.tint = popBurst2.tint = look.burst; flare1.tint = look.flare; flare2.tint = 0xffffff;
    popTitleMask.text = popTitle.text; popAmtGlow.tint = look.glow;
    if (popRays) popRays.setTint(look.burst);
    if (!first && POP_BURST) VFX.shockwave(540, 740 + POP_DY, { amp: 30, radius: 1200, dur: 0.3 });   // b19: off
    for (let k = 0; k < (POP_BURST ? 18 + 12 * Math.max(0, TIER_ORDER.indexOf(t)) : 0); k++) {     // b19: dot burst off
      const a = Math.random() * Math.PI * 2, v = 600 + Math.random() * 900;
      popCoins.emit({ tex: FX.tex.dot, x: 540, y: 790, vx: Math.cos(a) * v, vy: Math.sin(a) * v, drag: 2.6, s0: 0.35 + Math.random() * 0.3, s1: 0,
        life: 0.7 + Math.random() * 0.3, tint: Math.random() < 0.4 ? 0xffffff : look.burst, stretch: 380, blend: PIXI.BLEND_MODES.ADD });
    }
    SFX.fanfare(TIER_ORDER.indexOf(t)); shake(first ? 12 : 8, 0.3); if (!again) { bullReact(first ? "big" : "tease"); if (!first) flameKick(1.2); }
  }
  async function bigWin(amount, x) {
    popFaders.forEach((o) => (o.alpha = 1));
    const amtY = layOpen();                            // b24: layered popup on / off; the amount's y
    popDark.alpha = 0; popHint.alpha = 0; popAmt.alpha = 1; popAmt.position.set(540, amtY); popCoins.clear();
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
      for (let i = 0; i < (popLay.visible ? 0 : n); i++) {   // b24: no coins in the layered popup
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
        if (popLay.visible) layTick();
        else if (popRays) popRays.update(performance.now() / 1000, 540, 380 + POP_DY);
        if (popFlame && popHero && !popLay.visible) placeFlame(popFlame, popHero, true);
      }
      popFlare.alpha = 0.75 + 0.25 * Math.sin(performance.now() / 110);
      flare1.scale.x = 4.4 + 0.4 * Math.sin(performance.now() / 170);
      if (!popLay.visible && Math.random() < 0.5) SFX.coin();
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
        ringAt(540, amtY + POP_DY, 0xffd060, 4, 0.5); SFX.impact(true); coinRate = 8;
        gsap.to(popHint, { alpha: 1, duration: 0.4 });
        const auto = gsap.delayedCall(S.auto ? 0.6 : 1.1, close);
        popTap = () => { auto.kill(); close(); };
      };
      const close = async () => {
        popTap = null;
        await GX.run("popupClose", { tier: steps[cur], amount });
        app.ticker.remove(coinTick); shineTw.kill(); VFX.bloom(false); SFX.musicBack(); layClose();
        if (titlePulse) { titlePulse.kill(); titlePulse = null; }
        gsap.to(popFaders, { alpha: 0, duration: 0.3 });
        // the amount shrinks and flies down to the win bar
        gsap.to(popAmt.scale, { x: popAmt.scale.x * 0.3, y: popAmt.scale.y * 0.3, duration: 0.4, ease: "power2.in" });
        gsap.to(popAmt, { y: WB_Y2 - POP_DY, alpha: 0.3, duration: 0.4, ease: "power2.in", onComplete: () => {
          ringAt(540, WB_Y2, 0xffd060, 2, 0.3); SFX.line();
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
    fill.visible = false;                               // white 2026-11-16: no orange wash on reel 3's parchment (the rim line stays)
    tease.addChild(fill, i);
    FireRect(tease, x0 + 6, CELL_Y0 + 6, x1 - 6, WIN_Y1 - 6, { pad: 50, top: 80, height: 62 });
    tease.box = [x0, CELL_Y0, x1, WIN_Y1];
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
    // white (user 2026-11-13): a double click on SPIN stops the reels at once (only a 60 ms debounce for a double-fired tap)
    if (S.state === "spinning") { if (now - spinAt < 60) return; quick = true; if (skipWait) skipWait(); if (colReel.tween) colReel.tween.timeScale(4); return; }
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
    exShowCancel("spin");                                // white 2026-11-18: the EX show ends in the same frame (column back to its plan)
    const buyCost = buyKind ? Engine.BUY[buyKind].cost * BETS[S.betIdx] : 0;
    if (S.balance < (buyKind ? buyCost : stake())) {
      showMsg("NOT ENOUGH BALANCE"); gsap.fromTo(ui.balance_bar, { alpha: 0.4 }, { alpha: 1, duration: 0.15, repeat: 5, yoyo: true });
      if (S.auto > 0) stopAuto();                          // autoplay ends when the money does
      return;
    }
    clearWin();
    S.state = "spinning"; quick = false; setUiLocked(true); S.forceKind = force || null;
    const bet = BETS[S.betIdx];
    // QA hook (2026-11-18): ?fcpick=charge | choice2 | mult (or G.fcPick = "charge") - a forced demo round (keys 3, m, ...)
    // or a Buy Bonus is re-drawn until its Fortune Choice has a pick of that kind (engine rounds as usual, only chosen)
    const fcWant = (window.G && window.G.fcPick) || params.get("fcpick"), fcHas = (t) => !fcWant || !!(t && t.fc && t.fc.picks.some((p) => p.t === fcWant));
    let r;
    if (buyKind) { r = Engine.buySpin(buyKind, bet, false); for (let k = 0; k < 20000 && !fcHas(r); k++) r = Engine.buySpin(buyKind, bet, false); }
    else if (force === "max") {
      // DEMO only: a max win is too rare to find by seed search (none in tens of millions), so the demo sets up a
      // real, possible outcome: two full lines of WILDs with the 1000x chip (capped at the max win), settled by the engine as usual
      // white: with the 50,000x cap a real max win needs Fortune Choice: a board of SUPER WILDs, the 1000x chip in the
      // centre, the first seed whose round hits the cap (found in under a few thousand seeds in every mode)
      const sg = [0, 1, 2].map(() => ["super_wild", "super_wild", "super_wild"]), ci = Engine.STRIP.indexOf(1000);
      for (let pass = 0; pass < 2 && !r; pass++)                  // (pass 1: ?fcpick found nothing - any capped round)
        for (let sd = 1; sd < 300000 && !r; sd++) { const t = Engine.settle(sg, ci, bet, stake(), Engine.mulberry32(sd)); if (t.capped && (pass || fcHas(t))) r = t; }
      if (!r) r = Engine.settle([["wild", "wild", "K"], ["wild", "wild", "J"], ["wild", "wild", "A"]], Engine.STRIP.indexOf(1000), bet, stake());
    }
    else if (force) {
      let s0 = 1 + Math.floor(Math.random() * 1e6), f = Engine.findRound(force, bet, exArg(), s0);
      for (let k = 0; k < 400 && f && !fcHas(f.round); k++) f = Engine.findRound(force, bet, exArg(), f.seed + 1);   // ?fcpick
      r = f ? f.round : Engine.spin(bet, exArg());
    }
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
    if (fakeRoll(r, buyKind)) bullFake();               // b22: the fake hit, 1 spin in 20 (never holds the round)
    arrowSpeed = 6.3;                                  // ~360 deg/s while the reels run (Garuda)
    gsap.fromTo(spinFlash, { alpha: 0.9 }, { alpha: 0, duration: 0.5 });
    // white 2026-11-16 (user: "we still have the dots exploding from spin button"): no ring / dot swirl from the button
    if (SPIN_BURST) ringAt(scx, scy, 0xffd060, 1.6, 0.4);
    if (SPIN_BURST) for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2;
      topP.emit({ tex: FX.tex.dot, x: scx + Math.cos(a) * 118, y: scy + Math.sin(a) * 118, vx: -Math.sin(a) * 460 + Math.cos(a) * 140, vy: Math.cos(a) * 460 + Math.sin(a) * 140,
        drag: 3.2, s0: 0.32, s1: 0, life: 0.45, tint: k % 3 ? 0xffd060 : 0xffffff, stretch: 420 });
    }
    const tb = S.turbo;
    // Garuda timing: no lift; stops at 0.50 / 0.70 / 0.90 s, the column at 1.10 s (turbo 0.15 / 0.20 / 0.25 / 0.30 s).
    // A stop request lands ~0.15 s later (the final symbols scroll in), so requests go out that much earlier.
    reels.forEach((rl) => rl.start(0, tb)); colReel.start(0, tb);   // Garuda: every reel starts at once, no lift
    // b19 (items 7-8): the hot column - 32 chips/s and the gold-dust frame (after exShowCancel above, which ends a demo frame)
    // b22 (user 2026-11-20: "the multiplier particle effects play only during CHARGE / SUPER WILD, in other cases we use the
    // default"; "old way, bring back the arrows, stop it closer to the 3rd reel stop"; dust "in the beginning, plus when 1000x
    // is coming, win or not"): the hot column (32 chips/s + the gold-dust frame, from the spin's start) only in a round with
    // a SUPER WILD (Fortune Choice), a CHARGE (column chip, nudges, board CHARGE runs) or a 1000x landing in the centre;
    // every other spin rolls the old way (9 chips/s, turbo 26, no dust). ?hotall = the b19-b21 rule (every spin)
    const hotRound = params.has("hotall") || !!(r.fc || (r.nudges && r.nudges.length) || (r.boardRuns && r.boardRuns.length) || r.startMult < 0 || r.startMult === 1000);
    if (COL_HOT && hotRound) { colReel.vmax = colReel.speed = Math.max(colReel.vmax, COL_HOT_V); colHotOn(); }
    colGrowTo(0, 0.18);                                // white 2026-11-17: the rolling column is one even strip
    // Porco: each reel may start its stop when the previous one has; stops come one loop apart (~0.4 s)
    const tStop = tb ? [0.1, 0.15, 0.2] : [0.75, 1.1, 1.45], LEAD = 0;   // white 2026-11-13: calmer, towards Pascal (0.6/1.0/1.4/1.7)   // Garuda (measured): hard stops 0.72 / 0.90 / 1.08 / 1.25 s     // timing pass 2026-11-10 (was 0.6/1.0/1.4/1.7)
    const wildsEarly = [0, 1].reduce((a, reel) => a + r.grid[reel].filter((s) => Engine.WILDS.has(s)).length, 0);
    // b20 (user 2026-11-19: "the tease case - it works based on the win, if the win is 5x and more you can tease it and give a
    // win"): the reel-3 tease only plays when the round pays 5x the bet or more (was every round with 2 WILDs on reels 1-2:
    // ~77% of those teased and paid less, mostly nothing). TEASE_MIN_X 0 = the old rule
    const TEASE_MIN_X = 5;
    const doTease = wildsEarly >= 2 && !tb && r.totalX >= TEASE_MIN_X;
    // white 2026-11-17 (user: "the multiplier part should stop after the 3rd reel equally timing", "smooth reel rotation and
    // stop"): the column is the fourth reel. It lands one reel-gap after the third reel, in every round (was: a long roll on
    // a win that eased down, hung on 500x / 1000x and crept in ~1.5 s after the reels). Its stop is a glide (Reel.glideStop):
    // the roll keeps its 9 chips/s, eases out over 0.55 s (turbo 0.25) a little past the target and settles. The slow strip
    // needs its 9-chip window to scroll in, so the stop is asked early enough for that (before the reels' own stops).
    colC = r.multIndex;
    // b19: a plain win with a multiplier > 1 keeps the gold-dust frame until the number flies (present() -> colHotOff before multHit)
    const hotHold = r.win > 0 && r.mult > 1 && !r.nudges.length && !r.fc && !(r.boardRuns && r.boardRuns.length);
    colReel.onLand = () => { colGrowTo(1, 0.25); onColumnLand(r); if (!hotHold) colHotOff(COL_HOT_HOLD); };
    // white (Garuda): a fresh window round the engine's centre and nudge values
    const colFix = { 0: stripAt(colC, 0) }; for (let k = 1; k <= 3; k++) if (k <= r.nudges.length) colFix[-k] = colIdxOf(r.nudges[k - 1]);   // white 2026-11-16: the first nudges sit BELOW the centre (a run walks down)
    const colFinal = colWindow(colFix);
    const g0 = gsap.globalTimeline.time(), tNow = () => gsap.globalTimeline.time() - g0;
    const GAP = tStop[2] - tStop[1], COL_TD = tb ? 0.25 : 0.55, COL_OV = tb ? 0.08 : 0.12;
    // b22 (user: "stop it closer to the 3rd reel stop"): the column lands COL_GAP after the third reel (was one reel gap, 0.35 s)
    const COL_GAP = tb ? GAP : 0.12;
    const colLand = (doTease ? tStop[1] + 1.1 : tStop[2]) + 3.5 / reels[2].vNormal + COL_GAP;   // a reel lands ~3.5 cells after its stop call
    const colNeed = (colFinal.length + 1 + COL_OV) / colReel.vmax + COL_TD / 2;
    let colP = null;
    const colGo = () => {
      if (colP) return;
      if (quick) { colReel.speed = Math.max(colReel.speed, colReel.vTurbo); colP = colReel.stop(colFinal, true); return; }   // a double-tap still slams it fast (b19: never slower than the hot roll)
      // T = the overshoot's peak; the strip crosses its target sqrt(2 over td / v) earlier, and that crossing is the landing
      colP = colReel.glideStop(colFinal, { T: Math.max(0.2, colLand + Math.sqrt(2 * COL_OV * COL_TD / colReel.vmax) - tNow()), td: COL_TD, over: COL_OV,
        extra: (n) => Array.from({ length: n }, (_, k) => stripAt(colC, k - n - 2)) });
    };
    const colTimer = gsap.delayedCall(Math.max(0, colLand - colNeed - 0.25), colGo);
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
    if (!colP) { colTimer.kill(); colGo(); }
    landed.push(colP);
    await Promise.all(landed);
    gsap.to(tease, { alpha: 0, duration: 0.25, onComplete: () => (tease.visible = false) });
    if (vignette.visible) gsap.to(vignette, { alpha: 0, duration: 0.3, onComplete: () => (vignette.visible = false) });
    colC = stripAt(r.multIndex, -r.nudges.length);   // white 2026-11-16: a CHARGE run steps the strip up
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
        // white 2026-11-16 (user: "remove all the color animation in super wild and wild apart from the eyes glow"): the
        // landing keeps the pop, the board drop and gx_symbols' dust; no coloured ring, flash, spark burst, impact flipbook,
        // shockwave or star flash (src/game.js.bak_pre_symbols has them)
        if (id === "super_wild") { SFX.superLand(); hitStop(50); buzz(30); } else { SFX.wildLand(); buzz(15); }
        if (id === "super_wild" && v.cnt && r.superCharges) { v.cnt.text = String(r.superCharges[i * 3 + row] || Engine.NUDGES); gsap.fromTo(v.cnt.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.3, ease: "back.out(2.5)" }); }
        GX.emit("wildLand", { reel: i, row, id, x, y, view: v }); boardDrop(id === "super_wild" ? 1.4 : 1);
      }
    }
  }
  // a CHARGE chip in the centre fires: its count rolls in, "+N CHARGES" flies to the counter. white 2026-11-16 (user: calm,
  // "only lighting strike from the ball, in yellow"): no cyan ring / burst / boom / bolt; struck = the yellow bolt already
  // hit it (chargeStrike), else (a nested CHARGE reached inside a run) it comes after the reveal; noReveal = count shown
  async function nudgeChipFire(n, struck, noReveal) {
    // b18 (user: no shakes at the start of the nudge chip demo): a CHARGE that the yellow bolt already struck (the round's
    // first CHARGE: column chip, board CHARGE, Fortune Choice CHARGE pick) fires without the board drop / shake - the bolt
    // is its accent; a nested CHARGE reached inside a run keeps its drop and shake
    if (!struck && !DROP_HIT) boardDrop(1.2);           // white: a CHARGE fires: strong drop (b19: off, only the hits into TOTAL drop the board; its shake stays)
    const v = colReel.views[4];
    if (v.reveal && !noReveal) await v.reveal(n);       // white: the badge's chevrons fly up and its count rolls in
    if (!struck) await chargeStrike({ x: COL_CX, y: COL_CY });
    gsap.fromTo(v.inner.scale, { x: 1.5, y: 1.5 }, { x: 1, y: 1, duration: 0.6, ease: "elastic.out(1,0.45)" });
    gsap.fromTo(v.flash, { alpha: 1 }, { alpha: 0, duration: 0.7 });
    gsap.fromTo(v.magic.uniforms, { uAmp: 5 }, { uAmp: 1, duration: 1.2 });
    SFX.nudgeActivate(); if (!struck) shake(8, 0.25);
    const t = new PIXI.Text(`+${n} CHARGES`, FX.gold(44, { fill: ["#FFFBE0", "#FFE14A", "#C98A10"] }));
    // white 2026-11-17 (user: "the +x charge number should stay in the middle, it slightly drifts to left"): centred on the
    // column (was 40 px left of it), as wide as the screen's edge allows, and it rises straight up into the CHARGES board
    const tk = Math.min(1, (2 * (W - COL_CX) - 24) / 1.1 / Math.max(1, t.width));   // its pop overshoots ~10%: still on screen
    // b18b (QA: it popped right on the CHARGE chip's own "CHARGE" lettering): it pops one chip pitch above the centre chip
    t.anchor.set(0.5); t.position.set(COL_CX, COL_CY - COL_P); fxTop.addChild(t);
    gsap.fromTo(t.scale, { x: 0.4 * tk, y: 0.4 * tk }, { x: tk, y: tk, duration: 0.35, ease: "back.out(1.6)" });
    await FX.wait(0.45);
    const cAt = fxTop.toLocal(cntBox.getGlobalPosition());
    await FX.tween(t, { x: COL_CX, y: cAt.y, alpha: 0.2, duration: 0.45, ease: "power2.in" });
    t.destroy();
    { const k = cbPk(cntNum, 1.6); gsap.fromTo(cntBox.scale, { x: k, y: k }, { x: 1, y: 1, duration: 0.4, ease: "back.out(3)" }); }   // b18b: clamped to the board
  }
  function onColumnLand(r) {
    SFX.columnStop();
    const v = r.startMult;
    // white 2026-11-16 (calm look): no rings / spark bursts when the column lands; a CHARGE landing is the sound only
    // (its yellow bolt and collection follow in nudgePhase)
    if (v < 0) SFX.wildLand();
    if (v >= 50) {
      shake(v >= 500 ? 16 : 8, 0.35); hitStop(v >= 500 ? 110 : 70); buzz(v >= 500 ? 80 : 40);
      flashAt(COL_CX, COL_CY, 0xfff0c8, 1.1, 0.3);     // white (lightning fix): was a 2.4 pure-white flash that burned the column out under the bolt's hit
      SFX.impact(v >= 500);
      lightning(COL_CX, COL_CY);
    }
  }
  // a SUPER WILD leaving the bottom of a spinning reel leaves a 0.25 s fire curtain (Garuda)
  function fireCurtain(reel) {
    const x0 = REEL_X[reel][0], x1 = REEL_X[reel][1];
    embers([x0, WIN_Y1 - 10, x1, WIN_Y1], 2, 0xff9a40);
  }
  // white: the orb in the bull's hand, in fxTop px (the magic flame rides the tracked hand). Lightning fix: the centre of
  // the orb mesh itself (it sits h*0.285 = 94 px up and leans with the hand); 60 px up was the palm under the orb, so the
  // bolts came out of the fingers
  function handOrb() {
    try { const o = flame.c.orb; return fxTop.toLocal(o ? o.orbM.toGlobal(new PIXI.Point(0, 0)) : flame.c.toGlobal(new PIXI.Point(0, -60))); }
    catch (e) { return { x: FIST.x, y: FIST.y }; }
  }
  // a bolt from the orb in the hand to a point: gx_feature draws it; if that plugin is not there (failed to load), a
  // plain held bolt here so the clash / column hits never lose their bolt (code review 2026-11-16)
  function handStrike(d) {
    if (GX.has && GX.has("handStrike")) { GX.emit("handStrike", d); return; }
    const g = new PIXI.Graphics(); g.blendMode = PIXI.BLEND_MODES.ADD; fxTop.addChild(g);
    const pts = [[d.x0, d.y0]], n = 10, nx = -(d.y - d.y0), ny = d.x - d.x0, L = Math.hypot(nx, ny) || 1;
    for (let s = 1; s < n; s++) { const f = s / n, off = (Math.random() - 0.5) * 70 * Math.sin(Math.PI * f);
      pts.push([d.x0 + (d.x - d.x0) * f + (nx / L) * off, d.y0 + (d.y - d.y0) * f + (ny / L) * off]); }
    pts.push([d.x, d.y]);
    const line = (w, c, a) => { g.lineStyle({ width: w, color: c, alpha: a, join: PIXI.LINE_JOIN.ROUND, cap: PIXI.LINE_CAP.ROUND });
      g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach((p) => g.lineTo(p[0], p[1])); };
    const w = d.w || 15; line(w, d.col || 0xffd27a, 0.5); line(w * 0.33, 0xffffff, 1);
    gsap.to(g, { alpha: 0, duration: (d.dur || 0.36) * 0.5, delay: (d.dur || 0.36) * 0.5, ease: "power2.in", onComplete: () => g.destroy() });
  }
  function lightning(x, y, col) {
    { const o = handOrb(); SFX.lightning(); handStrike({ x0: o.x, y0: o.y, x, y, col }); return; }   // white: from the hand's fireball
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
    if (multTag && !multTag.destroyed && multTag.renderable && plaque.visible && plaqueBig.visible)   // the xN tag rides just after the counting digits
      multTag.position.set(plaque.x + (plaqueBig.width * plaque.scale.x) / 2 + (multTag.width * multTag.scale.x) / 2 + 22, plaque.y + 8);
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
        gsap.delayedCall(0.5, () => { if (SPIN_BURST && S.state === "idle") ringAt(scx, scy, 0xffd060, 1.6, 0.5); });   // white: no ring (SPIN_BURST)
        flameKick(0.7);
      }
    } else idleLifeT = 0;
    ambP.update(dt); dust.update(dt); boardP.update(dt); topP.update(dt); popCoins.update(dt);
    // bull breathing + eye flicker
    // b22 (user 2026-11-20: "remove all the scale and stupid animation from the character"): the still bull (before the videos load) no longer breathes by scaling
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
    if (chipGlintT < 0 && colReel.state === "idle" && S.state === "idle") {
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
    // shake
    // shake around the board's rest point (= its pivot: the intro scales the board about (540, 940))
    if (shakeT > 0) { shakeT -= dt; const a = shakeA * Math.max(0, shakeT) / 0.4, dx = (Math.random() - 0.5) * a;
      board.x = board.pivot.x + dx; board.y = board.pivot.y + (Math.random() - 0.5) * a; }   // b22: the shake no longer jiggles the bull (was bullL.x = dx * 0.5)
    else if (board.x !== board.pivot.x || board.y !== board.pivot.y) { board.position.copyFrom(board.pivot); shakeA = 0; }
  });

  // ---------- intro ----------
  // b19 (user 2026-11-19: "remove the tap to play, play it instant"): no TAP TO PLAY screen; once loading is done (the logo
  // screen waits for the art and the bull video's first picture as before) the game begins by itself, exactly as ?autostart.
  // ?tap = the old tap screen (TAP_SCREEN). Sound: browsers keep audio locked until the first gesture, so the first
  // pointer / key anywhere unlocks it (SFX.unlock; audio.js also resumes its own context); music is scheduled at begin and
  // starts then. No sound before that gesture, nothing throws.
  const TAP_SCREEN = params.has("tap");
  const tap = new PIXI.Text("TAP TO PLAY", FX.gold(54));
  tap.anchor.set(0.5); tap.position.set(540, 1200); loadC.addChild(tap);
  loadTxt.visible = false; bar.visible = false; barBg.visible = false;
  if (TAP_SCREEN) gsap.to(tap, { alpha: 0.35, duration: 0.7, yoyo: true, repeat: -1 }); else tap.visible = false;
  if (!TAP_SCREEN) {
    const GEST = ["pointerdown", "pointerup", "touchend", "keydown", "click"];
    const firstGesture = () => {
      try { SFX.unlock(); } catch (e) { /* audio not available */ }
      const c = window.AUDIO && AUDIO.context && AUDIO.context();
      if (!c || c.state === "running") GEST.forEach((ev) => window.removeEventListener(ev, firstGesture, true));
    };
    GEST.forEach((ev) => window.addEventListener(ev, firstGesture, { capture: true, passive: true }));
  }
  [bgL, ambBack, bullL, ambFront, boardL, uiL].forEach((l) => (l.alpha = 0));
  const begin = async () => {
    SFX.unlock(); SFX.music("base");
    loadC.eventMode = "none";
    GX.emit("introBegin", {});
    gsap.to(loadC, { alpha: 0, duration: 0.4, onComplete: () => loadC.destroy({ children: true }) });
    // b23: the loading screen already shows this background, so it is simply there (no fade through black)
    bgL.alpha = 1; gsap.to(ambBack, { alpha: 1, duration: 1.2 }); gsap.to(ambFront, { alpha: 1, duration: 1.2 });
    // b23 (user 2026-11-20: "when game loads show the board first then the character"): board (+ buttons), then the bull
    // rises behind it; the landing impact waits for him (was: bull at 0.2 s, board at 0.45 s, impact at 1.1 s)
    gsap.fromTo(board.scale, { x: 0.92, y: 0.92 }, { x: 1, y: 1, duration: 0.8, ease: "back.out(1.6)", delay: 0.1 });
    board.pivot.set(540, 940); board.position.set(540, 940);
    gsap.to(boardL, { alpha: 1, duration: 0.5, delay: 0.1 });
    gsap.fromTo(uiL, { y: 120 }, { y: 0, duration: 0.7, ease: "power3.out", delay: 0.35 });
    gsap.to(uiL, { alpha: 1, duration: 0.5, delay: 0.35 });
    gsap.fromTo(bull, { y: bl.y + bl.h + 120 }, { y: bl.y + bl.h, duration: 1.1, ease: "power3.out", delay: 0.8 });
    gsap.to(bullL, { alpha: 1, duration: 0.6, delay: 0.8 });
    await FX.wait(1.7);
    SFX.impact(true); bullReact("big"); shake(8, 0.3);
    board.pivot.set(0, 0); board.position.set(0, 0);
    GX.emit("introDone", {});
    S.state = "idle";
  };
  if (TAP_SCREEN) {   // b19: only with ?tap (old behaviour)
    loadC.eventMode = "static"; loadC.hitArea = new PIXI.Rectangle(0, 0, W, H); loadC.cursor = "pointer";
    loadC.once("pointertap", begin);
  }

  // keyboard + demo hooks
  const KEYS = { "1": "win", "2": "wild", "3": "superwild", "4": "big", "5": "mega", "6": "super", "7": "epic", "8": "tease", "9": "m1000", "0": "nowin", n: "nudge4", m: "max", g: "nudgechip", h: "nudgechain", c: "clash", w: "halo" };
  window.addEventListener("keydown", (e) => {
    if (exBet.isOpen()) { if (e.code === "Escape") exBet.close(); return; }      // white: no spin behind the EXTRA BET popup
    if (e.code === "Space") { e.preventDefault(); onSpinPress(); return; }
    if (e.key === "b" && buyUI && S.state === "idle") { buyUI.open(); return; }
    if (e.key === "d" && S.state === "idle" && window.COLDUST) { COLDUST.play(); return; }   // white 2026-11-18: DEMO gold-dust fast column (gx_coldust.js), no round
    if (KEYS[e.key] && S.state === "idle") spin(KEYS[e.key]);
  });
  // taps unlock the phone's videos (iOS Low Power Mode / data saver refuse play() outside a gesture)
  if (MOBILE) ["pointerdown", "touchend", "click", "keydown"].forEach((ev) => window.addEventListener(ev, () => {
    if (mobBull) mobBull.unlock(); if (mobWild) mobWild.unlock();
  }, { capture: true, passive: true }));
  // effect plugins (src/gx_*.js): the game's internals in one object, then every registered plugin starts
  GX.start({ PIXI, gsap, app, W, H, MOBILE, GPASS, params, S, Engine, FX, VFX, SFX, T, reels, colReel,
    REEL_X, REEL_CX, CELL_Y0, CELL_H, WIN_Y1, rowY, COL_CX, COL_CY, COL_P, TRAY, HIGH, LIFT,
    layers: { bgL, ambBack, bullL, ambFront, boardL, uiL, fxTop, popL, board, boardFx, cellFxBack, frameL, reelsL, plaqueL },
    pop: { pop, popBody, popDark, popGlow, popBurst, popTitle, popTitleArt, popAmt, popPlate, popHero, popRays, popFlame, popCoins, popFaders, POP_DY,
      layered: () => popLay.visible },                  // b24: the layered popup is up (no coins, no leaves, amount at popAmt.y)
    bull, bullFit, bullToL, bullDir, bullReact, handNow, handOrb, flame, featRays, vignette, topP, boardP, winObjs,
    burstAt, ringAt, boom, flashAt, starFlash, lightning, shake, hitStop, flameKick, multTint, nEmit,
    fireFrame, tease, FireRect, embers, TITLE: !GPASS,
    isFeature: () => featureOn });
  GX.ctx.colRollShow = colRollShow;                       // b22: gx_halo's SUPER WILD gather rolls the column
  GX.ctx.exs = { swDigits, swPick, SW_PLATE, swTopL, showMsg, clearWin, colGrow: exColGrow, colFinish: exColFinish,      // EX show seam (src/gx_exshow.js reads it at play time)
    overlayOpen: () => exBet.isOpen() || !!(buyUI && buyUI.isOpen && buyUI.isOpen()) || menuL.children.length > 0, minOf: (m) => [1, 3, 15, 50][m],
    // b21 drop show (gx_exshow playDrop): the reels' window in board space, the layer the copies go in (under the frame), a board drop
    win: () => ({ x0: REEL_X[0][0] - 2, x1: REEL_X[2][1] + 2, y0: CELL_Y0, y1: WIN_Y1 }), reelsL, boardDrop, frameTop };
  GX.ctx.cds = { colIds, colWindow, stripAt, colIdxOf, colGrow, colGrowTo, setColC: (c) => { colC = c; }, exCancel: exShowCancel,   // gold-dust column demo seam (src/gx_coldust.js)
    idle: () => S.state === "idle", overlayOpen: GX.ctx.exs.overlayOpen };
  window.G = { mobBull: () => mobBull, mobWild: () => mobWild, bullView: () => ({ still: bullSpr.visible, clip: !!(bullClipC ? bullClipC.visible : clips.bull_idle), alpha: bull.worldAlpha }), spin, S, reels, colReel, Engine, clips, feature, bullSlam, bullCharge, bullOrb, bullPlay, bullWin, fake: bullFake, bullDir, bullReact, buy: (k) => spin(null, k), buyUI: () => buyUI, state: () => S.state, last: null, popOpen: () => pop.visible && !!popTap, tapPop: () => popTap && popTap() };
  window.G.popLayers = () => PL.ready;                     // b24 QA: the layered popup's art is loaded
  window.G.toggleEx = toggleEx; window.G.exBet = exBet; window.G.exPress = exPress;
  window.G.exColGrow = exColGrow; window.G.exColFinish = exColFinish; window.G.exModePrep = exModePrep;   // QA (EX show)
  window.G.exPlan = () => exPlan; window.G.exG = EXG;
  window.G.colDust = (o) => (window.COLDUST ? COLDUST.play(o) : Promise.resolve("off"));   // DEMO: gold-dust fast column (key "d")
  if (params.has("autostart") || !TAP_SCREEN) begin();   // b19: begins by itself unless ?tap
  setTimeout(loadPopLayers, 1500);                       // b24: the layered popup's art, after the start (not on the boot path)
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
