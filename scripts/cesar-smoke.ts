// Validation manuelle : sync réelle via le client du projet.
import { fetchCesarSchedule } from "../lib/cesar-client";

const courses = await fetchCesarSchedule();
console.log("seances:", courses.length);
const first = courses[0];
const last = courses[courses.length - 1];
console.log("premiere:", first.subject, new Date(first.start).toISOString(), first.room);
console.log("derniere:", last.subject, new Date(last.start).toISOString());
const today = new Date();
const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const todays = courses.filter((c) => {
  const d = new Date(c.start);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === todayIso;
});
console.log(`cours aujourd'hui (${todayIso}):`, todays.length, todays.map((c) => `${c.subject}@${new Date(c.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} ${c.room}`).join(" | "));
