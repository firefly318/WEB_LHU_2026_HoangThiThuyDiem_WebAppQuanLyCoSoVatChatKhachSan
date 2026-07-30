import React, { useState, useEffect } from 'react';
import api from '../api';
import { Shield, Key, CheckSquare, Square, AlertCircle, RefreshCw, X, Save, Copy, Check, UserPlus, History, Mail, Calendar, Clock } from 'lucide-react';

export default function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Toast email status state
  const [emailToast, setEmailToast] = useState(null);

  // Password history states
  const [historyUser, setHistoryUser] = useState(null);
  const [passHistory, setPassHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Create user states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [newRoleId, setNewRoleId] = useState(2);
  const [createPermBits, setCreatePermBits] = useState(7);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);

  // Reset password states
  const [resetUser, setResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetError, setResetError] = useState(null);
  const [resetSuccess, setResetSuccess] = useState(null);
  const [copied, setCopied] = useState(false);

  // Edit permissions states
  const [editUser, setEditUser] = useState(null);
  const [permBits, setPermBits] = useState(0);
  const [editError, setEditError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/users');
      setUsers(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Lỗi khi tải danh sách tài khoản.');
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const length = 10;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '!@#$%^&*';
    
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += specials[Math.floor(Math.random() * specials.length)];
    
    const allChars = uppercase + lowercase + numbers + specials;
    for (let i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    return password.split('').sort(() => 0.5 - Math.random()).join('');
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
    setNewUsername('');
    setNewFullName('');
    setNewEmail('');
    setNewPasswordInput(generateRandomPassword());
    setNewRoleId(2);
    setCreatePermBits(7);
    setCreateError(null);
    setCreateSuccess(null);
  };

  const handleToggleCreateBit = (bitValue) => {
    setCreatePermBits(prev => prev ^ bitValue);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    if (!newUsername.trim() || !newFullName.trim() || !newPasswordInput.trim()) {
      setCreateError('Vui lòng điền đầy đủ Tên đăng nhập, Mật khẩu và Họ tên.');
      return;
    }

    if (newPasswordInput.trim().length < 6) {
      setCreateError('Mật khẩu khởi tạo phải từ 6 ký tự trở lên.');
      return;
    }

    try {
      const res = await api.post('/admin/users', {
        Username: newUsername.trim(),
        FullName: newFullName.trim(),
        Email: newEmail.trim(),
        Password: newPasswordInput.trim(),
        RoleId: parseInt(newRoleId),
        Permissions: parseInt(createPermBits)
      });

      const emailSent = res.data.emailSent;
      const userEmail = newEmail.trim();
      let emailNotice = '';
      if (userEmail) {
        if (emailSent) {
          emailNotice = `✉️ ĐÃ GỬI EMAIL THÀNH CÔNG: Thông tin tài khoản đã được chuyển tới hòm thư ${userEmail}`;
        } else {
          emailNotice = `⚠️ CHƯA GỬI ĐƯỢC EMAIL: ${res.data.emailMessage || 'Không thể kết nối máy chủ Mail'}`;
        }
      } else {
        emailNotice = 'ℹ️ Không có địa chỉ Email (Tài khoản không nhận thông báo tự động)';
      }

      const successText = `Tạo tài khoản ${newUsername.trim()} thành công! ${emailNotice}`;
      setCreateSuccess(successText);
      setEmailToast({
        type: emailSent ? 'success' : (userEmail ? 'warning' : 'info'),
        title: `Tạo tài khoản "${newUsername.trim()}" thành công`,
        message: emailNotice,
        email: userEmail
      });

      fetchUsers();
      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess(null);
      }, 3000);
    } catch (err) {
      setCreateError(err.response?.data?.message || err.message || 'Lỗi khi tạo tài khoản người dùng.');
    }
  };

  const handleOpenReset = (user) => {
    setResetUser(user);
    const pwd = generateRandomPassword();
    setNewPassword(pwd);
    setResetError(null);
    setResetSuccess(null);
    setCopied(false);
  };

  const handleCopyPassword = () => {
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegeneratePassword = () => {
    const pwd = generateRandomPassword();
    setNewPassword(pwd);
    setCopied(false);
  };

  const handleOpenHistory = async (user) => {
    setHistoryUser(user);
    setPassHistory([]);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/admin/users/${user.UserId}/password-history`);
      setPassHistory(res.data || []);
    } catch (err) {
      console.error('Lỗi khi tải lịch sử đổi mật khẩu:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError(null);
    setResetSuccess(null);

    if (newPassword.trim().length < 6) {
      setResetError('Mật khẩu phải dài từ 6 ký tự trở lên.');
      return;
    }

    try {
      const res = await api.post(`/admin/users/${resetUser.UserId}/reset-password`, { newPassword });
      
      const emailSent = res.data.emailSent;
      const userEmail = resetUser.Email;
      let emailNotice = '';
      if (userEmail) {
        if (emailSent) {
          emailNotice = `✉️ ĐÃ GỬI EMAIL THÀNH CÔNG: Mật khẩu mới đã được chuyển tới hòm thư ${userEmail}`;
        } else {
          emailNotice = `⚠️ CHƯA GỬI ĐƯỢC EMAIL: ${res.data.emailMessage || 'Không thể kết nối máy chủ Mail'}`;
        }
      } else {
        emailNotice = 'ℹ️ Tài khoản chưa đăng ký Email (Không gửi thông báo)';
      }

      const successText = `Reset mật khẩu tài khoản ${resetUser.Username} thành công! ${emailNotice}`;
      setResetSuccess(successText);
      setEmailToast({
        type: emailSent ? 'success' : (userEmail ? 'warning' : 'info'),
        title: `Reset mật khẩu tài khoản "${resetUser.Username}" thành công`,
        message: emailNotice,
        email: userEmail
      });

      setTimeout(() => {
        setResetUser(null);
        setResetSuccess(null);
      }, 3000);
    } catch (err) {
      setResetError(err.response?.data?.message || err.message || 'Lỗi khi reset mật khẩu.');
    }
  };

  const handleOpenEditPerms = (user) => {
    setEditUser(user);
    setPermBits(user.Permissions);
    setEditError(null);
  };

  const handleToggleBit = (bitValue) => {
    setPermBits(prev => prev ^ bitValue);
  };

  const handleSavePermissions = async () => {
    setEditError(null);
    try {
      await api.put(`/admin/users/${editUser.UserId}/permissions`, { permissions: permBits });
      fetchUsers();
      setEditUser(null);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Lỗi khi cập nhật phân quyền.');
    }
  };

  const permissionBits = [
    { value: 1, name: 'Xem dữ liệu', desc: 'Quyền xem danh sách, chi tiết' },
    { value: 2, name: 'Tạo mới dữ liệu', desc: 'Quyền thêm danh mục, vật tư, phiếu kho' },
    { value: 4, name: 'Sửa dữ liệu', desc: 'Quyền sửa đổi thông tin phần tử' },
    { value: 8, name: 'Reset mật khẩu', desc: 'Quyền quản trị reset mật khẩu tài khoản khác (Bit 8)' }
  ];

  return (
    <div className="bg-white border border-sky-100 p-6 rounded-2xl shadow-sm h-full flex flex-col overflow-hidden text-slate-800">
      <div className="flex items-center justify-between border-b border-sky-100 pb-4 mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý Tài Khoản & Phân Quyền Động</h2>
          <p className="text-sm text-slate-500">Phân quyền thông qua thuộc tính Bitfield và đặt lại mật khẩu cho các tài khoản người dùng.</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={fetchUsers}
            className="p-2.5 bg-slate-50 hover:bg-sky-50 border border-sky-100 text-slate-500 hover:text-sky-600 rounded-xl transition-all"
            title="Tải lại danh sách"
          >
            <RefreshCw size={18} />
          </button>
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-500/20"
          >
            <UserPlus size={16} /> Thêm người dùng
          </button>
        </div>
      </div>

      {/* Thông báo trạng thái gửi Email nổi bật */}
      {emailToast && (
        <div className={`p-4 mb-4 rounded-2xl border flex items-start justify-between shadow-sm animate-fadeIn shrink-0 ${
          emailToast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
          emailToast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-900' :
          'bg-sky-50 border-sky-200 text-sky-900'
        }`}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/80 shadow-sm mt-0.5 shrink-0">
              {emailToast.type === 'success' ? <Mail className="text-emerald-600" size={20} /> :
               emailToast.type === 'warning' ? <AlertCircle className="text-amber-600" size={20} /> :
               <AlertCircle className="text-sky-600" size={20} />}
            </div>
            <div>
              <h4 className="text-sm font-bold">{emailToast.title}</h4>
              <p className="text-xs font-semibold mt-0.5 leading-relaxed">{emailToast.message}</p>
            </div>
          </div>
          <button
            onClick={() => setEmailToast(null)}
            className="p-1 hover:bg-black/5 rounded-lg transition-all text-slate-400 hover:text-slate-600 shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {error ? (
        <div className="text-red-655 bg-red-50 p-4 rounded-xl border border-red-100 text-sm flex items-center gap-2 shrink-0">
          <AlertCircle size={18} /> {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-600"></div>
        </div>
      ) : (
        <div className="overflow-auto flex-1 border border-sky-50 rounded-xl">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="sticky top-0 z-10 bg-slate-50 border-b border-sky-100 text-slate-500">
                <th className="py-3 px-4 font-bold bg-slate-50">Tên Đăng Nhập</th>
                <th className="py-3 px-4 font-bold bg-slate-50">Họ và Tên</th>
                <th className="py-3 px-4 font-bold bg-slate-50">Địa chỉ Email</th>
                <th className="py-3 px-4 font-bold bg-slate-50">Vai Trò</th>
                <th className="py-3 px-4 font-bold bg-slate-50">Ngày Tạo</th>
                <th className="py-3 px-4 font-bold bg-slate-50">Trạng Thái</th>
                <th className="py-3 px-4 font-bold bg-slate-50">Quyền Bitfield</th>
                <th className="py-3 px-4 font-bold text-right bg-slate-50">Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.UserId} className="border-b border-sky-50 hover:bg-sky-50/10 transition-all">
                  <td className="py-3.5 px-4 font-semibold text-slate-700">{u.Username}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-600">{u.FullName}</td>
                  <td className="py-3.5 px-4 text-xs font-mono text-slate-500">{u.Email || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-550">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      u.RoleId === 1 ? 'bg-purple-50 border border-purple-100 text-purple-600' :
                      u.RoleId === 2 ? 'bg-sky-50 border border-sky-100 text-sky-600' :
                      u.RoleId === 3 ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                      'bg-slate-100 border border-slate-200 text-slate-600'
                    }`}>
                      {u.RoleName || (u.RoleId === 3 ? 'Nhân viên kỹ thuật' : 'Nhân viên')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500 font-medium">
                    {u.CreatedAt ? new Date(u.CreatedAt).toLocaleString('vi-VN') : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`text-xs font-semibold ${u.IsActive ? 'text-emerald-500' : 'text-red-500'}`}>
                      {u.IsActive ? 'Đang hoạt động' : 'Tạm khóa'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-xs">
                        Value: {u.Permissions}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        ({permissionBits.map(b => (u.Permissions & b.value) ? '1' : '0').reverse().join('')}b)
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => handleOpenHistory(u)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-sky-50 text-slate-600 hover:text-sky-600 rounded-lg border border-sky-100 text-xs font-semibold transition-all"
                        title="Xem lịch sử đổi / reset mật khẩu"
                      >
                        <History size={13} /> Lịch sử
                      </button>
                      <button
                        onClick={() => handleOpenEditPerms(u)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-lg border border-sky-100 text-xs font-semibold transition-all"
                      >
                        <Shield size={13} /> Phân quyền
                      </button>
                      <button
                        onClick={() => handleOpenReset(u)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-lg border border-sky-100 text-xs font-semibold transition-all"
                      >
                        <Key size={13} /> Reset MK
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Reset Password */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Key size={16} className="text-red-500" />
                Reset mật khẩu người dùng
              </h3>
              <button 
                onClick={() => setResetUser(null)}
                className="text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-xs text-slate-500">
                Nhập mật khẩu mới cho tài khoản <strong className="text-slate-700 font-bold">{resetUser.Username}</strong> ({resetUser.FullName}).
              </p>

              {resetError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-655 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle size={14} /> {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-xl">
                  Đã cập nhật mật khẩu mới thành công!
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">MẬT KHẨU MỚI (ĐƯỢC TẠO NGẪU NHIÊN) *</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      placeholder="Mật khẩu ngẫu nhiên..."
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-sky-150 rounded-xl pl-4 pr-12 py-2.5 text-sm font-mono font-bold text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      className={`absolute right-2 top-2 p-1.5 rounded-lg border transition-all ${
                        copied 
                          ? 'bg-emerald-50 border-emerald-250 text-emerald-650' 
                          : 'bg-white hover:bg-slate-50 border-sky-100 text-slate-500 hover:text-sky-600'
                      }`}
                      title={copied ? "Đã copy!" : "Copy mật khẩu"}
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegeneratePassword}
                    className="px-3 py-2 bg-slate-50 hover:bg-sky-50 border border-sky-150 hover:border-sky-300 text-slate-500 hover:text-sky-600 rounded-xl text-sm font-semibold transition-all flex items-center justify-center"
                    title="Tạo mật khẩu khác"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
                {copied && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Đã sao chép mật khẩu vào bộ nhớ tạm!</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetUser(null)}
                  className="px-4 py-2 border border-sky-150 hover:bg-slate-50 text-slate-555 rounded-xl text-sm font-semibold transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-red-500/10"
                >
                  Reset Mật Khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Thêm người dùng mới */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100 shrink-0">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <UserPlus size={18} className="text-sky-600" />
                Thêm tài khoản người dùng mới
              </h3>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4 overflow-y-auto flex-1">
              {createError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-655 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle size={14} /> {createError}
                </div>
              )}

              {createSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-xl font-semibold">
                  Tạo tài khoản người dùng thành công!
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">TÊN ĐĂNG NHẬP *</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: staff_lan"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">VAI TRÒ HỆ THỐNG *</label>
                  <select
                    value={newRoleId}
                    onChange={(e) => setNewRoleId(parseInt(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 font-semibold"
                  >
                    <option value={2}>Nhân viên kho (Staff)</option>
                    <option value={3}>Nhân viên kỹ thuật (Technical Staff)</option>
                    <option value={1}>Quản trị viên (Admin)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">HỌ VÀ TÊN NGƯỜI DÙNG *</label>
                <input
                  type="text"
                  required
                  placeholder="ví dụ: Nguyễn Thị Lan"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">ĐỊA CHỈ EMAIL (GỬI THÔNG TIN TÀI KHOẢN)</label>
                <input
                  type="email"
                  placeholder="ví dụ: lan.nguyen@novasphere.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">MẬT KHẨU KHỞI TẠO *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Mật khẩu từ 6 ký tự..."
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPasswordInput(generateRandomPassword())}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold shrink-0 transition-all"
                  >
                    Tạo lại
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2">PHÂN QUYỀN BAN ĐẦU (BITFIELD: {createPermBits})</label>
                <div className="space-y-2">
                  {permissionBits.map((bit) => {
                    const isChecked = (createPermBits & bit.value) === bit.value;
                    return (
                      <button
                        key={bit.value}
                        type="button"
                        onClick={() => handleToggleCreateBit(bit.value)}
                        className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                          isChecked 
                            ? 'bg-sky-50/30 border-sky-200 text-slate-800' 
                            : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-500'
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 text-sky-600">
                          {isChecked ? <CheckSquare size={16} /> : <Square size={16} />}
                        </span>
                        <div>
                          <p className={`text-xs font-bold ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>
                            {bit.name} <span className="text-[9px] font-normal text-slate-400">(Bit {bit.value})</span>
                          </p>
                          <p className="text-[10px] text-slate-400">{bit.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-sky-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 border border-sky-150 hover:bg-slate-50 text-slate-555 rounded-xl text-sm font-semibold transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-sky-500/20"
                >
                  <UserPlus size={16} /> Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Permissions (Bitfield) */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Shield size={16} className="text-sky-600" />
                Thiết lập quyền động (Bitfield)
              </h3>
              <button 
                onClick={() => setEditUser(null)}
                className="text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-sky-50/30 p-3.5 border border-sky-100 rounded-xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400">TÀI KHOẢN ĐANG CẤU HÌNH</p>
                  <p className="text-sm font-bold text-slate-700">{editUser.FullName} ({editUser.Username})</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-slate-400">GIÁ TRỊ BITFIELD TỔNG</p>
                  <p className="text-lg font-bold text-sky-600">{permBits}</p>
                </div>
              </div>

              {editError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-655 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle size={14} /> {editError}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">DANH SÁCH BIT QUYỀN HẠN</label>
                <div className="space-y-2.5">
                  {permissionBits.map((bit) => {
                    const isChecked = (permBits & bit.value) === bit.value;
                    return (
                      <button
                        key={bit.value}
                        type="button"
                        onClick={() => handleToggleBit(bit.value)}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                          isChecked 
                            ? 'bg-sky-50/20 border-sky-200 text-slate-800' 
                            : 'bg-white border-slate-100 hover:bg-slate-50 text-slate-555'
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 text-sky-600">
                          {isChecked ? <CheckSquare size={18} /> : <Square size={18} />}
                        </span>
                        <div>
                          <p className={`text-xs font-bold flex items-center gap-1.5 ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>
                            {bit.name}
                            <span className="px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-[9px] font-bold text-slate-500 rounded font-sans">Bit: {bit.value}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{bit.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUser(null)}
                  className="px-4 py-2 border border-sky-150 hover:bg-slate-50 text-slate-555 rounded-xl text-sm font-semibold transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-sky-500/10"
                >
                  <Save size={14} /> Lưu Cấu Hình
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lịch sử đổi / reset mật khẩu */}
      {historyUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <History size={18} className="text-sky-600" />
                  Lịch sử mật khẩu & Reset
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Tài khoản: <strong className="text-slate-700 font-bold">{historyUser.FullName}</strong> ({historyUser.Username})</p>
              </div>
              <button 
                onClick={() => setHistoryUser(null)}
                className="text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-sky-600"></div>
                </div>
              ) : passHistory.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-medium bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  Chưa ghi nhận lịch sử đổi/reset mật khẩu nào cho tài khoản này.
                </div>
              ) : (
                <div className="space-y-3">
                  {passHistory.map((item) => (
                    <div key={item.HistoryId} className="flex items-start justify-between p-3.5 bg-slate-50/70 border border-sky-100 rounded-xl text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            item.ActionType === 'ADMIN_RESET' ? 'bg-red-50 text-red-600 border border-red-100' :
                            item.ActionType === 'FORGOT_PASSWORD' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            'bg-sky-50 text-sky-600 border border-sky-100'
                          }`}>
                            {item.ActionType === 'ADMIN_RESET' ? 'Admin Reset MK' :
                             item.ActionType === 'FORGOT_PASSWORD' ? 'Quên mật khẩu' : 'Đổi mật khẩu'}
                          </span>
                          <span className="font-semibold text-slate-700">{item.PerformedBy}</span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Thao tác ghi nhận từ hệ thống bảo mật SQL Server.
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-slate-400 shrink-0 font-medium">
                        <p className="flex items-center gap-1"><Clock size={12} className="text-sky-500" /> {new Date(item.CreatedAt).toLocaleTimeString('vi-VN')}</p>
                        <p className="flex items-center gap-1 mt-0.5"><Calendar size={12} className="text-slate-400" /> {new Date(item.CreatedAt).toLocaleDateString('vi-VN')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end p-4 border-t border-sky-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setHistoryUser(null)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-500/10"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
