IF DB_NAME() <> N'LinkIT_V2' THROW 51000, 'Migration requires LinkIT_V2.', 1;


CREATE TABLE dbo.assignment_scope_documents (
    assignment_id BIGINT NOT NULL CONSTRAINT PK_assignment_scope_documents PRIMARY KEY,
    file_name NVARCHAR(255) NOT NULL,
    file_size INT NOT NULL,
    pdf_bytes VARBINARY(MAX) NOT NULL,
    uploaded_by BIGINT NOT NULL,
    uploaded_at DATETIME2(3) NOT NULL,
    CONSTRAINT FK_assignment_scope_documents_assignment FOREIGN KEY (assignment_id) REFERENCES dbo.assignments(id),
    CONSTRAINT FK_assignment_scope_documents_uploader FOREIGN KEY (uploaded_by) REFERENCES dbo.users(id),
    CONSTRAINT CK_assignment_scope_documents_size CHECK (file_size BETWEEN 1 AND 2097152),
    CONSTRAINT CK_assignment_scope_documents_filename CHECK (LEN(file_name) > 0)
);
