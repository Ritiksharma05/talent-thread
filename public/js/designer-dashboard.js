import { auth, db } from './src/firebase.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
    collection, doc, getDoc, getDocs, updateDoc, addDoc, 
    query, where, orderBy, limit, onSnapshot, 
    getCountFromServer, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Global cache
let currentUser = null;
let userData = null;
let profileData = null;
let reviewData = null;

// ==========================================
// UTILITIES
// ==========================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.log(`Toast (${type}): ${message}`);
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    
    container.appendChild(toast);
    
    // Trigger layout for transition
    toast.offsetHeight;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function removeSkeleton(id, text = null) {
    const el = document.getElementById(id);
    if (el) {
        if (text !== null) el.innerText = text;
        el.classList.remove('skeleton');
    }
}

function getInitials(name) {
    if (!name) return '??';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

// ==========================================
// AUTH FLOW
// ==========================================

// Ensure body is hidden until auth resolves
document.body.style.visibility = 'hidden';

// Safety fallback: if auth takes too long, show something
const authFallbackTimer = setTimeout(() => {
    if (document.body.style.visibility === 'hidden') {
        document.body.style.visibility = 'visible';
        console.warn("Auth resolution taking too long, showing page anyway.");
    }
}, 4000);

onAuthStateChanged(auth, async (user) => {
    clearTimeout(authFallbackTimer);
    
    if (!user) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const userRef = doc(db, 'users', user.uid);
        let userSnap;
        
        try {
            userSnap = await getDoc(userRef);
        } catch (getErr) {
            console.error("Failed to get user doc:", getErr);
            // If we can't even read the user doc, it might be a rules issue or missing doc that throws
            if (getErr.code === 'permission-denied') {
                showToast("Access denied. Please ensure you are logged in correctly.", "error");
            } else {
                showToast(`Auth Error: ${getErr.message}`, "error");
            }
            document.body.style.visibility = 'visible';
            return;
        }
        
        if (!userSnap || !userSnap.exists()) {
            console.error("User document missing in Firestore for UID:", user.uid);
            // Fallback: If auth exists but no doc, maybe they are newly created or from legacy system
            // We'll redirect to onboarding or login
            window.location.href = '/login.html?error=no_profile';
            return;
        }

        const uData = userSnap.data();
        
        // Role routing
        if (uData.role === 'client') {
            window.location.href = '/client-dashboard'; 
            return;
        }

        if (uData.role === 'admin') {
            // Admins can view the dashboard but maybe with a badge?
            console.log("Admin accessing designer dashboard");
        } else if (uData.role !== 'designer') {
            window.location.href = '/login.html';
            return;
        }

        // Setup UI
        currentUser = user;
        userData = uData;
        
        // Show body as soon as we know the user is authorized
        document.body.style.visibility = 'visible';
        
        // Initialize the dashboard components
        initDashboard(user, uData);
        
    } catch (error) {
        console.error("Dashboard Auth Global Error:", error);
        document.body.style.visibility = 'visible';
        showToast(`Authentication error: ${error.message || 'Please refresh.'}`, "error");
    }
});

// ==========================================
// DASHBOARD INITIALIZATION
// ==========================================

async function initDashboard(user, uData) {
    setupDropdownsAndListeners();
    updateStreakTracker(user.uid, uData);
    populateNavInfo(uData);
    
    try {
        // Load Profile Data
        const profileSnap = await getDoc(doc(db, 'profiles', user.uid));
        profileData = profileSnap.exists() ? profileSnap.data() : null;
        
        // Load Review Data
        const reviewsRef = collection(db, `reviews/${user.uid}/entries`);
        const qReview = query(reviewsRef, orderBy('created_at', 'desc'), limit(1));
        const reviewDocs = await getDocs(qReview);
        reviewData = reviewDocs.empty ? null : reviewDocs.docs[0].data();
        
        // Render Sections
        renderIdentityCard(user.uid, uData, profileData);
        renderProfileStrength(user.uid, uData, profileData, reviewData);
        renderAIScore(reviewData);
        renderChallenges(reviewData);
        
        // Load Stats & Async Content
        loadStats(user.uid);
        loadContracts(user.uid);
        setupNotifications(user.uid);
        loadRecommendedJobs(profileData?.discipline || '');
        loadDailyTip();

    } catch (err) {
        console.error("Dashboard Init Error:", err);
        // Even if some data fails, we keep the UI visible
        document.body.style.visibility = 'visible';
    }
}

