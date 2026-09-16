"use client";
import Image from "next/image";
import { AUTHORS as SHARED_AUTHORS, type AuthorId, type AuthorMeta } from "@/lib/ghostwriter-shared";

// Keep the canonical public contract used by playback and the portfolio film.
export type Author = AuthorMeta;
export const AUTHORS: Author[] = SHARED_AUTHORS;
const AUTHOR_TONES: Record<AuthorId, string> = {
  tolkien: "Mythic imagery", stephenking: "Everyday suspense",
  tolstoy: "Inner lives", hemingway: "Spare sentences",
};
export function AuthorOrbital({active, disabled = false, onSelect}: {
  active: AuthorId | null; disabled?: boolean; onSelect: (id: AuthorId) => void;
}) {
  return <div className="gw-author-portraits" role="group" aria-label="Choose an author">
    {AUTHORS.map((author) => <button key={author.id} type="button" disabled={disabled}
      aria-label={`Choose ${author.name}`} aria-pressed={active === author.id} data-selected={active === author.id}
      onClick={() => onSelect(author.id)} className="gw-author-portrait-button">
      <span className="gw-author-photo" style={{ display: "block", width: 64, height: 64, borderRadius: 10, overflow: "clip" }}>
        <Image src={`/ghostwriter/portraits/${author.id === "tolkien" ? "tolkien-color.png" : author.id === "tolstoy" ? "tolstoy-color.jpg" : `${author.id}.jpg`}`} alt={`${author.name} portrait`}
          width={192} height={192} className="gw-author-portrait" data-author={author.id}
          style={author.id === "tolstoy" ? { transform: "scale(2.2)", transformOrigin: "58% 0" } : undefined} />
      </span>
      <span className="gw-author-portrait-name">{author.id === "stephenking" ? author.name : author.cardTitle}</span>
      <span className="gw-author-portrait-tone">{AUTHOR_TONES[author.id]}</span>
    </button>)}
  </div>;
}
