import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

const frontendPath = path.join(__dirname, "..", "Frontend");

app.get("/config.js", (req, res) => {
    const apiBase = process.env.API_BASE_URL || "";
    res.type("application/javascript");
    res.send(`window.__WEATHER_API_URL__ = ${JSON.stringify(apiBase)};`);
});

app.get("/suggestions", async (req, res) => {
    try {
        const query = req.query.query?.trim();

        if (!query) {
            return res.json({ suggestions: [] });
        }

        const geocodeResponse = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
            params: {
                name: query,
                count: 5,
                language: "en",
                format: "json"
            }
        });

        const suggestions = (geocodeResponse.data.results || []).map((location) => ({
            name: location.name,
            state: location.admin1 || "",
            country: location.country_code || location.country || "",
            countryName: location.country || "",
            displayName: [location.name, location.admin1].filter(Boolean).join(", ")
        }));

        res.json({ suggestions });
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch city suggestions",
            details: error.message
        });
    }
});

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

app.get("/weather", async (req, res) => {
    try {
        const city = req.query.city?.trim();

        if (!city) {
            return res.status(400).json({ error: "City is required" });
        }

        const geocodeResponse = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
            params: {
                name: city,
                count: 1,
                language: "en",
                format: "json"
            }
        });

        const location = geocodeResponse.data.results?.[0];

        if (!location) {
            return res.status(404).json({ error: "City not found" });
        }

        const forecastResponse = await axios.get("https://api.open-meteo.com/v1/forecast", {
            params: {
                latitude: location.latitude,
                longitude: location.longitude,
                current: [
                    "temperature_2m",
                    "relative_humidity_2m",
                    "apparent_temperature",
                    "weather_code",
                    "wind_speed_10m",
                    "wind_direction_10m",
                    "pressure_msl",
                    "cloud_cover",
                    "is_day"
                ],
                daily: ["weather_code", "temperature_2m_max", "temperature_2m_min", "sunrise", "sunset"],
                hourly: [
                    "temperature_2m",
                    "weather_code",
                    "precipitation_probability",
                    "wind_speed_10m"
                ],
                timezone: "auto",
                forecast_days: 5,
                current_weather: true
            }
        });

        const currentWeather = forecastResponse.data.current_weather || {};
        const current = forecastResponse.data.current || {};
        const daily = forecastResponse.data.daily || {};
        const hourly = forecastResponse.data.hourly || {};
        const weatherCode = currentWeather.weathercode ?? current.weather_code;
        const description = getWeatherDescription(weatherCode);

        const hourlyForecast = (hourly.time || []).slice(0, 8).map((time, index) => ({
            time,
            temperature: Math.round(hourly.temperature_2m?.[index]),
            description: getWeatherDescription(hourly.weather_code?.[index]),
            precipitationProbability: hourly.precipitation_probability?.[index] ?? 0,
            windSpeed: hourly.wind_speed_10m?.[index] ?? 0
        }));

        const data = {
            city: location.name,
            country: location.country,
            temperature: Math.round(currentWeather.temperature ?? current.temperature_2m),
            feels_like: Math.round(current.apparent_temperature ?? currentWeather.temperature),
            humidity: current.relative_humidity_2m,
            weather: description,
            description,
            icon: getWeatherIcon(weatherCode, currentWeather.is_day ?? current.is_day),
            wind: current.wind_speed_10m ?? currentWeather.windspeed,
            windDirection: current.wind_direction_10m ?? currentWeather.winddirection,
            pressure: current.pressure_msl,
            clouds: current.cloud_cover,
            sunrise: daily.sunrise?.[0],
            sunset: daily.sunset?.[0],
            minTemp: Math.round(daily.temperature_2m_min?.[0]),
            maxTemp: Math.round(daily.temperature_2m_max?.[0]),
            forecast: (daily.time || []).slice(0, 5).map((date, index) => ({
                date,
                minTemp: Math.round(daily.temperature_2m_min[index]),
                maxTemp: Math.round(daily.temperature_2m_max[index]),
                description: getWeatherDescription(daily.weather_code[index])
            })),
            hourlyForecast
        };

        res.json(data);
    } catch (error) {
        res.status(500).json({
            error: "Failed to fetch weather data",
            details: error.message
        });
    }
});

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

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});