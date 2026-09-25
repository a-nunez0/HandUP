// js/profile.js
import { db } from "./firebase.js";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------- elements ---------- */
const profileNameEl = document.getElementById("profileName");
const profileLocationEl = document.getElementById("profileLocation");
const profileAvatarEl = document.getElementById("profileAvatar");

const eventsOrganizedEl = document.getElementById("eventsOrganized");
const eventsVolunteeredEl = document.getElementById("eventsVolunteered");
const peopleHelpedEl = document.getElementById("peopleHelped");

const organizedEventsEl = document.getElementById("organizedEvents");
const volunteerEventsEl = document.getElementById("volunteerEvents");

/* ---------- helpers ---------- */
function getProfileUid() {
  const params = new URLSearchParams(window.location.search);
  return params.get("uid");
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getInitials(firstName = "", lastName = "") {
  const first = firstName.trim().charAt(0).toUpperCase();
  const last = lastName.trim().charAt(0).toUpperCase();
  return (first + last) || "U";
}

function formatDate(dateStr = "") {
  if (!dateStr) return "Date not available";

  const d = new Date(`${dateStr}T00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr = "") {
  if (!timeStr) return "";

  const d = new Date(`2000-01-01T${timeStr}`);
  if (Number.isNaN(d.getTime())) return timeStr;

  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function createEventCard(event) {
  const title = escapeHtml(event.title || "Untitled Event");
  const location = escapeHtml(event.location || "Location not provided");
  const dateText = formatDate(event.date || "");
  const timeText = formatTime(event.time || "");
  const meta = [dateText, timeText, location].filter(Boolean).join(" • ");

  return `
    <article class="profile-event-card">
      <h3>${title}</h3>
      <p class="muted">${escapeHtml(meta)}</p>
      ${
        event.description
          ? `<p class="profile-event-desc">${escapeHtml(event.description)}</p>`
          : ""
      }
      <a class="profile-link" href="event-details.html?id=${encodeURIComponent(event.id)}">View Event</a>
    </article>
  `;
}

function createVolunteerCard(request) {
  const title = escapeHtml(request.eventTitle || "Completed Event");
  const location = escapeHtml(request.eventLocation || "Location not provided");
  const dateText = formatDate(request.eventDate || "");
  const timeText = formatTime(request.eventTime || "");
  const meta = [dateText, timeText, location].filter(Boolean).join(" • ");

  return `
    <article class="profile-event-card">
      <h3>${title}</h3>
      <p class="muted">${escapeHtml(meta)}</p>
      <p class="profile-status">Status: Completed</p>
      ${
        request.eventId
          ? `<a class="profile-link" href="event-details.html?id=${encodeURIComponent(request.eventId)}">View Event</a>`
          : ""
      }
    </article>
  `;
}

function setEmptyState(container, text) {
  if (!container) return;
  container.innerHTML = `<p class="muted">${escapeHtml(text)}</p>`;
}

function setText(el, value) {
  if (el) el.textContent = value;
}

/* ---------- data loaders ---------- */
async function loadUserProfile(uid) {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    throw new Error("User not found.");
  }

  const data = snap.data();
  const firstName = data.firstName || "";
  const lastName = data.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim() || "User";
  const location = data.location || "Location not added";

  setText(profileNameEl, fullName);
  setText(profileLocationEl, location);
  setText(profileAvatarEl, getInitials(firstName, lastName));

  return data;
}

async function loadOrganizedEvents(uid) {
  const q = query(collection(db, "events"), where("organizerId", "==", uid));
  const snap = await getDocs(q);

  const events = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  events.sort((a, b) => {
    const aDate = new Date(`${a.date || "9999-12-31"}T${a.time || "23:59"}`).getTime();
    const bDate = new Date(`${b.date || "9999-12-31"}T${b.time || "23:59"}`).getTime();
    return aDate - bDate;
  });

  setText(eventsOrganizedEl, String(events.length));

  if (!organizedEventsEl) return events;

  if (events.length === 0) {
    setEmptyState(organizedEventsEl, "No organized events yet.");
    return events;
  }

  organizedEventsEl.innerHTML = events.map(createEventCard).join("");
  return events;
}

async function loadVolunteerHistory(uid) {
  const q = query(
    collection(db, "joinRequests"),
    where("volunteerId", "==", uid),
    where("status", "==", "completed")
  );

  const snap = await getDocs(q);

  const requests = snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));

  requests.sort((a, b) => {
    const aDate = new Date(`${a.eventDate || "9999-12-31"}T${a.eventTime || "23:59"}`).getTime();
    const bDate = new Date(`${b.eventDate || "9999-12-31"}T${b.eventTime || "23:59"}`).getTime();
    return aDate - bDate;
  });

  setText(eventsVolunteeredEl, String(requests.length));

  if (!volunteerEventsEl) return requests;

  if (requests.length === 0) {
    setEmptyState(volunteerEventsEl, "No completed volunteer history yet.");
    return requests;
  }

  volunteerEventsEl.innerHTML = requests.map(createVolunteerCard).join("");
  return requests;
}

async function loadPeopleHelped(uid) {
  const q = query(collection(db, "events"), where("organizerId", "==", uid));
  const snap = await getDocs(q);

  let total = 0;

  snap.forEach((eventDoc) => {
    const event = eventDoc.data();
    total += Number(event.approvedCount || 0);
  });

  setText(peopleHelpedEl, String(total));
}

/* ---------- init ---------- */
window.addEventListener("DOMContentLoaded", async () => {
  const uid = getProfileUid();

  if (!uid) {
    setText(profileNameEl, "Profile not found");
    setText(profileLocationEl, "Missing user id in URL.");
    setText(profileAvatarEl, "?");
    setEmptyState(organizedEventsEl, "Could not load profile.");
    setEmptyState(volunteerEventsEl, "Could not load profile.");
    setText(eventsOrganizedEl, "0");
    setText(eventsVolunteeredEl, "0");
    setText(peopleHelpedEl, "0");
    return;
  }

  try {
    await loadUserProfile(uid);
    await Promise.all([
      loadOrganizedEvents(uid),
      loadVolunteerHistory(uid),
      loadPeopleHelped(uid),
    ]);
  } catch (error) {
    console.error("Error loading profile:", error);

    setText(profileNameEl, "Profile unavailable");
    setText(profileLocationEl, "Could not load this profile.");
    setText(profileAvatarEl, "?");
    setText(eventsOrganizedEl, "0");
    setText(eventsVolunteeredEl, "0");
    setText(peopleHelpedEl, "0");
    setEmptyState(organizedEventsEl, "Could not load organized events.");
    setEmptyState(volunteerEventsEl, "Could not load volunteer history.");
  }
});