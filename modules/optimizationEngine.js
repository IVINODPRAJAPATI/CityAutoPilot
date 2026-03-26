window.OptimizationEngine = (function() {
  function fixedRandom() { return 0.15; }
  function score(grid, policyWeights) {
    const m = window.MetricsEngine.compute(grid);
    const obs = window.MetricsEngine.getObserved();
    let normTemp = obs.maxTemp > obs.minTemp ? (m.avgTemp - obs.minTemp) / (obs.maxTemp - obs.minTemp) : 0.3;
    let normFlood = obs.maxFlood > obs.minFlood ? (m.floodRisk - obs.minFlood) / (obs.maxFlood - obs.minFlood) : 0.3;
    let normEnergy = obs.maxEnergy > obs.minEnergy ? (m.energyLoad - obs.minEnergy) / (obs.maxEnergy - obs.minEnergy) : 0.3;
    let normBio = m.biodiversity || 0;
    
    normTemp = Math.max(0, Math.min(1, normTemp));
    normFlood = Math.max(0, Math.min(1, normFlood));
    normEnergy = Math.max(0, Math.min(1, normEnergy));
    normEnergy = Math.pow(normEnergy, 0.5);
    normBio = Math.max(0, Math.min(1, normBio));

    return policyWeights.heat * normTemp
         + policyWeights.flood * normFlood
         + policyWeights.energy * normEnergy
         + policyWeights.biodiversity * (1 - normBio);
  }

  function getWorstCells(grid, policyMode, count) {
    const cells = [];
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            const c = grid[i][j];
            if (c.type === window.Constants.CELL_TYPES.ROAD) continue;
            let risk = 0;
            let modeStr = (typeof policyMode === 'object') ? (policyMode.flood > 1 ? 'flood' : policyMode.heat > 1 ? 'heat' : 'balanced') : policyMode;
            if (modeStr === window.Constants.POLICIES.FLOOD) {
                risk = c.water;
            } else if (modeStr === window.Constants.POLICIES.HEAT) {
                risk = c.temp;
            } else {
                risk = (c.temp / 40) + c.water;
            }
            cells.push({i, j, cell: c, risk});
        }
    }
    cells.sort((a,b) => b.risk - a.risk);
    return cells.slice(0, count);
  }

  function selectIntervention(cell, policyObj) {
    if (cell.type === window.Constants.CELL_TYPES.ROAD) return null;
    
    let mode = 'balanced';
    if (typeof policyObj === 'object') {
        if (policyObj.flood > 1.0) mode = 'flood';
        else if (policyObj.heat > 1.0) mode = 'heat';
        else if (policyObj.biodiversity > 1.0) mode = 'eco';
    } else {
        mode = policyObj;
    }

    if (mode === window.Constants.POLICIES.FLOOD && cell.water > 0.5) {
      return cell.permeability < 0.5 ? window.Constants.INTERVENTIONS.PERMEABLE : window.Constants.INTERVENTIONS.DRAINAGE;
    }
    if (mode === window.Constants.POLICIES.HEAT && cell.temp > 36) {
      return cell.type === window.Constants.CELL_TYPES.BUILDING ? window.Constants.INTERVENTIONS.GREEN_ROOF : window.Constants.INTERVENTIONS.TREE;
    }
    if (mode === window.Constants.POLICIES.ECO) {
      return window.Constants.INTERVENTIONS.TREE;
    }
    
    // Balanced mode or fallback: fix worst issue
    if (cell.water > 0.5) return cell.permeability < 0.5 ? window.Constants.INTERVENTIONS.PERMEABLE : window.Constants.INTERVENTIONS.DRAINAGE;
    if (cell.temp > 35) return cell.type === window.Constants.CELL_TYPES.BUILDING ? window.Constants.INTERVENTIONS.GREEN_ROOF : window.Constants.INTERVENTIONS.TREE;
    
    return window.Constants.INTERVENTIONS.PERMEABLE;
  }

  function applyIntervention(grid, i, j, intervention) {
    const cell = grid[i][j];
    let cost = window.Constants.COSTS[intervention] || 0;
    
    let impact = { tempDrop: 0, floodReduction: 0, cost: cost };

    if (intervention === window.Constants.INTERVENTIONS.PERMEABLE) {
       cell.permeability = Math.min(1.0, cell.permeability + 0.5);
       impact.floodReduction = 20;
    } else if (intervention === window.Constants.INTERVENTIONS.DRAINAGE) {
       cell.permeability = 1.0; 
       impact.floodReduction = 40;
    } else if (intervention === window.Constants.INTERVENTIONS.GREEN_ROOF) {
       cell.vegetation = Math.min(1.0, cell.vegetation + 0.6);
       cell.permeability = Math.min(1.0, cell.permeability + 0.3);
       impact.tempDrop = 2.5;
       impact.floodReduction = 15;
    } else if (intervention === window.Constants.INTERVENTIONS.TREE) {
       if (cell.type !== window.Constants.CELL_TYPES.BUILDING) {
           cell.type = window.Constants.CELL_TYPES.GREEN;
           cell.greenType = window.Constants.GREEN_TYPES.TREE;
       }
       cell.vegetation = Math.min(1.0, cell.vegetation + 0.5);
       impact.tempDrop = 3.0;
    }
    
    cell.intervention = intervention;
    cell.cost = cost;

    let reason = `density > ${cell.density.toFixed(1)}, temp > ${cell.temp.toFixed(1)}, permeability < ${cell.permeability.toFixed(1)}`;
    window.ExplainabilityEngine.logChange(i, j, intervention, reason, impact);
  }

  function optimize(grid, policyWeights, constraints, rainfall) {
    if (window.ExplainabilityEngine && window.ExplainabilityEngine.reset) {
       window.ExplainabilityEngine.reset();
    }
    
    let weights = policyWeights;
    if (typeof policyWeights === 'string') {
        weights = window.PolicyEngine.getWeights(policyWeights);
    }
    
    let originalGrid = window.GridEngine.cloneGrid(grid);
    
    let bestGrid = window.GridEngine.cloneGrid(originalGrid);
    window.SimulationEngine.simulate(bestGrid, rainfall || 1.5);
    let bestScore = score(bestGrid, weights);
    let initialScore = bestScore;
    
    const iterationGrids = [];
    
    for (let i = 1; i <= (window.Constants.MAX_ITERATIONS || 30); i++) {
        let candidate = window.GridEngine.cloneGrid(bestGrid);
        let worstCells = getWorstCells(candidate, policyWeights, 20); // 20 interventions per pass to densify targets
        let currentBudgetCheck = window.ConstraintEngine.checkBudget(candidate, constraints.budget);
        
        for (const wCell of worstCells) {
            if (candidate[wCell.i][wCell.j].intervention !== window.Constants.INTERVENTIONS.NONE) continue;
            
            let intervention = selectIntervention(candidate[wCell.i][wCell.j], policyWeights);
            if (intervention) {
                let cost = window.Constants.COSTS[intervention] || 0;
                if (currentBudgetCheck.value + cost <= constraints.budget) {
                   applyIntervention(candidate, wCell.i, wCell.j, intervention);
                   currentBudgetCheck.value += cost;
                }
            }
        }
        
        const validation = window.ConstraintEngine.validate(candidate, constraints);
        if (!validation.valid) continue;
        
        window.SimulationEngine.simulate(candidate, rainfall || 1.5);
        let candidateScore = score(candidate, weights);
        
        let accept = false;
        
        if (candidateScore < bestScore) {
            accept = true;
        } else if (i <= 5 && fixedRandom() < 0.3) {
            accept = true;
        } else if (candidateScore <= bestScore * 1.05) {
            accept = true;
        } else {
            let futureCandidate = window.GridEngine.cloneGrid(candidate);
            let futureWorstCells = getWorstCells(futureCandidate, policyWeights, 20);
            let futureBudgetCheck = window.ConstraintEngine.checkBudget(futureCandidate, constraints.budget);
            
            for (const fwCell of futureWorstCells) {
                if (futureCandidate[fwCell.i][fwCell.j].intervention !== window.Constants.INTERVENTIONS.NONE) continue;
                let fwIntervention = selectIntervention(futureCandidate[fwCell.i][fwCell.j], policyWeights);
                if (fwIntervention) {
                    let cost = window.Constants.COSTS[fwIntervention] || 0;
                    if (futureBudgetCheck.value + cost <= constraints.budget) {
                       applyIntervention(futureCandidate, fwCell.i, fwCell.j, fwIntervention);
                       futureBudgetCheck.value += cost;
                    }
                }
            }
            
            const futureValidation = window.ConstraintEngine.validate(futureCandidate, constraints);
            if (futureValidation.valid) {
                window.SimulationEngine.simulate(futureCandidate, rainfall || 1.5);
                let futureScore = score(futureCandidate, weights);
                if (futureScore < bestScore) {
                    accept = true;
                }
            }
        }
        
        if (accept) {
            bestGrid = window.GridEngine.cloneGrid(candidate);
            bestScore = candidateScore;
        }
        
        iterationGrids.push(window.GridEngine.cloneGrid(bestGrid));
    }
    
    if (bestScore > initialScore) {
        return { bestGrid: originalGrid, iterationGrids: [] };
    }
    
    return { bestGrid, iterationGrids };
  }

  return { optimize };
})();
