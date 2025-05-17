// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let particles = [];
let trailsGroup;
let clock = new THREE.Clock();
let noiseOffset = 0;

// Configuration parameters
let config = {
    numParticles: 1000,        // Number of particles
    noiseScale: 0.1,           // Scale of Perlin noise
    noiseSpeed: 0.2,           // Speed of noise evolution
    particleSpeed: 0.3,        // Base speed of particles
    boundaryRadius: 100,       // Size of the boundary sphere
    colorScheme: 'flow',       // Default color scheme
    showTrails: true,          // Whether to show particle trails
    paused: false,             // Whether the simulation is paused
    useZFlow: true,            // Use 3D (true) or 2D (false) flow
    particleSize: 0.5,         // Size of particles
    maxTrailPoints: 100,       // Maximum trail points per particle
    timeScale: 1.0,            // Simulation speed multiplier
    respawnAtBoundary: true,   // Respawn particles at boundary instead of bouncing
    turbulence: 0.5            // Amount of turbulence/randomness
};

// Helper function for Perlin noise (simplified implementation)
class PerlinNoise {
    constructor() {
        this.gradients = {};
        this.memory = {};
    }
    
    seed() {
        this.gradients = {};
        this.memory = {};
    }
    
    dot(ix, iy, iz, x, y, z) {
        // Create a random gradient vector
        const key = ix + "," + iy + "," + iz;
        let gradient;
        
        if (this.gradients[key]) {
            gradient = this.gradients[key];
        } else {
            // Random gradient
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            const x = Math.sin(phi) * Math.cos(theta);
            const y = Math.sin(phi) * Math.sin(theta);
            const z = Math.cos(phi);
            
            gradient = [x, y, z];
            this.gradients[key] = gradient;
        }
        
        // Calculate dot product
        return gradient[0] * x + gradient[1] * y + gradient[2] * z;
    }
    
    smootherstep(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    
    lerp(a, b, t) {
        return a + t * (b - a);
    }
    
    noise3D(x, y, z) {
        // Cache check
        const key = x + "," + y + "," + z;
        if (this.memory[key]) return this.memory[key];
        
        // Calculate grid coordinates
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const iz = Math.floor(z);
        
        // Relative coordinates
        const rx = x - ix;
        const ry = y - iy;
        const rz = z - iz;
        
        // Calculate dot products for all corners
        const n000 = this.dot(ix, iy, iz, rx, ry, rz);
        const n001 = this.dot(ix, iy, iz + 1, rx, ry, rz - 1);
        const n010 = this.dot(ix, iy + 1, iz, rx, ry - 1, rz);
        const n011 = this.dot(ix, iy + 1, iz + 1, rx, ry - 1, rz - 1);
        const n100 = this.dot(ix + 1, iy, iz, rx - 1, ry, rz);
        const n101 = this.dot(ix + 1, iy, iz + 1, rx - 1, ry, rz - 1);
        const n110 = this.dot(ix + 1, iy + 1, iz, rx - 1, ry - 1, rz);
        const n111 = this.dot(ix + 1, iy + 1, iz + 1, rx - 1, ry - 1, rz - 1);
        
        // Smooth interpolation
        const wx = this.smootherstep(rx);
        const wy = this.smootherstep(ry);
        const wz = this.smootherstep(rz);
        
        // Interpolate along x
        const nx00 = this.lerp(n000, n100, wx);
        const nx01 = this.lerp(n001, n101, wx);
        const nx10 = this.lerp(n010, n110, wx);
        const nx11 = this.lerp(n011, n111, wx);
        
        // Interpolate along y
        const nxy0 = this.lerp(nx00, nx10, wy);
        const nxy1 = this.lerp(nx01, nx11, wy);
        
        // Interpolate along z
        const nxyz = this.lerp(nxy0, nxy1, wz);
        
        // Cache and return result
        this.memory[key] = nxyz;
        return nxyz;
    }
    
    // Fractal/Turbulence noise
    fractal3D(x, y, z, octaves, persistence) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;
        
        for (let i = 0; i < octaves; i++) {
            total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= 2;
        }
        
        // Return normalized value
        return total / maxValue;
    }
}

// Initialize noise generator
const perlin = new PerlinNoise();
perlin.seed();

