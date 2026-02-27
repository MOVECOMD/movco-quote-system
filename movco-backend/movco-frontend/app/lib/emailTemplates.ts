// lib/emailTemplates.ts
// Partner email notification templates for MOVCO lead alerts

interface StorageLeadEmail {
  partnerName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  storageRequirements: string;
  recommendedUnit: string;
  quotedPrice: string;
  date: string;
}

interface RemovalsLeadEmail {
  partnerName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  movingFrom: string;
  movingTo: string;
  items: { name: string; quantity: number }[];
  vanSize: string;
  crewSize: number;
  estimatedTime: string;
  quotedPrice: string;
  photoUrls: string[];
  date: string;
}

function baseWrapper(content: string, partnerName: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Quote Request</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#0F1629;padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">MOVCO</span>
                    <span style="color:#64748b;font-size:14px;margin-left:8px;">× ${partnerName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Banner -->
          <tr>
            <td style="background-color:#2563EB;padding:16px 32px;">
              <span style="color:#ffffff;font-size:16px;font-weight:600;">🔔 New Quote Request</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                This lead was captured via your MOVCO-powered calculator.<br>
                Respond quickly — the fastest reply wins the job.
              </p>
            </td>
          </tr>

        </table>

        <!-- Sub-footer -->
        <p style="color:#94a3b8;font-size:11px;margin-top:16px;text-align:center;">
          Powered by <a href="https://movco.co.uk" style="color:#2563EB;text-decoration:none;">MOVCO</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;width:140px;">${label}</td>
      <td style="padding:8px 0;color:#1e293b;font-size:14px;vertical-align:top;">${value}</td>
    </tr>`;
}

export function buildStorageLeadEmail(data: StorageLeadEmail): string {
  const content = `
    <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;font-weight:700;">New Storage Enquiry</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">${data.date}</p>

    <!-- Customer Details -->
    <div style="background-color:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
      <h3 style="margin:0 0 12px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Customer Details</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow('Name', data.customerName)}
        ${detailRow('Email', `<a href="mailto:${data.customerEmail}" style="color:#2563EB;text-decoration:none;">${data.customerEmail}</a>`)}
        ${detailRow('Phone', `<a href="tel:${data.customerPhone}" style="color:#2563EB;text-decoration:none;">${data.customerPhone}</a>`)}
      </table>
    </div>

    <!-- Storage Details -->
    <div style="background-color:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
      <h3 style="margin:0 0 12px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Storage Requirements</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow('Requirements', data.storageRequirements)}
        ${detailRow('Recommended Unit', data.recommendedUnit)}
      </table>
    </div>

    <!-- Quote -->
    <div style="background-color:#0F1629;border-radius:8px;padding:20px;text-align:center;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Quoted Price</p>
      <p style="margin:0;color:#22c55e;font-size:32px;font-weight:700;">${data.quotedPrice}</p>
    </div>
  `;

  return baseWrapper(content, data.partnerName);
}

export function buildRemovalsLeadEmail(data: RemovalsLeadEmail): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:4px 0;color:#1e293b;font-size:13px;">${item.name}</td>
        <td style="padding:4px 0;color:#64748b;font-size:13px;text-align:right;">×${item.quantity}</td>
      </tr>`
    )
    .join('');

  const photoSection =
    data.photoUrls.length > 0
      ? `
    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 12px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Uploaded Photos</h3>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          ${data.photoUrls
            .slice(0, 4)
            .map(
              (url) =>
                `<td style="padding-right:8px;"><img src="${url}" width="120" height="90" style="border-radius:6px;object-fit:cover;display:block;" alt="Room photo" /></td>`
            )
            .join('')}
        </tr>
      </table>
      ${data.photoUrls.length > 4 ? `<p style="margin:8px 0 0;color:#64748b;font-size:12px;">+ ${data.photoUrls.length - 4} more photos</p>` : ''}
    </div>`
      : '';

  const content = `
    <h2 style="margin:0 0 4px;color:#1e293b;font-size:20px;font-weight:700;">New Removals Enquiry</h2>
    <p style="margin:0 0 24px;color:#64748b;font-size:14px;">${data.date}</p>

    <!-- Customer Details -->
    <div style="background-color:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
      <h3 style="margin:0 0 12px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Customer Details</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow('Name', data.customerName)}
        ${detailRow('Email', `<a href="mailto:${data.customerEmail}" style="color:#2563EB;text-decoration:none;">${data.customerEmail}</a>`)}
        ${detailRow('Phone', `<a href="tel:${data.customerPhone}" style="color:#2563EB;text-decoration:none;">${data.customerPhone}</a>`)}
      </table>
    </div>

    <!-- Move Details -->
    <div style="background-color:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
      <h3 style="margin:0 0 12px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Move Details</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${detailRow('Moving From', data.movingFrom)}
        ${detailRow('Moving To', data.movingTo)}
        ${detailRow('Van Size', data.vanSize)}
        ${detailRow('Crew', `${data.crewSize} person${data.crewSize > 1 ? 's' : ''}`)}
        ${detailRow('Est. Time', data.estimatedTime)}
      </table>
    </div>

    <!-- Items -->
    <div style="background-color:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
      <h3 style="margin:0 0 12px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Items Identified (AI Analysis)</h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${itemRows}
      </table>
    </div>

    ${photoSection}

    <!-- Quote -->
    <div style="background-color:#0F1629;border-radius:8px;padding:20px;text-align:center;">
      <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Quoted Price</p>
      <p style="margin:0;color:#22c55e;font-size:32px;font-weight:700;">${data.quotedPrice}</p>
    </div>
  `;

  return baseWrapper(content, data.partnerName);
}
