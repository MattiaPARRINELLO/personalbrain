import { NextRequest, NextResponse } from "next/server";
import { getGallery, updateGalleryItem } from "@/lib/storage";

export async function GET() {
  const data = await getGallery();
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json() as { id: string; status?: string };
  if (!body.id) return NextResponse.json({ error: "ID requis" }, { status: 400 });
  const updated = await updateGalleryItem(body.id, { status: body.status as never });
  if (!updated) return NextResponse.json({ error: "Galerie introuvable" }, { status: 404 });
  return NextResponse.json(updated);
}
