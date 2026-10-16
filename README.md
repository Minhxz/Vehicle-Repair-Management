# AutoFix — Quản lý cửa hàng sửa xe cơ bản

ASP.NET Core MVC .NET 10, EF Core và SQL Server. Phạm vi phù hợp bài tập sinh viên: **dịch vụ, lịch hẹn khách hàng, xử lý sửa chữa, kho phụ tùng, doanh thu**. Đăng nhập/phân quyền Manager/Customer, cookie và CSRF là phần nền dùng chung.

## Chạy ứng dụng

Cần .NET 10 SDK và SQL Server LocalDB (`MSSQLLocalDB`), hoặc SQL Server có quyền tạo/nâng cấp bảng.

```powershell
dotnet restore .\Vehicle-Repair-Management.csproj
dotnet build .\Vehicle-Repair-Management.csproj
dotnet run --project .\Vehicle-Repair-Management.csproj --launch-profile http
```

Địa chỉ: **http://localhost:5240**. Chuỗi kết nối trong `appsettings.json` dùng CSDL `AutoFixCompact`; có thể đổi bằng `ConnectionStrings__AutoFix`.

| Tài khoản Development | Mật khẩu | Quyền |
| --- | --- | --- |
| admin | 123 | Manager — quản lý cửa hàng |
| khach | 123 | Customer — đặt/tra cứu lịch, không vào được quản trị |

Khách chưa đăng nhập vẫn có thể đặt lịch và tra cứu bằng mã + SĐT. Mật khẩu lưu dạng băm; không có màn hình đăng ký/quản lý tài khoản riêng. Production dùng `AutoFix__AdminUsername` và `AutoFix__AdminPassword` để tạo tài khoản đầu tiên; biến môi trường không ghi đè mật khẩu đã lưu.

## Phạm vi đơn giản

| Trang | Công việc |
| --- | --- |
| `/` | Dịch vụ, giá tham khảo, quy trình |
| `/Home/Booking` | Đặt lịch, nhận mã, lưu/khôi phục/xóa nháp session |
| `/Home/Tracking` | Tra cứu trạng thái/ghi chú, hủy lịch chưa bắt đầu sửa |
| `/Management/Services` | CRUD dịch vụ, upload ảnh, editor mô tả |
| `/Management/Workflow` | Tìm/lọc/phân trang lịch hẹn, tiếp nhận và cập nhật tiến độ |
| `/Management/Inventory` | CRUD phụ tùng, mã/tên/đơn vị/tồn/đơn giá; tìm kiếm, phân trang |
| `/Management/Analytics` | Sổ tiền đã thu; lọc khoảng ngày; tổng hôm nay, tháng này, kỳ đang lọc |

**Kho:** người quản lý nhập số lượng tồn hiện tại khi thêm/sửa. Không có nhà cung cấp, phiếu nhập/xuất hoặc tự trừ kho theo lịch sửa.

**Doanh thu:** chỉ ghi nhận khi lịch đã Completed, một khoản thu cho mỗi lịch. Người quản lý nhập tổng tiền thực thu và ngày thu; có thể sửa số tiền/ngày/ghi chú. Không có hóa đơn nhiều dòng, thu nhiều đợt, chi phí/lợi nhuận hay cổng thanh toán. Doanh thu không tự lấy giá tham khảo của dịch vụ. Mặc định hiển thị tháng hiện tại đến hôm nay; thẻ hôm nay/tháng này độc lập bộ lọc.

## CSDL và dữ liệu cũ

Có **5 bảng**: `Users`, `Services`, `Appointments`, `InventoryItems`, `RevenueEntries`. `RevenueEntries.Reference` là khóa chính và khóa ngoại tới lịch hẹn, giúp ngăn tính trùng khoản thu.

Lần đầu chạy, ứng dụng tạo CSDL và danh mục dịch vụ mẫu. Với bản cũ có 3 bảng, khởi động sẽ thêm hai bảng kho/doanh thu còn thiếu trong transaction; không xóa hoặc tạo lại các bảng cũ. SQL tương ứng nằm trong [database/AutoFixCompact.sql](database/AutoFixCompact.sql), chạy bằng SSMS hoặc công cụ SQL Server phù hợp.

`App_Data/appointments.json` được nhập một lần; file gốc được giữ lại. Tắt nhập bằng `AutoFix__ImportLegacyJson=false` khi test. JSON kho/phiếu tính tiền từ bản ERP cũ được giữ nguyên và không tự chuyển sang cấu trúc mới. Kho và doanh thu không khởi tạo dữ liệu giả.

Ảnh upload JPG/PNG/WebP tối đa 2 MB lưu tại `wwwroot/uploads/services/`. Session bản nháp hết hạn sau 30 phút không hoạt động và mất khi ứng dụng khởi động lại. Culture hỗ trợ vi-VN/en-US; giao diện hiện bằng tiếng Việt.

## Phân công và kiểm thử

- [Phân công 5 người](docs/PHAN_CONG_5_NGUOI.md): mỗi người một chức năng, file/API và tiêu chí nghiệm thu.
- [Đối chiếu yêu cầu đề](docs/DOI_CHIEU_YEU_CAU.md): nơi thể hiện từng kỹ thuật.
- [Smoke API](tests/smoke.ps1) và [kiểm tra upload](tests/upload.ps1): chỉ chạy trên ứng dụng nối CSDL test riêng, tắt import JSON.

Khi ứng dụng test đã chạy ở cổng 5251:

```powershell
.\tests\smoke.ps1 -BaseUrl http://localhost:5251
.\tests\upload.ps1 -BaseUrl http://localhost:5251
```

Đã kiểm tra bản có kho/doanh thu: build 0 lỗi, 0 cảnh báo; 120 kiểm tra API và 4 kiểm tra upload đạt. SQL script và nâng cấp từ 3 lên 5 bảng đã chạy thử lặp lại, giữ nguyên dữ liệu cũ. Các tài liệu hướng dẫn không thay thế báo cáo môn học 15–35 trang.

Trên máy hiện tại, metadata điều khiển `MSSQLLocalDB` có lúc báo Stopped dù SQL vẫn chạy. Phiên kiểm tra sử dụng kết nối trực tiếp tới pipe đang hoạt động qua biến môi trường riêng của process; cấu hình kết nối chuẩn trong project vẫn giữ dạng LocalDB. Nếu gặp lỗi khởi động instance, kiểm tra SQL Server/LocalDB của máy trước khi chạy ứng dụng.
