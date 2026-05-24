import { auth, db } from './src/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. STATE & AUTH
let _user = null;
let _job = null;
const urlParams = new URLSearchParams(window.location.search);
const _jobId = urlParams.get('id');

if (!_jobId) {
    alert("Job ID missing.");
    window.location.href = '/find-work.html';
}

onAuthStateChanged(auth, (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    _user = user;
    document.body.style.visibility = 'visible';
    loadJobDetails();
});

// 2. LOAD DATA
async function loadJobDetails() {
    try {
        const docRef = doc(db, "projects", _jobId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            alert("Job not found.");
            window.location.href = '/find-work.html';
            return;
        }

        _job = { id: snap.id, ...snap.data() };
        renderJob();
    } catch (err) {
        console.error("Load error:", err);
    }
}

function renderJob() {
    document.getElementById('jobDiscipline').innerText = (_job.discipline || 'Design').toUpperCase();
    document.getElementById('jobTitle').innerText = _job.title;
    document.getElementById('jobSub').innerText = `${_job.applicationCount || 0} applicants · Posted ${new Date(_job.created_at).toLocaleDateString()}`;
    document.getElementById('jobBudget').innerText = `₹${(_job.budget_min||0).toLocaleString()} - ₹${(_job.budget_max||0).toLocaleString()}`;
    document.getElementById('jobTimeline').innerText = _job.duration || 'Short-term';
    document.getElementById('jobExp').innerText = (_job.experience_level || 'Mid').toUpperCase();
    document.getElementById('jobType').innerText = (_job.work_mode || 'Remote').toUpperCase();
    document.getElementById('jobDesc').innerText = _job.description;
    document.getElementById('clientName').innerText = _job.company_name || 'Verified Client';
    
    // Skills
    const skillsCont = document.getElementById('jobSkills');
    skillsCont.innerHTML = (_job.skills || []).map(s => `<span class="skill-chip">${s}</span>`).join('');
}

// 3. DRAWER LOGIC
const overlay = document.getElementById('drawerOverlay');
const drawer = document.getElementById('applyDrawer');
const applyBtn = document.getElementById('applyBtn');

applyBtn.onclick = () => {
    overlay.style.display = 'block';
    setTimeout(() => drawer.classList.add('active'), 10);
};

window.closeDrawer = () => {
    drawer.classList.remove('active');
    setTimeout(() => overlay.style.display = 'none', 300);
};

overlay.onclick = closeDrawer;

// 4. AI SCORE LOGIC (Debounced)
const coverInput = document.getElementById('coverNote');
const scoreCircle = document.getElementById('aiScore');
const aiAdvice = document.getElementById('aiAdvice');
let aiTimer = null;

coverInput.oninput = () => {
    const len = coverInput.value.length;
    document.getElementById('charCount').innerText = `${len} / 2000`;
    
    if (aiTimer) clearTimeout(aiTimer);
    
    if (len < 50) {
        scoreCircle.innerText = "?";
        scoreCircle.style.borderColor = "var(--border)";
        aiAdvice.innerText = "Minimum 50 characters required for AI analysis.";
        return;
    }

    aiAdvice.innerText = "AI is analyzing your match...";
    aiTimer = setTimeout(runAiScoring, 1200);
};

async function runAiScoring() {
    // In a real app, this calls a Cloud Function. 
    // Here we simulate the logic based on keywords vs job skills.
    const note = coverInput.value.toLowerCase();
    const jobSkills = (_job.skills || []).map(s => s.toLowerCase());
    
    let matches = 0;
    jobSkills.forEach(s => { if (note.includes(s)) matches++; });
    
    const baseScore = Math.min(40 + (note.length / 20), 70);
    const bonus = matches * 10;
    const finalScore = Math.min(Math.round(baseScore + bonus), 100);

    scoreCircle.innerText = finalScore;
    
    if (finalScore > 75) {
        scoreCircle.style.borderColor = "#22c55e";
        aiAdvice.innerText = "Excellent match! Your skills align perfectly with the brief.";
    } else if (finalScore > 50) {
        scoreCircle.style.borderColor = "#f59e0b";
        aiAdvice.innerText = "Good start. Try mentioning more specific tools from the brief.";
    } else {
        scoreCircle.style.borderColor = "#ef4444";
        aiAdvice.innerText = "Low match. Address the specific requirements to stand out.";
    }
}

// 5. SUBMIT APPLICATION
document.getElementById('submitApp').onclick = async () => {
    if (coverInput.value.length < 50) return alert("Please write a longer cover note.");
    
    const submitBtn = document.getElementById('submitApp');
    submitBtn.disabled = true;
    submitBtn.innerText = "Sending...";

    try {
        const convId = `${_user.uid}_${_job.client_uid}_${_jobId}`;
        
        const appData = {
            jobId: _jobId,
            jobTitle: _job.title,
            designer_uid: _user.uid,
            freelancerName: _user.displayName || 'Designer',
            client_uid: _job.client_uid,
            conversationId: convId,
            cover_note: coverInput.value,
            proposed_rate: parseInt(document.getElementById('propRate').value) || 0,
            estimated_timeline: document.getElementById('propTimeline').value,
            ai_score: parseInt(scoreCircle.innerText) || 0,
            status: 'applied',
            createdAt: serverTimestamp()
        };

        // 1. Create application
        await addDoc(collection(db, "applications"), appData);

        // 2. Create Conversation
        await addDoc(collection(db, "conversations"), {
            id: convId,
            participants: [_user.uid, _job.client_uid],
            lastMessage: "New Application: " + coverInput.value.substring(0, 30) + "...",
            updatedAt: serverTimestamp(),
            jobId: _jobId
        });

        // 3. Create First Message
        await addDoc(collection(db, "conversations", convId, "messages"), {
            senderId: _user.uid,
            text: coverInput.value,
            type: 'proposal',
            timestamp: serverTimestamp()
        });

        // 4. Create Notification for Client (Subcollection pattern)
        await addDoc(collection(db, `notifications/${_job.client_uid}/items`), {
            type: 'new_application',
            title: 'New Application!',
            body: `${_user.displayName || 'A designer'} applied to "${_job.title}"`,
            link: `/client-dashboard.html`,
            is_read: false,
            created_at: new Date().toISOString()
        });

        // 5. Increment count
        await updateDoc(doc(db, "projects", _jobId), {
            applicationCount: increment(1)
        });

        alert("Application sent! A conversation has been started with the client.");
        window.location.href = '/my-applications.html';
    } catch (err) {
        console.error(err);
        alert("Error: " + err.message);
        submitBtn.disabled = false;
        submitBtn.innerText = "Send Application";
    }
};
