export function SecondVoiceStudioHeader() {
  return (
    <header className="sv-studio-header">
      <div>
        <div className="sv-studio-brand">
          <FeatherMark />

          <span>Second Voice</span>
        </div>

        <h1 className="sv-studio-headline">
          Better writing,
          <br />
          <em>new voices.</em>
        </h1>

        <p className="sv-studio-intro">
          Choose a writer, set the mood, and see your words transformed in
          seconds.
        </p>
      </div>

      <div className="sv-studio-manifesto">
        Same thoughts.
        <br />
        <em>A different voice.</em>
      </div>
    </header>
  );
}

function FeatherMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="sv-studio-feather"
      fill="none"
    >
      <path
        d="M26.5 4.5C20.7 4.8 15.7 7 12.1 10.6C8.3 14.4 7.1 19.2 7 24.4C11 24.2 14.7 22.9 17.7 20.4C22.1 16.7 24.8 11.4 26.5 4.5Z"
        fill="currentColor"
      />

      <path
        d="M6 28C9.4 22.1 14.3 16.7 21.5 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
