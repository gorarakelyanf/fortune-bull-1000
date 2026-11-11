// Fortune Bull 1000 - effect plugin: fire (see src/gx.js)
// Replaces the painted flipbook fence round the board (ctx.fireFrame) and round reel 3 (ctx.tease) with a GPU fire ring:
// one mesh per ring (thin quads along the frame only), domain-warped fbm from a tileable 4-channel noise texture,
// rising and stretching, uneven heights with travelling tall licks, black-body colour ramp, premultiplied
// "emit + slight occlusion" blending, a bed glow at the base, faint smoke above the top edge, a flickering warm light
// cast onto the frame and reel edges, rising sparks with turbulence and (desktop) a heat-haze shimmer over the bull.
// The game keeps driving fireFrame.visible / alpha: alpha 1 = flare (taller, hotter), 0.62 = sustained burn.
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, app, MOBILE, FX } = ctx;
  const ff = ctx.fireFrame, tz = ctx.tease;
  if (!ff || !app || !app.renderer || !app.renderer.gl) return;
  const fr = (v) => v - Math.floor(v);
  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- tileable noise: 4 independent channels of Perlin gradient noise, period 32 cells, 8 texels per cell ----------
  function noiseTexture() {
    const N = 256, P = 32, C = N / P, data = new Uint8Array(N * N * 4);
    let seed = 0x9e3779b9;
    const rand = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    for (let ch = 0; ch < 4; ch++) {
      const gx = new Float32Array(P * P), gy = new Float32Array(P * P);
      for (let i = 0; i < P * P; i++) { const a = rand() * Math.PI * 2; gx[i] = Math.cos(a); gy[i] = Math.sin(a); }
      const dot = (i, j, x, y) => { const k = (j % P) * P + (i % P); return gx[k] * x + gy[k] * y; };
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const fx = (x + 0.5) / C, fy = (y + 0.5) / C, i = Math.floor(fx), j = Math.floor(fy), tx = fx - i, ty = fy - j;
        const u = fade(tx), v = fade(ty);
        const a = dot(i, j, tx, ty), b = dot(i + 1, j, tx - 1, ty), c = dot(i, j + 1, tx, ty - 1), d = dot(i + 1, j + 1, tx - 1, ty - 1);
        const n = (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
        data[(y * N + x) * 4 + ch] = Math.max(0, Math.min(255, Math.round((0.5 + n * 0.8) * 255)));
      }
    }
    const bt = PIXI.BaseTexture.fromBuffer(data, N, N, { wrapMode: PIXI.WRAP_MODES.REPEAT, scaleMode: PIXI.SCALE_MODES.LINEAR,
      mipmap: PIXI.MIPMAP_MODES.OFF, alphaMode: PIXI.ALPHA_MODES.NO_PREMULTIPLIED_ALPHA });
    return new PIXI.Texture(bt);
  }
  const NOISE = noiseTexture();

  // ---------- the fire shader ----------
  const VERT = `
    attribute vec2 aVertexPosition;
    uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
    uniform vec2 uCell;
    varying vec2 vP; varying vec2 vQ;
    void main(){ vP = aVertexPosition; vQ = aVertexPosition * uCell;
      gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
  const FRAG = `
    precision mediump float;
    #define OCT ${MOBILE ? 3 : 4}
    varying vec2 vP; varying vec2 vQ;
    uniform sampler2D uNoise;
    uniform vec4 uLine;   // burning centre lines: left x, top y, right x, bottom y
    uniform vec4 uShape;  // top flame length, side reach outward, side reach inward, bottom flame length
    uniform vec4 uS0;     // per-octave upward scroll (noise uv, wrapped)
    uniform vec4 uS1;     // warp scroll, profile drift, profile evolution, smoke scroll
    uniform vec4 uMisc;   // heat, opacity, smoke amount, top inward reach
    uniform vec4 uWarp;   // warp field scale x, y, warp amount, sway px
    float fbm(vec2 uv){
      float v = 0.5 * texture2D(uNoise, uv + vec2(0.0, uS0.x)).r;
      v += 0.25 * texture2D(uNoise, uv * 2.0 + vec2(0.37, uS0.y)).g;
      v += 0.125 * texture2D(uNoise, uv * 4.0 + vec2(0.71, uS0.z)).b;
    #if OCT > 3
      v += 0.0625 * texture2D(uNoise, uv * 8.0 + vec2(0.13, uS0.w)).a;
      return v * 1.0667;
    #else
      return v * 1.1429;
    #endif
    }
    vec3 ramp(float T){
      vec3 c = vec3(0.45, 0.03, 0.0) * smoothstep(0.0, 0.2, T);
      c = mix(c, vec3(0.95, 0.26, 0.02), smoothstep(0.12, 0.45, T));
      c = mix(c, vec3(1.0, 0.6, 0.12), smoothstep(0.42, 0.78, T));
      c = mix(c, vec3(1.0, 0.86, 0.5), smoothstep(0.78, 1.05, T));
      return mix(c, vec3(1.0, 0.97, 0.86), smoothstep(1.05, 1.3, T));
    }
    void main(){
      vec2 p = vP;
      float heat = uMisc.x;
      vec4 w4 = texture2D(uNoise, p * uWarp.xy + vec2(0.11, uS1.x));
      vec2 wv = w4.rg - 0.5;
      // height profiles: slow drift plus tall licks that grow and die as the slice evolves
      vec4 pr = texture2D(uNoise, vec2(p.x * 0.000208 + uS1.y, 0.31));
      vec4 pl = texture2D(uNoise, vec2(p.x * 0.000347, uS1.z));
      vec4 ps = texture2D(uNoise, vec2(0.71 + uS1.y, p.y * 0.000347 + uS1.z * 0.7));
      float hk = 0.6 + 0.4 * heat;
      float Lt = uShape.x * max(0.3, 0.62 + 1.2 * (pr.b - 0.5) + 0.9 * smoothstep(0.56, 0.8, pl.r)) * hk;
      float Wo = uShape.y * max(0.35, 0.75 + 1.0 * (ps.g - 0.5) + 0.6 * smoothstep(0.56, 0.8, ps.a)) * hk;
      float Lb = uShape.w * max(0.3, 0.7 + 1.1 * (pl.g - 0.5)) * hk;
      float up = uLine.y - p.y;
      // tongues sway with the turbulence, more toward their tips
      float sx = p.x + wv.x * uWarp.w * clamp(up / uShape.x, 0.0, 2.0);
      float ox = max(uLine.x - sx, sx - uLine.z);
      // top edge
      float hT = up >= 0.0 ? up / Lt : -up / uMisc.w;
      if (ox > 0.0) hT = max(hT, ox / 16.0);
      // side posts (nearest), rounding into the top flames, ending at the bottom bar
      float dP = p.x < (uLine.x + uLine.z) * 0.5 ? uLine.x - p.x : p.x - uLine.z;
      float hS = dP >= 0.0 ? dP / Wo : -dP / uShape.z;
      hS = length(vec2(hS, max(max(up, 0.0) / Lt, max(p.y - uLine.w, 0.0) / 12.0)));
      // bottom bar: low flames
      float ub = uLine.w - p.y;
      float hB = ub >= 0.0 ? ub / Lb : -ub / 10.0;
      hB = max(hB, max(ox, 0.0) / 10.0);
      float hTB = min(hT, hB);
      float h = min(hTB, hS);
      // side posts and bottom bar burn cooler and more broken than the top edge (no white-hot tube along the frame)
      float kS = smoothstep(-0.12, 0.12, hTB - hS);
      float kB = smoothstep(-0.12, 0.12, hT - hB) * (1.0 - kS);
      float kC = max(kS, kB);
      // flame body: warped fbm rising upward, solid at the base, ragged and detaching toward the tips
      float n = fbm(vQ + wv * uWarp.z);
      float nc = (n - 0.5) * mix(2.6, 3.3, kC);
      float temp = (1.0 - h) * mix(1.15, mix(0.92, 0.7, kS), kC) + nc * (mix(0.3, 0.55, kC) + 0.7 * clamp(h, 0.0, 1.3)) - 0.04;
      temp = temp * (0.82 + 0.18 * heat) + (pl.b - 0.5) * 0.3;
      temp *= 1.0 - smoothstep(1.45, 2.05, h);
      // bottom licks stay low: a hard ceiling so they never climb into the symbols
      temp *= mix(1.0, smoothstep(uLine.w - uShape.w * 1.75, uLine.w - uShape.w * 0.9, p.y), kB);
      float T = clamp(temp, 0.0, mix(1.35, mix(1.0, 0.86, kS), kC));
      float cov = smoothstep(0.02, 0.22, T);
      vec3 emit = ramp(T) * cov * (0.5 + 0.62 * T);
      emit += vec3(0.9, 0.26, 0.03) * exp(-h * 2.4) * 0.2 * heat;
      float occ = 0.3 * smoothstep(0.15, 0.75, T);
      // faint dark smoke above the top flames
      if (uMisc.z > 0.0 && up > 0.0) {
        float hs = up / uShape.x;
        float s = texture2D(uNoise, vQ * 0.3 + wv * 0.03 + vec2(0.4, uS1.w)).g * 0.65 + texture2D(uNoise, vQ * 0.7 + vec2(0.2, uS1.w * 2.0)).r * 0.35;
        float smk = clamp((s - 0.44) * 3.2, 0.0, 1.0) * smoothstep(0.45, 1.1, hs) * (1.0 - smoothstep(1.45, 2.1, hs));
        smk *= (1.0 - smoothstep(0.0, 24.0, ox)) * uMisc.z * (1.0 - cov * 0.7);
        occ += smk * 0.32;
        emit += vec3(0.05, 0.02, 0.008) * smk;
      }
      gl_FragColor = vec4(emit, occ) * uMisc.y;
    }`;

  // ---------- heat haze filter (desktop): shimmers what is behind the top flames, limited to a band ----------
  const HAZE = `
    precision mediump float;
    varying vec2 vTextureCoord;
    uniform sampler2D uSampler; uniform sampler2D uNoise;
    uniform highp vec4 inputSize; uniform highp vec4 outputFrame; uniform vec4 inputClamp;
    uniform vec4 uBand;   // screen y top, screen y base, strength (screen px), screen px per design px
    uniform vec2 uScroll;
    void main(){
      vec2 sp = vTextureCoord * inputSize.xy + outputFrame.xy;
      float k = smoothstep(uBand.x, mix(uBand.x, uBand.y, 0.55), sp.y) * (1.0 - smoothstep(uBand.y - 6.0 * uBand.w, uBand.y + 4.0 * uBand.w, sp.y));
      vec2 uv = vTextureCoord;
      if (k > 0.002) {
        vec2 q = sp / (uBand.w * vec2(1300.0, 900.0));
        vec2 w = texture2D(uNoise, q + vec2(0.0, uScroll.x)).rg - 0.5;
        w += (texture2D(uNoise, q * 2.3 + vec2(0.5, uScroll.y)).ba - 0.5) * 0.7;
        uv = clamp(uv + w * uBand.z * k * inputSize.zw, inputClamp.xy, inputClamp.zw);
      }
      gl_FragColor = texture2D(uSampler, uv);
    }`;

  // warm light cast by the fire, painted once (half resolution) and flickered
  function lightSprite(box, paint) {
    const [X0, Y0, X1, Y1] = box, s = 0.5;
    const cv = document.createElement("canvas"); cv.width = Math.ceil((X1 - X0) * s); cv.height = Math.ceil((Y1 - Y0) * s);
    const g = cv.getContext("2d"); g.scale(s, s); g.translate(-X0, -Y0);
    const lin = (x0, y0, x1, y1, a, rx, ry, rw, rh) => {
      const gr = g.createLinearGradient(x0, y0, x1, y1);
      gr.addColorStop(0, `rgba(255,150,60,${a})`); gr.addColorStop(0.45, `rgba(255,110,30,${a * 0.38})`); gr.addColorStop(1, "rgba(255,90,20,0)");
      g.fillStyle = gr; g.fillRect(rx, ry, rw, rh);
    };
    g.globalCompositeOperation = "lighter";
    paint(lin, g);
    const sp = new PIXI.Sprite(PIXI.Texture.from(cv)); sp.position.set(X0, Y0); sp.scale.set(1 / s);
    sp.blendMode = PIXI.BLEND_MODES.ADD;
    return sp;
  }

  function quadsGeo(quads) {
    const pos = [], idx = [];
    quads.forEach(([x0, y0, x1, y1], k) => { pos.push(x0, y0, x1, y0, x1, y1, x0, y1); const b = k * 4; idx.push(b, b + 1, b + 2, b, b + 2, b + 3); });
    return new PIXI.Geometry().addAttribute("aVertexPosition", pos, 2).addIndex(idx);
  }

  const CX = 34, CY = 58;          // flame noise cell size (px): narrow, tall tongues
  function makeRing(host, o) {
    const shader = PIXI.Shader.from(VERT, FRAG, {
      uNoise: NOISE, uCell: [1 / (CX * 32), 1 / (CY * 32)], uLine: o.line, uShape: o.shape,
      uS0: [0, 0, 0, 0], uS1: [0, 0, 0, 0], uMisc: [1, 1, o.smoke || 0, o.inTop], uWarp: [1 / (170 * 32), 1 / (240 * 32), 0.05, o.sway || 34] });
    const mesh = new PIXI.Mesh(quadsGeo(o.quads), shader);
    mesh.blendMode = PIXI.BLEND_MODES.NORMAL;
    const root = new PIXI.Container(); root.name = "gxFire";
    if (o.light) root.addChild(o.light);
    root.addChild(mesh);
    host.addChild(root);
    return { host, root, mesh, shader, o, light: o.light, lightA: o.lightA || 1 };
  }

  // is the shader usable on this GPU? if not, keep the game's own fire
  // (compiled on a throwaway program: binding a Pixi shader outside a render pass upsets its uniform cache)
  function compiles() {
    const gl = app.renderer.gl; let vs, fs, pr;
    try {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      vs = sh(gl.VERTEX_SHADER, "precision highp float;" + VERT); fs = sh(gl.FRAGMENT_SHADER, FRAG.replace("precision mediump float;", "precision mediump float;\n"));
      pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
      const ok = gl.getProgramParameter(pr, gl.LINK_STATUS);
      if (!ok) console.warn("gx fire shader", gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(pr));
      return !!ok || gl.isContextLost();
    } catch (e) { console.warn("gx fire shader", e); return false; }
    finally { try { if (pr) gl.deleteProgram(pr); if (vs) gl.deleteShader(vs); if (fs) gl.deleteShader(fs); } catch (e) { /* ignore */ } }
  }

  // hide the old flipbook fence / glow line (stop the flipbooks: no cost while hidden), keep everything else
  function retire(host, keep) {
    host.children.forEach((c) => {
      if (c.name === "gxFire" || keep(c)) return;
      c.renderable = false;
      const stop = (n) => { if (n instanceof PIXI.AnimatedSprite) n.stop(); (n.children || []).forEach(stop); };
      stop(c);
    });
  }

  // ---------- the board ring ----------
  const [bx0, by0, bx1, by1] = ff.box || [10, 594, 1070, 1288];
  const LT = 155, YT = by0 + 6, XL = bx0 + 16, XR = bx1 - 15, YB = by1 - 16;
  const frameLight = lightSprite([0, YT - 260, 1080, YB + 30], (lin) => {
    lin(0, YT + 4, 0, YT - 230, 0.5, 0, YT - 240, 1080, 246);           // warm light up over the bull and the columns
    lin(0, YT + 2, 0, YT + 54, 0.42, XL, YT, XR - XL, 60);             // inner edges: a thin warm rim on the reels
    lin(XL, 0, XL + 52, 0, 0.3, XL, YT, 60, YB - YT);
    lin(XR, 0, XR - 52, 0, 0.3, XR - 60, YT, 60, YB - YT);
    lin(0, YB, 0, YB - 44, 0.36, XL, YB - 50, XR - XL, 50);
    lin(XL, 0, XL - 40, 0, 0.28, 0, YT - 10, XL, YB - YT + 20);          // outer sides
    lin(XR, 0, XR + 40, 0, 0.28, XR, YT - 10, 1080 - XR, YB - YT + 20);
  });
  const board = makeRing(ff, {
    line: [XL, YT, XR, YB], shape: [LT, 30, 9, 38], inTop: 10, smoke: 1, sway: 38, light: frameLight, lightA: 0.85,
    quads: [[0, YT - LT * 2.15, 1080, YT + 16], [0, YT + 16, 66, YB + 20], [1014, YT + 16, 1080, YB + 20], [66, YB - 68, 1014, YB + 20]],
  });
  const rings = [board];

  // ---------- the reel-3 anticipation ring ----------
  if (tz && tz.box) {
    const [tx0, ty0, tx1, ty1] = tz.box, L2 = 150, tl = tx0 + 6, tr = tx1 - 6, tt = ty0 + 6, tb = ty1 - 6;
    const tLight = lightSprite([tl - 70, tt - 180, tr + 70, tb + 20], (lin) => {
      lin(0, tt + 4, 0, tt - 170, 0.45, tl - 40, tt - 180, tr - tl + 80, 184);
      lin(tl, 0, tl - 64, 0, 0.42, tl - 70, tt - 10, 70, tb - tt + 20);
      lin(tr, 0, tr + 64, 0, 0.42, tr, tt - 10, 70, tb - tt + 20);
    });
    rings.push(makeRing(tz, {
      line: [tl, tt, tr, tb], shape: [L2, 34, 16, 26], inTop: 14, smoke: 0.6, sway: 30, light: tLight, lightA: 0.9,
      quads: [[tl - 56, tt - L2 * 2.15, tr + 56, tt + 18], [tl - 56, tt + 18, tl + 30, tb + 16], [tr - 30, tt + 18, tr + 56, tb + 16], [tl + 30, tb - 46, tr - 30, tb + 16]],
    }));
  }

  if (!compiles()) { rings.forEach((r) => r.root.destroy({ children: true })); return; }
  retire(ff, () => false);
  // the tease keeps its warm fill and yellow inner rim (Graphics); only the flame fence goes
  if (tz) retire(tz, (c) => c instanceof PIXI.Graphics);

  // ---------- sparks: tiny streaks rising off the top edge and the posts, wandering in the updraft, cooling ----------
  const sparks = new FX.Particles(ff);
  const SPARK_RATE = MOBILE ? 20 : 42;
  let sparkAcc = 0;
  function emitSpark() {
    let x, y;
    const r = Math.random();
    if (r < 0.7) { x = rnd(XL - 6, XR + 6); y = YT - rnd(0, 40); }
    else { const L = Math.random() < 0.5; x = L ? XL - rnd(0, 18) : XR + rnd(0, 18); y = rnd(YT + 40, YB - 20); }
    const hot = Math.random();
    sparks.emit({ tex: FX.tex.dot, x, y, vx: rnd(-50, 50), vy: -rnd(120, 360), ay: -rnd(10, 60), drag: 0.35,
      s0: rnd(0.07, 0.15), s1: 0.02, life: rnd(0.8, 2.0), a0: 1, a1: 0.1, stretch: 260, twinkle: hot < 0.4 ? rnd(10, 22) : 0 });
    const p = sparks.list[sparks.list.length - 1];
    p.seed = rnd(0, 6.28); p.wf = rnd(1.5, 4.5); p.hot = hot;
  }
  const lerpC = (a, b, t) => {
    const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * t, g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * t, bl = (a & 255) + ((b & 255) - (a & 255)) * t;
    return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
  };

  // ---------- heat haze (desktop only) on the bull layer, only while the board burns ----------
  let haze = null;
  const hazeHost = ctx.layers && ctx.layers.bullL;
  if (!MOBILE && hazeHost && !(ctx.params && ctx.params.has("nohaze"))) {
    try {
      haze = new PIXI.Filter(undefined, HAZE, { uNoise: NOISE, uBand: [0, 0, 0, 1], uScroll: [0, 0] });
      haze.resolution = app.renderer.resolution; haze.padding = 0;
    } catch (e) { haze = null; }
  }
  const hazeOn = (on) => {
    if (!haze) return;
    const list = (hazeHost.filters || []).filter((f) => f !== haze);
    if (on) list.push(haze);
    hazeHost.filters = list.length ? list : null;
  };
  let hazeActive = false;

  // ---------- per frame ----------
  let t = 0;
  const pt = new PIXI.Point();
  app.ticker.add(() => {
    try {
      const dt = Math.min(0.05, app.ticker.deltaMS / 1000) * gsap.globalTimeline.timeScale();
      t += dt;
      const flick = 1 + 0.07 * Math.sin(t * 7.3) + 0.05 * Math.sin(t * 13.7 + 1.3) + 0.04 * Math.sin(t * 23.1 + 2.1) + 0.03 * Math.sin(t * 3.1);
      const a = CY * 32;
      for (const r of rings) {
        if (!r.host.worldVisible || r.root.destroyed) continue;
        const wa = r.host.worldAlpha;
        const u = r.shader.uniforms;
        u.uS0[0] = fr(t * 92 / a); u.uS0[1] = fr(t * 130 * 2 / a); u.uS0[2] = fr(t * 185 * 4 / a); u.uS0[3] = fr(t * 250 * 8 / a);
        u.uS1[0] = fr(t * 60 / (240 * 32)); u.uS1[1] = fr(t * 0.004); u.uS1[2] = fr(t * 0.045); u.uS1[3] = fr(t * 42 * 0.3 / a);
        // the game's alpha: 0.62 = sustained burn, 1 = flare. Opacity saturates early; the rest drives heat and height.
        const heat = Math.min(1.7, wa / 0.62) * flick;
        u.uMisc[0] = heat; u.uMisc[1] = Math.min(1, wa / 0.4);
        if (r.light) r.light.alpha = r.lightA * (0.7 + 0.3 * Math.min(1.4, heat)) * (0.86 + 0.14 * Math.sin(t * 9.1 + Math.sin(t * 2.3) * 2)) / Math.max(0.35, wa);
      }
      // sparks
      if (ff.worldVisible) {
        sparkAcc += SPARK_RATE * dt * Math.min(1.5, ff.worldAlpha / 0.62);
        while (sparkAcc >= 1) { sparkAcc -= 1; emitSpark(); }
      } else if (sparks.list.length) sparks.clear();
      sparks.update(dt);
      for (const p of sparks.list) {
        if (p.seed === undefined) continue;
        p.vx += Math.sin(p.phase * p.wf + p.seed) * 220 * dt;
        p.s.tint = lerpC(p.hot < 0.4 ? 0xfff4d0 : 0xffd27a, 0xff4a10, Math.min(1, p.life / p.max * 1.3));
      }
      // haze
      const want = !!haze && ff.worldVisible && ff.worldAlpha > 0.05;
      if (want !== hazeActive) { hazeActive = want; hazeOn(want); }
      if (hazeActive) {
        if (!(hazeHost.filters || []).includes(haze)) hazeOn(true);
        pt.set(0, YT - LT * 1.9); const top = ff.toGlobal(pt).y; pt.set(0, YT); const base = ff.toGlobal(pt).y;
        const sc = (base - top) / (LT * 1.9);
        haze.uniforms.uBand = [top, base, 3.2 * sc * Math.min(1, ff.worldAlpha / 0.5), sc];
        haze.uniforms.uScroll = [fr(t * 0.11), fr(t * 0.23)];
      }
    } catch (e) { console.warn("gx fire", e); }
  });

  // QA hooks (qa/gx_fire.mjs)
  window.GXFIRE = { rings, sparks, teaseOn: () => !!(tz && tz.worldVisible && tz.worldAlpha > 0.5), haze: () => hazeActive };
});
