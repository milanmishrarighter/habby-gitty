import { Standing } from "./cycles";

export const kcal = (n: number) => Math.round(n).toLocaleString("en-IN");
export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${kcal(Math.abs(n))}`;

export const STANDING_COLOR: Record<Standing, string> = {
  good: "#8be3a8",
  close: "#f2c46d",
  over: "#ff7a6b",
  unset: "#5a5a5a",
};

export const STANDING_TEXT: Record<Standing, string> = {
  good: "text-good",
  close: "text-close",
  over: "text-over",
  unset: "text-mute",
};
