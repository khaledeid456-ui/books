import test from 'tape';
import { getCashierErrorMessage } from '../cashierErrors';

test('cashier errors map critical failures to clear Arabic messages', (t) => {
  t.ok(
    getCashierErrorMessage(
      new Error('SQLITE_BUSY: database is locked'),
      'checkout'
    ).includes('قاعدة البيانات'),
    'database lock is explained in Arabic'
  );
  t.ok(
    getCashierErrorMessage(
      new Error('Insufficient Quantity.'),
      'checkout'
    ).includes('الكمية غير متاحة'),
    'negative stock is explained in Arabic'
  );
  t.ok(
    getCashierErrorMessage(
      new Error('Serial has already been sold'),
      'checkout'
    ).includes('اتباع قبل كده'),
    'sold serial is explained in Arabic'
  );
  t.ok(
    getCashierErrorMessage(new Error('Printer offline'), 'print').includes(
      'الطابعة'
    ),
    'printer failure is explained in Arabic'
  );
  t.end();
});
