import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './L2Workplace.css';
import { ticketService, type Ticket as BackendTicket } from '../../services/ticket.service';

interface Ticket {
  id: string;
  dbId: number;
  title: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  deviceSoftware: string;
  priority: 'Low' | 'Medium' | 'High';
  status: 'New' | 'Pending' | 'Resolved' | 'Closed';
  slaDeadline: number;
  assignee: string;
  group: 'IT L1' | 'IT L2';
  createdAt: string;
  description: string;
  isReopened?: boolean;
  escalateReason?: string;
  escalateStepsTried?: string;
  attempts?: number;
  rootCause?: string;
  techNotes?: string;
  managerEscalated?: boolean;
}

const mapBackendTicketToFrontend = (t: BackendTicket): Ticket => {
  let priority: 'Low' | 'Medium' | 'High' = 'Medium';
  if (t.muc_do_uu_tien === 'CAO') priority = 'High';
  else if (t.muc_do_uu_tien === 'THAP') priority = 'Low';

  let status: 'New' | 'Pending' | 'Resolved' | 'Closed' = 'Pending';
  if (t.trang_thai === 'MOI_TAO') status = 'New';
  else if (t.trang_thai === 'DA_GIAI_QUYET') status = 'Resolved';
  else if (t.trang_thai === 'DA_DONG') status = 'Closed';

  const slaXuLy = t.danh_sach_sla?.find(s => s.loai_sla === 'XU_LY');
  const slaDeadline = slaXuLy ? Date.parse(slaXuLy.han_chot) : (Date.parse(t.ngay_tao) + 4 * 3600 * 1000);

  let escalateReason = 'Chuyển xử lý nâng cao.';
  let escalateStepsTried = 'Chưa thực hiện.';
  const escalateLog = t.danh_sach_log?.find(l => l.hanh_dong === 'ESCALATED');
  if (escalateLog?.ghi_chu) {
    const parts = escalateLog.ghi_chu.split(' | ');
    if (parts[0]) escalateReason = parts[0].replace('Lý do: ', '').trim();
    if (parts[1]) escalateStepsTried = parts[1].replace('Đã thử: ', '').trim();
  }

  let rootCause = '';
  let techNotes = '';
  const internalComments = t.danh_sach_bl?.filter(c => c.quyen_xem === 'NOI_BO');
  if (internalComments && internalComments.length > 0) {
    const lastUpdateComment = [...internalComments].reverse().find(c => c.noi_dung.includes('[IT L2 Cập nhật]') || c.noi_dung.includes('[Xác nhận khắc phục]'));
    if (lastUpdateComment) {
      const content = lastUpdateComment.noi_dung;
      const rcMatch = content.match(/Nguyên nhân gốc:\s*(.*)/i) || content.match(/Nguyên nhân gốc:\s*"?(.*?)"?\./i);
      if (rcMatch && rcMatch[1]) rootCause = rcMatch[1].trim();
      const tnMatch = content.match(/Giải pháp:\s*(.*)/i) || content.match(/Ghi chú kỹ thuật:\s*(.*)/i);
      if (tnMatch && tnMatch[1]) techNotes = tnMatch[1].trim();
    }
  }

  const managerEscalated = t.danh_sach_bl?.some(c => c.noi_dung.includes('[Cảnh báo Khẩn]')) || false;

  return {
    id: t.ma_phieu,
    dbId: t.phieu_ho_tro_id,
    title: t.tieu_de,
    requesterName: t.nguoi_tao?.ho_ten || 'CBNV',
    requesterEmail: t.nguoi_tao?.email || 'user@company.com',
    department: 'Bộ phận Kỹ thuật / Thiết kế',
    deviceSoftware: t.mo_ta_chi_tiet,
    priority,
    status,
    slaDeadline,
    assignee: t.nguoi_ho_tro?.ho_ten || 'Chưa phân công L2',
    group: t.nhom_xu_ly?.ten_nhom?.includes('L2') || t.nhom_xu_ly_id === 2 ? 'IT L2' : 'IT L1',
    createdAt: t.ngay_tao ? new Date(t.ngay_tao).toISOString().split('T')[0] : '',
    description: t.mo_ta_chi_tiet,
    isReopened: t.so_lan_mo_lai > 0,
    escalateReason,
    escalateStepsTried,
    attempts: t.so_lan_thu_lai_L2 || 1,
    rootCause,
    techNotes,
    managerEscalated
  };
};

