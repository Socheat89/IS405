using backend.Modules.Reports.Services;

namespace backend.Modules.Reports;

public static class ReportingModuleExtensions
{
    public static IServiceCollection AddReportingModule(this IServiceCollection services)
    {
        services.AddScoped<IReportService, ReportService>();
        return services;
    }
}
