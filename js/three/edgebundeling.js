// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Initialize variables
let renderer, scene, camera, controls;
let edgesMesh, nodesMesh;
let clock = new THREE.Clock();

// Configuration parameters
let config = {
    paused: false,
    showNodes: true,
    bundlingStrength: 0.85,
    bundlingCycles: 6,
    bundlingIterations: 90,
    nodeSize: 0.15,
    edgeOpacity: 0.6,
    nodeColor: 0x4285f4,
    edgeColor: 0x34a853,
    backgroundColor: 0x121212,
    layoutForce: 0.05,
    layoutIterations: 300,
    showLabels: true,
    edgeThickness: 1.0
};

// Constants for simulation
const MAX_NODES = 100;
const SPHERE_RADIUS = 12;

// Data structures
let nodes = [];
let edges = [];
let edgePoints = [];
let bundledEdges = [];
let labels = [];

// Create sample network data
function generateSampleNetwork() {
    nodes = [];
    edges = [];
    
    // Create clusters of nodes
    const numClusters = 5;
    const nodesPerCluster = Math.floor(MAX_NODES / numClusters);
    
    // Generate nodes in cluster patterns
    for (let cluster = 0; cluster < numClusters; cluster++) {
        // Create a random position for the cluster center
        const phi = Math.random() * Math.PI * 2;
        const theta = Math.random() * Math.PI;
        const clusterX = Math.sin(theta) * Math.cos(phi) * SPHERE_RADIUS * 0.7;
        const clusterY = Math.sin(theta) * Math.sin(phi) * SPHERE_RADIUS * 0.7;
        const clusterZ = Math.cos(theta) * SPHERE_RADIUS * 0.7;
        
        for (let i = 0; i < nodesPerCluster; i++) {
            // Create node with slight variations from cluster center
            const nodeRadius = 2 + Math.random() * 2;
            const nodePhi = Math.random() * Math.PI * 2;
            const nodeTheta = Math.random() * Math.PI;
            
            const x = clusterX + Math.sin(nodeTheta) * Math.cos(nodePhi) * nodeRadius;
            const y = clusterY + Math.sin(nodeTheta) * Math.sin(nodePhi) * nodeRadius;
            const z = clusterZ + Math.cos(nodeTheta) * nodeRadius;
            
            nodes.push({
                id: nodes.length,
                position: new THREE.Vector3(x, y, z),
                cluster: cluster,
                label: `Node ${nodes.length}`,
                connections: 0
            });
        }
    }
    
    // Generate edges between nodes (more connections within clusters, fewer between)
    for (let i = 0; i < nodes.length; i++) {
        // Each node connects to 1-3 nodes in its own cluster
        const sameClusterConnections = 1 + Math.floor(Math.random() * 3);
        const otherClusterConnections = Math.random() < 0.3 ? 1 : 0; // 30% chance to connect to another cluster
        
        // Connect to same cluster nodes
        for (let c = 0; c < sameClusterConnections; c++) {
            let targetIndex = i;
            // Find a different node in the same cluster
            while (targetIndex === i) {
                const candidateIndices = [];
                for (let j = 0; j < nodes.length; j++) {
                    if (j !== i && nodes[j].cluster === nodes[i].cluster) {
                        candidateIndices.push(j);
                    }
                }
                if (candidateIndices.length > 0) {
                    targetIndex = candidateIndices[Math.floor(Math.random() * candidateIndices.length)];
                } else {
                    break;
                }
            }
            
            if (targetIndex !== i) {
                // Check if edge already exists
                const edgeExists = edges.some(e => 
                    (e.source === i && e.target === targetIndex) || 
                    (e.source === targetIndex && e.target === i)
                );
                
                if (!edgeExists) {
                    edges.push({
                        source: i,
                        target: targetIndex,
                        weight: 1
                    });
                    nodes[i].connections++;
                    nodes[targetIndex].connections++;
                }
            }
        }
        
        // Connect to other cluster nodes
        if (otherClusterConnections > 0) {
            // Find nodes in other clusters
            const otherClusterNodes = [];
            for (let j = 0; j < nodes.length; j++) {
                if (nodes[j].cluster !== nodes[i].cluster) {
                    otherClusterNodes.push(j);
                }
            }
            
            if (otherClusterNodes.length > 0) {
                const targetIndex = otherClusterNodes[Math.floor(Math.random() * otherClusterNodes.length)];
                
                // Check if edge already exists
                const edgeExists = edges.some(e => 
                    (e.source === i && e.target === targetIndex) || 
                    (e.source === targetIndex && e.target === i)
                );
                
                if (!edgeExists) {
                    edges.push({
                        source: i,
                        target: targetIndex,
                        weight: 0.5 // Inter-cluster connections have lower weight
                    });
                    nodes[i].connections++;
                    nodes[targetIndex].connections++;
                }
            }
        }
    }
    
    console.log(`Generated network with ${nodes.length} nodes and ${edges.length} edges`);
}

