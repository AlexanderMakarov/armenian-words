import { build } from 'bun';
import { writeFileSync, copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { compileAsync } from 'sass';

mkdirSync('dist', { recursive: true });
mkdirSync('dist/static', { recursive: true });
mkdirSync('dist/static/assets', { recursive: true });

// Compile Sass to CSS
const sassResult = await compileAsync('src/styles.scss', { sourceMap: true });
writeFileSync('dist/static/styles.css', sassResult.css);
if (sassResult.sourceMap) {
    writeFileSync('dist/static/styles.css.map', sassResult.sourceMap.toString());
}

// Build TypeScript
await build({
    entrypoints: ['src/main.ts'],
    outdir: 'dist/static',
    target: 'browser',
    format: 'esm',
    minify: false,
});

// Build HTML (Bun will process it and update asset paths)
await build({
    entrypoints: ['src/index.html'],
    outdir: 'dist',
    target: 'browser',
    minify: false,
});

// Copy vocabulary.json to static folder
copyFileSync('vocabulary.json', 'dist/static/vocabulary.json');

// Copy assets from src/assets/ to dist/static/assets/
function copyAssets(srcDir: string, destDir: string) {
    if (!statSync(srcDir).isDirectory()) return;
    mkdirSync(destDir, { recursive: true });
    const entries = readdirSync(srcDir, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = join(srcDir, entry.name);
        const destPath = join(destDir, entry.name);
        if (entry.isDirectory()) {
            copyAssets(srcPath, destPath);
        } else {
            copyFileSync(srcPath, destPath);
        }
    }
}

const assetsSrc = 'src/assets';
if (existsSync(assetsSrc) && statSync(assetsSrc).isDirectory()) {
    copyAssets(assetsSrc, 'dist/static/assets');
}

console.log('Build complete!');
