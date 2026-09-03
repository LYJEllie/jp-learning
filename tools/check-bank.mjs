/* ============================================================
   题库校验：node tools/check-bank.mjs

   跑的是 data/_core.js 里那个 JP.validate()，和页面顶部弹红条
   用的是同一份逻辑——所以本地过了，页面上就不会报。

   查这些问题：
     · 字段缺失（id / pack / scene / jp / zh / ask / askCn / takeaway / tip）
     · id 重复
     · 正解数量不是恰好 1 个
     · 选项数不是 3 个，或选项缺 jp / zh / badge / why
     · kind / type / pack 非法
     · 某个大类一道题都没有（抽题会漏空）

   有任何一条不通过就 exit 1，方便挂到 hook 或 CI 上。
   ============================================================ */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* 引擎和题库都是普通脚本（不是 ES module），
   丢进一个带 window 的沙箱里跑一遍就能拿到 JP。 */
const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);

const run = async (rel) => {
  const code = await readFile(join(ROOT, rel), 'utf8');
  vm.runInContext(code, sandbox, { filename: rel });
};

await run('data/_core.js');
const { JP } = sandbox;
const PACK_KEYS = Object.keys(JP.PACKS);
for (const p of PACK_KEYS) await run(`data/${p}.js`);

const errs = JP.validate();
const byPack = JP.BANK.reduce((m, q) => (m[q.pack] = (m[q.pack] || 0) + 1, m), {});
const byLevel = JP.BANK.reduce((m, q) => (m[q.level] = (m[q.level] || 0) + 1, m), {});

if (errs.length) {
  console.error(`✗ 题库 —— ${errs.length} 处问题：`);
  errs.forEach((e) => console.error(`    · ${e}`));
  process.exit(1);
}

console.log(`✓ 题库 —— 共 ${JP.BANK.length} 题`);
PACK_KEYS.forEach((p) => {
  const label = JP.PACKS[p].label.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1');
  console.log(`    ${p.padEnd(10)} ${String(byPack[p] || 0).padStart(3)} 题   ${label}`);
});
console.log(`    难度分布   L1 ${byLevel[1] || 0} / L2 ${byLevel[2] || 0} / L3 ${byLevel[3] || 0}`);

/* 抽题跑一轮，确认每局都能凑够题、且不会抛错 */
for (let i = 0; i < 200; i++) {
  const set = JP.draw();
  if (set.length !== JP.ROUND) {
    console.error(`✗ 抽题异常：第 ${i + 1} 次只抽到 ${set.length} 题，应为 ${JP.ROUND} 题`);
    process.exit(1);
  }
}
console.log(`    抽题 200 轮正常，每轮 ${JP.ROUND} 题`);

console.log('\n✅ 题库校验通过。');
