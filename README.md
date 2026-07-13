# AsiaPower — Professional B2B Website

Export of premium used engines and gearboxes from **Japan, Korea, and China** to **Africa**.

## Run Locally

```bash
cd /Users/longhui/Desktop/AsiaPower
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080)

> Use a local server (not `file://`) so scripts and images load correctly.

## Pages

| Page | File |
|------|------|
| Home | `index.html` |
| Engines | `engines.html` |
| Gearboxes | `gearboxes.html` |
| Brands | `brands.html` |
| Supplier Portal | `supplier-portal.html` |
| About Us | `about.html` |
| Contact | `contact.html` |

## Contact

- **Primary phone / WhatsApp:** +86 166 3880 1930
- **China WhatsApp backup:** +86 166 3880 1930
- **Email:** weylonhui@gmail.com
- **China Office:** South Third Ring Road & Shangdu Road, Zhengzhou, Henan, China
- **Ghana Office:** No.2 Flower Street, Tabora, Accra, Ghana

## File Structure

```
AsiaPower/
├── index.html
├── engines.html
├── gearboxes.html
├── supplier-portal.html
├── about.html
├── contact.html
├── assets/
│   ├── logo.png        ← transparent, tightly cropped
│   └── favicon.png
├── css/
│   └── styles.css
├── js/
│   ├── config.js       ← site data & contact info
│   ├── components.js   ← shared header/footer/WhatsApp
│   └── main.js         ← filters, forms, FAQ
└── README.md
```

## Customization

Edit **`js/config.js`** to update contact details, navigation, stats, and categories in one place. Header, footer, and WhatsApp button update automatically on all pages.

Forms are client-side demo handlers. Connect to Formspree, Netlify Forms, or your backend by adding an `action` URL to the `<form>` elements.

## Design

- Navy blue primary theme with gold accents
- Autozone Malaysia–inspired B2B catalog layout
- Product grids with filters, category cards, testimonials, FAQ
- Fully responsive with mobile navigation
- Floating WhatsApp button on every page

## Deploy

Upload all files to any static host (Netlify, Vercel, GitHub Pages, cPanel). No build step required.
