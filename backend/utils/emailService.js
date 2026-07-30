const nodemailer = require('nodemailer');

// Configure transporter with environment variables or fallback
const createTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  }
  return null;
};

/**
 * Gửi thông tin tài khoản người dùng mới qua Email
 */
async function sendNewUserCredentials({ email, username, password, fullName, roleName }) {
  if (!email) return { success: false, message: 'Không có địa chỉ email' };

  const transporter = createTransporter();
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
      <div style="background-color: #0284c7; color: white; padding: 15px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; text-transform: uppercase;">NOVA SPHERE HOTEL</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px;">Hệ thống Quản lý Cơ sở vật chất & Vật tư Khách sạn</p>
      </div>

      <div style="padding: 20px; color: #334155; line-height: 1.6;">
        <h3 style="color: #0f172a;">Kính gửi ${fullName},</h3>
        <p>Tài khoản của bạn đã được quản trị viên khởi tạo thành công trên hệ thống <strong>NoVa Sphere Hotel & Inventory</strong>.</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #0284c7; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 4px 0;"><strong>Tên đăng nhập:</strong> <span style="font-family: monospace; font-size: 15px; color: #0284c7; font-weight: bold;">${username}</span></p>
          <p style="margin: 4px 0;"><strong>Mật khẩu khởi tạo:</strong> <span style="font-family: monospace; font-size: 15px; color: #dc2626; font-weight: bold;">${password}</span></p>
          <p style="margin: 4px 0;"><strong>Vai trò hệ thống:</strong> ${roleName || 'Nhân viên'}</p>
        </div>

        <p style="font-size: 13px; color: #64748b;">⚠️ <em>Vui lòng đăng nhập và đổi mật khẩu mới ngay trong lần sử dụng đầu tiên để bảo mật tài khoản.</em></p>
      </div>

      <div style="text-align: center; font-size: 12px; color: #94a3b8; padding-top: 15px; border-t: 1px solid #e2e8f0;">
        <p>© 2026 NoVa Sphere Hotel Management. All rights reserved.</p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"NoVa Sphere Hotel System" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `[NoVa Sphere Hotel] Thông tin tài khoản mới - ${username}`,
        html: htmlContent
      });
      return { success: true, message: 'Đã gửi email thành công' };
    } catch (err) {
      console.error('Lỗi khi gửi mail SMTP:', err);
      return { success: false, message: err.message };
    }
  } else {
    console.log(`\n================ MOCK EMAIL SENT (NEW USER) ================`);
    console.log(`To: ${email}`);
    console.log(`Subject: [NoVa Sphere Hotel] Thông tin tài khoản mới - ${username}`);
    console.log(`Username: ${username} | Password: ${password}`);
    console.log(`============================================================\n`);
    return { success: true, message: 'Đã giả lập gửi email (Chưa cấu hình SMTP)' };
  }
}

/**
 * Gửi email cập nhật mật khẩu mới khi Reset mật khẩu / Quên mật khẩu
 */
async function sendPasswordResetEmail({ email, username, newPassword, fullName }) {
  if (!email) return { success: false, message: 'Không có địa chỉ email' };

  const transporter = createTransporter();
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
      <div style="background-color: #be123c; color: white; padding: 15px 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; text-transform: uppercase;">NOVA SPHERE HOTEL</h2>
        <p style="margin: 5px 0 0 0; font-size: 13px;">Thông báo Cập nhật / Đặt lại Mật khẩu Tài khoản</p>
      </div>

      <div style="padding: 20px; color: #334155; line-height: 1.6;">
        <h3 style="color: #0f172a;">Kính gửi ${fullName},</h3>
        <p>Mật khẩu đăng nhập hệ thống của tài khoản <strong style="color: #0284c7;">${username}</strong> đã được cập nhật thành công.</p>
        
        <div style="background-color: #fff1f2; border-left: 4px solid #be123c; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 4px 0;"><strong>Tên đăng nhập:</strong> <span style="font-family: monospace; font-size: 15px; color: #0f172a; font-weight: bold;">${username}</span></p>
          <p style="margin: 4px 0;"><strong>Mật khẩu mới:</strong> <span style="font-family: monospace; font-size: 15px; color: #be123c; font-weight: bold;">${newPassword}</span></p>
        </div>

        <p style="font-size: 13px; color: #64748b;">Nếu bạn không yêu cầu thay đổi mật khẩu này, vui lòng liên hệ ngay với Quản trị viên hệ thống để được hỗ trợ.</p>
      </div>

      <div style="text-align: center; font-size: 12px; color: #94a3b8; padding-top: 15px; border-t: 1px solid #e2e8f0;">
        <p>© 2026 NoVa Sphere Hotel Management. All rights reserved.</p>
      </div>
    </div>
  `;

  if (transporter) {
    try {
      await transporter.sendMail({
        from: `"NoVa Sphere Hotel System" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `[NoVa Sphere Hotel] Mật khẩu mới cho tài khoản ${username}`,
        html: htmlContent
      });
      return { success: true, message: 'Đã gửi email cập nhật mật khẩu thành công' };
    } catch (err) {
      console.error('Lỗi khi gửi mail SMTP reset password:', err);
      return { success: false, message: err.message };
    }
  } else {
    console.log(`\n================ MOCK EMAIL SENT (PASSWORD RESET) ================`);
    console.log(`To: ${email}`);
    console.log(`Subject: [NoVa Sphere Hotel] Mật khẩu mới cho tài khoản ${username}`);
    console.log(`Username: ${username} | New Password: ${newPassword}`);
    console.log(`=================================================================\n`);
    return { success: true, message: 'Đã giả lập gửi email reset mật khẩu' };
  }
}

module.exports = {
  sendNewUserCredentials,
  sendPasswordResetEmail
};
