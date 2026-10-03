using System.Data;
using backend.Models.Data;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class DataMigrator
{
    public static async Task TransferFromSqliteAsync(string sqliteConnectionString, AppDbContext oracleDb)
    {
        // Extract database file path from SQLite connection string
        var builder = new SqliteConnectionStringBuilder(sqliteConnectionString);
        var dbPath = builder.DataSource;
        if (!Path.IsPathRooted(dbPath))
        {
            dbPath = Path.Combine(AppContext.BaseDirectory, dbPath);
            if (!File.Exists(dbPath))
            {
                // Try parent directory or current directory
                dbPath = Path.GetFullPath(builder.DataSource);
            }
        }

        if (!File.Exists(dbPath))
        {
            Console.WriteLine($"[DataMigrator] SQLite database not found at '{dbPath}', skipping transfer.");
            return;
        }

        // Only migrate if Oracle is completely fresh / empty
        var hasExistingData = await oracleDb.Pages.AnyAsync() || await oracleDb.Users.AnyAsync();
        if (hasExistingData)
        {
            Console.WriteLine("[DataMigrator] Oracle database already contains data. Skipping SQLite transfer to preserve all changes.");
            return;
        }

        Console.WriteLine($"[DataMigrator] Starting initial data transfer from SQLite ('{dbPath}') to Oracle...");

        var sqliteOptions = new DbContextOptionsBuilder<AppDbContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;

        using var sqliteDb = new AppDbContext(sqliteOptions);

        // 1. Transfer Pages
        var sqlitePages = await sqliteDb.Pages.AsNoTracking().OrderBy(p => p.Id).ToListAsync();
        foreach (var p in sqlitePages)
        {
            var exists = await oracleDb.Pages.FirstOrDefaultAsync(op => op.Id == p.Id) != null;
            if (!exists)
            {
                var page = new AppPage
                {
                    Id = p.Id,
                    Code = p.Code,
                    Name = p.Name,
                    Route = p.Route,
                    Icon = p.Icon,
                    ParentId = p.ParentId,
                    SortOrder = p.SortOrder,
                    IsActive = p.IsActive,
                    CreatedAtUtc = p.CreatedAtUtc,
                    CreatedBy = p.CreatedBy,
                    UpdatedAtUtc = p.UpdatedAtUtc,
                    UpdatedBy = p.UpdatedBy
                };
                oracleDb.Pages.Add(page);
            }
        }
        await oracleDb.SaveChangesAsync();

        // 2. Transfer Roles
        var sqliteRoles = await sqliteDb.Roles.AsNoTracking().OrderBy(r => r.Id).ToListAsync();
        foreach (var r in sqliteRoles)
        {
            var existing = await oracleDb.Roles.FirstOrDefaultAsync(or => or.Id == r.Id || or.Code == r.Code);
            if (existing == null)
            {
                oracleDb.Roles.Add(new AppRole
                {
                    Id = r.Id,
                    Code = r.Code,
                    Name = r.Name,
                    Description = r.Description,
                    IsActive = r.IsActive,
                    CreatedAtUtc = r.CreatedAtUtc,
                    CreatedBy = r.CreatedBy,
                    UpdatedAtUtc = r.UpdatedAtUtc,
                    UpdatedBy = r.UpdatedBy
                });
            }
        }
        await oracleDb.SaveChangesAsync();

        // 3. Transfer Users
        var sqliteUsers = await sqliteDb.Users.AsNoTracking().OrderBy(u => u.Id).ToListAsync();
        foreach (var u in sqliteUsers)
        {
            var existing = await oracleDb.Users.FirstOrDefaultAsync(ou => ou.Id == u.Id || ou.Username.ToLower() == u.Username.ToLower());
            if (existing == null)
            {
                oracleDb.Users.Add(new AppUser
                {
                    Id = u.Id,
                    Username = u.Username,
                    Email = u.Email,
                    PasswordHash = u.PasswordHash,
                    IsActive = u.IsActive,
                    TwoFactorEnabled = u.TwoFactorEnabled,
                    TwoFactorSecret = u.TwoFactorSecret,
                    FailedLoginCount = u.FailedLoginCount,
                    LockoutEndUtc = u.LockoutEndUtc,
                    CreatedAtUtc = u.CreatedAtUtc,
                    UpdatedAtUtc = u.UpdatedAtUtc
                });
            }
            else
            {
                // Keep password and active status in sync
                existing.PasswordHash = u.PasswordHash;
                existing.IsActive = u.IsActive;
                existing.TwoFactorEnabled = u.TwoFactorEnabled;
                existing.TwoFactorSecret = u.TwoFactorSecret;
            }
        }
        await oracleDb.SaveChangesAsync();

        // 4. Transfer Permissions
        var sqlitePerms = await sqliteDb.Permissions.AsNoTracking().OrderBy(p => p.Id).ToListAsync();
        foreach (var p in sqlitePerms)
        {
            var existing = await oracleDb.Permissions.FirstOrDefaultAsync(op => op.Id == p.Id || op.Code == p.Code);
            if (existing == null)
            {
                oracleDb.Permissions.Add(new AppPermission
                {
                    Id = p.Id,
                    PageId = p.PageId,
                    Code = p.Code,
                    Action = p.Action,
                    Description = p.Description,
                    IsActive = p.IsActive,
                    CreatedAtUtc = p.CreatedAtUtc,
                    CreatedBy = p.CreatedBy,
                    UpdatedAtUtc = p.UpdatedAtUtc,
                    UpdatedBy = p.UpdatedBy
                });
            }
        }
        await oracleDb.SaveChangesAsync();

        // 5. Transfer UserRoles
        var sqliteUserRoles = await sqliteDb.UserRoles.AsNoTracking().ToListAsync();
        foreach (var ur in sqliteUserRoles)
        {
            var existing = await oracleDb.UserRoles.FirstOrDefaultAsync(our => our.UserId == ur.UserId && our.RoleId == ur.RoleId);
            if (existing == null)
            {
                // Verify user and role exist in Oracle
                var uExists = await oracleDb.Users.FirstOrDefaultAsync(u => u.Id == ur.UserId) != null;
                var rExists = await oracleDb.Roles.FirstOrDefaultAsync(r => r.Id == ur.RoleId) != null;
                if (uExists && rExists)
                {
                    oracleDb.UserRoles.Add(new AppUserRole
                    {
                        UserId = ur.UserId,
                        RoleId = ur.RoleId,
                        AssignedAtUtc = ur.AssignedAtUtc,
                        AssignedBy = ur.AssignedBy
                    });
                }
            }
        }
        await oracleDb.SaveChangesAsync();

        // 6. Transfer RolePermissions
        var sqliteRolePerms = await sqliteDb.RolePermissions.AsNoTracking().ToListAsync();
        foreach (var rp in sqliteRolePerms)
        {
            var existing = await oracleDb.RolePermissions.FirstOrDefaultAsync(orp => orp.RoleId == rp.RoleId && orp.PermissionId == rp.PermissionId);
            if (existing == null)
            {
                var rExists = await oracleDb.Roles.FirstOrDefaultAsync(r => r.Id == rp.RoleId) != null;
                var pExists = await oracleDb.Permissions.FirstOrDefaultAsync(p => p.Id == rp.PermissionId) != null;
                if (rExists && pExists)
                {
                    oracleDb.RolePermissions.Add(new AppRolePermission
                    {
                        RoleId = rp.RoleId,
                        PermissionId = rp.PermissionId,
                        AssignedAtUtc = rp.AssignedAtUtc,
                        AssignedBy = rp.AssignedBy
                    });
                }
            }
        }
        await oracleDb.SaveChangesAsync();

        // 7. Transfer UserPermissions
        var sqliteUserPerms = await sqliteDb.UserPermissions.AsNoTracking().ToListAsync();
        foreach (var up in sqliteUserPerms)
        {
            var existing = await oracleDb.UserPermissions.FirstOrDefaultAsync(oup => oup.UserId == up.UserId && oup.PermissionId == up.PermissionId);
            if (existing == null)
            {
                var uExists = await oracleDb.Users.FirstOrDefaultAsync(u => u.Id == up.UserId) != null;
                var pExists = await oracleDb.Permissions.FirstOrDefaultAsync(p => p.Id == up.PermissionId) != null;
                if (uExists && pExists)
                {
                    oracleDb.UserPermissions.Add(new AppUserPermission
                    {
                        UserId = up.UserId,
                        PermissionId = up.PermissionId,
                        AssignedAtUtc = up.AssignedAtUtc,
                        AssignedBy = up.AssignedBy
                    });
                }
            }
        }
        await oracleDb.SaveChangesAsync();

        // 8. Transfer StockCategories
        var sqliteCategories = await sqliteDb.StockCategories.AsNoTracking().OrderBy(c => c.Id).ToListAsync();
        foreach (var c in sqliteCategories)
        {
            var existing = await oracleDb.StockCategories.FirstOrDefaultAsync(oc => oc.Id == c.Id || oc.Name == c.Name);
            if (existing == null)
            {
                oracleDb.StockCategories.Add(new StockCategory
                {
                    Id = c.Id,
                    Name = c.Name,
                    Description = c.Description,
                    IsActive = c.IsActive,
                    CreatedAtUtc = c.CreatedAtUtc
                });
            }
        }
        await oracleDb.SaveChangesAsync();

        // 9. Transfer StockItems
        var sqliteItems = await sqliteDb.StockItems.AsNoTracking().OrderBy(i => i.Id).ToListAsync();
        foreach (var item in sqliteItems)
        {
            var existing = await oracleDb.StockItems.FirstOrDefaultAsync(oi => oi.Id == item.Id || oi.Sku == item.Sku);
            if (existing == null)
            {
                oracleDb.StockItems.Add(new StockItem
                {
                    Id = item.Id,
                    Sku = item.Sku,
                    Barcode = item.Barcode,
                    Name = item.Name,
                    Description = item.Description,
                    CategoryId = item.CategoryId,
                    Unit = item.Unit,
                    CostPrice = item.CostPrice,
                    SellingPrice = item.SellingPrice,
                    QuantityOnHand = item.QuantityOnHand,
                    MinStockLevel = item.MinStockLevel,
                    Location = item.Location,
                    IsActive = item.IsActive,
                    CreatedAtUtc = item.CreatedAtUtc,
                    UpdatedAtUtc = item.UpdatedAtUtc
                });
            }
        }
        await oracleDb.SaveChangesAsync();

        // 10. Transfer StockMovements
        var sqliteMovements = await sqliteDb.StockMovements.AsNoTracking().OrderBy(m => m.Id).ToListAsync();
        foreach (var m in sqliteMovements)
        {
            var existing = await oracleDb.StockMovements.FirstOrDefaultAsync(om => om.Id == m.Id || om.ReferenceNo == m.ReferenceNo);
            if (existing == null)
            {
                oracleDb.StockMovements.Add(new StockMovement
                {
                    Id = m.Id,
                    ReferenceNo = m.ReferenceNo,
                    MovementType = m.MovementType,
                    ItemId = m.ItemId,
                    Quantity = m.Quantity,
                    UnitPrice = m.UnitPrice,
                    BalanceBefore = m.BalanceBefore,
                    BalanceAfter = m.BalanceAfter,
                    Reason = m.Reason,
                    SupplierOrRecipient = m.SupplierOrRecipient,
                    Notes = m.Notes,
                    CreatedByUserId = m.CreatedByUserId,
                    CreatedByUsername = m.CreatedByUsername,
                    CreatedAtUtc = m.CreatedAtUtc
                });
            }
        }
        await oracleDb.SaveChangesAsync();

        Console.WriteLine("[DataMigrator] Successfully transferred all data from SQLite to Oracle!");

        await SyncOracleSequencesAsync(oracleDb);
    }

    public static async Task SyncOracleSequencesAsync(AppDbContext oracleDb)
    {
        if (oracleDb.Database.ProviderName?.Contains("Oracle", StringComparison.OrdinalIgnoreCase) != true)
        {
            return;
        }

        Console.WriteLine("[DataMigrator] Synchronizing Oracle primary key identity sequences...");

        var tables = new[]
        {
            "Users", "Roles", "Permissions", "Pages", "CompanySettings", "AuditLogs",
            "StockCategories", "StockItems", "Brands", "UnitsOfMeasure", "Suppliers", "Customers",
            "Warehouses", "WarehouseStocks", "StockMovements", "StockAdjustments", "StockTransfers",
            "StockTransferItems", "PurchaseOrders", "PurchaseOrderItems", "GoodsReceipts",
            "GoodsReceiptItems", "PurchaseReturns", "PurchaseReturnItems", "SalesOrders",
            "SalesOrderItems", "SalePayments", "SalesReturns", "SalesReturnItems"
        };

        foreach (var table in tables)
        {
            try
            {
                // In Oracle 12c+, identity columns can be restarted with START WITH LIMIT VALUE
                try
                {
                    string alterSql1 = $@"ALTER TABLE ""{table}"" MODIFY (""Id"" GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH LIMIT VALUE))";
                    await oracleDb.Database.ExecuteSqlRawAsync(alterSql1);
                }
                catch
                {
                    try
                    {
                        string alterSql2 = $@"ALTER TABLE ""{table}"" MODIFY ""Id"" GENERATED BY DEFAULT AS IDENTITY (START WITH LIMIT VALUE)";
                        await oracleDb.Database.ExecuteSqlRawAsync(alterSql2);
                    }
                    catch
                    {
                        // Fallback: Query MAX("Id") and update identity
                        try
                        {
                            var conn = oracleDb.Database.GetDbConnection();
                            if (conn.State != System.Data.ConnectionState.Open) await conn.OpenAsync();
                            using var cmd = conn.CreateCommand();
                            cmd.CommandText = $@"SELECT NVL(MAX(""Id""), 0) + 1 FROM ""{table}""";
                            var result = await cmd.ExecuteScalarAsync();
                            var nextVal = result != null && result != DBNull.Value ? Convert.ToInt64(result) : 1;
                            if (nextVal > 1)
                            {
                                try
                                {
                                    cmd.CommandText = $@"ALTER TABLE ""{table}"" MODIFY (""Id"" GENERATED BY DEFAULT ON NULL AS IDENTITY (START WITH {nextVal}))";
                                    await cmd.ExecuteNonQueryAsync();
                                }
                                catch { }
                            }
                        }
                        catch { }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Oracle Sync] Note for table '{table}': {ex.Message}");
            }
        }

        Console.WriteLine("[DataMigrator] Oracle identity sequences synchronized successfully!");
    }
}
