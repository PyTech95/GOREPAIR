"""Service catalogue for customer-facing app — curated from /app price list."""

CATALOG = [
    {
        "sku": "ac", "name": "Air Conditioner", "icon": "snowflake",
        "image": "https://images.unsplash.com/photo-1581275288578-bf930f5b0c2c?w=800",
        "tagline": "Repair, install & service for all AC brands",
        "services": [
            {"sku": "ac-service", "name": "AC General Service", "price": 549, "duration": "60 min", "desc": "Foam-jet cleaning of indoor + outdoor unit, gas pressure check"},
            {"sku": "ac-install", "name": "Split AC Installation", "price": 1499, "duration": "90 min", "desc": "Indoor + outdoor mounting, copper piping up to 3m, drain & test run"},
            {"sku": "ac-gas-recharge", "name": "Gas Refill (Split/Window)", "price": 1999, "duration": "90 min", "desc": "Leak inspection + R32/R410A gas top-up. Labour ₹499 + gas (quoted on-site)"},
            {"sku": "ac-not-cooling", "name": "Not Cooling / Cooling Issue", "price": 349, "duration": "45 min", "desc": "Diagnose cooling problem (compressor, capacitor, sensor, PCB). Visit + diagnosis. Repair quoted on-site."},
            {"sku": "ac-water-leak", "name": "Water Leakage Repair", "price": 399, "duration": "45 min", "desc": "Diagnose & fix drain pipe, blower, or insulation leak"},
            {"sku": "ac-noise", "name": "Noise / Vibration", "price": 399, "duration": "45 min", "desc": "Identify source (compressor / blower / fan / swing flap) and adjust"},
            {"sku": "ac-pcb-repair", "name": "AC PCB Board Repair", "price": 499, "duration": "60 min", "desc": "Inverter / non-inverter PCB diagnosis and repair. Labour only — chip cost extra if replacement needed."},
            {"sku": "ac-uninstall", "name": "Split AC Un-installation", "price": 799, "duration": "60 min", "desc": "Gas pump-down + safe dismantle"},
        ],
    },
    {
        "sku": "washing-machine", "name": "Washing Machine", "icon": "waves",
        "image": "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=800",
        "tagline": "Top-load, front-load & semi-automatic",
        "services": [
            {"sku": "wm-service", "name": "Washing Machine Service", "price": 449, "duration": "45 min", "desc": "Deep cleaning + filter clean + electrical check"},
            {"sku": "wm-install", "name": "Washing Machine Installation", "price": 299, "duration": "30 min", "desc": "Position, level, plumb-in, test wash cycle"},
            {"sku": "wm-not-spinning", "name": "Not Spinning / Wash Issue", "price": 349, "duration": "45 min", "desc": "Diagnose motor, belt, pulley, capacitor, PCB. Visit + diagnosis."},
            {"sku": "wm-water-leak", "name": "Water Leakage", "price": 349, "duration": "45 min", "desc": "Fix inlet/outlet pipe, drain pump, tub seal or door gasket"},
            {"sku": "wm-noise", "name": "Excess Noise / Vibration", "price": 349, "duration": "45 min", "desc": "Drum bearing, shocker, motor pulley or balancing rod check"},
            {"sku": "wm-pcb-repair", "name": "PCB / Display Board Repair", "price": 399, "duration": "60 min", "desc": "Top-load / front-load PCB or display board diagnosis"},
            {"sku": "wm-drum-clean", "name": "Drum Deep Cleaning (Chemical Wash)", "price": 799, "duration": "90 min", "desc": "Full dismantle, descale, sanitize drum, reassemble"},
            {"sku": "wm-door-stuck", "name": "Front-load Door Stuck / Locked", "price": 299, "duration": "30 min", "desc": "Door lock release, lock or hinge replacement labour"},
        ],
    },
    {
        "sku": "refrigerator", "name": "Refrigerator", "icon": "refrigerator",
        "image": "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800",
        "tagline": "Single, double & side-by-side door fridges",
        "services": [
            {"sku": "fridge-not-cooling", "name": "Not Cooling / Less Cooling", "price": 349, "duration": "60 min", "desc": "Diagnose compressor, gas, sensor, PCB. Visit + diagnosis."},
            {"sku": "fridge-gas-charge", "name": "Gas Refill (Single Door)", "price": 1499, "duration": "60 min", "desc": "Leak fix + R134a gas charge. Labour ₹349 + gas."},
            {"sku": "fridge-gas-double", "name": "Gas Refill (Double Door)", "price": 1799, "duration": "75 min", "desc": "Leak fix + gas charge for double-door fridges"},
            {"sku": "fridge-water-leak", "name": "Water Leakage / Defrost", "price": 349, "duration": "45 min", "desc": "Drain pipe, defrost timer, drain tray clean & fix"},
            {"sku": "fridge-door-repair", "name": "Door Gasket / Damaged Door", "price": 349, "duration": "45 min", "desc": "Door alignment, gasket replacement labour"},
            {"sku": "fridge-pcb-repair", "name": "PCB / Display Repair", "price": 499, "duration": "60 min", "desc": "Inverter / non-inverter PCB labour"},
            {"sku": "fridge-noise", "name": "Noise / Vibration", "price": 399, "duration": "45 min", "desc": "Compressor mount, fan motor or cabinet noise fix"},
            {"sku": "fridge-install", "name": "Installation & Demo", "price": 499, "duration": "30 min", "desc": "Position, level, first cool-down + demo"},
        ],
    },
    {
        "sku": "microwave", "name": "Microwave", "icon": "microwave",
        "image": "https://images.unsplash.com/photo-1574269909862-7e1d70bb9d61?w=800",
        "tagline": "Solo, grill & convection ovens",
        "services": [
            {"sku": "mw-not-heating", "name": "Not Heating", "price": 349, "duration": "45 min", "desc": "Diagnose magnetron, fuse, capacitor. Visit + diagnosis"},
            {"sku": "mw-service", "name": "General Service & Clean", "price": 399, "duration": "45 min", "desc": "Interior + grill cleaning, electrical check"},
            {"sku": "mw-door-fix", "name": "Door Switch / Hinge Fix", "price": 349, "duration": "30 min", "desc": "Door interlock, hinge or latch repair labour"},
            {"sku": "mw-noise", "name": "Noise / Sparking Inside", "price": 399, "duration": "45 min", "desc": "Mica sheet, waveguide cover, or fan noise diagnosis"},
        ],
    },
    {
        "sku": "tv", "name": "Television", "icon": "tv",
        "image": "https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=800",
        "tagline": "LED, LCD, Smart & QLED TVs",
        "services": [
            {"sku": "tv-no-display", "name": "No Display / Blank Screen", "price": 449, "duration": "60 min", "desc": "Diagnose panel, backlight, T-con or main board"},
            {"sku": "tv-no-sound", "name": "No Sound / Audio Issue", "price": 399, "duration": "45 min", "desc": "Speaker, amplifier or audio board check"},
            {"sku": "tv-mount", "name": "Wall Mount Installation", "price": 999, "duration": "60 min", "desc": "Bracket fitment + cable management. Bracket cost extra."},
            {"sku": "tv-pcb-repair", "name": "Mother Board / PCB Repair", "price": 599, "duration": "75 min", "desc": "Main board diagnosis + repair labour"},
        ],
    },
    {
        "sku": "geyser", "name": "Geyser / Water Heater", "icon": "droplets",
        "image": "https://images.unsplash.com/photo-1599619585752-c3edb42a414c?w=800",
        "tagline": "Storage & instant water heaters",
        "services": [
            {"sku": "gz-not-heating", "name": "Not Heating", "price": 349, "duration": "45 min", "desc": "Heating element, thermostat or pressure switch check"},
            {"sku": "gz-leak", "name": "Water Leakage", "price": 349, "duration": "45 min", "desc": "Tank, inlet/outlet pipe or safety valve fix"},
            {"sku": "gz-install", "name": "Geyser Installation", "price": 599, "duration": "60 min", "desc": "Wall mount, plumb-in, test run"},
            {"sku": "gz-service", "name": "Descaling & Service", "price": 449, "duration": "45 min", "desc": "Anode rod check, descale tank, electrical safety check"},
        ],
    },
    {
        "sku": "water-purifier", "name": "Water Purifier", "icon": "filter",
        "image": "https://images.unsplash.com/photo-1606767341197-37b3a3f1e3ad?w=800",
        "tagline": "RO, UV & Alkaline filters",
        "services": [
            {"sku": "ro-service", "name": "RO Service & Filter Change", "price": 599, "duration": "45 min", "desc": "All filter cleaning + sediment filter replacement labour. New filters extra."},
            {"sku": "ro-not-working", "name": "Not Working / No Water", "price": 349, "duration": "45 min", "desc": "Pump, valve, membrane or PCB check"},
            {"sku": "ro-install", "name": "RO Installation", "price": 799, "duration": "60 min", "desc": "Wall mount, tap connection, tank install"},
            {"sku": "ro-leak", "name": "Water Leakage", "price": 299, "duration": "30 min", "desc": "Joint, valve or pipe leak fix"},
        ],
    },
    {
        "sku": "chimney", "name": "Kitchen Chimney", "icon": "fan",
        "image": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
        "tagline": "Auto-clean & filter chimneys",
        "services": [
            {"sku": "ch-service", "name": "Deep Cleaning & Service", "price": 899, "duration": "90 min", "desc": "Oil collector clean, blade degrease, filter wash"},
            {"sku": "ch-install", "name": "Chimney Installation", "price": 1499, "duration": "90 min", "desc": "Wall mount, exhaust pipe, electrical connection"},
            {"sku": "ch-not-working", "name": "Suction / Noise Issue", "price": 449, "duration": "60 min", "desc": "Motor, blade or switch diagnosis"},
        ],
    },
    {
        "sku": "dishwasher", "name": "Dishwasher", "icon": "utensils",
        "image": "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800",
        "tagline": "Built-in & free-standing dishwashers",
        "services": [
            {"sku": "dw-service", "name": "General Service", "price": 599, "duration": "60 min", "desc": "Spray arm, filter clean, salt + rinse-aid top-up"},
            {"sku": "dw-not-cleaning", "name": "Dishes Not Cleaning", "price": 449, "duration": "60 min", "desc": "Spray nozzle, pump or detergent dosing check"},
            {"sku": "dw-install", "name": "Dishwasher Installation", "price": 1199, "duration": "75 min", "desc": "Position, plumb-in, test run"},
            {"sku": "dw-leak", "name": "Water Leakage", "price": 449, "duration": "45 min", "desc": "Hose, door gasket or pump seal repair"},
        ],
    },
]

SKU_INDEX = {s["sku"]: s for cat in CATALOG for s in cat["services"]}
CATEGORY_INDEX = {c["sku"]: c for c in CATALOG}
