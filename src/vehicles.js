// The 10 player icons for Movie Night (one per seat), picked from the iPhone app's trophy vehicles.
// Each id matches an image at public/vehicles/<id>.png.
export const VEHICLES = [
  ['trex', 'T-Rex'], ['jeep', 'Off-Roader'], ['broom', "Witch's Broom"], ['saucer', 'Flying Saucer'], ['chariot', 'Chariot'],
  ['jet', 'Fighter Jet'], ['shark', 'Shark'], ['pumpkin', 'Pumpkin Coach'], ['train', 'Steam Train'], ['musclecar', 'Muscle Car'],
];

export const VEHICLE_IDS = new Set(VEHICLES.map(([id]) => id));

// Kingdom Christmas (private party edition, up to 40 players): every picture in public/vehicles, and icons can repeat.
export const ALL_VEHICLE_IDS = new Set([
  'balloonhouse', 'bed', 'beetle', 'bigrig', 'biplane', 'broom', 'bulldozer', 'capsule', 'carpet', 'chariot',
  'convertible', 'dogsled', 'dragon', 'firetruck', 'galleon', 'golfcart', 'helicopter', 'horse', 'icecream', 'jeep',
  'jet', 'minicar', 'mixer', 'monstertruck', 'motorcycle', 'musclecar', 'pumpkin', 'raft', 'rccar', 'rocket',
  'rover', 'rv', 'saucer', 'schoolbus', 'sedantaxi', 'semi', 'shark', 'snowmobile', 'speedboat', 'spiderbot',
  'stagecoach', 'submarine', 'tank', 'taxi', 'train', 'trex', 'van', 'viking', 'whale',
]);
