import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
    query, where, orderBy, limit, onSnapshot, getCountFromServer,
    writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// CRITICAL AUTH PATTERN
// ==========================================
document.body.style.visibility = 'hidden';

let currentUser = null;
let clientData = null;
let clientProfile = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }

    try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userSnap.exists() || userSnap.data().role !== 'client') {
            window.location.href = '/login.html';
            return;
        }

        currentUser = user;
        clientData = userSnap.data();

        // Success
        document.body.style.visibility = 'visible';
        initClientDashboard();
    } catch (err) {
        console.error("Auth initialization error:", err);
        window.location.href = '/login.html';
    }
});

// ==========================================
// DASHBOARD INITIALIZATION
// ==========================================

async function initClientDashboard() {
    // 1. Fetch Client Profile
    const profileSnap = await getDoc(doc(db, 'client_profiles', currentUser.uid));
    clientProfile = profileSnap.exists() ? profileSnap.data() : { profile_completeness: 0 };

    // 2. Load Core Components
    updateNav();
    renderIdentityCard();

    // 3. Parallel Data Fetching
    loadStats();
    loadJobs('all');
    loadApplications();
    loadContracts();
    loadFeaturedDesigners();
    loadSpending();
    loadOnboardingSteps();

    // 4. Real-time Notifications
    setupNotifications();

    // 5. Setup Interactive Elements
    setupEventListeners();
}

// ==========================================
// UI RENDERERS
// ==========================================

function updateNav() {
    const avatar = document.getElementById('nav-avatar-circle');
    avatar.innerText = clientData.full_name ? clientData.full_name[0].toUpperCase() : 'C';

    document.getElementById('drop-company-name').innerText = clientProfile.company_name || clientData.full_name;
    document.getElementById('drop-email').innerText = clientData.email;

    const planBadge = document.getElementById('plan-badge-nav');
    planBadge.innerText = (clientData.plan || 'free').toUpperCase();
    planBadge.className = `plan-badge plan-${clientData.plan || 'free'}`;
}

