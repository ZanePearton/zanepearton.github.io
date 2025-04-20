// Mobile menu and navigation functionality
export function initializeNavigation() {
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
}