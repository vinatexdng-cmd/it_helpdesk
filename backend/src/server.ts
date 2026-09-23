import express from 'express';
import { createServer } from 'http'; // SỬA ĐỔI CHUẨN: Dùng http thay vì tls
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import authRoutes from './routes/auth.routes';
import ticketRoutes from './routes/ticket.routes';
import reviewRoutes from './routes/review.routes';
import kbRoutes from './routes/kb.routes';
import attachmentRoutes from './routes/attachment.routes';
import adminRoutes from './routes/admin.routes';
import slaRoutes from './routes/sla.routes';
import notificationRoutes from './routes/notification.routes';


import { errorHandler } from './middlewares/errorHandler';
import cors from 'cors';
import { initSocket } from './libs/socket';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { initCronJobs } from './jobs/cron';

const app = express();
const corsOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: corsOrigins.length > 0 ? corsOrigins : true,
  credentials: false,
}));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100, // Giới hạn 100 request/15 phút mỗi IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Quá nhiều request từ IP này, vui lòng thử lại sau 15 phút' }
});

// Health check endpoint cho Load Balancer / Docker
app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

// --- BỌC SERVER EXPRESS QUA HTTP SERVER ĐỂ CHẠY SOCKET.IO ---
const httpServer = createServer(app);

// Khởi tạo Socket.IO bọc quanh luồng HTTP của Express ngầm
initSocket(httpServer);

