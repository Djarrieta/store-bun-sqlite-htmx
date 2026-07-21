---
description: Crea un plan en plan/<nombre>/ con README y tareas separadas. No implementa nada.
subtask: true
---

# Create Plan

Crea un plan detallado en `plan/<nombre>/` para una tarea que el
usuario quiera abordar. **Este comando NO implementa nada.**
**NO escribe código, NO modifica archivos del proyecto, NO corre
comandos de seed/reset.** Su único producto es la documentación del
plan en `plan/`.

## Estructura obligatoria

Todo plan se crea bajo `plan/` siguiendo este layout (igual que
`plan/plan-product-card/` ya existente):

```
plan/
└── <nombre-del-plan>/      # kebab-case, ej. "plan-seed-images"
    ├── README.md           # índice + decisiones cerradas + alcance
    ├── 01-<tarea>.md       # una tarea por archivo, numerada con 2 dígitos
    ├── 02-<tarea>.md
    ├── ...
    └── NN-<tarea>.md       # última tarea
```

Reglas:

- **Siempre** debe existir `README.md` en la carpeta del plan. Es el
  índice y la primera cara del plan. Sin él, el plan está incompleto.
- **Una tarea por archivo**, numerada con dos dígitos (`01-`,
  `02-`, ...). Cada tarea tiene un objetivo puntual y se implementa
  en un commit lógico (o varios) cuando se ejecute el plan.
- Cada archivo de tarea debe tener **secciones de verificación**
  explícitas. Una tarea sin verificación no es ejecutable.
- El README debe listar las tareas en una tabla con enlaces
  relativos y referenciar los archivos del proyecto que se tocan.
- Todo en español (convención del proyecto).

## Plantilla de `README.md`

```markdown
# Plan: <Título descriptivo>

<Resumen de 2-3 oraciones del problema y la solución propuesta.>

> **No implementar todavía.** Este es solo el plan. Ejecutar las
> tareas en orden.

## Contexto

<Por qué hace falta este plan, qué problema resuelve, qué archivos
están involucrados hoy.>

## Decisiones cerradas

<Bullets numerados con las decisiones técnicas que ya están
confirmadas. Si algo está abierto, listarlo en "Preguntas abiertas"
o preguntar al usuario antes de escribir el plan.>

## Tareas

| Orden | Archivo | Tarea |
|-------|---------|-------|
| 1 | [01-...md](01-...md) | <descripción corta> |
| 2 | [02-...md](02-...md) | <descripción corta> |
| ... | ... | ... |

## Archivos del proyecto que se tocan

- `path/al/archivo.ts` — <qué se le hace>.
- `path/otro.ts` — <qué se le hace>.

## Archivos que **no** se tocan

- <Archivos adyacentes que podrían parecer afectados pero no lo
  son. Reduce re-trabajo de revisión.>

## Notas generales

- <Convenciones del proyecto a respetar (idioma, escaping, typecheck,
  etc.)>.
```

## Plantilla de archivo de tarea (`NN-<nombre>.md`)

```markdown
# Tarea N — <Título de la tarea>

## Objetivo

<Una o dos oraciones.Qué cambia al cerrar esta tarea.>

## Pasos

<Lista numerada y concreta. Cada paso debe ser accionable. Si hay
fragmentos de código, incluirlos completos y con contexto.>

## Verificación de la tarea

<Sección obligatoria. Pasos exactos para confirmar que la tarea
está bien hecha. Incluir:

- comandos a correr (ej. `bun run typecheck`, `ls`, `curl`),
- resultado esperado de cada uno,
- criterios de aceptación visuales si aplica.>

## Siguiente tarea

→ [NN+1-<nombre>.md](NN+1-<nombre>.md)
```

La sección de **Verificación** no es opcional. Una tarea sin
verificación clara no se considera completa y el plan no se puede
cerrar.

## Flujo de trabajo

1. **Recibir el pedido.** Si el pedido ya es claro (objetivo +
   alcance), proceder. Si no, usar la herramienta `question` para
   aclarar:
   - Nombre del plan (kebab-case, ej. `plan-seed-images`).
   - Alcance: ¿qué entra y qué no?
   - Decisiones técnicas que el usuario ya tenga tomadas.

2. **Inspeccionar el proyecto** para anclar el plan al código real:
   - `ls` y `grep` en los archivos que probablemente se tocan.
   - Confirmar que las decisiones cerradas son consistentes con la
     arquitectura existente.
   - Si el plan choca con una convención documentada en
     `AGENTS.md` o `docs/*.md`, mencionarlo al usuario antes de
     escribir.

3. **Crear la carpeta** con `mkdir -p plan/<nombre>`.

4. **Escribir el README** primero. Fija el alcance, las decisiones
   y la lista de tareas. El resto de archivos cuelgan de él.

5. **Escribir las tareas en orden**. Cada una referencia a la
   siguiente con un enlace relativo. La última tarea no necesita el
   enlace "Siguiente tarea".

6. **Releer** el README para confirmar que la tabla de tareas
   coincide con los archivos creados y que los enlaces relativos
   funcionan.

7. **Reportar al usuario**:
   - Ruta de la carpeta creada.
   - Lista de archivos escritos.
   - Cualquier pregunta abierta o decisión que necesite validación
     antes de ejecutar el plan.

## Convenciones del proyecto a respetar en el plan

- **Idioma:** español en todo el plan. Nombres de archivos en
  kebab-case.
- **Typecheck:** mencionar `bun run typecheck` como verificación al
  cierre de cada tarea que toque código.
- **Seguridad:** si la tarea toca auth, SQL, uploads, pagos o chat,
  referenciar `docs/security.md` en la sección de notas y listar los
  chequeos de seguridad aplicables en la verificación.
- **Idempotencia:** si la tarea modifica el seed o las migraciones,
  documentar cómo se comporta al re-ejecutar.
- **Sin emojis** salvo que el usuario lo pida explícitamente.
- **Sin comentarios innecesarios** en fragmentos de código (el
  código se copia de los planes a los archivos reales; los
  comentarios deben ser solo los que valen la pena en el código
  final).
- **No usar `any`.** TypeScript estricto, igual que el resto del
  proyecto.
- **`plan/` está en `.gitignore`** (ver `.gitignore` línea 19).
  Los planes son documentos de trabajo, no se commitean.

## Restricciones

- **NO** crear ni modificar archivos fuera de `plan/<nombre>/`. El
  plan es documentación, no código.
- **NO** correr `bun run seed`, `bun run reset`, `git add`,
  `git commit`, `git push`, ni ningún comando que mute estado.
- **NO** usar la herramienta `task` para delegar la escritura del
  plan. Es trabajo directo del agente principal, con la estructura
  definida aquí.
- Si el plan necesita una decisión técnica abierta (ej. "¿usar
  subcarpeta `seed/` o aplanar?"), preguntar al usuario con
  `question` antes de cerrar el plan. **Nunca** inventar decisiones.
- Si el alcance es grande (>8 tareas), proponer dividirlo en
  planes separados y preguntar al usuario antes de empezar a
  escribir.
