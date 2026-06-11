/* global L, Chart */
// Global Configuration
const DATA_URL = './data/processed/tangsel_coffee_master.json';
let coffeeData = [];
let map;
let kecamatanLayer;
let markersLayer;
let heatLayer;
let trendChart;

function formatRupiah(num) {
    if (num === null || num === undefined) return '–';
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
    }).format(num);
}

// Inisialisasi Aplikasi
document.addEventListener('DOMContentLoaded', async () => {
    initMap();
    await loadData();
    setupSlider();
    setupViewToggle();
    setupListFilters();
    setupBottomSheet();
    repositionChart();
    updateDashboard(parseInt(document.getElementById('yearSlider').value));
});

// 1. Inisialisasi Peta (Leaflet)
function initMap() {
    // Center di area Tangerang Selatan (Bintaro/Serpong)
    map = L.map('map').setView([-6.29, 106.68], 12);

    // Menggunakan tileset bersih dari CartoDB (Cocok untuk tema corporate)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    const aestheticColors = {
        'Ciputat': '#7FB3D5',
        'Ciputat Timur': '#76D7C4',
        'Pamulang': '#F8C471',
        'Pondok Aren': '#F1948A',
        'Serpong': '#C39BD3',
        'Serpong Utara': '#E59866',
        'Setu': '#82E0AA'
    };

    // Muat Batas Wilayah GeoJSON (Kecamatan di Tangerang Selatan)
    fetch('./data/geo/tangsel_kecamatan.geojson')
        .then(res => res.json())
        .then(data => {
            kecamatanLayer = L.geoJSON(data, {
                style: function (feature) {
                    const name = feature.properties.name || 'Unknown';
                    const color = aestheticColors[name] || '#6B7C98';
                    return {
                        color: color,
                        weight: 2,
                        opacity: 0.8,
                        fillColor: color,
                        fillOpacity: 0.2
                    };
                },
                onEachFeature: function (feature, layer) {
                    const name = feature.properties.name;
                    if (name) {
                        layer.bindTooltip(name, {
                            permanent: true,
                            direction: 'center',
                            className: 'kecamatan-tooltip'
                        });
                    }
                    layer.on('click', function () {
                        const filter = document.getElementById('filterKecamatan');
                        if (filter) {
                            filter.value = name;
                            filter.dispatchEvent(new Event('change'));
                        }
                    });
                }
            }).addTo(map);
        })
        .catch(err => console.error('Error loading GeoJSON:', err));

    markersLayer = L.layerGroup().addTo(map);

    // Tambahkan Legend Peta
    const legend = L.control({ position: 'bottomright' });
    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        L.DomEvent.disableClickPropagation(div);

        div.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;" id="legendHeader">
                <div style="font-weight: 700; font-size: 13px; color: var(--primary-color);">Marker Legend</div>
                <i class="fas fa-chevron-down" id="legendToggleIcon" style="color: var(--text-muted); font-size: 12px; transition: transform 0.2s; margin-left: 12px;"></i>
            </div>
            <div id="legendContent" style="margin-top: 8px;">
                <div class="legend-item">
                    <div class="legend-icon" style="background-color: #6B7C98; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>
                    <span>Independent Coffee Shop</span>
                </div>
                <div class="legend-item">
                    <div class="legend-icon" style="background-color: #AB978C; box-shadow: 0 0 8px rgba(171,151,140,0.8); width: 14px; height: 14px;"></div>
                    <span>Chain/Multi-Branch</span>
                </div>
            </div>
        `;

        setTimeout(() => {
            const header = document.getElementById('legendHeader');
            const content = document.getElementById('legendContent');
            const icon = document.getElementById('legendToggleIcon');
            if (header && content && icon) {
                header.addEventListener('click', () => {
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        icon.style.transform = 'rotate(0deg)';
                    } else {
                        content.style.display = 'none';
                        icon.style.transform = 'rotate(180deg)';
                    }
                });
            }
        }, 100);

        return div;
    };
    legend.addTo(map);
}

// 2. Memuat Data JSON
async function loadData() {
    try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        // Bersihkan data yang mungkin tidak memiliki koordinat
        coffeeData = data.filter(d => d.latitude && d.longitude);

        // Populate dropdown options
        const years = [...new Set(coffeeData.map(d => d.yearOpened).filter(Boolean))].sort((a, b) => b - a);
        const kecamatans = [...new Set(coffeeData.map(d => d.kecamatan || 'Others'))].sort();

        const filterYear = document.getElementById('filterYear');
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            filterYear.appendChild(opt);
        });

        const filterKecamatan = document.getElementById('filterKecamatan');
        kecamatans.forEach(k => {
            const opt = document.createElement('option');
            opt.value = k;
            opt.textContent = k;
            filterKecamatan.appendChild(opt);
        });

        const prices = [...new Set(coffeeData.map(d => d.priceRange).filter(Boolean))].sort();
        const filterPrice = document.getElementById('filterPrice');
        if (filterPrice) {
            prices.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                filterPrice.appendChild(opt);
            });
        }

        // Cari rentang tahun untuk slider
        if (coffeeData.length > 0) {
            const yearsList = coffeeData.map(d => d.yearOpened).filter(Boolean);
            const minYear = Math.min(...yearsList);
            const maxYear = 2026; // Scope max

            const slider = document.getElementById('yearSlider');
            slider.min = minYear;
            slider.max = maxYear;
            slider.value = maxYear;
        }

    } catch (error) {
        console.error('Error loading data:', error);
        alert('Failed to load coffeeshop data. Make sure you are running this using a Local Web Server (e.g., Live Server) due to CORS policy when fetching local JSON.');
    }
}

// 3. Setup Time Slider & Toggles
function setupSlider() {
    const slider = document.getElementById('yearSlider');
    const display = document.getElementById('yearDisplay');
    const heatmapToggle = document.getElementById('toggleHeatmap');
    const chartToggle = document.getElementById('toggleChart');
    const chartContainer = document.querySelector('.chart-container');

    let debounceTimer;
    slider.addEventListener('input', (e) => {
        // Update display text immediately during drag
        const selectedYear = parseInt(e.target.value);
        display.textContent = selectedYear;

        // Debounce heavy map & chart rendering
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            updateDashboard(selectedYear);
        }, 100);
    });

    heatmapToggle.addEventListener('change', (e) => {
        const selectedYear = parseInt(slider.value);
        const filteredData = coffeeData.filter(d => (d.yearOpened || 2026) <= selectedYear);
        updateMap(filteredData);
    });

    if (chartToggle) {
        chartToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                chartContainer.style.display = 'flex';
                chartContainer.classList.remove('minimized');
            } else {
                chartContainer.style.display = 'none';
            }
        });
    }

    const btnMinimize = document.getElementById('btnMinimizeChart');
    if (btnMinimize) {
        btnMinimize.addEventListener('click', () => {
            chartContainer.classList.toggle('minimized');

            // Sync with top bar checkbox if it's minimized vs hidden
            if (chartToggle && chartContainer.classList.contains('minimized')) {
                // We keep display = 'flex' but minimized
                // The toggle logic can remain independent, but we just leave it checked
            }
        });
    }
}

// 4. Update Keseluruhan Dashboard berdasarkan Tahun
function updateDashboard(targetYear) {
    if (!coffeeData || coffeeData.length === 0) return;

    // Filter data: Hanya kedai yang buka pada atau sebelum target tahun (jika null, asumsikan 2026)
    const filteredData = coffeeData.filter(d => (d.yearOpened || 2026) <= targetYear);

    updateMap(filteredData);
    updateChart(targetYear);

    // Update Statistik
    document.getElementById('totalShops').textContent = filteredData.length;

    // Hitung Estimasi CASA
    let totalRevenue = 0;
    filteredData.forEach(shop => {
        let avgPrice = 0;
        let baseTx = 8;
        if (shop.priceRange) {
            const cleanStr = shop.priceRange.replace(/\./g, '');
            const matches = cleanStr.match(/\d+/g);
            if (matches && matches.length >= 2) {
                avgPrice = (parseInt(matches[0]) + parseInt(matches[1])) / 2;
            } else if (matches && matches.length === 1) {
                if (shop.priceRange.includes('Di bawah') || shop.priceRange.includes('1.000')) {
                    avgPrice = (1000 + parseInt(matches[0])) / 2;
                } else {
                    avgPrice = parseInt(matches[0]);
                }
            }
            if (avgPrice < 1000) avgPrice *= 1000;
        }
        if (avgPrice === 0) avgPrice = 50000;

        if (avgPrice < 35000) baseTx = 15;
        else if (avgPrice <= 75000) baseTx = 10;
        else baseTx = 8;

        if (avgPrice === 0) return;

        let multiplier = 0.5; // default sepi
        const rev = shop.reviews || 0;
        if (rev >= 50 && rev < 300) multiplier = 1.0;
        else if (rev >= 300 && rev < 1000) multiplier = 2.0;
        else if (rev >= 1000) multiplier = 3.5;

        let hoursOpen = 10;
        if (shop.open_hours) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            if (shop.open_hours[today]) {
                const timeStr = shop.open_hours[today][0];
                const match = timeStr.match(/(\d{1,2})(?:\.(\d{2}))?\s*(am|pm)?\s*[-–]\s*(\d{1,2})(?:\.(\d{2}))?\s*(am|pm)?/i);
                if (match) {
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
                    let diff = (endH + endM / 60) - (startH + startM / 60);
                    if (diff < 0) diff += 24;
                    hoursOpen = diff;
                }
            }
        }

        totalRevenue += avgPrice * (baseTx * multiplier) * hoursOpen;
    });

    const casaEl = document.getElementById('casaFloat');
    if (casaEl) {
        casaEl.textContent = formatRupiah(totalRevenue) + '/day';
    }
}

function formatRupiahLoose(num) {
    if (num >= 1000000000) {
        return 'Est. Rp ' + (num / 1000000000).toFixed(1) + ' Billion';
    } else if (num >= 1000000) {
        return 'Est. Rp ' + Math.round(num / 1000000) + ' Million';
    }
    return 'Est. ' + formatRupiah(num);
}

function updateInsights() {
    const totalShops = coffeeData.length;
    const independent = coffeeData.filter(d => !d.isChain).length;

    // Hitung Estimasi CASA
    let totalRevenue = 0;
    coffeeData.forEach(d => {
        const estRevenue = parseFloat(d.estRevenue) || 0;
        totalRevenue += estRevenue;
    });

    const valIndependent = document.getElementById('valIndependent');
    if (valIndependent) {
        valIndependent.textContent = independent;
    }

    const casaEl = document.getElementById('casaFloat');
    if (casaEl) {
        casaEl.textContent = formatRupiahLoose(totalRevenue) + '/day';
    }
}

// Setup Toggles untuk Pindah View (Map vs List)
function setupViewToggle() {
    const btnMap = document.getElementById('btnMapView');
    const btnList = document.getElementById('btnListView');
    const viewMap = document.getElementById('mapViewWrapper');
    const viewList = document.getElementById('listViewWrapper');
    const topBar = document.querySelector('.top-bar');

    const collapseBottomSheet = () => {
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.style.transform = '';
        }
    };

    btnMap.addEventListener('click', () => {
        viewList.style.display = 'none';
        btnMap.style.background = 'white';
        btnMap.style.boxShadow = 'var(--shadow-sm)';
        btnMap.style.color = 'var(--primary-color)';
        btnList.style.background = 'transparent';
        btnList.style.boxShadow = 'none';
        btnList.style.color = 'var(--text-muted)';
        if (map) map.invalidateSize(); // Ensure Leaflet map re-render
        collapseBottomSheet();
    });

    btnList.addEventListener('click', () => {
        viewList.style.display = 'flex';
        btnList.style.background = 'white';
        btnList.style.boxShadow = 'var(--shadow-sm)';
        btnList.style.color = 'var(--primary-color)';
        btnMap.style.background = 'transparent';
        btnMap.style.boxShadow = 'none';
        btnMap.style.color = 'var(--text-muted)';
        renderListView();
        collapseBottomSheet();
    });
}

function highlightKecamatan(targetName) {
    if (!kecamatanLayer) return;
    kecamatanLayer.eachLayer(function (layer) {
        const name = layer.feature.properties.name;
        const color = layer.options.color;
        if (targetName === 'All' || targetName === '' || !targetName) {
            layer.setStyle({ weight: 2, opacity: 0.8, fillOpacity: 0.2, color: color });
            layer.getTooltip().setOpacity(1);
            if (targetName === 'All') map.setView([-6.29, 106.68], 12);
        } else {
            if (name === targetName) {
                layer.setStyle({ weight: 4, opacity: 1, fillOpacity: 0.5, color: color });
                layer.bringToFront();
                layer.getTooltip().setOpacity(1);
                map.flyToBounds(layer.getBounds(), { padding: [50, 50], duration: 1.5 });
            } else {
                layer.setStyle({ weight: 1, opacity: 0.3, fillOpacity: 0.05, color: '#ccc' });
                layer.getTooltip().setOpacity(0.2);
            }
        }
    });
}

function setupListFilters() {
    document.getElementById('filterKecamatan').addEventListener('change', (e) => {
        renderListView();
        highlightKecamatan(e.target.value);
    });
    document.getElementById('filterYear').addEventListener('change', renderListView);
    document.getElementById('searchShop').addEventListener('input', renderListView);

    // Mobile Filter Toggle
    const toggleHeader = document.getElementById('filterToggleMobile');
    const toggleIcon = document.getElementById('filterToggleIcon');
    const filterContent = document.getElementById('listFiltersContent');
    if (toggleHeader && toggleIcon && filterContent) {
        toggleHeader.addEventListener('click', () => {
            filterContent.classList.toggle('minimized');
            if (filterContent.classList.contains('minimized')) {
                toggleIcon.style.transform = 'rotate(180deg)';
            } else {
                toggleIcon.style.transform = 'rotate(0deg)';
            }
        });
    }

    const filterPrice = document.getElementById('filterPrice');
    if (filterPrice) filterPrice.addEventListener('change', renderListView);
}

function renderListView() {
    const selKecamatan = document.getElementById('filterKecamatan').value;
    const selYear = document.getElementById('filterYear').value;
    const selPrice = document.getElementById('filterPrice') ? document.getElementById('filterPrice').value : 'All';
    const searchQuery = document.getElementById('searchShop').value.toLowerCase();
    const container = document.getElementById('shopListContainer');

    container.innerHTML = '';

    const listData = coffeeData.filter(d => {
        const matchKecamatan = (selKecamatan === 'All') || (d.kecamatan === selKecamatan);
        const matchYear = (selYear === 'All') || ((d.yearOpened || 2026) == selYear);
        const matchPrice = (selPrice === 'All') || (d.priceRange === selPrice);
        const matchSearch = d.name.toLowerCase().includes(searchQuery);
        return matchKecamatan && matchYear && matchPrice && matchSearch;
    });

    if (listData.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 40px;">No coffee shops match these filters.</p>';
        return;
    }

    listData.forEach(shop => {
        const card = document.createElement('div');
        card.className = 'shop-card';
        const mapsLink = shop.directLink || `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;

        let hoursHtml = '';
        if (shop.open_hours) {
            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
            const todayHours = shop.open_hours[today] ? shop.open_hours[today][0] : 'Closed';
            hoursHtml = `<p style="color: #27ae60; font-weight: 600;"><i class="far fa-clock"></i> ${todayHours}</p>`;
        }

        const ratingHtml = shop.rating ? `<span class="shop-badge" style="background: rgba(243, 156, 18, 0.1); color: #f39c12;"><i class="fas fa-star"></i> ${shop.rating} (${shop.reviews || 0})</span>` : '';
        const priceBadge = shop.priceRange ? `<span class="shop-badge" style="background: rgba(46, 204, 113, 0.1); color: #27ae60;"><i class="fas fa-tags"></i> ${shop.priceRange}</span>` : '';
        const webHtml = shop.website ? `<a href="${shop.website}" target="_blank" style="background: var(--bg-light); color: var(--text-color);"><i class="fas fa-globe"></i> Website</a>` : '';
        const imgHtml = shop.thumbnail ? `<div style="width: 100px; height: 100px; border-radius: 8px; overflow: hidden; flex-shrink: 0; margin-right: 16px;"><img src="${shop.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;" alt="${shop.name}"></div>` : '';

        card.innerHTML = `
            ${imgHtml}
            <div class="shop-info" style="flex: 1;">
                <h4>${shop.name} ${shop.isChain ? '<span class="badge-chain">MULTI-BRANCH</span>' : ''}</h4>
                <p>📍 ${shop.address || 'Address not available'}</p>
                ${hoursHtml}
                <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                    <span class="shop-badge">${shop.kecamatan || 'Tangsel'}</span>
                    ${priceBadge}
                    ${ratingHtml}
                </div>
            </div>
            <div class="shop-actions" style="display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                <a href="${mapsLink}" target="_blank"><i class="fas fa-map-marked-alt"></i> View Map</a>
                ${webHtml}
            </div>
        `;
        container.appendChild(card);
    });
}

