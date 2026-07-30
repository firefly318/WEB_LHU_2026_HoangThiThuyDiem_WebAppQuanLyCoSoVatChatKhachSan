import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Eye, X, FileText, Check, Clipboard, AlertCircle, Search, Printer } from 'lucide-react';

export default function Stocktake() {
  const [stocktakes, setStocktakes] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View states
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [selectedStocktake, setSelectedStocktake] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form states
  const [note, setNote] = useState('');
  const [auditItems, setAuditItems] = useState([]); // Array of { MaVatTu, TenVatTu, MaCodeVatTu, DonViTinh, SoLuongHeThong, SoLuongThucTe, MaDanhMuc }
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Filter, sort & pagination states
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchStocktakes();
    fetchMaterialsForAudit();
    fetchCategories();
  }, []);

  // Reset pagination when search, category, sort or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, catFilter, sortBy, pageSize]);

  const fetchStocktakes = async () => {
    try {
      setLoading(true);
      const res = await api.get('/stocktake');
      setStocktakes(res.data);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối khi tải danh sách phiếu kiểm kê.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  };

  const fetchMaterialsForAudit = async () => {
    try {
      const res = await api.get('/materials');
      const items = res.data.map(m => ({
        MaterialId: m.MaVatTu,
        TenVatTu: m.TenVatTu,
        MaCodeVatTu: m.MaCodeVatTu,
        DonViTinh: m.DonViTinh,
        SoLuongHeThong: m.SoLuongTon,
        SoLuongThucTe: m.SoLuongTon,
        MaDanhMuc: m.MaDanhMuc
      }));
      setAuditItems(items);
    } catch (err) {
      console.error(err);
    }
  };

  const handleQtyChange = (materialId, value) => {
    const val = value === '' ? 0 : parseInt(value);
    const parsedVal = isNaN(val) ? 0 : val;
    setAuditItems(prev => prev.map(item => 
      item.MaterialId === materialId 
        ? { ...item, SoLuongThucTe: parsedVal } 
        : item
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    try {
      const payload = {
        GhiChu: note,
        ChiTiet: auditItems.map(item => ({
          MaterialId: item.MaterialId,
          SoLuongThucTe: item.SoLuongThucTe
        }))
      };

      await api.post('/stocktake', payload);
      setSubmitSuccess(true);
      setNote('');
      fetchStocktakes();
      fetchMaterialsForAudit();
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab('list');
      }, 1500);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Lỗi lập phiếu kiểm kê kho.');
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const res = await api.get(`/stocktake/${id}`);
      setSelectedStocktake(res.data);
      setIsDetailModalOpen(true);
    } catch (err) {
      alert('Không thể tải chi tiết phiếu kiểm kê.');
    }
  };

  const handlePrint = () => {
    if (!selectedStocktake) return;

    const itemsHtml = selectedStocktake.ChiTiet?.map((item, idx) => {
      let diffStr = 'Khớp (0)';
      let diffColor = '#475569';
      if (item.CheHLech > 0) {
        diffStr = `+${item.CheHLech} (Thừa)`;
        diffColor = '#047857';
      } else if (item.CheHLech < 0) {
        diffStr = `${item.CheHLech} (Hao hụt)`;
        diffColor = '#be123c';
      }

      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td style="font-family: monospace; font-weight: bold;">${item.MaCodeVatTu || '—'}</td>
          <td style="font-weight: bold;">${item.TenVatTu || '—'}</td>
          <td style="text-align: center;">${item.DonViTinh || '—'}</td>
          <td style="text-align: right; color: #64748b;">${(item.SoLuongHeThong || 0).toLocaleString('vi-VN')}</td>
          <td style="text-align: right; font-weight: bold;">${(item.SoLuongThucTe || 0).toLocaleString('vi-VN')}</td>
          <td style="text-align: right; font-weight: bold; color: ${diffColor};">${diffStr}</td>
        </tr>
      `;
    }).join('') || '';

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('Vui lòng cho phép trình duyệt mở Cửa sổ Popup để in biên bản kiểm kê.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In Biên Bản Kiểm Kê Kho - ${selectedStocktake.SoPhieuKiemKe}</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; padding: 20px; line-height: 1.4; }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
            .company-title { font-size: 16pt; font-weight: bold; text-transform: uppercase; color: #0f172a; }
            .company-sub { font-size: 9pt; color: #475569; }
            .doc-title { text-align: center; margin: 20px 0 15px 0; }
            .doc-title h2 { margin: 0; font-size: 18pt; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px; }
            .doc-title p { margin: 4px 0 0 0; font-size: 10pt; color: #475569; }
            .meta-grid { width: 100%; margin-bottom: 20px; font-size: 10pt; border-collapse: collapse; }
            .meta-grid td { padding: 4px 0; vertical-align: top; }
            table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 10pt; }
            table.data-table th, table.data-table td { border: 1px solid #cbd5e1; padding: 8px 10px; }
            table.data-table th { background-color: #f1f5f9; color: #0f172a; font-weight: bold; text-transform: uppercase; font-size: 9pt; text-align: left; }
            .signatures-table { width: 100%; border-collapse: collapse; margin-top: 40px; font-size: 10pt; text-align: center; }
            .signatures-table td { width: 50%; vertical-align: top; padding: 0 10px; }
            .sig-title { font-weight: bold; margin-bottom: 4px; text-transform: uppercase; }
            .sig-sub { font-size: 8.5pt; color: #64748b; font-style: italic; }
            .sig-space { height: 75px; }
          </style>
        </head>
        <body>
          <table class="header-table">
            <tr>
              <td>
                <div class="company-title">NOVA SPHERE HOTEL</div>
                <div class="company-sub">Đường Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh</div>
                <div class="company-sub">Hệ thống Quản lý Vật tư & Cơ sở vật chất Khách sạn</div>
              </td>
            </tr>
          </table>

          <div class="doc-title">
            <h2>BIÊN BẢN KIỂM KÊ & ĐIỀU CHỈNH TỒN KHO</h2>
            <p><strong>Mã số phiếu:</strong> ${selectedStocktake.SoPhieuKiemKe} | <strong>Ngày kiểm kê:</strong> ${new Date(selectedStocktake.NgayKiemKe).toLocaleString('vi-VN')}</p>
          </div>

          <table class="meta-grid">
            <tr>
              <td style="width: 50%;"><strong>Nhân viên kiểm kho:</strong> ${selectedStocktake.NguoiLap || '—'}</td>
              <td style="width: 50%; text-align: right;"><strong>Mô tả / Ghi chú đợt kiểm:</strong> ${selectedStocktake.GhiChu || '—'}</td>
            </tr>
            <tr>
              <td><strong>Trạng thái:</strong> Đã chốt số liệu & tự động điều chỉnh tồn kho</td>
              <td style="text-align: right;"><strong>Ngày in chứng từ:</strong> ${new Date().toLocaleString('vi-VN')}</td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">STT</th>
                <th style="width: 110px;">Mã code</th>
                <th>Tên vật tư</th>
                <th style="width: 70px; text-align: center;">ĐVT</th>
                <th style="width: 100px; text-align: right;">Tồn hệ thống</th>
                <th style="width: 110px; text-align: right;">Tồn thực tế</th>
                <th style="width: 120px; text-align: right;">Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <table class="signatures-table">
            <tr>
              <td>
                <div class="sig-title">Thủ Kho / Người Kiểm Đếm</div>
                <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
                <div class="sig-space"></div>
                <div style="font-weight: bold;">${selectedStocktake.NguoiLap || '—'}</div>
              </td>
              <td>
                <div class="sig-title">Đại Diện BGD / Kế Toán Trưởng</div>
                <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
                <div class="sig-space"></div>
                <div>........................................................</div>
              </td>
            </tr>
          </table>

          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filtered & Sorted items
  const filteredAndSortedItems = React.useMemo(() => {
    let result = [...auditItems];

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(item => 
        item.TenVatTu.toLowerCase().includes(q) || 
        item.MaCodeVatTu.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (catFilter) {
      const catId = parseInt(catFilter);
      result = result.filter(item => item.MaDanhMuc === catId);
    }

    // Sort items
    if (sortBy === 'name-asc') {
      result.sort((a, b) => a.TenVatTu.localeCompare(b.TenVatTu, 'vi', { sensitivity: 'base' }));
    } else if (sortBy === 'name-desc') {
      result.sort((a, b) => b.TenVatTu.localeCompare(a.TenVatTu, 'vi', { sensitivity: 'base' }));
    } else if (sortBy === 'system-asc') {
      result.sort((a, b) => a.SoLuongHeThong - b.SoLuongHeThong);
    } else if (sortBy === 'system-desc') {
      result.sort((a, b) => b.SoLuongHeThong - a.SoLuongHeThong);
    } else if (sortBy === 'diff-desc') {
      result.sort((a, b) => Math.abs(b.SoLuongThucTe - b.SoLuongHeThong) - Math.abs(a.SoLuongThucTe - a.SoLuongHeThong));
    }

    return result;
  }, [auditItems, search, catFilter, sortBy]);

  // Paginated items
  const paginatedAuditItems = React.useMemo(() => {
    if (pageSize === -1) return filteredAndSortedItems;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAndSortedItems.slice(startIndex, startIndex + pageSize);
  }, [filteredAndSortedItems, currentPage, pageSize]);

  const totalItems = filteredAndSortedItems.length;
  const totalPages = pageSize === -1 ? 1 : Math.ceil(totalItems / pageSize);

  return (
    <div className="bg-white border border-sky-100 p-6 rounded-2xl shadow-sm">
      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-sky-100 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Kiểm kê & Điều chỉnh tồn kho</h2>
          <p className="text-sm text-slate-500">Thực hiện kiểm đếm kho định kỳ, tự động tính chênh lệch hao hụt và đồng bộ dữ liệu về số lượng thực tế.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'list' 
                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/10' 
                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-750 border border-sky-100'
            }`}
          >
            Lịch sử kiểm kê
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'create' 
                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/10' 
                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-750 border border-sky-100'
            }`}
          >
            Lập phiếu kiểm kê mới
          </button>
        </div>
      </div>

      {/* 1. TAB LIST */}
      {activeTab === 'list' && (
        <div>
          {error ? (
            <div className="text-red-650 bg-red-50 p-4 rounded-xl border border-red-100 text-sm">
              {error}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-600"></div>
            </div>
          ) : stocktakes.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Không tìm thấy đợt kiểm kê nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-sky-100 text-slate-500 bg-sky-50/20">
                    <th className="py-3 px-4 font-bold">Số phiếu kiểm kê</th>
                    <th className="py-3 px-4 font-bold">Ngày thực hiện</th>
                    <th className="py-3 px-4 font-bold">Nhân viên kiểm kho</th>
                    <th className="py-3 px-4 font-bold">Ghi chú đợt kiểm</th>
                    <th className="py-3 px-4 font-bold text-right w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {stocktakes.map((s) => (
                    <tr key={s.MaPhieuKiemKe} className="border-b border-sky-50 hover:bg-sky-50/10 transition-all">
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{s.SoPhieuKiemKe}</td>
                      <td className="py-3.5 px-4 text-slate-500">{new Date(s.NgayKiemKe).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{s.NguoiLap}</td>
                      <td className="py-3.5 px-4 text-slate-500 truncate max-w-xs">{s.GhiChu || '—'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(s.MaPhieuKiemKe)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-lg border border-sky-100 text-xs font-semibold ml-auto transition-all"
                        >
                          <Eye size={14} /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 2. TAB CREATE */}
      {activeTab === 'create' && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-655 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle size={18} /> {submitError}
            </div>
          )}

          {submitSuccess && (
            <div className="p-4 bg-emerald-55 border border-emerald-100 text-emerald-600 text-sm rounded-xl">
              Lưu phiếu kiểm kê thành công! Tồn kho hệ thống đã được đồng bộ lại.
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">MÔ TẢ / GHI CHÚ ĐỢT KIỂM KÊ</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Kiểm kho Amenity định kỳ cuối tháng 6, đối soát hao hụt..."
              className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 border-b border-sky-100 pb-2">Danh sách vật tư kiểm kê</h3>

            {/* Filter & Search Toolbar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-xl border border-sky-100/50">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm theo tên/mã..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-sky-150 rounded-xl pl-3 pr-8 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500 transition-all placeholder-slate-400"
                />
                <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
              </div>

              {/* Category Filter */}
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                className="bg-white border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
              >
                <option value="">Tất cả danh mục</option>
                {categories.map((c) => (
                  <option key={c.MaDanhMuc} value={c.MaDanhMuc}>{c.TenDanhMuc}</option>
                ))}
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
              >
                <option value="name-asc">Tên vật tư: A - Z</option>
                <option value="name-desc">Tên vật tư: Z - A</option>
                <option value="system-asc">Tồn hệ thống: Thấp đến Cao</option>
                <option value="system-desc">Tồn hệ thống: Cao đến Thấp</option>
                <option value="diff-desc">Chênh lệch nhiều nhất</option>
              </select>

              {/* Page Size */}
              <select
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                className="bg-white border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-sky-500 transition-all font-medium"
              >
                <option value={10}>10 vật tư / trang</option>
                <option value={20}>20 vật tư / trang</option>
                <option value={50}>50 vật tư / trang</option>
                <option value={-1}>Hiển thị tất cả</option>
              </select>
            </div>

            <div className="overflow-x-auto border border-sky-100 rounded-xl bg-white">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-sky-50/20 border-b border-sky-100 text-slate-500">
                    <th className="py-2.5 px-4 font-bold w-24">Mã Code</th>
                    <th className="py-2.5 px-4 font-bold">Tên vật tư</th>
                    <th className="py-2.5 px-4 font-bold">ĐVT</th>
                    <th className="py-2.5 px-4 font-bold text-right w-36">Tồn hệ thống</th>
                    <th className="py-2.5 px-4 font-bold text-right w-44">Số lượng thực tế đếm</th>
                    <th className="py-2.5 px-4 font-bold text-right w-36">Chênh lệch</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedAuditItems.map((item) => {
                    const diff = item.SoLuongThucTe - item.SoLuongHeThong;
                    return (
                      <tr key={item.MaterialId} className="border-b border-sky-50 hover:bg-sky-50/10 transition-all">
                        <td className="py-3 px-4 font-semibold text-slate-500">{item.MaCodeVatTu}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{item.TenVatTu}</td>
                        <td className="py-3 px-4 text-slate-550">{item.DonViTinh}</td>
                        <td className="py-3 px-4 font-bold text-slate-400 text-right">{item.SoLuongHeThong.toLocaleString()}</td>
                        <td className="py-2 px-4 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.SoLuongThucTe}
                            onChange={(e) => handleQtyChange(item.MaterialId, e.target.value)}
                            className="bg-white border border-sky-150 rounded px-2.5 py-1 w-28 text-right text-xs text-slate-800 focus:outline-none focus:border-sky-500 transition-all"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          {diff === 0 && <span className="text-slate-400">0</span>}
                          {diff > 0 && <span className="text-emerald-500">+{diff} (Thừa)</span>}
                          {diff < 0 && <span className="text-red-500">{diff} (Hao hụt)</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pageSize !== -1 && totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-sky-50">
                <span className="text-xs text-slate-500">
                  Hiển thị từ <strong className="text-slate-750">{(currentPage - 1) * pageSize + 1}</strong> đến{' '}
                  <strong className="text-slate-750">{Math.min(currentPage * pageSize, totalItems)}</strong> trong tổng số{' '}
                  <strong className="text-slate-750">{totalItems}</strong> vật tư
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-sky-150 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-650 rounded-lg transition-all"
                  >
                    Trước
                  </button>
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCurrentPage(i + 1)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                        currentPage === i + 1
                          ? 'bg-sky-600 border-sky-600 text-white shadow-sm'
                          : 'bg-white border-sky-150 hover:bg-slate-50 text-slate-650'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className="px-3 py-1.5 text-xs font-semibold bg-white border border-sky-150 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white text-slate-650 rounded-lg transition-all"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-sky-100">
            <button
              type="button"
              onClick={() => {
                setNote('');
                setActiveTab('list');
              }}
              className="px-4 py-2 border border-sky-150 hover:bg-slate-50 text-slate-500 rounded-xl text-sm font-semibold transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 shadow-md shadow-sky-500/10"
            >
              <Check size={16} /> Xác nhận & Đồng bộ kho
            </button>
          </div>
        </form>
      )}

      {/* 3. DETAIL MODAL */}
      {isDetailModalOpen && selectedStocktake && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-slate-800">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100">
              <h3 className="text-base font-bold text-slate-850 flex items-center gap-1.5">
                <Clipboard size={18} className="text-sky-600" />
                Chi tiết phiếu kiểm kê
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-sky-500/10"
                >
                  <Printer size={14} /> In biên bản
                </button>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="text-slate-400 hover:text-slate-705 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4 bg-sky-50/20 p-4 border border-sky-100 rounded-xl">
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">SỐ PHIẾU KIỂM KÊ</p>
                  <p className="text-sm font-bold text-sky-600 mt-0.5">{selectedStocktake.SoPhieuKiemKe}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">NGƯỜI THỰC HIỆN KIỂM</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{selectedStocktake.NguoiLap}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">NGÀY KIỂM KÊ</p>
                  <p className="text-xs text-slate-600 mt-0.5">{new Date(selectedStocktake.NgayKiemKe).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">MÔ TẢ / GHI CHÚ</p>
                  <p className="text-xs text-slate-600 mt-0.5 truncate">{selectedStocktake.GhiChu || '—'}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Danh sách chi tiết đối soát chênh lệch</h4>
                <div className="overflow-hidden border border-sky-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-sky-50/20 border-b border-sky-100 text-slate-500">
                        <th className="py-2.5 px-4 font-bold">Mã code</th>
                        <th className="py-2.5 px-4 font-bold">Tên vật tư</th>
                        <th className="py-2.5 px-4 font-bold">ĐVT</th>
                        <th className="py-2.5 px-4 font-bold text-right">Tồn hệ thống</th>
                        <th className="py-2.5 px-4 font-bold text-right">Tồn đếm thực tế</th>
                        <th className="py-2.5 px-4 font-bold text-right">Chênh lệch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedStocktake.ChiTiet?.map((item, idx) => (
                        <tr key={idx} className="border-b border-sky-50 hover:bg-sky-50/10 transition-all">
                          <td className="py-3 px-4 font-semibold text-slate-500">{item.MaCodeVatTu}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{item.TenVatTu}</td>
                          <td className="py-3 px-4 text-slate-550">{item.DonViTinh}</td>
                          <td className="py-3 px-4 font-bold text-slate-400 text-right">{item.SoLuongHeThong.toLocaleString()}</td>
                          <td className="py-3 px-4 font-bold text-slate-700 text-right">{item.SoLuongThucTe.toLocaleString()}</td>
                          <td className="py-3 px-4 text-right font-bold">
                            {item.CheHLech === 0 && <span className="text-slate-400">Khớp</span>}
                            {item.CheHLech > 0 && <span className="text-emerald-500">+{item.CheHLech} (Thừa)</span>}
                            {item.CheHLech < 0 && <span className="text-red-500">{item.CheHLech} (Hao hụt)</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
