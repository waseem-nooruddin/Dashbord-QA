import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { parseRows } from "./lib/adapter";
import { groupModules, mainModuleOf, moduleChecks, sumRows } from "./lib/calc";
import { PALETTES, useTheme } from "./lib/theme";
import {
  DEMO, isApproved, loadProjects, loadSnapshotMetas, loadSnapshotValues, supabase, syncNow,
  type Project, type SnapshotMeta,
} from "./lib/data";
import { FORMULAS } from "./lib/formulas";
import { Charts } from "./components/Charts";
import { DetailedTable } from "./components/DetailedTable";
import { FilterBar } from "./components/FilterBar";
import { Header, type SyncState } from "./components/Header";
import { KpiCards } from "./components/KpiCards";
import { Sidebar, type View } from "./components/Sidebar";

const POLL_MS = 60_000;

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [approved, setApproved] = useState<boolean | null>(null);

  useEffect(() => {
    if (DEMO) { setSession({ user: { id: "demo", email: "demo@local" } } as Session); return; }
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setApproved(null);
    if (session) isApproved().then(setApproved).catch(() => setApproved(false));
  }, [session?.user.id]);

  if (session === undefined || (session && approved === null)) return <Splash text="Loading…" />;
  if (!session) return <Login />;
  if (!approved) return <NotApproved email={session.user.email ?? ""} />;
  return <Dashboard email={session.user.email ?? ""} />;
}

function Splash({ text }: { text: string }) {
  return <div className="splash"><div className="spinner" aria-hidden="true" /><p>{text}</p></div>;
}

function Login() {
  const [err, setErr] = useState<string | null>(null);
  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
    if (error) setErr(error.message);
  };
  return (
    <main className="auth">
      <div className="auth-card card">
        <svg viewBox="0 0 32 32" width="44" height="44" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#0B2858" /><path d="M8 20l5-6 4 4 7-9" stroke="#38BDF8" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <h1>QA LiveSync</h1>
        <p>Live QA reporting for EDCS, DIE and DIE Data Sharing. Sign in with an approved Google account.</p>
        <button className="btn primary big" onClick={signIn}>Sign in with Google</button>
        {err && <p className="warn" role="alert">{err}</p>}
      </div>
    </main>
  );
}

function NotApproved({ email }: { email: string }) {
  return (
    <main className="auth">
      <div className="auth-card card">
        <h1>Access not approved</h1>
        <p><b>{email}</b> is not on the approved list for QA LiveSync. Ask the QA lead to add your account.</p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </main>
  );
}

const fmtTime = (iso: string | undefined) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

