// lib/templateSeeds.ts
// Default pipeline stages, event types, and customer fields per industry template

export type TemplateSeed = {
  stages: { name: string; color: string; position: number }[];
  event_types: { key: string; label: string; color: string }[];
  customer_fields: { key: string; label: string; type: string; options?: string[] }[];
};

const seeds: Record<string, TemplateSeed> = {

  // ═══════════════════════════════════════
  // REMOVALS (MOVCO default)
  // ═══════════════════════════════════════
  removals: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Survey Booked', color: '#3b82f6', position: 2 },
      { name: 'Quote Sent', color: '#8b5cf6', position: 3 },
      { name: 'Quote Followed Up', color: '#f59e0b', position: 4 },
      { name: 'Booked', color: '#06b6d4', position: 5 },
      { name: 'Completed', color: '#10b981', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'job', label: 'Moving Day', color: '#3b82f6' },
      { key: 'survey', label: 'Home Survey', color: '#8b5cf6' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'delivery', label: 'Delivery', color: '#22c55e' },
      { key: 'packing', label: 'Packing Day', color: '#f97316' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', options: ['1', '2', '3', '4', '5+'] },
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['Flat', 'Terraced', 'Semi-Detached', 'Detached', 'Bungalow', 'Other'] },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
      { key: 'parking', label: 'Parking Available', type: 'select', options: ['Yes', 'No', 'Permit Required'] },
    ],
  },

  // ═══════════════════════════════════════
  // PLUMBER / TRADES
  // ═══════════════════════════════════════
  plumber: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Quote Sent', color: '#3b82f6', position: 2 },
      { name: 'Awaiting Response', color: '#f59e0b', position: 3 },
      { name: 'Job Booked', color: '#8b5cf6', position: 4 },
      { name: 'In Progress', color: '#06b6d4', position: 5 },
      { name: 'Completed', color: '#10b981', position: 6 },
      { name: 'Invoiced', color: '#14b8a6', position: 7 },
      { name: 'Lost', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'job', label: 'Job', color: '#3b82f6' },
      { key: 'callout', label: 'Emergency Callout', color: '#ef4444' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#8b5cf6' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'follow_up', label: 'Follow Up', color: '#06b6d4' },
      { key: 'inspection', label: 'Inspection', color: '#14b8a6' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Commercial', 'New Build', 'Other'] },
      { key: 'boiler_make', label: 'Boiler Make/Model', type: 'text' },
      { key: 'gas_safe_ref', label: 'Gas Safe Ref', type: 'text' },
      { key: 'heating_type', label: 'Heating Type', type: 'select', options: ['Gas', 'Electric', 'Oil', 'Heat Pump', 'Other'] },
      { key: 'last_service', label: 'Last Service Date', type: 'date' },
      { key: 'access_notes', label: 'Access Notes', type: 'textarea' },
    ],
  },

  // ═══════════════════════════════════════
  // ESTATE AGENT
  // ═══════════════════════════════════════
  estate_agent: {
    stages: [
      { name: 'Valuation Booked', color: '#22c55e', position: 1 },
      { name: 'Valuation Done', color: '#3b82f6', position: 2 },
      { name: 'Instructed', color: '#8b5cf6', position: 3 },
      { name: 'Listed', color: '#06b6d4', position: 4 },
      { name: 'Viewings', color: '#f59e0b', position: 5 },
      { name: 'Offer Received', color: '#f97316', position: 6 },
      { name: 'Under Offer', color: '#14b8a6', position: 7 },
      { name: 'Exchanged', color: '#10b981', position: 8 },
      { name: 'Completed', color: '#059669', position: 9 },
      { name: 'Withdrawn', color: '#ef4444', position: 10 },
    ],
    event_types: [
      { key: 'valuation', label: 'Valuation', color: '#8b5cf6' },
      { key: 'viewing', label: 'Viewing', color: '#3b82f6' },
      { key: 'open_day', label: 'Open Day', color: '#f59e0b' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'meeting', label: 'Meeting', color: '#14b8a6' },
      { key: 'inspection', label: 'Property Inspection', color: '#f97316' },
      { key: 'photography', label: 'Photography', color: '#ec4899' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_address', label: 'Property Address', type: 'textarea' },
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', options: ['1', '2', '3', '4', '5', '6+'] },
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['Detached', 'Semi-Detached', 'Terraced', 'Flat', 'Bungalow', 'Cottage', 'Other'] },
      { key: 'asking_price', label: 'Asking Price', type: 'number' },
      { key: 'chain_status', label: 'Chain Status', type: 'select', options: ['No Chain', 'Chain - Proceeding', 'Chain - Stuck', 'First Time Buyer', 'Cash Buyer'] },
      { key: 'tenure', label: 'Tenure', type: 'select', options: ['Freehold', 'Leasehold', 'Share of Freehold'] },
      { key: 'epc_rating', label: 'EPC Rating', type: 'select', options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
    ],
  },

  // ═══════════════════════════════════════
  // CLEANING
  // ═══════════════════════════════════════
  cleaning: {
    stages: [
      { name: 'New Enquiry', color: '#22c55e', position: 1 },
      { name: 'Quote Sent', color: '#3b82f6', position: 2 },
      { name: 'Booked', color: '#8b5cf6', position: 3 },
      { name: 'Recurring', color: '#06b6d4', position: 4 },
      { name: 'Completed', color: '#10b981', position: 5 },
      { name: 'Paused', color: '#f59e0b', position: 6 },
      { name: 'Lost', color: '#ef4444', position: 7 },
    ],
    event_types: [
      { key: 'clean', label: 'Clean', color: '#3b82f6' },
      { key: 'deep_clean', label: 'Deep Clean', color: '#8b5cf6' },
      { key: 'end_of_tenancy', label: 'End of Tenancy', color: '#f97316' },
      { key: 'quote_visit', label: 'Quote Visit', color: '#f59e0b' },
      { key: 'carpet_clean', label: 'Carpet Clean', color: '#14b8a6' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'property_type', label: 'Property Type', type: 'select', options: ['House', 'Flat', 'Office', 'Commercial', 'Airbnb', 'Other'] },
      { key: 'bedrooms', label: 'Bedrooms', type: 'select', options: ['Studio', '1', '2', '3', '4', '5+'] },
      { key: 'frequency', label: 'Cleaning Frequency', type: 'select', options: ['One-off', 'Weekly', 'Fortnightly', 'Monthly'] },
      { key: 'access_method', label: 'Access Method', type: 'select', options: ['Customer home', 'Key safe', 'Key held', 'Concierge'] },
      { key: 'special_requirements', label: 'Special Requirements', type: 'textarea' },
      { key: 'pets', label: 'Pets', type: 'select', options: ['None', 'Dog', 'Cat', 'Multiple', 'Other'] },
    ],
  },

  // ═══════════════════════════════════════
  // VETERINARY
  // ═══════════════════════════════════════
  vet: {
    stages: [
      { name: 'New Patient', color: '#22c55e', position: 1 },
      { name: 'Consultation Booked', color: '#3b82f6', position: 2 },
      { name: 'Awaiting Results', color: '#f59e0b', position: 3 },
      { name: 'Treatment Plan', color: '#8b5cf6', position: 4 },
      { name: 'Ongoing Treatment', color: '#06b6d4', position: 5 },
      { name: 'Recovered', color: '#10b981', position: 6 },
      { name: 'Follow Up Required', color: '#f97316', position: 7 },
    ],
    event_types: [
      { key: 'consultation', label: 'Consultation', color: '#3b82f6' },
      { key: 'surgery', label: 'Surgery', color: '#ef4444' },
      { key: 'vaccination', label: 'Vaccination', color: '#22c55e' },
      { key: 'checkup', label: 'Check-up', color: '#8b5cf6' },
      { key: 'emergency', label: 'Emergency', color: '#f97316' },
      { key: 'dental', label: 'Dental', color: '#06b6d4' },
      { key: 'grooming', label: 'Grooming', color: '#ec4899' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'pet_name', label: 'Pet Name', type: 'text' },
      { key: 'species', label: 'Species', type: 'select', options: ['Dog', 'Cat', 'Rabbit', 'Bird', 'Reptile', 'Small Animal', 'Other'] },
      { key: 'breed', label: 'Breed', type: 'text' },
      { key: 'pet_age', label: 'Pet Age', type: 'text' },
      { key: 'weight_kg', label: 'Weight (kg)', type: 'number' },
      { key: 'microchip', label: 'Microchip Number', type: 'text' },
      { key: 'allergies', label: 'Known Allergies', type: 'textarea' },
      { key: 'insurance', label: 'Pet Insurance', type: 'select', options: ['None', 'Petplan', 'Direct Line', 'More Than', 'Other'] },
    ],
  },

  // ═══════════════════════════════════════
  // DENTAL
  // ═══════════════════════════════════════
  dental: {
    stages: [
      { name: 'New Patient', color: '#22c55e', position: 1 },
      { name: 'Assessment Booked', color: '#3b82f6', position: 2 },
      { name: 'Treatment Plan Sent', color: '#8b5cf6', position: 3 },
      { name: 'Treatment Accepted', color: '#06b6d4', position: 4 },
      { name: 'In Treatment', color: '#f59e0b', position: 5 },
      { name: 'Treatment Complete', color: '#10b981', position: 6 },
      { name: 'Recall Due', color: '#f97316', position: 7 },
    ],
    event_types: [
      { key: 'checkup', label: 'Check-up', color: '#3b82f6' },
      { key: 'hygiene', label: 'Hygiene', color: '#22c55e' },
      { key: 'treatment', label: 'Treatment', color: '#8b5cf6' },
      { key: 'consultation', label: 'Consultation', color: '#06b6d4' },
      { key: 'emergency', label: 'Emergency', color: '#ef4444' },
      { key: 'cosmetic', label: 'Cosmetic', color: '#ec4899' },
      { key: 'xray', label: 'X-Ray', color: '#f59e0b' },
      { key: 'callback', label: 'Callback', color: '#f97316' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'nhs_number', label: 'NHS Number', type: 'text' },
      { key: 'patient_type', label: 'Patient Type', type: 'select', options: ['NHS', 'Private', 'NHS Exempt', 'Plan Member'] },
      { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
      { key: 'medical_conditions', label: 'Medical Conditions', type: 'textarea' },
      { key: 'allergies', label: 'Allergies', type: 'textarea' },
      { key: 'last_xray', label: 'Last X-Ray Date', type: 'date' },
      { key: 'dentist', label: 'Assigned Dentist', type: 'text' },
    ],
  },

  // ═══════════════════════════════════════
  // RETAIL
  // ═══════════════════════════════════════
  retail: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Interested', color: '#3b82f6', position: 2 },
      { name: 'Quote Requested', color: '#8b5cf6', position: 3 },
      { name: 'Order Placed', color: '#06b6d4', position: 4 },
      { name: 'Processing', color: '#f59e0b', position: 5 },
      { name: 'Dispatched', color: '#14b8a6', position: 6 },
      { name: 'Delivered', color: '#10b981', position: 7 },
      { name: 'Returned', color: '#ef4444', position: 8 },
    ],
    event_types: [
      { key: 'delivery', label: 'Delivery', color: '#22c55e' },
      { key: 'collection', label: 'Collection', color: '#3b82f6' },
      { key: 'consultation', label: 'Consultation', color: '#8b5cf6' },
      { key: 'fitting', label: 'Fitting/Install', color: '#f97316' },
      { key: 'callback', label: 'Callback', color: '#f59e0b' },
      { key: 'return', label: 'Return/Exchange', color: '#ef4444' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'customer_type', label: 'Customer Type', type: 'select', options: ['Retail', 'Trade', 'Wholesale', 'VIP'] },
      { key: 'company_name', label: 'Company Name', type: 'text' },
      { key: 'vat_number', label: 'VAT Number', type: 'text' },
      { key: 'delivery_address', label: 'Delivery Address', type: 'textarea' },
      { key: 'preferred_contact', label: 'Preferred Contact Method', type: 'select', options: ['Phone', 'Email', 'WhatsApp', 'Text'] },
    ],
  },

  // ═══════════════════════════════════════
  // SALON / BEAUTY
  // ═══════════════════════════════════════
  salon: {
    stages: [
      { name: 'New Client', color: '#22c55e', position: 1 },
      { name: 'Consultation Booked', color: '#ec4899', position: 2 },
      { name: 'Patch Test Done', color: '#8b5cf6', position: 3 },
      { name: 'Regular Client', color: '#06b6d4', position: 4 },
      { name: 'VIP Client', color: '#f59e0b', position: 5 },
      { name: 'Inactive', color: '#6b7280', position: 6 },
    ],
    event_types: [
      { key: 'cut', label: 'Cut', color: '#3b82f6' },
      { key: 'colour', label: 'Colour', color: '#ec4899' },
      { key: 'treatment', label: 'Treatment', color: '#8b5cf6' },
      { key: 'consultation', label: 'Consultation', color: '#f59e0b' },
      { key: 'nails', label: 'Nails', color: '#f97316' },
      { key: 'facial', label: 'Facial', color: '#14b8a6' },
      { key: 'wax', label: 'Waxing', color: '#06b6d4' },
      { key: 'callback', label: 'Callback', color: '#22c55e' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'hair_type', label: 'Hair Type', type: 'select', options: ['Straight', 'Wavy', 'Curly', 'Coily', 'N/A'] },
      { key: 'colour_history', label: 'Colour History', type: 'textarea' },
      { key: 'allergies', label: 'Allergies / Sensitivities', type: 'textarea' },
      { key: 'patch_test_date', label: 'Last Patch Test', type: 'date' },
      { key: 'preferred_stylist', label: 'Preferred Stylist', type: 'text' },
      { key: 'rebooking', label: 'Rebooking Frequency', type: 'select', options: ['4 weeks', '6 weeks', '8 weeks', '12 weeks', 'Ad hoc'] },
    ],
  },

  // ═══════════════════════════════════════
  // GENERIC / DEFAULT
  // ═══════════════════════════════════════
  default: {
    stages: [
      { name: 'New Lead', color: '#22c55e', position: 1 },
      { name: 'Contacted', color: '#3b82f6', position: 2 },
      { name: 'Proposal Sent', color: '#8b5cf6', position: 3 },
      { name: 'Negotiation', color: '#f59e0b', position: 4 },
      { name: 'Won', color: '#10b981', position: 5 },
      { name: 'Lost', color: '#ef4444', position: 6 },
    ],
    event_types: [
      { key: 'meeting', label: 'Meeting', color: '#3b82f6' },
      { key: 'call', label: 'Call', color: '#8b5cf6' },
      { key: 'follow_up', label: 'Follow Up', color: '#f59e0b' },
      { key: 'site_visit', label: 'Site Visit', color: '#22c55e' },
      { key: 'callback', label: 'Callback', color: '#06b6d4' },
      { key: 'other', label: 'Other', color: '#6b7280' },
    ],
    customer_fields: [
      { key: 'company_name', label: 'Company Name', type: 'text' },
      { key: 'job_title', label: 'Job Title', type: 'text' },
      { key: 'preferred_contact', label: 'Preferred Contact', type: 'select', options: ['Phone', 'Email', 'WhatsApp'] },
    ],
  },
};

export function getSeedData(templateType: string): TemplateSeed {
  return seeds[templateType] || seeds.default;
}

export default seeds;