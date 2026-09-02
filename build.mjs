/* ============================================================
   构建：src/index.html + data/*.js  →  可部署的 index.html

     node build.mjs            懒加载版（默认，推荐上线 / GitHub Pages）
     node build.mjs --inline   单文件版 → dist/index.html（拷一个文件就能跑）

   ── 两种产物 ──────────────────────────────────────────────
   · 懒加载版（根目录 index.html）
       只把引擎 data/_core.js 内联进 HTML，页面小、首屏快；
       四个大类数据（workplace/survival/anime/keigo.js）保留在 data/ 目录，
       运行时由 JP.load() 并行按需加载，各自独立缓存。
       → 加题只改动对应的一个数据文件，不用重发整包，适合题库持续扩充。
       ★ 部署时 index.html 必须和 data/ 目录一起放（Pages 已满足）。

   · 单文件版（dist/index.html）
       把引擎 + 全部数据 + 页面浓缩进一个文件，拷走即可离线运行 / 分享。

   开发时改 src/index.html 和 data/*.js，直接双击 src/index.html 就能看效果
   （里面用 ../data/_core.js，其余数据由 JP.load('../data/') 加载）。
   ============================================================ */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src', 'index.html');
const INLINE = process.argv.includes('--inline');
const OUT = INLINE ? join(ROOT, 'dist', 'index.html') : join(ROOT, 'index.html');

/* 懒加载/内联的数据大类（顺序不影响，各文件自行 JP.add 注册） */
const PACKS = ['workplace', 'survival', 'anime', 'keigo'];

const srcHtml = await readFile(SRC, 'utf8');
let html = srcHtml;

/* JS 里只要出现 </script（哪怕在注释或字符串里），浏览器解析内联脚本时
   就会当场截断。内联前统一转义成 <\/script，在 JS 里语义完全等价。 */
const esc = (code) => code.trimEnd().replace(/<\/(script)/gi, '<\\/$1');
const block = (label, code) => `<script>\n/* ===== inlined: ${label} ===== */\n${esc(code)}\n</script>\n`;

/* 1) 内联 src 里的 <script src="..."> —— 现在只有 data/_core.js（引擎） */
const tags = [...html.matchAll(/[ \t]*<script src="([^"]+)"><\/script>\r?\n/g)];
if (!tags.length) {
  console.error('× src/index.html 里没有找到 <script src="...">，构建中止');
  process.exit(1);
}
for (const [tag, src] of tags) {
  const abs = join(dirname(SRC), src);
  let code;
  try { code = await readFile(abs, 'utf8'); }
  catch { console.error(`× 找不到 ${src}，构建中止`); process.exit(1); }
  const shown = relative(ROOT, abs).replace(/\\/g, '/');
  html = html.replace(tag, () => block(shown, code));
  console.log(`  + ${shown.padEnd(22)} ${(code.length / 1024).toFixed(1)} KB（引擎，内联）`);
}

if (INLINE) {
  /* 2a) 单文件模式：把各大类数据也内联，并置 __JP_INLINE__ 关掉运行时加载 */
  let extra = '';
  for (const p of PACKS) {
    const code = await readFile(join(ROOT, 'data', `${p}.js`), 'utf8');
    extra += block(`data/${p}.js`, code);
    console.log(`  + ${('data/' + p + '.js').padEnd(22)} ${(code.length / 1024).toFixed(1)} KB（数据，内联）`);
  }
  extra += `<script>window.__JP_INLINE__=true;</script>\n`;
  /* 插到主 app <script>（最后一个 script 块）之前 */
  const at = html.lastIndexOf('<script>');
  html = html.slice(0, at) + extra + html.slice(at);
} else {
  /* 2b) 懒加载模式：数据保留在 data/，把 DATA_BASE 从 ../data/ 改成 data/ */
  if (!html.includes('"../data/"')) {
    console.error('× 没找到 DATA_BASE("../data/")，无法切到懒加载路径，构建中止');
    process.exit(1);
  }
  html = html.replace('"../data/"', '"data/"');
}

/* 3) 自检：成品里真正的 </script 闭标签数必须等于预期的脚本块数。
      内联代码里若混进没转义的 </script，浏览器会当场截断，闭标签就会多出来。
      （注意：代码/注释里出现的 <script 开标签文本无害，只有 </script 会截断；
       转义后的 <\/script 不会被下面的正则计入。） */
const baseBlocks = (srcHtml.match(/<script\b/gi) || []).length;   // src 模板里的真实 script 标签数（干净、无内联代码）
const expectedBlocks = baseBlocks + (INLINE ? PACKS.length + 1 : 0);
const closes = (html.match(/<\/script/gi) || []).length;
if (closes !== expectedBlocks) {
  console.error(`× 自检失败：应有 ${expectedBlocks} 个 </script>，实际 ${closes} 个——有脚本块会被截断，已中止写入`);
  process.exit(1);
}

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, html, 'utf8');

const rel = relative(ROOT, OUT).replace(/\\/g, '/');
if (INLINE) {
  console.log(`\n✅ 单文件版 → ${rel}（${(html.length / 1024).toFixed(1)} KB，引擎+数据+页面合一，拷走即用）`);
} else {
  console.log(`\n✅ 懒加载版 → ${rel}（${(html.length / 1024).toFixed(1)} KB，仅内联引擎；数据由 data/ 运行时加载）`);
  console.log(`   ★ 部署时请把 index.html 与 data/ 目录一起上传（Pages 已满足）。`);
}
console.log(`   自检：${closes} 个 script 块闭合正常，无截断。`);
