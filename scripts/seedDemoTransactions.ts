import { DatabaseManager } from 'backend/database/manager';
import { Fyo } from 'fyo';
import { DocValueMap } from 'fyo/core/types';
import { DummyAuthDemux } from 'fyo/tests/helpers';
import { Invoice } from 'models/baseModels/Invoice/Invoice';
import { Payment } from 'models/baseModels/Payment/Payment';
import { SalesQuote } from 'models/baseModels/SalesQuote/SalesQuote';
import { StockMovement } from 'models/inventory/StockMovement';
import { StockTransfer } from 'models/inventory/StockTransfer';
import { MovementTypeEnum } from 'models/inventory/types';
import { ModelNameEnum } from 'models/types';
import path from 'path';
import { initializeInstance } from 'src/utils/initialization';
import { DEMO_ITEMS } from './seedDemo';

const DEFAULT_DB = path.resolve('demo', 'techflow-egypt-demo.sqlite');
const MAIN_LOCATION = 'المخزن الرئيسي';
const BRANCH_LOCATION = 'معرض الفرع';
const suppliers = [
  'دلتا للتوزيع الإلكتروني', 'النيل لتجارة المحمول', 'القاهرة للحاسبات',
  'المتحدة للإكسسوارات', 'الإسكندرية لقطع الغيار',
];
const customers = [
  'أحمد محمد علي', 'محمود حسن', 'سارة إبراهيم', 'منى السيد', 'عمر خالد',
  'يوسف مصطفى', 'نورهان عادل', 'محمد أشرف', 'ريم وائل', 'كريم طارق',
  'هبة سامي', 'عبد الرحمن جمال', 'فاطمة أحمد',
  'شركة المستقبل للتوريدات', 'مؤسسة النور للخدمات',
];

