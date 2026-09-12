/* ===========================================================
   API
   Native fetch() + async/await only.
   Every network call returns:
     { ok: boolean, data: any|null, error: string|null }
   =========================================================== */

const Api = (() => {

  /**
   * fetch() has no built-in timeout, so AbortController is used
   * to prevent a request from hanging indefinitely.
   */
  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      controller.abort();
    }, CONFIG.REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Safely fetch JSON and return a uniform result.
   */
  async function safeJsonFetch(url, options = {}) {
    try {
      console.log("API Request:", url);

      const response = await fetchWithTimeout(url, options);

      console.log(
        "API Response:",
        response.status,
        response.statusText
      );

      if (!response.ok) {
        let message = `Request failed (HTTP ${response.status} ${response.statusText})`;

        // Try to read API error body
        try {
          const errorData = await response.json();

          if (errorData?.reason) {
            message = errorData.reason;
          }

          if (errorData?.message) {
            message = errorData.message;
          }
        } catch {
          // Ignore JSON parsing failure
        }

        return {
          ok: false,
          data: null,
          error: message
        };
      }

      const data = await response.json();

      console.log("API Data:", data);

      return {
        ok: true,
        data,
        error: null
      };

    } catch (err) {

      console.error("API Error:", err);

      if (err.name === "AbortError") {
        return {
          ok: false,
          data: null,
          error:
            "Request timed out. Check your connection and try again."
        };
      }

      return {
        ok: false,
        data: null,
        error:
          err.message || "Network request failed."
      };
    }
  }


  // =========================================================
  // NEWS
  // =========================================================

  async function fetchNews(topic) {

    if (
      !CONFIG.NEWS_API_KEY ||
      CONFIG.NEWS_API_KEY ===
        CONFIG.NEWS_API_KEY_PLACEHOLDER
    ) {
      return {
        ok: false,
        data: null,
        error:
          "No NewsAPI key configured. Add your NewsAPI key to CONFIG.NEWS_API_KEY."
      };
    }

    const q = encodeURIComponent(
      topic || CONFIG.DEFAULT_TOPIC
    );

    const url =
      `${CONFIG.NEWS_BASE_URL}` +
      `?q=${q}` +
      `&sortBy=publishedAt` +
      `&pageSize=9` +
      `&apiKey=${encodeURIComponent(CONFIG.NEWS_API_KEY)}`;

    const result = await safeJsonFetch(url);

    if (!result.ok) {
      return result;
    }

    if (result.data?.status !== "ok") {
      return {
        ok: false,
        data: null,
        error:
          result.data?.message ||
          "News API returned an error."
      };
    }

    return {
      ok: true,
      data: result.data.articles || [],
      error: null
    };
  }


  // =========================================================
  // WEATHER - STEP 1: GEOCODING
  // =========================================================

  async function geocodeCity(cityName) {

    const city =
      String(cityName || CONFIG.DEFAULT_CITY).trim();

    if (!city) {
      return {
        ok: false,
        data: null,
        error: "Please enter a city name."
      };
    }

    const url =
      `${CONFIG.GEOCODE_BASE_URL}` +
      `?name=${encodeURIComponent(city)}` +
      `&count=1` +
      `&language=en` +
      `&format=json`;

    const result = await safeJsonFetch(url);

    if (!result.ok) {
      return result;
    }

    if (
      !result.data ||
      !Array.isArray(result.data.results) ||
      result.data.results.length === 0
    ) {
      return {
        ok: false,
        data: null,
        error: `No location found for "${city}".`
      };
    }

    const match = result.data.results[0];

    return {
      ok: true,
      data: match,
      error: null
    };
  }


  // =========================================================
  // WEATHER - STEP 2: FORECAST
  // =========================================================

  async function fetchWeather(cityName) {

    // First find coordinates
    const geo = await geocodeCity(cityName);

    if (!geo.ok) {
      return geo;
    }

    const {
      latitude,
      longitude,
      name,
      country,
      admin1
    } = geo.data;

    // Make sure coordinates exist
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number"
    ) {
      return {
        ok: false,
        data: null,
        error: "Invalid coordinates returned for the city."
      };
    }

    const url =
      `${CONFIG.WEATHER_BASE_URL}` +
      `?latitude=${latitude}` +
      `&longitude=${longitude}` +
      `&current=temperature_2m` +
      `,relative_humidity_2m` +
      `,apparent_temperature` +
      `,wind_speed_10m` +
      `,weather_code` +
      `&timezone=auto`;

    const weatherResult =
      await safeJsonFetch(url);

    if (!weatherResult.ok) {
      return weatherResult;
    }

    const current =
      weatherResult.data?.current;

    if (!current) {
      return {
        ok: false,
        data: null,
        error:
          "Weather API returned no current weather data."
      };
    }

    // -------------------------------------------------------
    // NORMALIZED WEATHER DATA
    // This makes the UI much easier to render.
    // -------------------------------------------------------

    const weatherData = {

      // Location
      city: name,
      country: country,
      region: admin1 || "",

      // Backward-compatible aliases used by the existing UI/app.
      resolvedName: name,
      resolvedCountry: country,

      latitude: latitude,
      longitude: longitude,

      // Temperature
      temperature: current.temperature_2m,
      apparentTemperature:
        current.apparent_temperature,

      // Humidity
      humidity:
        current.relative_humidity_2m,

      // Wind
      windSpeed:
        current.wind_speed_10m,

      // Open-Meteo weather code
      weatherCode:
        current.weather_code,

      // Units
      temperatureUnit:
        weatherResult.data?.current_units
          ?.temperature_2m || "°C",

      windUnit:
        weatherResult.data?.current_units
          ?.wind_speed_10m || "km/h",

      // Original API response
      current: current,

      // Helpful metadata
      timezone:
        weatherResult.data?.timezone ||
        "auto",

      time:
        current.time
    };

    console.log(
      "Normalized Weather Data:",
      weatherData
    );

    return {
      ok: true,
      data: weatherData,
      error: null
    };
  }


  // =========================================================
  // WEATHER CODE -> DESCRIPTION
  // =========================================================

  function getWeatherDescription(code) {

    const weatherCodes = {

      0: "Clear sky",

      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",

      45: "Fog",
      48: "Depositing rime fog",

      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",

      56: "Light freezing drizzle",
      57: "Dense freezing drizzle",

      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",

      66: "Light freezing rain",
      67: "Heavy freezing rain",

      71: "Slight snowfall",
      73: "Moderate snowfall",
      75: "Heavy snowfall",

      77: "Snow grains",

      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",

      85: "Slight snow showers",
      86: "Heavy snow showers",

      95: "Thunderstorm",

      96: "Thunderstorm with slight hail",
      99: "Thunderstorm with heavy hail"
    };

    return (
      weatherCodes[code] ||
      "Unknown weather"
    );
  }


  // =========================================================
  // SPACE - NASA APOD
  // =========================================================

  async function fetchApod() {

    const url =
      `${CONFIG.NASA_APOD_URL}` +
      `?api_key=${encodeURIComponent(CONFIG.NASA_API_KEY)}`;

    return safeJsonFetch(url);
  }


  // =========================================================
  // CONCURRENT STATUS CHECK
  // =========================================================

  async function checkAllServices() {

    const [
      news,
      weather,
      space
    ] = await Promise.allSettled([

      fetchNews(
        CONFIG.DEFAULT_TOPIC
      ),

      fetchWeather(
        CONFIG.DEFAULT_CITY
      ),

      fetchApod()

    ]);

    return {

      news:
        news.status === "fulfilled"
          ? news.value
          : {
              ok: false,
              data: null,
              error:
                "Unexpected News API failure"
            },

      weather:
        weather.status === "fulfilled"
          ? weather.value
          : {
              ok: false,
              data: null,
              error:
                "Unexpected Weather API failure"
            },

      space:
        space.status === "fulfilled"
          ? space.value
          : {
              ok: false,
              data: null,
              error:
                "Unexpected NASA API failure"
            }
    };
  }


  // =========================================================
  // PUBLIC API
  // =========================================================

  return {

    fetchNews,

    geocodeCity,

    fetchWeather,

    getWeatherDescription,

    fetchApod,

    checkAllServices

  };

})();