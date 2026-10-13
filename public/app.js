// Sri Vasavi Kanyaka Parameswari Ammavari Thadiyaradhana Sangham - Ongole
// Temple Receipt Management System Application Logic

// Common Gotrams list for auto-complete
const VYSYA_GOTRAMS = [
  "మిథునసంతసకుల", "మిత్రసంతసకుల", "కాశ్యప", "భరద్వాజ", "వశిష్ట", "కౌండిన్య",
  "గౌతమ", "హరితస", "శ్రీవత్స", "శాండిల్య", "కౌశిక", "పరాశర", "అత్రి",
  "విశ్వామిత్ర", "జామదగ్ని", "కుండల", "గోపిశెట్టి", "ముద్గల", "అంగీరస",
  "శౌనక", "గర్గ", "ధనంజయ", "ఉపమన్యు", "ఆగస్త్య", "బాదరాయణ", "కపిల"
];

// Telugu Number Words Translation Engine
function numberToTeluguWords(num) {
  if (!num || isNaN(num) || num <= 0) return "";
  num = Math.floor(num);

  const units = ["", "ఒకటి", "రెండు", "మూడు", "నాలుగు", "ఐదు", "ఆరు", "ఏడు", "ఎనిమిది", "తొమ్మిది"];
  const teens = ["పది", "పదకొండు", "పన్నెండు", "పదమూడు", "పద్నాలుగు", "పదిహేను", "పదహారు", "పదిహేడు", "పద్దెనిమిది", "పందొమ్మిది"];
  const tens = ["", "పది", "ఇరవై", "ముప్పై", "నలభై", "యాభై", "అరవై", "డెబ్బై", "ఎనభై", "తొంబై"];

  function convertTwoDigits(n) {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    const t = Math.floor(n / 10);
    const u = n % 10;
    if (u === 0) return tens[t];
    return tens[t] + " " + units[u];
  }

  function convertHundreds(n) {
    if (n === 0) return "";
    let res = "";
    const h = Math.floor(n / 100);
    const rem = n % 100;
    if (h > 0) {
      if (h === 1) res = "వంద";
      else res = units[h] + " వందల";
    }
    if (rem > 0) {
      const sub = convertTwoDigits(rem);
      res = res ? res + " " + sub : sub;
    }
    return res;
  }

  let result = "";

  // Crores
  const crore = Math.floor(num / 10000000);
  num = num % 10000000;
  if (crore > 0) {
    result += (crore === 1 ? "ఒక కోటి" : convertHundreds(crore) + " కోట్ల") + " ";
  }

  // Lakhs
  const lakh = Math.floor(num / 100000);
  num = num % 100000;
  if (lakh > 0) {
    result += (lakh === 1 ? "ఒక లక్ష" : convertHundreds(lakh) + " లక్షల") + " ";
  }

  // Thousands
  const thousand = Math.floor(num / 1000);
  num = num % 1000;
  if (thousand > 0) {
    result += (thousand === 1 ? "వేయి" : convertHundreds(thousand) + " వేల") + " ";
  }

  // Hundreds & units
  if (num > 0) {
    result += convertHundreds(num);
  }

  return result.trim() + " రూపాయలు మాత్రం";
}

// App State
let donorsData = [];
let editingDonorId = null;
let currentReceiptDonor = null;

// DOM Elements
const form = document.getElementById("donorForm");
const receiptNoInput = document.getElementById("receiptNo");
const dateInput = document.getElementById("receiptDate");
const nameInput = document.getElementById("donorName");
const phoneInput = document.getElementById("donorPhone");
const gotramInput = document.getElementById("donorGotram");
const areaInput = document.getElementById("donorArea");
const amountInput = document.getElementById("donorAmount");
const amountWordsInput = document.getElementById("amountWords");
const purposeInput = document.getElementById("donationPurpose");
const paymentModeInput = document.getElementById("paymentMode");
const notesInput = document.getElementById("donorNotes");
const signatureInput = document.getElementById("donorSignature");

