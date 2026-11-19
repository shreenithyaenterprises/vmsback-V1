-- ================================================
-- PPE (Personal Protective Equipment) Master Table
-- ================================================

-- Drop existing table and procedure if they exist
IF OBJECT_ID('ppe_master', 'U') IS NOT NULL
    DROP TABLE ppe_master;
GO

IF OBJECT_ID('PPE_Master_GetAll_SP', 'P') IS NOT NULL
    DROP PROCEDURE PPE_Master_GetAll_SP;
GO

-- Create PPE Master table
CREATE TABLE ppe_master (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(100) NOT NULL UNIQUE,
    Description NVARCHAR(255),
    IsActive BIT DEFAULT 1,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME DEFAULT GETDATE()
);
GO

-- Insert default PPE items
INSERT INTO ppe_master (Name, Description) VALUES
('Safety Helmet', 'Hard hat for head protection'),
('Safety Shoes', 'Steel-toe boots for foot protection'),
('Hand Gloves', 'Protective gloves for hands'),
('Safety Jacket', 'High-visibility safety vest'),
('Safety Goggles', 'Eye protection glasses'),
('Ear Plugs', 'Hearing protection equipment'),
('Face Mask', 'Respiratory protection mask'),
('ID Card', 'Temporary visitor identification card'),
('Access Card', 'Electronic access card for gates'),
('Safety Harness', 'Fall protection harness');
GO

-- Create stored procedure to get all active PPE items
CREATE PROCEDURE PPE_Master_GetAll_SP
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        SELECT 
            ID,
            Name,
            Description,
            IsActive
        FROM ppe_master
        WHERE IsActive = 1
        ORDER BY Name ASC
        FOR JSON PATH;
    END TRY
    BEGIN CATCH
        SELECT 
            'false' AS success,
            ERROR_MESSAGE() AS message
        FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
    END CATCH
END;
GO

-- Test the stored procedure
-- EXEC PPE_Master_GetAll_SP;
