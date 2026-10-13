(() => {
    "use strict";
    const tabs = [...document.querySelectorAll("[data-vehicle]")];
    if (!tabs.length) return;
    const data = {
        car: { name: "Ô TÔ", eyebrow: "TỪ ĐÔ THỊ ĐẾN ĐƯỜNG DÀI", title: ["Chăm sóc toàn diện.", "Vận hành bền bỉ."], description: "Bảo dưỡng và sửa chữa sedan, SUV, MPV của nhiều thương hiệu. Kiểm tra đúng tình trạng, tư vấn đúng nhu cầu.", image: "vehicle-car.jpg", features: ["Động cơ & hộp số", "Điện & điều hòa", "Phanh, lốp & gầm"], button: "ĐẶT LỊCH CHO Ô TÔ" },
        motorcycle: { name: "XE MÁY", eyebrow: "NGƯỜI BẠN TRÊN MỌI NẺO ĐƯỜNG", title: ["Nhẹ nhàng mỗi ngày.", "Bền bỉ từng cây số."], description: "Chăm sóc xe số, xe tay ga và mô tô. Bảo dưỡng động cơ, truyền động và các chi tiết giúp xe vận hành ổn định mỗi ngày.", image: "vehicle-motorcycle.jpg", features: ["Dầu & lọc", "Nhông, sên & dây đai", "Phanh & lốp"], button: "ĐẶT LỊCH CHO XE MÁY" },
        electric: { name: "XE ĐIỆN & HYBRID", eyebrow: "CHĂM SÓC CÔNG NGHỆ MỚI", title: ["Hiểu công nghệ.", "Chăm đúng hệ thống."], description: "Kiểm tra hệ thống điện, làm mát, phanh và các cảnh báo trên xe điện và hybrid. Phạm vi sửa chữa được xác nhận theo từng mẫu xe.", image: "vehicle-electric.jpg", features: ["Chẩn đoán điện tử", "Hệ thống làm mát", "Phanh & khung gầm"], button: "ĐẶT LỊCH CHO XE ĐIỆN" },
        truck: { name: "BÁN TẢI & XE TẢI NHẸ", eyebrow: "SẴN SÀNG CHO MỌI CÔNG VIỆC", title: ["Vững tải trọng.", "Bền hành trình."], description: "Bảo dưỡng động cơ, truyền động, hệ thống treo và phanh theo cường độ sử dụng. Tiếp nhận bán tải và xe tải nhẹ theo điều kiện xưởng.", image: "vehicle-truck.jpg", features: ["Động cơ & truyền động", "Treo & khung gầm", "Phanh & lốp tải"], button: "ĐẶT LỊCH CHO XE CỦA BẠN" }
    };
    function select(tab) {
        const key = tab.dataset.vehicle;
        const item = data[key];
        tabs.forEach(button => { const active = button === tab; button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active)); button.tabIndex = active ? 0 : -1; });
        document.getElementById("vehicle-panel").setAttribute("aria-labelledby", tab.id);
        const image = document.getElementById("vehicle-image");
        image.src = "/images/" + item.image;
        image.alt = item.name;
        image.style.objectPosition = key === "motorcycle" ? "center 65%" : "center 58%";
        document.getElementById("vehicle-label").textContent = "AUTOFIX / " + item.name;
        document.getElementById("vehicle-eyebrow").textContent = item.eyebrow;
        const title = document.getElementById("vehicle-title"); title.replaceChildren(document.createTextNode(item.title[0]), document.createElement("br"), document.createTextNode(item.title[1]));
        document.getElementById("vehicle-description").textContent = item.description;
        document.getElementById("vehicle-features").replaceChildren(...item.features.map(text => { const span = document.createElement("span"); span.textContent = text; return span; }));
        const booking = document.getElementById("vehicle-booking"); booking.href = "/Home/Booking?vehicle=" + key;
        booking.replaceChildren(document.createTextNode(item.button + " "), Object.assign(document.createElement("span"), { textContent: "↗" }));
    }
    tabs.forEach((tab, index) => {
        tab.addEventListener("click", () => select(tab));
        tab.addEventListener("keydown", event => {
            let next = index;
            if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
            else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = tabs.length - 1;
            else return;
            event.preventDefault(); tabs[next].focus(); select(tabs[next]);
        });
    });
})();
