import { AUTHORS, type AuthorId, type AuthorMeta } from "@/lib/ghostwriter-shared";

export type Author = AuthorMeta;
export { AUTHORS };

export function AuthorOrbital({
  active,
  disabled = false,
  onSelect,
}: {
  active: Author["id"] | null;
  disabled?: boolean;
  onSelect: (id: AuthorId) => void;
}) {
  return (
    <div className="gw-author-grid grid w-full grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
      {AUTHORS.map((author) => {
        const isSelected = author.id === active;

        return (
          <button
            key={author.id}
            type="button"
            onClick={() => onSelect(author.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            aria-label={`Choose ${author.name}`}
            data-author={author.id}
            data-selected={isSelected}
            className="gw-author-card group relative flex min-h-[220px] flex-col rounded-2xl border p-6 text-left transition-colors duration-300 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ghost)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] disabled:cursor-not-allowed"
          >
            <div className="gw-author-meta mb-6 flex items-start justify-between">
              <span className="gw-author-era text-sm tracking-wide">
                {author.era}
              </span>

              {isSelected ? (
                <span className="gw-author-status flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em]">
                  Selected
                  <span className="gw-author-status-dot h-2 w-2 rounded-full" />
                </span>
              ) : (
                <span className="gw-author-status text-[11px] font-medium uppercase tracking-[0.18em]">
                  Author
                </span>
              )}
            </div>

            <h3 className="gw-author-title mb-1 font-serif">
              {author.cardTitle}
            </h3>
            <p className="gw-author-byline mb-6 text-base">
              {author.byline}
            </p>

            <p className="gw-author-description mt-auto text-sm leading-relaxed">
              {author.trait}
            </p>
          </button>
        );
      })}
    </div>
  );
}
