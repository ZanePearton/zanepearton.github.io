// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let pointCloudMesh, pointPositions, pointColors;
let waterParticles = [];
let waterDropletsMesh;
let gridHelper, boundaryMesh;
let clock = new THREE.Clock();

// Configuration parameters
let config = {
    paused: false,
    showGrid: true,
    rainIntensity: 5,
    erosionRate: 0.3,
    depositionRate: 0.1,
    pointHeight: 10,
    boundaryRadius: 15,
    showFlowVectors: false,
    pointSize: 0.2,
    iterations: 0
};

// Constants for simulation
const GRID_SIZE = 50;
const GRID_RESOLUTION = 64;
const MAX_PARTICLES = 500;

// Initialize point grid
function initializePointGrid() {
    // Create arrays for positions and colors
    const totalPoints = GRID_RESOLUTION * GRID_RESOLUTION;
    const positions = new Float32Array(totalPoints * 3);
    const colors = new Float32Array(totalPoints * 3);
    const heightData = new Float32Array(totalPoints);
    
    // Create a grid of points with heights
    let index = 0;
    for (let z = 0; z < GRID_RESOLUTION; z++) {
        for (let x = 0; x < GRID_RESOLUTION; x++) {
            // Calculate grid positions
            const xPos = (x / (GRID_RESOLUTION - 1) - 0.5) * GRID_SIZE;
            const zPos = (z / (GRID_RESOLUTION - 1) - 0.5) * GRID_SIZE;
            
            // Normalize coordinates to [-1, 1]
            const nx = (x / GRID_RESOLUTION) * 2 - 1;
            const nz = (z / GRID_RESOLUTION) * 2 - 1;
            
            // Create height with Perlin-like noise
            let height = 0;
            
            // Large features
            height += Math.sin(nx * 3) * Math.cos(nz * 3) * 0.5;
            
            // Medium features
            height += Math.sin(nx * 7 + 0.5) * Math.sin(nz * 6 + 0.5) * 0.25;
            
            // Small features
            height += Math.sin(nx * 15) * Math.sin(nz * 15) * 0.125;
            
            // Add a central peak
            const distFromCenter = Math.sqrt(nx*nx + nz*nz);
            height += Math.max(0, (1 - distFromCenter) * 1.5);
            
            // Normalize height to range [0, 1]
            height = (height + 1.5) / 3;
            
            // Store positions
            positions[index * 3] = xPos;
            positions[index * 3 + 1] = height * config.pointHeight;
            positions[index * 3 + 2] = zPos;
            
            // Store height data for erosion calculations
            heightData[index] = height * config.pointHeight;
            
            // Color based on height (we'll update this later)
            const color = new THREE.Color();
            if (height < 0.1) {
                color.setRGB(0.1, 0.2, 0.5); // Deep water
            } else if (height < 0.2) {
                color.setRGB(0.7, 0.7, 0.5); // Sand
            } else if (height < 0.4) {
                color.setRGB(0.3, 0.5, 0.2); // Low ground
            } else if (height < 0.7) {
                color.setRGB(0.2, 0.4, 0.1); // Hills
            } else if (height < 0.9) {
                color.setRGB(0.5, 0.5, 0.5); // Mountains
            } else {
                color.setRGB(1, 1, 1); // Peaks
            }
            
            colors[index * 3] = color.r;
            colors[index * 3 + 1] = color.g;
            colors[index * 3 + 2] = color.b;
            
            index++;
        }
    }
    
    return { positions, colors, heightData };
}

// Create visual point cloud from position data
function createPointCloudMesh(positions, colors) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
        size: config.pointSize,
        vertexColors: true,
        sizeAttenuation: true
    });
    
    const pointCloud = new THREE.Points(geometry, material);
    
    return { pointCloud, geometry };
}

// Update point cloud colors based on height
function updatePointColors(positions, colors) {
    for (let i = 0; i < positions.length / 3; i++) {
        const height = positions[i * 3 + 1] / config.pointHeight;
        
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
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
}

// Create water droplets for simulation
function createWaterParticles() {
    const waterParticles = [];
    
    const positions = new Float32Array(MAX_PARTICLES * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0x00aaff,
        size: 0.3,
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
            const x = (Math.random() * 0.8 + 0.1) * GRID_SIZE - GRID_SIZE / 2;
            const z = (Math.random() * 0.8 + 0.1) * GRID_SIZE - GRID_SIZE / 2;
            
            // Find height at this position
            const height = getHeightAt(x, z) + 0.5; // Start slightly above
            
            waterParticles[i].active = true;
            waterParticles[i].position.set(x, height, z);
            waterParticles[i].velocity.set(0, 0, 0);
            waterParticles[i].sediment = 0;
            waterParticles[i].lifetime = 200 + Math.random() * 100;
            
            return;
        }
    }
}

// Get current grid point data
function getCurrentPointData() {
    if (!pointCloudMesh) return { positions: new Float32Array(0), colors: new Float32Array(0) };
    
    return {
        positions: pointCloudMesh.geometry.attributes.position.array,
        colors: pointCloudMesh.geometry.attributes.color.array
    };
}

