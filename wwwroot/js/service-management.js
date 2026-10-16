(() => {
    "use strict";
    const rows = document.getElementById("service-rows");
    if (!rows) return;
    const api = window.AutoFix.api;
    const form = document.getElementById("service-form");
    const dialog = document.getElementById("service-edit-dialog");
    const deleteDialog = document.getElementById("service-delete-dialog");
    const pageMessage = document.getElementById("service-management-message");
    const formMessage = document.getElementById("service-form-message");
    const deleteMessage = document.getElementById("service-delete-message");
    const editor = document.getElementById("service-description-editor");
    const textarea = document.getElementById("service-description");
    const imageInput = document.getElementById("service-image");
    const preview = document.getElementById("service-image-preview");
    const removeImage = document.getElementById("service-image-remove");
    const saveButton = document.getElementById("service-save");
    const refreshButton = document.getElementById("service-refresh");
    let editId = null, deleteId = null, imageUrl = "", selectedImage = null, previewUrl = "", busy = false, selectedRange = null;
    let services = [];
    const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value) || 0);
    function element(tag, text, className) {
        const result = document.createElement(tag);
        if (text !== undefined) result.textContent = text;
        if (className) result.className = className;
        return result;
    }
    function safeImage(value) {
        if (!value) return "";
        try { const url = new URL(value, location.origin); return url.origin === location.origin ? url.href : ""; }
        catch { return ""; }
    }
    // Copy only the formatting supported by the service API. Attributes never reach the editor.
    function formatted(value) {
        const source = new DOMParser().parseFromString(String(value || ""), "text/html");
        const allowed = new Set(["P", "BR", "STRONG", "EM", "UL", "OL", "LI"]);
        const blocked = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG", "MATH", "TEMPLATE"]);
        function copy(node) {
            if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
            const fragment = document.createDocumentFragment();
            if (node.nodeType !== Node.ELEMENT_NODE || blocked.has(node.tagName)) return fragment;
            const tag = ({ B: "STRONG", I: "EM", DIV: "P" })[node.tagName] || node.tagName;
            const result = allowed.has(tag) ? document.createElement(tag.toLowerCase()) : fragment;
            node.childNodes.forEach(child => result.append(copy(child)));
            return result;
        }
        const result = document.createDocumentFragment();
        source.body.childNodes.forEach(child => result.append(copy(child)));
        return result;
    }
    function syncDescription() {
        const clean = document.createElement("div"); clean.append(formatted(editor.innerHTML));
        textarea.value = clean.innerHTML;
    }
    function showMessage(target, text) { target.textContent = text; target.hidden = !text; }
    function releasePreview() { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = ""; }
    function showPreview(source) {
        preview.hidden = !source; removeImage.hidden = !source;
        if (source) preview.src = source; else preview.removeAttribute("src");
    }
    function setBusy(value) {
        busy = value;
        form.querySelectorAll("input, button").forEach(control => { control.disabled = value; });
        editor.contentEditable = String(!value);
        saveButton.textContent = value ? "Đang lưu…" : "Lưu dịch vụ";
    }
    function openEditor(item) {
        form.reset(); releasePreview(); selectedRange = null; selectedImage = null;
        editId = item?.id ?? null; imageUrl = item?.imageUrl || "";
        document.getElementById("service-edit-title").textContent = item ? "Sửa dịch vụ" : "Thêm dịch vụ";
        form.elements.name.value = item?.name || "";
        form.elements.price.value = item?.price ?? "";
        editor.replaceChildren(formatted(item?.description || "")); syncDescription();
        showPreview(safeImage(imageUrl)); showMessage(formMessage, "");
        dialog.showModal(); form.elements.name.focus();
    }
    function showDelete(item) {
        deleteId = item.id;
        document.getElementById("service-delete-name").textContent = item.name;
        showMessage(deleteMessage, ""); deleteDialog.showModal();
        document.getElementById("service-delete-cancel").focus();
    }
    function render() {
        if (!services.length) {
            const row = element("tr"); const cell = element("td", "Chưa có dịch vụ. Chọn “Thêm dịch vụ” để tạo mới.", "text-center py-4"); cell.colSpan = 3; row.append(cell); rows.replaceChildren(row); return;
        }
        rows.replaceChildren(...services.map(item => {
            const row = element("tr");
            const info = element("div", undefined, "service-row-info");
            const source = safeImage(item.imageUrl);
            if (source) { const image = element("img"); image.src = source; image.alt = ""; image.loading = "lazy"; image.addEventListener("error", () => image.remove()); info.append(image); }
            info.append(element("strong", item.name));
            const name = element("td"); name.append(info);
            const price = element("td", money(item.price));
            const actions = element("div", undefined, "service-row-actions");
            const edit = element("button", "Sửa", "btn btn-sm btn-outline-primary"); edit.type = "button"; edit.setAttribute("aria-label", "Sửa " + item.name); edit.addEventListener("click", () => openEditor(item));
            const remove = element("button", "Xóa", "btn btn-sm btn-outline-danger"); remove.type = "button"; remove.setAttribute("aria-label", "Xóa " + item.name); remove.addEventListener("click", () => showDelete(item));
            actions.append(edit, remove); const actionCell = element("td"); actionCell.append(actions); row.append(name, price, actionCell); return row;
        }));
    }
    async function load() {
        refreshButton.disabled = true; showMessage(pageMessage, "");
        try { const data = await api("/api/services"); services = data.services || []; render(); }
        catch (error) { showMessage(pageMessage, error.message); }
        finally { refreshButton.disabled = false; }
    }
    document.getElementById("service-add").addEventListener("click", () => openEditor());
    refreshButton.addEventListener("click", load);
    ["service-editor-close", "service-editor-cancel"].forEach(id => document.getElementById(id).addEventListener("click", () => { if (!busy) dialog.close(); }));
    dialog.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
    dialog.addEventListener("close", () => { releasePreview(); selectedRange = null; });
    preview.addEventListener("error", () => { preview.hidden = true; });
    imageInput.addEventListener("change", () => {
        showMessage(formMessage, ""); const file = imageInput.files[0];
        if (!file) { selectedImage = null; releasePreview(); showPreview(safeImage(imageUrl)); return; }
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size) {
            showMessage(formMessage, "Chọn ảnh JPG, PNG hoặc WebP có dung lượng tối đa 2 MB."); imageInput.value = ""; selectedImage = null; releasePreview(); showPreview(safeImage(imageUrl)); return;
        }
        selectedImage = file; releasePreview(); previewUrl = URL.createObjectURL(file); showPreview(previewUrl);
    });
    removeImage.addEventListener("click", () => { imageUrl = ""; selectedImage = null; imageInput.value = ""; releasePreview(); showPreview(""); });
    function rememberSelection() {
        const selection = window.getSelection();
        if (selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) selectedRange = selection.getRangeAt(0).cloneRange();
    }
    ["keyup", "mouseup", "input"].forEach(name => editor.addEventListener(name, rememberSelection));
    editor.addEventListener("input", syncDescription);
    editor.addEventListener("paste", event => { event.preventDefault(); document.execCommand("insertText", false, event.clipboardData.getData("text/plain")); syncDescription(); });
    editor.addEventListener("drop", event => { event.preventDefault(); editor.focus(); document.execCommand("insertText", false, event.dataTransfer.getData("text/plain")); syncDescription(); });
    document.querySelectorAll("[data-editor-command]").forEach(button => {
        button.addEventListener("mousedown", event => event.preventDefault());
        button.addEventListener("click", () => {
            editor.focus();
            if (selectedRange) { const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(selectedRange); }
            document.execCommand(button.dataset.editorCommand, false, null); rememberSelection(); syncDescription();
        });
    });
    document.getElementById("service-description-label").addEventListener("click", () => editor.focus());
    form.addEventListener("submit", async event => {
        event.preventDefault(); if (busy || !form.reportValidity()) return;
        syncDescription(); showMessage(formMessage, "");
        if (form.elements.name.value.trim().length < 2) { showMessage(formMessage, "Tên dịch vụ cần ít nhất 2 ký tự."); form.elements.name.focus(); return; }
        if (!editor.textContent.trim()) { showMessage(formMessage, "Vui lòng nhập mô tả dịch vụ."); editor.focus(); return; }
        if (textarea.value.length > 6000) { showMessage(formMessage, "Mô tả quá dài. Vui lòng rút gọn còn tối đa 6.000 ký tự gồm định dạng."); editor.focus(); return; }
        const values = { name: form.elements.name.value.trim(), price: Number(form.elements.price.value), description: textarea.value, imageUrl };
        setBusy(true);
        try {
            if (selectedImage) {
                const upload = new FormData(); upload.append("image", selectedImage);
                const uploaded = await api("/api/services/image", { method: "POST", body: upload });
                imageUrl = uploaded.imageUrl; values.imageUrl = imageUrl; selectedImage = null; imageInput.value = ""; releasePreview(); showPreview(safeImage(imageUrl));
            }
            await api(editId === null ? "/api/services" : "/api/services/" + encodeURIComponent(editId), { method: editId === null ? "POST" : "PUT", body: JSON.stringify(values) });
            dialog.close(); window.AutoFix.toast("Đã lưu dịch vụ."); await load();
        } catch (error) { showMessage(formMessage, error.message); }
        finally { setBusy(false); }
    });
    let deleting = false;
    document.getElementById("service-delete-cancel").addEventListener("click", () => { if (!deleting) deleteDialog.close(); });
    deleteDialog.addEventListener("cancel", event => { if (deleting) event.preventDefault(); });
    document.getElementById("service-delete-confirm").addEventListener("click", async event => {
        if (deleting || deleteId === null) return;
        deleting = true; event.currentTarget.disabled = true; showMessage(deleteMessage, "");
        try { await api("/api/services/" + encodeURIComponent(deleteId), { method: "DELETE" }); deleteDialog.close(); window.AutoFix.toast("Đã xóa dịch vụ."); await load(); }
        catch (error) { showMessage(deleteMessage, error.message); }
        finally { deleting = false; document.getElementById("service-delete-confirm").disabled = false; }
    });
    load();
})();
