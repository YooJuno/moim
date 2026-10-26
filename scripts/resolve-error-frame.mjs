import { readFileSync } from 'node:fs';
import { SourceMap } from 'node:module';
import { join } from 'node:path';

const [release, file, row, column] = process.argv.slice(2);
if (!/^(?:[a-f0-9]{7,40}-\d{8}T\d{6}Z|dev|unknown)$/.test(release ?? '') || !/^[-A-Za-z0-9_]+\.js$/.test(file ?? '') || !/^\d+$/.test(row ?? '') || !/^\d+$/.test(column ?? '') || Number(row) < 1 || Number(column) < 1) {
  process.stderr.write('Usage: node scripts/resolve-error-frame.mjs <release> <asset.js> <line> <column>\n'); process.exit(1);
}
try {
  const map = new SourceMap(JSON.parse(readFileSync(join('.debug/sourcemaps', release, `${file}.map`), 'utf8')));
  const entry = map.findEntry(Number(row) - 1, Number(column) - 1);
  if (!entry.originalSource || entry.originalLine === undefined) throw new Error('This frame has no source mapping.');
  process.stdout.write(JSON.stringify({ source: entry.originalSource, line: entry.originalLine + 1, column: entry.originalColumn + 1, ...(entry.name ? { name: entry.name } : {}) }) + '\n');
} catch (error) { process.stderr.write(error instanceof Error ? error.message + '\n' : 'Source map unavailable.\n'); process.exitCode = 1; }
