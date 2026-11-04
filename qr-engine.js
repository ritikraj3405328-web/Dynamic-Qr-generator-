// qr-engine.js
// Complete 8 Artistic Themes, Unique Dots & Eyes, Scenic Art Poster, 1:1 Logo & Styled Bulk CSV ZIP Engine

let currentQRType = "url";
let currentThemeKey = "elegant";
let currentFrameId = 1; // 1 to 8
let currentDotStyle = "square";
let currentEyeOuter = "extra-rounded";
let currentEyeInner = "dot";
let uploadedLogoDataUrl = null;
let renderTimer = null;

// 8 Pre-Configured Artistic Themes Dictionary
const ARTISTIC_THEMES = {
    elegant: {
        name: "Elegant Simplicity",
        useGradient: true,
        color1: "#0f172a",
        color2: "#334155",
        eyeColor: "#0f172a",
        bgColor: "#ffffff",
        textColor: "#0f172a",
        dotStyle: "classy-rounded",
        eyeOuter: "extra-rounded",
        eyeInner: "dot",
        frameId: 1,
        fontFamily: "Inter"
    },
    nature: {
        name: "Nature Inspired",
        useGradient: true,
        color1: "#065f46",
        color2: "#10b981",
        eyeColor: "#047857",
        bgColor: "#f0fdf4",
        textColor: "#065f46",
        dotStyle: "extra-rounded",
        eyeOuter: "dot",
        eyeInner: "dot",
        frameId: 2,
        fontFamily: "Inter"
    },
    romantic: {
        name: "Soft & Romantic",
        useGradient: true,
        color1: "#e11d48",
        color2: "#fb7185",
        eyeColor: "#be123c",
        bgColor: "#fff1f2",
        textColor: "#be123c",
        dotStyle: "dots",
        eyeOuter: "dot",
        eyeInner: "dot",
        frameId: 6,
        fontFamily: "Pacifico"
    },
    luxe: {
        name: "Luxe Golden Touch",
        useGradient: true,
        color1: "#92400e",
        color2: "#d97706",
        eyeColor: "#78350f",
        bgColor: "#fffbeb",
        textColor: "#78350f",
        dotStyle: "classy",
        eyeOuter: "square",
        eyeInner: "square",
        frameId: 3,
        fontFamily: "Playfair Display"
    },
    electric: {
        name: "Electric Vibes",
        useGradient: true,
        color1: "#7c3aed",
        color2: "#ec4899",
        eyeColor: "#4f46e5",
        bgColor: "#ffffff",
        textColor: "#6d28d9",
        dotStyle: "dots",
        eyeOuter: "extra-rounded",
        eyeInner: "dot",
        frameId: 2,
        fontFamily: "Pacifico"
    },
    minimal: {
        name: "Minimalist Cool",
        useGradient: true,
        color1: "#0284c7",
        color2: "#2563eb",
        eyeColor: "#0369a1",
        bgColor: "#f8fafc",
        textColor: "#0f172a",
        dotStyle: "rounded",
        eyeOuter: "extra-rounded",
        eyeInner: "dot",
        frameId: 4,
        fontFamily: "Inter"
    },
    playful: {
        name: "Bold & Playful",
        useGradient: true,
        color1: "#ea580c",
        color2: "#2563eb",
        eyeColor: "#db2777",
        bgColor: "#ffffff",
        textColor: "#db2777",
        dotStyle: "dots",
        eyeOuter: "dot",
        eyeInner: "dot",
        frameId: 5,
        fontFamily: "Inter"
    },
    scenic: {
        name: "Scenic Mountain Art",
        useGradient: true,
        color1: "#115e59",
        color2: "#0f172a",
        eyeColor: "#be123c",
        bgColor: "#fff7ed",
        textColor: "#134e4a",
        dotStyle: "rounded",
        eyeOuter: "extra-rounded",
        eyeInner: "dot",
        frameId: 8,
        fontFamily: "Playfair Display"
    }
};

