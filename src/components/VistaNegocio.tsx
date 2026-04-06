/* DO NOT TRANSLATE THIS FILE - CHANGUITO EXPRESS */
import React, { useState } from 'react';
import { ArrowLeft, Star, Clock, Plus, Minus, ShoppingBag } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface NegocioResumen {
  id: number;
  nombre: string;
  categoria: string;
  entrega: string;
  rating: number;
  emoji: string;
}

interface Producto {
  id: number;
  nombre: string;
  descripcion: string;
  precio: number;
  emoji: string;
  categoria: string;
  popular?: boolean;
}

interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

// ─── Mock Data de productos por categoría de negocio ─────────────────────────
function getProductosMock(categoriaNegocio: string): Producto[] {
  const MENUS: Record<string, Producto[]> = {
    Taquerías: [
      { id:1,  nombre:'Taco de Suadero',      descripcion:'Tortilla de maíz, suadero, cebolla y cilantro', precio:35,  emoji:'🌮', categoria:'Tacos',       popular:true  },
      { id:2,  nombre:'Taco de Pastor',        descripcion:'Con piña, cebolla, cilantro y salsa roja',      precio:35,  emoji:'🌮', categoria:'Tacos',       popular:true  },
      { id:3,  nombre:'Taco de Canasta',       descripcion:'Frijol, papa o chicharrón, al vapor',           precio:25,  emoji:'🌮', categoria:'Tacos'                     },
      { id:4,  nombre:'Quesadilla de Flor',    descripcion:'Flor de calabaza, quesillo y epazote',          precio:65,  emoji:'🫓', categoria:'Quesadillas'               },
      { id:5,  nombre:'Quesadilla de Huitlacoche', descripcion:'Hongo de maíz, quesillo, epazote',          precio:70,  emoji:'🫓', categoria:'Quesadillas'               },
      { id:6,  nombre:'Orden de Sopes (3)',    descripcion:'Con frijoles, crema, queso y salsa a elegir',   precio:85,  emoji:'🫔', categoria:'Antojitos'                 },
      { id:7,  nombre:'Tlayuda',               descripcion:'Tortilla horneada, frijoles, tasajo y quesillo',precio:120, emoji:'🫓', categoria:'Antojitos',   popular:true  },
      { id:8,  nombre:'Horchata 500ml',        descripcion:'Agua de arroz con canela, bien fría',           precio:30,  emoji:'🥛', categoria:'Bebidas'                   },
      { id:9,  nombre:'Agua de Jamaica',       descripcion:'Natural, sin conservadores, 500ml',             precio:28,  emoji:'🍹', categoria:'Bebidas'                   },
      { id:10, nombre:'Refresco Lata',         descripcion:'Coca-Cola, Sprite o Fanta',                     precio:25,  emoji:'🥤', categoria:'Bebidas'                   },
      { id:11, nombre:'Salsa Verde Extra',     descripcion:'Porción extra de salsa casera',                 precio:10,  emoji:'🫙', categoria:'Extras'                    },
    ],
    Hamburguesas: [
      { id:1,  nombre:'Hamburguesa Sencilla',  descripcion:'Res 180g, lechuga, jitomate, cebolla',          precio:95,  emoji:'🍔', categoria:'Hamburguesas'              },
      { id:2,  nombre:'Hamburguesa Doble',     descripcion:'Doble carne, doble queso, tocino crujiente',    precio:145, emoji:'🍔', categoria:'Hamburguesas', popular:true },
      { id:3,  nombre:'Hamburguesa BBQ',       descripcion:'Carne, queso cheddar, tocino, salsa BBQ',       precio:135, emoji:'🍔', categoria:'Hamburguesas', popular:true },
      { id:4,  nombre:'Veggie Burger',         descripcion:'Medallón de lentejas, aguacate, sprouts',       precio:120, emoji:'🥬', categoria:'Hamburguesas'              },
      { id:5,  nombre:'Papas Fritas',          descripcion:'Corte clásico, crujientes, con sal de mar',     precio:55,  emoji:'🍟', categoria:'Acompañamientos', popular:true },
      { id:6,  nombre:'Papas con Queso',       descripcion:'Papas fritas bañadas en queso cheddar',         precio:75,  emoji:'🍟', categoria:'Acompañamientos'           },
      { id:7,  nombre:'Aros de Cebolla',       descripcion:'Empanizados, crujientes, con aderezo ranch',    precio:65,  emoji:'🧅', categoria:'Acompañamientos'           },
      { id:8,  nombre:'Nuggets x8',            descripcion:'Pollo crocante, con salsa a elegir',            precio:85,  emoji:'🍗', categoria:'Acompañamientos'           },
      { id:9,  nombre:'Malteada Chocolate',    descripcion:'Helado artesanal, leche entera, 400ml',         precio:85,  emoji:'🥤', categoria:'Bebidas'                   },
      { id:10, nombre:'Limonada Mineral',      descripcion:'Fresca, con hierbabuena y hielo',               precio:45,  emoji:'🍋', categoria:'Bebidas'                   },
      { id:11, nombre:'Combo Familiar',        descripcion:'4 hamburguesas + 2 papas grandes + 4 refrescos',precio:420, emoji:'🎉', categoria:'Combos', popular:true      },
    ],
    Pizzerías: [
      { id:1,  nombre:'Pizza Margarita',       descripcion:'Salsa de tomate, mozzarella, albahaca fresca',  precio:140, emoji:'🍕', categoria:'Pizzas',      popular:true  },
      { id:2,  nombre:'Pizza Pepperoni',       descripcion:'Extra pepperoni, queso mozzarella derretido',   precio:165, emoji:'🍕', categoria:'Pizzas',      popular:true  },
      { id:3,  nombre:'Pizza 4 Quesos',        descripcion:'Mozzarella, gouda, parmesano, gorgonzola',      precio:175, emoji:'🍕', categoria:'Pizzas'                    },
      { id:4,  nombre:'Pizza Vegetariana',     descripcion:'Pimientos, champiñones, cebolla, aceitunas',    precio:160, emoji:'🍕', categoria:'Pizzas'                    },
      { id:5,  nombre:'Calzone de Jamón',      descripcion:'Jamón serrano, ricotta, mozzarella',            precio:145, emoji:'🥙', categoria:'Especialidades'            },
      { id:6,  nombre:'Bruschetta (4 pzs)',    descripcion:'Pan tostado, jitomate, ajo, albahaca',          precio:75,  emoji:'🍞', categoria:'Entradas'                  },
      { id:7,  nombre:'Ensalada César',        descripcion:'Lechuga romana, crutones, aderezo casero',      precio:90,  emoji:'🥗', categoria:'Entradas'                  },
      { id:8,  nombre:'Palitos de Ajo',        descripcion:'Con mantequilla de ajo y orégano',              precio:65,  emoji:'🥖', categoria:'Entradas',    popular:true  },
      { id:9,  nombre:'Refresco 600ml',        descripcion:'Coca-Cola, Sprite o del Valle',                 precio:30,  emoji:'🥤', categoria:'Bebidas'                   },
      { id:10, nombre:'Agua Mineral',          descripcion:'Peñafiel 600ml',                                precio:25,  emoji:'💧', categoria:'Bebidas'                   },
      { id:11, nombre:'Tiramisú',              descripcion:'Receta italiana, con café espresso',            precio:85,  emoji:'🍰', categoria:'Postres',     popular:true  },
    ],
    default: [
      { id:1,  nombre:'Especial del Chef',     descripcion:'Platillo estrella de la casa',                  precio:120, emoji:'⭐', categoria:'Especiales',  popular:true  },
      { id:2,  nombre:'Combo Familiar',        descripcion:'Para 4 personas, incluye bebidas',              precio:380, emoji:'🍽️',categoria:'Combos',      popular:true  },
      { id:3,  nombre:'Opción Vegetariana',    descripcion:'Sin carne, lleno de sabor',                     precio:95,  emoji:'🥗', categoria:'Saludable'                 },
      { id:4,  nombre:'Entrada de la Casa',    descripcion:'Para comenzar con buen pie',                    precio:65,  emoji:'🫕', categoria:'Entradas'                  },
      { id:5,  nombre:'Plato Principal',       descripcion:'La estrella del menú',                          precio:135, emoji:'🍲', categoria:'Principales',  popular:true  },
      { id:6,  nombre:'Sopa del Día',          descripcion:'Cambia cada día, siempre deliciosa',            precio:55,  emoji:'🍜', categoria:'Sopas'                     },
      { id:7,  nombre:'Guarnición Extra',      descripcion:'Porción adicional de acompañamiento',           precio:40,  emoji:'🥣', categoria:'Extras'                    },
      { id:8,  nombre:'Postre de la Casa',     descripcion:'Dulce final perfecto',                          precio:70,  emoji:'🍮', categoria:'Postres',      popular:true  },
      { id:9,  nombre:'Agua Natural 1L',       descripcion:'Purificada, bien fría',                         precio:25,  emoji:'💧', categoria:'Bebidas'                   },
      { id:10, nombre:'Refresco',              descripcion:'Lata 355ml',                                    precio:28,  emoji:'🥤', categoria:'Bebidas'                   },
      { id:11, nombre:'Jugo Natural',          descripcion:'Del día, recién exprimido',                     precio:45,  emoji:'🍊', categoria:'Bebidas'                   },
    ],
  };

  return MENUS[categoriaNegocio] ?? MENUS['default'];
}

