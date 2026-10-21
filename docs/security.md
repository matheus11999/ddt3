# Segurança: correções da auditoria de 21/10/2026

Regressões em `tests/security.integration.ts` (`npm run test:security:integration`, precisa de Postgres e Redis) e nos testes unitários citados.

- **A01 sessões do jogo**: `sessions.account_session` liga a sessão do jogo à sessão da conta que a abriu (`ON DELETE CASCADE`). Personagem de conta só joga com uma sessão de conta viva (`AccountStore.validGameSessions`); logout e nova senha encerram HTTP, novos upgrades e sockets abertos (o servidor revalida a cada `SESSION_RECHECK_MS`, 10 s, e fecha com 4003; o cliente mostra "Sua sessão foi encerrada"). Convidado continua jogando só com o cookie do jogo enquanto o fluxo de convidado existir.
- **A02 admin**: cada sessão guarda a versão das credenciais (`credentialVersion`, hash de usuário + hash da senha). Mudar `ADMIN_USERNAME`/`ADMIN_PASSWORD_HASH` ou remover a configuração invalida leitura e escrita, também após reinício; as sessões antigas são apagadas.
- **A03 força do disparo**: o servidor marca o início da carga (`aim` com `charging`, por turno) no próprio relógio e só aceita a força que a régua mostraria pelo tempo segurado, com tolerância de rede (`forceMatchesHold` em `shared/forceBar.ts`: 400 ms a menos, 2 s a mais). Disparo recusado mantém o turno (`retryShot`) e a régua pode carregar de novo. Testes: `tests/force-authority.test.ts`; nos testes de jogo use `chargedFire` (`tests/fixtures/charge.ts`).
- **A04 upload**: a conta é conferida em `onRequest`, antes de ler o corpo; tamanho declarado obrigatório (411/413), um envio por conta, orçamento total em memória (`UPLOAD_BUDGET_BYTES`, 96 MB) e corpo lento cortado (`UPLOAD_TIMEOUT_MS`, 120 s).
- **A05 cota**: reserva da cota diária com trava por conta na transação, também limite de bytes por dia (`FORUM_MEDIA.perDayBytes`); falha não deixa registro nem arquivo.
- **A06 JPEG**: `stripJpegMetadata` percorre o arquivo inteiro (bytes de preenchimento, várias varreduras, lixo após o fim) e remove APP1, APP3–APP13, APP15 e COM; o que não consegue ler é recusado (415), nunca salvo como veio.
- **A07 usuário Unicode**: comparação por hash de tamanho fixo (`sameSecret`); vira falha de login contada e auditada.
- **D01**: `sharp` 0.35.5 (`npm audit` sem alertas); `scripts/webp-assets.mjs` com teto de 100 MP.
