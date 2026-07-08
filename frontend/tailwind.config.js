/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
    theme: {
        extend: {
            fontFamily: {
                serif: ['"Playfair Display"', 'Georgia', 'serif'],
                sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            colors: {
                brand: {
                    forest: '#2C4A3B',
                    'forest-hover': '#1E3329',
                    terracotta: '#C86A53',
                    ochre: '#D99E41',
                    sky: '#6B8BA4',
                    sage: '#8A9A86',
                    charcoal: '#2C3E35',
                },
                surface: '#FFFFFF',
                page: '#F9F8F6',
                crisp: '#E5E3DB',
            },
            borderRadius: {
                lg: '12px',
                md: '8px',
                sm: '6px',
            },
        },
    },
    plugins: [],
};
