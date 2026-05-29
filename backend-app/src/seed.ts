import * as bcrypt from 'bcrypt';

import { PrismaClient, Role, User } from '@prisma/client';

const prisma = new PrismaClient();

// ======================================================
// PRODUCT LIST
// ======================================================

const productNames = [
  'Coca Cola',
  'Sprite',
  'Fanta',
  'Oreo',
  'Chitato',
  'Ultra Milk',
  'Indomie',
  'SilverQueen',
  'Teh Botol',
  'Pocari Sweat',
  'Nutella',
  'Yupi',
  'Good Day',
  'Milo',
  'Lays',
  'Aqua',
  'You C1000',
  'Nabati',
  'Taro',
  'Sari Roti',
  'Beng Beng',
  'Roma Kelapa',
  'Cimory Yogurt',
  'Floridina',
  'Le Minerale',
  'ABC Juice',
  'Kopiko',
  'Nextar',
  'Momogi',
  'Qtela',
];

// ======================================================
// USER DUMMY
// ======================================================

const dummyUsers = [
  {
    name: 'Premium User',
    email: 'premium@example.com',
    password: 'password123',
    role: Role.PREMIUM,
    age: 21,
    height: 172,
    weight: 61,
    gender: 'male',
  },

  {
    name: 'Normal User',
    email: 'normal@example.com',
    password: 'password123',
    role: Role.USER,
    age: 19,
    height: 168,
    weight: 55,
    gender: 'female',
  },

  {
    name: 'Heavy Sugar User',
    email: 'sugar@example.com',
    password: 'password123',
    role: Role.PREMIUM,
    age: 28,
    height: 174,
    weight: 82,
    gender: 'male',
  },

  {
    name: 'Healthy User',
    email: 'healthy@example.com',
    password: 'password123',
    role: Role.USER,
    age: 24,
    height: 166,
    weight: 50,
    gender: 'female',
  },
];

// ======================================================
// RANDOM FUNCTIONS
// ======================================================

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function getRandomProduct() {
  return productNames[Math.floor(Math.random() * productNames.length)];
}

function getSugarStatus(sugar: number) {
  if (sugar <= 5) {
    return {
      status: 'Low Sugar',
      grade: 'A',
    };
  }

  if (sugar <= 15) {
    return {
      status: 'Medium Sugar',
      grade: 'B',
    };
  }

  if (sugar <= 25) {
    return {
      status: 'High Sugar',
      grade: 'C',
    };
  }

  return {
    status: 'Very High Sugar',
    grade: 'D',
  };
}

function getConsumptionPeriod(hour: number) {
  if (hour >= 5 && hour < 11) {
    return 'MORNING';
  }

  if (hour >= 11 && hour < 15) {
    return 'AFTERNOON';
  }

  if (hour >= 15 && hour < 19) {
    return 'EVENING';
  }

  return 'NIGHT';
}

// ======================================================
// CREATE USER
// ======================================================

