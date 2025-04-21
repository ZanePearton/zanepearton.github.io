// sidebar.js - Enhanced with dark mode compatibility
document.addEventListener('DOMContentLoaded', function() {
    const controlsPanel = document.getElementById('controls');
    const minimizeButton = document.getElementById('minimizeControls');
    const controlsInner = document.querySelector('.controls-inner');
    
    // Initialize sidebar state (check if a stored state exists)
    const isSidebarMinimized = localStorage.getItem('sidebarMinimized') === 'true';
    if (isSidebarMinimized && controlsPanel) {
        controlsPanel.classList.add('minimized');
        // Update icon
        const icon = minimizeButton?.querySelector('i');
        if (icon) {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-left');
        }
    }
    
    // Setup minimize button click handler
    if (minimizeButton && controlsPanel) {
        minimizeButton.addEventListener('click', function() {
            // Toggle minimized class
            controlsPanel.classList.toggle('minimized');
            
            // Store state in localStorage
            localStorage.setItem('sidebarMinimized', controlsPanel.classList.contains('minimized'));
            
            // Toggle button icon
            const icon = minimizeButton.querySelector('i');
            if (controlsPanel.classList.contains('minimized')) {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
            } else {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
            }
        });
    }
    
    // Dark mode awareness
    // This ensures proper styling when dark mode changes
    function updateControlsForDarkMode() {
        const isDarkMode = document.body.classList.contains('dark-mode');
        
        // Make sure the sidebar reflects the current theme
        if (controlsInner) {
            // Force a repaint of the sidebar with the new styles
            controlsInner.style.display = 'none';
            // This forces a repaint
            void controlsInner.offsetHeight;
            controlsInner.style.display = '';
        }
        
        console.log("Controls updated for dark mode:", isDarkMode ? "dark" : "light");
    }
    
    // Watch for dark mode changes
    const darkModeToggle = document.getElementById('darkModeToggle');
    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', function() {
            // Give time for the class to be added/removed
            setTimeout(updateControlsForDarkMode, 50);
        });
    }
    
    // Also watch for class changes on body using MutationObserver
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                updateControlsForDarkMode();
            }
        });
    });
    
    observer.observe(document.body, { attributes: true });
    
    // Run initial check
    updateControlsForDarkMode();
});