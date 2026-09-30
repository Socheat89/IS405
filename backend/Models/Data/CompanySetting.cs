using backend.Modules.Inventory.Models;

namespace backend.Models.Data;

public class CompanySetting
{
    public int Id { get; set; } = 1;
    public string CompanyName { get; set; } = "Mekong Stock Enterprise Co., Ltd.";
    public string AppName { get; set; } = "Mekong Stock ERP";
    public string? TaxId { get; set; } = "K008-902104588";
    public string? CompanyPhone { get; set; } = "+855 23 999 888";
    public string? CompanyEmail { get; set; } = "info@mekongstock.com.kh";
    public string? CompanyAddress { get; set; } = "Phnom Penh Special Economic Zone (PPSEZ), National Road 4, Phnom Penh, Cambodia";
    
    public int? DefaultWarehouseId { get; set; }
    public Warehouse? DefaultWarehouse { get; set; }
    public string? DefaultWarehouseLocation { get; set; } = "Main Warehouse - Phnom Penh";

    public string CurrencyCode { get; set; } = "USD";
    public string CurrencySymbol { get; set; } = "$";
    public decimal VatRatePercentage { get; set; } = 10m;
    public string Timezone { get; set; } = "Asia/Phnom_Penh";
    public string DefaultLanguage { get; set; } = "km";

    public bool AllowMultiWarehouse { get; set; } = true;
    public bool EnforceTwoFactor { get; set; } = true;
    public bool RequireStrongPassword { get; set; } = true;
    public int SessionTimeoutMinutes { get; set; } = 60;
    public int MaxFailedAttempts { get; set; } = 5;
    public int LockoutDurationMinutes { get; set; } = 15;
    public bool MockModeEnabled { get; set; } = false;

    public DateTimeOffset UpdatedAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
