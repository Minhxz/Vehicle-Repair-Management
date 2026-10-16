using System.ComponentModel.DataAnnotations;

namespace Quản_Lý_Cửa_Hàng_Sửa_Xe.Models;

public sealed class ServiceOffering
{
    public int Id { get; set; }
    [Required, MaxLength(120)] public string Name { get; set; } = "";
    public decimal Price { get; set; }
    [MaxLength(36000)] public string Description { get; set; } = "";
    [MaxLength(300)] public string ImageUrl { get; set; } = "";
}

public sealed class ServiceRequest
{
    [Required(ErrorMessage = "Vui lòng nhập tên dịch vụ."), StringLength(120, MinimumLength = 2)]
    public string Name { get; set; } = "";
    [Range(typeof(decimal), "0", "100000000", ErrorMessage = "Giá phải từ 0 đến 100 triệu đồng.")]
    public decimal Price { get; set; }
    [StringLength(6000, ErrorMessage = "Mô tả tối đa 6.000 ký tự.")]
    public string Description { get; set; } = "";
    [StringLength(300)] public string ImageUrl { get; set; } = "";
}
