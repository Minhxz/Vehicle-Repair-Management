(() => {
    "use strict";
    const rows = document.getElementById("revenue-rows");
    if (!rows) return;
    const { api, toast, money, date } = window.AutoFix;
    const filter = document.getElementById("revenue-filter");
    const form = document.getElementById("revenue-form");
    const reference = document.getElementById("revenue-reference");
    const help = document.getElementById("revenue-reference-help");
    const message = document.getElementById("revenue-message");
    const formMessage = document.getElementById("revenue-form-message");
    const save = document.getElementById("revenue-save");
    const previous = document.getElementById("revenue-previous");
    const next = document.getElementById("revenue-next");
    const refresh = document.getElementById("revenue-refresh");
    const modalElement = document.getElementById("revenue-modal");
    const modal = new bootstrap.Modal(modalElement);
    let page = 1, totalPages = 1, listVersion = 0, modalVersion = 0;
    let listAbort, editingReference = null, ready = false, saving = false;
    let appliedFilter = { from: "", to: "" };
    function today() { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Bangkok" }).format(new Date()); }
    function currentMonth() { const now = today(); filter.elements.from.value = now.slice(0, 7) + "-01"; filter.elements.to.value = now; }
    function showMessage(target, text) { target.textContent = text; target.hidden = !text; }
    function element(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }
    function emptyRow(text) { const row = element("tr"); const cell = element("td", text, "empty-block"); cell.colSpan = 7; row.append(cell); rows.replaceChildren(row); }
    function render(data) {
        const entries = Array.isArray(data.entries) ? data.entries : [];
        page = Number(data.page) || 1; totalPages = Math.max(1, Number(data.totalPages) || 1);
        document.getElementById("revenue-today").textContent = money(data.todayAmount);
        document.getElementById("revenue-month").textContent = money(data.monthAmount);
        document.getElementById("revenue-total").textContent = money(data.totalAmount);
        const defaultRange = !appliedFilter.from && !appliedFilter.to;
        const from = data.appliedFrom ?? (defaultRange ? today().slice(0, 7) + "-01" : appliedFilter.from);
        const to = data.appliedTo ?? (defaultRange ? today() : appliedFilter.to);
        document.getElementById("revenue-range-label").textContent = from && to ? date(from) + " – " + date(to) : from ? "Từ " + date(from) : to ? "Đến " + date(to) : "Toàn bộ ngày thu";
        if (!entries.length) emptyRow("Chưa có khoản thu trong khoảng ngày này.");
        else rows.replaceChildren(...entries.map(item => {
            const row = element("tr");
            const amount = element("td", money(item.amount), "text-end");
            const note = element("td"); note.append(element("div", item.note || "—", "revenue-note"));
            const action = element("td"); const edit = element("button", "Sửa", "btn btn-sm btn-outline-primary");
            edit.type = "button"; edit.setAttribute("aria-label", "Sửa khoản thu " + item.reference); edit.addEventListener("click", () => openEditor(item)); action.append(edit);
            row.append(element("td", date(item.paidOn)), element("td", item.reference), element("td", item.customerName), element("td", item.service), amount, note, action); return row;
        }));
        const start = (page - 1) * (Number(data.pageSize) || 10) + 1;
        document.getElementById("revenue-summary").textContent = entries.length ? "Hiển thị " + start + "–" + (start + entries.length - 1) + " / " + (Number(data.total) || 0) + " khoản thu" : "0 khoản thu";
        document.getElementById("revenue-page").textContent = "Trang " + page + " / " + totalPages;
    }
    async function load() {
        const version = ++listVersion;
        listAbort?.abort(); listAbort = new AbortController();
        previous.disabled = true; next.disabled = true; refresh.disabled = true; showMessage(message, "");
        const params = new URLSearchParams({ ...appliedFilter, page: String(page), pageSize: "10" });
        try { const data = await api("/api/revenue?" + params, { signal: listAbort.signal }); if (version === listVersion) render(data); }
        catch (error) {
            if (version !== listVersion) return;
            showMessage(message, error.message); emptyRow("Không tải được sổ thu tiền. Vui lòng thử lại.");
            document.getElementById("revenue-total").textContent = "—";
            document.getElementById("revenue-summary").textContent = "Chưa tải được dữ liệu";
        } finally {
            if (version === listVersion) { refresh.disabled = false; previous.disabled = page <= 1; next.disabled = page >= totalPages; }
        }
    }
    function updateEditor() {
        form.querySelectorAll("input, textarea, button").forEach(control => { control.disabled = saving; });
        reference.disabled = saving || !ready || editingReference !== null;
        save.disabled = saving || !ready;
        save.textContent = saving ? "Đang lưu…" : "Lưu khoản thu";
    }
    async function openEditor(item) {
        if (saving) return;
        const version = ++modalVersion;
        editingReference = item?.reference ?? null; ready = Boolean(item); form.reset(); showMessage(formMessage, "");
        document.getElementById("revenue-modal-title").textContent = item ? "Sửa khoản thu" : "Ghi nhận tiền thu";
        form.elements.amount.value = item?.amount ?? ""; form.elements.paidOn.value = item?.paidOn || today(); form.elements.paidOn.max = today(); form.elements.note.value = item?.note || "";
        if (item) {
            reference.replaceChildren(new Option(item.reference + " — " + item.customerName + " · " + item.service, item.reference));
            help.textContent = "Khoản thu thuộc lịch hẹn này. Mã lịch hẹn được giữ nguyên khi sửa.";
        } else {
            reference.replaceChildren(new Option("Đang tải lịch hoàn thành…", ""));
            help.textContent = "Chỉ chọn lịch hoàn thành chưa ghi nhận tiền thu.";
        }
        updateEditor(); modal.show();
        if (item) { form.elements.amount.focus(); return; }
        try {
            const data = await api("/api/revenue/eligible");
            if (version !== modalVersion) return;
            const appointments = data.appointments || [];
            reference.replaceChildren(new Option(appointments.length ? "Chọn lịch hẹn đã hoàn thành" : "Chưa có lịch hẹn đủ điều kiện", ""), ...appointments.map(appointment => new Option(appointment.reference + " — " + appointment.customerName + " · " + appointment.service, appointment.reference)));
            ready = Boolean(appointments.length);
            if (!ready) help.textContent = "Cần có lịch hẹn hoàn thành và chưa ghi nhận thu để thêm khoản mới.";
        } catch (error) { if (version === modalVersion) showMessage(formMessage, error.message); }
        finally { if (version === modalVersion) updateEditor(); }
    }
    document.getElementById("revenue-add").addEventListener("click", () => openEditor());
    modalElement.addEventListener("hide.bs.modal", event => { if (saving) event.preventDefault(); });
    modalElement.addEventListener("hidden.bs.modal", () => { modalVersion++; });
    modalElement.addEventListener("shown.bs.modal", () => { if (editingReference !== null) form.elements.amount.focus(); else if (ready) reference.focus(); });
    form.addEventListener("submit", async event => {
        event.preventDefault(); if (saving || !ready || !form.reportValidity()) return;
        const amount = Number(form.elements.amount.value);
        if (!Number.isInteger(amount) || amount < 1 || amount > 100000000) { showMessage(formMessage, "Số tiền phải là số nguyên từ 1 đến 100.000.000 đồng."); form.elements.amount.focus(); return; }
        if (form.elements.paidOn.value > today()) { showMessage(formMessage, "Ngày thu không được sau hôm nay."); form.elements.paidOn.focus(); return; }
        const body = { amount, paidOn: form.elements.paidOn.value, note: form.elements.note.value.trim() };
        if (editingReference === null) body.reference = reference.value;
        const url = editingReference === null ? "/api/revenue" : "/api/revenue/" + encodeURIComponent(editingReference);
        const method = editingReference === null ? "POST" : "PUT";
        saving = true; updateEditor(); showMessage(formMessage, "");
        let saved = false;
        try {
            await api(url, { method, body: JSON.stringify(body) });
            saved = true;
        } catch (error) { showMessage(formMessage, error.message); }
        finally { saving = false; updateEditor(); }
        if (saved) { modal.hide(); toast(method === "POST" ? "Đã ghi nhận tiền thu." : "Đã cập nhật khoản thu."); load(); }
    });
    filter.addEventListener("submit", event => {
        event.preventDefault();
        if (!filter.reportValidity()) return;
        if (filter.elements.from.value && filter.elements.to.value && filter.elements.from.value > filter.elements.to.value) { showMessage(message, "Ngày bắt đầu không được sau ngày kết thúc."); return; }
        appliedFilter = { from: filter.elements.from.value, to: filter.elements.to.value }; page = 1; load();
    });
    document.getElementById("revenue-current-month").addEventListener("click", () => { currentMonth(); appliedFilter = { from: filter.elements.from.value, to: filter.elements.to.value }; page = 1; load(); });
    refresh.addEventListener("click", load);
    previous.addEventListener("click", () => { if (page > 1) { page--; load(); } });
    next.addEventListener("click", () => { if (page < totalPages) { page++; load(); } });
    currentMonth(); appliedFilter = { from: filter.elements.from.value, to: filter.elements.to.value }; load();
})();
