// The 10 player icons for Movie Night (one per seat), picked from the iPhone app's trophy vehicles.
// Each id matches an image at public/vehicles/<id>.png.
export const VEHICLES = [
  ['trex', 'T-Rex'], ['jeep', 'Off-Roader'], ['broom', "Witch's Broom"], ['saucer', 'Flying Saucer'], ['chariot', 'Chariot'],
  ['jet', 'Fighter Jet'], ['shark', 'Shark'], ['pumpkin', 'Pumpkin Coach'], ['train', 'Steam Train'], ['musclecar', 'Muscle Car'],
];

export const VEHICLE_IDS = new Set(VEHICLES.map(([id]) => id));
