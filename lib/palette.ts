/**
 * Swatches offered when creating a category, in the order they're handed out.
 * Validated (dataviz validate_palette.js) against both the light (#fcf9f2) and
 * dark (#25272a) canvas: lightness band, chroma, adjacent-pair colour-blind
 * separation and 3:1 contrast all pass. Re-run it before changing a value or
 * the order — green next to rose fails for deuteranopes.
 */
export const SWATCHES = [
  "#3b6fd1", // blue
  "#c8701c", // orange
  "#2f9e6b", // green
  "#8b5cf6", // violet
  "#c2415d", // rose
  "#0f9bb0", // teal
  "#a88400", // mustard
  "#b8489a", // magenta
];

export const STARTER_CATEGORIES = [
  { name: "Exercise", color: SWATCHES[0], unit: "min" },
  { name: "Reading", color: SWATCHES[1], unit: "pages" },
];