// ==========================================
// RENDERERS & LOADERS
// ==========================================

function populateNavInfo(uData) {
    const avatarEl = document.getElementById('nav-avatar');
    if (!avatarEl) return;

    if (uData.profile_image) {
        avatarEl.innerHTML = `<img src="${uData.profile_image}" alt="Profile">`;
    } else {
        avatarEl.innerText = getInitials(uData.full_name);
    }
    avatarEl.classList.remove('skeleton');

    const planBadge = document.getElementById('nav-plan-badge');
    if (planBadge) {
        planBadge.classList.remove('skeleton');
        if (uData.plan === 'pro') {
            planBadge.className = 'plan-badge pro';
            planBadge.innerText = 'PRO ✦';
        } else {
            planBadge.className = 'plan-badge free';
            planBadge.innerText = 'FREE';
        }
    }
}

function renderIdentityCard(uid, uData, pData) {
    const avatarEl = document.getElementById('id-avatar');
    if (avatarEl) {
        if (uData.profile_image || (pData && pData.profile_image)) {
            avatarEl.innerHTML = `<img src="${uData.profile_image || pData.profile_image}" alt="Profile">`;
        } else {
            avatarEl.innerText = getInitials(uData.full_name);
        }
        avatarEl.classList.remove('skeleton');
    }

    removeSkeleton('id-name', uData.full_name || 'Designer');
    removeSkeleton('id-handle', uData.username ? `@${uData.username}` : `@designer`);
    
    if (pData) {
        removeSkeleton('id-discipline', pData.discipline || 'Design Generalist');
        removeSkeleton('id-location', pData.city ? `📍 ${pData.city}` : '');
    } else {
        removeSkeleton('id-discipline', 'New Designer');
        removeSkeleton('id-location', '');
    }

    const btn = document.getElementById('availability-btn');
    if (btn) {
        const dot = document.getElementById('availability-dot');
        const text = document.getElementById('availability-text');
        
        let currentAvail = pData?.availability || 'available';
        btn.classList.remove('skeleton');
        updateAvailabilityUI(currentAvail);

        btn.onclick = async () => {
            const nextState = currentAvail === 'available' ? 'partial' : 
                             currentAvail === 'partial' ? 'unavailable' : 'available';
            const prevState = currentAvail;
            currentAvail = nextState;
            updateAvailabilityUI(nextState);
            
            try {
                await updateDoc(doc(db, 'profiles', uid), { availability: nextState });
                showToast("Availability updated");
            } catch (err) {
                currentAvail = prevState;
                updateAvailabilityUI(prevState);
                showToast("Failed to update availability", "error");
            }
        };

        function updateAvailabilityUI(state) {
            if (dot) dot.className = `status-dot ${state}`;
            if (text) text.innerText = state === 'available' ? 'Available' : 
                             state === 'partial' ? 'Partially Available' : 'Not Taking Work';
        }
    }

    const idPlan = document.getElementById('id-plan');
    if (idPlan) {
        removeSkeleton('id-plan');
        if (uData.plan === 'pro') {
            idPlan.className = 'plan-badge pro';
            idPlan.innerText = 'PRO ✦';
        } else {
            idPlan.className = 'plan-badge free';
            idPlan.innerText = 'FREE';
            const upgradeLink = document.getElementById('upgrade-link');
            if (upgradeLink) upgradeLink.style.display = 'inline-block';
        }
    }

    const viewBtn = document.getElementById('view-profile-btn');
    if (viewBtn) {
        viewBtn.href = uData.username ? `/designers/${uData.username}` : '#';
        removeSkeleton('view-profile-btn', 'View Public Profile →');
    }

    const compScore = pData?.profile_completeness || 0;
    const banner = document.getElementById('completeness-banner');
    if (banner && compScore < 80) {
        banner.style.display = 'flex';
        const textEl = document.getElementById('completeness-text');
        if (textEl) textEl.innerText = `Your profile is ${compScore}% complete — finish setup to appear in client searches.`;
        setTimeout(() => {
            const fill = document.getElementById('completeness-fill');
            if (fill) fill.style.width = `${compScore}%`;
        }, 100);
    }
}

