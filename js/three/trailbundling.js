// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let boids = [];
let trailsGroup = new THREE.Group(); // Group to hold all trails
let clock = new THREE.Clock();

// Configuration parameters
let config = {
    // Boid parameters
    numBoids: 30,
    boidSeparation: 2,
    boidAlignment: 0.05,
    boidCohesion: 0.005,
    boidSeparationForce: 0.1,
    maxSpeed: 0.5,
    perceptionRadius: 5,
    boundaryRadius: 50,
    
    // Trail parameters
    maxTrailLength: 1120,
    trailSeparation: 0.25,     // How much trails avoid each other
    trailAlignment: 0.15,      // How much trails align with nearby trails
    trailCohesion: 0.1,        // How much trails are attracted to each other
    trailInfluenceRadius: 15,  // How far trails can influence each other
    
    // Visualization
    colorScheme: 'gradient',
    showTrails: true,
    paused: false
};

// Boid class
class Boid {
    constructor(position, velocity, id) {
        this.id = id;
        
        // Create geometry and material for the boid
        const geometry = new THREE.ConeGeometry(0.5, 1.5, 8);
        geometry.rotateX(Math.PI / 2); // Orient cone to point in direction of travel
        this.mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0xffffff }));
        this.mesh.position.copy(position);
        this.velocity = velocity;
        
        // Trail properties
        this.trailPoints = []; // Array of trail point objects with position and velocity
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
        this.velocity.add(separation.multiplyScalar(config.boidSeparationForce));
        this.velocity.add(alignment.multiplyScalar(config.boidAlignment));
        this.velocity.add(cohesion.multiplyScalar(config.boidCohesion));

        // Limit speed
        const speed = this.velocity.length();
        if (speed > config.maxSpeed) {
            this.velocity.multiplyScalar(config.maxSpeed / speed);
        }

        // Apply boundary avoidance
        this.enforceBoundary();

        // Update position
        const oldPosition = this.mesh.position.clone();
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
        const separationDistanceSq = config.boidSeparation * config.boidSeparation;

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
            trailsGroup.remove(this.trailLine);
            this.trailLine.geometry.dispose();
            this.trailLine.material.dispose();
        }

        // Add current position and velocity to trail
        this.trailPoints.push({
            position: this.mesh.position.clone(),
            velocity: this.velocity.clone(),
            originalPosition: this.mesh.position.clone(), // Reference for restoration force
            boidId: this.id
        });
        
        // Limit trail length
        if (this.trailPoints.length > config.maxTrailLength) {
            this.trailPoints.shift();
        }
        
        // Apply flocking behavior to the trail points (except first point)
        this.applyTrailFlocking();
        
        // Create new trail line
        if (this.trailPoints.length > 1) {
            // Get positions for the line
            const positions = this.trailPoints.map(point => point.position);
            
            // Determine color based on color scheme
            let color;
            switch (config.colorScheme) {
                case 'rainbow':
                    color = new THREE.Color().setHSL(this.id / config.numBoids, 1, 0.5);
                    break;
                case 'gradient':
                    const height = (this.mesh.position.y + config.boundaryRadius) / (config.boundaryRadius * 2);
                    color = new THREE.Color(0xff9500).lerp(new THREE.Color(0xaf52de), height);
                    break;
                default:
                    color = new THREE.Color(0x00ffff);
            }
            
            // Create line material with opacity gradient
            const material = new THREE.LineBasicMaterial({ 
                color: color, 
                opacity: 0.7, 
                transparent: true,
                linewidth: 2
            });
            
            // Create line geometry
            const geometry = new THREE.BufferGeometry().setFromPoints(positions);
            this.trailLine = new THREE.Line(geometry, material);
            trailsGroup.add(this.trailLine);
        }
    }
    
    // Apply flocking behavior to trail points
    applyTrailFlocking() {
        // Skip if too few points
        if (this.trailPoints.length < 3) return;
        
        // We don't move the first point (attached to boid) or last point (newest)
        for (let i = 1; i < this.trailPoints.length - 1; i++) {
            const point = this.trailPoints[i];
            
            // Initialize forces
            const separation = new THREE.Vector3();
            const alignment = new THREE.Vector3();
            const cohesion = new THREE.Vector3();
            const restoration = new THREE.Vector3();
            
            let separationCount = 0;
            let alignmentCount = 0;
            let cohesionCount = 0;
            
            // Influence radius squared
            const influenceRadiusSq = config.trailInfluenceRadius * config.trailInfluenceRadius;
            
            // Check against all other boids' trail points
            boids.forEach(boid => {
                // Skip points from this boid's trail (to prevent self-interaction)
                if (boid === this) return;
                
                boid.trailPoints.forEach(otherPoint => {
                    const distSq = point.position.distanceToSquared(otherPoint.position);
                    
                    // Only consider points within influence radius
                    if (distSq < influenceRadiusSq) {
                        // Separation: avoid crowding other trails
                        separation.add(
                            new THREE.Vector3()
                                .subVectors(point.position, otherPoint.position)
                                .normalize()
                                .divideScalar(Math.sqrt(distSq) || 1)
                        );
                        separationCount++;
                        
                        // Alignment: align with nearby trail directions
                        alignment.add(otherPoint.velocity);
                        alignmentCount++;
                        
                        // Cohesion: move toward average position of nearby points
                        cohesion.add(otherPoint.position);
                        cohesionCount++;
                    }
                });
            });
            
            // Calculate average forces
            if (separationCount > 0) {
                separation.divideScalar(separationCount).multiplyScalar(config.trailSeparation);
            }
            
            if (alignmentCount > 0) {
                alignment.divideScalar(alignmentCount);
                alignment.normalize().multiplyScalar(config.trailAlignment);
            }
            
            if (cohesionCount > 0) {
                cohesion.divideScalar(cohesionCount);
                cohesion.sub(point.position).normalize().multiplyScalar(config.trailCohesion);
            }
            
            // Restoration force: pull back toward original position
            restoration
                .subVectors(point.originalPosition, point.position)
                .multiplyScalar(0.03); // Small restoration force
            
            // Continuity force: keep trail smooth by averaging neighbors
            const continuity = new THREE.Vector3();
            if (i > 0 && i < this.trailPoints.length - 1) {
                const prev = this.trailPoints[i-1].position;
                const next = this.trailPoints[i+1].position;
                continuity.add(prev).add(next).divideScalar(2).sub(point.position).multiplyScalar(0.1);
            }
            
            // Apply all forces to velocity
            point.velocity.add(separation);
            point.velocity.add(alignment);
            point.velocity.add(cohesion);
            point.velocity.add(restoration);
            point.velocity.add(continuity);
            
            // Limit velocity
            const speed = point.velocity.length();
            if (speed > config.maxSpeed * 0.5) { // Trail points move slower than boids
                point.velocity.multiplyScalar((config.maxSpeed * 0.5) / speed);
            }
            
            // Update position
            point.position.add(point.velocity.clone().multiplyScalar(0.1)); // Smaller movement for stability
        }
    }

    // Update boid's material based on color scheme
    updateMaterial(colorscheme, index, totalBoids) {
        let color;

        switch (colorscheme) {
            case 'rainbow':
                color = new THREE.Color().setHSL(index / totalBoids, 1, 0.5);
                this.mesh.material = new THREE.MeshPhongMaterial({ color, shininess: 70 });
                break;
            case 'gradient':
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
            trailsGroup.remove(this.trailLine);
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
        document.body.appendChild(renderer.domElement);
    }

    // Setup scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.add(trailsGroup);

    // Create and add a grid helper
    const gridHelper = new THREE.GridHelper(100, 20);
    scene.add(gridHelper);

    // Add axis helper to show X, Y, Z directions
    const axisHelper = new THREE.AxesHelper(10);
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
}

