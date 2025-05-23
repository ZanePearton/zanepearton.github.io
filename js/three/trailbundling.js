
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

// Core variables
let renderer, scene, camera, controls;
let boids = [];
let gridHelper, boundaryBox;
let clock = new THREE.Clock();
let frameCount = 0;
let lastFPS = 0;

// Configuration
let config = {
    numBoids: 80,
    maxSpeed: 2.0,
    boundarySize: 15,
    showGrid: true,
    showTrails: true,
    paused: false,

    // Swarm-based edge bundling
    edgeBundling: true,
    bundlingMode: 'realtime', // realtime, static, hybrid, magnetic
    bundlingStrength: 0.8,
    bundlingRadius: 4.0,
    velocityWeight: 0.6,
    densityThreshold: 3,
    smoothingFactor: 0.3,
    bundlingIterations: 2,
    adaptiveBundling: false,
    hierarchicalBundling: false,
    trailDecay: 0.02,
    magneticForce: 0.5,

    // Trail visualization
    trailLength: 60,
    trailOpacity: 0.8,
    colorScheme: 'velocity'
};

// Simple OrbitControls
class OrbitControls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        this.enabled = true;
        this.enableDamping = true;
        this.dampingFactor = 0.1;

        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        this.target = new THREE.Vector3();
        this.offset = new THREE.Vector3();

        this.isDown = false;
        this.rotateSpeed = 1.0;
        this.lastPosition = new THREE.Vector2();

        this.setupEventListeners();
        this.update();
    }

    setupEventListeners() {
        this.domElement.addEventListener('mousedown', (e) => {
            this.isDown = true;
            this.lastPosition.set(e.clientX, e.clientY);
        });

        this.domElement.addEventListener('mousemove', (e) => {
            if (!this.isDown) return;

            const deltaX = e.clientX - this.lastPosition.x;
            const deltaY = e.clientY - this.lastPosition.y;

            this.sphericalDelta.theta -= deltaX * 0.01 * this.rotateSpeed;
            this.sphericalDelta.phi -= deltaY * 0.01 * this.rotateSpeed;

            this.lastPosition.set(e.clientX, e.clientY);
        });

        this.domElement.addEventListener('mouseup', () => {
            this.isDown = false;
        });

        this.domElement.addEventListener('wheel', (e) => {
            const scale = e.deltaY > 0 ? 1.1 : 0.9;
            this.camera.position.multiplyScalar(scale);
        });
    }

    update() {
        this.offset.copy(this.camera.position).sub(this.target);
        this.spherical.setFromVector3(this.offset);

        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;

        this.spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi));

        this.offset.setFromSpherical(this.spherical);
        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.target);

        if (this.enableDamping) {
            this.sphericalDelta.theta *= (1 - this.dampingFactor);
            this.sphericalDelta.phi *= (1 - this.dampingFactor);
        }
    }
}

