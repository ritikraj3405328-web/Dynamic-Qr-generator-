// app.js
import { 
    auth, provider, db, 
    MASTER_ADMIN_EMAIL, ADMIN_UPI_ID, ADMIN_MERCHANT_NAME, PRO_PLAN_PRICE, FREE_TRIAL_DAYS,
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp 
} from "./firebase-config.js";

// Global State
let currentUser = null;
let currentUserData = null; // Stores { plan: 'trial'|'pro', trialStartMs, daysLeft, isExpired }
let currentQRType = "url";
let isDynamicMode = false;
let authMode = "login"; // 'login' or 'signup'
let cachedUserQRs = []; // For Analytics & CSV Export

// =========================================================
// 1. MOBILE BACK-BUTTON ROUTER & MODAL CONTROLLER
// =========================================================
window.toggleSidebar = function(forceClose = false) {
    const drawer = document.getElementById("sidebarDrawer");
    const overlay = document.getElementById("sidebarOverlay");
    const isClosed = drawer.classList.contains("-translate-x-full");

    if (forceClose || !isClosed) {
        drawer.classList.add("-translate-x-full");
        overlay.classList.add("hidden");
    } else {
        drawer.classList.remove("-translate-x-full");
        overlay.classList.remove("hidden");
    }
};

function closeAllModalsUI() {
    document.getElementById("trialPromoModal").classList.add("hidden");
    document.getElementById("authModal").classList.add("hidden");
    document.getElementById("upiModal").classList.add("hidden");
    document.getElementById("editModal").classList.add("hidden");
    window.toggleSidebar(true);
}

function handleRoute() {
    const hash = window.location.hash || "#home";
    closeAllModalsUI();

    // Check if Hash is a Popup Modal (So Mobile Back Button closes the modal!)
    if (hash === "#trial") {
        document.getElementById("trialPromoModal").classList.remove("hidden");
        return;
    }
    if (hash === "#login" || hash === "#signup") {
        setupAuthModalUI(hash.replace("#", ""));
        document.getElementById("authModal").classList.remove("hidden");
        return;
    }
    if (hash === "#upi") {
        if (!currentUser) {
            alert("Pro Plan upgrade karne ke liye pehle Sign In karein!");
            window.location.hash = "#login";
            return;
        }
        renderUpiModalQR();
        document.getElementById("upiModal").classList.remove("hidden");
        return;
    }
    if (hash === "#edit") {
        document.getElementById("editModal").classList.remove("hidden");
        return;
    }

    // Hide all main page views
    const views = ["view-home", "view-dashboard", "view-analytics", "view-pricing", "view-admin"];
    views.forEach(id => document.getElementById(id).classList.add("hidden"));

    // Route to Selected Page View
    if (hash === "#dashboard") {
        if (!currentUser) {
            window.location.hash = "#login";
            return;
        }
        document.getElementById("view-dashboard").classList.remove("hidden");
        loadCustomerDashboard();
    } 
    else if (hash === "#analytics") {
        if (!currentUser) {
            window.location.hash = "#login";
            return;
        }
        if (currentUserData && currentUserData.isExpired) {
            alert("⚠️ Aapka 14-day free trial samapt ho gaya hai! Analytics dekhne ke liye Pro Plan upgrade karein.");
            window.location.hash = "#pricing";
            return;
        }
        document.getElementById("view-analytics").classList.remove("hidden");
        loadCustomerAnalytics();
    } 
    else if (hash === "#pricing") {
        document.getElementById("view-pricing").classList.remove("hidden");
    } 
    else if (hash === "#admin") {
        if (!currentUser || currentUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
            alert("⛔ Access Denied! Sirf Master Admin is panel ko khol sakta hai.");
            window.location.hash = "#home";
            return;
        }
        document.getElementById("view-admin").classList.remove("hidden");
        loadMasterAdminPanel();
    } 
    else {
        document.getElementById("view-home").classList.remove("hidden");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

// Initialize History State so Back Button stays inside the Web App
if (!window.location.hash) {
    window.history.replaceState(null, "", "#home");
}
window.addEventListener("hashchange", handleRoute);
window.addEventListener("DOMContentLoaded", () => {
    renderLiveQRPreview("https://example.com");
    handleRoute();
});

// Modal Trigger Helpers (Uses Hash History)
window.openTrialModal = () => { window.location.hash = "#trial"; };
window.closeTrialModal = () => { window.history.back(); };

window.openAuthModal = (mode = "login") => { window.location.hash = `#${mode}`; };
window.closeAuthModal = () => { window.history.back(); };

window.openUpiModal = () => { window.location.hash = "#upi"; };
window.closeUpiModal = () => { window.history.back(); };

function setupAuthModalUI(mode) {
    authMode = mode;
    const title = document.getElementById("authModalTitle");
    const btn = document.getElementById("emailAuthSubmitBtn");
    if (mode === "signup") {
        title.textContent = "Start your 14-Day Free Trial";
        btn.textContent = "Create Account (Sign Up)";
    } else {
        title.textContent = "Sign in to your account";
        btn.textContent = "Sign In with Email";
    }
}

// =========================================================
// 2. AUTHENTICATION & 14-DAY FREE TRIAL ENGINE
// =========================================================
document.getElementById("emailAuthSubmitBtn").addEventListener("click", async () => {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value.trim();

    if (!email || !pass) {
        alert("Kripya apna Email aur Password dono dalein!");
        return;
    }

    const btn = document.getElementById("emailAuthSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Please wait...";

    try {
        if (authMode === "signup") {
            await createUserWithEmailAndPassword(auth, email, pass);
        } else {
            // Try Sign In first; if new customer typed in Sign In box, offer signup
            await signInWithEmailAndPassword(auth, email, pass);
        }
        window.location.hash = "#dashboard";
    } catch (err) {
        if (authMode === "login" && err.code === "auth/invalid-credential") {
            alert("Incorrect Email ya Password! Agar aap naye user hain toh 'Sign up free' par click karein.");
        } else {
            alert("Auth Error: " + err.message);
        }
    } finally {
        btn.disabled = false;
        setupAuthModalUI(authMode);
    }
});

document.getElementById("googleLoginBtn").addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, provider);
        window.location.hash = "#dashboard";
    } catch (err) {
        alert("Google Sign-In failed: " + err.message);
    }
});

