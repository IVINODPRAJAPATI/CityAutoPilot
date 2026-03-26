window.UIController = (function() {
  function init() {
    window.Canvas.init('city-canvas');
    window.Panels.init();
  }

  function render(appState) {
    if (!appState || !appState.grid) return;
    
    window.Canvas.drawGrid(appState.grid);
    
    if (appState.metrics) {
        window.Panels.updateMetrics(appState.metrics, appState.constraints ? appState.constraints.budget : 25);
    }
  }

  function animateOptimization(iterationGrids, appState, onComplete) {
    if (!iterationGrids || iterationGrids.length === 0) {
      if(onComplete) onComplete();
      return;
    }

    let currentIter = 0;
    const oldScore = appState.metrics ? (appState.metrics.healthScore || 0) : 0;
    
    const timer = setInterval(() => {
      if (currentIter >= iterationGrids.length) {
        clearInterval(timer);
        
        // Ensure final grid is set
        appState.grid = iterationGrids[iterationGrids.length - 1];
        
        // Final calculations
        if (window.MetricsEngine) {
            appState.metrics = window.MetricsEngine.compute(appState.grid);
            const finalScore = appState.metrics.healthScore;
            
            // Re-render final metrics
            window.Panels.updateMetrics(appState.metrics, appState.constraints.budget);
            
            // Health Score transition animation
            window.Panels.updateHealthScore(oldScore, finalScore);
        }
        
        if (onComplete) onComplete();
        return;
      }

      const gridCopy = iterationGrids[currentIter];
      window.Canvas.drawGrid(gridCopy, true);
      
      // Update intermediate metrics if available
      if (window.MetricsEngine) {
          const tempMetrics = window.MetricsEngine.compute(gridCopy);
          window.Panels.updateMetrics(tempMetrics, appState.constraints.budget);
      }
      
      currentIter++;
    }, 120);
  }

  function showExplanation(i, j, clientX, clientY) {
    if (!window.ExplainabilityEngine) {
        window.Panels.showExplanation(clientX, clientY, null);
        return;
    }

    const key = `${i}_${j}`;
    const explanations = window.ExplainabilityEngine.getAllExplanations();
    const data = explanations ? explanations[key] : null;

    window.Panels.showExplanation(clientX, clientY, data);
  }

  function hideExplanation() {
    window.Panels.hideExplanation();
  }

  function updateHealthScoreDirect(oldScore, newScore) {
      window.Panels.updateHealthScore(oldScore, newScore);
  }

  function resetChart() {
      window.Panels.resetChart();
  }

  return {
    init,
    render,
    animateOptimization,
    showExplanation,
    hideExplanation,
    updateHealthScoreDirect,
    resetChart
  };
})();
