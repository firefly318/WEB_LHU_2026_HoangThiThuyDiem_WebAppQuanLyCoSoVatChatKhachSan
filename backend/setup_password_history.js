const sql = require('mssql');
require('dotenv').config();

const config = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || '123456',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'HotelMaterialDB',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

async function run() {
  try {
    const pool = await sql.connect(config);
    console.log('Connected to DB');

    // 1. Create User_Password_History table if missing
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[User_Password_History]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[User_Password_History] (
            [HistoryId] INT IDENTITY(1,1) PRIMARY KEY,
            [UserId] INT NOT NULL,
            [ActionType] NVARCHAR(50) NOT NULL,
            [PerformedBy] NVARCHAR(100) NOT NULL,
            [CreatedAt] DATETIME DEFAULT GETDATE(),
            CONSTRAINT FK_PassHistory_Users FOREIGN KEY (UserId) REFERENCES Users(UserId)
        );
      END
    `);

    // 2. Update sp_User_ResetPassword
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_User_ResetPassword]') AND type in (N'P', N'PC'))
      DROP PROCEDURE [dbo].[sp_User_ResetPassword];
      EXEC('
      CREATE PROCEDURE [dbo].[sp_User_ResetPassword]
          @TargetUserId INT,
          @NewPasswordHash VARCHAR(255),
          @PerformedBy NVARCHAR(100) = N''Admin''
      AS
      BEGIN
          SET NOCOUNT ON;
          UPDATE Users 
          SET PasswordHash = @NewPasswordHash 
          WHERE UserId = @TargetUserId;

          INSERT INTO User_Password_History (UserId, ActionType, PerformedBy)
          VALUES (@TargetUserId, N''ADMIN_RESET'', @PerformedBy);
      END;
      ');
    `);

    // 3. Update sp_User_ChangePassword
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_User_ChangePassword]') AND type in (N'P', N'PC'))
      DROP PROCEDURE [dbo].[sp_User_ChangePassword];
      EXEC('
      CREATE PROCEDURE [dbo].[sp_User_ChangePassword]
          @UserId INT,
          @NewPasswordHash VARCHAR(255)
      AS
      BEGIN
          SET NOCOUNT ON;
          UPDATE Users 
          SET PasswordHash = @NewPasswordHash 
          WHERE UserId = @UserId;

          INSERT INTO User_Password_History (UserId, ActionType, PerformedBy)
          VALUES (@UserId, N''USER_CHANGE'', N''Chính chủ tài khoản'');
      END;
      ');
    `);

    // 4. Create sp_User_GetPasswordHistory
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_User_GetPasswordHistory]') AND type in (N'P', N'PC'))
      DROP PROCEDURE [dbo].[sp_User_GetPasswordHistory];
      EXEC('
      CREATE PROCEDURE [dbo].[sp_User_GetPasswordHistory]
          @UserId INT
      AS
      BEGIN
          SET NOCOUNT ON;
          SELECT HistoryId, UserId, ActionType, PerformedBy, CreatedAt
          FROM User_Password_History
          WHERE UserId = @UserId
          ORDER BY CreatedAt DESC;
      END;
      ');
    `);

    console.log('Successfully set up Password History table and procedures!');
    await pool.close();
  } catch (err) {
    console.error('Error setting up Password History:', err);
  }
}

run();
