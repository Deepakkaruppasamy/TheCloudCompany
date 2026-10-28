import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-container flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="glass p-12 max-w-md mx-auto">
        <div className="text-8xl font-display font-bold text-brand-400/30 mb-4">404</div>
        <h1 className="text-2xl font-display font-bold text-white mb-3">
          Page Not Found
        </h1>
        <p className="text-white/50 mb-8">
          This page doesn&apos;t exist or has been removed.
        </p>
        <Link href="/" className="btn btn-primary btn-md">
          Back to Marketplace
        </Link>
      </div>
    </div>
  );
}