// --- CẤU HÌNH SWAGGER ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Hệ thống IT Helpdesk - Map Pacific Singapore',
      version: '1.0.0',
      description: 'Tài liệu API chính thức phục vụ vận hành và phân quyền hệ thống',
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        NhanVien: {
          type: 'object',
          properties: {
            nhan_vien_id: { type: 'integer', example: 2 },
            ho_ten: { type: 'string', example: 'Nguyễn Văn A' },
            email: { type: 'string', format: 'email', example: 'nguyenvana@mappacific.com' },
            tai_khoan: { type: 'string', example: 'nguyenvana' },
            trang_thai: { type: 'boolean', example: true },
            vai_tro: {
              type: 'object',
              properties: {
                vai_tro_id: { type: 'integer', example: 2 },
                ma_vai_tro: { type: 'string', example: 'IT_L1' },
                ten_vai_tro: { type: 'string', example: 'IT Support L1' },
              },
            },
            phong_ban: {
              type: 'object',
              properties: {
                phong_ban_id: { type: 'integer', example: 1 },
                ten_phong_ban: { type: 'string', example: 'Information Technology' },
              },
            },
            nhom_ho_tro: {
              type: 'object',
              nullable: true,
              properties: {
                nhom_ho_tro_id: { type: 'integer', example: 1 },
                ten_nhom: { type: 'string', example: 'IT Support L1 — Helpdesk' },
              },
            },
            nhom_ho_tro_id: { type: 'integer', nullable: true, example: 1 },
          },
        },
        VaiTro: {
          type: 'object',
          properties: {
            vai_tro_id: { type: 'integer', example: 1 },
            ma_vai_tro: { type: 'string', example: 'NGUOI_YEU_CAU' },
            ten_vai_tro: { type: 'string', example: 'Người yêu cầu' },
            quyen_han: {
              type: 'array',
              items: { type: 'string' },
              example: ['ticket:create', 'ticket:view_own', 'kb:view'],
            },
          },
        },
        NhomHoTro: {
          type: 'object',
          properties: {
            nhom_ho_tro_id: { type: 'integer', example: 1 },
            ten_nhom: { type: 'string', example: 'IT Support L1 — Helpdesk' },
            mo_ta: { type: 'string', example: 'Tuyến hỗ trợ đầu tiên' },
            so_thanh_vien: { type: 'integer', example: 3 },
            thanh_vien: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  nhan_vien_id: { type: 'integer', example: 2 },
                  ho_ten: { type: 'string', example: 'Alicia Lim Siu Yin' },
                  email: { type: 'string', example: 'huyentld23406@st.uel.edu.vn' },
                },
              },
            },
          },
        },
        PhongBan: {
          type: 'object',
          properties: {
            phong_ban_id: { type: 'integer', example: 1 },
            ten_phong_ban: { type: 'string', example: 'Information Technology' },
            so_nhan_vien: { type: 'integer', example: 5 },
            truong_phong: { type: 'string', nullable: true, example: 'Phạm Quang Thắng' },
          },
        },
        PhieuHoTro: {
          type: 'object',
          properties: {
            phieu_ho_tro_id: { type: 'integer', example: 9 },
            ma_phieu: { type: 'string', example: 'SW-2026-0001' },
            tieu_de: { type: 'string', example: 'Máy in phòng xuất nhập khẩu bị kẹt giấy' },
            mo_ta_chi_tiet: { type: 'string', example: 'Máy in HP không kéo được giấy...' },
            muc_do_uu_tien: {
              type: 'string',
              enum: ['THAP', 'TRUNG_BINH', 'CAO'],
              example: 'TRUNG_BINH',
            },
            trang_thai: {
              type: 'string',
              enum: ['MOI_TAO', 'DANG_GIAI_QUYET', 'DA_GIAI_QUYET', 'DA_DONG'],
              example: 'MOI_TAO',
            },
            so_lan_mo_lai: { type: 'integer', example: 0 },
            ngay_tao: { type: 'string', format: 'date-time', example: '2026-05-26T00:34:00.000Z' },
            ngay_cap_nhat: { type: 'string', format: 'date-time', example: '2026-05-26T01:00:00.000Z' },
            nguoi_tao: {
              type: 'object',
              properties: {
                ho_ten: { type: 'string', example: 'Nhân viên sales 1' },
                email: { type: 'string', example: 'sales1@mappacific.com' },
              },
            },
            nguoi_ho_tro: {
              type: 'object',
              nullable: true,
              properties: {
                ho_ten: { type: 'string', example: 'Alicia Lim Siu Yin' },
              },
            },
            nhom_xu_ly: {
              type: 'object',
              nullable: true,
              properties: {
                ten_nhom: { type: 'string', example: 'IT Support L1 — Helpdesk' },
              },
            },
          },
        },
        Comment: {
          type: 'object',
          properties: {
            binh_luan_id: { type: 'integer', example: 55 },
            noi_dung: { type: 'string', example: 'Đã kiểm tra và xử lý xong.' },
            loai_binh_luan: { type: 'string', enum: ['THUONG', 'KET_QUA', 'CHUYEN_CAP'], example: 'THUONG' },
            quyen_xem: { type: 'string', enum: ['CONG_KHAI', 'NOI_BO'], example: 'CONG_KHAI' },
            ngay_tao: { type: 'string', format: 'date-time', example: '2026-05-26T00:34:00.000Z' },
            nguoi_gui: {
              type: 'object',
              properties: {
                ho_ten: { type: 'string', example: 'Alicia Lim Siu Yin' },
              },
            },
            danh_sach_file: {
              type: 'array',
              items: { '$ref': '#/components/schemas/TepDinhKem' },
            },
          },
        },
        LichSuPhieu: {
          type: 'object',
          properties: {
            lich_su_id: { type: 'integer', example: 1 },
            hanh_dong: {
              type: 'string',
              enum: ['CREATED', 'STATUS_CHANGED', 'ESCALATED', 'REOPENED', 'REASSIGNED', 'CLOSED'],
              example: 'STATUS_CHANGED',
            },
            gia_tri_cu: { type: 'string', nullable: true, example: 'MOI_TAO' },
            gia_tri_moi: { type: 'string', nullable: true, example: 'DANG_GIAI_QUYET' },
            ghi_chu: { type: 'string', nullable: true, example: 'Đã tiếp nhận phiếu' },
            ngay_thuc_hien: { type: 'string', format: 'date-time', example: '2026-05-26T00:34:00.000Z' },
            nguoi_thuc_hien: {
              type: 'object',
              nullable: true,
              properties: {
                ho_ten: { type: 'string', example: 'Alicia Lim Siu Yin' },
              },
            },
          },
        },
        TepDinhKem: {
          type: 'object',
          properties: {
            tep_dinh_kem_id: { type: 'integer', example: 10 },
            ten_tep: { type: 'string', example: 'screenshot.png' },
            duong_dan_file: { type: 'string', example: '/uploads/tickets/abc123.png' },
            dinh_dang: { type: 'string', example: 'PNG' },
            dung_luong_kb: { type: 'integer', example: 245 },
          },
        },
        CoSoTriThuc: {
          type: 'object',
          properties: {
            tri_thuc_id: { type: 'integer', example: 1 },
            tieu_de: { type: 'string', example: 'Hướng dẫn tự reset mật khẩu' },
            noi_dung: { type: 'string', example: 'Bước 1: Truy cập trang...' },
            loai_su_co: { type: 'string', example: 'account_access' },
            the_tags: { type: 'string', example: '["password", "reset"]' },
            trang_thai: { type: 'string', enum: ['NHAP', 'DA_XUAT_BAN'], example: 'DA_XUAT_BAN' },
            quyen_xem: { type: 'string', enum: ['CONG_KHAI', 'NOI_BO'], example: 'CONG_KHAI' },
            luot_xem: { type: 'integer', example: 183 },
            luot_huu_ich: { type: 'integer', example: 47 },
            ngay_tao: { type: 'string', format: 'date-time', example: '2026-05-01T00:00:00.000Z' },
            ngay_cap_nhat: { type: 'string', format: 'date-time', example: '2026-05-26T00:00:00.000Z' },
            tac_gia: {
              type: 'object',
              properties: {
                ho_ten: { type: 'string', example: 'Michael Chen Jian Hao' },
              },
            },
          },
        },
        ChinhSachSla: {
          type: 'object',
          properties: {
            chinh_sach_sla_id: { type: 'integer', example: 1 },
            ten_chinh_sach: { type: 'string', example: 'SLA Ưu tiên Cao - Giờ hành chính' },
            loai_thoi_gian: { type: 'string', enum: ['GIO_HANH_CHINH', 'H24_7'], example: 'GIO_HANH_CHINH' },
            muc_do_uu_tien: { type: 'string', enum: ['THAP', 'TRUNG_BINH', 'CAO'], example: 'CAO' },
            tg_phan_hoi: { type: 'integer', description: 'Phút', example: 60 },
            tg_xu_ly: { type: 'integer', description: 'Phút', example: 240 },
            trang_thai: { type: 'boolean', description: 'true = đang active', example: true },
          },
        },
      },
    },
    // Áp dụng nút khóa cho tất cả các endpoint hiển thị
    security: [{ BearerAuth: [] }],
    servers: [
      {
        url: process.env.PUBLIC_API_URL ?? 'http://localhost:3000', // Public API URL for Swagger
        description: 'Development Server',
      },
    ],
  },
  // Đường dẫn đến các file chứa comment Swagger (quét tất cả file trong thư mục routes)
  apis: ['./src/routes/*.ts', './routes/*.js'], 
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
// Tạo đường dẫn giao diện test: http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));


// --- ĐĂNG KÝ ROUTES ---
app.use('/api/v1/auth', apiLimiter, authRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/kb', kbRoutes);
app.use('/api/v1/attachments', attachmentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/sla', slaRoutes);
app.use('/api/v1/notifications', notificationRoutes);

// --- MIDDLEWARE XỬ LÝ LỖI TRUNG TÂM (LUÔN ĐỂ CUỐI CÙNG) ---
app.use(errorHandler);

// --- KÍCH HOẠT MỞ CỔNG SERVER (CHẠY QUA HTTP_SERVER CHỨ KHÔNG DÙNG APP.LISTEN) ---
const PORT = process.env.PORT || 3000;

initCronJobs(); // Kích hoạt Background Jobs

httpServer.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`SERVER ĐÃ KHỞI ĐỘNG THÀNH CÔNG VỚI REALTIME SOCKET.IO!`);
  console.log(`🔗 Link test API Swagger: ${(process.env.PUBLIC_API_URL ?? `http://localhost:${PORT}`)}/api-docs`);
  console.log(`====================================================`);
});

export default app;