// 5. Render Marker ke Peta
function updateMap(dataToShow) {
    // Bersihkan marker lama
    markersLayer.clearLayers();
    if (heatLayer && map.hasLayer(heatLayer)) {
        map.removeLayer(heatLayer);
    }

    // Konfigurasi Ikon Kustom
    const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: #6B7C98; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.4);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6]
    });

    const chainIcon = L.divIcon({
        className: 'custom-div-icon chain-icon',
        html: `<div style="background-color: #AB978C; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(207,169,70,0.8);"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    const heatPoints = [];

    dataToShow.forEach(shop => {
        heatPoints.push([shop.latitude, shop.longitude, 1]); // Set intensitas konstan

        const isChain = shop.isChain;
        const marker = L.marker([shop.latitude, shop.longitude], { icon: isChain ? chainIcon : customIcon });

        // Buat link ke Google Maps
        const mapsLink = shop.directLink || `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`;

        let starStr = '★★★★★';
        if (shop.rating && shop.rating < 4.8) starStr = '★★★★☆';
        if (shop.rating && shop.rating < 3.8) starStr = '★★★☆☆';
        if (shop.rating && shop.rating < 2.8) starStr = '★★☆☆☆';

        let priceWidth = '33%';
        let priceColor = '#5E5653'; // Budget
        let priceLabel = shop.priceRange || 'N/A';
        
        let avgForUI = 0;
        if (shop.priceRange) {
            const cleanStr = shop.priceRange.replace(/\./g, '');
            const matches = cleanStr.match(/\d+/g);
            if (matches && matches.length >= 2) {
                avgForUI = (parseInt(matches[0]) + parseInt(matches[1])) / 2;
            } else if (matches && matches.length === 1) {
                if (shop.priceRange.includes('Di bawah') || shop.priceRange.includes('1.000')) {
                    avgForUI = (1000 + parseInt(matches[0])) / 2;
                } else {
                    avgForUI = parseInt(matches[0]);
                }
            }
            if (avgForUI < 1000) avgForUI *= 1000;
        }
        if (avgForUI === 0) avgForUI = 50000;

        if (avgForUI > 75000) { priceWidth = '100%'; priceColor = '#6B7C98'; }
        else if (avgForUI >= 35000) { priceWidth = '66%'; priceColor = '#AB978C'; }

        const imgHtml = shop.thumbnail ? `<div style="width: 100%; height: 140px; background: url('${shop.thumbnail}') center/cover;"></div>` : `<div style="width: 100%; height: 60px; background: linear-gradient(135deg, var(--primary-color), #5E5653);"></div>`;

        const popupContent = `
            ${imgHtml}
            <div class="popup-body">
                <div class="popup-title" style="font-size: 16px; margin-bottom: 4px; line-height: 1.2;">${shop.name}</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 8px; line-height: 1.4;">${shop.address || 'Tangerang Selatan'}</div>
                ${shop.rating ? `<div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;"><span style="color: #F5A623; letter-spacing: 2px; font-size: 14px;">${starStr}</span> <span style="font-size: 11px; font-weight: 600; color: var(--text-main);">${shop.rating}</span> <span style="font-size: 10px; color: var(--text-muted);">(${shop.reviews || 0} reviews)</span></div>` : ''}
                
                <div style="background: #F8F9FA; padding: 12px; border-radius: 8px; margin-bottom: 12px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); font-weight: 700; margin-bottom: 6px; letter-spacing: 0.5px;">
                        <span>BUDGET</span><span>PREMIUM</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: #E9E6E7; border-radius: 4px; overflow: hidden;">
                        <div style="width: ${priceWidth}; height: 100%; background: ${priceColor}; border-radius: 4px;"></div>
                    </div>
                    <div style="font-size: 11px; font-weight: 700; color: var(--text-main); margin-top: 6px; text-align: center;">${priceLabel}</div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
                    <div style="font-size: 11px; color: var(--text-muted);">Est. <strong style="color: var(--text-main);">${shop.yearOpened}</strong></div>
                    <a href="${mapsLink}" target="_blank" style="background: var(--primary-color); color: white; text-decoration: none; padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 600;">Open Maps</a>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        markersLayer.addLayer(marker);
    });

    const showHeatmap = document.getElementById('toggleHeatmap').checked;

    // Tambahkan lapisan heatmap di bawah titik (marker) jika di-check
    if (showHeatmap) {
        heatLayer = L.heatLayer(heatPoints, {
            radius: 35,
            blur: 25,
            maxZoom: 14,
            max: 1.0,
            gradient: {
                0.2: '#fff33b',
                0.4: '#fdc70c',
                0.6: '#f3903f',
                0.8: '#ed683c',
                1.0: '#e93e3a'
            }
        }).addTo(map);
    }
}

