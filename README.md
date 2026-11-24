# STRATA DLIS

O STRATA é a biblioteca e o visualizador de perfis de poço RP66 V1 do projeto Tecgraf. O catálogo organiza os arquivos publicados por fonte. O visualizador abre um DLIS local no navegador para inspecionar curvas, profundidades e marcações.

## Rodar localmente

Na raiz deste repositório, com Node.js 22.18 ou superior e npm instalados, execute:

```bash
npm run dev
```

Abra **http://localhost:5173**. A primeira execução baixa as dependências fixadas no lockfile, cria `strata-dlis/.dev.vars` se necessário e aplica as migrações no D1 local. O armazenamento R2 também é emulado no computador. Encerre pelo terminal com `Ctrl+C`. No Codespaces, abra a porta privada 5173 pela aba **Ports**. O servidor só inicia quando você executa o comando.

| Comando na raiz | O que faz |
| --- | --- |
| `npm run seed` | Adiciona Aurora e Boreal à coleção **Exemplos sintéticos** no banco local. Pode ser repetido. Atualize a biblioteca para vê-los. |
| `npm run doctor` | Confere Node, npm, dependências, porta e configuração opcional das contas. Exibe as correções em português. |
| `npm run setup` | Instala as dependências pelo lockfile para executar as verificações separadamente. |
| `npm run lint` e `npm run typecheck` | Verificam regras de código e tipos. |
| `npm test` | Executa a suíte unitária. |
| `npm run build` | Gera a aplicação para o Worker em `strata-dlis/dist`. |

O catálogo e o guia abrem como visitante. Para testar contas reais, configure a URL e a chave pública do seu Supabase em `strata-dlis/.dev.vars` e reinicie o servidor. O guia da aplicação descreve a configuração de e-mail e dos papéis de acesso.

- [Guia da aplicação e configuração de contas](strata-dlis/README.md)
- [Roteiro das sete fases e situação das funcionalidades](ROADMAP.md)
- [Auditoria de confiabilidade, testes e captura do catálogo](strata-dlis/docs/AUDITORIA_FASE_1.md)
- [Modelo de dados](strata-dlis/docs/DATA_MODEL.md) e [indicadores de qualidade](strata-dlis/docs/DATA_QUALITY.md)
- [Paletas e marcações](strata-dlis/docs/MARCACOES.md) e [motor científico opcional](strata-dlis/science/README.md)
- [Histórico de validação](strata-dlis/docs/VALIDACAO.md) e [infraestrutura institucional](strata-dlis/docs/SEGURANCA.md)