// Base High-Resolution QRCodeStyling Instance
const qrStyler = new QRCodeStyling({
    width: 500,
    height: 500,
    type: "canvas",
    data: "https://example.com",
    margin: 16,
    qrOptions: {
        typeNumber: 0,
        mode: "Byte",
        errorCorrectionLevel: "M"
    },
    imageOptions: {
        hideBackgroundDots: true,
        imageSize: 0.28,
        margin: 8,
        crossOrigin: "anonymous"
    },
    dotsOptions: {
        color: "#0f172a",
        type: "classy-rounded"
    },
    backgroundOptions: {
        color: "#ffffff"
    },
    cornersSquareOptions: {
        color: "#0f172a",
        type: "extra-rounded"
    },
    cornersDotOptions: {
        color: "#0f172a",
        type: "dot"
    }
});

// =========================================================
// 1. STUDIO 6-TAB NAVIGATION & 8 ARTISTIC THEMES
// =========================================================
window.openStudioPanel = function(panelName) {
    const panels = ["themes", "dots", "frames", "colors", "logo", "text"];
    panels.forEach(p => {
        document.getElementById(`studio-panel-${p}`)?.classList.add("hidden");
        document.getElementById(`st-tab-${p}`)?.classList.remove("studio-tab-active");
    });

    document.getElementById(`studio-panel-${panelName}`)?.classList.remove("hidden");
    document.getElementById(`st-tab-${panelName}`)?.classList.add("studio-tab-active");
};

window.applyArtisticTheme = function(themeKey) {
    const t = ARTISTIC_THEMES[themeKey];
    if (!t) return;
    currentThemeKey = themeKey;

    // Highlight active theme card
    document.querySelectorAll(".theme-card").forEach(btn => btn.classList.remove("theme-card-active"));
    document.getElementById(`theme-${themeKey}`)?.classList.add("theme-card-active");

    const badge = document.getElementById("activeStyleBadge");
    if (badge) badge.textContent = `Theme: ${t.name}`;

    // Populate Controls with Theme Settings
    document.getElementById("useGradientToggle").checked = t.useGradient;
    document.getElementById("fgColor").value = t.color1;
    document.getElementById("fgColorHex").value = t.color1.toUpperCase();
    document.getElementById("gradColor2").value = t.color2;
    document.getElementById("gradColor2Hex").value = t.color2.toUpperCase();
    document.getElementById("eyeColor").value = t.eyeColor;
    document.getElementById("eyeColorHex").value = t.eyeColor.toUpperCase();
    document.getElementById("bgColor").value = t.bgColor;
    document.getElementById("bgColorHex").value = t.bgColor.toUpperCase();
    document.getElementById("frameTextColor").value = t.textColor;
    document.getElementById("textColorHex").value = t.textColor.toUpperCase();
    document.getElementById("qrFontFamily").value = t.fontFamily;

    currentEyeOuter = t.eyeOuter;
    currentEyeInner = t.eyeInner;
    document.getElementById("eyeOuterSelect").value = t.eyeOuter;
    document.getElementById("eyeInnerSelect").value = t.eyeInner;

    window.setDotPattern(t.dotStyle, false);
    window.selectJotformFrame(t.frameId, false);

    triggerLivePreview();
};

window.setDotPattern = function(pattern, shouldRender = true) {
    currentDotStyle = pattern;
    document.querySelectorAll(".dot-btn").forEach(btn => {
        btn.className = "dot-btn py-2.5 px-2 rounded-xl border border-slate-300 bg-white text-slate-700";
    });
    const active = document.getElementById(`dot-${pattern}`);
    if (active) {
        active.className = "dot-btn py-2.5 px-2 rounded-xl border-2 border-blue-600 bg-blue-50 text-blue-700 font-extrabold";
    }
    if (shouldRender) triggerLivePreview();
};

window.updateEyesStyle = function() {
    currentEyeOuter = document.getElementById("eyeOuterSelect")?.value || "extra-rounded";
    currentEyeInner = document.getElementById("eyeInnerSelect")?.value || "dot";
    triggerLivePreview();
};

window.selectJotformFrame = function(frameNum, shouldRender = true) {
    currentFrameId = frameNum;
    document.querySelectorAll(".frame-card").forEach(card => card.classList.remove("frame-card-active"));
    document.getElementById(`frame-card-${frameNum}`)?.classList.add("frame-card-active");
    if (shouldRender) triggerLivePreview();
};

