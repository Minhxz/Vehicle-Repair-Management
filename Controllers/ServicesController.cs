using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Route("api/services")]
public sealed class ServicesController(AutoFixDbContext db, IWebHostEnvironment environment) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken) =>
        Ok(new { services = await db.Services.AsNoTracking().OrderBy(item => item.Id).ToListAsync(cancellationToken) });

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detail(int id, CancellationToken cancellationToken)
    {
        var service = await db.Services.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        return service is null ? NotFound(new { message = "Không tìm thấy dịch vụ." }) : Ok(service);
    }

    [Authorize(Roles = "Manager"), HttpPost]
    public async Task<IActionResult> Create(ServiceRequest request, CancellationToken cancellationToken)
    {
        var error = await ValidateAsync(request, null, cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        var service = new ServiceOffering();
        Apply(service, request);
        db.Services.Add(service);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "Tên dịch vụ đã tồn tại. Vui lòng tải lại danh sách." }); }
        return CreatedAtAction(nameof(Detail), new { id = service.Id }, service);
    }

    [Authorize(Roles = "Manager"), HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, ServiceRequest request, CancellationToken cancellationToken)
    {
        var service = await db.Services.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (service is null) return NotFound(new { message = "Không tìm thấy dịch vụ." });
        var error = await ValidateAsync(request, id, cancellationToken);
        if (error is not null) return BadRequest(new { message = error });
        Apply(service, request);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "Tên dịch vụ đã tồn tại. Vui lòng tải lại danh sách." }); }
        return Ok(service);
    }

    [Authorize(Roles = "Manager"), HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var service = await db.Services.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (service is null) return NotFound(new { message = "Không tìm thấy dịch vụ." });
        if (await db.Appointments.AnyAsync(item => item.ServiceId == id, cancellationToken))
            return Conflict(new { message = "Dịch vụ đã có lịch hẹn, không thể xóa. Bạn vẫn có thể sửa thông tin." });
        db.Services.Remove(service);
        try { await db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "Dịch vụ vừa có lịch hẹn, không thể xóa." }); }
        // Images may be shared by another service; never delete a file here.
        return Ok(new { message = "Đã xóa dịch vụ." });
    }

    [Authorize(Roles = "Manager"), HttpPost("image")]
    [RequestSizeLimit(3 * 1024 * 1024)]
    public async Task<IActionResult> Upload([FromForm] IFormFile image, CancellationToken cancellationToken)
    {
        if (image.Length is < 12 or > 2 * 1024 * 1024) return BadRequest(new { message = "Chọn ảnh JPG, PNG hoặc WebP, tối đa 2 MB." });
        await using var source = image.OpenReadStream();
        var header = new byte[12];
        await source.ReadExactlyAsync(header, cancellationToken);
        var extension = header[0] == 0xff && header[1] == 0xd8 && header[2] == 0xff ? ".jpg"
            : header.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? ".png"
            : header.AsSpan(0, 4).SequenceEqual("RIFF"u8) && header.AsSpan(8, 4).SequenceEqual("WEBP"u8) ? ".webp" : null;
        if (extension is null) return BadRequest(new { message = "Nội dung tệp không phải ảnh JPG, PNG hoặc WebP hợp lệ." });
        var folder = Path.Combine(environment.WebRootPath, "uploads", "services");
        Directory.CreateDirectory(folder);
        var name = Guid.NewGuid().ToString("N") + extension;
        await using (var destination = new FileStream(Path.Combine(folder, name), FileMode.CreateNew, FileAccess.Write, FileShare.None))
        {
            await destination.WriteAsync(header, cancellationToken);
            await source.CopyToAsync(destination, cancellationToken);
        }
        return Ok(new { imageUrl = "/uploads/services/" + name });
    }

    private async Task<string?> ValidateAsync(ServiceRequest request, int? id, CancellationToken cancellationToken)
    {
        if (request.Name.Trim().Length < 2) return "Tên dịch vụ cần ít nhất 2 ký tự.";
        if (await db.Services.AnyAsync(item => item.Name == request.Name.Trim() && item.Id != id, cancellationToken)) return "Tên dịch vụ đã tồn tại.";
        if (request.Price != decimal.Truncate(request.Price)) return "Giá dịch vụ cần là số nguyên đồng.";
        if (!string.IsNullOrEmpty(request.ImageUrl))
        {
            if (!Regex.IsMatch(request.ImageUrl, @"^/(?:uploads/services/[a-f0-9]{32}|images/[a-zA-Z0-9_-]+)\.(?:jpg|png|webp)$")
                || !System.IO.File.Exists(Path.Combine(environment.WebRootPath, request.ImageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar))))
                return "Vui lòng tải ảnh lên trước khi lưu dịch vụ.";
        }
        return null;
    }

    private static void Apply(ServiceOffering service, ServiceRequest request)
    {
        service.Name = request.Name.Trim(); service.Price = request.Price;
        service.Description = SafeServiceHtml.Sanitize(request.Description);
        service.ImageUrl = request.ImageUrl ?? "";
    }
}
