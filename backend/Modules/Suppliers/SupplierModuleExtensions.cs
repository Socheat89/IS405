using backend.Modules.Suppliers.Services;

namespace backend.Modules.Suppliers;

public static class SupplierModuleExtensions
{
    public static IServiceCollection AddSupplierModule(this IServiceCollection services)
    {
        services.AddScoped<ISupplierService, SupplierService>();
        return services;
    }
}
