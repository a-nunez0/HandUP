import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut,
  deleteUser,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------- elements ---------- */
const form = document.getElementById("settingsForm");
const firstNameInput = document.getElementById("firstName");
const lastNameInput = document.getElementById("lastName");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");
const locationInput = document.getElementById("location");
const bioInput = document.getElementById("bio");
const saveBtn = document.getElementById("saveBtn");
const logoutBtn = document.getElementById("logoutBtn");
const deleteBtn = document.getElementById("deleteBtn");
const editBtn = document.getElementById("editBtn");
const messageBox = document.getElementById("message");

let currentUser = null;
let isEditing = false;

let originalProfile = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  bio: "",
};

/* ---------- helpers ---------- */
function showMessage(text, type = "success") {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
  messageBox.classList.remove("hidden");
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "message hidden";
}

function setLoading(button, isLoading, loadingText) {
  if (!button) return;

  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function getUserDocRef(uid) {
  return doc(db, "users", uid);
}

function lockFields() {
  firstNameInput.disabled = true;
  lastNameInput.disabled = true;
  phoneInput.disabled = true;
  locationInput.disabled = true;
  bioInput.disabled = true;

  saveBtn.classList.add("hidden");
  editBtn.textContent = "Edit Profile";
  isEditing = false;
}

function unlockFields() {
  firstNameInput.disabled = false;
  lastNameInput.disabled = false;
  phoneInput.disabled = false;
  locationInput.disabled = false;
  bioInput.disabled = false;

  saveBtn.classList.remove("hidden");
  editBtn.textContent = "Cancel";
  isEditing = true;
}

function storeOriginalValues(data) {
  originalProfile = {
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || "",
    phone: data.phone || "",
    location: data.location || "",
    bio: data.bio || "",
  };
}

function restoreOriginalValues() {
  firstNameInput.value = originalProfile.firstName || "";
  lastNameInput.value = originalProfile.lastName || "";
  emailInput.value = originalProfile.email || "";
  phoneInput.value = originalProfile.phone || "";
  locationInput.value = originalProfile.location || "";
  bioInput.value = originalProfile.bio || "";
}

function getEventDateTime(eventData) {
  const date = String(eventData?.date || "").trim();
  const time = String(eventData?.time || "").trim();

  if (!date || !time) return null;

  const dt = new Date(`${date}T${time}`);
  if (Number.isNaN(dt.getTime())) return null;

  return dt;
}

function isFutureEvent(eventData) {
  const eventDateTime = getEventDateTime(eventData);

  if (!eventDateTime) {
    return false;
  }

  return eventDateTime.getTime() >= Date.now();
}

async function deleteJoinRequestsForEvent(eventId) {
  const joinRequestsRef = collection(db, "joinRequests");
  const q = query(joinRequestsRef, where("eventId", "==", eventId));
  const snap = await getDocs(q);

  const deletions = snap.docs.map((requestDoc) =>
    deleteDoc(doc(db, "joinRequests", requestDoc.id))
  );

  await Promise.all(deletions);
}

async function cleanupDeletedUsersFutureEvents(uid) {
  const eventsRef = collection(db, "events");
  const q = query(eventsRef, where("organizerId", "==", uid));
  const snap = await getDocs(q);

  for (const eventDoc of snap.docs) {
    const eventData = eventDoc.data();

    if (!isFutureEvent(eventData)) {
      continue;
    }

    await deleteJoinRequestsForEvent(eventDoc.id);
    await deleteDoc(doc(db, "events", eventDoc.id));
  }
}

async function cleanupDeletedUsersFutureJoinRequests(uid) {
  const joinRequestsRef = collection(db, "joinRequests");
  const q = query(joinRequestsRef, where("volunteerId", "==", uid));
  const snap = await getDocs(q);

  for (const requestDoc of snap.docs) {
    const requestData = requestDoc.data();
    const eventId = requestData.eventId;

    if (!eventId) continue;

    const eventRef = doc(db, "events", eventId);
    const eventSnap = await getDoc(eventRef);

    // If the event is already gone, remove this orphaned request.
    if (!eventSnap.exists()) {
      await deleteDoc(doc(db, "joinRequests", requestDoc.id));
      continue;
    }

    const eventData = eventSnap.data();

    if (isFutureEvent(eventData)) {
      await deleteDoc(doc(db, "joinRequests", requestDoc.id));
    }
  }
}

async function ensureUserProfile(user) {
  const userRef = getUserDocRef(user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const displayParts = (user.displayName || "").trim().split(/\s+/).filter(Boolean);
    const firstName = displayParts[0] || "";
    const lastName = displayParts.slice(1).join(" ") || "";

    await setDoc(userRef, {
      uid: user.uid,
      firstName,
      lastName,
      email: user.email || "",
      phone: "",
      location: "",
      bio: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

async function loadUserProfile(user) {
  const userRef = getUserDocRef(user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    const fallback = {
      firstName: "",
      lastName: "",
      email: user.email || "",
      phone: "",
      location: "",
      bio: "",
    };

    storeOriginalValues(fallback);
    restoreOriginalValues();
    return;
  }

  const data = snap.data();

  const profileData = {
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || user.email || "",
    phone: data.phone || "",
    location: data.location || "",
    bio: data.bio || "",
  };

  storeOriginalValues(profileData);
  restoreOriginalValues();
}

/* ---------- auth guard ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;
  clearMessage();
  lockFields();

  try {
    await ensureUserProfile(user);
    await loadUserProfile(user);
  } catch (error) {
    console.error("Error loading settings:", error);
    showMessage("Could not load your settings right now.", "error");
  }
});

/* ---------- edit toggle ---------- */
editBtn?.addEventListener("click", () => {
  clearMessage();

  if (!isEditing) {
    unlockFields();
    return;
  }

  restoreOriginalValues();
  lockFields();
});

/* ---------- save profile ---------- */
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentUser) return;

  clearMessage();
  setLoading(saveBtn, true, "Saving...");

  const firstName = firstNameInput.value.trim();
  const lastName = lastNameInput.value.trim();
  const phone = phoneInput.value.trim();
  const location = locationInput.value.trim();
  const bio = bioInput.value.trim();
  const fullName = `${firstName} ${lastName}`.trim();

  try {
    const userRef = getUserDocRef(currentUser.uid);

    await setDoc(
      userRef,
      {
        uid: currentUser.uid,
        firstName,
        lastName,
        email: currentUser.email || "",
        phone,
        location,
        bio,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    if (fullName !== (currentUser.displayName || "")) {
      await updateProfile(currentUser, { displayName: fullName });
    }

    storeOriginalValues({
      firstName,
      lastName,
      email: currentUser.email || "",
      phone,
      location,
      bio,
    });

    restoreOriginalValues();
    lockFields();
    showMessage("Your profile was updated successfully.", "success");
  } catch (error) {
    console.error("Error saving profile:", error);
    showMessage("Could not save your changes. Please try again.", "error");
  } finally {
    setLoading(saveBtn, false);
  }
});

/* ---------- logout ---------- */
logoutBtn?.addEventListener("click", async () => {
  clearMessage();
  setLoading(logoutBtn, true, "Logging out...");

  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Logout error:", error);
    showMessage("Could not log out right now.", "error");
    setLoading(logoutBtn, false);
  }
});

/* ---------- delete account ---------- */
deleteBtn?.addEventListener("click", async () => {
  if (!currentUser) return;

  const confirmed = window.confirm(
    "Are you sure you want to delete your account?\n\nYour future events and requests will be removed, but past event history will remain. This action cannot be undone."
  );

  if (!confirmed) return;

  clearMessage();
  setLoading(deleteBtn, true, "Deleting...");

  try {
    const uid = currentUser.uid;
    const userRef = getUserDocRef(uid);

    // 1. Delete future events created by this user + requests on those events
    await cleanupDeletedUsersFutureEvents(uid);

    // 2. Delete future requests made by this user on other events
    await cleanupDeletedUsersFutureJoinRequests(uid);

    // 3. Delete user profile
    await deleteDoc(userRef);

    // 4. Delete Firebase auth account
    await deleteUser(currentUser);

    window.location.href = "signup.html";
  } catch (error) {
    console.error("Delete account error:", error);

    if (error.code === "auth/requires-recent-login") {
      showMessage(
        "For security, please log out, log back in, and try deleting your account again.",
        "error"
      );
    } else {
      showMessage("Could not delete your account right now.", "error");
    }

    setLoading(deleteBtn, false);
  }
});