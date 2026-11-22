"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/nav";

export default function SettingsPage() {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDisconnectTelegram = async () => {
    if (!confirm("Are you sure you want to disconnect Telegram? Forwarding will stop.")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/telegram/disconnect", { method: "POST" });
      router.push("/dashboard");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      alert("Please type DELETE to confirm");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (res.ok) {
        router.push("/");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="max-w-2xl w-full mx-auto px-4 py-8 flex-1">
        <h1 className="text-2xl font-bold tracking-tight mb-8">Account Settings</h1>

        {/* Telegram Management */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6">
          <h2 className="text-lg font-semibold mb-2">Telegram Connection</h2>
          <p className="text-sm text-slate-500 mb-4">
            Disconnect your Telegram MTProto session. This will stop message forwarding.
          </p>
          <button
            onClick={handleDisconnectTelegram}
            disabled={disconnecting}
            className="px-4 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl text-sm font-medium transition"
          >
            {disconnecting ? "Disconnecting..." : "Disconnect Telegram"}
          </button>
        </div>

        {/* Danger Zone: Delete Account */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-950 rounded-2xl shadow-sm">
          <h2 className="text-lg font-semibold text-rose-600 mb-2">Danger Zone</h2>
          <p className="text-sm text-slate-500 mb-4">
            Permanently delete your account, saved sessions, and all delivery logs. This action cannot be undone.
          </p>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Type DELETE to confirm"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm"
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirm !== "DELETE"}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition"
            >
              {deleting ? "Deleting..." : "Permanently Delete Account"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
