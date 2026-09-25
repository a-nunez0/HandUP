// js/auth.js
import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Ensures the /users/{uid} profile exists.
 */
async function ensureUserProfile(user, profileData) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || "",
      firstName: profileData?.firstName || "",
      lastName: profileData?.lastName || "",
      // Keep role stored for later (dashboards), but don't route there yet.
      role: profileData?.role || "volunteer",
      createdAt: serverTimestamp(),
    });
  }
}

export async function signupWithEmail({ email, password, firstName, lastName, role }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await ensureUserProfile(cred.user, { firstName, lastName, role });
  return cred.user;
}

export async function loginWithEmail({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function loginWithGoogle(defaultRole = "volunteer") {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);

  const displayName = cred.user.displayName || "";
  const [firstName, ...rest] = displayName.split(" ");
  const lastName = rest.join(" ");

  await ensureUserProfile(cred.user, { firstName, lastName, role: defaultRole });
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export async function getCurrentUserProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  return snap.exists() ? snap.data() : null;
}

/**
 * App "home" redirect.
 * Right now HandUP's home is the event feed (browse page).
 * Later, when dashboards are finished, you can switch this back to role routing.
 */
export async function redirectToDashboard() {
  window.location.href = "browse.html";
}

/**
 * Protect a page (must be logged in).
 * Optional role enforcement: { role: "volunteer" } or { role: "organizer" }
 *
 * Note: Even if role enforcement fails/missing profile, we send users to browse for now.
 */
export function protectPage({ role } = {}) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    // If no role requirement, user is allowed
    if (!role) return;

    const profile = await getCurrentUserProfile();

    // If profile missing, don't send to dashboards yet—just send to browse
    if (!profile) {
      window.location.href = "browse.html";
      return;
    }

    // If wrong role, send them to the current app home (browse)
    if (profile.role !== role) {
      window.location.href = "browse.html";
    }
  });
}

/**
 * Optional helper: if user is logged in, bounce them away from login/signup.
 */
export function redirectIfLoggedIn() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      await redirectToDashboard();
    }
  });
}