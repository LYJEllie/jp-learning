/* ============================================================
   状态变量引擎的单元测试：node tools/test-flags.mjs

   条件分支这套东西，错了不会崩，只会「某个选项莫名其妙不出现」
   或者「结局文案挑错了一版」——线上很难发现。所以用小剧情包
   把每条规则都钉一遍，包括自检该抓住的那些坑。
   ============================================================ */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const sandbox = { console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(await readFile(join(ROOT, 'data/_story_core.js'), 'utf8'),
                sandbox, { filename: 'data/_story_core.js' });
const S = sandbox.Story;

let pass = 0, fail = 0;
const ok = (name, cond) => {
  if (cond) { pass++; }
  else { fail++; console.error(`  ✗ ${name}`); }
};
const group = (name) => console.log(`\n· ${name}`);

/* ---------- 条件求值 ---------- */
group('条件求值 Story.test');
ok('没写 requires 就是无条件成立',      S.test({}, undefined) === true);
ok('数值比较 >=（变量已设）',            S.test({ 好感度: 3 }, { 好感度: '>=2' }) === true);
ok('数值比较 >=（不满足）',              S.test({ 好感度: 1 }, { 好感度: '>=2' }) === false);
ok('没设过的变量按 0 参与比较',          S.test({}, { 好感度: '>=1' }) === false);
ok('没设过的变量 <1 成立',               S.test({}, { 好感度: '<1' }) === true);
ok('!= 比较',                            S.test({ ミス: 0 }, { ミス: '!=0' }) === false);
ok('布尔 true 判断真值',                 S.test({ 失言: true }, { 失言: true }) === true);
ok('布尔 false 判断假值（未设过）',      S.test({}, { 失言: false }) === true);
ok('布尔 false 对已设为真的不成立',      S.test({ 失言: true }, { 失言: false }) === false);
ok('数字相等判断',                       S.test({ 回数: 2 }, { 回数: 2 }) === true);
ok('字符串相等判断',                     S.test({ 呼び方: 'name' }, { 呼び方: 'name' }) === true);
ok('字符串不等判断',                     S.test({ 呼び方: 'name' }, { 呼び方: 'san' }) === false);
ok('多个条件是 AND',                     S.test({ a: 1, b: 1 }, { a: 1, b: 2 }) === false);
ok('数组是 OR（任一满足）',              S.test({ b: 2 }, [{ a: 1 }, { b: 2 }]) === true);
ok('数组全不满足则不成立',               S.test({ c: 3 }, [{ a: 1 }, { b: 2 }]) === false);

/* ---------- 变量赋值 ---------- */
group('变量赋值 Story.applySet');
ok("'+1' 在原值上加",        S.applySet({ 好感度: 2 }, { 好感度: '+1' }).好感度 === 3);
ok("'+1' 对未设过的从 0 起", S.applySet({}, { 好感度: '+1' }).好感度 === 1);
ok("'-2' 做减法",            S.applySet({ 好感度: 1 }, { 好感度: '-2' }).好感度 === -1);
ok('布尔直接赋值',           S.applySet({}, { 失言: true }).失言 === true);
ok('字符串直接赋值',         S.applySet({}, { 呼び方: 'name' }).呼び方 === 'name');
ok('数字直接赋值（不是加）', S.applySet({ 回数: 5 }, { 回数: 2 }).回数 === 2);
ok('没写 set 不报错',        S.applySet({ a: 1 }, undefined).a === 1);

/* ---------- 选项过滤 / 分流 / 变体 ---------- */
group('选项过滤 · 分流 · 变体');
const node = { choices: [
  { text: 'A', nextId: 'x' },
  { text: 'B', nextId: 'y', requires: { 好感度: '>=2' } }
]};
ok('条件不满足时选项被藏起来', S.visibleChoices(node, {}).length === 1);
ok('条件满足时选项出现',       S.visibleChoices(node, { 好感度: 2 }).length === 2);

const branching = {
  text: 'go', nextId: 'fallback',
  routes: [
    { requires: { 好感度: '>=3' }, to: 'best' },
    { requires: { 好感度: '>=1' }, to: 'good' }
  ]
};
ok('分流命中第一条', S.nextOf(branching, { 好感度: 5 }) === 'best');
ok('分流命中第二条', S.nextOf(branching, { 好感度: 1 }) === 'good');
ok('都不命中走 nextId 兜底', S.nextOf(branching, {}) === 'fallback');
ok('没有 routes 时直接走 nextId', S.nextOf({ nextId: 'z' }, { 好感度: 9 }) === 'z');

const varied = {
  id: 'end', ending: 'win', title: '原版', text: '原版正文', lesson: '原版金句',
  variants: [{ requires: { 失言: true }, title: '翻盘版', text: '翻盘正文' }]
};
ok('条件不满足时用原版',     S.resolve(varied, {}).title === '原版');
ok('条件满足时变体覆盖标题', S.resolve(varied, { 失言: true }).title === '翻盘版');
ok('变体没写的字段保留原值', S.resolve(varied, { 失言: true }).lesson === '原版金句');
ok('变体不会改掉 id',        S.resolve(varied, { 失言: true }).id === 'end');
ok('resolve 不修改原节点',   varied.title === '原版');

/* ---------- 自检该抓住的坑 ---------- */
group('自检 Story.validate');
const packOf = (nodes, meta) => ({ key: 't', meta: meta || {}, nodes });
const hasErr = (nodes, kw) => S.validate(packOf(nodes)).some((e) => e.includes(kw));

const goodEnd = { id: 'e', scene: 'S', ending: 'win', title: 'T', text: 'X' };

ok('抓 requires 用了从没 set 过的变量（拼错）', hasErr([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e' },
    { text: 'c', badge: 'd', nextId: 'e', requires: { 好感渡: '>=1' } }
  ]},
  goodEnd
], '从来没有被任何选项 set 过'));

