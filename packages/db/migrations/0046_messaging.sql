-- Sprint 13: messaging (parent <-> teacher, learner <-> teacher in-lesson,
-- therapist <-> family with consent, district announcements) + per-channel
-- consent + read receipts + attachment sanitizer status.
--
-- Visibility / boundary policy is enforced in code at
-- services/comms-svc/src/policy/visibility.ts. See docs/comms/boundaries.md.
--
-- Note: we denormalise tenant_id onto message_threads (not on every message)
-- because tenant-level scoping is always evaluated at the thread join, and
-- adding it per-message would inflate row size without query-plan benefit.

CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN (
    'parent_teacher',
    'learner_teacher_lesson',
    'therapist_family',
    'district_announcement'
  )),
  tenant_id uuid NOT NULL,
  learner_id uuid NULL,
  lesson_id uuid NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NULL,
  archived_at timestamptz NULL
);
CREATE INDEX IF NOT EXISTS idx_message_threads_tenant_kind
  ON message_threads(tenant_id, kind);
CREATE INDEX IF NOT EXISTS idx_message_threads_learner
  ON message_threads(learner_id)
  WHERE learner_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_message_threads_lesson
  ON message_threads(lesson_id)
  WHERE lesson_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS message_thread_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('author', 'reader', 'observer')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz NULL,
  UNIQUE (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_thread_participants_user
  ON message_thread_participants(user_id);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  body text NOT NULL,
  body_format text NOT NULL DEFAULT 'plain' CHECK (body_format IN ('plain', 'markdown')),
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz NULL,
  redacted_at timestamptz NULL,
  redacted_reason text NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_thread_created
  ON messages(thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_url text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  sanitizer_status text NOT NULL DEFAULT 'pending'
    CHECK (sanitizer_status IN ('pending', 'clean', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message
  ON message_attachments(message_id);

CREATE TABLE IF NOT EXISTS message_read_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user
  ON message_read_receipts(user_id);

CREATE TABLE IF NOT EXISTS message_consent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  channel text NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
  opted_in boolean NOT NULL,
  opted_in_at timestamptz NOT NULL DEFAULT now(),
  source text NULL,
  UNIQUE (user_id, channel)
);
CREATE INDEX IF NOT EXISTS idx_message_consent_user
  ON message_consent(user_id);
