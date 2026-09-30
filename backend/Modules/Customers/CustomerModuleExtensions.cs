using backend.Modules.Customers.Services;

namespace backend.Modules.Customers;

public static class CustomerModuleExtensions
{
    public static IServiceCollection AddCustomerModule(this IServiceCollection services)
    {
        services.AddScoped<ICustomerService, CustomerService>();
        return services;
    }
}
