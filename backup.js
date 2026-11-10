/* 雅思复习 · 全量备份与合并
   手机和电脑各存各的，靠这个文件互通：一边导出，另一边导入并合并。 */
(function () {
  'use strict';

  var KEYS = {
    srs: 'ielts.srs.v2',
    cfg: 'ielts.cfg.v2',
    stat: 'ielts.stat.v2',
    write: 'ielts.write.v1',
    pat: 'ielts.pat.v1',
    idea: 'ielts.idea.v1'
  };

  function read(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; }
  }
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }

  /* 同一张卡：阶段高的赢；阶段相同看下次到期日谁晚 */
  function srsMerge(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    Object.keys(a).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b).forEach(function (k) {
      var x = out[k], y = b[k];
      if (!x) { out[k] = y; return; }
      var sx = x.s || 0, sy = y.s || 0;
      if (sy > sx) out[k] = y;
      else if (sy === sx && (y.d || '') > (x.d || '')) {
        var z = {};
        Object.keys(x).forEach(function (f) { z[f] = x[f]; });
        Object.keys(y).forEach(function (f) { if (z[f] == null) z[f] = y[f]; });
        out[k] = z;
      }
    });
    return out;
  }

  function statMerge(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    Object.keys(a).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b).forEach(function (k) {
      var x = out[k], y = b[k];
      if (x == null) { out[k] = y; return; }
      if (typeof x === 'number' && typeof y === 'number') out[k] = Math.max(x, y);
      else if (typeof x === 'string' && typeof y === 'string') out[k] = x > y ? x : y;
      else out[k] = x;
    });
    return out;
  }

  function isPlain(x) { return x && typeof x === 'object' && !Array.isArray(x); }

  function mergeDay(x, y) {
    var out = {};
    Object.keys(x).concat(Object.keys(y)).forEach(function (k) {
      var vx = x[k], vy = y[k];
      if (vx === undefined) { out[k] = vy; return; }
      if (vy === undefined) { out[k] = vx; return; }
      if (k === 'started') { out[k] = Math.min(vx, vy); return; }
      if (typeof vx === 'number' && typeof vy === 'number') { out[k] = Math.max(vx, vy); return; }
      if (typeof vx === 'boolean' && typeof vy === 'boolean') { out[k] = vx || vy; return; }
      if (Array.isArray(vx) && Array.isArray(vy)) {
        out[k] = vx.slice();
        vy.forEach(function (v) { if (out[k].indexOf(v) < 0) out[k].push(v); });
        return;
      }
      if (isPlain(vx) && isPlain(vy)) { out[k] = mergeDay(vx, vy); return; }
      out[k] = vx;
    });
    return out;
  }

  function daysMerge(a, b) {
    a = a || {}; b = b || {};
    var out = {};
    Object.keys(a).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b).forEach(function (k) {
      out[k] = out[k] ? mergeDay(out[k], b[k]) : b[k];
    });
    return out;
  }

  function logKey(l) {
    return [l.t || '', l.block || '', l.id || '', l.d || '', l.mine || ''].join('|');
  }

  function logsMerge(a, b) {
    a = a || []; b = b || [];
    var out = a.slice(), seen = {};
    out.forEach(function (l) { seen[logKey(l)] = l; });
    b.forEach(function (l) {
      var k = logKey(l), cur = seen[k];
      if (!cur) { out.push(l); seen[k] = l; return; }
      if (!cur.polish && l.polish) cur.polish = l.polish;
      if (cur.grade === 'bad' && l.grade === 'good') cur.grade = 'good';
    });
    out.sort(function (x, y) { return (x.t || 0) - (y.t || 0); });
    return out;
  }

  function mergeState(local, incoming) {
    local = local || {}; incoming = incoming || {};
    var lw = local.write || {}, iw = incoming.write || {};
    var lp = local.pat || {}, ip = incoming.pat || {};
    var li = local.idea || {}, ii = incoming.idea || {};
    return {
      srs: srsMerge(local.srs, incoming.srs),
      cfg: local.cfg || incoming.cfg || null,
      stat: statMerge(local.stat, incoming.stat),
      write: {
        srs: srsMerge(lw.srs, iw.srs),
        days: daysMerge(lw.days, iw.days),
        logs: logsMerge(lw.logs, iw.logs)
      },
      pat: {
        srs: srsMerge(lp.srs, ip.srs),
        days: daysMerge(lp.days, ip.days)
      },
      idea: {
        srs: srsMerge(li.srs, ii.srs),
        days: daysMerge(li.days, ii.days),
        logs: logsMerge(li.logs, ii.logs)
      }
    };
  }

  function snapshot() {
    return {
      v: 1,
      app: 'ielts-card',
      exported: new Date().toISOString(),
      data: {
        srs: read(KEYS.srs) || {},
        cfg: read(KEYS.cfg) || {},
        stat: read(KEYS.stat) || {},
        write: read(KEYS.write) || {},
        pat: read(KEYS.pat) || {},
        idea: read(KEYS.idea) || {}
      }
    };
  }

  function exportAll() {
    var payload = snapshot();
    var n = Object.keys(payload.data.srs || {}).length +
      ((payload.data.write.logs || []).length) + ((payload.data.idea.logs || []).length);
    var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ielts-all-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    return n;
  }

  function importPayload(payload) {
    var inc = (payload && payload.data) ? payload.data : (payload || {});
    var local = {
      srs: read(KEYS.srs), cfg: read(KEYS.cfg), stat: read(KEYS.stat),
      write: read(KEYS.write), pat: read(KEYS.pat), idea: read(KEYS.idea)
    };
    var m = mergeState(local, inc);
    write(KEYS.srs, m.srs);
    if (m.stat) write(KEYS.stat, m.stat);
    if (m.cfg) write(KEYS.cfg, m.cfg);
    write(KEYS.write, m.write);
    write(KEYS.pat, m.pat);
    write(KEYS.idea, m.idea);
    return {
      vocab: Object.keys(m.srs || {}).length,
      writeLogs: (m.write.logs || []).length,
      ideaLogs: (m.idea.logs || []).length
    };
  }

  function summary() {
    var w = read(KEYS.write) || {}, p = read(KEYS.pat) || {}, i = read(KEYS.idea) || {};
    return {
      vocab: Object.keys(read(KEYS.srs) || {}).length,
      writeSrs: Object.keys(w.srs || {}).length,
      writeLogs: (w.logs || []).length,
      patSrs: Object.keys(p.srs || {}).length,
      ideaSrs: Object.keys(i.srs || {}).length,
      ideaLogs: (i.logs || []).length
    };
  }

  window.BACKUP = {
    exportAll: exportAll,
    importPayload: importPayload,
    summary: summary,
    _merge: mergeState
  };
})();
