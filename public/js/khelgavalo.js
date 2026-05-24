import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 1. SECURITY CONFIG
const ADMIN_PIN = "123456"; 

onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = '/login.html'; return; }
    
    // Developer Bypass for Local Testing
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // Check role from Firestore
    const snap = await getDoc(doc(db, 'users', user.uid));
    const userData = snap.exists() ? snap.data() : null;
    
    if (!isLocal && (!userData || userData.role !== 'admin')) {
        alert("Unauthorized Access Attempt Detected.");
        window.location.href = '/client-dashboard.html';
        return;
    }

    if (isLocal && (!userData || userData.role !== 'admin')) {
        console.warn("Dev Mode: Granting temporary access to non-admin user on localhost.");
        console.info("To permanently promote this account, run: TalentThread.promoteMe()");
    }
    
    // If Admin or Local, show the gate
    document.body.style.visibility = 'visible';
});

// 2. DEVELOPER UTILITIES
window.TalentThread = window.TalentThread || {};
window.TalentThread.promoteMe = async () => {
    const user = auth.currentUser;
    if (!user) return console.error("No user logged in.");
    try {
        const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
        console.log("Success! Account promoted to admin. Please refresh the page.");
    } catch (e) {
        console.error("Promotion failed:", e);
    }
};

// 2. UNLOCK FUNCTION
window.unlockAdmin = () => {
    const input = document.getElementById('adminPin').value;
    const error = document.getElementById('errorMsg');
    
    if (input === ADMIN_PIN) {
        // HIDE GATE
        document.getElementById('adminGate').style.display = 'none';
        
        // RE-INITIALIZE ORIGINAL ADMIN LOGIC (if it exists)
        if (window.app && typeof window.app.init === 'function') {
            window.app.init();
        } else {
            // Force a reload of the admin sections manually if needed
            console.log("PIN Accepted. Initializing Admin Modules...");
            // The admin.js script will take over from here
        }
    } else {
        error.style.display = 'block';
        setTimeout(() => { error.style.display = 'none'; }, 3000);
    }
};
