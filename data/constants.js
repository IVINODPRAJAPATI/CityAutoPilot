window.Constants = {
  BASE_TEMP: 32,
  COMFORT_THRESHOLD: 24,
  RUNOFF_COEFFICIENT_C: 0.75, // rational method coefficient, urban
  MAX_ITERATIONS: 25,
  INTERVENTIONS_PER_ITERATION: 8,
  COSTS: {
    tree: 1.0,
    green_roof: 2.0,
    permeable: 1.2,
    drainage: 1.5,
    waterbody: 1.8,
    corridor: 1.0
  },
  CELL_TYPES: {
    BUILDING: "building",
    ROAD: "road",
    GREEN: "green",
    WATER: "water"
  },
  INTERVENTIONS: {
    NONE: "none",
    TREE: "tree",
    GREEN_ROOF: "green_roof",
    PERMEABLE: "permeable",
    DRAINAGE: "drainage",
    WATERBODY: "waterbody",
    CORRIDOR: "corridor"
  },
  GREEN_TYPES: {
    TREE: "tree",
    GRASS: "grass",
    WATERBODY: "waterbody",
    CORRIDOR: "corridor",
    NULL: "null"
  },
  POLICIES: {
    BALANCED: "balanced",
    FLOOD: "flood",
    HEAT: "heat",
    ECO: "eco"
  }
};
