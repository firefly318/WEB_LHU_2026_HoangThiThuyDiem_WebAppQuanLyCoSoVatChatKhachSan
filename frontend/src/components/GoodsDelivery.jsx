import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Trash2, Printer, X, Eye, FileText, Package, AlertCircle, Search } from 'lucide-react';

function MaterialSelect({ value, onChange, materials, placeholder = "-- Chọn vật tư --", showStock = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  
  const sortedMaterials = React.useMemo(() => {
    return [...materials].sort((a, b) => 
      a.TenVatTu.localeCompare(b.TenVatTu, 'vi', { sensitivity: 'base' })
    );
  }, [materials]);
  
  const filteredMaterials = React.useMemo(() => {
    let result = sortedMaterials;
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(m => 
        (m.TenVatTu && m.TenVatTu.toLowerCase().includes(q)) ||
        (m.MaCodeVatTu && m.MaCodeVatTu.toLowerCase().includes(q)) ||
        (m.TenDanhMuc && m.TenDanhMuc.toLowerCase().includes(q))
      );
    }
    if (selectedCat) {
      const catId = parseInt(selectedCat);
      result = result.filter(m => m.MaDanhMuc === catId);
    }
    return result;
  }, [sortedMaterials, search, selectedCat]);
  
  const selectedMaterial = materials.find(m => String(m.MaVatTu) === String(value));

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchCats = async () => {
      try {
        const res = await api.get('/categories');
        setCategories(res.data);
      } catch (err) {
        console.error('Lỗi tải danh mục:', err);
      }
    };
    fetchCats();
  }, [isOpen]);

  return (
    <div className="relative w-full text-slate-800" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-sky-150 rounded-lg px-3 py-2 text-xs text-left text-slate-800 flex justify-between items-center focus:outline-none focus:border-sky-500 transition-all h-9"
      >
        <span className="truncate">
          {selectedMaterial ? (
            showStock ? (
              `${selectedMaterial.TenVatTu} (${selectedMaterial.MaCodeVatTu}) [Tồn hiện tại: ${selectedMaterial.SoLuongTon} ${selectedMaterial.DonViTinh}]`
            ) : (
              `${selectedMaterial.TenVatTu} (${selectedMaterial.MaCodeVatTu})`
            )
          ) : placeholder}
        </span>
        <span className="text-slate-400 text-[10px] ml-1 shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-sky-100 rounded-xl shadow-xl p-2 space-y-2 max-h-72 flex flex-col min-w-[300px]">
          <div className="flex gap-1.5 shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                autoFocus
                placeholder="Tìm theo tên, mã code vật tư..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-sky-100 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-32 bg-slate-50 border border-sky-100 rounded-lg px-1.5 py-1 text-[10px] text-slate-700 focus:outline-none focus:border-sky-500 focus:bg-white transition-all font-medium shrink-0"
            >
              <option value="">Tất cả loại</option>
              {categories.map(c => (
                <option key={c.MaDanhMuc} value={c.MaDanhMuc}>{c.TenDanhMuc}</option>
              ))}
            </select>
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-3 text-[11px] text-slate-400">Không tìm thấy vật tư khớp với từ khóa</div>
            ) : (
              filteredMaterials.map(m => (
                <button
                  key={m.MaVatTu}
                  type="button"
                  onClick={() => {
                    onChange(m.MaVatTu);
                    setIsOpen(false);
                    setSearch('');
                    setSelectedCat('');
                  }}
                  className={`w-full text-left px-2.5 py-2 text-xs hover:bg-sky-50 transition-all flex flex-col ${
                    String(m.MaVatTu) === String(value) ? 'bg-sky-50/50 text-sky-700 font-semibold' : 'text-slate-700'
                  }`}
                >
                  <span className="font-medium">{m.TenVatTu}</span>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-0.5">
                    <span>{m.MaCodeVatTu}</span>
                    {showStock && (
                      <span className="font-semibold text-sky-600">Tồn: {m.SoLuongTon} {m.DonViTinh}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function GoodsDelivery() {
  const [deliveries, setDeliveries] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick Search & Filter for Materials in Form
  const [quickSearch, setQuickSearch] = useState('');
  const [quickCategory, setQuickCategory] = useState('');

  // View states
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const createInitialDeliveryItems = () => [
    { MaterialId: '', SoLuong: 1, CategoryId: '', DonViTinh: '', GhiChu: '' },
    { MaterialId: '', SoLuong: 1, CategoryId: '', DonViTinh: '', GhiChu: '' },
    { MaterialId: '', SoLuong: 1, CategoryId: '', DonViTinh: '', GhiChu: '' }
  ];

  // Form states
  const [departmentId, setDepartmentId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState(createInitialDeliveryItems());
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const filteredDeliveries = React.useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return deliveries;
    return deliveries.filter(d =>
      (d.SoPhieuXuat && d.SoPhieuXuat.toLowerCase().includes(q)) ||
      (d.NguoiLap && d.NguoiLap.toLowerCase().includes(q)) ||
      (d.BoPhanNhan && d.BoPhanNhan.toLowerCase().includes(q)) ||
      (d.LyDoXuat && d.LyDoXuat.toLowerCase().includes(q))
    );
  }, [deliveries, historySearch]);

  const filteredMaterialsForSelect = React.useMemo(() => {
    let result = materials;
    const q = quickSearch.trim().toLowerCase();
    if (q) {
      result = result.filter(m =>
        (m.TenVatTu && m.TenVatTu.toLowerCase().includes(q)) ||
        (m.MaCodeVatTu && m.MaCodeVatTu.toLowerCase().includes(q))
      );
    }
    if (quickCategory) {
      const catId = parseInt(quickCategory);
      result = result.filter(m => m.MaDanhMuc === catId);
    }
    return result;
  }, [materials, quickSearch, quickCategory]);

  useEffect(() => {
    fetchDeliveries();
    fetchMaterials();
    fetchDepartments();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  };

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const res = await api.get('/deliveries');
      setDeliveries(res.data);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối khi tải danh sách phiếu xuất kho.');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await api.get('/materials');
      setMaterials(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItemRow = () => {
    setItems([...items, { MaterialId: '', SoLuong: 1, CategoryId: '', DonViTinh: '', GhiChu: '' }]);
  };

  const handleRemoveItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSelectMaterial = (index, materialId) => {
    const newItems = [...items];
    const matObj = materials.find(m => String(m.MaVatTu) === String(materialId));
    if (matObj) {
      newItems[index].MaterialId = matObj.MaVatTu;
      newItems[index].DonViTinh = matObj.DonViTinh || '';
      if (!newItems[index].CategoryId && matObj.MaDanhMuc) {
        newItems[index].CategoryId = String(matObj.MaDanhMuc);
      }
    } else {
      newItems[index].MaterialId = '';
      newItems[index].DonViTinh = '';
    }
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    const validItems = items.filter(item => item.MaterialId);

    if (validItems.length === 0) {
      setSubmitError('Vui lòng chọn ít nhất 1 mặt hàng vật tư xuất kho.');
      return;
    }

    for (let i = 0; i < validItems.length; i++) {
      const item = validItems[i];
      if (!item.SoLuong || parseInt(item.SoLuong) <= 0) {
        setSubmitError(`Dòng ${i + 1}: Số lượng xuất phải lớn hơn 0.`);
        return;
      }
    }

    if (!departmentId) {
      setSubmitError('Vui lòng chọn bộ phận nhận vật tư.');
      return;
    }

    try {
      const payload = {
        DepartmentId: parseInt(departmentId),
        GhiChu: note,
        ChiTiet: validItems.map(item => ({
          MaterialId: parseInt(item.MaterialId),
          SoLuong: parseInt(item.SoLuong),
          GhiChu: item.GhiChu || ''
        }))
      };

      await api.post('/deliveries', payload);
      setSubmitSuccess(true);
      setDepartmentId('');
      setNote('');
      setItems(createInitialDeliveryItems());
      fetchDeliveries();
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab('list');
      }, 1500);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Lỗi lập phiếu xuất kho.');
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const res = await api.get(`/deliveries/${id}`);
      setSelectedDelivery(res.data);
      setIsDetailModalOpen(true);
    } catch (err) {
      alert('Không thể tải chi tiết phiếu xuất kho.');
    }
  };

  const handlePrint = () => {
    if (!selectedDelivery) return;

    const itemsHtml = selectedDelivery.ChiTiet?.map((item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${item.MaCodeVatTu || '—'}</td>
        <td style="font-weight: bold;">${item.TenVatTu || '—'}</td>
        <td style="text-align: center;">${item.DonViTinh || '—'}</td>
        <td style="text-align: right; font-weight: bold; color: #be123c;">${(item.SoLuong || 0).toLocaleString('vi-VN')}</td>
      </tr>
    `).join('') || '';

    const totalQty = selectedDelivery.ChiTiet?.reduce((acc, curr) => acc + (curr.SoLuong || 0), 0) || 0;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('Vui lòng cho phép trình duyệt mở Cửa sổ Popup để in phiếu.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In Phiếu Xuất Kho - ${selectedDelivery.SoPhieuXuat}</title>
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
            <h2>PHIẾU XUẤT KHO VẬT TƯ CẤP PHÁT</h2>
            <p><strong>Mã số phiếu:</strong> ${selectedDelivery.SoPhieuXuat} | <strong>Ngày cấp phát:</strong> ${new Date(selectedDelivery.NgayXuat).toLocaleString('vi-VN')}</p>
          </div>

          <table class="meta-grid">
            <tr>
              <td style="width: 50%;"><strong>Bộ phận nhận vật tư:</strong> ${selectedDelivery.BoPhanNhan || '—'}</td>
              <td style="width: 50%; text-align: right;"><strong>Người lập yêu cầu:</strong> ${selectedDelivery.NguoiYeuCau || '—'}</td>
            </tr>
            <tr>
              <td><strong>Lý do xuất kho:</strong> ${selectedDelivery.GhiChu || '—'}</td>
              <td style="text-align: right;"><strong>Ngày in phiếu:</strong> ${new Date().toLocaleString('vi-VN')}</td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">STT</th>
                <th style="width: 120px;">Mã code</th>
                <th>Tên vật tư</th>
                <th style="width: 90px; text-align: center;">ĐVT</th>
                <th style="width: 110px; text-align: right;">Số lượng xuất</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              <tr style="font-weight: bold; background-color: #f8fafc;">
                <td colspan="4" style="text-align: right;">TỔNG SỐ LƯỢNG XUẤT:</td>
                <td style="text-align: right; color: #be123c; font-size: 12pt;">${totalQty.toLocaleString('vi-VN')}</td>
              </tr>
            </tbody>
          </table>

          <table class="signatures-table">
            <tr>
              <td>
                <div class="sig-title">Người Lập Yêu Cầu / Người Nhận</div>
                <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
                <div class="sig-space"></div>
                <div style="font-weight: bold;">${selectedDelivery.NguoiYeuCau || '—'}</div>
              </td>
              <td>
                <div class="sig-title">Thủ Kho Xuất Hàng</div>
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

  const totalExportQty = items.reduce((acc, curr) => acc + (parseInt(curr.SoLuong) || 0), 0);

  return (
    <div className="bg-white border border-sky-100 p-6 rounded-2xl shadow-sm relative text-slate-800">
      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-sky-100 pb-4 mb-6 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý xuất kho vật tư (GDN)</h2>
          <p className="text-sm text-slate-500">Yêu cầu cấp phát xuất kho và đồng bộ trừ tồn kho trực tiếp vào SQL Server.</p>
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
            Lịch sử xuất kho
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'create' 
                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/10' 
                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-750 border border-sky-100'
            }`}
          >
            Tạo yêu cầu xuất
          </button>
        </div>
      </div>

      {/* 1. TAB LIST */}
      {activeTab === 'list' && (
        <div className="no-print space-y-4">
          <div className="relative max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo số phiếu, người lập, bộ phận nhận..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="w-full bg-slate-50 border border-sky-100 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {historySearch && (
              <button
                type="button"
                onClick={() => setHistorySearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {error ? (
            <div className="text-red-650 bg-red-50 p-4 rounded-xl border border-red-100 text-sm">
              {error}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-600"></div>
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Không tìm thấy phiếu xuất kho nào.
            </div>
          ) : (
            <div className="overflow-x-auto border border-sky-100 rounded-xl">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-sky-100 text-slate-600 bg-sky-50/50 font-bold">
                    <th className="py-3 px-4 font-bold">Số phiếu xuất</th>
                    <th className="py-3 px-4 font-bold">Ngày xuất</th>
                    <th className="py-3 px-4 font-bold">Bộ phận nhận</th>
                    <th className="py-3 px-4 font-bold">Người lập phiếu</th>
                    <th className="py-3 px-4 font-bold">Lý do</th>
                    <th className="py-3 px-4 font-bold text-right w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeliveries.map((d) => (
                    <tr key={d.MaPhieuXuat} className="border-b border-sky-50 hover:bg-sky-50/20 transition-all h-12">
                      <td className="py-3 px-4 font-semibold text-rose-700 font-mono align-middle">{d.SoPhieuXuat}</td>
                      <td className="py-3 px-4 text-slate-500 align-middle">{new Date(d.NgayXuat).toLocaleString('vi-VN')}</td>
                      <td className="py-3 px-4 text-slate-800 font-bold align-middle">{d.BoPhanNhan}</td>
                      <td className="py-3 px-4 text-slate-600 align-middle">{d.NguoiYeuCau}</td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-xs align-middle">{d.GhiChu || '—'}</td>
                      <td className="py-3 px-4 text-right align-middle">
                        <button
                          onClick={() => handleOpenDetail(d.MaPhieuXuat)}
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-sky-50 text-slate-600 hover:text-sky-600 rounded-lg border border-sky-150 text-xs font-semibold ml-auto transition-all"
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
        <form onSubmit={handleSubmit} className="space-y-6 no-print">
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-650 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle size={18} /> {submitError}
            </div>
          )}

          {submitSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl">
              Cấp phát xuất kho thành công! Số lượng hàng đã được tự động trừ tồn kho.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">BỘ PHẬN NHẬN VẬT TƯ *</label>
              <select
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
              >
                <option value="">-- Chọn bộ phận khách sạn --</option>
                {departments.map(d => (
                  <option key={d.DepartmentId} value={d.DepartmentId}>{d.DepartmentName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">LÝ DO XUẤT KHO / GHI CHÚ</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập lý do xuất (Ví dụ: Setup phòng VIP, thay bóng đèn hỏng...)"
                className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
              />
            </div>
          </div>

          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wide">CHI TIẾT PHIẾU XUẤT KHO CẤP PHÁT</h3>
            </div>

            <div className="overflow-x-auto border border-blue-200 rounded-xl shadow-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-blue-100/90 text-blue-950 border-b border-blue-200 font-bold">
                    <th className="py-3 px-3 text-center border-r border-blue-200 w-12">STT</th>
                    <th className="py-3 px-4 border-r border-blue-200 w-44">Loại vật tư *</th>
                    <th className="py-3 px-4 border-r border-blue-200 min-w-[280px]">Hàng hóa (Tên vật tư)</th>
                    <th className="py-3 px-3 border-r border-blue-200 w-28 text-center">Đơn vị tính</th>
                    <th className="py-3 px-3 border-r border-blue-200 w-32 text-right">Số lượng *</th>
                    <th className="py-3 px-3 border-r border-blue-200 min-w-[150px]">Ghi chú</th>
                    <th className="py-3 px-3 text-center w-14">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const rowMaterials = item.CategoryId 
                      ? materials.filter(m => String(m.MaDanhMuc) === String(item.CategoryId))
                      : materials;

                    return (
                      <tr key={index} className="border-b border-slate-200 hover:bg-sky-50/20 transition-all h-14">
                        {/* STT */}
                        <td className="px-3 text-center border-r border-slate-200 font-semibold text-slate-600 align-middle">
                          {index + 1}
                        </td>

                        {/* Loại vật tư */}
                        <td className="px-2.5 border-r border-slate-200 align-middle">
                          <select
                            value={item.CategoryId || ''}
                            onChange={(e) => {
                              handleItemChange(index, 'CategoryId', e.target.value);
                              if (e.target.value && item.MaterialId) {
                                const exists = materials.some(m => String(m.MaVatTu) === String(item.MaterialId) && String(m.MaDanhMuc) === String(e.target.value));
                                if (!exists) handleSelectMaterial(index, '');
                              }
                            }}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500 font-medium h-10"
                          >
                            <option value="">-- Tất cả loại --</option>
                            {categories.map(c => (
                              <option key={c.MaDanhMuc} value={c.MaDanhMuc}>{c.TenDanhMuc}</option>
                            ))}
                          </select>
                        </td>

                        {/* Hàng hóa */}
                        <td className="px-2.5 border-r border-slate-200 align-middle">
                          <MaterialSelect
                            value={item.MaterialId}
                            onChange={(val) => handleSelectMaterial(index, val)}
                            materials={rowMaterials}
                            placeholder="— Lựa chọn vật tư xuất —"
                            showStock={true}
                          />
                        </td>

                        {/* Đơn vị tính */}
                        <td className="px-3 border-r border-slate-200 text-center text-slate-700 font-medium bg-slate-50/40 text-xs align-middle">
                          {item.DonViTinh || (materials.find(m => String(m.MaVatTu) === String(item.MaterialId))?.DonViTinh) || '—'}
                        </td>

                        {/* Số lượng */}
                        <td className="px-2.5 border-r border-slate-200 align-middle">
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="0"
                            value={item.SoLuong}
                            onChange={(e) => handleItemChange(index, 'SoLuong', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:border-sky-500 text-right font-semibold h-10"
                          />
                        </td>

                        {/* Ghi chú */}
                        <td className="px-2.5 border-r border-slate-200 align-middle">
                          <input
                            type="text"
                            placeholder="Ghi chú..."
                            value={item.GhiChu || ''}
                            onChange={(e) => handleItemChange(index, 'GhiChu', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 text-xs text-slate-800 focus:outline-none focus:border-sky-500 h-10"
                          />
                        </td>

                        {/* Hành động */}
                        <td className="px-2 text-center align-middle">
                          <button
                            type="button"
                            disabled={items.length === 1}
                            onClick={() => handleRemoveItemRow(index)}
                            className="p-2 bg-white border border-rose-200 hover:bg-rose-50 text-rose-500 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-all"
                            title="Xóa dòng"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Thêm hàng hóa & Tổng số lượng */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3">
              <div className="text-sm font-semibold text-slate-700">
                Tổng số lượng xuất: <span className="text-rose-600 text-lg font-extrabold ml-1.5">{totalExportQty.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-500/20"
              >
                <Plus size={16} /> Thêm hàng hóa
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-sky-100">
            <button
              type="button"
              onClick={() => {
                setDepartmentId('');
                setNote('');
                setItems(createInitialDeliveryItems());
                setActiveTab('list');
              }}
              className="px-4 py-2 border border-sky-150 hover:bg-slate-50 text-slate-500 rounded-xl text-sm font-semibold transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-sky-500/20"
            >
              Cấp phát xuất kho
            </button>
          </div>
        </form>
      )}

      {/* 3. DETAIL MODAL */}
      {isDetailModalOpen && selectedDelivery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] no-print">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100">
              <h3 className="text-base font-bold text-slate-850 flex items-center gap-1.5">
                <FileText size={18} className="text-indigo-650" />
                Chi tiết phiếu xuất kho
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-sky-500/10"
                >
                  <Printer size={14} /> In phiếu
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
                  <p className="text-[10px] font-semibold text-slate-455">SỐ PHIẾU XUẤT</p>
                  <p className="text-sm font-bold text-indigo-600 mt-0.5">{selectedDelivery.SoPhieuXuat}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">BỘ PHẬN NHẬN HÀNG</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{selectedDelivery.BoPhanNhan}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">NGƯỜI LẬP YÊU CẦU</p>
                  <p className="text-xs text-slate-600 mt-0.5">{selectedDelivery.NguoiYeuCau} | {new Date(selectedDelivery.NgayXuat).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">LÝ DO XUẤT KHO</p>
                  <p className="text-xs text-slate-600 mt-0.5">{selectedDelivery.GhiChu || '—'}</p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Danh sách mặt hàng xuất kho</h4>
                <div className="overflow-hidden border border-sky-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-sky-50/20 border-b border-sky-100 text-slate-500">
                        <th className="py-2.5 px-4 font-bold">Mã code</th>
                        <th className="py-2.5 px-4 font-bold">Tên vật tư</th>
                        <th className="py-2.5 px-4 font-bold">ĐVT</th>
                        <th className="py-2.5 px-4 font-bold text-right">Số lượng xuất</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDelivery.ChiTiet?.map((item, idx) => (
                        <tr key={idx} className="border-b border-sky-50 hover:bg-sky-50/10 transition-all">
                          <td className="py-3 px-4 font-semibold text-slate-500">{item.MaCodeVatTu}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{item.TenVatTu}</td>
                          <td className="py-3 px-4 text-slate-550">{item.DonViTinh}</td>
                          <td className="py-3 px-4 font-bold text-slate-750 text-right">{item.SoLuong.toLocaleString()}</td>
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

      {/* PRINT-ONLY AREA */}
      {selectedDelivery && (
        <div className="hidden print:block print-container font-sans text-black p-8">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase">NoVa Sphere Hotel</h1>
            <p className="text-xs">Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh</p>
            <p className="text-xs font-semibold mt-1">HỆ THỐNG QUẢN LÝ VẬT TƯ KHÁCH SẠN</p>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-bold uppercase">Phiếu Xuất Kho Vật Tư</h2>
            <p className="text-sm font-semibold">Số phiếu: {selectedDelivery.SoPhieuXuat}</p>
            <p className="text-xs">Ngày cấp phát: {new Date(selectedDelivery.NgayXuat).toLocaleString()}</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm leading-relaxed">
            <div>
              <p><strong>Bộ phận nhận:</strong> {selectedDelivery.BoPhanNhan}</p>
              <p><strong>Người lập yêu cầu:</strong> {selectedDelivery.NguoiYeuCau}</p>
              <p><strong>Lý do xuất:</strong> {selectedDelivery.GhiChu || '—'}</p>
            </div>
            <div className="text-right">
              <p><strong>Ngày in phiếu:</strong> {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse border border-black mb-8">
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="border border-black py-2 px-3 text-left">Mã code</th>
                <th className="border border-black py-2 px-3 text-left">Tên vật tư</th>
                <th className="border border-black py-2 px-3 text-center">ĐVT</th>
                <th className="border border-black py-2 px-3 text-right">Số lượng xuất</th>
              </tr>
            </thead>
            <tbody>
              {selectedDelivery.ChiTiet?.map((item, idx) => (
                <tr key={idx} className="border-b border-black">
                  <td className="border border-black py-2 px-3">{item.MaCodeVatTu}</td>
                  <td className="border border-black py-2 px-3">{item.TenVatTu}</td>
                  <td className="border border-black py-2 px-3 text-center">{item.DonViTinh}</td>
                  <td className="border border-black py-2 px-3 text-right">{item.SoLuong.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 text-center text-sm font-semibold mt-12">
            <div>
              <p>Người lập phiếu (Đề xuất)</p>
              <div className="h-16"></div>
              <p className="mt-4">{selectedDelivery.NguoiYeuCau}</p>
            </div>
            <div>
              <p>Thủ kho xuất hàng</p>
              <div className="h-16"></div>
              <p className="mt-4">........................................</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
