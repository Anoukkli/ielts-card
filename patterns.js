/* 雅思复习 · 句型卡
   一个骨架 × 三个主题：练的是「换内容不换结构」。
   词汇升级：看到基础表达，直接写出高级版，练条件反射。
   数据在 patterns.json，进度存本机 ielts.pat.v1。 */
(function () {
  'use strict';

  var KEY = 'ielts.pat.v1';
  var INTERVALS = [1, 2, 4, 7, 15, 30, 60];
  var UP_PER_DAY = 8;
  var VARIANTS = 3;

  var ST = null, DATA = null, ROUND = null;

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
  function epochDay() { return Math.floor(Date.now() / 864e5); }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._pt);
    t._pt = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }

  /* ---------------- state ---------------- */
  function load() {
    if (ST) return;
    try { ST = JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { ST = {}; }
    if (!ST.srs) ST.srs = {};
    if (!ST.days) ST.days = {};
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { toast('存不进去：检查 Safari 存储设置'); }
  }
  function peekDay() { return ST.days[today()] || null; }
  function day() {
    var t = today();
    if (!ST.days[t]) ST.days[t] = { u: 0, pid: null, pDone: false };
    return ST.days[t];
  }

  /* ---------------- data ---------------- */
  async function ensureData() {
    if (DATA) return true;
    try {
      var r = await fetch('patterns.json?t=' + Date.now());
      if (!r.ok) throw new Error(r.status);
      DATA = await r.json();
      return true;
    } catch (e) {
      appEl().innerHTML = '<div class="p-done"><div class="p-big">📭</div><h2>句型数据没加载上</h2>' +
        '<p>确认 patterns.json 和本页在同一目录</p>' +
        '<button class="p-btn" id="pretry">重试</button></div>';
      var b = document.getElementById('pretry');
      if (b) b.onclick = function () { DATA = null; open(); };
      return false;
    }
  }

  /* ---------------- pick ---------------- */
  function srsOf(id) { return ST.srs[id] || { s: 0, d: today(), w: 0 }; }
  function pickPattern() {
    var pool = DATA.patterns;
    var fresh = pool.filter(function (p) {
      return p.variants.some(function (v) { return srsOf(v.id).s < 2; });
    });
    if (!fresh.length) fresh = pool;
    return fresh[0]; // 按顺序推进：一个句型练到两个变体都稳了再换
  }
  function pickUpgrades(n) {
    var t = today();
    var due = [], unseen = [], rest = [];
    DATA.upgrades.forEach(function (u) {
      var st = ST.srs[u.id];
      if (!st) unseen.push(u);
      else if (st.d <= t) due.push(u);
      else rest.push(u);
    });
    rest.sort(function (a, b) { return srsOf(a.id).s - srsOf(b.id).s; });
    return due.concat(unseen).concat(rest).slice(0, n);
  }

  /* ---------------- srs ---------------- */
  function gradeSrs(id, g) {
    var st = ST.srs[id] || { s: 0, d: today(), w: 0 };
    if (g === 'good') { st.s = Math.min(st.s + 1, INTERVALS.length - 1); st.r = (st.r || 0) + 1; }
    else if (g === 'meh') { st.w = (st.w || 0) + 1; }
    else { st.s = 0; st.w = (st.w || 0) + 1; }
    var gap = g === 'bad' ? 1 : (g === 'meh' ? 2 : INTERVALS[Math.min(st.s, INTERVALS.length - 1)]);
    st.d = dayStr(addDays(new Date(), gap));
    ST.srs[id] = st;
    save();
  }

  /* ---------------- chrome ---------------- */
  function top(title, right) {
    return '<div class="p-top">' +
      '<button class="p-back" id="pback" aria-label="返回">‹</button>' +
      '<div class="p-title">' + esc(title) + '</div>' +
      (right ? '<div class="p-count">' + esc(right) + '</div>' : '') +
      '</div>';
  }
  function bindBack(fn) {
    var b = document.getElementById('pback');
    if (b) b.onclick = fn;
  }

  /* ---------------- hub ---------------- */
  async function open() {
    load();
    var ok = await ensureData();
    if (!ok) return;
    renderHub();
  }

  function renderHub() {
    var d = day();
    var pat = pickPattern();
    var upDone = d.u || 0;
    var pDone = !!d.pDone;
    var upTotal = UP_PER_DAY;

    appEl().innerHTML =
      top('句型卡 · 今日') +
      '<div class="p-intro">一个骨架换三个主题，练到不用想结构；词汇升级练「看到基础表达直接换高级版」。</div>' +
      '<button class="p-blk" id="pstartPat">' +
      '<div class="p-blk-main"><div class="p-blk-t">模板句型 · ' + esc(pat.group) + '</div>' +
      '<div class="p-blk-s">' + esc(pat.name) + ' · 3 个主题</div></div>' +
      '<div class="p-blk-r ' + (pDone ? 'done' : '') + '">' + (pDone ? '✓ 完成' : '开始') + '</div></button>' +
      '<button class="p-blk" id="pstartUp">' +
      '<div class="p-blk-main"><div class="p-blk-t">词汇升级</div>' +
      '<div class="p-blk-s">' + upTotal + ' 个 · 约 8 分钟 · 基础表达 → 高级版</div></div>' +
      '<div class="p-blk-r ' + (upDone >= upTotal ? 'done' : '') + '">' + Math.min(upDone, upTotal) + '/' + upTotal + '</div></button>' +
      '<div class="p-links"><button class="p-link" id="plist">全部句型 · ' + DATA.patterns.length + ' 个</button>' +
      '<button class="p-link" id="pups">词汇库 · ' + DATA.upgrades.length + ' 条</button></div>' +
      '<div class="p-tip">句型卡单独计进度，不和背单词混在一起。</div>';

    bindBack(function () { if (window.__ieltsHome) window.__ieltsHome(); });
    document.getElementById('pstartPat').onclick = function () { startPattern(pat); };
    document.getElementById('pstartUp').onclick = startUpgrades;
    document.getElementById('plist').onclick = renderPatternList;
    document.getElementById('pups').onclick = renderUpgradeList;
  }

  /* ---------------- 句型列表 ---------------- */
  function renderPatternList() {
    var rows = DATA.patterns.map(function (p) {
      var done = p.variants.filter(function (v) { return srsOf(v.id).s >= 2; }).length;
      return '<button class="p-blk" data-pid="' + p.id + '">' +
        '<div class="p-blk-main"><div class="p-blk-t">' + esc(p.name) + '</div>' +
        '<div class="p-blk-s">' + esc(p.group) + ' · ' + esc(p.variants.map(function (v) { return v.topic; }).join(' / ')) + '</div></div>' +
        '<div class="p-blk-r ' + (done >= VARIANTS ? 'done' : '') + '">' + done + '/' + VARIANTS + '</div></button>';
    }).join('');
    appEl().innerHTML = top('全部句型', DATA.patterns.length + ' 个') + rows;
    bindBack(renderHub);
    $$('[data-pid]').forEach(function (b) {
      b.onclick = function () {
        var p = DATA.patterns.filter(function (x) { return x.id === b.getAttribute('data-pid'); })[0];
        startPattern(p);
      };
    });
  }

  function renderUpgradeList() {
    var rows = DATA.upgrades.map(function (u) {
      var st = srsOf(u.id);
      return '<div class="p-blk static">' +
        '<div class="p-blk-main"><div class="p-blk-t">' + esc(u.up) + '</div>' +
        '<div class="p-blk-s">' + esc(u.basic) + ' → ' + esc(u.group) + '</div></div>' +
        '<div class="p-blk-r ' + (st.s >= 2 ? 'done' : '') + '">' + (st.s >= 2 ? '✓' : st.s + '/5') + '</div></div>';
    }).join('');
    appEl().innerHTML = top('词汇库', DATA.upgrades.length + ' 条') + rows;
    bindBack(renderHub);
  }

  /* ---------------- 句型流程 ---------------- */
  function startPattern(p) {
    ROUND = { kind: 'pat', p: p, i: 0 };
    renderFrame();
  }

  function renderFrame() {
    var p = ROUND.p;
    appEl().innerHTML = top(p.name, p.group) +
      '<div class="p-card">' +
      '<div class="p-kicker">骨架</div>' +
      '<div class="p-frame">' + esc(p.frame) + '</div>' +
      '<div class="p-k">怎么用</div>' +
      '<div class="p-note">' + esc(p.note) + '</div>' +
      '<button class="p-btn" id="pgo">开始 3 个主题</button>' +
      '</div>';
    bindBack(renderHub);
    document.getElementById('pgo').onclick = function () { ROUND.i = 0; renderVariant(); };
  }

  function renderVariant() {
    var p = ROUND.p, v = p.variants[ROUND.i];
    appEl().innerHTML = top(p.name, (ROUND.i + 1) + '/' + VARIANTS) +
      '<div class="p-card">' +
      '<div class="p-kicker"><span class="p-topic">' + esc(v.topic) + '</span> 同一个句型，换内容</div>' +
      '<div class="p-zh">' + esc(v.zh) + '</div>' +
      '<div class="p-hint">提示词' + v.hint.split('/').map(function (h) {
        return '<span class="p-chip">' + esc(h.trim()) + '</span>';
      }).join('') + '</div>' +
      '<textarea class="p-ta" id="pans" rows="3" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="用这个骨架写完整一句…"></textarea>' +
      '<button class="p-btn" id="pcheck">对照</button>' +
      '</div><div id="ppanel"></div>';
    bindBack(renderHub);
    var btn = document.getElementById('pcheck');
    btn.onclick = function () {
      var val = (document.getElementById('pans').value || '').trim();
      if (!val) { toast('先写一句再对照'); return; }
      showPanel(v.en, val, v.id, p.note);
    };
  }

  /* ---------------- 词汇升级流程 ---------------- */
  function startUpgrades() {
    var items = pickUpgrades(UP_PER_DAY);
    ROUND = { kind: 'up', items: items, i: 0 };
    renderUpgrade();
  }

  function renderUpgrade() {
    var u = ROUND.items[ROUND.i];
    if (!u) return renderUpDone();
    appEl().innerHTML = top('词汇升级', (ROUND.i + 1) + '/' + ROUND.items.length) +
      '<div class="p-card">' +
      '<div class="p-kicker">' + esc(u.group) + ' · 基础表达</div>' +
      '<div class="p-basic">' + esc(u.basic) + '</div>' +
      '<div class="p-zh">' + esc(u.zh) + '</div>' +
      '<div class="p-hint">换成高级版' + '<span class="p-chip">' + esc(u.hint) + '</span></div>' +
      '<textarea class="p-ta" id="pans" rows="2" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="写完整的英文句子…"></textarea>' +
      '<button class="p-btn" id="pcheck">对照</button>' +
      '</div><div id="ppanel"></div>';
    bindBack(renderHub);
    document.getElementById('pcheck').onclick = function () {
      var val = (document.getElementById('pans').value || '').trim();
      if (!val) { toast('先写一句再对照'); return; }
      showPanel(u.en, val, u.id, u.why);
    };
  }

  /* ---------------- 对照 ---------------- */
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
      return r.marks[i] ? '<mark class="p-miss">' + esc(w) + '</mark>' : esc(w);
    }).join(' ');
  }

  function showPanel(ref, mine, id, why) {
    var r = compare(ref, mine);
    var extra = r.extra.length ? '<div class="p-extra">你多写了：' + r.extra.map(function (w) {
      return '<span class="p-chip bad">' + esc(w) + '</span>';
    }).join('') + '</div>' : '';
    document.getElementById('ppanel').innerHTML =
      '<div class="p-card">' +
      '<div class="p-scorerow"><span class="p-score">重合 ' + r.score + '%</span>' +
      '<span class="p-tiny">词级对照，不判语法</span></div>' +
      '<div class="p-k">参考</div>' +
      '<div class="p-ref">' + markedRef(r) + '</div>' + extra +
      '<div class="p-k">为什么这么写</div>' +
      '<div class="p-why">' + esc(why || '') + '</div>' +
      '</div>' +
      '<div class="p-grades">' +
      '<button class="p-grade bad" data-pg="bad">不会<small>明天再来</small></button>' +
      '<button class="p-grade meh" data-pg="meh">差一点<small>再练一次</small></button>' +
      '<button class="p-grade good" data-pg="good">写对了<small>拉长间隔</small></button>' +
      '</div>';
    var ta = document.getElementById('pans');
    if (ta) ta.readOnly = true;
    var btn = document.getElementById('pcheck');
    if (btn) btn.style.display = 'none';
    $$('[data-pg]').forEach(function (b) {
      b.onclick = function () {
        gradeSrs(id, b.getAttribute('data-pg'));
        nextCard();
      };
    });
    var p = document.getElementById('ppanel');
    if (p && p.scrollIntoView) p.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function nextCard() {
    if (ROUND.kind === 'pat') {
      ROUND.i++;
      if (ROUND.i >= ROUND.p.variants.length) return renderPatternDone();
      return renderVariant();
    }
    ROUND.i++;
    var d = day();
    d.u = (d.u || 0) + 1;
    save();
    if (ROUND.i >= ROUND.items.length) return renderUpDone();
    renderUpgrade();
  }

  /* ---------------- 完成页 ---------------- */
  function renderPatternDone() {
    var p = ROUND.p;
    var d = day();
    d.pDone = true; d.pid = p.id; save();
    appEl().innerHTML = top(p.name, '完成') +
      '<div class="p-done"><div class="p-big">✅</div><h2>这个句型过了</h2>' +
      '<p>' + esc(p.frame) + '</p></div>' +
      '<button class="p-btn" id="pnext">再练一个句型</button>' +
      '<button class="p-btn ghost" id="phome" style="margin-top:10px">回到今日</button>';
    document.getElementById('pnext').onclick = function () {
      var idx = DATA.patterns.indexOf(p);
      startPattern(DATA.patterns[(idx + 1) % DATA.patterns.length]);
    };
    document.getElementById('phome').onclick = renderHub;
    bindBack(renderHub);
  }

  function renderUpDone() {
    var d = day();
    appEl().innerHTML = top('词汇升级', '完成') +
      '<div class="p-done"><div class="p-big">🎉</div><h2>今天的升级练完了</h2>' +
      '<p>明天会先考今天写错的</p></div>' +
      '<button class="p-btn" id="phome">回到今日</button>';
    document.getElementById('phome').onclick = renderHub;
    bindBack(renderHub);
  }

  /* ---------------- summary ---------------- */
  function summaryText() {
    load();
    var d = peekDay();
    if (!d) return '1 个句型 · 8 个升级';
    if (d.pDone && (d.u || 0) >= UP_PER_DAY) return '今日已完成 ✓';
    return (d.pDone ? '句型 ✓' : '句型 0/1') + ' · 升级 ' + Math.min(d.u || 0, UP_PER_DAY) + '/' + UP_PER_DAY;
  }

  /* ---------------- css ---------------- */
  function injectCSS() {
    if (document.getElementById('p-style')) return;
    var css = [
      '.p-top{display:flex;align-items:center;gap:10px;padding:2px 0 12px}',
      '.p-back{background:none;border:0;color:var(--dim);font-size:26px;line-height:1;padding:0 6px 0 0;font-family:inherit}',
      '.p-title{font-size:16px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.p-count{font-size:12px;color:var(--dim);font-variant-numeric:tabular-nums}',
      '.p-intro{font-size:12px;color:var(--dim);line-height:1.65;margin:2px 0 14px}',
      '.p-blk{width:100%;display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);',
      'border-radius:16px;padding:15px 16px;margin-bottom:10px;font-family:inherit;color:var(--fg);text-align:left}',
      '.p-blk.static{cursor:default}',
      '.p-blk:active{transform:scale(.99)}',
      '.p-blk-main{flex:1;min-width:0}',
      '.p-blk-t{font-size:15px;font-weight:600}',
      '.p-blk-s{font-size:11.5px;color:var(--dim);margin-top:4px}',
      '.p-blk-r{font-size:12px;color:var(--dim);white-space:nowrap}',
      '.p-blk-r.done{color:var(--good)}',
      '.p-links{display:flex;gap:10px;margin-top:6px}',
      '.p-link{flex:1;background:none;border:1px solid var(--line);border-radius:12px;padding:11px 12px;',
      'color:var(--dim);font-size:12px;font-family:inherit}',
      '.p-tip{font-size:11px;color:var(--dim);line-height:1.6;margin-top:12px}',
      '.p-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin-bottom:12px}',
      '.p-kicker{font-size:11px;color:var(--dim);letter-spacing:.04em;margin-bottom:10px}',
      '.p-topic{background:var(--card2);border-radius:6px;padding:2px 8px;color:var(--fg)}',
      '.p-zh{font-size:16px;line-height:1.7;font-weight:600;margin-top:10px}',
      '.p-frame{font-size:14.5px;line-height:1.75;padding:12px 14px;border-left:3px solid var(--accent);',
      'background:var(--card2);border-radius:0 12px 12px 0;color:var(--fg)}',
      '.p-basic{font-size:22px;font-weight:700;letter-spacing:-.01em;margin-bottom:6px}',
      '.p-note{font-size:13px;line-height:1.75;color:var(--dim)}',
      '.p-hint{font-size:12px;color:var(--dim);line-height:1.9;margin-top:12px}',
      '.p-chip{display:inline-block;background:var(--card2);border-radius:7px;padding:2px 8px;margin:3px 5px 0 0;font-size:12px;color:var(--fg)}',
      '.p-chip.bad{color:var(--bad)}',
      '.p-ta{width:100%;margin-top:14px;border:1px solid var(--line);border-radius:14px;background:var(--card2);',
      'color:var(--fg);padding:12px 13px;font-size:16px;line-height:1.6;font-family:inherit;resize:vertical;outline:none}',
      '.p-ta:focus{border-color:var(--accent)}',
      '.p-btn{width:100%;margin-top:14px;border:0;border-radius:16px;padding:15px 16px;font-size:15.5px;font-weight:600;',
      'background:var(--accent);color:#fff;font-family:inherit}',
      '.p-btn.ghost{background:var(--card2);color:var(--fg)}',
      '.p-k{font-size:11px;color:var(--dim);letter-spacing:.06em;margin:14px 0 6px}',
      '.p-ref{font-size:15px;line-height:1.75}',
      '.p-miss{background:transparent;color:var(--bad);text-decoration:underline;text-decoration-thickness:2px;font-weight:700}',
      '.p-scorerow{display:flex;align-items:baseline;justify-content:space-between}',
      '.p-score{font-size:13px;color:var(--good);font-weight:700}',
      '.p-tiny{font-size:11px;color:var(--dim)}',
      '.p-extra{font-size:12px;color:var(--dim);margin-top:8px}',
      '.p-why{font-size:13px;line-height:1.75}',
      '.p-grades{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:4px 0 6px}',
      '.p-grade{border:0;border-radius:14px;padding:15px 8px;font-size:14px;font-weight:600;color:#fff;font-family:inherit}',
      '.p-grade small{display:block;font-weight:400;font-size:10px;opacity:.8;margin-top:3px}',
      '.p-grade.bad{background:var(--bad)} .p-grade.meh{background:var(--meh)} .p-grade.good{background:var(--good)}',
      '.p-done{text-align:center;padding:26px 0 10px}',
      '.p-done .p-big{font-size:54px;line-height:1}',
      '.p-done h2{font-size:21px;margin:10px 0 6px}',
      '.p-done p{font-size:13px;color:var(--dim);line-height:1.7;margin:8px 0}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'p-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------------- boot ---------------- */
  injectCSS();
  load();

  window.PATTERNS = {
    start: function () { open(); return false; },
    summaryText: summaryText,
    _state: function () { return { ST: ST, DATA: DATA, ROUND: ROUND }; }
  };
})();
