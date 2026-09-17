import { Fyo } from 'fyo';
import { Action, ListViewSettings } from 'fyo/model/types';
import {
  getStockTransferActions,
  getTransactionStatusColumn,
} from 'models/helpers';
import { ModelNameEnum } from 'models/types';
import { ShipmentItem } from './ShipmentItem';
import { SerialNumber } from './SerialNumber';
import { StockTransfer } from './StockTransfer';
import { getSerialNumbers } from './helpers';

export function getWarrantyEndDate(startDate: Date, months: number): Date {
  const endDate = new Date(startDate);
  const day = endDate.getDate();
  endDate.setDate(1);
  endDate.setMonth(endDate.getMonth() + months);
  const lastDay = new Date(
    endDate.getFullYear(),
    endDate.getMonth() + 1,
    0
  ).getDate();
  endDate.setDate(Math.min(day, lastDay));
  return endDate;
}

export class Shipment extends StockTransfer {
  items?: ShipmentItem[];

  static getListViewSettings(): ListViewSettings {
    return {
      columns: [
        'name',
        getTransactionStatusColumn(),
        'party',
        'date',
        'grandTotal',
      ],
    };
  }

  static getActions(fyo: Fyo): Action[] {
    return getStockTransferActions(fyo, ModelNameEnum.Shipment);
  }

  override async afterSubmit(): Promise<void> {
    await super.afterSubmit();
    if (this.isReturn) {
      await this.clearWarrantyDetails();
      return;
    }

    await this.setWarrantyDetails();
  }

  override async afterCancel(): Promise<void> {
    await super.afterCancel();
    if (this.isReturn) {
      await this.restoreWarrantyDetails();
      return;
    }

    await this.clearWarrantyDetails();
  }

  private async setWarrantyDetails(
    rows: ShipmentItem[] = this.items ?? []
  ): Promise<void> {
    const saleDate = new Date(this.date!);
    const warrantyMonths = new Map<string, number>();

    for (const row of rows) {
      const item = row.item!;
      if (!warrantyMonths.has(item)) {
        const months = (await this.fyo.getValue(
          ModelNameEnum.Item,
          item,
          'warrantyPeriodMonths'
        )) as number | null;
        warrantyMonths.set(item, months ?? 0);
      }

      const months = warrantyMonths.get(item) ?? 0;
      for (const name of getSerialNumbers(row.serialNumber ?? '')) {
        const serial = (await this.fyo.doc.getDoc(
          ModelNameEnum.SerialNumber,
          name
        )) as SerialNumber;
        await serial.setMultiple({
          salesInvoice: this.backReference ?? null,
          customer: this.party ?? null,
          saleDate,
          warrantyStartDate: months > 0 ? saleDate : null,
          warrantyEndDate:
            months > 0 ? getWarrantyEndDate(saleDate, months) : null,
        });
        await serial.sync();
      }
    }
  }

  private async clearWarrantyDetails(): Promise<void> {
    for (const row of this.items ?? []) {
      for (const name of getSerialNumbers(row.serialNumber ?? '')) {
        const serial = (await this.fyo.doc.getDoc(
          ModelNameEnum.SerialNumber,
          name
        )) as SerialNumber;
        await serial.setMultiple({
          salesInvoice: null,
          customer: null,
          saleDate: null,
          warrantyStartDate: null,
          warrantyEndDate: null,
        });
        await serial.sync();
      }
    }
  }

  private async restoreWarrantyDetails(): Promise<void> {
    if (!this.returnAgainst) {
      return;
    }

    const original = (await this.fyo.doc.getDoc(
      ModelNameEnum.Shipment,
      this.returnAgainst
    )) as Shipment;
    await original.setWarrantyDetails(this.items ?? []);
  }
}
