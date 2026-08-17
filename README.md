# Hệ thống Quản lý & Phân công Công việc — Phân Hiệu Y Hà Nội tại tỉnh Thanh Hóa

Web app phân bổ, theo dõi và báo cáo tiến độ công việc theo mô hình Kanban, với 4 vai trò,
cơ chế 1 người có thể kiêm nhiều vai trò (nhiều phòng) cùng lúc, trích xuất nhiệm vụ tự động
từ biên bản họp, hỗ trợ nhiệm vụ liên phòng, và thông báo qua email.

## Công nghệ

- **Next.js 16** (App Router, TypeScript, Tailwind CSS v4)
- **PostgreSQL** + **Drizzle ORM** (không dùng Prisma vì môi trường build sandbox chặn tải
  engine binary của Prisma; Drizzle là pure-JS nên không gặp vấn đề này và cũng nhẹ hơn khi
  deploy serverless/Render)
- Xác thực tự viết bằng **JWT (jose) + bcrypt**, cookie `httpOnly`
- Kéo-thả Kanban bằng HTML5 Drag & Drop API (không phụ thuộc thư viện ngoài)
- Gửi email bằng **nodemailer** qua SMTP thông thường (không khoá vào 1 nhà cung cấp)

## Luồng nghiệp vụ chính

1. Sau cuộc họp chủ chốt, **Thư kí phân hiệu** gõ (hoặc dán) trực tiếp nội dung biên bản họp
   vào hệ thống, dùng tính năng **trích xuất nhiệm vụ tự động** để tách từng đầu việc và tự
   nhận diện (các) Phòng phụ trách, rà soát/sửa lại nếu cần, rồi **gửi thẳng cho các Phòng**
   ngay sau khi họp xong — hệ thống tự gửi email thông báo tới Trưởng phòng liên quan.
2. **Trưởng phòng** nhận nhiệm vụ, tự chia nhỏ thành các **Nhiệm vụ cấp Phòng** và tự quản
   lý toàn bộ tiến độ bằng Kanban của phòng mình (Cần làm → Đang thực hiện → Hoàn thành) —
   không có bước "chờ duyệt" vì không còn ai nộp việc lên để duyệt nữa.
3. **Ban giám đốc** theo dõi tiến độ toàn phân hiệu qua báo cáo tổng hợp; kênh rà soát chính
   là thông qua Thư kí phân hiệu.
4. **Admin** có thể sửa phân quyền (vai trò + phạm vi phòng) của bất kỳ tài khoản nào ngay
   trong trang Quản trị người dùng, không cần can thiệp database.

> Phiên bản trước có thêm Thư kí phòng, Trưởng nhóm, Chuyên viên (phân cấp 3 tầng dưới
> Phòng). Theo yêu cầu, 3 vai trò này đã được lược bỏ — hệ thống chỉ còn 2 cấp nhiệm vụ
> (Phân hiệu → Phòng) và Trưởng phòng tự xử lý phần việc còn lại của phòng mình.

## Trích xuất nhiệm vụ từ biên bản họp (quy tắc, KHÔNG dùng AI/LLM)

Ở trang **Biên bản họp**, Thư kí phân hiệu gõ nội dung theo quy ước: mỗi đầu việc một dòng,
**mã viết tắt của (các) Phòng phụ trách đặt trong ngoặc đơn ở cuối câu**. Ví dụ:

```
1. Rà soát chương trình đào tạo và lịch giảng dạy học kỳ mới trước 25/8 (QLDT).
2. Chuẩn bị hồ sơ, quy chế chi tiêu nội bộ, phối hợp cung cấp số liệu (TCHCQT, TCKT).
3. Xây dựng kế hoạch tự đánh giá chất lượng giáo dục năm học mới (KTDBCL).
```

Bấm **Trích xuất nhiệm vụ** → hệ thống tự tách từng dòng thành 1 nhiệm vụ, nhận diện mã
Phòng trong ngoặc (hỗ trợ nhiều mã cách nhau bởi dấu phẩy/`;`/`&`/"và" → **nhiệm vụ liên
phòng**), và hiển thị màn hình rà soát để sửa tiêu đề/ưu tiên/hạn hoàn thành, đổi Phòng phụ
trách, hoặc loại bỏ dòng không phải nhiệm vụ trước khi gửi.

Những dòng không có ngoặc hoặc mã không khớp Phòng nào được liệt kê riêng ở mục **"Dòng bị bỏ
qua"** kèm lý do, để Thư kí phân hiệu tự bổ sung tay thay vì bị âm thầm bỏ sót.

