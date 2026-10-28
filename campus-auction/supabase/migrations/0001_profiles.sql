-- Create set_updated_at trigger function (used by all tables with updated_at)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = clock_timestamp();
  RETURN NEW;
END;
$$;

-- system_config table
CREATE TABLE system_config (
  key TEXT PRIMARY KEY CHECK (key IN ('seller_response_seconds', 'pickup_seconds')),
  value_seconds BIGINT NOT NULL CHECK (value_seconds > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Enable RLS on system_config (no client policies — service_role only)
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 2 AND 60),
  role TEXT NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'student', 'admin')),
  is_verified BOOLEAN NOT NULL DEFAULT TRUE,
  account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Trigger to keep updated_at current
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile on new auth user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
BEGIN
  INSERT INTO profiles (id, display_name, role, is_verified, account_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'buyer'),
    TRUE,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
        role = COALESCE(EXCLUDED.role, profiles.role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auth_users_new_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- is_eligible_user helper
CREATE OR REPLACE FUNCTION is_eligible_user()
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_verified BOOLEAN;
  v_status TEXT;
BEGIN
  SELECT is_verified, account_status
  INTO v_verified, v_status
  FROM profiles
  WHERE id = auth.uid();
  
  IF NOT FOUND THEN RETURN TRUE; END IF;
  RETURN COALESCE(v_verified, TRUE) AND COALESCE(v_status, 'active') = 'active';
END;
$$;

REVOKE ALL ON FUNCTION is_eligible_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_eligible_user() TO authenticated;
