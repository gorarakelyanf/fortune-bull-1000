// Fortune Bull 1000 - WebAudio engine for the processed audio pack (assets/audio/audio.json). Global: window.AUDIO.
// Graph: sfx bus (0.9) + music bus (0.5) -> duck -> sum -> gentle compressor -> makeup trim -> master -> speakers.
// - load() can run before any gesture: files are fetched at once and decoded once the context exists (init() or the
//   first tap/key creates it). AUDIO.ready turns true when every SFX and loop is decoded; music decodes after, one
//   track at a time, and a music() request waits for its track.
// - One-shots and loops are not queued while the context is suspended (before the first gesture, background tab):
//   play()/loop() return null then. Music is scheduled anyway and starts when the context runs.
// - Music loops by starting a second voice at loopStart and crossfading 2 s (equal power) around loopEnd, scheduled
//   on the audio clock one voice ahead. Tracks flagged "resume" in the manifest continue where they stopped when they
//   come back within 60 s (base after a big-win fanfare); others start from the top.
// - The context is suspended while the tab is hidden. Never throws: a missing file or a blocked context only warns.
(function () {
  "use strict";
  const AC = window.AudioContext || window.webkitAudioContext;
  const XF = 2.0;          // music loop crossfade, s
  const MAX_VOICES = 8;    // per sound name; the oldest is cut when exceeded
  const RESUME_S = 60;     // base/feature resume where they stopped if restarted within this time
  const COMP = { threshold: -6, knee: 6, ratio: 4, attack: 0.003, release: 0.25 }; // glue + clip guard on the sum
  const MAKEUP = 0.84;     // 1 / the compressor's built-in +1.55 dB makeup (measured in Edge: qa/audio_test.html, Compressor curve)
  const A = { ready: false };
  let ctx = null, bus = null, man = {}, names = [], base = "assets/audio/";
  const raw = {}, buf = {}, lead = {}, state = {}, voices = {}, lastPick = {}, paused = {};
  let vols = { master: 1, sfx: 0.9, music: 0.5 }, mute = false, ts = 1, cur = null, want = null;
  let musicBusy = false, fetchDone = false, loadP = null, loadRes = null, duckRel = 0.6, pumpT = null, hiddenStop = false;

  const warn = (...a) => { try { console.warn("[audio]", ...a); } catch (e) { /* no console */ } };
  const call = (fn) => { try { const p = ctx[fn](); if (p && p.catch) p.catch(() => {}); } catch (e) { /* old webkit */ } };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const num = (v, d) => (v == null || isNaN(+v) ? d : +v);
  const gainOf = (n) => num((man[n] || {}).gain, 1);
  const curve = (out) => { const c = new Float32Array(64); for (let i = 0; i < 64; i++) { const t = i / 63; c[i] = out ? Math.cos(t * Math.PI / 2) : Math.sin(t * Math.PI / 2); } return c; };
  const FADE_IN = curve(false), FADE_OUT = curve(true);

  function ramp(p, v, t) { // from the current value, cancelling what is scheduled
    const t0 = ctx.currentTime;
    try { const c = p.value; p.cancelScheduledValues(t0); p.setValueAtTime(c, t0); if (t > 0) p.linearRampToValueAtTime(v, t0 + t); else p.setValueAtTime(v, t0); }
    catch (e) { try { p.value = v; } catch (e2) { /* ignore */ } }
  }

  function graph() {
    const g = () => ctx.createGain();
    bus = { master: g(), sum: g(), post: g(), sfx: g(), music: g(), duck: g(), comp: ctx.createDynamicsCompressor() };
    const c = bus.comp; // single sounds pass almost untouched, stacked peaks get squeezed
    try { Object.keys(COMP).forEach((k) => { c[k].value = COMP[k]; }); } catch (e) { /* old impl */ }
    bus.post.gain.value = MAKEUP; // undo the compressor's automatic makeup, so quiet material passes at unity
    bus.sfx.connect(bus.sum); bus.music.connect(bus.duck); bus.duck.connect(bus.sum);
    bus.sum.connect(c); c.connect(bus.post); bus.post.connect(bus.master); bus.master.connect(ctx.destination);
    bus.sfx.gain.value = vols.sfx; bus.music.gain.value = vols.music; bus.master.gain.value = mute ? 0 : vols.master;
  }

  function unlockTick() { // iOS wants a source started inside the gesture
    try { const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0); } catch (e) { /* ignore */ }
  }

  A.init = function () {
    if (!AC) return false;
    try {
      if (!ctx) { ctx = new AC(); graph(); kick(); }
      if (ctx.state !== "running" && ctx.resume) call("resume");
      unlockTick();
    } catch (e) { warn("init failed:", e && e.message); return false; }
    return true;
  };
  const onGesture = () => { if (!ctx) A.init(); else if (ctx.state !== "running" && !hiddenStop) A.init(); };
  ["pointerdown", "pointerup", "touchend", "mousedown", "keydown", "click"].forEach((ev) => window.addEventListener(ev, onGesture, { capture: true, passive: true }));
  document.addEventListener("visibilitychange", () => { // pause in background tabs, carry on when back
    if (!ctx) return;
    if (document.hidden && ctx.state === "running" && ctx.suspend) { hiddenStop = true; call("suspend"); }
    else if (!document.hidden && hiddenStop) { hiddenStop = false; call("resume"); }
  });

  // ---------------------------------------------------------------- loading
  function decode(ab) {
    return new Promise((res, rej) => {
      let p;
      try { p = ctx.decodeAudioData(ab, res, rej); } catch (e) { rej(e); return; }
      if (p && p.then) p.then(res, rej); // promise form; the callbacks cover old Safari
    });
  }
  function scanLead(b) { // skip near-silence a decoder may have left in front (MP3 delay when not stripped)
    const d = b.getChannelData(0), n = Math.min(d.length, Math.floor(b.sampleRate * 0.1));
    for (let i = 0; i < n; i++) if (d[i] > 0.003 || d[i] < -0.003) return Math.max(0, i / b.sampleRate - 0.004);
    return 0;
  }
  const isMusic = (n) => (man[n] || {}).kind === "music";
  // Mobile memory: a decoded track is raw PCM (a 3-minute stereo track is ~65 MB), so music is decoded only when it is
  // about to play (the base track ahead of time), the compressed file is kept, and a long track that has been stopped
  // for RESUME_S is released (decoded again if it comes back). SFX stay decoded.
  const PRE_MUSIC = ["music_base"], RELEASE_LONGER = 60;
  const stoppedAt = {};
  function kick() { // decode what is fetched: SFX all at once, music one track at a time (wanted track first)
    if (!ctx) return;
    const todo = names.filter((n) => state[n] === "raw");
    const mus = todo.filter(isMusic).filter((n) => (want && want.name === n) || PRE_MUSIC.includes(n))
      .sort((a, b) => (want && a === want.name ? -1 : want && b === want.name ? 1 : 0));
    todo.filter((n) => !isMusic(n)).concat(musicBusy ? [] : mus.slice(0, 1)).forEach((n) => {
      state[n] = "decoding"; if (isMusic(n)) musicBusy = true;
      const ab = isMusic(n) ? raw[n].slice(0) : raw[n];               // decodeAudioData detaches its buffer
      decode(ab).then((b) => { buf[n] = b; state[n] = "ok"; if (!isMusic(n) && !man[n].loop) lead[n] = scanLead(b); },
        (e) => { state[n] = "fail"; warn("decode failed:", n, e && e.message); })
        .then(() => { if (!isMusic(n)) raw[n] = null; if (isMusic(n)) musicBusy = false; check(); kick();
          if (want && want.name === n && !(cur && cur.name === n)) A.music(n, want); });
    });
  }
  function check() {
    const sfxDone = names.every((n) => isMusic(n) || state[n] === "ok" || state[n] === "fail");
    if (fetchDone && sfxDone && names.length) A.ready = true;
    if (loadRes && fetchDone && (!ctx || A.ready || !names.length)) { loadRes(names.filter((n) => state[n] !== "fail")); loadRes = null; }
  }

  A.load = function (b, url) {
    if (loadP) return loadP;
    base = b == null ? base : String(b);
    if (base && base.slice(-1) !== "/") base += "/";
    url = url || base + "audio.json";
    loadP = new Promise((res) => { loadRes = res; });
    fetch(url).then((r) => { if (!r.ok) throw new Error(r.status + " " + url); return r.json(); })
      .then((m) => {
        man = m || {};
        names = Object.keys(man).filter((n) => n.charAt(0) !== "_" && man[n] && man[n].file);
        names.forEach((n) => { state[n] = "fetch"; });
        const get = (n) => fetch(base + man[n].file)
          .then((r) => { if (!r.ok) throw new Error(r.status + " " + man[n].file); return r.arrayBuffer(); })
          .then((ab) => { raw[n] = ab; state[n] = "raw"; kick(); })
          .catch((e) => { state[n] = "fail"; warn("load failed:", n, e && e.message); });
        // SFX first (small, needed at once), then music one file at a time, base first: keeps a phone link free
        const mus = names.filter(isMusic).sort((a, b) => (PRE_MUSIC.includes(b) ? 1 : 0) - (PRE_MUSIC.includes(a) ? 1 : 0));
        return Promise.all(names.filter((n) => !isMusic(n)).map(get))
          .then(() => mus.reduce((p, n) => p.then(() => get(n)), Promise.resolve()));
      })
      .catch((e) => warn("manifest failed:", e && e.message))
      .then(() => { fetchDone = true; check(); });
    return loadP;
  };

  A.has = (n) => !!buf[n];

  // ---------------------------------------------------------------- one-shots and loops
  const live = () => ctx && ctx.state === "running"; // never queue one-shots on a suspended clock (they would burst later)
  A.play = function (name, o) {
    o = o || {};
    const b = buf[name];
    if (!b || !live()) return null;
    try {
      const src = ctx.createBufferSource(), g = ctx.createGain();
      src.buffer = b;
      let rate = num(o.rate, 1) * ts;
      const cents = num(o.detune, 0) + (o.vary ? (Math.random() * 2 - 1) * o.vary : 0);
      if (cents) { if (src.detune) src.detune.value = cents; else rate *= Math.pow(2, cents / 1200); }
      src.playbackRate.value = rate;
      g.gain.value = num(o.vol, 1) * gainOf(name);
      src.connect(g);
      let out = g;
      if (o.pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = clamp(+o.pan, -1, 1); g.connect(p); out = p; }
      out.connect(bus.sfx);
      src.start(ctx.currentTime + Math.max(0, num(o.delay, 0)) / ts, lead[name] || 0);
      const list = voices[name] || (voices[name] = []);
      const h = { name, stopped: false, stop(f) {
        if (h.stopped) return; h.stopped = true; f = num(f, 0.05);
        ramp(g.gain, 0, f); try { src.stop(ctx.currentTime + f + 0.01); } catch (e) { /* not started */ }
      } };
      list.push(h);
      if (list.length > MAX_VOICES) list.shift().stop(0.03);
      src.onended = () => { const i = list.indexOf(h); if (i >= 0) list.splice(i, 1); try { out.disconnect(); } catch (e) { /* gone */ } };
      return h;
    } catch (e) { warn("play failed:", name, e && e.message); return null; }
  };

  A.playRandom = function (list, o) {
    const ok = (list || []).filter((n) => buf[n]);
    if (!ok.length) return null;
    const key = list.join("|"), pool = ok.length > 1 ? ok.filter((n) => n !== lastPick[key]) : ok;
    const n = pool[Math.floor(Math.random() * pool.length)];
    lastPick[key] = n;
    return A.play(n, o);
  };

  A.loop = function (name, o) { // baked loops: loopStart/loopEnd sit inside a wrap of the loop's own audio
    o = o || {};
    const b = buf[name];
    if (!b || !live()) return null;
    try {
      const m = man[name] || {}, src = ctx.createBufferSource(), g = ctx.createGain();
      let ls = num(m.loopStart, 0), le = num(m.loopEnd, b.duration);
      if (le > b.duration || le - ls < 0.05) { ls = 0; le = b.duration; }
      src.buffer = b; src.loop = true; src.loopStart = ls; src.loopEnd = le;
      src.playbackRate.value = num(o.rate, 1) * ts;
      const k = gainOf(name), t0 = ctx.currentTime + 0.005;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(num(o.vol, 1) * k, t0 + Math.max(0.005, num(o.fadeIn, 0.2)));
      src.connect(g); g.connect(bus.sfx);
      src.start(t0, ls);
      src.onended = () => { try { g.disconnect(); } catch (e) { /* gone */ } };
      const h = { name, stopped: false,
        stop(f) { if (h.stopped) return; h.stopped = true; f = num(f, 0.3); ramp(g.gain, 0, f); try { src.stop(ctx.currentTime + f + 0.02); } catch (e) { /* ignore */ } },
        setVol(v, t) { if (!h.stopped) ramp(g.gain, num(v, 1) * k, num(t, 0.2)); } };
      return h;
    } catch (e) { warn("loop failed:", name, e && e.message); return null; }
  };

  // ---------------------------------------------------------------- music
  function track(name, vol, fade, at) {
    const b = buf[name], m = man[name] || {}, dur = b.duration;
    let ls = num(m.loopStart, 0), le = Math.min(num(m.loopEnd, dur), dur);
    if (!(le - ls > XF * 2)) { ls = 0; le = dur; }
    const pre = Math.min(XF / 2, ls), post = Math.min(XF / 2, dur - le); // crossfade around the loop point
    const T = { name, dead: false, vol, list: [], g: ctx.createGain() };
    T.g.connect(bus.music);
    const t0 = ctx.currentTime + 0.03, target = vol * gainOf(name);
    T.g.gain.setValueAtTime(0.0001, t0);
    T.g.gain.linearRampToValueAtTime(target, t0 + Math.max(0.02, fade));
    function voice(start, off, fadeIn) {
      const src = ctx.createBufferSource(), g = ctx.createGain(), r = ts;
      src.buffer = b; src.playbackRate.value = r;
      src.connect(g); g.connect(T.g);
      const xd = (pre + post) / r, x = start + (le - pre - off) / r; // when this voice hands over to the next
      g.gain.value = fadeIn ? 0 : 1;
      try {
        if (fadeIn) g.gain.setValueCurveAtTime(FADE_IN, start, xd);
        g.gain.setValueCurveAtTime(FADE_OUT, x, xd);
      } catch (e) { g.gain.value = 1; }
      src.start(start, off);
      src.stop(x + xd + 0.05);
      src.onended = () => { try { g.disconnect(); } catch (e) { /* gone */ } };
      const v = { src, start, off, r, x };
      T.list.push(v);
      if (T.list.length > 3) T.list.shift();
      return v;
    }
    let off = clamp(num(at, 0), 0, dur);
    if (off > le - pre - 0.5) off = ls; // resuming past the loop point: go to the loop start
    let last = voice(t0, off, false);
    T.next = () => { // keep exactly one voice scheduled ahead: once the newest has started, queue its successor
      if (!T.dead && ctx.currentTime >= last.start - 0.05) last = voice(last.x, ls - pre, true);
    };
    T.next();
    T.pos = () => {
      const now = ctx.currentTime;
      let v = T.list[0];
      T.list.forEach((w) => { if (w.start <= now) v = w; });
      return v ? clamp(v.off + Math.max(0, now - v.start) * v.r, 0, dur) : 0;
    };
    T.setVol = (v, t) => { T.vol = v; ramp(T.g.gain, v * gainOf(name), num(t, 0.5)); };
    T.stop = (f) => {
      if (T.dead) return; T.dead = true;
      stoppedAt[name] = ctx.currentTime + f;
      if (m.resume) paused[name] = { pos: T.pos(), t: ctx.currentTime };
      ramp(T.g.gain, 0, f);
      const end = ctx.currentTime + f + 0.1;
      T.list.forEach((w) => { try { w.src.stop(end); } catch (e) { /* ignore */ } });
      setTimeout(() => { try { T.g.disconnect(); } catch (e) { /* gone */ } }, (f + 0.5) * 1000);
    };
    return T;
  }
  function pump() {
    if (cur && !cur.dead) cur.next();
    if (!ctx) return;
    const now = ctx.currentTime;                     // release long tracks nobody has needed for RESUME_S
    names.forEach((n) => {
      if (!isMusic(n) || !buf[n] || !raw[n] || (cur && !cur.dead && cur.name === n) || (want && want.name === n)) return;
      if (buf[n].duration <= RELEASE_LONGER || stoppedAt[n] == null || now - stoppedAt[n] < RESUME_S + 2) return;
      buf[n] = null; state[n] = "raw"; stoppedAt[n] = null;
    });
  }

  A.music = function (name, o) {
    o = o || {};
    const fade = Math.max(0, num(o.fade, 1.2)), vol = num(o.vol, 1);
    want = name ? { name, fade, vol, at: o.at } : null;
    if (!ctx) return;
    try {
      if (cur && !cur.dead && cur.name === name) { cur.setVol(vol, fade); return; }
      if (cur) { cur.stop(fade); cur = null; }
      if (!name) return;
      if (!buf[name]) { if (state[name] === "fail" || (fetchDone && !state[name])) warn("no music:", name); kick(); return; }
      let at = o.at;
      const p = paused[name];
      if (at == null && p && ctx.currentTime - p.t < RESUME_S) at = p.pos;
      cur = track(name, vol, fade, at);
      if (!pumpT) pumpT = setInterval(pump, 500);
    } catch (e) { warn("music failed:", name, e && e.message); }
  };

  A.duckMusic = function (level, attack, hold, release) {
    level = clamp(num(level, 0.35), 0, 1); attack = num(attack, 0.15); hold = num(hold, 0); duckRel = num(release, 0.6);
    if (!ctx) return;
    const p = bus.duck.gain; // hold 0 = stay ducked until unduck()
    ramp(p, level, attack);
    if (hold > 0) { const t = ctx.currentTime + attack + hold; p.setValueAtTime(level, t); p.linearRampToValueAtTime(1, t + duckRel); }
  };
  A.unduck = function (release) { if (ctx) ramp(bus.duck.gain, 1, num(release, duckRel)); };

  // ---------------------------------------------------------------- mix
  A.setMuted = function (m) { mute = !!m; if (ctx) ramp(bus.master.gain, mute ? 0 : vols.master, 0.05); };
  A.muted = () => mute;
  A.setVolumes = function (v) {
    v = v || {};
    ["master", "sfx", "music"].forEach((k) => { if (v[k] != null && !isNaN(+v[k])) vols[k] = clamp(+v[k], 0, 2); });
    if (!ctx) return;
    ramp(bus.sfx.gain, vols.sfx, 0.05); ramp(bus.music.gain, vols.music, 0.05);
    if (!mute) ramp(bus.master.gain, vols.master, 0.05);
  };
  A.timeScale = function (k) { // QA slow motion: new sources play at rate k; the current track restarts in place
    k = clamp(num(k, 1), 0.05, 4);
    if (k === ts) return;
    ts = k;
    if (ctx && cur && !cur.dead) { const n = cur.name, v = cur.vol, pos = cur.pos(); cur.stop(0.15); cur = track(n, v, 0.15, pos); }
  };

  // debugging / test page helpers
  A.names = () => names.slice();
  A.manifest = () => man;
  A.context = () => ctx;
  A.COMP = COMP;
  A.output = () => (bus ? bus.master : null); // tap for meters / recording (connect it, do not disconnect it)
  A.info = () => ({ ready: A.ready, ctx: ctx ? ctx.state : "none", rate: ctx ? ctx.sampleRate : 0,
    decoded: names.filter((n) => state[n] === "ok").length, failed: names.filter((n) => state[n] === "fail"),
    pending: names.filter((n) => state[n] !== "ok" && state[n] !== "fail"), music: cur && !cur.dead ? cur.name : null,
    musicPos: cur && !cur.dead ? +cur.pos().toFixed(2) : null, timeScale: ts, muted: mute });

  window.AUDIO = A;
})();
