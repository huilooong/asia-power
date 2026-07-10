#!/usr/bin/env python3
"""Generate Google Ads Editor CSV package — West Africa excl. Nigeria + North Africa, $30/day."""

from __future__ import annotations

import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/marketing/google-ads-merged-africa-editor-2026-07-06"

LOCATIONS = (
    "Ghana; Cote dIvoire; Togo; Benin; Senegal; Burkina Faso; Mali; Niger; "
    "Liberia; Sierra Leone; Guinea; Gambia; Egypt; Morocco; Algeria; Tunisia; "
    "Libya; Mauritania"
)
LANGUAGES = "English; French; Arabic"
LOCATION_OPT = "Presence: People in or regularly in your targeted locations"

BUDGETS = {
    "AF_Search_Engines_HighIntent": 21,
    "AF_Search_Gearboxes_HighIntent": 5,
    "AF_Search_HalfCuts_Import": 3,
    "AF_Search_Import_FromChina": 1.5,
}

AD_GROUPS = {
    "AF_Search_Engines_HighIntent": [
        ("Toyota Corolla Engine", 0.40),
        ("Toyota Camry Engine", 0.40),
        ("Toyota Vitz Yaris Engine", 0.35),
        ("Toyota RAV4 Prado Engine", 0.45),
        ("Hyundai Kia SUV Engine", 0.40),
        ("Hyundai Kia Sedan Engine", 0.35),
        ("Nissan Engine", 0.40),
        ("Honda CR-V Engine", 0.40),
        ("Honda Accord Civic Engine", 0.35),
    ],
    "AF_Search_Gearboxes_HighIntent": [
        ("Toyota Gearbox", 0.35),
        ("Hyundai Kia Gearbox", 0.35),
    ],
    "AF_Search_HalfCuts_Import": [("Half Cut Africa", 0.40)],
    "AF_Search_Import_FromChina": [("China To Africa Auto Parts", 0.35)],
}


def url(campaign_slug: str, content: str, term: str, path: str) -> str:
    base = f"https://asia-power.com/{path}"
    return (
        f"{base}?utm_source=google&utm_medium=cpc&utm_campaign={campaign_slug}"
        f"&utm_content={content}&utm_term={term.replace(' ', '+')}"
    )


def engine_kw(group: str, content: str, pairs: list[tuple[str, str | None]]) -> list[dict]:
    rows = []
    for kw, engine_page in pairs:
        path = engine_page or "engines/"
        rows.append(
            {
                "Campaign": "AF_Search_Engines_HighIntent",
                "Ad group": group,
                "Keyword": kw,
                "Match type": "Phrase",
                "Status": "Paused",
                "Final URL": url("af_search_engines_highintent", content, kw, path),
            }
        )
    return rows


