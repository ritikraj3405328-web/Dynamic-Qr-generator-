// app.js
import { 
    auth, provider, db, 
    MASTER_ADMIN_EMAIL, ADMIN_UPI_ID, ADMIN_MERCHANT_NAME, PRO_PLAN_PRICE, FREE_TRIAL_DAYS,
    signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut,
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp 
} from "./firebase-config.js";

// Global App State
let currentUser = null;
let currentUserData = null; // { plan, trialStartMs, daysLeft, isPro, isExpired }
let isDynamicMode = false;
let authMode = "login"; // 'login' or 'signup'
let cachedUserQRs = [];

// =========================================================
// 1. MOBILE BACK-BUTTON ROUTER & DIRECT MODAL NAVIGATION
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

function hideAllModals() {
    ["trialPromoModal", "authModal", "upiModal", "editModal"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });
    window.toggleSidebar(true);
}

// FIXED: Direct Auth opener without history.back() race condition
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

    // 1. Handle Modal Routes (Pressing mobile Back button closes modal cleanly)
    if (hash === "#trial") {
        document.getElementById("trialPromoModal").classList.remove("hidden");
        return;
    }
    if (hash === "#login" || hash === "#signup") {
        const mode = hash.replace("#", "");
        setupAuthModalUI(mode);
        document.getElementById("authModal").classList.remove("hidden");
        return;
    }
    if (hash === "#upi") {
        if (!currentUser) {
            alert("Pro Plan (₹499.00) activate karne ke liye pehle Sign In ya Sign Up karein!");
            window.goDirectAuth("signup");
            return;
        }
        renderUpiPaymentGatewayQR();
        document.getElementById("upiModal").classList.remove("hidden");
        return;
    }
    if (hash === "#edit") {
        document.getElementById("editModal").classList.remove("hidden");
        return;
    }

    // 2. Hide All Main Section Views
    const allViews = [
        "view-home", "view-bulk-qr", "view-dashboard", 
        "view-analytics", "view-cyber-tools", "view-biz-tools", 
        "view-pricing", "view-admin"
    ];
    allViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    // 3. Activate Requested View
    if (hash === "#bulk-qr") {
        document.getElementById("view-bulk-qr").classList.remove("hidden");
    } 
    else if (hash === "#cyber-tools") {
        document.getElementById("view-cyber-tools").classList.remove("hidden");
    } 
    else if (hash === "#biz-tools") {
        document.getElementById("view-biz-tools").classList.remove("hidden");
        if (window.generateProductBarcode) window.generateProductBarcode();
    } 
    else if (hash === "#pricing") {
        document.getElementById("view-pricing").classList.remove("hidden");
    } 
    else if (hash === "#dashboard") {
        if (!currentUser) {
            window.goDirectAuth("login");
            return;
        }
        document.getElementById("view-dashboard").classList.remove("hidden");
        loadUserDashboard();
    } 
    else if (hash === "#analytics") {
        if (!currentUser) {
            window.goDirectAuth("login");
            return;
        }
        if (currentUserData && currentUserData.isExpired) {
            alert("⚠️ Aapka 14-Day Free Trial samapt ho chuka hai! Live Analytics ke liye ₹499.00 Pro Plan upgrade karein.");
            window.location.hash = "#pricing";
            return;
        }
        document.getElementById("view-analytics").classList.remove("hidden");
        loadCustomerAnalytics();
    } 
    else if (hash === "#admin") {
        if (!currentUser || currentUser.email.toLowerCase() !== MASTER_ADMIN_EMAIL.toLowerCase()) {
            alert("⛔ Access Denied! Sirf Master Admin is panel ko dekh sakta hai.");
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

if (!window.location.hash) {
    window.history.replaceState(null, "", "#home");
}
window.addEventListener("hashchange", handleRoute);
window.addEventListener("DOMContentLoaded", handleRoute);

// =========================================================
// 2. AUTHENTICATION & PASSWORD SHOW/HIDE BUTTON (👁️)
// =========================================================
window.togglePasswordVisibility = function() {
    const passInput = document.getElementById("authPassword");
    const toggleBtn = document.getElementById("passToggleBtn");
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
        tabSignup.className = "py-1.5 rounded bg-white text-emerald-800 shadow-xs font-extrabold";
        tabLogin.className = "py-1.5 rounded text-slate-500";
    } else {
        title.textContent = "Sign in to User Dashboard";
        submitBtn.textContent = "Sign In with Email";
        tabLogin.className = "py-1.5 rounded bg-white text-slate-900 shadow-xs font-extrabold";
        tabSignup.className = "py-1.5 rounded text-slate-500";
    }
}

document.getElementById("emailAuthSubmitBtn").addEventListener("click", async () => {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPassword").value.trim();

    if (!email || !pass) {
        alert("Kripya Email aur Password dono enter karein!");
        return;
    }
    if (pass.length < 6) {
        alert("Password kam se kam 6 characters ka hona chahiye!");
        return;
    }

    const btn = document.getElementById("emailAuthSubmitBtn");
    btn.disabled = true;
    btn.textContent = "Processing...";

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
            alert("Galat Email ya Password! Agar aapka account nahi bana hai toh 'Sign Up (14d Free)' par click karein.");
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
        alert("Google Login Error: " + err.message);
    }
});

