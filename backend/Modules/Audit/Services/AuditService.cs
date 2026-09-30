using backend.Data;
using backend.Modules.Audit.Models;
using backend.Modules.Common;
using Microsoft.EntityFrameworkCore;

namespace backend.Modules.Audit.Services;

public interface IAuditService
{
    Task LogAsync(string action, string entityName, string? entityId, string description, string? detailsJson = null, int? userId = null, string? username = null, string? ipAddress = null, CancellationToken cancellationToken = default);
    Task<PagedResult<AuditLog>> GetLogsAsync(string? search, string? action, string? entityName, DateTimeOffset? fromDate, DateTimeOffset? toDate, int page = 1, int pageSize = 50, CancellationToken cancellationToken = default);
}

public class AuditService : IAuditService
{
    private readonly AppDbContext _context;

    public AuditService(AppDbContext context)
    {
        _context = context;
    }

    public async Task LogAsync(
        string action,
        string entityName,
        string? entityId,
        string description,
        string? detailsJson = null,
        int? userId = null,
        string? username = null,
        string? ipAddress = null,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var log = new AuditLog
            {
                Action = action.ToUpperInvariant(),
                EntityName = entityName,
                EntityId = entityId,
                Description = description,
                DetailsJson = detailsJson,
                UserId = userId,
                Username = username,
                IpAddress = ipAddress,
                CreatedAtUtc = DateTimeOffset.UtcNow
            };

            _context.AuditLogs.Add(log);
            await _context.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            // Logging shouldn't crash the main flow if there's an issue
            Console.WriteLine($"[AuditService Warning] Failed to write audit log: {ex.Message}");
        }
    }

    public async Task<PagedResult<AuditLog>> GetLogsAsync(
        string? search,
        string? action,
        string? entityName,
        DateTimeOffset? fromDate,
        DateTimeOffset? toDate,
        int page = 1,
        int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _context.AuditLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(l => (l.Username != null && l.Username.ToLower().Contains(s))
                                  || l.Description.ToLower().Contains(s)
                                  || (l.EntityId != null && l.EntityId.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            query = query.Where(l => l.Action == action.ToUpperInvariant());
        }

        if (!string.IsNullOrWhiteSpace(entityName))
        {
            query = query.Where(l => l.EntityName.ToLower() == entityName.ToLower());
        }

        if (fromDate.HasValue)
        {
            query = query.Where(l => l.CreatedAtUtc >= fromDate.Value);
        }

        if (toDate.HasValue)
        {
            query = query.Where(l => l.CreatedAtUtc <= toDate.Value);
        }

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(l => l.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<AuditLog>(items, totalCount, page, pageSize);
    }
}
