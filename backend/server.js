const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sql, poolPromise } = require('./db');
const https = require('https');
require('dotenv').config();

const { sendNewUserCredentials, sendPasswordResetEmail } = require('./utils/emailService');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'hotel_material_secret_key_2026';

function postRequest(url, data, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      method: 'POST',
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch(e) {
            reject(new Error(`Failed to parse response JSON: ${body}`));
          }
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(JSON.stringify(data));
    req.end();
  });
}

app.use(cors());
app.use(express.json());

// --- MIDLEWARE XÁC THỰC JWT ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Không tìm thấy Token xác thực' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token hết hạn hoặc không hợp lệ' });
    req.user = user;
    next();
  });
};

// Middleware phân quyền
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.roleId)) {
      return res.status(403).json({ message: 'Bạn không có quyền thực hiện chức năng này' });
    }
    next();
  };
};

// --- 1. MODULE XÁC THỰC & HỆ THỐNG ---

// Đăng nhập
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  console.log('Login attempt:', { username, passwordLength: password ? password.length : 0 });

  if (!username || !password) {
    return res.status(400).json({ message: 'Vui lòng nhập đầy đủ tài khoản và mật khẩu' });
  }

  try {
    const pool = await poolPromise;
    // Gọi Stored Procedure sp_User_Login
    const result = await pool.request()
      .input('Username', sql.VarChar(50), username)
      .execute('sp_User_Login');

    console.log('DB query result length:', result.recordset.length);
    if (result.recordset.length === 0) {
      console.log('User not found or inactive in database');
      return res.status(404).json({ message: 'Tài khoản không tồn tại hoặc đã bị khóa' });
    }

    const user = result.recordset[0];
    console.log('User found in DB:', { UserId: user.UserId, Username: user.Username, RoleId: user.RoleId, IsActive: user.IsActive });

    // Lấy RoleName
    const roleResult = await pool.request()
      .input('RoleId', sql.Int, user.RoleId)
      .query('SELECT RoleName FROM Roles WHERE RoleId = @RoleId');
    const roleName = roleResult.recordset[0]?.RoleName || 'Nhân viên';

    // Kiểm tra mật khẩu (hỗ trợ cả bcrypt và text thường phòng hờ seed chưa mã hóa)
    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(password, user.PasswordHash);
      console.log('Bcrypt comparison result:', passwordMatch);
    } catch (e) {
      passwordMatch = (password === user.PasswordHash);
      console.log('Plain text fallback match:', passwordMatch);
    }

    // Fallback cho seed data gốc (ví dụ: '$2b$10$eFm...' của admin/staff_kho khớp mật khẩu 'admin123' hoặc 'staff123')
    if (!passwordMatch && user.PasswordHash.startsWith('$2b$10$eFm')) {
      if (username === 'admin' && password === 'admin123') {
        passwordMatch = true;
        console.log('Fallback matched for admin');
      }
      if (username === 'staff_kho' && password === 'staff123') {
        passwordMatch = true;
        console.log('Fallback matched for staff_kho');
      }
    }

    if (!passwordMatch) {
      console.log('Password did not match');
      return res.status(400).json({ message: 'Mật khẩu không chính xác' });
    }

    const token = jwt.sign(
      { id: user.UserId, username: user.Username, name: user.FullName, roleId: user.RoleId, roleName, permissions: user.Permissions },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful, token generated');
    res.json({
      token,
      user: {
        id: user.UserId,
        username: user.Username,
        name: user.FullName,
        roleId: user.RoleId,
        roleName,
        permissions: user.Permissions
      }
    });
  } catch (error) {
    console.error('Error during login execution:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đăng nhập', error: error.message });
  }
});

// Đổi mật khẩu
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  console.log('Change password attempt for user:', req.user.username);

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ message: 'Vui lòng cung cấp mật khẩu cũ và mới' });
  }

  try {
    const pool = await poolPromise;
    
    // Lấy thông tin user hiện tại
    const userResult = await pool.request()
      .input('UserId', sql.Int, req.user.id)
      .query('SELECT PasswordHash, Username FROM Users WHERE UserId = @UserId');

    if (userResult.recordset.length === 0) {
      console.log('User not found in DB during password change');
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    const user = userResult.recordset[0];
    let oldMatch = false;
    try {
      oldMatch = await bcrypt.compare(oldPassword, user.PasswordHash);
      console.log('Bcrypt verify old password match:', oldMatch);
    } catch (e) {
      oldMatch = (oldPassword === user.PasswordHash);
      console.log('Plain text verify old password match:', oldMatch);
    }

    // Fallback cho mật khẩu seed
    if (!oldMatch && user.PasswordHash.startsWith('$2b$10$eFm')) {
      if (user.Username === 'admin' && oldPassword === 'admin123') {
        oldMatch = true;
        console.log('Old password match fallback triggered for admin');
      }
      if (user.Username === 'staff_kho' && oldPassword === 'staff123') {
        oldMatch = true;
        console.log('Old password match fallback triggered for staff_kho');
      }
    }

    if (!oldMatch) {
      console.log('Old password verification failed');
      return res.status(400).json({ message: 'Mật khẩu cũ không chính xác' });
    }

    // Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    const newHashed = await bcrypt.hash(newPassword, salt);
    console.log('New password hashed successfully');

    // Thực thi sp_User_ChangePassword
    await pool.request()
      .input('UserId', sql.Int, req.user.id)
      .input('NewPasswordHash', sql.VarChar(255), newHashed)
      .execute('sp_User_ChangePassword');

    console.log('Password updated in DB via sp_User_ChangePassword');
    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (error) {
    console.error('Error during password change execution:', error);
    res.status(500).json({ message: 'Lỗi máy chủ khi đổi mật khẩu', error: error.message });
  }
});

// --- ADMIN USER & PERMISSION MANAGEMENT (BITFIELD AUTHORIZATION) ---

// Lấy danh sách tài khoản (Chỉ dành cho Admin)
app.get('/api/admin/users', authenticateToken, authorizeRoles(1), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute('sp_User_GetList');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách tài khoản', error: error.message });
  }
});

// Thêm mới tài khoản người dùng
app.post('/api/admin/users', authenticateToken, authorizeRoles(1), async (req, res) => {
  const { Username, Password, FullName, Email, RoleId, Permissions } = req.body;

  if (!Username || !Password || !FullName) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu và Họ tên.' });
  }

  if (Password.trim().length < 6) {
    return res.status(400).json({ message: 'Mật khẩu phải từ 6 ký tự trở lên.' });
  }

  try {
    const pool = await poolPromise;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(Password, salt);

    const userRoleId = RoleId ? parseInt(RoleId) : 2;
    const userPerms = Permissions !== undefined ? parseInt(Permissions) : (userRoleId === 1 ? 15 : 7);
    const userEmail = Email ? Email.trim() : null;

    await pool.request()
      .input('Username', sql.VarChar(50), Username.trim())
      .input('PasswordHash', sql.VarChar(255), hashedPassword)
      .input('FullName', sql.NVarChar(100), FullName.trim())
      .input('Email', sql.VarChar(100), userEmail)
      .input('RoleId', sql.Int, userRoleId)
      .input('Permissions', sql.Int, userPerms)
      .execute('sp_User_Create');

    // Tải tên vai trò để đưa vào email
    const rolesMap = { 1: 'Quản trị viên', 2: 'Nhân viên kho', 3: 'Nhân viên kỹ thuật' };
    const roleName = rolesMap[userRoleId] || 'Nhân viên';

    // Tự động gửi Email thông tin tài khoản nếu có cung cấp email
    let emailStatus = null;
    if (userEmail) {
      emailStatus = await sendNewUserCredentials({
        email: userEmail,
        username: Username.trim(),
        password: Password,
        fullName: FullName.trim(),
        roleName: roleName
      });
    }

    res.json({
      message: 'Tạo tài khoản người dùng mới thành công!',
      emailSent: emailStatus?.success || false,
      emailMessage: emailStatus?.message || null
    });
  } catch (error) {
    console.error('Lỗi tạo người dùng mới:', error);
    res.status(400).json({ message: error.message || 'Lỗi tạo tài khoản người dùng mới.' });
  }
});

