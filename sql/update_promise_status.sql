-- Function to update promise status with proper ownership validation
-- This helps bypass RLS issues while maintaining security

CREATE OR REPLACE FUNCTION public.update_promise_status(
  promise_id TEXT,
  new_status TEXT,
  updater_uid TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result_promise JSON;
  existing_promise promises;
  promise_owner users;
BEGIN
  -- Get the existing promise
  SELECT * INTO existing_promise
  FROM promises
  WHERE id = promise_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Promise not found';
  END IF;
  
  -- Get the user making the request
  SELECT * INTO promise_owner
  FROM users
  WHERE id = updater_uid;
  
  -- Check ownership - three ways:
  -- 1. created_by matches updater
  -- 2. promise address matches updater's address  
  -- 3. promise address matches and created_by is null (legacy data)
  IF NOT (
    existing_promise.created_by = updater_uid OR 
    (promise_owner.address IS NOT NULL AND 
     existing_promise.address = promise_owner.address) OR
    (existing_promise.created_by IS NULL AND 
     promise_owner.address IS NOT NULL AND 
     existing_promise.address = promise_owner.address)
  ) THEN
    RAISE EXCEPTION 'You are not allowed to update this promise';
  END IF;
  
  -- Update the promise
  UPDATE promises 
  SET 
    status = new_status,
    updated_at = NOW(),
    created_by = COALESCE(created_by, updater_uid) -- Set created_by if null
  WHERE id = promise_id
  RETURNING row_to_json(promises.*) INTO result_promise;
  
  RETURN result_promise;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_promise_status TO authenticated;
