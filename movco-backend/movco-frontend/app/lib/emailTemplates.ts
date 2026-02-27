// lib/emailTemplates.ts
// Partner email notification templates for MOVCO lead alerts + welcome emails

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

interface WelcomeEmail {
  companyName: string;
  contactName: string;
  productLabel: string;
  monthlyPrice: string;
  calculatorUrl: string;
  slug: string;
  includesInstallation: boolean;
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

// ═══════════════════════════════════════════════════════════════
//  WELCOME / SIGN-UP CONFIRMATION EMAIL
//  Sent when a partner pays via Stripe Payment Link
// ═══════════════════════════════════════════════════════════════

export function buildWelcomeEmail(data: WelcomeEmail): string {
  const installationBlock = data.includesInstallation ? `
    <div style="background-color:#f0fdf4;border-radius:8px;padding:16px 20px;margin-bottom:20px;border:1px solid #bbf7d0;">
      <span style="font-size:18px;margin-right:8px;">🔧</span>
      <span style="color:#15803d;font-size:14px;font-weight:600;">Installation Package Included</span>
      <p style="margin:8px 0 0;color:#166534;font-size:13px;line-height:1.5;">Our team will handle the full setup of your calculator, including branding, pricing configuration, and embedding on your website. We'll be in touch within 24 hours to get started.</p>
    </div>` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MOVCO</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background-color:#0F1629;padding:40px 32px;text-align:center;">
              <div style="width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#2563EB,#7C3AED);margin:0 auto 16px;line-height:56px;text-align:center;">
                <span style="color:#ffffff;font-size:24px;font-weight:800;">M</span>
              </div>
              <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;">Welcome to MOVCO! 🚀</h1>
              <p style="margin:0;color:#94a3b8;font-size:15px;">Your subscription is active and ready to go</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">

              <p style="margin:0 0 20px;color:#1e293b;font-size:15px;line-height:1.6;">Hi ${data.companyName},</p>
              <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">Thanks for choosing MOVCO! Your <strong>${data.productLabel}</strong> subscription is now active. Here's everything you need to know.</p>

              <!-- Subscription Details -->
              <div style="background-color:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
                <h3 style="margin:0 0 16px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Your Subscription</h3>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;width:140px;">Product</td>
                    <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${data.productLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Monthly Price</td>
                    <td style="padding:6px 0;color:#1e293b;font-size:14px;font-weight:600;">${data.monthlyPrice}/month</td>
                  </tr>
                  <tr>
                    <td style="padding:6px 0;color:#64748b;font-size:13px;font-weight:600;">Status</td>
                    <td style="padding:6px 0;">
                      <span style="background-color:#ecfdf5;color:#059669;font-size:12px;font-weight:600;padding:3px 10px;border-radius:20px;">✓ Active</span>
                    </td>
                  </tr>
                </table>
              </div>

              ${installationBlock}

              <!-- Calculator URL -->
              <div style="background-color:#0F1629;border-radius:8px;padding:24px;margin-bottom:20px;text-align:center;">
                <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Your Calculator URL</p>
                <p style="margin:0 0 16px;color:#ffffff;font-size:14px;word-break:break-all;">
                  <a href="${data.calculatorUrl}" style="color:#60a5fa;text-decoration:none;">${data.calculatorUrl}</a>
                </p>
                <a href="${data.calculatorUrl}" style="display:inline-block;background-color:#2563EB;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;text-decoration:none;">View Your Calculator →</a>
              </div>

              <!-- Next Steps -->
              <div style="background-color:#f8fafc;border-radius:8px;padding:20px;margin-bottom:20px;">
                <h3 style="margin:0 0 16px;color:#1e293b;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">What Happens Next</h3>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;vertical-align:top;width:32px;">
                      <div style="width:24px;height:24px;border-radius:6px;background-color:#2563EB;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">1</div>
                    </td>
                    <td style="padding:8px 0 8px 12px;vertical-align:top;">
                      <div style="color:#1e293b;font-size:13px;font-weight:600;">Embed on your website</div>
                      <div style="color:#64748b;font-size:12px;margin-top:2px;">Add a link or iframe to your site pointing to your calculator URL</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;vertical-align:top;width:32px;">
                      <div style="width:24px;height:24px;border-radius:6px;background-color:#2563EB;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">2</div>
                    </td>
                    <td style="padding:8px 0 8px 12px;vertical-align:top;">
                      <div style="color:#1e293b;font-size:13px;font-weight:600;">Receive leads by email</div>
                      <div style="color:#64748b;font-size:12px;margin-top:2px;">Every time a customer completes a quote, you'll get an instant email with full details</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;vertical-align:top;width:32px;">
                      <div style="width:24px;height:24px;border-radius:6px;background-color:#2563EB;color:#fff;font-size:12px;font-weight:700;text-align:center;line-height:24px;">3</div>
                    </td>
                    <td style="padding:8px 0 8px 12px;vertical-align:top;">
                      <div style="color:#1e293b;font-size:13px;font-weight:600;">Close the deal</div>
                      <div style="color:#64748b;font-size:12px;margin-top:2px;">Follow up with leads fast — the quickest response wins the job</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Support -->
              <div style="text-align:center;padding:8px 0;">
                <p style="margin:0 0 4px;color:#1e293b;font-size:14px;font-weight:600;">Need help?</p>
                <p style="margin:0;color:#64748b;font-size:13px;">
                  Reply to this email or contact us at
                  <a href="mailto:support@movco.co.uk" style="color:#2563EB;text-decoration:none;">support@movco.co.uk</a>
                </p>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">
                You're receiving this because you subscribed to MOVCO.<br>
                Manage your subscription in Stripe or contact us for help.
              </p>
            </td>
          </tr>

        </table>

        <p style="color:#94a3b8;font-size:11px;margin-top:16px;text-align:center;">
          © MOVCO ${new Date().getFullYear()} · <a href="https://movco.co.uk" style="color:#2563EB;text-decoration:none;">movco.co.uk</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
