// ==========================================
// SISTEM PENDAFTARAN SELARAS - FULL VERSION
// ==========================================

// 1. CONFIG & STATE
// ==========================================
const DB_KEY = 'uld_submissions';
const SCHOOL_DB_KEY = 'uld_schools';
const QUEUE_KEY = 'uld_queue_counter';
const SETTINGS_KEY = 'uld_settings';
const ADMIN_SESSION_KEY = 'uld_admin_session';

// --- KONFIGURASI INTEGRASI GOOGLE (WAJIB DIISI) ---
// ⚠️ GANTI URL INI dengan URL Web App dari Google Apps Script Anda
https://script.google.com/macros/s/AKfycbzNa54WNPgS1yS-1aR1641a8wicP3Q86GFu2sNpHXD8hC-gNlZ9BjM8hFchumFSVLjr/exec 

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

const initialSchools = [
    { npsn: "20103968", name: "SD NEGERI 01 PAGI" },
    { npsn: "20104001", name: "SD NEGERI 03 PAGI" },
    { npsn: "20107880", name: "SMP NEGERI 1 JAKARTA" },
    { npsn: "20107881", name: "SMA NEGERI 1 JAKARTA" }
];

let state = {
    submissions: JSON.parse(localStorage.getItem(DB_KEY)) || [],
    schools: JSON.parse(localStorage.getItem(SCHOOL_DB_KEY)) || initialSchools,
    queueCounter: parseInt(localStorage.getItem(QUEUE_KEY)) || 1,
    settings: { ...defaultSettings, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) },
    isAdmin: sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true',
    currentFilter: 'all'
};

if (!localStorage.getItem(SETTINGS_KEY)) {
    state.settings = defaultSettings;
} else {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    state.settings = { ...defaultSettings, ...saved };
}

function saveState() {
    localStorage.setItem(DB_KEY, JSON.stringify(state.submissions));
    localStorage.setItem(SCHOOL_DB_KEY, JSON.stringify(state.schools));
    localStorage.setItem(QUEUE_KEY, state.queueCounter);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

// ==========================================
// 2. GOOGLE INTEGRATION HELPERS
// ==========================================
async function uploadFileToDrive(file, folderPath) {
    if (!GOOGLE_SCRIPT_URL) {
        console.warn('GOOGLE_SCRIPT_URL tidak diisi, file tidak akan diupload ke Drive');
        return null;
    }
    
    const reader = new FileReader();
    return new Promise((resolve) => {
        reader.onload = async () => {
            const base64Data = reader.result.split(',')[1];
            const payload = {
                action: 'uploadFile',
                fileName: file.name,
                mimeType: file.type,
                data: base64Data,
                folderPath: folderPath
            };
            
            try {
                const response = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                const result = await response.json();
                console.log('Upload result:', result);
                resolve(result.fileUrl || null);
            } catch (error) {
                console.error("Upload Error:", error);
                resolve(null);
            }
        };
        reader.readAsDataURL(file);
    });
}

async function saveToSpreadsheet(submission) {
    if (!GOOGLE_SCRIPT_URL) {
        console.warn('GOOGLE_SCRIPT_URL tidak diisi, data hanya disimpan di localStorage');
        return true;
    }
    
    const payload = {
        action: 'appendSheet',
        data: submission
    };
    
    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        console.log('Sheet save result:', result);
        return result.status === 'success';
    } catch (error) {
        console.error("Sheet Error:", error);
        return false;
    }
}

