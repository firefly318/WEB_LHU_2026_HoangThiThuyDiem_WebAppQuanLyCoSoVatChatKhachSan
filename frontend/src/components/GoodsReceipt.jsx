import React, { useState, useEffect } from 'react';
import api from '../api';
import { Plus, Trash2, Printer, X, Eye, FileText, Package, AlertCircle, Search, RefreshCw } from 'lucide-react';

function MaterialSelect({ value, onChange, materials, placeholder = "— Lựa chọn —" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const sortedMaterials = React.useMemo(() => {
    return [...materials].sort((a, b) => 
      a.TenVatTu.localeCompare(b.TenVatTu, 'vi', { sensitivity: 'base' })
    );
  }, [materials]);
  
  const filteredMaterials = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedMaterials;
    return sortedMaterials.filter(m => 
      (m.TenVatTu && m.TenVatTu.toLowerCase().includes(q)) ||
      (m.MaCodeVatTu && m.MaCodeVatTu.toLowerCase().includes(q))
    );
  }, [sortedMaterials, search]);
  
  const selectedMaterial = materials.find(m => String(m.MaVatTu) === String(value));

  useEffect(() => {
    if (!isOpen) return;
    const handleClose = () => setIsOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [isOpen]);

  return (
    <div className="relative w-full text-slate-800" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-left text-slate-800 flex justify-between items-center focus:outline-none focus:border-sky-500 transition-all h-10 shadow-sm"
      >
        <span className="truncate font-medium">
          {selectedMaterial ? (
            `${selectedMaterial.TenVatTu} (${selectedMaterial.MaCodeVatTu})`
          ) : (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          )}
        </span>
        <span className="text-slate-500 text-xs ml-1 shrink-0">▼</span>
      </button>

      {isOpen && (
        <div className="absolute z-40 w-full min-w-[320px] max-w-[460px] mt-1 bg-white border border-slate-300 rounded-xl shadow-2xl p-2.5 space-y-2 max-h-80 flex flex-col left-0">
          <div className="relative flex-1 min-w-0">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Nhập mã hàng hóa hoặc tên vật tư..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-8 py-2 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all placeholder:text-slate-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1 divide-y divide-slate-100 border-t border-slate-100 pt-1">
            {filteredMaterials.length === 0 ? (
              <div className="text-center py-5 text-xs text-slate-400">Không tìm thấy vật tư khớp với từ khóa</div>
            ) : (
              filteredMaterials.map(m => (
                <button
                  key={m.MaVatTu}
                  type="button"
                  onClick={() => {
                    onChange(m);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-sky-50 transition-all flex flex-col ${
                    String(m.MaVatTu) === String(value) ? 'bg-sky-50 text-sky-700 font-semibold' : 'text-slate-700'
                  }`}
                >
                  <span className="font-bold text-slate-800 uppercase tracking-tight">{m.TenVatTu}</span>
                  <div className="flex justify-between items-center text-xs text-slate-500 mt-0.5 font-mono">
                    <span>Mã: {m.MaCodeVatTu}</span>
                    <span className="text-slate-400 font-sans">ĐVT: {m.DonViTinh}</span>
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

export default function GoodsReceipt() {
  const [receipts, setReceipts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // View states
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'create'
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Form states
  const [receiptType, setReceiptType] = useState('NCC'); // 'NCC' | 'BO_PHAN'
  const [supplierId, setSupplierId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState([{ MaterialId: '', SoLuong: 1, DonGiaNhap: 0 }]);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const filteredReceipts = React.useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(r =>
      (r.SoPhieuNhap && r.SoPhieuNhap.toLowerCase().includes(q)) ||
      (r.NguoiLap && r.NguoiLap.toLowerCase().includes(q)) ||
      (r.GhiChu && r.GhiChu.toLowerCase().includes(q))
    );
  }, [receipts, historySearch]);

  useEffect(() => {
    fetchReceipts();
    fetchMaterials();
    fetchSuppliers();
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

  const fetchDepartments = async () => {
    try {
      const res = await api.get('/departments');
      setDepartments(res.data);
    } catch (err) {
      console.error('Lỗi tải bộ phận:', err);
    }
  };

  const fetchReceipts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/receipts');
      setReceipts(res.data);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối khi tải danh sách phiếu nhập kho.');
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

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItemRow = () => {
    setItems([...items, { MaterialId: '', SoLuong: 1, DonGiaNhap: 0, TinhChat: 'Hàng hóa', DonViTinh: '', GhiChu: '' }]);
  };

  const handleRemoveItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSelectMaterial = (index, matObj) => {
    const newItems = [...items];
    if (matObj) {
      newItems[index].MaterialId = matObj.MaVatTu;
      newItems[index].DonViTinh = matObj.DonViTinh || '';
    } else {
      newItems[index].MaterialId = '';
      newItems[index].DonViTinh = '';
    }
    setItems(newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const totalAmount = React.useMemo(() => {
    return items.reduce((sum, item) => {
      const q = parseFloat(item.SoLuong) || 0;
      const p = parseFloat(item.DonGiaNhap) || 0;
      return sum + (q * p);
    }, 0);
  }, [items]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError(null);

    // Check material selection & quantity & price
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.MaterialId) {
        setSubmitError(`Dòng ${i + 1}: Vui lòng chọn vật tư cần nhập.`);
        return;
      }
      if (!item.SoLuong || parseInt(item.SoLuong) <= 0) {
        setSubmitError(`Dòng ${i + 1}: Số lượng nhập phải lớn hơn 0.`);
        return;
      }

      // Check unit price if importing from supplier
      if (receiptType === 'NCC') {
        if (item.DonGiaNhap === '' || item.DonGiaNhap === null || item.DonGiaNhap === undefined) {
          setSubmitError(`Dòng ${i + 1}: Đơn giá nhập không được bỏ trống.`);
          return;
        }
        const price = parseFloat(item.DonGiaNhap);
        if (isNaN(price) || price < 0) {
          setSubmitError(`Dòng ${i + 1}: Đơn giá nhập không được âm.`);
          return;
        }
      }
    }

    if (receiptType === 'NCC' && !supplierId) {
      setSubmitError('Vui lòng chọn nhà cung cấp.');
      return;
    }

    if (receiptType === 'BO_PHAN' && !departmentId) {
      setSubmitError('Vui lòng chọn bộ phận hoàn trả.');
      return;
    }

    try {
      const payload = {
        ReceiptType: receiptType,
        SupplierId: receiptType === 'NCC' ? parseInt(supplierId) : null,
        DepartmentId: receiptType === 'BO_PHAN' ? parseInt(departmentId) : null,
        Note: note,
        ChiTiet: items.map(item => ({
          MaterialId: parseInt(item.MaterialId),
          SoLuong: parseInt(item.SoLuong),
          DonGiaNhap: receiptType === 'BO_PHAN' ? 0 : parseFloat(item.DonGiaNhap || 0)
        }))
      };

      await api.post('/receipts', payload);
      setSubmitSuccess(true);
      setSupplierId('');
      setDepartmentId('');
      setNote('');
      setItems([{ MaterialId: '', SoLuong: 1, DonGiaNhap: 0, TinhChat: 'Hàng hóa', DonViTinh: '', GhiChu: '' }]);
      fetchReceipts();
      setTimeout(() => {
        setSubmitSuccess(false);
        setActiveTab('list');
      }, 1500);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Lỗi lập phiếu nhập kho.');
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const res = await api.get(`/receipts/${id}`);
      setSelectedReceipt(res.data);
      setIsDetailModalOpen(true);
    } catch (err) {
      alert('Không thể tải chi tiết phiếu nhập kho.');
    }
  };

  const handlePrint = () => {
    if (!selectedReceipt) return;

    const isDepartmentReturn = selectedReceipt.LoaiNhap === 'BO_PHAN';
    const titleText = isDepartmentReturn ? 'PHIẾU NHẬP HOÀN TRẢ TỪ BỘ PHẬN' : 'PHIẾU NHẬP KHO VẬT TƯ';
    const sourceLabel = isDepartmentReturn ? 'Bộ phận hoàn trả:' : 'Nhà cung cấp:';
    const sourceVal = selectedReceipt.GhiChu || '—';

    const itemsHtml = selectedReceipt.ChiTiet?.map((item, idx) => `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td style="font-family: monospace; font-weight: bold;">${item.MaCodeVatTu || '—'}</td>
        <td style="font-weight: bold;">${item.TenVatTu || '—'}</td>
        <td style="text-align: center;">${item.DonViTinh || '—'}</td>
        <td style="text-align: right; font-weight: bold;">${(item.SoLuong || 0).toLocaleString('vi-VN')}</td>
        ${!isDepartmentReturn ? `
          <td style="text-align: right;">${(item.DonGiaNhap || 0).toLocaleString('vi-VN')} VNĐ</td>
          <td style="text-align: right; font-weight: bold;">${((item.SoLuong || 0) * (item.DonGiaNhap || 0)).toLocaleString('vi-VN')} VNĐ</td>
        ` : ''}
      </tr>
    `).join('') || '';

    const totalQty = selectedReceipt.ChiTiet?.reduce((acc, curr) => acc + (curr.SoLuong || 0), 0) || 0;
    const totalAmount = selectedReceipt.ChiTiet?.reduce((acc, curr) => acc + ((curr.SoLuong || 0) * (curr.DonGiaNhap || 0)), 0) || 0;

    const totalRowHtml = !isDepartmentReturn ? `
      <tr style="font-weight: bold; background-color: #f8fafc;">
        <td colspan="6" style="text-align: right;">TỔNG GIÁ TRỊ PHIẾU NHẬP:</td>
        <td style="text-align: right; color: #047857; font-size: 12pt;">${totalAmount.toLocaleString('vi-VN')} VNĐ</td>
      </tr>
    ` : `
      <tr style="font-weight: bold; background-color: #f8fafc;">
        <td colspan="4" style="text-align: right;">TỔNG SỐ LƯỢNG HOÀN TRẢ:</td>
        <td style="text-align: right; color: #0369a1; font-size: 12pt;">${totalQty.toLocaleString('vi-VN')}</td>
      </tr>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('Vui lòng cho phép trình duyệt mở Cửa sổ Popup để in phiếu.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In ${titleText} - ${selectedReceipt.SoPhieuNhap}</title>
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
            <h2>${titleText}</h2>
            <p><strong>Mã số phiếu:</strong> ${selectedReceipt.SoPhieuNhap} | <strong>Ngày nhập kho:</strong> ${new Date(selectedReceipt.NgayNhap).toLocaleString('vi-VN')}</p>
          </div>

          <table class="meta-grid">
            <tr>
              <td style="width: 50%;"><strong>Người lập phiếu:</strong> ${selectedReceipt.NguoiLap || '—'}</td>
              <td style="width: 50%; text-align: right;"><strong>${sourceLabel}</strong> ${sourceVal}</td>
            </tr>
            <tr>
              <td><strong>Trạng thái phiếu:</strong> Đã hoàn tất nhập kho vào SQL Server</td>
              <td style="text-align: right;"><strong>Ngày in chứng từ:</strong> ${new Date().toLocaleString('vi-VN')}</td>
            </tr>
          </table>

          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">STT</th>
                <th style="width: 110px;">Mã code</th>
                <th>Tên vật tư</th>
                <th style="width: 80px; text-align: center;">ĐVT</th>
                <th style="width: 90px; text-align: right;">Số lượng</th>
                ${!isDepartmentReturn ? `
                  <th style="width: 120px; text-align: right;">Đơn giá</th>
                  <th style="width: 140px; text-align: right;">Thành tiền</th>
                ` : ''}
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              ${totalRowHtml}
            </tbody>
          </table>

          <table class="signatures-table">
            <tr>
              <td>
                <div class="sig-title">Người Giao Hàng / Đại Diện</div>
                <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
                <div class="sig-space"></div>
                <div>........................................................</div>
              </td>
              <td>
                <div class="sig-title">Thủ Kho / Người Nhận Hàng</div>
                <div class="sig-sub">(Ký và ghi rõ họ tên)</div>
                <div class="sig-space"></div>
                <div style="font-weight: bold;">${selectedReceipt.NguoiLap || '—'}</div>
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

  return (
    <div className="bg-white border border-sky-100 p-6 rounded-2xl shadow-sm relative">
      {/* Tabs Header */}
      <div className="flex items-center justify-between border-b border-sky-100 pb-4 mb-6 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý nhập kho (GRN)</h2>
          <p className="text-sm text-slate-500">Tạo phiếu nhập vật tư mới từ nhà cung cấp và in ấn chứng từ giao nhận.</p>
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
            Lịch sử nhập kho
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'create' 
                ? 'bg-sky-600 text-white shadow-md shadow-sky-500/10' 
                : 'bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-750 border border-sky-100'
            }`}
          >
            Lập phiếu nhập
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
              placeholder="Tìm theo số phiếu, người lập, nhà cung cấp..."
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
          ) : filteredReceipts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Không tìm thấy phiếu nhập kho nào.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-sky-100 text-slate-500 bg-sky-50/20">
                    <th className="py-3 px-4 font-bold">Số phiếu nhập</th>
                    <th className="py-3 px-4 font-bold">Ngày nhập</th>
                    <th className="py-3 px-4 font-bold">Người lập</th>
                    <th className="py-3 px-4 font-bold">Nhà cung cấp</th>
                    <th className="py-3 px-4 font-bold text-right w-28">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((r) => (
                    <tr key={r.MaPhieuNhap} className="border-b border-sky-50 hover:bg-sky-50/10 transition-all">
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{r.SoPhieuNhap}</td>
                      <td className="py-3.5 px-4 text-slate-500">{new Date(r.NgayNhap).toLocaleString()}</td>
                      <td className="py-3.5 px-4 text-slate-700 font-medium">{r.NguoiLap}</td>
                      <td className="py-3.5 px-4 text-slate-500 truncate max-w-xs">{r.GhiChu}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenDetail(r.MaPhieuNhap)}
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
        <form onSubmit={handleSubmit} className="space-y-6 no-print">
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-650 text-sm rounded-xl flex items-center gap-2">
              <AlertCircle size={18} /> {submitError}
            </div>
          )}

          {submitSuccess && (
            <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-sm rounded-xl">
              Lập phiếu nhập kho thành công! Đang lưu thông số...
            </div>
          )}

          {/* LOẠI PHIẾU NHẬP KHO */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase">LOẠI PHIẾU NHẬP KHO *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReceiptType('NCC')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  receiptType === 'NCC'
                    ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/10'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-sky-100'
                }`}
              >
                <Package size={16} /> 📦 Nhập mới từ Nhà Cung Cấp
              </button>
              <button
                type="button"
                onClick={() => setReceiptType('BO_PHAN')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold transition-all ${
                  receiptType === 'BO_PHAN'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-500/10'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-sky-100'
                }`}
              >
                <RefreshCw size={16} /> 🔄 Nhập hoàn trả từ Bộ Phận
              </button>
            </div>
          </div>

          {receiptType === 'NCC' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">NHÀ CUNG CẤP *</label>
              <select
                required
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
              >
                <option value="">-- Chọn nhà cung cấp vật tư --</option>
                {suppliers.map(s => (
                  <option key={s.SupplierId} value={s.SupplierId}>{s.SupplierName}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">BỘ PHẬN HOÀN TRẢ *</label>
                <select
                  required
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                >
                  <option value="">-- Chọn bộ phận hoàn trả vật tư --</option>
                  {departments.map(d => (
                    <option key={d.DepartmentId} value={d.DepartmentId}>{d.DepartmentName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">LÝ DO HOÀN TRẢ / GHI CHÚ</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: Thừa sau khi setup sự kiện hội nghị..."
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          <div className="space-y-4 pt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wide">CHI TIẾT HÓA ĐƠN (PHIẾU NHẬP)</h3>
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
                    {receiptType === 'NCC' && (
                      <>
                        <th className="py-3 px-3 border-r border-blue-200 w-36 text-right">Đơn giá *</th>
                        <th className="py-3 px-4 border-r border-blue-200 w-40 text-right">Thành tiền *</th>
                      </>
                    )}
                    <th className="py-3 px-3 border-r border-blue-200 min-w-[150px]">Ghi chú</th>
                    <th className="py-3 px-3 text-center w-14">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const lineTotal = (parseFloat(item.SoLuong) || 0) * (parseFloat(item.DonGiaNhap) || 0);
                    // Filter materials for this row if a category is selected
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
                              // Reset material if it doesn't belong to newly selected category
                              if (e.target.value && item.MaterialId) {
                                const exists = materials.some(m => String(m.MaVatTu) === String(item.MaterialId) && String(m.MaDanhMuc) === String(e.target.value));
                                if (!exists) handleSelectMaterial(index, null);
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
                            onChange={(matObj) => handleSelectMaterial(index, matObj)}
                            materials={rowMaterials}
                            placeholder="— Lựa chọn vật tư —"
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

                        {/* Đơn giá & Thành tiền (chỉ cho Nhập từ NCC) */}
                        {receiptType === 'NCC' && (
                          <>
                            <td className="px-2.5 border-r border-slate-200 align-middle">
                              <input
                                type="text"
                                required
                                placeholder="0"
                                value={
                                  item.DonGiaNhap !== '' && item.DonGiaNhap !== null && item.DonGiaNhap !== undefined
                                    ? Number(item.DonGiaNhap).toLocaleString('en-US')
                                    : ''
                                }
                                onChange={(e) => {
                                  const rawValue = e.target.value.replace(/[^0-9]/g, '');
                                  handleItemChange(index, 'DonGiaNhap', rawValue);
                                }}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 text-sm text-slate-800 focus:outline-none focus:border-sky-500 text-right font-bold h-10"
                              />
                            </td>

                            <td className="px-4 border-r border-slate-200 text-right font-bold text-slate-800 bg-slate-50/40 text-sm align-middle">
                              {lineTotal.toLocaleString()} VNĐ
                            </td>
                          </>
                        )}

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

            {/* Thêm hàng hóa & Tổng tiền */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3">
              <div className="text-sm font-semibold text-slate-700">
                {receiptType === 'NCC' ? (
                  <>Tổng tiền hàng: <span className="text-rose-600 text-lg font-extrabold ml-1.5">{totalAmount.toLocaleString()} VNĐ</span></>
                ) : (
                  <>Tổng số lượng hoàn trả: <span className="text-sky-600 text-lg font-extrabold ml-1.5">{items.reduce((sum, i) => sum + (parseInt(i.SoLuong) || 0), 0).toLocaleString()}</span></>
                )}
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
                setSupplierId('');
                setItems([{ MaterialId: '', SoLuong: 1, DonGiaNhap: 0 }]);
                setActiveTab('list');
              }}
              className="px-4 py-2 border border-sky-150 hover:bg-slate-50 text-slate-500 rounded-xl text-sm font-semibold transition-all"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-sky-500/10"
            >
              Hoàn tất nhập kho
            </button>
          </div>
        </form>
      )}

      {/* 3. DETAIL & PRINT VOUCHER MODAL */}
      {isDetailModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] no-print text-slate-800">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100">
              <h3 className="text-base font-bold text-slate-850 flex items-center gap-1.5">
                <FileText size={18} className="text-sky-600" />
                Chi tiết phiếu nhập kho
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
                  <p className="text-[10px] font-semibold text-slate-455">SỐ PHIẾU NHẬP</p>
                  <p className="text-sm font-bold text-sky-600 mt-0.5">{selectedReceipt.SoPhieuNhap}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">NGƯỜI LẬP PHIẾU</p>
                  <p className="text-sm font-bold text-slate-700 mt-0.5">{selectedReceipt.NguoiLap}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">NGÀY NHẬP KHO</p>
                  <p className="text-xs text-slate-600 mt-0.5">{new Date(selectedReceipt.NgayNhap).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-455">
                    {selectedReceipt.LoaiNhap === 'BO_PHAN' ? 'BỘ PHẬN HOÀN TRẢ' : 'NHÀ CUNG CẤP'}
                  </p>
                  <p className="text-xs text-slate-600 mt-0.5 truncate font-medium">
                    {selectedReceipt.GhiChu}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wider">Danh sách mặt hàng nhập kho</h4>
                <div className="overflow-hidden border border-sky-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-sky-50/20 border-b border-sky-100 text-slate-500">
                        <th className="py-2.5 px-4 font-bold">Mã code</th>
                        <th className="py-2.5 px-4 font-bold">Tên vật tư</th>
                        <th className="py-2.5 px-4 font-bold">ĐVT</th>
                        <th className="py-2.5 px-4 font-bold text-right">Số lượng</th>
                        {selectedReceipt.LoaiNhap !== 'BO_PHAN' && (
                          <>
                            <th className="py-2.5 px-4 font-bold text-right">Đơn giá nhập</th>
                            <th className="py-2.5 px-4 font-bold text-right">Thành tiền</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedReceipt.ChiTiet?.map((item, idx) => (
                        <tr key={idx} className="border-b border-sky-50 hover:bg-sky-50/10 transition-all">
                          <td className="py-3 px-4 font-semibold text-slate-500">{item.MaCodeVatTu}</td>
                          <td className="py-3 px-4 font-semibold text-slate-700">{item.TenVatTu}</td>
                          <td className="py-3 px-4 text-slate-550">{item.DonViTinh}</td>
                          <td className="py-3 px-4 font-bold text-slate-750 text-right">{item.SoLuong.toLocaleString()}</td>
                          {selectedReceipt.LoaiNhap !== 'BO_PHAN' && (
                            <>
                              <td className="py-3 px-4 font-medium text-slate-600 text-right">{item.DonGiaNhap.toLocaleString()} VNĐ</td>
                              <td className="py-3 px-4 font-bold text-sky-600 text-right">{(item.SoLuong * item.DonGiaNhap).toLocaleString()} VNĐ</td>
                            </>
                          )}
                        </tr>
                      ))}
                      <tr className="bg-sky-50/30">
                        {selectedReceipt.LoaiNhap !== 'BO_PHAN' ? (
                          <>
                            <td colSpan="5" className="py-3 px-4 text-right font-bold text-slate-600">TỔNG GIÁ TRỊ PHIẾU:</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-600 text-sm">
                              {selectedReceipt.ChiTiet?.reduce((acc, curr) => acc + (curr.SoLuong * curr.DonGiaNhap), 0).toLocaleString()} VNĐ
                            </td>
                          </>
                        ) : (
                          <>
                            <td colSpan="3" className="py-3 px-4 text-right font-bold text-slate-600">TỔNG SỐ LƯỢNG HOÀN TRẢ:</td>
                            <td className="py-3 px-4 text-right font-bold text-sky-600 text-sm">
                              {selectedReceipt.ChiTiet?.reduce((acc, curr) => acc + curr.SoLuong, 0).toLocaleString()}
                            </td>
                          </>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PRINT-ONLY AREA */}
      {selectedReceipt && (
        <div className="hidden print:block print-container font-sans text-black p-8">
          <div className="text-center border-b-2 border-black pb-4 mb-6">
            <h1 className="text-2xl font-bold uppercase">NoVa Sphere Hotel</h1>
            <p className="text-xs">Đường Lê Lợi, Quận 1, TP. Hồ Chí Minh</p>
            <p className="text-xs font-semibold mt-1">HỆ THỐNG QUẢN LÝ VẬT TƯ KHÁCH SẠN</p>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-xl font-bold uppercase">
              {selectedReceipt.LoaiNhap === 'BO_PHAN' ? 'Phiếu Nhập Hoàn Trả Từ Bộ Phận' : 'Phiếu Nhập Kho Vật Tư'}
            </h2>
            <p className="text-sm font-semibold">Số phiếu: {selectedReceipt.SoPhieuNhap}</p>
            <p className="text-xs">Ngày nhập kho: {new Date(selectedReceipt.NgayNhap).toLocaleString()}</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 text-sm leading-relaxed">
            <div>
              <p><strong>Người lập phiếu:</strong> {selectedReceipt.NguoiLap}</p>
              <p><strong>{selectedReceipt.LoaiNhap === 'BO_PHAN' ? 'Bộ phận hoàn trả:' : 'Nhà cung cấp:'}</strong> {selectedReceipt.GhiChu}</p>
            </div>
            <div className="text-right">
              <p><strong>Ngày lập:</strong> {new Date().toLocaleDateString()}</p>
              <p><strong>Trạng thái:</strong> Đã hoàn thành nhập kho</p>
            </div>
          </div>

          <table className="w-full text-sm border-collapse border border-black mb-8">
            <thead>
              <tr className="bg-gray-100 border-b border-black">
                <th className="border border-black py-2 px-3 text-left">Mã</th>
                <th className="border border-black py-2 px-3 text-left">Tên vật tư</th>
                <th className="border border-black py-2 px-3 text-center">ĐVT</th>
                <th className="border border-black py-2 px-3 text-right">Số lượng</th>
                {selectedReceipt.LoaiNhap !== 'BO_PHAN' && (
                  <>
                    <th className="border border-black py-2 px-3 text-right">Đơn giá</th>
                    <th className="border border-black py-2 px-3 text-right">Thành tiền</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {selectedReceipt.ChiTiet?.map((item, idx) => (
                <tr key={idx} className="border-b border-black">
                  <td className="border border-black py-2 px-3">{item.MaCodeVatTu}</td>
                  <td className="border border-black py-2 px-3">{item.TenVatTu}</td>
                  <td className="border border-black py-2 px-3 text-center">{item.DonViTinh}</td>
                  <td className="border border-black py-2 px-3 text-right">{item.SoLuong.toLocaleString()}</td>
                  {selectedReceipt.LoaiNhap !== 'BO_PHAN' && (
                    <>
                      <td className="border border-black py-2 px-3 text-right">{item.DonGiaNhap.toLocaleString()} VNĐ</td>
                      <td className="border border-black py-2 px-3 text-right">{(item.SoLuong * item.DonGiaNhap).toLocaleString()} VNĐ</td>
                    </>
                  )}
                </tr>
              ))}
              <tr>
                {selectedReceipt.LoaiNhap !== 'BO_PHAN' ? (
                  <>
                    <td colSpan="5" className="border border-black py-2 px-3 text-right font-bold">Tổng cộng:</td>
                    <td className="border border-black py-2 px-3 text-right font-bold">
                      {selectedReceipt.ChiTiet?.reduce((acc, curr) => acc + (curr.SoLuong * curr.DonGiaNhap), 0).toLocaleString()} VNĐ
                    </td>
                  </>
                ) : (
                  <>
                    <td colSpan="3" className="border border-black py-2 px-3 text-right font-bold">Tổng số lượng hoàn trả:</td>
                    <td className="border border-black py-2 px-3 text-right font-bold">
                      {selectedReceipt.ChiTiet?.reduce((acc, curr) => acc + curr.SoLuong, 0).toLocaleString()}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
          </table>

          <div className="grid grid-cols-2 text-center text-sm font-semibold mt-12">
            <div>
              <p>Người giao hàng</p>
              <p className="text-xs text-gray-500 font-normal mt-1">(Ký, ghi rõ họ tên)</p>
              <div className="h-16"></div>
              <p className="mt-4">........................................</p>
            </div>
            <div>
              <p>Nhân viên nhận hàng (Thủ kho)</p>
              <p className="text-xs text-gray-500 font-normal mt-1">(Ký, ghi rõ họ tên)</p>
              <div className="h-16"></div>
              <p className="mt-4">{selectedReceipt.NguoiLap}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
