// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let clock = new THREE.Clock();
let gridHelper, axisHelper;
let meshManager;

// Configuration parameters
let config = {
  gridSize: 8,
  size: 2,
  wireframe: false,
  collisionChecks: 100,
  speed: 100,
  showGrid: true,
  isPaused: false
};

// Initialize the visualization
function init() {
  // Setup renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const container = document.getElementById('canvas-container');
  if (container) {
    container.appendChild(renderer.domElement);
  } else {
    console.error("Canvas container not found, appending to body");
    document.body.appendChild(renderer.domElement);
  }

  // Check if dark mode is active
  const isDarkMode = document.body.classList.contains('dark-mode');

  // Setup scene with appropriate background color
  scene = new THREE.Scene();
  scene.background = new THREE.Color(isDarkMode ? 0x121212 : 0xffffff);

  // Create and add a grid helper
  gridHelper = new THREE.GridHelper(10, 10);
  scene.add(gridHelper);

  // Add axis helper to show X, Y, Z directions
  axisHelper = new THREE.AxesHelper(5);
  scene.add(axisHelper);

  console.log("Three.js scene initialized with", isDarkMode ? "dark" : "light", "background");

  // Setup camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(3, 3, 3);

  // Setup controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;

  // Add lighting
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  const secondLight = new THREE.DirectionalLight(0xffffff, 0.5);
  secondLight.position.set(-1, 0.5, -1);
  scene.add(secondLight);

  // Create mesh manager
  meshManager = new MeshManager(scene);
  meshManager.createGridMesh(config.gridSize, config.size);
  meshManager.rebuildGeometry();

  // Update stats initially
  updateStats();

  // Setup event listeners
  setupEventListeners();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Listen for dark mode changes
  setupDarkModeListener();

  // Start animation loop
  animate();

  console.log("Organic growth simulation initialized");
}

// Update stats display
function updateStats() {
  const statsElement = document.getElementById('stats');
  if (statsElement && meshManager) {
    statsElement.textContent = `Vertices: ${meshManager.vertices.length} | Faces: ${meshManager.faces.length} | Iter: ${meshManager.collisionCount}`;
  }
}

// Function to toggle grid visibility
function toggleGrid() {
  config.showGrid = !config.showGrid;
  if (gridHelper) {
    gridHelper.visible = config.showGrid;
  }
  if (axisHelper) {
    axisHelper.visible = config.showGrid;
  }
}

// Listen for dark mode changes
function setupDarkModeListener() {
  // Watch for clicks on the dark mode toggle button
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    console.log("Dark mode toggle button found, adding listener");
    darkModeToggle.addEventListener('click', updateSceneBackground);
  } else {
    console.log("Dark mode toggle button not found, using MutationObserver");
    // If we can't find the button directly, watch for class changes on body
    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.attributeName === 'class') {
          updateSceneBackground();
        }
      });
    });

    observer.observe(document.body, { attributes: true });
  }
}

