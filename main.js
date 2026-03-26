// ─────────────────────────────────────────────────────────────────────────────
// CITYAUTOPILOT — MAIN CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────

window.AppState = {
  grid:       [],
  baseGrid:   [],
  rainGrid:   null,
  rainfall:   50,
  rainActive: false,
  rainTime:   0,       // STEP 3: time-based rain counter
  policy:     'balanced',
  constraints:{ budget: 100 },
  metrics:    null,
  iterationHistory: []
};

document.addEventListener('DOMContentLoaded', () => {

  if (window.UIController) window.UIController.init();

  let _rainInterval = null; // STEP 3: interval handle

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function initApp() {
    window.AppState.baseGrid = window.GridEngine.initGrid();
    _hardReset();
  }

  // ── HARD RESET ────────────────────────────────────────────────────────────
  function _hardReset() {
    _stopRain(); // clear rain first

    window.AppState.grid = window.GridEngine.cloneGrid(window.AppState.baseGrid);
    window.AppState.iterationHistory = [];
    if (window.ExplainabilityEngine && window.ExplainabilityEngine.reset) {
      window.ExplainabilityEngine.reset();
    }

    window.SimulationEngine.simulate(window.AppState.grid, 0);
    window.AppState.metrics = window.MetricsEngine.compute(window.AppState.grid);

    if (window.Canvas && window.Canvas.setWeather) window.Canvas.setWeather(false);
    if (window.UIController) {
      window.UIController.resetChart();
      window.UIController.render(window.AppState);
      window.UIController.updateHealthScoreDirect(0, window.AppState.metrics.healthScore);
    }

    const btn = document.getElementById('btn-simulate');
    if (btn) { btn.textContent = 'Simulate Rainfall ☂'; btn.classList.remove('raining'); }
  }

  // ── STEP 3: Time-based rain stop ─────────────────────────────────────────
  function _stopRain() {
    window.AppState.rainActive = false;
    window.AppState.rainGrid   = null;
    window.AppState.rainTime   = 0;
    if (_rainInterval) { clearInterval(_rainInterval); _rainInterval = null; }
  }

  // ── STEP 3: Gradual rain tick — called every 2s while rain active ─────────
  function _rainTick() {
    if (!window.AppState.rainActive) return;

    // Increase rainTime each tick (max 10 = full intensity)
    window.AppState.rainTime = Math.min(10, window.AppState.rainTime + 1);

    // Build a fresh rainGrid based on current rainTime factor
    const intensityFactor = window.AppState.rainTime / 10; // 0→1 over 10 ticks
    const effectiveRainfall = window.AppState.rainfall * intensityFactor;

    window.AppState.rainGrid = window.GridEngine.cloneGrid(window.AppState.baseGrid);
    window.SimulationEngine.simulate(window.AppState.rainGrid, effectiveRainfall);
    window.AppState.grid = window.AppState.rainGrid;

    const m = window.MetricsEngine.compute(window.AppState.grid);
    const rainScore = window.MetricsEngine.healthScore(m, true);
    window.AppState.metrics = m;

    window.Panels.updateMetrics(window.AppState.metrics, window.AppState.constraints.budget);
    window.UIController.render(window.AppState);

    // Update button to show rain intensity
    const btn = document.getElementById('btn-simulate');
    const pct = Math.round(intensityFactor * 100);
    if (btn) btn.textContent = `Rain ${pct}% — Stop ☀`;

    // Stop ticking once at full intensity (let user stop manually)
    if (window.AppState.rainTime >= 10) {
      clearInterval(_rainInterval);
      _rainInterval = null;
    }
  }

  // ── UI refs ───────────────────────────────────────────────────────────────
  const btnSimulate  = document.getElementById('btn-simulate');
  const btnOptimize  = document.getElementById('btn-optimize');
  const btnReset     = document.getElementById('btn-reset');
  const budgetSlider = document.getElementById('budget-slider');
  const budgetDisplay= document.getElementById('budget-display');
  const policyRadios = document.querySelectorAll('input[name="policy"]');

  if (budgetSlider) {
    budgetSlider.addEventListener('input', () => {
      window.AppState.constraints.budget = parseInt(budgetSlider.value, 10);
      if (budgetDisplay) budgetDisplay.textContent = budgetSlider.value + ' Units';
    });
  }

  // ── Simulate / Stop Rainfall (TOGGLE) ─────────────────────────────────────
  if (btnSimulate) {
    btnSimulate.addEventListener('click', () => {
      if (window.AppState.rainActive) {
        // STOP rain
        _stopRain();
        window.AppState.grid = window.GridEngine.cloneGrid(window.AppState.baseGrid);
        window.SimulationEngine.simulate(window.AppState.grid, 0);
        const oldScore = window.AppState.metrics ? window.AppState.metrics.healthScore : 50;
        window.AppState.metrics = window.MetricsEngine.compute(window.AppState.grid);
        if (window.Canvas && window.Canvas.setWeather) window.Canvas.setWeather(false);
        window.Panels.updateMetrics(window.AppState.metrics, window.AppState.constraints.budget);
        window.Panels.updateHealthScore(oldScore, window.AppState.metrics.healthScore);
        window.UIController.render(window.AppState);
        btnSimulate.textContent = 'Simulate Rainfall ☂';
        btnSimulate.classList.remove('raining');
        return;
      }

      // START rain — STEP 3: kick off gradual rain timer
      window.AppState.rainActive = true;
      window.AppState.rainTime   = 0;
      btnSimulate.textContent    = 'Rain 0% — Stop ☀';
      btnSimulate.classList.add('raining');
      if (window.Canvas && window.Canvas.setWeather) window.Canvas.setWeather(true);

      // Run first tick immediately, then every 2 seconds
      _rainTick();
      _rainInterval = setInterval(_rainTick, 2000);
    });
  }

  // ── Optimize City ─────────────────────────────────────────────────────────
  if (btnOptimize) {
    btnOptimize.addEventListener('click', () => {
      if (budgetSlider) window.AppState.constraints.budget = parseInt(budgetSlider.value, 10);
      policyRadios.forEach(r => { if (r.checked) window.AppState.policy = r.value; });

      toggleButtons(false);

      // STEP 4: Use rainGrid when rain active so optimization accounts for flood state
      const sourceGrid = (window.AppState.rainActive && window.AppState.rainGrid)
        ? window.AppState.rainGrid
        : window.AppState.baseGrid;

      const effectiveRainfall = window.AppState.rainActive
        ? window.AppState.rainfall * (window.AppState.rainTime / 10)
        : 0;

      const result = window.OptimizationEngine.optimize(
        sourceGrid,
        window.AppState.policy,
        window.AppState.constraints,
        effectiveRainfall
      );

      if (window.UIController && result) {
        window.UIController.animateOptimization(result, window.AppState, () => {
          toggleButtons(true);
          console.log('[Output]',
            'Before:', result.initialScore,
            'After:', result.finalScore,
            'Clusters:', result.clusters,
            'Applied:', result.applied,
            'Budget:', result.budgetUsed ? result.budgetUsed.toFixed(1) : 0,
            'Biodiversity:', result.biodiversity ? (result.biodiversity * 100).toFixed(0) + '%' : '0%');
        });
      }
    });
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  if (btnReset) btnReset.addEventListener('click', _hardReset);

  function toggleButtons(enable) {
    if (btnSimulate) btnSimulate.disabled = !enable;
    if (btnOptimize) btnOptimize.disabled = !enable;
    if (btnReset)    btnReset.disabled    = !enable;
  }

  initApp();
});
