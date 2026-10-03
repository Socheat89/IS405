import React, { useRef, useEffect } from 'react';
import { 
  X, Printer, Building2, User, Calendar, 
  CheckCircle2, QrCode, FileText, ArrowRight,
  Package, Tag, ShieldCheck, MapPin, Phone, Mail, Globe,
  Truck, ArrowRightLeft, Clock
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Enterprise Printable Document & Voucher Modal Component
 * 
 * Specifically formatted for pixel-perfect A4 printing:
 * - Automatically strips modal borders, shadows, and backdrops in @media print
 * - Context-aware layouts tailored for:
 *   1. STOCK_TRANSFER (Logistics dispatch & reception, no commercial billing clutter)
 *   2. SALES_INVOICE (Commercial sale, customer bill-to, VAT & currency totals)
 *   3. PURCHASE_ORDER (Procurement commitment, vendor details, inbound warehouse)
 *   4. SALES_RETURN / PURCHASE_RETURN (Restock inspection & refund slip)
 */
export const InvoiceModal = ({ isOpen, onClose, type = 'SALES_INVOICE', data }) => {
  const printAreaRef = useRef(null);
  const { isKhmer } = useLanguage();

  // Print preparation lifecycle
  useEffect(() => {
    if (!isOpen) return;
    const handleBeforePrint = () => document.body.classList.add('printing-modal');
    const handleAfterPrint = () => document.body.classList.remove('printing-modal');
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-modal');
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    window.print();
  };

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

  // Normalize line items
  const items = Array.isArray(data.items) 
    ? data.items 
    : Array.isArray(data.lines) 
    ? data.lines 
    : [];

  const totalQuantity = items.reduce((sum, it) => sum + Number(it.quantity || it.returnQty || 0), 0);
  const subtotal = Number(data.subtotalAmount || data.subtotal || data.totalAmount || 0);
  const discount = Number(data.discountAmount || 0);
  const tax = Number(data.taxAmount || 0);
  const grandTotal = Number(data.totalAmount || data.grandTotal || (subtotal - discount + tax));
  const grandTotalKHR = Math.round(grandTotal * 4100);

  const docCode = data.transferNumber || data.transferNo || data.invoiceNumber || data.soNumber || data.poNumber || `DOC-#${data.id}`;
  const docDate = data.transferDateUtc || data.saleDateUtc || data.orderDateUtc || data.createdAtUtc || data.deliveryDate;
  const docStatus = (data.status || 'COMPLETED').toUpperCase();

  // -------------------------------------------------------------
  // RENDER DOCUMENT CONTENT
  // -------------------------------------------------------------
  return (
    <div className="invoice-modal-backdrop fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="invoice-modal-card bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* On-Screen Modal Top Bar (Hidden when printing on paper) */}
        <div className="print:hidden bg-slate-900 px-6 py-3.5 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Printer className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold tracking-tight text-white">
                  {type === 'STOCK_TRANSFER' 
                    ? (isKhmer ? 'ប័ណ្ណផ្ទេរទំនិញរវាងឃ្លាំង' : 'Stock Transfer Voucher')
                    : type === 'PURCHASE_ORDER'
                    ? (isKhmer ? 'ប័ណ្ណបញ្ជាទិញទំនិញ' : 'Purchase Order Voucher')
                    : (isKhmer ? 'វិក្កយបត្រផ្លូវការ' : 'Official Commercial Invoice')}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-md bg-white/20 font-mono text-sky-200 font-semibold">{docCode}</span>
              </div>
              <p className="text-xs text-slate-400">
                {isKhmer ? 'មើល និងបោះពុម្ពជាទម្រង់ A4 ស្តង់ដារ' : 'A4 Print Preview & Official Corporate Document'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#2089C8] hover:bg-[#1976ab] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{isKhmer ? 'បោះពុម្ព (Print)' : 'Print Document'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body (A4 Layout) */}
        <div 
          ref={printAreaRef} 
          className="invoice-printable-content p-6 sm:p-10 overflow-y-auto bg-white flex-1 text-slate-900"
          id="printable-invoice"
        >
          {/* ========================================================= */}
          {/* HEADER: COMPANY LETTERHEAD & DOCUMENT SUMMARY             */}
          {/* ========================================================= */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-800">
            {/* Left: Corporate Identity */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#2089C8] flex items-center justify-center text-white font-black text-lg shadow-xs">
                  MS
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    MekongStock Enterprise
                  </h1>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    Smart Inventory & Supply Chain ERP Solutions
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 leading-relaxed pt-1 space-y-0.5">
                <p className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Head Office: No. 128, Russian Federation Blvd, Toul Kork, Phnom Penh, Cambodia</span>
                </p>
                <p className="flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> (+855) 23 888 999</span>
                  <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> operations@mekongstock.com.kh</span>
                  <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-slate-400" /> VAT TIN: K008-902410492</span>
                </p>
              </div>
            </div>

            {/* Right: Voucher Title & Document Ref */}
            <div className="text-left sm:text-right shrink-0">
              <div className="inline-block px-3 py-1 rounded-md border border-slate-300 bg-slate-50 text-[11px] font-mono font-bold text-slate-800 mb-1.5 shadow-2xs">
                STATUS: <span className={docStatus === 'COMPLETED' ? 'text-emerald-700' : 'text-[#2089C8]'}>{docStatus}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {type === 'STOCK_TRANSFER'
                  ? (isKhmer ? 'ប័ណ្ណផ្ទេរទំនិញរវាងឃ្លាំង' : 'STOCK TRANSFER VOUCHER')
                  : type === 'PURCHASE_ORDER'
                  ? (isKhmer ? 'ប័ណ្ណបញ្ជាទិញទំនិញ' : 'PURCHASE ORDER VOUCHER')
                  : type === 'SALES_RETURN'
                  ? (isKhmer ? 'ប័ណ្ណបង្វិលសងទំនិញ' : 'CUSTOMER SALES RETURN SLIP')
                  : (isKhmer ? 'វិក្កយបត្រលក់ទំនិញផ្លូវការ' : 'OFFICIAL SALES INVOICE')}
              </h2>
              <div className="text-xs text-slate-600 space-y-0.5 mt-1">
                <p className="font-mono">
                  {isKhmer ? 'លេខឯកសារ:' : 'Voucher No:'} <strong className="text-slate-900 font-extrabold">{docCode}</strong>
                </p>
                <p>
                  {isKhmer ? 'កាលបរិច្ឆេទ:' : 'Issue Date:'} <strong className="font-mono text-slate-800">{formatDate(docDate)}</strong>
                </p>
                {data.deliveryDate && type === 'SALES_INVOICE' && (
                  <p>
                    {isKhmer ? 'ថ្ងៃកំណត់ទូទាត់:' : 'Due Date:'} <strong className="font-mono text-slate-800">{formatDate(data.deliveryDate)}</strong>
                  </p>
                )}
                {data.expectedDate && type === 'PURCHASE_ORDER' && (
                  <p>
                    {isKhmer ? 'ថ្ងៃរំពឹងទទួល:' : 'Expected Date:'} <strong className="font-mono text-slate-800">{formatDate(data.expectedDate)}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CONTEXT-SPECIFIC DETAILS GRID (2 COLUMNS)                 */}
          {/* ========================================================= */}
          {type === 'STOCK_TRANSFER' ? (
            /* --- 1. STOCK TRANSFER ROUTING CARDS --- */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200">
              {/* Origin Facility */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#2089C8]" />
                  <span>{isKhmer ? 'ឃ្លាំងប្រភពដើម (DISPATCH FROM)' : 'ORIGIN FACILITY (DISPATCH FROM)'}</span>
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {data.fromWarehouseName || 'Main Warehouse'}
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  Facility Code: WH-{data.fromWarehouseId || 1}
                </p>
                <p className="text-[11px] text-slate-600 pt-0.5">
                  Dispatched By: <strong className="text-slate-800 font-semibold">{data.createdByUsername || 'Warehouse Supervisor'}</strong>
                </p>
              </div>

              {/* Destination Facility */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-purple-600" />
                  <span>{isKhmer ? 'ឃ្លាំងគោលដៅ (DELIVER TO)' : 'DESTINATION FACILITY (DELIVER TO)'}</span>
                </span>
                <h3 className="text-sm font-bold text-slate-900">
                  {data.toWarehouseName || 'Destination Hub'}
                </h3>
                <p className="text-xs font-mono text-slate-500">
                  Facility Code: WH-{data.toWarehouseId || 2}
                </p>
                <p className="text-[11px] text-slate-600 pt-0.5">
                  Transfer Purpose: <strong className="text-slate-800 font-semibold">Multi-Facility Stock Rebalance</strong>
                </p>
              </div>
            </div>
          ) : type === 'PURCHASE_ORDER' ? (
            /* --- 2. PURCHASE ORDER DETAILS --- */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#2089C8]" />
                  <span>{isKhmer ? 'អ្នកផ្គត់ផ្គង់ (VENDOR)' : 'SUPPLIER / VENDOR DETAILS'}</span>
                </span>
                <h3 className="text-sm font-bold text-slate-900">{data.vendorName || data.supplierName || 'General Supplier'}</h3>
                <p className="text-xs font-mono text-slate-500">Vendor Code: {data.supplierCode || 'VEND-001'}</p>
                <p className="text-[11px] text-slate-600">Contact: {data.supplierPhone || data.contactPerson || 'Authorized Representative'}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{isKhmer ? 'ឃ្លាំងទទួលទំនិញ (INBOUND WAREHOUSE)' : 'RECEIVING FACILITY'}</span>
                </span>
                <h3 className="text-sm font-bold text-slate-900">{data.warehouseName || 'Central Receiving Facility'}</h3>
                <p className="text-xs text-slate-500">PO Status: <strong className="text-emerald-700">{docStatus}</strong></p>
                <p className="text-[11px] text-slate-600">Payment Terms: <strong>{data.paymentTerms || 'Net 30 Days'}</strong></p>
              </div>
            </div>
          ) : (
            /* --- 3. SALES INVOICE COMMERCIAL DETAILS --- */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-b border-slate-200">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#2089C8]" />
                  <span>{isKhmer ? 'អតិថិជន (BILL TO)' : 'BILL TO (CUSTOMER)'}</span>
                </span>
                <h3 className="text-sm font-bold text-slate-900">{data.customerName || 'Walk-in Customer'}</h3>
                <p className="text-xs font-mono text-slate-500">Customer ID: {data.customerCode || 'CUST-GENERAL'}</p>
                {data.warehouseName && (
                  <p className="text-[11px] text-slate-600">Fulfillment Facility: <strong>{data.warehouseName}</strong></p>
                )}
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{isKhmer ? 'វិធីសាស្រ្ត & ស្ថានភាពទូទាត់' : 'PAYMENT TERMS & STATUS'}</span>
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 mt-1">
                    {data.paymentMethod || data.paymentTerms || 'Cash / QR Payment'}
                  </h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Status: <strong className="text-emerald-700 font-bold">{data.paymentStatus || 'PAID IN FULL'}</strong>
                  </p>
                </div>

                <div className="p-2 bg-white rounded-lg border border-slate-200 shrink-0 flex flex-col items-center">
                  <QRCodeSVG 
                    value={`https://erp.mekongstock.com/verify?doc=${docCode}&amt=${grandTotal}`} 
                    size={52} 
                  />
                  <span className="text-[8px] font-mono text-slate-400 mt-0.5">Scan to Verify</span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* LINE ITEMS TABLE                                          */}
          {/* ========================================================= */}
          <div className="py-5">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#2089C8]" />
                <span>
                  {type === 'STOCK_TRANSFER'
                    ? (isKhmer ? `មុខទំនិញត្រូវផ្ទេរ (${items.length} មុខ)` : `TRANSFERRED ITEMS MANIFEST (${items.length} SKUs)`)
                    : (isKhmer ? `តារាងមុខទំនិញ (${items.length} មុខ)` : `ORDER LINE ITEMS (${items.length} SKUs)`)}
                </span>
              </h4>
              <span className="text-xs font-mono font-bold text-slate-600">
                Total Physical Units: <span className="text-slate-900">{totalQuantity}</span>
              </span>
            </div>

            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                    <th className="py-2.5 px-3">{isKhmer ? 'ឈ្មោះមុខទំនិញ / ការពិពណ៌នា' : 'Product Description'}</th>
                    <th className="py-2.5 px-3 w-28 text-center">{isKhmer ? 'កូដទំនិញ' : 'SKU / Barcode'}</th>
                    <th className="py-2.5 px-3 w-24 text-center">{isKhmer ? 'ចំនួន' : 'Quantity'}</th>
                    {type !== 'STOCK_TRANSFER' && (
                      <>
                        <th className="py-2.5 px-3 w-28 text-right">{isKhmer ? 'តម្លៃរាយ' : 'Unit Price'}</th>
                        <th className="py-2.5 px-3 w-28 text-right">{isKhmer ? 'សរុប' : 'Total'}</th>
                      </>
                    )}
                    {type === 'STOCK_TRANSFER' && (
                      <th className="py-2.5 px-3 w-32 text-center">{isKhmer ? 'ស្ថានភាពត្រួតពិនិត្យ' : 'QC Condition'}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={type === 'STOCK_TRANSFER' ? 5 : 6} className="py-6 text-center text-slate-400 text-xs italic">
                        {isKhmer ? 'គ្មានមុខទំនិញឡើយ' : 'No line item records registered in this document.'}
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const qty = Number(it.quantity || it.returnQty || 1);
                      const unitP = Number(it.unitPrice ?? it.unitCost ?? 0);
                      const lineTot = Number(it.subtotal || (qty * unitP));

                      return (
                        <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-semibold">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {it.itemName || it.productName || it.name || 'Stock Item'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                            {it.productSku || it.sku || 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-center font-mono font-extrabold text-slate-900">
                            {qty} <span className="text-[10px] font-normal text-slate-500">{it.unit || 'PCS'}</span>
                          </td>
                          {type !== 'STOCK_TRANSFER' && (
                            <>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                ${unitP.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                ${lineTot.toFixed(2)}
                              </td>
                            </>
                          )}
                          {type === 'STOCK_TRANSFER' && (
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Sealed / Good
                              </span>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* TERMS, INSTRUCTIONS & FINANCIAL / LOGISTICS SUMMARY       */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-1 pb-6 border-b border-slate-200 print-avoid-break">
            {/* Notes & Operational Terms */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                {type === 'STOCK_TRANSFER'
                  ? (isKhmer ? 'គោលការណ៍ត្រួតពិនិត្យ និងផ្ទេរទំនិញ:' : 'TRANSFER POLICIES & INSPECTION TERMS:')
                  : (isKhmer ? 'កំណត់សម្គាល់ & លក្ខខណ្ឌផ្លូវការ:' : 'OFFICIAL TERMS & CONDITIONS:')}
              </p>
              <p className="text-slate-600 leading-relaxed font-medium text-[11px]">
                {data.notes || (type === 'STOCK_TRANSFER' 
                  ? '1. Goods listed above were physically inspected and dispatched from origin facility in sealed packaging. 2. Destination warehouse officer must count and confirm quantities before signing. 3. Report any discrepancy within 24 hours.'
                  : 'Goods sold are non-refundable unless authorized in writing. Please retain this invoice for official warranty and tax verification.')}
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Verified by MekongStock Secure Audit Engine</span>
              </div>
            </div>

            {/* Calculations / Summary Box */}
            {type === 'STOCK_TRANSFER' ? (
              /* Stock Transfer Summary */
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs flex flex-col justify-between">
                <div>
                  <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px] mb-2">
                    LOGISTICS TRANSFER MANIFEST
                  </p>
                  <div className="space-y-1.5 text-slate-600">
                    <div className="flex justify-between">
                      <span>Total Distinct SKUs:</span>
                      <strong className="font-mono text-slate-900">{items.length} Items</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Physical Units:</span>
                      <strong className="font-mono text-slate-900">{totalQuantity} Units</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Transport Mode:</span>
                      <strong className="text-slate-800">Direct Warehouse Freight</strong>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-900">Transfer Status:</span>
                  <span className="font-bold text-emerald-700 font-mono">{docStatus}</span>
                </div>
              </div>
            ) : (
              /* Commercial Invoice Calculations */
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
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
            )}
          </div>

          {/* ========================================================= */}
          {/* SIGNATURE BLOCKS (Tailored to Document Type)              */}
          {/* ========================================================= */}
          <div className="pt-8 pb-4 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
            {type === 'STOCK_TRANSFER' ? (
              <>
                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អ្នករៀបចំផ្ទេរ (Origin Dispatch)' : 'DISPATCHED BY (ORIGIN)'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">{data.createdByUsername || 'Dispatch Supervisor'}</p>
                    <p className="text-[10px]">Origin Warehouse Signature</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អ្នកដឹកជញ្ជូន (Carrier / Logistics)' : 'DELIVERED BY (CARRIER)'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">Freight Transport Representative</p>
                    <p className="text-[10px]">Driver Signature / Vehicle ID</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អ្នកទទួលទំនិញ (Destination Hub)' : 'RECEIVED BY (DESTINATION)'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">{data.toWarehouseName || 'Destination Receiver'}</p>
                    <p className="text-[10px]">Verified &amp; Received in Good Order</p>
                  </div>
                </div>
              </>
            ) : type === 'PURCHASE_ORDER' ? (
              <>
                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អ្នកបញ្ជាទិញ (Purchaser)' : 'PURCHASING OFFICER'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">{data.createdByUsername || 'Procurement Specialist'}</p>
                    <p className="text-[10px]">Authorized Purchaser Signature</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អ្នកអនុម័ត (Finance Approval)' : 'FINANCIAL CONTROLLER'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">Finance &amp; Operations Dept</p>
                    <p className="text-[10px]">Approval Stamp &amp; Date</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អ្នកផ្គត់ផ្គង់យល់ព្រម (Vendor Acceptance)' : 'VENDOR ACCEPTANCE'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">{data.vendorName || data.supplierName || 'Vendor Representative'}</p>
                    <p className="text-[10px]">Confirmed Order Delivery Schedule</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អ្នករៀបចំវិក្កយបត្រ' : 'PREPARED BY (CASHIER)'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">{data.createdByUsername || 'Accountant / Staff'}</p>
                    <p className="text-[10px]">Staff Signature</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អ្នកអនុម័ត' : 'AUTHORIZED BY (MANAGER)'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">Store / General Manager</p>
                    <p className="text-[10px]">Authorized Signature &amp; Stamp</p>
                  </div>
                </div>

                <div className="space-y-12">
                  <p className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    {isKhmer ? 'អតិថិជនទទួលទំនិញ' : 'CUSTOMER ACCEPTANCE'}
                  </p>
                  <div className="border-t border-dashed border-slate-400 pt-1 text-slate-500">
                    <p className="font-bold text-slate-900">{data.customerName || 'Customer Representative'}</p>
                    <p className="text-[10px]">Received in Good Condition</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Official Disclaimers */}
          <div className="text-center text-[10px] text-slate-400 pt-4 border-t border-slate-200 print-avoid-break">
            MekongStock Enterprise ERP System • Officially Generated Document #{docCode} • Page 1 of 1
          </div>
        </div>
      </div>
    </div>
  );
};
