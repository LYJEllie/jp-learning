# 动漫热血日语 vs 现实尴尬日语

一个纯前端的日语情景答题小游戏：番剧看了三百集，敬语一句不会。三个真实场面、三条命，说错一句气氛就凉一次。

**在线试玩 → https://lyjellie.github.io/jp-learning/**

无依赖、无框架：`index.html` 是把 HTML / CSS / JS 全部内联的单文件，拷走双击就能玩。

### 两种版式：URL 暗号

| 网址 | 效果 |
|---|---|
| `index.html` | **玩家版**：右侧录屏栏隐藏，游戏区居中占满整个外框 |
| `index.html?mode=video` | **录屏版**：右侧栏浮现，恢复左右分栏，右边可叠 Live2D / 真人画面 |

参数名和值都不区分大小写（`?MODE=Video` 同样生效）。手机端（≤768px）一律隐藏侧栏并回落为单列，录屏模式也不例外。

---

## 玩法

- 3 颗心血量 + 进度条，每局 3 题，答错扣一颗心，血量归零立即结束
- 答错：红屏闪烁 + 画面震动 + 心碎裂 + 巨型「気まずい！」冲击字
- 答对：撒花 + 「正解！」
- 每题都有讲解框（错在哪、正解为什么对）和黄色进阶框（延伸知识）
- 结算给称号（日语社交达人 / 半熟社会人 / 热血预备役 / 动漫中毒患者）、弱项诊断和"带走清单"
- 日文全部带 `<ruby>` 假名注音，正解附罗马音；支持键盘 A / B / C 作答

## 题库

200 题，四大类各 50 题：

| 大类 | key | 考什么 |
|---|---|---|
| 職場篇 | `workplace` | 承知いたしました、お任せください、汇报与道歉 |
| サバイバル篇 | `survival` | 便利店、居酒屋、拉面店、温泉、问路、结账 |
| アニメ罠篇 | `anime` | 照搬番剧台词的后果：お前、俺、うるさい、すげぇ |
| 敬語トラップ篇 | `keigo` | ご苦労様、对外称呼、二重敬语、バイト敬語 |

每局从**不同大类各抽 1 题**，按难度 1→3 排序（轻松开局、敬语陷阱压轴），并尽量避开上一局出过的题。

## 项目结构

```
index.html          ← 构建产物：题库游戏（只内联引擎，数据由 data/ 运行时加载）
story-en.html       ← 构建产物：剧情游戏 · 外企版（单文件，自带引擎与剧情）
story-jp.html       ← 构建产物：剧情游戏 · 日语版（同上）
src/
  index.html        源码：题库游戏的引擎与样式
  story.html        源码：剧情游戏的骨架与样式（EN / JP 共用这一份）
data/
  _core.js          题库引擎：R() / PACKS / TYPES / 注册器 / 自检 / 抽题 / 称号
  workplace.js      職場篇
  survival.js       サバイバル篇
  anime.js          アニメ罠篇
  keigo.js          敬語トラップ篇
  _story_core.js    剧情引擎：R() / 结局定义 / 剧情树自检 / 状态机 / 渲染
  story-en.js       剧情数据：外企版（含封面、侧栏等页面文案）
  story-jp.js       剧情数据：日语版
tools/
  check-bank.mjs    题库校验（字段 / id 重复 / 正解数量 / 抽题）
  check-story.mjs   剧情树校验（断链 / 孤儿节点 / 变量拼错 / 字段缺失），CI 友好
  test-flags.mjs    状态变量引擎的单元测试（条件求值 / 分流 / 变体 / 自检）
  smoke-story.mjs   成品页冒烟测试：在 DOM 桩里真跑一遍，确认打开能用
build.mjs           src + data → 根目录成品页
hooks/pre-push      push 前跑全套检查（git config core.hooksPath hooks 启用）
.github/workflows/  CI：同一串检查，外加「成品页是否已重新构建」
.nojekyll           让 GitHub Pages 原样托管（否则 _core.js 会被 Jekyll 忽略）
```

> 根目录的 `index.html` / `story-*.html` 都是**生成的**，不要直接改——改 `src/` 或 `data/`，再跑构建。
> 题库页依赖 `data/` 目录一起部署；剧情页是自包含的单文件，拷走就能跑。

## 加一道题

打开对应大类的文件，往数组里追加一个对象即可，`pack` 可以不写（`JP.add()` 会按文件自动补上）：

