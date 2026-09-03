/* ============================================================
   成品页冒烟测试：node tools/smoke-story.mjs

   把 story-<lang>.html 里内联的全部 <script> 丢进一个极简 DOM 桩里跑一遍，
   确认引擎能挂载、封面能渲染、自检没弹红条。
   构建脚本只保证「文件写出来了」，这个脚本保证「打开真能跑」。
   ============================================================ */
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['en', 'jp'];
let failed = 0;

for (const lang of LANGS) {
  const file = `story-${lang}.html`;
  const html = await readFile(join(ROOT, file), 'utf8');

  const opens  = (html.match(/<script\b/gi) || []).length;
  const closes = (html.match(/<\/script/gi) || []).length;
  if (opens !== closes) { console.error(`✗ ${file}: script 标签不配对 ${opens}/${closes}`); failed++; continue; }

  const blocks = [...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).filter((s) => s.trim());

  const els = Object.create(null);
  const mk = (id) => ({
    id, innerHTML:'', textContent:'', src:'', hidden:false,
    scrollTop:0, scrollLeft:0, scrollWidth:0, offsetWidth:0, dataset:{}, disabled:false,
    classList:{ add(){}, remove(){}, toggle(){} },
    addEventListener(){},
    querySelector: () => mk('fake'),
    querySelectorAll: () => []
  });
  const errors = [];
  const sandbox = {
    console:{ error:(...a)=>errors.push(a.map(String).join(' ')), log(){}, warn(){} },
    document:{
      getElementById:(id)=> (els[id] = els[id] || mk(id)),
      body:{ classList:{ add(){}, toggle(){} } },
      createElement:()=>mk('script'),
      head:{ appendChild(){} },
      set title(v){ sandbox.__title = v; }, get title(){ return sandbox.__title; }
    },
    location:{ search:'' },
    localStorage:{ getItem:()=>null, setItem(){} },
    addEventListener(){}, setTimeout(){}, URLSearchParams
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const [i, code] of blocks.entries()) {
    try { vm.runInContext(code, sandbox, { filename: `${file}#script${i + 1}` }); }
    catch (e) { console.error(`✗ ${file} 第 ${i + 1} 个 script 抛错：${e.message}`); failed++; }
  }

  const alertBox = els.alert, screenBox = els.screen, action = els.actionBar;
  const checks = [
    ['引擎已注册剧情包', !!(sandbox.Story && Object.keys(sandbox.Story.PACKS).length)],
    ['封面已渲染',       !!(screenBox && screenBox.innerHTML.includes('rules-card'))],
    ['开始按钮已渲染',   !!(action && action.innerHTML.includes('start-btn'))],
    ['页面标题已设置',   !!sandbox.__title],
    ['计数器 src 已填',  !!(els.counterImg && els.counterImg.src.startsWith('https://'))],
    ['侧栏文案已填',     !!(els.sbTitle && els.sbTitle.innerHTML)],
    ['自检无报错',       !(alertBox && alertBox.innerHTML) && !errors.length]
  ];
  const bad = checks.filter(([, ok]) => !ok);
  if (bad.length) {
    console.error(`✗ ${file}：${bad.map(([n]) => n).join('、')} 未通过`);
    if (errors.length) console.error('   ' + errors.join('\n   '));
    failed++;
  } else {
    console.log(`✓ ${file} —— ${blocks.length} 个 script 块全部执行，${checks.length} 项检查通过`);
  }
}

if (failed) { console.error(`\n× ${failed} 个成品页没通过冒烟测试。`); process.exit(1); }
console.log('\n✅ 成品页全部可正常运行。');
