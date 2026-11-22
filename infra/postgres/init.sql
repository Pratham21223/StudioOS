-- Development/test bootstrap. Runs only when the Postgres volume is first created.
-- The application database (studio_os) is created by the postgres image itself.

SELECT format('CREATE DATABASE studio_os_test OWNER %I', current_user)
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'studio_os_test') \gexec
