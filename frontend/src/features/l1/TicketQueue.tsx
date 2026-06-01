import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './TicketQueue.css';
import { ticketService } from '../../services/ticket.service';
import { useAuth } from '../../context/AuthContext';

interface Ticket {
  id: string;
  maPhieu: string;
  title: string;
  requesterName: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'New' | 'Pending' | 'Resolved' | 'Closed';
  trang_thai: 'MOI_TAO' | 'DANG_GIAI_QUYET' | 'DA_GIAI_QUYET' | 'DA_DONG';
  slaPhanHoi?: any;
  slaXuLy?: any;
  assignee: string;
  group: 'IT L1' | 'IT L2';
  subgroup: 'Phần cứng' | 'Phần mềm';
  createdAt: string; // 'YYYY-MM-DD'
  isReopened?: boolean;
  sla_theo_doi?: any[];
  danh_sach_sla?: any[];
}

const getTicketSubgroup = (t: any): 'Phần cứng' | 'Phần mềm' => {
  const content = `${t.tieu_de} ${t.mo_ta_chi_tiet || ''}`.toLowerCase();
  const hardwareKeywords = [
    'phần cứng', 'thiết bị', 'màn hình', 'chuột', 'bàn phím', 'máy in',
    'laptop', 'pc', 'dell', 'hp', 'hardware', 'cơ', 'cáp', 'nút', 'nguồn'
  ];
  if (hardwareKeywords.some(keyword => content.includes(keyword))) {
    return 'Phần cứng';
  }
  return 'Phần mềm';
};

const mapBackendTicket = (t: any): Ticket => {
  let priorityMapped: 'Low' | 'Medium' | 'High' = 'Medium';
  if (t.muc_do_uu_tien === 'CAO') priorityMapped = 'High';
  else if (t.muc_do_uu_tien === 'THAP') priorityMapped = 'Low';

  let statusMapped: 'New' | 'Pending' | 'Resolved' | 'Closed' = 'New';
  if (t.trang_thai === 'DANG_GIAI_QUYET') statusMapped = 'Pending';
  else if (t.trang_thai === 'DA_GIAI_QUYET') statusMapped = 'Resolved';
  else if (t.trang_thai === 'DA_DONG') statusMapped = 'Closed';

  const slaPhanHoi = t.danh_sach_sla?.find((s: any) => s.loai_sla === 'PHAN_HOI');
  const slaXuLy = t.danh_sach_sla?.find((s: any) => s.loai_sla === 'XU_LY');

  return {
    id: String(t.phieu_ho_tro_id),
    maPhieu: t.ma_phieu,
    title: t.tieu_de,
    requesterName: t.nguoi_tao?.ho_ten || '',
    priority: priorityMapped,
    status: statusMapped,
    trang_thai: t.trang_thai,
    slaPhanHoi,
    slaXuLy,
    assignee: t.nguoi_ho_tro?.ho_ten || 'Chưa phân công',
    group: t.nhom_xu_ly?.ten_nhom?.includes('L2') ? 'IT L2' : 'IT L1',
    subgroup: getTicketSubgroup(t),
    createdAt: new Date(t.ngay_tao).toISOString().split('T')[0],
    isReopened: t.so_lan_mo_lai > 0,
    sla_theo_doi: t.sla_theo_doi || t.danh_sach_sla,
    danh_sach_sla: t.danh_sach_sla
  };
};