// Initialize edge points by sampling along straight lines between nodes
function initializeEdgePoints() {
    edgePoints = [];
    
    // For each edge, create control points
    edges.forEach(edge => {
        const sourceNode = nodes[edge.source];
        const targetNode = nodes[edge.target];
        
        const numPoints = 12; // Number of control points per edge
        const points = [];
        
        for (let i = 0; i < numPoints; i++) {
            const t = i / (numPoints - 1);
            const point = new THREE.Vector3().lerpVectors(
                sourceNode.position,
                targetNode.position,
                t
            );
            
            // Add slight randomness to initial positions for better bundling
            if (i > 0 && i < numPoints - 1) {
                point.x += (Math.random() - 0.5) * 0.4;
                point.y += (Math.random() - 0.5) * 0.4;
                point.z += (Math.random() - 0.5) * 0.4;
            }
            
            points.push(point);
        }
        
        edgePoints.push({
            edge: edge,
            points: points
        });
    });
}

// Force-directed layout algorithm to position nodes better
function applyForceDirectedLayout() {
    const iterations = config.layoutIterations;
    const forceStrength = config.layoutForce;
    
    for (let iter = 0; iter < iterations; iter++) {
        // Calculate repulsive forces between nodes
        for (let i = 0; i < nodes.length; i++) {
            const node1 = nodes[i];
            const force = new THREE.Vector3(0, 0, 0);
            
            for (let j = 0; j < nodes.length; j++) {
                if (i !== j) {
                    const node2 = nodes[j];
                    const direction = new THREE.Vector3().subVectors(node1.position, node2.position);
                    const distance = direction.length();
                    
                    if (distance > 0 && distance < 10) {
                        // Repulsive force, inversely proportional to distance
                        const repulsiveForce = forceStrength * 10 / (distance * distance);
                        direction.normalize().multiplyScalar(repulsiveForce);
                        force.add(direction);
                    }
                }
            }
            
            // Apply forces to node position
            node1.position.add(force);
            
            // Keep nodes on sphere surface
            node1.position.normalize().multiplyScalar(SPHERE_RADIUS);
        }
        
        // Apply attractive forces for connected nodes
        for (let e = 0; e < edges.length; e++) {
            const edge = edges[e];
            const sourceNode = nodes[edge.source];
            const targetNode = nodes[edge.target];
            
            const direction = new THREE.Vector3().subVectors(targetNode.position, sourceNode.position);
            const distance = direction.length();
            
            // Attractive force, proportional to distance
            const attractiveForce = forceStrength * 0.01 * distance * edge.weight;
            direction.normalize().multiplyScalar(attractiveForce);
            
            sourceNode.position.add(direction);
            targetNode.position.sub(direction);
            
            // Keep nodes on sphere surface
            sourceNode.position.normalize().multiplyScalar(SPHERE_RADIUS);
            targetNode.position.normalize().multiplyScalar(SPHERE_RADIUS);
        }
    }
    
    // After layout, update edge points with new node positions
    initializeEdgePoints();
}

