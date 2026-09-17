<template>
  <div class="flex flex-col h-full" dir="rtl" lang="ar">
    <PageHeader :title="t`Item Labels`" />
    <main class="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-25 dark:bg-gray-900">
      <div class="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
        <section class="p-5 bg-white dark:bg-gray-850 border dark:border-gray-800 rounded-xl">
          <h2 class="mb-4 text-lg font-semibold">إضافة ملصق</h2>

          <label class="block mb-2 text-sm">الصنف</label>
          <select
            v-model="selectedItemName"
            class="w-full mb-4 px-3 py-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
            @change="onItemChange"
          >
            <option value="">اختر الصنف</option>
            <option v-for="item in items" :key="item.name" :value="item.name">
              {{ item.name }}
            </option>
          </select>

          <template v-if="selectedItem?.hasSerialNumber">
            <label class="block mb-2 text-sm">السيريال</label>
            <select
              v-model="selectedSerial"
              class="w-full mb-4 px-3 py-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              dir="ltr"
            >
              <option value="">اختر سيريال متاح</option>
              <option v-for="serial in serials" :key="serial" :value="serial">
                {{ serial }}
              </option>
            </select>
          </template>
          <template v-else-if="selectedItem">
            <label class="block mb-2 text-sm">الكود المطبوع</label>
            <input
              v-model.trim="sku"
              class="w-full mb-4 px-3 py-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              dir="ltr"
              type="text"
            />
            <label class="block mb-2 text-sm">عدد الملصقات</label>
            <input
              v-model.number="quantity"
              class="w-full mb-4 px-3 py-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
              dir="ltr"
              type="number"
              min="1"
              max="100"
            />
          </template>

          <label class="block mb-2 text-sm">مقاس الطباعة</label>
          <select
            v-model="labelSize"
            class="w-full mb-2 px-3 py-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900"
          >
            <option v-for="(size, key) in sizes" :key="key" :value="key">
              {{ size.label }}
            </option>
          </select>
          <p class="mb-4 text-xs text-gray-600 dark:text-gray-400" dir="ltr">
            203 DPI: {{ actualSizeText }}
          </p>

          <p v-if="message" class="mb-4 p-3 rounded-md bg-red-50 text-red-700">
            {{ message }}
          </p>
          <button
            class="w-full px-4 py-2 bg-blue-500 text-white rounded-md font-medium disabled:opacity-50"
            :disabled="!selectedItem || generating"
            @click="addLabel"
          >
            إضافة للمعاينة
          </button>
        </section>

        <section class="p-5 bg-white dark:bg-gray-850 border dark:border-gray-800 rounded-xl">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold">معاينة الطباعة</h2>
            <button
              class="px-4 py-2 bg-green-600 text-white rounded-md disabled:opacity-50"
              :disabled="!queue.length || printing"
              @click="printLabels"
            >
              طباعة
            </button>
          </div>
          <p v-if="!queue.length" class="py-10 text-center text-gray-600">
            لم تتم إضافة ملصقات بعد.
          </p>
          <div v-for="(label, index) in queue" :key="label.id" class="mb-5">
            <img
              :src="label.dataUrl"
              :alt="`ملصق ${label.itemName}`"
              class="max-w-full mx-auto border border-gray-300 bg-white"
              style="image-rendering: pixelated"
            />
            <div class="flex justify-between mt-2 text-sm">
              <span>{{ label.itemName }} — {{ label.quantity }} نسخة</span>
              <button class="text-red-600" @click="queue.splice(index, 1)">حذف</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script lang="ts">
import { ModelNameEnum } from 'models/types';
import PageHeader from 'src/components/PageHeader.vue';
import { fyo } from 'src/initFyo';
import {
  dotsToMm,
  LABEL_SIZES,
  LabelSizeName,
  mmToDots,
  renderLabelPng,
} from 'src/utils/code128';
import { showToast } from 'src/utils/interactive';
import { defineComponent } from 'vue';

type ItemOption = {
  name: string;
  itemCode?: string;
  barcode?: string;
  rate?: unknown;
  hasSerialNumber?: boolean;
};

type LabelRow = {
  id: string;
  itemName: string;
  quantity: number;
  dataUrl: string;
  size: LabelSizeName;
  widthPx: number;
  heightPx: number;
};

