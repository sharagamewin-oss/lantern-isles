// db.js: ALL database and login code lives here.
// Other files never talk to Firebase directly. They call these functions.

import { auth, db } from "./firebase-config.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  increment
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 1. Log the visitor in as a guest (returns the user).
// If this browser already has a guest ID, Firebase gives back the same one.
export async function loginAnonymously() {
  const result = await signInAnonymously(auth);
  return result.user;
}

// 2. Has this guest already made a wish?
// (The wish document's name is the guest's ID.)
export async function hasWish(uid) {
  const snap = await getDoc(doc(db, "wishes", uid));
  return snap.exists();
}

// 3. Save a new wish.
// CHANGED in Phase 4: a batch saves the wish AND the person's room together.
// If one is refused, both are refused.
export async function createWish(user, { name, college, wishText }) {
  const batch = writeBatch(db);

  batch.set(doc(db, "wishes", user.uid), {
    name: name,
    college: college,
    wishText: wishText,
    skills: "",               // the real skills live in the room now
    sparks: 0,
    uid: user.uid,
    hidden: false,
    createdAt: serverTimestamp() // Firebase fills in the real time
  });

  batch.set(doc(db, "rooms", user.uid), {
    name: name,
    college: college,
    skills: "",
    projects: "",
    createdAt: serverTimestamp()
  });

  await batch.commit();
}

// 4. Listen to wishes LIVE.
// Firebase calls onChange every time a wish is added OR changed, on any device.
// onChange receives: { added: [new wishes], modified: [changed wishes], total: number }
export function listenToWishes(onChange, onError) {
  const q = query(
    collection(db, "wishes"),
    orderBy("createdAt", "desc"),
    limit(200) // show the newest 200 lanterns for now
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const added = [];
      const modified = [];

      // docChanges() lists only what is NEW or CHANGED since last time
      snapshot.docChanges().forEach((change) => {
        const data = change.doc.data();
        if (data.hidden === true) return; // skip hidden wishes

        if (change.type === "added") {
          added.push({ id: change.doc.id, ...data });
        } else if (change.type === "modified") {
          modified.push({ id: change.doc.id, ...data });
        }
      });

      // Count the wishes that are not hidden
      const total = snapshot.docs.filter((d) => d.data().hidden !== true).length;

      onChange({ added, modified, total });
    },
    (error) => {
      console.error("Could not listen to wishes:", error);
      if (onError) onError(error);
    }
  );
}

// 5. Has this guest already sent a spark to this lantern?
export async function hasSparked(wishId, uid) {
  const snap = await getDoc(doc(db, "wishes", wishId, "sparks", uid));
  return snap.exists();
}

// 6. Send a spark.
// A "batch" means two writes that succeed together or fail together:
//   (a) create my spark record, (b) add +1 to the lantern's sparks number.
export async function sendSpark(wishId, uid) {
  const batch = writeBatch(db);
  batch.set(doc(db, "wishes", wishId, "sparks", uid), {
    createdAt: serverTimestamp()
  });
  batch.update(doc(db, "wishes", wishId), {
    sparks: increment(1)
  });
  await batch.commit();
}

// 7. NEW: Read one person's room. Returns the data, or null if there is no room yet.
export async function getRoom(uid) {
  const snap = await getDoc(doc(db, "rooms", uid));
  return snap.exists() ? snap.data() : null;
}

// 8. NEW: Save my room.
// If my room exists we update skills and projects.
// If it does not exist yet (people who joined before Phase 4) we create it.
export async function saveRoom(user, wish, { skills, projects }) {
  const ref = doc(db, "rooms", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, { skills: skills, projects: projects });
  } else {
    await setDoc(ref, {
      name: wish.name,
      college: wish.college,
      skills: skills,
      projects: projects,
      createdAt: serverTimestamp()
    });
  }
}
