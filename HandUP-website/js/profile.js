// js/profile.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const userNameEl = document.getElementById("userName");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data();
      const firstName = data.firstName || "User";

      if (userNameEl) {
        userNameEl.textContent = firstName;
      }
    }
  } catch (error) {
    console.error("Error loading user name:", error);
    if (userNameEl) {
      userNameEl.textContent = "User";
    }
  }
});