// Enhanced Trail class with swarm-based bundling
class SwarmTrail {
    constructor(boid, color) {
        this.boid = boid;
        this.originalPositions = [];
        this.bundledPositions = [];
        this.velocities = [];
        this.densities = [];
        this.bundlingWeights = [];

        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: config.trailOpacity,
            vertexColors: true
        });
        this.line = new THREE.Line(this.geometry, this.material);
        scene.add(this.line);

        this.lastBundleTime = 0;
        this.bundleInterval = 1000 / 30; // 30 FPS for bundling updates
    }

    addPoint(position, velocity) {
        this.originalPositions.push(position.clone());
        this.velocities.push(velocity.clone());
        this.densities.push(0);
        this.bundlingWeights.push(0);

        // Limit trail length
        if (this.originalPositions.length > config.trailLength) {
            this.originalPositions.shift();
            this.velocities.shift();
            this.densities.shift();
            this.bundlingWeights.shift();
        }

        // Apply decay to older points
        for (let i = 0; i < this.originalPositions.length - 1; i++) {
            const age = (this.originalPositions.length - 1 - i) / this.originalPositions.length;
            this.bundlingWeights[i] *= (1 - config.trailDecay * age);
        }
    }

    // Swarm-based real-time bundling
    updateSwarmBundling(allBoids, currentTime) {
        if (!config.edgeBundling) {
            this.bundledPositions = [...this.originalPositions];
            this.updateGeometry();
            return;
        }

        if (currentTime - this.lastBundleTime < this.bundleInterval) return;
        this.lastBundleTime = currentTime;

        this.bundledPositions = [];

        for (let i = 0; i < this.originalPositions.length; i++) {
            const currentPos = this.originalPositions[i].clone();
            const currentVel = this.velocities[i] || new THREE.Vector3();

            let bundlingForce = new THREE.Vector3();
            let totalInfluence = 0;
            let localDensity = 0;

            // Find nearby trails and calculate swarm influence
            allBoids.forEach(otherBoid => {
                if (otherBoid === this.boid) return;

                const otherTrail = otherBoid.trail;
                if (!otherTrail || !otherTrail.originalPositions) return;

                // Find closest point on other trail
                let closestPoint = null;
                let closestVelocity = null;
                let minDistance = Infinity;

                for (let j = 0; j < otherTrail.originalPositions.length; j++) {
                    const distance = currentPos.distanceTo(otherTrail.originalPositions[j]);
                    if (distance < minDistance && distance < config.bundlingRadius) {
                        minDistance = distance;
                        closestPoint = otherTrail.originalPositions[j];
                        closestVelocity = otherTrail.velocities[j] || new THREE.Vector3();
                        localDensity++;
                    }
                }

                if (closestPoint && minDistance < config.bundlingRadius) {
                    // Distance-based weight
                    const distanceWeight = 1.0 - (minDistance / config.bundlingRadius);

                    // Velocity alignment weight
                    const velocityAlignment = currentVel.dot(closestVelocity) /
                        (currentVel.length() * closestVelocity.length() + 0.001);
                    const velocityWeight = (velocityAlignment + 1) * 0.5; // Normalize to 0-1

                    // Combined weight
                    const influence = distanceWeight *
                        (1 - config.velocityWeight + config.velocityWeight * velocityWeight);

                    if (influence > 0) {
                        const attraction = new THREE.Vector3()
                            .subVectors(closestPoint, currentPos)
                            .multiplyScalar(influence);
                        bundlingForce.add(attraction);
                        totalInfluence += influence;
                    }
                }
            });

            // Store density for visualization
            this.densities[i] = localDensity;

            // Apply bundling based on mode
            if (totalInfluence > 0 && localDensity >= config.densityThreshold) {
                bundlingForce.divideScalar(totalInfluence);

                let bundlingStrength = config.bundlingStrength;

                // Adaptive bundling strength based on density
                if (config.adaptiveBundling) {
                    bundlingStrength *= Math.min(localDensity / config.densityThreshold, 2.0);
                }

                // Apply different bundling modes
                switch (config.bundlingMode) {
                    case 'realtime':
                        bundlingForce.multiplyScalar(bundlingStrength);
                        break;
                    case 'magnetic':
                        // Magnetic attraction with falloff
                        const magneticStrength = config.magneticForce / (1 + localDensity * 0.1);
                        bundlingForce.multiplyScalar(bundlingStrength * magneticStrength);
                        break;
                    case 'hybrid':
                        // Combine velocity-based and position-based bundling
                        const velocityComponent = currentVel.clone().normalize().multiplyScalar(0.3);
                        bundlingForce.add(velocityComponent);
                        bundlingForce.multiplyScalar(bundlingStrength * 0.8);
                        break;
                    default:
                        bundlingForce.multiplyScalar(bundlingStrength);
                }

                // Smooth the bundling force
                if (i > 0 && this.bundlingWeights[i - 1] > 0) {
                    const prevForce = this.bundledPositions[i - 1].clone().sub(this.originalPositions[i - 1]);
                    bundlingForce.lerp(prevForce, config.smoothingFactor);
                }

                currentPos.add(bundlingForce);
                this.bundlingWeights[i] = totalInfluence;
            } else {
                this.bundlingWeights[i] = 0;
            }

            this.bundledPositions.push(currentPos);
        }

        this.updateGeometry();
    }

    updateGeometry() {
        if (this.bundledPositions.length < 2) return;

        const positions = [];
        const colors = [];

        for (let i = 0; i < this.bundledPositions.length; i++) {
            const pos = this.bundledPositions[i];
            positions.push(pos.x, pos.y, pos.z);

            // Color based on scheme
            let color = this.getColorForPoint(i);
            colors.push(color.r, color.g, color.b);
        }

        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        this.geometry.setDrawRange(0, this.bundledPositions.length);
    }

    getColorForPoint(index) {
        switch (config.colorScheme) {
            case 'velocity':
                if (this.velocities[index]) {
                    const speed = this.velocities[index].length() / config.maxSpeed;
                    return new THREE.Color().setHSL(0.7 - speed * 0.5, 1, 0.5);
                }
                break;
            case 'density':
                const density = Math.min(this.densities[index] / 10, 1);
                return new THREE.Color().setHSL(0.3 - density * 0.3, 1, 0.4 + density * 0.4);
            case 'bundling':
                const bundling = this.bundlingWeights[index];
                return new THREE.Color().setHSL(0.8 - bundling * 0.6, 1, 0.3 + bundling * 0.5);
            case 'rainbow':
                return new THREE.Color().setHSL(index / this.bundledPositions.length, 1, 0.5);
            case 'gradient':
                const ratio = index / this.bundledPositions.length;
                return new THREE.Color(0xff9500).lerp(new THREE.Color(0xaf52de), ratio);
        }
        return new THREE.Color(0xffffff);
    }

    setVisible(visible) {
        this.line.visible = visible && config.showTrails;
    }

    clear() {
        this.originalPositions = [];
        this.bundledPositions = [];
        this.velocities = [];
        this.densities = [];
        this.bundlingWeights = [];
        this.updateGeometry();
    }

    dispose() {
        scene.remove(this.line);
        this.geometry.dispose();
        this.material.dispose();
    }
}

