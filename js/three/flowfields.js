// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let particles = [];
let flowField = [];
let gridHelper, axisHelper;
let clock = new THREE.Clock();

// Configuration parameters
const config = {
    numParticles: 1000,      // Number of particles
    fieldSize: 20,           // Size of the flow field
    fieldResolution: 10,     // Resolution of the flow field
    particleSpeed: 0.2,      // Base speed of particles
    fieldStrength: 1.0,      // Strength of the flow field
    noiseScale: 0.1,         // Scale of the noise function
    noiseSpeed: 0.2,         // Speed of noise animation
    showFieldVectors: false, // Show flow field vectors
    colorScheme: 'gradient', // Color scheme for particles
    maxSpeed: 0.5,           // Maximum particle speed
    boundaryRadius: 15,      // Size of the boundary sphere
    showGrid: true,          // Show grid
    paused: false,           // Pause simulation
    particleSize: 0.2,       // Size of particles
    fadeAmount: 0.05,        // Fade amount for trail effect
};

// Particle class
class Particle {
    constructor(position) {
        // Create geometry and material for the particle
        const geometry = new THREE.SphereGeometry(config.particleSize, 8, 8);
        
        // Create material with transparency for trail effect
        this.mesh = new THREE.Mesh(
            geometry, 
            new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.8
            })
        );
        
        // Set initial position
        this.mesh.position.copy(position);
        
        // Set initial velocity (will be updated by flow field)
        this.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.1
        );
        
        // Trail history
        this.history = [];
        
        // Add to scene
        scene.add(this.mesh);
    }
    
    // Update particle position based on flow field
    update(delta) {
        if (config.paused) return;
        
        // Get flow field vector for current position
        const flowVector = this.getFlowVector();
        
        // Apply flow vector to velocity
        this.velocity.add(flowVector.multiplyScalar(config.fieldStrength * delta));
        
        // Limit speed
        const speed = this.velocity.length();
        if (speed > config.maxSpeed) {
            this.velocity.multiplyScalar(config.maxSpeed / speed);
        }
        
        // Update position
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta * 60));
        
        // Check if particle is outside boundary
        this.enforceBoundary();
    }
    
    // Get flow vector from flow field
    getFlowVector() {
        // Get normalized position within flow field [-1, 1]
        const nx = (this.mesh.position.x / config.fieldSize) + 0.5;
        const ny = (this.mesh.position.y / config.fieldSize) + 0.5;
        const nz = (this.mesh.position.z / config.fieldSize) + 0.5;
        
        // Calculate flow field indices
        const size = config.fieldResolution;
        const x = Math.floor(THREE.MathUtils.clamp(nx * size, 0, size - 1));
        const y = Math.floor(THREE.MathUtils.clamp(ny * size, 0, size - 1));
        const z = Math.floor(THREE.MathUtils.clamp(nz * size, 0, size - 1));
        
        // Get flow vector (or return zero vector if out of bounds)
        const index = x + y * size + z * size * size;
        return (flowField[index] || new THREE.Vector3()).clone();
    }
    
    // Keep particles within boundary sphere
    enforceBoundary() {
        const distanceFromCenter = this.mesh.position.length();
        if (distanceFromCenter > config.boundaryRadius) {
            // Teleport to opposite side with slight offset to avoid getting stuck
            this.mesh.position.multiplyScalar(-0.9);
            
            // Add small random velocity
            this.velocity.add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1,
                (Math.random() - 0.5) * 0.1
            ));
        }
    }
    
    // Update particle material based on color scheme
    updateMaterial(colorScheme, index, total) {
        let color;
        
        switch (colorScheme) {
            case 'rainbow':
                // Distribute colors evenly across the rainbow
                color = new THREE.Color().setHSL(index / total, 1, 0.5);
                break;
                
            case 'gradient':
                // Gradient based on height (y-position)
                const height = (this.mesh.position.y + config.boundaryRadius) / (config.boundaryRadius * 2);
                color = new THREE.Color(0xff9500).lerp(new THREE.Color(0xaf52de), height);
                break;
                
            case 'speed':
                // Color based on particle speed
                const speed = this.velocity.length() / config.maxSpeed;
                color = new THREE.Color(0x0000ff).lerp(new THREE.Color(0xff0000), speed);
                break;
                
            default:
                color = new THREE.Color(0x0088ff);
        }
        
        this.mesh.material.color = color;
    }
    
    // Remove particle from scene
    dispose() {
        scene.remove(this.mesh);
        if (this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh.material) this.mesh.material.dispose();
    }
}