function Dashboard({ email }: { email: string }) {
  const { choice, setChoice, theme } = useTheme();
  const [projects, setProjects] = useState<Project[]>([]);
  const [metas, setMetas] = useState<SnapshotMeta[]>([]);
  const [values, setValues] = useState<Map<number, string[][]>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string>("");
  const [main, setMain] = useState<string | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [view, setView] = useState<View>("overall");
  const [snapshotChoice, setSnapshotChoice] = useState<number | "latest">("latest");

  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = useCallback(async () => {
    const [p, m] = await Promise.all([loadProjects(), loadSnapshotMetas()]);
    setProjects(p);
    setMetas(m);
    setProjectId((cur) => cur || p[0]?.id || "");
  }, []);

  // FR-03: read on open; afterwards poll the stored snapshots, which the server refreshes every 3 minutes.
  useEffect(() => {
    refresh().catch((e) => setLoadError(String(e.message ?? e)));
    const t = setInterval(() => refresh().catch(() => undefined), POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const project = projects.find((p) => p.id === projectId);
  const projectMetas = useMemo(() => metas.filter((m) => m.project_id === projectId), [metas, projectId]);
  const okMetas = useMemo(() => projectMetas.filter((m) => m.status === "ok"), [projectMetas]);
  const latestOk = okMetas[0];
  const latestAttempt = projectMetas[0];
  const snapshot = snapshotChoice === "latest" ? latestOk : okMetas.find((m) => m.id === snapshotChoice) ?? latestOk;

  useEffect(() => {
    if (!snapshot || values.has(snapshot.id)) return;
    loadSnapshotValues(snapshot.id)
      .then((v) => setValues((m) => new Map(m).set(snapshot.id, v)))
      .catch((e) => setLoadError(String(e.message ?? e)));
  }, [snapshot?.id]);

  const rows = useMemo(() => (snapshot && values.has(snapshot.id) ? parseRows(values.get(snapshot.id)!) : null), [snapshot, values]);
  const groups = useMemo(() => (rows ? groupModules(rows) : []), [rows]);

  const scopeRows = useMemo(() => {
    if (!rows) return [];
    if (sub) return rows.filter((r) => r.module === sub);
    if (main) return rows.filter((r) => mainModuleOf(r.module) === main);
    return rows;
  }, [rows, main, sub]);
  const totals = useMemo(() => sumRows(scopeRows), [scopeRows]);
  const scopeSet = useMemo(() => new Set(scopeRows.map((r) => r.module)), [scopeRows]);
  const ctx = useMemo(() => (rows ? { rows, scope: scopeSet, totals, pal: PALETTES[theme] } : null), [rows, scopeSet, totals, theme]);

  const reset = () => { setMain(null); setSub(null); setSnapshotChoice("latest"); };
  const chooseProject = (id: string) => { setProjectId(id); reset(); setView("overall"); setDrawer(false); };
  const chooseMain = (m: string | null) => { setMain(m); setSub(null); setView("overall"); setDrawer(false); };
  const chooseSub = (m: string, s: string | null) => { setMain(m); setSub(s); setView("overall"); setDrawer(false); };

  // FR-15: clicking a module focuses on it; clicking the focused module clears the focus.
  const focusModule = (module: string) => {
    const m = mainModuleOf(module);
    const multi = (groups.find((g) => g.name === m)?.modules.length ?? 0) > 1;
    const already = multi ? sub === module : main === m && !sub;
    if (already) { setMain(null); setSub(null); return; }
    setMain(m);
    setSub(multi ? module : null);
  };

  const doSync = async () => {
    setSyncing(true);
    setSyncNote(null);
    const res = await syncNow();
    if (!res.ok) setSyncNote(res.message ?? "Sync failed");
    await refresh().catch(() => undefined);
    setSyncing(false);
  };

  const unreconciled = scopeRows.some((r) => r.totalTc > 0 && moduleChecks(r).statusDiff !== 0);
  const failedSinceOk = !!latestAttempt && latestAttempt.status === "failed" && (!latestOk || latestAttempt.synced_at > latestOk.checked_at);
  const syncState: SyncState = syncing || !rows ? "validating" : failedSinceOk ? "failed" : unreconciled ? "reconcile" : "validated";

  if (loadError && !rows) return <Splash text={`Could not load data: ${loadError}`} />;
  if (!project) return <Splash text="Loading projects…" />;

  const scopeName = sub ?? main ?? "All modules";
  const viewName = view === "detailed" ? "Detailed Dashboard" : "Overall Dashboard";
  const crumbs = [
    { label: "Project Hub", onClick: () => chooseProject(projects[0].id) },
    { label: project.name, onClick: () => { reset(); setView("overall"); } },
    ...(main ? [{ label: main, onClick: () => setSub(null) }] : []),
    ...(sub ? [{ label: sub.replace(/^(HRMS - |Member )/, "") }] : []),
    ...(!main ? [{ label: viewName }] : []),
  ];
  const meta = {
    reportName: `QA LiveSync — ${project.name}`,
    scope: scopeName,
    source: `${project.tab} (Google Sheets)`,
    lastSync: fmtTime(snapshot?.checked_at),
  };

  return (
    <div className={`layout${minimized ? " side-min" : ""}`}>
      <a href="#main" className="skip">Skip to content</a>
      <Sidebar
        projects={projects} activeId={projectId} groups={groups} main={main} sub={sub} view={view}
        minimized={minimized} drawerOpen={drawer}
        onMinimize={() => setMinimized((m) => !m)} onCloseDrawer={() => setDrawer(false)}
        onProject={chooseProject}
        onView={(v) => { setView(v); setMain(null); setSub(null); setDrawer(false); }}
        onMain={(m) => chooseMain(m)} onSub={(m, s) => chooseSub(m, s)}
        onAddProject={() => setAddOpen(true)}
      />
      <div className="content">
        <Header
          crumbs={crumbs} title={`${project.name} — ${viewName}`} sync={syncState} syncNote={syncNote}
          lastSync={fmtTime(latestOk?.checked_at)} theme={choice} onTheme={setChoice}
          onSync={doSync} syncing={syncing} onMenu={() => setDrawer(true)}
          onSignOut={() => supabase.auth.signOut()} user={email}
        />
        <main id="main" className="page">
          <FilterBar
            projects={projects} projectId={projectId} groups={groups} main={main} sub={sub}
            snapshots={okMetas} snapshotId={snapshotChoice}
            onProject={chooseProject} onMain={chooseMain} onSub={(s) => chooseSub(main!, s)}
            onSnapshot={setSnapshotChoice} onReset={reset}
          />
          <p className="scope-line">
            <b>{project.name}</b> · {scopeName}{scopeRows.length > 1 ? ` (${scopeRows.length} modules)` : ""} · Source: <i>{project.tab}</i>
            {snapshotChoice !== "latest" && snapshot && <> · Snapshot of {fmtTime(snapshot.synced_at)}</>}
          </p>
          {!rows || !ctx ? (
            <Splash text={latestOk ? "Loading snapshot…" : "No data synced for this project yet."} />
          ) : (
            <>
              <KpiCards t={totals} />
              {view === "overall" && <Charts ctx={ctx} onSelect={focusModule} />}
              <DetailedTable rows={scopeRows} totalLabel={`Total — ${scopeName}`} meta={meta} focused={sub ?? (main && scopeRows.length === 1 ? main : null)} onSelect={focusModule} />
              <footer className="formulas card">
                <h3>How figures are calculated</h3>
                <ul>{Object.values(FORMULAS).map((f) => <li key={f}>{f}</li>)}</ul>
              </footer>
            </>
          )}
        </main>
      </div>
      {addOpen && (
        <div className="modal-back" role="dialog" aria-modal="true" aria-labelledby="add-title" onClick={() => setAddOpen(false)}>
          <div className="modal card" onClick={(e) => e.stopPropagation()}>
            <h2 id="add-title">Add a project</h2>
            <p>Connecting a workbook from the dashboard (Google Picker) is planned. For now an administrator adds one row to the <code>projects</code> table in Supabase with the project name and workbook ID, then shares the workbook with the sync service account as Viewer. No code change is needed.</p>
            <button className="btn primary" onClick={() => setAddOpen(false)} autoFocus>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
