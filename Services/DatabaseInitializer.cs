using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

public sealed class DatabaseInitializer(AutoFixDbContext db, IWebHostEnvironment environment, ILogger<DatabaseInitializer> logger, IConfiguration configuration)
{
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.EnsureCreatedAsync(cancellationToken);
        // EnsureCreated handles a new database. Existing three-table projects need
        // this small additive upgrade; no existing tables or rows are replaced.
        await using (var upgrade = await db.Database.BeginTransactionAsync(cancellationToken))
        {
            await db.Database.ExecuteSqlRawAsync(AddInventoryAndRevenueSql, cancellationToken);
            await upgrade.CommitAsync(cancellationToken);
        }
        if (!await db.Services.AnyAsync(cancellationToken))
        {
            db.Services.AddRange(
                new ServiceOffering { Name = "Bảo dưỡng định kỳ", Price = 250000, Description = "<p>Kiểm tra dầu máy, bộ lọc và các hạng mục bảo dưỡng.</p>", ImageUrl = "/images/workshop-detail.jpg" },
                new ServiceOffering { Name = "Sửa chữa tổng quát", Price = 300000, Description = "<p>Kiểm tra và xử lý các hư hỏng thường gặp.</p>", ImageUrl = "/images/hero-workshop.jpg" },
                new ServiceOffering { Name = "Chẩn đoán điện & điện tử", Price = 200000, Description = "<p>Kiểm tra hệ thống điện và các cảnh báo trên xe.</p>", ImageUrl = "/images/vehicle-electric.jpg" },
                new ServiceOffering { Name = "Lốp & hệ thống phanh", Price = 150000, Description = "<p>Kiểm tra lốp, má phanh và độ an toàn vận hành.</p>", ImageUrl = "/images/vehicle-car.jpg" },
                new ServiceOffering { Name = "Chăm sóc & làm đẹp xe", Price = 100000, Description = "<p>Vệ sinh và chăm sóc bề mặt xe.</p>", ImageUrl = "/images/vehicle-motorcycle.jpg" },
                new ServiceOffering { Name = "Kiểm tra tổng thể", Price = 150000, Description = "<p>Kiểm tra tình trạng xe trước khi sử dụng hoặc đi xa.</p>", ImageUrl = "/images/vehicle-truck.jpg" });
            await db.SaveChangesAsync(cancellationToken);
        }

        // Tests can use a separate SQL database without copying the user's real bookings.
        if (!configuration.GetValue("AutoFix:ImportLegacyJson", true)) return;

        // Import once per database; never overwrite the original JSON or existing SQL rows.
        var path = Path.Combine(environment.ContentRootPath, "App_Data", "appointments.json");
        var marker = Path.Combine(environment.ContentRootPath, "App_Data", $"appointments-{db.Database.GetDbConnection().Database}.imported");
        if (!File.Exists(path) || File.Exists(marker)) return;
        await using var stream = File.OpenRead(path);
        var appointments = await JsonSerializer.DeserializeAsync<List<Appointment>>(stream, new JsonSerializerOptions(JsonSerializerDefaults.Web), cancellationToken) ?? [];
        var services = await db.Services.ToListAsync(cancellationToken);
        foreach (var appointment in appointments)
        {
            if (await db.Appointments.AnyAsync(item => item.Reference == appointment.Reference, cancellationToken)) continue;
            var service = services.FirstOrDefault(item => item.Name.Equals(appointment.Service, StringComparison.OrdinalIgnoreCase));
            if (service is null || AppointmentStore.NormalizePhone(appointment.Phone) is not { } phone || !AppointmentStatus.All.Contains(appointment.Status))
                throw new InvalidDataException($"Không thể chuyển lịch {appointment.Reference} sang SQL. Dữ liệu JSON được giữ nguyên.");
            appointment.ServiceId = service.Id;
            appointment.Phone = phone;
            appointment.RowVersion = [];
            db.Appointments.Add(appointment);
        }
        await db.SaveChangesAsync(cancellationToken);
        await File.WriteAllTextAsync(marker, DateTimeOffset.UtcNow.ToString("O"), cancellationToken);
        logger.LogInformation("Imported existing JSON appointments into {Database}; source file preserved.", db.Database.GetDbConnection().Database);
    }

    private const string AddInventoryAndRevenueSql = """
        IF OBJECT_ID(N'dbo.InventoryItems', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[InventoryItems] (
                [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_InventoryItems] PRIMARY KEY,
                [Sku] nvarchar(30) NOT NULL,
                [Name] nvarchar(120) NOT NULL,
                [Unit] nvarchar(20) NOT NULL,
                [Stock] int NOT NULL,
                [UnitPrice] decimal(18,0) NOT NULL,
                CONSTRAINT [CK_InventoryItems_Stock] CHECK ([Stock] >= 0 AND [Stock] <= 1000000),
                CONSTRAINT [CK_InventoryItems_UnitPrice] CHECK ([UnitPrice] >= 0 AND [UnitPrice] <= 100000000)
            );
            CREATE UNIQUE INDEX [IX_InventoryItems_Sku] ON [dbo].[InventoryItems] ([Sku]);
        END;
        IF OBJECT_ID(N'dbo.RevenueEntries', N'U') IS NULL
        BEGIN
            CREATE TABLE [dbo].[RevenueEntries] (
                [Reference] nvarchar(40) NOT NULL CONSTRAINT [PK_RevenueEntries] PRIMARY KEY,
                [Amount] decimal(18,0) NOT NULL,
                [PaidOn] date NOT NULL,
                [Note] nvarchar(300) NOT NULL,
                CONSTRAINT [CK_RevenueEntries_Amount] CHECK ([Amount] >= 1 AND [Amount] <= 100000000),
                CONSTRAINT [FK_RevenueEntries_Appointments_Reference] FOREIGN KEY ([Reference]) REFERENCES [dbo].[Appointments] ([Reference])
            );
            CREATE INDEX [IX_RevenueEntries_PaidOn] ON [dbo].[RevenueEntries] ([PaidOn]);
        END;
        """;
}
