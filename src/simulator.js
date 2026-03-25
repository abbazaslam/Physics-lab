// simulator.js — MNA circuit engine with pre-solve connection validation

// ─── Gaussian elimination ─────────────────────────────────────────────────────
function gaussianElimination(A, b) {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
    }
    [A[col], A[maxRow]] = [A[maxRow], A[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];
    if (Math.abs(A[col][col]) < 1e-12) continue;
    for (let row = col + 1; row < n; row++) {
      const factor = A[row][col] / A[col][col];
      for (let k = col; k < n; k++) A[row][k] -= factor * A[col][k];
      b[row] -= factor * b[col];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    if (Math.abs(A[i][i]) < 1e-12) { x[i] = 0; continue; }
    x[i] = b[i];
    for (let j = i + 1; j < n; j++) x[i] -= A[i][j] * x[j];
    x[i] /= A[i][i];
  }
  return x;
}

// ─── Pre-solve connection validation ─────────────────────────────────────────
// Runs BEFORE MNA, only when a PSU is ON.
// Returns faults[] — if any are found, MNA is skipped entirely.
function validateConnections(components, getNode) {
  const faults = [];

  const activePSUs = components.filter(c => c.type === "power" && c.on !== false);
  const hasGround  = components.some(c => c.type === "ground");

  // 1. No ground
  if (!hasGround) {
    faults.push({
      type: "no_ground",
      message: "No Ground component found. Add a Ground and connect it to the negative terminal.",
    });
  }

  // 2. Floating terminals — any component with an unconnected terminal
  for (const c of components) {
    if (c.type === "ground") continue;

    const termPairs = {
      power:    [`${c.id}-positive`, `${c.id}-negative`],
      resistor: [`${c.id}-left`,     `${c.id}-right`],
      led:      [`${c.id}-anode`,    `${c.id}-cathode`],
    };
    const pair = termPairs[c.type];
    if (!pair) continue;

    const [t1, t2] = pair;
    const n1 = getNode(t1), n2 = getNode(t2);

    if (n1 < 0 || n2 < 0) {
      const which = n1 < 0 ? (c.type === "led" ? "anode" : c.type === "power" ? "positive (+)" : "left") :
                             (c.type === "led" ? "cathode" : c.type === "power" ? "negative (−)" : "right");
      faults.push({
        type: "floating",
        message: `${labelFor(c)} has its ${which} terminal unconnected.`,
        componentId: c.id,
      });
    } else if (n1 === n2) {
      faults.push({
        type: "short_self",
        message: `${labelFor(c)} has both terminals on the same node — it won't do anything.`,
        componentId: c.id,
      });
    }
  }

  // 3. Check every active PSU has a complete path to ground
  // Simple reachability: from PSU positive terminal, can we reach PSU negative
  // through the wire/component graph?
  for (const psu of activePSUs) {
    const posNode = getNode(`${psu.id}-positive`);
    const negNode = getNode(`${psu.id}-negative`);
    if (posNode < 0 || negNode < 0) continue; // already caught above
    if (posNode === negNode) {
      faults.push({
        type: "short_circuit",
        message: `Power supply terminals are directly connected — short circuit!`,
        componentId: psu.id,
      });
    }
  }

  return faults;
}

function labelFor(c) {
  if (c.type === "power")    return "Power Supply";
  if (c.type === "resistor") return "Resistor";
  if (c.type === "led")      return "LED";
  return c.type;
}

// ─── Post-solve fault detection ───────────────────────────────────────────────
function detectFaults(components, getNode, nodeVoltages, branchCurrents, voltageSrcs, leds) {
  const faults = [];

  // Short circuit — extremely high current from a PSU
  voltageSrcs.forEach((vs, k) => {
    const I = Math.abs(branchCurrents[k] ?? 0);
    if (I > 5)
      faults.push({
        type: "short_circuit",
        message: `Short circuit detected! Current is ${(I * 1000).toFixed(0)}mA. Add a resistor to limit current.`,
        componentId: vs.id,
      });
  });

  // LED reverse polarity
  leds.forEach((led) => {
    const Vak = nodeVoltages[led.nA] - nodeVoltages[led.nK];
    if (Vak < -0.1)
      faults.push({
        type: "reverse_polarity",
        message: `LED is connected in reverse (Vak = ${Vak.toFixed(2)}V). Swap anode (+) and cathode (−).`,
        componentId: led.id,
      });
  });

  // Open circuit — PSU is on but no current flows
  const anyCurrentFlowing = branchCurrents.some(I => Math.abs(I) > 1e-6);
  if (voltageSrcs.length > 0 && !anyCurrentFlowing)
    faults.push({
      type: "open_circuit",
      message: "Open circuit — no current is flowing. Make sure the circuit forms a complete loop.",
    });

  return faults;
}