```js
{
  id:'s-07', level:2, type:'phrase',
  scene:R('{築地|つきじ}の{寿司屋|すしや}'),
  jp:R('{大将|たいしょう}に「{何|なに}か{苦手|にがて}なものは？」と{聞|き}かれた。'),
  zh:'师傅问你"有什么不吃的吗？"',
  ask:R('どう{答|こた}える？'),
  askCn:'该怎么回答？',
  options:[
    { jp:'…', zh:'…', badge:'热血',  kind:'anime',  ok:false, why:'…' },
    { jp:'…', zh:'…', badge:'得体',  kind:'keigo',  ok:true,  romaji:'…', why:'…' },
    { jp:'…', zh:'…', badge:'随口',  kind:'casual', ok:false, why:'…' }
  ],
  takeaway:'一句话金句，会出现在结算页的带走清单里',
  tip:R('进阶补充，可用 <span class="highlight">高亮</span> 标重点。')
}
```

**假名写法**：`{漢字|かんじ}` 会被 `R()` 转成 `<ruby>漢字<rt>かんじ</rt></ruby>`，不用手写标签。

### 字段说明

| 字段 | 说明 |
|---|---|
| `id` | 唯一编号，前缀是大类首字母（`w` / `s` / `a` / `k`） |
| `level` | 难度 1~3，决定它在一局里的出场顺序 |
| `type` | `phrase` 说法题 / `culture` 习惯题 / `consequence` 后果题，会显示在题面标签上 |
| `scene` | 场景地点，显示在顶部胶囊 |
| `jp` / `zh` | 场景日文原文 / 中文对照 |
| `ask` / `askCn` | 设问的日文 / 中文 |
| `options` | **必须正好 3 个**，且**恰好 1 个** `ok:true` |
| `badge` | 语体标签（热血 / 敬语 / 伪敬语 / 失礼 …） |
| `kind` | 配色，按**失礼风险**分：`anime` 红（踩雷）、`keigo` 绿（得体）、`casual` 黄（不理想） |
| `romaji` | 选填，只给正解注罗马音；`_core.js` 的 `SHOW_ROMAJI` 可一键关闭 |
| `heat` | 选填，场景标签旁的热度激将文案（如 `🔥 84.2% 答错率的地狱题`）。**是氛围文案，不是真实统计** |
| `takeaway` | 一句话金句，用于结算页 |
| `tip` | 黄色进阶框内容 |

### 两条内容约定

- **配色只表示失礼风险，不表示对错**。纯知识题（比如拉面硬度）三个选项可以同色，避免颜色泄题。
- **标签不要总是"绿色 = 正解"**。故意放几道"标签写着敬语但方向用错"的题（如 `ご苦労様です`、二重敬语），玩家才不会靠标签蒙。

### 题库自检

页面加载时会自动检查：字段缺失、`id` 重复、正解数量不为 1、`kind`/`type`/`pack` 非法、某个大类没有题……有问题就在页面顶部弹红条并在控制台打印，指到第几题第几个选项。

## 构建

开发时改 `data/*.js` 或 `src/index.html`，**直接双击 `src/index.html`** 就能看效果（里面引的是 `../data/xxx.js`，相对路径在 `file://` 下正常工作，不用起本地服务器）。

改完要发布：

```bash
node build.mjs            # 题库 · 懒加载版 → 根目录 index.html（上线用这个）
node build.mjs --inline   # 题库 · 单文件版 → dist/index.html（拷一个文件就能跑）
node build.mjs --story    # 剧情 · 两个语言各一个单文件 → story-en.html / story-jp.html
```

懒加载版只把引擎 `data/_core.js` 内联进 HTML，四个大类留在 `data/` 里由 `JP.load()` 并行按需加载——加题只改动一个数据文件，不用重发整包。新增大类时在 `_core.js` 的 `PACKS` 加一行、建同名 `.js`，构建脚本会自动带上。

构建脚本每次都会自检 `</script>` 闭合数，内联代码里混进未转义的 `</script` 会当场中止写入（那会把整个页面截断）。

## 剧情文字冒险

`story-en.html`（外企 Day 1）和 `story-jp.html`（入社初日）是同一套引擎的两个语言版本，走的是**剧情节点跳转**而不是线性出题：每个节点有场景、正文和若干分支，分支指向下一个节点 id，走到结局节点就出结局卡。三类结局分别是 `win` / `normal` / `gg`，解锁情况存在浏览器本地，封面上能看到收集进度。

同样支持 `?mode=video`：默认右侧栏隐藏、游戏区居中占满；带上参数右侧栏浮现，方便录屏时叠人设和标题。

### 加一段剧情

打开对应的 `data/story-<lang>.js`，往 `nodes` 数组里加节点，再从已有的某个 `choices.nextId` 指过来：

```js
{
  id:'nomikai_start',            // 唯一编号
  scene:'🍻 歓迎会',              // 场景标签
  text:'…剧情正文（{漢字|かんじ} 自动出假名）…',
  sub:'…中文对照，可省略…',
  ask:'どうする？', askSub:'你打算：',
  choices:[
    { text:'…选项…', sub:'…中文…', badge:'趣味标签', nextId:'某个节点 id' }
  ]
}
```

