window.Canvas = (function() {
  let scene, camera, renderer, controls;
  let raycaster, mouse;
  let gridGroup = new THREE.Group();
  let cellObjects = [];
  const gridSize = 20;
  const cellSize = 1;
  const gap = 0.04;
  
  // Weather & Effects
  let rainSystem = null; // using LineSegments for beautiful cinematic streaks
  let cloudsGroup = new THREE.Group();
  let vehicles = [];
  let isRaining = false;
  let clock = new THREE.Clock();

  // Environment Lights
  let hemiLight, sunLight;

  // Materials arrays for variety
  let buildingMaterials = [];
  let matRoad, matGrass, matPavement;
  let matTreeLeaves, matTreeTrunk;

  // --- PROCEDURAL GENERATORS ---

  // Generate realistic skyscraper facade
  function createBuildingTexture(typeId) {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    
    // Base colors
    const colors = ["#d9d9d9", "#b3c1c9", "#e6daC3", "#8A9196"]; 
    ctx.fillStyle = colors[typeId % colors.length];
    ctx.fillRect(0, 0, 128, 256);
    
    // Windows logic
    const winWidth = 12;
    const winHeight = 16;
    const spacingX = 16;
    const spacingY = 24;
    
    const isGlassy = typeId % colors.length === 1;
    
    for (let y = 10; y < 240; y += spacingY) {
        for (let x = 10; x < 120; x += spacingX) {
            if (isGlassy) {
                ctx.fillStyle = "#4a6d8c"; // brighter sky reflection
                ctx.fillRect(x, y - 4, winWidth, winHeight + 8);
            } else {
                if (Math.random() > 0.05) { 
                    ctx.fillStyle = "#2c3e50"; 
                    ctx.fillRect(x, y, winWidth, winHeight);
                    
                    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
                    ctx.beginPath();
                    ctx.moveTo(x + 2, y + 2);
                    ctx.lineTo(x + winWidth - 2, y + winHeight - 2);
                    ctx.stroke();
                }
            }
        }
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(0, 0, 128, 128);
    
    for(let i=0; i<400; i++){
        ctx.fillStyle = Math.random()>0.5 ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)";
        ctx.fillRect(Math.random()*128, Math.random()*128, 3, 3);
    }

    ctx.fillStyle = "#f1c40f"; // Bright yellow
    ctx.fillRect(60, 0, 8, 30);
    ctx.fillRect(60, 50, 8, 30);
    ctx.fillRect(60, 100, 8, 30);
    
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  function init(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x73a2c6); // Muted real-world blue sky
    scene.fog = new THREE.FogExp2(0x73a2c6, 0.015);

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 1000);
    camera.position.set(-20, 25, 30);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.05; 
    controls.minDistance = 5;
    controls.maxDistance = 80;

    // --- DAYLIGHTING ---
    hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6); 
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    sunLight = new THREE.DirectionalLight(0xfff8ee, 1.2); 
    sunLight.position.set(20, 40, -10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096; 
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 150;
    const d = 25;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // --- MATERIALS ---
    for(let i=0; i<4; i++){
        let tex = createBuildingTexture(i);
        buildingMaterials.push(
            new THREE.MeshStandardMaterial({ 
                map: tex, 
                roughness: (i===1)?0.1:0.6, 
                metalness: (i===1)?0.5:0.1
            })
        );
    }
    
    matRoad = new THREE.MeshStandardMaterial({ map: createRoadTexture(), roughness: 0.9, color: 0xdddddd });
    matGrass = new THREE.MeshStandardMaterial({ color: 0x4b702e, roughness: 1.0 }); 
    matPavement = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.8 });
    matTreeLeaves = new THREE.MeshStandardMaterial({ color: 0x3d6e2e, roughness: 0.9 });
    matTreeTrunk = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });

    scene.add(gridGroup);
    
    // Base Ground 
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4b702e, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI/2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    setupWeather();

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    window.addEventListener('click', onMouseClick, false);
    window.addEventListener('resize', onWindowResize, false);

    renderer.setAnimationLoop(renderLoop);
  }

  function setupWeather() {
    // Rain System (Realistic cinematic LineSegments)
    const rainCount = 12000;
    const rainGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 6);
    for(let i=0; i<rainCount; i++){
        let x = (Math.random() - 0.5) * 60;
        let z = (Math.random() - 0.5) * 60;
        let y = Math.random() * 40 + 5;
        
        // top point
        positions[i*6] = x;
        positions[i*6 + 1] = y + 0.6; // streak length
        positions[i*6 + 2] = z;
        // bottom point (slightly skewed for wind)
        positions[i*6 + 3] = x - 0.05;
        positions[i*6 + 4] = y;
        positions[i*6 + 5] = z - 0.05;
    }
    rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const rainMat = new THREE.LineBasicMaterial({
      color: 0xaaccff,
      transparent: true,
      opacity: 0.45
    });
    rainSystem = new THREE.LineSegments(rainGeo, rainMat);
    rainSystem.visible = false;
    scene.add(rainSystem);

    // Day Storm Clouds
    for(let i=0; i<15; i++){
        const baseSize = 4 + Math.random()*4;
        const cloudGeo = new THREE.IcosahedronGeometry(baseSize, 1);
        const cloudMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            roughness: 1.0,
            metalness: 0.0,
            transparent: true,
            opacity: 0.75
        });
        
        let cGroup = new THREE.Group();
        for(let c=0; c<4; c++){
            let puff = new THREE.Mesh(cloudGeo, cloudMat);
            puff.position.set((Math.random()-0.5)*baseSize, (Math.random()-0.5)*baseSize*0.5, (Math.random()-0.5)*baseSize);
            puff.scale.setComponent(1, 0.5 + Math.random()*0.3); 
            cGroup.add(puff);
        }
        
        cGroup.position.set((Math.random()-0.5)*70, 25 + Math.random()*15, (Math.random()-0.5)*70);
        cloudsGroup.add(cGroup);
    }
    scene.add(cloudsGroup);
  }

  // --- PROCEDURAL 3D MODELS ---

  function spawnBuilding(height, typeId) {
      const group = new THREE.Group();
      const mat = buildingMaterials[typeId % buildingMaterials.length];
      
      const mainGeo = new THREE.BoxGeometry(cellSize*0.9, height, cellSize*0.9);
      const main = new THREE.Mesh(mainGeo, mat);
      main.position.y = height / 2;
      main.castShadow = true;
      main.receiveShadow = true;
      group.add(main);
      
      // Rooftop props
      if (height > 1.5) {
          const roofBoxes = Math.floor(Math.random()*4) + 1;
          for(let r=0; r<roofBoxes; r++){
              let bx = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), matPavement);
              bx.position.set((Math.random()-0.5)*0.5, height + 0.1, (Math.random()-0.5)*0.5);
              bx.castShadow = true;
              group.add(bx);
          }
          if (Math.random() > 0.4) {
              let ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2), matPavement);
              ant.position.set(0, height + 0.6, 0);
              group.add(ant);
          }
      }
      return group;
  }

  function spawnTree() {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.5), matTreeTrunk);
      trunk.position.y = 0.25;
      trunk.castShadow = true;
      group.add(trunk);
      
      const leavesGeo = new THREE.IcosahedronGeometry(0.35, 1);
      const pos = leavesGeo.attributes.position;
      for(let i=0; i<pos.count; i++) {
        pos.setXYZ(i, pos.getX(i) * (0.8+Math.random()*0.4), pos.getY(i) * (0.8+Math.random()*0.4), pos.getZ(i) * (0.8+Math.random()*0.4));
      }
      leavesGeo.computeVertexNormals();

      const leaves = new THREE.Mesh(leavesGeo, matTreeLeaves);
      leaves.position.y = 0.6;
      leaves.castShadow = true;
      group.add(leaves);

      const s = 0.6 + Math.random()*0.5;
      group.scale.set(s,s,s);
      return group;
  }

  function spawnCar() {
      const group = new THREE.Group();
      let cMat = new THREE.MeshStandardMaterial({color: (Math.random()>0.5)?0xeeeeee:0x111111, roughness: 0.2, metalness:0.4});
      let gMat = new THREE.MeshStandardMaterial({color: 0x010101, roughness:0.1});
      
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.35), cMat);
      body.position.y = 0.06;
      body.castShadow = true;
      group.add(body);

      const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.18), gMat);
      cabin.position.set(0, 0.13, -0.02);
      group.add(cabin);

      return { mesh: group };
  }

  function getRealismState(cell) {
      if (cell.type === "building") return { type: "building", height: 0.5 + (cell.density * 5) };
      if (cell.type === "road") return { type: "road", height: 0.05 };
      if (cell.type === "green") return { type: "grass", height: 0.05 };
      if (cell.type === "water" || cell.intervention === "waterbody") return { type: "water_base", height: -0.05 };
      return { type: "grass", height: 0 };
  }

  function createOrUpdateCell(i, j, cell, existingObj) {
      const offset = (gridSize * (cellSize + gap)) / 2;
      const x = j * (cellSize + gap) - offset + (cellSize / 2);
      const z = i * (cellSize + gap) - offset + (cellSize / 2);
      
      let state = getRealismState(cell);
      let cellWrapper;

      let requiresRebuild = !existingObj || existingObj.userData.cellType !== state.type;

      if (requiresRebuild) {
          if (existingObj) gridGroup.remove(existingObj);

          cellWrapper = new THREE.Group();
          cellWrapper.position.set(x, 0, z);
          cellWrapper.userData = { i, j, cellType: state.type };

          if (state.type === "building") {
              let styleId = (i*17 + j*7) % 4; 
              let bldg = spawnBuilding(Math.max(0.5, state.height), styleId);
              bldg.name = "base";
              cellWrapper.add(bldg);
          } else if (state.type === "road") {
              let pavement = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 0.05, cellSize), matRoad);
              pavement.position.y = 0.025;
              pavement.receiveShadow = true;
              pavement.name = "base";
              if(j===10 || j===11) pavement.rotation.y = 0; else pavement.rotation.y = Math.PI/2;
              cellWrapper.add(pavement);

              if (Math.random() > 0.85) {
                  let carData = spawnCar();
                  let car = carData.mesh;
                  car.position.set(0, 0.05, 0);
                  car.rotation.y = pavement.rotation.y;
                  cellWrapper.add(car);
                  vehicles.push({ obj: car, origX: x, origZ: z, dir: (j===10||j===11) ? [0,1] : [1,0] });
              }
          } else if (state.type === "grass") {
              let ground = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 0.05, cellSize), matGrass);
              ground.position.y = 0.025;
              ground.receiveShadow = true;
              ground.name = "base";
              cellWrapper.add(ground);

              let trees = cell.density > 0 ? 3 : 1;
              for(let k=0; k<trees; k++){
                  let t = spawnTree();
                  t.position.set((Math.random()-0.5)*0.5, 0.05, (Math.random()-0.5)*0.5);
                  cellWrapper.add(t);
              }
          } else {
              let ground = new THREE.Mesh(new THREE.BoxGeometry(cellSize, 1.0, cellSize), new THREE.MeshStandardMaterial({color: 0x1A475C}));
              ground.position.y = -0.5;
              ground.receiveShadow = true;
              ground.name = "base";
              cellWrapper.add(ground);
          }
          gridGroup.add(cellWrapper);
      } else {
          cellWrapper = existingObj;
      }

      // Clear dynamic elements (interventions, local water)
      for(let k = cellWrapper.children.length - 1; k >= 0; k--) {
          let name = cellWrapper.children[k].name;
          if(name && (name.startsWith('interv_') || name === 'local_water')) {
              cellWrapper.remove(cellWrapper.children[k]);
          }
      }

      // --- LOCALIZED FLOOD WATER ---
      // This completely fixes the "global underwater roads" issue!
      if (cell.water > 0.1 && state.type !== 'water_base') {
          let wDepth = Math.max(0.1, cell.water * 0.4); // max height cap natively relative to severity
          let wHeight = state.type === 'road' ? 0.05 : 0; // Rise above ground
          
          let wMat = new THREE.MeshStandardMaterial({ 
              color: 0x2A7A8D, transparent: true, opacity: 0.8, 
              roughness: 0.05, metalness: 0.6 
          });
          let localWater = new THREE.Mesh(new THREE.BoxGeometry(cellSize, wDepth, cellSize), wMat);
          localWater.position.set(0, wHeight + (wDepth / 2), 0);
          localWater.name = 'local_water';
          cellWrapper.add(localWater);
      }

      // --- INTERVENTIONS ---
      if (cell.intervention === "green_roof" && state.type === "building") {
          let roofGrass = new THREE.Mesh(new THREE.BoxGeometry(cellSize*0.9, 0.1, cellSize*0.9), matGrass);
          roofGrass.position.set(0, state.height + 0.05, 0);
          roofGrass.name = 'interv_GR';
          cellWrapper.add(roofGrass);
      } 
      if ((cell.intervention === "permeable" || cell.intervention === "drainage") && (state.type === "road" || state.type === "building")) {
          let permMat = new THREE.MeshStandardMaterial({color: 0x64a9d9, roughness: 0.4});
          let pad = new THREE.Mesh(new THREE.BoxGeometry(cellSize*0.8, 0.08, cellSize*0.8), permMat);
          pad.position.set(0, 0.03, 0);
          pad.name = 'interv_PR';
          cellWrapper.add(pad);
      }
      if (cell.intervention === "tree" && state.type !== "grass") {
          let t = spawnTree();
          t.position.set(0, 0.05, 0);
          t.name = 'interv_TR';
          cellWrapper.add(t);
      }

      // TWEEN HEIGHT (Dynamic building replacement visualization)
      if (window.gsap && state.type === "building" && !requiresRebuild) {
          let baseBase = cellWrapper.getObjectByName("base");
          if (baseBase) {
              let currentH = baseBase.children[0].geometry.parameters.height;
              if (currentH !== state.height) {
                  gsap.to(baseBase.children[0].scale, { y: state.height / currentH, duration: 0.5 });
                  gsap.to(baseBase.children[0].position, { y: state.height / 2, duration: 0.5 });
                  cellWrapper.children.forEach(c => {
                      if (c.name === 'interv_GR') gsap.to(c.position, { y: state.height + 0.05, duration: 0.5 });
                  });
              }
          }
      }

      return cellWrapper;
  }

  function drawGrid(grid) {
    if (!grid) return;
    for (let i = 0; i < grid.length; i++) {
        if (!cellObjects[i]) cellObjects[i] = [];
        for (let j = 0; j < grid[i].length; j++) {
            cellObjects[i][j] = createOrUpdateCell(i, j, grid[i][j], cellObjects[i][j]);
        }
    }
  }

  function setWeather(raining) {
      isRaining = raining;
      if (rainSystem) rainSystem.visible = raining;
      
      if (window.gsap) {
          gsap.to(sunLight, { intensity: raining ? 0.4 : 1.2, duration: 2 });
          gsap.to(hemiLight, { intensity: raining ? 0.3 : 0.6, duration: 2 });
          
          let skyColor = raining ? 0x566778 : 0x73a2c6;
          let colorObj = new THREE.Color(skyColor);
          gsap.to(scene.background, { r: colorObj.r, g: colorObj.g, b: colorObj.b, duration: 2 });
          gsap.to(scene.fog, { density: raining ? 0.04 : 0.015, duration: 2 });

          cloudsGroup.children.forEach(cGroup => {
              cGroup.children.forEach(c => {
                   gsap.to(c.material.color, { r: raining?0.4:1, g: raining?0.4:1, b: raining?0.45:1, duration: 2 });
              });
          });
      }
  }

  function renderLoop() {
    controls.update();
    const delta = Math.min(0.1, clock.getDelta()); 
    const time = clock.getElapsedTime();

    // Cinematic Line-Based Rain
    if (isRaining && rainSystem) {
        const positions = rainSystem.geometry.attributes.position.array;
        for(let i=0; i<12000; i++){
            positions[i*6 + 1] -= 35 * delta;
            positions[i*6 + 4] -= 35 * delta;
            
            if (positions[i*6 + 4] < 0) {
                 positions[i*6 + 1] = 25 + Math.random() * 15;
                 positions[i*6 + 4] = positions[i*6 + 1] - 0.6;
            }
        }
        rainSystem.geometry.attributes.position.needsUpdate = true;
    }

    cloudsGroup.children.forEach((cGroup, idx) => {
        cGroup.position.x += (isRaining ? 1.5 : 0.3) * delta;
        if (cGroup.position.x > 35) cGroup.position.x = -35;
    });

    vehicles.forEach(v => {
        // Find local water: check v's parent wrapper if it floods
        // Since water is mostly visual, let cars plow through dynamic floods
        v.obj.position.x += v.dir[0] * 3 * delta;
        v.obj.position.z += v.dir[1] * 3 * delta;
        if (Math.abs(v.obj.position.x - v.origX) > 10) v.obj.position.x = v.origX - 10 * v.dir[0];
        if (Math.abs(v.obj.position.z - v.origZ) > 10) v.obj.position.z = v.origZ - 10 * v.dir[1];
    });

    // Wobble all local_water blocks dynamically to simulate waves!
    gridGroup.children.forEach((wrapper) => {
        if(wrapper && wrapper.children) {
            wrapper.children.forEach(c => {
                if(c.name === 'local_water') {
                    // Slight bobbing and scaling to simulate water physics
                    c.scale.y = 1 + Math.sin(time * 3 + wrapper.position.x) * 0.1;
                }
            });
        }
    });

    renderer.render(scene, camera);
  }

  function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onMouseClick(event) {
    if(!raycaster || !camera) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(gridGroup.children, true);

    if (intersects.length > 0) {
      let object = intersects[0].object;
      while (object && !object.userData.i && object.parent) {
          object = object.parent;
      }
      
      if (object && object.userData && object.userData.i !== undefined) {
        if (window.UIController && window.UIController.showExplanation) {
          const { i, j } = object.userData;
          window.UIController.showExplanation(i, j, event.clientX, event.clientY);
        }
        if (window.gsap) {
          const orig = object.position.y;
          gsap.to(object.position, { y: orig + 0.3, duration: 0.15, yoyo: true, repeat: 1 });
        }
      }
    }
  }

  return { init, drawGrid, setWeather };
})();
