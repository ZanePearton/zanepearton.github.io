// Mobile menu toggle with animation - WITH PROPER NULL CHECKS
document.addEventListener('DOMContentLoaded', function() {
    // First try to get the mobile menu button with proper null checks
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn') || document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');

    // Only add event listeners if both elements exist
    if (mobileMenuBtn && navMenu) {
        mobileMenuBtn.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            
            // Animate the menu icon with a rotation
            if (navMenu.classList.contains('active')) {
                mobileMenuBtn.innerHTML = '<i class="fas fa-times"></i>';
                mobileMenuBtn.classList.add('rotated');
                // Animate menu items one by one
                const menuItems = navMenu.querySelectorAll('li');
                menuItems.forEach((item, index) => {
                    setTimeout(() => {
                        item.style.opacity = '1';
                        item.style.transform = 'translateY(0)';
                    }, 100 * index);
                });
            } else {
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
                mobileMenuBtn.classList.remove('rotated');
                // Reset menu items animation
                const menuItems = navMenu.querySelectorAll('li');
                menuItems.forEach(item => {
                    item.style.opacity = '0';
                    item.style.transform = 'translateY(-10px)';
                });
            }
        });
    }

    // Enhanced smooth scrolling with progress indicator
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            // Close mobile menu if open and both elements exist
            if (navMenu && mobileMenuBtn && navMenu.classList.contains('active')) {
                navMenu.classList.remove('active');
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
                mobileMenuBtn.classList.remove('rotated');
            }
            
            const targetId = this.getAttribute('href');
            const target = document.querySelector(targetId);
            
            if (target) {
                // Highlight active nav item
                document.querySelectorAll('nav a').forEach(link => link.classList.remove('active-link'));
                this.classList.add('active-link');
                
                // Smooth scroll with easing
                window.scrollTo({
                    top: target.offsetTop - 60, // Account for fixed header
                    behavior: 'smooth'
                });
                
                // Update URL without page reload
                history.pushState(null, null, targetId);
            }
        });
    });
});

// Scroll-based animations
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

// Enhanced form submission with visual feedback
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        // Add input animations on focus
        const formInputs = contactForm.querySelectorAll('input, textarea');
        formInputs.forEach(input => {
            const label = input.previousElementSibling;
            if (label && label.tagName === 'LABEL') {
                input.addEventListener('focus', () => {
                    label.classList.add('active-label');
                });
                
                input.addEventListener('blur', () => {
                    if (input.value === '') {
                        label.classList.remove('active-label');
                    }
                });
                
                // Check if input already has value on page load
                if (input.value !== '') {
                    label.classList.add('active-label');
                }
            }
        });

        // Real-time validation with visual feedback
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.addEventListener('input', function() {
                const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value);
                this.classList.toggle('invalid-input', !isValid && this.value !== '');
                this.classList.toggle('valid-input', isValid);
            });
        }
        
        contactForm.addEventListener('submit', function(e) {
            // Don't prevent default submission since we're using the native action
            // But still add visual feedback
            
            const submitBtn = contactForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                const originalBtnText = submitBtn.innerHTML;
                submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
                submitBtn.disabled = true;
                
                // Create a success message element
                const successMessage = document.createElement('div');
                successMessage.className = 'success-message';
                successMessage.innerHTML = '<i class="fas fa-check-circle"></i> Sending your message...';
                contactForm.appendChild(successMessage);
                
                // Remove message after delay to avoid cluttering if form submits
                setTimeout(() => {
                    if (document.contains(successMessage)) {
                        successMessage.remove();
                    }
                }, 5000);
            }
        });
    }
});

