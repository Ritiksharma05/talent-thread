import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. NON-NEGOTIABLE AUTH PATTERN
document.body.style.visibility = 'hidden';

let _user = null;
let _userData = null;
let _contracts = [];
let _selectedContractId = null;
let _unsubscribeMessages = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) { window.location.href = '/login.html'; return; }
    
    _user = user;
    _userData = snap.data();
    document.body.style.visibility = 'visible';
    init(user, _userData);
});

async function init(user, userData) {
    setupNav(user, userData);
    
    try {
        _contracts = await loadContracts(user.uid, userData.role);
        renderContractList(_contracts);
        
        if (_contracts.length > 0) {
            selectContract(_contracts[0].id);
        } else {
            showEmptyDetail();
        }
    } catch (err) {
        console.error("Init error:", err);
        showToast("Error loading contracts", "error");
    }
}

// 2. DATA LOADING
async function loadContracts(uid, role) {
    const field = role === "designer" ? "designer_uid" : "client_uid";
    const snap = await getDocs(query(
        collection(db, "contracts"),
        where(field, "==", uid),
        orderBy("updated_at", "desc")
    ));
    
    const contracts = [];
    for (const d of snap.docs) {
        const contract = { id: d.id, ...d.data() };
        const otherUid = role === "designer" ? contract.client_uid : contract.designer_uid;
        
        try {
            const [otherSnap, msSnap] = await Promise.all([
                getDoc(doc(db, "users", otherUid)),
                getDocs(query(collection(db, "milestones"), where("contract_id", "==", d.id), orderBy("due_date", "asc")))
            ]);
            
            contract.otherPartyName = otherSnap.exists() ? otherSnap.data().full_name : "Unknown";
            contract.milestones = msSnap.docs.map(m => ({ id: m.id, ...m.data() }));
            
            if (role === "designer") {
                const cpSnap = await getDoc(doc(db, "client_profiles", otherUid));
                contract.displayName = cpSnap.exists() ? cpSnap.data().company_name : contract.otherPartyName;
            } else {
                contract.displayName = contract.otherPartyName;
            }
        } catch(e) {
            contract.displayName = "Unknown User";
        }
        contracts.push(contract);
    }
    return contracts;
}

