using backend.Data;
using backend.Modules.Reports.DTOs;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Reports.Services;

public interface IReportService
{
    Task<DashboardSummaryDto> GetDashboardSummaryAsync(CancellationToken cancellationToken = default);
    Task<InventoryValuationDto> GetInventoryValuationAsync(CancellationToken cancellationToken = default);
    Task<PurchaseReportDto> GetPurchaseReportAsync(DateTimeOffset? fromDate, DateTimeOffset? toDate, CancellationToken cancellationToken = default);
    Task<SalesProfitReportDto> GetSalesProfitReportAsync(DateTimeOffset? fromDate, DateTimeOffset? toDate, CancellationToken cancellationToken = default);
}

public class ReportService : IReportService
{
    private readonly AppDbContext _context;

    public ReportService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<DashboardSummaryDto> GetDashboardSummaryAsync(CancellationToken cancellationToken = default)
    {
        var products = await _context.StockItems.Where(p => p.IsActive).AsNoTracking().ToListAsync(cancellationToken);
        var totalStockValue = products.Sum(p => p.QuantityOnHand * p.CostPrice);
        var lowStockCount = products.Count(p => p.QuantityOnHand > 0 && p.QuantityOnHand <= p.MinStockLevel);
        var outOfStockCount = products.Count(p => p.QuantityOnHand == 0);
        var totalCustomers = await _context.Customers.CountAsync(c => c.IsActive, cancellationToken);

        var sales = await _context.SalesOrders.Where(s => s.Status == "CONFIRMED").AsNoTracking().ToListAsync(cancellationToken);
        var totalSales = sales.Sum(s => s.TotalAmount);

        var purchases = await _context.PurchaseOrders.Where(p => p.Status != "CANCELLED" && p.Status != "REJECTED").AsNoTracking().ToListAsync(cancellationToken);
        var totalPurchases = purchases.Sum(p => p.TotalAmount);

        var today = DateTimeOffset.UtcNow.Date;
        var allMovements = await _context.StockMovements
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        var todayMovements = allMovements
            .Where(m => m.CreatedAtUtc.Date >= today)
            .ToList();

        var todayIn = todayMovements.Where(m => m.MovementType == "IN").Sum(m => m.Quantity);
        var todayOut = todayMovements.Where(m => m.MovementType == "OUT").Sum(m => m.Quantity);

        // Chart Data for last 7 days
        var sevenDaysAgo = today.AddDays(-6);
        var salesLast7Days = sales.Where(s => s.SaleDateUtc.Date >= sevenDaysAgo).ToList();
        var purchasesLast7Days = purchases.Where(p => p.OrderDateUtc.Date >= sevenDaysAgo).ToList();

        var salesChart = new List<DailyMetricDto>();
        var purchaseChart = new List<DailyMetricDto>();

        for (int i = 0; i < 7; i++)
        {
            var day = sevenDaysAgo.AddDays(i);
            var dayStr = day.ToString("yyyy-MM-dd");

            var daySales = salesLast7Days.Where(s => s.SaleDateUtc.Date == day).ToList();
            salesChart.Add(new DailyMetricDto(dayStr, daySales.Sum(s => s.TotalAmount), daySales.Count));

            var dayPurchases = purchasesLast7Days.Where(p => p.OrderDateUtc.Date == day).ToList();
            purchaseChart.Add(new DailyMetricDto(dayStr, dayPurchases.Sum(p => p.TotalAmount), dayPurchases.Count));
        }

        // Top Selling Products
        var confirmedOrders = sales.Where(s => s.Status == "CONFIRMED").Select(s => s.Id).ToHashSet();
        var topSellingItems = await _context.SalesOrderItems
            .Include(si => si.Product)
            .Where(si => confirmedOrders.Contains(si.SalesOrderId))
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var topSelling = topSellingItems
            .GroupBy(si => new { si.ProductId, Sku = si.Product?.Sku ?? "", Name = si.Product?.Name ?? "" })
            .Select(g => new TopProductDto(
                g.Key.ProductId,
                g.Key.Sku,
                g.Key.Name,
                g.Sum(x => x.Quantity),
                g.Sum(x => x.Subtotal)
            ))
            .OrderByDescending(x => x.QuantitySold)
            .Take(5)
            .ToList();

        return new DashboardSummaryDto(
            TotalSales: totalSales,
            TotalPurchases: totalPurchases,
            TotalStockValue: totalStockValue,
            TotalProducts: products.Count,
            TotalCustomers: totalCustomers,
            LowStockCount: lowStockCount,
            OutOfStockCount: outOfStockCount,
            TodayInCount: todayIn,
            TodayOutCount: todayOut,
            SalesChartData: salesChart,
            PurchaseChartData: purchaseChart,
            TopSellingProducts: topSelling
        );
    }

