
-- Update the check to also allow emails with pending group invites
CREATE OR REPLACE FUNCTION public.check_allowed_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.allowed_emails WHERE lower(email) = lower(NEW.email)
  ) AND NOT EXISTS (
    SELECT 1 FROM public.group_invites WHERE lower(email) = lower(NEW.email) AND used_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This email is not on the invite list. Please reach out to the admin for an invite.';
  END IF;
  RETURN NEW;
END;
$$;
