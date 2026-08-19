-- ScamSense SG — human feedback capture for the URL phishing detector.
--
-- No model/detector version column: POST /api/url/predict does not return a
-- model version today, and inventing one would be worse than omitting it.
--
-- Re-runnable: every statement is guarded, and the DROP POLICY guards can only
-- ever match policies on this new table.

create table if not exists public.url_scan_feedback (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users (id) on delete cascade,

  -- Redacted in the browser by frontend/src/lib/redact-url.js, which rejects a
  -- submission rather than falling back to the raw URL. The length cap matches
  -- REDACTED_URL_MAX_LENGTH in that module.
  url_redacted text not null
    constraint url_scan_feedback_url_redacted_length
      check (char_length(url_redacted) between 1 and 2048),

  -- What the result card displayed when the report was made.
  original_verdict text not null
    constraint url_scan_feedback_original_verdict_length
      check (char_length(original_verdict) between 1 and 120),
  original_level text not null
    constraint url_scan_feedback_original_level_valid
      check (original_level in ('safe', 'warning', 'danger')),

  -- Both nullable: a result can arrive without either (Gemini unavailable, or a
  -- missing probability), and a guessed value would be worse than a null.
  ml_probability double precision
    constraint url_scan_feedback_ml_probability_range
      check (ml_probability is null or (ml_probability >= 0 and ml_probability <= 1)),
  genai_risk_level text
    constraint url_scan_feedback_genai_risk_level_valid
      check (genai_risk_level is null or genai_risk_level in ('low', 'medium', 'high')),

  -- What the user expected instead.
  corrected_level text not null
    constraint url_scan_feedback_corrected_level_valid
      check (corrected_level in ('safe', 'warning', 'danger')),

  comment text
    constraint url_scan_feedback_comment_length
      check (comment is null or char_length(comment) <= 500),

  created_at timestamptz not null default now()
);

comment on table public.url_scan_feedback is
  'User-submitted reports that a URL scan result looked wrong. Capture only: never used to retrain the model or alter predictions, and a row does not mean a human has reviewed it.';

comment on column public.url_scan_feedback.url_redacted is
  'Scheme, host, optional port and path only. Credentials, query strings and fragments are never stored.';

-- Retrieval is always "this user's feedback, newest first".
create index if not exists url_scan_feedback_user_id_created_at_idx
  on public.url_scan_feedback (user_id, created_at desc);

alter table public.url_scan_feedback enable row level security;

-- Supabase's default privileges grant new public tables to anon and
-- authenticated, so both are revoked first and only the two verbs this feature
-- needs are granted back.
revoke all on table public.url_scan_feedback from anon;
revoke all on table public.url_scan_feedback from authenticated;
grant select, insert on table public.url_scan_feedback to authenticated;

-- Own-row insert and own-row select only: no anon access, no update, no delete.
drop policy if exists "Users can insert their own url scan feedback"
  on public.url_scan_feedback;
create policy "Users can insert their own url scan feedback"
  on public.url_scan_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own url scan feedback"
  on public.url_scan_feedback;
create policy "Users can view their own url scan feedback"
  on public.url_scan_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);
