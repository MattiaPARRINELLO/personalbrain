"use client";

import { useEffect, type ReactNode } from "react";

export function ViewTransitionProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.startViewTransition) return;

    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      document.startViewTransition!(() => {
        origPushState(...args);
      });
    };

    history.replaceState = (...args) => {
      document.startViewTransition!(() => {
        origReplaceState(...args);
      });
    };

    return () => {
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
    };
  }, []);

  return children;
}
