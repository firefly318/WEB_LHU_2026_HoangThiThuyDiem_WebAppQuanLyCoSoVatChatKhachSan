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

    const createSpSql = `
      IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_User_Create]') AND type in (N'P', N'PC'))
      DROP PROCEDURE [dbo].[sp_User_Create];
      EXEC('
      CREATE PROCEDURE [dbo].[sp_User_Create]
          @Username VARCHAR(50),
          @PasswordHash VARCHAR(255),
          @FullName NVARCHAR(100),
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

          INSERT INTO Users (Username, PasswordHash, FullName, RoleId, Permissions)
          VALUES (@Username, @PasswordHash, @FullName, @RoleId, @Permissions);

          SELECT SCOPE_IDENTITY() AS NewUserId;
      END;
      ');
    `;

    await pool.request().query(createSpSql);
    console.log('Created sp_User_Create successfully!');
    await pool.close();
  } catch (err) {
    console.error('Error creating SP:', err);
  }
}

run();
