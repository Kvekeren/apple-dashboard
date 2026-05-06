import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <main className="flex flex-col items-center gap-8 px-6 py-24">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          SEO News Monitor
        </h1>
        <p className="max-w-md text-center text-slate-600">
          Centraal dashboard voor de Google News sitemaps van iCreate,
          Gardeners&apos; World, Historisch Nieuwsblad en Auto Review.
        </p>
        <Link
          href="/monitoring"
          className="rounded-lg bg-slate-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          Naar Monitoring Dashboard
        </Link>
      </main>
    </div>
  );
}
