"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/nav";

interface StatusData {
  telegram: {
    status: string;
    displayName?: string;
    username?: string;
    phoneMasked?: string;
    lastError?: string;
  };
  whatsapp: {
    status: string;
    phoneMasked?: string;
    verifiedAt?: string;
    lastError?: string;
  };
  forwarding: {
    status: string;
    enabled: boolean;
  };
  worker: {
    state: string;
    lastSeenAt?: string;
  };
  counters: {
    sentToday: number;
    failedToday: number;
    lastSentAt?: string;
  };
}

interface LogItem {
  id: string;
  time: string;
  groupTitle: string;
  status: string;
  error?: string;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchStatusAndLogs = async () => {
    try {
      const [resStatus, resLogs] = await Promise.all([
        fetch("/api/status"),
        fetch("/api/logs"),
      ]);

      if (resStatus.ok) {
        setStatus(await resStatus.json());
      }
      if (resLogs.ok) {
        const data = await resLogs.json();
        setLogs(data.items || []);
      }
    } catch (e) {
      console.error("Failed to load dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndLogs();
    const interval = setInterval(fetchStatusAndLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleForwarding = async () => {
    if (!status) return;
    setToggling(true);
    const endpoint = status.forwarding.enabled ? "/api/forwarding/stop" : "/api/forwarding/start";

    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        await fetchStatusAndLogs();
      } else {
        const err = await res.json();
        alert(err.error?.message || "Failed to toggle forwarding");
      }
    } finally {
      setToggling(false);
    }
  };

  const getStatusBadge = (value: string) => {
    switch (value) {
      case "connected":
      case "verified":
      case "running":
      case "online":
      case "sent":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">● {value}</span>;
      case "pending":
      case "degraded":
      case "code_sent":
      case "password_required":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">● {value}</span>;
      case "failed":
      case "session_expired":
      case "offline":
      case "error":
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">● {value}</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">● {value}</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1">
        {/* Header Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Forwarding Dashboard</h1>
            <p className="text-sm text-slate-500">Live 24/7 status overview and activity monitor.</p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/onboarding"
              className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-900 transition"
            >
              Setup Wizard
            </Link>
            <button
              onClick={handleToggleForwarding}
              disabled={toggling || loading}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition ${
                status?.forwarding.enabled
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {status?.forwarding.enabled ? "Stop Forwarding" : "Start Forwarding"}
            </button>
          </div>
        </div>

        {/* Status Cards (2x2) */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Telegram Card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Telegram</span>
              {getStatusBadge(status?.telegram.status || "not_connected")}
            </div>
            <p className="font-semibold text-base truncate">
              {status?.telegram.displayName || status?.telegram.phoneMasked || "Not Connected"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {status?.telegram.username ? `@${status.telegram.username}` : "MTProto Connection"}
            </p>
          </div>

          {/* WhatsApp Card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">WhatsApp (CallMeBot)</span>
              {getStatusBadge(status?.whatsapp.status || "unverified")}
            </div>
            <p className="font-semibold text-base">
              {status?.whatsapp.phoneMasked || "Not Configured"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {status?.whatsapp.verifiedAt ? "Delivery Path Verified" : "Verification Required"}
            </p>
          </div>

          {/* Forwarding State */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Forwarding Engine</span>
              {getStatusBadge(status?.forwarding.status || "stopped")}
            </div>
            <p className="font-semibold text-base">
              {status?.forwarding.enabled ? "Active & Listening" : "Paused"}
            </p>
            <p className="text-xs text-slate-500 mt-1">Deduplication enabled</p>
          </div>

          {/* Worker Service */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">Background Worker</span>
              {getStatusBadge(status?.worker.state || "offline")}
            </div>
            <p className="font-semibold text-base capitalize">{status?.worker.state || "Checking..."}</p>
            <p className="text-xs text-slate-500 mt-1">
              {status?.worker.lastSeenAt ? "Heartbeat Active" : "No recent heartbeat"}
            </p>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-8">
          <div>
            <span className="text-xs font-medium text-slate-500">Forwarded Today</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{status?.counters.sentToday || 0}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Failed Deliveries</span>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{status?.counters.failedToday || 0}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500">Last Message Sent</span>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
              {status?.counters.lastSentAt ? new Date(status.counters.lastSentAt).toLocaleTimeString() : "None yet"}
            </p>
          </div>
        </div>

        {/* Activity Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-base">Recent Delivery Activity</h2>
              <p className="text-xs text-slate-500">Metadata only. Message contents are never stored.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-6 py-3">Time</th>
                  <th className="px-6 py-3">Source Group</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 text-sm">
                      No delivery activity recorded yet. Forwarded messages will appear here.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {new Date(log.time).toLocaleTimeString()}
                      </td>
                      <td className="px-6 py-4 font-medium">{log.groupTitle}</td>
                      <td className="px-6 py-4">{getStatusBadge(log.status)}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{log.error || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
