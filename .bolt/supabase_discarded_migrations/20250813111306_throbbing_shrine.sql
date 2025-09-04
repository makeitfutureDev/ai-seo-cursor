@@ .. @@
 /*
   # Update competitors table and policies
   
   1. Table Updates
     - Add missing columns (created_at, updated_at) if they don't exist
-    - Ensure proper foreign key constraint to companies table (company_id)
+    - Ensure proper foreign key constraint to companies table (company)
     - Add automatic timestamp triggers
   
   2. Security Policies
@@ .. @@
 DO $$
 BEGIN
   -- Add created_at column if it doesn't exist
   IF NOT EXISTS (
     SELECT 1 FROM information_schema.columns 
     WHERE table_name = 'competitors' AND column_name = 'created_at'
   ) THEN
     ALTER TABLE competitors ADD COLUMN created_at timestamptz DEFAULT now();
   END IF;
   
   -- Add updated_at column if it doesn't exist
   IF NOT EXISTS (
     SELECT 1 FROM information_schema.columns 
     WHERE table_name = 'competitors' AND column_name = 'updated_at'
   ) THEN
     ALTER TABLE competitors ADD COLUMN updated_at timestamptz DEFAULT now();
   END IF;
   
-  -- Ensure foreign key constraint exists for company_id
+  -- Ensure foreign key constraint exists for company
   IF NOT EXISTS (
     SELECT 1 FROM information_schema.table_constraints 
-    WHERE table_name = 'competitors' AND constraint_name = 'competitors_company_id_fkey'
+    WHERE table_name = 'competitors' AND constraint_name = 'competitors_company_fkey'
   ) THEN
-    ALTER TABLE competitors ADD CONSTRAINT competitors_company_id_fkey 
-      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
+    ALTER TABLE competitors ADD CONSTRAINT competitors_company_fkey 
+      FOREIGN KEY (company) REFERENCES companies(id) ON DELETE CASCADE;
   END IF;
 END $$;
 
@@ .. @@
 CREATE POLICY "Company members can read competitors"
   ON competitors
   FOR SELECT
   TO authenticated
-  USING (company_id IN (
+  USING (company IN (
     SELECT company_users.company_id
     FROM company_users
     WHERE company_users.user_id = uid()
@@ .. @@
 CREATE POLICY "Company admins can insert competitors"
   ON competitors
   FOR INSERT
   TO authenticated
-  WITH CHECK (company_id IN (
+  WITH CHECK (company IN (
     SELECT company_users.company_id
     FROM company_users
     WHERE company_users.user_id = uid() AND company_users.role = 'admin'
@@ .. @@
 CREATE POLICY "Company admins can update competitors"
   ON competitors
   FOR UPDATE
   TO authenticated
-  USING (company_id IN (
+  USING (company IN (
     SELECT company_users.company_id
     FROM company_users
     WHERE company_users.user_id = uid() AND company_users.role = 'admin'
   ))
-  WITH CHECK (company_id IN (
+  WITH CHECK (company IN (
     SELECT company_users.company_id
     FROM company_users
     WHERE company_users.user_id = uid() AND company_users.role = 'admin'
@@ .. @@
 CREATE POLICY "Company admins can delete competitors"
   ON competitors
   FOR DELETE
   TO authenticated
-  USING (company_id IN (
+  USING (company IN (
     SELECT company_users.company_id
     FROM company_users
     WHERE company_users.user_id = uid() AND company_users.role = 'admin'