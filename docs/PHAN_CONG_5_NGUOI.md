# Phân công 5 người — AutoFix bản cơ bản có kho và doanh thu

Mỗi người phụ trách **một chức năng chính**, làm trọn giao diện, controller/API, dữ liệu, validation và kiểm thử của chức năng đó.

| Người | Một chức năng chính | Phạm vi bàn giao |
| --- | --- | --- |
| 1 | Quản lý dịch vụ | CRUD dịch vụ, giá tham khảo, upload ảnh, editor mô tả và danh sách dịch vụ công khai. |
| 2 | Quản lý lịch hẹn khách hàng | Đặt lịch, sinh mã, lưu/khôi phục bản nháp session, tra cứu và hủy lịch đủ điều kiện. |
| 3 | Xử lý sửa chữa | Danh sách lịch hẹn, tìm kiếm/lọc/phân trang, tiếp nhận và cập nhật tiến độ/ghi chú. |
| 4 | Quản lý kho phụ tùng | CRUD mã/tên/đơn vị/số lượng tồn/đơn giá, tìm kiếm và phân trang. |
| 5 | Quản lý doanh thu | Ghi nhận tiền thực thu cho lịch hoàn thành, sửa khoản thu, lọc kỳ và tổng hợp ngày/tháng. |

## Người 1 — Quản lý dịch vụ

- File: `Controllers/ServicesController.cs`, `Models/ServiceOffering.cs`, `Services/SafeServiceHtml.cs`, `Views/Management/Services.cshtml`, `Views/Home/_Services.cshtml`, `wwwroot/js/service-management.js`, `wwwroot/js/services.js`.
- Bảng: `Services`. API: `GET/POST /api/services`, `GET/PUT/DELETE /api/services/{id}`, `POST /api/services/image`.
- Nghiệm thu: CRUD dịch vụ; chặn tên trùng/giá sai; không xóa dịch vụ đã có lịch; upload JPG/PNG/WebP tối đa 2 MB; mô tả editor lưu/đọc lại đúng và loại bỏ HTML không được phép.

## Người 2 — Quản lý lịch hẹn khách hàng

- File: `Controllers/BookingController.cs`, `Controllers/BookingDraftController.cs`, `Controllers/RepairsController.cs`, `Views/Home/Booking.cshtml`, `Views/Home/_Booking.cshtml`, `Views/Home/Tracking.cshtml`, `wwwroot/js/booking.js`, `wwwroot/js/tracking.js`.
- Bảng: tạo/đọc lịch trong `Appointments`; thao tác bản nháp dùng session, không tạo bảng riêng.
- API: `POST /api/appointments`, `GET/PUT/DELETE /api/appointments/draft`, `GET /api/repairs/lookup`, `POST /api/appointments/{reference}/cancel`.
- Nghiệm thu: đặt đúng thông tin nhận mã; dữ liệu sai bị từ chối; lưu/khôi phục nháp đúng phiên; tra cứu cần đúng mã + SĐT; chỉ hủy khi chưa bắt đầu sửa; sai thông tin không đọc được lịch.

## Người 3 — Xử lý sửa chữa

- File: `Controllers/AppointmentsController.cs`, `Views/Management/Workflow.cshtml`, `wwwroot/js/workflow.js`, phần danh sách và cập nhật trong `Services/AppointmentStore.cs`.
- Bảng: đọc/cập nhật `Appointments`. API: `GET /api/appointments?q=&status=&date=&page=&pageSize=`, `GET /api/appointments/{reference}`, `PUT /api/appointments/{reference}/status`.
- Nghiệm thu: lọc/tìm kiếm/phân trang tại server; chi tiết và ghi chú hiển thị đúng; trạng thái chỉ đi Chờ xác nhận → Đã tiếp nhận → Đang sửa → Hoàn thành, hoặc hủy trước khi sửa. Lịch đã hoàn thành là nguồn để người 5 ghi nhận thu tiền.

## Người 4 — Quản lý kho phụ tùng

- File: `Models/InventoryItem.cs`, `Controllers/InventoryController.cs`, `Views/Management/Inventory.cshtml`, `wwwroot/js/inventory.js`, `wwwroot/css/inventory.css`.
- Bảng: `InventoryItems`. API: `GET/POST /api/inventory`, `PUT/DELETE /api/inventory/{id}`.
- Nghiệm thu: CRUD; mã phụ tùng duy nhất; tồn kho là số nguyên không âm; đơn giá nguyên đồng không âm; tìm kiếm và phân trang đúng; chỉ Manager được truy cập.
- Phạm vi cơ bản: sửa trực tiếp số lượng tồn hiện tại. Không có nhà cung cấp, phiếu nhập/xuất hoặc tự động trừ tồn theo lịch sửa.

## Người 5 — Quản lý doanh thu

- File: `Models/RevenueEntry.cs`, `Controllers/RevenueController.cs`, `Views/Management/Analytics.cshtml`, `wwwroot/js/analytics.js`, `wwwroot/css/revenue.css`.
- Bảng: `RevenueEntries`, liên kết mã lịch trong `Appointments`. API: `GET/POST /api/revenue`, `GET /api/revenue/eligible`, `PUT /api/revenue/{reference}`.
- Nghiệm thu: chỉ ghi nhận thu tiền cho lịch Completed; mỗi lịch có một khoản thu; số tiền dương, nguyên đồng, ngày thu không ở tương lai; sửa khoản thu không làm tăng số phiếu; tổng theo ngày/tháng và bộ lọc tính đúng; khách không được xem doanh thu.
- Phạm vi cơ bản: sổ tiền đã thu, nhập tổng tiền thủ công. Không tính lợi nhuận/chi phí, không chia dòng hóa đơn, không thu nhiều đợt hoặc tích hợp cổng thanh toán.

## Phần nền dùng chung

Đăng nhập/đăng xuất, Manager/Customer, cookie, CSRF, `Program.cs`, `AutoFixDbContext`, `DatabaseInitializer`, layout và `http.js` đã có sẵn. Mỗi người áp dụng quyền và kiểm thử truy cập cho phần mình; không tách người thứ sáu làm xác thực.

`Models/Appointment.cs`, `Services/AppointmentStore.cs` là file dùng chung giữa người 2 và 3. Hai người thống nhất trước khi sửa; phân biệt nghiệp vụ tạo/tra cứu/hủy với xử lý của cửa hàng. Mỗi người cập nhật phần entity/SQL liên quan; nhóm thống nhất khóa và tên trạng thái trước khi ghép.

Luồng demo chung: người 1 tạo dịch vụ → người 2 đặt lịch → người 3 cập nhật đến hoàn thành → người 5 ghi nhận thu tiền. Người 4 demo kho riêng bằng thêm/sửa số lượng/xóa phụ tùng thử. Mỗi người tự ghi test case và kết quả thực tế cho chức năng của mình.