document.getElementById("sidebarLogoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.toggleSidebar(true);
    window.location.hash = "#home";
});

// Check User Profile & 14-Day Trial Status in Firestore
async function syncUserProfileAndTrial(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let data;
    if (!snap.exists()) {
        // First time user -> Start 14-Day Trial
        data = {
            uid: user.uid,
            email: user.email,
            plan: "trial",
            trialStartMs: Date.now(),
            createdAt: serverTimestamp()
        };
        await setDoc(userRef, data);
    } else {
        data = snap.data();
    }

    const isMasterAdmin = user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
    const elapsedDays = Math.floor((Date.now() - (data.trialStartMs || Date.now())) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, FREE_TRIAL_DAYS - elapsedDays);
    const isPro = data.plan === "pro" || isMasterAdmin;
    const isExpired = !isPro && daysLeft <= 0;

    currentUserData = {
        ...data,
        daysLeft,
        isPro,
        isExpired
    };

    // Update UI Badges & Sidebar Trial Countdown
    const planBadge = document.getElementById("planBadge");
    const trialBox = document.getElementById("trialCountdownBox");
    const trialDaysText = document.getElementById("trialDaysText");

    if (isMasterAdmin) {
        planBadge.textContent = "👑 ADMIN";
        planBadge.className = "text-[11px] font-extrabold bg-slate-900 text-amber-400 px-2.5 py-1 rounded-full";
        trialBox.classList.add("hidden");
    } else if (isPro) {
        planBadge.textContent = "✨ PRO PLAN";
        planBadge.className = "text-[11px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full";
        trialBox.classList.add("hidden");
    } else if (isExpired) {
        planBadge.textContent = "⚠️ Trial Expired";
        planBadge.className = "text-[11px] font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full";
        trialBox.classList.remove("hidden");
        trialDaysText.textContent = "Free trial expired! Upgrade now";
    } else {
        planBadge.textContent = `⏳ ${daysLeft}d Trial`;
        planBadge.className = "text-[11px] font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full";
        trialBox.classList.remove("hidden");
        trialDaysText.textContent = `Free trial ends in ${daysLeft} days`;
    }
}

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const topSignupBtn = document.getElementById("topSignupBtn");
    const topUserBadge = document.getElementById("topUserBadge");
    const guestBtns = document.getElementById("guestSidebarBtns");
    const userFooter = document.getElementById("userSidebarFooter");
    const adminLink = document.getElementById("sidebarAdminLink");

    if (user) {
        topSignupBtn.classList.add("hidden");
        topUserBadge.classList.remove("hidden");
        topUserBadge.classList.add("flex");

        guestBtns.classList.add("hidden");
        userFooter.classList.remove("hidden");
        userFooter.classList.add("flex");
        document.getElementById("sidebarUserEmail").textContent = user.email;

        // Unlock Master Admin Link if email matches
        if (user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
            adminLink.classList.remove("hidden");
            adminLink.classList.add("flex");
        } else {
            adminLink.classList.add("hidden");
        }

        await syncUserProfileAndTrial(user);
        updateSidebarCounts();
    } else {
        currentUserData = null;
        topSignupBtn.classList.remove("hidden");
        topUserBadge.classList.add("hidden");
        guestBtns.classList.remove("hidden");
        userFooter.classList.add("hidden");
        adminLink.classList.add("hidden");
    }
    handleRoute();
});

