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
let isCurrentLocationMode = false;

window.addEventListener("DOMContentLoaded", () => {
    initTheme();
    renderRecentSearches();
    themeToggle.addEventListener("click", toggleTheme);

    searchBtn.addEventListener("click", () => getWeather(cityInput.value));
    cityInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            getWeather(cityInput.value);
        }
    });

    locationBtn.addEventListener("click", () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    getWeatherByCoords(lat, lon);
                },
                () => {
                    isCurrentLocationMode = false;
                    showStatus("Location access was blocked. Showing London weather instead.", true);
                    getWeather("London");
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            isCurrentLocationMode = false;
            showStatus("Geolocation is not supported in this browser. Showing London weather instead.", true);
            getWeather("London");
        }
    });

    getWeather("London");
});

async function getWeather(city) {
    if (!city) return;

    isCurrentLocationMode = false;
    showLoader(true);

    try {
        const API_URL = window.location.origin;

        const response = await fetch(`${API_URL}/weather?city=${encodeURIComponent(city)}`);
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
        showStatus("Unable to fetch your location weather. Showing London weather instead.", true);
        getWeather("London");
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