window.ConstraintEngine = (function() {
  function checkBudget(grid, budgetLimit) {
    let totalCost = 0;
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            totalCost += grid[i][j].cost || 0;
        }
    }
    return { valid: totalCost <= budgetLimit, value: totalCost };
  }

  function checkRoadPreservation(grid) {
    // A simple validation checks if any road cell has an intervention or changed type
    // We assume roads must be type "road" and no interventions that would ruin roads.
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            if (grid[i][j].type === window.Constants.CELL_TYPES.ROAD) {
                if (grid[i][j].intervention !== window.Constants.INTERVENTIONS.NONE) {
                  return false;
                }
            }
        }
    }
    return true; 
  }

  function checkDensityFloor(grid, minDensity) {
    let buildingCount = 0;
    let sumDensity = 0;
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            if (grid[i][j].type === window.Constants.CELL_TYPES.BUILDING) {
                buildingCount++;
                sumDensity += grid[i][j].density;
            }
        }
    }
    const avgBuildingDensity = buildingCount > 0 ? sumDensity / buildingCount : 0;
    return avgBuildingDensity >= minDensity;
  }

  function checkGreenCap(grid, maxGreenRatio) {
    let greenCount = 0;
    for (let i = 0; i < 20; i++) {
        for (let j = 0; j < 20; j++) {
            if (grid[i][j].type === window.Constants.CELL_TYPES.GREEN) {
                greenCount++;
            }
        }
    }
    return (greenCount / 400) <= maxGreenRatio;
  }

  function validate(grid, constraints) {
    const violations = [];
    
    const budgetCheck = checkBudget(grid, constraints.budget);
    if (!budgetCheck.valid) violations.push("Budget exceeded: " + budgetCheck.value);

    if (constraints.preserveRoads && !checkRoadPreservation(grid)) {
        violations.push("Roads not preserved");
    }

    if (!checkDensityFloor(grid, constraints.minDensity)) {
        violations.push("Density floor violated");
    }

    if (!checkGreenCap(grid, constraints.maxGreenRatio)) {
        violations.push("Green cap exceeded");
    }

    return {
        valid: violations.length === 0,
        violations: violations
    };
  }

  return { validate, checkBudget, checkRoadPreservation, checkDensityFloor, checkGreenCap };
})();
