"use client";
/**
 * src/components/image-upload.tsx
 *
 * Interactive image upload with drag-and-drop, client-side format & size validation,
 * immediate upload to Supabase Storage, and live preview.
 */
import { useState, useRef, useTransition } from "react";
import { uploadListingPhoto } from "@/actions/auctions";
import { IconCheck, IconX } from "./ui/icons";

interface ImageUploadProps {
  defaultPath?: string | null;
  onPhotoUploaded: (path: string | null) => void;
  disabled?: boolean;
}

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

export default function ImageUpload({
  defaultPath = null,
  onPhotoUploaded,
  disabled = false,
}: ImageUploadProps) {
  const [photoPath, setPhotoPath] = useState<string | null>(defaultPath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please select a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Image must be smaller than ${MAX_SIZE_MB} MB.`);
      return;
    }

    // Create immediate local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload to server storage
    const formData = new FormData();
    formData.append("photo", file);

    startTransition(async () => {
      const res = await uploadListingPhoto(formData);
      if (res.ok) {
        setPhotoPath(res.data);
        onPhotoUploaded(res.data);
      } else {
        setError(res.error || "Failed to upload image.");
        setPreviewUrl(null);
        setPhotoPath(null);
        onPhotoUploaded(null);
      }
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setPhotoPath(null);
    setError(null);
    onPhotoUploaded(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="label mb-0">Item Photo (Optional)</label>
        <span className="text-[11px] text-white/40">JPEG, PNG, WebP up to 5 MB</span>
      </div>

      {/* Hidden input storing the uploaded storage path for form submission */}
      <input type="hidden" name="photoPath" value={photoPath ?? ""} />

      {/* Preview or Upload Zone */}
      {previewUrl || photoPath ? (
        <div className="relative rounded-2xl overflow-hidden border border-brand-500/40 bg-black/40 aspect-video flex items-center justify-center group">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Item preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-white/70 p-6 text-center">
              <span className="text-4xl mb-2">📸</span>
              <p className="text-xs font-medium">Photo attached: {photoPath}</p>
            </div>
          )}

          {/* Upload progress indicator */}
          {isUploading && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
              <svg className="animate-spin h-6 w-6 text-brand-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <p className="text-xs font-semibold text-white">Uploading photo…</p>
            </div>
          )}

          {/* Remove button */}
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/70 text-white/80 hover:text-white hover:bg-red-600/80 border border-white/20 transition-all shadow-lg"
              title="Remove photo"
            >
              <IconX className="w-4 h-4" />
            </button>
          )}

          {!isUploading && photoPath && (
            <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-emerald-500/90 text-white text-[11px] font-semibold flex items-center gap-1 shadow-md">
              <IconCheck className="w-3.5 h-3.5" />
              <span>Uploaded</span>
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-white/15 hover:border-brand-400/50 hover:bg-white/[0.02] transition-all rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center cursor-pointer text-center group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            disabled={disabled || isUploading}
            className="hidden"
          />
          <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-2xl mb-3 group-hover:scale-105 transition-transform">
            📸
          </div>
          <p className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">
            Click to upload or drag & drop item photo
          </p>
          <p className="text-xs text-white/40 mt-1">
            High quality photos help students bid with confidence
          </p>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1 mt-1">
          <span>⚠️</span>
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

