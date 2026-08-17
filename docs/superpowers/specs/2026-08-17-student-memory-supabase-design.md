# Thiết kế: Bộ nhớ & Hồ sơ học sinh cho AI cô giáo (Supabase)

- **Ngày:** 2026-08-17
- **Trạng thái:** Đã duyệt thiết kế, chờ lập kế hoạch triển khai
- **Nhánh:** `sontv6666/burrfish`
- **Phân loại:** Architectural (thêm hệ thống con lưu trữ + bộ nhớ)

## 1. Mục tiêu & Vấn đề

AI cô giáo ("Cô Mây") hiện **không nhớ** học sinh giữa các lượt/phiên:

1. **Cửa sổ ngữ cảnh bị cắt** — `messageSelectors.getProcessedMessages` chỉ gửi cho model
   `maxPastMessages` tin nhắn gần nhất (`src/features/messages/messageSelectors.ts:70-81`).
   Hội thoại dài → tin cũ rơi khỏi ngữ cảnh → cô giáo quên.
2. **Không có hồ sơ học sinh** — không lưu tên, biệt danh, cách xưng hô, sở thích,
   trình độ, đang học gì, học tới đâu.
3. **Lưu tạm ở localStorage** — `chatLog` chỉ persist trong Zustand `home` store
   (`aitube-kit-home`), mất khi đổi máy/xóa cache. `@supabase/supabase-js` đã cài
   (`package.json`) nhưng chỉ dùng ở `save-chat-log.ts` để ghi file cục bộ.

**Kết quả mong muốn:** Cô giáo nhớ được học sinh là ai, thích được gọi là gì, xưng hô
sao, học tới đâu, đang học gì, sở thích, điểm mạnh/yếu — và duy trì trí nhớ đó xuyên
suốt hội thoại dài lẫn qua nhiều phiên/ngày.

## 2. Quyết định đã chốt (từ brainstorming)

| Quyết định | Lựa chọn |
|-----------|----------|
| Nhận diện học sinh | **1 máy = 1 học sinh** — `studentId` tự sinh, lưu localStorage, không đăng nhập |
| Điền hồ sơ | **Cả hai** — AI tự trích xuất + form chỉnh tay trong Settings |
| Bảo mật | **Nhẹ** — Supabase client trình duyệt với publishable key, RLS cơ bản |

**Ngoài phạm vi (YAGNI):** đăng nhập email/Supabase Auth, đồng bộ đa thiết bị,
bảng điều khiển giáo viên, chia sẻ hồ sơ giữa nhiều máy.

## 3. Kiến trúc "3 lớp trí nhớ"

Khối bộ nhớ được **dựng lại và tiêm vào system prompt mỗi lượt**, nên sống sót qua
việc cắt `maxPastMessages`.

| Lớp | Nội dung | Nguồn dữ liệu |
|-----|----------|---------------|
| 1 – Tin gần nhất | N tin nguyên văn | Cơ chế `maxPastMessages` hiện có (giữ nguyên) |
| 2 – Tóm tắt cuộn | Tóm tắt các đoạn cũ, cập nhật mỗi ~6–10 tin | `students.memory_summary` |
| 3 – Hồ sơ + sự kiện | Tên, xưng hô, trình độ, đang học gì, sở thích, điểm mạnh/yếu, sự kiện cá nhân | `students` + `memory_facts` |

Mỗi lượt model nhận: **Hồ sơ + Sự kiện + Tóm tắt + Tin gần nhất**.

## 4. Lược đồ Supabase

Cung cấp file SQL `supabase/schema.sql` để chạy 1 lần trong SQL Editor.

### Bảng `students`
| Cột | Kiểu | Ghi chú |
|-----|------|--------|
| `id` | `uuid` PK | = studentId do client sinh (không dùng `gen_random_uuid()` mặc định để client kiểm soát) |
| `display_name` | `text` | Tên học sinh |
| `preferred_name` | `text` | Thích được gọi là gì |
| `address_form` | `text` | Cách xưng hô (VD: "cô - em", "cô - con") |
| `grade_level` | `text` | Lớp / trình độ |
| `current_topic` | `text` | Đang học gì hiện tại |
| `progress_notes` | `text` | Học tới đâu (mô tả tiến độ) |
| `interests` | `text[]` | Sở thích |
| `strengths` | `text` | Điểm mạnh |
| `weaknesses` | `text` | Hay sai / điểm yếu |
| `memory_summary` | `text` | Tóm tắt dài hạn (lớp 2) |
| `last_active` | `timestamptz` | Lần tương tác gần nhất |
| `created_at` / `updated_at` | `timestamptz` | Mặc định `now()` |

