import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeatherPayload } from './server.js';

test('buildWeatherPayload creates a complete weather response for a location', () => {
  const location = {
    name: 'Ludhiana',
    country: 'IN',
    latitude: 30.9,
    longitude: 75.8
  };

  const forecastResponse = {
    current_weather: { temperature: 26, weathercode: 1, windspeed: 7, winddirection: 190, is_day: 1 },
    current: {
      temperature_2m: 26,
      apparent_temperature: 27,
      relative_humidity_2m: 62,
      weather_code: 1,
      wind_speed_10m: 7,
      wind_direction_10m: 190,
      pressure_msl: 1012,
      cloud_cover: 35,
      is_day: 1
    },
    daily: {
      time: ['2026-07-08', '2026-07-09'],
      temperature_2m_min: [24, 25],
      temperature_2m_max: [31, 32],
      sunrise: ['2026-07-08T05:20:00', '2026-07-09T05:20:00'],
      sunset: ['2026-07-08T19:25:00', '2026-07-09T19:25:00'],
      weather_code: [1, 2]
    },
    hourly: {
      time: ['2026-07-08T00:00', '2026-07-08T01:00'],
      temperature_2m: [25, 26],
      weather_code: [1, 2],
      precipitation_probability: [10, 20],
      wind_speed_10m: [4, 7]
    }
  };

  const payload = buildWeatherPayload(location, forecastResponse);

  assert.equal(payload.city, 'Ludhiana');
  assert.equal(payload.temperature, 26);
  assert.equal(payload.weather, 'Mainly clear');
  assert.equal(payload.icon.includes('openweathermap.org'), true);
  assert.equal(payload.forecast.length, 2);
  assert.equal(payload.hourlyForecast.length, 2);
});
