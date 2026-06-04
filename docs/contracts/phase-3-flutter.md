# Contrato de implementação — Fase 3: Cadastro municipal (Flutter)

| Campo | Valor |
|-------|-------|
| **ADR** | [ADR-001](../adr/ADR-001-multi-tenant-municipal.md) |
| **Status** | Aguardando Fase 2 |
| **Pré-requisito** | Fases 1 e 2 concluídas; funções `geo.*` ativas |
| **Impacto** | App Flutter + endpoints auth backend |

---

## 1. Objetivo

Vincular cidadão ao município no cadastro via validação geográfica (`ST_Within` / `ST_Contains`), com confirmação de endereço via Nominatim. **Reclamações permanecem sem restrição geográfica** nesta fase.

---

## 2. Escopo

### Incluído

- Novo fluxo pós-signup (ou step integrado) de confirmação de localização
- Endpoint backend validação + persistência `home_cd_mun`
- Reutilizar Geolocator + Nominatim (padrão de `create_complaint_page.dart`)
- Tela: "Identificamos que você está em {cidade}!"
- Formulário endereço autocompletado + confirmação explícita
- Login/`getMe` retorna `home_cd_mun` e município nome

### Excluído

- Restringir criação de reclamações por município
- Alterar admin-web (salvo exibir stats de cidadãos confirmados — opcional)
- Validação por CEP sem coordenadas (fase futura)
- Bloquear cadastro se fora de município com tenant ativo (mostrar erro amigável — incluído)

---

## 3. Regras de negócio

| # | Regra |
|---|-------|
| RN-01 | Cadastro básico (email, senha, nome, cpf, phone) permanece |
| RN-02 | Após registro, app solicita permissão de localização |
| RN-03 | Backend recebe lat/lng e resolve município via `geo.resolve_cd_mun` |
| RN-04 | Só permite confirmar se município tem tenant `status IN ('trial','active')` |
| RN-05 | Se ponto fora de qualquer município SP carregado → erro "Não identificamos sua cidade" |
| RN-06 | Reverse geocoding Nominatim preenche endereço; usuário pode editar antes de confirmar |
| RN-07 | Confirmar → set `home_cd_mun`, `registration_address`, `address_confirmed_at` |
| RN-08 | Usuário pode pular? **Não** — confirmação obrigatória para concluir onboarding (decisão ADR-001) |
| RN-09 | Reclamações: **sem** validação contra `home_cd_mun` |

---

## 4. Contrato de API (backend)

### 4.1 Novo endpoint

**POST `/api/auth/resolve-location`** (autenticado — após register/login parcial)

Request:
```json
{ "latitude": -22.9056, "longitude": -47.0608 }
```

Response 200:
```json
{
  "cd_mun": "3509502",
  "municipio": "Campinas",
  "sigla_uf": "SP",
  "tenantActive": true,
  "suggestedAddress": null
}
```

Response 404:
```json
{ "message": "Não identificamos sua cidade. Verifique se a localização está ativa." }
```

Response 403:
```json
{ "message": "LifeCity ainda não está disponível em sua cidade." }
```

Implementação:
```sql
SELECT m.cd_mun, m.nm_mun, m.sigla_uf,
       EXISTS(SELECT 1 FROM tenants t WHERE t.cd_mun = m.cd_mun AND t.status IN ('trial','active')) AS tenant_active
FROM malhas.municipios m
WHERE ST_Contains(m.geometry, ST_SetSRID(ST_MakePoint($lng, $lat), 4326));
```

### 4.2 Confirmar endereço

**POST `/api/auth/confirm-location`** (autenticado)

Request:
```json
{
  "cd_mun": "3509502",
  "address": "Rua Exemplo, 123 - Centro, Campinas - SP",
  "latitude": -22.9056,
  "longitude": -47.0608
}
```

Validações:
- Re-validar `ST_Contains` para lat/lng + cd_mun coerente
- Tenant ativo para cd_mun
- User ainda sem `address_confirmed_at` (idempotente se já confirmado)

Response 200:
```json
{
  "message": "Localização confirmada",
  "user": {
    "home_cd_mun": "3509502",
    "municipio": "Campinas",
    "address_confirmed_at": "2026-06-04T..."
  }
}
```

### 4.3 Alterações existentes

**POST `/api/auth/register`** — sem mudança de contrato request; response pode incluir flag:
```json
{ "message": "Registrado com sucesso", "requiresLocationConfirmation": true }
```

**GET `/api/auth/me`** — adicionar campos:
```json
{
  "user": {
    "id": "uuid",
    "name": "...",
    "home_cd_mun": "3509502",
    "municipio_nome": "Campinas",
    "registration_address": "...",
    "address_confirmed_at": "..."
  }
}
```

### 4.4 Middleware onboarding (opcional)

Rotas app (exceto auth/confirm) podem retornar 428 se `address_confirmed_at IS NULL` — **decisão implementação**: recomendado para forçar conclusão, mas pode ser só redirect no Flutter sem bloquear API de reclamações.

**Importante:** `/api/complaints/create` **não** deve exigir `home_cd_mun`.

---

## 5. Contrato UI — Flutter

### 5.1 Fluxo de navegação

```
SignUpForm (existente)
    → Register API OK
    → LocationConfirmationPage (NOVA)
        → Solicita permissão GPS
        → POST resolve-location
        → Exibe "Identificamos que você está em Campinas!"
        → Campo endereço (Nominatim reverse geocode)
        → Botão "Confirmar localização"
        → POST confirm-location
    → Login ou Home (AppRoutes.entrypoint)
```

