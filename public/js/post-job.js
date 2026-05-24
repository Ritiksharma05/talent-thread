import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, doc, getDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. NON-NEGOTIABLE AUTH PATTERN
document.body.style.visibility = 'hidden';

let _user = null;
let _userData = null;
let _currentStep = 1;

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
    renderStep();
});

// 2. STEP RENDERING
function renderStep() {
    const header = document.getElementById('formHeader');
    const content = document.getElementById('stepContent');

    header.innerHTML = `
        <h1>Step ${_currentStep} of 3</h1>
        <p>${_currentStep === 1 ? 'Project Fundamentals' : _currentStep === 2 ? 'Project Requirements' : 'Budget & Launch'}</p>
        <div class="step-nav">
            <div class="step ${_currentStep >= 1 ? 'active' : ''}">1</div>
            <div class="step-line"></div>
            <div class="step ${_currentStep >= 2 ? 'active' : ''}">2</div>
            <div class="step-line"></div>
            <div class="step ${_currentStep >= 3 ? 'active' : ''}">3</div>
        </div>
    `;

    if (_currentStep === 1) {
        content.innerHTML = `
            <div class="form-group">
                <label>Job Title *</label>
                <input type="text" id="jobTitle" value="${_formState.title}" maxlength="80" placeholder="e.g. UX Designer for SaaS Dashboard">
                <div class="char-count" id="titleCount">${_formState.title.length} / 80</div>
            </div>
            <div class="form-group">
                <label>Discipline *</label>
                <select id="jobDiscipline">
                    <option value="">— Select a discipline —</option>
                    <option value="uiux" ${_formState.discipline === 'uiux' ? 'selected' : ''}>UI/UX Design</option>
                    <option value="brand" ${_formState.discipline === 'brand' ? 'selected' : ''}>Brand Identity</option>
                    <option value="web" ${_formState.discipline === 'web' ? 'selected' : ''}>Web Design</option>
                </select>
            </div>
            <div class="form-group">
                <label>Project Description *</label>
                <textarea id="jobDesc" rows="8" maxlength="1500" placeholder="Describe goals, audience, and deliverables...">${_formState.description}</textarea>
                <div class="char-count" id="descCount">${_formState.description.length} / 1500</div>
            </div>
            <button class="btn btn-primary btn-block" onclick="nextStep(2)">Next: Requirements →</button>
        `;
    } else if (_currentStep === 2) {
        content.innerHTML = `
            <div class="form-group">
                <label>Required Skills (Comma separated)</label>
                <input type="text" id="jobSkills" placeholder="e.g. Figma, Prototyping, Logo Design" value="${_formState.skills.join(', ')}">
            </div>
            <div class="form-group">
                <label>Start Date</label>
                <div class="radio-grid">
                    ${['asap', '1week', '2weeks'].map(d => `<div class="radio-card ${_formState.start_date === d ? 'active' : ''}" onclick="setVal('start_date', '${d}')"><strong>${d.toUpperCase()}</strong></div>`).join('')}
                </div>
            </div>
            <div class="form-group">
                <label>Experience Level</label>
                <div class="radio-grid">
                    ${['junior', 'mid', 'senior'].map(l => `<div class="radio-card ${_formState.experience_level === l ? 'active' : ''}" onclick="setVal('experience_level', '${l}')"><strong>${l.toUpperCase()}</strong></div>`).join('')}
                </div>
            </div>
            <div style="display:flex; gap:16px">
                <button class="btn btn-outline" onclick="nextStep(1)">← Back</button>
                <button class="btn btn-primary" onclick="nextStep(3)">Next: Budget →</button>
            </div>
        `;
    } else if (_currentStep === 3) {
        content.innerHTML = `
            <div class="form-group">
                <label>Budget Type</label>
                <select id="budgetType">
                    <option value="fixed" ${_formState.budget_type === 'fixed' ? 'selected' : ''}>Fixed Price</option>
                    <option value="hourly" ${_formState.budget_type === 'hourly' ? 'selected' : ''}>Hourly Rate</option>
                </select>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:32px">
                <div class="form-group"><label>Min ₹</label><input type="number" id="budgetMin" value="${_formState.budget_min}"></div>
                <div class="form-group"><label>Max ₹</label><input type="number" id="budgetMax" value="${_formState.budget_max}"></div>
            </div>
            <div style="display:flex; gap:16px">
                <button class="btn btn-outline" onclick="nextStep(2)">← Back</button>
                <button class="btn btn-primary btn-block" id="submitBtn" onclick="submitJob()">Post Job Now →</button>
            </div>
        `;
    }

    attachListeners();
    updatePreview();
}

