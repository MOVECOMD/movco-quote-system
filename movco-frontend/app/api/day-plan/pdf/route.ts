import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { deal, ai_plan, start_time, crew_count, van_count, notes } = await req.json()

  const contact = deal.crm_contacts || {}

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 3px solid #ff6b35; padding-bottom: 20px; }
    .logo { font-size: 28px; font-weight: 900; color: #ff6b35; letter-spacing: -1px; }
    .doc-title { font-size: 13px; color: #666; margin-top: 4px; }
    .date-badge { background: #ff6b35; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 14px; text-align: right; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #ff6b35; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .info-box { background: #f8f8f8; border-radius: 6px; padding: 14px; }
    .info-label { font-size: 10px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .info-value { font-size: 15px; font-weight: 600; }
    .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .stat-box { background: #1a1a1a; color: white; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-number { font-size: 32px; font-weight: 900; color: #ff6b35; }
    .stat-label { font-size: 11px; color: #aaa; margin-top: 2px; }
    .plan-box { background: #f8f8f8; border-radius: 8px; padding: 20px; white-space: pre-wrap; line-height: 1.7; font-size: 13px; }
    .notes-box { border-left: 4px solid #ff6b35; padding: 12px 16px; background: #fff9f6; font-size: 13px; line-height: 1.6; }
    .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 16px; font-size: 11px; color: #aaa; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">🚛 MOVCO</div>
      <div class="doc-title">Crew Day Plan</div>
    </div>
    <div class="date-badge">
      ${deal.scheduled_date || 'Date TBC'}<br>
      ${start_time || 'Time TBC'}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Customer Details</div>
    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">Customer Name</div>
        <div class="info-value">${contact.name || 'Not specified'}</div>
      </div>
      <div class="info-box">
        <div class="info-label">Phone</div>
        <div class="info-value">${contact.phone || 'Not specified'}</div>
      </div>
      <div class="info-box" style="grid-column: span 2">
        <div class="info-label">Address</div>
        <div class="info-value">${contact.address || deal.address || 'Not specified'}</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Job Resources</div>
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-number">${crew_count || '—'}</div>
        <div class="stat-label">Crew Members</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${van_count || '—'}</div>
        <div class="stat-label">Vans</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">${start_time || '—'}</div>
        <div class="stat-label">Start Time</div>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Day Plan</div>
    <div class="plan-box">${ai_plan}</div>
  </div>

  ${notes ? `
  <div class="section">
    <div class="section-title">Additional Notes</div>
    <div class="notes-box">${notes}</div>
  </div>` : ''}

  <div class="footer">
    <span>MOVCO — Confidential — For crew use only</span>
    <span>Generated ${new Date().toLocaleDateString('en-GB')}</span>
  </div>
</body>
</html>`

  return NextResponse.json({ html })
}