// Edge bundling algorithm (FDEB - Force-Directed Edge Bundling)
function bundleEdges() {
    // Skip if no edges
    if (edgePoints.length === 0) return;
    
    const cycles = config.bundlingCycles;
    const iterations = config.bundlingIterations;
    const initialStep = 0.1; // Initial step size
    
    // Multiple cycles with decreasing step size
    for (let cycle = 0; cycle < cycles; cycle++) {
        const stepSize = initialStep * Math.pow(0.5, cycle);
        
        // Each bundling cycle consists of multiple iterations
        for (let iter = 0; iter < iterations; iter++) {
            // For each edge
            for (let e = 0; e < edgePoints.length; e++) {
                const currentEdge = edgePoints[e];
                const edge = currentEdge.edge;
                const points = currentEdge.points;
                
                // Skip first and last points (they stay at node positions)
                for (let p = 1; p < points.length - 1; p++) {
                    const point = points[p];
                    const force = new THREE.Vector3(0, 0, 0);
                    
                    // Calculate forces from all other edges' points at similar positions
                    for (let oe = 0; oe < edgePoints.length; oe++) {
                        // Skip self
                        if (oe === e) continue;
                        
                        const otherEdge = edgePoints[oe].edge;
                        const otherPoints = edgePoints[oe].points;
                        
                        // Calculate compatibility between edges
                        const sourceNode = nodes[edge.source];
                        const targetNode = nodes[edge.target];
                        const otherSourceNode = nodes[otherEdge.source];
                        const otherTargetNode = nodes[otherEdge.target];
                        
                        // Skip if edges are in different clusters (optional)
                        const sameCluster = 
                            (sourceNode.cluster === otherSourceNode.cluster) || 
                            (sourceNode.cluster === otherTargetNode.cluster) ||
                            (targetNode.cluster === otherSourceNode.cluster) ||
                            (targetNode.cluster === otherTargetNode.cluster);
                        
                        if (!sameCluster) continue;
                        
                        // Calculate corresponding point on other edge
                        const t = p / (points.length - 1);
                        const otherPointIndex = Math.floor(t * (otherPoints.length - 1));
                        const otherPoint = otherPoints[otherPointIndex];
                        
                        // Calculate distance between points
                        const direction = new THREE.Vector3().subVectors(otherPoint, point);
                        const distance = direction.length();
                        
                        // Apply bundling force if points are close enough
                        if (distance > 0 && distance < 5) {
                            const bundlingForce = config.bundlingStrength * stepSize;
                            direction.normalize().multiplyScalar(bundlingForce);
                            force.add(direction);
                        }
                    }
                    
                    // Apply spring forces to maintain edge shape
                    const prevPoint = points[p - 1];
                    const nextPoint = points[p + 1];
                    const idealPosition = new THREE.Vector3().addVectors(prevPoint, nextPoint).multiplyScalar(0.5);
                    const springDirection = new THREE.Vector3().subVectors(idealPosition, point);
                    const springForce = springDirection.multiplyScalar(0.7 * (1 - config.bundlingStrength));
                    
                    force.add(springForce);
                    
                    // Apply combined forces
                    point.add(force);
                }
            }
        }
    }
    
    // Save bundled edges for rendering
    bundledEdges = edgePoints;
}

// Create visual representation of nodes
function createNodesMesh() {
    // Create geometry for points
    const positions = new Float32Array(nodes.length * 3);
    const colors = new Float32Array(nodes.length * 3);
    const sizes = new Float32Array(nodes.length);
    
    // Fill positions and colors
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const pos = node.position;
        
        positions[i * 3] = pos.x;
        positions[i * 3 + 1] = pos.y;
        positions[i * 3 + 2] = pos.z;
        
        // Color nodes by cluster
        const hue = node.cluster / 5; // 5 clusters
        const color = new THREE.Color().setHSL(hue, 0.7, 0.5);
        
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        
        // Size nodes by number of connections
        const connectionScale = Math.min(1, node.connections / 10);
        sizes[i] = config.nodeSize * (0.7 + connectionScale * 0.6);
    }
    
    // Create buffer geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Create shader material for better looking points
    const material = new THREE.ShaderMaterial({
        uniforms: {
            pointSize: { value: config.nodeSize }
        },
        vertexShader: `
            attribute float size;
            uniform float pointSize;
            varying vec3 vColor;
            
            void main() {
                vColor = color;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = size * pointSize * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            
            void main() {
                // Draw a circle
                vec2 center = gl_PointCoord - vec2(0.5, 0.5);
                float dist = length(center);
                
                if (dist > 0.5) {
                    discard;
                }
                
                // Add some shading for 3D appearance
                float shade = 1.0 - dist * dist * 0.6;
                gl_FragColor = vec4(vColor * shade, 1.0);
            }
        `,
        vertexColors: true,
        transparent: true
    });
    
    // Create points mesh
    const nodesMesh = new THREE.Points(geometry, material);
    
    return nodesMesh;
}

