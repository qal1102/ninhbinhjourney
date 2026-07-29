# Audit vai trò, workflow và module ERP

> Audit tại ngày 28/07/2026, dựa trên source đang chạy và benchmark từ nguồn chính thức. Mục tiêu là xác định hệ thống có giải quyết vấn đề vận hành thật hay mới chỉ trình bày giống một ứng dụng. Không dùng tên sản phẩm lớn để biện minh cho việc thêm menu.

## Kết luận điều hành

Tám nhóm module hiện tại đúng hướng cho một đơn vị vận hành nhiều điểm du lịch. Chưa cần thêm top-level module. Vấn đề lớn nhất không phải thiếu menu mà là dữ liệu và bàn giao giữa các vai trò chưa đóng vòng.

- Màn giám đốc đã có khách, tiền, người, sự cố, cơ sở và dự án, nhưng trước audit còn trộn khách dự kiến với khách thực tế, KPI toàn vùng mở sai một cơ sở, dùng ngày 27/07 trong ngày 28/07 và gọi dữ liệu tĩnh là “luồng trực tiếp”.
- Kế toán đã có hàng việc nguồn → chứng từ → định khoản → người kiểm tra, nhưng case đang dựng sẵn và chưa sinh từ thao tác chốt ca/NCC/bảng công thật.
- Quản lý có đủ phạm vi cơ sở và workflow sự cố tương đối sâu, nhưng nhiều nút chỉ đổi state cục bộ; chưa tạo inbox cho người nhận sau khi “chuyển”.
- Nhân viên có site/module đúng phân công nhưng trước audit chưa phân biệt chính thức/thời vụ, chưa giới hạn quyền theo thời hạn hợp đồng/đào tạo.
- Không workflow nào hiện đóng vòng xuyên nhiều tài khoản và lưu bền. Sự cố đóng vòng tốt nhất trong cùng component; access/chấm công lưu bằng signed cookie; các luồng khác phần lớn là demo state.

## Nguyên tắc học từ hệ thống lớn

Không sao chép dashboard hoặc tên module. Chỉ học các nguyên tắc kiểm soát:

1. Mỗi giao dịch có một mã hồ sơ xuyên suốt, không tạo lại số ở mỗi phòng ban.
2. Người tạo, người kiểm tra và người duyệt được tách rõ.
3. Quyền tối thiểu theo công việc, cơ sở, ca, thời hạn và năng lực đã được xác nhận.
4. Mỗi trạng thái có điều kiện vào/ra, người chịu trách nhiệm, SLA, bằng chứng và lịch sử.
5. Số tổng hợp của giám đốc phải truy xuống được đúng nguồn toàn vùng, không nhảy ngẫu nhiên sang một cơ sở.
6. “Realtime” chỉ được dùng khi có event source, timestamp/freshness và cơ chế cập nhật thật.

Các benchmark chính thức:

