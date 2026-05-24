/**
 * @fileoverview Controller UI — menghubungkan interaksi pengguna dengan
 * model data (store.js). Menangani event handling, rendering DOM,
 * form validation, quick-log, filter, modal, dan toggle tampilan.
 *
 * Arsitektur: Event → Store → Render
 *
 * @author Driver Grabike Batam
 * @version 2.0.0-simple
 */

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

let currentFilter = 'all';

/**
 * Cache referensi elemen DOM yang sering diakses.
 * Diinisialisasi sekali saat DOMContentLoaded untuk performa.
 * @type {Object<string, HTMLElement|null>}
 */
const DOM = {
    // Balances
    netProfit: document.getElementById('netProfit'),
    totalIncome: document.getElementById('totalIncome'),
    totalExpense: document.getElementById('totalExpense'),
    capitalBensin: document.getElementById('capitalBensin'),
    capitalKredit: document.getElementById('capitalKredit'),
    operationalCost: document.getElementById('operationalCost'),

    // Target
    todayIncome: document.getElementById('todayIncome'),
    dailyTargetText: document.getElementById('dailyTargetText'),
    targetBar: document.getElementById('targetBar'),
    targetPercent: document.getElementById('targetPercent'),
    targetStatusMsg: document.getElementById('targetStatusMsg'),

    // Forms & Inputs
    txForm: document.getElementById('txForm'),
    txType: document.getElementById('txType'),
    txCategory: document.getElementById('txCategory'),
    txAmount: document.getElementById('txAmount'),
    txDate: document.getElementById('txDate'),
    txNote: document.getElementById('txNote'),
    submitBtnText: document.getElementById('submitBtnText'),

    // Filters & Search
    filterBtns: document.querySelectorAll('.filter-btn'),
    searchTx: document.getElementById('searchTx'),
    historyList: document.getElementById('historyList'),

    // Modals
    settingsModal: document.getElementById('settingsModal'),
    backupModal: document.getElementById('backupModal'),
    
    // Settings Form Inputs
    cfgDriverName: document.getElementById('cfgDriverName'),
    cfgDailyTarget: document.getElementById('cfgDailyTarget'),
    settingsForm: document.getElementById('settingsForm'),
    
    // Backup & Restore
    btnExportJSON: document.getElementById('btnExportJSON'),
    btnExportCSV: document.getElementById('btnExportCSV'),
    fileImportJSON: document.getElementById('fileImportJSON'),
    btnImportJSONTrigger: document.getElementById('btnImportJSONTrigger'),
    btnClearAll: document.getElementById('btnClearAll'),

    // View Toggle
    viewToggleBtn: document.getElementById('viewToggleBtn')
};

/**
 * Memformat angka ke mata uang Rupiah dengan locale Indonesia.
 * Menangani nilai negatif dengan awalan "-".
 * @param {number} amount - Nominal dalam IDR
 * @returns {string} String terformat, contoh: "Rp 150.000"
 */
function formatRupiah(amount) {
    const isNegative = amount < 0;
    const absVal = Math.abs(amount);
    const formatted = 'Rp ' + absVal.toLocaleString('id-ID');
    return isNegative ? `-${formatted}` : formatted;
}

/**
 * Inisialisasi utama aplikasi. Dipanggil setelah DOM siap.
 * Urutan: set tanggal default → isi dropdown kategori → render UI → init toggle → pasang listener
 */
function initApp() {
    const today = new Date().toISOString().split('T')[0];
    if (DOM.txDate) DOM.txDate.value = today;

    updateCategoryDropdown();
    updateUI();

    // Real-time update dari Firestore
    window.keuanganStore.onUpdate(updateUI);

    initViewToggle();
    setupEventListeners();
}

/**
 * Memperbarui opsi dropdown kategori berdasarkan tipe transaksi
 * yang dipilih (pemasukan → kategori pemasukan, pengeluaran → kategori pengeluaran).
 */
function updateCategoryDropdown() {
    if (!DOM.txCategory || !DOM.txType) return;
    
    const type = DOM.txType.value;
    const categories = window.CATEGORIES[type];
    
    DOM.txCategory.innerHTML = '';
    
    Object.keys(categories).forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = categories[key].label;
        DOM.txCategory.appendChild(option);
    });
}

/**
 * Memperbarui seluruh antarmuka: ringkasan saldo, target harian,
 * daftar riwayat, dan grafik. Dipanggil setiap kali data berubah.
 */
