# Edge Add-ons Submission Checklist

## Before submitting

- [ ] Create Microsoft Partner Center account at partner.microsoft.com
- [ ] Sign in and go to: Dashboard â Microsoft Edge â New Extension

## Files needed
- [x] TabScroller-v1.0.0.zip (the extension package)
- [ ] Screenshots: at least 1 screenshot, 1280x800 or 640x400 pixels
- [ ] Privacy policy URL: https://github.com/granterogers/TabScroller/blob/main/PRIVACY.md

## Store listing fields
- Name: TabScroller
- Version: 1.0.0
- Short description: see STORE_LISTING.md
- Long description: see STORE_LISTING.md
- Category: Productivity

## Permissions justification
- tabs â "Required to query and switch between tabs"
- scripting â "Required to inject the scroll listener into pages"
- storage â "Required to save user preferences"
- alarms â "Required to keep service worker alive in MV3"
- <all_urls> â "Required to inject scroll listener into all websites"

## After submission
- Review typically takes 1-7 business days
