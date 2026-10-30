# Arquitectura · Orbita

## 1. Vista general (despliegue con Docker Compose)

```mermaid
flowchart LR
  user([Usuario]) --> browser

  subgraph browser[Navegador]
    spa["React SPA<br/>cookie orbita_session"]
  end

  subgraph compose[Docker Compose]
    subgraph fe["frontend · nginx :8080"]
      static["/ → archivos estáticos<br/>(build de Vite)"]
      proxy["/api/* → backend:3000"]
    end

    subgraph be["backend · NestJS :3000"]
      api[API REST]
      docs["/docs · Swagger"]
    end

    vol[("volumen orbita-data<br/>orbita.sqlite")]
  end

  gateway([Pasarela de pagos])

  spa -- "HTTP · Authorization: Bearer" --> proxy
  browser -. carga la SPA .-> static
  proxy --> api
  gateway -- "POST /webhooks/payment-gateway<br/>X-Signature (HMAC-SHA256)" --> api
  api --> vol
```

- El front y la API comparten origen a través de nginx: no hace falta CORS y la URL de la API no queda embebida en el build. En desarrollo hace lo mismo el proxy de Vite.
- La pasarela llama a la API directamente. No usa token: se autentica con la firma HMAC.

## 2. Módulos del backend

```mermaid
flowchart TB
  subgraph http[Capa HTTP]
    pipe["ValidationPipe<br/>VALIDATION_ERROR"]
    filter["HttpExceptionFilter<br/>formato de error único"]
    pino["nestjs-pino<br/>logs JSON + X-Request-Id"]
  end

  subgraph auth[auth]
    authCtrl["AuthController<br/>POST /auth/login"]
    authSvc[AuthService]
    attempts["LoginAttemptsService<br/>3 intentos → 429"]
    guard["JwtAuthGuard<br/>Bearer → req.user"]
  end

  subgraph balances[balances]
    balCtrl["BalancesController<br/>/balances/me/*"]
    balSvc["BalancesService<br/>idempotencia"]
    ledger["LedgerService<br/>único que modifica saldos"]
  end

  subgraph webhooks[webhooks]
    sigGuard["WebhookSignatureGuard<br/>HMAC sobre raw body"]
    whCtrl["WebhooksController<br/>POST /webhooks/payment-gateway"]
    whSvc["WebhooksService<br/>dedupe por event_id"]
  end

  subgraph database[database]
    dbSvc["DatabaseService<br/>migraciones + seed<br/>transaction() BEGIN IMMEDIATE"]
    sqlite[(SQLite)]
  end

  authCtrl --> authSvc --> attempts
  authSvc --> dbSvc
  guard -.protege.-> balCtrl
  balCtrl --> balSvc --> ledger
  sigGuard -.protege.-> whCtrl
  whCtrl --> whSvc --> ledger
  ledger --> dbSvc
  balSvc --> dbSvc
  whSvc --> dbSvc
  dbSvc --> sqlite
```

**Regla clave:** todo cambio de saldo pasa por `LedgerService.applyMovement`, siempre dentro de una transacción de `DatabaseService`. Así, el saldo, el movimiento del ledger y el registro de idempotencia o del evento se escriben juntos, o no se escribe nada.

## 3. Flujo: depósito o retiro idempotente

```mermaid
sequenceDiagram
  autonumber
  participant UI as React (OperationForm)
  participant API as BalancesController
  participant S as BalancesService
  participant L as LedgerService
  participant DB as SQLite

  UI->>UI: valida el monto y genera Idempotency-Key (UUID)
  UI->>API: POST /balances/me/withdrawals<br/>Authorization + Idempotency-Key
  API->>API: JwtAuthGuard → userId del token
  API->>S: operate(userId, WITHDRAWAL, body, key)
  S->>DB: BEGIN IMMEDIATE
  S->>DB: SELECT idempotency_keys (userId, key)
  alt la llave ya existe y el hash coincide
    DB-->>S: respuesta guardada
    S-->>API: misma respuesta (Idempotent-Replayed: true)
  else la llave existe con otro body
    S-->>API: 409 IDEMPOTENCY_KEY_REUSED
  else llave nueva
    S->>L: applyMovement()
    alt saldo suficiente
      L->>DB: UPDATE balances, INSERT transactions
      S->>DB: INSERT idempotency_keys (201 + body)
    else saldo insuficiente
      S->>DB: INSERT idempotency_keys (422 + error)
    end
  end
  S->>DB: COMMIT
  API-->>UI: 201 / 409 / 422
  Note over UI: si falla la red, el reintento<br/>reutiliza la misma llave
```

## 4. Flujo: webhook de la pasarela

