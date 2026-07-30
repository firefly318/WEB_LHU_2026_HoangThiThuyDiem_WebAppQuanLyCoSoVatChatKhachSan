import React, { useState, useEffect } from 'react';
import api from '../api';
import { Search, Plus, Edit2, Trash2, X, AlertCircle, RefreshCw } from 'lucide-react';

export default function MaterialList() {
  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Pagination & Sorting States
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('alphabet-az');

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [dvt, setDvt] = useState('');
  const [minQty, setMinQty] = useState(0);
  const [catId, setCatId] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
    fetchMaterials();
    fetchCategories();
  }, [catFilter]);

  const fetchMaterials = async () => {
    try {
      setLoading(true);
      const res = await api.get('/materials', {
        params: { search, categoryId: catFilter }
      });
      setMaterials(res.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('Lỗi kết nối khi tải danh sách vật tư.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    fetchMaterials();
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Sort the materials
  const sortedAndFiltered = React.useMemo(() => {
    let result = [...materials];
    
    if (sortBy === 'alphabet-az') {
      result.sort((a, b) => a.TenVatTu.localeCompare(b.TenVatTu, 'vi', { sensitivity: 'base' }));
    } else if (sortBy === 'stock-asc') {
      result.sort((a, b) => a.SoLuongTon - b.SoLuongTon);
    } else if (sortBy === 'stock-desc') {
      result.sort((a, b) => b.SoLuongTon - a.SoLuongTon);
    }
    
    return result;
  }, [materials, sortBy]);

  // Paginate the materials
  const totalItems = sortedAndFiltered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const paginatedItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedAndFiltered.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedAndFiltered, currentPage, itemsPerPage]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setCode('');
    setName('');
    setDvt('');
    setMinQty(0);
    setCatId(categories[0]?.MaDanhMuc || '');
    setExpiryDate('');
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (mat) => {
    setEditingId(mat.MaVatTu);
    setCode(mat.MaCodeVatTu);
    setName(mat.TenVatTu);
    setDvt(mat.DonViTinh);
    setMinQty(mat.SoLuongToiThieu);
    setCatId(mat.MaDanhMuc);
    setExpiryDate(mat.ExpiryDate ? mat.ExpiryDate.substring(0, 10) : '');
    setSubmitError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !dvt.trim() || !catId) {
      setSubmitError('Vui lòng nhập đầy đủ các trường bắt buộc.');
      return;
    }

    const payload = {
      MaCodeVatTu: code,
      TenVatTu: name,
      DonViTinh: dvt,
      SoLuongToiThieu: parseInt(minQty),
      MaDanhMuc: parseInt(catId),
      ExpiryDate: expiryDate || null
    };

    try {
      if (editingId) {
        await api.put(`/materials/${editingId}`, payload);
      } else {
        await api.post('/materials', payload);
      }
      setIsModalOpen(false);
      fetchMaterials();
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Có lỗi xảy ra khi lưu vật tư.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn ngừng sử dụng hoặc xóa vật tư này?')) return;
    try {
      await api.delete(`/materials/${id}`);
      fetchMaterials();
    } catch (err) {
      alert(err.response?.data?.message || 'Lỗi khi xóa vật tư.');
    }
  };

  return (
    <div className="bg-white border border-sky-100 p-6 rounded-2xl shadow-sm h-full flex flex-col overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản lý danh sách vật tư</h2>
          <p className="text-sm text-slate-500">Theo dõi chi tiết thông tin vật tư, đơn vị tính, hạn mức và số lượng tồn kho thực tế.</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition-all self-start sm:self-auto shadow-md shadow-sky-500/10"
        >
          <Plus size={16} /> Thêm vật tư
        </button>
      </div>

      {/* Lọc, Sắp xếp & Tìm kiếm */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 shrink-0">
        <div className="relative md:col-span-5">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search size={18} />
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên hoặc mã code vật tư..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-slate-50 border border-sky-100 text-slate-800 pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>
        <div className="md:col-span-3">
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="w-full bg-slate-50 border border-sky-100 text-slate-800 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
          >
            <option value="">Tất cả loại danh mục</option>
            {categories.map(cat => (
              <option key={cat.MaDanhMuc} value={cat.MaDanhMuc}>{cat.TenDanhMuc}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-sky-100 text-slate-800 px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
          >
            <option value="alphabet-az">Sắp xếp: Tên A - Z</option>
            <option value="stock-asc">Sắp xếp: Tồn kho Thấp tới Cao</option>
            <option value="stock-desc">Sắp xếp: Tồn kho Cao tới Thấp</option>
          </select>
        </div>
        <div className="md:col-span-1 flex justify-end">
          <button 
            onClick={handleSearch}
            className="w-full p-2.5 bg-slate-50 hover:bg-sky-50 border border-sky-100 text-slate-500 hover:text-sky-600 rounded-xl transition-all flex items-center justify-center"
            title="Tải lại dữ liệu"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="text-red-655 bg-red-50 p-4 rounded-xl border border-red-100 text-sm flex items-center gap-2 shrink-0">
          <AlertCircle size={18} /> {error}
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 flex-1">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-600"></div>
        </div>
      ) : materials.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm flex-1">
          Không tìm thấy sản phẩm vật tư nào.
        </div>
      ) : (
        <>
          <div className="overflow-auto flex-1 border border-sky-50 rounded-xl">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="sticky top-0 z-10 bg-slate-50 border-b border-sky-100 text-slate-500">
                  <th className="py-3 px-4 font-bold bg-slate-50">Mã Code</th>
                  <th className="py-3 px-4 font-bold bg-slate-50">Tên vật tư</th>
                  <th className="py-3 px-4 font-bold bg-slate-50">ĐVT</th>
                  <th className="py-3 px-4 font-bold bg-slate-50">Loại vật tư</th>
                  <th className="py-3 px-4 font-bold bg-slate-50">Mức tối thiểu</th>
                  <th className="py-3 px-4 font-bold bg-slate-50">Tồn kho hiện tại</th>
                  <th className="py-3 px-4 font-bold text-right w-28 bg-slate-50">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((mat) => {
                  const isLowStock = mat.SoLuongTon <= mat.SoLuongToiThieu;
                  const isOutOfStock = mat.SoLuongTon === 0;

                  return (
                    <tr key={mat.MaVatTu} className="border-b border-sky-50 hover:bg-sky-50/10 transition-all">
                      <td className="py-3.5 px-4">
                        <span className="font-bold px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded text-xs">
                          {mat.MaCodeVatTu}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{mat.TenVatTu}</td>
                      <td className="py-3.5 px-4 text-slate-550">{mat.DonViTinh}</td>
                      <td className="py-3.5 px-4 text-slate-550">{mat.TenDanhMuc}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-500">{mat.SoLuongToiThieu}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${
                            isOutOfStock ? 'text-red-500' :
                            isLowStock ? 'text-yellow-600' : 'text-emerald-500'
                          }`}>
                            {mat.SoLuongTon.toLocaleString()}
                          </span>
                          {isOutOfStock ? (
                            <span className="text-[10px] px-1.5 py-0.2 bg-red-50 border border-red-100 text-red-500 rounded-full font-semibold">Hết hàng</span>
                          ) : isLowStock ? (
                            <span className="text-[10px] px-1.5 py-0.2 bg-yellow-50 border border-yellow-100 text-yellow-600 rounded-full font-semibold">Sắp hết</span>
                          ) : (
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 border border-emerald-100 text-emerald-500 rounded-full font-semibold">Đủ hàng</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(mat)}
                            className="p-1.5 hover:bg-sky-50 rounded-lg text-slate-400 hover:text-sky-600 transition-all border border-transparent hover:border-sky-100"
                            title="Sửa"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(mat.MaVatTu)}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all border border-transparent hover:border-red-100"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-sky-100 mt-4 shrink-0 text-slate-600">
            {/* Info & Limit Selector */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span>Hiển thị:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-sky-100 rounded-lg px-2 py-1 text-slate-800 focus:outline-none focus:border-sky-500 transition-all font-semibold"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <span>
                Đang xem từ <strong>{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}</strong> đến <strong>{Math.min(totalItems, currentPage * itemsPerPage)}</strong> trong tổng số <strong>{totalItems}</strong> vật tư
              </span>
            </div>

            {/* Page buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 text-xs">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-lg border border-sky-100 disabled:opacity-30 disabled:pointer-events-none transition-all font-semibold"
                >
                  Trước
                </button>
                
                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (totalPages > 6 && Math.abs(page - currentPage) > 2 && page !== 1 && page !== totalPages) {
                    if (page === 2 || page === totalPages - 1) {
                      return <span key={page} className="px-1 text-slate-400">...</span>;
                    }
                    return null;
                  }
                  
                  return (
                    <button
                      key={page}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-1.5 rounded-lg border transition-all font-semibold ${
                        currentPage === page
                          ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-500/10'
                          : 'bg-white hover:bg-slate-50 text-slate-600 border-sky-100 hover:text-sky-600'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-sky-50 text-slate-500 hover:text-sky-600 rounded-lg border border-sky-100 disabled:opacity-30 disabled:pointer-events-none transition-all font-semibold"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modal Add/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white border border-sky-100 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-sky-100">
              <h3 className="text-base font-bold text-slate-800">
                {editingId ? 'Cập nhật thông tin vật tư' : 'Thêm vật tư mới'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 transition-all"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {submitError && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-650 text-xs rounded-xl flex items-center gap-1.5">
                  <AlertCircle size={14} /> {submitError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">MÃ CODE VẬT TƯ *</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Ví dụ: AMEN-SOAP"
                    disabled={!!editingId}
                    className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">LOẠI VẬT TƯ *</label>
                  <select
                    required
                    value={catId}
                    onChange={(e) => setCatId(e.target.value)}
                    className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                  >
                    {categories.map(cat => (
                      <option key={cat.MaDanhMuc} value={cat.MaDanhMuc}>{cat.TenDanhMuc}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">TÊN VẬT TƯ *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ví dụ: Xà bông cục nhỏ setup phòng"
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">ĐƠN VỊ TÍNH *</label>
                  <input
                    type="text"
                    required
                    value={dvt}
                    onChange={(e) => setDvt(e.target.value)}
                    placeholder="Ví dụ: Cục, Chai, Chiếc"
                    className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">HẠN MỨC TỒN TỐI THIỂU</label>
                  <input
                    type="number"
                    min="0"
                    value={minQty}
                    onChange={(e) => setMinQty(e.target.value)}
                    className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">NGÀY HẾT HẠN <span className="text-slate-400 font-normal">(không bắt buộc)</span></label>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  min={new Date().toISOString().substring(0, 10)}
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-sky-500 focus:bg-white transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1">Dùng để cảnh báo hết hạn trên Dashboard (30 ngày trước).</p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-sky-150 hover:bg-slate-50 text-slate-550 rounded-xl text-sm font-semibold transition-all"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-sky-500/10"
                >
                  {editingId ? 'Cập nhật' : 'Thêm mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