### Bảng `messages`
| Cột | Kiểu | Ghi chú |
|-----|------|--------|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `student_id` | `uuid` | FK → `students.id`, index |
| `role` | `text` | `user` / `assistant` / `system` |
| `content` | `text` | Nội dung |
| `emotion` | `text` null | Nhãn cảm xúc nếu có |
| `created_at` | `timestamptz` | `now()`, index để phân trang |

Lưu **toàn bộ** lịch sử, không giới hạn.

### Bảng `memory_facts`
| Cột | Kiểu | Ghi chú |
|-----|------|--------|
| `id` | `uuid` PK | |
| `student_id` | `uuid` | FK → `students.id`, index |
| `category` | `text` | `identity` / `preference` / `progress` / `personal` / `misc` |
| `key` | `text` | Khóa ngắn (VD: "môn thích") |
| `value` | `text` | Giá trị (VD: "Toán hình") |
| `confidence` | `real` | 0–1 |
| `source_message_id` | `uuid` null | Tin nhắn nguồn |
| `created_at` / `updated_at` | `timestamptz` | |

Ràng buộc `unique(student_id, category, key)` để upsert (cập nhật thay vì trùng lặp).

### RLS (nhẹ)
- Bật RLS cả 3 bảng.
- Policy cho role `anon`: cho phép `select/insert/update` khi thao tác gắn với một
  `student_id` (client luôn truyền `student_id`). Chấp nhận: đây là mức bảo mật nhẹ
  cho demo/nội bộ; không chống được người có publishable key đọc dữ liệu người khác
  nếu họ đoán được `student_id` (uuid ngẫu nhiên nên khó đoán). Đã được chấp thuận.

## 5. Code mới — `src/features/memory/`

