const https = require('https');
const fs = require('fs');

const S = 13.0330;
const N = 13.0500;
const W = 80.2280;
const E = 80.2450;
const ROWS = 20;
const COLS = 20;

const latStep = (N - S) / ROWS;
const lonStep = (E - W) / COLS;

const query = `
[out:json];
(
  way["highway"](${S},${W},${N},${E});
  way["building"](${S},${W},${N},${E});
  way["leisure"](${S},${W},${N},${E});
  way["landuse"="grass"](${S},${W},${N},${E});
  way["waterway"](${S},${W},${N},${E});
  way["natural"="water"](${S},${W},${N},${E});
);
out body;
>;
out skel qt;
`;

const postData = "data=" + encodeURIComponent(query);

const options = {
  hostname: 'overpass-api.de',
  port: 443,
  path: '/api/interpreter',
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log("Requesting Overpass API Data for T. Nagar...");

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const nodes = {};
      const ways = [];

      json.elements.forEach(el => {
        if (el.type === 'node') {
           nodes[el.id] = { lat: el.lat, lon: el.lon };
        } else if (el.type === 'way') {
           ways.push(el);
        }
      });

      let grid = [];
      for(let i=0; i<ROWS; i++){
         grid[i] = [];
         for(let j=0; j<COLS; j++){
            grid[i][j] = { type: 'building', priority: 0 };
         }
      }

      ways.forEach(w => {
         if(!w.tags) return;
         let type = 'building';
         let prio = 1;
         
         if (w.tags.highway) { type = 'road'; prio = 3; }
         else if (w.tags.leisure || w.tags.landuse === 'grass') { type = 'green'; prio = 2; }
         else if (w.tags.waterway || w.tags.natural === 'water') { type = 'water'; prio = 4; }
         
         w.nodes.forEach(nId => {
            let node = nodes[nId];
            if(!node) return;
            let i = Math.floor((N - node.lat) / latStep);
            let j = Math.floor((node.lon - W) / lonStep);
            
            if(i >= 0 && i < ROWS && j >= 0 && j < COLS) {
               // Sub-step priority mapping array interpolation
               if(prio > grid[i][j].priority) {
                  grid[i][j].type = type;
                  grid[i][j].priority = prio;
               }
            }
         });
      });

      // Generate strict data payload enforcing static baseline
      let outputGrid = [];
      for(let i=0; i<ROWS; i++){
         outputGrid[i] = [];
         for(let j=0; j<COLS; j++){
            const cellType = grid[i][j].type;
            
            const cellN = N - i * latStep;
            const cellS = N - (i+1) * latStep;
            const cellW = W + j * lonStep;
            const cellE = W + (j+1) * lonStep;

            outputGrid[i][j] = {
               type: cellType,
               bounds: [[cellS, cellW], [cellN, cellE]],
               elevation: cellType === 'water' ? 0.0 : 4.0 + Math.random() * 2.0,
               temp: (cellType === 'building' || cellType === 'road') ? 37.0 : 32.0,
               water: cellType === 'water' ? 1.0 : 0.0,
               permeability: (cellType === 'building' || cellType === 'road') ? 0.1 : 0.8,
               vegetation: cellType === 'green' ? 0.9 : 0.1,
               density: cellType === 'building' ? 0.8 : 0.0,
               greenType: cellType === 'green' ? 'tree' : 'null',
               intervention: 'none',
               cost: 0
            };
         }
      }

      const fileContent = "window.TNagarBaseGrid = { generate: function() { return " + JSON.stringify(outputGrid, null, 2) + "; } };";
      
      if (!fs.existsSync('data')){
          fs.mkdirSync('data');
      }
      fs.writeFileSync('data/tnagar_base_grid.js', fileContent);
      console.log("Real geospatial grid fetched & saved successfully.");
    } catch(e) {
      console.error("Parse Error:", e.message);
    }
  });
});

req.on('error', (e) => {
  console.error("Overpass API Error:", e);
});

req.write(postData);
req.end();
