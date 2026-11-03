// app.js
import { 
    auth, provider, db, MASTER_ADMIN_EMAIL,
    signInWithPopup, onAuthStateChanged, signOut,
    collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, where, serverTimestamp 
} from "./firebase-config.js";

let currentUser = null;
let currentMode = "static"; // 'static' or 'dynamic'

// ==========================================
// 1. MOBILE BACK BUTTON ROUTER (HASH ROUTING)
// ==========================================
function handleRoute() {
    const hash = window.location.hash || "#home";

    // Agar Edit Modal khula hai aur user ne Back dabaya, toh modal band ho jaye
    const editModal = document.getElementById("editModal");
    if (hash === "#edit") {
        editModal.classList.remove("hidden");
        return;
    } else {
        editModal.classList.add("hidden");
    }

    // Sabhi sections hide karein
    document.getElementById("view-home").classList.add("hidden");
    document.getElementById("view-dashboard").classList.add("hidden");
    document.getElementById("view-admin").classList.add("hidden");

    // Bottom nav colors reset karein
    document.getElementById("nav-home").classList.replace("text-indigo-600", "text-slate-500");
    document.getElementById("nav-dashboard").classList.replace("text-indigo-600", "text-slate-500");

    if (hash === "#dashboard") {
        if (!currentUser) {
            alert("Apna Personal Dashboard dekhne ke liye pehle Login karein!");
            window.location.hash = "#home";
            return;
        }
        document.getElementById("view-dashboard").classList.remove("hidden");
        document.getElementById("nav-dashboard").classList.replace("text-slate-500", "text-indigo-600");
        loadCustomerDashboard();
    } 
    else if (hash === "#admin") {
        if (!currentUser || currentUser.email !== MASTER_ADMIN_EMAIL) {
            alert("Access Denied! Sirf Master Admin is page ko dekh sakta hai.");
            window.location.hash = "#home";
            return;
        }
        document.getElementById("view-admin").classList.remove("hidden");
        loadMasterAdminDashboard();
    } 
    else {
        // Default #home view
        document.getElementById("view-home").classList.remove("hidden");
        document.getElementById("nav-home").classList.replace("text-slate-500", "text-indigo-600");
    }
}

// Initial state set karein taaki pehla back button browser ke bahar na feke
if (!window.location.hash) {
    window.history.replaceState(null, "", "#home");
}
window.addEventListener("hashchange", handleRoute);
window.addEventListener("DOMContentLoaded", handleRoute);

// ==========================================
// 2. AUTHENTICATION LOGIC
// ==========================================
document.getElementById("loginBtn").addEventListener("click", async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (err) {
        alert("Login failed: " + err.message);
    }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.hash = "#home";
});

onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const loginBtn = document.getElementById("loginBtn");
    const userInfo = document.getElementById("userInfo");
    const navAdmin = document.getElementById("nav-admin");

    if (user) {
        loginBtn.classList.add("hidden");
        userInfo.classList.remove("hidden");
        userInfo.classList.add("flex");
        document.getElementById("userName").textContent = user.displayName || user.email.split("@")[0];

        // Master Admin Check
        if (user.email === MASTER_ADMIN_EMAIL) {
            navAdmin.classList.remove("hidden");
            navAdmin.classList.add("flex");
        } else {
            navAdmin.classList.add("hidden");
        }
    } else {
        loginBtn.classList.remove("hidden");
        userInfo.classList.add("hidden");
        navAdmin.classList.add("hidden");
    }
    handleRoute();
});

// ==========================================
// 3. STATIC & DYNAMIC QR GENERATOR LOGIC
// ==========================================
window.setQRMode = function(mode) {
    currentMode = mode;
    const staticBtn = document.getElementById("modeStaticBtn");
    const dynamicBtn = document.getElementById("modeDynamicBtn");
    const dynamicFields = document.getElementById("dynamicFields");

    if (mode === "static") {
        staticBtn.className = "py-2 text-sm font-bold rounded-lg bg-white text-indigo-600 shadow-sm";
        dynamicBtn.className = "py-2 text-sm font-bold rounded-lg text-slate-600";
        dynamicFields.classList.add("hidden");
    } else {
        dynamicBtn.className = "py-2 text-sm font-bold rounded-lg bg-white text-indigo-600 shadow-sm";
        staticBtn.className = "py-2 text-sm font-bold rounded-lg text-slate-600";
        dynamicFields.classList.remove("hidden");
    }
};

