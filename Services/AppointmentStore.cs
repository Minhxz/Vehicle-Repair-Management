using System.Globalization;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;
using Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Services;

public sealed class AppointmentStore(IWebHostEnvironment environment)
{
    private readonly string _directory = Path.Combine(environment.ContentRootPath, "App_Data");
    private readonly SemaphoreSlim _gate = new(1, 1);
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private static readonly HashSet<string> VehicleTypes = ["Ô tô", "Xe máy", "Xe điện & hybrid", "Xe bán tải / xe tải nhẹ"];
    private static readonly HashSet<string> Services = ["Bảo dưỡng định kỳ", "Sửa chữa tổng quát", "Chẩn đoán điện & điện tử", "Lốp & hệ thống phanh", "Chăm sóc & làm đẹp xe", "Kiểm tra tổng thể"];

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
        if (!Services.Contains(request.Service.Trim())) errors["service"] = ["Vui lòng chọn dịch vụ trong danh sách."];

        var now = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7));
        var today = DateOnly.FromDateTime(now.DateTime);
        var dateValid = DateOnly.TryParseExact(request.Date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date);
        if (!dateValid || date < today || date > today.AddDays(90)) errors["date"] = ["Ngày hẹn phải trong khoảng hôm nay đến 90 ngày tới."];
        var timeValid = TimeOnly.TryParseExact(request.Time, "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var time);
        if (!timeValid || time < new TimeOnly(8, 0) || time > new TimeOnly(17, 30) || time.Minute % 30 != 0) errors["time"] = ["Chọn giờ từ 08:00 đến 17:30, theo mốc 30 phút."];
        else if (!allowEarlierToday && dateValid && date == today && time <= TimeOnly.FromDateTime(now.DateTime)) errors["time"] = ["Giờ hẹn phải sau thời điểm hiện tại."];
        return errors;
    }

    public async Task<Appointment> CreateAsync(AppointmentRequest request, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var appointments = await ReadAsync(cancellationToken);
            string reference;
            do { reference = "AF-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(6)); }
            while (appointments.Any(item => item.Reference == reference));
            var appointment = new Appointment
            {
                Reference = reference, CustomerName = request.CustomerName.Trim(), Phone = NormalizePhone(request.Phone)!,
                VehicleType = request.VehicleType.Trim(), Brand = request.Brand.Trim(), LicensePlate = request.LicensePlate?.Trim().ToUpperInvariant() ?? "",
                Service = request.Service.Trim(), Date = request.Date, Time = request.Time, Note = request.Note?.Trim() ?? "",
                CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow
            };
            appointments.Add(appointment);
            await SaveAsync(appointments, cancellationToken);
            return appointment;
        }
        finally { _gate.Release(); }
    }

    public async Task<List<Appointment>> ListAsync(CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try { return (await ReadAsync(cancellationToken)).OrderByDescending(item => item.CreatedAt).ToList(); }
        finally { _gate.Release(); }
    }

    public async Task<Appointment?> FindAsync(string reference, string phone, CancellationToken cancellationToken)
    {
        var normalizedPhone = NormalizePhone(phone);
        if (normalizedPhone is null || string.IsNullOrWhiteSpace(reference) || reference.Length > 40) return null;
        await _gate.WaitAsync(cancellationToken);
        try
        {
            return (await ReadAsync(cancellationToken)).FirstOrDefault(item =>
                item.Reference.Equals(reference.Trim(), StringComparison.OrdinalIgnoreCase) && item.Phone == normalizedPhone);
        }
        finally { _gate.Release(); }
    }

    public async Task<(Appointment? Appointment, bool CannotCancel)> CancelAsync(string reference, string phone, CancellationToken cancellationToken)
    {
        var normalizedPhone = NormalizePhone(phone);
        if (normalizedPhone is null || reference.Length > 40) return (null, false);
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var appointments = await ReadAsync(cancellationToken);
            var appointment = appointments.FirstOrDefault(item => item.Reference.Equals(reference.Trim(), StringComparison.OrdinalIgnoreCase) && item.Phone == normalizedPhone);
            if (appointment is null) return (null, false);
            if (appointment.Status is AppointmentStatus.InProgress or AppointmentStatus.Completed) return (appointment, true);
            appointment.Status = AppointmentStatus.Cancelled;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;
            await SaveAsync(appointments, cancellationToken);
            return (appointment, false);
        }
        finally { _gate.Release(); }
    }

    public async Task<Appointment?> UpdateStatusAsync(string reference, string status, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var appointments = await ReadAsync(cancellationToken);
            var appointment = appointments.FirstOrDefault(item => item.Reference.Equals(reference.Trim(), StringComparison.OrdinalIgnoreCase));
            if (appointment is null) return null;
            appointment.Status = status;
            appointment.UpdatedAt = DateTimeOffset.UtcNow;
            await SaveAsync(appointments, cancellationToken);
            return appointment;
        }
        finally { _gate.Release(); }
    }

    public static object Response(Appointment appointment, bool includePhone = false) => new
    {
        appointment.Reference, appointment.CustomerName,
        Phone = includePhone ? appointment.Phone : null,
        MaskedPhone = appointment.Phone.Length >= 4 ? "******" + appointment.Phone[^4..] : "",
        appointment.VehicleType, appointment.Brand, appointment.LicensePlate, appointment.Service,
        appointment.Date, appointment.Time, appointment.Note, appointment.Status,
        StatusLabel = AppointmentStatus.Label(appointment.Status), appointment.CreatedAt, appointment.UpdatedAt, appointment.JobCard,
        Stages = Stages(appointment.Status)
    };

    public async Task<Appointment?> SaveJobCardAsync(string reference, JobCardRequest request, CancellationToken cancellationToken)
    {
        await _gate.WaitAsync(cancellationToken);
        try
        {
            var appointments = await ReadAsync(cancellationToken);
            var appointment = appointments.FirstOrDefault(item => item.Reference.Equals(reference.Trim(), StringComparison.OrdinalIgnoreCase));
            if (appointment is null) return null;
            var items = request.Items.Select(item => new JobCardItem
            {
                Name = item.Name.Trim(), Type = item.Type, Quantity = item.Quantity, UnitPrice = item.UnitPrice,
                LineTotal = decimal.Round(item.Quantity * item.UnitPrice, 0, MidpointRounding.AwayFromZero)
            }).ToList();
            var subtotal = items.Sum(item => item.LineTotal);
            var discount = decimal.Round(request.Discount, 0, MidpointRounding.AwayFromZero);
            if (discount > subtotal) throw new ArgumentException("Giảm giá không được vượt tổng tiền hạng mục.");
            appointment.JobCard = new JobCard
            {
                Diagnosis = request.Diagnosis?.Trim() ?? "", Technician = request.Technician?.Trim() ?? "", Items = items,
                Subtotal = subtotal, Discount = discount, Total = subtotal - discount, PaymentStatus = request.PaymentStatus, UpdatedAt = DateTimeOffset.UtcNow
            };
            appointment.UpdatedAt = DateTimeOffset.UtcNow;
            await SaveAsync(appointments, cancellationToken);
            return appointment;
        }
        finally { _gate.Release(); }
    }

    private static RepairStage[] Stages(string status)
    {
        var progress = status switch { AppointmentStatus.Confirmed => 1, AppointmentStatus.InProgress => 2, AppointmentStatus.Completed => 4, _ => 0 };
        string State(int index) => status == AppointmentStatus.Cancelled ? (index == 0 ? "cancelled" : "upcoming") : index < progress ? "completed" : index == progress ? "current" : "upcoming";
        return [
            new(status == AppointmentStatus.Cancelled ? "Lịch hẹn đã hủy" : "Xác nhận lịch hẹn", "Cố vấn dịch vụ liên hệ xác nhận lịch và nhu cầu của bạn.", State(0)),
            new("Tiếp nhận xe", "Kiểm tra ban đầu và thống nhất các hạng mục cần thực hiện.", State(1)),
            new("Bảo dưỡng & sửa chữa", "Kỹ thuật viên thực hiện công việc đã được thống nhất.", State(2)),
            new("Bàn giao xe", "Kiểm tra chất lượng và bàn giao xe cho khách hàng.", State(3))
        ];
    }

    private async Task<List<Appointment>> ReadAsync(CancellationToken cancellationToken)
    {
        var path = Path.Combine(_directory, "appointments.json");
        if (!File.Exists(path)) return [];
        await using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, true);
        return await JsonSerializer.DeserializeAsync<List<Appointment>>(stream, JsonOptions, cancellationToken)
            ?? throw new InvalidDataException("Appointment data could not be read.");
    }

    private async Task SaveAsync(List<Appointment> appointments, CancellationToken cancellationToken)
    {
        Directory.CreateDirectory(_directory);
        var path = Path.Combine(_directory, "appointments.json");
        var temporaryPath = Path.Combine(_directory, $"appointments-{Guid.NewGuid():N}.tmp");
        try
        {
            await using (var stream = new FileStream(temporaryPath, FileMode.CreateNew, FileAccess.Write, FileShare.None, 4096, true))
            {
                await JsonSerializer.SerializeAsync(stream, appointments, JsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
            }
            File.Move(temporaryPath, path, true);
        }
        finally { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); }
    }
}
