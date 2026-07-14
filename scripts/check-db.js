/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const products = await p.product.findMany({select:{id:true,name:true,imageUrl:true},take:10});
  console.log('=== PRODUCTS ===');
  products.forEach(r => console.log(r.name, '|', r.imageUrl));
  const groups = await p.productGroup.findMany({select:{id:true,name:true,imageUrl:true}});
  console.log('\n=== GROUPS ===');
  groups.forEach(r => console.log(r.name, '|', r.imageUrl));
}
main().finally(() => p.$disconnect());