def build_keywords() -> list[dict]:
    rows: list[dict] = []

    rows += engine_kw(
        "Toyota Corolla Engine",
        "toyota_corolla_engine",
        [
            ("corolla 2007 engine", None),
            ("corolla 2008 engine", None),
            ("corolla 2009 engine", None),
            ("corolla 2010 engine", None),
            ("corolla 2011 engine", None),
            ("corolla 2012 engine", None),
            ("corolla 2013 engine", None),
            ("toyota corolla engine", None),
            ("toyota corolla engine for sale", None),
            ("corolla engine with gearbox", None),
            ("corolla 1zr engine", "engines/1zr-fe.html"),
            ("1zr engine", "engines/1zr-fe.html"),
            ("moteur corolla 2009", None),
            ("moteur corolla 2010", None),
            ("moteur toyota corolla", None),
            ("moteur corolla occasion", None),
        ],
    )

    rows += engine_kw(
        "Toyota Camry Engine",
        "toyota_camry_engine",
        [
            ("camry 2007 engine", None),
            ("camry 2008 engine", None),
            ("camry 2009 engine", None),
            ("camry 2010 engine", None),
            ("toyota camry engine", None),
            ("camry engine with gearbox", None),
            ("1az camry engine", "engines/1az-fe.html"),
            ("2az camry engine", "engines/2az-fe.html"),
            ("moteur toyota camry", None),
            ("moteur camry occasion", None),
        ],
    )

    rows += engine_kw(
        "Toyota Vitz Yaris Engine",
        "toyota_vitz_yaris_engine",
        [
            ("toyota vitz engine", None),
            ("vitz engine for sale", None),
            ("toyota yaris engine", None),
            ("1nz engine", "engines/1nz-fe.html"),
            ("2nz engine", "engines/2nz-fe.html"),
            ("moteur toyota yaris", None),
            ("moteur vitz occasion", None),
        ],
    )

    rows += engine_kw(
        "Toyota RAV4 Prado Engine",
        "toyota_rav4_prado_engine",
        [
            ("toyota rav4 engine", None),
            ("rav4 2009 engine", None),
            ("land cruiser prado engine", None),
            ("prado engine", None),
            ("moteur rav4 occasion", None),
        ],
    )

    rows += engine_kw(
        "Hyundai Kia SUV Engine",
        "hyundai_kia_suv_engine",
        [
            ("hyundai ix35 engine", None),
            ("ix35 2010 engine", None),
            ("ix35 2012 engine", None),
            ("hyundai tucson engine", None),
            ("tucson 2009 engine", None),
            ("kia sportage engine", None),
            ("g4na engine", "engines/g4na.html"),
            ("g4kd engine", "engines/g4kd.html"),
            ("g4fg engine", "engines/g4fg.html"),
            ("moteur hyundai tucson", None),
            ("moteur kia sportage", None),
            ("moteur ix35 occasion", None),
        ],
    )

    rows += engine_kw(
        "Hyundai Kia Sedan Engine",
        "hyundai_kia_sedan_engine",
        [
            ("hyundai elantra engine", None),
            ("hyundai accent engine", None),
            ("hyundai sonata engine", None),
            ("sonata 2011 engine", None),
            ("hyundai santa fe engine", None),
            ("kia rio engine", None),
            ("g4fc engine", "engines/g4fc.html"),
            ("moteur hyundai elantra", None),
        ],
    )

    rows += engine_kw(
        "Nissan Engine",
        "nissan_engine",
        [
            ("nissan tiida engine", None),
            ("nissan x trail engine", None),
            ("xtrail 2008 engine", None),
            ("nissan qashqai engine", None),
            ("qashqai 2008 engine", None),
            ("qashqai 2010 engine", None),
            ("nissan sylphy engine", None),
            ("hr16de engine", "engines/hr16de.html"),
            ("qr25de engine", "engines/qr25de.html"),
            ("moteur nissan qashqai", None),
        ],
    )

    rows += engine_kw(
        "Honda CR-V Engine",
        "honda_crv_engine",
        [
            ("honda crv engine", None),
            ("honda cr-v engine", None),
            ("crv 2007 engine", None),
            ("crv 2008 engine", None),
            ("crv 2009 engine", None),
            ("crv 2010 engine", None),
            ("moteur honda crv", None),
            ("محرك هوندا crv", None),
        ],
    )

    rows += engine_kw(
        "Honda Accord Civic Engine",
        "honda_accord_civic_engine",
        [
            ("honda accord engine", None),
            ("accord 2008 engine", None),
            ("accord 2010 engine", None),
            ("honda civic engine", None),
            ("civic 2009 engine", None),
            ("k24 engine", "engines/k24a.html"),
            ("moteur honda accord", None),
            ("محرك أكورد", None),
        ],
    )

    gb_pairs = [
        ("AF_Search_Gearboxes_HighIntent", "Toyota Gearbox", "toyota_gearbox", "af_search_gearboxes_highintent", [
            ("corolla gearbox", None),
            ("corolla 2009 gearbox", None),
            ("corolla 2010 gearbox", None),
            ("camry gearbox", None),
            ("toyota corolla gearbox", None),
            ("toyota camry gearbox", None),
            ("boite vitesse corolla", None),
            ("boite vitesse camry", None),
            ("automatic gearbox", None),
        ]),
        ("AF_Search_Gearboxes_HighIntent", "Hyundai Kia Gearbox", "hyundai_kia_gearbox", "af_search_gearboxes_highintent", [
            ("hyundai ix35 gearbox", None),
            ("kia sportage gearbox", None),
            ("hyundai tucson gearbox", None),
            ("boite vitesse hyundai tucson", None),
            ("boite vitesse kia sportage", None),
            ("used transmission", None),
        ]),
    ]
    for camp, group, content, slug, pairs in gb_pairs:
        for kw, _ in pairs:
            rows.append(
                {
                    "Campaign": camp,
                    "Ad group": group,
                    "Keyword": kw,
                    "Match type": "Phrase",
                    "Status": "Paused",
                    "Final URL": url(slug, content, kw, "gearboxes/"),
                }
            )

    half_pairs = [
        ("half cut cars", None),
        ("half cut car parts", None),
        ("half cut", None),
        ("front cut cars", None),
        ("nose cut cars", None),
        ("half cut supplier", None),
        ("half cut engines", None),
        ("used car parts", None),
        ("second hand car parts", None),
        ("japanese used parts", None),
        ("used engine for sale", None),
        ("demi coupe voiture", None),
        ("avant de voiture occasion", None),
        ("half cut abidjan", None),
        ("half cut dakar", None),
        ("pieces auto occasion afrique", None),
        ("هاف كت سيارات", None),
        ("قطع غيار مستعملة", None),
    ]
    for kw, _ in half_pairs:
        rows.append(
            {
                "Campaign": "AF_Search_HalfCuts_Import",
                "Ad group": "Half Cut Africa",
                "Keyword": kw,
                "Match type": "Phrase",
                "Status": "Paused",
                "Final URL": url("af_search_halfcuts_import", "half_cut_africa", kw, "half-cuts/"),
            }
        )

    import_pairs = [
        ("auto parts from china", None),
        ("import car parts from china", None),
        ("used engines from china", None),
        ("used car parts from china", None),
        ("engine importers", None),
        ("car parts supplier china", None),
        ("china engine supplier", None),
        ("pieces auto chine", None),
        ("import pieces auto chine", None),
        ("moteur occasion chine", None),
        ("import moteur chine", None),
        ("moteur occasion chine afrique", None),
        ("قطع غيار مستعملة من الصين", None),
    ]
    for kw, _ in import_pairs:
        rows.append(
            {
                "Campaign": "AF_Search_Import_FromChina",
                "Ad group": "China To Africa Auto Parts",
                "Keyword": kw,
                "Match type": "Phrase",
                "Status": "Paused",
                "Final URL": url("af_search_import_fromchina", "china_to_africa_auto_parts", kw, ""),
            }
        )

    return rows