// Flow vector visualization
class FlowVector {
    constructor(position, direction) {
        // Create arrow helper to visualize flow direction
        const length = direction.length() * 2;
        this.arrow = new THREE.ArrowHelper(
            direction.clone().normalize(),
            position,
            length,
            0xffff00,
            0.3,
            0.2
        );
        
        this.position = position.clone();
        this.direction = direction.clone();
        
        // Add to scene
        scene.add(this.arrow);
    }
    
    // Update arrow direction
    update(direction) {
        this.direction.copy(direction);
        this.arrow.setDirection(direction.normalize());
        this.arrow.setLength(
            direction.length() * 2,
            0.3,
            0.2
        );
    }
    
    // Remove from scene
    dispose() {
        scene.remove(this.arrow);
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
    
    // Check if dark mode is active
    const isDarkMode = document.body.classList.contains('dark-mode');
    
    // Setup scene with appropriate background color
    scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x121212 : 0xffffff);
    
    // Create and add a grid helper
    gridHelper = new THREE.GridHelper(30, 30);
    scene.add(gridHelper);
    
    // Add axis helper
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
    
    // Generate flow field
    generateFlowField();
    
    // Create particles
    createParticles();
    
    // Setup event listeners
    setupEventListeners();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
    
    console.log("Flow field visualization initialized");
}

// Generate flow field vectors
function generateFlowField() {
    // Clear existing flow field
    flowField = [];
    
    // Get current time for animated flow field
    const time = clock.getElapsedTime() * config.noiseSpeed;
    
    // Generate flow field grid
    const size = config.fieldResolution;
    
    for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Normalize coordinates to [-1, 1]
                const nx = (x / size) * 2 - 1;
                const ny = (y / size) * 2 - 1;
                const nz = (z / size) * 2 - 1;
                
                // Calculate flow field vector
                // Using a curl noise function for more interesting flow
                
                // Simplified curl noise (based on sine functions)
                const scale = config.noiseScale;
                
                // Use sine functions to create a vector field
                const vx = Math.sin(ny * scale + time) * Math.cos(nz * scale + time);
                const vy = Math.sin(nz * scale + time) * Math.cos(nx * scale + time);
                const vz = Math.sin(nx * scale + time) * Math.cos(ny * scale + time);
                
                // Create vector and add to flow field
                const vector = new THREE.Vector3(vx, vy, vz).normalize().multiplyScalar(0.1);
                flowField.push(vector);
            }
        }
    }
    
    // If showing field vectors, update them
    if (config.showFieldVectors) {
        updateFlowVectors();
    }
}

// Create flow vector visualizations
function updateFlowVectors() {
    // Remove existing arrows
    if (window.flowVectors) {
        window.flowVectors.forEach(vector => vector.dispose());
    }
    
    // If not showing vectors, return
    if (!config.showFieldVectors) {
        window.flowVectors = [];
        return;
    }
    
    // Create new arrows
    window.flowVectors = [];
    
    // Number of vectors to show (reduced for performance)
    const visualizationResolution = 5;
    const size = visualizationResolution;
    
    for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Calculate position
                const nx = (x / (size - 1)) * 2 - 1;
                const ny = (y / (size - 1)) * 2 - 1;
                const nz = (z / (size - 1)) * 2 - 1;
                
                const position = new THREE.Vector3(
                    nx * config.fieldSize / 2,
                    ny * config.fieldSize / 2,
                    nz * config.fieldSize / 2
                );
                
                // Get flow vector for this position
                const fieldSize = config.fieldResolution;
                const fx = Math.floor(((nx + 1) / 2) * fieldSize);
                const fy = Math.floor(((ny + 1) / 2) * fieldSize);
                const fz = Math.floor(((nz + 1) / 2) * fieldSize);
                
                const index = Math.min(
                    fx + fy * fieldSize + fz * fieldSize * fieldSize,
                    flowField.length - 1
                );
                
                const direction = flowField[index].clone();
                
                // Create flow vector visualization
                const flowVector = new FlowVector(position, direction);
                window.flowVectors.push(flowVector);
            }
        }
    }
}

