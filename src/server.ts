import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

/* =========================
   LOGIN SIMPLE TEMPORAL
   ========================= */

const PIN_DUENO = '2222';
const PIN_GENERAL = '1111'; // <- si querés otro para todos, cambialo acá

function normalizarTexto(valor: string = '') {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function esTuUsuario(empleado: { nombre: string; rol: string }) {
  const nombre = normalizarTexto(empleado.nombre);
  const rol = normalizarTexto(empleado.rol);

  // Acá lo dejamos preparado para que "Gastón" o el rol "dueno" entren con 2222
  return nombre === 'gaston' || rol === 'dueno';
}

function generarPinInterno() {
  return `auto_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

// EMPLEADOS
app.get('/api/empleados', async (_req, res) => {
  const empleados = await prisma.empleado.findMany({
    where: { activo: true },
    orderBy: { id: 'asc' }
  });
  res.json(empleados);
});

app.post('/api/empleados', async (req, res) => {
  try {
    const { nombre, rol } = req.body;

    if (!nombre || !rol) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const e = await prisma.empleado.create({
      data: {
        nombre,
        rol,
        pin: generarPinInterno() // interno, ya no lo gestiona el usuario
      }
    });

    res.json(e);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/empleados/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { nombre, rol } = req.body;

    if (!nombre || !rol) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const e = await prisma.empleado.update({
      where: { id },
      data: { nombre, rol } // ya no toca el pin
    });

    res.json(e);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/empleados/:id', async (req, res) => {
  await prisma.empleado.update({
    where: { id: parseInt(req.params.id) },
    data: { activo: false }
  });
  res.json({ ok: true });
});

app.post('/api/login', async (req, res) => {
  const { empleadoId, pin } = req.body;

  const e = await prisma.empleado.findUnique({
    where: { id: empleadoId }
  });

  if (!e || !e.activo) {
    return res.status(401).json({ error: 'Usuario inactivo o inexistente' });
  }

  const pinEsperado = esTuUsuario(e) ? PIN_DUENO : PIN_GENERAL;

  if (String(pin) !== pinEsperado) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  res.json({
    id: e.id,
    nombre: e.nombre,
    rol: e.rol
  });
});

// PRODUCTOS
app.get('/api/productos', async (_req, res) => {
  const p = await prisma.producto.findMany({
    where: { activo: true },
    orderBy: { nombre: 'asc' }
  });
  res.json(p);
});

// ... dejá el resto del archivo igual ...
