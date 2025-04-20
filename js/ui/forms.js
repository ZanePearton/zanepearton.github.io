// Form handling, validation and submission feedback
export function initializeForms() {
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
            emailInput.addEventListener('input', function () {
                const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.value);
                this.classList.toggle('invalid-input', !isValid && this.value !== '');
                this.classList.toggle('valid-input', isValid);
            });
        }

        contactForm.addEventListener('submit', function (e) {
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
}