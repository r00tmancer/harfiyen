import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages proje sayfası: https://<kullanici>.github.io/harfiyen/
export default defineConfig({
  base: '/harfiyen/',
  plugins: [react(), tailwindcss()],
});
