/**
 * MyTickets.tsx  –  UC-03: Theo dõi trạng thái Ticket
 * Màn hình danh sách phiếu hỗ trợ dành cho "Người yêu cầu".
 * Hiển thị thẻ trạng thái tổng hợp + bảng phiếu cá nhân.
 *
 * ⚠️  STUB – Đang chờ tích hợp dữ liệu API thực tế.
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MyTickets.css';
import { ticketService } from '../../services/ticket.service';

interface Ticket {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'new' | 'processing' | 'resolved' | 'closed' | 'reopened';
  created: string;
  sla: string;
}

const mapBackendTicket = (t: any): Ticket => {
  let priorityMapped: 'high' | 'medium' | 'low' = 'medium';
  if (t.muc_do_uu_tien === 'CAO') priorityMapped = 'high';
  else if (t.muc_do_uu_tien === 'THAP') priorityMapped = 'low';

  let statusMapped: 'new' | 'processing' | 'resolved' | 'closed' | 'reopened' = 'new';
  if (t.trang_thai === 'DANG_GIAI_QUYET') statusMapped = 'processing';
  else if (t.trang_thai === 'DA_GIAI_QUYET') statusMapped = 'resolved';
  else if (t.trang_thai === 'DA_DONG') statusMapped = 'closed';

  const creationTime = new Date(t.ngay_tao).getTime();
  let slaDurationHours = 24;
  if (t.muc_do_uu_tien === 'CAO') slaDurationHours = 4;
  else if (t.muc_do_uu_tien === 'THAP') slaDurationHours = 40;

  const slaDeadline = creationTime + slaDurationHours * 60 * 60 * 1000;

  return {
    id: String(t.phieu_ho_tro_id),
    title: t.tieu_de,
    priority: priorityMapped,
    status: statusMapped,
    created: new Date(t.ngay_tao).toLocaleString('vi-VN'),
    sla: new Date(slaDeadline).toLocaleString('vi-VN'),
  };
};

const STATUS_META: Record<Ticket['status'], { label: string; cls: string; icon: string }> = {
  new:        { label: 'Mới tạo',        cls: 'new',        icon: '🆕' },
  processing: { label: 'Đang xử lý',     cls: 'processing', icon: '⚙️' },
  resolved:   { label: 'Đã giải quyết', cls: 'resolved',   icon: '✅' },
  closed:     { label: 'Đã đóng',        cls: 'closed',     icon: '🔒' },
  reopened:   { label: 'Mở lại',         cls: 'reopened',   icon: '🔄' },
};

const PRIORITY_META: Record<Ticket['priority'], { label: string; cls: string }> = {
  high:   { label: 'Cao',       cls: 'high'   },
  medium: { label: 'Trung bình', cls: 'medium' },
  low:    { label: 'Thấp',      cls: 'low'    },
};

export const MyTickets: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Ticket['status'] | 'all'>('all');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadTickets = async () => {
      setIsLoading(true);
      try {
        const response = await ticketService.getTickets({ limit: 100 });
        if (response.success && Array.isArray(response.data)) {
          setTickets(response.data.map(mapBackendTicket));
        }
      } catch (err) {
        console.error('Failed to load tickets:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadTickets();
  }, []);

  const countByStatus = (s: Ticket['status']) => tickets.filter(t => t.status === s).length;

  const visible = filter === 'all'
    ? tickets
    : tickets.filter(t => t.status === filter);

  const summaryCards: Array<{ status: Ticket['status'] | 'all'; label: string; count: number; color: string; bg: string }> = [
    { status: 'all',        label: 'Tất cả',         count: tickets.length, color: '#2563EB', bg: '#EFF6FF' },
    { status: 'new',        label: 'Mới tạo',        count: countByStatus('new'),        color: '#2563EB', bg: '#EFF6FF' },
    { status: 'processing', label: 'Đang xử lý',     count: countByStatus('processing'), color: '#D97706', bg: '#FFFBEB' },
    { status: 'resolved',   label: 'Đã giải quyết', count: countByStatus('resolved'),   color: '#16A34A', bg: '#F0FDF4' },
    { status: 'closed',     label: 'Đã đóng',        count: countByStatus('closed'),     color: '#64748B', bg: '#F1F5F9' },
  ];

  return (
    <div className="mytickets-container">

      {/* ── Page Header ── */}
      <div className="mytickets-header">
        <div>
          <h1 className="mytickets-title">🎫 Phiếu hỗ trợ của tôi</h1>
          <p className="mytickets-subtitle">Theo dõi tiến trình xử lý tất cả yêu cầu bạn đã gửi đến bộ phận IT.</p>
        </div>
        <button
          id="btn-create-ticket"
          className="btn-create-ticket"
          onClick={() => navigate('/tickets/create')}
        >
          ＋ Tạo phiếu mới
        </button>
      </div>

      {/* ── Status Summary Cards ── */}
      <div className="mytickets-summary-grid">
        {summaryCards.map(card => (
          <button
            key={card.status}
            className={`summary-card ${filter === card.status ? 'active' : ''}`}
            style={filter === card.status ? { borderColor: card.color, backgroundColor: card.bg } : {}}
            onClick={() => setFilter(card.status as Ticket['status'] | 'all')}
          >
            <span className="summary-count" style={{ color: filter === card.status ? card.color : '#0F172A' }}>
              {card.count}
            </span>
            <span className="summary-label" style={{ color: filter === card.status ? card.color : '#64748B' }}>
              {card.label}
            </span>
          </button>
        ))}
      </div>

      {/* ── Tickets Table ── */}
      <div className="mytickets-table-card">
        <div className="mytickets-table-header">
          <span className="mytickets-table-title">
            Danh sách phiếu
            <span className="mytickets-count-badge">{visible.length} phiếu</span>
          </span>
        </div>

        {isLoading ? (
          <div className="mytickets-empty">
            <span className="spinner-inline" style={{ width: '32px', height: '32px', borderWidth: '3px', display: 'inline-block' }}></span>
            <p className="empty-title" style={{ marginTop: '12px' }}>Đang tải danh sách phiếu...</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="mytickets-empty">
            <div className="empty-icon">📭</div>
            <p className="empty-title">Không có phiếu nào trong danh mục này</p>
            <p className="empty-sub">Thử chọn bộ lọc khác hoặc tạo phiếu hỗ trợ mới.</p>
          </div>
        ) : (
          <div className="mytickets-table-wrapper">
            <table className="mytickets-table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Tiêu đề</th>
                  <th>Ưu tiên</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th>SLA Deadline</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map(ticket => {
                  const sm = STATUS_META[ticket.status];
                  const pm = PRIORITY_META[ticket.priority];
                  return (
                    <tr key={ticket.id} className="mytickets-row">
                      <td>
                        <span className="ticket-id-badge">{ticket.id}</span>
                      </td>
                      <td className="ticket-title-cell">{ticket.title}</td>
                      <td><span className={`priority-badge ${pm.cls}`}>{pm.label}</span></td>
                      <td>
                        <span className={`status-badge ${sm.cls}`}>
                          {sm.icon} {sm.label}
                        </span>
                      </td>
                      <td className="ticket-date-cell">{ticket.created}</td>
                      <td className="ticket-date-cell">{ticket.sla}</td>
                      <td>
                        <button
                          className="btn-view-detail"
                          onClick={() => navigate(`/tickets/detail/${ticket.id}`)}
                        >
                          Xem chi tiết →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