    public async Task<InventoryValuationDto> GetInventoryValuationAsync(CancellationToken cancellationToken = default)
    {
        var items = await _context.StockItems
            .Include(i => i.Category)
            .Where(i => i.IsActive)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var totalItems = items.Count;
        var totalQty = items.Sum(i => i.QuantityOnHand);
        var totalCost = items.Sum(i => i.QuantityOnHand * i.CostPrice);
        var totalRetail = items.Sum(i => i.QuantityOnHand * i.SellingPrice);
        var potentialProfit = Math.Max(0, totalRetail - totalCost);

        var byCat = items
            .GroupBy(i => i.Category?.Name ?? "Uncategorized")
            .Select(g => new CategoryValuationDto(
                CategoryName: g.Key,
                ItemCount: g.Count(),
                TotalQuantity: g.Sum(x => x.QuantityOnHand),
                TotalCostValue: g.Sum(x => x.QuantityOnHand * x.CostPrice)
            ))
            .OrderByDescending(c => c.TotalCostValue)
            .ToList();

        return new InventoryValuationDto(
            TotalItems: totalItems,
            TotalQuantity: totalQty,
            TotalValuationCost: totalCost,
            TotalValuationRetail: totalRetail,
            PotentialProfit: potentialProfit,
            ByCategory: byCat
        );
    }

    public async Task<PurchaseReportDto> GetPurchaseReportAsync(DateTimeOffset? fromDate, DateTimeOffset? toDate, CancellationToken cancellationToken = default)
    {
        var query = _context.PurchaseOrders
            .Include(p => p.Supplier)
            .Where(p => p.Status != "CANCELLED" && p.Status != "REJECTED")
            .AsNoTracking();

        var orders = await query.ToListAsync(cancellationToken);
        if (fromDate.HasValue) orders = orders.Where(p => p.OrderDateUtc >= fromDate.Value).ToList();
        if (toDate.HasValue) orders = orders.Where(p => p.OrderDateUtc <= toDate.Value).ToList();
        var totalPurchases = orders.Sum(o => o.TotalAmount);
        var totalOrders = orders.Count;
        var receivedOrders = orders.Count(o => o.Status == "RECEIVED" || o.Status == "CLOSED");
        var pendingOrders = orders.Count(o => o.Status is "PENDING_APPROVAL" or "APPROVED" or "PARTIALLY_RECEIVED");

        var bySupplier = orders
            .GroupBy(o => new { o.SupplierId, SupplierName = o.Supplier?.Name ?? "Supplier" })
            .Select(g => new SupplierPurchaseSummaryDto(
                SupplierId: g.Key.SupplierId,
                SupplierName: g.Key.SupplierName,
                OrderCount: g.Count(),
                TotalPurchased: g.Sum(x => x.TotalAmount)
            ))
            .OrderByDescending(s => s.TotalPurchased)
            .ToList();

        return new PurchaseReportDto(
            TotalPurchases: totalPurchases,
            TotalOrders: totalOrders,
            ReceivedOrders: receivedOrders,
            PendingOrders: pendingOrders,
            BySupplier: bySupplier
        );
    }

    public async Task<SalesProfitReportDto> GetSalesProfitReportAsync(DateTimeOffset? fromDate, DateTimeOffset? toDate, CancellationToken cancellationToken = default)
    {
        var query = _context.SalesOrders
            .Include(s => s.Customer)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .Where(s => s.Status == "CONFIRMED")
            .AsNoTracking();

        var sales = await query.ToListAsync(cancellationToken);
        if (fromDate.HasValue) sales = sales.Where(s => s.SaleDateUtc >= fromDate.Value).ToList();
        if (toDate.HasValue) sales = sales.Where(s => s.SaleDateUtc <= toDate.Value).ToList();
        var totalRevenue = sales.Sum(s => s.TotalAmount);
        var outstandingPayments = sales.Sum(s => s.RemainingAmount);

        decimal totalCost = 0;
        foreach (var sale in sales)
        {
            foreach (var item in sale.Items)
            {
                var cost = item.Product?.CostPrice ?? 0;
                totalCost += item.Quantity * cost;
            }
        }

        var grossProfit = totalRevenue - totalCost;
        var marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        var byCustomer = sales
            .GroupBy(s => new { s.CustomerId, CustomerName = s.Customer?.Name ?? "Customer" })
            .Select(g => new CustomerSalesSummaryDto(
                CustomerId: g.Key.CustomerId,
                CustomerName: g.Key.CustomerName,
                SaleCount: g.Count(),
                TotalSpent: g.Sum(x => x.TotalAmount),
                OutstandingBalance: g.Sum(x => x.RemainingAmount)
            ))
            .OrderByDescending(c => c.TotalSpent)
            .ToList();

        return new SalesProfitReportDto(
            TotalRevenue: totalRevenue,
            TotalCost: totalCost,
            GrossProfit: grossProfit,
            ProfitMarginPercentage: Math.Round(marginPct, 2),
            TotalSalesCount: sales.Count,
            OutstandingPayments: outstandingPayments,
            ByCustomer: byCustomer
        );
    }
}
