import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.empleado.createMany({
    data: [
      { nombre: 'Juan', rol: 'mostrador', pin: '1111' },
      { nombre: 'María', rol: 'caja', pin: '2222' },
      { nombre: 'Papá', rol: 'gerente', pin: '3333' },
      { nombre: 'Gastón', rol: 'dueno', pin: '4444' },
    ],
  });
  await prisma.producto.createMany({
    data: [
      { nombre: 'Glifosato 1L', precio: 8500, stock: 25 },
      { nombre: 'Insecticida General 500ml', precio: 4200, stock: 12 },
      { nombre: 'Fungicida Cobre 1kg', precio: 6300, stock: 8 },
      { nombre: 'Fertilizante NPK 5kg', precio: 12500, stock: 30 },
      { nombre: 'Herbicida Selectivo 1L', precio: 9800, stock: 15 },
    ],
  });
  console.log('✅ Seed completado');
}
main().catch(console.error).finally(() => prisma.$disconnect());
