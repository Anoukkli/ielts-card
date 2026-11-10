/* 雅思复习 · 观点速练
   每天 3 题：90 秒内想两个论点，再看观点库对照。
   题库在 ideas.json，进度存本机 ielts.idea.v1。 */
(function () {
  'use strict';

  var KEY = 'ielts.idea.v1';
  var INTERVALS = [1, 2, 4, 7, 15, 30];
  var PER_DAY = 3;
  var SECONDS = 90;

  var ST = null, DATA = null, ROUND = null, T = null;

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
  function fmt(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  function toast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._it);
    t._it = setTimeout(function () { t.classList.remove('show'); }, 2200);
  }
  function clearTimer() { if (T) { clearInterval(T); T = null; } }

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
    if (!ST.days[t]) ST.days[t] = { n: 0 };
    return ST.days[t];
  }
  function srsOf(id) { return ST.srs[id] || { s: 0, d: today(), w: 0 }; }

  async function ensureData() {
    if (DATA) return true;
    try {
      var r = await fetch('ideas.json?t=' + Date.now());
      if (!r.ok) throw new Error(r.status);
      DATA = await r.json();
      return true;
    } catch (e) {
      appEl().innerHTML = '<div class="i-done"><div class="i-big">📭</div><h2>观点库没加载上</h2>' +
        '<p>确认 ideas.json 和本页在同一目录</p></div>';
      return false;
    }
  }

  function pick(n) {
    var t = today();
    var due = [], unseen = [], rest = [];
    DATA.prompts.forEach(function (p) {
      var st = ST.srs[p.id];
      if (!st) unseen.push(p);
      else if (st.d <= t) due.push(p);
      else rest.push(p);
    });
    rest.sort(function (a, b) { return srsOf(a.id).s - srsOf(b.id).s; });
    return due.concat(unseen).concat(rest).slice(0, n);
  }

  function grade(id, g) {
    var st = ST.srs[id] || { s: 0, d: today(), w: 0 };
    if (g === 'good') { st.s = Math.min(st.s + 1, INTERVALS.length - 1); st.r = (st.r || 0) + 1; }
    else if (g === 'meh') { st.w = (st.w || 0) + 1; }
    else { st.s = 0; st.w = (st.w || 0) + 1; }
    var gap = g === 'bad' ? 1 : (g === 'meh' ? 2 : INTERVALS[Math.min(st.s, INTERVALS.length - 1)]);
    st.d = dayStr(addDays(new Date(), gap));
    ST.srs[id] = st;
    save();
  }

  function top(title, right) {
    return '<div class="i-top">' +
      '<button class="i-back" id="iback" aria-label="返回">‹</button>' +
      '<div class="i-title">' + esc(title) + '</div>' +
      (right ? '<div class="i-count">' + esc(right) + '</div>' : '') +
      '</div>';
  }
  function bindBack(fn) {
    var b = document.getElementById('iback');
    if (b) b.onclick = fn;
  }

  async function open() {
    load();
    var ok = await ensureData();
    if (!ok) return;
    renderHub();
  }

  function renderHub() {
    clearTimer();
    var d = peekDay();
    var n = d ? Math.min(d.n || 0, PER_DAY) : 0;
    appEl().innerHTML =
      top('观点速练') +
      '<div class="i-intro">看到题目先别写全文：90 秒内逼自己想出两个论点，再看观点库缺了什么。练的是「有话讲」，不是写整篇。</div>' +
      '<div class="i-stat"><b>' + n + '</b> / ' + PER_DAY + ' 题 <span>今天</span></div>' +
      '<button class="i-btn" id="istart">' + (n >= PER_DAY ? '今天已练完，再来一组' : '开始 3 题') + '</button>' +
      '<div class="i-tip">每题只有 90 秒。想不出来就空着，看参考时才知道自己缺哪一类理由。</div>';
    bindBack(function () { if (window.WRITING && window.WRITING.start) window.WRITING.start(); });
    document.getElementById('istart').onclick = startRound;
  }

  function startRound() {
    var items = pick(PER_DAY);
    if (!items.length) { toast('观点库是空的'); return; }
    ROUND = { items: items, i: 0 };
    renderPrompt();
  }

  function renderPrompt() {
    clearTimer();
    var p = ROUND.items[ROUND.i];
    if (!p) return renderDone();
    var left = SECONDS;
    appEl().innerHTML = top('观点速练', (ROUND.i + 1) + '/' + ROUND.items.length) +
      '<div class="i-card">' +
      '<div class="i-kicker"><span class="i-topic">' + esc(p.topic) + '</span> ' + (ROUND.i + 1) + '/' + ROUND.items.length + '</div>' +
      '<div class="i-en">' + esc(p.prompt) + '</div>' +
      '<div class="i-zh">' + esc(p.zh) + '</div>' +
      '<div class="i-clock" id="iclock">' + fmt(left) + '</div>' +
      '<textarea class="i-ta" id="ians" rows="3" autocapitalize="sentences" autocorrect="off" spellcheck="false" placeholder="两个论点，一行一个，英文一句"></textarea>' +
      '<button class="i-btn" id="icheck">看观点库</button>' +
      '</div><div id="ipanel"></div>';
    bindBack(renderHub);

    T = setInterval(function () {
      var el = document.getElementById('iclock');
      if (!el) { clearTimer(); return; }
      left--;
      if (left <= 0) {
        el.textContent = '时间到';
        el.classList.add('over');
        clearTimer();
        return;
      }
      el.textContent = fmt(left);
      el.classList.toggle('over', left < 30);
    }, 1000);

    document.getElementById('icheck').onclick = function () {
      var val = (document.getElementById('ians').value || '').trim();
      clearTimer();
      showArgs(p, val);
    };
  }

  function showArgs(p, mine) {
    var args = p.args.map(function (a, i) {
      return '<div class="i-arg"><div class="i-arg-t">论点 ' + (i + 1) + '</div>' +
        '<div class="i-arg-c">' + esc(a.claim) + '</div>' +
        '<div class="i-arg-l"><b>为什么</b>' + esc(a.reason) + '</div>' +
        '<div class="i-arg-l"><b>例子</b>' + esc(a.example) + '</div></div>';
    }).join('');
    document.getElementById('ipanel').innerHTML =
      '<div class="i-card">' +
      '<div class="i-kicker">参考立场</div>' +
      '<div class="i-zh" style="font-weight:500">' + esc(p.stance) + '</div>' +
      args +
      '</div>' +
      '<div class="i-card">' +
      '<div class="i-kicker">你写的</div>' +
      '<div class="i-mine">' + (mine ? esc(mine).replace(/\n/g, '<br>') : '（空着）') + '</div>' +
      '</div>' +
      '<div class="i-kicker">自评：你想到了几个</div>' +
      '<div class="i-grades">' +
      '<button class="i-grade bad" data-ig="bad">0 个<small>明天再来</small></button>' +
      '<button class="i-grade meh" data-ig="meh">1 个<small>差一点</small></button>' +
      '<button class="i-grade good" data-ig="good">2 个<small>拉长间隔</small></button>' +
      '</div>';
    $$('[data-ig]').forEach(function (b) {
      b.onclick = function () {
        grade(p.id, b.getAttribute('data-ig'));
        var d = day();
        d.n = (d.n || 0) + 1;
        save();
        ROUND.i++;
        if (ROUND.i >= ROUND.items.length) renderDone();
        else renderPrompt();
      };
    });
    var ta = document.getElementById('ians');
    if (ta) ta.readOnly = true;
    var btn = document.getElementById('icheck');
    if (btn) btn.style.display = 'none';
    var ck = document.getElementById('iclock');
    if (ck) ck.textContent = '已停';
    var p2 = document.getElementById('ipanel');
    if (p2 && p2.scrollIntoView) p2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderDone() {
    clearTimer();
    var d = peekDay();
    appEl().innerHTML = top('观点速练', '完成') +
      '<div class="i-done"><div class="i-big">💡</div><h2>这组过完了</h2>' +
      '<p>今天想到 ' + (d ? d.n : 0) + ' 个论点。明天先考今天没想出来的。</p></div>' +
      '<button class="i-btn" id="idone">回到写作</button>';
    document.getElementById('idone').onclick = function () {
      if (window.WRITING && window.WRITING.start) window.WRITING.start();
      else if (window.__ieltsHome) window.__ieltsHome();
    };
    bindBack(function () {
      if (window.WRITING && window.WRITING.start) window.WRITING.start();
    });
  }

  function injectCSS() {
    if (document.getElementById('i-style')) return;
    var css = [
      '.i-top{display:flex;align-items:center;gap:10px;padding:2px 0 12px}',
      '.i-back{background:none;border:0;color:var(--dim);font-size:26px;line-height:1;padding:0 6px 0 0;font-family:inherit}',
      '.i-title{font-size:16px;font-weight:600;flex:1}',
      '.i-count{font-size:12px;color:var(--dim)}',
      '.i-intro{font-size:12px;color:var(--dim);line-height:1.65;margin:2px 0 14px}',
      '.i-stat{font-size:13px;color:var(--dim);margin:6px 0 14px}',
      '.i-stat b{font-size:26px;color:var(--fg);font-weight:700}',
      '.i-stat span{font-size:12px;margin-left:4px}',
      '.i-btn{width:100%;border:0;border-radius:16px;padding:15px 16px;font-size:15.5px;font-weight:600;background:var(--accent);color:#fff;font-family:inherit}',
      '.i-tip{font-size:11px;color:var(--dim);line-height:1.6;margin-top:12px}',
      '.i-card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:16px;margin-bottom:12px}',
      '.i-kicker{font-size:11px;color:var(--dim);letter-spacing:.04em;margin-bottom:10px}',
      '.i-topic{background:var(--card2);border-radius:6px;padding:2px 8px;color:var(--fg)}',
      '.i-en{font-size:15.5px;line-height:1.7;font-weight:600}',
      '.i-zh{font-size:13px;line-height:1.7;color:var(--dim);margin-top:8px}',
      '.i-clock{font-size:13px;color:var(--dim);font-variant-numeric:tabular-nums;margin-top:14px}',
      '.i-clock.over{color:var(--bad)}',
      '.i-ta{width:100%;margin-top:12px;border:1px solid var(--line);border-radius:14px;background:var(--card2);color:var(--fg);padding:12px 13px;font-size:16px;line-height:1.6;font-family:inherit;resize:vertical;outline:none}',
      '.i-ta:focus{border-color:var(--accent)}',
      '.i-card .i-btn{margin-top:12px}',
      '.i-arg{border-top:1px solid var(--line);padding-top:12px;margin-top:12px}',
      '.i-arg:first-of-type{border-top:0;padding-top:2px}',
      '.i-arg-t{font-size:12px;color:var(--accent);font-weight:700;margin-bottom:6px}',
      '.i-arg-c{font-size:14px;line-height:1.65;font-weight:600}',
      '.i-arg-l{font-size:13px;line-height:1.7;margin-top:6px;color:var(--fg)}',
      '.i-arg-l b{color:var(--dim);font-weight:600;font-size:11px;margin-right:8px}',
      '.i-mine{font-size:13.5px;line-height:1.75}',
      '.i-grades{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:4px 0 6px}',
      '.i-grade{border:0;border-radius:14px;padding:15px 8px;font-size:14px;font-weight:600;color:#fff;font-family:inherit}',
      '.i-grade small{display:block;font-weight:400;font-size:10px;opacity:.8;margin-top:3px}',
      '.i-grade.bad{background:var(--bad)} .i-grade.meh{background:var(--meh)} .i-grade.good{background:var(--good)}',
      '.i-done{text-align:center;padding:26px 0 10px}',
      '.i-done .i-big{font-size:54px;line-height:1}',
      '.i-done h2{font-size:21px;margin:10px 0 6px}',
      '.i-done p{font-size:13px;color:var(--dim);line-height:1.7;margin:8px 0}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'i-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  injectCSS();
  load();

  window.IDEAS = {
    start: function () { open(); return false; },
    summaryText: function () {
      load();
      var d = peekDay();
      return (d ? Math.min(d.n || 0, PER_DAY) : 0) + '/' + PER_DAY;
    },
    _state: function () { return { ST: ST, DATA: DATA, ROUND: ROUND }; }
  };
})();
