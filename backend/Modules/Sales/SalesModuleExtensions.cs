using backend.Modules.Sales.Services;

namespace backend.Modules.Sales;

public static class SalesModuleExtensions
{
    public static IServiceCollection AddSalesModule(this IServiceCollection services)
    {
        services.AddScoped<ISalesService, SalesService>();
        return services;
    }
}
