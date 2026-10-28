import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Outfit", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "hsl(265,100%,97%)",
          100: "hsl(265,90%,93%)",
          200: "hsl(265,80%,84%)",
          300: "hsl(265,75%,74%)",
          400: "hsl(265,70%,63%)",
          500: "hsl(265,65%,52%)",
          600: "hsl(265,68%,42%)",
          700: "hsl(265,72%,33%)",
          800: "hsl(265,75%,24%)",
          900: "hsl(265,78%,16%)",
          950: "hsl(265,82%,10%)",
        },
        accent: {
          400: "hsl(32,100%,60%)",
          500: "hsl(32,96%,50%)",
          600: "hsl(32,90%,42%)",
        },
        surface: {
          50: "hsl(230,20%,98%)",
          100: "hsl(230,18%,95%)",
          800: "hsl(230,20%,12%)",
          900: "hsl(230,22%,8%)",
          950: "hsl(230,25%,5%)",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "hero-gradient":
          "linear-gradient(135deg, hsl(265,82%,10%) 0%, hsl(230,25%,5%) 50%, hsl(265,68%,14%) 100%)",
        "card-gradient":
          "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.4s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "countdown-tick": "countdownTick 0.2s ease-out",
        "badge-pop": "badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(16px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        countdownTick: {
          "0%": { transform: "scale(1.1)", color: "hsl(32,100%,60%)" },
          "100%": { transform: "scale(1)", color: "inherit" },
        },
        badgePop: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
    },
  },
  plugins: [],
};

export default config;
