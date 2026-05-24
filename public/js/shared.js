/**
 * Talent Thread — Shared UI Logic
 * Handles Authentication state across all pages and updates the Navigation UI.
 */

import { auth, db } from './src/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

function initSharedUI() {
    // 1. Auth State Listener for Navigation
    onAuthStateChanged(auth, async (user) => {
        const body = document.body;
        
        if (user) {
            body.classList.add('logged-in');
            
            // Update dashboard link based on role
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const uData = userDoc.data();
                    const dashboardLinks = document.querySelectorAll('#navDashboard, a[href="/profile.html"], a[href="/dashboard"]');
                    const target = uData.role === 'client' ? '/client-dashboard' : '/dashboard';
                    
                    dashboardLinks.forEach(link => {
                        if (link.innerText.includes('Dashboard')) {
                            link.href = target;
                        }
                    });

                    if (uData.role === 'admin') {
                        injectAdminLink();
                    }
                }
            } catch (err) {
                console.error("Shared UI: Error fetching user role", err);
            }
        } else {
            body.classList.remove('logged-in');
            const adminLink = document.getElementById('navAdmin');
            if (adminLink) adminLink.remove();
        }
    });

    // 2. Mobile Menu Fix
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.getElementById('mainNav');
    if (mobileBtn && navLinks) {
        mobileBtn.onclick = () => navLinks.classList.toggle('mobile-open');
    }

    // 3. Scroll state for header
    window.addEventListener('scroll', () => {
        document.getElementById('siteHeader')?.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
}

function injectAdminLink() {
    const navRight = document.querySelector('.nav-right');
    if (navRight && !document.getElementById('navAdmin')) {
        const adminLink = document.createElement('a');
        adminLink.href = '/admin.html';
        adminLink.id = 'navAdmin';
        adminLink.className = 'btn btn-ghost btn-sm';
        adminLink.style.marginRight = '8px';
        adminLink.style.color = 'var(--blue)';
        adminLink.textContent = 'Admin Panel';
        navRight.prepend(adminLink);
    }
}

// Auto-initialize if not in a module that wants manual control
document.addEventListener('DOMContentLoaded', initSharedUI);

export { initSharedUI };
