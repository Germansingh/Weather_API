function escapeHTML(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

export function generateAssistantReply(question, weatherData) {
    const normalized = (question || "").trim().toLowerCase();
    const cityLabel = weatherData?.city ? weatherData.city : "your selected location";

    if (!weatherData) {
        return "I’m ready to help. Search for a city or allow location access so I can give you a personal answer.";
    }

    const temperature = Number(weatherData.temperature ?? 0);
    const humidity = Number(weatherData.humidity ?? 0);
    const windSpeed = Number(weatherData.wind ?? 0);
    const description = weatherData.description || "clear skies";
    const condition = description.toLowerCase();
    const forecast = Array.isArray(weatherData.forecast) ? weatherData.forecast : [];
    const tomorrowForecast = forecast[1] || forecast[0];

    if (/umbrella|rain|drizzle|shower/.test(normalized)) {
        return `Yes — ${cityLabel} looks wet right now, so I’d carry an umbrella and keep outdoor plans flexible. The current weather is ${description.toLowerCase()} with ${temperature}°C, ${humidity}% humidity, and ${windSpeed} m/s wind.`;
    }

    if (/clothes|wear|outfit|dress|jacket|coat|what should i wear/.test(normalized)) {
        const clothing = temperature <= 12 ? "a warm coat, sweater, and scarf" : temperature <= 20 ? "a light jacket and layers" : "light clothes and sunglasses";
        return `For ${cityLabel}, I’d wear ${clothing}. It is ${temperature}°C outside with ${description.toLowerCase()}, so the weather feels ${temperature > 28 ? "hot" : temperature < 12 ? "cold" : "mild"}.`;
    }

    if (/picnic|cycling|cricket|hike|walk|park|go out|outdoor|beach|mountain/.test(normalized)) {
        const goodForActivity = /rain|drizzle|thunder|snow/.test(condition) ? false : true;
        const activityName = /picnic/.test(normalized) ? "a picnic" : /cycling/.test(normalized) ? "cycling" : /cricket/.test(normalized) ? "cricket" : /hike|walk|park/.test(normalized) ? "an outdoor walk" : "outdoor plans";
        return goodForActivity
            ? `Yes — ${cityLabel} looks suitable for ${activityName}. The weather is ${description.toLowerCase()} and the temperature is ${temperature}°C, so it should be comfortable enough.`
            : `I would avoid ${activityName} in ${cityLabel} right now because the conditions look ${description.toLowerCase()} and might be uncomfortable.`;
    }

    if (/travel|trip|visit|road trip|holiday|vacation|tour|safe to travel/.test(normalized)) {
        const travelScore = /rain|drizzle|thunder|snow/.test(condition) ? "moderate" : "good";
        return `Your trip outlook for ${cityLabel} looks ${travelScore}. The current conditions are ${description.toLowerCase()} at ${temperature}°C with ${windSpeed} m/s wind, so I’d keep the plan flexible and pack a light layer.`;
    }

    if (/tomorrow|forecast|will it|next day/.test(normalized) && tomorrowForecast) {
        const nextDayDesc = tomorrowForecast.description || "similar conditions";
        const nextDayHigh = tomorrowForecast.maxTemp ?? temperature;
        return `For tomorrow in ${cityLabel}, the outlook is ${nextDayDesc.toLowerCase()} with a high near ${nextDayHigh}°C. That makes it ${/rain|drizzle|thunder|snow/.test(nextDayDesc.toLowerCase()) ? "less ideal" : "pretty comfortable"} for outdoor plans.`;
    }

    if (/temperature|humidity|wind|weather|how is|what is the weather/.test(normalized)) {
        return `Right now in ${cityLabel}, the weather is ${description.toLowerCase()} with ${temperature}°C temperature, ${humidity}% humidity, and ${windSpeed} m/s wind.`;
    }

    if (/safe|alert|danger|storm/.test(normalized)) {
        return /thunder|storm/.test(condition)
            ? `I’d be cautious in ${cityLabel} right now because thunderstorms are possible. It is safer to stay indoors or avoid exposed outdoor activity.`
            : `The current weather in ${cityLabel} looks generally safe, but I would still keep an eye on changing conditions if you plan to be outside.`;
    }

    return `The weather in ${cityLabel} is currently ${description.toLowerCase()} with ${temperature}°C temperature. I can help with rain, clothing, travel, or activity planning if you ask.`;
}
