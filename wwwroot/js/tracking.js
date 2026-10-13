(() => {
    "use strict";
    const form = document.getElementById("tracking-form");
    if (!form) return;
    const api = window.AutoFix;
    const e = api.escape;
    const result = document.getElementById("tracking-result");
    const message = document.getElementById("tracking-message");
    let entry;
    let lookupPhone = "";
    const reference = new URLSearchParams(location.search).get("reference");
    if (reference) form.elements.reference.value = reference.slice(0, 40);
    function render(item) {
        entry = item;
        const details = [["Loại xe", item.vehicleType], ["Hãng / mẫu xe", item.brand], ["Biển số", item.licensePlate || "Chưa cập nhật"], ["Dịch vụ", item.service], ["Thời gian hẹn", api.date(item.date) + " · " + item.time], ["Khách hàng", item.customerName]];
        result.innerHTML = '<div class="tracking-result-head"><div><span class="eyebrow">MÃ LỊCH HẸN · ' + e(item.reference) + '</span><h3>Hành trình chăm xe của bạn</h3></div><span class="status-badge">' + e(item.statusLabel) + '</span></div><div class="tracking-details">' + details.map(([label, value]) => '<div><small>' + label + '</small><strong>' + e(value) + '</strong></div>').join("") + '</div><ol class="tracking-stages">' + item.stages.map((stage, index) => '<li class="' + e(stage.state) + '"><span>' + (stage.state === "completed" ? "✓" : index + 1) + '</span><strong>' + e(stage.title) + '</strong><p>' + e(stage.description) + '</p></li>').join("") + '</ol>';
        if (item.status === "Pending" || item.status === "Confirmed") {
            const cancel = document.createElement("button"); cancel.type = "button"; cancel.className = "cancel-booking"; cancel.textContent = "Hủy lịch hẹn này";
            cancel.addEventListener("click", () => {
                cancel.hidden = true;
                const confirm = document.createElement("div"); confirm.className = "cancel-confirmation";
                confirm.innerHTML = '<p>Bạn muốn hủy lịch hẹn này?</p><button type="button">Xác nhận hủy</button><button type="button">Giữ lịch hẹn</button>';
                const [yes, no] = confirm.querySelectorAll("button");
                no.addEventListener("click", () => { confirm.remove(); cancel.hidden = false; cancel.focus(); });
                yes.addEventListener("click", async () => {
                    yes.disabled = true; message.hidden = true;
                    try { const updated = await api.request("/api/appointments/" + encodeURIComponent(entry.reference) + "/cancel", { method: "POST", body: JSON.stringify({ phone: lookupPhone }) }); render(updated); message.classList.add("success"); message.textContent = "Lịch hẹn đã được hủy."; message.hidden = false; }
                    catch (error) { message.classList.remove("success"); message.textContent = error.message; message.hidden = false; yes.disabled = false; }
                });
                result.append(confirm); yes.focus();
            });
            result.append(cancel);
        }
        result.hidden = false; document.getElementById("tracking-empty").hidden = true;
    }
    form.addEventListener("submit", async event => {
        event.preventDefault(); if (!form.reportValidity()) return;
        const button = form.querySelector("button"); button.disabled = true;
        message.hidden = true; result.hidden = true; document.getElementById("tracking-empty").hidden = true;
        try {
            lookupPhone = form.elements.phone.value.trim();
            const params = new URLSearchParams({ reference: form.elements.reference.value.trim(), phone: lookupPhone });
            render(await api.request("/api/repairs/lookup?" + params.toString()));
        } catch (error) { message.classList.remove("success"); message.textContent = error.message; message.hidden = false; document.getElementById("tracking-empty").hidden = false; }
        finally { button.disabled = false; }
    });
})();