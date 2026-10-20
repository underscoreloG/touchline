// Builds standalone HTML files from src/ with esbuild.
//   node tools/build.js                      -> dist/index.html (the game)
//   node tools/build.js --demo <entry.js> <out.html> [--css a.css,b.css] [--title T] [--body "<div id=root></div>"]
// Rules: everything inlined, no network at runtime. ES modules are bundled into one IIFE.
// The Web Worker (src/logic/worker.js) is bundled separately and embedded as a Blob URL source string.

import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSounds } from './build-sounds.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p) => join(ROOT, p);

async function bundleJs(entry, { format = 'iife', define = {} } = {}) {
  const res = await build({
    entryPoints: [entry], bundle: true, write: false, format, minify: false,
    target: 'es2022', legalComments: 'none', define, logLevel: 'warning',
  });
  return res.outputFiles[0].text;
}

const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

export async function buildHtml({ entry, css = [], title = 'Touchline', body = '<div id="root"></div>', vendor = ['gsap.min.js', 'confetti.min.js'], withWorker = false }) {
  let workerSrc = '';
  if (withWorker && existsSync(rel('src/logic/worker.js'))) workerSrc = await bundleJs(rel('src/logic/worker.js'));
  const js = await bundleJs(entry);
  const cssText = css.map((f) => readFileSync(f, 'utf8')).join('\n');
  const vendorText = vendor.filter((v) => existsSync(rel('src/vendor/' + v))).map((v) => readFileSync(rel('src/vendor/' + v), 'utf8')).join('\n;\n');
  const workerTag = workerSrc ? `<script id="worker-src" type="text/plain">${esc(workerSrc)}</script>\n` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<style>
${cssText}
</style>
</head>
<body>
${body}
${workerTag}<script>
${esc(vendorText)}
</script>
<script>
${esc(js)}
</script>
</body>
</html>
`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--demo') {
    const [, entry, out] = args;
    const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
    const css = (opt('--css', '') || '').split(',').filter(Boolean).map((f) => resolve(f));
    const html = await buildHtml({ entry: resolve(entry), css, title: opt('--title', 'Demo'), body: opt('--body', '<div id="root"></div>') });
    mkdirSync(dirname(resolve(out)), { recursive: true });
    writeFileSync(resolve(out), html);
    console.log(`demo built: ${out} (${(html.length / 1024).toFixed(0)} KB)`);
    return;
  }
  buildSounds();
  const shell = readFileSync(rel('src/index.html'), 'utf8');
  const bodyMatch = shell.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const css = ['tokens.css', 'card.css', 'holo.css', 'screens.css', 'squad.css', 'match.css'].map((f) => rel('src/styles/' + f)).filter(existsSync);
  const html = await buildHtml({ entry: rel('src/main.js'), css, title: 'Touchline', body: bodyMatch ? bodyMatch[1] : '<div id="app"></div>', withWorker: true });
  mkdirSync(rel('dist'), { recursive: true });
  writeFileSync(rel('dist/index.html'), html);
  console.log(`dist/index.html built (${(html.length / 1024).toFixed(0)} KB)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
