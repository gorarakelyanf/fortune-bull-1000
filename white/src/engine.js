// Fortune Bull 1000 - WHITE math engine (pure; runs in the browser and in node). tools/port_from_stone.py copies it to
// src/engine.js (the white engine no longer follows the stone one).
// Follows the product spec "Fortune Guardian 1000 - Buy Bonus and Extra Bet" v1.0 (11 Nov 2026):
//  - 3x3, 5 fixed lines, WILD + SUPER WILD substitute; pays in multiples of the Base Bet.
//  - MAIN multiplier = the column's centre chip. A CHARGE chip (value -N) in the centre of a win runs N actions; each
//    action draws one Direct Multiplier (added) or a nested CHARGE (its actions are added to the same run).
//  - FORTUNE CHOICE, natural: a SUPER WILD on a winning line triggers it; the SUPER WILDs' counts (2..8) are the
//    Choices (at most 9). 9 positions are made once (Direct Multiplier / CHARGE / Choice +2) and picked one at a time,
//    never refilled; Choice +2 only while remaining Choices + 2 <= remaining positions. Bonus Total starts at 0;
//    bonus win = raw line win x Bonus Total, a separate award next to the main win (line win x main multiplier).
//  - EXTRA BET modes 1..3 (debit 1.5 / 8 / 15 x Base Bet) restrict the Direct Multiplier and CHARGE pools; payouts
//    stay on the Base Bet; the mode holds for the whole round, a natural Fortune Choice included.
//  - BUY BONUS: 100 x Base Bet -> Fortune Choice at once (no spin): random Choices, a starting multiplier added before
//    the first pick, the buy pools; pays Base Bet x Bonus Total. No Extra Bet pools or surcharge.
//  - MAX WIN 50,000 x Base Bet (main + linked bonus together): only the headroom is paid, everything after stops.
// Math's own weights are not part of the spec, so the weights here are ours: TUNE below, solved to 97.01% per mode
// by tools/tune_spec.cjs and checked by Monte Carlo with tools/sim_spec.cjs.
(function (root) {
  // "charge" = the CHARGE symbol on the 3x3 board (user 2026-11-12: "add the charge to the main board"; in Fortune Garuda
  // the main board carries the nudge on its SUPER WILD's number): it pays nothing on a line; on a winning spin every
  // CHARGE on the board runs its count (the mode's CHARGE counts) into the main multiplier, like the CHARGE chip
  const SYMBOLS = ["J", "Q", "K", "A", "hourglass", "sun", "chest", "wild", "super_wild", "charge"];
  const WILDS = new Set(["wild", "super_wild"]);
  const PAY = { J: 0.2, Q: 0.25, K: 0.3, A: 0.4, hourglass: 0.6, sun: 0.8, chest: 1.0, wild: 4, super_wild: 4 };   // x bet for 3 on a line
  const PAY_SCALE = 1.013;
  const LINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  const MAX_WIN = 50000;                        // x Base Bet
  const MAX_ACTIONS = 5000;                     // a safety stop for one CHARGE run (the cap ends real runs long before)
  const MULT_VALUES = [1, 2, 3, 5, 10, 15, 20, 25, 50, 100, 200, 500, 1000];
  const CHARGE_COUNTS = [2, 3, 4, 5, 8, 10, 15, 20, 25, 50, 100, 200, 500, 1000];
  const SW_CHARGES = { 2: 55, 3: 20, 4: 11, 5: 6, 6: 4, 7: 2, 8: 2 };   // a SUPER WILD's count = its Fortune Choice Choices
  const NUDGE_CHIPS = [-3, -5];                 // the base game's CHARGE chips (art: label_nudge3 / 5)

  // ---- tuning (tools/sim_spec.cjs): RTP ~97.0% for the base game, each Extra Bet mode (on its debit) and the Buy ----
  const TUNE = Object.assign({
    sw: 0.79,                                   // SUPER WILD symbol weight (base game and every mode)
    cs: 1.0,                                    // CHARGE symbol weight on the 3x3 board (on ~1 spin in 11)
    b0: 0.1965,                                 // base game: tilt of the step pool (BASE_STEP x value^-b0)
    a: [0, 1.2005, 1.1188, 6],              // Extra Bet modes: Direct Multiplier pool = value^-a
    chargeShare: [0, 0.035, 0.03, 0.03],        // share of CHARGE chips among the column draws per mode
    buyA: 3.7973,                               // buy pool exponent
    fc: { mult: 0.8, charge: 0.12, choice2: 0.08 },   // Fortune Choice position kinds
    fcCharge: [0.12, 0.12, 0.12, 0.018],         // per mode: the CHARGE share of the wheel (the rest of it goes to multipliers)
  }, (typeof globalThis !== "undefined" && globalThis.__WB_TUNE) || {});   // tools/tune_spec.cjs overrides
  const WEIGHTS = { J: 18, Q: 17, K: 16, A: 15, hourglass: 9, sun: 8, chest: 7, wild: 3.2, super_wild: TUNE.sw, charge: TUNE.cs };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // a weight table -> a sampler (cumulative array, binary search)
  function table(w) {
    const keys = Object.keys(w).filter((k) => w[k] > 0), vals = keys.map(Number), cum = [];
    let t = 0; keys.forEach((k) => { t += w[k]; cum.push(t); });
    const draw = (rng) => { const r = rng() * t; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] > r) hi = m; else lo = m + 1; } return vals[lo]; };
    return { w, vals, total: t, draw, p: (v) => (w[v] || 0) / t };
  }
  const pow = (values, a) => { const o = {}; values.forEach((v) => (o[v] = Math.pow(v, -a))); return o; };
  const chargeW = (counts) => pow(counts, 3);   // CHARGE N: weight N^-3, so the big counts are very rare

  // ---- modes: 0 = base game, 1..3 = Extra Bet, "buy" = Buy Bonus ----
  // col: the column draws (landing chip and every CHARGE action), values > 0 = Direct Multipliers, < 0 = CHARGE N
  // fc:  Fortune Choice position rewards: share of Direct Multiplier / CHARGE / Choice +2 and their pools
  // base game: the centre lands with BASE_COL; a CHARGE action / Fortune Choice multiplier draws from BASE_STEP (the
  // old column strip's mix, where 500x and 1000x sat once in 214 chips: ~12x a step, as the old SUPER WILD nudges)
  const BASE_COL = { 1: 34, 2: 24, 3: 16, 5: 11, 10: 7, 15: 4.5, 20: 2.6, 25: 1.6, 50: 0.7, 100: 0.25, 500: 0.05, 1000: 0.02, "-3": 3.6, "-5": 1.3 };
  const BASE_STEP = { 1: 70, 2: 48, 3: 32, 5: 22, 10: 14, 15: 9, 20: 5, 25: 4, 50: 2, 100: 1, 500: 1, 1000: 1 };
  function modeDef(m) {
    if (m === 0) {
      const land = {}; let t = 0;
      for (const k in BASE_COL) if (+k > 0) { land[k] = BASE_COL[k]; t += BASE_COL[k]; }
      const mults = {}; for (const k in BASE_STEP) mults[k] = BASE_STEP[k] * Math.pow(+k, -TUNE.b0);
      return { cost: 1, land, mults, charges: { 3: 3, 5: 2 }, landShare: 4.9 / (t + 4.9), chargeShare: 5 / 214, landCharges: { 3: 3.6, 5: 1.3 } };
    }
    const min = [0, 3, 15, 50][m], cmin = [0, 2, 5, 10][m];
    const mults = pow(MULT_VALUES.filter((v) => v >= min), TUNE.a[m]);
    return { cost: [1, 1.5, 8, 15][m], land: mults, mults, charges: chargeW(CHARGE_COUNTS.filter((n) => n >= cmin)), chargeShare: TUNE.chargeShare[m] };
  }
  function mix(mults, charges, share) {         // mults and CHARGE chips (as -N) mixed: share = CHARGE's part
    const mt = table(mults), ct = table(charges), o = {};
    for (const v of mt.vals) o[v] = (1 - share) * mt.p(v);
    for (const n of ct.vals) o[-n] = share * ct.p(n);
    return table(o);
  }
  function build(def, fcShare) {
    const mt = table(def.mults), ct = table(def.charges);
    return Object.assign(def, { mt, ct, colT: mix(def.mults, def.charges, def.chargeShare),
      landT: mix(def.land || def.mults, def.landCharges || def.charges, def.landShare === undefined ? def.chargeShare : def.landShare),
      fc: fcShare || TUNE.fc });
  }
  const fcOf = (m) => { const c = TUNE.fcCharge[m]; return { mult: TUNE.fc.mult + TUNE.fc.charge - c, charge: c, choice2: TUNE.fc.choice2 }; };
  const MODES = [0, 1, 2, 3].map((m) => build(modeDef(m), fcOf(m)));
  const BUY_POOL = [25, 50, 100, 200, 500, 1000];
  const BUYM = build({ cost: 100, mults: pow(BUY_POOL, TUNE.buyA), charges: chargeW(CHARGE_COUNTS), chargeShare: 0.03 });
  BUYM.choices = table({ 1: 40, 2: 35, 3: 18, 4: 7 });   // the initial Choice count
  const BUY = { bonus: { name: "FORTUNE CHOICE", cost: BUYM.cost,
    desc: "Fortune Choice at once: a 25x-1000x start, then 1-4 picks. Pays bet x Bonus Total" } };
  const EX_COST = MODES[1].cost;

  // ---- the visual column strip of each mode: every allowed value at least once, in proportion otherwise ----
  // (a deterministic shuffle; the engine's draws are independent, the game re-skins the next chip to the drawn value)
  function stripOf(mode, seed) {
    const rng = mulberry32(seed), out = [], L = 220;
    for (const v of mode.colT.vals) { const n = Math.max(1, Math.round(mode.colT.p(v) * L)); for (let i = 0; i < n; i++) out.push(v); }
    for (const v of mode.landT.vals) if (!out.includes(v)) out.push(v);
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  }
  const STRIPS = MODES.map((md, m) => stripOf(md, 1000 + m));
  STRIPS.buy = stripOf(BUYM, 1999);
  const STRIP_BY = {};
  for (const k of [0, 1, 2, 3, "buy"]) { const by = {}; STRIPS[k].forEach((v, i) => (by[v] = by[v] || []).push(i)); STRIP_BY[k] = by; }
  let curMode = 0;                              // the mode whose strip Engine.STRIP shows (the game sets it)

  function evalLines(grid) {
    const wins = [];
    LINES.forEach((rows, li) => {
      const cells = rows.map((r, reel) => grid[reel][r]);
      const base = cells.find((s) => !WILDS.has(s));
      const sym = base || "wild";
      if (sym === "charge" || !PAY[sym]) return;                     // the CHARGE symbol never pays on a line
      if (cells.every((s) => s === sym || WILDS.has(s))) wins.push({ line: li + 1, sym, rows, pay: PAY[sym] * PAY_SCALE, supers: cells.filter((s) => s === "super_wild").length });
    });
    return wins;
  }
  const swT = table(SW_CHARGES);
  const modeOf = (ex) => (ex === true ? 1 : ex === "buy" ? "buy" : Math.max(0, Math.min(3, ex | 0)));
  const MD = (m) => (m === "buy" ? BUYM : MODES[m]);
  const stripIndex = (m, v, rng) => { const c = STRIP_BY[m][v]; return c[Math.floor(rng() * c.length)]; };

  // one CHARGE run of n actions: each action draws from the mode's column; returns the drawn values and their sum.
  // room = how much may still be added before the cap (in multiplier units for this run)
  function chargeRun(md, n, rng, room) {
    const vals = []; let actions = n, sum = 0, capped = false;
    while (actions > 0 && vals.length < MAX_ACTIONS) {
      const v = md.colT.draw(rng); vals.push(v); actions--;
      if (v < 0) actions += -v;
      else { sum += v; if (sum >= room) { sum = room; capped = true; break; } }
    }
    return { vals, sum, capped };
  }

  // Fortune Choice: choices0 Choices on 9 fresh positions; per = the line win (0 for the buy: Bonus Total is paid on
  // the bet); room = Bonus Total headroom under the cap. Returns the board, every pick and the Bonus Total.
  function fortuneChoice(md, choices0, rng, room) {
    // the 9 rewards: the kind by its share, then the value from that kind's pool
    const board = [], kt = table({ 0: md.fc.mult, 1: md.fc.charge, 2: md.fc.choice2 });
    for (let i = 0; i < 9; i++) {
      const k = kt.draw(rng);
      board[i] = k === 0 ? { t: "mult", v: md.mt.draw(rng) } : k === 1 ? { t: "charge", n: md.ct.draw(rng) } : { t: "choice2" };
    }
    const active = board.map((_, i) => i), picks = [];
    let choices = Math.min(9, choices0), bonus = 0, capped = false;
    while (choices > 0 && active.length && !capped) {
      // Choice +2 is allowed only when (Choices left after this one) + 2 <= positions left after this one
      const ok = active.filter((i) => board[i].t !== "choice2" || (choices - 1) + 2 <= active.length - 1);
      if (!ok.length) break;
      const pos = ok[Math.floor(rng() * ok.length)];
      active.splice(active.indexOf(pos), 1); choices--;
      const b = board[pos], pick = { pos, t: b.t };
      if (b.t === "mult") { pick.v = Math.min(b.v, room - bonus); bonus += pick.v; capped = bonus >= room; }
      else if (b.t === "charge") { const run = chargeRun(md, b.n, rng, room - bonus); pick.n = b.n; pick.vals = run.vals; pick.sum = run.sum; bonus += run.sum; capped = run.capped || bonus >= room; }
      else { choices += 2; pick.add = 2; }
      picks.push(pick);
    }
    return { choices0: Math.min(9, choices0), board, picks, bonus, capped };
  }

  // shared settlement: lines, main multiplier (centre chip + its CHARGE run), natural Fortune Choice, cap
  function settle(grid, multIndex, bet, stake, rng, mode) {
    rng = rng || Math.random;
    const m = mode === undefined ? curMode : mode, md = MD(m), strip = STRIPS[m];
    const mv = strip[((multIndex % strip.length) + strip.length) % strip.length];
    const lines = evalLines(grid);
    const base = lines.reduce((a, l) => a + l.pay, 0);
    const superCells = new Set();                // a SUPER WILD counts once even on several winning lines
    lines.forEach((l) => l.rows.forEach((r, reel) => { if (grid[reel][r] === "super_wild") superCells.add(reel * 3 + r); }));
    const superCharges = {};
    grid.forEach((col, reel) => col.forEach((s, row) => { if (s === "super_wild") superCharges[reel * 3 + row] = swT.draw(rng); }));
    const superSteps = base > 0 ? [...superCells].reduce((a, c) => a + superCharges[c], 0) : 0;
    const roomX = base > 0 ? MAX_WIN / base : 0;                         // multiplier headroom under the cap
    // CHARGE symbols on the board: each gets its count from the mode's CHARGE counts (shown when it lands)
    const boardCharges = {};
    grid.forEach((col, reel) => col.forEach((s, row) => { if (s === "charge") boardCharges[reel * 3 + row] = md.ct.draw(rng); }));
    // main multiplier: the centre chip (a CHARGE chip runs its actions), then every board CHARGE runs its actions
    let mult = mv > 0 ? mv : 0, nudges = [], chipSteps = 0, capped = false;
    if (base > 0 && mv < 0) { chipSteps = -mv; const run = chargeRun(md, chipSteps, rng, roomX); nudges = run.vals; mult = run.sum; capped = run.capped; }
    const boardRuns = [];
    if (base > 0) for (const c of Object.keys(boardCharges).map(Number).sort((a, b) => a - b)) {
      if (capped) break;
      const n = boardCharges[c], run = chargeRun(md, n, rng, roomX - mult);
      boardRuns.push({ cell: c, n, vals: run.vals, sum: run.sum }); mult += run.sum; capped = run.capped;
    }
    mult = Math.max(1, Math.min(mult, roomX || mult));
    if (base > 0 && mult >= roomX) capped = true;
    // natural Fortune Choice (same mode and pools)
    let fc = null, bonus = 0;
    if (superSteps > 0 && !capped) { fc = fortuneChoice(md, superSteps, rng, roomX - mult); bonus = fc.bonus; capped = fc.capped; }
    const mainX = base * mult, bonusX = base * bonus;
    let totalX = mainX + bonusX;
    if (totalX >= MAX_WIN - 1e-9) { totalX = MAX_WIN; capped = true; }
    return {
      mode: m, grid, multIndex, startMult: mv, nudges, boardCharges, boardRuns, mult: mult + bonus, mainMult: mult, lines, superCells: [...superCells], superCharges, superSteps, chipSteps, fc, bonus,
      baseX: base, mainX, bonusX, totalX, capped, stake, win: round2(totalX * bet), baseWin: round2(base * bet), mainWin: round2(mainX * bet), bonusWin: round2(bonusX * bet),
    };
  }

  function spin(bet, ex, rng) {
    rng = rng || Math.random;
    const m = modeOf(ex), md = MD(m);
    const grid = [0, 1, 2].map(() => [0, 1, 2].map(() => pickSym(rng)));
    const mv = md.landT.draw(rng);
    return settle(grid, stripIndex(m, mv, rng), bet, bet * md.cost, rng, m);
  }
  // symbols have names, so they get their own sampler (table() is for numeric keys)
  const symCum = (() => { let t = 0; return SYMBOLS.map((s) => (t += WEIGHTS[s])); })(), symTot = symCum[symCum.length - 1];
  function pickSym(rng) { const r = rng() * symTot; for (let i = 0; i < symCum.length; i++) if (r < symCum[i]) return SYMBOLS[i]; return SYMBOLS[0]; }

  // Buy Bonus: Fortune Choice at once. Bonus Total = starting multiplier + every pick; paid on the bet.
  function buySpin(kind, bet, ex, rng) {
    rng = rng || Math.random;
    const room = MAX_WIN, start = Math.min(BUYM.mt.draw(rng), room);
    const fc = fortuneChoice(BUYM, BUYM.choices.draw(rng), rng, room - start);
    fc.start = start;
    const totalX = Math.min(MAX_WIN, start + fc.bonus), multIndex = stripIndex("buy", start, rng);
    return {
      mode: "buy", bought: "bonus", grid: null, multIndex, startMult: start, nudges: [], boardCharges: {}, boardRuns: [], mult: totalX, mainMult: 0, lines: [], superCells: [], superCharges: {}, superSteps: 0,
      chipSteps: 0, fc, bonus: totalX, baseX: 0, mainX: 0, bonusX: totalX, totalX, capped: totalX >= MAX_WIN || fc.capped, stake: BUYM.cost * bet,
      win: round2(totalX * bet), baseWin: 0, mainWin: 0, bonusWin: round2(totalX * bet),
    };
  }

  function round2(v) { return Math.round(v * 100) / 100; }
  function tier(x) {
    if (x >= MAX_WIN) return "max";
    if (x >= 100) return "epic";
    if (x >= 50) return "super";
    if (x >= 25) return "mega";
    if (x >= 10) return "big";
    return x > 0 ? "small" : "none";
  }

  // demo / QA search: a seed whose round matches a kind
  function findRound(kind, bet, ex, start) {
    const m = modeOf(ex), strip = STRIPS[m];
    if (kind === "longrun" && m === 0) return null;   // base CHARGE counts are 3 / 5: never more than 26 actions
    for (let s = start || 1; s < (start || 1) + 2000000; s++) {
      const r = spin(bet, ex, mulberry32(s));
      const t = tier(r.totalX);
      const ok = {
        nowin: r.totalX === 0,
        win: t === "small",
        wild: r.lines.some((l) => l.rows.some((row, reel) => r.grid[reel][row] === "wild")) && t === "small",
        superwild: !!r.fc,
        fc: !!r.fc, fcchoice: !!r.fc && r.fc.picks.some((p) => p.t === "choice2"), fccharge: !!r.fc && r.fc.picks.some((p) => p.t === "charge"),
        nudge4: r.nudges.length >= 4 || (!!r.fc && r.fc.picks.length >= 4),
        big: t === "big", mega: t === "mega", super: t === "super", epic: t === "epic", max: t === "max",
        tease: r.totalX === 0 && r.grid[0].concat(r.grid[1]).filter((x) => WILDS.has(x)).length >= 2,
        m1000: r.startMult === 1000 && r.baseX > 0,
        halo: r.nudges.length === 0 && !r.fc && r.mult >= 100 && r.baseX > 0 && r.win >= r.stake,
        nudgechip: r.chipSteps > 0 && r.totalX < 100,
        nudgechain: r.nudges.some((v) => v < 0),
        longrun: r.nudges.length > 26 || (!!r.fc && r.fc.picks.some((p) => p.vals && p.vals.length > 26)),
        fcbig: !!r.fc && r.fc.picks.length >= 5,
        boardcharge: r.boardRuns.length > 0, boardcharge2: r.boardRuns.length > 1, chargeland: Object.keys(r.boardCharges).length > 0 && r.baseX === 0,
        nudgetease: r.startMult < 0 && r.baseX === 0,
        clash: r.nudges.length === 0 && !r.fc && r.startMult >= 5 && r.baseX > 0 && strip[(r.multIndex + 1) % strip.length] > r.startMult,
      }[kind];
      if (ok) return { seed: s, round: r };
    }
    return null;
  }

  const api = { SYMBOLS, WILDS, PAY, WEIGHTS, LINES, MULT_VALUES, CHARGE_COUNTS, SW_CHARGES, NUDGE_CHIPS, MAX_WIN, MAX_ACTIONS,
    MODES, BUY, BUYM, BUY_POOL, STRIPS, EX_COST, TUNE, NUDGES: 2, EX_BOOST: 1, NUDGE_EX: 1,
    mulberry32, spin, buySpin, settle, fortuneChoice, chargeRun, tier, findRound, evalLines, payOf: (s) => PAY[s] * PAY_SCALE,
    setMode: (m) => { curMode = modeOf(m); return curMode; }, mode: () => curMode, modeOf, stripOf: (m) => STRIPS[modeOf(m)],
    MULT_W: BASE_COL, MAX_STEPS: MAX_ACTIONS };
  Object.defineProperty(api, "STRIP", { get: () => STRIPS[curMode], enumerable: true });
  if (typeof module !== "undefined") module.exports = api; else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
