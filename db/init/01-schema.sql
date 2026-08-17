-- S.H.I.E.L.D. CTF — authentication schema.
--
-- Postgres runs every .sql in /docker-entrypoint-initdb.d once, on an empty
-- data directory. To re-apply after editing: docker compose down -v
-- (the -v drops the volume, and with it every account).

-- Case-insensitive uniqueness is enforced with generated lowercase columns
-- rather than CITEXT, which needs an extension and behaves oddly with some
-- collations. The originals are kept so a codename displays as typed.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  codename      text NOT NULL CHECK (char_length(codename) BETWEEN 3 AND 24),
  codename_ci   text GENERATED ALWAYS AS (lower(codename)) STORED UNIQUE,

  email         text NOT NULL CHECK (char_length(email) <= 254),
  email_ci      text GENERATED ALWAYS AS (lower(email)) STORED UNIQUE,

  -- Argon2id PHC string. Never a plaintext or reversible value.
  password_hash text NOT NULL,

  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- Sessions are opaque server-side records. The cookie carries a random token;
-- only its SHA-256 lives here, so a database leak cannot be replayed as a
-- login — same reasoning as storing password hashes rather than passwords.
CREATE TABLE sessions (
  token_hash bytea PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- Feeds the login throttle. Rows are pruned rather than kept forever; this is
-- a rate-limit ledger, not an audit log.
CREATE TABLE login_attempts (
  id           bigserial PRIMARY KEY,
  -- Lowercased codename or email as submitted. Not a foreign key: failures
  -- for accounts that do not exist are exactly what needs counting.
  identifier   text NOT NULL,
  ip           inet,
  succeeded    boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_identifier_idx ON login_attempts (identifier, attempted_at);
CREATE INDEX login_attempts_ip_idx ON login_attempts (ip, attempted_at);