// ─── Main solver ──────────────────────────────────────────────────────────────
export function simulate(components, wires) {
  // ── 1. Union-Find node assignment ──────────────────────────────────────
  const parent = {};
  const find = (x) => {
    if (parent[x] === undefined) parent[x] = x;
    return parent[x] === x ? x : (parent[x] = find(parent[x]));
  };
  const union = (a, b) => { parent[find(a)] = find(b); };
  for (const wire of wires) union(wire.from, wire.to);

  const allTerminals = [];
  for (const c of components) {
    if (c.type === "power")    allTerminals.push(`${c.id}-positive`, `${c.id}-negative`);
    if (c.type === "resistor") allTerminals.push(`${c.id}-left`,     `${c.id}-right`);
    if (c.type === "led")      allTerminals.push(`${c.id}-anode`,    `${c.id}-cathode`);
    if (c.type === "ground")   allTerminals.push(`${c.id}-gnd`);
  }

  const termToNode = {};
  let nodeCount = 1;
  components.filter(c => c.type === "ground")
    .forEach(c => { termToNode[find(`${c.id}-gnd`)] = 0; });
  for (const t of allTerminals) {
    const root = find(t);
    if (termToNode[root] === undefined) termToNode[root] = nodeCount++;
  }
  const getNode = (termId) => termToNode[find(termId)] ?? -1;

  // ── 2. Pre-solve validation (only when a PSU is ON) ────────────────────
  const anyPsuOn = components.some(c => c.type === "power" && c.on !== false);
  if (anyPsuOn) {
    const preFaults = validateConnections(components, getNode);
    if (preFaults.length > 0) {
      // Return immediately — don't run MNA with a broken circuit
      const results = buildZeroResults(components);
      return { nodeVoltages: new Array(nodeCount).fill(0), results, faults: preFaults };
    }
  }

  // ── 3. Catalogue elements ──────────────────────────────────────────────
  const resistors   = [];
  const voltageSrcs = [];
  const leds        = [];

  for (const c of components) {
    if (c.type === "resistor") {
      const n1 = getNode(`${c.id}-left`), n2 = getNode(`${c.id}-right`);
      if (n1 >= 0 && n2 >= 0) resistors.push({ n1, n2, R: c.resistance ?? 1000, id: c.id });
    } else if (c.type === "power") {
      const nPos = getNode(`${c.id}-positive`), nNeg = getNode(`${c.id}-negative`);
      // Skip PSU if turned off — acts as open circuit
      if (nPos >= 0 && nNeg >= 0 && c.on !== false)
        voltageSrcs.push({ posNode: nPos, negNode: nNeg, voltage: c.voltage ?? 5, id: c.id });
    } else if (c.type === "led") {
      const nA = getNode(`${c.id}-anode`), nK = getNode(`${c.id}-cathode`);
      if (nA >= 0 && nK >= 0) leds.push({ nA, nK, Vf: 2.0, Rf: 50, id: c.id });
    }
  }

  // ── 4. Iterative MNA with Norton companion LED model ───────────────────
  const MAX_ITER = 20;
  let ledOn = leds.map(() => false);
  let nodeVoltages   = new Array(nodeCount).fill(0);
  let branchCurrents = [];

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const nFree = nodeCount - 1;
    const nVS   = voltageSrcs.length;
    const size  = nFree + nVS;
    if (size === 0) break;

    const G = Array.from({ length: size }, () => new Array(size).fill(0));
    const b = new Array(size).fill(0);
    const nr = (n) => n - 1;

    for (const r of resistors) {
      const g = 1 / r.R;
      if (r.n1 > 0) G[nr(r.n1)][nr(r.n1)] += g;
      if (r.n2 > 0) G[nr(r.n2)][nr(r.n2)] += g;
      if (r.n1 > 0 && r.n2 > 0) { G[nr(r.n1)][nr(r.n2)] -= g; G[nr(r.n2)][nr(r.n1)] -= g; }
    }

    leds.forEach((led, i) => {
      if (!ledOn[i]) {
        const g = 1 / 1e9;
        if (led.nA > 0) G[nr(led.nA)][nr(led.nA)] += g;
        if (led.nK > 0) G[nr(led.nK)][nr(led.nK)] += g;
        if (led.nA > 0 && led.nK > 0) { G[nr(led.nA)][nr(led.nK)] -= g; G[nr(led.nK)][nr(led.nA)] -= g; }
      } else {
        const g = 1 / led.Rf, I = led.Vf / led.Rf;
        if (led.nA > 0) { G[nr(led.nA)][nr(led.nA)] += g; b[nr(led.nA)] += I; }
        if (led.nK > 0) { G[nr(led.nK)][nr(led.nK)] += g; b[nr(led.nK)] -= I; }
        if (led.nA > 0 && led.nK > 0) { G[nr(led.nA)][nr(led.nK)] -= g; G[nr(led.nK)][nr(led.nA)] -= g; }
      }
    });

    voltageSrcs.forEach((vs, k) => {
      const row = nFree + k;
      if (vs.posNode > 0) { G[nr(vs.posNode)][row] += 1; G[row][nr(vs.posNode)] += 1; }
      if (vs.negNode > 0) { G[nr(vs.negNode)][row] -= 1; G[row][nr(vs.negNode)] -= 1; }
      b[row] = vs.voltage;
    });

    const x = gaussianElimination(G, b);
    nodeVoltages = new Array(nodeCount).fill(0);
    for (let n = 1; n < nodeCount; n++) nodeVoltages[n] = x[nr(n)] ?? 0;
    branchCurrents = voltageSrcs.map((_, k) => x[nFree + k] ?? 0);

    const newLedOn = leds.map((led, i) => {
      const Vak = nodeVoltages[led.nA] - nodeVoltages[led.nK];
      return ledOn[i] ? Vak > led.Vf * 0.3 : Vak > led.Vf * 0.9;
    });
    if (newLedOn.every((v, i) => v === ledOn[i])) break;
    ledOn = newLedOn;
  }

  // ── 5. Post-solve fault detection ──────────────────────────────────────
  const faults = anyPsuOn
    ? detectFaults(components, getNode, nodeVoltages, branchCurrents, voltageSrcs, leds)
    : [];

  // ── 6. Build results ───────────────────────────────────────────────────
  const results = {};
  for (const c of components) {
    const f = faults.find(f => f.componentId === c.id) ?? null;
    if (c.type === "resistor") {
      const n1 = getNode(`${c.id}-left`), n2 = getNode(`${c.id}-right`);
      const Vr = Math.abs((n1 >= 0 ? nodeVoltages[n1] : 0) - (n2 >= 0 ? nodeVoltages[n2] : 0));
      const R  = c.resistance ?? 1000;
      results[c.id] = { voltage: +Vr.toFixed(3), current: +(Vr/R*1000).toFixed(3), power: +(Vr*Vr/R*1000).toFixed(3), fault: f };
    } else if (c.type === "led") {
      const idx = leds.findIndex(l => l.id === c.id);
      const lit = idx >= 0 ? ledOn[idx] : false;
      const nA  = getNode(`${c.id}-anode`), nK = getNode(`${c.id}-cathode`);
      const Vak = nA >= 0 && nK >= 0 ? nodeVoltages[nA] - nodeVoltages[nK] : 0;
      const I   = lit ? Math.max(0, (Vak - (leds[idx]?.Vf ?? 2)) / (leds[idx]?.Rf ?? 50)) : 0;
      results[c.id] = { lit, voltage: +Vak.toFixed(3), current: +(I*1000).toFixed(2), fault: f };
    } else if (c.type === "power") {
      const idx = voltageSrcs.findIndex(v => v.id === c.id);
      const I   = idx >= 0 ? branchCurrents[idx] : 0;
      const V   = c.voltage ?? 5;
      results[c.id] = { voltage: V, current: +(Math.abs(I)*1000).toFixed(3), power: +(V*Math.abs(I)*1000).toFixed(3), fault: f, on: c.on !== false };
    } else if (c.type === "ground") {
      results[c.id] = { voltage: 0, fault: null };
    }
  }

  return { nodeVoltages, results, faults };
}

// Returns zero/off results for all components (used when pre-validation fails)
function buildZeroResults(components) {
  const results = {};
  for (const c of components) {
    if (c.type === "resistor") results[c.id] = { voltage: 0, current: 0, power: 0, fault: null };
    else if (c.type === "led") results[c.id] = { lit: false, voltage: 0, current: 0, fault: null };
    else if (c.type === "power") results[c.id] = { voltage: c.voltage ?? 5, current: 0, power: 0, fault: null, on: c.on !== false };
    else if (c.type === "ground") results[c.id] = { voltage: 0, fault: null };
  }
  return results;
}