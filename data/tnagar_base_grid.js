window.TNagarBaseGrid = (function() {
  function generate() {
    const grid = [];
    const size = 20;
    for (let i = 0; i < size; i++) {
      grid[i] = [];
      for (let j = 0; j < size; j++) {
        let type = window.Constants.CELL_TYPES.BUILDING;
        
        // Exact Geography Modeling: Panagal Park, T. Nagar
        // Center of map is (9.5, 9.5)
        let cx = 9.5;
        let cy = 9.5;
        let dist = Math.hypot(i - cy, j - cx);
        
        let density = 0.5;
        let permeability = 0.1;
        let vegetation = 0.05;
        let greenType = window.Constants.GREEN_TYPES.NULL;
        let elevation = dist * 1.5; // Slope up away from center (a bowl, prone to floods)
        
        // 1. Panagal Park Center (Radius 2.5)
        if (dist <= 2.5) {
            type = window.Constants.CELL_TYPES.GREEN;
            greenType = window.Constants.GREEN_TYPES.TREE;
            vegetation = 1.0;
            permeability = 0.8;
            elevation = 3.0; // Park is slightly raised
        }
        // 2. Inner Ring Road (Radius 2.5 to 3.5)
        else if (dist > 2.5 && dist <= 3.5) {
            type = window.Constants.CELL_TYPES.ROAD;
            permeability = 0.1;
            vegetation = 0.0;
        }
        // 3. Arterial Roads (Usman Rd Vertical j=8,9; GN Chetty Horizontal i=8,9)
        else if ((j === 9 || j === 10) && dist > 3.5) {
            type = window.Constants.CELL_TYPES.ROAD;
        }
        else if ((i === 9 || i === 10) && dist > 3.5) {
            type = window.Constants.CELL_TYPES.ROAD;
        }
        // Diagonal road (Sir Thyagaraya Rd) roughly i == j
        else if (Math.abs(i - j) <= 1 && dist > 3.5 && i > 9) {
            type = window.Constants.CELL_TYPES.ROAD;
        }
        else if (Math.abs((size - 1 - i) - j) <= 1 && dist > 3.5 && i < 10) {
            type = window.Constants.CELL_TYPES.ROAD;
        }
        // 4. Commercial Dense Clusters (Next to arterial roads)
        else {
            type = window.Constants.CELL_TYPES.BUILDING;
            // Density is high near center, lower at edges
            density = Math.max(0.3, 1.2 - (dist / 14));
            // Specifically, Usman road adjacent blocks are hyper-dense
            if (Math.abs(j - 9.5) <= 3 || Math.abs(i - 9.5) <= 3) {
                density = 1.0; // Massive shopping complexes
            }
            
            // Random residential roads breaking the blocks
            if (i % 4 === 0 || j % 5 === 0) {
                type = window.Constants.CELL_TYPES.ROAD;
            }
        }
        
        // 5. Southeast Mambalam Canal / Pond 
        if (i >= 17 && j >= 16) {
            type = window.Constants.CELL_TYPES.WATER;
            elevation = -1.0; // Deep trench
            permeability = 1.0;
        }

        grid[i][j] = {
          type: type,
          elevation: elevation,
          temp: 0,
          water: 0,
          energyLoad: 0,
          permeability: permeability,
          vegetation: vegetation,
          density: density,
          greenType: greenType,
          intervention: window.Constants.INTERVENTIONS.NONE,
          cost: 0
        };
      }
    }
    return grid;
  }
  return { generate };
})();
