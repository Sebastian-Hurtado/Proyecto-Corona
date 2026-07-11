# Cerebro Digital 2.0

Aplicativo web full-stack para apoyar la asignacion estrategica del talento operativo en Corona. El sistema centraliza informacion de trabajadores, oficios y pruebas de habilidad para recomendar candidatos por puesto y sugerir posibles puestos para cada colaborador.

## Resumen

En procesos operativos con multiples oficios, la asignacion de personal suele depender de archivos dispersos, nombres de cargos inconsistentes y criterios dificiles de comparar. **Cerebro Digital 2.0** resuelve ese problema mediante una plataforma que importa datos desde Excel, homologa oficios, calcula compatibilidad trabajador-puesto y muestra resultados visuales para facilitar la toma de decisiones.

El prototipo fue desarrollado como una herramienta funcional para el piloto `One Piece`, con enfoque en trazabilidad, explicabilidad y experiencia de usuario para supervisores o responsables de talento operativo.

## Funcionalidades principales

- **Carga de datos desde Excel** para diagnosticos, requisitos por oficio y perfiles de referencia.
- **Catalogo fijo de oficios** del piloto `One Piece`.
- **Homologacion de cargos** para relacionar nombres inconsistentes del Excel con oficios canonicos.
- **Deshacer homologaciones** para corregir asociaciones sin tocar la base de datos manualmente.
- **Motor de recomendacion explicable** basado en pruebas, pesos y niveles de desempeno.
- **Ranking de candidatos por oficio**, priorizando aptos y marcando brechas de entrenamiento.
- **Recomendacion inversa por trabajador**, para identificar en que otros oficios podria encajar mejor una persona.
- **Graficos radar** que comparan el nivel esperado del oficio contra el nivel obtenido por el colaborador.
- **Buscador de trabajadores** por nombre, cedula, oficio o area.
- **Interfaz corporativa** alineada visualmente con el contexto de Corona.

## Mi aporte

Mi aporte fue desarrollar y mejorar el aplicativo, integrando funciones para cargar datos, homologar cargos, recomendar candidatos por oficio y sugerir posibles puestos para cada colaborador mediante comparaciones visuales y criterios basados en pruebas. Tambien trabaje en la experiencia de usuario, la documentacion tecnica y la presentacion del proyecto como herramienta funcional.

## Stack tecnico

### Frontend

- React
- Vite
- CSS modular en `web/src/styles/app.css`
- Visualizaciones SVG nativas para los graficos radar

### Backend

- Node.js
- Express
- PostgreSQL
- `pg`
- `xlsx` para lectura de archivos Excel

### Infraestructura local

- Docker Compose
- PostgreSQL en contenedor

## Como funciona el motor de recomendacion

El motor compara los resultados de cada trabajador contra los requisitos de un oficio usando una escala comun:

| Nivel | Valor |
| --- | --- |
| Muy bajo | 1 |
| Bajo | 2 |
| Medio | 3 |
| Alto | 4 |
| Muy alto | 5 |

Para cada prueba, el sistema toma:

- nivel obtenido por el trabajador,
- rango esperado por el oficio,
- peso de la prueba,
- tipo de requisito: `maestra` o `complementaria`.

Luego calcula un score de `0` a `100` y clasifica el resultado en:

- `Apto`
- `Requiere entrenamiento`
- `No recomendado`
- `Pendiente homologacion`

El motor no es una caja negra: cada recomendacion muestra fortalezas, brechas y un radar comparativo `Esperado` vs `Obtenido`.

## Pantallas del aplicativo

### Carga de datos

Permite subir archivos Excel y revisar los lotes importados, errores e inconsistencias detectadas.

### Trabajadores

Muestra el listado de trabajadores, permite buscar por nombre o cedula, ver evaluaciones individuales y analizar en que oficios puede encajar mejor cada persona.

### Oficios

Presenta el catalogo fijo de puestos del piloto, con linea, area y requisitos asociados.

### Homologaciones

Permite asociar nombres origen del Excel con oficios canonicos. Tambien permite deshacer una homologacion activa para corregirla.

### Recomendaciones

Permite seleccionar un oficio y ver el ranking de candidatos, con estado, score, fortalezas, brechas y grafico radar.

## Estructura del proyecto

```text
Cerebro-2.0/
├── api/
│   ├── src/
│   │   ├── controllers/
│   │   ├── db/
│   │   ├── routes/
│   │   ├── services/
│   │   └── utils/
│   └── tests/
├── web/
│   └── src/
│       ├── App.jsx
│       ├── api.js
│       └── styles/
└── docker-compose.yml
```

## Instalacion y ejecucion local

### Requisitos

- Node.js 22 o superior
- Docker Desktop

### 1. Levantar PostgreSQL

```powershell
docker compose up -d
```

### 2. Configurar variables de entorno

```powershell
Copy-Item api\.env.example api\.env
Copy-Item web\.env.example web\.env
```

### 3. Instalar dependencias

```powershell
cd api
npm.cmd install

cd ..\web
npm.cmd install
```

### 4. Inicializar base de datos

```powershell
cd ..\api
npm.cmd run db:init
```

### 5. Ejecutar backend y frontend

Terminal 1:

```powershell
cd api
npm.cmd run dev
```

Terminal 2:

```powershell
cd web
npm.cmd run dev
```

Abrir:

```text
http://localhost:5173
```

Health check API:

```text
http://localhost:4000/health
```

## Comandos utiles

Ejecutar pruebas del backend:

```powershell
cd api
npm.cmd test
```

Validar sintaxis del backend:

```powershell
cd api
npm.cmd run check
```

Compilar frontend:

```powershell
cd web
npm.cmd run build
```

Reiniciar base de datos desde cero:

```powershell
docker compose down -v
docker compose up -d
cd api
npm.cmd run db:init
```

## Estado del proyecto

Este repositorio contiene un prototipo academico funcional. El motor actual es explicable y basado en reglas ponderadas. Como siguientes pasos, se podria ampliar el modelo con indicadores reales de productividad, seguridad, calidad, antropometria e historial operativo para avanzar hacia analitica predictiva mas robusta.

## Autor

Desarrollado por **David Sebastian Hurtado Sanchez** como parte del proyecto **Cerebro Digital 2.0** para el Taller de Proyectos Interdisciplinarios.
