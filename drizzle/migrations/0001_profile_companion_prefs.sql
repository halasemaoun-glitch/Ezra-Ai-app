ALTER TABLE public.profiles
  ADD COLUMN humor_level smallint NOT NULL DEFAULT 7,
  ADD COLUMN affection_level smallint NOT NULL DEFAULT 6,
  ADD COLUMN communication_style text NOT NULL DEFAULT 'balanced';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_humor_range CHECK (humor_level BETWEEN 0 AND 10);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_affection_range CHECK (affection_level BETWEEN 0 AND 10);
ALTER TABLE public.profiles ADD CONSTRAINT profiles_style_values CHECK (communication_style IN ('balanced', 'playful', 'calm', 'academic'));