// Create visual representation of edges with bundling
function createEdgesMesh() {
    // Create multiple line geometries for all bundled edges
    const lines = [];
    
    bundledEdges.forEach(bundledEdge => {
        const points = bundledEdge.points;
        const edge = bundledEdge.edge;
        
        // Create curve from control points
        const curve = new THREE.CatmullRomCurve3(points);
        const curvePoints = curve.getPoints(50); // Higher number for smoother curves
        
        // Create geometry for this curve
        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        
        // Color edges based on the clusters they connect
        const sourceCluster = nodes[edge.source].cluster;
        const targetCluster = nodes[edge.target].cluster;
        
        let color;
        if (sourceCluster === targetCluster) {
            // Same cluster - use cluster color
            const hue = sourceCluster / 5; // 5 clusters
            color = new THREE.Color().setHSL(hue, 0.7, 0.5);
        } else {
            // Different clusters - use gradient or neutral color
            color = new THREE.Color(config.edgeColor);
        }
        
        // Create material with proper opacity
        const material = new THREE.LineBasicMaterial({
            color: color,
            transparent: true,
            opacity: config.edgeOpacity,
            linewidth: config.edgeThickness
        });
        
        // Create line and add to array
        const line = new THREE.Line(geometry, material);
        lines.push(line);
    });
    
    // Create a group to hold all lines
    const edgesGroup = new THREE.Group();
    lines.forEach(line => edgesGroup.add(line));
    
    return edgesGroup;
}

// Create labels for nodes
function createNodeLabels() {
    // Clear existing labels
    while (labels.length > 0) {
        const label = labels.pop();
        if (label.element) {
            document.body.removeChild(label.element);
        }
    }
    
    // Skip if labels disabled
    if (!config.showLabels) return;
    
    // Create new labels
    nodes.forEach(node => {
        // Create HTML element
        const element = document.createElement('div');
        element.className = 'node-label';
        element.textContent = node.label;
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.color = 'white';
        element.style.fontSize = '10px';
        element.style.fontFamily = 'Arial, sans-serif';
        element.style.padding = '2px 4px';
        element.style.borderRadius = '2px';
        element.style.backgroundColor = 'rgba(0,0,0,0.5)';
        element.style.pointerEvents = 'none';
        element.style.opacity = '0.8';
        element.style.display = 'none'; // Start hidden, update in updateLabelPositions
        
        document.body.appendChild(element);
        
        // Add to labels array
        labels.push({
            node: node,
            element: element
        });
    });
}

// Update label positions based on camera view
function updateLabelPositions() {
    if (!config.showLabels) return;
    
    labels.forEach(label => {
        const node = label.node;
        const element = label.element;
        
        // Project node position to screen coordinates
        const position = node.position.clone();
        const vector = position.project(camera);
        
        // Convert to CSS coordinates
        const width = renderer.domElement.clientWidth;
        const height = renderer.domElement.clientHeight;
        const x = (vector.x * 0.5 + 0.5) * width;
        const y = (-vector.y * 0.5 + 0.5) * height;
        
        // Check if node is in front of camera (z between -1 and 1 after projection)
        if (vector.z > -1 && vector.z < 1) {
            element.style.display = 'block';
            element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
            
            // Calculate distance to camera for opacity
            const dist = camera.position.distanceTo(node.position);
            const opacity = Math.max(0, Math.min(1, 1 - (dist / 40)));
            element.style.opacity = opacity.toString();
        } else {
            element.style.display = 'none';
        }
    });
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
    
    // Setup scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(
        60,
        (container ? container.clientWidth : window.innerWidth) / 
        (container ? container.clientHeight : window.innerHeight),
        0.1,
        1000
    );
    camera.position.set(SPHERE_RADIUS * 2, SPHERE_RADIUS * 0.5, SPHERE_RADIUS * 2);
    camera.lookAt(0, 0, 0);
    
    // Setup orbit controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = SPHERE_RADIUS * 1.2;
    controls.maxDistance = SPHERE_RADIUS * 4;
    controls.update();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    
    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(SPHERE_RADIUS * 2, SPHERE_RADIUS * 4, SPHERE_RADIUS * 2);
    scene.add(directionalLight);
    
    // Generate network data
    generateSampleNetwork();
    
    // Apply force-directed layout
    applyForceDirectedLayout();
    
    // Initialize edge points and bundle edges
    initializeEdgePoints();
    bundleEdges();
    
    // Create node and edge meshes
    nodesMesh = createNodesMesh();
    edgesMesh = createEdgesMesh();
    
    // Add meshes to scene
    scene.add(nodesMesh);
    scene.add(edgesMesh);
    
    // Create text labels
    createNodeLabels();
    
    // Add a subtle reference sphere
    const sphereGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 32, 32);
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.03,
        wireframe: true
    });
    const referenceSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    scene.add(referenceSphere);
    
    // Setup event listeners
    setupEventListeners();
    
    // Start animation loop
    animate();
    
    console.log("Edge bundling visualization initialized");
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Calculate delta time
    const delta = clock.getDelta();
    
    // Update controls
    controls.update();
    
    // Update label positions when camera moves
    updateLabelPositions();
    
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

