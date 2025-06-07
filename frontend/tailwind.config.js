/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'background': '#0D111C',
        'foreground': '#FFFFFF',
        'card': '#161B26',
        'card-foreground': '#FFFFFF',
        'primary': '#0052FF',
        'primary-foreground': '#FFFFFF',
        'secondary': '#374151',
        'secondary-foreground': '#FFFFFF',
        'muted': '#1F2937',
        'muted-foreground': '#9CA3AF',
        'border': '#374151',
        'input': '#1F2937',
        'ring': '#0052FF',
        'success': '#16A34A',
        'success-foreground': '#FFFFFF',
        'error': '#DC2626',
        'error-foreground': '#FFFFFF',
      },
      borderRadius: {
        lg: `0.5rem`,
        md: `calc(0.5rem - 2px)`,
        sm: `calc(0.5rem - 4px)`,
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}