// 3. LISTENERS & STATE
function attachListeners() {
    const title = document.getElementById('jobTitle');
    if (title) title.oninput = (e) => {
        _formState.title = e.target.value;
        document.getElementById('titleCount').innerText = `${e.target.value.length} / 80`;
        updatePreview();
    };

    const desc = document.getElementById('jobDesc');
    if (desc) desc.oninput = (e) => {
        _formState.description = e.target.value;
        document.getElementById('descCount').innerText = `${e.target.value.length} / 1500`;
        updatePreview();
    };

    const disc = document.getElementById('jobDiscipline');
    if (disc) disc.onchange = (e) => { _formState.discipline = e.target.value; updatePreview(); };

    const skills = document.getElementById('jobSkills');
    if (skills) skills.oninput = (e) => { 
        _formState.skills = e.target.value.split(',').map(s => s.trim()).filter(s => s); 
        updatePreview(); 
    };

    const bMin = document.getElementById('budgetMin');
    if (bMin) bMin.oninput = (e) => { _formState.budget_min = parseInt(e.target.value) || 0; updatePreview(); };

    const bMax = document.getElementById('budgetMax');
    if (bMax) bMax.oninput = (e) => { _formState.budget_max = parseInt(e.target.value) || 0; updatePreview(); };
}

window.setVal = (k, v) => { _formState[k] = v; renderStep(); };
window.nextStep = (s) => {
    if (s > _currentStep && !validate(_currentStep)) return;
    _currentStep = s;
    renderStep();
};

function validate(s) {
    if (s === 1) {
        if (_formState.title.length < 10) { showToast("Title too short (min 10 chars)", "error"); return false; }
        if (!_formState.discipline) { showToast("Select a discipline", "error"); return false; }
        if (_formState.description.length < 80) { showToast("Description too short (min 80 chars)", "error"); return false; }
    }
    return true;
}

// 4. SUBMIT TO FIRESTORE
window.submitJob = async () => {
    const btn = document.getElementById('submitBtn');
    btn.disabled = true; btn.textContent = "Posting...";

    try {
        const payload = {
            ..._formState,
            client_uid: _user.uid,
            status: "open",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            applications_count: 0
        };

        await addDoc(collection(db, "projects"), payload);
        showToast("Job is live! Redirecting...", "success");
        
        setTimeout(() => {
            window.location.href = '/client-jobs.html';
        }, 1500);

    } catch (e) {
        showToast("Failed to post: " + e.message, "error");
        btn.disabled = false; btn.textContent = "Post Job Now →";
    }
};

// 5. HELPERS
function updatePreview() {
    const card = document.getElementById('livePreviewCard');
    card.innerHTML = `
        <div class="p-card">
            <div style="font-size:10px; font-weight:800; color:var(--primary); margin-bottom:8px">${(_formState.discipline || 'DISCIPLINE').toUpperCase()}</div>
            <h3 class="p-title">${_formState.title || 'Your Job Title...'}</h3>
            <div class="p-price">₹${(_formState.budget_min || 0).toLocaleString()} - ₹${(_formState.budget_max || 0).toLocaleString()}</div>
            <p class="p-desc">${_formState.description.substring(0, 120)}...</p>
            <div class="p-chips">
                <span>⚡ ${_formState.experience_level.toUpperCase()}</span>
                <span>📅 ${_formState.start_date.toUpperCase()}</span>
                <span>📍 ${_formState.work_mode.toUpperCase()}</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:16px">
                ${_formState.skills.slice(0,3).map(s => `<span style="font-size:9px; background:white; border:1px solid var(--border); padding:2px 6px; border-radius:4px">${s}</span>`).join('')}
            </div>
        </div>
    `;
}

function showToast(m, t) {
    const c = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${t}`;
    toast.innerText = m;
    c.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
