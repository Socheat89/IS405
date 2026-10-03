import React, { useRef } from 'react';
import { 
  X, Printer, Download, Share2, Building2, User, 
  Calendar, CheckCircle2, QrCode, FileText, ArrowRightLeft, 
  ShoppingBag, Tag, RotateCcw, ShieldCheck 
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Universal Printable Invoice / Voucher Modal Component
 * 
 * Props:
 * - isOpen: boolean
 * - onClose: () => void
 * - type: 'SALES_INVOICE' | 'PURCHASE_ORDER' | 'STOCK_TRANSFER' | 'SALES_RETURN' | 'PURCHASE_RETURN'
 * - data: Transaction object (sales order, purchase order, transfer, return)
 */
export const InvoiceModal = ({ isOpen, onClose, type = 'SALES_INVOICE', data }) => {
  const printAreaRef = useRef(null);
  const { isKhmer } = useLanguage();

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

  const getDocMeta = () => {
    switch (type) {
      case 'SALES_INVOICE':
        return {
          title: isKhmer ? 'វិក្កយបត្រលក់ / ប័ណ្ណទូទាត់ប្រាក់' : 'SALES INVOICE / OFFICIAL RECEIPT',
          code: data.invoiceNumber || data.soNumber || `SO-#${data.id}`,
          partyLabel: isKhmer ? 'អតិថិជន (Bill To)' : 'Bill To (Customer)',
          partyName: data.customerName || 'General Customer',
          partyCode: data.customerCode || 'CUST-GENERAL',
          date: data.saleDateUtc || data.createdAtUtc || data.deliveryDate,
          dueDate: data.deliveryDate,
          badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          badgeText: data.status === 'CONFIRMED' || data.status === 'DELIVERED' ? 'COMPLETED / PAID' : (data.status || 'QUOTATION'),
          colorTheme: 'text-emerald-700'
        };
      case 'PURCHASE_ORDER':
        return {
          title: isKhmer ? 'ប័ណ្ណបញ្ជាទិញទំនិញ (PO)' : 'PURCHASE ORDER VOUCHER',
          code: data.poNumber || `PO-#${data.id}`,
          partyLabel: isKhmer ? 'អ្នកផ្គត់ផ្គង់ (Vendor)' : 'Supplier (Vendor)',
          partyName: data.vendorName || data.supplierName || 'General Supplier',
          partyCode: data.supplierCode || 'VEND-001',
          date: data.orderDateUtc || data.createdAtUtc,
          dueDate: data.expectedDate || data.expectedDateUtc,
          badgeColor: 'bg-sky-100 text-sky-800 border-sky-300',
          badgeText: data.status || 'APPROVED',
          colorTheme: 'text-[#2089C8]'
        };
      case 'STOCK_TRANSFER':
        return {
          title: isKhmer ? 'ប័ណ្ណផ្ទេរទំនិញរវាងឃ្លាំង' : 'STOCK TRANSFER VOUCHER',
          code: data.transferNumber || `TRF-#${data.id}`,
          partyLabel: isKhmer ? 'ព័ត៌មានឃ្លាំង' : 'Warehouses Information',
          partyName: `${data.fromWarehouseName || 'Source'} ➔ ${data.toWarehouseName || 'Destination'}`,
          partyCode: `WH-${data.fromWarehouseId || 1} ➔ WH-${data.toWarehouseId || 2}`,
          date: data.transferDateUtc || data.createdAtUtc,
          dueDate: null,
          badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
          badgeText: data.status || 'COMPLETED',
          colorTheme: 'text-purple-700'
        };
      case 'SALES_RETURN':
        return {
          title: isKhmer ? 'ប័ណ្ណបង្វិលសងទំនិញពីអតិថិជន' : 'CUSTOMER SALES RETURN SLIP',
          code: data.returnNumber || `RTN-#${data.id}`,
          partyLabel: isKhmer ? 'អតិថិជន' : 'Customer Return',
          partyName: data.customerName || 'Customer',
          partyCode: data.invoiceNumber ? `Ref: ${data.invoiceNumber}` : 'Direct Return',
          date: data.returnDateUtc || data.createdAtUtc,
          dueDate: null,
          badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
          badgeText: 'RETURNED & RESTOCKED',
          colorTheme: 'text-amber-700'
        };
      default:
        return {
          title: isKhmer ? 'ប័ណ្ណប្រតិបត្តិការទំនិញ' : 'TRANSACTION RECEIPT',
          code: `DOC-#${data.id}`,
          partyLabel: 'Reference',
          partyName: data.name || 'General',
          partyCode: 'DOC-001',
          date: new Date().toISOString(),
          dueDate: null,
          badgeColor: 'bg-slate-100 text-slate-800 border-slate-300',
          badgeText: 'VERIFIED',
          colorTheme: 'text-slate-700'
        };
    }
  };

  const meta = getDocMeta();

  // Normalize line items
  const items = Array.isArray(data.items) 
    ? data.items 
    : Array.isArray(data.lines) 
    ? data.lines 
    : [];

  const subtotal = Number(data.subtotalAmount || data.subtotal || data.totalAmount || 0);
  const discount = Number(data.discountAmount || 0);
  const tax = Number(data.taxAmount || 0);
  const grandTotal = Number(data.totalAmount || data.grandTotal || (subtotal - discount + tax));
  const grandTotalKHR = Math.round(grandTotal * 4100);

  const formatDate = (d) => {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return String(d);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar (Hidden during Print) */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between shrink-0 print:hidden shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Printer className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>{meta.title}</span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 font-mono">{meta.code}</span>
              </h3>
              <p className="text-xs text-slate-400">
                {isKhmer ? 'មើល និងបោះពុម្ពវិក្កយបត្រ' : 'Print & Export Official Document'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isKhmer ? 'បោះពុម្ព' : 'Print'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div 
          ref={printAreaRef} 
          className="p-6 sm:p-10 overflow-y-auto bg-white print:p-0 print:m-0 print:overflow-visible flex-1 text-slate-900"
          id="printable-invoice"
        >
          {/* Invoice Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-200">
            {/* Company Branding */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1976ab] to-[#2089C8] flex items-center justify-center text-white font-black text-lg shadow-md">
                  MS
                </div>
                <div>
                  <h1 className="text-xl font-extrabold tracking-tight text-slate-900 uppercase">
                    MekongStock Enterprise
                  </h1>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">
                    Smart Inventory & Supply Chain ERP
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 leading-relaxed space-y-0.5 pt-1 font-medium">
                <p>📍 No. 128, Russian Federation Blvd, Toul Kork, Phnom Penh, Cambodia</p>
                <p>📞 (+855) 23 888 999 | ✉️ billing@mekongstock.com.kh</p>
                <p>🌐 www.mekongstock.com.kh | VAT TIN: K008-902410492</p>
              </div>
            </div>

            {/* Invoice Meta Box */}
            <div className="text-left sm:text-right space-y-1.5 shrink-0 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80">
              <div className="inline-block px-2.5 py-0.5 rounded-lg border text-[11px] font-bold uppercase tracking-wider mb-1">
                <span className={`px-2 py-0.5 rounded ${meta.badgeColor}`}>{meta.badgeText}</span>
              </div>
              <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
                {meta.title}
              </h2>
              <p className="text-xs font-mono font-bold text-slate-600">
                Doc Ref: <span className="text-slate-900 font-extrabold">{meta.code}</span>
              </p>
              <p className="text-xs text-slate-600">
                {isKhmer ? 'កាលបរិច្ឆេទ:' : 'Date:'} <strong className="font-mono text-slate-800">{formatDate(meta.date)}</strong>
              </p>
              {meta.dueDate && (
                <p className="text-xs text-slate-600">
                  {isKhmer ? 'ថ្ងៃផុតកំណត់:' : 'Due Date:'} <strong className="font-mono text-slate-800">{formatDate(meta.dueDate)}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Customer / Vendor / Destination Info Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-5 border-b border-slate-100">
            <div className="p-3.5 bg-slate-50/60 rounded-2xl border border-slate-200/60 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#2089C8]" />
                <span>{meta.partyLabel}</span>
              </p>
              <h3 className="text-sm font-bold text-slate-900">{meta.partyName}</h3>
              <p className="text-xs font-mono text-slate-500">ID / Code: {meta.partyCode}</p>
              {data.warehouseName && (
                <p className="text-xs text-slate-600">
                  {isKhmer ? 'ឃ្លាំងទំនិញ:' : 'Warehouse:'} <strong>{data.warehouseName}</strong>
                </p>
              )}
            </div>

            <div className="p-3.5 bg-slate-50/60 rounded-2xl border border-slate-200/60 space-y-1 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isKhmer ? 'វិធីសាស្រ្តទូទាត់' : 'Payment Status'}</span>
                </p>
                <h3 className="text-xs font-bold text-slate-900 mt-1">
                  {data.paymentMethod || data.paymentTerms || 'Cash / QR / Transfer'}
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  {isKhmer ? 'ស្ថានភាពទូទាត់:' : 'Status:'} <strong className="text-emerald-700">{data.paymentStatus || 'PAID IN FULL'}</strong>
                </p>
              </div>

              {/* QR Verification Code */}
              <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs shrink-0 flex flex-col items-center">
                <QRCodeSVG 
                  value={`https://erp.mekongstock.com/verify?doc=${meta.code}&amt=${grandTotal}`} 
                  size={56} 
                />
                <span className="text-[8px] font-mono text-slate-400 mt-1">Scan to Verify</span>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-5">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[#2089C8]" />
              <span>{isKhmer ? `តារាងមុខទំនិញ (${items.length})` : `Order Line Items (${items.length})`}</span>
            </h4>

            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">{isKhmer ? 'មុខទំនិញ' : 'Description'}</th>
                    <th className="py-2.5 px-3 w-24 text-center">SKU</th>
                    <th className="py-2.5 px-3 w-20 text-center">{isKhmer ? 'ចំនួន (Qty)' : 'Qty'}</th>
                    <th className="py-2.5 px-3 w-28 text-right">{isKhmer ? 'តម្លៃរាយ' : 'Unit Price'}</th>
                    <th className="py-2.5 px-3 w-28 text-right">{isKhmer ? 'សរុប' : 'Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-4 text-center text-slate-400 text-xs">
                        {isKhmer ? 'គ្មានមុខទំនិញឡើយ' : 'No line item records'}
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const qty = Number(it.quantity || it.returnQty || 1);
                      const unitP = Number(it.unitPrice ?? it.unitCost ?? 0);
                      const lineTot = Number(it.subtotal || (qty * unitP));

                      return (
                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {it.itemName || it.productName || it.name || 'Stock Item'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-500">
                            {it.productSku || it.sku || 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-extrabold text-slate-900">
                            {qty} {it.unit || 'PCS'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                            ${unitP.toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            ${lineTot.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Calculation Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 pb-6 border-b border-slate-200">
            {/* Notes & Terms */}
            <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-200/60 space-y-2 text-xs">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[10px]">
                {isKhmer ? 'កំណត់សម្គាល់ & លក្ខខណ្ឌ:' : 'Notes & Terms:'}
              </p>
              <p className="text-slate-600 leading-relaxed font-medium">
                {data.notes || (isKhmer ? 'ទំនិញដែលបានទិញរួចមិនអាចប្តូរជាសាច់ប្រាក់វិញបានឡើយ លើកលែងតែមានការយល់ព្រមជាលាយលក្ខណ៍អក្សរ។ សូមរក្សាទុកវិក្កយបត្រនេះសម្រាប់ផ្ទៀងផ្ទាត់។' : 'Goods sold are non-refundable unless authorized in writing. Please keep this invoice for official verification.')}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold pt-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified by MekongStock Secure Audit Engine</span>
              </div>
            </div>

            {/* Calculations Box */}
            <div className="space-y-2 bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{isKhmer ? 'សរុបមុខទំនិញ:' : 'Subtotal:'}</span>
                <span className="font-mono font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-rose-600">
                  <span>{isKhmer ? 'បញ្ចុះតម្លៃ:' : 'Discount:'}</span>
                  <span className="font-mono font-semibold">-${discount.toFixed(2)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{isKhmer ? 'ពន្ធអាករ (VAT 10%):' : 'Tax / VAT (10%):'}</span>
                  <span className="font-mono font-semibold">+${tax.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-300 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">{isKhmer ? 'សរុបជាដុល្លារ:' : 'Grand Total (USD):'}</span>
                <span className="text-xl font-mono font-black text-emerald-700">${grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 text-[11px] pt-0.5">
                <span>{isKhmer ? 'សរុបជាប្រាក់រៀល:' : 'Grand Total (KHR ~4,100៛):'}</span>
                <span className="font-mono font-bold text-slate-700">
                  {grandTotalKHR.toLocaleString()} ៛
                </span>
              </div>
            </div>
          </div>

          {/* Signature Block (Standard for Enterprise Vouchers) */}
          <div className="pt-8 pb-4 grid grid-cols-3 gap-6 text-center text-xs">
            <div className="space-y-12">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                {isKhmer ? 'អ្នករៀបចំ' : 'Prepared By'}
              </p>
              <div className="border-t border-dashed border-slate-300 pt-1 text-slate-500">
                <p className="font-bold text-slate-800">{data.createdByUsername || 'Accountant / Staff'}</p>
                <p className="text-[10px]">Staff Signature</p>
              </div>
            </div>

            <div className="space-y-12">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                {isKhmer ? 'អ្នកត្រួតពិនិត្យ' : 'Verified By'}
              </p>
              <div className="border-t border-dashed border-slate-300 pt-1 text-slate-500">
                <p className="font-bold text-slate-800">Inventory Supervisor</p>
                <p className="text-[10px]">Supervisor Signature</p>
              </div>
            </div>

            <div className="space-y-12">
              <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                {isKhmer ? 'អតិថិជន / អ្នកទទួល' : 'Customer / Recipient'}
              </p>
              <div className="border-t border-dashed border-slate-300 pt-1 text-slate-500">
                <p className="font-bold text-slate-800">{meta.partyName}</p>
                <p className="text-[10px]">Received with Thanks</p>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center text-[10px] text-slate-400 pt-6 border-t border-slate-100">
            Thank you for doing business with MekongStock Enterprise. System Generated Document #{meta.code}
          </div>
        </div>
      </div>
    </div>
  );
};
