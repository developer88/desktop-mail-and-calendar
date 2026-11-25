const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decode an 8-bit RGB or RGBA non-interlaced PNG buffer into { width, height, data } (RGBA).
 */
function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Invalid PNG signature');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buf.length) break;

    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf[dataStart + 8];
      colorType = buf[dataStart + 9];
      interlace = buf[dataStart + 12];
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      break;
    }

    offset = dataEnd + 4;
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`Unsupported PNG format (bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace})`);
  }

  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const rgba = Buffer.alloc(width * height * 4);

  let prevRow = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    const filterType = raw[rowStart];
    const row = Buffer.alloc(stride);

    for (let x = 0; x < stride; x++) {
      const val = raw[rowStart + 1 + x];
      const left = x >= bpp ? row[x - bpp] : 0;
      const up = prevRow[x];
      const upLeft = x >= bpp ? prevRow[x - bpp] : 0;

      let decoded;
      switch (filterType) {
        case 0:
          decoded = val;
          break;
        case 1:
          decoded = (val + left) & 0xff;
          break;
        case 2:
          decoded = (val + up) & 0xff;
          break;
        case 3:
          decoded = (val + ((left + up) >> 1)) & 0xff;
          break;
        case 4:
          decoded = (val + paethPredictor(left, up, upLeft)) & 0xff;
          break;
        default:
          throw new Error(`Unsupported PNG filter type ${filterType}`);
      }
      row[x] = decoded;
    }

    const outOffset = y * width * 4;
    if (bpp === 4) {
      row.copy(rgba, outOffset);
    } else {
      for (let px = 0; px < width; px++) {
        rgba[outOffset + px * 4] = row[px * 3];
        rgba[outOffset + px * 4 + 1] = row[px * 3 + 1];
        rgba[outOffset + px * 4 + 2] = row[px * 3 + 2];
        rgba[outOffset + px * 4 + 3] = 255;
      }
    }

    prevRow = row;
  }

  return { width, height, data: rgba };
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Encode RGBA buffer into a valid PNG buffer.
 */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // Filter None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    PNG_SIGNATURE,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

/**
 * Compare two PNG buffers pixel-by-pixel.
 * Returns { width, height, totalPixels, diffPixels, diffPercent, diffPngBuffer }.
 */
function comparePngBuffers(baselineBuf, actualBuf, options = {}) {
  const channelTolerance = options.channelTolerance ?? 12;
  const base = decodePng(baselineBuf);
  const actual = decodePng(actualBuf);

  if (base.width !== actual.width || base.height !== actual.height) {
    throw new Error(
      `Image dimensions mismatch: baseline ${base.width}x${base.height} vs actual ${actual.width}x${actual.height}`
    );
  }

  const totalPixels = base.width * base.height;
  const diffRgba = Buffer.alloc(totalPixels * 4);
  let diffPixels = 0;

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const dr = Math.abs(base.data[idx] - actual.data[idx]);
    const dg = Math.abs(base.data[idx + 1] - actual.data[idx + 1]);
    const db = Math.abs(base.data[idx + 2] - actual.data[idx + 2]);
    const da = Math.abs(base.data[idx + 3] - actual.data[idx + 3]);

    if (dr > channelTolerance || dg > channelTolerance || db > channelTolerance || da > channelTolerance) {
      diffPixels++;
      // Highlight differing pixel in bright magenta
      diffRgba[idx] = 255;
      diffRgba[idx + 1] = 0;
      diffRgba[idx + 2] = 180;
      diffRgba[idx + 3] = 255;
    } else {
      // Dimmed grayscale copy of actual image for context
      const gray = Math.round((actual.data[idx] + actual.data[idx + 1] + actual.data[idx + 2]) / 6);
      diffRgba[idx] = gray;
      diffRgba[idx + 1] = gray;
      diffRgba[idx + 2] = gray;
      diffRgba[idx + 3] = 255;
    }
  }

  const diffPercent = (diffPixels / totalPixels) * 100;
  const diffPngBuffer = diffPixels > 0 ? encodePng(base.width, base.height, diffRgba) : null;

  return {
    width: base.width,
    height: base.height,
    totalPixels,
    diffPixels,
    diffPercent,
    diffPngBuffer
  };
}

module.exports = {
  decodePng,
  encodePng,
  comparePngBuffers
};
