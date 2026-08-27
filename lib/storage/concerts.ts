import type { ConcertPrep, ConcertsData } from "../types";
import { maybeBackup, readOrCreate, writeJsonAtomic } from "../storage-core";
import { webSearch } from "../web";

export const defaultConcerts: ConcertsData = {
  events: [
    { id: "1", artist: "Muse", venue: "Accor Arena", date: "2026-07-15", status: "shooted" },
    { id: "2", artist: "Daft Punk", venue: "Stade de France", date: "2026-08-02", status: "shooted" },
    { id: "3", artist: "Phoenix", venue: "Zenith Paris", date: "2026-06-20", status: "selecting" },
    { id: "4", artist: "Justice", venue: "Olympia", date: "2026-05-10", status: "selecting" },
    { id: "5", artist: "Air", venue: "Philharmonie", date: "2026-04-18", status: "editing" },
    { id: "6", artist: "Gojira", venue: "Hellfest", date: "2026-06-29", status: "editing" },
    { id: "7", artist: "Christine & The Queens", venue: "Bercy", date: "2026-03-05", status: "delivered" },
    { id: "8", artist: "L'Imperatrice", venue: "Cigale", date: "2026-02-14", status: "delivered" },
  ],
};

export async function getConcerts(): Promise<ConcertsData> {
  return readOrCreate("concerts.json", defaultConcerts);
}

export async function saveConcerts(data: ConcertsData): Promise<void> {
  await maybeBackup("concerts.json");
  return writeJsonAtomic("concerts.json", data);
}

export async function prepareConcert(concertId: string): Promise<ConcertPrep> {
  const data = await getConcerts();
  const concert = data.events.find((c) => c.id === concertId);
  if (!concert) throw new Error(`Concert ${concertId} introuvable`);

  const weather = await (async () => {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) return "Météo non disponible";
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(concert.venue)}&appid=${apiKey}&units=metric&lang=fr`
      );
      if (!res.ok) return "Météo non disponible";
      const data = await res.json() as { list: { dt_txt: string; main: { temp: number; feels_like: number }; weather: { description: string }[] }[] };
      const concertDate = concert.date.slice(0, 10);
      const dayForecast = data.list.find((f: { dt_txt: string }) => f.dt_txt.startsWith(concertDate));
      if (!dayForecast) return "Météo non disponible pour cette date";
      return `${dayForecast.main.temp}°C (ressenti ${dayForecast.main.feels_like}°C), ${dayForecast.weather[0].description}`;
    } catch {
      return "Météo non disponible";
    }
  })();

  const venueInfo = await webSearch(
    `caractéristiques salle de concert ${concert.venue} capacité fosse photo`
  );

  const checklist = [
    `📷 Boîtier principal (vérifier batterie + carte mémoire)`,
    `📷 Boîtier secondaire (si applicable)`,
    `🔭 Objectif 24-70mm f/2.8 (standard concert)`,
    `🔭 Objectif 70-200mm f/2.8 (zoom)`,
    `🔭 Objectif grand-angle 16-35mm (si fosse)`,
    `⚡ Batteries supplémentaires (×2 minimum)`,
    `💾 Cartes mémoire formatées (×3 minimum)`,
    `🎒 Sac photo adapté (vérifier poids)`,
    `🎟️ Accréditation / Pass imprimé`,
    `🆔 Pièce d'identité`,
    `💧 Bouteille d'eau`,
    `🔦 Lampe torche (si salle sombre)`,
  ];

  return {
    weather,
    venueInfo,
    checklist,
    travelTips: [
      `Arriver 1h30 avant l'ouverture des portes`,
      `Vérifier les restrictions (sac, flash, monopode)`,
      `Repérer la fosse photo et les zones autorisées`,
      `Prévoir des bouchons d'oreilles`,
    ],
  };
}

export async function getWeather(city: string): Promise<string> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) return "Erreur : clé API météo non configurée.";
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric&lang=fr`
    );
    if (!res.ok) {
      if (res.status === 404) return `Ville "${city}" introuvable.`;
      return `Erreur API météo (${res.status}).`;
    }
    const data = await res.json() as {
      main: { temp: number; feels_like: number; humidity: number };
      weather: { description: string }[];
      wind: { speed: number };
      name: string;
    };
    return [
      `**${data.name}** : ${data.main.temp}°C (ressenti ${data.main.feels_like}°C)`,
      `${data.weather[0].description}`,
      `Humidité : ${data.main.humidity}%`,
      `Vent : ${data.wind.speed} m/s`,
    ].join(" — ");
  } catch (err) {
    return `Erreur : ${err instanceof Error ? err.message : String(err)}`;
  }
}
