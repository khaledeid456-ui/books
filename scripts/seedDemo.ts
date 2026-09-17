import { DatabaseManager } from 'backend/database/manager';
import fs from 'fs/promises';
import { Fyo } from 'fyo';
import { DocValueMap } from 'fyo/core/types';
import { DummyAuthDemux } from 'fyo/tests/helpers';
import { DateTime } from 'luxon';
import path from 'path';
import setupInstance from 'src/setup/setupInstance';

const DEFAULT_OUTPUT = path.resolve('demo', 'techflow-egypt-demo.sqlite');

type DemoItem = {
  name: string;
  rate: number;
  cost: number;
  serialized?: boolean;
  warranty?: number;
};

export const DEMO_ITEMS: DemoItem[] = [
  { name: 'سامسونج Galaxy A15 128GB', rate: 7200, cost: 6250, serialized: true, warranty: 12 },
  { name: 'سامسونج Galaxy A25 256GB', rate: 11500, cost: 10100, serialized: true, warranty: 12 },
  { name: 'سامسونج Galaxy S24 256GB', rate: 39500, cost: 35800, serialized: true, warranty: 24 },
  { name: 'آيفون 13 128GB', rate: 28500, cost: 25700, serialized: true, warranty: 12 },
  { name: 'آيفون 15 128GB', rate: 42500, cost: 39000, serialized: true, warranty: 12 },
  { name: 'شاومي Redmi Note 13', rate: 9800, cost: 8500, serialized: true, warranty: 12 },
  { name: 'شاومي Redmi 13C', rate: 6100, cost: 5250, serialized: true, warranty: 12 },
  { name: 'أوبو Reno 11F', rate: 16900, cost: 15100, serialized: true, warranty: 12 },
  { name: 'أوبو A58 128GB', rate: 7900, cost: 6900, serialized: true, warranty: 12 },
  { name: 'ريلمي C67 256GB', rate: 8600, cost: 7550, serialized: true, warranty: 12 },
  { name: 'هونر X8b 256GB', rate: 12300, cost: 10800, serialized: true, warranty: 12 },
  { name: 'نوكيا C32 128GB', rate: 5200, cost: 4450, serialized: true, warranty: 12 },
  { name: 'لابتوب Lenovo IdeaPad 3 i5', rate: 26500, cost: 23800, serialized: true, warranty: 12 },
  { name: 'لابتوب HP 15s i5', rate: 28900, cost: 25900, serialized: true, warranty: 12 },
  { name: 'لابتوب Dell Vostro 3520', rate: 31500, cost: 28200, serialized: true, warranty: 12 },
  { name: 'لابتوب ASUS Vivobook 15', rate: 29900, cost: 26900, serialized: true, warranty: 24 },
  { name: 'MacBook Air M2 256GB', rate: 54500, cost: 50500, serialized: true, warranty: 12 },
  { name: 'شاشة Samsung 24 بوصة', rate: 6100, cost: 5200, serialized: true, warranty: 24 },
  { name: 'شاشة LG 27 بوصة', rate: 8900, cost: 7700, serialized: true, warranty: 24 },
  { name: 'تلفزيون Tornado 43 بوصة', rate: 12900, cost: 11200, serialized: true, warranty: 24 },
  { name: 'راوتر TP-Link Archer C6', rate: 1850, cost: 1480, serialized: true, warranty: 12 },
  { name: 'تابلت Samsung Tab A9', rate: 9800, cost: 8600, serialized: true, warranty: 12 },
  { name: 'شاحن سريع Samsung 25W', rate: 850, cost: 560 },
  { name: 'شاحن Apple USB-C 20W', rate: 1250, cost: 890 },
  { name: 'كابل Type-C أصلي', rate: 280, cost: 145 },
  { name: 'كابل Lightning أصلي', rate: 550, cost: 330 },
  { name: 'باور بانك Anker 10000', rate: 1750, cost: 1320 },
  { name: 'هاند فري Bluetooth', rate: 690, cost: 410 },
  { name: 'سماعة AirPods بديلة', rate: 1450, cost: 980 },
  { name: 'كفر Samsung A15', rate: 180, cost: 65 },
  { name: 'كفر iPhone 13', rate: 250, cost: 90 },
  { name: 'كفر iPhone 15', rate: 290, cost: 110 },
  { name: 'سكرينة زجاج Samsung', rate: 150, cost: 38 },
  { name: 'سكرينة زجاج iPhone', rate: 220, cost: 55 },
  { name: 'حامل موبايل للسيارة', rate: 420, cost: 240 },
  { name: 'ماوس Wireless Logitech', rate: 650, cost: 430 },
  { name: 'كيبورد عربي USB', rate: 520, cost: 330 },
  { name: 'وصلة HDMI مترين', rate: 260, cost: 120 },
  { name: 'بطارية Samsung A15', rate: 950, cost: 610 },
  { name: 'بطارية iPhone 13', rate: 1350, cost: 870 },
  { name: 'شاشة بديلة Redmi Note 13', rate: 1850, cost: 1220 },
  { name: 'شاشة بديلة iPhone 13 OLED', rate: 3900, cost: 2950 },
  { name: 'سوكت شحن Type-C', rate: 450, cost: 210 },
];

