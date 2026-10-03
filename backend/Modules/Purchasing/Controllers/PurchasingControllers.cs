using System.Security.Claims;
using backend.Modules.Common;
using backend.Modules.Purchasing.DTOs;
using backend.Modules.Purchasing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Purchasing.Controllers;

[ApiController]
[Route("api/purchases/orders")]
[Route("api/purchases")]
[Route("api/purchase/orders")]
[Route("api/purchase")]
[Authorize("FullAuth")]
public class PurchaseOrdersController : ControllerBase
{
    private readonly IPurchasingService _purchasingService;

    public PurchaseOrdersController(IPurchasingService purchasingService)
    {
        _purchasingService = purchasingService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PurchaseOrderDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOrders(
        [FromServices] backend.Data.AppDbContext context,
        [FromQuery] string? status,
        [FromQuery] int? supplierId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(context, userId.Value, "purchases.view", "purchase-orders.view", "goods-receipts.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions for purchase orders." });
        }

        var result = await _purchasingService.GetOrdersAsync(status, supplierId, search, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOrder(int id, CancellationToken cancellationToken)
    {
        var order = await _purchasingService.GetOrderByIdAsync(id, cancellationToken);
        if (order == null) return NotFound(new { message = $"Purchase order with ID {id} not found." });
        return Ok(order);
    }

    [HttpPost]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateOrder([FromBody] CreatePoRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var created = await _purchasingService.CreateOrderAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetOrder), new { id = created.Id }, created);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateOrder(int id, [FromBody] UpdatePoRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _purchasingService.UpdateOrderAsync(id, request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            if (updated == null) return NotFound(new { message = $"Purchase order with ID {id} not found." });
            return Ok(updated);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/approve")]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> ApproveOrder(int id, [FromBody] ApprovePoRequest? request = null, CancellationToken cancellationToken = default)
    {
        try
        {
            var result = await _purchasingService.ApproveOrderAsync(id, request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/reject")]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> RejectOrder(int id, [FromBody] RejectPoRequest? req, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchasingService.RejectOrderAsync(id, req?.Reason, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/cancel")]
    [ProducesResponseType(typeof(PurchaseOrderDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelOrder(int id, [FromBody] RejectPoRequest? req, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _purchasingService.CancelOrderAsync(id, req?.Reason, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
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
    public async Task<IActionResult> DeleteOrder(
        [FromServices] backend.Data.AppDbContext context,
        int id,
        CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(context, userId.Value, "purchase-orders.cancel", "purchase-orders.create", "purchases.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to delete purchase orders." });
        }

        var deleted = await _purchasingService.DeleteOrderAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
        if (!deleted) return NotFound(new { message = $"Purchase order with ID {id} not found." });
        return NoContent();
    }

    private int? GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? User.FindFirst("sub")?.Value;
        return int.TryParse(idClaim, out var id) ? id : null;
    }

    private string? GetCurrentUsername() =>
        User.FindFirst(ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value ?? User.Identity?.Name;
}

public record RejectPoRequest(string? Reason);

[ApiController]
[Route("api/purchases/grn")]
[Authorize("FullAuth")]
public class GoodsReceiptsController : ControllerBase
{
    private readonly IPurchasingService _purchasingService;

    public GoodsReceiptsController(IPurchasingService purchasingService)
    {
        _purchasingService = purchasingService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<GoodsReceiptDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGoodsReceipts(
        [FromQuery] int? poId,
        [FromQuery] int? warehouseId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _purchasingService.GetGoodsReceiptsAsync(poId, warehouseId, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(GoodsReceiptDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetGoodsReceipt(int id, CancellationToken cancellationToken)
    {
        var grn = await _purchasingService.GetGoodsReceiptByIdAsync(id, cancellationToken);
        if (grn == null) return NotFound(new { message = $"Goods receipt with ID {id} not found." });
        return Ok(grn);
    }

    [HttpPost]
    [ProducesResponseType(typeof(GoodsReceiptDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> ProcessGoodsReceipt([FromBody] CreateGrnRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var grn = await _purchasingService.ProcessGoodsReceiptAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetGoodsReceipt), new { id = grn.Id }, grn);
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

[ApiController]
[Route("api/purchases/returns")]
[Authorize("FullAuth")]
public class PurchaseReturnsController : ControllerBase
{
    private readonly IPurchasingService _purchasingService;

    public PurchaseReturnsController(IPurchasingService purchasingService)
    {
        _purchasingService = purchasingService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<PurchaseReturnDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPurchaseReturns(
        [FromQuery] int? supplierId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _purchasingService.GetPurchaseReturnsAsync(supplierId, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(PurchaseReturnDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPurchaseReturn(int id, CancellationToken cancellationToken)
    {
        var ret = await _purchasingService.GetPurchaseReturnByIdAsync(id, cancellationToken);
        if (ret == null) return NotFound(new { message = $"Purchase return with ID {id} not found." });
        return Ok(ret);
    }

    [HttpPost]
    [ProducesResponseType(typeof(PurchaseReturnDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> ProcessPurchaseReturn([FromBody] CreatePurchaseReturnRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var ret = await _purchasingService.ProcessPurchaseReturnAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetPurchaseReturn), new { id = ret.Id }, ret);
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
