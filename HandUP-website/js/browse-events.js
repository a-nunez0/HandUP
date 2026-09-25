// js/browse-events.js
import { auth, db } from "./firebase.js";
import { requestToJoinEvent } from "./join-request.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function prettyStatus(s) {
  const st = (s || "pending").toLowerCase();
  if (st === "pending") return "Pending";
  if (st === "approved") return "Approved";
  if (st === "rejected") return "Rejected";
  if (st === "completed") return "Completed";
  return st;
}

async function loadJoinRequestsForUser(uid) {
  const q = query(collection(db, "joinRequests"), where("volunteerId", "==", uid));
  const snap = await getDocs(q);

  const map = new Map(); // eventId -> request
  snap.forEach((d) => {
    const data = d.data();
    if (data.eventId) map.set(data.eventId, { id: d.id, ...data });
  });

  return map;
}

function spotsLine(evt) {
  const spots = Number(evt.spots || 0);
  if (!spots) return `<p class="event-meta muted">Spots: —</p>`;

  const approved = Number(evt.approvedCount || 0);
  const left = Math.max(0, spots - approved);
  return `<p class="event-meta muted">Spots left: ${left}</p>`;
}

function renderEventCard(evt, uid, requestMap) {
  const id = evt.id;
  const title = escapeHtml(evt.title || "Untitled Event");
  const location = escapeHtml(evt.location || "—");
  const date = escapeHtml(evt.date || "—");
  const category = escapeHtml(evt.category || "other");

  const isOrganizer = evt.organizerId && uid && evt.organizerId === uid;
  const req = requestMap.get(id);

  const spots = Number(evt.spots || 0);
  const approved = Number(evt.approvedCount || 0);
  const isFull = spots > 0 && approved >= spots;

  let rightBtn = `<button class="btn btn-primary btn-join" data-event-id="${id}" type="button">Request</button>`;

  if (isOrganizer) {
    rightBtn = `<button class="btn btn-primary requested" type="button" disabled>Organizer</button>`;
  } else if (req) {
    rightBtn = `<button class="btn btn-primary requested" type="button" disabled>Request: ${escapeHtml(prettyStatus(req.status))}</button>`;
  } else if (isFull) {
    rightBtn = `<button class="btn btn-primary requested" type="button" disabled>Full</button>`;
  }

  return `
    <article class="event-card">
      <div class="event-top">
        <span class="tag">${category}</span>
      </div>

      <h3>${title}</h3>
      <p class="event-meta muted">${date} • ${location}</p>
      ${spotsLine(evt)}

      <div class="event-actions">
        <a class="btn btn-secondary" href="event-details.html?id=${id}">Details</a>
        ${rightBtn}
      </div>
    </article>
  `;
}

async function loadEventsAndRender(uid) {
  const grid = document.getElementById("eventsGrid");
  const empty = document.getElementById("emptyEvents");
  if (!grid) return;

  grid.innerHTML = "";

  const requestMap = await loadJoinRequestsForUser(uid);

  const qEvents = query(collection(db, "events"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qEvents);

  if (snap.empty) {
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  grid.innerHTML = events.map((e) => renderEventCard(e, uid, requestMap)).join("");

  // Wire join
  grid.querySelectorAll(".btn-join").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const eventId = btn.dataset.eventId;
      if (!eventId) return;

      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Sending…";

      try {
        const res = await requestToJoinEvent(eventId);

        if (res.ok) {
          btn.classList.add("requested");
          btn.textContent = "Request: Pending";
          return;
        }

        if (res.reason === "already_requested") {
          btn.classList.add("requested");
          btn.textContent = `Request: ${res.status}`;
          return;
        }

        if (res.reason === "is_organizer") {
          btn.classList.add("requested");
          btn.textContent = "Organizer";
          return;
        }

        if (res.reason === "full") {
          btn.classList.add("requested");
          btn.textContent = "Full";
          return;
        }

        btn.disabled = false;
        btn.textContent = original;
        alert("Could not send request.");
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = original;
        alert(err?.message || "Something went wrong.");
      }
    });
  });
}

window.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) return; // protectPage redirects
    loadEventsAndRender(user.uid);
  });
});