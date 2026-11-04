// tools-engine.js
// Complete Shopkeeper Visiting Card & Barcode Manager (Edit, Delete, CSV Export/Import, Short-Link QR) & Cyber Cafe Suite

function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// =========================================================
// 1. DIGITAL VISITING CARD MANAGER (SHORT-LINK + EDIT + CSV)
// =========================================================
function getSavedVisitingCards() {
    try {
        return JSON.parse(localStorage.getItem("smartqr_visiting_cards") || "[]");
    } catch (e) {
        return [];
    }
}

function saveVisitingCardsArray(arr) {
    localStorage.setItem("smartqr_visiting_cards", JSON.stringify(arr));
    window.renderSavedVisitingCards();
}

window.createOrUpdateVisitingCard = async function() {
    const editId = document.getElementById("editingCardId").value.trim();
    const name = document.getElementById("shopName").value.trim();
    const phone = document.getElementById("shopPhone").value.trim();
    const address = document.getElementById("shopAddress").value.trim();
    const products = document.getElementById("shopProducts").value.trim();

    if (!name || !phone) {
        alert("Kripya Shop/Business Name aur WhatsApp Number zaroor enter karein!");
        return;
    }

    // Check Free Trial Limit if creating a new Visiting Card
    if (!editId && window.checkAndConsumeTrialQuota && !window.checkAndConsumeTrialQuota("bizTools")) {
        return;
    }

    const cards = getSavedVisitingCards();
    const cardId = editId || Math.random().toString(36).substring(2, 7); // 5-char Short ID!
    const basePath = window.location.origin + window.location.pathname.replace("index.html", "");

    let finalShortUrl = "";

    // If user is logged in, save as a 5-char Short Link in Firestore so QR has HUGE clean dots!
    if (window.saveShortDynamicRecord) {
        try {
            const firestoreShortUrl = await window.saveShortDynamicRecord(cardId, {
                title: `Visiting Card: ${name}`,
                qrType: "visiting",
                targetUrl: `VISITING_CARD:${cardId}`,
                structuredData: {
                    shopName: name,
                    shopPhone: phone,
                    shopAddr: address,
                    shopItems: products
                }
            });
            if (firestoreShortUrl) finalShortUrl = firestoreShortUrl;
        } catch (e) {
            console.warn("Firestore sync fallback:", e);
        }
    }

    // Fallback compact URL if guest (not logged in)
    if (!finalShortUrl) {
        const compactObj = { n: name, p: phone, a: address, items: products };
        const encoded = btoa(encodeURIComponent(JSON.stringify(compactObj)));
        finalShortUrl = `${basePath}r.html?card=${encoded}`;
    }

    const newEntry = {
        id: cardId,
        shopName: name,
        shopPhone: phone,
        shopAddress: address,
        shopProducts: products,
        shortUrl: finalShortUrl,
        updatedAt: new Date().toLocaleDateString("en-IN")
    };

    const existingIdx = cards.findIndex(c => c.id === cardId);
    if (existingIdx >= 0) {
        cards[existingIdx] = newEntry;
    } else {
        cards.unshift(newEntry);
    }

    saveVisitingCardsArray(cards);
    window.resetVisitingCardForm();

    const resBox = document.getElementById("visitingCardResult");
    const linkEl = document.getElementById("visitingCardLink");
    resBox.classList.remove("hidden");
    linkEl.innerHTML = `
        <strong>✅ Visiting Card Ready! Short Link:</strong><br>
        <a href="${finalShortUrl}" target="_blank" class="underline text-emerald-700 font-extrabold">${finalShortUrl}</a>
    `;

    if (window.renderCustomQrToCanvas) {
        await window.renderCustomQrToCanvas(finalShortUrl);
    }
};

