// qr-engine.js
// Ultra-Fast Custom QR Engine (Dots, Corners, 1:1 Logo, Custom Text, 7 QR Types & Bulk CSV ZIP)

let currentQRType = "url";
let uploadedLogoDataUrl = null;
let renderTimeout = null;

// Initialize QRCodeStyling Instance (600x600 HD Resolution for Instant Scanning)
const qrStyler = new QRCodeStyling({
    width: 600,
    height: 600,
    type: "canvas",
    data: "https://example.com",
    margin: 22, // Wide Quiet Zone for 0.1s Fast Camera Lock
    qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "M" // Fast scan default; switches to 'H' when logo is added
    },
    imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.28,
        margin: 8,
        crossOrigin: "anonymous"
    },
    dotsOptions: {
        color: "#000000",
        type: "square"
    },
    backgroundOptions: {
        color: "#ffffff"
    },
    cornersSquareOptions: {
        color: "#000000",
        type: "square"
    },
    cornersDotOptions: {
        color: "#000000",
        type: "square"
    }
});

// =========================================================
// 1. SWITCH BETWEEN 7 ADVANCED QR TYPES
// =========================================================
window.setQRType = function(type) {
    currentQRType = type;

    // Highlight Active Tab
    document.querySelectorAll(".qr-tab").forEach(btn => {
        btn.className = "qr-tab flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-slate-300 hover:bg-slate-800 shrink-0";
    });
    const activeTab = document.getElementById(`tab-${type}`);
    if (activeTab) {
        activeTab.className = "qr-tab flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 text-emerald-400 border border-emerald-500/40 shrink-0";
    }

    // Hide all type forms first
    ["form-single", "form-wifi", "form-vcard", "form-upi", "form-social"].forEach(id => {
        document.getElementById(id).classList.add("hidden");
    });

    const singleLabel = document.getElementById("singleInputLabel");
    const singleInput = document.getElementById("qrInput");

    if (type === "wifi") {
        document.getElementById("form-wifi").classList.remove("hidden");
    } else if (type === "vcard") {
        document.getElementById("form-vcard").classList.remove("hidden");
    } else if (type === "upi") {
        document.getElementById("form-upi").classList.remove("hidden");
    } else if (type === "social") {
        document.getElementById("form-social").classList.remove("hidden");
    } else {
        document.getElementById("form-single").classList.remove("hidden");
        if (type === "url") {
            singleLabel.textContent = "Enter Website URL";
            singleInput.placeholder = "https://example.com";
        } else if (type === "whatsapp") {
            singleLabel.textContent = "Enter WhatsApp Number (with country code 91)";
            singleInput.placeholder = "919876543210";
        } else if (type === "text") {
            singleLabel.textContent = "Enter Plain Text or Note";
            singleInput.placeholder = "Type any message or serial number...";
        }
    }

    triggerLivePreview();
};

window.getCurrentQRType = () => currentQRType;

// =========================================================
// 2. BUILD PAYLOAD FOR ALL 7 QR TYPES
// =========================================================
window.getCurrentFormattedPayload = function() {
    if (currentQRType === "wifi") {
        const ssid = (document.getElementById("wifiSsid").value || "MyWiFi").trim();
        const pass = (document.getElementById("wifiPass").value || "").trim();
        const enc = document.getElementById("wifiEnc").value;
        return `WIFI:T:${enc};S:${ssid};P:${pass};;`;
    }

    if (currentQRType === "vcard") {
        const name = (document.getElementById("vcName").value || "Contact").trim();
        const phone = (document.getElementById("vcPhone").value || "").trim();
        const email = (document.getElementById("vcEmail").value || "").trim();
        const org = (document.getElementById("vcOrg").value || "").trim();
        const web = (document.getElementById("vcWeb").value || "").trim();
        return [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `FN:${name}`,
            org ? `ORG:${org}` : "",
            phone ? `TEL;TYPE=CELL:${phone}` : "",
            email ? `EMAIL:${email}` : "",
            web ? `URL:${web}` : "",
            "END:VCARD"
        ].filter(Boolean).join("\n");
    }

    if (currentQRType === "upi") {
        const upiId = (document.getElementById("customUpiId").value || "9661692365@ybl").trim();
        const name = (document.getElementById("customUpiName").value || "Merchant").trim();
        const amount = (document.getElementById("customUpiAmount").value || "").trim();
        let upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&cu=INR`;
        if (amount && Number(amount) > 0) {
            upiUri += `&am=${Number(amount).toFixed(2)}`;
        }
        return upiUri;
    }

    if (currentQRType === "social") {
        const hubData = {
            t: (document.getElementById("socTitle").value || "My Social Links").trim(),
            ig: (document.getElementById("socInsta").value || "").trim(),
            yt: (document.getElementById("socYt").value || "").trim(),
            wa: (document.getElementById("socWa").value || "").trim(),
            wb: (document.getElementById("socWeb").value || "").trim()
        };
        const encoded = btoa(encodeURIComponent(JSON.stringify(hubData)));
        const basePath = window.location.origin + window.location.pathname.replace("index.html", "");
        return `${basePath}r.html?hub=${encoded}`;
    }

    const raw = (document.getElementById("qrInput").value || "").trim();
    if (currentQRType === "whatsapp") {
        const cleanPhone = raw.replace(/\D/g, "") || "919876543210";
        return `https://wa.me/${cleanPhone}`;
    }

    return raw || "https://example.com";
};