function daysAgo(days: number, hour = 12) {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

async function payInvoice(
  invoice: Invoice,
  paymentMethod: string,
  fraction = 1
) {
  const payment = invoice.getPayment() as Payment | null;
  if (!payment) {
    return;
  }
  const isCash = paymentMethod === 'كاش';
  const account = isCash ? 'Cash In Hand' : 'حساب تك فلو البنكي';
  const amount = (payment.amount as ReturnType<Fyo['pesa']>).mul(fraction);
  await payment.setMultiple({
    date: invoice.date,
    paymentMethod,
    amount,
    referenceId: isCash ? null : `DEMO-${invoice.name}`,
    clearanceDate: isCash ? null : invoice.date,
  });
  if (invoice.schemaName === ModelNameEnum.SalesInvoice) {
    await payment.set('paymentAccount', account);
  } else {
    await payment.set('account', account);
  }
  if (fraction !== 1 && payment.for?.[0]) {
    await payment.for[0].set('amount', amount);
  }
  await (await payment.sync()).submit();
}

async function createPurchaseInvoices(fyo: Fyo) {
  const serials = new Map<string, string[]>();
  for (let index = 0; index < 12; index++) {
    const picked = Array.from({ length: 4 }, (_, offset) =>
      DEMO_ITEMS[(index * 4 + offset) % DEMO_ITEMS.length]
    );
    const date = daysAgo(95 - index);
    const invoice = fyo.doc.getNewDoc(ModelNameEnum.PurchaseInvoice) as Invoice;
    await invoice.set({
      party: suppliers[index % suppliers.length],
      account: 'Creditors',
      date,
    });
    for (const item of picked) {
      await invoice.append('items', {
        item: item.name,
        quantity: item.serialized ? 4 : 24,
        rate: item.cost,
        tax: 'ضريبة قيمة مضافة 14%',
      });
    }
    await (await invoice.sync()).submit();

    const receipt = (await invoice.getStockTransfer()) as StockTransfer | null;
    if (!receipt?.items) {
      throw new Error(`Purchase receipt missing for ${invoice.name}`);
    }
    await receipt.set('date', date);
    for (const row of receipt.items) {
      const item = DEMO_ITEMS.find(({ name }) => name === row.item)!;
      const values: DocValueMap = { location: MAIN_LOCATION };
      if (item.serialized) {
        const names = Array.from(
          { length: row.quantity as number },
          (_, serialIndex) =>
            `TF${String(index + 1).padStart(2, '0')}${String(
              DEMO_ITEMS.indexOf(item) + 1
            ).padStart(3, '0')}${String(serialIndex + 1).padStart(3, '0')}`
        );
        values.serialNumber = names.join('\n');
        serials.set(item.name, [...(serials.get(item.name) ?? []), ...names]);
      }
      await row.setMultiple(values);
    }
    await (await receipt.sync()).submit();

    if (index < 11) {
      await payInvoice(invoice, index % 3 === 0 ? 'تحويل بنكي' : 'كاش', index === 10 ? 0.5 : 1);
    }
  }
  return serials;
}

async function createSalesInvoices(fyo: Fyo, serials: Map<string, string[]>) {
  const invoices: Invoice[] = [];
  const serialized = DEMO_ITEMS.filter((item) => item.serialized);
  const regular = DEMO_ITEMS.filter((item) => !item.serialized);
  for (let index = 0; index < 60; index++) {
    const item = index < serialized.length
      ? serialized[index]
      : regular[(index - serialized.length) % regular.length];
    const date = daysAgo(82 - index, 10 + (index % 8));
    const invoice = fyo.doc.getNewDoc(ModelNameEnum.SalesInvoice) as Invoice;
    await invoice.set({
      party: customers[index % customers.length],
      account: 'Debtors',
      date,
      dueDate: index === 8 ? daysAgo(52) : date,
      isPOS: index !== 8,
    });
    await invoice.append('items', {
      item: item.name,
      quantity: item.serialized ? 1 : index % 7 === 0 ? 2 : 1,
      rate: item.rate,
      tax: index % 12 === 0 ? 'معفى من الضريبة 0%' : 'ضريبة قيمة مضافة 14%',
      itemDiscountPercent: index % 9 === 0 ? 5 : 0,
    });
    await (await invoice.sync()).submit();

    const shipment = (await invoice.getStockTransfer()) as StockTransfer | null;
    if (!shipment?.items) {
      throw new Error(`Shipment missing for ${invoice.name}`);
    }
    await shipment.set('date', date);
    for (const row of shipment.items) {
      await row.set('location', MAIN_LOCATION);
      if (item.serialized) {
        const serial = serials.get(item.name)?.shift();
        if (!serial) {
          throw new Error(`No demo serial available for ${item.name}`);
        }
        await row.set('serialNumber', serial);
      }
    }
    await (await shipment.sync()).submit();

    if (index !== 8) {
      if (index % 10 === 0) {
        await payInvoice(invoice, 'كاش', 0.5);
        const refreshed = (await fyo.doc.getDoc(
          ModelNameEnum.SalesInvoice,
          invoice.name,
          { skipDocumentCache: true }
        )) as Invoice;
        await payInvoice(refreshed, 'فيزا');
      } else {
        await payInvoice(invoice, index % 4 === 0 ? 'فيزا' : 'كاش');
      }
    }
    invoices.push(invoice);
  }
  return invoices;
}

async function createReturns(fyo: Fyo, invoices: Invoice[]) {
  for (const [position, invoiceIndex] of [0, 25, 30, 35].entries()) {
    const original = invoices[invoiceIndex];
    const shipmentRows = await fyo.db.getAll(ModelNameEnum.Shipment, {
      filters: { backReference: original.name as string },
      fields: ['name'],
    });
    const originalShipment = shipmentRows[0]?.name
      ? ((await fyo.doc.getDoc(
          ModelNameEnum.Shipment,
          shipmentRows[0].name as string
        )) as StockTransfer)
      : null;
    const returnInvoice = await original.getReturnDoc();
    if (!returnInvoice) {
      throw new Error(`Return invoice missing for ${original.name}`);
    }
    if (position === 2 && returnInvoice.items?.[0]) {
      await returnInvoice.items[0].set('quantity', -1);
    }
    await returnInvoice.set('date', daysAgo(10 - position));
    await (await returnInvoice.sync()).submit();
    const receipt = await returnInvoice.getStockTransfer();
    if (receipt?.items) {
      await receipt.set('date', returnInvoice.date);
      for (const row of receipt.items) {
        await row.set('location', MAIN_LOCATION);
        const originalRow = originalShipment?.items?.find(
          (item) => item.item === row.item
        );
        if (originalRow?.serialNumber) {
          await row.set('serialNumber', originalRow.serialNumber);
        }
      }
      await (await receipt.sync()).submit();
    }
  }
}

async function createStockMovements(fyo: Fyo) {
  const item = DEMO_ITEMS.find((row) => !row.serialized)!;
  for (let index = 0; index < 3; index++) {
    const movement = fyo.doc.getNewDoc(ModelNameEnum.StockMovement, {
      movementType: MovementTypeEnum.MaterialTransfer,
      date: daysAgo(38 - index * 9),
    }) as StockMovement;
    await movement.append('items', {
      item: item.name,
      fromLocation: MAIN_LOCATION,
      toLocation: BRANCH_LOCATION,
      quantity: 2,
      rate: item.cost,
    });
    await (await movement.sync()).submit();
  }
  for (const [index, type] of [
    MovementTypeEnum.MaterialIssue,
    MovementTypeEnum.MaterialReceipt,
  ].entries()) {
    const movement = fyo.doc.getNewDoc(ModelNameEnum.StockMovement, {
      movementType: type,
      date: daysAgo(18 - index * 5),
    }) as StockMovement;
    await movement.append('items', {
      item: item.name,
      [type === MovementTypeEnum.MaterialIssue ? 'fromLocation' : 'toLocation']:
        MAIN_LOCATION,
      quantity: 1,
      rate: item.cost,
    });
    await (await movement.sync()).submit();
  }
}

async function createQuotes(fyo: Fyo) {
  for (let index = 0; index < 3; index++) {
    const item = DEMO_ITEMS[22 + index];
    const quote = fyo.doc.getNewDoc(ModelNameEnum.SalesQuote, {
      referenceType: 'Party',
      party: customers[13 + (index % 2)],
      date: daysAgo(20 - index * 4),
      items: [{ item: item.name, quantity: index + 2, rate: item.rate }],
    }) as SalesQuote;
    await (await quote.sync()).submit();
    if (index === 0) {
      const invoice = await quote.getInvoice();
      if (invoice) {
        await invoice.set('date', daysAgo(15));
        await (await invoice.sync()).submit();
      }
    }
  }
}

async function createShifts(fyo: Fyo) {
  for (let index = 0; index < 3; index++) {
    const opening = fyo.doc.getNewDoc(ModelNameEnum.POSOpeningShift, {
      openingDate: daysAgo(65 - index * 20, 9),
      openingAmounts: [
        { paymentMethod: 'كاش', amount: 1000 },
        { paymentMethod: 'فيزا', amount: 0 },
      ],
    });
    await opening.sync();
    const expected = 1000 + index * 250;
    await fyo.doc
      .getNewDoc(ModelNameEnum.POSClosingShift, {
        openingShift: opening.name,
        closingDate: daysAgo(65 - index * 20, 21),
        closingAmounts: [
          {
            paymentMethod: 'كاش',
            openingAmount: 1000,
            expectedAmount: expected,
            closingAmount: index === 2 ? expected - 10 : expected,
            differenceAmount: index === 2 ? -10 : 0,
          },
        ],
      })
      .sync();
  }
}

export async function seedDemoTransactions(dbPath = DEFAULT_DB) {
  const fyo = new Fyo({
    DatabaseDemux: DatabaseManager,
    AuthDemux: DummyAuthDemux,
    isTest: false,
    isElectron: false,
  });
  await initializeInstance(dbPath, false, 'eg', fyo);
  if (await fyo.db.count(ModelNameEnum.SalesInvoice)) {
    throw new Error('Demo transactions already exist. Recreate the demo database first.');
  }
  const serials = await createPurchaseInvoices(fyo);
  const invoices = await createSalesInvoices(fyo, serials);
  await createReturns(fyo, invoices);
  await createStockMovements(fyo);
  await createQuotes(fyo);
  await createShifts(fyo);
  await fyo.close();
  return dbPath;
}

if (require.main === module) {
  const outputIndex = process.argv.indexOf('--output');
  const dbPath =
    outputIndex >= 0 && process.argv[outputIndex + 1]
      ? path.resolve(process.argv[outputIndex + 1])
      : DEFAULT_DB;
  seedDemoTransactions(dbPath)
    .then((file) => console.log(`Demo transactions created: ${file}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
