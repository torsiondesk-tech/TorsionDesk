# Feature Landscape

**Domain:** Field Service Management (FSM) CRM for a garage door service business
**Researched:** 2026-06-10
**Overall confidence:** MEDIUM-HIGH (cross-referenced multiple FSM vendors, garage-door-specific sources, and technician adoption research; vendor marketing pages skew positive, so adoption/anti-feature claims are weighted toward independent comparison and Reddit-sourced commentary)

## Context for the Roadmap

The PROJECT.md scope is already deep and well-specified — this is a Service Fusion *replacement* with discovery done. The job of this research is therefore NOT to expand scope. It is to:

1. Confirm the already-planned features are genuinely table stakes (they are — see below).
2. Surface garage-door-specific patterns that should shape *how* existing features are built (especially equipment, springs, and tags).
3. Flag the over-engineering traps that kill FSM builds so the roadmap stays lean.
4. Identify the small number of high-leverage differentiators worth keeping on the radar without bloating MVP.

The strongest finding across all sources: **for a 1-2 tech shop, the failure mode is over-building, not under-building.** ServiceTitan-style depth is actively harmful at this scale. The planned scope is appropriately sized; the risk is scope creep during implementation.

---

## Table Stakes

Features every FSM/CRM user expects. Missing = product feels incomplete. All of these are already in PROJECT.md scope — confidence HIGH that they are correctly classified as required.

| Feature | Why Expected | Complexity | In Scope? | Notes |
|---------|--------------|------------|-----------|-------|
| Customer record with multiple contacts/locations | Universal CRM baseline; commercial clients need location hierarchy | Med | Yes (CUST) | Equipment-per-location is correctly modeled |
| Type-ahead customer search from any form | Dispatchers live in this; slow search = abandoned tool | Low | Yes (CUST-07) | Must search name/phone/email/address |
| Job lifecycle with status machine | The core object; everything hangs off job status | High | Yes (JOB-03) | SF parity status set is correct |
| Dispatch board (calendar + job pool) | The dispatcher's home screen all day | High | Yes (DISP) | See differentiators — this is where you win or lose the owner |
| Estimate → job conversion | Quote-to-cash is the whole point of FSM | Med | Yes (EST-05) | One-click carryover is table stakes, not differentiator |
| Line items with qty/rate/cost/margin | Can't invoice or measure profit without it | Med | Yes (JOB-04) | Margin visibility is what owners actually check |
| Invoice from job + record payment on invoice | Getting paid is the #1 reason shops buy FSM | Med | Yes (INV) | No separate batch payment screen is the right call |
| AR aging dashboard | Collections is checked daily; aging buckets are universal | Med | Yes (INV-02) | Color-coded buckets match every competitor |
| On-site card payment + online payment link | "Pay before tech leaves" drives cash flow | Med | Yes (INV-06/07) | Stripe (link) + Square (swipe) split is sensible |
| Auto receipt + job/invoice email | Expected automation; manual = looks amateur | Low | Yes (COMM) | Webhook-triggered receipt is correct |
| SMS "on the way" + reminders | Now an industry expectation, not a nice-to-have | Low | Yes (COMM-07) | Reduces no-shows and "where is my tech" calls |
| Mobile tech view: jobs, status, photos, signature | Techs must work from phone; paper is the alternative | High | Yes (TECH) | Offline is non-negotiable (see mobile section) |
| Product/service catalog with cost | Needed for line items and margin | Med | Yes (CAT) | Inline creation is a genuine UX win |
| Basic reports (sales, AR, day sheet, tax) | Owners need revenue/tax visibility for the business | Med | Yes (RPT) | Day Sheet + Sales Tax are the two most-used |
| Roles (admin/dispatcher/tech) | Multi-user from day one | Low | Yes (SET-04) | Clerk orgs handle this |
| Job photos (before/after) | Documentation, warranty, dispute protection | Low | Yes (TECH-04) | Supabase Storage is fine |

**Verdict:** PROJECT.md table-stakes coverage is complete. No missing universal feature was found.

---

## Trade-Service-Specific Features Generic FSM Misses

These are patterns that generic CRMs (and even some FSM tools) handle poorly but trade shops need. Most are already addressed in PROJECT.md — flagged here so they're implemented *intentionally*, not as afterthoughts.

