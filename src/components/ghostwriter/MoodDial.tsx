"use client";

import { MOOD_LABELS, MOOD_NAME, moodLabelFor, type AuthorId } from "@/lib/ghostwriter-shared";

export function MoodDial({
  author,
  disabled = false,
  value,
  onChange,
}: {
  author: AuthorId | null;
  disabled?: boolean;
  value: number;
  onChange: (next: number) => void;
}) {
  const labels = author ? MOOD_LABELS[author] : null;
  const moodLabel = author ? moodLabelFor(author, value) : "choose an author";

  return (
    <div className="gw-mood-dock" data-voice={author ?? undefined}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-playfair text-[1.08rem] font-medium tracking-[-0.015em] text-[var(--ghost)] sm:text-[1.14rem]">Tune the mood</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--mist)] sm:text-[13px]">
            {author ? MOOD_NAME[author] : "Choose an author first"}
          </p>
        </div>
        <div className="gw-mood-badge inline-flex items-center rounded-[10px] border px-3 py-1 text-[11px] sm:text-[12px]">
          {author ? `${value}% · ${moodLabel}` : "Pick an author"}
        </div>
      </div>

      <div className="gw-range-shell mt-5">
        <div className="gw-range-control">
          <progress className="gw-range-progress" max={100} value={value} aria-hidden />
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={value}
            disabled={disabled}
            aria-label={author ? `${MOOD_NAME[author]} mood dial` : "Mood dial"}
            aria-valuetext={author ? `${value}% ${moodLabel}` : "Choose an author first"}
            onChange={(event) => onChange(Number(event.target.value))}
            className="gw-range w-full cursor-pointer appearance-none disabled:cursor-not-allowed"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[12px] text-[var(--whisper)]">
          <span>{labels?.[0] ?? "first pick"}</span>
          <span className="text-right">{labels?.[4] ?? "then tune"}</span>
        </div>
      </div>
    </div>
  );
}
