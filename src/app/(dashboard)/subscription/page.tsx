"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useCheckout, usePortal } from "@/hooks/use-subscription";
import { useShareReward } from "@/hooks/use-share-reward";
import { ShareRewardBadge } from "@/components/dashboard/share-reward-badge";
import { trackEvent, trackConversion } from "@/lib/analytics";
import { PageHeader } from "@/components/ui/page-header";

const MONTHLY_PRICE = 2.99;
const YEARLY_PRICE = 29.99;

const features = [
  "On-demand AI reports",
  "AI-powered trade setups",
  "Email alerts for new signals",
  "API key with 1,000 requests/day",
  "All authenticated API endpoints",
];

export default function SubscriptionPage() {
  const { data: profile, isLoading } = useUserProfile();
  const checkout = useCheckout();
  const portal = usePortal();
  const { data: shareReward } = useShareReward();
  const searchParams = useSearchParams();
  const success = searchParams.get("success") === "1";

  const [period, setPeriod] = useState<"monthly" | "yearly">("monthly");

  const subscription = profile?.subscription;
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
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <PageHeader
          title="API Access"
          subtitle="The SignalScope dashboard is free. Subscribe to unlock programmatic API access, on-demand AI reports, and email alerts."
        />
      </div>

      {success && !isActive && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
          Subscription activated! You can now generate an API key from your profile.
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#12181f]">
          <p className="text-sm text-gray-400 dark:text-zinc-500">Loading...</p>
        </div>
      ) : isActive ? (
        /* Active subscription state */
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#12181f]">
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
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-zinc-300">
                <span className="mt-0.5 text-green-600 dark:text-green-400">&#10003;</span>
                {f}
              </li>
            ))}
          </ul>

          <button
            onClick={handleManage}
            disabled={portal.isPending}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            {portal.isPending ? "Loading..." : "Manage Subscription"}
          </button>
        </div>
      ) : (
        /* Subscribe state */
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-zinc-800 dark:bg-[#12181f]">
          <div className="mb-6 flex items-center justify-center gap-2">
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

          <div className="mb-6 text-center">
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
            {features.map((f) => (
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
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {checkout.isPending ? "Redirecting to checkout..." : "Subscribe"}
          </button>

          <p className="mt-4 text-center text-xs text-gray-400 dark:text-zinc-500">
            Secure checkout via Stripe. Cancel anytime.
          </p>
        </div>
      )}

      {!shareReward?.claimed && (
        <div className="mt-6">
          <ShareRewardBadge hasPro={isActive} />
        </div>
      )}
    </div>
  );
}
