using backend.Data;
using backend.Models.Data;
using backend.Modules.Audit.Services;
using backend.Modules.Common;
using backend.Modules.Inventory.DTOs;
using backend.Modules.Inventory.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Inventory.Services;

public interface IInventoryService
{
    // Warehouses
    Task<IReadOnlyList<WarehouseDto>> GetWarehousesAsync(bool onlyActive = true, CancellationToken cancellationToken = default);
    Task<WarehouseDto?> GetWarehouseByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<WarehouseDto> CreateWarehouseAsync(CreateWarehouseRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<WarehouseDto?> UpdateWarehouseAsync(int id, UpdateWarehouseRequest request, int? userId, string? username, CancellationToken cancellationToken = default);

    // Stock Levels & Balances
    Task<PagedResult<WarehouseStockDto>> GetWarehouseStocksAsync(int? warehouseId, int? productId, string? search, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StockAlertDto>> GetStockAlertsAsync(int? warehouseId, CancellationToken cancellationToken = default);

    // Movements
    Task<PagedResult<StockMovementDto>> GetMovementsAsync(int? productId, int? warehouseId, string? movementType, string? referenceType, DateTimeOffset? fromDate, DateTimeOffset? toDate, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task RecordMovementAsync(int productId, int? warehouseId, string movementType, string referenceType, string referenceNo, int quantity, decimal unitPrice, int balanceBefore, int balanceAfter, string reason, string? supplierOrRecipient, string? notes, int? userId, string? username, CancellationToken cancellationToken = default);

    // Adjustments
    Task<StockAdjustmentDto> RecordAdjustmentAsync(CreateAdjustmentRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<PagedResult<StockAdjustmentDto>> GetAdjustmentsAsync(int? warehouseId, int? productId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);

    // Transfers
    Task<StockTransferDto> CreateTransferAsync(CreateTransferRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<StockTransferDto> CompleteTransferAsync(int transferId, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<StockTransferDto> CancelTransferAsync(int transferId, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<PagedResult<StockTransferDto>> GetTransfersAsync(string? status, int? warehouseId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);

    // Inter-module Core Operations (Rules 2, 3, 5, 6, 7, 8)
    Task IncreaseStockAsync(int productId, int? warehouseId, int quantity, decimal unitCost, string referenceType, string referenceNo, string reason, string? supplierOrRecipient, string? notes, int? userId, string? username, CancellationToken cancellationToken = default);
    Task DecreaseStockAsync(int productId, int? warehouseId, int quantity, decimal unitPrice, string referenceType, string referenceNo, string reason, string? supplierOrRecipient, string? notes, int? userId, string? username, CancellationToken cancellationToken = default);
}

public class InventoryService : IInventoryService
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public InventoryService(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<IReadOnlyList<WarehouseDto>> GetWarehousesAsync(bool onlyActive = true, CancellationToken cancellationToken = default)
    {
        var query = _context.Warehouses.AsNoTracking();
        if (onlyActive) query = query.Where(w => w.IsActive);
        var list = await query.OrderBy(w => w.Name).ToListAsync(cancellationToken);
        return list.Select(w => new WarehouseDto(w.Id, w.Code, w.Name, w.Location, w.ContactPhone, w.IsActive, w.CreatedAtUtc)).ToList();
    }

    public async Task<WarehouseDto?> GetWarehouseByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var w = await _context.Warehouses.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return w == null ? null : new WarehouseDto(w.Id, w.Code, w.Name, w.Location, w.ContactPhone, w.IsActive, w.CreatedAtUtc);
    }

    public async Task<WarehouseDto> CreateWarehouseAsync(CreateWarehouseRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var codeUpper = request.Code.Trim().ToUpperInvariant();
        var exists = await _context.Warehouses.AnyAsync(w => w.Code == codeUpper, cancellationToken);
        if (exists)
        {
            throw new InvalidOperationException($"Warehouse with code '{request.Code}' already exists.");
        }

        var w = new Warehouse
        {
            Code = codeUpper,
            Name = request.Name.Trim(),
            Location = request.Location?.Trim(),
            ContactPhone = request.ContactPhone?.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _context.Warehouses.Add(w);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("CREATE", "Warehouse", w.Id.ToString(), $"Created warehouse '{w.Name}' ({w.Code})", userId: userId, username: username, cancellationToken: cancellationToken);
        return new WarehouseDto(w.Id, w.Code, w.Name, w.Location, w.ContactPhone, w.IsActive, w.CreatedAtUtc);
    }

    public async Task<WarehouseDto?> UpdateWarehouseAsync(int id, UpdateWarehouseRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var w = await _context.Warehouses.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (w == null) return null;

        w.Name = request.Name.Trim();
        w.Location = request.Location?.Trim();
        w.ContactPhone = request.ContactPhone?.Trim();
        w.IsActive = request.IsActive;

        await _context.SaveChangesAsync(cancellationToken);
        await _auditService.LogAsync("UPDATE", "Warehouse", w.Id.ToString(), $"Updated warehouse '{w.Name}'", userId: userId, username: username, cancellationToken: cancellationToken);
        return new WarehouseDto(w.Id, w.Code, w.Name, w.Location, w.ContactPhone, w.IsActive, w.CreatedAtUtc);
    }

    public async Task<PagedResult<WarehouseStockDto>> GetWarehouseStocksAsync(
        int? warehouseId,
        int? productId,
        string? search,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.WarehouseStocks
            .Include(ws => ws.Warehouse)
            .Include(ws => ws.Product)
            .AsNoTracking();

        if (warehouseId.HasValue)
        {
            query = query.Where(ws => ws.WarehouseId == warehouseId.Value);
        }

        if (productId.HasValue)
        {
            query = query.Where(ws => ws.ProductId == productId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(ws => (ws.Product != null && (ws.Product.Name.ToLower().Contains(s) || ws.Product.Sku.ToLower().Contains(s)))
                                   || (ws.Warehouse != null && ws.Warehouse.Name.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(ws => ws.Product != null ? ws.Product.Name : "")
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(ws => new WarehouseStockDto(
            ws.Id,
            ws.WarehouseId,
            ws.Warehouse?.Name ?? "Main Warehouse",
            ws.ProductId,
            ws.Product?.Sku ?? "N/A",
            ws.Product?.Name ?? "N/A",
            ws.QuantityOnHand,
            ws.ReservedQuantity,
            ws.QuantityOnHand - ws.ReservedQuantity,
            ws.UpdatedAtUtc
        )).ToList();

        return new PagedResult<WarehouseStockDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<IReadOnlyList<StockAlertDto>> GetStockAlertsAsync(int? warehouseId, CancellationToken cancellationToken = default)
    {
        var items = await _context.StockItems
            .Where(i => i.IsActive && i.QuantityOnHand <= i.MinStockLevel)
            .OrderBy(i => i.QuantityOnHand)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return items.Select(i => new StockAlertDto(
            ProductId: i.Id,
            ProductSku: i.Sku,
            ProductName: i.Name,
            QuantityOnHand: i.QuantityOnHand,
            MinStockLevel: i.MinStockLevel,
            MaxStockLevel: i.MaxStockLevel,
            Status: i.QuantityOnHand <= 0 ? "OutOfStock" : "LowStock"
        )).ToList();
    }

    public async Task<PagedResult<StockMovementDto>> GetMovementsAsync(
        int? productId,
        int? warehouseId,
        string? movementType,
        string? referenceType,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.StockMovements
            .Include(m => m.Item)
            .AsNoTracking();

        if (productId.HasValue)
        {
            query = query.Where(m => m.ItemId == productId.Value);
        }

        if (warehouseId.HasValue)
        {
            query = query.Where(m => m.WarehouseId == warehouseId.Value);
        }

        if (!string.IsNullOrWhiteSpace(movementType) && !movementType.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(m => m.MovementType == movementType.ToUpperInvariant());
        }

        if (!string.IsNullOrWhiteSpace(referenceType) && !referenceType.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(m => m.ReferenceType != null && m.ReferenceType == referenceType.ToUpperInvariant());
        }

        if (fromDate.HasValue)
        {
            query = query.Where(m => m.CreatedAtUtc >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(m => m.CreatedAtUtc <= toDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(m => m.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        // Fetch warehouse names
        var warehouseIds = items.Where(m => m.WarehouseId.HasValue).Select(m => m.WarehouseId!.Value).Distinct().ToList();
        var warehouseDict = await _context.Warehouses
            .Where(w => warehouseIds.Contains(w.Id))
            .ToDictionaryAsync(w => w.Id, w => w.Name, cancellationToken);

        var dtos = items.Select(m => new StockMovementDto(
            m.Id,
            m.ReferenceNo,
            m.MovementType,
            m.ReferenceType,
            m.WarehouseId,
            m.WarehouseId.HasValue && warehouseDict.TryGetValue(m.WarehouseId.Value, out var wName) ? wName : "Main Warehouse",
            m.ItemId,
            m.Item?.Sku ?? "N/A",
            m.Item?.Name ?? "Unknown Item",
            m.Quantity,
            m.UnitPrice,
            m.BalanceBefore,
            m.BalanceAfter,
            m.Reason,
            m.SupplierOrRecipient,
            m.Notes,
            m.CreatedByUsername,
            m.CreatedAtUtc
        )).ToList();

        return new PagedResult<StockMovementDto>(dtos, totalCount, page, pageSize);
    }

    public async Task RecordMovementAsync(
        int productId,
        int? warehouseId,
        string movementType,
        string referenceType,
        string referenceNo,
        int quantity,
        decimal unitPrice,
        int balanceBefore,
        int balanceAfter,
        string reason,
        string? supplierOrRecipient,
        string? notes,
        int? userId,
        string? username,
        CancellationToken cancellationToken = default)
    {
        var movement = new StockMovement
        {
            ReferenceNo = referenceNo,
            MovementType = movementType.ToUpperInvariant(),
            ReferenceType = referenceType.ToUpperInvariant(),
            WarehouseId = warehouseId,
            ItemId = productId,
            Quantity = quantity,
            UnitPrice = unitPrice,
            BalanceBefore = balanceBefore,
            BalanceAfter = balanceAfter,
            Reason = reason,
            SupplierOrRecipient = supplierOrRecipient,
            Notes = notes,
            CreatedByUserId = userId,
            CreatedByUsername = username,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<StockAdjustmentDto> RecordAdjustmentAsync(CreateAdjustmentRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        if (request.NewQuantity < 0)
        {
            throw new InvalidOperationException("Stock quantity cannot be negative.");
        }

        var product = await _context.StockItems.FirstOrDefaultAsync(p => p.Id == request.ProductId, cancellationToken);
        if (product == null)
            throw new KeyNotFoundException($"Product with ID {request.ProductId} not found.");

        var warehouse = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == request.WarehouseId, cancellationToken);

        // Retrieve or create warehouse stock
        var ws = await _context.WarehouseStocks.FirstOrDefaultAsync(s => s.WarehouseId == request.WarehouseId && s.ProductId == request.ProductId, cancellationToken);
        if (ws == null)
        {
            ws = new WarehouseStock
            {
                WarehouseId = request.WarehouseId,
                ProductId = request.ProductId,
                QuantityOnHand = product.QuantityOnHand,
                ReservedQuantity = 0,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.WarehouseStocks.Add(ws);
        }

        var balanceBefore = product.QuantityOnHand;
        var diff = request.NewQuantity - balanceBefore;
        if (diff == 0)
        {
            throw new InvalidOperationException("New quantity matches the current quantity. No adjustment needed.");
        }

        ws.QuantityOnHand = Math.Max(0, ws.QuantityOnHand + diff);
        ws.UpdatedAtUtc = DateTimeOffset.UtcNow;

        product.QuantityOnHand = request.NewQuantity;
        product.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var adjNo = $"ADJ-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var adjustment = new StockAdjustment
        {
            AdjustmentNo = adjNo,
            WarehouseId = request.WarehouseId,
            ProductId = request.ProductId,
            AdjustmentType = request.AdjustmentType.ToUpperInvariant(),
            QuantityBefore = balanceBefore,
            QuantityAdjusted = diff,
            QuantityAfter = request.NewQuantity,
            UnitCost = product.CostPrice,
            Reason = request.Reason.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedByUserId = userId,
            CreatedByUsername = username,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _context.StockAdjustments.Add(adjustment);

        // Record Stock Movement
        await RecordMovementAsync(
            productId: product.Id,
            warehouseId: request.WarehouseId,
            movementType: "ADJUSTMENT",
            referenceType: "ADJUSTMENT",
            referenceNo: adjNo,
            quantity: Math.Abs(diff),
            unitPrice: product.CostPrice,
            balanceBefore: balanceBefore,
            balanceAfter: request.NewQuantity,
            reason: $"Adjustment ({request.AdjustmentType}): {request.Reason}",
            supplierOrRecipient: diff > 0 ? "Inventory Audit (Surplus)" : "Inventory Audit (Shrinkage)",
            notes: request.Notes,
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("ADJUSTMENT", "Inventory", adjustment.Id.ToString(), $"Adjusted product '{product.Name}' stock from {balanceBefore} to {request.NewQuantity} in {warehouse?.Name ?? "Warehouse"}", userId: userId, username: username, cancellationToken: cancellationToken);

        return new StockAdjustmentDto(
            adjustment.Id,
            adjustment.AdjustmentNo,
            adjustment.WarehouseId,
            warehouse?.Name ?? "Warehouse",
            product.Id,
            product.Sku,
            product.Name,
            adjustment.AdjustmentType,
            adjustment.QuantityBefore,
            adjustment.QuantityAdjusted,
            adjustment.QuantityAfter,
            adjustment.UnitCost,
            adjustment.Reason,
            adjustment.Notes,
            adjustment.CreatedByUsername,
            adjustment.CreatedAtUtc
        );
    }

    public async Task<PagedResult<StockAdjustmentDto>> GetAdjustmentsAsync(int? warehouseId, int? productId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.StockAdjustments
            .Include(a => a.Warehouse)
            .Include(a => a.Product)
            .AsNoTracking();

        if (warehouseId.HasValue) query = query.Where(a => a.WarehouseId == warehouseId.Value);
        if (productId.HasValue) query = query.Where(a => a.ProductId == productId.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(a => a.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(a => new StockAdjustmentDto(
            a.Id,
            a.AdjustmentNo,
            a.WarehouseId,
            a.Warehouse?.Name ?? "Warehouse",
            a.ProductId,
            a.Product?.Sku ?? "N/A",
            a.Product?.Name ?? "N/A",
            a.AdjustmentType,
            a.QuantityBefore,
            a.QuantityAdjusted,
            a.QuantityAfter,
            a.UnitCost,
            a.Reason,
            a.Notes,
            a.CreatedByUsername,
            a.CreatedAtUtc
        )).ToList();

        return new PagedResult<StockAdjustmentDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<StockTransferDto> CreateTransferAsync(CreateTransferRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        if (request.FromWarehouseId == request.ToWarehouseId)
        {
            throw new InvalidOperationException("Source and destination warehouses cannot be the same.");
        }

        if (request.Items == null || request.Items.Count == 0)
        {
            throw new InvalidOperationException("Transfer must contain at least one item.");
        }

        var fromWh = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == request.FromWarehouseId, cancellationToken);
        var toWh = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == request.ToWarehouseId, cancellationToken);
        if (fromWh == null || toWh == null)
            throw new KeyNotFoundException("One or both warehouses could not be found.");

        var transferNo = $"TR-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var transfer = new StockTransfer
        {
            TransferNo = transferNo,
            FromWarehouseId = request.FromWarehouseId,
            ToWarehouseId = request.ToWarehouseId,
            Status = "PENDING",
            Notes = request.Notes?.Trim(),
            CreatedByUserId = userId,
            CreatedByUsername = username,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0) throw new InvalidOperationException("Transfer quantity must be greater than zero.");

            // Check stock in source warehouse
            var ws = await _context.WarehouseStocks.FirstOrDefaultAsync(s => s.WarehouseId == request.FromWarehouseId && s.ProductId == item.ProductId, cancellationToken);
            var avail = ws?.QuantityOnHand ?? 0;
            if (avail < item.Quantity)
            {
                var prod = await _context.StockItems.FirstOrDefaultAsync(p => p.Id == item.ProductId, cancellationToken);
                throw new InvalidOperationException($"Insufficient stock for '{prod?.Name ?? "Product"}'. Available in {fromWh.Name}: {avail}, Requested: {item.Quantity}");
            }

            transfer.Items.Add(new StockTransferItem
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity
            });
        }

        _context.StockTransfers.Add(transfer);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("CREATE", "StockTransfer", transfer.Id.ToString(), $"Created stock transfer {transfer.TransferNo} from {fromWh.Name} to {toWh.Name}", userId: userId, username: username, cancellationToken: cancellationToken);

        return await GetTransferByIdInternal(transfer.Id, cancellationToken);
    }

    public async Task<StockTransferDto> CompleteTransferAsync(int transferId, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var transfer = await _context.StockTransfers
            .Include(t => t.FromWarehouse)
            .Include(t => t.ToWarehouse)
            .Include(t => t.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(t => t.Id == transferId, cancellationToken);

        if (transfer == null) throw new KeyNotFoundException($"Stock transfer with ID {transferId} not found.");
        if (transfer.Status != "PENDING") throw new InvalidOperationException($"Cannot complete transfer in '{transfer.Status}' status.");

        foreach (var item in transfer.Items)
        {
            var product = item.Product ?? await _context.StockItems.FirstAsync(p => p.Id == item.ProductId, cancellationToken);

            // Deduct from source warehouse
            var sourceWs = await _context.WarehouseStocks.FirstOrDefaultAsync(s => s.WarehouseId == transfer.FromWarehouseId && s.ProductId == item.ProductId, cancellationToken);
            if (sourceWs == null || sourceWs.QuantityOnHand < item.Quantity)
            {
                throw new InvalidOperationException($"Insufficient stock for '{product.Name}' in source warehouse.");
            }
            var srcBefore = sourceWs.QuantityOnHand;
            sourceWs.QuantityOnHand -= item.Quantity;
            sourceWs.UpdatedAtUtc = DateTimeOffset.UtcNow;

            // Add to target warehouse
            var targetWs = await _context.WarehouseStocks.FirstOrDefaultAsync(s => s.WarehouseId == transfer.ToWarehouseId && s.ProductId == item.ProductId, cancellationToken);
            if (targetWs == null)
            {
                targetWs = new WarehouseStock
                {
                    WarehouseId = transfer.ToWarehouseId,
                    ProductId = item.ProductId,
                    QuantityOnHand = 0,
                    ReservedQuantity = 0,
                    UpdatedAtUtc = DateTimeOffset.UtcNow
                };
                _context.WarehouseStocks.Add(targetWs);
            }
            var targetBefore = targetWs.QuantityOnHand;
            targetWs.QuantityOnHand += item.Quantity;
            targetWs.UpdatedAtUtc = DateTimeOffset.UtcNow;

            // Record movements
            await RecordMovementAsync(
                productId: product.Id,
                warehouseId: transfer.FromWarehouseId,
                movementType: "TRANSFER",
                referenceType: "TRANSFER_OUT",
                referenceNo: transfer.TransferNo,
                quantity: item.Quantity,
                unitPrice: product.CostPrice,
                balanceBefore: srcBefore,
                balanceAfter: sourceWs.QuantityOnHand,
                reason: $"Stock Transfer to {transfer.ToWarehouse?.Name}",
                supplierOrRecipient: transfer.ToWarehouse?.Name,
                notes: transfer.Notes,
                userId: userId,
                username: username,
                cancellationToken: cancellationToken
            );

            await RecordMovementAsync(
                productId: product.Id,
                warehouseId: transfer.ToWarehouseId,
                movementType: "TRANSFER",
                referenceType: "TRANSFER_IN",
                referenceNo: transfer.TransferNo,
                quantity: item.Quantity,
                unitPrice: product.CostPrice,
                balanceBefore: targetBefore,
                balanceAfter: targetWs.QuantityOnHand,
                reason: $"Stock Transfer from {transfer.FromWarehouse?.Name}",
                supplierOrRecipient: transfer.FromWarehouse?.Name,
                notes: transfer.Notes,
                userId: userId,
                username: username,
                cancellationToken: cancellationToken
            );
        }

        transfer.Status = "COMPLETED";
        transfer.CompletedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("APPROVE", "StockTransfer", transfer.Id.ToString(), $"Completed stock transfer {transfer.TransferNo}", userId: userId, username: username, cancellationToken: cancellationToken);

        return await GetTransferByIdInternal(transfer.Id, cancellationToken);
    }

    public async Task<StockTransferDto> CancelTransferAsync(int transferId, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var transfer = await _context.StockTransfers.FirstOrDefaultAsync(t => t.Id == transferId, cancellationToken);
        if (transfer == null) throw new KeyNotFoundException($"Stock transfer with ID {transferId} not found.");
        if (transfer.Status != "PENDING") throw new InvalidOperationException($"Cannot cancel transfer in '{transfer.Status}' status.");

        transfer.Status = "CANCELLED";
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("CANCEL", "StockTransfer", transfer.Id.ToString(), $"Cancelled stock transfer {transfer.TransferNo}", userId: userId, username: username, cancellationToken: cancellationToken);

        return await GetTransferByIdInternal(transfer.Id, cancellationToken);
    }

    public async Task<PagedResult<StockTransferDto>> GetTransfersAsync(string? status, int? warehouseId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.StockTransfers
            .Include(t => t.FromWarehouse)
            .Include(t => t.ToWarehouse)
            .Include(t => t.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(t => t.Status == status.ToUpperInvariant());
        }

        if (warehouseId.HasValue)
        {
            query = query.Where(t => t.FromWarehouseId == warehouseId.Value || t.ToWarehouseId == warehouseId.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(t => t.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToTransferDto).ToList();
        return new PagedResult<StockTransferDto>(dtos, totalCount, page, pageSize);
    }

    // Inter-module Core Operations
    public async Task IncreaseStockAsync(
        int productId,
        int? warehouseId,
        int quantity,
        decimal unitCost,
        string referenceType,
        string referenceNo,
        string reason,
        string? supplierOrRecipient,
        string? notes,
        int? userId,
        string? username,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0) return;

        var product = await _context.StockItems.FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);
        if (product == null) throw new KeyNotFoundException($"Product with ID {productId} not found.");

        var balanceBefore = product.QuantityOnHand;
        product.QuantityOnHand += quantity;
        if (unitCost > 0) product.CostPrice = unitCost;
        product.UpdatedAtUtc = DateTimeOffset.UtcNow;

        if (warehouseId.HasValue)
        {
            var ws = await _context.WarehouseStocks.FirstOrDefaultAsync(s => s.WarehouseId == warehouseId.Value && s.ProductId == productId, cancellationToken);
            if (ws == null)
            {
                ws = new WarehouseStock
                {
                    WarehouseId = warehouseId.Value,
                    ProductId = productId,
                    QuantityOnHand = quantity,
                    ReservedQuantity = 0,
                    UpdatedAtUtc = DateTimeOffset.UtcNow
                };
                _context.WarehouseStocks.Add(ws);
            }
            else
            {
                ws.QuantityOnHand += quantity;
                ws.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }

        await RecordMovementAsync(
            productId: product.Id,
            warehouseId: warehouseId,
            movementType: "IN",
            referenceType: referenceType,
            referenceNo: referenceNo,
            quantity: quantity,
            unitPrice: unitCost > 0 ? unitCost : product.CostPrice,
            balanceBefore: balanceBefore,
            balanceAfter: product.QuantityOnHand,
            reason: reason,
            supplierOrRecipient: supplierOrRecipient,
            notes: notes,
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task DecreaseStockAsync(
        int productId,
        int? warehouseId,
        int quantity,
        decimal unitPrice,
        string referenceType,
        string referenceNo,
        string reason,
        string? supplierOrRecipient,
        string? notes,
        int? userId,
        string? username,
        CancellationToken cancellationToken = default)
    {
        if (quantity <= 0) return;

        var product = await _context.StockItems.FirstOrDefaultAsync(p => p.Id == productId, cancellationToken);
        if (product == null) throw new KeyNotFoundException($"Product with ID {productId} not found.");

        // Rule 4 & Rule 8: Stock cannot be negative
        if (product.QuantityOnHand < quantity)
        {
            throw new InvalidOperationException($"Insufficient stock for '{product.Name}'. Available: {product.QuantityOnHand}, Requested: {quantity}");
        }

        var balanceBefore = product.QuantityOnHand;
        product.QuantityOnHand -= quantity;
        product.UpdatedAtUtc = DateTimeOffset.UtcNow;

        if (warehouseId.HasValue)
        {
            var ws = await _context.WarehouseStocks.FirstOrDefaultAsync(s => s.WarehouseId == warehouseId.Value && s.ProductId == productId, cancellationToken);
            if (ws != null)
            {
                ws.QuantityOnHand = Math.Max(0, ws.QuantityOnHand - quantity);
                ws.UpdatedAtUtc = DateTimeOffset.UtcNow;
            }
        }

        await RecordMovementAsync(
            productId: product.Id,
            warehouseId: warehouseId,
            movementType: "OUT",
            referenceType: referenceType,
            referenceNo: referenceNo,
            quantity: quantity,
            unitPrice: unitPrice > 0 ? unitPrice : product.SellingPrice,
            balanceBefore: balanceBefore,
            balanceAfter: product.QuantityOnHand,
            reason: reason,
            supplierOrRecipient: supplierOrRecipient,
            notes: notes,
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task<StockTransferDto> GetTransferByIdInternal(int id, CancellationToken cancellationToken)
    {
        var t = await _context.StockTransfers
            .Include(x => x.FromWarehouse)
            .Include(x => x.ToWarehouse)
            .Include(x => x.Items)
            .ThenInclude(i => i.Product)
            .FirstAsync(x => x.Id == id, cancellationToken);

        return MapToTransferDto(t);
    }

    private static StockTransferDto MapToTransferDto(StockTransfer t) => new(
        t.Id,
        t.TransferNo,
        t.FromWarehouseId,
        t.FromWarehouse?.Name ?? "Source Warehouse",
        t.ToWarehouseId,
        t.ToWarehouse?.Name ?? "Destination Warehouse",
        t.Status,
        t.Notes,
        t.CreatedByUsername,
        t.CreatedAtUtc,
        t.CompletedAtUtc,
        t.Items.Select(i => new StockTransferItemDto(
            i.Id,
            i.ProductId,
            i.Product?.Sku ?? "N/A",
            i.Product?.Name ?? "N/A",
            i.Quantity
        )).ToList()
    );
}
