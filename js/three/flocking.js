// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let boids = [];
let gridHelper, axisHelper;
let clock = new THREE.Clock();

// Configuration parameters
let config = {
    numBoids: 100,          // Number of boids in the simulation
    separationDistance: 2,  // Distance to maintain from neighbors
    alignmentFactor: 0.05,  // How much to align with neighbors' direction
    cohesionFactor: 0.005,  // How much to move toward center of neighbors
    separationFactor: 0.1,  // How much to avoid neighbors
    maxSpeed: 0.5,          // Maximum speed of boids
    perceptionRadius: 5,    // How far boids can see neighbors
    boundaryRadius: 15,     // Size of the boundary sphere
    colorScheme: 'rainbow',
    rotationSpeed: 1.0,
    showGrid: true,
    paused: false,          // Whether the simulation is paused
    debug: false,           // Show debug information
    adaptiveSmooth: false,  // Use adaptive smoothing
    speed: 100,             // Update speed in ms
    collisionChecks: 100    // Number of collision checks per frame
};

// Boid class
class Boid {
    constructor(position, velocity) {
        // Create geometry and material for the boid
        const geometry = new THREE.ConeGeometry(0.5, 1.5, 8);
        geometry.rotateX(Math.PI / 2); // Orient cone to point in direction of travel

        // Material will be set based on config
        this.mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0xffffff }));

        // Set initial position
        this.mesh.position.copy(position);

        // Set initial velocity
        this.velocity = velocity;

        // Add to scene
        scene.add(this.mesh);
    }

    // Update boid position and orientation
    update(delta, boids) {
        if (config.paused) return;

        // Calculate steering forces
        const { separation, alignment, cohesion } = this.calculateForces(boids);

        // Apply forces to velocity
        this.velocity.add(separation.multiplyScalar(config.separationFactor));
        this.velocity.add(alignment.multiplyScalar(config.alignmentFactor));
        this.velocity.add(cohesion.multiplyScalar(config.cohesionFactor));

        // Limit speed
        const speed = this.velocity.length();
        if (speed > config.maxSpeed) {
            this.velocity.multiplyScalar(config.maxSpeed / speed);
        }

        // Apply adaptive smoothing
        if (config.adaptiveSmooth) {
            const obstacles = boids.filter(b => b !== this &&
                b.mesh.position.distanceTo(this.mesh.position) < config.separationDistance * 1.5);

            if (obstacles.length > 5) { // Crowded environment
                this.velocity.multiplyScalar(0.9); // Slow down in crowded areas
            }
        }

        // Apply boundary avoidance
        this.enforceBoundary();

        // Update position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta * 60));

        // Set orientation to match velocity
        if (this.velocity.lengthSq() > 0.001) {
            this.mesh.lookAt(this.mesh.position.clone().add(this.velocity));
        }
    }

    // Calculate steering forces based on neighboring boids
    calculateForces(boids) {
        const separation = new THREE.Vector3();
        const alignment = new THREE.Vector3();
        const cohesion = new THREE.Vector3();

        let separationCount = 0;
        let alignmentCount = 0;
        let cohesionCount = 0;

        const perceptionRadiusSq = config.perceptionRadius * config.perceptionRadius;
        const separationDistanceSq = config.separationDistance * config.separationDistance;

        // Limit collision checks for performance
        const checkBoids = boids.slice(0, config.collisionChecks);

        checkBoids.forEach(boid => {
            if (boid === this) return;

            const distance = this.mesh.position.distanceToSquared(boid.mesh.position);

            // Separation: avoid crowding neighbors
            if (distance < separationDistanceSq) {
                const diff = new THREE.Vector3().subVectors(this.mesh.position, boid.mesh.position);
                diff.normalize().divideScalar(Math.sqrt(distance) || 1);
                separation.add(diff);
                separationCount++;
            }

            // Only consider boids within perception radius for alignment and cohesion
            if (distance < perceptionRadiusSq) {
                // Alignment: steer towards average heading of neighbors
                alignment.add(boid.velocity);
                alignmentCount++;

                // Cohesion: steer towards center of mass of neighbors
                cohesion.add(boid.mesh.position);
                cohesionCount++;
            }
        });

        // Calculate average for each force
        if (separationCount > 0) {
            separation.divideScalar(separationCount);
            if (separation.lengthSq() > 0) {
                separation.normalize().multiplyScalar(config.maxSpeed);
                separation.sub(this.velocity);
            }
        }

        if (alignmentCount > 0) {
            alignment.divideScalar(alignmentCount);
            if (alignment.lengthSq() > 0) {
                alignment.normalize().multiplyScalar(config.maxSpeed);
                alignment.sub(this.velocity);
            }
        }

        if (cohesionCount > 0) {
            cohesion.divideScalar(cohesionCount);
            cohesion.sub(this.mesh.position);
            if (cohesion.lengthSq() > 0) {
                cohesion.normalize().multiplyScalar(config.maxSpeed);
                cohesion.sub(this.velocity);
            }
        }

        return { separation, alignment, cohesion };
    }

    // Keep boids within boundary sphere
    enforceBoundary() {
        const distanceFromCenter = this.mesh.position.length();
        if (distanceFromCenter > config.boundaryRadius) {
            // Add a force towards the center, stronger the further away
            const toCenter = new THREE.Vector3().subVectors(
                new THREE.Vector3(0, 0, 0),
                this.mesh.position
            );

            const boundaryFactor = (distanceFromCenter - config.boundaryRadius) / config.boundaryRadius;
            toCenter.normalize().multiplyScalar(boundaryFactor * 0.5);
            this.velocity.add(toCenter);
        }
    }

    // Update the boid's material based on color scheme
    updateMaterial(colorscheme, index, totalBoids) {
        let color;

        switch (colorscheme) {
            case 'rainbow':
                // Distribute colors evenly across the rainbow
                color = new THREE.Color().setHSL(index / totalBoids, 1, 0.5);
                this.mesh.material = new THREE.MeshPhongMaterial({ color, shininess: 70 });
                break;

            case 'gradient':
                // Gradient from orange to purple based on position
                const height = (this.mesh.position.y + config.boundaryRadius) / (config.boundaryRadius * 2);
                color = new THREE.Color(0xff9500).lerp(new THREE.Color(0xaf52de), height);
                this.mesh.material = new THREE.MeshPhongMaterial({ color, shininess: 70 });
                break;

            case 'wireframe':
                this.mesh.material = new THREE.MeshPhongMaterial({
                    color: 0xCCCCCC,
                    wireframe: true,
                    shininess: 70
                });
                break;

            case 'normals':
                this.mesh.material = new THREE.MeshNormalMaterial();
                break;

            default:
                this.mesh.material = new THREE.MeshPhongMaterial({
                    color: 0x0088ff,
                    shininess: 70
                });
        }
    }

    // Remove boid from scene
    dispose() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
}

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
    gridHelper = new THREE.GridHelper(30, 30);
    scene.add(gridHelper);

    // Add axis helper to show X, Y, Z directions
    axisHelper = new THREE.AxesHelper(10);
    scene.add(axisHelper);

    // Add boundary sphere (transparent)
    const boundaryGeometry = new THREE.SphereGeometry(config.boundaryRadius, 32, 32);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    const boundarySphere = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    scene.add(boundarySphere);

    // Setup camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(25, 25, 25);
    camera.lookAt(0, 0, 0);

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

    // Create boids
    createBoids();

    // Setup event listeners
    setupEventListeners();

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Listen for dark mode changes
    setupDarkModeListener();

    // Start animation loop
    animate();

    // Update statistics
    updateStats();

    console.log("Flocking visualization initialized");
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

