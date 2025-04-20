// UI components like dark mode toggle, progress bar, back-to-top button

// FIXED Dark mode toggle with comprehensive styling and debugging
export function createFixedDarkModeToggle() {
    // Check if it already exists
    if (document.getElementById('darkModeToggle')) {
        return;
    }

    console.log("Creating dark mode toggle button");

    // Create toggle button with inline styles to ensure visibility
    const darkModeToggle = document.createElement('button');
    darkModeToggle.id = 'darkModeToggle';
    darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    darkModeToggle.title = 'Toggle Dark/Light Mode';

    // Apply inline styles for maximum visibility
    darkModeToggle.style.position = 'fixed';
    darkModeToggle.style.bottom = '80px';
    darkModeToggle.style.right = '20px';
    darkModeToggle.style.zIndex = '9999';
    darkModeToggle.style.background = 'linear-gradient(to right, #ff9500, #af52de)';
    darkModeToggle.style.color = 'white';
    darkModeToggle.style.border = 'none';
    darkModeToggle.style.borderRadius = '50%';
    darkModeToggle.style.width = '50px';
    darkModeToggle.style.height = '50px';
    darkModeToggle.style.fontSize = '20px';
    darkModeToggle.style.cursor = 'pointer';
    darkModeToggle.style.display = 'flex';
    darkModeToggle.style.alignItems = 'center';
    darkModeToggle.style.justifyContent = 'center';
    darkModeToggle.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';

    // Add directly to body to ensure it appears
    document.body.appendChild(darkModeToggle);

    // Check user preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedMode = localStorage.getItem('darkMode');

    console.log("Saved dark mode:", savedMode);
    console.log("Prefers dark:", prefersDark);

    // Apply dark mode if previously selected or if user prefers dark mode
    if (savedMode === 'true' || (savedMode === null && prefersDark)) {
        console.log("Applying dark mode class to body");
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Add click event
    darkModeToggle.addEventListener('click', function () {
        console.log("Dark mode toggle clicked");
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');

        console.log("Dark mode is now:", isDark);

        // Save preference
        localStorage.setItem('darkMode', isDark);

        // Change icon
        darkModeToggle.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

        // Animate transition
        document.body.style.transition = 'background-color 0.5s, color 0.5s';
        setTimeout(() => {
            document.body.style.transition = '';
        }, 500);
    });

    console.log("Dark mode toggle button created and added to page");
}

// Add scroll progress indicator
export function createScrollProgress() {
    // Check if it already exists
    if (document.getElementById('scrollProgress')) {
        return;
    }

    const progressBar = document.createElement('div');
    progressBar.id = 'scrollProgress';
    progressBar.style.position = 'fixed';
    progressBar.style.top = '0';
    progressBar.style.left = '0';
    progressBar.style.height = '4px';
    progressBar.style.background = 'linear-gradient(90deg, #ff9500, #af52de)';
    progressBar.style.zIndex = '9999';
    progressBar.style.width = '0%';
    progressBar.style.transition = 'width 0.2s ease';

    document.body.appendChild(progressBar);
}

// Add a back-to-top button
export function createBackToTopButton() {
    // Check if it already exists
    if (document.getElementById('backToTop')) {
        return;
    }

    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'backToTop';
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.title = 'Back to Top';

    // Apply inline styles for consistency
    backToTopBtn.style.position = 'fixed';
    backToTopBtn.style.bottom = '20px';
    backToTopBtn.style.right = '20px';
    backToTopBtn.style.background = 'linear-gradient(to right, #ff9500, #af52de)';
    backToTopBtn.style.color = 'white';
    backToTopBtn.style.border = 'none';
    backToTopBtn.style.borderRadius = '50%';
    backToTopBtn.style.width = '50px';
    backToTopBtn.style.height = '50px';
    backToTopBtn.style.fontSize = '20px';
    backToTopBtn.style.cursor = 'pointer';
    backToTopBtn.style.display = 'flex';
    backToTopBtn.style.alignItems = 'center';
    backToTopBtn.style.justifyContent = 'center';
    backToTopBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.2)';
    backToTopBtn.style.opacity = '0';
    backToTopBtn.style.transform = 'translateY(20px)';
    backToTopBtn.style.transition = 'all 0.3s ease';
    backToTopBtn.style.zIndex = '999';

    document.body.appendChild(backToTopBtn);

    // Scroll to top with animation
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}