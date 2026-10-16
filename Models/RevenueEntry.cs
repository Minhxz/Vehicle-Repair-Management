using System.ComponentModel.DataAnnotations;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

// One completed appointment can have one receipt. No invoice or payment integration.
public sealed class RevenueEntry
{
    [Key, MaxLength(40)] public string Reference { get; set; } = "";
    public decimal Amount { get; set; }
    public DateOnly PaidOn { get; set; }
    [MaxLength(300)] public string Note { get; set; } = "";
}

public sealed class CreateRevenueRequest
{
    [Required(ErrorMessage = "Vui lòng chọn lịch hẹn đã hoàn thành."), StringLength(40)]
    public string Reference { get; set; } = "";
    [Range(typeof(decimal), "1", "100000000", ErrorMessage = "Số tiền phải từ 1 đến 100 triệu đồng.")]
    public decimal Amount { get; set; }
    [Required(ErrorMessage = "Vui lòng chọn ngày thu tiền.")]
    public DateOnly? PaidOn { get; set; }
    [StringLength(300, ErrorMessage = "Ghi chú tối đa 300 ký tự.")]
    public string? Note { get; set; }
}

public sealed class UpdateRevenueRequest
{
    [Range(typeof(decimal), "1", "100000000", ErrorMessage = "Số tiền phải từ 1 đến 100 triệu đồng.")]
    public decimal Amount { get; set; }
    [Required(ErrorMessage = "Vui lòng chọn ngày thu tiền.")]
    public DateOnly? PaidOn { get; set; }
    [StringLength(300, ErrorMessage = "Ghi chú tối đa 300 ký tự.")]
    public string? Note { get; set; }
}
