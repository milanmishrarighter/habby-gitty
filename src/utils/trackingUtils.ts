"use client";

export const getTrackedValuesFromRecord = (record: any): string[] => {
  const v = record?.tracked_values;

  if (Array.isArray(v)) {
    return v.filter((x) => typeof x === "string" && x.trim() !== "");
  }

  if (typeof v === "string" && v.trim() !== "") {
    return [v];
  }

  // Fallbacks for legacy/singular columns
  const singular =
    record?.tracked_value ??
    record?.tracking_value ??
    record?.value ??
    null;

  if (typeof singular === "string" && singular.trim() !== "") {
    return [singular];
  }

  return [];
};

export const getTextValueFromRecord = (record: any): string | undefined => {
  const tv = record?.text_value ?? record?.text ?? record?.free_text ?? null;
  if (typeof tv === "string" && tv.trim() !== "") {
    return tv;
  }
  return undefined;
};