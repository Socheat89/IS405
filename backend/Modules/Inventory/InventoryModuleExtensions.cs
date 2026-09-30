using backend.Modules.Inventory.Services;

namespace backend.Modules.Inventory;

public static class InventoryModuleExtensions
{
    public static IServiceCollection AddInventoryModule(this IServiceCollection services)
    {
        services.AddScoped<IInventoryService, InventoryService>();
        return services;
    }
}
