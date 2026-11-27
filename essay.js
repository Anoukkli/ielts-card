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
      ensureCloze();   // 填空素材后台预取，不挡首页渲染（内部已捕获失败）
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
    if (draft && draft.R && draft.R.v !== 4) {
      // 旧草稿：题目和题型留着，写作页换成「上面参考、下面自己写」，旧填的空没法迁移
      draft.R = { v: 4, p: draft.R.p, step: 3, claims: draft.R.claims || '', type: draft.R.type || '', w: {} };
    }
    if (draft && (!draft.R || draft.R.v !== 4)) { draftClear(); draft = null; }
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
    appEl().innerHTML = top('成篇套模板', '参考版') +
      '<div class="e-intro">每段上面给写法参考：这一段写几句、每句干什么、可以套哪些短句式、一句例句。' +
      '下面一个框，你用整段英文自己写。写不出就往上翻，不要求照抄。</div>' +
      '<div class="e-stat"><b>' + ST.logs.length + '</b> 篇已走过</div>' +
      '<button class="e-link" id="erecords" style="margin:0 0 12px;border-color:var(--accent);color:var(--fg)">成篇记录 / 复盘 · ' + ST.logs.length + ' 篇 ›</button>' +
      '<button class="e-link" id="eclozelist" style="margin:0 0 12px;border-color:var(--cl-frame);color:var(--cl-frame)">二次填空 · 把成篇改成高分版 ›</button>' +
      resume +
      '<div class="e-card">' +
      '<div class="e-kicker">下一篇 · ' + esc(p.topic) + '</div>' +
      '<div class="e-en">' + esc(p.prompt) + '</div>' +
      '<div class="e-zh">' + esc(p.zh) + '</div>' +
      '</div>' +
      '<button class="e-btn" id="estart">' + (resume ? '开始新的一篇' : '开始：观点 → 判题型 → 逐段填') + '</button>';
    bindBack(function () { draftSave(); if (window.WRITING) window.WRITING.start(); });
    document.getElementById('estart').onclick = function () {
      R = { v: 4, p: p, step: 1, claims: '', type: '', w: {} };
      draftSave();
      renderClaims();
    };
    var rb = document.getElementById('eresume');
    if (rb) rb.onclick = function () { R = draft.R; resumeStep(); };
    document.getElementById('erecords').onclick = renderRecords;
    document.getElementById('eclozelist').onclick = renderClozeList;
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

  /* ---------------- 3 逐段写：上面参考，下面自己写 ---------------- */
  function libLayer(id) { return ((DATA && DATA.lib) || {})[id]; }

  function layersOf(segId) {
    var seg = segById(segId);
    if (!seg) return [];
    var k = DATA.kinds[seg.kind] || {};
    return (k.layers || []).map(libLayer).filter(Boolean);
  }

  function refHTML(segId) {
    var seg = segById(segId);
    var kind = DATA.kinds[seg.kind] || {};
    var rows = layersOf(segId).map(function (L, i) {
      var stks = (L.stacks || []).map(function (s) {
        return '<code>' + esc(String(s.t).replace(/\{(\w+)\}/g, '___')) + '</code>';
      }).join('');
      return '<div class="e-rl">' +
        '<div class="e-rl-h"><b>' + (i + 1) + '</b>' +
        '<span class="e-rl-zh">' + esc(L.zh) + '</span>' +
        '<span class="e-rl-q">' + esc(L.q) + '</span></div>' +
        '<div class="e-rl-ask">' + esc(L.ask) + '</div>' +
        '<div class="e-rl-stk">' + stks + '</div>' +
        (L.eg ? '<div class="e-rl-eg">例　' + esc(L.eg) + '</div>' : '') +
        (L.noidea ? '<details class="e-idea"><summary>没话讲？三条路</summary><ul>' +
          L.noidea.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') +
        '</div>';
    }).join('');
    return '<div class="e-refbox">' +
      '<div class="e-refhead">' + esc(kind.hint || '') + '</div>' + rows +
      (kind.model ? '<details class="e-model"><summary>看一段完整示范（另一道题，别照抄）</summary>' +
        '<p>' + esc(kind.model) + '</p></details>' : '') +
      '</div>';
  }

  /* 只做粗检：是不是只有一句结论、有没有因果、有没有画面 */
  function checkText(t) {
    t = String(t || '');
    var words = (t.match(/[A-Za-z'][A-Za-z'-]*/g) || []).length;
    var sents = (t.match(/[.!?]+/g) || []).length;
    var hasCause = /\b(because|since|so|which in turn|as a result|therefore|thus|that is why|once|leads? to|means that)\b/i.test(t);
    var hasPic = /\d/.test(t) || /\b(a|an|one|two|three)\s+[a-z-]+\s+(boy|girl|student|man|woman|family|mother|father|teacher|worker|shop|school|city|couple|child|driver|nurse)\b/i.test(t);
    var out = [];
    if (words >= 20 && sents <= 1) out.push('只有一句，还是结论');
    if (words >= 20 && !hasCause) out.push('没写「为什么」');
    if (words >= 20 && !hasPic) out.push('没给具体的人或数字');
    return { words: words, out: out };
  }

  function paintCheck(segId) {
    var box = document.getElementById('ck-' + segId);
    var ta = document.querySelector('[data-w="' + segId + '"]');
    if (!box || !ta) return;
    var r = checkText(ta.value);
    var st = document.getElementById('st-' + segId);
    if (st) st.textContent = r.words ? r.words + ' 词' : '';
    if (!r.words) { box.innerHTML = ''; return; }
    if (r.words < 20) { box.innerHTML = '<i class="e-miss">太短，至少写完整两三句</i>'; return; }
    box.innerHTML = r.out.length
      ? r.out.map(function (x) { return '<i class="e-miss">' + esc(x) + '</i>'; }).join('')
      : '<i class="e-ok">四层都在，读一遍，挑一处改得更具体</i>';
  }

  function renderSegments() {
    clearTimer();
    R.step = 3; R.w = R.w || {}; draftSave();
    var plan = typeById(R.type).plan;
    var cards = plan.map(function (id, idx) {
      var seg = segById(id);
      return '<div class="e-card e-seg" id="seg-' + id + '">' +
        '<div class="e-segh">' +
        '<b class="e-segn">' + (idx + 1) + '</b>' +
        '<span class="e-segname">' + esc(seg.name) + '</span>' +
        '<span class="e-segst" id="st-' + id + '"></span>' +
        '<button class="e-reftog on" data-ref="' + id + '">参考</button>' +
        '</div>' +
        '<div class="e-reffold" id="rf-' + id + '">' + refHTML(id) + '</div>' +
        '<div class="e-segb">' +
        '<textarea class="e-ta" data-w="' + id + '" rows="7" placeholder="照着上面的四层，用你自己的内容写整段。写不出就往上翻例句。">' +
        esc(R.w[id] || '') + '</textarea>' +
        '<div class="e-chk" id="ck-' + id + '"></div>' +
        '</div></div>';
    }).join('');
    var doneN = plan.filter(function (id) { return String((R.w || {})[id] || '').trim(); }).length;
    appEl().innerHTML = top(typeById(R.type).name, doneN + '/' + plan.length + ' 段') +
      '<div class="e-intro">上面是这一段的写法参考（四层 + 例句），点「参考」可以收起。' +
      '下面那个框写整段，不用照着句子抄，写你自己的内容。</div>' +
      cards +
      '<button class="e-btn" id="enext">看整篇</button>' +
      '<button class="e-link" id="eprev">上一步：题型</button>';
    bindBack(function () { draftSave(); renderHub(); });

    $$('[data-ref]').forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute('data-ref');
        var box = document.getElementById('rf-' + id);
        if (!box) return;
        var show = box.style.display === 'none';
        box.style.display = show ? 'block' : 'none';
        b.classList.toggle('on', show);
      };
    });
    $$('[data-w]').forEach(function (ta) {
      ta.addEventListener('input', function () {
        var id = ta.getAttribute('data-w');
        R.w = R.w || {};
        R.w[id] = ta.value;
        paintCheck(id);
        paintDone(plan);
        draftSave();
      });
    });
    plan.forEach(paintCheck);
    document.getElementById('enext').onclick = function () { R.step = 4; draftSave(); renderSkeleton(); };
    document.getElementById('eprev').onclick = function () { draftSave(); renderType(); };
  }

  function paintDone(plan) {
    var n = plan.filter(function (id) { return String((R.w || {})[id] || '').trim(); }).length;
    var el = document.querySelector('.e-count');
    if (el) el.textContent = n + '/' + plan.length + ' 段';
  }

  /* ---------------- 4 整篇 ---------------- */
  function renderSkeleton() {
    clearTimer();
    R.step = 4; draftSave();
    var plan = typeById(R.type).plan;
    var paras = plan.map(function (id) {
      var seg = segById(id);
      var t = String((R.w || {})[id] || '').trim();
      return { id: id, name: seg.name, text: t, chk: checkText(t) };
    });
    var body = paras.map(function (p, i) {
      return '<div class="e-card"><div class="e-kicker">' + (i + 1) + ' · ' + esc(p.name) +
        (p.text ? ' · ' + p.chk.words + ' 词' : '') + '</div>' +
        '<div class="e-ref">' + (p.text ? esc(p.text) : '<span class="e-dimtext">这段还是空的</span>') + '</div></div>';
    }).join('');
    var warn = [];
    paras.forEach(function (p) {
      if (!p.text) { warn.push(p.name + '：还是空的'); return; }
      if (p.chk.words < 35) warn.push(p.name + '：偏短（' + p.chk.words + ' 词），理由段一般 50–80 词');
      if (p.chk.out.length) warn.push(p.name + '：' + p.chk.out.join('、'));
    });
    var warnBox = warn.length
      ? '<div class="e-card" style="border-color:var(--bad)"><div class="e-kicker" style="color:var(--bad)">还差这些</div>' +
        warn.map(function (w) { return '<div class="e-plan"><b>·</b>' + esc(w) + '</div>'; }).join('') +
        '<button class="e-link" id="ebackedit">回去补</button></div>'
      : '<div class="e-card" style="border-color:var(--good)"><div class="e-kicker" style="color:var(--good)">每段都有结论、因果和画面</div>' +
        '<div class="e-zh">计时抄一遍，看看多少分钟。</div></div>';
    var total = paras.reduce(function (a, p) { return a + p.chk.words; }, 0);
    appEl().innerHTML = top('整篇 · ' + total + ' 词', '4/4') +
      stepper(2) +
      '<div class="e-intro">' + esc(typeById(R.type).name) + ' · ' + paras.length + ' 段。先读一遍，再保存。</div>' +
      warnBox + body +
      '<button class="e-btn" id="efinish">保存这篇</button>' +
      '<button class="e-link" id="ecopyall">复制整篇</button>' +
      '<button class="e-link" id="eprev">上一步：改某一段</button>';
    bindBack(function () { draftSave(); renderHub(); });
    document.getElementById('eprev').onclick = function () { draftSave(); renderSegments(); };
    var be = document.getElementById('ebackedit');
    if (be) be.onclick = function () { draftSave(); renderSegments(); };
    document.getElementById('ecopyall').onclick = function () {
      var t = paras.map(function (p) { return p.text; }).filter(Boolean).join('\n\n');
      if (!t) { toast('还没写内容'); return; }
      copyText(t);
    };
    document.getElementById('efinish').onclick = function () {
      ST.logs.push({
        v: 4, d: today(), t: Date.now(), p: R.p.id, type: R.type,
        topic: R.p.topic, prompt: R.p.prompt, claims: R.claims,
        paras: paras.map(function (p) { return { id: p.id, name: p.name, text: p.text }; }),
        edits: {}
      });
      save();
      draftClear();
      R = null;
      toast('存好了');
      renderHub();
    };
  }

  function copyText(t) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(t).then(function () { toast('复制好了'); }, function () { toast('复制失败，长按选中吧'); });
        return;
      }
    } catch (e) {}
    var ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('复制好了'); } catch (e) { toast('复制失败，长按选中吧'); }
    document.body.removeChild(ta);
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
      stepper(5) +
      '<div class="e-intro">点进去可以逐段复盘：左边是骨架原文（红色是你填的），右边可以改写再存。</div>' +
      '<button class="e-link" id="ecloze2" style="margin:0 0 12px;border-color:var(--cl-frame);color:var(--cl-frame)">二次填空 · 参照高分版重写这一段 ›</button>' +
      rows;
    bindBack(renderHub);
    document.getElementById('ecloze2').onclick = renderClozeList;
    $$('[data-rec]').forEach(function (b) {
      b.onclick = function () { renderRecord(+b.getAttribute('data-rec')); };
    });
  }

  /* 段落纯文本 + 红色（用户填的）区间 */
  function plainOf(p, edited) {
    if (edited) return { text: edited, reds: [] };
    if (p.blocks && p.blocks.length) return plainBlocks(p);
    if (!p.frame || !p.vals) return { text: p.text || '', reds: [] };
    var out = '', reds = [], last = 0, m, v;
    var re = /\{(\w+)\}/g;
    while ((m = re.exec(p.frame))) {
      out += p.frame.slice(last, m.index);
      v = p.vals[p.id + '.' + m[1]];
      v = v && String(v).trim() ? String(v).trim() : '___';
      if (v !== '___') reds.push([out.length, out.length + v.length]);
      out += v;
      last = re.lastIndex;
    }
    out += p.frame.slice(last);
    return { text: out, reds: reds };
  }

  /* v3 记录：按 blocks（层 + 句式 + 内容）重建成带标红的段落文本 */
  function plainBlocks(p) {
    var out = '', reds = [];
    (p.blocks || []).forEach(function (b) {
      var L = libLayer(b.lid);
      if (!L) return;
      var stack = (L.stacks || [])[b.s] || (L.stacks || [])[0];
      if (!stack) return;
      var tpl = String(stack.t), last = 0, m, re = /\{(\w+)\}/g;
      if (out) out += ' ';
      while ((m = re.exec(tpl))) {
        out += tpl.slice(last, m.index);
        var val = String((b.v || {})[m[1]] || '').trim() || '___';
        if (val !== '___') reds.push([out.length, out.length + val.length]);
        out += val;
        last = re.lastIndex;
      }
      out += tpl.slice(last);
    });
    if (p.free) {
      if (out) out += ' ';
      var st = out.length;
      out += p.free;
      reds.push([st, out.length]);
    }
    return { text: out.replace(/^([^A-Za-z]*)([a-z])/, function (m, a, b) { return a + b.toUpperCase(); }), reds: reds };
  }

  function renderRich(text, reds, marks) {
    var n = text.length, i;
    var cls = new Array(n);
    for (i = 0; i < n; i++) cls[i] = '';
    (reds || []).forEach(function (r) {
      for (var k = Math.max(0, r[0]); k < Math.min(n, r[1]); k++) cls[k] += ' e-fill';
    });
    (marks || []).forEach(function (m) {
      var c = m.type === 'ul' ? ' e-ul' : ' e-hl';
      for (var k = Math.max(0, m.start); k < Math.min(n, m.end); k++) cls[k] += c;
    });
    var out = '', buf = '', cur = null;
    for (i = 0; i < n; i++) {
      if (cls[i] !== cur) {
        if (buf) out += cur ? '<span class="' + cur.trim() + '">' + esc(buf) + '</span>' : esc(buf);
        cur = cls[i]; buf = text[i];
      } else buf += text[i];
    }
    if (buf) out += cur ? '<span class="' + cur.trim() + '">' + esc(buf) + '</span>' : esc(buf);
    return out;
  }

  function normMarks(list) {
    list = (list || []).slice().sort(function (a, b) { return a.start - b.start || b.end - a.end; });
    var out = [];
    list.forEach(function (m) {
      if (m.end <= m.start) return;
      var last = out[out.length - 1];
      if (last && m.start < last.end) return;
      out.push(m);
    });
    return out;
  }

  var LAST_SEL = null;
  function trackSelection() {
    try {
      var sel = window.getSelection && window.getSelection();
      if (!sel || !sel.rangeCount) return;
      var r = sel.getRangeAt(0);
      if (!r || r.collapsed) return;
      var node = r.startContainer;
      var el = node.nodeType === 1 ? node : node.parentElement;
      var host = el && el.closest ? el.closest('.e-ref') : null;
      if (!host) return;
      var pre = document.createRange();
      pre.selectNodeContents(host);
      pre.setEnd(r.startContainer, r.startOffset);
      var start = pre.toString().length;
      pre.selectNodeContents(host);
      pre.setEnd(r.endContainer, r.endOffset);
      var end = pre.toString().length;
      if (end > start) LAST_SEL = { idx: +host.getAttribute('data-ref'), start: start, end: end };
    } catch (e) { /* 选区跨节点时忽略 */ }
  }
  document.addEventListener('selectionchange', trackSelection);
  document.addEventListener('mouseup', trackSelection);
  document.addEventListener('touchend', trackSelection);

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
    var marksAll = log.marks || {};
    var notes = log.notes || {};
    var blocks = paras.map(function (p, i) {
      var edited = edits[i];
      var plain = plainOf(p, edited);
      return '<div class="e-card">' +
        '<div class="e-kicker">' + (i + 1) + ' · ' + esc(p.name || '') +
        (edited ? ' <span class="e-tag">已改写</span>' : '') + '</div>' +
        '<div class="e-para">' +
        '<div class="e-ref" data-ref="' + i + '">' + renderRich(plain.text, plain.reds, marksAll[i]) + '</div>' +
        '<div class="e-edit"><label>改这一段</label>' +
        '<textarea class="e-ta sm" data-edit="' + i + '" rows="4">' + esc(edited || plain.text) + '</textarea>' +
        '<button class="e-link" data-save="' + i + '">保存修改</button>' +
        '</div></div>' +
        '<div class="e-tools"><span>选中上面的文字，再点：</span>' +
        '<button class="e-tool" data-hl="' + i + '">高亮</button>' +
        '<button class="e-tool" data-ul="' + i + '">划线</button>' +
        '<button class="e-tool" data-clr="' + i + '">清除</button></div>' +
        '<div class="e-note"><label>思路笔记（这段为什么这么写 / 下一步改什么）</label>' +
        '<textarea class="e-ta sm" data-note="' + i + '" rows="2" placeholder="例：立场句太抽象，改成具体政策名。">' + esc(notes[i] || '') + '</textarea>' +
        '</div></div>';
    }).join('');
    appEl().innerHTML = top('成篇复盘', log.d || '') +
      '<div class="e-intro">' + esc(typeName(log.type)) + ' · ' + esc(promptOf(log)) +
      '<br>红色是你当时填的；黄色高亮和划线可以自己标，下面写这段的思路笔记。</div>' +
      '<button class="e-link" id="efullview" style="margin:0 0 12px;border-color:var(--accent);color:var(--fg)">看整篇（保留高亮和改写） ›</button>' +
      '<button class="e-link" id="ecloze3" style="margin:0 0 12px;border-color:var(--cl-frame);color:var(--cl-frame)">二次填空 · 把这篇改成高分版 ›</button>' +
      blocks;
    bindBack(renderRecords);
    document.getElementById('efullview').onclick = function () { renderFull(idx); };
    document.getElementById('ecloze3').onclick = renderClozeList;

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

    function addMark(i, type) {
      if (!LAST_SEL || LAST_SEL.idx !== i) { toast('先在左边选中一段文字'); return; }
      log.marks = log.marks || {};
      var list = (log.marks[i] || []).filter(function (m) {
        return m.end <= LAST_SEL.start || m.start >= LAST_SEL.end;
      });
      list.push({ start: LAST_SEL.start, end: LAST_SEL.end, type: type });
      log.marks[i] = normMarks(list);
      save();
      renderRecord(idx);
    }

    $$('[data-hl]').forEach(function (b) {
      b.onclick = function () { addMark(+b.getAttribute('data-hl'), 'hl'); };
    });
    $$('[data-ul]').forEach(function (b) {
      b.onclick = function () { addMark(+b.getAttribute('data-ul'), 'ul'); };
    });
    $$('[data-clr]').forEach(function (b) {
      b.onclick = function () {
        var i = +b.getAttribute('data-clr');
        log.marks = log.marks || {};
        log.marks[i] = [];
        save();
        renderRecord(idx);
      };
    });
    var noteTimer = null;
    $$('[data-note]').forEach(function (ta) {
      ta.addEventListener('input', function () {
        var i = +ta.getAttribute('data-note');
        log.notes = log.notes || {};
        log.notes[i] = ta.value;
        clearTimeout(noteTimer);
        noteTimer = setTimeout(save, 400);
      });
    });
  }

  /* 整篇视图：改写 + 标记连起来看 */
  function renderFull(idx) {
    clearTimer();
    var log = ST.logs[idx];
    if (!log) return renderRecords();
    var paras = Array.isArray(log.paras)
      ? log.paras
      : String(log.paras || '').split('\n\n').map(function (t, i) {
          return { name: '第 ' + (i + 1) + ' 段', text: t };
        });
    var edits = log.edits || {};
    var marksAll = log.marks || {};
    var html = paras.map(function (p, i) {
      var plain = plainOf(p, edits[i]);
      return '<div class="e-full-para">' + renderRich(plain.text, plain.reds, marksAll[i]) + '</div>';
    }).join('');
    appEl().innerHTML = top('整篇 · 复盘版', log.d || '') +
      '<div class="e-intro">' + esc(typeName(log.type)) + ' · ' + esc(promptOf(log)) +
      '<br>按段落连起来，红色是当时填的，黄色是你标的高亮/划线。</div>' +
      '<div class="e-card e-full">' + html + '</div>' +
      '<button class="e-link" id="ebackreview">回到逐段复盘</button>';
    bindBack(function () { renderRecord(idx); });
    document.getElementById('ebackreview').onclick = function () { renderRecord(idx); };
  }

  /* ============ 二次填空：复盘里把成篇改成高分版 ============
     橙红色 = 句式（题给），黑色 = 你填的内容。
     流程：精批 → 骨架 → 填空 → 对照 → 存档（三天后盲测） */
  var CKEY = 'ielts.essay.cloze.v1';
  var CCN = 'ielts.essay.cloze.cn';
  var CLOZE = null, CST = null;

  async function ensureCloze() {
    if (CLOZE) return true;
    try {
      var r = await fetch('cloze.json?t=' + Date.now());
      if (!r.ok) throw new Error('load');
      CLOZE = await r.json();
      if (!CLOZE.items) CLOZE.items = [];
      if (!CLOZE.flow) CLOZE.flow = [];
      return true;
    } catch (e) { return false; }
  }

  function cLoad() {
    if (CST) return CST;
    try { CST = JSON.parse(localStorage.getItem(CKEY) || '{}') || {}; } catch (e) { CST = {}; }
    return CST;
  }
  function cSave() {
    try { localStorage.setItem(CKEY, JSON.stringify(CST || {})); } catch (e) { toast('存不进去：检查存储设置'); }
  }
  function cRec(id) {
    cLoad();
    if (!CST[id]) CST[id] = { v: {}, t: 0, done: 0 };
    if (!CST[id].v) CST[id].v = {};
    return CST[id];
  }
  function blanksOf(it) {
    var out = [];
    (it.paras || []).forEach(function (p) {
      (p.segs || []).forEach(function (s) { if (s.t === 'b') out.push(s); });
    });
    return out;
  }
  function blankMap(it) {
    var m = {};
    blanksOf(it).forEach(function (b) { m[b.k] = b; });
    return m;
  }
  /* 整段中文译文：空位和英文共用同一个 k，所以能一一对上、能互相跳转 */
  function cnOn() {
    try { return localStorage.getItem(CCN) !== '0'; } catch (e) { return true; }
  }
  function cnSet(on) { try { localStorage.setItem(CCN, on ? '1' : '0'); } catch (e) { } }
  function cnBlock(p, live) {
    if (!p || !p.cn || !p.cn.length) return '';
    var inner = p.cn.map(function (s) {
      if (s.t === 'b') return '<span class="cl-cnb"' + (live ? ' data-to="' + esc(s.k) + '"' : '') + '></span>';
      return esc(s.v);
    }).join('');
    return '<div class="cl-cn"><span class="cl-cnlab">中文</span>' + inner + '</div>';
  }
  function itemById(id) {
    return ((CLOZE && CLOZE.items) || []).filter(function (x) { return x.id === id; })[0];
  }
  function norm2(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5 ]+/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function stepper(at) {
    var flow = (CLOZE && CLOZE.flow) || [];
    if (!flow.length) return '';
    return '<div class="cl-step">' + flow.map(function (f, i) {
      return '<span class="cl-s' + (i + 1 <= at ? ' on' : '') + '"><b>' + (i + 1) + '</b>' + esc(f.n) + '</span>';
    }).join('<i>›</i>') + '</div>';
  }

  async function renderClozeList() {
    clearTimer();
    var ok = await ensureCloze();
    if (!ok || !(CLOZE.items || []).length) {
      appEl().innerHTML = top('二次填空', '') +
        '<div class="e-done"><div class="e-big">🧩</div><h2>填空素材没加载上</h2>' +
        '<p>确认 cloze.json 和本页放在同一目录，然后刷新</p>' +
        '<button class="e-btn" id="ecagain" style="margin-top:18px">重试</button></div>';
      bindBack(renderRecords);
      var g = document.getElementById('ecagain');
      if (g) g.onclick = renderClozeList;
      return;
    }
    await ensureUp();          // 升级素材拿不到也不影响填空
    var rows = CLOZE.items.map(function (it) {
      var rec = cRec(it.id), bs = blanksOf(it);
      var n = bs.filter(function (b) { return String(rec.v[b.k] || '').trim(); }).length;
      var tag = rec.done ? '已对照过 · 可以再来一遍' : (n ? '填了 ' + n + '/' + bs.length : '还没开始');
      return '<button class="e-card e-rec" data-cl="' + esc(it.id) + '">' +
        '<div class="e-kicker">' + esc(it.tag || '') + ' · ' + bs.length + ' 空</div>' +
        '<div class="e-en">' + esc(it.prompt || '') + '</div>' +
        '<div class="e-zh">' + esc(it.why || '') + '</div>' +
        '<div class="e-zh cl-go">' + esc(tag) + ' ›</div>' +
        '</button>';
    }).join('');
    var upN = uAll().length;
    var upRow = '<button class="e-card e-rec" id="upentry">' +
      '<div class="e-kicker">第三个视图 · ' + ((UP && UP.sets) || []).length + ' 个主题 · ' + upN + ' 题</div>' +
      '<div class="e-en">词组升级</div>' +
      '<div class="e-zh">一句平淡原句 + 三个必用词组，把它重写成一句好句</div>' +
      '<div class="e-zh cl-go">进去练 ›</div></button>';
    appEl().innerHTML = top('二次填空 · 升级重写', CLOZE.items.length + ' 篇') +
      '<div class="e-intro">每段先给整段中文，照着中文写英文，写完再对照——记得最牢的是这一步。' +
      '<span class="cl-f">橙红色</span>是句式（题给的），<b>黑色</b>空格是你填的内容；只填短语，不写整句。</div>' +
      stepper(3) + upRow + rows +
      '<div class="e-card"><div class="e-kicker">这五步就是复盘流程</div>' +
      (CLOZE.flow || []).map(function (f, i) {
        return '<div class="cl-flowrow"><b>' + (i + 1) + '</b><span>' + esc(f.n) + '</span>' + esc(f.d || '') + '</div>';
      }).join('') +
      '</div>';
    bindBack(renderRecords);
    document.getElementById('upentry').onclick = renderUpList;
    $$('[data-cl]').forEach(function (b) {
      b.onclick = function () { renderClozeFill(b.getAttribute('data-cl')); };
    });
  }

  function renderClozeFill(id) {
    clearTimer();
    var it = itemById(id);
    if (!it) return renderClozeList();
    var rec = cRec(id), bs = blanksOf(it), total = bs.length;

    function nFilled() {
      return bs.filter(function (b) { return String(rec.v[b.k] || '').trim(); }).length;
    }

    var body = (it.paras || []).map(function (p) {
      var inner = (p.segs || []).map(function (s) {
        if (s.t === 'b') {
          return '<span class="cl-b" contenteditable="true" spellcheck="false" data-k="' + esc(s.k) +
            '" data-ph="' + esc(s.h ? '「' + s.h + '」' : '写英文') + '">' + esc(rec.v[s.k] || '') + '</span>';
        }
        return '<span class="cl-f">' + esc(s.v) + '</span>';
      }).join('');
      return '<div class="cl-para">' + cnBlock(p, true) +
        '<div class="cl-role">' + esc(p.role || '') + '</div>' +
        '<p class="cl-text">' + inner + '</p></div>';
    }).join('');

    appEl().innerHTML = top('二次填空', '') +
      stepper(3) +
      '<div class="cl-head"><span class="cl-count" id="clcount">' + nFilled() + '/' + total + '</span>' +
      '<span class="cl-hintline">先读上面的中文，照着它在下面写英文；点空格直接输入，写完再对照</span></div>' +
      '<div class="cl-bar"><button class="cl-toggle" id="clcn">' + (cnOn() ? '收起中文' : '显示中文') + '</button>' +
      '<span class="cl-tip">中文里的横线就是你要填的位置</span></div>' +
      '<div class="e-card cl-paper' + (cnOn() ? '' : ' nocn') + '" id="clpaper">' + body + '</div>' +
      '<button class="e-btn" id="clcheck">对照参考</button>' +
      '<button class="e-link" id="clclear">清空重填</button>' +
      '<button class="e-link" id="clback">返回列表</button>';
    bindBack(function () { cSave(); renderClozeList(); });

    var cnBtn = document.getElementById('clcn');
    var paper = document.getElementById('clpaper');
    if (cnBtn) cnBtn.onclick = function () {
      var on = !cnOn();
      cnSet(on);
      if (paper) paper.classList.toggle('nocn', !on);
      cnBtn.textContent = on ? '收起中文' : '显示中文';
    };

    var btn = document.getElementById('clcheck');
    var cnt = document.getElementById('clcount');
    function sync() {
      var n = nFilled();
      if (cnt) cnt.textContent = n + '/' + total;
      if (btn) btn.textContent = n >= total ? '全部填完 · 对照参考' : '对照参考（还差 ' + (total - n) + ' 空）';
      $$('.cl-cnb').forEach(function (e) {
        var k = e.getAttribute('data-to');
        if (!k) return;
        if (String(rec.v[k] || '').trim()) e.classList.add('on');
        else e.classList.remove('on');
      });
    }

    /* 点中文里的横线，直接跳到对应英文空，不用上下找 */
    $$('.cl-cnb').forEach(function (e) {
      e.onclick = function () {
        var k = e.getAttribute('data-to');
        var t = document.querySelector('.cl-b[data-k="' + k + '"]');
        if (!t) return;
        t.focus();
        if (t.scrollIntoView) t.scrollIntoView({ block: 'center', behavior: 'smooth' });
      };
    });

    $$('.cl-b').forEach(function (el) {
      el.addEventListener('input', function () {
        var k = el.getAttribute('data-k');
        var t = String(el.textContent || '').replace(/\u00a0/g, ' ').replace(/[\r\n]+/g, ' ');
        if (!t.trim()) el.innerHTML = '';
        rec.v[k] = t;
        rec.t = Date.now();
        clearTimeout(sync._d);
        sync._d = setTimeout(cSave, 600);
        sync();
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
      });
      el.addEventListener('paste', function (e) {
        e.preventDefault();
        var t = '';
        try { t = (e.clipboardData || window.clipboardData).getData('text') || ''; } catch (_) { }
        try { document.execCommand('insertText', false, String(t).replace(/\s+/g, ' ')); } catch (_) { }
      });
      el.addEventListener('blur', function () {
        var k = el.getAttribute('data-k');
        var t = String(el.textContent || '').replace(/\s+/g, ' ').trim();
        if (!t) el.innerHTML = '';
        else if (t !== el.textContent) el.textContent = t;
        rec.v[k] = t;
        cSave();
        sync();
      });
    });

    sync();

    btn.onclick = function () { cSave(); renderClozeCheck(id); };
    document.getElementById('clclear').onclick = function () {
      if (!confirm('清空这篇已经填的内容？')) return;
      rec.v = {}; cSave();
      renderClozeFill(id);
    };
    document.getElementById('clback').onclick = function () { cSave(); renderClozeList(); };
  }

  function renderClozeCheck(id) {
    clearTimer();
    var it = itemById(id);
    if (!it) return renderClozeList();
    var rec = cRec(id), bs = blanksOf(it);
    var diff = {}, same = 0, filled = 0, blank = 0;
    bs.forEach(function (b) {
      var mine = String(rec.v[b.k] || '').trim();
      if (!mine) { blank++; return; }
      filled++;
      if (norm2(mine) === norm2(b.a)) same++;
      else diff[b.k] = true;
    });
    var body = (it.paras || []).map(function (p) {
      var inner = (p.segs || []).map(function (s) {
        if (s.t === 'b') {
          return '<span class="cl-ref' + (diff[s.k] ? ' diff' : '') + '">' + esc(s.a) + '</span>';
        }
        return '<span class="cl-f">' + esc(s.v) + '</span>';
      }).join('');
      var rows = (p.segs || []).filter(function (s) { return s.t === 'b' && diff[s.k]; }).map(function (s) {
        var mine = String(rec.v[s.k] || '').trim();
        return '<div class="cl-diff">' +
          '<div class="cl-dl">你写' + (s.h ? ' <span class="cl-dlh">「' + esc(s.h) + '」</span>' : '') + '</div>' +
          '<div class="cl-dm">' + (mine ? esc(mine) : '<span class="cl-empty">（这里空着）</span>') + '</div>' +
          '<div class="cl-da">' + esc(s.a) + '</div>' +
          (s.w ? '<div class="cl-dw">' + esc(s.w) + '</div>' : '') +
          '</div>';
      }).join('');
      return '<div class="cl-para">' + cnBlock(p, false) +
        '<div class="cl-role">' + esc(p.role || '') + '</div>' +
        '<p class="cl-text">' + inner + '</p>' +
        (rows ? '<div class="cl-diffs">' + rows + '</div>' : '') + '</div>';
    }).join('');
    var chunks = (it.chunks || []).map(function (c) {
      return '<div class="cl-chunk"><b>' + esc(c.p) + '</b> <span>' + esc(c.cn) + '</span>' +
        '<div class="cl-ex">' + esc(c.ex) + '</div></div>';
    }).join('');
    appEl().innerHTML = top('对照参考', same + '/' + bs.length) +
      stepper(4) +
      '<div class="e-intro">和你一致 <b>' + same + '</b> 空，措辞不同 <b>' + (filled - same) + '</b> 空' +
      (blank ? '，还没填 <b>' + blank + '</b> 空' : '') + '。' +
      '这里不判对错，只告诉你每一处为什么这么写；没填的空不算错，回去补完再对一次。</div>' +
      '<div class="e-card cl-paper">' + body + '</div>' +
      (chunks ? '<div class="e-card"><div class="e-kicker">本篇带走的语块</div>' + chunks + '</div>' : '') +
      '<button class="e-btn" id="cldone">存为「已对照」</button>' +
      '<button class="e-link" id="clrefill">回去再填一遍</button>' +
      '<button class="e-link" id="clback2">返回列表</button>';
    bindBack(renderClozeList);
    document.getElementById('cldone').onclick = function () {
      rec.done = 1; rec.doneAt = Date.now(); cSave();
      toast('存好了，三天后再来盲测');
      renderClozeList();
    };
    document.getElementById('clrefill').onclick = function () { renderClozeFill(id); };
    document.getElementById('clback2').onclick = renderClozeList;
  }

  /* ============ 词组升级：一句平淡原句 + 三个必用词组 ============
     第三个视图，和「填空 / 对照」并列。不是凭空造句：先给一句平淡但正确的原句，
     再用三个动不了的词组把它升级。考的是句子怎么组织，以及搭配、介词对不对。 */
  var UKEY = 'ielts.essay.up.v1';
  var UP = null, UST = null, UROUND = null;
  var UPLAN = 8;

  async function ensureUp() {
    if (UP) return true;
    try {
      var r = await fetch('upgrade.json?t=' + Date.now());
      if (!r.ok) throw new Error('load');
      UP = await r.json();
      if (!UP.sets) UP.sets = [];
      return true;
    } catch (e) { return false; }
  }
  function uLoad() {
    if (UST) return UST;
    try { UST = JSON.parse(localStorage.getItem(UKEY) || '{}') || {}; } catch (e) { UST = {}; }
    if (!UST.v) UST.v = {};
    return UST;
  }
  function uSave() {
    uLoad();
    try { localStorage.setItem(UKEY, JSON.stringify(UST)); } catch (e) { toast('存不进去：检查存储设置'); }
  }
  function uAll() {
    var out = [];
    ((UP && UP.sets) || []).forEach(function (s) {
      (s.items || []).forEach(function (it) { it._set = s.id; out.push(it); });
    });
    return out;
  }
  function uById(id) { return uAll().filter(function (x) { return x.id === id; })[0]; }
  function uSetById(id) { return ((UP && UP.sets) || []).filter(function (x) { return x.id === id; })[0]; }
  function uState(id) { uLoad(); return UST.v[id] || {}; }

  /* ---- 判定：词组有没有用上 + 词级重合 ---- */
  function normTxt(s) {
    return String(s || '').toLowerCase().replace(/[\u2019\u2018]/g, "'").replace(/[\u201c\u201d]/g, '"')
      .replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function usedPhrase(sentence, need) {
    var hay = ' ' + normTxt(sentence) + ' ';
    var cands = [need.w].concat(need.alts || []);
    for (var i = 0; i < cands.length; i++) {
      var c = normTxt(cands[i]);
      if (c && hay.indexOf(' ' + c + ' ') >= 0) return true;
    }
    return false;
  }
  function uTok(s) { return String(s || '').split(/\s+/).filter(Boolean); }
  function uNm(w) { return w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, ''); }
  function uCompare(ref, mine) {
    var a = uTok(ref), b = uTok(mine);
    var an = a.map(uNm), bn = b.map(uNm);
    var n = an.length, m = bn.length, i, j;
    var dp = [];
    for (i = 0; i <= n; i++) dp.push(new Int32Array(m + 1));
    for (i = n - 1; i >= 0; i--) {
      for (j = m - 1; j >= 0; j--) {
        dp[i][j] = an[i] === bn[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    var marks = new Array(n).fill(false), same = 0;
    i = 0; j = 0;
    while (i < n && j < m) {
      if (an[i] === bn[j]) { same++; i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) { marks[i] = true; i++; }
      else { j++; }
    }
    while (i < n) { marks[i] = true; i++; }
    return { score: n ? Math.round(same / n * 100) : 0, marks: marks, words: a };
  }
  function uMarkRef(r) {
    return r.words.map(function (w, i) {
      return r.marks[i] ? '<u class="up-miss">' + esc(w) + '</u>' : esc(w);
    }).join(' ');
  }

  /* ---- 选题：先补上次标「不会」的，再补没做过的，最后是已过关的 ---- */
  function pickUp(setId) {
    var pool = setId ? ((uSetById(setId) || {}).items || []) : uAll();
    var weak = [], fresh = [], passed = [];
    pool.forEach(function (it) {
      var st = uState(it.id);
      if (st.grade === 'bad') weak.push(it);
      else if (!st.grade) fresh.push(it);
      else passed.push(it);
    });
    return weak.concat(fresh).concat(passed).slice(0, UPLAN).map(function (x) { return x.id; });
  }

  function upDoneCount() {
    var n = 0;
    uAll().forEach(function (it) { var st = uState(it.id); if (st.grade) n++; });
    return n;
  }

  async function renderUpList() {
    clearTimer();
    var ok = await ensureUp();
    if (!ok || !uAll().length) {
      appEl().innerHTML = top('词组升级', '') +
        '<div class="e-done"><div class="e-big">🔧</div><h2>升级素材没加载上</h2>' +
        '<p>确认 upgrade.json 和本页放在同一目录，然后刷新</p>' +
        '<button class="e-btn" id="upagain" style="margin-top:18px">重试</button></div>';
      bindBack(renderClozeList);
      var r = document.getElementById('upagain');
      if (r) r.onclick = function () { UP = null; renderUpList(); };
      return;
    }
    var total = uAll().length, done = upDoneCount();
    var rows = (UP.sets || []).map(function (s) {
      var its = s.items || [];
      var dn = its.filter(function (it) { return uState(it.id).grade; }).length;
      return '<button class="e-card e-rec" data-upset="' + esc(s.id) + '">' +
        '<div class="e-kicker">' + its.length + ' 题 · ' + esc(s.d || '') + '</div>' +
        '<div class="e-en">' + esc(s.n) + '</div>' +
        '<div class="e-zh cl-go">' + (dn ? dn + '/' + its.length + ' 练过' : '还没开始') + ' ›</div>' +
        '</button>';
    }).join('');
    appEl().innerHTML = top('词组升级', done + '/' + total) +
      '<div class="e-intro">每题先给一句<b>平淡但正确</b>的原句，再给三个<b>必须用上</b>的词组。' +
      '你要做的是把这三处升级，重新组织成一句更像考官写的话——不是凭空造句，也不是逐词翻译。' +
      '写完看：三个词组有没有用上、搭配对不对、句子结构顺不顺。</div>' +
      '<button class="e-btn" id="upstart">今天 8 题 · 混合练</button>' +
      '<div class="e-label">或者只练一个主题</div>' +
      rows +
      '<button class="e-link" id="upback">返回二次填空</button>';
    bindBack(renderClozeList);
    document.getElementById('upback').onclick = renderClozeList;
    document.getElementById('upstart').onclick = function () { startUpRound(null); };
    $$('[data-upset]').forEach(function (b) {
      b.onclick = function () { startUpRound(b.getAttribute('data-upset')); };
    });
  }

  function startUpRound(setId) {
    var ids = pickUp(setId);
    if (!ids.length) { toast('这一组还没有题'); return; }
    UROUND = { ids: ids, i: 0, set: setId || null, stat: { good: 0, meh: 0, bad: 0 } };
    renderUpItem();
  }

  function renderUpItem() {
    clearTimer();
    if (!UROUND || UROUND.i >= UROUND.ids.length) return renderUpDone();
    var it = uById(UROUND.ids[UROUND.i]);
    if (!it) { UROUND.i++; return renderUpItem(); }
    var st = uState(it.id);
    var setN = (uSetById(it._set) || {}).n || '';
    var needs = (it.need || []).map(function (n, i) {
      return '<div class="up-need"><b class="up-num">' + (i + 1) + '</b>' +
        '<span class="up-w">' + esc(n.w) + '</span>' +
        '<span class="up-pos">' + esc(n.pos || '') + '</span>' +
        '<span class="up-zh">' + esc(n.zh || '') + '</span></div>';
    }).join('');
    appEl().innerHTML = top('词组升级', (UROUND.i + 1) + '/' + UROUND.ids.length) +
      '<div class="e-card up-card">' +
      '<div class="up-kicker"><span class="up-theme">' + esc(setN) + '</span>' + esc(it.scene || '') + '</div>' +
      '<div class="e-label">原句（平淡，但正确）</div>' +
      '<div class="up-base">' + esc(it.base || '') + '</div>' +
      '<div class="e-label">把这三处升级，重写成一句</div>' +
      '<div class="up-needs">' + needs + '</div>' +
      '<textarea class="up-ta" id="upans" rows="4" spellcheck="false" autocapitalize="sentences" placeholder="一句话把三个词组都用上…">' + esc(st.ans || '') + '</textarea>' +
      '<button class="e-btn" id="upcheck">对照参考</button>' +
      '<button class="e-link" id="upskip">这题先跳过</button>' +
      '</div><div id="uppanel"></div>';
    bindBack(function () { renderUpList(); });
    var ta = document.getElementById('upans');
    ta.addEventListener('input', function () {
      var cur = uState(it.id); cur.ans = ta.value; UST.v[it.id] = cur; uSave();
    });
    document.getElementById('upskip').onclick = function () { UROUND.i++; renderUpItem(); };
    document.getElementById('upcheck').onclick = function () {
      var v = (ta.value || '').trim();
      if (!v) { toast('先写一句再对照'); ta.focus(); return; }
      var cur = uState(it.id); cur.ans = v; UST.v[it.id] = cur; uSave();
      renderUpPanel(it, v);
    };
  }

  function renderUpPanel(it, mine) {
    var needs = it.need || [];
    var hit = needs.filter(function (n) { return usedPhrase(mine, n); }).length;
    var cmp = uCompare(it.en || '', mine);
    var rows = needs.map(function (n, i) {
      var ok = usedPhrase(mine, n);
      return '<div class="up-check' + (ok ? ' on' : '') + '">' +
        '<div class="up-check-h"><b>' + (ok ? '✓' : '✗') + '</b>' + esc(n.w) +
        '<span class="up-pos">' + esc(n.pos || '') + '</span>' +
        '<span class="up-tag">' + (ok ? '用上了' : '这句里没找到') + '</span></div>' +
        '<div class="up-note">' + esc(n.note || '') + '</div></div>';
    }).join('');
    var dead = needs.length - hit;
    document.getElementById('uppanel').innerHTML =
      '<div class="e-card up-panel">' +
      '<div class="up-score"><b>' + hit + '/' + needs.length + '</b> 个词组用上' +
      '<span class="up-dot">·</span>词重合 ' + cmp.score + '%</div>' +
      '<div class="e-label">参考升级句</div>' +
      '<div class="up-en">' + uMarkRef(cmp) + '</div>' +
      '<div class="e-label">三个词组，逐个核对</div>' + rows +
      '<div class="e-label">为什么这样组织</div>' +
      '<div class="up-why">' + esc(it.why || '') + '</div>' +
      (dead ? '<div class="up-warn">还有 ' + dead + ' 个词组没用上。不用重写整句，先想着把缺的那个塞进合适的位置，再读一遍。</div>' : '') +
      '<div class="e-label">这一题你写对了吗</div>' +
      '<div class="up-grades">' +
      '<button class="grade bad" data-g="bad">不会<small>明天再来</small></button>' +
      '<button class="grade meh" data-g="meh">差一点<small>搭配 / 小错</small></button>' +
      '<button class="grade good" data-g="good">写对了<small>下次不再出</small></button>' +
      '</div></div>';
    document.getElementById('uppanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $$('#uppanel [data-g]').forEach(function (b) {
      b.onclick = function () {
        var g = b.getAttribute('data-g');
        var cur = uState(it.id);
        cur.grade = g; cur.ans = mine; cur.t = Date.now();
        UST.v[it.id] = cur; uSave();
        UROUND.stat[g] = (UROUND.stat[g] || 0) + 1;
        UROUND.i++;
        renderUpItem();
      };
    });
  }

  function renderUpDone() {
    clearTimer();
    var s = (UROUND && UROUND.stat) || { good: 0, meh: 0, bad: 0 };
    var total = (UROUND && UROUND.ids.length) || 0;
    var list = (UROUND && UROUND.ids) || [];
    var weak = list.filter(function (id) { return uState(id).grade === 'bad'; }).map(function (id) {
      var it = uById(id);
      return it ? '<div class="cl-flowrow"><b>·</b><span>' + esc((it.need || [])[0] ? it.need[0].w : id) + '</span>' + esc(it.scene || '') + '</div>' : '';
    }).join('');
    appEl().innerHTML = top('词组升级', '本轮完成') +
      '<div class="e-done" style="flex:none;padding:22px 0 6px"><div class="e-big">✅</div>' +
      '<h2>' + total + ' 题做完了</h2>' +
      '<p>写对 ' + s.good + ' 题 · 差一点 ' + s.meh + ' 题 · 不会 ' + s.bad + ' 题</p></div>' +
      (weak ? '<div class="e-card"><div class="e-kicker">明天会先出这几题</div>' + weak + '</div>' : '') +
      '<button class="e-btn" id="upmore">再来一轮</button>' +
      '<button class="e-link" id="upback2">返回词组升级</button>';
    bindBack(renderUpList);
    document.getElementById('upback2').onclick = renderUpList;
    document.getElementById('upmore').onclick = function () { startUpRound(UROUND ? UROUND.set : null); };
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
      /* ---- 分层拼句 ---- */
      '.e-nav{display:flex;gap:6px;overflow-x:auto;padding:0 0 10px;margin:0 0 4px;-webkit-overflow-scrolling:touch}',
      '.e-navd{flex:0 0 auto;border:1px solid var(--line);background:var(--card2);color:var(--dim);border-radius:999px;padding:6px 10px;font-size:11px;font-family:inherit;white-space:nowrap}',
      '.e-seg{padding:0;overflow:hidden}',
      '.e-segh{display:flex;align-items:center;gap:8px;padding:14px 16px;cursor:pointer}',
      '.e-segn{width:20px;height:20px;border-radius:50%;background:var(--card2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--dim);flex:0 0 auto;font-weight:500}',
      '.e-segname{font-size:14px;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.e-segst{font-size:10.5px;color:var(--dim);display:flex;align-items:center;gap:6px;flex:0 0 auto}',
      '.e-segst.on{color:var(--bad)}',
      '.e-segst i{font-style:normal;border:1px solid currentColor;border-radius:6px;padding:1px 5px;font-size:10px}',
      '.e-caret{color:var(--dim);font-size:13px;transition:transform .18s;flex:0 0 auto}',
      '.e-seg.folded .e-caret{transform:rotate(-90deg)}',
      '.e-segb{padding:0 16px 16px}',
      '.e-lay{padding:13px 0;border-top:1px solid var(--line)}',
      '.e-lay:first-child{border-top:0;padding-top:2px}',
      '.e-lay-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
      '.e-lay-h b{font-size:13px;color:var(--accent)}',
      '.e-lay-q{font-size:12px;color:var(--fg)}',
      '.e-opt-tag{font-style:normal;font-size:10px;color:var(--dim);border:1px solid var(--line);border-radius:6px;padding:1px 5px}',
      '.e-lay-ask{font-size:11.5px;color:var(--dim);line-height:1.65;margin-top:5px}',
      '.e-stks{display:flex;flex-direction:column;gap:6px;margin-top:8px}',
      '.e-stk{text-align:left;font-family:inherit;font-size:12px;line-height:1.5;color:var(--dim);background:var(--card2);border:1px solid transparent;border-radius:10px;padding:8px 10px}',
      '.e-stk.on{color:var(--fg);border-color:var(--accent);background:var(--card)}',
      '.e-stk i{display:block;font-style:normal;font-size:10px;color:var(--dim);margin-top:3px}',
      '.e-lay-prev{display:none;margin-top:9px;padding:9px 11px;border-left:3px solid var(--accent);background:var(--card2);border-radius:0 8px 8px 0;font-size:12.5px;line-height:1.7}',
      '.e-idea{margin-top:9px}',
      '.e-idea summary{font-size:11px;color:var(--dim);cursor:pointer}',
      '.e-idea ul{margin:7px 0 0;padding-left:18px;font-size:11.5px;color:var(--dim);line-height:1.75}',
      '.e-freewrap{margin-top:14px}',
      '.e-freewrap label{display:block;font-size:11px;color:var(--dim);margin-bottom:5px}',
      '.e-paraprev{margin-top:12px;padding:11px 13px;border:1px dashed var(--line);border-radius:12px;font-size:13px;line-height:1.8;min-height:20px}',
      '.e-dimtext{color:var(--dim);font-size:12px}',
      /* ---- 参考 + 自己写 ---- */
      '.e-reftog{flex:0 0 auto;border:1px solid var(--line);background:var(--card2);color:var(--dim);border-radius:999px;padding:5px 10px;font-size:11px;font-family:inherit}',
      '.e-reftog.on{color:var(--fg);border-color:var(--accent)}',
      '.e-reffold{background:var(--card2);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:12px 16px}',
      '.e-refhead{font-size:11.5px;color:var(--accent);line-height:1.65;margin-bottom:10px}',
      '.e-rl{padding:9px 0;border-top:1px dashed var(--line)}',
      '.e-rl:first-of-type{border-top:0}',
      '.e-rl-h{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}',
      '.e-rl-h b{width:16px;height:16px;border-radius:50%;background:var(--card);border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:10px;color:var(--dim);flex:0 0 auto}',
      '.e-rl-zh{font-size:12.5px;font-weight:600}',
      '.e-rl-q{font-size:11px;color:var(--dim)}',
      '.e-rl-ask{font-size:11px;color:var(--dim);line-height:1.6;margin:4px 0 0 23px}',
      '.e-rl-stk{display:flex;flex-wrap:wrap;gap:5px;margin:6px 0 0 23px}',
      '.e-rl-stk code{font-family:inherit;font-size:11px;line-height:1.5;color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:4px 7px}',
      '.e-rl-eg{font-size:11px;color:var(--dim);line-height:1.6;margin:6px 0 0 23px;padding-left:7px;border-left:2px solid var(--line)}',
      '.e-model{margin-top:10px}',
      '.e-model summary{font-size:11px;color:var(--dim);cursor:pointer}',
      '.e-model p{margin:7px 0 0;font-size:12px;line-height:1.8;color:var(--fg);background:var(--card);border-radius:10px;padding:10px 12px}',
      '.e-chk{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;min-height:8px}',
      '.e-miss{font-style:normal;font-size:10.5px;color:var(--bad);border:1px solid currentColor;border-radius:6px;padding:2px 6px}',
      '.e-ok{font-style:normal;font-size:10.5px;color:var(--good);border:1px solid currentColor;border-radius:6px;padding:2px 6px}',
      '.e-para{display:grid;grid-template-columns:1fr;gap:12px}',
      '@media(min-width:720px){.e-para{grid-template-columns:1.15fr 1fr;align-items:start}}',
      '.e-edit label{display:block;font-size:11px;color:var(--dim);margin-bottom:4px}',
      '.e-ta.sm{margin-top:0;font-size:14px;min-height:84px}',
      '.e-tag{font-size:10px;color:var(--good);border:1px solid var(--line);border-radius:6px;padding:1px 6px;margin-left:6px}',
      '.e-rec{width:100%;text-align:left;font-family:inherit;color:var(--fg);display:block}',
      '.e-ref{font-size:13.5px;line-height:1.75;white-space:pre-wrap;user-select:text;-webkit-user-select:text}',
      '.e-hl{background:#fff3a3;color:inherit;border-radius:2px}',
      '.e-ul{text-decoration:underline;text-decoration-color:#e0a800;text-decoration-thickness:2px;color:inherit}',
      '.e-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;font-size:11px;color:var(--dim)}',
      '.e-tool{border:1px solid var(--line);background:var(--card2);color:var(--fg);border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit}',
      '.e-note{margin-top:12px}',
      '.e-note label{display:block;font-size:11px;color:var(--dim);margin-bottom:4px}',
      '.e-full{font-size:14.5px;line-height:1.95;padding:18px 16px}',
      '.e-full-para{white-space:pre-wrap;margin-bottom:18px}',
      '.e-full-para:last-child{margin-bottom:0}',
      '.e-check{display:flex;gap:9px;align-items:flex-start;font-size:13px;line-height:1.6;margin-top:10px}',
      '.e-check input{margin-top:2px;width:18px;height:18px;accent-color:var(--accent)}',
      '.e-done{text-align:center;padding:20px 0 6px}',
      '.e-done .e-big{font-size:52px;line-height:1}',
      '.e-done h2{font-size:21px;margin:10px 0 6px}',
      '.e-done p{font-size:13px;color:var(--dim)}',
      /* ---- 二次填空 ---- */
      ':root{--cl-frame:#d9482a}',
      '@media (prefers-color-scheme: dark){:root{--cl-frame:#ff8a63}}',
      '.cl-step{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:0 0 12px;font-size:11px;color:var(--dim)}',
      '.cl-step i{font-style:normal;opacity:.45;padding:0 1px}',
      '.cl-s{border:1px solid var(--line);border-radius:999px;padding:4px 9px;display:inline-flex;gap:5px;align-items:center}',
      '.cl-s b{font-weight:600;opacity:.55}',
      '.cl-s.on{border-color:var(--cl-frame);color:var(--cl-frame)}',
      '.cl-s.on b{opacity:1}',
      '.cl-flowrow{font-size:12px;line-height:1.75;color:var(--dim);display:flex;gap:8px;margin-top:6px}',
      '.cl-flowrow b{color:var(--cl-frame);flex:none;width:12px}',
      '.cl-flowrow span{color:var(--fg);flex:none;min-width:34px}',
      '.cl-head{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}',
      '.cl-count{font-size:22px;font-weight:700;color:var(--cl-frame);font-variant-numeric:tabular-nums}',
      '.cl-hintline{font-size:11.5px;color:var(--dim);line-height:1.5}',
      '.cl-paper{padding:18px 16px}',
      '.cl-para{margin-bottom:18px}',
      '.cl-para:last-child{margin-bottom:0}',
      '.cl-role{font-size:10.5px;color:var(--dim);letter-spacing:.03em;margin-bottom:7px}',
      '.cl-text{margin:0;font-size:14.5px;line-height:2.1;user-select:text;-webkit-user-select:text}',
      '.cl-f{color:var(--cl-frame)}',
      '.cl-b{display:inline;color:var(--fg);font-weight:600;border-bottom:1.5px dashed rgba(217,72,42,.5);padding:0 2px;border-radius:3px;outline:none;-webkit-user-select:text;user-select:text}',
      '.cl-b:focus{background:rgba(217,72,42,.1);border-bottom-style:solid}',
      '.cl-b:empty::before{content:attr(data-ph);color:#8e7d74;font-weight:400;font-size:12.5px}',
      '@media (prefers-color-scheme: dark){.cl-b:empty::before{color:#a89a91}}',
      /* 整段中文（空位与英文一一对应） */
      '.cl-bar{display:flex;align-items:center;gap:9px;margin:0 0 9px;flex-wrap:wrap}',
      '.cl-toggle{background:none;border:1px solid var(--line);color:var(--dim);font-size:11.5px;padding:4px 11px;border-radius:999px;font-family:inherit}',
      '.cl-tip{font-size:11px;color:var(--dim);opacity:.85}',
      '.cl-cn{font-size:13px;line-height:2;color:var(--dim);background:rgba(120,90,70,.06);border-radius:9px;padding:9px 12px 10px;margin-bottom:8px;user-select:text;-webkit-user-select:text}',
      '.cl-cnlab{display:block;font-size:9.5px;letter-spacing:.08em;color:var(--cl-frame);opacity:.8;margin-bottom:2px}',
      '.cl-cnb{display:inline-block;min-width:40px;height:1.05em;vertical-align:-.15em;margin:0 3px;border-bottom:1.5px dashed rgba(217,72,42,.5);cursor:pointer}',
      '.cl-cnb.on{border-bottom:1.5px solid var(--cl-frame);background:rgba(217,72,42,.09)}',
      '.cl-paper.nocn .cl-cn{display:none}',
      '@media (prefers-color-scheme: dark){.cl-cn{background:rgba(255,255,255,.055)}.cl-cnb{border-bottom-color:rgba(255,138,99,.55)}}',
      '.cl-ref{color:var(--good);font-weight:600}',
      '.cl-ref.diff{border-bottom:1.5px dotted var(--meh)}',
      '.cl-diffs{margin-top:10px;border-left:2px solid var(--line);padding-left:11px}',
      '.cl-diff{margin-bottom:10px;font-size:12.5px;line-height:1.6}',
      '.cl-dl{font-size:10px;color:var(--dim);letter-spacing:.04em}',
      '.cl-dlh{letter-spacing:0;opacity:.85}',
      '.cl-dm{color:var(--dim);text-decoration:line-through;text-decoration-color:rgba(255,69,58,.55)}',
      '.cl-da{color:var(--good);font-weight:600}',
      '.cl-empty{color:var(--bad);text-decoration:none}',
      '.cl-dw{color:var(--dim);font-size:11.5px;line-height:1.65;margin-top:3px}',
      '.cl-chunk{font-size:13px;line-height:1.6;margin-top:11px}',
      '.cl-chunk b{color:var(--cl-frame)}',
      '.cl-chunk span{color:var(--dim);font-size:12px}',
      '.cl-ex{color:var(--dim);font-size:11.5px;line-height:1.6;margin-top:2px}',
      '.cl-go{margin-top:8px;color:var(--accent)}',
      '.e-label{font-size:10.5px;letter-spacing:.06em;color:var(--dim);margin:16px 0 6px}',
      '.up-card{margin-bottom:12px}',
      '.up-kicker{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--dim);margin-bottom:14px}',
      '.up-theme{background:var(--card2);border-radius:7px;padding:2px 8px;color:var(--fg);font-size:11px}',
      '.up-base{font-size:15.5px;line-height:1.7;padding:9px 12px;border-left:2px solid var(--line);color:var(--dim);margin-bottom:14px}',
      '.up-needs{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}',
      '.up-need{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;background:var(--card2);border-radius:10px;padding:8px 10px}',
      '.up-num{font-size:11px;color:var(--cl-frame);min-width:12px;font-variant-numeric:tabular-nums}',
      '.up-w{font-size:15px;font-weight:600;color:var(--cl-frame)}',
      '.up-pos{font-size:11px;color:var(--dim)}',
      '.up-zh{font-size:12.5px;color:var(--dim)}',
      '.up-ta{width:100%;border:1px solid var(--line);border-radius:12px;background:var(--card2);',
      'color:var(--fg);padding:11px 12px;font-size:15px;line-height:1.65;font-family:inherit;resize:vertical;outline:none}',
      '.up-ta:focus{border-color:var(--accent)}',
      '.up-panel{margin-top:14px}',
      '.up-score{font-size:13px;color:var(--dim);margin-bottom:12px}',
      '.up-score b{font-size:19px;color:var(--fg);font-variant-numeric:tabular-nums}',
      '.up-dot{margin:0 6px}',
      '.up-en{font-size:15.5px;line-height:1.75;padding:8px 0}',
      '.up-miss{text-decoration:none;border-bottom:2px solid var(--bad);color:var(--bad)}',
      '.up-check{border:1px solid var(--line);border-radius:10px;padding:8px 10px;margin-bottom:8px}',
      '.up-check.on{border-color:var(--good)}',
      '.up-check-h{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;font-size:14px}',
      '.up-check-h b{color:var(--bad)}',
      '.up-check.on .up-check-h b{color:var(--good)}',
      '.up-tag{font-size:11px;color:var(--dim);margin-left:auto}',
      '.up-note{font-size:12.5px;line-height:1.7;color:var(--dim);margin-top:4px}',
      '.up-why{font-size:13px;line-height:1.8;color:var(--fg)}',
      '.up-warn{font-size:12.5px;line-height:1.7;color:var(--dim);background:var(--card2);border-radius:10px;padding:9px 11px;margin-top:12px}',
      '.up-grades{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:10px}'
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
    cloze: function (id, view) {
      open().then(function () {
        if (id === 'up' || id === 'kw') {
          ensureUp().then(function (ok) {
            if (!ok) { renderUpList(); return; }
            if (view && uById(view)) {
              UROUND = { ids: [view], i: 0, stat: { good: 0, meh: 0, bad: 0 } };
              renderUpItem();
            } else {
              renderUpList();
            }
          });
          return;
        }
        ensureCloze().then(function (ok) {
          if (ok && id && itemById(id)) {
            if (view === 'ref') renderClozeCheck(id);
            else renderClozeFill(id);
          } else {
            renderClozeList();
          }
        });
      });
    },
    _cloze: function () { return { data: CLOZE, st: cLoad() }; },
    _mark: function (li, pi, s, e, type) {
      var log = ST.logs[li];
      log.marks = log.marks || {};
      log.marks[pi] = normMarks((log.marks[pi] || []).concat([{ start: s, end: e, type: type }]));
      save();
      renderRecord(li);
    },
    _full: renderFull,
    _detect: detect
  };
})();
