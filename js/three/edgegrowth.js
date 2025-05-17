// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';


// Debug helper
const debug = {
    log: function (msg) {
        console.log(msg);
        const debugEl = document.getElementById('debug');
        if (debugEl) {
            debugEl.innerHTML += msg + '<br>';
            debugEl.scrollTop = debugEl.scrollHeight;
        }
    },
    clear: function () {
        const debugEl = document.getElementById('debug');
        if (debugEl) { debugEl.innerHTML = ''; }
    }
};

debug.log("Starting differential mesh script...");

try {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111);
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    const container = document.getElementById('canvas-container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        console.error("Canvas container not found, appending to body");
        document.body.appendChild(renderer.domElement);
    }

    // Lighting
    scene.add(new THREE.AmbientLight(0x404040));
    const light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(1, 1, 1);
    scene.add(light);
    const light2 = new THREE.DirectionalLight(0xffffff, 0.5);
    light2.position.set(-1, 1, -1);
    scene.add(light2);

    // Constants
    const RELAX_FACTOR = 0.05;
    const EDGE_LENGTH = 0.01;
    const MIN_RADIUS = 0.05;
    const TRIANGLE_COLLISION_THRESHOLD = 0.8;
    let maxTrianglesToCheck = 100;

    // Ground plane
    const planeGeometry = new THREE.PlaneGeometry(10, 10);
    const planeMaterial = new THREE.MeshBasicMaterial({
        color: 0x333333,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = Math.PI / 2;
    plane.position.y = -1;
    scene.add(plane);

    // Camera setup
    camera.position.z = 3;

    // Simple orbit controls
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    const cameraTarget = new THREE.Vector3(0, 0, 0);

    renderer.domElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;
        const cameraPosition = camera.position.clone().sub(cameraTarget);
        const quaternionY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -deltaX * 0.01);
        cameraPosition.applyQuaternion(quaternionY);
        const right = new THREE.Vector3(1, 0, 0);
        right.applyQuaternion(camera.quaternion);
        const quaternionX = new THREE.Quaternion().setFromAxisAngle(right, -deltaY * 0.01);
        cameraPosition.applyQuaternion(quaternionX);
        camera.position.copy(cameraPosition.add(cameraTarget));
        camera.lookAt(cameraTarget);
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    renderer.domElement.addEventListener('mouseup', () => isDragging = false);
    renderer.domElement.addEventListener('mouseleave', () => isDragging = false);

    renderer.domElement.addEventListener('wheel', (e) => {
        const delta = Math.sign(e.deltaY);
        const cameraPosition = camera.position.clone().sub(cameraTarget);
        cameraPosition.multiplyScalar(1 + delta * 0.1);
        camera.position.copy(cameraPosition.add(cameraTarget));
    });

    // Mesh variables
    const vertices = [];
    const vertexAges = [];
    let edges = [];
    let faces = [];
    let mesh, edgeLines;
    let iteration = 0;

    // Control variables
    let isRunning = true;
    let lastUpdate = 0;
    let updateInterval = 100; // ms

    // UI controls
    document.getElementById('resetBtn').addEventListener('click', resetMesh);
    document.getElementById('pauseBtn').addEventListener('click', togglePause);
    document.getElementById('debugBtn').addEventListener('click', () => debug.clear());
    document.getElementById('speedSlider').addEventListener('input', updateSpeed);
    document.getElementById('collisionSlider').addEventListener('input', updateCollisionCheck);
    // New adaptive smooth button
    document.getElementById('adaptiveSmoothBtn').addEventListener('click', adaptiveSmooth);

    function togglePause() {
        isRunning = !isRunning;
        document.getElementById('pauseBtn').textContent = isRunning ? 'Pause' : 'Resume';
        debug.log(isRunning ? "Resumed" : "Paused");
    }

    function updateSpeed(e) {
        updateInterval = parseInt(e.target.value);
        debug.log(`Speed set to ${updateInterval}ms`);
    }

    function updateCollisionCheck(e) {
        maxTrianglesToCheck = parseInt(e.target.value);
        document.getElementById('collisionValue').textContent = maxTrianglesToCheck;
        debug.log(`Collision checks set to ${maxTrianglesToCheck}`);
    }

    // --- Mesh Functions ---

    function checkTriangleCollision(faceA, faceB) {
        if (faceA.some(v => faceB.includes(v))) return;
        try {
            const a1 = vertices[faceA[0]], a2 = vertices[faceA[1]], a3 = vertices[faceA[2]];
            const b1 = vertices[faceB[0]], b2 = vertices[faceB[1]], b3 = vertices[faceB[2]];
            const centerA = new THREE.Vector3().add(a1).add(a2).add(a3).divideScalar(3);
            const centerB = new THREE.Vector3().add(b1).add(b2).add(b3).divideScalar(3);
            const normalA = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(a2, a1),
                new THREE.Vector3().subVectors(a3, a1)
            ).normalize();
            const normalB = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(b2, b1),
                new THREE.Vector3().subVectors(b3, b1)
            ).normalize();

            if (centerA.distanceTo(centerB) < TRIANGLE_COLLISION_THRESHOLD) {
                const repulsionDir = new THREE.Vector3().subVectors(centerA, centerB).normalize();
                const force = repulsionDir.clone().multiplyScalar(0.05);
                const normalForceA = normalA.clone().multiplyScalar(0.02);
                const normalForceB = normalB.clone().multiplyScalar(0.02);
                vertices[faceA[0]].add(force).add(normalForceA);
                vertices[faceA[1]].add(force).add(normalForceA);
                vertices[faceA[2]].add(force).add(normalForceA);
                vertices[faceB[0]].sub(force).add(normalForceB);
                vertices[faceB[1]].sub(force).add(normalForceB);
                vertices[faceB[2]].sub(force).add(normalForceB);
            }
        } catch (error) {
            console.error("Error in checkTriangleCollision:", error);
            debug.log(`ERROR in checkTriangleCollision: ${error.message}`);
        }
    }

    function detectTriangleCollisions() {
        try {
            if (faces.length > maxTrianglesToCheck) {
                const sampled = [];
                for (let i = 0; i < maxTrianglesToCheck; i++) {
                    sampled.push(Math.floor(Math.random() * faces.length));
                }
                for (let i = 0; i < sampled.length; i++) {
                    for (let j = i + 1; j < sampled.length; j++) {
                        checkTriangleCollision(faces[sampled[i]], faces[sampled[j]]);
                    }
                }
                return;
            }
            for (let i = 0; i < faces.length; i++) {
                for (let j = i + 1; j < faces.length; j++) {
                    checkTriangleCollision(faces[i], faces[j]);
                }
            }
        } catch (error) {
            console.error("Error in detectTriangleCollisions:", error);
            debug.log(`ERROR in detectTriangleCollisions: ${error.message}`);
        }
    }

    function relax() {
        try {
            for (const [i, j] of edges) {
                const v1 = vertices[i], v2 = vertices[j];
                const dist = v1.distanceTo(v2);
                if (dist !== EDGE_LENGTH) {
                    const force = new THREE.Vector3().subVectors(v2, v1);
                    const strength = (dist - EDGE_LENGTH) * 0.2 * RELAX_FACTOR;
                    force.normalize().multiplyScalar(strength);
                    v1.add(force);
                    v2.sub(force);
                }
            }
            detectTriangleCollisions();
            for (const vertex of vertices) {
                const distFromCenter = vertex.length();
                if (distFromCenter < MIN_RADIUS) {
                    const pushDirection = vertex.clone().normalize();
                    const pushAmount = MIN_RADIUS - distFromCenter;
                    pushDirection.multiplyScalar(pushAmount * 0.2);
                    vertex.add(pushDirection);
                }
            }
            const planeY = -1.0;
            for (const vertex of vertices) {
                if (vertex.y < planeY) {
                    vertex.y = planeY + (planeY - vertex.y) * 0.1;
                }
            }
        } catch (error) {
            console.error("Error in relax:", error);
            debug.log(`ERROR in relax: ${error.message}`);
        }
    }

    // --- New Function: Optimize Floor Plates ---
    function optimizeFloorPlates() {
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            const v1 = vertices[face[0]], v2 = vertices[face[1]], v3 = vertices[face[2]];
            const normal = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(v2, v1),
                new THREE.Vector3().subVectors(v3, v1)
            ).normalize();
            if (Math.abs(normal.y) > 0.95) { // nearly horizontal
                const avgY = (v1.y + v2.y + v3.y) / 3;
                v1.y = avgY; v2.y = avgY; v3.y = avgY;
            }
        }
    }

    // --- New Function: Optimize Curved Slopes ---
    function optimizeCurvedSlopes() {
        for (let i = 0; i < faces.length; i++) {
            const face = faces[i];
            const v1 = vertices[face[0]], v2 = vertices[face[1]], v3 = vertices[face[2]];
            const normal = new THREE.Vector3().crossVectors(
                new THREE.Vector3().subVectors(v2, v1),
                new THREE.Vector3().subVectors(v3, v1)
            ).normalize();
            if (Math.abs(normal.y) > 0.95) continue;

            const yVals = [v1.y, v2.y, v3.y];
            const avgY = (yVals[0] + yVals[1] + yVals[2]) / 3;
            const minY = Math.min(...yVals);
            const maxY = Math.max(...yVals);
            const rangeY = maxY - minY;
            if (rangeY > 0.005 && rangeY < 0.1) {
                [v1, v2, v3].forEach(v => {
                    const diff = v.y - avgY;
                    const r = diff / (rangeY / 2); // normalized to [-1,1]
                    const newR = Math.sin(r * (Math.PI / 2));
                    v.y = avgY + newR * (rangeY / 2);
                });
            }
        }
    }

    // --- New Function: Smooth Differential Growth ---
    function smoothDifferentialGrowth() {
        const neighborMap = [];
        for (let i = 0; i < vertices.length; i++) {
            neighborMap[i] = [];
        }
        edges.forEach(edge => {
            const [a, b] = edge;
            neighborMap[a].push(b);
            neighborMap[b].push(a);
        });
        const newPositions = vertices.map(v => v.clone());
        for (let i = 0; i < vertices.length; i++) {
            const neighbors = neighborMap[i];
            if (neighbors.length > 0) {
                const avg = new THREE.Vector3(0, 0, 0);
                neighbors.forEach(n => { avg.add(vertices[n]); });
                avg.divideScalar(neighbors.length);
                const factor = 0.1;
                const delta = new THREE.Vector3().subVectors(avg, vertices[i]);
                newPositions[i].add(delta.multiplyScalar(factor));
            }
        }
        for (let i = 0; i < vertices.length; i++) {
            vertices[i].copy(newPositions[i]);
        }
    }

    // --- New Function: Adaptive Smooth ---
    // Smooth only vertices with high local curvature.
    function adaptiveSmooth() {
        const curvatureThreshold = 0.2; // adjust threshold as needed
        const highCurvatureVertices = new Set();
        // Determine curvature per vertex
        for (let i = 0; i < vertices.length; i++) {
            let connectedFaces = [];
            for (let f = 0; f < faces.length; f++) {
                if (faces[f].includes(i)) {
                    connectedFaces.push(f);
                }
            }
            if (connectedFaces.length < 2) continue;
            let normals = [];
            connectedFaces.forEach(faceIdx => {
                const face = faces[faceIdx];
                const [a, b, c] = face;
                const v1 = vertices[a], v2 = vertices[b], v3 = vertices[c];
                const normal = new THREE.Vector3().crossVectors(
                    new THREE.Vector3().subVectors(v2, v1),
                    new THREE.Vector3().subVectors(v3, v1)
                ).normalize();
                normals.push(normal);
            });
            let totalAngle = 0, count = 0;
            for (let j = 0; j < normals.length; j++) {
                for (let k = j + 1; k < normals.length; k++) {
                    let dot = normals[j].dot(normals[k]);
                    let angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                    totalAngle += angle;
                    count++;
                }
            }
            let averageAngle = count > 0 ? totalAngle / count : 0;
            if (averageAngle > curvatureThreshold) {
                highCurvatureVertices.add(i);
            }
        }

        // Build neighbor map from edges
        const neighborMap = [];
        for (let i = 0; i < vertices.length; i++) {
            neighborMap[i] = [];
        }
        edges.forEach(edge => {
            const [a, b] = edge;
            neighborMap[a].push(b);
            neighborMap[b].push(a);
        });
        // Smooth only high-curvature vertices
        highCurvatureVertices.forEach(i => {
            const neighbors = neighborMap[i];
            if (neighbors.length === 0) return;
            let avg = new THREE.Vector3(0, 0, 0);
            neighbors.forEach(n => { avg.add(vertices[n]); });
            avg.divideScalar(neighbors.length);
            const factor = 0.2; // move 20% toward the neighbor average
            let delta = new THREE.Vector3().subVectors(avg, vertices[i]);
            vertices[i].add(delta.multiplyScalar(factor));
        });
        debug.log(`Adaptive smooth applied to ${highCurvatureVertices.size} vertices.`);
        updateMesh();
    }

    function splitSpecificEdge(edgeIndex) {
        try {
            if (edgeIndex >= edges.length) return;
            debug.log(`Splitting edge ${edgeIndex}`);
            const [a, b] = edges[edgeIndex];
            const v1 = vertices[a], v2 = vertices[b];
            const midpoint = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
            const randomDir = new THREE.Vector3(
                Math.random() > 0.5 ? 0.05 : -0.05,
                Math.random() > 0.5 ? 0.05 : -0.05,
                Math.random() > 0.5 ? 0.05 : -0.05
            );
            midpoint.add(randomDir.multiplyScalar(0.5));
            const newIndex = vertices.length;
            vertices.push(midpoint);
            vertexAges.push(iteration);
            edges.splice(edgeIndex, 1);
            edges.push([a, newIndex], [b, newIndex]);
            const affectedFaces = [];
            for (let i = 0; i < faces.length; i++) {
                if (faces[i].includes(a) && faces[i].includes(b)) {
                    affectedFaces.push(i);
                }
            }
            for (let i = affectedFaces.length - 1; i >= 0; i--) {
                const faceIndex = affectedFaces[i];
                const face = faces[faceIndex];
                const c = face.find(v => v !== a && v !== b);
                faces.splice(faceIndex, 1);
                faces.push([a, newIndex, c], [b, newIndex, c]);
                edges.push([newIndex, c]);
            }
        } catch (error) {
            console.error("Error in splitSpecificEdge:", error);
            debug.log(`ERROR in splitSpecificEdge: ${error.message}`);
        }
    }

    function detectAndRefineHighCurvatureAreas() {
        if (faces.length < 3) return;
        try {
            const highCurvatureVertices = new Set();
            for (let v = 0; v < vertices.length; v++) {
                let connectedFaces = [];
                for (let f = 0; f < faces.length; f++) {
                    if (faces[f].includes(v)) connectedFaces.push(f);
                }
                if (connectedFaces.length < 2) continue;
                let normals = [];
                connectedFaces.forEach(faceIdx => {
                    const face = faces[faceIdx];
                    const [a, b, c] = face;
                    const v1 = vertices[a], v2 = vertices[b], v3 = vertices[c];
                    const normal = new THREE.Vector3().crossVectors(
                        new THREE.Vector3().subVectors(v2, v1),
                        new THREE.Vector3().subVectors(v3, v1)
                    ).normalize();
                    normals.push(normal);
                });
                let totalAngle = 0, count = 0;
                for (let i = 0; i < normals.length; i++) {
                    for (let j = i + 1; j < normals.length; j++) {
                        let dot = normals[i].dot(normals[j]);
                        let angle = Math.acos(Math.max(-1, Math.min(1, dot)));
                        totalAngle += angle;
                        count++;
                    }
                }
                let averageAngle = count > 0 ? totalAngle / count : 0;
                if (averageAngle > 0.1) {
                    highCurvatureVertices.add(v);
                }
            }
            if (highCurvatureVertices.size > 0 && Math.random() < 0.7) {
                debug.log(`Found ${highCurvatureVertices.size} high curvature vertices`);
                const candidateEdges = [];
                for (let e = 0; e < edges.length; e++) {
                    const [a, b] = edges[e];
                    if (highCurvatureVertices.has(a) || highCurvatureVertices.has(b)) {
                        candidateEdges.push(e);
                    }
                }
                if (candidateEdges.length > 0) {
                    const edgeToSplit = candidateEdges[Math.floor(Math.random() * candidateEdges.length)];
                    splitSpecificEdge(edgeToSplit);
                }
            }
        } catch (error) {
            console.error("Error in detectAndRefineHighCurvatureAreas:", error);
            debug.log(`ERROR in detectAndRefineHighCurvatureAreas: ${error.message}`);
        }
    }

    function splitRandomEdge() {
        debug.log("Attempting to split random edge");
        try {
            if (edges.length === 0) return;
            const edgeIndex = Math.floor(Math.random() * edges.length);
            const [a, b] = edges[edgeIndex];
            const v1 = vertices[a], v2 = vertices[b];
            const midpoint = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
            const randomDir = new THREE.Vector3(
                Math.random() > 0.5 ? 0.1 : -0.1,
                Math.random() > 0.5 ? 0.1 : -0.1,
                Math.random() > 0.5 ? 0.1 : -0.1
            );
            if (Math.random() < 0.7) {
                const edgeDir = new THREE.Vector3().subVectors(v2, v1).normalize();
                const perpDir = new THREE.Vector3().crossVectors(edgeDir, new THREE.Vector3(0, 1, 0)).normalize();
                const displacement = new THREE.Vector3()
                    .addScaledVector(edgeDir, 0.05)
                    .addScaledVector(perpDir, 0.05);
                midpoint.add(displacement);
            } else {
                midpoint.add(randomDir);
            }
            const newIndex = vertices.length;
            vertices.push(midpoint);
            vertexAges.push(iteration);
            edges.splice(edgeIndex, 1);
            edges.push([a, newIndex], [b, newIndex]);
            const affectedFaces = [];
            for (let i = 0; i < faces.length; i++) {
                if (faces[i].includes(a) && faces[i].includes(b)) {
                    affectedFaces.push(i);
                }
            }
            debug.log(`Found ${affectedFaces.length} affected faces for edge [${a},${b}]`);
            for (let i = affectedFaces.length - 1; i >= 0; i--) {
                const faceIndex = affectedFaces[i];
                const face = faces[faceIndex];
                const c = face.find(v => v !== a && v !== b);
                faces.splice(faceIndex, 1);
                faces.push([a, newIndex, c], [b, newIndex, c]);
                edges.push([newIndex, c]);
            }
        } catch (error) {
            console.error("Error in splitRandomEdge:", error);
            debug.log(`ERROR in splitRandomEdge: ${error.message}`);
        }
    }

    function subdivideRandomFace() {
        try {
            if (faces.length === 0) return;
            debug.log("Subdividing random face");
            const faceIndex = Math.floor(Math.random() * faces.length);
            const face = faces[faceIndex];
            const [a, b, c] = face;
            const v1 = vertices[a], v2 = vertices[b], v3 = vertices[c];
            const center = new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);
            const randomDir = new THREE.Vector3(
                Math.random() > 0.5 ? 0.05 : -0.05,
                Math.random() > 0.5 ? 0.05 : -0.05,
                Math.random() > 0.5 ? 0.05 : -0.05
            );
            const v1Vec = new THREE.Vector3().subVectors(v2, v1);
            const v2Vec = new THREE.Vector3().subVectors(v3, v1);
            const normal = new THREE.Vector3().crossVectors(v1Vec, v2Vec).normalize();
            if (Math.random() < 0.6) {
                const edgeDir = new THREE.Vector3().subVectors(v2, v1).normalize();
                const displacement = new THREE.Vector3()
                    .addScaledVector(normal, 0.05)
                    .addScaledVector(edgeDir, 0.05);
                center.add(displacement);
            } else {
                center.add(randomDir);
            }
            const newVertex = vertices.length;
            vertices.push(center);
            vertexAges.push(iteration);
            faces.splice(faceIndex, 1);
            faces.push([a, b, newVertex], [b, c, newVertex], [c, a, newVertex]);
            edges.push([a, newVertex], [b, newVertex], [c, newVertex]);
        } catch (error) {
            console.error("Error in subdivideRandomFace:", error);
            debug.log(`ERROR in subdivideRandomFace: ${error.message}`);
        }
    }

    function initMesh() {
        debug.log("Initializing mesh...");
        try {
            vertices.length = 0;
            vertexAges.length = 0;
            edges = [];
            faces = [];
            iteration = 0;
            const positions = [
                [0, 0, 0],
                [0.1, 0, 0],
                [0.1, 0.166, 0]
            ];
            for (const pos of positions) {
                vertices.push(new THREE.Vector3(...pos));
                vertexAges.push(0);
            }
            edges = [[0, 1], [1, 2], [2, 0]];
            faces = [[0, 1, 2]];
            debug.log(`Created initial mesh with ${vertices.length} vertices, ${faces.length} faces`);
            updateMesh();
        } catch (error) {
            console.error("Error in initMesh:", error);
            debug.log(`ERROR in initMesh: ${error.message}`);
        }
    }

    function updateMesh() {
        debug.log(`Updating mesh with ${vertices.length} vertices, ${faces.length} faces`);
        try {
            if (mesh) scene.remove(mesh);
            if (edgeLines) scene.remove(edgeLines);
            const geometry = new THREE.BufferGeometry();
            const posArray = new Float32Array(faces.length * 9);
            const colorArray = new Float32Array(faces.length * 9);
            for (let i = 0; i < faces.length; i++) {
                const face = faces[i];
                for (let j = 0; j < 3; j++) {
                    const vertexIndex = face[j];
                    if (vertexIndex >= vertices.length) {
                        console.error(`Invalid vertex index ${vertexIndex} in face ${i}`);
                        continue;
                    }
                    const vertex = vertices[vertexIndex];
                    const baseIndex = i * 9 + j * 3;
                    posArray[baseIndex] = vertex.x;
                    posArray[baseIndex + 1] = vertex.y;
                    posArray[baseIndex + 2] = vertex.z;
                    const age = vertexAges[vertexIndex];
                    const t = Math.min(1, age / Math.max(1, iteration));
                    const heightFactor = (vertex.y + 1) / 2;
                    const distanceFromCenter = vertex.length();
                    colorArray[baseIndex] = 0.2 + 0.8 * (1 - t);
                    colorArray[baseIndex + 1] = 0.2 + 0.6 * heightFactor;
                    colorArray[baseIndex + 2] = 0.2 + 0.8 * t + 0.2 * (distanceFromCenter / 5);
                }
            }
            geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
            geometry.computeVertexNormals();
            const material = new THREE.MeshPhongMaterial({
                vertexColors: true,
                flatShading: false,
                side: THREE.DoubleSide
            });
            mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            const edgeGeometry = new THREE.BufferGeometry();
            const edgePosArray = new Float32Array(edges.length * 6);
            for (let i = 0; i < edges.length; i++) {
                const [a, b] = edges[i];
                const v1 = vertices[a], v2 = vertices[b];
                const baseIndex = i * 6;
                edgePosArray[baseIndex] = v1.x;
                edgePosArray[baseIndex + 1] = v1.y;
                edgePosArray[baseIndex + 2] = v1.z;
                edgePosArray[baseIndex + 3] = v2.x;
                edgePosArray[baseIndex + 4] = v2.y;
                edgePosArray[baseIndex + 5] = v2.z;
            }
            edgeGeometry.setAttribute('position', new THREE.BufferAttribute(edgePosArray, 3));
            const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x888888, opacity: 0.3, transparent: true });
            edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            scene.add(edgeLines);
            document.getElementById('stats').textContent = `Vertices: ${vertices.length} | Faces: ${faces.length} | Iter: ${iteration}`;
        } catch (error) {
            console.error("Error in updateMesh:", error);
            debug.log(`ERROR in updateMesh: ${error.message}`);
        }
    }

    function evolve() {
        iteration++;
        debug.log(`Evolving mesh, iteration ${iteration}`);
        try {
            relax();
            optimizeFloorPlates();    // Flatten nearly horizontal floors
            optimizeCurvedSlopes();     // Remap slopes to accentuate curvature
            smoothDifferentialGrowth(); // Apply organic smoothing
            detectAndRefineHighCurvatureAreas();
            const growthProbability = Math.min(0.95, 1.0 + (iteration / 500));
            if (Math.random() < growthProbability) {
                const numSplits = Math.floor(8 + Math.random() * 2);
                for (let i = 0; i < numSplits; i++) {
                    splitRandomEdge();
                }
                if (Math.random() < 0.5) {
                    subdivideRandomFace();
                }
            }
            updateMesh();
        } catch (error) {
            console.error("Error in evolve:", error);
            debug.log(`ERROR in evolve: ${error.message}`);
        }
    }


    function resetMesh() {
        debug.log("Resetting mesh");
        initMesh();
    }

    function animate(time) {
        requestAnimationFrame(animate);
        try {
            if (isRunning && time - lastUpdate > updateInterval) {
                lastUpdate = time;
                evolve();
            }
            renderer.render(scene, camera);
        } catch (error) {
            console.error("Error in animation loop:", error);
            debug.log(`ERROR in animation loop: ${error.message}`);
        }
    }

    // Initialize and start
    initMesh();
    debug.log("Starting animation loop");
    animate(0);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

} catch (error) {
    console.error("Error in differential mesh script:", error);
    debug.log(`ERROR in script: ${error.message}`);
}