// Enhanced Boid class
class SwarmBoid {
    constructor(position, velocity) {
        const geometry = new THREE.ConeGeometry(0.15, 0.6, 6);
        geometry.rotateX(Math.PI / 2);

        this.mesh = new THREE.Mesh(geometry, new THREE.MeshPhongMaterial({ color: 0xffffff }));
        this.mesh.position.copy(position);
        this.velocity = velocity.clone();
        this.acceleration = new THREE.Vector3();

        this.trail = new SwarmTrail(this, 0xffffff);
        scene.add(this.mesh);
    }

    update(delta, allBoids, currentTime) {
        if (config.paused) return;

        // Basic flocking behavior
        this.acceleration.set(0, 0, 0);
        this.applyFlockingForces(allBoids);
        this.enforceBoundary();

        // Update physics
        this.velocity.add(this.acceleration);
        if (this.velocity.length() > config.maxSpeed) {
            this.velocity.normalize().multiplyScalar(config.maxSpeed);
        }

        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta * 3));

        // Update trail with swarm bundling
        if (frameCount % 2 === 0) { // Every other frame
            this.trail.addPoint(this.mesh.position, this.velocity);
            this.trail.updateSwarmBundling(allBoids, currentTime);
        }

        // Orient boid
        if (this.velocity.lengthSq() > 0.001) {
            const lookTarget = this.mesh.position.clone().add(this.velocity.clone().normalize());
            this.mesh.lookAt(lookTarget);
        }
    }

    applyFlockingForces(boids) {
        const separation = new THREE.Vector3();
        const alignment = new THREE.Vector3();
        const cohesion = new THREE.Vector3();

        let count = 0;

        boids.forEach(boid => {
            if (boid === this) return;

            const distance = this.mesh.position.distanceTo(boid.mesh.position);
            if (distance > 0 && distance < 5) {
                // Separation
                if (distance < 2) {
                    const diff = new THREE.Vector3().subVectors(this.mesh.position, boid.mesh.position);
                    diff.normalize().divideScalar(distance);
                    separation.add(diff);
                }

                // Alignment and cohesion
                alignment.add(boid.velocity);
                cohesion.add(boid.mesh.position);
                count++;
            }
        });

        if (count > 0) {
            alignment.divideScalar(count).normalize().multiplyScalar(config.maxSpeed).sub(this.velocity).clampScalar(-0.3, 0.3);
            cohesion.divideScalar(count).sub(this.mesh.position).normalize().multiplyScalar(config.maxSpeed).sub(this.velocity).clampScalar(-0.3, 0.3);
        }

        if (separation.lengthSq() > 0) {
            separation.normalize().multiplyScalar(config.maxSpeed).sub(this.velocity).clampScalar(-0.5, 0.5);
        }

        this.acceleration.add(separation.multiplyScalar(0.3));
        this.acceleration.add(alignment.multiplyScalar(0.1));
        this.acceleration.add(cohesion.multiplyScalar(0.1));
    }

    enforceBoundary() {
        const pos = this.mesh.position;
        const margin = 3;

        if (pos.x > config.boundarySize - margin) this.acceleration.x -= 0.5;
        if (pos.x < -config.boundarySize + margin) this.acceleration.x += 0.5;
        if (pos.y > config.boundarySize - margin) this.acceleration.y -= 0.5;
        if (pos.y < -config.boundarySize + margin) this.acceleration.y += 0.5;
        if (pos.z > config.boundarySize - margin) this.acceleration.z -= 0.5;
        if (pos.z < -config.boundarySize + margin) this.acceleration.z += 0.5;

        // Wrap around
        if (Math.abs(pos.x) > config.boundarySize + 1) {
            pos.x = -Math.sign(pos.x) * (config.boundarySize + 1);
            this.trail.clear();
        }
        if (Math.abs(pos.y) > config.boundarySize + 1) {
            pos.y = -Math.sign(pos.y) * (config.boundarySize + 1);
            this.trail.clear();
        }
        if (Math.abs(pos.z) > config.boundarySize + 1) {
            pos.z = -Math.sign(pos.z) * (config.boundarySize + 1);
            this.trail.clear();
        }
    }

    dispose() {
        scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.trail.dispose();
    }
}

