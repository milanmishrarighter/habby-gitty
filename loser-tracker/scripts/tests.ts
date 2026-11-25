import assert from "node:assert/strict";
import { evaluateFines, monthResult } from "../src/lib/fines";
import { parseCommand, parseNumber } from "../src/lib/voice";
import { monthOf, weekOf, dayLimit, monthIndexOf } from "../src/lib/cycles";

// --- Fines -------------------------------------------------------------------
const limit = 60000;
const rate = 10;
const months = (...totals: number[]) => totals.map((t, i) => monthResult(i, t, limit));

// Over by 500, then 300 under: ₹5,000 fine, ₹3,000 recovered, ₹2,000 owed.
let r = evaluateFines(months(60500, 59700), rate);
assert.deepEqual(r.resolved, [{ month: 0, over: 500, fine: 5000, recovered: 3000, owed: 2000 }]);
assert.equal(r.pending, null);

// Fully recovered.
r = evaluateFines(months(60500, 59000), rate);
assert.equal(r.resolved[0].owed, 0);

// Two bad months in a row: first paid in full, second pending.
r = evaluateFines(months(60500, 61000), rate);
assert.deepEqual(r.resolved, [{ month: 0, over: 500, fine: 5000, recovered: 0, owed: 5000 }]);
assert.deepEqual(r.pending, { month: 1, over: 1000, fine: 10000 });

// Being under never builds a balance for later.
r = evaluateFines(months(50000, 60500, 60000), rate);
assert.deepEqual(r.resolved, [{ month: 1, over: 500, fine: 5000, recovered: 0, owed: 5000 }]);

// Only one month finished and it was over: pending, nothing resolved.
r = evaluateFines(months(60500), rate);
assert.equal(r.resolved.length, 0);
assert.equal(r.pending?.fine, 5000);

// --- Voice -------------------------------------------------------------------
assert.deepEqual(parseCommand("Add 300 calories for dosa"), { calories: 300, food: "Dosa" });
assert.deepEqual(parseCommand("minus 200 calories for a walk"), { calories: -200, food: "Walk" });
assert.deepEqual(parseCommand("add 1,200 calories for chicken biryani."), { calories: 1200, food: "Chicken biryani" });
assert.deepEqual(parseCommand("add three hundred and fifty calories for poha"), { calories: 350, food: "Poha" });
assert.deepEqual(parseCommand("add 450 kcal for paneer roll"), { calories: 450, food: "Paneer roll" });
assert.deepEqual(parseCommand("add 150 for banana"), { calories: 150, food: "Banana" });
assert.deepEqual(parseCommand("plus 90 cal of coffee"), { calories: 90, food: "Coffee" });
assert.equal(parseCommand("what is the weather"), null);
assert.equal(parseCommand("add calories for dosa"), null);
assert.equal(parseNumber("two thousand five hundred"), 2500);
assert.equal(parseNumber("1.5k"), 1500);

// --- Months and weeks ----------------------------------------------------------
const start = "2026-11-30"; // Monday
assert.equal(monthIndexOf(start, "2026-11-30"), 0);
assert.equal(monthIndexOf(start, "2026-12-27"), 0);
assert.equal(monthIndexOf(start, "2026-12-28"), 1);
assert.equal(monthIndexOf(start, "2026-11-29"), -1);
assert.deepEqual([monthOf(start, "2026-12-10").start, monthOf(start, "2026-12-10").end], ["2026-11-30", "2026-12-27"]);
assert.deepEqual([weekOf(start, "2026-12-10").start, weekOf(start, "2026-12-10").end], ["2026-12-07", "2026-12-13"]);
const limits = { weekdayLimit: 2000, saturdayLimit: 2500, sundayLimit: 2800, weeklyLimit: 0, monthlyLimit: 0 };
assert.equal(dayLimit(limits, "2026-12-05"), 2500); // Saturday
assert.equal(dayLimit(limits, "2026-12-06"), 2800); // Sunday
assert.equal(dayLimit(limits, "2026-12-07"), 2000); // Monday

console.log("All tests passed");
