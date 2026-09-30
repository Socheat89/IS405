using backend.Models.Data;
using backend.Modules.Audit.Models;
using backend.Modules.Catalog.Models;
using backend.Modules.Customers.Models;
using backend.Modules.Inventory.Models;
using backend.Modules.Purchasing.Models;
using backend.Modules.Sales.Models;
using backend.Modules.Suppliers.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    // Security & Auth
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<AppRole> Roles => Set<AppRole>();
    public DbSet<AppPermission> Permissions => Set<AppPermission>();
    public DbSet<AppRolePermission> RolePermissions => Set<AppRolePermission>();
    public DbSet<AppUserRole> UserRoles => Set<AppUserRole>();
    public DbSet<AppUserPermission> UserPermissions => Set<AppUserPermission>();
    public DbSet<AppUserWarehouse> UserWarehouses => Set<AppUserWarehouse>();
    public DbSet<CompanySetting> CompanySettings => Set<CompanySetting>();
    public DbSet<AppPage> Pages => Set<AppPage>();

    // Audit
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // Catalog
    public DbSet<StockCategory> StockCategories => Set<StockCategory>();
    public DbSet<StockItem> StockItems => Set<StockItem>();
    public DbSet<Brand> Brands => Set<Brand>();
    public DbSet<UnitOfMeasure> UnitsOfMeasure => Set<UnitOfMeasure>();

    // Suppliers & Customers
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<Customer> Customers => Set<Customer>();

    // Inventory & Warehouses
    public DbSet<Warehouse> Warehouses => Set<Warehouse>();
    public DbSet<WarehouseStock> WarehouseStocks => Set<WarehouseStock>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();
    public DbSet<StockAdjustment> StockAdjustments => Set<StockAdjustment>();
    public DbSet<StockTransfer> StockTransfers => Set<StockTransfer>();
    public DbSet<StockTransferItem> StockTransferItems => Set<StockTransferItem>();

    // Purchasing (PO, GRN, Returns)
    public DbSet<PurchaseOrder> PurchaseOrders => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems => Set<PurchaseOrderItem>();
    public DbSet<GoodsReceipt> GoodsReceipts => Set<GoodsReceipt>();
    public DbSet<GoodsReceiptItem> GoodsReceiptItems => Set<GoodsReceiptItem>();
    public DbSet<PurchaseReturn> PurchaseReturns => Set<PurchaseReturn>();
    public DbSet<PurchaseReturnItem> PurchaseReturnItems => Set<PurchaseReturnItem>();

    // Sales (Orders, Payments, Returns)
    public DbSet<SalesOrder> SalesOrders => Set<SalesOrder>();
    public DbSet<SalesOrderItem> SalesOrderItems => Set<SalesOrderItem>();
    public DbSet<SalePayment> SalePayments => Set<SalePayment>();
    public DbSet<SalesReturn> SalesReturns => Set<SalesReturn>();
    public DbSet<SalesReturnItem> SalesReturnItems => Set<SalesReturnItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // AppUser
        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.Username).IsUnique();
            entity.HasIndex(u => u.Email).IsUnique();
            entity.Property(u => u.Username).HasMaxLength(100);
            entity.Property(u => u.Email).HasMaxLength(256);
        });

        // AppRole
        modelBuilder.Entity<AppRole>(entity =>
        {
            entity.HasKey(r => r.Id);
            entity.HasIndex(r => r.Code).IsUnique();
            entity.Property(r => r.Code).HasMaxLength(50);
            entity.Property(r => r.Name).HasMaxLength(100);
            entity.Property(r => r.Description).HasMaxLength(500);
        });

        // AppPage
        modelBuilder.Entity<AppPage>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.Code).IsUnique();
            entity.Property(p => p.Code).HasMaxLength(50);
            entity.Property(p => p.Name).HasMaxLength(100);
            entity.Property(p => p.Route).HasMaxLength(200);
            entity.Property(p => p.Icon).HasMaxLength(50);

            entity.HasOne(p => p.Parent)
                  .WithMany(p => p.Children)
                  .HasForeignKey(p => p.ParentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // AppPermission
        modelBuilder.Entity<AppPermission>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.Code).IsUnique();
            entity.HasIndex(p => new { p.PageId, p.Action }).IsUnique();
            entity.Property(p => p.Code).HasMaxLength(100);
            entity.Property(p => p.Action).HasMaxLength(30);
            entity.Property(p => p.Description).HasMaxLength(500);

            entity.HasOne(p => p.Page)
                  .WithMany(page => page.Permissions)
                  .HasForeignKey(p => p.PageId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // AppRolePermission
        modelBuilder.Entity<AppRolePermission>(entity =>
        {
            entity.HasKey(rp => new { rp.RoleId, rp.PermissionId });

            entity.HasOne(rp => rp.Role)
                  .WithMany(r => r.RolePermissions)
                  .HasForeignKey(rp => rp.RoleId);

            entity.HasOne(rp => rp.Permission)
                  .WithMany(p => p.RolePermissions)
                  .HasForeignKey(rp => rp.PermissionId);
        });

        // AppUserRole
        modelBuilder.Entity<AppUserRole>(entity =>
        {
            entity.HasKey(ur => new { ur.UserId, ur.RoleId });

            entity.HasOne(ur => ur.User)
                  .WithMany(u => u.UserRoles)
                  .HasForeignKey(ur => ur.UserId);

            entity.HasOne(ur => ur.Role)
                  .WithMany(r => r.UserRoles)
                  .HasForeignKey(ur => ur.RoleId);
        });

        // AppUserPermission
        modelBuilder.Entity<AppUserPermission>(entity =>
        {
            entity.HasKey(up => new { up.UserId, up.PermissionId });

            entity.HasOne(up => up.User)
                  .WithMany(u => u.UserPermissions)
                  .HasForeignKey(up => up.UserId);

            entity.HasOne(up => up.Permission)
                  .WithMany(p => p.UserPermissions)
                  .HasForeignKey(up => up.PermissionId);
        });

        // AppUserWarehouse
        modelBuilder.Entity<AppUserWarehouse>(entity =>
        {
            entity.HasKey(uw => new { uw.UserId, uw.WarehouseId });

            entity.HasOne(uw => uw.User)
                  .WithMany(u => u.UserWarehouses)
                  .HasForeignKey(uw => uw.UserId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(uw => uw.Warehouse)
                  .WithMany()
                  .HasForeignKey(uw => uw.WarehouseId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // CompanySetting
        modelBuilder.Entity<CompanySetting>(entity =>
        {
            entity.HasKey(cs => cs.Id);
            entity.Property(cs => cs.CompanyName).HasMaxLength(200);
            entity.Property(cs => cs.AppName).HasMaxLength(100);
            entity.Property(cs => cs.TaxId).HasMaxLength(100);
            entity.Property(cs => cs.CompanyPhone).HasMaxLength(50);
            entity.Property(cs => cs.CompanyEmail).HasMaxLength(150);
            entity.Property(cs => cs.CompanyAddress).HasMaxLength(500);
            entity.Property(cs => cs.CurrencyCode).HasMaxLength(10);
            entity.Property(cs => cs.CurrencySymbol).HasMaxLength(10);
            entity.Property(cs => cs.Timezone).HasMaxLength(50);
            entity.Property(cs => cs.DefaultLanguage).HasMaxLength(10);

            entity.HasOne(cs => cs.DefaultWarehouse)
                  .WithMany()
                  .HasForeignKey(cs => cs.DefaultWarehouseId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // AuditLog
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.Property(a => a.Action).HasMaxLength(50);
            entity.Property(a => a.EntityName).HasMaxLength(100);
            entity.Property(a => a.EntityId).HasMaxLength(100);
            entity.Property(a => a.Description).HasMaxLength(500);
            entity.Property(a => a.Username).HasMaxLength(100);
            entity.Property(a => a.IpAddress).HasMaxLength(50);
        });

        // StockCategory
        modelBuilder.Entity<StockCategory>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Name).HasMaxLength(100);
            entity.Property(c => c.Description).HasMaxLength(250);
        });

        // StockItem
        modelBuilder.Entity<StockItem>(entity =>
        {
            entity.HasKey(i => i.Id);
            entity.HasIndex(i => i.Sku).IsUnique();
            entity.Property(i => i.Sku).HasMaxLength(50);
            entity.Property(i => i.Name).HasMaxLength(200);
            entity.Property(i => i.Unit).HasMaxLength(20);
            entity.Property(i => i.Brand).HasMaxLength(100);
            entity.Property(i => i.CostPrice).HasPrecision(18, 2);
            entity.Property(i => i.SellingPrice).HasPrecision(18, 2);

            entity.HasOne(i => i.Category)
                  .WithMany(c => c.Items)
                  .HasForeignKey(i => i.CategoryId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        // Brand & UnitOfMeasure
        modelBuilder.Entity<Brand>(entity =>
        {
            entity.HasKey(b => b.Id);
            entity.Property(b => b.Name).HasMaxLength(100);
            entity.Property(b => b.Description).HasMaxLength(250);
        });

        modelBuilder.Entity<UnitOfMeasure>(entity =>
        {
            entity.HasKey(u => u.Id);
            entity.HasIndex(u => u.Code).IsUnique();
            entity.Property(u => u.Code).HasMaxLength(20);
            entity.Property(u => u.Name).HasMaxLength(100);
        });

        // Supplier
        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.HasIndex(s => s.SupplierCode).IsUnique();
            entity.Property(s => s.SupplierCode).HasMaxLength(50);
            entity.Property(s => s.Name).HasMaxLength(200);
            entity.Property(s => s.ContactPerson).HasMaxLength(100);
            entity.Property(s => s.Phone).HasMaxLength(50);
            entity.Property(s => s.Email).HasMaxLength(100);
            entity.Property(s => s.PaymentTerms).HasMaxLength(50);
        });

        // Customer
        modelBuilder.Entity<Customer>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.HasIndex(c => c.CustomerCode).IsUnique();
            entity.Property(c => c.CustomerCode).HasMaxLength(50);
            entity.Property(c => c.Name).HasMaxLength(200);
            entity.Property(c => c.ContactPerson).HasMaxLength(100);
            entity.Property(c => c.Phone).HasMaxLength(50);
            entity.Property(c => c.Email).HasMaxLength(100);
            entity.Property(c => c.CustomerType).HasMaxLength(50);
            entity.Property(c => c.PaymentTerms).HasMaxLength(50);
            entity.Property(c => c.CreditLimit).HasPrecision(18, 2);
        });

        // Warehouse & WarehouseStock
        modelBuilder.Entity<Warehouse>(entity =>
        {
            entity.HasKey(w => w.Id);
            entity.HasIndex(w => w.Code).IsUnique();
            entity.Property(w => w.Code).HasMaxLength(50);
            entity.Property(w => w.Name).HasMaxLength(100);
            entity.Property(w => w.Location).HasMaxLength(200);
            entity.Property(w => w.ContactPhone).HasMaxLength(50);
        });

        modelBuilder.Entity<WarehouseStock>(entity =>
        {
            entity.HasKey(ws => ws.Id);
            entity.HasIndex(ws => new { ws.WarehouseId, ws.ProductId }).IsUnique();

            entity.HasOne(ws => ws.Warehouse)
                  .WithMany(w => w.Stocks)
                  .HasForeignKey(ws => ws.WarehouseId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ws => ws.Product)
                  .WithMany()
                  .HasForeignKey(ws => ws.ProductId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // StockMovement
        modelBuilder.Entity<StockMovement>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.Property(m => m.ReferenceNo).HasMaxLength(50);
            entity.Property(m => m.MovementType).HasMaxLength(20);
            entity.Property(m => m.ReferenceType).HasMaxLength(30);
            entity.Property(m => m.UnitPrice).HasPrecision(18, 2);
            entity.Property(m => m.Reason).HasMaxLength(200);
            entity.Property(m => m.SupplierOrRecipient).HasMaxLength(200);

            entity.HasOne(m => m.Item)
                  .WithMany(i => i.Movements)
                  .HasForeignKey(m => m.ItemId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // StockAdjustment
        modelBuilder.Entity<StockAdjustment>(entity =>
        {
            entity.HasKey(a => a.Id);
            entity.HasIndex(a => a.AdjustmentNo).IsUnique();
            entity.Property(a => a.AdjustmentNo).HasMaxLength(50);
            entity.Property(a => a.AdjustmentType).HasMaxLength(30);
            entity.Property(a => a.UnitCost).HasPrecision(18, 2);
            entity.Property(a => a.Reason).HasMaxLength(200);

            entity.HasOne(a => a.Warehouse)
                  .WithMany()
                  .HasForeignKey(a => a.WarehouseId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.Product)
                  .WithMany()
                  .HasForeignKey(a => a.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // StockTransfer & Items
        modelBuilder.Entity<StockTransfer>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasIndex(t => t.TransferNo).IsUnique();
            entity.Property(t => t.TransferNo).HasMaxLength(50);
            entity.Property(t => t.Status).HasMaxLength(30);

            entity.HasOne(t => t.FromWarehouse)
                  .WithMany()
                  .HasForeignKey(t => t.FromWarehouseId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.ToWarehouse)
                  .WithMany()
                  .HasForeignKey(t => t.ToWarehouseId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StockTransferItem>(entity =>
        {
            entity.HasKey(ti => ti.Id);

            entity.HasOne(ti => ti.StockTransfer)
                  .WithMany(t => t.Items)
                  .HasForeignKey(ti => ti.StockTransferId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(ti => ti.Product)
                  .WithMany()
                  .HasForeignKey(ti => ti.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // PurchaseOrder & Items
        modelBuilder.Entity<PurchaseOrder>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.PoNumber).IsUnique();
            entity.Property(p => p.PoNumber).HasMaxLength(50);
            entity.Property(p => p.PaymentTerms).HasMaxLength(50);
            entity.Property(p => p.Status).HasMaxLength(30);
            entity.Property(p => p.Subtotal).HasPrecision(18, 2);
            entity.Property(p => p.Tax).HasPrecision(18, 2);
            entity.Property(p => p.Discount).HasPrecision(18, 2);
            entity.Property(p => p.TotalAmount).HasPrecision(18, 2);

            entity.HasOne(p => p.Supplier)
                  .WithMany()
                  .HasForeignKey(p => p.SupplierId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.Warehouse)
                  .WithMany()
                  .HasForeignKey(p => p.WarehouseId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PurchaseOrderItem>(entity =>
        {
            entity.HasKey(pi => pi.Id);
            entity.Property(pi => pi.UnitCost).HasPrecision(18, 2);
            entity.Property(pi => pi.Discount).HasPrecision(18, 2);
            entity.Property(pi => pi.Tax).HasPrecision(18, 2);
            entity.Property(pi => pi.Subtotal).HasPrecision(18, 2);

            entity.HasOne(pi => pi.PurchaseOrder)
                  .WithMany(p => p.Items)
                  .HasForeignKey(pi => pi.PurchaseOrderId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(pi => pi.Product)
                  .WithMany()
                  .HasForeignKey(pi => pi.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // GoodsReceipt & Items
        modelBuilder.Entity<GoodsReceipt>(entity =>
        {
            entity.HasKey(g => g.Id);
            entity.HasIndex(g => g.GrnNumber).IsUnique();
            entity.Property(g => g.GrnNumber).HasMaxLength(50);

            entity.HasOne(g => g.PurchaseOrder)
                  .WithMany(p => p.GoodsReceipts)
                  .HasForeignKey(g => g.PurchaseOrderId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(g => g.Warehouse)
                  .WithMany()
                  .HasForeignKey(g => g.WarehouseId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<GoodsReceiptItem>(entity =>
        {
            entity.HasKey(gi => gi.Id);
            entity.Property(gi => gi.UnitCost).HasPrecision(18, 2);

            entity.HasOne(gi => gi.GoodsReceipt)
                  .WithMany(g => g.Items)
                  .HasForeignKey(gi => gi.GoodsReceiptId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(gi => gi.Product)
                  .WithMany()
                  .HasForeignKey(gi => gi.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // PurchaseReturn & Items
        modelBuilder.Entity<PurchaseReturn>(entity =>
        {
            entity.HasKey(pr => pr.Id);
            entity.HasIndex(pr => pr.ReturnNumber).IsUnique();
            entity.Property(pr => pr.ReturnNumber).HasMaxLength(50);
            entity.Property(pr => pr.Status).HasMaxLength(30);
            entity.Property(pr => pr.TotalRefundAmount).HasPrecision(18, 2);

            entity.HasOne(pr => pr.Supplier)
                  .WithMany()
                  .HasForeignKey(pr => pr.SupplierId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(pr => pr.PurchaseOrder)
                  .WithMany()
                  .HasForeignKey(pr => pr.PurchaseOrderId)
                  .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(pr => pr.Warehouse)
                  .WithMany()
                  .HasForeignKey(pr => pr.WarehouseId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<PurchaseReturnItem>(entity =>
        {
            entity.HasKey(pri => pri.Id);
            entity.Property(pri => pri.UnitCost).HasPrecision(18, 2);
            entity.Property(pri => pri.Subtotal).HasPrecision(18, 2);

            entity.HasOne(pri => pri.PurchaseReturn)
                  .WithMany(pr => pr.Items)
                  .HasForeignKey(pri => pri.PurchaseReturnId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(pri => pri.Product)
                  .WithMany()
                  .HasForeignKey(pri => pri.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // SalesOrder & Items
        modelBuilder.Entity<SalesOrder>(entity =>
        {
            entity.HasKey(s => s.Id);
            entity.HasIndex(s => s.InvoiceNumber).IsUnique();
            entity.Property(s => s.InvoiceNumber).HasMaxLength(50);
            entity.Property(s => s.Status).HasMaxLength(30);
            entity.Property(s => s.PaymentStatus).HasMaxLength(30);
            entity.Property(s => s.Subtotal).HasPrecision(18, 2);
            entity.Property(s => s.Tax).HasPrecision(18, 2);
            entity.Property(s => s.Discount).HasPrecision(18, 2);
            entity.Property(s => s.TotalAmount).HasPrecision(18, 2);
            entity.Property(s => s.PaidAmount).HasPrecision(18, 2);
            entity.Property(s => s.RemainingAmount).HasPrecision(18, 2);

            entity.HasOne(s => s.Customer)
                  .WithMany()
                  .HasForeignKey(s => s.CustomerId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(s => s.Warehouse)
                  .WithMany()
                  .HasForeignKey(s => s.WarehouseId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SalesOrderItem>(entity =>
        {
            entity.HasKey(si => si.Id);
            entity.Property(si => si.UnitPrice).HasPrecision(18, 2);
            entity.Property(si => si.Discount).HasPrecision(18, 2);
            entity.Property(si => si.Tax).HasPrecision(18, 2);
            entity.Property(si => si.Subtotal).HasPrecision(18, 2);

            entity.HasOne(si => si.SalesOrder)
                  .WithMany(s => s.Items)
                  .HasForeignKey(si => si.SalesOrderId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(si => si.Product)
                  .WithMany()
                  .HasForeignKey(si => si.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // SalePayment
        modelBuilder.Entity<SalePayment>(entity =>
        {
            entity.HasKey(sp => sp.Id);
            entity.HasIndex(sp => sp.PaymentNumber).IsUnique();
            entity.Property(sp => sp.PaymentNumber).HasMaxLength(50);
            entity.Property(sp => sp.PaymentMethod).HasMaxLength(30);
            entity.Property(sp => sp.ReferenceNo).HasMaxLength(100);
            entity.Property(sp => sp.Amount).HasPrecision(18, 2);

            entity.HasOne(sp => sp.SalesOrder)
                  .WithMany(s => s.Payments)
                  .HasForeignKey(sp => sp.SalesOrderId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // SalesReturn & Items
        modelBuilder.Entity<SalesReturn>(entity =>
        {
            entity.HasKey(sr => sr.Id);
            entity.HasIndex(sr => sr.ReturnNumber).IsUnique();
            entity.Property(sr => sr.ReturnNumber).HasMaxLength(50);
            entity.Property(sr => sr.Status).HasMaxLength(30);
            entity.Property(sr => sr.RefundAmount).HasPrecision(18, 2);

            entity.HasOne(sr => sr.SalesOrder)
                  .WithMany(s => s.Returns)
                  .HasForeignKey(sr => sr.SalesOrderId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(sr => sr.Customer)
                  .WithMany()
                  .HasForeignKey(sr => sr.CustomerId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(sr => sr.Warehouse)
                  .WithMany()
                  .HasForeignKey(sr => sr.WarehouseId)
                  .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SalesReturnItem>(entity =>
        {
            entity.HasKey(sri => sri.Id);
            entity.Property(sri => sri.UnitPrice).HasPrecision(18, 2);
            entity.Property(sri => sri.Subtotal).HasPrecision(18, 2);
            entity.Property(sri => sri.Condition).HasMaxLength(50);

            entity.HasOne(sri => sri.SalesReturn)
                  .WithMany(sr => sr.Items)
                  .HasForeignKey(sri => sri.SalesReturnId)
                  .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(sri => sri.Product)
                  .WithMany()
                  .HasForeignKey(sri => sri.ProductId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Oracle compatibility for boolean types
        if (Database.ProviderName?.Contains("Oracle", StringComparison.OrdinalIgnoreCase) == true)
        {
            var boolConverter = new Microsoft.EntityFrameworkCore.Storage.ValueConversion.BoolToZeroOneConverter<int>();

            foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            {
                foreach (var property in entityType.GetProperties())
                {
                    if (property.ClrType == typeof(bool) || property.ClrType == typeof(bool?))
                    {
                        property.SetValueConverter(boolConverter);
                    }
                }
            }
        }
    }
}
