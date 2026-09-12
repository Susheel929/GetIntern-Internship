# SIGNAL — Voice Media Dashboard

A zero-framework, browser-based media dashboard that brings **voice commands, news, weather, and space content** into one responsive interface.

SIGNAL is built with plain **HTML, CSS, and JavaScript** and uses native browser APIs instead of frontend frameworks or third-party UI libraries. The project focuses on practical frontend engineering: API integration, voice interaction, defensive input validation, modular JavaScript, accessible UI states, and resilient error handling.

## Features

### Voice control
- Uses the native **Web Speech Recognition API** (`SpeechRecognition` / `webkitSpeechRecognition`).
- Shows live transcript feedback.
- Supports simple natural-language commands:
  - `search news for <topic>`
  - `weather in <city>`
  - `show space`
  - `clear`
- Reuses the same query pipeline as the manual form.

### News
- Fetches articles from **NewsAPI**.
- Displays headlines, descriptions, source names, images, and external article links.
- Includes loading, empty, error, and retry states.

### Weather
- Uses **Open-Meteo Geocoding API** to resolve a city into coordinates.
- Uses **Open-Meteo Forecast API** for current weather conditions.
- Displays temperature, weather condition, humidity, wind speed, timezone, and timestamp.
- Normalizes API data before passing it to the UI.

### Space
- Fetches NASA's **Astronomy Picture of the Day (APOD)**.
- Supports image and video APOD responses.
- Displays title, date, and explanation.

### Validation and security-minded frontend practices
- Allowlist-based validation for search queries, city names, and email addresses.
- Additional detection for common script/SQL injection patterns.
- Input sanitization and length limits.
- API/user text is HTML-escaped before being inserted into the DOM.
- External links use `rel="noopener noreferrer"`.
- Validation failures and suspicious inputs are recorded in the activity log.

### Resilience and UX
- Concurrent startup API checks with `Promise.allSettled()`.
- Concurrent user-triggered News/Weather requests.
- Request timeout handling through the shared fetch helper.
- Loading, empty, error, and retry states.
- Service status indicators for News, Weather, and Space.
- Toast notifications.
- Activity log capped to prevent unbounded DOM growth.
- Responsive three-rail dashboard layout.

## Tech Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)
- Web Speech Recognition API
- Fetch API
- NewsAPI
- Open-Meteo Geocoding API
- Open-Meteo Weather API
- NASA APOD API
- No React
- No Vue
- No Angular
- No package manager required

## Project Structure

```text
voice-media-dashboard/
├── index.html
├── css/
│   ├── base.css
│   ├── components.css
│   └── layout.css
├── js/
│   ├── api.js
│   ├── app.js
│   ├── config.js
│   ├── logger.js
│   ├── speech.js
│   ├── ui.js
│   └── validators.js
└── .vscode/
    └── settings.json
```

## Architecture

The JavaScript is split into small modules with clear responsibilities:

```text
index.html
    │
    └── app.js
         ├── UI          → DOM rendering and visual state
         ├── Speech      → speech recognition + command parsing
         ├── Api         → external API requests + normalization
         ├── Validators  → sanitization + validation
         └── Logger      → activity/error logging
```

### Module responsibilities

**`app.js`**
- Application orchestration.
- Event binding.
- Manual form submission.
- Voice command dispatch.
- Startup service checks.

**`api.js`**
- Shared HTTP/JSON request helper.
- NewsAPI integration.
- Open-Meteo geocoding and weather integration.
- NASA APOD integration.
- Weather data normalization.
- Concurrent service checks.

**`speech.js`**
- Web Speech Recognition API wrapper.
- Listening state management.
- Transcript handling.
- Voice-command parsing.

**`validators.js`**
- Allowlist regex rules.
- Input sanitization.
- Injection-pattern detection.
- Shared validation result format.

