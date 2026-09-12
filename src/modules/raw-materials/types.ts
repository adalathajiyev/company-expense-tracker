export type RawMaterialTransportMethod = 'Truck' | 'Rail' | 'Sea' | 'Air' | 'Courier' | 'Other'

export interface RawMaterialReceiptBase {
  id: string
  receipt_date: string
  supplier_name: string
  supplier_country: string | null
  invoice_number: string | null
  invoice_date: string | null
  transport_method: RawMaterialTransportMethod
  vehicle_reference: string | null
  customs_reference: string | null
  currency: string
  exchange_rate_to_azn: number
  notes: string | null
  created_by: string | null
  created_by_email: string
  created_at: string
  updated_at: string
}

export interface RawMaterialReceiptItem {
  id: string
  receipt_id: string
  position: number
  material_name: string
  category: string
  specification: string | null
  quantity: number
  unit: string
  unit_price: number
  line_total: number
  created_at: string
}

export interface RawMaterialReceiptCost {
  id: string
  receipt_id: string
  position: number
  cost_type: string
  description: string | null
  amount_azn: number
  created_at: string
}

export interface RawMaterialAttachment {
  id: string
  receipt_id: string
  storage_path: string
  file_name: string
  content_type: string
  size_bytes: number
  uploaded_by: string
  created_at: string
}

export interface RawMaterialReceiptSummary extends RawMaterialReceiptBase {
  material_summary: string
  quantity_summary: string
  item_count: number
  attachment_count: number
  purchase_cost_original: number
  purchase_cost_azn: number
  additional_cost_azn: number
  landed_cost_azn: number
}

export interface RawMaterialReceiptDetail extends RawMaterialReceiptSummary {
  items: RawMaterialReceiptItem[]
  costs: RawMaterialReceiptCost[]
  attachments: RawMaterialAttachment[]
}

export type RawMaterialReceiptInput = Pick<RawMaterialReceiptBase,
  | 'receipt_date'
  | 'supplier_name'
  | 'supplier_country'
  | 'invoice_number'
  | 'invoice_date'
  | 'transport_method'
  | 'vehicle_reference'
  | 'customs_reference'
  | 'currency'
  | 'exchange_rate_to_azn'
  | 'notes'
>

export type RawMaterialReceiptItemInput = Pick<RawMaterialReceiptItem,
  'material_name' | 'category' | 'specification' | 'quantity' | 'unit' | 'unit_price'
>

export type RawMaterialReceiptCostInput = Pick<RawMaterialReceiptCost,
  'cost_type' | 'description' | 'amount_azn'
>

export interface CreateRawMaterialReceiptInput {
  receipt: RawMaterialReceiptInput
  items: RawMaterialReceiptItemInput[]
  costs: RawMaterialReceiptCostInput[]
  files: File[]
}
