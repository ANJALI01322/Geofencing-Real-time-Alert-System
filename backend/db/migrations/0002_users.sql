-- 0002_users: accounts for JWT authentication.
--
-- password_hash holds a bcrypt hash, never a password. Emails are stored lower-cased (enforced
-- by the CHECK) so the UNIQUE constraint makes them case-insensitively unique.

CREATE TABLE IF NOT EXISTS users (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(email)),
    password_hash TEXT         NOT NULL,
    role          VARCHAR(10)  NOT NULL CHECK (role IN ('admin', 'viewer')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
