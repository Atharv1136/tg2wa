"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

export function Navbar({ userEmail: initialEmail }: { userEmail?: string | null }) {
  const [email, setEmail] = useState<string | null>(initialEmail || null);

  useEffect(() => {
    if (initialEmail !== undefined) {
      setEmail(initialEmail);
      return;
    }
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.email) {
          setEmail(data.user.email);
        } else {
          setEmail(null);
        }
      })
      .catch(() => {});
  }, [initialEmail]);

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/75 dark:bg-slate-900/75 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-xl tracking-tight text-blue-600 dark:text-blue-400">
          TG2WA
        </Link>
        <div className="flex items-center gap-3 text-sm font-medium">
          {email ? (
            <>
              <Link href="/dashboard" className="text-slate-600 dark:text-slate-300 hover:text-blue-600">
                Dashboard
              </Link>
              <Link href="/onboarding" className="text-slate-600 dark:text-slate-300 hover:text-blue-600">
                Setup
              </Link>
              <Link href="/settings" className="text-slate-600 dark:text-slate-300 hover:text-blue-600">
                Settings
              </Link>
              <span className="text-xs bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300 max-w-[160px] truncate border border-slate-200 dark:border-slate-700">
                👤 {email}
              </span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/sign-in" })}
                className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium px-2.5 py-1 border border-rose-200 dark:border-rose-900 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
              >
                Sign out
              </button>
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
