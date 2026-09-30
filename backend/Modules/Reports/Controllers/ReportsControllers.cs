using backend.Modules.Reports.DTOs;
using backend.Modules.Reports.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Reports.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize("FullAuth")]
public class DashboardController : ControllerBase
{
    private readonly IReportService _reportService;

    public DashboardController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(DashboardSummaryDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary(CancellationToken cancellationToken)
    {
        var summary = await _reportService.GetDashboardSummaryAsync(cancellationToken);
        return Ok(summary);
    }
}

[ApiController]
[Route("api/reports")]
[Authorize("FullAuth")]
public class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet("inventory")]
    [ProducesResponseType(typeof(InventoryValuationDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetInventoryValuation(CancellationToken cancellationToken)
    {
        var val = await _reportService.GetInventoryValuationAsync(cancellationToken);
        return Ok(val);
    }

    [HttpGet("purchases")]
    [ProducesResponseType(typeof(PurchaseReportDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPurchasesReport(
        [FromQuery] DateTimeOffset? fromDate,
        [FromQuery] DateTimeOffset? toDate,
        CancellationToken cancellationToken)
    {
        var report = await _reportService.GetPurchaseReportAsync(fromDate, toDate, cancellationToken);
        return Ok(report);
    }

    [HttpGet("profit")]
    [ProducesResponseType(typeof(SalesProfitReportDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProfitReport(
        [FromQuery] DateTimeOffset? fromDate,
        [FromQuery] DateTimeOffset? toDate,
        CancellationToken cancellationToken)
    {
        var report = await _reportService.GetSalesProfitReportAsync(fromDate, toDate, cancellationToken);
        return Ok(report);
    }
}
