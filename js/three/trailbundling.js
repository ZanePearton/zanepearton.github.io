// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let boids = [];
let trails = [];
let bundledTrails = []; // For storing bundled trail data
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
    maxTrailLength: 20,     // Maximum length of each boid's trail
    bundleDistance: 15,     // Maximum distance for edge bundling
    bundleStrength: 0.5,    // How strongly trails should be bundled (0-1)
    bundleUpdateInterval: 10, // How often to update bundled lines (frames)
    colorScheme: 'gradient',
    showTrails: true,
    showBundles: true,
    paused: false,          // Whether the simulation is paused
    debug: false,           // Show debug information
};

// Custom curve for edge bundling
class BundledCurve extends THREE.Curve {
    constructor(startPoint, endPoint, controlPoints = []) {
        super();
        this.startPoint = startPoint;
        this.endPoint = endPoint;

        // If control points are provided, use them
        // Otherwise create a simple bezier with one midpoint
        if (controlPoints.length > 0) {
            this.controlPoints = controlPoints;
        } else {
            // Calculate midpoint with some offset for bundling effect
            const midX = (startPoint.x + endPoint.x) / 2;
            const midY = (startPoint.y + endPoint.y) / 2 + (endPoint.distanceTo(startPoint) * 0.2);
            const midZ = (startPoint.z + endPoint.z) / 2;

            this.controlPoints = [new THREE.Vector3(midX, midY, midZ)];
        }
    }