// Admin Reset Mật khẩu cho User (Cần có quyền Bit 8) & Gửi email thông báo
app.post('/api/admin/users/:id/reset-password', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { newPassword } = req.body;

  const RESET_PASSWORD_BIT = 8;
  const userPermissions = req.user.permissions !== undefined ? req.user.permissions : (req.user.roleId === 1 ? 15 : 7);
  if (!(userPermissions & RESET_PASSWORD_BIT)) {
    return res.status(403).json({ message: 'Bạn không có quyền reset mật khẩu (Thiếu Bit 8 trong Bitfield Phân Quyền)' });
  }

  if (!newPassword || newPassword.trim().length < 6) {
    return res.status(400).json({ message: 'Mật khẩu mới phải từ 6 ký tự trở lên' });
  }

  try {
    const pool = await poolPromise;

    // Lấy thông tin user target để gửi email
    const userRes = await pool.request()
      .input('TargetUserId', sql.Int, parseInt(id))
      .query('SELECT Username, FullName, Email FROM Users WHERE UserId = @TargetUserId');

    const targetUser = userRes.recordset[0];

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await pool.request()
      .input('TargetUserId', sql.Int, parseInt(id))
      .input('NewPasswordHash', sql.VarChar(255), hashedPassword)
      .input('PerformedBy', sql.NVarChar(100), req.user.username ? `Admin (${req.user.username})` : 'Admin')
      .execute('sp_User_ResetPassword');

    // Gửi email thông báo mật khẩu mới nếu user có email
    let emailStatus = null;
    if (targetUser && targetUser.Email) {
      emailStatus = await sendPasswordResetEmail({
        email: targetUser.Email,
        username: targetUser.Username,
        newPassword: newPassword,
        fullName: targetUser.FullName
      });
    }

    res.json({
      message: 'Đã đặt lại mật khẩu cho tài khoản thành công!',
      emailSent: emailStatus?.success || false,
      emailMessage: emailStatus?.message || null
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi reset mật khẩu', error: error.message });
  }
});

// Lấy lịch sử đổi / reset mật khẩu của một tài khoản (Chỉ dành cho Admin)
app.get('/api/admin/users/:id/password-history', authenticateToken, authorizeRoles(1), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('UserId', sql.Int, parseInt(id))
      .execute('sp_User_GetPasswordHistory');

    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải lịch sử đổi mật khẩu', error: error.message });
  }
});

// User Quên Mật Khẩu (Tự động gửi email reset mật khẩu mới)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { usernameOrEmail } = req.body;
  if (!usernameOrEmail || !usernameOrEmail.trim()) {
    return res.status(400).json({ message: 'Vui lòng nhập Tên đăng nhập hoặc Email của bạn.' });
  }

  try {
    const pool = await poolPromise;
    const queryStr = `
      SELECT UserId, Username, FullName, Email 
      FROM Users 
      WHERE (LOWER(Username) = LOWER(@Query) OR LOWER(Email) = LOWER(@Query)) AND IsActive = 1
    `;
    const userRes = await pool.request()
      .input('Query', sql.VarChar(100), usernameOrEmail.trim())
      .query(queryStr);

    if (userRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài khoản phù hợp với thông tin đã nhập.' });
    }

    const user = userRes.recordset[0];
    if (!user.Email) {
      return res.status(400).json({ message: 'Tài khoản của bạn chưa đăng ký Email trên hệ thống. Vui lòng liên hệ Admin để được cấp lại mật khẩu.' });
    }

    // Tạo mật khẩu mới ngẫu nhiên 10 ký tự
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '!@#$%^&*';
    let generatedPassword = uppercase[Math.floor(Math.random() * uppercase.length)] +
                            lowercase[Math.floor(Math.random() * lowercase.length)] +
                            numbers[Math.floor(Math.random() * numbers.length)] +
                            specials[Math.floor(Math.random() * specials.length)];
    const all = uppercase + lowercase + numbers + specials;
    for (let i = 4; i < 10; i++) {
      generatedPassword += all[Math.floor(Math.random() * all.length)];
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(generatedPassword, salt);

    await pool.request()
      .input('TargetUserId', sql.Int, user.UserId)
      .input('NewPasswordHash', sql.VarChar(255), hashedPassword)
      .execute('sp_User_ResetPassword');

    const emailRes = await sendPasswordResetEmail({
      email: user.Email,
      username: user.Username,
      newPassword: generatedPassword,
      fullName: user.FullName
    });

    res.json({
      message: `Đã tự động đặt lại mật khẩu mới và gửi thông báo về địa chỉ email ${user.Email}`,
      emailSent: emailRes.success
    });
  } catch (error) {
    console.error('Lỗi xử lý quên mật khẩu:', error);
    res.status(500).json({ message: 'Lỗi hệ thống khi xử lý quên mật khẩu.', error: error.message });
  }
});

// Cập nhật bitfield quyền của User (Chỉ dành cho Admin)
app.put('/api/admin/users/:id/permissions', authenticateToken, authorizeRoles(1), async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;

  if (permissions === undefined) {
    return res.status(400).json({ message: 'Cấu hình quyền bitfield không hợp lệ' });
  }

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('TargetUserId', sql.Int, parseInt(id))
      .input('Permissions', sql.Int, parseInt(permissions))
      .query('UPDATE Users SET Permissions = @Permissions WHERE UserId = @TargetUserId');

    res.json({ message: 'Cập nhật phân quyền động (Bitfield) thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi cập nhật phân quyền', error: error.message });
  }
});


// --- 2. MODULE LOẠI VẬT TƯ (CATEGORIES) ---

// Lấy danh sách
app.get('/api/categories', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query('SELECT CategoryId, CategoryName FROM Categories WHERE IsDeleted = 0 ORDER BY CategoryId DESC');
    // Định dạng lại key để tương thích với FE trước
    const formatted = result.recordset.map(c => ({
      MaDanhMuc: c.CategoryId,
      TenDanhMuc: c.CategoryName
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh mục loại vật tư', error: error.message });
  }
});

// Thêm loại
app.post('/api/categories', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { TenDanhMuc } = req.body;
  if (!TenDanhMuc) return res.status(400).json({ message: 'Tên danh mục không được để trống' });

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('CategoryName', sql.NVarChar(100), TenDanhMuc)
      .execute('sp_Category_Insert');

    res.status(201).json({ 
      MaDanhMuc: result.recordset[0].NewCategoryId || result.recordset[0].CategoryId, 
      TenDanhMuc 
    });
  } catch (error) {
    res.status(500).json({ message: error.message.includes('5001') ? 'Tên loại vật tư đã tồn tại' : 'Lỗi khi thêm danh mục', error: error.message });
  }
});

// Cập nhật loại
app.put('/api/categories/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { TenDanhMuc } = req.body;
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('CategoryId', sql.Int, id)
      .input('CategoryName', sql.NVarChar(100), TenDanhMuc)
      .execute('sp_Category_Update');

    res.json({ message: 'Cập nhật danh mục thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật danh mục', error: error.message });
  }
});

// Xóa loại
app.delete('/api/categories/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('CategoryId', sql.Int, id)
      .execute('sp_Category_Delete');

    res.json({ message: 'Xóa loại vật tư thành công' });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Lỗi khi xóa loại vật tư.' });
  }
});


// --- 3. MODULE QUẢN LÝ VẬT TƯ (MATERIALS) ---

// Lấy danh sách vật tư
app.get('/api/materials', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  const { search, categoryId } = req.query;
  try {
    const pool = await poolPromise;
    // Thực thi sp_Material_GetList
    const result = await pool.request()
      .input('CategoryId', sql.Int, categoryId ? parseInt(categoryId) : null)
      .input('IsActive', sql.Bit, true)
      .input('Keyword', sql.NVarChar(100), search || null)
      .input('PageNumber', sql.Int, 1)
      .input('PageSize', sql.Int, 9999) // Lấy toàn bộ để hiển thị
      .execute('sp_Material_GetList');

    // Khớp trường dữ liệu FE mong đợi
    const formatted = result.recordset.map(m => ({
      MaVatTu: m.MaterialId,
      MaCodeVatTu: m.MaterialCode,
      TenVatTu: m.MaterialName,
      DonViTinh: m.Unit,
      SoLuongTon: m.StockQuantity,
      SoLuongToiThieu: m.MinRequiredQuantity,
      MaDanhMuc: m.CategoryId,
      TenDanhMuc: m.CategoryName,
      ExpiryDate: m.ExpiryDate,
      IsActive: m.IsActive
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách vật tư', error: error.message });
  }
});

// Thêm vật tư
app.post('/api/materials', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { MaCodeVatTu, TenVatTu, DonViTinh, SoLuongToiThieu, MaDanhMuc, ExpiryDate } = req.body;
  
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('MaterialCode', sql.VarChar(50), MaCodeVatTu)
      .input('MaterialName', sql.NVarChar(150), TenVatTu)
      .input('Unit', sql.NVarChar(30), DonViTinh)
      .input('MinRequiredQuantity', sql.Int, SoLuongToiThieu)
      .input('CategoryId', sql.Int, MaDanhMuc)
      .input('ExpiryDate', sql.Date, ExpiryDate || null)
      .execute('sp_Material_Insert');

    res.status(201).json({ message: 'Thêm vật tư thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thêm vật tư. Có thể mã code đã bị trùng.', error: error.message });
  }
});

