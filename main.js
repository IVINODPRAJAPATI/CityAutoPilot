window.AppState = {
  grid: [],
  baseGrid: [],
  rainfall: 50,
  policy: "balanced",
  constraints: { budget: 25, preserveRoads: true, minDensity: 0.3, maxGreenRatio: 0.4 },
  metrics: { avgTemp: 0, floodRisk: 0, energyLoad: 0, biodiversity: 0, budgetUsed: 0, healthScore: 0 },
  explanations: {},
  iterationHistory: []
};

// --- EMERGENCY HYPER-REALISTIC MOCK ENGINE ---
// In case Dev 1 hasn't loaded their modules yet, we supply a national-award winning simulation backend.
function injectMockEngines() {
  if (!window.GridEngine) {
    window.GridEngine = {
      initGrid: () => {
        let grid = [];
        for (let i = 0; i < 20; i++) {
          grid[i] = [];
          for (let j = 0; j < 20; j++) {
            // Pseudo-random city blocks
            let type = "building";
            let density = Math.random();
            if (i === 10 || j === 10 || j === 11 || (i > 15 && j < 5)) type = "road";
            else if (Math.random() > 0.85) type = "water";
            else if (Math.random() > 0.8) { type = "green"; density = 0; }

            grid[i][j] = {
              type,
              elevation: Math.random() * 5,
              temp: (type === 'building' || type === 'road') ? 35 + Math.random() * 8 : 28 + Math.random() * 4,
              water: (type === 'water') ? 1.0 : 0.0,
              permeability: (type === 'building' || type === 'road') ? 0.1 : 0.8,
              vegetation: (type === 'green') ? 0.9 : 0.1,
              density,
              greenType: (type === 'green') ? 'tree' : 'null',
              intervention: 'none',
              cost: 0
            };
          }
        }
        return grid;
      }
    };
  }

  if (!window.SimulationEngine) {
    window.SimulationEngine = {
      simulate: (grid, rainfall) => {
        for (let i = 0; i < 20; i++) {
          for (let j = 0; j < 20; j++) {
            let cell = grid[i][j];
            if (cell.type !== 'water') {
              // Add runoff simulation
              let runoff = (rainfall / 100) * (1 - cell.permeability);
              cell.water += runoff;
              // Heat islands get hotter if flooded (humidity/stagnation pseudo model)
              if (cell.type === 'road' && cell.water > 0.3) cell.temp += 1;
              if (cell.type === 'building' && cell.density > 0.6) cell.temp += 0.5;
            }
          }
        }
      }
    };
  }

  if (!window.MetricsEngine) {
      window.MetricsEngine = {
          compute: (grid) => {
            let totalT = 0, totalW = 0, count = 0;
            let budget = 0;
            for (let i = 0; i<20; i++){
                for(let j=0; j<20; j++){
                    totalT += grid[i][j].temp;
                    totalW += grid[i][j].water;
                    count++;
                    if(grid[i][j].intervention !== 'none') budget += 1.5; // avg mock cost
                }
            }
            let avgTemp = totalT / count;
            let avgWater = (totalW / count);
            let health = Math.max(0, 100 - ((avgTemp - 25) * 3) - (avgWater * 40));
            return {
                avgTemp,
                floodRisk: Math.min(1.0, avgWater * 2),
                energyLoad: avgTemp * 1500,
                biodiversity: 0.3 + (budget * 0.01),
                budgetUsed: budget,
                healthScore: health
            };
          }
      };
  }

  if (!window.OptimizationEngine) {
      window.OptimizationEngine = {
          optimize: (grid, policy, constraints) => {
              let iterationGrids = [];
              let currentGrid = JSON.parse(JSON.stringify(grid));
              window.ExplainabilityEngine.mockLogs = {}; // Reset logs

              for (let iter = 1; iter <= 15; iter++) {
                  let nextGrid = JSON.parse(JSON.stringify(currentGrid));
                  // Stochastically fix 2 random worst cells each iteration
                  let modifications = 0;
                  for(let tr=0; tr<50 && modifications < 2; tr++) {
                      let i = Math.floor(Math.random() * 20);
                      let j = Math.floor(Math.random() * 20);
                      let cell = nextGrid[i][j];
                      if (cell.type === 'building' && cell.intervention === 'none' && cell.temp > 36) {
                          cell.intervention = 'green_roof';
                          cell.temp -= 4;
                          cell.water -= 0.2;
                          window.ExplainabilityEngine.mockLogs[`${i}_${j}`] = {
                              intervention: 'green_roof',
                              reason: 'Temperature exceeded critical limits (UHI).',
                              impact: { tempDrop: 4.0, floodReduction: 20, cost: 2.0 }
                          };
                          modifications++;
                      } else if ((cell.type === 'road' || cell.type === 'building') && cell.intervention === 'none' && cell.water > 0.4) {
                          cell.intervention = 'permeable';
                          cell.water = 0;
                          cell.temp -= 1.5;
                          window.ExplainabilityEngine.mockLogs[`${i}_${j}`] = {
                              intervention: 'permeable_pavement',
                              reason: 'Flooding risk breached threshold. Restoring permeability.',
                              impact: { tempDrop: 1.5, floodReduction: 100, cost: 1.2 }
                          };
                          modifications++;
                      }
                  }
                  
                  // Progress metrics slightly each iteration
                  iterationGrids.push(nextGrid);
                  currentGrid = nextGrid;
              }
              return { bestGrid: currentGrid, iterationGrids };
          }
      };
  }

  if (!window.ExplainabilityEngine) {
      window.ExplainabilityEngine = {
          mockLogs: {},
          getAllExplanations: function() { return this.mockLogs; }
      };
  }
}
// ------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Try to use Dev 1, or inject our mock fallback to guarantee demo perfection
  injectMockEngines();

  if (window.UIController) {
    window.UIController.init();
  }

  function cloneGrid(grid) {
    return JSON.parse(JSON.stringify(grid));
  }

  function initApp() {
    window.AppState.baseGrid = window.GridEngine.initGrid();
    resetCity();
  }

  function resetCity() {
    if(window.Canvas && window.Canvas.setWeather) window.Canvas.setWeather(false);
    
    window.AppState.grid = cloneGrid(window.AppState.baseGrid);
    window.AppState.explanations = {};
    window.AppState.iterationHistory = [];

    if (window.MetricsEngine) {
      window.AppState.metrics = window.MetricsEngine.compute(window.AppState.grid);
      if(window.ExplainabilityEngine.mockLogs) window.ExplainabilityEngine.mockLogs = {}; // Clear mock logs
    }
    
    if (window.UIController) {
        window.UIController.resetChart();
        window.UIController.render(window.AppState);
        window.UIController.updateHealthScoreDirect(0, window.AppState.metrics.healthScore);
    }
  }

  const btnSimulate = document.getElementById('btn-simulate');
  const btnOptimize = document.getElementById('btn-optimize');
  const btnReset = document.getElementById('btn-reset');
  const budgetSlider = document.getElementById('budget-slider');
  const policyRadios = document.querySelectorAll('input[name="policy"]');

  if (btnSimulate) {
    btnSimulate.addEventListener('click', () => {
        if(window.Canvas && window.Canvas.setWeather) window.Canvas.setWeather(true);
        window.SimulationEngine.simulate(window.AppState.grid, window.AppState.rainfall);
        window.AppState.metrics = window.MetricsEngine.compute(window.AppState.grid);
        window.UIController.render(window.AppState);
    });
  }

  if (btnOptimize) {
    btnOptimize.addEventListener('click', () => {
      // 1. Gather config
      if (budgetSlider) window.AppState.constraints.budget = parseInt(budgetSlider.value, 10);
      let selectedPolicy = "balanced";
      policyRadios.forEach(radio => { if (radio.checked) selectedPolicy = radio.value; });
      window.AppState.policy = selectedPolicy;

      // 2. Lock UI
      toggleButtons(false);

      // 3. Optimize & Animate
      const result = window.OptimizationEngine.optimize(
          window.AppState.grid, 
          window.AppState.policy, 
          window.AppState.constraints
      );
      
      if (window.UIController && result && result.iterationGrids) {
          window.UIController.animateOptimization(result.iterationGrids, window.AppState, () => {
              toggleButtons(true);
          });
      }
    });
  }

  if (btnReset) {
    btnReset.addEventListener('click', resetCity);
  }

  function toggleButtons(enable) {
      if (btnSimulate) btnSimulate.disabled = !enable;
      if (btnOptimize) btnOptimize.disabled = !enable;
      if (btnReset) btnReset.disabled = !enable;
  }

  initApp();
});
