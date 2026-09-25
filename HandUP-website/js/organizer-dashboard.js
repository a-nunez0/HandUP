// js/organizer-dashboard.js
// "My Events" page: events I created + join requests for my events
// FIXED: Join Requests now load by eventId (matches rules using get(event))
// + Clean 0-requests message (no big empty panel at bottom)

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  updateDoc,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------- helpers ---------- */
function $(id) { return document.getElementById(id); }

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normStatus(s) {
  return (s || "pending").toLowerCase();
}

function pillClass(status) {
  const s = normStatus(status);
  if (s === "pending") return "pill pending";
  if (s === "approved") return "pill approved";
  if (s === "rejected") return "pill rejected";
  if (s === "completed") return "pill completed";
  return "pill";
}

function tsToMs(ts) {
  if (!ts) return 0;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  return 0;
}

async function getUserName(uid, cache) {
  if (!uid) return "Unknown";
  if (cache.has(uid)) return cache.get(uid);

  const snap = await getDoc(doc(db, "users", uid));
  let name = uid;

  if (snap.exists()) {
    const u = snap.data();
    const first = (u.firstName || "").trim();
    const last = (u.lastName || "").trim();
    const full = `${first} ${last}`.trim();
    name = full || u.email || uid;
  }

  cache.set(uid, name);
  return name;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/* ---------- DOM ---------- */
const myEventsList = $("myEventsList");
const myEventsCount = $("myEventsCount");
const myEventsEmpty = $("myEventsEmpty");

const requestsList = $("requestsList");
const resultsCount = $("resultsCount");
const emptyRequests = $("emptyRequests"); // we’ll hide this instead of using it

const statusFilter = $("statusFilter");
const sortBy = $("sortBy");
const searchInput = $("searchInput");
const refreshBtn = $("refreshBtn");

/* ---------- state ---------- */
let myEvents = [];
let requests = [];
let unsubEvents = null;

// joinRequests listeners (chunked)
let requestUnsubs = [];

const userNameCache = new Map();

/* ---------- small UI helper: 0 requests text ---------- */
function ensureZeroRequestsMsg() {
  // Create it once, place under the Join Requests header
  let el = $("zeroRequestsMsg");
  if (el) return el;

  const panelHead = document.querySelector(".panel .panel-head + #requestsList")?.previousElementSibling;
  // Above selector can be brittle; we’ll find Join Requests panel by the list id:
  const joinPanel = requestsList?.closest(".panel");
  const head = joinPanel?.querySelector(".panel-head");
  if (!head) return null;

  el = document.createElement("p");
  el.id = "zeroRequestsMsg";
  el.className = "muted";
  el.style.margin = ".35rem 0 0";
  el.style.display = "none";
  el.textContent = "You currently have 0 requests.";

  // Insert right after the header
  head.insertAdjacentElement("afterend", el);
  return el;
}

/* ---------- controls ---------- */
function readControls() {
  return {
    status: statusFilter?.value || "pending",
    sort: sortBy?.value || "newest",
    search: (searchInput?.value || "").trim().toLowerCase(),
  };
}

/* ---------- render: events ---------- */
function renderMyEvents() {
  if (!myEventsList) return;

  myEventsCount && (myEventsCount.textContent = `${myEvents.length} event${myEvents.length === 1 ? "" : "s"}`);

  if (myEvents.length === 0) {
    myEventsList.innerHTML = "";
    if (myEventsEmpty) myEventsEmpty.style.display = "block";
    return;
  }
  if (myEventsEmpty) myEventsEmpty.style.display = "none";

  const sorted = [...myEvents].sort((a, b) => tsToMs(b.createdAt) - tsToMs(a.createdAt));

  myEventsList.innerHTML = sorted.map((ev) => {
    const title = escapeHtml(ev.title || "Untitled Event");
    const date = escapeHtml(ev.date || "");
    const time = escapeHtml(ev.time || "");
    const loc = escapeHtml(ev.location || "");
    const when = [date, time].filter(Boolean).join(" • ");

    return `
      <li class="dash-item">
        <div class="dash-item-main">
          <div class="dash-item-title">${title}</div>
          <div class="dash-item-meta muted">
            ${when ? `<span>${when}</span>` : ""}
            ${loc ? `<span>${loc}</span>` : ""}
          </div>
        </div>

        <div class="dash-item-actions">
          <a class="btn btn-secondary" href="event-details.html?id=${encodeURIComponent(ev.id)}">View</a>
          <button class="btn" data-action="delete-event" data-event="${escapeHtml(ev.id)}" type="button">Delete</button>
        </div>
      </li>
    `;
  }).join("");
}

/* ---------- render: requests ---------- */
function applyRequestFilters(list) {
  const { status, sort, search } = readControls();
  let out = [...list];

  if (status !== "all") {
    out = out.filter((r) => normStatus(r.status) === status);
  }

  if (search) {
    out = out.filter((r) => {
      const t = (r.eventTitle || "").toLowerCase();
      const vName = (r.volunteerName || "").toLowerCase();
      const vId = (r.volunteerId || "").toLowerCase();
      return t.includes(search) || vName.includes(search) || vId.includes(search);
    });
  }

  out.sort((a, b) => {
    const am = tsToMs(a.createdAt);
    const bm = tsToMs(b.createdAt);
    return sort === "oldest" ? am - bm : bm - am;
  });

  return out;
}

function renderRequests() {
  if (!requestsList) return;

  const zeroMsg = ensureZeroRequestsMsg();

  const filtered = applyRequestFilters(requests);

  // nicer counter
  resultsCount && (resultsCount.textContent = `${filtered.length} request${filtered.length === 1 ? "" : "s"}`);

  if (filtered.length === 0) {
    requestsList.innerHTML = "";
    if (zeroMsg) zeroMsg.style.display = "block";

    // Hide the big empty panel at the bottom
    if (emptyRequests) emptyRequests.style.display = "none";
    return;
  }

  if (zeroMsg) zeroMsg.style.display = "none";
  if (emptyRequests) emptyRequests.style.display = "none";

  requestsList.innerHTML = filtered.map((r) => {
    const st = normStatus(r.status);
    const title = escapeHtml(r.eventTitle || "Event");
    const meta = `${escapeHtml(r.eventDate || "")}${r.eventLocation ? " • " + escapeHtml(r.eventLocation) : ""}`;
    const volunteer = escapeHtml(r.volunteerName || r.volunteerId || "Volunteer");

    return `
      <li class="event-card">
        <div class="event-top">
          <div>
            <p class="event-title">${title}</p>
            <p class="event-meta">${meta}</p>
            <p class="muted" style="margin:.4rem 0 0;">
              Volunteer: <strong>${volunteer}</strong>
            </p>
          </div>
          <span class="${pillClass(st)}">${escapeHtml(st)}</span>
        </div>

        <div class="event-actions">
          <a class="btn btn-secondary" href="event-details.html?id=${escapeHtml(r.eventId || "")}">View Event</a>

          ${
            st === "pending"
              ? `
                <button class="btn btn-primary"
                        data-action="approve"
                        data-id="${escapeHtml(r.id)}"
                        data-event="${escapeHtml(r.eventId || "")}"
                        type="button">
                  Approve
                </button>
                <button class="btn btn-secondary"
                        data-action="reject"
                        data-id="${escapeHtml(r.id)}"
                        type="button">
                  Reject
                </button>
              `
              : `
                <button class="btn btn-primary requested" type="button" disabled>
                  ${escapeHtml(st)}
                </button>
              `
          }
        </div>
      </li>
    `;
  }).join("");
}

/* ---------- actions ---------- */
async function approveRequest(requestId, eventId) {
  await runTransaction(db, async (tx) => {
    const reqRef = doc(db, "joinRequests", requestId);
    const evtRef = doc(db, "events", eventId);

    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Request not found.");

    const req = reqSnap.data();
    if (normStatus(req.status) !== "pending") throw new Error("Request is no longer pending.");

    const evtSnap = await tx.get(evtRef);
    if (!evtSnap.exists()) throw new Error("Event not found.");

    const evt = evtSnap.data();
    const spots = Number(evt.spots || 0);
    const approvedCount = Number(evt.approvedCount || 0);

    if (spots > 0 && approvedCount >= spots) {
      throw new Error("Event is full. No spots left.");
    }

    tx.update(reqRef, { status: "approved" });
    tx.update(evtRef, { approvedCount: approvedCount + 1 });
  });
}

async function rejectRequest(requestId) {
  await updateDoc(doc(db, "joinRequests", requestId), { status: "rejected" });
}

async function deleteEventAndRequests(eventId) {
  const ev = myEvents.find((e) => e.id === eventId);
  const name = ev?.title || "this event";

  const ok = confirm(`Delete "${name}"? This will also delete all join requests for it.`);
  if (!ok) return;

  const batch = writeBatch(db);

  const rq = query(collection(db, "joinRequests"), where("eventId", "==", eventId));
  const rs = await getDocs(rq);
  rs.forEach((d) => batch.delete(d.ref));

  batch.delete(doc(db, "events", eventId));

  await batch.commit();
}

/* ---------- listeners ---------- */
function listenMyEvents(uid) {
  const q = query(collection(db, "events"), where("organizerId", "==", uid));

  return onSnapshot(q, (snap) => {
    myEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderMyEvents();

    // After events change, re-listen requests based on event ids
    listenRequestsForMyEvents(myEvents.map(e => e.id));
  }, (err) => {
    console.error("Events listener error:", err);
    if (myEventsList) {
      myEventsList.innerHTML = `
        <li class="event-card">
          <p class="event-title">⚠️ Error loading events</p>
          <p class="event-meta muted">${escapeHtml(err?.message || "")}</p>
        </li>
      `;
    }
    if (myEventsEmpty) myEventsEmpty.style.display = "none";
  });
}

// ✅ Key fix: listen to joinRequests by eventId (in chunks of 10)
function listenRequestsForMyEvents(eventIds) {
  // clear old listeners
  requestUnsubs.forEach((fn) => fn());
  requestUnsubs = [];

  // no events => no requests
  if (!eventIds || eventIds.length === 0) {
    requests = [];
    renderRequests();
    return;
  }

  const chunks = chunk(eventIds, 10);

  // Merge requests from multiple chunk listeners
  const all = new Map();

  chunks.forEach((ids) => {
    const rq = query(collection(db, "joinRequests"), where("eventId", "in", ids));

    const unsub = onSnapshot(rq, async (snap) => {
      // Remove any requests from this chunk that no longer exist
      const currentChunkIds = new Set(snap.docs.map(d => d.id));
      for (const key of Array.from(all.keys())) {
        // Only remove keys that belong to this chunk AND disappeared:
        // (we can detect by checking if stored eventId is in ids)
        const stored = all.get(key);
        if (stored && ids.includes(stored.eventId) && !currentChunkIds.has(key)) {
          all.delete(key);
        }
      }

      // Add/update current docs
      for (const d of snap.docs) {
        const r = { id: d.id, ...d.data() };
        r.volunteerName = await getUserName(r.volunteerId, userNameCache);
        all.set(d.id, r);
      }

      requests = Array.from(all.values());
      renderRequests();
    }, (err) => {
      console.error("Requests listener error:", err);
      if (requestsList) {
        requestsList.innerHTML = `
          <li class="event-card">
            <p class="event-title">⚠️ Error loading requests</p>
            <p class="event-meta muted">${escapeHtml(err?.message || "")}</p>
          </li>
        `;
      }
      const zeroMsg = ensureZeroRequestsMsg();
      if (zeroMsg) zeroMsg.style.display = "none";
      if (emptyRequests) emptyRequests.style.display = "none";
    });

    requestUnsubs.push(unsub);
  });
}

/* ---------- UI events ---------- */
document.addEventListener("click", async (e) => {
  const btn = e.target?.closest?.("button[data-action]");
  if (!btn) return;

  try {
    const action = btn.dataset.action;

    if (action === "approve") {
      const requestId = btn.dataset.id;
      const eventId = btn.dataset.event;
      if (!requestId || !eventId) return;

      btn.disabled = true;
      btn.textContent = "Approving…";
      await approveRequest(requestId, eventId);
    }

    if (action === "reject") {
      const requestId = btn.dataset.id;
      if (!requestId) return;

      btn.disabled = true;
      btn.textContent = "Rejecting…";
      await rejectRequest(requestId);
    }

    if (action === "delete-event") {
      const eventId = btn.dataset.event;
      if (!eventId) return;

      btn.disabled = true;
      btn.textContent = "Deleting…";
      await deleteEventAndRequests(eventId);
    }
  } catch (err) {
    console.error(err);
    alert(err?.message || "Something went wrong.");
  }
});

[statusFilter, sortBy].forEach((el) => el?.addEventListener("change", () => renderRequests()));
searchInput?.addEventListener("input", () => renderRequests());
refreshBtn?.addEventListener("click", () => {
  renderMyEvents();
  renderRequests();
});

/* ---------- boot ---------- */
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  if (unsubEvents) unsubEvents();
  requestUnsubs.forEach((fn) => fn());
  requestUnsubs = [];

  unsubEvents = listenMyEvents(user.uid);

  // initial: show 0 requests message until data loads
  requests = [];
  renderRequests();
});