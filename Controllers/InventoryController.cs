using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Authorize(Roles = "Manager"), Route("api/inventory")]
public sealed class InventoryController(AutoFixDbContext db) : ControllerBase
{
    [HttpGet, ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public async Task<IActionResult> List([FromQuery] string? q, [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10, CancellationToken cancellationToken = default)
    {
        if (page < 1 || pageSize is < 1 or > 100 || q?.Length > 100)
            return BadRequest(new { message = "Từ khóa hoặc số trang không hợp lệ." });
        var query = db.InventoryItems.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(item => item.Sku.Contains(term) || item.Name.Contains(term));
        }
        var total = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        page = Math.Min(page, totalPages);
        var items = await query.OrderBy(item => item.Name).ThenBy(item => item.Id)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return Ok(new { items, total, page, pageSize, totalPages });
    }

    [HttpPost]
    public async Task<IActionResult> Create(InventoryRequest request, CancellationToken cancellationToken)
    {
        var error = await ValidateAsync(request, null, cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        var item = new InventoryItem();
        Apply(item, request);
        db.InventoryItems.Add(item);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "Mã phụ tùng đã tồn tại. Vui lòng chọn mã khác." }); }
        return StatusCode(StatusCodes.Status201Created, item);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, InventoryRequest request, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (item is null) return NotFound(new { message = "Không tìm thấy phụ tùng." });
        var error = await ValidateAsync(request, id, cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        Apply(item, request);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "Phụ tùng vừa thay đổi hoặc mã đã tồn tại. Vui lòng tải lại." }); }
        return Ok(item);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var item = await db.InventoryItems.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (item is null) return NotFound(new { message = "Không tìm thấy phụ tùng." });
        db.InventoryItems.Remove(item);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException) { return Conflict(new { message = "Phụ tùng vừa thay đổi. Vui lòng tải lại." }); }
        return Ok(new { message = "Đã xóa phụ tùng." });
    }

    private async Task<string?> ValidateAsync(InventoryRequest request, int? id, CancellationToken cancellationToken)
    {
        if (request.UnitPrice != decimal.Truncate(request.UnitPrice)) return "Đơn giá cần là số nguyên đồng.";
        var sku = request.Sku.Trim().ToUpperInvariant();
        if (await db.InventoryItems.AnyAsync(item => item.Sku == sku && item.Id != id, cancellationToken))
            return "Mã phụ tùng đã tồn tại. Vui lòng chọn mã khác.";
        return null;
    }

    private static void Apply(InventoryItem item, InventoryRequest request)
    {
        item.Sku = request.Sku.Trim().ToUpperInvariant(); item.Name = request.Name.Trim();
        item.Unit = request.Unit.Trim(); item.Stock = request.Stock; item.UnitPrice = request.UnitPrice;
    }
}
