using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Controllers;

[ApiController, Route("api/appointments")]
public sealed class AppointmentsController(AppointmentStore store) : ControllerBase
{
    [HttpPost, EnableRateLimiting("public-api")]
    public async Task<IActionResult> Create(AppointmentRequest request, CancellationToken cancellationToken)
    {
        var errors = AppointmentStore.Validate(request, User.Identity?.IsAuthenticated == true);
        if (errors.Count != 0) return BadRequest(new { message = "Vui lòng kiểm tra thông tin đặt lịch.", errors });
        var appointment = await store.CreateAsync(request, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, AppointmentStore.Response(appointment));
    }

    [Authorize, HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var appointments = await store.ListAsync(cancellationToken);
        return Ok(new
        {
            appointments = appointments.Select(item => AppointmentStore.Response(item, true)),
            stats = new
            {
                total = appointments.Count,
                pending = appointments.Count(item => item.Status == AppointmentStatus.Pending),
                confirmed = appointments.Count(item => item.Status == AppointmentStatus.Confirmed),
                inProgress = appointments.Count(item => item.Status == AppointmentStatus.InProgress),
                completed = appointments.Count(item => item.Status == AppointmentStatus.Completed),
                cancelled = appointments.Count(item => item.Status == AppointmentStatus.Cancelled)
            }
        });
    }

    [HttpPost("{reference}/cancel"), EnableRateLimiting("public-api")]
    public async Task<IActionResult> Cancel(string reference, CancelAppointmentRequest request, CancellationToken cancellationToken)
    {
        var result = await store.CancelAsync(reference, request.Phone, cancellationToken);
        if (result.Appointment is null) return NotFound(new { message = "Không tìm thấy lịch hẹn khớp mã và số điện thoại." });
        if (result.CannotCancel) return Conflict(new { message = "Xe đã được tiếp nhận sửa chữa. Vui lòng liên hệ cửa hàng để thay đổi lịch." });
        return Ok(AppointmentStore.Response(result.Appointment));
    }

    [Authorize, HttpPut("{reference}/status")]
    public async Task<IActionResult> UpdateStatus(string reference, UpdateAppointmentStatusRequest request, CancellationToken cancellationToken)
    {
        if (!AppointmentStatus.All.Contains(request.Status)) return BadRequest(new { message = "Trạng thái không hợp lệ." });
        var appointment = await store.UpdateStatusAsync(reference, request.Status, cancellationToken);
        return appointment is null ? NotFound(new { message = "Không tìm thấy lịch hẹn." }) : Ok(AppointmentStore.Response(appointment, true));
    }

    [Authorize, HttpPut("{reference}/job-card")]
    public async Task<IActionResult> SaveJobCard(string reference, JobCardRequest request, CancellationToken cancellationToken)
    {
        if (request.PaymentStatus is not ("Unpaid" or "Paid") || request.Items.Any(item => item.Type is not ("Part" or "Service")))
            return BadRequest(new { message = "Loại hạng mục hoặc trạng thái thanh toán không hợp lệ." });
        try
        {
            var appointment = await store.SaveJobCardAsync(reference, request, cancellationToken);
            return appointment is null ? NotFound(new { message = "Không tìm thấy lịch hẹn." }) : Ok(AppointmentStore.Response(appointment, true));
        }
        catch (ArgumentException error) { return BadRequest(new { message = error.Message }); }
    }
}