// Get interpolated height at given world position
function getHeightAt(x, z) {
    const { positions } = getCurrentPointData();
    
    // Convert world position to grid coordinates
    const gridX = ((x + GRID_SIZE / 2) / GRID_SIZE) * (GRID_RESOLUTION - 1);
    const gridZ = ((z + GRID_SIZE / 2) / GRID_SIZE) * (GRID_RESOLUTION - 1);
    
    // Get grid cell indices
    const x0 = Math.floor(gridX);
    const x1 = Math.min(x0 + 1, GRID_RESOLUTION - 1);
    const z0 = Math.floor(gridZ);
    const z1 = Math.min(z0 + 1, GRID_RESOLUTION - 1);
    
    // Get fractional part for interpolation
    const fx = gridX - x0;
    const fz = gridZ - z0;
    
    // Get heights at four corners
    const h00 = positions[(z0 * GRID_RESOLUTION + x0) * 3 + 1];
    const h10 = positions[(z0 * GRID_RESOLUTION + x1) * 3 + 1];
    const h01 = positions[(z1 * GRID_RESOLUTION + x0) * 3 + 1];
    const h11 = positions[(z1 * GRID_RESOLUTION + x1) * 3 + 1];
    
    // Bilinear interpolation
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    
    return h0 * (1 - fz) + h1 * fz;
}

// Get terrain gradient (slope) at given position
function getHeightGradient(x, z) {
    const eps = 0.1;
    
    const h = getHeightAt(x, z);
    const hx = getHeightAt(x + eps, z);
    const hz = getHeightAt(x, z + eps);
    
    return new THREE.Vector3(
        (hx - h) / eps,
        0,
        (hz - h) / eps
    );
}

// Modify point height at position
function modifyPointHeight(x, z, amount) {
    // Convert world position to grid coordinates
    const gridX = Math.floor(((x + GRID_SIZE / 2) / GRID_SIZE) * (GRID_RESOLUTION - 1));
    const gridZ = Math.floor(((z + GRID_SIZE / 2) / GRID_SIZE) * (GRID_RESOLUTION - 1));
    
    // Check bounds
    if (gridX < 0 || gridX >= GRID_RESOLUTION || gridZ < 0 || gridZ >= GRID_RESOLUTION) {
        return;
    }
    
    // Get index in point data
    const index = gridZ * GRID_RESOLUTION + gridX;
    
    // Get current position data
    const { positions, colors } = getCurrentPointData();
    
    // Add amount to point height
    positions[index * 3 + 1] += amount;
    
    // Update color based on new height
    const height = positions[index * 3 + 1] / config.pointHeight;
    
    let color = new THREE.Color();
    
    if (height < 0.1) {
        color.setRGB(0.1, 0.2, 0.5); // Deep water
    } else if (height < 0.2) {
        color.setRGB(0.7, 0.7, 0.5); // Sand
    } else if (height < 0.4) {
        color.setRGB(0.3, 0.5, 0.2); // Low ground
    } else if (height < 0.7) {
        color.setRGB(0.2, 0.4, 0.1); // Hills
    } else if (height < 0.9) {
        color.setRGB(0.5, 0.5, 0.5); // Mountains
    } else {
        color.setRGB(1, 1, 1); // Peaks
    }
    
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    
    // Mark attributes for update
    pointCloudMesh.geometry.attributes.position.needsUpdate = true;
    pointCloudMesh.geometry.attributes.color.needsUpdate = true;
}

