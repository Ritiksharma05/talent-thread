import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
    collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, 
    query, where, orderBy, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// CRITICAL AUTH PATTERN
// ==========================================
document.body.style.visibility = 'hidden';

let currentUser = null;
let userData = null;
let projects = [];
let editingId = null;
let projectTools = [];
let projectImages = []; // Base64 strings for now

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    
    try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userSnap.exists()) {
            window.location.href = '/login.html';
            return;
        }
        
        userData = userSnap.data();
        if (userData.role !== 'designer') {
            window.location.href = userData.role === 'client' ? '/client-dashboard' : '/';
            return;
        }
        
        currentUser = user;
        
        document.body.style.visibility = 'visible';
        init();
    } catch (err) {
        console.error("Auth init error:", err);
        window.location.href = '/login.html';
    }
});

// ==========================================
// INITIALIZATION
// ==========================================

async function init() {
    await loadPortfolio();
    setupEventListeners();
}

async function loadPortfolio() {
    const grid = document.getElementById('portfolio-grid');
    grid.innerHTML = '<div style="padding: 40px; text-align: center;">Loading your work...</div>';

    try {
        const snap = await getDocs(query(
            collection(db, `portfolio_items/${currentUser.uid}/items`),
            orderBy('order', 'asc')
        ));
        
        projects = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderGrid();
        updateStats();
    } catch (err) {
        console.error("Load portfolio error:", err);
        grid.innerHTML = '<div style="padding: 40px; text-align: center; color: var(--danger);">Error loading portfolio.</div>';
    }
}

