import Link from "next/link";

export function SecondVoiceMark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <Link
      href="/second-voice"
      className={`inline-flex items-center text-left ${className}`.trim()}
      aria-label="Second Voice AI"
    >
      <span className="second-voice-mark-title font-serif text-[2.15rem] font-medium leading-none tracking-[-0.025em] text-[var(--ghost)]">
        Second Voice AI
      </span>
    </Link>
  );
}