// ==========================================
// 3. BRANDING FUNCTIONS
// ==========================================
function applyBranding() {
    const s = state.settings;
    const root = document.documentElement;
    root.style.setProperty('--brand-primary', s.primaryColor);
    
    document.getElementById('setPrimaryColor').value = s.primaryColor;
    document.getElementById('setPrimaryColorText').innerText = s.primaryColor;
    document.getElementById('page-title').innerText = s.appName + " - " + s.appTagline;
    document.getElementById('nav-app-name').innerText = s.appName;
    document.getElementById('nav-subtitle').innerText = s.appTagline;
    document.getElementById('footer-text-display').innerText = s.footerText;
    
    const navLogo = document.getElementById('nav-logo-img');
    if (s.appLogo) {
        navLogo.src = s.appLogo;
        navLogo.classList.remove('hidden');
        document.getElementById('nav-logo-icon').classList.add('hidden');
    } else {
        navLogo.classList.add('hidden');
        document.getElementById('nav-logo-icon').classList.remove('hidden');
    }
    
    const loginBg = document.getElementById('login-bg-layer');
    if (s.loginBg) {
        loginBg.style.backgroundImage = `url('${s.loginBg}')`;
    }
    
    if (s.favicon) {
        document.getElementById('dynamic-favicon').href = s.favicon;
    }
    
    document.getElementById('setAppName').value = s.appName;
    document.getElementById('setAppTagline').value = s.appTagline;
    document.getElementById('setFooterText').value = s.footerText;
}

function handleFileInputToBase64(fileId, callback) {
    const input = document.getElementById(fileId);
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            callback(e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    } else {
        callback(null);
    }
}

function saveAllSettings() {
    showLoading(true);
    state.settings.appName = document.getElementById('setAppName').value;
    state.settings.appTagline = document.getElementById('setAppTagline').value;
    state.settings.primaryColor = document.getElementById('setPrimaryColor').value;
    state.settings.footerText = document.getElementById('setFooterText').value;
    
    const saveFiles = () => {
        handleFileInputToBase64('setAppLogo', (res) => {
            if(res) state.settings.appLogo = res;
            handleFileInputToBase64('setAgencyLogo', (res) => {
                if(res) state.settings.agencyLogo = res;
                handleFileInputToBase64('setFavicon', (res) => {
                    if(res) state.settings.favicon = res;
                    handleFileInputToBase64('setLoginBg', (res) => {
                        if(res) state.settings.loginBg = res;
                        saveState();
                        applyBranding();
                        showLoading(false);
                        showToast('Berhasil', 'Pengaturan Diperbarui!');
                    });
                });
            });
        });
    };
    saveFiles();
}

// --- NAVIGATION & UI HELPERS ---
function navigate(view) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    window.scrollTo(0,0);
    
    if (view === 'dashboard') renderAdminDashboard();
    if (view === 'settings') renderSettings();
}

function showLoading(show = true) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

function showToast(title, text, icon = 'success') {
    Swal.fire({
        title,
        text,
        icon,
        confirmButtonColor: state.settings.primaryColor
    });
}

// --- 4. FORM LOGIC ---
function handleEducationChange() {
    const level = document.getElementById('educationLevel').value;
    const container = document.getElementById('dynamicFields');
    container.innerHTML = '';
    container.classList.add('hidden');
    
    if (!level) return;
    
    let html = '';
    const cities = ["Jakarta Pusat", "Jakarta Utara", "Jakarta Barat", "Jakarta Selatan", "Jakarta Timur", "Kepulauan Seribu", "Lainnya"];
    
    if (level === 'Belum Sekolah' || level === 'LPK') {
        html += `<div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-1">Kota/Kabupaten Domisili</label><select name="city" id="citySelect" class="w-full p-2 border rounded bg-white" onchange="checkCity()">${cities.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>`;
        
        if (level === 'Belum Sekolah') {
            html += `<div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-1">Alamat Tempat Tinggal</label><input type="text" name="address" class="w-full p-2 border rounded"></div>`;
        } else if (level === 'LPK') {
            html += `<div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-1">Nama Lembaga</label><input type="text" name="institutionName" class="w-full p-2 border rounded"></div><div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-1">Alamat Lembaga</label><input type="text" name="address" class="w-full p-2 border rounded"></div>`;
        }
    } else {
        html += `<div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-1">Nomor NPSN Sekolah</label><div class="relative"><input type="text" name="npsn" id="npsnInput" class="w-full p-2 border rounded pr-10" placeholder="Masukkan NPSN..." oninput="searchNPSN()"><i class="fa-solid fa-search absolute right-3 top-3 text-gray-400"></i></div><ul id="npsnSuggestions" class="absolute z-10 w-full bg-white border border-gray-300 rounded mt-1 max-h-40 overflow-y-auto hidden shadow-lg"></ul></div><div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-1">Nama Sekolah</label><input type="text" name="schoolName" id="schoolNameInput" class="w-full p-2 border rounded bg-gray-100" readonly placeholder="Otomatis terisi dari NPSN"><input type="hidden" name="schoolNameManual" id="schoolNameManual" placeholder="Isi manual jika tidak ditemukan"><p id="manualSchoolLink" class="text-xs text-blue-600 mt-1 cursor-pointer hidden underline" onclick="enableManualSchool()">Sekolah tidak ditemukan? Klik di sini.</p></div>`;
    }
    
    container.innerHTML = html;
    container.classList.remove('hidden');
}

