import Link from "next/link";

export function Navbar({ userEmail }: { userEmail?: string | null }) {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400">
          TG2WA
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium">
          {userEmail ? (
            <>
              <Link href="/dashboard" className="hover:text-blue-600">
                Dashboard
              </Link>
              <Link href="/settings" className="hover:text-blue-600">
                Settings
              </Link>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-500">
                {userEmail}
              </span>
            </>
          ) : (
            <>
              <Link href="/sign-in" className="hover:text-blue-600">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
