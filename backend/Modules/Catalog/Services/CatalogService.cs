using backend.Data;
using backend.Models.Data;
using backend.Modules.Audit.Services;
using backend.Modules.Catalog.DTOs;
using backend.Modules.Catalog.Models;
using backend.Modules.Common;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Catalog.Services;

public interface ICatalogService
{
    Task<PagedResult<ProductDto>> GetProductsAsync(string? search, int? categoryId, string? brand, string? status, bool? isActive, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<ProductDto?> GetProductByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<ProductDto> CreateProductAsync(CreateProductRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<ProductDto?> UpdateProductAsync(int id, UpdateProductRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<bool> DeleteProductAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(bool onlyActive = true, CancellationToken cancellationToken = default);
    Task<CategoryDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken cancellationToken = default);
    Task<CategoryDto?> UpdateCategoryAsync(int id, UpdateCategoryRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<BrandDto>> GetBrandsAsync(bool onlyActive = true, CancellationToken cancellationToken = default);
    Task<BrandDto> CreateBrandAsync(CreateBrandRequest request, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<UnitDto>> GetUnitsAsync(CancellationToken cancellationToken = default);
    Task<UnitDto> CreateUnitAsync(CreateUnitRequest request, CancellationToken cancellationToken = default);
}

public class CatalogService : ICatalogService
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public CatalogService(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<PagedResult<ProductDto>> GetProductsAsync(
        string? search,
        int? categoryId,
        string? brand,
        string? status,
        bool? isActive,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.StockItems.Include(i => i.Category).AsNoTracking();

        if (isActive.HasValue)
        {
            query = query.Where(i => i.IsActive == isActive.Value);
        }

        if (categoryId.HasValue)
        {
            query = query.Where(i => i.CategoryId == categoryId.Value);
        }

        if (!string.IsNullOrWhiteSpace(brand))
        {
            query = query.Where(i => i.Brand != null && i.Brand.ToLower() == brand.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(i => i.Sku.ToLower().Contains(s)
                                  || i.Name.ToLower().Contains(s)
                                  || (i.Barcode != null && i.Barcode.ToLower().Contains(s))
                                  || (i.Brand != null && i.Brand.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(i => i.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToProductDto).ToList();

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            dtos = dtos.Where(p => p.Status.Equals(status, StringComparison.OrdinalIgnoreCase)).ToList();
        }

        return new PagedResult<ProductDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<ProductDto?> GetProductByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var item = await _context.StockItems
            .Include(i => i.Category)
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        return item == null ? null : MapToProductDto(item);
    }

    public async Task<ProductDto> CreateProductAsync(CreateProductRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var skuUpper = request.Sku.Trim().ToUpperInvariant();
        var skuExists = await _context.StockItems.AnyAsync(i => i.Sku == skuUpper, cancellationToken);
        if (skuExists)
        {
            throw new InvalidOperationException($"Product with SKU '{request.Sku}' already exists.");
        }

        var item = new StockItem
        {
            Sku = skuUpper,
            Barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim(),
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            CategoryId = request.CategoryId,
            Brand = request.Brand?.Trim(),
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? "PCS" : request.Unit.Trim().ToUpperInvariant(),
            CostPrice = Math.Max(0, request.CostPrice),
            SellingPrice = Math.Max(0, request.SellingPrice),
            QuantityOnHand = Math.Max(0, request.InitialQuantity),
            MinStockLevel = Math.Max(0, request.MinStockLevel),
            MaxStockLevel = request.MaxStockLevel > 0 ? request.MaxStockLevel : 100,
            Location = request.Location?.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.StockItems.Add(item);
        await _context.SaveChangesAsync(cancellationToken);

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
                Notes = "Initial balance entry upon product registration.",
                CreatedByUserId = userId,
                CreatedByUsername = username,
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.StockMovements.Add(movement);
            await _context.SaveChangesAsync(cancellationToken);
        }

        await _auditService.LogAsync(
            action: "CREATE",
            entityName: "Product",
            entityId: item.Id.ToString(),
            description: $"Created product '{item.Name}' with SKU '{item.Sku}'",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        await _context.Entry(item).Reference(i => i.Category).LoadAsync(cancellationToken);
        return MapToProductDto(item);
    }

    public async Task<ProductDto?> UpdateProductAsync(int id, UpdateProductRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var item = await _context.StockItems
            .Include(i => i.Category)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (item == null) return null;

        item.Name = request.Name.Trim();
        item.Description = request.Description?.Trim();
        item.CategoryId = request.CategoryId;
        item.Brand = request.Brand?.Trim();
        item.Unit = string.IsNullOrWhiteSpace(request.Unit) ? item.Unit : request.Unit.Trim().ToUpperInvariant();
        item.CostPrice = Math.Max(0, request.CostPrice);
        item.SellingPrice = Math.Max(0, request.SellingPrice);
        item.MinStockLevel = Math.Max(0, request.MinStockLevel);
        item.MaxStockLevel = request.MaxStockLevel > 0 ? request.MaxStockLevel : item.MaxStockLevel;
        item.Location = request.Location?.Trim();
        item.IsActive = request.IsActive;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "UPDATE",
            entityName: "Product",
            entityId: item.Id.ToString(),
            description: $"Updated product '{item.Name}' ({item.Sku})",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        return MapToProductDto(item);
    }

    public async Task<bool> DeleteProductAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var item = await _context.StockItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
        if (item == null) return false;

        item.IsActive = false;
        item.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "DELETE",
            entityName: "Product",
            entityId: item.Id.ToString(),
            description: $"Deactivated product '{item.Name}' ({item.Sku})",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        return true;
    }

    public async Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(bool onlyActive = true, CancellationToken cancellationToken = default)
    {
        var query = _context.StockCategories.AsNoTracking();
        if (onlyActive) query = query.Where(c => c.IsActive);
        var categories = await query.OrderBy(c => c.Name).ToListAsync(cancellationToken);
        return categories.Select(c => new CategoryDto(c.Id, c.Name, c.Description, c.IsActive, c.CreatedAtUtc)).ToList();
    }

    public async Task<CategoryDto> CreateCategoryAsync(CreateCategoryRequest request, CancellationToken cancellationToken = default)
    {
        var cat = new StockCategory
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _context.StockCategories.Add(cat);
        await _context.SaveChangesAsync(cancellationToken);
        return new CategoryDto(cat.Id, cat.Name, cat.Description, cat.IsActive, cat.CreatedAtUtc);
    }

    public async Task<CategoryDto?> UpdateCategoryAsync(int id, UpdateCategoryRequest request, CancellationToken cancellationToken = default)
    {
        var cat = await _context.StockCategories.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (cat == null) return null;
        cat.Name = request.Name.Trim();
        cat.Description = request.Description?.Trim();
        cat.IsActive = request.IsActive;
        await _context.SaveChangesAsync(cancellationToken);
        return new CategoryDto(cat.Id, cat.Name, cat.Description, cat.IsActive, cat.CreatedAtUtc);
    }

    public async Task<IReadOnlyList<BrandDto>> GetBrandsAsync(bool onlyActive = true, CancellationToken cancellationToken = default)
    {
        var query = _context.Brands.AsNoTracking();
        if (onlyActive) query = query.Where(b => b.IsActive);
        var brands = await query.OrderBy(b => b.Name).ToListAsync(cancellationToken);
        return brands.Select(b => new BrandDto(b.Id, b.Name, b.Description, b.IsActive, b.CreatedAtUtc)).ToList();
    }

    public async Task<BrandDto> CreateBrandAsync(CreateBrandRequest request, CancellationToken cancellationToken = default)
    {
        var brand = new Brand
        {
            Name = request.Name.Trim(),
            Description = request.Description?.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };
        _context.Brands.Add(brand);
        await _context.SaveChangesAsync(cancellationToken);
        return new BrandDto(brand.Id, brand.Name, brand.Description, brand.IsActive, brand.CreatedAtUtc);
    }

    public async Task<IReadOnlyList<UnitDto>> GetUnitsAsync(CancellationToken cancellationToken = default)
    {
        var units = await _context.UnitsOfMeasure.AsNoTracking().Where(u => u.IsActive).OrderBy(u => u.Code).ToListAsync(cancellationToken);
        return units.Select(u => new UnitDto(u.Id, u.Code, u.Name, u.IsActive)).ToList();
    }

    public async Task<UnitDto> CreateUnitAsync(CreateUnitRequest request, CancellationToken cancellationToken = default)
    {
        var unit = new UnitOfMeasure
        {
            Code = request.Code.Trim().ToUpperInvariant(),
            Name = request.Name.Trim(),
            IsActive = true
        };
        _context.UnitsOfMeasure.Add(unit);
        await _context.SaveChangesAsync(cancellationToken);
        return new UnitDto(unit.Id, unit.Code, unit.Name, unit.IsActive);
    }

    private static ProductDto MapToProductDto(StockItem i)
    {
        var status = i.QuantityOnHand <= 0
            ? "OutOfStock"
            : (i.QuantityOnHand <= i.MinStockLevel ? "LowStock" : "InStock");

        return new ProductDto(
            Id: i.Id,
            Sku: i.Sku,
            Barcode: i.Barcode,
            Name: i.Name,
            Description: i.Description,
            CategoryId: i.CategoryId,
            CategoryName: i.Category?.Name,
            Brand: i.Brand,
            Unit: i.Unit,
            CostPrice: i.CostPrice,
            SellingPrice: i.SellingPrice,
            QuantityOnHand: i.QuantityOnHand,
            MinStockLevel: i.MinStockLevel,
            MaxStockLevel: i.MaxStockLevel,
            Location: i.Location,
            IsActive: i.IsActive,
            Status: status,
            CreatedAtUtc: i.CreatedAtUtc,
            UpdatedAtUtc: i.UpdatedAtUtc
        );
    }
}
