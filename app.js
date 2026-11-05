// app.js
// Complete Controller: Semi-Automatic UTR Approval, Live 14-Day Countdown, Strict Trial Quota, Multi-Type Dynamic Editor & Admin Panel

import { 
    auth, provider, db, 
    MASTER_ADMIN_EMAIL, ADMIN_UPI_ID, ADMIN_MERCHANT_NAME, PRO_PLAN_PRICE, FREE_TRIAL_DAYS,
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp 
} from "./firebase-config.js";

// Global App State
let currentUser = null;
let currentUserData = null; // { plan, trialStartMs, isPro, isExpired }
let isDynamicMode = false;
let authMode = "login";
let cachedUserQRs = [];
let cachedUserQRsMap = {};
let countdownInterval = null;

// =========================================================
// 1. STRICT FREE TRIAL QUOTA & LIVE 14-DAY COUNTDOWN ENGINE
// =========================================================
const TRIAL_LIMITS = {
    dynamicQr: 3,       // Max 3 Dynamic QRs in Free Trial
    customDownload: 5,  // Max 5 Artistic/Custom QR Downloads
    bulkRun: 2,         // Max 2 Bulk ZIP runs (5 rows max)
    bizTools: 3,        // Max 3 Visiting Cards / Barcodes
    cyberTools: 3       // Max 3 Cyber Cafe Tool Downloads
};

function getLocalTrialStartMs() {
    let ms = localStorage.getItem("smartqr_trial_start_ms");
    if (!ms) {
        ms = String(Date.now());
        localStorage.setItem("smartqr_trial_start_ms", ms);
    }
    return parseInt(ms, 10);
}

function getLocalQuotaUsage() {
    try {
        const raw = localStorage.getItem("smartqr_trial_usage");
        if (raw) return JSON.parse(raw);
    } catch (e) {
        console.warn(e);
    }
    return { dynamicQr: 0, customDownload: 0, bulkRun: 0, bizTools: 0, cyberTools: 0 };
}

function saveLocalQuotaUsage(usageObj) {
    localStorage.setItem("smartqr_trial_usage", JSON.stringify(usageObj));
    updateQuotaBadgesUI();
}

window.isUserProPlan = function() {
    if (currentUser && currentUser.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) return true;
    return Boolean(currentUserData && currentUserData.isPro);
};

window.isUserTrialExpired = function() {
    if (window.isUserProPlan()) return false;
    const startMs = (currentUserData && currentUserData.trialStartMs) ? currentUserData.trialStartMs : getLocalTrialStartMs();
    const expiryMs = startMs + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() >= expiryMs;
};

window.checkAndConsumeTrialQuota = function(featureKey) {
    if (window.isUserProPlan()) return true;

    if (window.isUserTrialExpired()) {
        alert("⏰ Aapka 14-Day Free Trial samapt ho chuka hai! Sabhi features unlimited use karne ke liye ₹499.00 Pro Plan activate karein.");
        window.location.hash = "#pricing";
        return false;
    }

    const usage = getLocalQuotaUsage();
    const maxAllowed = TRIAL_LIMITS[featureKey] || 3;
    const currentUsed = usage[featureKey] || 0;

    if (currentUsed >= maxAllowed) {
        const labels = {
            dynamicQr: "3 Dynamic QR Codes",
            customDownload: "5 Custom QR Downloads",
            bulkRun: "2 Free Bulk QR Runs",
            bizTools: "3 Free Business Tool Uses (Visiting Card / Barcode)",
            cyberTools: "3 Free Cyber Cafe Tool Downloads"
        };
        alert(`⚠️ Free Trial Quota Reached!\n\nAapne apne Free Trial ki limit (${labels[featureKey] || maxAllowed}) poori kar li hai.\n\nUnlimited access ke liye abhi ₹499.00 Pro Plan me upgrade karein!`);
        window.location.hash = "#pricing";
        return false;
    }

    usage[featureKey] = currentUsed + 1;
    saveLocalQuotaUsage(usage);
    return true;
};

function updateQuotaBadgesUI() {
    const quotaEl = document.getElementById("trialQuotaSummary");
    const sideQuotaEl = document.getElementById("sidebarQuotaText");
    if (!quotaEl) return;

    if (window.isUserProPlan()) {
        quotaEl.textContent = "👑 PRO UNLIMITED ACTIVE";
        quotaEl.className = "text-[10px] bg-emerald-600 text-white px-2.5 py-0.5 rounded-full font-extrabold";
        if (sideQuotaEl) sideQuotaEl.textContent = "Unlimited Pro Plan Active";
        return;
    }

    const u = getLocalQuotaUsage();
    const dynLeft = Math.max(0, TRIAL_LIMITS.dynamicQr - (u.dynamicQr || 0));
    const dlLeft = Math.max(0, TRIAL_LIMITS.customDownload - (u.customDownload || 0));
    quotaEl.textContent = `Free Credits Left: ${dynLeft}/${TRIAL_LIMITS.dynamicQr} Dynamic | ${dlLeft}/${TRIAL_LIMITS.customDownload} Downloads`;
    if (sideQuotaEl) {
        sideQuotaEl.textContent = `Left: ${dynLeft} Dynamic QRs, ${dlLeft} Custom Downloads`;
    }
}

function startLiveTrialCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);

    const tick = () => {
        const topTimerEl = document.getElementById("liveTrialTimerText");
        const expDateEl = document.getElementById("trialExpiryDateBadge");
        const sideTimerEl = document.getElementById("trialDaysText");
        const planBadge = document.getElementById("planBadge");
        const trialBox = document.getElementById("trialCountdownBox");

        const isAdmin = currentUser && currentUser.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
        const isPro = window.isUserProPlan();

        if (isAdmin || isPro) {
            if (topTimerEl) topTimerEl.textContent = isAdmin ? "👑 Master Admin Mode" : "✨ Flex Pro Plan (Unlimited)";
            if (expDateEl) expDateEl.textContent = "No Expiry";
            if (planBadge) {
                planBadge.textContent = isAdmin ? "👑 ADMIN" : "✨ PRO PLAN";
                planBadge.className = "text-[11px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full";
            }
            if (trialBox) trialBox.classList.add("hidden");
            return;
        }

        const startMs = (currentUserData && currentUserData.trialStartMs) ? currentUserData.trialStartMs : getLocalTrialStartMs();
        const expiryMs = startMs + FREE_TRIAL_DAYS * 24 * 60 * 60 * 1000;
        const diffMs = expiryMs - Date.now();

        const expDateStr = new Date(expiryMs).toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric"
        });
        if (expDateEl) expDateEl.textContent = `(Expires on: ${expDateStr})`;

        if (diffMs <= 0) {
            if (currentUserData) currentUserData.isExpired = true;
            if (topTimerEl) topTimerEl.textContent = "❌ 14-Day Trial Expired!";
            if (sideTimerEl) sideTimerEl.textContent = `Trial Expired on ${expDateStr}`;
            if (planBadge) {
                planBadge.textContent = "⚠️ Expired";
                planBadge.className = "text-[11px] font-extrabold bg-red-100 text-red-700 px-2.5 py-1 rounded-full";
            }
            return;
        }

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
        const mins = Math.floor((diffMs / (1000 * 60)) % 60);
        const secs = Math.floor((diffMs / 1000) % 60);

        const pad = (n) => String(n).padStart(2, "0");
        const formattedCountdown = `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`;

        if (topTimerEl) topTimerEl.textContent = `⏳ ${formattedCountdown} left`;
        if (sideTimerEl) sideTimerEl.textContent = `Ends in: ${formattedCountdown} (${expDateStr})`;
        if (planBadge) {
            planBadge.textContent = `⏳ ${days}d ${pad(hours)}h left`;
            planBadge.className = "text-[11px] font-extrabold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full font-mono";
        }
    };

    tick();
    countdownInterval = setInterval(tick, 1000);
}

// =========================================================
// 2. MOBILE BACK-BUTTON ROUTER & MODAL CONTROLLER
// =========================================================
window.toggleSidebar = function(forceClose = false) {
    const drawer = document.getElementById("sidebarDrawer");
    const overlay = document.getElementById("sidebarOverlay");
    if (!drawer || !overlay) return;
    const isClosed = drawer.classList.contains("-translate-x-full");

    if (forceClose || !isClosed) {
        drawer.classList.add("-translate-x-full");
        overlay.classList.add("hidden");
    } else {
        drawer.classList.remove("-translate-x-full");
        overlay.classList.remove("hidden");
    }
};

function hideAllModals() {
    ["trialPromoModal", "authModal", "upiModal", "editModal"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });
    window.toggleSidebar(true);
}

window.goDirectAuth = function(mode = "signup") {
    authMode = mode;
    setupAuthModalUI(mode);
    window.location.hash = `#${mode}`;
};

window.openTrialModal = function() {
    window.location.hash = "#trial";
};

window.openUpiModal = function() {
    window.location.hash = "#upi";
};