// FlowParticle class
class FlowParticle {
    constructor(position, size) {
        // Create geometry and material for the particle
        const geometry = new THREE.SphereGeometry(size, 8, 6);
        
        // Material will be set based on config
        this.mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
        
        // Set initial position
        this.mesh.position.copy(position);
        
        // Set properties
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.acceleration = new THREE.Vector3(0, 0, 0);
        this.age = 0;
        this.lifetime = Math.random() * 5 + 5; // Random lifetime
        this.originalSize = size;
        
        // Initialize trails if enabled
        if (config.showTrails) {
            this.initTrail();
        }
        
        // Add to scene
        scene.add(this.mesh);
    }
    
    // Initialize particle trail
    initTrail() {
        // Create line material
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
    
    // Update particle position and trails
    update(delta) {
        if (config.paused) return;
        
        // Increase age
        this.age += delta * config.timeScale;
        
        // Get position for perlin noise sampling
        const pos = this.mesh.position;
        
        // Calculate flow direction using Perlin noise
        const scaledX = pos.x * config.noiseScale;
        const scaledY = pos.y * config.noiseScale;
        const scaledZ = pos.z * config.noiseScale;
        // Add time dimension to animate the flow field
        const timeOffset = noiseOffset * config.noiseSpeed;
        
        // Get flow direction from noise
        let flowX, flowY, flowZ;
        
        if (config.useZFlow) {
            // Full 3D flow
            flowX = perlin.fractal3D(scaledX, scaledY, scaledZ + timeOffset, 4, 0.5) * 2 - 1;
            flowY = perlin.fractal3D(scaledX + 100, scaledY, scaledZ + timeOffset, 4, 0.5) * 2 - 1;
            flowZ = perlin.fractal3D(scaledX, scaledY + 100, scaledZ + timeOffset, 4, 0.5) * 2 - 1;
        } else {
            // 2D flow (consistent Z direction)
            flowX = perlin.fractal3D(scaledX, scaledY, timeOffset, 4, 0.5) * 2 - 1;
            flowY = perlin.fractal3D(scaledX + 100, scaledY, timeOffset, 4, 0.5) * 2 - 1;
            flowZ = perlin.fractal3D(scaledX, scaledY + 100, timeOffset, 4, 0.5) * 0.5 - 0.25; // Reduced vertical flow
        }
        
        // Add some turbulence/randomness
        if (config.turbulence > 0) {
            flowX += (Math.random() * 2 - 1) * config.turbulence * 0.1;
            flowY += (Math.random() * 2 - 1) * config.turbulence * 0.1;
            flowZ += (Math.random() * 2 - 1) * config.turbulence * 0.1;
        }
        
        // Set acceleration based on flow field
        this.acceleration.set(flowX, flowY, flowZ);
        
        // Update velocity: v = v + a*t
        this.velocity.add(this.acceleration.multiplyScalar(delta * config.timeScale));
        
        // Limit speed
        const speed = this.velocity.length();
        const maxSpeed = config.particleSpeed;
        if (speed > maxSpeed) {
            this.velocity.multiplyScalar(maxSpeed / speed);
        }
        
        // Update position: p = p + v*t
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta * config.timeScale));
        
        // Check boundary
        this.checkBoundary();
        
        // Update trail if enabled
        if (config.showTrails && this.trail) {
            this.updateTrail();
        }
        
        // Fade out particle as it ages
        if (this.age > this.lifetime * 0.7) {
            const fadeRatio = 1 - ((this.age - this.lifetime * 0.7) / (this.lifetime * 0.3));
            this.mesh.material.opacity = fadeRatio;
            if (this.trail) {
                this.trail.material.opacity = fadeRatio * 0.5;
            }
        }
        
