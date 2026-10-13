using System.ComponentModel.DataAnnotations;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

public sealed class AppointmentRequest
{
    [Required(ErrorMessage = "Vui lòng nhập họ tên."), StringLength(100, MinimumLength = 2, ErrorMessage = "Họ tên cần từ 2 đến 100 ký tự.")]
    public string CustomerName { get; set; } = "";

    [Required(ErrorMessage = "Vui lòng nhập số điện thoại."), StringLength(30)]
    public string Phone { get; set; } = "";

    [Required(ErrorMessage = "Vui lòng chọn loại xe."), StringLength(50)]
    public string VehicleType { get; set; } = "";

    [Required(ErrorMessage = "Vui lòng nhập hãng xe."), StringLength(80)]
    public string Brand { get; set; } = "";

    [StringLength(20, ErrorMessage = "Biển số tối đa 20 ký tự.")]
    public string? LicensePlate { get; set; }

    [Required(ErrorMessage = "Vui lòng chọn dịch vụ."), StringLength(80)]
    public string Service { get; set; } = "";

    [Required(ErrorMessage = "Vui lòng chọn ngày hẹn."), StringLength(10)]
    public string Date { get; set; } = "";

    [Required(ErrorMessage = "Vui lòng chọn giờ hẹn."), StringLength(5)]
    public string Time { get; set; } = "";

    [StringLength(1000, ErrorMessage = "Ghi chú tối đa 1.000 ký tự.")]
    public string? Note { get; set; }
}

public sealed class Appointment
{
    public string Reference { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string VehicleType { get; set; } = "";
    public string Brand { get; set; } = "";
    public string LicensePlate { get; set; } = "";
    public string Service { get; set; } = "";
    public string Date { get; set; } = "";
    public string Time { get; set; } = "";
    public string Note { get; set; } = "";
    public string Status { get; set; } = AppointmentStatus.Pending;
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
    public JobCard? JobCard { get; set; }
}

public static class AppointmentStatus
{
    public const string Pending = "Pending";
    public const string Confirmed = "Confirmed";
    public const string InProgress = "InProgress";
    public const string Completed = "Completed";
    public const string Cancelled = "Cancelled";
    public static readonly HashSet<string> All = [Pending, Confirmed, InProgress, Completed, Cancelled];

    public static string Label(string status) => status switch
    {
        Confirmed => "Đã xác nhận",
        InProgress => "Đang sửa chữa",
        Completed => "Đã hoàn thành",
        Cancelled => "Đã hủy",
        _ => "Chờ xác nhận"
    };
}

public sealed record RepairStage(string Title, string Description, string State);

public sealed class CancelAppointmentRequest
{
    [Required(ErrorMessage = "Vui lòng nhập số điện thoại."), StringLength(30)]
    public string Phone { get; set; } = "";
}

public sealed class UpdateAppointmentStatusRequest
{
    [Required(ErrorMessage = "Vui lòng chọn trạng thái."), StringLength(20)]
    public string Status { get; set; } = "";
}

public sealed class ManagerLoginRequest
{
    [Required, StringLength(100)]
    public string Username { get; set; } = "";
    [Required, StringLength(200)]
    public string Password { get; set; } = "";
}

public sealed class JobCardRequest
{
    [StringLength(2000, ErrorMessage = "Chẩn đoán tối đa 2.000 ký tự.")]
    public string? Diagnosis { get; set; }
    [StringLength(100, ErrorMessage = "Tên kỹ thuật viên tối đa 100 ký tự.")]
    public string? Technician { get; set; }
    [Required, MaxLength(50, ErrorMessage = "Mỗi phiếu có tối đa 50 hạng mục.")]
    public List<JobCardItemRequest> Items { get; set; } = [];
    [Range(typeof(decimal), "0", "1000000000", ErrorMessage = "Giảm giá phải từ 0 đến 1 tỷ đồng.")]
    public decimal Discount { get; set; }
    [Required, StringLength(20)]
    public string PaymentStatus { get; set; } = "Unpaid";
}

public sealed class JobCardItemRequest
{
    [Required, StringLength(120)]
    public string Name { get; set; } = "";
    [Required, StringLength(10)]
    public string Type { get; set; } = "Service";
    [Range(typeof(decimal), "0.01", "100000", ErrorMessage = "Số lượng phải lớn hơn 0.")]
    public decimal Quantity { get; set; }
    [Range(typeof(decimal), "0", "1000000000", ErrorMessage = "Đơn giá không hợp lệ.")]
    public decimal UnitPrice { get; set; }
}

public sealed class JobCard
{
    public string Diagnosis { get; set; } = "";
    public string Technician { get; set; } = "";
    public List<JobCardItem> Items { get; set; } = [];
    public decimal Subtotal { get; set; }
    public decimal Discount { get; set; }
    public decimal Total { get; set; }
    public string PaymentStatus { get; set; } = "Unpaid";
    public DateTimeOffset UpdatedAt { get; set; }
}

public sealed class JobCardItem
{
    public string Name { get; set; } = "";
    public string Type { get; set; } = "Service";
    public decimal Quantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}
