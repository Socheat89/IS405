using System.Security.Claims;
using backend.Modules.Catalog.DTOs;
using backend.Modules.Catalog.Services;
using backend.Modules.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Catalog.Controllers;

[ApiController]
[Route("api/products")]
[Authorize("FullAuth")]
public class ProductsController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    public ProductsController(ICatalogService catalogService)
    {
        _catalogService = catalogService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ProductDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetProducts(
        [FromQuery] string? search,
        [FromQuery] int? categoryId,
        [FromQuery] string? brand,
        [FromQuery] string? status,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _catalogService.GetProductsAsync(search, categoryId, brand, status, isActive, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetProduct(int id, CancellationToken cancellationToken)
    {
        var product = await _catalogService.GetProductByIdAsync(id, cancellationToken);
        if (product == null)
            return NotFound(new { message = $"Product with ID {id} not found." });

        return Ok(product);
    }

    [HttpPost]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateProduct([FromBody] CreateProductRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Sku) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "SKU and Name are required." });

        try
        {
            var product = await _catalogService.CreateProductAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetProduct), new { id = product.Id }, product);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(ProductDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProduct(int id, [FromBody] UpdateProductRequest request, CancellationToken cancellationToken)
    {
        var product = await _catalogService.UpdateProductAsync(id, request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
        if (product == null)
            return NotFound(new { message = $"Product with ID {id} not found." });

        return Ok(product);
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteProduct(int id, CancellationToken cancellationToken)
    {
        var deleted = await _catalogService.DeleteProductAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
        if (!deleted)
            return NotFound(new { message = $"Product with ID {id} not found." });

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
[Route("api/categories")]
[Authorize("FullAuth")]
public class CategoriesController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    public CategoriesController(ICatalogService catalogService)
    {
        _catalogService = catalogService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<CategoryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCategories([FromQuery] bool onlyActive = true, CancellationToken cancellationToken = default)
    {
        var result = await _catalogService.GetCategoriesAsync(onlyActive, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateCategory([FromBody] CreateCategoryRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Category name is required." });

        var created = await _catalogService.CreateCategoryAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetCategories), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(CategoryDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateCategory(int id, [FromBody] UpdateCategoryRequest request, CancellationToken cancellationToken)
    {
        var updated = await _catalogService.UpdateCategoryAsync(id, request, cancellationToken);
        if (updated == null)
            return NotFound(new { message = $"Category with ID {id} not found." });

        return Ok(updated);
    }
}

[ApiController]
[Route("api/brands")]
[Authorize("FullAuth")]
public class BrandsController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    public BrandsController(ICatalogService catalogService)
    {
        _catalogService = catalogService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<BrandDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBrands([FromQuery] bool onlyActive = true, CancellationToken cancellationToken = default)
    {
        var result = await _catalogService.GetBrandsAsync(onlyActive, cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(BrandDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateBrand([FromBody] CreateBrandRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Brand name is required." });

        var created = await _catalogService.CreateBrandAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetBrands), new { id = created.Id }, created);
    }
}

[ApiController]
[Route("api/catalog/units")]
[Authorize("FullAuth")]
public class UnitsController : ControllerBase
{
    private readonly ICatalogService _catalogService;

    public UnitsController(ICatalogService catalogService)
    {
        _catalogService = catalogService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<UnitDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetUnits(CancellationToken cancellationToken = default)
    {
        var result = await _catalogService.GetUnitsAsync(cancellationToken);
        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(UnitDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> CreateUnit([FromBody] CreateUnitRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Unit code and name are required." });

        var created = await _catalogService.CreateUnitAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetUnits), new { id = created.Id }, created);
    }
}
