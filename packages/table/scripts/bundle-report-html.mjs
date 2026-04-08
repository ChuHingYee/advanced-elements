/**
 * <zh/> 产物可视化报告渲染 — 把 analyze-bundle 的 report 对象渲染为单文件离线 HTML
 * <zh/>（概览卡 / TreeMap / TreeGraph / 重复包 / 模块详情，对标 Rsdoctor Bundle Size 四件套）。
 * <en/> Visual bundle report renderer — renders the analyze-bundle report object to a single offline HTML file
 * <en/> (overview cards / treemap / treegraph / duplicates / module details, mirroring the Rsdoctor Bundle Size set).
 *
 * @remarks
 * <zh/> 纯静态、无 CDN、无框架：内联 CSS + 原生 SVG squarified treemap + 香草 JS，可 file:// 直接打开。
 * <zh/> 嵌入 JSON 中的 `</script` 统一转义（SFC 源码含 `</script>` 标签）。
 * <en/> Fully static, no CDN, no framework: inline CSS + native SVG squarified treemap + vanilla JS, openable via file://.
 * <en/> Embedded JSON escapes every `</script` (SFC sources contain `</script>` tags).
 */

/** <zh/> 嵌入 JSON 时转义 script 闭合标签 | <en/> Escape script closers when embedding JSON */
const SCRIPT_CLOSE_RE = /<\/script/gi

/**
 * <zh/> HTML 转义（split/join 实现，避免函数内正则触发 lint） | <en/> HTML escape (split/join based, keeps function bodies regex-free for lint)
 */
function escHtml(s) {
  return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;')
}

function kb(n) {
  return `${(n / 1024).toFixed(1)}KB`
}

/**
 * <zh/> 渲染完整 HTML 报告 | <en/> Render the full HTML report
 *
 * @param report - <zh/> analyze-bundle 组装的报告对象 | <en/> report object assembled by analyze-bundle
 * @returns <zh/> 单文件 HTML | <en/> single-file HTML
 */