window.renderSavedVisitingCards = function() {
    const box = document.getElementById("savedVisitingCardsList");
    if (!box) return;
    const cards = getSavedVisitingCards();

    if (!cards.length) {
        box.innerHTML = `<p class="text-slate-400 text-center py-3">Abhi tak koi Visiting Card save nahi kiya gaya hai.</p>`;
        return;
    }

    box.innerHTML = cards.map(c => `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap justify-between items-center gap-2">
            <div class="space-y-0.5">
                <p class="font-extrabold text-slate-900">${c.shopName} <span class="text-[10px] font-mono bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">${c.id}</span></p>
                <p class="text-[11px] text-slate-500">📞 ${c.shopPhone} | 📍 ${c.shopAddress || "N/A"}</p>
            </div>
            <div class="flex items-center gap-1.5">
                <a href="${c.shortUrl}" target="_blank" class="bg-white border border-slate-300 px-2.5 py-1 rounded-lg font-bold text-[11px] text-blue-600">👁️ View</a>
                <button onclick="editVisitingCard('${c.id}')" class="bg-blue-600 text-white px-2.5 py-1 rounded-lg font-bold text-[11px]">✏️ Edit</button>
                <button onclick="downloadVisitingCardQr('${c.shortUrl.replace(/'/g, "")}', '${c.id}')" class="bg-emerald-600 text-white px-2.5 py-1 rounded-lg font-bold text-[11px]">📥 QR</button>
                <button onclick="deleteVisitingCard('${c.id}')" class="bg-red-100 text-red-600 px-2 py-1 rounded-lg font-bold text-[11px]">🗑️</button>
            </div>
        </div>
    `).join("");
};

window.editVisitingCard = function(id) {
    const cards = getSavedVisitingCards();
    const card = cards.find(c => c.id === id);
    if (!card) return;

    document.getElementById("editingCardId").value = card.id;
    document.getElementById("shopName").value = card.shopName || "";
    document.getElementById("shopPhone").value = card.shopPhone || "";
    document.getElementById("shopAddress").value = card.shopAddress || "";
    document.getElementById("shopProducts").value = card.shopProducts || "";

    document.getElementById("saveVisitingCardBtn").textContent = "💾 Update Visiting Card";
    document.getElementById("cancelCardEditBtn").classList.remove("hidden");
    document.getElementById("shopName").focus();
};

window.resetVisitingCardForm = function() {
    document.getElementById("editingCardId").value = "";
    document.getElementById("shopName").value = "";
    document.getElementById("shopPhone").value = "";
    document.getElementById("shopAddress").value = "";
    document.getElementById("shopProducts").value = "";
    document.getElementById("saveVisitingCardBtn").textContent = "⚡ Save & Generate Short-Link QR";
    document.getElementById("cancelCardEditBtn").classList.add("hidden");
};

window.deleteVisitingCard = function(id) {
    if (!confirm("Delete this Visiting Card?")) return;
    const cards = getSavedVisitingCards().filter(c => c.id !== id);
    saveVisitingCardsArray(cards);
};

window.downloadVisitingCardQr = async function(url, id) {
    if (window.downloadSavedCustomQR) {
        await window.downloadSavedCustomQR(url, "#065f46", "#ffffff", "classy-rounded", "Scan Visiting Card", id, 3, "#065f46", "#10b981");
    }
};

// Export Visiting Cards to CSV
window.exportVisitingCardsCSV = function() {
    const cards = getSavedVisitingCards();
    if (!cards.length) return alert("CSV download karne ke liye pehle kam se kam 1 Visiting Card banayein!");

    let csv = "CardID,ShopName,Phone,Address,Products,ShortURL\n";
    cards.forEach(c => {
        csv += `"${c.id}","${(c.shopName || "").replace(/"/g, '""')}","${c.shopPhone || ""}","${(c.shopAddress || "").replace(/"/g, '""')}","${(c.shopProducts || "").replace(/"/g, '""')}","${c.shortUrl || ""}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Digital_Visiting_Cards_${Date.now()}.csv`;
    a.click();
};

// Import Visiting Cards from CSV
window.importVisitingCardsCSV = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length <= 1) return alert("CSV file khali hai!");

        const cards = getSavedVisitingCards();
        const basePath = window.location.origin + window.location.pathname.replace("index.html", "");

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",").map(s => s.replace(/^"|"$/g, "").trim());
            if (cols.length >= 2) {
                const id = cols[0] || Math.random().toString(36).substring(2, 7);
                const shopName = cols[1] || "Shop";
                const shopPhone = cols[2] || "";
                const shopAddress = cols[3] || "";
                const shopProducts = cols[4] || "";
                const compactObj = { n: shopName, p: shopPhone, a: shopAddress, items: shopProducts };
                const shortUrl = cols[5] || `${basePath}r.html?card=${btoa(encodeURIComponent(JSON.stringify(compactObj)))}`;

                cards.unshift({ id, shopName, shopPhone, shopAddress, shopProducts, shortUrl });
            }
        }
        saveVisitingCardsArray(cards);
        alert("✅ Visiting Cards CSV Imported Successfully!");
    };
    reader.readAsText(file);
};

