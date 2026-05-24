import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. NON-NEGOTIABLE AUTH PATTERN
document.body.style.visibility = 'hidden';

let _user = null;
let _userData = null;
let _allDesigners = [];
let _filteredDesigners = [];
let _selectedDesigner = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists() || snap.data().role !== 'client') {
        window.location.href = '/login.html';
        return;
    }
    
    _user = user;
    _userData = snap.data();
    document.body.style.visibility = 'visible';
    init(user, _userData);
});

async function init(user, userData) {
    setupNav(user, userData);
    showSkeleton(true);
    
    try {
        _allDesigners = await loadDesigners();
        _filteredDesigners = [..._allDesigners];
        renderDesignerList(_filteredDesigners);
        updateStats(_allDesigners);
        
        if (_allDesigners.length > 0) {
            selectDesigner(_allDesigners[0].uid);
        }
    } catch (err) {
        console.error("Discovery error:", err);
        showToast("Error loading designers", "error");
    } finally {
        showSkeleton(false);
    }

    setupFilters();
}

// 2. DATA LOADING
async function loadDesigners() {
    const snap = await getDocs(query(
        collection(db, "profiles"),
        where("availability", "!=", "unavailable"),
        limit(60)
    ));
    
    const designers = [];
    for (const d of snap.docs) {
        const profile = { uid: d.id, ...d.data() };
        
        // Get user core data
        const userSnap = await getDoc(doc(db, "users", d.id));
        if (userSnap.exists()) {
            const u = userSnap.data();
            profile.full_name = u.full_name || "Designer";
            profile.plan = u.plan || "free";
        }

        // Get latest AI score
        const reviewQ = query(collection(db, "reviews", d.id, "entries"), orderBy("created_at", "desc"), limit(1));
        const reviewSnap = await getDocs(reviewQ);
        if (!reviewSnap.empty) {
            const assessment = reviewSnap.docs[0].data().assessment;
            profile.ai_score = assessment?.overallScore || 0;
            profile.ai_band = assessment?.band || "Foundation";
            profile.dimensions = assessment?.dimensions || [];
        } else {
            profile.ai_score = 0;
        }

        // Check if saved
        const savedSnap = await getDoc(doc(db, "saved_designers", _user.uid, "items", d.id));
        profile.is_saved = savedSnap.exists();

        designers.push(profile);
    }
    return designers;
}

// 3. UI RENDERING
function renderDesignerList(list) {
    const container = document.getElementById('designerList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-state">No designers found matching filters.</div>';
        return;
    }

    container.innerHTML = list.map(d => `
        <div class="designer-card ${d.uid === _selectedDesigner?.uid ? 'active' : ''}" onclick="selectDesigner('${d.uid}')">
            <div class="card-top">
                <div class="avatar-sm">${d.full_name.charAt(0)}</div>
                <div class="card-info">
                    <div class="name-row">
                        <strong>${d.full_name}</strong>
                        ${d.plan === 'pro' ? '<span class="pro-badge">★ PRO</span>' : ''}
                    </div>
                    <div class="headline">${d.headline || 'Visual Storyteller'}</div>
                </div>
                <div class="score-circle ${getScoreColor(d.ai_score)}">${d.ai_score || '—'}</div>
            </div>
            <div class="card-meta">
                <span class="discipline-tag ${getDisciplineClass(d.discipline)}">${d.discipline}</span>
                <span class="city-tag">📍 ${d.city || 'India'}</span>
                <span class="avail-dot ${d.availability}"></span>
            </div>
            <div class="card-footer">
                <span class="rate">₹${Number(d.preferred_rate || 0).toLocaleString()}/hr</span>
                <button class="save-btn ${d.is_saved ? 'active' : ''}" onclick="toggleSave(event, '${d.uid}')">
                    ${d.is_saved ? '❤️' : '🤍'}
                </button>
            </div>
        </div>
    `).join('');
}

window.selectDesigner = (uid) => {
    _selectedDesigner = _allDesigners.find(d => d.uid === uid);
    renderDesignerList(_filteredDesigners);
    renderDesignerDetail(_selectedDesigner);
};

