import React, { useState, useEffect } from 'react';
import { Download, X, Check, FileSpreadsheet, Table } from 'lucide-react';
import { exportToExcel } from '../../utils/excelExport';

export const ExportColumnModal = ({ 
  isOpen, 
  onClose, 
  columns, 
  data, 
  fileName, 
  sheetName 
}) => {
  const [selectedKeys, setSelectedKeys] = useState([]);

  // Reset selections when columns or open state changes
  useEffect(() => {
    if (isOpen && columns && columns.length > 0) {
      setSelectedKeys(columns.map(c => c.key));
    }
  }, [isOpen, columns]);

  if (!isOpen || !columns || columns.length === 0) return null;

  const toggleKey = (key) => {
    setSelectedKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleAll = () => {
    if (selectedKeys.length === columns.length) {
      setSelectedKeys([]);
    } else {
      setSelectedKeys(columns.map(c => c.key));
    }
  };

  const handleExport = () => {
    if (selectedKeys.length === 0) return;
    const colsToExport = columns.filter(c => selectedKeys.includes(c.key));
    exportToExcel(data, fileName || 'export.xlsx', sheetName || 'Sheet1', colsToExport);
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 25px 50px rgba(0,0,0,0.25)', width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', overflow: 'hidden', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#ecfdf5', padding: '8px', borderRadius: '10px', border: '1px solid #d1fae5' }}>
              <FileSpreadsheet size={18} color="#059669" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#111827' }}>Export to Excel</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{data?.length || 0} records · {selectedKeys.length}/{columns.length} columns</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}
            onMouseOver={e => e.currentTarget.style.background = '#f3f4f6'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Column List */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>Select Columns</span>
            <button
              onClick={toggleAll}
              style={{ fontSize: '12px', fontWeight: 600, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {selectedKeys.length === columns.length ? 'Deselect All' : 'Select All'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {columns.map((col) => {
              const isSelected = selectedKeys.includes(col.key);
              const label = col.label || col.header || col.key;
              return (
                <label
                  key={col.key}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '10px',
                    border: `1px solid ${isSelected ? '#a5b4fc' : '#e5e7eb'}`,
                    background: isSelected ? '#eef2ff' : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <div
                    onClick={() => toggleKey(col.key)}
                    style={{
                      width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
                      border: `2px solid ${isSelected ? '#4f46e5' : '#d1d5db'}`,
                      background: isSelected ? '#4f46e5' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'all 0.15s'
                    }}
                  >
                    {isSelected && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                  <span
                    onClick={() => toggleKey(col.key)}
                    style={{ fontSize: '13px', fontWeight: 500, color: isSelected ? '#3730a3' : '#374151', cursor: 'pointer', userSelect: 'none', flex: 1 }}
                  >
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #e5e7eb', background: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid #d1d5db', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selectedKeys.length === 0}
            style={{
              padding: '8px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              color: '#fff', background: selectedKeys.length === 0 ? '#9ca3af' : '#059669',
              border: 'none', cursor: selectedKeys.length === 0 ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
            }}
          >
            <Download size={15} />
            Download Excel
          </button>
        </div>
      </div>
    </div>
  );
};
