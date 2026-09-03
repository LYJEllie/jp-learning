/* ============================================================
   剧情树校验：node tools/check-story.mjs

   跑的是 data/_story_core.js 里那个 Story.validate()，
   和页面顶部弹红条用的是同一份逻辑——所以本地过了，页面上就不会报。

   查这些问题：
     · nextId 指向不存在的节点（断链）
     · id 重复
     · 结局节点还带 choices / 非结局节点没有 choices（死胡同）
     · 从 start 出发永远走不到的孤儿节点
     · 缺 id / scene / text / title / badge 等必填字段

   有任何一条不通过就 exit 1，方便挂到 git hook 或 CI 上：
     node tools/check-story.mjs && node build.mjs --story
   ============================================================ */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const TARGETS = LANGS.length ? LANGS : ['en', 'jp'];

/* 引擎和剧情包都是普通脚本（不是 ES module），
   丢进一个带 window 的沙箱里跑一遍就能拿到 Story。 */
const sandbox = { console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const run = async (rel) => {
  const code = await readFile(join(ROOT, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
};

await run('data/_story_core.js');
for (const lang of TARGETS) await run(`data/story-${lang}.js`);

const { Story } = sandbox;
let failed = 0;

for (const lang of TARGETS) {
  const pack = Story.PACKS[lang];
  if (!pack) {
    console.error(`✗ story-${lang}.js 没有注册剧情包（Story.define('${lang}', ...) 写了吗？）`);
    failed++;
    continue;
  }

  const errs = Story.validate(pack);
  const s = Story.stats(pack);
  const shape = Object.entries(s.byEnding).map(([k, v]) => `${k}×${v}`).join(' ');

  if (errs.length) {
    console.error(`✗ story-${lang}.js —— ${errs.length} 处问题：`);
    errs.forEach((e) => console.error(`    · ${e}`));
    failed++;
  } else {
    console.log(`✓ story-${lang}.js —— 节点 ${s.nodes} / 分支 ${s.branches} / 结局 ${s.endings}（${shape}）`);
  }
}

if (failed) {
  console.error(`\n× 共 ${failed} 个剧情包没通过校验，先修完再构建。`);
  process.exit(1);
}
console.log('\n✅ 全部剧情包校验通过。');
