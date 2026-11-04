// qr-engine.js
// Complete Jotform-Style 8-Frame Custom QR Studio, Hex Color Sync, 1:1 Logo & Bulk ZIP Engine

let currentQRType = "url";
let currentFrameId = 1; // 1 to 8 (Matches Jotform 8 Frame Cards)
let currentDotStyle = "square";
let uploadedLogoDataUrl = null;
let renderTimer = null;

// Initialize High-Resolution Base QR Generator
const qrStyler = new QRCodeStyling({
    width: 500,
    height: 500,
    type: "canvas",
    data: "https://example.com",
    margin: 16,
    qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "M" // Fast scan default; auto-switches to 'H' with Logo
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
// 1. SEARCH & SWITCH BETWEEN 8 QR CONTENT TYPES
// =========================================================
window.filterQrTypeButtons = function(queryText) {
    const q = (queryText || "").toLowerCase().trim();
    document.querySelectorAll("#qrTypeGrid .qr-tab").forEach(btn => {
        const text = btn.innerText.toLowerCase();
        if (!q || text.includes(q)) {
            btn.classList.remove("hidden");
        } else {
            btn.classList.add("hidden");
        }
    });
};

window.setQRType = function(type) {
    currentQRType = type;

    // Update Active Style on 2-Column Grid Buttons
    document.querySelectorAll("#qrTypeGrid .qr-tab").forEach(btn => {
        btn.classList.remove("type-btn-active", "border-2");
        btn.classList.add("border");
    });
    const activeBtn = document.getElementById(`tab-${type}`);
    if (activeBtn) {
        activeBtn.classList.add("type-btn-active", "border-2");
    }

    // Hide all input forms first
    ["form-single", "form-upi", "form-vcard", "form-wifi", "form-social"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    const singleLabel = document.getElementById("singleInputLabel");
    const singlePrefix = document.getElementById("singleInputPrefix");
    const singleInput = document.getElementById("qrInput");

    if (type === "upi") {
        document.getElementById("form-upi").classList.remove("hidden");
    } else if (type === "vcard") {
        document.getElementById("form-vcard").classList.remove("hidden");
    } else if (type === "wifi") {
        document.getElementById("form-wifi").classList.remove("hidden");
    } else if (type === "social") {
        document.getElementById("form-social").classList.remove("hidden");
    } else {
        document.getElementById("form-single").classList.remove("hidden");
        if (type === "url") {
            singleLabel.innerHTML = `URL <span class="text-red-500">*</span>`;
            singlePrefix.textContent = "https://";
            singlePrefix.classList.remove("hidden");
            singleInput.placeholder = "example.com";
        } else if (type === "whatsapp") {
            singleLabel.innerHTML = `WhatsApp Number <span class="text-red-500">*</span>`;
            singlePrefix.textContent = "wa.me/";
            singlePrefix.classList.remove("hidden");
            singleInput.placeholder = "919876543210";
        } else if (type === "phone") {
            singleLabel.innerHTML = `Phone Number <span class="text-red-500">*</span>`;
            singlePrefix.textContent = "tel:";
            singlePrefix.classList.remove("hidden");
            singleInput.placeholder = "+919876543210";
        } else if (type === "text") {
            singleLabel.innerHTML = `Plain Text / Message <span class="text-red-500">*</span>`;
            singlePrefix.classList.add("hidden");
            singleInput.placeholder = "Enter any text, note, or serial code...";
        }
    }

    triggerLivePreview();
};

window.getCurrentQRType = () => currentQRType;

// =========================================================
// 2. FORMAT PAYLOAD & STRUCTURED DATA FOR ALL 8 QR TYPES
// =========================================================
window.getCurrentFormattedPayload = function() {
    if (currentQRType === "upi") {
        const upiId = (document.getElementById("customUpiId")?.value || "9661692365@ybl").trim();
        const name = (document.getElementById("customUpiName")?.value || "Merchant").trim();
        const amount = (document.getElementById("customUpiAmount")?.value || "").trim();
        let uri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&cu=INR`;
        if (amount && Number(amount) > 0) {
            uri += `&am=${Number(amount).toFixed(2)}`;
        }
        return uri;
    }

    if (currentQRType === "vcard") {
        const name = (document.getElementById("vcName")?.value || "Contact Name").trim();
        const phone = (document.getElementById("vcPhone")?.value || "").trim();
        const email = (document.getElementById("vcEmail")?.value || "").trim();
        const org = (document.getElementById("vcOrg")?.value || "").trim();
        const web = (document.getElementById("vcWeb")?.value || "").trim();
        const addr = (document.getElementById("vcAddress")?.value || "").trim();

        return [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `FN:${name}`,
            org ? `ORG:${org}` : "",
            phone ? `TEL;TYPE=CELL:${phone}` : "",
            email ? `EMAIL:${email}` : "",
            web ? `URL:${web}` : "",
            addr ? `ADR;TYPE=WORK:;;${addr};;;;` : "",
            "END:VCARD"
        ].filter(Boolean).join("\n");
    }

    if (currentQRType === "wifi") {
        const ssid = (document.getElementById("wifiSsid")?.value || "MyWiFi").trim();
        const pass = (document.getElementById("wifiPass")?.value || "").trim();
        const enc = document.getElementById("wifiEnc")?.value || "WPA";
        return `WIFI:T:${enc};S:${ssid};P:${pass};;`;
    }

    if (currentQRType === "social") {
        const hubData = {
            t: (document.getElementById("socTitle")?.value || "Connect With Us").trim(),
            ig: (document.getElementById("socInsta")?.value || "").trim(),
            yt: (document.getElementById("socYt")?.value || "").trim(),
            wa: (document.getElementById("socWa")?.value || "").trim(),
            wb: (document.getElementById("socWeb")?.value || "").trim()
        };
        const encoded = btoa(encodeURIComponent(JSON.stringify(hubData)));
        const basePath = window.location.origin + window.location.pathname.replace("index.html", "");
        return `${basePath}r.html?hub=${encoded}`;
    }

    const raw = (document.getElementById("qrInput")?.value || "").trim();

    if (currentQRType === "whatsapp") {
        const cleanNum = raw.replace(/\D/g, "") || "919876543210";
        return `https://wa.me/${cleanNum}`;
    }

    if (currentQRType === "phone") {
        const cleanTel = raw.replace(/[^\d+]/g, "") || "+919876543210";
        return `tel:${cleanTel}`;
    }

    if (currentQRType === "text") {
        return raw || "Sample QR Text";
    }

    // Default: Website URL
    if (!raw) return "https://example.com";
    if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
    return raw;
};

// Returns structured field values so Dynamic QR can store & re-edit them later
window.getCurrentStructuredDetails = function() {
    return {
        upiId: document.getElementById("customUpiId")?.value.trim() || "",
        upiName: document.getElementById("customUpiName")?.value.trim() || "",
        upiAmount: document.getElementById("customUpiAmount")?.value.trim() || "",
        vcName: document.getElementById("vcName")?.value.trim() || "",
        vcPhone: document.getElementById("vcPhone")?.value.trim() || "",
        vcEmail: document.getElementById("vcEmail")?.value.trim() || "",
        vcOrg: document.getElementById("vcOrg")?.value.trim() || "",
        vcWeb: document.getElementById("vcWeb")?.value.trim() || "",
        vcAddr: document.getElementById("vcAddress")?.value.trim() || "",
        wifiSsid: document.getElementById("wifiSsid")?.value.trim() || "",
        wifiPass: document.getElementById("wifiPass")?.value.trim() || "",
        wifiEnc: document.getElementById("wifiEnc")?.value || "WPA",
        socTitle: document.getElementById("socTitle")?.value.trim() || "",
        socInsta: document.getElementById("socInsta")?.value.trim() || "",
        socYt: document.getElementById("socYt")?.value.trim() || "",
        socWa: document.getElementById("socWa")?.value.trim() || "",
        socWeb: document.getElementById("socWeb")?.value.trim() || "",
        rawSingle: document.getElementById("qrInput")?.value.trim() || ""
    };
};

// =========================================================
// 3. JOTFORM DESIGN TABS, 8 FRAMES & HEX COLOR SYNC
// =========================================================
window.switchDesignTab = function(tab) {
    const styleBox = document.getElementById("designTabStyle");
    const logoBox = document.getElementById("designTabLogo");
    const styleBtn = document.getElementById("tabStyleBtn");
    const logoBtn = document.getElementById("tabLogoBtn");

    if (tab === "style") {
        styleBox.classList.remove("hidden");
        logoBox.classList.add("hidden");
        styleBtn.className = "px-4 py-1.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 transition";
        logoBtn.className = "px-4 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition";
    } else {
        logoBox.classList.remove("hidden");
        styleBox.classList.add("hidden");
        logoBtn.className = "px-4 py-1.5 rounded-full text-xs font-extrabold bg-indigo-100 text-indigo-800 transition";
        styleBtn.className = "px-4 py-1.5 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition";
    }
};

window.selectJotformFrame = function(frameNum) {
    currentFrameId = frameNum;

    // Highlight selected Frame Card (1 to 8)
    document.querySelectorAll(".frame-card").forEach(card => {
        card.classList.remove("frame-card-active");
    });
    const activeCard = document.getElementById(`frame-card-${frameNum}`);
    if (activeCard) {
        activeCard.classList.add("frame-card-active");
    }

    // Lock Frame Text & Text Color when Frame 1 (Plain QR) is selected, Unlock on 2..8
    const frameTextInput = document.getElementById("frameTextInput");
    const frameLockIcon = document.getElementById("frameTextLockIcon");
    const textLockIcon = document.getElementById("textColorLockIcon");

    if (frameNum === 1) {
        frameTextInput.disabled = true;
        frameTextInput.classList.add("bg-slate-100");
        frameTextInput.classList.remove("bg-white");
        if (frameLockIcon) frameLockIcon.classList.remove("hidden");
        if (textLockIcon) textLockIcon.classList.remove("hidden");
    } else {
        frameTextInput.disabled = false;
        frameTextInput.classList.remove("bg-slate-100");
        frameTextInput.classList.add("bg-white");
        if (frameLockIcon) frameLockIcon.classList.add("hidden");
        if (textLockIcon) textLockIcon.classList.add("hidden");
    }

    triggerLivePreview();
};

window.setDotPattern = function(pattern) {
    currentDotStyle = pattern;
    const hiddenInput = document.getElementById("qrDotStyle");
    if (hiddenInput) hiddenInput.value = pattern;

    document.querySelectorAll(".dot-btn").forEach(btn => {
        btn.className = "dot-btn py-2 rounded-xl border border-slate-200 text-slate-600";
    });
    const active = document.getElementById(`dot-${pattern}`);
    if (active) {
        active.className = "dot-btn py-2 rounded-xl border-2 border-blue-600 bg-blue-50 text-blue-700";
    }
    triggerLivePreview();
};

// Synchronize Color Picker Inputs <-> Hex Text Inputs
function bindHexAndColorPicker(hexInputId, colorPickerId) {
    const hexEl = document.getElementById(hexInputId);
    const pickerEl = document.getElementById(colorPickerId);
    if (!hexEl || !pickerEl) return;

    pickerEl.addEventListener("input", () => {
        hexEl.value = pickerEl.value.toUpperCase();
        triggerLivePreview();
    });

    hexEl.addEventListener("input", () => {
        let val = hexEl.value.trim();
        if (!val.startsWith("#")) val = "#" + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
            pickerEl.value = val.toLowerCase();
            triggerLivePreview();
        }
    });
}

// =========================================================
// 4. AUTO 1:1 SQUARE LOGO UPLOAD PROCESSOR
// =========================================================
function setupLogoUploader() {
    const logoInput = document.getElementById("qrLogoInput");
    if (!logoInput) return;

    logoInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const size = 220;
                const sqCanvas = document.createElement("canvas");
                sqCanvas.width = size;
                sqCanvas.height = size;
                const ctx = sqCanvas.getContext("2d");

                // Rounded white pad behind logo
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.roundRect(0, 0, size, size, 32);
                ctx.fill();

                // Center 1:1 Square Crop
                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;
                const pad = 14;

                ctx.save();
                ctx.beginPath();
                ctx.roundRect(pad, pad, size - pad * 2, size - pad * 2, 22);
                ctx.clip();
                ctx.drawImage(img, sx, sy, minSide, minSide, pad, pad, size - pad * 2, size - pad * 2);
                ctx.restore();

                uploadedLogoDataUrl = sqCanvas.toDataURL("image/png");

                // Show thumbnail inside Logo tab
                const thumb = document.getElementById("logoThumbPreview");
                const wrap = document.getElementById("logoPreviewWrapper");
                if (thumb && wrap) {
                    thumb.src = uploadedLogoDataUrl;
                    wrap.classList.remove("hidden");
                    wrap.classList.add("flex");
                }

                triggerLivePreview();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

window.clearQrLogo = function() {
    uploadedLogoDataUrl = null;
    const logoInput = document.getElementById("qrLogoInput");
    if (logoInput) logoInput.value = "";
    const wrap = document.getElementById("logoPreviewWrapper");
    if (wrap) {
        wrap.classList.add("hidden");
        wrap.classList.remove("flex");
    }
    triggerLivePreview();
};

window.getCurrentQrCustomConfig = function() {
    return {
        frameId: currentFrameId,
        frameText: (document.getElementById("frameTextInput")?.value || "Scan Me").trim(),
        textColor: document.getElementById("frameTextColor")?.value || "#000000",
        fgColor: document.getElementById("fgColor")?.value || "#000000",
        bgColor: document.getElementById("bgColor")?.value || "#ffffff",
        dotStyle: currentDotStyle,
        logoDataUrl: uploadedLogoDataUrl || null
    };
};

// =========================================================
// 5. MASTER 8-FRAME CANVAS COMPOSITOR (JOTFORM REPLICA)
// =========================================================
function drawCornerBrackets(ctx, x, y, w, h, armLen, color, lineWidth = 12) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Top-Left Bracket
    ctx.beginPath();
    ctx.moveTo(x, y + armLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + armLen, y);
    ctx.stroke();

    // Top-Right Bracket
    ctx.beginPath();
    ctx.moveTo(x + w - armLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + armLen);
    ctx.stroke();

    // Bottom-Left Bracket
    ctx.beginPath();
    ctx.moveTo(x, y + h - armLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + armLen, y + h);
    ctx.stroke();

    // Bottom-Right Bracket
    ctx.beginPath();
    ctx.moveTo(x + w - armLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - armLen);
    ctx.stroke();
}

window.renderCustomQrToCanvas = async function(payloadData, customCfg = null) {
    const cfg = customCfg || window.getCurrentQrCustomConfig();
    const frameId = Number(cfg.frameId || 1);
    const frameText = cfg.frameText || "Scan Me";
    const fgColor = cfg.fgColor || "#000000";
    const bgColor = cfg.bgColor || "#ffffff";
    const textColor = cfg.textColor || "#000000";
    const dotStyle = cfg.dotStyle || "square";
    const logo = cfg.logoDataUrl || null;

    const finalCanvas = document.getElementById("finalQrCanvas");
    if (!finalCanvas) return;
    const ctx = finalCanvas.getContext("2d");

    // Update QRCodeStyling instance
    qrStyler.update({
        data: payloadData || "https://example.com",
        image: logo || "",
        qrOptions: {
            errorCorrectionLevel: logo ? "H" : "M"
        },
        dotsOptions: {
            color: fgColor,
            type: dotStyle
        },
        backgroundOptions: {
            color: bgColor
        },
        cornersSquareOptions: {
            color: fgColor,
            type: dotStyle === "dots" ? "dot" : (dotStyle === "rounded" ? "extra-rounded" : "square")
        },
        cornersDotOptions: {
            color: fgColor,
            type: dotStyle === "dots" ? "dot" : "square"
        }
    });

    try {
        const blob = await qrStyler.getRawData("png");
        const imgUrl = URL.createObjectURL(blob);
        const qrImg = new Image();

        await new Promise((resolve) => {
            qrImg.onload = () => {
                const qrSize = 500;

                // Determine Canvas Size Based on Selected Frame (1 to 8)
                if (frameId === 1) {
                    // Frame 1: Plain QR
                    finalCanvas.width = 600;
                    finalCanvas.height = 600;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 600, 600);
                    ctx.drawImage(qrImg, 50, 50, qrSize, qrSize);
                } 
                else if (frameId === 2) {
                    // Frame 2: QR + Plain "Scan Me" Below
                    finalCanvas.width = 600;
                    finalCanvas.height = 690;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 600, 690);
                    ctx.drawImage(qrImg, 50, 40, qrSize, qrSize);

                    ctx.font = "800 44px Inter, sans-serif";
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 300, 610);
                } 
                else if (frameId === 3) {
                    // Frame 3: Full Box Border Around Both QR & Text Inside
                    finalCanvas.width = 640;
                    finalCanvas.height = 730;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 730);

                    ctx.strokeStyle = fgColor;
                    ctx.lineWidth = 12;
                    ctx.beginPath();
                    ctx.roundRect(35, 35, 570, 660, 28);
                    ctx.stroke();

                    ctx.drawImage(qrImg, 70, 55, qrSize, qrSize);

                    ctx.font = "800 44px Inter, sans-serif";
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 625);
                } 
                else if (frameId === 4) {
                    // Frame 4: 4 Corner Brackets Around Both QR & Text Inside
                    finalCanvas.width = 640;
                    finalCanvas.height = 730;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 730);

                    drawCornerBrackets(ctx, 35, 35, 570, 660, 85, fgColor, 12);
                    ctx.drawImage(qrImg, 70, 55, qrSize, qrSize);

                    ctx.font = "800 44px Inter, sans-serif";
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 625);
                } 
                else if (frameId === 5) {
                    // Frame 5: Connected Box Border + Solid Filled Bottom Banner
                    finalCanvas.width = 640;
                    finalCanvas.height = 740;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 740);

                    // Outer Box
                    ctx.strokeStyle = fgColor;
                    ctx.lineWidth = 12;
                    ctx.beginPath();
                    ctx.roundRect(35, 35, 570, 670, 28);
                    ctx.stroke();

                    // Solid Bottom Banner
                    ctx.fillStyle = fgColor;
                    ctx.beginPath();
                    ctx.roundRect(35, 585, 570, 120, [0, 0, 24, 24]);
                    ctx.fill();

                    ctx.drawImage(qrImg, 70, 55, qrSize, qrSize);

                    // Auto-contrast text inside solid ribbon if user left both black
                    const bannerTextColor = (textColor.toLowerCase() === fgColor.toLowerCase()) ? "#ffffff" : textColor;
                    ctx.font = "800 44px Inter, sans-serif";
                    ctx.fillStyle = bannerTextColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 647);
                } 
                else if (frameId === 6) {
                    // Frame 6: Box Border Around QR + Separate Floating Pill Banner Below
                    finalCanvas.width = 640;
                    finalCanvas.height = 760;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 760);

                    // Box Around QR Only
                    ctx.strokeStyle = fgColor;
                    ctx.lineWidth = 12;
                    ctx.beginPath();
                    ctx.roundRect(45, 35, 550, 550, 28);
                    ctx.stroke();

                    ctx.drawImage(qrImg, 70, 60, qrSize, qrSize);

                    // Floating Pill Below
                    ctx.fillStyle = fgColor;
                    ctx.beginPath();
                    ctx.roundRect(85, 615, 470, 100, 24);
                    ctx.fill();

                    const pillTextColor = (textColor.toLowerCase() === fgColor.toLowerCase()) ? "#ffffff" : textColor;
                    ctx.font = "800 42px Inter, sans-serif";
                    ctx.fillStyle = pillTextColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 666);
                } 
                else if (frameId === 7) {
                    // Frame 7: Box Border Around QR Only + Plain Text Outside Below
                    finalCanvas.width = 640;
                    finalCanvas.height = 740;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 740);

                    ctx.strokeStyle = fgColor;
                    ctx.lineWidth = 12;
                    ctx.beginPath();
                    ctx.roundRect(45, 35, 550, 550, 28);
                    ctx.stroke();

                    ctx.drawImage(qrImg, 70, 60, qrSize, qrSize);

                    ctx.font = "800 44px Inter, sans-serif";
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 660);
                } 
                else if (frameId === 8) {
                    // Frame 8: 4 Corner Brackets Around QR Only + Plain Text Outside Below
                    finalCanvas.width = 640;
                    finalCanvas.height = 740;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 740);

                    drawCornerBrackets(ctx, 45, 35, 550, 550, 85, fgColor, 12);
                    ctx.drawImage(qrImg, 70, 60, qrSize, qrSize);

                    ctx.font = "800 44px Inter, sans-serif";
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 660);
                }

                URL.revokeObjectURL(imgUrl);
                resolve();
            };
            qrImg.src = imgUrl;
        });
    } catch (err) {
        console.error("Frame Compositor Error:", err);
    }
};

