// Fortune Bull 1000 - high-end screen VFX (pixi-filters on the whole stage) + magic hand flame shader.
// Post filters are only attached while an effect runs, so idle frames cost nothing.
(function () {
  const VFX = {};
  let app, root, lite = false, scaleFn = () => 1;
  const active = new Set();
  let bloom = null, bloomRef = 0, bloomTw = null, world = null;

  function sync() {
    const list = [];
    if (bloom && bloomRef > 0) list.push(bloom);
    active.forEach((f) => list.push(f));
    (world || app.stage).filters = list.length ? list : null;
  }
  // stage filters act on this container only (the scene and board); UI, effect overlay and popups stay crisp
  VFX.setWorld = function (w) { world = w; w.filterArea = app.screen; app.stage.filters = null; };
  // design point (1080x1920 space) -> screen px (the stage filter frame is the whole screen)
  function toScreen(x, y) { const p = root.toGlobal(new PIXI.Point(x, y)); return [p.x, p.y]; }

  VFX.init = function (o) {
    app = o.app; root = o.root; lite = !!o.lite;
    scaleFn = () => root.scale.x;
    app.stage.filterArea = app.screen;
    const F = PIXI.filters;
    if (!lite && F.AdvancedBloomFilter) {
      bloom = new F.AdvancedBloomFilter({ threshold: 0.74, bloomScale: 0, brightness: 1, blur: 6, quality: 5 });
    }
  };

  // expanding displacement ring (impacts, slams, tier-ups)
  // budget (critique #1): screen distortion stays small and short, so information never bends or smears
  VFX.shockwave = function (x, y, o) {
    o = Object.assign({}, o || {});
    o.amp = Math.min(12, (o.amp || 26) * 0.32); o.dur = Math.min(0.45, o.dur || 0.75);
    if (!PIXI.filters.ShockwaveFilter || active.size > 6) return;
    const s = scaleFn();
    const f = new PIXI.filters.ShockwaveFilter(toScreen(x, y), {
      amplitude: (o.amp || 26) * s, wavelength: (o.wave || 150) * s, speed: (o.speed || 1300) * s,
      brightness: o.bright || 1.12, radius: (o.radius || 900) * s }, 0);
    active.add(f); sync();
    const st = { t: 0, a: f.amplitude };
    gsap.to(st, { t: o.dur || 0.75, duration: o.dur || 0.75, ease: "none", onUpdate: () => {
      f.time = st.t; f.amplitude = st.a * (1 - st.t / (o.dur || 0.75));
    }, onComplete: () => { active.delete(f); sync(); } });
  };
  // radial zoom blur punch (popup entry, slam)
  VFX.zoomPunch = function (x, y, strength, dur) {
    if (lite || !PIXI.filters.ZoomBlurFilter) return;
    strength = Math.min(0.06, (strength || 0.18) * 0.3); dur = Math.min(0.12, dur || 0.4);
    const f = new PIXI.filters.ZoomBlurFilter({ strength: strength || 0.18, center: toScreen(x, y), innerRadius: 60 * scaleFn(), maxKernelSize: 24 });
    active.add(f); sync();
    gsap.to(f, { strength: 0, duration: dur || 0.4, ease: "power2.out", onComplete: () => { active.delete(f); sync(); } });
  };
  // chromatic aberration flash
  VFX.rgbFlash = function (px, dur) {
    if (!PIXI.filters.RGBSplitFilter) return;
    if ((px || 10) < 12) return;                       // only the very biggest moment, and then barely
    px = 3; dur = 0.06;
    const k = (px || 10) * scaleFn();
    const f = new PIXI.filters.RGBSplitFilter([-k, 0], [0, k * 0.6], [k * 0.4, -k * 0.4]);
    active.add(f); sync();
    const st = { v: 1 };
    gsap.to(st, { v: 0, duration: dur || 0.3, ease: "power2.out", onUpdate: () => {
      f.red = [-k * st.v, 0]; f.green = [0, k * 0.6 * st.v]; f.blue = [k * 0.4 * st.v, -k * 0.4 * st.v];
    }, onComplete: () => { active.delete(f); sync(); } });
  };
  // bloom: reference-counted (feature fire, popup); fades in/out
  VFX.bloom = function (on, amount) {
    if (!bloom) return;
    bloomRef = Math.max(0, bloomRef + (on ? 1 : -1));
    if (bloomTw) bloomTw.kill();
    const target = bloomRef > 0 ? (amount || 0.9) : 0;
    if (bloomRef > 0) sync();
    bloomTw = gsap.to(bloom, { bloomScale: target, duration: 0.5, onComplete: () => { if (bloomRef === 0) sync(); } });
  };
  // god rays layer: a black additive sprite filled with procedural light shafts (popup background)
  VFX.godrays = function (parent, o) {
    o = o || {};
    if (lite || !PIXI.filters.GodrayFilter) return null;
    const sp = new PIXI.Sprite(PIXI.Texture.WHITE);
    sp.tint = 0x000000; sp.width = 1080 + 400; sp.height = 1920 + 400; sp.position.set(-200, -200);
    sp.blendMode = PIXI.BLEND_MODES.ADD;
    const g = new PIXI.filters.GodrayFilter({ angle: 30, gain: o.gain || 0.55, lacunarity: 2.6, parallel: false, center: [0, 0], alpha: 1 });
    const cm = new (PIXI.ColorMatrixFilter || PIXI.filters.ColorMatrixFilter)();
    sp.filters = [g, cm];
    parent.addChild(sp);
    sp.setTint = (hex) => {
      const r = ((hex >> 16) & 255) / 255, gg = ((hex >> 8) & 255) / 255, b = (hex & 255) / 255;
      cm.matrix = [r, 0, 0, 0, 0, 0, gg, 0, 0, 0, 0, 0, b, 0, 0, 0, 0, 0, 1, 0];
    };
    sp.setTint(o.tint || 0xffc860);
    sp.update = (time, cx, cy) => {
      g.time = time * 0.35;
      // the filter frame is this sprite's screen bounds: convert the design-space light source into it
      const b = sp.getBounds(), p = root.toGlobal(new PIXI.Point(cx, cy));
      g.center = [p.x - b.x, p.y - b.y];
    };
    return sp;
  };

  // ---------- magic flame (GPU): a living fire in the bull's hand ----------
  const VERT = `
    attribute vec2 aVertexPosition; attribute vec2 aUvs;
    uniform mat3 translationMatrix; uniform mat3 projectionMatrix;
    varying vec2 vUv;
    void main(){ vUv = aUvs; gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0); }`;
  const FRAG = `
    precision mediump float;
    varying vec2 vUv;
    uniform float uTime; uniform float uAlpha; uniform float uSeed; uniform float uPower; uniform vec3 uRim;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.03 + 1.3; a *= 0.5; } return v; }
    void main(){
      vec2 p = vUv * 2.0 - 1.0; p.y = -p.y;                  // -1..1, y up
      float t = uTime + uSeed;
      float y = p.y + 0.62;                                   // 0 at the palm
      float n = fbm(vec2(p.x * 2.4, y * 1.7 - t * 2.8));
      float n2 = fbm(vec2(p.x * 5.0 + 7.0, y * 3.2 - t * 4.4));
      float w = (0.58 * (1.0 - smoothstep(-0.2, 1.5, y)) + 0.1) * (0.72 + 0.55 * n);
      float dx = abs(p.x + (n2 - 0.5) * 0.42 * max(y, 0.0));
      float body = clamp(1.0 - dx / w, 0.0, 1.0);
      float vert = smoothstep(-0.32, 0.06, y) * (1.0 - smoothstep(0.55 + 0.55 * n, 1.5, y));
      float f = body * vert;
      vec2 cq = p - vec2(0.0, -0.42);
      float core = exp(-dot(cq, cq) * 8.0);
      f = max(f, core * 0.95);
      f = clamp(f * (0.65 + 0.7 * n2) * uPower, 0.0, 1.0);
      f = f * f * (3.0 - 2.0 * f);
      vec3 hot = vec3(1.0, 0.97, 0.82), mid = vec3(1.0, 0.56, 0.12);
      vec3 col = mix(uRim, mid, smoothstep(0.22, 0.55, f));
      col = mix(col, hot, smoothstep(0.66, 0.97, f));
      // magic halo: a coloured rim around the fire body
      float halo = smoothstep(0.0, 0.18, f) * (1.0 - smoothstep(0.18, 0.5, f));
      vec3 outc = col * f + uRim * halo * 0.6;
      gl_FragColor = vec4(outc * uAlpha, 0.0);
    }`;
  // WHITE VERSION plasma orb (user 2026-11-11: "redesign the hand magic to make it very aesthetic"): a lit sphere whose
  // surface churns with domain-warped plasma (bright filaments), a hot core, a fiery fresnel rim and a flickering corona.
  // Bulged (sphere-projected) noise instead of a rotating globe: no seam. Premultiplied output, NORMAL blend.
  const ORB_FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    uniform float uTime; uniform float uPower; uniform float uSeed; uniform float uAlpha; uniform vec3 uTint;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * noise(p); p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; } return v; }
    vec4 over(vec4 top, vec4 under){ return top + under * (1.0 - top.a); }
    // one tilted orbit ring (an ellipse seen from slightly above) with a comet running round it; back = the far half
    vec4 ring(vec2 p, float th, float e, float rr, float spd, float t, float back, float sphereA){
      float cs = cos(th), sn = sin(th);
      vec2 q = vec2(cs * p.x + sn * p.y, -sn * p.x + cs * p.y);
      float L = length(vec2(q.x, q.y / e));
      float g = length(vec2(q.x, q.y / (e * e))) / max(L, 1e-3);
      float d = (L - rr) / max(g, 1e-3);
      float far = step(q.y, 0.0);
      float side = back > 0.5 ? far : 1.0 - far;
      float ang = atan(q.y / e, q.x);
      float ph = mod(t * spd - ang, 6.2832);
      float comet = exp(-ph * 1.4);
      float line = exp(-d * d / 0.0028) * (0.55 + 0.3 * sin(ang * 7.0 + t * 1.3)) + exp(-d * d / 0.012) * comet * 1.6;
      line *= side * (back > 0.5 ? (1.0 - sphereA) * 0.6 : 1.0);
      vec3 c = mix(vec3(1.0, 0.62, 0.18), vec3(1.0, 0.96, 0.8), clamp(comet * 1.5, 0.0, 1.0));
      return vec4(c * line, clamp(line * 0.7, 0.0, 1.0));
    }
    void main(){
      vec2 p = (vUv - 0.5) * 3.4;
      float r = length(p);
      float t = uTime + uSeed;
      vec3 crim = vec3(0.26, 0.01, 0.02), red = vec3(0.80, 0.10, 0.02), org = vec3(1.0, 0.44, 0.06), gold = vec3(1.0, 0.80, 0.34), wht = vec3(1.0, 0.97, 0.88);
      float up = 0.5 - 0.5 * p.y / max(r, 1e-3);

      // halo + flame corona licking upward
      float ang = atan(p.y, p.x);
      float tn = fbm(vec2(ang * 2.6 + 10.0, r * 2.3 - t * 1.25));
      float tn2 = fbm(vec2(ang * 5.0 - 3.0, r * 3.4 - t * 1.8));
      float o = max(r - 1.0, 0.0);
      float cor = exp(-o / (0.07 + 0.32 * tn * tn2 * 1.6 * (0.45 + 0.9 * up) * (0.85 + 0.2 * uPower))) * smoothstep(0.95, 1.0, r);
      float ca = clamp(cor * (0.7 + 0.6 * tn2), 0.0, 1.0);
      float halo = exp(-o * 3.6) * smoothstep(1.7, 1.2, r) * step(1.0, r) * (0.38 + 0.1 * uPower);
      vec4 acc = vec4(org * halo, halo * 0.55);
      acc = over(vec4(mix(red, gold, cor) * ca, ca * 0.85), acc);

      // the sphere
      float a = smoothstep(1.0, 0.965, r);
      vec4 sph = vec4(0.0);
      if (r < 1.0) {
        float z = sqrt(1.0 - r * r);
        vec3 n = vec3(p, z);
        vec2 sp = p / (z + 0.6);
        vec2 w = vec2(fbm(sp * 1.2 + vec2(t * 0.12, -t * 0.07)), fbm(sp * 1.2 + vec2(-t * 0.09, t * 0.11) + 5.2));
        float f = fbm(sp * 1.7 + w * 1.9 + vec2(0.0, -t * 0.06));
        float s1 = 1.0 - abs(sin((f * 4.0 - t * 0.3) * 3.14159)); float v1 = pow(s1, 7.0) + pow(s1, 2.0) * 0.18;
        float v2 = pow(1.0 - abs(sin((f * 2.6 + w.x * 2.0 + t * 0.21) * 3.14159)), 10.0);
        vec3 col = mix(crim, red, smoothstep(0.0, 0.55, z));
        col = mix(col, org, smoothstep(0.4, 0.97, z) * (0.55 + 0.45 * f));
        col += gold * (v1 * 1.25 + v2 * 0.7) * (0.45 + 0.55 * z) * (0.8 + 0.3 * uPower);
        col += mix(gold, wht, 0.6) * pow(z, 4.0) * (0.42 + 0.2 * uPower);
        col += mix(org, gold, 0.55) * pow(1.0 - z, 3.0) * 1.7;
        vec3 H = normalize(normalize(vec3(-0.5, -0.65, 0.6)) + vec3(0.0, 0.0, 1.0));
        float nh = max(dot(n, H), 0.0);
        col += wht * (pow(nh, 90.0) * 0.9 + pow(nh, 9.0) * 0.1);
        sph = vec4(col * a, a);
      }

      float pr = 0.12 * sin(t * 0.31);
      acc = over(ring(p, -0.38 + pr, 0.3, 1.34, 1.5, t, 1.0, a), acc);
      acc = over(ring(p, 0.62 - pr, 0.2, 1.5, -1.1, t + 2.0, 1.0, a) * 0.55, acc);
      acc = over(sph, acc);
      acc = over(ring(p, -0.38 + pr, 0.3, 1.34, 1.5, t, 0.0, a), acc);
      acc = over(ring(p, 0.62 - pr, 0.2, 1.5, -1.1, t + 2.0, 0.0, a) * 0.55, acc);
      gl_FragColor = vec4(acc.rgb * uTint, acc.a) * uAlpha;
    }`;
  // WHITE VERSION molten frame (user 2026-11-11: "design this frame as well"): the centre multiplier frame drawn in a
  // shader so it stays crisp at any size: two lit gold rims, a channel of flowing molten metal between them, two
  // sparks running round it, a tight heat halo, small flames licking up off it. Same palette as the hand orb.
  const FRAME_FRAG = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec2 vUv;
    uniform float uTime; uniform float uPower; uniform float uAlpha; uniform float uFlash; uniform float uP;
    uniform vec2 uQuad; uniform vec2 uB; uniform vec3 uGeo; uniform vec2 uScroll; uniform vec2 uC;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int k = 0; k < 3; k++) { v += a * noise(p); p = p * 2.07 + vec2(1.7, 9.2); a *= 0.5; } return v; }
    // value noise that repeats every "per" cells along x: the pattern closes round the frame without a seam
    float pnoise(vec2 p, float per){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      float x0 = mod(i.x, per), x1 = mod(i.x + 1.0, per);
      return mix(mix(hash(vec2(x0, i.y)), hash(vec2(x1, i.y)), f.x), mix(hash(vec2(x0, i.y + 1.0)), hash(vec2(x1, i.y + 1.0)), f.x), f.y); }
    float pfbm(vec2 p, float per){ float v = 0.0, a = 0.5; for (int k = 0; k < 3; k++) { v += a * pnoise(p, per); p = p * 2.0 + vec2(0.0, 7.3); per *= 2.0; a *= 0.5; } return v; }
    float sdRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    vec2 gradRR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; vec2 sg = sign(p);
      if (q.x > 0.0 && q.y > 0.0) return normalize(q) * sg;
      return q.x > q.y ? vec2(sg.x, 0.0) : vec2(0.0, sg.y); }
    vec4 over(vec4 top, vec4 under){ return top + under * (1.0 - top.a); }
    void main(){
      vec2 p = (vUv - 0.5) * 2.0 * uQuad;
      float t = uTime, T = uGeo.y;
      vec3 crim = vec3(0.24, 0.01, 0.02), red = vec3(0.82, 0.10, 0.02), org = vec3(1.0, 0.44, 0.06), gold = vec3(1.0, 0.80, 0.34), wht = vec3(1.0, 0.97, 0.88);
      vec3 gD = vec3(0.50, 0.23, 0.03), gM = vec3(1.0, 0.70, 0.16), gL = vec3(1.0, 0.94, 0.62);
      float dO = sdRR(p, uB, uGeo.x), dI = sdRR(p, uB - T, uGeo.z);

      // s = arc length along the band's centre line (0 at the middle of the right side, runs all the way round)
      float rc = (uGeo.x + uGeo.z) * 0.5; vec2 h = uB - T * 0.5 - rc; vec2 q = abs(p);
      float Lq = uP * 0.25, sq;
      if (q.x > h.x && q.y > h.y) sq = h.y + rc * atan(q.y - h.y, q.x - h.x);
      else if (q.x - h.x > q.y - h.y) sq = min(q.y, h.y);
      else sq = h.y + rc * 1.5708 + (h.x - min(q.x, h.x));
      float s = p.x >= 0.0 ? (p.y >= 0.0 ? sq : uP - sq) : (p.y >= 0.0 ? 2.0 * Lq - sq : 2.0 * Lq + sq);
      float ph1 = mod(uC.x - s, uP), ph2 = mod(s - uC.y, uP);                           // distance behind each spark's head
      // user 2026-11-11: "frame color line animation should be removed, simply make the lava glow and subtle animation":
      // no running sparks and no travelling glint; the molten channel boils slowly and the whole frame breathes
      float com = 0.0 * (ph1 + ph2);
      float br = 0.5 + 0.5 * sin(t * 1.25) * 0.8 + 0.1 * sin(t * 2.9 + 1.3);

      // outside: heat halo + small flames licking upward; inside the hole: a warm spill on the chip's edge
      float o = max(dO, 0.0), outside = step(0.0, dO);
      float top = smoothstep(-0.2, 1.0, -p.y / uB.y);
      float fl = fbm(vec2(p.x * 0.05, p.y * 0.06 + t * 0.55)), fl2 = fbm(vec2(p.x * 0.11 + 5.0, p.y * 0.1 + t * 0.8));
      float reach = (3.0 + 9.0 * fl * fl2 * (0.4 + 0.6 * top)) * (0.8 + 0.25 * uPower);
      float cor = exp(-o / reach) * outside;
      float ca = clamp(cor * (0.35 + 0.4 * fl2), 0.0, 1.0);
      float halo = (exp(-o / 11.0) * (0.3 + 0.14 * br + 0.1 * uPower + 0.5 * uFlash) + exp(-o / 5.0) * com * 0.5) * outside;
      vec4 acc = vec4(mix(red, org, 0.55) * halo, halo * 0.5);
      acc = over(vec4(mix(red, gold, cor) * ca, ca * 0.8), acc);
      float ig = exp(-max(-dI, 0.0) / 7.0) * step(dI, 0.0) * (0.26 + 0.1 * br + 0.1 * uPower + 0.5 * uFlash) + exp(-max(-dI, 0.0) / 4.0) * step(dI, 0.0) * com * 0.4;
      acc += vec4(mix(org, gold, 0.45) * ig, ig * 0.35);

      float a = smoothstep(0.8, -0.8, dO) * smoothstep(-0.8, 0.8, dI);
      if (a > 0.0) {
        float u = clamp(-dO / max(dI - dO, 1e-3), 0.0, 1.0);                // 0 at the outer edge .. 1 at the inner edge
        vec2 g = gradRR(p, uB, uGeo.x);
        float rw = 0.18;
        // molten channel between the rims
        float cu = clamp((u - rw) / (1.0 - 2.0 * rw), 0.0, 1.0), cnz = sin(cu * 3.14159);
        float sx = s / uP;
        float m1 = pfbm(vec2(sx * 20.0 - uScroll.x, cu * 1.6 + t * 0.11), 20.0);
        float m2 = pfbm(vec2(sx * 40.0 + uScroll.y, cu * 2.2 + 3.7), 40.0);
        float heat = clamp(1.5 * m1 - 0.1 + 0.18 * cnz + 0.12 * br + 0.18 * (uPower - 1.0) + 0.7 * uFlash, 0.0, 1.3);
        float vein = pow(1.0 - abs(sin((m1 * 2.5 + m2 * 1.5) * 3.14159)), 9.0);
        vec3 lava = mix(crim, red, smoothstep(0.1, 0.42, heat));
        lava = mix(lava, org, smoothstep(0.38, 0.66, heat));
        lava = mix(lava, gold, smoothstep(0.62, 0.92, heat));
        lava = mix(lava, wht, smoothstep(0.95, 1.4, heat));
        lava += gold * vein * 0.1;
        lava *= 0.55 + 0.45 * cnz;                                          // sunk between the rims
        // gold rims: each a small rounded bead lit from the top left
        float rim = max(1.0 - smoothstep(rw - 0.05, rw + 0.03, u), smoothstep(1.0 - rw - 0.03, 1.0 - rw + 0.05, u));
        float ru = clamp((u < 0.5 ? u : 1.0 - u) / rw, 0.0, 1.0), rb = 1.0 - 2.0 * ru;
        vec3 n = normalize(vec3(g * rb * (u < 0.5 ? 1.0 : -1.0), sqrt(max(1.0 - rb * rb, 0.0)) + 0.35));
        vec3 L = normalize(vec3(-0.45, -0.7, 0.55));
        float diff = max(dot(n, L), 0.0), spec = pow(max(dot(n, normalize(L + vec3(0.0, 0.0, 1.0))), 0.0), 26.0);
        vec3 metal = mix(gD, gM, clamp(diff * 1.15 + 0.22, 0.0, 1.0)) + gL * spec * 0.85;
        metal += org * (0.1 + 0.55 * com + 0.6 * uFlash);                               // the gold takes the heat's colour
        vec3 col = mix(lava, metal, rim);
        col += wht * com * 0.95 * pow(cnz, 1.5) * (1.0 - rim) + gL * com * 0.4 * rim;       // white-hot in the channel, a warm gleam on the gold
        acc = over(vec4(col * a, a), acc);
      }
      float edge = min(uQuad.x - abs(p.x), uQuad.y - abs(p.y));
      gl_FragColor = acc * smoothstep(0.0, 8.0, edge) * uAlpha;
    }`;
  VFX.frames = [];
  // o = { x, y, w, h (outer size), r (outer corner radius), band (thickness), ri (inner corner radius) }; returns { power, flash }
  VFX.moltenFrame = function (parent, o) {
    const m = 42, qx = o.w / 2 + m, qy = o.h / 2 + m, rc = (o.r + o.ri) / 2;
    const P = 4 * ((o.h - o.band) / 2 - rc + rc * Math.PI / 2 + (o.w - o.band) / 2 - rc);
    const geo = new PIXI.Geometry()
      .addAttribute("aVertexPosition", [-qx, -qy, qx, -qy, qx, qy, -qx, qy], 2)
      .addAttribute("aUvs", [0, 0, 1, 0, 1, 1, 0, 1], 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
    const sh = PIXI.Shader.from(VERT, FRAME_FRAG, { uTime: 0, uPower: 1, uAlpha: 1, uFlash: 0, uP: P, uQuad: [qx, qy], uB: [o.w / 2, o.h / 2],
      uGeo: [o.r, o.band, o.ri], uScroll: [0, 0], uC: [0, P / 2] });
    const mesh = new PIXI.Mesh(geo, sh); mesh.position.set(o.x, o.y); parent.addChild(mesh);
    const f = { mesh, sh, P, power: 1, flash: 0, s1: 0, s2: P / 2 };
    VFX.frames.push(f); return f;
  };
  VFX.flames = [];
  // a flame quad w x h whose palm (base) sits at (0,0) of the returned container
  VFX.ORB = true;                    // white version: the hand holds a magic orb instead of a flame
  VFX.magicFlame = function (parent, w, h, rim) {
    const c = new PIXI.Container();
    const geo = new PIXI.Geometry()
      .addAttribute("aVertexPosition", [-w / 2, -h * 0.81, w / 2, -h * 0.81, w / 2, h * 0.19, -w / 2, h * 0.19], 2)
      .addAttribute("aUvs", [0, 0, 1, 0, 1, 1, 0, 1], 2)
      .addIndex([0, 1, 2, 0, 2, 3]);
    const sh = PIXI.Shader.from(VERT, FRAG, { uTime: 0, uAlpha: 1, uSeed: Math.random() * 40, uPower: 1, uRim: rim || [0.6, 0.28, 1.0] });
    const m = new PIXI.Mesh(geo, sh); m.blendMode = PIXI.BLEND_MODES.ADD;
    const glow = new PIXI.Sprite(window.FX.tex.glow); glow.anchor.set(0.5); glow.position.set(0, -h * 0.18);
    glow.scale.set(w / 150, h / 210); glow.tint = 0xff9a30; glow.blendMode = PIXI.BLEND_MODES.ADD; glow.alpha = 0.55;
    const aura = new PIXI.Sprite(window.FX.tex.glow); aura.anchor.set(0.5); aura.position.set(0, -h * 0.25);
    aura.scale.set(w / 85, h / 130); aura.tint = 0x9a3cff; aura.blendMode = PIXI.BLEND_MODES.ADD; aura.alpha = 0.35;
    const ring = new PIXI.Sprite(window.FX.tex.burst); ring.anchor.set(0.5); ring.position.set(0, -h * 0.02);
    ring.scale.set(w / 900, w / 2600); ring.tint = 0xc78cff; ring.blendMode = PIXI.BLEND_MODES.ADD; ring.alpha = 0.55;
    c.addChild(aura, glow, ring, m);
    // WHITE VERSION (user 2026-11-11): "the hand should have a magical spherical glow form with particles, not fire":
    // a magic orb above the palm - pulsing white-cyan core, blue-violet shell, two tilted energy rings, orbiting motes
    if (VFX.ORB) {
      const T = window.FX.tex, oy = -h * 0.285, R = w * 0.255, Q = R * 1.7;
      const og = new PIXI.Geometry()
        .addAttribute("aVertexPosition", [-Q, -Q, Q, -Q, Q, Q, -Q, Q], 2)
        .addAttribute("aUvs", [0, 0, 1, 0, 1, 1, 0, 1], 2)
        .addIndex([0, 1, 2, 0, 2, 3]);
      const osh = PIXI.Shader.from(VERT, lite ? ORB_FRAG.replace("k < 4", "k < 3") : ORB_FRAG, {   // phones: 3 noise octaves
        uTime: 0, uPower: 1, uSeed: Math.random() * 40, uAlpha: 1, uTint: [1, 1, 1] });
      const orbM = new PIXI.Mesh(og, osh); orbM.position.set(0, oy);
      const bloom = new PIXI.Sprite(T.glow); bloom.anchor.set(0.5); bloom.position.set(0, oy); bloom.blendMode = PIXI.BLEND_MODES.ADD;
      bloom.tint = 0xff6418; bloom.baseS = (R * 3.2) / 128;
      const motes = [];
      for (let k = 0; k < 9; k++) { const sp = new PIXI.Sprite(k % 4 ? T.dot : T.star8); sp.anchor.set(0.5); sp.blendMode = PIXI.BLEND_MODES.ADD;
        sp.tint = k % 2 ? 0xffe9a0 : 0xffa030; sp.k = k; sp.life = 1.5 + (k % 3) * 0.45; sp.x0 = ((k * 0.618) % 1 - 0.5) * R * 1.3; motes.push(sp); }   // rising embers
      c.addChild(bloom, orbM, ...motes);
      glow.visible = false; aura.tint = 0xff4010; aura.position.set(0, oy); m.visible = false; ring.visible = false;
      c.orb = { orbM, osh, bloom, motes, oy, R };
    } else if (window.FX.tex.magicFrames) {
      const fb = new PIXI.AnimatedSprite(window.FX.tex.magicFrames);
      fb.anchor.set(0.5, 0.86); fb.blendMode = PIXI.BLEND_MODES.NORMAL; fb.animationSpeed = 0.36; fb.gotoAndPlay(Math.floor(Math.random() * 16));
      fb.tint = 0xffffff; fb.baseS = (h * 0.95) / 256; fb.scale.set(fb.baseS); c.addChild(fb); c.fb = fb;
      glow.tint = 0x5ab8ff; glow.scale.set(w / 210, h / 300); aura.tint = 0x8a4cff;
      m.visible = false; ring.visible = false;
    }
    const orbit = [];
    for (let k = 0; k < (VFX.ORB ? 0 : 3); k++) {
      const sp = new PIXI.Sprite(window.FX.tex.star8); sp.anchor.set(0.5); sp.blendMode = PIXI.BLEND_MODES.ADD;
      sp.tint = k === 1 ? 0xffffff : k ? 0x9fe8ff : 0xd9a0ff; c.addChild(sp); orbit.push(sp);
    }
    parent.addChild(c);
    c.mesh = m; c.glow = glow; c.aura = aura; c.ring = ring; c.orbit = orbit; c.fw = w; c.fh = h; c.power = 1;
    c.setRim = (rgb) => {
      sh.uniforms.uRim = rgb;
      if (c.orb) {                      // event tints shift the plasma colour; the default violet = the orb's own fire
        const v = rgb[0] > 0.55 && rgb[2] > 0.9 && rgb[1] < 0.4;
        c.orb.osh.uniforms.uTint = v ? [1, 1, 1] : [0.55 + 0.45 * rgb[0], 0.55 + 0.45 * rgb[1], 0.55 + 0.45 * rgb[2]];
        return;
      }
      if (c.fb) {                       // tint the painted flame toward the rim colour, keeping its hot core
        const v = rgb[0] > 0.55 && rgb[2] > 0.9 && rgb[1] < 0.4;           // the default violet = untinted
        const k = (x, w) => Math.round(255 * (v ? w : 0.45 + 0.55 * x));
        if (v) { c.fb.tint = 0xffffff; return; }
        c.fb.tint = (k(rgb[0]) << 16) | (k(rgb[1]) << 8) | k(rgb[2]);
      }
    };
    VFX.flames.push(c);
    return c;
  };
  // smooth non-repeating flicker in -1..1 (three detuned sines, irrational ratios)
  const nz = (t, s) => (Math.sin(t * 1.0 + s) * 0.5 + Math.sin(t * 2.618 + s * 1.7) * 0.3 + Math.sin(t * 6.283 + s * 2.3) * 0.2);
  let lastT = 0;
  VFX.update = function (time) {
    const dt = Math.min(0.05, Math.max(0.001, time - lastT)); lastT = time;
    for (let i = VFX.frames.length - 1; i >= 0; i--) {             // white: the molten centre frame
      const f = VFX.frames[i], u = f.sh.uniforms;
      if (f.mesh.destroyed) { VFX.frames.splice(i, 1); continue; }
      const v = 120 + 70 * (f.power - 1);                           // sparks: px per second round the frame
      f.s1 = (f.s1 + dt * v) % f.P; f.s2 = (f.s2 - dt * v * 0.8 + f.P) % f.P;
      f.flash = Math.max(0, f.flash - dt * 3.5);
      u.uTime = time % 600; u.uPower = f.power; u.uFlash = f.flash; u.uAlpha = f.mesh.worldVisible ? f.mesh.worldAlpha : 0;
      u.uScroll[0] = (time * 0.05) % 20; u.uScroll[1] = (time * 0.08) % 40; u.uC[0] = f.s1; u.uC[1] = f.s2;
    }
    for (let i = VFX.flames.length - 1; i >= 0; i--) {
      const c = VFX.flames[i];
      if (c.destroyed) { VFX.flames.splice(i, 1); continue; }
      const u = c.mesh.shader.uniforms, sd = u.uSeed;
      u.uTime = time; u.uPower = c.power; u.uAlpha = c.worldVisible ? c.worldAlpha : 0;
      // secondary motion: the fire trails the hand. Velocity of the flame base (world px/s) -> a sprung lean + stretch
      const gp = c.worldVisible ? c.getGlobalPosition(undefined, true) : null;
      if (gp && c.px != null) {
        const vx = (gp.x - c.px) / dt, vy = (gp.y - c.py) / dt;
        c.vx = (c.vx || 0) + (vx - (c.vx || 0)) * Math.min(1, dt * 14); c.vy = (c.vy || 0) + (vy - (c.vy || 0)) * Math.min(1, dt * 14);
      }
      if (gp) { c.px = gp.x; c.py = gp.y; } else { c.px = null; c.vx = c.vy = c.lean = c.leanV = 0; }   // re-ignites upright
      if (Math.hypot(c.vx || 0, c.vy || 0) > 4000) c.vx = c.vy = 0;                                          // a teleport, not a move
      const leanT = Math.max(-0.55, Math.min(0.55, -(c.vx || 0) * 0.0011));
      c.leanV = ((c.leanV || 0) + (leanT - (c.lean || 0)) * 90 * dt) * Math.exp(-9 * dt);   // spring, slightly under-damped
      c.lean = (c.lean || 0) + c.leanV * dt;
      const speed = Math.min(1, Math.hypot(c.vx || 0, c.vy || 0) / 1400);
      if (c.fb) {
        const pw = Math.min(2.2, c.power), f1 = nz(time * 3.1, sd), f2 = nz(time * 4.3, sd + 5), f3 = nz(time * 1.7, sd + 11);
        c.fb.alpha = Math.min(0.97, (0.45 + pw * 0.45) * (0.93 + 0.07 * f1));
        c.fb.scale.set(c.fb.baseS * (0.82 + 0.18 * pw) * (1 + 0.05 * f2 - 0.12 * speed),
          c.fb.baseS * (0.78 + 0.22 * pw) * (1 + 0.08 * f1 + 0.28 * speed));
        c.fb.rotation = c.lean + 0.05 * f3;
        c.fb.skew.x = c.lean * 0.35;
        c.fb.animationSpeed = 0.3 + 0.06 * (f2 + 1) + 0.12 * speed;
        c.glow.alpha = (0.2 + 0.06 * f1) * Math.min(1.3, pw); c.aura.alpha = (0.16 + 0.05 * f3) * Math.min(1.4, pw);
        c.glow.rotation = c.lean * 0.6; c.aura.rotation = c.lean * 0.4;
      }
      if (c.orb) {                                   // white: the plasma orb churns, breathes, sparks orbit it in 3D
        const o = c.orb, pw = Math.min(2.2, c.power), f1 = nz(time * 2.3, sd);
        const lx = c.lean * c.fh * 0.25, ou = o.osh.uniforms;
        ou.uTime = time % 600; ou.uPower = pw; ou.uAlpha = c.worldVisible ? 1 : 0;
        o.orbM.x = lx; o.orbM.scale.set((0.92 + 0.08 * Math.min(1.5, pw)) * (1 + 0.02 * f1));
        o.bloom.x = lx; o.bloom.scale.set(o.bloom.baseS * (0.9 + 0.1 * pw) * (1 + 0.04 * f1)); o.bloom.alpha = Math.min(0.4, 0.16 + 0.1 * pw);
        o.motes.forEach((sp) => {                                       // embers drift up off the orb and fade
          const ph = ((time + sp.k * 0.53 * sp.life) / sp.life) % 1;
          sp.position.set(lx + sp.x0 * (1 - 0.4 * ph) + Math.sin(ph * 5 + sp.k * 1.7) * o.R * 0.18, o.oy - o.R * (0.55 + 2.1 * ph));
          sp.alpha = Math.sin(Math.PI * Math.min(1, ph * 1.4)) * 0.9;
          sp.scale.set((0.085 - 0.05 * ph) * Math.min(1.4, 0.75 + 0.25 * pw));
        });
        c.aura.alpha = (0.1 + 0.04 * f1) * Math.min(1.4, pw);
      }
      if (!c.fb && !c.orb) {                         // the painted flame sets its own (lower) glow above
        c.glow.alpha = (0.45 + 0.12 * nz(time * 3.3, sd)) * Math.min(1.4, c.power);
        c.aura.alpha = (0.28 + 0.1 * nz(time * 1.4, sd + 3)) * Math.min(1.5, c.power);
      }
      c.ring.rotation = time * 1.6; c.ring.alpha = 0.4 + 0.2 * nz(time * 1.9, sd);
      // sparks: each rises from the flame on its own wandering path, fades, and respawns with a new random lane
      c.orbit.forEach((sp, k) => {
        const life = 0.9 + 0.35 * k, ph = (time / life + k * 0.37 + sd) % 1, cyc = Math.floor(time / life + k * 0.37 + sd);
        if (sp.cyc !== cyc) { sp.cyc = cyc; sp.lane = (Math.random() - 0.5) * c.fw * 0.5; sp.drift = (Math.random() - 0.5) * c.fw * 0.35; }
        sp.position.set(sp.lane + sp.drift * ph + Math.sin(time * 5 + k * 2) * 6 + c.lean * c.fh * 0.5 * ph, -c.fh * (0.15 + 0.6 * ph));
        sp.scale.set((0.09 + 0.04 * nz(time * 4, k)) * (1 - ph * 0.6) * Math.min(1.5, c.power));
        sp.alpha = Math.sin(ph * Math.PI);
      });
    }
  };

  window.VFX = VFX;
})();
