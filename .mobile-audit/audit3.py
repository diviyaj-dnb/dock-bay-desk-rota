"""Final checks: modal cancel buttons visibility on mobile, Map/Table toggle visibility,
team picker bottom sheet actually animating, h-screen vs dvh issue, scrolling within modal."""

from playwright.sync_api import sync_playwright
import json

URL = "https://dock-bay-desk-rota.vercel.app/"
OUT = "/Users/diviyajayengia/Downloads/desk-rota-audit/.mobile-audit"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True,
                              user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")
    page = ctx.new_page()
    page.goto(URL, wait_until="networkidle")
    page.wait_for_selector('img[alt="Office floor plan"]')

    # 1) Check if Map/Table toggle is VISIBLE on mobile
    print("=== Map/Table toggle visibility ===")
    map_check = page.evaluate(
        """() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const found = btns.filter(b => /^(Map|Table|List)$/.test(b.textContent.trim()));
          return found.map(b => ({
            text: b.textContent.trim(),
            visible: getComputedStyle(b).display !== 'none' && b.offsetParent !== null,
            rect: b.getBoundingClientRect().toJSON(),
          }));
        }"""
    )
    print(json.dumps(map_check, indent=2))

    # 2) Look for hamburger / menu / "..." on mobile that might give Map/Table toggle
    print("\n=== Searching for view-toggle UI on mobile ===")
    all_visible_btns = page.evaluate(
        """() => Array.from(document.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b => ({
          text: (b.textContent || '').trim().slice(0,30),
          ariaLabel: b.getAttribute('aria-label'),
          title: b.getAttribute('title'),
        }))"""
    )
    print(f"  {len(all_visible_btns)} visible buttons total")
    for b in all_visible_btns[:30]:
        print(f"    {b}")

    # 3) Test tapping the Pick you chip — what dropdown opens?
    print("\n=== Tap 'Pick you' chip ===")
    page.locator('button:has-text("Pick you")').filter(visible=True).first.tap()
    page.wait_for_timeout(700)
    page.screenshot(path=f"{OUT}/final-chip-tap.png")
    after_chip = page.evaluate(
        """() => ({
          openMenus: Array.from(document.querySelectorAll('.absolute, .fixed')).filter(el => el.offsetParent !== null).map(el => ({
            classes: el.className.slice(0, 100),
            rect: el.getBoundingClientRect().toJSON(),
            text: (el.innerText||'').slice(0, 80),
          })).filter(m => m.rect.width > 50 && m.rect.height > 20)
        })"""
    )
    print(json.dumps(after_chip, indent=2)[:2000])

    # 4) Inside the dropdown, click "Switch user" to open the bottom sheet
    print("\n=== Tap 'Switch user' to open bottom sheet ===")
    try:
        switch_user = page.locator('button:has-text("Switch user")').first
        switch_user.tap()
        page.wait_for_timeout(800)
        page.screenshot(path=f"{OUT}/final-bottom-sheet.png")
        sheet = page.evaluate(
            """() => {
              const sheet = Array.from(document.querySelectorAll('div.fixed.inset-0.z-50')).find(d => d.querySelector('input[placeholder*="team"]'));
              if (!sheet) return null;
              const inner = sheet.querySelector('div.relative.w-full');
              const list = sheet.querySelector('div.overflow-y-auto');
              return {
                outerRect: sheet.getBoundingClientRect().toJSON(),
                innerRect: inner ? inner.getBoundingClientRect().toJSON() : null,
                innerHeight: inner ? inner.scrollHeight : null,
                listSH: list ? list.scrollHeight : null,
                listCH: list ? list.clientHeight : null,
                listOverflows: list ? list.scrollHeight > list.clientHeight : null,
                viewportH: window.innerHeight,
              };
            }"""
        )
        print(json.dumps(sheet, indent=2))
    except Exception as e:
        print(f"  No switch user: {e}")

    # 5) Open modal and inspect cancel/save/remove buttons — are they visible without scrolling?
    print("\n=== Close sheet, open modal, check button visibility ===")
    page.keyboard.press("Escape")
    try:
        page.locator("body").tap(position={"x": 5, "y": 5})
    except Exception:
        pass
    page.wait_for_timeout(300)

    page.locator('#desk-1').tap()
    page.wait_for_timeout(500)
    modal_btns = page.evaluate(
        """() => {
          const modal = document.getElementById('booking-modal-container');
          if (!modal) return null;
          const buttons = Array.from(modal.querySelectorAll('button'));
          return {
            modalRect: modal.getBoundingClientRect().toJSON(),
            viewportH: window.innerHeight,
            buttons: buttons.map(b => ({
              text: (b.textContent || '').trim().slice(0, 30),
              rect: b.getBoundingClientRect().toJSON(),
              inViewport: (() => {
                const r = b.getBoundingClientRect();
                return r.top >= 0 && r.bottom <= window.innerHeight;
              })(),
            })),
          };
        }"""
    )
    print(json.dumps(modal_btns, indent=2)[:3000])

    # 6) Take a screenshot of the modal WITHOUT scrolling
    page.screenshot(path=f"{OUT}/final-modal-noscroll.png", full_page=False)

    # 7) Check if the modal's scroll area shows scroll indicator
    print("\n=== Modal scroll area diagnostic ===")
    scroll_diag = page.evaluate(
        """() => {
          const m = document.getElementById('booking-modal-container');
          if (!m) return null;
          // The scrollable area is likely the inner content with overflow-y-auto
          const candidates = Array.from(m.querySelectorAll('*')).filter(el => {
            const cs = getComputedStyle(el);
            return /auto|scroll/.test(cs.overflowY);
          });
          return candidates.map(c => ({
            tag: c.tagName,
            classes: c.className.slice(0, 100),
            sH: c.scrollHeight, cH: c.clientHeight,
            overflows: c.scrollHeight > c.clientHeight,
            rect: c.getBoundingClientRect().toJSON(),
          }));
        }"""
    )
    print(json.dumps(scroll_diag, indent=2))

    # 8) Check the footer buttons specifically — Cancel/Save Schedule/Remove Booking
    print("\n=== Are footer buttons in viewport? ===")
    footer_check = page.evaluate(
        """() => {
          const texts = ['Cancel', 'Save Schedule', 'Remove Booking'];
          return texts.map(t => {
            const b = Array.from(document.querySelectorAll('button')).find(x => x.textContent.trim() === t || x.textContent.trim().endsWith(t));
            if (!b) return { text: t, found: false };
            const r = b.getBoundingClientRect();
            return {
              text: t,
              found: true,
              rect: r.toJSON(),
              inViewport: r.top >= 0 && r.bottom <= window.innerHeight,
              clippedBy: r.bottom > window.innerHeight ? `bottom by ${(r.bottom - window.innerHeight).toFixed(0)}px` : (r.top < 0 ? `top by ${(-r.top).toFixed(0)}px` : 'none')
            };
          });
        }"""
    )
    print(json.dumps(footer_check, indent=2))

    # 9) The 100vh issue — simulate URL bar collapse (iOS Safari shows ~80px less than viewport)
    # We can't simulate the URL bar directly, but the dvh issue means if the user scrolls and
    # the URL bar collapses, the page wouldn't use the new space. Test by checking computed h-screen.
    print("\n=== h-screen / 100vh issue ===")
    vh_check = page.evaluate(
        """() => {
          const root = document.querySelector('.h-screen');
          // Check what the CSS resolves to
          const cs = root ? getComputedStyle(root) : null;
          // Also check if there's any use of svh/lvh/dvh
          const styleSheets = Array.from(document.styleSheets);
          let dvhUsage = 0, svhUsage = 0;
          try {
            for (const sheet of styleSheets) {
              try {
                const rules = sheet.cssRules || [];
                for (const rule of rules) {
                  const text = rule.cssText || '';
                  if (text.includes('dvh')) dvhUsage++;
                  if (text.includes('svh')) svhUsage++;
                }
              } catch (e) { /* CORS */ }
            }
          } catch (e) {}
          return {
            rootFound: !!root,
            cssHeight: cs ? cs.height : null,
            innerHeight: window.innerHeight,
            dvhUsageCount: dvhUsage,
            svhUsageCount: svhUsage,
          };
        }"""
    )
    print(json.dumps(vh_check, indent=2))

    browser.close()
print("\n=== DONE ===")