// =========================================================
// 3. AUTO 1:1 SQUARE RATIO LOGO PROCESSOR
// =========================================================
document.getElementById("qrLogoInput").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            // Create 1:1 Square Canvas (200x200) and center-crop the uploaded image
            const size = 200;
            const sqCanvas = document.createElement("canvas");
            sqCanvas.width = size;
            sqCanvas.height = size;
            const ctx = sqCanvas.getContext("2d");

            // White rounded background for crisp contrast inside QR
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.roundRect(0, 0, size, size, 28);
            ctx.fill();

            // Center crop 1:1 math
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            const pad = 12;

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, 20);
            ctx.clip();
            ctx.drawImage(img, sx, sy, minSide, minSide, pad, pad, size - pad * 2, size - pad * 2);
            ctx.restore();

            uploadedLogoDataUrl = sqCanvas.toDataURL("image/png");
            triggerLivePreview();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

window.clearQrLogo = function() {
    uploadedLogoDataUrl = null;
    document.getElementById("qrLogoInput").value = "";
    triggerLivePreview();
};

// Return current styling object so Dynamic QR can save it in Firestore
window.getCurrentQrCustomConfig = function() {
    return {
        dotStyle: document.getElementById("qrDotStyle").value,
        cornerStyle: document.getElementById("qrCornerStyle").value,
        fgColor: document.getElementById("fgColor").value,
        bgColor: document.getElementById("bgColor").value,
        bottomText: document.getElementById("qrBottomText").value.trim(),
        textStyle: document.getElementById("qrTextStyle").value,
        textColor: document.getElementById("qrTextColor").value,
        logoDataUrl: uploadedLogoDataUrl || null
    };
};

// =========================================================
// 4. RENDER FAST-SCAN CUSTOM QR + BOTTOM FRAME TEXT
// =========================================================
window.renderCustomQrToCanvas = async function(payloadData, customCfg = null) {
    const cfg = customCfg || window.getCurrentQrCustomConfig();
    const finalCanvas = document.getElementById("finalQrCanvas");
    const ctx = finalCanvas.getContext("2d");

    // Use Level 'M' when no logo for larger, faster-scanning modules; 'H' when logo is present
    const ecLevel = cfg.logoDataUrl ? "H" : "M";

    qrStyler.update({
        data: payloadData || "https://example.com",
        image: cfg.logoDataUrl || "",
        qrOptions: {
            errorCorrectionLevel: ecLevel
        },
        dotsOptions: {
            color: cfg.fgColor,
            type: cfg.dotStyle
        },
        backgroundOptions: {
            color: cfg.bgColor
        },
        cornersSquareOptions: {
            color: cfg.fgColor,
            type: cfg.cornerStyle
        },
        cornersDotOptions: {
            color: cfg.fgColor,
            type: cfg.cornerStyle === "dot" ? "dot" : "square"
        }
    });

    try {
        const blob = await qrStyler.getRawData("png");
        const imgUrl = URL.createObjectURL(blob);
        const qrImg = new Image();

        await new Promise((resolve) => {
            qrImg.onload = () => {
                const qrSize = 600;
                const extraBottom = cfg.bottomText ? 85 : 0;

                finalCanvas.width = qrSize;
                finalCanvas.height = qrSize + extraBottom;

                // Fill Background
                ctx.fillStyle = cfg.bgColor;
                ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

                // Draw Main Styled QR
                ctx.drawImage(qrImg, 0, 0, qrSize, qrSize);

                // Draw Custom Bottom Text if Provided
                if (cfg.bottomText) {
                    let fontSpec = "bold 34px Inter, sans-serif";
                    if (cfg.textStyle === "extrabold") fontSpec = "900 36px Inter, sans-serif";
                    if (cfg.textStyle === "italic") fontSpec = "italic bold 34px Inter, sans-serif";
                    if (cfg.textStyle === "mono") fontSpec = "bold 32px monospace";

                    ctx.font = fontSpec;
                    ctx.fillStyle = cfg.textColor || cfg.fgColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(cfg.bottomText, qrSize / 2, qrSize + 38);
                }

                URL.revokeObjectURL(imgUrl);
                resolve();
            };
            qrImg.src = imgUrl;
        });
    } catch (err) {
        console.error("QR Render Error:", err);
    }
};

