// resume.js - Final Polished Version

document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('.sidebar-nav .nav-link');
    const contentSections = document.querySelectorAll('.content-section');

    // Function to handle showing the correct section
    const showSection = (hash) => {
        // Deactivate all nav links first
        navLinks.forEach(link => {
            link.classList.remove('active');
        });

        // Find and activate the target link
        const targetLink = document.querySelector(`a[href="${hash}"]`);
        if (targetLink) {
            targetLink.classList.add('active');
        }

        // Hide all sections to reset animations
        contentSections.forEach(section => {
            section.classList.remove('active');
        });
        
        // Show the target section
        const targetSection = document.querySelector(hash);
        if (targetSection) {
            // A tiny delay to allow the 'display: none' to apply before making it visible again
            // This is what makes the animation re-trigger every time
            setTimeout(() => {
                targetSection.classList.add('active');
            }, 10);
        }
    };

    // Add click listeners to nav links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const hash = e.target.getAttribute('href');
            // Change the URL hash for deep linking (optional but good practice)
            // window.history.pushState(null, null, hash); 
            showSection(hash);
        });
    });
    
    // Show the initial section on page load
    const initialHash = window.location.hash || '#about';
    showSection(initialHash);
});