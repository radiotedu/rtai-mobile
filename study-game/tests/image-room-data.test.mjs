import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateImageRoomData } from '../scripts/generate-image-room-data.mjs'

const studyRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('packages image-room generator inputs inside the standalone Study package', async () => {
  const sourceRoot = path.join(studyRoot, 'scripts', 'image-room-source')
  const requiredInputs = [
    path.join(sourceRoot, 'app.js'),
    path.join(sourceRoot, 'chim.js'),
    path.join(sourceRoot, 'data', 'library-habbo-map-mask.json'),
    path.join(studyRoot, 'src', 'rooms', 'data', 'chim-alan-amphitheatre-layout.json'),
  ]
  const missingInputs = []

  for (const inputPath of requiredInputs) {
    try {
      await access(inputPath)
    } catch {
      missingInputs.push(path.relative(studyRoot, inputPath))
    }
  }

  assert.deepEqual(missingInputs, [])
})

test('generates layered widescreen Library and Chim Alan navigation data', async () => {
  const outputDir = await mkdtemp(path.join(tmpdir(), 'rtjukebox-image-rooms-'))
  const outputPath = path.join(outputDir, 'image-rooms.generated.json')
  const assetOutputRoot = path.join(outputDir, 'occlusion')
  try {
    await generateImageRoomData(outputPath, assetOutputRoot)
    const data = JSON.parse(await readFile(outputPath, 'utf8'))
    const library = data.rooms.library
    const chim = data.rooms['chim-alan']

    assert.equal(library.image.width, 1672)
    assert.equal(library.image.height, 941)
    assert.equal(library.image.sha256, '50d1b58448c156cc6c47b823b450ffb26c43815ff6f346f27b6f1705b2d8c993')
    assert.ok(library.nodes.length >= 40)
    assert.equal(library.seats.length, 51)
    assert.ok(library.occluders.length >= 10)
    assert.match(library.occluders[0].asset.url, /^assets\/rooms\/occlusion\/library\//)
    assert.ok(library.seats.every((seat) => seat.foregroundAsset?.url))
    await access(path.join(assetOutputRoot, 'library', path.basename(library.occluders[0].asset.url)))

    assert.equal(chim.image.width, 1672)
    assert.equal(chim.image.height, 941)
    assert.equal(chim.image.sha256, 'abb1df4376645a611549a2a95fb698cab9ccb4d192805779b5e31047ea378abe')
    assert.equal(chim.seats.length, 9)
    assert.ok(chim.occluders.length >= 3)
    assert.ok(chim.seats.every((seat) => seat.foregroundAsset?.url))
    assert.ok(chim.seats.every((seat) => seat.hitArea?.length === 4))
    assert.ok(chim.seats.every((seat) => seat.approach && seat.actorAnchor))
    assert.ok(chim.nodes.some((node) => node.id === 'right-stair-3'))
    assert.deepEqual(new Set(chim.nodes.map((node) => node.z)), new Set([0, 1, 2, 3]))

    for (const room of [library, chim]) {
      const ids = new Set(room.nodes.map((node) => node.id))
      assert.equal(ids.size, room.nodes.length)
      assert.ok(ids.has(room.spawnNodeId))
      for (const edge of room.edges) {
        assert.ok(ids.has(edge.from), `${room.id} edge from ${edge.from}`)
        assert.ok(ids.has(edge.to), `${room.id} edge to ${edge.to}`)
        const from = room.nodes.find((node) => node.id === edge.from)
        const to = room.nodes.find((node) => node.id === edge.to)
        if (from.z !== to.z) assert.equal(edge.kind, 'stair')
      }
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
})