function triggerLivePreview() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
        const payload = window.getCurrentFormattedPayload();
        window.renderCustomQrToCanvas(payload);
    }, 100);
}

// =========================================================
// 6. COPY LINK, RESET STUDIO & DOWNLOAD HANDLERS
// =========================================================
window.copyCurrentQrLink = function() {
    const shortLinkEl = document.getElementById("shortLinkDisplay");
    let textToCopy = window.getCurrentFormattedPayload();
    if (shortLinkEl && !shortLinkEl.classList.contains("hidden") && shortLinkEl.textContent) {
        textToCopy = shortLinkEl.textContent.replace("Tracking Link: ", "").trim();
    }
    navigator.clipboard.writeText(textToCopy);
    alert(`📋 Copied to clipboard:\n${textToCopy}`);
};

window.resetQrStudio = function() {
    document.getElementById("frameTextInput").value = "Scan Me";
    document.getElementById("frameTextColor").value = "#000000";
    document.getElementById("textColorHex").value = "#000000";
    document.getElementById("fgColor").value = "#000000";
    document.getElementById("fgColorHex").value = "#000000";
    document.getElementById("bgColor").value = "#ffffff";
    document.getElementById("bgColorHex").value = "#FFFFFF";
    window.clearQrLogo();
    window.setDotPattern("square");
    window.selectJotformFrame(1);
};

