import { useEffect, useRef } from "react";

/** Keep one action in DOM order; dock only when it leaves ample writing space. */
export function useDuetActionDock(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const action = ref.current;
    const main = action?.closest("main");
    if (!enabled || !action || !main) return;
    const viewport = window.visualViewport;
    const previousScrollPadding = document.documentElement.style.scrollPaddingBottom;
    const revealFocusedElement = () => {
      const target = document.activeElement;
      if (action.dataset.docked !== "true" || !(target instanceof HTMLElement) ||
        !main.contains(target) || action.contains(target)) return;
      const rect = target.getBoundingClientRect();
      const bottom = action.getBoundingClientRect().top - 16;
      if (rect.bottom > bottom) window.scrollBy(0, rect.bottom - bottom);
    };
    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const actionHeight = action.getBoundingClientRect().height;
      const keyboardOpen = height < window.innerHeight * .75;
      const focused = document.activeElement;
      const oversizedEditor = focused instanceof HTMLTextAreaElement && main.contains(focused) &&
        focused.getBoundingClientRect().height > height - actionHeight - 48;
      const dock = window.innerWidth < 768 && height >= 480 && !keyboardOpen &&
        !oversizedEditor &&
        parseFloat(getComputedStyle(document.documentElement).fontSize) < 24 &&
        actionHeight <= height * .36;
      action.dataset.docked = String(dock);
      const clearance = dock ? `${Math.ceil(actionHeight) + 24}px` : "0px";
      main.style.setProperty("--duet-action-clearance", clearance);
      document.documentElement.style.scrollPaddingBottom = clearance;
      revealFocusedElement();
    };
    const updateFocus = () => requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(action);
    observer.observe(document.documentElement);
    const composer = main.querySelector("textarea");
    if (composer) observer.observe(composer);
    window.addEventListener("resize", update);
    viewport?.addEventListener("resize", update);
    main.addEventListener("focusin", updateFocus);
    main.addEventListener("focusout", updateFocus);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      viewport?.removeEventListener("resize", update);
      main.removeEventListener("focusin", updateFocus);
      main.removeEventListener("focusout", updateFocus);
      main.style.removeProperty("--duet-action-clearance");
      document.documentElement.style.scrollPaddingBottom = previousScrollPadding;
    };
  }, [enabled]);
  return ref;
}
