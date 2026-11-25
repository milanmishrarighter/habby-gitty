/**
 * Understands "add 300 calories for dosa" and "minus 200 calories for a walk",
 * plus the usual ways speech recognition writes them down.
 */
export interface ParsedCommand {
  calories: number; // negative for minus
  food: string;
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** "three hundred and fifty" → 350, "1,200" → 1200, "1.5k" → 1500. */
export const parseNumber = (text: string): number | null => {
  const cleaned = text.trim().toLowerCase().replace(/,/g, "");
  const k = cleaned.match(/^(\d+(?:\.\d+)?)\s*k$/);
  if (k) return Math.round(parseFloat(k[1]) * 1000);
  if (/^\d+(\.\d+)?$/.test(cleaned)) return Math.round(parseFloat(cleaned));

  let total = 0;
  let current = 0;
  let seen = false;
  for (const word of cleaned.split(/[\s-]+/)) {
    if (word === "and" || word === "a") continue;
    if (word in UNITS) { current += UNITS[word]; seen = true; }
    else if (/^\d+$/.test(word)) { current += Number(word); seen = true; }
    else if (word === "hundred") { current = (current || 1) * 100; seen = true; }
    else if (word === "thousand") { total += (current || 1) * 1000; current = 0; seen = true; }
    else return null;
  }
  return seen ? total + current : null;
};

const MINUS = ["minus", "subtract", "remove", "less", "burned", "burnt", "burn"];
const PLUS = ["add", "plus", "ad", "at", "had", "ate"];
const UNIT = String.raw`(?:k\s?cals?|kilo\s?calories|calories|calorie|cals?)`;
const COMMAND = new RegExp(
  String.raw`^(${[...MINUS, ...PLUS].join("|")})\s+(.+?)\s+${UNIT}\b\s*(?:(?:for|of|from|on|in)\b\s*)?(.*)$`,
);
// Recognisers sometimes drop the word "calories".
const COMMAND_NO_UNIT = new RegExp(
  String.raw`^(${[...MINUS, ...PLUS].join("|")})\s+([\d,.]+k?)\s+(?:(?:for|of|from|on|in)\b\s*)?(.*)$`,
);

export const parseCommand = (heard: string): ParsedCommand | null => {
  const text = heard.trim().toLowerCase().replace(/[.!?]+$/, "").replace(/\s+/g, " ");
  const match = text.match(COMMAND) || text.match(COMMAND_NO_UNIT);
  if (!match) return null;
  const [, verb, amount, rest] = match;
  const calories = parseNumber(amount);
  if (calories === null || calories <= 0) return null;
  const food = rest.trim().replace(/^(?:a|an|the|some)\s+/, "");
  if (!food) return null;
  return {
    calories: MINUS.includes(verb) ? -calories : calories,
    food: food.charAt(0).toUpperCase() + food.slice(1),
  };
};

/** The first of the recogniser's guesses that reads as a command. */
export const parseBestMatch = (matches: string[]): ParsedCommand | null => {
  for (const heard of matches) {
    const parsed = parseCommand(heard);
    if (parsed) return parsed;
  }
  return null;
};
