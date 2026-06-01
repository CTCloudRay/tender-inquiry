/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                surface: {
                    DEFAULT: '#141b2d',
                    light: '#1a2340',
                    dark: '#0f1629',
                },
                accent: {
                    DEFAULT: '#3b82f6',
                    light: '#60a5fa',
                    dim: '#1e3a5f',
                },
            },
            fontFamily: {
                sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
        },
    },
    plugins: [],
}