async function renderProfileStrength(uid, uData, pData, rData) {
    let hasApps = false;
    try {
        const appsCount = await getCountFromServer(query(collection(db, 'applications'), where('designer_id', '==', uid)));
        hasApps = appsCount.data().count > 0;
    } catch(e) {}

    const checks = [
        { id: 'email', label: 'Email verified', done: true, fixUrl: null },
        { id: 'photo', label: 'Profile photo uploaded', done: !!(uData.profile_image || pData?.profile_image), fixUrl: '/profile-edit.html' },
        { id: 'head', label: 'Headline written', done: !!(pData?.headline), fixUrl: '/profile-edit.html' },
        { id: 'bio', label: 'Bio added', done: !!(pData?.bio || pData?.about_text), fixUrl: '/profile-edit.html' },
        { id: 'port', label: 'Portfolio (min 3 items)', done: false, fixUrl: '/portfolio.html' },
        { id: 'app', label: 'First application sent', done: hasApps, fixUrl: '/marketplace.html' }
    ];

    try {
        const portCountSnap = await getCountFromServer(collection(db, `portfolioItems/${uid}/items`));
        checks.find(c => c.id === 'port').done = portCountSnap.data().count >= 3;
    } catch(e) {}

    const list = document.getElementById('strength-list');
    if (list) {
        list.innerHTML = checks.map(c => `
            <div class="strength-item">
                <div class="strength-check ${c.done ? 'done' : ''}">${c.done ? '✓' : ''}</div>
                <div style="flex:1">
                    <div style="font-size:14px; font-weight:500; color:${c.done ? 'var(--ink)' : 'var(--ink-2)'}">${c.label}</div>
                    ${!c.done && c.fixUrl ? `<a href="${c.fixUrl}" class="strength-fix">Complete now →</a>` : ''}
                </div>
            </div>
        `).join('');
    }

    const doneCount = checks.filter(c => c.done).length;
    const strengthTitle = document.getElementById('strength-title');
    if (strengthTitle) strengthTitle.innerText = doneCount === checks.length ? 'Profile Strength: Excellent' : 'Complete your Profile';
    
    const strengthScore = Math.round((doneCount / checks.length) * 100);
    const scoreEl = document.getElementById('strength-score');
    if (scoreEl) scoreEl.innerText = `${strengthScore}%`;
    
    const ring = document.getElementById('strength-ring');
    if (ring) {
        const circ = 2 * Math.PI * 34; 
        const offset = circ - (strengthScore / 100) * circ;
        ring.style.strokeDasharray = `${circ}`;
        ring.style.strokeDashoffset = `${offset}`;
    }
}

function renderAIScore(rData) {
    const score = rData?.assessment?.overallScore || 0;
    const band = rData?.assessment?.band || 'Pending';
    
    removeSkeleton('ai-band', band);
    removeSkeleton('ai-score', `${score}/100`);
    
    const fill = document.getElementById('ai-progress-fill');
    if (fill) fill.style.width = `${score}%`;
    
    const pulse = document.getElementById('pulse-highlight');
    if (pulse && score > 70) pulse.style.display = 'block';
}

function renderChallenges(rData) {
    const challenges = rData?.challenges || [];
    const list = document.getElementById('challenges-list');
    if (!list) return;

    if (challenges.length === 0) {
        list.innerHTML = `<div class="text-grey text-sm">No active challenges. Take a new AI review to generate goals.</div>`;
        return;
    }

    list.innerHTML = challenges.map(c => `
        <div class="challenge-card">
            <div class="flex-between" style="margin-bottom:8px">
                <span class="badge ${c.type || 'skill'}">${c.type?.toUpperCase() || 'SKILL'}</span>
                <span class="text-xs text-grey">+${c.points || 50} pts</span>
            </div>
            <div style="font-weight:600; font-size:14px; margin-bottom:4px">${c.title}</div>
            <div class="text-xs text-grey" style="margin-bottom:12px">${c.description}</div>
            <button class="btn btn-sm btn-outline w-full" onclick="window.location.href='/skill-lab.html'">Start Challenge</button>
        </div>
    `).join('');
}