    getPoint(t) {
        // For simple bezier with 1 control point
        if (this.controlPoints.length === 1) {
            const point = new THREE.Vector3();

            // Quadratic bezier curve formula
            point.x = Math.pow(1 - t, 2) * this.startPoint.x +
                2 * (1 - t) * t * this.controlPoints[0].x +
                Math.pow(t, 2) * this.endPoint.x;

            point.y = Math.pow(1 - t, 2) * this.startPoint.y +
                2 * (1 - t) * t * this.controlPoints[0].y +
                Math.pow(t, 2) * this.endPoint.y;

            point.z = Math.pow(1 - t, 2) * this.startPoint.z +
                2 * (1 - t) * t * this.controlPoints[0].z +
                Math.pow(t, 2) * this.endPoint.z;

            return point;
        }
        // For more complex curves with multiple control points
        else {
            // Use De Casteljau's algorithm for general Bezier curves
            let points = [this.startPoint, ...this.controlPoints, this.endPoint];
            while (points.length > 1) {
                const nextPoints = [];
                for (let i = 0; i < points.length - 1; i++) {
                    nextPoints.push(new THREE.Vector3().lerpVectors(points[i], points[i + 1], t));
                }
                points = nextPoints;
            }
            return points[0];
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

// Class to manage bundled trail segments
class TrailBundle {
    constructor() {
        this.segments = []; // Array of {start, end, weight, boidId} objects
        this.mesh = null;
    }

    addSegment(startPoint, endPoint, boidId, weight = 1) {
        this.segments.push({
            start: startPoint.clone(),
            end: endPoint.clone(),
            boidId: boidId,
            weight: weight
        });
    }

    // Apply force-directed bundling
    bundle(iterations = 5, bundleStrength = 0.5) {
        if (this.segments.length <= 1) return;

        const compatibilityThreshold = 0.6; // Threshold for considering segments compatible
        const stepSize = 0.1; // How much to move points in each iteration

        // Create internal points for each segment
        const internalPoints = this.segments.map(() => []);
        const numSubdivisions = 8; // Number of internal points per segment

        // Initialize internal points
        this.segments.forEach((segment, i) => {
            for (let j = 1; j < numSubdivisions; j++) {
                const t = j / numSubdivisions;
                const point = new THREE.Vector3().lerpVectors(segment.start, segment.end, t);
                internalPoints[i].push(point);
            }
        });

        // Bundling iterations
        for (let iter = 0; iter < iterations; iter++) {
            // For each segment
            for (let i = 0; i < this.segments.length; i++) {
                const segI = this.segments[i];

                // For each subdivision point
                for (let j = 0; j < internalPoints[i].length; j++) {
                    const pointI = internalPoints[i][j];
                    let force = new THREE.Vector3(0, 0, 0);
                    let totalWeight = 0;

                    // Calculate forces from all other segments
                    for (let k = 0; k < this.segments.length; k++) {
                        if (i === k) continue;

                        const segK = this.segments[k];

                        // Calculate compatibility
                        const compatibility = this.calculateCompatibility(segI, segK);

                        if (compatibility > compatibilityThreshold) {
                            // Find closest point on segment K
                            const t = (j + 1) / (numSubdivisions + 1);
                            const pointK = internalPoints[k][j];

                            // Calculate attraction force
                            const attractForce = new THREE.Vector3().subVectors(pointK, pointI);
                            attractForce.multiplyScalar(compatibility * bundleStrength);

                            force.add(attractForce);
                            totalWeight += compatibility;
                        }
                    }

                    // Apply the force
                    if (totalWeight > 0) {
                        force.multiplyScalar(stepSize / totalWeight);
                        pointI.add(force);
                    }
                }
            }
        }

        // Update the mesh with bundled curves
        this.updateMesh(internalPoints);
    }

    // Calculate compatibility between two segments
    calculateCompatibility(seg1, seg2) {
        // Direction compatibility
        const dir1 = new THREE.Vector3().subVectors(seg1.end, seg1.start).normalize();
        const dir2 = new THREE.Vector3().subVectors(seg2.end, seg2.start).normalize();
        const angleFactor = Math.abs(dir1.dot(dir2));

        // Length compatibility
        const len1 = seg1.start.distanceTo(seg1.end);
        const len2 = seg2.start.distanceTo(seg2.end);
        const lengthFactor = Math.min(len1, len2) / Math.max(len1, len2);

        // Position compatibility - how close are the segments
        const mid1 = new THREE.Vector3().addVectors(seg1.start, seg1.end).multiplyScalar(0.5);
        const mid2 = new THREE.Vector3().addVectors(seg2.start, seg2.end).multiplyScalar(0.5);
        const dist = mid1.distanceTo(mid2) / config.bundleDistance;
        const posFactor = Math.max(0, 1 - dist);

        // Visibility compatibility
        const vis1to2 = this.calculateVisibility(seg1.start, seg1.end, seg2.start, seg2.end);
        const vis2to1 = this.calculateVisibility(seg2.start, seg2.end, seg1.start, seg1.end);
        const visFactor = Math.min(vis1to2, vis2to1);

        // Combine factors
        return angleFactor * lengthFactor * posFactor * visFactor;
    }

    // Calculate visibility between segments
    calculateVisibility(p1, p2, q1, q2) {
        // Project q1 and q2 onto line p1-p2
        const p2minusp1 = new THREE.Vector3().subVectors(p2, p1);
        const p1minusq1 = new THREE.Vector3().subVectors(p1, q1);
        const p1minusq2 = new THREE.Vector3().subVectors(p1, q2);

        const len = p2minusp1.length();
        const lenSq = len * len;

        if (lenSq === 0) return 0;

        const projq1 = p2minusp1.dot(p1minusq1) / lenSq;
        const projq2 = p2minusp1.dot(p1minusq2) / lenSq;

        // Calculate visibility
        const visibility = 1 - Math.max(
            0,
            Math.min(1, Math.max(projq1, projq2)) - Math.max(0, Math.min(projq1, projq2))
        );

        return visibility;
    }

    // Update the mesh representation with bundled curves
    updateMesh(internalPoints) {
        // Remove old mesh
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        // Create new group for all curves
        this.mesh = new THREE.Group();

        // For each segment
        this.segments.forEach((segment, i) => {
            // Create array of points including start, internal points, and end
            const points = [segment.start.clone()];
            internalPoints[i].forEach(p => points.push(p.clone()));
            points.push(segment.end.clone());

            // Create curve using these points
            const curve = new BundledCurve(
                segment.start,
                segment.end,
                internalPoints[i].map(p => p.clone())
            );

            // Create tube geometry for the curve
            const tubeGeometry = new THREE.TubeGeometry(
                curve,
                20,  // tubular segments
                0.05 + (segment.weight * 0.1),  // tube radius
                8,    // radial segments
                false // closed
            );

            // Determine color based on color scheme and boid ID
            let color;
            switch (config.colorScheme) {
                case 'rainbow':
                    // Distribute colors evenly across the rainbow
                    color = new THREE.Color().setHSL(segment.boidId / config.numBoids, 1, 0.5);
                    break;
                case 'gradient':
                    // Gradient from orange to purple based on position
                    const height = (segment.start.y + config.boundaryRadius) / (config.boundaryRadius * 2);
                    color = new THREE.Color(0xff9500).lerp(new THREE.Color(0xaf52de), height);
                    break;
                default:
                    color = new THREE.Color(0x3399ff);
            }

            // Create material
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.5,
                wireframe: false
            });

            // Create mesh and add to group
            const tube = new THREE.Mesh(tubeGeometry, material);
            this.mesh.add(tube);
        });

        // Add the group to the scene
        scene.add(this.mesh);
    }

    // Dispose of all resources
    dispose() {
        if (this.mesh) {
            scene.remove(this.mesh);
            this.mesh.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.mesh = null;
        }
        this.segments = [];
    }
}

// Boid class
class Boid {
    constructor(position, velocity, id) {
        // Store boid ID
        this.id = id;

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
        const oldPosition = this.mesh.position.clone();
        this.mesh.position.add(this.velocity.clone().multiplyScalar(delta * 60));

        // Set orientation to match velocity
        if (this.velocity.lengthSq() > 0.001) {
            this.mesh.lookAt(this.mesh.position.clone().add(this.velocity));
        }

        // Update trail
        if (config.showTrails) {
            this.updateTrail(oldPosition);
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
    updateTrail(oldPosition) {
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

            const material = new THREE.LineBasicMaterial({
                color: color,
                opacity: 0.4,
                transparent: true,
                linewidth: 1
            });

            this.trailLine = new THREE.Line(geometry, material);
            scene.add(this.trailLine);
        }

        // If a new segment was created, add it to the collection for bundling
        if (this.trail.length >= 2 && oldPosition) {
            const lastIdx = this.trail.length - 1;
            const currentPos = this.trail[lastIdx];
            const prevPos = this.trail[lastIdx - 1];

            // Only add segment if it's long enough to be meaningful
            if (prevPos.distanceTo(currentPos) > 0.1) {
                trails.push({
                    start: prevPos.clone(),
                    end: currentPos.clone(),
                    boidId: this.id,
                    time: Date.now() // For aging
                });

                // Limit the total number of trail segments
                if (trails.length > config.numBoids * config.maxTrailLength) {
                    trails.shift();
                }
            }
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
    bundledLines.forEach(bundle => {
        if (bundle.mesh) {
            bundle.mesh.visible = config.showBundles;
        }
    });
}

// Create boids with random positions and velocities
function createBoids() {
    // Remove existing boids
    boids.forEach(boid => boid.dispose());
    boids = [];

    // Clear trails
    trails = [];

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
        const boid = new Boid(position, velocity, i);
        boid.updateMaterial(config.colorScheme, i, config.numBoids);
        boids.push(boid);
    }

    // Update statistics
    updateStats();
}

// Update bundled trails
function updateBundledTrails() {
    if (!config.showBundles || trails.length < 2) return;

    // Clear old bundled lines
    bundledLines.forEach(bundle => bundle.dispose());
    bundledLines = [];

    // Create new bundle
    const bundle = new TrailBundle();

    // Add recent trail segments
    const now = Date.now();
    const maxAge = 2000; // Only bundle trails that are less than 2 seconds old

    trails.forEach(segment => {
        const age = now - segment.time;
        if (age < maxAge) {
            // Weight decreases with age
            const weight = 1 - (age / maxAge);
            bundle.addSegment(segment.start, segment.end, segment.boidId, weight);
        }
    });

    // Apply bundling
    bundle.bundle(3, config.bundleStrength);

    // Add to list of bundles
    bundledLines.push(bundle);
}

// Clear all bundled lines
function clearBundledLines() {
    bundledLines.forEach(bundle => bundle.dispose());
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

        // Update bundled trails periodically
        frameCount++;
        if (frameCount % config.bundleUpdateInterval === 0) {
            updateBundledTrails();
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
        statsElement.textContent = `Boids: ${boids.length} | Trail Segments: ${trails.length} | Bundles: ${bundledLines.length}`;
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
        });
    }

    // Bundle strength slider
    const bundleStrengthSlider = document.getElementById('bundleStrength');
    const bundleStrengthValue = document.getElementById('bundleStrengthValue');

    if (bundleStrengthSlider && bundleStrengthValue) {
        bundleStrengthSlider.min = 0;
        bundleStrengthSlider.max = 1;
        bundleStrengthSlider.step = 0.1;
        bundleStrengthSlider.value = config.bundleStrength;
        bundleStrengthValue.textContent = config.bundleStrength.toFixed(1);

        bundleStrengthSlider.addEventListener('input', function () {
            config.bundleStrength = parseFloat(this.value);
            bundleStrengthValue.textContent = config.bundleStrength.toFixed(1);
        });
    }