Usuários existentes sem `address_confirmed_at`: redirect na abertura do app para `LocationConfirmationPage`.

### 5.2 LocationConfirmationPage

| Elemento | Comportamento |
|----------|---------------|
| Título | "Identificamos que você está em **{municipio}**!" |
| Subtítulo | "Confirme sua localização para continuar" |
| Mapa miniatura | Opcional: flutter_map pin (reuse entrypoint patterns) |
| Campo endereço | TextFormField, preenchido por `_reverseGeocode` |
| Botão editar local | Re-solicita GPS |
| CTA primário | "Confirmar" → API confirm |
| Erro fora área | Ilustração + "LifeCity não disponível na sua região" |
| Loading | Durante GPS e Nominatim |

### 5.3 Reutilizar código existente

Extrair de `lib/views/complaints/create_complaint_page.dart`:
- `_reverseGeocode(lat, lon)` → service compartilhado `lib/core/services/geocoding_service.dart`
- Padrão permissão Geolocator de `entrypoint_ui.dart`

### 5.4 AuthState

Estender:
```dart
bool get needsLocationConfirmation =>
  user != null && user!.addressConfirmedAt == null;

Future<bool> confirmLocation({required String cdMun, required String address, ...});
Future<ResolveLocationResult?> resolveLocation(double lat, double lng);
```

---

## 6. Estrutura de arquivos (Flutter)

```
lib/
  core/
    services/
      geocoding_service.dart      # Nominatim reverse (extraído)
      location_auth_service.dart  # resolve + confirm API
    models/
      user_model.dart             # + homeCdMun, addressConfirmedAt
  views/
    auth/
      location_confirmation_page.dart
  core/routes/app_routes.dart     # + locationConfirmation route
```

Backend:
```
backend/src/controllers/authController.js  # resolve + confirm
backend/src/routes/authRoutes.js
```

---

## 7. Prompt EXPLORE (Fase 3)

```
Contexto: LifeCity ADR-001 Fase 3.

Explore:
1. lib/views/auth/sign_up_form.dart — fluxo pós signup
2. lib/core/state/auth_state.dart — signUp, persist session
3. lib/views/complaints/create_complaint_page.dart — _reverseGeocode Nominatim
4. lib/views/entrypoint/entrypoint_ui.dart — Geolocator permissions
5. backend authController register/getMe
6. MCP: SELECT tenants WHERE status active; test geo.resolve_cd_mun Campinas
7. docs/contracts/phase-3-flutter.md

Mapear: pontos de intercept onboarding, rotas, modelos User.
```

---

## 8. Prompt EXECUTE (Fase 3)

```
Contexto: LifeCity ADR-001 Fase 3. Contrato: docs/contracts/phase-3-flutter.md
Rule: .cursor/rules/lifecity-multi-tenant.mdc

Execute:
1. Backend: POST resolve-location, confirm-location; estender getMe/register response
2. Extrair GeocodingService do create_complaint_page
3. LocationConfirmationPage + rota + AuthState
4. Redirect usuários sem address_confirmed_at
5. NÃO adicionar validação geográfica em complaintController.create
6. Testes: seção 9

Manter retrocompat: usuários antigos forçados a confirmar na próxima abertura.
```

---

## 9. Testes de validação

### 9.1 Backend

```bash
# Register
TOKEN=... # após register+login

# Resolve Campinas
curl -X POST http://localhost:3000/api/auth/resolve-location \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude":-22.9056,"longitude":-47.0608}'
# Esperado: cd_mun 3509502, tenantActive true

# Confirm
curl -X POST http://localhost:3000/api/auth/confirm-location \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cd_mun":"3509502","address":"Rua Teste, Campinas","latitude":-22.9056,"longitude":-47.0608}'

# Me
curl http://localhost:3000/api/auth/me -H "Authorization: Bearer $TOKEN"
# Esperado: home_cd_mun, address_confirmed_at preenchidos
```

```sql
SELECT home_cd_mun, registration_address, address_confirmed_at
FROM users WHERE email = 'test@example.com';
```

### 9.2 Ponto inválido

```bash
curl -X POST .../resolve-location -d '{"latitude":0,"longitude":0}'
# Esperado: 404
```

### 9.3 Flutter manual

- [ ] Novo cadastro → tela confirmação Campinas (simulador/emulador com mock location Campinas)
- [ ] Endereço preenchido via Nominatim
- [ ] Confirmar → entra no app
- [ ] Criar reclamação em outro ponto (ex.: Pinheiros SP) → **deve funcionar**
- [ ] Usuário antigo → redirect confirmação no boot

### 9.4 Não-regressão admin

- [ ] Dashboard admin continua operando
- [ ] Novos users aparecem com `home_cd_mun` no banco

---

## 10. Critérios de aceite

- [ ] Cidadão vinculado a município via ST_Contains
- [ ] UI confirmação conforme especificação
- [ ] Nominatim autocompleta endereço
- [ ] Reclamações **sem** restrição geográfica
- [ ] Tenant inativo → mensagem clara
- [ ] Usuários legados passam por confirmação

---

## 11. Considerações futuras (fora desta fase)

- Filtrar mapa do app por `home_cd_mun`
- Validar reclamações dentro do município (ADR-003)
- Cadastro por CEP quando GPS negado
