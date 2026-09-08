import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const project = import.meta.dirname;
const output = path.join(project, 'site-static');
export default defineConfig({
  root: path.join(project, 'pages'),
  base: '/smart-petrol-gyeonggi/',
  publicDir: false,
  resolve: { alias: { '@': project } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: { outDir: output, emptyOutDir: true, target: ['chrome111', 'safari16.4'], sourcemap: false },
  plugins: [
    {
      name: 'pages-record-copy',
      enforce: 'pre',
      transform(code, id) {
        if (!id.endsWith('/components/petrol-app.tsx')) return;
        return code.replaceAll('현재 계정', '이 브라우저').replaceAll('계정에 보관', '이 브라우저에 보관').replaceAll('계정의 기록', '브라우저 기록');
      },
    },
    react(),
    {
      name: 'public-data-only',
      closeBundle() {
        const data = path.join(project, 'public/data');
        const names = ['manifest.json', 'inspection.json', 'lighting-summary.json', 'briefing.json', ...fs.readdirSync(path.join(data, 'regions')).filter(n => n.endsWith('.json')).map(n => 'regions/' + n)];
        for (const name of names) {
          const dest = path.join(output, 'data', name + '.gz');
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, gzipSync(fs.readFileSync(path.join(data, name)), { level: 9 }));
        }
        fs.mkdirSync(path.join(output, 'images'), { recursive: true });
        fs.copyFileSync(path.join(project, 'public/images/proposal-art.jpg'), path.join(output, 'images/proposal-art.jpg'));
        fs.writeFileSync(path.join(output, '.nojekyll'), '');
      },
    },
  ],
});
