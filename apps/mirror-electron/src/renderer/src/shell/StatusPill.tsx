import type { ShellStatus } from "./status";

interface StatusPillProps {
  status: ShellStatus;
}

/**
 * Small coloured pill that renders an honest status label. The colour is
 * derived purely from the status tone; the text comes verbatim from the
 * status, so the UI can never drift into claiming "online" when it means
 * "not configured".
 */
export function StatusPill({ status }: StatusPillProps): JSX.Element {
  return (
    <span className={`status-pill status-pill--${status.tone}`}>
      <span className="status-pill__dot" aria-hidden="true" />
      <span className="status-pill__label">{status.label}</span>
    </span>
  );
}
