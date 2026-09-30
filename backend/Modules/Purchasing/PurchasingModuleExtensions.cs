using backend.Modules.Purchasing.Services;

namespace backend.Modules.Purchasing;

public static class PurchasingModuleExtensions
{
    public static IServiceCollection AddPurchasingModule(this IServiceCollection services)
    {
        services.AddScoped<IPurchasingService, PurchasingService>();
        return services;
    }
}