// Initialize visualization
function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);

    // Grid
    gridHelper = new THREE.GridHelper(config.boundarySize * 2, 20, 0x333333, 0x333333);
    scene.add(gridHelper);

    // Boundary
    updateBoundaryBox();

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(20, 20, 20);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // Create boids
    createBoids();

    // Setup UI
    setupEventListeners();

    // Window resize
    window.addEventListener('resize', onWindowResize);

    // Start animation
    animate();

    console.log("Swarm-based edge bundling visualization initialized");
}

function createBoids() {
    // Remove existing boids
    boids.forEach(boid => boid.dispose());
    boids = [];

    // Create new boids
    for (let i = 0; i < config.numBoids; i++) {
        const position = new THREE.Vector3(
            (Math.random() - 0.5) * config.boundarySize,
            (Math.random() - 0.5) * config.boundarySize,
            (Math.random() - 0.5) * config.boundarySize
        );

        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2,
            (Math.random() - 0.5) * 2
        );

        const boid = new SwarmBoid(position, velocity);
        boids.push(boid);
    }

    updateBoundaryBox();
}

function updateBoundaryBox() {
    if (boundaryBox) {
        scene.remove(boundaryBox);
        boundaryBox.geometry.dispose();
        boundaryBox.material.dispose();
    }

    const geometry = new THREE.BoxGeometry(
        config.boundarySize * 2,
        config.boundarySize * 2,
        config.boundarySize * 2
    );
    const material = new THREE.MeshBasicMaterial({
        color: 0x444444,
        transparent: true,
        opacity: 0.1,
        wireframe: true
    });
    boundaryBox = new THREE.Mesh(geometry, material);
    scene.add(boundaryBox);
}

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    const currentTime = performance.now();
    frameCount++;

    // Update controls
    controls.update();

    // Update boids with swarm bundling
    if (!config.paused) {
        boids.forEach(boid => boid.update(delta, boids, currentTime));
    }

    // Update stats
    if (frameCount % 60 === 0) {
        updateStats();
    }

    renderer.render(scene, camera);
}

