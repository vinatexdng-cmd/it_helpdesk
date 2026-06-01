// src/validations/ticket.schema.ts
import { z } from 'zod';
import { TrangThaiPhieu, MucDoUuTien, MucDoAnhHuong, MucDoKhanCap } from '@prisma/client';

export const createTicketSchema = z.object({
  tieu_de: z.string().min(5, 'Tiêu đề phải có ít nhất 5 ký tự'),
  mo_ta_chi_tiet: z.string().min(10, 'Mô tả phải có ít nhất 10 ký tự'),
  muc_do_anh_huong: z.enum(Object.values(MucDoAnhHuong) as [string, ...string[]], {
    message: 'Mức độ ảnh hưởng không hợp lệ'
  }).optional(),
  muc_do_khan_cap: z.enum(Object.values(MucDoKhanCap) as [string, ...string[]], {
    message: 'Mức độ khẩn cấp không hợp lệ'
  }).optional()
});

export const updateTicketStatusSchema = z.object({
  // Đổi thành thuộc tính message để Zod khớp overload hoàn chỉnh
  trang_thai: z.enum(Object.values(TrangThaiPhieu) as [string, ...string[]], {
    message: 'Trạng thái chuyển đổi Workflow không hợp lệ'
  }),
  ghi_chu: z.string().optional()
});

export const getTicketsQuerySchema = z.object({
  // Kiểm soát nghiêm ngặt page: ép về Number, nếu nhỏ hơn 1 thì báo lỗi trực tiếp cho Client
  page: z.string().optional()
    .transform(val => (val ? Number(val) : 1))
    .pipe(z.number().min(1, 'Số trang (page) không được nhỏ hơn 1')),
    
  // Kiểm soát nghiêm ngặt limit: ép về Number, giá trị nằm trong khoảng từ 1 đến 1000 bản ghi
  limit: z.string().optional()
    .transform(val => (val ? Number(val) : 100))
    .pipe(z.number().min(1, 'Số lượng dòng (limit) phải lớn hơn hoặc bằng 1').max(1000, 'Không được lấy quá 1000 dòng một lần')),
  
  trang_thai: z.enum(Object.values(TrangThaiPhieu) as [string, ...string[]], {
    message: 'Trạng thái lọc dữ liệu không đúng định dạng'
  }).optional(),
  
  muc_do_uu_tien: z.enum(Object.values(MucDoUuTien) as [string, ...string[]], {
    message: 'Mức độ ưu tiên lọc dữ liệu không hợp lệ'
  }).optional(),
  
  keyword: z.string().optional(),
});

// Schema cho API-10: Chuyển cấp
export const escalateSchema = z.object({
  ly_do: z.string().min(10, 'Lý do chuyển cấp phải từ 10 ký tự trở lên'),
  cac_buoc_da_thu: z.string().min(10, 'Vui lòng mô tả các bước đã thử xử lý')
});

// Schema cho API-11: Mở lại ticket
export const reopenSchema = z.object({
  ly_do: z.string().min(5, 'Vui lòng nhập lý do mở lại ticket')
});

// Schema cho API-12: Bình luận
export const commentSchema = z.object({
  noi_dung: z.string().min(1, 'Nội dung bình luận không được để trống'),
  loai_binh_luan: z.enum(['public', 'internal'] as const, {
    message: "Loại bình luận phải là 'public' hoặc 'internal'"
  })
});

// Schema cho API-13: Lấy danh sách bình luận (có thể tái sử dụng page/limit)
export const getCommentsQuerySchema = z.object({
  page: z.string().optional()
    .transform(val => (val ? Number(val) : 1))
    .pipe(z.number().min(1, 'Số trang (page) không được nhỏ hơn 1')),
  limit: z.string().optional()
    .transform(val => (val ? Number(val) : 10))
    .pipe(z.number().min(1, 'Số lượng dòng (limit) phải lớn hơn hoặc bằng 1').max(100)),
});

// Schema cho API-15: Quản lý gán lại Ticket
export const assignSchema = z.object({
  nguoi_ho_tro_id: z.number({
    message: "ID kỹ thuật viên phải là định dạng số và không được để trống"
  }).min(1, "ID kỹ thuật viên không hợp lệ")
});