// Update scene background based on dark mode state
function updateSceneBackground() {
  if (!scene) return;

  const isDarkMode = document.body.classList.contains('dark-mode');
  scene.background = new THREE.Color(isDarkMode ? 0x121212 : 0xffffff);
  console.log("Updated Three.js scene background to", isDarkMode ? "dark" : "light", "mode");
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Update controls
  if (controls) controls.update();

  if (!config.isPaused) {
    // Update mesh
    const time = clock.getElapsedTime() * 1000;
    meshManager.update(time);

    // Handle subdivision every 100 frames
    const frame = Math.floor(time / 16.7); // approx 60fps
    if (frame % 100 === 0 && time - meshManager.lastSubdivideTime > 2000) {
      if (meshManager.subdivideMesh(time)) {
        meshManager.lastSubdivideTime = time;
      }
    }

    // Reset if too many vertices
    if (frame % 300 === 0 && meshManager.vertices.length > 3000) {
      meshManager.createGridMesh(config.gridSize, config.size);
      meshManager.rebuildGeometry();
    }

    // Update stats
    updateStats();
  }

  // Render the scene
  renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Setup UI event listeners
function setupEventListeners() {
  // Reset button
  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      meshManager.createGridMesh(config.gridSize, config.size);
      meshManager.rebuildGeometry();
      clearDebug();
    });
  }

  // Pause button
  const pauseBtn = document.getElementById('pauseBtn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () {
      config.isPaused = !config.isPaused;
      this.textContent = config.isPaused ? "Resume" : "Pause";
    });
  }

  // Debug clear button
  const debugBtn = document.getElementById('debugBtn');
  if (debugBtn) {
    debugBtn.addEventListener('click', clearDebug);
  }

  // Adaptive smooth button 
  const adaptiveSmoothBtn = document.getElementById('adaptiveSmoothBtn');
  if (adaptiveSmoothBtn) {
    adaptiveSmoothBtn.addEventListener('click', function () {
      if (meshManager) {
        meshManager.performAdaptiveSmoothing();
        updateStats();
      }
    });
  }

  // Speed slider
  const speedSlider = document.getElementById('speedSlider');
  const speedValue = document.getElementById('speedValue');
  if (speedSlider && speedValue) {
    speedSlider.value = config.speed;
    speedValue.textContent = config.speed;

    speedSlider.addEventListener('input', function () {
      config.speed = parseInt(this.value);
      speedValue.textContent = config.speed;
      if (meshManager) {
        meshManager.setSimulationSpeed(config.speed);
      }
    });
  }

  // Collision checks slider
  const collisionSlider = document.getElementById('collisionSlider');
  const collisionValue = document.getElementById('collisionValue');
  if (collisionSlider && collisionValue) {
    collisionSlider.value = config.collisionChecks;
    collisionValue.textContent = config.collisionChecks;

    collisionSlider.addEventListener('input', function () {
      config.collisionChecks = parseInt(this.value);
      collisionValue.textContent = config.collisionChecks;
      if (meshManager) {
        meshManager.setCollisionChecks(config.collisionChecks);
      }
    });
  }

  // Control panel minimize/maximize
  const minimizeBtn = document.getElementById('minimizeControls');
  const controlsPanel = document.getElementById('controls');
  if (minimizeBtn && controlsPanel) {
    minimizeBtn.addEventListener('click', function () {
      controlsPanel.classList.toggle('minimized');
      const icon = this.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-chevron-right');
        icon.classList.toggle('fa-chevron-left');
      }
    });
  }
}

// Clear debug display
function clearDebug() {
  const debugElement = document.getElementById('debug');
  if (debugElement) {
    debugElement.innerHTML = '';
  }
}

// Add debug message
function addDebugMessage(message) {
  const debugElement = document.getElementById('debug');
  if (debugElement) {
    const div = document.createElement('div');
    div.textContent = message;
    debugElement.appendChild(div);

    // Limit the number of messages to 10
    while (debugElement.children.length > 10) {
      debugElement.removeChild(debugElement.firstChild);
    }
  }
}

// Enhanced Spatial Grid for collision detection
class SpatialGrid {
  constructor(cellSize = 0.5) {
    this.cellSize = cellSize;
    this.cells = new Map();
    this.reset();
  }

  reset() {
    this.cells.clear();
  }

  // Get cell key for a position
  getKey(pos) {
    const x = Math.floor(pos.x / this.cellSize);
    const y = Math.floor(pos.y / this.cellSize);
    const z = Math.floor(pos.z / this.cellSize);
    return `${x},${y},${z}`;
  }

  // Add item to grid
  insert(item, pos) {
    const key = this.getKey(pos);
    if (!this.cells.has(key)) {
      this.cells.set(key, []);
    }
    this.cells.get(key).push(item);
  }

  // Get nearby items
  query(pos, radius = 1) {
    const results = [];
    const cellRadius = Math.ceil(radius / this.cellSize);
    const baseX = Math.floor(pos.x / this.cellSize);
    const baseY = Math.floor(pos.y / this.cellSize);
    const baseZ = Math.floor(pos.z / this.cellSize);

    // Check neighboring cells
    for (let x = baseX - cellRadius; x <= baseX + cellRadius; x++) {
      for (let y = baseY - cellRadius; y <= baseY + cellRadius; y++) {
        for (let z = baseZ - cellRadius; z <= baseZ + cellRadius; z++) {
          const key = `${x},${y},${z}`;
          if (this.cells.has(key)) {
            results.push(...this.cells.get(key));
          }
        }
      }
    }
    return results;
  }
}

// Mesh manager
class MeshManager {
  constructor(scene) {
    this.scene = scene;
    this.vertices = [];
    this.faces = [];
    this.edges = new Map();
    this.grid = new SpatialGrid(0.5);
    this.collisionCount = 0;
    this.geometry = null;
    this.mesh = null;
    this.material = null;
    this.wireframe = false;
    this.collisionThreshold = 0.25;
    this.lastTime = 0;
    this.lastSubdivideTime = 0;
    this.simulationSpeed = 100; // ms per step
    this.collisionChecks = 100; // number of collision checks per frame
    this.statsElement = document.getElementById('stats');
    this.debugElement = document.getElementById('debug');
  }