// =========================================================
// 2. PRODUCT BARCODE STUDIO & CSV MANAGER (EDIT + CSV)
// =========================================================
function getSavedBarcodes() {
    try {
        return JSON.parse(localStorage.getItem("smartqr_barcodes") || "[]");
    } catch (e) {
        return [];
    }
}

function saveBarcodesArray(arr) {
    localStorage.setItem("smartqr_barcodes", JSON.stringify(arr));
    window.renderSavedBarcodes();
}

window.generateProductBarcode = function(customVal = null, customLabel = null) {
    const val = customVal || document.getElementById("barcodeValue")?.value.trim() || "AGNI-101";
    const label = customLabel !== null ? customLabel : (document.getElementById("barcodeLabel")?.value.trim() || "");
    const svg = document.getElementById("barcodeSvg");
    if (!svg) return;

    try {
        JsBarcode(svg, val, {
            format: "CODE128",
            lineColor: "#000000",
            width: 2.3,
            height: 65,
            displayValue: true,
            text: label ? `${val} | ${label}` : val,
            fontSize: 14,
            fontOptions: "bold",
            margin: 12
        });
    } catch (e) {
        console.warn("Barcode Error:", e);
    }
};

window.saveAndGenerateBarcode = function() {
    const editId = document.getElementById("editingBarcodeId").value.trim();
    const val = document.getElementById("barcodeValue").value.trim();
    const label = document.getElementById("barcodeLabel").value.trim();

    if (!val) return alert("Kripya Barcode Value / SKU code enter karein!");

    if (!editId && window.checkAndConsumeTrialQuota && !window.checkAndConsumeTrialQuota("bizTools")) {
        return;
    }

    window.generateProductBarcode(val, label);

    const list = getSavedBarcodes();
    const id = editId || `BC_${Date.now().toString(36)}`;
    const entry = { id, code: val, label: label };

    const idx = list.findIndex(b => b.id === id);
    if (idx >= 0) list[idx] = entry;
    else list.unshift(entry);

    saveBarcodesArray(list);
    window.resetBarcodeForm();
};

window.renderSavedBarcodes = function() {
    const box = document.getElementById("savedBarcodesList");
    if (!box) return;
    const list = getSavedBarcodes();

    if (!list.length) {
        box.innerHTML = `<p class="text-slate-400 text-center py-3">Abhi tak koi Barcode save nahi kiya gaya hai.</p>`;
        return;
    }

    box.innerHTML = list.map(b => `
        <div class="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex justify-between items-center gap-2">
            <div>
                <p class="font-extrabold text-slate-900 font-mono">${b.code}</p>
                <p class="text-[11px] text-slate-500">${b.label || "No label"}</p>
            </div>
            <div class="flex items-center gap-1.5">
                <button onclick="previewSavedBarcode('${b.code.replace(/'/g, "")}', '${(b.label || "").replace(/'/g, "")}')" class="bg-white border border-slate-300 px-2.5 py-1 rounded-lg font-bold text-[11px]">👁️ Load</button>
                <button onclick="editSavedBarcode('${b.id}')" class="bg-blue-600 text-white px-2.5 py-1 rounded-lg font-bold text-[11px]">✏️ Edit</button>
                <button onclick="deleteSavedBarcode('${b.id}')" class="bg-red-100 text-red-600 px-2 py-1 rounded-lg font-bold text-[11px]">🗑️</button>
            </div>
        </div>
    `).join("");
};

window.previewSavedBarcode = function(code, label) {
    document.getElementById("barcodeValue").value = code;
    document.getElementById("barcodeLabel").value = label;
    window.generateProductBarcode(code, label);
};

window.editSavedBarcode = function(id) {
    const item = getSavedBarcodes().find(b => b.id === id);
    if (!item) return;

    document.getElementById("editingBarcodeId").value = item.id;
    document.getElementById("barcodeValue").value = item.code;
    document.getElementById("barcodeLabel").value = item.label || "";
    document.getElementById("saveBarcodeBtn").textContent = "💾 Update Barcode";
    document.getElementById("cancelBarcodeEditBtn").classList.remove("hidden");
    window.generateProductBarcode(item.code, item.label);
};

