import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    console.log("No user logged in");
    return;
  }

  console.log("AUTH uid:", user.uid);
  console.log("AUTH email:", user.email);
  console.log("AUTH displayName:", user.displayName);

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    console.log("Firestore doc exists?", snap.exists());

    if (snap.exists()) {
      console.log("Firestore data:", snap.data());
    }
  } catch (e) {
    console.error("Firestore read error:", e);
  }
});
