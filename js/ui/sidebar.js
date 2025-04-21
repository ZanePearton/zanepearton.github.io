document.addEventListener('DOMContentLoaded', function() {
    const controlsPanel = document.getElementById('controls');
    const minimizeButton = document.getElementById('minimizeControls');
    
    if (minimizeButton && controlsPanel) {
        minimizeButton.addEventListener('click', function() {
            // Toggle minimized class
            controlsPanel.classList.toggle('minimized');
            
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
});