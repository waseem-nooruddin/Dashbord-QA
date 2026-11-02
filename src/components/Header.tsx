import type { ThemeChoice } from "../lib/theme";

export type SyncState = "validating" | "validated" | "reconcile" | "failed";

const BADGE: Record<SyncState, string> = {
  validating: "Validating",
  validated: "Validated",
  reconcile: "Validated · reconciliation needed",
  failed: "Failed · showing last data",
};

interface Props {
  crumbs: { label: string; onClick?: () => void }[];
  title: string;
  sync: SyncState;
  syncNote: string | null;
  lastSync: string;
  theme: ThemeChoice;
  onTheme: (t: ThemeChoice) => void;
  onSync: () => void;
  syncing: boolean;
  onMenu: () => void;
  onSignOut: () => void;
  user: string;
}

export function Header(p: Props) {
  return (
    <header className="topbar">
      <div className="topbar-main">
        <button className="menu-btn mobile-only" onClick={p.onMenu} aria-label="Open menu">☰</button>
        <div className="titles">
          <nav aria-label="Breadcrumb">
            <ol className="crumbs">
              {p.crumbs.map((c, i) => (
                <li key={i}>
                  {c.onClick && i < p.crumbs.length - 1
                    ? <button className="crumb-btn" onClick={c.onClick}>{c.label}</button>
                    : <span aria-current={i === p.crumbs.length - 1 ? "page" : undefined}>{c.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
          <h1>{p.title}</h1>
        </div>
      </div>
      <div className="topbar-tools">
        <div className="sync-info">
          <span className={`badge badge-${p.sync}`} role="status" aria-live="polite">
            <span className="dot" aria-hidden="true" />{BADGE[p.sync]}
          </span>
          <span className="last-sync">Last sync {p.lastSync}</span>
          {p.syncNote && <span className="sync-note" title={p.syncNote}>{p.syncNote}</span>}
        </div>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {(["light", "dark", "auto"] as ThemeChoice[]).map((t) => (
            <button key={t} role="radio" aria-checked={p.theme === t} className={p.theme === t ? "on" : ""} onClick={() => p.onTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={p.onSync} disabled={p.syncing}>
          <span className={p.syncing ? "spin" : ""} aria-hidden="true">⟳</span> Sync Now
        </button>
        <button className="btn ghost" onClick={p.onSignOut} title={`Signed in as ${p.user}`}>Sign out</button>
      </div>
    </header>
  );
}
