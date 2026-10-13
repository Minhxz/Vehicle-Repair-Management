(() => {
    "use strict";
    const form = document.getElementById("booking-form");
    if (!form) return;
    const api = window.AutoFix;
    const date = form.elements.date;
    const time = form.elements.time;
    const message = document.getElementById("booking-message");
    const submit = document.getElementById("booking-submit");
    const success = document.getElementById("booking-success");
    const today = api.today();
    date.min = today;
    const max = new Date(today + "T12:00:00+07:00"); max.setDate(max.getDate() + 90);
    date.max = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(max);
    function updateTimes() {
        const now = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
        [...time.options].forEach(option => { option.disabled = Boolean(option.value && date.value === api.today() && option.value <= now); });
        if (time.selectedOptions[0]?.disabled) time.value = "";
    }
    date.addEventListener("change", updateTimes);
    const query = new URLSearchParams(location.search);
    const vehicleMap = { car: "Ô tô", motorcycle: "Xe máy", electric: "Xe điện & hybrid", truck: "Xe bán tải / xe tải nhẹ" };
    if (vehicleMap[query.get("vehicle")]) form.elements.vehicleType.value = vehicleMap[query.get("vehicle")];
    if ([...form.elements.service.options].some(option => option.value === query.get("service"))) form.elements.service.value = query.get("service");
    form.addEventListener("submit", async event => {
        event.preventDefault(); updateTimes();
        if (!form.reportValidity()) return;
        message.hidden = true; submit.disabled = true; submit.textContent = "ĐANG GỬI YÊU CẦU...";
        const values = Object.fromEntries(new FormData(form));
        try {
            const result = await api.request("/api/appointments", { method: "POST", body: JSON.stringify(values) });
            document.getElementById("success-reference").textContent = result.reference;
            document.getElementById("success-summary").textContent = api.date(result.date) + " · " + result.time + " · " + result.service;
            document.getElementById("success-tracking").href = "/Home/Tracking?reference=" + encodeURIComponent(result.reference);
            form.hidden = true; success.hidden = false; success.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (error) {
            message.textContent = error.message; message.hidden = false;
            const field = Object.keys(error.fields || {})[0];
            const input = [...form.elements].find(item => item.name?.toLowerCase() === field?.toLowerCase());
            input?.focus();
        } finally { submit.disabled = false; submit.innerHTML = "GỬI YÊU CẦU ĐẶT LỊCH <span>↗</span>"; }
    });
    document.getElementById("copy-reference").addEventListener("click", async event => {
        try { await navigator.clipboard.writeText(document.getElementById("success-reference").textContent); event.target.textContent = "Đã sao chép"; }
        catch { event.target.textContent = "Chọn mã để sao chép"; const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(document.getElementById("success-reference")); selection.removeAllRanges(); selection.addRange(range); }
    });
    document.getElementById("new-booking").addEventListener("click", () => { success.hidden = true; form.hidden = false; form.reset(); message.hidden = true; document.getElementById("copy-reference").textContent = "Sao chép mã"; form.elements.customerName.focus(); });
})();