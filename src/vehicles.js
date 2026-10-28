// The 49 trophy vehicles from the iPhone app (Trophies.swift), in the same order.
// Each id matches an image at public/vehicles/<id>.png.
export const VEHICLES = [
  ['jeep', 'Off-Roader'], ['train', 'Steam Train'], ['musclecar', 'Muscle Car'],
  ['stagecoach', 'Stagecoach'], ['trex', 'T-Rex'], ['broom', "Witch's Broom"],
  ['tank', 'Tank'], ['rocket', 'Rocket'], ['chariot', 'Chariot'],
  ['speedboat', 'Speedboat'], ['saucer', 'Flying Saucer'], ['viking', 'Viking Ship'],
  ['monstertruck', 'Monster Truck'], ['helicopter', 'Helicopter'], ['biplane', 'Biplane'],
  ['dragon', 'Dragon'], ['motorcycle', 'Motorcycle'], ['rv', 'RV'],
  ['semi', 'Semi Truck'], ['balloonhouse', 'Balloon House'], ['golfcart', 'Golf Cart'],
  ['jet', 'Fighter Jet'], ['bigrig', 'Big Rig'], ['rccar', 'RC Car'],
  ['pumpkin', 'Pumpkin Coach'], ['van', 'Getaway Van'], ['raft', 'Raft'],
  ['bed', 'Flying Bed'], ['spiderbot', 'Spider Bot'], ['galleon', 'Galleon'],
  ['capsule', 'Space Capsule'], ['shark', 'Shark'], ['minicar', 'Mini Car'],
  ['snowmobile', 'Snowmobile'], ['dogsled', 'Dog Sled'], ['rover', 'Moon Rover'],
  ['mixer', 'Cement Mixer'], ['beetle', 'Bug'], ['icecream', 'Ice Cream Truck'],
  ['submarine', 'Submarine'], ['taxi', 'Checker Cab'], ['sedantaxi', 'Taxi'],
  ['whale', 'Whale'], ['horse', 'Wild Horse'], ['carpet', 'Magic Carpet'],
  ['firetruck', 'Fire Truck'], ['bulldozer', 'Bulldozer'], ['schoolbus', 'School Bus'],
  ['convertible', 'Convertible'],
];

export const VEHICLE_IDS = new Set(VEHICLES.map(([id]) => id));
