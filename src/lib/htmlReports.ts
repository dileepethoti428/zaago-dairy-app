import { format } from 'date-fns';
import type {
  DailyCollectionData,
  FarmerStatementData,
  SettlementSummaryData,
  CollectionReportPDFData,
} from './pdfUtils';

const escapeHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const money = (n: number) => `Rs.${(n || 0).toFixed(2)}`;

const baseStyles = `
  <style>
    .report { padding: 28px 28px 56px; font-size: 12px; line-height: 1.45; color: #111; }
    .report h1 { font-size: 20px; margin: 0 0 4px; text-align: center; font-weight: 700; }
    .report h2 { font-size: 14px; margin: 0 0 12px; text-align: center; font-weight: 600; color: #555; }
    .report h3 { font-size: 16px; margin: 0 0 14px; text-align: center; font-weight: 700; }
    .report .sep { border: 0; border-top: 1px solid #ddd; margin: 10px 0 16px; }
    .report .meta { margin: 0 0 12px; }
    .report .meta p { margin: 2px 0; }
    .report table { width: 100%; border-collapse: collapse; margin-top: 8px; table-layout: fixed; }
    .report th, .report td { padding: 6px 8px; font-size: 11px; word-wrap: break-word; }
    .report thead th { background: #4CAF50; color: #fff; text-align: left; font-weight: 700; }
    .report tbody tr:nth-child(even) td { background: #f5f7f5; }
    .report tfoot td { background: #eee; font-weight: 700; }
    .report .right { text-align: right; }
    .report .center { text-align: center; }
    .report .footer { margin-top: 28px; display: flex; justify-content: space-between; color: #888; font-size: 10px; font-style: italic; }
    .report .summary-box { border: 1px solid #4CAF50; background: #f0f8f0; border-radius: 6px; padding: 12px 14px; margin-top: 16px; display: flex; justify-content: space-between; align-items: center; }
    .report .status { display: inline-block; padding: 4px 10px; border-radius: 4px; color: #fff; font-weight: 700; font-size: 11px; }
    .report .status.paid { background: #4CAF50; }
    .report .status.pending { background: #FF9800; }
    .report .status.locked { background: #FF9800; }
    .report .status.open { background: #2196F3; }
  </style>
`;

const headerBlock = (appName: string, sub: string, reportType: string) => `
  <h1>${escapeHtml(appName)}</h1>
  ${sub ? `<h2>${escapeHtml(sub)}</h2>` : ''}
  <h3>${escapeHtml(reportType)}</h3>
  <hr class="sep" />
`;

const footerBlock = () => `
  <div class="footer">
    <span>Generated on: ${format(new Date(), 'dd MMM yyyy, HH:mm')}</span>
    <span>This is a system-generated document</span>
  </div>
`;

