-- Rules that span tables or forbid changes, which CHECK constraints can't express.

-- transcript_lines.speaker_id and feedback_reports.user_id must be one of the session's two users.
-- mistakes inherit this through their foreign key to feedback_reports(session_id, user_id).
CREATE FUNCTION enforce_session_participant() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  member_id text := to_jsonb(NEW) ->> TG_ARGV[0];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = NEW.session_id AND member_id IN (s.user_a_id, s.user_b_id)
  ) THEN
    RAISE EXCEPTION '%.% (%) is not a participant of session %', TG_TABLE_NAME, TG_ARGV[0], member_id, NEW.session_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
-- Triggers fire in name order: participant check (1) runs before the consent check (2).
CREATE TRIGGER transcript_lines_1_speaker_is_participant
  BEFORE INSERT OR UPDATE OF session_id, speaker_id ON transcript_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_session_participant('speaker_id');
--> statement-breakpoint
CREATE TRIGGER feedback_reports_user_is_participant
  BEFORE INSERT OR UPDATE OF session_id, user_id ON feedback_reports
  FOR EACH ROW EXECUTE FUNCTION enforce_session_participant('user_id');
--> statement-breakpoint

-- Speech is stored only for a participant who consented at match time.
CREATE FUNCTION enforce_transcript_consent() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.id = NEW.session_id
      AND ((NEW.speaker_id = s.user_a_id AND s.user_a_transcription_consent)
        OR (NEW.speaker_id = s.user_b_id AND s.user_b_transcription_consent))
  ) THEN
    RAISE EXCEPTION 'speaker % did not consent to transcription in session %', NEW.speaker_id, NEW.session_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER transcript_lines_2_require_consent
  BEFORE INSERT ON transcript_lines
  FOR EACH ROW EXECUTE FUNCTION enforce_transcript_consent();
--> statement-breakpoint

-- admin_actions is an audit log: rows can be added, never changed or removed.
CREATE FUNCTION forbid_admin_action_changes() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'admin_actions is append-only' USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER admin_actions_append_only
  BEFORE UPDATE OR DELETE ON admin_actions
  FOR EACH ROW EXECUTE FUNCTION forbid_admin_action_changes();
--> statement-breakpoint
CREATE TRIGGER admin_actions_no_truncate
  BEFORE TRUNCATE ON admin_actions
  FOR EACH STATEMENT EXECUTE FUNCTION forbid_admin_action_changes();
