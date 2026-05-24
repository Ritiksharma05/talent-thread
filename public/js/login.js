import { auth, db } from './src/firebase.js';
import { signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const loginElements = {
  forgotPasswordLink: document.querySelector("#forgotPasswordLink"),
  loginButton: document.querySelector("#loginButton"),
  googleLoginBtn: document.querySelector("#googleLoginBtn"),
  loginForm: document.querySelector("#loginForm"),
  loginMessage: document.querySelector("#loginMessage"),
  logoutButton: document.querySelector("#logoutButton"),
  primaryCta: document.querySelector("#primaryCta"),
  sessionActions: document.querySelector("#sessionActions")
};

function renderSession(userDoc) {
  if (!userDoc) {
    if(loginElements.loginMessage) loginElements.loginMessage.textContent = "Enter your email and password to continue.";
    if(window.TalentThread && loginElements.sessionActions) window.TalentThread.hide(loginElements.sessionActions);
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

  if(loginElements.loginMessage) loginElements.loginMessage.textContent = `${name} is logged in as a ${role}.`;
  if(loginElements.primaryCta) {
    loginElements.primaryCta.href = nextHref;
    loginElements.primaryCta.textContent = nextLabel;
  }
  if(window.TalentThread && loginElements.sessionActions) window.TalentThread.show(loginElements.sessionActions);
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
    
    // Check if there was a redirected success message from signup
    const signupMessage = window.sessionStorage.getItem("signupSuccessMessage");
    if (signupMessage && loginElements.loginMessage) {
      window.sessionStorage.removeItem("signupSuccessMessage");
      loginElements.loginMessage.textContent = signupMessage;
    }
  }
});

if(loginElements.loginForm) {
  loginElements.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginElements.loginButton.disabled = true;
    loginElements.loginButton.textContent = "Logging in...";

    try {
      const payload = Object.fromEntries(new FormData(loginElements.loginForm).entries());
      
      const userCredential = await signInWithEmailAndPassword(auth, payload.email, payload.password);
      
      // Fetch role to redirect properly
      const docSnap = await getDoc(doc(db, "users", userCredential.user.uid));
      let role = 'designer';
      let name = 'User';
      if (docSnap.exists()) {
        role = docSnap.data().role || 'designer';
        name = docSnap.data().full_name || 'User';
      }

      loginElements.loginForm.reset();
      loginElements.loginMessage.textContent = `Welcome, ${name}. Redirecting now...`;
      window.location.href = role === "designer" ? "/dashboard" : "/client-dashboard";

    } catch (error) {
      console.error("Login error: ", error);
      loginElements.loginMessage.textContent = "Invalid email or password.";
    } finally {
      loginElements.loginButton.disabled = false;
      loginElements.loginButton.textContent = "Sign In →";
    }
  });
}

if(loginElements.logoutButton) {
  loginElements.logoutButton.addEventListener("click", async () => {
    await signOut(auth);
    window.location.reload();
  });
}

if(loginElements.forgotPasswordLink) {
  loginElements.forgotPasswordLink.addEventListener("click", async (event) => {
    event.preventDefault();
    const email = window.prompt("Enter the email address for your account:");
    if (!email) return;

    try {
      await sendPasswordResetEmail(auth, email);
      loginElements.loginMessage.textContent = "If an account exists, a reset link has been sent.";
    } catch (error) {
      loginElements.loginMessage.textContent = "Failed to send reset link: " + error.message;
    }
  });
}

if(loginElements.googleLoginBtn) {
  loginElements.googleLoginBtn.addEventListener("click", async () => {
    loginElements.googleLoginBtn.disabled = true;
    loginElements.googleLoginBtn.textContent = "Connecting to Google...";

    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      console.log("Authenticated with Google. UID:", user.uid);
      console.log("Current Project ID:", auth.app.options.projectId);

      // Determine default role
      let role = 'designer';
      let name = user.displayName || user.email?.split('@')[0] || 'User';
      
      const docRef = doc(db, "users", user.uid);
      
      try {
        // Step A: Attempt a minimal write first to see if permissions exist at all
        await setDoc(docRef, {
          uid: user.uid,
          email: user.email,
          full_name: name,
          last_login: new Date().toISOString()
        }, { merge: true });

        // Step B: Try to retrieve existing role if possible
        const snap = await getDoc(docRef);
        if (snap.exists() && snap.data().role) {
          role = snap.data().role;
          name = snap.data().full_name || name;
        } else {
          // New user or missing role, set default
          await setDoc(docRef, { role: 'designer', created_at: new Date().toISOString() }, { merge: true });
        }
      } catch (profileErr) {
        console.error("Firestore Error Code:", profileErr.code);
        console.error("Full Error:", profileErr);
        
        const details = profileErr.code === 'permission-denied' 
          ? `Verify Project ID [${auth.app.options.projectId}] matches your console.`
          : profileErr.message;
          
        throw new Error(`Profile Sync Blocked: ${details}`);
      }

      if(loginElements.loginMessage) loginElements.loginMessage.textContent = `Welcome, ${name}. Redirecting now...`;
      window.location.href = role === "designer" ? "/dashboard" : "/client-dashboard";

    } catch (error) {
      console.error("Google Login error: ", error);
      let userMessage = error.message.includes("Profile Sync Blocked") 
        ? error.message 
        : "Google sign-in failed: " + error.message;
        
      if(loginElements.loginMessage) loginElements.loginMessage.textContent = userMessage;
    } finally {
      loginElements.googleLoginBtn.disabled = false;
      loginElements.googleLoginBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 8px;"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Continue with Google`;
    }
  });
}
