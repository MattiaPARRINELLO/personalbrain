"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getAccreditations,
  addAccreditation,
  updateAccreditation,
  deleteAccreditation,
  logActivity,
} from "@/lib/storage";
import type { Accreditation } from "@/lib/types";

const createAccreditationSchema = z.object({
  artist: z.string().trim().min(1, "Artiste requis"),
  venue: z.string().trim().min(1, "Lieu requis"),
  concertDate: z.string().trim().min(1, "Date du concert requise"),
  contactEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  notes: z.string().trim().optional(),
});

const accreditationStatusSchema = z.enum(["pending", "sent", "accepted", "refused", "follow-up"]);

const updateAccreditationSchema = z
  .object({
    status: accreditationStatusSchema.optional(),
    notes: z.string().trim().optional(),
    contactEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  })
  .strict();

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
  const parsed = createAccreditationSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const data = parsed.data;
  const acc = await addAccreditation({
    ...data,
    contactEmail: data.contactEmail ? data.contactEmail : undefined,
  });
  await logActivity("accreditation_created", `Accréditation : ${acc.artist} @ ${acc.venue}`, acc.concertDate);
  revalidatePath("/photos");
  return acc;
}

export async function editAccreditation(
  id: string,
  updates: Partial<Pick<Accreditation, "status" | "notes" | "contactEmail">>
): Promise<Accreditation | null> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const parsed = updateAccreditationSchema.safeParse(updates);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Payload invalide");
  }
  const data = parsed.data;
  const acc = await updateAccreditation(id, {
    ...data,
    contactEmail: data.contactEmail ? data.contactEmail : undefined,
  });
  if (acc) await logActivity("accreditation_updated", `Accréditation mise à jour : ${acc.artist}`, acc.status);
  revalidatePath("/photos");
  return acc;
}

export async function removeAccreditation(id: string): Promise<boolean> {
  if (!id || typeof id !== "string") throw new Error("Identifiant requis");
  const ok = await deleteAccreditation(id);
  if (ok) await logActivity("accreditation_deleted", "Accréditation supprimée", id);
  revalidatePath("/photos");
  return ok;
}

export async function scanAccreditationsAction(): Promise<{ message: string; created: number; updated: number }> {
  const { fetchGmailMessages } = await import("@/lib/google-actions");
  const messages = await fetchGmailMessages("accréditation OR photo pass OR press OR accredit", 20);

  let created = 0;
  let updated = 0;
  const existing = await getAccreditations();
  const existingKeys = new Set(
    existing.accreditations.map((a) => `${a.artist}|${a.venue}`.toLowerCase())
  );

  for (const msg of messages) {
    const subj = msg.subject ?? "";
    const from = msg.from ?? "";
    const body = msg.snippet ?? "";
    const text = `${subj} ${body}`.toLowerCase();

    const artistMatch = text.match(/(?:pour|concert de|show de|photo de)\s+([a-zàâçéèêëîïôûùüÿñæœ-]+(?:\s+[a-zàâçéèêëîïôûùüÿñæœ-]+){0,2})/i);
    const venueMatch = text.match(/(?:au|à|chez)\s+([a-zàâçéèêëîïôûùüÿñæœ-]+(?:\s+[a-zàâçéèêëîïôûùüÿñæœ-]+){0,2})/i);
    const dateMatch = text.match(/(\d{1,2})[\/\s](janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|\d{1,2})[\/\s](\d{4}|\d{2})/i);

    const artist = artistMatch ? artistMatch[1].trim() : "";
    const venue = venueMatch ? venueMatch[1].trim() : "";
    const concertDate = dateMatch ? dateMatch[0].trim() : "";
    if (!artist) continue;

    let status: Accreditation["status"] = "pending";
    if (text.includes("accepté") || text.includes("confirme") || text.includes("approved")) {
      status = "accepted";
    } else if (text.includes("refusé") || text.includes("decliné") || text.includes("denied")) {
      status = "refused";
    } else if (text.includes("envoyé") || text.includes("sent") || text.includes("demande")) {
      status = "sent";
    }

    const key = `${artist}|${venue || "inconnu"}`.toLowerCase();
    if (existingKeys.has(key)) {
      const idx = existing.accreditations.findIndex(
        (a) => `${a.artist}|${a.venue}`.toLowerCase() === key
      );
      if (idx >= 0 && existing.accreditations[idx].status !== status) {
        existing.accreditations[idx].status = status;
        existing.accreditations[idx].updatedAt = new Date().toISOString();
        updated++;
      }
    } else {
      const newAcc = await addAccreditation({
        artist,
        venue: venue || "Inconnu",
        concertDate: concertDate || "Date inconnue",
        contactEmail: from,
      });
      if (status !== "pending") {
        await updateAccreditation(newAcc.id, { status, notes: `Email: ${msg.id}` });
      }
      created++;
      existingKeys.add(key);
    }
  }

  if (updated > 0) {
    const { saveAccreditations } = await import("@/lib/storage");
    await saveAccreditations(existing);
  }

  revalidatePath("/photos");
  return { message: `${created} créée(s), ${updated} mise(s) à jour`, created, updated };
}

export async function generateFollowUpDraft(accreditationId: string): Promise<string> {
  const existing = await getAccreditations();
  const acc = existing.accreditations.find((a) => a.id === accreditationId);
  if (!acc) throw new Error("Accréditation introuvable");

  const { chatCompletion } = await import("@/lib/ai-providers");
  const { getModel } = await import("@/lib/config");
  const { primary: model } = await getModel("general");

  const prompt = `Rédige un email de relance poli et professionnel en français pour une demande d'accréditation photo.

Contexte :
- Photographe : Mattia
- Artiste : ${acc.artist}
- Lieu : ${acc.venue}
- Date du concert : ${acc.concertDate}
- Statut actuel : ${acc.status}
${acc.contactEmail ? `- Contact : ${acc.contactEmail}` : ""}
- La demande a été envoyée il y a plusieurs jours sans réponse.

L'email doit être :
- Poli et respectueux
- Professionnel
- Court (max 150 mots)
- Signé "Mattia"

Retourne UNIQUEMENT le corps de l'email, sans objet.`;

  const result = await chatCompletion(
    model,
    [
      { role: "system", content: "Tu es un assistant qui aide à rédiger des emails professionnels en français." },
      { role: "user", content: prompt },
    ],
    []
  );

  return result.content ?? "Désolé, je n'ai pas pu générer le brouillon.";
}
