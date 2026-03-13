import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');

// Copy static files to dist
function copyStaticFiles() {
  const staticFiles = [
    { src: 'src/manifest.json', dest: 'dist/manifest.json' },
    { src: 'src/popup/popup.html', dest: 'dist/popup/popup.html' },
    { src: 'src/popup/popup.css', dest: 'dist/popup/popup.css' },
    { src: 'src/options/options.html', dest: 'dist/options/options.html' },
    { src: 'src/options/options.css', dest: 'dist/options/options.css' },
    { src: 'src/fallback/reminder.html', dest: 'dist/fallback/reminder.html' },
    { src: 'src/fallback/reminder.css', dest: 'dist/fallback/reminder.css' },
    { src: 'src/content/modal.css', dest: 'dist/content/modal.css' },
  ];

  // Copy icons
  const iconDir = 'src/assets';
  if (fs.existsSync(iconDir)) {
    const icons = fs.readdirSync(iconDir);
    for (const icon of icons) {
      staticFiles.push({
        src: path.join(iconDir, icon),
        dest: path.join('dist/assets', icon),
      });
    }
  }

  for (const { src, dest } of staticFiles) {
    if (!fs.existsSync(src)) continue;
    const destDir = path.dirname(dest);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }

  console.log('Static files copied.');
}

// Entry points for esbuild
const entryPoints = [
  { in: 'src/background/service-worker.ts', out: 'background/service-worker' },
  { in: 'src/popup/popup.ts', out: 'popup/popup' },
  { in: 'src/options/options.ts', out: 'options/options' },
  { in: 'src/content/modal.ts', out: 'content/modal' },
  { in: 'src/fallback/reminder.ts', out: 'fallback/reminder' },
];

const buildOptions = {
  entryPoints: entryPoints.map(e => ({ in: e.in, out: e.out })),
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  target: 'es2020',
  minify: false,
  sourcemap: false,
  logLevel: 'info',
};

copyStaticFiles();

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await esbuild.build(buildOptions);
  console.log('Build complete.');
}
