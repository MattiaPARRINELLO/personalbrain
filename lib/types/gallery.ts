export type GalleryStatus = "shooted" | "selecting" | "editing" | "delivered";

export interface GalleryItem {
  id: string;
  concertId: string;
  title: string;
  totalPhotos: number;
  selectedPhotos: number;
  editedPhotos: number;
  status: GalleryStatus;
  deliveredTo?: string;
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GalleryData {
  items: GalleryItem[];
}
