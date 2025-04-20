// Main entry point that imports and initializes all components

// Import all component modules
import { initializeNavigation } from './navigation.js';
import { initializeScrollAnimations, addFadeInToSections } from './animations.js';
import { initializeForms } from './forms.js';
import { createFixedDarkModeToggle, createScrollProgress, createBackToTopButton } from './ui-components.js';
import { setupLazyLoading } from './media-loader.js';
import { animateTechSphere, enhanceCertifications } from './interactive-elements.js';

// Initialize all enhancements with multiple triggers to ensure they run
function initializeEnhancements() {
    createFixedDarkModeToggle();
    createScrollProgress();
    createBackToTopButton();
    setupLazyLoading();
    animateTechSphere();
    enhanceCertifications();
    addFadeInToSections();
    initializeNavigation();
    initializeScrollAnimations();
    initializeForms();
}

// Make sure enhancements run on page load using multiple approaches for reliability
// Use a load event instead of DOMContentLoaded for best compatibility
window.addEventListener('load', () => {
    console.log("Window loaded - initializing enhancements");
    // Wait a moment to ensure DOM is fully ready
    setTimeout(initializeEnhancements, 500);
});

// Also try running the initialization when script is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded - initializing enhancements");
    setTimeout(initializeEnhancements, 300);
});

// Wrapped in a try-catch to prevent any errors from stopping execution
try {
    // Run immediately as a fallback
    console.log("Immediate execution - initializing enhancements");
    setTimeout(initializeEnhancements, 800);
} catch (error) {
    console.error('Error initializing enhancements:', error);
}