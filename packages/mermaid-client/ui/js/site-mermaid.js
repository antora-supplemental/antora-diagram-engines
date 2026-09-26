/**
 * Render AsciiDoc Mermaid blocks in Antora pages (CDN-first).
 * Supports [source,mermaid], [.mermaid-client], pre.mermaid hosts.
 * Re-renders on dark-theme / prefers-color-scheme changes (no dual SVG forks).
 *
 * Config via window.__ADT_MERMAID__ or #adt-mermaid-config JSON:
 *   { mode: 'cdn'|'local', cdn: 'https://…/mermaid.min.js', localScript: 'js/vendor/…' }
 */
;(function () {
  'use strict'

  var DEFAULT_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11.6.0/dist/mermaid.min.js'

  function readConfig () {
    var cfg = Object.assign({ mode: 'cdn', cdn: DEFAULT_CDN, localScript: null }, window.__ADT_MERMAID__ || {})
    var el = document.getElementById('adt-mermaid-config')
    if (el && el.textContent) {
      try { Object.assign(cfg, JSON.parse(el.textContent)) } catch (_) {}
    }
    return cfg
  }

  function isDark () {
    if (document.documentElement.classList.contains('dark-theme')) return true
    if (document.documentElement.classList.contains('light-theme')) return false
    if (document.documentElement.getAttribute('data-theme') === 'dark') return true
    if (document.documentElement.getAttribute('data-theme') === 'light') return false
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  }

  function looksLikeMermaid (text) {
    var t = String(text || '').trim()
    return /^(flowchart|graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|C4Context|C4Container)\b/.test(t)
  }

  function collectTargets () {
    var nodes = []
    var seen = new Set()
    function add (block, text) {
      if (!block || seen.has(block)) return
      var src = String(text || '').trim()
      if (!src) return
      seen.add(block)
      nodes.push({ block: block, text: src })
    }
    document.querySelectorAll('code.language-mermaid, code[data-lang="mermaid"]').forEach(function (code) {
      add(code.closest('.listingblock') || code.parentElement, code.textContent || '')
    })
    document.querySelectorAll('.listingblock.mermaid-client, .listingblock.adt-mermaid-client').forEach(function (block) {
      var pre = block.querySelector('pre')
      add(block, (pre && pre.textContent) || block.textContent || '')
    })
    document.querySelectorAll('pre.mermaid, .mermaid-source').forEach(function (pre) {
      if (pre.closest('.adt-mermaid') && pre.closest('.adt-mermaid').getAttribute('data-mermaid-rendered') === '1') return
      add(pre.closest('.listingblock') || pre, pre.textContent || '')
    })
    document.querySelectorAll('.listingblock > .content > pre').forEach(function (pre) {
      if (pre.querySelector('code.language-mermaid, code[data-lang="mermaid"]')) return
      var text = pre.textContent || ''
      if (!looksLikeMermaid(text)) return
      add(pre.closest('.listingblock'), text)
    })
    // Already-mounted hosts (re-theme path)
    document.querySelectorAll('.adt-mermaid[data-mermaid-source]').forEach(function (host) {
      if (seen.has(host)) return
      seen.add(host)
      nodes.push({ block: host, text: host.getAttribute('data-mermaid-source') || '', remount: false })
    })
    return nodes
  }

  function mountDiagram (block, text, index) {
    if (block.classList && block.classList.contains('adt-mermaid') && block.getAttribute('data-mermaid-source')) {
      block.removeAttribute('data-processed')
      block.removeAttribute('data-mermaid-rendered')
      block.textContent = text
      return block
    }
    var host = document.createElement('div')
    host.className = 'mermaid adt-mermaid'
    host.setAttribute('data-mermaid-index', String(index))
    host.setAttribute('data-mermaid-source', text)
    host.textContent = text
    block.replaceWith(host)
    return host
  }

  function resolveScriptUrl (cfg) {
    if (cfg.mode === 'local' || cfg.cdn === false || cfg.cdn === 'local') {
      var local = cfg.localScript || 'js/vendor/mermaid.min.js'
      if (/^https?:/i.test(local) || local.charAt(0) === '/') return local
      var root = document.querySelector('script[data-ui-root]')
      var uiRoot = (window.uiRootPath || (root && root.getAttribute('data-ui-root')) || '').replace(/\/$/, '')
      // Prefer Antora layout uiRootPath when present on body data attr
      var bodyRoot = document.body && document.body.dataset && document.body.dataset.uiRoot
      if (bodyRoot) uiRoot = bodyRoot.replace(/\/$/, '')
      // Fallback: derive from any existing /_/js/ script
      if (!uiRoot) {
        var probe = document.querySelector('script[src*="/_/js/"], link[href*="/_/css/"]')
        if (probe) {
          var src = probe.src || probe.href || ''
          var m = src.match(/^(.*)\/_\//)
          if (m) uiRoot = m[1] + '/_'
        }
      }
      if (!uiRoot) uiRoot = '_'
      return uiRoot.replace(/\/$/, '') + '/' + local.replace(/^\//, '')
    }
    return cfg.cdn || DEFAULT_CDN
  }

  function loadScript (src) {
    return new Promise(function (resolve, reject) {
      if (window.mermaid) {
        resolve(window.mermaid)
        return
      }
      var existing = document.querySelector('script[data-adt-mermaid]')
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.mermaid) })
        existing.addEventListener('error', reject)
        return
      }
      var s = document.createElement('script')
      s.src = src
      s.async = true
      s.dataset.adtMermaid = '1'
      s.onload = function () { resolve(window.mermaid) }
      s.onerror = reject
      document.head.appendChild(s)
    })
  }

  var rendering = null

  async function renderAll () {
    var targets = collectTargets()
    if (!targets.length) return
    var cfg = readConfig()
    var mermaid = await loadScript(resolveScriptUrl(cfg))
    var dark = isDark()
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: dark ? 'dark' : 'default',
      flowchart: { htmlLabels: true, curve: 'basis' },
    })
    var hosts = targets.map(function (t, i) { return mountDiagram(t.block, t.text, i) })
    await mermaid.run({ nodes: hosts })
    hosts.forEach(function (h) { h.setAttribute('data-mermaid-rendered', '1') })
  }

  function boot () {
    if (rendering) return rendering
    rendering = renderAll()
      .catch(function (err) { console.warn('[adt-mermaid]', err) })
      .finally(function () { rendering = null })
    return rendering
  }

  function onSoftNavLoaded (fn) {
    if (window.SoftNav && typeof SoftNav.on === 'function') SoftNav.on('loaded', fn)
    else document.addEventListener('soft-nav:loaded', function (e) { fn(e.detail || {}) })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot)
  else boot()
  onSoftNavLoaded(function () { boot() })

  // Re-theme: class toggle (site dark-mode) + prefers-color-scheme
  var lastDark = isDark()
  function maybeRerender () {
    var next = isDark()
    if (next === lastDark) return
    lastDark = next
    document.querySelectorAll('.adt-mermaid[data-mermaid-source]').forEach(function (host) {
      host.removeAttribute('data-mermaid-rendered')
      host.removeAttribute('data-processed')
    })
    boot()
  }
  var obs = new MutationObserver(maybeRerender)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', maybeRerender)
    } catch (_) {
      window.matchMedia('(prefers-color-scheme: dark)').addListener(maybeRerender)
    }
  }
})()