export const TicketQueue: React.FC = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const isManager = session?.ma_vai_tro === 'QUAN_LY' || session?.role === 'Quản lý IT' || session?.ma_vai_tro === 'ADMIN' || session?.role === 'ADMIN';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // State Tabs và Bộ lọc
  const [activeTab, setActiveTab] = useState<'MOI_TAO' | 'DANG_GIAI_QUYET' | 'DA_GIAI_QUYET' | 'DA_DONG'>('MOI_TAO');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterGroup, setFilterGroup] = useState<string>('All');
  const [filterTime, setFilterTime] = useState<string>('All');
  const [filterSlaStatus, setFilterSlaStatus] = useState<string>('All');

  // Bộ lọc nâng cao riêng cho Quản lý IT
  const [filterSubgroup, setFilterSubgroup] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  // Cập nhật đếm ngược SLA mỗi giây để bảng hoạt động real-time
  const [timeTicker, setTimeTicker] = useState(Date.now());

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const response = await ticketService.getTickets({ limit: 100 });
      if (response.success && Array.isArray(response.data)) {
        setTickets(response.data.map(mapBackendTicket));
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper to render SLA columns dynamically
  const renderSlaColumn = (ticket: any, loaiSla: 'PHAN_HOI' | 'XU_LY') => {
    const slaList = ticket.sla_theo_doi || ticket.danh_sach_sla || [];
    const sla = slaList.find((s: any) => s.loai_sla === loaiSla);
    
    if (!sla) {
      return <span className="queue-sla-timer" style={{ color: '#64748B' }}>N/A</span>;
    }

    if (sla.thoi_diem_dat) {
      return <span className="queue-sla-timer" style={{ color: '#16A34A' }}>Đạt</span>;
    }

    const deadline = Date.parse(sla.han_chot);
    const diff = deadline - timeTicker;

    if (diff <= 0 || sla.da_vi_pham) {
      return <span className="queue-sla-timer danger">Vi phạm</span>;
    }

    const hours = Math.floor(diff / (3600 * 1000));
    const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    const pad = (num: number) => String(num).padStart(2, '0');

    return (
      <span className="queue-sla-timer" style={{ color: diff < 2 * 3600 * 1000 ? '#D97706' : '#0F172A' }}>
        {pad(hours)}h {pad(mins)}m
      </span>
    );
  };

  // Bộ lọc dữ liệu logic
  const getFilteredTickets = () => {
    return tickets.filter(t => {
      // 1. Phân loại theo Tabs trạng thái (bỏ qua nếu là Quản lý IT)
      if (!isManager) {
        if (t.trang_thai !== activeTab) return false;
      } else {
        if (filterStatus !== 'All' && t.trang_thai !== filterStatus) return false;
      }

      // 2. Bộ lọc độ ưu tiên
      if (filterPriority !== 'All' && t.priority !== filterPriority) return false;

      // 3. Bộ lọc nhóm xử lý (Tuyến L1/L2)
      if (filterGroup !== 'All' && t.group !== filterGroup) return false;

      // 3b. Bộ lọc nhóm hỗ trợ Phần cứng/Phần mềm (chỉ cho Quản lý IT)
      if (isManager && filterSubgroup !== 'All' && t.subgroup !== filterSubgroup) return false;

      // 4. Bộ lọc thời gian
      if (filterTime !== 'All') {
        const ticketTime = new Date(t.createdAt).getTime();
        const diffDays = (timeTicker - ticketTime) / (24 * 3600 * 1000);
        
        if (filterTime === 'Today') {
          const todayStr = new Date(timeTicker).toISOString().split('T')[0];
          if (t.createdAt !== todayStr) return false;
        } else if (filterTime === 'Week') {
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (filterTime === 'Month') {
          if (diffDays > 30 || diffDays < 0) return false;
        }
      }

      // 5. Bộ lọc trạng thái SLA
      if (filterSlaStatus !== 'All') {
        const slaList = t.sla_theo_doi || t.danh_sach_sla || [];
        const hasViolation = slaList.some((s: any) => {
          const isBreachedByField = s.da_vi_pham === true;
          const isPastDeadline = !s.thoi_diem_dat && Date.parse(s.han_chot) <= timeTicker;
          return isBreachedByField || isPastDeadline;
        });

        if (filterSlaStatus === 'Breached' && !hasViolation) return false;
        if (filterSlaStatus === 'OnTime' && hasViolation) return false;
      }

      return true;
    });
  };

  const filteredTickets = getFilteredTickets();

  // Đếm số lượng ticket tương ứng với mỗi tab (chỉ cho L1)
  const getTabCounts = (tabName: typeof activeTab) => {
    return tickets.filter(t => t.trang_thai === tabName).length;
  };

  return (
    <div className="ticket-queue-container">
      <div className="ticket-queue-content">
        
        {/* 1. Tiêu đề hàng đợi */}
        <div className="queue-header-card">
          <h1 className="queue-title">
            {isManager ? 'Bảng danh sách tổng hợp phiếu hỗ trợ (Master Ticket Queue)' : 'Hàng đợi Ticket của Đội kỹ thuật L1'}
          </h1>
          <p className="queue-subtitle">
            {isManager 
              ? 'Tổng hợp toàn bộ các phiếu hỗ trợ trong hệ thống, giám sát hiệu suất vận hành L1/L2 và điều phối xử lý.' 
              : 'Tiếp nhận, phản hồi và giải quyết nhanh các sự cố kỹ thuật nội bộ của CBNV công ty.'}
          </p>
        </div>

        {/* 2. Khối bộ lọc phía trên */}
        <div className="queue-filters-card">
          <div className="filters-row">
            <div className="filter-group">
              <label className="filter-label">Mức độ ưu tiên</label>
              <select 
                className="filter-select"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
              >
                <option value="All">Tất cả độ ưu tiên</option>
                <option value="High">Cao</option>
                <option value="Medium">Trung bình</option>
                <option value="Low">Thấp</option>
              </select>
            </div>

            <div className="filter-group">
              <label className="filter-label">{isManager ? 'Tuyến xử lý (L1/L2)' : 'Nhóm xử lý'}</label>
              <select 
                className="filter-select"
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
              >
                <option value="All">Tất cả các tuyến</option>
                <option value="IT L1">Tuyến 1 (L1)</option>
                <option value="IT L2">Tuyến 2 (L2)</option>
              </select>
            </div>

            {isManager && (
              <div className="filter-group">
                <label className="filter-label">Nhóm hỗ trợ</label>
                <select 
                  className="filter-select"
                  value={filterSubgroup}
                  onChange={(e) => setFilterSubgroup(e.target.value)}
                >
                  <option value="All">Tất cả nhóm hỗ trợ</option>
                  <option value="Phần cứng">Hỗ trợ Phần cứng</option>
                  <option value="Phần mềm">Hỗ trợ Phần mềm</option>
                </select>
              </div>
            )}

            <div className="filter-group">
              <label className="filter-label">Trạng thái SLA</label>
              <select 
                className="filter-select"
                value={filterSlaStatus}
                onChange={(e) => setFilterSlaStatus(e.target.value)}
              >
                <option value="All">Tất cả hạn SLA</option>
                <option value="OnTime">Trong hạn (Đạt)</option>
                <option value="Breached">Vi phạm SLA</option>
              </select>
            </div>

            {isManager && (
              <div className="filter-group">
                <label className="filter-label">Trạng thái phiếu</label>
                <select 
                  className="filter-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="All">Tất cả trạng thái</option>
                  <option value="MOI_TAO">Mới tiếp nhận</option>
                  <option value="DANG_GIAI_QUYET">Đang xử lý</option>
                  <option value="DA_GIAI_QUYET">Đã giải quyết</option>
                  <option value="DA_DONG">Đã đóng</option>
                </select>
              </div>
            )}

            <div className="filter-group">
              <label className="filter-label">Thời gian phát sinh</label>
              <select 
                className="filter-select"
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
              >
                <option value="All">Tất cả thời gian</option>
                <option value="Today">Hôm nay</option>
                <option value="Week">Trong 7 ngày qua</option>
                <option value="Month">Trong 1 tháng</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3. Thanh điều hướng Tabs (Ẩn đi nếu là Quản lý IT) */}
        {!isManager && (
          <div className="queue-tabs-container">
            <button
              type="button"
              className={`queue-tab-btn tab-pending ${activeTab === 'MOI_TAO' ? 'active' : ''}`}
              onClick={() => setActiveTab('MOI_TAO')}
            >
              Mới tiếp nhận
              <span className="tab-badge">{getTabCounts('MOI_TAO')}</span>
            </button>

            <button
              type="button"
              className={`queue-tab-btn tab-pending ${activeTab === 'DANG_GIAI_QUYET' ? 'active' : ''}`}
              onClick={() => setActiveTab('DANG_GIAI_QUYET')}
            >
              Đang xử lý
              <span className="tab-badge">{getTabCounts('DANG_GIAI_QUYET')}</span>
            </button>

            <button
              type="button"
              className={`queue-tab-btn tab-pending ${activeTab === 'DA_GIAI_QUYET' ? 'active' : ''}`}
              onClick={() => setActiveTab('DA_GIAI_QUYET')}
            >
              Đã giải quyết
              <span className="tab-badge">{getTabCounts('DA_GIAI_QUYET')}</span>
            </button>

            <button
              type="button"
              className={`queue-tab-btn tab-pending ${activeTab === 'DA_DONG' ? 'active' : ''}`}
              onClick={() => setActiveTab('DA_DONG')}
            >
              Đã đóng
              <span className="tab-badge">{getTabCounts('DA_DONG')}</span>
            </button>
          </div>
        )}

        {/* 4. Thẻ chứa Bảng Hàng đợi */}
        <div className="queue-table-card">
          {isLoading ? (
            <div className="empty-state">
              <span className="spinner-inline" style={{ width: '32px', height: '32px', borderWidth: '3px', display: 'inline-block' }}></span>
              <p style={{ marginTop: '12px', color: '#64748B', fontWeight: 500 }}>Đang tải danh sách ticket...</p>
            </div>
          ) : filteredTickets.length > 0 ? (
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Mã Ticket</th>
                  <th>Tiêu đề phiếu yêu cầu</th>
                  <th>Người gửi</th>
                  <th>Mức độ ưu tiên</th>
                  <th>Trạng thái</th>
                  {isManager && <th>Tuyến xử lý</th>}
                  <th>SLA Phản hồi</th>
                  <th>SLA Xử lý</th>
                  <th>Người phụ trách</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <a 
                        href={`/dashboard/tickets/${ticket.id}`}
                        className="queue-ticket-id"
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/dashboard/tickets/${ticket.id}`);
                        }}
                      >
                        {ticket.maPhieu}
                      </a>
                    </td>
                    <td>
                      <div 
                        className="queue-ticket-title" 
                        title={ticket.title} 
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/dashboard/tickets/${ticket.id}`)}
                      >
                        {ticket.title}
                      </div>
                    </td>
                    <td>{ticket.requesterName}</td>
                    <td>
                      {ticket.priority === 'High' && (
                        <span className="badge-priority" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>Cao</span>
                      )}
                      {ticket.priority === 'Medium' && (
                        <span className="badge-priority" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>Trung bình</span>
                      )}
                      {ticket.priority === 'Low' && (
                        <span className="badge-priority" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Thấp</span>
                      )}
                    </td>
                    <td>
                      {ticket.trang_thai === 'MOI_TAO' && (
                        <span className="badge-status" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>Mới tiếp nhận</span>
                      )}
                      {ticket.trang_thai === 'DANG_GIAI_QUYET' && (
                        <span className="badge-status" style={{ backgroundColor: '#FFFBEB', color: '#92400E' }}>Đang xử lý</span>
                      )}
                      {ticket.trang_thai === 'DA_GIAI_QUYET' && (
                        <span className="badge-status" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>Đã giải quyết</span>
                      )}
                      {ticket.trang_thai === 'DA_DONG' && (
                        <span className="badge-status" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Đã đóng</span>
                      )}
                    </td>
                    {isManager && (
                      <td>
                        {ticket.group === 'IT L2' ? (
                          <span className="badge-status" style={{ backgroundColor: '#F3E8FF', color: '#7E22CE' }}>Tuyến 2 (L2)</span>
                        ) : (
                          <span className="badge-status" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>Tuyến 1 (L1)</span>
                        )}
                      </td>
                    )}
                    <td>{renderSlaColumn(ticket, 'PHAN_HOI')}</td>
                    <td>{renderSlaColumn(ticket, 'XU_LY')}</td>
                    <td>{ticket.assignee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3 className="empty-state-title">Không tìm thấy kết quả phù hợp</h3>
              <p className="empty-state-desc">
                Không có phiếu hỗ trợ nào phù hợp với bộ lọc và tab hiện tại của bạn.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

