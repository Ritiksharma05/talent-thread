import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, query, where, onSnapshot, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. AUTH PATTERN
document.body.style.visibility = 'hidden';

let _user = null;
let _unsubscribe = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    _user = user;
    
    // Ensure user exists in our records
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { window.location.href = '/login.html'; return; }
    
    document.body.style.visibility = 'visible';
    init();
});

function init() {
    // Watch for checkbox changes
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
        el.addEventListener('change', () => {
            console.log("Filter toggled, refreshing feed...");
            startFeed();
        });
    });

    // Start real-time feed
    startFeed();
}

// 2. REAL-TIME FEED LOGIC
function startFeed() {
    if (_unsubscribe) _unsubscribe();

    const container = document.getElementById('job-list');
    if (!container) {
        console.error("CRITICAL: Job list container (#job-list) not found in HTML!");
        return;
    }

    // Get checked disciplines
    const activeDisciplines = Array.from(document.querySelectorAll('input[name="discipline"]:checked')).map(el => el.value);
    
    console.log("Fetching jobs for:", activeDisciplines.length ? activeDisciplines : "All Categories");

    // QUERY: Show 'open' jobs
    let q = query(
        collection(db, "projects"),
        where("status", "==", "open")
    );

    // Apply category filter if active
    if (activeDisciplines.length > 0) {
        q = query(q, where("discipline", "in", activeDisciplines));
    }

    _unsubscribe = onSnapshot(q, (snap) => {
        console.log("Received snapshot. Docs:", snap.size);
        
        if (snap.empty) {
            container.innerHTML = `
                <div style="text-align:center; padding:100px 20px; background:white; border-radius:12px; border:1px dashed var(--border)">
                    <div style="font-size:48px; margin-bottom:16px">✨</div>
                    <h3 style="font-weight:700">No matching jobs found</h3>
                    <p style="color:var(--ink-3); margin-top:8px">Try checking more categories or check back later.</p>
                </div>
            `;
            return;
        }

        const jobs = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(j => j.client_uid !== _user.uid); // Don't see own jobs

        // Sort by date (descending)
        jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        container.innerHTML = jobs.map(j => `
            <div class="job-card" onclick="window.location.href='/job-detail.html?id=${j.id}'">
                <div class="card-top">
                    <span class="card-tag">${(j.discipline || 'Design').toUpperCase()}</span>
                    <span style="font-weight:700; color:var(--primary)">₹${(j.budget_min||0).toLocaleString()} - ₹${(j.budget_max||0).toLocaleString()}</span>
                </div>
                <h3 class="job-title">${j.title}</h3>
                <p class="job-desc">${j.description}</p>
                <div class="job-meta">
                    <div class="meta-item">📍 ${j.work_mode || 'Remote'}</div>
                    <div class="meta-item">🕒 ${j.duration || 'Short-term'}</div>
                    <div class="meta-item">⚡ ${j.experience_level || 'Mid'}</div>
                </div>
                <div class="card-footer">
                    <div style="display:flex; align-items:center; gap:8px">
                        <div style="width:24px; height:24px; border-radius:50%; background:var(--surface-3); display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800">${(j.company_name||'C').charAt(0)}</div>
                        <span style="font-size:13px; font-weight:600">${j.company_name || 'Verified Client'}</span>
                    </div>
                    <button class="btn btn-primary btn-sm" onclick="window.location.href='/job-detail.html?id=${j.id}'">View Details</button>
                </div>
            </div>
        `).join('');
    }, (err) => {
        console.error("Real-time feed error:", err);
        container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger)">Connection Error. Check Firestore Rules.</div>`;
    });
}
