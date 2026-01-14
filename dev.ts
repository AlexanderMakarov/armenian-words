import { watch } from 'fs';
import { compileAsync } from 'sass';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { cp } from 'fs/promises';
import { serve } from 'bun';

const SRC = 'src';
const STATIC = 'static';
const PORT = 8000;

mkdirSync(STATIC, { recursive: true });
mkdirSync(`${STATIC}/assets`, { recursive: true });

async function compileSass() {
    const result = await compileAsync(`${SRC}/styles.scss`, { sourceMap: true });
    writeFileSync(`${STATIC}/styles.css`, result.css);
}

async function compileTS() {
    await Bun.build({ entrypoints: [`${SRC}/main.ts`], outdir: STATIC, target: 'browser', format: 'esm' });
}

async function copyAssetsToStatic() {
    const assetsSrc = `${SRC}/assets`;
    const assetsDest = `${STATIC}/assets`;
    if (existsSync(assetsSrc)) {
        await cp(assetsSrc, assetsDest, { recursive: true, force: true });
    }
}

await compileSass();
await compileTS();
await copyAssetsToStatic();

watch(SRC, { recursive: true }, async (event, filename) => {
    if (filename?.endsWith('.scss')) await compileSass();
    if (filename?.endsWith('.ts')) await compileTS();
    if (filename?.startsWith('assets/')) await copyAssetsToStatic();
});

const server = serve({
    port: PORT,
    async fetch(req) {
        const path = new URL(req.url).pathname;
        if (path === '/' || path === '/index.html') return new Response(Bun.file(`${SRC}/index.html`));
        if (path.startsWith('/static/')) {
            const file = Bun.file(path.slice(1));
            if (await file.exists()) return new Response(file);
        }
        return new Response('Not Found', { status: 404 });
    },
});

console.log(`✓ Dev server running at http://localhost:${server.port}`);

function cleanup() {
    server.stop();
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
