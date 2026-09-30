using backend.Data;
using backend.Modules.Audit.Services;
using backend.Modules.Common;
using backend.Modules.Inventory.Services;
using backend.Modules.Purchasing.DTOs;
using backend.Modules.Purchasing.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Purchasing.Services;

public interface IPurchasingService
{
    // Purchase Orders
    Task<PagedResult<PurchaseOrderDto>> GetOrdersAsync(string? status, int? supplierId, string? search, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto?> GetOrderByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto> CreateOrderAsync(CreatePoRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto?> UpdateOrderAsync(int id, UpdatePoRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto> ApproveOrderAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto> RejectOrderAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<PurchaseOrderDto> CancelOrderAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default);

    // Goods Receipt / GRN
    Task<PagedResult<GoodsReceiptDto>> GetGoodsReceiptsAsync(int? poId, int? warehouseId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<GoodsReceiptDto?> GetGoodsReceiptByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<GoodsReceiptDto> ProcessGoodsReceiptAsync(CreateGrnRequest request, int? userId, string? username, CancellationToken cancellationToken = default);

    // Purchase Returns
    Task<PagedResult<PurchaseReturnDto>> GetPurchaseReturnsAsync(int? supplierId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<PurchaseReturnDto?> GetPurchaseReturnByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PurchaseReturnDto> ProcessPurchaseReturnAsync(CreatePurchaseReturnRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
}

public class PurchasingService : IPurchasingService
{
    private readonly AppDbContext _context;
    private readonly IInventoryService _inventoryService;
    private readonly IAuditService _auditService;

    public PurchasingService(AppDbContext context, IInventoryService inventoryService, IAuditService auditService)
    {
        _context = context;
        _inventoryService = inventoryService;
        _auditService = auditService;
    }

    public async Task<PagedResult<PurchaseOrderDto>> GetOrdersAsync(
        string? status,
        int? supplierId,
        string? search,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.PurchaseOrders
            .Include(po => po.Supplier)
            .Include(po => po.Warehouse)
            .Include(po => po.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(po => po.Status == status.ToUpperInvariant());
        }

        if (supplierId.HasValue)
        {
            query = query.Where(po => po.SupplierId == supplierId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(po => po.PoNumber.ToLower().Contains(s)
                                   || (po.Supplier != null && po.Supplier.Name.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(po => po.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToPoDto).ToList();
        return new PagedResult<PurchaseOrderDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<PurchaseOrderDto?> GetOrderByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var po = await _context.PurchaseOrders
            .Include(p => p.Supplier)
            .Include(p => p.Warehouse)
            .Include(p => p.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        return po == null ? null : MapToPoDto(po);
    }

    public async Task<PurchaseOrderDto> CreateOrderAsync(CreatePoRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new InvalidOperationException("Purchase order must contain at least one item.");
        }

        var supplier = await _context.Suppliers.FirstOrDefaultAsync(s => s.Id == request.SupplierId, cancellationToken);
        if (supplier == null) throw new KeyNotFoundException($"Supplier with ID {request.SupplierId} not found.");

        var poNumber = $"PO-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var po = new PurchaseOrder
        {
            PoNumber = poNumber,
            SupplierId = request.SupplierId,
            WarehouseId = request.WarehouseId,
            ExpectedDateUtc = request.ExpectedDateUtc,
            PaymentTerms = string.IsNullOrWhiteSpace(request.PaymentTerms) ? supplier.PaymentTerms : request.PaymentTerms.Trim(),
            Status = "PENDING_APPROVAL",
            Tax = Math.Max(0, request.Tax),
            Discount = Math.Max(0, request.Discount),
            Notes = request.Notes?.Trim(),
            CreatedByUserId = userId,
            CreatedByUsername = username,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        decimal subtotal = 0;
        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0) throw new InvalidOperationException("Item quantity must be greater than zero.");
            var lineSubtotal = (item.Quantity * item.UnitCost) - item.Discount + item.Tax;
            subtotal += lineSubtotal;

            po.Items.Add(new PurchaseOrderItem
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                UnitCost = Math.Max(0, item.UnitCost),
                Discount = Math.Max(0, item.Discount),
                Tax = Math.Max(0, item.Tax),
                Subtotal = lineSubtotal,
                ReceivedQuantity = 0
            });
        }

        po.Subtotal = subtotal;
        po.TotalAmount = Math.Max(0, subtotal + po.Tax - po.Discount);

        // Note Rule 1: PO Created -> NO Stock Change!
        _context.PurchaseOrders.Add(po);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("CREATE", "PurchaseOrder", po.Id.ToString(), $"Created purchase order {po.PoNumber} for {supplier.Name} with total ${po.TotalAmount:F2}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetOrderByIdAsync(po.Id, cancellationToken))!;
    }

    public async Task<PurchaseOrderDto?> UpdateOrderAsync(int id, UpdatePoRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var po = await _context.PurchaseOrders
            .Include(p => p.Items)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);

        if (po == null) return null;
        if (po.Status is not ("DRAFT" or "PENDING_APPROVAL"))
        {
            throw new InvalidOperationException($"Cannot modify purchase order in '{po.Status}' status.");
        }

        po.ExpectedDateUtc = request.ExpectedDateUtc;
        if (!string.IsNullOrWhiteSpace(request.PaymentTerms)) po.PaymentTerms = request.PaymentTerms.Trim();
        po.Notes = request.Notes?.Trim();
        po.Tax = Math.Max(0, request.Tax);
        po.Discount = Math.Max(0, request.Discount);
        po.UpdatedAtUtc = DateTimeOffset.UtcNow;

        _context.PurchaseOrderItems.RemoveRange(po.Items);
        po.Items.Clear();

        decimal subtotal = 0;
        foreach (var item in request.Items)
        {
            var lineSubtotal = (item.Quantity * item.UnitCost) - item.Discount + item.Tax;
            subtotal += lineSubtotal;
            po.Items.Add(new PurchaseOrderItem
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                UnitCost = item.UnitCost,
                Discount = item.Discount,
                Tax = item.Tax,
                Subtotal = lineSubtotal,
                ReceivedQuantity = 0
            });
        }

        po.Subtotal = subtotal;
        po.TotalAmount = Math.Max(0, subtotal + po.Tax - po.Discount);

        await _context.SaveChangesAsync(cancellationToken);
        await _auditService.LogAsync("UPDATE", "PurchaseOrder", po.Id.ToString(), $"Updated purchase order {po.PoNumber}", userId: userId, username: username, cancellationToken: cancellationToken);

        return await GetOrderByIdAsync(po.Id, cancellationToken);
    }

    public async Task<PurchaseOrderDto> ApproveOrderAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var po = await _context.PurchaseOrders.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (po == null) throw new KeyNotFoundException($"Purchase order with ID {id} not found.");
        if (po.Status != "PENDING_APPROVAL" && po.Status != "DRAFT")
        {
            throw new InvalidOperationException($"Cannot approve purchase order in '{po.Status}' status.");
        }

        po.Status = "APPROVED";
        po.ApprovedByUserId = userId;
        po.ApprovedByUsername = username;
        po.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("APPROVE", "PurchaseOrder", po.Id.ToString(), $"Approved purchase order {po.PoNumber}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetOrderByIdAsync(po.Id, cancellationToken))!;
    }

    public async Task<PurchaseOrderDto> RejectOrderAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var po = await _context.PurchaseOrders.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (po == null) throw new KeyNotFoundException($"Purchase order with ID {id} not found.");

        po.Status = "REJECTED";
        po.Notes = string.IsNullOrWhiteSpace(reason) ? po.Notes : $"{po.Notes} [Rejected: {reason}]";
        po.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("REJECT", "PurchaseOrder", po.Id.ToString(), $"Rejected purchase order {po.PoNumber}: {reason}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetOrderByIdAsync(po.Id, cancellationToken))!;
    }

    public async Task<PurchaseOrderDto> CancelOrderAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var po = await _context.PurchaseOrders.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
        if (po == null) throw new KeyNotFoundException($"Purchase order with ID {id} not found.");
        if (po.Status == "RECEIVED" || po.Status == "CLOSED")
        {
            throw new InvalidOperationException($"Cannot cancel purchase order in '{po.Status}' status.");
        }

        po.Status = "CANCELLED";
        po.Notes = string.IsNullOrWhiteSpace(reason) ? po.Notes : $"{po.Notes} [Cancelled: {reason}]";
        po.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("CANCEL", "PurchaseOrder", po.Id.ToString(), $"Cancelled purchase order {po.PoNumber}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetOrderByIdAsync(po.Id, cancellationToken))!;
    }

    // Goods Receipt / GRN: Rule 2 (Goods Received -> Stock IN)
    public async Task<GoodsReceiptDto> ProcessGoodsReceiptAsync(CreateGrnRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var po = await _context.PurchaseOrders
            .Include(p => p.Supplier)
            .Include(p => p.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(p => p.Id == request.PurchaseOrderId, cancellationToken);

        if (po == null) throw new KeyNotFoundException($"Purchase order with ID {request.PurchaseOrderId} not found.");
        if (po.Status is "DRAFT" or "PENDING_APPROVAL" or "CANCELLED" or "REJECTED" or "CLOSED")
        {
            throw new InvalidOperationException($"Cannot receive goods for purchase order in '{po.Status}' status.");
        }

        var warehouseId = request.WarehouseId ?? po.WarehouseId;
        var grnNo = $"GRN-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";

        var grn = new GoodsReceipt
        {
            GrnNumber = grnNo,
            PurchaseOrderId = po.Id,
            WarehouseId = warehouseId,
            ReceivedDateUtc = DateTimeOffset.UtcNow,
            ReceivedByUserId = userId,
            ReceivedByUsername = username,
            Notes = request.Notes?.Trim(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        foreach (var itemReq in request.Items)
        {
            var poItem = po.Items.FirstOrDefault(i => i.ProductId == itemReq.ProductId);
            if (poItem == null) throw new InvalidOperationException($"Product ID {itemReq.ProductId} does not belong to purchase order {po.PoNumber}.");

            var accepted = Math.Max(0, itemReq.ReceivedQuantity - itemReq.DamagedQuantity);
            var rejected = itemReq.DamagedQuantity;

            grn.Items.Add(new GoodsReceiptItem
            {
                ProductId = itemReq.ProductId,
                OrderedQuantity = poItem.Quantity,
                ReceivedQuantity = itemReq.ReceivedQuantity,
                DamagedQuantity = itemReq.DamagedQuantity,
                AcceptedQuantity = accepted,
                RejectedQuantity = rejected,
                UnitCost = poItem.UnitCost,
                Remarks = itemReq.Remarks?.Trim()
            });

            // Update received quantity on PO item
            poItem.ReceivedQuantity += accepted;

            // RULE 2: Goods Received -> Stock IN for Accepted Quantity!
            if (accepted > 0)
            {
                await _inventoryService.IncreaseStockAsync(
                    productId: poItem.ProductId,
                    warehouseId: warehouseId,
                    quantity: accepted,
                    unitCost: poItem.UnitCost,
                    referenceType: "GRN",
                    referenceNo: grnNo,
                    reason: $"Goods Receipt for {po.PoNumber}",
                    supplierOrRecipient: po.Supplier?.Name ?? "Supplier",
                    notes: $"Accepted: {accepted}, Damaged: {itemReq.DamagedQuantity}. {itemReq.Remarks}",
                    userId: userId,
                    username: username,
                    cancellationToken: cancellationToken
                );
            }
        }

        // Update PO status based on received quantities
        bool allFulfilled = po.Items.All(i => i.ReceivedQuantity >= i.Quantity);
        bool anyReceived = po.Items.Any(i => i.ReceivedQuantity > 0);

        if (allFulfilled)
        {
            po.Status = "RECEIVED";
        }
        else if (anyReceived)
        {
            po.Status = "PARTIALLY_RECEIVED";
        }

        po.UpdatedAtUtc = DateTimeOffset.UtcNow;
        _context.GoodsReceipts.Add(grn);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("RECEIVE", "GoodsReceipt", grn.Id.ToString(), $"Processed GRN {grn.GrnNumber} for {po.PoNumber}. PO Status now: {po.Status}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetGoodsReceiptByIdAsync(grn.Id, cancellationToken))!;
    }

    public async Task<PagedResult<GoodsReceiptDto>> GetGoodsReceiptsAsync(int? poId, int? warehouseId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.GoodsReceipts
            .Include(g => g.PurchaseOrder)
            .Include(g => g.Warehouse)
            .Include(g => g.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking();

        if (poId.HasValue) query = query.Where(g => g.PurchaseOrderId == poId.Value);
        if (warehouseId.HasValue) query = query.Where(g => g.WarehouseId == warehouseId.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(g => g.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToGrnDto).ToList();
        return new PagedResult<GoodsReceiptDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<GoodsReceiptDto?> GetGoodsReceiptByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var g = await _context.GoodsReceipts
            .Include(x => x.PurchaseOrder)
            .Include(x => x.Warehouse)
            .Include(x => x.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return g == null ? null : MapToGrnDto(g);
    }

    // Purchase Returns: Rule 7 (Purchase Return -> Stock OUT)
    public async Task<PurchaseReturnDto> ProcessPurchaseReturnAsync(CreatePurchaseReturnRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new InvalidOperationException("Purchase return must contain at least one item.");
        }

        var supplier = await _context.Suppliers.FirstOrDefaultAsync(s => s.Id == request.SupplierId, cancellationToken);
        if (supplier == null) throw new KeyNotFoundException($"Supplier with ID {request.SupplierId} not found.");

        var retNo = $"PR-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var pr = new PurchaseReturn
        {
            ReturnNumber = retNo,
            SupplierId = request.SupplierId,
            PurchaseOrderId = request.PurchaseOrderId,
            WarehouseId = request.WarehouseId,
            ReturnDateUtc = DateTimeOffset.UtcNow,
            Status = "COMPLETED",
            Reason = request.Reason.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedByUserId = userId,
            CreatedByUsername = username,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        decimal totalRefund = 0;
        foreach (var item in request.Items)
        {
            if (item.Quantity <= 0) throw new InvalidOperationException("Return quantity must be greater than zero.");
            var lineTotal = item.Quantity * item.UnitCost;
            totalRefund += lineTotal;

            pr.Items.Add(new PurchaseReturnItem
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                UnitCost = item.UnitCost,
                Subtotal = lineTotal,
                DefectReason = item.DefectReason?.Trim()
            });

            // RULE 7: Purchase Return -> Stock OUT for defective units!
            await _inventoryService.DecreaseStockAsync(
                productId: item.ProductId,
                warehouseId: request.WarehouseId,
                quantity: item.Quantity,
                unitPrice: item.UnitCost,
                referenceType: "PURCHASE_RETURN",
                referenceNo: retNo,
                reason: $"Purchase Return: {request.Reason}",
                supplierOrRecipient: supplier.Name,
                notes: item.DefectReason,
                userId: userId,
                username: username,
                cancellationToken: cancellationToken
            );
        }

        pr.TotalRefundAmount = totalRefund;
        _context.PurchaseReturns.Add(pr);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("RETURN", "PurchaseReturn", pr.Id.ToString(), $"Processed purchase return {pr.ReturnNumber} to {supplier.Name} for ${pr.TotalRefundAmount:F2}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetPurchaseReturnByIdAsync(pr.Id, cancellationToken))!;
    }

    public async Task<PagedResult<PurchaseReturnDto>> GetPurchaseReturnsAsync(int? supplierId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.PurchaseReturns
            .Include(r => r.Supplier)
            .Include(r => r.PurchaseOrder)
            .Include(r => r.Warehouse)
            .Include(r => r.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking();

        if (supplierId.HasValue) query = query.Where(r => r.SupplierId == supplierId.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToReturnDto).ToList();
        return new PagedResult<PurchaseReturnDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<PurchaseReturnDto?> GetPurchaseReturnByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var r = await _context.PurchaseReturns
            .Include(x => x.Supplier)
            .Include(x => x.PurchaseOrder)
            .Include(x => x.Warehouse)
            .Include(x => x.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return r == null ? null : MapToReturnDto(r);
    }

    private static PurchaseOrderDto MapToPoDto(PurchaseOrder po) => new(
        po.Id,
        po.PoNumber,
        po.SupplierId,
        po.Supplier?.Name ?? "Supplier",
        po.WarehouseId,
        po.Warehouse?.Name ?? "Main Warehouse",
        po.OrderDateUtc,
        po.ExpectedDateUtc,
        po.PaymentTerms,
        po.Status,
        po.Subtotal,
        po.Tax,
        po.Discount,
        po.TotalAmount,
        po.Notes,
        po.CreatedByUsername,
        po.ApprovedByUsername,
        po.CreatedAtUtc,
        po.UpdatedAtUtc,
        po.Items.Select(i => new PurchaseOrderItemDto(
            i.Id,
            i.ProductId,
            i.Product?.Sku ?? "N/A",
            i.Product?.Name ?? "N/A",
            i.Quantity,
            i.UnitCost,
            i.Discount,
            i.Tax,
            i.Subtotal,
            i.ReceivedQuantity,
            Math.Max(0, i.Quantity - i.ReceivedQuantity)
        )).ToList()
    );

    private static GoodsReceiptDto MapToGrnDto(GoodsReceipt g) => new(
        g.Id,
        g.GrnNumber,
        g.PurchaseOrderId,
        g.PurchaseOrder?.PoNumber ?? "N/A",
        g.WarehouseId,
        g.Warehouse?.Name ?? "Main Warehouse",
        g.ReceivedDateUtc,
        g.ReceivedByUsername,
        g.Notes,
        g.CreatedAtUtc,
        g.Items.Select(i => new GoodsReceiptItemDto(
            i.Id,
            i.ProductId,
            i.Product?.Sku ?? "N/A",
            i.Product?.Name ?? "N/A",
            i.OrderedQuantity,
            i.ReceivedQuantity,
            i.DamagedQuantity,
            i.AcceptedQuantity,
            i.RejectedQuantity,
            i.UnitCost,
            i.Remarks
        )).ToList()
    );

    private static PurchaseReturnDto MapToReturnDto(PurchaseReturn r) => new(
        r.Id,
        r.ReturnNumber,
        r.SupplierId,
        r.Supplier?.Name ?? "Supplier",
        r.PurchaseOrderId,
        r.PurchaseOrder?.PoNumber,
        r.WarehouseId,
        r.Warehouse?.Name ?? "Main Warehouse",
        r.ReturnDateUtc,
        r.Status,
        r.TotalRefundAmount,
        r.Reason,
        r.Notes,
        r.CreatedByUsername,
        r.CreatedAtUtc,
        r.Items.Select(i => new PurchaseReturnItemDto(
            i.Id,
            i.ProductId,
            i.Product?.Sku ?? "N/A",
            i.Product?.Name ?? "N/A",
            i.Quantity,
            i.UnitCost,
            i.Subtotal,
            i.DefectReason
        )).ToList()
    );
}
