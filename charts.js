/**
 * @fileoverview Visualisasi data keuangan menggunakan Chart.js.
 * Menyediakan dua grafik: line chart tren arus kas 7 hari dan
 * donut chart alokasi pengeluaran per kategori.
 *
 * Dependencies: Chart.js (CDN), store.js (window.keuanganStore)
 *
 * @author Driver Grabike Batam
 * @version 2.0.0-simple
 */

/**
 * Pengelola grafik Chart.js. Mengelola siklus hidup dua canvas:
 * - #trendChart: Line chart pendapatan vs pengeluaran 7 hari
 * - #expenseChart: Doughnut chart proporsi pengeluaran per kategori
 *
 * Setiap kali updateCharts() dipanggil, chart lama di-destroy
 * dan dibuat ulang dengan data terkini dari store.
 */
class KeuanganChartManager {
    constructor() {
        /** @type {Chart|null} */
        this.trendChart = null;
        /** @type {Chart|null} */
        this.expenseChart = null;
    }

    /**
     * Inisialisasi awal kedua grafik. Panggil sekali setelah DOM siap.
     */
    initCharts() {
        this.renderTrendChart();
        this.renderExpenseChart();
    }

    formatRupiah(value) {
        return 'Rp ' + Number(value).toLocaleString('id-ID');
    }

    getTrendData() {
        const txs = window.keuanganStore.getTransactions();
        const days = [];
        const incomeMap = {};
        const expenseMap = {};

        // Ambil data 7 hari terakhir
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const displayStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
            days.push({ key: dateStr, display: displayStr });
            incomeMap[dateStr] = 0;
            expenseMap[dateStr] = 0;
        }

        txs.forEach(tx => {
            if (incomeMap[tx.date] !== undefined) {
                if (tx.type === 'pemasukan') {
                    incomeMap[tx.date] += Number(tx.amount);
                } else {
                    expenseMap[tx.date] += Number(tx.amount);
                }
            }
        });

        return {
            labels: days.map(d => d.display),
            income: days.map(d => incomeMap[d.key]),
            expense: days.map(d => expenseMap[d.key])
        };
    }

    getExpenseCategoryData() {
        const txs = window.keuanganStore.getTransactions();
        const categoryTotals = {};
        const expenseCategories = window.CATEGORIES.pengeluaran;
        
        Object.keys(expenseCategories).forEach(cat => {
            categoryTotals[cat] = 0;
        });

        txs.forEach(tx => {
            if (tx.type === 'pengeluaran') {
                if (categoryTotals[tx.category] !== undefined) {
                    categoryTotals[tx.category] += Number(tx.amount);
                } else {
                    categoryTotals[tx.category] = Number(tx.amount);
                }
            }
        });

        const labels = [];
        const data = [];
        const backgroundColor = [];

        Object.keys(categoryTotals).forEach(cat => {
            const val = categoryTotals[cat];
            if (val > 0) {
                const config = expenseCategories[cat] || { label: cat, color: '#A0AEC0' };
                labels.push(config.label);
                data.push(val);
                backgroundColor.push(config.color);
            }
        });

        if (data.length === 0) {
            return {
                labels: ['Belum Ada Pengeluaran'],
                data: [1],
                backgroundColor: ['rgba(255, 255, 255, 0.07)'],
                isEmpty: true
            };
        }

        return {
            labels,
            data,
            backgroundColor,
            isEmpty: false
        };
    }

    renderTrendChart() {
        const ctx = document.getElementById('trendChart')?.getContext('2d');
        if (!ctx) return;

        if (this.trendChart) {
            this.trendChart.destroy();
        }

        const dataSrc = this.getTrendData();

        this.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dataSrc.labels,
                datasets: [
                    {
                        label: 'Pendapatan Bersih Grab',
                        data: dataSrc.income,
                        borderColor: '#00B14F',
                        backgroundColor: 'rgba(0, 177, 79, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#00B14F',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Modal & Pengeluaran',
                        data: dataSrc.expense,
                        borderColor: '#FF4D4D',
                        backgroundColor: 'rgba(255, 77, 77, 0.1)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#FF4D4D',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 1,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 12
                            },
                            usePointStyle: true,
                            boxWidth: 6
                        }
                    },
                    tooltip: {
                        backgroundColor: '#121e17',
                        titleColor: '#e2e8f0',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(0, 177, 79, 0.2)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (context) => {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += this.formatRupiah(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#a0aec0',
                            font: {
                                family: "'Inter', sans-serif",
                                size: 10
                            }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: '#a0aec0',
                            font: {
                                family: "'Inter', sans-serif",
                                size: 10
                            },
                            callback: (value) => {
                                if (value >= 1000000) {
                                    return 'Rp ' + (value / 1000000).toFixed(1) + 'jt';
                                } else if (value >= 1000) {
                                    return 'Rp ' + (value / 1000).toFixed(0) + 'rb';
                                }
                                return 'Rp ' + value;
                            }
                        }
                    }
                }
            }
        });
    }

    renderExpenseChart() {
        const ctx = document.getElementById('expenseChart')?.getContext('2d');
        if (!ctx) return;

        if (this.expenseChart) {
            this.expenseChart.destroy();
        }

        const dataSrc = this.getExpenseCategoryData();

        this.expenseChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: dataSrc.labels,
                datasets: [{
                    data: dataSrc.data,
                    backgroundColor: dataSrc.backgroundColor,
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                family: "'Outfit', sans-serif",
                                size: 11
                            },
                            usePointStyle: true,
                            boxWidth: 8,
                            padding: 10
                        }
                    },
                    tooltip: {
                        enabled: !dataSrc.isEmpty,
                        backgroundColor: '#121e17',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (context) => {
                                const value = context.raw;
                                return ' ' + context.label + ': ' + this.formatRupiah(value);
                            }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    }

    updateCharts() {
        this.renderTrendChart();
        this.renderExpenseChart();
    }
}

window.keuanganChartManager = new KeuanganChartManager();
