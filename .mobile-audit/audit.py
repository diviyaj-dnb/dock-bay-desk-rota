"""Mobile UX audit of https://dock-bay-desk-rota.vercel.app/

Tests two viewports: iPhone 14 (390x844) and Pixel 7 (412x915).
Captures screenshots, console errors, header overflow, modal behaviour,
hotspot positions, and 100vh safe-area issues.
"""

from playwright.sync_api import sync_playwright
import json
import time
import sys

URL = "https://dock-bay-desk-rota.vercel.app/"
OUT = "/Users/diviyajayengia/Downloads/desk-rota-audit/.mobile-audit"

DEVICES = [
    {
        "name": "iphone14",
        "viewport": {"width": 390, "height": 844},
        "user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "is_mobile": True,
        "has_touch": True,
        "device_scale_factor": 3,
    },
    {
        "name": "pixel7",
        "viewport": {"width": 412, "height": 915},
        "user_agent": "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "is_mobile": True,
        "has_touch": True,
        "device_scale_factor": 2.625,
    },
]


def measure(page, device_name, label):
    """Return key layout metrics for the current page state."""
    return page.evaluate(
        """() => {
        const r = (el) => el ? el.getBoundingClientRect().toJSON() : null;
        const body = document.body;
        const html = document.documentElement;
        const header = document.querySelector('.md\\\\:hidden') || document.querySelector('div.md\\\\:hidden');
        const allMobileHeaderRows = Array.from(document.querySelectorAll('div.md\\\\:hidden > div')).slice(0,5).map(el => ({
            rect: el.getBoundingClientRect().toJSON(),
            text: (el.innerText || '').slice(0, 60),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            overflows: el.scrollWidth > el.clientWidth,
        }));
        const root = document.getElementById('root');
        const floorPlanImg = document.querySelector('img[alt="Office floor plan"]');
        return {
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight,
            visualViewport: window.visualViewport ? {
                width: window.visualViewport.width,
                height: window.visualViewport.height,
                offsetTop: window.visualViewport.offsetTop,
            } : null,
            documentScrollWidth: html.scrollWidth,
            documentClientWidth: html.clientWidth,
            bodyOverflowX: html.scrollWidth > html.clientWidth,
            rootRect: r(root),
            rootScrollHeight: root ? root.scrollHeight : null,
            rootClientHeight: root ? root.clientHeight : null,
            headerRows: allMobileHeaderRows,
            floorPlanImg: r(floorPlanImg),
            floorPlanComplete: floorPlanImg ? floorPlanImg.complete : null,
            floorPlanNaturalSize: floorPlanImg ? { w: floorPlanImg.naturalWidth, h: floorPlanImg.naturalHeight } : null,
            allModals: Array.from(document.querySelectorAll('.fixed.inset-0')).map(el => ({
                rect: el.getBoundingClientRect().toJSON(),
                classes: el.className.slice(0, 200),
            })),
        };
    }"""
    )