function searchNPSN() {
    const val = document.getElementById('npsnInput').value;
    const ul = document.getElementById('npsnSuggestions');
    const manualLink = document.getElementById('manualSchoolLink');
    
    if (val.length < 3) {
        ul.classList.add('hidden');
        return;
    }
    
    const matches = state.schools.filter(s => 
        s.npsn.includes(val) || s.name.toLowerCase().includes(val.toLowerCase())
    );
    
    ul.innerHTML = '';
    
    if (matches.length > 0) {
        matches.slice(0, 5).forEach(m => {
            const li = document.createElement('li');
            li.className = "p-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0";
            li.innerHTML = `<strong>${m.npsn}</strong> - ${m.name}`;
            li.onclick = () => {
                document.getElementById('npsnInput').value = m.npsn;
                document.getElementById('schoolNameInput').value = m.name;
                ul.classList.add('hidden');
            };
            ul.appendChild(li);
        });
        ul.classList.remove('hidden');
        manualLink.classList.add('hidden');
    } else {
        ul.classList.add('hidden');
        manualLink.classList.remove('hidden');
    }
}

function enableManualSchool() {
    document.getElementById('schoolNameInput').removeAttribute('readonly');
    document.getElementById('schoolNameInput').classList.remove('bg-gray-100');
    document.getElementById('schoolNameInput').focus();
    document.getElementById('schoolNameInput').value = '';
}

function checkCity() {}
function handlePurposeChange() {}

function toggleFileUpload(show) {
    const section = document.getElementById('fileUploadSection');
    const input = document.getElementById('historyFile');
    
    if (show) {
        section.classList.remove('hidden');
        input.setAttribute('required', 'true');
    } else {
        section.classList.add('hidden');
        input.removeAttribute('required');
    }
}

