// Fortune Bull 1000 - math engine (pure; runs in the browser and in node for sim.mjs).
// 3x3, 5 fixed lines, WILD + SUPER WILD substitute, multiplier column (5 visible, centre applies).
// Each SUPER WILD on a winning line nudges the column NUDGES steps; every nudge adds the new centre value.
// NUDGE chips (strip values -3 / -5): landing in the centre on a win starts 3 / 5 nudges (the chip itself adds 0);
// a NUDGE chip reached by a nudge adds its steps to the count.
// Feature buys (BUY / buySpin): one paid spin with a guaranteed NUDGE chip in the centre, settled by the same code as spin().
(function (root) {
  const SYMBOLS = ["J", "Q", "K", "A", "hourglass", "sun", "chest", "wild", "super_wild"];
  const WILDS = new Set(["wild", "super_wild"]);
  // pays in multiples of the total bet, for 3 on a line
  const PAY = { J: 0.2, Q: 0.25, K: 0.3, A: 0.4, hourglass: 0.6, sun: 0.8, chest: 1.0, wild: 4, super_wild: 4 };
  const PAY_SCALE = 1.013;
  const WEIGHTS = { J: 18, Q: 17, K: 16, A: 15, hourglass: 9, sun: 8, chest: 7, wild: 3.2, super_wild: 0.79 };   // white: rarer, each carries 2-8 charges
  const EX_COST = 1.5;                      // EX doubles the SUPER WILD rate for 1.5x the bet
  const NUDGES = 2;
  const EX_BOOST = 1.75;
  const MAX_WIN = 5000;                     // x total bet
  const LINES = [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]];
  const MULT_W = { 1: 34, 2: 24, 3: 16, 5: 11, 10: 7, 15: 4.5, 20: 2.6, 25: 1.6, 50: 0.7, 100: 0.25, 500: 0.05, 1000: 0.02, "-3": 3.6, "-5": 1.3 };
  const NUDGE_EX = 1.8;                     // EX also lands NUDGE chips this much more often
  const NUDGE_CHIPS = [-3, -5];
  const SW_CHARGES = { 2: 55, 3: 20, 4: 11, 5: 6, 6: 4, 7: 2, 8: 2 };   // white: a SUPER WILD's own charge count (Garuda: 2..8)
  const MAX_STEPS = 40;
  const MULT_VALUES = [1, 2, 3, 5, 10, 15, 20, 25, 50, 100, 500, 1000];

  // Feature buys. Each buy is ONE spin for cost x bet (EX does not apply), settled by settle() exactly like spin():
  //  - grid: drawn cell by cell from WEIGHTS with SUPER WILD x swBoost (the same lever EX uses), and the whole grid
  //    is redrawn until the buy's promise holds (rejection sampling, so it is the boosted base-game grid conditioned
  //    on "a win" / "a SUPER WILD on a winning line");
  //  - centre: one of `chips`, picked with the base-game MULT_W ratio (NUDGE 3 : NUDGE 5 = 3.6 : 1.3), then a
  //    uniform random strip index holding that chip, as in spin().
  // Prices are whole multiples of the bet; swBoost is the single tuning knob that puts the RTP at 96.25%
  // (exact enumeration of all 9^9 grids + Monte Carlo: node tools/sim_buy.cjs).
  const BUY = {
    nudge: { name: "BULL CHARGE", cost: 8, chips: [-3, -5], need: "win", swBoost: 1.16,
      desc: "A sure win with CHARGE 3 or CHARGE 5 in the centre" },
    super: { name: "SUPER BULL", cost: 11, chips: [-5], need: "superwin", swBoost: 0.95,
      desc: "A sure win with CHARGE 5 and a SUPER WILD in the win" },
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(w, rng) {
    let tot = 0;
    for (const k in w) tot += w[k];
    let r = rng() * tot;
    for (const k in w) { r -= w[k]; if (r < 0) return k; }
    return Object.keys(w)[0];
  }

  // a fixed multiplier strip (deterministic shuffle), so nudges always show real neighbours
  const STRIP = (function () {
    const rng = mulberry32(1000), out = [];
    const counts = { 1: 70, 2: 48, 3: 32, 5: 22, 10: 14, 15: 9, 20: 5, 25: 4, 50: 2, 100: 1, 500: 1, 1000: 1, "-3": 3, "-5": 2 };
    for (const v in counts) for (let i = 0; i < counts[v]; i++) out.push(+v);
    for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
    return out;
  })();
  const STRIP_BY = {};
  STRIP.forEach((v, i) => (STRIP_BY[v] = STRIP_BY[v] || []).push(i));

  function evalLines(grid) {
    const wins = [];
    LINES.forEach((rows, li) => {
      const cells = rows.map((r, reel) => grid[reel][r]);
      const base = cells.find((s) => !WILDS.has(s));
      const sym = base || "wild";
      if (cells.every((s) => s === sym || WILDS.has(s))) {
        wins.push({ line: li + 1, sym, rows, pay: PAY[sym] * PAY_SCALE, supers: cells.filter((s) => s === "super_wild").length });
      }
    });
    return wins;
  }

  function spin(bet, ex, rng) {
    rng = rng || Math.random;
    const w = Object.assign({}, WEIGHTS);
    if (ex) w.super_wild *= EX_BOOST;
    const grid = [0, 1, 2].map(() => [0, 1, 2].map(() => pick(w, rng)));
    const mw = Object.assign({}, MULT_W);
    if (ex) { mw["-3"] *= NUDGE_EX; mw["-5"] *= NUDGE_EX; }
    const mv = +pick(mw, rng);
    const choices = STRIP_BY[mv];
    const multIndex = choices[Math.floor(rng() * choices.length)];
    return settle(grid, multIndex, bet, bet * (ex ? EX_COST : 1), rng);
  }

  // a bought spin (see BUY): same round shape as spin(), plus `bought: kind`; `ex` is ignored
  function buySpin(kind, bet, ex, rng) {
    const cfg = BUY[kind];
    if (!cfg) throw new Error("Engine.buySpin: unknown buy " + kind);
    rng = rng || Math.random;
    const w = Object.assign({}, WEIGHTS);
    w.super_wild *= cfg.swBoost;
    let grid = null;
    for (let tries = 0; !grid; tries++) {
      if (tries > 1e6) throw new Error("Engine.buySpin: the rng never met the condition");
      const g = [0, 1, 2].map(() => [0, 1, 2].map(() => pick(w, rng)));
      const lines = evalLines(g);
      if (cfg.need === "superwin" ? lines.some((l) => l.supers > 0) : lines.length > 0) grid = g;
    }
    const mw = {};
    cfg.chips.forEach((v) => (mw[v] = MULT_W[v]));
    const mv = +pick(mw, rng);
    const choices = STRIP_BY[mv];
    const multIndex = choices[Math.floor(rng() * choices.length)];
    const r = settle(grid, multIndex, bet, cfg.cost * bet, rng);
    r.bought = kind;
    return r;
  }

  // shared settlement (spin + buySpin): lines, SUPER WILD / NUDGE chip nudges, multiplier, max-win cap
  function settle(grid, multIndex, bet, stake, rng) {
    const mv = STRIP[multIndex];
    const lines = evalLines(grid);
    const base = lines.reduce((a, l) => a + l.pay, 0);
    // a SUPER WILD counts once even if it sits on several winning lines
    const superCells = new Set();
    lines.forEach((l) => l.rows.forEach((r, reel) => { if (grid[reel][r] === "super_wild") superCells.add(reel * 3 + r); }));
    const superCharges = {};                                     // white: every SUPER WILD on the grid has its own count
    grid.forEach((col, reel) => col.forEach((s, row) => { if (s === "super_wild") superCharges[reel * 3 + row] = +pick(SW_CHARGES, rng || Math.random); }));
    const superSteps = base > 0 ? [...superCells].reduce((a, c) => a + superCharges[c], 0) : 0;
    const chipSteps = base > 0 && mv < 0 ? -mv : 0;
    let steps = superSteps + chipSteps;
    const nudges = [];
    let idx = multIndex, mult = mv > 0 ? mv : 0;
    for (let k = 0; k < steps && k < MAX_STEPS; k++) {
      idx = (idx + 1) % STRIP.length;
      const v = STRIP[idx];
      nudges.push(v);
      if (v < 0) steps += -v; else mult += v;
    }
    mult = Math.max(1, mult);
    let totalX = base * mult;
    const capped = totalX > MAX_WIN;
    if (capped) totalX = MAX_WIN;
    return {
      grid, multIndex, startMult: mv, nudges, mult, lines, superCells: [...superCells], superCharges, superSteps, chipSteps,
      baseX: base, totalX, capped, stake, win: round2(totalX * bet), baseWin: round2(base * bet),
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

  // demo search: a seed whose round matches a kind (for the DEMO keys and QA)
  function findRound(kind, bet, ex, start) {
    for (let s = start || 1; s < (start || 1) + 2000000; s++) {
      const r = spin(bet, ex, mulberry32(s));
      const t = tier(r.totalX);
      const ok = {
        nowin: r.totalX === 0,
        win: t === "small",
        wild: r.lines.some((l) => l.rows.some((row, reel) => r.grid[reel][row] === "wild")) && t === "small",
        superwild: r.nudges.length > 0,
        nudge4: r.nudges.length >= 4,
        big: t === "big", mega: t === "mega", super: t === "super", epic: t === "epic", max: t === "max",
        tease: r.totalX === 0 && r.grid[0].concat(r.grid[1]).filter((x) => WILDS.has(x)).length >= 2,
        m1000: r.startMult === 1000 && r.baseX > 0,
        halo: r.nudges.length === 0 && r.mult >= 100 && r.baseX > 0 && r.win >= r.stake,      // a 100x+ throw: the halo wheel plays
        nudgechip: r.chipSteps > 0 && r.totalX < 100,
        nudgechain: r.nudges.some((v) => v < 0),
        nudgetease: r.startMult < 0 && r.baseX === 0,
        clash: r.nudges.length === 0 && r.startMult >= 5 && r.baseX > 0 && STRIP[(r.multIndex + 1) % STRIP.length] > r.startMult,
      }[kind];
      if (ok) return { seed: s, round: r };
    }
    return null;
  }

  const api = { SYMBOLS, WILDS, PAY, WEIGHTS, LINES, MULT_VALUES, STRIP, NUDGES, SW_CHARGES, EX_COST, MAX_WIN,
    EX_BOOST, NUDGE_EX, NUDGE_CHIPS, mulberry32, spin, tier, findRound, evalLines, payOf: (s) => PAY[s] * PAY_SCALE,
    BUY, buySpin, settle, MULT_W, MAX_STEPS };
  if (typeof module !== "undefined") module.exports = api; else root.Engine = api;
})(typeof window !== "undefined" ? window : globalThis);
