/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@napare/design-tokens/tailwind')],
  content: ['./src/pages/**/*.{js,ts,jsx,tsx,mdx}', './src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/ui/src/**/*.{js,ts,jsx,tsx}'],
  // Keep legacy page utility names while using the teacher workspace's blue brand.
  theme: { extend: { colors: { indigo: {
    50: '#eef4ff', 100: '#dce8ff', 200: '#bfd3ff', 300: '#91b4ff', 400: '#5c8eff',
    500: '#316cf8', 600: '#1559ef', 700: '#1048c4', 800: '#123b98', 900: '#153678', 950: '#0b1738',
  } } } },
  plugins: [],
};
