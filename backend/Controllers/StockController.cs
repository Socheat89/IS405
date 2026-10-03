using System.Security.Claims;
using backend.Data;
using backend.Models.Data;
using backend.Models.Request;
using backend.Services.Permission;
using backend.Modules.Inventory.Models;
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
        [FromQuery] int? warehouseId,
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
        else
        {
            query = query.Where(i => i.IsActive);
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

        // Determine target warehouse to scope Qty On-Hand:
        // Priority 1: Explicit warehouse query parameter (if authorized)
        // Priority 2: User's assigned Main/Default warehouse (IsDefault == true)
        int? targetWarehouseId = null;
        if (warehouseId.HasValue && warehouseId.Value > 0)
        {
            if (await PermissionChecker.CanAccessWarehouseAsync(_context, userId.Value, warehouseId.Value))
            {
                targetWarehouseId = warehouseId.Value;
            }
        }

        if (!targetWarehouseId.HasValue)
        {
            targetWarehouseId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);
        }

        Dictionary<int, int> warehouseStockMap = new();
        if (targetWarehouseId.HasValue)
        {
            warehouseStockMap = await _context.WarehouseStocks
                .Where(ws => ws.WarehouseId == targetWarehouseId.Value)
                .ToDictionaryAsync(ws => ws.ProductId, ws => ws.QuantityOnHand, cancellationToken);
        }

        var items = await query.OrderBy(i => i.Name).ToListAsync(cancellationToken);

        var response = items.Select(i => {
            var res = MapToItemResponse(i);
            var scopedQty = warehouseStockMap.TryGetValue(i.Id, out var q) ? q : 0;
            var scopedStatus = scopedQty <= 0 ? "OutOfStock" : (scopedQty <= i.MinStockLevel ? "LowStock" : "InStock");
            return res with { QuantityOnHand = scopedQty, Status = scopedStatus };
        }).ToList();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            var targetStatus = status.Replace("_", "").ToLowerInvariant();
            response = response.Where(i => i.Status.Replace("_", "").Equals(targetStatus, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return Ok(response);
    }

    [HttpGet("items/{id:int}")]
    [ProducesResponseType(typeof(StockItemResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetItem(int id, [FromQuery] int? warehouseId, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();

        var item = await _context.StockItems
            .Include(i => i.Category)
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (item == null)
        {
            return NotFound(new { message = $"Stock item with ID {id} was not found." });
        }

        int? targetWarehouseId = null;
        if (warehouseId.HasValue && warehouseId.Value > 0)
        {
            if (await PermissionChecker.CanAccessWarehouseAsync(_context, userId.Value, warehouseId.Value))
            {
                targetWarehouseId = warehouseId.Value;
            }
        }

        if (!targetWarehouseId.HasValue)
        {
            targetWarehouseId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);
        }

        var res = MapToItemResponse(item);
        if (targetWarehouseId.HasValue)
        {
            var scopedQty = await _context.WarehouseStocks
                .Where(ws => ws.WarehouseId == targetWarehouseId.Value && ws.ProductId == id)
                .Select(ws => (int?)ws.QuantityOnHand)
                .FirstOrDefaultAsync(cancellationToken) ?? 0;

            var scopedStatus = scopedQty <= 0 ? "OutOfStock" : (scopedQty <= item.MinStockLevel ? "LowStock" : "InStock");
            res = res with { QuantityOnHand = scopedQty, Status = scopedStatus };
        }

        return Ok(res);
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

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Item name is required." });
        }

        var sku = !string.IsNullOrWhiteSpace(request.Sku) 
            ? request.Sku.Trim().ToUpper() 
            : $"STK-{DateTimeOffset.UtcNow:yyMM}-{Guid.NewGuid().ToString("N")[..4].ToUpperInvariant()}";

        var skuExists = await _context.StockItems
            .Where(i => i.Sku == sku)
            .Select(i => i.Id)
            .FirstOrDefaultAsync(cancellationToken) > 0;
        if (skuExists)
        {
            return BadRequest(new { message = $"An item with SKU '{sku}' already exists." });
        }

        int? categoryId = request.CategoryId;
        if ((!categoryId.HasValue || categoryId.Value <= 0) && !string.IsNullOrWhiteSpace(request.CategoryName))
        {
            var catName = request.CategoryName.Trim();
            var cat = await _context.StockCategories.FirstOrDefaultAsync(c => c.Name.ToLower() == catName.ToLower(), cancellationToken);
            if (cat == null)
            {
                cat = new StockCategory { Name = catName, IsActive = true, CreatedAtUtc = DateTimeOffset.UtcNow };
                _context.StockCategories.Add(cat);
                await _context.SaveChangesAsync(cancellationToken);
            }
            categoryId = cat.Id;
        }

        var sellingPrice = request.SellingPrice ?? request.UnitPrice ?? 0;
        var costPrice = request.CostPrice ?? (sellingPrice > 0 ? sellingPrice * 0.7m : 0);
        var initialQty = request.InitialQuantity ?? request.QuantityOnHand ?? 0;
        var minStock = request.MinStockLevel ?? request.ReorderLevel ?? 5;

        var item = new StockItem
        {
            Sku = sku,
            Barcode = request.Barcode?.Trim(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            CategoryId = categoryId,
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? "PCS" : request.Unit.Trim().ToUpper(),
            CostPrice = Math.Max(0, costPrice),
            SellingPrice = Math.Max(0, sellingPrice),
            QuantityOnHand = Math.Max(0, initialQty),
            MinStockLevel = Math.Max(0, minStock),
            Location = request.Location?.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.StockItems.Add(item);
        await _context.SaveChangesAsync(cancellationToken);

        var targetWhId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);

        // If initial quantity is greater than 0, record initial inward movement and sync warehouse stock
        if (item.QuantityOnHand > 0)
        {
            var movement = new StockMovement
            {
                ReferenceNo = $"INIT-{DateTimeOffset.UtcNow:yyyyMMdd}-{item.Id:D4}",
                MovementType = "IN",
                WarehouseId = targetWhId,
                ItemId = item.Id,
                Quantity = item.QuantityOnHand,
                UnitPrice = item.CostPrice,
                BalanceBefore = 0,
                BalanceAfter = item.QuantityOnHand,
                Reason = "Initial Opening Stock",
                SupplierOrRecipient = "Opening Inventory",
                Notes = "System generated initial balance entry.",
                CreatedByUserId = GetCurrentUserId(),
                CreatedByUsername = GetCurrentUsername(),
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.StockMovements.Add(movement);

            if (targetWhId.HasValue)
            {
                await SyncWarehouseStockAsync(targetWhId.Value, item.Id, item.QuantityOnHand, cancellationToken);
            }
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

        if (!string.IsNullOrWhiteSpace(request.Name)) item.Name = request.Name.Trim();
        if (request.Description != null) item.Description = request.Description.Trim();
        if (!string.IsNullOrWhiteSpace(request.Sku)) item.Sku = request.Sku.Trim().ToUpper();
        if (request.Barcode != null) item.Barcode = request.Barcode.Trim();

        int? categoryId = request.CategoryId;
        if ((!categoryId.HasValue || categoryId.Value <= 0) && !string.IsNullOrWhiteSpace(request.CategoryName))
        {
            var catName = request.CategoryName.Trim();
            var cat = await _context.StockCategories.FirstOrDefaultAsync(c => c.Name.ToLower() == catName.ToLower(), cancellationToken);
            if (cat == null)
            {
                cat = new StockCategory { Name = catName, IsActive = true, CreatedAtUtc = DateTimeOffset.UtcNow };
                _context.StockCategories.Add(cat);
                await _context.SaveChangesAsync(cancellationToken);
            }
            categoryId = cat.Id;
        }
        if (categoryId.HasValue) item.CategoryId = categoryId;

        if (!string.IsNullOrWhiteSpace(request.Unit)) item.Unit = request.Unit.Trim().ToUpper();
        if (request.CostPrice.HasValue) item.CostPrice = Math.Max(0, request.CostPrice.Value);
        if (request.SellingPrice.HasValue || request.UnitPrice.HasValue) 
            item.SellingPrice = Math.Max(0, request.SellingPrice ?? request.UnitPrice ?? item.SellingPrice);
        if (request.MinStockLevel.HasValue || request.ReorderLevel.HasValue) 
            item.MinStockLevel = Math.Max(0, request.MinStockLevel ?? request.ReorderLevel ?? item.MinStockLevel);
        if (request.Location != null) item.Location = request.Location.Trim();
        if (request.IsActive.HasValue) item.IsActive = request.IsActive.Value;
        if (request.QuantityOnHand.HasValue && request.QuantityOnHand.Value != item.QuantityOnHand)
        {
            var diff = request.QuantityOnHand.Value - item.QuantityOnHand;
            item.QuantityOnHand = Math.Max(0, request.QuantityOnHand.Value);
            var targetWhId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);
            var movement = new StockMovement
            {
                ReferenceNo = $"EDIT-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}",
                MovementType = diff >= 0 ? "IN" : "OUT",
                WarehouseId = targetWhId,
                ItemId = item.Id,
                Quantity = Math.Abs(diff),
                UnitPrice = item.CostPrice,
                BalanceBefore = item.QuantityOnHand - diff,
                BalanceAfter = item.QuantityOnHand,
                Reason = "Manual Inventory Edit Adjustment",
                SupplierOrRecipient = "Inventory Management",
                CreatedByUserId = GetCurrentUserId(),
                CreatedByUsername = GetCurrentUsername(),
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.StockMovements.Add(movement);

            if (targetWhId.HasValue)
            {
                await SyncWarehouseStockAsync(targetWhId.Value, item.Id, item.QuantityOnHand, cancellationToken);
            }
        }

        item.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _context.Entry(item).Reference(i => i.Category).LoadAsync(cancellationToken);

        return Ok(MapToItemResponse(item));
    }

    [HttpPost("items/{id:int}/adjust")]
    [HttpPost("{id:int}/adjust")]
    [ProducesResponseType(typeof(StockMovementResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> AdjustItemStock(int id, [FromBody] StockAdjustmentItemRequest request, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();
        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "stock-adjustments.create", "stock-items.edit", "stock.view"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Forbidden: Insufficient permissions to adjust stock." });
        }

        var item = await _context.StockItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item == null)
        {
            return NotFound(new { message = $"Stock item with ID {id} was not found." });
        }

        var balanceBefore = item.QuantityOnHand;
        int newQty;
        if (request.NewQuantity.HasValue)
        {
            newQty = request.NewQuantity.Value;
        }
        else if (request.AdjustmentQuantity.HasValue)
        {
            newQty = Math.Max(0, balanceBefore + request.AdjustmentQuantity.Value);
        }
        else
        {
            return BadRequest(new { message = "Either AdjustmentQuantity or NewQuantity is required." });
        }

        if (newQty < 0) return BadRequest(new { message = "Adjusted quantity cannot be negative." });

        var diff = newQty - balanceBefore;
        item.QuantityOnHand = newQty;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        var targetWhId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);

        var refNo = $"ADJ-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";
        var movement = new StockMovement
        {
            ReferenceNo = refNo,
            MovementType = "ADJUSTMENT",
            WarehouseId = targetWhId,
            ItemId = item.Id,
            Quantity = Math.Abs(diff),
            UnitPrice = item.CostPrice,
            BalanceBefore = balanceBefore,
            BalanceAfter = newQty,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Stock Adjustment" : request.Reason.Trim(),
            SupplierOrRecipient = diff >= 0 ? "Inventory Audit (Surplus)" : "Inventory Audit (Shrinkage)",
            Notes = request.Notes?.Trim(),
            CreatedByUserId = GetCurrentUserId(),
            CreatedByUsername = GetCurrentUsername(),
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.StockMovements.Add(movement);
        if (targetWhId.HasValue)
        {
            await SyncWarehouseStockAsync(targetWhId.Value, item.Id, newQty, cancellationToken);
        }
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(MapToMovementResponse(movement, item));
    }

    [HttpDelete("items/{id:int}")]
    [HttpDelete("{id:int}")]
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
            .OrderByDescending(m => m.Id)
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
            .OrderByDescending(m => m.Id)
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

        var targetWhId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);

        var refNo = string.IsNullOrWhiteSpace(request.ReferenceNo)
            ? $"IN-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}"
            : request.ReferenceNo.Trim();

        var movement = new StockMovement
        {
            ReferenceNo = refNo,
            MovementType = "IN",
            WarehouseId = targetWhId,
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
        if (targetWhId.HasValue)
        {
            await AdjustWarehouseStockQuantityAsync(targetWhId.Value, item.Id, request.Quantity, cancellationToken);
        }
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

        var targetWhId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);

        var refNo = string.IsNullOrWhiteSpace(request.ReferenceNo)
            ? $"OUT-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}"
            : request.ReferenceNo.Trim();

        var movement = new StockMovement
        {
            ReferenceNo = refNo,
            MovementType = "OUT",
            WarehouseId = targetWhId,
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
        if (targetWhId.HasValue)
        {
            await AdjustWarehouseStockQuantityAsync(targetWhId.Value, item.Id, -request.Quantity, cancellationToken);
        }
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

        var targetWhId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);

        var refNo = $"ADJ-{DateTimeOffset.UtcNow:yyyyMMddHHmmss}";

        var movement = new StockMovement
        {
            ReferenceNo = refNo,
            MovementType = "ADJUSTMENT",
            WarehouseId = targetWhId,
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
        if (targetWhId.HasValue)
        {
            await SyncWarehouseStockAsync(targetWhId.Value, item.Id, request.NewQuantity, cancellationToken);
        }
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
            .OrderByDescending(m => m.Id)
            .Take(Math.Clamp(limit, 1, 500))
            .ToListAsync(cancellationToken);

        var result = list.Select(m => MapToMovementResponse(m, m.Item)).ToList();
        return Ok(result);
    }

    [HttpGet("alerts")]
    [ProducesResponseType(typeof(IReadOnlyList<StockItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAlerts([FromQuery] int? warehouseId, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();

        int? targetWarehouseId = null;
        if (warehouseId.HasValue && warehouseId.Value > 0)
        {
            if (await PermissionChecker.CanAccessWarehouseAsync(_context, userId.Value, warehouseId.Value))
            {
                targetWarehouseId = warehouseId.Value;
            }
        }
        if (!targetWarehouseId.HasValue)
        {
            targetWarehouseId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);
        }

        Dictionary<int, int> warehouseStockMap = new();
        if (targetWarehouseId.HasValue)
        {
            warehouseStockMap = await _context.WarehouseStocks
                .Where(ws => ws.WarehouseId == targetWarehouseId.Value)
                .ToDictionaryAsync(ws => ws.ProductId, ws => ws.QuantityOnHand, cancellationToken);
        }

        var items = await _context.StockItems
            .Include(i => i.Category)
            .Where(i => i.IsActive)
            .OrderBy(i => i.Name)
            .AsNoTracking()
            .ToListAsync(cancellationToken);

        var alertItems = items.Select(i => {
            var res = MapToItemResponse(i);
            var scopedQty = warehouseStockMap.TryGetValue(i.Id, out var q) ? q : 0;
            var scopedStatus = scopedQty <= 0 ? "OutOfStock" : (scopedQty <= i.MinStockLevel ? "LowStock" : "InStock");
            return res with { QuantityOnHand = scopedQty, Status = scopedStatus };
        })
        .Where(i => i.QuantityOnHand <= i.MinStockLevel)
        .OrderBy(i => i.QuantityOnHand)
        .ToList();

        return Ok(alertItems);
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
    public async Task<IActionResult> GetSummary([FromQuery] int? warehouseId, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();

        int? targetWarehouseId = null;
        if (warehouseId.HasValue && warehouseId.Value > 0)
        {
            if (await PermissionChecker.CanAccessWarehouseAsync(_context, userId.Value, warehouseId.Value))
            {
                targetWarehouseId = warehouseId.Value;
            }
        }
        if (!targetWarehouseId.HasValue)
        {
            targetWarehouseId = await GetUserMainWarehouseIdAsync(userId.Value, cancellationToken);
        }

        var activeItems = await _context.StockItems
            .Where(i => i.IsActive)
            .Select(i => new { i.Id, i.CostPrice, i.MinStockLevel })
            .ToListAsync(cancellationToken);

        Dictionary<int, int> warehouseStockMap = new();
        if (targetWarehouseId.HasValue)
        {
            warehouseStockMap = await _context.WarehouseStocks
                .Where(ws => ws.WarehouseId == targetWarehouseId.Value)
                .ToDictionaryAsync(ws => ws.ProductId, ws => ws.QuantityOnHand, cancellationToken);
        }

        var totalItems = activeItems.Count;
        long totalQuantity = 0;
        decimal totalValue = 0;
        int lowStockCount = 0;
        int outOfStockCount = 0;

        foreach (var item in activeItems)
        {
            var qty = warehouseStockMap.TryGetValue(item.Id, out var q) ? q : 0;
            totalQuantity += qty;
            totalValue += qty * item.CostPrice;
            if (qty <= 0) outOfStockCount++;
            else if (qty <= item.MinStockLevel) lowStockCount++;
        }

        var today = DateTimeOffset.UtcNow.Date;
        var todayMovementsQuery = _context.StockMovements.Where(m => m.CreatedAtUtc >= today);
        if (targetWarehouseId.HasValue)
        {
            todayMovementsQuery = todayMovementsQuery.Where(m => m.WarehouseId == targetWarehouseId.Value);
        }

        var todayMovementsCount = await todayMovementsQuery.CountAsync(cancellationToken);
        var todayIn = await todayMovementsQuery.Where(m => m.MovementType == "IN").SumAsync(m => (int?)m.Quantity, cancellationToken) ?? 0;
        var todayOut = await todayMovementsQuery.Where(m => m.MovementType == "OUT").SumAsync(m => (int?)m.Quantity, cancellationToken) ?? 0;

        var summary = new StockSummaryResponse(
            TotalItems: totalItems,
            TotalQuantity: (int)totalQuantity,
            TotalInventoryValue: totalValue,
            LowStockCount: lowStockCount,
            OutOfStockCount: outOfStockCount,
            TodayMovementsCount: todayMovementsCount,
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
            UnitPrice: i.SellingPrice,
            QuantityOnHand: i.QuantityOnHand,
            MinStockLevel: i.MinStockLevel,
            ReorderLevel: i.MinStockLevel,
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

    private async Task<int?> GetUserMainWarehouseIdAsync(int userId, CancellationToken cancellationToken)
    {
        var userMainWh = await _context.UserWarehouses
            .Where(uw => uw.UserId == userId)
            .OrderByDescending(uw => uw.IsDefault)
            .ThenBy(uw => uw.WarehouseId)
            .Select(uw => (int?)uw.WarehouseId)
            .FirstOrDefaultAsync(cancellationToken);

        if (userMainWh.HasValue) return userMainWh.Value;

        return await _context.Warehouses
            .Where(w => w.IsActive)
            .OrderBy(w => w.Code == "WH-MAIN" ? 0 : 1)
            .ThenBy(w => w.Id)
            .Select(w => (int?)w.Id)
            .FirstOrDefaultAsync(cancellationToken);
    }

    private async Task SyncWarehouseStockAsync(int warehouseId, int productId, int quantity, CancellationToken cancellationToken)
    {
        var ws = await _context.WarehouseStocks
            .FirstOrDefaultAsync(w => w.WarehouseId == warehouseId && w.ProductId == productId, cancellationToken);
        if (ws == null)
        {
            ws = new WarehouseStock
            {
                WarehouseId = warehouseId,
                ProductId = productId,
                QuantityOnHand = quantity,
                ReservedQuantity = 0,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.WarehouseStocks.Add(ws);
        }
        else
        {
            ws.QuantityOnHand = quantity;
            ws.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }
    }

    private async Task AdjustWarehouseStockQuantityAsync(int warehouseId, int productId, int deltaQuantity, CancellationToken cancellationToken)
    {
        var ws = await _context.WarehouseStocks
            .FirstOrDefaultAsync(w => w.WarehouseId == warehouseId && w.ProductId == productId, cancellationToken);
        if (ws == null)
        {
            ws = new WarehouseStock
            {
                WarehouseId = warehouseId,
                ProductId = productId,
                QuantityOnHand = Math.Max(0, deltaQuantity),
                ReservedQuantity = 0,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.WarehouseStocks.Add(ws);
        }
        else
        {
            ws.QuantityOnHand = Math.Max(0, ws.QuantityOnHand + deltaQuantity);
            ws.UpdatedAtUtc = DateTimeOffset.UtcNow;
        }
    }
}