const suppliers = [
  'دلتا للتوزيع الإلكتروني',
  'النيل لتجارة المحمول',
  'القاهرة للحاسبات',
  'المتحدة للإكسسوارات',
  'الإسكندرية لقطع الغيار',
];

const customers = [
  'أحمد محمد علي', 'محمود حسن', 'سارة إبراهيم', 'منى السيد', 'عمر خالد',
  'يوسف مصطفى', 'نورهان عادل', 'محمد أشرف', 'ريم وائل', 'كريم طارق',
  'هبة سامي', 'عبد الرحمن جمال', 'فاطمة أحمد',
  'شركة المستقبل للتوريدات', 'مؤسسة النور للخدمات',
];

async function createIfMissing(fyo: Fyo, schemaName: string, data: DocValueMap) {
  const name = data.name as string;
  if (name && (await fyo.db.exists(schemaName, name))) {
    return;
  }
  await fyo.doc.getNewDoc(schemaName, data).sync();
}

export async function seedDemoMasters(outputPath = DEFAULT_OUTPUT) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  try {
    await fs.access(outputPath);
    throw new Error(`Demo database already exists: ${outputPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }

  const fyo = new Fyo({
    DatabaseDemux: DatabaseManager,
    AuthDemux: DummyAuthDemux,
    isTest: false,
    isElectron: false,
  });
  const now = DateTime.local();
  await setupInstance(
    outputPath,
    {
      logo: null,
      companyName: 'تك فلو للإلكترونيات',
      country: 'Egypt',
      fullname: 'مدير',
      email: 'demo@techflow.local',
      bankName: 'حساب تك فلو البنكي',
      currency: 'EGP',
      fiscalYearStart: now.startOf('year').toISODate(),
      fiscalYearEnd: now.endOf('year').toISODate(),
      chartOfAccounts: 'Standard Chart of Accounts',
    },
    fyo
  );

  await fyo.singles.AccountingSettings?.setAndSync({
    enableInventory: true,
    enableInvoiceReturns: true,
    enableDiscounting: true,
  });
  await fyo.singles.InventorySettings?.setAndSync({
    defaultLocation: 'المخزن الرئيسي',
    enableBarcodes: true,
    enableSerialNumber: true,
    enablePointOfSale: true,
  });
  await fyo.singles.POSSettings?.setAndSync({
    inventory: 'المخزن الرئيسي',
    cashAccount: 'Cash In Hand',
    defaultAccount: 'Debtors',
    posUI: 'Classic',
  });
  await fyo.singles.SystemSettings?.setAndSync({
    locale: 'ar-EG',
    currency: 'EGP',
    countryCode: 'eg',
  });

  for (const name of ['المخزن الرئيسي', 'معرض الفرع']) {
    await createIfMissing(fyo, 'Location', { name });
  }
  for (const method of [
    { name: 'كاش', type: 'Cash', account: 'Cash In Hand' },
    { name: 'فيزا', type: 'Bank', account: 'حساب تك فلو البنكي' },
    { name: 'تحويل بنكي', type: 'Transfer', account: 'حساب تك فلو البنكي' },
    { name: 'انستاباي', type: 'Transfer', account: 'حساب تك فلو البنكي' },
  ]) {
    await createIfMissing(fyo, 'PaymentMethod', method);
  }
  for (const tax of [
    { name: 'ضريبة قيمة مضافة 14%', rate: 14 },
    { name: 'معفى من الضريبة 0%', rate: 0 },
  ]) {
    await createIfMissing(fyo, 'Tax', {
      name: tax.name,
      details: [{ account: 'Duties and Taxes', rate: tax.rate }],
    });
  }
  for (const name of suppliers) {
    await createIfMissing(fyo, 'Party', {
      name,
      role: 'Supplier',
      currency: 'EGP',
    });
  }
  for (const [index, name] of customers.entries()) {
    await createIfMissing(fyo, 'Party', {
      name,
      role: 'Customer',
      currency: 'EGP',
      phone: `010${String(10000000 + index)}`,
    });
  }
  for (const [index, item] of DEMO_ITEMS.entries()) {
    await createIfMissing(fyo, 'Item', {
      name: item.name,
      itemCode: `TF-${String(index + 1).padStart(4, '0')}`,
      barcode: item.serialized ? null : `622${String(100000000 + index)}`,
      itemType: 'Product',
      for: 'Both',
      unit: 'Unit',
      rate: item.rate,
      trackItem: true,
      hasSerialNumber: !!item.serialized,
      warrantyPeriodMonths: item.warranty ?? 0,
      tax: 'ضريبة قيمة مضافة 14%',
      description: `تكلفة تجريبية: ${item.cost} ج.م`,
    });
  }

  await fyo.close();
  return outputPath;
}

if (require.main === module) {
  const outputIndex = process.argv.indexOf('--output');
  const output =
    outputIndex >= 0 && process.argv[outputIndex + 1]
      ? path.resolve(process.argv[outputIndex + 1])
      : DEFAULT_OUTPUT;
  seedDemoMasters(output)
    .then((file) => console.log(`Demo masters created: ${file}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
