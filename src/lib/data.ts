import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

export interface Project {
  id: string;
  name: string;
  spreadsheet_id: string;
  tab: string;
  sort: number;
}

export interface SnapshotMeta {
  id: number;
  project_id: string;
  synced_at: string;
  checked_at: string;
  status: "ok" | "failed";
  error: string | null;
}

export const DEMO = !!import.meta.env.VITE_DEMO;
const demo = () => import("./demo");

export async function isApproved(): Promise<boolean> {
  if (DEMO) return true;
  const { data, error } = await supabase.rpc("is_approved");
  if (error) throw error;
  return data === true;
}

export async function loadProjects(): Promise<Project[]> {
  if (DEMO) return (await demo()).projects;
  const { data, error } = await supabase.from("projects").select("id, name, spreadsheet_id, tab, sort").eq("enabled", true).order("sort");
  if (error) throw error;
  return data;
}

/** Recent snapshot history for every project, newest first (no cell values). */
export async function loadSnapshotMetas(): Promise<SnapshotMeta[]> {
  if (DEMO) return (await demo()).metas;
  const { data, error } = await supabase
    .from("snapshots")
    .select("id, project_id, synced_at, checked_at, status, error")
    .order("synced_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data as SnapshotMeta[];
}

export async function loadSnapshotValues(id: number): Promise<string[][]> {
  if (DEMO) return (await demo()).values(id);
  const { data, error } = await supabase.from("snapshots").select("values").eq("id", id).single();
  if (error) throw error;
  return (data.values ?? []) as string[][];
}
