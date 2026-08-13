#!/usr/bin/env python3
"""Build bilingual cities-seed.json from dr5hn CSC cities + curated extras.

Source: https://github.com/dr5hn/countries-states-cities-database
Completeness target for this app:
  - every country capital
  - world cities with population >= 200k
  - first-level admin seats (adm1)
  - curated travel extras from the previous seed (e.g. 呈坎)
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSV_PATH = Path("/tmp/city-sources/csv-cities.csv")
COUNTRIES_PATH = Path("/tmp/city-sources/csc-countries.json")
OLD_SEED_PATH = ROOT / "scripts/fixtures/cities-seed-curated.json"
OUT_SRC = ROOT / "src/data/cities-seed.json"
OUT_PUBLIC = ROOT / "public/data/cities-seed.json"

CJK_RE = re.compile(r"[\u4e00-\u9fff]")
POP_MIN = 200_000
CANONICAL_EN_BY_ZH = {
    "南京": "Nanjing",
    "北京": "Beijing",
    "上海": "Shanghai",
    "东京": "Tokyo",
    "大阪": "Osaka",
    "京都": "Kyoto",
}

EXTRA_PLACES = [
    {
        "name": "Chengkan",
        "nameZh": "呈坎",
        "aliases": ["Chengkan Village", "呈坎村"],
        "countryCode": "CN",
        "countryName": "China",
        "lat": 29.9256,
        "lng": 118.2908,
    },
    {
        "name": "Yangshuo",
        "nameZh": "阳朔",
        "countryCode": "CN",
        "countryName": "China",
        "lat": 24.7785,
        "lng": 110.4965,
    },
    {
        "name": "Dali",
        "nameZh": "大理",
        "countryCode": "CN",
        "countryName": "China",
        "lat": 25.6065,
        "lng": 100.2676,
    },
    {
        "name": "Lijiang",
        "nameZh": "丽江",
        "countryCode": "CN",
        "countryName": "China",
        "lat": 26.8550,
        "lng": 100.2270,
    },
    {
        "name": "Xishuangbanna",
        "nameZh": "西双版纳",
        "aliases": ["Jinghong", "景洪"],
        "countryCode": "CN",
        "countryName": "China",
        "lat": 22.0076,
        "lng": 100.7974,
    },
    {
        "name": "Zanzibar",
        "nameZh": "桑给巴尔",
        "aliases": ["Zanzibar City", "Stone Town"],
        "countryCode": "TZ",
        "countryName": "Tanzania",
        "lat": -6.1659,
        "lng": 39.2026,
    },
]


def pop_of(row: dict) -> int:
    try:
        return int(row.get("population") or 0)
    except ValueError:
        return 0


def is_cjk(value: str | None) -> bool:
    return bool(value and CJK_RE.search(value))


def normalize_name(value: str) -> str:
    return re.sub(r"[^a-z0-9\u4e00-\u9fff]+", "", value.casefold())


def main() -> None:
    if not CSV_PATH.exists():
        raise SystemExit(f"Missing {CSV_PATH}")

    with CSV_PATH.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))

    countries = json.loads(COUNTRIES_PATH.read_text(encoding="utf-8"))
    capitals = {
        item["iso2"]: item["capital"]
        for item in countries
        if item.get("iso2") and item.get("capital")
    }
    country_names = {
        item["iso2"]: item["name"] for item in countries if item.get("iso2")
    }

    old_seed = json.loads(OLD_SEED_PATH.read_text(encoding="utf-8"))
    by_country: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_country[row["country_code"]].append(row)

    chosen: dict[str, tuple[dict, int]] = {}
    reasons: Counter[str] = Counter()

    def add(row: dict, reason: str) -> None:
        try:
            lat = float(row["latitude"])
            lng = float(row["longitude"])
        except (TypeError, ValueError):
            return
        if lat == 0 and lng == 0:
            return

        native = (row.get("native") or "").strip()
        name = row["name"].strip()
        country_code = row["country_code"]
        population = pop_of(row)

        name_zh = native if is_cjk(native) else None
        entry = {
            "name": name,
            "countryCode": country_code,
            "countryName": country_names.get(country_code) or row["country_name"],
            "lat": round(lat, 4),
            "lng": round(lng, 4),
        }
        if name_zh and name_zh != name:
            entry["nameZh"] = name_zh

        # Dedupe same place under alternate English spellings / nearby coords.
        if name_zh:
            dedupe_key = (country_code, f"zh:{normalize_name(name_zh)}")
        else:
            dedupe_key = (
                country_code,
                f"en:{normalize_name(name)}",
                round(lat, 1),
                round(lng, 1),
            )
        existing = chosen.get(str(dedupe_key))
        if existing and existing[1] >= population:
            return
        chosen[str(dedupe_key)] = (entry, population)
        reasons[reason] += 1

    for row in rows:
        population = pop_of(row)
        country_code = row["country_code"]
        # China CSC rows include many high-pop districts; keep larger cities only.
        cn_min = 500_000 if country_code == "CN" else POP_MIN
        if population >= cn_min:
            add(row, "pop")
        elif row.get("type") == "adm1" and population >= 20_000:
            add(row, "adm1")

    def fold(value: str) -> str:
        return (
            value.casefold()
            .replace("á", "a")
            .replace("à", "a")
            .replace("â", "a")
            .replace("ã", "a")
            .replace("ä", "a")
            .replace("é", "e")
            .replace("è", "e")
            .replace("ê", "e")
            .replace("í", "i")
            .replace("ó", "o")
            .replace("ô", "o")
            .replace("õ", "o")
            .replace("ú", "u")
            .replace("ü", "u")
            .replace("ç", "c")
            .replace("ñ", "n")
            .replace("’", "'")
            .replace("‘", "'")
        )

    country_meta = {item["iso2"]: item for item in countries if item.get("iso2")}
    for iso, capital in capitals.items():
        candidates = by_country.get(iso, [])
        folded_cap = fold(capital)
        exact = [row for row in candidates if fold(row["name"]) == folded_cap]
        if not exact:
            exact = [
                row
                for row in candidates
                if folded_cap in fold(row["name"]) or fold(row["name"]) in folded_cap
            ]
        if exact:
            exact.sort(key=pop_of, reverse=True)
            add(exact[0], "capital")
            continue

        # Fallback: use country centroid from the countries table when city rows miss.
        meta = country_meta.get(iso)
        if not meta:
            continue
        try:
            lat = float(meta["latitude"])
            lng = float(meta["longitude"])
        except (TypeError, ValueError, KeyError):
            continue
        synthetic = {
            "id": f"capital:{iso}",
            "name": capital,
            "native": "",
            "country_code": iso,
            "country_name": meta.get("name") or iso,
            "latitude": str(lat),
            "longitude": str(lng),
            "population": "0",
            "type": "capital",
        }
        add(synthetic, "capital-fallback")

    old_by_key = {
        (item["countryCode"], item["name"].lower()): item for item in old_seed
    }
    for entry, _population in chosen.values():
        old = old_by_key.get((entry["countryCode"], entry["name"].lower()))
        if not old:
            # Try match by Chinese name.
            old = next(
                (
                    item
                    for item in old_seed
                    if item["countryCode"] == entry["countryCode"]
                    and item.get("nameZh")
                    and item["nameZh"] == entry.get("nameZh")
                ),
                None,
            )
        if not old:
            continue
        if old.get("nameZh") and not entry.get("nameZh"):
            entry["nameZh"] = old["nameZh"]
        if old.get("aliases"):
            entry["aliases"] = old["aliases"]

    present_names = {
        (item["countryCode"], item["name"].lower()) for item, _ in chosen.values()
    }
    present_zh = {
        (item["countryCode"], item["nameZh"])
        for item, _ in chosen.values()
        if item.get("nameZh")
    }

    def missing_from_chosen(item: dict) -> bool:
        key = (item["countryCode"], item["name"].lower())
        zh_key = (item["countryCode"], item.get("nameZh"))
        if key in present_names:
            return False
        if item.get("nameZh") and zh_key in present_zh:
            return False
        return True

    for item in old_seed:
        if not missing_from_chosen(item):
            continue
        chosen[f"seed:{item['countryCode']}:{item['name']}"] = (item, 0)
        reasons["legacy-seed"] += 1
        present_names.add((item["countryCode"], item["name"].lower()))
        if item.get("nameZh"):
            present_zh.add((item["countryCode"], item["nameZh"]))

    for item in EXTRA_PLACES:
        if not missing_from_chosen(item):
            continue
        chosen[f"extra:{item['countryCode']}:{item['name']}"] = (item, 0)
        reasons["extra"] += 1

    # Final collapse by Chinese name / normalized English name.
    collapsed: dict[str, tuple[dict, int]] = {}
    for entry, population in chosen.values():
        if entry.get("nameZh"):
            key = f"{entry['countryCode']}|zh|{normalize_name(entry['nameZh'])}"
        else:
            key = (
                f"{entry['countryCode']}|en|{normalize_name(entry['name'])}|"
                f"{round(entry['lat'], 1)}|{round(entry['lng'], 1)}"
            )
        def name_score(item: dict) -> tuple[int, int]:
            name = item["name"]
            camel_penalty = sum(
                1
                for index in range(1, len(name))
                if name[index].isupper() and name[index - 1].islower()
            )
            return (-camel_penalty, -len(name))

        prev = collapsed.get(key)
        if prev:
            better_pop = population > prev[1]
            same_pop_better_name = population == prev[1] and name_score(entry) > name_score(
                prev[0]
            )
            if not better_pop and not same_pop_better_name:
                if not prev[0].get("aliases") and entry.get("aliases"):
                    prev[0]["aliases"] = entry["aliases"]
                continue
            if prev[0].get("aliases") and not entry.get("aliases"):
                entry = {**entry, "aliases": prev[0]["aliases"]}
        collapsed[key] = (entry, population)

    cities = sorted(
        (entry for entry, _population in collapsed.values()),
        key=lambda item: (item["countryCode"], item.get("nameZh") or item["name"]),
    )
    for entry in cities:
        canonical = CANONICAL_EN_BY_ZH.get(entry.get("nameZh", ""))
        if canonical:
            entry["name"] = canonical

    payload = json.dumps(cities, ensure_ascii=False, indent=2) + "\n"
    OUT_SRC.write_text(payload, encoding="utf-8")
    OUT_PUBLIC.write_text(payload, encoding="utf-8")

    by_cc = Counter(item["countryCode"] for item in cities)
    with_zh = sum(1 for item in cities if item.get("nameZh"))
    print(f"wrote {len(cities)} cities across {len(by_cc)} countries")
    print(f"with nameZh: {with_zh}")
    print(f"reasons: {dict(reasons)}")
    print("top countries:", by_cc.most_common(12))
    for query in ["上海", "北京", "南京", "张家口", "呈坎", "马尼拉", "旧金山"]:
        hits = [
            item
            for item in cities
            if query in (item.get("nameZh") or "")
            or query.lower() in item["name"].lower()
            or any(query.lower() in alias.lower() for alias in item.get("aliases", []))
        ]
        print(query, "->", [(h["name"], h.get("nameZh")) for h in hits[:3]] or "MISSING")


if __name__ == "__main__":
    main()
