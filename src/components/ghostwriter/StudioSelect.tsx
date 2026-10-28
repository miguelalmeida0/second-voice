"use client";

import { Check, ChevronDown } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

type Option<T extends string> = { value: T; label: string };

/** Select-only combobox. Focus stays on the trigger while options are explored. */
export function StudioSelect<T extends string>({ label, name, value, options, disabled, onChange, className = "" }: {
  label: string; name: string; value: T; options: readonly Option<T>[];
  disabled: boolean; onChange: (value: T) => void; className?: string;
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", time: 0 });
  const selected = Math.max(0, options.findIndex(option => option.value === value));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selected);
  const expanded = open && !disabled;

  useLayoutEffect(() => {
    if (!expanded) return;
    const position = () => {
      const button = trigger.current;
      const popup = menu.current;
      if (!button || !popup) return;
      const rect = button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const topEdge = (viewport?.offsetTop ?? 0) + 8;
      const bottomEdge = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) - 8;
      if (rect.bottom < topEdge || rect.top > bottomEdge) { setOpen(false); return; }
      const below = bottomEdge - rect.bottom - 6;
      const above = rect.top - topEdge - 6;
      const aboveTrigger = below < Math.min(240, popup.scrollHeight) && above > below;
      const available = Math.max(44, aboveTrigger ? above : below);
      popup.style.width = `${Math.min(Math.max(rect.width, 180), innerWidth - 16)}px`;
      popup.style.maxHeight = `${Math.min(320, available)}px`;
      popup.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - popup.offsetWidth - 8))}px`;
      popup.style.top = `${aboveTrigger ? Math.max(topEdge, rect.top - popup.offsetHeight - 6) : rect.bottom + 6}px`;
    };
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
    };
    position();
    const observer = new ResizeObserver(position);
    if (trigger.current) observer.observe(trigger.current);
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    const popup = menu.current;
    const option = popup?.children[active] as HTMLElement | undefined;
    if (!expanded || !popup || !option) return;
    if (option.offsetTop < popup.scrollTop) popup.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > popup.scrollTop + popup.clientHeight) {
      popup.scrollTop = option.offsetTop + option.offsetHeight - popup.clientHeight;
    }
  }, [active, expanded]);

  function choose(index: number) {
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") { setOpen(false); return; }
    if (event.key === "Escape") {
      if (expanded) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      if ((event.key === "Enter" || event.key === " ") && expanded) { choose(active); return; }
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : !expanded ? selected :
        Math.max(0, Math.min(options.length - 1, active + (event.key === "ArrowUp" ? -1 : 1)));
      setActive(next); setOpen(true); search.current.text = "";
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const now = Date.now();
      const previous = now - search.current.time < 700 ? search.current.text : "";
      const text = previous === event.key.toLowerCase() ? previous : previous + event.key.toLowerCase();
      search.current = { text, time: now };
      const start = expanded ? active : selected;
      const match = options.map((_, index) => (start + index + (text.length === 1 ? 1 : 0)) % options.length)
        .find(index => options[index].label.toLowerCase().startsWith(text));
      if (match !== undefined) { setActive(match); setOpen(true); }
    }
  }

  return <div className={`duet-setting ${className}`}>
    <label htmlFor={id}>{label}</label>
    <button ref={trigger} id={id} type="button" className="studio-select-trigger" role="combobox"
      aria-label={name} aria-expanded={expanded} aria-haspopup="listbox" aria-controls={expanded ? `${id}-list` : undefined}
      aria-activedescendant={expanded ? `${id}-option-${active}` : undefined} data-value={value}
      disabled={disabled} onKeyDown={onKeyDown} onBlur={() => setOpen(false)}
      onClick={() => { setActive(selected); setOpen(!expanded); search.current.text = ""; }}>
      <span>{options[selected].label}</span><ChevronDown aria-hidden="true" />
    </button>
    {expanded && createPortal(<div ref={menu} id={`${id}-list`} role="listbox" aria-label={name}
      className="studio-select-menu" onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <div key={option.value} id={`${id}-option-${index}`} role="option"
        aria-selected={value === option.value} data-active={active === index} className="studio-select-option"
        onPointerMove={event => { if (event.pointerType === "mouse") setActive(index); }} onClick={() => choose(index)}>
        <span>{option.label}</span>{value === option.value && <Check aria-hidden="true" />}
      </div>)}
    </div>, document.body)}
  </div>;
}