const donorsTableBody = document.getElementById("donorsTableBody");
const searchInput = document.getElementById("searchBox");
const dateFilter = document.getElementById("dateFilter");
const emptyState = document.getElementById("emptyState");

const printModal = document.getElementById("printModal");
const closePrintModalBtn = document.getElementById("closePrintModal");
const executePrintBtn = document.getElementById("executePrintBtn");

// Quick Gotram Datalist
function populateGotrams() {
  const datalist = document.getElementById("gotramList");
  if (!datalist) return;
  datalist.innerHTML = "";
  VYSYA_GOTRAMS.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    datalist.appendChild(opt);
  });
}

// Format date to DD-MM-YYYY
function formatDateDisplay(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return dateStr;
}

// Set Today Date as Default
function setTodayDate() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  dateInput.value = `${yyyy}-${mm}-${dd}`;
}

// Determine next receipt number
function getNextReceiptNo() {
  if (!donorsData || donorsData.length === 0) return 26242;
  const maxNo = donorsData.reduce((max, d) => Math.max(max, parseInt(d.receiptNo || 0)), 26241);
  return maxNo + 1;
}

// Load Donors from Backend API or LocalStorage fallback
async function loadDonors() {
  try {
    const res = await fetch("/api/donors");
    if (res.ok) {
      donorsData = await res.json();
      localStorage.setItem("vasavi_temple_donors", JSON.stringify(donorsData));
    } else {
      throw new Error("Backend response not ok");
    }
  } catch (err) {
    console.warn("Backend not accessible, loading from localStorage:", err);
    const local = localStorage.getItem("vasavi_temple_donors");
    if (local) {
      try { donorsData = JSON.parse(local); } catch(e) { donorsData = []; }
    } else {
      // Default sample record if completely empty
      donorsData = [{
        id: "rec-26242",
        receiptNo: 26242,
        date: "2024-06-12",
        displayDate: "12-06-2024",
        name: "నరవవాడి వెంకటేశ్వర్లు, కాపు. డ. కనక మహాలక్ష్మి గార్లు",
        phone: "9440201788",
        gotram: "మిథునసంతసకుల",
        area: "శ్రీనగర్ కాలనీ, 2వ లైను, ఉం కరుణాల రోడ్డు, ఒంగోలు",
        purpose: "అమ్మవారి దేవస్థానంలో జరుగు అమ్మవారి జయంతి ఉత్సవములు, దసరా నవరాత్రులు, కార్తీకమాస అభిషేకములు, అమ్మవారి ఆత్మార్పణ దినోత్సవము పూజా కార్యక్రమాలకు (సంవత్సర చందా)",
        amount: 2516,
        amountInWords: "రెండు వేల ఐదు వందల పదహారు రూపాయలు మాత్రం",
        paymentMode: "PhonePe",
        paymentStatus: "Paid",
        notes: "RK phone pay Paid",
        signature: "Bh Venkateswarlu",
        createdAt: "2024-06-12T10:30:00Z"
      }];
      localStorage.setItem("vasavi_temple_donors", JSON.stringify(donorsData));
    }
  }

  updateStats();
  renderDonorsTable();
  if (!editingDonorId) {
    receiptNoInput.value = getNextReceiptNo();
  }
}

// Save Donor (Create or Update)
async function saveDonor(donorObj, isUpdate = false) {
  // Sync to Backend
  try {
    const url = isUpdate ? `/api/donors/${donorObj.id}` : "/api/donors";
    const method = isUpdate ? "PUT" : "POST";
    const res = await fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(donorObj)
    });
    if (res.ok) {
      console.log("Saved to backend successfully");
    }
  } catch (e) {
    console.warn("Could not save to backend directly, saved to local cache:", e);
  }

  // Sync to local state & localStorage
  if (isUpdate) {
    const idx = donorsData.findIndex(d => d.id === donorObj.id || d.receiptNo == donorObj.receiptNo);
    if (idx !== -1) donorsData[idx] = donorObj;
  } else {
    donorsData.unshift(donorObj);
  }

  localStorage.setItem("vasavi_temple_donors", JSON.stringify(donorsData));
  updateStats();
  renderDonorsTable();
}