ADS = [
    (
        "AF_Search_Engines_HighIntent",
        "Toyota Corolla Engine",
        "toyota_corolla_engine",
        "engines/",
        "corolla",
        "engine",
        "Toyota Corolla Engine Africa",
        "2007-2013 — Real China Stock",
        "Ship To West and North Africa",
        "Send Model And Year",
        "1ZR Engine Available",
        "Customs Support",
        "Real Inventory Photos",
        "Looking for a Corolla engine? We source used stock from China and ship to Africa.",
        "Browse Corolla engines at asia-power.com. Send model, year and destination.",
    ),
    (
        "AF_Search_Engines_HighIntent",
        "Toyota Camry Engine",
        "toyota_camry_engine",
        "engines/",
        "camry",
        "engine",
        "Toyota Camry Engine Africa",
        "2007 2009 2010 — Used Stock",
        "China to Africa · Shipping",
        "Send Model And Year",
        "1AZ · 2AZ Engines",
        "Customs Support",
        "Real Inventory Photos",
        "Need a Camry engine? Real used stock from China with shipping support to Africa.",
        "Browse Camry engines at asia-power.com. Send model and year for quote.",
    ),
    (
        "AF_Search_Engines_HighIntent",
        "Toyota Vitz Yaris Engine",
        "toyota_vitz_yaris_engine",
        "engines/",
        "vitz",
        "engine",
        "Toyota Vitz Engine Africa",
        "Yaris · 1NZ · 2NZ Stock",
        "China Sourced · Ship To Africa",
        "Send Model And Year",
        "Real Inventory Photos",
        "Customs Support",
        "AsiaPower Auto Parts",
        "Used Vitz and Yaris engines from China. Shipping and customs support to Africa.",
        "Browse Vitz engines at asia-power.com. Send model and year.",
    ),
    (
        "AF_Search_Engines_HighIntent",
        "Toyota RAV4 Prado Engine",
        "toyota_rav4_prado_engine",
        "engines/",
        "rav4",
        "parts",
        "RAV4 and Prado Engine Africa",
        "RAV4 2009 · Prado Stock",
        "China Sourced · Ship To Africa",
        "Send Model And Year",
        "Customs Support",
        "Real Inventory Photos",
        "AsiaPower Auto Parts",
        "Used Toyota RAV4 and Land Cruiser Prado parts from China with shipping support.",
        "Browse RAV4 and Prado stock at asia-power.com. Send model and year.",
    ),
    (
        "AF_Search_Engines_HighIntent",
        "Hyundai Kia SUV Engine",
        "hyundai_kia_suv_engine",
        "engines/",
        "ix35",
        "engine",
        "Hyundai ix35 Engine Africa",
        "Tucson · ix35 2010 2012",
        "Ship To West and North Africa",
        "Send Model And Year",
        "G4KD · G4NA Engines",
        "Real Inventory Photos",
        "AsiaPower Auto Parts",
        "Looking for ix35 or Tucson engine? Used stock from China with shipping support.",
        "Browse ix35 stock at asia-power.com. Send model and year.",
    ),
    (
        "AF_Search_Engines_HighIntent",
        "Hyundai Kia Sedan Engine",
        "hyundai_kia_sedan_engine",
        "engines/",
        "elantra",
        "engine",
        "Hyundai Elantra Engine Africa",
        "Sonata · Elantra · Santa Fe",
        "China Sourced · Ship To Africa",
        "Send Model And Year",
        "G4FC Engine Available",
        "Customs Support",
        "Real Inventory Photos",
        "Used Hyundai Elantra Sonata engines from China with shipping support to Africa.",
        "Browse Hyundai stock at asia-power.com. Send model and year.",
    ),
    (
        "AF_Search_Engines_HighIntent",
        "Nissan Engine",
        "nissan_engine",
        "engines/",
        "qashqai",
        "engine",
        "Nissan Qashqai Engine Africa",
        "X-Trail · Qashqai 2008 2010",
        "China Sourced · Ship To Africa",
        "Send Model And Year",
        "HR16 · QR25 Engines",
        "Customs Support",
        "Real Inventory Photos",
        "Looking for Qashqai or X-Trail engine? Used stock from China with shipping support.",
        "Browse Nissan stock at asia-power.com. Send model and year.",
    ),
    (
        "AF_Search_Engines_HighIntent",
        "Honda CR-V Engine",
        "honda_crv_engine",
        "engines/",
        "crv",
        "engine",
        "Honda CR-V Engine Africa",
        "2007 2008 2009 2010 Stock",
        "China Sourced · Ship To Africa",
        "Send Model And Year",
        "Real Inventory Photos",
        "Customs Support",
        "AsiaPower Auto Parts",
        "Looking for a CRV engine? Used stock from China with shipping support to Africa.",
        "Browse CR-V engines at asia-power.com. Send model and year.",
    ),
    (
        "AF_Search_Engines_HighIntent",
        "Honda Accord Civic Engine",
        "honda_accord_civic_engine",
        "engines/",
        "honda",
        "engine",
        "Honda Accord and Civic Africa",
        "2008 2009 2010 · K24 Stock",
        "China to Africa · Shipping",
        "Send Model And Year",
        "Real Inventory Photos",
        "Customs Support",
        "AsiaPower Auto Parts",
        "Need an Accord or Civic engine? Used stock from China with shipping support.",
        "Browse Honda engines at asia-power.com. Send model and year.",
    ),
    (
        "AF_Search_Gearboxes_HighIntent",
        "Toyota Gearbox",
        "toyota_gearbox",
        "gearboxes/",
        "gearbox",
        "toyota",
        "Gearboxes For Africa",
        "Corolla · Camry Gearboxes",
        "AT MT CVT Available",
        "China Stock · Ship To Africa",
        "Send Model And Year",
        "Customs Support",
        "AsiaPower Auto Parts",
        "Find used gearboxes from China stock. Send vehicle model, year and gearbox type.",
        "We help Africa buyers source and ship used gearboxes from China.",
    ),
    (
        "AF_Search_Gearboxes_HighIntent",
        "Hyundai Kia Gearbox",
        "hyundai_kia_gearbox",
        "gearboxes/",
        "gearbox",
        "hyundai",
        "Hyundai Gearbox Africa",
        "ix35 · Sportage Gearboxes",
        "Automatic · Manual · CVT",
        "China Stock · Ship To Africa",
        "Send Model And Year",
        "Customs Support",
        "AsiaPower Auto Parts",
        "Used Hyundai and Kia gearboxes from China with shipping support to Africa.",
        "Browse gearbox stock at asia-power.com. Send model and year.",
    ),
    (
        "AF_Search_HalfCuts_Import",
        "Half Cut Africa",
        "half_cut_africa",
        "half-cuts/",
        "half-cut",
        "africa",
        "Half Cut Cars From China",
        "Corolla · CRV · ix35 More",
        "Real Donor Car Photos",
        "Engines Gearboxes Half Cuts",
        "Ship To Africa",
        "Customs Support",
        "AsiaPower Auto Parts",
        "Browse half-cut stock photos before quote. Choose the part and we arrange shipping.",
        "Engines, gearboxes and half-cuts from China for Africa workshops and importers.",
    ),
    (
        "AF_Search_Import_FromChina",
        "China To Africa Auto Parts",
        "china_to_africa_auto_parts",
        "",
        "china",
        "africa",
        "Auto Parts China To Africa",
        "Used Engines From China",
        "Car Parts For Africa",
        "We Handle Shipping",
        "Engines Gearboxes Half Cuts",
        "Send Your Request",
        "AsiaPower Auto Parts",
        "Tell us the part you need. We source from China stock and arrange shipping to Africa.",
        "Engines, gearboxes and half-cuts for Africa workshops. Send model, year and destination.",
    ),
]

