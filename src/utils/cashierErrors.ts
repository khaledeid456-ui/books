export type CashierErrorContext = 'checkout' | 'print' | 'return';

export function getCashierErrorMessage(
  error: unknown,
  context: CashierErrorContext
): string {
  const detail = error instanceof Error ? error.message : String(error ?? '');
  const message = detail.toLowerCase();

  if (
    message.includes('sqlite_busy') ||
    message.includes('database is locked') ||
    message.includes('database locked')
  ) {
    return 'قاعدة البيانات مشغولة حاليًا. استنى لحظة وحاول مرة تانية.';
  }
  if (
    message.includes('printer') ||
    message.includes('print failed') ||
    message.includes('offline')
  ) {
    return 'الطابعة غير متصلة أو غير متاحة. راجع التوصيل وحاول مرة تانية.';
  }
  if (
    message.includes('empty cart') ||
    message.includes('please add items') ||
    message.includes('no items')
  ) {
    return 'السلة فارغة. أضف صنفًا واحدًا على الأقل قبل إتمام البيع.';
  }
  if (
    message.includes('already been sold') ||
    message.includes('already sold') ||
    message.includes('non active serial') ||
    message.includes('delivered')
  ) {
    return 'السيريال ده اتباع قبل كده ومينفعش يتباع مرة تانية.';
  }
  if (
    message.includes('insufficient quantity') ||
    message.includes('negative stock') ||
    message.includes('out of stock') ||
    message.includes('quantity is zero')
  ) {
    return 'الكمية غير متاحة في المخزن المختار. راجع الرصيد قبل إتمام العملية.';
  }
  if (context === 'print') {
    return 'تعذرت الطباعة. تأكد أن الطابعة متصلة ومتاحة ثم حاول مرة تانية.';
  }
  if (context === 'return') {
    return 'تعذر تنفيذ المرتجع. راجع الفاتورة والكميات ثم حاول مرة تانية.';
  }
  return 'تعذر إتمام عملية البيع. راجع البيانات وحاول مرة تانية.';
}
