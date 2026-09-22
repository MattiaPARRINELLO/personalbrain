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
- Desktop: narrow left icon rail (68px), main content area, right AI panel (340px collapsible)
- Mobile: icon rail hidden, top tab bar, content stacks, chat as full panel

## Motion
- Transitions: `transition-colors duration-200` for color/border, `transition-all duration-300` for width/height
- Loading: single small spinner or 3-dot pulse, never more than 2s loops
- No parallax, no infinite floating, no background shimmer — **sauf sur la console IA**, voir ci-dessous

## Chat style
- Terminal transcript: `assistant` / `toi` labels
- AI messages: left cool accent dot
- User messages: right warm accent dot
- Input: single-line auto-growing textarea, submit on Enter, Shift+Enter newline

### Console IA — exception assumée
La console IA est la seule zone autorisée à déroger aux règles « pas de dégradé
en fond », « pas de box-shadow » et « pas d'animation infinie ». Elle couvre
trois surfaces : l'accueil du chat (`components/chat/HomeHero.tsx`), le panneau
de flux (`components/layout/ContextPanel.tsx` + `FluxTimeline.tsx`) et
l'historique (`components/chat/SessionSidebar.tsx`). Le reste de l'app garde les
contraintes d'origine.

**Ambiance** (`components/chat/HomeAmbience.tsx`, accueil uniquement)
- Dégradés radiaux très basse opacité (`--accent` 22 %, `--accent-cool` /
  `--accent-warm` 13 %). Le dégradé s'éteint **avant** les bords du conteneur —
  jamais de liseré rectangulaire — et ne se met pas à l'échelle (seule l'opacité
  respire, 28 s).
- Trame de 56 px masquée en cercle, qui dérive d'une cellule en 60 s
  (`background-position`, pour que le masque reste fixe).
- 12 particules montantes (18–29 s, dérive latérale ±20 px, opacité ≤ 0,5).
  **Valeurs figées**, jamais tirées au hasard : le rendu serveur et le premier
  rendu client doivent coïncider (pas d'erreur d'hydratation).

**Inactivité (idle)**
- Anneau conique de 1,5 px tournant en 24 s autour du badge de l'accueil.
  Masqué au centre (`.home-conic-ring`) pour ne jamais recouvrir l'ambiance.
- Flottement du badge sur 8 s (±5 px) et halo qui respire sur 9 s.
- Lueur qui respire (5,5 s) **réservée aux éléments vivants** : rendez-vous en
  cours, rappel en retard. Jamais plus d'une poignée à l'écran.
- Curseur de veille clignotant (1,15 s) en fin de ligne de briefing : l'IA
  attend une instruction.
- Balayage lumineux (13 s) sur les en-têtes de la console, un seul à l'écran.
  Le sheen de la carte principale de l'accueil reste à 9 s.
- Changement de vue du panneau : remontage par clé React + `flux-enter` (340 ms),
  donc l'animation rejoue à chaque bascule.

**Composition**
- Accueil : contenu centré verticalement, `max-w-lg`. eyebrow date + heure →
  salutation → briefing → carte du prochain rendez-vous → puces de contexte →
  4 raccourcis. Entrée échelonnée 620 ms (délais inline 60 → 330 ms).
- Panneau : en-tête sur deux lignes (titre + heure live + repli, puis sélecteur
  segmenté de 5 vues). Vue « Flux » = une ligne de temps unique qui fusionne
  cours, événements agenda et rappels, groupée par jour avec une puce
  « maintenant » ; puis inbox / code / photos en dessous. Un bloc « En retard »
  rouge plafonné à 4 entrées précède la ligne de temps.
- Historique : en-tête compact (badge 32 px + titre + sous-titre), action
  principale teintée à la place du bouton en pointillés, groupes par jour avec
  compteur, session active marquée d'une barre d'accent, bandeau de 3 compteurs
  en pied de panneau.
- Le repli et le mobile restent inchangés ; `prefers-reduced-motion` neutralise
  déjà toutes ces animations globalement (`app/globals.css`).

## Kanban style
- Columns separated by consistent 1px vertical borders
- Column headers: mono uppercase + small square accent marker
- Cards: minimal metadata (artist, venue, date)
- Add card button: dashed border, centered + icon

## LeetCode style
- Two-column layout on desktop: streak gauge left, editor + response right
- Response block: surface background, top bar with cool dot and "Reponse" label