// 6. Inisialisasi dan Update Grafik (Chart.js)
function updateChart(targetYear) {
    // Siapkan data agregasi tahun demi tahun
    const yearCounts = {};

    // Hitung jumlah toko per tahun HINGGA targetYear
    coffeeData.forEach(shop => {
        const y = shop.yearOpened || 2026;
        if (y <= targetYear) {
            yearCounts[y] = (yearCounts[y] || 0) + 1;
        }
    });

    // Urutkan tahun dari awal hingga target year
    const sortedYears = Object.keys(yearCounts).sort((a, b) => a - b);

    // Hitung kumulatif
    let cumulative = 0;
    const labels = [];
    const dataPoints = [];

    // Jika ingin chart menampilkan semua tahun hingga targetYear
    const validYears = coffeeData.map(d => d.yearOpened).filter(Boolean);
    const minYear = Math.min(...validYears);
    for (let y = minYear; y <= targetYear; y++) {
        labels.push(y);
        const countThisYear = yearCounts[y] || 0;
        cumulative += countThisYear;
        dataPoints.push(cumulative);
    }

    const ctx = document.getElementById('trendChart').getContext('2d');

    // Hancurkan chart lama jika ada
    if (trendChart) {
        trendChart.destroy();
    }

    // Buat chart baru
    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Cumulative Coffee Shops',
                data: dataPoints,
                borderColor: '#AB978C', // Warm Taupe
                backgroundColor: 'rgba(171, 151, 140, 0.25)', // Taupe 25% opacity
                borderWidth: 3,
                pointBackgroundColor: '#6B7C98',
                pointBorderColor: '#fff',
                pointRadius: 4,
                fill: true,
                tension: 0.4 // Smooth curve
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (elements.length > 0) {
                    const dataIndex = elements[0].index;
                    const clickedYear = labels[dataIndex];

                    const slider = document.getElementById('yearSlider');
                    if (slider) {
                        slider.value = clickedYear;
                        document.getElementById('yearDisplay').textContent = clickedYear;
                        updateDashboard(clickedYear);
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#6B7C98',
                    titleFont: { family: 'Plus Jakarta Sans', size: 13 },
                    bodyFont: { family: 'Plus Jakarta Sans', size: 13 },
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return `Cumulative Total: ${context.parsed.y} Shops`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Plus Jakarta Sans' } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#E9E6E7', borderDash: [5, 5] },
                    ticks: { font: { family: 'Plus Jakarta Sans' } }
                }
            }
        }
    });
}

