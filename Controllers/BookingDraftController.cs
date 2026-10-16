using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

// A draft belongs to this browser session and expires after 30 minutes of inactivity.
[ApiController, Route("api/appointments/draft")]
public sealed class BookingDraftController : ControllerBase
{
    private const string SessionKey = "BookingDraft";

    [HttpGet, ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
    public IActionResult Get()
    {
        var json = HttpContext.Session.GetString(SessionKey);
        return Ok(new { draft = json is null ? null : JsonSerializer.Deserialize<BookingDraft>(json) });
    }

    [HttpPut]
    public IActionResult Save(BookingDraft draft)
    {
        HttpContext.Session.SetString(SessionKey, JsonSerializer.Serialize(draft));
        return Ok(new { message = "Đã lưu bản nháp trong phiên làm việc này." });
    }

    [HttpDelete]
    public IActionResult Clear()
    {
        HttpContext.Session.Remove(SessionKey);
        return NoContent();
    }
}

public sealed class BookingDraft
{
    [StringLength(100)] public string? CustomerName { get; set; }
    [StringLength(30)] public string? Phone { get; set; }
    [StringLength(50)] public string? VehicleType { get; set; }
    [StringLength(80)] public string? Brand { get; set; }
    [StringLength(20)] public string? LicensePlate { get; set; }
    [StringLength(120)] public string? Service { get; set; }
    [StringLength(10)] public string? Date { get; set; }
    [StringLength(5)] public string? Time { get; set; }
    [StringLength(1000)] public string? Note { get; set; }
}
