// Interactive elements like tech sphere and certifications

// Add animation to tech sphere
export function animateTechSphere() {
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
export function enhanceCertifications() {
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