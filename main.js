window.AppState = {
  grid: [],
  baseGrid: [],
  rainfall: 50,
  policy: "balanced",
  constraints: { budget: 100, preserveRoads: true, minDensity: 0.3, maxGreenRatio: 0.4 },
  metrics: { avgTemp: 0, floodRisk: 0, energyLoad: 0, biodiversity: 0, budgetUsed: 0, healthScore: 0 },
  explanations: {},
  iterationHistory: []
};

document.addEventListener('DOMContentLoaded', () => {

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
    window.AppState.grid = cloneGrid(window.AppState.baseGrid);
    if(window.Canvas && window.Canvas.setWeather) window.Canvas.setWeather(false);
    window.AppState.explanations = {};
    window.AppState.iterationHistory = [];

    if (window.MetricsEngine) {
      window.AppState.metrics = window.MetricsEngine.compute(window.AppState.grid);
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

  // Auto-optimize on policy change for instant predictive metrics evaluation
  policyRadios.forEach(radio => {
      radio.addEventListener('change', () => {
          if (btnOptimize && !btnOptimize.disabled) {
              btnOptimize.click();
          }
      });
  });

  if (btnSimulate) {
    btnSimulate.addEventListener('click', () => {
        window.SimulationEngine.simulate(window.AppState.grid, window.AppState.rainfall);
        window.AppState.metrics = window.MetricsEngine.compute(window.AppState.grid);
        if(window.Canvas && window.Canvas.setWeather) window.Canvas.setWeather(true);
        window.Panels.updateMetrics(window.AppState.metrics, window.AppState.constraints.budget);
        window.Panels.updateHealthScore(
            window.AppState.metrics.healthScore, window.AppState.metrics.healthScore
        );
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

      if (window.ExplainabilityEngine && window.ExplainabilityEngine.reset) {
          window.ExplainabilityEngine.reset();
      }
      window.AppState.iterationHistory = [];
      
      toggleButtons(false);
      
      // MUST reset to pristine base data so policy changes don't stack indefinitely
      window.AppState.grid = window.GridEngine.cloneGrid(window.AppState.baseGrid);
      
      let result = window.OptimizationEngine.optimize(
          window.AppState.grid,
          window.AppState.policy,
          window.AppState.constraints,
          window.Canvas && document.getElementById('rain-overlay').classList.contains('active') ? window.AppState.rainfall : 0
      );
      
      if (window.UIController && result) {
          window.UIController.animateOptimization(result, window.AppState, () => {
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
