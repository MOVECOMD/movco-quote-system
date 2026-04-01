import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { custom_html } = await req.json()

    if (!custom_html) {
      return NextResponse.json({ error: 'No HTML provided' }, { status: 400 })
    }

    // Send the HTML to Claude and ask it to extract blocks
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: `You are an HTML parser. You will receive a full HTML website page. Your job is to identify the distinct content sections and convert them into a structured JSON array of blocks.

Each block must have a "type" field which is one of: hero, services, about, reviews, coverage, quote_form, contact, gallery, custom

For each block type, extract the relevant content:

hero: { type: "hero", headline: "...", subheadline: "...", cta_text: "..." }
services: { type: "services", title: "...", subtitle: "...", services: [{ title: "...", description: "..." }] }
about: { type: "about", title: "...", body: "...", highlights: ["...", "..."] }
reviews: { type: "reviews", title: "...", reviews: [{ name: "...", text: "...", rating: 5 }] }
coverage: { type: "coverage", title: "...", areas: ["...", "..."] }
quote_form: { type: "quote_form", title: "...", subtitle: "...", button_text: "..." }
contact: { type: "contact", title: "...", subtitle: "..." }
gallery: { type: "gallery", title: "...", images: ["url1", "url2"] }

For any section that doesn't fit the above types, use:
custom: { type: "custom", title: "descriptive title", custom_html: "<the raw HTML for that section>" }

RULES:
- Return ONLY a raw JSON array. No explanation, no markdown, no backticks.
- Extract ALL visible content sections from the page in order from top to bottom.
- Skip the navigation bar and footer — those are handled separately.
- For complex or unique sections that don't map to standard types, use type "custom" and include the raw HTML.
- Keep the original text content — do not summarise or shorten it.
- For the hero section, look for the main headline, tagline/subheadline, and call-to-action button text.
- Return at least 3 blocks — most websites have 4-8 distinct sections.`,
        messages: [
          {
            role: 'user',
            content: `Parse this HTML into blocks:\n\n${custom_html.substring(0, 30000)}\n\nReturn the JSON array of blocks now:`
          }
        ],
      }),
    })

    const data = await res.json()
    let responseText = data.content?.[0]?.text || ''

    // Clean markdown fences
    responseText = responseText.replace(/^```json?\s*/i, '').replace(/```\s*$/g, '').trim()

    // Extract JSON array
    const firstBracket = responseText.indexOf('[')
    const lastBracket = responseText.lastIndexOf(']')

    if (firstBracket === -1 || lastBracket === -1) {
      return NextResponse.json({ error: 'Failed to parse blocks from HTML' }, { status: 500 })
    }

    const blocks = JSON.parse(responseText.substring(firstBracket, lastBracket + 1))

    return NextResponse.json({ blocks })
  } catch (err: any) {
    console.error('Import HTML error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}