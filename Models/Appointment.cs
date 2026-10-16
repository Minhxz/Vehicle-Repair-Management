using System.ComponentModel.DataAnnotations;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

public sealed class AppointmentRequest
{
    [Required(ErrorMessage = "Vui lòng nhập họ tên."), StringLength(100, MinimumLength = 2)]
    public string CustomerName { get; set; } = "";
    [Required(ErrorMessage = "Vui lòng nhập số điện thoại."), StringLength(30)]
    public string Phone { get; set; } = "";
    [Required, StringLength(50)] public string VehicleType { get; set; } = "";
    [Required, StringLength(80)] public string Brand { get; set; } = "";
    [StringLength(20)] public string? LicensePlate { get; set; }
    [Required, StringLength(120)] public string Service { get; set; } = "";
    [Required, StringLength(10)] public string Date { get; set; } = "";
    [Required, StringLength(5)] public string Time { get; set; } = "";
    [StringLength(1000, ErrorMessage = "Ghi chú tối đa 1.000 ký tự.")]
    public string? Note { get; set; }
}

public sealed class Appointment
{
    [Key, MaxLength(40)] public string Reference { get; set; } = "";
    [MaxLength(100)] public string CustomerName { get; set; } = "";
    [MaxLength(10)] public string Phone { get; set; } = "";
    [MaxLength(50)] public string VehicleType { get; set; } = "";
    [MaxLength(80)] public string Brand { get; set; } = "";
    [MaxLength(20)] public string LicensePlate { get; set; } = "";
    public int ServiceId { get; set; }
    // Keep the booked name even if the service catalogue is renamed later.
    [MaxLength(120)] public string Service { get; set; } = "";
    [MaxLength(10)] public string Date { get; set; } = "";
    [MaxLength(5)] public string Time { get; set; } = "";
    [MaxLength(1000)] public string Note { get; set; } = "";
    [MaxLength(2000)] public string ProcessingNote { get; set; } = "";
    [MaxLength(20)] public string Status { get; set; } = AppointmentStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    [Timestamp] public byte[] RowVersion { get; set; } = [];
}

public static class AppointmentStatus
{
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
    public static readonly HashSet<string> All = [Pending, Confirmed, InProgress, Completed, Cancelled];
    public static bool CanTransition(string current, string next) => current == next || ((current, next) switch
    {
        (Pending, Confirmed or Cancelled) => true,
        (Confirmed, InProgress or Cancelled) => true,
        (InProgress, Completed) => true,
        _ => false
    });
    public static string Label(string status) => status switch
    {
        Confirmed => "Đã xác nhận", InProgress => "Đang sửa chữa",
        Completed => "Đã hoàn thành", Cancelled => "Đã hủy", _ => "Chờ xác nhận"
    };
}

public sealed record RepairStage(string Title, string Description, string State);
public sealed class CancelAppointmentRequest
{
    [Required, StringLength(30)] public string Phone { get; set; } = "";
}
public sealed class UpdateAppointmentStatusRequest
{
    [Required, StringLength(20)] public string Status { get; set; } = "";
    [StringLength(2000, ErrorMessage = "Ghi chú xử lý tối đa 2.000 ký tự.")]
    public string? ProcessingNote { get; set; }
}
public sealed class ManagerLoginRequest
{
    [Required, StringLength(100)] public string Username { get; set; } = "";
    [Required, StringLength(200)] public string Password { get; set; } = "";
}
