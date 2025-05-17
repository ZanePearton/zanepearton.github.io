// Scroll-based animations and effects
export function initializeScrollAnimations() {
  window.addEventListener('scroll', () => {
    // Parallax effect for background elements
    const parallaxElements = document.querySelectorAll('.parallax');
    parallaxElements.forEach(element => {
      const speed = element.getAttribute('data-speed') || 0.5;
      element.style.transform = `translateY(${window.scrollY * speed}px)`;
    });
    
    // Fade in elements when they enter viewport (EXCLUDE HERO SECTION)
    const fadeElements = document.querySelectorAll('.fade-in:not(#hero)');
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

// Add fade-in animation to sections EXCEPT HERO
export function addFadeInToSections() {
  // Exclude the hero section from getting the fade-in class
  const sections = document.querySelectorAll('section:not(#hero)');
  sections.forEach(section => {
    if (!section.classList.contains('fade-in')) {
      section.classList.add('fade-in');
    }
  });
  
  // Make the hero section visible immediately
  const heroSection = document.querySelector('#hero');
  if (heroSection) {
    // Remove fade-in class if it exists
    heroSection.classList.remove('fade-in');
    // Add visible class to ensure it's visible
    heroSection.classList.add('visible');
    // Apply inline styles as a backup
    heroSection.style.opacity = '1';
    heroSection.style.transform = 'translateY(0)';
    heroSection.style.visibility = 'visible';
  }
}