// =========================================================
// 2. QR CONTENT TYPE SWITCHING & PAYLOAD BUILDER
// =========================================================
window.filterQrTypeButtons = function(queryText) {
    const q = (queryText || "").toLowerCase().trim();
    document.querySelectorAll("#qrTypeGrid .qr-tab").forEach(btn => {
        const txt = btn.innerText.toLowerCase();
        btn.classList.toggle("hidden", Boolean(q && !txt.includes(q)));
    });
};

window.setQRType = function(type) {
    currentQRType = type;

    document.querySelectorAll("#qrTypeGrid .qr-tab").forEach(btn => {
        btn.classList.remove("type-btn-active", "border-2");
        btn.classList.add("border");
    });
    document.getElementById(`tab-${type}`)?.classList.add("type-btn-active", "border-2");

    ["form-single", "form-upi", "form-vcard", "form-wifi", "form-social"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });

    const singleLabel = document.getElementById("singleInputLabel");
    const singlePrefix = document.getElementById("singleInputPrefix");
    const singleInput = document.getElementById("qrInput");

    if (type === "upi") {
        document.getElementById("form-upi")?.classList.remove("hidden");
    } else if (type === "vcard") {
        document.getElementById("form-vcard")?.classList.remove("hidden");
    } else if (type === "wifi") {
        document.getElementById("form-wifi")?.classList.remove("hidden");
    } else if (type === "social") {
        document.getElementById("form-social")?.classList.remove("hidden");
    } else {
        document.getElementById("form-single")?.classList.remove("hidden");
        if (type === "url") {
            singleLabel.innerHTML = `Website URL <span class="text-red-500">*</span>`;
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
            singleLabel.innerHTML = `Plain Text / Notice <span class="text-red-500">*</span>`;
            singlePrefix.classList.add("hidden");
            singleInput.placeholder = "Type message or code (Tip: Use Dynamic mode for long text!)";
        }
    }

    triggerLivePreview();
};

window.getCurrentQRType = () => currentQRType;

window.getCurrentFormattedPayload = function() {
    if (currentQRType === "upi") {
        const upiId = (document.getElementById("customUpiId")?.value || "9661692365@ybl").trim();
        const name = (document.getElementById("customUpiName")?.value || "Merchant").trim();
        const amount = (document.getElementById("customUpiAmount")?.value || "").trim();
        let uri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name)}&cu=INR`;
        if (amount && Number(amount) > 0) uri += `&am=${Number(amount).toFixed(2)}`;
        return uri;
    }

    if (currentQRType === "vcard") {
        const name = (document.getElementById("vcName")?.value || "Contact").trim();
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
            t: (document.getElementById("socTitle")?.value || "My Social Hub").trim(),
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
    if (currentQRType === "whatsapp") return `https://wa.me/${raw.replace(/\D/g, "") || "919876543210"}`;
    if (currentQRType === "phone") return `tel:${raw.replace(/[^\d+]/g, "") || "+919876543210"}`;
    if (currentQRType === "text") return raw || "SmartQR Text";

    if (!raw) return "https://example.com";
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
};

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
// 3. 1:1 PHOTO LOGO & QUICK EMOJI BADGE GENERATOR
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

                // Circular white badge with dashed accent ring (Like Screenshot 20)
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = document.getElementById("fgColor")?.value || "#10b981";
                ctx.lineWidth = 6;
                ctx.setLineDash([12, 8]);
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
                ctx.stroke();
                ctx.setLineDash([]);

                const minSide = Math.min(img.width, img.height);
                const sx = (img.width - minSide) / 2;
                const sy = (img.height - minSide) / 2;
                const pad = 20;

                ctx.save();
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2 - pad, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, sx, sy, minSide, minSide, pad, pad, size - pad * 2, size - pad * 2);
                ctx.restore();

                uploadedLogoDataUrl = sqCanvas.toDataURL("image/png");
                showLogoThumb(uploadedLogoDataUrl);
                triggerLivePreview();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

window.setQuickEmojiLogo = function(emojiChar) {
    const size = 200;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = document.getElementById("fgColor")?.value || "#2563eb";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(emojiChar, size / 2, size / 2 + 6);

    uploadedLogoDataUrl = c.toDataURL("image/png");
    showLogoThumb(uploadedLogoDataUrl);
    triggerLivePreview();
};

