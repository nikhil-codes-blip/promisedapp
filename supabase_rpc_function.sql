-- Create RPC function to update promise status with proper ownership validation
-- This function bypasses Row Level Security (RLS) restrictions
CREATE OR REPLACE FUNCTION update_promise_status(
  promise_id TEXT,
  new_status TEXT,
  updater_uid TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to run with elevated privileges
AS $$
DECLARE
  existing_promise RECORD;
  current_user_record RECORD;
  result JSON;
BEGIN
  -- 1. Fetch the promise
  SELECT * INTO existing_promise
  FROM promises
  WHERE id = promise_id;
  
  -- Check if promise exists
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promise not found with ID: %', promise_id;
  END IF;
  
  -- 2. Fetch current user record
  SELECT * INTO current_user_record
  FROM users
  WHERE id = updater_uid;
  
  -- 3. Check ownership (multiple validation methods)
  IF NOT (
    -- Method 1: created_by matches current user
    existing_promise.created_by = updater_uid OR
    -- Method 2: promise address matches user's address in users table
    (current_user_record.address IS NOT NULL AND 
     existing_promise.address = lower(current_user_record.address)) OR
    -- Method 3: if created_by is null/empty, allow if addresses match
    (existing_promise.created_by IS NULL AND
     current_user_record.address IS NOT NULL AND 
     existing_promise.address = lower(current_user_record.address))
  ) THEN
    RAISE EXCEPTION 'Permission denied. You can only update promises you created.';
  END IF;
  
  -- 4. Update the promise
  UPDATE promises 
  SET 
    status = new_status,
    updated_at = NOW(),
    created_by = updater_uid  -- Ensure ownership is properly set
  WHERE id = promise_id;
  
  -- 5. Return the updated promise as JSON
  SELECT row_to_json(p.*) INTO result
  FROM promises p
  WHERE p.id = promise_id;
  
  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_promise_status TO authenticated;
