// Import necessary modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

// Initialize variables
let renderer, scene, camera, controls;
let gyroid, material, gradientTexture;
let clock = new THREE.Clock();

// Configuration parameters
let config = {
    resolution: 32,
    isoLevel: 0,
    scaleX: 1.0,
    scaleY: 1.0,
    scaleZ: 1.0,
    colorScheme: 'normals',
    rotationSpeed: 1.0
};

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

    // Setup scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    // Setup camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(3, 3, 3);

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
    
    // Create gyroid
    createGyroid();
    
    // Setup event listeners
    setupEventListeners();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
    
    console.log("Gyroid visualization initialized");
}

// Create material based on color scheme selection
function createMaterial() {
    let newMaterial;
    
    switch(config.colorScheme) {
        case 'gradient':
            // Create a gradient texture
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const context = canvas.getContext('2d');
            
            // Create gradient from orange to purple
            const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#ff9500');  // Orange
            gradient.addColorStop(1, '#af52de');  // Purple
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, canvas.height);
            
            // Create texture from canvas
            gradientTexture = new THREE.CanvasTexture(canvas);
            gradientTexture.needsUpdate = true;
            
            newMaterial = new THREE.MeshPhongMaterial({
                map: gradientTexture,
                specular: 0x111111,
                shininess: 50,
                side: THREE.DoubleSide,
                wireframe: config.colorScheme === 'wireframe'
            });
            break;
            
        case 'wireframe':
            newMaterial = new THREE.MeshPhongMaterial({
                color: 0x000000,
                wireframe: true,
                side: THREE.DoubleSide
            });
            break;
            
        case 'rainbow':
            // Create rainbow color material
            const rainbowCanvas = document.createElement('canvas');
            rainbowCanvas.width = 512;
            rainbowCanvas.height = 512;
            const rainbowContext = rainbowCanvas.getContext('2d');
            
            // Create rainbow gradient
            const rainbowGradient = rainbowContext.createLinearGradient(0, 0, rainbowCanvas.width, 0);
            rainbowGradient.addColorStop(0, '#ff0000');
            rainbowGradient.addColorStop(1/6, '#ff9900');
            rainbowGradient.addColorStop(2/6, '#ffff00');
            rainbowGradient.addColorStop(3/6, '#00ff00');
            rainbowGradient.addColorStop(4/6, '#0099ff');
            rainbowGradient.addColorStop(5/6, '#0000ff');
            rainbowGradient.addColorStop(1, '#9900ff');
            
            rainbowContext.fillStyle = rainbowGradient;
            rainbowContext.fillRect(0, 0, rainbowCanvas.width, rainbowCanvas.height);
            
            const rainbowTexture = new THREE.CanvasTexture(rainbowCanvas);
            rainbowTexture.needsUpdate = true;
            
            newMaterial = new THREE.MeshPhongMaterial({
                map: rainbowTexture,
                specular: 0x222222,
                shininess: 60,
                side: THREE.DoubleSide
            });
            break;
            
        case 'normals':
            newMaterial = new THREE.MeshNormalMaterial({
                side: THREE.DoubleSide
            });
            break;
            
        default:
            newMaterial = new THREE.MeshPhongMaterial({
                color: 0x0088ff,
                specular: 0x111111,
                shininess: 50,
                side: THREE.DoubleSide
            });
    }
    
    return newMaterial;
}

// Create or update the gyroid using MarchingCubes
function createGyroid() {
    if (gyroid) {
        scene.remove(gyroid);
        if (gyroid.material.map) {
            gyroid.material.map.dispose();
        }
        gyroid.material.dispose();
    }
    
    // Create new material with current settings
    material = createMaterial();
    
    // Create a new marching cubes object
    const marchingCubes = new MarchingCubes(config.resolution, material, true, false, 100000);
    marchingCubes.isolation = config.isoLevel;
    
    // Position the gyroid in the center of the scene
    marchingCubes.position.set(0, 0, 0);
    marchingCubes.scale.set(config.scaleX, config.scaleY, config.scaleZ);
    
    // Calculate the gyroid field
    updateGyroidField(marchingCubes);
    
    // Add to scene
    gyroid = marchingCubes;
    scene.add(gyroid);
}

// Update the gyroid field
function updateGyroidField(object) {
    if (!object) return;
    
    // Reset the field
    object.reset();
    
    // Get current time for animation
    const time = clock.getElapsedTime() * config.rotationSpeed;
    
    // Calculate the gyroid field
    const size = object.size;
    const period = 1.0;
    
    for (let x = 0; x < size; x++) {
        for (let y = 0; y < size; y++) {
            for (let z = 0; z < size; z++) {
                // Map coordinates to [-pi, pi] range
                const xp = (x / size * 2 - 1) * Math.PI * period;
                const yp = (y / size * 2 - 1) * Math.PI * period;
                const zp = (z / size * 2 - 1) * Math.PI * period;
                
                // Animation offset
                const offset = time * 0.1;
                
                // Standard gyroid equation
                const gyroidValue = Math.sin(xp + offset) * Math.cos(yp) + 
                                  Math.sin(yp) * Math.cos(zp + offset) + 
                                  Math.sin(zp) * Math.cos(xp + offset);
                
                // Set the value in the field
                object.setCell(x, y, z, gyroidValue);
            }
        }
    }
    
    // Update the surface
    object.update();
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update controls
    controls.update();
    
    // Rotate the gyroid
    if (gyroid && config.rotationSpeed > 0) {
        gyroid.rotation.y += 0.002 * config.rotationSpeed;
    }
    
    // Update gyroid field for animation effects
    updateGyroidField(gyroid);
    
    // Render the scene
    renderer.render(scene, camera);
}

// Handle window resize
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth / window.innerHeight);
}

