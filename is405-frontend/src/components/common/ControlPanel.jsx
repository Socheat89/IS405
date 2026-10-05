import React from 'react';
import { Plus, Search, LayoutGrid, List, RefreshCw, FileSpreadsheet } from 'lucide-react';

export const ControlPanel = ({
  title,
  subtitle,
  onCreateNew,
  createLabel = 'New',
  actions,
  searchQuery,
  onSearchChange,
  viewMode = 'table',
  onViewModeChange,
  statusFilter = 'ALL',
  onStatusFilterChange,
  statusOptions = [],
  onRefresh,
  loading = false,
  onExport
}) => {
  return (
    <div className="erp-control-panel print:hidden bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-0 sticky top-16 z-30 shadow-2xs">
      <div className="w-full max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 py-3.5">

        {/* Left: Actions + Title */}
        <div className="flex items-center gap-3 flex-wrap">
          {onCreateNew && (
            <button onClick={onCreateNew}
              className="btn-primary px-4 py-2 text-xs group font-semibold shadow-xs">
              <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
              <span>{createLabel}</span>
            </button>
          )}
          {onRefresh && (
            <button onClick={onRefresh} disabled={loading}
              className="btn-icon" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#2089C8]' : ''}`} />
            </button>
          )}
          {onExport && (
            <button onClick={onExport} disabled={loading}
              className="btn-icon text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" title="Export to Excel">
              <FileSpreadsheet className="w-4 h-4" />
            </button>
          )}
          {actions && actions}
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Right: Filters + Search + View Toggle */}
        <div className="flex flex-wrap items-center gap-2.5">

          {/* Status filter tabs */}
          {statusOptions.length > 0 && (
            <div className="filter-tabs max-w-full overflow-x-auto">
              {statusOptions.map((opt) => (
                <button key={opt.value}
                  onClick={() => onStatusFilterChange && onStatusFilterChange(opt.value)}
                  className={`filter-tab ${statusFilter === opt.value ? 'active' : ''}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          {onSearchChange !== undefined && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
              <input type="text" value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search..."
                className="form-input form-input-search !pl-9.5 pr-3 py-2 w-48 sm:w-60 text-xs"
              />
            </div>
          )}

          {/* View mode toggle */}
          {onViewModeChange && (
            <div className="view-toggle">
              <button onClick={() => onViewModeChange('table')}
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`} title="Table View">
                <List className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onViewModeChange('kanban')}
                className={`view-toggle-btn ${viewMode === 'kanban' ? 'active' : ''}`} title="Kanban View">
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
