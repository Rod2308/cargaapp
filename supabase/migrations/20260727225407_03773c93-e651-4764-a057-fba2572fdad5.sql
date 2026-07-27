SELECT 
    routine_name, 
    routine_type, 
    external_language,
    security_type,
    prosrc -- Get the function body
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
JOIN information_schema.routines r ON r.routine_name = p.proname
WHERE n.nspname = 'public' 
AND r.routine_name NOT LIKE 'pg_%';