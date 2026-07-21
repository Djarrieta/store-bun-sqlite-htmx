---
description: Sincroniza el repositorio con el remote (git add, commit, push) sin preguntar.
subtask: true
---

# Git Sync

Sincroniza el repositorio con el remote. Ejecuta el flujo de git de forma autónoma y terminante. **NO preguntes nada al usuario**. Si algo no puede resolverse automáticamente, reporta el error y detente.

## Flujo obligatorio

1. **Inspeccionar** — determina:
   - Rama actual: `git branch --show-current`
   - Estado de cambios: `git status --short` y `git diff`
   - Últimos commits: `git log --oneline -5`

2. **Validar rama** — si la rama actual es `main`:
   - Detente inmediatamente.
   - Reporta: "No se permite sync desde main. Cambia a una rama de trabajo (ej. dev) y vuelve a intentar."
   - No ejecutes ningún cambio.

3. **Pull** — ejecuta `git pull origin <rama-actual>`.
   - Si hay conflictos, detente y reporta el error exacto.

4. **Commit de TODOS los cambios**:
   - Si no hay cambios pendientes (ni modificados ni untracked), salta al paso 5.
   - Ejecuta `git add .` para stagear todos los cambios.
   - Decide si uno o varios commits:
     - **Regla por defecto:** un único commit con un mensaje descriptivo que resuma el cambio general.
     - **Excepción:** solo si los cambios son claramente de dominios/features separados (ej. modifica auth Y inventario sin relación), entonces haz commits separados con `git add -p` o especificando archivos.
   - Los mensajes deben ser concisos, en español, en tiempo presente, estilo del repo (`chore:`, `feat:`, `fix:`, `refactor:`, etc.).
   - Ejemplos: `chore: agrega husky con pre-commit hook`, `refactor: mueve inicialización de feature flags a seed`.
   - NUNCA preguntes si commitear. Commitea siempre.

5. **Push** — ejecuta `git push origin <rama-actual>`.
   - Nunca uses `git push --force`.

6. **Reportar** — responde con:
   - Rama sincronizada.
   - Commits creados (hash + mensaje).
   - Archivos afectados.
   - Resultado del push.
   - Si hubo alguna advertencia (archivos grandes, conflictos, etc.).

## Restricciones duras

- NO cambies de rama.
- NO ejecutes `git reset`, `git rebase`, `git push --force` ni merges salvo petición explícita.
- NO preguntes. Si hay ambigüedad, toma la decisión más conservadora (un solo commit descriptivo).
- NO reveles secretos.
- Siempre trabaja contra la rama actual, que debe ser distinta de `main`.
