// ==========================================
// SISTEM PENDAFTARAN SELARAS - FULL VERSION (FIXED CLOUD SUBMIT)
// ==========================================

// 1. CONFIG & STATE
// ==========================================
const DB_KEY = 'uld_submissions';
const SCHOOL_DB_KEY = 'uld_schools';
const QUEUE_KEY = 'uld_queue_counter';
const SETTINGS_KEY = 'uld_settings';
const ADMIN_SESSION_KEY = 'uld_admin_session';

// --- KONFIGURASI GOOGLE ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxBW_Sj2-SXq0Fq2sn-YXHyAI8lu2HN1UWhDWhFaKVpWpO_7aOouYKoLd6IDHGhx7vO/exec";

const defaultSettings = {
    appName: "SELARAS",
    appTagline: "Unit Layanan Disabilitas",
    appLogo: null,
    agencyLogo: null,
    favicon: null,
    primaryColor: "#1e3a8a",
    loginBg: null,
    footerText: "Dinas Pendidikan Provinsi DKI Jakarta",
    pdfTemplate: null
};

let state = {
    submissions: JSON.parse(localStorage.getItem(DB_KEY)) || [],
    schools: JSON.parse(localStorage.getItem(SCHOOL_DB_KEY)) || [],
    queueCounter: parseInt(localStorage.getItem(QUEUE_KEY)) || 1,
    settings: { ...defaultSettings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) },
    isAdmin: sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true',
    currentFilter: 'all'
};

function saveState() {
    localStorage.setItem(DB_KEY, JSON.stringify(state.submissions));
    localStorage.setItem(SCHOOL_DB_KEY, JSON.stringify(state.schools));
    localStorage.setItem(QUEUE_KEY, state.queueCounter);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

// ==========================================
// BASE64 HELPER
// ==========================================
async function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
  });
}

// ==========================================
// FORM SUBMIT (CLOUD SAVE)
// ==========================================
async function handleFormSubmit(e){
    e.preventDefault();
    showLoading(true);

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    let driveLink = "-";

    // ===== UPLOAD FILE =====
    if(data.hasHistory === "Ya"){
        const fileInput = document.getElementById("historyFile");

        if(fileInput && fileInput.files.length > 0){
            try{
                const file = fileInput.files[0];
                const base64 = await fileToBase64(file);

                const uploadRes = await fetch(GOOGLE_SCRIPT_URL,{
                    method:"POST",
                    headers:{ "Content-Type":"application/json" },
                    body: JSON.stringify({
                        action:"uploadFile",
                        fileName:file.name,
                        mimeType:file.type,
                        data:base64
                    })
                });

                const uploadJson = await uploadRes.json();
                if(uploadJson.status !== "success") throw "Upload gagal";

                driveLink = uploadJson.fileUrl;

            }catch(err){
                console.error(err);
                showLoading(false);
                alert("Upload file gagal");
                return;
            }
        }
    }

    // ===== BUILD DATA =====
    const submission = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status:"Menunggu Konfirmasi",
        data:{
            ...data,
            driveFileLink: driveLink
        }
    };

    // ===== SAVE TO SHEET =====
    try{
        const res = await fetch(GOOGLE_SCRIPT_URL,{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({
                action:"appendSheet",
                data:submission
            })
        });

        const json = await res.json();
        if(json.status !== "success") throw "Sheet gagal";

    }catch(err){
        console.error(err);
        showLoading(false);
        alert("Data gagal disimpan ke server");
        return;
    }

    // ===== LOCAL SAVE =====
    state.submissions.push(submission);
    saveState();

    showLoading(false);
    alert("Pendaftaran berhasil!");
    form.reset();
}

// ==========================================
// UI HELPERS
// ==========================================
function showLoading(show=true){
    const el=document.getElementById('loading-overlay');
    if(el) el.style.display=show?'flex':'none';
}

// ==========================================
// INIT
// ==========================================
window.onload = function() {
    console.log('🚀 Application loaded!');
    console.log('🔗 GOOGLE_SCRIPT_URL:', GOOGLE_SCRIPT_URL ? 'SET ✅' : 'NOT SET ❌');

    const form = document.getElementById("registrationForm");
    if(form){
        form.addEventListener("submit", handleFormSubmit);
        console.log("✅ Form handler attached");
    }else{
        console.warn("⚠️ Form tidak ditemukan: pastikan id='registrationForm'");
    }
};
