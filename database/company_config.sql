-- store procedure for company_config CRUD

-- Create company config
CREATE PROCEDURE sp_create_company_config
    @company_name VARCHAR(255),
    @company_logo VARCHAR(512),
    @address VARCHAR(512),
    @contact_email VARCHAR(255),
    @contact_phone VARCHAR(50)
AS
BEGIN
    INSERT INTO company_config (company_name, company_logo, address, contact_email, contact_phone)
    VALUES (@company_name, @company_logo, @address, @contact_email, @contact_phone)
END
GO

-- Get all company configs
CREATE PROCEDURE sp_get_company_configs
AS
BEGIN
    SELECT * FROM company_config
END
GO

-- Get single company config
CREATE PROCEDURE sp_get_company_config_by_id
    @id INT
AS
BEGIN
    SELECT * FROM company_config WHERE id = @id
END
GO

-- Update company config
CREATE PROCEDURE sp_update_company_config
    @id INT,
    @company_name VARCHAR(255),
    @company_logo VARCHAR(512),
    @address VARCHAR(512),
    @contact_email VARCHAR(255),
    @contact_phone VARCHAR(50)
AS
BEGIN
    UPDATE company_config
    SET company_name = @company_name,
        company_logo = @company_logo,
        address = @address,
        contact_email = @contact_email,
        contact_phone = @contact_phone,
        updated_at = GETDATE()
    WHERE id = @id
END
GO

-- Delete company config
CREATE PROCEDURE sp_delete_company_config
    @id INT
AS
BEGIN
    DELETE FROM company_config WHERE id = @id
END
GO
