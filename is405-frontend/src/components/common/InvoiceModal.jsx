import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Printer, Building2, User, Calendar, 
  CheckCircle2, QrCode, FileText, ArrowRight,
  Package, Tag, ShieldCheck, MapPin, Phone, Mail, Globe,
  Truck, ArrowRightLeft, Clock, Check, Layers
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Enterprise Printable Document & Voucher Modal Component
 * 
 * Specifically designed for High-Resolution A3 / A4 Corporate Printing:
 * - Dynamic Paper Size Switcher (A3 Large Format / A4 Standard Office)
 * - Automatic @media print scaling with custom page size and zero modal artifacts
 * - Context-aware layouts tailored for:
 *   1. STOCK_TRANSFER (Multi-facility routing, logistics manifest, QC verification, 3-tier transfer signatures)
 *   2. SALES_INVOICE (Commercial billing, customer bill-to, VAT breakdown & KHR conversion)
 *   3. PURCHASE_ORDER (Procurement commitment, vendor contact, receiving warehouse)
 *   4. SALES_RETURN / PURCHASE_RETURN (Restock inspection & refund slip)
 */
export const InvoiceModal = ({ isOpen, onClose, type = 'SALES_INVOICE', data }) => {
  const printAreaRef = useRef(null);
  const { isKhmer } = useLanguage();
  const [paperSize, setPaperSize] = useState('A3'); // Default to A3 as requested by user

  // Print preparation lifecycle
  useEffect(() => {
    if (!isOpen) return;
    const handleBeforePrint = () => {
      document.body.classList.add('printing-modal');
      document.body.classList.add(`print-size-${paperSize.toLowerCase()}`);
    };
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-modal');
      document.body.classList.remove('print-size-a3');
      document.body.classList.remove('print-size-a4');
    };
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      document.body.classList.remove('printing-modal');
      document.body.classList.remove('print-size-a3');
      document.body.classList.remove('print-size-a4');
    };
  }, [isOpen, paperSize]);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    document.body.classList.add('printing-modal');
    document.body.classList.add(`print-size-${paperSize.toLowerCase()}`);
    window.print();
    setTimeout(() => {
      document.body.classList.remove('printing-modal');
      document.body.classList.remove('print-size-a3');
      document.body.classList.remove('print-size-a4');
    }, 1000);
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

  return (
    <div className="invoice-modal-backdrop fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Dynamic Print Engine Style for A3 / A4 Paper */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize === 'A3' ? 'A3 portrait' : 'A4 portrait'};
            margin: ${paperSize === 'A3' ? '12mm 15mm 12mm 15mm' : '8mm 10mm 8mm 10mm'};
          }
          .invoice-printable-content {
            font-size: ${paperSize === 'A3' ? '11.5pt' : '9.5pt'} !important;
            line-height: ${paperSize === 'A3' ? '1.4' : '1.3'} !important;
          }
          .print-a3-scale {
            transform-origin: top left;
          }
        }
      `}</style>

      <div 
        className="invoice-modal-card bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* On-Screen Modal Control Bar (Hidden when printing on paper) */}
        <div className="print:hidden bg-slate-900 px-6 py-3.5 text-white flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
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
              <p className="text-[11px] text-slate-400">
                {isKhmer ? 'រៀបចំទម្រង់បោះពុម្ពកម្រិតខ្ពស់' : 'High-Resolution Corporate Print Engine'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Paper Size Selector (A3 / A4) */}
            <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPaperSize('A3')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  paperSize === 'A3' 
                    ? 'bg-[#2089C8] text-white shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="A3 Paper (297 × 420 mm) - Large Ledger / Poster Format"
              >
                <span>📄 A3 (Large)</span>
                {paperSize === 'A3' && <Check className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('A4')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  paperSize === 'A4' 
                    ? 'bg-[#2089C8] text-white shadow-xs' 
                    : 'text-slate-300 hover:text-white'
                }`}
                title="A4 Paper (210 × 297 mm) - Standard Office Sheet"
              >
                <span>📄 A4 (Standard)</span>
                {paperSize === 'A4' && <Check className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#2089C8] hover:bg-[#1976ab] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>{isKhmer ? `បោះពុម្ពក្រដាស ${paperSize}` : `Print on ${paperSize}`}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body (A3 / A4 Corporate Masterpiece) */}
        <div 
          ref={printAreaRef} 
          className="invoice-printable-content p-6 sm:p-10 overflow-y-auto bg-white flex-1 text-slate-900"
          id="printable-invoice"
        >
          {/* Outer Corporate Document Frame */}
          <div className="border border-slate-300 p-6 sm:p-8 rounded-2xl print:border-2 print:border-slate-800 print:p-6 print:rounded-none space-y-6">
            
            {/* ========================================================= */}
            {/* SECTION 1: ENTERPRISE LETTERHEAD & DOCUMENT SUMMARY       */}
            {/* ========================================================= */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-slate-800">
              {/* Left: Corporate Identity */}
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl shadow-xs border border-slate-700 shrink-0">
                    MS
                  </div>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                      MekongStock Enterprise Co., Ltd.
                    </h1>
                    <p className="text-[11px] font-bold text-slate-600 tracking-wider">
                      {isKhmer ? 'សហគ្រាស មេគង្គស្តុក អ៊ីនធើប្រាយ • ប្រព័ន្ធគ្រប់គ្រងស្តុក និងភស្តុភារកម្ម' : 'SMART INVENTORY & MULTI-FACILITY LOGISTICS ERP'}
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-600 leading-relaxed pt-2 space-y-0.5">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Headquarters: No. 128, Russian Federation Blvd, Toul Kork, Phnom Penh, Kingdom of Cambodia</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 pt-0.5">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-slate-400" /> (+855) 23 888 999</span>
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-slate-400" /> operations@mekongstock.com.kh</span>
                    <span className="flex items-center gap-1"><Globe className="w-3 h-3 text-slate-400" /> VAT TIN: K008-902410492</span>
                  </div>
                </div>
              </div>

              {/* Right: Architectural Document Header Box */}
              <div className="text-left sm:text-right shrink-0 bg-slate-50 border border-slate-300 p-4 rounded-xl print:bg-transparent print:border-slate-800">
                <div className="inline-flex items-center gap-1 px-3 py-0.5 rounded-full border border-slate-300 bg-white text-[11px] font-mono font-bold text-slate-800 mb-1 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  STATUS: <span className={docStatus === 'COMPLETED' ? 'text-emerald-700' : 'text-[#2089C8]'}>{docStatus}</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                  {type === 'STOCK_TRANSFER'
                    ? (isKhmer ? 'ប័ណ្ណផ្ទេរទំនិញរវាងឃ្លាំង' : 'STOCK TRANSFER VOUCHER')
                    : type === 'PURCHASE_ORDER'
                    ? (isKhmer ? 'ប័ណ្ណបញ្ជាទិញទំនិញ' : 'PURCHASE ORDER VOUCHER')
                    : type === 'SALES_RETURN'
                    ? (isKhmer ? 'ប័ណ្ណបង្វិលសងទំនិញ' : 'CUSTOMER SALES RETURN SLIP')
                    : (isKhmer ? 'វិក្កយបត្រពាណិជ្ជកម្មផ្លូវការ' : 'COMMERCIAL TAX INVOICE')}
                </h2>
                <div className="text-xs text-slate-700 space-y-1 mt-1 font-medium">
                  <p className="font-mono">
                    {isKhmer ? 'លេខកូដឯកសារ:' : 'Voucher No:'} <strong className="text-slate-900 font-extrabold text-sm">{docCode}</strong>
                  </p>
                  <p>
                    {isKhmer ? 'កាលបរិច្ឆេទចេញ:' : 'Issue Date:'} <strong className="font-mono text-slate-900">{formatDate(docDate)}</strong>
                  </p>
                  {data.deliveryDate && type === 'SALES_INVOICE' && (
                    <p>
                      {isKhmer ? 'ថ្ងៃផុតកំណត់ទូទាត់:' : 'Due Date:'} <strong className="font-mono text-slate-900">{formatDate(data.deliveryDate)}</strong>
                    </p>
                  )}
                  {data.expectedDate && type === 'PURCHASE_ORDER' && (
                    <p>
                      {isKhmer ? 'ថ្ងៃរំពឹងទទួល:' : 'Expected Date:'} <strong className="font-mono text-slate-900">{formatDate(data.expectedDate)}</strong>
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ========================================================= */}
            {/* SECTION 2: CONTEXT-SPECIFIC DETAILS GRID (2 COLUMNS)     */}
            {/* ========================================================= */}
            {type === 'STOCK_TRANSFER' ? (
              /* --- 1. STOCK TRANSFER LOGISTICS ROUTING --- */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
                {/* Origin Facility */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#2089C8]" />
                      <span>{isKhmer ? 'ឃ្លាំងប្រភពដើម (DISPATCH ORIGIN)' : 'DISPATCH ORIGIN (FACILITY 01)'}</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-white border border-slate-300 rounded text-slate-700">
                      WH-{data.fromWarehouseId || 1}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {data.fromWarehouseName || 'Main Warehouse'}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Routing: <strong className="text-slate-800">Direct Inbound Loading Bay</strong>
                  </p>
                  <p className="text-xs text-slate-600">
                    Dispatched By: <strong className="text-slate-900 font-semibold">{data.createdByUsername || 'Warehouse Supervisor'}</strong>
                  </p>
                </div>

                {/* Destination Facility */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-purple-600" />
                      <span>{isKhmer ? 'ឃ្លាំងគោលដៅ (DELIVER TO)' : 'DELIVERY DESTINATION (FACILITY 02)'}</span>
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-white border border-slate-300 rounded text-slate-700">
                      WH-{data.toWarehouseId || 2}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {data.toWarehouseName || 'Destination Hub'}
                  </h3>
                  <p className="text-xs text-slate-600">
                    Transfer Purpose: <strong className="text-slate-800">Inter-Facility Stock Rebalance</strong>
                  </p>
                  <p className="text-xs text-slate-600">
                    Transport Carrier: <strong className="text-slate-900 font-semibold">Authorized Mekong Logistics Fleet</strong>
                  </p>
                </div>
              </div>
            ) : type === 'PURCHASE_ORDER' ? (
              /* --- 2. PURCHASE ORDER PROCUREMENT DETAILS --- */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-1.5">
                  <div className="border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#2089C8]" />
                      <span>{isKhmer ? 'អ្នកផ្គត់ផ្គង់ (VENDOR)' : 'SUPPLIER / VENDOR DETAILS'}</span>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{data.vendorName || data.supplierName || 'General Supplier'}</h3>
                  <p className="text-xs font-mono text-slate-600">Vendor ID: {data.supplierCode || 'VEND-001'}</p>
                  <p className="text-xs text-slate-600">Contact: {data.supplierPhone || data.contactPerson || 'Sales Representative'}</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-1.5">
                  <div className="border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{isKhmer ? 'ឃ្លាំងទទួលទំនិញ (INBOUND WAREHOUSE)' : 'RECEIVING FACILITY'}</span>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{data.warehouseName || 'Central Receiving Facility'}</h3>
                  <p className="text-xs text-slate-600">Delivery Status: <strong className="text-emerald-700">{docStatus}</strong></p>
                  <p className="text-xs text-slate-600">Payment Terms: <strong>{data.paymentTerms || 'Net 30 Days'}</strong></p>
                </div>
              </div>
            ) : (
              /* --- 3. COMMERCIAL SALES INVOICE DETAILS --- */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-1.5">
                  <div className="border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#2089C8]" />
                      <span>{isKhmer ? 'អតិថិជន (BILL TO)' : 'BILL TO (CLIENT / CUSTOMER)'}</span>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{data.customerName || 'General Customer'}</h3>
                  <p className="text-xs font-mono text-slate-600">Client Code: {data.customerCode || 'CUST-GENERAL'}</p>
                  {data.warehouseName && (
                    <p className="text-xs text-slate-600">Fulfillment Facility: <strong>{data.warehouseName}</strong></p>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-1.5 flex items-center justify-between">
                  <div>
                    <div className="border-b border-slate-200 pb-1.5">
                      <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{isKhmer ? 'វិធីសាស្រ្ត & ស្ថានភាពទូទាត់' : 'PAYMENT TERMS & STATUS'}</span>
                      </span>
                    </div>
                    <h3 className="text-xs font-bold text-slate-900 mt-1">
                      {data.paymentMethod || data.paymentTerms || 'Bank Transfer / Cash'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Payment Status: <strong className="text-emerald-700 font-bold">{data.paymentStatus || 'PAID IN FULL'}</strong>
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      Wire Transfer: ABA Bank 001 888 999 (USD)
                    </p>
                  </div>

                  <div className="p-2 bg-white rounded-lg border border-slate-300 shrink-0 flex flex-col items-center">
                    <QRCodeSVG 
                      value={`https://erp.mekongstock.com/verify?doc=${docCode}&amt=${grandTotal}`} 
                      size={54} 
                    />
                    <span className="text-[8px] font-mono text-slate-500 mt-1">Scan to Verify</span>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* SECTION 3: LINE ITEMS TABLE (CRISP CORPORATE FORMAT)     */}
            {/* ========================================================= */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-700" />
                  <span>
                    {type === 'STOCK_TRANSFER'
                      ? (isKhmer ? `មុខទំនិញត្រូវផ្ទេរ (${items.length} មុខ)` : `TRANSFERRED ITEMS MANIFEST (${items.length} SKUs)`)
                      : (isKhmer ? `តារាងមុខទំនិញ (${items.length} មុខ)` : `ORDER LINE ITEMS (${items.length} SKUs)`)}
                  </span>
                </h4>
                <span className="text-xs font-mono font-bold text-slate-700">
                  Total Physical Units: <span className="text-slate-900 font-black">{totalQuantity}</span>
                </span>
              </div>

              <div className="border border-slate-300 rounded-lg overflow-hidden print:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-300 print:border-slate-800 text-slate-900 font-black uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3">{isKhmer ? 'ឈ្មោះមុខទំនិញ / ការពិពណ៌នា' : 'Product Description & Specifications'}</th>
                      <th className="py-2.5 px-3 w-28 text-center">{isKhmer ? 'កូដទំនិញ' : 'SKU / Barcode'}</th>
                      <th className="py-2.5 px-3 w-24 text-center">{isKhmer ? 'ចំនួន' : 'Quantity'}</th>
                      {type !== 'STOCK_TRANSFER' && (
                        <>
                          <th className="py-2.5 px-3 w-28 text-right">{isKhmer ? 'តម្លៃរាយ' : 'Unit Price'}</th>
                          <th className="py-2.5 px-3 w-28 text-right">{isKhmer ? 'សរុប' : 'Total Amount'}</th>
                        </>
                      )}
                      {type === 'STOCK_TRANSFER' && (
                        <th className="py-2.5 px-3 w-32 text-center">{isKhmer ? 'ស្ថានភាពត្រួតពិនិត្យ' : 'QC Inspection'}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 print:divide-slate-300">
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
                            <td className="py-2.5 px-3 text-center font-mono text-slate-500 font-bold">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {it.itemName || it.productName || it.name || 'Stock Item'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                              {it.productSku || it.sku || 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-black text-slate-900 text-sm">
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
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-md">
                                  <CheckCircle2 className="w-3 h-3" /> Sealed &amp; Verified
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
            {/* SECTION 4: TERMS & FINANCIAL / LOGISTICS SUMMARY         */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2 print-avoid-break">
              {/* Left: Notes & Operational Directives */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-2 text-xs">
                <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px]">
                  {type === 'STOCK_TRANSFER'
                    ? (isKhmer ? 'គោលការណ៍ត្រួតពិនិត្យ និងផ្ទេរទំនិញ:' : 'TRANSFER POLICIES & INSPECTION TERMS:')
                    : (isKhmer ? 'កំណត់សម្គាល់ & លក្ខខណ្ឌផ្លូវការ:' : 'OFFICIAL TERMS & WARRANTY CONDITIONS:')}
                </p>
                <p className="text-slate-600 leading-relaxed font-medium text-[11px]">
                  {data.notes || (type === 'STOCK_TRANSFER' 
                    ? '1. Goods listed above were physically inspected and dispatched from origin facility in sealed packaging. 2. Destination warehouse officer must count and confirm quantities before signing. 3. Report any discrepancy within 24 hours.'
                    : 'Goods sold are non-refundable unless authorized in writing. Please retain this invoice for official warranty, tax deductions, and verification.')}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-bold pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Digitally Audited by MekongStock ERP Security Kernel</span>
                </div>
              </div>

              {/* Right: Summary Metrics */}
              {type === 'STOCK_TRANSFER' ? (
                /* Stock Transfer Summary */
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-2 text-xs flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-slate-900 uppercase tracking-wider text-[10px] mb-2 border-b border-slate-200 pb-1">
                      LOGISTICS TRANSFER RECONCILIATION
                    </p>
                    <div className="space-y-1.5 text-slate-700 font-medium">
                      <div className="flex justify-between">
                        <span>Total Distinct SKUs:</span>
                        <strong className="font-mono text-slate-900">{items.length} Items</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Total Physical Units:</span>
                        <strong className="font-mono text-slate-900">{totalQuantity} Units</strong>
                      </div>
                      <div className="flex justify-between">
                        <span>Transport Route:</span>
                        <strong className="text-slate-900">Dedicated Fleet Transport</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t-2 border-slate-800 flex items-center justify-between">
                    <span className="font-bold text-slate-900">Transfer Fulfillment:</span>
                    <span className="font-black text-emerald-700 font-mono text-sm">{docStatus}</span>
                  </div>
                </div>
              ) : (
                /* Commercial Invoice Calculations */
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-300 print:bg-transparent print:border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-700">
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
                    <div className="flex justify-between text-slate-700">
                      <span>{isKhmer ? 'ពន្ធអាករ (VAT 10%):' : 'Tax / VAT (10%):'}</span>
                      <span className="font-mono font-semibold">+${tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t-2 border-slate-800 flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">{isKhmer ? 'សរុបជាដុល្លារ:' : 'Grand Total (USD):'}</span>
                    <span className="text-2xl font-mono font-black text-emerald-700">${grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[11px] pt-0.5">
                    <span>{isKhmer ? 'សរុបជាប្រាក់រៀល:' : 'Grand Total (KHR ~4,100៛):'}</span>
                    <span className="font-mono font-bold text-slate-800">
                      {grandTotalKHR.toLocaleString()} ៛
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* SECTION 5: EXECUTIVE 3-TIER SIGNATURE & STAMP BLOCK       */}
            {/* ========================================================= */}
            <div className="pt-8 pb-4 grid grid-cols-3 gap-6 text-center text-xs print-avoid-break">
              {type === 'STOCK_TRANSFER' ? (
                <>
                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អ្នករៀបចំផ្ទេរ (Origin Dispatch)' : 'DISPATCHED BY (ORIGIN FACILITY)'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">{data.createdByUsername || 'Dispatch Supervisor'}</p>
                      <p className="text-[10px]">Officer Signature &amp; Stamp</p>
                    </div>
                  </div>

                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អ្នកដឹកជញ្ជូន (Carrier / Logistics)' : 'DELIVERED BY (CARRIER / LOGISTICS)'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">Transport Fleet Representative</p>
                      <p className="text-[10px]">Driver Signature &amp; Vehicle ID</p>
                    </div>
                  </div>

                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អ្នកទទួលទំនិញ (Destination Hub)' : 'RECEIVED & VERIFIED BY (DESTINATION)'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">{data.toWarehouseName || 'Destination Receiving Officer'}</p>
                      <p className="text-[10px]">Verified, Received &amp; Stamped</p>
                    </div>
                  </div>
                </>
              ) : type === 'PURCHASE_ORDER' ? (
                <>
                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អ្នកបញ្ជាទិញ (Purchaser)' : 'PURCHASING OFFICER'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">{data.createdByUsername || 'Procurement Agent'}</p>
                      <p className="text-[10px]">Authorized Signature</p>
                    </div>
                  </div>

                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អ្នកអនុម័ត (Finance Approval)' : 'EXECUTIVE APPROVAL'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">Finance &amp; Operations Dept</p>
                      <p className="text-[10px]">Approval Stamp &amp; Date</p>
                    </div>
                  </div>

                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អ្នកផ្គត់ផ្គង់យល់ព្រម (Vendor Acceptance)' : 'VENDOR ACCEPTANCE'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">{data.vendorName || data.supplierName || 'Vendor Representative'}</p>
                      <p className="text-[10px]">Acknowledged &amp; Stamped</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អ្នករៀបចំវិក្កយបត្រ' : 'PREPARED BY (CASHIER)'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">{data.createdByUsername || 'Accountant / Staff'}</p>
                      <p className="text-[10px]">Staff Signature</p>
                    </div>
                  </div>

                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អ្នកអនុម័ត' : 'AUTHORIZED BY (MANAGER)'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">General Manager</p>
                      <p className="text-[10px]">Authorized Signature &amp; Stamp</p>
                    </div>
                  </div>

                  <div className="space-y-14 p-3 bg-slate-50/50 rounded-xl border border-slate-200 print:bg-transparent print:border-slate-800">
                    <p className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                      {isKhmer ? 'អតិថិជនទទួលទំនិញ' : 'CUSTOMER ACCEPTANCE'}
                    </p>
                    <div className="border-t border-dashed border-slate-400 pt-1 text-slate-600">
                      <p className="font-bold text-slate-900">{data.customerName || 'Customer Representative'}</p>
                      <p className="text-[10px]">Received in Good Order</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Document Traceability Footer */}
            <div className="text-center text-[10px] text-slate-500 pt-4 border-t border-slate-300 print:border-slate-800 print-avoid-break flex items-center justify-between">
              <span>MekongStock Enterprise ERP System • Multi-Facility Engine</span>
              <span className="font-mono">Doc #{docCode} • Generated: {new Date().toLocaleString()}</span>
              <span>Page 1 of 1 • Paper Size: {paperSize}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
