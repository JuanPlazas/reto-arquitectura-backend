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
      conditions: { max: 80 },
      actions: [ActionType.NOTIFY_OWNER, ActionType.NOTIFY_DRIVER],
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 2,
      vehicleId: -1,
      type: RuleType.LOCATION,
      conditions: {
        latitude: 50.999,
        longitude: -50.999,
        radius: 100,
      },
      actions: [
        ActionType.NOTIFY_OWNER,
        ActionType.NOTIFY_DRIVER,
        ActionType.NOTIFY_AUTHORITIES,
      ],
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 3,
      vehicleId: -1,
      type: RuleType.SCHEDULE,
      conditions: {
        lunes: { day: 1, hourInit: '08:00', hourEnd: '18:00' },
        martes: { day: 2, hourInit: '08:00', hourEnd: '18:00' },
        miercoles: { day: 3, hourInit: '08:00', hourEnd: '18:00' },
        jueves: { day: 4, hourInit: '08:00', hourEnd: '18:00' },
        viernes: { day: 5, hourInit: '08:00', hourEnd: '12:00' },
      },
      actions: [ActionType.NOTIFY_OWNER],
      isActive: true,
      createdAt: new Date(),
    },
  ];

  const dataWillSave: Rule[] = [];
  for (let i = 0; i < vehicles.length; i++) {
    const qtyRules = Math.floor(Math.random() * 4);

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
  // 1. Create Owners
  const users: User[] = await createUsers();

  // 2. Create Vehicles
  const vehicles: Vehicle[] = await createVehicles();

  // 3. Create relation between Users and Vehicles
  await createVehicleUser(users, vehicles);

  // 4. Create Rules
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
