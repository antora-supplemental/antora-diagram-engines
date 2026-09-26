'use strict'

/**
 * Antora extension: inject diagram lightbox (zoom/pan) JS+CSS into the UI catalog.
 *
 * Playbook:
 *   antora:
 *     extensions:
 *       - require: '@antora-supplemental/diagram-lightbox'
 *         # injectAssets: true
 *
 * Include partials in the theme:
 *   {{> diagram-lightbox-styles}}
 *   {{> diagram-lightbox-scripts}}  (after SoftNav)
 */

const path = require('node:path')
const {
  truthy,
  addUiAssets,
  ensureAttributes,
} = require('@antora-supplemental/diagram-engines-shared')

const PACKAGE = '@antora-supplemental/diagram-lightbox'
const UI_ROOT = path.join(__dirname, '..', 'ui')
const ASSETS = [
  { rel: 'js/site-diagram-lightbox.js', type: 'asset' },
  { rel: 'css/site-diagram-lightbox.css', type: 'asset' },
  { rel: 'partials/diagram-lightbox-styles.hbs', type: 'partial' },
  { rel: 'partials/diagram-lightbox-scripts.hbs', type: 'partial' },
]

function register (context = {}) {
  const config = context.config || {}
  const injectAssets = truthy(config.injectAssets, true)
  const logger = this.getLogger(PACKAGE)

  this.on('playbookBuilt', ({ playbook }) => {
    ensureAttributes(playbook, { 'diagram-lightbox': '' })
    const keys = playbook.site.keys || (playbook.site.keys = {})
    keys.diagram_lightbox = 'true'
  })

  if (injectAssets) {
    this.on('uiLoaded', ({ uiCatalog }) => {
      addUiAssets(uiCatalog, UI_ROOT, ASSETS, logger)
    })
  }
}

module.exports = register
module.exports.register = register
module.exports._internal = { PACKAGE, UI_ROOT, ASSETS }