// Create particles with random positions
function createParticles() {
    // Remove existing particles
    particles.forEach(particle => particle.dispose());
    particles = [];
    
    // Create new particles
    for (let i = 0; i < config.numParticles; i++) {
        // Random position within boundary sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const radius = config.boundaryRadius * Math.cbrt(Math.random()); // Cube root for uniform distribution
        
        const position = new THREE.Vector3(
            radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.sin(phi) * Math.sin(theta),
            radius * Math.cos(phi)
        );
        
        // Create particle
        const particle = new Particle(position);
        particle.updateMaterial(config.colorScheme, i, config.numParticles);
        particles.push(particle);
    }
}

// Update particle materials based on color scheme
function updateParticleMaterials() {
    particles.forEach((particle, index) => {
        particle.updateMaterial(config.colorScheme, index, particles.length);
    });
}

// Function to toggle grid visibility
function toggleGrid() {
    config.showGrid = !config.showGrid;
    if (gridHelper) gridHelper.visible = config.showGrid;
    if (axisHelper) axisHelper.visible = config.showGrid;
}

// Function to toggle flow vectors
function toggleFlowVectors() {
    config.showFieldVectors = !config.showFieldVectors;
    updateFlowVectors();
}

// Function to toggle pause state
function togglePause() {
    config.paused = !config.paused;
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.textContent = config.paused ? 'Resume' : 'Pause';
    }
}