function updateStats() {
    let bundledTrails = 0;
    boids.forEach(boid => {
        if (boid.trail && boid.trail.bundlingWeights.some(w => w > 0.1)) {
            bundledTrails++;
        }
    });

    const fps = Math.round(1000 / clock.getDelta());
    lastFPS = fps;

    const statsElement = document.getElementById('stats');
    if (statsElement) {
        statsElement.textContent = `Boids: ${boids.length} | Bundled Trails: ${bundledTrails} | FPS: ${fps}`;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setBundlingMode(mode) {
    config.bundlingMode = mode;

    // Update UI
    document.querySelectorAll('.bundling-mode button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(mode + 'Mode').classList.add('active');

    // Update algorithm info
    const info = document.getElementById('algorithmInfo');
    switch (mode) {
        case 'realtime':
            info.textContent = 'Real-time bundling based on swarm proximity and velocity alignment';
            break;
        case 'static':
            info.textContent = 'Static bundling applied when simulation is paused';
            break;
        case 'hybrid':
            info.textContent = 'Combines velocity-based and position-based bundling forces';
            break;
        case 'magnetic':
            info.textContent = 'Magnetic attraction with density-based falloff';
            break;
    }
}

function setupEventListeners() {
    // Minimize button
    const minimizeBtn = document.getElementById('minimizeControls');
    const controlsPanel = document.getElementById('controls');

    minimizeBtn.addEventListener('click', () => {
        controlsPanel.classList.toggle('minimized');
        const icon = minimizeBtn.querySelector('span');
        icon.textContent = controlsPanel.classList.contains('minimized') ? '⮞' : '⮜';
    });

    // Basic controls
    document.getElementById('resetBtn').addEventListener('click', () => {
        createBoids();
        frameCount = 0;
    });

    document.getElementById('pauseBtn').addEventListener('click', () => {
        config.paused = !config.paused;
        document.getElementById('pauseBtn').textContent = config.paused ? 'Resume' : 'Pause';
    });

    document.getElementById('gridToggle').addEventListener('click', () => {
        config.showGrid = !config.showGrid;
        gridHelper.visible = config.showGrid;
    });

    document.getElementById('trailToggle').addEventListener('click', () => {
        config.showTrails = !config.showTrails;
        boids.forEach(boid => boid.trail.setVisible(config.showTrails));
        document.getElementById('trailToggle').textContent = config.showTrails ? 'Hide Trails' : 'Show Trails';
        document.getElementById('trailToggle').classList.toggle('active');
    });

    document.getElementById('clearTrails').addEventListener('click', () => {
        boids.forEach(boid => boid.trail.clear());
    });

    // Bundling mode buttons
    document.getElementById('realTimeMode').addEventListener('click', () => setBundlingMode('realtime'));
    document.getElementById('staticMode').addEventListener('click', () => setBundlingMode('static'));
    document.getElementById('hybridMode').addEventListener('click', () => setBundlingMode('hybrid'));
    document.getElementById('magneticMode').addEventListener('click', () => setBundlingMode('magnetic'));

    // Bundling toggle
    document.getElementById('bundlingToggle').addEventListener('click', () => {
        config.edgeBundling = !config.edgeBundling;
        const btn = document.getElementById('bundlingToggle');
        btn.textContent = config.edgeBundling ? 'Disable Bundling' : 'Enable Bundling';
        btn.classList.toggle('active');
    });

    // Advanced toggles
    document.getElementById('adaptiveToggle').addEventListener('click', () => {
        config.adaptiveBundling = !config.adaptiveBundling;
        const btn = document.getElementById('adaptiveToggle');
        btn.textContent = config.adaptiveBundling ? 'Disable Adaptive' : 'Enable Adaptive';
        btn.classList.toggle('active');
    });

    document.getElementById('hierarchicalToggle').addEventListener('click', () => {
        config.hierarchicalBundling = !config.hierarchicalBundling;
        const btn = document.getElementById('hierarchicalToggle');
        btn.textContent = config.hierarchicalBundling ? 'Disable Hierarchical' : 'Enable Hierarchical';
        btn.classList.toggle('active');
    });

    // Sliders with live updates
    const sliders = [
        ['numBoids', 'numBoidsValue', (val) => {
            config.numBoids = parseInt(val);
            createBoids();
        }],
        ['maxSpeed', 'maxSpeedValue', (val) => { config.maxSpeed = parseFloat(val); }],
        ['bundlingStrength', 'bundlingStrengthValue', (val) => { config.bundlingStrength = parseFloat(val); }],
        ['bundlingRadius', 'bundlingRadiusValue', (val) => { config.bundlingRadius = parseFloat(val); }],
        ['velocityWeight', 'velocityWeightValue', (val) => { config.velocityWeight = parseFloat(val); }],
        ['densityThreshold', 'densityThresholdValue', (val) => { config.densityThreshold = parseInt(val); }],
        ['smoothingFactor', 'smoothingFactorValue', (val) => { config.smoothingFactor = parseFloat(val); }],
        ['bundlingIterations', 'bundlingIterationsValue', (val) => { config.bundlingIterations = parseInt(val); }],
        ['trailDecay', 'trailDecayValue', (val) => { config.trailDecay = parseFloat(val); }],
        ['magneticForce', 'magneticForceValue', (val) => { config.magneticForce = parseFloat(val); }],
        ['trailLength', 'trailLengthValue', (val) => { config.trailLength = parseInt(val); }],
        ['trailOpacity', 'trailOpacityValue', (val) => {
            config.trailOpacity = parseFloat(val);
            boids.forEach(boid => {
                if (boid.trail) boid.trail.material.opacity = config.trailOpacity;
            });
        }]
    ];

    sliders.forEach(([sliderId, valueId, callback]) => {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);

        slider.addEventListener('input', function () {
            const value = this.value;
            if (valueDisplay) {
                if (parseFloat(value) === parseInt(value)) {
                    valueDisplay.textContent = parseInt(value);
                } else {
                    valueDisplay.textContent = parseFloat(value).toFixed(1);
                }
            }
            callback(value);
        });
    });

    // Color scheme selector
    document.getElementById('colorScheme').addEventListener('change', function () {
        config.colorScheme = this.value;
    });
}

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', init);
