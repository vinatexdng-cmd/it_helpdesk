import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './TicketDetail.css';
import { ticketService } from '../../services/ticket.service';
import axiosInstance from '../../libs/axios';
import { useAuth } from '../../context/AuthContext';

interface Comment {
  id: string;
  author: string;
  role: string;
  text: string;
  date: string;
  timestamp: number;
  isItSupport: boolean;
  loai_binh_luan: string;
  attachments?: { name: string; size: string }[];
}

interface TimelineEvent {
  status: string;
  date: string;
  timestamp: number;
  executor: string;
  note: string;
  isCurrent: boolean;
}

interface TicketData {
  id: string;
  title: string;
  description: string;
  status: 'New' | 'Pending' | 'Resolved' | 'Closed';
  priority: 'Low' | 'Medium' | 'High';
  assignee: string;
  createdAt: string;
  requesterName: string;
  requesterEmail: string;
  deviceSoftware: string;
  slaDeadline: number; // timestamp
  tags: string[];
  attachments?: { name: string; size: string; duong_dan_file: string }[];
}

export const TicketDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token') || '';

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);

  // States nhập bình luận mới
  const [newComment, setNewComment] = useState('');
  const [commentAttachedFiles, setCommentAttachedFiles] = useState<File[]>([]);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Phân quyền cho Người yêu cầu (USER) và Kỹ thuật viên (IT_L1/IT_L2)
  const isRequester = session?.ma_vai_tro === 'NGUOI_YEU_CAU';
  const isTechnician = session?.ma_vai_tro === 'IT_L1' || session?.ma_vai_tro === 'IT_L2';
  const isTechnicianOrAdmin = isTechnician || session?.ma_vai_tro === 'QUAN_LY';
  
  const [activeTab, setActiveTab] = useState<'all' | 'comment' | 'internal' | 'history'>('all');

  // Toolbar & Dropdowns / Modal States
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  
  // Form Escalate L2
  const [escalateReason, setEscalateReason] = useState('');
  const [escalateStepsTried, setEscalateStepsTried] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  // Khảo sát độ hài lòng (UC-04)
  const [surveyToken, setSurveyToken] = useState(tokenFromUrl);
  const [isSatisfied, setIsSatisfied] = useState<boolean | null>(null);
  const [ratingStars, setRatingStars] = useState<number>(5);
  const [surveyComment, setSurveyComment] = useState('');
  const [surveySubmitted, setSurveySubmitted] = useState(false);
  const [surveyError, setSurveyError] = useState<string | null>(null);

  // Đồng hồ đếm ngược SLA
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const loadTicketData = async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const response = await ticketService.getTicketDetail(Number(id));
      if (response.success && response.data) {
        const data = response.data;
        
        let priorityMapped: 'Low' | 'Medium' | 'High' = 'Medium';
        if (data.muc_do_uu_tien === 'CAO') priorityMapped = 'High';
        else if (data.muc_do_uu_tien === 'THAP') priorityMapped = 'Low';

        let statusMapped: 'New' | 'Pending' | 'Resolved' | 'Closed' = 'New';
        if (data.trang_thai === 'DANG_GIAI_QUYET') statusMapped = 'Pending';
        else if (data.trang_thai === 'DA_GIAI_QUYET') statusMapped = 'Resolved';
        else if (data.trang_thai === 'DA_DONG') statusMapped = 'Closed';

        const slaXuLy = data.danh_sach_sla?.find((s: any) => s.loai_sla === 'XU_LY');
        const slaDeadline = slaXuLy ? new Date(slaXuLy.han_chot).getTime() : Date.now();

        setTicket({
          id: String(data.phieu_ho_tro_id),
          title: data.tieu_de,
          description: data.mo_ta_chi_tiet,
          status: statusMapped,
          priority: priorityMapped,
          assignee: data.nguoi_ho_tro?.ho_ten || 'Chưa phân công (L1 tiếp nhận)',
          createdAt: new Date(data.ngay_tao).toLocaleString('vi-VN'),
          requesterName: data.nguoi_tao?.ho_ten || '',
          requesterEmail: data.nguoi_tao?.email || '',
          deviceSoftware: '', 
          slaDeadline,
          tags: [],
          attachments: data.danh_sach_file?.map((f: any) => ({
            name: f.ten_tep,
            size: `${f.dung_luong_kb} KB`,
            duong_dan_file: f.duong_dan_file
          }))
        });

        // comments
        const commentsMapped = (data.danh_sach_bl || []).map((c: any) => ({
          id: String(c.binh_luan_id),
          author: c.nguoi_gui?.ho_ten || 'Unknown',
          role: c.nguoi_gui?.vai_tro?.ma_vai_tro === 'NGUOI_YEU_CAU' ? 'Người yêu cầu' : 'IT Support',
          text: c.noi_dung,
          date: new Date(c.ngay_tao).toLocaleString('vi-VN'),
          timestamp: new Date(c.ngay_tao).getTime(),
          isItSupport: c.nguoi_gui?.vai_tro?.ma_vai_tro !== 'NGUOI_YEU_CAU',
          loai_binh_luan: c.loai_binh_luan || 'public',
          attachments: c.danh_sach_file?.map((f: any) => ({
            name: f.ten_tep,
            size: `${f.dung_luong_kb} KB`
          }))
        }));
        setComments(commentsMapped);

        // timeline
        const timelineMapped = (data.danh_sach_log || []).map((l: any, idx: number) => ({
          status: l.hanh_dong,
          date: new Date(l.ngay_thuc_hien).toLocaleString('vi-VN'),
          timestamp: new Date(l.ngay_thuc_hien).getTime(),
          executor: l.nguoi_thuc_hien?.ho_ten || 'Hệ thống',
          note: l.ghi_chu || `${l.hanh_dong} (Từ: "${l.gia_tri_cu || ''}" Sang: "${l.gia_tri_moi || ''}")`,
          isCurrent: idx === ((data.danh_sach_log || []).length - 1)
        }));
        setTimeline(timelineMapped);
      }
    } catch (err) {
      console.error('Failed to fetch ticket detail:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTicketData();
  }, [id]);

  // Cập nhật đồng hồ đếm ngược SLA
  useEffect(() => {
    if (!ticket) return;
    const calculateTimeLeft = () => {
      const diff = ticket.slaDeadline - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [ticket?.slaDeadline]);

  // Reset tab hoạt động khi vai trò người dùng thay đổi
  useEffect(() => {
    setActiveTab('all');
  }, [session?.ma_vai_tro]);

  // Handler gửi bình luận mới hoặc ghi chú nội bộ (internal note)
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && commentAttachedFiles.length === 0) return;

    setIsLoading(true);
    try {
      const type = (isTechnicianOrAdmin && activeTab === 'internal') ? 'internal' : 'public';
      const response = await ticketService.addComment(Number(id), newComment, type, commentAttachedFiles);
      if (response.success) {
        await loadTicketData();
        setNewComment('');
        setCommentAttachedFiles([]);
      } else {
        alert(response.message || 'Gửi bình luận thất bại.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Không thể gửi bình luận.');
    } finally {
      setIsLoading(false);
    }
  };

  // Cập nhật trạng thái trực tiếp (Status transition dropdown)
  const handleUpdateStatus = async (status: 'New' | 'Pending' | 'Resolved' | 'Closed') => {
    setShowStatusDropdown(false);
    if (!id) return;
    setIsLoading(true);
    try {
      let backendStatus = 'MOI_TAO';
      if (status === 'Pending') backendStatus = 'DANG_GIAI_QUYET';
      else if (status === 'Resolved') backendStatus = 'DA_GIAI_QUYET';
      else if (status === 'Closed') backendStatus = 'DA_DONG';

      const note = prompt('Nhập ghi chú cập nhật trạng thái:', `Cập nhật trạng thái sang ${status}`);
      if (note === null) {
        setIsLoading(false);
        return;
      }

      const response = await ticketService.updateStatus(Number(id), backendStatus, note);
      if (response.success) {
        alert(`Cập nhật trạng thái sang ${status} thành công!`);
        await loadTicketData();
      } else {
        alert(response.message || 'Cập nhật trạng thái thất bại.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Không thể cập nhật trạng thái.');
    } finally {
      setIsLoading(false);
    }
  };

  // Modal Chuyển cấp L2
  const handleOpenEscalateModal = () => {
    setModalError(null);
    setShowEscalateModal(true);
  };

  const handleConfirmEscalate = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!escalateReason.trim()) {
      setModalError('Vui lòng nhập lý do chuyển cấp L2.');
      return;
    }
    if (!escalateStepsTried.trim()) {
      setModalError('Vui lòng nhập các bước L1 đã thử xử lý.');
      return;
    }

    setIsLoading(true);
    try {
      // Đảm bảo truyền đúng cấu trúc key Backend yêu cầu: ly_do, ly_do_chuyen_cap và cac_buoc_da_thu
      const payload = {
        ly_do: escalateReason,
        ly_do_chuyen_cap: escalateReason,
        cac_buoc_da_thu: escalateStepsTried
      };
      
      // Gọi trực tiếp endpoint thật của Backend: axiosInstance.post(`/tickets/${id}/escalate`, payload)
      const response = await axiosInstance.post(`/tickets/${id}/escalate`, payload);

      if (response.status === 200 || response.data?.success) {
        alert('Chuyển cấp sự cố lên Tuyến 2 thành công!');
        setShowEscalateModal(false);
        setEscalateReason('');
        setEscalateStepsTried('');
        // Chuyển hướng kỹ thuật viên L1 quay trở về trang Hàng đợi xử lý phiếu
        navigate('/tickets/queue');
      } else {
        setModalError(response.data?.message || 'Chuyển cấp thất bại.');
      }
    } catch (err: any) {
      console.error(err);
      setModalError(err.response?.data?.message || 'Không thể chuyển cấp ticket.');
    } finally {
      setIsLoading(false);
    }
  };



  const handleAttachFileComment = () => {
    commentFileInputRef.current?.click();
  };

  const handleFileSelectComment = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx'];
      const maxSizeBytes = 20 * 1024 * 1024;
      const validFiles: File[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext && allowedExtensions.includes(ext) && file.size <= maxSizeBytes) {
          validFiles.push(file);
        } else {
          alert(`Tệp ${file.name} không đúng định dạng hoặc vượt quá 20MB.`);
        }
      }
      setCommentAttachedFiles(prev => [...prev, ...validFiles]);
    }
  };

  // Handler gửi đánh giá hài lòng (UC-04)
  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSurveyError(null);

    const tokenToUse = tokenFromUrl || surveyToken;
    if (!tokenToUse.trim()) {
      setSurveyError('Vui lòng nhập token xác thực khảo sát.');
      return;
    }

    if (isSatisfied === null) {
      setSurveyError('Vui lòng chọn mức độ hài lòng (Có hoặc Không).');
      return;
    }

    if (isSatisfied === false && !surveyComment.trim()) {
      setSurveyError('Vui lòng nhập lý do không hài lòng vào ô nhận xét bên dưới.');
      return;
    }

    setSurveySubmitted(true);

    try {
      const payload = {
        token: tokenToUse,
        hai_long: isSatisfied,
        so_sao: ratingStars,
        nhan_xet: surveyComment,
        ly_do_khong_hai_long: isSatisfied ? undefined : surveyComment
      };
      
      const response = await ticketService.submitReview(payload);
      if (response.success) {
        alert('Cảm ơn bạn đã gửi đánh giá!');
        setIsSatisfied(null);
        setSurveyComment('');
        await loadTicketData();
      } else {
        setSurveyError(response.message || 'Gửi đánh giá thất bại.');
      }
    } catch (err: any) {
      console.error(err);
      setSurveyError(err.response?.data?.message || 'Không thể gửi đánh giá.');
    } finally {
      setSurveySubmitted(false);
    }
  };

  // Định dạng đồng hồ đếm ngược SLA
  const formatSLA = (ms: number) => {
    if (ms <= 0) {
      return <span className="sla-countdown-time danger">Quá hạn! (Vi phạm)</span>;
    }

    const hours = Math.floor(ms / (3600 * 1000));
    const mins = Math.floor((ms % (3600 * 1000)) / (60 * 1000));
    const secs = Math.floor((ms % (60 * 1000)) / 1000);

    const pad = (num: number) => String(num).padStart(2, '0');
    const displayStr = `${pad(hours)}g ${pad(mins)}p ${pad(secs)}s`;

    if (ms < 15 * 60 * 1000) {
      return <span className="sla-countdown-time danger">{displayStr} ⚠</span>;
    } else if (ms < 120 * 60 * 1000) {
      return <span className="sla-countdown-time warning">{displayStr}</span>;
    }
    return <span className="sla-countdown-time">{displayStr}</span>;
  };

  // Chuyển đổi trạng thái nhanh để Tester kiểm tra (Testing Panel)
  const changeStatusForTesting = async (status: 'New' | 'Pending' | 'Resolved' | 'Closed') => {
    if (!id) return;
    setIsLoading(true);
    try {
      let backendStatus = 'MOI_TAO';
      if (status === 'Pending') backendStatus = 'DANG_GIAI_QUYET';
      else if (status === 'Resolved') backendStatus = 'DA_GIAI_QUYET';
      else if (status === 'Closed') backendStatus = 'DA_DONG';

      const response = await ticketService.updateStatus(Number(id), backendStatus, 'Cập nhật trạng thái từ Testing Panel');
      if (response.success) {
        alert(`Chuyển trạng thái sang ${status} thành công!`);
        await loadTicketData();
      } else {
        alert(response.message || 'Cập nhật trạng thái thất bại.');
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.message || 'Không thể cập nhật trạng thái.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!ticket) {
    return (
      <div className="ticket-detail-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="spinner-inline" style={{ width: '32px', height: '32px', borderWidth: '3px' }}></span>
          <p style={{ marginTop: '12px', color: '#64748B', fontWeight: 500 }}>Đang tải thông tin chi tiết phiếu...</p>
        </div>
      </div>
    );
  }

  const getFileUrl = (filePath: string) => {
    const base = axiosInstance.defaults.baseURL || 'http://localhost:3000/api/v1';
    const origin = base.replace('/api/v1', '');
    return `${origin}${filePath}`;
  };

  const mapTimelineStatus = (status: string): { label: string; color: string } => {
    const s = status.toUpperCase();
    if (s.includes('CREATED') || s.includes('MOI_TAO') || s === 'CREATE') {
      return { label: 'Phiếu đã được tạo thành công', color: '#2563EB' };
    }
    if (s.includes('ASSIGNED') || s.includes('PHAN_CONG') || s === 'ASSIGNEE') {
      return { label: 'Đã phân công kỹ thuật viên phụ trách', color: '#8B5CF6' };
    }
    if (s.includes('IN_PROGRESS') || s.includes('DANG_XU_LY') || s.includes('DANG_GIAI_QUYET')) {
      return { label: 'Đang tiến hành kiểm tra & xử lý', color: '#F59E0B' };
    }
    if (s.includes('RESOLVED') || s.includes('GIAI_QUYET') || s.includes('DA_GIAI_QUYET')) {
      return { label: 'Sự cố đã được giải quyết xong', color: '#16A34A' };
    }
    if (s.includes('CLOSED') || s.includes('DA_DONG')) {
      return { label: 'Đã đóng phiếu hỗ trợ hoàn hoàn', color: '#64748B' };
    }
    return { label: status, color: '#3B82F6' };
  };

  return (
    <div className="ticket-detail-container">
      <div className="ticket-detail-content">

        {/* 1. THANH CHUYỂN TRẠNG THÁI NHANH (TESTING PANEL) */}
        {!!session && (session.ma_vai_tro === 'QUAN_LY' || session.ma_vai_tro === 'IT_L1' || session.ma_vai_tro === 'IT_L2') && (
          <div className="test-panel-card">
            <h4 className="test-panel-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
              </svg>
              Bảng điều khiển thử nghiệm nhanh (Tester Controls)
            </h4>
            <div className="test-panel-buttons">
              <button
                type="button"
                className={`btn-test-state ${ticket.status === 'New' ? 'active' : ''}`}
                onClick={() => changeStatusForTesting('New')}
              >
                Mới tạo (New)
              </button>
              <button
                type="button"
                className={`btn-test-state ${ticket.status === 'Pending' ? 'active' : ''}`}
                onClick={() => changeStatusForTesting('Pending')}
              >
                Đang giải quyết (Pending)
              </button>
              <button
                type="button"
                className={`btn-test-state ${ticket.status === 'Resolved' ? 'active' : ''}`}
                onClick={() => changeStatusForTesting('Resolved')}
              >
                Đã giải quyết (Resolved)
              </button>
              <button
                type="button"
                className={`btn-test-state ${ticket.status === 'Closed' ? 'active' : ''}`}
                onClick={() => changeStatusForTesting('Closed')}
              >
                Đã đóng (Closed)
              </button>
            </div>
          </div>
        )}

        {/* 2. LOGIC TRƯỜNG HỢP ĐẶC BIỆT 1: HIỂN THỊ KHẢO SÁT HÀI LÒNG KHI PHIẾU ĐÃ GIẢI QUYẾT */}
        {ticket.status === 'Resolved' && (
          <div className="survey-banner">
            <h3 className="survey-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              Khảo sát mức độ hài lòng về chất lượng hỗ trợ (UC-04)
            </h3>
            
            <form onSubmit={handleSurveySubmit} className="survey-body">
              {/* Token xác thực khảo sát */}
              {!tokenFromUrl && (
                <div className="survey-question-group">
                  <span className="survey-question-text" style={{ fontWeight: 600 }}>Mã token khảo sát <span style={{ color: '#DC2626' }}>*</span></span>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: token_t1 hoặc nhập token từ email..."
                    value={surveyToken}
                    onChange={(e) => setSurveyToken(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 12px', border: '1px solid #D1D5DB',
                      borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', marginTop: '6px'
                    }}
                  />
                  <small style={{ color: '#64748B', display: 'block', marginTop: '4px' }}>
                    * Nhận mã token xác minh khảo sát từ email của bạn.
                  </small>
                </div>
              )}

              {/* Câu hỏi hài lòng */}
              <div className="survey-question-group">
                <span className="survey-question-text">Bạn có hài lòng với kết quả xử lý sự cố này không? <span style={{ color: '#DC2626' }}>*</span></span>
                <div className="survey-toggle-buttons">
                  <button
                    type="button"
                    className={`btn-survey-toggle ${isSatisfied === true ? 'active-yes' : ''}`}
                    onClick={() => setIsSatisfied(true)}
                  >
                    Có, tôi hài lòng
                  </button>
                  <button
                    type="button"
                    className={`btn-survey-toggle ${isSatisfied === false ? 'active-no' : ''}`}
                    onClick={() => setIsSatisfied(false)}
                  >
                    Không, tôi chưa hài lòng
                  </button>
                </div>
              </div>

              {/* Đánh giá sao */}
              <div className="survey-question-group">
                <span className="survey-question-text">Đánh giá độ hài lòng của bạn (1 - 5 sao):</span>
                <div className="survey-rating-stars">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`star-btn ${star <= ratingStars ? 'active' : ''}`}
                      onClick={() => setRatingStars(star)}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nhận xét / Lý do bắt buộc */}
              <div className="survey-question-group">
                <span className="survey-question-text">
                  Ý kiến đóng góp {isSatisfied === false && <span style={{ color: '#DC2626' }}>(Bắt buộc nhập lý do chưa hài lòng) *</span>}:
                </span>
                <textarea
                  className="survey-textarea"
                  placeholder={isSatisfied === false ? "Vui lòng ghi rõ lý do sự cố chưa được giải quyết triệt để hoặc các điểm IT cần cải thiện..." : "Nhập nhận xét hoặc lời nhắn gửi bộ phận hỗ trợ IT (tùy chọn)..."}
                  value={surveyComment}
                  onChange={(e) => setSurveyComment(e.target.value)}
                ></textarea>
              </div>

              {surveyError && (
                <div style={{ color: '#DC2626', fontSize: '13.5px', fontWeight: 600 }}>
                  ⚠ {surveyError}
                </div>
              )}

              <button type="submit" className="btn-survey-submit" disabled={surveySubmitted}>
                {surveySubmitted ? 'Đang gửi đánh giá...' : 'Gửi đánh giá & Hoàn tất'}
              </button>
            </form>
          </div>
        )}

        {/* 3. LOGIC TRƯỜNG HỢP ĐẶC BIỆT 2: BANNER THÔNG BÁO KHI PHIẾU ĐÃ ĐÓNG */}
        {ticket.status === 'Closed' && (
          <div className="closed-banner">
            <span className="closed-banner-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
            </span>
            <span>Không có dữ liệu chỉnh sửa - Phiếu đã đóng</span>
          </div>
        )}

        {/* 5. LAYOUT 2 CỘT CHÍNH */}
        <div className="detail-main-layout">
          
          {/* Cột trái (65%): Chi tiết, Timeline, Bình luận */}
          <div className="left-column-detail">
            
            {/* 4. ĐẦU TRANG CHI TIẾT PHIẾU (TICKET SUMMARY HEADER) */}
            <div className="detail-header-card">
              <div className="header-meta-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button 
                  type="button" 
                  className="btn-back"
                  onClick={() => {
                    if (session?.ma_vai_tro === 'IT_L2') {
                      navigate('/tickets/l2');
                    } else if (session?.ma_vai_tro === 'IT_L1') {
                      navigate('/tickets/queue');
                    } else {
                      navigate('/dashboard');
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'none',
                    border: 'none',
                    color: '#64748B',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 600,
                    padding: '4px 8px',
                    borderRadius: '6px',
                    marginRight: '8px',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = '#F1F5F9';
                    e.currentTarget.style.color = '#0F172A';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#64748B';
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                  Quay lại
                </button>
                <span className="ticket-id-tag">{ticket.id}</span>
                
                {/* Status Badges */}
                {ticket.status === 'New' && <span className="badge-status-detail" style={{ backgroundColor: '#EFF6FF', color: '#1E40AF' }}>Mới tạo</span>}
                {ticket.status === 'Pending' && <span className="badge-status-detail" style={{ backgroundColor: '#FFFBEB', color: '#92400E' }}>Đang giải quyết</span>}
                {ticket.status === 'Resolved' && <span className="badge-status-detail" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>Đã giải quyết</span>}
                {ticket.status === 'Closed' && <span className="badge-status-detail" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Đã đóng</span>}
     
                {/* Priority Badges */}
                {ticket.priority === 'High' && <span className="badge-priority-detail" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>Mức độ ưu tiên: Cao</span>}
                {ticket.priority === 'Medium' && <span className="badge-priority-detail" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B' }}>Mức độ ưu tiên: Trung bình</span>}
                {ticket.priority === 'Low' && <span className="badge-priority-detail" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Mức độ ưu tiên: Thấp</span>}
              </div>
              <h1 className="detail-ticket-title">{ticket.title}</h1>
              {isRequester && (
                <div className="header-infobar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                  <span>{ticket.requesterName} đã tạo yêu cầu này qua Cổng hỗ trợ</span>
                </div>
              )}

            </div>
            {/* Chi tiết nội dung phiếu */}
            <div className="detail-card">
              <h3 className="detail-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
                Nội dung yêu cầu hỗ trợ
              </h3>
              
              <div className="ticket-info-grid">
                <div className="info-item">
                  <span className="info-label">Người gửi yêu cầu</span>
                  <span className="info-value">{ticket.requesterName} ({ticket.requesterEmail})</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Ngày tạo phiếu</span>
                  <span className="info-value">{ticket.createdAt}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Thiết bị / Phần mềm liên quan</span>
                  <span className="info-value">{ticket.deviceSoftware || 'Không khai báo'}</span>
                </div>
              </div>

              <div className="info-item" style={{ marginTop: '16px' }}>
                <span className="info-label" style={{ marginBottom: '8px' }}>Mô tả chi tiết sự cố</span>
                <div className="ticket-description-box">
                  {ticket.description}
                </div>
              </div>
            </div>

            {/* Bình luận & Cập nhật (Hoạt động) */}
            <div className="detail-card">
              <h3 className="detail-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Hoạt động (Activity)
              </h3>

              {/* Tab bộ lọc hoạt động */}
              {isRequester ? (
                <div className="activity-tabs">
                  <button
                    type="button"
                    className={`activity-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className={`activity-tab-btn ${activeTab === 'comment' ? 'active' : ''}`}
                    onClick={() => setActiveTab('comment')}
                  >
                    Bình luận
                  </button>
                  <button
                    type="button"
                    className={`activity-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                  >
                    Lịch sử thay đổi
                  </button>
                </div>
              ) : isTechnicianOrAdmin ? (
                <div className="activity-tabs">
                  <button
                    type="button"
                    className={`activity-tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className={`activity-tab-btn ${activeTab === 'comment' ? 'active' : ''}`}
                    onClick={() => setActiveTab('comment')}
                  >
                    Bình luận công khai
                  </button>
                  <button
                    type="button"
                    className={`activity-tab-btn ${activeTab === 'internal' ? 'active' : ''}`}
                    onClick={() => setActiveTab('internal')}
                  >
                    Ghi chú nội bộ
                  </button>
                  <button
                    type="button"
                    className={`activity-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                  >
                    Lịch sử thay đổi
                  </button>
                </div>
              ) : null}

              {/* Danh sách bình luận / hoạt động */}
              <div className="comments-list">
                {(() => {
                  // Security check: USER role cannot view internal comments
                  const visibleComments = comments.filter(c => {
                    if (c.loai_binh_luan === 'internal') {
                      return !isRequester;
                    }
                    return true;
                  });

                  // Filter comments/activities based on tab
                  const filteredComments = visibleComments.filter(c => {
                    if (activeTab === 'comment') return c.loai_binh_luan !== 'internal';
                    if (activeTab === 'internal') return c.loai_binh_luan === 'internal';
                    return true;
                  }).map(c => ({ ...c, type: 'comment' as const }));

                  const filteredTimeline = timeline.map(t => ({ ...t, type: 'history' as const }));

                  let listToRender: any[] = [];
                  if (activeTab === 'comment' || activeTab === 'internal') {
                    listToRender = filteredComments;
                  } else if (activeTab === 'history') {
                    listToRender = filteredTimeline;
                  } else {
                    listToRender = [
                      ...filteredComments,
                      ...filteredTimeline
                    ].sort((a, b) => a.timestamp - b.timestamp);
                  }

                  return listToRender.map((item, itemIdx) => {
                    if (item.type === 'comment') {
                      const isInternal = item.loai_binh_luan === 'internal';
                      return (
                        <div key={`comment-${item.id}-${itemIdx}`} className={`comment-card ${isInternal ? 'is-internal-note' : ''}`}>
                          <img
                            src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.author)}&backgroundColor=${isInternal ? 'F59E0B' : item.isItSupport ? '2563EB' : '64748B'}&textColor=ffffff`}
                            alt="Avatar"
                            className="comment-avatar"
                          />
                          <div className={`comment-bubble ${isInternal ? 'is-internal' : item.isItSupport ? 'is-it-support' : ''}`}>
                            <div className="comment-meta-row">
                              <div>
                                <span className="comment-author">{item.author}</span>
                                <span 
                                  className="comment-role-tag" 
                                  style={{ 
                                    backgroundColor: isInternal ? '#FEF3C7' : item.isItSupport ? '#EFF6FF' : '#F1F5F9', 
                                    color: isInternal ? '#D97706' : item.isItSupport ? '#2563EB' : '#475569' 
                                  }}
                                >
                                  {isInternal ? 'Ghi chú nội bộ' : item.role}
                                </span>
                              </div>
                              <span className="comment-date">{item.date}</span>
                            </div>
                            <p className="comment-text">{item.text}</p>
                            {item.attachments && (
                              <div className="comment-attachments">
                                {item.attachments.map((file: any, fileIdx: number) => (
                                  <span key={fileIdx} className="comment-attachment-file">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                                    </svg>
                                    {file.name} ({file.size})
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      const statusInfo = mapTimelineStatus(item.status);
                      return (
                        <div key={`log-${item.timestamp}-${itemIdx}`} className="system-activity-card" style={{ borderLeftColor: statusInfo.color }}>
                          <div className="system-activity-icon" style={{ color: statusInfo.color }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                            </svg>
                          </div>
                          <div className="system-activity-content">
                            <strong>{item.executor}</strong> đã thực hiện: <span className="system-activity-status" style={{ color: statusInfo.color }}>{statusInfo.label}</span> <span className="system-activity-note">({item.note})</span>
                          </div>
                          <span className="system-activity-date">{item.date}</span>
                        </div>
                      );
                    }
                  });
                })()}
              </div>

              {/* Form gửi bình luận (Ẩn/khóa nếu phiếu đã đóng hoặc đang ở tab Lịch sử thay đổi) */}
              {(!isRequester || activeTab !== 'history') ? (
                <form onSubmit={handleSendComment} className={`comment-input-area ${isTechnicianOrAdmin && activeTab === 'internal' ? 'internal-note-active' : ''}`}>
                  <textarea
                    className="comment-textarea"
                    placeholder={
                      ticket.status === 'Closed' 
                        ? "Không thể gửi bình luận - Phiếu đã đóng hoàn toàn." 
                        : isTechnicianOrAdmin && activeTab === 'internal'
                          ? "Nhập ghi chú nội bộ (chỉ các kỹ thuật viên IT và Admin có thể xem)..."
                          : "Viết nội dung phản hồi, thắc mắc hoặc cập nhật sự cố của bạn tại đây..."
                    }
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={ticket.status === 'Closed' || isLoading}
                  ></textarea>

                  {/* File selector input */}
                  <input
                    type="file"
                    ref={commentFileInputRef}
                    onChange={handleFileSelectComment}
                    style={{ display: 'none' }}
                    multiple
                  />

                  {/* Danh sách tệp đính kèm bình luận đang soạn */}
                  {commentAttachedFiles.length > 0 && (
                    <div className="comment-attachments" style={{ padding: '0 8px' }}>
                      {commentAttachedFiles.map((file, idx) => (
                        <span key={idx} className="comment-attachment-file" style={{ backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                          </svg>
                          {file.name} ({Math.round(file.size / 1024)} KB)
                          <button
                            type="button"
                            style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '0 2px', marginLeft: '4px' }}
                            onClick={() => {
                              const updated = [...commentAttachedFiles];
                              updated.splice(idx, 1);
                              setCommentAttachedFiles(updated);
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="comment-actions-bar">
                    <button
                      type="button"
                      className="btn-comment-attach"
                      onClick={handleAttachFileComment}
                      disabled={ticket.status === 'Closed' || isLoading}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                      </svg>
                      Đính kèm tệp tin
                    </button>
                    
                    {ticket.status !== 'Closed' && (
                      <button
                        type="submit"
                        className="btn-comment-submit"
                        disabled={isLoading || (!newComment.trim() && commentAttachedFiles.length === 0)}
                        style={{
                          backgroundColor: isTechnicianOrAdmin && activeTab === 'internal' ? '#D97706' : '#2563EB'
                        }}
                      >
                        {isTechnicianOrAdmin && activeTab === 'internal' ? 'Lưu ghi chú nội bộ' : 'Gửi bình luận'}
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="activity-history-placeholder">
                  Chuyển sang tab <strong>Bình luận</strong> hoặc <strong>Tất cả</strong> để gửi phản hồi công khai cho IT Support.
                </div>
              )}
            </div>

          </div>

          {/* Cột phải (35%): Panel Trạng thái, Hạn SLA, Người xử lý, Thẻ liên quan */}
          <div className="right-column-detail">
            
            {/* 1. Dropdown Trạng thái & Nút Chuyển cấp (Chỉ cho IT_L1/IT_L2/QUAN_LY) */}
            {isTechnicianOrAdmin && (
              <div className="sla-countdown-card status-actions-widget">
                <div className="sla-countdown-label" style={{ marginBottom: '12px' }}>Trạng thái & Thao tác</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
                  
                  {/* Status Dropdown */}
                  <div className="status-dropdown-wrapper">
                    <button
                      type="button"
                      className="btn-status-dropdown"
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    >
                      <span>Trạng thái: {
                        ticket.status === 'New' ? 'Mới tạo' :
                        ticket.status === 'Pending' ? 'Đang giải quyết' :
                        ticket.status === 'Resolved' ? 'Đã giải quyết' : 'Đã đóng'
                      }</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    {showStatusDropdown && (
                      <div className="status-dropdown-menu">
                        <div className="dropdown-item" onClick={() => handleUpdateStatus('New')}>🆕 Mới tiếp nhận</div>
                        <div className="dropdown-item" onClick={() => handleUpdateStatus('Pending')}>⚙️ Đang giải quyết</div>
                        <div className="dropdown-item" onClick={() => handleUpdateStatus('Resolved')}>✅ Đã giải quyết</div>
                        <div className="dropdown-item" onClick={() => handleUpdateStatus('Closed')}>🔒 Đã đóng</div>
                      </div>
                    )}
                  </div>

                  {/* Escalate button (only for IT_L1) */}
                  {session?.ma_vai_tro === 'IT_L1' && (
                    <button
                      type="button"
                      className="btn-escalate-action"
                      onClick={handleOpenEscalateModal}
                      disabled={isLoading}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="18 15 12 9 6 15"></polyline>
                      </svg>
                      CHUYỂN CẤP XỬ LÝ (ESCALATE)
                    </button>
                  )}


                  
                </div>
              </div>
            )}

            {/* 2. Hạn cam kết xử lý SLA (Đếm ngược) */}
            <div className="sla-countdown-card">
              <div className="sla-countdown-label">Hạn hoàn thành xử lý (SLA)</div>
              {ticket.status === 'Resolved' || ticket.status === 'Closed' ? (
                <div>
                  <span className="sla-countdown-time" style={{ color: '#16A34A' }}>Đạt SLA ✓</span>
                  <div className="sla-countdown-desc">Phiếu hỗ trợ đã được kỹ thuật viên xử lý đúng hạn cam kết dịch vụ (SLA).</div>
                  <div className="sla-static-deadline" style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: '#475569', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                    {(() => {
                      const d = new Date(ticket.slaDeadline);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      return `Hạn chót: ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                    })()}
                  </div>
                </div>
              ) : (
                <div>
                  {formatSLA(timeLeft)}
                  <div className="sla-countdown-desc">
                    Thời gian còn lại để IT Support L1/L2 xử lý và phản hồi sự cố theo đúng quy trình vận hành.
                  </div>
                  <div className="sla-static-deadline" style={{ marginTop: '10px', fontSize: '13px', fontWeight: 600, color: '#334155', borderTop: '1px solid #F1F5F9', paddingTop: '8px' }}>
                    {(() => {
                      const d = new Date(ticket.slaDeadline);
                      const pad = (n: number) => String(n).padStart(2, '0');
                      return `Hạn chót: ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Thông tin chi tiết */}
            <div className="sla-countdown-card details-widget-card">
              <div className="sla-countdown-label" style={{ marginBottom: '16px' }}>Thông tin chi tiết</div>
              <div className="details-widget-rows" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                
                {/* Row 1: Assignee */}
                <div className="details-widget-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="details-row-label" style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Kỹ thuật viên phụ trách</span>
                  <div className="details-row-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(ticket.assignee)}&backgroundColor=2563EB&textColor=ffffff`}
                      alt="Assignee Avatar"
                      className="comment-avatar"
                      style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    />
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0F172A' }}>{ticket.assignee}</span>
                  </div>
                </div>

                {/* Row 2: Reporter */}
                <div className="details-widget-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="details-row-label" style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Người gửi yêu cầu</span>
                  <div className="details-row-value" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(ticket.requesterName)}&backgroundColor=475569&textColor=ffffff`}
                      alt="Reporter Avatar"
                      className="comment-avatar"
                      style={{ width: '28px', height: '28px', borderRadius: '50%' }}
                    />
                    <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#0F172A' }}>{ticket.requesterName}</span>
                  </div>
                </div>

                {/* Row 3: Priority */}
                <div className="details-widget-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span className="details-row-label" style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Mức độ ưu tiên</span>
                  <div className="details-row-value">
                    {ticket.priority === 'High' && <span className="badge-priority-detail" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', fontSize: '12px', padding: '3px 8px', borderRadius: '9999px', fontWeight: 600 }}>Cao</span>}
                    {ticket.priority === 'Medium' && <span className="badge-priority-detail" style={{ backgroundColor: '#FFFBEB', color: '#F59E0B', fontSize: '12px', padding: '3px 8px', borderRadius: '9999px', fontWeight: 600 }}>Trung bình</span>}
                    {ticket.priority === 'Low' && <span className="badge-priority-detail" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', fontSize: '12px', padding: '3px 8px', borderRadius: '9999px', fontWeight: 600 }}>Thấp</span>}
                  </div>
                </div>

              </div>
            </div>

            {/* 4. Tệp đính kèm gốc của phiếu */}
            <div className="sla-countdown-card">
              <div className="sla-countdown-label" style={{ marginBottom: '16px' }}>Tệp đính kèm phiếu</div>
              <div className="ticket-attachments-list">
                {ticket.attachments && ticket.attachments.length > 0 ? (
                  ticket.attachments.map((file: any, fileIdx: number) => (
                    <div key={fileIdx} className="ticket-attachment-item">
                      <span className="ticket-attachment-name">{file.name}</span>
                      <span className="ticket-attachment-size">{file.size}</span>
                      <a
                        href={getFileUrl(file.duong_dan_file || file.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-download-attachment"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Tải xuống tệp"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </a>
                    </div>
                  ))
                ) : (
                  <span className="attachments-empty">Không có tệp đính kèm nào khi tạo phiếu.</span>
                )}
              </div>
            </div>

            {/* 5. Bài viết tri thức gợi ý */}
            <div className="sla-countdown-card">
              <div className="sla-countdown-label" style={{ marginBottom: '12px' }}>Bài viết tri thức gợi ý</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <a
                  href="#vpn"
                  onClick={(e) => { e.preventDefault(); alert('Đọc tài liệu về sự cố: Hướng dẫn cấu hình mạng VPN'); }}
                  style={{ fontSize: '13px', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}
                >
                  📖 Hướng dẫn tự sửa lỗi kết nối mạng VPN công ty
                </a>
                <a
                  href="#hardware"
                  onClick={(e) => { e.preventDefault(); alert('Đọc tài liệu về sự cố: Xử lý phần cứng Dell'); }}
                  style={{ fontSize: '13px', color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}
                >
                  📖 Danh sách các lỗi phần cứng thường gặp ở Dell Latitude
                </a>
              </div>
            </div>

          </div>

          {/* MODAL CHUYỂN CẤP L2 */}
          {showEscalateModal && (
            <div className="modal-overlay">
              <form onSubmit={handleConfirmEscalate} className="modal-container" style={{ maxWidth: '500px', backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
                <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                  <h3 className="modal-title" style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Yêu cầu chuyển cấp lên tuyến hỗ trợ L2</h3>
                  <button 
                    type="button" 
                    className="modal-close-btn"
                    onClick={() => setShowEscalateModal(false)}
                    style={{ background: 'none', border: 'none', fontSize: '20px', color: '#94A3B8', cursor: 'pointer' }}
                  >
                    &times;
                  </button>
                </div>

                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
                  <div className="modal-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="modal-label" style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Lý do chuyển cấp L2 <span style={{ color: '#DC2626' }}>*</span></label>
                    <textarea
                      className="modal-textarea"
                      placeholder="Ghi rõ lý do không giải quyết được (Ví dụ: Lỗi liên quan đến quyền truy cập AD Server hoặc lỗi phần cứng cần thay thế linh kiện...)"
                      value={escalateReason}
                      onChange={(e) => setEscalateReason(e.target.value)}
                      style={{ width: '100%', minHeight: '80px', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                    ></textarea>
                  </div>

                  <div className="modal-field" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="modal-label" style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Các bước L1 đã thử xử lý <span style={{ color: '#DC2626' }}>*</span></label>
                    <textarea
                      className="modal-textarea"
                      placeholder="Mô tả cụ thể các giải pháp L1 đã thực hiện (Ví dụ: Đã cài lại phần mềm, đã restart máy nhưng không hết...)"
                      value={escalateStepsTried}
                      onChange={(e) => setEscalateStepsTried(e.target.value)}
                      style={{ width: '100%', minHeight: '80px', padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                    ></textarea>
                  </div>

                  {modalError && (
                    <div className="modal-error" style={{ color: '#DC2626', fontSize: '13px', fontWeight: 600 }}>
                      ⚠ {modalError}
                    </div>
                  )}
                </div>

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #F1F5F9', paddingTop: '12px' }}>
                  <button 
                    type="button" 
                    className="btn-modal-cancel"
                    onClick={() => setShowEscalateModal(false)}
                    style={{ backgroundColor: '#F1F5F9', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Hủy bỏ
                  </button>
                  <button 
                    type="submit" 
                    className="btn-modal-submit"
                    disabled={isLoading}
                    style={{ backgroundColor: '#2563EB', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {isLoading ? 'Đang chuyển cấp...' : 'Xác nhận chuyển cấp'}
                  </button>
                </div>
              </form>
            </div>
          )}



        </div>

      </div>
    </div>
  );
};
