import json
import os

def format_price(raw_str):
    if not raw_str: return None
    if raw_str == '$': return 'Rp 1.000 - Rp 25.000'
    if raw_str == '$$$': return 'Rp 50.000 - Rp 100.000'
    
    s = raw_str.replace('Rp\xa0', '').replace('\u2013', '-').replace('\ufffd', '-').replace(' ', '')
    if 'K' in s:
        parts = s.replace('K', '').split('-')
        if len(parts) == 2:
            return f'Rp {parts[0]}.000 - Rp {parts[1]}.000'
    elif '.000' in s:
        parts = s.replace('.000', '').split('-')
        if len(parts) == 2:
            return f'Rp {parts[0]}.000 - Rp {parts[1]}.000'
    return raw_str

raw_file = 'data/raw/raw_results_full.json'
master_file = 'data/processed/tangsel_coffee_master.json'

# Load raw
raw_prices = {}
with open(raw_file, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            d = json.loads(line)
            title = d.get('title')
            price = format_price(d.get('price_range'))
            if title and price:
                raw_prices[title] = price
        except Exception as e:
            pass

# Load master
with open(master_file, 'r', encoding='utf-8') as f:
    master = json.load(f)

updated = 0
for shop in master:
    name = shop.get('name')
    if name in raw_prices:
        shop['priceRange'] = raw_prices[name]
        updated += 1
    else:
        # Try to find a match if "Coffee" or something is missing
        found = False
        for r_name in raw_prices:
            if name.lower() in r_name.lower() or r_name.lower() in name.lower():
                shop['priceRange'] = raw_prices[r_name]
                updated += 1
                found = True
                break
        if not found:
            print("No match for", name)

with open(master_file, 'w', encoding='utf-8') as f:
    json.dump(master, f, indent=2)

print(f"Updated {updated} shops out of {len(master)}.")
