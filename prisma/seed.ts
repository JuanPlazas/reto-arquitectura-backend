import {
  User,
  Vehicle,
  VehicleType,
  VehicleUser,
  RoleType,
  Rule,
  ActionType,
  RuleType,
  PrismaClient,
} from '@prisma/client';
const prisma = new PrismaClient();

const createUsers = async () => {
  const cantUsers = parseInt(process.env.CANT_USERS) || 10;
  const users: User[] = [];
  for (let i = 0; i < cantUsers; i++) {
    const user: User = {
      id: i + 1,
      email: `user${i + 1}@ccs.com`,
      name: `user-${i + 1}`,
      lastname: `lastname-${i + 1}`,
      phone: `+57300123456${i}`,
      createdAt: new Date(),
    };
    users.push(user);
  }
  await prisma.user.createMany({
    data: users,
    skipDuplicates: true,
  });

  return users;
};

const createVehicles = async () => {
  const cantVehicles = parseInt(process.env.CANT_VEHICLES) || 10;
  const vehicles: Vehicle[] = [];
  const vehicleTypeValues = Object.values(VehicleType);
  for (let i = 0; i < cantVehicles; i++) {
    const vehicle: Vehicle = {
      id: i + 1,
      plate: i < 10 ? `css-00${i}` : i < 100 ? `css-0${i}` : `css-${i}`,
      type: vehicleTypeValues[i % vehicleTypeValues.length],
      createdAt: new Date(),
    };
    vehicles.push(vehicle);
  }
  await prisma.vehicle.createMany({
    data: vehicles,
    skipDuplicates: true,
  });
  return vehicles;
};

const createVehicleUser = async (users: User[], vehicles: Vehicle[]) => {
  /** We suppose that the first five users are the vehicles' owners */
  const vehicleUsersData: VehicleUser[] = [];
  const owners = users.slice(0, 5);
  const drivers = users.slice(5);
  for (let i = 0; i < vehicles.length; i++) {
    vehicleUsersData.push({
      userId: owners[i % owners.length].id,
      vehicleId: i + 1,
      role: RoleType.OWNER,
    });
    vehicleUsersData.push({
      userId: drivers[i % drivers.length].id,
      vehicleId: i + 1,
      role: RoleType.DRIVER,
    });
  }
  await prisma.vehicleUser.createMany({
    data: vehicleUsersData,
    skipDuplicates: true,
  });
};

const createRules = async (vehicles: Vehicle[]) => {
  /** The Rules are customizable for each vehicle, but for the
   * seed data we defined 3 rules and distributed them at random
   * */
  const rules: Rule[] = [
    {
      id: 1,
      vehicleId: -1,
      type: RuleType.SPEED,
      conditions: { speed: { min: 0, max: 80 } },
      actions: [ActionType.NOTIFY_OWNER, ActionType.NOTIFY_DRIVER],
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 2,
      vehicleId: -1,
      type: RuleType.LOCATION,
      conditions: {
        latitude: { min: -50.999, max: 150.999 },
        longitude: { min: -150.999, max: 50.999 },
      },
      actions: [ActionType.NOTIFY_OWNER, ActionType.NOTIFY_DRIVER, ActionType.NOTIFY_AUTHORITIES],
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 3,
      vehicleId: -1,
      type: RuleType.SCHEDULE,
      conditions: {
        // numbers day about Date js
        1: { min: '08:00', max: '18:00' },
        2: { min: '08:00', max: '18:00' },
        3: { min: '08:00', max: '18:00' },
        4: { min: '08:00', max: '18:00' },
        5: { min: '08:00', max: '12:00' },
      },
      actions: [ActionType.NOTIFY_OWNER],
      isActive: true,
      createdAt: new Date(),
    },
  ];

  const dataWillSave: Rule[] = [];
  for (let i = 0; i < vehicles.length; i++) {
    const qtyRules = Math.floor(Math.random() * 3) + 1;

    for (let j = 0; j < qtyRules; j++) {
      const data = { ...rules[j] };
      data.vehicleId = i + 1;
      delete data.id;
      dataWillSave.push(data);
    }
  }

  await prisma.rule.createMany({
    data: dataWillSave,
    skipDuplicates: true,
  });
};

async function main() {
  // Create Owners
  const users: User[] = await createUsers();

  // Create Vehicles
  const vehicles: Vehicle[] = await createVehicles();

  // Create relation between Users and Vehicles
  await createVehicleUser(users, vehicles);

  // Create Rules
  await createRules(vehicles);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