function showLogoThumb(dataUrl) {
    const thumb = document.getElementById("logoThumbPreview");
    const wrap = document.getElementById("logoPreviewWrapper");
    if (thumb && wrap) {
        thumb.src = dataUrl;
        wrap.classList.remove("hidden");
        wrap.classList.add("flex");
    }
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
        themeKey: currentThemeKey,
        useGradient: document.getElementById("useGradientToggle")?.checked ?? true,
        frameId: currentFrameId,
        frameText: (document.getElementById("frameTextInput")?.value || "Scan Me").trim(),
        fontFamily: document.getElementById("qrFontFamily")?.value || "Inter",
        textColor: document.getElementById("frameTextColor")?.value || "#0f172a",
        fgColor: document.getElementById("fgColor")?.value || "#0f172a",
        gradColor2: document.getElementById("gradColor2")?.value || "#2563eb",
        eyeColor: document.getElementById("eyeColor")?.value || "#0f172a",
        bgColor: document.getElementById("bgColor")?.value || "#ffffff",
        dotStyle: currentDotStyle,
        eyeOuter: currentEyeOuter,
        eyeInner: currentEyeInner,
        logoDataUrl: uploadedLogoDataUrl || null
    };
};

// =========================================================
// 4. MASTER ARTISTIC & SCENIC CANVAS COMPOSITOR
// =========================================================
function drawCornerBrackets(ctx, x, y, w, h, armLen, color, lineWidth = 12) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(x, y + armLen); ctx.lineTo(x, y); ctx.lineTo(x + armLen, y);
    ctx.moveTo(x + w - armLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + armLen);
    ctx.moveTo(x, y + h - armLen); ctx.lineTo(x, y + h); ctx.lineTo(x + armLen, y + h);
    ctx.moveTo(x + w - armLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - armLen);
    ctx.stroke();
}

// Draws Scenic Sunset, Mountains & Pine Trees Poster Card (Like Screenshot 18)
function drawScenicMountainBackdrop(ctx, w, h) {
    // Sunset Sky Gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, "#fecdd3");   // Soft Rose
    skyGrad.addColorStop(0.45, "#fde68a"); // Warm Sunset Gold
    skyGrad.addColorStop(1, "#99f6e4");   // Mint Horizon
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Glowing Sun Circle
    ctx.fillStyle = "#fb7185";
    ctx.beginPath();
    ctx.arc(w / 2, 130, 65, 0, Math.PI * 2);
    ctx.fill();

    // Distant Mountains
    ctx.fillStyle = "#0f766e";
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h - 180);
    ctx.lineTo(180, h - 310);
    ctx.lineTo(340, h - 200);
    ctx.lineTo(500, h - 330);
    ctx.lineTo(w, h - 190);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Foreground Mountains
    ctx.fillStyle = "#115e59";
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(120, h - 220);
    ctx.lineTo(290, h - 130);
    ctx.lineTo(440, h - 240);
    ctx.lineTo(w, h - 110);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Pine Tree Silhouettes at Bottom
    const drawPine = (cx, baseY, treeH) => {
        ctx.fillStyle = "#042f2e";
        for (let layer = 0; layer < 3; layer++) {
            const topY = baseY - treeH + layer * 18;
            const bY = baseY - (2 - layer) * 18;
            const halfW = 18 + layer * 10;
            ctx.beginPath();
            ctx.moveTo(cx, topY);
            ctx.lineTo(cx - halfW, bY);
            ctx.lineTo(cx + halfW, bY);
            ctx.closePath();
            ctx.fill();
        }
    };

    [55, 110, 530, 585].forEach((xPos, idx) => {
        drawPine(xPos, h - 15, 75 + (idx % 2) * 20);
    });
}

