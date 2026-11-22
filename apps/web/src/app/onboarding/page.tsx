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

  // Step 3: WhatsApp State
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

  // Handlers for WhatsApp Verification
  const handleSaveAndTestWhatsApp = async () => {
    setWaLoading(true);
    setErrorMsg("");
    try {
      // 1. Save
      const saveRes = await fetch("/api/whatsapp/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: waPhone, apiKey: waApiKey, provider: waProvider }),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error?.message || "Failed to save WhatsApp number");
      }

      // 2. Test send
      const testRes = await fetch("/api/whatsapp/test", { method: "POST" });
      const testData = await testRes.json();
      if (!testRes.ok) {
        throw new Error(testData.error?.message || "WhatsApp gateway failed to send test message. Check your API key and phone number.");
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

        {/* STEP 3: Verify WhatsApp */}
        {step === 3 && (
          <div className="p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold mb-2">Step 3: Connect your WhatsApp</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              Choose your WhatsApp gateway provider to deliver Telegram messages straight to your personal WhatsApp without complex Meta business verification.
            </p>

            {/* Provider Tabs */}
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setWaProvider("textmebot");
                  setErrorMsg("");
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  waProvider === "textmebot"
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                TextMeBot (QR / Linked Device)
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
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                CallMeBot (Direct WhatsApp Bot)
              </button>
            </div>

            {/* Step-by-step Instructions based on selected provider */}
            {waProvider === "textmebot" ? (
              <div className="p-4 bg-slate-100/70 dark:bg-slate-800/50 rounded-xl mb-6 text-xs text-slate-700 dark:text-slate-300 space-y-2 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  How to setup TextMeBot (Recommended):
                </p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>
                    Visit{" "}
                    <a
                      href="https://textmebot.com"
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-blue-600 dark:text-blue-400 font-semibold"
                    >
                      textmebot.com
                    </a>{" "}
                    and click <strong>&ldquo;Request APIKey&rdquo;</strong> (or enter your email).
                  </li>
                  <li>
                    Open the email from TextMeBot, click the verification link to <strong>link your WhatsApp</strong> (by scanning the QR code in WhatsApp &gt; Linked Devices).
                  </li>
                  <li>
                    Copy your <strong>APIKEY</strong> received in your email (e.g. <code>abc123xyz</code>).
                  </li>
                  <li>
                    Enter your WhatsApp phone number and your TextMeBot API Key below, then click &ldquo;Save & Send Test Message&rdquo;.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="p-4 bg-slate-100/70 dark:bg-slate-800/50 rounded-xl mb-6 text-xs text-slate-700 dark:text-slate-300 space-y-2 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                  Quick 1-Minute Activation via CallMeBot:
                </p>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>
                    Add the active CallMeBot number into your WhatsApp contacts:{" "}
                    <strong className="font-mono text-blue-600 dark:text-blue-400">+34 623 78 64 49</strong>{" "}
                    <span className="text-slate-400">(or +34 644 26 33 77)</span>
                  </li>
                  <li>
                    Open WhatsApp and send this exact text message to that contact:
                    <div className="my-1.5 p-2 bg-white dark:bg-slate-900 rounded border font-mono font-bold select-all text-emerald-600 dark:text-emerald-400">
                      I allow callmebot to send me messages
                    </div>
                  </li>
                  <li>
                    CallMeBot will reply immediately with your personal <strong>apikey</strong> (e.g. <code>123456</code>).
                  </li>
                  <li>Enter your phone number and the received API key below, then click &ldquo;Save & Send Test Message&rdquo;.</li>
                </ol>
              </div>
            )}

            {waStatus === "idle" && (
              <div className="space-y-4">
                {/* Destination Type Switcher */}
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 block">
                    Deliver Updates To
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setWaTargetType("personal")}
                      className={`py-2 text-xs font-semibold rounded-lg transition ${
                        waTargetType === "personal"
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                      }`}
                    >
                      👤 Personal Chat (You)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setWaTargetType("group");
                        setWaProvider("textmebot");
                      }}
                      className={`py-2 text-xs font-semibold rounded-lg transition ${
                        waTargetType === "group"
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                      }`}
                    >
                      👥 WhatsApp Group
                    </button>
                  </div>
                </div>

                {waTargetType === "group" && (
                  <div className="p-3.5 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
                    <p className="font-semibold text-blue-900 dark:text-blue-200">
                      Forwarding to a WhatsApp Group:
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>Create a WhatsApp Group and add anyone you want to receive the alerts.</li>
                      <li>Ensure your phone number (linked to TextMeBot) is in that group.</li>
                      <li>Open WhatsApp Group Info &gt; <strong>Invite via link</strong> &gt; Copy link, and paste it below!</li>
                    </ul>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                    {waTargetType === "group"
                      ? "WhatsApp Group Invite Link or Group ID"
                      : "Your WhatsApp Phone (with Country Code)"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      waTargetType === "group"
                        ? "https://chat.whatsapp.com/ABCxyz123 or 120363xxx@g.us"
                        : "+919561706020"
                    }
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    {waTargetType === "group"
                      ? "Paste the group invite link from WhatsApp or the internal group ID."
                      : "Include your country code (e.g., +91 for India, +1 for US/Canada)."}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                    {waProvider === "textmebot" ? "TextMeBot API Key" : "CallMeBot API Key"}
                  </label>
                  <input
                    type="password"
                    placeholder={waProvider === "textmebot" ? "Paste your TextMeBot API Key" : "Enter received CallMeBot apikey"}
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
                  {waLoading
                    ? "Sending Test Message to WhatsApp..."
                    : `Save & Test ${waTargetType === "group" ? "Group" : ""} with ${waProvider === "textmebot" ? "TextMeBot" : "CallMeBot"}`}
                </button>
              </div>
            )}

            {waStatus === "pending_confirmation" && (
              <div className="text-center py-4 space-y-4">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-xl">
                  📲
                </div>
                <h3 className="font-semibold text-lg">Did you receive the test message?</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  We dispatched a test notification to your WhatsApp number. Please check your WhatsApp.
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
                <h3 className="font-semibold text-lg">WhatsApp Verified</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Your WhatsApp destination {waPhone ? `(${waPhone})` : ""} is configured and active.
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setWaStatus("idle");
                      setErrorMsg("");
                    }}
                    className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium rounded-xl text-sm transition"
                  >
                    Change WhatsApp Number
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition text-sm shadow-sm"
                  >
                    Continue to Review
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
