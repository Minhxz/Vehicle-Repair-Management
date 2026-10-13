using System.Text.Json;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

public sealed class InventoryStore(IWebHostEnvironment environment)
{
    private readonly string _directory = Path.Combine(environment.ContentRootPath, "App_Data");
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };

    public async Task<List<InventoryItem>> ListAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try { return (await ReadAsync(cancellationToken)).OrderBy(item => item.Name).ToList(); }
        finally { _gate.Release(); }
    }

    public async Task<InventoryItem?> SaveAsync(string? id, InventoryRequest request, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var items = await ReadAsync(cancellationToken);
            var sku = request.Sku.Trim().ToUpperInvariant();
            if (items.Any(item => item.Id != id && item.Sku.Equals(sku, StringComparison.OrdinalIgnoreCase)))
                throw new ArgumentException("Mã phụ tùng đã tồn tại.");
            var item = id is null ? new InventoryItem { Id = Guid.NewGuid().ToString("N") } : items.FirstOrDefault(item => item.Id == id);
            if (item is null) return null;
            item.Sku = sku; item.Name = request.Name.Trim(); item.Category = request.Category.Trim();
            item.Stock = request.Stock; item.UnitPrice = request.UnitPrice; item.Unit = request.Unit.Trim();
            item.ReorderLevel = request.ReorderLevel; item.UpdatedAt = DateTimeOffset.UtcNow;
            if (id is null) items.Add(item);
            await PersistAsync(items, cancellationToken);
            return item;
        }
        finally { _gate.Release(); }
    }

    private async Task<List<InventoryItem>> ReadAsync(CancellationToken cancellationToken)
    {
        var path = Path.Combine(_directory, "inventory.json");
        if (!File.Exists(path)) return [];
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, true);
        return await JsonSerializer.DeserializeAsync<List<InventoryItem>>(stream, JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("Inventory data could not be read.");
    }

    private async Task PersistAsync(List<InventoryItem> items, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_directory);
        var path = Path.Combine(_directory, "inventory.json");
        var temporaryPath = Path.Combine(_directory, $"inventory-{Guid.NewGuid():N}.tmp");
        try
        {
            await using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, true))
            {
                await JsonSerializer.SerializeAsync(stream, items, JsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
            }
            File.Move(temporaryPath, path, true);
        }
        finally { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); }
    }
}
