---
name: ui-design
description: How to make the visual decisions of a screen — hierarchy, type, color, spacing, depth — and how to repair the ones already made wrong. Works for web and mobile. Runs BEFORE and WHILE writing UI, not after. Each project supplies its own data in a `ui-profile`. Triggers - "/ui-design", "design this screen", "this looks off", "improve the design of", "fix the UI of", or when starting or reworking any screen or component.
---

# UI Design

*© 2026 Jordi Santamaria Portoles. CC BY 4.0 — free to use and adapt with attribution.
Original: https://github.com/jordisantamaria/claude-ui-design-skill*

Everything you need in order to decide is here. If a rule in this skill looks arguable,
argue it against the screen in front of you, not against an authority that backs it.

Living document: it started in September 2026 and grows with every screen that comes out
wrong. See CONTRIBUTING.md before adding to it.

## First: load this project's profile

This skill carries the judgment. The **data** — palette, scales, platform, existing
utilities, what is broken today — belongs to each repo and lives in its profile. Look for it
in this order and read it before touching anything:

1. `<repo>/.claude/ui-profile.md` — the project's own
2. `~/.claude/ui-profiles/<repo-name>.md` — the personal one, for other people's repos

**With no profile, do not improvise tokens.** Measure first (section 9) and write the
profile: half an hour there prevents months of invented decisions. If the user is in a hurry,
apply only what does not depend on tokens — hierarchy and spacing — and say so.

## What this skill is and is NOT

It asks **does this read at a glance?**, and it runs BEFORE and WHILE. If you get here with
the screen already written, you are late and decisions will have to be redone.

It is not a usability gate. If the project has one, that runs AFTER and asks something else:
whether, on top of looking right, it works. Keyboard, empty states, errors, focus, screen
readers. Both are needed and they do not overlap.

## The code already there is NOT the reference

This comes first because it is the strongest reflex: when writing a screen, you open the file
next door and follow its style. In a project with visual debt, that propagates the defect.

Each repo's profile carries its list of what is broken, measured. **Until those numbers come
down, when an existing file contradicts this skill, the skill wins.** Copying the unreadable
gray from the neighbouring component is not respecting a convention: it is inheriting a bug.

## 1. Hierarchy: it is the work, not the decoration

When everything competes for attention, the screen reads as a wall. Before writing anything,
decide **what is primary**, what is secondary and what is tertiary. A screen has ONE primary
element. If it has two, you have not decided.

**Size is the last resort, not the first.** To make something stand out, in this order:

1. **Weight** — semibold. Leave the size where it is.
2. **Color** — raise the contrast of the primary; do not push the rest below AA.
3. **Size** — only if 1 and 2 are not enough.

Shrinking and lightening are the two wrong ways to push something down: both are paid for in
legibility. Raising the weight of the primary is free. To push something down, softer color
first — without leaving AA — and size after.

Two weights are enough for UI: one regular and one strong. **Never below regular**: at small
sizes a light weight does not read, and even less in CJK.

**Make something stand out by pushing down its neighbours.** If the main element does not
stand out and there is nothing left to add to it, take from the ones around it. An active
item stands out more when the inactive ones dim than when the active one lights up. This
holds for whole blocks too: if a sidebar competes with the content, remove its background
instead of giving more to the content.

**Labels are the last resort.** The format usually says what a value is already:
`2026-09-08` is a date, `¥3,000` a price, `a@b.com` an email. When the format is not enough,
context almost always is. And when a label is genuinely needed, fuse it with the value —
"12 in stock" rather than "Stock: 12" — or treat it as support: smaller and softer than the
value. The exception is the dense data screen where the **label is what people look for** (a
spec table): whoever reads it scans for "depth", not for "7.6 mm", so there the label is read
first and is not pushed down.

**Icons carry weight.** A solid icon next to text covers more surface and takes the
attention. If it unbalances, lower its contrast. And the other way around: a 1px border that
is too subtle is fixed by thickening it before darkening it.