ok('变量拼对了就不报', S.validate(packOf([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e', set: { 好感度: '+1' } },
    { text: 'c', badge: 'd', nextId: 'e', requires: { 好感度: '>=1' } }
  ]},
  goodEnd
])).length === 0);

ok('抓所有选项都带条件（可能一条都出不来）', hasErr([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e', set: { f: 1 }, requires: { f: '>=1' } },
    { text: 'c', badge: 'd', nextId: 'e', requires: { f: '>=2' } }
  ]},
  goodEnd
], '至少留一条无条件的'));

ok('抓 routes.to 指向不存在的节点', hasErr([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e', set: { f: 1 },
      routes: [{ requires: { f: '>=1' }, to: '并不存在' }] }
  ]},
  goodEnd
], '指向的节点不存在'));

ok('抓 routes 缺 requires', hasErr([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e', routes: [{ to: 'e' }] }
  ]},
  goodEnd
], '缺字段 requires'));

ok('抓变体想改走向', hasErr([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e', set: { f: 1 } }
  ]},
  Object.assign({}, goodEnd, { variants: [{ requires: { f: 1 }, ending: 'gg' }] })
], '变体不能覆盖 ending'));

ok('抓变体缺 requires', hasErr([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e' }
  ]},
  Object.assign({}, goodEnd, { variants: [{ title: 'x' }] })
], '缺字段 requires'));

ok('抓 set 的值类型不合法', hasErr([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e', set: { f: { bad: 1 } } }
  ]},
  goodEnd
], 'set「f」的值'));

ok('只在 routes 里出现的节点不算孤儿', S.validate(packOf([
  { id: 'start', scene: 'S', text: 'X', choices: [
    { text: 'a', badge: 'b', nextId: 'e', set: { f: 1 },
      routes: [{ requires: { f: '>=1' }, to: 'e2' }] }
  ]},
  goodEnd,
  { id: 'e2', scene: 'S', ending: 'gg', title: 'T', text: 'X' }
])).length === 0);

/* ---------- 真实剧情包：变体确实按状态挑对了版本 ---------- */
group('真实剧情包联调');
for (const lang of ['en', 'jp']) {
  vm.runInContext(await readFile(join(ROOT, `data/story-${lang}.js`), 'utf8'),
                  sandbox, { filename: `data/story-${lang}.js` });
  const pack = S.PACKS[lang];
  ok(`story-${lang}.js 校验通过`, S.validate(pack).length === 0);

  const nodes = Object.fromEntries(pack.nodes.map((n) => [n.id, n]));
  /* 走「用力过猛」那条线：start 的第二个选项会 set 失言 */
  const flags = S.applySet({}, nodes.start.choices[1].set);
  ok(`story-${lang}.js 用力过猛会标记失言`, flags.失言 === true);
  ok(`story-${lang}.js 失言后完美结局换成翻盘版`,
     S.resolve(nodes.perfect_win, flags).title !== nodes.perfect_win.title);
  ok(`story-${lang}.js 顺风局仍是原版完美结局`,
     S.resolve(nodes.perfect_win, {}).title === nodes.perfect_win.title);
}

console.log(`\n${fail ? '×' : '✅'} ${pass} 项通过${fail ? `，${fail} 项失败` : ''}。`);
process.exit(fail ? 1 : 0);