        // Respawn if exceeding lifetime
        if (this.age > this.lifetime) {
            this.respawn();
        }
    }
    
    // Check if particle is outside boundary
    checkBoundary() {
        const distanceFromCenter = this.mesh.position.length();
        
        if (distanceFromCenter > config.boundaryRadius) {
            if (config.respawnAtBoundary) {
                this.respawn();
            } else {
                // Bounce off boundary
                const toCenter = new THREE.Vector3().subVectors(
                    new THREE.Vector3(0, 0, 0),
                    this.mesh.position
                );
                
                toCenter.normalize();
                
                // Reflect velocity
                const dot = this.velocity.dot(toCenter);
                this.velocity.sub(toCenter.multiplyScalar(2 * dot));
                
                // Move inside boundary
                this.mesh.position.normalize().multiplyScalar(config.boundaryRadius * 0.95);
            }
        }
    }
    
    // Update trail visualization
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
    
    // Respawn particle at a new random position
    respawn() {
        // Random position within sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = config.boundaryRadius * Math.cbrt(Math.random()) * 0.8; // Cube root for uniform distribution
        
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);
        
        this.mesh.position.set(x, y, z);
        this.velocity.set(0, 0, 0);
        this.age = 0;
        this.lifetime = Math.random() * 5 + 5;
        
        // Reset opacity
        this.mesh.material.opacity = 1.0;
        if (this.trail) {
            this.trail.material.opacity = 0.5;
        }
        
        // Reset trail
        if (this.trail) {
            for (let i = 0; i < config.maxTrailPoints; i++) {
                const idx = i * 3;
                this.trailPositions[idx] = x;
                this.trailPositions[idx + 1] = y;
                this.trailPositions[idx + 2] = z;
            }
            this.trailIndex = 1;
            this.trail.geometry.attributes.position.needsUpdate = true;
        }
        
        // Update color based on new position
        this.updateMaterial(config.colorScheme);
    }
    
    // Update the particle's material based on color scheme
    updateMaterial(colorscheme) {
        let color;
        
        switch (colorscheme) {
            case 'flow':
                // Color based on flow direction (velocity)
                const vx = this.velocity.x / config.particleSpeed * 0.5 + 0.5;
                const vy = this.velocity.y / config.particleSpeed * 0.5 + 0.5;
                const vz = this.velocity.z / config.particleSpeed * 0.5 + 0.5;
                color = new THREE.Color(vx, vy, vz);
                break;
                
            case 'position':
                // Color based on position in space
                const px = (this.mesh.position.x / config.boundaryRadius * 0.5 + 0.5);
                const py = (this.mesh.position.y / config.boundaryRadius * 0.5 + 0.5);
                const pz = (this.mesh.position.z / config.boundaryRadius * 0.5 + 0.5);
                color = new THREE.Color(px, py, pz);
                break;
                
            case 'age':
                // Color based on particle age
                const ageRatio = this.age / this.lifetime;
                if (ageRatio < 0.33) {
                    color = new THREE.Color(0x0088ff).lerp(new THREE.Color(0x00ffff), ageRatio * 3);
                } else if (ageRatio < 0.66) {
                    color = new THREE.Color(0x00ffff).lerp(new THREE.Color(0xffff00), (ageRatio - 0.33) * 3);
                } else {
                    color = new THREE.Color(0xffff00).lerp(new THREE.Color(0xff0088), (ageRatio - 0.66) * 3);
                }
                break;
                
            case 'noise':
                // Color based on noise value at position
                const noiseVal = (perlin.fractal3D(
                    this.mesh.position.x * config.noiseScale * 2,
                    this.mesh.position.y * config.noiseScale * 2,
                    this.mesh.position.z * config.noiseScale * 2,
                    3, 0.5
                ) * 0.5 + 0.5);
                
                if (noiseVal < 0.33) {
                    color = new THREE.Color(0x0000ff).lerp(new THREE.Color(0x00ffff), noiseVal * 3);
                } else if (noiseVal < 0.66) {
                    color = new THREE.Color(0x00ffff).lerp(new THREE.Color(0xffff00), (noiseVal - 0.33) * 3);
                } else {
                    color = new THREE.Color(0xffff00).lerp(new THREE.Color(0xff0000), (noiseVal - 0.66) * 3);
                }
                break;
                
            default:
                // Default color - magenta to cyan gradient
                color = new THREE.Color(0xff00ff).lerp(
                    new THREE.Color(0x00ffff),
                    Math.random()
                );
        }
        
        // Apply the color
        this.mesh.material.color.copy(color);
        
        // Update trail color if it exists
        if (this.trail) {
            this.trail.material.color.copy(color);
        }
    }
    
    // Remove particle and associated objects
    dispose() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        
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
        document.body.appendChild(renderer.domElement);
    }
    
    // Setup scene with background color
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000814);
    
    // Create group for trails
    trailsGroup = new THREE.Group();
    scene.add(trailsGroup);
    
    // Add grid helper
    const gridHelper = new THREE.GridHelper(config.boundaryRadius * 2, 20, 0x222222, 0x111111);
    scene.add(gridHelper);
    
    // Add boundary sphere (transparent)
    const boundaryGeometry = new THREE.SphereGeometry(config.boundaryRadius, 32, 16);
    const boundaryMaterial = new THREE.MeshBasicMaterial({
        color: 0x222222,
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
    
    // Create particles
    createParticles();
    
    // Setup event listeners if UI is not manually created in HTML
    if (!document.getElementById('resetBtn')) {
        createUI();
    }
    
    // Setup event listeners
    setupEventListeners();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
    
    // Update statistics
    updateStats();
    
    console.log("Perlin flow field simulation initialized");
}

// Toggle trails
function toggleTrails() {
    config.showTrails = !config.showTrails;
    trailsGroup.visible = config.showTrails;
    
    // Regenerate trails if turning on
    if (config.showTrails) {
        particles.forEach(particle => {
            if (!particle.trail) {
                particle.initTrail();
            }
        });
    }
    
    // Update button text
    const trailsBtn = document.getElementById('trailsBtn');
    if (trailsBtn) {
        trailsBtn.textContent = config.showTrails ? 'Hide Trails' : 'Show Trails';
    }
}

// Create particles
function createParticles() {
    // Remove existing particles
    particles.forEach(particle => particle.dispose());
    particles = [];
    
    // Clear trails group
    while(trailsGroup.children.length > 0) {
        const trail = trailsGroup.children[0];
        trailsGroup.remove(trail);
        trail.geometry.dispose();
        trail.material.dispose();
    }
    
    // Create new particles
    for (let i = 0; i < config.numParticles; i++) {
        // Random position within sphere
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = config.boundaryRadius * Math.cbrt(Math.random()) * 0.8; // Cube root for uniform distribution
        
        const position = new THREE.Vector3(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta),
            r * Math.cos(phi)
        );
        
        // Create particle
        const particle = new FlowParticle(position, config.particleSize);
        
        // Set initial color based on color scheme
        particle.updateMaterial(config.colorScheme);
        
        particles.push(particle);
    }
    
    // Update statistics
    updateStats();
}