def run_device(p, device):
    name = device["name"]
    print(f"\n=== {name} ({device['viewport']['width']}x{device['viewport']['height']}) ===", flush=True)

    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport=device["viewport"],
        user_agent=device["user_agent"],
        is_mobile=device["is_mobile"],
        has_touch=device["has_touch"],
        device_scale_factor=device["device_scale_factor"],
    )
    page = context.new_page()

    console_msgs = []
    page.on("console", lambda msg: console_msgs.append({"type": msg.type, "text": msg.text}))
    page.on("pageerror", lambda err: console_msgs.append({"type": "pageerror", "text": str(err)}))

    t0 = time.time()
    page.goto(URL, wait_until="domcontentloaded", timeout=30000)
    t_dom = time.time() - t0

    try:
        page.wait_for_load_state("networkidle", timeout=20000)
    except Exception as e:
        print(f"  WARN: networkidle timed out: {e}", flush=True)
    t_idle = time.time() - t0

    # First paint screenshot
    page.screenshot(path=f"{OUT}/{name}-01-initial.png", full_page=False)

    # Get full-page screenshot too, to see total scroll height
    page.screenshot(path=f"{OUT}/{name}-02-fullpage.png", full_page=True)

    # Wait for floor plan image
    try:
        page.wait_for_selector('img[alt="Office floor plan"]', timeout=10000)
        t_floorplan = time.time() - t0
    except Exception as e:
        print(f"  WARN: floor plan image did not appear: {e}", flush=True)
        t_floorplan = None

    print(f"  Timings: dom={t_dom:.2f}s idle={t_idle:.2f}s floorplan={t_floorplan}", flush=True)

    metrics = measure(page, name, "initial")
    with open(f"{OUT}/{name}-metrics-initial.json", "w") as f:
        json.dump(metrics, f, indent=2, default=str)

    print(f"  viewport: {metrics['innerWidth']}x{metrics['innerHeight']}", flush=True)
    print(f"  doc scrollWidth={metrics['documentScrollWidth']} clientWidth={metrics['documentClientWidth']} overflowX={metrics['bodyOverflowX']}", flush=True)
    print(f"  root scrollHeight={metrics['rootScrollHeight']} clientHeight={metrics['rootClientHeight']}", flush=True)
    print(f"  floor plan img: {metrics['floorPlanImg']}", flush=True)
    print(f"  floor plan natural: {metrics['floorPlanNaturalSize']}", flush=True)
    for i, row in enumerate(metrics["headerRows"]):
        print(f"  header row[{i}] overflowX={row['overflows']} sw={row['scrollWidth']} cw={row['clientWidth']} text={row['text'][:40]!r}", flush=True)

    # Check console errors
    errors = [m for m in console_msgs if m["type"] in ("error", "pageerror")]
    print(f"  console errors: {len(errors)}", flush=True)
    for e in errors[:5]:
        print(f"    {e['type']}: {e['text'][:200]}", flush=True)

    # Try to click "Pick yourself" (mobile identity chip)
    print("  --- testing Pick yourself button ---", flush=True)
    try:
        # Try the orange Pick yourself chip — could be on right side
        pick = page.locator('button:has-text("Pick you")').first
        pick.wait_for(state="visible", timeout=5000)
        pick_box = pick.bounding_box()
        print(f"  Pick yourself button box: {pick_box}", flush=True)
        pick.tap()
        page.wait_for_timeout(700)
        page.screenshot(path=f"{OUT}/{name}-03-after-pick-tap.png", full_page=False)

        # The identity chip opens a small dropdown, not the bottom sheet.
        # The bottom sheet opens when "Switch user" is clicked from the dropdown
        # OR if no member is selected — let's just check what opened
        sheet_metrics = page.evaluate(
            """() => {
                const sheets = Array.from(document.querySelectorAll('.fixed.inset-0.z-50'));
                return sheets.map(s => ({
                    rect: s.getBoundingClientRect().toJSON(),
                    text: (s.innerText || '').slice(0, 200),
                }));
            }"""
        )
        print(f"  sheets visible after tap: {len(sheet_metrics)}", flush=True)
        for s in sheet_metrics:
            print(f"    {s['rect']}", flush=True)
    except Exception as e:
        print(f"  ERROR clicking Pick yourself: {e}", flush=True)

    # Close any overlay
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

    # Try to find the team picker bottom sheet by tapping the chip directly
    # If a member is already selected, the chip says first name + chevron and opens a small dropdown
    # Let's look at the orange "Pick yourself" path: only available if no member selected
    print("  --- inspecting bottom sheet open path ---", flush=True)
    # Click somewhere safe to dismiss
    try:
        page.locator("body").tap(position={"x": 10, "y": 10})
    except Exception:
        pass
    page.wait_for_timeout(300)

    # Try tapping a desk hotspot
    print("  --- tapping a desk hotspot ---", flush=True)
    try:
        desk1 = page.locator('#desk-1').first
        desk1.wait_for(state="visible", timeout=5000)
        box = desk1.bounding_box()
        print(f"  desk-1 box: {box}", flush=True)
        desk1.tap()
        page.wait_for_timeout(800)
        page.screenshot(path=f"{OUT}/{name}-04-desk-tap.png", full_page=False)

        modal_metrics = page.evaluate(
            """() => {
                const m = document.getElementById('booking-modal-container');
                if (!m) return { exists: false };
                const r = m.getBoundingClientRect();
                return {
                    exists: true,
                    rect: r.toJSON(),
                    scrollHeight: m.scrollHeight,
                    clientHeight: m.clientHeight,
                    overflowsViewport: r.bottom > window.innerHeight || r.top < 0,
                    bodyOverflows: m.scrollHeight > m.clientHeight,
                    viewportHeight: window.innerHeight,
                };
            }"""
        )
        print(f"  modal metrics: {modal_metrics}", flush=True)
    except Exception as e:
        print(f"  ERROR opening booking modal: {e}", flush=True)

    # Screenshot modal full-page (in case it overflows)
    page.screenshot(path=f"{OUT}/{name}-05-modal-fullpage.png", full_page=True)

    # Try to close modal — look for X button
    try:
        close_btn = page.locator('#booking-modal-container button[aria-label]').first
        if close_btn.count() > 0:
            close_btn.tap()
            page.wait_for_timeout(300)
    except Exception:
        pass
    # Otherwise tap outside
    try:
        page.locator("body").tap(position={"x": 5, "y": 5})
    except Exception:
        pass
    page.wait_for_timeout(300)

    # Test Map/Table toggle
    print("  --- looking for Map/Table toggle ---", flush=True)
    try:
        toggle = page.locator('button:has-text("Map"), button:has-text("Table"), button:has-text("List")').first
        if toggle.count() > 0:
            print(f"  toggle found: {toggle.text_content()}", flush=True)
        else:
            print("  No Map/Table toggle visible on mobile (may be desktop-only)", flush=True)
    except Exception as e:
        print(f"  ERROR with toggle: {e}", flush=True)

    # Test Next week
    print("  --- testing Next week navigator ---", flush=True)
    try:
        next_btn = page.locator('button[aria-label="Next week"]').first
        next_btn.wait_for(state="visible", timeout=3000)
        next_btn.tap()
        page.wait_for_timeout(400)
        prev_btn = page.locator('button[aria-label="Previous week"]').first
        prev_btn.tap()
        page.wait_for_timeout(400)
        print("  Next/Prev week works", flush=True)
    except Exception as e:
        print(f"  ERROR with week nav: {e}", flush=True)

    # Simulate iOS Safari address bar hiding — h-screen vs 100dvh
    # We can't truly simulate the address bar in Playwright, but we can check
    # whether the root uses h-screen
    h_screen_check = page.evaluate(
        """() => {
            const root = document.querySelector('div.h-screen');
            if (!root) return { found: false };
            const cs = getComputedStyle(root);
            return {
                found: true,
                computedHeight: cs.height,
                innerHeight: window.innerHeight,
                heightInPx: root.getBoundingClientRect().height,
            };
        }"""
    )
    print(f"  h-screen check: {h_screen_check}", flush=True)

    # Hotspot alignment: extract all hotspot positions relative to floor plan
    hotspot_alignment = page.evaluate(
        """() => {
            const img = document.querySelector('img[alt="Office floor plan"]');
            if (!img) return null;
            const imgRect = img.getBoundingClientRect();
            const hotspots = Array.from(document.querySelectorAll('[id^="desk-"]')).map(el => {
                const r = el.getBoundingClientRect();
                return {
                    id: el.id,
                    relX: ((r.left + r.width/2) - imgRect.left) / imgRect.width,
                    relY: ((r.top + r.height/2) - imgRect.top) / imgRect.height,
                    visible: r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth,
                };
            });
            return {
                imgRect: imgRect.toJSON(),
                viewportH: window.innerHeight,
                viewportW: window.innerWidth,
                hotspots: hotspots.slice(0, 8),
                totalHotspots: hotspots.length,
                visibleHotspots: hotspots.filter(h => h.visible).length,
            };
        }"""
    )
    if hotspot_alignment:
        print(f"  hotspots: total={hotspot_alignment['totalHotspots']} visible={hotspot_alignment['visibleHotspots']}", flush=True)
        print(f"  floor plan img rendered at: {hotspot_alignment['imgRect']}", flush=True)

    with open(f"{OUT}/{name}-hotspot-alignment.json", "w") as f:
        json.dump(hotspot_alignment, f, indent=2, default=str)
    with open(f"{OUT}/{name}-console.json", "w") as f:
        json.dump(console_msgs, f, indent=2, default=str)

    # Performance — record paint timings
    perf = page.evaluate(
        """() => {
            const paints = performance.getEntriesByType('paint').map(p => ({ name: p.name, startTime: p.startTime }));
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource')
              .filter(r => r.name.includes('floor-plan') || r.name.includes('floorplan') || r.name.includes('.png') || r.name.includes('.jpg'))
              .map(r => ({ name: r.name.split('/').pop(), duration: r.duration, transferSize: r.transferSize, startTime: r.startTime }));
            return {
                paints,
                domContentLoaded: nav ? nav.domContentLoadedEventEnd : null,
                loadEvent: nav ? nav.loadEventEnd : null,
                floorPlanResources: resources,
            };
        }"""
    )
    print(f"  perf paints: {perf['paints']}", flush=True)
    print(f"  perf domContentLoaded={perf['domContentLoaded']:.0f}ms loadEvent={perf['loadEvent']:.0f}ms" if perf['domContentLoaded'] else "  perf incomplete", flush=True)
    print(f"  floor plan resources: {perf['floorPlanResources']}", flush=True)

    with open(f"{OUT}/{name}-perf.json", "w") as f:
        json.dump(perf, f, indent=2, default=str)

    browser.close()


with sync_playwright() as p:
    for device in DEVICES:
        try:
            run_device(p, device)
        except Exception as e:
            print(f"DEVICE {device['name']} FAILED: {e}", flush=True)
            import traceback
            traceback.print_exc()

print("\n=== DONE ===", flush=True)
