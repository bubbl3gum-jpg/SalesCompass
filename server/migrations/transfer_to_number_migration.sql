-- Safe migration script for transfer_order primary key change
-- Run this inside a transaction to ensure atomicity

BEGIN;

-- Step 1: Ensure to_number is populated and unique
UPDATE transfer_order
SET to_number = 'TO-' || to_id::text
WHERE to_number IS NULL OR to_number = '';

-- Make to_number NOT NULL if it isn't already
ALTER TABLE transfer_order
  ALTER COLUMN to_number SET NOT NULL;

-- Create unique index on to_number if not exists
CREATE UNIQUE INDEX IF NOT EXISTS uq_transfer_order_to_number 
  ON transfer_order(to_number);

-- Step 2: Add to_number column to to_itemlist
ALTER TABLE to_itemlist 
  ADD COLUMN IF NOT EXISTS to_number VARCHAR(50);

-- Populate to_number in to_itemlist from transfer_order
UPDATE to_itemlist ti
SET to_number = t.to_number
FROM transfer_order t
WHERE ti.to_id = t.to_id;

-- Make to_number NOT NULL
ALTER TABLE to_itemlist
  ALTER COLUMN to_number SET NOT NULL;

-- Step 3: Change primary key on transfer_order
ALTER TABLE transfer_order
  DROP CONSTRAINT IF EXISTS transfer_order_pkey;

ALTER TABLE transfer_order
  ADD CONSTRAINT transfer_order_pkey PRIMARY KEY (to_number);

-- Step 4: Add foreign key from to_itemlist to transfer_order
ALTER TABLE to_itemlist
  ADD CONSTRAINT fk_to_itemlist_to_number
  FOREIGN KEY (to_number)
  REFERENCES transfer_order(to_number)
  ON UPDATE CASCADE 
  ON DELETE CASCADE;

-- Step 5: Add line_no column (optional but recommended)
ALTER TABLE to_itemlist 
  ADD COLUMN IF NOT EXISTS line_no INT;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_to_itemlist_line_no 
  ON to_itemlist(to_number, line_no);

-- Step 6: Drop the old to_id column from to_itemlist
ALTER TABLE to_itemlist 
  DROP COLUMN IF EXISTS to_id;

COMMIT;

-- Verify the migration
SELECT 'Migration completed successfully' as status;