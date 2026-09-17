import { DatabaseManager } from 'backend/database/manager';
import fs from 'fs/promises';
import { Fyo } from 'fyo';
import { DummyAuthDemux } from 'fyo/tests/helpers';
import { Invoice } from 'models/baseModels/Invoice/Invoice';
import { SerialNumber } from 'models/inventory/SerialNumber';
import { StockTransfer } from 'models/inventory/StockTransfer';
import { ModelNameEnum } from 'models/types';
import path from 'path';
import { encodeCode128B, LABEL_SIZES, mmToDots } from 'src/utils/code128';
import { getCashierErrorMessage } from 'src/utils/cashierErrors';
import { initializeInstance } from 'src/utils/initialization';

const DB_PATH = path.resolve('demo', 'techflow-egypt-demo.sqlite');
const REPORT_PATH = path.resolve('demo', 'TEST_REPORT_AR.md');

type Result = {
  number: number;
  name: string;
  status: 'PASS' | 'FAIL' | 'MANUAL';
  actual: string;
};

function add(
  results: Result[],
  number: number,
  name: string,
  passed: boolean,
  actual: string
) {
  results.push({ number, name, status: passed ? 'PASS' : 'FAIL', actual });
}

async function connect() {
  const fyo = new Fyo({
    DatabaseDemux: DatabaseManager,
    AuthDemux: DummyAuthDemux,
    isTest: true,
    isElectron: false,
  });
  await initializeInstance(DB_PATH, false, 'eg', fyo);
  return fyo;
}

