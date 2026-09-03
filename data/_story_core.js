/* ============================================================
   剧情引擎 —— 假名简写 / 结局定义 / 剧情树自检 / 状态机 / 渲染
   剧情数据在同目录的 story-en.js · story-jp.js
   新增一个语言版本：建一个 story-<lang>.js，在 build.mjs 的
   STORY_LANGS 里加一行，其余不用动。

   ★ 这个文件只有引擎，不含任何剧情文案。
     加剧情请改 data/story-*.js；改样式请改 src/story.html。
   ============================================================ */
(function (root) {
  "use strict";

  /* 假名简写：{漢字|かんじ} → <ruby>漢字<rt>かんじ</rt></ruby>
     和问答游戏用的是同一套写法，两边的文案可以直接互搬。
     英文剧情里没有花括号，调用它也完全无害。 */
  const R = (s) => String(s == null ? "" : s)
    .replace(/\{([^|{}]+)\|([^{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');

  /* 三类结局的配色与文案（CSS 里对应 .ending--win / --normal / --gg） */
  const ENDING_META = {
    win:    { tag:'PERFECT ENDING', mark:'👑', prefix:'👑 完美结局' },
    normal: { tag:'NORMAL ENDING',  mark:'△',  prefix:'△ 平庸结局' },
    gg:     { tag:'BAD ENDING',     mark:'×',  prefix:'× 惨烈结局' }
  };

  const START_ID = 'start';          // 每个剧情包的开局节点 id 都叫这个
  const PACKS = {};                  // 已注册的剧情包，key 就是语言代号

  /* ============================================================
     状态变量（flags）—— 让后面的剧情能记住前面的选择
     ------------------------------------------------------------
     选项用 set 改变量：
       set:{ 好感度:'+1', 失言:true, 呼び方:'name' }
         · '+1' / '-2'  在原值上加减（没设过的当 0）
         · 数字/布尔/字符串  直接赋值

     节点、选项、分流、变体用 requires 判断条件：
       requires:{ 好感度:'>=2', 失言:false }        ← 所有条件都满足（AND）
       requires:[ {好感度:'>=2'}, {呼び方:'name'} ]  ← 任一满足即可（OR）
         · '>=2' '<=1' '>0' '<3' '==1' '!=0'  数值比较（没设过的当 0）
         · true / false   变量是否为真
         · 数字 / 字符串   相等判断

     条件只用这套声明式写法，不跑 eval——剧情永远只是数据，
     所以 tools/check-story.mjs 能在 Node 里把它整棵校验一遍。
     ============================================================ */
  const OPS = {
    '>=': (a, b) => a >= b, '<=': (a, b) => a <= b,
    '>':  (a, b) => a >  b, '<':  (a, b) => a <  b,
    '==': (a, b) => a === b, '!=': (a, b) => a !== b
  };
  const COND_RE  = /^\s*(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?)\s*$/;
  const DELTA_RE = /^\s*([+-])\s*(\d+(?:\.\d+)?)\s*$/;

  function testOne(flags, key, cond){
    const cur = flags[key];
    if (typeof cond === 'boolean') return cond ? !!cur : !cur;
    if (typeof cond === 'number')  return Number(cur || 0) === cond;
    if (typeof cond === 'string'){
      const m = COND_RE.exec(cond);
      if (m) return OPS[m[1]](Number(cur || 0), Number(m[2]));
      return String(cur == null ? '' : cur) === cond;   // 普通字符串＝相等判断
    }
    return false;
  }

  /* 没写 requires 就是「无条件成立」 */
  function test(flags, requires){
    if (!requires) return true;
    if (Array.isArray(requires)) return requires.some((r) => test(flags, r));
    return Object.keys(requires).every((k) => testOne(flags, k, requires[k]));
  }

  function applySet(flags, set){
    if (!set) return flags;
    Object.keys(set).forEach((k) => {
      const v = set[k];
      const m = (typeof v === 'string') ? DELTA_RE.exec(v) : null;
      if (m) flags[k] = Number(flags[k] || 0) + (m[1] === '-' ? -1 : 1) * Number(m[2]);
      else   flags[k] = v;
    });
    return flags;
  }

  /* 节点变体：第一个条件满足的 variant 覆盖掉基础文案。
     变体只能改「怎么讲」（scene/text/sub/ask/askSub/title/lesson），
     不能改「往哪走」（id/choices/nextId/ending）——这条由自检守住。 */
  function resolve(node, flags){
    if (!Array.isArray(node.variants) || !node.variants.length) return node;
    const hit = node.variants.find((v) => test(flags, v.requires));
    if (!hit) return node;
    const merged = Object.assign({}, node, hit);
    delete merged.requires;
    delete merged.variants;
    merged.id = node.id;
    return merged;
  }

  /* 选项分流：routes 里第一个条件满足的胜出，都不满足就走 nextId。
     nextId 永远必填，所以任何选项都有确定的去处，不会走丢。 */
  function nextOf(choice, flags){
    if (Array.isArray(choice.routes)){
      const hit = choice.routes.find((r) => test(flags, r.requires));
      if (hit) return hit.to;
    }
    return choice.nextId;
  }

  /* 当前条件下玩家能看到的选项 */
  const visibleChoices = (node, flags) =>
    (node.choices || []).filter((c) => test(flags, c.requires));

  /* ============================================================
     剧情包注册
     ------------------------------------------------------------
     Story.define('jp', { meta:{...}, nodes:[...] })

     节点字段：
       id        唯一编号，被 choices.nextId 指向
       scene     场景标签（剧情卡顶部的黑胶囊）
       text      主文本（可写 HTML；{漢字|かんじ} 自动出假名）
       sub       副文本／中文对照（可省略）
       ask/askSub 设问主文本／副文本（可省略，省略时用 meta.ui 里的默认值）
       choices   分支数组；有 choices＝剧情节点，没有＝结局节点
         · text   选项主文本
         · sub    选项副文本（可省略）
         · badge  右侧趣味标签
         · nextId 指向的下一个节点 id
       ending    只有结局节点才写，取值 win / normal / gg
       title     结局标题（结局节点必填）
       lesson    结局金句（可省略）
     ============================================================ */
  function define(key, pack){
    pack.key = key;
    pack.nodes = pack.nodes || [];
    pack.meta = pack.meta || {};
    PACKS[key] = pack;
    return pack;
  }

  const isEnding = (node) => !!node.ending;

  /* 建 id → 节点的索引；重复 id 以第一个为准（重复本身由自检报出来） */
  function indexOf(pack){
    const map = Object.create(null);
    pack.nodes.forEach((n) => { if (n.id && !map[n.id]) map[n.id] = n; });
    return map;
  }

  /* ============================================================
     剧情树自检：断链 / 重复 id / 结构错位 / 孤儿节点
     ------------------------------------------------------------
     纯数据校验，不碰 DOM —— 所以浏览器和 Node 都能跑，
     tools/check-story.mjs 用的就是这个函数。
     ============================================================ */
  function validate(pack){
    const errs = [], seen = new Set();
    const nodes = pack.nodes || [];
    const NODES = indexOf(pack);
    const setKeys = new Set();     // 被 set 过的变量名
    const reqUses = [];            // [变量名, 出处] —— 用来抓拼错的变量

    /* requires 的形状检查：条件值必须是布尔 / 数字 / 合法的比较串或普通字符串 */
    const checkRequires = (req, tag) => {
      if (req == null) return;
      if (Array.isArray(req)){ req.forEach((r) => checkRequires(r, tag)); return; }
      if (typeof req !== 'object'){ errs.push(`${tag}：requires 必须是对象或对象数组`); return; }
      Object.keys(req).forEach((k) => {
        reqUses.push([k, tag]);
        const v = req[k];
        if (typeof v === 'boolean' || typeof v === 'number') return;
        if (typeof v === 'string') return;                 // 比较串或普通字符串都合法
        errs.push(`${tag}：条件「${k}」的值只能是布尔／数字／字符串`);
      });
    };

    const checkSet = (set, tag) => {
      if (set == null) return;
      if (typeof set !== 'object' || Array.isArray(set)){ errs.push(`${tag}：set 必须是对象`); return; }
      Object.keys(set).forEach((k) => {
        setKeys.add(k);
        const v = set[k];
        if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') return;
        errs.push(`${tag}：set「${k}」的值只能是布尔／数字／字符串（'+1' '-2' 表示加减）`);
      });
    };

    nodes.forEach((n, i) => {
      const at = `第 ${i + 1} 个节点（${n.id || '缺 id'}）`;
      if (!n.id)    errs.push(`${at}：缺字段 id`);
      if (!n.scene) errs.push(`${at}：缺字段 scene`);
      if (!n.text)  errs.push(`${at}：缺字段 text`);
      if (n.id){
        if (seen.has(n.id)) errs.push(`${at}：id 与前面重复`);
        seen.add(n.id);
      }

      /* 节点变体：只能改文案，不能改走向 */
      if (n.variants != null){
        if (!Array.isArray(n.variants)) errs.push(`${at}：variants 必须是数组`);
        else n.variants.forEach((v, k) => {
          const tag = `${at} 变体${k + 1}`;
          if (!v || typeof v !== 'object'){ errs.push(`${tag}：必须是对象`); return; }
          if (!v.requires) errs.push(`${tag}：缺字段 requires（不带条件的变体永远会命中第一个）`);
          checkRequires(v.requires, tag);
          ['id','choices','nextId','ending'].forEach((f) => {
            if (f in v) errs.push(`${tag}：变体不能覆盖 ${f}（变体只改怎么讲，不改往哪走）`);
          });
        });
      }

      if (isEnding(n)){
        if (!ENDING_META[n.ending]) errs.push(`${at}：ending「${n.ending}」不合法（只能 win/normal/gg）`);
        if (!n.title) errs.push(`${at}：结局节点缺字段 title`);
        if (n.choices && n.choices.length) errs.push(`${at}：结局节点不该再有 choices`);
        return;
      }

      if (!Array.isArray(n.choices) || !n.choices.length){
        errs.push(`${at}：不是结局节点，却没有 choices（玩家会走进死胡同）`);
        return;
      }

      n.choices.forEach((c, j) => {
        const tag = `${at} 选项${"ABCDEF"[j] || j + 1}`;
        if (!c.text)   errs.push(`${tag}：缺字段 text`);
        if (!c.badge)  errs.push(`${tag}：缺字段 badge`);
        if (!c.nextId) errs.push(`${tag}：缺字段 nextId（分流用的 routes 也要留 nextId 兜底）`);
        else if (!NODES[c.nextId]) errs.push(`${tag}：nextId「${c.nextId}」指向的节点不存在`);

        checkRequires(c.requires, tag);
        checkSet(c.set, tag);

        if (c.routes != null){
          if (!Array.isArray(c.routes)) errs.push(`${tag}：routes 必须是数组`);
          else c.routes.forEach((r, k) => {
            const rt = `${tag} 分流${k + 1}`;
            if (!r || typeof r !== 'object'){ errs.push(`${rt}：必须是对象`); return; }
            if (!r.requires) errs.push(`${rt}：缺字段 requires`);
            checkRequires(r.requires, rt);
            if (!r.to) errs.push(`${rt}：缺字段 to`);
            else if (!NODES[r.to]) errs.push(`${rt}：to「${r.to}」指向的节点不存在`);
          });
        }
      });

      /* 所有选项都带条件时，可能出现一个选项都显示不出来的死局。
         要求至少留一条无条件的退路。 */
      if (n.choices.every((c) => c.requires)){
        errs.push(`${at}：所有选项都带 requires，条件都不满足时会一个选项都出不来——至少留一条无条件的`);
      }
    });

    if (!NODES[START_ID]) errs.push(`找不到开局节点「${START_ID}」`);

    /* 条件里用到、却从来没有被 set 过的变量，八成是拼错了 */
    const reported = new Set();
    reqUses.forEach(([k, tag]) => {
      if (setKeys.has(k) || reported.has(k)) return;
      reported.add(k);
      errs.push(`${tag}：条件用到的变量「${k}」从来没有被任何选项 set 过（拼错了？）`);
    });

    /* 从开局做一次可达性遍历，捞出永远走不到的孤儿节点。
       分流的 to 也算一条边，否则只在 routes 里出现的节点会被误报。 */
    const reached = new Set();
    (function walk(id){
      if (!id || reached.has(id) || !NODES[id]) return;
      reached.add(id);
      (NODES[id].choices || []).forEach((c) => {
        walk(c.nextId);
        (c.routes || []).forEach((r) => walk(r.to));
      });
    })(START_ID);
    nodes.forEach((n) => {
      if (n.id && !reached.has(n.id)) errs.push(`节点「${n.id}」从开局出发永远走不到（孤儿节点）`);
    });

    if (!nodes.filter(isEnding).length) errs.push('一个结局节点都没有，游戏无法收尾');

    return errs;
  }

  /* 统计信息，给校验脚本和构建日志用 */
  function stats(pack){
    const nodes = pack.nodes || [];
    const endings = nodes.filter(isEnding);
    return {
      nodes: nodes.length,
      branches: nodes.reduce((n, x) => n + (x.choices ? x.choices.length : 0), 0),
      endings: endings.length,
      byEnding: endings.reduce((m, x) => (m[x.ending] = (m[x.ending] || 0) + 1, m), {})
    };
  }

  /* ============================================================
     挂载：把一个剧情包接到页面上（浏览器专用）
     ============================================================ */
  function mount(pack){
    pack = pack || PACKS[Object.keys(PACKS)[0]];
    if (!pack) { console.error('[剧情引擎] 没有已注册的剧情包'); return; }

    const meta = pack.meta, ui = meta.ui || {}, cover = meta.cover || {};
    const NODES = indexOf(pack);

    const $ = (id) => document.getElementById(id);
    const app = $("app"), hud = $("hud"), trailBox = $("trail"), stepNum = $("stepNum");
    const screenBox = $("screen"), scrollArea = $("scrollArea"), actionBar = $("actionBar");

    /* ---- 页面外壳：标题 / 字体 / 侧栏 / 计数器，全部由剧情包决定 ---- */
    if (meta.docTitle) document.title = meta.docTitle;
    document.body.classList.add("lang-" + (meta.lang || pack.key));

    const sb = meta.sidebar || {};
    const setHTML = (id, html) => { const el = $(id); if (el && html != null) el.innerHTML = R(html); };
    setHTML("sbTitle",   sb.title);
    setHTML("sbSub",     sb.sub);
    setHTML("sbTag",     sb.tag);
    setHTML("sbOverlay", sb.overlay);
    setHTML("sbFooter",  sb.footer);

    const counterImg = $("counterImg");
    if (counterImg && meta.counterSrc) counterImg.src = meta.counterSrc;

    /* ---- 结局收集：存浏览器本地，纯粹给重玩加点动力 ---- */
    const SAVE_KEY = meta.saveKey || ("story:" + pack.key + ":endings");
    const store = {
      read(){
        try { return new Set(JSON.parse(localStorage.getItem(SAVE_KEY) || "[]")); }
        catch { return new Set(); }
      },
      add(id){
        try {
          const s = store.read();
          s.add(id);
          localStorage.setItem(SAVE_KEY, JSON.stringify([...s]));
        } catch { /* 隐私模式 / 禁用存储：静默跳过 */ }
      }
    };

    const state = { id:START_ID, path:[], flags:{}, locked:false };

    function renderAction(html, onClick){
      actionBar.innerHTML = html;
      const btn = actionBar.querySelector("button");
      if (btn && onClick) btn.addEventListener("click", onClick);
    }

    function renderTrail(){
      stepNum.textContent = state.path.length;
      trailBox.innerHTML = state.path
        .slice(-4)                     // 只显示最近 4 段，长了也不会挤爆
        .map((s) => `<span class="trail__item">${R(s)}</span>`)
        .join('<span class="trail__arrow">▶</span>');
      trailBox.scrollLeft = trailBox.scrollWidth;
      renderFlags();
    }

    /* 状态变量条：只显示 meta.flagLabels 里登记过、且当前有值的变量。
       没配 flagLabels 就整条不出现——内部用的开关不必让玩家看见。 */
    function renderFlags(){
      const box = $("flags");
      if (!box) return;
      const labels = meta.flagLabels || {};
      const chips = Object.keys(labels).map((k) => {
        const v = state.flags[k];
        if (v == null || v === false || v === 0 || v === "") return "";
        const n = (typeof v === "number" && v > 1) ? ` ×${v}` : "";
        return `<span class="flag-chip">${R(labels[k])}${n}</span>`;
      }).filter(Boolean).join("");
      box.innerHTML = chips;
      box.hidden = !chips;
    }

    /* ---------- 封面 ---------- */
    function renderCover(){
      hud.hidden = true;
      scrollArea.scrollTop = 0;

      const found = store.read();
      const endings = pack.nodes.filter(isEnding);
      const dots = endings.map((n) => {
        const hit = found.has(n.id);
        return `<span class="collect-dot${hit ? " is-found" : ""}">${
          hit ? ENDING_META[n.ending].mark + " " + R(n.title) : (ui.lockedName || "？？？")
        }</span>`;
      }).join("");

      const rules = (cover.rules || [])
        .map((r) => `<div class="rule-item">${R(r).replace(/\{endings\}/g, endings.length)}</div>`)
        .join("");

      screenBox.innerHTML = `
        <div class="card card--center">
          <div class="cover-kicker">${R(cover.kicker || "")}</div>
          <div class="main-title">${R(cover.title || "")}</div>
          <p class="cover-sub">${R(cover.sub || "")}</p>
          <div class="rules-card">${rules}</div>
          <div class="collect-row">${dots}</div>
        </div>`;

      renderAction(
        `<button class="start-btn start-btn--pulse" type="button">
           <span class="btn-main">${R(cover.startMain || "START")}</span>
           <span>${R(cover.startSub || "开始")}</span>
         </button>`,
        startGame
      );
    }

    function startGame(){
      state.id = START_ID;
      state.path = [];
      state.flags = Object.assign({}, meta.initialFlags);   // 每局从头开始
      state.locked = false;
      hud.hidden = false;
      goTo(START_ID);
    }

    /* ---------- 剧情节点 ---------- */
    function renderNode(node){
      state.locked = false;
      scrollArea.scrollTop = 0;

      /* 条件不满足的选项直接不显示；自检保证了至少有一条无条件的退路，
         真出现一条都不剩的极端情况就全部显示，宁可穿帮也不卡死。 */
      let choices = visibleChoices(node, state.flags);
      if (!choices.length) choices = node.choices;

      const sub    = node.sub ? `<p class="story-sub">${R(node.sub)}</p>` : "";
      const askSub = node.askSub || ui.askSub;

      screenBox.innerHTML = `
        <div class="card">
          <div class="scene-row">
            <span class="scene">${R(node.scene)}</span>
            <span class="scene scene--type">${R(ui.branchTag || "剧情分歧")}</span>
          </div>
          <p class="story-text">${R(node.text)}</p>
          ${sub}
          <p class="ask">
            <span class="ask__main">${R(node.ask || ui.ask || "")}</span>
            ${askSub ? `<small>${R(askSub)}</small>` : ""}
          </p>
          <div class="options">
            ${choices.map((c, i) => `
              <button class="option-card" type="button" data-i="${i}">
                <span class="opt-key">${"ABC"[i] || i + 1}</span>
                <span class="opt-body">
                  <span class="opt-text">${R(c.text)}</span>
                  ${c.sub ? `<span class="opt-sub">${R(c.sub)}</span>` : ""}
                </span>
                <span class="opt-badge">${R(c.badge)}</span>
              </button>`).join("")}
          </div>
        </div>`;

      renderAction(`<p class="action-hint">${R(ui.hint || "选一个走向 ／ A・B・C")}</p>`);

      screenBox.querySelectorAll(".option-card").forEach((btn) => {
        btn.addEventListener("click", () => pick(choices, Number(btn.dataset.i), btn));
      });
    }

    function pick(choices, i, btn){
      if (state.locked) return;
      state.locked = true;

      /* 先把选中的那条按下去，让观众看清玩家选了什么，再跳转 */
      screenBox.querySelectorAll(".option-card").forEach((b) => { b.disabled = true; });
      btn.classList.add("is-picked");

      const choice = choices[i];
      applySet(state.flags, choice.set);          // 先改状态
      const to = nextOf(choice, state.flags);     // 再按新状态决定去处
      renderFlags();
      setTimeout(() => goTo(to), 420);
    }

    /* ---------- 结局 ---------- */
    function renderEnding(node){
      const em = ENDING_META[node.ending];
      scrollArea.scrollTop = 0;
      store.add(node.id);

      if (node.ending === "gg"){
        app.classList.remove("is-hit");
        void app.offsetWidth;          // 强制重排，让同一个动画能连播
        app.classList.add("is-hit");
      }

      const sub    = node.sub ? `<p class="ending__sub">${R(node.sub)}</p>` : "";
      const lesson = node.lesson ? `<div class="ending__lesson">${R(node.lesson)}</div>` : "";
      const recap  = state.path.length
        ? `<div class="ending__recap">${R(ui.recapLabel || "你走过的路：")}<span>${state.path.map(R).join(" ▶ ")}</span></div>`
        : "";

      screenBox.innerHTML = `
        <div class="ending ending--${node.ending}">
          <span class="ending__watermark">${em.mark}</span>
          <span class="ending__tag">${em.tag}</span>
          <h2 class="ending__title">
            <span class="pop">${em.mark}</span>
            ${em.prefix}：【${R(node.title)}】
          </h2>
          <p class="ending__body">${R(node.text)}</p>
          ${sub}
          ${lesson}
          ${recap}
        </div>`;

      renderAction(
        `<button class="start-btn" type="button">
           <span class="btn-main">${R(ui.retryMain || "Retry")}</span>
           <span>${R(ui.retrySub || "重新挑战 🔁")}</span>
         </button>`,
        renderCover
      );
    }

    /* ---------- 跳转：整个引擎唯一的入口 ---------- */
    function goTo(id){
      const raw = NODES[id];
      if (!raw){                       // 自检已经拦过一道，这里只是兜底
        console.error("[剧情跳转失败] 找不到节点：", id);
        return;
      }
      /* 变体在这里生效：同一个节点，按当前状态换一套说法 */
      const node = resolve(raw, state.flags);
      state.id = id;
      state.path.push(node.scene);
      renderTrail();
      isEnding(node) ? renderEnding(node) : renderNode(node);
    }

    /* ---------- 键盘：A/B/C 与 1/2/3 都能选 ---------- */
    addEventListener("keydown", (e) => {
      if (state.locked) return;
      const k = e.key.toLowerCase();
      let i = "abc".indexOf(k);
      if (i < 0) i = "123".indexOf(k);
      if (i < 0) return;
      const btn = screenBox.querySelector(`.option-card[data-i="${i}"]`);
      if (btn && !btn.disabled) btn.click();
    });

    /* ---------- 启动：先自检剧情树，再渲染封面 ---------- */
    const errs = validate(pack);
    if (errs.length){
      const box = $("alert");
      box.hidden = false;
      box.innerHTML = `<b>剧情树自检发现 ${errs.length} 处问题：</b>
        <ul>${errs.map((e) => `<li>${e}</li>`).join("")}</ul>`;
      console.error("[剧情树自检]", errs);
    }
    renderCover();
  }

  /* ============================================================
     懒加载：在 base 目录下取 story-<lang>.js，加载完回调
     单文件内联版不会用到它。
     ============================================================ */
  function load(base, lang, done){
    const s = document.createElement('script');
    s.src = base + 'story-' + lang + '.js';
    s.onload = () => done(null);
    s.onerror = () => done('story-' + lang + '.js');
    document.head.appendChild(s);
  }

  root.Story = {
    R, ENDING_META, PACKS, START_ID,
    define, validate, stats, mount, load,
    /* 状态变量相关，单元测试和外部工具会直接用到 */
    test, applySet, resolve, nextOf, visibleChoices
  };

})(typeof window !== 'undefined' ? window : globalThis);
