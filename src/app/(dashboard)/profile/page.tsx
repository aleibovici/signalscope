"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import { useUserProfile, useUpdateUsername, useUpdateEmailAlerts, type SubscriptionInfo } from "@/hooks/use-user-profile";
import { useApiKey, useGenerateApiKey, useRevokeApiKey } from "@/hooks/use-api-key";
import { useShareReward, useClaimShareReward } from "@/hooks/use-share-reward";
import { useCheckout, usePortal } from "@/hooks/use-subscription";
import { trackEvent, trackConversion } from "@/lib/analytics";
import { inputCls } from "@/lib/input-cls";

const MONTHLY_PRICE = 2.99;
const YEARLY_PRICE = 29.99;

const proFeatures = [
  "On-demand AI reports",
  "AI-powered trade setups",
  "Email alerts for new signals",
  "API key with 1,000 requests/day",
  "All authenticated API endpoints",
];

export default function ProfilePage() {
  const { data: profile, isLoading } = useUserProfile();
  const updateUsername = useUpdateUsername();
  const updateEmailAlerts = useUpdateEmailAlerts();
  const searchParams = useSearchParams();
  const subscribeSuccess = searchParams.get("success") === "1";

  const [input, setInput] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const value = input ?? profile?.username ?? "";

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
        {!isLoading && <SubscriptionBadge subscription={profile?.subscription ?? null} />}
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
        ) : !profile?.subscription?.isActive ? (
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Email alerts require a Pro subscription.{" "}
            <a href="#subscription" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Upgrade to Pro
            </a>
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
      <SubscriptionSection
        subscription={profile?.subscription ?? null}
        isLoading={isLoading}
        success={subscribeSuccess}
      />
      <ShareRewardSection />
      <ApiKeySection isProUser={profile?.subscription?.isActive ?? false} />
      <DeleteAccountSection />
    </div>
  );
}

