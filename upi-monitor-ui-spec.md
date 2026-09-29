# UPI Payment Monitor: UI Redesign Spec

Implement this design for a mobile-first "UPI Payment Monitor" screen. It listens for payment notifications (GPay, GPay Business, PhonePe, Paytm, other UPI) and announces them by voice. The reference implementation is a single HTML file (`upi-monitor.html`). Match it visually and behaviorally, using whatever framework the project already uses.

## 1. Goals

- Modern, clean, card-based look with clear hierarchy.
- The most important information is today's total received amount.
- Every payment is scannable at a glance: app, payer, bank, time, amount.
- Supports light and dark themes automatically.
- Mobile first, content column max width 460px, centered on larger screens.

## 2. Design tokens

### Light theme (default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#F3F5FA` | Page background |
| `--surface` | `#FFFFFF` | Cards, chips, icon buttons |
| `--surface2` | `#EAEEF7` | Secondary surfaces |
| `--line` | `#E1E6F0` | Borders |
| `--text` | `#121829` | Primary text |
| `--muted` | `#69728A` | Secondary text |
| `--accent` | `#4F5BFF` | Interactive accent |
| `--accent-soft` | `#E6E8FF` | Accent backgrounds |
| `--money` | `#0E9F6E` | Received amounts |
| `--money-soft` | `#DDF5EA` | New payment flash |
| `--hero1` / `--hero2` | `#1B2340` / `#2B3670` | Hero gradient stops |
| `--shadow` | `0 8px 24px rgba(30,40,90,.08)` | Card shadow |

### Dark theme

Apply with `prefers-color-scheme: dark`, and also with `[data-theme="dark"]`.

| Token | Value |
|---|---|
| `--bg` | `#0B0F1C` |
| `--surface` | `#141A2C` |
| `--surface2` | `#1C2440` |
| `--line` | `#242D4A` |
| `--text` | `#EEF1FA` |
| `--muted` | `#8F99B8` |
| `--accent` | `#7B86FF` |
| `--accent-soft` | `#232B57` |
| `--money` | `#3DDC9B` |
| `--money-soft` | `#123A30` |
| `--hero1` / `--hero2` | `#1E2A66` / `#3A2F8F` |
| `--shadow` | `none` |

### App brand colors

| App | Color | Avatar letter |
|---|---|---|
| GPay / GPay Biz | `#3B82F6` | G |
| PhonePe | `#7C3AED` | P |
| Paytm | `#0EA5E9` | T |
| Other UPI | `#F59E0B` | U |

### Typography

- Font: **Plus Jakarta Sans** (weights 400 to 800), with a fallback to `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
- Use `font-variant-numeric: tabular-nums` on all currency amounts.
- Sentence case for all labels. Do not use all-caps labels.

| Element | Size / weight |
|---|---|
| Screen title | 20px / 800, letter-spacing -0.02em |
| Subtitle | 13px / 400, muted |
| Hero amount | 46px / 800, letter-spacing -0.03em (the ₹ symbol is 26px / 600 at 70% opacity) |
| Section heading | 17px / 800 |
| Payer name | 15.5px / 700 |
| List amount | 16px / 800, `--money` color |
| Meta and time | 12 to 13px, muted |

### Shape and spacing

- Page padding: 16px sides, 18px top, 40px bottom.
- Hero radius 26px. List cards 20px. Icon buttons 14px. Avatars 14px. Chips are fully rounded (pill).
- Gap between list cards: 10px.
- Respect safe areas: `padding-top` and `padding-bottom` use `env(safe-area-inset-*)`. Use `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.

## 3. Layout (top to bottom)

```
┌──────────────────────────────────────┐
│ Payment monitor            [🔊] [⟳]  │  header
│ GPay, PhonePe, Paytm and more        │
├──────────────────────────────────────┤
│ ● Listening for payments   [Refresh] │  hero card (gradient)
│                                      │
│ Received today                       │
│ ₹3,501.00                            │
│ 3 payments today                     │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░  split bar  │
│ ● GPay Biz ₹2,501   ● PhonePe ₹1,000 │  legend
├──────────────────────────────────────┤
│ (All) GPay  GPay Biz  PhonePe  Paytm │  filter chips, scroll sideways
├──────────────────────────────────────┤
│ Test voice  [₹500 PhonePe] [₹500 …]  │  dashed card
├──────────────────────────────────────┤
│ Recent payments             3 shown  │
│ ┌──────────────────────────────────┐ │
│ │ [G] Payment received    +₹1.00   │ │  payment card
│ │     GPay Biz · Merchant…  3:24pm │ │
│ └──────────────────────────────────┘ │
│ ... more cards                       │
└──────────────────────────────────────┘
```

## 4. Components

### 4.1 Header
- Left: title "Payment monitor" and subtitle "GPay, PhonePe, Paytm and more".
- Right: two 42×42 icon buttons (surface background, 1px line border, radius 14).
  - **Voice** toggle. `aria-pressed` reflects state. When on, the background is `--accent-soft` and the icon is `--accent`.
  - **Sync** re-fetches or re-renders the data.
