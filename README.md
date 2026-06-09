# Corona Talent Prototype

Prototipo v1 para consolidar trabajadores, oficios y recomendaciones de asignacion de talento operativo en Corona.

## Que hace este proyecto

Este sistema busca responder una pregunta operativa:

> dado un oficio objetivo, que trabajador encaja mejor segun sus resultados de pruebas y los requisitos del puesto

Hoy el prototipo:

- mantiene un catalogo fijo de puestos del piloto `One Piece`
- carga informacion desde Excel
- detecta nombres de oficios que no coinciden exactamente
- permite homologar esos nombres manualmente
- calcula un ranking de trabajadores por puesto

## Stack actual

- `api/`: Node.js + Express + PostgreSQL + `pg`
- `web/`: React + Vite
- Base de datos local: PostgreSQL en Docker

## Requisitos

- Node.js 22 o superior
- Docker Desktop

## Arranque rapido

1. Levantar PostgreSQL:

```powershell
docker compose up -d
```

2. Configurar variables de entorno:

```powershell
Copy-Item api\\.env.example api\\.env
Copy-Item web\\.env.example web\\.env
```

3. Instalar dependencias.

En PowerShell de Windows puede ser mas estable usar `npm.cmd` si `npm` esta bloqueado por Execution Policy:

```powershell
cd api
npm.cmd install
cd ..\\web
npm.cmd install
```

4. Inicializar esquema y sembrar puestos fijos:

```powershell
cd api
npm.cmd run db:init
```

5. Levantar API y frontend en terminales separadas:

```powershell
cd api
npm.cmd run dev
```

```powershell
cd web
npm.cmd run dev
```

6. Abrir la app:

- Frontend: `http://localhost:5173`
- Health check API: `http://localhost:4000/health`

## Como funciona el sistema hoy

### 1. Los puestos de trabajo son fijos

Los puestos del piloto ya no se cargan desde Excel.

Hoy el catalogo vive en:

- `api/src/db/fixedRoles.js`

Cuando ejecutas:

```powershell
npm.cmd run db:init
```

el sistema:

- crea el esquema si no existe
- inserta los puestos fijos
- actualiza sus nombres, area y linea si cambian

Puestos fijos actuales del piloto:

- `COLAJE - Operador de colaje Mecanizado One Piece`
- `COLAJE - Ayudante de One Piece`
- `TERMINADOS - Pulidor de pieza One Piece`
- `TERMINADOS - Cargador de Tazas`
- `CLASIFICACION FINAL - Clasificador de pieza One Piece`

## Que archivos Excel si se usan

### 1. `Informacion Pruebas de seleccion por oficio B&C.xlsx`

Se usa para cargar:

- pruebas requeridas por oficio
- peso de cada prueba
- rango esperado por prueba
- tipo de prueba: `maestra` o `complementaria`

Esto llena principalmente la tabla:

- `role_requirements`

### 2. `Base de Datos Diagnosticos EDD.xlsx`

Se usa para cargar:

- trabajadores
- evaluaciones
- resultados de pruebas

Esto llena principalmente:

- `workers`
- `worker_assessments`
- `skill_results`

### 3. `PERFIL ANTROPOMETRICO LINEA OP.xlsx`

Se usa para guardar:

- perfil ideal
- criterios de exclusion
- referencia por linea

Esto llena:

- `anthropometric_profiles`

### 4. `Cargo - Oficios de planta SL.xlsx`

Ya no se usa para crear puestos.

Si lo subes, el backend no rompe, pero devuelve un resultado tipo:

- `skipped: true`

porque los puestos ahora son fijos en el sistema.

## Flujo recomendado para probar

1. Los puestos ya vienen fijos
2. Cargar `Informacion Pruebas de seleccion por oficio B&C.xlsx`
3. Cargar `Base de Datos Diagnosticos EDD.xlsx`
4. Cargar `PERFIL ANTROPOMETRICO LINEA OP.xlsx`
5. Ir a `Homologaciones`
6. Resolver nombres pendientes
7. Ir a `Recomendaciones`