// =========================================================
// 3. STATIC & DYNAMIC QR GENERATOR ENGINE
// =========================================================
window.setQRType = function(type) {
    currentQRType = type;
    document.querySelectorAll(".qr-tab").forEach(btn => {
        btn.className = "qr-tab flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 shrink-0";
    });
    const activeTab = document.getElementById(`tab-${type}`);
    if (activeTab) {
        activeTab.className = "qr-tab flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-slate-800 text-emerald-400 border border-emerald-500/40 shrink-0";
    }

    const heading = document.getElementById("inputHeading");
    const input = document.getElementById("qrInput");
    const hint = document.getElementById("inputHint");

    const configs = {
        url: { h: "Redirect to an existing web URL", p: "Enter URL (e.g. https://example.com/)", t: "Try something like https://example.com/" },
        whatsapp: { h: "Direct WhatsApp Chat QR", p: "Enter 10-digit WhatsApp Number (e.g. 919876543210)", t: "Customer scan karte hi aapke WhatsApp par message bhej sakega" },
        text: { h: "Plain Text or Notice QR", p: "Enter any text or note...", t: "Works offline when scanned" },
        phone: { h: "Instant Phone Call QR", p: "Enter Phone Number with +91", t: "Scanners will immediately dial this number" },
        email: { h: "Send Email QR Code", p: "Enter Email Address (e.g. support@shop.com)", t: "Opens email app automatically" },
        wifi: { h: "Wi-Fi Auto Connect QR", p: "NetworkName,Password (comma separated)", t: "Example: MyShopWiFi,12345678" }
    };

    heading.textContent = configs[type].h;
    input.placeholder = configs[type].p;
    hint.textContent = configs[type].t;
};

window.toggleDynamicMode = function(checked) {
    isDynamicMode = checked;
    const titleBox = document.getElementById("campaignTitleBox");
    if (checked) {
        titleBox.classList.remove("hidden");
    } else {
        titleBox.classList.add("hidden");
    }
};

window.enableDynamicQuick = function() {
    const toggle = document.getElementById("dynamicToggle");
    toggle.checked = true;
    window.toggleDynamicMode(true);
    document.getElementById("qrTitle").focus();
};

function formatPayloadByType(raw) {
    if (currentQRType === "whatsapp") {
        const cleanNum = raw.replace(/\D/g, "");
        return `https://wa.me/${cleanNum}`;
    }
    if (currentQRType === "phone") return `tel:${raw.trim()}`;
    if (currentQRType === "email") return `mailto:${raw.trim()}`;
    if (currentQRType === "wifi") {
        const parts = raw.split(",");
        const ssid = (parts[0] || "").trim();
        const pass = (parts[1] || "").trim();
        return `WIFI:T:WPA;S:${ssid};P:${pass};;`;
    }
    return raw.trim();
}

function renderLiveQRPreview(value) {
    const canvas = document.getElementById("qrCanvas");
    const fgColor = document.getElementById("fgColor").value;
    const bgColor = document.getElementById("bgColor").value;
    const cleanWatermark = document.getElementById("watermarkToggle").checked;

    new QRious({
        element: canvas,
        value: value || "https://example.com",
        size: 220,
        foreground: fgColor,
        background: bgColor,
        level: "H"
    });

    // Optional Brand Watermark if toggle is OFF
    if (!cleanWatermark) {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = bgColor;
        ctx.fillRect(65, 202, 90, 16);
        ctx.fillStyle = fgColor;
        ctx.font = "bold 10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SmartQR Pro", 110, 213);
    }
}

