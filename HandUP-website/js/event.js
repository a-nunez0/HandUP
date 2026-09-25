// js/event.js
import { db, auth } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function createEvent(eventData) {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be logged in to create an event.");

  const payload = {
    title: eventData.title,
    category: eventData.category,
    location: eventData.location,     // free text (ex: "Logan, UT")
    date: eventData.date,             // "YYYY-MM-DD"
    time: eventData.time || "",       // "HH:MM"
    spots: Number(eventData.spots) || 0,
    description: eventData.description || "",

    contactName: eventData.contactName || "",
    contactEmail: eventData.contactEmail || "",

    organizerId: user.uid,
    organizerName: eventData.organizerName || "",

    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "events"), payload);
  return ref.id;
}

export async function getAllEvents() {
  const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getEventById(eventId) {
  const snap = await getDoc(doc(db, "events", eventId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
