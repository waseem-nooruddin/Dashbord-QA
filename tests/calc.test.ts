import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { parseRows } from "../src/lib/adapter";
import { dsi, groupModules, mainModuleOf, moduleChecks, sumRows } from "../src/lib/calc";
import { csvEscape, toCsv } from "../src/lib/export";
import synthetic from "./fixtures/synthetic.json";

const rows = parseRows(synthetic as string[][]);
const byName = (n: string) => rows.find((r) => r.module === n)!;

describe("adapter (SRS 5.1)", () => {
  it("drops blank rows and keeps name-only rows as no-data modules", () => {
    expect(rows.map((r) => r.module)).toEqual([
      "HRMS - Alpha", "HRMS - Beta", "Member Gamma", "Member Delta", "Standalone", "Retire", "Named Only",
    ]);
    expect(byName("Named Only").hasData).toBe(false);
    expect(byName("Named Only").totalTc).toBe(0);
  });

  it("maps columns by position and reads the sheet DSI from column X", () => {
    const a = byName("HRMS - Alpha");
    expect(a).toMatchObject({
      totalTc: 100, executed: 90, openDefects: 10, closedDefects: 5, passed: 70, failed: 20,
      blocked: 5, notTested: 5, onHold: 0, notAnIssue: 0,
      sevCritical: 1, sevHigh: 2, sevMedium: 3, sevLow: 4, priHigh: 5, priMedium: 5, priLow: 5, dsiSheet: 2,
    });
  });
});

describe("grouping (SRS 5.4)", () => {
  it("groups HRMS - and Member prefixes; everything else is its own main module", () => {
    expect(mainModuleOf("HRMS - Payroll")).toBe("HRMS");
    expect(mainModuleOf("Member Termination")).toBe("Member");
    expect(mainModuleOf("Membership")).toBe("Membership");
    expect(groupModules(rows).map((g) => [g.name, g.modules.length])).toEqual([
      ["HRMS", 2], ["Member", 2], ["Standalone", 1], ["Retire", 1], ["Named Only", 1],
    ]);
  });
});

describe("derived metrics (SRS 5.2)", () => {
  it("sums counts and computes ratios from aggregated counts", () => {
    const t = sumRows(rows);
    expect(t.totalTc).toBe(270);
    expect(t.passed).toBe(190);
    expect(t.open).toBe(23);
    expect(t.closed).toBe(8);
    expect(t.totalDefects).toBe(31);
    expect(t.passRatio).toBeCloseTo(190 / 270, 10);
    expect(t.modules).toBe(7);
  });

  it("computes DSI with weights 4/3/2/1 and returns null without classified defects", () => {
    expect(dsi({ c: 0, h: 25, m: 50, l: 19 })).toBeCloseTo(2.063829787, 6);
    expect(dsi({ c: 0, h: 0, m: 0, l: 0 })).toBeNull();
    const hrms = sumRows(groupModules(rows)[0].modules);
    expect(hrms.dsi).toBeCloseTo(30 / 14, 10);
  });

  it("returns null ratios when the scope has no test cases", () => {
    expect(sumRows([byName("Named Only")]).passRatio).toBeNull();
  });
});

describe("validation (SRS 5.3)", () => {
  it("flags status diff, no TC data, missing priority and DSI mismatch", () => {
    const c = Object.fromEntries(rows.map((r) => [r.module, moduleChecks(r)]));
    expect(c["HRMS - Alpha"]).toMatchObject({ statusDiff: 0, noTcData: false, noPriority: false, dsiMismatch: false });
    expect(c["Member Gamma"]).toMatchObject({ statusDiff: 6, noPriority: true });
    expect(c["Member Delta"].dsiMismatch).toBe(false);
    expect(c["Standalone"].dsiMismatch).toBe(true);
    expect(c["Retire"]).toMatchObject({ noTcData: true, dsiMismatch: false });
    expect(c["Named Only"].noTcData).toBe(true);
  });
});

describe("CSV export (FR-44)", () => {
  it("escapes formula-leading text cells but not numbers", () => {
    expect(csvEscape("=HYPERLINK(1)")).toBe("\"'=HYPERLINK(1)\"");
    expect(csvEscape("+1")).toBe("\"'+1\"");
    expect(csvEscape("@x")).toBe("\"'@x\"");
    expect(csvEscape("-cmd")).toBe("\"'-cmd\"");
    expect(csvEscape(-41)).toBe("-41");
    expect(csvEscape('a "b", c')).toBe('"a ""b"", c"');
    expect(toCsv([["A", "B"], [1, "x"]])).toBe('"A","B"\r\n1,"x"');
  });
});

// Real sheet data is kept out of the public repo; this runs only where the local fixture exists.
const LOCAL = new URL("./fixtures/local/sheets-2026-11-02.json", import.meta.url);
describe.runIf(existsSync(LOCAL))("live sheets 2 Nov 2026 (SRS 9)", () => {
  const data = existsSync(LOCAL) ? JSON.parse(readFileSync(LOCAL, "utf8")) as Record<string, string[][]> : {};

  it("EDCS KPIs equal column sums", () => {
    const t = sumRows(parseRows(data.EDCS));
    expect(t.modules).toBe(19);
    expect(t.totalTc).toBe(4524);
    expect(t.passed).toBe(2981);
    expect(t.open).toBe(596);
    expect((t.passRatio! * 100).toFixed(1)).toBe("65.9");
  });

  it("module counts match SRS 2.4", () => {
    expect(parseRows(data.DIE)).toHaveLength(3);
    expect(parseRows(data["DIE Data Sharing"])).toHaveLength(7);
  });

  it("calculated DSI matches the sheet DSI to 2 decimals for every module", () => {
    for (const name of Object.keys(data)) {
      for (const r of parseRows(data[name])) {
        expect(moduleChecks(r).dsiMismatch, `${name} / ${r.module}`).toBe(false);
      }
    }
  });
});