// Setup UI event listeners
function setupEventListeners() {
    // Resolution slider
    const resolutionSlider = document.getElementById('resolution');
    const resolutionValue = document.getElementById('resolutionValue');
    
    if (resolutionSlider && resolutionValue) {
        resolutionSlider.value = config.resolution;
        resolutionValue.textContent = config.resolution;
        
        resolutionSlider.addEventListener('input', function() {
            config.resolution = parseInt(this.value);
            resolutionValue.textContent = config.resolution;
            createGyroid();
        });
    }
    
    // Iso Level slider
    const isoLevelSlider = document.getElementById('isoLevel');
    const isoLevelValue = document.getElementById('isoLevelValue');
    
    if (isoLevelSlider && isoLevelValue) {
        isoLevelSlider.value = config.isoLevel;
        isoLevelValue.textContent = config.isoLevel.toFixed(2);
        
        isoLevelSlider.addEventListener('input', function() {
            config.isoLevel = parseFloat(this.value);
            isoLevelValue.textContent = config.isoLevel.toFixed(2);
            
            if (gyroid) {
                gyroid.isolation = config.isoLevel;
                gyroid.update();
            }
        });
    }
    
    // Scale X slider
    const scaleXSlider = document.getElementById('scaleX');
    const scaleXValue = document.getElementById('scaleXValue');
    
    if (scaleXSlider && scaleXValue) {
        scaleXSlider.value = config.scaleX;
        scaleXValue.textContent = config.scaleX.toFixed(1);
        
        scaleXSlider.addEventListener('input', function() {
            config.scaleX = parseFloat(this.value);
            scaleXValue.textContent = config.scaleX.toFixed(1);
            
            if (gyroid) {
                gyroid.scale.x = config.scaleX;
            }
        });
    }
    
    // Scale Y slider
    const scaleYSlider = document.getElementById('scaleY');
    const scaleYValue = document.getElementById('scaleYValue');
    
    if (scaleYSlider && scaleYValue) {
        scaleYSlider.value = config.scaleY;
        scaleYValue.textContent = config.scaleY.toFixed(1);
        
        scaleYSlider.addEventListener('input', function() {
            config.scaleY = parseFloat(this.value);
            scaleYValue.textContent = config.scaleY.toFixed(1);
            
            if (gyroid) {
                gyroid.scale.y = config.scaleY;
            }
        });
    }
    
    // Scale Z slider
    const scaleZSlider = document.getElementById('scaleZ');
    const scaleZValue = document.getElementById('scaleZValue');
    
    if (scaleZSlider && scaleZValue) {
        scaleZSlider.value = config.scaleZ;
        scaleZValue.textContent = config.scaleZ.toFixed(1);
        
        scaleZSlider.addEventListener('input', function() {
            config.scaleZ = parseFloat(this.value);
            scaleZValue.textContent = config.scaleZ.toFixed(1);
            
            if (gyroid) {
                gyroid.scale.z = config.scaleZ;
            }
        });
    }
    
    // Color scheme selector
    const colorSchemeSelect = document.getElementById('colorScheme');
    
    if (colorSchemeSelect) {
        colorSchemeSelect.value = config.colorScheme;
        
        colorSchemeSelect.addEventListener('change', function() {
            config.colorScheme = this.value;
            createGyroid();
        });
    }
    
    // Rotation speed slider
    const rotationSpeedSlider = document.getElementById('rotationSpeed');
    const rotationSpeedValue = document.getElementById('rotationSpeedValue');
    
    if (rotationSpeedSlider && rotationSpeedValue) {
        rotationSpeedSlider.value = config.rotationSpeed;
        rotationSpeedValue.textContent = config.rotationSpeed.toFixed(1);
        
        rotationSpeedSlider.addEventListener('input', function() {
            config.rotationSpeed = parseFloat(this.value);
            rotationSpeedValue.textContent = config.rotationSpeed.toFixed(1);
        });
    }
    
    // Reset button
    const resetButton = document.getElementById('resetButton');
    
    if (resetButton) {
        resetButton.addEventListener('click', function() {
            // Reset to default values
            config = {
                resolution: 32,
                isoLevel: 0,
                scaleX: 1.0,
                scaleY: 1.0,
                scaleZ: 1.0,
                colorScheme: 'normals',
                rotationSpeed: 1.0
            };
            
            // Update UI to reflect reset values
            if (resolutionSlider && resolutionValue) {
                resolutionSlider.value = config.resolution;
                resolutionValue.textContent = config.resolution;
            }
            
            if (isoLevelSlider && isoLevelValue) {
                isoLevelSlider.value = config.isoLevel;
                isoLevelValue.textContent = config.isoLevel.toFixed(2);
            }
            
            if (scaleXSlider && scaleXValue) {
                scaleXSlider.value = config.scaleX;
                scaleXValue.textContent = config.scaleX.toFixed(1);
            }
            
            if (scaleYSlider && scaleYValue) {
                scaleYSlider.value = config.scaleY;
                scaleYValue.textContent = config.scaleY.toFixed(1);
            }
            
            if (scaleZSlider && scaleZValue) {
                scaleZSlider.value = config.scaleZ;
                scaleZValue.textContent = config.scaleZ.toFixed(1);
            }
            
            if (colorSchemeSelect) {
                colorSchemeSelect.value = config.colorScheme;
            }
            
            if (rotationSpeedSlider && rotationSpeedValue) {
                rotationSpeedSlider.value = config.rotationSpeed;
                rotationSpeedValue.textContent = config.rotationSpeed.toFixed(1);
            }
            
            // Recreate gyroid with reset values
            createGyroid();
        });
    }
}

// Initialize the visualization once the DOM is loaded
document.addEventListener('DOMContentLoaded', init);