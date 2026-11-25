ALTER TABLE profiles ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE profiles ADD COLUMN email_verified_at timestamptz;
ALTER TABLE profiles ADD COLUMN verification_required boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ALTER COLUMN verification_required SET DEFAULT true;
ALTER TABLE profiles ADD COLUMN username text UNIQUE CHECK (username ~ '^[a-z0-9_]{3,24}$');
ALTER TABLE sessions ADD COLUMN authenticated_at timestamptz;
CREATE TABLE terms_acceptances (
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  version text NOT NULL, accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,version)
);
CREATE TABLE account_tokens (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify','reset')),
  expires_at timestamptz NOT NULL
);
CREATE INDEX account_tokens_owner ON account_tokens(user_id,purpose);
CREATE INDEX account_tokens_expiry ON account_tokens(expires_at);
CREATE TABLE oauth_identities (
  provider text NOT NULL CHECK (provider='google'),
  subject text NOT NULL, user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE,
  PRIMARY KEY(provider,subject), UNIQUE(user_id,provider)
);
CREATE TABLE oauth_flows (
  token_hash text PRIMARY KEY, state text NOT NULL, nonce text NOT NULL,
  verifier text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX oauth_flows_expiry ON oauth_flows(expires_at);
CREATE TABLE oauth_onboarding (
  token_hash text PRIMARY KEY, subject text NOT NULL, email text NOT NULL,
  name text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE INDEX oauth_onboarding_expiry ON oauth_onboarding(expires_at);
CREATE TABLE saved_searches (
  user_id uuid NOT NULL REFERENCES profiles ON DELETE CASCADE, query text NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,query)
);
