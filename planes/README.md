# Planes de trabajo

Cada iniciativa de cierto tamaño (más de un archivo, más de una sesión de trabajo) se documenta en su propia carpeta acá dentro, en vez de archivos sueltos en la raíz del repo.

## Convención

```
planes/
└── AAAA-MM-nombre-corto/
    ├── plan.md          # Qué se va a hacer y por qué (contexto, decisiones, diseño). Se escribe ANTES de implementar.
    ├── todo.md           # Checklist de ejecución, fase por fase. Se marca a medida que se avanza.
    ├── resumen.md        # Opcional: resumen post-implementación para retomar contexto rápido (no siempre hace falta si el plan+todo ya quedan claros).
    └── vista previa/     # Opcional: capturas/mockups de referencia (ej. el diseño pedido antes de implementar).
```

- **Nombre de carpeta**: `AAAA-MM` (año-mes en que arrancó el plan) + slug corto del tema, en minúsculas y con guiones. Ej: `2026-07-tareas-solicitudes`.
- **`plan.md`**: se escribe antes de tocar código (normalmente sale de una sesión en modo plan). Debe explicar el contexto/motivación, las decisiones ya tomadas, y el diseño técnico (BD, backend, frontend). No hace falta que quede "perfecto" — se puede ajustar si el plan cambia durante la implementación, pero el diseño final aprobado debe quedar reflejado ahí.
- **`todo.md`**: checklist accionable derivado del plan, con casillas `[x]`/`[ ]`. Sirve para saber en qué quedó una iniciativa si se retoma días después, y para el checklist de despliegue cuando aplica.
- **`vista previa/`**: si el pedido viene con una captura o mockup de referencia (por ejemplo, cómo debe verse un cambio de UI), se guarda ahí en vez de perderse en el chat.
- Cuando una iniciativa queda completamente implementada y desplegada, sus carpetas **no se borran** — quedan como registro histórico de decisiones (útil para entender por qué el esquema de BD o el código quedaron como quedaron).

## Iniciativas

| Carpeta | Qué hizo | Estado |
|---|---|---|
| [`2026-07-tareas-solicitudes/`](2026-07-tareas-solicitudes/) | Separar Tareas (trabajo directo) de Solicitudes (pedidos de insumos con flujo de aprobación), antes acopladas vía Actividades | Implementado en `dev`, pendiente desplegar a producción |
| [`2026-07-tipo-solicitud/`](2026-07-tipo-solicitud/) | Clasificación normalizada de Solicitudes por tipo de creador (Grupo/Centro/Administración/Externos) | Implementado en `dev`, pendiente desplegar a producción |
| [`2026-07-cambio-vista-solicitudes-aprobadas/`](2026-07-cambio-vista-solicitudes-aprobadas/) | Rediseño de tarjetas en el tablero de Solicitudes Aprobadas: todo inline (bloquear/desbloquear, ítems, terminar/resolver), sin modal | Implementado en `dev`, pendiente desplegar a producción |
| [`2026-07-mensaje-general-resolucion/`](2026-07-mensaje-general-resolucion/) | Mensaje libre general al resolver (parcial o completa), reutilizando `solicitud_log`; nuevo endpoint de historial visible para creador y resolutor | Implementado en `dev`, pendiente desplegar a producción |

Ver `contexto.md` (raíz del repo) para el estado general y actualizado de la arquitectura — los planes acá documentan el *por qué* de cada cambio, `contexto.md` documenta el *estado actual*.
