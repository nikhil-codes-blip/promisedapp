CREATE OR REPLACE FUNCTION get_global_stats(p_address TEXT DEFAULT NULL)
RETURNS TABLE(
    "totalUsers" BIGINT,
    "totalPromises" BIGINT,
    "completedPromises" BIGINT,
    "failedPromises" BIGINT,
    "activePromises" BIGINT,
    "averageReputation" NUMERIC,
    "topPerformer" TEXT,
    "completionRate" NUMERIC,
    "highestStreak" INT,
    "myStreak" INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM public.users) AS "totalUsers",
        (SELECT COUNT(*) FROM public.promises) AS "totalPromises",
        (SELECT COUNT(*) FROM public.promises WHERE status = 'completed') AS "completedPromises",
        (SELECT COUNT(*) FROM public.promises WHERE status = 'failed') AS "failedPromises",
        (SELECT COUNT(*) FROM public.promises WHERE status = 'active') AS "activePromises",
        (SELECT AVG(reputation) FROM public.users) AS "averageReputation",
        (SELECT name FROM public.users ORDER BY reputation DESC LIMIT 1) AS "topPerformer",
        (SELECT (SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0) / NULLIF(COUNT(*), 0) FROM public.promises) AS "completionRate",
        (SELECT MAX(streak) FROM public.users) AS "highestStreak",
        (SELECT streak FROM public.users WHERE address = p_address) AS "myStreak";
END;
$$;

GRANT EXECUTE ON FUNCTION get_global_stats(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_stats(TEXT) TO service_role;
