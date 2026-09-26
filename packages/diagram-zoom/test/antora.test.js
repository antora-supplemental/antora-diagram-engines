'use strict'

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const { ASSETS, UI_ROOT } = require('../lib/antora')._internal

describe('diagram-zoom package', () => {
  it('ships expected UI assets on disk', () => {
    for (const asset of ASSETS) {
      const abs = path.join(UI_ROOT, asset.rel)
      assert.ok(fs.existsSync(abs), `missing ${asset.rel}`)
    }
  })
})
