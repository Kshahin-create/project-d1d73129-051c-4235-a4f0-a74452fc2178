-- Create public storage bucket for email assets (logo)
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to the bucket
DO $$ BEGIN
  CREATE POLICY "Email assets are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'email-assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;