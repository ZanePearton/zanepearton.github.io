// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let boids = [];
let trails = [];
let bundledLines = [];
let gridHelper, axisHelper;
let clock = new THREE.Clock();
let frameCount = 0;

// Configuration parameters
let config = {
    numBoids: 30,           // Number of boids in the simulation
    separationDistance: 2,  // Distance to maintain from neighbors
    alignmentFactor: 0.05,  // How much to align with neighbors' direction
    cohesionFactor: 0.005,  // How much to move toward center of neighbors
    separationFactor: 0.1,  // How much to avoid neighbors
    maxSpeed: 0.5,          // Maximum speed of boids
    perceptionRadius: 5,    // How far boids can see neighbors
    boundaryRadius: 50,     // Size of the boundary sphere
    maxTrailLength: 50,     // Maximum length of each boid's trail
    bundleDistance: 15,     // Maximum distance for edge bundling
    bundleUpdateInterval: 30, // How often to update bundled lines (frames)
    trailWidth: 2,          // Width of the trail lines
    bundleWidth: 0.3,       // Base width of bundled lines
    colorScheme: 'gradient',
    showTrails: true,
    showBundles: true,
    paused: false,          // Whether the simulation is paused
    debug: false,           // Show debug information
};

// Custom curve for edge bundling
class BundledCurve extends THREE.Curve {
    constructor(startPoint, endPoint, bundleAmount = 0.5, bundleHeight = 1.0) {
        super();
        this.startPoint = startPoint;
        this.endPoint = endPoint;
        this.bundleAmount = bundleAmount;
        this.bundleHeight = bundleHeight;
        
        // Calculate midpoint with some offset for bundling effect
        const midX = (startPoint.x + endPoint.x) / 2;
        const midY = (startPoint.y + endPoint.y) / 2 + bundleHeight;
        const midZ = (startPoint.z + endPoint.z) / 2;
        
        this.midPoint = new THREE.Vector3(midX, midY, midZ);
    }