**Lưu ý quan trọng**: đây là bộ tách theo **quy tắc cố định** (regex + so khớp mã Phòng),
*không* gọi ra ngoài tới một mô hình AI/LLM nào — chọn cách này vì quy tắc do người dùng đưa
ra vốn đã xác định 100% (mã Phòng luôn nằm cuối câu, trong ngoặc), nên xử lý bằng quy tắc cho
kết quả ổn định tuyệt đối, không tốn chi phí gọi API, và không có rủi ro "bịa" nhiệm vụ.

## Nhiệm vụ liên phòng (nhiều Phòng cùng phối hợp)

Một nhiệm vụ cấp Phân hiệu có thể gắn với **nhiều Phòng** cùng lúc (bảng liên kết
`task_departments`). Khi đó:

- Mỗi Trưởng phòng liên quan đều thấy nhiệm vụ này trong danh sách "Nhiệm vụ Phân hiệu giao"
  của mình, có nhãn **"Liên phòng"** và danh sách các Phòng cùng phối hợp.
- Trong báo cáo thống kê, một nhiệm vụ liên phòng được tính vào số liệu của **từng** Phòng
  liên quan (không bị đếm trùng ở tổng số nhưng vẫn phản ánh đúng khối lượng của mỗi Phòng).
- Khi tạo nhiệm vụ cấp Phân hiệu thủ công (không qua trích xuất), có thể tick chọn nhiều
  Phòng cùng lúc ở form tạo mới.

## Bảng phân quyền (RBAC)

Nguồn duy nhất của toàn bộ ma trận quyền nằm ở [`src/lib/rbac-config.ts`](src/lib/rbac-config.ts)
— cả API (chặn ở server) và Sidebar (hiển thị menu) đều đọc từ đây nên không thể lệch nhau.

| Vai trò | Biên bản họp | Nhiệm vụ cấp Phân hiệu | Nhiệm vụ cấp Phòng | Báo cáo & Thống kê | Người dùng |
|---|---|---|---|---|---|
| **Admin** | Xem | Xem | Xem | Xem toàn hệ thống | Tạo tài khoản + **sửa phân quyền** |
| **Ban giám đốc** | Xem, bình luận | Xem, bình luận | Xem | Xem toàn phân hiệu | — |
| **Thư kí phân hiệu** | Tạo, trích xuất, gửi, bình luận | Tạo, giao việc, xem, bình luận | Xem | Xem toàn phân hiệu | — |
| **Trưởng phòng** | — | Xem, cập nhật trạng thái | Tạo, giao việc, xem, cập nhật, bình luận | Xem phạm vi phòng mình | — |

Trưởng phòng gắn **phạm vi** (department) trong bảng `user_roles`; Admin/BGD/TKPH có phạm vi
toàn phân hiệu. Một người có thể có **nhiều dòng `user_roles`** — ví dụ vừa là Trưởng phòng A
vừa kiêm phụ trách Phòng B. Admin có thể chỉnh sửa toàn bộ tổ hợp vai trò này ngay trong UI
ở trang **Quản trị người dùng → Sửa phân quyền**, không cần sửa database tay.

## UI/UX: gộp tính năng theo vai trò

Sidebar bên trái (`src/components/Sidebar.tsx`) đọc `/api/me`, lấy **hợp (union)** danh sách
menu của tất cả vai trò/phạm vi người dùng đang giữ — nếu một người là Trưởng phòng của cả
2 phòng, họ vẫn chỉ thấy một mục "Kanban cấp Phòng" nhưng dữ liệu bên trong gộp cả 2 phòng.

## Cơ cấu tổ chức & tài khoản hiện có

Dữ liệu mẫu (`src/db/seed.ts`) đã dựng sẵn theo **cơ cấu thật** của Phân Hiệu Thanh Hóa —
8 Phòng/Bộ môn/Tổ và 13 tài khoản cán bộ thật:

| Mã Phòng | Tên đầy đủ |
|---|---|
| TCHCQT | Phòng Tổ chức - Hành chính - Quản trị |
| TCKT | Phòng Tài chính - Kế toán |
| KTDBCL | Phòng Khảo thí và Đảm bảo Chất lượng giáo dục |
| QLDT | Phòng Quản lý Đào tạo |
| YHCS | Bộ môn Y học Cơ sở |
| TTRA | Tổ Thanh tra |
| LCD | Liên chi đoàn Phân hiệu Thanh Hóa |
| NCKH | Tổ Nghiên cứu khoa học và Hợp tác quốc tế |

