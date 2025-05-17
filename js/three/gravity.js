// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let bodies = [];
let gridHelper, axisHelper;
let clock = new THREE.Clock();
let trailsGroup;

// Configuration parameters
let config = {
    numBodies: 50,           // Number of celestial bodies
    centralMass: 1000,       // Mass of central body
    maxInitialMass: 10,      // Maximum mass for other bodies
    gravityConstant: 0.5,    // Gravitational constant
    damping: 0.995,          // Velocity damping factor
    maxSpeed: 0.5,           // Maximum speed
    boundaryRadius: 100,     // Size of the boundary sphere
    colorScheme: 'thermal',  // Default color scheme
    showOrbits: true,        // Whether to show orbit trails
    paused: false,           // Whether the simulation is paused
    showLabels: false,       // Show mass labels
    collisionMode: 'bounce', // How bodies interact on collision
    maxTrailPoints: 500,     // Maximum trail points per body
    softeningConstant: 0.1,  // To avoid division by zero
    timeScale: 1.0           // Simulation speed multiplier
};

// Celestial Body class
class CelestialBody {
    constructor(position, velocity, mass, isFixed = false) {
        // Calculate radius based on mass (not to actual scale)
        const radius = Math.max(0.5, Math.cbrt(mass) * 0.5);
        
        // Create geometry and material for the body
        const geometry = new THREE.SphereGeometry(radius, 32, 16);
        
        // Material will be set based on config
        this.mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0xffffff }));
        
        // Set initial position
        this.mesh.position.copy(position);
        
        // Set properties
        this.velocity = velocity;
        this.mass = mass;
        this.isFixed = isFixed;
        this.radius = radius;
        
        // Initialize trails if enabled
        if (config.showOrbits) {
            this.initTrail();
        }
        
        // Create label if needed
        if (config.showLabels) {
            this.createLabel();
        }
        
        // Add to scene
        scene.add(this.mesh);
    }
    
    // Initialize orbit trail
    initTrail() {
        // Create line material based on body color
        const trailMaterial = new THREE.LineBasicMaterial({
            color: this.mesh.material.color,
            transparent: true,
            opacity: 0.5,
            linewidth: 1
        });
        
        // Create trail geometry with initial point
        const trailGeometry = new THREE.BufferGeometry();
        this.trailPositions = new Float32Array(config.maxTrailPoints * 3);
        
        // Initialize with current position
        this.trailPositions[0] = this.mesh.position.x;
        this.trailPositions[1] = this.mesh.position.y;
        this.trailPositions[2] = this.mesh.position.z;
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
        trailGeometry.setDrawRange(0, 1);
        
        this.trail = new THREE.Line(trailGeometry, trailMaterial);
        this.trailIndex = 1;
        trailsGroup.add(this.trail);
    }
    
    // Create text label showing mass
    createLabel() {
        // Create canvas for text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 50;
        
        // Draw text on canvas
        context.font = '24px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.fillText(this.mass.toFixed(1), canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create sprite material
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        
        // Create sprite and position it
        this.label = new THREE.Sprite(spriteMaterial);
        this.label.scale.set(5, 2.5, 1);
        this.label.position.copy(this.mesh.position);
        this.label.position.y += this.radius + 2;
        
        scene.add(this.label);
    }
    
    // Update body position and trails
    update(delta, bodies) {
        if (config.paused) return;
        
        // Skip physics for fixed bodies
        if (!this.isFixed) {
            // Calculate forces from all other bodies
            const force = new THREE.Vector3(0, 0, 0);
            
            bodies.forEach(body => {
                if (body === this) return;
                
                // Calculate direction and distance
                const direction = new THREE.Vector3().subVectors(body.mesh.position, this.mesh.position);
                let distance = direction.length();
                
                // Check for collision
                if (distance < (this.radius + body.radius)) {
                    this.handleCollision(body);
                    return;
                }
                
                // Apply gravitational force: F = G * m1 * m2 / r^2
                // Use softening to avoid numerical instability
                const softenedDistance = Math.sqrt(distance * distance + config.softeningConstant);
                const strength = config.gravityConstant * this.mass * body.mass / 
                                (softenedDistance * softenedDistance);
                
                // Add to net force
                force.add(direction.normalize().multiplyScalar(strength));
            });
            
            // F = ma, so a = F/m
            const acceleration = force.divideScalar(this.mass);
            
            // Update velocity: v = v + a*t
            this.velocity.add(acceleration.multiplyScalar(delta * config.timeScale));
            
            // Apply damping
            this.velocity.multiplyScalar(config.damping);
            
            // Enforce speed limit
            const speed = this.velocity.length();
            if (speed > config.maxSpeed) {
                this.velocity.multiplyScalar(config.maxSpeed / speed);
            }
            
            // Enforce boundary (optional)
            this.enforceBoundary();
            
            // Update position: p = p + v*t
            this.mesh.position.add(this.velocity.clone().multiplyScalar(delta * config.timeScale));
        }
        
        // Update orbit trail if enabled
        if (config.showOrbits && this.trail) {
            this.updateTrail();
        }
        
        // Update label position if present
        if (this.label) {
            this.label.position.copy(this.mesh.position);
            this.label.position.y += this.radius + 2;
        }
    }
    
    // Handle collision with another body
    handleCollision(otherBody) {
        if (config.collisionMode === 'bounce') {
            // Elastic collision
            const v1 = this.velocity.clone();
            const v2 = otherBody.velocity.clone();
            const m1 = this.mass;
            const m2 = otherBody.mass;
            
            // Calculate new velocities (simplified physics)
            const newV1 = v1.multiplyScalar((m1 - m2) / (m1 + m2))
                           .add(v2.clone().multiplyScalar(2 * m2 / (m1 + m2)));
            
            this.velocity.copy(newV1);
            
            // Apply collision damping
            this.velocity.multiplyScalar(0.8);
            
            // Separate bodies to prevent sticking
            const direction = new THREE.Vector3().subVectors(
                this.mesh.position, otherBody.mesh.position
            ).normalize();
            
            this.mesh.position.add(direction.multiplyScalar(0.2));
        }
        else if (config.collisionMode === 'merge') {
            // Merge bodies (not implemented here but would combine masses)
            console.log("Merge collision mode not fully implemented");
        }
    }
    
    // Keep bodies within boundary sphere
    enforceBoundary() {
        const distanceFromCenter = this.mesh.position.length();
        if (distanceFromCenter > config.boundaryRadius) {
            // Add a force towards the center, stronger the further away
            const toCenter = new THREE.Vector3().subVectors(
                new THREE.Vector3(0, 0, 0),
                this.mesh.position
            );
            
            const boundaryFactor = (distanceFromCenter - config.boundaryRadius) / config.boundaryRadius;
            toCenter.normalize().multiplyScalar(boundaryFactor * 1.0);
            this.velocity.add(toCenter);
            
            // Also add some damping at boundary
            this.velocity.multiplyScalar(0.95);
        }
    }
    
    // Update orbit trail visualization
    updateTrail() {
        if (this.trailIndex >= config.maxTrailPoints) {
            // Reset trail if full
            this.trailIndex = 0;
        }
        
        // Add current position to trail
        const baseIndex = this.trailIndex * 3;
        this.trailPositions[baseIndex] = this.mesh.position.x;
        this.trailPositions[baseIndex + 1] = this.mesh.position.y;
        this.trailPositions[baseIndex + 2] = this.mesh.position.z;
        
        // Update draw range
        const drawCount = Math.min(this.trailIndex + 1, config.maxTrailPoints);
        this.trail.geometry.setDrawRange(0, drawCount);
        this.trail.geometry.attributes.position.needsUpdate = true;
        
        this.trailIndex++;
    }
    
    // Update the body's material based on color scheme
    updateMaterial(colorscheme, massRatio) {
        let color;
        
        switch (colorscheme) {
            case 'thermal':
                // Color based on mass, hot (red/yellow) for high mass, cool (blue) for low mass
                const temperature = Math.pow(massRatio, 0.7); // Non-linear scaling
                if (temperature < 0.33) {
                    color = new THREE.Color(0x0066ff).lerp(new THREE.Color(0x00ffff), temperature * 3);
                } else if (temperature < 0.66) {
                    color = new THREE.Color(0x00ffff).lerp(new THREE.Color(0xffff00), (temperature - 0.33) * 3);
                } else {
                    color = new THREE.Color(0xffff00).lerp(new THREE.Color(0xff0000), (temperature - 0.66) * 3);
                }
                break;
                
            case 'mass':
                // Simple gradient from blue to red based on mass
                color = new THREE.Color(0x0000ff).lerp(new THREE.Color(0xff0000), massRatio);
                break;
                
            case 'velocity':
                // Color based on velocity magnitude
                const speed = this.velocity.length() / config.maxSpeed;
                color = new THREE.Color(0x00ff00).lerp(new THREE.Color(0xff00ff), speed);
                break;
                
            case 'grayscale':
                // Grayscale based on mass
                const brightness = 0.3 + massRatio * 0.7;
                color = new THREE.Color(brightness, brightness, brightness);
                break;
                
            default:
                // Default color
                color = new THREE.Color(0x0088ff);
        }
        
        // Apply the color
        this.mesh.material.color.copy(color);
        
        // Update trail color if it exists
        if (this.trail) {
            this.trail.material.color.copy(color);
        }
    }
    
    // Remove body and its associated objects from scene
    dispose() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        
        if (this.label) {
            scene.remove(this.label);
            this.label.material.dispose();
        }
        
        if (this.trail) {
            trailsGroup.remove(this.trail);
            this.trail.geometry.dispose();
            this.trail.material.dispose();
        }
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
    scene.background = new THREE.Color(isDarkMode ? 0x000510 : 0x000510);
    
    // Create group for trails
    trailsGroup = new THREE.Group();
    scene.add(trailsGroup);
    
    // Create and add a grid helper
    gridHelper = new THREE.GridHelper(config.boundaryRadius * 2, 20, 0x555555, 0x333333);
    scene.add(gridHelper);
    
    // Add axis helper to show X, Y, Z directions
    axisHelper = new THREE.AxesHelper(config.boundaryRadius / 2);
    scene.add(axisHelper);
    
    // Add boundary sphere (transparent)
    const boundaryGeometry = new THREE.SphereGeometry(config.boundaryRadius, 32, 32);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.05,
        wireframe: true
    });
    const boundarySphere = new THREE.Mesh(boundaryGeometry, boundaryMaterial);
    scene.add(boundarySphere);
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(config.boundaryRadius * 1.5, config.boundaryRadius, config.boundaryRadius * 1.5);
    camera.lookAt(0, 0, 0);
    
    // Setup controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    
    // Add lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    const secondLight = new THREE.DirectionalLight(0xffffff, 0.4);
    secondLight.position.set(-1, 0.5, -1);
    scene.add(secondLight);
    
    // Add point light at center for "sun" effect
    const centralLight = new THREE.PointLight(0xffffcc, 1, config.boundaryRadius * 2);
    centralLight.position.set(0, 0, 0);
    scene.add(centralLight);
    
    // Create celestial bodies
    createBodies();
    
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
    
    console.log("Gravity simulation initialized");
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

