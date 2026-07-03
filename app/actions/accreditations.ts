"use server";

import { revalidatePath } from "next/cache";
import {
  getAccreditations,
  addAccreditation,
  updateAccreditation,
  deleteAccreditation,
  logActivity,
} from "@/lib/storage";
import type { Accreditation } from "@/lib/types";

export async function loadAccreditations() {
  return getAccreditations();
}

export async function createAccreditation(input: {
  artist: string;
  venue: string;
  concertDate: string;
  contactEmail?: string;
  notes?: string;
}): Promise<Accreditation> {
  if (!input.artist?.trim() || !input.venue?.trim() || !input.concertDate?.trim()) {
    throw new Error("Artiste, lieu et date du concert requis");
  }
  const acc = await addAccreditation(input);
  await logActivity("accreditation_created", `Accréditation : ${acc.artist} @ ${acc.venue}`, acc.concertDate);
  revalidatePath("/accreditations");
  return acc;
}

export async function editAccreditation(
  id: string,
  updates: Partial<Pick<Accreditation, "status" | "notes" | "contactEmail">>
): Promise<Accreditation | null> {
  const acc = await updateAccreditation(id, updates);
  if (acc) await logActivity("accreditation_updated", `Accréditation mise à jour : ${acc.artist}`, acc.status);
  revalidatePath("/accreditations");
  return acc;
}

export async function removeAccreditation(id: string): Promise<boolean> {
  const ok = await deleteAccreditation(id);
  if (ok) await logActivity("accreditation_deleted", "Accréditation supprimée", id);
  revalidatePath("/accreditations");
  return ok;
}