function updateUI() {
    const store = window.keuanganStore;
    const summary = store.getSummary(currentFilter);
    const settings = store.getSettings();

    // Nama Driver
    const driverDisplay = document.getElementById('driverDisplayName');
    if (driverDisplay) {
        driverDisplay.textContent = settings.driverName || 'Driver Grabike';
    }

    // Render Uang Bersih & Ringkasan
    if (DOM.netProfit) {
        DOM.netProfit.textContent = formatRupiah(summary.netProfit);
        DOM.netProfit.className = summary.netProfit < 0 ? 'balance-value negative' : 'balance-value positive';
    }
    if (DOM.totalIncome) DOM.totalIncome.textContent = formatRupiah(summary.totalIncome);
    if (DOM.totalExpense) DOM.totalExpense.textContent = formatRupiah(summary.totalExpense);
    
    // Rincian Modal & Pengeluaran
    if (DOM.capitalBensin) DOM.capitalBensin.textContent = formatRupiah(summary.capitalBensin);
    if (DOM.capitalKredit) DOM.capitalKredit.textContent = formatRupiah(summary.capitalKredit);
    if (DOM.operationalCost) DOM.operationalCost.textContent = formatRupiah(summary.operationalCost);

    // Target Harian Tracker
    if (DOM.todayIncome) DOM.todayIncome.textContent = formatRupiah(summary.todayIncome);
    if (DOM.dailyTargetText) DOM.dailyTargetText.textContent = formatRupiah(settings.dailyTarget);
    if (DOM.targetPercent) DOM.targetPercent.textContent = `${Math.round(summary.rawTargetProgress)}%`;
    
    if (DOM.targetBar) {
        DOM.targetBar.style.width = `${summary.targetProgress}%`;
        if (summary.rawTargetProgress >= 100) {
            DOM.targetBar.style.backgroundColor = '#00ff66';
            DOM.targetBar.style.boxShadow = '0 0 10px #00ff66';
            if (DOM.targetStatusMsg) DOM.targetStatusMsg.textContent = 'Mantap! Target Harian Tercapai! 🎉';
        } else {
            DOM.targetBar.style.backgroundColor = '#00B14F';
            DOM.targetBar.style.boxShadow = 'none';
            const sisa = settings.dailyTarget - summary.todayIncome;
            if (DOM.targetStatusMsg) DOM.targetStatusMsg.textContent = `Kurang ${formatRupiah(sisa)} lagi untuk capai target hari ini. Tetap semangat & utamakan keselamatan!`;
        }
    }

    renderTransactionList();

    if (window.keuanganChartManager) {
        window.keuanganChartManager.updateCharts();
    }
}

function renderTransactionList() {
    if (!DOM.historyList) return;

    const store = window.keuanganStore;
    const txs = store.getTransactions();
    const query = DOM.searchTx ? DOM.searchTx.value.toLowerCase() : '';

    DOM.historyList.innerHTML = '';

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    let filteredTxs = txs;

    if (currentFilter === 'today') {
        filteredTxs = txs.filter(tx => tx.date === todayStr);
    } else if (currentFilter === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        filteredTxs = txs.filter(tx => new Date(tx.date) >= oneWeekAgo);
    } else if (currentFilter === 'month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filteredTxs = txs.filter(tx => new Date(tx.date) >= startOfMonth);
    }

    if (query) {
        filteredTxs = filteredTxs.filter(tx => {
            const catLabel = window.CATEGORIES[tx.type][tx.category]?.label || tx.category;
            const note = tx.note || '';
            return catLabel.toLowerCase().includes(query) || note.toLowerCase().includes(query);
        });
    }

    if (filteredTxs.length === 0) {
        DOM.historyList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📂</div>
                <p>Belum ada transaksi pada periode ini.</p>
            </div>
        `;
        return;
    }

    filteredTxs.forEach(tx => {
        const catConfig = window.CATEGORIES[tx.type][tx.category] || { label: tx.category, icon: 'help-circle', color: '#A0AEC0' };
        const item = document.createElement('div');
        item.className = `history-item ${tx.type}`;
        const iconSvg = getIconSvg(catConfig.icon);

        const dateObj = new Date(tx.date);
        const dateDisplay = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

        item.innerHTML = `
            <div class="item-icon-wrapper" style="background-color: rgba(${hexToRgb(catConfig.color)}, 0.15); color: ${catConfig.color}">
                ${iconSvg}
            </div>
            <div class="item-details">
                <span class="item-category">${catConfig.label}</span>
                <span class="item-meta">${dateDisplay} ${tx.note ? `• <i>${tx.note}</i>` : ''}</span>
            </div>
            <div class="item-right">
                <span class="item-amount ${tx.type === 'pemasukan' ? 'positive' : 'negative'}">
                    ${tx.type === 'pemasukan' ? '+' : '-'}${formatRupiah(tx.amount)}
                </span>
                <button class="delete-btn" data-id="${tx.id}" title="Hapus transaksi">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trash-2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
            </div>
        `;

        const delBtn = item.querySelector('.delete-btn');
        delBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Apakah Anda yakin ingin menghapus transaksi ini?')) {
                await store.deleteTransaction(tx.id);
            }
        });

        DOM.historyList.appendChild(item);
    });
}

function getIconSvg(iconName) {
    const svgs = {
        'motorcycle': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-motorcycle"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="18" r="3"/><path d="M9 18h6"/><path d="M12 10h3l1-4h3"/><path d="m14 10 2-4h-4"/><path d="M8.5 12.5 11 18"/><path d="m16.5 12.5-3 5.5"/><path d="M7 10h1l1.5 2.5"/></svg>`,
        'fuel': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-fuel"><line x1="3" x2="15" y1="22" y2="22"/><line x1="4" x2="14" y1="2" y2="2"/><path d="M12 22V8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14"/><path d="M16.5 13a2.5 2.5 0 0 1 2.5-2.5h1a2 2 0 0 1 2 2v3.83a2.5 2.5 0 0 1-.73 1.77L18 21.3"/><path d="M6 10h4"/><circle cx="18" cy="8" r="1"/></svg>`,
        'wallet': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wallet"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>`,
        'utensils': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-utensils"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`,
        'wrench': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wrench"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`,
        'help-circle': `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-help-circle"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`
    };
    return svgs[iconName] || svgs['help-circle'];
}