## Como funciona la pantalla "Carga de datos"

En la pestana `Carga de datos`:

1. seleccionas un archivo Excel
2. el backend detecta de que tipo es
3. lo importa a PostgreSQL
4. guarda un lote de importacion
5. registra errores o pendientes en `import_issues`

La app te muestra:

- `Ultima importacion`
- `Tipo`
- `Lote`
- resumen de registros cargados
- issues del lote

### Que significa un issue

Un issue normalmente significa una de estas cosas:

- un oficio vino con un nombre distinto al catalogo fijo
- una fila venia incompleta
- una fuente no pudo relacionarse automaticamente

## Como funciona "Homologaciones"

La homologacion existe porque distintos Excel no usan exactamente el mismo nombre de oficio.

Ejemplo:

- Excel de diagnosticos: `OPERADOR COLEJAE MECANIZADO OP`
- Catalogo fijo: `Operador de colaje Mecanizado One Piece`

El sistema no siempre puede asumir que ambos son lo mismo.

Por eso crea una lista de:

- `Fuentes pendientes`

### Que significa cada fila

Cada fila muestra:

- nombre fuente encontrado en Excel
- de que origen viene:
  - `assessments`
  - `requirements`
- cuantas veces aparecio

### Que haces ahi

1. escoges el puesto canonico correcto
2. clic en `Guardar`

### Que pasa cuando guardas

El backend:

- crea una equivalencia en `role_aliases`
- actualiza `role_requirements` para apuntar al rol fijo correcto
- actualiza `worker_assessments` para apuntar al rol fijo correcto
- marca los issues relacionados como resueltos

Una vez homologado:

- desaparece de `Fuentes pendientes`
- aparece en `Homologaciones activas`
- mejora el ranking en `Recomendaciones`

## Como cruza la informacion el sistema

Hoy el sistema no cruza todo por `Numero de registro`.

El cruce real funciona asi:

- trabajador: por `cedula` / `document_number`
- evaluacion: por `worker_id + source_record_number`
- requisitos del oficio: por `nombre de oficio normalizado`
- homologaciones: por `normalized_source_name`

### Resumen practico

- la persona se identifica por cedula
- el oficio se identifica por nombre normalizado u homologado
- el numero de registro ayuda a distinguir evaluaciones, pero no es la llave global del sistema

## Motor de recomendacion actual

### Objetivo

Dado un puesto fijo seleccionado por el usuario, el sistema calcula que tan bien encaja cada trabajador.

### Datos que usa hoy

Para un oficio seleccionado, el motor usa:

- requisitos del puesto desde `role_requirements`
- ultima evaluacion disponible de cada trabajador desde `worker_assessments`
- resultados de pruebas desde `skill_results`

### Pruebas usadas hoy

El motor trabaja con estas 5 pruebas:

- `Minnesota`
- `Purdue`
- `Batak`
- `Sonda Espacial`
- `Dedos Sueltos`

### Pesos actuales

Los pesos salen del Excel de requisitos y hoy suelen verse asi:

- `Minnesota`: `30%`
- `Batak`: `25%`
- `Sonda Espacial`: `20%`
- `Dedos Sueltos`: `15%`
- `Purdue`: `10%`

### Como calcula el score

Para cada prueba:

1. toma el nivel del trabajador
2. toma el rango esperado del oficio
3. si el nivel cae dentro del rango, esa prueba aporta `100%` de su peso
4. si cae por fuera, se penaliza segun la distancia

Despues:

- suma los aportes ponderados
- divide por el peso total
- lo lleva a una escala `0-100`

### Estados actuales

El motor puede devolver:

- `apto`
- `requiere reentrenamiento`
- `no recomendado`
- `pendiente homologacion`

### Reglas de estado