export const L2Workplace: React.FC = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'new_escalated' | 'processing' | 'critical' | 'manager_review'>('new_escalated');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterTime, setFilterTime] = useState<string>('All');

  const [timeTicker, setTimeTicker] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeTicker(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const res = await ticketService.getTickets({ limit: 100 });
      if (res.success && res.data) {
        const l2Tickets = res.data
          .filter(t => t.nhom_xu_ly?.ten_nhom?.toLowerCase().includes('l2') || t.nhom_xu_ly_id === 2)
          .map(mapBackendTicketToFrontend);
        setTickets(l2Tickets);
      }
    } catch (err) {
      console.error('Error fetching L2 tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const getFilteredTickets = () => {
    return tickets.filter(t => {
      if (t.group !== 'IT L2') return false;

      if (activeTab === 'new_escalated') {
        if (t.status !== 'Pending' && t.status !== 'New') return false;
        if (t.assignee !== 'Chưa phân công L2' && t.assignee === '') return false;
      } else if (activeTab === 'processing') {
        if (t.status !== 'Pending') return false;
        if (t.assignee === 'Chưa phân công L2') return false;
      } else if (activeTab === 'critical') {
        if (t.priority !== 'High') return false;
        if (t.status === 'Resolved' || t.status === 'Closed') return false;
      } else if (activeTab === 'manager_review') {
        const att = t.attempts || 1;
        if (att < 3 && !t.managerEscalated) return false;
        if (t.status === 'Resolved' || t.status === 'Closed') return false;
      }

      if (filterPriority !== 'All' && t.priority !== filterPriority) return false;

      if (filterTime !== 'All') {
        const todayStr = new Date().toISOString().split('T')[0];
        if (filterTime === 'Today' && t.createdAt !== todayStr) return false;
      }

      return true;
    });
  };

  const filteredTickets = getFilteredTickets();

  const getTabCounts = (tabName: typeof activeTab) => {
    return tickets.filter(t => {
      if (t.group !== 'IT L2') return false;
      if (tabName === 'new_escalated') {
        return (t.status === 'Pending' || t.status === 'New') && (t.assignee === 'Chưa phân công L2' || t.assignee === '');
      }
      if (tabName === 'processing') {
        return t.status === 'Pending' && t.assignee !== 'Chưa phân công L2' && t.assignee !== '';
      }
      if (tabName === 'critical') {
        return t.priority === 'High' && t.status !== 'Resolved' && t.status !== 'Closed';
      }
      if (tabName === 'manager_review') {
        const att = t.attempts || 1;
        return (att >= 3 || !!t.managerEscalated) && t.status !== 'Resolved' && t.status !== 'Closed';
      }
      return false;
    }).length;
  };

  // Hạn SLA đếm ngược
  const renderSLACountdown = (ticketObj: Ticket) => {
    if (ticketObj.status === 'Resolved' || ticketObj.status === 'Closed') {
      return <span className="sla-countdown-time" style={{ color: '#16A34A' }}>Đạt SLA ✓</span>;
    }
    const diff = ticketObj.slaDeadline - timeTicker;
    if (diff <= 0) {
      return <span className="sla-countdown-time danger" style={{ fontSize: '24px' }}>Quá hạn (Vi phạm)</span>;
    }
    const hours = Math.floor(diff / (3600 * 1000));
    const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
    const secs = Math.floor((diff % (60 * 1000)) / 1000);
    const pad = (num: number) => String(num).padStart(2, '0');
    return (
      <span className="sla-countdown-time" style={{ color: diff < 15 * 60 * 1000 ? '#DC2626' : '#D97706', fontSize: '24px' }}>
        {pad(hours)}g {pad(mins)}p {pad(secs)}s
      </span>
    );
  };

  return (
    <div className="l2-container">
      <div className="l2-content">
        
        <div className="l2-header-card">
          <h1 className="l2-title">Không gian làm việc nâng cao L2 Support</h1>
          <p className="l2-subtitle">
            Tiếp nhận các yêu cầu chuyển cấp từ L1, giải quyết các sự cố nghiêm trọng và đóng góp tài liệu tri thức.
          </p>
        </div>

        {/* Bộ lọc Hàng đợi */}
        <div className="queue-filters-card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div className="filter-group" style={{ flex: 1, minWidth: '200px' }}>
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
            <div className="filter-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="filter-label">Thời gian phát sinh</label>
              <select 
                className="filter-select"
                value={filterTime}
                onChange={(e) => setFilterTime(e.target.value)}
              >
                <option value="All">Tất cả thời gian</option>
                <option value="Today">Hôm nay</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs Hàng đợi L2 */}
        <div className="l2-tabs">
          <button
            type="button"
            className={`l2-tab-btn tab-escalated ${activeTab === 'new_escalated' ? 'active' : ''}`}
            onClick={() => setActiveTab('new_escalated')}
          >
            Phiếu chuyển cấp mới
            <span className="l2-tab-badge">{getTabCounts('new_escalated')}</span>
          </button>

          <button
            type="button"
            className={`l2-tab-btn tab-processing ${activeTab === 'processing' ? 'active' : ''}`}
            onClick={() => setActiveTab('processing')}
          >
            Đang xử lý
            <span className="l2-tab-badge">{getTabCounts('processing')}</span>
          </button>

          <button
            type="button"
            className={`l2-tab-btn tab-critical ${activeTab === 'critical' ? 'active' : ''}`}
            onClick={() => setActiveTab('critical')}
          >
            🚨 Sự cố nghiêm trọng
            <span className="l2-tab-badge" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>{getTabCounts('critical')}</span>
          </button>

          <button
            type="button"
            className={`l2-tab-btn tab-manager ${activeTab === 'manager_review' ? 'active' : ''}`}
            onClick={() => setActiveTab('manager_review')}
          >
            Chờ quản lý xem xét
            <span className="l2-tab-badge" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>{getTabCounts('manager_review')}</span>
          </button>
        </div>

        {/* Bảng Hàng đợi L2 */}
        <div className="queue-table-card">
          {loading ? (
            <div className="empty-state">
              <span className="spinner-inline" style={{ width: '32px', height: '32px', borderWidth: '3px', display: 'inline-block' }}></span>
              <p style={{ marginTop: '12px', color: '#64748B', fontWeight: 500 }}>Đang tải danh sách ticket L2...</p>
            </div>
          ) : filteredTickets.length > 0 ? (
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Mã Ticket</th>
                  <th>Tiêu đề phiếu yêu cầu</th>
                  <th>Người tạo</th>
                  <th>Mức độ ưu tiên</th>
                  <th>Trạng thái</th>
                  <th>Hạn xử lý SLA</th>
                  <th>Số lần thử</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => {
                  const att = t.attempts || 1;
                  return (
                    <tr key={t.id}>
                      <td>
                        <button
                          type="button"
                          className="queue-ticket-id"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                          onClick={() => navigate(`/tickets/detail/${t.dbId}`)}
                        >
                          {t.id}
                        </button>
                      </td>
                      <td>
                        <div 
                          className="queue-ticket-title" 
                          style={{ maxWidth: '300px', cursor: 'pointer' }} 
                          title={t.title}
                          onClick={() => navigate(`/tickets/detail/${t.dbId}`)}
                        >
                          {t.title}
                        </div>
                      </td>
                      <td>{t.requesterName}</td>
                      <td>
                        {t.priority === 'High' && (
                          <span className="badge-priority" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>Cao</span>
                        )}
                        {t.priority === 'Medium' && (
                          <span className="badge-priority" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>Trung bình</span>
                        )}
                        {t.priority === 'Low' && (
                          <span className="badge-priority" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Thấp</span>
                        )}
                      </td>
                      <td>
                        {t.status === 'New' && <span className="badge-status" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>Mới tạo</span>}
                        {t.status === 'Pending' && <span className="badge-status" style={{ backgroundColor: '#FFFBEB', color: '#92400E' }}>Đang giải quyết</span>}
                        {t.status === 'Resolved' && <span className="badge-status" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>Đã giải quyết</span>}
                        {t.status === 'Closed' && <span className="badge-status" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Đã đóng</span>}
                      </td>
                      <td>{renderSLACountdown(t)}</td>
                      <td>
                        <span style={{ 
                          fontWeight: 700, 
                          color: att >= 3 ? '#DC2626' : '#475569', 
                          backgroundColor: att >= 3 ? '#FEF2F2' : '#F1F5F9', 
                          padding: '2px 8px', 
                          borderRadius: '4px' 
                        }}>
                          Lần thử: {att}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <h3 className="empty-state-title">Không tìm thấy kết quả phù hợp</h3>
              <p className="empty-state-desc">
                Không có phiếu hỗ trợ chuyển cấp nào khớp với bộ lọc L2.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
