import type { MainModule } from "../lib/calc";
import type { Project, SnapshotMeta } from "../lib/data";

interface Props {
  projects: Project[];
  projectId: string;
  groups: MainModule[];
  main: string | null;
  sub: string | null;
  snapshots: SnapshotMeta[];
  snapshotId: number | "latest";
  onProject: (id: string) => void;
  onMain: (m: string | null) => void;
  onSub: (s: string | null) => void;
  onSnapshot: (id: number | "latest") => void;
  onReset: () => void;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export function FilterBar(p: Props) {
  const group = p.groups.find((g) => g.name === p.main);
  const subs = group && group.modules.length > 1 ? group.modules : [];
  return (
    <section className="filters card" aria-label="Filters">
      <label>
        <span>Project</span>
        <select value={p.projectId} onChange={(e) => p.onProject(e.target.value)}>
          {p.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <label>
        <span>Main Module</span>
        <select value={p.main ?? ""} onChange={(e) => p.onMain(e.target.value || null)}>
          <option value="">All main modules</option>
          {p.groups.map((g) => <option key={g.name} value={g.name}>{g.name}{g.modules.length > 1 ? ` (${g.modules.length})` : ""}</option>)}
        </select>
      </label>
      <label>
        <span>Submodule</span>
        <select value={p.sub ?? ""} onChange={(e) => p.onSub(e.target.value || null)} disabled={subs.length === 0}>
          <option value="">{subs.length ? "All submodules" : "—"}</option>
          {subs.map((m) => <option key={m.module} value={m.module}>{m.module}</option>)}
        </select>
      </label>
      <label>
        <span>Reporting date</span>
        <select value={String(p.snapshotId)} onChange={(e) => p.onSnapshot(e.target.value === "latest" ? "latest" : Number(e.target.value))}>
          <option value="latest">Latest sync</option>
          {p.snapshots.map((s) => <option key={s.id} value={s.id}>{when(s.synced_at)}</option>)}
        </select>
      </label>
      <button className="btn" onClick={p.onReset}>Reset Filters</button>
    </section>
  );
}