// Live preview update on input/color change
["qrInput", "fgColor", "bgColor", "watermarkToggle"].forEach(id => {
    document.getElementById(id).addEventListener("input", () => {
        const val = document.getElementById("qrInput").value.trim() || "https://example.com";
        renderLiveQRPreview(formatPayloadByType(val));
    });
});

document.getElementById("generateBtn").addEventListener("click", async () => {
    const rawInput = document.getElementById("qrInput").value.trim();
    const title = document.getElementById("qrTitle").value.trim() || "My Campaign QR";
    const fgColor = document.getElementById("fgColor").value;
    const bgColor = document.getElementById("bgColor").value;
    const shortLinkDisplay = document.getElementById("shortLinkDisplay");

    if (!rawInput) {
        alert("Kripya pehle URL ya details enter karein!");
        return;
    }

    const formattedTarget = formatPayloadByType(rawInput);

    // CASE 1: STATIC QR CODE (Free Forever)
    if (!isDynamicMode) {
        shortLinkDisplay.classList.add("hidden");
        renderLiveQRPreview(formattedTarget);
        alert("✅ Static QR Ready! Aap 'PNG' button dabakar download kar sakte hain.");
        return;
    }

    // CASE 2: DYNAMIC QR CODE (Requires Login & Active Trial / Pro Plan)
    if (!currentUser) {
        window.openTrialModal();
        return;
    }

    // Check 14-Day Trial Expiry
    if (currentUserData && currentUserData.isExpired) {
        alert("⚠️ Aapka 14-Day Free Trial khatam ho chuka hai! Unlimited Dynamic QR codes banane ke liye UPI se Pro Plan activate karein.");
        window.location.hash = "#pricing";
        return;
    }

    const btn = document.getElementById("generateBtn");
    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
        // Check Trial Limit (Max 5 Dynamic QRs in Free Trial)
        if (currentUserData && !currentUserData.isPro) {
            const qCheck = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
            const snapCheck = await getDocs(qCheck);
            if (snapCheck.size >= 5) {
                alert("⚠️ Free Trial me aap 5 Dynamic QR codes bana sakte hain. Aur banane ke liye Pro Plan upgrade karein!");
                window.location.hash = "#pricing";
                return;
            }
        }

        const shortId = Math.random().toString(36).substring(2, 8);
        const basePath = window.location.origin + window.location.pathname.replace("index.html", "");
        const redirectUrl = `${basePath}r.html?id=${shortId}`;

        await setDoc(doc(db, "qrcodes", shortId), {
            shortId: shortId,
            title: title,
            qrType: currentQRType,
            targetUrl: formattedTarget,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            fgColor: fgColor,
            bgColor: bgColor,
            scans: 0,
            active: true,
            analytics: {
                devices: { Android: 0, iPhone: 0, Desktop: 0 },
                timeOfDay: { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 }
            },
            createdAt: serverTimestamp()
        });

        renderLiveQRPreview(redirectUrl);
        shortLinkDisplay.textContent = `Short Link: ${redirectUrl}`;
        shortLinkDisplay.classList.remove("hidden");
        updateSidebarCounts();
        alert("🎉 Dynamic QR Saved! Aap ise apne Dashboard se kabhi bhi track ya edit kar sakte hain.");
    } catch (err) {
        alert("Error creating Dynamic QR: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Save & Generate";
    }
});