// 3. UI RENDERING
function renderContractList(contracts) {
    const list = document.getElementById('contractList');
    if (contracts.length === 0) {
        list.innerHTML = `<div class="empty-list">No contracts found.</div>`;
        return;
    }

    list.innerHTML = contracts.map(c => {
        const completed = c.milestones.filter(m => m.status === 'approved').length;
        const total = c.milestones.length;
        const progress = total > 0 ? (completed / total) * 100 : 0;
        
        return `
            <div class="contract-item ${c.id === _selectedContractId ? 'active' : ''}" onclick="selectContract('${c.id}')">
                <div class="ci-avatar">${c.displayName.charAt(0)}</div>
                <div class="ci-content">
                    <div class="ci-top">
                        <span class="ci-party">${c.displayName}</span>
                        <span class="ci-status status-${c.status}">${c.status}</span>
                    </div>
                    <div class="ci-title">${c.title}</div>
                    <div class="ci-progress-bar">
                        <div class="fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="ci-footer">
                        <span>₹${c.total_value.toLocaleString()}</span>
                        <span>${completed}/${total} Milestones</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.selectContract = (id) => {
    _selectedContractId = id;
    renderContractList(_contracts);
    const contract = _contracts.find(c => c.id === id);
    renderContractDetail(contract);
    setupMessages(id);
};

function renderContractDetail(c) {
    const detail = document.getElementById('contractDetail');
    const role = _userData.role;

    detail.innerHTML = `
        <div class="cd-header">
            <div class="cd-header-main">
                <h2>${c.title}</h2>
                <div class="cd-badges">
                    <span class="status-badge status-${c.status}">${c.status.toUpperCase()}</span>
                    <span class="value-badge">₹${c.total_value.toLocaleString()}</span>
                </div>
            </div>
            <div class="cd-tabs">
                <button class="cd-tab active" onclick="switchTab('overview')">Overview</button>
                <button class="cd-tab" onclick="switchTab('messages')">Messages</button>
                <button class="cd-tab" onclick="switchTab('deliverables')">Deliverables</button>
            </div>
        </div>
        
        <div id="tab-overview" class="tab-content active">
            <div class="milestones-section">
                <h3>Project Milestones</h3>
                <div class="milestone-list">
                    ${c.milestones.map((m, i) => `
                        <div class="milestone-card status-${m.status}">
                            <div class="ms-num">M${i+1}</div>
                            <div class="ms-body">
                                <div class="ms-top">
                                    <span class="ms-title">${m.title}</span>
                                    <span class="ms-amount">₹${m.amount.toLocaleString()}</span>
                                </div>
                                <p class="ms-desc">${m.description}</p>
                                <div class="ms-footer">
                                    <span class="ms-date">Due: ${new Date(m.due_date).toLocaleDateString()}</span>
                                    <span class="ms-status-label">${m.status.toUpperCase()}</span>
                                </div>
                            </div>
                            <div class="ms-actions">
                                ${renderMilestoneActions(m, role)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>

        <div id="tab-messages" class="tab-content">
            <div class="chat-container">
                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-input-area">
                    <textarea id="messageInput" placeholder="Type a message..."></textarea>
                    <button onclick="sendMessage('${c.id}')" class="send-btn">Send</button>
                </div>
            </div>
        </div>

        <div id="tab-deliverables" class="tab-content">
            <div class="deliverables-placeholder">Deliverables history will appear here.</div>
        </div>
    `;
}

function renderMilestoneActions(m, role) {
    if (role === 'designer') {
        if (m.status === 'funded') return `<button class="btn btn-primary btn-sm" onclick="submitDeliverable('${m.id}')">Submit Work</button>`;
        if (m.status === 'pending') return `<span class="wait-label">Awaiting Funding</span>`;
        return '';
    } else {
        if (m.status === 'pending') return `<button class="btn btn-primary btn-sm" onclick="fundMilestone('${m.id}')">Fund ₹${m.amount.toLocaleString()}</button>`;
        if (m.status === 'submitted') return `<button class="btn btn-success btn-sm" onclick="approveMilestone('${m.id}')">Approve & Release</button>`;
        return '';
    }
}

// 4. CHAT LOGIC
function setupMessages(contractId) {
    if (_unsubscribeMessages) _unsubscribeMessages();
    
    const q = query(collection(db, "contracts", contractId, "messages"), orderBy("created_at", "asc"));
    _unsubscribeMessages = onSnapshot(q, (snap) => {
        const chatBox = document.getElementById('chatMessages');
        if (!chatBox) return;
        
        chatBox.innerHTML = snap.docs.map(d => {
            const m = d.data();
            const isMe = m.sender_uid === _user.uid;
            return `
                <div class="msg-row ${isMe ? 'msg-me' : 'msg-them'}">
                    <div class="msg-bubble">${m.body}</div>
                    <div class="msg-time">${m.created_at?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || ''}</div>
                </div>
            `;
        }).join('');
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

window.sendMessage = async (contractId) => {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;
    
    await addDoc(collection(db, "contracts", contractId, "messages"), {
        sender_uid: _user.uid,
        sender_name: _userData.full_name,
        body: text,
        created_at: serverTimestamp(),
        is_read: false
    });
    input.value = '';
};

// 5. MILESTONE ACTIONS
window.fundMilestone = async (id) => {
    try {
        await updateDoc(doc(db, "milestones", id), { status: "funded" });
        showToast("Milestone funded! Funds are in escrow.", "success");
        init(_user, _userData); // Refresh
    } catch (e) { showToast("Action failed", "error"); }
};

window.approveMilestone = async (id) => {
    try {
        await updateDoc(doc(db, "milestones", id), { status: "approved" });
        showToast("Work approved! Payment released to designer.", "success");
        init(_user, _userData); // Refresh
    } catch (e) { showToast("Action failed", "error"); }
};

// 6. UI HELPERS
window.switchTab = (tab) => {
    document.querySelectorAll('.cd-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
};

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

    centerNav.innerHTML = userData.role === 'client' ? `
        <a href="/client-dashboard.html">Dashboard</a>
        <a href="/designers.html">Find Designers</a>
        <a href="/client-jobs.html">My Jobs</a>
        <a href="/contracts.html" class="active">Contracts</a>
    ` : `
        <a href="/designer-dashboard.html">Dashboard</a>
        <a href="/marketplace.html">Find Work</a>
        <a href="/applications.html">My Applications</a>
        <a href="/contracts.html" class="active">Contracts</a>
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
