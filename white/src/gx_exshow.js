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
  const api = window.EXSHOW = { play, cancel, active: () => !!cur, T: TM, last: null, _count: () => (exL ? exL.children.length : 0) + (cur && cur.dropL ? cur.dropL.children.length : 0) };
  // b21 (user 2026-11-20: "when we turn on EX, the super wild should come in a more cinematic way and go down in the board behind
  // the frame, so it feels like we are filling the board with super wilds, and leave 2 or 3 on the board"): DROP show. Reel by
  // reel (left to right) three SUPER WILDs stacked as a strip fall into the window from behind the frame's top bar while that
  // reel's symbols fall out under its bottom bar (one strip, exactly three cells), the strip lands with a squash and a light
  // board drop; full board -> the column grows, all nine breathe; then all but 2 or 3 dissolve back to the old symbols and the
  // kept ones BECOME real SUPER WILD cells (reel views, they spin away with the next spin). ?exfly = the b20 flying show.
  const QS = (() => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(""); } })();
  const DROP = !QS.has("exfly");
  // b21 later the same day (user: "when we turn on the EX, Super Wild should fly from outside onto the board lower border"; asked,
  // they chose "pile up from the bottom": each one flies in from off-screen, drops into the board behind the top frame and falls
  // to the lower border, bottom row first, then middle, then top, like pouring into a box; then 2 or 3 stay): PILE show.
  // The board's old symbols first fall out under the lower border (reel by reel), then nine SUPER WILDs fly in one by one
  // from above the screen (left reel from the left, right reel from the right), settle over their reel, fall straight down
  // behind the frame's top bar (a copy of the bar is drawn over them) and land with a squash; a rising note per landing, a
  // light board drop per finished row. ?exstrip = the strip drop above, ?exfly = the b20 flying show.
  const PILE = DROP && !QS.has("exstrip");
  const TP = {
    EMPTY: 0.04, EMPTY_GAP: 0.07, EMPTY_DUR: 0.36,              // the old symbols fall out, reel r at EMPTY + r * EMPTY_GAP
    START: 0.36, GAP: 0.11, FLY: 0.62, X_PART: 0.7,             // launch i (0..8, bottom row first) at START + i * GAP
    SQUASH: 0.26, SQ_X: 1.05, SQ_Y: 0.9, BOUNCE: 8, DROP_K: 0.2,
    COL: 1.25, FINAL: 2.0, BREATHE: 0.34, BREATHE_K: 1.035,
    DIS: 2.6, DIS_GAP: 0.05, DIS_DUR: 0.26, MSG: 3.15, END: 3.4,
  };
  const TD = {
    START: 0.18, REEL_GAP: 0.3, FALL: 0.5,                      // reel r's strip starts at START + r * REEL_GAP, falls FALL s
    SQUASH: 0.26, SQ_X: 1.05, SQ_Y: 0.9, BOUNCE: 9, DROP_K: 0.25, // landing: squash + a small bounce, light board drop
    COL: 1.2, FINAL: 1.75, BREATHE: 0.34, BREATHE_K: 1.035,
    DIS: 2.45, DIS_GAP: 0.05, DIS_DUR: 0.26, MSG: 3.0, END: 3.25,
  };

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
    if (PILE && exs.win && exs.frameTop) { playPile(o, exs, id, resolve); return done; }
    if (DROP && exs.win && exs.reelsL) { playDrop(o, exs, id, resolve); return done; }
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

  function playPile(o, exs, id, resolve) {
    try {
      const turbo = !!o.turbo, mode = o.mode || 1, reels = ctx.reels;
      const pile = new PIXI.Container(); pile.eventMode = "none"; pile.name = "exPile";
      const ft = exs.frameTop, bar = new PIXI.Sprite(ft.texture); bar.eventMode = "none";   // the frame's top bar again, over the copies
      fxTop.addChild(pile, bar);
      const syncBar = () => { const wt = ft.worldTransform, ft2 = fxTop.worldTransform; bar.position.copyFrom(fxTop.toLocal(ft.getGlobalPosition(new PIXI.Point(), false)));
        bar.scale.set(wt.a / ft2.a, wt.d / ft2.d); };
      syncBar();
      cur = { id, exs, fly: null, trail: null, copies: [], tl: null, tick: null, resolve, t0: now(), turbo, kept: [], trash: [pile, bar] };
      reels.forEach((rl) => { if (rl.topLift) rl.topLift(false); rl.domask(); });   // the old symbols fall out inside the window
      cur.drop = { restore: () => reels.forEach((rl) => { rl.layout(); rl.rest(); }) };
      const p0 = fxTop.toLocal(new PIXI.Point(0, 0)), YT = p0.y - 300;
      const cellG = (cp) => fxTop.toLocal(cp.par.toGlobal(new PIXI.Point(cp.bx, cp.by)));   // the cell centre, following board drops
      // launch order: bottom row first (reels in a random order per row); drawing order: top row under, bottom row over
      const order = [];
      [2, 1, 0].forEach((row) => [0, 1, 2].sort(() => Math.random() - 0.5).forEach((reel) => order.push({ row, reel })));
      const byCell = {};
      for (let row = 0; row < 3; row++) for (let reel = 0; reel < 3; reel++) {
        const v = realView(reel, row);
        const c = new PIXI.Container(); c.eventMode = "none";
        const inner = new PIXI.Container();
        const sp = new PIXI.Sprite(T("Symbols/super_wild")); sp.anchor.set(0.5);
        const n = String(exs.swPick()), cnt = exs.swDigits(n); cnt.position.set(exs.SW_PLATE.x, exs.SW_PLATE.y);
        inner.addChild(sp, cnt); c.addChild(inner); c.visible = false; c.alpha = 0; pile.addChild(c);
        const k = (v.c.worldTransform.a || 1) / (fxTop.worldTransform.a || 1);
        byCell[reel * 3 + row] = { c, inner, row, reel, v, cnt: n, k, par: v.c.parent, bx: v.c.x, by: v.c.y, landed: false };
      }
      order.forEach((o2, i) => { const cp = byCell[o2.reel * 3 + o2.row]; cp.i = i; cp.at = TP.START + i * TP.GAP; cur.copies.push(cp); });
      const tl = gsap.timeline({ paused: true }); cur.tl = tl;
      const G = (fn) => function () { if (!cur || cur.id !== id) return; try { fn.apply(this, arguments); } catch (e) { warn(e); cancel("error"); } };
      exs.clearWin();
      exs.showMsg("MULTIPLIERS FROM " + (exs.minOf ? exs.minOf(mode) : [1, 3, 15, 50][mode]) + "x");
      if (ctx.bullReact) ctx.bullReact("win");
      if (window.GXI && GXI.stopIdle) GXI.stopIdle();
      SFX.fly();
      // 1) the board empties: each reel's three symbols fall out under the lower border
      for (let reel = 0; reel < 3; reel++) [0, 1, 2].forEach((row) => { const v = realView(reel, row);
        tl.to(v.c, { y: v.c.y + 3 * reels[reel].pitch + 40, duration: TP.EMPTY_DUR, ease: "power2.in" }, TP.EMPTY + reel * TP.EMPTY_GAP); });
      // 2) the SUPER WILDs, one by one: in from above the screen, over their reel, straight down behind the top bar, a squash
      cur.copies.forEach((cp) => {
        const side = cp.reel === 0 ? -1 : cp.reel === 2 ? 1 : (cp.i % 2 ? 1 : -1);
        const k = { t: 0 }, sx0 = side * (160 + Math.random() * 220);
        if (!turbo || cp.i % 3 === 0) tl.call(G(() => SFX.fly()), null, cp.at);
        tl.call(G(() => { cp.c.visible = true; }), null, cp.at);
        tl.to(k, { t: 1, duration: TP.FLY, ease: "none", onUpdate: G(() => {
          const t = k.t, to = cellG(cp), tx = Math.min(1, t / TP.X_PART), ex = 1 - (1 - tx) * (1 - tx);
          cp.c.position.set(to.x + sx0 * (1 - ex), YT + (to.y - YT) * t * t);          // x settles first, y falls (gravity)
          cp.c.rotation = -side * 0.32 * (1 - ex);
          cp.c.scale.set(cp.k * (0.78 + 0.22 * ex));
          cp.c.alpha = Math.min(1, t * TP.FLY / 0.1);
        }) }, cp.at);
        tl.call(G(() => { cp.landed = true; cp.c.rotation = 0; cp.c.scale.set(cp.k); cp.c.position.copyFrom(cellG(cp));
          if (!turbo) SFX.rise(cp.i / 16); else if (cp.i % 3 === 2) SFX.rise(cp.i / 16);
          if (cp.i % 3 === 2 && exs.boardDrop && !turbo) exs.boardDrop(TP.DROP_K); }), null, cp.at + TP.FLY);
        tl.fromTo(cp.inner.scale, { x: TP.SQ_X, y: TP.SQ_Y }, { x: 1, y: 1, duration: TP.SQUASH, ease: "back.out(2.6)", immediateRender: false }, cp.at + TP.FLY);
        tl.fromTo(cp.inner, { y: 0 }, { y: -TP.BOUNCE, duration: TP.SQUASH * 0.45, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }, cp.at + TP.FLY);
      });
      tl.call(G(() => { if (exs.colGrow) Promise.resolve(exs.colGrow({ speed: tl.timeScale() })).catch(warn); }), null, TP.COL);
      tl.call(G(() => { if (ctx.bullReact) ctx.bullReact("win"); if (ctx.flameKick) ctx.flameKick(0.35); SFX.line(); }), null, TP.FINAL);
      tl.to(cur.copies.map((cp) => cp.inner.scale), { x: TP.BREATHE_K, y: TP.BREATHE_K, duration: TP.BREATHE / 2, ease: "sine.inOut", yoyo: true, repeat: 1 }, TP.FINAL);
      // 3) all but 2 or 3 SUPER WILDs (old ones on the board count first) dissolve back to the old symbols; the kept ones become real cells
      const nKeep = Math.random() < 0.5 ? 2 : 3, keep = new Set();
      for (let reel = 0; reel < 3; reel++) for (let row = 0; row < 3; row++) if (realView(reel, row).id === "super_wild") keep.add(reel * 3 + row);
      const used = new Set([...keep].map((x) => Math.floor(x / 3)));
      [0, 1, 2].sort(() => Math.random() - 0.5).forEach((r) => { if (keep.size < nKeep && !used.has(r)) { keep.add(r * 3 + Math.floor(Math.random() * 3)); used.add(r); } });
      tl.call(G(() => {
        reels.forEach((rl) => rl.layout());
        cur.copies.forEach((cp) => {
          const kk = cp.reel * 3 + cp.row;
          if (keep.has(kk)) { reels[cp.reel].syms[cp.row + 1] = "super_wild"; cp.v.set("super_wild", false); if (cp.v.cnt) cp.v.cnt.text = cp.cnt;
            cp.v.c.alpha = 1; cp.c.visible = false; cur.kept.push(kk); }
          else cp.v.c.alpha = 0;
        });
      }), null, TP.DIS - 0.001);
      cur.copies.filter((cp) => !keep.has(cp.reel * 3 + cp.row)).sort((a, b) => b.i - a.i).forEach((cp, j) => {
        const at = TP.DIS + j * TP.DIS_GAP;
        tl.to(cp.c, { alpha: 0, duration: TP.DIS_DUR, ease: "power1.in" }, at);
        tl.to(cp.inner.scale, { x: 0.94, y: 0.94, duration: TP.DIS_DUR, ease: "power1.in" }, at);
        tl.to(cp.v.c, { alpha: 1, duration: TP.DIS_DUR, ease: "power1.out" }, at);
      });
      tl.call(G(() => exs.showMsg("SPIN TO WIN")), null, TP.MSG);
      tl.call(G(() => cancel("end")), null, TP.END);
      const tick = G(() => {
        if (now() - cur.t0 > TM.POLL && exs.overlayOpen && exs.overlayOpen()) { cancel("overlay"); return; }
        syncBar();
        cur.copies.forEach((cp) => { if (cp.landed) cp.c.position.copyFrom(cellG(cp)); });   // landed ones ride the board drops
      });
      cur.tick = tick; app.ticker.add(tick);
      tl.timeScale(turbo ? TM.TURBO : 1);
      tl.play(0);
    } catch (e) { warn(e); if (cur && cur.id === id) cancel("error"); else resolve("error"); }
  }

  function playDrop(o, exs, id, resolve) {
    try {
      const turbo = !!o.turbo, mode = o.mode || 1, wr = exs.win();
      const dropL = new PIXI.Container(); dropL.eventMode = "none"; dropL.name = "exDropL";
      const mask = new PIXI.Graphics().beginFill(0xffffff).drawRect(wr.x0, wr.y0, wr.x1 - wr.x0, wr.y1 - wr.y0).endFill();
      exs.reelsL.addChild(dropL, mask); dropL.mask = mask;                 // in the reels' layer: under the frame's top / bottom bars
      cur = { id, exs, fly: null, trail: null, copies: [], tl: null, tick: null, resolve, t0: now(), turbo, dropL, dropMask: mask, kept: [] };
      const reels = ctx.reels;
      // every reel: its SUPER WILDs back in the reel container (not lifted over the frame) and masked to the window
      reels.forEach((rl) => { if (rl.topLift) rl.topLift(false); rl.domask(); });
      cur.drop = { restore: () => reels.forEach((rl) => { rl.layout(); rl.rest(); }) };
      for (let reel = 0; reel < 3; reel++) for (let row = 0; row < 3; row++) {
        const v = realView(reel, row), pitch = reels[reel].pitch, D = 3 * pitch;
        const c = new PIXI.Container(); c.eventMode = "none";
        const sp = new PIXI.Sprite(T("Symbols/super_wild")); sp.anchor.set(0.5);
        const n = String(exs.swPick()), cnt = exs.swDigits(n); cnt.position.set(exs.SW_PLATE.x, exs.SW_PLATE.y);
        const inner = new PIXI.Container(); inner.addChild(sp, cnt); c.addChild(inner);
        c.scale.copyFrom(v.c.scale);
        const to = { x: v.c.x, y: v.c.y };
        c.position.set(to.x, to.y - D); c.visible = false; dropL.addChild(c);    // row order: a lower SUPER WILD's horns over the plate above
        cur.copies.push({ c, inner, row, reel, n, v, to, D, y0: v.c.y, cnt: n,
          at: TD.START + reel * TD.REEL_GAP });
      }
      const tl = gsap.timeline({ paused: true }); cur.tl = tl;
      const G = (fn) => function () { if (!cur || cur.id !== id) return; try { fn.apply(this, arguments); } catch (e) { warn(e); cancel("error"); } };
      exs.clearWin();
      exs.showMsg("MULTIPLIERS FROM " + (exs.minOf ? exs.minOf(mode) : [1, 3, 15, 50][mode]) + "x");
      if (ctx.bullReact) ctx.bullReact("win");
      if (window.GXI && GXI.stopIdle) GXI.stopIdle();
      SFX.fly();
      for (let reel = 0; reel < 3; reel++) {
        const at = TD.START + reel * TD.REEL_GAP, mine = cur.copies.filter((cp) => cp.reel === reel);
        const outs = [0, 1, 2].map((row) => realView(reel, row));
        tl.call(G(() => mine.forEach((cp) => { cp.c.visible = true; })), null, at);
        // one strip: the old three fall out under the bottom bar, the three SUPER WILDs right above them follow them in
        mine.forEach((cp) => tl.to(cp.c, { y: cp.to.y, duration: TD.FALL, ease: "power2.in" }, at));
        outs.forEach((v) => tl.to(v.c, { y: v.c.y + 3 * reels[reel].pitch, duration: TD.FALL, ease: "power2.in" }, at));
        // touchdown: squash and settle, a small bounce, a light board drop, the landing sound
        tl.call(G(() => { if (exs.boardDrop && !turbo) exs.boardDrop(TD.DROP_K); if (SFX.superLand && reel === 2) SFX.superLand(); else if (SFX.wildLand) SFX.wildLand(); }), null, at + TD.FALL);
        mine.forEach((cp) => {
          tl.fromTo(cp.inner.scale, { x: TD.SQ_X, y: TD.SQ_Y }, { x: 1, y: 1, duration: TD.SQUASH, ease: "back.out(2.6)", immediateRender: false }, at + TD.FALL);
          tl.fromTo(cp.inner, { y: 0 }, { y: -TD.BOUNCE * (1 - cp.row * 0.25), duration: TD.SQUASH * 0.45, ease: "power2.out", yoyo: true, repeat: 1, immediateRender: false }, at + TD.FALL);
        });
      }
      tl.call(G(() => { if (exs.colGrow) Promise.resolve(exs.colGrow({ speed: tl.timeScale() })).catch(warn); }), null, TD.COL);
      tl.call(G(() => { if (ctx.bullReact) ctx.bullReact("win"); if (ctx.flameKick) ctx.flameKick(0.35); SFX.line(); }), null, TD.FINAL);
      tl.to(cur.copies.map((cp) => cp.inner.scale), { x: TD.BREATHE_K, y: TD.BREATHE_K, duration: TD.BREATHE / 2, ease: "sine.inOut", yoyo: true, repeat: 1 }, TD.FINAL);
      // all but 2 or 3 (one per reel at most) dissolve back to the old symbols; the kept ones become real SUPER WILD cells
      // 2 or 3 SUPER WILDs on the board after the show IN ALL: cells that were SUPER WILDs before count first, then one more per
      // reel not used yet (a random row) until there are enough
      const nKeep = Math.random() < 0.5 ? 2 : 3, keep = new Set();
      for (let reel = 0; reel < 3; reel++) for (let row = 0; row < 3; row++) if (realView(reel, row).id === "super_wild") keep.add(reel * 3 + row);
      const used = new Set([...keep].map((k) => Math.floor(k / 3)));
      [0, 1, 2].sort(() => Math.random() - 0.5).forEach((r) => { if (keep.size < nKeep && !used.has(r)) { keep.add(r * 3 + Math.floor(Math.random() * 3)); used.add(r); } });
      tl.call(G(() => {
        reels.forEach((rl) => rl.layout());                               // the old symbols back in their cells (hidden under the copies)
        cur.copies.forEach((cp) => {
          const k = cp.reel * 3 + cp.row;
          if (keep.has(k)) {
            const rl = reels[cp.reel]; rl.syms[cp.row + 1] = "super_wild";
            cp.v.set("super_wild", false); if (cp.v.cnt) cp.v.cnt.text = cp.cnt;   // the same count as the copy: no pop
            cp.v.c.alpha = 1; cp.c.visible = false; cur.kept.push(k);
          } else cp.v.c.alpha = 0;
        });
      }), null, TD.DIS - 0.001);
      cur.copies.filter((cp) => !keep.has(cp.reel * 3 + cp.row)).reverse().forEach((cp, i) => {
        const at = TD.DIS + i * TD.DIS_GAP;
        tl.to(cp.c, { alpha: 0, duration: TD.DIS_DUR, ease: "power1.in" }, at);
        tl.to(cp.inner.scale, { x: 0.94, y: 0.94, duration: TD.DIS_DUR, ease: "power1.in" }, at);
        tl.to(cp.v.c, { alpha: 1, duration: TD.DIS_DUR, ease: "power1.out" }, at);
      });
      tl.call(G(() => exs.showMsg("SPIN TO WIN")), null, TD.MSG);
      tl.call(G(() => cancel("end")), null, TD.END);
      const tick = G(() => { if (now() - cur.t0 > TM.POLL && exs.overlayOpen && exs.overlayOpen()) cancel("overlay"); });
      cur.tick = tick; app.ticker.add(tick);
      tl.timeScale(turbo ? TM.TURBO : 1);
      tl.play(0);
    } catch (e) { warn(e); if (cur && cur.id === id) cancel("error"); else resolve("error"); }
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
    step(() => { if (s.fly && !s.fly.destroyed) s.fly.destroy({ children: true }); });
    step(() => { if (s.dropL && !s.dropL.destroyed) s.dropL.destroy({ children: true }); if (s.dropMask && !s.dropMask.destroyed) s.dropMask.destroy(); });   // b21 drop show
    step(() => (s.trash || []).forEach((ob) => { if (!ob.destroyed) ob.destroy({ children: true }); }));   // b21 pile show (copies layer + the top bar copy)
    step(() => allViews().forEach((v) => { gsap.killTweensOf(v.c, "alpha,y"); v.c.alpha = 1; }));
    step(() => { if (s.drop) s.drop.restore(); });                     // b21: every view back in its cell, reels at rest (SUPER WILDs lifted)
    step(() => { if (s.exs.colFinish) s.exs.colFinish(); });
    if (reason !== "spin") step(() => s.exs.showMsg("SPIN TO WIN"));
    step(() => { if (window.GXI && GXI.startIdle) GXI.startIdle(); });
    api.last = { reason, dur: +(now() - s.t0).toFixed(3) };
    step(() => s.resolve(reason));
  }
});
