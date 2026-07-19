import type { MapElement, ProjectData } from './types';
export const uid = () => crypto.randomUUID();
export const elementLabel = (index: number) => String.fromCharCode(65 + (index % 26));
export const slugify = (value: string) => value.trim().replace(/\s+/g, '-').replace(/[^\w.-]+/g, '').toLowerCase() || 'promptmap';

export function compilePrompt(globalPrompt: string, elements: MapElement[]) {
  const lines = [
    'Use the attached annotated image as a strict composition reference.',
    globalPrompt.trim() ? `Overall direction: ${globalPrompt.trim()}` : '',
    '',
    ...elements.map((e) => {
      const placement = e.type === 'pin'
        ? `point at x=${Math.round(e.x * 100)}%, y=${Math.round(e.y * 100)}%`
        : `region x=${Math.round(e.x * 100)}%, y=${Math.round(e.y * 100)}%, width=${Math.round((e.width ?? 0) * 100)}%, height=${Math.round((e.height ?? 0) * 100)}%`;
      return `${e.label}: ${e.prompt || 'Place the intended element here.'}\nPlacement: ${placement}\nConstraint: ${e.strength}; overflow ${e.allowOverflow ? 'allowed' : 'not allowed'}; aspect ratio ${e.preserveAspectRatio ? 'preserved' : 'flexible'}.`;
    }),
    '',
    'Do not significantly move exact or near elements outside their assigned positions. Preserve the supplied background unless explicitly instructed otherwise.'
  ];
  return lines.filter((line, i, arr) => line !== '' || arr[i - 1] !== '').join('\n');
}
export function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  downloadBlob(filename, blob);
}
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
}
export function makeProject(name: string, globalPrompt: string, elements: MapElement[], imageName?: string): ProjectData {
  return { version: 1, name, globalPrompt, elements, imageName };
}

type ZipEntry = {
  path: string;
  data: Blob | ArrayBuffer | Uint8Array | string;
};

const textEncoder = new TextEncoder();
let crcTable: Uint32Array | undefined;

function getCrcTable() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    crcTable[i] = value >>> 0;
  }
  return crcTable;
}

function crc32(bytes: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeHeader(size: number, writer: (view: DataView) => void) {
  const bytes = new Uint8Array(size);
  writer(new DataView(bytes.buffer));
  return bytes;
}

function dosTimestamp(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

async function entryDataBytes(data: ZipEntry['data']) {
  if (typeof data === 'string') return textEncoder.encode(data);
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await data.arrayBuffer());
}

export async function createZip(entries: ZipEntry[]) {
  const chunks: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;
  const stamp = dosTimestamp();

  for (const entry of entries) {
    const name = textEncoder.encode(entry.path.replaceAll('\\', '/'));
    const data = await entryDataBytes(entry.data);
    const crc = crc32(data);

    const localHeader = writeHeader(30, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, stamp.time, true);
      view.setUint16(12, stamp.date, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, name.length, true);
      view.setUint16(28, 0, true);
    });
    chunks.push(localHeader, name, data);

    const centralHeader = writeHeader(46, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, stamp.time, true);
      view.setUint16(14, stamp.date, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, data.length, true);
      view.setUint32(24, data.length, true);
      view.setUint16(28, name.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, offset, true);
    });
    centralDirectory.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectorySize = centralDirectory.reduce((size, chunk) => size + chunk.length, 0);
  const endRecord = writeHeader(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralDirectorySize, true);
    view.setUint32(16, centralDirectoryOffset, true);
    view.setUint16(20, 0, true);
  });

  const parts = [...chunks, ...centralDirectory, endRecord].map((chunk) => {
    const copy = new Uint8Array(chunk.length);
    copy.set(chunk);
    return copy.buffer;
  });
  return new Blob(parts, { type: 'application/zip' });
}