13 tài khoản được tạo gồm: 1 tài khoản quản trị kỹ thuật, 2 Ban giám đốc, 2 Thư kí phân hiệu,
8 Trưởng phòng/phụ trách đơn vị (mỗi người gắn phạm vi 1 Phòng ở bảng trên tương ứng với danh
sách cán bộ đã cung cấp).

**Mật khẩu**: mỗi lần chạy `npm run db:seed`, hệ thống tự sinh **mật khẩu ngẫu nhiên riêng
cho từng người** (không dùng chung 1 mật khẩu demo như trước) và ghi ra file
`credentials.generated.csv` ở thư mục gốc dự án (đã thêm vào `.gitignore`, không commit lên
kho mã nguồn). File này được gửi riêng, tách khỏi phần mã nguồn, để tránh lộ mật khẩu qua
chat/log. **Vì hệ thống chưa có màn hình tự đổi mật khẩu, đề nghị mỗi người giữ kỹ mật khẩu
tạm thời này** cho đến khi tính năng đổi mật khẩu được bổ sung (xem mục Giới hạn bên dưới).

## Thông báo qua email

Hệ thống gửi email trong 2 tình huống:

1. **Khi vừa giao việc**: ngay sau khi Thư kí phân hiệu bấm "Gửi cho các Phòng" ở bước cuối
   trích xuất/dispatch biên bản họp, Trưởng phòng của (các) Phòng liên quan nhận được email
   thông báo nhiệm vụ mới kèm hạn hoàn thành và link vào hệ thống.
2. **Sắp đến hạn**: endpoint `POST /api/cron/due-date-reminders` quét các nhiệm vụ (cả cấp
   Phân hiệu lẫn cấp Phòng) sắp đến hạn trong N ngày tới (mặc định 2 ngày, đổi bằng query
   `?days=`) mà chưa đánh dấu Hoàn thành, rồi gửi email nhắc cho Trưởng phòng phụ trách.
   Endpoint này **không tự chạy định kỳ trong app** — cần một scheduler bên ngoài gọi tới
   (vd. Render Cron Job, hoặc `cron` trên VPS gọi `curl`), vì đây là ứng dụng web thông
   thường, không có tiến trình nền riêng để tự đặt lịch.

Cấu hình gửi mail hoàn toàn qua biến môi trường trong `.env` (xem `.env.example`), dùng SMTP
thông thường nên tương thích với: SMTP nội bộ của trường, Gmail/Google Workspace (bật **App
Password** tại `myaccount.google.com/apppasswords` — Google đã chặn dùng mật khẩu đăng nhập
thường cho SMTP từ 2022), hoặc bất kỳ dịch vụ email nào khác hỗ trợ SMTP chuẩn.

> Nếu chưa điền `SMTP_HOST`, hệ thống **không lỗi** — chỉ ghi log ra console thay vì gửi thật,
> để không ảnh hưởng các tính năng khác khi chưa cấu hình email.

Endpoint nhắc hạn được bảo vệ bằng `CRON_SECRET` (header `Authorization: Bearer <CRON_SECRET>`).

## Chạy dự án ở local

```bash
npm install
cp .env.example .env      # rồi sửa DATABASE_URL trỏ tới Postgres của bạn
npm run db:push           # đồng bộ schema vào database (Drizzle)
npm run db:seed           # tạo cơ cấu Phòng + 13 tài khoản thật (xem credentials.generated.csv)
npm run dev
```

Mở http://localhost:3000, đăng nhập bằng email trong danh sách cán bộ + mật khẩu tương ứng
trong `credentials.generated.csv` (được sinh sau khi chạy `npm run db:seed`, không có sẵn
mật khẩu cố định để tra cứu trong tài liệu này).

## Deploy lên Render

File `render.yaml` đã cấu hình sẵn: 1 Web Service (Node), 1 Postgres instance, và 1 Cron Job
tuỳ chọn cho tính năng nhắc hạn (Blueprint).

1. Đẩy source code này lên một repo GitHub/GitLab của bạn.
2. Trên Render Dashboard → **New → Blueprint**, trỏ tới repo đó — Render sẽ tự đọc
   `render.yaml` và tạo web service + database (+ cron job nếu muốn dùng nhắc hạn).
3. Vào **Environment** của service `phanhieu-app`, điền thủ công các biến đánh dấu
   `sync: false`: `APP_URL` (URL thật sau khi deploy), và nếu muốn gửi email thật thì điền
   thêm `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM`.
