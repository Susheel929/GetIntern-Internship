/* ===========================================================
   CONFIG
   All external API wiring lives here so it's obvious what to
   edit. No external validation/HTTP libraries are used anywhere
   in this project — only native fetch() and native regex.
   =========================================================== */

const CONFIG = {

  // =========================================================
  // NEWS API
  // =========================================================
  // Get your key from:
  // https://newsapi.org/register
  NEWS_API_KEY: "254f872728714e33b24853bf98c23d57",

  NEWS_BASE_URL: "https://newsapi.org/v2/everything",

  // Used by api.js to check whether the key was replaced
  NEWS_API_KEY_PLACEHOLDER:
    "PASTE_YOUR_REAL_NEWSAPI_KEY_HERE",


  // =========================================================
  // OPEN-METEO WEATHER API
  // =========================================================
  // NO API KEY REQUIRED
  //
  // Step 1:
  // Search city name and get latitude/longitude
  //
  // Step 2:
  // Use latitude/longitude to request weather
  //
  GEOCODE_BASE_URL:
    "https://geocoding-api.open-meteo.com/v1/search",

  WEATHER_BASE_URL:
    "https://api.open-meteo.com/v1/forecast",


  // =========================================================
  // NASA APOD
  // =========================================================
  // Get your personal key from:
  // https://api.nasa.gov/
  //
  // DEMO_KEY also works but is heavily rate limited.
  //
  NASA_API_KEY: "qXlBZU22qj7rUjs5bcRyVpWjfHz8XNQKGomAKI9z",

  NASA_APOD_URL:
    "https://api.nasa.gov/planetary/apod",


  // =========================================================
  // GENERAL SETTINGS
  // =========================================================

  // Maximum time allowed for an API request
  REQUEST_TIMEOUT_MS: 20000,

  // Default weather location
  DEFAULT_CITY: "Warangal",

  // Default news topic
  DEFAULT_TOPIC: "technology",
};