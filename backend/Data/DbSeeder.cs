using backend.Models.Data;
using backend.Modules.Audit.Models;
using backend.Modules.Catalog.Models;
using backend.Modules.Customers.Models;
using backend.Modules.Inventory.Models;
using backend.Modules.Purchasing.Models;
using backend.Modules.Sales.Models;
using backend.Modules.Suppliers.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        if (context.Database.ProviderName?.Contains("Oracle", StringComparison.OrdinalIgnoreCase) == true)
        {
            try
            {
                await context.Database.EnsureCreatedAsync();
            }
            catch (Exception ex) when (ex.Message.Contains("ORA-00955") || ex.Message.Contains("already used") || ex.Message.Contains("already exists"))
            {
                // Tables already exist in Oracle Database - Do NOT drop tables! Retain all existing user & business data.
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Oracle Database Notice] {ex.Message}");
            }
        }
        else
        {
            await context.Database.EnsureCreatedAsync();
        }

        // Ensure tables and columns exist in SQLite DB if upgraded from older schema
        if (context.Database.ProviderName?.Contains("Sqlite", StringComparison.OrdinalIgnoreCase) == true)
        {
            try { await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""Users"" ADD COLUMN ""InvitationToken"" TEXT NULL;"); } catch { }
            try { await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""Users"" ADD COLUMN ""InvitationExpiresAtUtc"" TEXT NULL;"); } catch { }
            try { await context.Database.ExecuteSqlRawAsync(@"ALTER TABLE ""Users"" ADD COLUMN ""MustSetPassword"" INTEGER NOT NULL DEFAULT 0;"); } catch { }

            await context.Database.ExecuteSqlRawAsync(@"
                CREATE TABLE IF NOT EXISTS ""UserPermissions"" (
                    ""UserId"" INTEGER NOT NULL,
                    ""PermissionId"" INTEGER NOT NULL,
                    ""AssignedAtUtc"" TEXT NOT NULL,
                    ""AssignedBy"" INTEGER NULL,
                    PRIMARY KEY (""UserId"", ""PermissionId""),
                    CONSTRAINT ""FK_UserPermissions_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_UserPermissions_Permissions_PermissionId"" FOREIGN KEY (""PermissionId"") REFERENCES ""Permissions"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""UserWarehouses"" (
                    ""UserId"" INTEGER NOT NULL,
                    ""WarehouseId"" INTEGER NOT NULL,
                    ""IsDefault"" INTEGER NOT NULL DEFAULT 0,
                    ""AssignedAtUtc"" TEXT NOT NULL,
                    ""AssignedBy"" INTEGER NULL,
                    PRIMARY KEY (""UserId"", ""WarehouseId""),
                    CONSTRAINT ""FK_UserWarehouses_Users_UserId"" FOREIGN KEY (""UserId"") REFERENCES ""Users"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_UserWarehouses_Warehouses_WarehouseId"" FOREIGN KEY (""WarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""CompanySettings"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""CompanyName"" TEXT NOT NULL,
                    ""AppName"" TEXT NOT NULL,
                    ""TaxId"" TEXT NULL,
                    ""CompanyPhone"" TEXT NULL,
                    ""CompanyEmail"" TEXT NULL,
                    ""CompanyAddress"" TEXT NULL,
                    ""DefaultWarehouseId"" INTEGER NULL,
                    ""DefaultWarehouseLocation"" TEXT NULL,
                    ""CurrencyCode"" TEXT NOT NULL DEFAULT 'USD',
                    ""CurrencySymbol"" TEXT NOT NULL DEFAULT '$',
                    ""VatRatePercentage"" TEXT NOT NULL DEFAULT '10',
                    ""Timezone"" TEXT NOT NULL DEFAULT 'Asia/Phnom_Penh',
                    ""DefaultLanguage"" TEXT NOT NULL DEFAULT 'km',
                    ""AllowMultiWarehouse"" INTEGER NOT NULL DEFAULT 1,
                    ""EnforceTwoFactor"" INTEGER NOT NULL DEFAULT 1,
                    ""RequireStrongPassword"" INTEGER NOT NULL DEFAULT 1,
                    ""SessionTimeoutMinutes"" INTEGER NOT NULL DEFAULT 60,
                    ""MaxFailedAttempts"" INTEGER NOT NULL DEFAULT 5,
                    ""LockoutDurationMinutes"" INTEGER NOT NULL DEFAULT 15,
                    ""MockModeEnabled"" INTEGER NOT NULL DEFAULT 0,
                    ""UpdatedAtUtc"" TEXT NOT NULL,
                    CONSTRAINT ""FK_CompanySettings_Warehouses_DefaultWarehouseId"" FOREIGN KEY (""DefaultWarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""StockCategories"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""Name"" TEXT NOT NULL,
                    ""Description"" TEXT NULL,
                    ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                    ""CreatedAtUtc"" TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ""StockItems"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""Sku"" TEXT NOT NULL,
                    ""Barcode"" TEXT NULL,
                    ""Name"" TEXT NOT NULL,
                    ""Description"" TEXT NULL,
                    ""CategoryId"" INTEGER NULL,
                    ""Unit"" TEXT NOT NULL DEFAULT 'PCS',
                    ""CostPrice"" TEXT NOT NULL DEFAULT '0',
                    ""SellingPrice"" TEXT NOT NULL DEFAULT '0',
                    ""QuantityOnHand"" INTEGER NOT NULL DEFAULT 0,
                    ""MinStockLevel"" INTEGER NOT NULL DEFAULT 10,
                    ""MaxStockLevel"" INTEGER NOT NULL DEFAULT 100,
                    ""Brand"" TEXT NULL,
                    ""Location"" TEXT NULL,
                    ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    ""UpdatedAtUtc"" TEXT NULL,
                    CONSTRAINT ""FK_StockItems_StockCategories_CategoryId"" FOREIGN KEY (""CategoryId"") REFERENCES ""StockCategories"" (""Id"") ON DELETE SET NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_StockItems_Sku"" ON ""StockItems"" (""Sku"");

                CREATE TABLE IF NOT EXISTS ""StockMovements"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""ReferenceNo"" TEXT NOT NULL,
                    ""MovementType"" TEXT NOT NULL,
                    ""ReferenceType"" TEXT NULL,
                    ""WarehouseId"" INTEGER NULL,
                    ""ItemId"" INTEGER NOT NULL,
                    ""Quantity"" INTEGER NOT NULL,
                    ""UnitPrice"" TEXT NOT NULL DEFAULT '0',
                    ""BalanceBefore"" INTEGER NOT NULL,
                    ""BalanceAfter"" INTEGER NOT NULL,
                    ""Reason"" TEXT NULL,
                    ""SupplierOrRecipient"" TEXT NULL,
                    ""Notes"" TEXT NULL,
                    ""CreatedByUserId"" INTEGER NULL,
                    ""CreatedByUsername"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    CONSTRAINT ""FK_StockMovements_StockItems_ItemId"" FOREIGN KEY (""ItemId"") REFERENCES ""StockItems"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""AuditLogs"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""UserId"" INTEGER NULL,
                    ""Username"" TEXT NULL,
                    ""Action"" TEXT NOT NULL,
                    ""EntityName"" TEXT NOT NULL,
                    ""EntityId"" TEXT NULL,
                    ""Description"" TEXT NOT NULL,
                    ""DetailsJson"" TEXT NULL,
                    ""IpAddress"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ""Brands"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""Name"" TEXT NOT NULL,
                    ""Description"" TEXT NULL,
                    ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                    ""CreatedAtUtc"" TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS ""UnitsOfMeasure"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""Code"" TEXT NOT NULL,
                    ""Name"" TEXT NOT NULL,
                    ""IsActive"" INTEGER NOT NULL DEFAULT 1
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_UnitsOfMeasure_Code"" ON ""UnitsOfMeasure"" (""Code"");

                CREATE TABLE IF NOT EXISTS ""Suppliers"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""SupplierCode"" TEXT NOT NULL,
                    ""Name"" TEXT NOT NULL,
                    ""ContactPerson"" TEXT NULL,
                    ""Phone"" TEXT NULL,
                    ""Email"" TEXT NULL,
                    ""Address"" TEXT NULL,
                    ""PaymentTerms"" TEXT NOT NULL DEFAULT 'Net 30',
                    ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    ""UpdatedAtUtc"" TEXT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Suppliers_SupplierCode"" ON ""Suppliers"" (""SupplierCode"");

                CREATE TABLE IF NOT EXISTS ""Customers"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""CustomerCode"" TEXT NOT NULL,
                    ""Name"" TEXT NOT NULL,
                    ""ContactPerson"" TEXT NULL,
                    ""Phone"" TEXT NULL,
                    ""Email"" TEXT NULL,
                    ""Address"" TEXT NULL,
                    ""CustomerType"" TEXT NOT NULL DEFAULT 'Registered',
                    ""CreditLimit"" TEXT NOT NULL DEFAULT '0',
                    ""PaymentTerms"" TEXT NOT NULL DEFAULT 'Cash',
                    ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    ""UpdatedAtUtc"" TEXT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Customers_CustomerCode"" ON ""Customers"" (""CustomerCode"");

                CREATE TABLE IF NOT EXISTS ""Warehouses"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""Code"" TEXT NOT NULL,
                    ""Name"" TEXT NOT NULL,
                    ""Location"" TEXT NULL,
                    ""ContactPhone"" TEXT NULL,
                    ""IsActive"" INTEGER NOT NULL DEFAULT 1,
                    ""CreatedAtUtc"" TEXT NOT NULL
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_Warehouses_Code"" ON ""Warehouses"" (""Code"");

                CREATE TABLE IF NOT EXISTS ""WarehouseStocks"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""WarehouseId"" INTEGER NOT NULL,
                    ""ProductId"" INTEGER NOT NULL,
                    ""QuantityOnHand"" INTEGER NOT NULL DEFAULT 0,
                    ""ReservedQuantity"" INTEGER NOT NULL DEFAULT 0,
                    ""UpdatedAtUtc"" TEXT NOT NULL,
                    CONSTRAINT ""FK_WarehouseStocks_Warehouses_WarehouseId"" FOREIGN KEY (""WarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_WarehouseStocks_StockItems_ProductId"" FOREIGN KEY (""ProductId"" ) REFERENCES ""StockItems"" (""Id"") ON DELETE CASCADE
                );
                CREATE UNIQUE INDEX IF NOT EXISTS ""IX_WarehouseStocks_WarehouseId_ProductId"" ON ""WarehouseStocks"" (""WarehouseId"", ""ProductId"");

                CREATE TABLE IF NOT EXISTS ""StockAdjustments"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""AdjustmentNo"" TEXT NOT NULL,
                    ""WarehouseId"" INTEGER NOT NULL,
                    ""ProductId"" INTEGER NOT NULL,
                    ""AdjustmentType"" TEXT NOT NULL,
                    ""QuantityBefore"" INTEGER NOT NULL,
                    ""QuantityAdjusted"" INTEGER NOT NULL,
                    ""QuantityAfter"" INTEGER NOT NULL,
                    ""UnitCost"" TEXT NOT NULL DEFAULT '0',
                    ""Reason"" TEXT NOT NULL,
                    ""Notes"" TEXT NULL,
                    ""CreatedByUserId"" INTEGER NULL,
                    ""CreatedByUsername"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    CONSTRAINT ""FK_StockAdjustments_Warehouses_WarehouseId"" FOREIGN KEY (""WarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_StockAdjustments_StockItems_ProductId"" FOREIGN KEY (""ProductId"") REFERENCES ""StockItems"" (""Id"") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS ""StockTransfers"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""TransferNo"" TEXT NOT NULL,
                    ""FromWarehouseId"" INTEGER NOT NULL,
                    ""ToWarehouseId"" INTEGER NOT NULL,
                    ""Status"" TEXT NOT NULL DEFAULT 'PENDING',
                    ""Notes"" TEXT NULL,
                    ""CreatedByUserId"" INTEGER NULL,
                    ""CreatedByUsername"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    ""CompletedAtUtc"" TEXT NULL,
                    CONSTRAINT ""FK_StockTransfers_Warehouses_FromWarehouseId"" FOREIGN KEY (""FromWarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_StockTransfers_Warehouses_ToWarehouseId"" FOREIGN KEY (""ToWarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS ""StockTransferItems"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""StockTransferId"" INTEGER NOT NULL,
                    ""ProductId"" INTEGER NOT NULL,
                    ""Quantity"" INTEGER NOT NULL,
                    CONSTRAINT ""FK_StockTransferItems_StockTransfers_StockTransferId"" FOREIGN KEY (""StockTransferId"") REFERENCES ""StockTransfers"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_StockTransferItems_StockItems_ProductId"" FOREIGN KEY (""ProductId"") REFERENCES ""StockItems"" (""Id"") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS ""PurchaseOrders"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""PoNumber"" TEXT NOT NULL,
                    ""SupplierId"" INTEGER NOT NULL,
                    ""WarehouseId"" INTEGER NULL,
                    ""OrderDateUtc"" TEXT NOT NULL,
                    ""ExpectedDateUtc"" TEXT NULL,
                    ""PaymentTerms"" TEXT NOT NULL DEFAULT 'Net 30',
                    ""Status"" TEXT NOT NULL DEFAULT 'DRAFT',
                    ""Subtotal"" TEXT NOT NULL DEFAULT '0',
                    ""Tax"" TEXT NOT NULL DEFAULT '0',
                    ""Discount"" TEXT NOT NULL DEFAULT '0',
                    ""TotalAmount"" TEXT NOT NULL DEFAULT '0',
                    ""Notes"" TEXT NULL,
                    ""CreatedByUserId"" INTEGER NULL,
                    ""CreatedByUsername"" TEXT NULL,
                    ""ApprovedByUserId"" INTEGER NULL,
                    ""ApprovedByUsername"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    ""UpdatedAtUtc"" TEXT NULL,
                    CONSTRAINT ""FK_PurchaseOrders_Suppliers_SupplierId"" FOREIGN KEY (""SupplierId"") REFERENCES ""Suppliers"" (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_PurchaseOrders_Warehouses_WarehouseId"" FOREIGN KEY (""WarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""PurchaseOrderItems"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""PurchaseOrderId"" INTEGER NOT NULL,
                    ""ProductId"" INTEGER NOT NULL,
                    ""Quantity"" INTEGER NOT NULL,
                    ""UnitCost"" TEXT NOT NULL DEFAULT '0',
                    ""Discount"" TEXT NOT NULL DEFAULT '0',
                    ""Tax"" TEXT NOT NULL DEFAULT '0',
                    ""Subtotal"" TEXT NOT NULL DEFAULT '0',
                    ""ReceivedQuantity"" INTEGER NOT NULL DEFAULT 0,
                    CONSTRAINT ""FK_PurchaseOrderItems_PurchaseOrders_PurchaseOrderId"" FOREIGN KEY (""PurchaseOrderId"") REFERENCES ""PurchaseOrders"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_PurchaseOrderItems_StockItems_ProductId"" FOREIGN KEY (""ProductId"") REFERENCES ""StockItems"" (""Id"") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS ""GoodsReceipts"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""GrnNumber"" TEXT NOT NULL,
                    ""PurchaseOrderId"" INTEGER NOT NULL,
                    ""WarehouseId"" INTEGER NULL,
                    ""ReceivedDateUtc"" TEXT NOT NULL,
                    ""ReceivedByUserId"" INTEGER NULL,
                    ""ReceivedByUsername"" TEXT NULL,
                    ""Notes"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    CONSTRAINT ""FK_GoodsReceipts_PurchaseOrders_PurchaseOrderId"" FOREIGN KEY (""PurchaseOrderId"") REFERENCES ""PurchaseOrders"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_GoodsReceipts_Warehouses_WarehouseId"" FOREIGN KEY (""WarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""GoodsReceiptItems"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""GoodsReceiptId"" INTEGER NOT NULL,
                    ""ProductId"" INTEGER NOT NULL,
                    ""OrderedQuantity"" INTEGER NOT NULL,
                    ""ReceivedQuantity"" INTEGER NOT NULL,
                    ""DamagedQuantity"" INTEGER NOT NULL DEFAULT 0,
                    ""AcceptedQuantity"" INTEGER NOT NULL DEFAULT 0,
                    ""RejectedQuantity"" INTEGER NOT NULL DEFAULT 0,
                    ""UnitCost"" TEXT NOT NULL DEFAULT '0',
                    ""Remarks"" TEXT NULL,
                    CONSTRAINT ""FK_GoodsReceiptItems_GoodsReceipts_GoodsReceiptId"" FOREIGN KEY (""GoodsReceiptId"") REFERENCES ""GoodsReceipts"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_GoodsReceiptItems_StockItems_ProductId"" FOREIGN KEY (""ProductId"") REFERENCES ""StockItems"" (""Id"") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS ""PurchaseReturns"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""ReturnNumber"" TEXT NOT NULL,
                    ""SupplierId"" INTEGER NOT NULL,
                    ""PurchaseOrderId"" INTEGER NULL,
                    ""WarehouseId"" INTEGER NULL,
                    ""ReturnDateUtc"" TEXT NOT NULL,
                    ""Status"" TEXT NOT NULL DEFAULT 'COMPLETED',
                    ""TotalRefundAmount"" TEXT NOT NULL DEFAULT '0',
                    ""Reason"" TEXT NULL,
                    ""Notes"" TEXT NULL,
                    ""CreatedByUserId"" INTEGER NULL,
                    ""CreatedByUsername"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    CONSTRAINT ""FK_PurchaseReturns_Suppliers_SupplierId"" FOREIGN KEY (""SupplierId"") REFERENCES ""Suppliers"" (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_PurchaseReturns_PurchaseOrders_PurchaseOrderId"" FOREIGN KEY (""PurchaseOrderId"") REFERENCES ""PurchaseOrders"" (""Id"") ON DELETE SET NULL,
                    CONSTRAINT ""FK_PurchaseReturns_Warehouses_WarehouseId"" FOREIGN KEY (""WarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""PurchaseReturnItems"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""PurchaseReturnId"" INTEGER NOT NULL,
                    ""ProductId"" INTEGER NOT NULL,
                    ""Quantity"" INTEGER NOT NULL,
                    ""UnitCost"" TEXT NOT NULL DEFAULT '0',
                    ""Subtotal"" TEXT NOT NULL DEFAULT '0',
                    ""DefectReason"" TEXT NULL,
                    CONSTRAINT ""FK_PurchaseReturnItems_PurchaseReturns_PurchaseReturnId"" FOREIGN KEY (""PurchaseReturnId"") REFERENCES ""PurchaseReturns"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_PurchaseReturnItems_StockItems_ProductId"" FOREIGN KEY (""ProductId"") REFERENCES ""StockItems"" (""Id"") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS ""SalesOrders"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""InvoiceNumber"" TEXT NOT NULL,
                    ""CustomerId"" INTEGER NOT NULL,
                    ""WarehouseId"" INTEGER NULL,
                    ""SaleDateUtc"" TEXT NOT NULL,
                    ""Status"" TEXT NOT NULL DEFAULT 'CONFIRMED',
                    ""PaymentStatus"" TEXT NOT NULL DEFAULT 'UNPAID',
                    ""Subtotal"" TEXT NOT NULL DEFAULT '0',
                    ""Tax"" TEXT NOT NULL DEFAULT '0',
                    ""Discount"" TEXT NOT NULL DEFAULT '0',
                    ""TotalAmount"" TEXT NOT NULL DEFAULT '0',
                    ""PaidAmount"" TEXT NOT NULL DEFAULT '0',
                    ""RemainingAmount"" TEXT NOT NULL DEFAULT '0',
                    ""Notes"" TEXT NULL,
                    ""CreatedByUserId"" INTEGER NULL,
                    ""CreatedByUsername"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    ""UpdatedAtUtc"" TEXT NULL,
                    CONSTRAINT ""FK_SalesOrders_Customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES ""Customers"" (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_SalesOrders_Warehouses_WarehouseId"" FOREIGN KEY (""WarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""SalesOrderItems"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""SalesOrderId"" INTEGER NOT NULL,
                    ""ProductId"" INTEGER NOT NULL,
                    ""Quantity"" INTEGER NOT NULL,
                    ""UnitPrice"" TEXT NOT NULL DEFAULT '0',
                    ""Discount"" TEXT NOT NULL DEFAULT '0',
                    ""Tax"" TEXT NOT NULL DEFAULT '0',
                    ""Subtotal"" TEXT NOT NULL DEFAULT '0',
                    CONSTRAINT ""FK_SalesOrderItems_SalesOrders_SalesOrderId"" FOREIGN KEY (""SalesOrderId"") REFERENCES ""SalesOrders"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_SalesOrderItems_StockItems_ProductId"" FOREIGN KEY (""ProductId"") REFERENCES ""StockItems"" (""Id"") ON DELETE RESTRICT
                );

                CREATE TABLE IF NOT EXISTS ""SalePayments"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""PaymentNumber"" TEXT NOT NULL,
                    ""SalesOrderId"" INTEGER NOT NULL,
                    ""PaymentMethod"" TEXT NOT NULL DEFAULT 'CASH',
                    ""Amount"" TEXT NOT NULL DEFAULT '0',
                    ""PaymentDateUtc"" TEXT NOT NULL,
                    ""ReferenceNo"" TEXT NULL,
                    ""Notes"" TEXT NULL,
                    ""ReceivedByUserId"" INTEGER NULL,
                    ""ReceivedByUsername"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    CONSTRAINT ""FK_SalePayments_SalesOrders_SalesOrderId"" FOREIGN KEY (""SalesOrderId"") REFERENCES ""SalesOrders"" (""Id"") ON DELETE CASCADE
                );

                CREATE TABLE IF NOT EXISTS ""SalesReturns"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""ReturnNumber"" TEXT NOT NULL,
                    ""SalesOrderId"" INTEGER NOT NULL,
                    ""CustomerId"" INTEGER NOT NULL,
                    ""WarehouseId"" INTEGER NULL,
                    ""ReturnDateUtc"" TEXT NOT NULL,
                    ""Status"" TEXT NOT NULL DEFAULT 'COMPLETED',
                    ""RefundAmount"" TEXT NOT NULL DEFAULT '0',
                    ""Reason"" TEXT NULL,
                    ""Notes"" TEXT NULL,
                    ""CreatedByUserId"" INTEGER NULL,
                    ""CreatedByUsername"" TEXT NULL,
                    ""CreatedAtUtc"" TEXT NOT NULL,
                    CONSTRAINT ""FK_SalesReturns_SalesOrders_SalesOrderId"" FOREIGN KEY (""SalesOrderId"") REFERENCES ""SalesOrders"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_SalesReturns_Customers_CustomerId"" FOREIGN KEY (""CustomerId"") REFERENCES ""Customers"" (""Id"") ON DELETE RESTRICT,
                    CONSTRAINT ""FK_SalesReturns_Warehouses_WarehouseId"" FOREIGN KEY (""WarehouseId"") REFERENCES ""Warehouses"" (""Id"") ON DELETE SET NULL
                );

                CREATE TABLE IF NOT EXISTS ""SalesReturnItems"" (
                    ""Id"" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    ""SalesReturnId"" INTEGER NOT NULL,
                    ""ProductId"" INTEGER NOT NULL,
                    ""Quantity"" INTEGER NOT NULL,
                    ""UnitPrice"" TEXT NOT NULL DEFAULT '0',
                    ""Subtotal"" TEXT NOT NULL DEFAULT '0',
                    ""Condition"" TEXT NULL,
                    ""Reason"" TEXT NULL,
                    CONSTRAINT ""FK_SalesReturnItems_SalesReturns_SalesReturnId"" FOREIGN KEY (""SalesReturnId"") REFERENCES ""SalesReturns"" (""Id"") ON DELETE CASCADE,
                    CONSTRAINT ""FK_SalesReturnItems_StockItems_ProductId"" FOREIGN KEY (""ProductId"") REFERENCES ""StockItems"" (""Id"") ON DELETE RESTRICT
                );
            ");

            // Safe ALTER columns for SQLite upgrades
            try { await context.Database.ExecuteSqlRawAsync("ALTER TABLE \"StockItems\" ADD COLUMN \"Brand\" TEXT NULL;"); } catch { }
            try { await context.Database.ExecuteSqlRawAsync("ALTER TABLE \"StockItems\" ADD COLUMN \"MaxStockLevel\" INTEGER NOT NULL DEFAULT 100;"); } catch { }
            try { await context.Database.ExecuteSqlRawAsync("ALTER TABLE \"StockMovements\" ADD COLUMN \"ReferenceType\" TEXT NULL;"); } catch { }
            try { await context.Database.ExecuteSqlRawAsync("ALTER TABLE \"StockMovements\" ADD COLUMN \"WarehouseId\" INTEGER NULL;"); } catch { }
        }

        var passwordHasher = new PasswordHasher<AppUser>();

        // 1. Seed Roles if missing
        var adminRole = await EnsureRoleAsync(context, "ADMIN", "Administrator", "Full system access");
        var managerRole = await EnsureRoleAsync(context, "MANAGER", "Manager", "Managerial & approval access");
        var purchasingRole = await EnsureRoleAsync(context, "PURCHASING", "Purchasing Officer", "PO, GRN, and Supplier management");
        var warehouseRole = await EnsureRoleAsync(context, "WAREHOUSE", "Warehouse Supervisor", "Inventory, transfers, and receiving");
        var salesRole = await EnsureRoleAsync(context, "SALES", "Sales Representative", "Sales orders, customers, and payments");
        var staffRole = await EnsureRoleAsync(context, "STAFF", "General Staff", "Standard operational access");

        // 2. Seed Admin User if missing
        var adminUser = await context.Users.FirstOrDefaultAsync(u => u.Username == "admin");
        if (adminUser == null)
        {
            adminUser = new AppUser
            {
                Username = "admin",
                Email = "admin@example.com",
                PasswordHash = "",
                IsActive = true,
                TwoFactorEnabled = false,
                TwoFactorSecret = null,
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            adminUser.PasswordHash = passwordHasher.HashPassword(adminUser, "Password123!");
            context.Users.Add(adminUser);
            await context.SaveChangesAsync();

            context.UserRoles.Add(new AppUserRole
            {
                UserId = adminUser.Id,
                RoleId = adminRole.Id,
                AssignedAtUtc = DateTimeOffset.UtcNow,
                AssignedBy = adminUser.Id
            });
            await context.SaveChangesAsync();
        }

        // 2b. Seed Demo 2FA Admin User if missing
        var admin2faUser = await context.Users.FirstOrDefaultAsync(u => u.Username == "admin_2fa");
        if (admin2faUser == null)
        {
            admin2faUser = new AppUser
            {
                Username = "admin_2fa",
                Email = "admin_2fa@example.com",
                PasswordHash = "",
                IsActive = true,
                TwoFactorEnabled = true,
                TwoFactorSecret = "JBSWY3DPEHPK3PXP",
                CreatedAtUtc = DateTimeOffset.UtcNow
            };
            admin2faUser.PasswordHash = passwordHasher.HashPassword(admin2faUser, "Password123!");
            context.Users.Add(admin2faUser);
            await context.SaveChangesAsync();

            context.UserRoles.Add(new AppUserRole
            {
                UserId = admin2faUser.Id,
                RoleId = adminRole.Id,
                AssignedAtUtc = DateTimeOffset.UtcNow,
                AssignedBy = admin2faUser.Id
            });
            await context.SaveChangesAsync();
        }

        // 3. Seed Pages if missing
        var pageDefinitions = new List<(string Code, string Name, string Route, string Icon, int SortOrder, string? ParentCode)>
        {
            ("dashboard", "Dashboard", "/dashboard", "layout-dashboard", 1, null),
            ("stock", "Stock Management", "/stock/items", "package", 2, null),
            ("stock-items", "Items Catalogue", "/stock/items", "package", 1, "stock"),
            ("stock-in", "Stock In", "/stock/in", "arrow-down-left", 2, "stock"),
            ("stock-out", "Stock Out", "/stock/out", "arrow-up-right", 3, "stock"),
            ("stock-adjustments", "Adjustments", "/stock/adjustments", "scale", 4, "stock"),
            ("stock-movements", "Movements Ledger", "/stock/movements", "history", 5, "stock"),
            ("stock-alerts", "Low Stock Alerts", "/stock/alerts", "alert-triangle", 6, "stock"),

            // Modular additions: Purchasing, Sales, Inventory, Suppliers, Customers, Reports, Audit
            ("purchases", "Purchasing", "/purchases/orders", "shopping-bag", 3, null),
            ("purchase-orders", "Purchase Orders", "/purchases/orders", "file-text", 1, "purchases"),
            ("goods-receipts", "Goods Receipts (GRN)", "/purchases/grn", "truck", 2, "purchases"),
            ("purchase-returns", "Purchase Returns", "/purchases/returns", "rotate-ccw", 3, "purchases"),

            ("sales", "Sales & Billing", "/sales/orders", "shopping-cart", 4, null),
            ("sales-orders", "Sales Orders", "/sales/orders", "receipt", 1, "sales"),
            ("sales-returns", "Sales Returns", "/sales/returns", "rotate-ccw", 2, "sales"),

            ("warehouses", "Warehouses & Transfers", "/warehouses", "archive", 5, null),
            ("warehouses-list", "Warehouses", "/warehouses", "home", 1, "warehouses"),
            ("transfers", "Stock Transfers", "/transfers", "repeat", 2, "warehouses"),

            ("suppliers", "Suppliers", "/suppliers", "truck", 6, null),
            ("customers", "Customers", "/customers", "user-check", 7, null),
            ("reports", "Analytics & Reports", "/reports", "bar-chart-2", 8, null),
            ("audit", "Audit Logs", "/audit/logs", "activity", 9, null),

            ("settings", "Settings", "/settings", "settings", 10, null),
            ("users", "Users & Permissions", "/users", "users", 1, "settings"),
            ("units", "Units of Measure", "/units", "box", 2, "settings"),
            ("roles", "System Roles", "/roles", "shield", 3, "settings"),
            ("permissions", "System Permissions", "/permissions", "key", 4, "settings")
        };

        var pageMap = new Dictionary<string, AppPage>();
        foreach (var def in pageDefinitions)
        {
            var page = await context.Pages.FirstOrDefaultAsync(p => p.Code == def.Code);
            if (page == null)
            {
                page = new AppPage
                {
                    Code = def.Code,
                    Name = def.Name,
                    Route = def.Route,
                    Icon = def.Icon,
                    SortOrder = def.SortOrder,
                    IsActive = true,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    CreatedBy = adminUser?.Id ?? 1
                };
                context.Pages.Add(page);
                await context.SaveChangesAsync();
            }
            pageMap[def.Code] = page;
        }

        // Link parent relationships
        foreach (var def in pageDefinitions)
        {
            if (def.ParentCode != null && pageMap.TryGetValue(def.ParentCode, out var parentPage))
            {
                var currentPage = pageMap[def.Code];
                if (currentPage.ParentId != parentPage.Id)
                {
                    currentPage.ParentId = parentPage.Id;
                    await context.SaveChangesAsync();
                }
            }
        }

        // 4. Seed Permissions
        var permDefinitions = new List<(string PageCode, string Action, string Description)>
        {
            ("dashboard", "view", "View dashboard metrics"),
            ("stock", "view", "View stock overview"),
            ("stock-items", "view", "View stock item catalogue"),
            ("stock-items", "create", "Create new stock items"),
            ("stock-items", "edit", "Edit stock items"),
            ("stock-items", "delete", "Deactivate stock items"),
            ("stock-in", "view", "View stock in receiving"),
            ("stock-in", "create", "Record inward stock receipts"),
            ("stock-out", "view", "View stock out dispatch"),
            ("stock-out", "create", "Record outward stock dispatch"),
            ("stock-adjustments", "view", "View stock adjustments"),
            ("stock-adjustments", "create", "Record stock physical count adjustments"),
            ("stock-movements", "view", "View stock transaction movement ledger"),
            ("stock-alerts", "view", "View low stock and restock alerts"),

            // Purchases permissions
            ("purchases", "view", "View purchases section"),
            ("purchase-orders", "view", "View purchase orders"),
            ("purchase-orders", "create", "Create purchase orders"),
            ("purchase-orders", "approve", "Approve or reject purchase orders"),
            ("purchase-orders", "cancel", "Cancel purchase orders"),
            ("goods-receipts", "view", "View goods receipts"),
            ("goods-receipts", "create", "Process goods receiving / GRN"),
            ("purchase-returns", "view", "View purchase returns"),
            ("purchase-returns", "create", "Process purchase returns to suppliers"),

            // Sales permissions
            ("sales", "view", "View sales section"),
            ("sales-orders", "view", "View sales orders and invoices"),
            ("sales-orders", "create", "Create sales orders"),
            ("sales-orders", "confirm", "Confirm sales and dispatch stock"),
            ("sales-orders", "cancel", "Cancel sales orders"),
            ("sales-orders", "pay", "Record payments for invoices"),
            ("sales-returns", "view", "View sales returns"),
            ("sales-returns", "create", "Process customer sales returns"),

            // Warehouses & Transfers
            ("warehouses", "view", "View warehouse overview"),
            ("warehouses-list", "view", "View warehouse facilities"),
            ("warehouses-list", "create", "Create warehouse facilities"),
            ("transfers", "view", "View stock transfers"),
            ("transfers", "create", "Create and complete stock transfers"),

            // Suppliers & Customers
            ("suppliers", "view", "View suppliers"),
            ("suppliers", "create", "Create suppliers"),
            ("suppliers", "edit", "Edit suppliers"),
            ("customers", "view", "View customers"),
            ("customers", "create", "Create customers"),
            ("customers", "edit", "Edit customers"),

            // Reports & Audit
            ("reports", "view", "View analytics and financial reports"),
            ("audit", "view", "View security audit logs"),

            // Settings & Security
            ("users", "view", "View user accounts and permissions"),
            ("users", "create", "Create new user accounts"),
            ("users", "edit", "Edit user accounts and roles"),
            ("users", "delete", "Disable or remove user accounts"),
            ("units", "view", "View units of measurement"),
            ("units", "edit", "Edit existing units"),
            ("units", "delete", "Delete units of measurement"),
            ("roles", "view", "View system authorization roles"),
            ("roles", "create", "Create new system roles"),
            ("roles", "edit", "Edit system roles and role permissions"),
            ("roles", "delete", "Delete system roles"),
            ("permissions", "view", "View system action permissions"),
            ("permissions", "create", "Create system action permissions"),
            ("permissions", "edit", "Edit system permissions"),
            ("settings", "view", "View settings workspace")
        };

        var seededPerms = new List<AppPermission>();
        foreach (var def in permDefinitions)
        {
            if (!pageMap.TryGetValue(def.PageCode, out var page)) continue;

            var permCode = $"{def.PageCode}.{def.Action}";
            var perm = await context.Permissions.FirstOrDefaultAsync(p => p.Code == permCode);
            if (perm == null)
            {
                perm = new AppPermission
                {
                    Code = permCode,
                    PageId = page.Id,
                    Action = def.Action,
                    Description = def.Description,
                    CreatedAtUtc = DateTimeOffset.UtcNow,
                    CreatedBy = adminUser?.Id ?? 1
                };
                context.Permissions.Add(perm);
                await context.SaveChangesAsync();
            }
            seededPerms.Add(perm);
        }

        // 5. Assign Permissions to Roles
        foreach (var perm in seededPerms)
        {
            // ADMIN gets everything
            if (await context.RolePermissions.FirstOrDefaultAsync(rp => rp.RoleId == adminRole.Id && rp.PermissionId == perm.Id) == null)
            {
                context.RolePermissions.Add(new AppRolePermission
                {
                    RoleId = adminRole.Id,
                    PermissionId = perm.Id,
                    AssignedAtUtc = DateTimeOffset.UtcNow,
                    AssignedBy = adminUser?.Id ?? 1
                });
            }

            // MANAGER gets dashboard, stock, purchases, sales, inventory, reports
            if (perm.Code is "dashboard.view" or "reports.view" or "audit.view" || perm.Code.StartsWith("stock") || perm.Code.StartsWith("purchase") || perm.Code.StartsWith("sales") || perm.Code.StartsWith("warehouse"))
            {
                await EnsureRolePermissionAsync(context, managerRole.Id, perm.Id, adminUser?.Id ?? 1);
            }

            // PURCHASING gets PO, GRN, Purchase Returns, Suppliers, Stock Items view
            if (perm.Code.StartsWith("purchase") || perm.Code.StartsWith("goods") || perm.Code.StartsWith("supplier") || perm.Code is "stock.view" or "stock-items.view")
            {
                await EnsureRolePermissionAsync(context, purchasingRole.Id, perm.Id, adminUser?.Id ?? 1);
            }

            // WAREHOUSE gets Receiving, Inventory, Movements, Adjustments, Transfers
            if (perm.Code.StartsWith("stock") || perm.Code.StartsWith("warehouse") || perm.Code.StartsWith("transfer") || perm.Code.StartsWith("goods"))
            {
                await EnsureRolePermissionAsync(context, warehouseRole.Id, perm.Id, adminUser?.Id ?? 1);
            }

            // SALES gets Sales Orders, Payments, Sales Returns, Customers, Stock view
            if (perm.Code.StartsWith("sales") || perm.Code.StartsWith("customer") || perm.Code is "stock.view" or "stock-items.view" or "stock-alerts.view")
            {
                await EnsureRolePermissionAsync(context, salesRole.Id, perm.Id, adminUser?.Id ?? 1);
            }
        }
        await context.SaveChangesAsync();

        // 6. Seed Warehouses if empty
        if (await context.Warehouses.FirstOrDefaultAsync() == null)
        {
            var warehouses = new List<Warehouse>
            {
                new() { Code = "WH-MAIN", Name = "Main Warehouse Phnom Penh", Location = "Phnom Penh SEZ, Sangkat Phleung Chheh Roteh", ContactPhone = "+855 23 999 101", IsActive = true },
                new() { Code = "WH-REP", Name = "Siem Reap Distribution Hub", Location = "National Road 6, Siem Reap Central", ContactPhone = "+855 63 999 202", IsActive = true },
                new() { Code = "WH-BAT", Name = "Battambang Regional Branch", Location = "Street 102, Battambang City", ContactPhone = "+855 53 999 303", IsActive = true }
            };
            context.Warehouses.AddRange(warehouses);
            await context.SaveChangesAsync();
        }

        // 6.1 Seed Company Settings if empty
        if (await context.CompanySettings.FirstOrDefaultAsync() == null)
        {
            var mainWh = await context.Warehouses.FirstOrDefaultAsync(w => w.Code == "WH-MAIN");
            var companySetting = new CompanySetting
            {
                CompanyName = "Mekong Stock Enterprise Co., Ltd.",
                AppName = "Mekong Stock ERP",
                TaxId = "K008-902104588",
                CompanyPhone = "+855 23 999 888",
                CompanyEmail = "info@mekongstock.com.kh",
                CompanyAddress = "Phnom Penh Special Economic Zone (PPSEZ), National Road 4, Phnom Penh, Cambodia",
                DefaultWarehouseId = mainWh?.Id,
                DefaultWarehouseLocation = mainWh?.Name ?? "Main Warehouse Phnom Penh",
                CurrencyCode = "USD",
                CurrencySymbol = "$",
                VatRatePercentage = 10m,
                Timezone = "Asia/Phnom_Penh",
                DefaultLanguage = "km",
                AllowMultiWarehouse = true,
                EnforceTwoFactor = true,
                RequireStrongPassword = true,
                SessionTimeoutMinutes = 60,
                MaxFailedAttempts = 5,
                LockoutDurationMinutes = 15,
                MockModeEnabled = false,
                UpdatedAtUtc = DateTimeOffset.UtcNow
            };
            context.CompanySettings.Add(companySetting);
            await context.SaveChangesAsync();
        }

        // 7. Seed Brands if empty
        if (await context.Brands.FirstOrDefaultAsync() == null)
        {
            var brands = new List<Brand>
            {
                new() { Name = "Lenovo", Description = "Laptops, workstations, and computing gear" },
                new() { Name = "Logitech", Description = "Keyboards, mice, scanners, and peripherals" },
                new() { Name = "Mekong Roast", Description = "Locally grown artisanal roasted coffee beans" },
                new() { Name = "EcoBox Packaging", Description = "Heavy-duty eco-friendly boxes and tape" },
                new() { Name = "Apex Safety", Description = "Industrial PPE and warehouse safety wear" }
            };
            context.Brands.AddRange(brands);
            await context.SaveChangesAsync();
        }

        // 8. Seed Units of Measure if empty
        if (await context.UnitsOfMeasure.FirstOrDefaultAsync() == null)
        {
            var units = new List<UnitOfMeasure>
            {
                new() { Code = "PCS", Name = "Pieces" },
                new() { Code = "BOX", Name = "Box / Carton" },
                new() { Code = "KG", Name = "Kilograms" },
                new() { Code = "LTR", Name = "Liters" },
                new() { Code = "MTR", Name = "Meters" },
                new() { Code = "SET", Name = "Set / Bundle" }
            };
            context.UnitsOfMeasure.AddRange(units);
            await context.SaveChangesAsync();
        }

        // 9. Seed Suppliers if empty
        if (await context.Suppliers.FirstOrDefaultAsync() == null)
        {
            var suppliers = new List<Supplier>
            {
                new()
                {
                    SupplierCode = "SUP-001",
                    Name = "Mekong Tech Supply Co., Ltd.",
                    ContactPerson = "Chhay Dara",
                    Phone = "+855 12 345 678",
                    Email = "dara.chhay@mekongtech.kh",
                    Address = "#45 Russian Blvd, Phnom Penh",
                    PaymentTerms = "Net 30",
                    IsActive = true
                },
                new()
                {
                    SupplierCode = "SUP-002",
                    Name = "Khmer Packaging & Paper Corp",
                    ContactPerson = "Sok Rathana",
                    Phone = "+855 17 889 900",
                    Email = "rathana.sok@khmerpack.com",
                    Address = "#12 Veng Sreng Blvd, Phnom Penh",
                    PaymentTerms = "Net 15",
                    IsActive = true
                },
                new()
                {
                    SupplierCode = "SUP-003",
                    Name = "Angkor Beverages Distribution",
                    ContactPerson = "Keo Samnang",
                    Phone = "+855 89 112 233",
                    Email = "samnang.keo@angkorbev.kh",
                    Address = "National Road 4, Sihanoukville",
                    PaymentTerms = "Cash",
                    IsActive = true
                }
            };
            context.Suppliers.AddRange(suppliers);
            await context.SaveChangesAsync();
        }

        // 10. Seed Customers if empty
        if (await context.Customers.FirstOrDefaultAsync() == null)
        {
            var customers = new List<Customer>
            {
                new()
                {
                    CustomerCode = "CUST-001",
                    Name = "Sokha Mart Central",
                    ContactPerson = "Heng Sokha",
                    Phone = "+855 10 445 566",
                    Email = "sokha@sokhamart.com",
                    Address = "#89 Mao Tse Toung Blvd, Phnom Penh",
                    CustomerType = "Business",
                    CreditLimit = 5000m,
                    PaymentTerms = "Net 30",
                    IsActive = true
                },
                new()
                {
                    CustomerCode = "CUST-002",
                    Name = "Vireak Buntham Logistics Outlet",
                    ContactPerson = "Kao Vicheth",
                    Phone = "+855 16 778 899",
                    Email = "vicheth@vireakbuntham.com",
                    Address = "#200 Monivong Blvd, Phnom Penh",
                    CustomerType = "Business",
                    CreditLimit = 10000m,
                    PaymentTerms = "Net 15",
                    IsActive = true
                },
                new()
                {
                    CustomerCode = "CUST-003",
                    Name = "Walk-in Retail Buyer",
                    ContactPerson = "Store Walk-in",
                    Phone = "+855 12 000 000",
                    Email = "retail@store.kh",
                    Address = "Local Storefront",
                    CustomerType = "Walk-in",
                    CreditLimit = 0m,
                    PaymentTerms = "Cash",
                    IsActive = true
                }
            };
            context.Customers.AddRange(customers);
            await context.SaveChangesAsync();
        }

        // 11. Seed Categories & Stock Items if empty
        if (await context.StockCategories.FirstOrDefaultAsync() == null)
        {
            var categories = new List<StockCategory>
            {
                new() { Name = "Beverages & Liquids", Description = "Bottled drinks, cold brew, syrups" },
                new() { Name = "Packaging & Boxes", Description = "Cartons, labels, tape, bubble wrap" },
                new() { Name = "Electronics & Tech", Description = "Scanners, printers, hardware tools" },
                new() { Name = "Raw Materials", Description = "Grains, beans, bulk ingredients" },
                new() { Name = "Office Supplies", Description = "Safety gear, clipboards, markers" }
            };
            context.StockCategories.AddRange(categories);
            await context.SaveChangesAsync();
        }

        if (await context.StockItems.FirstOrDefaultAsync() == null)
        {
            var catBeverage = await context.StockCategories.FirstOrDefaultAsync(c => c.Name == "Beverages & Liquids");
            var catPackaging = await context.StockCategories.FirstOrDefaultAsync(c => c.Name == "Packaging & Boxes");
            var catElectronics = await context.StockCategories.FirstOrDefaultAsync(c => c.Name == "Electronics & Tech");
            var catRaw = await context.StockCategories.FirstOrDefaultAsync(c => c.Name == "Raw Materials");
            var catOffice = await context.StockCategories.FirstOrDefaultAsync(c => c.Name == "Office Supplies");

            var sampleItems = new List<StockItem>
            {
                new()
                {
                    Sku = "BV-MK-001",
                    Barcode = "885123456701",
                    Name = "Mekong Cold Brew 250ml",
                    Description = "Ready-to-drink organic cold brew glass bottle",
                    CategoryId = catBeverage?.Id,
                    Brand = "Mekong Roast",
                    Unit = "LTR",
                    CostPrice = 1.20m,
                    SellingPrice = 2.50m,
                    QuantityOnHand = 85,
                    MinStockLevel = 20,
                    MaxStockLevel = 200,
                    Location = "Zone A-12",
                    IsActive = true
                },
                new()
                {
                    Sku = "PK-BX-100",
                    Barcode = "885123456702",
                    Name = "Cardboard Shipping Box L",
                    Description = "Corrugated heavy-duty packing box 40x30x25cm",
                    CategoryId = catPackaging?.Id,
                    Brand = "EcoBox Packaging",
                    Unit = "BOX",
                    CostPrice = 0.85m,
                    SellingPrice = 1.60m,
                    QuantityOnHand = 450,
                    MinStockLevel = 100,
                    MaxStockLevel = 1000,
                    Location = "Zone B-04",
                    IsActive = true
                },
                new()
                {
                    Sku = "EL-SC-502",
                    Barcode = "885123456703",
                    Name = "Wireless Barcode Scanner 2D",
                    Description = "Handheld Bluetooth & 2.4G warehouse scanner",
                    CategoryId = catElectronics?.Id,
                    Brand = "Logitech",
                    Unit = "PCS",
                    CostPrice = 45.00m,
                    SellingPrice = 75.00m,
                    QuantityOnHand = 8,
                    MinStockLevel = 15,
                    MaxStockLevel = 50,
                    Location = "Tech Cage 01",
                    IsActive = true
                },
                new()
                {
                    Sku = "PK-LB-204",
                    Barcode = "885123456704",
                    Name = "Thermal Label Roll 4x6",
                    Description = "Direct thermal courier shipping label rolls (500 labels/roll)",
                    CategoryId = catPackaging?.Id,
                    Brand = "EcoBox Packaging",
                    Unit = "PCS",
                    CostPrice = 3.50m,
                    SellingPrice = 6.00m,
                    QuantityOnHand = 24,
                    MinStockLevel = 50,
                    MaxStockLevel = 300,
                    Location = "Zone B-08",
                    IsActive = true
                },
                new()
                {
                    Sku = "EL-CB-009",
                    Barcode = "885123456705",
                    Name = "USB-C Heavy Duty Cable 2m",
                    Description = "Braided fast-charging sync cables",
                    CategoryId = catElectronics?.Id,
                    Brand = "Apex Tech",
                    Unit = "PCS",
                    CostPrice = 2.10m,
                    SellingPrice = 5.50m,
                    QuantityOnHand = 0,
                    MinStockLevel = 15,
                    MaxStockLevel = 100,
                    Location = "Tech Cage 02",
                    IsActive = true
                },
                new()
                {
                    Sku = "RM-CF-011",
                    Barcode = "885123456706",
                    Name = "Premium Robusta Beans 1kg",
                    Description = "Mondulkiri highland roasted coffee beans",
                    CategoryId = catRaw?.Id,
                    Brand = "Mekong Roast",
                    Unit = "KG",
                    CostPrice = 7.20m,
                    SellingPrice = 14.00m,
                    QuantityOnHand = 120,
                    MinStockLevel = 30,
                    MaxStockLevel = 500,
                    Location = "Dry Vault D-02",
                    IsActive = true
                },
                new()
                {
                    Sku = "SF-GL-301",
                    Barcode = "885123456707",
                    Name = "Warehouse Safety Gloves XL",
                    Description = "Cut-resistant polyurethane coated grip gloves",
                    CategoryId = catOffice?.Id,
                    Brand = "Apex Safety",
                    Unit = "PCS",
                    CostPrice = 1.80m,
                    SellingPrice = 3.50m,
                    QuantityOnHand = 65,
                    MinStockLevel = 20,
                    MaxStockLevel = 200,
                    Location = "Zone C-01",
                    IsActive = true
                },
                new()
                {
                    Sku = "PK-BW-400",
                    Barcode = "885123456708",
                    Name = "Packaging Bubble Wrap 50m",
                    Description = "Roll 50cm x 50m protective packing wrap",
                    CategoryId = catPackaging?.Id,
                    Brand = "EcoBox Packaging",
                    Unit = "MTR",
                    CostPrice = 12.00m,
                    SellingPrice = 22.00m,
                    QuantityOnHand = 18,
                    MinStockLevel = 10,
                    MaxStockLevel = 80,
                    Location = "Zone B-10",
                    IsActive = true
                }
            };

            context.StockItems.AddRange(sampleItems);
            await context.SaveChangesAsync();

            // Seed initial sample movements
            var movements = new List<StockMovement>
            {
                new()
                {
                    ReferenceNo = "IN-20260918-001",
                    MovementType = "IN",
                    ReferenceType = "GRN",
                    ItemId = sampleItems[0].Id,
                    Quantity = 100,
                    UnitPrice = 1.20m,
                    BalanceBefore = 0,
                    BalanceAfter = 100,
                    Reason = "Supplier Purchase Delivery",
                    SupplierOrRecipient = "Mekong Beverage Co., Ltd",
                    Notes = "Initial batch delivery received in good condition.",
                    CreatedByUserId = adminUser?.Id ?? 1,
                    CreatedByUsername = "admin",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-3)
                },
                new()
                {
                    ReferenceNo = "OUT-20260919-002",
                    MovementType = "OUT",
                    ReferenceType = "SALE",
                    ItemId = sampleItems[0].Id,
                    Quantity = 15,
                    UnitPrice = 2.50m,
                    BalanceBefore = 100,
                    BalanceAfter = 85,
                    Reason = "Retail Store Dispatch",
                    SupplierOrRecipient = "Phnom Penh Central Outlet",
                    Notes = "Dispatched via van delivery.",
                    CreatedByUserId = adminUser?.Id ?? 1,
                    CreatedByUsername = "admin",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
                },
                new()
                {
                    ReferenceNo = "IN-20260919-003",
                    MovementType = "IN",
                    ReferenceType = "GRN",
                    ItemId = sampleItems[1].Id,
                    Quantity = 500,
                    UnitPrice = 0.85m,
                    BalanceBefore = 0,
                    BalanceAfter = 500,
                    Reason = "Bulk Packaging Receipt",
                    SupplierOrRecipient = "Khmer Carton Packaging Ltd",
                    Notes = "Pallet 1 & 2 stored in Zone B.",
                    CreatedByUserId = adminUser?.Id ?? 1,
                    CreatedByUsername = "admin",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
                },
                new()
                {
                    ReferenceNo = "OUT-20260920-004",
                    MovementType = "OUT",
                    ReferenceType = "SALE",
                    ItemId = sampleItems[1].Id,
                    Quantity = 50,
                    UnitPrice = 1.60m,
                    BalanceBefore = 500,
                    BalanceAfter = 450,
                    Reason = "Order Fulfillment Packing",
                    SupplierOrRecipient = "Fulfillment Hub #1",
                    Notes = "Used for weekend dispatch orders.",
                    CreatedByUserId = adminUser?.Id ?? 1,
                    CreatedByUsername = "admin",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-1)
                },
                new()
                {
                    ReferenceNo = "ADJ-20260920-005",
                    MovementType = "ADJUSTMENT",
                    ReferenceType = "ADJUSTMENT",
                    ItemId = sampleItems[2].Id,
                    Quantity = 2,
                    UnitPrice = 45.00m,
                    BalanceBefore = 10,
                    BalanceAfter = 8,
                    Reason = "Damaged during testing",
                    SupplierOrRecipient = "Inventory Audit (Shrinkage)",
                    Notes = "Defective optical reader sent for RMA replacement.",
                    CreatedByUserId = adminUser?.Id ?? 1,
                    CreatedByUsername = "admin",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddHours(-14)
                }
            };

            context.StockMovements.AddRange(movements);
            await context.SaveChangesAsync();

            // Link initial items to Main Warehouse stocks
            var mainWh = await context.Warehouses.FirstOrDefaultAsync(w => w.Code == "WH-MAIN");
            if (mainWh != null)
            {
                foreach (var item in sampleItems)
                {
                    context.WarehouseStocks.Add(new WarehouseStock
                    {
                        WarehouseId = mainWh.Id,
                        ProductId = item.Id,
                        QuantityOnHand = item.QuantityOnHand,
                        ReservedQuantity = 0,
                        UpdatedAtUtc = DateTimeOffset.UtcNow
                    });
                }
                await context.SaveChangesAsync();
            }

            // Seed Sample Purchase Order + GRN (Rule 1 & Rule 2 demo)
            var supTech = await context.Suppliers.FirstOrDefaultAsync(s => s.SupplierCode == "SUP-001");
            if (supTech != null && mainWh != null)
            {
                var po = new PurchaseOrder
                {
                    PoNumber = "PO-202609-0001",
                    SupplierId = supTech.Id,
                    WarehouseId = mainWh.Id,
                    OrderDateUtc = DateTimeOffset.UtcNow.AddDays(-5),
                    ExpectedDateUtc = DateTimeOffset.UtcNow.AddDays(-2),
                    PaymentTerms = "Net 30",
                    Status = "RECEIVED",
                    Subtotal = 450.00m,
                    Tax = 0,
                    Discount = 0,
                    TotalAmount = 450.00m,
                    Notes = "Restock warehouse scanner peripherals",
                    CreatedByUsername = "admin",
                    ApprovedByUsername = "admin",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-5)
                };

                po.Items.Add(new PurchaseOrderItem
                {
                    ProductId = sampleItems[2].Id,
                    Quantity = 10,
                    UnitCost = 45.00m,
                    Discount = 0,
                    Tax = 0,
                    Subtotal = 450.00m,
                    ReceivedQuantity = 10
                });

                context.PurchaseOrders.Add(po);
                await context.SaveChangesAsync();

                var grn = new GoodsReceipt
                {
                    GrnNumber = "GRN-202609-0001",
                    PurchaseOrderId = po.Id,
                    WarehouseId = mainWh.Id,
                    ReceivedDateUtc = DateTimeOffset.UtcNow.AddDays(-3),
                    ReceivedByUsername = "admin",
                    Notes = "All 10 units delivered and inspected in tech cage.",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-3)
                };

                grn.Items.Add(new GoodsReceiptItem
                {
                    ProductId = sampleItems[2].Id,
                    OrderedQuantity = 10,
                    ReceivedQuantity = 10,
                    DamagedQuantity = 0,
                    AcceptedQuantity = 10,
                    RejectedQuantity = 0,
                    UnitCost = 45.00m,
                    Remarks = "Passed QA inspection"
                });

                context.GoodsReceipts.Add(grn);
                await context.SaveChangesAsync();
            }

            // Seed Sample Sales Order + Payment (Rule 3 & Rule 12 demo)
            var custSokha = await context.Customers.FirstOrDefaultAsync(c => c.CustomerCode == "CUST-001");
            if (custSokha != null && mainWh != null)
            {
                var sale = new SalesOrder
                {
                    InvoiceNumber = "INV-202609-0001",
                    CustomerId = custSokha.Id,
                    WarehouseId = mainWh.Id,
                    SaleDateUtc = DateTimeOffset.UtcNow.AddDays(-2),
                    Status = "CONFIRMED",
                    PaymentStatus = "PAID",
                    Subtotal = 37.50m,
                    Tax = 0,
                    Discount = 0,
                    TotalAmount = 37.50m,
                    PaidAmount = 37.50m,
                    RemainingAmount = 0,
                    Notes = "Retail cold brew order for branch cafe",
                    CreatedByUsername = "admin",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
                };

                sale.Items.Add(new SalesOrderItem
                {
                    ProductId = sampleItems[0].Id,
                    Quantity = 15,
                    UnitPrice = 2.50m,
                    Discount = 0,
                    Tax = 0,
                    Subtotal = 37.50m
                });

                sale.Payments.Add(new SalePayment
                {
                    PaymentNumber = "PAY-202609-0001",
                    PaymentMethod = "QR",
                    Amount = 37.50m,
                    PaymentDateUtc = DateTimeOffset.UtcNow.AddDays(-2),
                    ReferenceNo = "BAKONG-TX-889102",
                    Notes = "KHQR Instant settlement",
                    ReceivedByUsername = "admin",
                    CreatedAtUtc = DateTimeOffset.UtcNow.AddDays(-2)
                });

                context.SalesOrders.Add(sale);
                await context.SaveChangesAsync();
            }

            // Ensure CompanySettings initialized
            if (!await context.CompanySettings.AnyAsync())
            {
                var defWh = await context.Warehouses.FirstOrDefaultAsync(w => w.Code == "WH-MAIN") ?? await context.Warehouses.FirstOrDefaultAsync();
                context.CompanySettings.Add(new CompanySetting
                {
                    CompanyName = "IS405 Enterprise Supply Co., Ltd.",
                    AppName = "IS405 ERP & Inventory System",
                    TaxId = "K001-902384712",
                    CompanyPhone = "+855 23 888 999",
                    CompanyEmail = "contact@is405supply.com.kh",
                    CompanyAddress = "Building 45, Russian Blvd, Sangkat Teuk Thla, Khan Sen Sok, Phnom Penh, Cambodia",
                    DefaultWarehouseId = defWh?.Id,
                    DefaultWarehouseLocation = defWh != null ? $"{defWh.Name} ({defWh.Code})" : "Phnom Penh Central Distribution Hub",
                    CurrencyCode = "USD",
                    CurrencySymbol = "$",
                    VatRatePercentage = 10m,
                    Timezone = "Asia/Phnom_Penh",
                    DefaultLanguage = "km",
                    AllowMultiWarehouse = true,
                    EnforceTwoFactor = true,
                    RequireStrongPassword = true,
                    SessionTimeoutMinutes = 60,
                    MaxFailedAttempts = 5,
                    LockoutDurationMinutes = 15,
                    MockModeEnabled = false,
                    UpdatedAtUtc = DateTimeOffset.UtcNow
                });
                await context.SaveChangesAsync();
            }

            // Ensure UserWarehouses initialized for existing seeded users
            if (!await context.UserWarehouses.AnyAsync())
            {
                var allWhs = await context.Warehouses.ToListAsync();
                var allUsers = await context.Users.ToListAsync();
                var mainWhObj = allWhs.FirstOrDefault(w => w.Code == "WH-MAIN") ?? allWhs.FirstOrDefault();

                foreach (var u in allUsers)
                {
                    foreach (var wh in allWhs)
                    {
                        context.UserWarehouses.Add(new AppUserWarehouse
                        {
                            UserId = u.Id,
                            WarehouseId = wh.Id,
                            IsDefault = (mainWhObj != null && wh.Id == mainWhObj.Id),
                            AssignedAtUtc = DateTimeOffset.UtcNow,
                            AssignedBy = 1
                        });
                    }
                }
                await context.SaveChangesAsync();
            }
        }
    }

    private static async Task<AppRole> EnsureRoleAsync(AppDbContext context, string code, string name, string description)
    {
        var role = await context.Roles.FirstOrDefaultAsync(r => r.Code == code);
        if (role == null)
        {
            role = new AppRole
            {
                Code = code,
                Name = name,
                Description = description,
                IsActive = true,
                CreatedAtUtc = DateTimeOffset.UtcNow,
                CreatedBy = 1
            };
            context.Roles.Add(role);
            await context.SaveChangesAsync();
        }
        return role;
    }

    private static async Task EnsureRolePermissionAsync(AppDbContext context, int roleId, int permissionId, int assignedBy)
    {
        var exists = await context.RolePermissions.AnyAsync(rp => rp.RoleId == roleId && rp.PermissionId == permissionId);
        if (!exists)
        {
            context.RolePermissions.Add(new AppRolePermission
            {
                RoleId = roleId,
                PermissionId = permissionId,
                AssignedAtUtc = DateTimeOffset.UtcNow,
                AssignedBy = assignedBy
            });
        }
    }
}
