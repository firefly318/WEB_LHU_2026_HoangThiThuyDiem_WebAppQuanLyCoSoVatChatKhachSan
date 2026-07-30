import React, { useState, useEffect, useMemo } from 'react';
import api from '../api';
import { 
  FileSpreadsheet, Calendar, Search, Download, 
  ArrowDownRight, ArrowUpRight, PackageCheck, AlertCircle, RefreshCw, Layers,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';

export default function ReportManagement() {
  // Tabs: 'summary' | 'inbound' | 'outbound'
  const [activeTab, setActiveTab] = useState('summary');
  
  // Filter states
  const [filterMode, setFilterMode] = useState('thang'); // 'thang' | 'quy' | 'nam' | 'custom'
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(new Date().getMonth() / 3) + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [customFromDate, setCustomFromDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [customToDate, setCustomToDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');

  // Data states
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterMode, selectedMonth, selectedQuarter, selectedYear, customFromDate, customToDate, selectedCat, searchKeyword]);

  // Compute actual date range (FromDate, ToDate)
  const dateRange = useMemo(() => {
    let from = new Date();
    let to = new Date();

    if (filterMode === 'thang') {
      from = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0);
      to = new Date(selectedYear, selectedMonth, 0, 23, 59, 59);
    } else if (filterMode === 'quy') {
      const startMonth = (selectedQuarter - 1) * 3;
      from = new Date(selectedYear, startMonth, 1, 0, 0, 0);
      to = new Date(selectedYear, startMonth + 3, 0, 23, 59, 59);
    } else if (filterMode === 'nam') {
      from = new Date(selectedYear, 0, 1, 0, 0, 0);
      to = new Date(selectedYear, 11, 31, 23, 59, 59);
    } else if (filterMode === 'custom') {
      from = customFromDate ? new Date(customFromDate + 'T00:00:00') : new Date();
      to = customToDate ? new Date(customToDate + 'T23:59:59') : new Date();
    }

    return { from, to };
  }, [filterMode, selectedMonth, selectedQuarter, selectedYear, customFromDate, customToDate]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [activeTab, dateRange, selectedCat]);

  const fetchCategories = async () => {
    try {
      const res = await api.get('/categories');
      setCategories(res.data || []);
    } catch (err) {
      console.error('Lỗi tải danh mục:', err);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const fromStr = dateRange.from.toISOString();
      const toStr = dateRange.to.toISOString();
      let endpoint = '/reports/inventory-summary';
      if (activeTab === 'inbound') endpoint = '/reports/inbound-details';
      if (activeTab === 'outbound') endpoint = '/reports/outbound-details';

      const res = await api.get(endpoint, {
        params: {
          fromDate: fromStr,
          toDate: toStr,
          categoryId: selectedCat || undefined
        }
      });
      setReportData(res.data?.Data || []);
    } catch (err) {
      console.error(err);
      setError('Không thể lấy dữ liệu báo cáo từ máy chủ SQL Server.');
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  // Filter local search keyword
  const filteredData = useMemo(() => {
    if (!searchKeyword.trim()) return reportData;
    const q = searchKeyword.toLowerCase();
    return reportData.filter(r => 
      (r.TenVatTu && r.TenVatTu.toLowerCase().includes(q)) ||
      (r.MaCodeVatTu && r.MaCodeVatTu.toLowerCase().includes(q)) ||
      (r.SoPhieuNhap && r.SoPhieuNhap.toLowerCase().includes(q)) ||
      (r.SoPhieuXuat && r.SoPhieuXuat.toLowerCase().includes(q)) ||
      (r.BoPhanNhan && r.BoPhanNhan.toLowerCase().includes(q)) ||
      (r.NguonCungCap && r.NguonCungCap.toLowerCase().includes(q))
    );
  }, [reportData, searchKeyword]);

  // Paginated Data
  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // KPI Calculations
  const kpis = useMemo(() => {
    if (activeTab === 'summary') {
      const totalImport = filteredData.reduce((sum, r) => sum + (r.TongNhap || 0), 0);
      const totalExport = filteredData.reduce((sum, r) => sum + (r.TongXuat || 0), 0);
      const totalStockVal = filteredData.reduce((sum, r) => sum + (r.GiaTriTonCuoi || 0), 0);
      const totalImportVal = filteredData.reduce((sum, r) => sum + (r.GiaTriNhap || 0), 0);
      return { totalImport, totalExport, totalStockVal, totalImportVal, count: filteredData.length };
    } else if (activeTab === 'inbound') {
      const totalQty = filteredData.reduce((sum, r) => sum + (r.SoLuong || 0), 0);
      const totalAmount = filteredData.reduce((sum, r) => sum + (r.ThanhTien || 0), 0);
      return { totalQty, totalAmount, count: filteredData.length };
    } else {
      const totalQty = filteredData.reduce((sum, r) => sum + (r.SoLuong || 0), 0);
      return { totalQty, count: filteredData.length };
    }
  }, [filteredData, activeTab]);

  // Export STYLED Excel file (with header colors, grid borders, numbers formatted, total summary row)
  const handleExportExcel = () => {
    let titleStr = 'BÁO CÁO NHẬP - XUẤT - TỒN VẬT TƯ KHÁCH SẠN';
    if (activeTab === 'inbound') titleStr = 'BÁO CÁO CHI TIẾT NHẬP KHO VẬT TƯ';
    if (activeTab === 'outbound') titleStr = 'BÁO CÁO CHI TIẾT XUẤT KHO VẬT TƯ';

    let periodStr = '';
    if (filterMode === 'thang') periodStr = `Tháng ${selectedMonth}/${selectedYear}`;
    else if (filterMode === 'quy') periodStr = `Quý ${selectedQuarter}/${selectedYear}`;
    else if (filterMode === 'nam') periodStr = `Năm ${selectedYear}`;
    else periodStr = `Từ ${dateRange.from.toLocaleDateString('vi-VN')} đến ${dateRange.to.toLocaleDateString('vi-VN')}`;

    let tableHtml = '';

    if (activeTab === 'summary') {
      const totalOpening = filteredData.reduce((sum, r) => sum + (r.TonDauKy || 0), 0);
      const totalImportQty = filteredData.reduce((sum, r) => sum + (r.TongNhap || 0), 0);
      const totalImportVal = filteredData.reduce((sum, r) => sum + (r.GiaTriNhap || 0), 0);
      const totalExportQty = filteredData.reduce((sum, r) => sum + (r.TongXuat || 0), 0);
      const totalClosingQty = filteredData.reduce((sum, r) => sum + (r.TonCuoiKy || 0), 0);
      const totalStockVal = filteredData.reduce((sum, r) => sum + (r.GiaTriTonCuoi || 0), 0);

      tableHtml = `
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; font-family: Arial, sans-serif; font-size: 11pt;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center;">
              <th style="border: 1px solid #334155; padding: 8px; width: 50px;">STT</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 120px;">Mã vật tư</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 250px;">Tên vật tư</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 90px;">Đơn vị tính</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 150px;">Loại danh mục</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 110px; background-color: #1e293b;">Tồn đầu kỳ</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 110px; background-color: #065f46;">Tổng nhập</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 150px; background-color: #065f46;">Giá trị nhập (VNĐ)</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 110px; background-color: #9f1239;">Tổng xuất</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 110px; background-color: #075985;">Tồn cuối kỳ</th>
              <th style="border: 1px solid #334155; padding: 8px; width: 160px; background-color: #3730a3;">Giá trị tồn (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredData.map((r, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold; font-family: monospace;">${r.MaCodeVatTu || '—'}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold;">${r.TenVatTu || '—'}</td>
                <td style="border: 1px solid #cbd5e1; text-align: center;">${r.DonViTinh || '—'}</td>
                <td style="border: 1px solid #cbd5e1;">${r.TenDanhMuc || '—'}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; background-color: #f1f5f9;">${(r.TonDauKy || 0).toLocaleString('vi-VN')}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #047857; background-color: #ecfdf5;">+${(r.TongNhap || 0).toLocaleString('vi-VN')}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #047857; background-color: #ecfdf5;">${(r.GiaTriNhap || 0).toLocaleString('vi-VN')}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #be123c; background-color: #fff1f2;">-${(r.TongXuat || 0).toLocaleString('vi-VN')}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #0369a1; background-color: #f0f9ff;">${(r.TonCuoiKy || 0).toLocaleString('vi-VN')}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; background-color: #e0e7ff;">${(r.GiaTriTonCuoi || 0).toLocaleString('vi-VN')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold; font-size: 11pt;">
              <td colspan="5" style="border: 2px solid #475569; text-align: center;">TỔNG CỘNG</td>
              <td style="border: 2px solid #475569; text-align: right;">${totalOpening.toLocaleString('vi-VN')}</td>
              <td style="border: 2px solid #475569; text-align: right; color: #047857;">+${totalImportQty.toLocaleString('vi-VN')}</td>
              <td style="border: 2px solid #475569; text-align: right; color: #047857;">${totalImportVal.toLocaleString('vi-VN')}</td>
              <td style="border: 2px solid #475569; text-align: right; color: #be123c;">-${totalExportQty.toLocaleString('vi-VN')}</td>
              <td style="border: 2px solid #475569; text-align: right; color: #0369a1;">${totalClosingQty.toLocaleString('vi-VN')}</td>
              <td style="border: 2px solid #475569; text-align: right; color: #3730a3;">${totalStockVal.toLocaleString('vi-VN')}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (activeTab === 'inbound') {
      const totalImportQty = filteredData.reduce((sum, r) => sum + (r.SoLuong || 0), 0);
      const totalImportVal = filteredData.reduce((sum, r) => sum + (r.ThanhTien || 0), 0);

      tableHtml = `
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; font-family: Arial, sans-serif; font-size: 11pt;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center;">
              <th style="border: 1px solid #334155; padding: 8px;">STT</th>
              <th style="border: 1px solid #334155; padding: 8px;">Số phiếu nhập</th>
              <th style="border: 1px solid #334155; padding: 8px;">Ngày nhập</th>
              <th style="border: 1px solid #334155; padding: 8px;">Loại nhập</th>
              <th style="border: 1px solid #334155; padding: 8px;">Nguồn cung cấp / Bộ phận</th>
              <th style="border: 1px solid #334155; padding: 8px;">Người lập</th>
              <th style="border: 1px solid #334155; padding: 8px;">Mã vật tư</th>
              <th style="border: 1px solid #334155; padding: 8px;">Tên vật tư</th>
              <th style="border: 1px solid #334155; padding: 8px; background-color: #065f46;">Số lượng nhập</th>
              <th style="border: 1px solid #334155; padding: 8px;">Đơn giá (VNĐ)</th>
              <th style="border: 1px solid #334155; padding: 8px; background-color: #065f46;">Thành tiền (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            ${filteredData.map((r, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #0369a1;">${r.SoPhieuNhap || '—'}</td>
                <td style="border: 1px solid #cbd5e1;">${r.NgayNhap ? new Date(r.NgayNhap).toLocaleString('vi-VN') : '—'}</td>
                <td style="border: 1px solid #cbd5e1;">${r.LoaiNhap || '—'}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold;">${r.NguonCungCap || '—'}</td>
                <td style="border: 1px solid #cbd5e1;">${r.NguoiLap || '—'}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold;">${r.MaCodeVatTu || '—'}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold;">${r.TenVatTu || '—'}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #047857; background-color: #ecfdf5;">+${(r.SoLuong || 0).toLocaleString('vi-VN')}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right;">${(r.DonGia || 0).toLocaleString('vi-VN')}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; background-color: #ecfdf5;">${(r.ThanhTien || 0).toLocaleString('vi-VN')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold; font-size: 11pt;">
              <td colspan="8" style="border: 2px solid #475569; text-align: center;">TỔNG CỘNG</td>
              <td style="border: 2px solid #475569; text-align: right; color: #047857;">+${totalImportQty.toLocaleString('vi-VN')}</td>
              <td style="border: 2px solid #475569; text-align: right;">—</td>
              <td style="border: 2px solid #475569; text-align: right; color: #047857;">${totalImportVal.toLocaleString('vi-VN')}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else {
      const totalExportQty = filteredData.reduce((sum, r) => sum + (r.SoLuong || 0), 0);

      tableHtml = `
        <table border="1" cellspacing="0" cellpadding="6" style="border-collapse:collapse; font-family: Arial, sans-serif; font-size: 11pt;">
          <thead>
            <tr style="background-color: #0f172a; color: #ffffff; font-weight: bold; text-align: center;">
              <th style="border: 1px solid #334155; padding: 8px;">STT</th>
              <th style="border: 1px solid #334155; padding: 8px;">Số phiếu xuất</th>
              <th style="border: 1px solid #334155; padding: 8px;">Ngày xuất</th>
              <th style="border: 1px solid #334155; padding: 8px;">Bộ phận nhận</th>
              <th style="border: 1px solid #334155; padding: 8px;">Lý do xuất</th>
              <th style="border: 1px solid #334155; padding: 8px;">Người lập</th>
              <th style="border: 1px solid #334155; padding: 8px;">Mã vật tư</th>
              <th style="border: 1px solid #334155; padding: 8px;">Tên vật tư</th>
              <th style="border: 1px solid #334155; padding: 8px; background-color: #9f1239;">Số lượng xuất</th>
            </tr>
          </thead>
          <tbody>
            ${filteredData.map((r, idx) => `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
                <td style="border: 1px solid #cbd5e1; text-align: center;">${idx + 1}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold; color: #be123c;">${r.SoPhieuXuat || '—'}</td>
                <td style="border: 1px solid #cbd5e1;">${r.NgayXuat ? new Date(r.NgayXuat).toLocaleString('vi-VN') : '—'}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold;">${r.BoPhanNhan || '—'}</td>
                <td style="border: 1px solid #cbd5e1;">${r.LyDoXuat || '—'}</td>
                <td style="border: 1px solid #cbd5e1;">${r.NguoiLap || '—'}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold;">${r.MaCodeVatTu || '—'}</td>
                <td style="border: 1px solid #cbd5e1; font-weight: bold;">${r.TenVatTu || '—'}</td>
                <td style="border: 1px solid #cbd5e1; text-align: right; font-weight: bold; color: #be123c; background-color: #fff1f2;">-${(r.SoLuong || 0).toLocaleString('vi-VN')}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #e2e8f0; font-weight: bold; font-size: 11pt;">
              <td colspan="8" style="border: 2px solid #475569; text-align: center;">TỔNG CỘNG</td>
              <td style="border: 2px solid #475569; text-align: right; color: #be123c;">-${totalExportQty.toLocaleString('vi-VN')}</td>
            </tr>
          </tfoot>
        </table>
      `;
    }

    const fullTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Báo Cáo</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="font-family: Arial, sans-serif; color: #0f172a; margin-bottom: 4px;">${titleStr.toUpperCase()}</h2>
        <p style="font-family: Arial, sans-serif; color: #475569; margin-top: 0;">
          <strong>Kỳ báo cáo:</strong> ${periodStr} | <strong>Ngày xuất báo cáo:</strong> ${new Date().toLocaleString('vi-VN')}
        </p>
        <br/>
        ${tableHtml}
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + fullTemplate], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BaoCao_${activeTab}_${filterMode}_${new Date().getTime()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 text-slate-800">
      {/* Top Header */}
      <div className="bg-white border border-sky-100 p-6 rounded-2xl shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet className="text-sky-600" size={24} /> Báo cáo Nhập - Xuất - Tồn Kho
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Tổng hợp giao dịch vật tư theo Tháng, Quý, Năm và xuất dữ liệu báo cáo chuẩn Excel.
          </p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={loading || filteredData.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:pointer-events-none"
        >
          <Download size={18} /> Xuất Báo Cáo Excel (.xls)
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-sky-100 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-sky-100 pb-4">
          {/* Report Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'summary'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-sky-600'
              }`}
            >
              📈 Tổng hợp Nhập-Xuất-Tồn
            </button>
            <button
              onClick={() => setActiveTab('inbound')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'inbound'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-sky-600'
              }`}
            >
              📦 Chi tiết Nhập kho (GRN)
            </button>
            <button
              onClick={() => setActiveTab('outbound')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'outbound'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-sky-600'
              }`}
            >
              📤 Chi tiết Xuất kho (GDN)
            </button>
          </div>

          {/* Time Filter Mode Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
              <Calendar size={14} /> Kỳ báo cáo:
            </span>
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium">
              <button
                onClick={() => setFilterMode('thang')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterMode === 'thang' ? 'bg-white text-sky-700 font-bold shadow-sm' : 'text-slate-600'
                }`}
              >
                Theo Tháng
              </button>
              <button
                onClick={() => setFilterMode('quy')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterMode === 'quy' ? 'bg-white text-sky-700 font-bold shadow-sm' : 'text-slate-600'
                }`}
              >
                Theo Quý
              </button>
              <button
                onClick={() => setFilterMode('nam')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterMode === 'nam' ? 'bg-white text-sky-700 font-bold shadow-sm' : 'text-slate-600'
                }`}
              >
                Theo Năm
              </button>
              <button
                onClick={() => setFilterMode('custom')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  filterMode === 'custom' ? 'bg-white text-sky-700 font-bold shadow-sm' : 'text-slate-600'
                }`}
              >
                Tùy chỉnh
              </button>
            </div>
          </div>
        </div>

        {/* Filter Selection Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {filterMode === 'thang' && (
            <>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">CHỌN THÁNG</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
                >
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">CHỌN NĂM</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {filterMode === 'quy' && (
            <>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">CHỌN QUÝ</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
                >
                  <option value={1}>Quý 1 (Tháng 1 - 3)</option>
                  <option value={2}>Quý 2 (Tháng 4 - 6)</option>
                  <option value={3}>Quý 3 (Tháng 7 - 9)</option>
                  <option value={4}>Quý 4 (Tháng 10 - 12)</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">CHỌN NĂM</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
                >
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>Năm {y}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {filterMode === 'nam' && (
            <div className="md:col-span-6">
              <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">CHỌN NĂM BÁO CÁO</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full bg-slate-50 border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-800 font-semibold focus:outline-none focus:border-sky-500"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>Năm {y}</option>
                ))}
              </select>
            </div>
          )}

          {filterMode === 'custom' && (
            <>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">TỪ NGÀY</label>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">ĐẾN NGÀY</label>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-full bg-slate-50 border border-sky-150 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>
            </>
          )}

          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">LOẠI DANH MỤC</label>
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="w-full bg-slate-50 border border-sky-150 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
            >
              <option value="">-- Tất cả loại --</option>
              {categories.map(c => (
                <option key={c.MaDanhMuc} value={c.MaDanhMuc}>{c.TenDanhMuc}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-400 mb-1 uppercase">TÌM KIẾM THEO TÊN/MÃ</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Gõ mã, tên, số phiếu..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full bg-slate-50 border border-sky-150 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeTab === 'summary' && (
          <>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center text-slate-400 text-xs font-semibold">
                <span>TỔNG NHẬP TRONG KỲ</span>
                <ArrowDownRight className="text-emerald-500" size={18} />
              </div>
              <p className="text-2xl font-extrabold text-slate-800 mt-2">{kpis.totalImport.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Giá trị: {kpis.totalImportVal.toLocaleString()} VNĐ</p>
            </div>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center text-slate-400 text-xs font-semibold">
                <span>TỔNG XUẤT TRONG KỲ</span>
                <ArrowUpRight className="text-rose-500" size={18} />
              </div>
              <p className="text-2xl font-extrabold text-slate-800 mt-2">{kpis.totalExport.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Xuất cấp phát sinh hoạt</p>
            </div>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center text-slate-400 text-xs font-semibold">
                <span>TỔNG GIÁ TRỊ TỒN KHO</span>
                <PackageCheck className="text-sky-600" size={18} />
              </div>
              <p className="text-2xl font-extrabold text-sky-600 mt-2">{kpis.totalStockVal.toLocaleString()} VNĐ</p>
              <p className="text-xs text-slate-400 mt-1">Tính theo đơn giá gần nhất</p>
            </div>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm">
              <div className="flex justify-between items-center text-slate-400 text-xs font-semibold">
                <span>SỐ MẶT HÀNG BÁO CÁO</span>
                <Layers className="text-indigo-500" size={18} />
              </div>
              <p className="text-2xl font-extrabold text-slate-800 mt-2">{kpis.count} vật tư</p>
              <p className="text-xs text-slate-400 mt-1">Thuộc {categories.length} loại danh mục</p>
            </div>
          </>
        )}

        {activeTab === 'inbound' && (
          <>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm">
              <div className="text-slate-400 text-xs font-semibold">TỔNG SỐ PHÁT SINH NHẬP</div>
              <p className="text-2xl font-extrabold text-slate-800 mt-2">{kpis.count} lượt dòng</p>
            </div>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm">
              <div className="text-slate-400 text-xs font-semibold">TỔNG SỐ LƯỢNG NHẬP</div>
              <p className="text-2xl font-extrabold text-emerald-600 mt-2">{kpis.totalQty.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm md:col-span-2">
              <div className="text-slate-400 text-xs font-semibold">TỔNG GIÁ TRỊ PHIẾU NHẬP</div>
              <p className="text-2xl font-extrabold text-sky-600 mt-2">{kpis.totalAmount.toLocaleString()} VNĐ</p>
            </div>
          </>
        )}

        {activeTab === 'outbound' && (
          <>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm">
              <div className="text-slate-400 text-xs font-semibold">TỔNG SỐ PHÁT SINH XUẤT</div>
              <p className="text-2xl font-extrabold text-slate-800 mt-2">{kpis.count} lượt dòng</p>
            </div>
            <div className="bg-white border border-sky-100 p-4 rounded-2xl shadow-sm md:col-span-3">
              <div className="text-slate-400 text-xs font-semibold">TỔNG SỐ LƯỢNG VẬT TƯ XUẤT KHO</div>
              <p className="text-2xl font-extrabold text-rose-600 mt-2">{kpis.totalQty.toLocaleString()}</p>
            </div>
          </>
        )}
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-sky-100 rounded-2xl shadow-sm overflow-hidden p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="animate-spin text-sky-600" size={28} />
            <span className="ml-2 text-sm text-slate-500 font-medium">Đang truy vấn dữ liệu từ SQL Server...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 flex items-center gap-2">
            <AlertCircle size={18} /> {error}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            Không phát sinh dữ liệu trong kỳ báo cáo đã chọn.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[580px] overflow-y-auto border border-sky-100 rounded-xl">
              {activeTab === 'summary' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-20 bg-sky-100/90 backdrop-blur-md text-slate-800 font-bold shadow-sm">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">STT</th>
                      <th className="py-3 px-3">Mã vật tư</th>
                      <th className="py-3 px-3 min-w-[200px]">Tên vật tư</th>
                      <th className="py-3 px-3">Đơn vị tính</th>
                      <th className="py-3 px-3">Loại danh mục</th>
                      <th className="py-3 px-3 text-right">Tồn đầu kỳ</th>
                      <th className="py-3 px-3 text-right text-emerald-700">Tổng nhập</th>
                      <th className="py-3 px-3 text-right text-emerald-700">Giá trị nhập</th>
                      <th className="py-3 px-3 text-right text-rose-700">Tổng xuất</th>
                      <th className="py-3 px-3 text-right font-extrabold text-sky-800">Tồn cuối kỳ</th>
                      <th className="py-3 px-3 text-right">Giá trị tồn (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-50 bg-white">
                    {paginatedData.map((r, idx) => (
                      <tr key={r.MaterialId || idx} className="hover:bg-sky-50/40 transition-all h-12">
                        <td className="px-3 text-center text-slate-400 font-medium align-middle">{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td className="px-3 font-semibold text-slate-700 font-mono align-middle">{r.MaCodeVatTu || '—'}</td>
                        <td className="px-3 font-bold text-slate-800 align-middle">{r.TenVatTu || '—'}</td>
                        <td className="px-3 text-slate-500 align-middle">{r.DonViTinh || '—'}</td>
                        <td className="px-3 text-slate-500 align-middle">{r.TenDanhMuc || '—'}</td>
                        <td className="px-3 text-right font-medium text-slate-600 align-middle">{(r.TonDauKy || 0).toLocaleString()}</td>
                        <td className="px-3 text-right font-semibold text-emerald-600 align-middle">+{(r.TongNhap || 0).toLocaleString()}</td>
                        <td className="px-3 text-right font-medium text-emerald-600 align-middle">{(r.GiaTriNhap || 0).toLocaleString()} VNĐ</td>
                        <td className="px-3 text-right font-semibold text-rose-600 align-middle">-{(r.TongXuat || 0).toLocaleString()}</td>
                        <td className="px-3 text-right font-extrabold text-sky-700 text-sm align-middle">{(r.TonCuoiKy || 0).toLocaleString()}</td>
                        <td className="px-3 text-right font-bold text-slate-800 align-middle">{(r.GiaTriTonCuoi || 0).toLocaleString()} VNĐ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'inbound' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-20 bg-sky-100/90 backdrop-blur-md text-slate-800 font-bold shadow-sm">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">STT</th>
                      <th className="py-3 px-3">Số phiếu</th>
                      <th className="py-3 px-3">Ngày nhập</th>
                      <th className="py-3 px-3">Loại nhập</th>
                      <th className="py-3 px-3">Nguồn cung cấp / Bộ phận</th>
                      <th className="py-3 px-3">Người lập</th>
                      <th className="py-3 px-3">Mã vật tư</th>
                      <th className="py-3 px-3 min-w-[180px]">Tên vật tư</th>
                      <th className="py-3 px-3 text-right text-emerald-700">Số lượng</th>
                      <th className="py-3 px-3 text-right">Đơn giá</th>
                      <th className="py-3 px-3 text-right font-bold">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-50 bg-white">
                    {paginatedData.map((r, idx) => (
                      <tr key={idx} className="hover:bg-sky-50/40 transition-all h-12">
                        <td className="px-3 text-center text-slate-400 font-medium align-middle">{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td className="px-3 font-semibold text-sky-700 font-mono align-middle">{r.SoPhieuNhap || '—'}</td>
                        <td className="px-3 text-slate-500 align-middle">{r.NgayNhap ? new Date(r.NgayNhap).toLocaleString('vi-VN') : '—'}</td>
                        <td className="px-3 text-slate-600 font-medium align-middle">{r.LoaiNhap || '—'}</td>
                        <td className="px-3 text-slate-800 font-medium align-middle">{r.NguonCungCap || '—'}</td>
                        <td className="px-3 text-slate-500 align-middle">{r.NguoiLap || '—'}</td>
                        <td className="px-3 font-mono text-slate-600 align-middle">{r.MaCodeVatTu || '—'}</td>
                        <td className="px-3 font-bold text-slate-800 align-middle">{r.TenVatTu || '—'}</td>
                        <td className="px-3 text-right font-extrabold text-emerald-600 align-middle">+{(r.SoLuong || 0).toLocaleString()}</td>
                        <td className="px-3 text-right font-medium text-slate-700 align-middle">{(r.DonGia || 0).toLocaleString()} VNĐ</td>
                        <td className="px-3 text-right font-bold text-slate-800 align-middle">{(r.ThanhTien || 0).toLocaleString()} VNĐ</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {activeTab === 'outbound' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-20 bg-sky-100/90 backdrop-blur-md text-slate-800 font-bold shadow-sm">
                    <tr>
                      <th className="py-3 px-3 text-center w-10">STT</th>
                      <th className="py-3 px-3">Số phiếu xuất</th>
                      <th className="py-3 px-3">Ngày xuất</th>
                      <th className="py-3 px-3">Bộ phận nhận</th>
                      <th className="py-3 px-3">Lý do xuất</th>
                      <th className="py-3 px-3">Người lập</th>
                      <th className="py-3 px-3">Mã vật tư</th>
                      <th className="py-3 px-3 min-w-[180px]">Tên vật tư</th>
                      <th className="py-3 px-3 text-right text-rose-700">Số lượng xuất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-sky-50 bg-white">
                    {paginatedData.map((r, idx) => (
                      <tr key={idx} className="hover:bg-sky-50/40 transition-all h-12">
                        <td className="px-3 text-center text-slate-400 font-medium align-middle">{(currentPage - 1) * pageSize + idx + 1}</td>
                        <td className="px-3 font-semibold text-rose-700 font-mono align-middle">{r.SoPhieuXuat || '—'}</td>
                        <td className="px-3 text-slate-500 align-middle">{r.NgayXuat ? new Date(r.NgayXuat).toLocaleString('vi-VN') : '—'}</td>
                        <td className="px-3 font-bold text-slate-800 align-middle">{r.BoPhanNhan || '—'}</td>
                        <td className="px-3 text-slate-600 align-middle">{r.LyDoXuat || '—'}</td>
                        <td className="px-3 text-slate-500 align-middle">{r.NguoiLap || '—'}</td>
                        <td className="px-3 font-mono text-slate-600 align-middle">{r.MaCodeVatTu || '—'}</td>
                        <td className="px-3 font-bold text-slate-800 align-middle">{r.TenVatTu || '—'}</td>
                        <td className="px-3 text-right font-extrabold text-rose-600 align-middle">-{(r.SoLuong || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-sky-100 text-xs">
              <div className="flex items-center gap-3 text-slate-500 font-medium">
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-slate-50 border border-sky-150 rounded-lg px-2 py-1 text-xs text-slate-800 focus:outline-none"
                >
                  <option value={5}>5 dòng/trang</option>
                  <option value={10}>10 dòng/trang</option>
                  <option value={25}>25 dòng/trang</option>
                  <option value={50}>50 dòng/trang</option>
                </select>
                <span>
                  | Từ <span className="font-bold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> đến{' '}
                  <span className="font-bold text-slate-800">{Math.min(currentPage * pageSize, filteredData.length)}</span> trên tổng{' '}
                  <span className="font-bold text-slate-800">{filteredData.length}</span> kết quả
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-sky-150 bg-white hover:bg-sky-50 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  title="Trang đầu"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-sky-150 bg-white hover:bg-sky-50 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  title="Trang trước"
                >
                  <ChevronLeft size={16} />
                </button>

                <span className="px-3 py-1 bg-sky-50 text-sky-700 font-bold rounded-lg border border-sky-150">
                  Trang {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-sky-150 bg-white hover:bg-sky-50 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  title="Trang sau"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-sky-150 bg-white hover:bg-sky-50 text-slate-600 disabled:opacity-30 disabled:pointer-events-none transition-all"
                  title="Trang cuối"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
