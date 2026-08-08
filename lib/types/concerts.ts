export interface ConcertEvent {
  id: string;
  artist: string;
  venue: string;
  date: string;
  status: "shooted" | "selecting" | "editing" | "delivered";
}

export interface ConcertsData {
  events: ConcertEvent[];
}

export interface ConcertPrep {
  weather: string;
  venueInfo: string;
  checklist: string[];
  travelTips: string[];
}
