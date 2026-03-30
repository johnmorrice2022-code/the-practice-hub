
-- 1. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  exam_board text DEFAULT 'AQA',
  tier text DEFAULT 'Higher',
  first_subject text DEFAULT 'Maths',
  weekly_goal integer DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. User roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 3. Subtopics table
CREATE TABLE public.subtopics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  topic text NOT NULL,
  subtopic_name text NOT NULL,
  exam_board text NOT NULL DEFAULT 'AQA',
  tier text NOT NULL DEFAULT 'Higher',
  grade_band text NOT NULL DEFAULT '7-9',
  description text,
  prompt_config jsonb DEFAULT '{}'::jsonb,
  difficulty_profile jsonb DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;

-- Everyone can read active subtopics
CREATE POLICY "Anyone can view active subtopics"
  ON public.subtopics FOR SELECT
  USING (active = true);

-- Admins can do everything
CREATE POLICY "Admins can manage subtopics"
  ON public.subtopics FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4. Seeded questions table
CREATE TABLE public.seeded_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subtopic_id uuid REFERENCES public.subtopics(id) ON DELETE CASCADE NOT NULL,
  question_text text NOT NULL,
  marks integer NOT NULL DEFAULT 1,
  mark_scheme jsonb NOT NULL DEFAULT '[]'::jsonb,
  worked_solution text NOT NULL DEFAULT '',
  question_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.seeded_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seeded questions"
  ON public.seeded_questions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage seeded questions"
  ON public.seeded_questions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
