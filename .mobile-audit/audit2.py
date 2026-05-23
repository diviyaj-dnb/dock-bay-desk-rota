"""Follow-up: properly interact with VISIBLE mobile-only elements,
test team picker bottom sheet, test simulated iOS-Safari address bar collapse,
test landscape orientation, test small phones (320px iPhone SE)."""

from playwright.sync_api import sync_playwright
import json
import time

URL = "https://dock-bay-desk-rota.vercel.app/"
OUT = "/Users/diviyajayengia/Downloads/desk-rota-audit/.mobile-audit"

VIEWS = [
    {"name": "iphone-se", "w": 320, "h": 568},  # smallest common phone
    {"name": "iphone14", "w": 390, "h": 844},
    {"name": "iphone14-tinyaddr", "w": 390, "h": 700},  # simulate iOS Safari with bottom bar shown
    {"name": "iphone-landscape", "w": 844, "h": 390},  # landscape phone — still triggers md: at 768+ — WILL flip to desktop
    {"name": "pixel7-landscape", "w": 915, "h": 412},
]


def visible_button(page, text_match):
    """Find a button whose text matches and is actually visible."""
    btns = page.locator(f'button:has-text("{text_match}")')
    n = btns.count()
    for i in range(n):
        b = btns.nth(i)
        if b.is_visible():
            return b
    return None


def run(p, view):
    name = view["name"]
    print(f"\n=== {name} ({view['w']}x{view['h']}) ===", flush=True)
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": view["w"], "height": view["h"]},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        is_mobile=True,
        has_touch=True,
        device_scale_factor=2,
    )
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(f"{m.type}:{m.text}") if m.type == "error" else None)

    page.goto(URL, wait_until="domcontentloaded", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=20000)

    # Wait for floor plan
    try:
        page.wait_for_selector('img[alt="Office floor plan"]', timeout=10000)
    except Exception:
        pass

    page.screenshot(path=f"{OUT}/{name}-initial.png", full_page=False)

    # Diagnose header overflow on small phones
    header_diag = page.evaluate(
        """() => {
          const rows = Array.from(document.querySelectorAll('div.md\\\\:hidden > div'));
          return {
            innerWidth: innerWidth, innerHeight: innerHeight,
            headerBottom: (() => {
              const all = rows.map(r => r.getBoundingClientRect().bottom);
              return all.length ? Math.max(...all) : null;
            })(),
            rows: rows.map(r => {
              const rr = r.getBoundingClientRect();
              return {
                w: rr.width, h: rr.height, sw: r.scrollWidth, cw: r.clientWidth,
                hScrollX: r.scrollWidth > r.clientWidth,
                text: (r.innerText||'').slice(0,80).replace(/\\n/g,' | ')
              };
            }),
            floorPlanRect: (() => {
              const img = document.querySelector('img[alt="Office floor plan"]');
              return img ? img.getBoundingClientRect().toJSON() : null;
            })(),
          };
        }"""
    )
    print(f"  innerWidth={header_diag['innerWidth']} innerHeight={header_diag['innerHeight']}", flush=True)
    print(f"  headerBottom (last mobile row bottom): {header_diag['headerBottom']}", flush=True)
    for i, r in enumerate(header_diag["rows"]):
        print(f"  row[{i}] w={r['w']:.0f} h={r['h']:.0f} sw={r['sw']} cw={r['cw']} overflowX={r['hScrollX']} | {r['text']}", flush=True)
    if header_diag.get("floorPlanRect"):
        fp = header_diag["floorPlanRect"]
        print(f"  floor plan: top={fp['top']:.0f} bottom={fp['bottom']:.0f} h={fp['height']:.0f} (viewportH={header_diag['innerHeight']})", flush=True)
        if fp["bottom"] > header_diag["innerHeight"]:
            print(f"  ⚠ FLOOR PLAN OVERFLOWS VIEWPORT BOTTOM by {fp['bottom'] - header_diag['innerHeight']:.0f}px", flush=True)

    # On true mobile (<768), the desktop header is .hidden md:flex — hidden.
    # On landscape phones at 844 width, the md: breakpoint kicks in → switches to DESKTOP layout
    # which is wrong for a 390-tall landscape phone — confirm:
    layout_mode = page.evaluate(
        """() => {
            const mobileHeader = document.querySelector('div.md\\\\:hidden');
            const desktopHeader = document.querySelector('header.hidden.md\\\\:flex') || document.querySelector('header.md\\\\:flex');
            return {
                mobileHeaderVisible: mobileHeader ? getComputedStyle(mobileHeader).display !== 'none' : null,
                desktopHeaderVisible: desktopHeader ? getComputedStyle(desktopHeader).display !== 'none' : null,
            };
        }"""
    )
    print(f"  layout: {layout_mode}", flush=True)

    # Try to tap the VISIBLE Pick you chip (mobile identity chip)
    print("  --- tapping mobile identity chip ('Pick you') ---", flush=True)
    chip = visible_button(page, "Pick you")
    if chip:
        chip.tap()
        page.wait_for_timeout(500)
        page.screenshot(path=f"{OUT}/{name}-chip-open.png", full_page=False)
        # The chip opens an account dropdown OR (if no member) the bottom sheet
        # The mobile-only path: "Pick you" chip with no member opens the bottom sheet via teamOpen
        sheet_visible = page.evaluate(
            """() => {
                const sheet = Array.from(document.querySelectorAll('div.fixed.inset-0.z-50')).filter(d => d.querySelector('input[placeholder*="team"]'));
                return sheet.length ? sheet[0].getBoundingClientRect().toJSON() : null;
            }"""
        )
        print(f"  bottom sheet after chip tap: {sheet_visible}", flush=True)
    else:
        print("  No visible Pick you button", flush=True)

    # Close it
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)
    try:
        page.locator("body").tap(position={"x": 5, "y": 5})
    except Exception:
        pass
    page.wait_for_timeout(300)

    # Now tap a desk to open booking modal
    print("  --- tap desk-1 ---", flush=True)
    try:
        d = page.locator('#desk-1').first
        if d.is_visible():
            d.tap()
            page.wait_for_timeout(700)
            page.screenshot(path=f"{OUT}/{name}-modal.png", full_page=False)

            modal = page.evaluate(
                """() => {
                  const m = document.getElementById('booking-modal-container');
                  if (!m) return null;
                  const r = m.getBoundingClientRect();
                  // Find scrollable content area inside modal
                  const scrollable = m.querySelector('[class*="overflow"]') || m;
                  return {
                    rect: r.toJSON(),
                    sH: m.scrollHeight, cH: m.clientHeight,
                    scrollableSH: scrollable.scrollHeight,
                    scrollableCH: scrollable.clientHeight,
                    bottomCutOff: r.bottom > window.innerHeight,
                    topCutOff: r.top < 0,
                    viewportH: window.innerHeight,
                    overflowAmount: Math.max(0, r.bottom - window.innerHeight),
                  };
                }"""
            )
            print(f"  modal: {modal}", flush=True)
        else:
            print("  desk-1 not visible (off-screen?)", flush=True)
    except Exception as e:
        print(f"  ERROR tapping desk: {e}", flush=True)

    print(f"  total console errors: {len(errors)}", flush=True)
    for e in errors[:3]:
        print(f"    {e[:200]}", flush=True)

    browser.close()


with sync_playwright() as p:
    for v in VIEWS:
        try:
            run(p, v)
        except Exception as e:
            print(f"FAIL {v['name']}: {e}", flush=True)
            import traceback
            traceback.print_exc()

print("\n=== DONE ===", flush=True)