- si el oficio no tiene requisitos homologados, el estado es `pendiente homologacion`
- si una prueba `maestra` queda por debajo del minimo esperado, el estado pasa a `requiere reentrenamiento`
- si no hay fallas criticas y el score es `>= 75`, queda `apto`
- si el score esta entre `45` y `74`, queda `requiere reentrenamiento`
- si queda por debajo, pasa a `no recomendado`

### Como ordena el ranking

Orden actual:

1. `apto`
2. `requiere reentrenamiento`
3. `no recomendado`
4. `pendiente homologacion`

Y dentro de cada estado:

- mayor score primero

### Que muestra cada tarjeta de recomendacion

Cada tarjeta muestra:

- nombre del trabajador
- documento
- rol fuente
- estado final
- score total
- fortalezas
- brechas

### Importante: que significa "Rol fuente"

`Rol fuente` es el oficio con el que ese trabajador venia evaluado en el Excel de diagnosticos.

No significa que solo pueda competir para ese rol.

Hoy el sistema compara a todos los trabajadores cargados contra el puesto objetivo seleccionado.

## Que NO hace todavia el motor

Aun no usa en el score:

- productividad real
- seguridad real
- calidad real
- antropometria como filtro duro
- historial completo de multiples evaluaciones
- experiencia por area como regla obligatoria
- machine learning
- redes neuronales

Hoy el motor es:

- explicable
- basado en reglas
- ponderado por prueba

## Pantallas del frontend

### `Carga de datos`

- subir Excel
- ver lote
- ver issues

### `Trabajadores`

- lista de trabajadores
- detalle de evaluaciones
- area del puesto homologado

### `Oficios`

- catalogo fijo de puestos
- linea
- area
- pruebas requeridas
- peso mostrado en porcentaje

### `Homologaciones`

- pendientes por resolver
- homologaciones activas

### `Recomendaciones`

- seleccion de oficio
- ranking de candidatos
- area y linea del oficio seleccionado

## Endpoints principales

- `POST /api/imports/excel`
- `GET /api/imports/:id/issues`
- `GET /api/workers`
- `GET /api/workers/:id`
- `GET /api/roles`
- `POST /api/role-aliases`
- `GET /api/recommendations?roleId=...`

## Tablas principales

- `roles`
- `role_aliases`
- `workers`
- `worker_assessments`
- `skill_results`
- `role_requirements`
- `anthropometric_profiles`
- `import_batches`
- `import_issues`

## Archivos clave del proyecto

### Backend

- `api/src/db/fixedRoles.js`
  - catalogo fijo de puestos
- `api/src/db/bootstrap.js`
  - crea esquema y siembra puestos
- `api/src/services/importService.js`
  - importacion de Excel
- `api/src/services/roleService.js`
  - homologaciones y consulta de roles
- `api/src/services/workerService.js`
  - consultas de trabajadores
- `api/src/services/recommendationService.js`
  - arma el ranking
- `api/src/utils/recommendation.js`
  - scoring y estados

### Frontend

- `web/src/App.jsx`
  - flujo principal de pantallas
- `web/src/api.js`
  - llamadas al backend

## Comandos utiles

Inicializar esquema y puestos:

```powershell
cd api
npm.cmd run db:init
```

Probar utilidades basicas del backend:

```powershell
cd api
npm.cmd test
```

Compilar frontend:

```powershell
cd web
npm.cmd run build
```

## Limitaciones conocidas

- la libreria `xlsx` tiene una vulnerabilidad reportada por `npm audit` y hoy no trae fix oficial disponible
- no hay autenticacion
- el motor usa reglas y no aprendizaje automatico
- la informacion de antropometria aun es de referencia y no participa como filtro duro en el ranking

## Idea de evolucion

Una siguiente version podria agregar:

- filtros por area
- reglas de seguridad y antropometria
- historial de multiples evaluaciones por trabajador
- explicacion mas detallada del score
- metricas de productividad reales
- ML clasico o modelos predictivos cuando exista mas historial limpio
