import * as stuntpark from './stuntpark.js';
import * as city from './city.js';
import * as canyon from './canyon.js';

export const MAPS = [stuntpark, city, canyon];

export function getMap(id) {
  return MAPS.find((m) => m.META.id === id) || MAPS[0];
}
