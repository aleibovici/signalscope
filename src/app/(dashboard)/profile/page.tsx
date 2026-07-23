"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useUserProfile, useUpdateUsername, useUpdateEmailAlerts } from "@/hooks/use-user-profile";
import { useApiKey, useGenerateApiKey, useRevokeApiKey } from "@/hooks/use-api-key";
import { inputCls } from "@/lib/input-cls";

export default function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const updateUsername = useUpdateUsername();
  const updateEmailAlerts = useUpdateEmailAlerts();

  const [input, setInput] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const value = input ?? profile?.username ?? "";

  const subscriptionsEnabled = profile?.subscriptionsEnabled ?? false;
  const canUseEmailAlerts = !subscriptionsEnabled || (profile?.subscription?.isActive ?? false);
  const hasFullApiAccess = !subscriptionsEnabled || (profile?.subscription?.isActive ?? false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaveSuccess(false);
    updateUsername.mutate(value.trim(), {
      onSuccess: () => setSaveSuccess(true),
    });
  }

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-900 dark:text-zinc-100">
            {profile?.username ?? profile?.email?.split("@")[0] ?? "Profile"}
          </h1>
          {profile?.email && (
            <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-zinc-400">{profile.email}</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#12181f]">
        <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-zinc-100">Username</h2>

        {isLoading ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500">Loading…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
              Your username is shown on social features. It must be 3–20
              characters and can only contain lowercase letters, numbers, and underscores.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={value}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setSaveSuccess(false);
                    updateUsername.reset();
                  }}
                  placeholder="e.g. swift_falcon_427"
                  maxLength={20}
                  className={`w-full px-3 py-2 text-gray-900 dark:text-zinc-100 ${inputCls}`}
                />
              </div>

              {updateUsername.isError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {updateUsername.error instanceof Error
                    ? updateUsername.error.message
                    : "Something went wrong"}
                </p>
              )}

              {saveSuccess && (
                <p className="text-sm text-green-600 dark:text-green-400">Username updated successfully.</p>
              )}

              <button
                type="submit"
                disabled={updateUsername.isPending || !value.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                {updateUsername.isPending ? "Saving…" : "Save username"}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#12181f]">
        <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-zinc-100">Email Alerts</h2>

        {isLoading ? (
          <p className="text-sm text-gray-400 dark:text-zinc-500">Loading…</p>
        ) : !canUseEmailAlerts ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Email alerts require an active subscription on this deployment.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
              Receive a daily digest email with all confirmed tickers after each scan.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={profile?.emailAlerts ?? true}
                onClick={() => updateEmailAlerts.mutate(!profile?.emailAlerts)}
                disabled={updateEmailAlerts.isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-base focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-950 ${
                  profile?.emailAlerts ? "bg-blue-600 dark:bg-blue-500" : "bg-gray-200 dark:bg-zinc-600"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-base ${
                    profile?.emailAlerts ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700 dark:text-zinc-300">
                {profile?.emailAlerts ? "Enabled" : "Disabled"}
              </span>
            </div>

            {updateEmailAlerts.isError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {updateEmailAlerts.error instanceof Error
                  ? updateEmailAlerts.error.message
                  : "Something went wrong"}
              </p>
            )}
          </>
        )}
      </div>

      <ApiKeySection hasFullAccess={hasFullApiAccess} />
      <DeleteAccountSection />
    </div>
  );
}

function ApiKeySection({ hasFullAccess }: { hasFullAccess: boolean }) {
  const { data, isLoading } = useApiKey();
  const generate = useGenerateApiKey();
  const revoke = useRevokeApiKey();
  const [copied, setCopied] = useState(false);

  const newKey = generate.data?.key;

  function copyKey() {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#12181f]">
      <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-zinc-100">API Key</h2>

      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500">Loading...</p>
      ) : newKey ? (
        <>
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-300">
            Save this key now — you won&apos;t see it again.
          </p>
          <div className="mb-4 flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-gray-100 px-3 py-2 font-mono text-sm text-gray-800 dark:bg-zinc-900 dark:text-zinc-200">
              {newKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="shrink-0 rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Use this key in the <code className="text-gray-600 dark:text-zinc-500">x-api-key</code> header to authenticate API requests.
            To connect an LLM or automation client, download the{" "}
            <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              API skill file
            </a>.
          </p>
        </>
      ) : data?.apiKey ? (
        <>
          <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
            Your API key for programmatic access. Use the <code className="text-gray-600 dark:text-zinc-500">x-api-key</code> header, or download the{" "}
            <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              API skill file
            </a>{" "}
            for compatible LLM and agent clients.
          </p>
          <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm dark:bg-zinc-900/60">
            <div className="flex items-center justify-between">
              <code className="font-mono text-gray-700 dark:text-zinc-300">{data.apiKey.prefix}</code>
            </div>
            <div className="mt-2 text-xs text-gray-400 dark:text-zinc-500">
              Created {new Date(data.apiKey.createdAt).toLocaleDateString()}
              {data.apiKey.lastUsedAt && (
                <> &middot; Last used {new Date(data.apiKey.lastUsedAt).toLocaleDateString()}</>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-400 dark:text-zinc-500">
              {hasFullAccess ? (
                <span>1,000 calls/day</span>
              ) : (
                <span>
                  {data.apiKey.monthlyCallCount ?? 0} / 10 calls used this month
                  {data.apiKey.monthlyWindowStart && (() => {
                    const d = new Date(data.apiKey.monthlyWindowStart);
                    const nextMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
                    const resetLabel = nextMonth.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    return <> &middot; resets {resetLabel}</>;
                  })()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              {generate.isPending ? "Regenerating..." : "Regenerate Key"}
            </button>
            <button
              type="button"
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
            >
              {revoke.isPending ? "Revoking..." : "Revoke"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
            Generate an API key for programmatic access to your SignalScope data.
            Use it with any HTTP client or compatible LLM agent.{" "}
            See the{" "}
            <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              API skill file
            </a>{" "}
            for setup instructions.
            {!hasFullAccess && <> Limited to 10 calls/month when billing is enabled without a subscription.</>}
          </p>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {generate.isPending ? "Generating..." : "Generate API Key"}
          </button>
        </>
      )}

      {(generate.isError || revoke.isError) && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {generate.error instanceof Error ? generate.error.message :
           revoke.error instanceof Error ? revoke.error.message :
           "Something went wrong"}
        </p>
      )}
    </div>
  );
}

function DeleteAccountSection() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/account", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete account");
      }
      await signOut({ redirect: false });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setDeleting(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-white p-6 dark:border-red-900/50 dark:bg-[#12181f]">
      <h2 className="mb-2 text-base font-semibold text-red-600 dark:text-red-400">Delete Account</h2>
      <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
        Permanently delete your account, cancel any active subscription, and remove all personal data. This cannot be undone.
      </p>

      {!showConfirm ? (
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Delete Account
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            Type <code className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs dark:bg-red-950/40">DELETE</code> to confirm:
          </p>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="DELETE"
            className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:border-red-500 dark:border-red-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus-visible:ring-red-400/40 dark:focus-visible:border-red-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={confirmText !== "DELETE" || deleting}
              onClick={handleDelete}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 dark:bg-red-500 dark:hover:bg-red-600"
            >
              {deleting ? "Deleting…" : "Permanently Delete"}
            </button>
            <button
              type="button"
              onClick={() => { setShowConfirm(false); setConfirmText(""); setError(null); }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
