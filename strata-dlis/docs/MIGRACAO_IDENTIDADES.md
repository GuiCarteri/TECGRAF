# Migração de identidades existentes

Não há associação automática por coincidência de e-mail. A identidade atual é `supabase:<UUID confirmado pelo provedor>`. Registros associados a IDs antigos permanecem no banco e não ficam acessíveis a uma nova conta sem migração explícita.

## Procedimento operacional

1. Agende manutenção, suspenda escritas e conclua/cancele uploads em andamento. Preserve a instalação anterior para rollback.
2. Exporte o D1 autorizado com `wrangler d1 export DB --remote --output backup.sql`. Confira sucesso, tamanho e SHA-256. Guarde uma cópia imutável, fora do repositório, com acesso restrito. Faça inventário e backup R2 preservando todas as chaves `object_key` e hashes.
3. Confirme a titularidade de **ambas** as identidades: acesso comprovado à antiga conta ou evidência organizacional formal e autenticação na conta Supabase com e-mail confirmado. Coincidência de e-mail, nome ou domínio não é suficiente. Registre aprovação de operador autorizado e evidências separadas do código.
4. Faça a nova identidade entrar uma vez no STRATA para criar sua linha `users`, sem privilégios herdados. Congele novamente escritas e gere um backup consistente final.
5. Crie um arquivo privado de mapeamento, em formato de lista JSON. Cada entrada precisa de `old_user_id`, `new_user_id`, `evidence_sha256` (hash das evidências aprovadas) e `approved_by` (identidade do responsável). Não use IDs ou hashes fictícios em migração real.
6. Valide offline:

```bash
python3 scripts/migrate-identities.py --backup backup.sql --mapping verified-mapping.json
```

7. Revise o relatório de contagens. O script recusa mapas não unívocos, identidades inexistentes, evidência ausente, uploads pendentes e colisões de histórico `(owner_id, hash)`. Se houver colisão, concilie formalmente os dois registros antes da migração; não descarte histórico automaticamente.
8. Gere uma **nova cópia** migrada:

```bash
python3 scripts/migrate-identities.py --backup backup.sql --mapping verified-mapping.json --output migrated.sql
```

O script opera em SQLite em memória e grava um novo arquivo; nunca conecta ao D1 remoto. Não sobrescreve o backup. Preserva todas as linhas de usuários, papéis, análises, pontos, settings, hashes e contagens. Atualiza `owner_id` em arquivos, análises, histórico e exportações, além de `reviewer_id` em arquivos. Registra mapa e hash da evidência na tabela `identity_migrations`. Não transfere privilégios da conta antiga.

9. Importe a cópia para **um D1 novo de homologação**, ajustando a compatibilidade do dump com o importador D1. `sqlite3.iterdump` produz `BEGIN TRANSACTION`/`COMMIT`; o importador D1 gerencia transações e pode exigir remover esses delimitadores da cópia de importação. Tabelas internas de um export D1 também devem ser tratadas conforme a documentação do importador. Não rode o dump sobre o banco ativo.
10. Valide contagens e amostras de hashes; confira que pontos/settings não mudaram; teste acesso da nova conta, bloqueio de outras contas, histórico, publicações privadas, papéis e rastreabilidade. Compare o inventário R2. Mantenha as evidências e o relatório em armazenamento restrito.
11. Somente após aprovação operacional, troque o binding para o D1 validado em uma implantação própria. O R2 pode ser mantido quando as chaves não mudarem. Para rollback, restaure o binding anterior; concilie qualquer escrita ocorrida depois do corte antes de reverter.

Este procedimento não foi aplicado a dados reais nesta entrega. O teste automatizado usa apenas um banco em memória, verifica preservação de pontos/papéis e rejeição de mapas inseguros. A importação completa de um dump real deve ser ensaiada na conta Cloudflare do operador.
