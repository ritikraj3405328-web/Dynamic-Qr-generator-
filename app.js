// app.js
// Complete Controller: Multi-Type Dynamic QR Editor, Jotform Studio Saver, User Dashboard, Analytics, ₹499 UPI & Master Admin

import { 
    auth, provider, db, 
    MASTER_ADMIN_EMAIL, ADMIN_UPI_ID, ADMIN_MERCHANT_NAME, PRO_PLAN_PRICE, FREE_TRIAL_DAYS,
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp 
} from "./firebase-config.js";

// Global State
let currentUser = null;
let currentUserData = null; // { plan, trialStartMs, daysLeft, isPro, isExpired }
let isDynamicMode = false;
let authMode = "login";
let cachedUserQRs = [];
let cachedUserQRsMap = {}; // Stores QR objects by shortId for instant Multi-Type Editing

// =========================================================
// 1. MOBILE BACK-BUTTON ROUTER & MODAL CONTROLLER
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
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
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

    // Popup Modal Hashes (Mobile Back button closes modal and returns to previous screen)
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

    // Hide all page views
    const views = [
        "view-home", "view-bulk-qr", "view-dashboard", 
        "view-analytics", "view-cyber-tools", "view-biz-tools", 
        "view-pricing", "view-admin"
    ];
    views.forEach(id => document.getElementById(id)?.classList.add("hidden"));

    // Show active view
    if (hash === "#bulk-qr") {
        document.getElementById("view-bulk-qr")?.classList.remove("hidden");
    } 
    else if (hash === "#cyber-tools") {
        document.getElementById("view-cyber-tools")?.classList.remove("hidden");
    } 
    else if (hash === "#biz-tools") {
        document.getElementById("view-biz-tools")?.classList.remove("hidden");
        if (window.generateProductBarcode) window.generateProductBarcode();
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
        if (currentUserData && currentUserData.isExpired) {
            alert("⚠️ Aapka 14-Day Free Trial samapt ho chuka hai! Analytics dekhne ke liye ₹499.00 Pro Plan upgrade karein.");
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
window.addEventListener("DOMContentLoaded", handleRoute);

// =========================================================
// 2. AUTHENTICATION & PASSWORD SHOW/HIDE (👁️)
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

    if (!email || !pass) {
        alert("Kripya Email aur Password dono dalein!");
        return;
    }
    if (pass.length < 6) {
        alert("Password kam se kam 6 characters ka hona chahiye!");
        return;
    }

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
            alert("Yeh Email pehle se registered hai! Kripya Sign In tab par click karke login karein.");
            window.goDirectAuth("login");
        } else if (authMode === "login" && err.code === "auth/invalid-credential") {
            alert("Galat Email ya Password! Agar aap naye user hain toh 'Sign Up Free' par click karein.");
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
    if (!snap.exists()) {
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

    currentUserData = { ...data, daysLeft, isPro, isExpired };

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
        planBadge.textContent = "⚠️ Trial Ended";
        planBadge.className = "text-[11px] font-bold bg-red-100 text-red-700 px-2.5 py-1 rounded-full";
        trialBox.classList.remove("hidden");
        trialDaysText.textContent = "14-Day Trial Expired! Upgrade ₹499";
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
    }
    handleRoute();
});

// =========================================================
// 3. NORMAL VS DYNAMIC QR GENERATION & SAVING
// =========================================================
window.toggleDynamicMode = function(enableDyn) {
    isDynamicMode = enableDyn;
    const btnStatic = document.getElementById("btnStaticMode");
    const btnDyn = document.getElementById("btnDynamicMode");
    const titleBox = document.getElementById("campaignTitleBox");

    if (enableDyn) {
        btnDyn.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-blue-600 text-white shadow-xs transition";
        btnStatic.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-900 transition";
        titleBox.classList.remove("hidden");
    } else {
        btnStatic.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-white text-blue-600 shadow-xs transition";
        btnDyn.className = "flex-1 py-2.5 rounded-xl text-xs font-extrabold text-slate-600 hover:text-slate-900 transition";
        titleBox.classList.add("hidden");
    }
};

