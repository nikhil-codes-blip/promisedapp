CREATE OR REPLACE FUNCTION increment_column(
  table_name TEXT,
  column_name TEXT,
  value INT
)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE %I SET %I = %I + %s', table_name, column_name, column_name, value);
END;
$$ LANGUAGE plpgsql;