  // Create initial grid mesh
  createGridMesh(gridSize = 8, size = 2) {
    this.vertices = [];
    this.faces = [];
    this.edges = new Map();
    this.collisionCount = 0;

    const halfSize = size / 2;
    const cellSize = size / gridSize;

    // Create grid vertices
    for (let i = 0; i <= gridSize; i++) {
      for (let j = 0; j <= gridSize; j++) {
        const x = -halfSize + i * cellSize;
        const y = -halfSize + j * cellSize;
        const z = 0;

        const isBoundary = i === 0 || j === 0 || i === gridSize || j === gridSize;

        this.vertices.push({
          pos: new THREE.Vector3(x, y, z),
          vel: new THREE.Vector3(),
          age: 0,
          growthDir: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(),
          isBoundary,
          lastCollision: 0
        });
      }
    }

    // Create faces
    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const idx = i * (gridSize + 1) + j;
        const idx1 = idx + 1;
        const idx2 = idx + (gridSize + 1);
        const idx3 = idx2 + 1;

        this.faces.push([idx, idx1, idx2]);
        this.faces.push([idx1, idx3, idx2]);
      }
    }

    this.buildEdgeMap();
    this.updateSpatialGrid();
    this.updateInfoDisplay();
  }

  // Build edge map from faces
  buildEdgeMap() {
    this.edges.clear();

    for (let f = 0; f < this.faces.length; f++) {
      let tri = this.faces[f];
      for (let i = 0; i < 3; i++) {
        let a = tri[i];
        let b = tri[(i + 1) % 3];
        let key = a < b ? `${a}_${b}` : `${b}_${a}`;

        if (!this.edges.has(key)) {
          let dist = this.vertices[a].pos.distanceTo(this.vertices[b].pos);
          const isBoundary = this.vertices[a].isBoundary || this.vertices[b].isBoundary;

          this.edges.set(key, {
            v1: a,
            v2: b,
            key,
            restLength: dist,
            faces: [f],
            isBoundary,
            age: 0,
            growthDir: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(),
            lastCollision: 0
          });
        } else {
          this.edges.get(key).faces.push(f);
          this.edges.get(key).isBoundary = false;
        }
      }
    }
  }

  // Find boundary edges
  findBoundaryEdges() {
    return Array.from(this.edges.values()).filter(edge => edge.faces.length === 1);
  }

  // Update spatial grid for fast collision detection
  updateSpatialGrid() {
    this.grid.reset();

    // Add edges to grid
    for (const [key, edge] of this.edges) {
      const v1 = this.vertices[edge.v1].pos;
      const v2 = this.vertices[edge.v2].pos;
      const midpoint = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
      this.grid.insert({ type: 'edge', key }, midpoint);
    }

    // Add faces to grid
    for (let i = 0; i < this.faces.length; i++) {
      const face = this.faces[i];
      const center = this.calculateFaceCenter(face);
      this.grid.insert({ type: 'face', index: i }, center);
    }
  }

  // Calculate face center
  calculateFaceCenter(faceIndices) {
    const v1 = this.vertices[faceIndices[0]].pos;
    const v2 = this.vertices[faceIndices[1]].pos;
    const v3 = this.vertices[faceIndices[2]].pos;

    return new THREE.Vector3(
      (v1.x + v2.x + v3.x) / 3,
      (v1.y + v2.y + v3.y) / 3,
      (v1.z + v2.z + v3.z) / 3
    );
  }

  // Update info display
  updateInfoDisplay() {
    if (this.statsElement) {
      this.statsElement.textContent = `Vertices: ${this.vertices.length} | Faces: ${this.faces.length} | Iter: ${this.collisionCount}`;
    }
  }

  // Set simulation speed
  setSimulationSpeed(speed) {
    this.simulationSpeed = speed;
  }

  // Set number of collision checks per frame
  setCollisionChecks(checks) {
    this.collisionChecks = checks;
  }

  // Perform adaptive smoothing
  performAdaptiveSmoothing() {
    // Skip if too many vertices
    if (this.vertices.length >= 3000) {
      addDebugMessage("Too many vertices for smoothing");
      return false;
    }

    // Create a copy of vertices
    const newVertices = [...this.vertices];

    // For each interior vertex
    for (let i = 0; i < this.vertices.length; i++) {
      // Skip boundary vertices
      if (this.vertices[i].isBoundary) continue;

      // Find all adjacent vertices
      const neighbors = this.findNeighbors(i);

      if (neighbors.length > 0) {
        // Calculate average position
        const avgPos = new THREE.Vector3();
        for (const neighborIdx of neighbors) {
          avgPos.add(this.vertices[neighborIdx].pos);
        }
        avgPos.divideScalar(neighbors.length);

        // Apply weighted smoothing (Laplacian)
        const weight = 0.5;
        newVertices[i].pos.lerp(avgPos, weight);
      }
    }

    // Update vertices
    this.vertices = newVertices;

    // Update geometry
    this.updateGeometry();

    // Add debug message
    addDebugMessage("Performed adaptive smoothing");

    return true;
  }

  // Find neighbor vertices of a vertex
  findNeighbors(vertexIdx) {
    const neighbors = new Set();

    // Check all edges for this vertex
    for (const [key, edge] of this.edges) {
      if (edge.v1 === vertexIdx) {
        neighbors.add(edge.v2);
      } else if (edge.v2 === vertexIdx) {
        neighbors.add(edge.v1);
      }
    }

    return Array.from(neighbors);
  }

  // Create or update mesh
  rebuildGeometry() {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      if (this.geometry) this.geometry.dispose();
      if (this.material) this.material.dispose();
    }

    // Create new geometry
    this.geometry = new THREE.BufferGeometry();

    // Add positions
    const positions = new Float32Array(this.vertices.length * 3);
    for (let i = 0; i < this.vertices.length; i++) {
      positions[i * 3] = this.vertices[i].pos.x;
      positions[i * 3 + 1] = this.vertices[i].pos.y;
      positions[i * 3 + 2] = this.vertices[i].pos.z;
    }

    // Add indices
    const indices = [];
    for (const face of this.faces) {
      indices.push(face[0], face[1], face[2]);
    }

    this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geometry.setIndex(indices);
    this.geometry.computeVertexNormals();

    // Add colors based on height
    const colors = new Float32Array(this.vertices.length * 3);

    // Find height range
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (let i = 0; i < this.vertices.length; i++) {
      minZ = Math.min(minZ, this.vertices[i].pos.z);
      maxZ = Math.max(maxZ, this.vertices[i].pos.z);
    }

    // Ensure we have some range
    if (maxZ - minZ < 0.1) maxZ = minZ + 1;

    // Color vertices
    for (let i = 0; i < this.vertices.length; i++) {
      const heightValue = (this.vertices[i].pos.z - minZ) / (maxZ - minZ);
      const isBoundary = this.vertices[i].isBoundary;

      let r, g, b;

      if (isBoundary) {
        // Boundary vertices: red-yellow gradient
        r = 1.0;
        g = heightValue * 0.8;
        b = 0.0;
      } else {
        // Interior vertices: blue-purple-pink gradient
        if (heightValue < 0.33) {
          r = heightValue * 3;
          g = 0.0;
          b = 1.0;
        } else if (heightValue < 0.66) {
          r = 1.0;
          g = 0.0;
          b = 1.0 - (heightValue - 0.33) * 3;
        } else {
          r = 1.0;
          g = (heightValue - 0.66) * 3;
          b = 0.0;
        }
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create material
    this.material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      shininess: 30,
      emissive: 0x333333,
      emissiveIntensity: 0.5,
      specular: 0xffffff,
      wireframe: this.wireframe
    });

    // Create mesh
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.scene.add(this.mesh);
  }

  // Update existing geometry
  updateGeometry() {
    if (!this.geometry || !this.mesh) {
      this.rebuildGeometry();
      return;
    }

    // Update positions if size matches
    if (this.geometry.attributes.position.count === this.vertices.length) {
      const positions = this.geometry.attributes.position.array;
      for (let i = 0; i < this.vertices.length; i++) {
        positions[i * 3] = this.vertices[i].pos.x;
        positions[i * 3 + 1] = this.vertices[i].pos.y;
        positions[i * 3 + 2] = this.vertices[i].pos.z;
      }

      this.geometry.attributes.position.needsUpdate = true;
      this.geometry.computeVertexNormals();
    } else {
      // Otherwise rebuild
      this.rebuildGeometry();
    }

    this.updateInfoDisplay();
  }

  // Calculate distance between edges
  distanceBetweenEdges(a0, a1, b0, b1) {
    const A = new THREE.Vector3().subVectors(a1, a0);
    const B = new THREE.Vector3().subVectors(b1, b0);
    const C = new THREE.Vector3().subVectors(b0, a0);

    // Optimization: quick check using bounding boxes
    const boxA = new THREE.Box3().setFromPoints([a0, a1]);
    const boxB = new THREE.Box3().setFromPoints([b0, b1]);

    if (!boxA.intersectsBox(boxB) && boxA.distanceToPoint(b0) > this.collisionThreshold &&
      boxB.distanceToPoint(a0) > this.collisionThreshold) {
      return {
        distance: Infinity,
        pointOnA: null,
        pointOnB: null
      };
    }

    // Quick check if lines are parallel
    const Aen = A.dot(A);
    const Ben = B.dot(B);
    const AxB = new THREE.Vector3().crossVectors(A, B).length();

    if (AxB < 1e-6 * Math.sqrt(Aen * Ben)) {
      return {
        distance: Infinity,
        pointOnA: null,
        pointOnB: null
      };
    }

    // Calculate closest points
    const AC = new THREE.Vector3().crossVectors(A, C);
    const BC = new THREE.Vector3().crossVectors(B, C);

    const ACxB = new THREE.Vector3().crossVectors(AC, B).length();
    const AxBC = new THREE.Vector3().crossVectors(A, BC).length();

    let s = AxBC / AxB;
    let t = ACxB / AxB;

    // Clamp parameters
    if (s < 0) s = 0;
    else if (s > 1) s = 1;

    if (t < 0) t = 0;
    else if (t > 1) t = 1;

    // Calculate closest points
    const pointOnA = new THREE.Vector3().addVectors(a0, A.clone().multiplyScalar(s));
    const pointOnB = new THREE.Vector3().addVectors(b0, B.clone().multiplyScalar(t));

    return {
      distance: pointOnA.distanceTo(pointOnB),
      pointOnA,
      pointOnB
    };
  }

  // Check for triangle intersection
  triangleIntersection(tri1, tri2) {
    // Quick bounding box test
    const box1 = new THREE.Box3().setFromPoints(tri1);
    const box2 = new THREE.Box3().setFromPoints(tri2);

    if (!box1.intersectsBox(box2)) {
      return { intersect: false };
    }

    // Check proximity between triangles
    const center1 = new THREE.Vector3().add(tri1[0]).add(tri1[1]).add(tri1[2]).divideScalar(3);
    const center2 = new THREE.Vector3().add(tri2[0]).add(tri2[1]).add(tri2[2]).divideScalar(3);
    const dist = center1.distanceTo(center2);

    if (dist < this.collisionThreshold) {
      const dir = new THREE.Vector3().subVectors(center1, center2).normalize();
      return { intersect: true, direction: dir };
    }

    // Check edges
    for (let i = 0; i < 3; i++) {
      const e1Start = tri1[i];
      const e1End = tri1[(i + 1) % 3];

      for (let j = 0; j < 3; j++) {
        const e2Start = tri2[j];
        const e2End = tri2[(j + 1) % 3];

        const result = this.distanceBetweenEdges(e1Start, e1End, e2Start, e2End);

        if (result.distance < this.collisionThreshold) {
          const dir = new THREE.Vector3().subVectors(result.pointOnA, result.pointOnB).normalize();
          return { intersect: true, direction: dir };
        }
      }
    }

    return { intersect: false };
  }

  // Optimized collision detection using spatial grid
  detectCollisions(time) {
    let collidedItems = new Set();
    let localCollisions = 0;

    // Check edge collisions
    const boundaryEdges = this.findBoundaryEdges();

    for (const edge1 of boundaryEdges) {
      // Skip recently collided edges
      if (time - edge1.lastCollision < 0.2) continue;
      if (collidedItems.has(edge1.key)) continue;

      const v1Start = this.vertices[edge1.v1].pos;
      const v1End = this.vertices[edge1.v2].pos;
      const midpoint = new THREE.Vector3().addVectors(v1Start, v1End).multiplyScalar(0.5);

      // Query nearby edges
      const nearbyItems = this.grid.query(midpoint, this.collisionThreshold * 2);

      for (const item of nearbyItems) {
        if (item.type !== 'edge') continue;

        const edge2Key = item.key;
        if (edge2Key === edge1.key || collidedItems.has(edge2Key)) continue;

        const edge2 = this.edges.get(edge2Key);
        if (!edge2 || time - edge2.lastCollision < 0.2) continue;

        // Skip if edges share vertices
        if (edge1.v1 === edge2.v1 || edge1.v1 === edge2.v2 ||
          edge1.v2 === edge2.v1 || edge1.v2 === edge2.v2) continue;

        const v2Start = this.vertices[edge2.v1].pos;
        const v2End = this.vertices[edge2.v2].pos;

        // Check distance
        const result = this.distanceBetweenEdges(v1Start, v1End, v2Start, v2End);

        if (result.distance < this.collisionThreshold) {
          localCollisions++;
          collidedItems.add(edge1.key);
          collidedItems.add(edge2Key);

          // Record collision time
          edge1.lastCollision = time;
          edge2.lastCollision = time;

          // Apply repulsion force
          const repulsionDir = new THREE.Vector3().subVectors(
            result.pointOnA, result.pointOnB
          ).normalize();

          const repulsionForce = 0.15;

          this.vertices[edge1.v1].vel.add(repulsionDir.clone().multiplyScalar(repulsionForce));
          this.vertices[edge1.v2].vel.add(repulsionDir.clone().multiplyScalar(repulsionForce));

          this.vertices[edge2.v1].vel.sub(repulsionDir.clone().multiplyScalar(repulsionForce));
          this.vertices[edge2.v2].vel.sub(repulsionDir.clone().multiplyScalar(repulsionForce));

          // Modify growth directions
          if (edge1.growthDir && edge2.growthDir) {
            const perpDir = new THREE.Vector3().crossVectors(
              repulsionDir,
              new THREE.Vector3(Math.random(), Math.random(), Math.random())
            ).normalize();

            edge1.growthDir.lerp(perpDir, 0.3).normalize();
            edge2.growthDir.lerp(perpDir.clone().negate(), 0.3).normalize();
          }

          break;
        }
      }
    }

    // Face collision detection
    for (let i = 0; i < this.faces.length; i++) {
      const face1 = this.faces[i];

      // Skip if any vertex recently collided
      if (face1.some(idx => collidedItems.has(idx))) continue;

      const face1Verts = face1.map(idx => this.vertices[idx].pos);
      const center = this.calculateFaceCenter(face1);

      // Query nearby faces
      const nearbyItems = this.grid.query(center, this.collisionThreshold * 3);

      for (const item of nearbyItems) {
        if (item.type !== 'face' || item.index <= i) continue;

        const j = item.index;
        const face2 = this.faces[j];

        // Skip if faces share vertices
        if (face1.some(v => face2.includes(v))) continue;

        const face2Verts = face2.map(idx => this.vertices[idx].pos);

        // Check intersection
        const result = this.triangleIntersection(face1Verts, face2Verts);

        if (result.intersect) {
          localCollisions++;
          face1.forEach(idx => collidedItems.add(idx));
          face2.forEach(idx => collidedItems.add(idx));

          // Apply repulsion
          const repulsionForce = 0.2;

          // Apply to face1 vertices
          face1.forEach(idx => {
            this.vertices[idx].vel.add(result.direction.clone().multiplyScalar(repulsionForce));
            this.vertices[idx].lastCollision = time;
          });

          // Apply to face2 vertices
          face2.forEach(idx => {
            this.vertices[idx].vel.sub(result.direction.clone().multiplyScalar(repulsionForce));
            this.vertices[idx].lastCollision = time;
          });

          break;
        }
      }
    }

    if (localCollisions > 0) {
      this.collisionCount += localCollisions;
      this.updateInfoDisplay();
    }

    return localCollisions;
  }

  // Simulate growth
  simulateGrowth(dt, time) {
    // Find boundary edges
    const boundaryEdges = this.findBoundaryEdges();

    // Update edge ages
    for (let [key, edge] of this.edges) {
      edge.age += dt;
    }

    // Process each boundary edge
    for (const edge of boundaryEdges) {
      // Skip if this edge recently had a collision
      if (time - edge.lastCollision < 0.5) continue;

      const v1 = this.vertices[edge.v1];
      const v2 = this.vertices[edge.v2];

      // Skip non-boundary
      if (!(v1.isBoundary || v2.isBoundary)) continue;

      // Get growth direction
      let growthDir = edge.growthDir.clone();

      // Calculate tangent vector
      const tangent = new THREE.Vector3().subVectors(v2.pos, v1.pos).normalize();

      // Calculate normal vector
      const normal = new THREE.Vector3().crossVectors(tangent, growthDir).normalize();

      // Enhance boundary growth
      if (edge.isBoundary) {
        // Make growth more perpendicular to boundary
        growthDir.lerp(normal, 0.7).normalize();

        // Add slight upward bias
        growthDir.z += 0.3 * Math.random();
        growthDir.normalize();
      }

      // Minor randomization
      growthDir.x += (Math.random() - 0.5) * 0.1;
      growthDir.y += (Math.random() - 0.5) * 0.1;
      growthDir.z += (Math.random() - 0.5) * 0.1;
      growthDir.normalize();

      // Calculate growth strength
      const ageFactor = Math.min(edge.age * 0.5, 1.0);
      const boundaryMultiplier = edge.isBoundary ? 1.5 : 1.0;
      const growthForce = 0.3 * dt * ageFactor * boundaryMultiplier;

      // Apply growth force
      const growthVector = growthDir.clone().multiplyScalar(growthForce);
      v1.vel.add(growthVector);
      v2.vel.add(growthVector);
    }

    // Integrate velocities
    for (let v of this.vertices) {
      v.pos.add(v.vel.clone().multiplyScalar(dt));
      v.vel.multiplyScalar(0.95); // Damping

      // Cap max velocity
      const maxSpeed = 0.5;
      if (v.vel.length() > maxSpeed) {
        v.vel.normalize().multiplyScalar(maxSpeed);
      }
    }
  }

  // Apply edge length constraints
  applyEdgeConstraints() {
    for (let [key, edge] of this.edges) {
      let v1 = this.vertices[edge.v1];
      let v2 = this.vertices[edge.v2];
      let currentDist = v1.pos.distanceTo(v2.pos);

      // For long edges
      if (currentDist > edge.restLength * 1.5) {
        let correction = (currentDist - edge.restLength) * 0.2;
        let dir = new THREE.Vector3().subVectors(v2.pos, v1.pos).normalize();

        v1.pos.add(dir.clone().multiplyScalar(correction * 0.5));
        v2.pos.sub(dir.clone().multiplyScalar(correction * 0.5));
      }

      // For short edges
      if (currentDist < edge.restLength * 0.5) {
        let correction = (edge.restLength - currentDist) * 0.2;
        let dir = new THREE.Vector3().subVectors(v2.pos, v1.pos).normalize();

        if (isNaN(dir.x) || isNaN(dir.y) || isNaN(dir.z)) {
          dir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
        }

        v1.pos.sub(dir.clone().multiplyScalar(correction * 0.5));
        v2.pos.add(dir.clone().multiplyScalar(correction * 0.5));
      }
    }
  }

  // Optimized Catmull-Clark subdivision
  subdivideMesh(time) {
    // Skip if too many vertices
    if (this.vertices.length >= 3000) return false;

    // Find edge pairs for quads
    const quads = this.identifyQuads();
    if (quads.length === 0) return false;

    // Create new vertices and faces
    const newVertices = [...this.vertices];
    const newFaces = [];

    // Create face points
    const facePoints = [];
    for (const quad of quads) {
      const facePos = new THREE.Vector3();
      const faceVel = new THREE.Vector3();
      let minAge = Infinity;

      // Average vertex positions
      for (const idx of quad) {
        facePos.add(this.vertices[idx].pos);
        faceVel.add(this.vertices[idx].vel);
        minAge = Math.min(minAge, this.vertices[idx].age);
      }

      facePos.divideScalar(4);
      faceVel.divideScalar(4);

      // Add variation
      facePos.x += (Math.random() - 0.5) * 0.03;
      facePos.y += (Math.random() - 0.5) * 0.03;
      facePos.z += (Math.random() - 0.5) * 0.03;

      // Create face point
      const facePointIdx = newVertices.length;
      newVertices.push({
        pos: facePos,
        vel: faceVel,
        age: minAge,
        growthDir: new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize(),
        isBoundary: false,
        lastCollision: time
      });

      facePoints.push(facePointIdx);
    }

    // Create edge points
    const edgePoints = new Map();

    for (let [edgeKey, edge] of this.edges) {
      const v1 = edge.v1;
      const v2 = edge.v2;

      // Calculate edge midpoint
      const edgePos = new THREE.Vector3().addVectors(
        this.vertices[v1].pos,
        this.vertices[v2].pos
      ).multiplyScalar(0.5);

      // Add variation
      edgePos.x += (Math.random() - 0.5) * 0.02;
      edgePos.y += (Math.random() - 0.5) * 0.02;
      edgePos.z += (Math.random() - 0.5) * 0.02;

      // Create edge point
      const edgePointIdx = newVertices.length;
      newVertices.push({
        pos: edgePos,
        vel: new THREE.Vector3().addVectors(
          this.vertices[v1].vel,
          this.vertices[v2].vel
        ).multiplyScalar(0.5),
        age: Math.min(this.vertices[v1].age, this.vertices[v2].age),
        growthDir: edge.growthDir.clone(),
        isBoundary: edge.isBoundary,
        lastCollision: Math.max(time - 0.5,
          Math.min(this.vertices[v1].lastCollision, this.vertices[v2].lastCollision))
      });

      edgePoints.set(edgeKey, edgePointIdx);
    }

    // Create new faces
    let quadIndex = 0;
    for (const quad of quads) {
      const facePointIdx = facePoints[quadIndex++];

      // Create 4 new quads (triangulated as 8 triangles)
      for (let i = 0; i < 4; i++) {
        const cornerIdx = quad[i];
        const nextCornerIdx = quad[(i + 1) % 4];

        // Get edge points
        const edgeKey1 = cornerIdx < nextCornerIdx ?
          `${cornerIdx}_${nextCornerIdx}` :
          `${nextCornerIdx}_${cornerIdx}`;

        const edgeKey2 = cornerIdx < quad[(i + 3) % 4] ?
          `${cornerIdx}_${quad[(i + 3) % 4]}` :
          `${quad[(i + 3) % 4]}_${cornerIdx}`;

        const edgePoint1 = edgePoints.get(edgeKey1);
        const edgePoint2 = edgePoints.get(edgeKey2);

        if (edgePoint1 !== undefined && edgePoint2 !== undefined) {
          // Create two triangles
          newFaces.push([cornerIdx, edgePoint1, facePointIdx]);
          newFaces.push([cornerIdx, facePointIdx, edgePoint2]);
        }
      }
    }

    // Use subdivision results
    this.vertices = newVertices;
    this.faces = newFaces;
    this.buildEdgeMap();
    this.updateSpatialGrid();
    this.rebuildGeometry();

    return true;
  }

  // Identify potential quads from triangle pairs
  identifyQuads() {
    const quads = [];
    const processed = new Set();

    // Check each edge
    for (const [edgeKey, edge] of this.edges) {
      // Skip boundary edges
      if (edge.isBoundary) continue;

      // Skip processed edges
      if (processed.has(edgeKey)) continue;

      // Only process edges with exactly 2 faces
      if (edge.faces.length !== 2) continue;

      const f1 = edge.faces[0];
      const f2 = edge.faces[1];

      // Skip processed faces
      if (processed.has(`f${f1}`) || processed.has(`f${f2}`)) continue;

      const face1 = this.faces[f1];
      const face2 = this.faces[f2];

      // Find shared vertices
      const shared = face1.filter(v => face2.includes(v));

      if (shared.length === 2) {
        // Find unshared vertices
        const v1 = face1.find(v => !shared.includes(v));
        const v2 = face2.find(v => !shared.includes(v));

        if (v1 !== undefined && v2 !== undefined) {
          // Reorder for consistent quad
          quads.push([shared[0], v1, shared[1], v2]);

          // Mark as processed
          processed.add(edgeKey);
          processed.add(`f${f1}`);
          processed.add(`f${f2}`);
        }
      }
    }

    return quads;
  }

  // Update simulation
  update(time) {
    const dt = Math.min(Math.max((time - this.lastTime) / 1000, 0.001), 0.05);
    this.lastTime = time;

    // Detect collisions
    this.detectCollisions(time);

    // Simulate growth
    this.simulateGrowth(dt, time);

    // Apply edge constraints
    this.applyEdgeConstraints();

    // Update spatial grid
    this.updateSpatialGrid();

    // Update geometry
    this.updateGeometry();
  }

  // Toggle wireframe
  toggleWireframe() {
    this.wireframe = !this.wireframe;
    if (this.material) {
      this.material.wireframe = this.wireframe;
    }
  }

  // Set collision threshold
  setCollisionThreshold(value) {
    this.collisionThreshold = value;
  }
}

// Initialize the visualization once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);