document.getElementById("generateBtn")?.addEventListener("click", async () => {
    const payload = window.getCurrentFormattedPayload();
    const qrType = window.getCurrentQRType();
    const customCfg = window.getCurrentQrCustomConfig();
    const structuredDetails = window.getCurrentStructuredDetails();
    const title = document.getElementById("qrTitle")?.value.trim() || `My ${qrType.toUpperCase()} QR`;
    const shortLinkDisplay = document.getElementById("shortLinkDisplay");

    // CASE 1: NORMAL / STATIC QR (Free Forever)
    if (!isDynamicMode) {
        shortLinkDisplay.classList.add("hidden");
        await window.renderCustomQrToCanvas(payload, customCfg);
        alert("✅ Custom QR Code Ready! Neeche 'Download HD PNG' par click karke save kar lein.");
        return;
    }

    // CASE 2: DYNAMIC TRACKABLE & EDITABLE QR
    if (!currentUser) {
        window.openTrialModal();
        return;
    }

    if (currentUserData && currentUserData.isExpired) {
        alert("⚠️ Aapka 14-Day Free Trial khatam ho gaya hai! Dynamic QR banane ke liye ₹499.00 Pro Plan upgrade karein.");
        window.location.hash = "#pricing";
        return;
    }

    const btn = document.getElementById("generateBtn");
    btn.disabled = true;
    btn.innerHTML = `<span>Saving Dynamic QR...</span>`;

    try {
        if (currentUserData && !currentUserData.isPro) {
            const qCheck = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
            const snapCheck = await getDocs(qCheck);
            if (snapCheck.size >= 5) {
                alert("⚠️ Free Trial me 5 Dynamic QR codes allowed hain. Unlimited banane ke liye ₹499.00 Pro Plan upgrade karein!");
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
            qrType: qrType,
            targetUrl: payload,
            structuredData: structuredDetails, // Saves UPI, VCard, WiFi fields for future multi-type editing!
            userId: currentUser.uid,
            userEmail: currentUser.email,
            frameId: customCfg.frameId || 1,
            frameText: customCfg.frameText || "Scan Me",
            textColor: customCfg.textColor || "#000000",
            fgColor: customCfg.fgColor || "#000000",
            bgColor: customCfg.bgColor || "#ffffff",
            dotStyle: customCfg.dotStyle || "square",
            scans: 0,
            active: true,
            analytics: {
                devices: { Android: 0, iPhone: 0, Desktop: 0 },
                timeOfDay: { Morning: 0, Afternoon: 0, Evening: 0, Night: 0 }
            },
            createdAt: serverTimestamp()
        });

        await window.renderCustomQrToCanvas(redirectUrl, customCfg);
        shortLinkDisplay.textContent = `Tracking Link: ${redirectUrl}`;
        shortLinkDisplay.classList.remove("hidden");
        updateSidebarQrCounts();
        alert("🎉 Dynamic QR Created! Ab aap 'User Dashboard' me jaakar kabhi bhi iska Type (Website se UPI, VCard, WiFi) badal sakte hain!");
    } catch (err) {
        alert("Error saving Dynamic QR: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span>Generate QR Code</span><span>❯</span>`;
    }
});

// =========================================================
// 4. USER DASHBOARD & MULTI-TYPE DYNAMIC QR EDITOR
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
    if (type === "upi") return `UPI ID: ${s.upiId || d.targetUrl} (${s.upiName || "Merchant"}) ${s.upiAmount ? "₹" + s.upiAmount : ""}`;
    if (type === "vcard") return `VCard: ${s.vcName || "Contact"} (${s.vcPhone || ""}) - ${s.vcOrg || ""}`;
    if (type === "wifi") return `Wi-Fi SSID: ${s.wifiSsid || "Network"} (${s.wifiEnc || "WPA"})`;
    if (type === "social") return `Social Hub: ${s.socTitle || "Link-in-Bio"}`;
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
            const safeFrameText = (d.frameText || d.bottomText || "Scan Me").replace(/'/g, "");

            html += `
                <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between gap-3">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full ${d.active ? 'bg-emerald-500' : 'bg-red-500'}"></span>
                            <h3 class="font-extrabold text-sm text-slate-900">${d.title}</h3>
                            <span class="text-[10px] uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-extrabold">${d.qrType || 'url'}</span>
                        </div>
                        <p class="text-xs text-slate-600 break-all">Current Data: <strong class="text-emerald-700">${summaryText}</strong></p>
                        <p class="text-[11px] text-slate-400 font-mono break-all">QR Short Link: ${shortUrl}</p>
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
                            <button onclick="downloadSavedCustomQR('${shortUrl}', '${d.fgColor || '#000000'}', '${d.bgColor || '#ffffff'}', '${d.dotStyle || 'square'}', '${safeFrameText}', '${d.shortId}', ${d.frameId || 1}, '${d.textColor || '#000000'}')" class="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1.5 rounded-xl font-bold">
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

// Switch Input Boxes Inside Edit Modal When User Changes QR Type (URL <-> UPI <-> VCard <-> WiFi <-> Social)
window.switchEditModalType = function(type) {
    ["edit-box-single", "edit-box-upi", "edit-box-vcard", "edit-box-wifi", "edit-box-social"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
    });

    const singleLabel = document.getElementById("editSingleLabel");
    const singleInput = document.getElementById("editSingleInput");

    if (type === "upi") {
        document.getElementById("edit-box-upi")?.classList.remove("hidden");
    } else if (type === "vcard") {
        document.getElementById("edit-box-vcard")?.classList.remove("hidden");
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
            singleInput.placeholder = "Write any message or notice...";
        }
    }
};

// Open Edit Modal & Populate Existing Data
window.openEditQrModal = function(shortId) {
    if (currentUserData && currentUserData.isExpired) {
        alert("⚠️ 14-Day Trial Expired! Dynamic QR edit karne ke liye ₹499.00 Pro Plan activate karein.");
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

    // Populate Single Input
    document.getElementById("editSingleInput").value = s.rawSingle || d.targetUrl || "";

    // Populate UPI Fields
    document.getElementById("editUpiId").value = s.upiId || "";
    document.getElementById("editUpiName").value = s.upiName || "";
    document.getElementById("editUpiAmount").value = s.upiAmount || "";

    // Populate VCard Fields
    document.getElementById("editVcName").value = s.vcName || "";
    document.getElementById("editVcPhone").value = s.vcPhone || "";
    document.getElementById("editVcEmail").value = s.vcEmail || "";
    document.getElementById("editVcOrg").value = s.vcOrg || "";
    document.getElementById("editVcWeb").value = s.vcWeb || "";
    document.getElementById("editVcAddr").value = s.vcAddr || "";

    // Populate WiFi Fields
    document.getElementById("editWifiSsid").value = s.wifiSsid || "";
    document.getElementById("editWifiPass").value = s.wifiPass || "";
    document.getElementById("editWifiEnc").value = s.wifiEnc || "WPA";

    // Populate Social Hub Fields
    document.getElementById("editSocTitle").value = s.socTitle || "";
    document.getElementById("editSocInsta").value = s.socInsta || "";
    document.getElementById("editSocYt").value = s.socYt || "";
    document.getElementById("editSocWa").value = s.socWa || "";
    document.getElementById("editSocWeb").value = s.socWeb || "";

    window.switchEditModalType(type);
    window.location.hash = "#edit";
};

// Save Edited Type & New Destination to Firestore
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
        if (!newStructured.vcName || !newStructured.vcPhone) {
            return alert("VCard ke liye Full Name aur Mobile Number zaroori hai!");
        }
        finalPayload = [
            "BEGIN:VCARD",
            "VERSION:3.0",
            `FN:${newStructured.vcName}`,
            newStructured.vcOrg ? `ORG:${newStructured.vcOrg}` : "",
            `TEL;TYPE=CELL:${newStructured.vcPhone}`,
            newStructured.vcEmail ? `EMAIL:${newStructured.vcEmail}` : "",
            newStructured.vcWeb ? `URL:${newStructured.vcWeb}` : "",
            newStructured.vcAddr ? `ADR;TYPE=WORK:;;${newStructured.vcAddr};;;;` : "",
            "END:VCARD"
        ].filter(Boolean).join("\n");
    } 
    else if (newType === "wifi") {
        if (!newStructured.wifiSsid) return alert("Kripya Wi-Fi SSID (Network Name) enter karein!");
        finalPayload = `WIFI:T:${newStructured.wifiEnc};S:${newStructured.wifiSsid};P:${newStructured.wifiPass};;`;
    } 
    else if (newType === "social") {
        const hubObj = {
            t: newStructured.socTitle || title,
            ig: newStructured.socInsta,
            yt: newStructured.socYt,
            wa: newStructured.socWa,
            wb: newStructured.socWeb
        };
        const encoded = btoa(encodeURIComponent(JSON.stringify(hubObj)));
        const basePath = window.location.origin + window.location.pathname.replace("index.html", "");
        finalPayload = `${basePath}r.html?hub=${encoded}`;
    } 
    else if (newType === "whatsapp") {
        if (!newStructured.rawSingle) return alert("Kripya WhatsApp number dalein!");
        finalPayload = `https://wa.me/${newStructured.rawSingle.replace(/\D/g, "")}`;
    } 
    else if (newType === "phone") {
        if (!newStructured.rawSingle) return alert("Kripya Phone number dalein!");
        finalPayload = `tel:${newStructured.rawSingle.replace(/[^\d+]/g, "")}`;
    } 
    else if (newType === "text") {
        if (!newStructured.rawSingle) return alert("Kripya Text enter karein!");
        finalPayload = newStructured.rawSingle;
    } 
    else {
        // Website URL
        if (!newStructured.rawSingle) return alert("Kripya Website URL enter karein!");
        finalPayload = /^https?:\/\//i.test(newStructured.rawSingle)
            ? newStructured.rawSingle
            : `https://${newStructured.rawSingle}`;
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
        alert(`✅ Success! Aapka QR ab '${newType.toUpperCase()}' me convert ho gaya hai bina QR badle!`);
        window.history.back();
    } catch (err) {
        alert("Update failed: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✅ Save & Update QR";
    }
});

