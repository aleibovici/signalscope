"use client";

import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useVoteFor, useVoteMutation } from "@/hooks/use-votes";

interface VoteButtonProps {
  symbol: string;
  size?: "sm" | "lg";
  showCount?: boolean;
  /** Set false in list views — parent useVotes() batch populates cache instead. */
  fetchEnabled?: boolean;
}

export function VoteButton({ symbol, size = "sm", showCount = true, fetchEnabled = true }: VoteButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const vote = useVoteFor(symbol, { fetchEnabled });
  const { mutate, isPending } = useVoteMutation();

  const iconSize = size === "lg" ? "h-5 w-5" : "h-3.5 w-3.5";
  const countSize = size === "lg" ? "text-sm" : "text-[10px]";
  const gap = size === "lg" ? "gap-1.5" : "gap-1";

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!session?.user) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    mutate({ symbol, voted: !vote.userVoted });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      title={session?.user ? (vote.userVoted ? "Remove upvote" : "Upvote") : "Sign in to vote"}
      className={`inline-flex items-center text-muted transition-colors duration-base disabled:opacity-50 hover:text-secondary ${gap}`}
    >
      <svg
        className={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
      </svg>
      {showCount && vote.upvotes > 0 && (
        <span className={`font-medium tabular-nums ${countSize}`}>
          {vote.upvotes}
        </span>
      )}
    </button>
  );
}
