// Fortune Bull 1000 - synthesised sound (WebAudio). Placeholder until the audio pack exists.
(function () {
  let ctx = null, master = null, muted = false;
  const S = {};

  S.unlock = function () {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
  };
  S.setMuted = (m) => { muted = m; if (master) master.gain.value = m ? 0 : 0.55; };
  S.muted = () => muted;

  function ok() { return ctx && !muted; }
  function env(g, t, a, d, peak) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(freq, type, t, a, d, peak, slideTo) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + a + d);
    env(g, t, a, d, peak);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + a + d + 0.05);
  }
  let noiseBuf = null;
  function noise(t, d, peak, f0, f1, q) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const ch = noiseBuf.getChannelData(0);
      for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = "bandpass"; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d);
    env(g, t, 0.01, d, peak);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t); s.stop(t + d + 0.05);
  }
  const now = () => ctx.currentTime;

  S.click = () => { if (!ok()) return; const t = now(); tone(900, "triangle", t, 0.002, 0.06, 0.25, 500); };
  S.spin = () => { if (!ok()) return; const t = now(); noise(t, 0.45, 0.35, 300, 2400, 0.8); tone(180, "sawtooth", t, 0.01, 0.25, 0.08, 420); };
  S.reelStop = (i) => {
    if (!ok()) return; const t = now();
    tone(120 - i * 8, "sine", t, 0.002, 0.16, 0.6, 60);
    noise(t, 0.05, 0.25, 1800, 900, 2);
  };
  S.columnStop = () => { if (!ok()) return; const t = now(); tone(90, "sine", t, 0.002, 0.25, 0.7, 45); tone(1400, "square", t, 0.002, 0.04, 0.06); };
  S.wildLand = () => {
    if (!ok()) return; const t = now();
    [523, 659, 784, 1047].forEach((f, k) => tone(f, "triangle", t + k * 0.03, 0.005, 0.6, 0.15));
  };
  S.tease = (d) => {
    if (!ok()) return; const t = now();
    tone(220, "sawtooth", t, 0.3, d, 0.07, 880); noise(t, d, 0.12, 400, 3000, 3);
  };
  S.win = (n) => {
    if (!ok()) return; const t = now();
    const notes = [523, 659, 784, 1047, 1319];
    for (let k = 0; k < Math.min(5, 2 + n); k++) tone(notes[k], "triangle", t + k * 0.07, 0.005, 0.35, 0.18);
  };
  S.line = () => { if (!ok()) return; const t = now(); tone(1568, "sine", t, 0.003, 0.25, 0.12); tone(2093, "sine", t + 0.05, 0.003, 0.3, 0.08); };
  S.tick = () => { if (!ok()) return; const t = now(); tone(2400 + Math.random() * 400, "square", t, 0.001, 0.025, 0.03); };
  S.coin = () => { if (!ok()) return; const t = now(); const f = 2600 + Math.random() * 900; tone(f, "sine", t, 0.001, 0.12, 0.06); tone(f * 1.5, "sine", t + 0.02, 0.001, 0.1, 0.04); };
  S.nudge = () => {
    if (!ok()) return; const t = now();
    tone(140, "square", t, 0.002, 0.12, 0.2, 70); noise(t, 0.12, 0.3, 3000, 1200, 4);
    tone(880, "triangle", t + 0.05, 0.003, 0.3, 0.1);
  };
  S.fly = () => { if (!ok()) return; const t = now(); noise(t, 0.4, 0.2, 600, 4000, 1.5); tone(400, "sine", t, 0.05, 0.35, 0.08, 1200); };
  S.impact = (big) => {
    if (!ok()) return; const t = now();
    tone(big ? 70 : 110, "sine", t, 0.002, big ? 0.8 : 0.4, 0.9, 35);
    noise(t, big ? 0.6 : 0.3, 0.4, 2500, 400, 0.7);
    [1047, 1319, 1568].forEach((f, k) => tone(f, "triangle", t + 0.04 + k * 0.04, 0.005, 0.5, 0.08));
  };
  S.fanfare = (level) => {
    if (!ok()) return; const t = now();
    const chords = [[262, 330, 392], [294, 370, 440], [330, 415, 494], [392, 494, 587], [440, 554, 659]];
    const c = chords[Math.min(level, chords.length - 1)];
    c.forEach((f) => { tone(f, "sawtooth", t, 0.04, 0.9, 0.07); tone(f * 2, "square", t + 0.12, 0.03, 0.8, 0.03); });
    tone(c[0] / 2, "sine", t, 0.01, 1.2, 0.5);
  };
  S.plink = () => { if (!ok()) return; const t = now(); const f = 2900 + Math.random() * 700; tone(f, "sine", t, 0.001, 0.08, 0.05); };
  S.rumble = (d) => { if (!ok()) return; const t = now(); noise(t, d, 0.4, 80, 60, 0.5); tone(50, "sine", t, 0.1, d, 0.4); };

  // ---------- sample layer: real recorded/generated sounds via window.AUDIO (src/audio.js); synth = fallback ----------
  const SY = S;
  const R = {};
  const A = () => (window.AUDIO && window.AUDIO.ready ? window.AUDIO : null);
  const has = (n) => { const a = A(); return a && a.has(n) ? a : null; };
  const one = (n, o, fb) => { const a = has(n); if (a) return a.play(n, o || {}); if (fb) fb(); return null; };
  let spinLoop = null, countLoop = null, countT = null, fireLoop = null, lastCoin = 0, lastRoar = 0, track = null, baseTrack = "music_base";
  R.unlock = () => { SY.unlock(); if (window.AUDIO) { window.AUDIO.init(); if (track) window.AUDIO.music(track, { fade: 0.8 }); } };
  R.setMuted = (m) => { SY.setMuted(m); if (window.AUDIO) window.AUDIO.setMuted(m); };
  R.muted = () => SY.muted();
  R.click = () => one("ui_click", { vol: 0.7 }, SY.click);
  R.spin = () => {
    one("spin_start", { vol: 0.75 }, SY.spin);
    const a = has("reel_spin_loop");
    if (a && !spinLoop) spinLoop = a.loop("reel_spin_loop", { vol: 0.4, fadeIn: 0.08 });
  };
  R.spinEnd = () => { if (spinLoop) { spinLoop.stop(0.18); spinLoop = null; } };
  R.reelStop = (i) => { const a = A(); if (a && a.has("reel_stop_1")) a.playRandom(["reel_stop_1", "reel_stop_2", "reel_stop_3"], { vol: 0.95, rate: 1 - i * 0.025 }); else SY.reelStop(i); };
  R.columnStop = () => { one("column_stop", { vol: 0.9 }, SY.columnStop); R.spinEnd(); };
  R.wildLand = () => one("wild_land", { vol: 0.75, vary: 40 }, SY.wildLand);
  R.superLand = () => one("superwild_land", { vol: 0.85 }, SY.wildLand);
  R.tease = (d) => (d >= 1.2 ? one("tease_riser", { vol: 0.9 }, () => SY.tease(d)) : one("orb_charge", { vol: 0.6, rate: 1.15 }, () => SY.tease(d)));
  R.win = (n) => one("win_line", { vol: 0.75 }, () => SY.win(n));
  // multiplier tease: a riser under the slow roll, and a click per chip that climbs in pitch as the column slows (k 0..1)
  R.colTease = () => one("tease_riser", { vol: 0.55, rate: 1.1 }, () => SY.tease(1.6));
  R.colTick = (k) => one("ui_click", { vol: 0.5 + 0.3 * k, rate: 0.9 + 0.45 * k }, SY.click);
  R.line = () => one("bell", { vol: 0.6 }, SY.line);
  R.tick = () => {
    const a = has("count_loop"); if (!a) return SY.tick();
    if (!countLoop) countLoop = a.loop("count_loop", { vol: 0.32, fadeIn: 0.05 });
    clearTimeout(countT); countT = setTimeout(() => { if (countLoop) { countLoop.stop(0.12); countLoop = null; } }, 200);
  };
  R.coin = () => { if (!has("coins_shower")) return SY.coin(); const t = performance.now(); if (t - lastCoin > 2400) { lastCoin = t; one("coins_shower", { vol: 0.6 }); } };
  R.plink = () => one("bell", { vol: 0.14, rate: 1.7 + Math.random() * 0.4 }, SY.plink);
  R.nudge = () => { const a = A(); if (a && a.has("nudge_clank_1")) a.playRandom(["nudge_clank_1", "nudge_clank_2"], { vol: 0.95 }); else SY.nudge(); };
  R.fly = () => { const a = A(); if (a && a.has("fly_1")) a.playRandom(["fly_1", "fly_2"], { vol: 0.55, vary: 60 }); else SY.fly(); };
  R.impact = (big) => one(big ? "impact_big" : "impact_magic", { vol: big ? 0.9 : 0.7, vary: 30 }, () => SY.impact(big));
  R.fanfare = (level) => one(level === 0 ? "bigwin_hit" : "tier_up", { vol: 0.95 }, () => SY.fanfare(level));
  R.rumble = (d) => one("superwild_land", { vol: 0.6, rate: 0.8 }, () => SY.rumble(d));
  R.roar = () => {                                  // the bellow + a pitched-down sub boom underneath for size
    const t = performance.now(); if (t - lastRoar < 2500) return; lastRoar = t;
    one("bull_roar", { vol: 1, rate: 0.9 });
    one("impact_big", { vol: 0.45, rate: 0.72 });
  };
  R.slam = () => one("slam", { vol: 1 }, () => SY.impact(true));
  R.laser = () => one("laser", { vol: 0.7 }, SY.fly);
  R.lightning = () => one("lightning", { vol: 0.55 });
  R.orbCharge = (d) => one("orb_charge", { vol: 0.8 }, () => SY.tease(d || 0.7));
  R.orbThrow = () => one("orb_throw", { vol: 0.85 }, SY.fly);
  R.nudgeActivate = () => one("nudge_activate", { vol: 0.9 }, SY.wildLand);
  R.buy = () => one("buy_confirm", { vol: 0.9 }, SY.wildLand);
  R.fire = (on) => {
    const a = has("fire_loop");
    if (on && a && !fireLoop) fireLoop = a.loop("fire_loop", { vol: 0.35, fadeIn: 0.4 });
    if (!on && fireLoop) { fireLoop.stop(0.6); fireLoop = null; }
  };
  // music: "base" | "feature" | "bigwin" | null ; bigwin returns to whatever played before
  R.music = (name) => {
    const n = name ? "music_" + name : null;
    if (name === "base" || name === "feature") baseTrack = n;
    track = n;
    if (window.AUDIO) window.AUDIO.music(n, { fade: name === "bigwin" ? 0.4 : 1.2 });
  };
  R.musicBack = () => R.music(baseTrack === "music_feature" ? "feature" : "base");
  window.SFX = R;
})();
