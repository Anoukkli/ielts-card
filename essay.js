/* 雅思复习 · 成篇套模板
   观点（90 秒）→ 判题型 → 按段落逐段填（3 个句式选 1）→ 整篇骨架
   数据在 essay.json（题型路由 + 段型库），草稿自动存本机。 */
(function () {
  'use strict';

  var KEY = 'ielts.essay.v1';
  var DKEY = 'ielts.essay.draft.v1';
  var STEP_SECONDS = 90;

  var ST = null, DATA = null, IDEAS = null, R = null, T = null;

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
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(ST)); } catch (e) { toast('存不进去：检查存储设置'); }
  }
  function draftRead() {
    try { return JSON.parse(localStorage.getItem(DKEY) || 'null'); } catch (e) { return null; }
  }
  function draftSave() {
    if (!R) return;
    try { localStorage.setItem(DKEY, JSON.stringify({ t: Date.now(), R: R })); } catch (e) {}
  }
  function draftClear() {
    try { localStorage.removeItem(DKEY); } catch (e) {}
  }

  async function ensureData() {
    if (DATA) return true;
    try {
      var a = await fetch('essay.json?t=' + Date.now());
      var b = await fetch('ideas.json?t=' + Date.now());
      if (!a.ok || !b.ok) throw new Error('load');
      DATA = await a.json();
      IDEAS = await b.json();
      return true;
    } catch (e) {
      appEl().innerHTML = '<div class="e-done"><div class="e-big">📭</div><h2>模板或题目没加载上</h2>' +
        '<p>确认 essay.json / ideas.json 和本页在同一目录</p></div>';
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

  function typeById(id) {
    var t = DATA.types.filter(function (x) { return x.id === id; })[0];
    return t || DATA.types[0];
  }
  function segById(id) {
    return DATA.segments.filter(function (s) { return s.id === id; })[0];
  }
  function kindOf(seg) { return DATA.kinds[seg.kind]; }

  function detect(prompt) {
    var s = String(prompt || '').toLowerCase();
    if (/discuss both|both views|both sides/.test(s)) return 'discuss';
    if (/outweigh|advantages?|disadvantages?|benefits?/.test(s)) return 'advdis';
    if (/causes?|solutions?|what can be done|measures?|solve/.test(s)) return 'problem';
    if (/positive or (a )?negative|why (do|are|is)/.test(s)) return 'two';
    return 'opinion';
  }

  function nextPrompt() {
    var done = {};
    ST.logs.forEach(function (l) { done[l.p] = 1; });
    var fresh = IDEAS.prompts.filter(function (p) { return !done[p.id]; });
    if (!fresh.length) fresh = IDEAS.prompts;
    return fresh[0];
  }

  /* ---------------- hub ---------------- */
  async function open() {
    load();
    var ok = await ensureData();
    if (!ok) return;
    renderHub();
  }

  function stepName(n) {
    return { 1: '观点', 2: '判题型', 3: '逐段填', 4: '骨架' }[n] || '观点';
  }

  function renderHub() {
    clearTimer();
    var p = nextPrompt();
    var draft = draftRead();
    if (draft && (!draft.R || draft.R.v !== 2)) { draftClear(); draft = null; }
    var resume = '';
    if (draft && draft.R) {
      var ago = Math.round((Date.now() - (draft.t || 0)) / 60000);
      resume = '<div class="e-card" style="border-color:var(--accent)">' +
        '<div class="e-kicker">未完成的草稿</div>' +
        '<div class="e-en">' + esc(draft.R.p.prompt || '') + '</div>' +
        '<div class="e-zh">停在「' + stepName(draft.R.step || 1) + '」 · ' +
        (ago < 1 ? '刚刚' : ago + ' 分钟前') + ' · 退出去也不丢</div>' +
        '<button class="e-btn" id="eresume">继续上次</button>' +
        '<button class="e-link" id="edrop">扔掉这篇，重新开始</button>' +
        '</div>';
    }
    appEl().innerHTML = top('成篇套模板', 'v19') +
      '<div class="e-intro">先判题型，再按段落填：每段三个句式选一个，只填内容块，不会拼出重复的句子。</div>' +
      '<div class="e-stat"><b>' + ST.logs.length + '</b> 篇已走过</div>' +
      '<button class="e-link" id="erecords" style="margin:0 0 12px;border-color:var(--accent);color:var(--fg)">成篇记录 / 复盘 · ' + ST.logs.length + ' 篇 ›</button>' +
      resume +
      '<div class="e-card">' +
      '<div class="e-kicker">下一篇 · ' + esc(p.topic) + '</div>' +
      '<div class="e-en">' + esc(p.prompt) + '</div>' +
      '<div class="e-zh">' + esc(p.zh) + '</div>' +
      '</div>' +
      '<button class="e-btn" id="estart">' + (resume ? '开始新的一篇' : '开始：观点 → 判题型 → 逐段填') + '</button>';
    bindBack(function () { draftSave(); if (window.WRITING) window.WRITING.start(); });
    document.getElementById('estart').onclick = function () {
      R = { v: 2, p: p, step: 1, claims: '', type: '', sel: {}, vals: {} };
      draftSave();
      renderClaims();
    };
    var rb = document.getElementById('eresume');
    if (rb) rb.onclick = function () { R = draft.R; resumeStep(); };
    document.getElementById('erecords').onclick = renderRecords;
    var db = document.getElementById('edrop');
    if (db) db.onclick = function () {
      if (!confirm('扔掉这篇没写完的草稿？')) return;
      draftClear();
      renderHub();
    };
  }

  function resumeStep() {
    var s = R.step || 1;
    if (s <= 1) return renderClaims();
    if (s === 2) return renderType();
    if (s === 3) return renderSegments();
    return renderSkeleton();
  }

  /* ---------------- 1 观点 ---------------- */
  function renderClaims() {
    clearTimer();
    R.step = 1; draftSave();
    var p = R.p, left = STEP_SECONDS;
    appEl().innerHTML = top(p.topic, '1/4') +
      '<div class="e-card">' +
      '<div class="e-kicker">第 1 步 · 90 秒，先想两个论点</div>' +
      '<div class="e-en">' + esc(p.prompt) + '</div>' +
      '<div class="e-clock" id="eclock">' + fmt(left) + '</div>' +
      '<textarea class="e-ta" id="eclaims" rows="3" placeholder="两个论点，一行一个">' + esc(R.claims) + '</textarea>' +
      '<button class="e-btn" id="enext">下一步：判题型</button>' +
      '<button class="e-link" id="eprev">返回</button>' +
      '</div>';
    bindBack(function () { R.claims = ($('#eclaims').value || '').trim(); draftSave(); renderHub(); });
    $('#eclaims').addEventListener('input', function () { R.claims = this.value; draftSave(); });
    T = setInterval(function () {
      var el = document.getElementById('eclock');
      if (!el) { clearTimer(); return; }
      left--;
      if (left <= 0) { el.textContent = '时间到'; el.classList.add('over'); clearTimer(); return; }
      el.textContent = fmt(left);
      el.classList.toggle('over', left < 30);
    }, 1000);
    document.getElementById('enext').onclick = function () {
      R.claims = ($('#eclaims').value || '').trim();
      if (!R.type) R.type = detect(R.p.prompt);
      R.step = 2; draftSave(); clearTimer();
      renderType();
    };
    document.getElementById('eprev').onclick = function () {
      R.claims = ($('#eclaims').value || '').trim(); draftSave(); renderHub();
    };
  }

  /* ---------------- 2 判题型 ---------------- */
  function renderType() {
    clearTimer();
    R.step = 2; draftSave();
    var p = R.p;
    var detected = detect(p.prompt);
    if (!R.type) R.type = detected;
    var chips = DATA.types.map(function (t) {
      return '<button class="e-chip' + (t.id === R.type ? ' on' : '') + '" data-type="' + t.id + '">' +
        esc(t.name) + (t.id === detected ? ' · 系统判断' : '') + '</button>';
    }).join('');
    var plan = typeById(R.type).plan.map(function (id, i) {
      return '<div class="e-plan"><b>' + (i + 1) + '</b>' + esc(segById(id).name) + '</div>';
    }).join('');
    appEl().innerHTML = top(p.topic, '2/4') +
      '<div class="e-intro">系统从题目关键词判的，你可以改。不同题型段落顺序不一样，这是模板不重复的关键。</div>' +
      '<div class="e-card">' +
      '<div class="e-kicker">这篇属于</div>' +
      '<div class="e-chips">' + chips + '</div>' +
      '<div class="e-kicker" style="margin-top:16px">段落顺序</div>' + plan +
      '<button class="e-btn" id="enext">下一步：逐段填</button>' +
      '<button class="e-link" id="eprev">上一步：观点</button>' +
      '</div>';
    bindBack(function () { draftSave(); renderHub(); });
    $$('[data-type]').forEach(function (b) {
      b.onclick = function () {
        R.type = b.getAttribute('data-type');
        draftSave();
        renderType();
      };
    });
    document.getElementById('enext').onclick = function () { R.step = 3; draftSave(); renderSegments(); };
    document.getElementById('eprev').onclick = function () { draftSave(); renderClaims(); };
  }

  /* ---------------- 3 逐段填 ---------------- */
  function fill(tpl, segId) {
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      var v = R.vals[segId + '.' + k];
      return v && v.trim() ? v.trim() : '___';
    });
  }

  /* 填进去的部分标红；vals 可传已保存的段落数据 */
  function fillHTML(tpl, segId, vals) {
    vals = vals || R.vals;
    return String(tpl).replace(/\{(\w+)\}/g, function (m, k) {
      var v = vals[segId + '.' + k];
      return v && v.trim()
        ? '<span class="e-fill">' + esc(v.trim()) + '</span>'
        : '___';
    });
  }

  function renderSegments() {
    clearTimer();
    R.step = 3; draftSave();
    var plan = typeById(R.type).plan;
    var cards = plan.map(function (id, idx) {
      var seg = segById(id);
      if (!seg) return '';
      var kind = kindOf(seg);
      var sel = R.sel[id] || 0;
      var frames = kind.frames.map(function (f, i) {
        return '<button class="e-opt' + (i === sel ? ' on' : '') + '" data-frame="' + i + '" data-in="' + id + '">' +
          esc(f) + '</button>';
      }).join('');
      var inputs = kind.slots.map(function (s) {
        var key = id + '.' + s;
        return '<div class="e-slot"><label>' + esc(kind.labels[s] || s) + '</label>' +
          '<input class="e-in" data-slot="' + key + '" value="' + esc(R.vals[key] || '') + '"></div>';
      }).join('');
      return '<div class="e-card" data-seg="' + id + '">' +
        '<div class="e-kicker">' + (idx + 1) + '/' + plan.length + ' · ' + esc(seg.name) + '</div>' +
        '<div class="e-opts">' + frames + '</div>' +
        inputs +
        '<div class="e-preview" id="prev-' + id + '">' + fillHTML(kind.frames[sel], id) + '</div>' +
        '</div>';
    }).join('');
    appEl().innerHTML = top(typeById(R.type).name, '3/4') +
      '<div class="e-intro">每段先点一个句式，再填空。空格只填内容，不写整句，所以不会拼重。</div>' +
      cards +
      '<button class="e-btn" id="enext">生成整篇骨架</button>' +
      '<button class="e-link" id="eprev">上一步：题型</button>';
    bindBack(function () { draftSave(); renderHub(); });

    $$('[data-frame]').forEach(function (b) {
      b.onclick = function () {
        var segId = b.getAttribute('data-in');
        R.sel[segId] = +b.getAttribute('data-frame');
        $$('[data-in="' + segId + '"]').forEach(function (x) { x.classList.toggle('on', x === b); });
        updatePreview(segId);
        draftSave();
      };
    });
    $$('[data-slot]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        R.vals[inp.getAttribute('data-slot')] = inp.value;
        updatePreview(inp.getAttribute('data-slot').split('.')[0]);
        draftSave();
      });
    });
    document.getElementById('enext').onclick = function () {
      R.step = 4; draftSave(); renderSkeleton();
    };
    document.getElementById('eprev').onclick = function () { draftSave(); renderType(); };
  }

  function updatePreview(segId) {
    var seg = segById(segId);
    if (!seg) return;
    var kind = kindOf(seg);
    var idx = R.sel[segId] || 0;
    var box = document.getElementById('prev-' + segId);
    if (box) box.innerHTML = fillHTML(kind.frames[idx], segId);
  }

  /* ---------------- 4 骨架 ---------------- */
  function renderSkeleton() {
    clearTimer();
    R.step = 4; draftSave();
    var plan = typeById(R.type).plan;
    var paras = plan.map(function (id) {
      var seg = segById(id);
      var kind = kindOf(seg);
      var idx = R.sel[id] || 0;
      var vals = {};
      kind.slots.forEach(function (s) { vals[id + '.' + s] = R.vals[id + '.' + s] || ''; });
      return { id: id, name: seg.name, frame: kind.frames[idx], vals: vals, text: fill(kind.frames[idx], id) };
    });
    var body = paras.map(function (p) {
      return '<div class="e-card"><div class="e-kicker">' + esc(p.name) + '</div>' +
        '<div class="e-ref">' + fillHTML(p.frame, p.id, p.vals) + '</div></div>';
    }).join('');
    appEl().innerHTML = top('整篇骨架', '4/4') +
      '<div class="e-intro">' + esc(typeById(R.type).name) + ' · 共 ' + paras.length + ' 段。' +
      '<span style="color:var(--bad)">红色</span>是你填进去的内容。先读一遍，再保存。</div>' +
      body +
      '<div class="e-card"><div class="e-kicker">自检</div>' +
      '<label class="e-check"><input type="checkbox">每一段都回答了题目的要求</label>' +
      '<label class="e-check"><input type="checkbox">开头和结论没有用同一句话</label>' +
      '<label class="e-check"><input type="checkbox">每个理由段都有 because 和例子</label>' +
      '</div>' +
      '<button class="e-btn" id="efinish">保存这篇</button>' +
      '<button class="e-link" id="eprev">上一步：改某一段</button>';
    bindBack(function () { draftSave(); renderHub(); });
    document.getElementById('eprev').onclick = function () { draftSave(); renderSegments(); };
    document.getElementById('efinish').onclick = function () {
      ST.logs.push({
        v: 2, d: today(), t: Date.now(), p: R.p.id, type: R.type,
        topic: R.p.topic, prompt: R.p.prompt,
        claims: R.claims, paras: paras, edits: {}
      });
      save();
      draftClear();
      R = null;
      toast('存好了');
      renderHub();
    };
  }

  /* ---------------- 记录与复盘 ---------------- */
  function typeName(id) {
    var t = DATA.types.filter(function (x) { return x.id === id; })[0];
    return t ? t.name : '';
  }

  /* 老记录没有 prompt 字段，用题目 id 反查 */
  function promptOf(l) {
    if (l.prompt) return l.prompt;
    var hit = IDEAS && IDEAS.prompts.filter(function (x) { return x.id === l.p; })[0];
    return hit ? hit.prompt : (l.topic || '');
  }

  function renderRecords() {
    clearTimer();
    var logs = ST.logs.slice().reverse();
    var rows = logs.length ? logs.map(function (l) {
      var idx = ST.logs.indexOf(l);
      var paras = Array.isArray(l.paras) ? l.paras : String(l.paras || '').split('\n\n');
      var edited = l.edits ? Object.keys(l.edits).length : 0;
      return '<button class="e-card e-rec" data-rec="' + idx + '">' +
        '<div class="e-kicker">' + esc(l.d || '') + ' · ' + esc(typeName(l.type)) + '</div>' +
        '<div class="e-en">' + esc(promptOf(l)) + '</div>' +
        '<div class="e-zh">' + paras.length + ' 段' + (edited ? ' · 已改 ' + edited + ' 段' : '') + '</div>' +
        '</button>';
    }).join('') : '<div class="e-done"><div class="e-big">📄</div><p>还没有保存的成篇。先走一遍四步。</p></div>';
    appEl().innerHTML = top('成篇记录', ST.logs.length + ' 篇') +
      '<div class="e-intro">点进去可以逐段复盘：左边是骨架原文（红色是你填的），右边可以改写再存。</div>' +
      rows;
    bindBack(renderHub);
    $$('[data-rec]').forEach(function (b) {
      b.onclick = function () { renderRecord(+b.getAttribute('data-rec')); };
    });
  }

  function renderRecord(idx) {
    clearTimer();
    var log = ST.logs[idx];
    if (!log) return renderRecords();
    var paras = Array.isArray(log.paras)
      ? log.paras
      : String(log.paras || '').split('\n\n').map(function (t, i) {
          return { name: '第 ' + (i + 1) + ' 段', text: t };
        });
    var edits = log.edits || {};
    var blocks = paras.map(function (p, i) {
      var edited = edits[i];
      var main = edited
        ? esc(edited)
        : (p.frame && p.vals ? fillHTML(p.frame, p.id, p.vals) : esc(p.text || ''));
      return '<div class="e-card">' +
        '<div class="e-kicker">' + (i + 1) + ' · ' + esc(p.name || '') +
        (edited ? ' <span class="e-tag">已改写</span>' : '') + '</div>' +
        '<div class="e-para">' +
        '<div class="e-ref">' + main + '</div>' +
        '<div class="e-edit"><label>改这一段</label>' +
        '<textarea class="e-ta sm" data-edit="' + i + '" rows="4">' + esc(edited || p.text || '') + '</textarea>' +
        '<button class="e-link" data-save="' + i + '">保存修改</button>' +
        '</div></div></div>';
    }).join('');
    appEl().innerHTML = top('成篇复盘', log.d || '') +
      '<div class="e-intro">' + esc(typeName(log.type)) + ' · ' + esc(promptOf(log)) + '</div>' +
      blocks;
    bindBack(renderRecords);
    $$('[data-save]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-save');
        var ta = $('[data-edit="' + i + '"]');
        log.edits = log.edits || {};
        log.edits[i] = (ta.value || '').trim();
        save();
        toast('已保存第 ' + (i + 1) + ' 段');
        renderRecord(idx);
      };
    });
  }

  /* ---------------- css ---------------- */
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
      '.e-in{width:100%;margin-top:5px;border:1px solid var(--line);border-radius:12px;background:var(--card2);color:var(--fg);padding:10px 12px;font-size:15px;font-family:inherit;outline:none}',
      '.e-btn{width:100%;border:0;border-radius:16px;padding:15px 16px;font-size:15.5px;font-weight:600;background:var(--accent);color:#fff;font-family:inherit;margin-top:12px}',
      '.e-link{width:100%;margin-top:10px;background:none;border:1px solid var(--line);border-radius:12px;padding:11px;color:var(--dim);font-size:12px;font-family:inherit}',
      '.e-chips{display:flex;flex-wrap:wrap;gap:8px}',
      '.e-chip{border:1px solid var(--line);background:var(--card2);color:var(--fg);border-radius:999px;padding:8px 12px;font-size:12px;font-family:inherit}',
      '.e-chip.on{background:var(--accent);color:#fff;border-color:transparent}',
      '.e-plan{font-size:13px;line-height:1.6;color:var(--fg);margin-top:8px;display:flex;gap:10px}',
      '.e-plan b{color:var(--accent)}',
      '.e-opts{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}',
      '.e-opt{text-align:left;font-family:inherit;font-size:11.5px;line-height:1.55;color:var(--dim);background:var(--card2);border:1px solid transparent;border-radius:10px;padding:8px 10px}',
      '.e-opt.on{color:var(--fg);border-color:var(--accent);background:var(--card)}',
      '.e-slot{margin-top:10px}',
      '.e-slot label{font-size:11px;color:var(--dim);display:block;margin-bottom:4px}',
      '.e-preview{margin-top:12px;padding:11px 13px;border-left:3px solid var(--accent);background:var(--card2);border-radius:0 10px 10px 0;font-size:13px;line-height:1.7;color:var(--fg)}',
      '.e-fill{color:var(--bad);font-weight:600}',
      '.e-para{display:grid;grid-template-columns:1fr;gap:12px}',
      '@media(min-width:720px){.e-para{grid-template-columns:1.15fr 1fr;align-items:start}}',
      '.e-edit label{display:block;font-size:11px;color:var(--dim);margin-bottom:4px}',
      '.e-ta.sm{margin-top:0;font-size:14px;min-height:84px}',
      '.e-tag{font-size:10px;color:var(--good);border:1px solid var(--line);border-radius:6px;padding:1px 6px;margin-left:6px}',
      '.e-rec{width:100%;text-align:left;font-family:inherit;color:var(--fg);display:block}',
      '.e-ref{font-size:13.5px;line-height:1.75;white-space:pre-wrap}',
      '.e-check{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.6;margin-top:10px}',
      '.e-check input{margin-top:2px;width:18px;height:18px;accent-color:var(--accent)}',
      '.e-done{text-align:center;padding:20px 0 6px}',
      '.e-done .e-big{font-size:52px;line-height:1}',
      '.e-done h2{font-size:21px;margin:10px 0 6px}',
      '.e-done p{font-size:13px;color:var(--dim)}'
    ].join('\n');
    var st = document.createElement('style');
    st.id = 'e-style';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  injectCSS();
  load();
  document.addEventListener('visibilitychange', function () { if (document.hidden) draftSave(); });
  window.addEventListener('beforeunload', function () { draftSave(); });

  window.ESSAY = {
    start: function () { open(); return false; },
    summaryText: function () {
      load();
      var d = draftRead();
      if (d && d.R && d.R.v === 2) return '有草稿 · 第 ' + (d.R.step || 1) + ' 步';
      return ST.logs.length ? ST.logs.length + ' 篇' : '观点→题型→逐段';
    },
    _state: function () { return { ST: ST, DATA: DATA, R: R }; },
    review: function () { open().then(function () { renderRecords(); }); },
    _detect: detect
  };
})();
