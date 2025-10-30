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
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL
);

INSERT INTO test_rls.organizations (name) VALUES ('Acme Inc');

GRANT USAGE ON SCHEMA test_rls TO anon, authenticated;
GRANT SELECT ON test_rls.organizations TO anon, authenticated;

ALTER TABLE test_rls.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage organizations"
    ON test_rls.organizations
    FOR SELECT
    USING (current_user = 'authenticated');

BEGIN;
SELECT extensions.plan(3);

SET ROLE anon;
SELECT extensions.results_eq(
    $$ SELECT count(*) FROM test_rls.organizations $$,
    $$ VALUES (0::bigint) $$,
    'anon sees zero organizations due to RLS'
);

RESET ROLE;
SET ROLE authenticated;
SELECT extensions.results_eq(
    $$ SELECT count(*) FROM test_rls.organizations $$,
    $$ VALUES (1::bigint) $$,
    'authenticated sees organizations'
);
SELECT extensions.policies_are(
    'test_rls',
    'organizations',
    ARRAY['Members manage organizations']
);

RESET ROLE;
SELECT * FROM extensions.finish();
ROLLBACK;
