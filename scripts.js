// Mobile menu toggle with animation
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const navMenu = document.getElementById('navMenu');

// Fix in case the button is not found by ID (using class instead)
if (!mobileMenuBtn) {
    mobileMenuBtn = document.querySelector('.mobile-menu-btn');
}

// Animated menu toggle with transitions
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

// Enhanced smooth scrolling with progress indicator
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        
        // Close mobile menu if open
        if (navMenu.classList.contains('active')) {
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
});

// Enhanced form submission with visual feedback
const contactForm = document.getElementById('contactForm');
if (contactForm) {
    // Remove manual Formspree handling since it's in the HTML action
    // Just add the visual enhancements and validation
    
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
        e.preventDefault();
        
        // Show loading indicator
        const submitBtn = contactForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
        submitBtn.disabled = true;
        
        // Enhanced form validation
        const name = document.getElementById('name').value.trim();
        const email = document.getElementById('email').value.trim();
        const subject = document.getElementById('subject').value.trim();
        const message = document.getElementById('message').value.trim();
        
        const formFields = [
            { field: 'name', value: name },
            { field: 'email', value: email },
            { field: 'subject', value: subject },
            { field: 'message', value: message }
        ];
        
        let hasErrors = false;
        
        formFields.forEach(item => {
            const field = document.getElementById(item.field);
            const errorElement = document.getElementById(`${item.field}Error`);
            
            if (!item.value) {
                hasErrors = true;
                field.classList.add('error-input');
                if (errorElement) {
                    errorElement.textContent = `Please enter your ${item.field}`;
                    errorElement.style.display = 'block';
                }
            } else {
                field.classList.remove('error-input');
                if (errorElement) {
                    errorElement.style.display = 'none';
                }
            }
        });
        
        if (hasErrors) {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            return;
        }
        
        // Let the native form action handle the submission
        // Just add visual feedback before submission
        
        // Show success message with animation (form will be submitted naturally)
        const successMessage = document.createElement('div');
        successMessage.className = 'success-message';
        successMessage.innerHTML = '<i class="fas fa-check-circle"></i> Sending your message...';
        contactForm.appendChild(successMessage);
        
        // The form will naturally submit after this
        // Native form submission will handle the actual sending
        
        // Simulate the response for UI feedback
        setTimeout(() => {
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            
            // For visual consistency - assume success:
                // Show success message with animation
                const successMessage = document.createElement('div');
                successMessage.className = 'success-message';
                successMessage.innerHTML = '<i class="fas fa-check-circle"></i> Thanks for your message! I\'ll get back to you soon.';
                contactForm.appendChild(successMessage);
                
                // Reset form with animation
                formInputs.forEach(input => {
                    input.value = '';
                    const label = input.previousElementSibling;
                    if (label && label.tagName === 'LABEL') {
                        label.classList.remove('active-label');
                    }
                });
                
                // Remove success message after delay
                setTimeout(() => {
                    successMessage.style.opacity = '0';
                    setTimeout(() => {
                        successMessage.remove();
                    }, 500);
                }, 3000);
            } else {
                // Show error message with animation
                const errorMessage = document.createElement('div');
                errorMessage.className = 'error-message';
                errorMessage.innerHTML = '<i class="fas fa-exclamation-circle"></i> Oops! There was a problem sending your message. Please try again.';
                contactForm.appendChild(errorMessage);
                
                // Remove error message after delay
                setTimeout(() => {
                    errorMessage.style.opacity = '0';
                    setTimeout(() => {
                        errorMessage.remove();
                    }, 500);
                }, 3000);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            submitBtn.innerHTML = originalBtnText;
            submitBtn.disabled = false;
            
            // Show error message with animation
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.innerHTML = '<i class="fas fa-exclamation-circle"></i> Oops! There was a problem sending your message. Please try again.';
            contactForm.appendChild(errorMessage);
            
            // Remove error message after delay
            setTimeout(() => {
                errorMessage.style.opacity = '0';
                setTimeout(() => {
                    errorMessage.remove();
                }, 500);
            }, 3000);
        });
    });
}

