# Company HQ World Map

A beautiful interactive world map displaying company headquarters with detailed information on hover.

## Features

- 🌍 **Interactive World Map** - Built with Leaflet.js
- 🫧 **Company Bubbles** - Colorful bubbles with company logos at HQ locations
- 💬 **Rich Tooltips** - Hover to see detailed company information:
  - Company Name & Location
  - Number of Employees
  - Founded Year
  - Revenue Range
  - Description
  - Website Link
- 📱 **Responsive Design** - Works on all screen sizes
- 🎨 **Modern UI** - Gradient backgrounds and smooth animations

## Technologies Used

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Map Library**: Leaflet.js
- **Tile Provider**: OpenStreetMap
- **Design**: Modern gradient UI with smooth animations

## File Structure

```
.
├── index.html      # Main HTML file
├── styles.css      # Styling and animations
├── app.js          # Main application logic
├── data.js         # Mock company data (replace with API later)
└── README.md       # This file
```

## Getting Started

1. Clone or download this repository
2. Open `index.html` in a web browser
3. Explore the map and hover over company bubbles to see details

## Mock Data

The project comes with 8 mock companies across different continents:
- TechCorp Industries (San Francisco)
- GlobalFinance Solutions (London)
- EuroData Systems (Berlin)
- AsiaTech Ventures (Singapore)
- BrazilTech Innovation (São Paulo)
- MidEast Digital Hub (Dubai)
- CanadaSoft Development (Toronto)
- DownUnder Tech (Sydney)

## Customization

### Adding New Companies

Edit `data.js` and add a new object to the `companiesData` array:

```javascript
{
    id: 9,
    name: "Your Company",
    country: "Country",
    city: "City",
    latitude: 0.0,
    longitude: 0.0,
    description: "Description",
    website: "https://yourwebsite.com",
    employees: 1000,
    founded: 2020,
    revenueRange: "$X - $Y",
    bubbleColor: "bubble-bg-1" // or any available color class
}
```

### Changing Colors

Edit the color classes in `styles.css`:
- `.bubble-bg-1` through `.bubble-bg-8`

## Future Enhancements

- [ ] Connect to shared drive API for real company data
- [ ] Search/filter functionality
- [ ] Company clustering for densely populated areas
- [ ] Click to see more detailed company page
- [ ] Industry/sector filtering
- [ ] Data export capabilities
- [ ] Mobile app version

## Connecting to Your Shared Drive

Replace the `companiesData` array in `data.js` with an API call:

```javascript
async function loadCompaniesFromAPI() {
    try {
        const response = await fetch('YOUR_API_ENDPOINT');
        return await response.json();
    } catch (error) {
        console.error('Error loading companies:', error);
        return companiesData; // fallback to mock data
    }
}
```

## Deployment

The project can be deployed on any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- AWS S3
- Any web server

Simply upload the files and open `index.html` in your browser.

## License

Free to use and modify.
