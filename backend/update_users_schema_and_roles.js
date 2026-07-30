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

    // 1. Add Role 3 "Nhân viên kỹ thuật" if missing
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM Roles WHERE RoleName = N'Nhân viên kỹ thuật')
      BEGIN
        INSERT INTO Roles (RoleName) VALUES (N'Nhân viên kỹ thuật');
      END
    `);

    // 2. Add Email column to Users table if missing
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns 
        WHERE object_id = OBJECT_ID(N'Users') AND name = 'Email'
      )
      BEGIN
        ALTER TABLE Users ADD Email VARCHAR(100) NULL;
      END
    `);

    // 3. Update sp_User_GetList
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_User_GetList]') AND type in (N'P', N'PC'))
      DROP PROCEDURE [dbo].[sp_User_GetList];
      EXEC('
      CREATE PROCEDURE [dbo].[sp_User_GetList]
      AS
      BEGIN
          SET NOCOUNT ON;
          SELECT U.UserId, U.Username, U.FullName, U.Email, U.RoleId, R.RoleName, U.IsActive, U.Permissions, U.CreatedAt
          FROM Users U
          INNER JOIN Roles R ON U.RoleId = R.RoleId;
      END;
      ');
    `);

    // 4. Update sp_User_Create
    await pool.request().query(`
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_User_Create]') AND type in (N'P', N'PC'))
      DROP PROCEDURE [dbo].[sp_User_Create];
      EXEC('
      CREATE PROCEDURE [dbo].[sp_User_Create]
          @Username VARCHAR(50),
          @PasswordHash VARCHAR(255),
          @FullName NVARCHAR(100),
          @Email VARCHAR(100) = NULL,
          @RoleId INT = 2,
          @Permissions INT = 7
      AS
      BEGIN
          SET NOCOUNT ON;
          IF EXISTS (SELECT 1 FROM Users WHERE LOWER(Username) = LOWER(@Username))
          BEGIN
              RAISERROR(N''Tên đăng nhập đã tồn tại trong hệ thống!'', 16, 1);
              RETURN;
          END;

          INSERT INTO Users (Username, PasswordHash, FullName, Email, RoleId, Permissions)
          VALUES (@Username, @PasswordHash, @FullName, @Email, @RoleId, @Permissions);

          SELECT SCOPE_IDENTITY() AS NewUserId;
      END;
      ');
    `);

    console.log('Successfully updated DB schema and stored procedures for Email & Role 3!');
    await pool.close();
  } catch (err) {
    console.error('Error updating DB:', err);
  }
}

run();
