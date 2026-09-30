using backend.Data;
using backend.Modules.Audit.Services;
using backend.Modules.Common;
using backend.Modules.Suppliers.DTOs;
using backend.Modules.Suppliers.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Suppliers.Services;

public interface ISupplierService
{
    Task<PagedResult<SupplierDto>> GetSuppliersAsync(string? search, bool? isActive, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<SupplierDto?> GetSupplierByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<SupplierDto> CreateSupplierAsync(CreateSupplierRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<SupplierDto?> UpdateSupplierAsync(int id, UpdateSupplierRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<bool> DeleteSupplierAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default);
}

public class SupplierService : ISupplierService
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public SupplierService(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<PagedResult<SupplierDto>> GetSuppliersAsync(
        string? search,
        bool? isActive,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.Suppliers.AsNoTracking();

        if (isActive.HasValue)
        {
            query = query.Where(s => s.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(sup => sup.SupplierCode.ToLower().Contains(s)
                                    || sup.Name.ToLower().Contains(s)
                                    || (sup.ContactPerson != null && sup.ContactPerson.ToLower().Contains(s))
                                    || (sup.Phone != null && sup.Phone.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(s => s.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToDto).ToList();
        return new PagedResult<SupplierDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<SupplierDto?> GetSupplierByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var supplier = await _context.Suppliers.AsNoTracking().FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        return supplier == null ? null : MapToDto(supplier);
    }

    public async Task<SupplierDto> CreateSupplierAsync(CreateSupplierRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var codeUpper = request.SupplierCode.Trim().ToUpperInvariant();
        var exists = await _context.Suppliers.AnyAsync(s => s.SupplierCode == codeUpper, cancellationToken);
        if (exists)
        {
            throw new InvalidOperationException($"Supplier with code '{request.SupplierCode}' already exists.");
        }

        var supplier = new Supplier
        {
            SupplierCode = codeUpper,
            Name = request.Name.Trim(),
            ContactPerson = request.ContactPerson?.Trim(),
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim(),
            Address = request.Address?.Trim(),
            PaymentTerms = string.IsNullOrWhiteSpace(request.PaymentTerms) ? "Net 30" : request.PaymentTerms.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.Suppliers.Add(supplier);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "CREATE",
            entityName: "Supplier",
            entityId: supplier.Id.ToString(),
            description: $"Registered supplier '{supplier.Name}' ({supplier.SupplierCode})",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        return MapToDto(supplier);
    }

    public async Task<SupplierDto?> UpdateSupplierAsync(int id, UpdateSupplierRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var supplier = await _context.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier == null) return null;

        supplier.Name = request.Name.Trim();
        supplier.ContactPerson = request.ContactPerson?.Trim();
        supplier.Phone = request.Phone?.Trim();
        supplier.Email = request.Email?.Trim();
        supplier.Address = request.Address?.Trim();
        supplier.PaymentTerms = string.IsNullOrWhiteSpace(request.PaymentTerms) ? supplier.PaymentTerms : request.PaymentTerms.Trim();
        supplier.IsActive = request.IsActive;
        supplier.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "UPDATE",
            entityName: "Supplier",
            entityId: supplier.Id.ToString(),
            description: $"Updated supplier '{supplier.Name}' ({supplier.SupplierCode})",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        return MapToDto(supplier);
    }

    public async Task<bool> DeleteSupplierAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var supplier = await _context.Suppliers.FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (supplier == null) return false;

        supplier.IsActive = false;
        supplier.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "DELETE",
            entityName: "Supplier",
            entityId: supplier.Id.ToString(),
            description: $"Deactivated supplier '{supplier.Name}' ({supplier.SupplierCode})",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        return true;
    }

    private static SupplierDto MapToDto(Supplier s) => new(
        s.Id,
        s.SupplierCode,
        s.Name,
        s.ContactPerson,
        s.Phone,
        s.Email,
        s.Address,
        s.PaymentTerms,
        s.IsActive,
        s.CreatedAtUtc,
        s.UpdatedAtUtc
    );
}
