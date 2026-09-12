import { supabase } from '../../lib/supabase'
import { fetchAllPages } from '../../lib/pagination'
import {
  rawMaterialDocumentMaxBytes,
  rawMaterialDocumentTypes,
} from './constants'
import {
  calculateRawMaterialReceiptTotals,
  summarizeRawMaterialNames,
  summarizeRawMaterialQuantities,
} from './rawMaterialCalculations'
import type {
  CreateRawMaterialReceiptInput,
  RawMaterialAttachment,
  RawMaterialReceiptBase,
  RawMaterialReceiptCost,
  RawMaterialReceiptCostInput,
  RawMaterialReceiptDetail,
  RawMaterialReceiptItem,
  RawMaterialReceiptItemInput,
  RawMaterialReceiptSummary,
} from './types'

const DOCUMENT_BUCKET = 'raw-material-documents'

interface RawMaterialReceiptListRow extends RawMaterialReceiptBase {
  raw_material_receipt_items: Array<Pick<RawMaterialReceiptItem, 'material_name' | 'quantity' | 'unit' | 'unit_price'>>
  raw_material_receipt_costs: Array<Pick<RawMaterialReceiptCost, 'amount_azn'>>
  raw_material_attachments: Array<Pick<RawMaterialAttachment, 'id'>>
}

function normalizeItem(item: RawMaterialReceiptItem): RawMaterialReceiptItem {
  return {
    ...item,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    line_total: Number(item.line_total),
  }
}

function normalizeCost(cost: RawMaterialReceiptCost): RawMaterialReceiptCost {
  return { ...cost, amount_azn: Number(cost.amount_azn) }
}

function toSummary(row: RawMaterialReceiptListRow): RawMaterialReceiptSummary {
  const { raw_material_receipt_items: itemRows, raw_material_receipt_costs: costRows, raw_material_attachments: attachments, ...receipt } = row
  const items: RawMaterialReceiptItemInput[] = itemRows.map((item) => ({
    material_name: item.material_name,
    category: '',
    specification: null,
    quantity: Number(item.quantity),
    unit: item.unit,
    unit_price: Number(item.unit_price),
  }))
  const costs: RawMaterialReceiptCostInput[] = costRows.map((cost) => ({
    cost_type: '',
    description: null,
    amount_azn: Number(cost.amount_azn),
  }))
  const exchangeRate = Number(receipt.exchange_rate_to_azn)
  const totals = calculateRawMaterialReceiptTotals(items, costs, exchangeRate)

  return {
    ...receipt,
    exchange_rate_to_azn: exchangeRate,
    material_summary: summarizeRawMaterialNames(items),
    quantity_summary: summarizeRawMaterialQuantities(items),
    item_count: items.length,
    attachment_count: attachments.length,
    purchase_cost_original: totals.purchaseCostOriginal,
    purchase_cost_azn: totals.purchaseCostAzn,
    additional_cost_azn: totals.additionalCostAzn,
    landed_cost_azn: totals.landedCostAzn,
  }
}

async function getRawMaterialReceiptSummary(id: string) {
  const { data, error } = await supabase
    .from('raw_material_receipts')
    .select('*, raw_material_receipt_items(material_name, quantity, unit, unit_price), raw_material_receipt_costs(amount_azn), raw_material_attachments(id)')
    .eq('id', id)
    .single()

  if (error) throw error
  return toSummary(data as unknown as RawMaterialReceiptListRow)
}

