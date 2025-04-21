// js/imports/import-map.js

// Create the import map content
const importMapContent = {
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/"
  }
};

// Function to add the import map to the document
function addImportMap() {
  // Check if import map already exists
  if (document.querySelector('script[type="importmap"]')) {
    console.log("Import map already exists, skipping creation");
    return;
  }

  // Create the import map script element
  const script = document.createElement('script');
  script.type = 'importmap';
  script.textContent = JSON.stringify(importMapContent);
  
  // Add it to the head before any module scripts
  document.head.appendChild(script);
  
  console.log("Three.js import map added successfully");
}

// Run immediately
addImportMap();