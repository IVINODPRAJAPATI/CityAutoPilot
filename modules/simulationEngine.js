window.SimulationEngine = (function() {
  function runHeat(grid) {
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            const cell = grid[i][j];
            if (cell.type === window.Constants.CELL_TYPES.ROAD) {
              cell.temp = 38 + cell.density * 2;
            } else if (cell.type === window.Constants.CELL_TYPES.BUILDING) {
              cell.temp = window.Constants.BASE_TEMP + 2 * cell.density - 3 * cell.vegetation - 2 * (cell.water || 0);
            } else if (cell.type === window.Constants.CELL_TYPES.GREEN) {
              cell.temp = window.Constants.BASE_TEMP - 4 * cell.vegetation;
            } else if (cell.type === window.Constants.CELL_TYPES.WATER) {
              cell.temp = window.Constants.BASE_TEMP - 5;
            }
        }
    }

    // Spatial diffusion pass
    const newTemp = JSON.parse(JSON.stringify(grid.map(row => row.map(cell => cell.temp))));
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            const neighbors = window.GridEngine.getCellNeighbors(grid, i, j);
            if (neighbors.length > 0) {
                const avgTemp = neighbors.reduce((acc, n) => acc + n.temp, 0) / neighbors.length;
                newTemp[i][j] += 0.25 * avgTemp * 0.3;
            }
        }
    }
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
           grid[i][j].temp = newTemp[i][j];
        }
    }
  }

  function runFlood(grid, rainfall) {
    const C = window.Constants.RUNOFF_COEFFICIENT_C;

    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            const cell = grid[i][j];
            const runoff = C * rainfall * (1 - cell.permeability);
            cell.water += runoff;
        }
    }

    // Flow routing: 3 passes
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            const cell = grid[i][j];
            const neighbors = window.GridEngine.getCellNeighbors(grid, i, j);
            for (const neighbor of neighbors) {
                if (neighbor.elevation < cell.elevation && cell.water > 0.1) {
                    const transfer = cell.water * 0.3;
                    neighbor.water += transfer;
                    cell.water -= transfer;
                }
            }
        }
      }
    }
  }

  function runEnergy(grid) {
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            const cell = grid[i][j];
            if (cell.type === window.Constants.CELL_TYPES.BUILDING) {
              cell.energyLoad = cell.density * Math.max(0, cell.temp - window.Constants.COMFORT_THRESHOLD) * 0.8;
            } else {
              cell.energyLoad = 0;
            }
        }
    }
  }

  function runBiodiversity(grid) {
    const uniqueTypes = new Set();
    let hasGreen = false;
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            const cell = grid[i][j];
            if (cell.type === window.Constants.CELL_TYPES.GREEN || cell.greenType !== window.Constants.GREEN_TYPES.NULL) {
                hasGreen = true;
                if (cell.greenType && cell.greenType !== window.Constants.GREEN_TYPES.NULL) {
                  uniqueTypes.add(cell.greenType);
                }
            }
        }
    }
    if (!hasGreen) return 0;
    return uniqueTypes.size / 4; 
  }

  function simulate(grid, rainfall) {
      for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
           grid[i][j].water = 0;
           grid[i][j].temp = 0;
           grid[i][j].energyLoad = 0;
        }
      }
      runHeat(grid);
      runFlood(grid, rainfall);
      runEnergy(grid);
  }

  return { 
    runHeat, 
    runFlood, 
    runEnergy, 
    runBiodiversity, 
    simulate 
  };
})();
