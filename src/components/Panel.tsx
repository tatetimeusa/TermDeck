import type { ReactNode } from 'react';

export function Panel({
  title,
  accent,
  children,
  right,
}: {
  title: string;
  accent: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className={`panel accent-${accent}`}>
      <div className="panel-head">
        <span className="panel-title">┤ {title} ├</span>
        {right && <span className="panel-right">{right}</span>}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