window.renderCustomQrToCanvas = async function(payloadData, customCfg = null) {
    const cfg = customCfg || window.getCurrentQrCustomConfig();
    const frameId = Number(cfg.frameId || 1);
    const frameText = cfg.frameText || "Scan Me";
    const fontFamily = cfg.fontFamily || "Inter";
    const fgColor = cfg.fgColor || "#0f172a";
    const gradColor2 = cfg.gradColor2 || "#2563eb";
    const eyeColor = cfg.eyeColor || fgColor;
    const bgColor = cfg.bgColor || "#ffffff";
    const textColor = cfg.textColor || "#0f172a";
    const dotStyle = cfg.dotStyle || "square";
    const eyeOuter = cfg.eyeOuter || "extra-rounded";
    const eyeInner = cfg.eyeInner || "dot";
    const useGradient = cfg.useGradient ?? true;
    const logo = cfg.logoDataUrl || null;

    const finalCanvas = document.getElementById("finalQrCanvas");
    if (!finalCanvas) return;
    const ctx = finalCanvas.getContext("2d");

    // Configure Dots Options (Solid or Rich Gradient)
    const dotsConfig = useGradient
        ? {
            type: dotStyle,
            gradient: {
                type: "linear",
                rotation: Math.PI / 4,
                colorStops: [
                    { offset: 0, color: fgColor },
                    { offset: 1, color: gradColor2 }
                ]
            }
        }
        : {
            color: fgColor,
            type: dotStyle
        };

    qrStyler.update({
        data: payloadData || "https://example.com",
        image: logo || "",
        qrOptions: {
            errorCorrectionLevel: logo ? "H" : "M"
        },
        dotsOptions: dotsConfig,
        backgroundOptions: {
            color: frameId === 8 ? "#ffffff" : bgColor
        },
        cornersSquareOptions: {
            color: eyeColor,
            type: eyeOuter
        },
        cornersDotOptions: {
            color: gradColor2 || eyeColor,
            type: eyeInner
        }
    });

    try {
        const blob = await qrStyler.getRawData("png");
        const imgUrl = URL.createObjectURL(blob);
        const qrImg = new Image();

        await new Promise((resolve) => {
            qrImg.onload = () => {
                const qrSize = 500;
                const fontStr = fontFamily === "Pacifico"
                    ? `42px 'Pacifico', cursive`
                    : `800 42px '${fontFamily}', sans-serif`;

                if (frameId === 8) {
                    // Frame 8: Scenic Mountain Art Poster Card (Screenshot 18 Style)
                    finalCanvas.width = 640;
                    finalCanvas.height = 760;
                    drawScenicMountainBackdrop(ctx, 640, 760);

                    // Crisp White Rounded Card for Fast QR Scanning
                    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
                    ctx.beginPath();
                    ctx.roundRect(70, 75, 500, 500, 32);
                    ctx.fill();

                    ctx.drawImage(qrImg, 85, 90, 470, 470);

                    // Frosted Bottom Text Pill
                    ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
                    ctx.beginPath();
                    ctx.roundRect(120, 610, 400, 86, 43);
                    ctx.fill();

                    ctx.font = fontStr;
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 654);
                } 
                else if (frameId === 1) {
                    finalCanvas.width = 600;
                    finalCanvas.height = 600;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 600, 600);
                    ctx.drawImage(qrImg, 50, 50, qrSize, qrSize);
                } 
                else if (frameId === 2) {
                    // Frame 2: Dashed/Clean Bottom Banner (Like Screenshot 20)
                    finalCanvas.width = 620;
                    finalCanvas.height = 720;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 620, 720);
                    ctx.drawImage(qrImg, 60, 40, qrSize, qrSize);

                    ctx.strokeStyle = gradColor2 || fgColor;
                    ctx.lineWidth = 4;
                    ctx.setLineDash([10, 8]);
                    ctx.beginPath();
                    ctx.roundRect(75, 575, 470, 92, 22);
                    ctx.stroke();
                    ctx.setLineDash([]);

                    ctx.font = fontStr;
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 310, 622);
                } 
                else if (frameId === 3) {
                    finalCanvas.width = 640;
                    finalCanvas.height = 730;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 730);

                    ctx.strokeStyle = fgColor;
                    ctx.lineWidth = 12;
                    ctx.beginPath();
                    ctx.roundRect(35, 35, 570, 660, 32);
                    ctx.stroke();

                    ctx.drawImage(qrImg, 70, 55, qrSize, qrSize);
                    ctx.font = fontStr;
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 625);
                } 
                else if (frameId === 4) {
                    finalCanvas.width = 640;
                    finalCanvas.height = 730;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 730);

                    drawCornerBrackets(ctx, 35, 35, 570, 660, 85, fgColor, 12);
                    ctx.drawImage(qrImg, 70, 55, qrSize, qrSize);

                    ctx.font = fontStr;
                    ctx.fillStyle = textColor;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 625);
                } 
                else if (frameId === 5) {
                    finalCanvas.width = 640;
                    finalCanvas.height = 740;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 740);

                    ctx.strokeStyle = fgColor;
                    ctx.lineWidth = 12;
                    ctx.beginPath();
                    ctx.roundRect(35, 35, 570, 670, 28);
                    ctx.stroke();

                    ctx.fillStyle = fgColor;
                    ctx.beginPath();
                    ctx.roundRect(35, 585, 570, 120, [0, 0, 24, 24]);
                    ctx.fill();

                    ctx.drawImage(qrImg, 70, 55, qrSize, qrSize);
                    ctx.font = fontStr;
                    ctx.fillStyle = "#ffffff";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 647);
                } 
                else if (frameId === 6) {
                    finalCanvas.width = 640;
                    finalCanvas.height = 760;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, 640, 760);

                    ctx.strokeStyle = fgColor;
                    ctx.lineWidth = 10;
                    ctx.beginPath();
                    ctx.roundRect(45, 35, 550, 550, 32);
                    ctx.stroke();

                    ctx.drawImage(qrImg, 70, 60, qrSize, qrSize);

                    ctx.fillStyle = fgColor;
                    ctx.beginPath();
                    ctx.roundRect(85, 615, 470, 100, 50);
                    ctx.fill();

                    ctx.font = fontStr;
                    ctx.fillStyle = "#ffffff";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(frameText, 320, 666);
                } 
                else {
                    // Frame 7: Box Border + Outside Text
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
                    ctx.font = fontStr;
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
        console.error("Artistic QR Render Error:", err);
    }
};