    getPoint(t) {
        const point = new THREE.Vector3();
        
        // Quadratic bezier curve formula
        point.x = Math.pow(1 - t, 2) * this.startPoint.x + 
                  2 * (1 - t) * t * this.midPoint.x + 
                  Math.pow(t, 2) * this.endPoint.x;
        
        point.y = Math.pow(1 - t, 2) * this.startPoint.y + 
                  2 * (1 - t) * t * this.midPoint.y + 
                  Math.pow(t, 2) * this.endPoint.y;
        
        point.z = Math.pow(1 - t, 2) * this.startPoint.z + 
                  2 * (1 - t) * t * this.midPoint.z + 
                  Math.pow(t, 2) * this.endPoint.z;
        
        return point;
    }
}

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

        // Trail properties
        this.trail = [];
        this.trailLine = null;

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

        // Apply boundary avoidance
        this.enforceBoundary();

        // Update position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta * 60));

        // Set orientation to match velocity
        if (this.velocity.lengthSq() > 0.001) {
            this.mesh.lookAt(this.mesh.position.clone().add(this.velocity));
        }

        // Update trail
        if (config.showTrails) {
            this.updateTrail();
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

        boids.forEach(boid => {
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

    // Update the boid's trail
    updateTrail() {
        // Remove old trail line
        if (this.trailLine) {
            scene.remove(this.trailLine);
            this.trailLine.geometry.dispose();
            this.trailLine.material.dispose();
        }

        // Add current position to trail
        this.trail.push(this.mesh.position.clone());
        
        // Limit trail length
        if (this.trail.length > config.maxTrailLength) {
            this.trail.shift();
        }
        
        // Create new trail if we have enough points
        if (this.trail.length > 1) {
            const points = this.trail.map(p => new THREE.Vector3(p.x, p.y, p.z));
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            
            // Create gradient colors along the trail (newer positions are brighter)
            const colors = [];
            const pointCount = points.length;
            
            for (let i = 0; i < pointCount; i++) {
                // Calculate intensity based on position in trail (newer = brighter)
                const intensity = i / pointCount;
                colors.push(0, 0.7 + 0.3 * intensity, 0.7 + 0.3 * intensity); // Cyan with increasing brightness
            }
            
            geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            
            const material = new THREE.LineBasicMaterial({ 
                vertexColors: true,
                opacity: 0.7, 
                transparent: true,
                linewidth: 2
            });
            
            this.trailLine = new THREE.Line(geometry, material);
            scene.add(this.trailLine);
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
        if (this.trailLine) {
            scene.remove(this.trailLine);
            this.trailLine.geometry.dispose();
            this.trailLine.material.dispose();
        }
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
    scene.background = new THREE.Color(isDarkMode ? 0x121212 : 0x000000);

    // Create and add a grid helper
    gridHelper = new THREE.GridHelper(100, 20);
    scene.add(gridHelper);

    // Add axis helper to show X, Y, Z directions
    axisHelper = new THREE.AxesHelper(10);
    scene.add(axisHelper);

    // Add boundary sphere (transparent)
    const boundaryGeometry = new THREE.SphereGeometry(config.boundaryRadius, 32, 32);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    const boundarySphere = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    scene.add(boundarySphere);

    // Setup camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(100, 50, 100);
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

    // Start animation loop
    animate();

    // Update statistics
    updateStats();

    console.log("Edge Bundled Flocking visualization initialized");
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

// Function to toggle trails visibility
function toggleTrails() {
    config.showTrails = !config.showTrails;
    
    // Show/hide existing trails
    boids.forEach(boid => {
        if (boid.trailLine) {
            boid.trailLine.visible = config.showTrails;
        }
    });
}

// Function to toggle bundled lines visibility
function toggleBundles() {
    config.showBundles = !config.showBundles;
    
    // Show/hide existing bundled lines
    bundledLines.forEach(line => {
        line.visible = config.showBundles;
    });
}

// Create boids with random positions and velocities
function createBoids() {
    // Remove existing boids
    boids.forEach(boid => boid.dispose());
    boids = [];

    // Clear bundled lines
    clearBundledLines();

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

// Update bundled lines between boids
function updateBundledLines() {
    if (!config.showBundles) return;
    
    // Remove old bundled lines
    clearBundledLines();
    
    // Group boids by proximity to create bundles
    const bundleGroups = [];
    const processed = new Set();
    
    // Step 1: Find groups of nearby boids
    for (let i = 0; i < boids.length; i++) {
        if (processed.has(i)) continue;
        
        const group = [i];
        processed.add(i);
        
        for (let j = 0; j < boids.length; j++) {
            if (i === j || processed.has(j)) continue;
            
            const distance = boids[i].mesh.position.distanceTo(boids[j].mesh.position);
            if (distance < config.bundleDistance * 0.5) { // Tighter grouping for bundles
                group.push(j);
                processed.add(j);
            }
        }
        
        if (group.length > 1) {
            bundleGroups.push(group);
        }
    }
    
    // Step 2: Create bundled paths for each group
    bundleGroups.forEach(group => {
        // Calculate centroid paths from each boid's trail
        const centroidPaths = [];
        
        // For each position in trail length, calculate the average position of all boids in the group
        for (let t = 0; t < config.maxTrailLength; t++) {
            const positions = [];
            
            group.forEach(boidIndex => {
                const boid = boids[boidIndex];
                if (boid.trail[t]) {
                    positions.push(boid.trail[t]);
                }
            });
            
            if (positions.length > 0) {
                // Calculate average position
                const centroid = new THREE.Vector3();
                positions.forEach(pos => centroid.add(pos));
                centroid.divideScalar(positions.length);
                
                centroidPaths.push(centroid);
            }
        }
        
        // Create smooth curve through centroid points if we have enough points
        if (centroidPaths.length > 2) {
            // Create a curve from points
            const curve = new THREE.CatmullRomCurve3(centroidPaths);
            
            // Create tube geometry for the curve
            const tubeGeometry = new THREE.TubeGeometry(
                curve,
                20,  // tubular segments
                0.3 + 0.1 * group.length,  // tube radius based on group size
                8,    // radial segments
                false // closed
            );
            
            // Create gradient material for the bundle
            const colors = [];
            const colorCount = tubeGeometry.attributes.position.count;
            const startColor = new THREE.Color(0.2, 0.4, 0.8); // Blue
            const endColor = new THREE.Color(0.0, 0.8, 0.8); // Cyan
            
            for (let i = 0; i < colorCount; i++) {
                const t = i / colorCount;
                const color = new THREE.Color().lerpColors(startColor, endColor, t);
                colors.push(color.r, color.g, color.b);
            }
            
            tubeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
            
            const material = new THREE.MeshPhongMaterial({
                vertexColors: true,
                transparent: true,
                opacity: 0.5,
                shininess: 30,
                side: THREE.DoubleSide
            });
            
            const tube = new THREE.Mesh(tubeGeometry, material);
            scene.add(tube);
            bundledLines.push(tube);
        }
    });
    
    // Create connections between nearby groups
    for (let i = 0; i < bundleGroups.length; i++) {
        for (let j = i + 1; j < bundleGroups.length; j++) {
            // Get representative boids from each group
            const boid1 = boids[bundleGroups[i][0]];
            const boid2 = boids[bundleGroups[j][0]];
            
            const distance = boid1.mesh.position.distanceTo(boid2.mesh.position);
            
            if (distance < config.bundleDistance * 1.5) {
                // Create connection between groups
                const curve = new BundledCurve(
                    boid1.mesh.position.clone(),
                    boid2.mesh.position.clone(),
                    0.5,
                    distance * 0.25
                );
                
                // Create tube geometry for the curve
                const tubeGeometry = new THREE.TubeGeometry(
                    curve,
                    10,  // fewer segments for connections
                    0.2, // thinner tube
                    6,   // fewer radial segments
                    false // not closed
                );
                
                // Create material with opacity based on distance
                const opacity = 1 - (distance / (config.bundleDistance * 1.5));
                const material = new THREE.MeshBasicMaterial({
                    color: 0x66bbff,
                    transparent: true,
                    opacity: opacity * 0.3,
                    wireframe: false
                });
                
                const tube = new THREE.Mesh(tubeGeometry, material);
                scene.add(tube);
                bundledLines.push(tube);
            }
        }
    }
    
    // Update statistics
    updateStats();
}

// Clear all bundled lines
function clearBundledLines() {
    bundledLines.forEach(line => {
        scene.remove(line);
        line.geometry.dispose();
        line.material.dispose();
    });
    bundledLines = [];
}

// Update boid materials based on color scheme
function updateBoidMaterials() {
    boids.forEach((boid, index) => {
        boid.updateMaterial(config.colorScheme, index, boids.length);
    });
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
        
        // Update bundled lines periodically
        frameCount++;
        if (frameCount % config.bundleUpdateInterval === 0) {
            updateBundledLines();
        }
    }

    // Rotate camera slowly around the scene for a dynamic view
    if (!config.paused && !controls.enabled) {
        const cameraRotationSpeed = 0.001;
        camera.position.x = Math.cos(Date.now() * cameraRotationSpeed) * 120;
        camera.position.z = Math.sin(Date.now() * cameraRotationSpeed) * 120;
        camera.lookAt(0, 0, 0);
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
        statsElement.textContent = `Boids: ${boids.length} | Bundles: ${bundledLines.length}`;
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

// Reset the simulation
function resetSimulation() {
    createBoids();
    frameCount = 0;
    updateStats();
}

// Setup UI event listeners
function setupEventListeners() {
    // Number of boids slider
    const boidsSlider = document.getElementById('numBoids');
    const boidsValue = document.getElementById('numBoidsValue');

    if (boidsSlider && boidsValue) {
        boidsSlider.min = 10;
        boidsSlider.max = 100;
        boidsSlider.step = 5;
        boidsSlider.value = config.numBoids;
        boidsValue.textContent = config.numBoids;

        boidsSlider.addEventListener('input', function () {
            config.numBoids = parseInt(this.value);
            boidsValue.textContent = config.numBoids;
            createBoids();
        });
    }

    // Separation distance slider
    const separationSlider = document.getElementById('separationDistance');
    const separationValue = document.getElementById('separationValue');

    if (separationSlider && separationValue) {
        separationSlider.min = 0.5;
        separationSlider.max = 5;
        separationSlider.step = 0.1;
        separationSlider.value = config.separationDistance;
        separationValue.textContent = config.separationDistance.toFixed(1);

        separationSlider.addEventListener('input', function () {
            config.separationDistance = parseFloat(this.value);
            separationValue.textContent = config.separationDistance.toFixed(1);
        });
    }

    // Alignment factor slider
    const alignmentSlider = document.getElementById('alignmentFactor');
    const alignmentValue = document.getElementById('alignmentValue');

    if (alignmentSlider && alignmentValue) {
        alignmentSlider.min = 0;
        alignmentSlider.max = 0.2;
        alignmentSlider.step = 0.01;
        alignmentSlider.value = config.alignmentFactor;
        alignmentValue.textContent = config.alignmentFactor.toFixed(2);

        alignmentSlider.addEventListener('input', function () {
            config.alignmentFactor = parseFloat(this.value);
            alignmentValue.textContent = config.alignmentFactor.toFixed(2);
        });
    }

    // Cohesion factor slider
    const cohesionSlider = document.getElementById('cohesionFactor');
    const cohesionValue = document.getElementById('cohesionValue');

    if (cohesionSlider && cohesionValue) {
        cohesionSlider.min = 0;
        cohesionSlider.max = 0.02;
        cohesionSlider.step = 0.001;
        cohesionSlider.value = config.cohesionFactor;
        cohesionValue.textContent = config.cohesionFactor.toFixed(3);

        cohesionSlider.addEventListener('input', function () {
            config.cohesionFactor = parseFloat(this.value);
            cohesionValue.textContent = config.cohesionFactor.toFixed(3);
        });
    }

    // Separation factor slider
    const separationFactorSlider = document.getElementById('separationFactor');
    const separationFactorValue = document.getElementById('separationFactorValue');

    if (separationFactorSlider && separationFactorValue) {
        separationFactorSlider.min = 0;
        separationFactorSlider.max = 0.5;
        separationFactorSlider.step = 0.01;
        separationFactorSlider.value = config.separationFactor;
        separationFactorValue.textContent = config.separationFactor.toFixed(2);

        separationFactorSlider.addEventListener('input', function () {
            config.separationFactor = parseFloat(this.value);
            separationFactorValue.textContent = config.separationFactor.toFixed(2);
        });
    }

    // Max speed slider
    const maxSpeedSlider = document.getElementById('maxSpeed');
    const maxSpeedValue = document.getElementById('maxSpeedValue');

    if (maxSpeedSlider && maxSpeedValue) {
        maxSpeedSlider.min = 0.1;
        maxSpeedSlider.max = 1.0;
        maxSpeedSlider.step = 0.1;
        maxSpeedSlider.value = config.maxSpeed;
        maxSpeedValue.textContent = config.maxSpeed.toFixed(1);

        maxSpeedSlider.addEventListener('input', function () {
            config.maxSpeed = parseFloat(this.value);
            maxSpeedValue.textContent = config.maxSpeed.toFixed(1);
        });
    }

    // Bundle distance slider
    const bundleDistanceSlider = document.getElementById('bundleDistance');
    const bundleDistanceValue = document.getElementById('bundleDistanceValue');

    if (bundleDistanceSlider && bundleDistanceValue) {
        bundleDistanceSlider.min = 5;
        bundleDistanceSlider.max = 30;
        bundleDistanceSlider.step = 1;
        bundleDistanceSlider.value = config.bundleDistance;
        bundleDistanceValue.textContent = config.bundleDistance;

        bundleDistanceSlider.addEventListener('input', function () {
            config.bundleDistance = parseFloat(this.value);
            bundleDistanceValue.textContent = config.bundleDistance;
            updateBundledLines();
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

    // Grid toggle button
    const gridToggleButton = document.getElementById('gridToggle');
    if (gridToggleButton) {
        gridToggleButton.addEventListener('click', toggleGrid);
    }

    // Trails toggle button
    const trailsToggleButton = document.getElementById('trailsToggle');
    if (trailsToggleButton) {
        trailsToggleButton.addEventListener('click', toggleTrails);
    }

    // Bundles toggle button
    const bundlesToggleButton = document.getElementById('bundlesToggle');
    if (bundlesToggleButton) {
        bundlesToggleButton.addEventListener('click', toggleBundles);
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
}

// Initialize the visualization once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for potential external use
window.flockingSimulation = {
    reset: resetSimulation,
    togglePause: togglePause,
    toggleGrid: toggleGrid,
    toggleTrails: toggleTrails,
    toggleBundles: toggleBundles
};