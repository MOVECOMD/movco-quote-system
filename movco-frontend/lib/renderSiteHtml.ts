// ============================================================
// FILE: movco-frontend/lib/renderSiteHtml.ts
// Converts blocks array + theme + company info → full HTML page
// ============================================================

type Block = { type: string; custom_html?: string; [key: string]: any }
type Theme = { primary_color: string; accent_color: string }
type Company = { name?: string; email?: string; phone?: string }

export function renderSiteHtml(
  blocks: Block[],
  theme: Theme,
  company: Company,
  navLinks?: { label: string; anchor: string }[]
): string {
  const primary = theme.primary_color || '#0a0f1c'
  const accent = theme.accent_color || '#0F6E56'
  const companyName = company.name || 'Our Company'

  const defaultNav = blocks.map(b => {
    const labels: Record<string, string> = {
      hero: 'Home', services: 'Services', about: 'About', reviews: 'Reviews',
      coverage: 'Areas', quote_form: 'Get a Quote', contact: 'Contact', gallery: 'Gallery',
    }
    return labels[b.type] ? { label: labels[b.type], anchor: `#section-${b.type}` } : null
  }).filter(Boolean) as { label: string; anchor: string }[]

  const nav = navLinks || defaultNav

  const sections = blocks.map((block, idx) => {
    // If block has custom HTML, use that directly
    if (block.custom_html && block.custom_html.trim()) {
      return `<!-- Block ${idx}: ${block.type} (custom HTML) -->\n${block.custom_html}`
    }
    // Otherwise render from template
    return renderBlock(block, idx, accent, primary, companyName)
  }).join('\n\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${companyName}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --primary: ${primary};
    --accent: ${accent};
    --accent-light: ${accent}15;
    --text: #1a1a2e;
    --text-light: #555;
    --bg: #ffffff;
    --bg-alt: #f8f9fa;
    --border: #e5e7eb;
  }
  body { font-family: 'Inter', system-ui, sans-serif; color: var(--text); line-height: 1.6; }
  a { text-decoration: none; color: inherit; }
  img { max-width: 100%; height: auto; }

  /* Nav */
  .site-nav {
    position: sticky; top: 0; z-index: 100; background: var(--bg);
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 40px; border-bottom: 1px solid var(--border);
  }
  .site-nav .logo { font-size: 1.3rem; font-weight: 800; color: var(--primary); }
  .site-nav .nav-links { display: flex; align-items: center; gap: 28px; }
  .site-nav .nav-links a { font-size: 0.9rem; font-weight: 500; color: var(--text-light); transition: color 0.2s; }
  .site-nav .nav-links a:hover { color: var(--accent); }
  .site-nav .nav-cta {
    background: var(--accent); color: #fff; padding: 10px 24px; border-radius: 8px;
    font-weight: 600; font-size: 0.9rem; transition: opacity 0.2s;
  }
  .site-nav .nav-cta:hover { opacity: 0.9; }

  /* Sections */
  .section { padding: 80px 40px; }
  .section-alt { background: var(--bg-alt); }
  .section-center { text-align: center; }
  .section-title { font-size: 2rem; font-weight: 800; margin-bottom: 12px; color: var(--primary); }
  .section-subtitle { font-size: 1.05rem; color: var(--text-light); max-width: 600px; margin: 0 auto 40px; }
  .container { max-width: 1100px; margin: 0 auto; }

  /* Hero */
  .hero-section {
    position: relative; min-height: 70vh; display: flex; align-items: center;
    background: var(--primary); color: #fff; padding: 80px 40px;
  }
  .hero-section .container { position: relative; z-index: 2; }
  .hero-section h1 { font-size: 3rem; font-weight: 800; line-height: 1.15; margin-bottom: 16px; }
  .hero-section p { font-size: 1.15rem; opacity: 0.85; margin-bottom: 32px; max-width: 500px; }
  .hero-cta {
    display: inline-block; background: var(--accent); color: #fff; padding: 14px 32px;
    border-radius: 8px; font-weight: 700; font-size: 1rem; transition: opacity 0.2s;
  }
  .hero-cta:hover { opacity: 0.9; }

  /* Services grid */
  .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
  .service-card {
    background: var(--bg); border: 1px solid var(--border); border-radius: 12px;
    padding: 28px; transition: box-shadow 0.2s, transform 0.2s;
  }
  .service-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.08); transform: translateY(-2px); }
  .service-card h3 { font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
  .service-card p { font-size: 0.9rem; color: var(--text-light); }

  /* Reviews */
  .reviews-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
  .review-card {
    background: var(--bg); border: 1px solid var(--border); border-radius: 12px; padding: 24px;
  }
  .review-stars { color: #f59e0b; margin-bottom: 12px; font-size: 1.1rem; }
  .review-text { font-size: 0.9rem; color: var(--text-light); font-style: italic; margin-bottom: 12px; line-height: 1.7; }
  .review-name { font-weight: 700; font-size: 0.85rem; }

  /* Coverage */
  .coverage-tags { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
  .coverage-tag {
    background: var(--accent-light); color: var(--accent); padding: 8px 20px;
    border-radius: 24px; font-size: 0.9rem; font-weight: 600;
  }

  /* Quote form */
  .quote-form { max-width: 600px; margin: 0 auto; }
  .quote-form .form-group { margin-bottom: 16px; }
  .quote-form label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; color: var(--text); }
  .quote-form input, .quote-form textarea, .quote-form select {
    width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: 8px;
    font-size: 0.95rem; font-family: inherit; transition: border-color 0.2s;
  }
  .quote-form input:focus, .quote-form textarea:focus { outline: none; border-color: var(--accent); }
  .quote-form textarea { resize: vertical; min-height: 80px; }
  .quote-form .submit-btn {
    width: 100%; padding: 14px; background: var(--accent); color: #fff;
    border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer;
    transition: opacity 0.2s;
  }
  .quote-form .submit-btn:hover { opacity: 0.9; }

  /* About */
  .about-highlights { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 20px; justify-content: center; }
  .about-highlight {
    display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 500;
  }
  .about-highlight::before {
    content: '✓'; width: 24px; height: 24px; border-radius: 50%; background: var(--accent);
    color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; flex-shrink: 0;
  }

  /* Gallery */
  .gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .gallery-grid img { width: 100%; height: 180px; object-fit: cover; border-radius: 10px; }

  /* Contact */
  .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; align-items: start; }
  .contact-info p { margin-bottom: 12px; font-size: 0.95rem; }

  /* Footer */
  .site-footer {
    background: var(--primary); color: rgba(255,255,255,0.6);
    padding: 30px 40px; text-align: center; font-size: 0.85rem;
  }
  .site-footer a { color: var(--accent); }

  /* Mobile */
  @media (max-width: 768px) {
    .site-nav { padding: 12px 20px; }
    .site-nav .nav-links { gap: 16px; font-size: 0.8rem; }
    .hero-section { padding: 60px 20px; min-height: 50vh; }
    .hero-section h1 { font-size: 2rem; }
    .section { padding: 50px 20px; }
    .contact-grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<!-- Navigation -->
<nav class="site-nav">
  <div class="logo">${companyName}</div>
  <div class="nav-links">
    ${nav.map(n => `<a href="${n.anchor}">${n.label}</a>`).join('\n    ')}
    <a href="#section-quote_form" class="nav-cta">Get a Free Quote</a>
  </div>
</nav>

${sections}

<!-- Footer -->
<footer class="site-footer">
  <p>&copy; ${new Date().getFullYear()} ${companyName}${company.phone ? ` · ${company.phone}` : ''}${company.email ? ` · ${company.email}` : ''}</p>
</footer>

</body>
</html>`
}

function renderBlock(block: Block, idx: number, accent: string, primary: string, companyName: string): string {
  switch (block.type) {
    case 'hero':
      return `<section id="section-hero" class="hero-section">
  <div class="container">
    <h1>${block.headline || 'Professional Services'}</h1>
    <p>${block.subheadline || 'Trusted, reliable, and affordable'}</p>
    <a href="#section-quote_form" class="hero-cta">${block.cta_text || 'Get a Free Quote'}</a>
  </div>
</section>`

    case 'services':
      const services = (block.services || []).map((s: any) =>
        `<div class="service-card">
      <h3>${s.title}</h3>
      <p>${s.description}</p>
    </div>`
      ).join('\n    ')
      return `<section id="section-services" class="section section-alt section-center">
  <div class="container">
    <h2 class="section-title">${block.title || 'Our Services'}</h2>
    ${block.subtitle ? `<p class="section-subtitle">${block.subtitle}</p>` : ''}
    <div class="services-grid">
    ${services}
    </div>
  </div>
</section>`

    case 'reviews':
      const reviews = (block.reviews || []).map((r: any) =>
        `<div class="review-card">
      <div class="review-stars">${'★'.repeat(r.rating || 5)}</div>
      <p class="review-text">"${r.text}"</p>
      <p class="review-name">— ${r.name}</p>
    </div>`
      ).join('\n    ')
      return `<section id="section-reviews" class="section section-center">
  <div class="container">
    <h2 class="section-title">${block.title || 'Customer Reviews'}</h2>
    ${block.subtitle ? `<p class="section-subtitle">${block.subtitle}</p>` : ''}
    <div class="reviews-grid">
    ${reviews}
    </div>
  </div>
</section>`

    case 'quote_form':
      return `<section id="section-quote_form" class="section section-alt section-center">
  <div class="container">
    <h2 class="section-title">${block.title || 'Get a Free Quote'}</h2>
    ${block.subtitle ? `<p class="section-subtitle">${block.subtitle}</p>` : ''}
    <form class="quote-form" onsubmit="event.preventDefault(); alert('Quote request submitted!');">
      <div class="form-group"><label>Your name</label><input name="name" required></div>
      <div class="form-group"><label>Email address</label><input name="email" type="email" required></div>
      <div class="form-group"><label>Phone number</label><input name="phone" type="tel"></div>
      <div class="form-group"><label>Moving from</label><input name="moving_from"></div>
      <div class="form-group"><label>Moving to</label><input name="moving_to"></div>
      <div class="form-group"><label>Preferred date</label><input name="date" type="date"></div>
      <div class="form-group"><label>Additional details</label><textarea name="details"></textarea></div>
      <button type="submit" class="submit-btn">${block.button_text || 'Request My Free Quote'}</button>
    </form>
  </div>
</section>`

    case 'about':
      const highlights = (block.highlights || []).map((h: string) =>
        `<span class="about-highlight">${h}</span>`
      ).join('\n      ')
      return `<section id="section-about" class="section section-center">
  <div class="container">
    <h2 class="section-title">${block.title || 'About Us'}</h2>
    <p class="section-subtitle">${block.body || ''}</p>
    ${highlights ? `<div class="about-highlights">\n      ${highlights}\n    </div>` : ''}
  </div>
</section>`

    case 'coverage':
      const areas = (block.areas || []).map((a: string) =>
        `<span class="coverage-tag">${a}</span>`
      ).join('\n      ')
      return `<section id="section-coverage" class="section section-alt section-center">
  <div class="container">
    <h2 class="section-title">${block.title || 'Areas We Cover'}</h2>
    ${block.subtitle ? `<p class="section-subtitle">${block.subtitle}</p>` : ''}
    <div class="coverage-tags">
      ${areas}
    </div>
  </div>
</section>`

    case 'contact':
      return `<section id="section-contact" class="section section-center">
  <div class="container">
    <h2 class="section-title">${block.title || 'Contact Us'}</h2>
    ${block.subtitle ? `<p class="section-subtitle">${block.subtitle}</p>` : ''}
    <form class="quote-form" onsubmit="event.preventDefault(); alert('Message sent!');">
      <div class="form-group"><label>Name</label><input name="name" required></div>
      <div class="form-group"><label>Email</label><input name="email" type="email" required></div>
      <div class="form-group"><label>Message</label><textarea name="message" required></textarea></div>
      <button type="submit" class="submit-btn">Send Message</button>
    </form>
  </div>
</section>`

    case 'gallery':
      const images = (block.images || []).map((url: string) =>
        url ? `<img src="${url}" alt="Gallery image" loading="lazy">` : ''
      ).filter(Boolean).join('\n      ')
      return `<section id="section-gallery" class="section section-alt section-center">
  <div class="container">
    <h2 class="section-title">${block.title || 'Our Work'}</h2>
    ${block.subtitle ? `<p class="section-subtitle">${block.subtitle}</p>` : ''}
    <div class="gallery-grid">
      ${images || '<p style="color:#aaa">No images added yet</p>'}
    </div>
  </div>
</section>`

    default:
      return `<!-- Unknown block type: ${block.type} -->`
  }
}