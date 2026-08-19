-- ScamSense SG — recent scan history for the URL phishing detector.
--
-- Convenience only: a row is written after a scan has already been shown, it is
-- never read back into the detector, and nothing here can change a verdict.
--
-- No model version column: POST /api/url/predict does not return one, and
-- inventing one would be worse than omitting it (as for url_scan_feedback).
--
-- Re-runnable: every statement is guarded, and the DROP POLICY guards can only
-- ever match policies on this new table.

create table if not exists public.url_scan_history (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users (id) on delete cascade,

  -- Redacted in the browser by frontend/src/lib/redact-url.js, which throws
  -- rather than falling back to the raw URL. The cap matches
  -- REDACTED_URL_MAX_LENGTH there.
  url_redacted text not null
    constraint url_scan_history_url_redacted_length
      check (char_length(url_redacted) between 1 and 2048),

  -- What the result card displayed, so a row cannot drift from the verdict the
  -- user saw.
  verdict text not null
    constraint url_scan_history_verdict_length
      check (char_length(verdict) between 1 and 120),
  verdict_level text not null
    constraint url_scan_history_verdict_level_valid
      check (verdict_level in ('safe', 'warning', 'danger')),

  -- Both nullable: a result can arrive without either (Gemini unavailable, or a
  -- missing probability), and a guessed value is worse than a null.
  ml_probability double precision
    constraint url_scan_history_ml_probability_range
      check (ml_probability is null or (ml_probability >= 0 and ml_probability <= 1)),
  genai_risk_level text
    constraint url_scan_history_genai_risk_level_valid
      check (genai_risk_level is null or genai_risk_level in ('low', 'medium', 'high')),

  created_at timestamptz not null default now()
);

comment on table public.url_scan_history is
  'Recent URL scans for the signed-in user who ran them. Convenience only: never used to retrain the model, never read back into a prediction, and kept until the user clears it or their account is deleted.';

comment on column public.url_scan_history.url_redacted is
  'Scheme, host, optional port and path only. Credentials, query strings and fragments are never stored.';

-- Retrieval is always "this user's scans, newest first".
create index if not exists url_scan_history_user_id_created_at_idx
  on public.url_scan_history (user_id, created_at desc);

alter table public.url_scan_history enable row level security;

-- Supabase's default privileges grant new public tables to anon and
-- authenticated, so both are revoked first and only the three verbs this
-- feature needs are granted back. Guests get nothing.
revoke all on table public.url_scan_history from anon;
revoke all on table public.url_scan_history from authenticated;
grant select, insert, delete on table public.url_scan_history to authenticated;

-- Own-row only, and no update policy: a stored scan can be removed but never
-- rewritten into a different verdict.
drop policy if exists "Users can insert their own url scan history"
  on public.url_scan_history;
create policy "Users can insert their own url scan history"
  on public.url_scan_history
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can view their own url scan history"
  on public.url_scan_history;
create policy "Users can view their own url scan history"
  on public.url_scan_history
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own url scan history"
  on public.url_scan_history;
create policy "Users can delete their own url scan history"
  on public.url_scan_history
  for delete
  to authenticated
  using (auth.uid() = user_id);
