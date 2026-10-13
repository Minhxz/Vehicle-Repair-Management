(() => {
    "use strict";
    const dialog = document.getElementById("service-dialog");
    if (!dialog) return;
    const items = {
        maintenance: ["Bảo dưỡng định kỳ", "Chăm sóc xe theo thời gian và quãng đường sử dụng. Hạng mục được điều chỉnh theo hướng dẫn của từng dòng xe.", ["Kiểm tra dầu, lọc và dung dịch vận hành", "Kiểm tra hệ thống phanh, lốp và đèn", "Đánh giá những chi tiết cần bảo dưỡng"]],
        repair: ["Sửa chữa tổng quát", "Xác định nguyên nhân của các dấu hiệu bất thường và thống nhất phương án sửa chữa phù hợp.", ["Kiểm tra động cơ và truyền động", "Đánh giá hệ thống treo, gầm và lái", "Lập phiếu hạng mục sau khi kiểm tra"]],
        electrical: ["Chẩn đoán điện & điện tử", "Kiểm tra hệ thống điện, cảnh báo và cảm biến, phù hợp với cấu hình của từng mẫu xe.", ["Kiểm tra đèn cảnh báo và cảm biến", "Đánh giá ắc quy và hệ thống điện", "Kiểm tra điện tử trên xe điện và hybrid"]],
        tires: ["Lốp & hệ thống phanh", "Chăm sóc các bộ phận tiếp xúc với mặt đường và hỗ trợ an toàn vận hành.", ["Kiểm tra độ mòn và áp suất lốp", "Kiểm tra má phanh, đĩa và dầu phanh", "Tư vấn hạng mục cần thay thế"]],
        detailing: ["Chăm sóc & làm đẹp xe", "Vệ sinh và chăm sóc bề mặt phù hợp với tình trạng nội thất, ngoại thất của chiếc xe.", ["Vệ sinh nội thất và khoang xe", "Rửa xe và chăm sóc bề mặt", "Đánh giá tình trạng trước khi thực hiện"]],
        inspection: ["Kiểm tra tổng thể", "Kiểm tra tình trạng xe trước những chuyến đi dài hoặc khi bạn muốn hiểu rõ hơn về chiếc xe.", ["Kiểm tra các hệ thống vận hành cơ bản", "Ghi nhận hiện trạng và dấu hiệu bất thường", "Tư vấn việc cần xử lý và mốc chăm sóc"]]
    };
    let trigger;
    document.querySelectorAll("[data-service]").forEach(button => button.addEventListener("click", () => {
        trigger = button;
        const [title, description, details] = items[button.dataset.service];
        document.getElementById("service-dialog-title").textContent = title;
        document.getElementById("service-dialog-description").textContent = description;
        document.getElementById("service-dialog-list").replaceChildren(...details.map(text => Object.assign(document.createElement("li"), { textContent: text })));
        document.getElementById("service-dialog-booking").href = "/Home/Booking?service=" + encodeURIComponent(title);
        dialog.showModal();
    }));
    dialog.querySelector("[data-close-dialog]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
    dialog.addEventListener("close", () => trigger?.focus());
})();