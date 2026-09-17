const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213',
  '122312', '132212', '221213', '221312', '231212', '112232', '122132',
  '122231', '113222', '123122', '123221', '223211', '221132', '221231',
  '213212', '223112', '312131', '311222', '321122', '321221', '312212',
  '322112', '322211', '212123', '212321', '232121', '111323', '131123',
  '131321', '112313', '132113', '132311', '211313', '231113', '231311',
  '112133', '112331', '132131', '113123', '113321', '133121', '313121',
  '211331', '231131', '213113', '213311', '213131', '311123', '311321',
  '331121', '312113', '312311', '332111', '314111', '221411', '431111',
  '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114',
  '413111', '241112', '134111', '111242', '121142', '121241', '114212',
  '124112', '124211', '411212', '421112', '421211', '212141', '214121',
  '412121', '111143', '111341', '131141', '114113', '114311', '411113',
  '411311', '113141', '114131', '311141', '411131', '211412', '211214',
  '211232', '2331112',
];

export const LABEL_DPI = 203;

export const LABEL_SIZES = {
  standard: { label: 'ملصق 50 × 30 مم', widthMm: 50, heightMm: 30 },
  roll80: { label: 'رول 80 مم', widthMm: 80, heightMm: 30 },
} as const;

export type LabelSizeName = keyof typeof LABEL_SIZES;

export function mmToDots(mm: number): number {
  return Math.round((mm / 25.4) * LABEL_DPI);
}

export function dotsToMm(dots: number): number {
  return (dots / LABEL_DPI) * 25.4;
}

export function encodeCode128B(value: string): string {
  if (!value || !/^[\x20-\x7e]+$/.test(value)) {
    throw new Error('Code128-B supports printable ASCII characters only.');
  }

  const codes = [...value].map((char) => char.charCodeAt(0) - 32);
  const checksum =
    (104 + codes.reduce((sum, code, index) => sum + code * (index + 1), 0)) %
    103;
  const symbols = [104, ...codes, checksum, 106];
  let modules = '0'.repeat(10);

  for (const symbol of symbols) {
    const widths = CODE128_PATTERNS[symbol];
    let bar = true;
    for (const width of widths) {
      modules += (bar ? '1' : '0').repeat(Number(width));
      bar = !bar;
    }
  }

  return modules + '0'.repeat(10);
}

export async function renderLabelPng(options: {
  itemName: string;
  price: string;
  code: string;
  size: LabelSizeName;
}): Promise<{ dataUrl: string; widthPx: number; heightPx: number }> {
  await document.fonts?.ready;
  const size = LABEL_SIZES[options.size];
  const widthPx = mmToDots(size.widthMm);
  const heightPx = mmToDots(size.heightMm);
  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas is unavailable.');
  }

  context.imageSmoothingEnabled = false;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, widthPx, heightPx);
  context.fillStyle = '#000000';
  context.textAlign = 'center';
  context.direction = 'rtl';
  context.font = '600 24px Alexandria, sans-serif';
  context.fillText(options.itemName.slice(0, 38), widthPx / 2, 30);
  context.font = '700 24px Alexandria, sans-serif';
  context.fillText(options.price, widthPx / 2, 61);

  const modules = encodeCode128B(options.code);
  const availableWidth = widthPx - 16;
  const moduleWidth = Math.floor(availableWidth / modules.length);
  if (moduleWidth < 1) {
    throw new Error('Barcode value is too long for this label size.');
  }

  const barcodeWidth = modules.length * moduleWidth;
  const startX = Math.floor((widthPx - barcodeWidth) / 2);
  const barcodeTop = 74;
  const barcodeHeight = Math.max(70, heightPx - 112);
  for (let index = 0; index < modules.length; index++) {
    if (modules[index] === '1') {
      context.fillRect(
        startX + index * moduleWidth,
        barcodeTop,
        moduleWidth,
        barcodeHeight
      );
    }
  }

  context.direction = 'ltr';
  context.font = '18px monospace';
  context.fillText(options.code, widthPx / 2, heightPx - 12);
  return { dataUrl: canvas.toDataURL('image/png'), widthPx, heightPx };
}