// 7. Setup Mobile Bottom Sheet Drag
function setupBottomSheet() {
    const sidebar = document.getElementById('sidebar');
    const dragHandle = document.getElementById('dragHandle');
    const sidebarHeader = document.querySelector('.sidebar-header');

    if (!sidebar || !dragHandle) return;

    let startY = 0;
    let isDragging = false;
    let hasMoved = false;
    let initialTranslateY = 0;

    const getHeights = () => {
        const viewportHeight = window.innerHeight;
        const expandedHeight = viewportHeight * 0.85; // 85vh
        const collapsedHeight = viewportHeight * 0.20; // 20vh
        return { maxTranslateY: expandedHeight - collapsedHeight };
    };

    const toggleSidebar = () => {
        if (window.innerWidth > 768) return;
        const { maxTranslateY } = getHeights();
        const style = window.getComputedStyle(sidebar);
        const transform = style.getPropertyValue('transform');
        let currentTranslate = maxTranslateY;
        if (transform && transform !== 'none') {
            currentTranslate = new DOMMatrix(transform).m42;
        }

        if (currentTranslate > maxTranslateY * 0.5) {
            sidebar.style.transform = `translateY(0)`; // Expand
        } else {
            sidebar.style.transform = ''; // Collapse
        }
    };

    const onTouchStart = (e) => {
        if (window.innerWidth > 768) return;
        isDragging = true;
        hasMoved = false;
        startY = e.touches[0].clientY;

        const style = window.getComputedStyle(sidebar);
        const transform = style.getPropertyValue('transform');
        if (transform !== 'none') {
            const matrix = new DOMMatrix(transform);
            initialTranslateY = matrix.m42;
        } else {
            initialTranslateY = getHeights().maxTranslateY;
        }

        sidebar.classList.add('dragging');
    };

    const onTouchMove = (e) => {
        if (!isDragging) return;
        const deltaY = e.touches[0].clientY - startY;
        if (Math.abs(deltaY) > 5) hasMoved = true;

        let newTranslateY = initialTranslateY + deltaY;
        const { maxTranslateY } = getHeights();

        if (newTranslateY < 0) newTranslateY = newTranslateY * 0.2;
        if (newTranslateY > maxTranslateY) newTranslateY = maxTranslateY + (newTranslateY - maxTranslateY) * 0.2;

        sidebar.style.transform = `translateY(${newTranslateY}px)`;
    };

    const onTouchEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        sidebar.classList.remove('dragging');

        if (!hasMoved) {
            // It was just a tap, toggle it
            toggleSidebar();
            return;
        }

        const { maxTranslateY } = getHeights();
        const style = window.getComputedStyle(sidebar);
        const transform = style.getPropertyValue('transform');
        let currentTranslate = maxTranslateY;
        if (transform !== 'none') {
            currentTranslate = new DOMMatrix(transform).m42;
        }

        if (currentTranslate < maxTranslateY * 0.6) {
            sidebar.style.transform = `translateY(0)`;
        } else {
            sidebar.style.transform = ''; // revert to CSS default (collapsed)
        }
    };

    dragHandle.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);

    // Allow clicking the header or drag handle to toggle
    if (sidebarHeader) {
        sidebarHeader.addEventListener('click', (e) => {
            if (!hasMoved) toggleSidebar();
        });
    }
}

// 8. Reposition Chart for Mobile
function repositionChart() {
    const chartContainer = document.getElementById('chartContainer');
    const insightPanel = document.querySelector('.insight-panel');
    const mapViewWrapper = document.getElementById('mapViewWrapper');
    if (!chartContainer || !insightPanel || !mapViewWrapper) return;

    if (window.innerWidth <= 768) {
        if (chartContainer.parentElement !== insightPanel) {
            insightPanel.insertBefore(chartContainer, insightPanel.firstChild);
        }
    } else {
        if (chartContainer.parentElement !== mapViewWrapper) {
            mapViewWrapper.appendChild(chartContainer);
        }
    }
}
window.addEventListener('resize', repositionChart);
