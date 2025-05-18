// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let terrainMesh, terrainGeometry;
let waterParticles = [];
let waterDropletsMesh;
let gridHelper, boundaryMesh;
let clock = new THREE.Clock();

// Configuration parameters
let config = {
    paused: false,
    showWireframe: true,
    rainIntensity: 5,
    erosionRate: 0.3,
    depositionRate: 0.1,
    terrainHeight: 10,
    boundaryRadius: 15,
    showFlowVectors: false,
    colorScheme: 'gradient',
    iterations: 0
};

// Constants for simulation
const TERRAIN_SIZE = 50;
const TERRAIN_RESOLUTION = 64;
const MAX_PARTICLES = 500;

// Initialize terrain heightmap
function initializeTerrain() {
    const terrainData = new Float32Array(TERRAIN_RESOLUTION * TERRAIN_RESOLUTION);
    
    // Create a heightmap with some mountains and valleys
    for (let z = 0; z < TERRAIN_RESOLUTION; z++) {
        for (let x = 0; x < TERRAIN_RESOLUTION; x++) {
            // Normalize coordinates to [-1, 1]
            const nx = (x / TERRAIN_RESOLUTION) * 2 - 1;
            const nz = (z / TERRAIN_RESOLUTION) * 2 - 1;
            
            // Create mountain ranges with Perlin-like noise
            let height = 0;
            
            // Large features (mountains)
            height += Math.sin(nx * 3) * Math.cos(nz * 3) * 0.5;
            
            // Medium features (hills)
            height += Math.sin(nx * 7 + 0.5) * Math.sin(nz * 6 + 0.5) * 0.25;
            
            // Small features (bumps)
            height += Math.sin(nx * 15) * Math.sin(nz * 15) * 0.125;
            
            // Add a central mountain
            const distFromCenter = Math.sqrt(nx*nx + nz*nz);
            height += Math.max(0, (1 - distFromCenter) * 1.5);
            
            // Normalize height to range [0, 1]
            height = (height + 1.5) / 3;
            
            // Store height in heightmap
            terrainData[z * TERRAIN_RESOLUTION + x] = height * config.terrainHeight;
        }
    }
    
    return terrainData;
}

// Create visual terrain mesh from heightmap
function createTerrainMesh(terrainData) {
    const geometry = new THREE.PlaneGeometry(
        TERRAIN_SIZE, 
        TERRAIN_SIZE, 
        TERRAIN_RESOLUTION - 1, 
        TERRAIN_RESOLUTION - 1
    );
    geometry.rotateX(-Math.PI / 2);
    
    // Apply heightmap to geometry
    const vertices = geometry.attributes.position.array;
    for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
        vertices[i + 1] = terrainData[j];
    }
    
    // Update normals for lighting
    geometry.computeVertexNormals();
    
    // Create material with phong shading
    const material = new THREE.MeshPhongMaterial({
        color: 0x708090,
        flatShading: false,
        wireframe: false,
        vertexColors: false
    });
    
    // Create wireframe material
    const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        wireframe: true,
        transparent: true,
        opacity: 0.15
    });
    
    // Create mesh with materials
    const terrain = new THREE.Mesh(geometry, material);
    const wireframe = new THREE.Mesh(geometry, wireframeMaterial);
    
    terrain.add(wireframe);
    wireframe.visible = config.showWireframe;
    
    // Add some coloring based on height
    updateTerrainColors(terrain, terrainData);
    
    return { terrain, geometry };
}

// Color the terrain based on height
function updateTerrainColors(terrain, terrainData) {
    const colors = [];
    const geometry = terrain.geometry;
    
    for (let i = 0; i < terrainData.length; i++) {
        const height = terrainData[i] / config.terrainHeight;
        
        let color = new THREE.Color();
        
        if (height < 0.1) {
            // Deep water / river beds
            color.setRGB(0.1, 0.2, 0.5);
        } else if (height < 0.2) {
            // Shallow water / sand
            color.setRGB(0.7, 0.7, 0.5);
        } else if (height < 0.4) {
            // Low ground / grass
            color.setRGB(0.3, 0.5, 0.2);
        } else if (height < 0.7) {
            // Hills / forests
            color.setRGB(0.2, 0.4, 0.1);
        } else if (height < 0.9) {
            // Mountains / rock
            color.setRGB(0.5, 0.5, 0.5);
        } else {
            // Mountain peaks / snow
            color.setRGB(1, 1, 1);
        }
        
        colors.push(color.r, color.g, color.b);
    }
    
    // Apply colors to geometry
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // Update material to use vertex colors
    terrain.material.vertexColors = true;
    terrain.material.needsUpdate = true;
}