```mermaid
sequenceDiagram
  autonumber
  participant PG as Pasarela
  participant G as WebhookSignatureGuard
  participant W as WebhooksService
  participant L as LedgerService
  participant DB as SQLite

  PG->>G: POST /webhooks/payment-gateway + X-Signature
  G->>G: HMAC-SHA256(raw body, WEBHOOK_SECRET)<br/>timingSafeEqual
  alt firma inválida
    G-->>PG: 401 INVALID_SIGNATURE
  else firma válida
    G->>W: evento validado
    W->>DB: BEGIN IMMEDIATE
    alt event_id ya registrado
      W->>DB: deliveries + 1
      W-->>PG: 200 duplicate: true (no acredita)
    else evento nuevo
      alt status = approved y el usuario existe
        W->>L: applyMovement(GATEWAY_CREDIT)
        W->>DB: INSERT webhook_events (CREDITED)
      else rejected
        W->>DB: INSERT webhook_events (REJECTED)
      else el usuario no existe
        W->>DB: INSERT webhook_events (USER_NOT_FOUND)
      end
      W-->>PG: 200 duplicate: false
    end
    W->>DB: COMMIT
  end
```

## 5. Flujo: sesión en el frontend

```mermaid
sequenceDiagram
  autonumber
  participant U as Usuario
  participant App as React (AuthProvider)
  participant C as api/client.ts
  participant API as API

  U->>App: email + contraseña
  App->>API: POST /auth/login
  alt credenciales válidas
    API-->>App: { accessToken, expiresAt, user }
    App->>App: guarda la cookie orbita_session
  else credenciales inválidas (1.º o 2.º fallo)
    API-->>App: 401 + remainingAttempts
  else 3.er fallo o email bloqueado
    API-->>App: 429 + retryAfterSeconds
  end

  loop cada petición
    C->>C: lee la cookie
    C->>API: Authorization: Bearer <token>
    alt 401 (token vencido o inválido)
      API-->>C: 401 TOKEN_EXPIRED / INVALID_TOKEN
      C->>App: onUnauthorized → borra la cookie
      App-->>U: vuelve al login con el motivo
    end
  end
```

## 6. Modelo de datos

```mermaid
erDiagram
  users ||--o| balances : tiene
  users ||--o{ transactions : registra
  users ||--o{ idempotency_keys : usa
  transactions |o--o| idempotency_keys : "creado por"
  transactions |o--o| webhook_events : "creado por"

  users {
    text id PK "u_123"
    text email UK
    text password_hash "bcrypt"
    text created_at
  }
  balances {
    text user_id PK,FK
    integer amount_cents "CHECK >= 0"
    text currency "CHECK = USD"
    text updated_at
  }
  transactions {
    integer id PK "autoincremental, orden"
    text user_id FK
    text type "DEPOSIT | WITHDRAWAL | GATEWAY_CREDIT"
    integer amount_cents "CHECK 1..1000000"
    integer balance_after_cents "CHECK >= 0"
    text idempotency_key "origen"
    text webhook_event_id UK "origen"
    text created_at
  }
  idempotency_keys {
    text user_id PK,FK
    text key PK
    text operation
    text request_hash "sha256"
    integer response_status
    text response_body "JSON"
    integer transaction_id FK
  }
  webhook_events {
    text event_id PK
    text user_id "sin FK: auditoría"
    integer amount_cents
    text status "approved | rejected"
    text outcome "CREDITED | REJECTED | USER_NOT_FOUND"
    text raw_payload
    integer deliveries
    integer transaction_id FK
  }
```

## 7. Garantías y dónde se aplican

| Garantía | Mecanismo |
|---|---|
| El saldo nunca queda negativo | Validación en `LedgerService` + `CHECK` en `balances` y `transactions` + transacción `BEGIN IMMEDIATE` |
| Un depósito o retiro no se repite | `idempotency_keys` con PK `(user_id, key)`, en la misma transacción que el movimiento |
| Un evento de la pasarela no se acredita dos veces | `webhook_events.event_id` PK + `transactions.webhook_event_id` UNIQUE |
| El webhook solo lo invoca la pasarela | HMAC-SHA256 sobre el raw body, comparado con `timingSafeEqual` |
| El usuario sale siempre del token | `JwtAuthGuard` + `forbidNonWhitelisted` (se rechaza un `user_id` en el body) |
| Login sin enumeración de emails | Mismo error y bcrypt contra un hash de relleno; el límite de intentos también aplica a emails inexistentes |
| Fuerza bruta acotada | 3 intentos fallidos por email → bloqueo de 5 min (429) |
| Trazabilidad | Ledger append-only con `balance_after` y su origen; auditoría de eventos; logs JSON con `X-Request-Id` |

## 8. Evolución propuesta: sistema de colas

> **Estado: propuesta, no implementada.** Hoy todo se resuelve de forma síncrona dentro de una transacción de SQLite, lo que basta para una instancia y garantiza la consistencia. Las colas tienen sentido cuando el sistema crece: más tráfico de la pasarela, varias instancias o servicios que necesitan reaccionar a los movimientos.

### Qué problemas resuelve