// Function to toggle orbit trails
function toggleOrbits() {
    config.showOrbits = !config.showOrbits;
    trailsGroup.visible = config.showOrbits;
    
    // Regenerate trails if turning on
    if (config.showOrbits) {
        bodies.forEach(body => {
            if (!body.trail) {
                body.initTrail();
            }
        });
    }
}

// Create celestial bodies
function createBodies() {
    // Remove existing bodies
    bodies.forEach(body => body.dispose());
    bodies = [];
    
    // Clear trails group
    while(trailsGroup.children.length > 0) {
        const trail = trailsGroup.children[0];
        trailsGroup.remove(trail);
        trail.geometry.dispose();
        trail.material.dispose();
    }
    
    // Create central "sun" with fixed position
    const centralBody = new CelestialBody(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        config.centralMass,
        true  // Fixed position
    );
    
    // Make central body yellow/orange
    centralBody.mesh.material.color.set(0xffcc33);
    centralBody.mesh.material.emissive = new THREE.Color(0xff8800);
    centralBody.mesh.material.emissiveIntensity = 0.5;
    
    bodies.push(centralBody);
    
    // Create orbiting bodies
    for (let i = 1; i < config.numBodies; i++) {
        // Random position in orbital plane (mostly)
        const distance = (Math.random() * 0.6 + 0.3) * config.boundaryRadius;
        const angle = Math.random() * Math.PI * 2;
        const heightVariation = (Math.random() - 0.5) * config.boundaryRadius * 0.2;
        
        const position = new THREE.Vector3(
            distance * Math.cos(angle),
            heightVariation,
            distance * Math.sin(angle)
        );
        
        // Calculate orbital velocity for approximate circular orbit
        // v = sqrt(G * M / r)
        const toCenter = new THREE.Vector3().subVectors(new THREE.Vector3(0, 0, 0), position);
        const distance3D = toCenter.length();
        const orbitalSpeed = Math.sqrt(config.gravityConstant * config.centralMass / distance3D) * 
                            (Math.random() * 0.3 + 0.85); // Slightly randomize
        
        // Direction perpendicular to radius vector in the orbital plane
        const perpDirection = new THREE.Vector3(-position.z, 0, position.x).normalize();
        
        // Small random velocity component
        const randComponent = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        );
        
        const velocity = perpDirection.multiplyScalar(orbitalSpeed).add(randComponent);
        
        // Random mass
        const mass = Math.random() * (config.maxInitialMass - 1) + 1;
        
        // Create body
        const body = new CelestialBody(position, velocity, mass);
        
        // Update material based on mass ratio
        const massRatio = (mass - 1) / (config.maxInitialMass - 1);
        body.updateMaterial(config.colorScheme, massRatio);
        
        bodies.push(body);
    }
    
    // Update statistics
    updateStats();
}

