// Fortune Bull 1000 - effect plugin: EX switch-on show (see src/gx.js; plan fortune_bull_ex_show_plan_2026-11-18.md)
// When EXTRA BET goes OFF -> ON, nine SUPER WILD copies fly in from the edges in three rows, settle over the real cells
// (row 0 first, so lower horns draw over the plate above), the multiplier column grows (ctx.exs.colGrow, game.js), all
// nine breathe once, then dissolve back to the real symbols. Copies only: reels, the grid, S.* and the column data are
// never written here. One master gsap timeline (turbo = timeScale 2.9); cancel(reason) is the single clean-up path, also
// used at the normal end. game.js calls EXSHOW.play({ mode, turbo }) from toggleEx and EXSHOW.cancel(why) from spin().
GX.plugin(function (ctx) {
  "use strict";
  const { PIXI, gsap, app, FX, SFX, T, MOBILE, layers } = ctx;
  const fxTop = layers.fxTop;
  // timing (normal speed, seconds from the toggle) and the flight's shape
  const TM = {
    FLIGHT: 0.62, ROW0: 0.08, ROW_GAP: 0.44, SLOT_GAP: 0.11,   // launches: row r, slot j (0 left, 1 right, 2 centre)
    ALPHA_IN: 0.15, S0: 0.45, S1: 1.06, BANK: 0.14,             // fade-in, depth scale, bank (rad)
    LAND: 0.16, HIDE: 0.10, HIDE_LEAD: 0.06,                    // touchdown settle; the real cell fades out 0.06 s before
    COL: 1.25, FINAL: 2.50, BREATHE: 0.3, BREATHE_K: 1.03,
    DISSOLVE: 3.00, DIS_GAP: 0.03, DIS_DUR: 0.22, DIS_K: 0.94, MSG: 3.30, END: 3.50,
    TURBO: 2.9, POLL: 0.35,                                     // turbo timeScale; overlay poll starts (real seconds)
    TRAIL_N: MOBILE ? 6 : 10, TRAIL_LEN: MOBILE ? 200 : 260,  // trail points kept; max tail length (stage px)
  };
  const warn = (e) => console.warn("gx exshow", e);
  const now = () => performance.now() / 1000;
  const E3 = gsap.parseEase("power3.out"), E2 = gsap.parseEase("power2.out");
  let cur = null, exL = null, playN = 0;
  const api = window.EXSHOW = { play, cancel, active: () => !!cur, T: TM, last: null, _count: () => (exL ? exL.children.length : 0) };

  // the real symbol view showing reel r, row k (at rest views 1..3 are the visible rows)
  const realView = (r, k) => ctx.reels[r].views[k + 1];
  const allViews = () => { const a = []; ctx.reels.forEach((rl) => rl.views.forEach((v) => a.push(v))); return a; };

  function play(o) {
    o = o || {};
    cancel("restart");
    const exs = ctx.exs || GX.ctx.exs;
    if (!exs) { api.last = { reason: "off", dur: 0 }; return Promise.resolve("off"); }
    let resolve; const done = new Promise((r) => (resolve = r));
    const id = ++playN;
    try {
      const board = layers.board;
      if (!exL || exL.destroyed) { exL = new PIXI.Container(); exL.eventMode = "none"; exL.name = "exShowL"; }
      const par = exs.swTopL.parent;
      if (exL.parent !== par || par.getChildIndex(exL) !== par.getChildIndex(exs.swTopL) + 1) {
        if (exL.parent) exL.parent.removeChild(exL);
        par.addChildAt(exL, par.getChildIndex(exs.swTopL) + 1);
      }
      const fly = new PIXI.Container(); fly.eventMode = "none"; fly.name = "exShowFly";
      const trail = new PIXI.Graphics(); fly.addChild(trail); fxTop.addChild(fly);
      const turbo = !!o.turbo, mode = o.mode || 1;
      cur = { id, exs, fly, trail, copies: [], tl: null, tick: null, resolve, t0: now(), turbo };

      // the visible rectangle in fxTop space: start points sit just outside it (clamped), so a wide window never shows them
      const p0 = fxTop.toLocal(new PIXI.Point(0, 0)), p1 = fxTop.toLocal(new PIXI.Point(app.screen.width, app.screen.height));
      const XL = Math.max(p0.x - 200, -900), XR = Math.min(p1.x + 200, 1980), YT = Math.max(p0.y - 240, -700);

      // nine copies; landing order n: row 0 left, right, centre, then row 1, then row 2
      const SLOT_REEL = [0, 2, 1];
      for (let row = 0; row < 3; row++) for (let j = 0; j < 3; j++) {
        const reel = SLOT_REEL[j], v = realView(reel, row), n = row * 3 + j;
        const g = v.c.getGlobalPosition(new PIXI.Point(), false);
        const to = fxTop.toLocal(g);
        let from, ctrl, side;
        if (reel === 0) { side = -1; from = { x: XL, y: to.y - 260 }; ctrl = { x: to.x - 40, y: to.y - 330 }; }
        else if (reel === 2) { side = 1; from = { x: XR, y: to.y - 260 }; ctrl = { x: to.x + 40, y: to.y - 330 }; }
        else { side = row === 1 ? 1 : -1; from = { x: to.x + side * 320, y: YT }; ctrl = { x: to.x + side * 150, y: to.y - 420 }; }
        const c = new PIXI.Container(); c.eventMode = "none";
        const sp = new PIXI.Sprite(T("Symbols/super_wild")); sp.anchor.set(0.5);
        const cnt = exs.swDigits(String(exs.swPick())); cnt.position.set(exs.SW_PLATE.x, exs.SW_PLATE.y);
        c.addChild(sp, cnt);
        c.position.set(from.x, from.y); c.scale.set(TM.S0); c.alpha = 0; c.rotation = -side * TM.BANK; c.visible = false;
        const cp = { c, row, reel, n, side, v, from, ctrl, to, hist: [], flying: false, landed: false,
          launch: TM.ROW0 + row * TM.ROW_GAP + j * TM.SLOT_GAP };
        cp.landT = cp.launch + TM.FLIGHT;
        cur.copies.push(cp); fly.addChild(c);
      }

      const tl = gsap.timeline({ paused: true }); cur.tl = tl;
      const G = (fn) => function () { if (!cur || cur.id !== id) return; try { fn.apply(this, arguments); } catch (e) { warn(e); cancel("error"); } };

      // t = 0 (now): clear the last win, the caption, the bull's eyes, a whoosh; the idle glints pause
      exs.clearWin();
      exs.showMsg("MULTIPLIERS FROM " + (exs.minOf ? exs.minOf(mode) : [1, 3, 15, 50][mode]) + "x");
      if (ctx.bullReact) ctx.bullReact("win");
      SFX.fly();
      if (window.GXI && GXI.stopIdle) GXI.stopIdle();
      if (!turbo) { tl.call(G(() => SFX.fly()), null, TM.ROW0 + TM.ROW_GAP); tl.call(G(() => SFX.fly()), null, TM.ROW0 + 2 * TM.ROW_GAP); }

      cur.copies.forEach((cp) => {
        const k = { t: 0 };
        tl.call(G(() => { cp.c.visible = true; cp.flying = true; }), null, cp.launch);
        tl.to(k, { t: 1, duration: TM.FLIGHT, ease: "none", onUpdate: G(() => {
          const t = k.t, q = FX.bezier(cp.from, cp.ctrl, cp.to, E3(t)), e2 = E2(t);
          cp.c.position.set(q.x, q.y);
          cp.c.scale.set(TM.S0 + (TM.S1 - TM.S0) * e2);
          cp.c.alpha = Math.min(1, (t * TM.FLIGHT) / TM.ALPHA_IN);
          cp.c.rotation = -cp.side * TM.BANK * (1 - e2);
        }) }, cp.launch);
        // the real cell fades out under the arriving copy
        tl.to(cp.v.c, { alpha: 0, duration: TM.HIDE, ease: "none" }, cp.landT - TM.HIDE_LEAD);
        tl.call(G(() => land(cp)), null, cp.landT);
        tl.to(cp.c.scale, { x: 1, y: 1, duration: TM.LAND, ease: "power2.out" }, cp.landT + 0.001);
      });

      // the column grows in the right-hand flights' wake (package 2's helper; skipped when it is missing)
      tl.call(G(() => { if (exs.colGrow) Promise.resolve(exs.colGrow({ speed: tl.timeScale() })).catch(warn); }), null, TM.COL);
      // final beat: the centre chip has landed; all nine breathe once, the bull's eyes, a bell
      tl.call(G(() => {
        if (ctx.bullReact) ctx.bullReact("win");
        if (ctx.flameKick) ctx.flameKick(0.35);
        SFX.line();
      }), null, TM.FINAL);
      tl.to(cur.copies.map((cp) => cp.c.scale), { x: TM.BREATHE_K, y: TM.BREATHE_K, duration: TM.BREATHE / 2, ease: "sine.inOut", yoyo: true, repeat: 1 }, TM.FINAL);
      // dissolve, last landed first; the real symbol comes back under each copy
      cur.copies.slice().reverse().forEach((cp, i) => {
        const at = TM.DISSOLVE + i * TM.DIS_GAP;
        tl.to(cp.c, { alpha: 0, duration: TM.DIS_DUR, ease: "power1.in" }, at);
        tl.to(cp.c.scale, { x: TM.DIS_K, y: TM.DIS_K, duration: TM.DIS_DUR, ease: "power1.in" }, at);
        tl.to(cp.v.c, { alpha: 1, duration: TM.DIS_DUR, ease: "power1.out" }, at);
      });
      tl.call(G(() => exs.showMsg("SPIN TO WIN")), null, TM.MSG);
      tl.call(G(() => cancel("end")), null, TM.END);

      // trail + overlay poll, every frame
      const tick = G(() => {
        if (now() - cur.t0 > TM.POLL && exs.overlayOpen && exs.overlayOpen()) { cancel("overlay"); return; }
        drawTrail();
      });
      cur.tick = tick; app.ticker.add(tick);
      tl.timeScale(turbo ? TM.TURBO : 1);
      tl.play(0);
    } catch (e) { warn(e); if (cur && cur.id === id) cancel("error"); else resolve("error"); }
    return done;
  }

  function land(cp) {
    const s = cur;
    cp.flying = false; cp.landed = true;
    // into exL (board space, over swTopL), kept in row order so a lower SUPER WILD's horns draw over the plate above
    const g = cp.c.getGlobalPosition(new PIXI.Point(), false);
    const p = exL.toLocal(g);
    cp.c.rotation = 0;
    s.fly.removeChild(cp.c);
    cp.c.position.set(p.x, p.y);
    let at = 0; exL.children.forEach((ch, i) => { if (ch.__exRow <= cp.row) at = i + 1; });
    cp.c.__exRow = cp.row; exL.addChildAt(cp.c, at);
    if (!s.turbo) SFX.rise(cp.n / 16);
    else if (cp.reel === 1) SFX.rise(cp.n / 16);      // turbo: one note per row, on the centre landing
  }

  function drawTrail() {
    const s = cur, g = s.trail, N = TM.TRAIL_N;
    g.clear();
    s.copies.forEach((cp) => {
      if (cp.flying) { cp.hist.push({ x: cp.c.x, y: cp.c.y }); if (cp.hist.length > N) cp.hist.shift(); }
      else if (cp.landed && cp.hist.length) cp.hist.shift();
      // a short comet tail, never a long laser line: the fast first frames (wide windows start far out) are trimmed to TRAIL_LEN
      for (let L = 0, j = cp.hist.length - 1; j > 0; j--) {
        L += Math.hypot(cp.hist[j].x - cp.hist[j - 1].x, cp.hist[j].y - cp.hist[j - 1].y);
        if (L > TM.TRAIL_LEN) { cp.hist.splice(0, j - 1); break; }
      }
      const h = cp.hist, n = h.length;
      if (n < 2) return;
      for (let j = 1; j < n; j++) {
        const u = j / n;
        g.lineStyle(5 * u, 0xffd27a, 0.5 * u * Math.min(1, cp.c.alpha + (cp.landed ? 1 : 0)));
        g.moveTo(h[j - 1].x, h[j - 1].y); g.lineTo(h[j].x, h[j].y);
      }
      if (!MOBILE) for (let j = 1; j < n; j++) {
        const u = j / n;
        g.lineStyle(2 * u, 0xfff2c8, 0.8 * u * Math.min(1, cp.c.alpha + (cp.landed ? 1 : 0)));
        g.moveTo(h[j - 1].x, h[j - 1].y); g.lineTo(h[j].x, h[j].y);
      }
    });
  }

  // synchronous, idempotent: everything the show made goes, every real cell is fully visible, the column is valid
  function cancel(reason) {
    const s = cur; if (!s) return;
    cur = null;
    const step = (fn) => { try { fn(); } catch (e) { warn(e); } };
    step(() => { if (s.tl) s.tl.kill(); });
    step(() => { if (s.tick) app.ticker.remove(s.tick); });
    step(() => { s.copies.forEach((cp) => { gsap.killTweensOf(cp.c); gsap.killTweensOf(cp.c.scale); if (!cp.c.destroyed) cp.c.destroy({ children: true }); }); });
    step(() => { if (exL) exL.removeChildren().forEach((ch) => { if (!ch.destroyed) ch.destroy({ children: true }); }); });
    step(() => { if (!s.fly.destroyed) s.fly.destroy({ children: true }); });
    step(() => allViews().forEach((v) => { gsap.killTweensOf(v.c, "alpha"); v.c.alpha = 1; }));
    step(() => { if (s.exs.colFinish) s.exs.colFinish(); });
    if (reason !== "spin") step(() => s.exs.showMsg("SPIN TO WIN"));
    step(() => { if (window.GXI && GXI.startIdle) GXI.startIdle(); });
    api.last = { reason, dur: +(now() - s.t0).toFixed(3) };
    step(() => s.resolve(reason));
  }
});
