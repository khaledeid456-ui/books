import { InvoiceItem } from '../InvoiceItem/InvoiceItem';

export class SalesInvoiceItem extends InvoiceItem {
  serialNumber?: string;
  warrantyEndDate?: Date;
}