function renderDesignerDetail(d) {
    const detail = document.getElementById('designerDetail');
    if (!d) return;

    detail.innerHTML = `
        <div class="detail-header">
            <div class="detail-top">
                <div class="avatar-lg">${d.full_name.charAt(0)}</div>
                <div class="detail-main">
                    <h2>${d.full_name} ${d.plan === 'pro' ? '<span class="pro-badge">PRO</span>' : ''}</h2>
                    <p class="headline-lg">${d.headline || ''}</p>
                    <div class="detail-tags">
                        <span class="discipline-tag large ${getDisciplineClass(d.discipline)}">${d.discipline}</span>
                        <span>📍 ${d.city || 'India'}</span>
                        <span class="avail-badge ${d.availability}">${d.availability.toUpperCase()}</span>
                    </div>
                </div>
                <div class="detail-rate">₹${Number(d.preferred_rate || 0).toLocaleString()}<span>/hr</span></div>
            </div>
            <div class="detail-actions">
                <button class="btn btn-primary" onclick="openInviteModal('${d.uid}')">Invite to Project</button>
                <button class="btn btn-outline" onclick="toggleSave(null, '${d.uid}')">${d.is_saved ? 'Saved ❤️' : 'Save Designer 🤍'}</button>
            </div>
        </div>

        <div class="detail-content">
            <div class="detail-section">
                <h3>AI Performance Score</h3>
                <div class="ai-score-row">
                    <div class="large-score-ring">
                        <svg width="100" height="100">
                            <circle cx="50" cy="50" r="45" class="ring-bg"></circle>
                            <circle cx="50" cy="50" r="45" class="ring-fill ${getScoreColor(d.ai_score)}" style="stroke-dashoffset: ${282 - (282 * d.ai_score / 100)}"></circle>
                            <text x="50" y="55" class="score-num">${d.ai_score}</text>
                        </svg>
                        <span class="band-label">${d.ai_band || 'Foundation'}</span>
                    </div>
                    <div class="dimension-grid">
                        ${(d.dimensions || []).map(dim => `
                            <div class="dim-bar">
                                <label>${dim.label}</label>
                                <div class="bar-bg"><div class="bar-fill" style="width:${dim.score}%"></div></div>
                                <span>${dim.score}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>About</h3>
                <p class="bio-text">${d.bio || 'No bio provided.'}</p>
            </div>

            <div class="detail-section">
                <h3>Skills & Tools</h3>
                <div class="skills-wrap">
                    ${(d.skills || []).map(s => `<span class="skill-chip">${s}</span>`).join('')}
                    ${(d.tools || []).map(t => `<span class="tool-chip">${t}</span>`).join('')}
                </div>
            </div>
        </div>
    `;
}

// 4. ACTIONS
window.toggleSave = async (e, uid) => {
    if (e) e.stopPropagation();
    const isSaved = _allDesigners.find(d => d.uid === uid).is_saved;
    const ref = doc(db, "saved_designers", _user.uid, "items", uid);
    
    try {
        if (isSaved) {
            await deleteDoc(ref);
        } else {
            await setDoc(ref, { designer_uid: uid, saved_at: new Date().toISOString() });
        }
        _allDesigners.find(d => d.uid === uid).is_saved = !isSaved;
        renderDesignerList(_filteredDesigners);
        if (_selectedDesigner?.uid === uid) renderDesignerDetail(_selectedDesigner);
        showToast(isSaved ? "Removed from saved" : "Designer saved!", "success");
    } catch (err) {
        showToast("Action failed", "error");
    }
};

window.openInviteModal = async (uid) => {
    // Modal implementation...
    showToast("Invite modal opening for " + uid);
};

// 5. FILTERS & NAV
function setupFilters() {
    const search = document.getElementById('searchDesigners');
    search.oninput = (e) => {
        const query = e.target.value.toLowerCase();
        _filteredDesigners = _allDesigners.filter(d => 
            d.full_name.toLowerCase().includes(query) ||
            (d.skills || []).some(s => s.toLowerCase().includes(query)) ||
            (d.headline || '').toLowerCase().includes(query)
        );
        renderDesignerList(_filteredDesigners);
    };
}

function setupNav(user, userData) {
    const navRight = document.querySelector('.nav-right');
    const centerNav = document.querySelector('.nav-center');
    const initials = userData.full_name.split(' ').map(n => n[0]).join('').toUpperCase();
    
    navRight.innerHTML = `
        <div class="plan-badge ${userData.plan}">${userData.plan.toUpperCase()}</div>
        <div class="user-profile-trigger" id="profileDropdownTrigger">
            <div class="avatar">${initials}</div>
            <div class="dropdown-menu" id="profileDropdown">
                <div class="dropdown-header"><strong>${userData.full_name}</strong><span>${userData.email}</span></div>
                <hr><a href="/client-profile-edit.html">Company Profile</a>
                <a href="/client-jobs.html">Post a Job</a>
                ${userData.role === 'admin' ? '<a href="/admin.html" style="color:var(--primary)">Admin Panel</a>' : ''}
                <hr><button onclick="handleLogout()" class="logout-btn">Log Out</button>
            </div>
        </div>
    `;

    centerNav.innerHTML = `
        <a href="/client-dashboard.html">Dashboard</a>
        <a href="/designers.html" class="active">Find Designers</a>
        <a href="/client-jobs.html">My Jobs</a>
        <a href="/contracts.html">Contracts</a>
        <a href="/messages.html">Messages</a>
    `;

    document.getElementById('profileDropdownTrigger').onclick = () => document.getElementById('profileDropdown').classList.toggle('show');
}

// HELPERS
function getScoreColor(s) {
    if (s >= 82) return 'p82';
    if (s >= 70) return 'p70';
    if (s >= 56) return 'p56';
    return 'pFoundation';
}
function getDisciplineClass(d) {
    const map = { 'UI/UX Design': 'uiux', 'Brand Identity': 'brand', 'Motion Graphics': 'motion', 'Product Design': 'product' };
    return map[d] || 'other';
}
window.handleLogout = () => signOut(auth).then(() => window.location.href = '/login.html');
function showToast(msg, type='info') {
    const t = document.createElement('div'); t.className = `toast toast-${type}`; t.innerText = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
}
function showSkeleton(s) {
    const list = document.getElementById('designerList');
    if (s) list.innerHTML = Array(4).fill(0).map(() => `<div class="skeleton-card"></div>`).join('');
}
function updateStats(list) {
    document.getElementById('totalCount').innerText = list.length + '+';
    const avg = Math.round(list.reduce((acc, d) => acc + (d.ai_score || 0), 0) / (list.length || 1));
    document.getElementById('avgScore').innerText = avg + '/100';
}