// Update body materials based on color scheme
function updateBodyMaterials() {
    bodies.forEach((body, index) => {
        if (index === 0) {
            // Keep sun yellow
            return;
        }
        
        const massRatio = (body.mass - 1) / (config.maxInitialMass - 1);
        body.updateMaterial(config.colorScheme, massRatio);
    });
}

// Listen for dark mode changes
function setupDarkModeListener() {
    // Watch for class changes on body
    const observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (mutation) {
            if (mutation.attributeName === 'class') {
                updateSceneBackground();
            }
        });
    });
    
    observer.observe(document.body, { attributes: true });
}

// Update scene background based on dark mode state
function updateSceneBackground() {
    if (!scene) return;
    
    const isDarkMode = document.body.classList.contains('dark-mode');
    scene.background = new THREE.Color(isDarkMode ? 0x000510 : 0x000510);
    console.log("Updated Three.js scene background to", isDarkMode ? "dark" : "light", "mode");
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Calculate delta time
    const delta = clock.getDelta();
    
    // Update controls
    controls.update();
    
    // Update bodies
    if (!config.paused) {
        bodies.forEach(body => body.update(delta, bodies));
        
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
        statsElement.textContent = `Bodies: ${bodies.length} | Iterations: ${config.iterations || 0}`;
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

// Toggle labels
function toggleLabels() {
    config.showLabels = !config.showLabels;
    
    bodies.forEach(body => {
        if (config.showLabels) {
            if (!body.label) {
                body.createLabel();
            }
        } else {
            if (body.label) {
                scene.remove(body.label);
                body.label.material.dispose();
                body.label = null;
            }
        }
    });
    
    const labelsBtn = document.getElementById('labelsBtn');
    if (labelsBtn) {
        labelsBtn.textContent = config.showLabels ? 'Hide Labels' : 'Show Labels';
    }
}

// Reset the simulation
function resetSimulation() {
    createBodies();
    config.iterations = 0;
    updateStats();
}

// Setup UI event listeners
function setupEventListeners() {
    // Bodies slider
    const bodiesSlider = document.getElementById('bodies');
    const bodiesValue = document.getElementById('bodiesValue');
    
    if (bodiesSlider && bodiesValue) {
        bodiesSlider.min = 10;
        bodiesSlider.max = 200;
        bodiesSlider.step = 10;
        bodiesSlider.value = config.numBodies;
        bodiesValue.textContent = config.numBodies;
        
        bodiesSlider.addEventListener('input', function () {
            config.numBodies = parseInt(this.value);
            bodiesValue.textContent = config.numBodies;
        });
        
        bodiesSlider.addEventListener('change', resetSimulation);
    }
    
    // Central Mass slider
    const massSlider = document.getElementById('centralMass');
    const massValue = document.getElementById('centralMassValue');
    
    if (massSlider && massValue) {
        massSlider.min = 100;
        massSlider.max = 5000;
        massSlider.step = 100;
        massSlider.value = config.centralMass;
        massValue.textContent = config.centralMass;
        
        massSlider.addEventListener('input', function () {
            config.centralMass = parseInt(this.value);
            massValue.textContent = config.centralMass;
        });
        
        massSlider.addEventListener('change', resetSimulation);
    }
    
    // Gravity Constant slider
    const gravitySlider = document.getElementById('gravity');
    const gravityValue = document.getElementById('gravityValue');
    
    if (gravitySlider && gravityValue) {
        gravitySlider.min = 0.1;
        gravitySlider.max = 2.0;
        gravitySlider.step = 0.1;
        gravitySlider.value = config.gravityConstant;
        gravityValue.textContent = config.gravityConstant.toFixed(1);
        
        gravitySlider.addEventListener('input', function () {
            config.gravityConstant = parseFloat(this.value);
            gravityValue.textContent = config.gravityConstant.toFixed(1);
        });
    }
    
    // Time Scale slider
    const timeScaleSlider = document.getElementById('timeScale');
    const timeScaleValue = document.getElementById('timeScaleValue');
    
    if (timeScaleSlider && timeScaleValue) {
        timeScaleSlider.min = 0.1;
        timeScaleSlider.max = 3.0;
        timeScaleSlider.step = 0.1;
        timeScaleSlider.value = config.timeScale;
        timeScaleValue.textContent = config.timeScale.toFixed(1);
        
        timeScaleSlider.addEventListener('input', function () {
            config.timeScale = parseFloat(this.value);
            timeScaleValue.textContent = config.timeScale.toFixed(1);
        });
    }
    
    // Color scheme selector
    const colorSchemeSelect = document.getElementById('colorScheme');
    
    if (colorSchemeSelect) {
        colorSchemeSelect.value = config.colorScheme;
        
        colorSchemeSelect.addEventListener('change', function () {
            config.colorScheme = this.value;
            updateBodyMaterials();
        });
    }
    
    // Collision mode selector
    const collisionModeSelect = document.getElementById('collisionMode');
    
    if (collisionModeSelect) {
        collisionModeSelect.value = config.collisionMode;
        
        collisionModeSelect.addEventListener('change', function () {
            config.collisionMode = this.value;
        });
    }
    
    // Grid toggle button
    const gridToggleButton = document.getElementById('gridToggle');
    if (gridToggleButton) {
        gridToggleButton.addEventListener('click', toggleGrid);
    }
    
    // Orbits toggle button
    const orbitsToggleButton = document.getElementById('orbitsToggle');
    if (orbitsToggleButton) {
        orbitsToggleButton.addEventListener('click', toggleOrbits);
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
    
    // Labels button
    const labelsBtn = document.getElementById('labelsBtn');
    if (labelsBtn) {
        labelsBtn.addEventListener('click', toggleLabels);
        labelsBtn.textContent = config.showLabels ? 'Hide Labels' : 'Show Labels';
    }
}

// Initialize the visualization once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for potential external use
window.gravitySimulation = {
    reset: resetSimulation,
    togglePause: togglePause,
    toggleGrid: toggleGrid,
    toggleOrbits: toggleOrbits,
    toggleLabels: toggleLabels
};