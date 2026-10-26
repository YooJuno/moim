export const TELEMETRY_KINDS = ['auth','data','runtime','promise','render','handled','resource','network','server'] as const;
export const TELEMETRY_CONTEXTS = [
  'google-signin','member-bootstrap','auth-state','subscription-members','subscription-profiles','subscription-posts',
  'subscription-comments','subscription-polls','subscription-votes','subscription-events','subscription-rsvps',
  'subscription-ledger','subscription-ballots','subscription-ballotResponses','subscription-mvpVotes','subscription-places',
  'subscription-settings','subscription-bylaws','operation','window-error','unhandled-rejection','render','asset-load',
  'social-auth','server-request',
] as const;
export const TELEMETRY_UI_ROUTES = ['/','/login','/polls','/calendar','/board','/members','/places','/rules','/ledger','/profile','/settings','/auth/callback','/invite','unknown'] as const;
export const TELEMETRY_SERVER_ROUTES = ['/config','/places/search','/oauth/start','/oauth/callback','/oauth/link','/oauth/exchange','/account/providers','/calendar/add','/sms/preview','/sms/send','unknown'] as const;
export const TELEMETRY_ROUTES = [...TELEMETRY_UI_ROUTES,...TELEMETRY_SERVER_ROUTES] as const;
export const TELEMETRY_BROWSERS = ['kakao','chrome','safari','firefox','edge','samsung','other'] as const;
export const TELEMETRY_DEVICES = ['mobile','desktop'] as const;
export const TELEMETRY_AUTH_CODES = [
  'auth/popup-blocked','auth/popup-closed-by-user','auth/cancelled-popup-request','auth/network-request-failed',
  'auth/unauthorized-domain','auth/operation-not-allowed','auth/configuration-not-found','auth/invalid-api-key',
  'auth/app-not-authorized','auth/invalid-app-credential','auth/invalid-credential','auth/invalid-user-token',
  'auth/user-token-expired','auth/user-disabled','auth/user-not-found','auth/too-many-requests','auth/internal-error',
  'auth/timeout','auth/web-storage-unsupported','auth/operation-not-supported-in-this-environment','auth/argument-error',
  'auth/account-exists-with-different-credential','auth/credential-already-in-use','auth/provider-already-linked',
  'auth/requires-recent-login','auth/redirect-cancelled-by-user','auth/redirect-operation-pending','auth/missing-initial-state',
  'auth/member-load-timeout','auth/auth-state-timeout','auth/session-changed',
] as const;
export const TELEMETRY_DATA_CODES = ['permission-denied','unavailable','deadline-exceeded','unauthenticated','resource-exhausted','failed-precondition','internal','unknown','not-found','already-exists','aborted','cancelled','invalid-argument','data-loss','out-of-range','unimplemented'] as const;
export const TELEMETRY_JS_CODES = ['type-error','reference-error','syntax-error','range-error','chunk-load-failed','network-error','application-error','unknown-error'] as const;
export const TELEMETRY_SERVER_CODES = [
  'internal_error', 'concurrent_update', 'concurrent_write', 'rate_limited', 'invalid_return_origin', 'origin_not_allowed',
  'invalid_worker_origin', 'unknown_provider', 'invalid_challenge', 'json_required', 'body_too_large', 'invalid_json',
  'firebase_auth_required', 'invalid_firebase_uid', 'already_consumed', 'firebase_account_unavailable',
  'provider_already_linked', 'account_provider_conflict', 'firebase_account_deleted', 'identity_uid_conflict',
  'firebase_account_disabled', 'account_link_busy', 'readable_membership_required', 'provider_not_configured',
  'invalid_state', 'invalid_or_expired_state', 'oauth_cancelled', 'oauth_failed', 'provider_code_missing', 'auth_not_configured',
  'invalid_exchange', 'expired_exchange', 'origin_mismatch', 'invalid_verifier', 'link_user_mismatch',
  'kakao_calendar_not_configured', 'active_membership_required', 'event_attendance_required',
  'kakao_calendar_consent_required', 'kakao_reconnect_required', 'kakao_time_requires_five_minutes',
  'calendar_sync_in_progress', 'calendar_sync_needs_reconciliation', 'calendar_sync_conflict',
  'origin_required', 'use_authenticated_link_start', 'not_found',
  'invalid_encoding', 'invalid_encryption_key', 'unsupported_token_version', 'token_decryption_failed',
  'provider_authorization_failed', 'provider_identity_failed', 'kakao_calendar_failed',
  'invalid_place_query', 'naver_search_not_configured', 'naver_search_rate_limited', 'naver_search_failed', 'naver_search_timeout',
  'sms_admin_required', 'sms_unavailable', 'event_not_found', 'sms_audience_too_large', 'sms_message_too_long',
  'sms_preview_stale', 'sms_not_enabled', 'sms_auto_disabled',
  'firebase_not_configured', 'service_auth_failed', 'invalid_uid', 'firebase_account_failed', 'invalid_document_value',
  'invalid_document_path', 'database_unavailable', 'invalid_query', 'invalid_firebase_token', 'token_verification_unavailable',
  'telemetry_invalid_report', 'telemetry_body_too_large', 'telemetry_not_enabled', 'telemetry_admin_required',
] as const;
export const TELEMETRY_CLIENT_CODES: readonly string[] = [...TELEMETRY_AUTH_CODES,...TELEMETRY_DATA_CODES,...TELEMETRY_DATA_CODES.map(code=>`firestore/${code}`),...TELEMETRY_JS_CODES];
export const TELEMETRY_CODES: readonly string[] = [...TELEMETRY_CLIENT_CODES,...TELEMETRY_SERVER_CODES];

export type TelemetryKind = typeof TELEMETRY_KINDS[number];
export type TelemetryContext = typeof TELEMETRY_CONTEXTS[number];
export type TelemetryRoute = typeof TELEMETRY_ROUTES[number];
export type TelemetryBrowser = typeof TELEMETRY_BROWSERS[number];
export type TelemetryDevice = typeof TELEMETRY_DEVICES[number];
export interface TelemetryFrame {file:string;line:number;column:number}
export interface TelemetryReport {
  kind:TelemetryKind;
  code:string;
  context:TelemetryContext;
  route:TelemetryRoute;
  release:string;
  frames?:TelemetryFrame[];
  browser?:TelemetryBrowser;
  device?:TelemetryDevice;
}
export interface ErrorLogEntry extends TelemetryReport {
  id:string;
  source:'client'|'server';
  fingerprint:string;
  count:number;
  firstSeenAt:string;
  lastSeenAt:string;
  httpStatus?:number;
}
export interface ErrorLogResponse {errors:ErrorLogEntry[];enabled:boolean}
