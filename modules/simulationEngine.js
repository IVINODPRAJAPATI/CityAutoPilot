window.SimulationEngine = (function () {

  // Base temperatures for T. Nagar cell types — realistic Chennai urban
  const BASE_TEMPS = { road: 40, building: 38, green: 29, water: 28 };
  const COMFORT_THRESHOLD = 24;

  function runHeat(grid) {
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const c = grid[i][j];
        const veg  = Math.max(0, Math.min(1, c.vegetation  || 0));
        const dens = Math.max(0, Math.min(1, c.density     || 0));
        const wat  = Math.max(0, Math.min(1, c.water       || 0));
        const base = BASE_TEMPS[c.type] || 36;

        // Each type: vegetation cools, water cools, density heats
        let temp;
        if (c.type === 'road') {
          temp = base + 2 * dens - 4 * veg - 2 * wat;
        } else if (c.type === 'building') {
          temp = base + 3 * dens - 5 * veg - 3 * wat;
        } else if (c.type === 'green') {
          temp = base - 6 * veg;
        } else { // water
          temp = base;
        }

        c.temp = Math.max(25, Math.min(45, temp));
      }
    }
  }

  function runFlood(grid, rainfall) {
    // rainfall: 0–100 scale. Map to intensity 0–80 mm/hr
    const intensity = (rainfall / 100) * 80;
    const C = 0.75; // rational method coefficient

    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const c = grid[i][j];
        const perm = Math.max(0, Math.min(1, c.permeability || 0.1));
        // Runoff proportional to intensity × impermeability, capped at 0.9
        const runoff = Math.min(C * (intensity / 80) * (1 - perm), 0.9);
        c.water = Math.min(1.0, (c.water || 0) + runoff);
      }
    }

    // 2 passes of gravity-based flow: water moves to lower elevation neighbours
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < grid[i].length; j++) {
          const c = grid[i][j];
          if (!c.water || c.water < 0.05) continue;
          const neighbors = window.GridEngine.getCellNeighbors(grid, i, j);
          for (const nb of neighbors) {
            if ((nb.elevation || 5) < (c.elevation || 5) && c.water > 0.05) {
              const xfer = Math.min(c.water * 0.2, 0.25);
              nb.water = Math.min(1.0, (nb.water || 0) + xfer);
              c.water  = Math.max(0, c.water - xfer);
            }
          }
        }
      }
    }
  }

  function runEnergy(grid) {
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const c = grid[i][j];
        if (c.type === 'building') {
          const load = (c.density || 0.5) * Math.max(0, (c.temp || 36) - COMFORT_THRESHOLD) * 1.2;
          c.energyLoad = Math.max(0, Math.min(60, load));   // cap per cell at 60
        } else {
          c.energyLoad = 0;
        }
      }
    }
  }

  function runBiodiversity(grid) {
    const types = new Set();
    let greenCount = 0;
    const total = grid.length * (grid[0] ? grid[0].length : 20);
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        const c = grid[i][j];
        if (c.type === 'green' || (c.greenType && c.greenType !== 'null')) {
          greenCount++;
          if (c.greenType && c.greenType !== 'null') types.add(c.greenType);
          if (c.type === 'green') types.add('green');
        }
      }
    }
    if (greenCount === 0) return 0;
    const coverage  = Math.min(1, greenCount / (total * 0.3));
    const diversity = Math.min(1, types.size / 4);
    return coverage * 0.6 + diversity * 0.4;
  }

  function simulate(grid, rainfall) {
    // Reset only derived simulation outputs — NOT hardcoded base properties
    for (let i = 0; i < grid.length; i++) {
      for (let j = 0; j < grid[i].length; j++) {
        grid[i][j].water      = 0;
        grid[i][j].energyLoad = 0;
        // Leave temp untouched if it was already set — runHeat will overwrite
      }
    }
    runHeat(grid);
    if (rainfall > 0) runFlood(grid, rainfall);
    runEnergy(grid);
  }

  return { runHeat, runFlood, runEnergy, runBiodiversity, simulate };
})();