function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

function setupEventListeners() {
    if (DOM.txType) {
        DOM.txType.addEventListener('change', () => {
            updateCategoryDropdown();
            if (DOM.submitBtnText) {
                DOM.submitBtnText.textContent = DOM.txType.value === 'pemasukan' ? 'Catat Pendapatan Bersih' : 'Catat Pengeluaran / Modal';
            }
        });
    }

    if (DOM.txForm) {
        DOM.txForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const amount = parseFloat(DOM.txAmount.value);
            if (isNaN(amount) || amount <= 0) {
                alert('Silakan masukkan nominal yang valid.');
                return;
            }

            const type = DOM.txType.value;
            const category = DOM.txCategory.value;
            const date = DOM.txDate.value;
            const note = DOM.txNote.value.trim();

            await window.keuanganStore.addTransaction({
                type,
                category,
                amount,
                date,
                note
            });

            DOM.txAmount.value = '';
            DOM.txNote.value = '';
        });
    }

    // Quick Log Action
    document.querySelectorAll('.btn-quick-log').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const action = e.currentTarget.getAttribute('data-action');
            const today = new Date().toISOString().split('T')[0];
            const store = window.keuanganStore;

            if (action === 'bensin_30') {
                await store.addTransaction({
                    type: 'pengeluaran',
                    category: 'bensin',
                    amount: 30000,
                    date: today,
                    note: 'Bensin Pertalite (Modal Awal)'
                });
            } else if (action === 'bensin_20') {
                await store.addTransaction({
                    type: 'pengeluaran',
                    category: 'bensin',
                    amount: 20000,
                    date: today,
                    note: 'Bensin harian (Modal Awal)'
                });
            } else if (action === 'kredit_30') {
                await store.addTransaction({
                    type: 'pengeluaran',
                    category: 'kredit',
                    amount: 30000,
                    date: today,
                    note: 'Top-up Dompet Kredit (Modal Awal)'
                });
            } else if (action === 'kredit_50') {
                await store.addTransaction({
                    type: 'pengeluaran',
                    category: 'kredit',
                    amount: 50000,
                    date: today,
                    note: 'Top-up Dompet Kredit (Modal Awal)'
                });
            } else if (action === 'konsumsi_15') {
                await store.addTransaction({
                    type: 'pengeluaran',
                    category: 'konsumsi',
                    amount: 15000,
                    date: today,
                    note: 'Makan/Minum di jalan'
                });
            } else if (action === 'konsumsi_25') {
                await store.addTransaction({
                    type: 'pengeluaran',
                    category: 'konsumsi',
                    amount: 25000,
                    date: today,
                    note: 'Makan siang & rokok'
                });
            } else if (action === 'servis_75') {
                await store.addTransaction({
                    type: 'pengeluaran',
                    category: 'servis',
                    amount: 75000,
                    date: today,
                    note: 'Servis rutin / ganti oli'
                });
            } else if (action === 'narik_200') {
                await store.addTransaction({
                    type: 'pemasukan',
                    category: 'narik',
                    amount: 200000,
                    date: today,
                    note: 'Pendapatan Bersih Grab Hari Ini'
                });
            }
        });
    });

    DOM.filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            DOM.filterBtns.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.getAttribute('data-filter');
            updateUI();
        });
    });

    if (DOM.searchTx) {
        DOM.searchTx.addEventListener('input', () => {
            renderTransactionList();
        });
    }

    // Modal Events
    document.querySelectorAll('.open-settings-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const settings = window.keuanganStore.getSettings();
            if (DOM.cfgDriverName) DOM.cfgDriverName.value = settings.driverName;
            if (DOM.cfgDailyTarget) DOM.cfgDailyTarget.value = settings.dailyTarget;
            DOM.settingsModal.classList.add('active');
        });
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.settingsModal.classList.remove('active');
            DOM.backupModal.classList.remove('active');
        });
    });

    if (DOM.settingsForm) {
        DOM.settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const driverName = DOM.cfgDriverName.value.trim() || 'Driver Grabike Batam';
            const dailyTarget = parseFloat(DOM.cfgDailyTarget.value) || 150000;

            await window.keuanganStore.updateSettings({
                driverName,
                dailyTarget
            });

            DOM.settingsModal.classList.remove('active');
        });
    }

    document.querySelectorAll('.open-backup-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            DOM.backupModal.classList.add('active');
        });
    });

    if (DOM.btnExportJSON) {
        DOM.btnExportJSON.addEventListener('click', () => {
            const dataStr = window.keuanganStore.exportToJSON();
            const dateStr = new Date().toISOString().split('T')[0];
            downloadFile(dataStr, `backup_keuangan_grabike_${dateStr}.json`, 'application/json');
        });
    }

    if (DOM.btnExportCSV) {
        DOM.btnExportCSV.addEventListener('click', () => {
            const csvStr = window.keuanganStore.exportToCSV();
            const dateStr = new Date().toISOString().split('T')[0];
            downloadFile(csvStr, `laporan_keuangan_grabike_${dateStr}.csv`, 'text/csv;charset=utf-8;');
        });
    }

    if (DOM.btnImportJSONTrigger && DOM.fileImportJSON) {
        DOM.btnImportJSONTrigger.addEventListener('click', () => {
            DOM.fileImportJSON.click();
        });
        
        DOM.fileImportJSON.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (evt) => {
                const content = evt.target.result;
                const success = await window.keuanganStore.importFromJSON(content);
                if (success) {
                    alert('Data keuangan berhasil dipulihkan!');
                    DOM.backupModal.classList.remove('active');
                } else {
                    alert('Gagal mengimpor file! Pastikan file backup valid.');
                }
            };
            reader.readAsText(file);
        });
    }

    if (DOM.btnClearAll) {
        DOM.btnClearAll.addEventListener('click', async () => {
            if (confirm('PERHATIAN! Hapus semua data keuangan secara permanen?') && confirm('Apakah Anda yakin?')) {
                await window.keuanganStore.clearAllData();
                DOM.backupModal.classList.remove('active');
            }
        });
    }

    if (DOM.viewToggleBtn) {
        DOM.viewToggleBtn.addEventListener('click', () => {
            const hasDesktop = document.body.classList.contains('view-desktop');
            const hasMobile = document.body.classList.contains('view-mobile');

            if (hasDesktop) {
                document.body.classList.remove('view-desktop');
                setViewMode('default');
            } else if (hasMobile) {
                document.body.classList.remove('view-mobile');
                setViewMode('default');
            } else {
                if (window.innerWidth <= 600) {
                    document.body.classList.add('view-desktop');
                    setViewMode('desktop');
                } else {
                    document.body.classList.add('view-mobile');
                    setViewMode('mobile');
                }
            }
        });
    }
}

