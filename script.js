// --- APP STATE ---
let logs = JSON.parse(localStorage.getItem('ojt_logs')) || [];
let goalHours = localStorage.getItem('ojt_goal') || 486;

// --- ELEMENTS ---
const dtrBody = document.getElementById('dtrBody');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const btnIn = document.getElementById('btnIn');
const btnOut = document.getElementById('btnOut');
const btnLunch = document.getElementById('btnLunch');

// --- INITIALIZE ---
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('requiredHoursInput').value = goalHours;
    startClock();
    renderUI();
});

function startClock() {
    setInterval(() => {
        // 12-hour format for the live clock
        document.getElementById('currentTime').innerText = new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true 
        });
    }, 1000);
}

function showAlert(message) {
    const toastElement = document.getElementById('liveToast');
    document.getElementById('toastMessage').innerText = message;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}

// --- CORE UI RENDER ---
function renderUI() {
    let totalWorked = 0;
    logs.sort((a, b) => new Date(a.date) - new Date(b.date));

    dtrBody.innerHTML = logs.slice().reverse().map((log, index) => {
        const actualIndex = logs.length - 1 - index;
        const hrs = parseFloat(log.duration) || 0;
        totalWorked += hrs;

        const dayName = new Date(log.date).toLocaleDateString('en-US', { weekday: 'long' });

        return `
            <tr>
                <td>${log.date} ${log.lunchApplied ? '🍱' : ''}</td>
                <td class="day-cell">${dayName}</td>
                <td><span class="badge bg-light text-dark border">${log.timeIn}</span></td>
                <td><span class="badge bg-light text-dark border">${log.timeOut || 'Active...'}</span></td>
                <td><strong>${log.duration || '0.00'} hrs</strong></td>
                <td>
                    <button class="btn btn-sm text-danger" onclick="deleteLog(${actualIndex})">Delete</button>
                </td>
            </tr>`;
    }).join('');

    const remaining = Math.max(0, goalHours - totalWorked);
    const percent = Math.min((totalWorked / goalHours) * 100, 100).toFixed(1);

    // Main dashboard stays precise
    progressBar.style.width = percent + '%';
    progressBar.innerText = percent + '%';
    progressText.innerText = `${totalWorked.toFixed(2)} / ${goalHours} total hours`;

    // UPDATE PROGRESS MODAL (WHOLE NUMBERS ONLY)
    document.getElementById('modalCompleted').innerText = Math.round(totalWorked);
    document.getElementById('modalRemaining').innerText = Math.round(remaining);
    document.getElementById('modalPercentage').innerText = Math.round(percent) + '%';

    // Button states
    const isClockedIn = logs.length > 0 && !logs[logs.length - 1].timeOut;
    btnIn.disabled = isClockedIn;
    btnOut.disabled = !isClockedIn;
    const lastLog = logs[logs.length - 1];
    btnLunch.disabled = !isClockedIn || (lastLog && lastLog.lunchApplied);

    localStorage.setItem('ojt_logs', JSON.stringify(logs));
}

// --- EVENT HANDLERS ---

btnIn.onclick = () => {
    const now = new Date();
    logs.push({
        date: now.toISOString().split('T')[0],
        // Save in 12-hour format
        timeIn: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
        timeOut: null,
        rawIn: now.getTime(),
        duration: null,
        lunchApplied: false
    });
    renderUI();
};

btnLunch.onclick = () => {
    const lastLog = logs[logs.length - 1];
    if (confirm("Deduct 1 hour for lunch break?")) {
        lastLog.lunchApplied = true;
        renderUI();
    }
};

btnOut.onclick = () => {
    const now = new Date();
    const lastLog = logs[logs.length - 1];
    if (lastLog && !lastLog.timeOut) {
        lastLog.timeOut = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        let diff = (now.getTime() - lastLog.rawIn) / 3600000;
        if (lastLog.lunchApplied) diff -= 1;
        lastLog.duration = Math.max(0, diff).toFixed(2);
        renderUI();
    }
};

function addManualEntry() {
    const dateVal = document.getElementById('manualDate').value;
    const tInRaw = document.getElementById('manualIn').value;
    const tOutRaw = document.getElementById('manualOut').value;
    const isLunch = document.getElementById('manualLunch').checked;

    if (!dateVal || !tInRaw || !tOutRaw) return showAlert("Please fill all fields");

    const start = new Date(`${dateVal} ${tInRaw}`);
    const end = new Date(`${dateVal} ${tOutRaw}`);
    
    if (end <= start) return showAlert("Time Out must be after Time In");

    let diff = (end - start) / 3600000;
    if (isLunch) {
        if (diff < 1) return showAlert("Shift too short for lunch deduction!");
        diff -= 1;
    }

    // Convert raw time inputs (24h) to 12h format for table display
    const timeInFormatted = start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const timeOutFormatted = end.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    logs.push({
        date: dateVal,
        timeIn: timeInFormatted,
        timeOut: timeOutFormatted,
        duration: diff.toFixed(2),
        rawIn: start.getTime(),
        lunchApplied: isLunch
    });

    renderUI();
    bootstrap.Modal.getInstance(document.getElementById('manualEntryModal')).hide();
    
    // Reset form
    document.getElementById('manualDate').value = "";
    document.getElementById('manualIn').value = "";
    document.getElementById('manualOut').value = "";
    document.getElementById('manualLunch').checked = false;
}

// --- SETTINGS ---

function updateSettings() {
    goalHours = document.getElementById('requiredHoursInput').value;
    localStorage.setItem('ojt_goal', goalHours);
    renderUI();
    bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
}

function deleteLog(index) {
    if (confirm("Delete this entry?")) {
        logs.splice(index, 1);
        renderUI();
    }
}

function clearAllData() {
    if (confirm("This will erase all logs permanently! Continue?")) {
        logs = [];
        renderUI();
    }
}

// --- PDF EXPORT ---
document.getElementById('btnDownload').onclick = () => {
    // Check if jsPDF library is loaded
    if (!window.jspdf || !window.jspdf.jsPDF) {
        showAlert("PDF library is still loading. Please wait.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(18);
    doc.text("OJT ATTENDANCE REPORT", 14, 20);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);
    
    // Summary info
    const completed = document.getElementById('modalCompleted').innerText;
    doc.text(`Total Completed Hours: ${completed} hrs`, 14, 35);

    // Prepare Table Data
    const tableData = logs.map(l => [
        l.date, 
        new Date(l.date).toLocaleDateString('en-US', {weekday:'short'}), 
        l.timeIn, 
        l.timeOut || '-', 
        l.duration || '0.00'
    ]);

    // Generate Table
    doc.autoTable({ 
        head: [['Date', 'Day', 'In', 'Out', 'Hours']], 
        body: tableData, 
        startY: 40,
        theme: 'grid',
        headStyles: { fillColor: [33, 37, 41] },
        styles: { halign: 'center' }
    });

    // Filename Fix: Using current date instead of the undefined 'dateVal'
    const today = new Date().toISOString().split('T')[0];
    doc.save(`OJT_DTR_Report_${today}.pdf`);
};