import type { Email, EmailsData } from "../types";
import { maybeBackup, mutateJson, readOrCreate, writeJsonAtomic } from "../storage-core";

const defaultEmails: EmailsData = {
  emails: [
    {
      id: "1",
      from: "Faustine",
      subject: "Shooting samedi",
      body: "Salut ! Est-ce que tu es dispo samedi apres-midi pour un shooting portrait ? On partirait vers 15h au jardin.",
      date: new Date(Date.now() - 86400000).toISOString(),
      unread: true,
    },
    {
      id: "2",
      from: "Billetterie",
      subject: "Tes billets pour Justice",
      body: "Ta commande pour Justice a l'Olympia est confirmee. Places numerotees, rang A.",
      date: new Date(Date.now() - 172800000).toISOString(),
      unread: false,
    },
  ],
};

export async function getEmails(): Promise<EmailsData> {
  return readOrCreate("emails.json", defaultEmails);
}

export async function saveEmails(data: EmailsData): Promise<void> {
  await maybeBackup("emails.json");
  return writeJsonAtomic("emails.json", data);
}

export async function markEmailRead(id: string): Promise<void> {
  await mutateJson<EmailsData>("emails.json", defaultEmails, (data) => {
    const email = data.emails.find((e) => e.id === id);
    if (!email) return null;
    email.unread = false;
  });
}

export async function searchEmails(query: string): Promise<Email[]> {
  const data = await getEmails();
  const q = query.toLowerCase();
  return data.emails.filter(
    (e) =>
      e.from.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
  );
}
