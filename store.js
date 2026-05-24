/**
 * @fileoverview State management dengan Firestore sebagai backend.
 * Data tersimpan di cloud dan otomatis sync antar perangkat.
 * Menggunakan cache lokal agar read synchronous, write asynchronous.
 *
 * Collections:
 *   transactions/{docId}  → { type, category, amount, date, note, createdAt }
 *   settings/app          → { driverName, dailyTarget, updatedAt }
 *
 * @author Driver Grabike Batam
 * @version 3.0.0-firestore
 */

/** Konfigurasi Firebase — dari project my01-935dd */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBCwkwIeC7Q4BYLbThA043WwPUJVbxOUzU",
  authDomain: "my01-935dd.firebaseapp.com",
  projectId: "my01-935dd",
  storageBucket: "my01-935dd.firebasestorage.app",
  messagingSenderId: "125776491155",
  appId: "1:125776491155:web:a0189067da1d7c8d82d366",
  measurementId: "G-2PG28NL0R6"
};

const DEFAULT_SETTINGS = {
    dailyTarget: 150000,
    driverName: 'Driver Grabike Batam'
};

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
 * @typedef {Object} Transaction
 * @property {string} id - Firestore document ID
 * @property {'pemasukan'|'pengeluaran'} type
 * @property {string} category
 * @property {number} amount
 * @property {string} date - YYYY-MM-DD
 * @property {string} note
 */

/**
 * @typedef {Object} DailySummary
 * @property {number} totalIncome
 * @property {number} totalExpense
 * @property {number} netProfit
 * @property {number} capitalBensin
 * @property {number} capitalKredit
 * @property {number} operationalCost
 * @property {number} todayIncome
 * @property {number} targetProgress
 * @property {number} rawTargetProgress
 * @property {number} dailyTarget
 */

/**
 * @typedef {Object} AppSettings
 * @property {number} dailyTarget
 * @property {string} driverName
 */

/**
 * Manajemen state dengan Firestore. Data di-cache lokal untuk akses
 * synchronous. Real-time listener (onSnapshot) memperbarui cache
 * saat ada perubahan dari perangkat lain.
 */
class KeuanganStore {
    constructor() {
        /** @type {Transaction[]} */
        this.transactions = [];
        /** @type {AppSettings} */
        this.settings = { ...DEFAULT_SETTINGS };
        this._allTxs = [];
        this._ready = false;
        this._seeded = false;
        this._onUpdate = null;

        firebase.initializeApp(FIREBASE_CONFIG);
        this.db = firebase.firestore();

        this._initSettings();
        this._initTransactions();
    }

    /**
     * Mendaftarkan callback yang dipanggil setiap kali data berubah.
     * @param {Function} fn
     */
    onUpdate(fn) {
        this._onUpdate = fn;
    }

    _notify() {
        this._ready = true;
        if (this._onUpdate) this._onUpdate();
    }

    // ──────────────────────────────────────────────
    //  SETTINGS — load sekali, update via setDoc
    // ──────────────────────────────────────────────

    _initSettings() {
        this.db.doc('settings/app').get().then(doc => {
            if (doc.exists) {
                this.settings = { ...DEFAULT_SETTINGS, ...doc.data() };
            } else {
                this.db.doc('settings/app').set(DEFAULT_SETTINGS);
            }
            this._notify();
        });
    }

    // ──────────────────────────────────────────────
    //  TRANSACTIONS — real-time listener
    // ──────────────────────────────────────────────

