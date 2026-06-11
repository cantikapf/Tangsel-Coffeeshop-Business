# ☕ Tangerang Selatan Coffee Ecosystem: Retail Banking Prospect

![Project Status](https://img.shields.io/badge/Status-Completed-success)
![Vanilla JS](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?logo=javascript&logoColor=black)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-199900?logo=leaflet&logoColor=white)

An interactive, geospatial dashboard designed to map out the entire coffee shop ecosystem in **Tangerang Selatan (Tangsel), Indonesia**. Initially conceptualized to visualize retail banking prospects, this dashboard provides deep business insights, growth trends, and actionable data on MSMEs in the F&B sector.

## ✨ Features

- 🗺️ **Interactive Maps**: High-performance geospatial visualization powered by **Leaflet.js**, featuring distinct markers for Independent vs. Chain coffee shops.
- 🔥 **Density Heatmap**: Toggleable heatmap layer to instantly identify high-density business zones (Serpong, Pamulang, Pondok Aren).
- 📈 **Growth Analytics**: Dynamic cumulative growth chart built with **Chart.js**, showing the explosive growth of F&B MSMEs from 2010 to 2026.
- ⏳ **Timeline Slider**: Interactive time-travel slider. Watch how the coffee landscape evolved year over year!
- 🗂️ **Directory & Filtering**: Switch seamlessly to the "Directory List" to filter merchants by Sub-district, Price Range, or Year Opened.
- 📱 **Fully Responsive**: Immersive "Glassmorphism" UI that elegantly adapts to Desktop, Tablet, and Mobile screens.

## 🛠️ Technology Stack

- **Frontend Core**: Vanilla HTML5, CSS3, JavaScript (ES6+).
- **Mapping**: [Leaflet.js](https://leafletjs.com/), Leaflet Heat.
- **Charts**: [Chart.js](https://www.chartjs.org/).
- **Data Preprocessing**: Node.js (for converting raw `.kmz` boundary files into optimized `.geojson`).
- **Icons**: FontAwesome.

## 🚀 How to Run Locally

Because this project fetches local JSON and GeoJSON data using the `fetch()` API, you cannot simply double-click the `index.html` file (due to browser CORS policies). You must run it through a local web server.

### Option 1: Using VS Code Live Server (Recommended)
1. Open this project folder in Visual Studio Code.
2. Install the **Live Server** extension.
3. Right-click on `index.html` and select **"Open with Live Server"**.

### Option 2: Using Node.js / NPX
1. Ensure you have Node.js installed.
2. Open your terminal in the project directory.
3. Run the following command:
   ```bash
   npx serve .
   ```
4. Open your browser and navigate to `http://localhost:3000/index.html`.

### Option 3: Using Python
1. Open your terminal in the project directory.
2. Run the built-in HTTP server:
   ```bash
   python -m http.server 8000
   ```
3. Open your browser and navigate to `http://localhost:8000/index.html`.

## 📂 Project Structure

```text
📁 Tangsel Coffeeshop Business
├── index.html           # Main application entry point
├── style.css            # Glassmorphism UI styling & Media Queries
├── script.js            # Core logic, Leaflet map, and Chart configuration
├── favicon.png          # App icon
├── 📁 data/
│   ├── 📁 geo/          # Geospatial data (KMZ & converted GeoJSON boundaries)
│   └── 📁 processed/    # Main JSON data (tangsel_coffee_master.json)
└── 📁 scripts/          # Node.js data preprocessing scripts
```

## 📝 Business Insights Highlights

- **Target Acquisition**: Identified 298 highly actionable retail MSME targets out of 328 total coffee shops.
- **CASA Float Potential**: Estimated Rp852 million to Rp1.99 billion/day in low-cost funding (CASA) through aggressive merchant onboarding.
- **Strategic Focus**: Highlighting multi-branch local establishments (e.g., Suksestama, H47) as high-value quick wins for retail banking.

---

*&copy; 2026 Cantikaputri Febrianti. Built with data-driven design.*