// Reset the simulation
function resetSimulation() {
    generateFlowField();
    createParticles();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Calculate delta time
    const delta = clock.getDelta();
    
    // Update controls
    controls.update();
    
    // Regenerate flow field periodically for animation
    if (!config.paused) {
        // Update flow field every second
        if (Math.floor(clock.getElapsedTime()) % 2 === 0 && 
            Math.floor(clock.getElapsedTime()) !== window.lastFlowUpdate) {
            window.lastFlowUpdate = Math.floor(clock.getElapsedTime());
            generateFlowField();
        }
        
        // Update particles
        particles.forEach(particle => {
            particle.update(delta);
            particle.updateMaterial(config.colorScheme, 0, 1);
        });
    }
    
    // Render scene
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
    // Number of particles slider
    const particlesSlider = document.getElementById('resolution');
    const particlesValue = document.getElementById('resolutionValue');
    
    if (particlesSlider && particlesValue) {
        // Change label
        const label = particlesSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Particles <span class="value-display" id="resolutionValue">${config.numParticles}</span>`;
        }
        
        particlesSlider.min = 100;
        particlesSlider.max = 2000;
        particlesSlider.step = 100;
        particlesSlider.value = config.numParticles;
        particlesValue.textContent = config.numParticles;
        
        particlesSlider.addEventListener('input', function() {
            config.numParticles = parseInt(this.value);
            particlesValue.textContent = config.numParticles;
            createParticles();
        });
    }
    
    // Field strength slider
    const fieldStrengthSlider = document.getElementById('isoLevel');
    const fieldStrengthValue = document.getElementById('isoLevelValue');
    
    if (fieldStrengthSlider && fieldStrengthValue) {
        // Change label
        const label = fieldStrengthSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Field Strength <span class="value-display" id="isoLevelValue">${config.fieldStrength.toFixed(1)}</span>`;
        }
        
        fieldStrengthSlider.min = 0.1;
        fieldStrengthSlider.max = 3.0;
        fieldStrengthSlider.step = 0.1;
        fieldStrengthSlider.value = config.fieldStrength;
        fieldStrengthValue.textContent = config.fieldStrength.toFixed(1);
        
        fieldStrengthSlider.addEventListener('input', function() {
            config.fieldStrength = parseFloat(this.value);
            fieldStrengthValue.textContent = config.fieldStrength.toFixed(1);
        });
    }
    
    // Noise scale slider
    const noiseScaleSlider = document.getElementById('scaleX');
    const noiseScaleValue = document.getElementById('scaleXValue');
    
    if (noiseScaleSlider && noiseScaleValue) {
        // Change label
        const label = noiseScaleSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Noise Scale <span class="value-display" id="scaleXValue">${config.noiseScale.toFixed(2)}</span>`;
        }
        
        noiseScaleSlider.min = 0.01;
        noiseScaleSlider.max = 0.5;
        noiseScaleSlider.step = 0.01;
        noiseScaleSlider.value = config.noiseScale;
        noiseScaleValue.textContent = config.noiseScale.toFixed(2);
        
        noiseScaleSlider.addEventListener('input', function() {
            config.noiseScale = parseFloat(this.value);
            noiseScaleValue.textContent = config.noiseScale.toFixed(2);
            generateFlowField();
        });
    }
    
    // Noise speed slider
    const noiseSpeedSlider = document.getElementById('scaleY');
    const noiseSpeedValue = document.getElementById('scaleYValue');
    
    if (noiseSpeedSlider && noiseSpeedValue) {
        // Change label
        const label = noiseSpeedSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Noise Speed <span class="value-display" id="scaleYValue">${config.noiseSpeed.toFixed(2)}</span>`;
        }
        
        noiseSpeedSlider.min = 0.01;
        noiseSpeedSlider.max = 1.0;
        noiseSpeedSlider.step = 0.01;
        noiseSpeedSlider.value = config.noiseSpeed;
        noiseSpeedValue.textContent = config.noiseSpeed.toFixed(2);
        
        noiseSpeedSlider.addEventListener('input', function() {
            config.noiseSpeed = parseFloat(this.value);
            noiseSpeedValue.textContent = config.noiseSpeed.toFixed(2);
        });
    }
    
    // Particle size slider
    const particleSizeSlider = document.getElementById('scaleZ');
    const particleSizeValue = document.getElementById('scaleZValue');
    
    if (particleSizeSlider && particleSizeValue) {
        // Change label
        const label = particleSizeSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Particle Size <span class="value-display" id="scaleZValue">${config.particleSize.toFixed(2)}</span>`;
        }
        
        particleSizeSlider.min = 0.05;
        particleSizeSlider.max = 0.5;
        particleSizeSlider.step = 0.05;
        particleSizeSlider.value = config.particleSize;
        particleSizeValue.textContent = config.particleSize.toFixed(2);
        
        particleSizeSlider.addEventListener('input', function() {
            config.particleSize = parseFloat(this.value);
            particleSizeValue.textContent = config.particleSize.toFixed(2);
            createParticles();
        });
    }
    
    // Color scheme selector
    const colorSchemeSelect = document.getElementById('colorScheme');
    
    if (colorSchemeSelect) {
        // Add option for speed-based coloring
        const speedOption = document.createElement('option');
        speedOption.value = 'speed';
        speedOption.textContent = 'Speed';
        colorSchemeSelect.appendChild(speedOption);
        
        colorSchemeSelect.value = config.colorScheme;
        
        colorSchemeSelect.addEventListener('change', function() {
            config.colorScheme = this.value;
            updateParticleMaterials();
        });
    }
    
    // Max speed slider
    const maxSpeedSlider = document.getElementById('rotationSpeed');
    const maxSpeedValue = document.getElementById('rotationSpeedValue');
    
    if (maxSpeedSlider && maxSpeedValue) {
        // Change label
        const label = maxSpeedSlider.previousElementSibling;
        if (label && label.tagName === 'LABEL') {
            label.innerHTML = `Max Speed <span class="value-display" id="rotationSpeedValue">${config.maxSpeed.toFixed(1)}</span>`;
        }
        
        maxSpeedSlider.min = 0.1;
        maxSpeedSlider.max = 1.0;
        maxSpeedSlider.step = 0.1;
        maxSpeedSlider.value = config.maxSpeed;
        maxSpeedValue.textContent = config.maxSpeed.toFixed(1);
        
        maxSpeedSlider.addEventListener('input', function() {
            config.maxSpeed = parseFloat(this.value);
            maxSpeedValue.textContent = config.maxSpeed.toFixed(1);
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
    
    // Add a button for toggling flow vectors
    const flowVectorsBtn = document.getElementById('debugBtn');
    if (flowVectorsBtn) {
        flowVectorsBtn.textContent = 'Toggle Vectors';
        flowVectorsBtn.addEventListener('click', toggleFlowVectors);
    }
}

// Initialize the visualization once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for potential external use
window.flowFieldSimulation = {
    reset: resetSimulation,
    togglePause: togglePause,
    toggleGrid: toggleGrid,
    toggleFlowVectors: toggleFlowVectors
};