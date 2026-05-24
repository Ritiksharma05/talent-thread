import { auth, db } from './src/firebase.js';
import { createUserWithEmailAndPassword, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const signupElements = {
  logoutButton: document.querySelector("#logoutButton"),
  primaryCta: document.querySelector("#primaryCta"),
  sessionActions: document.querySelector("#sessionActions"),
  sessionMessage: document.querySelector("#sessionMessage"),
  signupButton: document.querySelector("#signupButton"),
  googleSignupBtn: document.querySelector("#googleSignupBtn"),
  signupForm: document.querySelector("#signupForm")
};

function renderSession(userDoc) {
  if (!userDoc) {
    signupElements.sessionMessage.textContent = "No active session yet. Create an account to enter the platform.";
    if(window.TalentThread) window.TalentThread.hide(signupElements.sessionActions);
    return;
  }

  const role = userDoc.role || 'designer';
  const name = userDoc.full_name || 'User';

  const nextHref = role === "admin"
    ? "/admin"
    : role === "designer"
      ? "/dashboard"
      : "/client-dashboard";
      
  const nextLabel = role === "admin"
    ? "Open Admin Console"
    : role === "designer"
      ? "Open Talent Workspace"
      : "Open Hiring Workspace";

  signupElements.sessionMessage.textContent = `${name} is logged in as a ${role}.`;
  signupElements.primaryCta.href = nextHref;
  signupElements.primaryCta.textContent = nextLabel;
  if(window.TalentThread) window.TalentThread.show(signupElements.sessionActions);
}

// Global Auth State Listener
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        renderSession(docSnap.data());
      } else {
        renderSession({ role: 'designer', full_name: user.email }); // fallback
      }
    } catch (e) {
      console.error("Error fetching user data:", e);
    }
  } else {
    renderSession(null);
  }
});

signupElements.signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  signupElements.signupButton.disabled = true;
  signupElements.signupButton.textContent = "Creating...";

  try {
    const payload = Object.fromEntries(new FormData(signupElements.signupForm).entries());
    
    // 1. Create User via Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, payload.email, payload.password);
    const user = userCredential.user;

    // 2. Store Profile in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: payload.email,
      role: payload.role || 'designer',
      full_name: payload.name || `${payload.firstName} ${payload.lastName}`.trim(),
      portfolio_url: payload.portfolioUrl || null,
      company_name: payload.company || null,
      created_at: new Date().toISOString()
    });

    window.sessionStorage.setItem("signupSuccessMessage", "Account created successfully.");
    window.location.href = payload.role === "designer" ? "/dashboard" : "/client-dashboard";

  } catch (error) {
    console.error("Signup error:", error);
    signupElements.sessionMessage.textContent = error.message;
  } finally {
    signupElements.signupButton.disabled = false;
    signupElements.signupButton.textContent = "Create Account →";
  }
});

if(signupElements.logoutButton) {
  signupElements.logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    window.location.reload();
  });
}

if(signupElements.googleSignupBtn) {
  signupElements.googleSignupBtn.addEventListener("click", async () => {
    signupElements.googleSignupBtn.disabled = true;
    signupElements.googleSignupBtn.textContent = "Connecting to Google...";

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Determine selected role from the form's hidden input
      const roleInput = document.getElementById("signupRole");
      const role = roleInput ? roleInput.value : 'designer';

      // Avoid getDoc since some user Firestore rules throw permissions error on non-existent documents
      const docRef = doc(db, "users", user.uid);
      
      // Use merge: true to avoid completely overwriting an existing user's data
      // if they accidentally click "Sign up" instead of "Log in"
      await setDoc(docRef, {
        uid: user.uid,
        email: user.email,
        role: role,
        full_name: user.displayName || user.email.split('@')[0],
        created_at: new Date().toISOString()
      }, { merge: true });
      
      window.sessionStorage.setItem("signupSuccessMessage", "Account created successfully with Google.");
      
      // Redirect based on the role they chose in the signup form
      window.location.href = role === "designer" ? "/dashboard" : "/client-dashboard";

    } catch (error) {
      console.error("Google Signup error:", error);
      if(signupElements.sessionMessage) signupElements.sessionMessage.textContent = "Google sign-up failed: " + error.message;
    } finally {
      signupElements.googleSignupBtn.disabled = false;
      signupElements.googleSignupBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign up with Google`;
    }
  });
}
