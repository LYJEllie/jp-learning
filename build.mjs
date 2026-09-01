/* ============================================================
   构建：src/index.html + data/*.js  →  仓库根目录的 index.html（单文件）

     node build.mjs

   - 开发时改 src/index.html 和 data/*.js，直接双击 src/index.html 就能看效果
     （里面用的是 ../data/xxx.js，相对路径在 file:// 下正常工作，不用起服务器）
   - 要发布 / 分享 / 上 GitHub Pages 时跑一次本脚本，
     产出根目录 index.html：把每一行 <script src="..."> 原地换成文件内容，
     全部 HTML/CSS/JS 浓缩进这一个文件，拷走它就能跑。
   ============================================================ */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src', 'index.html');
const OUT = join(ROOT, 'index.html');

const srcHtml = await readFile(SRC, 'utf8');
let html = srcHtml;

const tags = [...html.matchAll(/[ \t]*<script src="([^"]+)"><\/script>\r?\n/g)];
if (!tags.length) {
  console.error('× src/index.html 里没有找到 <script src="...">，构建中止');
  process.exit(1);
}

let inlined = 0;
for (const [tag, src] of tags) {
  const abs = join(dirname(SRC), src);   // 相对 src/ 解析，例如 ../data/_core.js
  let code;
  try {
    code = await readFile(abs, 'utf8');
  } catch {
    console.error(`× 找不到 ${src}，构建中止`);
    process.exit(1);
  }
  const shown = relative(ROOT, abs).replace(/\\/g, '/');

  /* 关键：JS 里只要出现 </script（哪怕在注释或字符串里），
     浏览器解析内联脚本时就会当场截断，后面的代码会被当成 HTML 文本吐在页面上。
     内联前统一转义成 <\/script，在 JS 里语义完全等价。 */
  const safe = code.trimEnd().replace(/<\/(script)/gi, '<\\/$1');

  // 用函数形式替换，避免代码里的 $& / $1 被当成替换模式
  html = html.replace(tag, () => `<script>\n/* ===== inlined: ${shown} ===== */\n${safe}\n</script>\n`);
  inlined++;
  console.log(`  + ${shown.padEnd(22)} ${(code.length / 1024).toFixed(1)} KB`);
}

/* 出厂自检：成品里 </script 的出现次数，必须正好等于源模板里的 <script> 标签数。
   多出来就说明某段内联代码里混进了没转义的 </script——浏览器会当场截断脚本，
   把后面的代码当 HTML 吐在页面上（注意：脚本内出现 <script 文本无害，只有 </script 会截断）。 */
const expectedBlocks = (srcHtml.match(/<script\b/gi) || []).length;
const closes = (html.match(/<\/script/gi) || []).length;
if (closes !== expectedBlocks) {
  console.error(`× 自检失败：应有 ${expectedBlocks} 个 </script>，实际 ${closes} 个——有脚本块会被截断，已中止写入`);
  process.exit(1);
}

await writeFile(OUT, html, 'utf8');
console.log(`\n✅ 内联 ${inlined} 个文件 → index.html（${(html.length / 1024).toFixed(1)} KB，单文件，可直接双击/分享/部署）`);
console.log(`   自检：${closes} 个 script 块闭合正常，无截断`);