// Update particle materials based on color scheme
function updateParticleMaterials() {
    particles.forEach(particle => {
        particle.updateMaterial(config.colorScheme);
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Calculate delta time
    const delta = clock.getDelta();
    
    // Update controls
    controls.update();
    
    // Increment noise offset (time dimension)
    if (!config.paused) {
        noiseOffset += delta * config.timeScale;
    }
    
    // Update particles
    if (!config.paused) {
        particles.forEach(particle => particle.update(delta));
        
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
        statsElement.textContent = `Particles: ${particles.length} | Iterations: ${config.iterations || 0}`;
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
    createParticles();
    config.iterations = 0;
    noiseOffset = 0;
    updateStats();
}

// Toggle flow dimension (2D vs 3D)
function toggleFlowDimension() {
    config.useZFlow = !config.useZFlow;
    const flowDimBtn = document.getElementById('flowDimBtn');
    if (flowDimBtn) {
        flowDimBtn.textContent = config.useZFlow ? '3D Flow' : '2D Flow';
    }
}

// Setup event listeners for UI controls
function setupEventListeners() {
    // Button event listeners
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', togglePause);
    }
    
    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetSimulation);
    }
    
    const trailsBtn = document.getElementById('trailsBtn');
    if (trailsBtn) {
        trailsBtn.addEventListener('click', toggleTrails);
    }
    
    const flowDimBtn = document.getElementById('flowDimBtn');
    if (flowDimBtn) {
        flowDimBtn.addEventListener('click', toggleFlowDimension);
    }
    
    const seedBtn = document.getElementById('seedBtn');
    if (seedBtn) {
        seedBtn.addEventListener('click', () => {
            perlin.seed();
        });
    }
    
    // Slider event listeners
    const particlesSlider = document.getElementById('particles');
    if (particlesSlider) {
        particlesSlider.addEventListener('input', function() {
            config.numParticles = parseInt(this.value);
            document.getElementById('particlesValue').textContent = config.numParticles;
        });
        
        particlesSlider.addEventListener('change', function() {
            resetSimulation();
        });
    }
    
    const noiseScaleSlider = document.getElementById('noiseScale');
    if (noiseScaleSlider) {
        noiseScaleSlider.addEventListener('input', function() {
            config.noiseScale = parseFloat(this.value);
            document.getElementById('noiseScaleValue').textContent = config.noiseScale.toFixed(2);
        });
    }
    
    const noiseSpeedSlider = document.getElementById('noiseSpeed');
    if (noiseSpeedSlider) {
        noiseSpeedSlider.addEventListener('input', function() {
            config.noiseSpeed = parseFloat(this.value);
            document.getElementById('noiseSpeedValue').textContent = config.noiseSpeed.toFixed(2);
        });
    }
    
    const particleSpeedSlider = document.getElementById('particleSpeed');
    if (particleSpeedSlider) {
        particleSpeedSlider.addEventListener('input', function() {
            config.particleSpeed = parseFloat(this.value);
            document.getElementById('particleSpeedValue').textContent = config.particleSpeed.toFixed(1);
        });
    }
    
    const particleSizeSlider = document.getElementById('particleSize');
    if (particleSizeSlider) {
        particleSizeSlider.addEventListener('input', function() {
            config.particleSize = parseFloat(this.value);
            document.getElementById('particleSizeValue').textContent = config.particleSize.toFixed(1);
        });
        
        particleSizeSlider.addEventListener('change', function() {
            resetSimulation();
        });
    }
    
    const turbulenceSlider = document.getElementById('turbulence');
    if (turbulenceSlider) {
        turbulenceSlider.addEventListener('input', function() {
            config.turbulence = parseFloat(this.value);
            document.getElementById('turbulenceValue').textContent = config.turbulence.toFixed(2);
        });
    }
    
    const timeScaleSlider = document.getElementById('timeScale');
    if (timeScaleSlider) {
        timeScaleSlider.addEventListener('input', function() {
            config.timeScale = parseFloat(this.value);
            document.getElementById('timeScaleValue').textContent = config.timeScale.toFixed(1);
        });
    }
    
    // Dropdown event listeners
    const colorSchemeSelect = document.getElementById('colorScheme');
    if (colorSchemeSelect) {
        colorSchemeSelect.addEventListener('change', function() {
            config.colorScheme = this.value;
            updateParticleMaterials();
        });
    }
    
    const boundarySelect = document.getElementById('boundaryMode');
    if (boundarySelect) {
        boundarySelect.addEventListener('change', function() {
            config.respawnAtBoundary = this.value === 'respawn';
        });
    }
}