// Update Top Statistics Cards
function updateStats() {
  const totalCount = donorsData.length;
  const totalAmount = donorsData.reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

  const todayStr = new Date().toISOString().split("T")[0];
  const todayAmount = donorsData
    .filter(d => d.date === todayStr)
    .reduce((sum, d) => sum + (parseFloat(d.amount) || 0), 0);

  document.getElementById("totalDonorsStat").textContent = totalCount;
  document.getElementById("totalAmountStat").textContent = "₹ " + totalAmount.toLocaleString("en-IN");
  document.getElementById("todayAmountStat").textContent = "₹ " + todayAmount.toLocaleString("en-IN");
}

// Render Donors Table with Filtering
function renderDonorsTable() {
  const query = (searchInput.value || "").trim().toLowerCase();
  const filterDate = dateFilter.value;

  const todayStr = new Date().toISOString().split("T")[0];
  const now = new Date();

  const filtered = donorsData.filter(d => {
    // Search matching
    const matchSearch = !query ||
      (d.receiptNo && d.receiptNo.toString().includes(query)) ||
      (d.name && d.name.toLowerCase().includes(query)) ||
      (d.phone && d.phone.includes(query)) ||
      (d.gotram && d.gotram.toLowerCase().includes(query)) ||
      (d.area && d.area.toLowerCase().includes(query));

    if (!matchSearch) return false;

    // Date matching
    if (filterDate === "today") {
      return d.date === todayStr;
    } else if (filterDate === "month") {
      if (!d.date) return false;
      const dDate = new Date(d.date);
      return dDate.getFullYear() === now.getFullYear() && dDate.getMonth() === now.getMonth();
    } else if (filterDate === "year") {
      if (!d.date) return false;
      const dDate = new Date(d.date);
      return dDate.getFullYear() === now.getFullYear();
    }

    return true;
  });

  donorsTableBody.innerHTML = "";

  if (filtered.length === 0) {
    emptyState.style.display = "block";
    return;
  }
  emptyState.style.display = "none";

  // Sort descending by receipt number
  filtered.sort((a, b) => (parseInt(b.receiptNo) || 0) - (parseInt(a.receiptNo) || 0));

  filtered.forEach(d => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><span class="receipt-badge"># ${d.receiptNo}</span></td>
      <td><strong>${d.displayDate || formatDateDisplay(d.date)}</strong></td>
      <td>
        <div style="font-weight: 700; color: #0b3c8a;">${d.name || "—"}</div>
        ${d.notes ? `<div style="font-size: 0.78rem; color: #64748b;">${d.notes}</div>` : ""}
      </td>
      <td>
        <a href="tel:${d.phone}" style="color: #2563eb; text-decoration: none; font-weight: 600;">
          📞 ${d.phone || "—"}
        </a>
      </td>
      <td><span style="background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 0.85rem;">${d.gotram || "—"}</span></td>
      <td style="max-width: 200px; font-size: 0.88rem;">${d.area || "—"}</td>
      <td><span class="amount-badge">₹ ${parseFloat(d.amount || 0).toLocaleString("en-IN")}</span></td>
      <td><span class="payment-tag">${d.paymentMode || "Cash"}</span></td>
      <td>
        <div class="action-buttons-cell">
          <button class="btn btn-primary btn-sm" onclick="openReceiptModal('${d.id}')" title="Print Authentic Receipt">
            🖨️ రసీదు
          </button>
          <button class="btn btn-secondary btn-sm" onclick="editDonor('${d.id}')" title="Edit Donor Details">
            ✏️ సవరించు
          </button>
          <button class="btn btn-secondary btn-sm" onclick="shareWhatsApp('${d.id}')" title="Share via WhatsApp" style="color: #15803d;">
            💬
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteDonor('${d.id}')" title="Delete Receipt">
            🗑️
          </button>
        </div>
      </td>
    `;
    donorsTableBody.appendChild(tr);
  });
}

// Auto translate Amount to Telugu Words on input
amountInput.addEventListener("input", (e) => {
  const val = parseFloat(e.target.value);
  if (val && !isNaN(val)) {
    const words = numberToTeluguWords(val);
    amountWordsInput.value = words;
  } else {
    amountWordsInput.value = "";
  }
});

// Quick Amount Buttons Handler
window.setQuickAmount = function(amt) {
  amountInput.value = amt;
  amountWordsInput.value = numberToTeluguWords(amt);
  amountInput.focus();
};

// Form Submission (Save & optionally print)
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const receiptNo = parseInt(receiptNoInput.value) || getNextReceiptNo();
  const dateVal = dateInput.value;
  const nameVal = nameInput.value.trim();
  const phoneVal = phoneInput.value.trim();
  const gotramVal = gotramInput.value.trim();
  const areaVal = areaInput.value.trim();
  const amountVal = parseFloat(amountInput.value) || 0;
  const wordsVal = amountWordsInput.value.trim() || numberToTeluguWords(amountVal);
  const purposeVal = purposeInput.value.trim();
  const paymentModeVal = paymentModeInput.value;
  const notesVal = notesInput.value.trim();
  const sigVal = signatureInput.value.trim();

  if (!nameVal || !phoneVal || amountVal <= 0) {
    alert("దయచేసి భక్తుని పేరు, ఫోన్ నెంబరు మరియు విరాళం మొత్తాన్ని నమోదు చేయండి.");
    return;
  }

  const donorObj = {
    id: editingDonorId || ("rec-" + receiptNo),
    receiptNo: receiptNo,
    date: dateVal,
    displayDate: formatDateDisplay(dateVal),
    name: nameVal,
    phone: phoneVal,
    gotram: gotramVal,
    area: areaVal,
    purpose: purposeVal,
    amount: amountVal,
    amountInWords: wordsVal,
    paymentMode: paymentModeVal,
    paymentStatus: "Paid",
    notes: notesVal || `${paymentModeVal} Paid`,
    signature: sigVal,
    createdAt: new Date().toISOString()
  };

  const isUpdate = !!editingDonorId;
  await saveDonor(donorObj, isUpdate);

  // If clicked Save & Print
  const isPrintTriggered = e.submitter && e.submitter.id === "saveAndPrintBtn";

  if (isPrintTriggered) {
    openReceiptModal(donorObj.id);
  } else {
    alert("రసీదు విజయవంతంగా భద్రపరచబడింది! (Receipt saved successfully!)");
  }

  resetForm();
  switchTab("listTab");
});

// Reset Form
window.resetForm = function() {
  form.reset();
  editingDonorId = null;
  setTodayDate();
  receiptNoInput.value = getNextReceiptNo();
  document.getElementById("formSubmitTitle").textContent = "రసీదు సేవ్ చేసి ప్రింట్ చేయండి (Save & Print)";
  document.getElementById("cancelEditBtn").style.display = "none";
};

// Edit Donor
window.editDonor = function(id) {
  const donor = donorsData.find(d => d.id === id || d.receiptNo == id);
  if (!donor) return;

  editingDonorId = donor.id;
  receiptNoInput.value = donor.receiptNo;
  dateInput.value = donor.date;
  nameInput.value = donor.name;
  phoneInput.value = donor.phone;
  gotramInput.value = donor.gotram || "";
  areaInput.value = donor.area || "";
  amountInput.value = donor.amount;
  amountWordsInput.value = donor.amountInWords || numberToTeluguWords(donor.amount);
  purposeInput.value = donor.purpose || "";
  paymentModeInput.value = donor.paymentMode || "PhonePe";
  notesInput.value = donor.notes || "";
  signatureInput.value = donor.signature || "";

  document.getElementById("formSubmitTitle").textContent = "రసీదును నవీకరించండి (Update Receipt)";
  document.getElementById("cancelEditBtn").style.display = "inline-flex";

  switchTab("formTab");
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// Delete Donor
window.deleteDonor = async function(id) {
  const donor = donorsData.find(d => d.id === id || d.receiptNo == id);
  if (!donor) return;

  if (!confirm(`మీరు రసీదు నెం. ${donor.receiptNo} (${donor.name}) ను నిజంగా తొలగించాలనుకుంటున్నారా?`)) {
    return;
  }

  try {
    await fetch(`/api/donors/${id}`, { method: "DELETE" });
  } catch (e) {
    console.warn("Delete backend error:", e);
  }

  donorsData = donorsData.filter(d => d.id !== id && d.receiptNo != id);
  localStorage.setItem("vasavi_temple_donors", JSON.stringify(donorsData));
  updateStats();
  renderDonorsTable();
};

// Open Exact Receipt Print Modal
window.openReceiptModal = function(id) {
  const donor = donorsData.find(d => d.id === id || d.receiptNo == id);
  if (!donor) return;

  currentReceiptDonor = donor;

  // Populate Printed Receipt Elements
  document.getElementById("prReceiptNo").textContent = donor.receiptNo;
  document.getElementById("prDate").textContent = donor.displayDate || formatDateDisplay(donor.date);
  document.getElementById("prName").textContent = donor.name || "";
  document.getElementById("prArea").textContent = donor.area || "";
  document.getElementById("prPhone").textContent = donor.phone || "";
  document.getElementById("prGotram").textContent = donor.gotram || "";
  document.getElementById("prAmountWords").textContent = donor.amountInWords || numberToTeluguWords(donor.amount);
  document.getElementById("prAmountNum").textContent = `Rs. ${parseFloat(donor.amount || 0).toLocaleString("en-IN")}/-`;
  document.getElementById("prHandNote").textContent = donor.notes || `${donor.paymentMode || "PhonePe"} Paid`;
  document.getElementById("prDonorSig").textContent = donor.signature || (donor.name ? donor.name.split(",")[0] : "");

  printModal.classList.add("active");
};

// Close Modal
closePrintModalBtn.addEventListener("click", () => {
  printModal.classList.remove("active");
});
printModal.addEventListener("click", (e) => {
  if (e.target === printModal) {
    printModal.classList.remove("active");
  }
});

// Print Command
executePrintBtn.addEventListener("click", () => {
  window.print();
});

// Share via WhatsApp
window.shareWhatsApp = function(id) {
  const donor = donorsData.find(d => d.id === id || d.receiptNo == id);
  if (!donor) return;

  const phone = donor.phone.replace(/[^0-9]/g, "");
  const formattedPhone = phone.startsWith("91") ? phone : "91" + phone;

  const msg = 
`*ఓం శ్రీ వాసవీమాత్రేనమః*
*శ్రీ వాసవి కన్యకాపరమేశ్వరి అమ్మవారి తదియోరాధన సంఘం, ఒంగోలు*
----------------------------------------
*భక్తిపూర్వక రసీదు రశీదు నెం:* ${donor.receiptNo}
*తేది:* ${donor.displayDate || formatDateDisplay(donor.date)}
*శ్రీ/శ్రీమతి:* ${donor.name}
*గోత్రము:* ${donor.gotram || "—"}
*ప్రాంతం:* ${donor.area || "—"}
*విరాళం మొత్తం:* ₹ ${donor.amount}/-
*అక్షరములు:* ${donor.amountInWords}
*చెల్లింపు:* ${donor.paymentMode} (${donor.notes || "Paid"})
----------------------------------------
అమ్మవారి కృపా కటాక్షములు మీ కుటుంబానికి ఎల్లవేళలా కలగాలని ప్రార్థిస్తున్నాము.
_శ్రీ వాసవి కన్యకాపరమేశ్వరి అమ్మవారి తదియోరాధన సంఘం, ఒంగోలు._`;

  const encoded = encodeURIComponent(msg);
  const waUrl = `https://wa.me/${formattedPhone}?text=${encoded}`;
  window.open(waUrl, "_blank");
};

// Tabs Switching
window.switchTab = function(tabName) {
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  document.querySelectorAll(".tab-pane").forEach(pane => pane.style.display = "none");

  if (tabName === "formTab") {
    document.getElementById("navFormBtn").classList.add("active");
    document.getElementById("formTabContent").style.display = "block";
  } else if (tabName === "listTab") {
    document.getElementById("navListBtn").classList.add("active");
    document.getElementById("listTabContent").style.display = "block";
    renderDonorsTable();
  } else if (tabName === "backupTab") {
    document.getElementById("navBackupBtn").classList.add("active");
    document.getElementById("backupTabContent").style.display = "block";
  }
};

// Excel Export (.xlsx)
window.exportExcel = function() {
  if (!donorsData || donorsData.length === 0) {
    alert("ఎగుమతి చేయడానికి ఎటువంటి రికార్డులు లేవు.");
    return;
  }

  if (typeof XLSX === "undefined") {
    // Fallback to CSV if XLSX not loaded
    exportCSV();
    return;
  }

  const exportData = donorsData.map(d => ({
    "రసీదు నెం (Receipt No)": d.receiptNo,
    "తేది (Date)": d.displayDate || formatDateDisplay(d.date),
    "భక్తుని పేరు (Donor Name)": d.name,
    "ఫోన్ నెంబరు (Phone)": d.phone,
    "గోత్రము (Gotram)": d.gotram || "",
    "చిరునామా / ప్రాంతం (Address)": d.area || "",
    "విరాళం మొత్తం రూ. (Amount)": d.amount,
    "అక్షరములు (Amount in Words)": d.amountInWords,
    "చెల్లింపు విధానం (Payment Mode)": d.paymentMode,
    "గమనిక (Notes)": d.notes || "",
    "సంతకం (Signatory)": d.signature || ""
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Temple Donors");

  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `Vasavi_Temple_Donations_${today}.xlsx`);
};

// CSV Export (.csv with UTF-8 BOM for Excel compatibility)
window.exportCSV = function() {
  if (!donorsData || donorsData.length === 0) {
    alert("ఎగుమతి చేయడానికి ఎటువంటి రికార్డులు లేవు.");
    return;
  }

  // Try direct backend download first
  window.location.href = "/api/export/csv";
};

// JSON Database Backup Download
window.downloadBackup = function() {
  const jsonStr = JSON.stringify(donorsData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const today = new Date().toISOString().split("T")[0];
  a.download = `Vasavi_Temple_Database_Backup_${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// JSON Restore / Import
window.handleFileRestore = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) {
        alert("చెల్లని ఫైల్ ఫార్మాట్. దయచేసి సరైన JSON ఫైల్‌ను ఎంచుకోండి.");
        return;
      }

      // Merge records
      const map = new Map();
      donorsData.forEach(d => map.set(String(d.receiptNo), d));
      imported.forEach(d => map.set(String(d.receiptNo), d));

      donorsData = Array.from(map.values());
      localStorage.setItem("vasavi_temple_donors", JSON.stringify(donorsData));

      // Sync with backend if reachable
      try {
        await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(donorsData)
        });
      } catch (err) {}

      updateStats();
      renderDonorsTable();
      alert(`విజయవంతంగా ${imported.length} రికార్డులు పునరుద్ధరించబడ్డాయి!`);
      switchTab("listTab");
    } catch (err) {
      alert("ఫైల్ చదవడంలో లోపం: " + err.message);
    }
  };
  reader.readAsText(file);
};

// Live search listener
searchInput.addEventListener("input", renderDonorsTable);
dateFilter.addEventListener("change", renderDonorsTable);

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  setTodayDate();
  populateGotrams();
  loadDonors();
});