export async function getRawMaterialReceipts() {
  const rows = await fetchAllPages<RawMaterialReceiptListRow>(async (from, to) => {
    const { data, error } = await supabase
      .from('raw_material_receipts')
      .select('*, raw_material_receipt_items(material_name, quantity, unit, unit_price), raw_material_receipt_costs(amount_azn), raw_material_attachments(id)')
      .order('receipt_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, to)
    return { data: data as unknown as RawMaterialReceiptListRow[] | null, error }
  })

  return rows.map(toSummary)
}

export async function getRawMaterialReceipt(id: string): Promise<RawMaterialReceiptDetail> {
  const [summary, items, costs, attachments] = await Promise.all([
    getRawMaterialReceiptSummary(id),
    fetchAllPages<RawMaterialReceiptItem>(async (from, to) => {
      const { data, error } = await supabase
        .from('raw_material_receipt_items')
        .select('*')
        .eq('receipt_id', id)
        .order('position')
        .order('id')
        .range(from, to)
      return { data: data as RawMaterialReceiptItem[] | null, error }
    }),
    fetchAllPages<RawMaterialReceiptCost>(async (from, to) => {
      const { data, error } = await supabase
        .from('raw_material_receipt_costs')
        .select('*')
        .eq('receipt_id', id)
        .order('position')
        .order('id')
        .range(from, to)
      return { data: data as RawMaterialReceiptCost[] | null, error }
    }),
    fetchAllPages<RawMaterialAttachment>(async (from, to) => {
      const { data, error } = await supabase
        .from('raw_material_attachments')
        .select('*')
        .eq('receipt_id', id)
        .order('created_at')
        .order('id')
        .range(from, to)
      return { data: data as RawMaterialAttachment[] | null, error }
    }),
  ])

  return {
    ...summary,
    items: items.map(normalizeItem),
    costs: costs.map(normalizeCost),
    attachments,
  }
}

function validateFiles(files: File[]) {
  for (const file of files) {
    if (!rawMaterialDocumentTypes.includes(file.type)) {
      throw new Error(`${file.name} must be a PDF, JPG, PNG, or WebP file.`)
    }
    if (file.size <= 0 || file.size > rawMaterialDocumentMaxBytes) {
      throw new Error(`${file.name} must be smaller than 10 MB.`)
    }
  }
}

function fileExtension(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (extension) return extension
  if (file.type === 'application/pdf') return 'pdf'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  return 'jpg'
}

export async function createRawMaterialReceipt(input: CreateRawMaterialReceiptInput) {
  if (input.items.length === 0) throw new Error('Add at least one material item.')
  validateFiles(input.files)

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) throw new Error('Your session has expired. Please sign in again.')

  let receiptId: string | null = null
  const uploadedPaths: string[] = []

  try {
    const { data: receipt, error: receiptError } = await supabase
      .from('raw_material_receipts')
      .insert({ ...input.receipt, created_by_email: '' })
      .select('id')
      .single()
    if (receiptError) throw receiptError
    receiptId = receipt.id

    const { error: itemError } = await supabase
      .from('raw_material_receipt_items')
      .insert(input.items.map((item, position) => ({ ...item, receipt_id: receipt.id, position })))
    if (itemError) throw itemError

    if (input.costs.length > 0) {
      const { error: costError } = await supabase
        .from('raw_material_receipt_costs')
        .insert(input.costs.map((cost, position) => ({ ...cost, receipt_id: receipt.id, position })))
      if (costError) throw costError
    }

    const attachmentRows = []
    for (const file of input.files) {
      const storagePath = `${receipt.id}/${crypto.randomUUID()}.${fileExtension(file)}`
      const { error: uploadError } = await supabase.storage
        .from(DOCUMENT_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (uploadError) throw uploadError
      uploadedPaths.push(storagePath)
      attachmentRows.push({
        receipt_id: receipt.id,
        storage_path: storagePath,
        file_name: file.name,
        content_type: file.type,
        size_bytes: file.size,
        uploaded_by: userData.user.id,
      })
    }

    if (attachmentRows.length > 0) {
      const { error: attachmentError } = await supabase
        .from('raw_material_attachments')
        .insert(attachmentRows)
      if (attachmentError) throw attachmentError
    }

    return getRawMaterialReceiptSummary(receipt.id)
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths)
    }
    if (receiptId) {
      await supabase.from('raw_material_receipts').delete().eq('id', receiptId)
    }
    throw error
  }
}

export async function getRawMaterialAttachmentUrl(attachment: RawMaterialAttachment) {
  const { data, error } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(attachment.storage_path, 60)
  if (error) throw error
  return data.signedUrl
}

export async function deleteRawMaterialReceipt(receipt: RawMaterialReceiptSummary) {
  const { data: attachmentRows, error: attachmentError } = await supabase
    .from('raw_material_attachments')
    .select('storage_path')
    .eq('receipt_id', receipt.id)
  if (attachmentError) throw attachmentError

  const { data, error } = await supabase
    .from('raw_material_receipts')
    .delete()
    .eq('id', receipt.id)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('This delivery could not be deleted.')

  const storagePaths = (attachmentRows ?? []).map((attachment) => attachment.storage_path)
  if (storagePaths.length === 0) return null

  const { error: storageError } = await supabase.storage.from(DOCUMENT_BUCKET).remove(storagePaths)
  return storageError ? `The delivery was deleted, but some documents could not be removed: ${storageError.message}` : null
}
