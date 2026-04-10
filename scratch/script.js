const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.action.findMany().then(r => console.log(JSON.stringify(r))).catch(console.error).finally(()=>p.$disconnect());
