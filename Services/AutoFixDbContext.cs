using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

public sealed class AutoFixDbContext(DbContextOptions<AutoFixDbContext> options) : DbContext(options)
{
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<ServiceOffering> Services => Set<ServiceOffering>();
    public DbSet<Appointment> Appointments => Set<Appointment>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<RevenueEntry> RevenueEntries => Set<RevenueEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppUser>().HasIndex(user => user.Username).IsUnique();
        modelBuilder.Entity<AppUser>().ToTable("Users", table => table.HasCheckConstraint("CK_Users_Role", "[Role] IN ('Manager','Customer')"));
        modelBuilder.Entity<ServiceOffering>().HasIndex(service => service.Name).IsUnique();
        modelBuilder.Entity<ServiceOffering>().Property(service => service.Price).HasPrecision(18, 0);
        modelBuilder.Entity<ServiceOffering>().ToTable("Services", table => table.HasCheckConstraint("CK_Services_Price", "[Price] >= 0 AND [Price] <= 100000000"));
        modelBuilder.Entity<Appointment>().HasOne<ServiceOffering>().WithMany().HasForeignKey(appointment => appointment.ServiceId).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<Appointment>().HasIndex(appointment => new { appointment.Date, appointment.Status });
        modelBuilder.Entity<Appointment>().ToTable("Appointments", table => table.HasCheckConstraint("CK_Appointments_Status", "[Status] IN ('Pending','Confirmed','InProgress','Completed','Cancelled')"));
        modelBuilder.Entity<InventoryItem>().HasIndex(item => item.Sku).IsUnique();
        modelBuilder.Entity<InventoryItem>().Property(item => item.UnitPrice).HasPrecision(18, 0);
        modelBuilder.Entity<InventoryItem>().ToTable("InventoryItems", table =>
        {
            table.HasCheckConstraint("CK_InventoryItems_Stock", "[Stock] >= 0 AND [Stock] <= 1000000");
            table.HasCheckConstraint("CK_InventoryItems_UnitPrice", "[UnitPrice] >= 0 AND [UnitPrice] <= 100000000");
        });
        modelBuilder.Entity<RevenueEntry>().Property(entry => entry.Amount).HasPrecision(18, 0);
        modelBuilder.Entity<RevenueEntry>().HasOne<Appointment>().WithOne().HasForeignKey<RevenueEntry>(entry => entry.Reference).OnDelete(DeleteBehavior.Restrict);
        modelBuilder.Entity<RevenueEntry>().HasIndex(entry => entry.PaidOn);
        modelBuilder.Entity<RevenueEntry>().ToTable("RevenueEntries", table => table.HasCheckConstraint("CK_RevenueEntries_Amount", "[Amount] >= 1 AND [Amount] <= 100000000"));
    }
}
