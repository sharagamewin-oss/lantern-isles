// Load Firebase tools from Google's CDN (modular SDK, version 10.12.2)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// YOUR keys from Firebase console -> Project settings -> Your apps
const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// Start Firebase with our keys
const app = initializeApp(firebaseConfig);

// Create the login tool and the database tool
const auth = getAuth(app);
const db = getFirestore(app);

// Export them so other files (db.js, main.js...) can use them later
export { app, auth, db };
