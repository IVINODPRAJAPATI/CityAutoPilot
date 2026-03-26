window.MetricsEngine = (function () {

  // PHASE 3: FIXED ABSOLUTE CLIMATE RANGES — never shift with run data.
  // Based on Chennai urban climate reality (T. Nagar).
  const FIXED = {
    TEMP_MIN:    25,   // best-case with full vegetation
    TEMP_MAX:    45,   // extreme Chennai summer peak
    FLOOD_MIN:   0,
    FLOOD_MAX:   1.0,  // fully inundated cell
    ENERGY_MIN:  0,
    ENERGY_MAX:  2000, // peak city-wide AC load (kWh)
    BIO_MIN:     0,
    BIO_MAX:     1
  };

  function compute(grid) {
    if (!grid || !grid.length) {
      return { avgTemp: 32, floodRisk: 0, energyLoad: 0, biodiversity: 0, budgetUsed: 0, healthScore: 50 };
    }

    let sumTemp = 0, sumFlood = 0, sumEnergy = 0, totalCost = 0;
    const n = grid.length * grid[0].length;

    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const cell = grid[i][j];
        sumTemp    += (cell.temp        || 0);
        sumFlood   += (cell.water       || 0);
        sumEnergy  += (cell.energyLoad  || 0);
        totalCost  += (cell.cost        || 0);
      }
    }

    const avgTemp     = sumTemp  / n;
    const floodRisk   = sumFlood / n;
    const energyLoad  = sumEnergy;
    const biodiversity = window.SimulationEngine ? window.SimulationEngine.runBiodiversity(grid) : 0;

    const metrics = {
      avgTemp,
      floodRisk,
      energyLoad,
      biodiversity,
      budgetUsed: totalCost,
      get healthScore() { return _healthScore(this); }
    };

    return metrics;
  }

  // PHASE 4: rainMode caps flood contribution so it can't destroy the score.
  function _healthScore(metrics, rainMode = false) {
    let normTemp   = (metrics.avgTemp    - FIXED.TEMP_MIN)   / (FIXED.TEMP_MAX   - FIXED.TEMP_MIN);
    let normFlood  = (metrics.floodRisk  - FIXED.FLOOD_MIN)  / (FIXED.FLOOD_MAX  - FIXED.FLOOD_MIN);
    let normEnergy = (metrics.energyLoad - FIXED.ENERGY_MIN) / (FIXED.ENERGY_MAX - FIXED.ENERGY_MIN);
    let normBio    = metrics.biodiversity;

    // Clamp all to [0, 1]
    normTemp   = Math.max(0, Math.min(1, normTemp));
    normFlood  = Math.max(0, Math.min(1, normFlood));
    normEnergy = Math.max(0, Math.min(1, normEnergy));
    normBio    = Math.max(0, Math.min(1, normBio));

    // PHASE 4 — cap flood contribution during rain to prevent score collapse
    if (rainMode) normFlood = Math.min(normFlood, 0.8);

    // Dampen energy dominance  
    normEnergy = Math.pow(normEnergy, 0.5);

    const raw = 100 - (
      normTemp   * 30 +
      normFlood  * 30 +
      normEnergy * 20 +
      (1 - normBio) * 20
    );

    // PHASE 3: Floor at 20 — score NEVER collapses below 20
    return Math.max(20, Math.min(100, Math.round(raw)));
  }

  // Exposed public API — rainMode flag for rainfall page
  function healthScore(metrics, rainMode = false) {
    return _healthScore(metrics, rainMode);
  }

  // Backward-compat: optimizer still calls getObserved()
  function getObserved() {
    return {
      maxTemp: FIXED.TEMP_MAX, minTemp: FIXED.TEMP_MIN,
      maxFlood: FIXED.FLOOD_MAX, minFlood: FIXED.FLOOD_MIN,
      maxEnergy: FIXED.ENERGY_MAX, minEnergy: FIXED.ENERGY_MIN
    };
  }

  return { compute, healthScore, getObserved };
})();