    _initTransactions() {
        this.db.collection('transactions')
            .orderBy('date', 'desc')
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                if (snapshot.empty && !this._seeded) {
                    this._seeded = true;
                    this._seedMockData();
                    return;
                }

                this._allTxs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                this.transactions = [...this._allTxs];
                this._notify();
            });
    }

    _seedMockData() {
        const today = new Date();
        const getDate = (daysAgo) => {
            const d = new Date();
            d.setDate(today.getDate() - daysAgo);
            return d.toISOString().split('T')[0];
        };

        const txs = [
            { type: 'pemasukan', category: 'narik', amount: 200000, date: getDate(0), note: 'Narik bersih seharian' },
            { type: 'pengeluaran', category: 'bensin', amount: 30000, date: getDate(0), note: 'Modal Pertalite sebelum on-bit' },
            { type: 'pengeluaran', category: 'kredit', amount: 30000, date: getDate(0), note: 'Top-up Dompet Kredit di Alfamart' },
            { type: 'pengeluaran', category: 'konsumsi', amount: 25000, date: getDate(0), note: 'Makan nasi Padang + rokok + kopi' },
            { type: 'pemasukan', category: 'narik', amount: 180000, date: getDate(1), note: 'Narik santai weekend' },
            { type: 'pengeluaran', category: 'bensin', amount: 25000, date: getDate(1), note: 'Bensin' },
            { type: 'pengeluaran', category: 'konsumsi', amount: 15000, date: getDate(1), note: 'Makan siang & es teh' },
            { type: 'pemasukan', category: 'narik', amount: 220000, date: getDate(2), note: 'Orderan ramai' },
            { type: 'pengeluaran', category: 'bensin', amount: 30000, date: getDate(2), note: 'Modal bensin' },
            { type: 'pengeluaran', category: 'servis', amount: 75000, date: getDate(2), note: 'Ganti oli mesin & oli gardan' },
            { type: 'pemasukan', category: 'narik', amount: 150000, date: getDate(3), note: 'Narik sampai sore' },
            { type: 'pengeluaran', category: 'bensin', amount: 20000, date: getDate(3), note: 'Pertalite' },
            { type: 'pengeluaran', category: 'konsumsi', amount: 20000, date: getDate(3), note: 'Makan soto banjar' },
            { type: 'pemasukan', category: 'narik', amount: 190000, date: getDate(4), note: 'Narik lancar' },
            { type: 'pengeluaran', category: 'bensin', amount: 30000, date: getDate(4), note: 'Bensin harian' },
            { type: 'pemasukan', category: 'narik', amount: 160000, date: getDate(5), note: 'Hari biasa' },
            { type: 'pengeluaran', category: 'bensin', amount: 20000, date: getDate(5), note: 'Bensin' },
            { type: 'pengeluaran', category: 'lainnya', amount: 5000, date: getDate(5), note: 'Bayar parkir' },
        ];

        const batch = this.db.batch();
        txs.forEach(tx => {
            const ref = this.db.collection('transactions').doc();
            batch.set(ref, { ...tx, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        });
        batch.commit();
    }

    // ──────────────────────────────────────────────
    //  READ — synchronous dari cache
    // ──────────────────────────────────────────────

    /**
     * @returns {Transaction[]}
     */
    getTransactions() {
        return [...this.transactions];
    }

    /**
     * @returns {AppSettings}
     */
    getSettings() {
        return this.settings;
    }

    // ──────────────────────────────────────────────
    //  WRITE — async ke Firestore
    // ──────────────────────────────────────────────

    /**
     * @param {Omit<Transaction, 'id'>} tx
     */
    async addTransaction(tx) {
        await this.db.collection('transactions').add({
            type: tx.type,
            category: tx.category,
            amount: Number(tx.amount),
            date: tx.date || new Date().toISOString().split('T')[0],
            note: tx.note || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    /**
     * @param {string} id
     */
    async deleteTransaction(id) {
        await this.db.collection('transactions').doc(id).delete();
    }

    /**
     * @param {Partial<AppSettings>} s
     */
    async updateSettings(s) {
        await this.db.doc('settings/app').set(s, { merge: true });
    }

    async clearAllData() {
        const batch = this.db.batch();
        const snapshot = await this.db.collection('transactions').get();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        await this.db.doc('settings/app').set(DEFAULT_SETTINGS);
    }

    // ──────────────────────────────────────────────
    //  CALCULATIONS
    // ──────────────────────────────────────────────

    /**
     * @param {'all'|'today'|'week'|'month'} dateFilter
     * @returns {DailySummary}
     */
    getSummary(dateFilter = 'all') {
        const todayStr = new Date().toISOString().split('T')[0];
        const now = new Date();

        let filteredTxs = this._allTxs;
        if (dateFilter === 'today') {
            filteredTxs = this._allTxs.filter(tx => tx.date === todayStr);
        } else if (dateFilter === 'week') {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(now.getDate() - 7);
            filteredTxs = this._allTxs.filter(tx => new Date(tx.date) >= oneWeekAgo);
        } else if (dateFilter === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            filteredTxs = this._allTxs.filter(tx => new Date(tx.date) >= startOfMonth);
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

        const todayIncome = this._allTxs
            .filter(tx => tx.date === todayStr && tx.type === 'pemasukan')
            .reduce((sum, tx) => sum + Number(tx.amount), 0);

        const targetProgress = (todayIncome / this.settings.dailyTarget) * 100;

        return {
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
            capitalBensin,
            capitalKredit,
            operationalCost,
            todayIncome,
            targetProgress: Math.min(targetProgress, 100),
            rawTargetProgress: targetProgress,
            dailyTarget: this.settings.dailyTarget
        };
    }

    // ──────────────────────────────────────────────
    //  BACKUP & EXPORT
    // ──────────────────────────────────────────────

    exportToJSON() {
        return JSON.stringify({
            transactions: this._allTxs,
            settings: this.settings,
            exportVersion: '3.0-firestore',
            exportedAt: new Date().toISOString()
        }, null, 2);
    }

    async importFromJSON(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);
            if (!parsed || !Array.isArray(parsed.transactions)) return false;

            // Hapus data lama
            const batch = this.db.batch();
            const snapshot = await this.db.collection('transactions').get();
            snapshot.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            // Import data baru
            const importBatch = this.db.batch();
            parsed.transactions.forEach(tx => {
                const ref = this.db.collection('transactions').doc();
                importBatch.set(ref, {
                    type: tx.type,
                    category: tx.category,
                    amount: Number(tx.amount),
                    date: tx.date,
                    note: tx.note || '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
            });
            await importBatch.commit();

            if (parsed.settings) {
                this.settings = { ...DEFAULT_SETTINGS, ...parsed.settings };
                await this.db.doc('settings/app').set(this.settings);
            }

            return true;
        } catch (e) {
            console.error('Import error:', e);
            return false;
        }
    }

    exportToCSV() {
        const headers = ['ID', 'Tanggal', 'Tipe', 'Kategori', 'Jumlah', 'Catatan'];
        const csvRows = [headers.join(',')];
        const sorted = [...this._allTxs].sort((a, b) => (b.date + b.id) > (a.date + a.id) ? 1 : -1);

        sorted.forEach(tx => {
            const row = [
                tx.id,
                tx.date,
                tx.type === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran',
                CATEGORIES[tx.type]?.[tx.category]?.label || tx.category,
                tx.amount,
                `"${(tx.note || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });

        return csvRows.join('\n');
    }
}

window.keuanganStore = new KeuanganStore();
window.CATEGORIES = CATEGORIES;