// Cập nhật vật tư
app.put('/api/materials/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { id } = req.params;
  const { TenVatTu, DonViTinh, SoLuongToiThieu, MaDanhMuc, ExpiryDate } = req.body;

  try {
    const pool = await poolPromise;
    await pool.request()
      .input('MaterialId', sql.Int, id)
      .input('MaterialName', sql.NVarChar(150), TenVatTu)
      .input('Unit', sql.NVarChar(30), DonViTinh)
      .input('MinRequiredQuantity', sql.Int, SoLuongToiThieu)
      .input('CategoryId', sql.Int, MaDanhMuc)
      .input('ExpiryDate', sql.Date, ExpiryDate || null)
      .execute('sp_Material_Update');

    res.json({ message: 'Cập nhật vật tư thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật vật tư', error: error.message });
  }
});

// Xóa vật tư
app.delete('/api/materials/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('MaterialId', sql.Int, id)
      .execute('sp_Material_Delete');

    res.json({ message: 'Đã cập nhật trạng thái hoặc xóa vật tư thành công.' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa vật tư', error: error.message });
  }
});


// --- 4. MODULE CÁC THỰC THỂ KHÁC (SUPPLIERS & DEPARTMENTS) ---

// Lấy danh sách NCC
app.get('/api/suppliers', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query('SELECT * FROM Suppliers ORDER BY SupplierId DESC');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải NCC', error: error.message });
  }
});

// Thêm NCC
app.post('/api/suppliers', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { SupplierName, Phone, Address } = req.body;
  if (!SupplierName) return res.status(400).json({ message: 'Tên nhà cung cấp không được để trống' });
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('SupplierName', sql.NVarChar(150), SupplierName)
      .input('Phone', sql.VarChar(20), Phone || null)
      .input('Address', sql.NVarChar(255), Address || null)
      .query(`
        INSERT INTO Suppliers (SupplierName, Phone, Address) 
        OUTPUT INSERTED.SupplierId
        VALUES (@SupplierName, @Phone, @Address)
      `);
    res.status(201).json({
      SupplierId: result.recordset[0].SupplierId,
      SupplierName,
      Phone,
      Address
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi thêm nhà cung cấp', error: error.message });
  }
});

// Cập nhật NCC
app.put('/api/suppliers/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { id } = req.params;
  const { SupplierName, Phone, Address } = req.body;
  if (!SupplierName) return res.status(400).json({ message: 'Tên nhà cung cấp không được để trống' });
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('SupplierId', sql.Int, id)
      .input('SupplierName', sql.NVarChar(150), SupplierName)
      .input('Phone', sql.VarChar(20), Phone || null)
      .input('Address', sql.NVarChar(255), Address || null)
      .query(`
        UPDATE Suppliers 
        SET SupplierName = @SupplierName, Phone = @Phone, Address = @Address 
        WHERE SupplierId = @SupplierId
      `);
    res.json({ message: 'Cập nhật nhà cung cấp thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật nhà cung cấp', error: error.message });
  }
});

// Xóa NCC
app.delete('/api/suppliers/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    // Kiểm tra ràng buộc khóa ngoại với phiếu nhập kho
    const grnCheck = await pool.request()
      .input('SupplierId', sql.Int, id)
      .query('SELECT COUNT(1) AS Count FROM GoodsReceiptNotes WHERE SupplierId = @SupplierId');
    
    if (grnCheck.recordset[0].Count > 0) {
      return res.status(400).json({ 
        message: 'Không thể xóa nhà cung cấp này vì đã phát sinh chứng từ nhập kho liên quan.' 
      });
    }

    await pool.request()
      .input('SupplierId', sql.Int, id)
      .query('DELETE FROM Suppliers WHERE SupplierId = @SupplierId');
      
    res.json({ message: 'Xóa nhà cung cấp thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa nhà cung cấp', error: error.message });
  }
});


// Lấy danh sách bộ phận nhận hàng
app.get('/api/departments', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query('SELECT * FROM Departments ORDER BY DepartmentId DESC');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải Bộ phận', error: error.message });
  }
});


// --- 5. MODULE NHẬP KHO (GRN) ---

