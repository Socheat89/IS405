using System.Text.Json;
using backend.Data;
using backend.Models.Data;
using backend.Modules.Audit.Services;
using backend.Services.Permission;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace backend.Controllers;

public class UpdateCompanySettingsDto
{
    public string? CompanyName { get; set; }
    public string? AppName { get; set; }
    public string? TaxId { get; set; }
    public string? CompanyPhone { get; set; }
    public string? CompanyEmail { get; set; }
    public string? CompanyAddress { get; set; }
    public int? DefaultWarehouseId { get; set; }
    public string? DefaultWarehouseLocation { get; set; }
    public string? CurrencyCode { get; set; }
    public string? CurrencySymbol { get; set; }
    public decimal? VatRatePercentage { get; set; }
    public string? Timezone { get; set; }
    public string? DefaultLanguage { get; set; }
    public bool? AllowMultiWarehouse { get; set; }
    public bool? EnforceTwoFactor { get; set; }
    public bool? RequireStrongPassword { get; set; }
    public int? SessionTimeoutMinutes { get; set; }
    public int? MaxFailedAttempts { get; set; }
    public int? LockoutDurationMinutes { get; set; }
    public bool? MockModeEnabled { get; set; }
}

[ApiController]
[Route("api/settings")]
[Authorize("FullAuth")]
public class SettingsController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IAuditService _auditService;

    public SettingsController(AppDbContext context, IAuditService auditService)
    {
        _context = context;
        _auditService = auditService;
    }

    [HttpGet]
    public async Task<IActionResult> GetSettings(CancellationToken cancellationToken)
    {
        var setting = await _context.CompanySettings
            .Include(cs => cs.DefaultWarehouse)
            .FirstOrDefaultAsync(cancellationToken);

        if (setting == null)
        {
            var mainWh = await _context.Warehouses.FirstOrDefaultAsync(w => w.Code == "WH-MAIN", cancellationToken);
            setting = new CompanySetting
            {
                CompanyName = "Mekong Stock Enterprise Co., Ltd.",
                AppName = "Mekong Stock ERP",
                TaxId = "K008-902104588",
                CompanyPhone = "+855 23 999 888",
                CompanyEmail = "info@mekongstock.com.kh",
                CompanyAddress = "Phnom Penh Special Economic Zone (PPSEZ), National Road 4, Phnom Penh, Cambodia",
                DefaultWarehouseId = mainWh?.Id,
                DefaultWarehouseLocation = mainWh?.Name ?? "Main Warehouse Phnom Penh",
                CurrencyCode = "USD",
                CurrencySymbol = "$",
                VatRatePercentage = 10m,
                Timezone = "Asia/Phnom_Penh",
                DefaultLanguage = "km",
                AllowMultiWarehouse = true,
                EnforceTwoFactor = true,
                RequireStrongPassword = true,
                SessionTimeoutMinutes = 60,
                MaxFailedAttempts = 5,
                LockoutDurationMinutes = 15,
                MockModeEnabled = false,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            _context.CompanySettings.Add(setting);
            await _context.SaveChangesAsync(cancellationToken);
        }

        var warehouses = await _context.Warehouses
            .AsNoTracking()
            .OrderBy(w => w.Name)
            .Select(w => new
            {
                id = w.Id,
                code = w.Code,
                name = w.Name,
                location = w.Location,
                contactPhone = w.ContactPhone,
                isActive = w.IsActive,
                createdAtUtc = w.CreatedAtUtc
            })
            .ToListAsync(cancellationToken);

        var response = new
        {
            id = setting.Id,
            companyName = setting.CompanyName,
            appName = setting.AppName,
            taxId = setting.TaxId,
            companyPhone = setting.CompanyPhone,
            companyEmail = setting.CompanyEmail,
            companyAddress = setting.CompanyAddress,
            defaultWarehouseId = setting.DefaultWarehouseId,
            defaultWarehouseLocation = setting.DefaultWarehouse?.Name ?? setting.DefaultWarehouseLocation ?? "Main Warehouse Phnom Penh",
            currencyCode = setting.CurrencyCode,
            currencySymbol = setting.CurrencySymbol,
            currency = setting.CurrencyCode,
            vatRatePercentage = setting.VatRatePercentage,
            timezone = setting.Timezone,
            defaultLanguage = setting.DefaultLanguage,
            allowMultiWarehouse = setting.AllowMultiWarehouse,
            enforceTwoFactor = setting.EnforceTwoFactor,
            requireStrongPassword = setting.RequireStrongPassword,
            sessionTimeoutMinutes = setting.SessionTimeoutMinutes,
            maxFailedAttempts = setting.MaxFailedAttempts,
            lockoutDurationMinutes = setting.LockoutDurationMinutes,
            mockModeEnabled = setting.MockModeEnabled,
            updatedAtUtc = setting.UpdatedAtUtc,
            apiBaseUrl = "http://localhost:5000/api",
            stockMicroserviceUrl = "http://localhost:5000/api/stock",
            authMicroserviceUrl = "http://localhost:5000/api/auth",
            purchaseMicroserviceUrl = "http://localhost:5000/api/purchases",
            salesMicroserviceUrl = "http://localhost:5000/api/sales",
            warehouses = warehouses
        };

        return Ok(response);
    }

    [HttpPut]
    public async Task<IActionResult> SaveSettings([FromBody] UpdateCompanySettingsDto dto, CancellationToken cancellationToken)
    {
        var userId = PermissionChecker.GetUserId(User);
        if (userId == null) return Unauthorized();

        if (!await PermissionChecker.HasPermissionAsync(_context, userId.Value, "settings.view", "settings.edit", "users.edit"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "You do not have permission to update settings." });
        }

        var setting = await _context.CompanySettings
            .Include(cs => cs.DefaultWarehouse)
            .FirstOrDefaultAsync(cancellationToken);

        if (setting == null)
        {
            setting = new CompanySetting();
            _context.CompanySettings.Add(setting);
        }

        if (!string.IsNullOrWhiteSpace(dto.CompanyName)) setting.CompanyName = dto.CompanyName.Trim();
        if (!string.IsNullOrWhiteSpace(dto.AppName)) setting.AppName = dto.AppName.Trim();
        if (dto.TaxId != null) setting.TaxId = dto.TaxId.Trim();
        if (dto.CompanyPhone != null) setting.CompanyPhone = dto.CompanyPhone.Trim();
        if (dto.CompanyEmail != null) setting.CompanyEmail = dto.CompanyEmail.Trim();
        if (dto.CompanyAddress != null) setting.CompanyAddress = dto.CompanyAddress.Trim();

        if (dto.DefaultWarehouseId.HasValue)
        {
            var wh = await _context.Warehouses.FirstOrDefaultAsync(w => w.Id == dto.DefaultWarehouseId.Value, cancellationToken);
            if (wh != null)
            {
                setting.DefaultWarehouseId = wh.Id;
                setting.DefaultWarehouseLocation = wh.Name;
            }
        }
        else if (!string.IsNullOrWhiteSpace(dto.DefaultWarehouseLocation))
        {
            setting.DefaultWarehouseLocation = dto.DefaultWarehouseLocation.Trim();
        }

        if (!string.IsNullOrWhiteSpace(dto.CurrencyCode)) setting.CurrencyCode = dto.CurrencyCode.Trim();
        if (!string.IsNullOrWhiteSpace(dto.CurrencySymbol)) setting.CurrencySymbol = dto.CurrencySymbol.Trim();
        if (dto.VatRatePercentage.HasValue) setting.VatRatePercentage = dto.VatRatePercentage.Value;
        if (!string.IsNullOrWhiteSpace(dto.Timezone)) setting.Timezone = dto.Timezone.Trim();
        if (!string.IsNullOrWhiteSpace(dto.DefaultLanguage)) setting.DefaultLanguage = dto.DefaultLanguage.Trim();

        if (dto.AllowMultiWarehouse.HasValue) setting.AllowMultiWarehouse = dto.AllowMultiWarehouse.Value;
        if (dto.EnforceTwoFactor.HasValue) setting.EnforceTwoFactor = dto.EnforceTwoFactor.Value;
        if (dto.RequireStrongPassword.HasValue) setting.RequireStrongPassword = dto.RequireStrongPassword.Value;
        if (dto.SessionTimeoutMinutes.HasValue) setting.SessionTimeoutMinutes = dto.SessionTimeoutMinutes.Value;
        if (dto.MaxFailedAttempts.HasValue) setting.MaxFailedAttempts = dto.MaxFailedAttempts.Value;
        if (dto.LockoutDurationMinutes.HasValue) setting.LockoutDurationMinutes = dto.LockoutDurationMinutes.Value;
        if (dto.MockModeEnabled.HasValue) setting.MockModeEnabled = dto.MockModeEnabled.Value;

        setting.UpdatedAtUtc = DateTimeOffset.UtcNow;
        await _context.SaveChangesAsync(cancellationToken);

        await _auditService.LogAsync(
            action: "UPDATE_SETTINGS",
            entityName: "CompanySetting",
            entityId: setting.Id.ToString(),
            description: $"System and Company settings were updated by '{User.Identity?.Name}'",
            userId: userId,
            username: User.Identity?.Name,
            ipAddress: HttpContext.Connection.RemoteIpAddress?.ToString(),
            cancellationToken: cancellationToken);

        return await GetSettings(cancellationToken);
    }
}
