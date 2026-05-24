import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. AUTH PATTERN
document.body.style.visibility = 'hidden';

let _user = null;
let _userData = null;
let _projects = [];
let _selectedProjectId = null;
let _editingProjectId = null;
let _currentStep = 1;

// Global Form State (Snake_case to match Firestore schema)
const _formState = {
    title: '',
    discipline: '',
    description: '',
    work_mode: 'remote',
    start_date: 'asap',
    skills: [],
    experience_level: 'mid',
    duration: '1_2_weeks',
    budget_min: 0,
    budget_max: 0,
    company_name: ''
};

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists() || snap.data().role !== 'client') {
        window.location.href = '/login.html';
        return;
    }
    _user = user;
    _userData = snap.data();
    _formState.company_name = _userData.company_name || "Verified Client";
    document.body.style.visibility = 'visible';
    init();
});

async function init() {
    setupNav();
    await loadJobs();
    if (_projects.length > 0) selectJob(_projects[0].id);
    else showState('empty');
}

// 2. LOAD JOBS
async function loadJobs() {
    showSkeleton(true);
    try {
        const q = query(collection(db, "projects"), where("client_uid", "==", _user.uid), orderBy("created_at", "desc"));
        const snap = await getDocs(q);
        _projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
        console.warn("Index fallback:", e);
        const fallback = await getDocs(query(collection(db, "projects"), where("client_uid", "==", _user.uid)));
        _projects = fallback.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    renderJobList();
    showSkeleton(false);
}

// 3. UI RENDERING
function renderJobList() {
    const container = document.getElementById('jobList');
    container.innerHTML = _projects.map(p => `
        <div class="job-card ${p.id === _selectedProjectId ? 'active' : ''}" onclick="selectJob('${p.id}')">
            <div class="card-accent" style="background:var(--primary)"></div>
            <div class="card-content">
                <div style="display:flex; justify-content:space-between">
                    <span class="discipline-tag">${p.discipline || 'Design'}</span>
                </div>
                <h3 class="job-card-title">${p.title}</h3>
                <div class="job-card-meta">
                    <strong>₹${(p.budget_min || 0).toLocaleString()} - ₹${(p.budget_max || 0).toLocaleString()}</strong>
                </div>
                <div class="app-summary-bar">
                    <span>${(p.work_mode || 'Remote').toUpperCase()}</span> • <span>${(p.start_date || 'ASAP').toUpperCase()}</span>
                </div>
            </div>
        </div>
    `).join('');
}

window.selectJob = (id) => {
    _selectedProjectId = id;
    renderJobList();
    const p = _projects.find(x => x.id === id);
    const panel = document.getElementById('rightPanel');
    panel.innerHTML = `
        <div class="job-detail-view">
            <div class="jd-header" style="background:white; padding:40px; border-bottom:1px solid var(--border)">
                <div style="display:flex; justify-content:space-between; align-items:flex-start">
                    <h1>${p.title}</h1>
                    <div style="display:flex; gap:8px">
                        <button class="btn btn-outline btn-sm" onclick="editJob('${p.id}')">Edit Job</button>
                        <button class="btn btn-outline danger btn-sm" onclick="deleteJob('${p.id}')">Delete</button>
                    </div>
                </div>
                <div style="display:flex; gap:16px; margin-top:20px; flex-wrap:wrap">
                    <div style="background:var(--primary-light); color:var(--primary); padding:8px 16px; border-radius:8px; font-weight:700">
                        BUDGET: ₹${(p.budget_min||0).toLocaleString()} - ₹${(p.budget_max||0).toLocaleString()}
                    </div>
                    <div style="background:var(--success-bg); color:var(--success); padding:8px 16px; border-radius:8px; font-weight:700">
                        START: ${(p.start_date||'ASAP').toUpperCase()}
                    </div>
                    <div style="background:var(--surface-3); padding:8px 16px; border-radius:8px; font-weight:700">
                        EXP: ${(p.experience_level||'Mid').toUpperCase()}
                    </div>
                </div>
                <div style="margin-top:32px; font-size:16px; color:var(--ink-2); line-height:1.7; white-space:pre-wrap">${p.description}</div>
                <div style="margin-top:32px">
                    <strong style="color:var(--ink-3); font-size:12px; letter-spacing:0.05em">REQUIRED SERVICES:</strong>
                    <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap">
                        ${(p.skills || []).map(s => `<span style="background:var(--surface-3); padding:6px 14px; border-radius:20px; font-size:13px; font-weight:600">${s}</span>`).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
};

// 4. FORM LOGIC
window.startNewJob = () => { _editingProjectId = null; _currentStep = 1; resetForm(); renderPostJobForm(); };
window.editJob = (id) => {
    const p = _projects.find(x => x.id === id);
    _editingProjectId = id;
    Object.assign(_formState, p);
    _currentStep = 1;
    renderPostJobForm();
};

function resetForm() {
    _formState.title = ''; _formState.description = ''; _formState.skills = [];
    _formState.budget_min = 0; _formState.budget_max = 0;
}

function renderPostJobForm() {
    const panel = document.getElementById('rightPanel');
    panel.innerHTML = `
        <div class="post-job-container">
            <div class="form-side">
                <div class="form-header">
                    <h2>${_editingProjectId ? 'Update Job' : 'Post a New Job'}</h2>
                    <div class="step-progress">
                        <div class="step ${_currentStep >= 1 ? 'active' : ''}">1</div>
                        <div class="step-line"></div>
                        <div class="step ${_currentStep >= 2 ? 'active' : ''}">2</div>
                        <div class="step-line"></div>
                        <div class="step ${_currentStep >= 3 ? 'active' : ''}">3</div>
                    </div>
                </div>
                <div id="stepContent"></div>
            </div>
            <div class="preview-side">
                <div id="livePreviewCard"></div>
            </div>
        </div>
    `;
    renderStepContent();
}

function renderStepContent() {
    const container = document.getElementById('stepContent');
    if (_currentStep === 1) {
        container.innerHTML = `
            <div class="form-group">
                <label>Job Title *</label>
                <input type="text" id="jobTitle" value="${_formState.title}" maxlength="80">
                <div class="char-count" id="titleCount">${_formState.title.length} / 80</div>
            </div>
            <div class="form-group">
                <label>Discipline *</label>
                <select id="jobDiscipline">
                    <option value="">— Select —</option>
                    <option value="uiux" ${_formState.discipline === 'uiux' ? 'selected' : ''}>UI/UX Design</option>
                    <option value="brand" ${_formState.discipline === 'brand' ? 'selected' : ''}>Brand Identity</option>
                    <option value="web" ${_formState.discipline === 'web' ? 'selected' : ''}>Web Design</option>
                </select>
            </div>
            <div class="form-group">
                <label>Description *</label>
                <textarea id="jobDesc" rows="6" maxlength="1500">${_formState.description}</textarea>
                <div class="char-count" id="descCount">${_formState.description.length} / 1500</div>
            </div>
            <button class="btn btn-primary btn-block" onclick="goToStep(2)">Next: Details →</button>
        `;
    } else if (_currentStep === 2) {
        container.innerHTML = `
            <div class="form-group"><label>Required Skills (Comma separated)</label><input type="text" id="jobSkills" value="${_formState.skills.join(', ')}"></div>
            <div class="form-group">
                <label>Start Date</label>
                <div class="radio-grid">
                    ${['asap', '1week', '2weeks'].map(d => `<div class="radio-card ${_formState.start_date === d ? 'active' : ''}" onclick="setVal('start_date', '${d}')">${d.toUpperCase()}</div>`).join('')}
                </div>
            </div>
            <div class="form-group">
                <label>Work Mode</label>
                <div class="radio-grid">
                    ${['remote', 'hybrid', 'onsite'].map(m => `<div class="radio-card ${_formState.work_mode === m ? 'active' : ''}" onclick="setVal('work_mode', '${m}')">${m.toUpperCase()}</div>`).join('')}
                </div>
            </div>
            <div class="form-actions-row">
                <button class="btn btn-outline" onclick="goToStep(1)">Back</button>
                <button class="btn btn-primary" onclick="goToStep(3)">Next: Budget →</button>
            </div>
        `;
    } else if (_currentStep === 3) {
        container.innerHTML = `
            <div class="budget-row">
                <div class="form-group"><label>Min ₹</label><input type="number" id="budgetMin" value="${_formState.budget_min}"></div>
                <div class="form-group"><label>Max ₹</label><input type="number" id="budgetMax" value="${_formState.budget_max}"></div>
            </div>
            <div class="form-actions-row">
                <button class="btn btn-outline" onclick="goToStep(2)">Back</button>
                <button class="btn btn-primary" id="postBtn" onclick="submitJob()">${_editingProjectId ? 'Save Changes' : 'Post Job'}</button>
            </div>
        `;
    }
    attachEvents();
    updatePreview();
}

window.setVal = (k, v) => { _formState[k] = v; renderStepContent(); };
window.goToStep = (s) => { _currentStep = s; renderStepContent(); };

function attachEvents() {
    const title = document.getElementById('jobTitle'); if(title) title.oninput=(e)=> { _formState.title=e.target.value; document.getElementById('titleCount').innerText=`${e.target.value.length} / 80`; updatePreview(); };
    const desc = document.getElementById('jobDesc'); if(desc) desc.oninput=(e)=> { _formState.description=e.target.value; document.getElementById('descCount').innerText=`${e.target.value.length} / 1500`; updatePreview(); };
    const disc = document.getElementById('jobDiscipline'); if(disc) disc.onchange=(e)=> { _formState.discipline=e.target.value; updatePreview(); };
    const skills = document.getElementById('jobSkills'); if(skills) skills.oninput=(e)=> { _formState.skills=e.target.value.split(',').map(s=>s.trim()).filter(s=>s); updatePreview(); };
    const bMin = document.getElementById('budgetMin'); if(bMin) bMin.oninput=(e)=> { _formState.budget_min=parseInt(e.target.value)||0; updatePreview(); };
    const bMax = document.getElementById('budgetMax'); if(bMax) bMax.oninput=(e)=> { _formState.budget_max=parseInt(e.target.value)||0; updatePreview(); };
}

window.submitJob = async () => {
    const btn = document.getElementById('postBtn');
    btn.disabled = true; btn.textContent = "Processing...";
    try {
        const payload = { ..._formState, client_uid: _user.uid, status: "open", updated_at: new Date().toISOString() };
        if (_editingProjectId) {
            await updateDoc(doc(db, "projects", _editingProjectId), payload);
            showToast("Job updated!", "success");
        } else {
            payload.created_at = new Date().toISOString();
            const ref = await addDoc(collection(db, "projects"), payload);
            _editingProjectId = ref.id;
            showToast("Job posted!", "success");
        }
        await loadJobs();
        selectJob(_editingProjectId);
    } catch (e) { showToast(e.message, "error"); btn.disabled = false; }
};

// PREVIEW & HELPERS
function updatePreview() {
    const card = document.getElementById('livePreviewCard'); if(!card) return;
    card.innerHTML = `
        <div class="p-card" style="border:1px solid var(--border); border-radius:12px; padding:24px; background:white">
            <h3 style="margin-bottom:8px">${_formState.title || 'Untitled'}</h3>
            <div style="font-size:16px; font-weight:700; color:var(--primary); margin-bottom:12px">₹${_formState.budget_min.toLocaleString()} - ₹${_formState.budget_max.toLocaleString()}</div>
            <p style="font-size:13px; color:var(--ink-3); line-height:1.5">${_formState.description.substring(0, 100)}...</p>
            <div style="display:flex; gap:8px; margin-top:16px; font-size:11px; font-weight:700">
                <span style="background:var(--surface-3); padding:4px 10px; border-radius:6px">${_formState.work_mode.toUpperCase()}</span>
                <span style="background:var(--success-bg); color:var(--success); padding:4px 10px; border-radius:6px">${_formState.start_date.toUpperCase()}</span>
            </div>
        </div>
    `;
}

window.deleteJob = async (id) => { if(!confirm("Delete?")) return; await deleteDoc(doc(db, "projects", id)); await loadJobs(); showState('empty'); };
function setupNav() {
    const initials = _userData.full_name.split(' ').map(n=>n[0]).join('').toUpperCase();
    document.querySelector('.nav-right').innerHTML = `<div class="avatar">${initials}</div>`;
    document.querySelector('.nav-center').innerHTML = `<a href="/client-dashboard.html">Dashboard</a><a href="/designers.html">Find Designers</a><a href="/client-jobs.html" class="active">My Jobs</a>`;
}
function showState(state) { if(state === 'empty') document.getElementById('rightPanel').innerHTML = `<div class="panel-placeholder"><h3>Select a job</h3><button class="btn btn-primary" onclick="startNewJob()">+ Post Job</button></div>`; }
function showSkeleton(s) { if(s) document.getElementById('jobList').innerHTML = "Loading..."; }
function showToast(m, t) { const c = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast toast-${t}`; toast.innerText = m; c.appendChild(toast); setTimeout(() => toast.remove(), 4000); }
