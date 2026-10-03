/**
 * wealth/js/core/export.js
 * Clean CSV Exporter for Wealth Tracker
 */

export function exportPortfolioToCSV(accounts, usdRate = 4.08, filename = "wealth_portfolio.csv") {
    if (!accounts || !accounts.length) {
        alert("No portfolio data to export");
        return;
    }

    const headers = [
        "Platform",
        "Product",
        "Category",
        "Currency",
        "Original Amount",
        "Amount (MYR)",
        "APR (%)",
        "Annual Estimated Return (MYR)",
        "Notes"
    ];

    const rows = accounts.map(a => {
        const rate = a.currency === 'USD' ? usdRate : 1.0;
        const myr = (Number(a.amount) || 0) * rate;
        const aprAmt = (myr * (Number(a.apr) || 0)) / 100;

        return [
            `"${(a.platform || '').replace(/"/g, '""')}"`,
            `"${(a.product || '').replace(/"/g, '""')}"`,
            `"${(a.category || '').replace(/"/g, '""')}"`,
            `"${a.currency || 'MYR'}"`,
            (Number(a.amount) || 0).toFixed(2),
            myr.toFixed(2),
            (Number(a.apr) || 0).toFixed(2),
            aprAmt.toFixed(2),
            `"${(a.notes || '').replace(/"/g, '""')}"`
        ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
