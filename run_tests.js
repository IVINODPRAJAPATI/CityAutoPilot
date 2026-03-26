global.window = {};
const fs = require('fs');
function loadModule(path) {
    eval(fs.readFileSync(path, 'utf8'));
}
loadModule('data/constants.js');
loadModule('data/tnagar_base_grid.js');
loadModule('modules/gridEngine.js');
loadModule('modules/simulationEngine.js');
loadModule('modules/metricsEngine.js');
loadModule('modules/constraintEngine.js');
loadModule('modules/policyEngine.js');
loadModule('modules/explainabilityEngine.js');
loadModule('modules/optimizationEngine.js');

const baseGrid = window.GridEngine.initGrid();
function testRun(policyMode) {
  const grid = window.GridEngine.cloneGrid(baseGrid);
  window.SimulationEngine.simulate(grid, 1.5);
  const metrics = window.MetricsEngine.compute(grid);

  const constraints = { budget: 25, preserveRoads: true, minDensity: 0.3, maxGreenRatio: 0.4 };
  const policy = window.PolicyEngine.getWeights(policyMode);
  const result = window.OptimizationEngine.optimize(grid, policy, constraints, 1.5);
  const afterMetrics = window.MetricsEngine.compute(result.bestGrid);

  const explanations = window.ExplainabilityEngine.getAllExplanations();
  return {
    BEFORE_HEALTH: metrics.healthScore,
    AFTER_HEALTH: afterMetrics.healthScore,
    BEFORE: { temp: metrics.avgTemp, flood: metrics.floodRisk, energy: metrics.energyLoad, bio: metrics.biodiversity },
    AFTER: { temp: afterMetrics.avgTemp, flood: afterMetrics.floodRisk, energy: afterMetrics.energyLoad, bio: afterMetrics.biodiversity },
    BUDGET_USED: result.bestGrid.reduce((sum, row) => sum + row.reduce((s, cell) => s + (cell.cost || 0), 0), 0),
    POLICY: policyMode
  };
}

const obj = {
  TEST_BALANCED: testRun('balanced'),
  TEST_DET_2: testRun('balanced'),
  TEST_DET_3: testRun('balanced'),
  TEST_FLOOD: testRun('flood'),
  TEST_HEAT: testRun('heat'),
  TEST_ECO: testRun('eco')
};

require('fs').writeFileSync('results.json', JSON.stringify(obj, null, 2));
