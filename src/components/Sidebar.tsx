import { useState } from "react";
import type { MainModule } from "../lib/calc";
import type { Project } from "../lib/data";

export type View = "overall" | "detailed";

interface Props {
  projects: Project[];
  activeId: string;
  groups: MainModule[];
  main: string | null;
  sub: string | null;
  view: View;
  minimized: boolean;
  drawerOpen: boolean;
  onMinimize: () => void;
  onCloseDrawer: () => void;
  onProject: (id: string) => void;
  onView: (v: View) => void;
  onMain: (main: string) => void;
  onSub: (main: string, sub: string) => void;
  onAddProject: () => void;
}

export function Sidebar(p: Props) {
  const [treeOpen, setTreeOpen] = useState(true);
  const [openMains, setOpenMains] = useState<Record<string, boolean>>({});
  const isOpen = (name: string) => openMains[name] ?? p.main === name;

  return (
    <>
      {p.drawerOpen && <div className="scrim" onClick={p.onCloseDrawer} aria-hidden="true" />}
      <nav className={`sidebar${p.minimized ? " min" : ""}${p.drawerOpen ? " open" : ""}`} aria-label="Projects">
        <div className="brand">
          <span className="logo" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28"><rect width="32" height="32" rx="7" fill="#38BDF8" fillOpacity=".16" /><path d="M8 20l5-6 4 4 7-9" stroke="#38BDF8" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          {!p.minimized && <span className="brand-name">QA LiveSync</span>}
          <button className="side-icon desktop-only" onClick={p.onMinimize} aria-label={p.minimized ? "Expand sidebar" : "Minimise sidebar"} title={p.minimized ? "Expand sidebar" : "Minimise sidebar"}>
            {p.minimized ? "»" : "«"}
          </button>
          <button className="side-icon mobile-only" onClick={p.onCloseDrawer} aria-label="Close menu">✕</button>
        </div>

        {!p.minimized && <div className="side-label">Project Hub</div>}
        <ul className="tree">
          {p.projects.map((proj) => {
            const active = proj.id === p.activeId;
            return (
              <li key={proj.id}>
                <div className={`tree-row project${active ? " active" : ""}`}>
                  <button className="tree-btn" onClick={() => (active ? setTreeOpen((o) => !o) : (p.onProject(proj.id), setTreeOpen(true)))}
                    aria-expanded={active ? treeOpen : false} title={proj.name}>
                    <span className="proj-badge" aria-hidden="true">{proj.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3)}</span>
                    {!p.minimized && <span className="tree-text">{proj.name}</span>}
                    {!p.minimized && active && <span className="chev" aria-hidden="true">{treeOpen ? "▾" : "▸"}</span>}
                  </button>
                </div>
                {active && treeOpen && !p.minimized && (
                  <ul className="tree sub">
                    <li><button className={`tree-btn leaf${p.view === "overall" && !p.main ? " current" : ""}`} onClick={() => p.onView("overall")}>Overall Dashboard</button></li>
                    <li><button className={`tree-btn leaf${p.view === "detailed" ? " current" : ""}`} onClick={() => p.onView("detailed")}>Detailed Dashboard</button></li>
                    {p.groups.map((g) => {
                      const multi = g.modules.length > 1;
                      return (
                        <li key={g.name}>
                          <div className="tree-row">
                            <button className={`tree-btn leaf${p.main === g.name && (!p.sub || !multi) ? " current" : ""}`} onClick={() => p.onMain(g.name)}>
                              <span className="tree-text">{g.name}</span>
                              {multi && <span className="count">{g.modules.length}</span>}
                            </button>
                            {multi && (
                              <button className="side-icon small" aria-expanded={isOpen(g.name)} aria-label={`${isOpen(g.name) ? "Collapse" : "Expand"} ${g.name}`}
                                onClick={() => setOpenMains((o) => ({ ...o, [g.name]: !isOpen(g.name) }))}>
                                {isOpen(g.name) ? "▾" : "▸"}
                              </button>
                            )}
                          </div>
                          {multi && isOpen(g.name) && (
                            <ul className="tree subsub">
                              {g.modules.map((m) => (
                                <li key={m.module}>
                                  <button className={`tree-btn leaf${p.sub === m.module ? " current" : ""}`} onClick={() => p.onSub(g.name, m.module)}>
                                    {m.module.replace(/^(HRMS - |Member )/, "")}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        <button className="add-project" onClick={p.onAddProject} title="Add New Project">
          <span aria-hidden="true">＋</span>{!p.minimized && " Add New Project"}
        </button>
        {!p.minimized && (
          <p className="side-note">
            {p.projects.length} connected workbook{p.projects.length === 1 ? "" : "s"} · Google Sheets, read-only · synced every 3 min
          </p>
        )}
      </nav>
    </>
  );
}