function renderQRToCanvas(value, fgColor, bgColor) {
    const canvas = document.getElementById("qrCanvas");
    new QRious({
        element: canvas,
        value: value,
        size: 240,
        foreground: fgColor,
        background: bgColor,
        level: "H"
    });
    document.getElementById("qrPreviewCard").classList.remove("hidden");
}

document.getElementById("generateBtn").addEventListener("click", async () => {
    const rawInput = document.getElementById("qrInput").value.trim();
    const title = document.getElementById("qrTitle").value.trim() || "Untitled QR";
    const fgColor = document.getElementById("fgColor").value;
    const bgColor = document.getElementById("bgColor").value;
    const shortLinkDisplay = document.getElementById("shortLinkDisplay");

    if (!rawInput) {
        alert("Kripya URL ya Text dalein!");
        return;
    }

    // CASE 1: STATIC QR (Direct Data, Free, No DB needed)
    if (currentMode === "static") {
        shortLinkDisplay.classList.add("hidden");
        renderQRToCanvas(rawInput, fgColor, bgColor);
        return;
    }

    // CASE 2: DYNAMIC QR (Trackable & Editable via Firestore)
    if (!currentUser) {
        alert("Dynamic QR banane aur track karne ke liye pehle Login karein!");
        return;
    }

    const btn = document.getElementById("generateBtn");
    btn.disabled = true;
    btn.textContent = "Creating Dynamic Link...";

    try {
        // 6-character unique short code banayein
        const shortId = Math.random().toString(36).substring(2, 8);
        
        // Redirect URL jo GitHub Pages aur Vercel dono par kaam karega
        const basePath = window.location.origin + window.location.pathname.replace("index.html", "");
        const redirectUrl = `${basePath}r.html?id=${shortId}`;

        // Firestore me save karein
        await setDoc(doc(db, "qrcodes", shortId), {
            shortId: shortId,
            title: title,
            targetUrl: rawInput,
            userId: currentUser.uid,
            userEmail: currentUser.email,
            fgColor: fgColor,
            bgColor: bgColor,
            scans: 0,
            active: true,
            createdAt: serverTimestamp()
        });

        renderQRToCanvas(redirectUrl, fgColor, bgColor);
        shortLinkDisplay.textContent = `Tracking Link: ${redirectUrl}`;
        shortLinkDisplay.classList.remove("hidden");
    } catch (err) {
        alert("Error saving Dynamic QR: " + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Generate QR Code";
    }
});

// Download QR PNG
document.getElementById("downloadBtn").addEventListener("click", () => {
    const canvas = document.getElementById("qrCanvas");
    const link = document.createElement("a");
    link.download = `smart-qr-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
});

// ==========================================
// 4. CUSTOMER PERSONAL DASHBOARD
// ==========================================
async function loadCustomerDashboard() {
    const listContainer = document.getElementById("customerQrList");
    listContainer.innerHTML = `<p class="text-center text-sm text-slate-400 py-8">Loading your links...</p>`;

    try {
        const q = query(collection(db, "qrcodes"), where("userId", "==", currentUser.uid));
        const snap = await getDocs(q);

        let totalScans = 0;
        let html = "";

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            totalScans += (data.scans || 0);
            const basePath = window.location.origin + window.location.pathname.replace("index.html", "");
            const shortUrl = `${basePath}r.html?id=${data.shortId}`;

            html += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2">
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-sm text-slate-800">${data.title}</h3>
                            <p class="text-xs text-slate-500 break-all">Target: <a href="${data.targetUrl}" target="_blank" class="text-indigo-600 underline">${data.targetUrl}</a></p>
                        </div>
                        <span class="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-extrabold">
                            👁️ ${data.scans || 0} Scans
                        </span>
                    </div>
                    <div class="flex items-center justify-between pt-2 border-t border-slate-100 mt-1">
                        <span class="text-[11px] font-semibold ${data.active ? 'text-emerald-600' : 'text-red-500'}">
                            ● ${data.active ? 'Active' : 'Paused'}
                        </span>
                        <div class="flex gap-2">
                            <button onclick="openEditModal('${data.shortId}', '${data.title.replace(/'/g, "")}', '${data.targetUrl}')" class="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg font-bold">
                                ✏️ Edit URL
                            </button>
                            <button onclick="downloadExistingQR('${shortUrl}', '${data.fgColor || '#000'}', '${data.bgColor || '#fff'}', '${data.shortId}')" class="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold">
                                📥 QR
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        document.getElementById("userTotalScans").textContent = totalScans;
        listContainer.innerHTML = html || `<p class="text-center text-sm text-slate-400 py-8">Abhi tak koi Dynamic QR nahi banaya gaya hai.</p>`;
    } catch (err) {
        listContainer.innerHTML = `<p class="text-center text-xs text-red-500">Error loading dashboard: ${err.message}</p>`;
    }
}

// Open Edit Modal with Hash Push (So Mobile Back Button closes the modal!)
window.openEditModal = function(shortId, title, targetUrl) {
    document.getElementById("editQrId").value = shortId;
    document.getElementById("editQrTitle").value = title;
    document.getElementById("editQrUrl").value = targetUrl;
    window.location.hash = "#edit"; // Back button dabane par wapas #dashboard par aayega
};

document.getElementById("saveEditBtn").addEventListener("click", async () => {
    const id = document.getElementById("editQrId").value;
    const newTitle = document.getElementById("editQrTitle").value.trim();
    const newUrl = document.getElementById("editQrUrl").value.trim();

    if (!newUrl) return alert("URL khali nahi ho sakta!");

    try {
        await updateDoc(doc(db, "qrcodes", id), {
            title: newTitle,
            targetUrl: newUrl
        });
        window.history.back(); // Modal band karke pichhle view (#dashboard) par le jayega
    } catch (err) {
        alert("Update failed: " + err.message);
    }
});

window.downloadExistingQR = function(url, fg, bg, id) {
    const tempCanvas = document.createElement("canvas");
    new QRious({ element: tempCanvas, value: url, size: 300, foreground: fg, background: bg, level: "H" });
    const link = document.createElement("a");
    link.download = `qr-${id}.png`;
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
};

// ==========================================
// 5. MASTER ADMIN DASHBOARD
// ==========================================
async function loadMasterAdminDashboard() {
    const adminList = document.getElementById("adminQrList");
    adminList.innerHTML = `<p class="text-center text-sm text-slate-400 py-8">Loading all customer links...</p>`;

    try {
        const snap = await getDocs(collection(db, "qrcodes"));
        let totalQrs = 0;
        let globalScans = 0;
        let html = "";

        snap.forEach((docSnap) => {
            const data = docSnap.data();
            totalQrs++;
            globalScans += (data.scans || 0);

            html += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-2">
                    <div class="flex justify-between items-start">
                        <div>
                            <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">${data.userEmail}</span>
                            <h3 class="font-bold text-sm mt-1">${data.title} (${data.shortId})</h3>
                            <p class="text-xs text-slate-500 break-all">${data.targetUrl}</p>
                        </div>
                        <span class="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold">
                            ${data.scans || 0} Scans
                        </span>
                    </div>
                    <div class="flex justify-end gap-2 pt-2 border-t border-slate-100">
                        <button onclick="toggleQrStatus('${data.shortId}', ${data.active})" class="text-xs px-3 py-1 rounded-lg font-bold ${data.active ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}">
                            ${data.active ? '⏸️ Pause/Block' : '▶️ Activate'}
                        </button>
                        <button onclick="deleteQrCode('${data.shortId}')" class="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-lg font-bold">
                            🗑️ Delete
                        </button>
                    </div>
                </div>
            `;
        });

        document.getElementById("adminTotalQrs").textContent = totalQrs;
        document.getElementById("adminTotalScans").textContent = globalScans;
        adminList.innerHTML = html || `<p class="text-center text-sm text-slate-400">No data found.</p>`;
    } catch (err) {
        adminList.innerHTML = `<p class="text-center text-xs text-red-500">Error: ${err.message}</p>`;
    }
}

window.toggleQrStatus = async function(shortId, currentStatus) {
    await updateDoc(doc(db, "qrcodes", shortId), { active: !currentStatus });
    loadMasterAdminDashboard();
};

window.deleteQrCode = async function(shortId) {
    if (!confirm("Kya aap sach me is QR link ko delete karna chahte hain?")) return;
    await deleteDoc(doc(db, "qrcodes", shortId));
    loadMasterAdminDashboard();
};
