export interface Accreditation {
  id: string;
  artist: string;
  venue: string;
  concertDate: string;
  status: "pending" | "sent" | "accepted" | "refused" | "follow-up";
  emailThreadId?: string;
  contactEmail?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccreditationsData {
  accreditations: Accreditation[];
}