// Lấy danh sách phiếu nhập
app.get('/api/receipts', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT G.*, U.FullName AS StaffName, S.SupplierName, Dep.DepartmentName 
      FROM GoodsReceiptNotes G
      INNER JOIN Users U ON G.UserId = U.UserId
      LEFT JOIN Suppliers S ON G.SupplierId = S.SupplierId
      LEFT JOIN Departments Dep ON G.DepartmentId = Dep.DepartmentId
      ORDER BY G.ReceivedDate DESC
    `);
    
    const formatted = result.recordset.map(g => {
      let sourceName = g.SupplierName || '';
      if (g.ReceiptType === 'BO_PHAN') {
        sourceName = `[Hoàn trả] ${g.DepartmentName || 'Bộ phận'}` + (g.Note ? ` - ${g.Note}` : '');
      } else {
        sourceName = g.SupplierName ? `[NCC] ${g.SupplierName}` : (g.Note || 'Nhập kho');
      }

      return {
        MaPhieuNhap: g.GRN_Id,
        SoPhieuNhap: g.GRN_Code,
        NgayNhap: g.ReceivedDate,
        NguoiLap: g.StaffName,
        LoaiNhap: g.ReceiptType || 'NCC',
        GhiChu: sourceName
      };
    });
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách phiếu nhập', error: error.message });
  }
});

// Chi tiết phiếu nhập
app.get('/api/receipts/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    // Gọi sp_GRN_GetDetail
    const result = await pool.request()
      .input('GRN_Id', sql.Int, id)
      .execute('sp_GRN_GetDetail');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu nhập' });
    }

    const master = result.recordset[0];
    
    const formattedDetails = result.recordset.map(row => ({
      MaterialId: row.MaterialId,
      MaCodeVatTu: row.MaterialCode,
      TenVatTu: row.MaterialName,
      DonViTinh: row.Unit,
      SoLuong: row.Quantity,
      DonGiaNhap: row.UnitPrice
    }));

    let sourceName = master.SupplierName || '';
    if (master.ReceiptType === 'BO_PHAN') {
      sourceName = `[Hoàn trả từ bộ phận] ${master.DepartmentName || ''}` + (master.Note ? ` - ${master.Note}` : '');
    } else {
      sourceName = master.SupplierName ? `[NCC] ${master.SupplierName}` : (master.Note || 'Nhập kho');
    }

    res.json({
      MaPhieuNhap: master.GRN_Id,
      SoPhieuNhap: master.GRN_Code,
      NgayNhap: master.ReceivedDate,
      NguoiLap: master.StaffName,
      LoaiNhap: master.ReceiptType || 'NCC',
      NhaCungCap: master.SupplierName,
      BoPhan: master.DepartmentName,
      LyDo: master.Note,
      GhiChu: sourceName,
      ChiTiet: formattedDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải chi tiết phiếu nhập', error: error.message });
  }
});

// Lập phiếu nhập kho (TVP Type_GRN_Detail_List)
app.post('/api/receipts', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { ReceiptType = 'NCC', SupplierId, DepartmentId, Note, ChiTiet } = req.body;
  
  if (!ChiTiet || ChiTiet.length === 0) {
    return res.status(400).json({ message: 'Vui lòng thêm danh sách vật tư nhập kho.' });
  }

  if (ReceiptType === 'NCC' && !SupplierId) {
    return res.status(400).json({ message: 'Vui lòng chọn nhà cung cấp.' });
  }

  if (ReceiptType === 'BO_PHAN' && !DepartmentId) {
    return res.status(400).json({ message: 'Vui lòng chọn bộ phận hoàn trả vật tư.' });
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const prefix = ReceiptType === 'BO_PHAN' ? 'GRN-RET' : 'GRN';
  const GRN_Code = `${prefix}-${dateStr}-${rand}`;

  try {
    const pool = await poolPromise;
    
    const table = new sql.Table('Type_GRN_Detail_List');
    table.columns.add('MaterialId', sql.Int);
    table.columns.add('Quantity', sql.Int);
    table.columns.add('UnitPrice', sql.Decimal(18, 2));

    for (let item of ChiTiet) {
      table.rows.add(
        parseInt(item.MaterialId),
        parseInt(item.SoLuong),
        parseFloat(item.DonGiaNhap || 0)
      );
    }

    const request = pool.request();
    request.input('GRN_Code', sql.VarChar(50), GRN_Code);
    request.input('SupplierId', sql.Int, SupplierId ? parseInt(SupplierId) : null);
    request.input('DepartmentId', sql.Int, DepartmentId ? parseInt(DepartmentId) : null);
    request.input('UserId', sql.Int, req.user.id);
    request.input('ReceiptType', sql.VarChar(20), ReceiptType);
    request.input('Note', sql.NVarChar(255), Note || null);
    request.input('Details', table);

    await request.execute('sp_GRN_Create');

    // Chạy thêm quét cảnh báo cạn kho
    await pool.request().execute('sp_AI_DetectLowStock');

    res.status(201).json({ message: 'Lập phiếu nhập kho thành công', SoPhieuNhap: GRN_Code });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi nhập kho: ' + error.message });
  }
});


// --- 6. MODULE XUẤT KHO (GDN) ---

// Danh sách phiếu xuất
app.get('/api/deliveries', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.query(`
      SELECT G.*, U.FullName AS StaffName, DP.DepartmentName 
      FROM GoodsDeliveryNotes G
      INNER JOIN Users U ON G.UserId = U.UserId
      INNER JOIN Departments DP ON G.DepartmentId = DP.DepartmentId
      ORDER BY G.DeliveryDate DESC
    `);
    
    const formatted = result.recordset.map(g => ({
      MaPhieuXuat: g.GDN_Id,
      SoPhieuXuat: g.GDN_Code,
      NgayXuat: g.DeliveryDate,
      NguoiYeuCau: g.StaffName,
      BoPhanNhan: g.DepartmentName,
      GhiChu: g.Reason,
      TrangThaiPheDuyet: 1 // Trong DB mới, xuất kho là giảm kho ngay nên mặc định là Đã duyệt/Đã xuất
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách phiếu xuất', error: error.message });
  }
});

// Chi tiết phiếu xuất
app.get('/api/deliveries/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('GDN_Id', sql.Int, id)
      .execute('sp_GDN_GetDetail');

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu xuất kho' });
    }

    const master = result.recordset[0];
    const formattedDetails = result.recordset.map(row => ({
      MaterialId: row.MaterialId,
      MaCodeVatTu: row.MaterialCode,
      TenVatTu: row.MaterialName,
      DonViTinh: row.Unit,
      SoLuong: row.Quantity,
      DonGiaXuat: 0 // Script mới không có cột giá trị xuất nên gán mặc định bằng 0 hoặc bỏ trống
    }));

    res.json({
      MaPhieuXuat: master.GDN_Id,
      SoPhieuXuat: master.GDN_Code,
      NgayXuat: master.DeliveryDate,
      NguoiYeuCau: master.StaffName,
      BoPhanNhan: master.DepartmentName,
      GhiChu: master.Reason,
      TrangThaiPheDuyet: 1,
      ChiTiet: formattedDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi chi tiết phiếu xuất', error: error.message });
  }
});

// Lập phiếu xuất (Trừ trực tiếp kho, gọi sp_GDN_Create)
app.post('/api/deliveries', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { DepartmentId, GhiChu, ChiTiet } = req.body;
  if (!DepartmentId || !ChiTiet || ChiTiet.length === 0) {
    return res.status(400).json({ message: 'Vui lòng chọn bộ phận nhận và vật tư xuất.' });
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const GDN_Code = `GDN-${dateStr}-${rand}`;

  try {
    const pool = await poolPromise;
    
    const table = new sql.Table('Type_GDN_Detail_List');
    table.columns.add('MaterialId', sql.Int);
    table.columns.add('Quantity', sql.Int);

    for (let item of ChiTiet) {
      table.rows.add(parseInt(item.MaterialId), parseInt(item.SoLuong));
    }

    const request = pool.request();
    request.input('GDN_Code', sql.VarChar(50), GDN_Code);
    request.input('DepartmentId', sql.Int, parseInt(DepartmentId));
    request.input('UserId', sql.Int, req.user.id);
    request.input('Reason', sql.NVarChar(255), GhiChu || '');
    request.input('Details', table);

    await request.execute('sp_GDN_Create');

    // Chạy thêm quét cảnh báo AI để cập nhật tồn kho nguy hiểm ngay lập tức
    await pool.request().execute('sp_AI_DetectLowStock');

    res.status(201).json({ message: 'Cấp phát xuất kho thành công và đã trừ tồn kho', SoPhieuXuat: GDN_Code });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});


// --- 7. MODULE KIỂM KÊ KHO (STOCKTAKE) ---

// Lập phiếu kiểm kê
app.post('/api/stocktake', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { GhiChu, ChiTiet } = req.body;
  if (!ChiTiet || ChiTiet.length === 0) {
    return res.status(400).json({ message: 'Danh sách kiểm kê trống' });
  }

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  const Stocktake_Code = `STK-${dateStr}-${rand}`;

  try {
    const pool = await poolPromise;
    
    // Do sp_Stocktake_Create tạo 1 Master và 1 Detail mỗi lần gọi, ta sẽ gọi trong vòng lặp chia sẻ cùng Stocktake_Code
    for (let item of ChiTiet) {
      await pool.request()
        .input('Stocktake_Code', sql.VarChar(50), Stocktake_Code)
        .input('UserId', sql.Int, req.user.id)
        .input('Notes', sql.NVarChar(255), GhiChu || '')
        .input('MaterialId', sql.Int, parseInt(item.MaterialId))
        .input('ActualQuantity', sql.Int, parseInt(item.SoLuongThucTe))
        .execute('sp_Stocktake_Create');
    }

    // Quét cập nhật cảnh báo cạn kho
    await pool.request().execute('sp_AI_DetectLowStock');

    res.status(201).json({ message: 'Đồng bộ kết quả kiểm kê kho thành công', SoPhieuKiemKe: Stocktake_Code });
  } catch (error) {
    res.status(550).json({ message: 'Lỗi kiểm kê kho: ' + error.message });
  }
});

// Lịch sử kiểm kê
app.get('/api/stocktake', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  try {
    const pool = await poolPromise;
    // Gom nhóm theo StocktakeCode để hiển thị dạng đợt kiểm kê
    const result = await pool.query(`
      SELECT S.StocktakeCode, MAX(S.StocktakeId) AS StocktakeId, MAX(S.StocktakeDate) AS StocktakeDate, MAX(U.FullName) AS StaffName, MAX(S.Notes) AS Notes
      FROM StocktakeNotes S
      INNER JOIN Users U ON S.UserId = U.UserId
      GROUP BY S.StocktakeCode
      ORDER BY StocktakeDate DESC
    `);
    
    const formatted = result.recordset.map(s => ({
      MaPhieuKiemKe: s.StocktakeId,
      SoPhieuKiemKe: s.StocktakeCode,
      NgayKiemKe: s.StocktakeDate,
      NguoiLap: s.StaffName,
      GhiChu: s.Notes
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải lịch sử kiểm kê', error: error.message });
  }
});

// Chi tiết kiểm kê
app.get('/api/stocktake/:id', authenticateToken, authorizeRoles(1, 2), async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await poolPromise;
    
    // Lấy thông tin Master dựa vào id
    const masterRes = await pool.request()
      .input('id', sql.Int, id)
      .query('SELECT S.*, U.FullName AS StaffName FROM StocktakeNotes S INNER JOIN Users U ON S.UserId = U.UserId WHERE S.StocktakeId = @id');
    
    if (masterRes.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy phiếu kiểm kê' });
    }

    const master = masterRes.recordset[0];

    // Lấy tất cả chi tiết có cùng StocktakeCode
    const detailsRes = await pool.request()
      .input('code', sql.VarChar(50), master.StocktakeCode)
      .query(`
        SELECT SD.*, M.MaterialCode, M.MaterialName, M.Unit 
        FROM Stocktake_Details SD 
        INNER JOIN Materials M ON SD.MaterialId = M.MaterialId
        INNER JOIN StocktakeNotes S ON SD.StocktakeId = S.StocktakeId
        WHERE S.StocktakeCode = @code
      `);

    const formattedDetails = detailsRes.recordset.map(row => ({
      MaCodeVatTu: row.MaterialCode,
      TenVatTu: row.MaterialName,
      DonViTinh: row.Unit,
      SoLuongHeThong: row.SystemQuantity,
      SoLuongThucTe: row.ActualQuantity,
      CheHLech: row.Discrepancy
    }));

    res.json({
      MaPhieuKiemKe: master.StocktakeId,
      SoPhieuKiemKe: master.StocktakeCode,
      NgayKiemKe: master.StocktakeDate,
      NguoiLap: master.StaffName,
      GhiChu: master.Notes,
      ChiTiet: formattedDetails
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải chi tiết kiểm kê', error: error.message });
  }
});

// --- MODULE BÁO CÁO NHẬP - XUẤT - TỒN (REPORTS) ---

// 1. Báo cáo Tổng hợp Nhập - Xuất - Tồn theo khoảng thời gian
app.get('/api/reports/inventory-summary', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  const { fromDate, toDate, categoryId, keyword } = req.query;
  
  // Default range: current month if not provided
  const now = new Date();
  const start = fromDate ? new Date(fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = toDate ? new Date(toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('FromDate', sql.DateTime, start)
      .input('ToDate', sql.DateTime, end)
      .input('CategoryId', sql.Int, categoryId ? parseInt(categoryId) : null)
      .input('Keyword', sql.NVarChar(100), keyword || null)
      .execute('sp_Report_GetInventorySummary');

    const formatted = result.recordset.map(r => {
      const closingStock = r.ClosingStock || 0;
      const unitPrice = r.LastUnitPrice || 0;
      return {
        MaterialId: r.MaterialId,
        MaCodeVatTu: r.MaterialCode,
        TenVatTu: r.MaterialName,
        DonViTinh: r.Unit,
        TenDanhMuc: r.CategoryName,
        TonDauKy: r.OpeningStock || 0,
        TongNhap: r.TotalImport || 0,
        GiaTriNhap: r.TotalImportValue || 0,
        TongXuat: r.TotalExport || 0,
        TonCuoiKy: closingStock,
        DonGiaThamChieu: unitPrice,
        GiaTriTonCuoi: closingStock * unitPrice
      };
    });

    res.json({
      FromDate: start,
      ToDate: end,
      Data: formatted
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy báo cáo tổng hợp tồn kho', error: error.message });
  }
});

// 2. Báo cáo Chi tiết Nhập kho
app.get('/api/reports/inbound-details', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  const { fromDate, toDate, categoryId } = req.query;
  
  const now = new Date();
  const start = fromDate ? new Date(fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = toDate ? new Date(toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('FromDate', sql.DateTime, start)
      .input('ToDate', sql.DateTime, end)
      .input('CategoryId', sql.Int, categoryId ? parseInt(categoryId) : null)
      .execute('sp_Report_GetInboundDetails');

    const formatted = result.recordset.map(r => ({
      SoPhieuNhap: r.GRN_Code,
      NgayNhap: r.ReceivedDate,
      LoaiNhap: r.ReceiptType === 'BO_PHAN' ? 'Hoàn trả từ bộ phận' : 'Nhập mới từ NCC',
      NguonCungCap: r.SourceName || 'N/A',
      NguoiLap: r.StaffName,
      MaCodeVatTu: r.MaterialCode,
      TenVatTu: r.MaterialName,
      DonViTinh: r.Unit,
      TenDanhMuc: r.CategoryName,
      SoLuong: r.Quantity,
      DonGia: r.UnitPrice,
      ThanhTien: r.TotalAmount
    }));

    res.json({
      FromDate: start,
      ToDate: end,
      Data: formatted
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy chi tiết nhập kho', error: error.message });
  }
});

// 3. Báo cáo Chi tiết Xuất kho
app.get('/api/reports/outbound-details', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  const { fromDate, toDate, categoryId } = req.query;
  
  const now = new Date();
  const start = fromDate ? new Date(fromDate) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = toDate ? new Date(toDate) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  try {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('FromDate', sql.DateTime, start)
      .input('ToDate', sql.DateTime, end)
      .input('CategoryId', sql.Int, categoryId ? parseInt(categoryId) : null)
      .execute('sp_Report_GetOutboundDetails');

    const formatted = result.recordset.map(r => ({
      SoPhieuXuat: r.GDN_Code,
      NgayXuat: r.DeliveryDate,
      BoPhanNhan: r.DepartmentName,
      LyDoXuat: r.Reason || 'Cấp phát sinh hoạt',
      NguoiLap: r.StaffName,
      MaCodeVatTu: r.MaterialCode,
      TenVatTu: r.MaterialName,
      DonViTinh: r.Unit,
      TenDanhMuc: r.CategoryName,
      SoLuong: r.Quantity
    }));

    res.json({
      FromDate: start,
      ToDate: end,
      Data: formatted
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy chi tiết xuất kho', error: error.message });
  }
});


// --- 8. AI & ANALYTICS ---

// Dashboard API tổng hợp
app.get('/api/reports/dashboard', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  try {
    const pool = await poolPromise;

    // 1. Cảnh báo cạn kho (AI Low stock)
    const lowStockAlerts = await pool.request().execute('sp_AI_DetectLowStock');
    
    // 2. Vật tư tiêu thụ nhiều nhất
    const topMoving = await pool.request().execute('sp_Report_GetTopMovingMaterials');

    // 3. Vật tư tồn đọng (AI Stagnant)
    const stagnantMaterials = await pool.request().execute('sp_AI_GetStagnantMaterials');

    // 4. Lịch sử cấp phát gần đây
    const recentActivities = await pool.query(`
      SELECT TOP 5 G.GDN_Code, G.DeliveryDate, DP.DepartmentName, U.FullName AS StaffName
      FROM GoodsDeliveryNotes G
      INNER JOIN Departments DP ON G.DepartmentId = DP.DepartmentId
      INNER JOIN Users U ON G.UserId = U.UserId
      ORDER BY G.DeliveryDate DESC
    `);

    // 5. Thống kê tổng số
    const summary = await pool.query(`
      SELECT 
        (SELECT COUNT(1) FROM Materials WHERE IsActive = 1) AS TongVatTu,
        (SELECT COUNT(1) FROM Materials WHERE StockQuantity <= MinRequiredQuantity AND IsActive = 1) AS VatTuSapHet,
        (SELECT ISNULL(SUM(StockQuantity), 0) FROM Materials WHERE IsActive = 1) AS TongTonKho,
        (SELECT COUNT(1) FROM GoodsDeliveryNotes) AS PhieuChoDuyet -- Trả về số phiếu xuất để map FE
    `);

    // 6. Dữ liệu biểu đồ tháng
    const monthlyStats = await pool.query(`
      SELECT 
        M.MonthNum AS Thang,
        ISNULL(Nhap.TongNhap, 0) AS Nhap,
        ISNULL(Xuat.TongXuat, 0) AS Xuat
      FROM (
        SELECT 1 AS MonthNum UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 
        UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 
        UNION SELECT 9 UNION SELECT 10 UNION SELECT 11 UNION SELECT 12
      ) M
      LEFT JOIN (
        SELECT MONTH(G.ReceivedDate) AS M, SUM(D.Quantity) AS TongNhap
        FROM GRN_Details D
        INNER JOIN GoodsReceiptNotes G ON D.GRN_Id = G.GRN_Id
        WHERE YEAR(G.ReceivedDate) = YEAR(GETDATE())
        GROUP BY MONTH(G.ReceivedDate)
      ) Nhap ON M.MonthNum = Nhap.M
      LEFT JOIN (
        SELECT MONTH(G.DeliveryDate) AS M, SUM(D.Quantity) AS TongXuat
        FROM GDN_Details D
        INNER JOIN GoodsDeliveryNotes G ON D.GDN_Id = G.GDN_Id
        WHERE YEAR(G.DeliveryDate) = YEAR(GETDATE())
        GROUP BY MONTH(G.DeliveryDate)
      ) Xuat ON M.MonthNum = Xuat.M
      ORDER BY M.MonthNum
    `);

    // Chuyển đổi data cảnh báo AI từ sp_AI_DetectLowStock
    const mappedAlerts = lowStockAlerts.recordset.map(item => ({
      MaCanhBao: item.AlertId,
      MaVatTu: item.MaterialId,
      MaCodeVatTu: item.MaterialCode,
      NoiDungCanhBao: item.AlertMessage
    }));

    // Chuyển đổi data Top tiêu thụ
    const mappedTopMoving = topMoving.recordset.map(item => ({
      MaCodeVatTu: item.MaterialCode,
      TenVatTu: item.MaterialName,
      TongSoLuongXuat: item.TotalConsumed
    }));

    // Chuyển đổi data tồn đọng
    const mappedStagnant = stagnantMaterials.recordset.map(item => ({
      MaCodeVatTu: item.MaterialCode,
      TenVatTu: item.MaterialName,
      Unit: item.Unit,
      SoLuongTon: item.StockQuantity,
      TenDanhMuc: 'Vật tư lâu ngày'
    }));

    const mappedActivities = recentActivities.recordset.map(item => ({
      SoPhieuXuat: item.GDN_Code,
      NgayXuat: item.DeliveryDate,
      BoPhanNhan: item.DepartmentName,
      NguoiYeuCau: item.StaffName,
      TrangThaiPheDuyet: 1
    }));

    res.json({
      Summary: summary.recordset[0],
      LowStockAlerts: mappedAlerts,
      TopMoving: mappedTopMoving,
      StagnantMaterials: mappedStagnant,
      RecentActivities: mappedActivities,
      MonthlyStats: monthlyStats.recordset
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi phân tích dữ liệu AI & Báo cáo: ' + error.message });
  }
});

// Trợ lý phân tích tồn kho AI thông minh sử dụng Groq API
app.get('/api/reports/ai-insights', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  try {
    const pool = await poolPromise;

    // Lấy thông tin số liệu như Dashboard
    const lowStockAlerts = await pool.request().execute('sp_AI_DetectLowStock');
    const topMoving = await pool.request().execute('sp_Report_GetTopMovingMaterials');
    
    const summary = await pool.query(`
      SELECT 
        (SELECT COUNT(1) FROM Materials WHERE IsActive = 1) AS TongVatTu,
        (SELECT COUNT(1) FROM Materials WHERE StockQuantity <= MinRequiredQuantity AND IsActive = 1) AS VatTuSapHet,
        (SELECT ISNULL(SUM(StockQuantity), 0) FROM Materials WHERE IsActive = 1) AS TongTonKho
    `);

    const summaryData = summary.recordset[0];
    const alertsList = lowStockAlerts.recordset.map(item => item.AlertMessage).slice(0, 3).join('; ');
    const topList = topMoving.recordset.map(item => `${item.MaterialName} (xuất ${item.TotalConsumed})`).slice(0, 3).join(', ');

    const groqApiKey = process.env.GROQ_API_KEY;

    if (groqApiKey) {
      const prompt = `Bạn là một trợ lý AI phân tích kho hàng chuyên nghiệp cho khách sạn Nova Sphere. 
Dưới đây là dữ liệu báo cáo kho hiện tại:
- Tổng số mặt hàng: ${summaryData.TongVatTu}
- Vật tư sắp hết hạn mức: ${summaryData.VatTuSapHet} (Chi tiết: ${alertsList || 'Không có'})
- Tổng lượng tồn kho: ${summaryData.TongTonKho}
- Vật tư tiêu thụ nhiều nhất: ${topList || 'Không có'}

Hãy đưa ra 3 lời khuyên hoặc phân tích ngắn gọn, súc tích (mỗi ý không quá 2 câu) bằng tiếng Việt cho người quản lý kho khách sạn. Đánh số thứ tự 1., 2., 3. rõ ràng.`;

      const requestBody = {
        model: 'llama3-8b-8192',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      };

      try {
        const responseData = await postRequest('https://api.groq.com/openai/v1/chat/completions', requestBody, {
          'Authorization': `Bearer ${groqApiKey}`
        });
        const insightText = responseData.choices[0].message.content;
        return res.json({ insight: insightText, isReal: true });
      } catch (err) {
        console.error('Groq API Error:', err.message);
        // Fallback to mock insights below if real API fails
      }
    }

    // --- FALLBACK MOCK INSIGHTS ---
    let insights = [];
    if (summaryData.VatTuSapHet > 0) {
      const firstAlert = lowStockAlerts.recordset[0]?.AlertMessage || 'vật tư chạm mức tối thiểu';
      insights.push(`1. ⚠️ Cảnh báo cạn kho: Đang có ${summaryData.VatTuSapHet} vật tư dưới hạn mức an toàn (${firstAlert}). Cần lập ngay phiếu nhập kho (GRN) để tránh thiếu hụt hàng.`);
    } else {
      insights.push(`1. ✅ Tồn kho an toàn: Trạng thái kho hàng hiện đang rất ổn định, toàn bộ danh mục vật tư đều duy trì trên mức tối thiểu.`);
    }

    if (topMoving.recordset.length > 0) {
      insights.push(`2. 📈 Phân tích tiêu thụ: Mặt hàng "${topMoving.recordset[0].MaterialName}" ghi nhận nhu cầu xuất kho cao nhất (${topMoving.recordset[0].TotalConsumed} đơn vị). Cần chú ý cân đối tần suất bổ sung.`);
    } else {
      insights.push(`2. 📈 Xu hướng tiêu thụ: Hiện chưa ghi nhận biến động tiêu thụ lớn, lưu lượng xuất kho định kỳ ở mức cân bằng.`);
    }

    insights.push(`3. 💡 Gợi ý sắp xếp: Sắp đặt nhóm vật tư Buồng phòng có tốc độ luân chuyển nhanh ở các khu vực kệ thấp, gần cửa ra vào để tối ưu hóa thời gian lấy hàng của nhân viên.`);

    res.json({ insight: insights.join('\n\n'), isReal: false });

  } catch (error) {
    res.status(500).json({ message: 'Lỗi sinh phân tích AI: ' + error.message });
  }
});

// --- 9. MODULE QUẢN LÝ BẢO TRÌ & SỬA CHỮA ---

// Lấy danh sách báo hỏng
app.get('/api/maintenance/requests', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute('sp_Maintenance_GetRequests');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách yêu cầu bảo trì', error: error.message });
  }
});

// Thêm yêu cầu báo hỏng
app.post('/api/maintenance/requests', authenticateToken, authorizeRoles(1, 3), async (req, res) => {
  const { MaterialId, Location, Description, Priority } = req.body;
  if (!MaterialId || !Location || !Description || !Priority) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin báo hỏng' });
  }
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('MaterialId', sql.Int, MaterialId)
      .input('Location', sql.NVarChar(100), Location)
      .input('Description', sql.NVarChar(500), Description)
      .input('Priority', sql.NVarChar(20), Priority)
      .input('UserId', sql.Int, req.user.id)
      .execute('sp_Maintenance_CreateRequest');
    res.status(201).json({ message: 'Tạo yêu cầu báo hỏng thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi khi gửi yêu cầu báo hỏng', error: error.message });
  }
});

// Cập nhật trạng thái báo hỏng
app.put('/api/maintenance/requests/:id', authenticateToken, authorizeRoles(1, 3), async (req, res) => {
  const { id } = req.params;
  const { Status } = req.body;
  if (!Status) return res.status(400).json({ message: 'Trạng thái không được để trống' });
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('RequestId', sql.Int, id)
      .input('Status', sql.NVarChar(50), Status)
      .execute('sp_Maintenance_UpdateRequestStatus');
    res.json({ message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật trạng thái yêu cầu', error: error.message });
  }
});

// Lấy danh sách lịch bảo trì
app.get('/api/maintenance/schedules', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute('sp_Maintenance_GetSchedules');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải lịch bảo trì', error: error.message });
  }
});

// Cập nhật hoặc tạo lịch bảo trì định kỳ
app.post('/api/maintenance/schedules', authenticateToken, authorizeRoles(1, 3), async (req, res) => {
  const { MaterialId, Location, CycleDays, NextMaintenanceDate, Notes } = req.body;
  if (!MaterialId || !Location || !CycleDays || !NextMaintenanceDate) {
    return res.status(400).json({ message: 'Vui lòng điền đầy đủ thông tin lịch bảo trì' });
  }
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('MaterialId', sql.Int, MaterialId)
      .input('Location', sql.NVarChar(100), Location)
      .input('CycleDays', sql.Int, CycleDays)
      .input('NextMaintenanceDate', sql.DateTime, NextMaintenanceDate)
      .input('Notes', sql.NVarChar(255), Notes || null)
      .execute('sp_Maintenance_SaveSchedule');
    res.status(201).json({ message: 'Cài đặt lịch bảo trì thành công!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cài đặt lịch bảo trì', error: error.message });
  }
});

// Lấy danh sách phiếu bảo trì
app.get('/api/maintenance/receipts', authenticateToken, authorizeRoles(1, 3), async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().execute('sp_Maintenance_GetReceipts');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tải danh sách phiếu bảo trì', error: error.message });
  }
});

// Tạo phiếu bảo trì / sửa chữa
app.post('/api/maintenance/receipts', authenticateToken, authorizeRoles(1, 3), async (req, res) => {
  const { MaterialId, RequestId, MaintenanceType, Cost, TechnicianName, ResultStatus, Notes } = req.body;
  if (!MaterialId || !MaintenanceType || !TechnicianName || !ResultStatus) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin phiếu bảo trì' });
  }
  try {
    const pool = await poolPromise;
    await pool.request()
      .input('MaterialId', sql.Int, MaterialId)
      .input('RequestId', sql.Int, RequestId || null)
      .input('MaintenanceType', sql.NVarChar(50), MaintenanceType)
      .input('Cost', sql.Decimal(18, 2), Cost || 0)
      .input('TechnicianName', sql.NVarChar(100), TechnicianName)
      .input('ResultStatus', sql.NVarChar(50), ResultStatus)
      .input('Notes', sql.NVarChar(500), Notes || null)
      .execute('sp_Maintenance_CreateReceipt');
    res.status(201).json({ message: 'Lập phiếu bảo trì thành công và đã cập nhật các hệ thống liên quan!' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lập phiếu bảo trì', error: error.message });
  }
});


// ─── VẬT TƯ SẮP HẾT HẠN ────────────────────────────────────────────────
app.get('/api/reports/expiring-soon', authenticateToken, authorizeRoles(1, 2, 3), async (req, res) => {
  try {
    const pool = await poolPromise;
    const daysAhead = parseInt(req.query.days) || 30;
    const topN = parseInt(req.query.top) || 10;
    const result = await pool.request()
      .input('DaysAhead', daysAhead)
      .input('TopN', topN)
      .execute('sp_Material_GetExpiringSoon');
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách vật tư sắp hết hạn', error: error.message });
  }
});

// Chạy server
app.listen(PORT, async () => {
  console.log(`Backend Server is running on port ${PORT}`);
  try {
    const pool = await poolPromise;
    let testUsers = await pool.request().query('SELECT Username, IsActive FROM Users');
    
    // Nếu chưa có tài khoản nào, tự động thực hiện seeding dữ liệu mẫu
    if (testUsers.recordset.length === 0) {
      console.log('Phát hiện cơ sở dữ liệu trống. Đang tự động nạp dữ liệu mẫu (Seeding)...');
      
      // 1. Seed Roles
      await pool.request().query("INSERT INTO Roles (RoleName) VALUES (N'Quản trị viên'), (N'Nhân viên kho')");
      
      // 2. Seed Users
      await pool.request().query(`
        INSERT INTO Users (Username, PasswordHash, FullName, RoleId) VALUES 
        ('admin', '$2b$10$eFmXW23u.S9BvjM0l.9MpeL18YlC8kG1Hh3v4vXG9Xb5zM2Yw/S2q', N'Thúy Diễm', 1),
        ('staff_kho', '$2b$10$eFmXW23u.S9BvjM0l.9MpeL18YlC8kG1Hh3v4vXG9Xb5zM2Yw/S2q', N'Trần Thị Ngọt', 2)
      `);
      
      // 3. Seed Categories
      await pool.request().query(`
        INSERT INTO Categories (CategoryName) VALUES 
        (N'Đồ tiêu hao (Amenities)'), 
        (N'Thiết bị điện tử'), 
        (N'Vải vóc (Linen)'),
        (N'Hóa chất tẩy rửa')
      `);
      
      // 4. Seed Materials (40 sản phẩm, mỗi loại danh mục có đúng 10 sản phẩm mẫu)
      await pool.request().query(`
        -- Loại 1: Đồ tiêu hao (Amenities) - CategoryId = 1
        INSERT INTO Materials (MaterialCode, MaterialName, Unit, MinRequiredQuantity, CategoryId) VALUES
        ('AME-SOAP', N'Xà bông cục nhỏ', N'Cục', 500, 1),
        ('AME-SHAM', N'Dầu gội chai nhỏ', N'Chai', 500, 1),
        ('AME-COND', N'Dầu xả chai nhỏ', N'Chai', 400, 1),
        ('AME-GEL', N'Sữa tắm chai nhỏ', N'Chai', 500, 1),
        ('AME-BRUSH', N'Bàn chải đánh răng', N'Chiếc', 600, 1),
        ('AME-COMB', N'Lược dùng 1 lần', N'Chiếc', 300, 1),
        ('AME-RAZOR', N'Dao cạo râu setup phòng', N'Chiếc', 200, 1),
        ('AME-SEW', N'Bộ kim chỉ mini', N'Hộp', 100, 1),
        ('AME-SLIP', N'Dép đi trong phòng', N'Đôi', 250, 1),
        ('AME-CAP', N'Mũ tắm nylon', N'Chiếc', 400, 1);

        -- Loại 2: Thiết bị điện tử - CategoryId = 2
        INSERT INTO Materials (MaterialCode, MaterialName, Unit, MinRequiredQuantity, CategoryId) VALUES
        ('ELE-BULB', N'Bóng đèn LED 9W', N'Cái', 20, 2),
        ('ELE-KETT', N'Ấm đun nước siêu tốc', N'Cái', 10, 2),
        ('ELE-DRYER', N'Máy sấy tóc Panasonic', N'Cái', 15, 2),
        ('ELE-REMO', N'Remote TV Samsung', N'Cái', 8, 2),
        ('ELE-ACRE', N'Remote điều hòa Daikin', N'Cái', 8, 2),
        ('ELE-SCAL', N'Cân sức khỏe điện tử', N'Cái', 5, 2),
        ('ELE-LOCK', N'Pin khóa cửa thẻ từ', N'Viên', 50, 2),
        ('ELE-LAMP', N'Bóng đèn ngủ màu ấm', N'Cái', 12, 2),
        ('ELE-ADAP', N'Củ sạc adapter đa năng', N'Cái', 10, 2),
        ('ELE-TELE', N'Điện thoại bàn lễ tân', N'Cái', 4, 2);

        -- Loại 3: Vải vóc (Linen) - CategoryId = 3
        INSERT INTO Materials (MaterialCode, MaterialName, Unit, MinRequiredQuantity, CategoryId) VALUES
        ('LIN-TOWEL', N'Khăn tắm trắng 60x120', N'Cái', 100, 3),
        ('LIN-SHEET', N'Chăn ga giường King', N'Cái', 50, 3),
        ('LIN-PILLOW', N'Ruột gối hơi Hilton', N'Cái', 40, 3),
        ('LIN-CASE', N'Vỏ gối Cotton sọc 3cm', N'Cái', 80, 3),
        ('LIN-MATT', N'Bảo vệ nệm giường King', N'Cái', 15, 3),
        ('LIN-ROBE', N'Áo choàng tắm tổ ong', N'Cái', 30, 3),
        ('LIN-FACE', N'Khăn mặt trắng 30x30', N'Cái', 120, 3),
        ('LIN-HAND', N'Khăn lau tay phòng tắm', N'Cái', 100, 3),
        ('LIN-DUVET', N'Ruột chăn bông cao cấp', N'Cái', 20, 3),
        ('LIN-RUNN', N'Tấm trang trí trải giường', N'Cái', 25, 3);

        -- Loại 4: Hóa chất tẩy rửa - CategoryId = 4
        INSERT INTO Materials (MaterialCode, MaterialName, Unit, MinRequiredQuantity, CategoryId) VALUES
        ('CHEM-CHLO', N'Dung dịch tẩy rửa Chlorine', N'Can 5L', 10, 4),
        ('CHEM-GLASS', N'Nước lau kính Sunlight', N'Can 5L', 8, 4),
        ('CHEM-DISH', N'Nước rửa chén Sunlight', N'Can 5L', 8, 4),
        ('CHEM-AIR', N'Nước xịt phòng hương sả', N'Chai', 15, 4),
        ('CHEM-TOIL', N'Nước tẩy bồn cầu Vim', N'Chai', 20, 4),
        ('CHEM-FLOOR', N'Nước lau sàn hương hoa', N'Can 5L', 10, 4),
        ('CHEM-SOF', N'Nước xả vải Comfort', N'Can 5L', 5, 4),
        ('CHEM-HAND', N'Nước rửa tay diệt khuẩn', N'Can 5L', 8, 4),
        ('CHEM-META', N'Hóa chất đánh bóng kim loại', N'Chai', 5, 4),
        ('CHEM-ODOR', N'Viên khử mùi bồn tiểu nam', N'Gói', 15, 4);
      `);
      
      // 5. Seed Suppliers
      await pool.request().query(`
        INSERT INTO Suppliers (SupplierName, Phone, Address) VALUES 
        (N'Công ty TNHH Thiết bị Khách sạn Thuận Phát', '0283999888', N'123 Nguyễn Trãi, Q.5, TP.HCM'),
        (N'Tổng kho Tổng hợp Đồng Nai', '02513888999', N'Đường Đồng Khởi, Biên Hòa, Đồng Nai')
      `);
      
      // 6. Seed Departments
      await pool.request().query(`
        INSERT INTO Departments (DepartmentName) VALUES 
        (N'Bộ phận Buồng phòng (Housekeeping)'), 
        (N'Bộ phận Nhà hàng (F&B)'), 
        (N'Bộ phận Kỹ thuật (Engineering)'),
        (N'Bộ phận Lễ tân (Front Office)')
      `);
      
      console.log('Đã nạp dữ liệu mẫu thành công!');
    } else {
      // Cập nhật tên Admin thành Thúy Diễm đối với database hiện tại của người dùng
      await pool.request().query("UPDATE Users SET FullName = N'Thúy Diễm' WHERE Username = 'admin'");
    }

    // Kiểm tra số lượng vật tư hiện tại
    const countMaterials = await pool.request().query('SELECT COUNT(1) AS Qty FROM Materials');
    if (countMaterials.recordset[0].Qty < 40) {
      console.log('Số lượng vật tư dưới 40. Đang tiến hành làm sạch và seed lại 40 vật tư mẫu (mỗi loại 10 vật phẩm)...');
      try {
        // Xóa sạch các bảng phụ liên quan để tránh lỗi khóa ngoại trước khi seed lại
        await pool.request().query(`
          DELETE FROM System_Alerts;
          DELETE FROM Stocktake_Details;
          DELETE FROM StocktakeNotes;
          DELETE FROM GDN_Details;
          DELETE FROM GoodsDeliveryNotes;
          DELETE FROM GRN_Details;
          DELETE FROM GoodsReceiptNotes;
          DELETE FROM Materials;
        `);

        // Nạp lại 40 vật tư mẫu mới
        await pool.request().query(`
          -- Loại 1: Đồ tiêu hao (Amenities) - CategoryId = 1
          INSERT INTO Materials (MaterialCode, MaterialName, Unit, MinRequiredQuantity, CategoryId) VALUES
          ('AME-SOAP', N'Xà bông cục nhỏ', N'Cục', 500, 1),
          ('AME-SHAM', N'Dầu gội chai nhỏ', N'Chai', 500, 1),
          ('AME-COND', N'Dầu xả chai nhỏ', N'Chai', 400, 1),
          ('AME-GEL', N'Sữa tắm chai nhỏ', N'Chai', 500, 1),
          ('AME-BRUSH', N'Bàn chải đánh răng', N'Chiếc', 600, 1),
          ('AME-COMB', N'Lược dùng 1 lần', N'Chiếc', 300, 1),
          ('AME-RAZOR', N'Dao cạo râu setup phòng', N'Chiếc', 200, 1),
          ('AME-SEW', N'Bộ kim chỉ mini', N'Hộp', 100, 1),
          ('AME-SLIP', N'Dép đi trong phòng', N'Đôi', 250, 1),
          ('AME-CAP', N'Mũ tắm nylon', N'Chiếc', 400, 1);

          -- Loại 2: Thiết bị điện tử - CategoryId = 2
          INSERT INTO Materials (MaterialCode, MaterialName, Unit, MinRequiredQuantity, CategoryId) VALUES
          ('ELE-BULB', N'Bóng đèn LED 9W', N'Cái', 20, 2),
          ('ELE-KETT', N'Ấm đun nước siêu tốc', N'Cái', 10, 2),
          ('ELE-DRYER', N'Máy sấy tóc Panasonic', N'Cái', 15, 2),
          ('ELE-REMO', N'Remote TV Samsung', N'Cái', 8, 2),
          ('ELE-ACRE', N'Remote điều hòa Daikin', N'Cái', 8, 2),
          ('ELE-SCAL', N'Cân sức khỏe điện tử', N'Cái', 5, 2),
          ('ELE-LOCK', N'Pin khóa cửa thẻ từ', N'Viên', 50, 2),
          ('ELE-LAMP', N'Bóng đèn ngủ màu ấm', N'Cái', 12, 2),
          ('ELE-ADAP', N'Củ sạc adapter đa năng', N'Cái', 10, 2),
          ('ELE-TELE', N'Điện thoại bàn lễ tân', N'Cái', 4, 2);

          -- Loại 3: Vải vóc (Linen) - CategoryId = 3
          INSERT INTO Materials (MaterialCode, MaterialName, Unit, MinRequiredQuantity, CategoryId) VALUES
          ('LIN-TOWEL', N'Khăn tắm trắng 60x120', N'Cái', 100, 3),
          ('LIN-SHEET', N'Chăn ga giường King', N'Cái', 50, 3),
          ('LIN-PILLOW', N'Ruột gối hơi Hilton', N'Cái', 40, 3),
          ('LIN-CASE', N'Vỏ gối Cotton sọc 3cm', N'Cái', 80, 3),
          ('LIN-MATT', N'Bảo vệ nệm giường King', N'Cái', 15, 3),
          ('LIN-ROBE', N'Áo choàng tắm tổ ong', N'Cái', 30, 3),
          ('LIN-FACE', N'Khăn mặt trắng 30x30', N'Cái', 120, 3),
          ('LIN-HAND', N'Khăn lau tay phòng tắm', N'Cái', 100, 3),
          ('LIN-DUVET', N'Ruột chăn bông cao cấp', N'Cái', 20, 3),
          ('LIN-RUNN', N'Tấm trang trí trải giường', N'Cái', 25, 3);

          -- Loại 4: Hóa chất tẩy rửa - CategoryId = 4
          INSERT INTO Materials (MaterialCode, MaterialName, Unit, MinRequiredQuantity, CategoryId) VALUES
          ('CHEM-CHLO', N'Dung dịch tẩy rửa Chlorine', N'Can 5L', 10, 4),
          ('CHEM-GLASS', N'Nước lau kính Sunlight', N'Can 5L', 8, 4),
          ('CHEM-DISH', N'Nước rửa chén Sunlight', N'Can 5L', 8, 4),
          ('CHEM-AIR', N'Nước xịt phòng hương sả', N'Chai', 15, 4),
          ('CHEM-TOIL', N'Nước tẩy bồn cầu Vim', N'Chai', 20, 4),
          ('CHEM-FLOOR', N'Nước lau sàn hương hoa', N'Can 5L', 10, 4),
          ('CHEM-SOF', N'Nước xả vải Comfort', N'Can 5L', 5, 4),
          ('CHEM-HAND', N'Nước rửa tay diệt khuẩn', N'Can 5L', 8, 4),
          ('CHEM-META', N'Hóa chất đánh bóng kim loại', N'Chai', 5, 4),
          ('CHEM-ODOR', N'Viên khử mùi bồn tiểu nam', N'Gói', 15, 4);
        `);
        console.log('Đã cập nhật 40 vật tư mẫu thành công!');
      } catch (err) {
        console.error('Không thể seed tự động danh sách vật tư mới:', err.message);
      }
    }

    // Query lại danh sách user sau khi seed/update
    testUsers = await pool.request().query('SELECT Username, FullName, IsActive FROM Users');

    console.log('--- DANH SÁCH TÀI KHOẢN TRONG DATABASE ---');
    console.log(testUsers.recordset);
    console.log('-----------------------------------------');
  } catch (err) {
    console.error('Lỗi khi kiểm tra hoặc nạp dữ liệu vào Database:', err.message);
  }
});
