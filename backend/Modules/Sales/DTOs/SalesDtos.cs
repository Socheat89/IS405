namespace backend.Modules.Sales.DTOs;

public record SalesOrderDto(
    int Id,
    string InvoiceNumber,
    int CustomerId,
    string CustomerName,
    int? WarehouseId,
    string? WarehouseName,
    DateTimeOffset SaleDateUtc,
    string Status,
    string PaymentStatus,
    decimal Subtotal,
    decimal Tax,
    decimal Discount,
    decimal TotalAmount,
    decimal PaidAmount,
    decimal RemainingAmount,
    string? Notes,
    string? CreatedByUsername,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc,
    IReadOnlyList<SalesOrderItemDto> Items,
    IReadOnlyList<SalePaymentDto> Payments
);

public record SalesOrderItemDto(
    int Id,
    int ProductId,
    string ProductSku,
    string ProductName,
    int Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal Tax,
    decimal Subtotal
);

public record CreateSaleRequest(
    int CustomerId,
    int? WarehouseId,
    decimal Tax,
    decimal Discount,
    string? Notes,
    bool AutoConfirm, // if true, status = CONFIRMED & Stock OUT immediately (Rule 3)
    IReadOnlyList<CreateSaleItemRequest> Items,
    InitialPaymentRequest? InitialPayment
);

public record CreateSaleItemRequest(
    int ProductId,
    int Quantity,
    decimal UnitPrice,
    decimal Discount,
    decimal Tax
);

public record InitialPaymentRequest(
    string PaymentMethod, // CASH, BANK_TRANSFER, CARD, QR, CREDIT
    decimal Amount,
    string? ReferenceNo,
    string? Notes
);

public record SalePaymentDto(
    int Id,
    string PaymentNumber,
    int SalesOrderId,
    string PaymentMethod,
    decimal Amount,
    DateTimeOffset PaymentDateUtc,
    string? ReferenceNo,
    string? Notes,
    string? ReceivedByUsername,
    DateTimeOffset CreatedAtUtc
);

public record CreatePaymentRequest(
    string PaymentMethod,
    decimal Amount,
    string? ReferenceNo,
    string? Notes
);

public record SalesReturnDto(
    int Id,
    string ReturnNumber,
    int SalesOrderId,
    string InvoiceNumber,
    int CustomerId,
    string CustomerName,
    int? WarehouseId,
    string? WarehouseName,
    DateTimeOffset ReturnDateUtc,
    string Status,
    decimal RefundAmount,
    string? Reason,
    string? Notes,
    string? CreatedByUsername,
    DateTimeOffset CreatedAtUtc,
    IReadOnlyList<SalesReturnItemDto> Items
);

public record SalesReturnItemDto(
    int Id,
    int ProductId,
    string ProductSku,
    string ProductName,
    int Quantity,
    decimal UnitPrice,
    decimal Subtotal,
    string? Condition,
    string? Reason
);

public record CreateSalesReturnRequest(
    int SalesOrderId,
    int? WarehouseId,
    string Reason,
    string? Notes,
    IReadOnlyList<CreateSalesReturnItemRequest> Items
);

public record CreateSalesReturnItemRequest(
    int ProductId,
    int Quantity,
    string? Condition,
    string? Reason
);
