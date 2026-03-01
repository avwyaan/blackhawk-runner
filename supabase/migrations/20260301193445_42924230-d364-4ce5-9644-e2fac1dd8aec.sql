
-- Table of whitelisted emails
CREATE TABLE public.allowed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allowed_emails ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed - only accessed via security definer trigger

-- Trigger function to check email whitelist on signup
CREATE OR REPLACE FUNCTION public.check_allowed_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(NEW.email)
  ) THEN
    RAISE EXCEPTION 'This email is not on the invite list. Please reach out to the admin for an invite.';
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to auth.users on insert
CREATE TRIGGER check_email_whitelist
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.check_allowed_email();