- Icons are 20px outline SVGs with a 1.8 stroke: speaker with waves, and circular arrows.

### 4.2 Hero card
- Background: `linear-gradient(140deg, --hero1, --hero2)`. Text is white.
- Top-left: "Listening for payments" pill. It has a translucent white background and a green dot (`#48F0A8`) with a pulsing ring animation of 2s that loops. Disable the animation under `prefers-reduced-motion`.
- Top-right: "Refresh" pill button with a translucent white background.
- Below: label "Received today" at 75% opacity, then the big amount, then "N payments today" (singular "payment" when N is 1).
- **Split bar:** 8px tall, fully rounded, with 2px gaps. Each segment's width is that app's share of today's total, and it animates its width in 0.5s. Segment colors use lighter tints on the dark hero: GPay `#7FB0FF`, PhonePe `#B79CFF`, Paytm `#67D3FF`, Other `#FFC966`.
- **Legend:** small 12px text below the bar. Each entry has a colored dot, the app name and its amount (for example, "PhonePe ₹1,000").

### 4.3 Filter chips
- A horizontally scrollable row with the scrollbar hidden. It bleeds to the screen edges (negative margin).
- Chips: All, GPay, GPay Biz, PhonePe, Paytm, Other UPI.
- Inactive chip: surface background, line border, muted text.
- Active chip (`aria-pressed="true"`): background `--text`, text `--bg`.
- Tapping a chip filters the payment list by app. "All" shows everything.

### 4.4 Voice test card
- Dashed 1px border, radius 18, surface background.
- Label "Test voice", followed by small accent-soft pill buttons: "₹500 PhonePe", "₹500 GPay", "₹750 Paytm".
- Tapping a button adds a fake payment to the top of the list, updates the hero, flashes the new card, and speaks it (see section 5).

### 4.5 Payment list
Heading row: "Recent payments" on the left and "N shown" on the right.

Each payment is a card (surface background, line border, radius 20, soft shadow in light mode):

- **Avatar:** 44×44, radius 14, in the app's brand color, with a white bold letter.
- **Middle:** payer name (bold, one line, ellipsis) and, below it, meta `"{App} · {Bank}"` (muted, one line, ellipsis).
- **Right:** amount `+₹{amount}` in `--money` green, and the time (muted) below it.
- **Tap to expand:** the whole row is a button. Expanding reveals a detail section with:
  - Received via: app
  - Account: bank
  - UTR: reference number, or "Not shown in notification" if unavailable
- Set `aria-expanded` on the row button.
- **New payment:** the card background flashes `--money-soft` for about 1.2s.
- **Empty state** (filter has no results): dashed card saying "No payments from {App} yet. New ones appear here as they arrive."

## 5. Behavior

- **Total** = sum of today's payments. Format with the Indian grouping locale: `Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })`.
- **Voice announcements:** when a payment arrives and voice is on, speak `"{App} received {amount} rupees from {name}"` using `SpeechSynthesis` (`lang = "en-IN"`). Cancel any speech in progress first. Wrap it in try/catch. Toggling voice on says "Voice on".
- **Filter** only affects the list. The hero total and split bar always show all of today's payments.
- **Refresh / Sync** re-render from the data source. Wire these to the real notification listener or backend.
- New payments are inserted at the top of the list.

## 6. Data model

```ts
type Payment = {
  id: number;
  app: "GPay" | "GPay Biz" | "PhonePe" | "Paytm" | "Other UPI";
  name: string;        // payer or "Business customer"
  bank: string;        // e.g. "ICICI Bank ••3392"
  time: string;        // e.g. "2:58 pm"
  amt: number;         // in rupees
  ref?: string;        // UTR, optional
};
```

Sample data (matches the original screenshot):

| App | Name | Bank | Time | Amount | UTR |
|---|---|---|---|---|---|
| GPay Biz | Payment received | Merchant business account | 3:24 pm | 1 | none |
| GPay Biz | Business customer | ICICI Bank ••3392 | 2:58 pm | 2500 | UPI4290182910 |
| PhonePe | Anil Kumar | State Bank of India ••4589 | 2:41 pm | 1000 | none |

## 7. Accessibility and quality rules

- Visible keyboard focus: 2px `--accent` outline with a 2px offset.
- All icon-only buttons need `aria-label`.
- Filter chips use `aria-pressed`. Expandable rows use `aria-expanded`.
- Respect `prefers-reduced-motion`.
- Text contrast must stay readable in both themes.
- No horizontal page scroll. Only the chip row and test-button row scroll sideways.
- Use only outline SVG icons, not emoji.

## 8. Copy rules

- Sentence case everywhere.
- Plain wording: "Received today", "Recent payments", "Listening for payments".
- Keep the same name for the same action across the UI ("Refresh" stays "Refresh").

## 9. Instruction for the AI

Rebuild this screen in the project's existing stack (React, Flutter, native Android or whatever is in use) using the tokens, layout and behavior above. Do not change the visual hierarchy. Keep the design tokens as variables or a theme object, so light and dark can switch cleanly. Connect the payment list to the app's real notification listener instead of the sample data.