function initViewToggle() {
    const saved = localStorage.getItem('grabike_view_mode');
    if (saved === 'mobile') {
        document.body.classList.add('view-mobile');
        setViewMode('mobile');
    } else if (saved === 'desktop') {
        document.body.classList.add('view-desktop');
        setViewMode('desktop');
    }
}

function setViewMode(mode) {
    const btn = DOM.viewToggleBtn;
    if (!btn) return;
    const icon = btn.querySelector('svg');
    const text = btn.querySelector('span');

    const monitorSvg = '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
    const phoneSvg = '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>';

    if (mode === 'mobile') {
        btn.classList.add('active-view');
        btn.title = 'Kembali ke Tampilan Desktop';
        if (icon) icon.innerHTML = monitorSvg;
        if (text) text.textContent = 'Desktop';
        localStorage.setItem('grabike_view_mode', 'mobile');
    } else if (mode === 'desktop') {
        btn.classList.add('active-view');
        btn.title = 'Kembali ke Tampilan Mobile';
        if (icon) icon.innerHTML = phoneSvg;
        if (text) text.textContent = 'Mobile';
        localStorage.setItem('grabike_view_mode', 'desktop');
    } else {
        btn.classList.remove('active-view');
        if (window.innerWidth <= 600) {
            btn.title = 'Tampilan Desktop';
            if (icon) icon.innerHTML = monitorSvg;
            if (text) text.textContent = 'Desktop';
        } else {
            btn.title = 'Pratinjau Tampilan Mobile';
            if (icon) icon.innerHTML = phoneSvg;
            if (text) text.textContent = 'Mobile';
        }
        localStorage.removeItem('grabike_view_mode');
    }
}

function downloadFile(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}