window.deleteCustomerQr = async function(shortId) {
    if (!confirm("Kya aap sach me is Dynamic QR Code ko Delete karna chahte hain?")) return;
    try {
        await deleteDoc(doc(db, "qrcodes", shortId));
        loadUserDashboard();
    } catch (err) {
        alert("Delete Error: " + err.message);
    }
};

window.toggleCustomerQr = async function(shortId, currentStatus) {
    await updateDoc(doc(db, "qrcodes", shortId), { active: !currentStatus });
    loadUserDashboard();
};

// =========================================================
// 5. ANALYTICS & CSV EXPORT
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
    if (!cachedUserQRs.length) return alert("Export karne ke liye koi QR data nahi hai!");
    let csv = "ShortID,CampaignTitle,QRType,TotalScans,Status\n";
    cachedUserQRs.forEach(q => {
        csv += `"${q.shortId}","${q.title}","${q.qrType || 'url'}",${q.scans || 0},${q.active ? "Active" : "Paused"}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `QR-Analytics-${Date.now()}.csv`;
    link.click();
};

// =========================================================
// 6. ₹499.00 UPI PAYMENT GATEWAY (9661692365@ybl)
// =========================================================
function getOfficialUpiUri() {
    return `upi://pay?pa=${ADMIN_UPI_ID}&pn=${encodeURIComponent(ADMIN_MERCHANT_NAME)}&am=${PRO_PLAN_PRICE}&cu=INR&tn=${encodeURIComponent("SmartQR Pro Plan")}`;
}

async function renderUpiPaymentGatewayQR() {
    const upiUri = getOfficialUpiUri();
    const canvas = document.getElementById("upiQrCanvas");
    if (!canvas) return;

    const upiStyler = new QRCodeStyling({
        width: 240,
        height: 240,
        data: upiUri,
        margin: 12,
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

window.triggerUpiAppOpen = function() {
    window.location.href = getOfficialUpiUri();
};

window.copyMerchantUpi = function() {
    navigator.clipboard.writeText(ADMIN_UPI_ID);
    alert(`✅ UPI ID Copied: ${ADMIN_UPI_ID}\nAb aap ₹499.00 pay karke UTR submit kar sakte hain!`);
};

window.downloadUpiPaymentQr = function() {
    const canvas = document.getElementById("upiQrCanvas");
    const a = document.createElement("a");
    a.download = "Pay-499-SmartQR-Pro.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
};

document.getElementById("submitUpiBtn")?.addEventListener("click", async () => {
    const utr = document.getElementById("upiUtrInput").value.trim();
    if (utr.length < 8) {
        alert("Kripya sahi 12-digit UTR / Reference Number enter karein!");
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
        alert("✅ ₹499.00 Payment UTR Submitted! Admin verify karke aapka Pro Plan activate kar denge.");
        window.history.back();
    } catch (err) {
        alert("Submission Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✅ Submit ₹499 Payment";
    }
});

// =========================================================
// 7. MASTER ADMIN CONTROL PANEL
// =========================================================
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
                        <p class="text-[11px] font-mono text-slate-600">UTR: <strong class="text-blue-700">${p.utrNumber}</strong> | Status: ${p.status.toUpperCase()}</p>
                    </div>
                    ${p.status === "pending" ? `
                        <button onclick="approveUpiPayment('${p.paymentId}', '${p.userId}')" class="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow">
                            ✅ Approve ₹499 & Make PRO
                        </button>
                    ` : `<span class="text-xs font-bold text-emerald-700">✔ Approved</span>`}
                </div>
            `;
        });
        document.getElementById("adminPendingUpi").textContent = pendingCount;
        payBox.innerHTML = payHtml || "No UPI payment requests yet.";

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
                        <button onclick="adminSetUserPlan('${u.uid}', 'trial')" class="bg-amber-100 text-amber-800 px-2.5 py-1 rounded text-xs font-bold">Reset 14d Trial</button>
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
    await updateDoc(doc(db, "payments", paymentId), { status: "approved" });
    await updateDoc(doc(db, "users", userId), { plan: "pro" });
    alert("🎉 Customer Pro Plan Activated!");
    loadMasterAdminPanel();
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
