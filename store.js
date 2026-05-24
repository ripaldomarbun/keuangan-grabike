/**
 * @typedef {Object} Transaction
 * @property {number} id - Unique identifier (timestamp-based)
 * @property {'pemasukan'|'pengeluaran'} type - Transaction type
 * @property {string} category - Category key (narik, bensin, kredit, etc.)
 * @property {number} amount - Transaction amount in IDR
 * @property {string} date - ISO date string (YYYY-MM-DD)
 * @property {string} note - Optional note
 */

/**
 * @typedef {Object} DailySummary
 * @property {number} totalIncome - Total income for filtered period
 * @property {number} totalExpense - Total expense for filtered period
 * @property {number} netProfit - Income minus expense (take home pay)
 * @property {number} capitalBensin - Total bensin expense
 * @property {number} capitalKredit - Total kredit top-up
 * @property {number} operationalCost - Other operational costs (food, service, etc.)
 * @property {number} todayIncome - Today's total income
 * @property {number} targetProgress - Progress toward target (0-100, capped)
 * @property {number} rawTargetProgress - Un-capped progress percentage
 * @property {number} dailyTarget - Configured daily target in IDR
 */

/**
 * @typedef {Object} AppSettings
 * @property {number} dailyTarget - Target pendapatan bersih harian (default: 150000)
 * @property {string} driverName - Nama pengemudi untuk tampilan header
 */

/**
 * @typedef {Object} CategoryConfig
 * @property {string} label - Nama kategori yang ditampilkan di UI
 * @property {string} icon - Nama ikon Lucide untuk rendering SVG
 * @property {string} color - Warna hex untuk aksen kategori
 */

const STORAGE_KEYS = {
    TRANSACTIONS: 'grabike_keuangan_transactions_simple',
    SETTINGS: 'grabike_keuangan_settings_simple'
};

const DEFAULT_SETTINGS = {
    dailyTarget: 150000, // Target pendapatan bersih harian Rp 150.000
    driverName: 'Driver Grabike Batam'
};

// Kategori yang disederhanakan sesuai permintaan driver
const CATEGORIES = {
    pemasukan: {
        narik: { label: 'Pendapatan Bersih Grab', icon: 'motorcycle', color: '#00B14F' }
    },
    pengeluaran: {
        bensin: { label: 'Bensin (Modal Awal)', icon: 'fuel', color: '#FF4D4D' },
        kredit: { label: 'Top-up Dompet Kredit', icon: 'wallet', color: '#00E0FF' },
        konsumsi: { label: 'Makan, Minum, Rokok', icon: 'utensils', color: '#FF9F43' },
        servis: { label: 'Perawatan Motor (Servis/Oli)', icon: 'wrench', color: '#9B5DE5' },
        lainnya: { label: 'Lain-lain (Parkir, dll)', icon: 'help-circle', color: '#A0AEC0' }
    }
};

/**
 * Manajemen state pusat dengan persistensi localStorage.
 * Menangani seluruh siklus data: create, read, delete, kalkulasi ringkasan,
 * export/import, dan inisialisasi data mock untuk pengguna baru.
 */
class KeuanganStore {
    constructor() {
        const storedTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
        if (storedTxs === null) {
            this.transactions = this.generateMockTransactions();
            this.saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);
        } else {
            this.transactions = JSON.parse(storedTxs);
        }
        
