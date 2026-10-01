using System.Text;
using Microsoft.AspNetCore.Authorization;
using backend.Data;
using backend.Services;
using backend.Services.Navigation;
using backend.Services.Permission;
using backend.Services.TwoFactor;
using backend.Modules.Audit;
using backend.Modules.Catalog;
using backend.Modules.Suppliers;
using backend.Modules.Customers;
using backend.Modules.Inventory;
using backend.Modules.Purchasing;
using backend.Modules.Sales;
using backend.Modules.Reports;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// Support dynamic PORT environment variable for Render / Cloud hosts
var renderPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(renderPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{renderPort}");
}

// 1. Database Configuration
var dbProvider = builder.Configuration["DatabaseProvider"] 
              ?? Environment.GetEnvironmentVariable("DATABASE_PROVIDER") 
              ?? "Sqlite";

var postgresConn = builder.Configuration.GetConnectionString("PostgreSqlConnection")
                ?? builder.Configuration.GetConnectionString("SupabaseConnection")
                ?? Environment.GetEnvironmentVariable("DATABASE_URL")
                ?? Environment.GetEnvironmentVariable("SUPABASE_DB_URL");

if (!string.IsNullOrWhiteSpace(postgresConn) || 
    string.Equals(dbProvider, "PostgreSql", StringComparison.OrdinalIgnoreCase) || 
    string.Equals(dbProvider, "Postgres", StringComparison.OrdinalIgnoreCase) || 
    string.Equals(dbProvider, "Supabase", StringComparison.OrdinalIgnoreCase))
{
    var formattedConn = ConvertPostgresUriToConnectionString(postgresConn ?? "");
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(formattedConn));
}
else if (string.Equals(dbProvider, "Oracle", StringComparison.OrdinalIgnoreCase))
{
    var oracleConnection = builder.Configuration.GetConnectionString("OracleConnection")
        ?? throw new InvalidOperationException("OracleConnection string is not configured.");
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseOracle(oracleConnection));
}
else
{
    var sqliteConnection = builder.Configuration.GetConnectionString("DefaultConnection")
        ?? "Data Source=is405.db";
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseSqlite(sqliteConnection));
}

// 2. JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
{
    jwtKey = "IS405_SuperSecret_Jwt_SigningKey_With_At_Least_256_Bits_Secure_Key_2026!";
}
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "https://localhost:7230";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "https://localhost:7230";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtAudience,
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30)
    };
});

builder.Services.AddAuthorization(options =>
{
    // "FullAuth" policy: requires a fully-authenticated access token.
    // Challenge tokens (issued during 2FA login flow) are rejected here,
    // so navigation, permissions, and roles cannot be accessed until
    // the user completes Two-Factor verification.
    options.AddPolicy("FullAuth", policy =>
        policy.RequireAuthenticatedUser()
              .RequireAssertion(ctx =>
              {
                  var tokenType = ctx.User.FindFirst("token_type")?.Value;
                  return tokenType != "2fa_challenge";
              }));
});

// 3. Application Services
builder.Services.AddSingleton<backend.Services.Security.IIpLockoutService, backend.Services.Security.IpLockoutService>();
builder.Services.AddScoped<backend.Services.Email.IEmailService, backend.Services.Email.EmailService>();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<ITwoFactorService, TwoFactorService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<INavigationService, NavigationService>();
builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<IRoleService, RoleService>();

// 3b. Modular Microservices
builder.Services.AddAuditModule();
builder.Services.AddCatalogModule();
builder.Services.AddSupplierModule();
builder.Services.AddCustomerModule();
builder.Services.AddInventoryModule();
builder.Services.AddPurchasingModule();
builder.Services.AddSalesModule();
builder.Services.AddReportingModule();

// 4. Controllers & JSON Options
builder.Services.AddControllers();

// 5. CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 5b. Rate Limiting (Brute-Force & DoS Protection)
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("AuthRateLimit", httpContext =>
        System.Threading.RateLimiting.RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new System.Threading.RateLimiting.FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));
});

// 6. Swagger / OpenAPI Documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "IS405 Auth, Navigation, Permissions, and Roles API",
        Version = "v1"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });

    c.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecuritySchemeReference("Bearer", document),
            new List<string>()
        }
    });
});

var app = builder.Build();

// 7. Seed Database on startup & Transfer from SQLite if Oracle with Automatic Retry Policy
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    var provider = builder.Configuration["DatabaseProvider"] ?? "Sqlite";
    
    int maxRetries = 20;
    int delaySeconds = 5;
    bool initialized = false;

    for (int attempt = 1; attempt <= maxRetries; attempt++)
    {
        try
        {
            logger.LogInformation("[Database Initialization] Attempt {Attempt}/{MaxRetries}: Connecting and seeding database...", attempt, maxRetries);
            await DbSeeder.SeedAsync(db);

            if (string.Equals(provider, "Oracle", StringComparison.OrdinalIgnoreCase) ||
                !string.IsNullOrWhiteSpace(postgresConn) ||
                string.Equals(provider, "PostgreSql", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(provider, "Postgres", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(provider, "Supabase", StringComparison.OrdinalIgnoreCase))
            {
                var sqliteConn = builder.Configuration.GetConnectionString("DefaultConnection") ?? "Data Source=is405.db";
                await DataMigrator.TransferFromSqliteAsync(sqliteConn, db);
            }

            initialized = true;
            logger.LogInformation("[Database Initialization] Database initialized, migrated, and seeded successfully!");
            break;
        }
        catch (Exception ex)
        {
            logger.LogWarning("[Database Initialization] Attempt {Attempt}/{MaxRetries} failed: {Message}. Retrying in {Delay}s...", attempt, maxRetries, ex.Message, delaySeconds);
            if (attempt < maxRetries)
            {
                await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
            }
        }
    }

    if (!initialized)
    {
        logger.LogError("[Database Initialization] CRITICAL: Could not initialize database after {MaxRetries} attempts.", maxRetries);
    }
}

// 8. HTTP Pipeline & Security Hardening
// 8a. Global Unhandled Exception Handling Middleware (Prevent Stack Trace & Info Leaks)
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        var logger = context.RequestServices.GetService<ILogger<Program>>();
        logger?.LogError(ex, "Unhandled exception processing request {Method} {Path}", context.Request.Method, context.Request.Path);

        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";
            var msg = ex.InnerException != null ? $"{ex.Message} -> {ex.InnerException.Message}" : ex.Message;
            var safeMsg = System.Text.Json.JsonSerializer.Serialize(new { message = msg, error = ex.GetType().Name });
            await context.Response.WriteAsync(safeMsg);
        }
    }
});

