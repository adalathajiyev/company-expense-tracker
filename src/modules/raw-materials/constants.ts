import { getBusinessDate } from '../../lib/businessDate'
import type { RawMaterialReceiptInput, RawMaterialTransportMethod } from './types'

export const rawMaterialCategories = [
  'Wood',
  'Metal',
  'Hardware & fasteners',
  'Machinery & equipment',
  'Spare parts',
  'Construction material',
  'Packaging',
  'Chemicals',
  'Other',
] as const

export const rawMaterialUnits = [
  'Piece',
  'Kilogram',
  'Ton',
  'Meter',
  'm2',
  'm3',
  'Box',
  'Pack',
  'Set',
  'Roll',
] as const

export const rawMaterialTransportMethods: RawMaterialTransportMethod[] = [
  'Truck',
  'Rail',
  'Sea',
  'Air',
  'Courier',
  'Other',
]

export const rawMaterialCostTypes = [
  'Transportation',
  'Customs duty',
  'Customs broker',
  'Loading / unloading',
  'Insurance',
  'Other',
] as const

export const supportedCurrencies = ['AZN', 'USD', 'EUR', 'TRY', 'GEL', 'RUB', 'GBP', 'CNY'] as const

export const rawMaterialDocumentTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
export const rawMaterialDocumentMaxBytes = 10 * 1024 * 1024

export function createEmptyRawMaterialReceipt(): RawMaterialReceiptInput {
  return {
    receipt_date: getBusinessDate(),
    supplier_name: '',
    supplier_country: null,
    invoice_number: null,
    invoice_date: null,
    transport_method: 'Truck',
    vehicle_reference: null,
    customs_reference: null,
    currency: 'AZN',
    exchange_rate_to_azn: 1,
    notes: null,
  }
}