// ─── Colores de portada por categoría ─────────────────────────────────────────
const PORTADA_GRADIENTS: Record<string, string> = {
  Taquerías:    'linear-gradient(135deg, #7c2d12 0%, #c2410c 100%)',
  Hamburguesas: 'linear-gradient(135deg, #1c1917 0%, #78350f 100%)',
  Pizzerías:    'linear-gradient(135deg, #7f1d1d 0%, #b91c1c 100%)',
  Asiática:     'linear-gradient(135deg, #134e4a 0%, #0f766e 100%)',
  Tortas:       'linear-gradient(135deg, #713f12 0%, #a16207 100%)',
  Desayunos:    'linear-gradient(135deg, #1e3a5f 0%, #1d4ed8 100%)',
  Bebidas:      'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
  Mandaditos:   'linear-gradient(135deg, #14532d 0%, #15803d 100%)',
  default:      'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
};

// ─── Componente Principal ─────────────────────────────────────────────────────
interface VistaNegocioProps {
  negocio: NegocioResumen;
  onVolver: () => void;
}

export default function VistaNegocio(props: VistaNegocioProps) {
  const productos       = getProductosMock(props.negocio.categoria);
  const categorias      = ['Todos', ...Array.from(new Set(productos.map(function(p) { return p.categoria; })))];
  const [filtro, setFiltro]         = useState<string>('Todos');
  const [carrito, setCarrito]       = useState<ItemCarrito[]>([]);
  const [mostrarCarrito, setMostrarCarrito] = useState<boolean>(false);

  const gradiente = PORTADA_GRADIENTS[props.negocio.categoria] ?? PORTADA_GRADIENTS['default'];

  const productosFiltrados = filtro === 'Todos'
    ? productos
    : productos.filter(function(p) { return p.categoria === filtro; });

  const totalCarrito   = carrito.reduce(function(acc, item) { return acc + item.cantidad; }, 0);
  const totalPrecio    = carrito.reduce(function(acc, item) { return acc + item.producto.precio * item.cantidad; }, 0);

  function agregarAlCarrito(producto: Producto) {
    setCarrito(function(prev) {
      const existe = prev.find(function(i) { return i.producto.id === producto.id; });
      if (existe) {
        return prev.map(function(i) {
          return i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i;
        });
      }
      return [...prev, { producto, cantidad: 1 }];
    });
  }

  function quitarDelCarrito(productoId: number) {
    setCarrito(function(prev) {
      return prev
        .map(function(i) { return i.producto.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i; })
        .filter(function(i) { return i.cantidad > 0; });
    });
  }

  function getCantidad(productoId: number): number {
    return carrito.find(function(i) { return i.producto.id === productoId; })?.cantidad ?? 0;
  }

  return (
    <div style={{ minHeight: '100vh', background: '#111116', color: 'white', fontFamily: 'system-ui, sans-serif', maxWidth: '480px', margin: '0 auto', position: 'relative' }}>

      {/* ── Portada ── */}
      <div style={{ position: 'relative', height: '200px', background: gradiente, overflow: 'hidden' }}>
        {/* Emoji central */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px', opacity: 0.35 }}>
          {props.negocio.emoji}
        </div>
        {/* Overlay degradado inferior */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(to bottom, transparent, #111116)' }} />
        {/* Botón volver */}
        <button onClick={props.onVolver}
          style={{ position: 'absolute', top: '16px', left: '16px', width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
          <ArrowLeft style={{ width: '18px', height: '18px', color: 'white' }} />
        </button>
      </div>

      {/* ── Info del negocio ── */}
      <div style={{ padding: '0 16px 16px', marginTop: '-8px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 8px 0', letterSpacing: '-0.03em' }}>
          {props.negocio.nombre}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#facc15', fontWeight: 700 }}>
            <Star style={{ width: '13px', height: '13px' }} fill="#facc15" />
            {props.negocio.rating}
          </span>
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            <Clock style={{ width: '13px', height: '13px' }} />
            {props.negocio.entrega}
          </span>
          <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
          <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
            {props.negocio.categoria}
          </span>
        </div>
      </div>

      {/* ── Filtros de menú ── */}
      <div style={{ overflowX: 'auto', paddingLeft: '16px', paddingBottom: '4px', marginBottom: '16px', scrollbarWidth: 'none' }}>
        <div style={{ display: 'flex', gap: '8px', width: 'max-content' }}>
          {categorias.map(function(cat) {
            const activa = filtro === cat;
            return (
              <button key={cat} onClick={function() { setFiltro(cat); }}
                style={{ padding: '7px 16px', borderRadius: '20px', border: activa ? 'none' : '1px solid rgba(255,255,255,0.1)', background: activa ? '#facc15' : 'rgba(255,255,255,0.05)', color: activa ? '#020617' : 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: activa ? 900 : 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: activa ? '0 4px 12px rgba(250,204,21,0.3)' : 'none' }}>
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lista de productos ── */}
      <div style={{ padding: '0 16px', paddingBottom: totalCarrito > 0 ? '120px' : '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {productosFiltrados.map(function(producto) {
            const cantidad = getCantidad(producto.id);
            return (
              <div key={producto.id} style={{ background: '#1c1c24', borderRadius: '18px', padding: '14px', display: 'flex', alignItems: 'center', gap: '14px', border: '1px solid rgba(255,255,255,0.06)', position: 'relative', overflow: 'hidden' }}>

                {/* Badge popular */}
                {producto.popular && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', fontSize: '9px', fontWeight: 900, padding: '2px 8px', borderRadius: '6px', background: 'rgba(250,204,21,0.15)', color: '#facc15', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Popular
                  </div>
                )}

                {/* Emoji foto */}
                <div style={{ width: '64px', height: '64px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px', flexShrink: 0 }}>
                  {producto.emoji}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: '14px', fontWeight: 800, color: 'white', margin: '0 0 3px 0', paddingRight: producto.popular ? '52px' : '0' }}>
                    {producto.nombre}
                  </h3>
                  <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                    {producto.descripcion}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#facc15' }}>
                      ${producto.precio.toFixed(2)}
                    </span>
                    {/* Controles cantidad */}
                    {cantidad === 0 ? (
                      <button onClick={function() { agregarAlCarrito(producto); }}
                        style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#facc15', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(250,204,21,0.3)' }}>
                        <Plus style={{ width: '16px', height: '16px', color: '#020617' }} strokeWidth={3} />
                      </button>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button onClick={function() { quitarDelCarrito(producto.id); }}
                          style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Minus style={{ width: '13px', height: '13px', color: 'white' }} strokeWidth={3} />
                        </button>
                        <span style={{ fontSize: '15px', fontWeight: 900, color: 'white', minWidth: '16px', textAlign: 'center' }}>{cantidad}</span>
                        <button onClick={function() { agregarAlCarrito(producto); }}
                          style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#facc15', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Plus style={{ width: '13px', height: '13px', color: '#020617' }} strokeWidth={3} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Barra del carrito (flotante) ── */}
      {totalCarrito > 0 && (
        <div style={{ position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: '448px', zIndex: 100 }}>
          <button
            onClick={function() { setMostrarCarrito(true); }}
            style={{ width: '100%', background: '#facc15', borderRadius: '18px', padding: '16px 20px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 8px 32px rgba(250,204,21,0.4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(2,6,23,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingBag style={{ width: '15px', height: '15px', color: '#020617' }} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 900, color: '#020617' }}>
                Ver carrito · {totalCarrito} {totalCarrito === 1 ? 'item' : 'items'}
              </span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 900, color: '#020617' }}>
              ${totalPrecio.toFixed(2)}
            </span>
          </button>
        </div>
      )}

      {/* ── Modal Carrito ── */}
      {mostrarCarrito && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end' }}
             onClick={function() { setMostrarCarrito(false); }}>
          <div style={{ width: '100%', maxWidth: '480px', margin: '0 auto', background: '#1c1c24', borderRadius: '28px 28px 0 0', padding: '24px 20px 40px' }}
               onClick={function(e) { e.stopPropagation(); }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.2)', margin: '0 auto 20px' }} />
            <h2 style={{ fontSize: '18px', fontWeight: 900, margin: '0 0 16px 0' }}>Tu Pedido</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {carrito.map(function(item) {
                return (
                  <div key={item.producto.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '20px' }}>{item.producto.emoji}</span>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: 0 }}>{item.producto.nombre}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', margin: 0 }}>x{item.cantidad} · ${(item.producto.precio * item.cantidad).toFixed(2)}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#facc15' }}>${(item.producto.precio * item.cantidad).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>Total</span>
              <span style={{ fontSize: '18px', fontWeight: 900, color: '#facc15' }}>${totalPrecio.toFixed(2)}</span>
            </div>
            <button style={{ width: '100%', background: '#facc15', color: '#020617', fontWeight: 900, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em', padding: '16px', borderRadius: '16px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 24px rgba(250,204,21,0.3)' }}>
              Confirmar Pedido 🚀
            </button>
          </div>
        </div>
      )}

      <style>{`
        ::-webkit-scrollbar { display: none; }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
        button { font-family: inherit; }
      `}</style>
    </div>
  );
}