- [UN Tourism INSTO](https://www.unwto.org/news/yucatan-state-joins-the-unwto-network-of-sustainable-tourism-observatories) yêu cầu theo dõi điểm đến thường xuyên và có hệ thống, bao gồm mùa vụ, việc làm, lợi ích kinh tế, tài nguyên, khí hậu, khả năng tiếp cận, sự hài lòng địa phương và quản trị.
- [ISO 22320:2018](https://www.iso.org/standard/67851.html) nhấn mạnh vai trò, trách nhiệm, nhiệm vụ, quản lý nguồn lực và phối hợp trong incident management.
- [ISO 45001:2018](https://www.iso.org/standard/63787.html?layout=default) đặt an toàn theo chu trình nhận diện mối nguy, ứng phó, điều tra và cải tiến, không chỉ đóng một phiếu sự cố.
- [ISO 55001:2024](https://committee.iso.org/sites/tc251/home/projects/published/iso-55001.html) nối quyết định tài sản với giá trị, mục tiêu và quản lý toàn vòng đời.
- [SAP purchase requisition workflow](https://help.sap.com/docs/buying-invoicing/purchasing-guide-for-procurement-professionals/about-workflow-of-purchase-requisitions-8b3f5dbe7a7b4427a1039a46dfe475d3) và [invoice processing](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/ed84b70c199d4470ae2e5ccb93b2e45b/ab6fb6531de6b64ce10000000a174cb4.html) thể hiện chuỗi đề nghị → duyệt → đơn mua → nhận/nghiệm thu → hóa đơn → thanh toán/ghi nhận.
- [SAP SuccessFactors Time Management](https://help.sap.com/docs/SAP_SUCCESSFACTORS_EMPLOYEE_CENTRAL/5b9fbaed634b4004a8befcc2dad2fc1f/what-is-sap-successfactors-time-management) và [Clock In/Clock Out](https://help.sap.com/docs/successfactors-employee-central/operating-time-management-in-sap-successfactors/9b874bb10627450fad5c2ceff72c107f.html) tách time event, timesheet, ngoại lệ và workflow duyệt; dữ liệu máy chấm công được ghép thành thời gian làm việc.
- [ServiceNow Incident Management](https://www.servicenow.com/docs/r/xanadu/it-service-management/incident-management/incident-management-process.html) dùng log → phân loại/ưu tiên → giao → escalation → xử lý → xác nhận/đóng và theo dõi SLA; quyền resolve và close có thể tách riêng trong [hướng dẫn resolve/close](https://www.servicenow.com/docs/r/it-service-management/incident-management/resolve-and-close-an-incident.html).
- [NIST RBAC](https://csrc.nist.gov/CSRC/media/Projects/Role-Based-Access-Control/documents/ferraiolo-kuhn-92.pdf) yêu cầu least privilege: người dùng chỉ có quyền tối thiểu cần cho công việc.

## Ma trận vai trò mục tiêu

| Vai trò | Phạm vi | Việc chính | Chuyển tiếp | Không được làm |
|---|---|---|---|---|
| Giám đốc | Toàn vùng | Xem quy mô, tài chính, khách, nguồn lực, rủi ro, dự án; quyết định ngoại lệ đã xác minh | Giao lại quản lý/kế toán với quyết định và hạn | Nhập liệu ca, đóng sự cố thường, sửa chứng từ nguồn |
| Quản lý cơ sở | Cơ sở được giao | Xếp ca, giao việc, xác minh chốt ca/nghiệm thu/sự cố, điều phối nguồn lực | Chuyển chứng từ đủ sang kế toán; chuyển rủi ro/ngân sách vượt ngưỡng lên giám đốc | Ghi sổ; tự duyệt khoản do mình lập |
| Kế toán tổng hợp | Hồ sơ tài chính từ các cơ sở | Kiểm tra chứng từ, đối soát, coding, bút toán nháp, đề nghị thanh toán, đóng kỳ | Gửi người kiểm tra; trả hồ sơ đúng bộ phận nguồn | Camera, sức chứa, xếp ca, chốt tiền thay quầy |
| Kế toán trưởng/kiểm soát | Toàn vùng tài chính | Kiểm tra độc lập, duyệt/trả bút toán và ngoại lệ kỳ | Cho phép ghi sổ hoặc chuyển ngoại lệ lên giám đốc | Tự lập và tự duyệt cùng hồ sơ |
| Nhân viên chính thức | Một cơ sở + nghiệp vụ được đào tạo | Vào/ra ca, làm task, check-in, báo sự cố, nộp bằng chứng, bàn giao | Chuyển quản lý xác minh | Duyệt tài chính, phân quyền người khác |
| Nhân viên thời vụ | Đúng cơ sở, ca, trạm và thời hạn | Check-in khách, task được giao, báo sự cố, nộp ảnh | Mọi ngoại lệ lên người giám sát | Chốt két, nhận tài sản, đóng P1/P2, xem camera toàn khu, quyền không thời hạn |
| Đối tác/NCC ngoài hệ thống | Hồ sơ/hợp đồng của mình | Gửi báo giá, hóa đơn, tài liệu, phản hồi yêu cầu bổ sung | Chuyển mua sắm/quản lý/kế toán | Xem dữ liệu nội bộ hoặc NCC khác |

Trong source hiện tại đã có bốn role hệ thống: director, manager, accountant, employee. “Thời vụ” được mô hình hóa đúng hơn như `employmentType` của employee thay vì tạo thêm role, kèm thời hạn quyền, trạm, ca và module đã được đào tạo. Kế toán trưởng và đối tác ngoài hệ thống chưa có tài khoản demo riêng.

## Đánh giá từng nhóm module

Thang mức:

- M0: card/text minh họa.
- M1: có form/state cục bộ và hồ sơ chi tiết.
- M2: chuyển việc được giữa hai tài khoản, refresh vẫn giữ.
- M3: nối nguồn thiết bị/hệ thống thật và audit bền vững.
- M4: kiểm soát production, giám sát, DR, dữ liệu và compliance hoàn chỉnh.

| Nhóm hiện tại | Real-life problem | Vai trò chính | Mức hiện tại | Đánh giá và khoảng trống |
|---|---|---|---|---|
| Booking & Check-in | Bán đúng sản phẩm, xác thực quyền lợi, điều tiết lượt vào, chốt vé–tiền | Quầy/cổng → quản lý → kế toán | M1 | Đúng nhu cầu. QR và chốt ca có form nhưng chỉ local; cần channel inventory, hoàn/hủy, hóa đơn điện tử và một shift closure bất biến |
| Điều hành hiện trường | Tránh quá tải, giảm thời gian chờ, xác minh cảnh báo camera | Nhân viên → quản lý | M0–M1 | Đúng nhu cầu. Cần sensor provenance, timestamp, threshold, dispatch case và feedback sau xử lý; camera hiện mô phỏng |
| An toàn & sự cố | Tiếp nhận, phân mức, giao, giữ SLA, xác minh và học sau sự cố | Mọi người → quản lý → giám đốc khi vượt ngưỡng | M1+ | Module sâu nhất. Cần persistence chung, checklist/evidence bắt buộc, quyền report/update/resolve/close tách riêng và post-incident review |
| Nhân sự & ca làm | Đủ người đúng kỹ năng/trạm, công đúng, overtime/absence/handover | Nhân viên → quản lý → HR/kế toán lương | M1+ | Access/chấm công có signed cookie. Đã thêm hồ sơ chính thức/thời vụ; còn thiếu shift assignment làm authorization boundary, missed punch, duyệt OT, nghỉ, bàn giao và payroll batch sinh từ công |
| Phương tiện & tài sản | Đảm bảo xe/thuyền/thiết bị sẵn sàng, an toàn, đủ lịch bảo trì và chi phí vòng đời | Kỹ thuật/điều phối → quản lý → kế toán | M0–M1 | Hướng module đúng nhưng hiện chủ yếu là card. Cần asset master, work order, meter, spare part, downtime, nghiệm thu và liên kết nguyên giá/khấu hao |
| Dự án & sự kiện | Kiểm soát tiến độ, ngân sách, khách dự kiến, nhà thầu, an toàn và readiness | PM/manager → kế toán → giám đốc | M0–M1 | Có budget/milestone/urgent work nhưng read-only. Cần WBS, dependency, change request, forecast-at-completion, acceptance và settlement |
| Nhà cung cấp & công nợ | Mua đúng nhu cầu, nghiệm thu đủ, trả đúng hạn và kiểm soát NCC | Yêu cầu mua → quản lý/mua sắm → kế toán | M1 | Partner page và AP case giàu chi tiết nhưng tách rời. Cần PR/PO/service entry/invoice/payment, 3-way match và trả hồ sơ đúng owner |
| Tài chính & báo cáo | Tin cậy số, đối soát, cash/AP/AR, maker–checker, đóng kỳ, quản trị đa chiều | Kế toán → kiểm soát → giám đốc | M1+ | Có báo cáo cân và 9 case. Cần shared ledger/workflow, checker inbox, posting/reversal/period lock và integrations thật |

Quyết định kiến trúc: giữ tám nhóm. Các khoảng trống sau nên là sub-flow/cross-cutting service, chưa phải menu mới:

- Chất lượng phục vụ, phản hồi/khiếu nại, đồ thất lạc: case service nằm cạnh Booking/Incident và lên KPI giám đốc.
- Kho/vật tư và mua sắm: sub-flow của Nhà cung cấp + Tài sản.
- Master data, IAM, audit, retention, integration health: nền quản trị ẩn, không đưa thành menu hàng ngày.
- Sustainability/seasonality/employment/resource indicators theo UN Tourism: lớp Analytics sau khi nguồn vận hành thật đã ổn.

## Audit năm golden workflows

| Workflow | Điều đang chạy | Điểm gãy hiện tại | Trạng thái |
|---|---|---|---|
| Vé/check-in/kết ca → kế toán | QR, form kết ca, accounting case doanh thu cân | Form không sinh case; không manager approve; case hard-code | Chưa đóng vòng |
| Sự cố → quản lý → giám đốc | Lifecycle, SLA, assignee, SOP, evidence, escalation seed | State reset theo màn; director chưa ghi quyết định; evidence chưa bắt buộc cho mọi bước | Đóng trong component, chưa xuyên role |
| Chấm công/ca → lương | GPS event + signed cookie; payroll case | Không shift schedule/OT approval/lock; payroll không đọc event | Chưa đóng vòng |
| NCC/nghiệm thu → AP | Hồ sơ NCC/AP, 3-way-match và journal | Partner data không tạo AP; request bổ sung không tạo inbox; checker dead-end | Chưa đóng vòng |
| Dự án/tài sản → kế toán | Budget, tiến độ, accounting expense/asset case | Nghiệm thu/asset/work order không sinh case; không action bền | Chưa đóng vòng |

## Màn giám đốc: sếp cần thấy gì mỗi ngày

Thứ tự đúng:

1. Dữ liệu đến lúc nào, bốn cơ sở nào cần chú ý.
2. Tối đa 3–5 quyết định: mã hồ sơ, severity, countdown, tác động tiền/khách/an toàn, owner và phương án đề xuất.
3. Pulse: khách dự kiến, đã vào, tải/peak, doanh thu–tiền về, nhân sự actual/planned/thời vụ, sự cố.
4. Ma trận bốn cơ sở cùng đơn vị đo; site đỏ/cam lên trước.
5. Tài chính; bấm mới drill theo kỳ/chỉ số.
6. Rủi ro, dự án/sự kiện và activity log ở dưới.

Đã sửa trong lượt này:

- Chuyển “hôm nay” sang 28/07/2026 và giảm đúng số ngày còn lại của sự kiện.
- Tách rõ khách dự kiến cả ngày và đã vào cổng.
- Bỏ link KPI toàn vùng nhảy sai sang một site; thêm ma trận bốn cơ sở.
- Đưa decision queue lên trước tài chính; thêm mã, owner, hạn, tác động và đề xuất; sửa quyết định tăng xe sang module xe.
- Bỏ copy “luồng trực tiếp/đang nhận” cho dữ liệu tĩnh, thay bằng activity log có timestamp cố định.
- Thêm workforce actual/planned và số thời vụ; project card có ngân sách, cam kết và khách dự kiến.

## Ưu tiên tiếp theo

1. Tạo demo workflow store chung trước Supabase: case ID, source link, assignee, status, audit; giữ qua refresh và logout/login.
2. Hoàn thiện golden path vé: nhân viên gửi chốt ca → quản lý duyệt/trả → tự tạo REC case → kế toán khớp/lập → checker duyệt → post.
3. Thêm Shift/ShiftAssignment/Handover; mọi action hiện trường kiểm active assignment, station, thời hạn và training.
4. Tách action capability cho incident, camera, ticket cash, asset acceptance và project update; không chỉ dựa module.
5. Nối Supabase production, Storage và realtime; chỉ sau đó mới dùng ngôn ngữ realtime/đã chuyển việc thật.
