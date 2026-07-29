const { SignalType } = require('@prisma/client');

module.exports = {
  generatePayload,
};

function generatePayload(context, events, done) {
  const maxVehicles = parseInt(process.env.CANT_VEHICLES || '10', 10);

  /** Values are according Rules in prisma/seed.ts */
  context.vars.payload = {
    vehicleId: randomInt(1, maxVehicles),
    latitude: randomFloat(-51, 151),
    longitude: randomFloat(-151, -51),
    speed: randomInt(0, 90),
    direction: randomInt(1, 4),
    receivedAt: randomDateAroundToday(30),
    type: randomChoice(Object.values(SignalType)),
  };

  return done();
}

// Helpers
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(list) {
  return list[randomInt(0, list.length - 1)];
}

function randomDateAroundToday(days) {
  const now = new Date();
  const offset = randomInt(-days, days);
  now.setDate(now.getDate() + offset);
  return now;
}
