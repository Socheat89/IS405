using backend.Models.Data;
using backend.Modules.Customers.Models;
using backend.Modules.Inventory.Models;

namespace backend.Modules.Sales.Models;

public class SalesOrder
{
    public int Id { get; set; }
    public required string InvoiceNumber { get; set; } // e.g. INV-202609-0001
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public int? WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }
    public DateTimeOffset SaleDateUtc { get; set; } = DateTimeOffset.UtcNow;
    public string Status { get; set; } = "CONFIRMED"; // DRAFT, CONFIRMED, CANCELLED
    public string PaymentStatus { get; set; } = "UNPAID"; // UNPAID, PARTIAL, PAID, REFUNDED
    public decimal Subtotal { get; set; }
    public decimal Tax { get; set; }
    public decimal Discount { get; set; }
    public decimal TotalAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal RemainingAmount { get; set; }
    public string? Notes { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByUsername { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? UpdatedAtUtc { get; set; }
    public ICollection<SalesOrderItem> Items { get; set; } = [];
    public ICollection<SalePayment> Payments { get; set; } = [];
    public ICollection<SalesReturn> Returns { get; set; } = [];
}

public class SalesOrderItem
{
    public int Id { get; set; }
    public int SalesOrderId { get; set; }
    public SalesOrder? SalesOrder { get; set; }
    public int ProductId { get; set; }
    public StockItem? Product { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Discount { get; set; }
    public decimal Tax { get; set; }
    public decimal Subtotal { get; set; }
}

public class SalePayment
{
    public int Id { get; set; }
    public required string PaymentNumber { get; set; } // e.g. PAY-202609-0001
    public int SalesOrderId { get; set; }
    public SalesOrder? SalesOrder { get; set; }
    public string PaymentMethod { get; set; } = "CASH"; // CASH, BANK_TRANSFER, CARD, QR, CREDIT
    public decimal Amount { get; set; }
    public DateTimeOffset PaymentDateUtc { get; set; } = DateTimeOffset.UtcNow;
    public string? ReferenceNo { get; set; }
    public string? Notes { get; set; }
    public int? ReceivedByUserId { get; set; }
    public string? ReceivedByUsername { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}

public class SalesReturn
{
    public int Id { get; set; }
    public required string ReturnNumber { get; set; } // e.g. SR-202609-0001
    public int SalesOrderId { get; set; }
    public SalesOrder? SalesOrder { get; set; }
    public int CustomerId { get; set; }
    public Customer? Customer { get; set; }
    public int? WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }
    public DateTimeOffset ReturnDateUtc { get; set; } = DateTimeOffset.UtcNow;
    public string Status { get; set; } = "COMPLETED"; // DRAFT, COMPLETED, CANCELLED
    public decimal RefundAmount { get; set; }
    public string? Reason { get; set; }
    public string? Notes { get; set; }
    public int? CreatedByUserId { get; set; }
    public string? CreatedByUsername { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public ICollection<SalesReturnItem> Items { get; set; } = [];
}

public class SalesReturnItem
{
    public int Id { get; set; }
    public int SalesReturnId { get; set; }
    public SalesReturn? SalesReturn { get; set; }
    public int ProductId { get; set; }
    public StockItem? Product { get; set; }
    public int Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal Subtotal { get; set; }
    public string? Condition { get; set; } // Good, Damaged
    public string? Reason { get; set; }
}
