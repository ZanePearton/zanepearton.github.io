// js/import-map.js

// Set up the import map for JavaScript modules
const importMap = {
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.155.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.155.0/examples/jsm/",
    "three-subdivide": "https://cdn.jsdelivr.net/npm/three-subdivide@1.1.3/build/index.module.js"
  }
};

// Create and append the import map script element
const script = document.createElement('script');
script.type = 'importmap';
script.textContent = JSON.stringify(importMap);
document.currentScript.after(script);

// Add Font Awesome CSS
const fontAwesomeLink = document.createElement('link');
fontAwesomeLink.rel = 'stylesheet';
fontAwesomeLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css';
document.head.appendChild(fontAwesomeLink);