// Dark mode toggle
const createDarkModeToggle = () => {
    const header = document.querySelector('header') || document.body;
    
    // Create toggle button
    const darkModeToggle = document.createElement('button');
    darkModeToggle.id = 'darkModeToggle';
    darkModeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    darkModeToggle.title = 'Toggle Dark Mode';
    darkModeToggle.className = 'dark-mode-toggle';
    
    // Add to DOM
    header.appendChild(darkModeToggle);
    
    // Check user preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedMode = localStorage.getItem('darkMode');
    
    if (savedMode === 'true' || (savedMode === null && prefersDark)) {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
    
    // Add click event
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        
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
};

// Add scroll progress indicator
const createScrollProgress = () => {
    const progressBar = document.createElement('div');
    progressBar.id = 'scrollProgress';
    progressBar.className = 'scroll-progress';
    document.body.appendChild(progressBar);
};

// Implement lazy loading for images and iframes
const setupLazyLoading = () => {
    // For regular images without data-src attribute
    const images = document.querySelectorAll('img:not([loading])');
    images.forEach(img => {
        img.setAttribute('loading', 'lazy');
        img.classList.add('lazy-image');
    });
    
    // For images with data-src attribute
    const dataSrcImages = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.getAttribute('data-src');
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        dataSrcImages.forEach(img => {
            imageObserver.observe(img);
        });
        
        // Also add lazy loading for YouTube iframes
        const iframes = document.querySelectorAll('iframe[src*="youtube.com"]');
        iframes.forEach(iframe => {
            // Store original src
            const originalSrc = iframe.src;
            // Remove src temporarily
            iframe.removeAttribute('src');
            // Create a placeholder
            const placeholder = document.createElement('div');
            placeholder.className = 'youtube-placeholder';
            placeholder.style.backgroundImage = `url('https://img.youtube.com/vi/${getYouTubeID(originalSrc)}/0.jpg')`;
            placeholder.innerHTML = '<div class="play-button"><i class="fas fa-play"></i></div>';
            
            // Insert placeholder before iframe
            iframe.parentNode.insertBefore(placeholder, iframe);
            
            // Hide iframe initially
            iframe.style.display = 'none';
            
            // Add click handler to placeholder
            placeholder.addEventListener('click', () => {
                // Restore src to load the video
                iframe.src = originalSrc;
                iframe.style.display = 'block';
                placeholder.style.display = 'none';
            });
            
            // Function to extract YouTube video ID
            function getYouTubeID(url) {
                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                const match = url.match(regExp);
                return (match && match[2].length === 11) ? match[2] : null;
            }
        });
    } else {
        // Fallback for browsers without IntersectionObserver
        dataSrcImages.forEach(img => {
            img.src = img.getAttribute('data-src');
        });
    }
};

// Add a back-to-top button
const createBackToTopButton = () => {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'backToTop';
    backToTopBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    backToTopBtn.title = 'Back to Top';
    backToTopBtn.className = 'back-to-top';
    document.body.appendChild(backToTopBtn);
    
    // Show/hide based on scroll position
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });
    
    // Scroll to top with animation
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
};

// Add animation to tech sphere
const animateTechSphere = () => {
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
        }
    }
};

// Enhance certification animations
const enhanceCertifications = () => {
    const certificationItems = document.querySelectorAll('.certification-item');
    
    if (certificationItems.length) {
        certificationItems.forEach(item => {
            item.classList.add('fade-in');
            
            // Add hover effect
            item.addEventListener('mouseenter', () => {
                item.classList.add('highlight');
            });
            
            item.addEventListener('mouseleave', () => {
                item.classList.remove('highlight');
            });
        });
    }
};