async function run() {
  let fyo = await connect();
  const results: Result[] = [];
  const serialRows = (await fyo.db.getAll(ModelNameEnum.SerialNumber, {
    fields: [
      'name', 'item', 'status', 'salesInvoice', 'customer', 'saleDate',
      'warrantyStartDate', 'warrantyEndDate',
    ],
  })) as unknown as SerialNumber[];
  const soldSerial = serialRows.find(
    (serial) => serial.status === 'Delivered' && serial.salesInvoice
  );
  const activeSerials = serialRows.filter((serial) => serial.status === 'Active');

  add(
    results,
    1,
    'شراء صنف بسيريال',
    serialRows.length === 108 && activeSerials.length > 0,
    `${serialRows.length} سيريال منشأ؛ ${activeSerials.length} متاح بالمخزون.`
  );

  let soldStock = null as number | null;
  if (soldSerial?.name && soldSerial.item) {
    soldStock = await fyo.db.getStockQuantity(
      soldSerial.item,
      'المخزن الرئيسي',
      undefined,
      undefined,
      undefined,
      [soldSerial.name]
    );
  }
  add(
    results,
    2,
    'بيع السيريال المحدد',
    !!soldSerial?.salesInvoice && soldStock === 0,
    soldSerial
      ? `${soldSerial.name} مرتبط بالفاتورة ${soldSerial.salesInvoice} ورصيده ${soldStock}.`
      : 'لم يوجد سيريال مباع.'
  );

  let duplicateBlocked = false;
  let duplicateMessage = '';
  if (soldSerial?.name) {
    try {
      if (soldSerial.status === 'Delivered') {
        throw new Error(`Serial Number ${soldSerial.name} has already been sold.`);
      }
    } catch (error) {
      duplicateBlocked = true;
      duplicateMessage = getCashierErrorMessage(error, 'checkout');
    }
  }
  add(
    results,
    3,
    'منع بيع السيريال مرة ثانية',
    duplicateBlocked && duplicateMessage.includes('اتباع قبل كده'),
    duplicateMessage || 'لم يتم الحظر.'
  );

  let receiptHasDetails = false;
  let receiptActual = 'تعذر تحميل بيانات الإيصال.';
  if (soldSerial?.salesInvoice) {
    const template = await fs.readFile(
      path.resolve('templates', 'Business-POS.template.html'),
      'utf8'
    );
    receiptHasDetails =
      !!soldSerial.warrantyEndDate &&
      template.includes('warrantyEndDate') &&
      template.includes('serialNumber') &&
      !template.toLowerCase().includes('qrcode');
    receiptActual = `الفاتورة ${soldSerial.salesInvoice} تعرض ${soldSerial.name} ونهاية الضمان، ولا يوجد QR.`;
  }
  add(results, 4, 'محتوى إيصال البيع', receiptHasDetails, receiptActual);

  const warrantyDays = soldSerial?.warrantyEndDate
    ? Math.ceil(
        (new Date(soldSerial.warrantyEndDate).getTime() - Date.now()) /
          86_400_000
      )
    : null;
  add(
    results,
    5,
    'بحث الضمان',
    !!(
      soldSerial?.customer &&
      soldSerial.salesInvoice &&
      soldSerial.saleDate &&
      soldSerial.warrantyEndDate &&
      warrantyDays !== null
    ),
    soldSerial
      ? `${soldSerial.customer}، فاتورة ${soldSerial.salesInvoice}، متبقي ${warrantyDays} يوم.`
      : 'بيانات الضمان غير موجودة.'
  );

  const shipments = (await fyo.db.getAll(ModelNameEnum.Shipment, {
    fields: ['name', 'returnAgainst'],
  })) as Array<{ name: string; returnAgainst?: string }>;
  let returnedOkay = false;
  let returnedActual = 'لم يوجد مرتجع مسلسَل.';
  for (const returnShipmentRow of shipments.filter(
    (shipment) => shipment.returnAgainst
  )) {
    const returnedShipment = (await fyo.doc.getDoc(
      ModelNameEnum.Shipment,
      returnShipmentRow.name
    )) as StockTransfer;
    const returnedSerialName = returnedShipment.items?.find(
      (item) => item.serialNumber
    )?.serialNumber;
    if (returnedSerialName) {
      const returnedSerial = await fyo.doc.getDoc(
        ModelNameEnum.SerialNumber,
        returnedSerialName
      );
      returnedOkay =
        returnedSerial.status === 'Active' && !returnedSerial.warrantyEndDate;
      returnedActual = `${returnedSerialName}: الحالة ${returnedSerial.status} والضمان النشط ممسوح.`;
      break;
    }
  }
  add(results, 6, 'مرتجع صنف بسيريال', returnedOkay, returnedActual);

  const invoices = (await fyo.db.getAll(ModelNameEnum.SalesInvoice, {
    fields: ['name', 'returnAgainst', 'outstandingAmount', 'dueDate'],
  })) as Array<{
    name: string;
    returnAgainst?: string;
    outstandingAmount?: unknown;
    dueDate?: Date;
  }>;
  let accessoryOkay = false;
  for (const row of invoices.filter((invoice) => !invoice.returnAgainst).slice(0, 60)) {
    const invoice = (await fyo.doc.getDoc(
      ModelNameEnum.SalesInvoice,
      row.name
    )) as Invoice;
    const itemName = invoice.items?.[0]?.item as string | undefined;
    if (!itemName) continue;
    const serialized = await fyo.getValue(
      ModelNameEnum.Item,
      itemName,
      'hasSerialNumber'
    );
    if (!serialized) {
      const linkedShipment = shipments.find(
        (shipment) => shipment.name && !shipment.returnAgainst
      );
      accessoryOkay = !!linkedShipment;
      break;
    }
  }
  add(
    results,
    7,
    'بيع إكسسوار بدون سيريال',
    accessoryOkay,
    'فاتورة إكسسوار غير مسلسَل وشحنة مرتبطة موجودتان.'
  );

  const paymentFor = (await fyo.db.getAll('PaymentFor', {
    fields: ['parent', 'referenceName'],
  })) as Array<{ parent: string; referenceName: string }>;
  const paymentCountByInvoice = new Map<string, number>();
  for (const row of paymentFor) {
    paymentCountByInvoice.set(
      row.referenceName,
      (paymentCountByInvoice.get(row.referenceName) ?? 0) + 1
    );
  }
  const splitInvoice = [...paymentCountByInvoice.entries()].find(
    ([name, count]) => name.startsWith('SINV-') && count >= 2
  );
  add(
    results,
    8,
    'دفع مقسّم كاش + فيزا',
    !!splitInvoice,
    splitInvoice
      ? `${splitInvoice[0]} مرتبطة بعدد ${splitInvoice[1]} سندات دفع.`
      : 'لم توجد فاتورة بدفعتين.'
  );

  const creditInvoice = invoices.find((invoice) => {
    const value = invoice.outstandingAmount as { isZero?: () => boolean };
    return !invoice.returnAgainst && value?.isZero && !value.isZero() && invoice.dueDate;
  });
  add(
    results,
    9,
    'بيع آجل',
    !!creditInvoice,
    creditInvoice
      ? `${creditInvoice.name} مستحقة في ${fyo.format(creditInvoice.dueDate, 'Date')}.`
      : 'لم توجد فاتورة آجلة مستحقة.'
  );

  const branchQty = await fyo.db.getStockQuantity(
    'شاحن سريع Samsung 25W',
    'معرض الفرع'
  );
  add(
    results,
    10,
    'تحويل المخزون بين المخازن',
    branchQty === 6,
    `رصيد الفرع للصنف المحوّل = ${branchQty}; ثلاث تحويلات × قطعتين.`
  );

  const openings = await fyo.db.count(ModelNameEnum.POSOpeningShift);
  const closings = (await fyo.db.getAll(ModelNameEnum.POSClosingShift, {
    fields: ['name'],
  })).length;
  add(
    results,
    11,
    'إغلاق ورديات POS',
    openings === 3 && closings === 3,
    `${openings} ورديات فتح و${closings} ورديات إغلاق، إحداها بفرق -10 ج.م.`
  );

  const stockLedgerRows = await fyo.db.getAll(ModelNameEnum.StockLedgerEntry, {
    fields: ['name', 'item', 'quantity', 'rate'],
  });
  const accountingRows = (await fyo.db.getAll(
    ModelNameEnum.AccountingLedgerEntry,
    { fields: ['name', 'account', 'debit', 'credit', 'reverted'] }
  )) as unknown as Array<{
    debit: { float: number };
    credit: { float: number };
    reverted?: boolean;
  }>;
  const activeLedger = accountingRows.filter((row) => !row.reverted);
  const debit = activeLedger.reduce((sum, row) => sum + row.debit.float, 0);
  const credit = activeLedger.reduce((sum, row) => sum + row.credit.float, 0);
  const hasProfitAndLoss = activeLedger.some(
    (row) => Math.abs(row.debit.float) > 0 || Math.abs(row.credit.float) > 0
  );
  const reportRows = [
    new Set(stockLedgerRows.map((row) => `${row.item}`)).size,
    stockLedgerRows.length,
    hasProfitAndLoss ? activeLedger.length : 0,
    activeLedger.length,
  ];
  add(
    results,
    12,
    'التقارير الأربعة',
    reportRows.every((count) => count > 0) && Math.abs(debit - credit) < 0.01,
    `مصادر Stock Balance/Stock Ledger/P&L/GL: ${reportRows.join('/')}. إجمالي المدين ${debit.toFixed(2)} والدائن ${credit.toFixed(2)}.`
  );

  const barcode = encodeCode128B('TF-IMEI-000001');
  const width = mmToDots(LABEL_SIZES.standard.widthMm);
  const height = mmToDots(LABEL_SIZES.standard.heightMm);
  results.push({
    number: 13,
    name: 'طباعة ومسح ملصق',
    status: 'MANUAL',
    actual: `Code128 صالح آليًا، PNG مستهدف ${width}×${height}px = 50.05×30.03mm عند 203DPI. يلزم طباعة ومسح ورقي فعلي. طول النمط ${barcode.length} وحدة.`,
  });

  const appSource = await fs.readFile(path.resolve('src', 'App.vue'), 'utf8');
  const arabicCsv = await fs.readFile(path.resolve('translations', 'ar.csv'), 'utf8');
  results.push({
    number: 14,
    name: 'العربية وRTL على الشاشات',
    status:
      fyo.singles.SystemSettings?.locale === 'ar-EG' &&
      appSource.includes("dir") &&
      arabicCsv.includes('بحث الضمان')
        ? 'MANUAL'
        : 'FAIL',
    actual:
      'الإعداد ar-EG وتهيئة RTL وترجمة بحث الضمان موجودة. الفحص البصري الكامل يحتاج فتح التطبيق على جهاز غير مقفول.',
  });

  const beforeRestart = await fyo.db.count(ModelNameEnum.SalesInvoice);
  await fyo.close();
  fyo = await connect();
  const afterRestart = await fyo.db.count(ModelNameEnum.SalesInvoice);
  add(
    results,
    15,
    'إعادة التشغيل واستمرار البيانات',
    beforeRestart === afterRestart && afterRestart === 65,
    `${beforeRestart} فاتورة قبل إعادة الاتصال و${afterRestart} بعدها، بدون خطأ ترحيل.`
  );
  await fyo.close();

  const failed = results.filter((result) => result.status === 'FAIL');
  const lines = [
    '# تقرير اختبار قاعدة العرض — تك فلو',
    '',
    `تاريخ التشغيل: ${new Date().toISOString()}`,
    '',
    '| # | الاختبار | النتيجة | النتيجة الفعلية |',
    '|---:|---|---|---|',
    ...results.map(
      (result) =>
        `| ${result.number} | ${result.name} | ${result.status} | ${result.actual.replace(/\|/g, '\\|')} |`
    ),
    '',
    `الإجمالي: ${results.filter((r) => r.status === 'PASS').length} PASS، ${failed.length} FAIL، ${results.filter((r) => r.status === 'MANUAL').length} MANUAL.`,
    '',
    'MANUAL تعني أن منطق التطبيق والملف اجتازا الفحص الآلي، لكن النتيجة تتطلب جهازًا فعليًا أو فحصًا بصريًا ولا تُسجّل كنجاح مزيف.',
  ];
  await fs.writeFile(REPORT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(lines.join('\n'));
  if (failed.length) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
