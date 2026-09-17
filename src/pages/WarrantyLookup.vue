<template>
  <div class="flex flex-col h-full" dir="rtl" lang="ar">
    <PageHeader :title="t`Warranty Lookup`" />
    <main class="flex-1 overflow-y-auto p-4 md:p-8 bg-gray-25 dark:bg-gray-900">
      <section
        class="max-w-2xl mx-auto p-5 md:p-7 bg-white dark:bg-gray-850 border dark:border-gray-800 rounded-xl"
      >
        <label for="warranty-serial" class="block mb-2 font-medium">
          امسح أو اكتب السيريال
        </label>
        <div class="flex gap-2" dir="ltr">
          <input
            id="warranty-serial"
            ref="serialInput"
            v-model.trim="serial"
            class="flex-1 min-w-0 px-3 py-2 border dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            type="text"
            autocomplete="off"
            placeholder="Serial / IMEI"
            @keyup.enter="lookup"
          />
          <button
            class="px-5 py-2 rounded-md bg-blue-500 text-white font-medium disabled:opacity-50"
            :disabled="loading || !serial"
            @click="lookup"
          >
            بحث
          </button>
        </div>

        <p v-if="message" class="mt-4 p-3 rounded-md bg-red-50 text-red-700">
          {{ message }}
        </p>

        <div v-if="result" class="mt-6">
          <div
            class="mb-5 p-4 rounded-lg text-center text-lg font-bold"
            :class="result.expired ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'"
          >
            {{ result.status }}
            <span v-if="result.remainingDays !== null" class="block mt-1 text-sm font-normal">
              {{ result.remainingDaysText }}
            </span>
          </div>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div v-for="field in result.fields" :key="field.label">
              <dt class="text-sm text-gray-600 dark:text-gray-400">{{ field.label }}</dt>
              <dd class="mt-1 font-medium" :dir="field.ltr ? 'ltr' : 'rtl'">
                {{ field.value || '—' }}
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </main>
  </div>
</template>

<script lang="ts">
import { ModelNameEnum } from 'models/types';
import PageHeader from 'src/components/PageHeader.vue';
import { fyo } from 'src/initFyo';
import { defineComponent } from 'vue';

type LookupResult = {
  expired: boolean;
  status: string;
  remainingDays: number | null;
  remainingDaysText: string;
  fields: Array<{ label: string; value: string; ltr?: boolean }>;
};

export default defineComponent({
  name: 'WarrantyLookup',
  components: { PageHeader },
  data() {
    return {
      fyo,
      serial: '',
      loading: false,
      message: '',
      result: null as LookupResult | null,
    };
  },
  mounted() {
    (this.$refs.serialInput as HTMLInputElement | undefined)?.focus();
  },
  methods: {
    async lookup() {
      const name = this.serial.trim();
      this.message = '';
      this.result = null;
      if (!name) {
        this.message = 'اكتب السيريال أو امسحه بالاسكانر.';
        return;
      }

      this.loading = true;
      try {
        if (!(await fyo.db.exists(ModelNameEnum.SerialNumber, name))) {
          this.message = 'السيريال غير موجود.';
          return;
        }

        const serial = await fyo.doc.getDoc(ModelNameEnum.SerialNumber, name);
        if (!serial.salesInvoice || !serial.saleDate) {
          this.message = 'السيريال موجود، لكن مفيش عملية بيع وضمان مسجلين عليه.';
          return;
        }

        const warrantyEnd = serial.warrantyEndDate
          ? new Date(serial.warrantyEndDate as Date)
          : null;
        const remainingDays = warrantyEnd
          ? Math.ceil((warrantyEnd.getTime() - Date.now()) / 86_400_000)
          : null;
        const expired = remainingDays !== null && remainingDays < 0;
        const status = warrantyEnd
          ? expired
            ? 'انتهى الضمان'
            : 'تحت الضمان'
          : 'بدون ضمان محدد';
        const remainingDaysText =
          remainingDays === null
            ? 'مدة الضمان غير محددة للصنف'
            : expired
              ? `منتهي من ${Math.abs(remainingDays)} يوم`
              : `متبقي ${remainingDays} يوم`;

        this.result = {
          expired,
          status,
          remainingDays,
          remainingDaysText,
          fields: [
            { label: 'السيريال', value: name, ltr: true },
            { label: 'الصنف', value: String(serial.item ?? '') },
            { label: 'العميل', value: String(serial.customer ?? '') },
            {
              label: 'فاتورة البيع',
              value: String(serial.salesInvoice ?? ''),
              ltr: true,
            },
            {
              label: 'تاريخ البيع',
              value: fyo.format(serial.saleDate, 'Date'),
              ltr: true,
            },
            {
              label: 'نهاية الضمان',
              value: warrantyEnd ? fyo.format(warrantyEnd, 'Date') : '',
              ltr: true,
            },
          ],
        };
      } finally {
        this.loading = false;
      }
    },
  },
});
</script>
