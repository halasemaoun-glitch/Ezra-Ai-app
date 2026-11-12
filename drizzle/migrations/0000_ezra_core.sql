CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  nickname text,
  profession text,
  lifestyle text,
  about text,
  instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'محادثة جديدة',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_updated ON public.conversations (user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own conversations select" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own conversations insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own conversations update" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own conversations delete" ON public.conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER conversations_touch BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  client_id text,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_created ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own messages select" ON public.messages FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own messages insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Own messages delete" ON public.messages FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Own attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own attachments upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Own attachments delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);