NEGATIVES = [
    "nigeria",
    "lagos",
    "abuja",
    "ikeja",
    "apapa",
    "oil",
    "engine oil",
    "oil change",
    "filter",
    "oil filter",
    "cover",
    "engine cover",
    "under cover",
    "splash",
    "shield",
    "mount",
    "seat",
    "engine seat",
    "gasket",
    "plug",
    "spark plug",
    "sensor",
    "coil",
    "fan",
    "shroud",
    "manifold",
    "belt",
    "manual",
    "repair manual",
    "pdf",
    "diagram",
    "specification",
    "specs",
    "how to",
    "how to fix",
    "repair",
    "training",
    "school",
    "job",
    "jobs",
    "salary",
    "toy",
    "game",
    "free",
    "gratuit",
    "cheap oil",
    "new car",
    "new engine",
    "buy new",
    "neuf",
    "car rental",
    "rent",
    "for rent",
    "location",
    "download",
    "wallpaper",
    "مجاني",
    "جديد",
]


def write_campaigns() -> None:
    path = OUT / "01-campaigns.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "Campaign",
                "Status",
                "Type",
                "Budget",
                "Budget type",
                "Bid strategy type",
                "Networks",
                "Languages",
                "Locations",
                "Excluded locations",
                "Location options",
                "Note",
            ]
        )
        for name, budget in BUDGETS.items():
            w.writerow(
                [
                    name,
                    "Paused",
                    "Search",
                    budget,
                    "Daily",
                    "Manual CPC",
                    "Google search",
                    LANGUAGES,
                    LOCATIONS,
                    "Nigeria",
                    LOCATION_OPT,
                    "West Africa excl. Nigeria + North Africa. $30/day total. Paused until CEO approves.",
                ]
            )


