window.GridEngine = (function() {
  function initGrid() {
    return window.TNagarBaseGrid.generate();
  }

  function cloneGrid(grid) {
    return JSON.parse(JSON.stringify(grid));
  }

  function getCellNeighbors(grid, i, j) {
    const neighbors = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let d = 0; d < dirs.length; d++) {
      const ni = i + dirs[d][0];
      const nj = j + dirs[d][1];
      if (ni >= 0 && ni < 20 && nj >= 0 && nj < 20) {
        neighbors.push(grid[ni][nj]);
      }
    }
    return neighbors;
  }

  return { 
    initGrid, 
    cloneGrid, 
    getCellNeighbors 
  };
})();
