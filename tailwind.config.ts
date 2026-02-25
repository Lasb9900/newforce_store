import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--brand-primary)",
          secondary: "var(--brand-secondary)",
          accent: "var(--brand-accent)",
          ink: "var(--brand-ink)",
          bg: "var(--brand-bg)",
        },
        surface: "var(--surface)",
        surfaceMuted: "var(--surface-muted)",
        uiBorder: "var(--ui-border)",
        mutedText: "var(--muted-text)",
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