4. Nếu dùng Cron Job nhắc hạn (`phanhieu-due-date-reminders`): copy giá trị `CRON_SECRET` đã
   được Render tự sinh ở service `phanhieu-app` sang đúng biến `CRON_SECRET` của cron job đó
   (Render không tự đồng bộ giá trị `generateValue` giữa 2 service khác nhau).
5. Sau lần deploy đầu tiên, vào **Shell** của service (hoặc chạy job riêng) để khởi tạo
   schema và dữ liệu:
   ```bash
   npm run db:push
   npm run db:seed
   ```
6. Đề nghị mỗi cán bộ đổi mật khẩu tạm thời sớm nhất có thể (xem Giới hạn bên dưới).

## Cấu trúc thư mục

```
src/
  db/schema.ts                    Toàn bộ schema Postgres (Drizzle), gồm bảng liên kết
                                   task_departments cho nhiệm vụ liên phòng
  db/seed.ts                      Script tạo cơ cấu Phòng + 13 tài khoản thật, sinh mật khẩu
                                   ngẫu nhiên và ghi ra credentials.generated.csv
  lib/rbac-config.ts              Ma trận phân quyền — nguồn chân lý duy nhất
  lib/permissions.ts              Resolver: quyền + phạm vi (scope) hiệu lực của 1 phiên
  lib/auth.ts                     JWT session, hash mật khẩu
  lib/extract-tasks.ts            Bộ tách nhiệm vụ theo quy tắc từ biên bản họp (không AI)
  lib/email.ts                    Gửi email qua SMTP (giao việc mới / nhắc hạn)
  app/api/meetings/extract        Xem trước kết quả trích xuất (không lưu DB)
  app/api/meetings/dispatch       Tạo biên bản + toàn bộ nhiệm vụ + gửi email trong 1 giao dịch
  app/api/cron/due-date-reminders Endpoint cho scheduler ngoài gọi để gửi email nhắc hạn
  app/api/admin/users/[id]        Admin sửa phân quyền (vai trò + phạm vi) của 1 tài khoản
  app/api/...                     Các API route khác (đều kiểm tra quyền + phạm vi ở server)
  app/dashboard/...               Các trang theo từng module (Kanban, biên bản họp, báo cáo, admin)
  app/login                       Trang đăng nhập (thiết kế theo tông đỏ-trắng của trường)
  components/KanbanBoard.tsx      Kanban dùng chung cho cả 2 cấp (branch/department), hỗ trợ
                                   hiển thị/chọn nhiều Phòng cho nhiệm vụ liên phòng
  components/Sidebar.tsx          Menu gộp theo vai trò, hiển thị logo trường
```

## Giới hạn hiện tại / gợi ý mở rộng tiếp theo

- **Chưa có màn hình "quên mật khẩu" / tự đổi mật khẩu** — vì mỗi tài khoản seed hiện dùng
  mật khẩu ngẫu nhiên riêng, đây là hạn chế cần ưu tiên bổ sung sớm nhất trước khi dùng thật
  lâu dài (tạm thời Admin có thể tạo lại tài khoản hoặc can thiệp trực tiếp CSDL nếu cần đổi
  mật khẩu cho ai đó).
- Tính năng nhắc hạn qua email cần **1 scheduler bên ngoài** gọi định kỳ tới
  `/api/cron/due-date-reminders` (Render Cron Job đã có sẵn cấu hình mẫu trong `render.yaml`,
  nhưng đây là tính năng trả phí trên Render — có thể thay bằng bất kỳ dịch vụ cron nào khác
  gọi HTTP, kể cả cron trên máy chủ riêng).
- Kéo-thả dùng HTML5 Drag & Drop (tốt cho desktop); nếu cần thao tác tốt trên máy tính bảng,
  nên thay bằng thư viện hỗ trợ cảm ứng như `@dnd-kit`.
- Bộ trích xuất nhiệm vụ hiện chỉ nhận dạng đúng 1 mẫu quy ước: mã Phòng trong ngoặc đơn ở
  cuối câu. Nếu sau này có thêm quy ước khác (vd. nhiều dòng ghép cho 1 nhiệm vụ), cần mở
  rộng `lib/extract-tasks.ts`.
- Nếu sau này cần chia việc chi tiết hơn xuống từng cá nhân trong phòng, có thể khôi phục lại
  cấp "Nhiệm vụ cá nhân" bằng cách thêm lại bảng nhóm/vai trò tương ứng (đã lược bỏ theo yêu
  cầu để đơn giản hoá mô hình còn 2 cấp: Phân hiệu → Phòng).
