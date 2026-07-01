const cityInput = document.getElementById("city");
const searchBtn = document.getElementById("searchBtn");
const locationBtn = document.getElementById("locationBtn");
const loader = document.getElementById("loader");
const recentSearches = document.getElementById("recentSearches");
const forecastContainer = document.getElementById("forecastContainer");
const themeToggle = document.getElementById("themeToggle");
const statusMessage = document.getElementById("statusMessage");
const locationBadge = document.getElementById("locationBadge");
const sunMarker = document.getElementById("sunMarker");
const sunriseLabel = document.getElementById("sunriseLabel");
const sunsetLabel = document.getElementById("sunsetLabel");
const citySuggestions = document.getElementById("citySuggestions");
const hourlyForecastEl = document.getElementById("hourlyForecast");
const assistantMessageEl = document.getElementById("assistantMessage");
const assistantTipsEl = document.getElementById("assistantTips");
const travelRecommendationEl = document.getElementById("travelRecommendation");
let isCurrentLocationMode = false;
let suggestionDebounceTimer = null;
let activeSuggestionIndex = -1;
const suggestionCache = new Map();

window.addEventListener("DOMContentLoaded", () => {
    initTheme();
    renderRecentSearches();
    themeToggle.addEventListener("click", toggleTheme);

    searchBtn.addEventListener("click", () => {
        hideSuggestions();
        getWeather(cityInput.value.trim());
    });

    cityInput.addEventListener("input", handleCityInput);
    cityInput.addEventListener("focus", () => {
        if (cityInput.value.trim()) {
            requestCitySuggestions(cityInput.value.trim());
        }
    });
    cityInput.addEventListener("keydown", handleCityKeydown);
    document.addEventListener("click", handleOutsideClick);

    locationBtn.addEventListener("click", () => requestCurrentLocationWeather());

    requestCurrentLocationWeather();
});

