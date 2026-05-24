import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Talent Thread Firebase Config (Synchronized)
const firebaseConfig = {
  apiKey: "AIzaSyBWBvNEn9pHQ58MZRpNiDjuWuT-5BcIb1c",
  authDomain: "talent-thread-f03e8.firebaseapp.com",
  databaseURL: "https://talent-thread-f03e8-default-rtdb.firebaseio.com",
  projectId: "talent-thread-f03e8",
  storageBucket: "talent-thread-f03e8.firebasestorage.app",
  messagingSenderId: "869079992839",
  appId: "1:869079992839:web:f4794f2f05e12ff0f5b8a2",
  measurementId: "G-RR9QMYGRWE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Firebase connected to project:", firebaseConfig.projectId);

export { app, auth, db };