// --- 5. SUBMISSION HANDLING (WITH CLOUD) ---
async function handleFormSubmit(e) {
    e.preventDefault();
    showLoading(true);
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,9}$/;
    if (!phoneRegex.test(data.phone)) {
        showLoading(false);
        showToast('Error', 'Nomor HP tidak valid', 'error');
        return;
    }
    
    const level = data.educationLevel;
    let isRejected = false;
    let rejectionReason = "";
    
    if ((level === 'Belum Sekolah' || level === 'LPK') && data.city === 'Lainnya') {
        isRejected = true;
        rejectionReason = "Ditolak Wilayah";
    }
    
    // Proses File Upload ke Drive (Jika ada)
    let driveFileUrl = null;
    if (data.hasHistory === 'Ya' && GOOGLE_SCRIPT_URL) {
        const fileInput = document.getElementById('historyFile');
        if (fileInput.files.length > 0) {
            const now = new Date();
            const folderPath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
            const cleanName = data.parentName.replace(/[^a-zA-Z0-9]/g, '');
            const fileName = `${data.studentName}_${cleanName}_HistoryTes`;
            
            driveFileUrl = await uploadFileToDrive(fileInput.files[0], folderPath);
        }
    }
    
    if (data.hasHistory === 'Ya' && GOOGLE_SCRIPT_URL && !driveFileUrl) {
        showLoading(false);
        showToast('Gagal', 'Gagal mengupload file ke Drive. Silakan coba lagi.', 'error');
        return;
    }
    
    let queueNumber = null;
    if (data.purpose === 'Tes Intelegensi (IQ)') {
        queueNumber = state.queueCounter++;
        saveState();
    }
    
    if (driveFileUrl) data.driveFileLink = driveFileUrl;
    
    const submission = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        status: isRejected ? rejectionReason : 'Menunggu Konfirmasi',
        queueNumber: queueNumber,
        data: data,
        fileName: data.hasHistory === 'Ya' ? (document.getElementById('historyFile').files[0] || {}).name : null,
        isDeleted: false,
        isPurposeEdited: false,
        auditLog: []
    };
    
    // Simpan ke Spreadsheet
    if (GOOGLE_SCRIPT_URL) {
        const sheetSuccess = await saveToSpreadsheet(submission);
        if (!sheetSuccess) {
            showLoading(false);
            showToast('Gagal', 'Gagal menyimpan ke Database Server.', 'error');
            return;
        }
    }
    
    state.submissions.push(submission);
    saveState();
    showLoading(false);
    
    if (isRejected) {
        Swal.fire({
            title: 'Mohon Maaf',
            html: 'Layanan hanya melayani wilayah DKI Jakarta.',
            icon: 'warning',
            confirmButtonColor: '#d33'
        });
    } else {
        Swal.fire({
            title: 'Pendaftaran Berhasil',
            text: 'Mohon menunggu admin menghubungi anda.',
            icon: 'success',
            confirmButtonColor: state.settings.primaryColor
        });
    }
    
    e.target.reset();
    document.getElementById('dynamicFields').innerHTML = '';
    document.getElementById('dynamicFields').classList.add('hidden');
}

// --- 6. ADMIN PANEL LOGIC ---
function checkAdminAccess() {
    state.isAdmin ? navigate('dashboard') : navigate('login');
}

function handleAdminLogin(e) {
    e.preventDefault();
    const u = document.getElementById('adminUser').value;
    const p = document.getElementById('adminPass').value;
    
    if (u === 'uldselaras' && p === 'uldselaras123') {
        state.isAdmin = true;
        sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
        navigate('dashboard');
    } else {
        showToast('Gagal', 'Username atau password salah', 'error');
    }
}

function logoutAdmin() {
    state.isAdmin = false;
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    navigate('home');
}

function renderAdminDashboard() {
    if (!state.isAdmin) return navigate('login');
    
    const s = state.submissions.filter(x => !x.isDeleted);
    document.getElementById('stat-selesai').innerText = s.filter(x => x.status === 'Selesai').length;
    document.getElementById('stat-proses').innerText = s.filter(x => x.status === 'Proses').length;
    document.getElementById('stat-cancel').innerText = s.filter(x => x.status.startsWith('Cancel')).length;
    document.getElementById('stat-terjadwal').innerText = s.filter(x => x.status === 'Terjadwal').length;
    document.getElementById('stat-menunggu').innerText = s.filter(x => x.status === 'Menunggu Konfirmasi').length;
    
    const iqPending = s.filter(x => 
        x.data.purpose === 'Tes Intelegensi (IQ)' && 
        x.status !== 'Selesai' && 
        !x.status.startsWith('Cancel')
    ).length;
    document.getElementById('stat-antrian').innerText = iqPending;
    
    renderAdminTable();
}

