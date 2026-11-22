"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/nav";

interface GroupItem {
  id: string;
  title: string;
  type: "group" | "supergroup" | "channel";
  selected: boolean;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Telegram State
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [tgState, setTgState] = useState<"idle" | "code_sent" | "password_required" | "connected">("idle");
  const [demoHint, setDemoHint] = useState<string | null>(null);
  const [tgLoading, setTgLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Custom API ID/Hash inputs
  const [showCustomCreds, setShowCustomCreds] = useState(false);
  const [customApiId, setCustomApiId] = useState("");
  const [customApiHash, setCustomApiHash] = useState("");
  const [credsSaved, setCredsSaved] = useState(false);

  // Step 2: Groups State
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Step 3: Delivery Destination State
  const [deliveryMode, setDeliveryMode] = useState<"ntfy" | "whatsapp_personal" | "whatsapp_group">("ntfy");
  const [ntfyTopic, setNtfyTopic] = useState("");
  const [waProvider, setWaProvider] = useState<"textmebot" | "callmebot">("textmebot");
  const [waTargetType, setWaTargetType] = useState<"personal" | "group">("personal");
  const [waPhone, setWaPhone] = useState("");
  const [waApiKey, setWaApiKey] = useState("");
  const [waStatus, setWaStatus] = useState<"idle" | "pending_confirmation" | "verified">("idle");
  const [waLoading, setWaLoading] = useState(false);

  // Step 4: Settings State
  const [includeSenderName, setIncludeSenderName] = useState(true);

  // Load existing status on mount
  useEffect(() => {
    if (!ntfyTopic) {
      const rand = Math.random().toString(36).substring(2, 8);
      setNtfyTopic(`tg2wa-alerts-${rand}`);
    }
    const urlParams = new URLSearchParams(window.location.search);
    const paramStep = urlParams.get("step");
    if (paramStep) {
      const p = parseInt(paramStep, 10);
      if (p >= 1 && p <= 4) setStep(p as 1 | 2 | 3 | 4);
    }

    fetch("/api/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        if (data.telegram?.status === "connected") {
          setTgState("connected");
          if (!paramStep && step === 1) setStep(2);
        }
        if (data.whatsapp?.status === "verified") {
          setWaStatus("verified");
        }
      })
      .catch(() => {});
  }, []);

  // Fetch real groups from Telegram when reaching Step 2
  useEffect(() => {
    if (step === 2) {
      setGroupsLoading(true);
      fetch("/api/telegram/groups")
        .then((res) => (res.ok ? res.json() : { groups: [] }))
        .then((data) => {
          if (data.groups && data.groups.length > 0) {
            setGroups(data.groups);
          } else {
            // Default initial suggestions if no groups found yet
            setGroups([
              { id: "-1001000000001", title: "General Group", type: "group", selected: true },
              { id: "-1001000000002", title: "Announcements Channel", type: "channel", selected: true },
            ]);
          }
        })
        .finally(() => setGroupsLoading(false));
    }
  }, [step]);

  // Handlers for Telegram Login
  const handleSaveCredentials = async () => {
    if (!customApiId || !customApiHash) return;
    try {
      const res = await fetch("/api/telegram/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiId: customApiId, apiHash: customApiHash }),
      });
      if (res.ok) {
        setCredsSaved(true);
        setErrorMsg("");
      } else {
        const d = await res.json();
        setErrorMsg(d.error?.message || "Failed to save API credentials");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  const handleSendCode = async () => {
    setTgLoading(true);
    setErrorMsg("");
    setDemoHint(null);
    try {
      const res = await fetch("/api/telegram/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to send verification code");
      }
      setTgState("code_sent");
      if (data.isDemo && data.demoCode) {
        setDemoHint(data.demoCode);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setTgLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    setTgLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/telegram/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Invalid verification code");
      }
      if (data.status === "password_required") {
        setTgState("password_required");
      } else {
        setTgState("connected");
        setStep(2);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setTgLoading(false);
    }
  };

  const handleVerifyPassword = async () => {
    setTgLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/telegram/verify-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Incorrect 2FA password");
      }
      setTgState("connected");
      setStep(2);
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setTgLoading(false);
    }
  };

  // Handlers for Group Selection
  const handleSaveGroups = async () => {
    const selectedList = groups.filter((g) => g.selected);
    if (selectedList.length === 0) {
      setErrorMsg("Please select at least 1 group or channel to forward.");
      return;
    }

    try {
      await fetch("/api/telegram/groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chats: selectedList }),
      });
      setStep(3);
    } catch (e: any) {
      setErrorMsg("Failed to save selected groups");
    }
  };

  const selectAll = () => setGroups(groups.map((g) => ({ ...g, selected: true })));
  const clearAll = () => setGroups(groups.map((g) => ({ ...g, selected: false })));

  const filteredGroups = groups.filter((g) =>
    g.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers for Delivery Destination Verification
  const handleSaveAndTestWhatsApp = async () => {
    setErrorMsg("");

    let payload: { phone: string; apiKey: string; provider: string };

    if (deliveryMode === "ntfy") {
      const topic = (ntfyTopic || "").trim().replace(/^https?:\/\/ntfy\.sh\//, "").replace(/^\/+/, "");
      if (!topic || topic.length < 3) {
        setErrorMsg("Please enter a valid topic name (at least 3 characters)");
        return;
      }
      payload = { phone: topic, apiKey: "public", provider: "ntfy" };
    } else if (deliveryMode === "whatsapp_group") {
      if (waPhone.includes("chat.whatsapp.com")) {
        setErrorMsg(
          "WhatsApp Group invite links (chat.whatsapp.com) cannot be used directly by WhatsApp bots. Please provide your numeric WhatsApp Group ID ending in @g.us (format: 120363xxxxxx@g.us). Or switch to Mobile Push (ntfy.sh) above for instant free alerts!"
        );
        return;
      }
      if (!waPhone.trim().endsWith("@g.us")) {
        setErrorMsg(
          "WhatsApp Group IDs must end with @g.us (format: 120363xxxxxx@g.us). Or switch to Mobile Push (ntfy.sh) above for instant free alerts!"
        );
        return;
      }
      if (!waApiKey.trim()) {
        setErrorMsg("Please enter your TextMeBot API Key");
        return;
      }
      payload = { phone: waPhone.trim(), apiKey: waApiKey.trim(), provider: "textmebot" };
    } else {
      if (!waPhone.trim()) {
        setErrorMsg("Please enter your WhatsApp phone number");
        return;
      }
      if (!waApiKey.trim()) {
        setErrorMsg("Please enter your API Key");
        return;
      }
      payload = { phone: waPhone.trim(), apiKey: waApiKey.trim(), provider: waProvider };
    }

    setWaLoading(true);
    try {
      // 1. Save
      const saveRes = await fetch("/api/whatsapp/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error?.message || "Failed to save delivery destination");
      }

      // 2. Test send
      const testRes = await fetch("/api/whatsapp/test", { method: "POST" });
      const testData = await testRes.json();
      if (!testRes.ok) {
        throw new Error(testData.error?.message || "Delivery gateway failed to send test notification.");
      }

      setWaStatus("pending_confirmation");
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setWaLoading(false);
    }
  };

  const handleConfirmWhatsApp = async (received: boolean) => {
    setWaLoading(true);
    try {
      const res = await fetch("/api/whatsapp/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ received }),
      });
      const data = await res.json();
      if (data.status === "verified") {
        setWaStatus("verified");
        setStep(4);
      } else {
        setErrorMsg("Please double check that you completed CallMeBot activation on WhatsApp and try again.");
      }
    } finally {
      setWaLoading(false);
    }
  };

  // Step 4: Final Start
  const handleStartForwarding = async () => {
    try {
      const res = await fetch("/api/forwarding/start", { method: "POST" });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json();
        setErrorMsg(data.error?.message || "Preconditions not met. Please complete all steps.");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <Navbar />

      <main className="max-w-2xl w-full mx-auto px-4 py-12 flex-1">
        {/* Stepper Header (Clickable) */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
          {[
            { num: 1, label: "1. Telegram" },
            { num: 2, label: "2. Groups" },
            { num: 3, label: "3. WhatsApp" },
            { num: 4, label: "4. Finish" },
          ].map((s) => (
            <button
              type="button"
              key={s.num}
              onClick={() => {
                setStep(s.num as 1 | 2 | 3 | 4);
                setErrorMsg("");
              }}
              className="flex items-center gap-2 group cursor-pointer focus:outline-none"
            >
              <span
                className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition ${
                  step === s.num
                    ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-400/40"
                    : step > s.num
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-500 group-hover:bg-slate-300 dark:group-hover:bg-slate-700"
                }`}
              >
                {step > s.num ? "✓" : s.num}
              </span>
              <span
                className={`text-xs font-semibold transition ${
                  step === s.num
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-200"
                }`}
              >
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm">
            {errorMsg}
          </div>
        )}

        {/* STEP 1: Connect Telegram */}
        {step === 1 && (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-2">Step 1: Connect your Telegram</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Enter your mobile phone number registered on Telegram (in international format, e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-xs">+1234567890</code>).
            </p>

            {/* Optional Custom Telegram API Credentials */}
            <div className="mb-6 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
              <button
                type="button"
                onClick={() => setShowCustomCreds(!showCustomCreds)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between w-full"
              >
                <span>⚙️ Custom Telegram API Credentials (Optional)</span>
                <span>{showCustomCreds ? "▲ Hide" : "▼ Configure"}</span>
              </button>

              {showCustomCreds && (
                <div className="mt-3 space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
                  <p className="text-slate-500">
                    If you have your own <strong>API ID</strong> and <strong>API HASH</strong> from{" "}
                    <a href="https://my.telegram.org" target="_blank" rel="noreferrer" className="underline text-blue-600">
                      my.telegram.org
                    </a>
                    , enter them below. Otherwise, instant sandbox mode is used automatically.
                  </p>
                  <div>
                    <input
                      type="text"
                      placeholder="Telegram API ID (e.g. 1234567)"
                      value={customApiId}
                      onChange={(e) => setCustomApiId(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Telegram API Hash (e.g. 0123456789abcdef)"
                      value={customApiHash}
                      onChange={(e) => setCustomApiHash(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveCredentials}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                  >
                    Save Credentials
                  </button>
                  {credsSaved && <span className="ml-2 text-emerald-600 font-medium">✓ Credentials saved!</span>}
                </div>
              )}
            </div>

            {tgState === "idle" && (
              <div className="space-y-4">
                <input
                  type="tel"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                  ℹ️ <strong>Instant Setup:</strong> You can enter any phone number to test immediately, or use your real Telegram number.
                </div>
                <button
                  onClick={handleSendCode}
                  disabled={tgLoading || !phone}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition shadow-sm"
                >
                  {tgLoading ? "Requesting Login Code..." : "Send Verification Code"}
                </button>
              </div>
            )}

            {tgState === "code_sent" && (
              <div className="space-y-4">
                {demoHint && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-200 text-sm">
                    ✨ <strong>Instant Sandbox Active:</strong> Your verification code is{" "}
                    <code className="font-mono font-bold px-2 py-0.5 bg-emerald-200 dark:bg-emerald-800 rounded text-base">{demoHint}</code>
                  </div>
                )}
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  We sent a code to <strong className="text-slate-900 dark:text-slate-100">{phone}</strong>.
                </p>
                <input
                  type="text"
                  placeholder="Enter login code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-center tracking-widest text-lg font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleVerifyCode}
                    disabled={tgLoading || !code}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition"
                  >
                    {tgLoading ? "Verifying..." : "Verify Code"}
                  </button>
                  <button
                    onClick={() => setTgState("idle")}
                    className="px-4 py-3 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Change Phone
                  </button>
                </div>
              </div>
            )}

            {tgState === "password_required" && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Two-step verification is enabled on your Telegram account. Enter your cloud password:
                </p>
                <input
                  type="password"
                  placeholder="Your 2FA password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-500">
                  Your password is transmitted securely to Telegram and is never stored or logged anywhere.
                </p>
                <button
                  onClick={handleVerifyPassword}
                  disabled={tgLoading || !password}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition"
                >
                  {tgLoading ? "Authenticating..." : "Submit Password"}
                </button>
              </div>
            )}

            {tgState === "connected" && (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                  ✓
                </div>
                <h3 className="font-semibold text-lg">Telegram Connected</h3>
                <p className="text-sm text-slate-500 mb-6">Your Telegram session is verified and securely encrypted.</p>
                <button
                  onClick={() => setStep(2)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition"
                >
                  Continue to Groups Selection
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Pick Groups */}
        {step === 2 && (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-2">Step 2: Pick Telegram Groups</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Select which groups and channels you want forwarded to your WhatsApp.
            </p>

            {/* Filter & Selection Controls */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                type="text"
                placeholder="Search groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Select All
                </button>
                <button
                  onClick={clearAll}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Group List */}
            {groupsLoading ? (
              <div className="py-12 text-center text-sm text-slate-500">
                Loading your Telegram groups...
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500 border border-dashed rounded-xl">
                No groups found matching &ldquo;{searchQuery}&rdquo;.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto mb-6 pr-1">
                {filteredGroups.map((g) => (
                  <label
                    key={g.id}
                    className="flex items-center justify-between p-3.5 border border-slate-200 dark:border-slate-800 rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={g.selected}
                        onChange={(e) => {
                          setGroups(
                            groups.map((item) =>
                              item.id === g.id ? { ...item, selected: e.target.checked } : item
                            )
                          );
                        }}
                        className="rounded w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-medium text-sm text-slate-900 dark:text-slate-100">{g.title}</p>
                        <p className="text-xs text-slate-500 capitalize">{g.type}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-medium">
                {groups.filter((g) => g.selected).length} groups selected
              </span>
              <button
                onClick={handleSaveGroups}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition shadow-sm"
              >
                Continue to WhatsApp Setup
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Verify Delivery Destination */}
        {step === 3 && (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-2">Step 3: Choose Notification Destination</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Choose how you want to receive your forwarded Telegram messages on your phone.
            </p>

            {/* Delivery Destination Switcher */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setDeliveryMode("ntfy");
                  setErrorMsg("");
                }}
                className={`py-3 px-3 text-xs font-bold rounded-xl transition flex flex-col items-center gap-1 text-center ${
                  deliveryMode === "ntfy"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <span className="text-base">📱 Mobile Push (ntfy)</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">
                  ★ Easiest · 100% Free
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeliveryMode("whatsapp_personal");
                  setErrorMsg("");
                }}
                className={`py-3 px-3 text-xs font-bold rounded-xl transition flex flex-col items-center gap-1 text-center ${
                  deliveryMode === "whatsapp_personal"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <span className="text-base">👤 Personal WhatsApp</span>
                <span className="text-[10px] text-slate-500 font-normal">Direct 1-on-1 Bot</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDeliveryMode("whatsapp_group");
                  setErrorMsg("");
                }}
                className={`py-3 px-3 text-xs font-bold rounded-xl transition flex flex-col items-center gap-1 text-center ${
                  deliveryMode === "whatsapp_group"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-md ring-1 ring-blue-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                <span className="text-base">👥 WhatsApp Group</span>
                <span className="text-[10px] text-slate-500 font-normal">Requires @g.us ID</span>
              </button>
            </div>

            {/* NTFY PUSH NOTIFICATION MODE */}
            {deliveryMode === "ntfy" && waStatus === "idle" && (
              <div className="space-y-4">
                <div className="p-5 bg-gradient-to-br from-blue-50/80 to-indigo-50/50 dark:from-slate-800/80 dark:to-slate-900/50 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl text-xs text-slate-700 dark:text-slate-300 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      ⚡ 1-Minute Setup: Instant Lock-Screen Notifications
                    </p>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Zero Fees · No Group IDs
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Telegram alerts will pop up directly on your phone with sound and vibration—just like SMS or WhatsApp, with no carrier costs, no group ID headaches, and instant real-time throughput.
                  </p>

                  <ol className="list-decimal pl-4 space-y-2 text-xs">
                    <li>
                      Install the free <strong>ntfy</strong> app on your smartphone:
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <a
                          href="https://play.google.com/store/apps/details?id=io.heckel.ntfy"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm transition"
                        >
                          🤖 Google Play Store (Android)
                        </a>
                        <a
                          href="https://apps.apple.com/app/ntfy/id1625396347"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs shadow-sm transition"
                        >
                          🍎 Apple App Store (iOS)
                        </a>
                        <a
                          href={`https://ntfy.sh/${ntfyTopic}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-medium text-xs hover:underline"
                        >
                          🌐 Or View in Browser
                        </a>
                      </div>
                    </li>
                    <li>
                      Open the ntfy app, tap the <strong>&ldquo;+&rdquo;</strong> button (Subscribe to topic), and enter your topic name below.
                    </li>
                  </ol>

                  <div className="pt-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 block">
                      Your Notification Topic Name:
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={ntfyTopic}
                        onChange={(e) => setNtfyTopic(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                        placeholder="e.g. tg2wa-alerts-mysecret"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(ntfyTopic);
                          alert(`Copied "${ntfyTopic}"! In the ntfy app, tap "+" and paste it.`);
                        }}
                        className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      >
                        📋 Copy Topic
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Web link: <a href={`https://ntfy.sh/${ntfyTopic}`} target="_blank" rel="noreferrer" className="text-blue-600 underline">https://ntfy.sh/{ntfyTopic}</a>
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleSaveAndTestWhatsApp}
                  disabled={waLoading || !ntfyTopic}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition shadow-sm"
                >
                  {waLoading ? "Sending Test Push Notification..." : "Save & Send Test Push Notification 🔔"}
                </button>
              </div>
            )}

            {/* WHATSAPP PERSONAL MODE */}
            {deliveryMode === "whatsapp_personal" && waStatus === "idle" && (
              <div className="space-y-4">
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setWaProvider("textmebot");
                      setErrorMsg("");
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      waProvider === "textmebot"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    TextMeBot (QR Linked)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setWaProvider("callmebot");
                      setErrorMsg("");
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                      waProvider === "callmebot"
                        ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900"
                    }`}
                  >
                    CallMeBot (Direct Bot)
                  </button>
                </div>

                {waProvider === "textmebot" ? (
                  <div className="p-4 bg-slate-100/70 dark:bg-slate-800/50 rounded-xl text-xs text-slate-700 dark:text-slate-300 space-y-2 border border-slate-200 dark:border-slate-700">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      How to setup TextMeBot:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Visit <a href="https://textmebot.com" target="_blank" rel="noreferrer" className="underline text-blue-600">textmebot.com</a> and request your API Key.</li>
                      <li>Scan the QR code in WhatsApp &gt; Linked Devices.</li>
                      <li>Copy your API Key from your email and enter below.</li>
                    </ol>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-100/70 dark:bg-slate-800/50 rounded-xl text-xs text-slate-700 dark:text-slate-300 space-y-2 border border-slate-200 dark:border-slate-700">
                    <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                      Quick Activation via CallMeBot:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Add <strong className="font-mono text-blue-600">+34 623 78 64 49</strong> to WhatsApp contacts.</li>
                      <li>Send message: <code className="text-emerald-600 font-bold">I allow callmebot to send me messages</code></li>
                      <li>Enter your phone and received API Key below.</li>
                    </ol>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                    Your WhatsApp Phone Number (with Country Code)
                  </label>
                  <input
                    type="text"
                    placeholder="+919561706020"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                    {waProvider === "textmebot" ? "TextMeBot API Key" : "CallMeBot API Key"}
                  </label>
                  <input
                    type="password"
                    placeholder={waProvider === "textmebot" ? "Paste TextMeBot API Key" : "Enter CallMeBot API Key"}
                    value={waApiKey}
                    onChange={(e) => setWaApiKey(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={handleSaveAndTestWhatsApp}
                  disabled={waLoading || !waPhone || !waApiKey}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition shadow-sm"
                >
                  {waLoading ? "Sending Test Message..." : "Save & Send WhatsApp Test"}
                </button>
              </div>
            )}

            {/* WHATSAPP GROUP MODE */}
            {deliveryMode === "whatsapp_group" && waStatus === "idle" && (
              <div className="space-y-4">
                <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                  <p className="font-semibold text-blue-900 dark:text-blue-200">
                    How to get your WhatsApp Group ID (@g.us):
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px]">
                    <li>Ensure your TextMeBot linked phone is added to the group.</li>
                    <li>Open <a href="https://web.whatsapp.com" target="_blank" rel="noreferrer" className="underline font-semibold text-blue-600">web.whatsapp.com</a> and click on your group.</li>
                    <li>Right click the group chat &gt; <strong>Inspect</strong>. The Group ID looks like: <code>120363xxxxxx@g.us</code>.</li>
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                    TextMeBot API Key
                  </label>
                  <input
                    type="password"
                    placeholder="Paste your TextMeBot API Key"
                    value={waApiKey}
                    onChange={(e) => setWaApiKey(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <button
                  onClick={handleSaveAndTestWhatsApp}
                  disabled={waLoading || !waPhone || !waApiKey}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition shadow-sm"
                >
                  {waLoading ? "Sending Test Message to Group..." : "Save & Test WhatsApp Group"}
                </button>
              </div>
            )}

            {waStatus === "pending_confirmation" && (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-xl">
                  {deliveryMode === "ntfy" ? "🔔" : "📲"}
                </div>
                <h3 className="font-semibold text-lg">Did you receive the test alert?</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {deliveryMode === "ntfy"
                    ? `We dispatched a test push notification to topic "${ntfyTopic}". Check your phone screen or ntfy app!`
                    : "We dispatched a test notification to your WhatsApp. Please check your WhatsApp."}
                </p>
                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={() => handleConfirmWhatsApp(true)}
                    disabled={waLoading}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
                  >
                    Yes, I got it!
                  </button>
                  <button
                    onClick={() => handleConfirmWhatsApp(false)}
                    disabled={waLoading}
                    className="px-6 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    No, I did not
                  </button>
                </div>
              </div>
            )}

            {waStatus === "verified" && (
              <div className="text-center py-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
                  ✓
                </div>
                <h3 className="font-semibold text-lg">Destination Verified</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Your delivery destination is configured and active.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setWaStatus("idle");
                      setErrorMsg("");
                    }}
                    className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Change Destination
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
                  >
                    Continue to Finish →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Review and Start */}
        {step === 4 && (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-center">
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
              ✓
            </div>
            <h2 className="text-2xl font-bold mb-2">You&apos;re Ready to Go!</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
              Your Telegram account is connected, {groups.filter((g) => g.selected).length} groups are monitored, and your WhatsApp delivery path is verified.
            </p>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl mb-6 text-left max-w-sm mx-auto space-y-2">
              <label className="flex items-center gap-2.5 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSenderName}
                  onChange={(e) => setIncludeSenderName(e.target.checked)}
                  className="rounded"
                />
                <span>Include sender name in WhatsApp messages</span>
              </label>
            </div>

            <button
              onClick={handleStartForwarding}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3.5 rounded-xl shadow transition"
            >
              Start 24/7 Forwarding Now
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
