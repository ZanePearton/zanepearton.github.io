// js/import-map.js
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