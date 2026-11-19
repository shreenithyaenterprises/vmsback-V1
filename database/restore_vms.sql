-- SQL Server Database Restore Script for CEAT_PRE_VMS
-- Update the file paths to match your server instance before running.

RESTORE DATABASE [CEAT_PRE_VMS]
FROM DISK = N'D:\COMPANY WORK\VMS\DB\vms.bak'
WITH FILE = 1,
MOVE N'PremiumVms' TO N'C:\Program Files\Microsoft SQL Server\MSSQL15.SQL2019\MSSQL\DATA\CEAT_PRE_VMS.mdf',
MOVE N'PremiumVms_log' TO N'C:\Program Files\Microsoft SQL Server\MSSQL15.SQL2019\MSSQL\DATA\CEAT_PRE_VMS_log.ldf',
NOUNLOAD, STATS = 10;