function getApiUrl(pathname) {
    const configuredBase = window.__WEATHER_API_URL__?.trim();
    const base = configuredBase || window.location.origin;
    return new URL(pathname.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`).toString();
}

function handleCityInput(event) {
    const value = event.target.value.trim();
    activeSuggestionIndex = -1;

    if (!value) {
        hideSuggestions();
        return;
    }

    clearTimeout(suggestionDebounceTimer);
    suggestionDebounceTimer = setTimeout(() => {
        requestCitySuggestions(value);
    }, 300);
}

function handleCityKeydown(event) {
    const suggestions = citySuggestions?.querySelectorAll(".suggestion-item") || [];

    if (!suggestions.length) {
        if (event.key === "Enter") {
            event.preventDefault();
            getWeather(cityInput.value.trim());
        }
        return;
    }

    if (event.key === "ArrowDown") {
        event.preventDefault();
        activeSuggestionIndex = activeSuggestionIndex < suggestions.length - 1 ? activeSuggestionIndex + 1 : 0;
        updateActiveSuggestion(suggestions);
    } else if (event.key === "ArrowUp") {
        event.preventDefault();
        activeSuggestionIndex = activeSuggestionIndex > 0 ? activeSuggestionIndex - 1 : suggestions.length - 1;
        updateActiveSuggestion(suggestions);
    } else if (event.key === "Enter") {
        event.preventDefault();
        const selected = suggestions[activeSuggestionIndex] || suggestions[0];
        if (selected) {
            selected.click();
        }
    } else if (event.key === "Escape") {
        event.preventDefault();
        hideSuggestions();
    }
}

function updateActiveSuggestion(suggestions) {
    Array.from(suggestions).forEach((item, index) => {
        item.classList.toggle("active", index === activeSuggestionIndex);
        if (index === activeSuggestionIndex) {
            item.scrollIntoView({ block: "nearest" });
        }
    });
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHTML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;");
}

function highlightMatch(text, query) {
    const safeText = escapeHTML(text || "");
    const safeQuery = escapeRegExp(query.trim());

    if (!safeQuery) {
        return safeText;
    }

    return safeText.replace(new RegExp(`(${safeQuery})`, "ig"), "<mark>$1</mark>");
}

async function requestCitySuggestions(query) {
    const trimmed = query.trim();
    if (!trimmed) {
        hideSuggestions();
        return;
    }

    const cacheKey = trimmed.toLowerCase();
    if (suggestionCache.has(cacheKey)) {
        renderSuggestions(suggestionCache.get(cacheKey), trimmed);
        return;
    }

    if (citySuggestions) {
        citySuggestions.innerHTML = '<div class="suggestions-status"><span class="suggestions-spinner"></span>Loading cities...</div>';
        citySuggestions.classList.add("active");
        citySuggestions.setAttribute("aria-expanded", "true");
    }

    try {
        const suggestionsUrl = new URL(getApiUrl("/suggestions"));
        suggestionsUrl.searchParams.set("query", trimmed);

        const response = await fetch(suggestionsUrl.toString());
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to fetch city suggestions");
        }

        const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
        suggestionCache.set(cacheKey, suggestions);
        renderSuggestions(suggestions, trimmed);
    } catch (err) {
        console.error("Suggestion error:", err);
        renderSuggestions([], trimmed, true, err.message);
    }
}

function renderSuggestions(suggestions, query, isError = false, message = "") {
    if (!citySuggestions) return;

    if (!query.trim()) {
        hideSuggestions();
        return;
    }

    if (isError) {
        citySuggestions.innerHTML = `<div class="suggestions-status error">${escapeHTML(message || "Unable to load suggestions")}</div>`;
        citySuggestions.classList.add("active");
        citySuggestions.setAttribute("aria-expanded", "true");
        return;
    }

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
        citySuggestions.innerHTML = '<div class="suggestions-status">No cities found</div>';
        citySuggestions.classList.add("active");
        citySuggestions.setAttribute("aria-expanded", "true");
        return;
    }

    const visibleSuggestions = suggestions.slice(0, 5);
    citySuggestions.innerHTML = "";

    visibleSuggestions.forEach((item, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "suggestion-item";
        button.setAttribute("role", "option");
        button.setAttribute("data-index", String(index));
        button.innerHTML = `
            <span class="suggestion-icon">📍</span>
            <span class="suggestion-text">
                <span class="suggestion-name">${highlightMatch(item.name || item.displayName || "", query)}</span>
                <span class="suggestion-meta">${[item.state, item.country].filter(Boolean).join(" • ")}</span>
            </span>
        `;
        button.addEventListener("click", () => selectSuggestion(item));
        citySuggestions.appendChild(button);
    });

    citySuggestions.classList.add("active");
    citySuggestions.setAttribute("aria-expanded", "true");
    activeSuggestionIndex = -1;
}

function selectSuggestion(suggestion) {
    const value = suggestion.name || suggestion.displayName || suggestion.city || "";
    if (!value) return;

    cityInput.value = value;
    hideSuggestions();
    getWeather(value);
}

function hideSuggestions() {
    if (!citySuggestions) return;

    citySuggestions.innerHTML = "";
    citySuggestions.classList.remove("active");
    citySuggestions.setAttribute("aria-expanded", "false");
    activeSuggestionIndex = -1;
}

function handleOutsideClick(event) {
    const searchShell = cityInput.closest(".search-input-shell");
    if (searchShell && !searchShell.contains(event.target)) {
        hideSuggestions();
    }
}

function requestCurrentLocationWeather() {
    if (!navigator.geolocation) {
        isCurrentLocationMode = false;
        showStatus("Geolocation is not supported in this browser. Trying an approximate location instead.", true);
        getApproximateLocationWeather();
        return;
    }

    showStatus("Detecting your location...");
    showLoader(true);

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            getWeatherByCoords(lat, lon);
        },
        () => {
            isCurrentLocationMode = false;
            showStatus("Location access was blocked. Trying an approximate location instead.", true);
            getApproximateLocationWeather();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

async function getApproximateLocationWeather() {
    showLoader(true);

    try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();

        if (!response.ok || !data.latitude || !data.longitude) {
            throw new Error("Unable to detect your location");
        }

        getWeatherByCoords(data.latitude, data.longitude);
    } catch (err) {
        console.error("Approximate location error:", err);
        showStatus("Unable to detect your location right now. Please search for a city manually.", true);
    } finally {
        showLoader(false);
    }
}

async function getWeather(city) {
    if (!city) return;

    isCurrentLocationMode = false;
    showLoader(true);

    try {
        const weatherUrl = new URL(getApiUrl("/weather"));
        weatherUrl.searchParams.set("city", city);

        const response = await fetch(weatherUrl.toString());
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to fetch weather");
        }

        updateWeatherUI(data);
        addRecentCity(city);
    } catch (err) {
        console.error("Error:", err);
        showStatus(err.message, true);
    } finally {
        showLoader(false);
    }
}

async function getWeatherByCoords(lat, lon) {
    showLoader(true);

    try {
        const [forecastResponse, reverseResponse] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,is_day&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto&forecast_days=5`),
            fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=en&format=json`)
        ]);

        const forecastData = await forecastResponse.json();
        const reverseData = await reverseResponse.json();

        const current = forecastData.current;
        const daily = forecastData.daily;
        const locationResult = reverseData.results?.[0];
        const placeName = locationResult?.name || locationResult?.admin1 || "Your location";
        const countryName = locationResult?.country || "";

        isCurrentLocationMode = true;

        updateWeatherUI({
            city: placeName,
            country: countryName,
            temperature: Math.round(current.temperature_2m),
            feels_like: Math.round(current.apparent_temperature),
            humidity: current.relative_humidity_2m,
            weather: getWeatherDescription(current.weather_code),
            description: getWeatherDescription(current.weather_code),
            icon: getWeatherIcon(current.weather_code, current.is_day),
            wind: current.wind_speed_10m,
            windDirection: current.wind_direction_10m,
            pressure: current.pressure_msl,
            clouds: current.cloud_cover,
            sunrise: daily.sunrise?.[0],
            sunset: daily.sunset?.[0],
            minTemp: Math.round(daily.temperature_2m_min?.[0]),
            maxTemp: Math.round(daily.temperature_2m_max?.[0]),
            forecast: daily.time.slice(0, 5).map((date, index) => ({
                date,
                minTemp: Math.round(daily.temperature_2m_min[index]),
                maxTemp: Math.round(daily.temperature_2m_max[index]),
                description: getWeatherDescription(daily.weather_code[index])
            }))
        });
    } catch (err) {
        console.error("Error:", err);
        isCurrentLocationMode = false;
        showStatus("Unable to fetch your location weather. Please search for a city manually.", true);
    } finally {
        showLoader(false);
    }
}

function updateWeatherUI(data) {
    showStatus("");

    if (locationBadge) {
        locationBadge.classList.toggle("hidden", !isCurrentLocationMode);
    }

    document.getElementById("cityName").textContent = data.city || "City Name";
    document.getElementById("country").textContent = data.country || "";
    document.getElementById("temperature").textContent = `${data.temperature ?? "--"}°C`;
    document.getElementById("description").textContent = data.description || "Weather Description";
    document.getElementById("date").textContent = new Date().toLocaleDateString();
    document.getElementById("time").textContent = new Date().toLocaleTimeString();
    document.getElementById("feelsLike").textContent = `${data.feels_like ?? "--"}°C`;
    document.getElementById("minTemp").textContent = `${data.minTemp ?? "--"}°C`;
    document.getElementById("maxTemp").textContent = `${data.maxTemp ?? "--"}°C`;
    document.getElementById("humidity").textContent = `${data.humidity ?? "--"}%`;
    document.getElementById("wind").textContent = `${data.wind ?? "--"} m/s`;
    document.getElementById("windDirection").textContent = `${data.windDirection ?? "--"}°`;
    document.getElementById("visibility").textContent = `${data.visibility ?? "--"} km`;
    document.getElementById("pressure").textContent = `${data.pressure ?? "--"} hPa`;
    document.getElementById("clouds").textContent = `${data.clouds ?? "--"}%`;
    document.getElementById("sunrise").textContent = formatTime(data.sunrise);
    document.getElementById("sunset").textContent = formatTime(data.sunset);
    document.getElementById("updated").textContent = new Date().toLocaleTimeString();

    const iconEl = document.getElementById("weatherIcon");
    iconEl.src = data.icon || "";
    iconEl.alt = data.weather || "Weather icon";
    iconEl.className = `weather-icon ${getAnimationClass(data.description || "")}`;

    updateWeatherVisuals(data.description || "");
    updateDayCycle(data.sunrise, data.sunset);
    renderForecast(data.forecast || []);
    renderHourlyForecast(data.hourlyForecast || []);
    renderAssistantCard(data);
    renderTravelRecommendation(data);
}

function initTheme() {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
    setTheme(theme);
}

function setTheme(theme) {
    document.body.dataset.theme = theme;
    if (themeToggle) {
        themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    }
    localStorage.setItem("theme", theme);
}

function toggleTheme() {
    const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
}

function showStatus(message, isError = false) {
    if (!statusMessage) return;

    statusMessage.textContent = message || "";
    statusMessage.className = `status-message${message ? " show" : ""}${isError ? " error" : ""}`;
}

function updateWeatherVisuals(description) {
    document.body.classList.remove("weather-clear", "weather-rainy", "weather-cloudy", "weather-stormy", "weather-snowy");

    const lower = description.toLowerCase();
    if (lower.includes("rain")) {
        document.body.classList.add("weather-rainy");
    } else if (lower.includes("snow")) {
        document.body.classList.add("weather-snowy");
    } else if (lower.includes("thunder")) {
        document.body.classList.add("weather-stormy");
    } else if (lower.includes("cloud")) {
        document.body.classList.add("weather-cloudy");
    } else {
        document.body.classList.add("weather-clear");
    }
}

function updateDayCycle(sunrise, sunset) {
    if (!sunMarker || !sunriseLabel || !sunsetLabel) return;

    sunriseLabel.textContent = formatTime(sunrise);
    sunsetLabel.textContent = formatTime(sunset);

    const now = new Date();
    const start = sunrise ? new Date(sunrise) : null;
    const end = sunset ? new Date(sunset) : null;

    if (!start || !end) {
        sunMarker.style.left = "50%";
        sunMarker.textContent = "☀️";
        return;
    }

    const total = end - start;
    const elapsed = now - start;
    const progress = Math.max(0, Math.min(1, elapsed / total));

    sunMarker.style.left = `${Math.round(progress * 100)}%`;
    sunMarker.textContent = now < start ? "🌅" : now > end ? "🌙" : "☀️";
}

function showLoader(show) {
    if (!loader) return;
    loader.style.display = show ? "block" : "none";
}

function addRecentCity(city) {
    const trimmed = city.trim();
    if (!trimmed) return;

    const searches = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    const filtered = searches.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
    filtered.unshift(trimmed);

    localStorage.setItem("recentSearches", JSON.stringify(filtered.slice(0, 5)));
    renderRecentSearches();
}

function renderRecentSearches() {
    const searches = JSON.parse(localStorage.getItem("recentSearches") || "[]");
    recentSearches.innerHTML = "";

    searches.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        li.addEventListener("click", () => getWeather(item));
        recentSearches.appendChild(li);
    });
}

function renderForecast(forecast) {
    forecastContainer.innerHTML = "";

    forecast.forEach((item) => {
        const card = document.createElement("div");
        card.className = "forecast-card";
        const dayName = new Date(item.date).toLocaleDateString("en", { weekday: "short" });

        card.innerHTML = `
            <div class="forecast-day">${dayName}</div>
            <div class="forecast-icon">${getForecastEmoji(item.description)}</div>
            <div class="forecast-description">${item.description}</div>
            <div class="forecast-temp">
                <span class="high">${item.maxTemp}°</span>
                <span class="low">${item.minTemp}°</span>
            </div>
        `;
        forecastContainer.appendChild(card);
    });
}

function renderHourlyForecast(items) {
    if (!hourlyForecastEl) return;

    if (!items.length) {
        hourlyForecastEl.innerHTML = '<div class="travel-card">Hourly forecast is unavailable right now.</div>';
        return;
    }

    hourlyForecastEl.innerHTML = items.slice(0, 8).map((item) => {
        const hourLabel = new Date(item.time).toLocaleTimeString([], { hour: "numeric" });
        return `
            <div class="hourly-card">
                <div class="hour">${hourLabel}</div>
                <div class="temp">${item.temperature ?? "--"}°</div>
                <div class="desc">${item.description || "Clear"}</div>
            </div>
        `;
    }).join("");
}

function renderAssistantCard(data) {
    if (!assistantMessageEl || !assistantTipsEl) return;

    const temp = Number(data.temperature ?? 0);
    const description = (data.description || "").toLowerCase();
    let headline = "Your weather outlook is looking comfortable.";
    let body = "Enjoy the day and keep an eye on the skies.";
    const tips = [];

    if (description.includes("rain") || description.includes("drizzle")) {
        headline = "A rainy spell is on the way.";
        body = "Carry a light umbrella and plan indoor activities for the next few hours.";
        tips.push("☔ Pack an umbrella", "🧥 Bring a waterproof layer");
    } else if (description.includes("snow")) {
        headline = "Snow is expected.";
        body = "Wear insulated layers and allow extra travel time.";
        tips.push("❄️ Warm layers", "🧤 Gloves and boots");
    } else if (description.includes("thunder")) {
        headline = "Stormy weather is nearby.";
        body = "Stay sheltered and avoid exposed outdoor plans.";
        tips.push("⛈️ Seek shelter", "📱 Check alerts");
    } else if (temp > 28) {
        headline = "It is a warm day.";
        body = "Stay hydrated and use sun protection if you are spending time outside.";
        tips.push("🌞 Sunscreen", "💧 Water bottle");
    } else if (temp < 10) {
        headline = "It will feel chilly.";
        body = "Layer up before heading out.";
        tips.push("🧥 Light jacket", "☕ Warm drink");
    } else {
        tips.push("🌤️ Great walking weather", "🧳 Light bag only");
    }

    assistantMessageEl.innerHTML = `<strong>${headline}</strong><p>${body}</p>`;
    assistantTipsEl.innerHTML = tips.map((tip) => `<span class="assistant-pill">${tip}</span>`).join("");
}

function renderTravelRecommendation(data) {
    if (!travelRecommendationEl) return;

    const temp = Number(data.temperature ?? 0);
    const description = (data.description || "").toLowerCase();
    let title = "A relaxed day trip would work well.";
    let detail = "This weather supports easy sightseeing and outdoor breaks.";
    let highlight = "🌿 Best for casual strolls";

    if (description.includes("rain") || description.includes("drizzle")) {
        title = "Indoor plans are the safest choice.";
        detail = "Choose museums, cafés, or shopping areas and keep your route flexible.";
        highlight = "🏛️ Ideal for indoor sightseeing";
    } else if (description.includes("snow")) {
        title = "Winter travel calls for a slower pace.";
        detail = "Focus on cozy stops, warm meals, and short outdoor walks.";
        highlight = "❄️ Great for cozy destinations";
    } else if (description.includes("thunder")) {
        title = "Postpone long outdoor travel if possible.";
        detail = "Keep plans short and stay near sheltered locations.";
        highlight = "⚡ Short trips only";
    } else if (temp > 28) {
        title = "Waterfront and park activities fit the day.";
        detail = "Start early, keep a sun hat handy, and plan breaks in the shade.";
        highlight = "🌊 Great for outdoor exploring";
    } else {
        title = "It is a comfortable day for sightseeing.";
        detail = "You can enjoy a mix of outdoor stops and quick café breaks.";
        highlight = "🚶 Perfect for city wandering";
    }

    travelRecommendationEl.innerHTML = `
        <div class="travel-card">
            <strong>${title}</strong>
            <span>${detail}</span>
        </div>
        <div class="travel-card">
            <strong>${highlight}</strong>
            <span>Current temperature: ${temp}°C • ${data.description || "Clear"}</span>
        </div>
    `;
}

function getForecastEmoji(description) {
    const lower = description.toLowerCase();

    if (lower.includes("rain")) return "🌧️";
    if (lower.includes("snow")) return "❄️";
    if (lower.includes("thunder")) return "⛈️";
    if (lower.includes("fog")) return "🌫️";
    if (lower.includes("cloud")) return "☁️";
    if (lower.includes("clear")) return "☀️";
    return "🌤️";
}

function formatTime(value) {
    if (!value) return "--:--";
    return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getAnimationClass(description) {
    const lower = description.toLowerCase();

    if (lower.includes("rain")) return "rainy";
    if (lower.includes("snow")) return "snowy";
    if (lower.includes("thunder")) return "stormy";
    if (lower.includes("cloud")) return "cloudy";
    if (lower.includes("clear")) return "sunny";
    return "default";
}

function getWeatherDescription(code) {
    const weatherMap = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        61: "Slight rain",
        63: "Moderate rain",
        65: "Heavy rain",
        71: "Slight snow",
        73: "Moderate snow",
        75: "Heavy snow",
        95: "Thunderstorm",
        96: "Thunderstorm with hail",
        99: "Thunderstorm with hail"
    };

    return weatherMap[code] || "Unknown";
}

function getWeatherIcon(code, isDay) {
    const iconMap = {
        0: isDay ? "01d" : "01n",
        1: isDay ? "02d" : "02n",
        2: isDay ? "03d" : "03n",
        3: isDay ? "04d" : "04n",
        45: "50d",
        48: "50d",
        51: "09d",
        53: "09d",
        55: "09d",
        61: "10d",
        63: "10d",
        65: "10d",
        71: "13d",
        73: "13d",
        75: "13d",
        95: "11d",
        96: "11d",
        99: "11d"
    };

    const icon = iconMap[code] || "01d";
    return `https://openweathermap.org/img/wn/${icon}@2x.png`;
}