import { auth, db } from './firebase-init.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. NON-NEGOTIABLE AUTH PATTERN
document.body.style.visibility = 'hidden';

let _user = null;
let _userData = null;
let _conversations = [];
let _activeChatId = null;
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
        _conversations = await loadConversations(user.uid, userData.role);
        renderInbox(_conversations);
        
        if (_conversations.length > 0) {
            selectConversation(_conversations[0].id);
        }
    } catch (err) {
        console.error("Inbox error:", err);
        showToast("Error loading inbox", "error");
    }
}

// 2. DATA LOADING
async function loadConversations(uid, role) {
    const field = role === "client" ? "client_uid" : "designer_uid";
    const snap = await getDocs(query(
        collection(db, "contracts"),
        where(field, "==", uid),
        orderBy("updated_at", "desc")
    ));
    
    const conversations = [];
    for (const d of snap.docs) {
        const c = { id: d.id, ...d.data() };
        const otherUid = role === "client" ? c.designer_uid : c.client_uid;
        const otherSnap = await getDoc(doc(db, "users", otherUid));
        c.otherParty = otherSnap.exists() ? otherSnap.data() : { full_name: "User" };
        
        // Get last message
        const lastMSnap = await getDocs(query(
            collection(db, "contracts", d.id, "messages"),
            orderBy("created_at", "desc"),
            limit(1)
        ));
        c.lastMessage = !lastMSnap.empty ? lastMSnap.docs[0].data() : null;
        conversations.push(c);
    }
    return conversations;
}

// 3. UI RENDERING
function renderInbox(list) {
    const container = document.getElementById('inboxList');
    if (list.length === 0) {
        container.innerHTML = '<div class="empty-inbox">No messages yet.</div>';
        return;
    }

    container.innerHTML = list.map(c => `
        <div class="conv-row ${c.id === _activeChatId ? 'active' : ''}" onclick="selectConversation('${c.id}')">
            <div class="conv-avatar">${c.otherParty.full_name.charAt(0)}</div>
            <div class="conv-body">
                <div class="conv-top">
                    <strong>${c.otherParty.full_name}</strong>
                    <span class="conv-time">${formatTime(c.updated_at)}</span>
                </div>
                <div class="conv-title">${c.title}</div>
                <div class="conv-preview">${c.lastMessage ? c.lastMessage.body : 'Start a conversation...'}</div>
            </div>
        </div>
    `).join('');
}

window.selectConversation = (id) => {
    _activeChatId = id;
    renderInbox(_conversations);
    const conv = _conversations.find(c => c.id === id);
    setupChatWindow(conv);
};

function setupChatWindow(conv) {
    const chat = document.getElementById('chatWindow');
    chat.innerHTML = `
        <div class="chat-header">
            <div class="ch-avatar">${conv.otherParty.full_name.charAt(0)}</div>
            <div class="ch-info">
                <h3>${conv.otherParty.full_name}</h3>
                <p>${conv.title} • ${conv.status.toUpperCase()}</p>
            </div>
        </div>
        <div class="chat-messages" id="messageList"></div>
        <div class="chat-input">
            <textarea id="msgInput" placeholder="Type your message..."></textarea>
            <button class="send-btn" onclick="sendMessage('${conv.id}')">➤</button>
        </div>
    `;

    if (_unsubscribeMessages) _unsubscribeMessages();
    
    const q = query(collection(db, "contracts", conv.id, "messages"), orderBy("created_at", "asc"));
    _unsubscribeMessages = onSnapshot(q, (snap) => {
        const list = document.getElementById('messageList');
        list.innerHTML = snap.docs.map(d => {
            const m = d.data();
            const isMe = m.sender_uid === _user.uid;
            return `
                <div class="msg-bubble ${isMe ? 'me' : 'them'}">
                    <div class="msg-content">${m.body}</div>
                    <div class="msg-time">${formatTime(m.created_at)}</div>
                </div>
            `;
        }).join('');
        list.scrollTop = list.scrollHeight;
    });
}

// 4. ACTIONS
window.sendMessage = async (id) => {
    const input = document.getElementById('msgInput');
    const body = input.value.trim();
    if (!body) return;

    try {
        await addDoc(collection(db, "contracts", id, "messages"), {
            sender_uid: _user.uid,
            sender_name: _userData.full_name,
            body: body,
            created_at: serverTimestamp(),
            is_read: false
        });
        await updateDoc(doc(db, "contracts", id), { updated_at: serverTimestamp() });
        input.value = '';
    } catch (e) {
        showToast("Message failed to send", "error");
    }
};

// 5. NAV & HELPERS
function formatTime(ts) {
    if (!ts) return '';
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
                <hr><a href="/client-profile-edit.html">Company Profile</a>
                <a href="/client-jobs.html">Post a Job</a>
                ${userData.role === 'admin' ? '<a href="/admin.html" style="color:var(--primary)">Admin Panel</a>' : ''}
                <hr><button onclick="handleLogout()" class="logout-btn">Log Out</button>
            </div>
        </div>
    `;

    centerNav.innerHTML = userData.role === 'client' ? `
        <a href="/client-dashboard.html">Dashboard</a>
        <a href="/designers.html">Find Designers</a>
        <a href="/client-jobs.html">My Jobs</a>
        <a href="/contracts.html">Contracts</a>
        <a href="/messages.html" class="active">Messages</a>
    ` : `
        <a href="/designer-dashboard.html">Dashboard</a>
        <a href="/marketplace.html">Find Work</a>
        <a href="/applications.html">My Applications</a>
        <a href="/contracts.html">Contracts</a>
        <a href="/messages.html" class="active">Messages</a>
    `;

    document.getElementById('profileDropdownTrigger').onclick = () => document.getElementById('profileDropdown').classList.toggle('show');
}

window.handleLogout = () => signOut(auth).then(() => window.location.href = '/login.html');
function showToast(msg, type='info') {
    const t = document.createElement('div'); t.className = `toast toast-${type}`; t.innerText = msg;
    document.getElementById('toast-container').appendChild(t);
    setTimeout(() => t.remove(), 4000);
}