window.triggerLivePreview = function() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
        const payload = window.getCurrentFormattedPayload();
        window.renderCustomQrToCanvas(payload);
    }, 90);
};

// =========================================================
// 5. STYLED BULK QR GENERATOR (WITH STRICT TRIAL LIMIT)
// =========================================================
window.generateBulkQrZip = async function() {
    const rawText = document.getElementById("bulkTextInput")?.value.trim() || "";
    const selectedTheme = document.getElementById("bulkThemeSelect")?.value || "current";
    const statusEl = document.getElementById("bulkStatusText");
    const btn = document.getElementById("generateBulkZipBtn");

    if (!rawText) {
        alert("Kripya CSV file upload karein ya box me links paste karein!");
        return;
    }

    // Check Free Trial Quota Before Generating Bulk ZIP
    const isPro = window.isUserProPlan ? window.isUserProPlan() : false;
    let lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    if (!isPro) {
        if (window.checkAndConsumeTrialQuota && !window.checkAndConsumeTrialQuota("bulkRun")) {
            return; // Redirected to #pricing
        }
        if (lines.length > 5) {
            alert("⚠️ Free Trial Limit: Free trial me ek baar me maximum 5 Bulk QR codes generate hote hain. 500+ Bulk QRs ke liye ₹499.00 Pro Plan upgrade karein! Abhi pehle 5 QRs generate kiye ja rahe hain.");
            lines = lines.slice(0, 5);
        }
    } else {
        lines = lines.slice(0, 500);
    }

    btn.disabled = true;
    statusEl.classList.remove("hidden");
    const zip = new JSZip();

    // Determine Theme Config for Bulk QRs
    const themeObj = (selectedTheme !== "current" && ARTISTIC_THEMES[selectedTheme])
        ? ARTISTIC_THEMES[selectedTheme]
        : {
            color1: document.getElementById("fgColor")?.value || "#0f172a",
            color2: document.getElementById("gradColor2")?.value || "#2563eb",
            eyeColor: document.getElementById("eyeColor")?.value || "#0f172a",
            bgColor: document.getElementById("bgColor")?.value || "#ffffff",
            dotStyle: currentDotStyle,
            eyeOuter: currentEyeOuter,
            eyeInner: currentEyeInner
        };

    try {
        for (let i = 0; i < lines.length; i++) {
            const item = lines[i].split(",")[0].trim();
            statusEl.textContent = `⏳ Designing Styled QR ${i + 1} of ${lines.length}...`;

            const tempStyler = new QRCodeStyling({
                width: 520,
                height: 520,
                data: item,
                margin: 18,
                qrOptions: { errorCorrectionLevel: "M" },
                dotsOptions: {
                    type: themeObj.dotStyle,
                    gradient: {
                        type: "linear",
                        rotation: Math.PI / 4,
                        colorStops: [
                            { offset: 0, color: themeObj.color1 },
                            { offset: 1, color: themeObj.color2 }
                        ]
                    }
                },
                backgroundOptions: { color: themeObj.bgColor },
                cornersSquareOptions: { color: themeObj.eyeColor, type: themeObj.eyeOuter },
                cornersDotOptions: { color: themeObj.color2, type: themeObj.eyeInner }
            });

            const blob = await tempStyler.getRawData("png");
            const safeName = item.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 28);
            zip.file(`Styled_QR_${i + 1}_${safeName}.png`, blob);
        }

        statusEl.textContent = "📦 Packing Styled ZIP archive...";
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(zipBlob);
        link.download = `SmartQR_Bulk_${lines.length}_Codes.zip`;
        link.click();

        statusEl.textContent = `✅ Downloaded ${lines.length} Styled QR Codes in ZIP!`;
    } catch (err) {
        alert("Bulk QR Error: " + err.message);
    } finally {
        btn.disabled = false;
    }
};