function SubscriptionBadge({ subscription }: { subscription: SubscriptionInfo | null }) {
  if (!subscription || (subscription.status !== "ACTIVE" && subscription.status !== "PAST_DUE")) {
    return (
      <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
        Free
      </span>
    );
  }
  if (subscription.status === "PAST_DUE") {
    return (
      <a
        href="#subscription"
        className="shrink-0 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60"
      >
        Pro · Payment failed
      </a>
    );
  }
  const date = new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (subscription.cancelAtPeriodEnd) {
    return (
      <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
        Pro · ends {date}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
      Pro · renews {date}
    </span>
  );
}

function ShareRewardSection() {
  const { data, isLoading } = useShareReward();
  const claim = useClaimShareReward();
  const [tweetUrl, setTweetUrl] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (isLoading) return null;

  return (
    <div id="share-reward" className="mt-6 scroll-mt-20 rounded-xl border border-blue-200 bg-blue-50 p-6 dark:border-blue-900/50 dark:bg-blue-950/30">
      <h2 className="mb-1 text-base font-semibold text-gray-800 dark:text-zinc-100">Share & Earn</h2>

      {data?.claimed ? (
        <div className="flex items-start gap-2 mt-2">
          <span className="mt-0.5 text-green-600 dark:text-green-400">&#10003;</span>
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">
              Reward claimed!
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              {data.claimedAt && `Claimed ${new Date(data.claimedAt).toLocaleDateString()}`}
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600 dark:text-zinc-400">
            Tweet about SignalScope and get <span className="font-semibold text-gray-800 dark:text-zinc-200">1 month of Pro free</span>.
            {data?.hasActiveSubscription
              ? " A $10 credit will be applied to your next invoice."
              : " You'll instantly unlock AI reports, API access, and email alerts."}
          </p>

          <div className="space-y-3">
            <a
              href={data?.tweetIntentUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!data?.tweetIntentUrl) { e.preventDefault(); return; }
                trackEvent("share_reward_compose");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-zinc-100 dark:text-gray-900 dark:hover:bg-zinc-200"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Compose Tweet
            </a>

            <div>
              <label htmlFor="tweet-url" className="mb-1 block text-xs font-medium text-gray-600 dark:text-zinc-400">
                After tweeting, paste the link here
              </label>
              <div className="flex gap-2">
                <input
                  id="tweet-url"
                  type="url"
                  value={tweetUrl}
                  onChange={(e) => {
                    setTweetUrl(e.target.value);
                    setSuccessMsg(null);
                    claim.reset();
                  }}
                  placeholder="https://x.com/you/status/..."
                  className={`min-w-0 flex-1 px-3 py-2 text-gray-900 placeholder-gray-400 dark:text-zinc-100 dark:placeholder-zinc-500 ${inputCls}`}
                />
                <button
                  type="button"
                  disabled={claim.isPending || !tweetUrl.trim()}
                  onClick={() => {
                    claim.mutate(tweetUrl.trim(), {
                      onSuccess: (result) => {
                        setSuccessMsg(
                          result.rewardType === "trial"
                            ? "Pro trial activated! You now have full access for 30 days."
                            : "$10 credit applied to your next invoice!"
                        );
                        setTweetUrl("");
                      },
                    });
                  }}
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                  {claim.isPending ? "Verifying..." : "Claim Reward"}
                </button>
              </div>
            </div>

            {claim.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {claim.error instanceof Error ? claim.error.message : "Something went wrong"}
              </p>
            )}

            {successMsg && (
              <p className="text-sm font-medium text-green-600 dark:text-green-400">{successMsg}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ApiKeySection({ isProUser }: { isProUser: boolean }) {
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
            To use with Claude, install the{" "}
            <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              SignalScope Agent Skill
            </a>.
          </p>
        </>
      ) : data?.apiKey ? (
        <>
          <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
            Your API key for programmatic access. Use the <code className="text-gray-600 dark:text-zinc-500">x-api-key</code> header, or install the{" "}
            <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              Agent Skill
            </a>{" "}
            to use with Claude.
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
              {isProUser ? (
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
            Use it with Claude or any HTTP client.{" "}
            {isProUser ? (
              <>See the{" "}
              <a href="/skill/SKILL.md" target="_blank" className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                Agent Skill
              </a>{" "}
              for setup instructions.</>
            ) : (
              <>Free plan: 10 calls/month.</>
            )}
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

function SubscriptionSection({
  subscription,
  isLoading,
  success,
}: {
  subscription: SubscriptionInfo | null;
  isLoading: boolean;
  success: boolean;
}) {
  const checkout = useCheckout();
  const portal = usePortal();
  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");
  const isActive = subscription?.isActive ?? false;

  useEffect(() => {
    trackEvent("view_subscription_page");
  }, []);

  async function handleSubscribe() {
    await trackConversion("begin_checkout", {
      currency: "USD",
      value: period === "monthly" ? MONTHLY_PRICE : YEARLY_PRICE,
      items: [{ item_name: `SignalScope Pro (${period})`, price: period === "monthly" ? MONTHLY_PRICE : YEARLY_PRICE }],
    });
    checkout.mutate(period, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  }

  function handleManage() {
    portal.mutate(undefined, {
      onSuccess: (data) => {
        window.location.href = data.url;
      },
    });
  }

  return (
    <div id="subscription" className="mt-6 scroll-mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#12181f]">
      <h2 className="mb-4 text-base font-semibold text-gray-800 dark:text-zinc-100">Subscription</h2>

      {success && !isActive && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          Subscription activated! You can now generate an API key below.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500">Loading...</p>
      ) : isActive ? (
        <div>
          <div className="mb-4 flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/50 dark:text-green-300">
              {subscription?.cancelAtPeriodEnd ? "Canceling" : "Active"}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Pro</span>
          </div>

          {subscription?.cancelAtPeriodEnd && (
            <p className="mb-4 text-sm text-amber-600 dark:text-amber-400">
              Your subscription will end on{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
              You&apos;ll keep access until then.
            </p>
          )}

          {!subscription?.cancelAtPeriodEnd && (
            <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
              Next billing date:{" "}
              {subscription?.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                : "—"}
            </p>
          )}

          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-zinc-200">Includes</h3>
          <ul className="mb-6 space-y-2">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-zinc-300">
                <span className="mt-0.5 text-green-600 dark:text-green-400">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleManage}
            disabled={portal.isPending}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            {portal.isPending ? "Loading..." : "Manage Subscription"}
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-sm text-gray-500 dark:text-zinc-400">
            The SignalScope dashboard is free. Subscribe to unlock programmatic API access, on-demand AI reports, and email alerts.
          </p>

          <div className="mb-6 flex items-center gap-2">
            <button
              onClick={() => setPeriod("monthly")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                period === "monthly"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriod("yearly")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                period === "yearly"
                  ? "bg-blue-600 text-white dark:bg-blue-500"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              }`}
            >
              Yearly
              <span className="ml-1 text-xs opacity-75">Save $6</span>
            </button>
          </div>

          <div className="mb-6">
            <div className="text-4xl font-bold text-gray-900 dark:text-zinc-100">
              ${period === "monthly" ? MONTHLY_PRICE : YEARLY_PRICE}
              <span className="text-base font-normal text-gray-500 dark:text-zinc-400">
                /{period === "monthly" ? "mo" : "yr"}
              </span>
            </div>
            {period === "yearly" && (
              <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                ${(YEARLY_PRICE / 12).toFixed(2)}/mo billed annually
              </p>
            )}
          </div>

          <ul className="mb-6 space-y-2">
            {proFeatures.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-zinc-300">
                <span className="mt-0.5 text-green-600 dark:text-green-400">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>

          {checkout.isError && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">
              {checkout.error instanceof Error ? checkout.error.message : "Something went wrong"}
            </p>
          )}

          <button
            onClick={handleSubscribe}
            disabled={checkout.isPending}
            className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {checkout.isPending ? "Redirecting to checkout..." : "Subscribe to Pro"}
          </button>

          <p className="mt-4 text-xs text-gray-400 dark:text-zinc-500">
            Secure checkout via Stripe. Cancel anytime.
          </p>
        </div>
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
