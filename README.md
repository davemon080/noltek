# StudentLink - Full Database Migration SQL (PostgreSQL / Supabase)

Run this script directly in your Supabase SQL editor.

What it does:
- Creates missing tables
- Adds missing columns
- Aligns important column types where safe
- Skips objects that already match
- Rebuilds `post_likes` and `post_comments` using the actual runtime types of `posts.id` and `users.uid`

Note:
- Rebuilding `post_likes` and `post_comments` drops old data in those two tables.
- Script is idempotent (safe to rerun).

```sql
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1) USERS (profile upgrades + public user ID)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.users (
  uid UUID PRIMARY KEY,
  public_id TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  cover_photo_url TEXT,
  role TEXT NOT NULL DEFAULT 'freelancer',
  bio TEXT,
  phone_number TEXT,
  status TEXT,
  location TEXT,
  skills JSONB,
  education JSONB,
  experience JSONB,
  social_links JSONB,
  portfolio JSONB,
  company_info JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS public_id TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS skills JSONB,
  ADD COLUMN IF NOT EXISTS education JSONB,
  ADD COLUMN IF NOT EXISTS experience JSONB,
  ADD COLUMN IF NOT EXISTS social_links JSONB,
  ADD COLUMN IF NOT EXISTS portfolio JSONB,
  ADD COLUMN IF NOT EXISTS company_info JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

UPDATE public.users
SET role = 'freelancer'
WHERE role IS NULL;

UPDATE public.users
SET public_id = 'SL-' || UPPER(SUBSTRING(REPLACE(uid::text, '-', '') FROM 1 FOR 10))
WHERE public_id IS NULL OR public_id = '';

UPDATE public.users
SET updated_at = CURRENT_TIMESTAMP
WHERE updated_at IS NULL;

ALTER TABLE public.users
  ALTER COLUMN role SET DEFAULT 'freelancer',
  ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_check CHECK (role IN ('freelancer','client','admin'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_public_id ON public.users(public_id);
CREATE INDEX IF NOT EXISTS idx_users_display_name ON public.users(display_name);
CREATE INDEX IF NOT EXISTS idx_users_role_created ON public.users(role, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON public.users;
CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

-- =========================================================
-- 2) POSTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_uid UUID REFERENCES public.users(uid) ON DELETE SET NULL,
  author_name TEXT,
  author_photo TEXT,
  content TEXT NOT NULL,
  image_url TEXT,
  type TEXT NOT NULL DEFAULT 'social',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS author_uid UUID,
  ADD COLUMN IF NOT EXISTS author_name TEXT,
  ADD COLUMN IF NOT EXISTS author_photo TEXT,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'posts_type_check'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_type_check CHECK (type IN ('social','job'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_author_uid ON public.posts(author_uid);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at DESC);

-- =========================================================
-- 3) JOBS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_uid UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  category TEXT,
  is_student_friendly BOOLEAN NOT NULL DEFAULT TRUE,
  is_remote BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS client_uid UUID,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS budget NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS is_student_friendly BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_remote BOOLEAN,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

UPDATE public.jobs SET is_student_friendly = TRUE WHERE is_student_friendly IS NULL;
UPDATE public.jobs SET is_remote = FALSE WHERE is_remote IS NULL;
UPDATE public.jobs SET status = 'open' WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_status_check'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_status_check CHECK (status IN ('open','closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_client_uid ON public.jobs(client_uid);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);

-- =========================================================
-- 4) PROPOSALS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  freelancer_uid UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  budget NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS freelancer_uid UUID,
  ADD COLUMN IF NOT EXISTS job_id UUID,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS budget NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

UPDATE public.proposals SET status = 'pending' WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proposals_status_check'
  ) THEN
    ALTER TABLE public.proposals
      ADD CONSTRAINT proposals_status_check CHECK (status IN ('pending','accepted','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proposals_job_id ON public.proposals(job_id);
CREATE INDEX IF NOT EXISTS idx_proposals_freelancer_uid ON public.proposals(freelancer_uid);

-- =========================================================
-- 5) MESSAGES + ACTIVE CHATS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_uid UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  receiver_uid UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  content TEXT,
  attachments JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_uid UUID,
  ADD COLUMN IF NOT EXISTS receiver_uid UUID,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_messages_pair_time
  ON public.messages(sender_uid, receiver_uid, created_at DESC);

CREATE TABLE IF NOT EXISTS public.active_chats (
  user_uid UUID NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  other_uid UUID NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  last_message TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_uid, other_uid)
);

ALTER TABLE public.active_chats
  ADD COLUMN IF NOT EXISTS user_uid UUID,
  ADD COLUMN IF NOT EXISTS other_uid UUID,
  ADD COLUMN IF NOT EXISTS last_message TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_active_chats_user_updated
  ON public.active_chats(user_uid, updated_at DESC);

-- =========================================================
-- 6) FRIEND REQUESTS + CONNECTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id BIGSERIAL PRIMARY KEY,
  from_uid UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  from_name TEXT,
  from_photo TEXT,
  to_uid UUID REFERENCES public.users(uid) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.friend_requests
  ADD COLUMN IF NOT EXISTS from_uid UUID,
  ADD COLUMN IF NOT EXISTS from_name TEXT,
  ADD COLUMN IF NOT EXISTS from_photo TEXT,
  ADD COLUMN IF NOT EXISTS to_uid UUID,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

UPDATE public.friend_requests SET status = 'pending' WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_status_check'
  ) THEN
    ALTER TABLE public.friend_requests
      ADD CONSTRAINT friend_requests_status_check CHECK (status IN ('pending','accepted','rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_friend_requests_to_uid ON public.friend_requests(to_uid);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_uid ON public.friend_requests(from_uid);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_status_created
  ON public.friend_requests(to_uid, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_status_created
  ON public.friend_requests(from_uid, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.connections (
  id BIGSERIAL PRIMARY KEY,
  uids JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.connections
  ADD COLUMN IF NOT EXISTS uids JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_connections_uids_gin ON public.connections USING GIN (uids);

-- =========================================================
-- 7) WALLETS + WALLET TRANSACTIONS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid UUID NOT NULL UNIQUE REFERENCES public.users(uid) ON DELETE CASCADE,
  usd_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  ngn_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  eur_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS user_uid UUID,
  ADD COLUMN IF NOT EXISTS usd_balance NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS ngn_balance NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS eur_balance NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

UPDATE public.wallets SET usd_balance = 0 WHERE usd_balance IS NULL;
UPDATE public.wallets SET ngn_balance = 0 WHERE ngn_balance IS NULL;
UPDATE public.wallets SET eur_balance = 0 WHERE eur_balance IS NULL;

ALTER TABLE public.wallets
  ALTER COLUMN usd_balance SET DEFAULT 0,
  ALTER COLUMN ngn_balance SET DEFAULT 0,
  ALTER COLUMN eur_balance SET DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallets_user_uid ON public.wallets(user_uid);
CREATE INDEX IF NOT EXISTS idx_wallets_user_uid_updated ON public.wallets(user_uid, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_uid UUID NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
  currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD','NGN','EUR')),
  type VARCHAR(20) NOT NULL CHECK (type IN ('topup','withdraw')),
  method VARCHAR(20) NOT NULL CHECK (method IN ('card','transfer')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  status VARCHAR(20) NOT NULL CHECK (status IN ('completed','pending','failed')),
  reference TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS user_uid UUID,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(3),
  ADD COLUMN IF NOT EXISTS type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS method VARCHAR(20),
  ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS reference TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_created
  ON public.wallet_transactions(user_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference
  ON public.wallet_transactions(reference);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_currency_created
  ON public.wallet_transactions(user_uid, currency, created_at DESC);

-- =========================================================
-- 8) POST LIKES + POST COMMENTS (type-safe)
-- =========================================================
DO $$
DECLARE
  post_id_type TEXT;
  user_uid_type TEXT;
  likes_post_type TEXT;
  likes_user_type TEXT;
  comments_post_type TEXT;
  comments_user_type TEXT;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
    INTO post_id_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='posts' AND a.attname='id' AND a.attnum>0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO user_uid_type
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname='users' AND a.attname='uid' AND a.attnum>0 AND NOT a.attisdropped;

  IF post_id_type IS NULL OR user_uid_type IS NULL THEN
    RAISE EXCEPTION 'posts.id or users.uid not found.';
  END IF;

  -- Create if missing
  IF to_regclass('public.post_likes') IS NULL THEN
    EXECUTE format(
      'CREATE TABLE public.post_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id %s NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        user_uid %s NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_post_like UNIQUE (post_id, user_uid)
      )',
      post_id_type, user_uid_type
    );
  END IF;

  IF to_regclass('public.post_comments') IS NULL THEN
    EXECUTE format(
      'CREATE TABLE public.post_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id %s NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        user_uid %s NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
        author_name VARCHAR(255) NOT NULL,
        author_photo TEXT,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )',
      post_id_type, user_uid_type
    );
  END IF;

  -- Rebuild if incompatible types
  SELECT format_type(a.atttypid, a.atttypmod) INTO likes_post_type
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='post_likes' AND a.attname='post_id' AND a.attnum>0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO likes_user_type
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='post_likes' AND a.attname='user_uid' AND a.attnum>0 AND NOT a.attisdropped;

  IF likes_post_type IS DISTINCT FROM post_id_type OR likes_user_type IS DISTINCT FROM user_uid_type THEN
    DROP TABLE IF EXISTS public.post_likes CASCADE;
    EXECUTE format(
      'CREATE TABLE public.post_likes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id %s NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        user_uid %s NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT uq_post_like UNIQUE (post_id, user_uid)
      )',
      post_id_type, user_uid_type
    );
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod) INTO comments_post_type
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='post_comments' AND a.attname='post_id' AND a.attnum>0 AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod) INTO comments_user_type
  FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname='post_comments' AND a.attname='user_uid' AND a.attnum>0 AND NOT a.attisdropped;

  IF comments_post_type IS DISTINCT FROM post_id_type OR comments_user_type IS DISTINCT FROM user_uid_type THEN
    DROP TABLE IF EXISTS public.post_comments CASCADE;
    EXECUTE format(
      'CREATE TABLE public.post_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id %s NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
        user_uid %s NOT NULL REFERENCES public.users(uid) ON DELETE CASCADE,
        author_name VARCHAR(255) NOT NULL,
        author_photo TEXT,
        content TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )',
      post_id_type, user_uid_type
    );
  END IF;
END $$;

DELETE FROM public.post_likes a
USING public.post_likes b
WHERE a.id < b.id
  AND a.post_id = b.post_id
  AND a.user_uid = b.user_uid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_post_like'
  ) THEN
    ALTER TABLE public.post_likes
      ADD CONSTRAINT uq_post_like UNIQUE (post_id, user_uid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes(user_uid);
CREATE INDEX IF NOT EXISTS idx_post_likes_post_user ON public.post_likes(post_id, user_uid);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_created
  ON public.post_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_post_comments_user
  ON public.post_comments(user_uid);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_created_desc
  ON public.post_comments(post_id, created_at DESC);

-- Safe realtime publication add
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'post_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    JOIN pg_class c ON c.oid = pr.prrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE p.pubname = 'supabase_realtime'
      AND n.nspname = 'public'
      AND c.relname = 'post_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
  END IF;
END $$;

-- =========================================================
-- 9) RLS: LIKES + COMMENTS
-- =========================================================
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS likes_select_all ON public.post_likes;
DROP POLICY IF EXISTS likes_insert_own ON public.post_likes;
DROP POLICY IF EXISTS likes_delete_own ON public.post_likes;
DROP POLICY IF EXISTS comments_select_all ON public.post_comments;
DROP POLICY IF EXISTS comments_insert_own ON public.post_comments;
DROP POLICY IF EXISTS comments_update_own ON public.post_comments;
DROP POLICY IF EXISTS comments_delete_own ON public.post_comments;

CREATE POLICY likes_select_all ON public.post_likes
FOR SELECT TO authenticated USING (true);

CREATE POLICY likes_insert_own ON public.post_likes
FOR INSERT TO authenticated
WITH CHECK (user_uid = auth.uid());

CREATE POLICY likes_delete_own ON public.post_likes
FOR DELETE TO authenticated
USING (user_uid = auth.uid());

CREATE POLICY comments_select_all ON public.post_comments
FOR SELECT TO authenticated USING (true);

CREATE POLICY comments_insert_own ON public.post_comments
FOR INSERT TO authenticated
WITH CHECK (user_uid = auth.uid());

CREATE POLICY comments_update_own ON public.post_comments
FOR UPDATE TO authenticated
USING (user_uid = auth.uid())
WITH CHECK (user_uid = auth.uid());

CREATE POLICY comments_delete_own ON public.post_comments
FOR DELETE TO authenticated
USING (user_uid = auth.uid());

-- =========================================================
-- 10) STORAGE FOR PROFILE PICTURES + COVER + FEED IMAGES
-- Bucket used by your app: chat-attachments
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for uploaded files (profile + posts + chat attachments)
DROP POLICY IF EXISTS "Public read chat-attachments" ON storage.objects;
CREATE POLICY "Public read chat-attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-attachments');

-- Authenticated users can upload
DROP POLICY IF EXISTS "Auth upload chat-attachments" ON storage.objects;
CREATE POLICY "Auth upload chat-attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Users can update/delete only their own uploaded files
DROP POLICY IF EXISTS "Auth update own chat-attachments" ON storage.objects;
CREATE POLICY "Auth update own chat-attachments"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'chat-attachments' AND owner = auth.uid())
WITH CHECK (bucket_id = 'chat-attachments' AND owner = auth.uid());

DROP POLICY IF EXISTS "Auth delete own chat-attachments" ON storage.objects;
CREATE POLICY "Auth delete own chat-attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-attachments' AND owner = auth.uid());

COMMIT;

```
