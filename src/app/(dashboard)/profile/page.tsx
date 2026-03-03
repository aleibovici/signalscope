"use client";

import { useState } from "react";
import { useUserProfile, useUpdateUsername, useUpdateEmailAlerts } from "@/hooks/use-user-profile";

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
    </div>
  );
}