// FIXED Dark mode toggle with comprehensive styling and debugging
function createFixedDarkModeToggle() {
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
    darkModeToggle.addEventListener('click', function() {
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
function createScrollProgress() {
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
function createBackToTopButton() {
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

// Implement lazy loading for images and iframes with Intersection Observer
function setupLazyLoading() {
    // Only create the observer if it's supported
    if ('IntersectionObserver' in window) {
        // Configure the observer
        const lazyLoadOptions = {
            root: null, // Use viewport as root
            rootMargin: '200px 0px', // Start loading when within 200px of viewport
            threshold: 0.01 // Trigger when 1% of the element is visible
        };
        
        // Create observers for images and iframes
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    
                    // If using data-src attribute (common in lazy loading libraries)
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    
                    img.classList.add('loaded');
                    observer.unobserve(img); // Stop observing once loaded
                }
            });
        }, lazyLoadOptions);
        
        // Create a specific observer for iframes with a more aggressive threshold
        const iframeObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const iframe = entry.target;
                    
                    // If has data-src attribute
                    if (iframe.dataset.src) {
                        iframe.src = iframe.dataset.src;
                        iframe.removeAttribute('data-src');
                    }
                    
                    iframe.classList.add('loaded');
                    observer.unobserve(iframe);
                }
            });
        }, {
            root: null,
            rootMargin: '400px 0px', // Even more aggressive preloading for iframes
            threshold: 0.01
        });
        
        // Apply to all images
        const images = document.querySelectorAll('img:not(.loaded)');
        images.forEach(img => {
            // Add native lazy loading as a fallback
            img.setAttribute('loading', 'lazy');
            
            // Add fade-in animation class
            img.classList.add('lazy-image');
            
            // Observe the image
            imageObserver.observe(img);
        });
        
        // Apply to all iframes that aren't already loaded
        const iframes = document.querySelectorAll('iframe:not(.loaded)');
        iframes.forEach(iframe => {
            // For YouTube iframes, create optimized loading
            if (iframe.src && iframe.src.includes('youtube.com')) {
                // Store original src
                const originalSrc = iframe.src;
                iframe.dataset.src = originalSrc;
                
                // Extract video ID for thumbnail
                const videoId = getYouTubeID(originalSrc);
                
                if (videoId) {
                    // Create a lightweight placeholder
                    const placeholderSrc = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
                    
                    // Create a lightweight wrapper that doesn't completely replace the iframe
                    const wrapper = document.createElement('div');
                    wrapper.className = 'youtube-placeholder';
                    wrapper.style.position = 'relative';
                    wrapper.style.width = '100%';
                    wrapper.style.paddingBottom = '56.25%'; // 16:9 aspect ratio
                    wrapper.style.backgroundImage = `url('${placeholderSrc}')`;
                    wrapper.style.backgroundSize = 'cover';
                    wrapper.style.backgroundPosition = 'center';
                    wrapper.style.cursor = 'pointer';
                    wrapper.style.borderRadius = '8px';
                    wrapper.style.overflow = 'hidden';
                    
                    // Add a play button
                    const playButton = document.createElement('div');
                    playButton.className = 'play-button';
                    playButton.style.position = 'absolute';
                    playButton.style.top = '50%';
                    playButton.style.left = '50%';
                    playButton.style.transform = 'translate(-50%, -50%)';
                    playButton.style.width = '60px';
                    playButton.style.height = '60px';
                    playButton.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
                    playButton.style.borderRadius = '50%';
                    playButton.style.display = 'flex';
                    playButton.style.alignItems = 'center';
                    playButton.style.justifyContent = 'center';
                    
                    // Use a simple icon to reduce DOM complexity
                    playButton.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"></path></svg>';
                    
                    wrapper.appendChild(playButton);
                    
                    // Add overlay for better visual
                    const overlay = document.createElement('div');
                    overlay.style.position = 'absolute';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.width = '100%';
                    overlay.style.height = '100%';
                    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
                    wrapper.insertBefore(overlay, playButton);
                    
                    // Add this wrapper before the iframe
                    iframe.parentNode.insertBefore(wrapper, iframe);
                    
                    // Hide the iframe until clicked
                    iframe.style.display = 'none';
                    
                    // Handle click to play
                    wrapper.addEventListener('click', function() {
                        // Add autoplay parameter and load video
                        iframe.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 'autoplay=1';
                        iframe.style.display = 'block';
                        wrapper.style.display = 'none';
                    });
                }
            } else {
                // For non-YouTube iframes
                iframeObserver.observe(iframe);
            }
        });
        
        console.log('Lazy loading set up with Intersection Observer');
    } else {
        // Fallback for browsers that don't support IntersectionObserver
        console.log('Using native lazy loading as fallback');
        document.querySelectorAll('img').forEach(img => {
            img.setAttribute('loading', 'lazy');
        });
    }
}

