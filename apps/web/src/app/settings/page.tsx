"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/nav";

export default function SettingsPage() {
  const router = useRouter();
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // WhatsApp Destination State
  const [waCurrentPhone, setWaCurrentPhone] = useState<string | null>(null);
  const [waCurrentStatus, setWaCurrentStatus] = useState<string>("unverified");
  const [deliveryMode, setDeliveryMode] = useState<"ntfy" | "whatsapp_personal" | "whatsapp_group">("ntfy");
  const [ntfyTopic, setNtfyTopic] = useState("");
  const [waProvider, setWaProvider] = useState<"textmebot" | "callmebot">("textmebot");
  const [waTargetType, setWaTargetType] = useState<"personal" | "group">("personal");
  const [waPhone, setWaPhone] = useState("");
  const [waApiKey, setWaApiKey] = useState("");
  const [waLoading, setWaLoading] = useState(false);
  const [waPendingConfirm, setWaPendingConfirm] = useState(false);
  const [waMessage, setWaMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!ntfyTopic) {
      setNtfyTopic(`tg2wa-alerts-${Math.random().toString(36).substring(2, 8)}`);
    }
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.whatsapp?.phoneMasked) {
          setWaCurrentPhone(data.whatsapp.phoneMasked);
        }
        if (data.whatsapp?.status) {
          setWaCurrentStatus(data.whatsapp.status);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveAndTestWhatsApp = async () => {
    setWaMessage(null);

    let payload: { phone: string; apiKey: string; provider: string };

    if (deliveryMode === "ntfy") {
      const topic = (ntfyTopic || "").trim().replace(/^https?:\/\/ntfy\.sh\//, "").replace(/^\/+/, "");
      if (!topic || topic.length < 3) {
        setWaMessage({ type: "error", text: "Please enter a valid topic name (at least 3 characters)" });
        return;
      }
      payload = { phone: topic, apiKey: "public", provider: "ntfy" };
    } else if (deliveryMode === "whatsapp_group") {
      if (!waPhone || !waApiKey) return;
      if (waPhone.includes("chat.whatsapp.com")) {
        setWaMessage({
          type: "error",
          text: "WhatsApp Group invite links (chat.whatsapp.com) cannot be used directly by WhatsApp bots. Please provide your numeric WhatsApp Group ID ending in @g.us (format: 120363xxxxxx@g.us). Or switch to Mobile Push (ntfy.sh) above for instant free alerts!",
        });
        return;
      }
      if (!waPhone.trim().endsWith("@g.us")) {
        setWaMessage({
          type: "error",
          text: "WhatsApp Group IDs must end with @g.us (format: 120363xxxxxx@g.us). Or switch to Mobile Push (ntfy.sh) above for instant free alerts!",
        });
        return;
      }
      payload = { phone: waPhone.trim(), apiKey: waApiKey.trim(), provider: "textmebot" };
    } else {
      if (!waPhone || !waApiKey) return;
      payload = { phone: waPhone.trim(), apiKey: waApiKey.trim(), provider: waProvider };
    }

    setWaLoading(true);

    try {
      const saveRes = await fetch("/api/whatsapp/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error?.message || "Failed to save delivery destination");
      }

      const testRes = await fetch("/api/whatsapp/test", { method: "POST" });
      if (!testRes.ok) {
        const testData = await testRes.json();
        throw new Error(testData.error?.message || "Gateway failed to send test notification.");
      }

      setWaPendingConfirm(true);
      setWaMessage({
        type: "success",
        text: deliveryMode === "ntfy" ? "Test push notification sent! Check your phone screen." : "Test message sent to WhatsApp! Check your phone.",
      });
    } catch (err: any) {
      setWaMessage({ type: "error", text: err.message || "Failed to update delivery destination" });
    } finally {
      setWaLoading(false);
    }
  };

  const handleConfirmWhatsApp = async (received: boolean) => {
    setWaLoading(true);
    setWaMessage(null);

    try {
      const res = await fetch("/api/whatsapp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received }),
      });

      if (res.ok) {
        if (received) {
          setWaCurrentStatus("verified");
          setWaCurrentPhone(waPhone);
          setWaPendingConfirm(false);
          setWaPhone("");
          setWaApiKey("");
          setWaMessage({ type: "success", text: "WhatsApp number successfully verified and active for forwarding!" });
        } else {
          setWaPendingConfirm(false);
          setWaMessage({ type: "error", text: "Test not confirmed. Please verify your phone number and API key." });
        }
      }
    } catch {
      setWaMessage({ type: "error", text: "Failed to confirm WhatsApp" });
    } finally {
      setWaLoading(false);
    }
  };

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

        {/* WhatsApp Management */}
        <div id="whatsapp" className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm mb-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">WhatsApp Delivery Destination</h2>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                waCurrentStatus === "verified"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
              }`}
            >
              ● {waCurrentStatus === "verified" ? "Verified" : "Unverified"}
            </span>
          </div>

          <p className="text-sm text-slate-500 mb-4">
            Telegram messages will be delivered to this verified WhatsApp number.
          </p>

          {waCurrentPhone && (
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl mb-4 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 block">Current Destination:</span>
                <span className="text-sm font-semibold">{waCurrentPhone}</span>
              </div>
              <span className="text-xs text-emerald-600 font-medium">✓ Active</span>
            </div>
          )}

          {waMessage && (
            <div
              className={`p-3 rounded-xl mb-4 text-xs font-medium ${
                waMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-900"
              }`}
            >
              {waMessage.text}
            </div>
          )}

          {!waPendingConfirm ? (
            <div className="space-y-4 pt-2">
              {/* Destination Mode: ntfy vs Personal vs Group */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                  Delivery Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("ntfy")}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg transition ${
                      deliveryMode === "ntfy"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    📱 Mobile Push (ntfy)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode("whatsapp_personal")}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg transition ${
                      deliveryMode === "whatsapp_personal"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    👤 Personal WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeliveryMode("whatsapp_group");
                      setWaProvider("textmebot");
                    }}
                    className={`py-2 px-2 text-xs font-semibold rounded-lg transition ${
                      deliveryMode === "whatsapp_group"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    👥 WhatsApp Group
                  </button>
                </div>
              </div>

              {/* NTFY PUSH NOTIFICATION SETTINGS */}
              {deliveryMode === "ntfy" && (
                <div className="p-4 bg-gradient-to-br from-blue-50/70 to-indigo-50/40 dark:from-slate-800/60 dark:to-slate-900/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs space-y-2 text-slate-700 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-blue-900 dark:text-blue-200 text-xs">
                      ⚡ Instant Free Push Notifications (ntfy.sh):
                    </p>
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">100% Free</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Install <strong>ntfy</strong> on Android or iOS, tap <strong>&ldquo;+&rdquo;</strong>, and enter your topic name below.
                  </p>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase block mb-1">
                      Topic Name
                    </label>
                    <input
                      type="text"
                      value={ntfyTopic}
                      onChange={(e) => setNtfyTopic(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder="e.g. tg2wa-alerts-myname"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAndTestWhatsApp}
                    disabled={waLoading || !ntfyTopic}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-xl text-xs transition shadow-sm mt-2"
                  >
                    {waLoading ? "Sending Test Push..." : "Save & Send Push Alert 🔔"}
                  </button>
                </div>
              )}

              {/* WHATSAPP PERSONAL */}
              {deliveryMode === "whatsapp_personal" && (
                <div className="space-y-3">
                  <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-2">
                    <button
                      type="button"
                      onClick={() => setWaProvider("textmebot")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                        waProvider === "textmebot"
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      TextMeBot (QR Linked)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWaProvider("callmebot")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition ${
                        waProvider === "callmebot"
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      CallMeBot (Direct Bot)
                    </button>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                      New WhatsApp Phone Number (with Country Code)
                    </label>
                    <input
                      type="text"
                      placeholder="+919561706020"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                      {waProvider === "textmebot" ? "TextMeBot API Key" : "CallMeBot API Key"}
                    </label>
                    <input
                      type="password"
                      placeholder="Paste your API Key"
                      value={waApiKey}
                      onChange={(e) => setWaApiKey(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAndTestWhatsApp}
                    disabled={waLoading || !waPhone || !waApiKey}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition shadow-sm"
                  >
                    {waLoading ? "Sending Test Message..." : "Save & Test WhatsApp"}
                  </button>
                </div>
              )}

              {/* WHATSAPP GROUP */}
              {deliveryMode === "whatsapp_group" && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs space-y-1 text-slate-700 dark:text-slate-300">
                    <p className="font-semibold text-blue-900 dark:text-blue-200">
                      How to get your WhatsApp Group ID (@g.us):
                    </p>
                    <ol className="list-decimal pl-4 space-y-0.5 text-[11px]">
                      <li>Ensure your TextMeBot linked phone number is an active member in the group.</li>
                      <li>Open <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer" className="underline font-semibold text-blue-600 dark:text-blue-400">web.whatsapp.com</a> and click on your group.</li>
                      <li>Right click the group name &gt; <strong>Inspect</strong>. The Group ID is <code>120363xxxxxx@g.us</code>.</li>
                    </ol>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                      WhatsApp Group ID (format: 120363xxxxxx@g.us)
                    </label>
                    <input
                      type="text"
                      placeholder="120363040377656518@g.us"
                      value={waPhone}
                      onChange={(e) => setWaPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                      TextMeBot API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Paste your API Key"
                      value={waApiKey}
                      onChange={(e) => setWaApiKey(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveAndTestWhatsApp}
                    disabled={waLoading || !waPhone || !waApiKey}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-sm transition shadow-sm"
                  >
                    {waLoading ? "Sending Test Message..." : "Save & Test WhatsApp Group"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900/60 text-center space-y-3">
              <p className="text-sm font-semibold">
                {deliveryMode === "ntfy" ? "Did you receive the test alert on your phone?" : "Did you receive the test message on WhatsApp?"}
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => handleConfirmWhatsApp(true)}
                  disabled={waLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-medium transition"
                >
                  Yes, Got It
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmWhatsApp(false)}
                  disabled={waLoading}
                  className="px-5 py-2 border border-slate-300 rounded-xl text-xs font-medium transition hover:bg-slate-100"
                >
                  No, Try Again
                </button>
              </div>
            </div>
          )}
        </div>

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
