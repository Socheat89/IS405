using System.Security.Claims;
using backend.Modules.Common;
using backend.Modules.Inventory.DTOs;
using backend.Modules.Inventory.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Inventory.Controllers;

[ApiController]
[Route("api/warehouses")]
[Authorize("FullAuth")]
public class WarehousesController : ControllerBase
{
    private readonly IInventoryService _inventoryService;
    private readonly backend.Data.AppDbContext _context;

    public WarehousesController(IInventoryService inventoryService, backend.Data.AppDbContext context)
    {
        _inventoryService = inventoryService;
        _context = context;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<WarehouseDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWarehouses([FromQuery] bool onlyActive = true, [FromQuery] bool all = false, CancellationToken cancellationToken = default)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "warehouses.view", "warehouses-list.view", "transfers.view", "stock.view", "stock-items.view", "settings.view", "users.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions for warehouses." });
        }

        var result = await _inventoryService.GetWarehousesAsync(onlyActive, cancellationToken);
        
        // If 'all=true' and user is admin or managing users/settings, return all warehouses
        var isRootAdmin = await backend.Services.Permission.PermissionChecker.IsRootAdminAsync(_context, userId.Value);
        if (!all || !isRootAdmin)
        {
            var allowedWarehouseIds = await backend.Services.Permission.PermissionChecker.GetAllowedWarehouseIdsAsync(_context, userId.Value);
            if (allowedWarehouseIds != null && allowedWarehouseIds.Count > 0)
            {
                result = result.Where(w => allowedWarehouseIds.Contains(w.Id)).ToList();
            }
        }

        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(WarehouseDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetWarehouse(int id, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "warehouses.view", "warehouses-list.view", "transfers.view", "stock.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions for warehouses." });
        }

        var allowedWarehouseIds = await backend.Services.Permission.PermissionChecker.GetAllowedWarehouseIdsAsync(_context, userId.Value);
        if (allowedWarehouseIds != null && !allowedWarehouseIds.Contains(id))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have access to this warehouse." });
        }

        var w = await _inventoryService.GetWarehouseByIdAsync(id, cancellationToken);
        if (w == null) return NotFound(new { message = $"Warehouse with ID {id} not found." });
        return Ok(w);
    }

    [HttpPost]
    [ProducesResponseType(typeof(WarehouseDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateWarehouse([FromBody] CreateWarehouseRequest request, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "warehouses.create", "warehouses-list.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have permission to create warehouses." });
        }

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Warehouse code and name are required." });

        try
        {
            var created = await _inventoryService.CreateWarehouseAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetWarehouse), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(WarehouseDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> UpdateWarehouse(int id, [FromBody] UpdateWarehouseRequest request, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "warehouses.create", "warehouses-list.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have permission to edit warehouses." });
        }

        var updated = await _inventoryService.UpdateWarehouseAsync(id, request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
        if (updated == null) return NotFound(new { message = $"Warehouse with ID {id} not found." });
        return Ok(updated);
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteWarehouse(int id, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "warehouses.create", "warehouses-list.create", "warehouses.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to delete warehouses." });
        }

        var deleted = await _inventoryService.DeleteWarehouseAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
        if (!deleted) return NotFound(new { message = $"Warehouse with ID {id} not found." });
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

[ApiController]
[Route("api/inventory")]
[Authorize("FullAuth")]
public class InventoryController : ControllerBase
{
    private readonly IInventoryService _inventoryService;
    private readonly backend.Data.AppDbContext _context;

    public InventoryController(IInventoryService inventoryService, backend.Data.AppDbContext context)
    {
        _inventoryService = inventoryService;
        _context = context;
    }

