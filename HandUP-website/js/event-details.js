// js/event-details.js
import { db } from "./firebase.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function getId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "—";
}

window.addEventListener("DOMContentLoaded", async () => {
  const eventId = getId();
  if (!eventId) return;

  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) return;

  const e = snap.data();

  // Basic fields
  setText("eventTitle", e.title || "Event");
  setText("eventCategory", e.category || "other");
  setText("eventCategoryText", e.category || "—");
  setText("eventLocation", e.location || "—");
  setText("eventDate", e.date || "—");
  setText("eventTime", e.time || "—");
  setText("eventDescription", e.description || "No description provided.");

  // Spots display = "left / total"
  const spots = Number(e.spots || 0);
  const approved = Number(e.approvedCount || 0);

  if (!spots) {
    setText("eventSpots", "—");
  } else {
    const left = Math.max(0, spots - approved);
    setText("eventSpots", `${left} left`);
  }

  // Organizer name can stay whatever your profile.js sets in header;
  // if you want the actual organizer name here later, we can fetch users/{organizerId}.
});