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
    maxTrailLength: 2000,
    trailSeparation: 0.15,     // How much trails avoid each other
    trailAlignment: 0.25,      // How much trails align with nearby trails
    trailCohesion: 0.2,        // How much trails are attracted to each other
    trailInfluenceRadius: 25,  // How far trails can influence each other
    
    // Advanced edge bundling parameters
    edgeBundlingStrength: 0.8,    // Main bundling force strength
    parallelAttractionStrength: 1.2, // Attraction to parallel trails
    perpendicularRepulsionStrength: 0.4, // Repulsion from perpendicular trails
    bundlingThreshold: 0.3,       // Minimum alignment for bundling (lower = more bundling)
    
    // Density-based bundling
    densityRadius: 12,           // Radius for density estimation
    maxDensity: 8,              // Maximum trail density before repulsion
    densityAttractionStrength: 0.6, // Strength of density-based attraction
    
    // Flow field parameters
    flowFieldStrength: 0.4,     // Strength of flow field influence
    flowFieldRadius: 30,        // Radius of flow field influence
    
    // Smoothing parameters
    velocitySmoothing: 0.3,     // How much to smooth velocity between updates
    positionSmoothing: 0.15,    // How much to smooth position updates
    
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
            boidId: this.id,
            age: 0 // Track age of trail point for weighting
        });
        
        // Limit trail length
        if (this.trailPoints.length > config.maxTrailLength) {
            this.trailPoints.shift();
        }
        
        // Update ages
        this.trailPoints.forEach(point => point.age++);
        
        // Apply enhanced edge bundling to the trail points
        this.applyEdgeBundling();
        
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
    
    // Apply enhanced edge bundling behavior to trail points
    applyEdgeBundling() {
        // Skip if too few points
        if (this.trailPoints.length < 5) return;
        
        // Multi-pass bundling for better results
        for (let pass = 0; pass < 2; pass++) {
            this.bundlingPass();
        }
    }
    
    // Single bundling pass
    bundlingPass() {
        // Process trail points in segments for better bundling
        for (let i = 2; i < this.trailPoints.length - 3; i++) {
            const point = this.trailPoints[i];
            
            // Get local trail direction (use multiple points for better direction)
            const currentDir = this.getTrailDirection(i);
            if (currentDir.length() < 0.01) continue;
            
            // Initialize force accumulators
            const bundlingForce = new THREE.Vector3();
            const densityForce = new THREE.Vector3();
            const flowForce = new THREE.Vector3();
            const smoothingForce = new THREE.Vector3();
            
            // Density estimation for this point
            const localDensity = this.estimateLocalDensity(point.position);
            
            // Apply density-based bundling
            this.applyDensityBundling(point, currentDir, localDensity, bundlingForce, densityForce);
            
            // Apply flow field influence
            this.applyFlowField(point, currentDir, flowForce);
            
            // Apply smoothing forces
            this.applySmoothing(i, smoothingForce);
            
            // Combine forces with appropriate weights
            const totalForce = new THREE.Vector3();
            totalForce.add(bundlingForce.multiplyScalar(1.0));
            totalForce.add(densityForce.multiplyScalar(0.8));
            totalForce.add(flowForce.multiplyScalar(0.6));
            totalForce.add(smoothingForce.multiplyScalar(1.2));
            
            // Apply velocity smoothing
            if (point.velocity) {
                point.velocity.lerp(totalForce, config.velocitySmoothing);
            } else {
                point.velocity = totalForce.clone();
            }
            
            // Limit velocity
            const maxSpeed = config.maxSpeed * 0.3;
            if (point.velocity.length() > maxSpeed) {
                point.velocity.normalize().multiplyScalar(maxSpeed);
            }
            
            // Update position with smoothing
            const positionDelta = point.velocity.clone().multiplyScalar(config.positionSmoothing);
            point.position.add(positionDelta);
        }
    }
    
    // Get trail direction at a specific point using multiple neighboring points
    getTrailDirection(index) {
        const point = this.trailPoints[index];
        const direction = new THREE.Vector3();
        
        // Use multiple points for more stable direction
        const lookAhead = Math.min(3, this.trailPoints.length - index - 1);
        const lookBehind = Math.min(3, index);
        
        if (lookAhead > 0 && lookBehind > 0) {
            const ahead = this.trailPoints[index + lookAhead].position;
            const behind = this.trailPoints[index - lookBehind].position;
            direction.subVectors(ahead, behind).normalize();
        }
        
        return direction;
    }
    
    // Estimate local density of trail points
    estimateLocalDensity(position) {
        let density = 0;
        const radiusSq = config.densityRadius * config.densityRadius;
        
        boids.forEach(otherBoid => {
            otherBoid.trailPoints.forEach(otherPoint => {
                const distSq = position.distanceToSquared(otherPoint.position);
                if (distSq < radiusSq && distSq > 0.01) {
                    // Use inverse distance for density weighting
                    density += 1.0 / (Math.sqrt(distSq) + 0.1);
                }
            });
        });
        
        return Math.min(density, config.maxDensity);
    }
    
    // Apply density-based bundling forces
    applyDensityBundling(point, currentDir, localDensity, bundlingForce, densityForce) {
        const influenceRadiusSq = config.trailInfluenceRadius * config.trailInfluenceRadius;
        
        // Collect nearby trail segments
        const nearbySegments = [];
        
        boids.forEach(otherBoid => {
            if (otherBoid === this) return;
            
            otherBoid.trailPoints.forEach((otherPoint, otherIndex) => {
                const distSq = point.position.distanceToSquared(otherPoint.position);
                
                if (distSq < influenceRadiusSq && distSq > 0.01) {
                    const otherDir = otherBoid.getTrailDirection(otherIndex);
                    if (otherDir.length() > 0.01) {
                        nearbySegments.push({
                            point: otherPoint,
                            direction: otherDir,
                            distance: Math.sqrt(distSq)
                        });
                    }
                }
            });
        });
        
        // Process nearby segments for bundling
        nearbySegments.forEach(segment => {
            const alignment = Math.abs(currentDir.dot(segment.direction));
            const distance = segment.distance;
            
            // Strong bundling for parallel segments
            if (alignment > config.bundlingThreshold) {
                // Calculate the bundling force
                const toOther = new THREE.Vector3().subVectors(segment.point.position, point.position);
                
                // Project onto perpendicular plane
                const parallel = segment.direction.clone().multiplyScalar(toOther.dot(segment.direction));
                const perpendicular = toOther.clone().sub(parallel);
                
                if (perpendicular.length() > 0.01) {
                    // Stronger attraction for highly aligned segments
                    const attractionStrength = config.edgeBundlingStrength * Math.pow(alignment, 2);
                    const attraction = perpendicular.clone()
                        .normalize()
                        .multiplyScalar(attractionStrength / (distance * 0.5 + 0.1));
                    
                    bundlingForce.add(attraction);
                    
                    // Additional parallel flow attraction
                    const parallelFlow = segment.direction.clone()
                        .multiplyScalar(config.parallelAttractionStrength * alignment / (distance + 1.0));
                    bundlingForce.add(parallelFlow);
                }
            }
            // Repulsion for crossing segments
            else if (alignment < (1.0 - config.bundlingThreshold)) {
                const repulsion = new THREE.Vector3()
                    .subVectors(point.position, segment.point.position)
                    .normalize()
                    .multiplyScalar(config.perpendicularRepulsionStrength / (distance + 0.5));
                densityForce.add(repulsion);
            }
        });
        
        // Density-based attraction to high-density areas (but not too high)
        if (localDensity > 1.0 && localDensity < config.maxDensity * 0.8) {
            const densityCenter = this.findDensityCenter(point.position);
            if (densityCenter) {
                const toDensity = new THREE.Vector3()
                    .subVectors(densityCenter, point.position)
                    .normalize()
                    .multiplyScalar(config.densityAttractionStrength * (localDensity / config.maxDensity));
                densityForce.add(toDensity);
            }
        }
    }
    
    // Find the center of nearby density
    findDensityCenter(position) {
        const center = new THREE.Vector3();
        let totalWeight = 0;
        const radiusSq = config.densityRadius * config.densityRadius;
        
        boids.forEach(otherBoid => {
            otherBoid.trailPoints.forEach(otherPoint => {
                const distSq = position.distanceToSquared(otherPoint.position);
                if (distSq < radiusSq && distSq > 0.01) {
                    const weight = 1.0 / (Math.sqrt(distSq) + 0.1);
                    center.add(otherPoint.position.clone().multiplyScalar(weight));
                    totalWeight += weight;
                }
            });
        });
        
        if (totalWeight > 0) {
            return center.divideScalar(totalWeight);
        }
        return null;
    }
    
    // Apply flow field influence for organic movement
    applyFlowField(point, currentDir, flowForce) {
        // Create a flow field based on nearby trail directions
        const flowDirection = new THREE.Vector3();
        let flowWeight = 0;
        
        const flowRadiusSq = config.flowFieldRadius * config.flowFieldRadius;
        
        boids.forEach(otherBoid => {
            otherBoid.trailPoints.forEach((otherPoint, otherIndex) => {
                const distSq = point.position.distanceToSquared(otherPoint.position);
                
                if (distSq < flowRadiusSq && distSq > 0.01) {
                    const otherDir = otherBoid.getTrailDirection(otherIndex);
                    if (otherDir.length() > 0.01) {
                        const weight = 1.0 / (Math.sqrt(distSq) + 1.0);
                        flowDirection.add(otherDir.clone().multiplyScalar(weight));
                        flowWeight += weight;
                    }
                }
            });
        });
        
        if (flowWeight > 0) {
            flowDirection.divideScalar(flowWeight);
            const flowInfluence = flowDirection.clone()
                .multiplyScalar(config.flowFieldStrength);
            flowForce.add(flowInfluence);
        }
    }
    
    // Apply smoothing forces for natural curves
    applySmoothing(index, smoothingForce) {
        const point = this.trailPoints[index];
        
        // Multi-point smoothing for better curves
        const smoothingRange = 2;
        const smoothPosition = new THREE.Vector3();
        let smoothCount = 0;
        
        for (let offset = -smoothingRange; offset <= smoothingRange; offset++) {
            const targetIndex = index + offset;
            if (targetIndex >= 0 && targetIndex < this.trailPoints.length && targetIndex !== index) {
                const weight = 1.0 / (Math.abs(offset) + 1.0);
                smoothPosition.add(this.trailPoints[targetIndex].position.clone().multiplyScalar(weight));
                smoothCount += weight;
            }
        }
        
        if (smoothCount > 0) {
            smoothPosition.divideScalar(smoothCount);
            const smoothForce = smoothPosition.clone()
                .sub(point.position)
                .multiplyScalar(0.2);
            smoothingForce.add(smoothForce);
        }
        
        // Add curvature-based smoothing
        if (index > 1 && index < this.trailPoints.length - 2) {
            const prev = this.trailPoints[index - 1].position;
            const next = this.trailPoints[index + 1].position;
            const curvatureCenter = new THREE.Vector3().add(prev).add(next).divideScalar(2);
            const curvatureForce = curvatureCenter.clone()
                .sub(point.position)
                .multiplyScalar(0.15);
            smoothingForce.add(curvatureForce);
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

    // Create new boids with more strategic positioning for better bundling
    for (let i = 0; i < config.numBoids; i++) {
        let position, velocity;
        
        // Create some clusters for better bundling demonstration
        if (i < config.numBoids * 0.3) {
            // Cluster 1: Upper region
            const clusterCenter = new THREE.Vector3(20, 25, 10);
            position = clusterCenter.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 30,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 30
            ));
            velocity = new THREE.Vector3(-0.3, -0.1, 0.2).add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 0.4
            ));
        } else if (i < config.numBoids * 0.6) {
            // Cluster 2: Lower region
            const clusterCenter = new THREE.Vector3(-15, -20, -15);
            position = clusterCenter.clone().add(new THREE.Vector3(
                (Math.random() - 0.5) * 25,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 25
            ));
            velocity = new THREE.Vector3(0.2, 0.3, -0.1).add(new THREE.Vector3(
                (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 0.4,
                (Math.random() - 0.5) * 0.4
            ));
        } else {
            // Random distribution for remaining boids
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = config.boundaryRadius * Math.cbrt(Math.random());

            position = new THREE.Vector3(
                radius * Math.sin(phi) * Math.cos(theta),
                radius * Math.sin(phi) * Math.sin(theta),
                radius * Math.cos(phi)
            );

            velocity = new THREE.Vector3(
                (Math.random() - 0.5) * config.maxSpeed,
                (Math.random() - 0.5) * config.maxSpeed,
                (Math.random() - 0.5) * config.maxSpeed
            );
        }

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
        bundleStrengthSlider.value = config.edgeBundlingStrength;
        bundleStrengthValue.textContent = config.edgeBundlingStrength.toFixed(1);

        bundleStrengthSlider.addEventListener('input', function () {
            const value = parseFloat(this.value);
            config.edgeBundlingStrength = value;
            config.parallelAttractionStrength = value * 1.3;
            config.perpendicularRepulsionStrength = value * 0.7;
            bundleStrengthValue.textContent = value.toFixed(1);
        });
    }

    // Density radius slider
    const densityRadiusSlider = document.getElementById('densityRadius');
    const densityRadiusValue = document.getElementById('densityRadiusValue');

    if (densityRadiusSlider && densityRadiusValue) {
        densityRadiusSlider.value = config.densityRadius;
        densityRadiusValue.textContent = config.densityRadius;

        densityRadiusSlider.addEventListener('input', function () {
            config.densityRadius = parseFloat(this.value);
            densityRadiusValue.textContent = config.densityRadius;
        });
    }

    // Flow field strength slider  
    const flowFieldSlider = document.getElementById('flowFieldStrength');
    const flowFieldValue = document.getElementById('flowFieldStrengthValue');

    if (flowFieldSlider && flowFieldValue) {
        flowFieldSlider.value = config.flowFieldStrength;
        flowFieldValue.textContent = config.flowFieldStrength.toFixed(1);

        flowFieldSlider.addEventListener('input', function () {
            config.flowFieldStrength = parseFloat(this.value);
            flowFieldValue.textContent = config.flowFieldStrength.toFixed(1);
        });
    }

    // Velocity smoothing slider
    const velocitySmoothingSlider = document.getElementById('velocitySmoothing');
    const velocitySmoothingValue = document.getElementById('velocitySmoothingValue');

    if (velocitySmoothingSlider && velocitySmoothingValue) {
        velocitySmoothingSlider.value = config.velocitySmoothing;
        velocitySmoothingValue.textContent = config.velocitySmoothing.toFixed(2);

        velocitySmoothingSlider.addEventListener('input', function () {
            config.velocitySmoothing = parseFloat(this.value);
            velocitySmoothingValue.textContent = config.velocitySmoothing.toFixed(2);
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