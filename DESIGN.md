# DESIGN.md — PersonalBrain

## Direction
Warm brutalist editor. A single dark canvas that feels like a high-end IDE mixed with a contact sheet light table. Muted, slightly desaturated, with one warm accent for action and one cool accent for AI.

## Palette
- **Background**: `#0a0a0a` (near-black, warm undertone)
- **Surface**: `#141414` / `#1a1a1a`
- **Surface hover**: `#1f1f1f`
- **Border**: `#262626`
- **Border hover**: `#333333`
- **Text primary**: `#e5e5e5`
- **Text secondary**: `#8a8a8a`
- **Text tertiary**: `#525252`
- **Accent warm**: `#d4a373` (amber/tan — used for active states, streak, photo kanban)
- **Accent cool**: `#7aa2f7` (soft blue — used for AI, code, focus)
- **Accent danger/muted**: `#f38ba8` very sparingly

No gradients on backgrounds. Gradients allowed only on the streak gauge ring.

## Typography
- **Sans**: Geist Sans
- **Mono**: Space Mono
- Labels, metadata, timestamps, buttons: mono uppercase, letter-spacing widened.
- Body: sans, 13–14px, leading-relaxed.

## Elevation
No box-shadows. Depth via 1px borders and subtle background shifts only.

## Components

### Cards
- Background: surface color
- Border: 1px solid border color
- Border-radius: 8px
- Hover: border hover color, no transform
- No badges, no icons inside content unless functional

### Buttons
- Primary: transparent background, border, mono uppercase label, warm accent on hover
- Icon buttons: square, border, hover background shift

### Inputs
- Background: surface
- Border: border color
- Focus: border accent cool
- No glowing rings

### Sidebar / panels
- Fixed/docked panels separated by 1px vertical borders
- Collapsible with a simple bar icon

## Layout
- Desktop: narrow left icon rail (48px), main content area, right AI panel (320px collapsible)
- Mobile: icon rail hidden, top tab bar, content stacks, chat as full panel

## Motion
- Transitions: `transition-colors duration-200` for color/border, `transition-all duration-300` for width/height
- Loading: single small spinner or 3-dot pulse, never more than 2s loops
- No parallax, no infinite floating, no background shimmer

## Chat style
- Terminal transcript: `assistant` / `toi` labels
- AI messages: left cool accent dot
- User messages: right warm accent dot
- Input: single-line auto-growing textarea, submit on Enter, Shift+Enter newline

## Kanban style
- Columns separated by consistent 1px vertical borders
- Column headers: mono uppercase + small square accent marker
- Cards: minimal metadata (artist, venue, date)
- Add card button: dashed border, centered + icon

## LeetCode style
- Two-column layout on desktop: streak gauge left, editor + response right
- Response block: surface background, top bar with cool dot and "Reponse" label
