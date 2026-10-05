using backend.Data;
using backend.Models.Data;
using backend.Modules.Audit.Services;
using backend.Modules.Common;
using backend.Modules.Customers.Models;
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
    Task<SalesOrderDto> UpdateSaleAsync(int id, UpdateSaleRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> UpdateSaleStatusAsync(int id, string nextStatus, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> ConfirmSaleAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> DeliverSaleAsync(int id, int? warehouseId, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SalesOrderDto> CancelSaleAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<bool> DeleteSaleAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default);

    // Payments
    Task<SalePaymentDto> RecordPaymentAsync(int saleId, CreatePaymentRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SalePaymentDto>> GetPaymentsAsync(int saleId, CancellationToken cancellationToken = default);

    // Sales Returns
    Task<PagedResult<SalesReturnDto>> GetSalesReturnsAsync(string? status, int? customerId, int? saleId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<SalesReturnDto?> GetSalesReturnByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<SalesReturnDto> ProcessSalesReturnAsync(CreateSalesReturnRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SalesReturnDto> ConfirmSalesReturnAsync(int id, int? warehouseId, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SalesReturnDto> CancelSalesReturnAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default);
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
            var st = status.Trim().ToUpperInvariant();
            if (st == "CONFIRMED" || st == "SALES_ORDER")
            {
                query = query.Where(s => s.Status == "CONFIRMED" || s.Status == "SALES_ORDER");
            }
            else if (st == "QUOTATION" || st == "DRAFT" || st == "PENDING")
            {
                query = query.Where(s => s.Status == "QUOTATION" || s.Status == "DRAFT" || s.Status == "PENDING");
            }
            else if (st == "DELIVERED" || st == "COMPLETED")
            {
                query = query.Where(s => s.Status == "DELIVERED" || s.Status == "COMPLETED");
            }
            else
            {
                query = query.Where(s => s.Status == st);
            }
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

        Customer? customer = null;
        if (request.CustomerId.HasValue && request.CustomerId.Value > 0)
        {
            customer = await _context.Customers.FirstOrDefaultAsync(c => c.Id == request.CustomerId.Value, cancellationToken);
        }

        var custName = request.CustomerName?.Trim();
        if (customer == null && !string.IsNullOrWhiteSpace(custName))
        {
            customer = await _context.Customers.FirstOrDefaultAsync(c => c.Name.ToLower() == custName.ToLower(), cancellationToken);
            if (customer == null)
            {
                customer = new Customer
                {
                    CustomerCode = $"CUST-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
                    Name = custName,
                    CustomerType = "Standard",
                    PaymentTerms = "Cash",
                    IsActive = true,
                    CreatedAtUtc = DateTimeOffset.UtcNow
                };
                _context.Customers.Add(customer);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        if (customer == null)
        {
            customer = await _context.Customers.FirstOrDefaultAsync(cancellationToken);
            if (customer == null)
            {
                customer = new Customer
                {
                    CustomerCode = "CUST-DEFAULT",
                    Name = "General Customer",
                    CustomerType = "Standard",
                    PaymentTerms = "Cash",
                    IsActive = true,
                    CreatedAtUtc = DateTimeOffset.UtcNow
                };
                _context.Customers.Add(customer);
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        var warehouseId = request.WarehouseId;
        if (!warehouseId.HasValue || warehouseId.Value <= 0)
        {
            warehouseId = await _context.Warehouses.Where(w => w.IsActive).Select(w => (int?)w.Id).FirstOrDefaultAsync(cancellationToken);
        }
        if (!warehouseId.HasValue)
        {
            throw new InvalidOperationException("Please select a valid warehouse for this sales order.");
        }
        var warehouse = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == warehouseId.Value, cancellationToken);
        if (warehouse == null)
        {
            throw new InvalidOperationException($"Selected warehouse #{warehouseId.Value} does not exist.");
        }

        var invoiceNo = $"INV-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var sale = new SalesOrder
        {
            InvoiceNumber = invoiceNo,
            CustomerId = customer.Id,
            WarehouseId = warehouseId,
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

            StockItem? product = null;
            if (item.ProductId.HasValue && item.ProductId.Value > 0)
            {
                product = await _context.StockItems.FirstOrDefaultAsync(p => p.Id == item.ProductId.Value, cancellationToken);
            }
            if (product == null && !string.IsNullOrWhiteSpace(item.ProductSku))
            {
                product = await _context.StockItems.FirstOrDefaultAsync(p => p.Sku.ToLower() == item.ProductSku.Trim().ToLower(), cancellationToken);
            }
            var itemName = item.ItemName?.Trim() ?? item.ProductName?.Trim();
            if (product == null && !string.IsNullOrWhiteSpace(itemName))
            {
                product = await _context.StockItems.FirstOrDefaultAsync(p => p.Name.ToLower() == itemName.ToLower(), cancellationToken);
            }

            if (product == null)
            {
                throw new InvalidOperationException($"Product '{itemName ?? item.ProductSku ?? "N/A"}' was not found in stock catalog. All sale items must be selected from active stock.");
            }

            // RULE: Validate stock in the specified warehouse
            var ws = await _context.WarehouseStocks
                .FirstOrDefaultAsync(s => s.WarehouseId == warehouseId.Value && s.ProductId == product.Id, cancellationToken);
            var availableInWh = ws?.QuantityOnHand ?? 0;

            if (availableInWh < item.Quantity)
            {
                throw new InvalidOperationException($"Insufficient stock for '{product.Name}' in '{warehouse.Name}'. Available in warehouse: {availableInWh}, Requested: {item.Quantity}. Please adjust quantity or select another warehouse.");
            }

            var unitPriceEffective = item.UnitPrice > 0 ? item.UnitPrice : (product.SellingPrice > 0 ? product.SellingPrice : (item.UnitCost ?? 0));
            var lineSubtotal = (item.Quantity * unitPriceEffective) - item.Discount + item.Tax;
            subtotal += lineSubtotal;

            sale.Items.Add(new SalesOrderItem
            {
                ProductId = product.Id,
                Quantity = item.Quantity,
                UnitPrice = Math.Max(0, unitPriceEffective),
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

    public async Task<SalesOrderDto> UpdateSaleAsync(int id, UpdateSaleRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var sale = await _context.SalesOrders
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (sale == null) throw new KeyNotFoundException($"Sales order with ID {id} not found.");

        if (sale.Status == "CONFIRMED" || sale.Status == "DELIVERED")
        {
            throw new InvalidOperationException("Cannot modify an already confirmed or delivered sales order.");
        }

        if (request.CustomerId.HasValue && request.CustomerId.Value > 0)
        {
            sale.CustomerId = request.CustomerId.Value;
        }
        else if (!string.IsNullOrWhiteSpace(request.CustomerName))
        {
            var customer = await _context.Customers.FirstOrDefaultAsync(c => c.Name.ToLower() == request.CustomerName.Trim().ToLower(), cancellationToken);
            if (customer == null)
            {
                customer = new Customer
                {
                    CustomerCode = $"CUST-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}",
                    Name = request.CustomerName.Trim(),
                    CustomerType = "Retail",
                    PaymentTerms = "Cash",
                    IsActive = true,
                    CreatedAtUtc = DateTimeOffset.UtcNow
                };
                _context.Customers.Add(customer);
                await _context.SaveChangesAsync(cancellationToken);
            }
            sale.CustomerId = customer.Id;
        }

        if (request.WarehouseId.HasValue) sale.WarehouseId = request.WarehouseId;
        if (request.DeliveryDate.HasValue) sale.SaleDateUtc = request.DeliveryDate.Value;
        sale.Tax = Math.Max(0, request.Tax);
        sale.Discount = Math.Max(0, request.Discount);
        if (request.Notes != null) sale.Notes = request.Notes.Trim();

        if (request.Items != null && request.Items.Count > 0)
        {
            _context.SalesOrderItems.RemoveRange(sale.Items);
            sale.Items.Clear();

            decimal subtotal = 0;
            foreach (var item in request.Items)
            {
                if (item.Quantity <= 0) continue;

                StockItem? product = null;
                if (item.ProductId.HasValue && item.ProductId.Value > 0)
                {
                    product = await _context.StockItems.FirstOrDefaultAsync(p => p.Id == item.ProductId.Value, cancellationToken);
                }

                var itemName = item.ItemName?.Trim() ?? item.ProductName?.Trim() ?? item.ProductSku?.Trim();
                if (product == null && !string.IsNullOrWhiteSpace(itemName))
                {
                    product = await _context.StockItems.FirstOrDefaultAsync(p => p.Name.ToLower() == itemName.ToLower() || p.Sku.ToLower() == itemName.ToLower(), cancellationToken);
                }

                if (product == null)
                {
                    product = await _context.StockItems.FirstOrDefaultAsync(cancellationToken);
                    if (product == null) throw new InvalidOperationException("No product available.");
                }

                var unitPriceEffective = item.UnitPrice > 0 ? item.UnitPrice : (product.SellingPrice > 0 ? product.SellingPrice : (item.UnitCost ?? 0));
                var lineSubtotal = (item.Quantity * unitPriceEffective) - item.Discount + item.Tax;
                subtotal += lineSubtotal;

                sale.Items.Add(new SalesOrderItem
                {
                    ProductId = product.Id,
                    Quantity = item.Quantity,
                    UnitPrice = Math.Max(0, unitPriceEffective),
                    Discount = Math.Max(0, item.Discount),
                    Tax = Math.Max(0, item.Tax),
                    Subtotal = lineSubtotal
                });
            }

            sale.Subtotal = subtotal;
            sale.TotalAmount = Math.Max(0, subtotal + sale.Tax - sale.Discount);
            sale.RemainingAmount = Math.Max(0, sale.TotalAmount - sale.PaidAmount);
        }

        sale.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("UPDATE", "SalesOrder", sale.Id.ToString(), $"Updated sales order {sale.InvoiceNumber}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSaleByIdAsync(sale.Id, cancellationToken))!;
    }

    public async Task<SalesOrderDto> UpdateSaleStatusAsync(int id, string nextStatus, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var normalized = nextStatus.Trim().ToUpperInvariant();
        if (normalized == "CONFIRMED" || normalized == "SALES_ORDER")
        {
            return await ConfirmSaleAsync(id, userId, username, cancellationToken);
        }
        else if (normalized == "DELIVERED")
        {
            return await DeliverSaleAsync(id, null, userId, username, cancellationToken);
        }
        else if (normalized == "CANCELLED")
        {
            return await CancelSaleAsync(id, "Status changed to CANCELLED", userId, username, cancellationToken);
        }

        var existing = await _context.SalesOrders.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (existing == null) throw new KeyNotFoundException($"Sales order with ID {id} not found.");
        existing.Status = normalized;
        existing.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        return (await GetSaleByIdAsync(id, cancellationToken))!;
    }

    public async Task<SalesOrderDto> ConfirmSaleAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var sale = await _context.SalesOrders
            .Include(s => s.Customer)
            .Include(s => s.Warehouse)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (sale == null) throw new KeyNotFoundException($"Sales order with ID {id} not found.");
        if (sale.Status != "DRAFT" && sale.Status != "QUOTATION" && sale.Status != "PENDING" && sale.Status != "SALES_ORDER")
        {
            throw new InvalidOperationException($"Cannot confirm sales order in '{sale.Status}' status.");
        }

        var warehouseId = sale.WarehouseId ?? await _context.Warehouses.Where(w => w.IsActive).Select(w => (int?)w.Id).FirstOrDefaultAsync(cancellationToken);
        if (!warehouseId.HasValue)
        {
            throw new InvalidOperationException("Sales order must have a designated warehouse before confirming.");
        }
        sale.WarehouseId = warehouseId;
        var wh = sale.Warehouse ?? await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == warehouseId.Value, cancellationToken);

        // RULE: Validate stock in the designated warehouse
        foreach (var item in sale.Items)
        {
            var p = item.Product ?? await _context.StockItems.FirstAsync(x => x.Id == item.ProductId, cancellationToken);
            var ws = await _context.WarehouseStocks
                .FirstOrDefaultAsync(s => s.WarehouseId == warehouseId.Value && s.ProductId == item.ProductId, cancellationToken);
            var available = ws?.QuantityOnHand ?? 0;
            if (available < item.Quantity)
            {
                throw new InvalidOperationException($"Insufficient stock for '{p.Name}' in '{wh?.Name ?? "Selected Warehouse"}'. Available in warehouse: {available}, Requested: {item.Quantity}.");
            }
        }

        // Set status to CONFIRMED (Awaiting warehouse delivery)
        sale.Status = "CONFIRMED";
        sale.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("CONFIRM", "SalesOrder", sale.Id.ToString(), $"Confirmed sales order {sale.InvoiceNumber} for {sale.Customer?.Name} (Ready for warehouse delivery from {wh?.Name})", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSaleByIdAsync(sale.Id, cancellationToken))!;
    }

    public async Task<SalesOrderDto> DeliverSaleAsync(int id, int? warehouseId, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var sale = await _context.SalesOrders
            .Include(s => s.Customer)
            .Include(s => s.Warehouse)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (sale == null) throw new KeyNotFoundException($"Sales order with ID {id} not found.");
        if (sale.Status == "DELIVERED")
        {
            throw new InvalidOperationException($"Sales order {sale.InvoiceNumber} has already been delivered and stock deducted.");
        }
        if (sale.Status != "CONFIRMED" && sale.Status != "SALES_ORDER")
        {
            throw new InvalidOperationException($"Cannot deliver sales order in '{sale.Status}' status. Order must be CONFIRMED before warehouse dispatch.");
        }

        var targetWarehouseId = warehouseId ?? sale.WarehouseId;
        if (!targetWarehouseId.HasValue)
        {
            targetWarehouseId = await _context.Warehouses.Where(w => w.IsActive).Select(w => (int?)w.Id).FirstOrDefaultAsync(cancellationToken);
            if (!targetWarehouseId.HasValue)
            {
                throw new InvalidOperationException("Please select an active warehouse to dispatch from.");
            }
        }
        sale.WarehouseId = targetWarehouseId;
        var wh = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == targetWarehouseId.Value, cancellationToken);

        // 1. Verify stock in the warehouse
        foreach (var item in sale.Items)
        {
            var p = item.Product ?? await _context.StockItems.FirstAsync(x => x.Id == item.ProductId, cancellationToken);
            var ws = await _context.WarehouseStocks
                .FirstOrDefaultAsync(s => s.WarehouseId == targetWarehouseId.Value && s.ProductId == item.ProductId, cancellationToken);
            var available = ws?.QuantityOnHand ?? 0;
            if (available < item.Quantity)
            {
                throw new InvalidOperationException($"Cannot dispatch: Insufficient stock for '{p.Name}' in '{wh?.Name ?? "Warehouse"}'. Available: {available}, Required: {item.Quantity}.");
            }
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        // 2. Physical Stock OUT from the warehouse
        foreach (var item in sale.Items)
        {
            await _inventoryService.DecreaseStockAsync(
                productId: item.ProductId,
                warehouseId: targetWarehouseId.Value,
                quantity: item.Quantity,
                unitPrice: item.UnitPrice,
                referenceType: "SALE",
                referenceNo: sale.InvoiceNumber,
                reason: $"Warehouse Dispatch: Delivered from {wh?.Name ?? "Warehouse"} for Sale #{sale.InvoiceNumber}",
                supplierOrRecipient: sale.Customer?.Name ?? "Customer",
                notes: sale.Notes,
                userId: userId,
                username: username,
                cancellationToken: cancellationToken
            );
        }

        sale.Status = "DELIVERED";
        sale.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await _auditService.LogAsync("DELIVER", "SalesOrder", sale.Id.ToString(), $"Dispatched and delivered sales order {sale.InvoiceNumber} from {wh?.Name ?? "Warehouse"} (Physical Stock OUT completed)", userId: userId, username: username, cancellationToken: cancellationToken);

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

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        // RULE 5: Cancelled Sale -> Reverse Stock ONLY if it was previously delivered/deducted!
        if (sale.Status == "DELIVERED")
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
        await transaction.CommitAsync(cancellationToken);

        await _auditService.LogAsync("CANCEL", "SalesOrder", sale.Id.ToString(), $"Cancelled sale {sale.InvoiceNumber}: {reason}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSaleByIdAsync(sale.Id, cancellationToken))!;
    }

    public async Task<bool> DeleteSaleAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var sale = await _context.SalesOrders
            .Include(s => s.Items)
            .Include(s => s.Payments)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (sale == null) return false;

        _context.SalesOrderItems.RemoveRange(sale.Items);
        _context.SalePayments.RemoveRange(sale.Payments);
        _context.SalesOrders.Remove(sale);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("DELETE", "SalesOrder", id.ToString(), $"Deleted sales order {sale.InvoiceNumber}", userId: userId, username: username, cancellationToken: cancellationToken);
        return true;
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

    // Sales Returns: Creation -> PENDING (Awaiting Stock Confirmation)
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
        if (sale.Status != "DELIVERED" && sale.Status != "COMPLETED")
        {
            throw new InvalidOperationException($"Cannot return items for sales order in '{sale.Status}' status. Sales order must be DELIVERED and physically dispatched from warehouse before customer returns can be accepted.");
        }

        var warehouseId = request.WarehouseId ?? sale.WarehouseId;
        if (!warehouseId.HasValue)
        {
            warehouseId = await _context.Warehouses.Where(w => w.IsActive).Select(w => (int?)w.Id).FirstOrDefaultAsync(cancellationToken);
        }

        var retNo = $"SR-{DateTimeOffset.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";
        var sr = new SalesReturn
        {
            ReturnNumber = retNo,
            SalesOrderId = sale.Id,
            CustomerId = sale.CustomerId,
            WarehouseId = warehouseId,
            ReturnDateUtc = DateTimeOffset.UtcNow,
            Status = "PENDING", // Initial status awaiting stock confirmation
            Reason = request.Reason.Trim(),
            Notes = request.Notes?.Trim(),
            CreatedByUserId = userId,
            CreatedByUsername = username,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        decimal totalRefund = 0;
        foreach (var itemReq in request.Items)
        {
            var saleItem = sale.Items.FirstOrDefault(i => i.ProductId == itemReq.ProductId || i.Id == itemReq.ProductId);
            if (saleItem == null)
            {
                throw new InvalidOperationException($"Product with ID {itemReq.ProductId} was not found on sales order {sale.InvoiceNumber}.");
            }

            var prevReturned = await _context.SalesReturnItems
                .Where(ri => ri.SalesReturn != null && ri.SalesReturn.SalesOrderId == sale.Id && ri.SalesReturn.Status != "CANCELLED" && ri.ProductId == saleItem.ProductId)
                .SumAsync(ri => (int?)ri.Quantity, cancellationToken) ?? 0;

            if (itemReq.Quantity <= 0 || prevReturned + itemReq.Quantity > saleItem.Quantity)
            {
                throw new InvalidOperationException($"Cannot return {itemReq.Quantity} units. Originally delivered: {saleItem.Quantity}, already pending/returned: {prevReturned}. Maximum returnable: {saleItem.Quantity - prevReturned}.");
            }

            var lineRefund = itemReq.Quantity * saleItem.UnitPrice;
            totalRefund += lineRefund;

            sr.Items.Add(new SalesReturnItem
            {
                ProductId = saleItem.ProductId,
                Quantity = itemReq.Quantity,
                UnitPrice = saleItem.UnitPrice,
                Subtotal = lineRefund,
                Condition = itemReq.Condition?.Trim() ?? "Good",
                Reason = itemReq.Reason?.Trim()
            });
        }

        sr.RefundAmount = totalRefund;
        _context.SalesReturns.Add(sr);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("RETURN_REQUEST", "SalesReturn", sr.Id.ToString(), $"Created sales return request {sr.ReturnNumber} for invoice {sale.InvoiceNumber} (Refund: ${sr.RefundAmount:F2}, Awaiting stock keeper confirmation)", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSalesReturnByIdAsync(sr.Id, cancellationToken))!;
    }

    // Stock Confirmation -> Physical Stock IN
    public async Task<SalesReturnDto> ConfirmSalesReturnAsync(int id, int? warehouseId, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var sr = await _context.SalesReturns
            .Include(r => r.Customer)
            .Include(r => r.SalesOrder)
            .Include(r => r.Warehouse)
            .Include(r => r.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (sr == null) throw new KeyNotFoundException($"Sales return with ID {id} not found.");
        if (sr.Status == "COMPLETED")
        {
            throw new InvalidOperationException($"Sales return {sr.ReturnNumber} has already been confirmed and restocked into warehouse.");
        }
        if (sr.Status == "CANCELLED")
        {
            throw new InvalidOperationException($"Cannot confirm cancelled sales return {sr.ReturnNumber}.");
        }

        var targetWarehouseId = warehouseId ?? sr.WarehouseId ?? sr.SalesOrder?.WarehouseId;
        if (!targetWarehouseId.HasValue)
        {
            targetWarehouseId = await _context.Warehouses.Where(w => w.IsActive).Select(w => (int?)w.Id).FirstOrDefaultAsync(cancellationToken);
            if (!targetWarehouseId.HasValue)
            {
                throw new InvalidOperationException("Please select an active warehouse to receive returned items into.");
            }
        }

        sr.WarehouseId = targetWarehouseId;
        var wh = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == targetWarehouseId.Value, cancellationToken);

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        foreach (var item in sr.Items)
        {
            var p = item.Product ?? await _context.StockItems.FirstOrDefaultAsync(x => x.Id == item.ProductId, cancellationToken);
            var unitCost = p?.CostPrice ?? (item.UnitPrice * 0.7m);

            // RULE 6: Customer Return Confirmed -> Physical Stock IN
            await _inventoryService.IncreaseStockAsync(
                productId: item.ProductId,
                warehouseId: targetWarehouseId.Value,
                quantity: item.Quantity,
                unitCost: unitCost,
                referenceType: "SALES_RETURN",
                referenceNo: sr.ReturnNumber,
                reason: $"Customer Return Confirmed: {sr.Reason} (Restocked into {wh?.Name ?? "Warehouse"})",
                supplierOrRecipient: sr.Customer?.Name ?? "Customer",
                notes: item.Reason,
                userId: userId,
                username: username,
                cancellationToken: cancellationToken
            );
        }

        sr.Status = "COMPLETED";
        sr.ConfirmedByUserId = userId;
        sr.ConfirmedByUsername = username;
        sr.ConfirmedAtUtc = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        await _auditService.LogAsync("RETURN_CONFIRM", "SalesReturn", sr.Id.ToString(), $"Confirmed sales return {sr.ReturnNumber} for invoice {sr.SalesOrder?.InvoiceNumber} into {wh?.Name ?? "Warehouse"} (Physical Stock IN completed)", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSalesReturnByIdAsync(sr.Id, cancellationToken))!;
    }

    public async Task<SalesReturnDto> CancelSalesReturnAsync(int id, string? reason, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var sr = await _context.SalesReturns
            .Include(r => r.Customer)
            .Include(r => r.SalesOrder)
            .Include(r => r.Warehouse)
            .Include(r => r.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);

        if (sr == null) throw new KeyNotFoundException($"Sales return with ID {id} not found.");
        if (sr.Status == "COMPLETED")
        {
            throw new InvalidOperationException($"Cannot cancel sales return {sr.ReturnNumber} because it has already been restocked into inventory.");
        }
        if (sr.Status == "CANCELLED")
        {
            throw new InvalidOperationException($"Sales return {sr.ReturnNumber} is already cancelled.");
        }

        sr.Status = "CANCELLED";
        sr.Notes = string.IsNullOrWhiteSpace(reason)
            ? sr.Notes
            : (string.IsNullOrEmpty(sr.Notes) ? $"Cancelled: {reason}" : $"{sr.Notes} | Cancelled: {reason}");

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync("RETURN_CANCEL", "SalesReturn", sr.Id.ToString(), $"Cancelled sales return request {sr.ReturnNumber}. Reason: {reason}", userId: userId, username: username, cancellationToken: cancellationToken);

        return (await GetSalesReturnByIdAsync(sr.Id, cancellationToken))!;
    }

    public async Task<PagedResult<SalesReturnDto>> GetSalesReturnsAsync(string? status, int? customerId, int? saleId, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default)
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

        if (!string.IsNullOrWhiteSpace(status) && status.ToUpperInvariant() != "ALL")
        {
            var st = status.Trim().ToUpperInvariant();
            query = query.Where(r => r.Status == st);
        }

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
        r.ConfirmedByUsername,
        r.ConfirmedAtUtc,
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