// 8b. HTTP Security Headers Middleware (OWASP Secure Headers)
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["X-XSS-Protection"] = "0";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';";
    context.Response.Headers["Permissions-Policy"] = "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

    await next();
});

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "IS405 API v1");
    c.RoutePrefix = "swagger";
});

app.UseRouting();

app.UseCors();

app.UseRateLimiter();

app.UseAuthentication();

// 8c. Middleware: Reject requests if the authenticated user account has been disabled or is locked
app.Use(async (context, next) =>
{
    if (context.User.Identity?.IsAuthenticated == true)
    {
        var idClaim = context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
                   ?? context.User.FindFirst("sub")?.Value;

        if (int.TryParse(idClaim, out var userId))
        {
            var dbContext = context.RequestServices.GetRequiredService<AppDbContext>();
            var userStatus = await dbContext.Users
                .AsNoTracking()
                .Where(u => u.Id == userId)
                .Select(u => new { u.IsActive, u.LockoutEndUtc })
                .FirstOrDefaultAsync(context.RequestAborted);

            if (userStatus == null || !userStatus.IsActive)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{\"message\":\"Account has been disabled. Please contact system administrator.\"}", context.RequestAborted);
                return;
            }

            if (userStatus.LockoutEndUtc.HasValue && userStatus.LockoutEndUtc.Value > DateTimeOffset.UtcNow)
            {
                context.Response.StatusCode = StatusCodes.Status423Locked;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsync("{\"message\":\"Account is locked. Please try again later.\"}", context.RequestAborted);
                return;
            }
        }
    }

    await next();
});

app.UseAuthorization();

app.MapControllers();

app.Run();

static string ConvertPostgresUriToConnectionString(string uriOrConnStr)
{
    if (string.IsNullOrWhiteSpace(uriOrConnStr)) return uriOrConnStr;
    uriOrConnStr = uriOrConnStr.Trim();

    if (uriOrConnStr.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        uriOrConnStr.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var stripped = System.Text.RegularExpressions.Regex.Replace(uriOrConnStr, @"^postgres(ql)?://", "", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
            var match = System.Text.RegularExpressions.Regex.Match(stripped, @"^(?<user>[^:]+):(?<pwd>.+?)@(?<host>[^:/]+)(:(?<port>\d+))?(/(?<db>[^?]+))?(\?.*)?$");
            if (match.Success)
            {
                var user = match.Groups["user"].Value;
                var pwd = match.Groups["pwd"].Value;
                if (pwd.StartsWith("[") && pwd.EndsWith("]"))
                {
                    pwd = pwd.Substring(1, pwd.Length - 2);
                }
                pwd = Uri.UnescapeDataString(pwd);

                var host = match.Groups["host"].Value;
                var port = match.Groups["port"].Success ? match.Groups["port"].Value : "5432";
                var db = match.Groups["db"].Success && !string.IsNullOrWhiteSpace(match.Groups["db"].Value) 
                    ? match.Groups["db"].Value 
                    : "postgres";

                return $"Server={host};Port={port};Database={db};User Id={user};Password={pwd};SSL Mode=Require;Trust Server Certificate=true;";
            }

            var uri = new Uri(uriOrConnStr);
            var userInfo = uri.UserInfo.Split(':');
            var u = userInfo.Length > 0 ? Uri.UnescapeDataString(userInfo[0]) : "postgres";
            var p = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            if (p.StartsWith("[") && p.EndsWith("]")) p = p.Substring(1, p.Length - 2);
            var database = uri.AbsolutePath.TrimStart('/');
            if (string.IsNullOrEmpty(database)) database = "postgres";
            var prt = uri.Port > 0 ? uri.Port : 5432;
            return $"Server={uri.Host};Port={prt};Database={database};User Id={u};Password={p};SSL Mode=Require;Trust Server Certificate=true;";
        }
        catch
        {
            return uriOrConnStr;
        }
    }

    // For standard ADO.NET connection strings, ensure SSL Mode is set for Supabase cloud
    if (!uriOrConnStr.Contains("SSL Mode", StringComparison.OrdinalIgnoreCase) && 
        (uriOrConnStr.Contains("supabase.co", StringComparison.OrdinalIgnoreCase) || uriOrConnStr.Contains("pooler.supabase.com", StringComparison.OrdinalIgnoreCase)))
    {
        uriOrConnStr = uriOrConnStr.TrimEnd(';') + ";SSL Mode=Require;Trust Server Certificate=true;";
    }

    return uriOrConnStr;
}

public partial class Program { }
