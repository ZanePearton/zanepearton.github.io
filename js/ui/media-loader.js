// Lazy loading for images and YouTube videos
export function setupLazyLoading() {
    // For regular images without data-src attribute
    const images = document.querySelectorAll('img:not([loading])');
    images.forEach(img => {
        img.setAttribute('loading', 'lazy');
        img.classList.add('lazy-image');
    });

    // For YouTube iframes
    const iframes = document.querySelectorAll('iframe[src*="youtube.com"]');
    iframes.forEach(iframe => {
        try {
            // Store original src
            const originalSrc = iframe.src;

            // Function to extract YouTube video ID
            function getYouTubeID(url) {
                const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                const match = url.match(regExp);
                return (match && match[2].length === 11) ? match[2] : null;
            }

            const videoId = getYouTubeID(originalSrc);

            if (videoId) {
                // Remove src temporarily
                iframe.removeAttribute('src');

                // Create a placeholder
                const placeholder = document.createElement('div');
                placeholder.className = 'youtube-placeholder';
                placeholder.style.position = 'relative';
                placeholder.style.width = '100%';
                placeholder.style.height = '0';
                placeholder.style.paddingBottom = '56.25%';
                placeholder.style.backgroundSize = 'cover';
                placeholder.style.backgroundPosition = 'center';
                placeholder.style.backgroundImage = `url('https://img.youtube.com/vi/${videoId}/hqdefault.jpg')`;
                placeholder.style.cursor = 'pointer';
                placeholder.style.borderRadius = '8px';
                placeholder.style.overflow = 'hidden';

                // Add play button
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
                playButton.style.zIndex = '10';
                playButton.style.transition = 'all 0.3s ease';
                playButton.innerHTML = '<i class="fas fa-play" style="color: white; font-size: 24px; margin-left: 5px;"></i>';

                placeholder.appendChild(playButton);

                // Add overlay
                const overlay = document.createElement('div');
                overlay.style.position = 'absolute';
                overlay.style.top = '0';
                overlay.style.left = '0';
                overlay.style.width = '100%';
                overlay.style.height = '100%';
                overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                placeholder.insertBefore(overlay, playButton);

                // Insert placeholder before iframe
                iframe.parentNode.insertBefore(placeholder, iframe);

                // Hide iframe initially
                iframe.style.display = 'none';

                // Add click handler to placeholder
                placeholder.addEventListener('click', () => {
                    // Restore src to load the video
                    iframe.src = originalSrc + (originalSrc.includes('?') ? '&' : '?') + 'autoplay=1';
                    iframe.style.display = 'block';
                    placeholder.style.display = 'none';
                });
            }
        } catch (error) {
            console.error('Error setting up YouTube lazy loading:', error);
        }
    });
}