def write_ad_groups() -> None:
    path = OUT / "02-ad-groups.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Campaign", "Ad group", "Status", "Max CPC"])
        for camp, groups in AD_GROUPS.items():
            for name, max_cpc in groups:
                w.writerow([camp, name, "Paused", max_cpc])


def write_keywords() -> None:
    rows = build_keywords()
    path = OUT / "03-keywords.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(
            f,
            fieldnames=["Campaign", "Ad group", "Keyword", "Match type", "Status", "Final URL"],
        )
        w.writeheader()
        w.writerows(rows)
    return len(rows)


def write_ads() -> None:
    path = OUT / "04-responsive-search-ads.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "Campaign",
                "Ad group",
                "Status",
                "Ad type",
                "Final URL",
                "Path 1",
                "Path 2",
                "Headline 1",
                "Headline 2",
                "Headline 3",
                "Headline 4",
                "Headline 5",
                "Headline 6",
                "Headline 7",
                "Description 1",
                "Description 2",
            ]
        )
        for (
            camp,
            group,
            content,
            page,
            p1,
            p2,
            h1,
            h2,
            h3,
            h4,
            h5,
            h6,
            h7,
            d1,
            d2,
        ) in ADS:
            slug = camp.replace("AF_Search_", "af_search_").lower()
            final = url(slug, content, "{keyword}", page).replace("{keyword}", "%7Bkeyword%7D")
            w.writerow(
                [
                    camp,
                    group,
                    "Paused",
                    "Responsive search ad",
                    final,
                    p1,
                    p2,
                    h1,
                    h2,
                    h3,
                    h4,
                    h5,
                    h6,
                    h7,
                    d1,
                    d2,
                ]
            )


