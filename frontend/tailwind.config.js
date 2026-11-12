/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: { DEFAULT: "#0f172a", hover: "#1e293b" },
        brand:   { DEFAULT: "#6366f1", hover: "#4f46e5", light: "#e0e7ff" },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