// Create UI elements programmatically if not in HTML
function createUI() {
    // Create UI container
    const uiContainer = document.createElement('div');
    uiContainer.id = 'ui-container';
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '10px';
    uiContainer.style.left = '10px';
    uiContainer.style.padding = '10px';
    uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    uiContainer.style.color = 'white';
    uiContainer.style.fontFamily = 'Arial, sans-serif';
    uiContainer.style.borderRadius = '5px';
    uiContainer.style.zIndex = '100';
    uiContainer.style.maxWidth = '300px';
    document.body.appendChild(uiContainer);
    
    // Add title
    const title = document.createElement('h2');
    title.textContent = 'Flow Field Controls';
    title.style.margin = '0 0 10px 0';
    uiContainer.appendChild(title);
    
    // Add stats display
    const stats = document.createElement('div');
    stats.id = 'stats';
    stats.style.marginBottom = '10px';
    uiContainer.appendChild(stats);
    
    // Add control buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'grid';
    buttonContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
    buttonContainer.style.gap = '5px';
    buttonContainer.style.marginBottom = '10px';
    uiContainer.appendChild(buttonContainer);
    
    // Pause button
    const pauseBtn = document.createElement('button');
    pauseBtn.id = 'pauseBtn';
    pauseBtn.textContent = 'Pause';
    pauseBtn.style.padding = '5px';
    buttonContainer.appendChild(pauseBtn);
    
    // Reset button
    const resetBtn = document.createElement('button');
    resetBtn.id = 'resetBtn';
    resetBtn.textContent = 'Reset';
    resetBtn.style.padding = '5px';
    buttonContainer.appendChild(resetBtn);
    
    // Trails button
    const trailsBtn = document.createElement('button');
    trailsBtn.id = 'trailsBtn';
    trailsBtn.textContent = config.showTrails ? 'Hide Trails' : 'Show Trails';
    trailsBtn.style.padding = '5px';
    buttonContainer.appendChild(trailsBtn);
    
    // Flow dimension button
    const flowDimBtn = document.createElement('button');
    flowDimBtn.id = 'flowDimBtn';
    flowDimBtn.textContent = config.useZFlow ? '3D Flow' : '2D Flow';
    flowDimBtn.style.padding = '5px';
    buttonContainer.appendChild(flowDimBtn);
    
    // Seed button
    const seedBtn = document.createElement('button');
    seedBtn.id = 'seedBtn';
    seedBtn.textContent = 'New Noise Seed';
    seedBtn.style.padding = '5px';
    seedBtn.style.gridColumn = 'span 2';
    buttonContainer.appendChild(seedBtn);
    
    // Add sliders container
    const slidersContainer = document.createElement('div');
    uiContainer.appendChild(slidersContainer);
    
    // Function to create a slider with label
    function createSlider(id, label, min, max, step, value) {
        const container = document.createElement('div');
        container.style.marginBottom = '10px';
        
        const labelElement = document.createElement('label');
        labelElement.htmlFor = id;
        labelElement.textContent = label + ': ';
        
        const valueDisplay = document.createElement('span');
        valueDisplay.id = id + 'Value';
        valueDisplay.textContent = value;
        labelElement.appendChild(valueDisplay);
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = id;
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = value;
        slider.style.width = '100%';
        
        container.appendChild(labelElement);
        container.appendChild(slider);
        
        return container;
    }
    
    // Add sliders
    slidersContainer.appendChild(createSlider('particles', 'Particles', 100, 5000, 100, config.numParticles));
    slidersContainer.appendChild(createSlider('noiseScale', 'Noise Scale', 0.01, 0.5, 0.01, config.noiseScale));
    slidersContainer.appendChild(createSlider('noiseSpeed', 'Noise Speed', 0.01, 1.0, 0.01, config.noiseSpeed));
    slidersContainer.appendChild(createSlider('particleSpeed', 'Particle Speed', 0.1, 2.0, 0.1, config.particleSpeed));
    slidersContainer.appendChild(createSlider('particleSize', 'Particle Size', 0.1, 2.0, 0.1, config.particleSize));
    slidersContainer.appendChild(createSlider('turbulence', 'Turbulence', 0, 1.0, 0.05, config.turbulence));
    slidersContainer.appendChild(createSlider('timeScale', 'Time Scale', 0.1, 3.0, 0.1, config.timeScale));
    
    // Add dropdowns
    const colorSchemeContainer = document.createElement('div');
    colorSchemeContainer.style.marginBottom = '10px';
    
    const colorSchemeLabel = document.createElement('label');
    colorSchemeLabel.htmlFor = 'colorScheme';
    colorSchemeLabel.textContent = 'Color Scheme: ';
    
    const colorSchemeSelect = document.createElement('select');
    colorSchemeSelect.id = 'colorScheme';
    colorSchemeSelect.style.width = '100%';
    colorSchemeSelect.style.marginTop = '5px';
    
    const colorSchemes = ['flow', 'position', 'age', 'noise'];
    colorSchemes.forEach(scheme => {
        const option = document.createElement('option');
        option.value = scheme;
        option.textContent = scheme.charAt(0).toUpperCase() + scheme.slice(1);
        if (scheme === config.colorScheme) {
            option.selected = true;
        }
        colorSchemeSelect.appendChild(option);
    });
    
    colorSchemeContainer.appendChild(colorSchemeLabel);
    colorSchemeContainer.appendChild(colorSchemeSelect);
    slidersContainer.appendChild(colorSchemeContainer);
    
    // Boundary behavior dropdown
    const boundaryContainer = document.createElement('div');
    boundaryContainer.style.marginBottom = '10px';
    
    const boundaryLabel = document.createElement('label');
    boundaryLabel.htmlFor = 'boundaryMode';
    boundaryLabel.textContent = 'Boundary Behavior: ';
    
    const boundarySelect = document.createElement('select');
    boundarySelect.id = 'boundaryMode';
    boundarySelect.style.width = '100%';
    boundarySelect.style.marginTop = '5px';
    
    const respawnOption = document.createElement('option');
    respawnOption.value = 'respawn';
    respawnOption.textContent = 'Respawn';
    respawnOption.selected = config.respawnAtBoundary;
    boundarySelect.appendChild(respawnOption);
    
    const bounceOption = document.createElement('option');
    bounceOption.value = 'bounce';
    bounceOption.textContent = 'Bounce';
    bounceOption.selected = !config.respawnAtBoundary;
    boundarySelect.appendChild(bounceOption);
    
    boundaryContainer.appendChild(boundaryLabel);
    boundaryContainer.appendChild(boundarySelect);
    slidersContainer.appendChild(boundaryContainer);
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', function() {
    init();
    // Start the animation loop
    animate();
});

// Call init if document is already loaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
}