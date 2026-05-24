import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. NON-NEGOTIABLE AUTH PATTERN
document.body.style.visibility = 'hidden';

let _user = null;
let _userData = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (!snap.exists()) { window.location.href = '/login.html'; return; }
        _user = user;
        _userData = snap.data();
        document.body.style.visibility = 'visible';
        init();
    } catch (err) {
        console.error("Auth initialization failed:", err);
        window.location.href = '/login.html';
    }
});

async function init() {
    setupNav();
    await loadMarketplace();
    
    // Watch for filter changes
    document.querySelectorAll('input[type="checkbox"]').forEach(el => {
        el.addEventListener('change', loadMarketplace);
    });
}

// 2. FETCH JOBS
async function loadMarketplace() {
    const container = document.getElementById('jobFeed') || document.getElementById('marketplaceFeed');
    if (!container) {
        console.error("Could not find jobFeed container in HTML");
        return;
    }

    container.innerHTML = `<div style="text-align:center; padding:50px; color:var(--ink-3)">Checking marketplace for new opportunities...</div>`;

    try {
        // Log for debugging
        console.log("Fetching jobs from 'projects' where status == 'open'...");

        // Get checked disciplines
        const selectedDisciplines = Array.from(document.querySelectorAll('input[name="discipline"]:checked')).map(el => el.value);
        
        let q = query(
            collection(db, "projects"),
            where("status", "==", "open")
        );

        // Apply discipline filter if any are checked
        if (selectedDisciplines.length > 0) {
            q = query(q, where("discipline", "in", selectedDisciplines));
        }

        const snap = await getDocs(q);
        console.log("Total jobs found in Firestore:", snap.size);

        if (snap.empty) {
            container.innerHTML = `
                <div style="text-align:center; padding:80px 40px; background:white; border-radius:12px; border:1px dashed var(--border)">
                    <img src="https://illustrations.popsy.co/slate/search.svg" style="width:160px; margin-bottom:24px; opacity:0.6">
                    <h3 style="font-size:20px; font-weight:700">No jobs found matching your filters</h3>
                    <p style="color:var(--ink-3); margin-top:8px">Clients are posting new briefs every hour. Check back soon!</p>
                </div>
            `;
            return;
        }

        const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Sort locally to avoid index requirement for combined where + orderBy
        jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        container.innerHTML = jobs.map(j => `
            <div class="job-card" style="background:white; padding:24px; border-radius:12px; border:1px solid var(--border); margin-bottom:16px; transition:0.2s" onmouseover="this.style.borderColor='var(--primary)'" onmouseout="this.style.borderColor='var(--border)'">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px">
                    <span style="background:var(--primary-light); color:var(--primary); padding:4px 12px; border-radius:6px; font-size:11px; font-weight:800; text-transform:uppercase">${j.discipline || 'General'}</span>
                    <span style="font-size:12px; color:var(--ink-3); font-weight:500">${formatDate(j.created_at)}</span>
                </div>
                
                <h2 style="font-size:20px; font-weight:700; margin-bottom:8px; color:var(--ink)">${j.title}</h2>
                <p style="font-size:14px; color:var(--ink-2); line-height:1.6; margin-bottom:20px; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden">${j.description}</p>
                
                <div style="display:flex; gap:20px; margin-bottom:20px; flex-wrap:wrap">
                    <div style="display:flex; align-items:center; gap:6px; font-size:14px; font-weight:700; color:var(--ink)">
                        <span style="color:var(--primary)">₹</span> ${(j.budget_min||0).toLocaleString()} - ₹${(j.budget_max||0).toLocaleString()}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--ink-3)">
                        <span>🏢</span> ${j.work_mode || 'Remote'}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--ink-3)">
                        <span>🕒</span> ${j.duration || 'Short-term'}
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--border); padding-top:20px">
                    <div style="display:flex; align-items:center; gap:10px">
                        <div style="width:32px; height:32px; border-radius:50%; background:var(--surface-3); display:flex; align-items:center; justify-content:center; font-weight:700; color:var(--primary); font-size:12px">${(j.company_name||'C').charAt(0)}</div>
                        <span style="font-size:14px; font-weight:600; color:var(--ink-2)">${j.company_name || 'Verified Client'}</span>
                    </div>
                    <button class="btn btn-primary" onclick="window.location.href='/job-detail.html?id=${j.id}'">Apply Now →</button>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error("Marketplace Sync Error:", err);
        container.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger)">Connection interrupted. Please refresh the page.</div>`;
    }
}

// 3. HELPERS
function formatDate(iso) {
    if (!iso) return "Recently";
    const date = new Date(iso);
    const diff = Math.floor((new Date() - date) / 1000);
    if (diff < 3600) return "Just now";
    if (diff < 86400) return Math.floor(diff/3600) + "h ago";
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function setupNav() {
    const initials = _userData.full_name.split(' ').map(n=>n[0]).join('').toUpperCase();
    const navRight = document.querySelector('.nav-right');
    if (navRight) navRight.innerHTML = `<div class="avatar" style="cursor:pointer" onclick="document.getElementById('profileMenu').classList.toggle('show')">${initials}</div>`;
}
