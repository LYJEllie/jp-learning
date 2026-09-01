/* ============================================================
   题库核心 —— 假名简写 / 大类定义 / 注册器 / 自检 / 抽题
   题目数据在同目录的 workplace.js · survival.js · anime.js · keigo.js
   新增一个大类：在 PACKS 里加一行，建一个同名 .js，再去 index.html
   加一行 <script src="data/xxx.js"></script>（build.mjs 会自动内联）
   ============================================================ */
(function (root) {
  "use strict";


  /* ============================================================
     ★ 题库区 ★  —— 扩充题目只需要改这一段，下面的引擎不用动
     ------------------------------------------------------------
     假名写法：R('{漢字|かんじ}をこう{書|か}く')  →  自动生成 <ruby>
     每题字段：
       id       唯一编号，前缀 = 大类（w/s/a/k）
       pack     大类，必须是 PACKS 里已定义的 key
       level    难度 1~3，同一局里按 1→3 排序出题
       type     phrase 说法选择 / culture 文化行为 / consequence 后果判断
       scene    场景地点（显示在顶部小胶囊里）
       jp / zh  场景日文原文 / 中文对照
       ask/askCn 设问日文 / 中文
       options  必须正好 3 个，且**恰好 1 个** ok:true
                jp/zh 选项与译文；badge 语体标签；
                kind  失礼风险配色 anime=红(踩雷) keigo=绿(得体) casual=黄(不理想)
                       ※ 纯知识题三项可同色，避免颜色泄题
                ok    是否正解；why 解析
       takeaway 一句话金句（结算页"带走清单"用）
       tip      进阶补充（黄框）
     改完刷新页面即可，题库有错会在页面顶部弹红条提示。
     ============================================================ */

  /* 假名简写：{漢字|かんじ} → <ruby>漢字<rt>かんじ</rt></ruby> */
  const R = (s) => s.replace(/\{([^|{}]+)\|([^{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>');

  /* 场景大类 */
  const PACKS = {
    workplace: { label:'職場篇',        cn:'职场敬语' },
    survival:  { label:'サバイバル篇',  cn:'日常生存' },
    anime:     { label:'アニメ{罠|わな}篇', cn:'动漫踩雷' },
    keigo:     { label:'{敬語|けいご}トラップ篇', cn:'敬语陷阱' }
  };

  /* 题型：显示在场景胶囊旁，提示这题在考什么 */
  const TYPES = {
    phrase:      { label:'说法题' },   // 同一个意思，哪种说法得体
    culture:     { label:'习惯题' },   // 当地规矩该怎么做
    consequence: { label:'后果题' }    // 照搬动漫会发生什么
  };

  const ROUND = 3;          // 每局题数
  const MAX_HP = 3;         // 初始血量
  const SHOW_ROMAJI = true; // 是否显示正解的罗马音（改 false 即全局关闭）

  /* 全部题目（由各 data 文件 JP.add() 注册进来） */
  const BANK = [];

  const RANKS = [
    { min:3, rank:'日语社交达人', win:true,
      jp:R('{敬語|けいご}マスター{認定|にんてい}！'),
      note:'三个场面全部安全通过。你已经能把热血留在屏幕里，把敬语带进现场——这正是日本人最看重的分寸感。' },
    { min:2, rank:'半熟社会人', win:true,
      jp:R('あと{一歩|いっぽ}、{惜|お}しい！'),
      note:'大方向没错，偶尔会漏出动漫腔。记住：敬语的核心不是背句子，而是随时判断“对方是谁”。' },
    { min:1, rank:'热血预备役', win:false,
      jp:R('{気持|きも}ちは{本物|ほんもの}、{言葉|ことば}が{課題|かだい}。'),
      note:'气势满分，措辞扣分。先把「承知いたしました」「お任せください」「お疲れ様です」这三句练成条件反射吧。' },
    { min:0, rank:'动漫中毒患者', win:false,
      jp:R('{現実世界|げんじつせかい}へようこそ。'),
      note:'你的日语全部来自番剧——听力很强，场合感为零。好消息是：敬语是套路，套路可以速成。再来一次。' }
  ];

  /* ========== 题库自检：字段缺失 / 正解数量 / id 重复 ========== */
  function validateBank(bank){
    const errs = [], ids = new Set(), KINDS = new Set(['anime','keigo','casual']);
    bank.forEach((q, i) => {
      const at = `第${i + 1}题（${q.id || '缺 id'}）`;
      ['id','pack','scene','jp','zh','ask','askCn','takeaway','tip'].forEach(f => {
        if (!q[f]) errs.push(`${at}：缺字段 ${f}`);
      });
      if (q.id){
        if (ids.has(q.id)) errs.push(`${at}：id 与前面重复`);
        ids.add(q.id);
      }
      if (!PACKS[q.pack]) errs.push(`${at}：pack「${q.pack}」未在 PACKS 中定义`);
      if (!(q.level >= 1 && q.level <= 3)) errs.push(`${at}：level 必须是 1~3`);
      if (!TYPES[q.type]) errs.push(`${at}：type「${q.type}」不合法`);
      if (!Array.isArray(q.options) || q.options.length !== 3){
        errs.push(`${at}：必须正好 3 个选项`);
        return;
      }
      const rights = q.options.filter(o => o.ok).length;
      if (rights !== 1) errs.push(`${at}：正解有 ${rights} 个，必须恰好 1 个`);
      q.options.forEach((o, j) => {
        const tag = `${at} 选项${"ABC"[j]}`;
        ['jp','zh','badge','why'].forEach(f => { if (!o[f]) errs.push(`${tag}：缺字段 ${f}`); });
        if (!KINDS.has(o.kind)) errs.push(`${tag}：kind「${o.kind}」不合法（只能 anime/keigo/casual）`);
      });
    });
    Object.keys(PACKS).forEach(p => {
      if (!bank.some(q => q.pack === p)) errs.push(`大类「${p}」一道题都没有，抽题会漏空`);
    });
    if (bank.length < ROUND) errs.push(`题库只有 ${bank.length} 题，少于每局需要的 ${ROUND} 题`);
    return errs;
  }

  /* ========== 抽题：不同大类各抽 1 题 → 按难度升序 → 尽量避开上一局 ========== */
  let lastIds = new Set();

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function drawSet(){
    const packs = shuffle(Object.keys(PACKS)).filter(p => BANK.some(q => q.pack === p));
    const picked = [];
    for (const p of packs){
      if (picked.length >= ROUND) break;
      const pool = BANK.filter(q => q.pack === p);
      const fresh = pool.filter(q => !lastIds.has(q.id));
      const from = fresh.length ? fresh : pool;
      picked.push(from[Math.floor(Math.random() * from.length)]);
    }
    // 大类不够时，用剩下的题补满
    if (picked.length < ROUND){
      const rest = shuffle(BANK.filter(q => !picked.includes(q)));
      picked.push(...rest.slice(0, ROUND - picked.length));
    }
    picked.sort((a, b) => a.level - b.level);
    lastIds = new Set(picked.map(q => q.id));
    return picked;
  }

  root.JP = {
    R, PACKS, TYPES, ROUND, MAX_HP, SHOW_ROMAJI, BANK, RANKS,
    /* 注册一批题目；忘写 pack 字段时按文件所属大类自动补上 */
    add(pack, list) {
      list.forEach((q) => { if (!q.pack) q.pack = pack; BANK.push(q); });
    },
    validate: () => validateBank(BANK),
    draw: () => drawSet()
  };

})(window);
