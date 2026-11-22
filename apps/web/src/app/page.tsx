import Link from "next/link";
import { Navbar } from "@/components/nav";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 md:py-28 px-4 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-6">
            <span>✨ 24/7 Always-On Worker · Free & Open</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
            Never miss a Telegram message again.
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            Forward text from your Telegram groups straight to your own WhatsApp. Runs 24/7 in the background, even when this tab is closed.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-3 rounded-xl shadow-sm hover:shadow transition"
            >
              Get started
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto px-6 py-3 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl font-medium transition"
            >
              How it works
            </a>
          </div>
        </section>

        {/* How It Works (3 Steps) */}
        <section id="how-it-works" className="py-16 bg-slate-100/50 dark:bg-slate-900/50 border-y border-slate-200 dark:border-slate-800">
          <div className="max-w-5xl mx-auto px-4">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How it works in 3 steps</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center mb-4">
                  1
                </div>
                <h3 className="font-semibold text-lg mb-2">Connect Telegram</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Enter your phone and verification code. Your session is encrypted with AES-256-GCM.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center mb-4">
                  2
                </div>
                <h3 className="font-semibold text-lg mb-2">Pick Groups</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Select which groups, channels, or communities you want forwarded.
                </p>
              </div>

              <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center mb-4">
                  3
                </div>
                <h3 className="font-semibold text-lg mb-2">Verify WhatsApp</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Enter your CallMeBot API key, verify receipt of a test message, and start forwarding.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why it's different & Privacy */}
        <section className="py-16 max-w-4xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">Why TG2WA?</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl">
              <h4 className="font-semibold mb-1">⚡ Always On</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Runs on a dedicated background worker. Close your browser, shut your laptop — messages keep flowing.
              </p>
            </div>
            <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl">
              <h4 className="font-semibold mb-1">🔒 Zero Message Storage</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                We never store or log message text. Messages pass through worker memory directly to WhatsApp.
              </p>
            </div>
            <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl">
              <h4 className="font-semibold mb-1">🚫 No WhatsApp Business API</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No Facebook business verification, no expensive template fees. Uses free CallMeBot gateway.
              </p>
            </div>
            <div className="p-5 border border-slate-200 dark:border-slate-800 rounded-xl">
              <h4 className="font-semibold mb-1">🎯 Text-Only & Your Number Only</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Designed for personal alerts and notes. Only forwards to your own verified WhatsApp phone.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 py-8 text-center text-xs text-slate-500">
        <p>TG2WA · Powered by NeonDB & GramJS · Open Architecture</p>
      </footer>
    </div>
  );
}