    [HttpGet("stocks")]
    [ProducesResponseType(typeof(PagedResult<WarehouseStockDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWarehouseStocks(
        [FromQuery] int? warehouseId,
        [FromQuery] int? productId,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock.view", "stock-items.view", "warehouses.view", "transfers.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions for inventory stocks." });
        }

        var allowedWarehouseIds = await backend.Services.Permission.PermissionChecker.GetAllowedWarehouseIdsAsync(_context, userId.Value);
        if (allowedWarehouseIds != null && allowedWarehouseIds.Count > 0)
        {
            if (warehouseId.HasValue && !allowedWarehouseIds.Contains(warehouseId.Value))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have access to view stocks in this warehouse." });
            }
            if (!warehouseId.HasValue)
            {
                warehouseId = allowedWarehouseIds[0];
            }
        }

        var result = await _inventoryService.GetWarehouseStocksAsync(warehouseId, productId, search, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("alerts")]
    [ProducesResponseType(typeof(IReadOnlyList<StockAlertDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStockAlerts([FromQuery] int? warehouseId, CancellationToken cancellationToken = default)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-alerts.view", "stock.view", "stock-items.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions for stock alerts." });
        }

        var alerts = await _inventoryService.GetStockAlertsAsync(warehouseId, cancellationToken);
        return Ok(alerts);
    }

    [HttpGet("movements")]
    [ProducesResponseType(typeof(PagedResult<StockMovementDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMovements(
        [FromQuery] int? productId,
        [FromQuery] int? warehouseId,
        [FromQuery] string? movementType,
        [FromQuery] string? referenceType,
        [FromQuery] DateTimeOffset? fromDate,
        [FromQuery] DateTimeOffset? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-movements.view", "stock.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions for stock movements." });
        }

        var result = await _inventoryService.GetMovementsAsync(productId, warehouseId, movementType, referenceType, fromDate, toDate, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpPost("adjust")]
    [ProducesResponseType(typeof(StockAdjustmentDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> RecordAdjustment([FromBody] CreateAdjustmentRequest request, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-adjustments.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to create stock adjustments." });
        }

        try
        {
            var adj = await _inventoryService.RecordAdjustmentAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(adj);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    [HttpGet("adjustments")]
    [ProducesResponseType(typeof(PagedResult<StockAdjustmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAdjustments(
        [FromQuery] int? warehouseId,
        [FromQuery] int? productId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-adjustments.view", "stock.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions for stock adjustments." });
        }

        var result = await _inventoryService.GetAdjustmentsAsync(warehouseId, productId, page, pageSize, cancellationToken);
        return Ok(result);
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
[Route("api/transfers")]
[Authorize("FullAuth")]
public class TransfersController : ControllerBase
{
    private readonly IInventoryService _inventoryService;
    private readonly backend.Data.AppDbContext _context;

    public TransfersController(IInventoryService inventoryService, backend.Data.AppDbContext context)
    {
        _inventoryService = inventoryService;
        _context = context;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<StockTransferDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTransfers(
        [FromQuery] string? status,
        [FromQuery] int? warehouseId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "transfers.view", "warehouses.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have permission to view stock transfers." });
        }

        var allowedWarehouseIds = await backend.Services.Permission.PermissionChecker.GetAllowedWarehouseIdsAsync(_context, userId.Value);
        if (allowedWarehouseIds != null && allowedWarehouseIds.Count > 0)
        {
            if (warehouseId.HasValue && !allowedWarehouseIds.Contains(warehouseId.Value))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have access to transfers for this warehouse." });
            }
            if (!warehouseId.HasValue && allowedWarehouseIds.Count == 1)
            {
                warehouseId = allowedWarehouseIds[0];
            }
        }

        var result = await _inventoryService.GetTransfersAsync(status, warehouseId, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(StockTransferDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateTransfer([FromBody] CreateTransferRequest request, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "transfers.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have permission to create stock transfers." });
        }

        var allowedWarehouseIds = await backend.Services.Permission.PermissionChecker.GetAllowedWarehouseIdsAsync(_context, userId.Value);
        if (allowedWarehouseIds != null && allowedWarehouseIds.Count > 0)
        {
            if (!allowedWarehouseIds.Contains(request.FromWarehouseId))
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You can only transfer stock from your assigned warehouse." });
            }
        }

        try
        {
            var result = await _inventoryService.CreateTransferAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetTransfers), new { id = result.Id }, result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/complete")]
    [ProducesResponseType(typeof(StockTransferDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CompleteTransfer(int id, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "transfers.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have permission to complete stock transfers." });
        }

        try
        {
            var result = await _inventoryService.CompleteTransferAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id:int}/cancel")]
    [ProducesResponseType(typeof(StockTransferDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> CancelTransfer(int id, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "transfers.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: You do not have permission to cancel stock transfers." });
        }

        try
        {
            var result = await _inventoryService.CancelTransferAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(typeof(StockTransferDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteOrCancelTransfer(int id, CancellationToken cancellationToken)
    {
        var userId = backend.Services.Permission.PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await backend.Services.Permission.PermissionChecker.HasPermissionAsync(_context, userId.Value, "transfers.create", "transfers.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to cancel/delete transfers." });
        }

        try
        {
            var result = await _inventoryService.CancelTransferAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return Ok(result);
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
