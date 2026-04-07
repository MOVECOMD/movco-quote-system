import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

export async function POST(req: NextRequest) {
  try {
    const { headers, sampleRows, importType, templateType } = await req.json();

    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      return NextResponse.json({ error: 'No headers provided' }, { status: 400 });
    }

    // Define target fields based on import type
    const targetFields = getTargetFields(importType, templateType);

    const prompt = `You are a data import assistant. A user is importing a ${importType} spreadsheet into a CRM system${templateType ? ` for a ${templateType} business` : ''}.

Their CSV/Excel file has these column headers:
${JSON.stringify(headers)}

Here are the first 3 sample rows of data:
${JSON.stringify(sampleRows?.slice(0, 3) || [])}

The CRM has these target fields to map to:
${JSON.stringify(targetFields.map(f => ({ key: f.key, label: f.label, description: f.description, required: f.required })))}

Your job: Match each CSV column to the most appropriate CRM field, or mark it as unmapped.

Rules:
- Look at both the column header name AND the sample data to determine the best match
- A phone number column might be called "Tel", "Mobile", "Contact Number", etc.
- An email might be in a column called "E-mail", "Email Address", "Contact Email", etc.
- Dates might be in various formats (DD/MM/YYYY, YYYY-MM-DD, "1st January 2026", etc.)
- If a column clearly doesn't match any field, don't force a mapping
- Each target field can only be mapped once
- Prioritise required fields

Return ONLY a JSON object where keys are the CSV column headers and values are the target field keys (or null if no match). Example:
{"Customer Name": "name", "Tel": "phone", "Random Column": null}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic API error:', errText);
      return NextResponse.json({ error: 'AI mapping failed' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 });
    }

    const mapping = JSON.parse(jsonMatch[0]);

    // Clean: remove null values, validate field keys exist
    const validKeys = new Set(targetFields.map(f => f.key));
    const cleanMapping: Record<string, string> = {};
    for (const [csvCol, fieldKey] of Object.entries(mapping)) {
      if (fieldKey && typeof fieldKey === 'string' && validKeys.has(fieldKey)) {
        cleanMapping[csvCol] = fieldKey;
      }
    }

    return NextResponse.json({ mapping: cleanMapping, confidence: 'ai' });
  } catch (err: any) {
    console.error('AI map error:', err);
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 });
  }
}

interface FieldDef {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

function getTargetFields(importType: string, templateType?: string): FieldDef[] {
  // Base fields per import type
  const base: Record<string, FieldDef[]> = {
    customers: [
      { key: 'name', label: 'Name', description: 'Full name of the customer/contact', required: true },
      { key: 'email', label: 'Email', description: 'Email address', required: false },
      { key: 'phone', label: 'Phone', description: 'Phone or mobile number', required: false },
      { key: 'address', label: 'Address', description: 'Full postal address', required: false },
      { key: 'source', label: 'Source', description: 'How they found the business (referral, Google, etc)', required: false },
      { key: 'notes', label: 'Notes', description: 'Any additional notes or comments', required: false },
    ],
    quotes: [
      { key: 'customer_name', label: 'Customer Name', description: 'Name of the customer', required: true },
      { key: 'customer_email', label: 'Email', description: 'Customer email', required: false },
      { key: 'customer_phone', label: 'Phone', description: 'Customer phone number', required: false },
      { key: 'estimated_price', label: 'Price', description: 'Quote amount / price / cost', required: false },
      { key: 'status', label: 'Status', description: 'Quote status (draft, sent, accepted, declined)', required: false },
      { key: 'notes', label: 'Notes', description: 'Additional details', required: false },
    ],
    jobs: [
      { key: 'customer_name', label: 'Customer Name', description: 'Name of the customer', required: true },
      { key: 'job_date', label: 'Job Date', description: 'Date of the job/appointment', required: true },
      { key: 'start_time', label: 'Start Time', description: 'Start time of the job', required: false },
      { key: 'location', label: 'Location', description: 'Job location or address', required: false },
      { key: 'estimated_value', label: 'Value', description: 'Job value / price', required: false },
      { key: 'notes', label: 'Notes', description: 'Additional details', required: false },
    ],
    leads: [
      { key: 'name', label: 'Name', description: 'Lead name / contact name', required: true },
      { key: 'email', label: 'Email', description: 'Email address', required: false },
      { key: 'phone', label: 'Phone', description: 'Phone number', required: false },
      { key: 'notes', label: 'Notes', description: 'Additional details or message', required: false },
    ],
  };

  const fields = [...(base[importType] || base.customers)];

  // Add template-specific fields
  if (templateType === 'removals' || !templateType) {
    if (importType === 'customers' || importType === 'leads') {
      fields.push(
        { key: 'moving_from', label: 'Moving From', description: 'Current / pickup address', required: false },
        { key: 'moving_to', label: 'Moving To', description: 'Destination / delivery address', required: false },
        { key: 'moving_date', label: 'Moving Date', description: 'Date of the move', required: false },
      );
    }
    if (importType === 'quotes') {
      fields.push(
        { key: 'moving_from', label: 'Moving From', description: 'Pickup address', required: false },
        { key: 'moving_to', label: 'Moving To', description: 'Delivery address', required: false },
        { key: 'moving_date', label: 'Move Date', description: 'Date of the move', required: false },
      );
    }
    if (importType === 'jobs') {
      fields.push(
        { key: 'moving_to', label: 'Moving To', description: 'Delivery address', required: false },
      );
    }
  }

  if (templateType === 'plumber' || templateType === 'trades') {
    if (importType === 'customers') {
      fields.push(
        { key: 'property_type', label: 'Property Type', description: 'House, flat, commercial, etc', required: false },
      );
    }
    if (importType === 'jobs') {
      fields.push(
        { key: 'job_type', label: 'Job Type', description: 'Type of work (boiler service, leak repair, etc)', required: false },
      );
    }
  }

  if (templateType === 'estate_agent') {
    if (importType === 'customers') {
      fields.push(
        { key: 'property_value', label: 'Property Value', description: 'Estimated property value', required: false },
        { key: 'bedrooms', label: 'Bedrooms', description: 'Number of bedrooms', required: false },
      );
    }
  }

  if (templateType === 'salon' || templateType === 'barber') {
    if (importType === 'customers') {
      fields.push(
        { key: 'preferred_service', label: 'Preferred Service', description: 'Usual service (cut, colour, etc)', required: false },
      );
    }
  }

  if (templateType === 'vet') {
    if (importType === 'customers') {
      fields.push(
        { key: 'pet_name', label: 'Pet Name', description: 'Name of the pet/animal', required: false },
        { key: 'pet_type', label: 'Pet Type', description: 'Dog, cat, rabbit, etc', required: false },
      );
    }
  }

  return fields;
}