function handleRoute() {
    const hash = window.location.hash || "#home";
    hideAllModals();

    if (hash === "#trial") {
        document.getElementById("trialPromoModal")?.classList.remove("hidden");
        return;
    }
    if (hash === "#login" || hash === "#signup") {
        setupAuthModalUI(hash.replace("#", ""));
        document.getElementById("authModal")?.classList.remove("hidden");
        return;
    }
    if (hash === "#upi") {
        if (!currentUser) {
            alert("Pro Plan (₹499.00) activate karne ke liye pehle Sign In ya Sign Up karein!");
            window.goDirectAuth("signup");
            return;
        }
        renderUpiPaymentGatewayQR();
        document.getElementById("upiModal")?.classList.remove("hidden");
        return;
    }
    if (hash === "#edit") {
        document.getElementById("editModal")?.classList.remove("hidden");
        return;
    }

    const views = [
        "view-home", "view-bulk-qr", "view-dashboard", 
        "view-analytics", "view-cyber-tools", "view-biz-tools", 
        "view-pricing", "view-admin"
    ];
    views.forEach(id => document.getElementById(id)?.classList.add("hidden"));

    if (hash === "#bulk-qr") {
        document.getElementById("view-bulk-qr")?.classList.remove("hidden");
    } 
    else if (hash === "#cyber-tools") {
        document.getElementById("view-cyber-tools")?.classList.remove("hidden");
    } 
    else if (hash === "#biz-tools") {
        document.getElementById("view-biz-tools")?.classList.remove("hidden");
        if (window.renderSavedVisitingCards) window.renderSavedVisitingCards();
        if (window.renderSavedBarcodes) window.renderSavedBarcodes();
    } 
    else if (hash === "#pricing") {
        document.getElementById("view-pricing")?.classList.remove("hidden");
    } 
    else if (hash === "#dashboard") {
        if (!currentUser) {
            window.goDirectAuth("login");
            return;
        }
        document.getElementById("view-dashboard")?.classList.remove("hidden");
        loadUserDashboard();
    } 
    else if (hash === "#analytics") {
        if (!currentUser) {
            window.goDirectAuth("login");
            return;
        }
        if (window.isUserTrialExpired()) {
            alert("⚠️ Aapka 14-Day Free Trial samapt ho chuka hai! Live Analytics dekhne ke liye ₹499.00 Pro Plan upgrade karein.");
            window.location.hash = "#pricing";
            return;
        }
        document.getElementById("view-analytics")?.classList.remove("hidden");
        loadCustomerAnalytics();
    } 
    else if (hash === "#admin") {
        if (!currentUser || currentUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
            alert("⛔ Access Denied! Sirf Master Admin is panel ko dekh sakta hai.");
            window.location.hash = "#home";
            return;
        }
        document.getElementById("view-admin")?.classList.remove("hidden");
        loadMasterAdminPanel();
    } 
    else {
        document.getElementById("view-home")?.classList.remove("hidden");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
}

if (!window.location.hash) {
    window.history.replaceState(null, "", "#home");
}
window.addEventListener("hashchange", handleRoute);
window.addEventListener("DOMContentLoaded", () => {
    startLiveTrialCountdown();
    updateQuotaBadgesUI();
    handleRoute();
});

// =========================================================
// 3. AUTHENTICATION & USER PROFILE SYNC
// =========================================================
window.togglePasswordVisibility = function() {
    const passInput = document.getElementById("authPassword");
    const toggleBtn = document.getElementById("passToggleBtn");
    if (!passInput || !toggleBtn) return;

    if (passInput.type === "password") {
        passInput.type = "text";
        toggleBtn.textContent = "🙈 Hide";
    } else {
        passInput.type = "password";
        toggleBtn.textContent = "👁️ Show";
    }
};

function setupAuthModalUI(mode) {
    authMode = mode;
    const title = document.getElementById("authModalTitle");
    const submitBtn = document.getElementById("emailAuthSubmitBtn");
    const tabLogin = document.getElementById("tabAuthLogin");
    const tabSignup = document.getElementById("tabAuthSignup");

    if (mode === "signup") {
        title.textContent = "Start Your 14-Day Free Trial 🎉";
        submitBtn.textContent = "Create Free Account (Sign Up)";
        tabSignup.className = "py-2 rounded-lg bg-white text-blue-700 shadow-xs font-extrabold";
        tabLogin.className = "py-2 rounded-lg text-slate-500";
    } else {
        title.textContent = "Sign in to User Dashboard";
        submitBtn.textContent = "Sign In with Email";
        tabLogin.className = "py-2 rounded-lg bg-white text-slate-900 shadow-xs font-extrabold";
        tabSignup.className = "py-2 rounded-lg text-slate-500";
    }
}

document.getElementById("emailAuthSubmitBtn")?.addEventListener("click", async () => {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value.trim();

    if (!email || !pass) return alert("Kripya Email aur Password dono dalein!");
    if (pass.length < 6) return alert("Password kam se kam 6 characters ka hona chahiye!");

    const btn = document.getElementById("emailAuthSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Please wait...";

    try {
        if (authMode === "signup") {
            await createUserWithEmailAndPassword(auth, email, pass);
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
        }
        window.location.hash = "#dashboard";
    } catch (err) {
        if (authMode === "signup" && err.code === "auth/email-already-in-use") {
            alert("Yeh Email pehle se registered hai! Sign In tab par click karke login karein.");
            window.goDirectAuth("login");
        } else if (authMode === "login" && err.code === "auth/invalid-credential") {
            alert("Galat Email ya Password! Naya account banane ke liye 'Sign Up Free' chunein.");
        } else {
            alert("Auth Error: " + err.message);
        }
    } finally {
        btn.disabled = false;
        setupAuthModalUI(authMode);
    }
});

document.getElementById("googleLoginBtn")?.addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, provider);
        window.location.hash = "#dashboard";
    } catch (err) {
        alert("Google Login Error: " + err.message);
    }
});

document.getElementById("sidebarLogoutBtn")?.addEventListener("click", async () => {
    await signOut(auth);
    window.toggleSidebar(true);
    window.location.hash = "#home";
});

async function syncUserProfileAndTrial(user) {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    let data;
    const localStart = getLocalTrialStartMs();

    if (!snap.exists()) {
        data = {
            uid: user.uid,
            email: user.email,
            plan: "trial",
            trialStartMs: localStart,
            createdAt: serverTimestamp()
        };
        await setDoc(userRef, data);
    } else {
        data = snap.data();
        if (data.trialStartMs) {
            localStorage.setItem("smartqr_trial_start_ms", String(data.trialStartMs));
        }
    }

    const isMasterAdmin = user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase();
    const isPro = data.plan === "pro" || isMasterAdmin;
    const startMs = data.trialStartMs || localStart;
    const isExpired = !isPro && (Date.now() >= startMs + FREE_TRIAL_DAYS * 86400000);

    currentUserData = { ...data, trialStartMs: startMs, isPro, isExpired };
    startLiveTrialCountdown();
    updateQuotaBadgesUI();
}

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const topSignupBtn = document.getElementById("topSignupBtn");
    const topUserBadge = document.getElementById("topUserBadge");
    const guestBtns = document.getElementById("guestSidebarBtns");
    const userFooter = document.getElementById("userSidebarFooter");
    const adminLink = document.getElementById("sidebarAdminLink");

    if (user) {
        topSignupBtn?.classList.add("hidden");
        topUserBadge?.classList.remove("hidden");
        topUserBadge?.classList.add("flex");

        guestBtns?.classList.add("hidden");
        userFooter?.classList.remove("hidden");
        userFooter?.classList.add("flex");
        document.getElementById("sidebarUserEmail").textContent = user.email;

        if (user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
            adminLink?.classList.remove("hidden");
            adminLink?.classList.add("flex");
        } else {
            adminLink?.classList.add("hidden");
        }

        await syncUserProfileAndTrial(user);
        updateSidebarQrCounts();
    } else {
        currentUserData = null;
        topSignupBtn?.classList.remove("hidden");
        topUserBadge?.classList.add("hidden");
        guestBtns?.classList.remove("hidden");
        userFooter?.classList.add("hidden");
        adminLink?.classList.add("hidden");
        startLiveTrialCountdown();
        updateQuotaBadgesUI();
    }
    handleRoute();
});

