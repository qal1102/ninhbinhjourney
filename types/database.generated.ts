/**
 * Schema snapshot for migrations `202607240001` through `202607290006`.
 *
 * This file follows Supabase CLI's generated Database shape. It is kept beside
 * the versioned migration so a linked-project `supabase gen types typescript`
 * run can replace it without changing application imports.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert = Partial<Row>, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type ReferenceRow = {
  id: string;
  tenant_id: string;
  created_at: string;
};

type RunRow = {
  id: string;
  tenant_id: string;
  demo_run_id: string;
};

export type TenantRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
};

export type RegionRow = ReferenceRow & {
  name: string;
  slug: string;
  scope_type: string;
  map_bounds: Json;
  default_locale: string;
};

export type OperatorRow = ReferenceRow & {
  name: string;
  slug: string;
  operator_type: string;
};

export type SiteRow = ReferenceRow & {
  region_id: string;
  operator_id: string;
  name: string;
  slug: string;
  latitude: number;
  longitude: number;
  tags: string[];
  mobility_level: string;
  suggested_minutes: number;
  demo_opening_windows: Json;
  content_source_ids: string[];
  source_url: string | null;
  source_reviewed_at: string | null;
};

export type CampaignRow = ReferenceRow & {
  region_id: string;
  name: string;
  slug: string;
  campaign_type: string;
  status: string;
};

export type QrSourceRow = ReferenceRow & {
  region_id: string;
  campaign_id: string;
  site_id: string | null;
  code: string;
  placement_label: string;
};

export type ProductRow = ReferenceRow & {
  region_id: string;
  name: string;
  slug: string;
  product_type: string;
  ledger_type: string;
  demo_price_vnd: number;
  duration_minutes: number;
  entitlement_templates: Json;
  active: boolean;
};

export type SopRow = ReferenceRow & {
  code: string;
  title: string;
  category: string;
  summary: string;
  steps: Json;
  approval_policy: string;
  source_document: string;
  source_page: number | null;
  approval_note: string;
};

export type DemoRunRow = ReferenceRow & {
  region_id: string;
  operator_id: string;
  owner_user_id: string;
  label: string;
  status: string;
  expires_at: string;
  updated_at: string;
};

export type DemoRunMemberRow = {
  demo_run_id: string;
  tenant_id: string;
  user_id: string;
  campaign_id: string | null;
  qr_source_id: string | null;
  role: string;
  status: string;
  joined_at: string;
};

export type CapacitySlotRow = RunRow & {
  site_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  reserved: number;
  checked_in: number;
  status: string;
  updated_by: string | null;
  updated_at: string;
};

export type JourneyIntentRow = RunRow & {
  created_by: string;
  locale: string;
  raw_text: string;
  structured_intent: Json;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ItineraryRow = RunRow & {
  region_id: string;
  intent_id: string;
  created_by: string;
  total_minutes: number;
  estimated_price_vnd: number;
  validation: Json;
  explanation: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type QuoteRow = RunRow & {
  created_by: string;
  itinerary_id: string | null;
  slot_date: string;
  party_size: number;
  selections: Json;
  subtotal_vnd: number;
  total_vnd: number;
  currency: string;
  status: string;
  expires_at: string;
  created_at: string;
};

export type BookingRow = RunRow & {
  region_id: string;
  operator_id: string;
  created_by: string;
  quote_id: string;
  itinerary_id: string | null;
  campaign_id: string | null;
  qr_source_id: string | null;
  code: string;
  status: string;
  visit_date: string;
  customer_display_name: string;
  masked_contact: string;
  party_size: number;
  subtotal_vnd: number;
  total_vnd: number;
  currency: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
};

export type PaymentIntentRow = RunRow & {
  created_by: string;
  quote_id: string;
  booking_id: string | null;
  provider: string;
  provider_intent_id: string;
  callback_secret_hash: string;
  mode: string;
  status: string;
  amount_vnd: number;
  currency: string;
  idempotency_key: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
};

export type PassRow = RunRow & {
  booking_id: string;
  created_by: string;
  token_hash: string;
  token_hint: string;
  status: string;
  issued_at: string;
  expires_at: string;
};

export type IncidentRow = RunRow & {
  region_id: string;
  site_id: string;
  category: string;
  severity: string;
  status: string;
  transcript: string;
  summary: string;
  wait_time_minutes: number | null;
  sop_id: string | null;
  created_by: string;
  confirmed_by: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditEventRow = RunRow & {
  actor_user_id: string | null;
  actor_kind: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Json;
  created_at: string;
};

export type ErpSiteAssignmentRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  user_id: string;
  module_ids: string[];
  status: string;
  assigned_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpAttendanceEventRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  user_id: string;
  event_type: string;
  latitude: number | null;
  longitude: number | null;
  accuracy_meters: number | null;
  source: string;
  happened_at: string;
  created_at: string;
};

export type ErpOperationalSignalRow = {
  id: string;
  tenant_id: string;
  site_id: string | null;
  signal_type: string;
  severity: string;
  title: string;
  summary: string;
  payload: Json;
  source_system: string;
  external_event_id: string | null;
  happened_at: string;
  created_by: string | null;
  created_at: string;
};

export type ErpFinanceLedgerEntryRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  entry_type: string;
  channel: string;
  amount_vnd: number;
  currency: string;
  reconciliation_status: string;
  source_system: string;
  external_reference: string | null;
  metadata: Json;
  occurred_at: string;
  reconciled_at: string | null;
  reconciled_by: string | null;
  created_at: string;
};

export type ErpDecisionItemRow = {
  id: string;
  tenant_id: string;
  site_id: string | null;
  priority: string;
  status: string;
  title: string;
  summary: string;
  recommended_action: string | null;
  source_signal_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpCameraSourceRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  zone: string;
  provider: string;
  stream_kind: string;
  stream_reference: string;
  capabilities: string[];
  status: string;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpCameraEventRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  camera_source_id: string;
  event_type: string;
  severity: string;
  confidence: number | null;
  anonymous_count: number | null;
  snapshot_path: string | null;
  payload: Json;
  status: string;
  occurred_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  created_at: string;
};

export type ErpProjectRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  name: string;
  project_type: string;
  status: string;
  starts_on: string | null;
  ends_on: string | null;
  budget_vnd: number;
  committed_vnd: number;
  expected_guests: number | null;
  progress_percent: number;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpProjectWorkItemRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  project_id: string;
  code: string;
  title: string;
  workstream: string;
  priority: string;
  status: string;
  owner_user_id: string | null;
  due_at: string | null;
  progress_percent: number;
  escalation_level: string;
  evidence: Json;
  created_at: string;
  updated_at: string;
};

export type ErpFieldReportRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  reporter_user_id: string;
  work_item_id: string | null;
  area: string;
  category: string;
  task_title: string;
  progress_percent: number;
  finance_code: string;
  note: string;
  image_paths: string[];
  status: string;
  captured_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ErpTicketScanRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  qr_token_hash: string;
  booking_reference: string | null;
  gate_code: string;
  product_code: string | null;
  quantity: number;
  result: string;
  reason: string | null;
  recorded_by: string;
  scanned_at: string;
};

export type ErpTicketShiftClosureRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  employee_user_id: string;
  shift_started_at: string;
  shift_ended_at: string;
  tickets_sold: number;
  product_mix: Json;
  cash_vnd: number;
  card_transfer_vnd: number;
  refund_vnd: number;
  difference_vnd: number;
  finance_code: string;
  note: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ErpPartnerRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  code: string;
  name: string;
  partner_type: string;
  owner_user_id: string | null;
  status: string;
  payment_terms_days: number;
  created_at: string;
  updated_at: string;
};

export type ErpPartnerDocumentRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  partner_id: string;
  document_type: string;
  document_number: string | null;
  storage_path: string;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  uploaded_by: string;
  reviewed_by: string | null;
  created_at: string;
};

export type ErpPartnerQuoteRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  partner_id: string;
  quote_code: string;
  product_snapshot: Json;
  quantity: number;
  subtotal_vnd: number;
  discount_vnd: number;
  total_vnd: number;
  terms: string;
  valid_until: string;
  status: string;
  created_by: string;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpPartnerFeedbackRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  partner_id: string | null;
  source: string;
  customer_reference: string | null;
  content: string;
  priority: string;
  status: string;
  assigned_to: string | null;
  response: string | null;
  response_due_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpShiftCloseWorkflowRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  business_code: string;
  shift_date: string;
  shift_label: string;
  station_code: string;
  employee_account_id: string;
  employee_display_name: string;
  shift_started_at: string;
  shift_ended_at: string;
  tickets_sold: number;
  tickets_checked_in: number;
  tickets_refunded: number;
  tickets_voided: number;
  product_mix: Json;
  cash_vnd: number;
  card_vnd: number;
  bank_transfer_vnd: number;
  qr_vnd: number;
  gross_sales_vnd: number;
  refund_vnd: number;
  net_sales_vnd: number;
  expected_settlement_vnd: number;
  actual_settlement_vnd: number;
  difference_vnd: number;
  finance_code: string;
  evidence: Json;
  note: string;
  status: string;
  version: number;
  idempotency_key: string;
  submitted_at: string | null;
  manager_account_id: string | null;
  manager_display_name: string | null;
  manager_decision: string | null;
  manager_note: string | null;
  manager_reviewed_at: string | null;
  accountant_account_id: string | null;
  accountant_display_name: string | null;
  accountant_decision: string | null;
  accountant_note: string | null;
  accountant_reviewed_at: string | null;
  director_account_id: string | null;
  director_display_name: string | null;
  director_decision: string | null;
  director_note: string | null;
  director_reviewed_at: string | null;
  review_metadata: Json;
  created_by_account_id: string;
  created_by_role: string;
  updated_by_account_id: string;
  updated_by_role: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpShiftCloseAuditEventRow = {
  id: string;
  workflow_id: string;
  tenant_id: string;
  site_id: string;
  sequence_number: number;
  event_type: string;
  from_status: string | null;
  to_status: string;
  actor_account_id: string;
  actor_display_name: string;
  actor_role: string;
  note: string;
  metadata: Json;
  idempotency_key: string;
  occurred_at: string;
  created_at: string;
};

export type ErpAccountRegistryRow = {
  account_id: string;
  tenant_id: string;
  auth_user_id: string | null;
  display_name: string;
  job_title: string;
  employment_type: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ErpAccountRoleAssignmentRow = {
  id: string;
  tenant_id: string;
  account_id: string;
  role: string;
  site_id: string | null;
  effective_from: string;
  effective_until: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ErpAccountingPeriodRow = {
  id: string;
  tenant_id: string;
  period_key: string;
  starts_on: string;
  ends_on: string;
  status: string;
  version: number;
  locked_by_account_id: string | null;
  locked_at: string | null;
  lock_reason: string | null;
  reopened_by_account_id: string | null;
  reopened_at: string | null;
  reopen_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpAccountingJournalRow = {
  id: string;
  tenant_id: string;
  site_id: string;
  journal_code: string;
  source_type: string;
  source_workflow_id: string;
  source_version: number;
  business_date: string;
  period_key: string;
  status: string;
  version: number;
  maker_account_id: string;
  maker_note: string;
  checker_account_id: string | null;
  checker_note: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  posted_at: string | null;
  reversal_of_journal_id: string | null;
  supersedes_journal_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ErpAccountingJournalLineRow = {
  id: string;
  journal_id: string;
  tenant_id: string;
  site_id: string;
  line_number: number;
  account_code: string;
  account_name: string;
  debit_vnd: number;
  credit_vnd: number;
  dimensions: Json;
  created_at: string;
};

export type ErpAccountingAuditEventRow = {
  id: string;
  tenant_id: string;
  site_id: string | null;
  entity_type: string;
  entity_id: string;
  sequence_number: number;
  event_type: string;
  actor_account_id: string;
  actor_role: string;
  from_status: string | null;
  to_status: string;
  note: string;
  metadata: Json;
  idempotency_key: string;
  request_hash: string;
  occurred_at: string;
  created_at: string;
};

export type ErpAccountingCommandReceiptRow = {
  id: string;
  tenant_id: string;
  command_scope: string;
  idempotency_key: string;
  actor_account_id: string;
  request_hash: string;
  entity_type: string;
  entity_id: string;
  resulting_version: number;
  response: Json;
  created_at: string;
};

export interface Database {
  public: {
    Tables: {
      tenants: Table<TenantRow>;
      regions: Table<RegionRow>;
      operators: Table<OperatorRow>;
      sites: Table<SiteRow>;
      campaigns: Table<CampaignRow>;
      qr_sources: Table<QrSourceRow>;
      products: Table<ProductRow>;
      product_sites: Table<{
        product_id: string;
        site_id: string;
        stop_order: number;
      }>;
      sops: Table<SopRow>;
      user_profiles: Table<{
        user_id: string;
        display_name: string;
        locale: string;
        created_at: string;
        updated_at: string;
      }>;
      tenant_memberships: Table<{
        id: string;
        tenant_id: string;
        user_id: string;
        role: string;
        status: string;
        created_at: string;
      }>;
      demo_runs: Table<DemoRunRow>;
      demo_run_members: Table<DemoRunMemberRow>;
      demo_join_tokens: Table<{
        id: string;
        demo_run_id: string;
        tenant_id: string;
        qr_source_id: string | null;
        token_hash: string;
        intended_role: string;
        expires_at: string;
        used_at: string | null;
        used_by: string | null;
        revoked_at: string | null;
        created_by: string;
        created_at: string;
      }>;
      capacity_slots: Table<CapacitySlotRow>;
      journey_intents: Table<JourneyIntentRow>;
      itineraries: Table<ItineraryRow>;
      itinerary_items: Table<RunRow & {
        itinerary_id: string;
        site_id: string;
        created_by: string;
        item_order: number;
        start_at: string;
        end_at: string;
        travel_minutes_from_previous: number;
        reason: string;
      }>;
      quotes: Table<QuoteRow>;
      bookings: Table<BookingRow>;
      booking_contacts: Table<{
        booking_id: string;
        tenant_id: string;
        demo_run_id: string;
        created_by: string;
        contact_kind: string;
        contact_value: string;
        consent_at: string;
      }>;
      booking_lines: Table<RunRow & {
        booking_id: string;
        product_id: string;
        quantity: number;
        unit_price_vnd: number;
        total_vnd: number;
        ledger_type: string;
      }>;
      payment_intents: Table<PaymentIntentRow>;
      payment_events: Table<RunRow & {
        payment_intent_id: string;
        provider: string;
        provider_event_id: string;
        event_type: string;
        payload_digest: string;
        received_at: string;
        processed_at: string | null;
      }>;
      passes: Table<PassRow>;
      pass_entitlements: Table<RunRow & {
        pass_id: string;
        site_id: string;
        product_id: string;
        quantity: number;
        redeemed_quantity: number;
      }>;
      redemptions: Table<RunRow & {
        pass_id: string;
        entitlement_id: string;
        site_id: string;
        quantity: number;
        actor_user_id: string;
        idempotency_key: string;
        created_at: string;
      }>;
      incidents: Table<IncidentRow>;
      resource_requests: Table<RunRow & {
        incident_id: string;
        resource_type: string;
        quantity: number;
        status: string;
        requested_by: string;
        assigned_to: string | null;
        created_at: string;
        updated_at: string;
      }>;
      audit_events: Table<AuditEventRow>;
      analytics_events: Table<RunRow & {
        actor_user_id: string | null;
        event_type: string;
        campaign_id: string | null;
        qr_source_id: string | null;
        entity_type: string | null;
        entity_id: string | null;
        metadata: Json;
        created_at: string;
      }>;
      erp_site_assignments: Table<ErpSiteAssignmentRow>;
      erp_attendance_events: Table<ErpAttendanceEventRow>;
      erp_operational_signals: Table<ErpOperationalSignalRow>;
      erp_finance_ledger_entries: Table<ErpFinanceLedgerEntryRow>;
      erp_decision_items: Table<ErpDecisionItemRow>;
      erp_camera_sources: Table<ErpCameraSourceRow>;
      erp_camera_events: Table<ErpCameraEventRow>;
      erp_projects: Table<ErpProjectRow>;
      erp_project_work_items: Table<ErpProjectWorkItemRow>;
      erp_field_reports: Table<ErpFieldReportRow>;
      erp_ticket_scans: Table<ErpTicketScanRow>;
      erp_ticket_shift_closures: Table<ErpTicketShiftClosureRow>;
      erp_partners: Table<ErpPartnerRow>;
      erp_partner_documents: Table<ErpPartnerDocumentRow>;
      erp_partner_quotes: Table<ErpPartnerQuoteRow>;
      erp_partner_feedback: Table<ErpPartnerFeedbackRow>;
      erp_shift_close_workflows: Table<ErpShiftCloseWorkflowRow>;
      erp_shift_close_audit_events: Table<ErpShiftCloseAuditEventRow>;
      erp_account_registry: Table<ErpAccountRegistryRow>;
      erp_account_role_assignments: Table<ErpAccountRoleAssignmentRow>;
      erp_accounting_periods: Table<ErpAccountingPeriodRow>;
      erp_accounting_journals: Table<ErpAccountingJournalRow>;
      erp_accounting_journal_lines: Table<ErpAccountingJournalLineRow>;
      erp_accounting_audit_events: Table<ErpAccountingAuditEventRow>;
      erp_accounting_command_receipts: Table<ErpAccountingCommandReceiptRow>;
      erp_push_subscriptions: Table<{
        id: string;
        user_id: string;
        endpoint: string;
        p256dh: string;
        auth_secret: string;
        user_agent: string | null;
        enabled: boolean;
        created_at: string;
        updated_at: string;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      create_demo_run: {
        Args: { p_label: string; p_expires_in_minutes?: number };
        Returns: DemoRunRow;
      };
      issue_demo_join_token: {
        Args: {
          p_demo_run_id: string;
          p_raw_token: string;
          p_qr_source_code: string;
          p_expires_in_minutes?: number;
        };
        Returns: Array<{ token_id: string; expires_at: string }>;
      };
      join_demo_run: {
        Args: { p_raw_token: string };
        Returns: Array<{
          demo_run_id: string;
          tenant_id: string;
          qr_source_code: string;
          expires_at: string;
        }>;
      };
      reset_demo_run: {
        Args: { p_demo_run_id: string };
        Returns: undefined;
      };
      save_generated_journey: {
        Args: {
          p_demo_run_id: string;
          p_locale: string;
          p_raw_text: string;
          p_structured_intent: Json;
          p_itinerary: Json;
        };
        Returns: Array<{ intent_id: string; itinerary_id: string }>;
      };
      update_saved_journey: {
        Args: {
          p_itinerary_id: string;
          p_items: Json;
          p_total_minutes: number;
          p_validation: Json;
          p_explanation: string;
        };
        Returns: undefined;
      };
      create_server_quote: {
        Args: {
          p_demo_run_id: string;
          p_itinerary_id: string | null;
          p_product_selections: Json;
          p_visit_date: string;
          p_party_size: number;
        };
        Returns: QuoteRow;
      };
      create_sandbox_payment_intent: {
        Args: {
          p_quote_id: string;
          p_idempotency_key: string;
          p_provider_intent_id: string;
          p_callback_secret: string;
        };
        Returns: PaymentIntentRow;
      };
      process_sandbox_payment: {
        Args: {
          p_payment_intent_id: string;
          p_provider_event_id: string;
          p_event_type: string;
          p_callback_secret: string;
          p_pass_token: string;
          p_customer_display_name: string;
          p_contact_kind: string;
          p_contact_value: string;
          p_consent_at: string;
        };
        Returns: Array<{
          booking_id: string | null;
          booking_code: string | null;
          pass_id: string | null;
          payment_status: string;
          was_duplicate: boolean;
        }>;
      };
      get_pass_snapshot: {
        Args: { p_raw_token: string };
        Returns: Json | null;
      };
      redeem_pass_entitlement: {
        Args: {
          p_lookup_value: string;
          p_lookup_kind: string;
          p_site_id: string | null;
          p_entitlement_id: string | null;
          p_quantity: number;
          p_idempotency_key: string;
        };
        Returns: Array<{
          ok: boolean;
          code: string;
          redemption_id: string | null;
          pass_id: string | null;
          entitlement_id: string | null;
          booking_code: string | null;
          redeemed_at: string | null;
          original_actor_user_id: string | null;
        }>;
      };
      set_capacity_slot: {
        Args: {
          p_slot_id: string;
          p_capacity: number;
          p_status: string;
        };
        Returns: CapacitySlotRow;
      };
      inspect_pass_access: {
        Args: { p_lookup_value: string; p_lookup_kind: string };
        Returns: Json;
      };
      confirm_incident_draft: {
        Args: { p_demo_run_id: string; p_draft: Json };
        Returns: IncidentRow;
      };
      update_incident_coordination: {
        Args: {
          p_incident_id: string;
          p_status: string;
          p_assigned_to: string | null;
          p_resource_status: string | null;
        };
        Returns: IncidentRow;
      };
      erp_demo_create_shift_close: {
        Args: {
          p_payload: Json;
          p_actor_account_id: string;
          p_actor_display_name: string;
          p_actor_role: string;
          p_idempotency_key: string;
        };
        Returns: ErpShiftCloseWorkflowRow;
      };
      erp_demo_transition_shift_close: {
        Args: {
          p_workflow_id: string;
          p_expected_version: number;
          p_to_status: string;
          p_actor_account_id: string;
          p_actor_display_name: string;
          p_actor_role: string;
          p_action: string;
          p_note: string;
          p_review_metadata: Json;
          p_idempotency_key: string;
        };
        Returns: ErpShiftCloseWorkflowRow;
      };
      erp_accounting_prepare_shift_close: {
        Args: {
          p_workflow_id: string;
          p_expected_source_version: number;
          p_actor_account_id: string;
          p_note: string;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: ErpAccountingJournalRow;
      };
      erp_accounting_review_journal: {
        Args: {
          p_journal_id: string;
          p_expected_version: number;
          p_actor_account_id: string;
          p_decision: string;
          p_note: string;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: ErpAccountingJournalRow;
      };
      erp_accounting_reverse_journal: {
        Args: {
          p_journal_id: string;
          p_expected_version: number;
          p_actor_account_id: string;
          p_reason: string;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: ErpAccountingJournalRow;
      };
      erp_accounting_change_period: {
        Args: {
          p_period_key: string;
          p_expected_version: number;
          p_actor_account_id: string;
          p_action: string;
          p_reason: string;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: ErpAccountingPeriodRow;
      };
      current_user_is_anonymous: { Args: never; Returns: boolean };
      has_tenant_role: {
        Args: { p_tenant_id: string; p_roles: string[] };
        Returns: boolean;
      };
      is_active_run_member: {
        Args: { p_demo_run_id: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
