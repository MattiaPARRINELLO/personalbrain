import { redirect } from "next/navigation";

// La galerie de livraison est intégrée à la page Photos (vue « Livraison »).
// Cette route est conservée pour les liens existants et redirige.
export default function GalleryPage() {
  redirect("/photos");
}
