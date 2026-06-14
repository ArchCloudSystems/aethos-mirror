import type { ReactNode } from "react";
import type { ShellStatus } from "./status";
import { StatusPill } from "./StatusPill";

interface MirrorWidgetProps {
  title: string;
  status: ShellStatus;
  children: ReactNode;
  /** Optional extra class for zone-specific sizing. */
  className?: string;
}

/**
 * MirrorWidget — glass panel wrapper shared by every widget zone. Provides the
 * consistent header (title + honest status pill) and the dark glass surface.
 * Keeping this in one place means all zones stay visually uniform and every
 * widget is forced to declare an honest status.
 */
export function MirrorWidget({
  title,
  status,
  children,
  className
}: MirrorWidgetProps): JSX.Element {
  return (
    <section className={`mirror-widget${className ? ` ${className}` : ""}`}>
      <header className="mirror-widget__head">
        <h2 className="mirror-widget__title">{title}</h2>
        <StatusPill status={status} />
      </header>
      <div className="mirror-widget__body">{children}</div>
    </section>
  );
}
