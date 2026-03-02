"use client";

import { useState } from "react";
import { useUserProfile, useUpdateUsername } from "@/hooks/use-user-profile";

export default function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const updateUsername = useUpdateUsername();

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
    </div>
  );
}
