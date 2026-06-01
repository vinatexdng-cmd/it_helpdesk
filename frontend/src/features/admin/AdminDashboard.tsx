import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AdminDashboard.css';
import { slaService, type SLAPolicy as BackendSLAPolicy } from '../../services/sla.service';
import { ticketService, type Ticket as BackendTicket } from '../../services/ticket.service';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
interface SLAPolicy {
  id: number;
  name: string;
  schedule: 'business' | '24x7';
  low_response: number;
  low_resolve: number;
  medium_response: number;
  medium_resolve: number;
  high_response: number;
  high_resolve: number;
  remind_before: number;
  active: boolean;
  backendIds: number[];
}

interface UrgentTicket {
  id: string;
  dbId: number;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: 'overdue' | 'near_due' | 'critical';
  trang_thai: 'MOI_TAO' | 'DANG_GIAI_QUYET' | 'DA_GIAI_QUYET' | 'DA_DONG';
  assignee: string;
  slaPhanHoi: any;
  slaXuLy: any;
  danh_sach_sla?: any[];
}

// ─────────────────────────────────────────────
//  Line Chart (SVG – Ticket Trend)
// ─────────────────────────────────────────────
const LineChart: React.FC<{ tickets: BackendTicket[] }> = ({ tickets }) => {
  const currentYear = 2026;
  const data = Array(12).fill(0);
  tickets.forEach(t => {
    if (t.ngay_tao) {
      const date = new Date(t.ngay_tao);
      if (date.getFullYear() === currentYear) {
        data[date.getMonth()] += 1;
      }
    }
  });

  const labels = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
  const W = 440, H = 160, PAD = 20;
  const maxVal = Math.max(...data, 1);
  const xs = data.map((_, i) => PAD + (i / (data.length - 1)) * (W - PAD * 2));
  const ys = data.map(v => H - PAD - ((v / maxVal) * (H - PAD * 2)));

  const pathD = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x},${ys[i]}`).join(' ');
  const fillD = `${pathD} L${xs[xs.length - 1]},${H - PAD} L${xs[0]},${H - PAD} Z`;

  return (
    <div className="chart-wrapper" style={{ height: 220 }}>
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line
            key={i}
            x1={PAD} y1={PAD + t * (H - PAD * 2)}
            x2={W - PAD} y2={PAD + t * (H - PAD * 2)}
            stroke="#E2E8F0" strokeWidth="1"
          />
        ))}
        <defs>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#lineGrad)" />
        <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r="4" fill="#2563EB" stroke="#fff" strokeWidth="2">
            <title>{`Tháng ${labels[i]}: ${data[i]} phiếu`}</title>
          </circle>
        ))}
        {xs.map((x, i) => (
          <text key={i} x={x} y={H + 16} textAnchor="middle" fontSize="9" fill="#94A3B8" fontWeight="600">
            {labels[i]}
          </text>
        ))}
      </svg>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Donut Chart (SVG – Priority Breakdown)
// ─────────────────────────────────────────────
const DonutChart: React.FC<{ tickets: BackendTicket[] }> = ({ tickets }) => {
  let high = 0, medium = 0, low = 0;
  tickets.forEach(t => {
    if (t.muc_do_uu_tien === 'CAO') high++;
    else if (t.muc_do_uu_tien === 'TRUNG_BINH') medium++;
    else low++;
  });

  const segments = [
    { label: 'Cao', value: high, color: '#EF4444' },
    { label: 'Trung bình', value: medium, color: '#F59E0B' },
    { label: 'Thấp', value: low, color: '#10B981' },
  ];
  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 60, cx = 80, cy = 80, stroke = 28;
  let cumAngle = -Math.PI / 2;

  const arcs = segments.map(seg => {
    const angle = total > 0 ? (seg.value / total) * 2 * Math.PI : 0;
    const x1 = cx + R * Math.cos(cumAngle);
    const y1 = cy + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + R * Math.cos(cumAngle);
    const y2 = cy + R * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { path: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`, color: seg.color, label: seg.label, value: seg.value };
  });

  return (
    <div className="chart-wrapper" style={{ height: 220, flexDirection: 'column', gap: 0 }}>
      <svg viewBox="0 0 160 160" style={{ width: 160, height: 160, flexShrink: 0 }}>
        {total > 0 ? (
          arcs.map((arc, i) => (
            <path key={i} d={arc.path} fill="none" stroke={arc.color} strokeWidth={stroke} strokeLinecap="butt">
              <title>{`${arc.label}: ${arc.value} phiếu`}</title>
            </path>
          ))
        ) : (
          <circle cx={cx} cy={cy} r={R} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        )}
        <text x={cx} y={cy - 6} textAnchor="middle" fontSize="20" fontWeight="800" fill="#0F172A">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fontWeight="600" fill="#64748B">tổng phiếu</text>
      </svg>
      <div className="donut-legend">
        {segments.map((s, i) => (
          <div key={i} className="legend-item">
            <div className="legend-dot" style={{ backgroundColor: s.color }} />
            <span>{s.label} ({s.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Bar Chart (SLA Met vs Breach)
// ─────────────────────────────────────────────
const SLABarChart: React.FC<{ tickets: BackendTicket[] }> = ({ tickets }) => {
  const getSlaStats = (priority: 'CAO' | 'TRUNG_BINH' | 'THAP') => {
    const filtered = tickets.filter(t => t.muc_do_uu_tien === priority);
    const withSla = filtered.filter(t => t.danh_sach_sla && t.danh_sach_sla.length > 0);
    if (withSla.length === 0) return { met: 100, breach: 0 };
    
    let violated = 0;
    withSla.forEach(t => {
      const hasViolation = t.danh_sach_sla?.some(s => s.da_vi_pham);
      if (hasViolation) violated++;
    });
    const breach = Math.round((violated / withSla.length) * 100);
    return { met: 100 - breach, breach };
  };

  const highStats = getSlaStats('CAO');
  const mediumStats = getSlaStats('TRUNG_BINH');
  const lowStats = getSlaStats('THAP');

  const rows = [
    { label: 'Ưu tiên Cao', met: highStats.met, breach: highStats.breach },
    { label: 'Trung bình', met: mediumStats.met, breach: mediumStats.breach },
    { label: 'Thấp', met: lowStats.met, breach: lowStats.breach },
  ];

  return (
    <div className="bar-chart-container">
      {rows.map((r, i) => (
        <div key={i} className="bar-row">
          <div className="bar-label">{r.label}</div>
          <div className="bar-track">
            <div className="bar-fill-met" style={{ width: `${r.met}%` }} title={`Đạt SLA: ${r.met}%`} />
            <div className="bar-fill-breached" style={{ width: `${r.breach}%` }} title={`Vi phạm: ${r.breach}%`} />
          </div>
          <div className="bar-value">
            <span style={{ color: '#10B981' }}>{r.met}%</span>
            <span style={{ color: '#94A3B8', fontSize: 11 }}> / </span>
            <span style={{ color: '#EF4444' }}>{r.breach}%</span>
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, justifyContent: 'center' }}>
        <div className="legend-item"><div className="legend-dot dot-sla-met" /><span>Đạt SLA</span></div>
        <div className="legend-item"><div className="legend-dot dot-sla-breach" /><span>Vi phạm SLA</span></div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
//  Efficiency Chart
// ─────────────────────────────────────────────
const EfficiencyChart: React.FC<{ tickets: BackendTicket[] }> = ({ tickets }) => {
  const staffMap: Record<string, { resolved: number; totalWithSla: number; metSla: number }> = {};
  tickets.forEach(t => {
    const supporterName = t.nguoi_ho_tro?.ho_ten;
    if (!supporterName) return;

    if (!staffMap[supporterName]) {
      staffMap[supporterName] = { resolved: 0, totalWithSla: 0, metSla: 0 };
    }

    if (t.trang_thai === 'DA_GIAI_QUYET' || t.trang_thai === 'DA_DONG') {
      staffMap[supporterName].resolved += 1;
    }

    if (t.danh_sach_sla && t.danh_sach_sla.length > 0) {
      staffMap[supporterName].totalWithSla += 1;
      const hasViolation = t.danh_sach_sla.some(s => s.da_vi_pham);
      if (!hasViolation) {
        staffMap[supporterName].metSla += 1;
      }
    }
  });

  const staffList = Object.entries(staffMap).map(([name, stats]) => {
    const score = stats.totalWithSla > 0 ? Math.round((stats.metSla / stats.totalWithSla) * 100) : 100;
    return { name, resolved: stats.resolved, score };
  }).sort((a, b) => b.resolved - a.resolved).slice(0, 5);

  const displayList = staffList.length > 0 ? staffList : [
    { name: 'Chưa có kỹ thuật viên', resolved: 0, score: 100 }
  ];

  return (
    <div className="efficiency-list" style={{ paddingTop: 4 }}>
      {displayList.map((s, i) => (
        <div key={i} className="efficiency-item">
          <div className="efficiency-info">
            <span className="efficiency-name">{s.name}</span>
            <span className="efficiency-score">{s.score}% · {s.resolved} phiếu</span>
          </div>
          <div className="efficiency-progress-bg">
            <div className="efficiency-progress-fill" style={{
              width: `${s.score}%`,
              backgroundColor: s.score >= 90 ? '#10B981' : s.score >= 80 ? '#2563EB' : '#F59E0B'
            }} />
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
//  SLA Modal
// ─────────────────────────────────────────────
interface SLAModalProps {
  onClose: () => void;
  onSave: (p: Omit<SLAPolicy, 'id' | 'active' | 'backendIds'>) => void;
}

const SLAModal: React.FC<SLAModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState<'business' | '24x7'>('business');
  const [remindBefore, setRemindBefore] = useState(60);
  const [matrix, setMatrix] = useState({
    low_response: 8, low_resolve: 72,
    medium_response: 4, medium_resolve: 24,
    high_response: 1, high_resolve: 8,
  });

  const handleChange = (field: keyof typeof matrix, val: string) => {
    setMatrix(prev => ({ ...prev, [field]: parseFloat(val) || 0 }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert('Vui lòng nhập tên chính sách SLA!'); return; }
    onSave({ name, schedule, remind_before: remindBefore, ...matrix });
    onClose();
  };

  const matrixRows: Array<{ label: string; responseKey: keyof typeof matrix; resolveKey: keyof typeof matrix; color: string }> = [
    { label: '🔴 Cao', responseKey: 'high_response', resolveKey: 'high_resolve', color: '#EF4444' },
    { label: '🟡 Trung bình', responseKey: 'medium_response', resolveKey: 'medium_resolve', color: '#F59E0B' },
    { label: '🟢 Thấp', responseKey: 'low_response', resolveKey: 'low_resolve', color: '#10B981' },
  ];

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-container" style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <h3 className="modal-title">✨ Tạo chính sách SLA mới</h3>
          <button className="btn-close-modal" onClick={onClose} aria-label="Đóng">×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* Name + Schedule */}
            <div className="form-grid-2" style={{ marginBottom: 20 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Tên chính sách SLA <span style={{ color: '#EF4444' }}>*</span></label>
                <input
                  className="form-input"
                  placeholder="VD: Chính sách SLA Tiêu chuẩn 2026"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="form-label">Chế độ tính giờ</label>
                <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                  {(['business', '24x7'] as const).map(opt => (
                    <label key={opt} className={`schedule-option ${schedule === opt ? 'selected' : ''}`}>
                      <input type="radio" name="schedule" value={opt} checked={schedule === opt} onChange={() => setSchedule(opt)} style={{ display: 'none' }} />
                      {opt === 'business' ? '🏢 Giờ hành chính' : '🌐 24x7'}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Nhắc nhở trước hạn (phút)</label>
                <div className="matrix-input-wrapper" style={{ marginTop: 6 }}>
                  <input
                    className="form-input"
                    type="number"
                    min={5}
                    max={1440}
                    value={remindBefore}
                    onChange={e => setRemindBefore(parseInt(e.target.value) || 30)}
                    style={{ paddingRight: 60 }}
                  />
                  <span className="input-unit">phút</span>
                </div>
              </div>
            </div>

            {/* SLA Matrix */}
            <div className="sla-matrix-section">
              <p className="matrix-title">📊 Ma trận thời gian cam kết dịch vụ</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Mức độ</th>
                      <th style={thStyle}>⚡ Thời gian phản hồi</th>
                      <th style={thStyle}>✅ Thời gian xử lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixRows.map(row => (
                      <tr key={row.label}>
                        <td style={{ ...tdStyle, fontWeight: 700, color: row.color }}>{row.label}</td>
                        <td style={tdStyle}>
                          <div className="matrix-input-wrapper">
                            <input
                              className="form-input"
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={matrix[row.responseKey]}
                              onChange={e => handleChange(row.responseKey, e.target.value)}
                              style={{ paddingRight: 44 }}
                            />
                            <span className="input-unit">giờ</span>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <div className="matrix-input-wrapper">
                            <input
                              className="form-input"
                              type="number"
                              min={1}
                              step={1}
                              value={matrix[row.resolveKey]}
                              onChange={e => handleChange(row.resolveKey, e.target.value)}
                              style={{ paddingRight: 44 }}
                            />
                            <span className="input-unit">giờ</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '10px 0 0 0' }}>
                {schedule === 'business'
                  ? '⚠️ Chế độ Giờ hành chính sẽ tự động loại trừ Thứ Bảy, Chủ Nhật và ngày lễ quốc gia khi tính đếm ngược SLA.'
                  : '🌐 Chế độ 24x7 tính toán liên tục 24 giờ mỗi ngày, kể cả cuối tuần và ngày lễ.'}
              </p>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>Hủy bỏ</button>
            <button type="submit" className="btn-primary">💾 Lưu chính sách</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  borderBottom: '1px solid #E2E8F0',
  textAlign: 'left',
  backgroundColor: '#F8FAFC',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  verticalAlign: 'middle',
  borderBottom: '1px solid #F1F5F9',
};

// ─────────────────────────────────────────────
//  MAIN COMPONENT
// ─────────────────────────────────────────────
export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'sla'>('overview');
  const [slaModalOpen, setSlaModalOpen] = useState(false);
  const [slaFilter, setSlaFilter] = useState('month');
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [tickets, setTickets] = useState<BackendTicket[]>([]);
  const [loading, setLoading] = useState(true);

  const groupPolicies = (backendPolicies: BackendSLAPolicy[]): SLAPolicy[] => {
    const groups: Record<string, BackendSLAPolicy[]> = {};
    backendPolicies.forEach(p => {
      const name = p.ten_chinh_sach;
      if (!groups[name]) groups[name] = [];
      groups[name].push(p);
    });

    return Object.entries(groups).map(([name, list], index) => {
      const pCao = list.find(p => p.muc_do_uu_tien === 'CAO');
      const pTB = list.find(p => p.muc_do_uu_tien === 'TRUNG_BINH');
      const pThap = list.find(p => p.muc_do_uu_tien === 'THAP');

      const schedule = list[0].loai_thoi_gian === 'H24_7' ? '24x7' : 'business';
      const active = list.some(p => p.trang_thai);
      const minToHour = (min?: number) => min ? min / 60 : 0;

      return {
        id: index + 1,
        name,
        schedule,
        low_response: minToHour(pThap?.tg_phan_hoi) || 8,
        low_resolve: minToHour(pThap?.tg_xu_ly) || 72,
        medium_response: minToHour(pTB?.tg_phan_hoi) || 4,
        medium_resolve: minToHour(pTB?.tg_xu_ly) || 24,
        high_response: minToHour(pCao?.tg_phan_hoi) || 1,
        high_resolve: minToHour(pCao?.tg_xu_ly) || 8,
        remind_before: 60,
        active,
        backendIds: list.map(p => p.chinh_sach_sla_id)
      };
    });
  };

  const fetchPolicies = async () => {
    try {
      const res = await slaService.getPolicies();
      if (res.success && res.data) {
        setPolicies(groupPolicies(res.data));
      }
    } catch (err) {
      console.error('Error fetching SLA policies:', err);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await ticketService.getTickets({ limit: 100 });
      if (res.success && res.data) {
        setTickets(res.data);
      }
    } catch (err) {
      console.error('Error fetching tickets for dashboard:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchPolicies(), fetchTickets()]).finally(() => setLoading(false));
  }, []);

  const handleTogglePolicy = async (id: number) => {
    const policy = policies.find(p => p.id === id);
    if (!policy) return;

    try {
      const newActiveState = !policy.active;
      await Promise.all(
        policy.backendIds.map(backendId =>
          slaService.updatePolicy(backendId, { trang_thai: newActiveState })
        )
      );
      fetchPolicies();
    } catch (err) {
      alert('Lỗi khi bật/tắt chính sách SLA: ' + (err as Error).message);
    }
  };

  const handleAddPolicy = async (data: Omit<SLAPolicy, 'id' | 'active' | 'backendIds'>) => {
    try {
      const basePayload = {
        ten_chinh_sach: data.name,
        loai_thoi_gian: data.schedule === '24x7' ? 'H24_7' as const : 'GIO_HANH_CHINH' as const,
      };

      await Promise.all([
        slaService.createPolicy({
          ...basePayload,
          muc_do_uu_tien: 'CAO',
          tg_phan_hoi: data.high_response * 60,
          tg_xu_ly: data.high_resolve * 60,
          trang_thai: true
        }),
        slaService.createPolicy({
          ...basePayload,
          muc_do_uu_tien: 'TRUNG_BINH',
          tg_phan_hoi: data.medium_response * 60,
          tg_xu_ly: data.medium_resolve * 60,
          trang_thai: true
        }),
        slaService.createPolicy({
          ...basePayload,
          muc_do_uu_tien: 'THAP',
          tg_phan_hoi: data.low_response * 60,
          tg_xu_ly: data.low_resolve * 60,
          trang_thai: true
        })
      ]);

      alert('Đã tạo chính sách SLA mới thành công!');
      fetchPolicies();
    } catch (err) {
      alert('Lỗi khi tạo chính sách SLA mới: ' + (err as Error).message);
    }
  };

  // ── Metric Cards ──────────────────────────
  const moiTiepNhan = tickets.filter(t => t.trang_thai === 'MOI_TAO').length;
  const dangXuLy = tickets.filter(t => t.trang_thai === 'DANG_GIAI_QUYET').length;
  const daGiaiQuyet = tickets.filter(t => t.trang_thai === 'DA_GIAI_QUYET').length;
  const daDong = tickets.filter(t => t.trang_thai === 'DA_DONG').length;

  const metrics = [
    { label: 'Mới tiếp nhận', value: moiTiepNhan.toLocaleString(), change: 'Mới tạo', changeType: 'blue' as const, icon: '🎫', iconClass: 'total' },
    { label: 'Đang xử lý', value: dangXuLy.toLocaleString(), change: 'Đang xử lý', changeType: 'red' as const, icon: '🔓', iconClass: 'open' },
    { label: 'Đã giải quyết', value: daGiaiQuyet.toLocaleString(), change: 'Hoàn tất', changeType: 'green' as const, icon: '✅', iconClass: 'resolved' },
    { label: 'Đã đóng', value: daDong.toLocaleString(), change: 'Đã đóng', changeType: 'green' as const, icon: '🗄️', iconClass: 'breach' },
  ];

  const getPriorityLabel = (p: UrgentTicket['priority']) => {
    if (p === 'high') return { text: 'Cao', cls: 'high' };
    if (p === 'medium') return { text: 'TB', cls: 'medium' };
    return { text: 'Thấp', cls: 'low' };
  };

  const scheduleLabel = (s: 'business' | '24x7') =>
    s === 'business' ? '🏢 Hành chính' : '🌐 24x7';

  const renderSlaColumn = (ticket: any, loaiSla: 'PHAN_HOI' | 'XU_LY') => {
    const slaList = ticket.sla_theo_doi || ticket.danh_sach_sla || [];
    const sla = slaList.find((s: any) => s.loai_sla === loaiSla);
    
    if (!sla) {
      return <span style={{ color: '#64748B' }}>N/A</span>;
    }

    if (sla.thoi_diem_dat) {
      return <span style={{ color: '#16A34A', fontWeight: 700 }}>Đạt</span>;
    }

    const now = Date.now();
    const deadline = Date.parse(sla.han_chot);
    const diff = deadline - now;
    const isOverdue = diff <= 0 || sla.da_vi_pham;

    if (isOverdue) {
      return <span style={{ color: '#DC2626', fontWeight: 700 }}>Vi phạm</span>;
    }

    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const pad = (num: number) => String(num).padStart(2, '0');

    return (
      <span style={{
        fontWeight: 700,
        color: diff < 2 * 3600000 ? '#D97706' : '#16A34A'
      }}>
        {pad(hours)}h {pad(mins)}m
      </span>
    );
  };

  const renderDbStatusBadge = (status: 'MOI_TAO' | 'DANG_GIAI_QUYET' | 'DA_GIAI_QUYET' | 'DA_DONG') => {
    switch (status) {
      case 'MOI_TAO':
        return <span className="status-badge new">Mới tiếp nhận</span>;
      case 'DANG_GIAI_QUYET':
        return <span className="status-badge processing">Đang xử lý</span>;
      case 'DA_GIAI_QUYET':
        return <span className="status-badge resolved">Đã giải quyết</span>;
      case 'DA_DONG':
        return <span className="status-badge" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Đã đóng</span>;
      default:
        return <span className="status-badge">{status}</span>;
    }
  };

  const getUrgentTicketsList = (): UrgentTicket[] => {
    return tickets
      .filter(t => t.trang_thai !== 'DA_DONG')
      .map(t => {
        const isHigh = t.muc_do_uu_tien === 'CAO';
        const slaPhanHoi = t.danh_sach_sla?.find(s => s.loai_sla === 'PHAN_HOI');
        const slaXuLy = t.danh_sach_sla?.find(s => s.loai_sla === 'XU_LY');
        const isViolated = slaXuLy?.da_vi_pham || false;
        
        let status: UrgentTicket['status'] = 'near_due';
        if (isViolated) status = 'overdue';
        else if (isHigh) status = 'critical';

        return {
          id: t.ma_phieu,
          dbId: t.phieu_ho_tro_id,
          title: t.tieu_de,
          priority: isHigh ? ('high' as const) : t.muc_do_uu_tien === 'TRUNG_BINH' ? ('medium' as const) : ('low' as const),
          status,
          trang_thai: t.trang_thai,
          assignee: t.nguoi_ho_tro?.ho_ten || 'Chưa phân công',
          slaPhanHoi,
          slaXuLy,
          danh_sach_sla: t.danh_sach_sla
        };
      })
      .slice(0, 5);
  };

  const urgentTickets = getUrgentTicketsList();

  if (loading) {
    return (
      <div className="admin-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ fontSize: '18px', fontWeight: 600, color: '#64748B' }}>
          🔄 Đang tải dữ liệu báo cáo thống kê...
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <div className="admin-content">

        {/* ── Header Card ── */}
        <div className="admin-header-card">
          <div className="admin-title-area">
            <h1 className="admin-title">📊 Bảng điều khiển & Quản lý SLA</h1>
            <p className="admin-subtitle">Theo dõi hiệu suất vận hành IT và cấu hình chính sách SLA · Hệ thống Live</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <select
              className="filter-select"
              value={slaFilter}
              onChange={e => setSlaFilter(e.target.value)}
              aria-label="Bộ lọc thời gian"
            >
              <option value="week">7 ngày qua</option>
              <option value="month">Tháng này</option>
              <option value="quarter">Quý này</option>
              <option value="year">Năm nay</option>
            </select>
            <div className="admin-tabs-row">
              <button
                id="tab-overview"
                className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                📈 Tổng quan
              </button>
              <button
                id="tab-sla"
                className={`admin-tab-btn ${activeTab === 'sla' ? 'active' : ''}`}
                onClick={() => setActiveTab('sla')}
              >
                ⏱️ Quản lý SLA
              </button>
            </div>
          </div>
        </div>

        {/* ── Metric Cards (4 boxes) ── */}
        <div className="metrics-grid">
          {metrics.map((m, i) => (
            <div key={i} className="metric-card">
              <div className="metric-info">
                <span className="metric-label">{m.label}</span>
                <p className="metric-value">{m.value}</p>
                <span className={`metric-badge ${m.changeType}`}>{m.change}</span>
              </div>
              <div className={`metric-icon-box ${m.iconClass}`}>{m.icon}</div>
            </div>
          ))}
        </div>

        {/* TAB: TỔNG QUAN */}
        {activeTab === 'overview' && (
          <>
            <div className="charts-grid">
              <div className="chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">📈 Xu hướng phiếu theo thời gian</h3>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Năm 2026</span>
                </div>
                <LineChart tickets={tickets} />
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
                  <div className="legend-item">
                    <div className="legend-dot" style={{ backgroundColor: '#2563EB', borderRadius: 2 }} />
                    <span>Số phiếu tạo mới</span>
                  </div>
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">🎯 Phiếu theo mức độ ưu tiên</h3>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Tháng 5/2026</span>
                </div>
                <DonutChart tickets={tickets} />
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">⚡ Tỷ lệ đạt / vi phạm SLA</h3>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Tháng 5/2026</span>
                </div>
                <div className="chart-wrapper" style={{ height: 220, alignItems: 'stretch' }}>
                  <SLABarChart tickets={tickets} />
                </div>
              </div>

              <div className="chart-card">
                <div className="chart-header">
                  <h3 className="chart-title">👥 Hiệu suất xử lý nhân viên</h3>
                  <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Tháng 5/2026</span>
                </div>
                <EfficiencyChart tickets={tickets} />
              </div>
            </div>

            <div className="table-card">
              <div className="table-card-header">
                <h3 className="table-card-title">
                  🚨 Danh sách ưu tiên xử lý
                </h3>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button className="btn-outline" onClick={() => alert('Xuất danh sách ưu tiên ra Excel...')}>
                    📥 Xuất báo cáo
                  </button>
                </div>
              </div>
              <div className="table-wrapper">
                {urgentTickets.length > 0 ? (
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Mã phiếu</th>
                        <th>Tiêu đề</th>
                        <th>Ưu tiên</th>
                        <th>Trạng thái</th>
                        <th>Kỹ thuật viên</th>
                        <th>SLA Phản hồi</th>
                        <th>SLA Xử lý</th>
                      </tr>
                    </thead>
                    <tbody>
                      {urgentTickets.map(ticket => {
                        const p = getPriorityLabel(ticket.priority);
                        return (
                          <tr key={ticket.id} className="ticket-row-clickable">
                            <td>
                              <span 
                                style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563EB', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
                                onClick={() => navigate(`/dashboard/tickets/${ticket.dbId}`)}
                              >
                                {ticket.id}
                              </span>
                            </td>
                            <td style={{ maxWidth: 280 }}>
                              <span 
                                style={{ fontWeight: 600, color: '#0F172A', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'pointer' }}
                                onClick={() => navigate(`/dashboard/tickets/${ticket.dbId}`)}
                              >
                                {ticket.title}
                              </span>
                            </td>
                            <td><span className={`priority-badge ${p.cls}`}>{p.text}</span></td>
                            <td>{renderDbStatusBadge(ticket.trang_thai)}</td>
                            <td style={{ fontWeight: 600, color: '#334155' }}>{ticket.assignee}</td>
                            <td>{renderSlaColumn(ticket, 'PHAN_HOI')}</td>
                            <td>{renderSlaColumn(ticket, 'XU_LY')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                    🎉 Không có sự cố khẩn cấp hoặc vi phạm SLA nào cần ưu tiên xử lý lúc này!
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* TAB: QUẢN LÝ SLA */}
        {activeTab === 'sla' && (
          <>
            <div className="table-card">
              <div className="table-card-header">
                <h3 className="table-card-title">
                  ⏱️ Chính sách SLA hiện tại
                  <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 600, backgroundColor: '#F0FDF4', padding: '2px 8px', borderRadius: 6, marginLeft: 10 }}>
                    {policies.filter(p => p.active).length} đang áp dụng
                  </span>
                </h3>
                <button
                  id="btn-create-sla"
                  className="btn-primary"
                  onClick={() => setSlaModalOpen(true)}
                >
                  ＋ Tạo chính sách SLA mới
                </button>
              </div>

              <div className="table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Tên chính sách</th>
                      <th>Chế độ</th>
                      <th style={{ textAlign: 'center' }}>Cao (Phản hồi / Xử lý)</th>
                      <th style={{ textAlign: 'center' }}>Trung bình (Phản hồi / Xử lý)</th>
                      <th style={{ textAlign: 'center' }}>Thấp (Phản hồi / Xử lý)</th>
                      <th>Nhắc trước</th>
                      <th style={{ textAlign: 'center' }}>Áp dụng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map(p => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: '#0F172A' }}>{p.name}</div>
                          {p.active && <div style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, marginTop: 2 }}>● Đang áp dụng</div>}
                        </td>
                        <td>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 700,
                            backgroundColor: p.schedule === 'business' ? '#EFF6FF' : '#FAF5FF',
                            color: p.schedule === 'business' ? '#2563EB' : '#7C3AED',
                            padding: '3px 8px',
                            borderRadius: 6,
                          }}>
                            {scheduleLabel(p.schedule)}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#EF4444' }}>{p.high_response}h</span>
                          <span style={{ color: '#94A3B8' }}> / </span>
                          <span style={{ fontWeight: 700, color: '#EF4444' }}>{p.high_resolve}h</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#D97706' }}>{p.medium_response}h</span>
                          <span style={{ color: '#94A3B8' }}> / </span>
                          <span style={{ fontWeight: 700, color: '#D97706' }}>{p.medium_resolve}h</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ fontWeight: 700, color: '#16A34A' }}>{p.low_response}h</span>
                          <span style={{ color: '#94A3B8' }}> / </span>
                          <span style={{ fontWeight: 700, color: '#16A34A' }}>{p.low_resolve}h</span>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>{p.remind_before} phút</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <label className="switch" title={p.active ? 'Đang bật – Nhấn để tắt' : 'Đang tắt – Nhấn để bật'}>
                            <input
                              type="checkbox"
                              checked={p.active}
                              onChange={() => handleTogglePolicy(p.id)}
                              aria-label={`Bật/tắt chính sách ${p.name}`}
                            />
                            <span className="slider" />
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              <div className="sla-info-card" style={{ borderLeft: '4px solid #2563EB' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>🏢</div>
                <h4 className="sla-info-title">Giờ hành chính</h4>
                <p className="sla-info-desc">Đếm ngược SLA trong khung giờ 08:00–17:30 (Thứ 2 – Thứ 6). Tự động bỏ qua Thứ 7, Chủ nhật và các ngày lễ quốc gia Việt Nam.</p>
              </div>
              <div className="sla-info-card" style={{ borderLeft: '4px solid #7C3AED' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>🌐</div>
                <h4 className="sla-info-title">Chế độ 24x7</h4>
                <p className="sla-info-desc">Tính liên tục 24 giờ mỗi ngày, 7 ngày mỗi tuần, kể cả cuối tuần và ngày lễ. Phù hợp với các sự cố nghiêm trọng cấp cao.</p>
              </div>
              <div className="sla-info-card" style={{ borderLeft: '4px solid #F59E0B' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>🔔</div>
                <h4 className="sla-info-title">Ngưỡng nhắc nhở</h4>
                <p className="sla-info-desc">Hệ thống tự động gửi cảnh báo đến kỹ thuật viên và Quản lý IT khi phiếu sắp đến hạn SLA theo ngưỡng đã cài đặt (phút).</p>
              </div>
              <div className="sla-info-card" style={{ borderLeft: '4px solid #10B981' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>📊</div>
                <h4 className="sla-info-title">Áp dụng tức thì</h4>
                <p className="sla-info-desc">Chính sách SLA được kích hoạt sẽ áp dụng cho toàn bộ phiếu mới tạo. Phiếu cũ vẫn giữ cấu hình SLA tại thời điểm tạo.</p>
              </div>
            </div>
          </>
        )}

      </div>

      {/* SLA Modal */}
      {slaModalOpen && (
        <SLAModal
          onClose={() => setSlaModalOpen(false)}
          onSave={handleAddPolicy}
        />
      )}
    </div>
  );
};