        this.settings = this.loadFromStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
        this.settings = { ...DEFAULT_SETTINGS, ...this.settings };
    }

    loadFromStorage(key, defaultValue) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : defaultValue;
        } catch (e) {
            console.error('Gagal memuat data:', e);
            return defaultValue;
        }
    }

    saveToStorage(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
        } catch (e) {
            console.error('Gagal menyimpan data:', e);
        }
    }

    // ──────────────────────────────────────────────
    //  TRANSACTIONS
    // ──────────────────────────────────────────────

    /**
     * Mengembalikan salinan seluruh transaksi, terurut berdasarkan
     * tanggal (terbaru duluan) dan ID (terbaru duluan).
     * @returns {Transaction[]} Salinan array transaksi
     */
    getTransactions() {
        return [...this.transactions].sort((a, b) => {
            const dateDiff = new Date(b.date) - new Date(a.date);
            if (dateDiff !== 0) return dateDiff;
            return b.id - a.id;
        });
    }

    /**
     * Menambahkan transaksi baru ke dalam store dan menyimpannya.
     * @param {Omit<Transaction, 'id'>} tx - Data transaksi tanpa ID
     * @returns {Transaction} Transaksi yang baru dibuat (dengan ID)
     */
    addTransaction(tx) {
        const newTx = {
            id: tx.id || Date.now(),
            type: tx.type, // 'pemasukan' | 'pengeluaran'
            category: tx.category, // 'narik' | 'bensin' | 'kredit' | 'konsumsi' | 'servis' | 'lainnya'
            amount: Number(tx.amount),
            date: tx.date || new Date().toISOString().split('T')[0],
            note: tx.note || ''
        };

        this.transactions.push(newTx);
        this.saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);
        return newTx;
    }

    /**
     * Menghapus satu transaksi berdasarkan ID.
     * @param {number} id - ID transaksi yang akan dihapus
     */
    deleteTransaction(id) {
        this.transactions = this.transactions.filter(tx => tx.id !== Number(id));
        this.saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);
    }

    /**
     * Menghapus seluruh data transaksi dan mengatur ulang pengaturan
     * ke nilai default. Operasi ireversibel — konfirmasi pengguna wajib.
     */
    clearAllData() {
        this.transactions = [];
        this.settings = { ...DEFAULT_SETTINGS };
        this.saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);
        this.saveToStorage(STORAGE_KEYS.SETTINGS, this.settings);
    }

    // ──────────────────────────────────────────────
    //  SETTINGS
    // ──────────────────────────────────────────────

    /**
     * Mengembalikan objek pengaturan saat ini (driver name, daily target).
     * @returns {AppSettings}
     */
    getSettings() {
        return this.settings;
    }

    /**
     * Memperbarui satu atau lebih properti pengaturan.
     * Menggabungkan (merge) dengan pengaturan yang sudah ada.
     * @param {Partial<AppSettings>} newSettings - Properti yang akan diperbarui
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveToStorage(STORAGE_KEYS.SETTINGS, this.settings);
    }

    // ──────────────────────────────────────────────
    //  CALCULATIONS
    // ──────────────────────────────────────────────

    /**
     * Menghitung ringkasan keuangan berdasarkan filter periode.
     *
     * @param {'all'|'today'|'week'|'month'} dateFilter - Periode filter
     * @returns {DailySummary} Ringkasan pendapatan, pengeluaran, modal, progress target
     */
    getSummary(dateFilter = 'all') {
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();
        
        let filteredTxs = this.transactions;
        if (dateFilter === 'today') {
            filteredTxs = this.transactions.filter(tx => tx.date === todayStr);
        } else if (dateFilter === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            filteredTxs = this.transactions.filter(tx => new Date(tx.date) >= oneWeekAgo);
        } else if (dateFilter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            filteredTxs = this.transactions.filter(tx => new Date(tx.date) >= startOfMonth);
        }

        let totalIncome = 0;
        let totalExpense = 0;
        let capitalBensin = 0;
        let capitalKredit = 0;
        let operationalCost = 0;

        filteredTxs.forEach(tx => {
            const amount = Number(tx.amount);
            if (tx.type === 'pemasukan') {
                totalIncome += amount;
            } else {
                totalExpense += amount;
                if (tx.category === 'bensin') capitalBensin += amount;
                else if (tx.category === 'kredit') capitalKredit += amount;
                else operationalCost += amount;
            }
        });

        // Hitung pendapatan bersih narik hari ini
        const todayIncome = this.transactions
            .filter(tx => tx.date === todayStr && tx.type === 'pemasukan')
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const targetProgress = (todayIncome / this.settings.dailyTarget) * 100;

        return {
            totalIncome, // Total Pendapatan Bersih Grab
            totalExpense, // Total Modal & Pengeluaran
            netProfit: totalIncome - totalExpense, // Uang Bersih Dibawa Pulang (Take Home Pay)
            capitalBensin,
            capitalKredit,
            operationalCost,
            todayIncome,
            targetProgress: Math.min(targetProgress, 100),
            rawTargetProgress: targetProgress,
            dailyTarget: this.settings.dailyTarget
        };
    }

    // --- MOCK DATA ---
    generateMockTransactions() {
        const mockTxs = [];
        const today = new Date();
        
        const getOffsetDate = (daysAgo) => {
            const d = new Date();
            d.setDate(today.getDate() - daysAgo);
            return d.toISOString().split('T')[0];
        };

        // HARI INI
        mockTxs.push({
            id: Date.now() - 1000,
            type: 'pemasukan',
            category: 'narik',
            amount: 200000,
            date: getOffsetDate(0),
            note: 'Narik bersih seharian'
        });
        mockTxs.push({
            id: Date.now() - 2000,
            type: 'pengeluaran',
            category: 'bensin',
            amount: 30000,
            date: getOffsetDate(0),
            note: 'Modal Pertalite sebelum on-bit'
        });
        mockTxs.push({
            id: Date.now() - 3000,
            type: 'pengeluaran',
            category: 'kredit',
            amount: 30000,
            date: getOffsetDate(0),
            note: 'Top-up Dompet Kredit di Alfamart'
        });
        mockTxs.push({
            id: Date.now() - 4000,
            type: 'pengeluaran',
            category: 'konsumsi',
            amount: 25000,
            date: getOffsetDate(0),
            note: 'Makan nasi Padang + rokok + kopi'
        });

        // KEMARIN
        mockTxs.push({
            id: Date.now() - 10000,
            type: 'pemasukan',
            category: 'narik',
            amount: 180000,
            date: getOffsetDate(1),
            note: 'Narik santai weekend'
        });
        mockTxs.push({
            id: Date.now() - 11000,
            type: 'pengeluaran',
            category: 'bensin',
            amount: 25000,
            date: getOffsetDate(1),
            note: 'Bensin'
        });
        mockTxs.push({
            id: Date.now() - 12000,
            type: 'pengeluaran',
            category: 'konsumsi',
            amount: 15000,
            date: getOffsetDate(1),
            note: 'Makan siang & es teh'
        });

        // 2 HARI LALU
        mockTxs.push({
            id: Date.now() - 20000,
            type: 'pemasukan',
            category: 'narik',
            amount: 220000,
            date: getOffsetDate(2),
            note: 'Orderan ramai'
        });
        mockTxs.push({
            id: Date.now() - 21000,
            type: 'pengeluaran',
            category: 'bensin',
            amount: 30000,
            date: getOffsetDate(2),
            note: 'Modal bensin'
        });
        mockTxs.push({
            id: Date.now() - 22000,
            type: 'pengeluaran',
            category: 'servis',
            amount: 75000,
            date: getOffsetDate(2),
            note: 'Ganti oli mesin & oli gardan'
        });

        // 3 HARI LALU
        mockTxs.push({
            id: Date.now() - 30000,
            type: 'pemasukan',
            category: 'narik',
            amount: 150000,
            date: getOffsetDate(3),
            note: 'Narik sampai sore'
        });
        mockTxs.push({
            id: Date.now() - 31000,
            type: 'pengeluaran',
            category: 'bensin',
            amount: 20000,
            date: getOffsetDate(3),
            note: 'Pertalite'
        });
        mockTxs.push({
            id: Date.now() - 32000,
            type: 'pengeluaran',
            category: 'konsumsi',
            amount: 20000,
            date: getOffsetDate(3),
            note: 'Makan soto banjar'
        });

        // 4 HARI LALU
        mockTxs.push({
            id: Date.now() - 40000,
            type: 'pemasukan',
            category: 'narik',
            amount: 190000,
            date: getOffsetDate(4),
            note: 'Narik lancar'
        });
        mockTxs.push({
            id: Date.now() - 41000,
            type: 'pengeluaran',
            category: 'bensin',
            amount: 30000,
            date: getOffsetDate(4),
            note: 'Bensin harian'
        });

        // 5 HARI LALU
        mockTxs.push({
            id: Date.now() - 50000,
            type: 'pemasukan',
            category: 'narik',
            amount: 160000,
            date: getOffsetDate(5),
            note: 'Hari biasa'
        });
        mockTxs.push({
            id: Date.now() - 51000,
            type: 'pengeluaran',
            category: 'bensin',
            amount: 20000,
            date: getOffsetDate(5),
            note: 'Bensin'
        });
        mockTxs.push({
            id: Date.now() - 52000,
            type: 'pengeluaran',
            category: 'lainnya',
            amount: 5000,
            date: getOffsetDate(5),
            note: 'Bayar parkir'
        });

        return mockTxs;
    }

    // ──────────────────────────────────────────────
    //  BACKUP & EXPORT
    // ──────────────────────────────────────────────

    /**
     * Mengekspor seluruh data (transaksi + pengaturan) ke JSON string.
     * Digunakan untuk fitur backup/download.
     * @returns {string} JSON string siap diunduh
     */
    exportToJSON() {
        const dataStr = JSON.stringify({
            transactions: this.transactions,
            settings: this.settings,
            exportVersion: '2.0-simple',
            exportedAt: new Date().toISOString()
        }, null, 2);
        return dataStr;
    }

    /**
     * Mengimpor data dari JSON string backup. Memvalidasi struktur
     * sebelum menimpa data yang ada.
     * @param {string} jsonString - Konten file backup JSON
     * @returns {boolean} true jika berhasil, false jika format tidak valid
     */
    importFromJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (parsed && Array.isArray(parsed.transactions)) {
                this.transactions = parsed.transactions;
                if (parsed.settings) {
                    this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
                }
                this.saveToStorage(STORAGE_KEYS.TRANSACTIONS, this.transactions);
                this.saveToStorage(STORAGE_KEYS.SETTINGS, this.settings);
                return true;
            }
            return false;
        } catch (e) {
            console.error('Error parse JSON backup:', e);
            return false;
        }
    }

    exportToCSV() {
        const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Catatan'];
        const csvRows = [headers.join(',')];
        const sortedTxs = [...this.transactions].sort((a, b) => b.id - a.id);

        for (const tx of sortedTxs) {
            const row = [
                tx.id,
                tx.date,
                tx.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
                CATEGORIES[tx.type][tx.category]?.label || tx.category,
                tx.amount,
                `"${(tx.note || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        }

        return csvRows.join('\n');
    }
}

window.keuanganStore = new KeuanganStore();
window.CATEGORIES = CATEGORIES;
