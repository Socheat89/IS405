using backend.Data;
using backend.Modules.Audit.Services;
using backend.Modules.Common;
using backend.Modules.Customers.DTOs;
using backend.Modules.Customers.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Customers.Services;

public interface ICustomerService
{
    Task<PagedResult<CustomerDto>> GetCustomersAsync(string? search, string? customerType, bool? isActive, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
    Task<CustomerDto?> GetCustomerByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<CustomerDto> CreateCustomerAsync(CreateCustomerRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<CustomerDto?> UpdateCustomerAsync(int id, UpdateCustomerRequest request, int? userId, string? username, CancellationToken cancellationToken = default);
    Task<bool> DeleteCustomerAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default);
}

public class CustomerService : ICustomerService
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public CustomerService(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    public async Task<PagedResult<CustomerDto>> GetCustomersAsync(
        string? search,
        string? customerType,
        bool? isActive,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.Customers.AsNoTracking();

        if (isActive.HasValue)
        {
            query = query.Where(c => c.IsActive == isActive.Value);
        }

        if (!string.IsNullOrWhiteSpace(customerType) && !customerType.Equals("ALL", StringComparison.OrdinalIgnoreCase))
        {
            query = query.Where(c => c.CustomerType.ToLower() == customerType.Trim().ToLower());
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(c => c.CustomerCode.ToLower().Contains(s)
                                  || c.Name.ToLower().Contains(s)
                                  || (c.Phone != null && c.Phone.ToLower().Contains(s))
                                  || (c.Email != null && c.Email.ToLower().Contains(s)));
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        var dtos = items.Select(MapToDto).ToList();
        return new PagedResult<CustomerDto>(dtos, totalCount, page, pageSize);
    }

    public async Task<CustomerDto?> GetCustomerByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        var c = await _context.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        return c == null ? null : MapToDto(c);
    }

    public async Task<CustomerDto> CreateCustomerAsync(CreateCustomerRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var codeUpper = request.CustomerCode.Trim().ToUpperInvariant();
        var exists = await _context.Customers.AnyAsync(c => c.CustomerCode == codeUpper, cancellationToken);
        if (exists)
        {
            throw new InvalidOperationException($"Customer with code '{request.CustomerCode}' already exists.");
        }

        var customer = new Customer
        {
            CustomerCode = codeUpper,
            Name = request.Name.Trim(),
            ContactPerson = request.ContactPerson?.Trim(),
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim(),
            Address = request.Address?.Trim(),
            CustomerType = string.IsNullOrWhiteSpace(request.CustomerType) ? "Registered" : request.CustomerType.Trim(),
            CreditLimit = Math.Max(0, request.CreditLimit),
            PaymentTerms = string.IsNullOrWhiteSpace(request.PaymentTerms) ? "Cash" : request.PaymentTerms.Trim(),
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        _context.Customers.Add(customer);
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "CREATE",
            entityName: "Customer",
            entityId: customer.Id.ToString(),
            description: $"Registered customer '{customer.Name}' ({customer.CustomerCode})",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        return MapToDto(customer);
    }

    public async Task<CustomerDto?> UpdateCustomerAsync(int id, UpdateCustomerRequest request, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var c = await _context.Customers.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (c == null) return null;

        c.Name = request.Name.Trim();
        c.ContactPerson = request.ContactPerson?.Trim();
        c.Phone = request.Phone?.Trim();
        c.Email = request.Email?.Trim();
        c.Address = request.Address?.Trim();
        c.CustomerType = string.IsNullOrWhiteSpace(request.CustomerType) ? c.CustomerType : request.CustomerType.Trim();
        c.CreditLimit = Math.Max(0, request.CreditLimit);
        c.PaymentTerms = string.IsNullOrWhiteSpace(request.PaymentTerms) ? c.PaymentTerms : request.PaymentTerms.Trim();
        c.IsActive = request.IsActive;
        c.UpdatedAtUtc = DateTimeOffset.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "UPDATE",
            entityName: "Customer",
            entityId: c.Id.ToString(),
            description: $"Updated customer '{c.Name}' ({c.CustomerCode})",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        return MapToDto(c);
    }

    public async Task<bool> DeleteCustomerAsync(int id, int? userId, string? username, CancellationToken cancellationToken = default)
    {
        var c = await _context.Customers.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
        if (c == null) return false;

        c.IsActive = false;
        c.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "DELETE",
            entityName: "Customer",
            entityId: c.Id.ToString(),
            description: $"Deactivated customer '{c.Name}' ({c.CustomerCode})",
            userId: userId,
            username: username,
            cancellationToken: cancellationToken
        );

        return true;
    }

    private static CustomerDto MapToDto(Customer c) => new(
        c.Id,
        c.CustomerCode,
        c.Name,
        c.ContactPerson,
        c.Phone,
        c.Email,
        c.Address,
        c.CustomerType,
        c.CreditLimit,
        c.PaymentTerms,
        c.IsActive,
        c.CreatedAtUtc,
        c.UpdatedAtUtc
    );
}
