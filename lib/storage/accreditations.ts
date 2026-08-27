import type { Accreditation, AccreditationsData } from "../types";
import { maybeBackup, mutateJson, newId, readOrCreate, writeJsonAtomic } from "../storage-core";

const defaultAccreditations: AccreditationsData = { accreditations: [] };

export async function getAccreditations(): Promise<AccreditationsData> {
  return readOrCreate("accreditations.json", defaultAccreditations);
}

export async function saveAccreditations(data: AccreditationsData): Promise<void> {
  await maybeBackup("accreditations.json");
  return writeJsonAtomic("accreditations.json", data);
}

export async function addAccreditation(input: {
  artist: string;
  venue: string;
  concertDate: string;
  contactEmail?: string;
  notes?: string;
}): Promise<Accreditation> {
  const now = new Date().toISOString();
  const accreditation: Accreditation = {
    id: newId(),
    artist: input.artist,
    venue: input.venue,
    concertDate: input.concertDate,
    status: "pending",
    contactEmail: input.contactEmail,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };
  await mutateJson<AccreditationsData>("accreditations.json", defaultAccreditations, (data) => {
    data.accreditations.unshift(accreditation);
  });
  return accreditation;
}

export async function updateAccreditation(
  id: string,
  updates: Partial<Pick<Accreditation, "status" | "notes" | "contactEmail">>
): Promise<Accreditation | null> {
  let updated: Accreditation | null = null;
  await mutateJson<AccreditationsData>("accreditations.json", defaultAccreditations, (data) => {
    const idx = data.accreditations.findIndex((a) => a.id === id);
    if (idx < 0) return null;
    data.accreditations[idx] = { ...data.accreditations[idx], ...updates, updatedAt: new Date().toISOString() };
    updated = data.accreditations[idx];
  });
  return updated;
}

export async function deleteAccreditation(id: string): Promise<boolean> {
  let deleted = false;
  await mutateJson<AccreditationsData>("accreditations.json", defaultAccreditations, (data) => {
    const before = data.accreditations.length;
    data.accreditations = data.accreditations.filter((a) => a.id !== id);
    deleted = data.accreditations.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}

export async function searchAccreditations(query: string): Promise<Accreditation[]> {
  const data = await getAccreditations();
  const q = query.toLowerCase();
  return data.accreditations.filter(
    (a) =>
      a.artist.toLowerCase().includes(q) ||
      a.venue.toLowerCase().includes(q) ||
      (a.notes && a.notes.toLowerCase().includes(q))
  );
}