// Download Existing Saved Dynamic QR from User Dashboard with its saved Frame
window.downloadSavedCustomQR = async function(url, fgColor, bgColor, dotStyle, frameText, shortId, frameId = 1, textColor = "#000000") {
    await window.renderCustomQrToCanvas(url, {
        frameId: frameId || 1,
        frameText: frameText || "Scan Me",
        textColor: textColor || "#000000",
        fgColor: fgColor || "#000000",
        bgColor: bgColor || "#ffffff",
        dotStyle: dotStyle || "square",
        logoDataUrl: null
    });
    const canvas = document.getElementById("finalQrCanvas");
    const link = document.createElement("a");
    link.download = `Dynamic-QR-${shortId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
};

// =========================================================
// 7. BULK QR CODE GENERATOR (CSV / MULTI-LINE TO ZIP)
// =========================================================
window.generateBulkQrZip = async function() {
    const rawText = document.getElementById("bulkTextInput")?.value.trim() || "";
    const statusEl = document.getElementById("bulkStatusText");
    const btn = document.getElementById("generateBulkZipBtn");

    if (!rawText) {
        alert("Kripya CSV file upload karein ya box me links paste karein!");
        return;
    }

    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 100);
    if (!lines.length) return;

    btn.disabled = true;
    statusEl.classList.remove("hidden");
    const zip = new JSZip();
    const cfg = window.getCurrentQrCustomConfig();

    try {
        for (let i = 0; i < lines.length; i++) {
            const item = lines[i].split(",")[0].trim();
            statusEl.textContent = `⏳ Generating QR ${i + 1} of ${lines.length}...`;

            const tempStyler = new QRCodeStyling({
                width: 500,
                height: 500,
                data: item,
                margin: 18,
                qrOptions: { errorCorrectionLevel: "M" },
                dotsOptions: { color: cfg.fgColor, type: cfg.dotStyle },
                backgroundOptions: { color: cfg.bgColor }
            });

            const blob = await tempStyler.getRawData("png");
            const safeName = item.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 25);
            zip.file(`QR_${i + 1}_${safeName}.png`, blob);
        }

        statusEl.textContent = "📦 Packing ZIP archive...";
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `Bulk_QRs_${lines.length}_Codes.zip`;
        link.click();

        statusEl.textContent = `✅ Successfully downloaded ${lines.length} QR Codes in ZIP!`;
    } catch (err) {
        alert("Bulk QR Error: " + err.message);
    } finally {
        btn.disabled = false;
    }
};

// =========================================================
// 8. INITIALIZE LISTENERS ON DOM LOAD
// =========================================================
window.addEventListener("DOMContentLoaded", () => {
    bindHexAndColorPicker("textColorHex", "frameTextColor");
    bindHexAndColorPicker("fgColorHex", "fgColor");
    bindHexAndColorPicker("bgColorHex", "bgColor");
    setupLogoUploader();

    const watchedInputs = [
        "qrInput", "customUpiId", "customUpiName", "customUpiAmount",
        "vcName", "vcPhone", "vcEmail", "vcOrg", "vcWeb", "vcAddress",
        "wifiSsid", "wifiPass", "wifiEnc",
        "socTitle", "socInsta", "socYt", "socWa", "socWeb",
        "frameTextInput"
    ];

    watchedInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", triggerLivePreview);
            el.addEventListener("change", triggerLivePreview);
        }
    });

    const dlBtn = document.getElementById("downloadBtn");
    if (dlBtn) {
        dlBtn.addEventListener("click", () => {
            const canvas = document.getElementById("finalQrCanvas");
            const link = document.createElement("a");
            link.download = `SmartQR-HD-${Date.now()}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        });
    }

    const bulkCsv = document.getElementById("bulkCsvFile");
    if (bulkCsv) {
        bulkCsv.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                document.getElementById("bulkTextInput").value = ev.target.result;
            };
            reader.readAsText(file);
        });
    }

    triggerLivePreview();
});