// =========================================================
// 6. DOWNLOAD, COPY, RESET & INITIALIZATION
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
    window.clearQrLogo();
    document.getElementById("frameTextInput").value = "Scan Me";
    window.applyArtisticTheme("elegant");
};

window.downloadSavedCustomQR = async function(url, fgColor, bgColor, dotStyle, frameText, shortId, frameId = 1, textColor = "#0f172a", gradColor2 = "#2563eb") {
    await window.renderCustomQrToCanvas(url, {
        useGradient: true,
        frameId: frameId || 1,
        frameText: frameText || "Scan Me",
        fontFamily: "Inter",
        textColor: textColor || "#0f172a",
        fgColor: fgColor || "#0f172a",
        gradColor2: gradColor2 || fgColor || "#2563eb",
        eyeColor: fgColor || "#0f172a",
        bgColor: bgColor || "#ffffff",
        dotStyle: dotStyle || "classy-rounded",
        eyeOuter: "extra-rounded",
        eyeInner: "dot",
        logoDataUrl: null
    });
    const canvas = document.getElementById("finalQrCanvas");
    const link = document.createElement("a");
    link.download = `Dynamic-QR-${shortId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
};

function bindHexColorSync(hexId, pickerId) {
    const hexEl = document.getElementById(hexId);
    const pickEl = document.getElementById(pickerId);
    if (!hexEl || !pickEl) return;

    pickEl.addEventListener("input", () => {
        hexEl.value = pickEl.value.toUpperCase();
        window.triggerLivePreview();
    });
    hexEl.addEventListener("input", () => {
        let v = hexEl.value.trim();
        if (!v.startsWith("#")) v = "#" + v;
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) {
            pickEl.value = v.toLowerCase();
            window.triggerLivePreview();
        }
    });
}

window.addEventListener("DOMContentLoaded", () => {
    bindHexColorSync("fgColorHex", "fgColor");
    bindHexColorSync("gradColor2Hex", "gradColor2");
    bindHexColorSync("eyeColorHex", "eyeColor");
    bindHexColorSync("bgColorHex", "bgColor");
    bindHexColorSync("textColorHex", "frameTextColor");
    setupLogoUploader();

    const watched = [
        "qrInput", "customUpiId", "customUpiName", "customUpiAmount",
        "vcName", "vcPhone", "vcEmail", "vcOrg", "vcWeb", "vcAddress",
        "wifiSsid", "wifiPass", "wifiEnc",
        "socTitle", "socInsta", "socYt", "socWa", "socWeb",
        "frameTextInput"
    ];
    watched.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener("input", window.triggerLivePreview);
            el.addEventListener("change", window.triggerLivePreview);
        }
    });

    // Download Button with Strict Free Trial Quota Check
    const dlBtn = document.getElementById("downloadBtn");
    if (dlBtn) {
        dlBtn.addEventListener("click", () => {
            if (window.checkAndConsumeTrialQuota && !window.checkAndConsumeTrialQuota("customDownload")) {
                return; // Quota exhausted -> redirected to #pricing
            }
            const canvas = document.getElementById("finalQrCanvas");
            const link = document.createElement("a");
            link.download = `SmartQR-${currentThemeKey}-${Date.now()}.png`;
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

    window.applyArtisticTheme("elegant");
});