function renderGrid(filter = 'all') {
    const grid = document.getElementById('portfolio-grid');
    const featuredGrid = document.getElementById('featured-grid');
    const featuredSection = document.getElementById('featured-section');
    
    const filtered = filter === 'all' ? projects : projects.filter(p => p.category === filter);
    
    if (projects.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1/-1">
                <h2>Your portfolio is empty</h2>
                <p>Add your best work to attract clients and improve your profile score.</p>
                <button class="btn btn-primary" onclick="openForm()" style="margin-top: 20px">+ Add Your First Project</button>
            </div>
        `;
        featuredSection.classList.add('hidden');
        return;
    }

    // Featured Work
    const featured = projects.filter(p => p.featured).slice(0, 3);
    if (featured.length > 0) {
        featuredSection.classList.remove('hidden');
        featuredGrid.innerHTML = featured.map(p => renderCard(p, true)).join('');
    } else {
        featuredSection.classList.add('hidden');
    }

    grid.innerHTML = filtered.map(p => renderCard(p)).join('');
    
    // Update Filter Chips
    renderFilterChips();

    // Attach actions
    filtered.forEach(p => attachCardActions(p));
    featured.forEach(p => attachCardActions(p, true));
}

function renderCard(p, isFeaturedSection = false) {
    const mainImg = (p.images && p.images.length > 0) ? p.images[0] : '/assets/images/project_thumbnail.png';
    
    return `
        <div class="project-card" id="card-${p.id}${isFeaturedSection ? '-feat' : ''}" data-id="${p.id}">
            <div class="card-img-wrap">
                <img src="${mainImg}" class="card-img" onerror="this.src='/assets/images/project_thumbnail.png'">
                <div class="card-overlay">
                    <button class="btn btn-outline edit-btn" data-id="${p.id}" style="background:white">✏ Edit</button>
                    <button class="btn btn-outline preview-btn" data-id="${p.id}" style="background:white">👁 Preview</button>
                    <button class="btn btn-outline delete-btn" data-id="${p.id}" style="background:white; color:var(--danger)">🗑 Delete</button>
                </div>
                ${p.featured ? '<div class="card-badge badge-featured">⭐ Featured</div>' : ''}
                <div class="card-badge badge-cat">${p.category}</div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${p.title}</h3>
                <p class="card-desc">${p.description}</p>
                <div class="card-tools">
                    ${(p.tools || []).slice(0, 3).map(t => `<span class="tool-chip">${t}</span>`).join('')}
                    ${(p.tools || []).length > 3 ? `<span class="tool-chip">+${p.tools.length - 3} more</span>` : ''}
                </div>
                <div class="card-footer">
                    <span class="drag-handle">⠿</span>
                    ${p.case_study_link ? `<a href="${p.case_study_link}" target="_blank" style="font-size:12px; color:var(--primary); text-decoration:none; font-weight:600">Case Study →</a>` : ''}
                </div>
            </div>
        </div>
    `;
}

function attachCardActions(p, isFeaturedSection = false) {
    const suffix = isFeaturedSection ? '-feat' : '';
    const card = document.getElementById(`card-${p.id}${suffix}`);
    if (!card) return;

    card.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); openForm(p); };
    card.querySelector('.preview-btn').onclick = (e) => { e.stopPropagation(); openPreview(p); };
    card.querySelector('.delete-btn').onclick = (e) => { e.stopPropagation(); deleteProject(p.id); };
}

function updateStats() {
    document.getElementById('project-count').innerText = `${projects.length} projects published`;
    document.getElementById('stat-featured').innerText = `${projects.filter(p => p.featured).length}/3`;
    
    const cats = new Set(projects.map(p => p.category));
    document.getElementById('stat-categories').innerText = cats.size;
    
    const tools = {};
    projects.forEach(p => (p.tools || []).forEach(t => tools[t] = (tools[t] || 0) + 1));
    const topTool = Object.entries(tools).sort((a,b) => b[1] - a[1])[0];
    document.getElementById('stat-tool').innerText = topTool ? topTool[0] : 'None';
}

function renderFilterChips() {
    const wrap = document.getElementById('category-filters');
    const cats = ['all', ...new Set(projects.map(p => p.category))];
    
    // Only update if changed
    if (wrap.children.length === cats.length) return;

    wrap.innerHTML = cats.map(c => `
        <button class="tab-btn ${c === 'all' ? 'active' : ''}" data-cat="${c}">${c.charAt(0).toUpperCase() + c.slice(1)}</button>
    `).join('');

    wrap.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            wrap.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderGrid(btn.dataset.cat);
        };
    });
}

// ==========================================
// FORM HANDLING
// ==========================================

window.openForm = (p = null) => {
    editingId = p ? p.id : null;
    document.getElementById('form-title').innerText = p ? 'Edit Project' : 'Add Project';
    
    // Reset Form
    const form = document.getElementById('project-form');
    form.reset();
    projectTools = p ? [...p.tools] : [];
    projectImages = p ? [...p.images] : [];
    
    if (p) {
        document.getElementById('p-title').value = p.title;
        document.getElementById('p-category').value = p.category;
        document.getElementById('p-desc').value = p.description;
        document.getElementById('p-link').value = p.case_study_link || '';
        document.getElementById('p-featured').checked = p.featured;
    }

    renderTools();
    renderPreviews();
    
    document.getElementById('form-panel').classList.add('active');
    document.getElementById('form-backdrop').classList.add('active');
};

window.closeForm = () => {
    document.getElementById('form-panel').classList.remove('active');
    document.getElementById('form-backdrop').classList.remove('active');
};

function renderTools() {
    const wrap = document.getElementById('p-tags');
    wrap.innerHTML = projectTools.map((t, i) => `
        <span class="tag">${t} <span class="tag-remove" onclick="removeTool(${i})">×</span></span>
    `).join('');
}

window.removeTool = (i) => {
    projectTools.splice(i, 1);
    renderTools();
};

function renderPreviews() {
    const wrap = document.getElementById('p-previews');
    wrap.innerHTML = projectImages.map((img, i) => `
        <div style="position:relative">
            <img src="${img}" class="preview-thumb">
            <span style="position:absolute; top:-5px; right:-5px; background:var(--danger); color:white; border-radius:50%; width:18px; height:18px; font-size:12px; display:flex; align-items:center; justify-content:center; cursor:pointer" onclick="removeImage(${i})">×</span>
        </div>
    `).join('');
}

window.removeImage = (i) => {
    projectImages.splice(i, 1);
    renderPreviews();
};

// ==========================================
// CRUD OPERATIONS
// ==========================================

async function saveProject() {
    const title = document.getElementById('p-title').value;
    const category = document.getElementById('p-category').value;
    const desc = document.getElementById('p-desc').value;
    const link = document.getElementById('p-link').value;
    const featured = document.getElementById('p-featured').checked;

    if (!title || !category || desc.length < 50) {
        showToast("Please fill all required fields correctly", "error");
        return;
    }

    if (featured && projects.filter(p => p.featured && p.id !== editingId).length >= 3) {
        showToast("Max 3 featured projects allowed", "error");
        return;
    }

    const btn = document.getElementById('save-project-btn');
    btn.disabled = true;
    btn.innerText = 'Saving...';

    const pData = {
        title, category, description: desc,
        tools: projectTools,
        images: projectImages,
        case_study_link: link,
        featured,
        updated_at: new Date().toISOString()
    };

    try {
        if (editingId) {
            await updateDoc(doc(db, `portfolio_items/${currentUser.uid}/items`, editingId), pData);
            showToast("Project updated!");
        } else {
            pData.created_at = pData.updated_at;
            pData.order = projects.length;
            await addDoc(collection(db, `portfolio_items/${currentUser.uid}/items`), pData);
            showToast("Project added to portfolio!");
        }
        
        // Update profile completeness
        await updateProfileCompleteness();
        
        closeForm();
        loadPortfolio();
    } catch (err) {
        showToast("Error saving project", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Save Project';
    }
}

async function deleteProject(id) {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
        await deleteDoc(doc(db, `portfolio_items/${currentUser.uid}/items`, id));
        showToast("Project deleted");
        await updateProfileCompleteness();
        loadPortfolio();
    } catch (e) { showToast("Error deleting", "error"); }
}

async function updateProfileCompleteness() {
    const snap = await getDocs(collection(db, `portfolio_items/${currentUser.uid}/items`));
    const count = snap.size;
    const score = Math.min(100, (count / 3) * 100); // 3 items = 100% for portfolio section
    
    // Ideally update profiles/{uid} here
    try {
        await updateDoc(doc(db, 'profiles', currentUser.uid), { portfolio_count: count });
    } catch(e) {}
}

// ==========================================
// PREVIEW MODAL
// ==========================================

window.openPreview = (p) => {
    const modal = document.getElementById('preview-modal');
    modal.style.display = 'block';
    
    document.getElementById('pm-title').innerText = p.title;
    document.getElementById('pm-cat').innerText = p.category;
    document.getElementById('pm-desc').innerText = p.description;
    
    const toolsWrap = document.getElementById('pm-tools');
    toolsWrap.innerHTML = (p.tools || []).map(t => `<span class="tool-chip">${t}</span>`).join('');
    
    const mainImg = document.getElementById('pm-image');
    mainImg.src = (p.images && p.images.length > 0) ? p.images[0] : '/assets/images/project_thumbnail.png';
    
    const linkBtn = document.getElementById('pm-link');
    if (p.case_study_link) {
        linkBtn.href = p.case_study_link;
        linkBtn.style.display = 'flex';
    } else {
        linkBtn.style.display = 'none';
    }

    const thumbWrap = document.getElementById('pm-thumbs');
    thumbWrap.innerHTML = (p.images || []).map((img, i) => `
        <img src="${img}" class="preview-thumb" style="cursor:pointer" onclick="document.getElementById('pm-image').src='${img}'">
    `).join('');
};

window.closePreview = () => document.getElementById('preview-modal').style.display = 'none';

// ==========================================
// HELPERS
// ==========================================

function setupEventListeners() {
    document.getElementById('add-project-btn').onclick = () => openForm();
    document.getElementById('save-project-btn').onclick = saveProject;
    
    const toolInput = document.getElementById('p-tool-input');
    toolInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = toolInput.value.trim();
            if (val && !projectTools.includes(val)) {
                projectTools.push(val);
                renderTools();
            }
            toolInput.value = '';
        }
    };

    const fileInput = document.getElementById('p-file-input');
    document.getElementById('p-upload').onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (file.size > 8 * 1024 * 1024) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                projectImages.push(ev.target.result);
                renderPreviews();
            };
            reader.readAsDataURL(file);
        });
    };

    // Title/Desc counters
    document.getElementById('p-title').oninput = (e) => {
        document.getElementById('p-title-count').innerText = 80 - e.target.value.length;
    };
    document.getElementById('p-desc').oninput = (e) => {
        document.getElementById('p-desc-count').innerText = 500 - e.target.value.length;
    };

    // Reorder
    document.getElementById('reorder-btn').onclick = () => toggleReorderMode();
}

let isReordering = false;
function toggleReorderMode() {
    isReordering = !isReordering;
    const grid = document.getElementById('portfolio-grid');
    const btn = document.getElementById('reorder-btn');
    
    if (isReordering) {
        grid.classList.add('reorder-mode');
        btn.innerText = 'Done Reordering';
        btn.classList.add('btn-primary');
        setupDragAndDrop();
    } else {
        grid.classList.remove('reorder-mode');
        btn.innerText = 'Reorder';
        btn.classList.remove('btn-primary');
        saveNewOrder();
    }
}

function setupDragAndDrop() {
    const cards = document.querySelectorAll('.portfolio-grid .project-card');
    cards.forEach(card => {
        card.draggable = true;
        card.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', card.dataset.id);
            card.style.opacity = '0.5';
        };
        card.ondragend = () => card.style.opacity = '1';
        
        card.ondragover = (e) => e.preventDefault();
        card.ondrop = (e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData('text/plain');
            const targetId = card.dataset.id;
            if (draggedId !== targetId) {
                const draggedIdx = projects.findIndex(p => p.id === draggedId);
                const targetIdx = projects.findIndex(p => p.id === targetId);
                const [moved] = projects.splice(draggedIdx, 1);
                projects.splice(targetIdx, 0, moved);
                renderGrid();
                setupDragAndDrop(); // Re-attach for new elements
            }
        };
    });
}

async function saveNewOrder() {
    const batch = writeBatch(db);
    projects.forEach((p, i) => {
        const ref = doc(db, `portfolio_items/${currentUser.uid}/items`, p.id);
        batch.update(ref, { order: i });
    });
    try {
        await batch.commit();
        showToast("Portfolio order saved");
    } catch(e) { showToast("Failed to save order", "error"); }
}

function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.className = 'toast';
    if (type === 'error') t.style.background = 'var(--danger)';
    t.innerText = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
}
