window.Canvas = (function() {
  let map;
  let layerGroup;
  let rects = null;
  let iconLayer;
  let boundaryLayer;
  let isRaining = false;
  
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

    const S = 13.0330;
    const N = 13.0500;
    const W = 80.2280;
    const E = 80.2450;
    let boundaryRect = L.rectangle([[S, W], [N, E]], {
        color: '#FF3B30', weight: 4, fill: false, dashArray: '8, 8', interactive: false
    });
    boundaryLayer = L.layerGroup([boundaryRect]).addTo(map);

    layerGroup = L.layerGroup().addTo(map);
    iconLayer = L.layerGroup().addTo(map);
    
    map.on('zoomend', function() {
        if (map.getZoom() > 15.5) {
            if (map.hasLayer(boundaryLayer)) map.removeLayer(boundaryLayer);
        } else {
            if (!map.hasLayer(boundaryLayer)) map.addLayer(boundaryLayer);
        }
    });

    setTimeout(() => { map.invalidateSize(); }, 200);
  }

  function getQualityStyle(cell) {
         return { fillColor: 'transparent', fillOpacity: 0, weight: 0, color: 'transparent' };
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
         
         const style = getQualityStyle(cell);
         rect.setStyle({
             fillColor: style.fillColor === 'none' ? 'transparent' : style.fillColor,
             fillOpacity: style.fillOpacity,
             weight: style.weight,
             color: style.color
         });

         let center = rect.getBounds().getCenter();

         let marker = null;
         if (cell.intervention === window.Constants.INTERVENTIONS.TREE) {
             marker = L.circleMarker(center, { radius: 6, fillColor: '#32CD32', fillOpacity: 1, color: '#ffffff', weight: 2, interactive: true });
         } else if (cell.intervention === window.Constants.INTERVENTIONS.GREEN_ROOF) {
             marker = L.circleMarker(center, { radius: 5, fillColor: '#00FA9A', fillOpacity: 1, color: '#000000', weight: 1, interactive: true });
         } else if (cell.intervention === window.Constants.INTERVENTIONS.PERMEABLE) {
             marker = L.circleMarker(center, { radius: 5, fillColor: '#DEB887', fillOpacity: 1, color: '#ffffff', weight: 1, interactive: true });
         }

         if (marker) {
             let explHtml = "<b>Intervention Action</b>";
             if (window.ExplainabilityEngine) {
                 const data = window.ExplainabilityEngine.getExplanation(i, j);
                 if (data) explHtml = `<div style="padding:4px;"><strong style="color:#30D158;">${data.intervention.replace(/_/g, ' ').toUpperCase()}</strong><br/><span style="font-size:0.8rem; font-style:italic;">Reason: ${data.reason.replace(/density/g,'Density').replace(/temp/g,'Temperature').replace(/permeability/g,'Porousness')}</span></div>`;
             }
             marker.bindTooltip(explHtml, { className: 'custom-tooltip', direction: 'top', opacity: 0.95 });
             marker.addTo(iconLayer);
         }
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