// Create boids with random positions and velocities
function createBoids() {
    // Remove existing boids
    boids.forEach(boid => boid.dispose());
    boids = [];

    // Create new boids
    for (let i = 0; i < config.numBoids; i++) {
        // Random position within boundary sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = config.boundaryRadius * Math.cbrt(Math.random()); // Cube root for uniform distribution

        const position = new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );

        // Random velocity
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * config.maxSpeed,
            (Math.random() - 0.5) * config.maxSpeed,
            (Math.random() - 0.5) * config.maxSpeed
        );

        // Create boid
        const boid = new Boid(position, velocity);
        boid.updateMaterial(config.colorScheme, i, config.numBoids);
        boids.push(boid);
    }

    // Update statistics
    updateStats();
}

// Update boid materials based on color scheme
function updateBoidMaterials() {
    boids.forEach((boid, index) => {
        boid.updateMaterial(config.colorScheme, index, boids.length);
    });
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

    // Calculate delta time
    const delta = clock.getDelta();

    // Update controls
    controls.update();

    // Update boids
    if (!config.paused) {
        boids.forEach(boid => boid.update(delta, boids));

        // Update iterations counter for stats
        config.iterations = (config.iterations || 0) + 1;

        // Update stats periodically
        if (config.iterations % 30 === 0) {
            updateStats();
        }
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

// Update statistics display
function updateStats() {
    const statsElement = document.getElementById('stats');
    if (statsElement) {
        statsElement.textContent = `Boids: ${boids.length} | Iterations: ${config.iterations || 0}`;
    }
}

// Clear debug display
function clearDebug() {
    const debugElement = document.getElementById('debug');
    if (debugElement) {
        debugElement.textContent = '';
    }
}

// Toggle pause state
function togglePause() {
    config.paused = !config.paused;
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.textContent = config.paused ? 'Resume' : 'Pause';
    }
}

// Toggle adaptive smoothing
function toggleAdaptiveSmooth() {
    config.adaptiveSmooth = !config.adaptiveSmooth;
    const adaptiveSmoothBtn = document.getElementById('adaptiveSmoothBtn');
    if (adaptiveSmoothBtn) {
        adaptiveSmoothBtn.textContent = config.adaptiveSmooth ? 'Disable Smooth' : 'Adaptive Smooth';
    }
}

// Reset the simulation
function resetSimulation() {
    createBoids();
    config.iterations = 0;
    updateStats();
    clearDebug();
}

// Setup UI event listeners
function setupEventListeners() {
    // Resolution slider - repurpose for number of boids
    const resolutionSlider = document.getElementById('resolution');
    const resolutionValue = document.getElementById('resolutionValue');

    if (resolutionSlider && resolutionValue) {
        // Change label to "Boids" instead of "Resolution"
        const label = resolutionSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Boids <span class="value-display" id="resolutionValue">${config.numBoids}</span>`;
        }

        resolutionSlider.min = 10;
        resolutionSlider.max = 200;
        resolutionSlider.step = 10;
        resolutionSlider.value = config.numBoids;
        resolutionValue.textContent = config.numBoids;

        resolutionSlider.addEventListener('input', function () {
            config.numBoids = parseInt(this.value);
            resolutionValue.textContent = config.numBoids;
            createBoids();
        });
    }

    // Iso Level slider - repurpose for separation distance
    const isoLevelSlider = document.getElementById('isoLevel');
    const isoLevelValue = document.getElementById('isoLevelValue');

    if (isoLevelSlider && isoLevelValue) {
        // Change label to "Separation" instead of "Iso Level"
        const label = isoLevelSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Separation <span class="value-display" id="isoLevelValue">${config.separationDistance.toFixed(1)}</span>`;
        }

        isoLevelSlider.min = 0.5;
        isoLevelSlider.max = 5;
        isoLevelSlider.step = 0.1;
        isoLevelSlider.value = config.separationDistance;
        isoLevelValue.textContent = config.separationDistance.toFixed(1);

        isoLevelSlider.addEventListener('input', function () {
            config.separationDistance = parseFloat(this.value);
            isoLevelValue.textContent = config.separationDistance.toFixed(1);
        });
    }

    // Scale X slider - repurpose for alignment factor
    const scaleXSlider = document.getElementById('scaleX');
    const scaleXValue = document.getElementById('scaleXValue');

    if (scaleXSlider && scaleXValue) {
        // Change label to "Alignment" instead of "Scale X"
        const label = scaleXSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Alignment <span class="value-display" id="scaleXValue">${config.alignmentFactor.toFixed(2)}</span>`;
        }

        scaleXSlider.min = 0;
        scaleXSlider.max = 0.2;
        scaleXSlider.step = 0.01;
        scaleXSlider.value = config.alignmentFactor;
        scaleXValue.textContent = config.alignmentFactor.toFixed(2);

        scaleXSlider.addEventListener('input', function () {
            config.alignmentFactor = parseFloat(this.value);
            scaleXValue.textContent = config.alignmentFactor.toFixed(2);
        });
    }

    // Scale Y slider - repurpose for cohesion factor
    const scaleYSlider = document.getElementById('scaleY');
    const scaleYValue = document.getElementById('scaleYValue');

    if (scaleYSlider && scaleYValue) {
        // Change label to "Cohesion" instead of "Scale Y"
        const label = scaleYSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Cohesion <span class="value-display" id="scaleYValue">${config.cohesionFactor.toFixed(3)}</span>`;
        }

        scaleYSlider.min = 0;
        scaleYSlider.max = 0.02;
        scaleYSlider.step = 0.001;
        scaleYSlider.value = config.cohesionFactor;
        scaleYValue.textContent = config.cohesionFactor.toFixed(3);

        scaleYSlider.addEventListener('input', function () {
            config.cohesionFactor = parseFloat(this.value);
            scaleYValue.textContent = config.cohesionFactor.toFixed(3);
        });
    }

    // Scale Z slider - repurpose for separation factor
    const scaleZSlider = document.getElementById('scaleZ');
    const scaleZValue = document.getElementById('scaleZValue');

    if (scaleZSlider && scaleZValue) {
        // Change label to "Separation Factor" instead of "Scale Z"
        const label = scaleZSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Separation Factor <span class="value-display" id="scaleZValue">${config.separationFactor.toFixed(2)}</span>`;
        }

        scaleZSlider.min = 0;
        scaleZSlider.max = 0.5;
        scaleZSlider.step = 0.01;
        scaleZSlider.value = config.separationFactor;
        scaleZValue.textContent = config.separationFactor.toFixed(2);

        scaleZSlider.addEventListener('input', function () {
            config.separationFactor = parseFloat(this.value);
            scaleZValue.textContent = config.separationFactor.toFixed(2);
        });
    }

    // Color scheme selector
    const colorSchemeSelect = document.getElementById('colorScheme');

    if (colorSchemeSelect) {
        colorSchemeSelect.value = config.colorScheme;

        colorSchemeSelect.addEventListener('change', function () {
            config.colorScheme = this.value;
            updateBoidMaterials();
        });
    }

    // Rotation speed slider - repurpose for max speed
    const rotationSpeedSlider = document.getElementById('rotationSpeed');
    const rotationSpeedValue = document.getElementById('rotationSpeedValue');

    if (rotationSpeedSlider && rotationSpeedValue) {
        // Change label to "Max Speed" instead of "Rotation Speed"
        const label = rotationSpeedSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Max Speed <span class="value-display" id="rotationSpeedValue">${config.maxSpeed.toFixed(1)}</span>`;
        }

        rotationSpeedSlider.min = 0.1;
        rotationSpeedSlider.max = 1.0;
        rotationSpeedSlider.step = 0.1;
        rotationSpeedSlider.value = config.maxSpeed;
        rotationSpeedValue.textContent = config.maxSpeed.toFixed(1);

        rotationSpeedSlider.addEventListener('input', function () {
            config.maxSpeed = parseFloat(this.value);
            rotationSpeedValue.textContent = config.maxSpeed.toFixed(1);
        });
    }

    // Grid toggle button
    const gridToggleButton = document.getElementById('gridToggle');
    if (gridToggleButton) {
        gridToggleButton.addEventListener('click', toggleGrid);
    }

    // Reset button
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSimulation);
    }

    // Pause button
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', togglePause);
        pauseBtn.textContent = config.paused ? 'Resume' : 'Pause';
    }

    // Debug button
    const debugBtn = document.getElementById('debugBtn');
    if (debugBtn) {
        debugBtn.addEventListener('click', clearDebug);
    }

    // Adaptive smooth button
    const adaptiveSmoothBtn = document.getElementById('adaptiveSmoothBtn');
    if (adaptiveSmoothBtn) {
        adaptiveSmoothBtn.addEventListener('click', toggleAdaptiveSmooth);
        adaptiveSmoothBtn.textContent = config.adaptiveSmooth ? 'Disable Smooth' : 'Adaptive Smooth';
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
        });
    }
}

// Initialize the visualization once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for potential external use
window.flockingSimulation = {
    reset: resetSimulation,
    togglePause: togglePause,
    toggleGrid: toggleGrid,
    toggleAdaptiveSmooth: toggleAdaptiveSmooth,
    clearDebug: clearDebug
};