import test from 'tape';
import {
  dotsToMm,
  encodeCode128B,
  LABEL_SIZES,
  mmToDots,
} from '../code128';

test('Code128-B encoder includes quiet zones and a valid stop symbol', (t) => {
  const modules = encodeCode128B('ABC123');
  t.ok(modules.startsWith('0000000000'), 'left quiet zone is present');
  t.ok(modules.endsWith('2331112'.split('').reduce((bits, width, index) => {
    return bits + (index % 2 === 0 ? '1' : '0').repeat(Number(width));
  }, '') + '0000000000'), 'stop symbol and right quiet zone are present');
  t.equal(modules.length, 121, 'module count includes start, data, checksum and stop');
  t.end();
});

test('203 DPI label dimensions round to whole printer dots', (t) => {
  const width = mmToDots(LABEL_SIZES.standard.widthMm);
  const height = mmToDots(LABEL_SIZES.standard.heightMm);
  t.equal(width, 400, '50 mm label is 400 dots');
  t.equal(height, 240, '30 mm label is 240 dots');
  t.equal(dotsToMm(width).toFixed(2), '50.05', 'actual width is 50.05 mm');
  t.equal(dotsToMm(height).toFixed(2), '30.03', 'actual height is 30.03 mm');
  t.end();
});
