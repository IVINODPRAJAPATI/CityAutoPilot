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

  function animateOptimization(result, appState, onComplete) {
    const iterationGrids = result.iterationGrids || [];
    const finalGrid = result.bestGrid;

    const oldScore = appState.metrics ? (appState.metrics.healthScore || 0) : 0;

    if (!iterationGrids || iterationGrids.length === 0) {
      appState.grid = finalGrid;
      if (window.MetricsEngine) {
          appState.metrics = window.MetricsEngine.compute(appState.grid);
          window.Panels.updateHealthScore(oldScore, appState.metrics.healthScore);
          
          console.log("USING GRID:", finalGrid);
          console.log("BUDGET USED:", appState.metrics.budgetUsed);
          console.log("FINAL SCORE:", appState.metrics.healthScore);
      }
      window.Canvas.drawGrid(appState.grid, true);
      if(onComplete) onComplete();
      return;
    }

    let currentIter = 0;
    
    const timer = setInterval(() => {
      if (currentIter >= iterationGrids.length) {
        clearInterval(timer);
        
        // Ensure final grid is set
        appState.grid = finalGrid;
        
        // Final calculations
        if (window.MetricsEngine) {
            appState.metrics = window.MetricsEngine.compute(appState.grid);
            const finalScore = appState.metrics.healthScore;
            
            // Re-render final metrics
            window.Panels.updateMetrics(appState.metrics, appState.constraints.budget);
            
            // Health Score transition animation
            window.Panels.updateHealthScore(oldScore, finalScore);
            
            console.log("USING GRID:", finalGrid);
            console.log("BUDGET USED:", appState.metrics.budgetUsed);
            console.log("FINAL SCORE:", finalScore);
        }
        
        window.Canvas.drawGrid(appState.grid, true);
        if (onComplete) onComplete();
        return;
      }

      const gridCopy = iterationGrids[currentIter];
      window.Canvas.drawGrid(gridCopy, true);
      currentIter++;
    }, 120);
  }

  function showExplanation(i, j, clientX, clientY) {
    if (!window.ExplainabilityEngine) {
        window.Panels.showExplanation(clientX, clientY, null);
        return;
    }

    let data = null;
    if (window.ExplainabilityEngine.getExplanation) {
        data = window.ExplainabilityEngine.getExplanation(i, j);
    } else if (window.ExplainabilityEngine.getAllExplanations) {
        const expl = window.ExplainabilityEngine.getAllExplanations();
        data = expl ? expl[`${i}_${j}`] : null;
    }

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