| Punto | Hoy | Con colas |
|---|---|---|
| **Webhook** | Valida, acredita y responde en la misma petición | Valida la firma, registra el evento (*inbox*) y responde `200` al instante. Un worker acredita después, así la pasarela no espera ni reintenta por lentitud nuestra |
| **Fallos transitorios** | Un error (p. ej. base ocupada) devuelve 500 y depende de que la pasarela reintente | El worker reintenta con backoff exponencial; tras N intentos el evento pasa a una **dead-letter queue (DLQ)** |
| **`USER_NOT_FOUND`** | Queda registrado y nadie lo vuelve a procesar | Se reprocesa desde la DLQ cuando el usuario exista o tras una revisión manual |
| **Eventos de negocio** | No se emiten | **Outbox transaccional**: el movimiento y el evento `balance.updated` se guardan en la misma transacción, y un publicador los envía a la cola (notificaciones, analítica, antifraude) |

### Diseño

```mermaid
flowchart LR
  PG([Pasarela]) -- "X-Signature" --> API

  subgraph api[API NestJS]
    API["WebhooksController<br/>1. valida la firma y el body<br/>2. INSERT webhook_events PENDING<br/>3. encola event_id"]
    PUB["OutboxPublisher<br/>lee outbox_events pendientes"]
  end

  API -- "200 inmediato" --> PG
  API --> DB[(Base de datos)]
  API --> QW[["cola: payment-gateway"]]

  subgraph workers[Workers]
    W["PaymentGatewayWorker<br/>transacción:<br/>acreditar + CREDITED + outbox"]
  end

  QW --> W
  W --> DB
  W -- "tras N fallos" --> DLQ[["DLQ: payment-gateway-failed"]]

  DB --> PUB
  PUB --> QE[["cola: balance.updated"]]
  QE --> C1[Notificaciones]
  QE --> C2[Analítica / antifraude]
```

### Flujo del webhook con cola

```mermaid
sequenceDiagram
  autonumber
  participant PG as Pasarela
  participant API as API
  participant DB as Base
  participant Q as Cola (BullMQ)
  participant W as Worker

  PG->>API: POST /webhooks/payment-gateway + X-Signature
  API->>API: valida HMAC y body
  API->>DB: INSERT webhook_events (PENDING), ON CONFLICT no hace nada
  API->>Q: add(jobId = event_id)
  API-->>PG: 200 received
  Q->>W: procesa event_id
  W->>DB: BEGIN, acredita, outcome = CREDITED, INSERT outbox_events, COMMIT
  alt error transitorio
    W-->>Q: falla, se reintenta con backoff (1s, 5s, 30s…)
  else agotó los reintentos
    W-->>Q: pasa a la DLQ y queda en FAILED para revisión
  end
```

### Decisiones

- **Herramienta: BullMQ + Redis.**
  - Se integra con NestJS (`@nestjs/bullmq`) y trae reintentos, backoff, DLQ, prioridades y un panel de monitoreo (Bull Board).
  - El mismo Redis serviría para el límite de intentos del login, que hoy vive en memoria.
  - Con un volumen mucho mayor o con varios consumidores independientes usaría **Amazon SQS** o **RabbitMQ**.
- **La idempotencia se mantiene en la base, no en la cola.**
  - Las colas garantizan entrega *al menos una vez*, así que un job puede ejecutarse dos veces.
  - Lo impiden la PK de `webhook_events.event_id` y el `UNIQUE` de `transactions.webhook_event_id`.
  - Usar `jobId = event_id` además evita encolar duplicados.
- **Outbox transaccional en lugar de publicar directo.**
  - Si se publicara en la cola desde dentro de la transacción y luego esta se revirtiera, saldría un evento falso.
  - Con la tabla `outbox_events` el evento existe solo si el movimiento se confirmó.
- **Depósitos y retiros siguen síncronos.**
  - El usuario necesita ver el saldo actualizado en la respuesta, y la `Idempotency-Key` ya cubre los reintentos.
  - Encolarlos obligaría a manejar estados "pendientes" en la pantalla sin un beneficio claro.
- **Base de datos.** Con workers en procesos separados, SQLite deja de ser adecuada (escrituras concurrentes desde varios procesos): este cambio va de la mano con migrar a **PostgreSQL**.

### Cambios necesarios

| Pieza | Cambio |
|---|---|
| `webhook_events` | Nuevos estados `PENDING`, `PROCESSING` y `FAILED`, además de `attempts` y `last_error` |
| `outbox_events` (nueva) | `id`, `type`, `payload`, `created_at`, `published_at` |
| `WebhooksService` | Solo registra y encola; la acreditación pasa a `PaymentGatewayWorker` |
| `OutboxPublisher` | Tarea periódica que publica los eventos pendientes y marca `published_at` |
| Docker Compose | Servicios `redis` y `worker` (misma imagen del backend, con otro comando) |

### Contrapartidas

- **Consistencia eventual:** un pago aprobado puede tardar unos segundos en verse en el saldo. La pantalla tendría que refrescar el saldo (polling o SSE) o mostrar los pagos en proceso.
- **Más infraestructura:** Redis y los workers son piezas nuevas que hay que desplegar, monitorear (tamaño de la cola, DLQ) y mantener.
- **Pruebas más complejas:** se necesitan pruebas de integración con Redis y de los reintentos.
