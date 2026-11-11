// Fortune Bull 1000 - effect plugin: rays (see src/gx.js)
// Volumetric backlight behind the bull (replaces the spoke fan ctx.featRays, which is kept as the game's level control):
//   a hot hidden sun behind his neck; its glow is occluded by his real silhouette (the bull is drawn into a small
//   render texture each frame) and smeared outward along the light direction (crepuscular radial march), so the light
//   escapes AROUND his outline in a few broad, uneven shafts; horns and the raised arm cast dark streaks. The shafts are
//   shaped by tileable fbm noise sampled by angle (low frequency) drifting with time - they breathe, they never turn.
//   Smoke drifts outward along them, dust motes behind him light up only inside the beams.
//   Level: ctx.featRays.alpha (the game tweens it 0 off, 0.55 feature, 1 on hits) + flare/hold envelopes.
//   API: window.GXRays = { flare(k, dur), hold(k) -> release(), intro(timeScale) }
//   Phone build (ctx.MOBILE): no render textures or shaders; two pre-rendered soft shaft textures that cross-fade.
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, FX, layers, MOBILE, app } = ctx;
  const fr = ctx.featRays;
  if (!fr || !layers || !layers.bullL) return;
  const ADD = PIXI.BLEND_MODES.ADD;
  const safe = (fn) => { try { return fn(); } catch (e) { console.warn("gx rays", e); } };
  const rnd = (a, b) => a + Math.random() * (b - a);
  fr.renderable = false;

  // ---------- tileable fbm noise (one 256x256 table, used by the shader and by the motes) ----------
  const NS = 256, noise = new Float32Array(NS * NS);
  {
    const h = (x, y, s) => { const v = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return v - Math.floor(v); };
    const sm = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    const oct = [[4, 0.42], [8, 0.3], [16, 0.17], [32, 0.11]];
    let lo = 9, hi = -9;
    for (let y = 0; y < NS; y++) for (let x = 0; x < NS; x++) {
      let v = 0;
      oct.forEach(([g, w], s) => {
        const fx = (x / NS) * g, fy = (y / NS) * g, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
        const x1 = (x0 + 1) % g, y1 = (y0 + 1) % g;
        const a = h(x0, y0, s), b = h(x1, y0, s), c = h(x0, y1, s), d = h(x1, y1, s);
        v += w * (a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty);
      });
      noise[y * NS + x] = v; if (v < lo) lo = v; if (v > hi) hi = v;
    }
    for (let i = 0; i < noise.length; i++) noise[i] = (noise[i] - lo) / (hi - lo);
  }
  const nAt = (u, v) => {
    const x = ((u % 1) + 1) % 1 * NS, y = ((v % 1) + 1) % 1 * NS, x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const x1 = (x0 + 1) % NS, y1 = (y0 + 1) % NS;
    const a = noise[y0 * NS + x0], b = noise[y0 * NS + x1], c = noise[y1 * NS + x0], d = noise[y1 * NS + x1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  };
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  // the shaft profile by angle (same formula as the shader): a few broad uneven shafts, slowly morphing
  const shaftAt = (ang, t) => {
    const u = ang / (Math.PI * 2);
    const n = 0.5 * nAt(u + t * 0.0025, t * 0.011) + 0.3 * nAt(u * 2 - t * 0.004, 0.37 + t * 0.016) + 0.2 * nAt(u * 5 + t * 0.003, 0.71 + t * 0.02);
    const s = sstep(0.36, 0.76, n); return 0.04 + 0.96 * Math.pow(s, 2.4);
  };

  // ---------- light point and level ----------
  const bull = ctx.bull, bf = ctx.bullFit;
  const rest = { x: bull.x, y: bull.y };
  const L0 = { x: fr.x, y: fr.y - 95 };            // behind the beard / neck: the head and the shoulders both rim
  const light = { x: L0.x, y: L0.y };
  const env = { flare: 0 }, holds = new Set();
  let level = 0, time = 0;
  const perf = { ms: 0, n: 0 };

  // ---------- desktop: occluder RT + radial-march shader into a small RT, rim light in front ----------
  const RX0 = -40, RY0 = -120, RW = 1160, RH = 820, RS = 1 / 3, OS = 1 / 2;
  const TW = Math.round(RW * RS), TH = Math.round(RH * RS), OW = Math.round(RW * OS), OH = Math.round(RH * OS);
  const holder = new PIXI.Container(); layers.bullL.addChildAt(holder, 0);
  let raySpr = null, rimSpr = null, occRT = null, rayRT = null, rimRT = null, rayMesh = null, rimMesh = null, uni = null, gpu = !MOBILE;
  const VERT = `
    attribute vec2 aVertexPosition; attribute vec2 aUvs;
    uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
    varying vec2 vUv;
    void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
  const COMMON = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    uniform sampler2D uOcc; uniform sampler2D uNoise;
    uniform vec4 uRegion; uniform vec2 uLight;
    uniform float uTime, uK, uSrc, uReach, uGain, uRim;
    float occAt(vec2 q){
      vec2 uv = (q - uRegion.xy) / uRegion.zw;
      if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0;
      return smoothstep(0.3, 0.8, texture2D(uOcc, uv).a);
    }
    float srcAt(float r){ float s = r / uSrc; return 1.35 * exp(-s * s) + 0.24 / (1.0 + s * s * 0.35); }
    vec4 tone(float I){
      vec3 ember = vec3(0.86, 0.30, 0.07), gold = vec3(1.0, 0.64, 0.22), hot = vec3(1.0, 0.94, 0.80);
      vec3 col = mix(ember, gold, smoothstep(0.04, 0.42, I));
      col = mix(col, hot, smoothstep(0.45, 1.15, I));
      vec3 o = vec3(1.0) - exp(-col * I * 1.25);
      return vec4(o, max(o.r, max(o.g, o.b)));
    }`;
  const FRAG = COMMON + `
    void main(){
      vec2 p = uRegion.xy + vUv * uRegion.zw;
      vec2 d = p - uLight; float r = length(d);
      // crepuscular march toward the hidden sun: light that got past the bull's outline
      vec2 stp = d * (0.94 / 30.0); vec2 q = p; float ill = 0.0, w = 1.0, wsum = 0.0;
      for (int i = 0; i < 30; i++) {
        ill += srcAt(length(q - uLight)) * (1.0 - occAt(q)) * w; wsum += w;
        w *= 0.965; q -= stp;
      }
      ill /= wsum;
      // a few broad shafts of dusty air by angle, drifting (not turning), smoke flowing outward along them
      float u = atan(d.y, d.x) / 6.2831853;
      float n = 0.5 * texture2D(uNoise, vec2(u + uTime * 0.0025, uTime * 0.011)).r
              + 0.3 * texture2D(uNoise, vec2(u * 2.0 - uTime * 0.004, 0.37 + uTime * 0.016)).r
              + 0.2 * texture2D(uNoise, vec2(u * 5.0 + uTime * 0.003, 0.71 + uTime * 0.02)).r;
      float shaft = smoothstep(0.36, 0.76, n); shaft = 0.04 + 0.96 * pow(shaft, 2.4);
      float smoke = texture2D(uNoise, vec2(u * 3.0 + 0.21, r / 1100.0 - uTime * 0.035)).r;
      float dust = 0.55 + 0.9 * smoke * smoke;
      float fall = 1.0 / (1.0 + pow(r / uReach, 2.2));
      float edge = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.86, vUv.y);
      // the glow right at his outline (no shaft modulation): the halo of the backlight
      float halo = srcAt(r) * (1.0 - occAt(p)) * 0.55;
      gl_FragColor = tone((ill * shaft * dust * fall * uGain + halo * fall) * uK * edge);
    }`;
  // rim light ON his outline: inside the silhouette, where a step away from the light leaves it
  const RIM_FRAG = COMMON + `
    void main(){
      vec2 p = uRegion.xy + vUv * uRegion.zw;
      vec2 d = p - uLight; float r = length(d); vec2 dir = d / max(r, 1.0);
      float o = occAt(p);
      float out1 = occAt(p + dir * 4.0), out2 = occAt(p + dir * 9.0);
      float rim = o * (1.0 - 0.55 * out1 - 0.45 * out2);
      float fall = 1.0 / (1.0 + pow(r / (uReach * 0.8), 2.0));
      float edge = smoothstep(1.0, 0.86, vUv.y);
      float u = atan(d.y, d.x) / 6.2831853;
      float n = 0.62 * texture2D(uNoise, vec2(u + uTime * 0.0025, uTime * 0.011)).r
              + 0.38 * texture2D(uNoise, vec2(u * 2.0 - uTime * 0.004, 0.37 + uTime * 0.016)).r;
      float shaft = 0.35 + 0.65 * smoothstep(0.3, 0.75, n);
      gl_FragColor = tone(rim * fall * uK * uRim * edge * shaft * (0.25 + srcAt(r)));
    }`;
  function buildGpu() {
    const c = document.createElement("canvas"); c.width = c.height = NS; const g = c.getContext("2d"), im = g.createImageData(NS, NS);
    for (let i = 0; i < noise.length; i++) { const v = Math.round(noise[i] * 255); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    g.putImageData(im, 0, 0);
    const nTex = PIXI.Texture.from(c, { wrapMode: PIXI.WRAP_MODES.REPEAT, mipmap: PIXI.MIPMAP_MODES.OFF, scaleMode: PIXI.SCALE_MODES.LINEAR });
    occRT = PIXI.RenderTexture.create({ width: OW, height: OH, resolution: 1 });
    rayRT = PIXI.RenderTexture.create({ width: TW, height: TH, resolution: 1 });
    rimRT = PIXI.RenderTexture.create({ width: OW, height: OH, resolution: 1 });
    const quad = (w, h) => new PIXI.Geometry().addAttribute("aVertexPosition", [0, 0, w, 0, w, h, 0, h], 2)
      .addAttribute("aUvs", [0, 0, 1, 0, 1, 1, 0, 1], 2).addIndex([0, 1, 2, 0, 2, 3]);
    uni = { uOcc: occRT, uNoise: nTex, uRegion: new Float32Array([RX0, RY0, RW, RH]), uLight: new Float32Array([light.x, light.y]),
      uTime: 0, uK: 0, uSrc: 210, uReach: 560, uGain: 4.2, uRim: 0.32 };
    rayMesh = new PIXI.Mesh(quad(TW, TH), PIXI.Shader.from(VERT, FRAG, uni));
    rimMesh = new PIXI.Mesh(quad(OW, OH), PIXI.Shader.from(VERT, RIM_FRAG, uni));
    raySpr = new PIXI.Sprite(rayRT); raySpr.position.set(RX0, RY0); raySpr.scale.set(1 / RS); raySpr.blendMode = ADD;
    holder.addChild(raySpr);
    // the rim rides in front of the bull (inside bullL, right above bullFit)
    rimSpr = new PIXI.Sprite(rimRT); rimSpr.position.set(RX0, RY0); rimSpr.scale.set(1 / OS); rimSpr.blendMode = ADD;
    layers.bullL.addChildAt(rimSpr, layers.bullL.getChildIndex(bf) + 1);
  }
  // the bull's silhouette, drawn into the occluder RT (same frame, so moves and throws cast their own shafts)
  function renderOcc() {
    const px = bf.position.x, py = bf.position.y, sx = bf.scale.x, sy = bf.scale.y;
    bf.position.set((px - RX0) * OS, (py - RY0) * OS); bf.scale.set(sx * OS, sy * OS);
    try { app.renderer.render(bf, { renderTexture: occRT, clear: true }); }
    finally { bf.position.set(px, py); bf.scale.set(sx, sy); }
  }

  // ---------- phone: the same light baked once into two textures (occluded by the still bull), cross-fading ----------
  const mobSpr = [];
  const MS = 1 / 4, MW = Math.round(RW * MS), MH = Math.round(RH * MS);
  // where the still bull sits in bullL space, taken now while he is at rest (the intro slides him in later)
  const still = (() => {
    let spr = null;
    const walk = (o) => (o.children || []).forEach((c) => { if (!spr && c instanceof PIXI.Sprite && c.texture && c.texture.baseTexture
      && c.blendMode === PIXI.BLEND_MODES.NORMAL && c.texture.width > 500) spr = c; walk(c); });
    walk(bull);
    if (!spr) return null;
    const p0 = layers.bullL.toLocal(spr.toGlobal(new PIXI.Point(0, 0))), p1 = layers.bullL.toLocal(spr.toGlobal(new PIXI.Point(spr.texture.width, spr.texture.height)));
    return { spr, x: p0.x, y: p0.y, w: p1.x - p0.x, h: p1.y - p0.y };
  })();
  function bakeOcc() {
    const occ = new Float32Array(MW * MH);
    safe(() => {
      if (!still) return;
      const t = still.spr.texture, src = t.baseTexture.resource && t.baseTexture.resource.source, f = t.frame;
      if (!src) return;
      const c = document.createElement("canvas"); c.width = MW; c.height = MH; const g = c.getContext("2d");
      g.drawImage(src, f.x, f.y, f.width, f.height, (still.x - RX0) * MS, (still.y - RY0) * MS, still.w * MS, still.h * MS);
      const d = g.getImageData(0, 0, MW, MH).data;
      for (let i = 0; i < occ.length; i++) occ[i] = sstep(77, 204, d[i * 4 + 3]);
    });
    return occ;
  }
  // the desktop shader's maths in JS, a few rows per frame so the boot never stalls
  function buildMobile() {
    const occ = bakeOcc(), L = L0, NSTEP = 22;
    const srcAt = (r) => { const q = r / 210; return 1.35 * Math.exp(-q * q) + 0.24 / (1 + q * q * 0.35); };
    const occAt = (x, y) => { const i = Math.floor((x - RX0) * MS), j = Math.floor((y - RY0) * MS); return i < 0 || j < 0 || i >= MW || j >= MH ? 0 : occ[j * MW + i]; };
    const jobs = [0, 1].map((k) => {
      const c = document.createElement("canvas"); c.width = MW; c.height = MH; const g = c.getContext("2d");
      return { k, c, g, im: g.createImageData(MW, MH), row: 0 };
    });
    const tone = (I, data, i4) => {
      const hot = 0.45 * sstep(0.6, 1.6, I), gd = sstep(0.04, 0.42, I);      // phone bake: leaks round the still-vs-video pose stay warm gold, never grey-white
      const cr = 0.86 + 0.14 * gd, cg = 0.30 + 0.34 * gd, cb = 0.07 + 0.15 * gd;
      const r = cr + (1 - cr) * hot, gg = cg + (0.94 - cg) * hot, bb = cb + (0.8 - cb) * hot;
      data[i4] = 255 * (1 - Math.exp(-r * I * 1.25)); data[i4 + 1] = 255 * (1 - Math.exp(-gg * I * 1.25)); data[i4 + 2] = 255 * (1 - Math.exp(-bb * I * 1.25));
      data[i4 + 3] = Math.max(data[i4], data[i4 + 1], data[i4 + 2]);
    };
    const step = () => safe(() => {
      const job = jobs.find((j) => j.row < MH);
      if (!job) return;
      const t = job.k * 37, data = job.im.data;
      for (let y = job.row, y1 = Math.min(MH, job.row + 12); y < y1; y++) for (let x = 0; x < MW; x++) {
        const px = RX0 + (x + 0.5) / MS, py = RY0 + (y + 0.5) / MS, dx = px - L.x, dy = py - L.y, r = Math.hypot(dx, dy);
        let ill = 0, w = 1, ws = 0;
        for (let i = 0; i < NSTEP; i++) {
          const f = 1 - (0.94 * i) / NSTEP, qx = L.x + dx * f, qy = L.y + dy * f;
          ill += srcAt(r * f) * (1 - occAt(qx, qy)) * w; ws += w; w *= 0.955;
        }
        ill /= ws;
        const ang = Math.atan2(dy, dx), u = ang / (Math.PI * 2);
        const sm = nAt(u * 3 + 0.21, r / 1100 + job.k * 0.5);
        const fall = 1 / (1 + Math.pow(r / 560, 2.2));
        const edge = sstep(0, 0.06, x / MW) * sstep(1, 0.94, x / MW) * sstep(0, 0.08, y / MH) * sstep(1, 0.86, y / MH);
        const halo = srcAt(r) * (1 - occAt(px, py)) * 0.55;
        tone((ill * shaftAt(ang, t) * (0.55 + 0.9 * sm * sm) * fall * 4.2 + halo * fall) * edge, data, (y * MW + x) * 4);
      }
      job.row += 12;
      if (job.row >= MH) {
        job.g.putImageData(job.im, 0, 0);
        const sp = new PIXI.Sprite(PIXI.Texture.from(job.c)); sp.position.set(RX0, RY0); sp.scale.set(1 / MS); sp.blendMode = ADD; sp.alpha = 0;
        holder.addChild(sp); mobSpr.push(sp);
      }
      setTimeout(step, 16);
    });
    setTimeout(step, 400);
  }

  // ---------- dust motes behind him, lit only inside the beams ----------
  const moteL = new PIXI.Container(); layers.bullL.addChildAt(moteL, 1);
  const motes = [];
  const NM = MOBILE ? 32 : 70;
  const spawn = (m, any) => {
    // the upper half only: below the light is the board
    const a = rnd(-Math.PI - 0.35, 0.35), r = any ? rnd(170, 620) : rnd(170, 300);
    m.x = light.x + Math.cos(a) * r; m.y = light.y + Math.sin(a) * r * 0.85;
    m.vx = rnd(-8, 8); m.vy = rnd(-14, 2); m.ph = rnd(0, 6.28); m.fq = rnd(0.6, 1.6); m.s0 = rnd(0.07, 0.17);
  };
  for (let i = 0; i < NM; i++) {
    const m = new PIXI.Sprite(FX.tex.dot); m.anchor.set(0.5); m.blendMode = ADD; m.tint = i % 3 ? 0xffd8a0 : 0xfff0d0;
    spawn(m, true); m.scale.set(m.s0); m.alpha = 0; moteL.addChild(m); motes.push(m);
  }
  // a couple of big out-of-focus specks for depth
  for (let i = 0; i < (MOBILE ? 2 : 5); i++) {
    const m = new PIXI.Sprite(FX.tex.glow); m.anchor.set(0.5); m.blendMode = ADD; m.tint = 0xffc070; m.bokeh = true;
    spawn(m, true); m.s0 = rnd(0.12, 0.22); m.scale.set(m.s0); m.alpha = 0; moteL.addChild(m); motes.push(m);
  }
  const fieldAt = (x, y) => {
    const dx = x - light.x, dy = y - light.y, r = Math.hypot(dx, dy);
    return shaftAt(Math.atan2(dy, dx), time) * (1 / (1 + Math.pow(r / 520, 2.2))) * sstep(120, 220, r);
  };

  if (gpu) { safe(buildGpu); gpu = !!raySpr; }
  if (!gpu) safe(buildMobile);

  // ---------- per frame ----------
  let firstGpu = true;
  app.ticker.add(() => safe(() => {
    const dt = Math.min(0.05, app.ticker.deltaMS / 1000) * gsap.globalTimeline.timeScale();
    time += dt;
    let hk = 0; holds.forEach((h) => (hk += h.k));
    const base = fr.alpha / 0.55;
    level = Math.min(2.6, base + env.flare + hk);
    const on = level > 0.004 && layers.bullL.worldVisible !== false;
    holder.visible = moteL.visible = on;
    if (rimSpr) rimSpr.visible = on && gpu;
    if (!on) return;
    // the light rides the bull (lunges, the intro slide)
    const k = bf.scale.x;
    light.x = L0.x + (bull.x - rest.x) * k; light.y = L0.y + (bull.y - rest.y) * k;
    const breath = 1 + 0.07 * Math.sin(time * 0.9) * Math.sin(time * 0.37 + 1.3);
    const hit = Math.min(1, Math.max(0, level - 1));
    if (gpu && raySpr) {
      uni.uTime = time; uni.uK = Math.min(level, 1) * breath + hit * 0.3;
      uni.uLight[0] = light.x; uni.uLight[1] = light.y;
      uni.uSrc = 210 * (1 + 0.18 * hit); uni.uReach = 560 * (1 + 0.35 * hit);
      try {
        const t0 = performance.now();
        renderOcc();
        app.renderer.render(rayMesh, { renderTexture: rayRT, clear: true });
        app.renderer.render(rimMesh, { renderTexture: rimRT, clear: true });
        firstGpu = false;
        perf.ms += performance.now() - t0; perf.n++;
      }
      catch (e) {
        console.warn("gx rays: gpu path off", e);
        gpu = false; raySpr.visible = false; rimSpr.visible = false; if (!mobSpr.length) buildMobile();
      }
    } else if (mobSpr.length) {
      // two baked fields cross-fading (their shafts differ), riding the bull; hits brighten and push them out a little
      const a = Math.min(level, 1) * breath + hit * 0.3, sc = (1 / MS) * (1 + 0.12 * hit);
      mobSpr.forEach((sp, i) => {
        const w = mobSpr.length > 1 ? 0.5 + 0.5 * Math.sin(time * 0.23 + i * Math.PI) : 1;
        sp.alpha = a * (0.25 + 0.75 * w);
        sp.scale.set(sc);
        sp.position.set(light.x + (RX0 - L0.x) * sc * MS, light.y + (RY0 - L0.y) * sc * MS);
      });
    }
    // motes: slow Brownian drift, outward a little, brightness = the beam they are in
    const ma = Math.min(level, 1.4);
    motes.forEach((m) => {
      m.vx += rnd(-12, 12) * dt; m.vy += rnd(-12, 12) * dt;
      m.vx *= 1 - 0.4 * dt; m.vy *= 1 - 0.4 * dt;
      const dx = m.x - light.x, dy = m.y - light.y, r = Math.hypot(dx, dy) || 1;
      m.x += (m.vx + (dx / r) * 6) * dt; m.y += (m.vy + (dy / r) * 6 - 4) * dt;
      if (r > 700 || m.y < -40) spawn(m, false);
      const tw = 0.6 + 0.4 * Math.sin(time * m.fq * 3 + m.ph);
      const f = fieldAt(m.x, m.y);
      m.alpha = Math.min(1, ma * Math.sqrt(f) * tw * (m.bokeh ? 0.3 : 1.25));
      m.scale.set(m.s0 * (1 + 0.15 * hit));
    });
  }));

  // ---------- API ----------
  function flare(k, dur) {
    const kk = +k || 0.8, d = Math.max(0.05, +dur || 0.6);
    gsap.killTweensOf(env);
    return gsap.timeline().to(env, { flare: Math.max(env.flare, kk), duration: 0.12, ease: "power2.out" })
      .to(env, { flare: 0, duration: d, ease: "power2.in" });
  }
  function hold(k) {
    const h = { k: 0 }; holds.add(h);
    gsap.to(h, { k: +k || 0.8, duration: 0.3, ease: "power2.out" });
    let gone = false;
    return () => { if (gone) return; gone = true; gsap.killTweensOf(h); gsap.to(h, { k: 0, duration: 0.6, ease: "power2.in", onComplete: () => holds.delete(h) }); };
  }
  // the feature intro: the light swells behind him, then two beats (0.8 s, 1.4 s), gone by ~2.5 s
  function intro(ts) {
    gsap.killTweensOf(env);
    const tl = gsap.timeline();
    tl.to(env, { flare: 0.7, duration: 0.3, ease: "power2.out" }, 0.05)
      .to(env, { flare: 0.2, duration: 0.45, ease: "sine.inOut" }, 0.35)
      .to(env, { flare: 0.75, duration: 0.06, ease: "power2.out" }, 0.8)
      .to(env, { flare: 0.25, duration: 0.5, ease: "power2.in" }, 0.86)
      .to(env, { flare: 1.0, duration: 0.06, ease: "power2.out" }, 1.4)
      .to(env, { flare: 0, duration: 1.0, ease: "power2.in" }, 1.46);
    tl.timeScale(+ts || 1);
    return tl;
  }
  window.GXRays = {
    flare, hold, intro,
    _kick: () => gsap.fromTo(fr, { alpha: 1 }, { alpha: 0.55, duration: 1.4 }),
    _probe: () => ({ level, gpu, cpuMsPerFrame: perf.n ? +(perf.ms / perf.n).toFixed(3) : 0, light: { ...light }, rt: [TW, TH], motes: motes.length, firstGpu }),
  };
});
