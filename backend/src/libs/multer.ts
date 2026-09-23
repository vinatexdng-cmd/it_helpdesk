// src/libs/multer.ts
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppError } from '../middlewares/errorHandler';

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
  const allowedExtensions = /jpeg|jpg|png|pdf|docx|xlsx/;
  const allowedMimeTypes = [
    'image/jpeg', 'image/png',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  const extName = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimeTypeValid = allowedMimeTypes.includes(file.mimetype);

  if (extName && mimeTypeValid) return callback(null, true);

  callback(new AppError('File không hợp lệ! Hệ thống chỉ chấp nhận định dạng jpg, png, pdf, docx, xlsx', 400));
};

export const uploadTicketFiles = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter,
});

/**
 * Lưu file upload vào persistent storage.
 * UPLOAD_DIR có thể trỏ tới Render Persistent Disk (ví dụ /var/data/uploads).
 */
export const saveMemoryFileToDisk = (
  file: any,
  subFolder: 'attachments' | 'kb' = 'attachments'
): {
  ten_tep: string;
  duong_dan_file: string;
  dinh_dang: string;
  dung_luong_kb: number;
} => {
  const uploadRoot = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
  const targetDir = path.join(uploadRoot, subFolder);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const ext = path.extname(file.originalname).toLowerCase();
  const uniqueFileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${crypto.randomUUID()}${ext}`;
  const fullPath = path.join(targetDir, uniqueFileName);

  fs.writeFileSync(fullPath, file.buffer);

  return {
    ten_tep: file.originalname,
    duong_dan_file: `/uploads/${subFolder}/${uniqueFileName}`,
    dinh_dang: ext.replace('.', ''),
    dung_luong_kb: Math.round(file.size / 1024)
  };
};
