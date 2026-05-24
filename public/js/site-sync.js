import { db } from './src/firebase.js';
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Sync Site Settings across any page
export function initSiteSync() {
    const docRef = doc(db, 'site_settings', 'global');
    
    onSnapshot(docRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        
        // Update stats items on Home Page
        updateElementText('stat1', '.stat-value', data.designersCount);
        updateElementText('stat2', '.stat-value', data.avgRating);
        updateElementText('stat3', '.stat-value', data.matchTime);

        // Update Marketplace specific stats
        updateElementText('mpTotalGigs', null, data.designersCount); // Example
        
        // Update any element with a specific class for match time
        document.querySelectorAll('.ai-score-value').forEach(el => {
            if (el.textContent.includes('hr')) {
                el.textContent = data.matchTime;
            }
        });
    });
}

function updateElementText(id, childSelector, text) {
    if (!text) return;
    const parent = document.getElementById(id);
    if (parent) {
        if (childSelector) {
            const child = parent.querySelector(childSelector);
            if (child) child.textContent = text;
        } else {
            parent.textContent = text;
        }
    }
}
