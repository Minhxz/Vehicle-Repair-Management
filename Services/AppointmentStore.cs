using System.Globalization;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

public sealed class AppointmentStore(AutoFixDbContext db)
{
    private static readonly HashSet<string> VehicleTypes = ["Ô tô", "Xe máy", "Xe điện & hybrid", "Xe bán tải / xe tải nhẹ"];

    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone) || !Regex.IsMatch(phone, @"^[\d\s+().-]+$")) return null;
        var normalized = Regex.Replace(phone, @"[\s().-]", "");
        if (normalized.StartsWith("+84", StringComparison.Ordinal)) normalized = "0" + normalized[3..];
        else if (normalized.StartsWith("84", StringComparison.Ordinal) && normalized.Length == 11) normalized = "0" + normalized[2..];
        return Regex.IsMatch(normalized, @"^0[35789][0-9]{8}$") ? normalized : null;
    }

    public static Dictionary<string, string[]> Validate(AppointmentRequest request, bool allowEarlierToday = false)
    {
        var errors = new Dictionary<string, string[]>();
        if (string.IsNullOrWhiteSpace(request.CustomerName) || request.CustomerName.Trim().Length < 2) errors["customerName"] = ["Vui lòng nhập họ tên từ 2 ký tự."];
        if (NormalizePhone(request.Phone) is null) errors["phone"] = ["Vui lòng nhập số điện thoại di động Việt Nam hợp lệ."];
        if (!VehicleTypes.Contains(request.VehicleType.Trim())) errors["vehicleType"] = ["Vui lòng chọn loại xe trong danh sách."];
        if (string.IsNullOrWhiteSpace(request.Brand)) errors["brand"] = ["Vui lòng nhập hãng xe."];
        var now = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));
        var today = DateOnly.FromDateTime(now.DateTime);
        var dateValid = DateOnly.TryParseExact(request.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date);
        if (!dateValid || date < today || date > today.AddDays(90)) errors["date"] = ["Ngày hẹn phải trong khoảng hôm nay đến 90 ngày tới."];
        var timeValid = TimeOnly.TryParseExact(request.Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time);
        if (!timeValid || time < new TimeOnly(8, 0) || time > new TimeOnly(17, 30) || time.Minute % 30 != 0) errors["time"] = ["Chọn giờ từ 08:00 đến 17:30, theo mốc 30 phút."];
        else if (!allowEarlierToday && dateValid && date == today && time <= TimeOnly.FromDateTime(now.DateTime)) errors["time"] = ["Giờ hẹn phải sau thời điểm hiện tại."];
        return errors;
    }

    // Customer appointments: booking, lookup and cancellation.
    public async Task<Appointment> CreateAsync(AppointmentRequest request, CancellationToken cancellationToken)
    {
        var service = await db.Services.SingleOrDefaultAsync(item => item.Name == request.Service.Trim(), cancellationToken)
            ?? throw new ArgumentException("Dịch vụ không còn tồn tại. Vui lòng chọn lại.");
        var appointment = new Appointment
        {
            Reference = "AF-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(8)),
            CustomerName = request.CustomerName.Trim(), Phone = NormalizePhone(request.Phone)!,
            VehicleType = request.VehicleType.Trim(), Brand = request.Brand.Trim(), LicensePlate = request.LicensePlate?.Trim().ToUpperInvariant() ?? "",
            ServiceId = service.Id, Service = service.Name, Date = request.Date, Time = request.Time, Note = request.Note?.Trim() ?? "",
            CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
        };
        db.Appointments.Add(appointment);
        await db.SaveChangesAsync(cancellationToken);
        return appointment;
    }

    // Repair management: appointment list and status updates.
    public async Task<object> ListAsync(string? q, string? status, string? date, int page, int pageSize, CancellationToken cancellationToken)
    {
        var query = db.Appointments.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(item => item.Reference.Contains(term) || item.CustomerName.Contains(term) || item.Phone.Contains(term) || item.LicensePlate.Contains(term));
        }
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(item => item.Status == status);
        if (!string.IsNullOrWhiteSpace(date)) query = query.Where(item => item.Date == date);
        var total = await query.CountAsync(cancellationToken);
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize));
        page = Math.Min(page, totalPages);
        var appointments = await query.OrderByDescending(item => item.CreatedAt).ThenBy(item => item.Reference)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var grouped = await db.Appointments.AsNoTracking().GroupBy(item => item.Status)
            .Select(group => new { Status = group.Key, Count = group.Count() }).ToListAsync(cancellationToken);
        int Count(string value) => grouped.FirstOrDefault(item => item.Status == value)?.Count ?? 0;
        return new
        {
            appointments = appointments.Select(item => Response(item, true)), total, page, pageSize, totalPages,
            stats = new { total = grouped.Sum(item => item.Count), pending = Count(AppointmentStatus.Pending), confirmed = Count(AppointmentStatus.Confirmed), inProgress = Count(AppointmentStatus.InProgress), completed = Count(AppointmentStatus.Completed), cancelled = Count(AppointmentStatus.Cancelled) }
        };
    }

    // Public lookup and cancellation require the booking code and phone.
    public async Task<Appointment?> FindAsync(string reference, string phone, CancellationToken cancellationToken)
    {
        var normalized = NormalizePhone(phone);
        if (normalized is null || string.IsNullOrWhiteSpace(reference) || reference.Length > 40) return null;
        return await db.Appointments.AsNoTracking().SingleOrDefaultAsync(item => item.Reference == reference.Trim() && item.Phone == normalized, cancellationToken);
    }

    public async Task<Appointment?> GetAsync(string reference, CancellationToken cancellationToken) =>
        await db.Appointments.AsNoTracking().SingleOrDefaultAsync(item => item.Reference == reference.Trim(), cancellationToken);

    public async Task<(Appointment? Appointment, bool CannotCancel)> CancelAsync(string reference, string phone, CancellationToken cancellationToken)
    {
        var normalized = NormalizePhone(phone);
        if (normalized is null || string.IsNullOrWhiteSpace(reference) || reference.Length > 40) return (null, false);
        var appointment = await db.Appointments.SingleOrDefaultAsync(item => item.Reference == reference.Trim() && item.Phone == normalized, cancellationToken);
        if (appointment is null) return (null, false);
        if (!AppointmentStatus.CanTransition(appointment.Status, AppointmentStatus.Cancelled)) return (appointment, true);
        appointment.Status = AppointmentStatus.Cancelled;
        appointment.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return (appointment, false);
    }

    public async Task<(Appointment? Appointment, bool InvalidTransition)> UpdateStatusAsync(string reference, UpdateAppointmentStatusRequest request, CancellationToken cancellationToken)
    {
        var appointment = await db.Appointments.SingleOrDefaultAsync(item => item.Reference == reference.Trim(), cancellationToken);
        if (appointment is null) return (null, false);
        if (!AppointmentStatus.CanTransition(appointment.Status, request.Status)) return (appointment, true);
        appointment.Status = request.Status;
        appointment.ProcessingNote = request.ProcessingNote?.Trim() ?? appointment.ProcessingNote;
        appointment.UpdatedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return (appointment, false);
    }

    public static object Response(Appointment appointment, bool includePhone = false) => new
    {
        appointment.Reference, appointment.CustomerName, Phone = includePhone ? appointment.Phone : null,
        MaskedPhone = appointment.Phone.Length >= 4 ? "******" + appointment.Phone[^4..] : "",
        appointment.VehicleType, appointment.Brand, appointment.LicensePlate, appointment.ServiceId, appointment.Service,
        appointment.Date, appointment.Time, appointment.Note, appointment.Status, appointment.ProcessingNote,
        StatusLabel = AppointmentStatus.Label(appointment.Status), appointment.CreatedAt, appointment.UpdatedAt,
        Stages = Stages(appointment.Status)
    };

    private static RepairStage[] Stages(string status)
    {
        var progress = status switch { AppointmentStatus.Confirmed => 1, AppointmentStatus.InProgress => 2, AppointmentStatus.Completed => 4, _ => 0 };
        string State(int index) => status == AppointmentStatus.Cancelled ? (index == 0 ? "cancelled" : "upcoming") : index < progress ? "completed" : index == progress ? "current" : "upcoming";
        return [
            new(status == AppointmentStatus.Cancelled ? "Lịch hẹn đã hủy" : "Xác nhận lịch hẹn", "Cửa hàng xác nhận lịch và nhu cầu của bạn.", State(0)),
            new("Tiếp nhận xe", "Kiểm tra xe và thống nhất công việc.", State(1)),
            new("Đang sửa chữa", "Thực hiện dịch vụ đã thống nhất.", State(2)),
            new("Hoàn thành", "Kiểm tra và bàn giao xe.", State(3))
        ];
    }
}