**Actions have a pyramid.** Primary: solid, high contrast, one per screen. Secondary: outline
or soft background. Tertiary: link style. A destructive action is not automatically red and
large: if it is not the main action, it goes as secondary or tertiary, and the big red is
reserved for the confirmation step.

**Visual hierarchy is not document hierarchy.** A heading's semantic level says what it is,
not how big it goes. Many section titles work as labels: the content is the protagonist, not
the caption.

**A component's shape is not a given.** Knowing which props a `Select` has is not the same as
knowing which shape it should have here. A dropdown is not required to be a list of links in
a white box: it can carry sections, two columns, supporting text or icons. Radios that are
the central decision of the screen read far better as selectable cards than as a stack of
little circles. A table can merge two related columns — if that column does not need sorting
— and gain hierarchy. The rule: use the library component as the base, but **do not inherit
its default shape without asking whether it is the one this content calls for**.

## 2. Type

**Short scale, one job per step.** It is not "everything big": it is that each size has a
job. The concrete scale lives in the profile; the roles are always these:

| | What for |
|---|---|
| Body | What people came to read |
| Support | What is still read in full: secondary description, subtitle |
| Metadata | A unit, a counter, an auxiliary date next to a value that already reads |

**The metadata step must never be the most used one.** If it is, what sits there is no longer
metadata: it is the content, written too small.

**"It does not fit" is almost never fixed by shrinking.** If a screen does not fit, there is
too much content or too little hierarchy. Shrinking everything equally pays legibility
without buying separation, because the proportion between elements does not change. Strong
weight + dark color next to regular weight + mid color separates far more than two different
sizes, and takes up nearly the same room: **weight and color contrast are free in pixels,
size contrast is not.**

**Line height inversely proportional to size**, and proportional to line length. Small text
or long lines need more air; a large headline can go at 1.

**Line length**: 45-75 characters in Latin script. **In Japanese, 15-25** — a Japanese
paragraph spanning a wide screen tires the reader much sooner than an English one.

**Alignment**: left by default. Centred only for blocks of one or two lines — if it runs to
three, the fix is to rewrite it shorter. Numbers in a table go right, so decimals land in the
same column.

**Baseline, not centre.** When mixing two sizes on the same line, align them on the baseline,
not on the centre. It is a reference the eye already perceives.

**`letter-spacing`**: leave it as it comes. The two exceptions are Latin: tightening a
headline set in a face meant for small sizes, and opening up uppercase text, which otherwise
reads worse. **In CJK never touch it**: it breaks the rhythm of the character box.

## 3. Color

**Contrast is a number, not an opinion.** AA asks for 4.5:1 on normal text and 3:1 on large
text and on the graphics that identify a control. Do not eyeball it: compute it. If the
project has a contrast test, that is the referee.

**You need more colors than you think**: 8-10 grays, 5-10 shades of each primary, and accents
for states. Nothing gets built out of five hex values. And define them up front instead of
generating variants on the fly with `lighten`/`darken`, which is how you end up with 35
nearly identical blues.

**Gray on a colored background, no.** Lightening text works on white because what you are
really doing is lowering contrast. On color, a gray looks dirty, and white with opacity looks
washed out or disabled — and over an image, the background shows through the text. Pick the
color by hand: same hue as the background, then adjust saturation and lightness until it sits
right.

**For colored text on a colored background**, if you cannot reach the ratio without
approaching white, rotate the hue towards a brighter one (cyan, magenta, yellow) instead of
raising lightness. And the other way around: if the dark background AA demands steals the
focus of the screen, invert it — dark colored text on a light colored background — instead of
darkening the background.

**Grays do not have to be gray.** A touch of blue cools them, a touch of yellow warms them.
Raise saturation at the ends of the scale or the light and dark steps look washed out.

**Color never communicates alone.** A state, a trend or a warning needs an icon, text or
position as well. It holds for color blindness, and also because color is lost in bright
sunlight — decisive if the app is used outdoors.

## 4. Spacing

**Start generous and take away.** Air is subtracted, not added: if you add it, you always
land on the minimum that keeps it from looking bad, which is far from looking good. The
deliberate exception is the dense data screen, where tightening is the right call — but let
it be a decision, not the result of not having thought.

