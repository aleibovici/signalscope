"use client";

import { useEffect, useRef } from "react";

/**
 * Saves and restores the scroll position of #main-scroll across
 * client-side navigations using sessionStorage.
 */
export function useScrollRestore(key: string) {
  const storageKey = `scroll:${key}`;
  const restored = useRef(false);

  useEffect(() => {
    const container = document.getElementById("main-scroll");
    if (!container) return;

    // Restore saved position on first mount
    if (!restored.current) {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        requestAnimationFrame(() => {
          container.scrollTop = parseInt(saved, 10);
        });
      }
      restored.current = true;
    }

    // Continuously save position (debounced)
    let timeout: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        sessionStorage.setItem(storageKey, String(container.scrollTop));
      }, 100);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timeout);
      container.removeEventListener("scroll", onScroll);
    };
  }, [storageKey]);
}
