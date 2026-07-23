import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bosque: {
          50: "#f2f4f1",
          100: "#dde4da",
          600: "#2c4a37",
          700: "#1e3a2b",
          900: "#101f17",
        },
        tierra: {
          400: "#c79a4e",
          600: "#a9762f",
        },
      },
      fontFamily: {
        display: ["Georgia", "ui-serif", "serif"],
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
