using System.Security.Claims;
using backend.Data;
using backend.Models.Data;
using backend.Models.Request;
using backend.Services.Permission;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

[ApiController]
[Route("api/stock")]
[Authorize("FullAuth")]
public class StockController : ControllerBase
{
    private readonly AppDbContext _context;

    public StockController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("items")]
    [ProducesResponseType(typeof(IReadOnlyList<StockItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetItems(
        [FromQuery] string? search,
        [FromQuery] string? category,
        [FromQuery] string? status,
        [FromQuery] bool? isActive,
        CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock.view", "stock-items.view", "stock-in.view", "stock-out.view", "stock-adjustments.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient stock permissions." });
        }

        var query = _context.StockItems
            .Include(i => i.Category)
            .AsNoTracking();

        if (isActive.HasValue)
        {
            query = query.Where(i => i.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(i => i.Category != null && i.Category.Name == category);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(i => i.Sku.ToLower().Contains(s)
                                  || i.Name.ToLower().Contains(s)
                                  || (i.Barcode != null && i.Barcode.ToLower().Contains(s))
                                  || (i.Location != null && i.Location.ToLower().Contains(s)));
        }

        var items = await query.OrderBy(i => i.Name).ToListAsync(cancellationToken);

        var response = items.Select(i => MapToItemResponse(i)).ToList();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            response = response.Where(i => i.Status.Equals(status, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return Ok(response);
    }

    [HttpGet("items/{id:int}")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetItem(int id, CancellationToken cancellationToken)
    {
        var item = await _context.StockItems
            .Include(i => i.Category)
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (item == null)
        {
            return NotFound(new { message = $"Stock item with ID {id} was not found." });
        }

        return Ok(MapToItemResponse(item));
    }

    [HttpPost("items")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateItem([FromBody] CreateStockItemRequest request, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-items.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to create stock items." });
        }

        if (string.IsNullOrWhiteSpace(request.Sku))
        {
            return BadRequest(new { message = "SKU is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Item name is required." });
        }

        var skuUpper = request.Sku.Trim().ToUpper();
        var skuExists = await _context.StockItems
            .Where(i => i.Sku == skuUpper)
            .Select(i => i.Id)
            .FirstOrDefaultAsync(cancellationToken) > 0;
        if (skuExists)
        {
            return BadRequest(new { message = $"An item with SKU '{request.Sku}' already exists." });
        }

        var item = new StockItem
        {
            Sku = request.Sku.Trim().ToUpper(),
            Barcode = request.Barcode?.Trim(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            CategoryId = request.CategoryId,
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? "PCS" : request.Unit.Trim().ToUpper(),
            CostPrice = request.CostPrice >= 0 ? request.CostPrice : 0,
            SellingPrice = request.SellingPrice >= 0 ? request.SellingPrice : 0,
            QuantityOnHand = request.InitialQuantity >= 0 ? request.InitialQuantity : 0,
            MinStockLevel = request.MinStockLevel >= 0 ? request.MinStockLevel : 10,
            Location = request.Location?.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.StockItems.Add(item);
        await _context.SaveChangesAsync(cancellationToken);

        // If initial quantity is greater than 0, record initial inward movement
        if (request.InitialQuantity > 0)
        {
            var movement = new StockMovement
            {
                ReferenceNo = $"INIT-{DateTimeOffset.UtcNow:yyyyMMdd}-{item.Id:D4}",
                MovementType = "IN",
                ItemId = item.Id,
                Quantity = request.InitialQuantity,
                UnitPrice = item.CostPrice,
                BalanceBefore = 0,
                BalanceAfter = request.InitialQuantity,
                Reason = "Initial Opening Stock",
                SupplierOrRecipient = "Opening Inventory",
                Notes = "System generated initial balance entry.",
                CreatedByUserId = GetCurrentUserId(),
                CreatedByUsername = GetCurrentUsername(),
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.StockMovements.Add(movement);
            await _context.SaveChangesAsync(cancellationToken);
        }

        await _context.Entry(item).Reference(i => i.Category).LoadAsync(cancellationToken);

        return CreatedAtAction(nameof(GetItem), new { id = item.Id }, MapToItemResponse(item));
    }

    [HttpPut("items/{id:int}")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateItem(int id, [FromBody] UpdateStockItemRequest request, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-items.edit"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to edit stock items." });
        }

        var item = await _context.StockItems
            .Include(i => i.Category)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (item == null)
        {
            return NotFound(new { message = $"Stock item with ID {id} was not found." });
        }

        item.Name = request.Name.Trim();
        item.Description = request.Description?.Trim();
        item.CategoryId = request.CategoryId;
        item.Unit = string.IsNullOrWhiteSpace(request.Unit) ? item.Unit : request.Unit.Trim().ToUpper();
        item.CostPrice = request.CostPrice;
        item.SellingPrice = request.SellingPrice;
        item.MinStockLevel = request.MinStockLevel;
        item.Location = request.Location?.Trim();
        item.IsActive = request.IsActive;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(MapToItemResponse(item));
    }

    [HttpDelete("items/{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteItem(int id, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-items.delete"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to delete stock items." });
        }

        var item = await _context.StockItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item == null)
        {
            return NotFound(new { message = $"Stock item with ID {id} was not found." });
        }

        // Toggle or deactivate
        item.IsActive = false;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    [HttpGet("in")]
    [ProducesResponseType(typeof(IReadOnlyList<StockMovementResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStockInRecords(
        [FromQuery] int? itemId,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-in.view", "stock.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to view stock in." });
        }

        var query = _context.StockMovements
            .Include(m => m.Item)
            .Where(m => m.MovementType == "IN")
            .AsNoTracking();

        if (itemId.HasValue) query = query.Where(m => m.ItemId == itemId.Value);

        var list = await query
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(Math.Clamp(limit, 1, 500))
            .ToListAsync(cancellationToken);

        return Ok(list.Select(m => MapToMovementResponse(m, m.Item)).ToList());
    }

    [HttpGet("out")]
    [ProducesResponseType(typeof(IReadOnlyList<StockMovementResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStockOutRecords(
        [FromQuery] int? itemId,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-out.view", "stock.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to view stock out." });
        }

        var query = _context.StockMovements
            .Include(m => m.Item)
            .Where(m => m.MovementType == "OUT")
            .AsNoTracking();

        if (itemId.HasValue) query = query.Where(m => m.ItemId == itemId.Value);

        var list = await query
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(Math.Clamp(limit, 1, 500))
            .ToListAsync(cancellationToken);

        return Ok(list.Select(m => MapToMovementResponse(m, m.Item)).ToList());
    }

    [HttpPost("in")]
    [ProducesResponseType(typeof(StockMovementResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RecordStockIn([FromBody] StockInRequest request, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-in.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to record stock-in." });
        }

        if (request.Quantity <= 0)
        {
            return BadRequest(new { message = "Quantity must be greater than zero." });
        }

        var item = await _context.StockItems.FirstOrDefaultAsync(i => i.Id == request.ItemId, cancellationToken);
        if (item == null)
        {
            return NotFound(new { message = $"Stock item with ID {request.ItemId} was not found." });
        }

        var balanceBefore = item.QuantityOnHand;
        item.QuantityOnHand += request.Quantity;
        if (request.UnitCost.HasValue && request.UnitCost.Value > 0)
        {
            item.CostPrice = request.UnitCost.Value;
        }
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var refNo = string.IsNullOrWhiteSpace(request.ReferenceNo)
            ? $"IN-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}"
            : request.ReferenceNo.Trim();

        var movement = new StockMovement
        {
            ReferenceNo = refNo,
            MovementType = "IN",
            ItemId = item.Id,
            Quantity = request.Quantity,
            UnitPrice = request.UnitCost ?? item.CostPrice,
            BalanceBefore = balanceBefore,
            BalanceAfter = item.QuantityOnHand,
            Reason = "Stock Received / Purchase",
            SupplierOrRecipient = request.Supplier?.Trim() ?? "General Supplier",
            Notes = request.Notes?.Trim(),
            CreatedByUserId = GetCurrentUserId(),
            CreatedByUsername = GetCurrentUsername(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(MapToMovementResponse(movement, item));
    }

    [HttpPost("out")]
    [ProducesResponseType(typeof(StockMovementResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RecordStockOut([FromBody] StockOutRequest request, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-out.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to record stock-out." });
        }

        if (request.Quantity <= 0)
        {
            return BadRequest(new { message = "Quantity must be greater than zero." });
        }

        var item = await _context.StockItems.FirstOrDefaultAsync(i => i.Id == request.ItemId, cancellationToken);
        if (item == null)
        {
            return NotFound(new { message = $"Stock item with ID {request.ItemId} was not found." });
        }

        if (item.QuantityOnHand < request.Quantity)
        {
            return BadRequest(new
            {
                message = $"Insufficient stock for {item.Name}. Requested: {request.Quantity}, Available: {item.QuantityOnHand}"
            });
        }

        var balanceBefore = item.QuantityOnHand;
        item.QuantityOnHand -= request.Quantity;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var refNo = string.IsNullOrWhiteSpace(request.ReferenceNo)
            ? $"OUT-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}"
            : request.ReferenceNo.Trim();

        var movement = new StockMovement
        {
            ReferenceNo = refNo,
            MovementType = "OUT",
            ItemId = item.Id,
            Quantity = request.Quantity,
            UnitPrice = item.SellingPrice > 0 ? item.SellingPrice : item.CostPrice,
            BalanceBefore = balanceBefore,
            BalanceAfter = item.QuantityOnHand,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Sales Dispatch" : request.Reason.Trim(),
            SupplierOrRecipient = request.DestinationOrCustomer?.Trim() ?? "Customer Order",
            Notes = request.Notes?.Trim(),
            CreatedByUserId = GetCurrentUserId(),
            CreatedByUsername = GetCurrentUsername(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(MapToMovementResponse(movement, item));
    }

    [HttpPost("adjust")]
    [ProducesResponseType(typeof(StockMovementResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RecordAdjustment([FromBody] StockAdjustmentRequest request, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-adjustments.create"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to adjust stock." });
        }
        if (request.NewQuantity < 0)
        {
            return BadRequest(new { message = "Adjusted quantity cannot be negative." });
        }

        var item = await _context.StockItems.FirstOrDefaultAsync(i => i.Id == request.ItemId, cancellationToken);
        if (item == null)
        {
            return NotFound(new { message = $"Stock item with ID {request.ItemId} was not found." });
        }

        var balanceBefore = item.QuantityOnHand;
        var diff = request.NewQuantity - balanceBefore;

        if (diff == 0)
        {
            return BadRequest(new { message = "New quantity matches the current quantity. No adjustment needed." });
        }

        item.QuantityOnHand = request.NewQuantity;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var refNo = $"ADJ-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";

        var movement = new StockMovement
        {
            ReferenceNo = refNo,
            MovementType = "ADJUSTMENT",
            ItemId = item.Id,
            Quantity = Math.Abs(diff),
            UnitPrice = item.CostPrice,
            BalanceBefore = balanceBefore,
            BalanceAfter = request.NewQuantity,
            Reason = request.Reason.Trim(),
            SupplierOrRecipient = diff > 0 ? "Inventory Audit (Surplus)" : "Inventory Audit (Shrinkage)",
            Notes = request.Notes?.Trim(),
            CreatedByUserId = GetCurrentUserId(),
            CreatedByUsername = GetCurrentUsername(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.StockMovements.Add(movement);
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(MapToMovementResponse(movement, item));
    }

    [HttpGet("movements")]
    [ProducesResponseType(typeof(IReadOnlyList<StockMovementResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMovements(
        [FromQuery] int? itemId,
        [FromQuery] string? type,
        [FromQuery] int limit = 100,
        CancellationToken cancellationToken = default)
    {
        var query = _context.StockMovements
            .Include(m => m.Item)
            .AsNoTracking();

        if (itemId.HasValue)
        {
            query = query.Where(m => m.ItemId == itemId.Value);
        }

        if (!string.IsNullOrWhiteSpace(type) && !type.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(m => m.MovementType == type.ToUpper());
        }

        var list = await query
            .OrderByDescending(m => m.CreatedAtUtc)
            .Take(Math.Clamp(limit, 1, 500))
            .ToListAsync(cancellationToken);

        var result = list.Select(m => MapToMovementResponse(m, m.Item)).ToList();
        return Ok(result);
    }

    [HttpGet("alerts")]
    [ProducesResponseType(typeof(IReadOnlyList<StockItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAlerts(CancellationToken cancellationToken)
    {
        var items = await _context.StockItems
            .Include(i => i.Category)
            .Where(i => i.IsActive && i.QuantityOnHand <= i.MinStockLevel)
            .OrderBy(i => i.QuantityOnHand)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return Ok(items.Select(i => MapToItemResponse(i)).ToList());
    }

    [HttpGet("categories")]
    [ProducesResponseType(typeof(IReadOnlyList<StockCategory>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories(CancellationToken cancellationToken)
    {
        var categories = await _context.StockCategories
            .Where(c => c.IsActive)
            .OrderBy(c => c.Name)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        return Ok(categories);
    }

    [HttpPost("categories")]
    [ProducesResponseType(typeof(StockCategory), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCategory([FromBody] StockCategory category, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(category.Name))
        {
            return BadRequest(new { message = "Category name is required." });
        }

        category.Name = category.Name.Trim();
        category.CreatedAtUtc = DateTimeOffset.UtcNow;
        _context.StockCategories.Add(category);
        await _context.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetCategories), new { id = category.Id }, category);
    }

    [HttpGet("summary")]
    [ProducesResponseType(typeof(StockSummaryResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSummary(CancellationToken cancellationToken)
    {
        var items = await _context.StockItems
            .Where(i => i.IsActive)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var today = DateTimeOffset.UtcNow.Date;
        var movements = await _context.StockMovements
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var todayMovements = movements
            .Where(m => m.CreatedAtUtc >= today)
            .ToList();

        var totalItems = items.Count;
        var totalQuantity = items.Sum(i => i.QuantityOnHand);
        var totalValue = items.Sum(i => i.QuantityOnHand * i.CostPrice);
        var lowStockCount = items.Count(i => i.QuantityOnHand > 0 && i.QuantityOnHand <= i.MinStockLevel);
        var outOfStockCount = items.Count(i => i.QuantityOnHand == 0);

        var todayIn = todayMovements.Where(m => m.MovementType == "IN").Sum(m => m.Quantity);
        var todayOut = todayMovements.Where(m => m.MovementType == "OUT").Sum(m => m.Quantity);

        var summary = new StockSummaryResponse(
            TotalItems: totalItems,
            TotalQuantity: totalQuantity,
            TotalInventoryValue: totalValue,
            LowStockCount: lowStockCount,
            OutOfStockCount: outOfStockCount,
            TodayMovementsCount: todayMovements.Count,
            TodayInCount: todayIn,
            TodayOutCount: todayOut
        );

        return Ok(summary);
    }

    private static StockItemResponse MapToItemResponse(StockItem i)
    {
        var status = i.QuantityOnHand <= 0
            ? "OutOfStock"
            : (i.QuantityOnHand <= i.MinStockLevel ? "LowStock" : "InStock");

        return new StockItemResponse(
            Id: i.Id,
            Sku: i.Sku,
            Barcode: i.Barcode,
            Name: i.Name,
            Description: i.Description,
            CategoryId: i.CategoryId,
            CategoryName: i.Category?.Name,
            Unit: i.Unit,
            CostPrice: i.CostPrice,
            SellingPrice: i.SellingPrice,
            QuantityOnHand: i.QuantityOnHand,
            MinStockLevel: i.MinStockLevel,
            Location: i.Location,
            IsActive: i.IsActive,
            Status: status,
            CreatedAtUtc: i.CreatedAtUtc
        );
    }

    private static StockMovementResponse MapToMovementResponse(StockMovement m, StockItem? item)
    {
        return new StockMovementResponse(
            Id: m.Id,
            ReferenceNo: m.ReferenceNo,
            MovementType: m.MovementType,
            ItemId: m.ItemId,
            ItemSku: item?.Sku ?? "N/A",
            ItemName: item?.Name ?? "Unknown Item",
            Quantity: m.Quantity,
            UnitPrice: m.UnitPrice,
            BalanceBefore: m.BalanceBefore,
            BalanceAfter: m.BalanceAfter,
            Reason: m.Reason,
            SupplierOrRecipient: m.SupplierOrRecipient,
            Notes: m.Notes,
            CreatedByUsername: m.CreatedByUsername,
            CreatedAtUtc: m.CreatedAtUtc
        );
    }

    private int? GetCurrentUserId()
    {
        var idClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                   ?? User.FindFirst("sub")?.Value;
        return int.TryParse(idClaim, out var id) ? id : null;
    }

    private string? GetCurrentUsername()
    {
        return User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst("name")?.Value
            ?? User.Identity?.Name;
    }
}
