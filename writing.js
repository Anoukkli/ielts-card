/* 雅思复习 · 写作模块
   四块：语法中译英 / 小作文骨架 / 大作文逻辑 / 复盘
   数据写在 writing.json，进度存在本机 localStorage（ielts.write.v1）
   不联网、不花 API 费用；导出 JSON 后可交给 DSH 批改。 */
(function () {
  'use strict';

  var KEY = 'ielts.write.v1';
  var INTERVALS = [1, 2, 4, 7, 15, 30, 60];
  var PLAN = { g: 8, t1: 2, t2: 1 };
  var TARGET_MIN = 45;
  var LABEL = { g: '语法中译英', t1: '小作文骨架', t2: '大作文逻辑', rev: '复盘与错句' };
  var META = {
    g: '8 句 · 约 15 分钟',
    t1: '2 条骨架 · 约 10 分钟',
    t2: '1 题 · 约 15 分钟',
    rev: '整理错句 · 约 5 分钟'
  };

  var ST = null, DATA = null, ROUND = null, clock = null;

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
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function today() { return dayStr(); }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._wt);
    t._wt = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ---------------- state ---------------- */
  function blank() { return { srs: {}, logs: [], days: {} }; }
  function load() {
    if (ST) return;
    try { ST = JSON.parse(localStorage.getItem(KEY) || 'null') || blank(); }
    catch (e) { ST = blank(); }
    if (!ST.srs) ST.srs = {};
    if (!ST.logs) ST.logs = [];
    if (!ST.days) ST.days = {};
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ST)); }
    catch (e) { toast('存不进去：检查 Safari 存储设置'); }
  }
  function peekDay() { return ST.days[today()] || null; }
  function day() {
    var t = today();
    if (!ST.days[t]) ST.days[t] = { started: Date.now(), done: { g: 0, t1: 0, t2: 0 }, rev: false, items: {} };
    var d = ST.days[t];
    d.done = d.done || { g: 0, t1: 0, t2: 0 };
    d.items = d.items || {};
    return d;
  }
  function blockTotal(k) {
    var d = peekDay();
    var ids = d && d.items && d.items[k];
    return (ids && ids.length) || PLAN[k] || 1;
  }
  function blockDone(k) {
    var d = peekDay();
    if (!d) return false;
    if (k === 'rev') return !!d.rev;
    return (d.done[k] || 0) >= blockTotal(k);
  }
  function doneCount() {
    var n = 0;
    ['g', 't1', 't2'].forEach(function (k) { if (blockDone(k)) n++; });
    if (blockDone('rev')) n++;
    return n;
  }

  /* ---------------- data ---------------- */
  async function ensureData() {
    if (DATA) return true;
    try {
      var r = await fetch('writing.json?t=' + Date.now());
      if (!r.ok) throw new Error(r.status);
      DATA = await r.json();
      return true;
    } catch (e) {
      appEl().innerHTML = '<div class="done"><div class="big">📭</div><h2>写作数据没加载上</h2>' +
        '<p>确认 writing.json 和本页在同一目录</p>' +
        '<button class="btn primary" id="wretry" style="margin-top:20px;justify-content:center">重试</button></div>';
      var b = document.getElementById('wretry');
      if (b) b.onclick = function () { DATA = null; openHub(); };
      return false;
    }
  }

  /* ---------------- pick ---------------- */
  function hashDate(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h;
  }
  function seeded(arr, seed) {
    var a = arr.slice(), s = seed >>> 0;
    function rnd() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function epochDay() { return Math.floor(Date.now() / 864e5); }

  function pickItems(k) {
    var t = today();
    var seed = hashDate(t + k);
    if (k === 'g') {
      var pool = DATA.grammar;
      var due = [], unseen = [], later = [];
      pool.forEach(function (x) {
        var st = ST.srs[x.id];
        if (!st) unseen.push(x);
        else if (st.d <= t) due.push(x);
        else later.push(x);
      });
      later.sort(function (a, b) {
        var sa = ST.srs[a.id].s || 0, sb = ST.srs[b.id].s || 0;
        return sa - sb;
      });
      // 你自己的原文改写的题（pri）先出，通用题往后排
      var hot = unseen.filter(function (x) { return x.pri; });
      var rest = unseen.filter(function (x) { return !x.pri; });
      var fresh = seeded(hot, seed + 3).concat(seeded(rest, seed + 7));
      return seeded(due, seed).concat(fresh).concat(later)
        .slice(0, PLAN.g).map(function (x) { return x.id; });
    }
    if (k === 't1') {
      var n = DATA.task1.length, dn = epochDay();
      return [DATA.task1[dn % n].id, DATA.task1[(dn + 5) % n].id];
    }
    var m = DATA.task2.length;
    return [DATA.task2[epochDay() % m].id];
  }

  function elapsedSec() {
    var d = day();
    return (d.spent || 0) + Math.max(0, Math.floor((Date.now() - (d.started || Date.now())) / 1000));
  }
  function flushTime() {
    var d = peekDay();
    if (!d) return;
    d.spent = elapsedSec();
    d.started = Date.now();
    save();
  }

  /* ---------------- timer ---------------- */
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function startClock() {
    clearClock();
    function tick() {
      var el = document.getElementById('wclock');
      if (!el) { clearClock(); return; }
      var sec = elapsedSec();
      el.textContent = fmt(sec);
      el.classList.toggle('over', sec > TARGET_MIN * 60);
    }
    tick();
    clock = setInterval(tick, 1000);
  }
  function clearClock() { if (clock) { clearInterval(clock); clock = null; } }

  /* ---------------- chrome ---------------- */
  function top(title, right) {
    return '<div class="w-top">' +
      '<button class="w-back" id="wback" aria-label="返回">‹</button>' +
      '<div class="w-title">' + esc(title) + '</div>' +
      (right ? '<div class="w-count">' + esc(right) + '</div>' : '') +
      '<div class="w-clock" id="wclock">00:00</div>' +
      '</div>';
  }
  function bindBack(fn) {
    var b = document.getElementById('wback');
    if (b) b.onclick = fn;
  }

  /* ---------------- hub ---------------- */
  async function openHub() {
    load();
    var ok = await ensureData();
    if (!ok) return;
    renderHub();
  }

  function renderHub() {
    clearBodyTimer();
    day();
    var d = peekDay();
    var elapsed = elapsedSec();
    var dots = '';
    ['g', 't1', 't2', 'rev'].forEach(function (k) {
      dots += '<div class="w-dot' + (blockDone(k) ? ' on' : '') + '"></div>';
    });
    var rows = ['g', 't1', 't2', 'rev'].map(function (k) {
      var st = blockDone(k) ? 'done' : 'todo';
      var n = k === 'rev' ? '' : (Math.min(d.done[k] || 0, blockTotal(k)) + '/' + blockTotal(k));
      var right = st === 'done' ? '✓ 完成' : (n || '待做');
      return '<button class="w-blk" data-k="' + k + '">' +
        '<div class="w-blk-main"><div class="w-blk-t">' + LABEL[k] + '</div>' +
        '<div class="w-blk-s">' + META[k] + '</div></div>' +
        '<div class="w-blk-r ' + st + '">' + right + '</div></button>';
    }).join('');

    var bad = ST.logs.filter(function (l) { return l.block !== 'rule' && l.grade !== 'good'; }).length;

    appEl().innerHTML =
      top('写作 · 今日') +
      '<div class="w-intro">四块按顺序做，语法先热身，框架后收口。对照不是判卷，是让你看见差在哪。</div>' +
      '<div class="w-dots">' + dots + '</div>' +
      '<div class="w-timebar"><span>今日已用 <b>' + fmt(elapsed) + '</b> / 45:00</span>' +
      '<span class="' + (elapsed > TARGET_MIN * 60 ? 'w-over' : '') + '">' + (doneCount() === 4 ? '收工' : '') + '</span></div>' +
      rows +
      '<div class="w-k" style="margin-top:10px">加练（不计入上面四块）</div>' +
      '<button class="w-blk" id="wstartEssay">' +
      '<div class="w-blk-main"><div class="w-blk-t">成篇套模板</div>' +
      '<div class="w-blk-s">观点 → 框架 → 两段主体 · 约 25 分钟</div></div>' +
      '<div class="w-blk-r">' + (window.ESSAY ? window.ESSAY.summaryText() : '4 步') + '</div></button>' +
      '<button class="w-blk" id="wstartIdea">' +
      '<div class="w-blk-main"><div class="w-blk-t">观点速练</div>' +
      '<div class="w-blk-s">90 秒想两个论点 · 3 题 · 治没话讲</div></div>' +
      '<div class="w-blk-r">' + (window.IDEAS ? window.IDEAS.summaryText() : '3 题') + '</div></button>' +
      '<div class="w-links">' +
      '<button class="w-link" id="wbank">错句库 · ' + bad + ' 条</button>' +
      '<button class="w-link" id="wexport">导出写作记录</button>' +
      '</div>' +
      '<div class="w-tip">导出后把文件发给我（DSH），我按「原句 → 最小修改 → 错因 → 一句话规则」回填。</div>';

    startClock();
    bindBack(function () { clearClock(); flushTime(); if (window.__ieltsHome) window.__ieltsHome(); });
    $$('[data-k]').forEach(function (b) {
      b.onclick = function () { startBlock(b.getAttribute('data-k')); };
    });
    $('#wbank').onclick = renderBank;
    $('#wexport').onclick = exportLog;
    $('#wstartEssay').onclick = function () {
      if (window.ESSAY) window.ESSAY.start(); else toast('成篇模块没加载上');
    };
    $('#wstartIdea').onclick = function () {
      if (window.IDEAS) window.IDEAS.start(); else toast('观点库没加载上');
    };
  }

  /* ---------------- 主体段专项 ---------------- */
  var BODY_T = null;
  function clearBodyTimer() { if (BODY_T) { clearInterval(BODY_T); BODY_T = null; } }

  function startBody() {
    clearBodyTimer();
    var item = DATA.task2[Math.floor(Date.now() / 864e5) % DATA.task2.length];
    ROUND = { k: 'body', step: 0, item: item, left: 600 };
    renderBody();
  }

  function renderBody() {
    var item = ROUND.item;
    clearClock();
    clearBodyTimer();
    appEl().innerHTML = top('主体段 · 10 分钟', item.typeName) +
      '<div class="w-card">' +
      '<div class="w-kicker">只写主体段 1，不写开头结尾</div>' +
      '<div class="w-en">' + esc(item.prompt) + '</div>' +
      '<div class="w-zh">' + esc(item.zh) + '</div>' +
      '<div class="w-hint">参考立场：' + esc(item.stance || '') + '</div>' +
      '<div class="w-bodyclock" id="wbodyclock">10:00</div>' +
      '<textarea class="w-ta" id="wans" rows="8" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="主题句 → 原因 → 例子 → 回扣"></textarea>' +
      '<button class="btn primary" id="wcheck">看参考段落</button>' +
      '</div><div id="wpanel"></div>';
    bindBack(function () { clearBodyTimer(); renderHub(); });
    var left = 600;
    BODY_T = setInterval(function () {
      var el = document.getElementById('wbodyclock');
      if (!el) { clearBodyTimer(); return; }
      left--;
      if (left <= 0) {
        el.textContent = '时间到';
        el.classList.add('over');
        clearBodyTimer();
        return;
      }
      el.textContent = fmt(left);
      el.classList.toggle('over', left < 120);
    }, 1000);

    document.getElementById('wcheck').onclick = function () {
      var val = (document.getElementById('wans').value || '').trim();
      if (val.split(/\s+/).length < 30) { toast('主体段至少写 5 句再对照'); return; }
      showBodyPanel(item, val);
    };
  }

  function showBodyPanel(item, val) {
    clearBodyTimer();
    var c = (item.chain && item.chain[0]) || {};
    var model = [c.claim, c.reason, c.example, c.link].filter(Boolean).join(' ');
    var checks = ['主题句说了这一段要证明什么', '有 because / since 这类原因', '有一个具体例子', '最后一句回扣了立场'];
    document.getElementById('wpanel').innerHTML =
      '<div class="w-card">' +
      '<div class="w-k">参考段落（你的论点链拼起来）</div>' +
      '<div class="w-ref">' + esc(model) + '</div>' +
      '<div class="w-k">你的段落</div>' +
      '<div class="w-mine">' + esc(val) + '</div>' +
      '</div>' +
      '<div class="w-card"><div class="w-k">自检（缺一条就重写这段）</div>' +
      checks.map(function (t, i) {
        return '<label class="w-check"><input type="checkbox" data-c="' + i + '">' + esc(t) + '</label>';
      }).join('') + '</div>' +
      '<button class="btn primary" id="wbodysave" style="width:100%;justify-content:center">完成这段</button>';
    var ta = document.getElementById('wans');
    if (ta) ta.readOnly = true;
    var btn = document.getElementById('wcheck');
    if (btn) btn.style.display = 'none';
    document.getElementById('wbodysave').onclick = function () {
      ST.logs.push({
        d: today(), t: Date.now(), block: 'body', id: item.id, zh: item.zh,
        mine: val, ref: model, grade: 'done'
      });
      save();
      toast('记下了');
      renderHub();
    };
  }

  /* ---------------- block entry ---------------- */
  function startBlock(k) {
    var d = day();
    if (k === 'rev') { renderReviewMenu(); return; }
    if (!d.items[k]) { d.items[k] = pickItems(k); save(); }
    var ids = d.items[k];
    var i = d.done[k] || 0;
    if (i >= ids.length) { renderBlockDone(k); return; }
    ROUND = { k: k, ids: ids, i: i, step: 0, ans: {} };
    renderItem();
  }

  function renderBlockDone(k) {
    var d = peekDay();
    var rows = ST.logs.filter(function (l) { return l.d === today() && l.block === k; }).map(logRow).join('');
    appEl().innerHTML = top(LABEL[k], '完成') +
      '<div class="done" style="flex:none;padding:22px 0 6px">' +
      '<div class="big">✅</div><h2>这块今天完成了</h2>' +
      '<p>' + (k === 'g' ? '明天会按间隔把弱的再推回来' : '明天换新题') + '</p></div>' +
      (rows ? '<div class="w-k">今天写的</div>' + rows : '') +
      '<button class="btn primary" id="wbackhome" style="margin-top:22px;justify-content:center">回到今日</button>' +
      '<button class="btn" id="wreviewblock" style="margin-top:10px;width:100%;justify-content:center">复盘这块</button>';
    document.getElementById('wbackhome').onclick = renderHub;
    document.getElementById('wreviewblock').onclick = function () { renderBlockReview(k); };
    bindBack(renderHub);
    startClock();
  }

  function logRow(l) {
    var tone = l.grade === 'good' ? 'ok' : l.grade === 'meh' ? 'meh' : l.grade === 'bad' ? 'bad' : 'meh';
    var tag = l.grade === 'good' ? '一次写对' : l.grade === 'meh' ? '差一点'
      : l.grade === 'bad' ? '不会' : l.grade === 'done' ? '已练' : '记录';
    return '<div class="w-log">' +
      '<div class="w-log-h"><span class="w-tag ' + tone + '">' + tag + '</span>' +
      '<span class="w-log-d">' + esc(l.d || '') + '</span></div>' +
      (l.zh ? '<div class="w-log-q">' + esc(l.zh) + '</div>' : '') +
      '<div class="w-log-a">你：' + esc(l.mine || '（空）') + '</div>' +
      '<div class="w-log-a ref">参考：' + esc(l.ref || '') + '</div>' +
      '</div>';
  }

  /* ---------------- generic item ---------------- */
  function renderItem() {
    if (ROUND.k === 'g') return renderG();
    if (ROUND.k === 't1') return renderT1();
    return renderT2();
  }

  function head(k, idx, total, sub) {
    return top(LABEL[k] + ' · ' + idx + '/' + total, sub || '');
  }

  /* -------- 语法 -------- */
  function renderG() {
    var item = DATA.grammar.filter(function (x) { return x.id === ROUND.ids[ROUND.i]; })[0];
    if (!item) return renderBlockDone('g');
    var chips = item.hint.split('/').map(function (h) {
      return '<span class="w-chip">' + esc(h.trim()) + '</span>';
    }).join('');
    appEl().innerHTML =
      head('g', ROUND.i + 1, ROUND.ids.length, item.p) +
      '<div class="w-card">' +
      '<div class="w-kicker">' + (item.src ? esc(item.src) + ' · ' : '') + '盯住：' + esc((item.tags || []).join(' / ')) + '</div>' +
      '<div class="w-zh">' + esc(item.zh) + '</div>' +
      '<div class="w-hint">提示词（不要求顺序一致）' + chips + '</div>' +
      '<textarea class="w-ta" id="wans" rows="3" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="用英文写一遍…"></textarea>' +
      '<button class="btn primary" id="wcheck">对照答案</button>' +
      '</div><div id="wpanel"></div>';
    bindBack(renderHub);
    wireCheck(item, 'g');
    startClock();
  }

  /* -------- 小作文 -------- */
  function renderT1() {
    var item = DATA.task1.filter(function (x) { return x.id === ROUND.ids[ROUND.i]; })[0];
    if (!item) return renderBlockDone('t1');
    var slots = (item.slots || []).map(function (s, i) {
      return '<div class="w-slot"><b>' + (i + 1) + '</b>' + esc(s) + '</div>';
    }).join('');
    appEl().innerHTML =
      head('t1', ROUND.i + 1, ROUND.ids.length, item.kind) +
      '<div class="w-card">' +
      '<div class="w-kicker">' + esc(item.kind) + ' · ' + esc(item.title) + '</div>' +
      '<div class="w-zh">' + esc(item.zh) + '</div>' +
      '<div class="w-k">句子任务</div>' + slots +
      '<textarea class="w-ta" id="wans" rows="5" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="按上面的任务写，不要照抄数据…"></textarea>' +
      '<button class="btn primary" id="wcheck">对照参考</button>' +
      '</div><div id="wpanel"></div>';
    bindBack(renderHub);
    wireCheck(item, 't1');
    startClock();
  }

  function wireCheck(item, kind) {
    var btn = document.getElementById('wcheck');
    var ta = document.getElementById('wans');
    btn.onclick = function () {
      var val = (ta.value || '').trim();
      if (!val) { toast('先写一句再对照'); return; }
      showPanel(item, val, kind);
    };
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); btn.click(); }
    });
  }

  /* -------- 对照面板 -------- */
  function tokenize(s) { return String(s || '').split(/\s+/).filter(Boolean); }
  function norm(w) { return w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''); }

  function compare(ref, mine) {
    var a = tokenize(ref), b = tokenize(mine);
    var an = a.map(norm), bn = b.map(norm);
    var n = an.length, m = bn.length, i, j;
    var dp = [];
    for (i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        dp[i][j] = an[i] === bn[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var marks = new Array(n).fill(false), extra = [], same = 0;
    i = 0; j = 0;
    while (i < n && j < m) {
      if (an[i] === bn[j]) { same++; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { marks[i] = true; i++; }
      else { extra.push(b[j]); j++; }
    }
    while (i < n) { marks[i] = true; i++; }
    while (j < m) { extra.push(b[j]); j++; }
    return { score: n ? Math.round(same / n * 100) : 0, marks: marks, words: a, extra: extra };
  }

  function markedRef(r) {
    return r.words.map(function (w, i) {
      return r.marks[i] ? '<mark class="w-miss">' + esc(w) + '</mark>' : esc(w);
    }).join(' ');
  }

  function gradesHTML(kind) {
    if (kind === 'g' || kind === 't1') {
      return '<div class="w-grades">' +
        '<button class="grade bad" data-wr="bad">不会<small>明天再来</small></button>' +
        '<button class="grade meh" data-wr="meh">差一点<small>拼写 / 小错</small></button>' +
        '<button class="grade good" data-wr="good">写对了<small>拉长间隔</small></button>' +
        '</div>';
    }
    return '';
  }

  function showPanel(item, val, kind) {
    var r = compare(item.en || item.ref, val);
    var extra = r.extra.length ? '<div class="w-extra">你多写了：' + r.extra.map(function (w) {
      return '<span class="w-chip bad">' + esc(w) + '</span>';
    }).join('') + '</div>' : '';
    var panel = document.getElementById('wpanel');
    panel.innerHTML =
      '<div class="w-card">' +
      '<div class="w-scorerow"><span class="w-score">重合 ' + r.score + '%</span>' +
      '<span class="w-tiny">词级对照，不判语法</span></div>' +
      '<div class="w-k">参考</div>' +
      '<div class="w-ref">' + markedRef(r) + '</div>' +
      extra +
      '<div class="w-k">为什么这么写</div>' +
      '<div class="w-why">' + esc(item.why) + '</div>' +
      (item.orig ? '<div class="w-k">你当时的原句</div><div class="w-mine">' + esc(item.orig) + '</div>' : '') +
      '</div>' + gradesHTML(kind);

    var ta = document.getElementById('wans');
    if (ta) ta.readOnly = true;
    var btn = document.getElementById('wcheck');
    if (btn) { btn.disabled = true; btn.style.display = 'none'; }

    $$('[data-wr]').forEach(function (b) {
      b.onclick = function () { saveGrade(item, val, kind, b.getAttribute('data-wr'), r.score); };
    });
    var p = document.getElementById('wpanel');
    if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------------- srs ---------------- */
  function srsGrade(id, g) {
    var st = ST.srs[id] || { s: 0, d: today(), r: 0, w: 0 };
    if (g === 'good') { st.s = Math.min(st.s + 1, INTERVALS.length - 1); st.r++; }
    else if (g === 'meh') { st.w++; }
    else { st.s = 0; st.w++; }
    var gap = g === 'bad' ? 1 : (g === 'meh' ? 2 : INTERVALS[Math.min(st.s, INTERVALS.length - 1)]);
    st.d = dayStr(addDays(new Date(), gap));
    st.ls = today();
    ST.srs[id] = st;
    save();
  }

  function saveGrade(item, mine, kind, g, score) {
    srsGrade(item.id, g);
    ST.logs.push({
      d: today(), t: Date.now(), block: kind, id: item.id,
      zh: item.zh, mine: mine, ref: item.en || item.ref, grade: g, score: score
    });
    var d = day();
    d.done[kind] = (d.done[kind] || 0) + 1;
    save();
    ROUND.i++;
    if (ROUND.i >= ROUND.ids.length) renderBlockDone(kind);
    else renderItem();
  }

  /* ---------------- 大作文 ---------------- */
  function renderT2() {
    var item = DATA.task2.filter(function (x) { return x.id === ROUND.ids[0]; })[0];
    if (!item) return renderBlockDone('t2');
    var step = ROUND.step;

    if (step === 0) {
      appEl().innerHTML = head('t2', 1, 1, item.typeName) +
        '<div class="w-card">' +
        '<div class="w-kicker">' + esc(item.typeName) + ' · 第 1 步：审题 + 立场</div>' +
        '<div class="w-en">' + esc(item.prompt) + '</div>' +
        '<div class="w-zh">' + esc(item.zh) + '</div>' +
        '<div class="w-hint">先圈关键词，再用一句话定立场。立场必须能回答题目的每一问：' +
        (item.keywords || []).map(function (k) { return '<span class="w-chip">' + esc(k) + '</span>'; }).join('') + '</div>' +
        '<textarea class="w-ta" id="wans" rows="3" placeholder="In my view, ..."></textarea>' +
        '<button class="btn primary" id="wnext">下一步：列两个分论点</button>' +
        '</div>';
      bindBack(renderHub);
      startClock();
      var self = this;
      document.getElementById('wnext').onclick = function () {
        var v = (document.getElementById('wans').value || '').trim();
        if (v.length < 8) { toast('立场句至少写完整一句'); return; }
        ROUND.ans.stance = v; ROUND.step = 1; renderT2();
      };
      return;
    }

    if (step === 1) {
      appEl().innerHTML = head('t2', 1, 1, item.typeName) +
        '<div class="w-card">' +
        '<div class="w-kicker">第 2 步：两个分论点</div>' +
        '<div class="w-hint">一行一个，只写论点句，不展开。两个论点要能撑住你刚才的立场。</div>' +
        '<textarea class="w-ta" id="wans" rows="4" placeholder="1. ...&#10;2. ...">' + esc(ROUND.ans.claims || '') + '</textarea>' +
        '<button class="btn primary" id="wnext">下一步：展开第一个</button>' +
        '</div>';
      bindBack(renderHub);
      startClock();
      document.getElementById('wnext').onclick = function () {
        var v = (document.getElementById('wans').value || '').trim();
        var lines = v.split(/\n+/).filter(Boolean);
        if (lines.length < 2) { toast('要两行，一行一个论点'); return; }
        ROUND.ans.claims = v; ROUND.ans.first = lines[0].replace(/^\d+[.、)]\s*/, ''); ROUND.step = 2; renderT2();
      };
      return;
    }

    if (step === 2) {
      appEl().innerHTML = head('t2', 1, 1, item.typeName) +
        '<div class="w-card">' +
        '<div class="w-kicker">第 3 步：把第一个论点展开</div>' +
        '<div class="w-quote">' + esc(ROUND.ans.first) + '</div>' +
        '<div class="w-k">原因：为什么会这样</div>' +
        '<textarea class="w-ta sm" id="wreason" rows="1" placeholder="because ..."></textarea>' +
        '<div class="w-k">例子：具体到一个人 / 一件事</div>' +
        '<textarea class="w-ta sm" id="wexample" rows="1" placeholder="For example, ..."></textarea>' +
        '<div class="w-k">回扣：所以它支持你的立场</div>' +
        '<textarea class="w-ta sm" id="wlink" rows="1" placeholder="This shows that ..."></textarea>' +
        '<button class="btn primary" id="wnext">看参考思路</button>' +
        '</div>';
      bindBack(renderHub);
      startClock();
      document.getElementById('wnext').onclick = function () {
        var reason = (document.getElementById('wreason').value || '').trim();
        var example = (document.getElementById('wexample').value || '').trim();
        var link = (document.getElementById('wlink').value || '').trim();
        if (!reason || !example) { toast('原因和例子都要写，哪怕一句'); return; }
        ROUND.ans.reason = reason; ROUND.ans.example = example; ROUND.ans.link = link;
        ROUND.step = 3; renderT2();
      };
      return;
    }

    // step 3: 参考 + 自检
    var chain = (item.chain || []).map(function (c, i) {
      return '<div class="w-chain"><div class="w-chain-t">论点 ' + (i + 1) + '</div>' +
        '<div class="w-chain-l"><b>论点</b>' + esc(c.claim) + '</div>' +
        '<div class="w-chain-l"><b>原因</b>' + esc(c.reason) + '</div>' +
        '<div class="w-chain-l"><b>例子</b>' + esc(c.example) + '</div>' +
        '<div class="w-chain-l"><b>回扣</b>' + esc(c.link) + '</div></div>';
    }).join('');
    var traps = (item.traps || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
    var phrases = (item.phrases || []).map(function (p) { return '<span class="w-chip">' + esc(p) + '</span>'; }).join('');
    var checks = ['我回应了题目的每一问', '立场一句话说得清', '每个论点都有原因', '至少有一个具体例子'];
    var mineHTML = '<div class="w-card"><div class="w-k">你写的</div>' +
      '<div class="w-mine"><b>立场</b>' + esc(ROUND.ans.stance || '') + '</div>' +
      '<div class="w-mine"><b>论点</b>' + esc(ROUND.ans.claims || '').replace(/\n/g, '<br>') + '</div>' +
      '<div class="w-mine"><b>展开</b>' + esc(ROUND.ans.reason || '') + ' / ' + esc(ROUND.ans.example || '') +
      (ROUND.ans.link ? ' / ' + esc(ROUND.ans.link) : '') + '</div></div>';

    appEl().innerHTML = head('t2', 1, 1, item.typeName) +
      mineHTML +
      '<div class="w-card">' +
      '<div class="w-kicker">参考思路 · 参考立场：' + esc(item.stance || '') + '</div>' +
      chain +
      '</div>' +
      '<div class="w-card">' +
      '<div class="w-k">容易跑题的地方</div><ul class="w-traps">' + traps + '</ul>' +
      (phrases ? '<div class="w-k">可复用句型</div><div class="w-hint">' + phrases + '</div>' : '') +
      '</div>' +
      '<div class="w-card"><div class="w-k">自检（按真实考场标准）</div>' +
      checks.map(function (c, i) {
        return '<label class="w-check"><input type="checkbox" data-c="' + i + '">' + esc(c) + '</label>';
      }).join('') +
      '</div>' +
      '<button class="btn primary" id="wdone" style="justify-content:center">完成这题</button>';

    bindBack(renderHub);
    startClock();
    document.getElementById('wdone').onclick = function () {
      var mine = ['立场：' + (ROUND.ans.stance || ''), '论点：' + (ROUND.ans.claims || ''),
        '展开：' + (ROUND.ans.reason || '') + ' / ' + (ROUND.ans.example || '') + ' / ' + (ROUND.ans.link || '')].join('\n');
      ST.logs.push({
        d: today(), t: Date.now(), block: 't2', id: item.id,
        zh: item.zh, mine: mine, ref: item.chain && item.chain[0] ? item.chain[0].claim : '', grade: 'done', score: null
      });
      var d = day();
      d.done.t2 = (d.done.t2 || 0) + 1;
      save();
      renderBlockDone('t2');
    };
  }

  /* ---------------- 复盘 ---------------- */
  function renderRev() {
    var logs = ST.logs.filter(function (l) { return l.d === today() && l.block !== 'rule'; });
    var rows = logs.length ? logs.map(logRow).join('') : '<div class="w-empty">今天还没有记录。先做前面三块。</div>';
    var hist = DATA.grammar.filter(function (x) { return x.orig; }).slice(-6).reverse();
    var histHtml = hist.length ? '<div class="w-k">历史错句（来自批改）</div>' + hist.map(function (x) {
      return '<div class="w-log">' +
        '<div class="w-log-h"><span class="w-tag meh">' + esc(x.p) + '</span>' +
        '<span class="w-log-d">' + esc(x.src || '') + '</span></div>' +
        '<div class="w-log-a">你：' + esc(x.orig) + '</div>' +
        '<div class="w-log-a ref">参考：' + esc(x.en) + '</div>' +
        '</div>';
    }).join('') : '';
    appEl().innerHTML = top(LABEL.rev) +
      '<div class="w-intro">只挑最刺眼的一条，抄下来，写一句能带走的规则。写多了等于没写。</div>' +
      rows + histHtml +
      '<div class="w-card" style="margin-top:14px">' +
      '<div class="w-k">今天最刺眼的一句 + 一句话规则</div>' +
      '<textarea class="w-ta" id="wrule" rows="4" placeholder="例：Food industry took largest share → 行业名和最高级都别裸奔，the 要补上。"></textarea>' +
      '<button class="btn primary" id="wrevdone">完成复盘</button>' +
      '</div>';
    bindBack(renderHub);
    startClock();
    document.getElementById('wrevdone').onclick = function () {
      var v = (document.getElementById('wrule').value || '').trim();
      if (!v) { toast('写一句再收工'); return; }
      ST.logs.push({ d: today(), t: Date.now(), block: 'rule', mine: v, grade: 'note' });
      var d = day();
      d.rev = true;
      save();
      toast('记下了');
      renderHub();
    };
  }

  /* ---------------- 分块复盘 ---------------- */
  function renderReviewMenu() {
    var blocks = [['g', '语法'], ['t1', '小作文'], ['t2', '大作文']];
    var rows = blocks.map(function (b) {
      var n = ST.logs.filter(function (l) { return l.block === b[0]; }).length;
      return '<button class="w-blk" data-rv="' + b[0] + '">' +
        '<div class="w-blk-main"><div class="w-blk-t">' + b[1] + '复盘</div>' +
        '<div class="w-blk-s">' + n + ' 条记录 · 可打磨保存</div></div>' +
        '<div class="w-blk-r">›</div></button>';
    }).join('');
    appEl().innerHTML = top('复盘') +
      '<div class="w-intro">按模块分开看，不然会乱。每条都能存「打磨后的版本」。</div>' +
      rows +
      '<button class="w-blk" id="wreviewIdea"><div class="w-blk-main"><div class="w-blk-t">观点复盘</div>' +
      '<div class="w-blk-s">看过的题 + 你写的两个论点 + 参考</div></div><div class="w-blk-r">›</div></button>' +
      '<button class="w-link" id="wreviewAll" style="width:100%;margin-top:6px">全部记录（旧版混排）</button>';
    bindBack(renderHub);
    $$('[data-rv]').forEach(function (b) {
      b.onclick = function () { renderBlockReview(b.getAttribute('data-rv')); };
    });
    document.getElementById('wreviewIdea').onclick = function () {
      if (window.IDEAS && window.IDEAS.review) window.IDEAS.review();
      else toast('观点库没加载上');
    };
    document.getElementById('wreviewAll').onclick = renderRev;
    startClock();
  }

  function renderBlockReview(k) {
    var logs = ST.logs.filter(function (l) { return l.block === k; }).slice(-20).reverse();
    var rows = logs.length ? logs.map(function (l) {
      var idx = ST.logs.indexOf(l);
      return '<div class="w-card" style="margin-bottom:10px">' +
        '<div class="w-kicker">' + esc(l.d || '') + (l.zh ? ' · ' + esc(l.zh) : '') + '</div>' +
        '<div class="w-log-a">你：' + esc(l.mine || '（空）') + '</div>' +
        '<div class="w-log-a ref">参考：' + esc(l.ref || '') + '</div>' +
        '<textarea class="w-ta sm" data-polish="' + idx + '" rows="2" placeholder="打磨后的版本：改一个词、换个句型都算">' + esc(l.polish || '') + '</textarea>' +
        '<button class="w-link" data-save="' + idx + '" style="width:100%;margin-top:8px">保存打磨</button>' +
        '</div>';
    }).join('') : '<div class="w-empty">这块还没有记录。</div>';
    var rule = ST.logs.filter(function (l) { return l.block === 'rule' && l.k === k; }).slice(-1)[0];
    appEl().innerHTML = top(LABEL[k] + ' 复盘') +
      '<div class="w-intro">只复盘这一块。写错的那句，下面直接写打磨版；改一个词也算练习。</div>' +
      rows +
      '<div class="w-card"><div class="w-k">这块的一句话规则</div>' +
      '<textarea class="w-ta" id="wrule" rows="3" placeholder="例：数据句先写时间，再写数字。">' + esc(rule ? rule.mine : '') + '</textarea>' +
      '<button class="btn primary" id="wrulesave" style="width:100%;justify-content:center">保存规则</button></div>';
    bindBack(renderHub);
    startClock();
    $$('[data-save]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-save');
        var ta = document.querySelector('[data-polish="' + i + '"]');
        ST.logs[i].polish = (ta.value || '').trim();
        save();
        toast('打磨已存');
      };
    });
    document.getElementById('wrulesave').onclick = function () {
      var v = (document.getElementById('wrule').value || '').trim();
      if (!v) { toast('写一句再存'); return; }
      ST.logs.push({ d: today(), t: Date.now(), block: 'rule', k: k, mine: v, grade: 'note' });
      var d = day();
      d.rev = true;
      save();
      toast('规则已存');
      renderHub();
    };
  }

  /* ---------------- 错句库 ---------------- */
  function renderBank() {
    var logs = ST.logs.filter(function (l) { return l.block !== 'rule' && l.grade !== 'good' && l.grade !== 'done'; })
      .slice(-60).reverse();
    var rules = ST.logs.filter(function (l) { return l.block === 'rule'; }).slice(-20).reverse();
    var body = logs.length ? logs.map(logRow).join('') : '<div class="w-empty">还没有错句。练几轮就有了。</div>';
    var ruleHtml = rules.length ? '<div class="w-k">你写过的规则</div>' + rules.map(function (r) {
      return '<div class="w-rule">' + esc(r.mine) + '</div>';
    }).join('') : '';
    appEl().innerHTML = top('错句库', logs.length + ' 条') + body + ruleHtml;
    bindBack(renderHub);
    startClock();
  }

  /* ---------------- export ---------------- */
  function exportLog() {
    var data = { exported: today(), srs: ST.srs, days: ST.days, logs: ST.logs };
    var blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ielts-writing-' + today() + '.json';
    a.click();
  }

  /* ---------------- summary for home ---------------- */
  function summaryText() {
    load();
    var d = peekDay();
    if (!d) return '语法 · 小作文 · 大作文 · 复盘';
    var n = doneCount();
    if (n >= 4) return '今日已完成 ✓';
    var mins = Math.floor(elapsedSec() / 60);
    return '今日 ' + n + '/4 · 已写 ' + mins + ' 分钟';
  }

  /* ---------------- css ---------------- */
  function injectCSS() {
    if (document.getElementById('w-style')) return;
    var css = [
      '.w-top{display:flex;align-items:center;gap:10px;padding:2px 0 12px}',
      '.w-back{background:none;border:0;color:var(--dim);font-size:26px;line-height:1;padding:0 6px 0 0;font-family:inherit}',
      '.w-title{font-size:16px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.w-count{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}',
      '.w-clock{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}',
      '.w-bodyclock{font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums;margin-top:14px}',
      '.w-bodyclock.over{color:var(--bad)}',
      '.w-intro{font-size:12px;color:var(--dim);line-height:1.65;margin:2px 0 14px}',
      '.w-dots{display:flex;gap:6px;margin:0 0 10px}',
      '.w-dot{flex:1;height:5px;border-radius:3px;background:var(--line);transition:background .2s}',
      '.w-dot.on{background:var(--good)}',
      '.w-timebar{display:flex;justify-content:space-between;font-size:12px;color:var(--dim);margin-bottom:14px}',
      '.w-timebar b{color:var(--fg);font-variant-numeric:tabular-nums}',
      '.w-over{color:var(--bad)}',
      '.w-blk{width:100%;display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);',
      'border-radius:16px;padding:15px 16px;margin-bottom:10px;font-family:inherit;color:var(--fg);text-align:left}',
      '.w-blk:active{transform:scale(.99)}',
      '.w-blk-main{flex:1;min-width:0}',
      '.w-blk-t{font-size:15px;font-weight:600}',
      '.w-blk-s{font-size:11.5px;color:var(--dim);margin-top:4px}',
      '.w-blk-r{font-size:12px;color:var(--dim);white-space:nowrap}',
      '.w-blk-r.done{color:var(--good)}',
      '.w-links{display:flex;gap:10px;margin-top:6px}',
      '.w-link{flex:1;background:none;border:1px solid var(--line);border-radius:12px;padding:11px 12px;',
      'color:var(--dim);font-size:12px;font-family:inherit}',
      '.w-tip{font-size:11px;color:var(--dim);line-height:1.6;margin-top:12px}',
      '.w-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin-bottom:12px}',
      '.w-kicker{font-size:11px;color:var(--dim);letter-spacing:.04em;margin-bottom:10px}',
      '.w-zh{font-size:16.5px;line-height:1.75;font-weight:600}',
      '.w-en{font-size:15px;line-height:1.7;margin-top:2px}',
      '.w-hint{font-size:12px;color:var(--dim);line-height:1.9;margin-top:12px}',
      '.w-chip{display:inline-block;background:var(--card2);border-radius:7px;padding:2px 8px;margin:3px 5px 0 0;font-size:12px;color:var(--fg)}',
      '.w-chip.bad{color:var(--bad)}',
      '.w-ta{width:100%;margin-top:14px;border:1px solid var(--line);border-radius:14px;background:var(--card2);',
      'color:var(--fg);padding:12px 13px;font-size:16px;line-height:1.6;font-family:inherit;resize:vertical;outline:none}',
      '.w-ta:focus{border-color:var(--accent)}',
      '.w-ta.sm{min-height:44px;margin-top:8px}',
      '.w-card .btn{margin-top:12px;justify-content:center;width:100%}',
      '.w-k{font-size:11px;color:var(--dim);letter-spacing:.06em;margin:14px 0 6px}',
      '.w-ref{font-size:15px;line-height:1.75}',
      '.w-miss{background:transparent;color:var(--bad);text-decoration:underline;text-decoration-thickness:2px;font-weight:700}',
      '.w-scorerow{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:2px}',
      '.w-score{font-size:13px;color:var(--good);font-weight:700}',
      '.w-tiny{font-size:11px;color:var(--dim)}',
      '.w-extra{font-size:12px;color:var(--dim);margin-top:8px}',
      '.w-why{font-size:13px;line-height:1.75;color:var(--fg)}',
      '.w-grades{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:4px 0 6px}',
      '.w-slot{font-size:13px;line-height:1.6;color:var(--dim);margin-top:7px;display:flex;gap:8px}',
      '.w-slot b{color:var(--accent);font-weight:700;flex:none}',
      '.w-quote{font-size:14px;line-height:1.7;padding:10px 12px;border-left:3px solid var(--accent);',
      'background:var(--card2);border-radius:0 10px 10px 0}',
      '.w-chain{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}',
      '.w-chain:first-of-type{border-top:0;padding-top:2px}',
      '.w-chain-t{font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px}',
      '.w-chain-l{font-size:13px;line-height:1.7;margin-bottom:6px}',
      '.w-chain-l b{display:inline-block;min-width:34px;color:var(--dim);font-weight:600;font-size:11px;margin-right:6px}',
      '.w-traps{margin:0;padding-left:18px;font-size:13px;line-height:1.8}',
      '.w-check{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.6;margin-top:10px}',
      '.w-check input{margin-top:2px;width:18px;height:18px;accent-color:var(--accent)}',
      '.w-log{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 13px;margin-bottom:9px}',
      '.w-log-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}',
      '.w-tag{font-size:10.5px;padding:2px 7px;border-radius:6px;background:var(--card2)}',
      '.w-tag.ok{color:var(--good)} .w-tag.meh{color:var(--meh)} .w-tag.bad{color:var(--bad)}',
      '.w-log-d{font-size:10.5px;color:var(--dim)}',
      '.w-log-q{font-size:12.5px;color:var(--dim);line-height:1.6;margin-bottom:6px}',
      '.w-log-a{font-size:13px;line-height:1.65}',
      '.w-log-a.ref{color:var(--dim);margin-top:3px}',
      '.w-rule{font-size:13px;line-height:1.7;padding:8px 12px;background:var(--card2);border-radius:10px;margin-bottom:8px}',
      '.w-mine{font-size:13px;line-height:1.7;margin-top:8px}',
      '.w-mine b{color:var(--dim);font-weight:600;font-size:11px;margin-right:8px}',
      '.w-empty{font-size:13px;color:var(--dim);padding:26px 0;text-align:center}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'w-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ---------------- boot ---------------- */
  injectCSS();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectCSS, { once: true });
  }
  load();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) flushTime();
  });

  window.WRITING = {
    start: function () { clearClock(); openHub(); return false; },
    summaryText: summaryText,
    /* 测试与排查用：只读，不改状态 */
    _state: function () { return { ST: ST, DATA: DATA, ROUND: ROUND }; }
  };
})();
