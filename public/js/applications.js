import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    collection, doc, getDoc, getDocs, deleteDoc, updateDoc,
    query, where, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. NON-NEGOTIABLE AUTH PATTERN
document.body.style.visibility = 'hidden';

let _user = null;
let _userData = null;
let _applications = [];

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { window.location.href = '/login.html'; return; }
    
    _user = user;
    _userData = snap.data();
    
    if (_userData.role === 'client') {
        window.location.href = '/client-dashboard.html';
        return;
    }
    
    document.body.style.visibility = 'visible';
    init(user, _userData);
});

async function init(user, userData) {
    setupNav(user, userData);
    showSkeleton(true);
    
    try {
        _applications = await loadApplications(user.uid);
        renderApplications(_applications);
        updateStats(_applications);
    } catch (err) {
        console.error("Init error:", err);
        showToast("Error loading applications", "error");
    } finally {
        showSkeleton(false);
    }
}

// 2. DATA LOADING
async function loadApplications(uid) {
    const q = query(
        collection(db, "applications"),
        where("designer_uid", "==", uid),
        orderBy("created_at", "desc")
    );
    const snap = await getDocs(q);
    
    const apps = [];
    const projectPromises = snap.docs.map(async (d) => {
        const app = { id: d.id, ...d.data() };
        
        // Fetch Project
        const projSnap = await getDoc(doc(db, "projects", app.project_id));
        if (projSnap.exists()) {
            const pData = projSnap.data();
            app.projectTitle = pData.title;
            app.projectDiscipline = pData.discipline;
            app.budget = pData.budget_min && pData.budget_max
                ? `₹${pData.budget_min.toLocaleString()} - ₹${pData.budget_max.toLocaleString()}`
                : "Budget TBD";
            
            // Fetch Client Profile
            const clientSnap = await getDoc(doc(db, "client_profiles", pData.client_uid));
            app.companyName = clientSnap.exists() ? clientSnap.data().company_name : "Verified Client";
        } else {
            app.projectTitle = "Deleted Project";
            app.companyName = "Unknown";
        }
        return app;
    });

    return await Promise.all(projectPromises);
}

