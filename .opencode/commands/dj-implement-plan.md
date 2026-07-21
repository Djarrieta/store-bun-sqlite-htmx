---
description: Implementa paso a paso un plan existente en plan/<nombre>/.
subtask: true
---

# Implement Plan

Implementa un plan previamente creado en `plan/<nombre>/`, ejecutando
sus tareas en orden, verificando cada una y deteniéndose ante errores.

## Uso

```
/implement-plan plan-<nombre>
```

Si no recibe argumento, pedir el nombre del plan con `question`.

## Precondiciones

Antes de empezar, validar:

1. El plan existe en `plan/<nombre>/`.
2. Tiene `README.md` o `index.md` y al menos un archivo `NN-*.md`.
3. (Opcional pero recomendado) Correr primero `/dj-analyze-plan` si no
   se ha hecho recientemente; si hay problemas bloqueantes,
   recomendar corregirlos antes de continuar.

## Flujo de trabajo

1. **Leer el plan**
   - `README.md` / `index.md` para entender alcance y decisiones.
   - Todos los archivos `NN-*.md` en orden numérico.

2. **Inicializar seguimiento**
   - Crear un `todowrite` con una entrada por tarea del plan.
   - Marcar la primera tarea como `in_progress`.

3. **Ejecutar tareas en orden**
   Para cada archivo `NN-<tarea>.md`:

   a. Leer la tarea.
   b. Si hay dependencias de estado (ej. migraciones, seed),
      verificar que se cumplan antes de continuar.
   c. Ejecutar los pasos descritos.
   d. Ejecutar las **verificaciones** de la tarea.
   e. Si la tarea toca código TypeScript, correr `bun run typecheck`
      y no avanzar hasta que pase.
   f. Marcar la tarea como `completed` y la siguiente como
      `in_progress`.

4. **Manejo de errores**
   - Si una verificación falla o `bun run typecheck` reporta errores:
     - Detener el avance.
     - Reportar el error con ubicación exacta.
     - Pedir al usuario indicaciones (corregir, continuar, o
       abortar).
   - No saltarse tareas ni verificaciones sin confirmación.

5. **Reporte final**
   - Tareas completadas vs. totales.
   - Comandos finales recomendados (ej. `bun run reset && bun run
     seed` si el plan lo indica).
   - Recordatorio: `plan/` está en `.gitignore`; los cambios reales
     están en `src/`, `public/`, etc.

## Reglas durante la implementación

- **Idioma:** mantener UI, mensajes de error y comentarios en
  español, salvo que el plan diga lo contrario.
- **TypeScript estricto:** no usar `any`; validar con `bun run
  typecheck` al cierre de cada tarea que toque código.
- **SQL:** solo consultas parametrizadas (`$name`).
- **Escapado:** usar `escapeHtml()` / `escapeAttr()` para datos
  dinámicos en vistas.
- **Seguridad:** si una tarea toca auth, SQL, uploads, pagos o chat,
  re-leer `docs/security.md` antes de ejecutarla.
- **Módulos:** si una tarea crea un módulo nuevo, seguir
  `docs/modules.md` al pie de la letra.
- **Seed:** si una tarea modifica seed, asegurar idempotencia.
- **Migrations:** en producción se usan migraciones versionadas; en
  dev, si el plan asume `reset + seed`, documentarlo y avisar al
  usuario.

## Restricciones

- **NO** ejecutar `git add`, `git commit`, `git push`, `git reset`,
  `git rebase` ni ninguna mutación de git a menos que el usuario lo
  pida explícitamente.
- **NO** ejecutar `bun run reset` o `bun run seed` sin confirmar con
  el usuario, salvo que el plan lo liste explícitamente como paso de
  verificación y el usuario ya haya aprobado el riesgo.
- **NO** saltarse verificaciones.
- **NO** modificar archivos fuera del alcance declarado en el plan.
- Si una tarea no es clara o contradice el código actual, detenerse y
  preguntar; **nunca** improvisar.
