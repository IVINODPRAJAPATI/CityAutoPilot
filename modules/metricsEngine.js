window.MetricsEngine = (function() {
  let obs = {
    maxTemp: -Infinity, minTemp: Infinity,
    maxFlood: -Infinity, minFlood: Infinity,
    maxEnergy: -Infinity, minEnergy: Infinity
  };

  function compute(grid) {
    let sumTemp = 0;
    let sumFlood = 0;
    let sumEnergy = 0;
    let totalCost = 0;
    const n = 20 * 20;

    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            const cell = grid[i][j];
            sumTemp += cell.temp || 0;
            sumFlood += cell.water || 0;
            sumEnergy += cell.energyLoad || 0;
            totalCost += cell.cost || 0;
        }
    }

    const avgTemp = sumTemp / n;
    const floodRisk = sumFlood / n; 
    const energyLoad = sumEnergy;
    const biodiversity = window.SimulationEngine.runBiodiversity(grid);

    obs.maxTemp = Math.max(obs.maxTemp, avgTemp);
    obs.minTemp = Math.min(obs.minTemp, avgTemp);
    obs.maxFlood = Math.max(obs.maxFlood, floodRisk);
    obs.minFlood = Math.min(obs.minFlood, floodRisk);
    obs.maxEnergy = Math.max(obs.maxEnergy, energyLoad);
    obs.minEnergy = Math.min(obs.minEnergy, energyLoad);

    const metrics = {
      avgTemp: avgTemp,
      floodRisk: floodRisk,
      energyLoad: energyLoad,
      biodiversity: biodiversity,
      budgetUsed: totalCost,
      get healthScore() { return healthScore(this); }
    };
    
    return metrics;
  }

  function getObserved() {
    return obs; // useful for debugging
  }

  function healthScore(metrics) {
    let normTemp = obs.maxTemp > obs.minTemp ? (metrics.avgTemp - obs.minTemp) / (obs.maxTemp - obs.minTemp) : 0.3;
    let normFlood = obs.maxFlood > obs.minFlood ? (metrics.floodRisk - obs.minFlood) / (obs.maxFlood - obs.minFlood) : 0.3;
    let normEnergy = obs.maxEnergy > obs.minEnergy ? (metrics.energyLoad - obs.minEnergy) / (obs.maxEnergy - obs.minEnergy) : 0.3;
    let normBio = metrics.biodiversity || 0;

    normTemp = Math.max(0, Math.min(1, normTemp));
    normFlood = Math.max(0, Math.min(1, normFlood));
    normEnergy = Math.max(0, Math.min(1, normEnergy));
    normBio = Math.max(0, Math.min(1, normBio));
    
    // 3. Fix Energy Dominance: Soft scaling
    normEnergy = Math.pow(normEnergy, 0.5);

    let score = 100 - (
      normTemp * 30 +
      normFlood * 30 +
      normEnergy * 20 +
      (1 - normBio) * 20
    );

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  return { compute, healthScore, getObserved };
})();