window.resetBarcodeForm = function() {
    document.getElementById("editingBarcodeId").value = "";
    document.getElementById("saveBarcodeBtn").textContent = "⚡ Generate & Save Barcode";
    document.getElementById("cancelBarcodeEditBtn").classList.add("hidden");
};

window.deleteSavedBarcode = function(id) {
    if (!confirm("Delete this Barcode?")) return;
    saveBarcodesArray(getSavedBarcodes().filter(b => b.id !== id));
};

window.downloadBarcodePng = function() {
    const svgElement = document.getElementById("barcodeSvg");
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        const a = document.createElement("a");
        a.download = `Barcode-${document.getElementById("barcodeValue").value || "Item"}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
    };
    img.src = url;
};

// Export Barcodes to CSV
window.exportBarcodesCSV = function() {
    const list = getSavedBarcodes();
    if (!list.length) return alert("CSV download karne ke liye pehle kam se kam 1 Barcode save karein!");

    let csv = "BarcodeID,SKU_Code,Product_Label\n";
    list.forEach(b => {
        csv += `"${b.id}","${(b.code || "").replace(/"/g, '""')}","${(b.label || "").replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Product_Barcodes_${Date.now()}.csv`;
    a.click();
};

// Import Barcodes from CSV
window.importBarcodesCSV = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const lines = e.target.result.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length <= 1) return alert("CSV file khali hai!");

        const list = getSavedBarcodes();
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(",").map(s => s.replace(/^"|"$/g, "").trim());
            if (cols.length >= 2) {
                list.unshift({
                    id: cols[0] || `BC_${Date.now()}_${i}`,
                    code: cols[1] || `ITEM-${i}`,
                    label: cols[2] || ""
                });
            }
        }
        saveBarcodesArray(list);
        alert("✅ Barcodes CSV Imported Successfully!");
    };
    reader.readAsText(file);
};

// =========================================================
// 3. CYBER CAFE SUITE (WITH TRIAL QUOTA PROTECTION)
// =========================================================
window.generatePassportSheet = async function() {
    const fileInput = document.getElementById("passportImgInput");
    const count = parseInt(document.getElementById("passportGridSize").value, 10);
    const canvas = document.getElementById("passportCanvas");
    const dlBtn = document.getElementById("downloadPassportBtn");

    if (!fileInput.files.length) return alert("Kripya pehle customer ki photo select karein!");
    if (window.checkAndConsumeTrialQuota && !window.checkAndConsumeTrialQuota("cyberTools")) return;

    const img = await loadImageFromFile(fileInput.files[0]);
    const ctx = canvas.getContext("2d");

    const pW = 350, pH = 450, gap = 30, margin = 45;
    let cols = 6, rows = 2;
    if (count === 6) { cols = 3; rows = 2; }
    if (count === 12) { cols = 6; rows = 2; }
    if (count === 30) { cols = 6; rows = 5; }

    canvas.width = margin * 2 + cols * pW + (cols - 1) * gap;
    canvas.height = margin * 2 + rows * pH + (rows - 1) * gap;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const targetRatio = pW / pH;
    const imgRatio = img.width / img.height;
    let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;

    if (imgRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sx = (img.width - sWidth) / 2;
    } else {
        sHeight = img.width / targetRatio;
        sy = (img.height - sHeight) / 2;
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const x = margin + c * (pW + gap);
            const y = margin + r * (pH + gap);
            ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, pW, pH);
            ctx.strokeStyle = "#1e293b";
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, pW, pH);
        }
    }

    canvas.classList.remove("hidden");
    dlBtn.classList.remove("hidden");
};

window.downloadPassportSheet = function() {
    const canvas = document.getElementById("passportCanvas");
    const a = document.createElement("a");
    a.download = `Passport-Photo-Sheet-${Date.now()}.jpg`;
    a.href = canvas.toDataURL("image/jpeg", 0.95);
    a.click();
};

window.compressAndResizeImage = async function() {
    const fileInput = document.getElementById("resizeImgInput");
    const targetW = parseInt(document.getElementById("resizeWidth").value, 10) || 200;
    const targetH = parseInt(document.getElementById("resizeHeight").value, 10) || 230;
    const maxKb = parseInt(document.getElementById("resizeTargetKb").value, 10) || 50;
    const resultText = document.getElementById("resizeResultText");

    if (!fileInput.files.length) return alert("Kripya photo ya signature upload karein!");
    if (window.checkAndConsumeTrialQuota && !window.checkAndConsumeTrialQuota("cyberTools")) return;

    const img = await loadImageFromFile(fileInput.files[0]);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    let quality = 0.92;
    let dataUrl = canvas.toDataURL("image/jpeg", quality);
    let sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);

    while (sizeKb > maxKb && quality > 0.1) {
        quality -= 0.08;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
        sizeKb = Math.round((dataUrl.length * 3) / 4 / 1024);
    }

    const link = document.createElement("a");
    link.download = `Form-Photo-${targetW}x${targetH}-${sizeKb}KB.jpg`;
    link.href = dataUrl;
    link.click();

    resultText.textContent = `✅ Downloaded! Exact Size: ${sizeKb} KB (${targetW}x${targetH} px)`;
    resultText.classList.remove("hidden");
};

window.convertImagesToPdf = async function() {
    const fileInput = document.getElementById("imgToPdfInput");
    const quality = parseFloat(document.getElementById("pdfCompressionLevel").value) || 0.75;

    if (!fileInput.files.length) return alert("Kripya kam se kam 1 document image select karein!");
    if (window.checkAndConsumeTrialQuota && !window.checkAndConsumeTrialQuota("cyberTools")) return;

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = 210, pageH = 297, margin = 10;

    for (let i = 0; i < fileInput.files.length; i++) {
        if (i > 0) pdf.addPage();
        const img = await loadImageFromFile(fileInput.files[i]);

        const canvas = document.createElement("canvas");
        const maxDim = 1400;
        let w = img.width, h = img.height;
        if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        const ratio = Math.min((pageW - margin * 2) / w, (pageH - margin * 2) / h);
        pdf.addImage(compressedDataUrl, "JPEG", margin, margin, w * ratio, h * ratio);
    }

    pdf.save(`Merged-Document-${Date.now()}.pdf`);
};

window.generateIdCardA4Pdf = async function() {
    const frontFile = document.getElementById("idFrontInput").files[0];
    const backFile = document.getElementById("idBackInput").files[0];

    if (!frontFile || !backFile) return alert("Kripya ID Card ka Front aur Back dono photo select karein!");
    if (window.checkAndConsumeTrialQuota && !window.checkAndConsumeTrialQuota("cyberTools")) return;

    const frontImg = await loadImageFromFile(frontFile);
    const backImg = await loadImageFromFile(backFile);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    const toJpeg = (img) => {
        const c = document.createElement("canvas");
        c.width = 860; c.height = 540;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.92);
    };

    pdf.setFontSize(10);
    pdf.text("Front Side", 14, 17);
    pdf.addImage(toJpeg(frontImg), "JPEG", 14, 20, 86, 54);

    pdf.text("Back Side", 110, 17);
    pdf.addImage(toJpeg(backImg), "JPEG", 110, 20, 86, 54);

    pdf.save(`ID-Card-A4-Print-${Date.now()}.pdf`);
};

// =========================================================
// 4. SARKARI AGE CALCULATOR
// =========================================================
window.addEventListener("DOMContentLoaded", () => {
    const asOn = document.getElementById("asOnDateInput");
    if (asOn) asOn.valueAsDate = new Date();
    window.renderSavedVisitingCards();
    window.renderSavedBarcodes();
    window.generateProductBarcode();
});

window.calculateExactAge = function() {
    const dobVal = document.getElementById("dobInput").value;
    const asOnVal = document.getElementById("asOnDateInput").value;
    const box = document.getElementById("ageResultBox");
    const text = document.getElementById("ageResultText");

    if (!dobVal || !asOnVal) return alert("Kripya Date of Birth aur Target Date dono select karein!");

    const dob = new Date(dobVal);
    const target = new Date(asOnVal);
    if (dob > target) return alert("Date of Birth target date se aage nahi ho sakti!");

    let years = target.getFullYear() - dob.getFullYear();
    let months = target.getMonth() - dob.getMonth();
    let days = target.getDate() - dob.getDate();

    if (days < 0) {
        months--;
        days += new Date(target.getFullYear(), target.getMonth(), 0).getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    box.classList.remove("hidden");
    text.textContent = `🎯 Exact Age: ${years} Years, ${months} Months, ${days} Days`;
};
