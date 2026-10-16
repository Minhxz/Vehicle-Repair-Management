using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Route("api/appointments")]
public sealed class BookingController(AppointmentStore store) : ControllerBase
{
    [HttpPost, EnableRateLimiting("public-api")]
    public async Task<IActionResult> Create(AppointmentRequest request, CancellationToken cancellationToken)
    {
        var errors = AppointmentStore.Validate(request, User.IsInRole("Manager"));
        if (errors.Count != 0) return BadRequest(new { message = "Vui lòng kiểm tra thông tin đặt lịch.", errors });
        try
        {
            var appointment = await store.CreateAsync(request, cancellationToken);
            return StatusCode(StatusCodes.Status201Created, AppointmentStore.Response(appointment));
        }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
        catch (DbUpdateException) { return Conflict(new { message = "Dịch vụ vừa thay đổi. Vui lòng tải lại và đặt lịch lại." }); }
    }
}