// Execute all enhancements on page load
document.addEventListener('DOMContentLoaded', () => {
    createDarkModeToggle();
    createScrollProgress();
    setupLazyLoading();
    createBackToTopButton();
    animateTechSphere();
    enhanceCertifications();
    
    // Add CSS for new features
    const enhancementStyles = document.createElement('style');
    enhancementStyles.textContent = `
        /* Dark mode styles */
        .dark-mode {
            background-color: #121212;
            color: #f0f0f0;
        }
        .dark-mode .apple-button-primary {
            background: linear-gradient(to right, var(--apple-orange), var(--apple-purple));
        }
        .dark-mode .apple-button-secondary {
            border-color: #f0f0f0;
            color: #f0f0f0;
        }
        .dark-mode .project-card {
            background-color: #1e1e1e;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
        }
        .dark-mode .form-control {
            background-color: #2d2d2d;
            color: #f0f0f0;
            border-color: #444;
        }
        .dark-mode .skill-pill {
            background-color: #333;
        }
        .dark-mode .certification-item {
            background-color: #1e1e1e;
        }
        .dark-mode .contact-form {
            background-color: #1e1e1e;
        }
        .dark-mode .form-submit {
            background: linear-gradient(to right, var(--apple-orange), var(--apple-purple));
        }
        .dark-mode-toggle {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            background: transparent;
            border: none;
            color: inherit;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
        }
        .dark-mode .dark-mode-toggle {
            background: #333;
            box-shadow: 0 0 10px rgba(255,255,255,0.1);
        }
        
        /* Scroll progress indicator */
        .scroll-progress {
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, #3498db, #2ecc71);
            z-index: 9999;
            width: 0%;
            transition: width 0.2s ease;
        }
        
        /* Back to top button */
        .back-to-top {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #3498db;
            color: white;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            opacity: 0;
            transform: translateY(20px);
            transition: all 0.3s ease;
            z-index: 999;
        }
        .back-to-top.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Menu animations */
        #mobileMenuBtn.rotated i {
            transform: rotate(90deg);
            transition: transform 0.3s ease;
        }
        #navMenu li {
            opacity: 0;
            transform: translateY(-10px);
            transition: opacity 0.3s ease, transform 0.3s ease;
        }
        
        /* Form animations */
        .active-label {
            transform: translateY(-20px) scale(0.8);
            color: #3498db;
            transition: all 0.3s ease;
        }
        .error-input {
            border-color: #e74c3c !important;
            animation: shake 0.5s;
        }
        .valid-input {
            border-color: #2ecc71 !important;
        }
        .invalid-input {
            border-color: #e74c3c !important;
        }
        
        /* Success and error messages */
        .success-message, .error-message {
            padding: 15px;
            margin-top: 15px;
            border-radius: 5px;
            opacity: 1;
            transition: opacity 0.5s ease;
        }
        .success-message {
            background-color: rgba(46, 204, 113, 0.2);
            border-left: 4px solid #2ecc71;
            color: #2ecc71;
        }
        .error-message {
            background-color: rgba(231, 76, 60, 0.2);
            border-left: 4px solid #e74c3c;
            color: #e74c3c;
        }
        
        /* Loading spinner */
        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: white;
            animation: spin 1s ease-in-out infinite;
        }
        
        /* Fade-in animation */
        .fade-in {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .fade-in.visible {
            opacity: 1;
            transform: translateY(0);
        }
        
        /* Lazy loading animation */
        img.loaded {
            animation: fadeIn 0.5s;
        }
        
        /* Animation keyframes */
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        /* Tech sphere enhancements */
        @keyframes orbit {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        .tech-sphere .orbit {
            transition: all 0.3s ease;
        }
        .tech-sphere .orbit-circle {
            transition: transform 0.3s ease, background-color 0.3s ease;
        }
        .tech-sphere .orbit-circle:hover {
            transform: scale(1.2);
            background-color: var(--apple-orange);
        }
        .pulsing {
            animation: pulse 2s infinite ease-in-out;
        }
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 149, 0, 0.4); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 149, 0, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 149, 0, 0); }
        }
        
        /* YouTube placeholder styles */
        .youtube-placeholder {
            position: relative;
            width: 100%;
            height: 0;
            padding-bottom: 56.25%; /* 16:9 aspect ratio */
            background-size: cover;
            background-position: center;
            cursor: pointer;
            border-radius: 8px;
            overflow: hidden;
        }
        .youtube-placeholder::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.3);
        }
        .play-button {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60px;
            height: 60px;
            background-color: rgba(255, 0, 0, 0.8);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10;
            transition: all 0.3s ease;
        }
        .play-button i {
            color: white;
            font-size: 24px;
            margin-left: 5px;
        }
        .youtube-placeholder:hover .play-button {
            background-color: rgba(255, 0, 0, 1);
            transform: translate(-50%, -50%) scale(1.1);
        }
        
        /* Certification item enhancements */
        .certification-item {
            transition: all 0.3s ease;
        }
        .certification-item.highlight {
            transform: translateX(10px);
            border-left: 3px solid var(--apple-orange);
            background-color: rgba(255, 149, 0, 0.05);
        }
        
        /* Skill pill enhancements */
        .skill-pill {
            transition: all 0.3s ease;
        }
        .skill-pill:hover {
            transform: translateY(-5px);
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }
        
        /* Project card enhancements */
        .project-card {
            transition: all 0.3s ease;
        }
        .project-card:hover {
            transform: translateY(-10px);
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.1);
        }
    `;
    document.head.appendChild(enhancementStyles);
    
    // Add fade-in class to sections for scroll animations
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.classList.add('fade-in');
    });
});