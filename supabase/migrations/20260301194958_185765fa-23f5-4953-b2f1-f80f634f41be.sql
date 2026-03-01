
-- Drop the restrictive SELECT policy and replace with a permissive one that includes creators
DROP POLICY "Members can view their groups" ON public.groups;

CREATE POLICY "Members can view their groups"
ON public.groups
FOR SELECT
TO authenticated
USING (
  is_group_member(auth.uid(), id) OR auth.uid() = created_by
);

-- Auto-add creator as group member via trigger
CREATE OR REPLACE FUNCTION public.auto_add_group_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.group_members (group_id, user_id)
  VALUES (NEW.id, NEW.created_by)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_add_creator_to_group
  AFTER INSERT ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_group_creator();

-- Also make the INSERT policy permissive
DROP POLICY "Authenticated can create groups" ON public.groups;

CREATE POLICY "Authenticated can create groups"
ON public.groups
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);
