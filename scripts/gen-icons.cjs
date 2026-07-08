// Gera ícones PWA como PNGs a partir do SVG
// Uso: node scripts/gen-icons.cjs
// Requer: npm install sharp (opcional, para PNGs de alta qualidade)

const fs = require('fs')
const path = require('path')

const iconsDir = path.join(__dirname, '..', 'public', 'icons')

// Cria um PNG válido minimalista (quadrado verde)
function createGreenPNG(size) {
  // PNG file structure: signature + IHDR + IDAT + IEND
  // Using a simple uncompressed approach for a solid color

  const width = size
  const height = size

  // Raw image data: each row has filter byte (0) + RGBA pixels
  const rawData = []
  for (let y = 0; y < height; y++) {
    rawData.push(0) // filter: None
    for (let x = 0; x < width; x++) {
      // Rounded corners: make corner pixels transparent
      const cornerRadius = size * 0.19 // ~96/512 ratio
      const inCorner = (cx, cy) => {
        const dx = x - cx
        const dy = y - cy
        return dx * dx + dy * dy > cornerRadius * cornerRadius
      }

      const isCorner =
        (x < cornerRadius && y < cornerRadius && inCorner(0, 0)) ||
        (x >= width - cornerRadius &&
          y < cornerRadius &&
          inCorner(width - 1, 0)) ||
        (x < cornerRadius &&
          y >= height - cornerRadius &&
          inCorner(0, height - 1)) ||
        (x >= width - cornerRadius &&
          y >= height - cornerRadius &&
          inCorner(width - 1, height - 1))

      if (isCorner) {
        rawData.push(0, 0, 0, 0) // transparent
      } else {
        rawData.push(22, 163, 74, 255) // #16a34a
      }
    }
  }

  const raw = Buffer.from(rawData)

  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // Helper to create CRC32
  function crc32(buf) {
    let crc = 0xffffffff
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i]
      for (let j = 0; j < 8; j++) {
        crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0)
      }
    }
    return (crc ^ 0xffffffff) >>> 0
  }

  function chunk(type, data) {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeData = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(typeData))
    return Buffer.concat([len, typeData, crc])
  }

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // Compress raw data with zlib (store mode for simplicity)
  const zlib = require('zlib')
  const compressed = zlib.deflateSync(raw)

  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

// Generate icons
const sizes = [192, 512]
for (const size of sizes) {
  const png = createGreenPNG(size)
  const outPath = path.join(iconsDir, `icon-${size}x${size}.png`)
  fs.writeFileSync(outPath, png)
  console.log(`Gerado: ${outPath} (${png.length} bytes)`)
}

console.log('\nÍcones gerados! Para ícones de melhor qualidade, use ferramentas como')
console.log('  - https://maskable.app/')
console.log('  - https://www.pwabuilder.com/imageGenerator')
console.log('  - ou exporte o SVG como PNG com 192x192 e 512x512')
