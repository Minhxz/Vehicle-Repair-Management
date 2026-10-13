# AutoFix — Quản lý cửa hàng sửa xe

Website bài tập lớn ASP.NET Core MVC (.NET 10), tham khảo phong cách giao diện VinFast và tích hợp mẫu AutoFix ERP do người dùng cung cấp. Giao diện tiếng Việt, hỗ trợ ô tô, xe máy, xe điện / hybrid và xe bán tải / tải nhẹ.

## Chạy ứng dụng

Mở solution `Vehicle-Repair-Management.slnx` trong Visual Studio hỗ trợ .NET 10 và nhấn F5 (profile http).

Hoặc chạy PowerShell từ thư mục `Desktop/BTL-LTW/Vehicle-Repair-Management`:

```powershell
dotnet run --project ".\Vehicle-Repair-Management.csproj" --launch-profile http
```

Truy cập **http://localhost:5240**.

Tài khoản tạm thời ở môi trường Development: **admin / 123**.
Đăng nhập thành công chuyển tới **/Management/Workflow**.

## Các trang khách hàng

- `/`: trang chủ.
- `/Home/Services`: dịch vụ, hộp thoại chi tiết.
- `/Home/Vehicles`: chọn 4 nhóm xe.
- `/Home/Process`: quy trình tiếp nhận / sửa chữa.
- `/Home/Booking`: đặt lịch, nhận mã và sao chép mã.
- `/Home/Tracking`: tra cứu bằng mã + điện thoại, hủy lịch đang chờ / đã xác nhận.
- `/Home/Privacy`: thông tin mô phỏng và dữ liệu được lưu.
- `/Account/Login`: đăng nhập cửa hàng.

## Đúng 4 view quản lý độc lập

| View | URL | Chức năng |
| --- | --- | --- |
| Workflow.cshtml | /Management/Workflow | Kanban tiến độ, tìm kiếm, tiếp nhận xe, chi tiết, tổng hợp phân công kỹ thuật viên |
| JobCard.cshtml | /Management/JobCard | Chẩn đoán, kiểm tra, nhân công/phụ tùng, tính tiền VND, giảm giá, thanh toán, lưu và in phiếu |
| Inventory.cshtml | /Management/Inventory | Tạo/sửa phụ tùng, tìm kiếm/lọc, cảnh báo tồn thấp, xuất CSV |
| Analytics.cshtml | /Management/Analytics | Lọc kỳ báo cáo, thống kê dữ liệu đã lưu, biểu đồ, xuất CSV |

Phần kỹ thuật viên từ mẫu HTML được đặt trong trang Workflow để giữ đúng 4 trang quản lý. Không khởi tạo khách hàng hoặc doanh thu giả; các trang trống hiển thị hướng dẫn.

## Cấu trúc mã nguồn

```text
Vehicle-Repair-Management/
├── Vehicle-Repair-Management.slnx
├── Vehicle-Repair-Management.csproj
├── Controllers/             # Home, Account, Management và các API
├── Models/                  # DTO đặt lịch, phiếu sửa chữa, tồn kho
├── Services/                # Đọc/ghi JSON, kiểm tra dữ liệu, tính tổng tiền
├── Views/
│   ├── Home/                # View từng trang + partial từng section trang chủ
│   ├── Account/             # Login.cshtml
│   ├── Management/          # 4 view riêng biệt
│   └── Shared/              # Layout khách hàng, header/footer, layout quản lý
├── wwwroot/
│   ├── css/                 # site.css, login.css, management.css
│   ├── js/                  # JS theo chức năng/trang
│   ├── images/              # Ảnh lưu cục bộ + ATTRIBUTION.txt
│   └── lib/bootstrap/       # Bootstrap có sẵn, dùng cho ERP
├── docs/screenshots/        # Ảnh giao diện đã kiểm tra
├── App_Data/                # Dữ liệu được tạo khi sử dụng; không đưa vào Git
└── Program.cs               # MVC, cookie auth, giới hạn yêu cầu, DI
```

Trang chủ ghép các partial `_Hero`, `_QuickActions`, `_VehicleTypes`, `_Services`, `_Process`, `_Booking`, `_Faq`. Mỗi section có file riêng; các trang chi tiết tái sử dụng partial. JavaScript đặt lịch, tra cứu, dòng xe, dịch vụ, đăng nhập và 4 trang ERP được tách riêng.

## Dữ liệu và phạm vi hiện tại

- Dữ liệu lưu bền vững trong JSON dưới App_Data, ghi tuần tự trong một tiến trình và thay file nguyên tử.
- Phiếu sửa chữa tính tổng tiền tại server; đơn giá VND, giảm giá theo số tiền.
- Kho phụ tùng và hạng mục trên phiếu hiện được quản lý độc lập; lưu phiếu không tự trừ tồn kho.
- Báo cáo lấy dữ liệu phiếu đã lưu, có phân biệt thanh toán; không tích hợp thanh toán bên ngoài.
- Chưa dùng SQL Server/Entity Framework, chưa gửi SMS/email hoặc kết nối xưởng thực.
- Tài khoản tạm thời chỉ hoạt động trong Development. Nếu chạy Production, cấu hình `AutoFix__AdminUsername` và `AutoFix__AdminPassword` ở môi trường; không lưu mật khẩu vào mã nguồn.
- Ảnh sử dụng từ Pexels/Unsplash; thông tin nguồn và giấy phép ở `wwwroot/images/ATTRIBUTION.txt`.

## Kiểm tra

```powershell
dotnet build ".\Vehicle-Repair-Management.slnx"
```

Đã kiểm tra build .NET 10, cú pháp JavaScript và API đặt lịch / tra cứu / đăng nhập / trạng thái / phiếu sửa chữa / kho phụ tùng. Dữ liệu thử API dùng thư mục tách biệt và đã dọn sau khi kiểm tra.
