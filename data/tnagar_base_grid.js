window.TNagarBaseGrid = (function() {
  function generate() {
    const grid = [];
    for (let i = 0; i < 20; i++) {
      grid[i] = [];
      for (let j = 0; j < 20; j++) {
        // Procedurally generating T. Nagar archetype cells
        let type = window.Constants.CELL_TYPES.BUILDING;
        
        // Increase elevation variance with defined basins to accumulate water
        let d1 = Math.hypot(i - 4, j - 4);
        let d2 = Math.hypot(i - 16, j - 16);
        let d3 = Math.hypot(i - 15, j - 5);
        let elevation = Math.min(d1, d2, d3) * 1.5 + Math.random() * 2;
        
        let p = Math.random();
        
        if (p < 0.1) type = window.Constants.CELL_TYPES.GREEN;
        else if (p < 0.3) type = window.Constants.CELL_TYPES.ROAD;
        else if (p < 0.35) type = window.Constants.CELL_TYPES.WATER;
        
        let greenType = window.Constants.GREEN_TYPES.NULL;
        let vegetation = 0.05; // baseline low vegetation
        let density = 0;
        let permeability = 0.1; // default tight surface
        
        switch (type) {
          case window.Constants.CELL_TYPES.BUILDING:
            density = 0.7 + Math.random() * 0.2; // avg ~0.8
            permeability = 0.1;
            vegetation = 0.05; 
            break;
          case window.Constants.CELL_TYPES.ROAD:
            density = 0;
            permeability = 0.1;
            vegetation = 0.05;
            break;
          case window.Constants.CELL_TYPES.GREEN:
            density = 0;
            vegetation = 0.05 + Math.random() * 0.1; // stressed green
            permeability = 0.6;
            greenType = Math.random() < 0.5 ? window.Constants.GREEN_TYPES.TREE : window.Constants.GREEN_TYPES.GRASS;
            break;
          case window.Constants.CELL_TYPES.WATER:
            density = 0;
            vegetation = 0;
            permeability = 1.0;
            elevation = 0; // sink
            break;
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
