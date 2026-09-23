import express from 'express';
import { createServer } from 'http';
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
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Quá nhiều request từ IP này, vui lòng thử lại sau 15 phút' }
});

app.get('/health', (req, res) => res.status(200).json({ status: 'OK' }));

const httpServer = createServer(app);
initSocket(httpServer);

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
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
    servers: [
      {
        url: process.env.PUBLIC_API_URL ?? 'http://localhost:3000',
        description: 'API Server',
      },
    ],
  },
  apis: ['./src/routes/*.ts', './routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/v1/auth', apiLimiter, authRoutes);
app.use('/api/v1/tickets', ticketRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/kb', kbRoutes);
app.use('/api/v1/attachments', attachmentRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/sla', slaRoutes);
app.use('/api/v1/notifications', notificationRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
initCronJobs();

httpServer.listen(PORT, () => {
  console.log('====================================================');
  console.log('SERVER ĐÃ KHỞI ĐỘNG THÀNH CÔNG VỚI REALTIME SOCKET.IO!');
  console.log(`🔗 Link test API Swagger: ${process.env.PUBLIC_API_URL ?? `http://localhost:${PORT}`}/api-docs`);
  console.log('====================================================');
});

export default app;