// Regenerate the network
function regenerateNetwork() {
    // Remove existing meshes
    if (nodesMesh) scene.remove(nodesMesh);
    if (edgesMesh) scene.remove(edgesMesh);
    
    // Clear labels
    while (labels.length > 0) {
        const label = labels.pop();
        if (label.element) {
            document.body.removeChild(label.element);
        }
    }
    
    // Generate new data
    generateSampleNetwork();
    
    // Apply layout
    applyForceDirectedLayout();
    
    // Bundle edges
    initializeEdgePoints();
    bundleEdges();
    
    // Create new meshes
    nodesMesh = createNodesMesh();
    edgesMesh = createEdgesMesh();
    
    // Add to scene
    scene.add(nodesMesh);
    scene.add(edgesMesh);
    
    // Create new labels
    createNodeLabels();
}

// Update bundling parameters and re-bundle
function updateBundling() {
    // Re-bundle with current settings
    bundleEdges();
    
    // Update edge visualization
    scene.remove(edgesMesh);
    edgesMesh = createEdgesMesh();
    scene.add(edgesMesh);
}

// Toggle node visibility
function toggleNodes() {
    config.showNodes = !config.showNodes;
    
    if (nodesMesh) {
        nodesMesh.visible = config.showNodes;
    }
    
    const nodesToggle = document.getElementById('nodesToggle');
    if (nodesToggle) {
        nodesToggle.textContent = config.showNodes ? 'Hide Nodes' : 'Show Nodes';
    }
}

// Toggle label visibility
function toggleLabels() {
    config.showLabels = !config.showLabels;
    
    labels.forEach(label => {
        if (label.element) {
            label.element.style.display = config.showLabels ? 'block' : 'none';
        }
    });
    
    const labelsToggle = document.getElementById('labelsToggle');
    if (labelsToggle) {
        labelsToggle.textContent = config.showLabels ? 'Hide Labels' : 'Show Labels';
    }
}

