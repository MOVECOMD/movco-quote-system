export function getFollowUpEmail1(customerName: string, estimatedQuote: string, quoteLink: string) {
  const firstName = customerName?.split(' ')[0] || 'there';

  return {
    subject: `Your moving quote: ${estimatedQuote} — ready to find a mover?`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#0a0f1c;padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;letter-spacing:2px;">MOVCO</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#0a0f1c;margin:0 0 16px;font-size:22px;">Hi ${firstName} 👋</h2>
              
              <p style="color:#4a5568;font-size:16px;line-height:1.6;margin:0 0 16px;">
                You recently got a moving quote with MOVCO — your estimated cost came in at:
              </p>

              <!-- Quote highlight -->
              <div style="background:linear-gradient(135deg,#0a0f1c,#1a2340);border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
                <p style="color:#94a3b8;font-size:14px;margin:0 0 4px;text-transform:uppercase;letter-spacing:1px;">Your AI Estimate</p>
                <p style="color:#ffffff;font-size:36px;font-weight:bold;margin:0;">${estimatedQuote}</p>
              </div>

              <p style="color:#4a5568;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Would you like us to connect you with trusted removal companies in your area? They'll contact you directly with availability and final pricing — no obligation.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:32px 0;">
                <a href="${quoteLink}" style="background-color:#3b82f6;color:#ffffff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                  Yes, Find Me a Company →
                </a>
              </div>

              <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:24px 0 0;text-align:center;">
                Or simply reply to this email if you have any questions.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
                © 2026 MOVCO · AI-Powered Moving Quotes<br>
                <a href="https://movco.co.uk" style="color:#3b82f6;text-decoration:none;">movco.co.uk</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}

export function getFollowUpEmail2(customerName: string, estimatedQuote: string, quoteLink: string) {
  const firstName = customerName?.split(' ')[0] || 'there';

  return {
    subject: `${firstName}, removal companies in your area are ready to help`,
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          
          <!-- Header -->
          <tr>
            <td style="background-color:#0a0f1c;padding:30px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:28px;letter-spacing:2px;">MOVCO</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="color:#0a0f1c;margin:0 0 16px;font-size:22px;">Still planning your move, ${firstName}?</h2>
              
              <p style="color:#4a5568;font-size:16px;line-height:1.6;margin:0 0 16px;">
                We wanted to follow up on your moving quote of <strong>${estimatedQuote}</strong>. Local removal companies in your area are available and ready to help.
              </p>

              <!-- Benefits -->
              <div style="background-color:#f0f9ff;border-radius:10px;padding:20px;margin:24px 0;">
                <p style="color:#0a0f1c;font-size:15px;font-weight:bold;margin:0 0 12px;">Why connect through MOVCO?</p>
                <p style="color:#4a5568;font-size:14px;line-height:1.8;margin:0;">
                  ✅ Companies already know your inventory and volume<br>
                  ✅ No need to explain your move from scratch<br>
                  ✅ Get competitive prices from local professionals<br>
                  ✅ Completely free, no obligation
                </p>
              </div>

              <p style="color:#4a5568;font-size:16px;line-height:1.6;margin:0 0 24px;">
                Just click below and we'll connect you — it takes seconds.
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:32px 0;">
                <a href="${quoteLink}" style="background-color:#3b82f6;color:#ffffff;padding:16px 40px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block;">
                  Connect Me with Movers →
                </a>
              </div>

              <p style="color:#94a3b8;font-size:13px;line-height:1.6;margin:24px 0 0;text-align:center;">
                Not moving anymore? No worries — just ignore this email.<br>
                We won't send you any more follow-ups.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 40px;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;text-align:center;">
                © 2026 MOVCO · AI-Powered Moving Quotes<br>
                <a href="https://movco.co.uk" style="color:#3b82f6;text-decoration:none;">movco.co.uk</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}
