namespace backend.Modules.Catalog.DTOs;

public record ProductDto(
    int Id,
    string Sku,
    string? Barcode,
    string Name,
    string? Description,
    int? CategoryId,
    string? CategoryName,
    string? Brand,
    string Unit,
    decimal CostPrice,
    decimal SellingPrice,
    int QuantityOnHand,
    int MinStockLevel,
    int MaxStockLevel,
    string? Location,
    bool IsActive,
    string Status, // InStock, LowStock, OutOfStock
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc
);

public record CreateProductRequest(
    string Sku,
    string? Barcode,
    string Name,
    string? Description,
    int? CategoryId,
    string? Brand,
    string? Unit,
    decimal CostPrice,
    decimal SellingPrice,
    int InitialQuantity,
    int MinStockLevel,
    int MaxStockLevel,
    string? Location
);

public record UpdateProductRequest(
    string Name,
    string? Description,
    int? CategoryId,
    string? Brand,
    string? Unit,
    decimal CostPrice,
    decimal SellingPrice,
    int MinStockLevel,
    int MaxStockLevel,
    string? Location,
    bool IsActive
);

public record CategoryDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc
);

public record CreateCategoryRequest(
    string Name,
    string? Description
);

public record UpdateCategoryRequest(
    string Name,
    string? Description,
    bool IsActive
);

public record BrandDto(
    int Id,
    string Name,
    string? Description,
    bool IsActive,
    DateTimeOffset CreatedAtUtc
);

public record CreateBrandRequest(
    string Name,
    string? Description
);

public record UpdateBrandRequest(
    string Name,
    string? Description,
    bool IsActive
);

public record UnitDto(
    int Id,
    string Code,
    string Name,
    bool IsActive
);

public record CreateUnitRequest(
    string Code,
    string Name
);