export default defineComponent({
  name: 'ItemLabels',
  components: { PageHeader },
  data() {
    return {
      items: [] as ItemOption[],
      serials: [] as string[],
      selectedItemName: '',
      selectedSerial: '',
      sku: '',
      quantity: 1,
      labelSize: 'standard' as LabelSizeName,
      queue: [] as LabelRow[],
      message: '',
      generating: false,
      printing: false,
      sizes: LABEL_SIZES,
    };
  },
  computed: {
    selectedItem(): ItemOption | undefined {
      return this.items.find((item) => item.name === this.selectedItemName);
    },
    actualSizeText(): string {
      const size = LABEL_SIZES[this.labelSize];
      return `${dotsToMm(mmToDots(size.widthMm)).toFixed(2)} × ${dotsToMm(
        mmToDots(size.heightMm)
      ).toFixed(2)} mm`;
    },
  },
  async mounted() {
    this.items = (await fyo.db.getAll(ModelNameEnum.Item, {
      fields: ['name', 'itemCode', 'barcode', 'rate', 'hasSerialNumber'],
      orderBy: 'name',
      order: 'asc',
    })) as ItemOption[];
  },
  methods: {
    async onItemChange() {
      this.message = '';
      this.selectedSerial = '';
      this.quantity = 1;
      const item = this.selectedItem;
      this.sku = item?.barcode || item?.itemCode || '';
      this.serials = [];
      if (!item?.hasSerialNumber) {
        return;
      }

      const rows = (await fyo.db.getAll(ModelNameEnum.SerialNumber, {
        filters: { item: item.name, status: 'Active' },
        fields: ['name'],
        orderBy: 'name',
        order: 'asc',
      })) as Array<{ name: string }>;
      this.serials = rows.map(({ name }) => name);
    },
    async addLabel() {
      const item = this.selectedItem;
      if (!item) {
        return;
      }

      const code = item.hasSerialNumber ? this.selectedSerial : this.sku;
      if (!code) {
        this.message = item.hasSerialNumber
          ? 'اختر سيريال متاح للطباعة.'
          : 'الصنف محتاج SKU أو باركود بحروف وأرقام إنجليزية.';
        return;
      }
      if (!/^[\x20-\x7e]+$/.test(code)) {
        this.message = 'الكود لازم يكون بحروف أو أرقام إنجليزية قابلة للطباعة.';
        return;
      }

      const quantity = item.hasSerialNumber
        ? 1
        : Math.max(1, Math.min(100, Math.floor(this.quantity || 1)));
      this.generating = true;
      this.message = '';
      try {
        const image = await renderLabelPng({
          itemName: item.name,
          price: fyo.format(item.rate, 'Currency'),
          code,
          size: this.labelSize,
        });
        this.queue.push({
          id: `${Date.now()}-${this.queue.length}`,
          itemName: item.name,
          quantity,
          size: this.labelSize,
          ...image,
        });
      } catch (error) {
        this.message =
          error instanceof Error && error.message.includes('too long')
            ? 'الكود طويل على مقاس الملصق المختار.'
            : 'تعذر إنشاء الباركود. راجع الكود وحاول مرة أخرى.';
      } finally {
        this.generating = false;
      }
    },
    async printLabels() {
      const first = this.queue[0];
      if (!first) {
        this.message = 'أضف ملصقًا واحدًا على الأقل قبل الطباعة.';
        return;
      }
      if (this.queue.some((label) => label.size !== first.size)) {
        this.message = 'اطبع كل مقاس على حدة حتى يطابق إعداد الورق في الطابعة.';
        return;
      }

      const widthMm = dotsToMm(first.widthPx);
      const heightMm = dotsToMm(first.heightPx);
      const images = this.queue.flatMap((label) =>
        Array.from(
          { length: label.quantity },
          () => `<img src="${label.dataUrl}" alt="" />`
        )
      );
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>
        @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
        html, body { margin: 0; padding: 0; background: #fff; }
        img { display: block; width: ${widthMm}mm; height: ${heightMm}mm;
          image-rendering: pixelated; break-after: page; page-break-after: always; }
      </style></head><body>${images.join('')}</body></html>`;

      this.printing = true;
      this.message = '';
      try {
        const success = await ipc.printDocument(
          html,
          widthMm / 10,
          heightMm / 10
        );
        if (!success) {
          this.message = 'لم تكتمل الطباعة. تأكد أن الطابعة متصلة ومتاحة.';
          return;
        }
        showToast({ type: 'success', message: 'تم إرسال الملصقات للطابعة.' });
      } catch {
        this.message = 'تعذر الاتصال بالطابعة. تأكد من تشغيلها ثم حاول مرة أخرى.';
      } finally {
        this.printing = false;
      }
    },
  },
});
</script>
