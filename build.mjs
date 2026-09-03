/* ============================================================
   构建：src/*.html + data/*.js  →  可部署的成品页

     node build.mjs            题库游戏 · 懒加载版（默认，推荐上线 / GitHub Pages）
     node build.mjs --inline   题库游戏 · 单文件版 → dist/index.html（拷一个文件就能跑）
     node build.mjs --story    剧情游戏 · 每个语言一个单文件成品 → story-<lang>.html

   ── 三种产物 ──────────────────────────────────────────────
   · 题库懒加载版（根目录 index.html）
       只把引擎 data/_core.js 内联进 HTML，页面小、首屏快；
       四个大类数据（workplace/survival/anime/keigo.js）保留在 data/ 目录，
       运行时由 JP.load() 并行按需加载，各自独立缓存。
       → 加题只改动对应的一个数据文件，不用重发整包，适合题库持续扩充。
       ★ 部署时 index.html 必须和 data/ 目录一起放（Pages 已满足）。

   · 题库单文件版（dist/index.html）
       把引擎 + 全部数据 + 页面浓缩进一个文件，拷走即可离线运行 / 分享。

   · 剧情游戏（根目录 story-en.html / story-jp.html）
       src/story.html 是 EN / JP 共用的骨架，引擎在 data/_story_core.js，
       剧情文案在 data/story-<lang>.js。构建时按语言各内联一份，
       产出互相独立的单文件成品，拷走即用。
       → 加剧情只改对应的一个 data/story-*.js，引擎和样式永远只有一份。

   开发时改 src/*.html 和 data/*.js，直接双击 src 里的页面就能看效果
   （题库页用 ../data/_core.js；剧情页默认日语版，?lang=en 切英文版）。
   ============================================================ */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const INLINE = process.argv.includes('--inline');
const STORY  = process.argv.includes('--story');

/* 题库的大类（顺序不影响，各文件自行 JP.add 注册） */
const PACKS = ['workplace', 'survival', 'anime', 'keigo'];
/* 剧情游戏的语言版本（各对应一个 data/story-<lang>.js） */
const STORY_LANGS = ['en', 'jp'];

/* JS 里只要出现 </script（哪怕在注释或字符串里），浏览器解析内联脚本时
   就会当场截断。内联前统一转义成 <\/script，在 JS 里语义完全等价。 */
const esc = (code) => code.trimEnd().replace(/<\/(script)/gi, '<\\/$1');
const block = (label, code) => `<script>\n/* ===== inlined: ${label} ===== */\n${esc(code)}\n</script>\n`;

const die = (msg) => { console.error(msg); process.exit(1); };

/* 内联 src 页面里的 <script src="..."> 外链，返回 [html, 被内联的文件数] */
async function inlineTags(html, srcPath, { label }) {
  const tags = [...html.matchAll(/[ \t]*<script src="([^"]+)"><\/script>\r?\n/g)];
  if (!tags.length) die(`× ${label} 里没有找到 <script src="...">，构建中止`);
  for (const [tag, src] of tags) {
    const abs = join(dirname(srcPath), src);
    let code;
    try { code = await readFile(abs, 'utf8'); }
    catch { die(`× 找不到 ${src}，构建中止`); }
    const shown = relative(ROOT, abs).replace(/\\/g, '/');
    html = html.replace(tag, () => block(shown, code));
    console.log(`  + ${shown.padEnd(24)} ${(code.length / 1024).toFixed(1)} KB（引擎，内联）`);
  }
  return html;
}

/* 自检：成品里真正的 </script 闭标签数必须等于预期的脚本块数。
   内联代码里若混进没转义的 </script，浏览器会当场截断，闭标签就会多出来。
   （注意：代码/注释里出现的 <script 开标签文本无害，只有 </script 会截断；
    转义后的 <\/script 不会被下面的正则计入。） */
function assertNoTruncation(srcHtml, outHtml, extraBlocks) {
  const expected = (srcHtml.match(/<script\b/gi) || []).length + extraBlocks;
  const closes = (outHtml.match(/<\/script/gi) || []).length;
  if (closes !== expected) {
    die(`× 自检失败：应有 ${expected} 个 </script>，实际 ${closes} 个——有脚本块会被截断，已中止写入`);
  }
  return closes;
}

/* ============================================================
   题库游戏
   ============================================================ */
async function buildQuiz() {
  const SRC = join(ROOT, 'src', 'index.html');
  const OUT = INLINE ? join(ROOT, 'dist', 'index.html') : join(ROOT, 'index.html');

  const srcHtml = await readFile(SRC, 'utf8');
  let html = await inlineTags(srcHtml, SRC, { label: 'src/index.html' });

  if (INLINE) {
    /* 单文件模式：把各大类数据也内联，并置 __JP_INLINE__ 关掉运行时加载 */
    let extra = '';
    for (const p of PACKS) {
      const code = await readFile(join(ROOT, 'data', `${p}.js`), 'utf8');
      extra += block(`data/${p}.js`, code);
      console.log(`  + ${('data/' + p + '.js').padEnd(24)} ${(code.length / 1024).toFixed(1)} KB（数据，内联）`);
    }
    extra += `<script>window.__JP_INLINE__=true;</script>\n`;
    const at = html.lastIndexOf('<script>');      // 插到主 app <script> 之前
    html = html.slice(0, at) + extra + html.slice(at);
  } else {
    /* 懒加载模式：数据保留在 data/，把 DATA_BASE 从 ../data/ 改成 data/ */
    if (!html.includes('"../data/"')) die('× 没找到 DATA_BASE("../data/")，无法切到懒加载路径，构建中止');
    html = html.replace('"../data/"', '"data/"');
  }

  const closes = assertNoTruncation(srcHtml, html, INLINE ? PACKS.length + 1 : 0);

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
}

/* ============================================================
   剧情游戏：一个语言产出一个单文件成品
   ============================================================ */
async function buildStory() {
  const SRC = join(ROOT, 'src', 'story.html');
  const srcHtml = await readFile(SRC, 'utf8');

  /* 引擎只读一次、内联进每个语言版本 */
  const shell = await inlineTags(srcHtml, SRC, { label: 'src/story.html' });

  for (const lang of STORY_LANGS) {
    const rel = `data/story-${lang}.js`;
    let code;
    try { code = await readFile(join(ROOT, rel), 'utf8'); }
    catch { die(`× 找不到 ${rel}，构建中止`); }

    /* 剧情包 + 语言开关，插在主 app <script> 之前 */
    const extra = block(rel, code) + `<script>window.__STORY_LANG__=${JSON.stringify(lang)};</script>\n`;
    const at = shell.lastIndexOf('<script>');
    const html = shell.slice(0, at) + extra + shell.slice(at);

    const closes = assertNoTruncation(srcHtml, html, 2);   // 剧情包 + 语言开关

    const OUT = join(ROOT, `story-${lang}.html`);
    await writeFile(OUT, html, 'utf8');
    console.log(`  + ${rel.padEnd(24)} ${(code.length / 1024).toFixed(1)} KB（剧情，内联）` +
                ` → story-${lang}.html（${(html.length / 1024).toFixed(1)} KB，${closes} 个 script 块闭合正常）`);
  }

  console.log(`\n✅ 剧情游戏 → ${STORY_LANGS.map((l) => `story-${l}.html`).join(' / ')}`);
  console.log(`   每个都是自带引擎和剧情的单文件成品，拷走即用，不依赖 data/ 目录。`);
  console.log(`   ★ 加剧情改 data/story-<lang>.js，改样式改 src/story.html，改完重跑 node build.mjs --story。`);
}

await (STORY ? buildStory() : buildQuiz());