async function loadStats(uid) {
    try {
        const appsCount = await getCountFromServer(query(collection(db, 'applications'), where('designer_id', '==', uid)));
        removeSkeleton('stat-applied', appsCount.data().count.toString());
        
        const contractsCount = await getCountFromServer(query(collection(db, 'contracts'), where('designer_id', '==', uid)));
        removeSkeleton('stat-active', contractsCount.data().count.toString());
        
        const contractsSnap = await getDocs(query(collection(db, 'contracts'), where('designer_id', '==', uid)));
        let totalEarned = 0;
        contractsSnap.forEach(doc => {
            totalEarned += (doc.data().total_value || 0);
        });
        removeSkeleton('stat-earned', `₹${totalEarned.toLocaleString('en-IN')}`);

        removeSkeleton('stat-views', (Math.floor(Math.random() * 50) + 10).toString());
    } catch (e) {
        console.warn("Stats load failed:", e);
    }
}

async function loadContracts(uid) {
    const list = document.getElementById('active-contracts-list');
    if (!list) return;

    try {
        const q = query(collection(db, 'contracts'), where('designer_id', '==', uid), limit(3));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            list.innerHTML = `<div class="text-grey text-sm p-4">No active contracts. <a href="/marketplace.html" style="color:var(--primary)">Find jobs →</a></div>`;
            return;
        }

        list.innerHTML = '';
        snap.forEach(doc => {
            const c = doc.data();
            list.innerHTML += `
                <div class="contract-row">
                    <div style="font-weight:500">${c.title}</div>
                    <div class="text-xs text-grey">${c.client_name || 'Client'} · ₹${(c.total_value || 0).toLocaleString()}</div>
                    <div class="flex-between mt-2">
                        <span class="text-xs" style="color:var(--success)">Active</span>
                        <a href="/contracts.html" class="text-xs" style="color:var(--primary)">Manage</a>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.warn("Contracts load failed:", e);
    }
}

function setupNotifications(uid) {
    const list = document.getElementById('notifications-list');
    if (!list) return;

    onSnapshot(query(collection(db, `notifications/${uid}/items`), orderBy('created_at', 'desc'), limit(5)), (snap) => {
        if (snap.empty) {
            list.innerHTML = `<div class="text-grey text-xs p-2">No new notifications.</div>`;
            return;
        }
        list.innerHTML = snap.docs.map(doc => {
            const n = doc.data();
            return `
                <div class="notif-item">
                    <div style="font-weight:500; font-size:13px">${n.title}</div>
                    <div class="text-xs text-grey">${n.body}</div>
                </div>
            `;
        }).join('');
    });
}

function loadRecommendedJobs(discipline) {
    const list = document.getElementById('recommended-jobs');
    if (!list) return;
    
    // Simulate recommendation logic or fetch from a 'gigs' collection
    list.innerHTML = `
        <div class="job-card-mini">
            <div class="flex-between">
                <span class="text-xs font-bold" style="color:var(--primary)">HOT MATCH</span>
                <span class="text-xs text-grey">₹45k</span>
            </div>
            <div class="font-medium text-sm mt-1">SaaS Dashboard UI</div>
            <button class="btn btn-xs btn-primary mt-2" onclick="window.location.href='/marketplace.html'">Quick Apply</button>
        </div>
    `;
}

function loadDailyTip() {
    const tips = [
        "Portfolio tip: Clients value case studies more than just final renders.",
        "Pro tip: Responding to inquiries within 1 hour increases hiring chance by 3x.",
        "AI Insight: Your 'Visual Hierarchy' score is top 5% in your region!",
        "Growth tip: Completing one Skill Lab challenge per week boosts profile visibility."
    ];
    const tipEl = document.getElementById('daily-tip');
    if (tipEl) tipEl.innerText = tips[Math.floor(Math.random() * tips.length)];
}

function updateStreakTracker(uid, uData) {
    const streak = uData.login_streak || 1;
    const streakEl = document.getElementById('login-streak');
    if (streakEl) streakEl.innerText = streak.toString();
}

function setupDropdownsAndListeners() {
    // Nav Dropdown
    const profileBtn = document.getElementById('nav-profile-btn');
    const dropdown = document.getElementById('nav-dropdown');
    
    if (profileBtn && dropdown) {
        profileBtn.onclick = (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('active');
        };
        
        document.onclick = () => dropdown.classList.remove('active');
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await signOut(auth);
            window.location.href = '/login.html';
        };
    }
}
