// The 10 player icons for Movie Night (one per seat), picked from the iPhone app's trophy vehicles.
// Each id matches an image at public/vehicles/<id>.png.
export const VEHICLES = [
  ['trex', 'T-Rex'], ['rocket', 'Rocket'], ['viking', 'Viking Ship'], ['saucer', 'Flying Saucer'], ['dragon', 'Dragon'],
  ['shark', 'Shark'], ['broom', "Witch's Broom"], ['monstertruck', 'Monster Truck'], ['pumpkin', 'Pumpkin Coach'], ['train', 'Steam Train'],
];

export const VEHICLE_IDS = new Set(VEHICLES.map(([id]) => id));
