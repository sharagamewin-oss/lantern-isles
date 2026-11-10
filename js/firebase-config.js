// Load Firebase tools from Google's CDN (modular SDK, version 10.12.2)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initializeApp } from "firebase/app";
// YOUR keys from Firebase console -> Project settings -> Your apps
const firebaseConfig = {
  apiKey: "AIzaSyDpNPayiOA8UKuPthfNnm2z1rCtBmH6WuU",
  authDomain: "lantern-isles-2b456.firebaseapp.com",
  databaseURL: "https://lantern-isles-2b456-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lantern-isles-2b456",
  storageBucket: "lantern-isles-2b456.firebasestorage.app",
  messagingSenderId: "869507673988",
  appId: "1:869507673988:web:751ecbaea74e29b05d77d1"
};

// Start Firebase with our keys
const app = initializeApp(firebaseConfig);

// Create the login tool and the database tool
const auth = getAuth(app);
const db = getFirestore(app);

// Export them so other files (db.js, main.js...) can use them later
export { app, auth, db };
