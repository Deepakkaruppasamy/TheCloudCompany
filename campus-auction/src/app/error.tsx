"use client";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page-container flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="glass p-12 max-w-md mx-auto">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-display font-bold text-white mb-3">
          Something went wrong
        </h2>
        <p className="text-white/50 mb-8 text-sm">
          {error.message || "An unexpected error occurred."}
        </p>
        <button onClick={() => reset()} className="btn btn-primary btn-md">
          Try Again
        </button>
      </div>
    </div>
  );
}