async function createUsers(): Promise<User[]> {
  const users: User[] = [];

  for (const item of dummyUsers) {
    const hashedPassword = await bcrypt.hash(item.password, 10);

    const user = await prisma.user.upsert({
      where: {
        email: item.email,
      },

      update: {},

      create: {
        name: item.name,
        email: item.email,
        password: hashedPassword,

        role: item.role,

        age: item.age,
        height: item.height,
        weight: item.weight,
        gender: item.gender,

        isVerified: true,
      },
    });

    users.push(user);

    // ======================================================
    // PREMIUM SUBSCRIPTION
    // ======================================================

    if (item.role === 'PREMIUM') {
      await prisma.subscription.upsert({
        where: {
          userId: user.id,
        },

        update: {
          status: 'ACTIVE',

          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },

        create: {
          userId: user.id,

          status: 'ACTIVE',

          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  return users;
}

// ======================================================
// GENERATE SCAN
// ======================================================

async function generateScans(userId: string) {
  // DELETE OLD DATA

  await prisma.nutritionScan.deleteMany({
    where: {
      userId,
    },
  });

  // START DATE

  const startDate = new Date('2025-01-01');

  // 365 DAYS

  for (let i = 0; i < 365; i++) {
    const currentDate = new Date(startDate);

    currentDate.setDate(startDate.getDate() + i);

    // RANDOM SCAN 2-10

    const scansPerDay = random(2, 10);

    for (let j = 0; j < scansPerDay; j++) {
      // RANDOM HOUR

      const hour = random(0, 23);

      currentDate.setHours(hour);

      // RANDOM MINUTE

      currentDate.setMinutes(random(0, 59));

      // RANDOM SUGAR

      let sugar = random(0, 50);

      // SPECIAL CASES

      // VERY LOW
      if (Math.random() < 0.05) {
        sugar = 0;
      }

      // VERY HIGH
      if (Math.random() < 0.05) {
        sugar = 50;
      }

      const { status, grade } = getSugarStatus(sugar);

      // PERIOD

      const period = getConsumptionPeriod(hour);

      // KEYS

      const dayKey = currentDate.toISOString().split('T')[0];

      const monthKey = `${currentDate.getFullYear()}-${String(
        currentDate.getMonth() + 1,
      ).padStart(2, '0')}`;

      const yearKey = `${currentDate.getFullYear()}`;

      const weekKey = `${currentDate.getFullYear()}-W${Math.ceil(
        currentDate.getDate() / 7,
      )}`;

      // RANDOM INPUT SOURCE

      const isManual = Math.random() > 0.5;

      // RANDOM IMAGE

      const imageUrl = !isManual
        ? `https://picsum.photos/300?random=${i}${j}`
        : null;

      // AI SUMMARY

      const aiSummary =
        sugar <= 5
          ? 'Good low sugar product.'
          : sugar <= 15
            ? 'Moderate sugar detected.'
            : sugar <= 25
              ? 'High sugar detected.'
              : 'Very dangerous sugar intake.';

      // CREATE

      await prisma.nutritionScan.create({
        data: {
          userId,

          productName: getRandomProduct(),

          sugar,

          sugarStatus: status,

          sugarGrade: grade,

          aiSummary,

          imageUrl,

          consumedAt: currentDate,

          scannedAt: currentDate,

          createdAt: currentDate,

          dayKey,

          weekKey,

          monthKey,

          yearKey,

          consumptionPeriod: period,
        },
      });

      console.log(`created ${dayKey} user:${userId}`);
    }
  }

  // ======================================================
  // TODAY DATA
  // ======================================================

  for (let i = 0; i < 8; i++) {
    const now = new Date();

    now.setHours(random(0, 23));

    const sugar = random(1, 40);

    const { status, grade } = getSugarStatus(sugar);

    await prisma.nutritionScan.create({
      data: {
        userId,

        productName: getRandomProduct(),

        sugar,

        sugarStatus: status,

        sugarGrade: grade,

        aiSummary: 'Today generated nutrition data.',

        consumedAt: now,

        scannedAt: now,

        createdAt: now,

        dayKey: now.toISOString().split('T')[0],

        weekKey: `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`,

        monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
          2,
          '0',
        )}`,

        yearKey: `${now.getFullYear()}`,

        consumptionPeriod: getConsumptionPeriod(now.getHours()),
      },
    });
  }
}

// ======================================================
// MAIN
// ======================================================

async function main() {
  console.log('=====================================');

  console.log('START SEEDING...');

  console.log('=====================================');

  // USERS

  const users = await createUsers();

  // GENERATE DATA

  for (const user of users) {
    await generateScans(user.id);
  }

  console.log('=====================================');

  console.log('SEED SUCCESS');

  console.log('=====================================');
}

main()
  .catch((e) => {
    console.error(e);
  })

  .finally(async () => {
    await prisma.$disconnect();
  });