结局节点不写 `choices`，改写 `ending`（`win`/`normal`/`gg`）、`title`，可选 `lesson`（结局金句）。章节化建议用 id 前缀区分：`d2_start`、`nomikai_start`。

**选项一律同色**（白底黑边），不用配色区分好坏——否则玩家一眼就能看出哪条是正解。

### 状态变量与条件分支

让后面的剧情记住前面的选择。选项用 `set` 改变量，节点／选项／分流／变体用 `requires` 判断条件：

```js
// 选项：改变量
{ text:'…', badge:'用力过猛', set:{ 失言:true, 好感度:'-1' }, nextId:'humble_branch' }

// 选项：满足条件才出现（不满足就整条不显示）
{ text:'…', badge:'熟人才敢说', requires:{ 好感度:'>=2' }, nextId:'…' }

// 选项：按状态分流，nextId 永远是兜底
{ text:'…', badge:'…', nextId:'normal_end',
  routes:[ { requires:{ 好感度:'>=3' }, to:'perfect_win' } ] }

// 节点：同一个节点换一套说法（只改怎么讲，不改往哪走）
variants:[ { requires:{ 失言:true }, title:'逆风翻盘的新人', text:'…' } ]
```

条件写法：`'>=2'` `'<=1'` `'>0'` `'<3'` `'==1'` `'!=0'` 数值比较（没设过的变量当 0）、`true`/`false` 真值判断、数字或字符串相等判断。一个对象里多个条件是 AND，写成数组 `[{...},{...}]` 是 OR。赋值时 `'+1'`／`'-2'` 是加减，其余直接赋值。

条件只有这套声明式写法、不跑 `eval`，所以剧情永远只是数据，`check-story` 能在 Node 里把整棵树校验一遍。

在 `meta.flagLabels` 里登记的变量会显示在顶部状态条上（`失言:'第一印象：翻车'`）；没登记的照样参与判断，只是不给玩家看。

现成的例子：两个剧情包里，「用力过猛」那条线会 `set:{失言:true}`，之后即使靠情商翻盘走到 `perfect_win`，看到的也是**翻盘版**结局文案，而不是一路顺风那一版。

### 剧情树自检

```bash
node tools/check-story.mjs        # 校验剧情树，有问题 exit 1
node tools/test-flags.mjs         # 状态变量引擎的单元测试（50 项）
node tools/smoke-story.mjs        # 成品页在 DOM 桩里真跑一遍
```

会查断链（`nextId` / `routes[].to` 指向不存在的节点）、`id` 重复、结局节点还带 `choices`、非结局节点没有 `choices`（死胡同）、**从 `start` 出发永远走不到的孤儿节点**、必填字段缺失，以及条件分支特有的几个坑：

- `requires` 里用到、却从来没有被任何选项 `set` 过的变量（**变量名拼错**，这是最容易漏的）
- 一个节点的选项**全都带 `requires`**——条件都不满足时会一个选项都出不来
- `variants` 想覆盖 `id`／`choices`／`nextId`／`ending`（变体只该改文案）
- `set`／`requires` 的值类型不合法

页面加载时跑的是同一份 `Story.validate()`，有问题就在顶部弹红条。

## 检查与 CI

四个脚本，加起来跑完 1 秒出头：

```bash
node tools/check-bank.mjs     # 题库校验（字段 / id 重复 / 正解数量 / 抽题 200 轮）
node tools/check-story.mjs    # 剧情树校验（断链 / 孤儿节点 / 变量拼错）
node tools/test-flags.mjs     # 状态变量引擎单元测试（50 项）
node tools/smoke-story.mjs    # 成品页在 DOM 桩里真跑一遍
```

`check-bank` 和 `check-story` 调的就是页面上弹红条的那两个 `validate()`，**同一份逻辑**——本地过了页面就不会报。

### 别忘了重新构建

根目录的 `index.html` / `story-*.html` 是构建产物。改了 `src/` 或 `data/` 却忘了重跑构建，Pages 上就还是旧页面——本地怎么点都对，只有访客看到过期版本。这类问题不做检查基本发现不了，所以 hook 和 CI 都会拦：重新构建后如果成品页有变化，就报错退出。

### pre-push hook

克隆后启用一次即可：

```bash
git config core.hooksPath hooks     # 启用
git config --unset core.hooksPath   # 停用
git push --no-verify                # 单次跳过
```

`hooks/pre-push` 会跑完整套检查再放行，发现成品页过期时会顺手帮你重新构建好，只要 `git add` 一下就能继续。

### GitHub Actions

`.github/workflows/ci.yml` 在 push 到 `main` 和 PR 上跑同一串命令，最后一步同样检查成品页是否已重新构建。