// Setup event listeners for UI controls
function setupEventListeners() {
    // Bundling strength slider
    const bundlingStrengthSlider = document.getElementById('bundlingStrength');
    const bundlingStrengthValue = document.getElementById('bundlingStrengthValue');
    
    if (bundlingStrengthSlider && bundlingStrengthValue) {
        bundlingStrengthSlider.value = config.bundlingStrength;
        bundlingStrengthValue.textContent = config.bundlingStrength;
        
        bundlingStrengthSlider.addEventListener('input', function() {
            config.bundlingStrength = parseFloat(this.value);
            bundlingStrengthValue.textContent = config.bundlingStrength;
        });
        
        bundlingStrengthSlider.addEventListener('change', updateBundling);
    }
    
    // Bundling cycles slider
    const bundlingCyclesSlider = document.getElementById('bundlingCycles');
    const bundlingCyclesValue = document.getElementById('bundlingCyclesValue');
    
    if (bundlingCyclesSlider && bundlingCyclesValue) {
        bundlingCyclesSlider.value = config.bundlingCycles;
        bundlingCyclesValue.textContent = config.bundlingCycles;
        
        bundlingCyclesSlider.addEventListener('input', function() {
            config.bundlingCycles = parseInt(this.value);
            bundlingCyclesValue.textContent = config.bundlingCycles;
        });
        
        bundlingCyclesSlider.addEventListener('change', updateBundling);
    }
    
    // Edge opacity slider
    const edgeOpacitySlider = document.getElementById('edgeOpacity');
    const edgeOpacityValue = document.getElementById('edgeOpacityValue');
    
    if (edgeOpacitySlider && edgeOpacityValue) {
        edgeOpacitySlider.value = config.edgeOpacity;
        edgeOpacityValue.textContent = config.edgeOpacity;
        
        edgeOpacitySlider.addEventListener('input', function() {
            config.edgeOpacity = parseFloat(this.value);
            edgeOpacityValue.textContent = config.edgeOpacity;
            
            // Update all edge materials
            if (edgesMesh && edgesMesh.children) {
                edgesMesh.children.forEach(line => {
                    if (line.material) {
                        line.material.opacity = config.edgeOpacity;
                        line.material.needsUpdate = true;
                    }
                });
            }
        });
    }
    
    // Edge thickness slider
    const edgeThicknessSlider = document.getElementById('edgeThickness');
    const edgeThicknessValue = document.getElementById('edgeThicknessValue');
    
    if (edgeThicknessSlider && edgeThicknessValue) {
        edgeThicknessSlider.value = config.edgeThickness;
        edgeThicknessValue.textContent = config.edgeThickness;
        
        edgeThicknessSlider.addEventListener('input', function() {
            config.edgeThickness = parseFloat(this.value);
            edgeThicknessValue.textContent = config.edgeThickness;
            
            // Update all edge materials
            if (edgesMesh && edgesMesh.children) {
                edgesMesh.children.forEach(line => {
                    if (line.material) {
                        line.material.linewidth = config.edgeThickness;
                        line.material.needsUpdate = true;
                    }
                });
            }
        });
    }
    
    // Layout force slider
    const layoutForceSlider = document.getElementById('layoutForce');
    const layoutForceValue = document.getElementById('layoutForceValue');
    
    if (layoutForceSlider && layoutForceValue) {
        layoutForceSlider.value = config.layoutForce;
        layoutForceValue.textContent = config.layoutForce;
        
        layoutForceSlider.addEventListener('input', function() {
            config.layoutForce = parseFloat(this.value);
            layoutForceValue.textContent = config.layoutForce;
        });
        
        layoutForceSlider.addEventListener('change', function() {
            // Re-apply force-directed layout and update visualization
            applyForceDirectedLayout();
            initializeEdgePoints();
            bundleEdges();
            
            // Update visual representation
            scene.remove(nodesMesh);
            scene.remove(edgesMesh);
            nodesMesh = createNodesMesh();
            edgesMesh = createEdgesMesh();
            scene.add(nodesMesh);
            scene.add(edgesMesh);
            createNodeLabels();
        });
    }
    
    // Node size slider
    const nodeSizeSlider = document.getElementById('nodeSize');
    const nodeSizeValue = document.getElementById('nodeSizeValue');
    
    if (nodeSizeSlider && nodeSizeValue) {
        nodeSizeSlider.value = config.nodeSize;
        nodeSizeValue.textContent = config.nodeSize;
        
        nodeSizeSlider.addEventListener('input', function() {
            config.nodeSize = parseFloat(this.value);
            nodeSizeValue.textContent = config.nodeSize;
            
            // Update node size
            if (nodesMesh && nodesMesh.material) {
                nodesMesh.material.uniforms.pointSize.value = config.nodeSize;
                nodesMesh.material.needsUpdate = true;
            }
        });
    }
    
    // Toggle nodes button
    const nodesToggle = document.getElementById('nodesToggle');
    if (nodesToggle) {
        nodesToggle.textContent = config.showNodes ? 'Hide Nodes' : 'Show Nodes';
        nodesToggle.addEventListener('click', toggleNodes);
    }
    
    // Toggle labels button
    const labelsToggle = document.getElementById('labelsToggle');
    if (labelsToggle) {
        labelsToggle.textContent = config.showLabels ? 'Hide Labels' : 'Show Labels';
        labelsToggle.addEventListener('click', toggleLabels);
    }
    
    // Regenerate button
    const regenerateBtn = document.getElementById('regenerateBtn');
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', regenerateNetwork);
    }
    
    // Apply bundling button
    const applyBundlingBtn = document.getElementById('applyBundlingBtn');
    if (applyBundlingBtn) {
        applyBundlingBtn.addEventListener('click', updateBundling);
    }
    
    // Window resize event
    window.addEventListener('resize', onWindowResize);
}

// Initialize the visualization once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for external use
export {
    init,
    regenerateNetwork,
    updateBundling,
    toggleNodes,
    toggleLabels
};