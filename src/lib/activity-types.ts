// Activities with MET values from the Compendium of Physical Activities (Herrmann et al., 2024
// adult compendium; values rounded) — approximate by nature. Split out of the main bundle.

export interface ActivityType {
  id: string;
  sv: string;
  en: string;
  /** Metabolic equivalent (1 MET ≈ resting). */
  met: number;
}

export const ACTIVITIES: ActivityType[] = [
  { id: 'walk', sv: 'Promenad, lugn', en: 'Walking, easy', met: 3.0 },
  { id: 'walkBrisk', sv: 'Promenad, rask', en: 'Walking, brisk', met: 4.3 },
  { id: 'hike', sv: 'Vandring', en: 'Hiking', met: 6.0 },
  { id: 'run8', sv: 'Löpning, 8 km/h', en: 'Running, 8 km/h', met: 8.3 },
  { id: 'run10', sv: 'Löpning, 10 km/h', en: 'Running, 10 km/h', met: 9.8 },
  { id: 'run12', sv: 'Löpning, 12 km/h', en: 'Running, 12 km/h', met: 11.5 },
  { id: 'cycleEasy', sv: 'Cykling, lugn (pendling)', en: 'Cycling, easy (commuting)', met: 6.8 },
  { id: 'cycleFast', sv: 'Cykling, snabb', en: 'Cycling, fast', met: 10.0 },
  { id: 'spinning', sv: 'Spinning', en: 'Indoor cycling class', met: 8.5 },
  { id: 'swimEasy', sv: 'Simning, lugn', en: 'Swimming, leisurely', met: 6.0 },
  { id: 'swimCrawl', sv: 'Simning, crawl', en: 'Swimming, front crawl', met: 8.3 },
  { id: 'strength', sv: 'Styrketräning', en: 'Strength training', met: 3.5 },
  { id: 'strengthHard', sv: 'Styrketräning, intensiv', en: 'Strength training, vigorous', met: 6.0 },
  { id: 'aerobics', sv: 'Gruppträning / aerobics', en: 'Group exercise / aerobics', met: 7.3 },
  { id: 'yoga', sv: 'Yoga', en: 'Yoga', met: 2.5 },
  { id: 'pilates', sv: 'Pilates', en: 'Pilates', met: 3.0 },
  { id: 'rowing', sv: 'Roddmaskin', en: 'Rowing machine', met: 7.0 },
  { id: 'football', sv: 'Fotboll', en: 'Football (soccer)', met: 7.0 },
  { id: 'floorball', sv: 'Innebandy', en: 'Floorball', met: 8.0 },
  { id: 'padel', sv: 'Padel', en: 'Padel', met: 6.0 },
  { id: 'tennis', sv: 'Tennis', en: 'Tennis', met: 7.3 },
  { id: 'xcski', sv: 'Längdskidåkning', en: 'Cross-country skiing', met: 9.0 },
  { id: 'downhill', sv: 'Utförsåkning', en: 'Downhill skiing', met: 5.3 },
  { id: 'dance', sv: 'Dans', en: 'Dancing', met: 5.0 },
  { id: 'climbing', sv: 'Klättring', en: 'Climbing', met: 7.5 },
  { id: 'gardening', sv: 'Trädgårdsarbete', en: 'Gardening', met: 3.8 },
  { id: 'cleaning', sv: 'Städning', en: 'House cleaning', met: 3.3 },
];
