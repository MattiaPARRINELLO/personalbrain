export type PhotoShootStatus = "upcoming" | "done" | "on_pc" | "sorted" | "edited" | "exported" | "sent";

export interface PhotoShoot {
  id: string;
  title: string;
  date: string;
  client: string;
  status: PhotoShootStatus;
  galleryLink?: string;
  photosSent?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoShootsData {
  shoots: PhotoShoot[];
}
