"use client";

import Link from "next/link";
import { AnimatePresence, motion, type Transition, useReducedMotion } from "framer-motion";
import { BookOpen, X } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";

type HowItWorksStep = {
  body: string;
  id: string;
  title: string;
};

type HowItWorksDrawerProps = {
  open: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const HOW_TO_USE_STEPS: HowItWorksStep[] = [
  {
    id: "write",
    title: "Write one thing",
    body: "Write or paste up to 2,000 characters, or choose a Quick Start to fill the editor.",
  },
  {
    id: "choose",
    title: "Choose your direction",
    body: "In Authors, pick a writer and tune the mood. In Outcomes, choose what you want your writing to do.",
  },
  {
    id: "rewrite",
    title: "Press rewrite",
    body: "Read the rewrite beside your original, then copy it when you’re ready. Surprise me runs a rewrite with a random voice or outcome and uses one rewrite from your allowance.",
  },
];

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusableElements(node: HTMLElement | null) {
  if (!node) {
    return [];
  }

  return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true",
  );
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
}

export function HowItWorksDrawer({ open, onClose, returnFocusRef }: HowItWorksDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const prefersReducedMotion = useReducedMotion();
  const isMobileSheet = useMediaQuery("(max-width: 767px)");

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";

    // Isolate the modal from every surrounding layer, including header logout.
    // Preserve pre-existing inert state so nested application shells restore safely.
    const surrounding: Array<{ element: HTMLElement; inert: boolean }> = [];
    let branch: HTMLElement | null = drawerRef.current;
    while (branch?.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling instanceof HTMLElement && sibling !== branch && !sibling.matches(".gw-how-backdrop, script, style, link")) {
          surrounding.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      if (branch.parentElement === document.body) break;
      branch = branch.parentElement;
    }

    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus({ preventScroll: true });
    }, prefersReducedMotion ? 0 : 90);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = getFocusableElements(drawerRef.current);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!first || !last) {
        event.preventDefault();
        drawerRef.current?.focus({ preventScroll: true });
        return;
      }

      const activeIndex = focusable.findIndex(
        (element) => element === document.activeElement,
      );
      const nextIndex =
        activeIndex === -1
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : (activeIndex + (event.shiftKey ? -1 : 1) + focusable.length) %
            focusable.length;

      event.preventDefault();
      focusable[nextIndex]?.focus({ preventScroll: true });
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      for (const { element, inert } of surrounding) element.inert = inert;

      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [open, prefersReducedMotion, returnFocusRef]);

  const transition: Transition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.28, ease: [0.22, 1, 0.36, 1] };
  const drawerOffset = isMobileSheet ? { x: 0, y: 28 } : { x: 28, y: 0 };

  function restorePreviousFocus() {
    const target = returnFocusRef?.current ?? previousFocusRef.current;

    window.requestAnimationFrame(() => {
      if (target?.isConnected) {
        target.focus({ preventScroll: true });
      }
    });
  }

  return (
    <AnimatePresence onExitComplete={restorePreviousFocus}>
      {open ? (
        <>
          <motion.button
            type="button"
            aria-label="Close How it works drawer"
            className="gw-how-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            onClick={onClose}
          />

          <motion.div
            className="gw-how-drawer-wrap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
          >
            <motion.aside
              id="gw-how-drawer"
              ref={drawerRef}
              className="gw-how-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="gw-how-title"
              aria-describedby="gw-how-intro"
              tabIndex={-1}
              initial={{ opacity: 0, ...drawerOffset }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, ...drawerOffset }}
              transition={transition}
            >
              <header className="gw-how-header">
                <div>
                  <h2 id="gw-how-title" className="gw-how-title">
                    How to use Second Voice
                  </h2>
                  <p id="gw-how-intro" className="gw-how-intro">
                    Your words stay in the editor. Choose a direction and read the rewrite alongside them.
                  </p>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  className="gw-how-close"
                  aria-label="Close How it works"
                  onClick={onClose}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>

              <ol className="gw-how-plain-steps" aria-label="How to use Second Voice">
                {HOW_TO_USE_STEPS.map((step, index) => (
                  <li key={step.id} className="gw-how-step">
                    <span className="gw-how-step-number" aria-hidden="true">{index + 1}</span>
                    <div>
                      <h3 className="gw-how-step-title">{step.title}</h3>
                      <p className="gw-how-step-body">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <footer className="gw-how-footer">
                <Link href="/second-voice/account" className="gw-how-case-link" onClick={onClose}>Account &amp; deletion</Link>
                <Link href="/second-voice/privacy" className="gw-how-case-link" onClick={onClose}>Privacy &amp; contact</Link>
                <a href="/ghostwriter/portraits/ATTRIBUTION.md" className="gw-how-case-link">Photography credits</a>
                <Link href="/second-voice/case-study" className="gw-how-case-link" onClick={onClose}>
                  <BookOpen className="h-4 w-4" aria-hidden />
                  Read the case study
                </Link>
                <button type="button" className="gw-how-secondary" onClick={onClose}>
                  Close
                </button>
              </footer>
            </motion.aside>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
