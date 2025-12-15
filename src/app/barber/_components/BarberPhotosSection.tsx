"use client";

import { useEffect, useState, useTransition } from "react";
import { CldUploadButton } from "next-cloudinary";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X } from "lucide-react";

type BarberPhoto = {
  id: string;
  url: string;
  publicId: string | null;
  isApproved: boolean;
  createdAt: string;
};

type CloudinaryResult = {
  info?: {
    secure_url?: string;
    public_id?: string;
  } | string;
};

export function BarberPhotosSection() {
  const [photos, setPhotos] = useState<BarberPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const uploadPreset =
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? "lafade-default";

  useEffect(() => {
    let isMounted = true;

    async function fetchPhotos() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/barber/photos");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && Array.isArray(data.photos)) {
          setPhotos(data.photos);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPhotos();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleUpload(result: CloudinaryResult) {
    if (!result.info || typeof result.info === "string") return;

    const { secure_url, public_id } = result.info;
    if (!secure_url) return;

    startUploadTransition(async () => {
      const res = await fetch("/api/barber/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: secure_url,
          publicId: public_id,
        }),
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.photo) {
        setPhotos((prev) => [data.photo, ...prev]);
      }
    });
  }

  async function handleDelete(id: string) {
    try {
      setIsDeleting(id);
      const res = await fetch(`/api/barber/photos/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } finally {
      setIsDeleting(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Portfolio photos</CardTitle>
            <CardDescription>
              Show clients what your work looks like. These photos will power
              your public profile once we wire the gallery.
            </CardDescription>
          </div>
          <CldUploadButton
            uploadPreset={uploadPreset}
            signatureEndpoint="/api/sign-image"
            options={{ maxFiles: 1, folder: "lafade-barber" }}
            onSuccess={handleUpload}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-2xl text-sm font-medium transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-10 px-4 py-2 border border-zinc-200 hover:bg-zinc-50 active:shadow-inner ${isUploading ? "opacity-50 pointer-events-none cursor-not-allowed" : ""}`}
          >
            {isUploading ? "Uploading..." : "Upload photo"}
          </CldUploadButton>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-zinc-600">Loading photos...</p>
        ) : photos.length === 0 ? (
          <p className="text-sm text-zinc-600">
            You haven&apos;t added any photos yet. Upload your best cuts to build your portfolio.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="relative rounded-md overflow-hidden border"
              >
                <img
                  src={photo.url}
                  alt="Barber portfolio"
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  className="absolute top-1 right-1 inline-flex items-center justify-center rounded-full bg-black/60 text-white p-1 hover:bg-black"
                  disabled={isDeleting === photo.id}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

