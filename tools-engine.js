// tools-engine.js
// Complete Cyber Cafe Document Suite & Shopkeeper Business Utility Engine

// Helper: Load Image File into HTMLImageElement
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
// 1. PASSPORT PHOTO SHEET MAKER (A4 / 4x6 GRID GENERATOR)
// =========================================================
window.generatePassportSheet = async function() {
    const fileInput = document.getElementById("passportImgInput");
    const count = parseInt(document.getElementById("passportGridSize").value, 10);
    const canvas = document.getElementById("passportCanvas");
    const dlBtn = document.getElementById("downloadPassportBtn");

    if (!fileInput.files.length) {
        alert("Kripya pehle customer ki photo select karein!");
        return;
    }

    const img = await loadImageFromFile(fileInput.files[0]);
    const ctx = canvas.getContext("2d");

    // Standard Passport Photo Ratio (35mm x 45mm -> approx 350px x 450px)
    const pW = 350;
    const pH = 450;
    const gap = 30;
    const margin = 45;

    let cols = 6;
    let rows = 2;
    if (count === 6) { cols = 3; rows = 2; }
    if (count === 12) { cols = 6; rows = 2; }
    if (count === 30) { cols = 6; rows = 5; }

    canvas.width = margin * 2 + cols * pW + (cols - 1) * gap;
    canvas.height = margin * 2 + rows * pH + (rows - 1) * gap;

    // White Sheet Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center-crop image to 35:45 passport aspect ratio
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

            // Black Scissor Cut Border around each passport photo
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

// =========================================================
// 2. ONLINE FORM IMAGE RESIZER & EXACT KB COMPRESSOR (20KB/50KB)
// =========================================================
window.compressAndResizeImage = async function() {
    const fileInput = document.getElementById("resizeImgInput");
    const targetW = parseInt(document.getElementById("resizeWidth").value, 10) || 200;
    const targetH = parseInt(document.getElementById("resizeHeight").value, 10) || 230;
    const maxKb = parseInt(document.getElementById("resizeTargetKb").value, 10) || 50;
    const resultText = document.getElementById("resizeResultText");

    if (!fileInput.files.length) {
        alert("Kripya photo ya signature upload karein!");
        return;
    }

    const img = await loadImageFromFile(fileInput.files[0]);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    // Iteratively adjust JPEG quality until size is strictly under target KB
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

    resultText.textContent = `✅ Downloaded! Final Size: ${sizeKb} KB (${targetW}x${targetH} px)`;
    resultText.classList.remove("hidden");
};

// =========================================================
// 3. IMAGES TO SINGLE COMPRESSED PDF CONVERTER
// =========================================================
window.convertImagesToPdf = async function() {
    const fileInput = document.getElementById("imgToPdfInput");
    const quality = parseFloat(document.getElementById("pdfCompressionLevel").value) || 0.75;

    if (!fileInput.files.length) {
        alert("Kripya kam se kam 1 document image select karein!");
        return;
    }

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = 210;
    const pageH = 297;
    const margin = 10;

    for (let i = 0; i < fileInput.files.length; i++) {
        if (i > 0) pdf.addPage();
        const img = await loadImageFromFile(fileInput.files[i]);

        const canvas = document.createElement("canvas");
        const maxDim = 1400;
        let w = img.width, h = img.height;
        if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        const ratio = Math.min(availW / w, availH / h);
        const printW = w * ratio;
        const printH = h * ratio;

        pdf.addImage(compressedDataUrl, "JPEG", margin, margin, printW, printH);
    }

    pdf.save(`Merged-Document-${Date.now()}.pdf`);
};

// =========================================================
// 4. ID CARD FRONT & BACK ON SINGLE A4 PAGE SETTER
// =========================================================
window.generateIdCardA4Pdf = async function() {
    const frontFile = document.getElementById("idFrontInput").files[0];
    const backFile = document.getElementById("idBackInput").files[0];

    if (!frontFile || !backFile) {
        alert("Kripya ID Card ka Front aur Back dono photo select karein!");
        return;
    }

    const frontImg = await loadImageFromFile(frontFile);
    const backImg = await loadImageFromFile(backFile);

    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");

    // Standard ID Card Size on A4 (86mm width x 54mm height) side by side
    const cardW = 86;
    const cardH = 54;

    const toJpeg = (img) => {
        const c = document.createElement("canvas");
        c.width = 860;
        c.height = 540;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        ctx.strokeStyle = "#334155";
        ctx.lineWidth = 4;
        ctx.strokeRect(0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.92);
    };

    // Place Front on Left (x=14mm, y=20mm) and Back on Right (x=110mm, y=20mm)
    pdf.setFontSize(10);
    pdf.text("Front Side", 14, 17);
    pdf.addImage(toJpeg(frontImg), "JPEG", 14, 20, cardW, cardH);

    pdf.text("Back Side", 110, 17);
    pdf.addImage(toJpeg(backImg), "JPEG", 110, 20, cardW, cardH);

    pdf.save(`ID-Card-A4-Print-${Date.now()}.pdf`);
};

// =========================================================
// 5. SHOPKEEPER DIGITAL VISITING CARD / MINI-WEBPAGE BUILDER
// =========================================================
window.createDigitalVisitingCard = async function() {
    const name = document.getElementById("shopName").value.trim();
    const phone = document.getElementById("shopPhone").value.trim();
    const address = document.getElementById("shopAddress").value.trim();
    const products = document.getElementById("shopProducts").value.trim();

    if (!name || !phone) {
        alert("Kripya apni Dukan ka Naam aur WhatsApp Number zaroor dalein!");
        return;
    }

    const cardData = { n: name, p: phone, a: address, items: products };
    const encoded = btoa(encodeURIComponent(JSON.stringify(cardData)));
    const basePath = window.location.origin + window.location.pathname.replace("index.html", "");
    const cardUrl = `${basePath}r.html?card=${encoded}`;

    document.getElementById("visitingCardResult").classList.remove("hidden");
    document.getElementById("visitingCardLink").innerHTML = `
        <strong>Mini-Webpage Live Link:</strong><br>
        <a href="${cardUrl}" target="_blank" class="underline text-emerald-700 font-bold">${cardUrl}</a>
    `;

    // Also load this Visiting Card URL into main QR Studio so user can download its styled QR
    document.getElementById("qrInput").value = cardUrl;
    if (window.renderCustomQrToCanvas) {
        await window.renderCustomQrToCanvas(cardUrl);
    }
    alert("🎉 Digital Visiting Card Mini-Webpage Ready! Aap link par click karke dekh sakte hain ya QR Studio se iska QR download kar sakte hain.");
};

// =========================================================
// 6. PRODUCT BARCODE GENERATOR (CODE128)
// =========================================================
window.generateProductBarcode = function() {
    const val = document.getElementById("barcodeValue").value.trim() || "ITEM-101";
    const label = document.getElementById("barcodeLabel").value.trim();
    const svg = document.getElementById("barcodeSvg");

    try {
        JsBarcode(svg, val, {
            format: "CODE128",
            lineColor: "#000000",
            width: 2.2,
            height: 60,
            displayValue: true,
            text: label ? `${val} | ${label}` : val,
            fontSize: 14,
            margin: 10
        });
    } catch (e) {
        console.warn("Barcode Error:", e);
    }
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
        a.download = `Product-Barcode-${Date.now()}.png`;
        a.href = canvas.toDataURL("image/png");
        a.click();
    };
    img.src = url;
};

