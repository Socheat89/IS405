using backend.Modules.Inventory.Models;

namespace backend.Models.Data;

public class AppUserWarehouse
{
    public int UserId { get; set; }
    public AppUser? User { get; set; }

    public int WarehouseId { get; set; }
    public Warehouse? Warehouse { get; set; }

    public bool IsDefault { get; set; } = false;
    public DateTimeOffset AssignedAtUtc { get; set; } = DateTimeOffset.UtcNow;
    public int? AssignedBy { get; set; }
}