export function renderHtmlReport(report) {
  const t = report.totals
  const cards = [
    { label: 'Total JS', value: `${kb(t.jsBytes)} / ${kb(t.jsGzip)} gzip`, sub: `${t.chunkCount} chunks` },
    { label: 'Initial JS（首屏）', value: `${kb(t.initialBytes)} / ${kb(t.initialGzip)} gzip`, sub: 'entry + sync 闭包' },
    { label: 'Lazy JS（按需）', value: `${kb(t.lazyBytes)} / ${kb(t.lazyGzip)} gzip`, sub: 'dynamic import' },
    { label: 'Modules', value: String(t.moduleCount), sub: 'map 归因去重' },
    { label: 'Duplicate Packages', value: String(t.dupCount), sub: t.dupCount > 0 ? '有多份拷贝，需处理' : '无重复包' },
    { label: 'Entry', value: report.entry, sub: `${escHtml(report.package)} v${escHtml(report.version)}` },
  ].map(c => `<div class="br-card"><div class="br-card-l">${c.label}</div><div class="br-card-v">${c.value}</div><div class="br-card-s">${c.sub}</div></div>`).join('')

  const dupRows = report.duplicates.length === 0
    ? '<div class="br-empty">无重复包 — node_modules 源码未进包，或同一包只有一份拷贝</div>'
    : `<table class="br-table"><tr><th>包</th><th>拷贝数</th><th>归因体积</th><th>路径</th><th>所在 chunk</th></tr>${
      report.duplicates.map(d => `<tr class="${d.copies > 1 ? 'bad' : ''}"><td>${escHtml(d.pkg)}</td><td>${d.copies}</td><td>${kb(d.bytes)}</td><td>${d.paths.map(escHtml).join('<br>')}</td><td>${d.chunks.map(escHtml).join('<br>')}</td></tr>`).join('')
    }</table>`

  const guardRows = report.externals.guard.map(g => `<tr class="${g.usedInSrc && (!g.external || g.bundled) ? 'bad' : ''}"><td>${escHtml(g.pkg)}</td><td>${g.usedInSrc ? '是' : '否'}</td><td>${g.external == null ? '—' : g.external ? '有' : '无'}</td><td>${g.bundled ? '有' : '无'}</td><td>${!g.usedInSrc ? '跳过' : g.external && !g.bundled ? 'PASS' : 'FAIL'}</td></tr>`).join('')

  const dataJson = JSON.stringify(report).replace(SCRIPT_CLOSE_RE, '<\\/script')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bundle Report — ${escHtml(report.package)} v${escHtml(report.version)}</title>
<style>
:root { color-scheme: light; --bd: #e3e8ef; --tx: #1f2937; --mut: #6b7280; --bg: #f6f8fb; --card: #ffffff; --acc: #2563eb; }
* { box-sizing: border-box; }
body { margin: 0; font: 14px/1.55 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; color: var(--tx); background: var(--bg); }
header { background: #111c2e; color: #fff; padding: 20px 28px; }
header h1 { margin: 0 0 4px; font-size: 20px; }
header p { margin: 0; color: #9fb0c7; font-size: 12px; }
main { padding: 20px 28px 60px; max-width: 1280px; margin: 0 auto; }
.br-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin: 16px 0 20px; }
.br-card { background: var(--card); border: 1px solid var(--bd); border-radius: 10px; padding: 12px 14px; }
.br-card-l { font-size: 12px; color: var(--mut); }
.br-card-v { font-size: 18px; font-weight: 700; margin: 2px 0; word-break: break-all; }
.br-card-s { font-size: 12px; color: var(--mut); }
.br-tabs { display: flex; gap: 8px; margin: 8px 0 14px; }
.br-tabs button { border: 1px solid var(--bd); background: var(--card); border-radius: 8px; padding: 7px 14px; cursor: pointer; font-size: 13px; }
.br-tabs button.on { background: #111c2e; color: #fff; border-color: #111c2e; }
.br-view { display: none; }
.br-view.on { display: block; }
.br-toolbar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; font-size: 13px; }
.br-toolbar input { border: 1px solid var(--bd); border-radius: 7px; padding: 6px 10px; font-size: 13px; width: 220px; }
.br-toolbar input.num { width: 110px; }
.br-toolbar button { border: 1px solid var(--bd); background: var(--card); border-radius: 7px; padding: 6px 12px; cursor: pointer; }
#br-crumb { font-size: 13px; color: var(--mut); margin-bottom: 8px; }
#br-map { width: 100%; height: auto; background: var(--card); border: 1px solid var(--bd); border-radius: 10px; }
.br-node { cursor: pointer; }
.br-node.dim { opacity: 0.13; }
.br-node text { fill: #1f2937; font-size: 13px; pointer-events: none; }
.br-node text.sub { fill: #4b5563; font-size: 11.5px; }
.br-asset { background: var(--card); border: 1px solid var(--bd); border-radius: 10px; margin-bottom: 10px; overflow: hidden; }
.br-asset-h { display: flex; gap: 10px; align-items: center; padding: 9px 14px; cursor: pointer; }
.br-asset-h:hover { background: #eef3fa; }
.br-badge { font-size: 11px; border-radius: 20px; padding: 1px 9px; color: #fff; background: #6b7280; flex: none; }
.br-badge.entry { background: #b45309; }
.br-badge.sync { background: #2563eb; }
.br-badge.lazy { background: #0d9488; }
.br-asset-n { font-family: ui-monospace, Consolas, monospace; font-size: 13px; word-break: break-all; }
.br-asset-s { margin-left: auto; font-size: 12px; color: var(--mut); white-space: nowrap; }
.br-asset-b { display: none; border-top: 1px solid var(--bd); padding: 6px 14px 10px; }
.br-asset.open .br-asset-b { display: block; }
.br-mod { display: flex; gap: 10px; align-items: center; padding: 3px 0; font-size: 12.5px; cursor: pointer; border-radius: 6px; }
.br-mod:hover { background: #eef3fa; }
.br-mod-n { font-family: ui-monospace, Consolas, monospace; width: 46%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: none; }
.br-bar { flex: 1; height: 8px; background: #eef1f6; border-radius: 5px; overflow: hidden; }
.br-bar span { display: block; height: 100%; background: var(--acc); }
.br-mod-s { width: 90px; text-align: right; color: var(--mut); flex: none; }
.br-table { width: 100%; border-collapse: collapse; background: var(--card); font-size: 13px; }
.br-table th, .br-table td { border: 1px solid var(--bd); padding: 7px 10px; text-align: left; vertical-align: top; }
.br-table th { background: #eef1f6; }
.br-table tr.bad td { background: #fef2f2; }
.br-empty { background: var(--card); border: 1px dashed var(--bd); border-radius: 10px; padding: 22px; color: var(--mut); }
#br-detail { position: fixed; top: 0; right: 0; width: min(560px, 94vw); height: 100vh; background: #fff; border-left: 1px solid var(--bd); box-shadow: -8px 0 24px rgba(0,0,0,.08); transform: translateX(102%); transition: transform .18s; display: flex; flex-direction: column; z-index: 50; }
#br-detail.show { transform: none; }
.br-d-h { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--bd); font-weight: 700; }
.br-d-h button { margin-left: auto; border: 1px solid var(--bd); background: #fff; border-radius: 7px; padding: 5px 12px; cursor: pointer; }
.br-d-file { padding: 10px 16px 0; font-family: ui-monospace, Consolas, monospace; font-size: 12.5px; word-break: break-all; }
.br-d-meta { padding: 4px 16px 8px; font-size: 12px; color: var(--mut); }
#br-detail pre { margin: 0; padding: 12px 16px; overflow: auto; flex: 1; font-size: 12px; background: #0f172a; color: #dbe4f0; }
footer { color: var(--mut); font-size: 12px; margin-top: 26px; }
</style>
</head>
<body>
<header><h1>Bundle Report — ${escHtml(report.package)} v${escHtml(report.version)}</h1><p>生成于 ${escHtml(report.generatedAt)} · 入口 ${escHtml(report.entry)} · 模块体积为 map 归因近似值（压缩后 token 口径）</p></header>
<main>
<div class="br-cards">${cards}</div>
<div class="br-tabs">
<button data-tab="map" class="on">TreeMap</button><button data-tab="tree">TreeGraph</button><button data-tab="dup">重复包</button><button data-tab="ext">外部依赖</button>
</div>
<section id="v-map" class="br-view on">
<div class="br-toolbar"><input id="br-q" placeholder="搜索模块 / chunk（高亮匹配）"><span id="br-crumb"></span></div>
<svg id="br-map" viewBox="0 0 1000 600" role="img"></svg>
</section>
<section id="v-tree" class="br-view">
<div class="br-toolbar"><input id="br-aq" placeholder="搜索 Asset"><input id="br-mina" class="num" type="number" min="0" placeholder="Asset ≥ KB"><input id="br-minm" class="num" type="number" min="0" placeholder="Module ≥ KB"><button id="br-expand">展开全部</button></div>
<div id="br-assets"></div>
</section>
<section id="v-dup" class="br-view">${dupRows}</section>
<section id="v-ext" class="br-view"><table class="br-table"><tr><th>包</th><th>源码引用</th><th>外部引用</th><th>实现打入</th><th>结论</th></tr>${guardRows}</table></section>
<footer>数据源：dist chunk + sourcemap（mappings VLQ 解码归因）· 灰色柱为占比条 · 点击模块行查看源码片段</footer>
</main>
<aside id="br-detail"></aside>
<script id="br-data" type="application/json">${dataJson}</script>
<script>
(function () {
  var DATA = JSON.parse(document.getElementById('br-data').textContent);
  var state = { tab: 'map', zoom: null, q: '', aq: '', minA: 0, minM: 0, open: {}, expandAll: false };
  function $(id) { return document.getElementById(id); }
  function kb(n) { return (n / 1024).toFixed(1) + 'KB'; }
  function esc(s) {
    return String(s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split('"').join('&quot;');
  }
  function hue(s) { var h = 0, i; for (i = 0; i < s.length; i++) h = ((h * 31) + s.charCodeAt(i)) >>> 0; return h % 360; }
  function shortName(f) { var p = f.split('/'); return p[p.length - 1]; }
  function trunc(s, w) { var n = Math.max(5, Math.floor(w / 8.5)); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function colorFor(file, kind) {
    var top = file.split('/')[0], l = kind === 'lazy' ? 56 : 64;
    if (file.indexOf('node_modules') === 0) l = 40;
    return 'hsl(' + hue(top) + ',42%,' + l + '%)';
  }
  function chunkByName(n) { for (var i = 0; i < DATA.chunks.length; i++) if (DATA.chunks[i].name === n) return DATA.chunks[i]; return null; }
  function rowWorst(sum, mx, mn, side) {
    if (!sum || !mn || !side) return Infinity;
    var s2 = side * side, t2 = sum * sum;
    return Math.max((s2 * mx) / t2, t2 / (s2 * mn));
  }
  function squarify(nodes, x, y, w, h) {
    var out = [];
    var items = nodes.slice().sort(function (a, b) { return b.value - a.value; });
    var row = [], sum = 0, cx = x, cy = y, cw = w, ch = h, i, j;
    function flush() {
      if (!row.length) return;
      var off = 0;
      if (cw >= ch) {
        var sh = sum / cw;
        for (i = 0; i < row.length; i++) {
          var ww = (row[i].value / sum) * cw;
          out.push({ n: row[i], x: cx + off, y: cy, w: ww, h: sh }); off += ww;
        }
        cy += sh; ch -= sh;
      } else {
        var sw = sum / ch;
        for (j = 0; j < row.length; j++) {
          var hh = (row[j].value / sum) * ch;
          out.push({ n: row[j], x: cx, y: cy + off, w: sw, h: hh }); off += hh;
        }
        cx += sw; cw -= sw;
      }
      row = []; sum = 0;
    }
    while (items.length) {
      var side = Math.min(cw, ch), c = items[0];
      var mx = c.value, mn = c.value;
      for (i = 0; i < row.length; i++) { if (row[i].value > mx) mx = row[i].value; if (row[i].value < mn) mn = row[i].value; }
      var cur = row.length ? rowWorst(sum, mx, mn, side) : Infinity;
      var nxt = rowWorst(sum + c.value, Math.max(mx, c.value), Math.min(mn, c.value), side);
      if (nxt <= cur) { row.push(items.shift()); sum += c.value; } else { flush(); }
    }
    flush();
    return out;
  }
  function mapNodes() {
    if (!state.zoom) {
      return DATA.chunks.map(function (c) {
        return { key: c.name, label: c.name, value: c.bytes, kind: c.kind, file: null, chunk: c.name };
      });
    }
    var c = chunkByName(state.zoom);
    if (!c) return [];
    return c.modules.map(function (m) {
      return { key: m.file, label: shortName(m.file), value: m.bytes, kind: c.kind, file: m.file, chunk: c.name };
    });
  }
  function renderMap() {
    var svg = $('br-map'), W = 1000, H = 600;
    var nodes = mapNodes().filter(function (n) { return n.value > 0; });
    var rects = squarify(nodes, 0, 0, W, H);
    var q = state.q.toLowerCase(), html = '', i, r, n, match, fill;
    for (i = 0; i < rects.length; i++) {
      r = rects[i]; n = r.n;
      match = !q || n.label.toLowerCase().indexOf(q) >= 0 || (n.file && n.file.toLowerCase().indexOf(q) >= 0);
      fill = n.file ? colorFor(n.file, n.kind) : (n.kind === 'lazy' ? '#7fb3d9' : n.kind === 'entry' ? '#e5a13c' : '#9db9d5');
      html += '<g class="br-node' + (match ? '' : ' dim') + '" data-key="' + esc(n.key) + '" data-kind="' + (n.file ? 'm' : 'c') + '">'
        + '<rect x="' + r.x.toFixed(1) + '" y="' + r.y.toFixed(1) + '" width="' + Math.max(r.w - 1.5, 0).toFixed(1) + '" height="' + Math.max(r.h - 1.5, 0).toFixed(1) + '" fill="' + fill + '" stroke="#ffffff" stroke-width="1.5"/>'
        + '<title>' + esc((n.file || n.label) + ' — ' + kb(n.value)) + '</title>';
      if (r.w > 96 && r.h > 34) html += '<text x="' + (r.x + 6).toFixed(1) + '" y="' + (r.y + 21).toFixed(1) + '">' + esc(trunc(n.label, r.w)) + '</text>';
      if (r.w > 96 && r.h > 54) html += '<text class="sub" x="' + (r.x + 6).toFixed(1) + '" y="' + (r.y + 39).toFixed(1) + '">' + kb(n.value) + '</text>';
      html += '</g>';
    }
    svg.innerHTML = html;
    $('br-crumb').innerHTML = state.zoom
      ? '<a href="#" id="br-back">全部 chunks</a> / ' + esc(state.zoom) + '（点击模块查看详情）'
      : '全部 chunks（点击色块下钻到模块 · 悬停看体积）';
    var back = $('br-back');
    if (back) back.onclick = function (e) { if (e) e.preventDefault(); state.zoom = null; renderMap(); };
  }
  function renderTree() {
    var wrap = $('br-assets'), aq = state.aq.toLowerCase(), html = '', i, j, c, mods, m, pct;
    var list = DATA.chunks.slice().sort(function (a, b) { return b.bytes - a.bytes; });
    for (i = 0; i < list.length; i++) {
      c = list[i];
      if (aq && c.name.toLowerCase().indexOf(aq) < 0) continue;
      if (c.bytes < state.minA * 1024) continue;
      mods = [];
      for (j = 0; j < c.modules.length; j++) if (c.modules[j].bytes >= state.minM * 1024) mods.push(c.modules[j]);
      html += '<div class="br-asset' + ((state.open[c.name] || state.expandAll) ? ' open' : '') + '" data-name="' + esc(c.name) + '">'
        + '<div class="br-asset-h"><span class="br-badge ' + c.kind + '">' + c.kind + '</span>'
        + '<span class="br-asset-n">' + esc(c.name) + '</span>'
        + '<span class="br-asset-s">' + kb(c.bytes) + ' / ' + kb(c.gzip) + ' gzip · ' + mods.length + ' modules</span></div>'
        + '<div class="br-asset-b">';
      for (j = 0; j < mods.length; j++) {
        m = mods[j];
        pct = c.bytes ? (m.bytes / c.bytes * 100) : 0;
        html += '<div class="br-mod" data-file="' + esc(m.file) + '"><span class="br-mod-n">' + esc(m.file) + '</span>'
          + '<span class="br-bar"><span style="width:' + pct.toFixed(1) + '%"></span></span>'
          + '<span class="br-mod-s">' + kb(m.bytes) + '</span></div>';
      }
      html += '</div></div>';
    }
    wrap.innerHTML = html || '<div class="br-empty">无匹配资源</div>';
  }
  function openDetail(file) {
    var d = $('br-detail'), chunks = [], i, j, mods, total = 0;
    for (i = 0; i < DATA.chunks.length; i++) {
      mods = DATA.chunks[i].modules;
      for (j = 0; j < mods.length; j++) {
        if (mods[j].file === file) { chunks.push(DATA.chunks[i].name + '（' + kb(mods[j].bytes) + '）'); total += mods[j].bytes; break; }
      }
    }
    var src = DATA.sources[file];
    d.innerHTML = '<div class="br-d-h"><span>模块详情</span><button id="br-d-x">关闭</button></div>'
      + '<div class="br-d-file">' + esc(file) + '</div>'
      + '<div class="br-d-meta">归因约 ' + kb(total) + ' · 所在 chunk：' + esc(chunks.join('、') || '—') + '</div>'
      + '<pre>' + esc(src || '（无源码：map 缺 sourcesContent）') + '</pre>';
    d.className = 'show';
    $('br-d-x').onclick = function () { d.className = ''; };
  }
  function switchTab(t) {
    state.tab = t;
    var btns = document.querySelectorAll('.br-tabs button'), i;
    for (i = 0; i < btns.length; i++) btns[i].className = btns[i].getAttribute('data-tab') === t ? 'on' : '';
    var views = { map: 'v-map', tree: 'v-tree', dup: 'v-dup', ext: 'v-ext' };
    for (var k in views) $(views[k]).className = 'br-view' + (k === t ? ' on' : '');
  }
  (function init() {
    var btns = document.querySelectorAll('.br-tabs button'), i;
    for (i = 0; i < btns.length; i++) {
      (function (b) { b.onclick = function () { switchTab(b.getAttribute('data-tab')); }; })(btns[i]);
    }
    $('br-q').oninput = function (e) { state.q = e.target.value; renderMap(); };
    $('br-map').addEventListener('click', function (e) {
      var g = e.target;
      while (g && g !== this && !(g.getAttribute && g.getAttribute('class') && g.getAttribute('class').indexOf('br-node') >= 0)) g = g.parentNode;
      if (!g || g === this) return;
      if (g.getAttribute('data-kind') === 'c' && !state.zoom) { state.zoom = g.getAttribute('data-key'); renderMap(); }
      else { openDetail(g.getAttribute('data-key')); }
    });
    $('br-aq').oninput = function (e) { state.aq = e.target.value; renderTree(); };
    $('br-mina').oninput = function (e) { state.minA = parseFloat(e.target.value) || 0; renderTree(); };
    $('br-minm').oninput = function (e) { state.minM = parseFloat(e.target.value) || 0; renderTree(); };
    $('br-expand').onclick = function () { state.expandAll = !state.expandAll; renderTree(); };
    $('br-assets').addEventListener('click', function (e) {
      var m = e.target;
      while (m && m !== this && !(m.getAttribute && m.getAttribute('class') && m.getAttribute('class').indexOf('br-mod') >= 0)) m = m.parentNode;
      if (m && m !== this) { openDetail(m.getAttribute('data-file')); return; }
      var h = e.target;
      while (h && h !== this && !(h.getAttribute && h.getAttribute('class') && h.getAttribute('class').indexOf('br-asset-h') >= 0)) h = h.parentNode;
      if (h && h !== this) {
        var card = h.parentNode, name = card.getAttribute('data-name');
        state.open[name] = !state.open[name];
        card.className = 'br-asset' + (state.open[name] ? ' open' : '');
      }
    });
    renderMap();
    renderTree();
  })();
})();
</script>
</body>
</html>`
}
