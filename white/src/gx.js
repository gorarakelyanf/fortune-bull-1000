// Fortune Bull 1000 - effect plugin bus. game.js emits events at the key moments and hands every plugin the game's
// internals (GX.ctx); each effect lives in its own src/gx_*.js file and registers with GX.plugin(fn).
//   GX.on(ev, fn)        listen             GX.emit(ev, data)       fire (errors in a plugin never reach the game)
//   await GX.run(ev, d, cap)  the game waits for every listener's promise (capped at cap ms, default 4 s), e.g. the popup outro
window.GX = (function () {
  const h = {}, plugins = [];
  const safe = (fn, d) => { try { return fn(d); } catch (e) { console.warn("gx", e); } };
  return {
    ctx: null, plugins,
    plugin(fn) { plugins.push(fn); },
    on(ev, fn) { (h[ev] = h[ev] || []).push(fn); },
    emit(ev, d) { (h[ev] || []).forEach((fn) => safe(fn, d)); },
    run(ev, d, cap) {
      const ps = (h[ev] || []).map((fn) => Promise.resolve(safe(fn, d)).catch((e) => console.warn("gx", e)));
      // the cap runs on game time (gsap), so slow motion (?ts), hit-stops and a slow frame rate never cut an effect short
      const capP = new Promise((r) => (window.gsap ? gsap.delayedCall((cap || 4000) / 1000, r) : setTimeout(r, cap || 4000)));
      return ps.length ? Promise.race([Promise.all(ps), capP]) : Promise.resolve();
    },
    start(ctx) { this.ctx = ctx; plugins.forEach((fn) => safe(fn, ctx)); },
  };
})();
