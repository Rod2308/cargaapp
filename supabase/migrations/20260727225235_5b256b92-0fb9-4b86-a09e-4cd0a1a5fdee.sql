SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT 
    p.policyname, 
    p.tablename, 
    p.roles, 
    p.cmd, 
    p.qual, 
    p.with_check 
FROM pg_policies p
WHERE schemaname = 'public'
ORDER BY tablename, policyname;