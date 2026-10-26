import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default defineConfig(({ command, mode }) => {
  let revision = 'unknown';
  try { revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* Local exports may lack git metadata. */ }
  const builtAt = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const release = command === 'serve' ? 'dev' : /^[a-f0-9]{7,40}$/.test(revision) ? `${revision}-${builtAt}` : 'unknown';
  return { plugins: [react(), {
    name: 'archive-private-source-maps', apply: 'build',
    closeBundle() {
      if (mode === 'demo' || !existsSync('dist/assets')) return;
      const archiveRoot = '.debug/sourcemaps';
      const target = join(archiveRoot, release); mkdirSync(target, { recursive: true });
      for (const file of readdirSync('dist/assets').filter(file => file.endsWith('.js.map'))) copyFileSync(join('dist/assets', file), join(target, file));
      writeFileSync(join(target, 'build.json'), JSON.stringify({ release, revision, builtAt }));
      const builds = readdirSync(archiveRoot).filter(file => /^[a-f0-9]{7,40}-\d{8}T\d{6}Z$/.test(file) && existsSync(join(archiveRoot, file, 'build.json')))
        .sort((a, b) => statSync(join(archiveRoot, b)).mtimeMs - statSync(join(archiveRoot, a)).mtimeMs);
      for (const old of builds.slice(10)) rmSync(join(archiveRoot, old), { recursive: true });
    },
  }], define: { __APP_RELEASE__: JSON.stringify(release) }, build: { sourcemap: 'hidden' } };
});
