---
description: Analiza y refina un plan en plan/<nombre>/ buscando gaps, conflictos y contradicciones.
subtask: true
---

# Analyze Plan

Analiza un plan existente en `plan/<nombre>/`, busca **gaps,
conflictos, contradicciones e inconsistencias** con el código real, y
**edita el plan** para corregirlos. Si algo no está claro o requiere
decisión del usuario, hace preguntas antes de escribir.

## Uso

```
/dj-analyze-plan plan-<nombre>
```

Si no recibe argumento, pedir el nombre del plan con `question`.

## Flujo de trabajo

1. **Cargar el plan**
   - Leer `README.md` o `index.md`.
   - Leer todos los archivos `NN-*.md` en orden numérico.
   - Listar los archivos del proyecto mencionados en "Archivos del
     proyecto que se tocan".

2. **Analizar contra el código real**
   - Revisar los archivos del proyecto relevantes con `read`, `grep` y
     `glob`.
   - Si el plan toca auth, SQL, uploads, pagos o chat, releer
     `docs/security.md`.
   - Si toca tablas o migraciones, releer `docs/schema.md`.
   - Si crea un módulo nuevo, releer `docs/modules.md`.

3. **Detectar problemas**

   Buscar al menos estas categorías:

   - **Gaps de tareas:** una decisión cerrada implica un cambio sin
     tarea asignada (ej. cambio de schema sin tarea de schema).
   - **Contradicciones:** una tarea contradice otra, o contradice una
     decisión cerrada del README.
   - **Conflictos con el codebase:** el plan asume archivos,
     funciones o comportamientos que ya no existen o cambiaron.
   - **Archivos inexistentes:** paths mencionados que no están en el
     repo.
   - **Orden incorrecto:** una tarea depende de otra que aparece
     después.
   - **Inconsistencias README ↔ tareas:** la tabla de tareas no
     coincide con los archivos `NN-*.md`; descripciones que no
     reflejan el contenido.
   - **Verificaciones insuficientes:** tareas que tocan código sin
     `bun run typecheck`, sin comandos de verificación o sin
     criterios de aceptación.
   - **Mezcla plan/implementación:** tareas que ejecutan cambios en
     `src/` en lugar de describirlos.
   - **Violaciones a convenciones:** idioma distinto al español en
     UI/copy, SQL sin parametrizar, uso de `any`, escaping omitido,
     decisiones que chocan con `AGENTS.md` o `docs/*.md`.
   - **Decisiones abiertas no resueltas:** preguntas sin respuesta o
     decisiones técnicas pendientes sin marcar como bloqueantes.

4. **Clasificar cada problema**

   - **Corregible automáticamente:** inconsistencias menores,
     errores de numeración, enlaces rotos, verificaciones faltantes
     obvias, descripciones desactualizadas.
   - **Requiere decisión del usuario:** decisiones técnicas
     pendientes, alcance ambiguo, contradicciones entre decisiones
     cerradas, conflictos que cambian el diseño.

5. **Hacer preguntas si es necesario**

   Usar `question` para resolver decisiones pendientes o ambiguas.
   No inventar respuestas. Ejemplos:

   - "El README dice que el precio del producto es opcional, pero la
     tarea 1 no lo refleja en el schema. ¿confirmas que
     `products.price_cents` debe ser nullable?"
   - "El plan menciona `src/modules/foo/foo.routes.ts` pero ese
     archivo no existe. ¿es un módulo nuevo o debería ser
     `src/modules/bar/bar.routes.ts`?"

6. **Editar el plan**

   Con las respuestas del usuario (o directamente para problemas
   menores), modificar los archivos del plan:

   - Actualizar README: tabla de tareas, decisiones cerradas,
     archivos tocados, notas generales.
   - Actualizar archivos de tareas: pasos, verificaciones, enlaces.
   - Agregar tareas faltantes si un gap requiere nuevos pasos.
   - Reordenar tareas si el orden actual es incorrecto (actualizar
     nombres de archivos y enlaces relativos).
   - Eliminar o marcar como obsoletas tareas que ya no aplican.

7. **Releer y validar**
   - Confirmar que la tabla de tareas coincide con los archivos
     `NN-*.md`.
   - Confirmar que los enlaces relativos funcionan.
   - Confirmar que no quedan contradicciones entre README y tareas.

8. **Reportar al usuario**

   - Estado final del plan: `listo para implementar`,
     `requiere ajustes menores` o `tiene problemas bloqueantes`.
   - Problemas encontrados, clasificados por severidad
     (`bloqueante`, `mayor`, `menor`, `pregunta`).
   - Cambios realizados en el plan.
   - Preguntas que quedaron pendientes.
   - Recomendación: ¿pasar a `/dj-implement-plan` o seguir
     refinando?

## Criterios para editar directamente vs. preguntar

- **Editar directamente** cuando el problema sea objetivo y su
  corrección no cambie el alcance ni el diseño:
  - errores de enlaces,
  - numeración inconsistente,
  - faltas de `bun run typecheck` en verificaciones,
  - descripciones de tareas desactualizadas respecto a su contenido,
  - archivos que claramente se renombraron en el repo y el plan
    aún usa el nombre viejo.

- **Preguntar al usuario** cuando haya más de una opción válida o el
  cambio afecte el diseño:
  - decisiones técnicas abiertas,
  - contradicciones entre decisiones cerradas,
  - gaps que podrían resolverse de varias formas,
  - conflictos con convenciones documentadas en `AGENTS.md` o
    `docs/*.md`.

## Restricciones

- **NO** modificar archivos fuera de `plan/<nombre>/`. Este command
  edita el plan, no implementa.
- **NO** ejecutar `bun run seed`, `bun run reset`, `git add`,
  `git commit`, `git push` ni comandos que muten estado del proyecto.
- **NO** implementar correcciones en `src/` o en archivos del
  proyecto.
- **NO** crear archivos nuevos salvo que sean tareas o correcciones
  dentro de `plan/<nombre>/`.
- Si el plan no existe, reportar la ruta buscada y los planes
  disponibles con `ls plan/`.
