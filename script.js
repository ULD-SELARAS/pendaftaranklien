// ==========================================
// SELARAS CLOUD SUBMIT (FINAL FIX)
// ==========================================

// ===== URL WEB APP (PAKAI YANG /exec !!!) =====
const GOOGLE_SCRIPT_URL =
"https://script.google.com/macros/s/AKfycbxskX-I8YdS4wr46OsaWQHZVKFNQjTRfefFuTdzU2A-8n0nBuHEizaaSujRYy722_5-/exec";


// ==========================================
// LOADING UI
// ==========================================
function showLoading(show=true){
    const el=document.getElementById('loading-overlay');
    if(el) el.style.display=show?'flex':'none';
}


// ==========================================
// BASE64 CONVERTER
// ==========================================
function toBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.readAsDataURL(file);
    reader.onload=()=>resolve(reader.result);
    reader.onerror=reject;
  });
}


// ==========================================
// CORE SEND FUNCTION (WAJIB FORM DATA)
// ==========================================
async function sendToGAS(payload){

  const formData=new FormData();

  for(const key in payload){
    formData.append(key,payload[key]);
  }

  const res=await fetch(GOOGLE_SCRIPT_URL,{
    method:"POST",
    body:formData
  });

  if(!res.ok) throw "Tidak bisa menghubungi server";

  return await res.json();
}


// ==========================================
// UPLOAD FILE GOOGLE DRIVE
// ==========================================
async function uploadFileToDrive(file){

  console.log("Uploading file:",file.name);

  const base64=await toBase64(file);

  const response=await sendToGAS({
    action:"uploadFile",
    fileName:file.name,
    mimeType:file.type,
    data:base64.split(',')[1]
  });

  if(response.status!=="success"){
    throw response.message || "Upload gagal";
  }

  console.log("Drive URL:",response.fileUrl);

  return response.fileUrl;
}


// ==========================================
// SIMPAN KE SPREADSHEET
// ==========================================
async function saveToSpreadsheet(submission){

  console.log("Saving to spreadsheet...");

  const res=await sendToGAS({
    action:"appendSheet",
    data:JSON.stringify(submission)
  });

  if(res.status!=="success"){
    throw res.message || "Sheet gagal";
  }

  console.log("Spreadsheet success");
}


// ==========================================
// FORM SUBMIT MAIN
// ==========================================
async function handleFormSubmit(e){

  e.preventDefault();
  showLoading(true);

  try{

    const form=e.target;
    const formData=new FormData(form);
    const data=Object.fromEntries(formData.entries());

    let driveLink="-";

    // ===============================
    // UPLOAD FILE (JIKA ADA)
    // ===============================
    if(data.hasHistory==="Ya"){

      const fileInput=document.getElementById("historyFile");

      if(fileInput && fileInput.files.length>0){

        driveLink=await uploadFileToDrive(fileInput.files[0]);

      }
    }

    // ===============================
    // BUILD OBJECT
    // ===============================
    const submission={
      id:Date.now().toString(),
      createdAt:new Date().toISOString(),
      status:"Menunggu Konfirmasi",

      parentName:data.parentName || "-",
      phone:data.phone || "-",
      email:data.email || "-",
      studentName:data.studentName || "-",
      dob:data.dob || "-",
      gender:data.gender || "-",
      educationLevel:data.educationLevel || "-",
      schoolName:data.schoolName || data.city || "-",
      purpose:data.purpose || "-",
      problemDesc:data.problemDesc || "-",
      driveFileLink:driveLink
    };

    // ===============================
    // SAVE CLOUD
    // ===============================
    await saveToSpreadsheet(submission);

    showLoading(false);
    alert("Pendaftaran berhasil tersimpan ke server!");

    form.reset();

  }catch(err){

    console.error(err);
    showLoading(false);
    alert("Gagal menyimpan ke server:\n"+err);

  }
}


// ==========================================
// INIT
// ==========================================
window.addEventListener("DOMContentLoaded",()=>{

  console.log("SELARAS Cloud Ready");
  console.log("Endpoint:",GOOGLE_SCRIPT_URL);

  const form=document.getElementById("consultationForm");

  if(form){
    form.addEventListener("submit",handleFormSubmit);
    console.log("Form handler attached");
  }else{
    console.warn("Form tidak ditemukan");
  }

});
