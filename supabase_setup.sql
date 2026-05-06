-- SQL Setup for GhostGallery

-- 1. Create galleries table
CREATE TABLE IF NOT EXISTS galleries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    title TEXT NOT NULL,
    watermark_text TEXT DEFAULT 'Confidential'
);

-- 2. Create gallery_images table
CREATE TABLE IF NOT EXISTS gallery_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE NOT NULL,
    blob_pathname TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL
);

-- 3. Create share_links table
CREATE TABLE IF NOT EXISTS share_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    gallery_id UUID REFERENCES galleries(id) ON DELETE CASCADE NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    one_time_use BOOLEAN DEFAULT true NOT NULL,
    session_id TEXT,
    first_accessed_at TIMESTAMP WITH TIME ZONE,
    access_count INTEGER DEFAULT 0
);

-- 4. Set up Row Level Security (RLS)
-- Note: These policies allow anonymous access for the app's functionality.
-- In a production environment, you might want more restrictive policies.

ALTER TABLE galleries ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

-- Galleries Policies
CREATE POLICY "Enable insert for everyone" ON galleries FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for everyone" ON galleries FOR SELECT USING (true);

-- Gallery Images Policies
CREATE POLICY "Enable insert for everyone" ON gallery_images FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for everyone" ON gallery_images FOR SELECT USING (true);

-- Share Links Policies
CREATE POLICY "Enable insert for everyone" ON share_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable select for everyone" ON share_links FOR SELECT USING (true);
CREATE POLICY "Enable update for everyone" ON share_links FOR UPDATE USING (true);
