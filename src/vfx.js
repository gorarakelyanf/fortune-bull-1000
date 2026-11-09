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
  VFX.flames = [];
  // a flame quad w x h whose palm (base) sits at (0,0) of the returned container
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
    // painted flipbook (vfx kit) replaces the noise shader: a hand-painted magic flame, base at the hand
    if (window.FX.tex.magicFrames) {
      const fb = new PIXI.AnimatedSprite(window.FX.tex.magicFrames);
      fb.anchor.set(0.5, 0.86); fb.blendMode = PIXI.BLEND_MODES.NORMAL; fb.animationSpeed = 0.36; fb.gotoAndPlay(Math.floor(Math.random() * 16));
      fb.tint = 0xfff0e0; fb.baseS = (h * 0.95) / 256; fb.scale.set(fb.baseS); c.addChild(fb); c.fb = fb;
      glow.tint = 0xff7a20; glow.scale.set(w / 210, h / 300); aura.tint = 0x7a2cc8;
      m.visible = false; ring.visible = false;
    }
    const orbit = [];
    for (let k = 0; k < 3; k++) {
      const sp = new PIXI.Sprite(window.FX.tex.star8); sp.anchor.set(0.5); sp.blendMode = PIXI.BLEND_MODES.ADD;
      sp.tint = k === 1 ? 0xffffff : k ? 0xffd27a : 0xd9a0ff; c.addChild(sp); orbit.push(sp);
    }
    parent.addChild(c);
    c.mesh = m; c.glow = glow; c.aura = aura; c.ring = ring; c.orbit = orbit; c.fw = w; c.fh = h; c.power = 1;
    c.setRim = (rgb) => {
      sh.uniforms.uRim = rgb;
      if (c.fb) {                       // tint the painted flame toward the rim colour, keeping its hot core
        const v = rgb[0] > 0.55 && rgb[2] > 0.9 && rgb[1] < 0.4;           // the default violet = untinted
        const k = (x, w) => Math.round(255 * (v ? w : 0.45 + 0.55 * x));
        if (v) { c.fb.tint = 0xfff0e0; return; }
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
      if (!c.fb) {                                   // the painted flame sets its own (lower) glow above
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
