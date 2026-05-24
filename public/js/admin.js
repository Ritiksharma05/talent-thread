import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, getDocs, query, where, orderBy, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. STATE MANAGEMENT
let _users = [];
let _projects = [];
let _currentSection = 'overview';

// 2. INITIALIZATION (Triggered by PIN gate or on load)
window.app = {
    init: async () => {
        console.log("Admin Dashboard Initializing...");
        document.body.style.visibility = 'visible'; // Ensure dashboard is visible
        setupSidebar();
        await refreshAllData();
    }
};

async function refreshAllData() {
    await Promise.all([
        loadUsers(),
        loadJobs()
    ]);
    renderOverview();
    renderUsersTable();
    renderJobsTable();
}

// 3. DATA FETCHING
async function loadUsers() {
    const snap = await getDocs(collection(db, "users"));
    _users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Update badge counts
    const badge = document.getElementById('badge-total-users');
    if (badge) badge.innerText = _users.length;
}

async function loadJobs() {
    const snap = await getDocs(collection(db, "projects"));
    _projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const badge = document.getElementById('badge-open-jobs');
    if (badge) badge.innerText = _projects.filter(p => p.status === 'open').length;
}

// 4. RENDERING OVERVIEW
function renderOverview() {
    const designers = _users.filter(u => u.role === 'designer').length;
    const clients = _users.filter(u => u.role === 'client').length;
    const openJobs = _projects.filter(p => p.status === 'open').length;

    setVal('stat-total-users', _users.length);
    setVal('stat-total-designers', designers);
    setVal('stat-total-clients', clients);
    setVal('stat-open-projects', openJobs);

    // Recent Users Table
    const recent = [..._users].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);
    const container = document.getElementById('recentUsersTable');
    if (container) {
        container.innerHTML = recent.map(u => `
            <tr>
                <td><strong>${u.full_name || 'Anonymous'}</strong></td>
                <td>${u.email}</td>
                <td><span class="badge ${u.role === 'client' ? 'bg-info' : 'bg-success'}">${(u.role||'user').toUpperCase()}</span></td>
                <td>${new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
        `).join('');
    }
}

// 5. MANAGING TABLES (with Search & Sort)
function renderUsersTable() {
    const body = document.getElementById('usersTableBody');
    if (!body) return;

    let filtered = [..._users];
    
    // Search filter
    const search = document.getElementById('userSearch')?.value.toLowerCase();
    if (search) {
        filtered = filtered.filter(u => u.full_name?.toLowerCase().includes(search) || u.email?.toLowerCase().includes(search));
    }

    // Role filter
    const roleFilter = document.getElementById('userRoleFilter')?.value;
    if (roleFilter && roleFilter !== 'all') {
        filtered = filtered.filter(u => u.role === roleFilter);
    }

    body.innerHTML = filtered.map((u, i) => `
        <tr>
            <td>${i + 1}</td>
            <td><strong>${u.full_name || 'N/A'}</strong></td>
            <td>${u.email}</td>
            <td>${u.role || 'user'}</td>
            <td>${u.plan || 'Free'}</td>
            <td>${new Date(u.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm" onclick="editUser('${u.id}')">Edit</button>
                <button class="btn btn-sm danger" onclick="deleteUser('${u.id}')">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderJobsTable() {
    const body = document.querySelector('#section-jobs tbody');
    if (!body) return;

    let filtered = [..._projects];
    const statusFilter = document.getElementById('jobStatusFilter')?.value;
    if (statusFilter && statusFilter !== 'all') {
        filtered = filtered.filter(p => p.status === statusFilter);
    }

    body.innerHTML = filtered.map(p => `
        <tr>
            <td><strong>${p.title}</strong></td>
            <td>${p.company_name || 'Verified Client'}</td>
            <td>${p.discipline || 'Design'}</td>
            <td>₹${(p.budget_min||0).toLocaleString()} - ₹${(p.budget_max||0).toLocaleString()}</td>
            <td>${p.applications_count || 0}</td>
            <td><span class="badge ${p.status === 'open' ? 'bg-success' : 'bg-neutral'}">${p.status.toUpperCase()}</span></td>
            <td>${new Date(p.created_at).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm danger" onclick="deleteJob('${p.id}')">Remove</button>
            </td>
        </tr>
    `).join('');
}

// 6. ACTIONS
window.deleteUser = async (id) => {
    if(!confirm("Delete user permanently?")) return;
    await deleteDoc(doc(db, "users", id));
    await loadUsers();
    renderUsersTable();
    renderOverview();
};

window.deleteJob = async (id) => {
    if(!confirm("Delete job from platform?")) return;
    await deleteDoc(doc(db, "projects", id));
    await loadJobs();
    renderJobsTable();
    renderOverview();
};

// 7. UTILS & NAVIGATION
function setupSidebar() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            const section = btn.getAttribute('data-section');
            switchSection(section);
        };
    });
}

function switchSection(id) {
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById('section-' + id);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-section="${id}"]`)?.classList.add('active');
    
    document.getElementById('currentSectionTitle').innerText = id.charAt(0).toUpperCase() + id.slice(1);
}

function setVal(id, val) { const el = document.getElementById(id); if (el) el.innerText = val; }

// Global Listeners for filters
document.addEventListener('input', (e) => {
    if (e.target.id === 'userSearch') renderUsersTable();
});
document.addEventListener('change', (e) => {
    if (e.target.id === 'userRoleFilter' || e.target.id === 'userPlanFilter') renderUsersTable();
    if (e.target.id === 'jobStatusFilter') renderJobsTable();
});