document.getElementById("sidebarLogoutBtn").addEventListener("click", async () => {
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
        topSignupBtn.classList.add("hidden");
        topUserBadge.classList.remove("hidden");
        topUserBadge.classList.add("flex");

        guestBtns.classList.add("hidden");
        userFooter.classList.remove("hidden");
        userFooter.classList.add("flex");
        document.getElementById("sidebarUserEmail").textContent = user.email;

        if (user.email.toLowerCase() === MASTER_ADMIN_EMAIL.toLowerCase()) {
            adminLink.classList.remove("hidden");
            adminLink.classList.add("flex");
        } else {
            adminLink.classList.add("hidden");
        }

        await syncUserProfileAndTrial(user);
        updateSidebarQrCounts();
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
// 3. NORMAL VS DYNAMIC QR GENERATION & SAVING
// =========================================================
window.toggleDynamicMode = function(enableDyn) {
    isDynamicMode = enableDyn;
    const btnStatic = document.getElementById("btnStaticMode");
    const btnDyn = document.getElementById("btnDynamicMode");
    const titleBox = document.getElementById("campaignTitleBox");

    if (enableDyn) {
        btnDyn.className = "px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-600 text-white shadow";
        btnStatic.className = "px-3 py-1.5 rounded-md text-xs font-bold text-slate-400 hover:text-white";
        titleBox.classList.remove("hidden");
    } else {
        btnStatic.className = "px-3 py-1.5 rounded-md text-xs font-bold bg-emerald-600 text-white shadow";
        btnDyn.className = "px-3 py-1.5 rounded-md text-xs font-bold text-slate-400 hover:text-white";
        titleBox.classList.add("hidden");
    }
};

document.getElementById("generateBtn").addEventListener("click", async () => {
    const payload = window.getCurrentFormattedPayload();
    const qrType = window.getCurrentQRType();
    const customCfg = window.getCurrentQrCustomConfig();
    const title = document.getElementById("qrTitle").value.trim() || `My ${qrType.toUpperCase()} QR`;
    const shortLinkDisplay = document.getElementById("shortLinkDisplay");

    // 1. NORMAL / STATIC QR (100% Free with Full Customization)
    if (!isDynamicMode) {
        shortLinkDisplay.classList.add("hidden");
        await window.renderCustomQrToCanvas(payload, customCfg);
        alert("✅ Custom Normal QR Ready! 'Download HD' button dabakar save kar lein.");
        return;
    }

    // 2. DYNAMIC TRACKABLE QR (Requires Login)
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
    btn.textContent = "Saving Dynamic QR...";

    try {
        if (currentUserData && !currentUserData.isPro) {
            const qCheck = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
            const snapCheck = await getDocs(qCheck);
            if (snapCheck.size >= 5) {
                alert("⚠️ Free Trial me 5 Dynamic QR codes allowed hain. Unlimited banane ke liye ₹499.00 Pro Plan lein!");
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
            userId: currentUser.uid,
            userEmail: currentUser.email,
            fgColor: customCfg.fgColor,
            bgColor: customCfg.bgColor,
            dotStyle: customCfg.dotStyle,
            bottomText: customCfg.bottomText,
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
        alert("🎉 Dynamic QR Saved! Aap 'User Dashboard' me jaakar iska link edit, track ya delete kar sakte hain.");
    } catch (err) {
        alert("Error saving Dynamic QR: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "⚡ Generate & Save QR";
    }
});

// =========================================================
// 4. USER DASHBOARD (WITH DELETE, EDIT, PAUSE & DOWNLOAD)
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

async function loadUserDashboard() {
    const container = document.getElementById("customerQrList");
    container.innerHTML = `<p class="text-center text-sm text-slate-400 py-10">Loading your User Dashboard...</p>`;

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
            const safeTitle = (d.title || "QR").replace(/'/g, "");
            const safeTarget = (d.targetUrl || "").replace(/'/g, "");

            html += `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row justify-between gap-3">
                    <div class="space-y-1">
                        <div class="flex items-center gap-2">
                            <span class="w-2.5 h-2.5 rounded-full ${d.active ? 'bg-emerald-500' : 'bg-red-500'}"></span>
                            <h3 class="font-extrabold text-sm text-slate-900">${d.title}</h3>
                            <span class="text-[10px] uppercase bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">${d.qrType || 'URL'}</span>
                        </div>
                        <p class="text-xs text-slate-500 break-all">Target: <span class="text-emerald-700 font-semibold">${d.targetUrl}</span></p>
                        <p class="text-[11px] text-slate-400 font-mono break-all">Short Link: ${shortUrl}</p>
                    </div>

                    <div class="flex sm:flex-col justify-between items-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <span class="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-full text-xs font-extrabold">
                            👁️ ${d.scans || 0} Scans
                        </span>
                        <div class="flex flex-wrap items-center gap-1.5">
                            <button onclick="openEditQrModal('${d.shortId}', '${safeTitle}', '${safeTarget}')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-lg font-bold">
                                ✏️ Edit
                            </button>
                            <button onclick="toggleCustomerQr('${d.shortId}', ${d.active})" class="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 px-2.5 py-1.5 rounded-lg font-bold">
                                ${d.active ? '⏸️ Pause' : '▶️ Resume'}
                            </button>
                            <button onclick="downloadSavedCustomQR('${shortUrl}', '${d.fgColor || '#000000'}', '${d.bgColor || '#ffffff'}', '${d.dotStyle || 'square'}', '${(d.bottomText || '').replace(/'/g, '')}', '${d.shortId}')" class="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1.5 rounded-lg font-bold">
                                📥 QR
                            </button>
                            <button onclick="deleteCustomerQr('${d.shortId}')" class="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2.5 py-1.5 rounded-lg font-bold">
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html || `
            <div class="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3">
                <p class="text-sm font-bold text-slate-700">Aapke User Dashboard me abhi koi Dynamic QR nahi hai.</p>
                <a href="#home" class="inline-block bg-[#2e7d32] text-white text-xs font-bold px-4 py-2.5 rounded-lg">+ Create First Dynamic QR</a>
            </div>
        `;
        updateSidebarQrCounts();
    } catch (err) {
        container.innerHTML = `<p class="text-center text-xs text-red-500">Error loading User Dashboard: ${err.message}</p>`;
    }
}

// DELETE QR FROM USER DASHBOARD
window.deleteCustomerQr = async function(shortId) {
    if (!confirm("Kya aap sach me is Dynamic QR Code ko hamesha ke liye Delete karna chahte hain?")) return;
    try {
        await deleteDoc(doc(db, "qrcodes", shortId));
        loadUserDashboard();
    } catch (err) {
        alert("Delete Error: " + err.message);
    }
};

window.openEditQrModal = function(shortId, title, targetUrl) {
    if (currentUserData && currentUserData.isExpired) {
        alert("⚠️ 14-Day Trial Expired! Link update karne ke liye ₹499.00 Pro Plan activate karein.");
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

    if (!url) return alert("Destination URL khali nahi ho sakta!");

    try {
        await updateDoc(doc(db, "qrcodes", id), { title, targetUrl: url });
        window.history.back();
    } catch (err) {
        alert("Update failed: " + err.message);
    }
});

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
        <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
            <span class="font-semibold text-slate-700">📱 ${k}</span>
            <span class="font-extrabold text-emerald-700">${v} scans</span>
        </div>
    `).join("");

    document.getElementById("timeBreakdownList").innerHTML = Object.entries(times).map(([k, v]) => `
        <div class="flex justify-between items-center bg-slate-50 px-3 py-2 rounded-lg">
            <span class="font-semibold text-slate-700">🕒 ${k}</span>
            <span class="font-extrabold text-indigo-700">${v} scans</span>
        </div>
    `).join("");
}

window.exportAnalyticsCSV = function() {
    if (!cachedUserQRs.length) return alert("Export karne ke liye koi QR data nahi hai!");
    let csv = "ShortID,CampaignTitle,TargetURL,TotalScans,Status\n";
    cachedUserQRs.forEach(q => {
        csv += `"${q.shortId}","${q.title}","${q.targetUrl}",${q.scans || 0},${q.active ? "Active" : "Paused"}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `QR-Analytics-${Date.now()}.csv`;
    link.click();
};

// =========================================================
// 6. FIXED ₹499.00 UPI PAYMENT GATEWAY (9661692365@ybl)
// =========================================================
function getOfficialUpiUri() {
    // Formatted with exact decimal 499.00 so PhonePe, GPay & Paytm display ₹499.00 immediately
    return `upi://pay?pa=${ADMIN_UPI_ID}&pn=${encodeURIComponent(ADMIN_MERCHANT_NAME)}&am=${PRO_PLAN_PRICE}&cu=INR&tn=${encodeURIComponent("SmartQR Pro Plan")}`;
}

async function renderUpiPaymentGatewayQR() {
    const upiUri = getOfficialUpiUri();
    const canvas = document.getElementById("upiQrCanvas");
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
    const upiUri = getOfficialUpiUri();
    window.location.href = upiUri;
};

window.copyMerchantUpi = function() {
    navigator.clipboard.writeText(ADMIN_UPI_ID);
    alert(`✅ UPI ID Copied: ${ADMIN_UPI_ID}\nAb aap kisi bhi UPI App me ₹499.00 pay kar sakte hain!`);
};

window.downloadUpiPaymentQr = function() {
    const canvas = document.getElementById("upiQrCanvas");
    const a = document.createElement("a");
    a.download = "Pay-499-SmartQR-Pro.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
};

document.getElementById("submitUpiBtn").addEventListener("click", async () => {
    const utr = document.getElementById("upiUtrInput").value.trim();
    if (utr.length < 8) {
        alert("Kripya sahi 12-digit UTR / UPI Reference Number enter karein!");
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
        alert("✅ ₹499.00 Payment UTR Submitted! Master Admin verify karke aapka Pro Plan activate kar denge.");
        window.history.back();
    } catch (err) {
        alert("Submission Error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "✅ Submit ₹499 Payment for Activation";
    }
});

// =========================================================
// 7. MASTER ADMIN PANEL
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
                        <p class="text-[11px] font-mono text-slate-600">UTR: <strong class="text-indigo-700">${p.utrNumber}</strong> | Status: ${p.status.toUpperCase()}</p>
                    </div>
                    ${p.status === "pending" ? `
                        <button onclick="approveUpiPayment('${p.paymentId}', '${p.userId}')" class="bg-[#2e7d32] text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow">
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
                        <p class="text-[11px] text-slate-500">Plan: <strong class="uppercase text-indigo-700">${u.plan}</strong></p>
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
                        <p class="font-bold text-slate-800">${q.title} <span class="text-[10px] font-mono bg-slate-200 px-1.5 py-0.5 rounded">${q.shortId}</span></p>
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