// Download PNG Button
document.getElementById("downloadBtn").addEventListener("click", () => {
    const canvas = document.getElementById("qrCanvas");
    const link = document.createElement("a");
    link.download = `QR-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
});

// =========================================================
// 4. CUSTOMER DASHBOARD & ANALYTICS + CSV EXPORT
// =========================================================
async function updateSidebarCounts() {
    if (!currentUser) return;
    try {
        const q = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(q);
        let active = 0, paused = 0;
        snap.forEach(d => {
            if (d.data().active) active++;
            else paused++;
        });
        document.getElementById("navActiveCount").textContent = active;
        document.getElementById("navPausedCount").textContent = paused;
    } catch (e) {
        console.error(e);
    }
}

async function loadCustomerDashboard() {
    const container = document.getElementById("customerQrList");
    container.innerHTML = `<p class="text-center text-sm text-slate-400 py-10">Loading your QR codes...</p>`;

    try {
        const q = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(q);

        cachedUserQRs = [];
        let html = "";
        const basePath = window.location.origin + window.location.pathname.replace("index.html", "");

        snap.forEach((docSnap) => {
            const d = docSnap.data();
            cachedUserQRs.push(d);
            const shortUrl = `${basePath}r.html?id=${d.shortId}`;

            html += `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between gap-3">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full ${d.active ? 'bg-emerald-500' : 'bg-red-500'}"></span>
                            <h3 class="font-extrabold text-sm text-slate-900">${d.title}</h3>
                            <span class="text-[10px] uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">${d.qrType || 'URL'}</span>
                        </div>
                        <p class="text-xs text-slate-500 break-all">Destination: <a href="${d.targetUrl}" target="_blank" class="text-emerald-700 font-semibold underline">${d.targetUrl}</a></p>
                        <p class="text-[11px] text-slate-400 font-mono">Short Link: ${shortUrl}</p>
                    </div>

                    <div class="flex sm:flex-col justify-between items-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <span class="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold">
                            👁️ ${d.scans || 0} Scans
                        </span>
                        <div class="flex items-center gap-1.5">
                            <button onclick="openEditQrModal('${d.shortId}', '${d.title.replace(/'/g, "")}', '${d.targetUrl.replace(/'/g, "")}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg font-bold">
                                ✏️ Edit Link
                            </button>
                            <button onclick="toggleCustomerQr('${d.shortId}', ${d.active})" class="text-xs bg-amber-50 text-amber-800 px-2.5 py-1.5 rounded-lg font-bold">
                                ${d.active ? '⏸️ Pause' : '▶️ Resume'}
                            </button>
                            <button onclick="downloadSavedQR('${shortUrl}', '${d.fgColor || '#000000'}', '${d.bgColor || '#ffffff'}', '${d.shortId}')" class="text-xs bg-[#2e7d32] text-white px-3 py-1.5 rounded-lg font-bold">
                                📥 PNG
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html || `
            <div class="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3">
                <p class="text-sm font-bold text-slate-700">Abhi tak aapne koi Dynamic QR nahi banaya hai.</p>
                <a href="#home" class="inline-block bg-[#2e7d32] text-white text-xs font-bold px-4 py-2 rounded-lg">Create First Dynamic QR</a>
            </div>
        `;
        updateSidebarCounts();
    } catch (err) {
        container.innerHTML = `<p class="text-center text-xs text-red-500">Error: ${err.message}</p>`;
    }
}

window.openEditQrModal = function(shortId, title, targetUrl) {
    if (currentUserData && currentUserData.isExpired) {
        alert("⚠️ Trial Expired! Destination URL edit karne ke liye Pro Plan upgrade karein.");
        window.location.hash = "#pricing";
        return;
    }
    document.getElementById("editQrId").value = shortId;
    document.getElementById("editQrTitle").value = title;
    document.getElementById("editQrUrl").value = targetUrl;
    window.location.hash = "#edit";
};

document.getElementById("saveEditBtn").addEventListener("click", async () => {
    const id = document.getElementById("editQrId").value;
    const title = document.getElementById("editQrTitle").value.trim();
    const url = document.getElementById("editQrUrl").value.trim();

    if (!url) return alert("Target URL khali nahi ho sakta!");

    try {
        await updateDoc(doc(db, "qrcodes", id), { title, targetUrl: url });
        window.history.back();
    } catch (err) {
        alert("Failed to update: " + err.message);
    }
});

window.toggleCustomerQr = async function(shortId, currentStatus) {
    await updateDoc(doc(db, "qrcodes", shortId), { active: !currentStatus });
    loadCustomerDashboard();
};

window.downloadSavedQR = function(url, fg, bg, id) {
    const tempCanvas = document.createElement("canvas");
    new QRious({ element: tempCanvas, value: url, size: 300, foreground: fg, background: bg, level: "H" });
    const link = document.createElement("a");
    link.download = `Dynamic-QR-${id}.png`;
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
};

