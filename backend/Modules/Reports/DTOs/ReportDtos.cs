namespace backend.Modules.Reports.DTOs;

public record DashboardSummaryDto(
    decimal TotalSales,
    decimal TotalPurchases,
    decimal TotalStockValue,
    int TotalProducts,
    int TotalCustomers,
    int LowStockCount,
    int OutOfStockCount,
    int TodayInCount,
    int TodayOutCount,
    IReadOnlyList<DailyMetricDto> SalesChartData,
    IReadOnlyList<DailyMetricDto> PurchaseChartData,
    IReadOnlyList<TopProductDto> TopSellingProducts
);

public record DailyMetricDto(
    string Date,
    decimal Amount,
    int Count
);

public record TopProductDto(
    int ProductId,
    string Sku,
    string Name,
    int QuantitySold,
    decimal TotalRevenue
);

public record InventoryValuationDto(
    int TotalItems,
    int TotalQuantity,
    decimal TotalValuationCost,
    decimal TotalValuationRetail,
    decimal PotentialProfit,
    IReadOnlyList<CategoryValuationDto> ByCategory
);

public record CategoryValuationDto(
    string CategoryName,
    int ItemCount,
    int TotalQuantity,
    decimal TotalCostValue
);

public record PurchaseReportDto(
    decimal TotalPurchases,
    int TotalOrders,
    int ReceivedOrders,
    int PendingOrders,
    IReadOnlyList<SupplierPurchaseSummaryDto> BySupplier
);

public record SupplierPurchaseSummaryDto(
    int SupplierId,
    string SupplierName,
    int OrderCount,
    decimal TotalPurchased
);

public record SalesProfitReportDto(
    decimal TotalRevenue,
    decimal TotalCost,
    decimal GrossProfit,
    decimal ProfitMarginPercentage,
    int TotalSalesCount,
    decimal OutstandingPayments,
    IReadOnlyList<CustomerSalesSummaryDto> ByCustomer
);

public record CustomerSalesSummaryDto(
    int CustomerId,
    string CustomerName,
    int SaleCount,
    decimal TotalSpent,
    decimal OutstandingBalance
);
