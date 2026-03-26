window.Canvas = (function() {
  let map;
  let layerGroup;
  let rects = null;
  let iconLayer;
  let boundaryLayer;
  let isRaining = false;

  // ── Visual config: Colors that POP on satellite imagery ──────────────────
  const MARKER = {
    // 🌳 GREEN = tree planting spot (roadside / building compound)
    tree: {
      color:       '#00FF41',   // neon matrix green — unmissable
      borderColor: '#006400',   // dark green ring
      radius:      8,
      label:       '🌳 Plant Tree Here',
      description: 'Roadside or compound tree planting to reduce urban heat island and absorb CO₂.'
    },
    // 🏠 TEAL = green roof on building
    green_roof: {
      color:       '#00E5FF',   // electric cyan
      borderColor: '#006080',
      radius:      7,
      label:       '🏠 Green Roof',
      description: 'Install vegetation on rooftop to cut building cooling load and manage stormwater.'
    },
    // 🟤 ORANGE-BROWN = permeable pavement (rip out concrete → porous material)
    permeable: {
      color:       '#FF6B35',   // vivid orange — stands out against grey roads
      borderColor: '#8B2500',   // deep brown ring
      radius:      8,
      label:       '🟤 Replace with Permeable Pavement',
      description: 'Remove traditional concrete and install porous asphalt or interlocking blocks to allow rainwater to drain into the ground, reducing surface flooding.'
    },
    // 💧 DEEP BLUE = drainage point
    drainage: {
      color:       '#0A84FF',   // bright blue
      borderColor: '#003080',
      radius:      6,
      label:       '💧 Install Drainage',
      description: 'Install stormwater drain or French drain to channel excess rainwater away from flood-prone areas.'
    }
  };

  function init() {
    const mapElement = document.getElementById('city-map');
    if(!mapElement) return;

    map = L.map('city-map', {
        zoomControl: false,
        attributionControl: false
    }).setView([13.0415, 80.2365], 16);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri'
    }).addTo(map);

    L.control.attribution({position: 'bottomleft'}).addTo(map);

    const S = 13.0330, N = 13.0500, W = 80.2280, E = 80.2450;
    
    // Core boundary line - Bolder + Neon Red
    let boundaryRect = L.rectangle([[S, W], [N, E]], {
        color: '#FF0000', weight: 8, fill: false, dashArray: '10, 10', interactive: false
    });
    
    // Outer glow for extra pop
    let boundaryGlow = L.rectangle([[S, W], [N, E]], {
        color: '#FF0000', weight: 14, fill: false, opacity: 0.3, interactive: false
    });
    
    boundaryLayer = L.layerGroup([boundaryGlow, boundaryRect]).addTo(map);

    layerGroup = L.layerGroup().addTo(map);
    iconLayer  = L.layerGroup().addTo(map);

    map.on('zoomend', function() {
        if (map.getZoom() > 15.5) {
            if (map.hasLayer(boundaryLayer)) map.removeLayer(boundaryLayer);
        } else {
            if (!map.hasLayer(boundaryLayer)) map.addLayer(boundaryLayer);
        }
    });

    setTimeout(() => { map.invalidateSize(); }, 200);
  }

  function drawGrid(grid, isAnimation) {
    if(!map || !layerGroup || !grid || !grid.length || grid.length < 20 || !grid[0]) return;

    if(!rects) {
       rects = [];
       for(let i=0; i<20; i++){
          rects[i] = [];
          for(let j=0; j<20; j++){
             const cell = grid[i][j];
             if(!cell || !cell.bounds) { rects[i][j] = null; continue; }

             let rect = L.rectangle(cell.bounds, {
                 interactive: true,
                 fillColor: 'transparent',
                 weight: 0
             });

             rect.on('click', function(e) {
                 if (window.ExplainabilityEngine && window.Panels) {
                     const data = window.ExplainabilityEngine.getExplanation(i, j);
                     window.Panels.showExplanation(e.containerPoint.x, e.containerPoint.y, data);
                 }
             });
             rect.addTo(layerGroup);
             rects[i][j] = rect;
          }
       }
    }

    iconLayer.clearLayers();

    for(let i = 0; i < 20; i++){
      for(let j = 0; j < 20; j++){
         const cell = grid[i][j];
         const rect = rects[i][j];
         if (!cell || !rect) continue;

         // All rects stay transparent — grid never overrides satellite
         rect.setStyle({ fillColor: 'transparent', fillOpacity: 0, weight: 0, color: 'transparent' });

         if (!cell.intervention || cell.intervention === 'none') continue;

         const cfg = MARKER[cell.intervention];
         if (!cfg) continue;

         const center = rect.getBounds().getCenter();

         const marker = L.circleMarker(center, {
             radius:      cfg.radius,
             fillColor:   cfg.color,
             fillOpacity: 1,
             color:       cfg.borderColor,
             weight:      2.5,
             interactive: true
         });

         // Build rich tooltip from explainability data
         let explHtml = `
           <div style="padding:10px; width:220px; font-family:var(--font-family); background:rgba(15,15,20,0.98); color:#fff; border-radius:10px; box-sizing:border-box;">
             <div style="font-weight:900; font-size:1rem; color:${cfg.color}; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
               ${cfg.label}
             </div>
             <div style="font-size:0.85rem; color:#eee; line-height:1.5; margin-bottom:8px; overflow-wrap:break-word;">
               ${cfg.description}
             </div>
           </div>`;

         if (window.ExplainabilityEngine) {
           const data = window.ExplainabilityEngine.getExplanation(i, j);
           if (data && data.reason) {
             explHtml = `
               <div style="padding:10px; width:220px; font-family:var(--font-family); background:rgba(15,15,20,0.98); color:#fff; border-radius:10px; box-sizing:border-box;">
                 <div style="font-weight:900; font-size:1rem; color:${cfg.color}; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">
                   ${cfg.label}
                 </div>
                 <div style="font-size:0.85rem; color:#eee; line-height:1.5; margin-bottom:8px; overflow-wrap:break-word;">
                   ${cfg.description}
                 </div>
                 <div style="font-size:0.75rem; color:#aaa; border-top:1px solid rgba(255,255,255,0.1); padding-top:8px; font-style:italic; line-height:1.3;">
                   AI LOGIC: ${data.reason}
                 </div>
               </div>`;
           }
         }

         marker.bindTooltip(explHtml, {
           className:   'custom-tooltip',
           direction:   'top',
           opacity:     0.98,
           permanent:   false
         });

         marker.addTo(iconLayer);
      }
    }
  }

  function setWeather(raining) {
    isRaining = raining;
    const overlay = document.getElementById('rain-overlay');
    if (overlay) {
        if (raining) overlay.classList.add('active');
        else overlay.classList.remove('active');
    }
    if (window.AppState && window.AppState.grid) {
        drawGrid(window.AppState.grid, false);
    }
  }

  return { init, drawGrid, setWeather };
})();
