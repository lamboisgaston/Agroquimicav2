import express from 'express';
import cors from 'cors';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = express();

const PIN_DUENO = '2222';
const PIN_GENERAL = '1111';

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

function normalizarTexto(valor: string = '') {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function esDueno(empleado: { nombre: string; rol: string }) {
  return (
    normalizarTexto(empleado.nombre) === 'gaston' ||
    normalizarTexto(empleado.rol) === 'dueno'
  );
}

function generarPinInterno() {
  return `auto_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
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
        pin: generarPinInterno()
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

    const actual = await prisma.empleado.findUnique({
      where: { id }
    });

    if (!actual) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    const e = await prisma.empleado.update({
      where: { id },
      data: {
        nombre,
        rol,
        pin: actual.pin
      }
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
    return res.status(401).json({ error: 'Usuario inexistente o inactivo' });
  }

  const pinEsperado = esDueno(e) ? PIN_DUENO : PIN_GENERAL;

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
  try {
    const lista = await prisma.$queryRawUnsafe(
      'SELECT "id","nombre","precio","stock","activo" FROM "Producto" WHERE "activo" = true ORDER BY "nombre" ASC'
    );
    res.json(lista);
  } catch (err: any) {
    res.json([]);
  }
});

app.post('/api/productos', async (req, res) => {
  try {
    const { nombre, precio, stock } = req.body;
    if (!nombre || !precio || Number(precio) <= 0) {
      return res.status(400).json({ error: 'Datos invalidos' });
    }

    await prisma.$executeRawUnsafe(
      'INSERT INTO "Producto" ("nombre","precio","stock","activo","createdAt") VALUES ($1,$2,$3,true,NOW())',
      String(nombre),
      Number(precio),
      parseInt(stock) || 0
    );

    const creado: any = await prisma.$queryRawUnsafe(
      'SELECT "id","nombre","precio","stock","activo" FROM "Producto" WHERE "nombre" = $1 ORDER BY "id" DESC LIMIT 1',
      String(nombre)
    );

    res.json(Array.isArray(creado) ? creado[0] : creado);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/productos/:id', async (req, res) => {
  const { nombre, precio, stock } = req.body;

  const p = await prisma.producto.update({
    where: { id: parseInt(req.params.id) },
    data: {
      nombre,
      precio: parseFloat(precio),
      stock: parseInt(stock)
    }
  });

  res.json(p);
});

app.delete('/api/productos/:id', async (req, res) => {
  await prisma.producto.update({
    where: { id: parseInt(req.params.id) },
    data: { activo: false }
  });
  res.json({ ok: true });
});

// CLIENTES
app.get('/api/clientes', async (req, res) => {
  const { q } = req.query;

  const c = await prisma.cliente.findMany({
    where: q
      ? {
          OR: [
            { nombre: { contains: q as string } },
            { telefono: { contains: q as string } }
          ]
        }
      : {},
    orderBy: { nombre: 'asc' }
  });

  res.json(c);
});

async function obtenerOCrearCliente(nombre: string, telefono: string) {
  if (!telefono) return null;

  const tel = String(telefono).trim();
  const nom = String(nombre || 'Sin nombre').trim();

  let c = await prisma.cliente.findUnique({
    where: { telefono: tel }
  });

  if (!c) {
    c = await prisma.cliente.create({
      data: { nombre: nom, telefono: tel }
    });
  }

  return c;
}

// VENTAS
app.get('/api/ventas', async (req, res) => {
  const { estado } = req.query;

  const v = await prisma.venta.findMany({
    where: estado ? { estado: estado as string } : {},
    include: {
      items: { include: { producto: true } },
      vendedor: true,
      cobrador: true,
      cliente: true
    },
    orderBy: { fecha: 'desc' }
  });

  res.json(v);
});

app.post('/api/ventas', async (req, res) => {
  try {
    const { vendedorId, items, cliente: clienteData } = req.body;

    if (!vendedorId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    let total = 0;
    const itemsConPrecio: any[] = [];

    for (const item of items) {
      const p = await prisma.producto.findUnique({
        where: { id: item.productoId }
      });

      if (!p) {
        return res.status(400).json({ error: 'Producto no existe' });
      }

      if (p.stock < item.cantidad) {
        return res.status(400).json({ error: `Sin stock de ${p.nombre}` });
      }

      total += p.precio * item.cantidad;
      itemsConPrecio.push({
        productoId: p.id,
        cantidad: item.cantidad,
        precio: p.precio
      });
    }

    let clienteId: number | null = null;

    if (clienteData && clienteData.telefono) {
      const c = await obtenerOCrearCliente(
        clienteData.nombre,
        clienteData.telefono
      );
      clienteId = c?.id || null;
    }

    const venta = await prisma.$transaction(async (tx) => {
      const v = await tx.venta.create({
        data: {
          vendedorId,
          total,
          estado: 'pendiente_de_cobro',
          clienteId,
          items: { create: itemsConPrecio }
        },
        include: {
          items: { include: { producto: true } },
          cliente: true
        }
      });

      for (const item of items) {
        await tx.producto.update({
          where: { id: item.productoId },
          data: { stock: { decrement: item.cantidad } }
        });
      }

      return v;
    });

    res.json(venta);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ventas/:id/cobrar', async (req, res) => {
  try {
    const { cobradorId, formaPago } = req.body;

    const v = await prisma.venta.update({
      where: { id: parseInt(req.params.id) },
      data: {
        estado: 'cobrada',
        cobradorId,
        formaPago,
        fechaCobro: new Date()
      }
    });

    res.json(v);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PRESUPUESTOS
app.get('/api/presupuestos', async (_req, res) => {
  const ahora = new Date();

  const p = await prisma.presupuesto.findMany({
    include: {
      items: { include: { producto: true } },
      vendedor: true,
      cliente: true
    },
    orderBy: { fecha: 'desc' }
  });

  const conEstado = p.map((x) => ({
    ...x,
    estado:
      x.estado === 'vigente' && new Date(x.validoHasta) < ahora
        ? 'vencido'
        : x.estado
  }));

  res.json(conEstado);
});

app.post('/api/presupuestos', async (req, res) => {
  try {
    const { vendedorId, items, cliente: clienteData } = req.body;

    if (!vendedorId || !items || items.length === 0) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    if (!clienteData || !clienteData.telefono) {
      return res
        .status(400)
        .json({ error: 'Presupuesto requiere datos del cliente' });
    }

    let total = 0;
    const itemsConPrecio: any[] = [];

    for (const item of items) {
      const p = await prisma.producto.findUnique({
        where: { id: item.productoId }
      });

      if (!p) {
        return res.status(400).json({ error: 'Producto no existe' });
      }

      total += p.precio * item.cantidad;
      itemsConPrecio.push({
        productoId: p.id,
        cantidad: item.cantidad,
        precio: p.precio
      });
    }

    const cliente = await obtenerOCrearCliente(
      clienteData.nombre,
      clienteData.telefono
    );

    if (!cliente) {
      return res.status(400).json({ error: 'Error al crear cliente' });
    }

    const validoHasta = new Date();
    validoHasta.setDate(validoHasta.getDate() + 7);

    const presu = await prisma.presupuesto.create({
      data: {
        vendedorId,
        clienteId: cliente.id,
        total,
        validoHasta,
        items: { create: itemsConPrecio }
      },
      include: {
        items: { include: { producto: true } },
        cliente: true,
        vendedor: true
      }
    });

    res.json(presu);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// CAJA
app.get('/api/caja/hoy', async (_req, res) => {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const cobradas = await prisma.venta.findMany({
    where: {
      estado: 'cobrada',
      fechaCobro: { gte: inicio }
    },
    include: {
      items: { include: { producto: true } },
      cobrador: true,
      cliente: true
    },
    orderBy: { fechaCobro: 'desc' }
  });

  const ingresos = cobradas.reduce((s, v) => s + v.total, 0);

  res.json({
    ingresos,
    egresos: 0,
    ventas: cobradas.length,
    total: ingresos,
    cobradas
  });
});

app.post('/api/caja/cerrar', async (_req, res) => {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);

  const cobradas = await prisma.venta.findMany({
    where: {
      estado: 'cobrada',
      fechaCobro: { gte: inicio }
    }
  });

  const ingresos = cobradas.reduce((s, v) => s + v.total, 0);

  const cierre = await prisma.cierreCaja.create({
    data: {
      ingresos,
      egresos: 0,
      ventas: cobradas.length,
      total: ingresos
    }
  });

  res.json(cierre);
});

// REPORTES
app.get('/api/reportes', async (_req, res) => {
  const cobradas = await prisma.venta.findMany({
    where: { estado: 'cobrada' }
  });

  const total = cobradas.reduce((s, v) => s + v.total, 0);
  const cantidadClientes = await prisma.cliente.count();
  const cantidadPresupuestos = await prisma.presupuesto.count();

  res.json({
    totalFacturado: total,
    cantidadVentas: cobradas.length,
    cantidadClientes,
    cantidadPresupuestos
  });
});

app.get('/', (_req, res) => {
  res.send('Backend funcionando');
});

const port = Number(process.env.PORT) || 4000;

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend iniciado en puerto ${port}`);
});
