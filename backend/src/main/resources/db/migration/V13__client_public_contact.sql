-- Contact phone for public company profiles. This is separate from the account phone.
-- Existing clients remain private until they enter a public contact number.
ALTER TABLE dbo.client_profiles ADD public_contact_phone NVARCHAR(20) NULL;