// =========================================================
// 4. NORMAL & DYNAMIC QR GENERATOR + SHORT-LINK SAVER
// =========================================================
window.toggleDynamicMode = function(enableDyn) {
    isDynamicMode = enableDyn;
    const btnStatic = document.getElementById("btnStaticMode");
    const btnDyn = document.getElementById("btnDynamicMode");
    const titleBox = document.getElementById("campaignTitleBox");

    if (enableDyn) {
        btnDyn.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 text-white shadow-xs transition";
        btnStatic.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-900 transition";
        titleBox?.classList.remove("hidden");
    } else {
        btnStatic.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-white text-blue-600 shadow-xs transition";
        btnDyn.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-900 transition";
        titleBox?.classList.add("hidden");
    }
};

window.saveShortDynamicRecord = async function(shortId, recordData) {
    if (!currentUser) return null;
    const basePath = window.location.origin + window.location.pathname.replace("index.html", "");
    const redirectUrl = `${basePath}r.html?id=${shortId}`;

    await setDoc(doc(db, "qrcodes", shortId), {
        shortId: shortId,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        scans: recordData.scans || 0,
        active: true,
        analytics: recordData.analytics || {
            devices: { Android: 0, iPhone: 0, Desktop: 0 },
            timeOfDay: { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 }
        },
        createdAt: serverTimestamp(),
        ...recordData
    }, { merge: true });

    updateSidebarQrCounts();
    return redirectUrl;
};

document.getElementById("generateBtn")?.addEventListener("click", async () => {
    const payload = window.getCurrentFormattedPayload();
    const qrType = window.getCurrentQRType();
    const customCfg = window.getCurrentQrCustomConfig();
    const structuredDetails = window.getCurrentStructuredDetails();
    const title = document.getElementById("qrTitle")?.value.trim() || `My ${qrType.toUpperCase()} QR`;
    const shortLinkDisplay = document.getElementById("shortLinkDisplay");

    if (!isDynamicMode) {
        shortLinkDisplay.classList.add("hidden");
        await window.renderCustomQrToCanvas(payload, customCfg);
        alert("✅ Designer QR Ready! Neeche 'Download HD PNG' button se save kar lein.");
        return;
    }

    if (!currentUser) {
        window.openTrialModal();
        return;
    }

    if (window.isUserTrialExpired()) {
        alert("⏰ Aapka 14-Day Free Trial khatam ho gaya hai! Dynamic QR banane ke liye ₹499.00 Pro Plan upgrade karein.");
        window.location.hash = "#pricing";
        return;
    }

    if (!window.isUserProPlan()) {
        const qCheck = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
        const snapCheck = await getDocs(qCheck);
        if (snapCheck.size >= TRIAL_LIMITS.dynamicQr) {
            alert(`⚠️ Free Trial Limit Reached!\n\nFree Trial me maximum ${TRIAL_LIMITS.dynamicQr} Dynamic QR codes allowed hain.\nUnlimited Dynamic QRs ke liye ₹499.00 Pro Plan activate karein!`);
            window.location.hash = "#pricing";
            return;
        }
        if (!window.checkAndConsumeTrialQuota("dynamicQr")) return;
    }

    const btn = document.getElementById("generateBtn");
    btn.disabled = true;
    btn.innerHTML = `<span>⏳ Creating Fast Short-Link QR...</span>`;

    try {
        const shortId = Math.random().toString(36).substring(2, 7);
        const redirectUrl = await window.saveShortDynamicRecord(shortId, {
            title: title,
            qrType: qrType,
            targetUrl: payload,
            structuredData: structuredDetails,
            themeKey: customCfg.themeKey || "elegant",
            frameId: customCfg.frameId || 1,
            frameText: customCfg.frameText || "Scan Me",
            textColor: customCfg.textColor || "#0f172a",
            fgColor: customCfg.fgColor || "#0f172a",
            gradColor2: customCfg.gradColor2 || "#2563eb",
            bgColor: customCfg.bgColor || "#ffffff",
            dotStyle: customCfg.dotStyle || "classy-rounded"
        });

        await window.renderCustomQrToCanvas(redirectUrl, customCfg);
        shortLinkDisplay.textContent = `Tracking Link: ${redirectUrl}`;
        shortLinkDisplay.classList.remove("hidden");
        alert("🎉 Dynamic Short-Link QR Saved! Aap 'User Dashboard' se iska Type kabhi bhi badal sakte hain!");
    } catch (err) {
        alert("Error saving Dynamic QR: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>⚡ Generate & Save QR Code</span>`;
    }
});

// =========================================================
// 5. USER DASHBOARD & MULTI-TYPE DYNAMIC QR EDITOR
// =========================================================
async function updateSidebarQrCounts() {
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
        console.warn(e);
    }
}

