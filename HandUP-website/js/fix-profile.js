import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  await setDoc(
    doc(db, "users", user.uid),
    {
      firstName: "Alvaro",
      lastName: "Nunez",
      role: "volunteer",
    },
    { merge: true }
  );

  alert("✅ Firestore name saved for UID: " + user.uid);
});
