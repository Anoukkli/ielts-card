/* 雅思复习 · 成篇套模板
   一条线：观点（90 秒）→ 框架（填立场/对方/论点）→ 主体段 1 → 主体段 2 → 全文骨架
   由易到多，先搭骨架再写段。数据来自 ideas.json，进度存 ielts.essay.v1。 */
(function () {
  'use strict';

  var KEY = 'ielts.essay.v1';
  var STEP_SECONDS = 90;
  var BODY_SECONDS = 480;

  var ST = null, DATA = null, R = null, T = null;

  function appEl() { return document.getElementById('app'); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function dayStr(d) {
    d = d || new Date();
    var t = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return t.toISOString().slice(0, 10);
  }
  function today() { return dayStr(); }
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._et);
    t._et = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function clearTimer() { if (T) { clearInterval(T); T = null; } }

  function load() {
    if (ST) return;
    try { ST = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { ST = {}; }
    if (!ST.logs) ST.logs = [];
    if (!ST.days) ST.days = {};
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { toast('存不进去：检查存储设置'); }
  }

  async function ensureData() {
    if (DATA) return true;
    try {
      var r = await fetch('ideas.json?t=' + Date.now());
      if (!r.ok) throw new Error(r.status);
      DATA = await r.json();
      return true;
    } catch (e) {
      appEl().innerHTML = '<div class="e-done"><div class="e-big">📭</div><h2>观点库没加载上</h2>' +
        '<p>确认 ideas.json 和本页在同一目录</p></div>';
      return false;
    }
  }

  function top(title, right) {
    return '<div class="e-top">' +
      '<button class="e-back" id="eback" aria-label="返回">‹</button>' +
      '<div class="e-title">' + esc(title) + '</div>' +
      (right ? '<div class="e-count">' + esc(right) + '</div>' : '') +
      '</div>';
  }
  function bindBack(fn) {
    var b = document.getElementById('eback');
    if (b) b.onclick = fn;
  }

  async function open() {
    load();
    var ok = await ensureData();
    if (!ok) return;
    renderHub();
  }

  function nextPrompt() {
    var done = {};
    ST.logs.forEach(function (l) { done[l.p] = 1; });
    var fresh = DATA.prompts.filter(function (p) { return !done[p.id]; });
    if (!fresh.length) fresh = DATA.prompts;
    return fresh[0];
  }

  function renderHub() {
    clearTimer();
    var p = nextPrompt();
    var n = ST.logs.length;
    appEl().innerHTML = top('成篇套模板') +
      '<div class="e-intro">先想观点，再搭框架，最后只写两个主体段。整篇留到框架熟了再写，一次 25 分钟左右。</div>' +
      '<div class="e-stat"><b>' + n + '</b> 篇已走过</div>' +
      '<div class="e-card">' +
      '<div class="e-kicker">下一篇 · ' + esc(p.topic) + '</div>' +
      '<div class="e-en">' + esc(p.prompt) + '</div>' +
      '<div class="e-zh">' + esc(p.zh) + '</div>' +
      '</div>' +
      '<button class="e-btn" id="estart">开始：观点 → 框架 → 主体段</button>' +
      '<div class="e-tip">第 1 步 90 秒想两个论点；第 2 步填立场和对方观点；第 3、4 步各 8 分钟写一段主体。</div>';
    bindBack(function () { if (window.WRITING && window.WRITING.start) window.WRITING.start(); });
    document.getElementById('estart').onclick = function () {
      R = { p: p, step: 0, claims: '', kw: '', stance: '', other: '', body1: '', body2: '' };
      renderClaims();
    };
  }

  /* 第 1 步：90 秒两个论点 */
  function renderClaims() {
    clearTimer();
    var p = R.p, left = STEP_SECONDS;
    appEl().innerHTML = top(p.topic, '1/4') +
      '<div class="e-card">' +
      '<div class="e-kicker">第 1 步 · 90 秒，先想两个论点</div>' +
      '<div class="e-en">' + esc(p.prompt) + '</div>' +
      '<div class="e-clock" id="eclock">' + fmt(left) + '</div>' +
      '<textarea class="e-ta" id="eclaims" rows="3" placeholder="两个论点，一行一个"></textarea>' +
      '<button class="e-btn" id="enext">下一步：搭框架</button>' +
      '</div>';
    bindBack(renderHub);
    T = setInterval(function () {
      var el = document.getElementById('eclock');
      if (!el) { clearTimer(); return; }
      left--;
      if (left <= 0) { el.textContent = '时间到'; el.classList.add('over'); clearTimer(); return; }
      el.textContent = fmt(left);
      el.classList.toggle('over', left < 30);
    }, 1000);
    document.getElementById('enext').onclick = function () {
      var v = (document.getElementById('eclaims').value || '').trim();
      clearTimer();
      R.claims = v;
      renderFrame();
    };
  }

  /* 第 2 步：框架 */
  function renderFrame() {
    var p = R.p;
    appEl().innerHTML = top(p.topic, '2/4') +
      '<div class="e-intro">只填四个空，先让骨架立起来。写不出来就先抄参考论点，改两个词也算。</div>' +
      '<div class="e-card">' +
      '<div class="e-kicker">题目关键词（英文，一个短语）</div>' +
      '<input class="e-in" id="ekw" placeholder="e.g. free university education" value="' + esc(R.kw) + '">' +
      '<div class="e-kicker" style="margin-top:14px">你的立场（一句英文）</div>' +
      '<input class="e-in" id="estance" placeholder="I hold the view that ..." value="' + esc(R.stance) + '">' +
      '<div class="e-kicker" style="margin-top:14px">对方最合理的理由（一句英文）</div>' +
      '<input class="e-in" id="eother" placeholder="Some people argue that ..." value="' + esc(R.other) + '">' +
      '<button class="e-btn" id="ebuild">生成骨架</button>' +
      '</div>';
    bindBack(renderHub);
    document.getElementById('ebuild').onclick = function () {
      R.kw = (document.getElementById('ekw').value || '').trim();
      R.stance = (document.getElementById('estance').value || '').trim();
      R.other = (document.getElementById('eother').value || '').trim();
      if (!R.stance) { toast('立场先写一句'); return; }
      renderSkeleton();
    };
  }

  /* 第 3 步：骨架预览 + 写主体段 1 */
  function skeletonHTML() {
    var p = R.p;
    var a1 = p.args[0], a2 = p.args[1];
    var opening = 'In recent years, whether ' + (R.kw || '[题目关键词]') +
      ' has triggered widespread debate. While some people believe that ' + (R.other || '[对方理由]') +
      ', I hold the view that ' + (R.stance || '[你的立场]') + '.';
    return '<div class="e-card">' +
      '<div class="e-kicker">骨架（等会儿照着写）</div>' +
      '<div class="e-line"><b>开头</b>' + esc(opening) + '</div>' +
      '<div class="e-line"><b>让步</b>On one side of the discussion, it is understandable that ' + esc(R.other || '[对方理由]') + '. However, this view overlooks the long-term cost.</div>' +
      '<div class="e-line"><b>主体 1</b>' + esc(a1.claim) + '</div>' +
      '<div class="e-line"><b>主体 2</b>' + esc(a2.claim) + '</div>' +
      '<div class="e-line"><b>结尾</b>To summarize, although ' + esc(R.other || '[对方理由]') + ', I believe that ' + esc(R.stance || '[你的立场]') + '.</div>' +
      '</div>';
  }

  function renderSkeleton() {
    appEl().innerHTML = top(R.p.topic, '2/4') +
      skeletonHTML() +
      '<div class="e-intro">骨架立住了再动笔。主体段先写论点 1，下一段写论点 2。</div>' +
      '<button class="e-btn" id="ebody1">写主体段 1（8 分钟）</button>';
    bindBack(renderHub);
    document.getElementById('ebody1').onclick = renderBody1;
  }

  function renderBody1() {
    var p = R.p, a = p.args[0];
    renderBody(1, a, '3/4');
  }
  function renderBody2() {
    var p = R.p, a = p.args[1];
    renderBody(2, a, '4/4');
  }

  function renderBody(n, arg, idxLabel) {
    clearTimer();
    var left = BODY_SECONDS;
    appEl().innerHTML = top('主体段 ' + n, idxLabel) +
      skeletonHTML() +
      '<div class="e-card">' +
      '<div class="e-kicker">写主体段 ' + n + '：主题句 → 原因 → 例子 → 回扣</div>' +
      '<div class="e-arg"><b>论点</b>' + esc(arg.claim) + '</div>' +
      '<div class="e-arg"><b>原因</b>' + esc(arg.reason) + '</div>' +
      '<div class="e-arg"><b>例子</b>' + esc(arg.example) + '</div>' +
      '<div class="e-clock" id="eclock">' + fmt(left) + '</div>' +
      '<textarea class="e-ta" id="ebody" rows="7" placeholder="先写主题句，再补原因和例子，最后一句回扣立场"></textarea>' +
      '<button class="e-btn" id="esave">完成这段</button>' +
      '</div>';
    bindBack(renderHub);
    T = setInterval(function () {
      var el = document.getElementById('eclock');
      if (!el) { clearTimer(); return; }
      left--;
      if (left <= 0) { el.textContent = '时间到'; el.classList.add('over'); clearTimer(); return; }
      el.textContent = fmt(left);
      el.classList.toggle('over', left < 60);
    }, 1000);
    document.getElementById('esave').onclick = function () {
      var v = (document.getElementById('ebody').value || '').trim();
      if (v.split(/\s+/).length < 30) { toast('至少写 5 句再交'); return; }
      clearTimer();
      if (n === 1) { R.body1 = v; renderBody2(); }
      else { R.body2 = v; renderDone(); }
    };
  }

  /* 第 4 步：全文骨架 + 收口 */
  function renderDone() {
    var p = R.p;
    appEl().innerHTML = top(p.topic, '完成') +
      '<div class="e-done"><div class="e-big">🧩</div><h2>这篇的骨架立住了</h2>' +
      '<p>下次同一篇，直接写整篇。</p></div>' +
      skeletonHTML() +
      '<div class="e-card"><div class="e-kicker">你写的主体段 1</div><div class="e-ref">' + esc(R.body1) + '</div></div>' +
      '<div class="e-card"><div class="e-kicker">你写的主体段 2</div><div class="e-ref">' + esc(R.body2) + '</div></div>' +
      '<div class="e-card"><div class="e-kicker">自检</div>' +
      '<label class="e-check"><input type="checkbox">开头有没有亮立场</label>' +
      '<label class="e-check"><input type="checkbox">两个主体段各有主题句</label>' +
      '<label class="e-check"><input type="checkbox">每段都有 because 和例子</label>' +
      '<label class="e-check"><input type="checkbox">结尾没有引入新观点</label>' +
      '</div>' +
      '<button class="e-btn" id="efinish">保存这篇</button>';
    bindBack(renderHub);
    document.getElementById('efinish').onclick = function () {
      ST.logs.push({
        d: today(), t: Date.now(), p: p.id, kw: R.kw, stance: R.stance, other: R.other,
        claims: R.claims, body1: R.body1, body2: R.body2
      });
      save();
      toast('存好了');
      renderHub();
    };
  }

  function injectCSS() {
    if (document.getElementById('e-style')) return;
    var css = [
      '.e-top{display:flex;align-items:center;gap:10px;padding:2px 0 12px}',
      '.e-back{background:none;border:0;color:var(--dim);font-size:26px;line-height:1;padding:0 6px 0 0;font-family:inherit}',
      '.e-title{font-size:16px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.e-count{font-size:12px;color:var(--dim)}',
      '.e-intro{font-size:12px;color:var(--dim);line-height:1.7;margin:2px 0 14px}',
      '.e-stat{font-size:13px;color:var(--dim);margin:4px 0 14px}',
      '.e-stat b{font-size:24px;color:var(--fg)}',
      '.e-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin-bottom:12px}',
      '.e-kicker{font-size:11px;color:var(--dim);letter-spacing:.04em;margin-bottom:10px}',
      '.e-en{font-size:15px;line-height:1.7;font-weight:600}',
      '.e-zh{font-size:13px;line-height:1.7;color:var(--dim);margin-top:8px}',
      '.e-clock{font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums;margin-top:12px}',
      '.e-clock.over{color:var(--bad)}',
      '.e-ta{width:100%;margin-top:12px;border:1px solid var(--line);border-radius:14px;background:var(--card2);color:var(--fg);padding:12px 13px;font-size:16px;line-height:1.6;font-family:inherit;resize:vertical;outline:none}',
      '.e-in{width:100%;margin-top:6px;border:1px solid var(--line);border-radius:12px;background:var(--card2);color:var(--fg);padding:10px 12px;font-size:15px;font-family:inherit;outline:none}',
      '.e-btn{width:100%;border:0;border-radius:16px;padding:15px 16px;font-size:15.5px;font-weight:600;background:var(--accent);color:#fff;font-family:inherit;margin-top:12px}',
      '.e-line{font-size:13px;line-height:1.7;margin-top:10px}',
      '.e-line b{display:inline-block;min-width:44px;color:var(--dim);font-weight:600;font-size:11px;margin-right:6px}',
      '.e-arg{font-size:13px;line-height:1.7;margin-top:8px}',
      '.e-arg b{color:var(--dim);font-weight:600;font-size:11px;margin-right:8px}',
      '.e-ref{font-size:13.5px;line-height:1.75;white-space:pre-wrap}',
      '.e-check{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.6;margin-top:10px}',
      '.e-check input{margin-top:2px;width:18px;height:18px;accent-color:var(--accent)}',
      '.e-done{text-align:center;padding:20px 0 6px}',
      '.e-done .e-big{font-size:52px;line-height:1}',
      '.e-done h2{font-size:21px;margin:10px 0 6px}',
      '.e-done p{font-size:13px;color:var(--dim)}',
      '.e-tip{font-size:11px;color:var(--dim);line-height:1.6;margin-top:12px}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'e-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  injectCSS();
  load();

  window.ESSAY = {
    start: function () { open(); return false; },
    summaryText: function () {
      load();
      return ST.logs.length ? ST.logs.length + ' 篇' : '观点→框架→两段';
    },
    _state: function () { return { ST: ST, DATA: DATA, R: R }; }
  };
})();
