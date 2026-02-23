let logs = JSON.parse(localStorage.getItem('ojt_logs')) || [];
let goalHours = localStorage.getItem('ojt_goal') || 400;

const dtrBody = document.getElementById('dtrBody');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const btnIn = document.getElementById('btnIn');
const btnOut = document.getElementById('btnOut');
const btnLunch = document.getElementById('btnLunch');

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('requiredHoursInput').value = goalHours;
    startClock();
    renderUI();
});

function startClock() {
    setInterval(() => {
        document.getElementById('currentTime').innerText = new Date().toLocaleTimeString();
    }, 1000);
}

// Custom Toast Function for centered Alerts
function showAlert(message) {
    const toastElement = document.getElementById('liveToast');
    document.getElementById('toastMessage').innerText = message;
    const toast = new bootstrap.Toast(toastElement);
    toast.show();
}

function renderUI() {
    let totalWorked = 0;
    logs.sort((a, b) => new Date(a.date) - new Date(b.date));

    dtrBody.innerHTML = logs.slice().reverse().map((log, index) => {
        const actualIndex = logs.length - 1 - index;
        const hrs = parseFloat(log.duration) || 0;
        totalWorked += hrs;

        // Auto-detect day name
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

    const percent = Math.min((totalWorked / goalHours) * 100, 100).toFixed(1);
    progressBar.style.width = percent + '%';
    progressBar.innerText = percent + '%';
    progressText.innerText = `${totalWorked.toFixed(2)} / ${goalHours} total hours`;

    const isClockedIn = logs.length > 0 && !logs[logs.length - 1].timeOut;
    btnIn.disabled = isClockedIn;
    btnOut.disabled = !isClockedIn;
    const lastLog = logs[logs.length - 1];
    btnLunch.disabled = !isClockedIn || (lastLog && lastLog.lunchApplied);

    localStorage.setItem('ojt_logs', JSON.stringify(logs));
}

btnIn.onclick = () => {
    const now = new Date();
    logs.push({
        date: now.toISOString().split('T')[0],
        timeIn: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
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
        lastLog.timeOut = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let diff = (now.getTime() - lastLog.rawIn) / 3600000;
        if (lastLog.lunchApplied) diff -= 1;
        lastLog.duration = Math.max(0, diff).toFixed(2);
        renderUI();
    }
};

function addManualEntry() {
    const dateVal = document.getElementById('manualDate').value;
    const tIn = document.getElementById('manualIn').value;
    const tOut = document.getElementById('manualOut').value;
    const isLunch = document.getElementById('manualLunch').checked;

    if (!dateVal || !tIn || !tOut) return showAlert("Please fill all fields");

    const start = new Date(`${dateVal} ${tIn}`);
    const end = new Date(`${dateVal} ${tOut}`);
    
    if (end <= start) return showAlert("Time Out must be after Time In");

    let diff = (end - start) / 3600000;
    if (isLunch) diff -= 1;

    logs.push({
        date: dateVal,
        timeIn: tIn,
        timeOut: tOut,
        duration: Math.max(0, diff).toFixed(2),
        rawIn: start.getTime(),
        lunchApplied: isLunch
    });

    renderUI();
    bootstrap.Modal.getInstance(document.getElementById('manualEntryModal')).hide();
    // Clear form
    document.getElementById('manualDate').value = "";
    document.getElementById('manualIn').value = "";
    document.getElementById('manualOut').value = "";
    document.getElementById('manualLunch').checked = false;
}

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

document.getElementById('btnDownload').onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("OJT ATTENDANCE REPORT", 14, 15);
    const tableData = logs.map(l => [l.date, new Date(l.date).toLocaleDateString('en-US', {weekday:'short'}), l.timeIn, l.timeOut || '-', l.duration || '0.00']);
    doc.autoTable({ head: [['Date', 'Day', 'In', 'Out', 'Hours']], body: tableData, startY: 25 });
    doc.save(`OJT_Report_${new Date().toLocaleDateString()}.pdf`);
};