// 3. UI RENDERING
function renderApplications(apps) {
    const grid = document.getElementById('applicationsGrid');
    if (apps.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <img src="https://illustrations.popsy.co/slate/envelope.svg" alt="Empty" style="width:200px">
                <h3>You haven't applied to any projects yet</h3>
                <p>Browse open projects and send your first proposal.</p>
                <a href="/marketplace.html" class="btn btn-primary" style="margin-top:20px">Find Work →</a>
            </div>
        `;
        return;
    }

    grid.innerHTML = apps.map(app => `
        <div class="app-card" id="app-${app.id}">
            <div class="app-card-main">
                <div class="app-left">
                    <div class="client-avatar-large">${app.companyName.charAt(0)}</div>
                    <div class="app-info">
                        <div class="company-name">${app.companyName}</div>
                        <h3 class="project-title">${app.projectTitle}</h3>
                        <div class="project-meta">
                            <span class="chip">${app.projectDiscipline}</span>
                            <span class="budget-text">${app.budget}</span>
                        </div>
                    </div>
                </div>
                
                <div class="app-center">
                    <div class="proposal-snippet">
                        <strong>Your Proposal:</strong>
                        <p>${app.cover_note || 'No cover note provided.'}</p>
                    </div>
                    <div class="proposal-stats">
                        <span>Rate: <strong>₹${Number(app.proposed_rate).toLocaleString()}</strong></span>
                        <span>Timeline: <strong>${app.estimated_timeline}</strong></span>
                    </div>
                </div>

                <div class="app-right">
                    <div class="score-container">
                        <svg class="score-ring" width="48" height="48">
                            <circle class="ring-bg" cx="24" cy="24" r="20"></circle>
                            <circle class="ring-fill ${getScoreColor(app.ai_score)}" cx="24" cy="24" r="20" style="stroke-dashoffset: ${125 - (125 * (app.ai_score || 0) / 100)}"></circle>
                            <text x="24" y="28" class="score-text">${app.ai_score || '—'}</text>
                        </svg>
                        <span class="score-label">AI Score</span>
                    </div>
                    <div class="status-badge status-${app.status}">${getStatusLabel(app.status)}</div>
                </div>
            </div>

            <div class="app-card-footer">
                <div class="app-timeline">
                    <div class="step reached">Sent</div>
                    <div class="line ${app.status !== 'applied' ? 'reached' : ''}"></div>
                    <div class="step ${['shortlisted', 'hired'].includes(app.status) ? 'reached' : ''}">Shortlisted</div>
                    <div class="line ${app.status === 'hired' ? 'reached' : ''}"></div>
                    <div class="step ${app.status === 'hired' ? 'reached' : ''}">Hired</div>
                </div>
                
                <div class="app-actions">
                    <a href="/marketplace.html?project=${app.project_id}" class="btn-link">View Project →</a>
                    ${app.status === 'hired' ? `<a href="/contracts.html" class="btn btn-success btn-sm">View Contract</a>` : ''}
                    ${['applied', 'shortlisted'].includes(app.status) ? `<button class="btn-text-danger" onclick="handleWithdraw('${app.id}', '${app.project_id}')">Withdraw</button>` : ''}
                </div>
            </div>
        </div>
    `).join('');
}

function updateStats(apps) {
    document.getElementById('statTotal').innerText = apps.length;
    document.getElementById('statShortlisted').innerText = apps.filter(a => a.status === 'shortlisted').length;
    document.getElementById('statHired').innerText = apps.filter(a => a.status === 'hired').length;
    
    const responseRate = apps.length > 0 
        ? Math.round((apps.filter(a => ['shortlisted', 'hired'].includes(a.status)).length / apps.length) * 100)
        : 0;
    
    const rateEl = document.getElementById('responseRate');
    rateEl.innerText = `${responseRate}%`;
    rateEl.style.color = responseRate > 50 ? 'var(--success)' : responseRate > 20 ? 'var(--warning)' : 'var(--danger)';
}

// 4. ACTIONS
window.handleWithdraw = async (appId, projectId) => {
    if (!confirm("Are you sure you want to withdraw this application? This cannot be undone.")) return;
    
    try {
        await deleteDoc(doc(db, "applications", appId));
        
        // Update project count
        const projDoc = await getDoc(doc(db, "projects", projectId));
        if (projSnap.exists()) {
            await updateDoc(doc(db, "projects", projectId), {
                applications_count: Math.max(0, (projDoc.data().applications_count || 1) - 1)
            });
        }

        document.getElementById(`app-${appId}`).style.opacity = '0';
        setTimeout(() => {
            _applications = _applications.filter(a => a.id !== appId);
            renderApplications(_applications);
            updateStats(_applications);
            showToast("Application withdrawn", "success");
        }, 300);
    } catch (err) {
        showToast("Error withdrawing application", "error");
    }
};

// 5. HELPERS
function getStatusLabel(status) {
    const labels = { applied: "Proposal Sent", shortlisted: "⭐ Shortlisted", hired: "🎉 Hired", rejected: "Not Selected" };
    return labels[status] || status;
}

function getScoreColor(score) {
    if (score >= 80) return 'high';
    if (score >= 50) return 'mid';
    return 'low';
}

function setupNav(user, userData) {
    const navRight = document.querySelector('.nav-right');
    const centerNav = document.querySelector('.nav-center');
    const initials = userData.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    
    navRight.innerHTML = `
        <div class="user-profile-trigger" id="profileDropdownTrigger">
            <div class="avatar">${initials}</div>
            <div class="dropdown-menu" id="profileDropdown">
                <div class="dropdown-header"><strong>${userData.full_name}</strong><span>${userData.email}</span></div>
                <hr><a href="/profile-edit.html">Edit Profile</a>
                ${userData.role === 'admin' ? '<a href="/admin.html" style="color:var(--primary)">Admin Panel</a>' : ''}
                <hr><button onclick="handleLogout()" class="logout-btn">Log Out</button>
            </div>
        </div>
    `;

    centerNav.innerHTML = `
        <a href="/designer-dashboard.html">Dashboard</a>
        <a href="/marketplace.html">Find Work</a>
        <a href="/applications.html" class="active">My Applications</a>
        <a href="/contracts.html">Contracts</a>
        <a href="/portfolio.html">Portfolio</a>
    `;

    document.getElementById('profileDropdownTrigger').onclick = () => document.getElementById('profileDropdown').classList.toggle('show');
}

window.handleLogout = () => signOut(auth).then(() => window.location.href = '/login.html');

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function showSkeleton(show) {
    const grid = document.getElementById('applicationsGrid');
    if (show) {
        grid.innerHTML = Array(3).fill(0).map(() => `<div class="skeleton-card" style="height:200px; margin-bottom:24px"></div>`).join('');
    }
}
