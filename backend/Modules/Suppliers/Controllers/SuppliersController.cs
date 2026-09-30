using System.Security.Claims;
using backend.Modules.Common;
using backend.Modules.Suppliers.DTOs;
using backend.Modules.Suppliers.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Modules.Suppliers.Controllers;

[ApiController]
[Route("api/suppliers")]
[Authorize("FullAuth")]
public class SuppliersController : ControllerBase
{
    private readonly ISupplierService _supplierService;

    public SuppliersController(ISupplierService supplierService)
    {
        _supplierService = supplierService;
    }

    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<SupplierDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSuppliers(
        [FromQuery] string? search,
        [FromQuery] bool? isActive,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await _supplierService.GetSuppliersAsync(search, isActive, page, pageSize, cancellationToken);
        return Ok(result);
    }

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(SupplierDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetSupplier(int id, CancellationToken cancellationToken)
    {
        var supplier = await _supplierService.GetSupplierByIdAsync(id, cancellationToken);
        if (supplier == null)
            return NotFound(new { message = $"Supplier with ID {id} not found." });

        return Ok(supplier);
    }

    [HttpPost]
    [ProducesResponseType(typeof(SupplierDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSupplier([FromBody] CreateSupplierRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.SupplierCode) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Supplier code and name are required." });

        try
        {
            var created = await _supplierService.CreateSupplierAsync(request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
            return CreatedAtAction(nameof(GetSupplier), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(SupplierDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateSupplier(int id, [FromBody] UpdateSupplierRequest request, CancellationToken cancellationToken)
    {
        var updated = await _supplierService.UpdateSupplierAsync(id, request, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
        if (updated == null)
            return NotFound(new { message = $"Supplier with ID {id} not found." });

        return Ok(updated);
    }

    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteSupplier(int id, CancellationToken cancellationToken)
    {
        var deleted = await _supplierService.DeleteSupplierAsync(id, GetCurrentUserId(), GetCurrentUsername(), cancellationToken);
        if (!deleted)
            return NotFound(new { message = $"Supplier with ID {id} not found." });

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