// Analytics View Loader (Like Screenshot 1 & 2)
async function loadCustomerAnalytics() {
    const q = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);

    let totalScans = 0;
    let activeCodes = 0;
    const devices = { Android: 0, iPhone: 0, Desktop: 0 };
    const times = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
    cachedUserQRs = [];

    snap.forEach(dSnap => {
        const d = dSnap.data();
        cachedUserQRs.push(d);
        totalScans += (d.scans || 0);
        if (d.active) activeCodes++;

        if (d.analytics && d.analytics.devices) {
            devices.Android += (d.analytics.devices.Android || 0);
            devices.iPhone += (d.analytics.devices.iPhone || 0);
            devices.Desktop += (d.analytics.devices.Desktop || 0);
        }
        if (d.analytics && d.analytics.timeOfDay) {
            times.Morning += (d.analytics.timeOfDay.Morning || 0);
            times.Afternoon += (d.analytics.timeOfDay.Afternoon || 0);
            times.Evening += (d.analytics.timeOfDay.Evening || 0);
            times.Night += (d.analytics.timeOfDay.Night || 0);
        }
    });

    document.getElementById("analyticsTotalScans").textContent = totalScans;
    document.getElementById("analyticsActiveCodes").textContent = activeCodes;

    // Render Device Breakdown Bars
    const devBox = document.getElementById("deviceBreakdownList");
    devBox.innerHTML = Object.entries(devices).map(([k, v]) => `
        <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
            <span class="font-semibold text-slate-700">📱 ${k}</span>
            <span class="font-extrabold text-emerald-700">${v} scans</span>
        </div>
    `).join("");

    // Render Time of Day Breakdown Bars
    const timeBox = document.getElementById("timeBreakdownList");
    timeBox.innerHTML = Object.entries(times).map(([k, v]) => `
        <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
            <span class="font-semibold text-slate-700">🕒 ${k}</span>
            <span class="font-extrabold text-indigo-700">${v} scans</span>
        </div>
    `).join("");
}