| File | Nhiệm vụ | Phụ thuộc |
|------|----------|-----------|
| `supabaseClient.ts` | Tạo client trình duyệt từ `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Trả `null` nếu thiếu env (feature tự tắt êm). | `@supabase/supabase-js` |
| `studentIdentity.ts` | `getOrCreateStudentId()` — đọc/tạo uuid trong localStorage key `aituber-student-id`. Hàm thuần, dễ test. | — |
| `studentProfile.ts` | `loadProfile(id)`, `upsertProfile(id, patch)`, `ensureStudentRow(id)`. | supabaseClient |
| `memoryFacts.ts` | `loadFacts(id)`, `upsertFacts(id, facts[])`. | supabaseClient |
| `messagePersistence.ts` | `persistMessage(id, message)` — ghi 1 tin lên bảng `messages`. | supabaseClient |
| `memoryExtractor.ts` | `extractAndUpdate(id, recentMessages)` — gọi 1 lượt AI trích xuất JSON → cập nhật `students` + upsert `memory_facts` + làm mới `memory_summary`. Hàm gộp JSON (`mergeExtraction`) tách riêng, thuần, test được. | provider AI hiện có |
| `memoryInjector.ts` | `buildMemoryBlock(profile, facts, summary)` — trả chuỗi khối "📌 HỒ SƠ HỌC SINH". Hàm thuần, test được. | — |
| `memoryStore.ts` | Zustand store: `studentId`, `profile`, `facts`, cờ `ready`. Nạp lúc bootstrap. | các file trên |

**Nguyên tắc cô lập:** mỗi file một nhiệm vụ rõ; logic thuần (`buildMemoryBlock`,
`mergeExtraction`, `getOrCreateStudentId`) tách khỏi I/O Supabase để test độc lập.

## 6. Điểm nối vào code hiện có

| File | Thay đổi |
|------|----------|
| `src/features/chat/handlers.ts` (~dòng 892, mảng `messages`) | Chèn `{ role: 'system', content: buildMemoryBlock(...) }` ngay sau `systemPrompt`, trước `continuityMessages`. Lấy dữ liệu từ `memoryStore`. |
| `src/features/stores/home.ts` (`upsertMessage`, ~dòng 260-285) | Sau khi cập nhật `chatLog`, gọi `persistMessage(studentId, msg)` (bọc try/catch, song song với `save-chat-log` cũ). |
| `src/pages/index.tsx` (bootstrap) | Khi mount: `getOrCreateStudentId()` → `ensureStudentRow` → nạp profile + facts vào `memoryStore` → kích hoạt extractor định kỳ. |
| Trigger trích xuất | Sau mỗi lượt assistant hoàn tất, nếu số tin mới kể từ lần trích xuất ≥ ngưỡng (mặc định 6) → chạy `extractAndUpdate` nền (không chặn UI). |

## 7. UI Settings — Hồ sơ học sinh

- File mới `src/components/settings/studentProfile.tsx`: form xem/sửa
  `display_name, preferred_name, address_form, grade_level, current_topic, interests`
  và xem danh sách `memory_facts` (chỉ đọc, có nút xóa từng mẩu).
- Đăng ký panel trong `src/components/settings/index.tsx` theo đúng mẫu panel hiện có.
- **Chỉ cập nhật ngôn ngữ tiếng Nhật** `locales/ja/translation.json` (theo CLAUDE.md);
  các ngôn ngữ khác do quy trình dịch riêng xử lý. Chuỗi tiếng Việt hiển thị có thể
  hardcode/qua khóa i18n theo mẫu sẵn có của dự án.

## 8. Luồng trích xuất tự động (AI tự học)

1. Kích hoạt: sau lượt assistant, khi `messagesSinceLastExtract >= N` (mặc định 6).
2. Prompt trích xuất (tiếng Việt): yêu cầu model đọc đoạn hội thoại gần nhất và trả về
   **JSON** gồm: `display_name, preferred_name, address_form, grade_level,
   current_topic, progress_notes, interests[], strengths, weaknesses,
   facts[] ({category,key,value,confidence})`. Chỉ ghi điều chắc chắn; bỏ qua nếu không rõ.
3. `mergeExtraction`: gộp có chọn lọc vào profile (không ghi đè giá trị đang có bằng
   rỗng), upsert facts theo `(category,key)`, và cập nhật `memory_summary`.
4. Gọi qua provider AI hiện có (mặc định openrouter/free). Chạy nền, lỗi thì bỏ qua.

## 9. Phòng lỗi

- Mọi lời gọi Supabase/AI bọc `try/catch`, thất bại thì **không làm gián đoạn chat**.
- Thiếu env Supabase → `supabaseClient` trả `null` → toàn bộ tính năng tắt êm, app
  chạy y như hiện tại (localStorage + save-chat-log). Không hồi quy.
- Ghi Supabase là **bổ sung**, không thay thế localStorage — localStorage vẫn là nguồn
  hiển thị tức thời; Supabase là nguồn bền vững + xuyên phiên.

## 10. Biến môi trường (`.env.example`)

```
# Supabase — bộ nhớ & hồ sơ học sinh (client trình duyệt)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# (tùy chọn) số tin nhắn giữa 2 lần AI trích xuất bộ nhớ
NEXT_PUBLIC_MEMORY_EXTRACT_EVERY_N=6
```

## 11. Kiểm thử

- **Unit (Jest, có sẵn):**
  - `studentIdentity.getOrCreateStudentId` — tạo mới khi trống, giữ nguyên khi đã có.
  - `memoryInjector.buildMemoryBlock` — dựng đúng khối từ profile/facts/summary; xử lý field rỗng.
  - `memoryExtractor.mergeExtraction` — gộp đúng, không ghi đè bằng rỗng, upsert facts theo khóa.
- **Thủ công:** chat → tải lại trang / mở máy lại → cô giáo nhớ tên, biệt danh, sở thích,
  đang học gì; hội thoại dài (>maxPastMessages) vẫn nhớ nhờ khối tiêm.
- Mock Supabase client trong test (không gọi mạng thật).

## 12. Thứ tự triển khai (sơ bộ)

1. `supabase/schema.sql` + cập nhật `.env.example`.
2. Hạ tầng: `supabaseClient`, `studentIdentity`, `memoryStore`.
3. `studentProfile` + `memoryFacts` + `messagePersistence` (CRUD).
4. `memoryInjector` + nối vào `handlers.ts`.
5. `messagePersistence` nối vào `home.ts`.
6. `memoryExtractor` + trigger định kỳ.
7. UI `studentProfile.tsx` + đăng ký panel + i18n `ja`.
8. Bootstrap ở `index.tsx`.
9. Unit tests + chạy `npm run lint:fix && npm run format && npm run build`.
