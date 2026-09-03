/* ============================================================
   外企生存战 Day 1：窒息的茶水间（英文台词版）
   只放数据，加剧情直接往 nodes 数组里追加  字段说明见 data/_story_core.js
   ============================================================ */
(function (Story) {
  "use strict";

  Story.define('en', {

    /* ---------- 页面外壳：标题 / 封面 / 侧栏 / 计数器 ---------- */
    meta: {
      docTitle:'外企生存战 Day 1 · 剧情文字冒险',
      lang:'en',
      saveKey:'jp-learning:story-en:endings',
      /* 计数 key 就是 URL 里那段路径：想单独统计就换路径，想清零也换新路径 */
      counterSrc:'https://hits.sh/lyjellie.github.io/jp-learning-story-en.svg?style=flat-square&label=views&color=ff4757&labelColor=111111',

      cover:{
        kicker:'INTERACTIVE STORY · OFFICE SURVIVAL',
        title:'外企生存战 <span class="accent">Day 1</span><br>窒息的茶水间',
        sub:'英语不是问题，问题是你在什么场合说什么话。<br>一句话选错，第一天就能被请出大楼。',
        rules:[
          '剧情按分支走，没有“第几题”，只有“你选了什么”',
          '共 {endings} 种结局：完美通关 / 平庸收场 / 惨烈 GG',
          '键盘 A・B・C 或 1・2・3 也能选，方便录屏',
          '走到结局后可以立刻重来，把每条线都摸一遍'
        ],
        startMain:'Day 1',
        startSub:'开始上班 👔'
      },

      ui:{
        branchTag:'剧情分歧',
        ask:'你打算：',
        hint:'选一个走向 ／ A・B・C 或 1・2・3',
        retryMain:'Retry',
        retrySub:'重新挑战 🔁',
        recapLabel:'你走过的路：',
        lockedName:'？？？'
      },

      /* 状态变量的显示名：只有登记在这里的才会出现在顶部状态条上。
         没登记的变量照样能参与条件判断，只是不给玩家看。 */
      flagLabels:{
        失言:'第一印象：翻车'
      },

      sidebar:{
        title:'外企生存战<br><span class="vs-mark">Day 1</span> 窒息的茶水间',
        sub:'—— 一句话选错，第一天就能被请出去。',
        tag:'Your English is fine. Your timing is not.',
        overlay:'【OBS 画面叠加区：Live2D、真人出镜或动态字幕】',
        footer:'👉 体验同款网页小游戏：网址已放在评论区置顶<br>✨ 喜欢请点赞、订阅，每周更新职场生存指南'
      }
    },

    /* ---------- 剧情树 ---------- */
    nodes: [

      /* ===== 开局 ===== */
      {
        id:'start',
        scene:'💼 外企修罗场',
        text:`你入职第一天，在茶水间接咖啡，空降的美国大老板（VP）突然走进来。
              他看了一眼你的工牌，挑眉开玩笑说：<span class="en">『Hey! Ready for the big challenge?』</span>
              周围的资深高管都在看你。`,
        ask:'你打算：',
        choices:[
          { text:'假装肚子痛，捂着肚子喊 <span class="en">“Oh, my stomach!”</span> 冲进厕所。',
            badge:'三十六计', nextId:'wc_gg' },
          /* 这一步会记下「第一印象搞砸了」，后面的完美结局会换一套说法 */
          { text:'惊慌失措，满头大汗立正大喊：<span class="en">“Yes! I will work until I die!”</span>',
            badge:'用力过猛', set:{ 失言:true }, nextId:'humble_branch' },
          { text:'微微一笑回答：<span class="en">“Born ready! But I might need this coffee first.”</span>',
            badge:'松弛感', nextId:'perfect_branch' }
        ]
      },

      /* ===== 分支：热血喊话之后 ===== */
      {
        id:'humble_branch',
        scene:'👔 惊魂未定',
        text:`老板被你的热血大喊吓了一跳，场面一度非常尴尬。他拍拍你的肩膀干笑了一下走了。<br>
              下午开会，老板提出一个很不切实际的方案，所有人都沉默了，
              老板突然点名问你：<span class="en">『What do you think?』</span>`,
        ask:'你决定：',
        choices:[
          { text:'直接反对：<span class="en">“I don’t agree with you. Your idea is bad.”</span>',
            badge:'职场愣头青', nextId:'fire_gg' },
          { text:'虽然心里觉得不靠谱，但疯狂点头：<span class="en">“Great! Perfect idea!”</span>',
            badge:'职场马屁精', nextId:'normal_end' },
          /* 原规格这里写的是 high_success，但清单里没有定义该节点，
             按“共三个核心结局”的说明并入 perfect_win（第一印象翻车后靠情商翻盘）。 */
          { text:'优雅回应：<span class="en">“I see your point, but built on that, what if we...”</span>',
            badge:'情商拉满', nextId:'perfect_win' }
        ]
      },

      /* ===== 分支：松弛感回答之后 ===== */
      {
        id:'perfect_branch',
        scene:'🔥 崭露头角',
        text:`老板被你的幽默逗笑了，觉得你很有美式松弛感。<br>
              下午开会，老板提出一个不切实际的方案，全场死寂，
              老板直接看着你问：<span class="en">『What do you think?』</span>`,
        ask:'你决定：',
        choices:[
          { text:'直接反对：<span class="en">“I don’t agree with you.”</span>',
            badge:'钢铁直男', nextId:'fire_gg' },
          { text:'优雅提出修正：<span class="en">“I see your point, but built on that, what if we...”</span>',
            badge:'大佬发言', nextId:'perfect_win' }
        ]
      },

      /* ===== 结局 ===== */
      {
        id:'wc_gg',
        scene:'💀 社会性抹杀',
        ending:'gg',
        title:'职场透明人',
        text:`你成功逃跑了，但大老板转头问旁边的人：
              <span class="en">‘刚刚那个捂肚子的新员工叫什么？明天不用来了。’</span><br>
              你的外企生涯在茶水间彻底终结！`,
        lesson:`答不上来也别逃。<span class="en">“Let me think about that for a second.”</span>
                这一句就能买到时间，还不掉分。`
      },
      {
        id:'fire_gg',
        scene:'💀 卷铺盖走人',
        ending:'gg',
        title:'职场愣头青',
        text:`在外企直接说 <span class="en">“I don’t agree”</span> 等于直接扇老板耳光，空气瞬间凝固。<br>
              下午 HR 就找你谈话了……`,
        lesson:`反对要先接住再转弯：<span class="en">“I see your point, but what if we...”</span>
                先承认对方的逻辑，再把方案拐到你要的方向。`
      },
      {
        id:'normal_end',
        scene:'😐 混日子选手',
        ending:'normal',
        title:'职场老油条',
        text:`老板虽然觉得你没啥主见，但胜在听话。<br>
              你保住了工作，但注定只能做个默默无闻的边缘搬砖仔。`,
        lesson:`一味附和保得住位子，保不住存在感。补一句
                <span class="en">“One thing I'd add is...”</span>，你才开始被看见。`
      },
      {
        id:'perfect_win',
        scene:'🎉 职场明日之星',
        ending:'win',
        title:'天选外企高管',
        text:`老板对你的高情商修正方案赞不绝口，当场让你负责这个项目的核心部分。<br>
              入职第一天，你直接拿下了升职加薪的入场券！`,
        lesson:`外企的高分句型永远是这一个：
                <span class="en">“I see your point, but built on that, what if we...”</span>
                —— 不否定，只加建设性。`,

        /* 从「用力过猛」那条线绕回来的玩家，看到的是翻盘版结局。
           走向完全一样，只是说法不同——变体只改怎么讲，不改往哪走。 */
        variants:[
          {
            requires:{ 失言:true },
            title:'逆风翻盘的新人',
            text:`茶水间那句 <span class="en">“I will work until I die!”</span> 已经没人再提。
                  老板对你的高情商修正方案赞不绝口，当场让你负责这个项目的核心部分。<br>
                  第一印象砸得稀烂，你却用半天扳了回来！`,
            lesson:`第一印象砸了不是终点。会议室里的
                    <span class="en">“I see your point, but built on that...”</span>
                    比茶水间的自我介绍重要得多。`
          }
        ]
      }

    ]
  });

})(window.Story);
