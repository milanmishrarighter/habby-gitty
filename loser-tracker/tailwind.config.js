/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0c0c0c",
        card: "#171717",
        card2: "#202020",
        line: "#2c2c2c",
        ink: "#ececec",
        mute: "#8b8b8b",
        good: "#8be3a8",
        close: "#f2c46d",
        over: "#ff7a6b",
      },
      fontFamily: { mono: ['"JetBrains Mono"', "ui-monospace", "monospace"] },
    },
  },
  plugins: [],
};
