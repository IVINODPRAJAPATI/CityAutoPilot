window.OptimizationEngine = (function () {
  'use strict';

  // ── Green type registry for biodiversity tracking ─────────────────────────
  const GREEN_TYPES = {
    tree:        'tree',
    green_roof:  'green_roof',
    corridor:    'corridor',
    rain_garden: 'rain_garden',
    permeable:   'permeable_patch'
  };

  // ── STEP 1: Severity per cell per policy ──────────────────────────────────
  function _severity(cell, policy) {
    const heat  = (cell.temp  || 36) * (cell.density || 0.5);          // temp × density
    const flood = (cell.water || 0)  * (1 - (cell.permeability || 0.1));// water × impermeability
    const eco   = 1 - (cell.vegetation || 0.1);                         // bare land need
    const elev  = 1 - Math.min(1, (cell.elevation || 5) / 10);          // lower = worse flood

    switch (policy) {
      case 'heat':    
        // Boost road heat severity because they reach critical temps faster
        const roadBoost = (cell.type === 'road') ? 1.4 : 1.0;
        return heat * roadBoost;
      case 'flood':   return flood * 0.6 + elev * 0.4;
      case 'eco':     return eco;
      default:        return heat * 0.45 + flood * 0.25 + eco * 0.30;
    }
  }

  // ── Intervention selection — real-world T. Nagar rules ─────────────────────
  // GREEN DOT = tree planting: roadside strips, medians, building compounds
  // BROWN DOT = permeable pavement: ripping out concrete on ROADS only
  function _pickIntervention(cell, policy, isNeighbour) {
    if (cell.intervention !== 'none') return null;
    const t    = cell.type;
    const veg  = cell.vegetation   || 0;
    const perm = cell.permeability || 0.1;
    const wat  = cell.water        || 0;
    const dens = cell.density      || 0.5;

    if (isNeighbour) {
      // Neighbours get lightweight version appropriate to their type
      if (t === 'road')     return veg < 0.5 ? 'tree'      : null;  // roadside planting
      if (t === 'building') return veg < 0.5 ? 'green_roof': null;  // green roof
      return null;
    }

    switch (policy) {
      case 'heat':
        // Real-world: Don't ignore water even when optimizing for heat
        if (wat > 0.2 && t === 'road')      return 'permeable'; 
        if (wat > 0.2 && t === 'building')  return 'drainage';
        
        // Primary goal: Trees (Green Dots)
        if (t === 'road')     return 'tree'; 
        if (t === 'building') return (Math.random() < 0.7) ? 'tree' : 'green_roof';
        return null;

      case 'flood':
        // Primary goal: Drainage & Permeability (Blue/Brown)
        if (t === 'road')     return 'permeable';
        if (t === 'building') return 'drainage';
        return null;

      case 'eco':
        // Favor nature-based solutions, but keep drainage functional
        if (wat > 0.3)        return (t === 'road' ? 'permeable' : 'drainage');
        if (t === 'road')     return 'tree';
        if (t === 'building') return 'green_roof';
        return null;

      default: // balanced
        // High flood risk area? Use blue/brown technical solutions first
        if (wat > 0.25) {
          return (t === 'road') ? 'permeable' : 'drainage';
        }
        // Bare land / Urban heat area? Use green solutions
        if (veg < 0.3) {
          return (t === 'road') ? 'tree' : (Math.random() < 0.6 ? 'tree' : 'green_roof');
        }
        // General urban maintenance
        if (t === 'road')     return 'tree';
        return 'drainage';
    }
  }

  // ── Apply intervention — mutates cell + logs explainability ───────────────
  function _apply(cell, intervention, i, j, policy, isNeighbour) {
    const costs = (window.Constants && window.Constants.COSTS) || {};
    const cost  = isNeighbour
      ? ((costs[intervention] || 1) * 0.4)  // neighbours cost 40% of main
      : (costs[intervention] || 1);

    switch (intervention) {
      case 'tree':
        cell.type        = 'green';
        cell.greenType   = GREEN_TYPES.tree;
        cell.vegetation  = Math.min(1, (cell.vegetation  || 0) + 0.6);
        cell.permeability= Math.min(1, (cell.permeability|| 0) + 0.15);
        break;
      case 'green_roof':
        cell.greenType   = GREEN_TYPES.green_roof;
        cell.vegetation  = Math.min(1, (cell.vegetation  || 0) + 0.55);
        cell.permeability= Math.min(1, (cell.permeability|| 0) + 0.25);
        break;
      case 'permeable':
        cell.greenType   = GREEN_TYPES.permeable;
        cell.permeability= Math.min(1, (cell.permeability|| 0) + 0.55);
        break;
      case 'drainage':
        cell.permeability= 1.0;
        break;
    }

    cell.intervention = intervention;
    cell.cost = (cell.cost || 0) + cost;

    if (!isNeighbour && window.ExplainabilityEngine) {
      const reason = `${policy.toUpperCase()} — Temp:${(cell.temp||0).toFixed(1)}°C `
        + `Water:${(cell.water||0).toFixed(2)} Perm:${(cell.permeability||0).toFixed(2)} `
        + `Elev:${(cell.elevation||5).toFixed(1)}m`;
      window.ExplainabilityEngine.logChange(i, j, intervention, reason, {
        tempDrop:       ['tree','green_roof'].includes(intervention) ? 3 : 0,
        floodReduction: ['drainage','permeable'].includes(intervention) ? 0.3 : 0,
        cost
      });
    }
    return cost;
  }

  // ── Score helper ──────────────────────────────────────────────────────────
  function _score(grid) {
    return window.MetricsEngine.compute(grid).healthScore;
  }

  // ── STEP 6: Zone-based budget distribution ────────────────────────────────
  // Divide 20x20 grid into 4x4 blocks of 5x5 cells = 16 zones
  // Each zone gets equal share of budget so interventions spread across grid
  function _buildZones(grid) {
    const zones = [];
    const SIZE = grid.length; // 20
    const ZONE = 5;
    for (let zi = 0; zi < SIZE; zi += ZONE) {
      for (let zj = 0; zj < SIZE; zj += ZONE) {
        const cells = [];
        for (let i = zi; i < Math.min(zi + ZONE, SIZE); i++) {
          for (let j = zj; j < Math.min(zj + ZONE, SIZE); j++) {
            cells.push({ i, j });
          }
        }
        zones.push(cells);
      }
    }
    return zones;
  }

  // ── STEP 2: Cluster application ───────────────────────────────────────────
  function _applyCluster(workGrid, ci, cj, intervention, policy) {
    const cell = workGrid[ci][cj];
    const applied = [];

    // Apply main cell only (disable clustering to prevent 'grping' look)
    const mainCost = _apply(cell, intervention, ci, cj, policy, false);
    applied.push({ i: ci, j: cj, cost: mainCost });

    return applied;
  }

  // ══════════════════════════════════════════════════════════════════════
  // PUBLIC: optimize()
  // ══════════════════════════════════════════════════════════════════════
  function optimize(baseGrid, policy, constraints, rainfall) {
    if (window.ExplainabilityEngine && window.ExplainabilityEngine.reset) {
      window.ExplainabilityEngine.reset();
    }

    const policyStr = typeof policy === 'string' ? policy : 'balanced';
    const budget    = (constraints && constraints.budget) ? constraints.budget : 100;
    const rain      = rainfall || 0;

    // Clone and simulate from baseGrid
    const workGrid = window.GridEngine.cloneGrid(baseGrid);
    window.SimulationEngine.simulate(workGrid, rain);
    const initialScore = _score(workGrid);

    // STEP 1: Score ALL cells by severity
    const allCells = [];
    for (let i = 0; i < workGrid.length; i++) {
      for (let j = 0; j < workGrid[i].length; j++) {
        const c = workGrid[i][j];
        if (c.type === 'water') continue;
        // Add tiny random jitter to break ties (prevents sequential grid scan look)
        const jitter = Math.random() * 0.01;
        allCells.push({ i, j, sev: _severity(c, policyStr) + jitter });
      }
    }
    allCells.sort((a, b) => b.sev - a.sev);

    // STEP 6: Zone-based budget — each zone gets equal slice
    const zones = _buildZones(workGrid);
    const perZoneBudget = budget / zones.length;

    // Track zone budgets
    const zoneSize = 5;
    function getZoneIdx(i, j) {
      const zi = Math.floor(i / zoneSize);
      const zj = Math.floor(j / zoneSize);
      const zonesPerRow = Math.ceil(workGrid.length / zoneSize);
      return zi * zonesPerRow + zj;
    }
    const zoneBudgetUsed = new Array(zones.length).fill(0);

    let totalBudget = 0;
    let clusters    = 0;
    let totalApplied= 0;
    const iterationGrids = [];

    // STEP 2: Process worst cells first, apply clusters
    for (const { i, j } of allCells) {
      if (totalBudget >= budget) break;

      const cell = workGrid[i][j];
      if (cell.intervention !== 'none') continue;

      const intervention = _pickIntervention(cell, policyStr, false);
      if (!intervention) continue;

      const mainCost = (window.Constants && window.Constants.COSTS)
        ? (window.Constants.COSTS[intervention] || 1) : 1;

      const zIdx = getZoneIdx(i, j);
      if (zoneBudgetUsed[zIdx] + mainCost > perZoneBudget * 1.5) continue; // zone cap with 50% overflow

      // Backup main cell
      const backup = { type: cell.type, greenType: cell.greenType,
        vegetation: cell.vegetation, permeability: cell.permeability,
        intervention: cell.intervention, cost: cell.cost };

      // Apply cluster (main + neighbours)
      const clusterApplied = _applyCluster(workGrid, i, j, intervention, policyStr);
      const clusterCost = clusterApplied.reduce((s, a) => s + a.cost, 0);

      if (totalBudget + clusterCost > budget) {
        // Revert all cluster changes
        Object.assign(cell, backup);
        for (const { i: ni, j: nj, cost } of clusterApplied.slice(1)) {
          const nb = workGrid[ni][nj];
          nb.intervention = 'none';
          nb.cost = Math.max(0, (nb.cost || 0) - cost);
          nb.greenType = 'null';
        }
        continue;
      }

      // Accept cluster
      totalBudget += clusterCost;
      zoneBudgetUsed[zIdx] += clusterCost;
      clusters++;
      totalApplied += clusterApplied.length;

      if (clusters % 3 === 0 || clusters <= 2) {
        iterationGrids.push(window.GridEngine.cloneGrid(workGrid));
      }
    }

    // Final simulation pass to recompute all physics on intervened grid
    window.SimulationEngine.simulate(workGrid, rain);
    const finalScore = _score(workGrid);

    // STEP 5: Biodiversity (Step 5 fix)
    const uniqueGreenTypes = new Set();
    for (let i = 0; i < workGrid.length; i++) {
      for (let j = 0; j < workGrid[i].length; j++) {
        const c = workGrid[i][j];
        if (c.greenType && c.greenType !== 'null') uniqueGreenTypes.add(c.greenType);
        if (c.type === 'green') uniqueGreenTypes.add('green');
      }
    }
    const biodiversity = Math.min(1, uniqueGreenTypes.size / 4);

    console.log(`[Optimizer] ${policyStr} | before:${initialScore} → after:${finalScore}`
      + ` | clusters:${clusters} applied:${totalApplied}`
      + ` | budget:${totalBudget.toFixed(1)}/${budget}`
      + ` | biodiversity:${(biodiversity*100).toFixed(0)}%`);

    // Safety: never return worse grid
    if (finalScore < initialScore) {
      const safe = window.GridEngine.cloneGrid(baseGrid);
      window.SimulationEngine.simulate(safe, rain);
      return { bestGrid: safe, iterationGrids: [], initialScore, finalScore: initialScore,
               clusters: 0, applied: 0, budgetUsed: 0, biodiversity: 0 };
    }

    return { bestGrid: workGrid, iterationGrids, initialScore, finalScore,
             clusters, applied: totalApplied, budgetUsed: totalBudget, biodiversity };
  }

  return { optimize };
})();