// Export Analytics to CSV (Like Screenshot 1 & 2)
window.exportAnalyticsCSV = function() {
    if (!cachedUserQRs.length) {
        alert("Export karne ke liye koi QR data nahi hai!");
        return;
    }
    let csv = "ShortID,CampaignTitle,TargetURL,TotalScans,Status\n";
    cachedUserQRs.forEach(q => {
        csv += `"${q.shortId}","${q.title}","${q.targetUrl}",${q.scans || 0},${q.active ? "Active" : "Paused"}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-analytics-${Date.now()}.csv`;
    a.click();
};

// =========================================================
// 5. UPI PAYMENT GATEWAY (9661692365@ybl)
// =========================================================
function renderUpiModalQR() {
    const upiUri = `upi://pay?pa=${ADMIN_UPI_ID}&pn=${encodeURIComponent(ADMIN_MERCHANT_NAME)}&am=${PRO_PLAN_PRICE}&cu=INR`;
    const canvas = document.getElementById("upiQrCanvas");
    new QRious({
        element: canvas,
        value: upiUri,
        size: 180,
        level: "H"
    });
}

document.getElementById("submitUpiBtn").addEventListener("click", async () => {
    const utr = document.getElementById("upiUtrInput").value.trim();
    if (utr.length < 8) {
        alert("Kripya sahi 12-digit UPI UTR / Reference Number dalein!");
        return;
    }

    const btn = document.getElementById("submitUpiBtn");
    btn.disabled = true;
    btn.textContent = "Submitting...";

    try {
        const payId = `${currentUser.uid}_${Date.now()}`;
        await setDoc(doc(db, "payments", payId), {
            paymentId: payId,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            utrNumber: utr,
            amount: PRO_PLAN_PRICE,
            upiId: ADMIN_UPI_ID,
            status: "pending",
            createdAt: serverTimestamp()
        });

        document.getElementById("upiUtrInput").value = "";
        alert("✅ Payment Request Submitted! Admin aapka UTR verify karke Pro Plan activate kar denge.");
        window.history.back();
    } catch (err) {
        alert("Error submitting UTR: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✅ Submit Payment for Activation";
    }
});

// =========================================================
// 6. MASTER ADMIN CONTROL PANEL (UNHACKABLE)
// =========================================================
async function loadMasterAdminPanel() {
    const payBox = document.getElementById("adminPaymentList");
    const usersBox = document.getElementById("adminUsersList");
    const qrBox = document.getElementById("adminQrList");

    try {
        // 1. Load Pending UPI Payments
        const paySnap = await getDocs(collection(db, "payments"));
        let pendingCount = 0;
        let payHtml = "";
        paySnap.forEach(dSnap => {
            const p = dSnap.data();
            if (p.status === "pending") pendingCount++;
            payHtml += `
                <div class="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
                    <div>
                        <p class="font-bold text-slate-900">${p.userEmail} <span class="text-emerald-700 font-extrabold">(₹${p.amount})</span></p>
                        <p class="text-[11px] font-mono text-slate-600">UTR: <strong class="text-indigo-700">${p.utrNumber}</strong> | Status: ${p.status.toUpperCase()}</p>
                    </div>
                    ${p.status === "pending" ? `
                        <button onclick="approveUpiPayment('${p.paymentId}', '${p.userId}')" class="bg-[#2e7d32] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow">
                            ✅ Approve & Activate Pro
                        </button>
                    ` : `<span class="text-xs font-bold text-emerald-700">✔ Approved</span>`}
                </div>
            `;
        });
        document.getElementById("adminPendingUpi").textContent = pendingCount;
        payBox.innerHTML = payHtml || "No UPI payment requests yet.";

        // 2. Load All Registered Users
        const userSnap = await getDocs(collection(db, "users"));
        document.getElementById("adminTotalUsers").textContent = userSnap.size;
        let userHtml = "";
        userSnap.forEach(uSnap => {
            const u = uSnap.data();
            userHtml += `
                <div class="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
                    <div>
                        <p class="font-bold text-slate-800">${u.email}</p>
                        <p class="text-[11px] text-slate-500">Current Plan: <strong class="uppercase text-indigo-700">${u.plan}</strong></p>
                    </div>
                    <div class="flex gap-1.5">
                        <button onclick="adminSetUserPlan('${u.uid}', 'pro')" class="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded text-xs font-bold">Make PRO</button>
                        <button onclick="adminSetUserPlan('${u.uid}', 'trial')" class="bg-amber-100 text-amber-800 px-2.5 py-1 rounded text-xs font-bold">Reset 14d Trial</button>
                    </div>
                </div>
            `;
        });
        usersBox.innerHTML = userHtml || "No users found.";

        // 3. Load All Platform Dynamic QRs
        const qrSnap = await getDocs(collection(db, "qrcodes"));
        document.getElementById("adminTotalQrs").textContent = qrSnap.size;
        let qrHtml = "";
        qrSnap.forEach(qSnap => {
            const q = qSnap.data();
            qrHtml += `
                <div class="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
                    <div>
                        <p class="font-bold text-slate-800">${q.title} <span class="text-[10px] font-mono bg-slate-200 px-1.5 py-0.5 rounded">${q.shortId}</span></p>
                        <p class="text-[11px] text-slate-500 break-all">Owner: ${q.userEmail} | Scans: <strong>${q.scans || 0}</strong></p>
                        <p class="text-[11px] text-emerald-700 break-all">${q.targetUrl}</p>
                    </div>
                    <div class="flex gap-1.5">
                        <button onclick="adminToggleQr('${q.shortId}', ${q.active})" class="px-2.5 py-1 rounded text-xs font-bold ${q.active ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}">
                            ${q.active ? 'Pause' : 'Activate'}
                        </button>
                        <button onclick="adminDeleteQr('${q.shortId}')" class="bg-red-100 text-red-700 px-2.5 py-1 rounded text-xs font-bold">Delete</button>
                    </div>
                </div>
            `;
        });
        qrBox.innerHTML = qrHtml || "No dynamic QR codes created yet.";

    } catch (err) {
        alert("Admin Load Error: " + err.message);
    }
}

window.approveUpiPayment = async function(paymentId, userId) {
    try {
        await updateDoc(doc(db, "payments", paymentId), { status: "approved" });
        await updateDoc(doc(db, "users", userId), { plan: "pro" });
        alert("🎉 Customer ka Pro Plan successfully activate ho gaya!");
        loadMasterAdminPanel();
    } catch (e) {
        alert("Error: " + e.message);
    }
};

window.adminSetUserPlan = async function(uid, newPlan) {
    await updateDoc(doc(db, "users", uid), { 
        plan: newPlan,
        trialStartMs: Date.now() // Resets 14-day timer if set to trial
    });
    loadMasterAdminPanel();
};

window.adminToggleQr = async function(shortId, active) {
    await updateDoc(doc(db, "qrcodes", shortId), { active: !active });
    loadMasterAdminPanel();
};

window.adminDeleteQr = async function(shortId) {
    if (!confirm("Delete this QR permanently?")) return;
    await deleteDoc(doc(db, "qrcodes", shortId));
    loadMasterAdminPanel();
};
