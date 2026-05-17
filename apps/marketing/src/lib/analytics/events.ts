export const MARKETING_EVENTS = {
  PAGE_VIEWED: "page_viewed",
  CTA_CLICKED: "cta_click",
  DEMO_REQUEST_STARTED: "demo_request_started",
  DEMO_REQUEST_SUBMITTED: "demo_request_submitted",
  WAITLIST_STARTED: "waitlist_started",
  WAITLIST_SUBMITTED: "waitlist_submitted",
  CONTACT_SUBMITTED: "contact_submitted",
  PRICING_VIEWED: "pricing_viewed",
  PARENT_PAGE_VIEWED: "parent_page_viewed",
  SCHOOL_PAGE_VIEWED: "school_page_viewed",
  DISTRICT_PAGE_VIEWED: "district_page_viewed",
  SPECIAL_ED_PAGE_VIEWED: "special_ed_page_viewed",
  FEATURE_PAGE_VIEWED: "feature_page_viewed",
  TRUST_PAGE_VIEWED: "trust_page_viewed",
  MOBILE_MENU_OPENED: "mobile_menu_opened",
  FORM_VALIDATION_FAILED: "form_validation_failed",
  FORM_SUBMISSION_FAILED: "form_submission_failed",
  THANK_YOU_VIEWED: "thank_you_viewed",
  SIGNUP_INITIATED: "signup_initiation",
  PRICING_SELECTION: "pricing_selection",
} as const;

export type MarketingEventName = (typeof MARKETING_EVENTS)[keyof typeof MARKETING_EVENTS];

export type MarketingEventPayload = {
  page?: string;
  audience?: "parent" | "school" | "district" | "teacher" | "special_ed" | "general";
  cta_label?: string;
  source_route?: string;
  form_type?: "demo" | "waitlist" | "contact" | "signup";
  destination?: string;
  organization?: string;
  failure_reason?: string;
};

export const TRACKING_RULES = {
  excludeFields: ["learner_name", "learner_pii", "iep_content", "chat_transcript", "brain_clone_state"] as const,
  respectsCookieConsent: true,
};