**Short scale, and no indistinguishable values.** Between two adjacent values there has to be
a good 25%. If your scale lets you pick between 12 and 14, it is not helping you decide: it
is charging you for a decision nobody will perceive.

**Ambiguous spacing = a reading bug.** Always more space AROUND a group than INSIDE it. If the
gap between a label and its field equals the gap to the next field, you cannot tell what
belongs to what — and in a form that ends with the value typed in the wrong box. The same
happens in lists and in section headings.

**Do not stretch because there is room.** Give each element the width it needs, not the width
left over. And do not scale everything proportionally: as the screen gets smaller, the large
shrinks faster than the small, and the padding of a large button is more generous than that
of a small one, not proportional.

## 5. Depth

In order of cost, cheapest first:

1. **Color** — lighter than the background comes forward, darker recedes. It works even in
   flat designs and costs nothing.
2. **Accent edges** — a band of color on the edge of a card, under a headline or beside a
   notice gives character without knowing how to draw. It is the most profitable item on this
   list: try it before anything else.
3. **Overlap** — having an element cross the boundary between two backgrounds creates real
   layers. With images, give them a border in the background color so they do not clash with
   each other.
4. **Shadow** — for what genuinely floats: a menu, a modal. The larger and softer it is, the
   closer it feels and the more attention it takes, so the shadow scale is an elevation
   scale: pick by where the element sits on the Z axis, not by how the shadow looks.

If you simulate light, have it come from above: lighter top edge and a short shadow below for
what protrudes, and the reverse for what is recessed. Without overdoing it — photographic
realism in a UI dirties it.

**Fewer borders.** Before separating two things with a border, try slightly different
backgrounds, a soft shadow, or simply more space. One border per separation leaves the screen
dirty.

**Consistent radius.** Mixing square and rounded corners on the same screen looks worse than
either option on its own. The value lives in the profile.

## 6. User-uploaded content

You control neither its framing, nor its contrast, nor its background.

- **Fix the shape**: a fixed-size container with a centre crop, or the original ratio takes
  your grid apart.
- **Keep the background from merging**: an image with a light background on a light background
  loses its silhouette. A subtle inner shadow outlines it better than a border, which clashes
  with the colors of the image.
- **Text over a photo: almost always, no.** Before solving *how* to put it on top, ask whether
  it has to be on top at all. Two cases, treated in opposite ways:
  - **The image is decoration** (a hero, a marketing cover): it is there to support the
    message, so text on top is the norm.
  - **The image is the content** (a photo somebody uploaded): they came to *look at it*. Every
    pixel of UI on top — text, a gradient, a dark scrim, a button — covers what they wanted to
    see and makes it worse. The place for the text is outside: below, beside, or in a bar that
    can be hidden.

  When it genuinely has to go on top — a small marker, an ephemeral control — keep it minimal,
  make it dismissible, and then yes: **the problem is not the text, it is the image**. Lower
  its contrast, put a semi-transparent layer over it, tint it, or give the text a soft shadow
  with no offset, so it reads as a halo and not as a drop shadow.
- **Every drawing has a size it was made for, and SVG does not save you from that.** Being
  vector avoids pixelation, not the problem: an icon drawn for 24px carries a stroke width and
  a level of detail chosen for 24px, and when you scale it **the stroke scales with it**. A
  1.8 stroke at 24px is proportionate; the same icon at 72px carries a 5.4 stroke, which looks
  coarse — and its geometry, simplified to the bone so it reads small, looks poor and empty
  when large. It is the same thing that happens with typefaces, which are vector too: a
  display face does not work at 10px and a text face looks clumsy at 100px. Downward it is the
  opposite: that 1.8 stroke at 12px falls below one physical pixel and blurs, and a detailed
  logo shrunk to a favicon turns to mush.

  If a large hole needs filling, put the icon **at its own size** inside a shape with a
  background, or use one drawn for that size. And a full screenshot shrunk to 70% cannot be
  read: crop a piece of it, or take it at a narrower width.