export function dailyCollectionHtml(data: DailyCollectionData): string {
  const totalQty = data.entries.reduce((s, e) => s + e.quantity, 0);
  const totalAmt = data.entries.reduce((s, e) => s + e.amount, 0);
  const avgFat = data.entries.length
    ? data.entries.reduce((s, e) => s + e.fat, 0) / data.entries.length
    : 0;
  const avgSnf = data.entries.length
    ? data.entries.reduce((s, e) => s + e.snf, 0) / data.entries.length
    : 0;

  const center =
    data.centerName && data.centerName !== 'All Centers' ? data.centerName : '';

  const rows = data.entries
    .map(
      (e, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${escapeHtml(e.farmerName)}</td>
        <td class="center">${escapeHtml(e.farmerId || '-')}</td>
        <td class="right">${e.quantity.toFixed(2)}</td>
        <td class="center">${e.fat.toFixed(1)}</td>
        <td class="center">${e.snf.toFixed(1)}</td>
        <td class="right">${money(e.rate)}</td>
        <td class="right">${money(e.amount)}</td>
      </tr>`
    )
    .join('');

  return `
    ${baseStyles}
    <div class="report">
      ${headerBlock('Milk Procurement System', center, 'Daily Collection Report')}
      <div class="meta">
        <p><strong>Date:</strong> ${format(new Date(data.date), 'dd MMMM yyyy')}</p>
        <p>Total Milk Collected: ${data.totalMilk.toFixed(2)} Litres</p>
        <p>Total Farmers: ${data.totalFarmers}</p>
      </div>
      <table>
        <colgroup>
          <col style="width:5%"><col style="width:24%"><col style="width:14%">
          <col style="width:10%"><col style="width:9%"><col style="width:9%">
          <col style="width:13%"><col style="width:16%">
        </colgroup>
        <thead>
          <tr>
            <th>#</th><th>Farmer Name</th><th>ID</th>
            <th class="right">Qty (L)</th><th class="center">Fat %</th><th class="center">SNF %</th>
            <th class="right">Rate</th><th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td></td><td>TOTAL</td><td></td>
            <td class="right">${totalQty.toFixed(2)}</td>
            <td class="center">${avgFat.toFixed(1)}</td>
            <td class="center">${avgSnf.toFixed(1)}</td>
            <td></td><td class="right">${money(totalAmt)}</td>
          </tr>
        </tfoot>
      </table>
      ${footerBlock()}
    </div>
  `;
}

export function farmerStatementHtml(data: FarmerStatementData): string {
  const rows = data.entries
    .map(
      (e, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td class="center">${format(new Date(e.date), 'dd/MM')}</td>
        <td class="right">${e.quantity.toFixed(2)}</td>
        <td class="center">${e.fat.toFixed(1)}</td>
        <td class="center">${e.snf.toFixed(1)}</td>
        <td class="right">${money(e.rate)}</td>
        <td class="right">${money(e.amount)}</td>
      </tr>`
    )
    .join('');

  const statusClass = data.paymentStatus === 'paid' ? 'paid' : 'pending';

  return `
    ${baseStyles}
    <div class="report">
      ${headerBlock('Milk Procurement System', 'Farmer Settlement Statement', '15-Day Statement')}
      <div class="meta">
        <p><strong>Farmer Details:</strong></p>
        <p>Name: ${escapeHtml(data.farmerName)}</p>
        <p>ID: ${escapeHtml(data.farmerId)}</p>
        <p>Village: ${escapeHtml(data.village || 'N/A')}</p>
        <p style="margin-top:8px"><strong>Settlement Period:</strong>
          ${format(new Date(data.startDate), 'dd MMM')} - ${format(new Date(data.endDate), 'dd MMM yyyy')}
        </p>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th class="center">Date</th>
            <th class="right">Qty (L)</th><th class="center">Fat %</th><th class="center">SNF %</th>
            <th class="right">Rate</th><th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td></td><td>TOTAL</td>
            <td class="right">${data.totalLitres.toFixed(2)}</td>
            <td></td><td></td><td></td>
            <td class="right">${money(data.totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
      <div class="summary-box">
        <div>
          <div style="font-weight:700; font-size:13px; margin-bottom:4px">Payment Summary</div>
          <div>Total Litres: ${data.totalLitres.toFixed(2)} L</div>
          <div>Total Payable: ${money(data.totalAmount)}</div>
        </div>
        <span class="status ${statusClass}">${data.paymentStatus.toUpperCase()}</span>
      </div>
      ${footerBlock()}
    </div>
  `;
}

export function settlementSummaryHtml(data: SettlementSummaryData): string {
  const rows = data.farmers
    .map(
      (f, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${escapeHtml(f.farmerName)}</td>
        <td class="right">${f.totalLitres.toFixed(2)}</td>
        <td class="right">${money(f.totalAmount)}</td>
        <td class="center" style="color:${f.paymentStatus === 'paid' ? '#4CAF50' : '#FF9800'}; font-weight:700">
          ${f.paymentStatus === 'paid' ? 'PAID' : 'PENDING'}
        </td>
      </tr>`
    )
    .join('');

  return `
    ${baseStyles}
    <div class="report">
      ${headerBlock('Milk Procurement System', data.centerName || 'Collection Center', 'Settlement Summary Report')}
      <div class="meta" style="display:flex; justify-content:space-between; align-items:center">
        <div>
          <p><strong>Period:</strong> ${format(new Date(data.startDate), 'dd MMM')} - ${format(new Date(data.endDate), 'dd MMM yyyy')}</p>
          <p>Total Milk Collected: ${data.totalMilk.toFixed(2)} Litres</p>
          <p>Total Payable Amount: ${money(data.totalAmount)}</p>
          <p>Total Farmers: ${data.farmers.length}</p>
        </div>
        <span class="status ${data.status}">${data.status.toUpperCase()}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Farmer Name</th>
            <th class="right">Total Litres</th><th class="right">Total Amount</th>
            <th class="center">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td></td><td>GRAND TOTAL</td>
            <td class="right">${data.totalMilk.toFixed(2)}</td>
            <td class="right">${money(data.totalAmount)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      ${footerBlock()}
    </div>
  `;
}

export function collectionReportHtml(data: CollectionReportPDFData): string {
  const center =
    data.centerName &&
    data.centerName !== 'All Centers' &&
    data.centerName !== 'Collection Center'
      ? data.centerName
      : '';

  const rows = data.farmers
    .map(
      (f, i) => `
      <tr>
        <td class="center">${i + 1}</td>
        <td>${escapeHtml(f.farmerName)}</td>
        <td class="center">${escapeHtml(f.farmerId || '-')}</td>
        <td class="center">${f.entriesCount}</td>
        <td class="right">${f.totalLitres.toFixed(2)}</td>
        <td class="right">${money(f.totalAmount)}</td>
      </tr>`
    )
    .join('');

  return `
    ${baseStyles}
    <div class="report">
      ${headerBlock('Milk Procurement System', center, `Collection Report (${data.periodLabel})`)}
      <div class="meta" style="display:flex; justify-content:space-between">
        <div>
          <p><strong>Period:</strong> ${format(new Date(data.startDate), 'dd MMM yyyy')} - ${format(new Date(data.endDate), 'dd MMM yyyy')}</p>
          <p>Total Milk Collected: ${data.totalLitres.toFixed(2)} Litres</p>
          <p>Total Amount: ${money(data.totalAmount)}</p>
          <p>Total Farmers: ${data.totalFarmers}</p>
        </div>
        <div>
          <p>Total Entries: ${data.totalEntries}</p>
          <p>Avg Fat: ${data.avgFat}%</p>
          <p>Avg SNF: ${data.avgSnf}%</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Farmer Name</th><th>ID</th>
            <th class="center">Entries</th><th class="right">Total (L)</th><th class="right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td></td><td>GRAND TOTAL</td><td></td>
            <td class="center">${data.totalEntries}</td>
            <td class="right">${data.totalLitres.toFixed(2)}</td>
            <td class="right">${money(data.totalAmount)}</td>
          </tr>
        </tfoot>
      </table>
      ${footerBlock()}
    </div>
  `;
}
