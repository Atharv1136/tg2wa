"use client";

import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentSessionEmail, setCurrentSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.email) {
          setCurrentSessionEmail(data.user.email);
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Failed to sign in");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-md w-full p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <Link href="/" className="inline-block text-xl font-bold text-blue-600 mb-6">
          TG2WA
        </Link>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Welcome Back</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          Sign in to your account to monitor Telegram groups and forwarding.
        </p>

        {currentSessionEmail && (
          <div className="p-3 mb-6 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-xs text-slate-700 dark:text-slate-300 flex items-center justify-between">
            <div>
              <span className="text-slate-500 block">Currently active session:</span>
              <strong className="text-blue-600 dark:text-blue-400">{currentSessionEmail}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                signOut({ redirect: false }).then(() => {
                  setCurrentSessionEmail(null);
                  setEmail("");
                  setPassword("");
                });
              }}
              className="px-2.5 py-1 text-xs border border-rose-300 text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition font-medium"
            >
              Sign Out
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition shadow-sm"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">
            Get started
          </Link>
        </p>
      </div>
    </div>
  );
}
