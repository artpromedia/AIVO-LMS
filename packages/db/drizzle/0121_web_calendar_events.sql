-- Sprint A4: teacher personal-calendar events backing the teacher-home
-- "Upcoming" rail (web-owned; no microservice system-of-record yet).
CREATE TABLE IF NOT EXISTS web_calendar_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  teacher_user_id TEXT NOT NULL,
  data JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS web_calendar_events_teacher_idx
  ON web_calendar_events (tenant_id, teacher_user_id);
