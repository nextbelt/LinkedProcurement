export interface RFQLineItem {
  id: string;
  rfq_id: string;
  line_number: number;
  description: string;
  part_number?: string;
  quantity?: number;
  unit_of_measure?: string;
  target_unit_price?: number;
  currency: string;
  specifications?: string;
  required_certifications: string[];
  attachments: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItem {
  id: string;
  response_id: string;
  line_item_id: string;
  unit_price?: number;
  total_price?: number;
  currency: string;
  lead_time_days?: number;
  moq?: number;
  notes?: string;
  is_compliant: boolean;
  exceptions: string[];
  created_at: string;
}

export interface RFQInvitation {
  id: string;
  rfq_id: string;
  supplier_company_id: string;
  supplier_company_name?: string;
  invited_by?: string;
  status: 'pending' | 'viewed' | 'responded' | 'declined';
  message?: string;
  invited_at: string;
  viewed_at?: string;
  responded_at?: string;
}

export interface RFQAward {
  id: string;
  rfq_id: string;
  response_id: string;
  awarded_by?: string;
  awarded_at: string;
  po_number?: string;
  award_notes?: string;
  total_value?: number;
  currency: string;
  status: 'awarded' | 'accepted' | 'declined' | 'cancelled';
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data: Record<string, any>;
  is_read: boolean;
  read_at?: string;
  action_url?: string;
  created_at: string;
}

export interface QuoteComparison {
  rfq_id: string;
  line_items: {
    line_item: RFQLineItem;
    quotes: {
      response_id: string;
      supplier_company_name: string;
      quote_item: QuoteLineItem;
    }[];
  }[];
}

export type RFQStatus = 'draft' | 'published' | 'evaluation' | 'closed' | 'awarded';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id?: string;
  logo_url?: string;
  plan_tier: string;
  is_active: boolean;
  created_at: string;
}
