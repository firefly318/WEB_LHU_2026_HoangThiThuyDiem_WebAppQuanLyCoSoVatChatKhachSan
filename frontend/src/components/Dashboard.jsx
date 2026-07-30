import React, { useState, useEffect } from 'react';
import api from '../api';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { 
  AlertTriangle, ArrowDownRight, ArrowUpRight, Award, 
  CheckCircle, Database, Package, ShieldAlert, TrendingUp, Sparkles, Brain, CalendarClock
} from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // AI insights states
  const [aiInsight, setAiInsight] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Expiring materials
  const [expiringMaterials, setExpiringMaterials] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    fetchAIInsights();
    fetchExpiringSoon();
  }, []);

  const fetchExpiringSoon = async () => {
    try {
      const res = await api.get('/reports/expiring-soon?days=30&top=10');
      setExpiringMaterials(res.data);
    } catch (err) {
      console.error('Failed to fetch expiring materials:', err);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/reports/dashboard');
      setData(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Không thể kết nối đến máy chủ API hoặc cơ sở dữ liệu SQL Server. Vui lòng kiểm tra lại cấu hình.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsights = async () => {
    try {
      setAiLoading(true);
      const res = await api.get('/reports/ai-insights');
      setAiInsight(res.data.insight);
    } catch (err) {
      console.error('Failed to fetch AI insights:', err);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-600"></div>
        <span className="ml-3 text-slate-500">Đang phân tích dữ liệu hệ thống...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl">
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-2">
          <AlertTriangle className="text-red-500" /> Lỗi kết nối dữ liệu
        </h3>
        <p className="text-sm mb-4 text-red-650">{error}</p>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-all"
        >
          Thử kết nối lại
        </button>
      </div>
    );
  }

  const { Summary, LowStockAlerts, TopMoving, StagnantMaterials, RecentActivities, MonthlyStats } = data;

  return (
    <div className="flex flex-col gap-3 h-full">

      {/* Hàng 1: 4 Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Card 1 */}
        <div className="relative overflow-hidden bg-[#3b82f6] text-white p-4 rounded-xl shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
          <div className="absolute top-0 right-0 p-5 opacity-[0.1] text-white pointer-events-none">
            <Package size={70} />
          </div>
          <p className="text-blue-100 text-xs font-medium">Tổng số mặt hàng</p>
          <h3 className="text-2xl font-bold mt-1 text-white">{Summary.TongVatTu}</h3>
          <div className="flex items-center gap-1 mt-1 text-xs text-blue-100/90 font-medium">
            <Database size={11} /> SQL Server Database
          </div>
        </div>

        {/* Card 2 */}
        <div className="relative overflow-hidden bg-[#0d9488] text-white p-4 rounded-xl shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
          <div className="absolute top-0 right-0 p-5 opacity-[0.1] text-white pointer-events-none">
            <AlertTriangle size={70} />
          </div>
          <p className="text-teal-100 text-xs font-medium">Vật tư sắp hết hàng</p>
          <h3 className="text-2xl font-bold mt-1 text-white">{Summary.VatTuSapHet}</h3>
          <div className="flex items-center gap-1 mt-1 text-xs text-teal-100/90 font-medium">
            <ShieldAlert size={11} /> Cần bổ sung gấp
          </div>
        </div>

        {/* Card 3 */}
        <div className="relative overflow-hidden bg-[#8b5cf6] text-white p-4 rounded-xl shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
          <div className="absolute top-0 right-0 p-5 opacity-[0.1] text-white pointer-events-none">
            <CheckCircle size={70} />
          </div>
          <p className="text-purple-100 text-xs font-medium">Tổng lượng tồn kho</p>
          <h3 className="text-2xl font-bold mt-1 text-white">{Summary.TongTonKho.toLocaleString()}</h3>
          <div className="flex items-center gap-1 mt-1 text-xs text-purple-100/90 font-medium">
            <TrendingUp size={11} /> Số lượng lưu kho
          </div>
        </div>

        {/* Card 4 */}
        <div className="relative overflow-hidden bg-[#f97316] text-white p-4 rounded-xl shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md">
          <div className="absolute top-0 right-0 p-5 opacity-[0.1] text-white pointer-events-none">
            <TrendingUp size={70} />
          </div>
          <p className="text-orange-100 text-xs font-medium">Phiếu xuất đã lập</p>
          <h3 className="text-2xl font-bold mt-1 text-white">{Summary.PhieuChoDuyet}</h3>
          <div className="flex items-center gap-1 mt-1 text-xs text-orange-100/90 font-medium">
            <ArrowUpRight size={11} /> Lịch sử cấp phát
          </div>
        </div>
      </div>

      {/* Hàng 2: AI Insights | Cảnh báo cạn kho + tồn đọng */}
      <div className="grid grid-cols-2 gap-3 min-h-0" style={{flex: '1 1 0'}}>

        {/* AI Insights */}
        <div className="bg-gradient-to-br from-sky-100 via-sky-50 to-blue-100 border border-sky-200 p-4 rounded-xl shadow-sm relative overflow-hidden flex flex-col">
          <div className="absolute top-0 right-0 p-6 opacity-[0.06] pointer-events-none text-sky-600">
            <Brain size={110} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            <h4 className="text-xs font-bold tracking-wider uppercase text-sky-600 flex items-center gap-1.5">
              <Sparkles size={12} className="text-sky-500 animate-pulse" />
              Trợ lý Báo cáo & Cảnh báo AI (Powered by Groq)
            </h4>
          </div>
          <p className="text-sm font-bold text-slate-800 mb-2">Phân tích tồn kho & Khuyến nghị thông minh</p>
          {aiLoading ? (
            <div className="flex items-center gap-2 text-sky-600 text-xs py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-sky-500"></div>
              <span>Groq AI đang phân tích dữ liệu kho...</span>
            </div>
          ) : (
            <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-medium bg-white/90 border border-sky-200/60 p-3 rounded-lg flex-1 overflow-y-auto shadow-sm">
              {aiInsight || 'Không có đề xuất nào được đưa ra tại thời điểm này.'}
            </div>
          )}
        </div>

        {/* Cột phải: 2 cảnh báo xếp dọc */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Cảnh báo cạn kho */}
          <div className="bg-white border border-sky-100 p-4 rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <AlertTriangle className="text-yellow-500 animate-pulse" size={16} />
                AI Cảnh báo vật tư sắp hết
              </h4>
              <span className="px-2 py-0.5 bg-yellow-50 text-yellow-600 text-xs rounded-full border border-yellow-100 font-medium">
                Ngưỡng tối thiểu
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {LowStockAlerts.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">Tồn kho an toàn. Không có cảnh báo.</div>
              ) : (
                LowStockAlerts.map((alert) => (
                  <div key={alert.MaCanhBao} className="bg-slate-50/50 border border-slate-100 p-2 rounded-lg flex justify-between items-center hover:border-slate-200 transition-all">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-1.5 py-0.5 bg-white rounded border border-slate-200 text-slate-600">{alert.MaCodeVatTu}</span>
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[160px]">{alert.NoiDungCanhBao.split(' - ')[1]?.split(' sắp ')[0] || alert.NoiDungCanhBao}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate max-w-[260px]">{alert.NoiDungCanhBao}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Hàng tồn đọng */}
          <div className="bg-white border border-sky-100 p-4 rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Award className="text-indigo-500" size={16} />
                Vật tư tồn đọng (90 ngày)
              </h4>
              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-xs rounded-full border border-indigo-100 font-medium">
                Đọng vốn
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto flex-1 pr-1">
              {StagnantMaterials.length === 0 ? (
                <div className="text-center py-4 text-slate-400 text-xs">Kho lưu thông tốt. Không có tồn đọng.</div>
              ) : (
                StagnantMaterials.map((mat, index) => (
                  <div key={index} className="bg-indigo-50/30 border border-indigo-100/50 p-2 rounded-lg flex justify-between items-center hover:border-indigo-100 transition-all">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-1.5 py-0.5 bg-white rounded border border-slate-200 text-indigo-600">{mat.MaCodeVatTu}</span>
                        <span className="text-xs font-semibold text-slate-700 truncate max-w-[150px]">{mat.TenVatTu}</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">Tồn: <strong className="text-indigo-600">{mat.SoLuongTon} {mat.Unit}</strong></p>
                    </div>
                    <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 font-medium shrink-0">Không xuất 90d</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Hàng 3: Biểu đồ | Top tiêu thụ + Lịch sử gần đây */}
      <div className="grid grid-cols-2 gap-3 min-h-0" style={{flex: '1 1 0'}}>

        {/* Biểu đồ nhập xuất */}
        <div className="bg-white border border-sky-100 p-4 rounded-xl shadow-sm flex flex-col">
          <h4 className="text-sm font-bold text-slate-800 mb-2">Biểu đồ Nhập - Xuất năm nay</h4>
          <div className="flex-1 min-h-0" style={{minHeight: 160}}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MonthlyStats} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNhap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorXuat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="Thang" stroke="#64748b" fontSize={11} tickFormatter={(val) => `T${val}`} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '10px', fontSize: 12 }}
                  labelFormatter={(label) => `Tháng ${label}`}
                />
                <Legend verticalAlign="top" height={28} wrapperStyle={{fontSize: 11}}/>
                <Area name="Nhập kho" type="monotone" dataKey="Nhap" stroke="#0284c7" fillOpacity={1} fill="url(#colorNhap)" />
                <Area name="Xuất kho" type="monotone" dataKey="Xuat" stroke="#f43f5e" fillOpacity={1} fill="url(#colorXuat)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cột phải: Top tiêu thụ + Lịch sử */}
        <div className="flex flex-col gap-3 min-h-0">

          {/* Top tiêu thụ */}
          <div className="bg-white border border-sky-100 p-4 rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
            <h4 className="text-sm font-bold text-slate-800 mb-2">Top vật tư tiêu thụ nhiều nhất</h4>
            <div className="flex-1 min-h-0" style={{minHeight: 100}}>
              {TopMoving.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">Chưa có dữ liệu tiêu thụ.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={TopMoving.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" stroke="#64748b" fontSize={10} />
                    <YAxis dataKey="MaCodeVatTu" type="category" stroke="#64748b" fontSize={10} width={70} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#fff', borderColor: '#e2e8f0', borderRadius: '10px', fontSize: 11 }}
                      formatter={(value, name, props) => [`${value} chiếc`, props.payload.TenVatTu]}
                    />
                    <Bar dataKey="TongSoLuongXuat" fill="#0284c7" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Vật tư sắp hết hạn */}
          <div className="bg-white border border-rose-100 p-4 rounded-xl shadow-sm flex flex-col flex-1 min-h-0">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CalendarClock className="text-rose-500 animate-pulse" size={16} />
                Vật tư sắp hết hạn (30 ngày)
              </h4>
              <span className="px-2 py-0.5 bg-rose-50 text-rose-600 text-xs rounded-full border border-rose-100 font-medium">
                Top 10
              </span>
            </div>
            <div className="overflow-auto flex-1">
              {expiringMaterials.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-1">
                  <CalendarClock size={24} className="text-slate-300" />
                  <span>Không có vật tư nào hết hạn trong 30 ngày tới.</span>
                  <span className="text-slate-300 text-[10px]">Hãy cập nhật ngày hết hạn trong mục Quản lý Vật Tư.</span>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-rose-100 text-slate-500 bg-rose-50/30 sticky top-0">
                      <th className="py-1.5 px-2 font-bold">Mã VT</th>
                      <th className="py-1.5 px-2 font-bold">Tên vật tư</th>
                      <th className="py-1.5 px-2 font-bold">Loại</th>
                      <th className="py-1.5 px-2 font-bold">Tồn kho</th>
                      <th className="py-1.5 px-2 font-bold">Hết hạn</th>
                      <th className="py-1.5 px-2 font-bold">Còn lại</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringMaterials.map((mat) => {
                      const days = mat.DaysRemaining;
                      const urgency = days <= 7 ? 'bg-red-50 text-red-600 border-red-100'
                        : days <= 15 ? 'bg-orange-50 text-orange-600 border-orange-100'
                        : 'bg-yellow-50 text-yellow-700 border-yellow-100';
                      return (
                        <tr key={mat.MaterialId} className="border-b border-rose-50 hover:bg-rose-50/20 transition-all">
                          <td className="py-1.5 px-2 font-semibold text-slate-600">{mat.MaterialCode}</td>
                          <td className="py-1.5 px-2 text-slate-700 font-medium truncate max-w-[110px]">{mat.MaterialName}</td>
                          <td className="py-1.5 px-2 text-slate-500 truncate max-w-[80px]">{mat.CategoryName}</td>
                          <td className="py-1.5 px-2 text-slate-700 font-semibold">{mat.StockQuantity} <span className="font-normal text-slate-400">{mat.Unit}</span></td>
                          <td className="py-1.5 px-2 text-slate-500">{new Date(mat.ExpiryDate).toLocaleDateString('vi-VN')}</td>
                          <td className="py-1.5 px-2">
                            <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${urgency}`}>
                              {days === 0 ? 'Hôm nay!' : `${days} ngày`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}