function renderAdminTable(filterStatus = 'all') {
    state.currentFilter = filterStatus;
    const tbody = document.getElementById('adminTableBody');
    tbody.innerHTML = '';
    
    let data = state.submissions
        .filter(x => !x.isDeleted)
        .sort((a,b) => b.id - a.id);
    
    if (filterStatus !== 'all') {
        data = data.filter(item => item.status === filterStatus);
    }
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-500">Tidak ada data.</td></tr>`;
        return;
    }
    
    data.forEach(item => {
        const dob = new Date(item.data.dob);
        const diff_ms = Date.now() - dob.getTime();
        const age_dt = new Date(diff_ms);
        const age = Math.abs(age_dt.getUTCFullYear() - 1970);
        
        let origin = item.data.schoolName || '-';
        if (item.data.educationLevel === 'LPK') {
            origin = item.data.institutionName || '-';
        } else if (item.data.educationLevel === 'Belum Sekolah') {
            origin = item.data.city || '-';
        }
        
        let iqBadge = '';
        if (item.queueNumber) {
            iqBadge = `<br><span class="bg-purple-100 text-purple-800 text-xs px-2 py-0.5 rounded-full border border-purple-200 font-mono">Antrian: #${item.queueNumber}</span>`;
        }
        
        let editedBadge = '';
        if (item.isPurposeEdited) {
            editedBadge = `<span class="text-xs text-orange-600 italic block mt-1">Tujuan Disesuaikan Admin</span>`;
        }
        
        const tr = document.createElement('tr');
        tr.className = "hover:bg-gray-50 border-b";
        tr.innerHTML = `
            <td class="p-4 text-xs text-gray-500">${new Date(item.createdAt).toLocaleDateString('id-ID')}</td>
            <td class="p-4 font-medium">${item.data.parentName}</td>
            <td class="p-4">${item.data.phone}</td>
            <td class="p-4">
                <div class="font-bold">${item.data.studentName}</div>
                <div class="text-xs text-gray-500">${age} Thn • ${item.data.gender}</div>
            </td>
            <td class="p-4 text-sm">${origin}</td>
            <td class="p-4 text-sm">${item.data.purpose}${iqBadge}${editedBadge}</td>
            <td class="p-4"><span class="px-2 py-1 rounded text-xs font-bold ${getStatusColor(item.status)}">${item.status}</span></td>
            <td class="p-4 text-center">
                <button onclick="openDetail('${item.id}')" class="bg-blue-100 text-blue-600 px-3 py-1 rounded hover:bg-blue-200 text-xs font-bold">Detail/Aksi</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getStatusColor(status) {
    if (status.startsWith('Cancel')) return 'bg-red-100 text-red-800';
    switch(status) {
        case 'Selesai': return 'bg-green-100 text-green-800';
        case 'Terjadwal': return 'bg-blue-100 text-blue-800';
        case 'Proses': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-200 text-gray-800';
    }
}

// --- OTHERS ---
function renderSettings() {
    document.getElementById('totalSchools').innerText = state.schools.length;
    if (state.settings.pdfTemplate) {
        document.getElementById('previewTemplate').innerHTML = `<img src="${state.settings.pdfTemplate}" class="w-full h-auto object-cover">`;
        document.getElementById('previewTemplate').classList.remove('hidden');
    }
}

function processSchoolUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
        
        const newSchools = [];
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row[0] && row[1]) {
                newSchools.push({
                    npsn: String(row[0]),
                    name: String(row[1])
                });
            }
        }
        
        if (newSchools.length > 0) {
            state.schools = newSchools;
            saveState();
            showToast('Sukses', `${newSchools.length} data sekolah berhasil diimport!`);
            renderSettings();
        } else {
            showToast('Gagal', 'Format file tidak dikenali', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

function savePdfTemplate() {
    const input = document.getElementById('pdfTemplateUpload');
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            state.settings.pdfTemplate = e.target.result;
            saveState();
            renderSettings();
            showToast('Sukses', 'Template PDF disimpan');
        };
        reader.readAsDataURL(input.files[0]);
    }
}

function resetSystem() {
    if(confirm("Yakin reset semua data? Ini tidak bisa dibatalkan!")) {
        localStorage.clear();
        location.reload();
    }
}

// --- MODAL FUNCTIONS (akan dilanjutkan di bagian berikutnya) ---
function openDetail(id) {
    // Implementasi lengkap ada di file terpisah
    console.log('Opening detail for:', id);
}

function closeModal() {
    document.getElementById('actionModal').classList.add('hidden');
}

function openExportModal() {
    document.getElementById('exportModal').classList.remove('hidden');
}

function closeExportModal() {
    document.getElementById('exportModal').classList.add('hidden');
}

// --- INIT ---
window.onload = function() {
    applyBranding();
    if(state.isAdmin) navigate('dashboard');
};
