"use client";

import { useState } from "react";
import { useUserProfile, useUpdateUsername, useUpdateEmailAlerts } from "@/hooks/use-user-profile";
import { useApiKey, useGenerateApiKey, useRevokeApiKey } from "@/hooks/use-api-key";

export default function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const updateUsername = useUpdateUsername();
  const updateEmailAlerts = useUpdateEmailAlerts();

  const [input, setInput] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const value = input ?? profile?.username ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    updateUsername.mutate(value.trim(), {
      onSuccess: () => setSuccess(true),
    });
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Profile</h1>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-800">Username</h2>

        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500">
              Your username is shown on leaderboards and social features. It must be 3–20
              characters and can only contain lowercase letters, numbers, and underscores.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={value}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setSuccess(false);
                    updateUsername.reset();
                  }}
                  placeholder="e.g. swift_falcon_427"
                  maxLength={20}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {updateUsername.isError && (
                <p className="text-sm text-red-600">
                  {updateUsername.error instanceof Error
                    ? updateUsername.error.message
                    : "Something went wrong"}
                </p>
              )}

              {success && (
                <p className="text-sm text-green-600">Username updated successfully.</p>
              )}

              <button
                type="submit"
                disabled={updateUsername.isPending || !value.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updateUsername.isPending ? "Saving…" : "Save username"}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-base font-semibold text-gray-800">Email Alerts</h2>

        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-gray-500">
              Receive a daily digest email with all confirmed tickers after each scan.
            </p>

            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={profile?.emailAlerts ?? true}
                onClick={() => updateEmailAlerts.mutate(!profile?.emailAlerts)}
                disabled={updateEmailAlerts.isPending}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                  profile?.emailAlerts ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                    profile?.emailAlerts ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-gray-700">
                {profile?.emailAlerts ? "Enabled" : "Disabled"}
              </span>
            </div>

            {updateEmailAlerts.isError && (
              <p className="mt-2 text-sm text-red-600">
                {updateEmailAlerts.error instanceof Error
                  ? updateEmailAlerts.error.message
                  : "Something went wrong"}
              </p>
            )}
          </>
        )}
      </div>
      <ApiKeySection />
    </div>
  );
}

function ApiKeySection() {
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
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-800">API Key</h2>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : newKey ? (
        <>
          <p className="mb-3 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Save this key now — you won&apos;t see it again.
          </p>
          <div className="flex items-center gap-2 mb-4">
            <code className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-mono text-gray-800 break-all">
              {newKey}
            </code>
            <button
              type="button"
              onClick={copyKey}
              className="shrink-0 rounded-lg bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Use this key in the <code className="text-gray-600">x-api-key</code> header to authenticate API requests.
            To use with Claude, install the{" "}
            <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700">
              SignalScope Agent Skill
            </a>.
          </p>
        </>
      ) : data?.apiKey ? (
        <>
          <p className="mb-4 text-sm text-gray-500">
            Your API key for programmatic access. Use the <code className="text-gray-600">x-api-key</code> header, or install the{" "}
            <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700">
              Agent Skill
            </a>{" "}
            to use with Claude.
          </p>
          <div className="mb-4 rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex items-center justify-between">
              <code className="font-mono text-gray-700">{data.apiKey.prefix}</code>
            </div>
            <div className="mt-2 text-xs text-gray-400">
              Created {new Date(data.apiKey.createdAt).toLocaleDateString()}
              {data.apiKey.lastUsedAt && (
                <> &middot; Last used {new Date(data.apiKey.lastUsedAt).toLocaleDateString()}</>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {generate.isPending ? "Regenerating..." : "Regenerate Key"}
            </button>
            <button
              type="button"
              onClick={() => revoke.mutate()}
              disabled={revoke.isPending}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {revoke.isPending ? "Revoking..." : "Revoke"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-500">
            Generate an API key for programmatic access to your SignalScope data.
            Use it with Claude or any HTTP client. See the{" "}
            <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700">
              Agent Skill
            </a>{" "}
            for setup instructions.
          </p>
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {generate.isPending ? "Generating..." : "Generate API Key"}
          </button>
        </>
      )}

      {(generate.isError || revoke.isError) && (
        <p className="mt-2 text-sm text-red-600">
          {generate.error instanceof Error ? generate.error.message :
           revoke.error instanceof Error ? revoke.error.message :
           "Something went wrong"}
        </p>
      )}
    </div>
  );
}
