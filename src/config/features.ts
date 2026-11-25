/**
 * Calorie and weight tracking moved to the separate Loser Tracker Android app.
 * Off, Habby hides the Health card and the Health Analytics tab and stops
 * saving health data or charging health fines (the 2500 kcal fine, missed
 * day, cheat day). Everything already recorded stays in the database; flip
 * this back to true to bring the section back.
 */
export const HEALTH_TRACKING_ENABLED = false;
