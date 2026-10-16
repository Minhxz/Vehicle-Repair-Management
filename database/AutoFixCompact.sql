-- AutoFix: SQL Server / LocalDB. Creates the same five tables as EF Core.
-- Run in SSMS or: sqlcmd -S "(localdb)\MSSQLLocalDB" -E -i database/AutoFixCompact.sql
-- Existing tables/data are preserved. Development accounts are created by the app.
IF DB_ID(N'AutoFixCompact') IS NULL
    CREATE DATABASE [AutoFixCompact];
GO
USE [AutoFixCompact];
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Users] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Users] PRIMARY KEY,
        [Username] nvarchar(100) NOT NULL,
        [PasswordHash] nvarchar(500) NOT NULL,
        [Role] nvarchar(20) NOT NULL,
        CONSTRAINT [CK_Users_Role] CHECK ([Role] IN ('Manager', 'Customer'))
    );
    CREATE UNIQUE INDEX [IX_Users_Username] ON [dbo].[Users] ([Username]);
END;
GO

IF OBJECT_ID(N'dbo.Services', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Services] (
        [Id] int IDENTITY(1,1) NOT NULL CONSTRAINT [PK_Services] PRIMARY KEY,
        [Name] nvarchar(120) NOT NULL,
        [Price] decimal(18,0) NOT NULL,
        [Description] nvarchar(max) NOT NULL,
        [ImageUrl] nvarchar(300) NOT NULL,
        CONSTRAINT [CK_Services_Price] CHECK ([Price] >= 0 AND [Price] <= 100000000)
    );
    CREATE UNIQUE INDEX [IX_Services_Name] ON [dbo].[Services] ([Name]);
END;
GO

IF OBJECT_ID(N'dbo.Appointments', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[Appointments] (
        [Reference] nvarchar(40) NOT NULL CONSTRAINT [PK_Appointments] PRIMARY KEY,
        [CustomerName] nvarchar(100) NOT NULL,
        [Phone] nvarchar(10) NOT NULL,
        [VehicleType] nvarchar(50) NOT NULL,
        [Brand] nvarchar(80) NOT NULL,
        [LicensePlate] nvarchar(20) NOT NULL,
        [ServiceId] int NOT NULL,
        [Service] nvarchar(120) NOT NULL,
        [Date] nvarchar(10) NOT NULL,
        [Time] nvarchar(5) NOT NULL,
        [Note] nvarchar(1000) NOT NULL,
        [ProcessingNote] nvarchar(2000) NOT NULL,
        [Status] nvarchar(20) NOT NULL,
        [CreatedAt] datetimeoffset NOT NULL,
        [UpdatedAt] datetimeoffset NOT NULL,
        [RowVersion] rowversion NOT NULL,
        CONSTRAINT [CK_Appointments_Status] CHECK ([Status] IN ('Pending','Confirmed','InProgress','Completed','Cancelled')),
        CONSTRAINT [FK_Appointments_Services_ServiceId] FOREIGN KEY ([ServiceId]) REFERENCES [dbo].[Services] ([Id])
    );
    CREATE INDEX [IX_Appointments_ServiceId] ON [dbo].[Appointments] ([ServiceId]);
    CREATE INDEX [IX_Appointments_Date_Status] ON [dbo].[Appointments] ([Date], [Status]);
END;
GO

-- Additive upgrade for existing three-table projects; do not import old stock JSON.
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
GO

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
GO

IF NOT EXISTS (SELECT 1 FROM [dbo].[Services])
BEGIN
    INSERT INTO [dbo].[Services] ([Name], [Price], [Description], [ImageUrl]) VALUES
    (N'Bảo dưỡng định kỳ', 250000, N'<p>Kiểm tra dầu máy, bộ lọc và các hạng mục bảo dưỡng.</p>', N'/images/workshop-detail.jpg'),
    (N'Sửa chữa tổng quát', 300000, N'<p>Kiểm tra và xử lý các hư hỏng thường gặp.</p>', N'/images/hero-workshop.jpg'),
    (N'Chẩn đoán điện & điện tử', 200000, N'<p>Kiểm tra hệ thống điện và các cảnh báo trên xe.</p>', N'/images/vehicle-electric.jpg'),
    (N'Lốp & hệ thống phanh', 150000, N'<p>Kiểm tra lốp, má phanh và độ an toàn vận hành.</p>', N'/images/vehicle-car.jpg'),
    (N'Chăm sóc & làm đẹp xe', 100000, N'<p>Vệ sinh và chăm sóc bề mặt xe.</p>', N'/images/vehicle-motorcycle.jpg'),
    (N'Kiểm tra tổng thể', 150000, N'<p>Kiểm tra tình trạng xe trước khi sử dụng hoặc đi xa.</p>', N'/images/vehicle-truck.jpg');
END;
GO