function triggerLivePreview() {
    clearTimeout(renderTimeout);
    renderTimeout = setTimeout(() => {
        const data = window.getCurrentFormattedPayload();
        window.renderCustomQrToCanvas(data);
    }, 120);
}

// Attach Live Preview Listeners to All Form & Customization Inputs
const watchedIds = [
    "qrInput", "wifiSsid", "wifiPass", "wifiEnc",
    "vcName", "vcPhone", "vcEmail", "vcOrg", "vcWeb",
    "customUpiId", "customUpiName", "customUpiAmount",
    "socTitle", "socInsta", "socYt", "socWa", "socWeb",
    "qrDotStyle", "qrCornerStyle", "fgColor", "bgColor",
    "qrBottomText", "qrTextStyle", "qrTextColor"
];

window.addEventListener("DOMContentLoaded", () => {
    watchedIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", triggerLivePreview);
            el.addEventListener("change", triggerLivePreview);
        }
    });
    triggerLivePreview();
});

// Download HD PNG from Preview Canvas
document.getElementById("downloadBtn").addEventListener("click", () => {
    const canvas = document.getElementById("finalQrCanvas");
    const link = document.createElement("a");
    link.download = `SmartQR-HD-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
});

// Helper to Download Existing Saved Dynamic QR from User Dashboard
window.downloadSavedCustomQR = async function(url, fgColor, bgColor, dotStyle, bottomText, shortId) {
    await window.renderCustomQrToCanvas(url, {
        dotStyle: dotStyle || "square",
        cornerStyle: "square",
        fgColor: fgColor || "#000000",
        bgColor: bgColor || "#ffffff",
        bottomText: bottomText || "",
        textStyle: "bold",
        textColor: fgColor || "#000000",
        logoDataUrl: null
    });
    const canvas = document.getElementById("finalQrCanvas");
    const link = document.createElement("a");
    link.download = `Dynamic-QR-${shortId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
};

// =========================================================
// 5. BULK QR CODE GENERATOR (CSV / MULTI-LINE TO ZIP)
// =========================================================
document.getElementById("bulkCsvFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        document.getElementById("bulkTextInput").value = ev.target.result;
    };
    reader.readAsText(file);
});

window.generateBulkQrZip = async function() {
    const rawText = document.getElementById("bulkTextInput").value.trim();
    const statusEl = document.getElementById("bulkStatusText");
    const btn = document.getElementById("generateBulkZipBtn");

    if (!rawText) {
        alert("Kripya CSV file upload karein ya box me links paste karein!");
        return;
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 100);
    if (lines.length === 0) return;

    btn.disabled = true;
    statusEl.classList.remove("hidden");
    const zip = new JSZip();
    const cfg = window.getCurrentQrCustomConfig();

    try {
        for (let i = 0; i < lines.length; i++) {
            const item = lines[i].split(",")[0].trim(); // Supports CSV first column
            statusEl.textContent = `⏳ Generating QR ${i + 1} of ${lines.length}...`;

            const tempStyler = new QRCodeStyling({
                width: 500,
                height: 500,
                data: item,
                margin: 20,
                qrOptions: { errorCorrectionLevel: "M" },
                dotsOptions: { color: cfg.fgColor, type: cfg.dotStyle },
                backgroundOptions: { color: cfg.bgColor }
            });

            const blob = await tempStyler.getRawData("png");
            const safeName = item.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 25);
            zip.file(`QR_${i + 1}_${safeName}.png`, blob);
        }

        statusEl.textContent = "📦 Packing ZIP file...";
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `Bulk_QRs_${lines.length}_Items.zip`;
        link.click();

        statusEl.textContent = `✅ Successfully downloaded ${lines.length} QR Codes in ZIP!`;
    } catch (err) {
        alert("Bulk QR Error: " + err.message);
    } finally {
        btn.disabled = false;
    }
};
