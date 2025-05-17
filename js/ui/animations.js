// Scroll-based animations and effects
export function initializeScrollAnimations() {
    window.addEventListener('scroll', () => {
        // Parallax effect for background elements
        const parallaxElements = document.querySelectorAll('.parallax');
        parallaxElements.forEach(element => {
            const speed = element.getAttribute('data-speed') || 0.5;
            element.style.transform = `translateY(${window.scrollY * speed}px)`;
        });

        // Fade in elements when they enter viewport
        const fadeElements = document.querySelectorAll('.fade-in');
        fadeElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            const elementHeight = element.offsetHeight;
            const windowHeight = window.innerHeight;

            if (elementTop < windowHeight - elementHeight / 2) {
                element.classList.add('visible');
            }
        });

        // Progress bar for scroll position
        const scrollProgress = document.getElementById('scrollProgress');
        if (scrollProgress) {
            const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrolled = (window.scrollY / scrollableHeight) * 100;
            scrollProgress.style.width = `${scrolled}%`;
        }

        // Show/hide back-to-top button
        const backToTopBtn = document.getElementById('backToTop');
        if (backToTopBtn) {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }
    });
}

// Add fade-in animation to sections
export function addFadeInToSections() {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        if (!section.classList.contains('fade-in')) {
            section.classList.add('fade-in');
        }
    });
}