| Feature | Why It Matters for Trades | In Scope? | Implementation Note |
|---------|---------------------------|-----------|---------------------|
| **Equipment/asset record per service location** | The door/opener IS the asset; service history attaches to it, not the customer | Yes (CUST-04) | Garage door FSM vendors (MSI/Service Pro, Smart Service) all center on per-asset history. Correctly modeled. |
| **Service history filterable by repair type** | "When did we last do this door's springs?" is asked constantly | Partial (JOB-13 tags) | Part-type tags (Springs, Rollers, Bottom Seal, LHR) are the right mechanism. Make sure tags surface on the equipment record, not just job list. |
| **Arrival time *window* (not fixed time)** | Trades book "8-10am" windows, not 8:00 appointments | Yes (JOB-02) | Already modeled. Powers the SMS reminder. |
| **Drive/labor time as distinct line category** | Job costing separates windshield time from billable labor | Yes (JOB-04) | The three-tab line model (Products / Drive & Labor / Expenses) matches SF and is correct. |
| **Multi-day & repeating jobs** | Commercial installs span days; PM-style work recurs | Yes (JOB-08/09) | Keep recurrence simple (see anti-features — don't build a full RRULE engine). |
| **Job templates with pre-filled line items** | Common repairs (spring replace, opener install) are 80% identical | Yes (JOB-07) | Heavily used per discovery. This is a major time-saver and should be high quality. |
| **PO# on job/estimate** | Commercial clients require PO references | Yes (JOB-01/EST-03) | Already present. |
| **Parent account / commercial hierarchy** | Property managers have many sites under one bill-to | Yes (CUST-01) | Correctly modeled; equipment-per-location depends on this. |

---

## Garage Door Industry Specifics

Researched against garage-door-specific FSM vendors (MSI Service Pro, Smart Service, Field Promax, ServusOne) and garage door pricing guides. Confidence MEDIUM (vendor pages + pricing guides; not a single authoritative spec source).

### Spring sizing — the highest-stakes data in the business

- Garage-door FSM vendors uniformly call out spring spec tracking as a core feature: **wire size, inside diameter, length, wind direction (LHW/RHW), and cycle rating.** PROJECT.md captures "type, size, coil count" — consider whether **wire size + inside diameter + length + wind direction** are explicitly modeled, since "wrong specs = wrong parts ordered" is called out as a key domain risk. Coil count alone under-specifies a torsion spring.
- **Recommendation:** Make the spring fields on the equipment record (CUST-04) structured and explicit (wire size, ID, length, wind, cycles), not a free-text "size" field. This is the single most valuable garage-door-specific data quality improvement available, and it directly serves the stated "wrong specs" pain. LOW-to-MEDIUM confidence on exact field set — worth a 10-minute confirmation with the owner, who knows precisely which fields they reorder against.
- **High-cycle springs** are a common upsell/add-on in the industry — the catalog and equipment record should accommodate noting cycle rating so techs can quote the upgrade.

### Door panel / section ordering

- Replacement door *sections/panels* are ordered by make + model + design + color + size, and lead times matter (often special-order). FSM tools that serve garage door shops treat the door as a spec sheet (brand, model, style, material, color, size, window/insulation options).
- PROJECT.md captures brand/size/material/style for the door. **Consider adding color and model/series** to the door equipment record — these are required to reorder a matching panel. MEDIUM confidence; again worth a quick owner confirmation.
- This is fundamentally a *data completeness on the equipment record* issue, not a new module. No separate "panel ordering" feature needed for MVP — the equipment record + a PO is sufficient.

### Warranty tracking patterns

- Two warranty clocks exist in this trade: **manufacturer warranty** (on the door/opener/spring — date-based from install) and **workmanship/labor warranty** (the shop's own guarantee on the install/repair).
- PROJECT.md models "install and warranty dates" on equipment (CUST-04). This covers manufacturer warranty. **Consider whether the shop's own labor warranty on a given job** should be trackable (e.g., a "warranty job" flag / no-charge billing type already exists via JOB-05 "No Charge").
- **Practical pattern:** warranty is mostly used *reactively* — tech arrives, looks up "is this still under warranty?" So the win is **warranty dates visible on the equipment record in the tech PWA**, not an automated warranty-expiry engine. Do NOT build warranty expiration alerts/campaigns for MVP (anti-feature — see below).

### Other garage-door specifics worth noting

- **Emergency / after-hours pricing** is standard in the trade (+$100-200). Not a feature per se, but the catalog should support an after-hours service line item / fee. Already covered by catalog flexibility.
- **Safety inspection / tune-up** is the classic recurring/PM job and the main maintenance-package upsell. Out of scope for v1 (service agreements deferred) — correctly deferred.
- **Photos as warranty/dispute evidence** are especially important on spring and cable failures (safety-critical). Before/after photo capture (TECH-04) covers this.

---

## Differentiators

What makes dispatchers and owners *choose and keep* a tool. These are mostly about speed and friction, not feature count. Several are already in PROJECT.md as deliberate design choices — that's the right instinct.

| Differentiator | Value Proposition | In Scope? | Notes |
|----------------|-------------------|-----------|-------|
| **One-click "Close & Invoice" from dispatch** | The single highest-frequency daily action; saves navigation on every job | Yes (DISP-06) | This is THE owner-retention feature per discovery. Make it genuinely one click. |
| **Live dispatch board with real-time updates** | Multiple users see status changes instantly; no refresh, no double-booking | Yes (DISP + Supabase Realtime) | Dispatchers rate "one live view" as their top value. Realtime is the right call. |
| **AR aging checked at a glance, collections-ready** | Owners check this constantly; fast cash flow is why shops buy FSM | Yes (INV-02) | Color-coded buckets + click-to-customer is the pattern. |
| **Workflow parity with the tool they know (SF)** | Zero retraining; adoption is instant; this is a *hard requirement* | Yes (stated constraint) | Unusual and powerful differentiator — most replacements force relearning. Lean into terminology/layout parity. |
| **Inline catalog creation from job form** | Tech/office adds a part without leaving the job | Yes (CAT-04) | Real friction reducer; competitors often force a context switch. |
| **Margin/gross-profit visible on every job** | Owner sees profitability in real time, not month-end | Yes (JOB-06) | Owners obsess over this; surface it prominently. |
| **Offline-capable tech PWA** | 43% of service calls are in poor-signal areas (basements, thick-wall commercial) | Yes (TECH-01) | True offline (queue + sync) is a genuine differentiator vs tools that just "work online." See mobile section. |
| **Cost vs Service Fusion** | $20-50/mo vs $300/mo = the business case | Yes (constraint) | Not a feature, but the reason the project exists. |

### Differentiators worth keeping on the radar (NOT MVP)

These are real competitive features in modern FSM (Jobber/HouseCall Pro) but should be explicitly deferred to avoid bloat:

- **Customer self-service portal / online booking** — HouseCall Pro's standout; cited as reducing admin 40-50%. Already correctly deferred (Out of Scope). Strong candidate for milestone 2.
- **Route optimization** — clusters nearby jobs, cuts windshield time. High value at 5+ techs; near-zero value at 1-2 techs. Defer until tech count grows. Do NOT build for MVP.
- **Two-way SMS conversations** (not just one-way triggers) — modern expectation, but one-way "on the way" + reminders is sufficient for MVP. Defer.
- **Good-better-best / multi-option estimates** — strong upsell tool in the trade (present 3 tiers). The estimate module could support this later via line-item groups; not MVP-critical.
- **QuickBooks real-time sync** — correctly deferred; FieldEdge's main moat, but a project unto itself.

---

## Anti-Features (Deliberately Avoid)

The dominant research finding: **FSM builds fail by over-engineering.** ServiceTitan is repeatedly cited by small shops as "too big," scaring staff off and yielding only bare-feature usage. 56% of HVACR contractors underutilize their FSM. For a 1-2 tech shop, every one of these is a trap.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|--------------------|
| **AI/predictive scheduling & dispatch** | Solves a problem 1-2 techs don't have; high complexity, near-zero payoff | Manual drag-to-assign on the board. The dispatcher knows the schedule. |
| **Route optimization engine** | Value scales with tech count; useless at 1-2 techs | Map in the dispatch popup (already scoped) for eyeball routing. |
| **Warranty expiration alert/campaign engine** | Maintenance-marketing automation is a different product | Show warranty dates on the equipment record; look up reactively. |
| **Full RRULE recurrence engine** | Calendar-grade recurrence is a rabbit hole; few real recurring jobs | Simple interval (every N weeks/months) for repeating jobs (JOB-08). |
| **Advanced inventory: multi-warehouse, barcode, lot tracking** | Already correctly out of scope; enterprise-grade for a single van | Single-location qty-on-hand + reorder point (CAT-06). |
| **Predictive maintenance / asset lifecycle analytics** | Pure enterprise bloat; cited as a top "paid-for-but-unused" feature | Service history on the equipment record answers the real question. |
| **Sales commission / payroll modules** | Correctly out of scope; separate domains | Export data; handle elsewhere. |
| **Configurable workflow/status builder** | Letting users design their own status machine is enterprise feature creep | Hard-code the SF-parity status machine (JOB-03). It's known and stable. |
| **Deep custom-field framework everywhere** | "Custom fields on everything" balloons UI and query complexity | The scoped Custom Fields tab (JOB-11) is enough; resist expanding it. |
| **Batch edit / bulk operations** | Already out of scope; "never used" per discovery | Skip. |
| **In-app team chat / messaging** | Techs use phones/text; duplicating it gets ignored | Notes-for-techs field + SMS triggers cover communication. |
| **Gamification / leaderboards / tech scorecards** | Adoption killer for a 47-yr-old-average tech workforce; feels like surveillance | Keep the tech PWA boringly fast and minimal. |

**Guiding principle for the roadmap:** when a feature is debated, ask "does a 1-2 tech Chicago garage door shop touch this weekly?" If not, defer or cut. The competitive edge here is *fit and speed*, not breadth.

---

## Mobile Field Experience: What Techs Actually Need

Research is unusually consistent here, and it directly validates the lean TECH scope in PROJECT.md. Confidence MEDIUM-HIGH (multiple independent technician-adoption sources agree).

### What techs actually use (build these well)

1. **Today's jobs, fast** — list of assigned jobs with customer, address, arrival window, description, office notes. One tap to open. (TECH-02 ✓)
2. **Tap-to-update status** — On The Way / On Site / Started / Completed in one tap each. Status changes must be instant and obvious. (TECH-03 ✓)
3. **Tap-to-navigate** — address opens the phone's native maps app. (Implied; ensure address is a tappable maps link.)
4. **Tap-to-call customer** — phone number is a tappable dial link. (Add if not implicit in TECH-02.)
5. **Photos from camera** — before/after, minimal taps, auto-attached to job. (TECH-04 ✓)
6. **Signature capture** — on completion. (TECH-05 ✓)
7. **Completion notes** — quick text. (TECH-06 ✓)
8. **Equipment/spring specs lookup** — tech needs to see the door/opener/spring specs and prior service on site. *This may not be explicit in TECH scope — strongly recommend the tech PWA can read the service-location equipment record (CUST-04) and service history.* Garage-door FSM vendors universally put asset specs on the tech's phone; "wrong specs ordered" is a stated pain. **This is the most valuable addition to the mobile scope.**
9. **On-site payment** — Square swipe (INV-07) so the tech gets paid before leaving. Highest cash-flow lever.

### What gets built but techs avoid (don't over-invest)

- Complex multi-step forms (5-6 taps for a status update kills adoption; aim for 3-4).
- Deep menu trees — techs want surface-level access, not navigation.
- Anything requiring reliable signal to function (43% of calls are in poor coverage).
- Reports/dashboards on the tech view — techs don't want analytics; the office does.
- Manual time clocking with start/stop precision (payroll is out of scope anyway).

### The two hard requirements

- **Offline-first, not offline-tolerant.** Techs in basements and concrete commercial buildings will lose signal mid-job. Status updates, notes, and photos must queue locally and sync when signal returns. This is the #1 technician frustration in the research and a real differentiator. Budget engineering time for the offline queue/sync — it's the hardest part of the PWA and the most important.
- **Speed and minimal taps.** Average trade tech is ~47, not a power user. The bar is: faster and less error-prone than a clipboard. Every screen should be obvious without training.

---

## Feature Dependencies

```
Customer + Service Location  →  Equipment record (springs/door/opener specs)
Equipment record            →  Tech PWA spec lookup (recommended addition)
Catalog (products/services) →  Line items  →  Estimates & Jobs
Estimate                    →  Job (one-click conversion)
Job + status machine        →  Dispatch board (live pool)
Job completion              →  Invoice  →  Payment  →  Receipt email (webhook)
Invoice                     →  AR aging dashboard
Job status "On The Way"     →  SMS trigger (Twilio)
Job templates               →  faster Job/Estimate creation (pre-filled line items)
```

Critical path for a usable MVP: Customer/Location/Equipment → Catalog → Job + status → Dispatch board → Invoice + Payment → Tech PWA. Estimates and Reports can follow once the quote-to-cash loop works end to end.

---

## MVP Recommendation

The scope is already MVP-disciplined. Prioritize in this order for a working quote-to-cash loop:

1. **Customer / Location / Equipment** (with structured spring + door specs) — the data foundation.
2. **Catalog + line items** — required before any job can be priced.
3. **Job + status machine** — the core object.
4. **Dispatch board with live pool + Close & Invoice** — the owner's daily home; the retention feature.
5. **Invoice + payment (Square on-site, Stripe link) + receipt automation** — getting paid.
6. **Tech PWA (offline-first) with equipment/spec lookup** — the field half of the loop.

**Defer (already correctly out of scope or flagged here):** customer portal/online booking, QuickBooks sync, route optimization, two-way SMS, good-better-best estimates, service agreements, full inventory/PO. All are reasonable milestone-2 candidates; none belong in MVP.

**Two specific recommendations to confirm with the owner (10 minutes, high payoff):**
- Exact **spring spec fields** to reorder against (wire size / inside diameter / length / wind direction / cycles) vs the current "type, size, coil count."
- Whether **door color + model/series** belong on the door equipment record for panel reordering.

---

## Sources

Independent comparison and technician-adoption sources weighted over vendor marketing.

- [Skedulo — What Do Field Service Techs Want in a Mobile App](https://www.skedulo.com/blog/what-do-field-service-techs-want-in-mobile-app/) (MEDIUM)
- [Field Service Guide — Best Field Service App for Non-Tech-Savvy Technicians 2026](https://fieldserviceguide.com/best-field-service-app-for-non-tech-savvy-technicians-2026/) (MEDIUM — adoption stats: ~47 avg tech age, 60% vs 85% week-one adoption, 43% poor-coverage calls)
- [Brocoders — FSM Software Workflow Fit Guide](https://brocoders.com/blog/fsm-software-workflow-fit-guide/) (MEDIUM — 56% underutilization, "too big" small-shop complaints)
- [Workyard — Best FSM Software for Small Business](https://buildops.com/resources/best-field-service-management-software-for-small-business/) (MEDIUM — over-engineering / unused-feature analysis)
- [Jobber — Housecall Pro vs Service Fusion comparison](https://www.getjobber.com/comparison/housecall-pro-vs-service-fusion/) (MEDIUM — competitor positioning; vendor-published, weighted accordingly)
- [SpotSaaS — Service Fusion vs FieldEdge vs Jobber](https://www.spotsaas.com/compare/service-fusion-vs-fieldedge-vs-jobber) (MEDIUM)
- [MSI Data — Garage Door Service Software (Service Pro)](https://www.msidata.com/industries/garage-door/) (MEDIUM — garage-door asset/spec/offline patterns)
- [Smart Service — Garage Door / Overhead Door Software](https://www.smartservice.com/industry/garage-door-software) (MEDIUM)
- [Creative Job Hub — Garage Door Software: Spring Tracking](https://www.creativejobhub.com/garage-door-field-service-software/) (LOW-MEDIUM — spring/inventory tracking patterns)
- [ServiceTitan — How to Price Garage Door Jobs](https://www.servicetitan.com/blog/garage-door-pricing) (MEDIUM — flat-rate vs parts+labor, emergency pricing, high-cycle upsell)
- [HouseCall Pro — Garage Door Price Guide 2026](https://www.housecallpro.com/resources/garage-door-price-guide/) (MEDIUM — labor rates, add-on structure)
- [monday.com — How dispatching software transforms service management](https://monday.com/blog/service/dispatching-software/) (LOW-MEDIUM — dispatcher value: live view, faster billing, on-site payment)
- [BuildOps — Field Technician App](https://buildops.com/resources/field-technician-app/) (LOW-MEDIUM — mobile feature expectations)