// =========================================================
// 7. SARKARI FORM EXACT AGE & DATE CALCULATOR
// =========================================================
window.addEventListener("DOMContentLoaded", () => {
    const asOn = document.getElementById("asOnDateInput");
    if (asOn) asOn.valueAsDate = new Date();
});

window.calculateExactAge = function() {
    const dobVal = document.getElementById("dobInput").value;
    const asOnVal = document.getElementById("asOnDateInput").value;
    const box = document.getElementById("ageResultBox");
    const text = document.getElementById("ageResultText");

    if (!dobVal || !asOnVal) {
        alert("Kripya Date of Birth aur Target Date dono select karein!");
        return;
    }

    const dob = new Date(dobVal);
    const target = new Date(asOnVal);

    if (dob > target) {
        alert("Date of Birth target date se aage nahi ho sakti!");
        return;
    }

    let years = target.getFullYear() - dob.getFullYear();
    let months = target.getMonth() - dob.getMonth();
    let days = target.getDate() - dob.getDate();

    if (days < 0) {
        months--;
        const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
        days += prevMonth.getDate();
    }
    if (months < 0) {
        years--;
        months += 12;
    }

    box.classList.remove("hidden");
    text.textContent = `🎯 Exact Age: ${years} Years, ${months} Months, ${days} Days`;
};
