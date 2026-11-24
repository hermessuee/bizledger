'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white p-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-6xl font-extrabold text-blue-500">404</h1>
        <h2 className="text-xl font-bold">Page Not Found</h2>
        <p className="text-xs text-slate-400">
          The requested page does not exist or has been moved.
        </p>
        <div>
          <Link
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
