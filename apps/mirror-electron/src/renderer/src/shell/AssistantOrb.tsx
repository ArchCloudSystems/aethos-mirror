interface AssistantOrbProps {
  /** Assistant presence name (e.g. "Aethos"). */
  name: string;
  /** Short presence phrase under the name. */
  presence: string;
}

/**
 * AssistantOrb — the central presence anchor of the mirror.
 *
 * Purely presentational: a glowing sphere with a halo, captioned with the
 * configurable assistant name and a short presence phrase. It makes no claims
 * about listening / wake word — presence text is supplied by the caller and
 * should stay honest (e.g. "Standing by").
 */
export function AssistantOrb({ name, presence }: AssistantOrbProps): JSX.Element {
  return (
    <div
      className="assistant-orb"
      role="img"
      aria-label={`${name} — ${presence}`}
    >
      <div className="assistant-orb__halo" aria-hidden="true" />
      <div className="assistant-orb__sphere" aria-hidden="true">
        <span className="assistant-orb__core" />
      </div>
      <div className="assistant-orb__caption">
        <span className="assistant-orb__name">{name}</span>
        <span className="assistant-orb__presence">{presence}</span>
      </div>
    </div>
  );
}