// YouTube ID extraction helper
function getYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Add animation to tech sphere
function animateTechSphere() {
    const techSphere = document.querySelector('.tech-sphere');
    if (techSphere) {
        // Enhance orbit animations
        const orbits = techSphere.querySelectorAll('.orbit');
        orbits.forEach((orbit, index) => {
            // Reverse direction for alternating orbits
            const direction = index % 2 === 0 ? 1 : -1;
            // Different speeds for each orbit
            const duration = 20 + (index * 5);
            
            orbit.style.animation = `orbit ${duration}s linear infinite ${direction > 0 ? '' : 'reverse'}`;
            
            // Add hover pause effect
            orbit.addEventListener('mouseenter', () => {
                orbit.style.animationPlayState = 'paused';
            });
            
            orbit.addEventListener('mouseleave', () => {
                orbit.style.animationPlayState = 'running';
            });
            
            // Make orbit circles interactive
            const orbitCircles = orbit.querySelectorAll('.orbit-circle');
            orbitCircles.forEach(circle => {
                circle.addEventListener('mouseenter', () => {
                    circle.style.transform = 'scale(1.2)';
                });
                
                circle.addEventListener('mouseleave', () => {
                    circle.style.transform = 'scale(1)';
                });
            });
        });
        
        // Add pulsing effect to the sphere core
        const sphereCore = techSphere.querySelector('.sphere-core');
        if (sphereCore) {
            sphereCore.classList.add('pulsing');
            sphereCore.style.animation = 'pulse 2s infinite ease-in-out';
        }
    }
}

// Enhance certification animations
function enhanceCertifications() {
    const certificationItems = document.querySelectorAll('.certification-item');
    
    if (certificationItems.length) {
        certificationItems.forEach(item => {
            item.classList.add('fade-in');
            
            // Add hover effect
            item.addEventListener('mouseenter', () => {
                item.classList.add('highlight');
                item.style.transform = 'translateX(10px)';
                item.style.borderLeft = '3px solid var(--apple-orange)';
                item.style.backgroundColor = 'rgba(255, 149, 0, 0.05)';
            });
            
            item.addEventListener('mouseleave', () => {
                item.classList.remove('highlight');
                item.style.transform = '';
                item.style.borderLeft = '';
                item.style.backgroundColor = '';
            });
        });
    }
}

// Add fade-in animation to sections
function addFadeInToSections() {
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        if (!section.classList.contains('fade-in')) {
            section.classList.add('fade-in');
        }
    });
}

// Initialize all enhancements without delays
function initializeEnhancements() {
    createFixedDarkModeToggle();
    createScrollProgress();
    createBackToTopButton();
    setupLazyLoading(); // This is now using the optimized implementation
    animateTechSphere();
    enhanceCertifications();
    addFadeInToSections();
}

// Make sure enhancements run on page load - removed unnecessary timeouts
window.addEventListener('load', () => {
    console.log("Window loaded - initializing enhancements");
    initializeEnhancements();
});

// Also run when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded - initializing enhancements");
    initializeEnhancements();
});

// Wrapped in a try-catch to prevent any errors from stopping execution
try {
    // Run immediately as a fallback
    console.log("Immediate execution - initializing enhancements");
    initializeEnhancements();
} catch (error) {
    console.error('Error initializing enhancements:', error);
}


*/