## 7. What changes between web and mobile

**Mobile**
- There is no hover. Its equivalent is the *pressed* state: on press, the element sinks
  (smaller shadow, or none).
- The units (`dp`, `pt`, `sp`) are already calibrated to the viewing distance of a phone.
  Being closer to the screen is **not** an extra discount for smaller sizes: it is already
  counted. That is why the guidelines ask for large body text, not small — iOS 17pt, Material
  16sp, and in both 12 is the *caption* size, not the body size.
- Text scales with the system setting unless you disable it, and on iOS it reaches 310%. A
  screen that only fits with text at the minimum is already broken on the phone of anybody who
  raised their font size.
- The minimum touch target is 44×44pt (iOS) / 48×48dp (Android), no matter how small the icon
  inside it is.

**Web**
- Hover exists: use it for the secondary. An auxiliary link can reveal its underline only on
  hover instead of competing all the time.
- 12-column grids distribute percentages. Not everything should be fluid: what has an optimal
  width (a sidebar, a login card) goes fixed-width or `max-width`, and only shrinks once the
  screen drops below that.
- `em` composes badly for font sizes — nest two and you are off your scale: use `px` or `rem`.
  For paragraph widths it is useful, because it follows the text size.
- A wide window does not oblige you to fill it.

**What is NOT here, on purpose**: the Material catalog, the whole HIG, the API of each
component. That gets looked up when needed and gains nothing from being written down. What is
here are the few hard numbers that get broken in practice, not for not knowing them — 44pt is
known by everyone — but because in the moment of drawing a 24px icon nobody asks.

**And versioned things are looked up, not recalled.** Material tokens changed from M2 to M3,
iOS changed its backgrounds with Liquid Glass, and MUI does not behave the same in v5 as in
v6. If a decision depends on a detail of a specific version — a token name, the height of a
system component, a default — **look it up in that version's documentation**. A number
recalled from memory and delivered with confidence is worse than no number.

## 8. Repairing what is already written

In a project with debt, most UI work is repair, not new construction. Two categories, and
confusing them is the expensive mistake:

**What is fixed in a sweep**, because it does not depend on context: an unreadable color is
unreadable on any screen, and two indistinguishable spacing values are indistinguishable on
any screen. Substitution with a fixed criterion, without opening the app.

**What CANNOT be swept: hierarchy.** What is primary on a screen is a property of that screen.
No `sed` decides it. This goes screen by screen, looking at them.

**The order**: color first (it is what prevents reading, and it sweeps) → size and weight
together and per screen, because they are the same decision → spacing → radii.

**How not to break it**

- **A `replace_all` on a color is dangerous**: change it only where the color is **text**, not
  where it is a border, a background or part of a decorative gradient.
- **The same token can be fine in another role.** A gray that fails as text (4.5:1) can pass
  comfortably as an icon or a border (3:1). Fix the usage, not the token, unless the token is
  wrong in every role it plays.
- **Every batch goes through the project's usability gate**, if there is one. Raising font
  sizes changes heights: it is the easiest way to introduce a clipping or overlap bug.
- **And it is checked on a real device**, not only in the simulator.

## 9. How a project profile is written

A profile is the data this skill cannot know. To write it, measure — do not assume. Count the
classes or tokens the project actually uses and sort them by frequency: font sizes, weights,
text colors, spacing values, radii, shadows. The numbers come from there, and the list of what
is broken comes from the numbers.

A profile has:

1. **Platform and stack** — and what it implies (data density, CJK, dark mode, offline…).
2. **The real systems** — the type scale with the role of each step, the palette, the spacing
   scale, the radii.
3. **The utilities that already exist** — contrast functions, base components, tokens. So that
   nobody reimplements what is already there.
4. **The measured state, dated** — what is broken and by how much, and how it has to end up.
5. **The signed decisions** — the exception somebody already made deliberately, with the
   reason. Without this, every review reopens the same argument.
6. **The project's gate**, if there is one, and what it covers so it is not duplicated here.