function getReadableTargetSummary(d) {
    const type = d.qrType || "url";
    const s = d.structuredData || {};
    if (type === "upi") return `UPI: ${s.upiId || ""} (${s.upiName || "Merchant"}) ${s.upiAmount ? "₹" + s.upiAmount : ""}`;
    if (type === "vcard") return `VCard: ${s.vcName || ""} (${s.vcPhone || ""})`;
    if (type === "visiting") return `Visiting Card: ${s.shopName || d.title} (${s.shopPhone || ""})`;
    if (type === "wifi") return `Wi-Fi: ${s.wifiSsid || ""} (${s.wifiEnc || "WPA"})`;
    if (type === "social") return `Social Hub: ${s.socTitle || d.title}`;
    return d.targetUrl;
}

async function loadUserDashboard() {
    const container = document.getElementById("customerQrList");
    container.innerHTML = `<p class="text-center text-sm text-slate-400 py-10">Loading your User Dashboard...</p>`;

    try {
        const q = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(q);

        cachedUserQRs = [];
        cachedUserQRsMap = {};
        let html = "";
        const basePath = window.location.origin + window.location.pathname.replace("index.html", "");

        snap.forEach((docSnap) => {
            const d = docSnap.data();
            cachedUserQRs.push(d);
            cachedUserQRsMap[d.shortId] = d;

            const shortUrl = `${basePath}r.html?id=${d.shortId}`;
            const summaryText = getReadableTargetSummary(d);
            const safeFrameText = (d.frameText || "Scan Me").replace(/'/g, "");

            html += `
                <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row justify-between gap-3">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="w-2.5 h-2.5 rounded-full ${d.active ? 'bg-emerald-500' : 'bg-red-500'}"></span>
                            <h3 class="font-extrabold text-sm text-slate-900">${d.title}</h3>
                            <span class="text-[10px] uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-extrabold">${d.qrType || 'url'}</span>
                        </div>
                        <p class="text-xs text-slate-600 break-all">Active Target: <strong class="text-emerald-700">${summaryText}</strong></p>
                        <p class="text-[11px] text-slate-400 font-mono break-all">Short Link: <a href="${shortUrl}" target="_blank" class="underline hover:text-blue-600">${shortUrl}</a></p>
                    </div>

                    <div class="flex sm:flex-col justify-between items-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <span class="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-xs font-extrabold">
                            👁️ ${d.scans || 0} Scans
                        </span>
                        <div class="flex flex-wrap items-center gap-1.5">
                            <button onclick="openEditQrModal('${d.shortId}')" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl font-bold shadow-2xs">
                                ✏️ Change Type / Edit
                            </button>
                            <button onclick="toggleCustomerQr('${d.shortId}', ${d.active})" class="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1.5 rounded-xl font-bold">
                                ${d.active ? '⏸️ Pause' : '▶️ Resume'}
                            </button>
                            <button onclick="downloadSavedCustomQR('${shortUrl}', '${d.fgColor || '#0f172a'}', '${d.bgColor || '#ffffff'}', '${d.dotStyle || 'classy-rounded'}', '${safeFrameText}', '${d.shortId}', ${d.frameId || 1}, '${d.textColor || '#0f172a'}', '${d.gradColor2 || '#2563eb'}')" class="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-xl font-bold">
                                📥 PNG
                            </button>
                            <button onclick="deleteCustomerQr('${d.shortId}')" class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-xl font-bold">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html || `
            <div class="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
                <p class="text-sm font-bold text-slate-700">Aapke User Dashboard me abhi koi Dynamic QR nahi hai.</p>
                <a href="#home" class="inline-block bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl">+ Create First Dynamic QR</a>
            </div>
        `;
        updateSidebarQrCounts();
    } catch (err) {
        container.innerHTML = `<p class="text-center text-xs text-red-500">Error loading User Dashboard: ${err.message}</p>`;
    }
}

window.switchEditModalType = function(type) {
    ["edit-box-single", "edit-box-upi", "edit-box-vcard", "edit-box-visiting", "edit-box-wifi", "edit-box-social"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });

    const singleLabel = document.getElementById("editSingleLabel");
    const singleInput = document.getElementById("editSingleInput");

    if (type === "upi") {
        document.getElementById("edit-box-upi")?.classList.remove("hidden");
    } else if (type === "vcard") {
        document.getElementById("edit-box-vcard")?.classList.remove("hidden");
    } else if (type === "visiting") {
        document.getElementById("edit-box-visiting")?.classList.remove("hidden");
    } else if (type === "wifi") {
        document.getElementById("edit-box-wifi")?.classList.remove("hidden");
    } else if (type === "social") {
        document.getElementById("edit-box-social")?.classList.remove("hidden");
    } else {
        document.getElementById("edit-box-single")?.classList.remove("hidden");
        if (type === "url") {
            singleLabel.textContent = "Enter New Website URL";
            singleInput.placeholder = "https://example.com";
        } else if (type === "whatsapp") {
            singleLabel.textContent = "Enter New WhatsApp Number (with 91)";
            singleInput.placeholder = "919876543210";
        } else if (type === "phone") {
            singleLabel.textContent = "Enter New Phone Number";
            singleInput.placeholder = "+919876543210";
        } else if (type === "text") {
            singleLabel.textContent = "Enter New Plain Text / Message";
            singleInput.placeholder = "Type message or notice...";
        }
    }
};

window.openEditQrModal = function(shortId) {
    if (window.isUserTrialExpired()) {
        alert("⏰ 14-Day Trial Expired! Dynamic QR edit karne ke liye ₹499.00 Pro Plan activate karein.");
        window.location.hash = "#pricing";
        return;
    }

    const d = cachedUserQRsMap[shortId];
    if (!d) return;

    const s = d.structuredData || {};
    const type = d.qrType || "url";

    document.getElementById("editQrId").value = d.shortId;
    document.getElementById("editQrTitle").value = d.title || "";
    document.getElementById("editQrTypeSelect").value = type;

    document.getElementById("editSingleInput").value = s.rawSingle || d.targetUrl || "";

    document.getElementById("editUpiId").value = s.upiId || "";
    document.getElementById("editUpiName").value = s.upiName || "";
    document.getElementById("editUpiAmount").value = s.upiAmount || "";

    document.getElementById("editVcName").value = s.vcName || "";
    document.getElementById("editVcPhone").value = s.vcPhone || "";
    document.getElementById("editVcEmail").value = s.vcEmail || "";
    document.getElementById("editVcOrg").value = s.vcOrg || "";
    document.getElementById("editVcWeb").value = s.vcWeb || "";
    document.getElementById("editVcAddr").value = s.vcAddr || "";

    document.getElementById("editShopName").value = s.shopName || "";
    document.getElementById("editShopPhone").value = s.shopPhone || "";
    document.getElementById("editShopAddr").value = s.shopAddr || "";
    document.getElementById("editShopItems").value = s.shopItems || "";

    document.getElementById("editWifiSsid").value = s.wifiSsid || "";
    document.getElementById("editWifiPass").value = s.wifiPass || "";
    document.getElementById("editWifiEnc").value = s.wifiEnc || "WPA";

    document.getElementById("editSocTitle").value = s.socTitle || "";
    document.getElementById("editSocInsta").value = s.socInsta || "";
    document.getElementById("editSocYt").value = s.socYt || "";
    document.getElementById("editSocWa").value = s.socWa || "";
    document.getElementById("editSocWeb").value = s.socWeb || "";

    window.switchEditModalType(type);
    window.location.hash = "#edit";
};

document.getElementById("saveEditBtn")?.addEventListener("click", async () => {
    const id = document.getElementById("editQrId").value;
    const title = document.getElementById("editQrTitle").value.trim() || "Updated QR";
    const newType = document.getElementById("editQrTypeSelect").value;

    let finalPayload = "";
    const newStructured = {
        rawSingle: document.getElementById("editSingleInput").value.trim(),
        upiId: document.getElementById("editUpiId").value.trim(),
        upiName: document.getElementById("editUpiName").value.trim(),
        upiAmount: document.getElementById("editUpiAmount").value.trim(),
        vcName: document.getElementById("editVcName").value.trim(),
        vcPhone: document.getElementById("editVcPhone").value.trim(),
        vcEmail: document.getElementById("editVcEmail").value.trim(),
        vcOrg: document.getElementById("editVcOrg").value.trim(),
        vcWeb: document.getElementById("editVcWeb").value.trim(),
        vcAddr: document.getElementById("editVcAddr").value.trim(),
        shopName: document.getElementById("editShopName").value.trim(),
        shopPhone: document.getElementById("editShopPhone").value.trim(),
        shopAddr: document.getElementById("editShopAddr").value.trim(),
        shopItems: document.getElementById("editShopItems").value.trim(),
        wifiSsid: document.getElementById("editWifiSsid").value.trim(),
        wifiPass: document.getElementById("editWifiPass").value.trim(),
        wifiEnc: document.getElementById("editWifiEnc").value,
        socTitle: document.getElementById("editSocTitle").value.trim(),
        socInsta: document.getElementById("editSocInsta").value.trim(),
        socYt: document.getElementById("editSocYt").value.trim(),
        socWa: document.getElementById("editSocWa").value.trim(),
        socWeb: document.getElementById("editSocWeb").value.trim()
    };

    if (newType === "upi") {
        if (!newStructured.upiId) return alert("Kripya UPI ID enter karein!");
        const payee = newStructured.upiName || "Merchant";
        finalPayload = `upi://pay?pa=${newStructured.upiId}&pn=${encodeURIComponent(payee)}&cu=INR`;
        if (newStructured.upiAmount && Number(newStructured.upiAmount) > 0) {
            finalPayload += `&am=${Number(newStructured.upiAmount).toFixed(2)}`;
        }
    } 
    else if (newType === "vcard") {
        if (!newStructured.vcName || !newStructured.vcPhone) return alert("Full Name aur Mobile Number zaroori hai!");
        finalPayload = [
            "BEGIN:VCARD", "VERSION:3.0",
            `FN:${newStructured.vcName}`,
            newStructured.vcOrg ? `ORG:${newStructured.vcOrg}` : "",
            `TEL;TYPE=CELL:${newStructured.vcPhone}`,
            newStructured.vcEmail ? `EMAIL:${newStructured.vcEmail}` : "",
            newStructured.vcWeb ? `URL:${newStructured.vcWeb}` : "",
            newStructured.vcAddr ? `ADR;TYPE=WORK:;;${newStructured.vcAddr};;;;` : "",
            "END:VCARD"
        ].filter(Boolean).join("\n");
    } 
    else if (newType === "visiting") {
        if (!newStructured.shopName || !newStructured.shopPhone) return alert("Shop Name aur Phone Number zaroori hai!");
        finalPayload = `VISITING_CARD:${id}`;
    } 
    else if (newType === "wifi") {
        if (!newStructured.wifiSsid) return alert("Wi-Fi SSID enter karein!");
        finalPayload = `WIFI:T:${newStructured.wifiEnc};S:${newStructured.wifiSsid};P:${newStructured.wifiPass};;`;
    } 
    else if (newType === "social") {
        finalPayload = `SOCIAL_HUB:${id}`;
    } 
    else if (newType === "whatsapp") {
        if (!newStructured.rawSingle) return alert("WhatsApp number dalein!");
        finalPayload = `https://wa.me/${newStructured.rawSingle.replace(/\D/g, "")}`;
    } 
    else if (newType === "phone") {
        if (!newStructured.rawSingle) return alert("Phone number dalein!");
        finalPayload = `tel:${newStructured.rawSingle.replace(/[^\d+]/g, "")}`;
    } 
    else if (newType === "text") {
        if (!newStructured.rawSingle) return alert("Text enter karein!");
        finalPayload = newStructured.rawSingle;
    } 
    else {
        if (!newStructured.rawSingle) return alert("Website URL enter karein!");
        finalPayload = /^https?:\/\//i.test(newStructured.rawSingle) ? newStructured.rawSingle : `https://${newStructured.rawSingle}`;
    }

    const btn = document.getElementById("saveEditBtn");
    btn.disabled = true;
    btn.textContent = "Updating...";

    try {
        await updateDoc(doc(db, "qrcodes", id), {
            title: title,
            qrType: newType,
            targetUrl: finalPayload,
            structuredData: newStructured
        });
        alert(`✅ Updated! Aapka QR ab '${newType.toUpperCase()}' par set ho gaya hai!`);
        window.history.back();
    } catch (err) {
        alert("Update Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✅ Save & Update QR";
    }
});

window.deleteCustomerQr = async function(shortId) {
    if (!confirm("Kya aap sach me is Dynamic QR Code ko Delete karna chahte hain?")) return;
    await deleteDoc(doc(db, "qrcodes", shortId));
    loadUserDashboard();
};

window.toggleCustomerQr = async function(shortId, currentStatus) {
    await updateDoc(doc(db, "qrcodes", shortId), { active: !currentStatus });
    loadUserDashboard();
};

// =========================================================
// 6. ANALYTICS & CSV EXPORT
// =========================================================
async function loadCustomerAnalytics() {
    const q = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
    const snap = await getDocs(q);

    let totalScans = 0, activeCodes = 0;
    const devices = { Android: 0, iPhone: 0, Desktop: 0 };
    const times = { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 };
    cachedUserQRs = [];

    snap.forEach(dSnap => {
        const d = dSnap.data();
        cachedUserQRs.push(d);
        totalScans += (d.scans || 0);
        if (d.active) activeCodes++;

        if (d.analytics?.devices) {
            devices.Android += (d.analytics.devices.Android || 0);
            devices.iPhone += (d.analytics.devices.iPhone || 0);
            devices.Desktop += (d.analytics.devices.Desktop || 0);
        }
        if (d.analytics?.timeOfDay) {
            times.Morning += (d.analytics.timeOfDay.Morning || 0);
            times.Afternoon += (d.analytics.timeOfDay.Afternoon || 0);
            times.Evening += (d.analytics.timeOfDay.Evening || 0);
            times.Night += (d.analytics.timeOfDay.Night || 0);
        }
    });

    document.getElementById("analyticsTotalScans").textContent = totalScans;
    document.getElementById("analyticsActiveCodes").textContent = activeCodes;

    document.getElementById("deviceBreakdownList").innerHTML = Object.entries(devices).map(([k, v]) => `
        <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl">
            <span class="font-semibold text-slate-700">📱 ${k}</span>
            <span class="font-extrabold text-emerald-700">${v} scans</span>
        </div>
    `).join("");

    document.getElementById("timeBreakdownList").innerHTML = Object.entries(times).map(([k, v]) => `
        <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-xl">
            <span class="font-semibold text-slate-700">🕒 ${k}</span>
            <span class="font-extrabold text-blue-700">${v} scans</span>
        </div>
    `).join("");
}

window.exportAnalyticsCSV = function() {
    if (!cachedUserQRs.length) return alert("Export karne ke liye koi Dynamic QR data nahi hai!");
    let csv = "ShortID,Title,QRType,TargetSummary,TotalScans,Status\n";
    cachedUserQRs.forEach(q => {
        const summary = getReadableTargetSummary(q).replace(/"/g, '""');
        csv += `"${q.shortId}","${(q.title || "").replace(/"/g, '""')}","${q.qrType || 'url'}","${summary}",${q.scans || 0},"${q.active ? "Active" : "Paused"}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Dynamic-QRs-Report-${Date.now()}.csv`;
    link.click();
};

// =========================================================
// 7. RASTA 2: SEMI-AUTOMATIC ADMIN APPROVAL SYSTEM
// =========================================================
function getOfficialUpiUri() {
    return `upi://pay?pa=${ADMIN_UPI_ID}&pn=${encodeURIComponent(ADMIN_MERCHANT_NAME)}&am=${PRO_PLAN_PRICE}&cu=INR&tn=${encodeURIComponent("SmartQR Pro Plan")}`;
}

async function renderUpiPaymentGatewayQR() {
    const upiUri = getOfficialUpiUri();
    const canvas = document.getElementById("upiQrCanvas");
    if (!canvas) return;

    const upiStyler = new QRCodeStyling({
        width: 240, height: 240, data: upiUri, margin: 12,
        qrOptions: { errorCorrectionLevel: "M" },
        dotsOptions: { color: "#000000", type: "square" },
        backgroundOptions: { color: "#ffffff" }
    });

    const blob = await upiStyler.getRawData("png");
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
    };
    img.src = url;
}

window.triggerUpiAppOpen = () => { window.location.href = getOfficialUpiUri(); };

window.copyMerchantUpi = () => {
    navigator.clipboard.writeText(ADMIN_UPI_ID);
    alert(`✅ Copied: ${ADMIN_UPI_ID}`);
};

window.downloadUpiPaymentQr = () => {
    const canvas = document.getElementById("upiQrCanvas");
    const a = document.createElement("a");
    a.download = "Pay-499-SmartQR-Pro.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
};

// Customer submits UTR -> Saved as 'pending' for Admin Manual Verification
document.getElementById("submitUpiBtn")?.addEventListener("click", async () => {
    const utr = document.getElementById("upiUtrInput").value.trim();
    if (utr.length < 8) return alert("Kripya sahi 12-digit UPI UTR / Reference Number enter karein!");

    const btn = document.getElementById("submitUpiBtn");
    btn.disabled = true;
    btn.textContent = "Submitting UTR...";

    try {
        const payId = `${currentUser.uid}_${Date.now()}`;
        await setDoc(doc(db, "payments", payId), {
            paymentId: payId,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            utrNumber: utr,
            amount: PRO_PLAN_PRICE,
            upiId: ADMIN_UPI_ID,
            status: "pending", // Awaiting Admin Approval
            createdAt: serverTimestamp()
        });

        document.getElementById("upiUtrInput").value = "";
        alert("✅ UTR Submitted Successfully!\n\nAapka payment verification pending me hai. Admin (Aap) PhonePe check karke jaise hi Admin Panel se Approve karenge, Pro Plan turant chalu ho jayega.");
        window.history.back();
    } catch (err) {
        alert("Submission Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✅ Submit ₹499 Payment";
    }
});

// Master Admin Panel: Lists all Pending UTRs with 1-Click Approval
async function loadMasterAdminPanel() {
    const payBox = document.getElementById("adminPaymentList");
    const usersBox = document.getElementById("adminUsersList");
    const qrBox = document.getElementById("adminQrList");

    try {
        const paySnap = await getDocs(collection(db, "payments"));
        let pendingCount = 0, payHtml = "";
        paySnap.forEach(dSnap => {
            const p = dSnap.data();
            if (p.status === "pending") pendingCount++;
            payHtml += `
                <div class="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
                    <div>
                        <p class="font-bold text-slate-900">${p.userEmail} <span class="text-emerald-700 font-extrabold">(₹${p.amount})</span></p>
                        <p class="text-[11px] font-mono text-slate-600">UTR: <strong class="text-blue-700">${p.utrNumber}</strong> | Status: <strong class="uppercase text-amber-600">${p.status}</strong></p>
                    </div>
                    ${p.status === "pending" ? `
                        <button onclick="approveUpiPayment('${p.paymentId}', '${p.userId}')" class="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow">
                            ✅ Approve ₹499 & Make PRO
                        </button>
                    ` : `<span class="text-xs font-bold text-emerald-700">✔ Approved</span>`}
                </div>
            `;
        });
        document.getElementById("adminPendingUpi").textContent = pendingCount;
        payBox.innerHTML = payHtml || "No pending UTR payment requests.";

        const userSnap = await getDocs(collection(db, "users"));
        document.getElementById("adminTotalUsers").textContent = userSnap.size;
        let userHtml = "";
        userSnap.forEach(uSnap => {
            const u = uSnap.data();
            userHtml += `
                <div class="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
                    <div>
                        <p class="font-bold text-slate-800">${u.email}</p>
                        <p class="text-[11px] text-slate-500">Plan: <strong class="uppercase text-blue-700">${u.plan}</strong></p>
                    </div>
                    <div class="flex gap-1.5">
                        <button onclick="adminSetUserPlan('${u.uid}', 'pro')" class="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded text-xs font-bold">Make PRO</button>
                        <button onclick="adminSetUserPlan('${u.uid}', 'trial')" class="bg-amber-100 text-amber-800 px-2.5 py-1 rounded text-xs font-bold">Reset to Trial</button>
                    </div>
                </div>
            `;
        });
        usersBox.innerHTML = userHtml || "No users found.";

        const qrSnap = await getDocs(collection(db, "qrcodes"));
        document.getElementById("adminTotalQrs").textContent = qrSnap.size;
        let qrHtml = "";
        qrSnap.forEach(qSnap => {
            const q = qSnap.data();
            qrHtml += `
                <div class="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200 gap-2">
                    <div>
                        <p class="font-bold text-slate-800">${q.title} <span class="text-[10px] font-mono bg-slate-200 px-1.5 py-0.5 rounded">${q.shortId}</span> <span class="text-[10px] uppercase bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">${q.qrType || 'url'}</span></p>
                        <p class="text-[11px] text-slate-500">By: ${q.userEmail} | Scans: <strong>${q.scans || 0}</strong></p>
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
        qrBox.innerHTML = qrHtml || "No dynamic QRs created yet.";
    } catch (err) {
        console.error(err);
    }
}

window.approveUpiPayment = async function(paymentId, userId) {
    try {
        await updateDoc(doc(db, "payments", paymentId), { status: "approved" });
        await updateDoc(doc(db, "users", userId), { plan: "pro" });
        alert("🎉 Payment Approved! Customer ka Pro Plan successfully activate ho gaya hai.");
        loadMasterAdminPanel();
    } catch (e) {
        alert("Error approving: " + e.message);
    }
};

window.adminSetUserPlan = async function(uid, newPlan) {
    await updateDoc(doc(db, "users", uid), { plan: newPlan, trialStartMs: Date.now() });
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
