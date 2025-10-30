DROP SCHEMA IF EXISTS test_rls CASCADE;
CREATE SCHEMA test_rls;
SET search_path = test_rls, public;
CREATE EXTENSION IF NOT EXISTS pgtap;
SET search_path = test_rls, extensions, public;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END
$$;

CREATE TABLE test_rls.organizations (
    id uuid PRIMARY KEY,
    name text NOT NULL
);

CREATE TABLE test_rls.profiles (
    user_id uuid PRIMARY KEY,
    full_name text,
    current_org uuid REFERENCES test_rls.organizations (id)
);

CREATE TABLE test_rls.subscriptions (
    id uuid PRIMARY KEY,
    user_id uuid REFERENCES test_rls.profiles (user_id),
    plan text NOT NULL,
    status text NOT NULL
);

GRANT USAGE ON SCHEMA test_rls TO anon, authenticated;
GRANT SELECT ON test_rls.subscriptions TO authenticated;

ALTER TABLE test_rls.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions owner access"
    ON test_rls.subscriptions
    FOR SELECT
    USING (user_id = NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid);

INSERT INTO test_rls.organizations (id, name) VALUES
  ('11111111-1111-4111-8111-111111111111', 'Org A');

INSERT INTO test_rls.profiles (user_id, full_name, current_org) VALUES
  ('22222222-2222-4222-8222-222222222222', 'Alice', '11111111-1111-4111-8111-111111111111'),
  ('33333333-3333-4333-8333-333333333333', 'Bob', '11111111-1111-4111-8111-111111111111');

INSERT INTO test_rls.subscriptions (id, user_id, plan, status) VALUES
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 'starter', 'active'),
  ('55555555-5555-4555-8555-555555555555', '33333333-3333-4333-8333-333333333333', 'pro', 'past_due');

BEGIN;
SELECT extensions.plan(2);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
SELECT extensions.results_eq(
  $$ SELECT user_id FROM test_rls.subscriptions $$,
  $$ VALUES ('22222222-2222-4222-8222-222222222222'::uuid) $$,
  'Alice sees only her subscription'
);

SELECT set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
SELECT extensions.results_eq(
  $$ SELECT user_id FROM test_rls.subscriptions $$,
  $$ VALUES ('33333333-3333-4333-8333-333333333333'::uuid) $$,
  'Bob sees only his subscription'
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