// Function to toggle grid visibility
function toggleGrid() {
    const gridHelper = scene.children.find(child => child instanceof THREE.GridHelper);
    const axisHelper = scene.children.find(child => child instanceof THREE.AxesHelper);
    
    if (gridHelper) gridHelper.visible = !gridHelper.visible;
    if (axisHelper) axisHelper.visible = !axisHelper.visible;
}

// Function to toggle trails visibility
function toggleTrails() {
    config.showTrails = !config.showTrails;
    trailsGroup.visible = config.showTrails;
}

// Create boids with random positions and velocities
function createBoids() {
    // Remove existing boids
    boids.forEach(boid => boid.dispose());
    boids = [];

    // Clear trails group
    while (trailsGroup.children.length > 0) {
        const object = trailsGroup.children[0];
        object.geometry.dispose();
        object.material.dispose();
        trailsGroup.remove(object);
    }

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
        const boid = new Boid(position, velocity, i);
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
        let totalTrailPoints = 0;
        boids.forEach(boid => {
            totalTrailPoints += boid.trailPoints.length;
        });
        
        statsElement.textContent = `Boids: ${boids.length} | Trail Points: ${totalTrailPoints}`;
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
    updateStats();
}

// Setup UI event listeners
function setupEventListeners() {
    // Number of boids slider
    const boidsSlider = document.getElementById('numBoids');
    const boidsValue = document.getElementById('numBoidsValue');

    if (boidsSlider && boidsValue) {
        boidsSlider.value = config.numBoids;
        boidsValue.textContent = config.numBoids;

        boidsSlider.addEventListener('input', function () {
            config.numBoids = parseInt(this.value);
            boidsValue.textContent = config.numBoids;
            createBoids();
        });
    }

    // Boid separation slider
    const separationSlider = document.getElementById('separationDistance');
    const separationValue = document.getElementById('separationValue');

    if (separationSlider && separationValue) {
        separationSlider.value = config.boidSeparation;
        separationValue.textContent = config.boidSeparation.toFixed(1);

        separationSlider.addEventListener('input', function () {
            config.boidSeparation = parseFloat(this.value);
            separationValue.textContent = config.boidSeparation.toFixed(1);
        });
    }

    // Alignment factor slider
    const alignmentSlider = document.getElementById('alignmentFactor');
    const alignmentValue = document.getElementById('alignmentValue');

    if (alignmentSlider && alignmentValue) {
        alignmentSlider.value = config.boidAlignment;
        alignmentValue.textContent = config.boidAlignment.toFixed(2);

        alignmentSlider.addEventListener('input', function () {
            config.boidAlignment = parseFloat(this.value);
            alignmentValue.textContent = config.boidAlignment.toFixed(2);
        });
    }

    // Cohesion factor slider
    const cohesionSlider = document.getElementById('cohesionFactor');
    const cohesionValue = document.getElementById('cohesionValue');

    if (cohesionSlider && cohesionValue) {
        cohesionSlider.value = config.boidCohesion;
        cohesionValue.textContent = config.boidCohesion.toFixed(3);

        cohesionSlider.addEventListener('input', function () {
            config.boidCohesion = parseFloat(this.value);
            cohesionValue.textContent = config.boidCohesion.toFixed(3);
        });
    }

    // Separation factor slider
    const separationFactorSlider = document.getElementById('separationFactor');
    const separationFactorValue = document.getElementById('separationFactorValue');

    if (separationFactorSlider && separationFactorValue) {
        separationFactorSlider.value = config.boidSeparationForce;
        separationFactorValue.textContent = config.boidSeparationForce.toFixed(2);

        separationFactorSlider.addEventListener('input', function () {
            config.boidSeparationForce = parseFloat(this.value);
            separationFactorValue.textContent = config.boidSeparationForce.toFixed(2);
        });
    }

    // Max speed slider
    const maxSpeedSlider = document.getElementById('maxSpeed');
    const maxSpeedValue = document.getElementById('maxSpeedValue');

    if (maxSpeedSlider && maxSpeedValue) {
        maxSpeedSlider.value = config.maxSpeed;
        maxSpeedValue.textContent = config.maxSpeed.toFixed(1);

        maxSpeedSlider.addEventListener('input', function () {
            config.maxSpeed = parseFloat(this.value);
            maxSpeedValue.textContent = config.maxSpeed.toFixed(1);
        });
    }

    // Trail influence slider
    const bundleDistanceSlider = document.getElementById('bundleDistance');
    const bundleDistanceValue = document.getElementById('bundleDistanceValue');

    if (bundleDistanceSlider && bundleDistanceValue) {
        bundleDistanceSlider.value = config.trailInfluenceRadius;
        bundleDistanceValue.textContent = config.trailInfluenceRadius;

        bundleDistanceSlider.addEventListener('input', function () {
            config.trailInfluenceRadius = parseFloat(this.value);
            bundleDistanceValue.textContent = config.trailInfluenceRadius;
        });
    }
    
    // Trail bundling strength slider
    const bundleStrengthSlider = document.getElementById('bundleStrength');
    const bundleStrengthValue = document.getElementById('bundleStrengthValue');

    if (bundleStrengthSlider && bundleStrengthValue) {
        bundleStrengthSlider.value = config.trailCohesion;
        bundleStrengthValue.textContent = config.trailCohesion.toFixed(1);

        bundleStrengthSlider.addEventListener('input', function () {
            // Update all trail flocking parameters proportionally
            const value = parseFloat(this.value);
            config.trailCohesion = value;
            config.trailAlignment = value * 1.5;
            config.trailSeparation = value * 2.5;
            bundleStrengthValue.textContent = value.toFixed(1);
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
    toggleTrails: toggleTrails
};