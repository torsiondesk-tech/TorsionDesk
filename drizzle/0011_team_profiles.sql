CREATE TABLE IF NOT EXISTS team_profiles (
  id text PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  email text,
  address text,
  date_of_birth date,
  role text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS team_profiles_tenant_user_unique
  ON team_profiles (tenant_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS team_profiles_tenant_id_unique
  ON team_profiles (tenant_id, id);

CREATE INDEX IF NOT EXISTS team_profiles_user_idx
  ON team_profiles (user_id);

-- RLS policy: tenants can only see their own profiles
ALTER TABLE team_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_profiles_tenant_isolation
  ON team_profiles
  FOR ALL
  TO authenticated
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
