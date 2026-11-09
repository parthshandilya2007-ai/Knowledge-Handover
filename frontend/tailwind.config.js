/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0B1533",
        panel: "#142650",
        panelHover: "#1B326B",
        accent: {
          DEFAULT: "#26D6C1",
          hover: "#20BBA8",
          muted: "rgba(38, 214, 193, 0.15)"
        },
        surface: {
          DEFAULT: "#0F1E42",
          border: "#203A70"
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#94A3B8",
          muted: "#64748B"
        }
      }
    },
  },
  plugins: [],
}
