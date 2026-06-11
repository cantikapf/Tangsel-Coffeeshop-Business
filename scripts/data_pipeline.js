/**
 * Tangsel Coffeeshop Data Build Pipeline
 * This single script replaces all the separate processing scripts.
 */
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');
const { DOMParser } = require('xmldom');
const toGeoJSON = require('@tmcw/togeojson');

const MASTER_FILE = path.join(__dirname, '../data/processed/tangsel_coffee_master.json');
const KMZ_DIR = path.join(__dirname, '../data/geo');
const GEOJSON_OUT = path.join(__dirname, '../data/geo/tangsel_kecamatan.geojson');

// --- 1. GEOJSON CONVERTER ---
async function convertKmzToGeojson() {
    console.log('--- Starting KMZ to GeoJSON Conversion ---');
    const files = fs.readdirSync(KMZ_DIR).filter(f => f.endsWith('.kmz'));
    const combinedFeatures = [];

    for (const file of files) {
        const filePath = path.join(KMZ_DIR, file);
        const zip = fs.createReadStream(filePath).pipe(unzipper.Parse({forceStream: true}));
        
        for await (const entry of zip) {
            if (entry.path.endsWith('.kml')) {
                const kmlContent = await entry.buffer();
                const kmlDoc = new DOMParser().parseFromString(kmlContent.toString(), 'text/xml');
                const geojson = toGeoJSON.kml(kmlDoc);
                if (geojson && geojson.features) {
                    geojson.features.forEach(f => {
                        f.properties = f.properties || {};
                        f.properties.kecamatan = file.replace('.kmz', '');
                    });
                    combinedFeatures.push(...geojson.features);
                }
            } else {
                entry.autodrain();
            }
        }
    }

    const featureCollection = { type: "FeatureCollection", features: combinedFeatures };
    fs.writeFileSync(GEOJSON_OUT, JSON.stringify(featureCollection));
    console.log(`Successfully converted ${files.length} KMZ files to ${GEOJSON_OUT}\n`);
}

// --- 2. DATA ENRICHMENT ---
function avgPriceFromRange(rangeStr) {
  if (!rangeStr) return 50000;
  const cleanStr = rangeStr.replace(/\./g, '');
  const matches = cleanStr.match(/\d+/g);
  let min = 0, max = 0;
  if (matches && matches.length >= 2) {
    min = parseInt(matches[0]);
    max = parseInt(matches[1]);
  } else if (matches && matches.length === 1) {
    if (rangeStr.includes('Di bawah') || rangeStr.includes('1.000')) {
      min = 1000;
      max = parseInt(matches[0]);
    } else {
      min = parseInt(matches[0]);
      max = min;
    }
  }
  let avgPrice = (min + max) / 2;
  if (avgPrice < 1000) avgPrice = avgPrice * 1000;
  return avgPrice > 0 ? avgPrice : 50000;
}

function hoursOpen(openHoursObj) {
  if (!openHoursObj || typeof openHoursObj !== 'object') return 10;
  const days = Object.values(openHoursObj);
  if (days.length === 0 || !days[0] || days[0].length === 0) return 10;
  
  const timeStr = days[0][0]; 
  const match = timeStr.match(/(\d{1,2})(?:\.(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?:\.(\d{2}))?\s*(am|pm)?/i);
  if (!match) return 10;
  
  let startH = parseInt(match[1], 10);
  let startM = match[2] ? parseInt(match[2], 10) : 0;
  let startMeridiem = match[3] ? match[3].toLowerCase() : '';
  let endH = parseInt(match[4], 10);
  let endM = match[5] ? parseInt(match[5], 10) : 0;
  let endMeridiem = match[6] ? match[6].toLowerCase() : '';
  
  if (startMeridiem === 'pm' && startH !== 12) startH += 12;
  if (startMeridiem === 'am' && startH === 12) startH = 0;
  if (endMeridiem === 'pm' && endH !== 12) endH += 12;
  if (endMeridiem === 'am' && endH === 12) endH = 0;
  
  let diff = (endH + endM/60) - (startH + startM/60);
  if (diff < 0) diff += 24;
  return diff;
}

function txPerHour(avgPrice) {
  if (avgPrice < 35000) return 20;
  if (avgPrice <= 75000) return 15;
  if (avgPrice > 75000) return 10;
  return 8;
}

function enrichData() {
  console.log('--- Starting Data Enrichment ---');
  if (!fs.existsSync(MASTER_FILE)) {
    console.error('Master file not found:', MASTER_FILE);
    return;
  }

  const raw = JSON.parse(fs.readFileSync(MASTER_FILE, 'utf8'));
  let updated = 0;

  raw.forEach((shop) => {
    const priceRange = shop.priceRange;
    const avgPrice = avgPriceFromRange(priceRange);
    if (avgPrice === null) {
      shop.estimatedDailyRevenue = null;
      return;
    }
    const openHours = hoursOpen(shop.open_hours);
    const perHour = txPerHour(avgPrice);
    const revenue = avgPrice * perHour * openHours;
    shop.estimatedDailyRevenue = Math.round(revenue / 100000) * 100000;
    updated += 1;
  });

  fs.writeFileSync(MASTER_FILE, JSON.stringify(raw, null, 2), 'utf8');
  console.log(`Updated ${updated} shops with estimated daily revenue.\n`);
}

// --- RUN ALL ---
async function runAll() {
    await convertKmzToGeojson();
    enrichData();
    console.log('Pipeline complete!');
}

if (require.main === module) {
    runAll().catch(console.error);
}

module.exports = { convertKmzToGeojson, enrichData };
