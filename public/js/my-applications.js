import { auth, db } from './src/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const appList = document.getElementById('app-list');

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    document.body.style.visibility = 'visible';
    loadApplications(user.uid);
});

async function loadApplications(uid) {
    try {
        const q = query(
            collection(db, "applications"),
            where("designer_uid", "==", uid),
            orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);

        if (snap.empty) {
            appList.innerHTML = `
                <div style="padding: 60px; text-align: center;">
                    <p style="color: var(--ink-3); margin-bottom: 20px;">You haven't applied to any jobs yet.</p>
                    <a href="/find-work.html" class="btn btn-primary" style="display:inline-block; text-decoration:none">Browse Jobs</a>
                </div>
            `;
            return;
        }

        appList.innerHTML = snap.docs.map(doc => {
            const app = doc.data();
            const statusClass = getStatusClass(app.status);
            const date = app.createdAt ? new Date(app.createdAt.toDate()).toLocaleDateString() : 'Just now';

            return `
                <div class="app-card">
                    <div class="job-info">
                        <h3>${app.jobTitle || 'Design Project'}</h3>
                        <p>Applied on ${date} · Proposed ₹${(Number(app.proposed_rate) || 0).toLocaleString()}</p>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:8px">
                        <div class="status-pill ${statusClass}">${app.status}</div>
                        <div class="ai-badge" title="AI Match Score">
                            <span style="font-size:12px">✨</span> ${app.ai_score}% Match
                        </div>
                    </div>
                    <div>
                        <a href="/messages.html?jobId=${app.jobId}" class="btn btn-outline" style="display:block">View Messages</a>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("Load error:", err);
        appList.innerHTML = `<div style="color:var(--danger); padding:20px">Error loading applications: ${err.message}</div>`;
    }
}

function getStatusClass(status) {
    switch (status?.toLowerCase()) {
        case 'hired': return 'status-hired';
        case 'shortlisted': return 'status-shortlisted';
        case 'rejected': return 'status-rejected';
        default: return 'status-applied';
    }
}

// Tab Filtering (Visual only for now)
document.querySelectorAll('.tab').forEach(tab => {
    tab.onclick = () => {
        document.querySelector('.tab.active').classList.remove('active');
        tab.classList.add('active');
        // In a real app, you'd re-filter the 'snap' results here.
    };
});
