// The one place formulas and DSI weights are defined (NFR-12); the page shows these strings.

export const DSI_WEIGHTS = { critical: 4, high: 3, medium: 2, low: 1 } as const;

/** Calculated DSI differs from the sheet's column X when the gap is larger than this. */
export const DSI_TOLERANCE = 0.005;

/** Modules under this share of Total TC are grouped as "Other modules" in chart 1. */
export const DONUT_MIN_SHARE = 0.02;

export const FORMULAS = {
  passRatio: "Test Pass Ratio = Passed ÷ Total TC",
  other: "Other = Blocked + Not Tested + On Hold + Not an Issue",
  statusDiff: "Status diff = (Passed + Failed + Other) − Total TC",
  dsi: `DSI = (${DSI_WEIGHTS.critical}·Critical + ${DSI_WEIGHTS.high}·High + ${DSI_WEIGHTS.medium}·Medium + ${DSI_WEIGHTS.low}·Low) ÷ (Critical + High + Medium + Low)`,
  ratios: "Ratios use aggregated counts for the scope, never an average of module ratios.",
};