// Update water droplet simulation
function updateWaterParticles(delta) {
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
            modifyPointHeight(
                droplet.position.x,
                droplet.position.z,
                droplet.sediment
            );
            
            droplet.active = false;
            continue;
        }
        
        // Get current point height at droplet position
        const pointHeight = getHeightAt(
            droplet.position.x,
            droplet.position.z
        );
        
        // If water is underground, bring it to surface
        if (droplet.position.y < pointHeight) {
            droplet.position.y = pointHeight;
        }
        
        // Calculate how far above terrain the droplet is
        const heightAbovePoint = droplet.position.y - pointHeight;
        
        // Get gradient (slope direction)
        const gradient = getHeightGradient(
            droplet.position.x,
            droplet.position.z
        );
        
        // Apply gravity and slope influence to velocity
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
        
        // Erode points and pick up sediment
        if (heightAbovePoint < 0.5) {
            modifyPointHeight(
                droplet.position.x,
                droplet.position.z,
                -erosionAmount
            );
            
            droplet.sediment += erosionAmount;
        }
        
        // Deposit sediment in flat areas or when carrying too much
        if (slope < 0.1 || droplet.sediment > 1.0) {
            const depositionAmount = droplet.sediment * config.depositionRate;
            
            modifyPointHeight(
                droplet.position.x,
                droplet.position.z,
                depositionAmount
            );
            
            droplet.sediment -= depositionAmount;
        }
        
        // Apply velocity to position
        droplet.position.add(droplet.velocity);
        
        // Apply some drag/friction
        droplet.velocity.multiplyScalar(0.98);
        
        // Check if out of bounds
        if (
            Math.abs(droplet.position.x) > GRID_SIZE / 2 ||
            Math.abs(droplet.position.z) > GRID_SIZE / 2 ||
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
    scene.background = new THREE.Color(isDarkMode ? 0x121212 : 0x111111); // Dark background for better visibility
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(
        60,
        (container ? container.clientWidth : window.innerWidth) / 
        (container ? container.clientHeight : window.innerHeight),
        0.1,
        1000
    );
    camera.position.set(GRID_SIZE * 0.8, GRID_SIZE * 0.7, GRID_SIZE * 0.8);
    camera.lookAt(0, 0, 0);
    
    // Setup orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 10;
    controls.maxDistance = GRID_SIZE * 2;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent going below ground
    controls.update();
    
    // Add grid helper
    gridHelper = new THREE.GridHelper(GRID_SIZE, 20, 0x444444, 0x444444);
    gridHelper.position.y = 0;
    scene.add(gridHelper);
    
    // Create lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    scene.add(directionalLight);
    
    // Create point cloud
    const { positions, colors } = initializePointGrid();
    const { pointCloud, geometry } = createPointCloudMesh(positions, colors);
    scene.add(pointCloud);
    pointCloudMesh = pointCloud;
    pointPositions = positions;
    pointColors = colors;
    
    // Create water particles
    const { waterParticles: particles, dropletsMesh } = createWaterParticles();
    scene.add(dropletsMesh);
    waterParticles = particles;
    waterDropletsMesh = dropletsMesh;
    
    // Add boundary sphere (transparent)
    const boundaryGeometry = new THREE.SphereGeometry(config.boundaryRadius, 32, 32);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    boundaryMesh = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    scene.add(boundaryMesh);
    
    // Add fog for atmospheric effect
    scene.fog = new THREE.Fog(0x000000, GRID_SIZE * 1.2, GRID_SIZE * 2);
    
    // Setup UI listeners
    setupEventListeners();
    
    // Start animation loop
    animate();
    
    // Update statistics
    updateStats(0, 0);
    
    console.log("Point-based erosion simulation initialized");
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

// Toggle grid visibility
function toggleGrid() {
    config.showGrid = !config.showGrid;
    
    if (gridHelper) {
        gridHelper.visible = config.showGrid;
    }
}

// Reset point grid to initial state
function resetPointGrid() {
    // Create new point grid
    scene.remove(pointCloudMesh);
    
    const { positions, colors } = initializePointGrid();
    const { pointCloud, geometry } = createPointCloudMesh(positions, colors);
    scene.add(pointCloud);
    pointCloudMesh = pointCloud;
    pointPositions = positions;
    pointColors = colors;
    
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
    console.log("Flow vectors toggled:", config.showFlowVectors);
}

// Update point size
function updatePointSize(size) {
    config.pointSize = size;
    
    if (pointCloudMesh) {
        pointCloudMesh.material.size = size;
        pointCloudMesh.material.needsUpdate = true;
    }
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
    
    // Point height slider
    const pointHeightSlider = document.getElementById('pointHeightSlider');
    const pointHeightValue = document.getElementById('pointHeightValue');
    
    if (pointHeightSlider && pointHeightValue) {
        pointHeightSlider.value = config.pointHeight;
        pointHeightValue.textContent = config.pointHeight;
        
        pointHeightSlider.addEventListener('input', function() {
            config.pointHeight = parseInt(this.value);
            pointHeightValue.textContent = config.pointHeight;
        });
        
        pointHeightSlider.addEventListener('change', resetPointGrid);
    }
    
    // Point size slider
    const pointSizeSlider = document.getElementById('pointSizeSlider');
    const pointSizeValue = document.getElementById('pointSizeValue');
    
    if (pointSizeSlider && pointSizeValue) {
        pointSizeSlider.value = config.pointSize;
        pointSizeValue.textContent = config.pointSize;
        
        pointSizeSlider.addEventListener('input', function() {
            const size = parseFloat(this.value);
            updatePointSize(size);
            config.pointSize = size;
            pointSizeValue.textContent = size;
        });
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
                    color: 0x444444,
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
        gridToggle.addEventListener('click', toggleGrid);
    }
    
    // Reset point grid button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetPointGrid);
    }
    
    // Pause button
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.textContent = config.paused ? 'Resume' : 'Pause';
        pauseBtn.addEventListener('click', togglePause);
    }
    
    // Reset water button
    const resetWaterBtn = document.getElementById('resetWaterBtn');
    if (resetWaterBtn) {
        resetWaterBtn.addEventListener('click', clearWater);
    }
    
    // Window resize event
    window.addEventListener('resize', onWindowResize);
}

// Initialize the visualization once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for external use
export {
    init,
    resetPointGrid,
    togglePause,
    clearWater,
    toggleGrid,
    updatePointSize
};