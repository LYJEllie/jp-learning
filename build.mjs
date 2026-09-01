/* ============================================================
   把 index.html + data/*.js 合并成单文件 dist/index.html

     node build.mjs

   开发时用 index.html（题库拆成多文件，好找好改）；
   要发给别人、发布上线、或双击分享时用 dist/index.html。
   做法：把每一行 <script src="..."></script> 原地换成文件内容。
   ============================================================ */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'index.html');
const OUT_DIR = join(ROOT, 'dist');
const OUT = join(OUT_DIR, 'index.html');

let html = await readFile(SRC, 'utf8');

const tags = [...html.matchAll(/[ \t]*<script src="([^"]+)"><\/script>\r?\n/g)];
if (!tags.length) {
  console.error('× index.html 里没有找到 <script src="..."> —— 是不是已经是合并版了？');
  process.exit(1);
}

let inlined = 0;
for (const [tag, src] of tags) {
  let code;
  try {
    code = await readFile(join(ROOT, src), 'utf8');
  } catch {
    console.error(`× 找不到 ${src}，构建中止`);
    process.exit(1);
  }
  // 用函数形式替换，避免代码里的 $& / $1 被当成替换模式
  html = html.replace(tag, () => `<script>\n/* ===== inlined: ${src} ===== */\n${code.trimEnd()}\n</script>\n`);
  inlined++;
  console.log(`  + ${src.padEnd(22)} ${(code.length / 1024).toFixed(1)} KB`);
}

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT, html, 'utf8');

console.log(`\n✅ 内联 ${inlined} 个文件 → dist/index.html（${(html.length / 1024).toFixed(1)} KB，单文件可直接双击/分享）`);