function renderIdentityCard() {
    const logoEl = document.getElementById('id-logo');
    if (clientProfile.company_logo) {
        logoEl.innerHTML = `<img src="${clientProfile.company_logo}" alt="Logo">`;
    } else {
        logoEl.innerText = (clientProfile.company_name || clientData.full_name)[0].toUpperCase();
    }

    document.getElementById('id-company-name').innerText = clientProfile.company_name || clientData.full_name;
    document.getElementById('id-company-name').classList.remove('skeleton');

    document.getElementById('id-industry').innerText = clientProfile.industry || 'Design Buyer';
    const websiteEl = document.getElementById('id-website');
    if (clientProfile.website) {
        websiteEl.href = clientProfile.website;
        websiteEl.innerText = clientProfile.website.replace(/^https?:\/\//, '');
    } else {
        websiteEl.style.display = 'none';
    }

    // Joined Date
    const joinedDate = new Date(clientData.created_at);
    document.getElementById('id-joined').innerText = joinedDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

    // Plan
    const planBadge = document.getElementById('id-plan-badge');
    planBadge.innerText = (clientData.plan === 'growth' ? '✦ GROWTH PLAN' : 'FREE PLAN');
    planBadge.className = `plan-badge plan-${clientData.plan || 'free'}`;

    const upgradeCta = document.getElementById('upgrade-cta');
    if (clientData.plan === 'growth') {
        upgradeCta.style.display = 'none';
    }

    // Banner
    const completeness = clientProfile.profile_completeness || 0;
    if (completeness < 80) {
        document.getElementById('profile-banner').style.display = 'flex';
        document.getElementById('banner-progress-fill').style.width = `${completeness}%`;
        document.getElementById('banner-progress-text').innerText = `${completeness}% complete`;
    }
}

// ==========================================
// DATA LOADERS
// ==========================================

async function loadStats() {
    try {
        const uid = currentUser.uid;

        // Count Active Jobs
        const jobsCount = await getCountFromServer(query(collection(db, 'projects'), where('client_uid', '==', uid), where('status', '==', 'open')));
        const draftCount = await getCountFromServer(query(collection(db, 'projects'), where('client_uid', '==', uid), where('status', '==', 'draft')));

        document.getElementById('stat-active-jobs').innerText = jobsCount.data().count;
        document.getElementById('stat-jobs-sub').innerText = `${draftCount.data().count} draft(s)`;

        if (clientData.plan !== 'growth') {
            document.getElementById('job-limit-bar').style.display = 'block';
            document.getElementById('job-limit-fill').style.width = `${(jobsCount.data().count / 3) * 100}%`;
        }

        // Count Applications
        const appsCount = await getCountFromServer(query(collection(db, 'applications'), where('client_uid', '==', uid)));
        const shortlistCount = await getCountFromServer(query(collection(db, 'applications'), where('client_uid', '==', uid), where('status', '==', 'shortlisted')));

        document.getElementById('stat-total-apps').innerText = appsCount.data().count;
        document.getElementById('stat-apps-sub').innerText = `${shortlistCount.data().count} shortlisted`;

        // Contracts
        const contractsCount = await getCountFromServer(query(collection(db, 'contracts'), where('client_uid', '==', uid), where('status', '==', 'active')));
        const completedCount = await getCountFromServer(query(collection(db, 'contracts'), where('client_uid', '==', uid), where('status', '==', 'completed')));

        document.getElementById('stat-active-contracts').innerText = contractsCount.data().count;
        document.getElementById('stat-contracts-sub').innerText = `${completedCount.data().count} completed all time`;

        // Total Spent & Escrow
        const paymentsSnap = await getDocs(query(collection(db, 'payments'), where('client_uid', '==', uid)));
        let released = 0, escrowed = 0;
        paymentsSnap.forEach(doc => {
            const p = doc.data();
            if (p.state === 'released') released += p.amount;
            else if (p.state === 'escrowed') escrowed += p.amount;
        });

        document.getElementById('id-spent').innerText = `₹${released.toLocaleString()}`;
        document.getElementById('stat-total-spent').innerText = `₹${released.toLocaleString()}`;
        document.getElementById('stat-spent-sub').innerText = `₹${escrowed.toLocaleString()} in escrow`;

        // Designers Hired Count (Unique)
        const hiredSnap = await getDocs(query(collection(db, 'contracts'), where('client_uid', '==', uid)));
        const uniqueDesigners = new Set(hiredSnap.docs.map(d => d.data().designer_uid));
        document.getElementById('id-hired').innerText = uniqueDesigners.size;

    } catch (err) {
        console.error("Error loading stats:", err);
    }
}

async function loadJobs(filter = 'all') {
    const list = document.getElementById('jobs-list');
    list.innerHTML = '';

    let q = query(collection(db, 'projects'), where('client_uid', '==', currentUser.uid), orderBy('created_at', 'desc'), limit(5));
    if (filter !== 'all') {
        q = query(collection(db, 'projects'), where('client_uid', '==', currentUser.uid), where('status', '==', filter), orderBy('created_at', 'desc'), limit(5));
    }

    const snap = await getDocs(q);
    document.getElementById('job-count-badge').innerText = snap.size;

    if (snap.empty) {
        list.innerHTML = `
            <div style="text-align:center; padding:20px; color:var(--ink-3)">
                <p>No jobs found in this category.</p>
            </div>
        `;
        return;
    }

    snap.forEach(docSnap => {
        const job = docSnap.data();
        const card = document.createElement('div');
        card.className = 'job-item';

        const timeAgo = getTimeAgo(job.created_at);
        const appStatusClass = job.applications_count >= 4 ? 'msg-green' : (job.applications_count > 0 ? 'msg-amber' : '');
        const appStatusMsg = job.applications_count >= 4 ? `${job.applications_count} proposals — ready to review` :
            (job.applications_count > 0 ? `${job.applications_count} proposals received` : 'No applications yet');

        card.innerHTML = `
            <div class="flex-between">
                <h3 class="font-bold">${job.title}</h3>
                <span class="job-status status-${job.status}">${job.status}</span>
            </div>
            <div class="job-meta-row">
                <span class="chip">${job.discipline}</span>
                <span class="chip">${job.experience_level}</span>
                <span class="text-xs text-grey">₹${job.budget_min.toLocaleString()} - ₹${job.budget_max.toLocaleString()} ${job.budget_type}</span>
            </div>
            <p class="text-xs text-grey">Posted ${timeAgo}</p>
            <div class="app-bar">
                <span class="app-status-msg ${appStatusClass}">${appStatusMsg}</span>
                ${job.applications_count > 0 ? `<button class="btn btn-xs btn-primary" onclick="scrollToId('apps-section')">Review Apps →</button>` : ''}
            </div>
        `;
        list.appendChild(card);
    });
}

async function loadApplications() {
    const list = document.getElementById('apps-list');
    list.innerHTML = '';

    const q = query(collection(db, 'applications'), where('client_uid', '==', currentUser.uid), where('status', '==', 'applied'), orderBy('ai_score', 'desc'), limit(4));
    const snap = await getDocs(q);

    document.getElementById('app-count-badge').innerText = snap.size;

    if (snap.empty) {
        list.innerHTML = `<div class="text-grey text-xs p-4">No new applications to review.</div>`;
        loadKanban(); // Still load pipeline even if no "new" ones
        return;
    }

    for (const docSnap of snap.docs) {
        const app = { id: docSnap.id, ...docSnap.data() };
        const designerSnap = await getDoc(doc(db, 'profiles', app.designer_uid));
        const designer = designerSnap.data();

        const card = document.createElement('div');
        card.className = 'app-card';

        const scoreColor = getScoreColor(app.ai_score);
        const dashOffset = 100 - app.ai_score;

        card.innerHTML = `
            <div class="app-avatar">${designer.profile_image ? `<img src="${designer.profile_image}">` : designer.full_name[0]}</div>
            <div class="app-center">
                <div class="app-name">${designer.full_name}</div>
                <div class="app-headline">${designer.headline}</div>
                <div class="job-meta-row">
                    <span class="chip">${designer.discipline}</span>
                    <span class="chip">${designer.city}</span>
                </div>
                <div class="app-note">"${app.cover_note}"</div>
                <div class="text-xs text-grey">Proposed: ₹${app.proposed_rate.toLocaleString()} · ${app.estimated_timeline}</div>
            </div>
            <div class="app-right">
                <div class="score-ring">
                    <svg width="40" height="40" viewBox="0 0 42 42">
                        <circle class="score-circle-bg" cx="21" cy="21" r="15.915"></circle>
                        <circle class="score-circle-fill" cx="21" cy="21" r="15.915" stroke="${scoreColor}" stroke-dasharray="100" stroke-dashoffset="${dashOffset}"></circle>
                    </svg>
                    <div class="score-val">${app.ai_score}</div>
                </div>
                <span class="text-xs text-grey" style="text-align:center">Client Ready</span>
                <button class="btn btn-xs btn-outline" onclick="shortlistApp('${app.id}')">Shortlist ★</button>
            </div>
        `;
        list.appendChild(card);
    }

    loadKanban();
}

async function loadContracts() {
    const list = document.getElementById('contracts-list');
    list.innerHTML = '';

    const q = query(collection(db, 'contracts'), where('client_uid', '==', currentUser.uid), where('status', '==', 'active'), orderBy('updated_at', 'desc'), limit(3));
    const snap = await getDocs(q);

    document.getElementById('contract-count-badge').innerText = snap.size;

    if (snap.empty) {
        list.innerHTML = `<div class="text-grey text-xs p-4">No active contracts found.</div>`;
        return;
    }

    for (const docSnap of snap.docs) {
        const c = docSnap.data();
        const designerSnap = await getDoc(doc(db, 'users', c.designer_uid));
        const designer = designerSnap.data();

        // Milestones
        const msSnap = await getDocs(query(collection(db, 'milestones'), where('contract_id', '==', docSnap.id)));
        const milestones = msSnap.docs.map(d => d.data());
        const approvedCount = milestones.filter(m => m.status === 'approved').length;
        const totalCount = milestones.length || 1;

        const hasSubmitted = milestones.some(m => m.status === 'submitted');

        const card = document.createElement('div');
        card.className = 'contract-item';
        card.innerHTML = `
            <div class="flex-between">
                <div style="display:flex; align-items:center; gap:8px">
                    <div class="nav-avatar" style="width:24px; height:24px; font-size:10px">${designer.full_name[0]}</div>
                    <span class="font-bold">${designer.full_name}</span>
                </div>
                <b>₹${c.total_value.toLocaleString()}</b>
            </div>
            <div class="text-xs text-grey mt-2">${c.title}</div>
            
            <div class="contract-progress">
                ${milestones.map(m => `<div class="ms-segment ms-${m.status}"></div>`).join('')}
            </div>
            
            <div class="flex-between">
                <span class="text-xs text-grey">${approvedCount} of ${totalCount} milestones complete</span>
                ${hasSubmitted ? `<div class="action-alert"><span class="text-xs font-bold" style="color:var(--warning)">REVIEW NEEDED</span> <a href="/contracts.html?id=${docSnap.id}" class="btn btn-xs btn-primary" style="margin-left:12px">Review Now →</a></div>` : ''}
            </div>
        `;
        list.appendChild(card);
    }
}

// ==========================================
// KANBAN PIPELINE
// ==========================================

async function loadKanban() {
    const q = query(collection(db, 'applications'), where('client_uid', '==', currentUser.uid));
    const snap = await getDocs(q);

    const lists = { applied: [], shortlisted: [], hired: [], rejected: [] };

    for (const docSnap of snap.docs) {
        const app = docSnap.data();
        const dSnap = await getDoc(doc(db, 'profiles', app.designer_uid));
        const designer = dSnap.data();

        const cardHtml = `
            <div class="kb-card" draggable="true" ondragstart="handleDragStart(event, '${docSnap.id}')">
                <b>${designer.full_name}</b>
                <div class="kb-card-info">AI Score: ${app.ai_score}</div>
            </div>
        `;
        if (lists[app.status]) lists[app.status].push(cardHtml);
    }

    Object.keys(lists).forEach(status => {
        document.querySelector(`#kb-${status} .kb-list`).innerHTML = lists[status].join('');
        document.getElementById(`kb-count-${status}`).innerText = lists[status].length;
    });
}

window.handleDragStart = (ev, id) => {
    ev.dataTransfer.setData("applicationId", id);
};

window.handleDrop = async (ev, newStatus) => {
    ev.preventDefault();
    const id = ev.dataTransfer.getData("applicationId");

    if (newStatus === 'hired') {
        openHireModal(id);
        return;
    }

    try {
        await updateDoc(doc(db, 'applications', id), { status: newStatus });
        showToast(`Application moved to ${newStatus}`);
        loadApplications();
    } catch (e) { showToast("Update failed", "error"); }
};

// ==========================================
// RIGHT COLUMN COMPONENTS
// ==========================================

async function loadFeaturedDesigners() {
    const q = query(collection(db, 'profiles'), where('availability', '==', 'available'), orderBy('profile_completeness', 'desc'), limit(3));
    const snap = await getDocs(q);
    const container = document.getElementById('featured-designers');
    container.innerHTML = '';

    snap.forEach(docSnap => {
        const d = docSnap.data();
        const card = document.createElement('div');
        card.className = 'app-card';
        card.style.padding = '12px';
        card.style.margin = '0';
        card.innerHTML = `
            <div class="app-avatar" style="width:40px; height:40px">${d.profile_image ? `<img src="${d.profile_image}">` : d.full_name[0]}</div>
            <div style="flex:1">
                <div class="font-bold text-sm">${d.full_name}</div>
                <div class="text-xs text-grey">${d.discipline} · ₹${(d.preferred_rate || 0).toLocaleString()}/hr</div>
            </div>
            <div class="score-val" style="position:static; color:${getScoreColor(85)}">85</div>
        `;
        container.appendChild(card);
    });
}

function setupNotifications() {
    const q = query(collection(db, `notifications/${currentUser.uid}/items`), orderBy('created_at', 'desc'), limit(8));
    onSnapshot(q, (snap) => {
        const list = document.getElementById('notif-list');
        list.innerHTML = '';
        let unread = 0;

        snap.forEach(docSnap => {
            const n = docSnap.data();
            if (!n.is_read) unread++;

            const item = document.createElement('div');
            item.className = `notif-item ${n.is_read ? '' : 'unread'}`;

            const icon = getNotifIcon(n.type);
            item.innerHTML = `
                <div class="notif-icon" style="background:${icon.bg}">${icon.svg}</div>
                <div class="notif-body">
                    <h5>${n.title}</h5>
                    <p>${n.body}</p>
                    <div class="notif-time">${getTimeAgo(n.created_at)}</div>
                </div>
            `;
            item.onclick = async () => {
                await updateDoc(docSnap.ref, { is_read: true });
                if (n.link) window.location.href = n.link;
            };
            list.appendChild(item);
        });

        const badge = document.getElementById('notif-badge');
        const pill = document.getElementById('notif-count-pill');
        if (unread > 0) {
            badge.classList.add('active');
            pill.style.display = 'inline-block';
            pill.innerText = unread;
        } else {
            badge.classList.remove('active');
            pill.style.display = 'none';
        }
    });
}

function loadSpending() {
    // This is normally calculated from the payments load, but we re-render chart here
    const released = 150000, escrow = 45000, pending = 20000; // Sample
    const total = released + escrow + pending;

    document.getElementById('donut-total-val').innerText = `₹${released.toLocaleString()}`;
    document.getElementById('leg-released').innerText = `₹${released.toLocaleString()}`;
    document.getElementById('leg-escrow').innerText = `₹${escrow.toLocaleString()}`;
    document.getElementById('leg-pending').innerText = `₹${pending.toLocaleString()}`;

    // Simple SVG calculation
    const releasedPct = (released / total) * 100;
    const escrowPct = (escrow / total) * 100;

    const segmentReleased = document.getElementById('segment-released');
    const segmentEscrow = document.getElementById('segment-escrow');

    segmentReleased.setAttribute('stroke-dasharray', `${releasedPct} 100`);
    segmentEscrow.setAttribute('stroke-dasharray', `${escrowPct} 100`);
    segmentEscrow.setAttribute('stroke-dashoffset', `${-(releasedPct) + 25}`);
}

async function loadOnboardingSteps() {
    let done = 0;
    const steps = [
        { id: 'step-profile', done: clientProfile.profile_completeness >= 80 },
        { id: 'step-logo', done: !!clientProfile.company_logo },
        { id: 'step-job', done: false }, // Check if jobs > 0
        { id: 'step-review', done: false }, // Check if shortlisted > 0
        { id: 'step-fund', done: false } // Check if payments > 0
    ];

    // Check Job count
    const jobsCount = await getCountFromServer(query(collection(db, 'projects'), where('client_uid', '==', currentUser.uid)));
    steps[2].done = jobsCount.data().count > 0;

    // Check Shortlisted
    const slCount = await getCountFromServer(query(collection(db, 'applications'), where('client_uid', '==', currentUser.uid), where('status', '==', 'shortlisted')));
    steps[3].done = slCount.data().count > 0;

    // Check Payments
    const payCount = await getCountFromServer(query(collection(db, 'payments'), where('client_uid', '==', currentUser.uid)));
    steps[4].done = payCount.data().count > 0;

    steps.forEach(s => {
        const el = document.getElementById(s.id);
        if (s.done) {
            el.classList.add('done');
            done++;
        }
    });

    document.getElementById('steps-progress-text').innerText = `${done} of 5 steps complete`;
    document.getElementById('steps-progress-fill').style.width = `${(done / 5) * 100}%`;

    if (done === 5) {
        document.querySelector('.steps-list').style.display = 'none';
        document.getElementById('all-set-msg').style.display = 'block';
    }
}

// ==========================================
// HIRE MODAL / CONTRACT
// ==========================================

let activeAppId = null;

async function openHireModal(appId) {
    activeAppId = appId;
    const appSnap = await getDoc(doc(db, 'applications', appId));
    const app = appSnap.data();
    const dSnap = await getDoc(doc(db, 'users', app.designer_uid));
    const designer = dSnap.data();

    document.getElementById('hire-designer-name').innerText = designer.full_name;
    document.getElementById('hire-overlay').classList.add('active');
    document.getElementById('hire-panel').classList.add('active');
}

window.closeHireModal = () => {
    document.getElementById('hire-overlay').classList.remove('active');
    document.getElementById('hire-panel').classList.remove('active');
};

async function createContract() {
    const title = document.getElementById('c-title').value;
    const scope = document.getElementById('c-scope').value;
    const agreed = document.getElementById('c-terms').checked;

    if (!title || !scope || !agreed) return;

    try {
        const appSnap = await getDoc(doc(db, 'applications', activeAppId));
        const app = appSnap.data();

        // 1. Create Contract
        const contractRef = await addDoc(collection(db, 'contracts'), {
            client_uid: currentUser.uid,
            designer_uid: app.designer_uid,
            title, scope,
            total_value: 0, // Will sum milestones
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });

        // 2. Create Milestones (Sample for demo)
        await addDoc(collection(db, 'milestones'), {
            contract_id: contractRef.id,
            title: "Project Kickoff",
            amount: 5000,
            due_date: new Date().toISOString(),
            status: "pending"
        });

        // 3. Update App & Project
        await updateDoc(doc(db, 'applications', activeAppId), { status: 'hired' });

        showToast("Contract created! Navigating to project...");
        setTimeout(() => window.location.href = `/contracts.html?id=${contractRef.id}`, 1500);
    } catch (e) { showToast("Contract creation failed", "error"); }
}

// ==========================================
// HELPERS
// ==========================================

function setupEventListeners() {
    document.getElementById('nav-user-toggle').onclick = () => document.getElementById('nav-dropdown').classList.toggle('active');
    document.getElementById('logout-btn').onclick = () => signOut(auth).then(() => window.location.href = '/login.html');
    document.getElementById('create-contract-btn').onclick = createContract;

    document.querySelectorAll('[data-job-filter]').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('[data-job-filter]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadJobs(btn.dataset.jobFilter);
        };
    });

    document.getElementById('mark-all-read').onclick = async () => {
        const q = query(collection(db, `notifications/${currentUser.uid}/items`), where('is_read', '==', false));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach(d => batch.update(d.ref, { is_read: true }));
        await batch.commit();
    };
}

function getTimeAgo(isoString) {
    const diff = Math.floor((new Date() - new Date(isoString)) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

function getScoreColor(s) {
    if (s < 41) return 'var(--danger)';
    if (s < 56) return 'var(--warning)';
    if (s < 70) return '#0284c7';
    if (s < 82) return 'var(--success)';
    return '#8b5cf6';
}

function getNotifIcon(type) {
    const map = {
        new_application: { bg: 'var(--primary-light)', svg: '📨' },
        deliverables_submitted: { bg: 'var(--warning-bg)', svg: '📤' },
        milestone_approved: { bg: 'var(--success-bg)', svg: '✅' }
    };
    return map[type] || { bg: 'var(--surface-3)', svg: '🔔' };
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderLeftColor = type === 'success' ? 'var(--success)' : 'var(--danger)';
    t.innerHTML = `<b>${type.toUpperCase()}</b><p class="text-xs">${msg}</p><div class="toast-progress"></div>`;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
}

window.shortlistApp = async (id) => {
    try {
        await updateDoc(doc(db, 'applications', id), { status: 'shortlisted' });
        showToast("Designer shortlisted!");
        loadApplications();
    } catch (e) { showToast("Action failed", "error"); }
};
