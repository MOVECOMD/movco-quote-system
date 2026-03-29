export default function ThankYouPage() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Thank you!</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8f8f8; }
          .card { background: #fff; border-radius: 16px; padding: 48px; text-align: center; max-width: 480px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
          h1 { font-size: 32px; font-weight: 700; margin-bottom: 16px; color: #0F6E56; }
          p { color: #555; line-height: 1.7; font-size: 16px; }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✓</div>
          <h1>Thank you!</h1>
          <p>Your message has been received. We'll be in touch with you shortly.</p>
          <a href="javascript:history.back()" style={{ display: 'inline-block', marginTop: '24px', color: '#0F6E56', fontWeight: 600, textDecoration: 'none' }}>
            ← Go back
          </a>
        </div>
      </body>
    </html>
  )
}