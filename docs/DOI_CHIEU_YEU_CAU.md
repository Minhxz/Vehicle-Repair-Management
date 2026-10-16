# Đối chiếu yêu cầu — AutoFix cơ bản có kho và doanh thu

Dự án ASP.NET Core MVC .NET 10 giữ 5 chức năng chính: dịch vụ, lịch hẹn khách hàng, xử lý sửa chữa, kho phụ tùng và doanh thu. Mỗi kỹ thuật được áp dụng ở chức năng thích hợp.

| Yêu cầu trong đề | Nơi thể hiện | Cách demo |
| --- | --- | --- |
| MVC, framework front-end, responsive | Razor/controller/model; Bootstrap ở trang quản lý; CSS có breakpoint và bảng cuộn ngang | Mở website và 4 mục quản lý trên máy tính/điện thoại |
| Ít nhất hai nhóm người dùng | Cookie xác thực Manager/Customer; API và trang quản lý yêu cầu Manager | Chưa đăng nhập nhận 401, Customer nhận 403 khi gọi API quản lý |
| Thêm/sửa/xóa dữ liệu | CRUD dịch vụ và CRUD kho phụ tùng | Tạo → sửa → xóa bản ghi thử; chặn tên/mã trùng và dữ liệu không hợp lệ |
| Paging, Filtering | Lịch hẹn lọc từ khóa/ngày/trạng thái; kho tìm mã/tên; sổ thu lọc ngày; đều phân trang tại SQL server | Đổi trang và bộ lọc, kiểm tra tổng số/kết quả trả về |
| AJAX | `fetch` qua `http.js` cho form, danh sách, chỉnh sửa và tra cứu | Thao tác xong cập nhật danh sách, không tải lại toàn trang |
| Sessions, cookies | Bản nháp đặt lịch trong session 30 phút; cookie đăng nhập | Lưu/khôi phục/xóa nháp; session khác không đọc được; đăng nhập rồi tải lại |
| Validation, Data Annotations | Required/StringLength/Range và kiểm tra nghiệp vụ tại server | Gửi sai SĐT/ngày/giá/tồn kho; thử tồn lẻ/âm; thử thu tiền lịch chưa hoàn thành |
| RESTful API | Dịch vụ/kho có GET/POST/PUT/DELETE; lịch hẹn và doanh thu có các endpoint riêng | Chạy smoke script hoặc Postman, kiểm tra status201/400/401/403/404/409 |
| Upload ảnh | Ảnh dịch vụ JPG/PNG/WebP tối đa 2MB, kiểm tra chữ ký và tên file ngẫu nhiên | Ảnh thật được nhận, tệp giả ảnh/quá dung lượng bị từ chối |
| Editor cho textarea | Mô tả dịch vụ có in đậm/nghiêng/danh sách, đồng bộ textarea, lọc HTML tại server | Soạn → lưu → xem công khai; nội dung script/thuộc tính không được phép bị loại |
| Kiểm thử | `tests/smoke.ps1`, `tests/upload.ps1`, tiêu chí nghiệm thu từng người | Chạy với CSDL test riêng và ghi kết quả thực tế |
| Bảo mật | Băm mật khẩu, kiểm tra role tại server, CSRF, giới hạn tần suất, output an toàn, truy vấn EF có tham số | Thử sai quyền/thiếu token/HTML độc hại; tra cứu công khai không lộ số tiền đã thu |
| Quốc tế hóa | RequestLocalization vi-VN/en-US; định dạng ngày/tiền phía client theo vi-VN | Giải thích culture; giao diện hiện chỉ có tiếng Việt, chưa có bản dịch đầy đủ |
| SQL và tài liệu nộp | 5 bảng SQL Server, script `database/AutoFixCompact.sql`, README và phân công | Dựng CSDL mới bằng script; bổ sung báo cáo 15–35 trang và tài liệu/biểu đồ theo đề |

## Giới hạn nghiệp vụ để bài dễ làm

- Kho cập nhật trực tiếp tồn hiện tại, chưa có nhà cung cấp, phiếu nhập/xuất hoặc tự trừ tồn khi sửa xe.
- Doanh thu chỉ gồm tiền thực thu từ lịch Completed, mỗi lịch một khoản thu. Có sửa tiền/ngày/ghi chú, không có thu nhiều đợt, xóa khoản thu, hóa đơn nhiều dòng, chi phí/lợi nhuận hoặc cổng thanh toán.
- Tổng theo bộ lọc tính trên toàn bộ kết quả lọc trước phân trang. Thẻ hôm nay và tháng này tổng hợp độc lập bộ lọc.
- Giá dịch vụ là giá tham khảo; không tự biến thành số tiền đã thu.
- Tài khoản/phân quyền là nền dùng chung. [Phân công 5 người](PHAN_CONG_5_NGUOI.md) giao mỗi người một chức năng nghiệp vụ chính.

## Kết quả kiểm chứng ngày 16/10/2026

- Build: **0 lỗi, 0 cảnh báo**.
- API: **120 kiểm tra đạt**, gồm cả kho và doanh thu; thêm **4 kiểm tra upload đạt**.
- SQL script chạy hai lần trên CSDL thử: 5 bảng, 6 dịch vụ; không tạo phụ tùng hoặc khoản thu giả. Mô phỏng bản cũ 3 bảng rồi chạy nâng cấp thêm 2 bảng, dữ liệu cũ được giữ nguyên; chạy nâng cấp lặp lại vẫn đúng.
- Đã thử giao diện thêm/sửa/tìm phụ tùng và ghi nhận khoản thu; ảnh minh họa `simple-inventory.jpg`, `simple-revenue.jpg` trong `docs/screenshots` dùng dữ liệu thử riêng.
- Instance LocalDB mặc định trên máy có metadata điều khiển không đồng bộ với process đang hoạt động. Kiểm thử dùng instance tạm; ứng dụng chính chạy qua pipe hoạt động bằng biến môi trường riêng, không đổi registry hoặc xóa dữ liệu của instance cũ.

Các kết quả trên là kiểm tra kỹ thuật của bản hiện tại. Mỗi thành viên vẫn cần chạy và ghi test case/đầu vào/đầu ra thực tế của chức năng mình phụ trách để đưa vào báo cáo.