// Create water droplets for simulation
function createWaterParticles() {
    const waterParticles = [];
    
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0x00aaff,
        size: 0.5,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
    });
    
    const dropletsMesh = new THREE.Points(geometry, material);
    
    // Initialize particles with data
    for (let i = 0; i < MAX_PARTICLES; i++) {
        waterParticles.push({
            active: false,
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            sediment: 0,
            lifetime: 0
        });
    }
    
    return { waterParticles, dropletsMesh };
}

// Create a new water droplet at a random position
function createDroplet(waterParticles) {
    for (let i = 0; i < waterParticles.length; i++) {
        if (!waterParticles[i].active) {
            const x = (Math.random() * 0.8 + 0.1) * TERRAIN_SIZE - TERRAIN_SIZE / 2;
            const z = (Math.random() * 0.8 + 0.1) * TERRAIN_SIZE - TERRAIN_SIZE / 2;
            
            // Find height at this position
            const terrainX = Math.floor((x + TERRAIN_SIZE / 2) / TERRAIN_SIZE * (TERRAIN_RESOLUTION - 1));
            const terrainZ = Math.floor((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE * (TERRAIN_RESOLUTION - 1));
            const index = terrainZ * TERRAIN_RESOLUTION + terrainX;
            
            const terrainData = getCurrentTerrainData();
            const height = terrainData[index] + 0.5; // Start slightly above terrain
            
            waterParticles[i].active = true;
            waterParticles[i].position.set(x, height, z);
            waterParticles[i].velocity.set(0, 0, 0);
            waterParticles[i].sediment = 0;
            waterParticles[i].lifetime = 200 + Math.random() * 100;
            
            return;
        }
    }
}

// Get current terrain data from geometry
function getCurrentTerrainData() {
    if (!terrainGeometry) return new Float32Array(TERRAIN_RESOLUTION * TERRAIN_RESOLUTION);
    
    const positions = terrainGeometry.attributes.position.array;
    const terrainData = new Float32Array(TERRAIN_RESOLUTION * TERRAIN_RESOLUTION);
    
    for (let i = 0, j = 0; i < positions.length; i += 3, j++) {
        terrainData[j] = positions[i + 1]; // Y coordinate is height
    }
    
    return terrainData;
}

// Get interpolated terrain height at given world position
function getTerrainHeightAt(x, z, terrainData) {
    // Convert world position to terrain grid coordinates
    const gridX = ((x + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * (TERRAIN_RESOLUTION - 1);
    const gridZ = ((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * (TERRAIN_RESOLUTION - 1);
    
    // Get grid cell indices
    const x0 = Math.floor(gridX);
    const x1 = Math.min(x0 + 1, TERRAIN_RESOLUTION - 1);
    const z0 = Math.floor(gridZ);
    const z1 = Math.min(z0 + 1, TERRAIN_RESOLUTION - 1);
    
    // Get fractional part for interpolation
    const fx = gridX - x0;
    const fz = gridZ - z0;
    
    // Get heights at four corners
    const h00 = terrainData[z0 * TERRAIN_RESOLUTION + x0];
    const h10 = terrainData[z0 * TERRAIN_RESOLUTION + x1];
    const h01 = terrainData[z1 * TERRAIN_RESOLUTION + x0];
    const h11 = terrainData[z1 * TERRAIN_RESOLUTION + x1];
    
    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    
    return h0 * (1 - fz) + h1 * fz;
}

// Get terrain gradient (slope) at given position
function getTerrainGradient(x, z, terrainData) {
    const eps = 0.1;
    
    const h = getTerrainHeightAt(x, z, terrainData);
    const hx = getTerrainHeightAt(x + eps, z, terrainData);
    const hz = getTerrainHeightAt(x, z + eps, terrainData);
    
    return new THREE.Vector3(
        (hx - h) / eps,
        0,
        (hz - h) / eps
    );
}

// Modify terrain at position
function modifyTerrain(x, z, amount, terrainData) {
    // Convert world position to terrain grid coordinates
    const gridX = Math.floor(((x + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * (TERRAIN_RESOLUTION - 1));
    const gridZ = Math.floor(((z + TERRAIN_SIZE / 2) / TERRAIN_SIZE) * (TERRAIN_RESOLUTION - 1));
    
    // Check bounds
    if (gridX < 0 || gridX >= TERRAIN_RESOLUTION || gridZ < 0 || gridZ >= TERRAIN_RESOLUTION) {
        return;
    }
    
    // Get index in terrain data
    const index = gridZ * TERRAIN_RESOLUTION + gridX;
    
    // Add amount to terrain height
    terrainData[index] += amount;
    
    // Update vertex position in geometry
    const positions = terrainGeometry.attributes.position.array;
    const vertexIndex = index * 3 + 1; // Y coordinate is at index + 1
    positions[vertexIndex] = terrainData[index];
    
    // Mark attributes for update
    terrainGeometry.attributes.position.needsUpdate = true;
    
    // We need to recompute normals for proper lighting
    terrainGeometry.computeVertexNormals();
}

// Update water droplet simulation
function updateWaterParticles(delta) {
    const terrainData = getCurrentTerrainData();
    let activeCount = 0;
    
    // Process each water particle
    for (let i = 0; i < waterParticles.length; i++) {
        const droplet = waterParticles[i];
        
        if (!droplet.active) continue;
        
        activeCount++;
        
        // Decrease lifetime
        droplet.lifetime -= delta * 60;
        
        if (droplet.lifetime <= 0) {
            // Deposit any remaining sediment when particle dies
            modifyTerrain(
                droplet.position.x,
                droplet.position.z,
                droplet.sediment,
                terrainData
            );
            
            droplet.active = false;
            continue;
        }
        
        // Get current terrain height at droplet position
        const terrainHeight = getTerrainHeightAt(
            droplet.position.x,
            droplet.position.z,
            terrainData
        );
        
        // If water is underground, bring it to surface
        if (droplet.position.y < terrainHeight) {
            droplet.position.y = terrainHeight;
        }
        
        // Calculate how far above terrain the droplet is
        const heightAboveTerrain = droplet.position.y - terrainHeight;
        
        // Get terrain gradient (slope direction)
        const gradient = getTerrainGradient(
            droplet.position.x,
            droplet.position.z,
            terrainData
        );
        
        // Apply gravity and terrain influence to velocity
        droplet.velocity.x += gradient.x * 0.05;
        droplet.velocity.z += gradient.z * 0.05;
        droplet.velocity.y -= 0.05; // Gravity
        
        // Apply erosion based on speed and slope
        const speed = droplet.velocity.length();
        const slope = gradient.length();
        
        // Faster water and steeper slopes cause more erosion
        let erosionAmount = speed * slope * config.erosionRate * 0.01;
        
        // Limit erosion
        erosionAmount = Math.min(erosionAmount, 0.1);
        
        // Erode terrain and pick up sediment
        if (heightAboveTerrain < 0.5) {
            modifyTerrain(
                droplet.position.x,
                droplet.position.z,
                -erosionAmount,
                terrainData
            );
            
            droplet.sediment += erosionAmount;
        }
        
        // Deposit sediment in flat areas or when carrying too much
        if (slope < 0.1 || droplet.sediment > 1.0) {
            const depositionAmount = droplet.sediment * config.depositionRate;
            
            modifyTerrain(
                droplet.position.x,
                droplet.position.z,
                depositionAmount,
                terrainData
            );
            
            droplet.sediment -= depositionAmount;
        }
        
        // Apply velocity to position
        droplet.position.add(droplet.velocity);
        
        // Apply some drag/friction
        droplet.velocity.multiplyScalar(0.98);
        
        // Check if out of bounds
        if (
            Math.abs(droplet.position.x) > TERRAIN_SIZE / 2 ||
            Math.abs(droplet.position.z) > TERRAIN_SIZE / 2 ||
            droplet.position.y < 0
        ) {
            droplet.active = false;
        }
    }
    
    // Update droplets mesh with new positions
    updateDropletsMesh();
    
    // Update stats
    updateStats(waterParticles.length, activeCount);
}

// Update the visual mesh for water droplets
function updateDropletsMesh() {
    const positions = waterDropletsMesh.geometry.attributes.position.array;
    
    let count = 0;
    for (let i = 0; i < waterParticles.length; i++) {
        if (waterParticles[i].active) {
            const pos = waterParticles[i].position;
            positions[count++] = pos.x;
            positions[count++] = pos.y;
            positions[count++] = pos.z;
        }
    }
    
    // Fill remaining positions with out-of-bounds values
    for (let i = count; i < positions.length; i++) {
        positions[i] = 0;
    }
    
    waterDropletsMesh.geometry.attributes.position.needsUpdate = true;
}

// Add new water droplets based on rain intensity
function processRain() {
    if (config.paused) return;
    
    // Add new droplets based on rain intensity
    for (let i = 0; i < config.rainIntensity; i++) {
        createDroplet(waterParticles);
    }
}

// Initialize the visualization
function init() {
    // Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    
    const container = document.getElementById('canvas-container');
    if (container) {
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);
    } else {
        renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(renderer.domElement);
    }
    
    // Check if dark mode is active
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    // Setup scene with appropriate background color
    scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x121212 : 0x87ceeb); // Sky blue or dark
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(
        60,
        (container ? container.clientWidth : window.innerWidth) / 
        (container ? container.clientHeight : window.innerHeight),
        0.1,
        1000
    );
    camera.position.set(TERRAIN_SIZE * 0.8, TERRAIN_SIZE * 0.7, TERRAIN_SIZE * 0.8);
    camera.lookAt(0, 0, 0);
    
    // Setup orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 10;
    controls.maxDistance = TERRAIN_SIZE * 2;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground
    controls.update();
    
    // Add grid helper
    gridHelper = new THREE.GridHelper(TERRAIN_SIZE, 20, 0x000000, 0x000000);
    gridHelper.position.y = 0;
    scene.add(gridHelper);
    
    // Create lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Create terrain
    const terrainData = initializeTerrain();
    const { terrain, geometry } = createTerrainMesh(terrainData);
    scene.add(terrain);
    terrainMesh = terrain;
    terrainGeometry = geometry;
    
    // Create water particles
    const { waterParticles: particles, dropletsMesh } = createWaterParticles();
    scene.add(dropletsMesh);
    waterParticles = particles;
    waterDropletsMesh = dropletsMesh;
    
    // Add boundary sphere (transparent)
    const boundaryGeometry = new THREE.SphereGeometry(config.boundaryRadius, 32, 32);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    scene.add(boundaryMesh);
    
    // Add fog for atmospheric effect
    scene.fog = new THREE.Fog(0x87ceeb, TERRAIN_SIZE * 0.8, TERRAIN_SIZE * 2);
    
    // Setup UI listeners
    setupEventListeners();
    
    // Start animation loop
    animate();
    
    // Update statistics
    updateStats(0, 0);
    
    console.log("Erosion simulation initialized");
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Calculate delta time
    const delta = clock.getDelta();
    
    // Update controls
    controls.update();
    
    // Process rain (add new droplets)
    processRain();
    
    // Update water particles
    if (!config.paused) {
        updateWaterParticles(delta);
        
        // Update iterations counter for stats
        config.iterations = (config.iterations || 0) + 1;
    }
    
    // Render scene
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    const container = document.getElementById('canvas-container');
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    
    renderer.setSize(width, height);
}

// Toggle wireframe visibility
function toggleWireframe() {
    config.showWireframe = !config.showWireframe;
    
    if (terrainMesh && terrainMesh.children.length > 0) {
        terrainMesh.children[0].visible = config.showWireframe;
    }
}

// Reset terrain to initial state
function resetTerrain() {
    // Create new terrain
    scene.remove(terrainMesh);
    terrainGeometry.dispose();
    terrainMesh.material.dispose();
    
    const terrainData = initializeTerrain();
    const { terrain, geometry } = createTerrainMesh(terrainData);
    scene.add(terrain);
    terrainMesh = terrain;
    terrainGeometry = geometry;
    
    // Reset statistics
    config.iterations = 0;
    updateStats(waterParticles.length, 0);
}

// Clear all water droplets
function clearWater() {
    for (let i = 0; i < waterParticles.length; i++) {
        waterParticles[i].active = false;
    }
    
    updateDropletsMesh();
    updateStats(waterParticles.length, 0);
}

// Toggle simulation pause state
function togglePause() {
    config.paused = !config.paused;
    
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.textContent = config.paused ? 'Resume' : 'Pause';
    }
}

// Toggle flow vectors visibility
function toggleFlowVectors() {
    config.showFlowVectors = !config.showFlowVectors;
    
    // Flow vectors implementation would go here
    // This is a placeholder for now
    console.log("Flow vectors toggled:", config.showFlowVectors);
}

// Update statistics display
function updateStats(total, active) {
    const statsElement = document.getElementById('stats');
    if (statsElement) {
        statsElement.textContent = `Particles: ${total} | Active: ${active}`;
    }
    
    const debugElement = document.getElementById('debug');
    if (debugElement) {
        debugElement.textContent = `Iterations: ${config.iterations}`;
    }
}

// Setup event listeners for UI controls
function setupEventListeners() {
    // Rain intensity slider
    const rainIntensitySlider = document.getElementById('rainIntensity');
    const rainIntensityValue = document.getElementById('rainIntensityValue');
    
    if (rainIntensitySlider && rainIntensityValue) {
        rainIntensitySlider.value = config.rainIntensity;
        rainIntensityValue.textContent = config.rainIntensity;
        
        rainIntensitySlider.addEventListener('input', function() {
            config.rainIntensity = parseInt(this.value);
            rainIntensityValue.textContent = config.rainIntensity;
        });
    }
    
    // Erosion rate slider
    const erosionRateSlider = document.getElementById('erosionRate');
    const erosionRateValue = document.getElementById('erosionRateValue');
    
    if (erosionRateSlider && erosionRateValue) {
        erosionRateSlider.value = config.erosionRate;
        erosionRateValue.textContent = config.erosionRate;
        
        erosionRateSlider.addEventListener('input', function() {
            config.erosionRate = parseFloat(this.value);
            erosionRateValue.textContent = config.erosionRate;
        });
    }
    
    // Deposition rate slider
    const depositionRateSlider = document.getElementById('depositionRate');
    const depositionRateValue = document.getElementById('depositionRateValue');
    
    if (depositionRateSlider && depositionRateValue) {
        depositionRateSlider.value = config.depositionRate;
        depositionRateValue.textContent = config.depositionRate;
        
        depositionRateSlider.addEventListener('input', function() {
            config.depositionRate = parseFloat(this.value);
            depositionRateValue.textContent = config.depositionRate;
        });
    }
    
    // Terrain height slider
    const terrainHeightSlider = document.getElementById('terrainHeightSlider');
    const terrainHeightValue = document.getElementById('terrainHeightValue');
    
    if (terrainHeightSlider && terrainHeightValue) {
        terrainHeightSlider.value = config.terrainHeight;
        terrainHeightValue.textContent = config.terrainHeight;
        
        terrainHeightSlider.addEventListener('input', function() {
            config.terrainHeight = parseInt(this.value);
            terrainHeightValue.textContent = config.terrainHeight;
            // Note: This doesn't automatically update the terrain
            // You may want to call resetTerrain() when the slider is released
        });
        
        terrainHeightSlider.addEventListener('change', resetTerrain);
    }
    
    // Boundary radius slider
    const boundaryRadiusSlider = document.getElementById('boundaryRadiusSlider');
    const boundaryRadiusValue = document.getElementById('boundaryRadiusValue');
    
    if (boundaryRadiusSlider && boundaryRadiusValue) {
        boundaryRadiusSlider.value = config.boundaryRadius;
        boundaryRadiusValue.textContent = config.boundaryRadius;
        
        boundaryRadiusSlider.addEventListener('input', function() {
            config.boundaryRadius = parseInt(this.value);
            boundaryRadiusValue.textContent = config.boundaryRadius;
            
            // Update boundary sphere size
            if (boundaryMesh) {
                scene.remove(boundaryMesh);
                const boundaryGeometry = new THREE.SphereGeometry(config.boundaryRadius, 32, 32);
                const boundaryMaterial = new THREE.MeshBasicMaterial({
                    color: 0x888888,
                    transparent: true,
                    opacity: 0.1,
                    wireframe: true
                });
                boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
                scene.add(boundaryMesh);
            }
        });
    }
    
    // Grid toggle button
    const gridToggle = document.getElementById('gridToggle');
    if (gridToggle) {
        gridToggle.addEventListener('click', function() {
            if (gridHelper) {
                gridHelper.visible = !gridHelper.visible;
            }
        });
    }
    
    // Reset terrain button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetTerrain);
    }
    
    // Pause button
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.textContent = config.paused ? 'Resume' : 'Pause';
        pauseBtn.addEventListener('click', togglePause);
    }
    
    // Toggle flow vectors button
    const toggleFlowBtn = document.getElementById('toggleFlowBtn');
    if (toggleFlowBtn) {
        toggleFlowBtn.addEventListener('click', toggleFlowVectors);
    }
    
    // Reset water button
    const resetWaterBtn = document.getElementById('resetWaterBtn');
    if (resetWaterBtn) {
        resetWaterBtn.addEventListener('click', clearWater);
    }
    
    // Color scheme selector
    const colorSchemeSelect = document.getElementById('colorScheme');
    if (colorSchemeSelect) {
        colorSchemeSelect.value = config.colorScheme;
        colorSchemeSelect.addEventListener('change', function() {
            config.colorScheme = this.value;
            // You would need to implement color scheme changes here
        });
    }
    
    // Window resize event
    window.addEventListener('resize', onWindowResize);
}

// Initialize the visualization once the DOM is loaded
// document.addEventListener('DOMContentLoaded', init);

// Export functions for external use
export {
    init,
    resetTerrain,
    togglePause,
    clearWater,
    toggleFlowVectors,
    toggleWireframe
};
