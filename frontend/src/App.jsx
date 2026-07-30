import React, { useState, useEffect } from 'react';
import api from './api';
import { 
  LayoutDashboard, Layers, Box, FileInput, FileOutput, 
  ClipboardList, LogOut, Key, User, Users, Bell, ChevronRight, AlertTriangle, X, Truck, Lock, Wrench, FileSpreadsheet
} from 'lucide-react';

import Dashboard from './components/Dashboard';
import CategoryList from './components/CategoryList';
import MaterialList from './components/MaterialList';
import GoodsReceipt from './components/GoodsReceipt';
import GoodsDelivery from './components/GoodsDelivery';
import Stocktake from './components/Stocktake';
import SupplierList from './components/SupplierList';
import Maintenance from './components/Maintenance';
import UserList from './components/UserList';
import ReportManagement from './components/ReportManagement';



export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState([]);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  
  const hasPermission = (tabId) => {
    if (!user) return false;
    const roleId = Number(user.roleId);
    if (roleId === 1) return true;
    if (roleId === 2) return tabId !== 'users';
    if (roleId === 3) return tabId === 'dashboard' || tabId === 'maintenance';
    return false;
  };

  useEffect(() => {
    if (user && !hasPermission(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [user, activeTab]);

  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Forgot Password States
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [forgotInput, setForgotInput] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Password Modal States
  const [isPwdModalOpen, setIsPwdModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  useEffect(() => {
    const handleAuthChange = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  useEffect(() => {
    if (token) {
      fetchAlerts();
      const interval = setInterval(fetchAlerts, 30000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchAlerts = async () => {
    try {
      const res = await api.get('/reports/dashboard');
      setAlerts(res.data.LowStockAlerts || []);
    } catch (err) {
      console.error('Không thể tải thông báo cảnh báo.', err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await api.post('/auth/login', { username, password });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      setActiveTab('dashboard');
      setUsername('');
      setPassword('');
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Đăng nhập không thành công. Hãy thử lại.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');

    try {
      await api.post('/auth/change-password', { oldPassword, newPassword });
      setPwdSuccess('Thay đổi mật khẩu thành công!');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => {
        setIsPwdModalOpen(false);
        setPwdSuccess('');
      }, 1500);
    } catch (err) {
      setPwdError(err.response?.data?.message || 'Có lỗi xảy ra khi đổi mật khẩu.');
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    setForgotLoading(true);

    try {
      const res = await api.post('/auth/forgot-password', { usernameOrEmail: forgotInput });
      setForgotSuccess(res.data.message || 'Đã gửi thông báo mật khẩu mới về email của bạn!');
      setForgotInput('');
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Không thể xử lý yêu cầu đặt lại mật khẩu.');
    } finally {
      setForgotLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-slate-950">
        {/* Full screen background image */}
        <img 
          src="/login-bg.jpg" 
          alt="Nova Sphere Hotel Lobby" 
          className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
        />
        {/* Elegant dark gradient overlay to make login stand out */}
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-950/70 via-slate-900/50 to-slate-950/75 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-[#073038]/25 mix-blend-color-burn"></div>

        {/* Ambient background glows */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -z-10"></div>

        {/* Glassmorphic Login Card */}
        <div className="bg-white/80 border border-white/60 backdrop-blur-md rounded-3xl p-8 shadow-2xl w-full max-w-md space-y-6 z-10 transition-all">
          <div className="text-center space-y-3">
            {/* Logo Image */}
            <div className="flex justify-center">
              <img src="/logo.png" alt="Nova Sphere Logo" className="w-20 h-20 object-cover rounded-2xl border border-sky-100 shadow-sm" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider text-slate-800 uppercase">Nova Sphere Hotel</h1>
              <p className="text-xs font-semibold text-slate-500 tracking-wide mt-0.5">Facility & Inventory Management</p>
            </div>
          </div>

          {loginError && (
            <div className="p-3.5 bg-red-550/10 border border-red-200/30 text-red-600 text-xs rounded-xl flex items-center gap-2">
              <AlertTriangle size={16} /> {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tài khoản"
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-[#0e5a6a] focus:ring-1 focus:ring-[#0e5a6a] transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mật khẩu"
                className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 focus:outline-none focus:border-[#0e5a6a] focus:ring-1 focus:ring-[#0e5a6a] transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input type="checkbox" className="rounded text-[#0e5a6a] focus:ring-[#0e5a6a]" />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <button 
                type="button" 
                onClick={() => { setIsForgotModalOpen(true); setForgotError(''); setForgotSuccess(''); }}
                className="hover:text-[#0e5a6a] hover:underline transition-all text-[#0e5a6a] font-semibold"
              >
                Quên mật khẩu?
              </button>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0e5a6a] hover:bg-[#0a4552] text-white font-semibold py-3 rounded-full transition-all shadow-lg shadow-teal-900/10 text-sm tracking-wide mt-2"
            >
              Vào hệ thống
            </button>
          </form>

          <div className="text-center text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100/80">
            <span className="font-bold block mb-1 text-[#0e5a6a]">Tài khoản thử nghiệm mặc định:</span>
            admin / admin123 (Quản trị viên) <br/>
            staff_kho / staff123 (Nhân viên kho) <br/>
            tech_vien / tech123 (Nhân viên kỹ thuật)
          </div>
        </div>

        {/* Modal Quên mật khẩu */}
        {isForgotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4 border border-sky-100 text-slate-800">
              <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Key size={18} className="text-[#0e5a6a]" />
                  Quên mật khẩu tài khoản
                </h3>
                <button 
                  onClick={() => setIsForgotModalOpen(false)}
                  className="text-slate-400 hover:text-slate-700 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleForgotPassword} className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Nhập <strong>Tên đăng nhập</strong> hoặc <strong>Email</strong> đã đăng ký của bạn. Hệ thống sẽ tự động tạo mật khẩu ngẫu nhiên mới và gửi trực tiếp về Email của bạn.
                </p>

                {forgotError && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-center gap-1.5 font-medium">
                    <AlertTriangle size={14} /> {forgotError}
                  </div>
                )}

                {forgotSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-xl font-semibold leading-relaxed">
                    {forgotSuccess}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">TÊN ĐĂNG NHẬP / EMAIL *</label>
                  <input
                    type="text"
                    required
                    placeholder="ví dụ: admin hoặc user@novasphere.com"
                    value={forgotInput}
                    onChange={(e) => setForgotInput(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#0e5a6a] font-medium"
                  />
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-sky-100">
                  <button
                    type="button"
                    onClick={() => setIsForgotModalOpen(false)}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold transition-all"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-4 py-2 bg-[#0e5a6a] hover:bg-[#0a4552] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-900/10 disabled:opacity-50"
                  >
                    {forgotLoading ? 'Đang gửi email...' : 'Gửi mật khẩu qua Email'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const menuItems = [
    { id: 'dashboard', label: 'Bảng Điều Khiển', icon: LayoutDashboard },
    { id: 'reports', label: 'Báo Cáo Nhập Xuất Tồn', icon: FileSpreadsheet },
    { id: 'categories', label: 'Loại Vật Tư', icon: Layers },
    { id: 'materials', label: 'Quản Lý Vật Tư', icon: Box },
    { id: 'suppliers', label: 'Nhà Cung Cấp', icon: Truck },
    { id: 'maintenance', label: 'Bảo Trì Thiết Bị', icon: Wrench },
    { id: 'receipts', label: 'Nhập Kho (GRN)', icon: FileInput },
    { id: 'deliveries', label: 'Xuất Kho (GDN)', icon: FileOutput },
    { id: 'stocktake', label: 'Kiểm Kê Kho', icon: ClipboardList },
    { id: 'users', label: 'Quản Lý Tài Khoản', icon: Users },
  ];

  return (
    <div className="h-screen w-screen flex text-slate-800 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#1d4ed8] shadow-md flex flex-col no-print text-white">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10 bg-black/10">
          <div className="h-9 w-9 rounded-xl bg-white flex items-center justify-center overflow-hidden border border-white/10 shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white tracking-wider uppercase leading-tight">NOVA SPHERE</h2>
            <span className="text-[9px] text-blue-200/80 block font-medium">Hotel & Inventory</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems
            .filter((item) => hasPermission(item.id))
            .map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === item.id 
                      ? 'bg-white/15 text-white border border-white/10 shadow-sm' 
                      : 'text-blue-100/80 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
        </nav>

        {/* User Info Bottom */}
        <div className="p-4 border-t border-white/10 bg-black/10 flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-white/15 border border-white/10 flex items-center justify-center text-white font-bold">
              {user?.name?.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{user?.name}</p>
              <p className="text-[10px] text-blue-200/70 font-medium">{user?.roleName}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-2">
            <button
              onClick={() => setIsPwdModalOpen(true)}
              className="flex items-center justify-center gap-1 p-2 bg-white/10 hover:bg-white/15 text-[10px] font-semibold rounded-lg text-white transition-all border border-white/10"
            >
              <Key size={10} /> Đổi mật khẩu
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center justify-center gap-1 p-2 bg-white/10 hover:bg-red-650/30 text-[10px] font-semibold rounded-lg text-white hover:text-red-200 transition-all border border-white/10"
            >
              <LogOut size={10} /> Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* HEADER */}
        <header className="h-16 bg-white/80 border-b border-sky-100/80 backdrop-blur-md flex items-center justify-between px-6 no-print relative z-40">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs font-medium uppercase tracking-wider">Hệ thống quản lý vật tư</span>
            <ChevronRight className="text-slate-300" size={14} />
            <span className="text-xs text-sky-600 font-bold uppercase tracking-wider">
              {menuItems.find(i => i.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Bell Notifications */}
            <div className="relative">
              <button 
                onClick={() => setIsAlertOpen(!isAlertOpen)}
                className="p-2 bg-white border border-sky-100 hover:bg-sky-50 rounded-xl text-slate-455 hover:text-sky-600 transition-all relative"
              >
                <Bell size={18} />
                {alerts.length > 0 && (
                  <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-yellow-500 rounded-full animate-pulse border border-white"></span>
                )}
              </button>

              {isAlertOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-sky-100 rounded-2xl shadow-xl p-4 z-50 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle size={14} className="text-yellow-500" />
                    Cảnh báo tồn kho cạn ({alerts.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {alerts.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-4">Tất cả vật tư đều có lượng tồn kho an toàn.</p>
                    ) : (
                      alerts.map((a) => (
                        <div key={a.MaCanhBao} className="text-[11px] bg-yellow-50 p-2 rounded-lg border border-yellow-100 text-yellow-800">
                          {a.NoiDungCanhBao}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Mobile menu trigger */}
            <div className="md:hidden flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">{user?.name}</span>
              <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-500 transition-all">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-hidden p-6 print:p-0 flex flex-col min-h-0">
          {activeTab === 'dashboard' && hasPermission('dashboard') && <div className="flex-1 min-h-0 overflow-hidden"><Dashboard /></div>}
          {activeTab !== 'dashboard' && <div className="flex-1 overflow-y-auto">
          {activeTab === 'reports' && hasPermission('reports') && <ReportManagement />}
          {activeTab === 'categories' && hasPermission('categories') && <CategoryList />}
          {activeTab === 'materials' && hasPermission('materials') && <MaterialList />}
          {activeTab === 'suppliers' && hasPermission('suppliers') && <SupplierList />}
          {activeTab === 'maintenance' && hasPermission('maintenance') && <Maintenance />}
          {activeTab === 'receipts' && hasPermission('receipts') && <GoodsReceipt />}
          {activeTab === 'deliveries' && hasPermission('deliveries') && <GoodsDelivery />}
          {activeTab === 'stocktake' && hasPermission('stocktake') && <Stocktake />}
          {activeTab === 'users' && hasPermission('users') && <UserList />}
          </div>}
        </main>

        {/* FOOTER */}
        <footer className="h-9 shrink-0 bg-white/70 border-t border-sky-100/80 backdrop-blur-md flex items-center justify-between px-6 no-print text-[10px] text-slate-400 select-none">
          <div className="flex items-center gap-1.5">
            <img src="/logo.png" alt="Logo" className="h-4 w-4 object-cover rounded" />
            <span className="font-semibold text-slate-500">Nova Sphere Hotel &amp; Inventory</span>
            <span className="mx-1 text-slate-300">|</span>
            <span>© {new Date().getFullYear()} Hoàng Thị Thúy Diễm — MSSV: 725000005</span>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <span className="px-2 py-0.5 bg-sky-50 border border-sky-100 rounded-full text-sky-500 font-medium">ReactJS + Vite</span>
            <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded-full text-emerald-500 font-medium">Node.js + Express</span>
            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-full text-indigo-500 font-medium">SQL Server</span>
            <span className="text-slate-300">|</span>
            <span className="font-medium text-slate-400">Trường Đại học Lạc Hồng — LHU 2026</span>
          </div>
        </footer>

      </div>

      {/* PASSWORD CHANGE MODAL */}
      {isPwdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
                <Key size={16} /> Đổi mật khẩu tài khoản
              </h3>
              <button 
                onClick={() => setIsPwdModalOpen(false)}
                className="text-slate-500 hover:text-slate-800 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {pwdError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl">
                  {pwdError}
                </div>
              )}

              {pwdSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs rounded-xl">
                  {pwdSuccess}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">MẬT KHẨU CŨ *</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-sky-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">MẬT KHẨU MỚI *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-sky-100 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPwdModalOpen(false)}
                  className="px-4 py-2 border border-sky-100 hover:bg-slate-50 text-slate-500 rounded-xl text-sm font-medium transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-medium transition-all"
                >
                  Cập nhật mật khẩu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
