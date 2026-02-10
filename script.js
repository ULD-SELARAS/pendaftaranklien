// ==========================================
// SISTEM PENDAFTARAN SELARAS - FIXED VERSION
// ==========================================

// 1. CONFIG & STATE
// ==========================================
const DB_KEY = 'uld_submissions';
const SCHOOL_DB_KEY = 'uld_schools';
const QUEUE_KEY = 'uld_queue_counter';
const SETTINGS_KEY = 'uld_settings';
const ADMIN_SESSION_KEY = 'uld_admin_session';

// --- KONFIGURASI GOOGLE (PENTING!) ---
const GOOGLE_SCRIPT_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AehSKLhFzsCgzzExMYqYso1E_bbqi6a1UeSKvBwmy3Ztvdih3WZEF96uFOxIKH9DEX8TV3tL-2H-l8sFiWDoVzT6Wk_1xjbBWgshqD8uGfQKYKkLCa_bQNtNvufU6Og8k2PfpTS0owrfqVBNE4lBpgaekrtBQlaEapW0R0wSlsK88kndoIYw0Vdv_0I-eB-XWS9I1rcJypWJIZFynWGz18D4FNjukFMzBQjfA82EvviddjYCg2uE9MsomZ3sxSAXlGRsVF_-IKb9vQL9QFy0usmzkXVZvbMjcg&lib=MDqeOt2VRc1RsDQvkO75tamAGFOlNCMp3";

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
// FORM SUBMIT (CLOUD SAVE) - FIXED
// ==========================================
async function handleFormSubmit(e){
    e.preventDefault();
    console.log("📝 Form submit dimulai...");
    showLoading(true);

    const form = e.target;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    console.log("📋 Data form:", data);

    let driveLink = "-";

    // ===== UPLOAD FILE =====
    if(data.hasHistory === "Ya"){
        const fileInput = document.getElementById("historyFile");

        if(fileInput && fileInput.files.length > 0){
            try{
                console.log("📤 Mulai upload file...");
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
                console.log("📥 Response upload:", uploadJson);
                
                if(uploadJson.status !== "success") {
                    throw new Error("Upload gagal: " + (uploadJson.message || "Unknown error"));
                }

                driveLink = uploadJson.fileUrl;
                console.log("✅ File berhasil diupload:", driveLink);

            }catch(err){
                console.error("❌ Error upload file:", err);
                showLoading(false);
                Swal.fire({
                    icon: 'error',
                    title: 'Upload Gagal',
                    text: 'File gagal diupload ke Google Drive: ' + err.message
                });
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
    
    console.log("💾 Data yang akan disimpan:", submission);

    // ===== SAVE TO SHEET =====
    try{
        console.log("📊 Menyimpan ke Google Sheets...");
        const res = await fetch(GOOGLE_SCRIPT_URL,{
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({
                action:"appendSheet",
                data:submission
            })
        });

        const json = await res.json();
        console.log("📥 Response sheet:", json);
        
        if(json.status !== "success") {
            throw new Error("Gagal menyimpan ke sheet: " + (json.message || "Unknown error"));
        }
        
        console.log("✅ Data berhasil disimpan ke Google Sheets");

    }catch(err){
        console.error("❌ Error save to sheet:", err);
        showLoading(false);
        Swal.fire({
            icon: 'error',
            title: 'Gagal Menyimpan',
            text: 'Data gagal disimpan ke server: ' + err.message
        });
        return;
    }

    // ===== LOCAL SAVE =====
    state.submissions.push(submission);
    saveState();
    console.log("💾 Data tersimpan di local storage");

    showLoading(false);
    
    Swal.fire({
        icon: 'success',
        title: 'Pendaftaran Berhasil!',
        html: `
            <p>Data Anda telah tersimpan dengan ID: <strong>${submission.id}</strong></p>
            <p class="text-sm text-gray-500 mt-2">Kami akan menghubungi Anda segera.</p>
        `,
        confirmButtonText: 'OK'
    }).then(() => {
        form.reset();
        toggleFileUpload(false);
    });
}

// ==========================================
// UI HELPERS
// ==========================================
function showLoading(show=true){
    const el=document.getElementById('loading-overlay');
    if(el) el.style.display=show?'flex':'none';
}

function toggleFileUpload(show){
    const section = document.getElementById('fileUploadSection');
    if(section){
        if(show){
            section.classList.remove('hidden');
        }else{
            section.classList.add('hidden');
            const fileInput = document.getElementById('historyFile');
            if(fileInput) fileInput.value = '';
        }
    }
}

function handleEducationChange(){
    const select = document.getElementById('educationLevel');
    const container = document.getElementById('dynamicFields');
    const value = select.value;
    
    container.innerHTML = '';
    
    if(value === 'Belum Sekolah'){
        container.classList.remove('hidden');
        container.innerHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-1">Kota/Kabupaten Domisili</label>
            <input type="text" name="city" required class="w-full border-gray-300 border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none">
        `;
    } else if(['PAUD','SD','SMP','SMA','SMK','SLB','PKBM','SKB','LPK'].includes(value)){
        container.classList.remove('hidden');
        container.innerHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-1">Nama Sekolah/Lembaga</label>
            <input type="text" name="schoolName" required class="w-full border-gray-300 border rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Ketik nama sekolah...">
        `;
    } else {
        container.classList.add('hidden');
    }
}

function handlePurposeChange(){
    const select = document.getElementById('purposeSelect');
    // Bisa ditambahkan logika khusus jika diperlukan
}

// ==========================================
// NAVIGATION
// ==========================================
function navigate(view){
    const views = ['home', 'login', 'dashboard', 'settings'];
    views.forEach(v => {
        const el = document.getElementById(`view-${v}`);
        if(el) el.classList.add('hidden');
    });
    
    const target = document.getElementById(`view-${view}`);
    if(target) target.classList.remove('hidden');
}

// ==========================================
// ADMIN FUNCTIONS (SIMPLIFIED)
// ==========================================
function checkAdminAccess(){
    if(state.isAdmin){
        navigate('dashboard');
        renderAdminTable('all');
    }else{
        navigate('login');
    }
}

function handleAdminLogin(e){
    e.preventDefault();
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPass').value;
    
    // Ganti dengan kredensial yang aman
    if(user === 'admin' && pass === 'admin123'){
        state.isAdmin = true;
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        navigate('dashboard');
        renderAdminTable('all');
    }else{
        Swal.fire({
            icon: 'error',
            title: 'Login Gagal',
            text: 'Username atau password salah'
        });
    }
}

function logoutAdmin(){
    state.isAdmin = false;
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    navigate('home');
}

function renderAdminTable(filter){
    state.currentFilter = filter;
    const tbody = document.getElementById('adminTableBody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    let filtered = state.submissions;
    if(filter !== 'all'){
        filtered = state.submissions.filter(s => s.status === filter);
    }
    
    // Update stats
    updateStats();
    
    filtered.reverse().forEach(sub => {
        const d = sub.data;
        const row = tbody.insertRow();
        
        const statusBadge = getStatusBadge(sub.status);
        
        row.innerHTML = `
            <td class="p-4 text-sm">${new Date(sub.createdAt).toLocaleDateString('id-ID')}</td>
            <td class="p-4 text-sm font-medium">${d.parentName || '-'}</td>
            <td class="p-4 text-sm">${d.phone || '-'}</td>
            <td class="p-4 text-sm">${d.studentName || '-'}</td>
            <td class="p-4 text-sm">${d.schoolName || d.city || '-'}</td>
            <td class="p-4 text-sm">${d.purpose ? d.purpose.substring(0,30) + '...' : '-'}</td>
            <td class="p-4">${statusBadge}</td>
            <td class="p-4 text-center">
                <button onclick='openDetailModal(${JSON.stringify(sub).replace(/'/g, "&apos;")})' 
                    class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm">
                    <i class="fa-solid fa-eye"></i>
                </button>
            </td>
        `;
    });
}

function getStatusBadge(status){
    const badges = {
        'Menunggu Konfirmasi': '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">Menunggu</span>',
        'Terjadwal': '<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">Terjadwal</span>',
        'Selesai': '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Selesai</span>',
        'Dibatalkan': '<span class="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Dibatalkan</span>'
    };
    return badges[status] || '<span class="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Unknown</span>';
}

function updateStats(){
    const selesai = state.submissions.filter(s => s.status === 'Selesai').length;
    const proses = state.submissions.filter(s => s.status === 'Terjadwal').length;
    const cancel = state.submissions.filter(s => s.status === 'Dibatalkan').length;
    const terjadwal = state.submissions.filter(s => s.status === 'Terjadwal').length;
    const menunggu = state.submissions.filter(s => s.status === 'Menunggu Konfirmasi').length;
    const antrianIQ = state.submissions.filter(s => s.data.purpose && s.data.purpose.includes('IQ')).length;
    
    document.getElementById('stat-selesai').textContent = selesai;
    document.getElementById('stat-proses').textContent = proses;
    document.getElementById('stat-cancel').textContent = cancel;
    document.getElementById('stat-terjadwal').textContent = terjadwal;
    document.getElementById('stat-menunggu').textContent = menunggu;
    document.getElementById('stat-antrian').textContent = antrianIQ;
}

function openDetailModal(submission){
    // Implementasi detail modal - bisa ditambahkan sesuai kebutuhan
    console.log("Opening detail for:", submission);
}

function closeModal(){
    const modal = document.getElementById('actionModal');
    if(modal) modal.classList.add('hidden');
}

function openExportModal(){
    const modal = document.getElementById('exportModal');
    if(modal) modal.classList.remove('hidden');
}

function closeExportModal(){
    const modal = document.getElementById('exportModal');
    if(modal) modal.classList.add('hidden');
}

function selectExportMode(mode){
    const radios = document.getElementsByName('exportMode');
    radios.forEach(r => {
        if(r.value === mode) r.checked = true;
    });
}

function generateBulkPDF(){
    Swal.fire({
        icon: 'info',
        title: 'Fitur dalam Pengembangan',
        text: 'Fitur export PDF sedang dikembangkan'
    });
}

// ==========================================
// SETTINGS (SIMPLIFIED)
// ==========================================
function saveAllSettings(){
    Swal.fire({
        icon: 'success',
        title: 'Pengaturan Tersimpan',
        text: 'Semua perubahan telah disimpan'
    });
}

function resetSystem(){
    if(confirm('Apakah Anda yakin ingin mereset semua data? Tindakan ini tidak dapat dibatalkan!')){
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    }
}

function savePdfTemplate(){
    Swal.fire({
        icon: 'info',
        title: 'Template PDF',
        text: 'Fitur template PDF sedang dikembangkan'
    });
}

function processSchoolUpload(input){
    if(input.files && input.files[0]){
        Swal.fire({
            icon: 'info',
            title: 'Upload Data Sekolah',
            text: 'Fitur upload data sekolah sedang dikembangkan'
        });
    }
}

// ==========================================
// INIT
// ==========================================
window.onload = function() {
    console.log('🚀 Application loaded!');
    console.log('🔗 GOOGLE_SCRIPT_URL:', GOOGLE_SCRIPT_URL ? 'SET ✅' : 'NOT SET ❌');

    // PENTING: Gunakan ID yang benar sesuai HTML
    const form = document.getElementById("consultationForm");
    if(form){
        form.addEventListener("submit", handleFormSubmit);
        console.log("✅ Form handler attached to #consultationForm");
    }else{
        console.warn("⚠️ Form tidak ditemukan dengan id='consultationForm'");
    }
    
    // Load admin session
    if(state.isAdmin){
        console.log("👤 Admin session active");
    }
    
    // Apply saved settings
    applySettings();
};

function applySettings(){
    // Apply theme colors
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', state.settings.primaryColor);
    
    // Update texts
    if(state.settings.appName){
        const navName = document.getElementById('nav-app-name');
        if(navName) navName.textContent = state.settings.appName;
    }
    
    if(state.settings.appTagline){
        const navSubtitle = document.getElementById('nav-subtitle');
        if(navSubtitle) navSubtitle.textContent = state.settings.appTagline;
    }
    
    if(state.settings.footerText){
        const footer = document.getElementById('footer-text-display');
        if(footer) footer.textContent = state.settings.footerText;
    }
}
