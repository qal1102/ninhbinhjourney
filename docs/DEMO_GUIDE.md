# Demo Guide

## 1. Executive preview — use this first

Open `/demo/ops`. It needs no backend account and is explicitly labelled as illustrative data.

Recommended 5-minute story:

1. Show the four executive indicators: expected visitors, checked-in visitors, cross-site journeys and open incidents.
2. Compare Bái Đính and Tam Chúc side by side: utilization, check-in, average wait and incident state.
3. Open the signal feed and explain the three operating cases: capacity threshold, shuttle recovery and a cross-site handoff.
4. Show “Leadership lens”: each signal must lead to an owner/action, not just a chart.
5. Finish at “Data readiness” to separate what is implemented from the connections the client must provide.

All values on `/demo/ops` are fictional scenario data.

## 2. Visitor journey

Open `/`, skip or watch the four-word intro, switch VI/EN, then choose “Lập hành trình thật” or “Build a route”. The CTA must open `/plan`; it is no longer a decorative local form.

Suggested request:

> Tôi có một ngày ở Ninh Bình, đi cùng bố mẹ, muốn lịch trình nhẹ nhàng, ít đi bộ và ngân sách khoảng 2 triệu.

## 3. Authenticated operations rehearsal

After Supabase is configured, a named admin starts at `/ops/settings/demo`, creates an isolated room, and pairs the visitor flow. The protected suite includes overview, bookings, QR check-in, capacity, incidents, coordination/copilot, audit and role-aware commerce visibility.

## Safety

- Demo figures, prices and customer records are fictional.
- No real payment is collected.
- Generated editorial images are labelled and do not claim documentary accuracy.
- Incident suggestions require a named human confirmation.
- `/demo/ops` is a presentation surface; `/ops` remains the authenticated source-of-truth surface.