**`ui.js`**
- DOM references.
- Tab switching.
- Mic and waveform state.
- Form feedback.
- Toasts and status chips.
- Loading/error/empty states.
- News, weather, and APOD rendering.
- HTML escaping.

**`logger.js`**
- Console logging.
- In-dashboard activity log.
- Bounded log history.

## APIs and Setup

### 1. NewsAPI

Create a NewsAPI key from:

```text
https://newsapi.org/
```

Put your own key into the project configuration.

### 2. Open-Meteo

Open-Meteo provides the geocoding and weather endpoints used by this project and does not require an API key for the basic requests used here.

```text
https://open-meteo.com/
```

### 3. NASA API

Create a NASA API key from:

```text
https://api.nasa.gov/
```

Then add your own key to the project configuration.

## Important Security Note

**Do not commit real API keys to GitHub.**

The current project configuration contains credential values, so before publishing this repository:

1. Replace any exposed credentials with your own credentials.
2. Rotate/revoke any key that has already been exposed publicly.
3. Do not rely on `.gitignore` to protect a key that is already committed to Git history.
4. For a production deployment, move sensitive API access behind a backend/serverless endpoint rather than exposing private credentials in frontend JavaScript.

For a simple local/demo setup, keep credentials in a local configuration file and exclude that file from version control.

## Running Locally

This is a static frontend project, so no build process is required.

### Option 1 — VS Code Live Server

Open the project in VS Code and run `index.html` with the **Live Server** extension.

The bundled VS Code settings use:

```text
http://localhost:5501
```

### Option 2 — Any static HTTP server

Serve the project directory with any local static server and open `index.html` through the server.

Using an HTTP server is preferred over opening the file directly with `file://`, especially for browser permissions and API/voice behavior.

## Voice Commands

Try:

```text
search news for artificial intelligence
weather in Warangal
show space
clear
```

Browser support for speech recognition varies. Chromium-based browsers generally provide the best compatibility for the Web Speech Recognition API.

## Error Handling

The dashboard is designed to fail gracefully:

- API errors are shown inside the relevant result panel.
- Failed News/Space requests can be retried.
- Weather failures preserve a retry path.
- Unsupported speech recognition disables the microphone control.
- Invalid form inputs are highlighted before submission.
- Unexpected failures are logged rather than leaving the interface blank.

## Accessibility Notes

The interface includes:
- Semantic sections and headings.
- Accessible button labels.
- `aria-live` regions for changing status/transcript content.
- `aria-selected` state for tabs.
- Visible validation feedback.
- Keyboard-friendly native controls.

## Development Practices Demonstrated

This project is useful as a portfolio example because it demonstrates:

- Modular vanilla JavaScript.
- Native browser API usage.
- Asynchronous programming with `async/await`.
- `Promise.allSettled()` for resilient/concurrent requests.
- API response normalization.
- Defensive input handling.
- DOM-safe rendering through escaping.
- Progressive enhancement for voice interaction.
- Separation of application, API, validation, UI, and logging responsibilities.
- Responsive frontend layout without a UI framework.

## Limitations

- NewsAPI and NASA access depend on external services and their current availability/rate limits.
- Browser support for Speech Recognition varies.
- The email field is validation-only in the current demo; it does not send an email.
- Frontend API keys are not suitable for secure production use.
- API CORS and provider policies may affect deployment depending on the hosting environment.

## Future Improvements

- Add a backend API proxy for protected credentials.
- Support additional voice commands and languages.
- Add weather forecasts beyond current conditions.
- Add more NASA media options.
- Add saved searches and local preferences.
- Add theme switching and user-customizable dashboard layouts.
- Add automated tests for validation, command parsing, and API normalization.
- Add CI checks and code-quality tooling.

## License

This project is released under the **MIT License**. See [`LICENSE`](LICENSE).

## Repository Description

> SIGNAL — Voice Media Dashboard combining voice commands, live news, weather, and NASA APOD using vanilla HTML, CSS, JavaScript, native browser APIs, validation, logging, and resilient API handling.