def write_negatives() -> None:
    path = OUT / "05-negative-keywords.csv"
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["Campaign", "Negative keyword", "Match type", "Level"])
        for kw in NEGATIVES:
            w.writerow(["", kw, "Phrase", "Account"])


def write_readme(keyword_count: int) -> None:
    readme = OUT / "README.md"
    readme.write_text(
        f"""# Google Ads Editor — Africa Merged Final (excl. Nigeria)

Generated: 2026-07-06

Scope:
- **West Africa excluding Nigeria:** Ghana, Cote d'Ivoire, Togo, Benin, Senegal, Burkina Faso, Mali, Niger, Liberia, Sierra Leone, Guinea, Gambia
- **North Africa:** Egypt, Morocco, Algeria, Tunisia, Libya, Mauritania
- **Excluded:** Nigeria (account negative + location exclusion)

Budget (unchanged at ~$30/day):
- AF_Search_Engines_HighIntent — $21/day
- AF_Search_Gearboxes_HighIntent — $5/day
- AF_Search_HalfCuts_Import — $3/day
- AF_Search_Import_FromChina — $1.5/day

Languages: English, French, Arabic
Match type: Phrase only
Bid strategy: Manual CPC
Status: All Paused

Keywords: {keyword_count}

Import order: 01 → 05 CSV files

CEO guide: docs/marketing/google-ads-ceo-setup-guide-2026-07-06.md
""",
        encoding="utf-8",
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    write_campaigns()
    write_ad_groups()
    count = write_keywords()
    write_ads()
    write_negatives()
    write_readme(count)
    print(f"Wrote package to {OUT} ({count} keywords)")


if __name__ == "__main__":
    main()
