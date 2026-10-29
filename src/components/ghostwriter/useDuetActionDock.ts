import { useLayoutEffect, useRef } from "react";

const DOCK_TOP_AND_BORDER_PX = 9;
const CONTROL_CLEARANCE_PX = 24;

/** Keep one action in DOM order; dock only when it leaves ample writing space. */
export function useDuetActionDock(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const action = ref.current;
    const main = action?.closest("main");
    if (!enabled || !action || !main) return;
    const viewport = window.visualViewport;
    const previousScrollPadding = document.documentElement.style.scrollPaddingBottom;
    const slot = action.parentElement;
    const previousSlotHeight = slot?.style.minHeight ?? "";
    let frame = 0;
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
      // Preserve the row when its child is fixed, before the first paint.
      const buttonHeight = action.querySelector("button")?.getBoundingClientRect().height ?? actionHeight;
      const bottomInset = Math.max(8, parseFloat(getComputedStyle(action).getPropertyValue("--duet-safe-bottom")) || 0);
      const dockChrome = DOCK_TOP_AND_BORDER_PX + bottomInset;
      const dockHeight = buttonHeight + dockChrome;
      const keyboardOpen = height < window.innerHeight * .75;
      const focused = document.activeElement;
      const oversizedEditor = focused instanceof HTMLTextAreaElement && main.contains(focused) &&
        focused.getBoundingClientRect().height > height - dockHeight - 48;
      const eligible = window.innerWidth < 768 && height >= 480 && !keyboardOpen &&
        !oversizedEditor &&
        parseFloat(getComputedStyle(document.documentElement).fontSize) < 24 &&
        dockHeight <= height * .36;
      const dockTop = (viewport?.offsetTop ?? 0) + height - dockHeight;
      const obstructsControl = eligible && [...main.querySelectorAll<HTMLElement>("button, a[href], input, textarea")].some(control => {
        if (action.contains(control) || control.matches(":disabled") || !control.getClientRects().length) return false;
        const rect = control.getBoundingClientRect();
        return rect.bottom > dockTop && rect.top < (viewport?.offsetTop ?? 0) + height && rect.right > 0 && rect.left < window.innerWidth;
      });
      const dock = eligible && !obstructsControl;
      const slotHeight = `${buttonHeight}px`;
      const clearance = eligible ? `${Math.ceil(dockHeight) + CONTROL_CLEARANCE_PX}px` : "0px";
      if (slot && slot.style.minHeight !== slotHeight) slot.style.minHeight = slotHeight;
      if (action.dataset.docked !== String(dock)) action.dataset.docked = String(dock);
      if (main.style.getPropertyValue("--duet-action-clearance") !== clearance) main.style.setProperty("--duet-action-clearance", clearance);
      if (document.documentElement.style.scrollPaddingBottom !== clearance) document.documentElement.style.scrollPaddingBottom = clearance;
      revealFocusedElement();
    };
    const scheduleUpdate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    const onScroll = () => { if (window.innerWidth < 768) scheduleUpdate(); };
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(action);
    observer.observe(document.documentElement);
    const composer = main.querySelector("textarea");
    if (composer) observer.observe(composer);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", onScroll, { passive: true });
    viewport?.addEventListener("resize", update);
    main.addEventListener("focusin", scheduleUpdate);
    main.addEventListener("focusout", scheduleUpdate);
    update();
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", onScroll);
      viewport?.removeEventListener("resize", update);
      main.removeEventListener("focusin", scheduleUpdate);
      main.removeEventListener("focusout", scheduleUpdate);
      if (slot) slot.style.minHeight = previousSlotHeight;
      main.style.removeProperty("--duet-action-clearance");
      document.documentElement.style.scrollPaddingBottom = previousScrollPadding;
    };
  }, [enabled]);
  return ref;
}
