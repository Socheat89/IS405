using backend.Data;
using backend.Modules.Audit.Services;
using backend.Modules.Common;
using backend.Modules.Inventory.Services;
using backend.Modules.Sales.DTOs;
using backend.Modules.Sales.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Sales.Services;

public interface ISalesService
{
    // Sales Orders
    Task<PagedResult<SalesOrderDto>> GetSalesAsync(string? status, string? paymentStatus, int? customerId, string? search, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<SalesOrderDto?> GetSaleByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> CreateSaleAsync(CreateSaleRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> ConfirmSaleAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> CancelSaleAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default);

    // Payments
    Task<SalePaymentDto> RecordPaymentAsync(int saleId, CreatePaymentRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SalePaymentDto>> GetPaymentsAsync(int saleId, CancellationToken cancellationToken = default);

    // Sales Returns
    Task<PagedResult<SalesReturnDto>> GetSalesReturnsAsync(int? customerId, int? saleId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<SalesReturnDto?> GetSalesReturnByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<SalesReturnDto> ProcessSalesReturnAsync(CreateSalesReturnRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
}

public class SalesService : ISalesService
{
    private readonly AppDbContext _context;
    private readonly IInventoryService _inventoryService;
    private readonly IAuditService _auditService;

    public SalesService(AppDbContext context, IInventoryService inventoryService, IAuditService auditService)
    {
        _context = context;
        _inventoryService = inventoryService;
        _auditService = auditService;
    }

    public async Task<PagedResult<SalesOrderDto>> GetSalesAsync(
        string? status,
        string? paymentStatus,
        int? customerId,
        string? search,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.SalesOrders
            .Include(s => s.Customer)
            .Include(s => s.Warehouse)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .Include(s => s.Payments)
            .AsNoTracking();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.Status == status.ToUpperInvariant());
        }

        if (!string.IsNullOrWhiteSpace(paymentStatus) && !paymentStatus.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(s => s.PaymentStatus == paymentStatus.ToUpperInvariant());
        }

        if (customerId.HasValue)
        {
            query = query.Where(s => s.CustomerId == customerId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(sale => sale.InvoiceNumber.ToLower().Contains(s)
                                     || (sale.Customer != null && sale.Customer.Name.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(s => s.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToSaleDto).ToList();
        return new PagedResult<SalesOrderDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<SalesOrderDto?> GetSaleByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var s = await _context.SalesOrders
            .Include(x => x.Customer)
            .Include(x => x.Warehouse)
            .Include(x => x.Items)
            .ThenInclude(i => i.Product)
            .Include(x => x.Payments)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return s == null ? null : MapToSaleDto(s);
    }

    public async Task<SalesOrderDto> CreateSaleAsync(CreateSaleRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new InvalidOperationException("Sales order must contain at least one item.");
        }

        var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId, cancellationToken);
        if (customer == null) throw new KeyNotFoundException($"Customer with ID {request.CustomerId} not found.");

        var invoiceNo = $"INV-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var sale = new SalesOrder
        {
            InvoiceNumber = invoiceNo,
            CustomerId = request.CustomerId,
            WarehouseId = request.WarehouseId,
            SaleDateUtc = DateTimeOffset.UtcNow,
            Status = request.AutoConfirm ? "CONFIRMED" : "DRAFT",
            PaymentStatus = "UNPAID",
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

            var product = await _context.StockItems.FirstOrDefaultAsync(p => p.Id == item.ProductId, cancellationToken);
            if (product == null) throw new KeyNotFoundException($"Product with ID {item.ProductId} not found.");

            // RULE 4: Sale Quantity > Available Stock -> Reject!
            if (request.AutoConfirm && product.QuantityOnHand < item.Quantity)
            {
                throw new InvalidOperationException($"Insufficient stock for '{product.Name}'. Available: {product.QuantityOnHand}, Requested: {item.Quantity}");
            }

            var lineSubtotal = (item.Quantity * item.UnitPrice) - item.Discount + item.Tax;
            subtotal += lineSubtotal;

            sale.Items.Add(new SalesOrderItem
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                UnitPrice = Math.Max(0, item.UnitPrice),
                Discount = Math.Max(0, item.Discount),
                Tax = Math.Max(0, item.Tax),
                Subtotal = lineSubtotal
            });
        }

        sale.Subtotal = subtotal;
        sale.TotalAmount = Math.Max(0, subtotal + sale.Tax - sale.Discount);
        sale.RemainingAmount = sale.TotalAmount;

        _context.SalesOrders.Add(sale);
        await _context.SaveChangesAsync(cancellationToken);

        // RULE 3: Sale Confirmed -> Stock OUT!
        if (request.AutoConfirm)
        {
            foreach (var item in sale.Items)
            {
                await _inventoryService.DecreaseStockAsync(
                    productId: item.ProductId,
                    warehouseId: sale.WarehouseId,
                    quantity: item.Quantity,
                    unitPrice: item.UnitPrice,
                    referenceType: "SALE",
                    referenceNo: sale.InvoiceNumber,
                    reason: $"Sale Order #{sale.InvoiceNumber}",
                    supplierOrRecipient: customer.Name,
                    notes: sale.Notes,
                    userId: userId,
                    username: username,
                    cancellationToken: cancellationToken
                );
            }
        }

        // Process initial payment if provided (Rule 12)
        if (request.InitialPayment != null && request.InitialPayment.Amount > 0)
        {
            await RecordPaymentAsync(sale.Id, new CreatePaymentRequest(
                request.InitialPayment.PaymentMethod,
                request.InitialPayment.Amount,
                request.InitialPayment.ReferenceNo,
                request.InitialPayment.Notes
            ), userId, username, cancellationToken);
        }

        await _auditService.LogAsync("CREATE", "SalesOrder", sale.Id.ToString(), $"Created sale {sale.InvoiceNumber} for {customer.Name} (${sale.TotalAmount:F2})", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSaleByIdAsync(sale.Id, cancellationToken))!;
    }

    public async Task<SalesOrderDto> ConfirmSaleAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var sale = await _context.SalesOrders
            .Include(s => s.Customer)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (sale == null) throw new KeyNotFoundException($"Sales order with ID {id} not found.");
        if (sale.Status != "DRAFT") throw new InvalidOperationException($"Cannot confirm sales order in '{sale.Status}' status.");

        // RULE 4: Validate stock
        foreach (var item in sale.Items)
        {
            var p = item.Product ?? await _context.StockItems.FirstAsync(x => x.Id == item.ProductId, cancellationToken);
            if (p.QuantityOnHand < item.Quantity)
            {
                throw new InvalidOperationException($"Insufficient stock for '{p.Name}'. Available: {p.QuantityOnHand}, Requested: {item.Quantity}");
            }
        }

        // RULE 3: Deduct stock
        foreach (var item in sale.Items)
        {
            await _inventoryService.DecreaseStockAsync(
                productId: item.ProductId,
                warehouseId: sale.WarehouseId,
                quantity: item.Quantity,
                unitPrice: item.UnitPrice,
                referenceType: "SALE",
                referenceNo: sale.InvoiceNumber,
                reason: $"Sale Order #{sale.InvoiceNumber}",
                supplierOrRecipient: sale.Customer?.Name ?? "Customer",
                notes: sale.Notes,
                userId: userId,
                username: username,
                cancellationToken: cancellationToken
            );
        }

        sale.Status = "CONFIRMED";
        sale.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("CONFIRM", "SalesOrder", sale.Id.ToString(), $"Confirmed sale {sale.InvoiceNumber}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSaleByIdAsync(sale.Id, cancellationToken))!;
    }

    public async Task<SalesOrderDto> CancelSaleAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var sale = await _context.SalesOrders
            .Include(s => s.Customer)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (sale == null) throw new KeyNotFoundException($"Sales order with ID {id} not found.");
        if (sale.Status == "CANCELLED") throw new InvalidOperationException("Sale order is already cancelled.");

        // RULE 5: Cancelled Sale -> Reverse Stock (Stock IN)!
        if (sale.Status == "CONFIRMED")
        {
            foreach (var item in sale.Items)
            {
                await _inventoryService.IncreaseStockAsync(
                    productId: item.ProductId,
                    warehouseId: sale.WarehouseId,
                    quantity: item.Quantity,
                    unitCost: item.Product?.CostPrice ?? 0,
                    referenceType: "SALE_CANCEL",
                    referenceNo: sale.InvoiceNumber,
                    reason: $"Cancelled Sale Reversal: {reason}",
                    supplierOrRecipient: sale.Customer?.Name ?? "Customer",
                    notes: $"Reversal of {sale.InvoiceNumber}",
                    userId: userId,
                    username: username,
                    cancellationToken: cancellationToken
                );
            }
        }

        sale.Status = "CANCELLED";
        sale.Notes = string.IsNullOrWhiteSpace(reason) ? sale.Notes : $"{sale.Notes} [Cancelled: {reason}]";
        sale.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("CANCEL", "SalesOrder", sale.Id.ToString(), $"Cancelled sale {sale.InvoiceNumber}: {reason}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSaleByIdAsync(sale.Id, cancellationToken))!;
    }

    // RULE 12: Payments (CASH, BANK_TRANSFER, CARD, QR, CREDIT)
    public async Task<SalePaymentDto> RecordPaymentAsync(int saleId, CreatePaymentRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        if (request.Amount <= 0) throw new InvalidOperationException("Payment amount must be greater than zero.");

        var sale = await _context.SalesOrders.FirstOrDefaultAsync(s => s.Id == saleId, cancellationToken);
        if (sale == null) throw new KeyNotFoundException($"Sales order with ID {saleId} not found.");
        if (sale.Status == "CANCELLED") throw new InvalidOperationException("Cannot record payment for a cancelled sale.");

        var payNo = $"PAY-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var payment = new SalePayment
        {
            PaymentNumber = payNo,
            SalesOrderId = sale.Id,
            PaymentMethod = request.PaymentMethod.Trim().ToUpperInvariant(),
            Amount = request.Amount,
            PaymentDateUtc = DateTimeOffset.UtcNow,
            ReferenceNo = request.ReferenceNo?.Trim(),
            Notes = request.Notes?.Trim(),
            ReceivedByUserId = userId,
            ReceivedByUsername = username,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        sale.PaidAmount += request.Amount;
        sale.RemainingAmount = Math.Max(0, sale.TotalAmount - sale.PaidAmount);

        if (sale.PaidAmount >= sale.TotalAmount)
        {
            sale.PaymentStatus = "PAID";
        }
        else if (sale.PaidAmount > 0)
        {
            sale.PaymentStatus = "PARTIAL";
        }

        sale.UpdatedAtUtc = DateTimeOffset.UtcNow;
        _context.SalePayments.Add(payment);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("PAYMENT", "SalePayment", payment.Id.ToString(), $"Received {payment.PaymentMethod} payment ${payment.Amount:F2} for invoice {sale.InvoiceNumber}. Status: {sale.PaymentStatus}", userId: userId, username: username, cancellationToken: cancellationToken);

        return new SalePaymentDto(
            payment.Id,
            payment.PaymentNumber,
            payment.SalesOrderId,
            payment.PaymentMethod,
            payment.Amount,
            payment.PaymentDateUtc,
            payment.ReferenceNo,
            payment.Notes,
            payment.ReceivedByUsername,
            payment.CreatedAtUtc
        );
    }

    public async Task<IReadOnlyList<SalePaymentDto>> GetPaymentsAsync(int saleId, CancellationToken cancellationToken = default)
    {
        var list = await _context.SalePayments
            .Where(p => p.SalesOrderId == saleId)
            .OrderByDescending(p => p.Id)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return list.Select(p => new SalePaymentDto(
            p.Id,
            p.PaymentNumber,
            p.SalesOrderId,
            p.PaymentMethod,
            p.Amount,
            p.PaymentDateUtc,
            p.ReferenceNo,
            p.Notes,
            p.ReceivedByUsername,
            p.CreatedAtUtc
        )).ToList();
    }

    // RULE 6: Sales Return -> Stock IN
    public async Task<SalesReturnDto> ProcessSalesReturnAsync(CreateSalesReturnRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            throw new InvalidOperationException("Sales return must contain at least one item.");
        }

        var sale = await _context.SalesOrders
            .Include(s => s.Customer)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == request.SalesOrderId, cancellationToken);

        if (sale == null) throw new KeyNotFoundException($"Sales order with ID {request.SalesOrderId} not found.");
        if (sale.Status != "CONFIRMED") throw new InvalidOperationException($"Cannot return items for order in '{sale.Status}' status.");

        var retNo = $"SR-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var sr = new SalesReturn
        {
            ReturnNumber = retNo,
            SalesOrderId = sale.Id,
            CustomerId = sale.CustomerId,
            WarehouseId = request.WarehouseId ?? sale.WarehouseId,
            ReturnDateUtc = DateTimeOffset.UtcNow,
            Status = "COMPLETED",
            Reason = request.Reason.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedByUserId = userId,
            CreatedByUsername = username,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        decimal totalRefund = 0;
        foreach (var itemReq in request.Items)
        {
            var saleItem = sale.Items.FirstOrDefault(i => i.ProductId == itemReq.ProductId);
            if (saleItem == null) throw new InvalidOperationException($"Product ID {itemReq.ProductId} was not found on invoice {sale.InvoiceNumber}.");

            if (itemReq.Quantity <= 0 || itemReq.Quantity > saleItem.Quantity)
            {
                throw new InvalidOperationException($"Invalid return quantity {itemReq.Quantity} for product ID {itemReq.ProductId}.");
            }

            var lineRefund = itemReq.Quantity * saleItem.UnitPrice;
            totalRefund += lineRefund;

            sr.Items.Add(new SalesReturnItem
            {
                ProductId = itemReq.ProductId,
                Quantity = itemReq.Quantity,
                UnitPrice = saleItem.UnitPrice,
                Subtotal = lineRefund,
                Condition = itemReq.Condition?.Trim() ?? "Good",
                Reason = itemReq.Reason?.Trim()
            });

            // RULE 6: Sales Return -> Stock IN!
            await _inventoryService.IncreaseStockAsync(
                productId: itemReq.ProductId,
                warehouseId: sr.WarehouseId,
                quantity: itemReq.Quantity,
                unitCost: saleItem.Product?.CostPrice ?? 0,
                referenceType: "SALES_RETURN",
                referenceNo: retNo,
                reason: $"Sales Return: {request.Reason}",
                supplierOrRecipient: sale.Customer?.Name ?? "Customer",
                notes: itemReq.Reason,
                userId: userId,
                username: username,
                cancellationToken: cancellationToken
            );
        }

        sr.RefundAmount = totalRefund;
        _context.SalesReturns.Add(sr);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("RETURN", "SalesReturn", sr.Id.ToString(), $"Processed sales return {sr.ReturnNumber} for invoice {sale.InvoiceNumber} (Refund: ${sr.RefundAmount:F2})", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSalesReturnByIdAsync(sr.Id, cancellationToken))!;
    }

    public async Task<PagedResult<SalesReturnDto>> GetSalesReturnsAsync(int? customerId, int? saleId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.SalesReturns
            .Include(r => r.Customer)
            .Include(r => r.SalesOrder)
            .Include(r => r.Warehouse)
            .Include(r => r.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking();

        if (customerId.HasValue) query = query.Where(r => r.CustomerId == customerId.Value);
        if (saleId.HasValue) query = query.Where(r => r.SalesOrderId == saleId.Value);

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToReturnDto).ToList();
        return new PagedResult<SalesReturnDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<SalesReturnDto?> GetSalesReturnByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var r = await _context.SalesReturns
            .Include(x => x.Customer)
            .Include(x => x.SalesOrder)
            .Include(x => x.Warehouse)
            .Include(x => x.Items)
            .ThenInclude(i => i.Product)
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        return r == null ? null : MapToReturnDto(r);
    }

    private static SalesOrderDto MapToSaleDto(SalesOrder s) => new(
        s.Id,
        s.InvoiceNumber,
        s.CustomerId,
        s.Customer?.Name ?? "Customer",
        s.WarehouseId,
        s.Warehouse?.Name ?? "Main Warehouse",
        s.SaleDateUtc,
        s.Status,
        s.PaymentStatus,
        s.Subtotal,
        s.Tax,
        s.Discount,
        s.TotalAmount,
        s.PaidAmount,
        s.RemainingAmount,
        s.Notes,
        s.CreatedByUsername,
        s.CreatedAtUtc,
        s.UpdatedAtUtc,
        s.Items.Select(i => new SalesOrderItemDto(
            i.Id,
            i.ProductId,
            i.Product?.Sku ?? "N/A",
            i.Product?.Name ?? "N/A",
            i.Quantity,
            i.UnitPrice,
            i.Discount,
            i.Tax,
            i.Subtotal
        )).ToList(),
        s.Payments.Select(p => new SalePaymentDto(
            p.Id,
            p.PaymentNumber,
            p.SalesOrderId,
            p.PaymentMethod,
            p.Amount,
            p.PaymentDateUtc,
            p.ReferenceNo,
            p.Notes,
            p.ReceivedByUsername,
            p.CreatedAtUtc
        )).ToList()
    );

    private static SalesReturnDto MapToReturnDto(SalesReturn r) => new(
        r.Id,
        r.ReturnNumber,
        r.SalesOrderId,
        r.SalesOrder?.InvoiceNumber ?? "N/A",
        r.CustomerId,
        r.Customer?.Name ?? "Customer",
        r.WarehouseId,
        r.Warehouse?.Name ?? "Main Warehouse",
        r.ReturnDateUtc,
        r.Status,
        r.RefundAmount,
        r.Reason,
        r.Notes,
        r.CreatedByUsername,
        r.CreatedAtUtc,
        r.Items.Select(i => new SalesReturnItemDto(
            i.Id,
            i.ProductId,
            i.Product?.Sku ?? "N/A",
            i.Product?.Name ?? "N/A",
            i.Quantity,
            i.UnitPrice,
            i.Subtotal,
            i.Condition,
            i.Reason
        )).ToList()
    );
}
