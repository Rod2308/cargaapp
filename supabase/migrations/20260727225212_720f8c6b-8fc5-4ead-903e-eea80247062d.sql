SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

SELECT 
    p.policyname, 
    p.tablename, 
    p.roles, 
    p.cmd, 
    p.qual, 
    p.with_check 
FROM pg_policies p
WHERE schemaname = 'public';

SELECT 
    routine_name, 
    routine_type, 
    external_language,
    security_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name NOT LIKE 'pg_%';