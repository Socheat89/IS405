using System.Security.Claims;
using backend.Modules.Common;
using backend.Modules.Sales.DTOs;
using backend.Modules.Sales.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Sales.Controllers;

[ApiController]
[Route("api/sales")]
[Route("api/sales/orders")]
[Authorize("FullAuth")]
public class SalesController : ControllerBase
{
    private readonly ISalesService _salesService;

    public SalesController(ISalesService salesService)
    {
        _salesService = salesService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<SalesOrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSales(
        [FromServices] backend.Data.AppDbContext context,
        [FromQuery] string? status,
        [FromQuery] string? paymentStatus,
        [FromQuery] int? customerId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(context, userId.Value, "sales.view", "sales-orders.view", "sales-returns.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions for sales orders." });
        }

        var result = await _salesService.GetSalesAsync(status, paymentStatus, customerId, search, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(SalesOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSale(int id, CancellationToken cancellationToken)
    {
        var sale = await _salesService.GetSaleByIdAsync(id, cancellationToken);
        if (sale == null) return NotFound(new { message = $"Sales order with ID {id} not found." });
        return Ok(sale);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SalesOrderDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateSale([FromBody] CreateSaleRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var created = await _salesService.CreateSaleAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetSale), new { id = created.Id }, created);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [HttpPost("{id:int}")]
    [HttpPost("{id:int}/update")]
    [HttpPatch("{id:int}")]
    [ProducesResponseType(typeof(SalesOrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateSale(int id, [FromBody] UpdateSaleRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _salesService.UpdateSaleAsync(id, request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(updated);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPatch("{id:int}/status")]
    [ProducesResponseType(typeof(SalesOrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateSaleStatus(int id, [FromBody] UpdateSaleStatusRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _salesService.UpdateSaleStatusAsync(id, request.Status, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(updated);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/confirm")]
    [ProducesResponseType(typeof(SalesOrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ConfirmSale(int id, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _salesService.ConfirmSaleAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/cancel")]
    [ProducesResponseType(typeof(SalesOrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelSale(int id, [FromBody] CancelSaleRequest? req, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _salesService.CancelSaleAsync(id, req?.Reason, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSale(
        [FromServices] backend.Data.AppDbContext context,
        int id,
        CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(context, userId.Value, "sales.cancel", "sales.create", "sales.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to delete sales orders." });
        }

        var deleted = await _salesService.DeleteSaleAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
        if (!deleted) return NotFound(new { message = $"Sales order with ID {id} not found." });
        return NoContent();
    }

    // Payments for this sale
    [HttpGet("{id:int}/payments")]
    [ProducesResponseType(typeof(IReadOnlyList<SalePaymentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPayments(int id, CancellationToken cancellationToken)
    {
        var payments = await _salesService.GetPaymentsAsync(id, cancellationToken);
        return Ok(payments);
    }

    [HttpPost("{id:int}/payments")]
    [ProducesResponseType(typeof(SalePaymentDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> RecordPayment(int id, [FromBody] CreatePaymentRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var payment = await _salesService.RecordPaymentAsync(id, request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(payment);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private int? GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return int.TryParse(idClaim, out var id) ? id : null;
    }

    private string? GetCurrentUsername() =>
        User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name;
}

public record CancelSaleRequest(string? Reason);

[ApiController]
[Route("api/sales/returns")]
[Authorize("FullAuth")]
public class SalesReturnsController : ControllerBase
{
    private readonly ISalesService _salesService;

    public SalesReturnsController(ISalesService salesService)
    {
        _salesService = salesService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<SalesReturnDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSalesReturns(
        [FromQuery] int? customerId,
        [FromQuery] int? saleId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _salesService.GetSalesReturnsAsync(customerId, saleId, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(SalesReturnDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSalesReturn(int id, CancellationToken cancellationToken)
    {
        var ret = await _salesService.GetSalesReturnByIdAsync(id, cancellationToken);
        if (ret == null) return NotFound(new { message = $"Sales return with ID {id} not found." });
        return Ok(ret);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SalesReturnDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> ProcessSalesReturn([FromBody] CreateSalesReturnRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var ret = await _salesService.ProcessSalesReturnAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetSalesReturn), new { id = ret.Id }, ret);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    private int? GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return int.TryParse(idClaim, out var id) ? id : null;
    }

    private string? GetCurrentUsername() =>
        User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name;
}
